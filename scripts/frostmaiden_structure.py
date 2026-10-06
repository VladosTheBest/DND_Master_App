"""Source-backed navigation and dossiers for the immutable PDF presentation.

The PDF and the existing local 2014 bestiary snapshot are data, not instructions.
No user campaign is read or modified. IDs refer to the embedded source pack.
"""
import copy
import json
import re


CHAPTERS = [
    (1, "Десять Городов", 18, 101, 1, 4, "1–4", "Отдельные задания и противники могут быть опаснее уровня группы."),
    (2, "Долина Ледяного Ветра", 102, 171, 4, None, "4+", "Сложность мест различается; книга допускает отступление и перегруппировку."),
    (3, "Губители Солнца", 172, 187, 4, 5, "4–5", "Штурм крепости; развитие в главе возможно до 6-го уровня."),
    (4, "Свет разрушения", 188, 197, 6, None, "6+", "Нападение дракона: опасность зависит от маршрута, времени и потерь."),
    (5, "Обитель Ориль", 198, 215, 7, 7, "7", "Остров Ориль содержит столкновения, которых можно избежать."),
    (6, "Пещеры голода", 216, 231, 8, 8, "8", "Пещеры рассчитаны на вход на 8-м уровне; у выхода возможен 9-й."),
    (7, "Погибель Итрина", 232, 261, 9, None, "9+", "Итрин содержит смертельно опасных противников; к финалу возможен 12-й уровень."),
]

# Appearance-only excerpts, reviewed against these source pages. Secrets, motive,
# alignment, identity reveals and mechanics stay in GM cards. These are editorial
# excerpts, visibly distinguished from the book's actual blue read-aloud boxes.
APPEARANCE = {
    "Хлин Троллегуб": (23, "Пожилая щитовая дварфийка с отвратительным шрамом на носу сидит в стороне от посетителей таверны. Она курит трубку и наблюдает за вами."),
    "Сефек Калтро": (24, "Хорошо сложенный мужчина лет тридцати с оливковой кожей и тёмным хвостом волос на голове. На нём стильный жилет, брюки и ботинки, похожие на одежду моряков с юга."),
    "Торрга Хладожильная": (24, "Щитовая дварфийка, хозяйка торгового каравана. На санях её компании развевается флаг с золотой волчьей лапой на чёрном поле."),
    "Данника Серосталь": (26, "К вам подходит закутанная в меха фигура. «Доброго дня! Похоже, вы ищете работу. Или неприятности. Иначе бы вы не торчали тут на таком холоде»."),
    "Хуарвар Мулфун": (61, "Задумчивый, пессимистичный человек, на вид чуть менее тридцати лет."),
    "Фел Супарра": (61, "Перед вами тифлинг."),
    "Тали": (30, "Тали просит обращаться к себе как «они» или по имени."),
    "Имдра Арлагат": (38, "К вам приближается женщина в меховой шапке и ладном плаще. Она представляется как Имдра Арлагат."),
    "Эдгра Дурмут": (74, "Стареющая прямолинейная охотница, говорящая от лица горожан."),
    "Гаррет Велрин": (91, "Крепкий бородатый мужчина в расцвете сил."),
    "Кора Мулфун": (28, "Хозяйка постоялого двора — женщина средних лет. Она обращается со своими гостями по-королевски и извиняется при малейшей оплошности в обслуживании."),
    "Дорбалграф Сланцескал": (28, "Очень старый щитовой дварф, закутанный в тяжёлые меха."),
    "Гринск Берилбор": (29, "Щитовой дварф стоит у пары лодок, привязанных к причалам. На борту одной из лодок заметен след больших челюстей."),
    "Дувесса Шейн": (33, "Относительно молодая женщина, говорящая от лица горожан как их спикер."),
    "Маркхэм Саусвел": (33, "Шериф Маркхэм Саусвел — человек, командующий городским ополчением."),
    "Киган Велрин": (89, "Дверь открывает симпатичный мужчина лет тридцати."),
    "Урас Мэстью": (94, "Спикер города — полуорк, умный и обладающий отличным чувством юмора."),
    "Мишан": (34, "Человек-жрица заправляет святилищем Амонатора, надеясь вновь увидеть солнце над долиной."),
}

