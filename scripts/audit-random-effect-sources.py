"""Review helper: check table ranges and source fingerprints, never import prose.

Requires beautifulsoup4. --record-reviewed records a baseline after manual review;
ordinary invocation reports drift against that baseline. Sources are optional at
runtime: the application always uses its bundled, reviewed mechanical catalogue.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/web/src/features/characters/random-effect-source-audit.json'
SOURCES = [
    ('prismatic-spray-2014', 'https://dnd.su/spells/291-prismatic_spray/', None, 8, 1),
    *[(f'teleport-{kind}-2014', 'https://dnd.su/spells/367-teleport/', None, 8 if kind == 'direction' else 100, 0) for kind in ['circle', 'object', 'familiar', 'casual', 'once', 'false', 'direction']],
    ('prismatic-spray-2024', 'https://next.dnd.su/spells/10611-prismatic-spray/', None, 8, 1),
    ('confusion-2014', 'https://dnd.su/spells/325-confusion/', None, 10, 0),
    ('confusion-2024', 'https://next.dnd.su/spells/10203-compulsion', None, 10, 0),
    ('bag-beans-2024', 'https://next.dnd.su/items/15846-bag-of-beans', None, 100, 0),
    ('cube-summoning-2024', 'https://next.dnd.su/items/15895-cube-of-summoning', None, 6, 1),
    *[(f'teleport-{kind}-2024', 'https://next.dnd.su/spells/10673-teleport', None, 8 if kind == 'direction' else 100, 0) for kind in ['circle', 'object', 'familiar', 'casual', 'once', 'false', 'direction']],
    ('prayer-beads-2024', 'https://next.dnd.su/items/15998-necklace-of-prayer-beads', None, 20, 0),
    ('bag-tricks-gray-2024', 'https://next.dnd.su/items/15849-bag-of-tricks', None, 8, 1),
    ('bag-tricks-rust-2024', 'https://next.dnd.su/items/15849-bag-of-tricks', None, 8, 1),
    ('bag-tricks-tan-2024', 'https://next.dnd.su/items/15849-bag-of-tricks', None, 8, 1),
    ('robe-useful-items-2024', 'https://next.dnd.su/items/16076-robe-of-useful-items', None, 100, 0),
    ('deck-illusions-2024', 'https://next.dnd.su/items/15902-deck-of-illusions', None, 100, 0),
    ('trick-weapon-2024', 'https://next.dnd.su/items/21331-trick-weapon', None, 10, 1),
    ('lantern-tracking-2014', 'https://dnd.su/items/2330-lantern-of-tracking/', None, 10, 1),
    ('cartographer-landmarks-2014', 'https://dnd.su/items/2140-cartographers-map-case/', None, 8, 1),
    ('armor-resistance-2024', 'https://next.dnd.su/items/15842-armor-of-resistance', None, 10, 1),
    ('potion-resistance-2024', 'https://next.dnd.su/items/16040-potion-of-resistance', None, 10, 1),
    ('alchemist-elixirs-2014', 'https://dnd.su/class/137-artificer/', 'specialist.alchemist', 6, 1),
    ('alchemist-elixirs-2024', 'https://next.dnd.su/class/artificer', 'subclass.alchemist', 6, 1),
    ('genie-kind-2014', 'https://dnd.su/class/104-warlock/', 'patron.genie', 4, 1),
    ('genie-vessel-2014', 'https://dnd.su/class/104-warlock/', 'patron.genie', 6, 1),
    ('star-map-2014', 'https://dnd.su/class/90-druid/', 'circle.stars', 6, 1),
    ('star-map-2024', 'https://next.dnd.su/class/druid', 'subclass.stars', 6, 1),
    ('fey-gifts-2014', 'https://dnd.su/class/97-ranger/', 'archetype.fey-wanderer', 6, 1),
    ('fey-gifts-2024', 'https://next.dnd.su/class/ranger/', 'subclass.fey-wanderer', 6, 1),
    ('swarm-appearance-2014', 'https://dnd.su/class/97-ranger/', 'archetype.swarmkeeper', 4, 1),
    ('drake-origin-2014', 'https://dnd.su/class/97-ranger/', 'archetype.drakewarden', 6, 1),
    ('mercy-masks-2014', 'https://dnd.su/class/93-monk/', 'tradition.mercy', 6, 1),
    ('dragon-origin-2014', 'https://dnd.su/class/93-monk/', 'tradition.ascending-dragon', 6, 1),
    ('reality-break-2014', 'https://dnd.su/spells/2454-reality-break/', None, 10, 0),
    ('sorcerer-wild-2014', 'https://dnd.su/class/101-sorcerer/', 'origin.wild-magic', 100, 2),
    ('sorcerer-wild-2024', 'https://next.dnd.su/class/sorcerer/wild-surges', None, 100, 4),
    ('barbarian-wild-2014', 'https://dnd.su/class/87-barbarian/', 'primal.wild-magic', 8, 1),
    ('bard-spirits-2014', 'https://dnd.su/class/88-bard/', 'college.spirits', 12, 1),
    ('bard-spirits-2024', 'https://next.dnd.su/class/bard', 'subclass.college-of-the-spirits', 12, 1),
]
parser = argparse.ArgumentParser()
parser.add_argument('--record-reviewed', action='store_true')
args = parser.parse_args()
result = []
for identity, url, marker, die, width in SOURCES:
    with urlopen(Request(url, headers={'User-Agent':'ShadowEdgeGM-rule-audit/1.0'}), timeout=45) as response:
        soup = BeautifulSoup(response.read().decode('utf8'), 'html.parser')
    if identity == 'prismatic-spray-2014':
        prose = [p.get_text(' ', strip=True) for p in soup.find_all('p') if re.match(r'^[1-8]\.\s', p.get_text(' ', strip=True))]
        if [int(p[0]) for p in prose] != list(range(1,9)):
            raise RuntimeError('2014 Prismatic Spray requires all eight ordered ray paragraphs')
        result.append({'id': identity, 'url': url, 'ranges': [[n,n] for n in range(1,9)], 'sourceTextSha256': hashlib.sha256('\n'.join(prose).encode('utf8')).hexdigest()})
        continue
    if identity.startswith('teleport-'):
        edition = identity[-4:]
        kind = identity.removeprefix('teleport-').removesuffix(f'-{edition}')
        if kind == 'direction':
            paragraphs = [p.get_text(' ', strip=True) for p in soup.find_all('p') if re.match(r'^Мимо цели\s*\.', p.get_text(' ', strip=True))]
            valid_directions = len(paragraphs) == 1 and ([int(n) for n in re.findall(r'при (\d)', paragraphs[0])] == list(range(1,9)) if edition == '2024' else all(x in paragraphs[0] for x in ['1к10', 'север', 'северо-восток', 'восток']))
            if not valid_directions:
                raise RuntimeError('Teleport direction source no longer contains all eight directions')
            ranges, prose = [[n,n] for n in range(1,9)], paragraphs
        else:
            matrices = []
            for table in soup.find_all('table'):
                rows = [[c.get_text(' ', strip=True) for c in tr.find_all(['td','th'])] for tr in table.find_all('tr')]
                if len(rows) == (7 if edition == '2024' else 8) and all(len(r) == 5 for r in rows): matrices.append(rows)
            if len(matrices) != 1: raise RuntimeError('Teleport requires exactly one complete familiarity matrix')
            index = ['circle','object','familiar','casual','once','false'].index(kind) + 1
            if edition == '2014':
                if matrices[0][5][1:] != matrices[0][6][1:]:
                    raise RuntimeError('2014 viewed-once and described rows no longer match')
                if kind == 'false': index = 7
            cells = matrices[0][index]
            ranges = []
            for cell in cells[1:]:
                if cell == '—': continue
                bounds = re.fullmatch(r'(\d{2})[–—-](\d{2})', cell)
                if not bounds: raise RuntimeError(f'Unexpected Teleport range: {cell}')
                ranges.append([int(bounds[1]) or 100, int(bounds[2]) or 100])
            expected = {'circle':[[1,100]], 'object':[[1,100]], 'familiar':[[1,5],[6,13],[14,24],[25,100]], 'casual':[[1,33],[34,43],[44,53],[54,100]], 'once':[[1,43],[44,53],[54,73],[74,100]], 'false':[[1,50],[51,100]]}[kind]
            if ranges != expected: raise RuntimeError(f'Teleport ranges changed: {kind}')
            prose = [' | '.join(cells)]
        result.append({'id':identity, 'url':url, 'ranges':ranges, 'sourceTextSha256':hashlib.sha256('\n'.join(prose).encode('utf8')).hexdigest()})
        continue
    if marker:
        soup = soup.select_one(f'[data-code="{marker}"]') if marker.startswith('subclass.') else soup.find(id=marker).find_parent('h2').find_next_sibling()
    matches = []
    irregular_ranges = {
        'confusion-2014': [[1,1],[2,6],[7,8],[9,10]],
        'confusion-2024': [[1,1],[2,6],[7,8],[9,10]],
        'bag-beans-2024': [[1,1],[2,10],[11,20],[21,30],[31,40],[41,50],[51,60],[61,70],[71,80],[81,90],[91,95],[96,100]],
        'prayer-beads-2024': [[1,6],[7,8],[9,14],[15,18],[19,19],[20,20]],
        'robe-useful-items-2024': [[1,8],[9,15],[16,22],[23,30],[31,44],[45,51],[52,59],[60,68],[69,75],[76,83],[84,90],[91,96],[97,100]],
        'reality-break-2014': [[1,2],[3,5],[6,8],[9,10]],
        'deck-illusions-2024': [[n,n+2] for n in range(1,97,3)] + [[97,100]],
    }
    expected = irregular_ranges[identity] if identity in irregular_ranges else [[n, n+width-1] for n in range(1, die+1, width)]
    for table in soup.find_all('table'):
        ranges = []
        prose = []
        for tr in table.select('tr'):
            cells = tr.find_all(['td','th'], recursive=False)
            if len(cells) != (3 if identity in {"genie-kind-2014", "prayer-beads-2024"} else 2):
                continue
            bounds = re.fullmatch(r'(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?', cells[0].get_text(' ', strip=True))
            if not bounds:
                continue
            low = int(bounds[1]) or 100
            high = (int(bounds[2]) or 100) if bounds[2] else low
            ranges.append([low, high])
            prose.append(' | '.join(cell.get_text(' ', strip=True) for cell in cells[1:]))
        if ranges == expected:
            matches.append((ranges, prose))
    bag_indices = {'bag-tricks-gray-2024': 0, 'bag-tricks-rust-2024': 1, 'bag-tricks-tan-2024': 2}
    if identity in bag_indices:
        if len(matches) != 3:
            raise RuntimeError(f'{identity}: expected three complete color tables; found {len(matches)}')
        matches = [matches[bag_indices[identity]]]
    if len(matches) != 1:
        raise RuntimeError(f'{identity}: expected exactly one complete d{die} table; found {len(matches)}')
    ranges, prose = matches[0]
    result.append({'id':identity, 'url':url, 'ranges':ranges, 'sourceTextSha256':hashlib.sha256('\n'.join(prose).encode('utf8')).hexdigest()})
if args.record_reviewed:
    DEST.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
else:
    baseline = json.loads(DEST.read_text(encoding='utf8'))
    if result != baseline:
        previous = {entry['id']: entry for entry in baseline}
        changed = [entry['id'] for entry in result if previous.get(entry['id']) != entry]
        removed = sorted(set(previous) - {entry['id'] for entry in result})
        raise RuntimeError(f'Source table changed ({", ".join(changed + removed) or "ordering"}): review mechanics/translations before recording a new baseline.')
print(f'{len(result)} source tables: exact ranges and reviewed fingerprints verified.' if not args.record_reviewed else f'Recorded reviewed fingerprints for {len(result)} source tables; no source prose imported.')
