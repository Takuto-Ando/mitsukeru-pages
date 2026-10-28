"""Validation-only policy fitting. Policies remain candidates until held-out tests."""
import argparse
import json
import math
from pathlib import Path
from pipeline import dataset, LABELS, write_json


def wilson(successes, total):
    if total == 0: return (0., 1.)
    z = 1.959963984540054
    p = successes / total
    center = (p + z*z/(2*total)) / (1 + z*z/total)
    half = z * math.sqrt(p*(1-p)/total + z*z/(4*total*total)) / (1 + z*z/total)
    return max(0., center-half), min(1., center+half)


def fit(rows, predictions, minimum_precision=.95, maximum_unknown_accept=.05):
    validation = [r for r in rows if r['split'] == 'validation']
    expected = {r['id']: r for r in validation}
    if predictions.get('split') != 'validation' or not predictions.get('model'):
        raise ValueError('Only explicitly marked validation predictions may fit a policy')
    outputs = predictions.get('results', [])
    if len(outputs) != len(expected) or {r['id'] for r in outputs} != set(expected):
        raise ValueError('Validation predictions are missing, duplicated or include other splits')
    for row in outputs:
        if row.get('speciesId') not in LABELS or any(not isinstance(row.get(key), (float, int)) or not math.isfinite(row[key]) or not 0 <= row[key] <= 1 for key in ['score', 'margin']):
            raise ValueError('Policy fitting requires finite candidate scores for every validation image')
    known = sum(r['speciesId'] != 'unknown' for r in validation)
    unknown = len(validation)-known
    supports = {label: sum(r['speciesId'] == label for r in validation) for label in LABELS}
    base = {'version': 1, 'kind': 'provisional-validation-policy', 'modelSha256': predictions['model'],
        'acceptanceEnabled': False, 'validationImages': len(validation), 'unknownImages': unknown,
        'supports': supports, 'testUsedForFitting': False, 'independentTestRequired': True,
        'goals': {'precisionWilsonLower95': minimum_precision, 'unknownAcceptWilsonUpper95': maximum_unknown_accept}}
    if unknown == 0 or any(n == 0 for n in supports.values()):
        return {**base, 'reason': 'Missing validation species or unknown images; keep manual confirmation'}
    policies = []
    for minimum in [.3, .4, .5, .6, .7, .75, .8, .85, .9, .95, .98, .99]:
        for margin in [0., .05, .1, .15, .2, .3, .4]:
            accepted = [r for r in outputs if r['score'] >= minimum and r['margin'] >= margin]
            correct = sum(r['speciesId'] == expected[r['id']]['speciesId'] for r in accepted)
            false_unknown = sum(expected[r['id']]['speciesId'] == 'unknown' for r in accepted)
            lower = wilson(correct, len(accepted))[0]
            upper = wilson(false_unknown, unknown)[1]
            if lower >= minimum_precision and upper <= maximum_unknown_accept:
                policies.append({'minimum': minimum, 'margin': margin, 'correct': correct, 'accepted': len(accepted),
                    'knownAutoRecall': correct/known, 'precisionWilsonLower95': lower, 'unknownAcceptWilsonUpper95': upper})
    if not policies:
        return {**base, 'reason': 'No threshold meets validation evidence goals; keep manual confirmation'}
    chosen = max(policies, key=lambda p:(p['knownAutoRecall'], p['precisionWilsonLower95'], p['minimum'], p['margin']))
    return {**base, **chosen, 'acceptanceEnabled': True,
        'reason': 'Validation selection only. Repeated threshold search does not prove deployment accuracy.'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', required=True); parser.add_argument('--predictions', required=True); parser.add_argument('--out', required=True)
    args = parser.parse_args()
    _, rows = dataset(args.dataset)
    report = fit(rows, json.loads(Path(args.predictions).read_text()))
    write_json(args.out, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__': main()