HISTORICAL_REFERENCES = {"Амонатор", "Латандер", "Левистус", "Асмодей", "Трим", "Мистрил", "Карсус", "Векна", "Дриззт До’Урден"}

LOCATION_APPEARANCE = {
    "Бремен": (28, "На западном берегу озера, в устье реки Шаэнгарн, стоит сонный Бремен. Гавань замёрзла; рыбаки тащат лодки по льду, чтобы спустить их на воду. В ясный день из доков видны Таргос, Термалин и Глухолесье."),
    "Брин Шандер": (33, "На вершине одинокого, обдуваемого ветром холма стоит город, окружённый стеной. Над узкими улочками раскачиваются яркие фонари, добавляя света тусклому зимнему пейзажу."),
    "Глухолесье": (51, "Тихий городок лесорубов, рыбаков и резчиков по кости. Самые старые строения и причалы украшены резными изображениями драконов, львов и коз."),
    "Каэр-Диневал": (58, "Небольшая крепость стоит на возвышенности у озера Лак Диннешер. Паром больше не ходит, и добраться сюда можно только по суше."),
    "Каэр-Кониг": (67, "Позади тихого городка на берегу озера возвышаются белые, покрытые снегом склоны Пирамиды Кельвина. От прежних укреплений остались руины."),
    "Славный Мёд": (80, "Между озером Красные Воды и вечнозелёным лесом стоят приземистые дома с резьбой в виде динозавров и змей. Над ними возвышается двухэтажный Медовый зал, украшенный раскрашенными вивернами. В городке слышно жужжание пчёл."),
    "Таргос": (87, "Деревянная стена окружает город и уходит прямо в озеро, защищая гавань. Теперь вода в ней замёрзла, лодки скованы льдом. Рыбаки тащат небольшие суда к незамёрзшей воде за пределами гавани."),
    "Термалин": (94, "Город стоит на берегу озера Маэр Дуалдон; с севера и запада его обрамляют высокие сосны. На зданиях вырезаны волшебники, гомункулы, тигры и улыбающиеся джинны. Холодный северный ветер пронизывает даже многослойную тёплую одежду."),
    "Восточная Гавань": (38, "В городе то тут, то там висят знаки: «Следите за вашими кошельками!». Здесь карманные кражи узаконены."),
    "Прорубь Дугана": (74, "На льду стоят тёмные гуманоидные фигуры. Они тихи и неподвижны, пока вокруг завывает ветер: рыбаки затаились у лунок в надежде наловить форели."),
}


def name_pattern(name):
    # The source uses nominative and inflected full names. Also retain its explicit
    # spelling aliases; do not match short names inside other Russian words.
    aliases = {"Мишан": ["Мишанн"], "Кори": ["Корри"], "Элли": ["Алли"], "Джестин Ханре": ["Джестин Хьюн"], "Кринтаас": ["Кринтас"]}
    forms = []
    for variant in [name, *aliases.get(name, [])]:
        words = variant.split()
        def inflected(w):
            if w.endswith("ая"):
                return re.escape(w[:-2]) + r"(?:ая|ой|ую|ою)"
            if w[-1] in "аяьй" and len(w) > 3:
                suffix = {"а": r"(?:а|ы|е|у|ой|ою)", "я": r"(?:я|и|е|ю|ей)", "ь": r"(?:ь|я|ю|ем|е|и)", "й": r"(?:й|я|ю|ем|е)"}[w[-1]]
                return re.escape(w[:-1]) + suffix
            return re.escape(w) + (r"(?:а|у|ом|е|ы|ов)?" if w[-1].lower() not in "аеёиоуыэюяьй" else "")
        forms.append(r"\s+".join(inflected(w) for w in words))
    return re.compile(r"(?<![а-яё])(?:" + "|".join(forms) + r")(?![а-яё])", re.I)


