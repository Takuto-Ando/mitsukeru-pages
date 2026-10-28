"""Optional real-library integration with synthetic pictures; NO animal accuracy claim."""
import argparse
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import numpy as np
from PIL import Image
import timm
import pipeline
from selection import fit


def main():
    with tempfile.TemporaryDirectory(prefix='zooketch-synthetic-pipeline-') as directory:
        root = Path(directory); rows = []; rng = np.random.default_rng(3)
        for split in ['train', 'validation', 'test']:
            for species in pipeline.LABELS:
                name = f'{split}-{species}'
                Image.fromarray(rng.integers(0, 256, size=(240, 270, 3), dtype=np.uint8)).save(root / f'{name}.png')
                rows.append({'id': name, 'file': f'{name}.png', 'speciesId': species, 'split': split,
                    'captureGroup': name, 'usagePermission': 'Synthetic software test fixture only; NOT an animal photograph'})
        path = root / 'dataset.json'; path.write_text(json.dumps({'version':1, 'samples':rows}))
        run = root / 'run'
        create = timm.create_model
        def without_download(name, **kwargs):
            kwargs['pretrained'] = False
            return create(name, **kwargs)
        # No ImageNet or zoo photos are downloaded in this software test.
        with patch('timm.create_model', side_effect=without_download):
            pipeline.train(argparse.Namespace(dataset=str(path), out=str(run), epochs=1, warmup_epochs=1,
                batch_size=2, seed=3, device='cpu', model='small'))
        assert json.loads((run / 'metadata.json').read_text())['trainingCompleted']
        pipeline.export(argparse.Namespace(run=str(run), quantize=True, dataset=str(path), calibration_limit=18))
        from weight_only import convert
        weight_model = run / 'export/model.weight-int8.onnx'
        conversion = convert(run / 'export/model.fp32.onnx', weight_model)
        assert conversion['outputBytes'] < conversion['sourceBytes']
        tensor = np.random.default_rng(4).normal(size=(1, 3, 224, 224)).astype(np.float32)
        original = pipeline.session(run / 'export/model.fp32.onnx').run(None, {'pixel_values': tensor})[0]
        compressed = pipeline.session(weight_model).run(None, {'pixel_values': tensor})[0]
        np.testing.assert_allclose(original, compressed, atol=.03, rtol=.05)
        validation = run / 'validation.json'
        pipeline.predict(argparse.Namespace(dataset=str(path), model_file=str(run/'export/model.int8.onnx'),
            split='validation', policy=None, out=str(validation)))
        predictions = json.loads(validation.read_text())
        assert len(predictions['results']) == 18
        assert all(r['status'] == 'uncertain' for r in predictions['results'])
        policy = fit(rows, predictions)
        assert not policy['acceptanceEnabled']  # No unknown validation examples.
        calibration = json.loads((run/'export/calibration.json').read_text())
        assert calibration['split'] == 'train' and all(i.startswith('train-') for i in calibration['sampleIds'])
        # Once a photograph changes, the same run must refuse evaluation.
        Image.new('RGB', (240,270), (1,2,3)).save(root/'test-goat.png')
        try:
            pipeline.predict(argparse.Namespace(dataset=str(path), model_file=str(run/'export/model.int8.onnx'),
                split='test', policy=None, out=str(run/'test.json')))
        except ValueError as error:
            assert 'differ' in str(error)
        else: raise AssertionError('Changed data was accepted')
        print('PASS: synthetic train -> checkpoint -> FP32/INT8/weight-only -> validation candidates -> manual fallback -> changed-data rejection')
        print('Animal recognition accuracy was NOT evaluated. Temporary models removed.')


if __name__ == '__main__': main()
