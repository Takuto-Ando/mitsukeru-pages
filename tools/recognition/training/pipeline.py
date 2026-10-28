"""Offline candidate training/export. Never loaded by the production app."""
import argparse
import hashlib
import json
from pathlib import Path
import random
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
LABELS = [s['id'] for s in json.loads((ROOT / 'tools/recognition/species.json').read_text())['species']]
MODELS = {'v4-small': 'mobilenetv4_conv_small.e2400_r224_in1k', 'small': 'mobilenetv3_small_100.lamb_in1k', 'large': 'mobilenetv3_large_100.ra_in1k'}


def write_json(path, data):
    with Path(path).open('x') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def dataset(path):
    path = Path(path).resolve()
    check = subprocess.run(['node', str(ROOT / 'tools/recognition/cli.mjs'), 'check', str(path)], cwd=ROOT, capture_output=True, text=True)
    if check.returncode not in (0, 2):
        raise ValueError(check.stderr.strip() or 'Invalid dataset')
    return path, json.loads(path.read_text())['samples']


def dataset_signature(path, rows):
    digest = hashlib.sha256(path.read_bytes())
    for row in sorted(rows, key=lambda r: r['id']):
        digest.update(row['id'].encode())
        digest.update(hashlib.sha256((path.parent / row['file']).read_bytes()).digest())
    return digest.hexdigest()


def verify_external_test(path, rows, reference_path, metadata):
    original_path, original_rows = dataset(reference_path)
    if dataset_signature(original_path, original_rows) != metadata['datasetSignature']:
        raise ValueError('Reference dataset no longer matches the trained model')
    if not rows or any(row['split'] != 'test' for row in rows):
        raise ValueError('External evaluation must contain test rows only')
    groups = {row['captureGroup'] for row in original_rows}
    ids = {row['id'] for row in original_rows}
    authors = {row['author'] for row in original_rows if row.get('author')}
    hashes = {hashlib.sha256((original_path.parent / row['file']).read_bytes()).hexdigest() for row in original_rows}
    for row in rows:
        if row['id'] in ids or row['captureGroup'] in groups or (row.get('author') and row['author'] in authors):
            raise ValueError('External test overlaps a previous photo, author or capture group')
        if hashlib.sha256((path.parent / row['file']).read_bytes()).hexdigest() in hashes:
            raise ValueError('External test contains a duplicate photo from the reference dataset')


def require_classes(rows, split):
    missing = set(LABELS) - {r['speciesId'] for r in rows if r['split'] == split}
    if missing:
        raise ValueError(f'{split} images missing: {sorted(missing)}')


def imports():
    import numpy as np
    import torch
    import timm
    from PIL import Image, ImageOps
    return np, torch, timm, Image, ImageOps


def transform_for(config, training=False):
    import timm
    return timm.data.create_transform(**config, is_training=training,
        **({'scale': (.75, 1.), 'ratio': (.85, 1.15), 'color_jitter': .2} if training else {}))


def image_tensor(path, transform):
    from PIL import Image, ImageOps
    with Image.open(path) as image:
        return transform(ImageOps.exif_transpose(image).convert('RGB'))


