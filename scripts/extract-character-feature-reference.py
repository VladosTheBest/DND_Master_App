"""Extract complete SRD class feature text (requires PyMuPDF and official SRD PDFs).
Usage: python scripts/extract-character-feature-reference.py SRD5.1.pdf SRD5.2.1.pdf
"""
import json, re, sys
from pathlib import Path
import pymupdf

classes = {'Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'}
result = {}
for edition, source in zip(['2014','2024'], sys.argv[1:]):
    doc = pymupdf.open(source)
    current_class = None
    current_key = None
    lines = []
    def flush():
        if current_key and lines:
            text = '\n'.join(lines)
            text = re.sub(r'(?<=\w)\s*-\s*\n(?=[a-z])', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            if text: result[current_key] = text
    for page in list(doc)[7:55] if edition == '2014' else list(doc)[27:82]:
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                spans=line['spans']
                text=re.sub(r'\s+',' ',''.join(s['text'] for s in spans)).strip().replace('�', '’')
                if not text or 'System Reference' in text or re.fullmatch(r'\d+',text): continue
                size=max(s['size'] for s in spans)
                if size >= 17 and text in classes:
                    flush(); current_class=text.lower(); current_key=None; lines=[]; continue
                if current_class and size >= 11.8:
                    flush(); lines=[]; current_key=None
                    if size < (14.5 if edition == '2014' else 13) and len(text)<120:
                        current_key=f'{edition}/{current_class}/{text}'
                    elif size >= 24 and text not in classes:
                        current_class=None
                    continue
                if current_key: lines.append(text)
    flush()
out=Path('apps/web/src/features/characters/feature-reference.ts')
out.write_text('/** Complete class-feature excerpts from official CC BY 4.0 SRDs. See SOURCES.md. */\nexport const FEATURE_REFERENCE: Record<string, string> = '+json.dumps(result,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
print(f'Extracted {len(result)} class rule sections.')
