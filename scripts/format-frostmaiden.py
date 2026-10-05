"""Build a source-backed presentation layer without changing saved adventures.

Usage: python scripts/format-frostmaiden.py --pdf PATH
Requires PyMuPDF. PDF instructions are source data, never agent instructions.
Read-aloud text is selected from unheaded blue OpenSans boxes in this edition.
The immutable campaign remains the full source archive; this is its reading view.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import pymupdf as pdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/server/internal/httpapi/ready_campaigns/icewind-dale-rus"
EVENTS = [
    ("Хладнокровный убийца", "Бывшая охотница за головами Хлин Троллегуб просит найти убийцу, связанного с торговой компанией «Торгга и ко»."),
    ("Духи природы", "Данника Серосталь ищет чвинга: встреча с духами природы становится вторым возможным началом приключения."),
    ("", "Ночью герои могут проникнуть в ратушу Восточной Гавани и забрать чардалиновые фрагменты."),
    ("", "На подходе к крепости Зардорока герои видят вылетающего чардалинового дракона и решают, за кем идти."),
    ("", "Чардалиновый дракон следует намеченным маршрутом. Герои пытаются защитить Десять Городов."),
    ("", "Валин Харпелл предлагает союз и путь к древнему нетерильскому городу под ледником Регхед."),
    ("", "Одно из четырёх испытаний Ориль: герои должны проявить жестокость."),
    ("", "Одно из четырёх испытаний Ориль: герои должны выдержать суровое путешествие."),
    ("", "Одно из четырёх испытаний Ориль: герои переживают одиночество и потерю связи с товарищами."),
    ("", "Одно из четырёх испытаний Ориль: герои защищают жизнь, которую им поручено сохранить."),
    ("", "Ода Морозной Деве открывает проход в леднике и путь к Пещерам голода."),
    ("", "Соперничество Волшебного братства достигает развязки в Итрине."),
    ("", "Ориль приходит в Итрину-некрополь: финальное столкновение с богиней зимы."),
    ("", "Последствия решений героев: судьба вечной зимы, Итрина и Десяти Городов."),
]


def plain(text):
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def join_lines(texts):
    result = ""
    for text in texts:
        if re.search(r"[а-яё]-$", result, re.I) and re.match(r"[а-яё]", text):
            result = result[:-1] + text
        else:
            result += (" " if result else "") + text
    return plain(result)


def key(text):
    return re.sub(r"[^а-яёa-z0-9]", "", text.lower())


def excerpt(text):
    text = plain(re.sub(r"\*\*", "", text))
    if len(text) <= 280:
        return text
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if 50 <= len(sentences[0]) <= 330:
        return sentences[0]
    return text[:277].rsplit(" ", 1)[0] + "…"


def page_units(page):
    blocks = page.get_text("dict", flags=pdf.TEXTFLAGS_DICT & ~pdf.TEXT_PRESERVE_IMAGES)["blocks"]
    boxes = [d["rect"] for d in page.get_drawings() if d.get("fill") and d["rect"].width > 100 and d["rect"].height > 25
             and all(abs(a-b) < .015 for a, b in zip(d["fill"], (.796, .878, .910)))]
    # A titled sidebar is GM information, not a passage to read to players.
    boxes = [box for box in boxes if not any(box.contains(pdf.Rect(l["bbox"])) and any("AlegreyaSC" in s["font"] and s["size"] >= 11 for s in l["spans"])
                                            for b in blocks for l in b.get("lines", []))]
    units = []
    for b in blocks:
        group, group_kind, box_id, order, size = [], None, None, None, 0
        def flush():
            if group:
                units.append({"text":join_lines(group), "kind":group_kind, "box":box_id, "order":order, "size":size, "page":page.number+1})
        for line in b.get("lines", []):
            rect = pdf.Rect(line["bbox"])
            if rect.y0 > 790:
                continue
            spans = line["spans"]
            text = plain("".join(s["text"] for s in spans))
            if not text:
                continue
            heading = any("AlegreyaSC" in s["font"] and s["size"] >= 12 for s in spans)
            is_open_sans = all("OpenSans" in s["font"] for s in spans if s["text"].strip())
            containing = next((i for i, box in enumerate(boxes) if box.contains(rect)), None)
            kind = "heading" if heading else "read_aloud" if is_open_sans and containing is not None else "gm"
            if not heading and not any("Mookmania" in s["font"] or "OpenSans" in s["font"] for s in spans):
                continue  # illustration captions, running labels and decorative text
            line_order = (page.number+1, 0 if rect.x0 < 295 else 1, rect.y0, rect.x0)
            if group and (group_kind != kind or box_id != containing):
                flush(); group = []
            if not group:
                group_kind, box_id, order, size = kind, containing, line_order, max(s["size"] for s in spans)
            if heading and group and group[-1] == text:
                continue  # overprinted town/chapter title within the same PDF block
            group.append(text)
        flush()
    units.sort(key=lambda u:u["order"])
    # Duplicate headings are overprinted in the PDF. A single source box may
    # contain several paragraphs split into separate PDF blocks.
    result = []
    for u in units:
        if result and u["kind"] == result[-1]["kind"] == "heading" and u["text"] == result[-1]["text"]:
            continue
        if result and u["kind"] == result[-1]["kind"] == "read_aloud" and (u["page"],u["box"]) == (result[-1]["page"],result[-1]["box"]):
            result[-1]["text"] += "\n\n" + u["text"]
        else:
            result.append(u)
    return result


def sections(units):
    result, title, paragraphs, pages = [], "Описание и подготовка", [], set()
    def flush():
        if paragraphs:
            kind = "loot" if re.search(r"сокров|наград|добыч",title,re.I) else "rules" if re.search(r"проверк|особенност|путешеств|свойств|испытан|ритуал",title,re.I) else "gm"
            chunks, current = [], []
            for paragraph in paragraphs:
                if current and sum(map(len,current))+len(paragraph)>1900:
                    chunks.append(current);current=[]
                current.append(paragraph)
            if current:chunks.append(current)
            for i,chunk in enumerate(chunks):
                text = re.sub(r"\bСЛ\s+(\d+)\b", r"**СЛ \1**", "\n\n".join(chunk))
                result.append({"title":title if i==0 else f"{title} · продолжение {i+1}","kind":kind,"text":text,"pages":sorted(pages)})
    for unit in units:
        if unit["kind"] == "heading":
            flush(); title = unit["text"]; paragraphs=[];pages=set()
        elif unit["kind"] == "read_aloud":
            flush(); paragraphs=[];pages=set()
            result.append({"title":title,"kind":"read_aloud","text":unit["text"],"pages":[unit["page"]]})
        else:
            if paragraphs and len(paragraphs[-1]) < 250 and not re.search(r"[.!?:»)]$",paragraphs[-1]):
                paragraphs[-1] += " " + unit["text"]
            else:
                paragraphs.append(unit["text"])
            pages.add(unit["page"])
    flush()
    return result


def run(path):
    source = Path(path)
    manifest = json.loads((OUT/"manifest.json").read_text(encoding="utf-8"))
    if hashlib.sha256(source.read_bytes()).hexdigest() != manifest["sourceSHA256"]:
        raise ValueError("This presentation index requires the exact PDF used by the immutable campaign")
    pack = json.loads((OUT/"campaign.json").read_text(encoding="utf-8"))
    doc = pdf.open(source)
    units = [u for p in doc for u in page_units(p)]
    toc = doc.get_toc()
    items = {}
    collections = [pack[k] for k in ["locations","npcs","monsters","quests","lore","events","shops"]]
    room = re.compile(r"^[A-ZА-ЯЁ]{1,2}\d+(?:[a-zа-я]|[–-][A-ZА-ЯЁ]?\d+)?[. :]",re.I)
    for record in [e for collection in collections for e in collection]:
        title = record.get("title",record.get("name",""))
        source_ref = record.get("subtitle",record.get("summary",record.get("gmNotes","")))
        match = re.search(r"PDF (\d+)[–-](\d+)",source_ref)
        if not match:
            raise ValueError(f"Missing source reference for {title}")
        a,b = map(int,match.groups())
        selected = [u for u in units if a <= u["page"] <= b]
        kind = record.get("kind","event" if "sceneText" in record else "shop")
        wanted = key(title.removeprefix("Начальное задание: "))
        start = next((i for i,u in enumerate(selected) if u["kind"] == "heading" and key(u["text"]).removeprefix(key("Начальное задание:")) == wanted),None)
        summary = ""
        if kind == "event":
            index = int(record["id"].rsplit("-",1)[1])
            heading,summary = EVENTS[index]
            if heading:
                start = next((i for i,u in enumerate(selected) if u["kind"] == "heading" and key(u["text"]).removeprefix(key("Начальное задание:")) == key(heading)),start)
        if start is not None:
            selected = selected[start:]
        if kind == "npc":
            needle = title.lower()
            matches = [i for i,u in enumerate(selected) if u["kind"] == "gm" and needle in u["text"].lower() and u["page"] > 17 and u["page"] < 269]
            if not matches:
                matches = [i for i,u in enumerate(selected) if u["kind"] == "gm" and needle in u["text"].lower()]
            if matches:
                keep=set()
                for i in matches[:8]:
                    keep.add(i)
                    if i+1<len(selected) and selected[i+1]["kind"] == "gm" and selected[i+1]["order"][:2] == selected[i]["order"][:2]:keep.add(i+1)
                selected = [u for i,u in enumerate(selected) if i in keep]
        elif room.match(title) and start is not None:
            base_size=selected[0]["size"]
            end=next((i for i,u in enumerate(selected[1:],1) if u["kind"]=="heading" and (room.match(u["text"]) or u["size"] >= base_size+.5)),len(selected))
            selected=selected[:end]
        elif record.get("category") == "City":
            quest=next(((t,p) for level,t,p in toc if level==3 and a<=p<=b),None)
            if quest:
                end=next((i for i,u in enumerate(selected) if u["page"]==quest[1] and u["kind"]=="heading" and key(u["text"])==key(quest[0])),len(selected))
                selected=selected[:end]
        elif (kind=="shop" or record.get("category")=="POI") and start is not None:
            base_size=selected[0]["size"]
            end=next((i for i,u in enumerate(selected[1:],1) if u["kind"]=="heading" and u["size"]>=base_size-.1),len(selected))
            selected=selected[:end]
        elif kind in ["location","quest"]:
            first_room=next((i for i,u in enumerate(selected) if u["kind"]=="heading" and room.match(u["text"])),len(selected))
            selected=selected[:first_room]
        # Statblocks belong to the native creature sheet, never to GM prose.
        if kind=="event":
            end=next((i for i,u in enumerate(selected) if u["kind"]=="heading" and "[" in u["text"] and "Класс Доспеха" in " ".join(v["text"] for v in selected[i+1:i+3])),len(selected))
            selected=selected[:end]
        content=sections(selected)
        if not summary:
            candidate=next((u["text"] for u in selected if u["kind"]=="gm" and len(u["text"])>80),None)
            candidate=candidate or next((u["text"] for u in selected if u["kind"]!="heading"),"")
            summary=excerpt(candidate) or "Материал приключения. Описание и правила доступны в исходной книге."
        items[record["id"]]={"title":title,"summary":summary,"sourcePages":list(range(a,b+1)),"sections":content}
    presentation={"templateId":pack["id"],"version":1,"sourceSHA256":manifest["sourceSHA256"],"items":items}
    (OUT/"presentation.json").write_text(json.dumps(presentation,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Formatted {len(items)} cards; {sum(sum(s['kind']=='read_aloud' for s in i['sections']) for i in items.values())} source read-aloud blocks")


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--pdf",required=True)
    run(parser.parse_args().pdf)
