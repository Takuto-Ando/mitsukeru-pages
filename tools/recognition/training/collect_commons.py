"""Download openly licensed photo CANDIDATES for review, never a ready training set."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request
import urllib.error

AGENT = 'ZooketchResearchPrototype/0.1 (https://github.com/Takuto-Ando/mitsukeru-pages)'
QUERIES = {
 'mandrill':'"Mandrillus sphinx"', 'gibbon':'"Hylobates lar"', 'lemur':'"Lemur catta"',
 'bush-dog':'"Speothos venaticus"', 'goat':'"Capra hircus"', 'sheep':'"Ovis aries"',
 'elephant':'"Elephas maximus"', 'capuchin':'"Sapajus apella" OR "Cebus apella"',
 'macaque':'"Macaca mulatta"', 'badger':'"Meles anakuma"',
 'zebra':'"Equus grevyi" OR "Equus quagga"', 'giraffe':'"Giraffa"',
 'hippo':'"Hippopotamus amphibius"', 'fennec':'"Vulpes zerda"', 'gorilla':'"Gorilla gorilla"',
 'donkey':'"Equus asinus"', 'meerkat':'"Suricata suricatta"', 'deer':'"Cervus nippon"',
 'unknown-tiger':'"Panthera tigris"', 'unknown-lion':'"Panthera leo"',
 'unknown-cat':'"Felis catus"', 'unknown-dog':'"Canis lupus familiaris"',
}
EXCLUDE = re.compile(r'\b(map|skull|skeleton|illustration|drawing|painting|sculpture|statue|taxidermy|engraving|diagram|stamp|distribution|fossil|anatomy|museum|iconographia|AI-generated)\b', re.I)
LICENSE = re.compile(r'^(CC0|Public domain|CC BY(?:-SA)? (?:1\.0|2\.0|2\.5|3\.0|4\.0))$',re.I)


def clean(html): return ' '.join(unescape(re.sub('<[^>]+>', ' ', str(html))).split())


def request(url):
    if urllib.parse.urlparse(url).hostname not in {'commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org'}:
        raise ValueError('Unexpected source host')
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':AGENT})
            with urllib.request.urlopen(req,timeout=40) as response:
                if response.length and response.length>5*1024*1024: raise ValueError('Image too large')
                data=response.read(5*1024*1024+1)
                if len(data)>5*1024*1024: raise ValueError('Response too large')
                return data
        except urllib.error.HTTPError as error:
            if error.code not in (429,503) or attempt==2: raise
            time.sleep(min(60,max(5,int(error.headers.get('Retry-After','10')))))


def search(key, query, maximum, exclude_ids=None, exclude_authors=None):
    params={'action':'query','format':'json','generator':'search','gsrnamespace':'6',
        'gsrsearch':f'{query} filetype:bitmap',
        'gsrlimit':'50','prop':'imageinfo','iiprop':'url|extmetadata|sha1|size|mime','iiurlwidth':'500'}
    data=json.loads(request('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)))
    if data.get('error'): raise ValueError(str(data['error']))
    result=[]
    for page in sorted(data.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',0)):
        info=page.get('imageinfo',[{}])[0]; meta=info.get('extmetadata',{})
        value=lambda name: clean(meta.get(name,{}).get('value',''))
        license=value('LicenseShortName'); author=value('Artist')
        if f'commons-{page["pageid"]}' in (exclude_ids or set()) or author in (exclude_authors or set()): continue
        title=page['title']; description=value('ImageDescription')
        if not LICENSE.fullmatch(license) or not author: continue
        if EXCLUDE.search(title+' '+description): continue
        if info.get('mime')!='image/jpeg' or min(info.get('width',0),info.get('height',0))<224: continue
        url=info.get('thumburl') or info.get('url')
        if not url: continue
        result.append({'id':f'commons-{page["pageid"]}', 'speciesId':'unknown' if key.startswith('unknown-') else key,
            'query':query,'title':title,'description':description,'author':author,'license':license,'licenseUrl':value('LicenseUrl'),
            'sourcePage':info.get('descriptionurl') or f'https://commons.wikimedia.org/?curid={page["pageid"]}',
            'originalSha1':info.get('sha1'), 'downloadUrl':url,
            'captureGroup':'commons-author-'+hashlib.sha256(author.encode()).hexdigest()[:16],
            'reviewStatus':'pending', 'splitAssigned':False})
        if len(result)>=maximum: break
    return result


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--out',required=True);parser.add_argument('--per-species',type=int,default=12)
    parser.add_argument('--exclude-dataset', help='Exclude photos and all authors from a previous dataset')
    parser.add_argument('--exclude-queue', help='Exclude IDs already found by an earlier candidate search')
    args=parser.parse_args()
    if not 1<=args.per_species<=30: parser.error('--per-species must be 1..30')
    excluded_ids=set();excluded_authors=set()
    if args.exclude_dataset:
        previous=json.loads(Path(args.exclude_dataset).read_text())['samples']
        excluded_ids.update(row['id'] for row in previous)
        excluded_authors.update(row['author'] for row in previous if row.get('author'))
    if args.exclude_queue:
        excluded_ids.update(row['id'] for row in json.loads(Path(args.exclude_queue).read_text())['photos'])
    root=Path(args.out);root.mkdir(parents=True,exist_ok=False);(root/'photos').mkdir()
    collected=[];errors=[];seen=set();originals=set()
    for key,query in QUERIES.items():
        try:
            found=search(key,query,min(args.per_species,5) if key.startswith('unknown-') else args.per_species,excluded_ids,excluded_authors)
            for row in found:
                if row['id'] in seen or row['originalSha1'] in originals: continue
                seen.add(row['id']);originals.add(row['originalSha1']);collected.append(row)
            print(f'{key}: {len(found)} licensed candidates',flush=True)
        except Exception as error:
            errors.append({'label':key,'error':str(error)[:240]});print(f'{key}: source unavailable',flush=True)
        time.sleep(.5)
    def download(row):
        from PIL import Image
        try:
            data=request(row['downloadUrl']); path=root/'photos'/f'{row["id"]}.jpg'
            path.write_bytes(data)
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                if min(image.size)<224: raise ValueError('Thumbnail too small')
                dimensions=list(image.size)
            return {**row,'file':str(path.relative_to(root)),'downloadSha256':hashlib.sha256(data).hexdigest(),'dimensions':dimensions}
        except Exception as error:
            return {'id':row['id'],'speciesId':row['speciesId'],'error':str(error)[:240]}
    photos=[];download_hashes=set()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for row in pool.map(download,collected):
            if 'error' in row:errors.append(row)
            elif row['downloadSha256'] in download_hashes:
                errors.append({'id':row['id'],'error':'Duplicate downloaded image'})
                (root/row['file']).unlink()
            else:
                download_hashes.add(row['downloadSha256']);photos.append(row)
    report={'version':1,'kind':'unreviewed-open-license-photo-candidates','readyForTraining':False,
        'excludedPhotoIds':len(excluded_ids),'excludedAuthors':len(excluded_authors),
        'note':'Search matches are NOT confirmed labels. Review every image, license and duplicate/capture group before creating dataset.json. Broad zebra/giraffe labels are groups, not a claim of one taxonomic species.',
        'photos':photos,'errors':errors}
    (root/'review-queue.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    lines=['# Photo candidate attributions (unreviewed)\n']
    for row in photos:lines.append(f"- {row['id']}: {row['title']} — {row['author']} — {row['license']} ({row['licenseUrl']}) — {row['sourcePage']}")
    (root/'ATTRIBUTIONS.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({'downloaded':len(photos),'errors':len(errors),'readyForTraining':False}),flush=True)


if __name__=='__main__':main()
