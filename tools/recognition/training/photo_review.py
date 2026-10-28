"""Local contact sheets and attribution links. Does not approve or split photos."""
import argparse
from collections import Counter, defaultdict
from html import escape
import json
from pathlib import Path


def main():
    from PIL import Image, ImageDraw, ImageOps
    parser = argparse.ArgumentParser()
    parser.add_argument('queue')
    args = parser.parse_args()
    queue = Path(args.queue).resolve()
    report = json.loads(queue.read_text())
    if report.get('kind') != 'unreviewed-open-license-photo-candidates':
        raise ValueError('Expected a candidate review queue')
    root = queue.parent
    output = root / 'review'
    output.mkdir(exist_ok=False)
    groups = defaultdict(list)
    for row in report['photos']:
        source = (root / row['file']).resolve()
        if not source.is_relative_to(root):
            raise ValueError('Photo path escapes queue folder')
        groups[row['speciesId']].append((row, source))
    html = ['<!doctype html><meta charset="utf-8"><title>写真候補の確認</title>',
            '<h1>写真候補の確認</h1><p>検索結果は未確認です。動物、実写、重複、撮影グループ、利用条件を確認してください。</p>']
    counts = {}
    for label, entries in sorted(groups.items()):
        counts[label] = len(entries)
        sheet = Image.new('RGB', (1000, ((len(entries) + 3) // 4) * 220), 'white')
        draw = ImageDraw.Draw(sheet)
        html.append(f'<h2>{escape(label)}</h2><img width="900" src="{escape(label)}.jpg"><ol>')
        for i, (row, source) in enumerate(entries):
            with Image.open(source) as image:
                thumb = ImageOps.contain(ImageOps.exif_transpose(image).convert('RGB'), (244, 185))
            x, y = (i % 4) * 250, (i // 4) * 220
            sheet.paste(thumb, (x, y))
            draw.text((x + 3, y + 188), f'{i+1}: {row["id"]}', fill='black')
            html.append(f'<li>{escape(row["id"])} — {escape(row["author"])} — {escape(row["license"])} '
                        f'<a href="{escape(row["sourcePage"], quote=True)}">出典・利用条件</a></li>')
        sheet.save(output / f'{label}.jpg', quality=90)
        html.append('</ol>')
    (output / 'index.html').write_text('\n'.join(html))
    summary = {'counts': counts, 'total': sum(counts.values()),
               'authors': len(Counter(row['captureGroup'] for row in report['photos'])),
               'reviewed': False, 'readyForTraining': False}
    (output / 'summary.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
