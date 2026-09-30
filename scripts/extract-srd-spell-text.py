"""Extract SRD 5.2.1 spell text by column and text baseline, not PDF object order.
Usage: python scripts/extract-srd-spell-text.py official.pdf output.json [2014|2024]
Requires PyMuPDF. Output is a review candidate, never automatically published.
"""
import json
import re
import sys
from pathlib import Path
import pymupdf

root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'apps/server/internal/httpapi/character_catalog.json').read_text(encoding='utf8'))
def normalized(text):
    return re.sub(r'[^a-z0-9]','',text.lower())
edition=sys.argv[3] if len(sys.argv)>3 else '2024'
expected_count=319 if edition=='2014' else 339
spells={normalized(s['name'].split('·')[-1].strip()):s['id'] for s in catalog['spells'] if s['editions']==[edition] and not s.get('source')}
doc=pymupdf.open(sys.argv[1])
result={}; current=None; lines=[]
def clean(values):
    text='\n'.join(values)
    text=re.sub(r'[-\u00ad\u2010\u2011]+','-',text)
    text=re.sub(r'(?<=\w)-\s*\n(?=[a-z])','',text)
    return re.sub(r'\s+',' ',text).strip()
def flush():
    if current:
        text=clean(lines)
        result[current]={'description':text,**metadata}
metadata={};field=None
for page_number in (range(113,194) if edition=='2014' else range(106,175)):
    page=doc[page_number]
    records=[]
    for b in page.get_text('dict')['blocks']:
        for line in b.get('lines',[]):
            spans=line['spans']; text=re.sub(r'\s+',' ',''.join(s['text'] for s in spans)).strip()
            origin=spans[0]['origin']
            if not text or origin[1]>735:continue
            records.append((0 if origin[0]<300 else 1,origin[1],origin[0],text,spans))
    for col,y,x,text,spans in sorted(records,key=lambda r:(r[0],round(r[1],1),r[2])):
        key=normalized(text)
        size=max(s['size'] for s in spans)
        if abs(size-12)<.1 and key in spells:
            flush();current=spells[key];lines=[];metadata={'page':page_number+1};field=None;continue
        if not current:continue
        if re.match(r'^(Level \d|\w+ Cantrip)\b',text) and 'Italic' in spans[0]['font']:
            continue
        match=re.match(r'^(Casting Time|Range|Components?|Duration):\s*(.*)',text)
        if match:
            field={'Casting Time':'castingTime','Range':'range','Components':'components','Component':'components','Duration':'duration'}[match[1]]
            metadata[field]=match[2];continue
        if not metadata.get('castingTime'):continue
        # Metadata wrapping uses Gill Sans. Body text and table/stat blocks are
        # retained in their physical reading order, including adjacent columns.
        wrapped_old=edition=='2014' and (field in ('castingTime','range','components') or (field=='duration' and x>(57.6 if col==0 else 328.56)+6))
        if field and not lines and (wrapped_old or (edition=='2024' and 'GillSans' in spans[0]['font'] and size<10)):
            metadata[field]+=' '+text;continue
        field=None
        lines.append(text)
flush()
# The 5.1 PDF itself contains a truncated upcasting clause. Checked against
# https://www.dndbeyond.com/spells/1993-animal-friendship (legacy Basic Rules).
if edition=='2014':
    text=result['animal-friendship-2014']['description']
    result['animal-friendship-2014']['description']=text.replace('additional beast t level above 1st.','additional beast for each slot level above 1st.').replace('the spells ends.','the spell ends.')
    result['animal-messenger-2014']['description']=result['animal-messenger-2014']['description'].replace('3nd level','3rd level')
missing=set(spells.values())-result.keys()
if missing:raise RuntimeError(f'Missing spell headings: {sorted(missing)}')
if len(result)!=expected_count:raise RuntimeError(f'Expected {expected_count} spell headings; found {len(result)}')
for identity,value in result.items():
    if not value.get('components') or len(value['description'])<30:raise RuntimeError(f'Incomplete extraction: {identity}')
Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Extracted {len(result)} spell candidates with components; review before applying.')
