"""Check the embedded 2024 animal catalogue against the locally saved SRD PDF.

Requires PyMuPDF. The JSON argument is a dump of RULE_CREATURES (not user data).
Example: python scripts/audit-srd-animal-catalog.py .codex-tmp/creatures.json
"""
import argparse
import json
import re
from fractions import Fraction
from pathlib import Path

import pymupdf


def source_animals(path):
    rows = []
    started = False
    document = pymupdf.open(path)
    for page_index in range(343, 364):
        page = document[page_index]
        for left, right in [(0, 306), (306, 612)]:
            spans = [span for block in page.get_text("dict")["blocks"]
                     for line in block.get("lines", []) for span in line["spans"]
                     if left <= span["bbox"][0] < right and 35 < span["bbox"][1] < 750]
            spans.sort(key=lambda span: (round(span["bbox"][1]), span["bbox"][0]))
            for span in spans:
                if 14 < span["size"] < 16:
                    if span["text"] == "Allosaurus":
                        started = True
                    if started:
                        rows.append({"name": span["text"], "text": ""})
                elif rows:
                    rows[-1]["text"] += span["text"] + " "
    if len(rows) != 95 or rows[-1]["name"] != "Wolf":
        raise ValueError("SRD animal inventory or PDF layout changed; review extraction")
    return rows


def audit(pdf, catalog):
    creatures = json.loads(Path(catalog).read_text(encoding="utf-8"))
    errors = []
    rows = source_animals(pdf)
    form_source = Path("apps/web/src/features/characters/beast-forms-2024.ts").read_text(encoding="utf-8")
    forms = json.loads(form_source.split("export const BEAST_FORMS_2024", 1)[1].split("= ", 1)[1].strip().removesuffix(";"))
    expected_form_ids = set()
    for row in rows:
        creature = next((c for c in creatures if c["edition"] == "2024" and c["name"]["en"] == row["name"]), None)
        if creature is None:
            errors.append(f'{row["name"]}: missing')
            continue
        text = re.sub(r"\s+", " ", row["text"]).replace("−", "-")
        tables = re.search(r"MOD SAVE MOD SAVE MOD SAVE(.*?)tr ex on(.*?)nt is ha", text)
        if tables is None:
            raise ValueError(f'Ability table layout changed: {row["name"]}')
        abilities = []
        for part in tables.groups():
            numbers = [int(n) for n in re.findall(r"[+-]?\d+", part)]
            if len(numbers) != 9:
                raise ValueError(f'Ability table cells changed: {row["name"]}')
            abilities.extend(numbers[::3])
        expected = {
            "abilities": abilities,
            "armorClass": int(re.search(r"AC (?:Initiative )?(\d+)", text)[1]),
            "hp": int(re.search(r"HP (\d+)", text)[1]),
            "hitDice": re.search(r"HP \d+ \((.*?)\)", text)[1].replace(" ", ""),
            "challenge": re.search(r"CR ([\d/]+)", text)[1],
            "initiative": int(re.search(r"Initiative (?:\d+ )?([+-]\d+)", text)[1]),
            "proficiency": int(re.search(r"PB \+(\d+)", text)[1]),
        }
        if re.search(r"\bBeast\b", text.split("AC", 1)[0]):
            expected_form_ids.add(creature["id"])
            expected_form = {"id": creature["id"], "challenge": float(Fraction(expected["challenge"])),
                             "size": text.split()[0], "fly": "Fly" in text.split("Speed", 1)[1].split("MOD", 1)[0]}
            actual_form = next((f for f in forms if f["id"] == creature["id"]), None)
            if expected_form != actual_form:
                errors.append(f'{row["name"]}: form eligibility differs: {actual_form!r} != {expected_form!r}')
        for key, value in expected.items():
            actual = creature.get(key)
            if key == "hitDice":
                actual = actual.replace(" ", "").replace("−", "-")
            if actual != value:
                errors.append(f'{row["name"]}: {key}: {actual!r} != {value!r}')
    if expected_form_ids != {f["id"] for f in forms}:
        errors.append("Form IDs do not match the individual Beasts in the source")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"All {len(rows)} SRD 2024 Animals: names, abilities, AC, HP, Hit Dice, CR, initiative and proficiency match.")
    print(f"All {len(forms)} form eligibility records match source type, CR, size and flight.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog")
    parser.add_argument("--pdf", default="tmp/rules-sources/srd-2024.pdf")
    args = parser.parse_args()
    audit(args.pdf, args.catalog)
