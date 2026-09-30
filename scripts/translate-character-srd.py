"""Generate review candidates locally from the CC BY SRD spell descriptions.

Optional developer tool: pip install argostranslate. No web service, API key,
or player data. Models/cache stay in .codex-tmp. Does not overwrite reviewed
translations; writes candidates and numerical warnings for human review.
"""
import hashlib
import json
import os
import re
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
cache = root / '.codex-tmp' / 'translation'
for name, suffix in [('XDG_DATA_HOME','data'), ('XDG_CONFIG_HOME','config'), ('XDG_CACHE_HOME','cache')]:
    os.environ[name] = str(cache / suffix)
os.environ['ARGOS_PACKAGES_DIR'] = str(cache / 'models')
os.environ['ARGOS_DEVICE_TYPE'] = 'cpu'
os.environ['ARGOS_INTRA_THREADS'] = '4'

import argostranslate.package
import argostranslate.translate

argostranslate.package.update_package_index()
installed = argostranslate.package.get_installed_packages()
if not any(p.from_code == 'en' and p.to_code == 'ru' for p in installed):
    package = next(p for p in argostranslate.package.get_available_packages() if p.from_code == 'en' and p.to_code == 'ru')
    print('Installing local EN → RU model', package.package_version, flush=True)
    argostranslate.package.install_from_path(package.download())

spells = json.loads((root / 'apps/server/internal/httpapi/character_catalog.json').read_text(encoding='utf-8'))['spells']
output = cache / 'spell-candidates.json'
results = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {}
for i, spell in enumerate(spells):
    if spell.get('source'):
        continue  # Original non-SRD additions already carry reviewed Russian text.
    source = spell['description']
    digest = hashlib.sha256(source.encode()).hexdigest()
    if results.get(spell['id'], {}).get('sha256') == digest:
        continue
    text = argostranslate.translate.translate(source, 'en', 'ru')
    warnings = []
    if Counter(re.findall(r'\d+', source)) != Counter(re.findall(r'\d+', text)):
        warnings.append('numbers-changed')
    if Counter(re.findall(r'\d+d\d+', source)) != Counter(re.findall(r'\d+[dдк]\d+', text)):
        warnings.append('check-dice')
    if not re.search('[А-Яа-я]', text):
        warnings.append('missing-russian')
    results[spell['id']] = {'sha256': digest, 'text': text, 'warnings': warnings, 'status': 'machine-unreviewed'}
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{i+1}/{len(spells)} {spell["id"]} {warnings}', flush=True)
