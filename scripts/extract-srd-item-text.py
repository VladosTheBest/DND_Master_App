"""Extract CC-BY SRD item references as review candidates, never publish them.

Usage: python scripts/extract-srd-item-text.py official.pdf output.json 2014|2024
Requires PyMuPDF. Column/baseline ordering preserves cross-page continuations;
tables remain line-oriented and require a separate structured-table review.
"""
import json
import re
import sys
from pathlib import Path
import pymupdf

edition = sys.argv[3]
assert edition in ('2014', '2024')
doc = pymupdf.open(sys.argv[1])
pages = range(206, 251) if edition == '2014' else range(208, 253)
records = {}
name = None
lines = []
source_pages = set()
finished = False


def flush():
    if name and lines:
        assert name not in records, f'Duplicate item heading: {name}'
        text = '\n'.join(lines)
        text = re.sub(r'(?<=\w)[\u00ad\u2010\u2011-]\s*\n(?=[a-z])', '', text)
        records[name] = {'text': text, 'pages': sorted(source_pages)}


for pi in pages:
    ordered = []
    for block in doc[pi].get_text('dict')['blocks']:
        for line in block.get('lines', []):
            spans = line['spans']
            if not spans:
                continue
            x, y = spans[0]['origin']
            if y > 735 or y < 30:
                continue
            text = re.sub(r'\s+', ' ', ''.join(s['text'] for s in spans)).strip()
            heading = any(s['font'] == 'GillSans-SemiBold' and abs(s['size'] - 12) < .1 for s in spans)
            ordered.append((0 if x < 300 else 1, round(y, 1), x, text, heading))
    for _, _, _, text, heading in sorted(ordered):
        if edition == '2014' and text == 'Sentient Magic Items':
            finished = True
            break
        if not text:
            continue
        if heading:
            if name and not lines:
                name += ' ' + text
            else:
                flush()
                name, lines, source_pages = text, [], set()
        elif name:
            lines.append(text)
            source_pages.add(pi + 1)
    if finished:
        break
flush()
assert 'Bag of Holding' in records and 'Wings of Flying' in records
Path(sys.argv[2]).write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f'{edition}: extracted {len(records)} item candidates; tables and eligibility still need review.')
