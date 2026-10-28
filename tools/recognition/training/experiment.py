"""Serial, bounded candidate comparison. Uses validation only; never deploys."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from pipeline import ROOT, MODELS, LABELS, dataset, dataset_signature, require_classes, write_json
from selection import fit

HERE = Path(__file__).resolve().parent


def validate_config(config):
    if config.get('version') != 1 or not isinstance(config.get('seed'), int):
        raise ValueError('Expected version 1 and integer seed')
    if not isinstance(config.get('batchSize'), int) or not 2 <= config['batchSize'] <= 64:
        raise ValueError('batchSize must be 2..64')
    candidates = config.get('candidates', [])
    if not 1 <= len(candidates) <= 8:
        raise ValueError('Use 1..8 explicit candidates')
    ids = set()
    for c in candidates:
        if not re.fullmatch(r'[a-z0-9-]{1,60}', c['id']) or c['id'] in ids or c['model'] not in MODELS:
            raise ValueError('Invalid candidate ID/model')
        ids.add(c['id'])
        if not isinstance(c['epochs'], int) or not 1 <= c['epochs'] <= 200 or not isinstance(c['warmupEpochs'], int) or not 0 <= c['warmupEpochs'] <= c['epochs']:
            raise ValueError('Invalid epoch configuration')
    limits = config['limits']
    if not 0 < limits['downloadMB'] <= 100 or not 0 < limits['webkitP95Ms'] <= 10000 or not 0 <= limits['validationMacroRecall'] <= 1:
        raise ValueError('Invalid comparison budgets')
    return config


def metrics(rows, predictions):
    labels = {r['id']: r['speciesId'] for r in rows if r['split'] == 'validation' and r['speciesId'] in LABELS}
    counts = {label: [0, 0] for label in LABELS}
    for r in predictions['results']:
        if r['id'] in labels:
            expected = labels[r['id']]
            counts[expected][1] += 1
            counts[expected][0] += int(r['speciesId'] == expected)
    return {'correct': sum(c[0] for c in counts.values()), 'total': len(labels),
        'macroRecall': sum(a / b for a, b in counts.values()) / len(LABELS),
        'perSpecies': {k: {'correct': a, 'total': b} for k, (a, b) in counts.items()}}


def pareto(candidates):
    # Keep speed/size/accuracy tradeoffs visible instead of hiding them in one score.
    def dominates(a, b):
        x = [a['bytes'], a['p95Ms'], -a['validation']['macroRecall']]
        y = [b['bytes'], b['p95Ms'], -b['validation']['macroRecall']]
        return all(i <= j for i, j in zip(x, y)) and any(i < j for i, j in zip(x, y))
    return [b['id'] for b in candidates if not any(dominates(a, b) for a in candidates)]


def commands(candidate, config, data, out):
    py = sys.executable
    run = out / candidate['id']
    model = run / 'export/model.weight-int8.onnx'
    return [
        [py, str(HERE/'pipeline.py'), 'train', '--dataset', str(data), '--out', str(run), '--model', candidate['model'], '--epochs', str(candidate['epochs']), '--warmup-epochs', str(candidate['warmupEpochs']), '--batch-size', str(config['batchSize']), '--seed', str(config['seed'])],
        [py, str(HERE/'pipeline.py'), 'export', '--run', str(run), '--quantize', '--dataset', str(data)],
        [py, str(HERE/'weight_only.py'), str(run/'export/model.fp32.onnx'), str(model)],
        [py, str(HERE/'pipeline.py'), 'predict', '--dataset', str(data), '--model-file', str(model), '--split', 'validation', '--out', str(run/'validation.json')],
        ['node', str(HERE/'browser-benchmark.mjs'), str(run/'export'), str(run/'webkit.json'), 'webkit'],
    ]


def run_experiment(data, config_path, out, execute=False):
    path, rows = dataset(data)
    for split in ['train', 'validation', 'test']:
        require_classes(rows, split)
    for split in ['validation', 'test']:
        if not any(r['split'] == split and r['speciesId'] == 'unknown' for r in rows):
            raise ValueError(f'{split} requires unknown photos')
    config = validate_config(json.loads(Path(config_path).read_text()))
    signature = dataset_signature(path, rows)
    out = Path(out).resolve()
    if out.exists():
        raise FileExistsError('Choose a new run folder. Completed and partial runs are preserved.')
    plan = {'kind': 'validation-only-experiment', 'config': config, 'datasetSignature': signature,
        'commands': [commands(c, config, path, out) for c in config['candidates']],
        'testUsedForSelection': False, 'autoDeploy': False}
    if not execute:
        return plan
    out.mkdir(parents=True)
    write_json(out/'plan.json', plan)
    results = []
    try:
        for c, steps in zip(config['candidates'], plan['commands']):
            for index, command in enumerate(steps):
                print(f"{c['id']}: step {index + 1}/{len(steps)}", flush=True)
                with (out/f"{c['id']}-{index+1}.log").open('x') as log:
                    subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
            run = out/c['id']
            predictions = json.loads((run/'validation.json').read_text())
            policy = fit(rows, predictions)
            write_json(run/'policy.json', policy)
            benchmark = json.loads((run/'webkit.json').read_text())
            artifact = next(a for a in benchmark['artifacts'] if a['name'] == 'model.weight-int8.onnx')
            score = metrics(rows, predictions)
            limits = config['limits']
            results.append({'id': c['id'], 'modelSha256': predictions['model'], 'bytes': artifact['bytes'],
                'p95Ms': artifact['warmP95Ms'], 'validation': score,
                'withinBudgets': artifact['bytes'] <= limits['downloadMB'] * 1e6 and artifact['warmP95Ms'] <= limits['webkitP95Ms'] and score['macroRecall'] >= limits['validationMacroRecall'],
                'validationPolicyEnabled': policy['acceptanceEnabled'], 'productionApproved': False})
        if dataset_signature(path, rows) != signature:
            raise ValueError('Dataset changed during experiment; results cannot be accepted')
        report = {'config': config, 'datasetSignature': signature, 'candidates': results,
            'paretoCandidateIds': pareto(results), 'independentTestRequired': True,
            'physicalIPhoneRequired': True, 'productionApproved': False,
            'note': 'Validation used for selection; timings exclude preprocessing. Budgets are planning targets, not evidence of deployment accuracy.'}
        write_json(out/'comparison.json', report)
        lines = ['# モデル候補の比較（選定用・公開承認ではありません）', '', '| 候補 | MB | WebKit p95 ms | 検証macro recall | 仮予算内 |', '|---|---:|---:|---:|---|']
        for r in results:
            lines.append(f"| {r['id']} | {r['bytes']/1e6:.2f} | {r['p95Ms']} | {r['validation']['macroRecall']:.3f} | {r['withinBudgets']} |")
        lines += ['', '新しい独立評価・iPhoneでの速度/メモリ/カメラ入力確認後に採用判断。自動公開しません。']
        (out/'comparison.md').write_text('\n'.join(lines)+'\n')
        return report
    except Exception as error:
        write_json(out/'failure.json', {'error': str(error), 'completedCandidates': results, 'productionApproved': False})
        raise


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dataset', required=True)
    p.add_argument('--config', default=str(HERE/'zoo_experiment.json'))
    p.add_argument('--out', required=True)
    p.add_argument('--execute', action='store_true', help='Run training; otherwise inspect plan without downloading weights')
    a = p.parse_args()
    print(json.dumps(run_experiment(a.dataset, a.config, a.out, a.execute), ensure_ascii=False, indent=2))


if __name__ == '__main__': main()