def train(args):
    # Check completeness before downloading weights or allocating a run folder.
    path, rows = dataset(args.dataset)
    require_classes(rows, 'train')
    require_classes(rows, 'validation')
    out = Path(args.out)
    if out.exists(): raise FileExistsError(f'Run already exists: {out}')
    if args.epochs < 1 or args.warmup_epochs < 0 or args.batch_size < 1:
        raise ValueError('Invalid epoch/batch configuration')
    if args.batch_size == 1 and args.warmup_epochs < args.epochs:
        raise ValueError('Fine-tuning BatchNorm requires batch-size >= 2')
    np, torch, timm, _, _ = imports()
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    torch.set_num_threads(2)
    device = 'mps' if args.device == 'auto' and torch.backends.mps.is_available() else ('cpu' if args.device == 'auto' else args.device)
    model = timm.create_model(MODELS[args.model], pretrained=True, num_classes=len(LABELS)).to(device)
    config = timm.data.resolve_model_data_config(model)
    transform, eval_transform = transform_for(config, True), transform_for(config)
    training = [r for r in rows if r['split'] == 'train' and r['speciesId'] in LABELS]
    validation = [r for r in rows if r['split'] == 'validation' and r['speciesId'] in LABELS]
    class Photos(torch.utils.data.Dataset):
        def __init__(self, samples, process): self.samples, self.process = samples, process
        def __len__(self): return len(self.samples)
        def __getitem__(self, index):
            row = self.samples[index]
            return image_tensor(path.parent / row['file'], self.process), LABELS.index(row['speciesId'])
    # A singleton final batch cannot update the pooled BatchNorm layers.
    drop_singleton = len(training) % args.batch_size == 1 and args.warmup_epochs < args.epochs
    loader = torch.utils.data.DataLoader(Photos(training, transform), batch_size=args.batch_size, shuffle=True, num_workers=0, drop_last=drop_singleton)
    val_loader = torch.utils.data.DataLoader(Photos(validation, eval_transform), batch_size=args.batch_size, num_workers=0)
    counts = [sum(r['speciesId'] == label for r in training) for label in LABELS]
    weights = torch.tensor([1 / n for n in counts], device=device)
    criterion = torch.nn.CrossEntropyLoss(weight=weights / weights.mean())
    out.mkdir(parents=True, exist_ok=False)
    metadata = {'version': 1, 'model': MODELS[args.model], 'labels': LABELS, 'preprocess': config,
        'trainedFromDataset': False, 'trainingCompleted': False, 'datasetManifestSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'datasetSignature': dataset_signature(path, rows),
        'seed': args.seed, 'device': device, 'trainImages': len(training), 'validationImages': len(validation),
        'testUsedForTraining': False, 'unknownTrainingImagesUsed': False, 'torchVersion': torch.__version__, 'timmVersion': timm.__version__}
    metadata['trainingConfig'] = {'epochs': args.epochs, 'warmupEpochs': args.warmup_epochs,
        'batchSize': args.batch_size, 'dropSingletonBatch': drop_singleton,
        'headOnly': args.warmup_epochs >= args.epochs, 'optimizer': 'AdamW',
        'headLearningRate': .001, 'fineTuneLearningRate': .0001, 'weightDecay': .01}
    write_json(out / 'metadata.json', metadata)
    best, history, optimizer = -1, [], None
    for epoch in range(args.epochs):
        warm = epoch < args.warmup_epochs
        if epoch == 0 or epoch == args.warmup_epochs:
            for p in model.parameters(): p.requires_grad_(not warm)
            for p in model.get_classifier().parameters(): p.requires_grad_(True)
            optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=1e-3 if warm else 1e-4, weight_decay=.01)
        model.eval() if warm else model.train()
        total_loss = 0.; seen_images = 0
        for images, targets in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images.to(device)), targets.to(device))
            loss.backward(); optimizer.step()
            total_loss += loss.item() * len(targets)
            seen_images += len(targets)
        model.eval(); tp = [0] * len(LABELS); support = [0] * len(LABELS)
        with torch.inference_mode():
            for images, targets in val_loader:
                predicted = model(images.to(device)).argmax(1).cpu()
                for target, prediction in zip(targets.tolist(), predicted.tolist()):
                    support[target] += 1; tp[target] += int(target == prediction)
        macro = sum(a / b for a, b in zip(tp, support)) / len(LABELS)
        record = {'epoch': epoch + 1, 'loss': total_loss / seen_images, 'validationMacroRecall': macro}
        history.append(record); print(json.dumps(record), flush=True)
        if macro > best:
            best = macro
            torch.save({key: value.detach().cpu() for key, value in model.state_dict().items()}, out / 'best.pt')
    write_json(out / 'history.json', history)
    metadata.update(trainedFromDataset=True, trainingCompleted=True)
    (out / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))


def export_onnx(model, config, path):
    import torch
    import onnx
    dummy = torch.zeros(1, *config['input_size'])
    model = model.cpu().eval()
    torch.onnx.export(model, dummy, str(path), input_names=['pixel_values'], output_names=['logits'],
        dynamic_axes={'pixel_values': {0: 'batch'}, 'logits': {0: 'batch'}}, opset_version=17, dynamo=False, external_data=False)
    onnx.checker.check_model(str(path))


def quantize(source, output, tensors):
    from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
    from onnxruntime.quantization.shape_inference import quant_pre_process
    prepared = source.with_name('prepared.onnx')
    quant_pre_process(str(source), str(prepared), skip_symbolic_shape=True)
    class Reader(CalibrationDataReader):
        def __init__(self): self.rows = iter(tensors)
        def get_next(self):
            row = next(self.rows, None)
            return None if row is None else {'pixel_values': row}
    quantize_static(str(prepared), str(output), Reader(), quant_format=QuantFormat.QDQ,
        activation_type=QuantType.QInt8, weight_type=QuantType.QInt8, per_channel=True,
        op_types_to_quantize=['Conv', 'MatMul', 'Gemm'])


