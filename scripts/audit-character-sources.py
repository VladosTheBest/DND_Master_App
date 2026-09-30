"""Inventory public source metadata, never copy rule prose into the application.

Requires beautifulsoup4. Run from the repository root. The report is a source
inventory, not a claim of implemented mechanics or publisher verification.
"""
import json
import re
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from bs4 import BeautifulSoup

CLASSES = 'artificer barbarian bard cleric druid fighter monk paladin ranger rogue sorcerer warlock wizard'.split()
ROOT = Path(__file__).resolve().parents[1]

def fetch(url):
    request = Request(url, headers={'User-Agent': 'ShadowEdgeGM-source-audit/1.0'})
    with urlopen(request, timeout=45) as response:
        return response.read().decode('utf-8')

def title(html):
    node = BeautifulSoup(html, 'html.parser').find(title=True)
    return node.get('title') if node else None

report = {'checkedAt': str(date.today()), 'scope': 'Public dnd.su indexes; no completeness claim for all published D&D books.', 'classes': [], 'excluded': []}
for edition, base in [('2014', 'https://dnd.su'), ('2024', 'https://next.dnd.su')]:
    index = BeautifulSoup(fetch(base + '/class/'), 'html.parser')
    links = {}
    for anchor in index.select('a[href]'):
        path = anchor['href'].rstrip('/')
        for class_id in CLASSES:
            if re.search(r'/class/(?:\d+-)?' + class_id + r'$', path):
                links[class_id] = urljoin(base, anchor['href'])
    if len(links) != len(CLASSES):
        raise RuntimeError(f'Class index changed for {edition}: {sorted(links)}')
    for class_id, url in sorted(links.items()):
        html = fetch(url)
        soup = BeautifulSoup(html, 'html.parser')
        subclasses = []
        if edition == '2024':
            match = re.search(r'document\.subclassSources\s*=\s*(\{.*?\});', html)
            sources = json.loads(match.group(1)) if match else {}
            for node in soup.select('.class__subclass__holder'):
                code = node['data-code']
                source = title(sources.get(code, ''))
                if source in ('Homebrew', 'Dungeons of Drakkenheim') or not source or source.startswith('Unearthed Arcana'):
                    report['excluded'].append({'edition': edition, 'classId': class_id, 'id': code, 'source': source})
                    continue
                features = []
                for feature in node.select('.class__subclass__feature'):
                    level = int(feature.get('data-level', 0))
                    heading = feature.select_one('h3')
                    if level and heading:
                        features.append({'level': level, 'name': heading.get('title') or heading.get_text(' ', strip=True)})
                subclasses.append({'id': code, 'name': node['data-title'], 'source': source, 'features': features})
        else:
            # The old site's table of contents groups official subclass entries
            # under a parent. Stop before its explicit Unofficial boundary.
            official_ids = set()
            parent_ids = {li.get('data-parent') for li in soup.select('[data-parent]')}
            for li in soup.select('.new-article-menu__li-second[data-parent]'):
                parent = li.get('data-parent', '')
                if parent in ('class-features', 'unofficial') or 'unofficial' in parent:
                    continue
                anchor = li.select_one('a[href^="#"]')
                if anchor:
                    official_ids.add(anchor['href'][1:])
            for heading in soup.select('h2'):
                marker = heading.select_one('[id]')
                if marker is None:
                    continue
                code = marker['id']
                if code == 'unofficial':
                    break
                if code not in official_ids or code in parent_ids:
                    continue
                body = heading.find_next_sibling()
                source = 'Player\'s Handbook'
                if body:
                    match = re.search(r'Источник:\s*«([^»]+)', body.get_text(' ', strip=True))
                    if match:
                        source = match.group(1).replace('\u200e', '')
                subclasses.append({'id': code, 'name': heading.get_text(' ', strip=True), 'source': source})
        if not subclasses:
            raise RuntimeError(f'No subclass metadata at {url}; inspect source layout')
        report['classes'].append({'edition': edition, 'id': class_id, 'url': url, 'subclasses': subclasses})
        print(edition, class_id, len(subclasses), flush=True)

output = ROOT / 'apps/web/src/features/characters/source-inventory.json'
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Wrote source metadata:', output)