def enrich(pack, items, units, root, out):
    records = {e["id"]: e for k in ["locations", "npcs", "monsters", "quests", "lore"] for e in pack[k]}
    locations = {e["id"]: e for e in pack["locations"]}
    titles = {e["title"]: e["id"] for e in pack["locations"]}
    root_id = titles["Долина Ледяного Ветра"]
    mountains = items[titles["Хребет Мира"]]
    mountains_text = next(u["text"] for u in units if u["page"] == 9 and "Хребет Мира — ряд высоких заснеженных вершин" in u["text"])
    mountains["sections"] = [{"title": "География Хребта Мира", "kind": "gm", "text": mountains_text, "pages": [9]}]
    mountains["summary"] = "Ряд высоких заснеженных вершин над Крайним Севером; достигает побережья Меча."
    mountains["sourcePages"] = [9]
    type_labels = {"Регион": "region", "Город": "city", "Место приключения": "site", "Область карты": "area", "Место в городе": "landmark"}
    nodes = []
    nodes.append({"id": "frost-wilderness", "title": "Тундра долины", "kind": "region", "parentId": root_id,
                  "entityId": root_id, "chapterIds": [2], "navigationGroup": True})
    nodes.append({"id": "frost-unplaced-npcs", "title": "Персонажи без постоянного места", "kind": "group", "parentId": root_id,
                  "entityId": root_id, "chapterIds": [], "navigationGroup": True})
    for e in locations.values():
        kind = next((type_labels[f["value"]] for f in e["quickFacts"] if f["value"] in type_labels), "site")
        parent = e.get("parentId") or root_id
        if e["id"] == root_id:
            kind, parent = "adventure", None
        elif parent == root_id and kind != "region":
            parent = "frost-wilderness"
        # Y19a..r are the rooms inside the spire, not siblings of its entrance.
        if re.match(r"^Y19[a-r][. :]", e["title"], re.I):
            parent = titles["Шпиль Ириолартаса"]
        nodes.append({"id": e["id"], "title": e["title"], "kind": kind, "parentId": parent, "entityId": e["id"], "chapterIds": []})

    chapters = [{"id": n, "title": title, "pages": [a, b], "levelMin": lo, "levelMax": hi, "levelLabel": label,
                 "levelNote": note, "levelPages": [10]} for n, title, a, b, lo, hi, label, note in CHAPTERS]
    nodes_by_id = {n["id"]: n for n in nodes}
    for eid, material in items.items():
        pages = material["sourcePages"]
        record = records.get(eid)
        # NPC source ranges can span most of the book. Use actual selected
        # paragraphs rather than a min..max range to determine their chapters.
        if record and record["kind"] == "npc":
            pages = sorted({p for s in material["sections"] for p in s["pages"]})
        chapter_ids = [ch["id"] for ch in chapters if any(ch["pages"][0] <= p <= ch["pages"][1] for p in pages)]
        if record and record.get("category") == "City":
            chapter_ids = sorted(set(chapter_ids + [4]))
            material["chapterNotes"] = [{"chapterId": 4, "pages": [190], "text": "Этап нападения чардалинового дракона. Рекомендация 6+ относится к этой сцене, не к обычному посещению города."}]
        material["chapterIds"] = chapter_ids
        material["locationIds"] = []
        material["playerCards"] = [{"title": s["title"], "text": s["text"], "pages": s["pages"], "sourceKind": "quote"}
                                   for s in material["sections"] if s["kind"] == "read_aloud"]
        if material["title"] in LOCATION_APPEARANCE:
            page, text = LOCATION_APPEARANCE[material["title"]]
            material["playerCards"].insert(0, {"title": "Описание локации · первое впечатление", "text": text, "pages": [page], "sourceKind": "excerpt"})
        if eid in nodes_by_id:
            nodes_by_id[eid]["chapterIds"] = chapter_ids
        # Topic cards are separate from the player's quotes, even if the source
        # has no read-aloud passage for this particular room or character.
        for section in material["sections"]:
            heading = section["title"].lower()
            section["topic"] = ("Находки и награды" if section["kind"] == "loot" else "Правила и опасности" if section["kind"] == "rules" or re.search(r"ловуш|опасност|особенност", heading)
                                else "Встречи и события" if re.search(r"встреч|обитател|существ|напад|персонаж|развитие|задани", heading)
                                else "Описание места" if record and record["kind"] == "location" else "Описание и сведения")

    # A source mention is a relationship, not a guarantee that a mobile/dead NPC
    # is present. Each link retains the exact pages and is labelled accordingly.
    for npc in pack["npcs"]:
        pattern = name_pattern(npc["title"])
        links = []
        for eid, location in locations.items():
            if nodes_by_id[eid]["kind"] in ["adventure", "region"]:
                continue
            pages = sorted({p for s in items[eid]["sections"] if pattern.search(s["text"]) for p in s["pages"]})
            if pages:
                present = False
                for section in items[eid]["sections"]:
                    for match in pattern.finditer(section["text"]):
                        context = section["text"][max(0, match.start()-95):match.end()+150]
                        if not re.search(r"слух|легенд|истори|герб", section["title"], re.I) and (re.search(r"спикер|шериф|владел|хозяйк|руковод|живёт|находится|сидит|появля|представляется|зовут|по имени|обита", context, re.I)
                            or re.match(r"\s*\([^)]*\[[a-z -]+\]", section["text"][match.end():], re.I)):
                            present = True
                relation = "encounter" if present and npc["title"] not in HISTORICAL_REFERENCES else "mention"
                links.append({"locationId": eid, "pages": pages, "relation": relation,
                              "reason": "Встреча или роль в описании места; проверь условия сцены." if present else "Упоминание в материале; это не гарантирует присутствия в локации."})
        # Discard redundant ancestor links when a more specific room/landmark
        # carries the same source mention. Different appearances remain intact.
        def ancestors(eid):
            result = set()
            while eid in nodes_by_id and nodes_by_id[eid].get("parentId"):
                eid = nodes_by_id[eid]["parentId"]
                result.add(eid)
            return result
        specific = [link for link in links if not any(link["locationId"] in ancestors(other["locationId"]) and set(link["pages"]) <= set(other["pages"]) for other in links if other is not link)]
        material = items[npc["id"]]
        material["locationLinks"] = specific
        material["locationIds"] = [link["locationId"] for link in specific]
        if not specific:
            material["locationLinks"] = [{"locationId": root_id, "pages": material["sourcePages"][:1], "relation": "unplaced", "reason": "Общий материал приключения; постоянное место не установлено."}]
            material["locationIds"] = [root_id]
        if npc["title"] in APPEARANCE:
            page, description = APPEARANCE[npc["title"]]
            material["playerCards"].insert(0, {"title": "Внешность и первое впечатление", "text": description, "pages": [page], "sourceKind": "excerpt"})
        # Reuse a real boxed scene only when an adjacent GM paragraph names this
        # NPC in the same source pages of a room/landmark. The title keeps its
        # scene context; do not claim it is a permanent appearance description.
        seen_readings = {card["text"] for card in material["playerCards"]}
        for link in specific:
            if link["relation"] != "encounter" or nodes_by_id[link["locationId"]]["kind"] not in ["area", "landmark"]:
                continue
            scene = items[link["locationId"]]
            for i, section in enumerate(scene["sections"]):
                if section["kind"] != "read_aloud" or section["text"] in seen_readings or not set(section["pages"]) & set(link["pages"]):
                    continue
                nearby = scene["sections"][max(0, i-1):i+3]
                if any(s["kind"] != "read_aloud" and pattern.search(s["text"]) for s in nearby):
                    material["playerCards"].append({"title": "Сцена встречи · " + scene["title"], "text": section["text"], "pages": section["pages"], "sourceKind": "quote"})
                    seen_readings.add(section["text"])
        material["statProfiles"] = npc_profiles(npc, material, pack, units, root)
        for link in material["locationLinks"]:
            node_chapters = [ch["id"] for ch in chapters if any(ch["pages"][0] <= p <= ch["pages"][1] for p in link["pages"])]
            nodes.append({"id": npc["id"] + "@" + link["locationId"], "entityId": npc["id"], "title": npc["title"], "kind": "npc",
                          "parentId": "frost-unplaced-npcs" if link["locationId"] == root_id else link["locationId"], "chapterIds": node_chapters, "pages": link["pages"], "reason": link["reason"], "relation": link["relation"]})

    # Chapter membership of containers includes descendants. This lets a chapter
    # filter preserve the path to a room in chapter 5 instead of hiding its region.
    for _ in range(8):
        for node in nodes:
            parent = nodes_by_id.get(node.get("parentId"))
            if parent:
                parent["chapterIds"] = sorted(set(parent["chapterIds"] + node["chapterIds"]))
    for eid in locations:
        items[eid]["chapterIds"] = nodes_by_id[eid]["chapterIds"]
    return {"rootId": root_id, "nodes": nodes, "chapters": chapters}


