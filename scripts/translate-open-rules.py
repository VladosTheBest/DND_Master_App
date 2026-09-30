"""Produce reviewable full RU candidates for the public, CC-BY SRD spell or item text.

Only public catalogue rules are submitted to the anonymous translation service;
no character drafts, campaigns, credentials or application storage are read.
Cached by source SHA256; numeric/dice discrepancies require review. The output
stays in ignored tmp storage until explicitly applied by a separate review step.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

parser=argparse.ArgumentParser()
parser.add_argument('--edition', choices=['2014','2024'])
parser.add_argument('--limit',type=int)
parser.add_argument('--kind',choices=['spell','item'],default='spell')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
glossary=json.loads((root/'scripts/rules-translation-glossary.json').read_text(encoding='utf8'))
for term in ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']:
    glossary[term.lower()]=glossary[term]
glossary_digest=hashlib.sha256(('quoted-tokens-v2'+json.dumps(glossary,sort_keys=True)).encode()).hexdigest()
dest=root/f'tmp/rules-translations/{args.kind}-glossary-candidates.json'
dest.parent.mkdir(parents=True,exist_ok=True)
cache=json.loads(dest.read_text(encoding='utf8')) if dest.exists() else {}
catalog=json.loads((root/'apps/server/internal/httpapi/character_catalog.json').read_text(encoding='utf8'))
if args.kind == 'item':
    # This mode submits only text extracted from the licensed SRD PDFs, not
    # third-party item prose or application storage.
    candidates=json.loads((root/'tmp/rules-sources/artificer-replication-candidates.json').read_text(encoding='utf8'))
    normalize=lambda text: re.sub(r'[^a-z0-9]','',text.lower())
    records=[]
    for edition in ['2014','2024']:
        extracted=json.loads((root/f'tmp/rules-sources/srd-items-{edition}.json').read_text(encoding='utf8'))
        wanted={normalize(item['englishName']) for item in candidates if item['edition']==edition}
        for name, record in extracted.items():
            if normalize(name) in wanted:
                text=re.sub(r'[-\u00ad\u2010\u2011\u2012]+','-',record['text'])
                text=re.sub(r'(?<=[A-Za-z])-\s*\n(?=[a-z])','',text)
                text=re.sub(r'(?<=\d)-\s*\n(?=[a-z])','-',text)
                text=re.sub(r'\s+',' ',text).strip()
                records.append({'id':normalize(name)+'-'+edition,'description':text,'editions':[edition]})
else:
    records=[spell for spell in catalog['spells'] if not spell.get('source')]
def chunks(text,limit=3500):
    result=[]
    while len(text)>limit:
        at=text.rfind('. ',0,limit)
        if at<limit//2:at=text.rfind(' ',0,limit)
        else:at+=1
        result.append(text[:at]);text=text[at:].lstrip()
    if text:result.append(text)
    return result
def numbers(text):
    # English commas and Russian spaces may group thousands; do not treat them
    # as decimal separators or silently equate different numeric values.
    text=re.sub(r'(?<=\d)[,\u00a0\u202f ](?=\d{3}(?:\D|$))','',text)
    return Counter(re.findall(r'\d+(?:[.,]\d+)?',text.replace(',','.')))
def dice(text):
    return Counter(re.findall(r'\d+[dдк]\d+',text.lower().replace('к','d').replace('д','d')))
def translate(text):
    terms={}
    def protect(match):
        value=match.group()
        # Letter-only tokens keep numbers and dice checks independent.
        token='ZXQ'+''.join(chr(65+int(n)) for n in str(len(terms)))+'QXZ'
        terms[token]=glossary[value]
        return '"'+token+'"'
    pattern=r'\b(?:'+'|'.join(re.escape(k) for k in sorted(glossary,key=len,reverse=True))+r')\b'
    text=re.sub(pattern,protect,text)
    results=[]
    for chunk in chunks(text):
        url='https://translate.googleapis.com/translate_a/single?'+urlencode({'client':'gtx','sl':'en','tl':'ru','dt':'t','q':chunk})
        with urlopen(Request(url,headers={'User-Agent':'ShadowEdgeGM-public-SRD-translation/1.0'}),timeout=30) as response:
            data=json.load(response)
        results.append(''.join(p[0] for p in data[0] if p[0]))
        time.sleep(.3)
    result='\n\n'.join(results)
    for token,value in terms.items():
        if result.count(token)!=1:raise ValueError(f'Translation changed a protected glossary token: {token}')
        result=re.sub('[«“"]?'+token+'[»”"]?',lambda _:value,result)
    if 'ZXQ' in result or 'QXZ' in result:raise ValueError('Unresolved glossary token')
    return result
done=0
for spell in records:
    if args.edition and args.edition not in spell['editions']:continue
    source=spell['description'];digest=hashlib.sha256(source.encode('utf8')).hexdigest()
    if cache.get(spell['id'],{}).get('sourceSha256')==digest and cache[spell['id']].get('glossarySha256')==glossary_digest:continue
    try:
        result=translate(source)
    except Exception as error:
        print(f"Stopped at {spell['id']}: {type(error).__name__}: {error}",flush=True)
        raise
    warnings=[]
    if numbers(source)!=numbers(result):warnings.append('numeric-mismatch')
    if dice(source)!=dice(result):warnings.append('dice-mismatch')
    cache[spell['id']]={'sourceSha256':digest,'glossarySha256':glossary_digest,'descriptionRu':result,'provider':'Google anonymous translation with protected rules glossary','status':'unreviewed','warnings':warnings}
    temp=dest.with_suffix('.writing.json')
    temp.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n',encoding='utf8');temp.replace(dest)
    done+=1
    if done%20==0 or warnings:print(f"{done} translated; {spell['id']}; {','.join(warnings) or 'numbers match'}",flush=True)
    if args.limit and done>=args.limit:break
print(f'Finished: {done} new candidates, {len(cache)} cached. Review required.',flush=True)
