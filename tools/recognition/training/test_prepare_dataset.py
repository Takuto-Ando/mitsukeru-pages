import unittest
from pipeline import LABELS
from prepare_dataset import assign_splits


class SplitTests(unittest.TestCase):
    def test_sparse_classes_keep_whole_groups_and_cover_every_split(self):
        rows = [{'speciesId': label, 'captureGroup': f'{label}-{i}'}
                for label in LABELS + ['unknown'] for i in range(3)]
        # A second photo from one shoot must stay with the same group.
        rows.append(dict(rows[0]))
        mapping = assign_splits(rows)
        for label in LABELS:
            self.assertEqual({mapping[r['captureGroup']] for r in rows if r['speciesId'] == label},
                             {'train', 'validation', 'test'})
        self.assertEqual(len(mapping), 3 * (len(LABELS) + 1))
        self.assertTrue({'validation', 'test'} <= {mapping[r['captureGroup']] for r in rows if r['speciesId'] == 'unknown'})

    def test_insufficient_independent_groups_are_rejected(self):
        rows = [{'speciesId': label, 'captureGroup': 'same-shoot'} for label in LABELS]
        with self.assertRaisesRegex(ValueError, 'independent groups'):
            assign_splits(rows)


if __name__ == '__main__':
    unittest.main()