def export(args):
    _, torch, timm, _, _ = imports()
    run = Path(args.run); meta = json.loads((run / 'metadata.json').read_text())
    if meta['labels'] != LABELS or meta['model'] not in MODELS.values() or not meta.get('trainingCompleted'): raise ValueError('Incompatible or incomplete checkpoint metadata')
    if args.quantize and not args.dataset: raise ValueError('--quantize requires --dataset')
    out = run / 'export'; out.mkdir(exist_ok=False)
    model = timm.create_model(meta['model'], pretrained=False, num_classes=len(LABELS))
    model.load_state_dict(torch.load(run / 'best.pt', map_location='cpu', weights_only=True))
    export_onnx(model, meta['preprocess'], out / 'model.fp32.onnx')
    if args.quantize:
        if not args.dataset: raise ValueError('--quantize requires --dataset')
        path, rows = dataset(args.dataset)
        if dataset_signature(path, rows) != meta['datasetSignature']: raise ValueError('Training manifest or photos have changed')
        require_classes(rows, 'train')
        if args.calibration_limit < len(LABELS): raise ValueError('Calibration limit must cover 18 labels')
        by_class = [[r for r in rows if r['split'] == 'train' and r['speciesId'] == label] for label in LABELS]
        # Deterministic, balanced calibration from TRAIN only; no validation/test leakage.
        selected = [bucket[i] for i in range(max(map(len, by_class))) for bucket in by_class if i < len(bucket)][:args.calibration_limit]
        process = transform_for(meta['preprocess'])
        tensors = (image_tensor(path.parent / r['file'], process).unsqueeze(0).numpy() for r in selected)
        quantize(out / 'model.fp32.onnx', out / 'model.int8.onnx', tensors)
        write_json(out / 'calibration.json', {'split': 'train', 'sampleIds': [r['id'] for r in selected]})
    write_json(out / 'metadata.json', meta)
    print('Exported candidates only; not installed in the app.')


def session(path):
    import onnxruntime as ort
    options = ort.SessionOptions(); options.intra_op_num_threads = 1; options.inter_op_num_threads = 1
    return ort.InferenceSession(str(path), options, providers=['CPUExecutionProvider'])


def smoke(args):
    np, torch, timm, _, _ = imports()
    torch.set_num_threads(2); torch.manual_seed(42)
    out = Path(args.out); out.mkdir(parents=True, exist_ok=False)
    model = timm.create_model(MODELS[args.model], pretrained=False, num_classes=len(LABELS))
    config = timm.data.resolve_model_data_config(model)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    model.train(); loss = torch.nn.functional.cross_entropy(model(torch.randn(2, *config['input_size'])), torch.tensor([0, 1]))
    loss.backward(); optimizer.step(); model.eval()
    export_onnx(model, config, out / 'model.fp32.onnx')
    rng = np.random.default_rng(42)
    quantize(out / 'model.fp32.onnx', out / 'model.int8.onnx', (rng.normal(size=(1, *config['input_size'])).astype(np.float32) for _ in range(4)))
    report = {'kind': 'synthetic-pipeline-smoke-only', 'animalAccuracyMeasured': False, 'model': MODELS[args.model], 'inputSize': config['input_size'], 'artifacts': []}
    data = np.zeros((1, *config['input_size']), dtype=np.float32)
    for name in ['model.fp32.onnx', 'model.int8.onnx']:
        started = time.perf_counter(); runner = session(out / name); prepare = (time.perf_counter() - started) * 1000
        timings = []
        for _ in range(6):
            started = time.perf_counter(); logits = runner.run(None, {'pixel_values': data})[0]; timings.append((time.perf_counter() - started) * 1000)
        if logits.shape != (1, len(LABELS)) or not np.isfinite(logits).all(): raise ValueError('Invalid ONNX output')
        report['artifacts'].append({'file': name, 'bytes': (out / name).stat().st_size, 'prepareMs': prepare, 'firstMs': timings[0], 'warmMedianMs': float(np.median(timings[1:]))})
    write_json(out / 'smoke-report.json', report)
    print(json.dumps(report, indent=2))


