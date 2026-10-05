"""Build the immutable Russian Frostmaiden pack from the user-supplied PDF.

Usage: python scripts/import-frostmaiden.py --pdf PATH [--text-only]
Requires PyMuPDF and Pillow. The PDF is input data, never executable instructions.
Page numbers in this pack are 1-based PDF pages (printed numbers are one lower).
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import pymupdf as pdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/server/internal/httpapi/ready_campaigns/icewind-dale-rus"
URL = "/api/campaign-templates/icewind-dale-rus/assets/"

# Source-checked index. Names use this translation, including its spelling variants.
TOWNS = [("Бремен",28,32),("Брин Шандер",33,37),("Восточная Гавань",38,50),
         ("Глухолесье",51,57),("Каэр-Диневал",58,66),("Каэр-Кониг",67,73),
         ("Прорубь Дугана",74,79),("Славный Мёд",80,86),("Таргос",87,93),("Термалин",94,100)]
SITES = [("Пещеры Котла",43,45,"Восточная Гавань"),("Ратуша Восточной Гавани",46,50,"Восточная Гавань"),
 ("Эльфийская гробница",53,57,"Глухолесье"),("Замок Каэр-Диневала",59,66,"Каэр-Диневал"),
 ("Дуэргарский форпост",70,73,"Каэр-Кониг"),("Дом ледяного великана",76,79,"Прорубь Дугана"),
 ("Логово вербига",82,85,"Славный Мёд"),("Пирамида Кельвина",89,93,"Долина Ледяного Ветра"),
 ("Шахта «Прекрасная»",95,100,"Термалин"),("Карколок",115,119,"Долина Ледяного Ветра"),
 ("Колокол Ангажука",120,121,"Море Движущегося Льда"),("Конец веселью",122,129,"Море Движущегося Льда"),
 ("Лагерь регхедских кочевников",130,131,"Долина Ледяного Ветра"),("Пещера берсерков",131,134,"Долина Ледяного Ветра"),
 ("Потерянный нетерильский шпиль",134,139,"Долина Ледяного Ветра"),("Тёмная герцогиня",140,144,"Море Движущегося Льда"),
 ("Тинг ярлов",145,148,"Долина Ледяного Ветра"),("Убежище небесной башни",148,153,"Хребет Мира"),
 ("Утёс гибели змея",153,157,"Хребет Мира"),("Хихикающий разлом",157,160,"Долина Ледяного Ветра"),
 ("Чёрная хижина",160,165,"Долина Ледяного Ветра"),("Эго возвышающееся",165,170,"Долина Ледяного Ветра"),
 ("Крепость Зардорока",174,186,"Хребет Мира"),("Остров Солнцестояния",199,214,"Море Движущегося Льда"),
 ("Гримсколла",204,214,"Остров Солнцестояния"),("Пещеры голода",217,230,"Ледник Регхед"),
 ("Итрин-некрополь",233,261,"Ледник Регхед"),("Шпиль Ириолартаса",248,255,"Итрин-некрополь")]
NPC_NAMES = """Хлин Троллегуб|Сефек Калтро|Торрга Хладожильная|Данника Серосталь|Эльва|Дорбалграф Сланцескал|Кора Мулфун|Хуарвар Мулфун|Гринск Берилбор|Тали|Равизин|Дувесса Шейн|Маркхэм Саусвел|Мишанн|Медяк Гвоздестук|Хрун|Корт|Станн|Даннет Вэйлин|Имдра Арлагат|Сайтон|Ринальдо|Мод Костемолка|Пруденс Таркволд|Нимси Хаддл|Совок|Краннок Сивер|Кадрот|Фел Супарра|Алассар Сулмандер|Туб|Кароу Салафан|Яджат|Хетил Аркоран|Алчность|Скельм|Тровус|Атенас Свифт|Яртра Фарзаш|Алли|Корри|Нильдар Губитель Солнца|Дурт Губитель Солнца|Бройк|Урфильд|Эдгра Дурмут|Финн Дежарр|Коран|Норсу|Гарагай|Силья|Кендрик Холмонос|Шандар Пена|Оливесса Унтапур|Феф Морин|Дуг|Йогобор|Нерт Максилданарр|Скат|Джестин Хьюн|Ма Браун|Гаррет Велрин|Киган Велрин|Мокинго|Перилия Рыбный Палец|Астрикс|Урас Мэстью|Марта Пескрик|Клайд|Трепан|Оар|Воло|Милбор Тафферак|Исельма Кровавоклык|Арвеячерас|Мелтхаранд|Ярб-Гнок|Спелликс Ромвод|Манафек|Снубсук|Ангажук|Восс Андертон|Марта Мартаннис|Влакс Бронэнвил|Вейлиш Гант|Дазон|Кринтас|Брекк|Регаръярва|Эрн Аканати|Рахи|Каниак|Оголай|Демелок|Яагрик|Кага|Зури|Стигиарус|Сикки-кри|Арук|Капанук|Ойяменарток|Чизка|Набира Моарскалл|Макридас|Воррин|Дредавекс|Рин|Рикс|Згларрд|Зардорок Губитель Солнца|Грандольфа Мазгардт|Дрек|Кроб|Плеврота|Ф’йорл|Клондорн|Нефрун|Валин Харпелл|Нэсс Лантомир|Профессор Скант|Сопо|Зеленнор|Эртгард|Искра|Укума|Вассавикен|Гунвальд Халрагсон|Свилбрехильда Фореннал|Ярунд Элькхардт|Мейенир|Бьёрнхильда Солвигсдоттир|Айсар Кроненстром|Эрикс Вокотот|Фааш|Гилдребан|Сиовакис|Айка|Текели-ли|Дракарет|Влагомир|Мелдирн|Тлакнар|Ильсабек|Хатовин|Ириолартас|Зерофон|тётушка Щепотка|тётушка Грабёж|тётушка Разбой|Скривинскрай|Вечность|Салдринар|Дриззт До’Урден""".split("|")
MONSTERS = [("Сефек Калтро",24,25),("Спелликс Ромвод",119,119),("Заключённый 237",129,129),("Грандольфа Мазгардт",177,177),
 ("Вербиг мародёр",269,269),("Вербиг скороход",270,270),("Алчность",271,272),("Валин Харпелл",273,273),
 ("Подобие Дазона",273,274),("Привидение Нэсс Лантомир",276,276),("Гнолл-вампир",277,278),
 ("Голиаф-воин",279,279),("Голиаф-вермедведь",280,280),("Горный козёл",281,281),
 ("Дуэргарский молотобоец",281,281),("Дуэргар повелитель разума",282,282),("Зардорок Губитель Солнца",283,283),
 ("Живая длань Бигби",284,284),("Живой клинок разрушения",284,285),("Живой демиплан",285,285),
 ("Заяц",285,285),("Малыш йети",286,286),("Кашалот",287,287),("Кобольд долины Ледяного Ветра",287,287),
 ("Кобольд-зомби долины Ледяного Ветра",288,288),("Кобольд-порождение вампира",289,289),
 ("Ледяной тролль",289,289),("Лиса",290,290),("Гальван-магин",291,291),("Гипнос-магин",292,292),("Демос-магин",292,292),
 ("Плюющийся мимик",293,293),("Могильный бурильщик",294,294),("Мозг в банке",295,295),
 ("Гигантский морж",295,295),("Морж",295,295),("Морозный друид",297,297),
 ("Ориль (первая форма)",298,299),("Ориль (вторая форма)",300,300),("Ориль (третья форма)",301,301),
 ("Айсар Кроненстром",302,302),("Ярунд Элькхардт",303,303),("Гунвальд Халрагсон",304,304),
 ("Бьёрнхильда Солвигсдоттир",305,305),("Гном-цереморф",306,306),("Кальмароголовый гном",306,306),
 ("Скальная кошка",307,308),("Скелет ледяного великана",308,308),("Снежный голем",308,308),
 ("Тупоголовая форель",309,309),("Тюлень",309,309),("Ходок холодного сияния",310,310),
 ("Чардалиновый берсерк",311,311),("Чардалиновый дракон",312,312),("Чвинга",313,314)]
NPC_NAMES += "Скрэмсакс|Гарн Молот|Эльза|Хруна|Корукс|Сторн|Мишан|Кори|Джестин Ханре|Мельтаронд|Харад|Ориль|Веветта|Виолен|Кульд|Бояр|Гру|Мик|Зарк|Мере|Фанга|Амонатор|Латандер|Левистус|Асмодей|Трим|Мистрил|Карсус|Векна".split("|")
ALIASES = {"Мишанн":"Мишан", "Корри":"Кори", "Джестин Хьюн":"Джестин Ханре", "Мелтхаранд":"Мельтаронд", "Кринтас":"Кринтаас", "Эрн Аканати":"Эрн", "Оголай":"Оголай", "Хрун":"Хруна", "Корт":"Корукс", "Станн":"Сторн"}
ALIASES.update({"Алли":"Элли", "Каниак":"Каниака"})
excluded_names = {"Ма Браун", "Трепан", "Оар", "Воло", "Веветта", "Виолен", "Кульд", "Бояр", "Гру", "Мик", "Зарк", "Фанга"}
NPC_NAMES = list(dict.fromkeys(ALIASES.get(n,n) for n in NPC_NAMES if n not in excluded_names))
MONSTERS += [("Северный олень",307,307),("Снежный совомед",307,307)]
MAPS = [("2.1","Долина Ледяного Ветра",114),("1.1","Бремен",29),("1.2","Брин Шандер",35),
 ("1.3","Восточная Гавань",40),("1.4","Пещеры Котла",44),("1.5","Ратуша Восточной Гавани",48),
 ("1.10","Глухолесье",52),("1.11","Эльфийская гробница",55),("1.6","Каэр-Диневал",59),
 ("1.7","Замок Каэр-Диневала",62),("1.8","Каэр-Кониг",68),("1.9","Дуэргарский форпост",72),
 ("1.12","Прорубь Дугана",75),("1.13","Дом ледяного великана",78),("1.14","Славный Мёд",81),
 ("1.15","Логово вербига",83),("1.16","Таргос",89),("1.17","Пирамида Кельвина",90),
 ("1.18","Термалин",95),("1.19","Шахта «Прекрасная»",98),("2.2","Карколок",118),
 ("2.3","Колокол Ангажука",120),("2.4","Конец веселью",126),("2.5","Лагерь регхедских кочевников",131),
 ("2.6","Пещера берсерков",133),("2.7","Потерянный нетерильский шпиль",136),("2.8","Тёмная герцогиня",141),
 ("2.9","Тинг ярлов",147),("2.10","Убежище небесной башни",149),("2.11","Утёс гибели змея",156),
 ("2.12","Хихикающий разлом",158),("2.13","Чёрная хижина",161),("2.14","Эго возвышающееся",169),
 ("3.1","Крепость Зардорока",176),("4.1","Маршрут полёта дракона",190),
 ("5.1","Остров Солнцестояния",200),("5.2","Гримсколла",206),("6.1","Пещеры голода",220),
 ("7.1","Итрин-некрополь, карта для игроков",234),("7.2","Итрин-некрополь",237),("7.3","Шпиль Ириолартаса",248)]


def clean(t):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", t).replace("\u00a0", " ").strip()


def run(args):
    doc = pdf.open(args.pdf)
    assert len(doc) == 323, "This index is for the supplied 323-page Russian edition"
    OUT.mkdir(parents=True, exist_ok=True)
    lines, pages, headings = [], [], []
    for p in doc:
        ls = []
        for b in p.get_text("dict", flags=pdf.TEXTFLAGS_DICT & ~pdf.TEXT_PRESERVE_IMAGES)["blocks"]:
            for l in b.get("lines", []):
                t = clean("".join(s["text"] for s in l["spans"]))
                if not t:
                    continue
                box = l["bbox"]
                if box[1] > 797:  # running footer, retained in page facsimile
                    continue
                order = (p.number, 0 if box[0] < 295 else 1, round(box[1], 1), round(box[0], 1))
                if any(s["font"] == "AlegreyaSC-Regular" and s["size"] >= 12 for s in l["spans"]):
                    headings.append({"title":t, "page":p.number+1, "order":order, "size":max(s["size"] for s in l["spans"]), "bbox":box})
                ls.append((order, t))
        ls = sorted(set(ls))  # drop duplicate overprinted town headings
        lines.extend(ls)
        pages.append("\n".join(t for _, t in ls))
    headings = sorted({h["order"]:h for h in headings}.values(), key=lambda h:h["order"])
    joined=[]
    for h in headings:
        if joined and h["page"]==joined[-1]["page"] and h["size"]==joined[-1]["size"] and abs(h["bbox"][0]-joined[-1]["bbox"][0])<2 and 0<h["bbox"][1]-joined[-1]["bbox"][1]<=h["size"]+2:
            joined[-1]["title"] += " "+h["title"]
            joined[-1]["bbox"] = h["bbox"]
        else: joined.append(h)
    headings=joined
    by_title, entities = {}, {k:[] for k in ["locations","npcs","monsters","quests","lore"]}

    heading_orders = {h["order"] for h in headings}
    def format_lines(rows):
        paragraphs, previous = [], None
        for order, text in rows:
            new = previous is None or order[:2] != previous[:2] or order[2]-previous[2]>15 or order in heading_orders or previous in heading_orders
            if new:
                paragraphs.append(text)
            elif re.search(r"[а-яё]-$",paragraphs[-1]) and re.match(r"[а-яё]",text):
                paragraphs[-1] = paragraphs[-1][:-1]+text
            else:
                paragraphs[-1] += " "+text
            previous = order
        return "\n\n".join(paragraphs)

    def source_text(start, end):
        return "\n\n".join(f"Страница PDF {n} (книга: {n-1})\n{format_lines([(o,t) for o,t in lines if o[0]==n-1])}" for n in range(start,end+1))

    def entity(kind, title, start, end, body=None, category="", parent=""):
        eid = f"frost-{kind}-{len(entities[kind]):03}"
        e = {"id":eid,"revision":1,"kind":{"locations":"location","npcs":"npc","monsters":"monster","quests":"quest","lore":"lore"}[kind],
             "title":title,"subtitle":f"PDF {start}–{end} · книга {start-1}–{end-1}",
             "summary":f"Материал приключения «Иней Морозной Девы». Страницы PDF {start}–{end}.",
             "content":body if body is not None else source_text(start,end),
             "tags":["Готовые Кампании","Иней Морозной Девы"],"quickFacts":[{"label":"Источник","value":f"PDF {start}–{end}"}],
             "related":[],"gallery":[{"title":f"Страница PDF {n} · книга {n-1}","url":URL+f"pages/{n:03}.webp","caption":"Исходная страница: таблицы, иллюстрации и полный текст для мастера."} for n in range(start,end+1)],
             "visibility":"gm_only"}
        if category:
            e["tags"].append(category)
            e["quickFacts"].append({"label":"Тип материала","value":category})
            e["category"] = ("History" if kind=="lore" else "Region" if category=="Регион" else "City" if category=="Город" else "Dungeon" if category in ["Место приключения","Область карты"] else "POI")
        if parent: e["_parent"] = parent
        if kind=="locations": e.update(region="Долина Ледяного Ветра",danger="Tense")
        if kind=="npcs": e.update(role="Персонаж приключения", status="Unknown", importance="Background")
        if kind=="quests": e.update(status="active",urgency="Medium")
        entities[kind].append(e)
        by_title.setdefault(title,e)
        e["_pages"]=[start,end]
        return e

    # Every source page is included in these sequential source chapters, even covers,
    # blank pages, translator credits, tables and player handouts.
    chapters=[("Обложка, перевод и оглавление",1,5),("Добро пожаловать на Крайний Север",6,17),
      ("Глава 1: Десять Городов",18,101),("Глава 2: Долина Ледяного Ветра",102,171),
      ("Глава 3: Губители Солнца",172,187),("Глава 4: Свет разрушения",188,197),
      ("Глава 5: Обитель Ориль",198,215),("Глава 6: Пещеры голода",216,231),
      ("Глава 7: Погибель Итрина",232,261),("Эпилог",262,263),
      ("Приложение A: Безделушки",264,264),("Приложение B: Тайны персонажей",265,268),
      ("Приложение C: Чудовища",269,314),("Приложение D: Магия",315,319),
      ("Приложение E: Ода Морозной Деве",320,321),("Послесловие",322,323)]
    for title,a,b in chapters: entity("lore",title,a,b,category="Книга приключения")
    for title,a,b in [("Долина Ледяного Ветра",102,114),("Десять Городов",18,23),("Море Движущегося Льда",198,199),("Хребет Мира",11,14),("Ледник Регхед",216,217)]:
        entity("locations",title,a,b,category="Регион")
    for title,a,b in TOWNS: entity("locations",title,a,b,category="Город",parent="Десять Городов")
    for title,a,b,parent in SITES: entity("locations",title,a,b,category="Место приключения",parent=parent)

    # Keyed rooms are extracted between actual heading positions, not page-level
    # bookmarks. Both Cyrillic and Latin room codes and Y19a..r are preserved.
    room_pattern = re.compile(r"^[A-ZА-ЯЁ]{1,2}\d+(?:[a-zа-я]|[–-][A-ZА-ЯЁ]?\d+)?[. :]",re.I)
    for i,h in enumerate(headings):
        if not (18<=h["page"]<=261 and room_pattern.match(h["title"])): continue
        nxt = headings[i+1]["order"] if i+1<len(headings) else (323,9,9999,9999)
        body="\n".join(t for order,t in lines if h["order"]<=order<nxt)
        title=h["title"]
        parent=next((s[0] for s in reversed(SITES) if s[1]<=h["page"]<=s[2]),"Долина Ледяного Ветра")
        entity("locations",title,h["page"],min(nxt[0]+1,h["page"]+3),body=body,category="Область карты",parent=parent)

    # Town businesses/landmarks are the consecutive 13pt subheadings under
    # 'Места в ...'; omit rule and quest subheadings.
    landmarks=[]
    for town,a,b in TOWNS:
        major_quest=next((p for level,t,p in doc.get_toc() if level==3 and a<=p<=b),b)
        for i,h in enumerate(headings):
            if a<=h["page"]<=major_quest and h["size"]==13 and not room_pattern.match(h["title"]):
                if any(x in h["title"].lower() for x in ["путешеств","жертв","задани","снаряж","сокровищ","появление","потеря","спикер","двух словах"]): continue
                if h["title"] in by_title: continue
                end=headings[i+1]["order"] if i+1<len(headings) else (b,9,999,999)
                body=format_lines([(order,t) for order,t in lines if h["order"]<=order<end])
                if len(body)>100:
                    e=entity("locations",h["title"],h["page"],min(end[0]+1,b),body=body,category="Место в городе",parent=town)
                    landmarks.append(e)

    quest_titles={t for level,t,p in doc.get_toc() if level==3 and 23<=p<=100}
    quest_titles.update(["Начальное задание: Хладнокровный убийца","Начальное задание: Духи природы"])
    toc=sorted(set((p,level,t.strip()) for level,t,p in doc.get_toc()))
    for n,(p,level,title) in enumerate(toc):
        if title not in quest_titles: continue
        end=next((q-1 for q,lev,t in toc[n+1:] if q>p and lev<=level),p)
        e=entity("quests",title,p,end,category="Задание")
        e["_location"]=next((t for t,a,b in TOWNS if a<=p<=b),"Десять Городов")
    for title,a,b,parent in SITES:
        if 115<=a<=170:
            e=entity("quests",f"Исследование: {title}",a,b,category="Исследование")
            e["_location"]=title
    for title,a,b,parent in [("Остановить Зардорока",172,187,"Крепость Зардорока"),("Защитить Десять Городов",188,193,"Десять Городов"),
      ("Задание Валин",194,197,"Десять Городов"),("Получить Белый завет",198,215,"Гримсколла"),
      ("Открыть путь сквозь ледник",216,231,"Пещеры голода"),("Тайны и судьба Итрина",232,261,"Итрин-некрополь")]:
        e=entity("quests",title,a,b,category="Основной сюжет"); e["_location"]=parent

    # Name cards quote all matching source paragraphs, with all source page images.
    # No invented dialogue, relationships, loot or rules are added.
    merged=[re.sub(r"(?<=[а-яё])-\n(?=[а-яё])","",t) for t in pages]
    searchable=[re.sub(r"\s+"," ",t) for t in merged]
    absent=[]
    for name in NPC_NAMES:
        needle=ALIASES.get(name,name)
        # Russian proper names may appear only in an oblique case (e.g. Клайдом).
        suffix = r"(?:а|у|ом|е|ы|ов)?" if needle[-1].lower() not in "аеёиоуыэюяьй" else ""
        pattern=re.compile(r"(?<![а-яё])"+re.escape(needle)+suffix+r"(?![а-яё])",re.I)
        found=[i+1 for i,t in enumerate(searchable) if i+1 not in [1,2,3,4,13] and pattern.search(t)]
        if not found:
            absent.append(name); continue
        snippets=[]
        for n in found:
            ls=merged[n-1].splitlines()
            positions=[j for j in range(len(ls)) if pattern.search(" ".join(ls[j:j+3]))]
            selected=set(k for j in positions for k in range(max(0,j-5),min(len(ls),j+18)))
            snippets.append(f"Страница PDF {n} (книга {n-1})\n"+"\n".join(ls[k] for k in sorted(selected)))
        e=entity("npcs",name,min(found),max(found),body="\n\n".join(snippets))
        e["gallery"]=[{"title":f"Источник: PDF {n}","url":URL+f"pages/{n:03}.webp"} for n in found]
        e["_location"]=next((title for title,a,b,parent in reversed(SITES) if a<=found[0]<=b),
                            next((title for title,a,b in TOWNS if a<=found[0]<=b),"Долина Ледяного Ветра"))

    for name,a,b in MONSTERS:
        e=entity("monsters",name,a,b,category="Существа приключения")
        # Extract the basic combat fields from the statblock column only. The
        # source page remains authoritative for traits, spells and exceptions.
        page=doc[a-1]
        blocks=page.get_text("blocks")
        candidates=[b for b in blocks if isinstance(b[4],str) and "Класс Доспеха" in b[4]]
        # There may be two statblocks on a page: locate the title above each.
        target=None
        for i,h in enumerate(headings):
            if h["page"]!=a or not 14<=h["size"]<=16 or h["title"].split(" [")[0].strip()!=name: continue
            nxt=next((other["order"] for other in headings[i+1:] if other["size"]>=15), (b,9,9999,9999))
            target=re.sub(r"\s+"," "," ".join(t for order,t in lines if h["order"]<=order<nxt))
            if "Класс Доспеха" in target: break
            target=None
        if target:
            match=re.search(r"Класс Доспеха\s+(.+?) Хиты\s+(.+?) Скорость\s+(.+?)(?= СИЛ)",target)
            if match:
                ac,hp,speed=match.groups()
                scores=re.search(r"СИЛ ЛОВ ТЕЛ ИНТ МДР ХАР ((?:\d+\s*\([+−–-]?\d+\)\s*){6})",target)
                if not scores: raise ValueError(f"Cannot extract ability scores for {name}")
                abilities=[int(n) for n in re.findall(r"(\d+)\s*\(",scores[1])]
                challenge=re.search(r"Опасность\s+([^А-Я]+)",target)
                descriptor=re.search(r"(?:Средний|Маленький|Крошечный|Большой|Огромный|Громадный) .+?(?= Класс Доспеха)",target)
                descriptor=descriptor[0] if descriptor else "См. источник"
                actions=target.split("Действия",1)[1] if "Действия" in target else "Действия указаны в исходной странице."
                e["statBlock"]={"size":descriptor.split(" ",1)[0],"creatureType":descriptor.split(",")[0],"alignment":descriptor.split(",")[-1].strip(),
                  "armorClass":ac,"hitPoints":hp,"speed":speed,"abilityScores":dict(zip(["str","dex","con","int","wis","cha"],abilities)),
                  "challenge":challenge[1].strip() if challenge else "","traits":[{"name":"Статблок из источника","description":target}],"actions":[{"name":"Действия из источника","description":actions}]}
    for e in entities["npcs"]:
        monster=next((m for m in entities["monsters"] if m["title"]==e["title"] and "statBlock" in m),None)
        if monster: e["statBlock"]=monster["statBlock"]

    # All non-bookmark spell/item/secret headings get independent searchable cards.
    for i,h in enumerate(headings):
        if not (265<=h["page"]<=268 or 315<=h["page"]<=319): continue
        if h["title"] in by_title or h["size"]>=20: continue
        end=headings[i+1]["order"] if i+1<len(headings) else (319,9,999,999)
        body=format_lines([(order,t) for order,t in lines if h["order"]<=order<end])
        if len(body)>80: entity("lore",h["title"],h["page"],min(end[0]+1,319),body=body,category="Тайны, предметы и магия")
    for title,a,b in [("Выживание и путешествия",11,14),("Термины и имена",13,13),("Создание персонажей",14,16),
                       ("Слухи и развитие в Десяти Городах",18,23),("Столкновения в дикой местности",106,114),
                       ("Ритуал Тайной Восьмёрки",235,259),("Концовки приключения",262,263)]:
        entity("lore",title,a,b,category="Памятка мастеру")

    maps=[]
    for code,title,n in MAPS:
        filename=code.replace(".","-")+".webp"
        page=doc[n-1]
        if n==5:
            rect=page.rect
        else:
            candidates=[pdf.Rect(i["bbox"]) for i in page.get_image_info() if i["width"]!=1256 and pdf.Rect(i["bbox"]).width>200 and pdf.Rect(i["bbox"]).height>100]
            rect=max(candidates,key=lambda r:r.width*r.height)
            rect=rect & page.rect
        if not args.text_only or not (OUT/"maps"/filename).exists():
            (OUT/"maps").mkdir(exist_ok=True)
            scale=3
            pix=page.get_pixmap(matrix=pdf.Matrix(scale,scale),clip=rect,alpha=False)
            im=Image.frombytes("RGB",[pix.width,pix.height],pix.samples)
            if n==237:  # restore the two-page map, including all numbered overlays
                right=doc[237].get_pixmap(matrix=pdf.Matrix(scale,scale),clip=pdf.Rect(0,50,569,755),alpha=False)
                joined=Image.new("RGB",(im.width+right.width,max(im.height,right.height)),"white")
                joined.paste(im,(0,0)); joined.paste(Image.frombytes("RGB",[right.width,right.height],right.samples),(im.width,0)); im=joined
            im.save(OUT/"maps"/filename,"WEBP",quality=94,method=6)
            width,height=im.size
        else:
            with Image.open(OUT/"maps"/filename) as im: width,height=im.size
        mapdoc={"id":"frost-map-"+code,"title":title,"prompt":f"Карта из исходного PDF, страница {n} (книга {n-1}). Подписи являются частью оригинала.",
                "imageUrl":URL+"maps/"+filename,"labels":[],"width":width,"height":height,"revision":0,"provider":"source-pdf","createdAt":"2026-10-05T00:00:00Z",
                "scale":"region" if code=="2.1" else "city" if title in [t[0] for t in TOWNS] else "site"}
        loc=by_title.get(title.replace(", карта для игроков",""))
        if loc:
            mapdoc["context"]={"includeCampaign":False,"locationId":loc["id"]}
            loc["gallery"].insert(0,{"title":title,"url":mapdoc["imageUrl"],"caption":mapdoc["prompt"]})
            loc["art"]={"url":mapdoc["imageUrl"],"alt":title}
        maps.append(mapdoc)
    for es in entities.values():
        for e in es:
            for field,temp in [("parentId","_parent"),("locationId","_location")]:
                name=e.pop(temp,"")
                if name in by_title:
                    e[field]=by_title[name]["id"]
                    e["related"].append({"id":by_title[name]["id"],"label":name,"kind":by_title[name]["kind"],"reason":"Место действия или родительская локация"})
            e.pop("_pages",None)
    shops=[]
    for e in landmarks:
        if any(t in e["title"].lower() for t in ["труун","каэр","храм","дом утреннего","паром","площадь","лиса и чвинга","восточная сторона"]): continue
        shops.append({"id":"frost-shop-"+str(len(shops)),"name":e["title"],"locationId":e.get("parentId",""),
                      "description":e["content"],"gmNotes":e["subtitle"],"inventory":[],"gallery":e["gallery"]})
    events=[]
    for title,a,b,loc,kind in [("Встреча с Хлин Троллегуб",23,24,"Десять Городов","social"),
      ("Поиск духов природы",26,27,"Десять Городов","oddity"),("Ограбление ратуши",46,47,"Восточная Гавань","heist"),
      ("Запуск чардалинового дракона",172,173,"Крепость Зардорока","danger"),("Ярость дракона",189,193,"Десять Городов","combat"),
      ("Предложение Валин",194,197,"Десять Городов","social"),("Испытание жестокости",210,210,"Гримсколла","danger"),
      ("Испытание стойкости",210,211,"Гримсколла","danger"),("Испытание изоляции",211,212,"Гримсколла","danger"),
      ("Испытание сохранения",212,213,"Гримсколла","danger"),("Открытие ледника",216,217,"Ледник Регхед","oddity"),
      ("Разборки с Волшебным братством",260,260,"Итрин-некрополь","social"),("Гнев Ориль",261,261,"Итрин-некрополь","combat"),
      ("Эпилог и последствия",262,263,"Десять Городов","social")]:
        events.append({"id":"frost-event-"+str(len(events)),"revision":1,"title":title,"date":"По сюжету приключения",
                       "summary":f"Сцена приключения · PDF {a}–{b}","type":kind,"locationId":by_title[loc]["id"],"locationLabel":loc,
                       "sceneText":source_text(a,b),"dialogueBranches":[],"loot":[],"tags":["Готовые Кампании","gm-event"],"origin":"manual"})
    pack={"id":"icewind-dale-rus","revision":1,"title":"Долина Ледяного Ветра: Иней Морозной Девы",
          "system":"D&D 5e (2014)","settingName":"Забытые Королевства · Долина Ледяного Ветра",
          "inWorldDate":"Начало приключения · вечная зима",
          "summary":"Приключение для персонажей 1–11 уровней. Десять Городов, вечная зима Ориль, чардалиновый дракон и тайны Итрина. Готовая кампания: материалы защищены от изменений; мастер ведёт своё прохождение.",
          **entities,"worldMaps":maps,"players":[],"events":events,"shops":shops,"sessionPrep":[],"combatPlaylist":[]}
    (OUT/"campaign.json").write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding="utf-8")
    if not args.text_only:
        (OUT/"pages").mkdir(exist_ok=True)
        for p in doc:
            pix=p.get_pixmap(matrix=pdf.Matrix(2,2),alpha=False)
            Image.frombytes("RGB",[pix.width,pix.height],pix.samples).save(OUT/"pages"/f"{p.number+1:03}.webp","WEBP",quality=90,method=4)
            if (p.number+1)%25==0: print(f"Rendered {p.number+1}/323 pages",flush=True)
    manifest={"id":"icewind-dale-rus","version":1,"sourceFile":Path(args.pdf).name,
              "sourceSHA256":hashlib.sha256(Path(args.pdf).read_bytes()).hexdigest(),"sourcePages":len(doc),
              "chapters":[{"title":t,"firstPage":a,"lastPage":b} for t,a,b in chapters],
              "counts":{**{k:len(v) for k,v in entities.items()},"maps":len(maps),"events":len(events),"shops":len(shops)},
              "indexedNPCNames":len(NPC_NAMES)-len(absent),"unmatchedNPCNames":absent,
              "notes":["All 323 source pages have full-page facsimiles; printed page = PDF page - 1.",
                       "Card text is extracted source text. Page facsimiles remain authoritative for columns and tables.",
                       "Map 7.2 is joined from PDF pages 237 and 238, preserving labels.",
                       "The regional map 2.1 is extracted from PDF page 114; no separate folding poster is supplied.",
                       "Core-rule monster references have their source descriptions, not invented statblocks."]}
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(manifest["counts"]),"unmatched NPC seeds:",absent,flush=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--pdf",required=True)
    parser.add_argument("--text-only",action="store_true")
    run(parser.parse_args())
