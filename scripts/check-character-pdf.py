"""Visual-output regression checks after test-character-export-ui.cjs (PyMuPDF)."""
from pathlib import Path
import sys
import pymupdf

paths = sys.argv[1:] or ["tmp/character-export-qa/character-book.pdf"]
for filename in paths:
    document = pymupdf.open(filename)
    text = "\n".join(page.get_text() for page in document)
    assert "Справочник состояний" not in text
    assert "English:" not in text
    assert "**" not in text
    assert "Религия" in document[1].get_text() and "Выживание" in document[1].get_text(), "Skills must fit on the combat page"
    bold_narrative = []
    for page in document:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    x0, y0, x1, y1 = span["bbox"]
                    assert x0 >= 35 and x1 <= 560 and y0 > 20 and y1 < 830, (filename, page.number, span)
                    if span["flags"] & 16 and any(label in span["text"] for label in ["Верность клятве.", "Кровь помнит."]):
                        bold_narrative.append(span["text"])
    assert bold_narrative, "Narrative emphasis must use the embedded bold face"
    print(f"{Path(filename).name}: {len(document)} pages, text bounds, combat grid and narrative bold verified")