def predict(args):
    np, _, _, _, _ = imports()
    path, rows = dataset(args.dataset)
    model_file = Path(args.model_file)
    metadata_path = model_file.parent / 'metadata.json'
    if not metadata_path.exists(): raise ValueError('Trained model metadata is missing; synthetic smoke models cannot classify animals')
    meta = json.loads(metadata_path.read_text())
    if meta['labels'] != LABELS or not meta.get('trainedFromDataset'): raise ValueError('Not a trained 18-species candidate')
    reference = getattr(args, 'reference_dataset', None)
    if reference:
        if args.split != 'test': raise ValueError('External data is for frozen-model test evaluation only')
        verify_external_test(path, rows, reference, meta)
    elif dataset_signature(path, rows) != meta['datasetSignature']:
        raise ValueError('Evaluation manifest or photos differ from the fixed training/validation/test dataset')
    samples = [r for r in rows if r['split'] == args.split]
    if not samples: raise ValueError('No evaluation images')
    if Path(args.out).exists(): raise ValueError('Output already exists')
    started = time.perf_counter(); runner = session(model_file); prepare = (time.perf_counter() - started) * 1000
    process = transform_for(meta['preprocess']); results = []
    model_id = hashlib.sha256(model_file.read_bytes()).hexdigest()
    policy = json.loads(Path(args.policy).read_text()) if args.policy else None
    if policy and (policy.get('kind') != 'provisional-validation-policy' or policy.get('modelSha256') != model_id):
        raise ValueError('Policy belongs to another model')
    allow_confirm = bool(policy and policy.get('acceptanceEnabled'))
    minimum, margin_limit = (policy['minimum'], policy['margin']) if allow_confirm else (1., 1.)
    for row in samples:
        started = time.perf_counter()
        image = image_tensor(path.parent / row['file'], process).unsqueeze(0).numpy()
        logits = runner.run(None, {'pixel_values': image})[0][0]
        probs = np.exp(logits - logits.max()); probs /= probs.sum()
        order = np.argsort(probs)[::-1]; top, second = map(int, order[:2])
        score, margin = float(probs[top]), float(probs[top] - probs[second])
        # Provisional settings, never deployed automatically or claimed calibrated.
        accepted = allow_confirm and score >= minimum and margin >= margin_limit
        results.append({'id': row['id'], 'status': 'identified' if accepted else 'uncertain', 'speciesId': LABELS[top],
            'elapsedMs': (time.perf_counter() - started) * 1000, 'score': score, 'margin': margin,
            'candidates': [{'speciesId': LABELS[int(i)], 'score': float(probs[int(i)])} for i in order[:3]]})
    write_json(args.out, {'version': 1, 'model': model_id, 'split': args.split, 'prepareMs': prepare,
        'externalTest': bool(reference), 'evaluationDatasetSignature': dataset_signature(path, rows),
        'thresholds': {'minimum': minimum, 'margin': margin_limit, 'validationPolicyApplied': allow_confirm, 'productionApproved': False},
        'environment': {'runtime': 'Python ONNX Runtime CPU; NOT iPhone/browser'}, 'results': results})


def main():
    parser = argparse.ArgumentParser(); commands = parser.add_subparsers(dest='command', required=True)
    p = commands.add_parser('train'); p.add_argument('--dataset', required=True); p.add_argument('--out', required=True)
    p.add_argument('--model', choices=MODELS, default='small'); p.add_argument('--epochs', type=int, default=10)
    p.add_argument('--warmup-epochs', type=int, default=2); p.add_argument('--batch-size', type=int, default=16)
    p.add_argument('--seed', type=int, default=42); p.add_argument('--device', choices=['auto', 'cpu', 'mps'], default='auto')
    p = commands.add_parser('export'); p.add_argument('--run', required=True); p.add_argument('--quantize', action='store_true')
    p.add_argument('--dataset'); p.add_argument('--calibration-limit', type=int, default=128)
    p = commands.add_parser('smoke'); p.add_argument('--out', required=True); p.add_argument('--model', choices=MODELS, default='small')
    p = commands.add_parser('predict'); p.add_argument('--dataset', required=True); p.add_argument('--model-file', required=True)
    p.add_argument('--out', required=True); p.add_argument('--split', choices=['validation', 'test'], default='test')
    p.add_argument('--policy', help='Optional validation policy bound to this exact model hash')
    p.add_argument('--reference-dataset', help='Original frozen dataset, required to verify disjoint external test photos')
    args = parser.parse_args()
    try: globals()[args.command](args)
    except (ValueError, FileExistsError) as error: parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
