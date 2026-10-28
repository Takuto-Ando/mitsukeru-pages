"""Local zoo-photo intake. Original photos are never modified or uploaded."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from collections import Counter
from pipeline import LABELS, dataset, write_json
from prepare_dataset import assign_splits

FIELDS = ['file', 'speciesId', 'individualId', 'sessionId', 'usagePermission', 'reviewStatus']
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def local_file(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f'Photo outside input folder or missing: {relative}')
    return path


def inventory(root, output):
    root = Path(root).resolve()
    rows, unsupported = [], []
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        local_file(root, relative)
        if path.suffix.lower() not in EXTENSIONS:
            unsupported.append(relative)
            continue
        label = path.relative_to(root).parts[0]
        rows.append(dict(zip(FIELDS, [relative, label if label in LABELS + ['unknown'] else '', '', '', '', 'pending'])))
    with Path(output).open('x', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader(); writer.writerows(rows)
    return {'photos': len(rows), 'unsupported': unsupported, 'approvedAutomatically': False}


def reviewed_rows(root, review):
    root = Path(root).resolve()
    with Path(review).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != FIELDS:
            raise ValueError(f'Expected CSV columns: {FIELDS}')
        rows = [{key: value.strip() if value else '' for key, value in row.items()} for row in reader]
    selected, hashes, files = [], set(), set()
    for row in rows:
        if row.get('reviewStatus') not in ['pending', 'approved', 'rejected']:
            raise ValueError('reviewStatus must be pending, approved or rejected')
        if row['reviewStatus'] != 'approved':
            continue
        if row['speciesId'] not in LABELS + ['unknown'] or not row['sessionId'] or not row['usagePermission']:
            raise ValueError(f"Label, sessionId and permission required: {row['file']}")
        if row['speciesId'] != 'unknown' and not row['individualId']:
            raise ValueError(f"individualId (or shared herd ID) required: {row['file']}")
        path = local_file(root, row['file'])
        if path.suffix.lower() not in EXTENSIONS:
            raise ValueError(f'Convert unsupported image to JPEG/PNG/WebP first: {path.name}')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes or path in files:
            raise ValueError(f"Duplicate photo: {row['file']}; mark one rejected")
        hashes.add(digest); files.add(path)
        selected.append({**row, 'sourceSha256': digest, 'id': 'zoo-' + digest[:24]})
    if not selected:
        raise ValueError('No approved photos; review the CSV first')
    # Connect both individual and session: photos from either must remain together.
    parent = {}
    def find(key):
        parent.setdefault(key, key)
        while parent[key] != key:
            parent[key] = parent[parent[key]]
            key = parent[key]
        return key
    for row in selected:
        session = 'session:' + row['sessionId']
        find(session)
        if row['individualId']:
            individual = 'individual:' + row['speciesId'] + ':' + row['individualId']
            parent[find(individual)] = find(session)
    for row in selected:
        key = find('session:' + row['sessionId'])
        row['captureGroup'] = 'zoo-group-' + hashlib.sha256(key.encode()).hexdigest()[:24]
    return selected


def check(root, review):
    rows = reviewed_rows(root, review)
    counts = {label: {'photos': sum(r['speciesId'] == label for r in rows),
        'independentGroups': len({r['captureGroup'] for r in rows if r['speciesId'] == label})}
        for label in LABELS + ['unknown']}
    missing = [label for label, count in counts.items()
        if count['independentGroups'] < (2 if label == 'unknown' else 3)]
    return {'counts': counts, 'insufficientGroups': missing,
        'readyForSplitAttempt': not missing,
        'note': 'Minimum coverage only; successful grouping and useful accuracy are not guaranteed.'}


def prepare(root, review, output, seed=42):
    from PIL import Image, ImageOps
    root, output = Path(root).resolve(), Path(output)
    if output.exists():
        raise FileExistsError('Use a new output folder; frozen datasets are never overwritten')
    rows = reviewed_rows(root, review)
    mapping = assign_splits(rows, seed)
    # Decode and check duplicate pixels before writing anything. EXIF is removed on export.
    pixel_hashes = set()
    for row in rows:
        with Image.open(local_file(root, row['file'])) as image:
            if getattr(image, 'n_frames', 1) != 1:
                raise ValueError('Animated images are not supported')
            rgb = ImageOps.exif_transpose(image).convert('RGB')
            if min(rgb.size) < 224:
                raise ValueError(f"Photo too small (<224 px): {row['file']}")
            digest = hashlib.sha256(str(rgb.size).encode() + rgb.tobytes()).hexdigest()
            if digest in pixel_hashes:
                raise ValueError('Duplicate decoded pixels; remove metadata-only photo duplicates')
            pixel_hashes.add(digest)
    output.mkdir(parents=True)
    (output / 'photos').mkdir()
    samples = []
    for row in rows:
        name = f"photos/{row['id']}.jpg"
        with Image.open(local_file(root, row['file'])) as image:
            rgb = ImageOps.exif_transpose(image).convert('RGB')
            rgb.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            # Fresh image avoids carrying EXIF, GPS, comments or embedded camera metadata.
            clean = Image.new('RGB', rgb.size); clean.paste(rgb)
            clean.save(output / name, quality=95)
        samples.append({key: value for key, value in {**row, 'file': name,
            'split': mapping[row['captureGroup']], 'sourceFile': row['file']}.items()})
    write_json(output / 'dataset.json', {'version': 1, 'scope': 'Reviewed local zoo photos; no deployment accuracy claim', 'samples': samples})
    dataset(output / 'dataset.json')
    summary = {'seed': seed, 'photos': len(samples), 'groups': len(set(mapping)),
        'counts': {split: dict(Counter(r['speciesId'] for r in samples if r['split'] == split)) for split in ['train', 'validation', 'test']},
        'exifRemoved': True, 'originalsModified': False, 'uploaded': False, 'reviewSha256': hashlib.sha256(Path(review).read_bytes()).hexdigest()}
    write_json(output / 'intake-summary.json', summary)
    return summary


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ['inventory', 'check', 'prepare']:
        p = sub.add_parser(name); p.add_argument('--photos', required=True)
        if name != 'check': p.add_argument('--out', required=True)
        if name != 'inventory': p.add_argument('--review', required=True)
        if name == 'prepare': p.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    if args.command == 'inventory': result = inventory(args.photos, args.out)
    elif args.command == 'check': result = check(args.photos, args.review)
    else: result = prepare(args.photos, args.review, args.out, args.seed)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__': main()
