"""Verify embedded 2014 Beasts against the locally saved SRD 5.1 PDF.

Usage: python scripts/audit-srd-beasts-2014.py .codex-tmp/creatures.json
Requires PyMuPDF; the JSON argument is a RULE_CREATURES dump, never user data.
"""
import argparse
import json
import re
from fractions import Fraction
from pathlib import Path
import pymupdf


def normalize(value):
    return re.sub(r"\s+", " ", value).replace("−", "-").strip()


def name_key(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def audit(pdf, catalog):
    rows = []
    document = pymupdf.open(pdf)
    for index in [*range(278, 281), *range(348, 350), *range(365, 394)]:
        for left, right in [(0, 306), (306, 612)]:
            spans = [span for block in document[index].get_text("dict")["blocks"]
                     for line in block.get("lines", []) for span in line["spans"]
                     if left <= span["bbox"][0] < right and 35 < span["bbox"][1] < 750]
            spans.sort(key=lambda s: (round(s["bbox"][1]), s["bbox"][0]))
            for span in spans:
                if span["size"] == 12 and span["font"] == "Calibri-Bold":
                    rows.append({"name": normalize(span["text"]), "text": ""})
                elif rows:
                    rows[-1]["text"] += span["text"] + " "
    rows = [r for r in rows if re.search(r"\bbeast,", normalize(r["text"]).split("Armor Class")[0])
            and not r["name"].startswith("Swarm")]
    assert len(rows) == 86, "SRD inventory/layout changed; review extraction"
    creatures = json.loads(Path(catalog).read_text(encoding="utf-8"))
    source = Path("apps/web/src/features/characters/beast-forms-2014.ts").read_text(encoding="utf-8")
    forms = json.loads(source.split("= ", 1)[1].strip().removesuffix(";"))
    errors, expected_forms = [], []
    for row in rows:
        creature = next((c for c in creatures if c["edition"] == "2014" and name_key(c["name"]["en"]) == name_key(row["name"])), None)
        if creature is None:
            errors.append(row["name"] + ": missing")
            continue
        text = normalize(row["text"])
        expected = {
            "armorClass": int(re.search(r"Armor Class (\d+)", text)[1]),
            "hp": int(re.search(r"Hit Points (\d+)", text)[1]),
            "hitDice": re.search(r"Hit Points \d+ \(([^)]+)\)", text)[1],
            "challenge": re.search(r"Challenge ([\d/]+)", text)[1],
            "abilities": [int(v) for v in re.findall(r"(\d+) \([+-]\d+\)", text.split("STR DEX CON INT WIS CHA", 1)[1])][:6],
        }
        for field, value in expected.items():
            actual = creature[field]
            if field == "hitDice":
                actual, value = normalize(actual).replace(" ", ""), value.replace(" ", "")
            if actual != value:
                errors.append(f'{row["name"]}: {field}: {actual!r} != {value!r}')
        expected_forms.append({"id": creature["id"], "challenge": float(Fraction(expected["challenge"])),
                               "fly": bool(re.search(r"\bfly \d+", text)), "swim": bool(re.search(r"\bswim \d+", text)),
                               "size": text.split()[0]})
    if sorted(forms, key=lambda f: f["id"]) != sorted(expected_forms, key=lambda f: f["id"]):
        errors.append("Form eligibility differs from source: IDs, CR, size, flight or swimming")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"All {len(rows)} SRD 2014 Beasts: abilities, AC, HP, Hit Dice, CR and form eligibility match.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog")
    parser.add_argument("--pdf", default="tmp/rules-sources/srd-2014.pdf")
    args = parser.parse_args()
    audit(args.pdf, args.catalog)