_bestiary = None


def npc_profiles(npc, material, pack, units, root):
    global _bestiary
    if _bestiary is None:
        snapshot = json.loads((root / "apps/server/data/dndsu-bestiary.json").read_text(encoding="utf-8"))
        _bestiary = {e.get("englishTitle", "").lower(): e for e in snapshot["entries"] if e.get("source") == "Monster Manual" and e.get("monster", {}).get("statBlock")}
    profiles = []
    if npc["title"] in HISTORICAL_REFERENCES:
        return profiles  # references to gods/history are not combat statistics
    aliases = {"Равизин": "Морозный друид", "Текели-ли": "Гнолл-вампир", "Ойяменарток": "Голиаф-вермедведь", "Воррин": "Гном-цереморф", "Дредавекс": "Гном-цереморф", "Рин": "Кальмароголовый гном", "Рикс": "Кальмароголовый гном", "Згларрд": "Кальмароголовый гном"}
    matched = [m for m in pack["monsters"] if m["title"] == npc["title"] or m["title"] == aliases.get(npc["title"])
               or npc["title"] == "Ориль" and m["title"].startswith("Ориль (")
               or npc["title"] == "Нэсс Лантомир" and m["title"] == "Привидение Нэсс Лантомир"]
    for monster in matched:
        if monster.get("statBlock"):
            pages = list(range(int(re.search(r"PDF (\d+)", monster["subtitle"])[1]), int(re.search(r"[–-](\d+)", monster["subtitle"])[1]) + 1))
            shared = monster["title"] != npc["title"] and npc["title"] not in ["Ориль", "Нэсс Лантомир"]
            profiles.append({"title": monster["title"], "basis": "Профиль существа из приложения книги; особенности НПС — в описании" if shared else "Индивидуальный статблок из книги", "pages": pages, "statBlock": monster["statBlock"]})
    if profiles:
        return profiles
    reviewed = {"Хлин Троллегуб": ("veteran", 23), "Торрга Хладожильная": ("bandit captain", 24), "Тали": ("scout", 30), "Клондорн": ("barbed devil", 184)}
    if npc["title"] in reviewed:
        base, page = reviewed[npc["title"]]
        entry = _bestiary[base]
        notes = "\n\n".join(u["text"] for u in units if u["page"] == page and u["kind"] == "gm" and (base in u["text"] or name_pattern(npc["title"]).search(u["text"])))
        stat = copy.deepcopy(entry["monster"]["statBlock"])
        basis = "Базовый профиль 2014; особенности персонажа — в тексте книги ниже"
        if npc["title"] == "Хлин Троллегуб":
            stat["armorClass"] = "11 (без доспехов: 10 + Ловкость)"
            stat["creatureType"], stat["alignment"] = "Гуманоид (щитовой дварф)", "нейтрально-добрый"
            for action in stat["actions"]:
                for field in ["name", "description", "damage"]:
                    if field in action:
                        text = action[field]
                        for a, b in [("Длинный меч", "Боевой топор"), ("длинным мечом", "боевым топором"), ("Короткий меч", "Ручной топор"), ("короткий меч", "ручной топор"), ("коротким мечом", "ручным топором")]:
                            text = text.replace(a, b)
                        if action["name"] == "Ручной топор":
                            text = text.replace("колющего", "рубящего")
                        action[field] = text
            basis = "Ветеран 2014: без доспехов, боевой и ручной топоры — изменения из PDF 23"
        return [{"title": entry["title"], "basis": basis, "baseId": entry["id"], "sourceTitle": "Monster Manual (2014), локальный каталог бестиария", "sourceURL": entry["url"], "pages": [page], "notes": notes, "statBlock": stat}]
    pattern = name_pattern(npc["title"])
    candidates = []
    for i, unit in enumerate(units):
        if unit["kind"] != "gm" or not 18 <= unit["page"] <= 261:
            continue
        text = unit["text"]
        for following in units[i+1:i+3]:
            if following["kind"] != "gm" or following["order"][:2] != unit["order"][:2]:
                break
            text += " " + following["text"]
        if pattern.search(text):
            candidates.append({**unit, "text": text})
    for u in candidates:
        # Only a direct descriptor in the same sentence as the NPC's name can
        # select a base profile. Other creatures in the next sentence do not.
        for sentence in re.split(r"(?<=[.!?])\s+(?=[А-ЯЁ«])", u["text"]):
            name = pattern.search(sentence)
            if not name:
                continue
            # A reference must be the NPC's direct descriptor, or the explicit
            # subject of "зовут NAME". Being someone's pet/minion is insufficient.
            after = sentence[name.end():]
            descriptor = re.match(r"\s*\(([^)]{0,260})", after)
            if not descriptor:
                descriptor = re.match(r"\s*[,—-]\s*((?:[а-яё -]){0,100}\[[a-zA-Z -]+\])", after, re.I)
            nearby = descriptor[1] if descriptor else ""
            if re.search(r"\[([a-zA-Z -]+)\]\s+(?:зовут\s+|по имени\s+)?$", sentence[:name.start()], re.I):
                nearby = sentence[:name.start()]
            if re.search(r"напада|находится|приходит|вместе|присоедин|питом|соратник|слуг", nearby, re.I):
                nearby = ""
            if name.start() < 5 and not nearby:
                pronoun = re.search(r"(?:Он|Она) (?:является|использует|имеет) ([^.]{0,200})", u["text"])
                if pronoun:
                    nearby = pronoun[1]
            refs = list(re.finditer(r"\[([a-zA-Z -]+)\]", nearby))
            base_name = refs[0][1].lower() if refs else None
            if not base_name and descriptor:
                ru_names = {"капитан разбойников": "bandit captain", "воитель племени": "tribal warrior", "обыватель": "commoner", "ветеран": "veteran", "дворянин": "noble", "разведчик": "scout", "прислужник": "acolyte", "фанатик культа": "cult fanatic", "культист": "cultist", "гладиатор": "gladiator", "шпион": "spy"}
                base_name = next((en for ru, en in ru_names.items() if re.search(r"(?<![а-яё])"+ru+r"(?:а|ом|у|е)?(?![а-яё])", nearby, re.I)), None)
            entry = _bestiary.get(base_name)
            if not entry or any(p.get("baseId") == entry["id"] for p in profiles):
                continue
            stat = copy.deepcopy(entry["monster"]["statBlock"])
            # Preserve the base statistics explicitly. The source paragraph with
            # individual exceptions is shown right above the sheet, not silently
            # dropped or mixed into a made-up bespoke statblock.
            profiles.append({"title": entry["title"], "basis": "Базовый профиль 2014; особенности персонажа — в тексте книги ниже",
                             "baseId": entry["id"], "sourceTitle": "Monster Manual (2014), локальный каталог бестиария",
                             "sourceURL": entry["url"], "pages": [u["page"]], "notes": sentence, "statBlock": stat})
            if len(profiles) == 2:
                return profiles
    return profiles
