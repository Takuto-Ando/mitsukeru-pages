import csv
import json
from pathlib import Path
import tempfile
import unittest
from zoo_dataset import inventory, reviewed_rows, FIELDS
from experiment import validate_config, pareto, commands, HERE


class ZooWorkflowTests(unittest.TestCase):
    def write_review(self, root, rows):
        path = root/'review.csv'
        with path.open('w', newline='', encoding='utf-8-sig') as f:
            w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader(); w.writerows(rows)
        return path

    def row(self, file, individual='a', session='one', label='goat', status='approved'):
        return dict(zip(FIELDS, [file, label, individual, session, 'provided for local training', status]))

    def test_inventory_never_approves_or_changes_originals(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); (root/'goat').mkdir(); photo=root/'goat/a.jpg';photo.write_bytes(b'fixture')
            (root/'goat/b.heic').write_bytes(b'unsupported')
            output=root/'review.csv'; result=inventory(root,output)
            self.assertEqual(result['photos'],1);self.assertIn('goat/b.heic',result['unsupported'])
            self.assertEqual(photo.read_bytes(),b'fixture')
            self.assertIn('pending',output.read_text(encoding='utf-8-sig'))
            with self.assertRaisesRegex(ValueError,'No approved'): reviewed_rows(root,output)
            with self.assertRaises(FileExistsError): inventory(root,output)

    def test_individual_and_session_are_transitively_linked(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for i in range(4): (root/f'{i}.jpg').write_bytes(bytes([i]))
            rows=[self.row('0.jpg','a','one'),self.row('1.jpg','a','two'),self.row('2.jpg','b','two'),self.row('3.jpg','c','three')]
            selected=reviewed_rows(root,self.write_review(root,rows))
            self.assertEqual(len({r['captureGroup'] for r in selected[:3]}),1)
            self.assertNotEqual(selected[0]['captureGroup'],selected[3]['captureGroup'])

    def test_missing_permission_identity_duplicates_and_escape_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); (root/'a.jpg').write_bytes(b'fixture'); (root/'b.jpg').write_bytes(b'fixture')
            for key in ['individualId','sessionId','usagePermission','speciesId']:
                row=self.row('a.jpg');row[key]=''
                with self.assertRaises(ValueError): reviewed_rows(root,self.write_review(root,[row]))
            with self.assertRaisesRegex(ValueError,'Duplicate'): reviewed_rows(root,self.write_review(root,[self.row('a.jpg'),self.row('b.jpg')]))
            with self.assertRaisesRegex(ValueError,'outside'): reviewed_rows(root,self.write_review(root,[self.row('../missing.jpg')]))
            self.assertEqual(len(reviewed_rows(root,self.write_review(root,[self.row('a.jpg'),self.row('b.jpg',status='rejected')]))),1)

    def test_unknown_requires_session_but_not_individual(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'a.jpg').write_bytes(b'unknown')
            rows=reviewed_rows(root,self.write_review(root,[self.row('a.jpg',individual='',label='unknown')]))
            self.assertEqual(rows[0]['speciesId'],'unknown')

    def test_candidate_configuration_and_no_test_selection_commands(self):
        config=json.loads((HERE/'zoo_experiment.json').read_text());validate_config(config)
        for c in config['candidates']:
            steps=commands(c,config,Path('/fixture/data.json'),Path('/fixture/output'))
            prediction=steps[3]
            self.assertEqual(prediction[prediction.index('--split')+1],'validation')
        config['candidates'][0]['id']='../escape'
        with self.assertRaises(ValueError):validate_config(config)

    def test_pareto_preserves_accuracy_size_tradeoffs(self):
        def c(id,size,speed,accuracy):return {'id':id,'bytes':size,'p95Ms':speed,'validation':{'macroRecall':accuracy}}
        self.assertEqual(pareto([c('small',2,10,.7),c('accurate',4,20,.8),c('dominated',5,30,.6)]),['small','accurate'])


if __name__ == '__main__': unittest.main()
