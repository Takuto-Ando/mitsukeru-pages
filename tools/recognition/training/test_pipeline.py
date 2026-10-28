import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from selection import fit, wilson
from pipeline import LABELS, ROOT, dataset_signature, verify_external_test


class PolicyTests(unittest.TestCase):
    def data(self, repeats=6, unknown=100):
        rows = [{'id': f'{label}-{i}', 'speciesId': label, 'split': 'validation'} for label in LABELS for i in range(repeats)]
        rows += [{'id': f'unknown-{i}', 'speciesId': 'unknown', 'split': 'validation'} for i in range(unknown)]
        outputs = [{'id': r['id'], 'speciesId': r['speciesId'] if r['speciesId'] != 'unknown' else 'goat', 'score': .99 if r['speciesId'] != 'unknown' else .4, 'margin': .8 if r['speciesId'] != 'unknown' else .1} for r in rows]
        return rows, {'model': 'fixture-not-an-animal-model', 'split': 'validation', 'results': outputs}

    def test_small_perfect_sample_is_not_strong_evidence(self):
        self.assertLess(wilson(2, 2)[0], .95)
        rows, predictions = self.data(repeats=1, unknown=1)
        self.assertFalse(fit(rows, predictions)['acceptanceEnabled'])

    def test_knowns_and_unknowns_both_required(self):
        rows, predictions = self.data(unknown=0)
        self.assertFalse(fit(rows, predictions)['acceptanceEnabled'])

    def test_select_rejection_policy_without_test_leakage(self):
        rows, predictions = self.data()
        report = fit(rows + [{'id':'held-out','speciesId':'goat','split':'test'}], predictions)
        self.assertTrue(report['acceptanceEnabled'])
        self.assertGreater(report['minimum'], .4)
        self.assertTrue(report['independentTestRequired'])
        self.assertFalse(report['testUsedForFitting'])
        self.assertGreaterEqual(report['precisionWilsonLower95'], .95)
        self.assertLessEqual(report['unknownAcceptWilsonUpper95'], .05)

    def test_wrong_confident_unknowns_disable_automatic_acceptance(self):
        rows, predictions = self.data()
        for row in predictions['results']: row.update(score=.99, margin=.8)
        self.assertFalse(fit(rows, predictions)['acceptanceEnabled'])

    def test_wrong_splits_missing_and_non_finite_results_rejected(self):
        rows, predictions = self.data()
        predictions['split'] = 'test'
        with self.assertRaises(ValueError): fit(rows, predictions)
        predictions['split'] = 'validation'; predictions['results'][0]['score'] = float('nan')
        with self.assertRaises(ValueError): fit(rows, predictions)
        predictions['results'].pop()
        with self.assertRaises(ValueError): fit(rows, predictions)

    def test_empty_training_data_stops_before_download_or_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'dataset.json'; path.write_text(json.dumps({'version':1,'samples':[]}))
            out = Path(directory) / 'output'
            run = subprocess.run([sys.executable, str(ROOT/'tools/recognition/training/pipeline.py'), 'train', '--dataset', str(path), '--out', str(out)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 1)
            self.assertIn('train images missing', run.stderr)
            self.assertFalse(out.exists())


class ExternalTestDataTests(unittest.TestCase):
    def test_requires_fresh_photos_authors_groups_and_frozen_reference(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old_path = root / 'old.json'; old_path.write_text('{}')
            new_path = root / 'new.json'; new_path.write_text('{}')
            (root / 'old.jpg').write_bytes(b'old fixture')
            (root / 'new.jpg').write_bytes(b'new fixture')
            old = [{'id':'old','file':'old.jpg','captureGroup':'old','author':'original','split':'train'}]
            new = [{'id':'new','file':'new.jpg','captureGroup':'new','author':'different','split':'test'}]
            meta = {'datasetSignature': dataset_signature(old_path, old)}
            with patch('pipeline.dataset', return_value=(old_path, old)):
                verify_external_test(new_path, new, old_path, meta)
                (root / 'new.jpg').write_bytes(b'old fixture')
                with self.assertRaisesRegex(ValueError, 'duplicate'):
                    verify_external_test(new_path, new, old_path, meta)
                (root / 'new.jpg').write_bytes(b'new fixture')
                new[0]['author'] = 'original'
                with self.assertRaisesRegex(ValueError, 'overlaps'):
                    verify_external_test(new_path, new, old_path, meta)
                new[0]['author'] = 'different'; new[0]['split'] = 'validation'
                with self.assertRaisesRegex(ValueError, 'test rows only'):
                    verify_external_test(new_path, new, old_path, meta)
                new[0]['split'] = 'test'; (root / 'old.jpg').write_bytes(b'changed fixture')
                with self.assertRaisesRegex(ValueError, 'Reference dataset'):
                    verify_external_test(new_path, new, old_path, meta)


if __name__ == '__main__': unittest.main()
