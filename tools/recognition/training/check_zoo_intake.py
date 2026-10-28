"""Real Pillow + Node intake integration using synthetic images, not animal accuracy."""
import csv
import hashlib
from pathlib import Path
import tempfile
from PIL import Image, ImageOps
from pipeline import LABELS, dataset
from zoo_dataset import FIELDS, prepare


def main():
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory); source=root/'source';source.mkdir();rows=[];hashes={}
        for index,label in enumerate(LABELS+['unknown']):
            for group in range(3):
                name=f'{label}-{group}.jpg';path=source/name
                image=Image.new('RGB',(240,300),(index*10,group*70,20))
                exif=Image.Exif();exif[274]=6;exif[270]='Private camera comment'
                image.save(path,exif=exif)
                hashes[name]=hashlib.sha256(path.read_bytes()).hexdigest()
                rows.append(dict(zip(FIELDS,[name,label,f'{label}-{group}',f'session-{label}-{group}','Synthetic test fixture','approved'])))
        review=root/'review.csv'
        with review.open('w',newline='') as f:
            w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
        output=root/'prepared';summary=prepare(source,review,output)
        assert summary['photos']==57
        _,samples=dataset(output/'dataset.json')
        for row in samples:
            with Image.open(output/row['file']) as image:
                assert image.size==(300,240), 'EXIF orientation not applied'
                assert not image.getexif(), 'EXIF carried into prepared copy'
        for name,digest in hashes.items():
            assert hashlib.sha256((source/name).read_bytes()).hexdigest()==digest
        assert all(summary['counts'][split].get(label,0) for split in ['train','validation','test'] for label in LABELS)
        try:
            prepare(source,review,output)
            raise AssertionError('Existing output overwritten')
        except FileExistsError:pass
        # Same decoded pixels with different metadata/bytes must also be rejected.
        with Image.open(source/rows[0]['file']) as image:
            ImageOps.exif_transpose(image).save(source/'duplicate.png')
        rows.append({**rows[0],'file':'duplicate.png'})
        with review.open('w',newline='') as f:
            w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
        try:
            prepare(source,review,root/'duplicate-output')
            raise AssertionError('Duplicate pixels accepted')
        except ValueError as error:
            assert 'Duplicate decoded pixels' in str(error)
        assert not (root/'duplicate-output').exists()
    print('PASS: 57 synthetic photos; grouped split, EXIF orientation/removal, unchanged originals, overwrite and pixel-duplicate rejection')


if __name__=='__main__':main()
