"""Build a small pilot dataset from explicit review decisions; no inferred approval."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import random
import shutil
from pipeline import LABELS, dataset, write_json


def assign_splits(rows, seed=42):
    groups = sorted({r['captureGroup'] for r in rows})
    for label in LABELS:
        if len({r['captureGroup'] for r in rows if r['speciesId'] == label}) < 3:
            raise ValueError(f'{label}: at least three independent groups are required')
    totals = Counter(r['speciesId'] for r in rows)
    rng = random.Random(seed)
    def score(mapping):
        counts = Counter((r['speciesId'], mapping[r['captureGroup']]) for r in rows)
        cost = 0
        for label, total in totals.items():
            ratios = [0, .5, .5] if label == 'unknown' else [.6, .2, .2]
            for split, ratio in zip(['train', 'validation', 'test'], ratios):
                n = counts[label, split]
                if ratio and not n:
                    cost += 10000
                cost += ((n - total * ratio) / max(1, total * ratio)) ** 2
        return cost
    best = None
    # Search only label/group counts, never model predictions or image features.
    for _ in range(12000):
        mapping = dict(zip(groups, rng.choices(['train', 'validation', 'test'], [.6, .2, .2], k=len(groups))))
        cost = score(mapping)
        if best is None or cost < best[0]:
            best = cost, mapping
    mapping = best[1]
    # Repair sparse classes and improve balance without moving individual photos.
    for _ in range(10):
        improved = False
        for group in groups:
            original = mapping[group]
            current_cost = score(mapping)
            chosen = original
            for split in ['train', 'validation', 'test']:
                mapping[group] = split
                candidate_cost = score(mapping)
                if candidate_cost < current_cost:
                    current_cost, chosen = candidate_cost, split
            mapping[group] = chosen
            improved |= chosen != original
        if not improved:
            break
    for label in LABELS + ['unknown']:
        required = ['validation', 'test'] if label == 'unknown' else ['train', 'validation', 'test']
        for split in required:
            if not any(r['speciesId'] == label and mapping[r['captureGroup']] == split for r in rows):
                raise ValueError('No complete split found; inspect group constraints or collect independent photos')
    return mapping


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--queue', required=True)
    parser.add_argument('--decisions', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--test-only', action='store_true', help='Keep all approved photos for a new external test')
    args = parser.parse_args()
    queue = Path(args.queue).resolve()
    data = json.loads(queue.read_text())
    decisions = json.loads(Path(args.decisions).read_text())
    if decisions.get('kind') != 'explicit-photo-review' or not decisions.get('reviewNote'):
        raise ValueError('Explicit review decisions and a review note are required')
    photos = {row['id']: row for row in data['photos']}
    selected = []
    hashes = set()
    for decision in decisions['approved']:
        row = photos[decision['id']]
        if row.get('reviewStatus') == 'rejected':
            raise ValueError(f'Cannot approve an excluded photo: {row["id"]}')
        path = (queue.parent / row['file']).resolve()
        if not path.is_relative_to(queue.parent):
            raise ValueError('Photo escapes queue folder')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != row['downloadSha256'] or digest in hashes:
            raise ValueError('Photo changed or duplicated')
        hashes.add(digest)
        selected.append({**row, 'reviewStatus': 'approved', 'reviewNote': decisions['reviewNote']})
    # Additional suspected same-individual/scene links merge entire author groups.
    parent = {row['captureGroup']: row['captureGroup'] for row in selected}
    def find(group):
        while parent[group] != group:
            group = parent[group]
        return group
    for link in decisions.get('linkedGroups', []):
        groups = [photos[id]['captureGroup'] for id in link]
        for group in groups[1:]:
            parent[find(group)] = find(groups[0])
    for row in selected:
        row['captureGroup'] = find(row['captureGroup'])
    if not selected:
        raise ValueError('No explicitly approved photos')
    mapping = {row['captureGroup']: 'test' for row in selected} if args.test_only else assign_splits(selected)
    root = Path(args.out)
    root.mkdir(parents=True, exist_ok=False)
    (root / 'photos').mkdir()
    for row in selected:
        shutil.copyfile(queue.parent / row['file'], root / row['file'])
        row['split'] = mapping[row['captureGroup']]
        row['splitAssigned'] = True
        row['usagePermission'] = f'{row["license"]}; {row["licenseUrl"]}; credit: {row["author"]}; source: {row["sourcePage"]}'
    write_json(root / 'dataset.json', {'version': 1, 'scope': 'Small internet-photo pilot; not zoo deployment validation', 'samples': selected})
    write_json(root / 'review-decisions.json', decisions)
    (root / 'ATTRIBUTIONS.md').write_text('\n'.join(f'- {row["id"]}: {row["usagePermission"]}' for row in selected) + '\n')
    dataset(root / 'dataset.json')
    counts = {split: dict(Counter(r['speciesId'] for r in selected if r['split'] == split)) for split in ['train', 'validation', 'test']}
    write_json(root / 'split-summary.json', {'seed': 42, 'testOnly': args.test_only, 'counts': counts, 'groups': len(set(mapping)), 'modelResultsUsedToSplit': False})
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
