import type { CharacterDraft } from "./rules";
export type EquipmentItem = NonNullable<CharacterDraft["equipment"]>[number];
// Starting packages: SRD 5.1 / 5.2.1, CC BY 4.0. See SOURCES.md.
const simpleMelee = [
  "Дубинка",
  "Кинжал",
  "Палица",
  "Ручной топор",
  "Метательное копьё",
  "Лёгкий молот",
  "Булава",
  "Боевой посох",
  "Серп",
  "Копьё",
];
const simple = [
  ...simpleMelee,
  "Лёгкий арбалет",
  "Дротик",
  "Короткий лук",
  "Праща",
];
const martialMelee = [
  "Боевой топор",
  "Цеп",
  "Глефа",
  "Секира",
  "Двуручный меч",
  "Алебарда",
  "Длинное копьё",
  "Длинный меч",
  "Молот",
  "Моргенштерн",
  "Пика",
  "Рапира",
  "Скимитар",
  "Короткий меч",
  "Боевой молот",
  "Боевая кирка",
  "Трезубец",
  "Кнут",
];
const martial = [
  ...martialMelee,
  "Длинный лук",
  "Ручной арбалет",
  "Тяжёлый арбалет",
  "Духовая трубка",
  "Сеть",
];
const weapons = new Set([...simple, ...martial]);
export const weaponEnglish: Record<string, string> = Object.fromEntries(
  [...simple, ...martial].map((name, i) => [
    name,
    [
      "Club",
      "Dagger",
      "Greatclub",
      "Handaxe",
      "Javelin",
      "Light Hammer",
      "Mace",
      "Quarterstaff",
      "Sickle",
      "Spear",
      "Light Crossbow",
      "Dart",
      "Shortbow",
      "Sling",
      "Battleaxe",
      "Flail",
      "Glaive",
      "Greataxe",
      "Greatsword",
      "Halberd",
      "Lance",
      "Longsword",
      "Maul",
      "Morningstar",
      "Pike",
      "Rapier",
      "Scimitar",
      "Shortsword",
      "Warhammer",
      "War Pick",
      "Trident",
      "Whip",
      "Longbow",
      "Hand Crossbow",
      "Heavy Crossbow",
      "Blowgun",
      "Net",
    ][i],
  ]),
);
export function equipmentItems(list: string): EquipmentItem[] {
  return list
    .split(";")
    .filter(Boolean)
    .map((part) => {
      const [name, count] = part.split("×");
      return {
        name,
        quantity: Number(count || 1),
        type: weapons.has(name) ? "weapon" : "equipment",
      };
    });
}
export interface StartingPackage {
  items: string;
  gold: number;
  choices?: string[][];
}
const pack = (
  items: string,
  gold = 0,
  choices?: string[][],
): StartingPackage => ({ items, gold, choices });
const travel = ["Набор исследователя подземелий", "Набор путешественника"];
const focus = ["Мешочек с компонентами", "Магическая фокусировка (кристалл)"];
const ranged = ["Лёгкий арбалет;Болты×20", ...simple];
const instruments = [
  "Лютня",
  "Флейта",
  "Барабан",
  "Лира",
  "Виола",
  "Волынка",
  "Рожок",
  "Свирель",
  "Шалмей",
  "Цимбалы",
];
const tools = [
  "Инструменты кузнеца",
  "Инструменты плотника",
  "Инструменты кожевника",
  "Инструменты гончара",
  "Инструменты ткача",
  "Принадлежности каллиграфа",
  "Инструменты резчика по дереву",
];
export const CLASS_PACKAGES_2014: Record<string, StartingPackage> = {
  barbarian: pack("Набор путешественника;Метательное копьё×4", 0, [
    martialMelee,
    ["Ручной топор×2", ...simple],
  ]),
  bard: pack("Кожаный доспех;Кинжал", 0, [
    ["Рапира", "Длинный меч", ...simple],
    ["Набор дипломата", "Набор артиста"],
    instruments,
  ]),
  cleric: pack("Щит;Священный символ", 0, [
    ["Булава", "Боевой молот"],
    ["Чешуйчатый доспех", "Кожаный доспех", "Кольчуга"],
    ranged,
    ["Набор священника", "Набор путешественника"],
  ]),
  druid: pack("Кожаный доспех;Набор путешественника;Фокусировка друида", 0, [
    ["Деревянный щит", ...simple],
    ["Скимитар", ...simpleMelee],
  ]),
  fighter: pack("", 0, [
    ["Кольчуга", "Кожаный доспех;Длинный лук;Стрелы×20"],
    martial,
    ["Щит", ...martial],
    ["Лёгкий арбалет;Болты×20", "Ручной топор×2"],
    travel,
  ]),
  monk: pack("Дротик×10", 0, [["Короткий меч", ...simple], travel]),
  paladin: pack("Кольчуга;Священный символ", 0, [
    martial,
    ["Щит", ...martial],
    ["Метательное копьё×5", ...simpleMelee],
    ["Набор священника", "Набор путешественника"],
  ]),
  ranger: pack("Длинный лук;Колчан;Стрелы×20", 0, [
    ["Чешуйчатый доспех", "Кожаный доспех"],
    ["Короткий меч×2", ...simpleMelee.map((name) => `${name}×2`)],
    travel,
  ]),
  rogue: pack("Кожаный доспех;Кинжал×2;Воровские инструменты", 0, [
    ["Рапира", "Короткий меч"],
    ["Короткий лук;Колчан;Стрелы×20", "Короткий меч"],
    ["Набор взломщика", ...travel],
  ]),
  sorcerer: pack("Кинжал×2", 0, [ranged, focus, travel]),
  warlock: pack("Кожаный доспех;Кинжал×2", 0, [
    ranged,
    focus,
    ["Набор учёного", "Набор исследователя подземелий"],
    simple,
  ]),
  wizard: pack("Книга заклинаний", 0, [
    ["Боевой посох", "Кинжал"],
    focus,
    ["Набор учёного", "Набор путешественника"],
  ]),
};
export const CLASS_PACKAGES_2024: Record<string, StartingPackage[]> = {
  barbarian: [pack("Секира;Ручной топор×4;Набор путешественника", 15)],
  bard: [pack("Кожаный доспех;Кинжал×2;Набор артиста", 19, [instruments])],
  cleric: [
    pack("Кольчужная рубаха;Щит;Булава;Священный символ;Набор священника", 7),
  ],
  druid: [
    pack(
      "Кожаный доспех;Щит;Серп;Боевой посох;Набор путешественника;Набор травника",
      9,
    ),
  ],
  fighter: [
    pack(
      "Кольчуга;Двуручный меч;Цеп;Метательное копьё×8;Набор исследователя подземелий",
      4,
    ),
    pack(
      "Проклёпанный кожаный доспех;Скимитар;Короткий меч;Длинный лук;Стрелы×20;Колчан;Набор исследователя подземелий",
      11,
    ),
  ],
  monk: [
    pack("Копьё;Кинжал×5;Набор путешественника", 11, [
      [...tools, ...instruments],
    ]),
  ],
  paladin: [
    pack(
      "Кольчуга;Щит;Длинный меч;Метательное копьё×6;Священный символ;Набор священника",
      9,
    ),
  ],
  ranger: [
    pack(
      "Проклёпанный кожаный доспех;Скимитар;Короткий меч;Длинный лук;Стрелы×20;Колчан;Фокусировка друида (омела);Набор путешественника",
      7,
    ),
  ],
  rogue: [
    pack(
      "Кожаный доспех;Кинжал×2;Короткий меч;Короткий лук;Стрелы×20;Колчан;Воровские инструменты;Набор взломщика",
      8,
    ),
  ],
  sorcerer: [
    pack(
      "Копьё;Кинжал×2;Магическая фокусировка (кристалл);Набор исследователя подземелий",
      28,
    ),
  ],
  warlock: [
    pack(
      "Кожаный доспех;Серп;Кинжал×2;Магическая фокусировка (сфера);Книга оккультных знаний;Набор учёного",
      15,
    ),
  ],
  wizard: [
    pack("Кинжал×2;Боевой посох;Мантия;Книга заклинаний;Набор учёного", 5),
  ],
};
export const CLASS_GOLD_2024: Record<string, number> = {
  barbarian: 75,
  bard: 90,
  cleric: 110,
  druid: 50,
  fighter: 155,
  monk: 50,
  paladin: 150,
  ranger: 150,
  rogue: 100,
  sorcerer: 50,
  warlock: 100,
  wizard: 55,
};
// These four dice formulae are present in the publicly available Basic Rules 2014.
export const GOLD_DICE_2014: Record<string, number> = {
  cleric: 5,
  fighter: 5,
  rogue: 4,
  wizard: 4,
};
export const BACKGROUND_PACKAGES: Record<
  string,
  Record<string, StartingPackage>
> = {
  "2014": {
    acolyte: pack(
      "Священный символ;Молитвенник;Палочка благовоний×5;Облачение;Обычная одежда;Кошель",
      15,
    ),
    "criminal-2014": pack("Ломик;Тёмная обычная одежда с капюшоном;Кошель", 15),
    "folk-hero": pack("Лопата;Железный котелок;Обычная одежда;Кошель", 10, [
      tools,
    ]),
    noble: pack(
      "Дорогая одежда;Перстень-печатка;Свиток родословной;Кошель",
      25,
    ),
    "sage-2014": pack(
      "Чёрные чернила;Писчее перо;Маленький нож;Письмо коллеги;Обычная одежда;Кошель",
      10,
    ),
    "soldier-2014": pack("Знак звания;Трофей врага;Обычная одежда;Кошель", 10, [
      ["Игральные кости", "Игральные карты"],
    ]),
  },
  "2024": {
    acolyte: pack(
      "Принадлежности каллиграфа;Молитвенник;Священный символ;Пергамент×10;Мантия",
      8,
    ),
    criminal: pack(
      "Кинжал×2;Воровские инструменты;Ломик;Кошель×2;Дорожная одежда",
      16,
    ),
    sage: pack(
      "Боевой посох;Принадлежности каллиграфа;Книга истории;Пергамент×8;Мантия",
      8,
    ),
    soldier: pack(
      "Копьё;Короткий лук;Стрелы×20;Набор лекаря;Колчан;Дорожная одежда",
      14,
      [
        [
          "Игральные кости",
          "Игральные карты",
          "Драконьи шахматы",
          "Ставка трёх драконов",
        ],
      ],
    ),
  },
};
export function resolvePackage(
  value: StartingPackage,
  choices: string[] = [],
): EquipmentItem[] {
  return equipmentItems(
    [
      value.items,
      ...(value.choices || []).map((options, i) =>
        options.includes(choices[i]) ? choices[i] : options[0],
      ),
    ].join(";"),
  );
}
export function mergeEquipment(items: EquipmentItem[]): EquipmentItem[] {
  const result: EquipmentItem[] = [];
  for (const item of items) {
    const existing = result.find(
      (v) => v.name === item.name && v.type === item.type,
    );
    if (existing) existing.quantity += item.quantity;
    else result.push({ ...item });
  }
  return result;
}
export const EQUIPMENT_NAMES = Array.from(
  new Set([
    ...simple,
    ...martial,
    ...Object.values(CLASS_PACKAGES_2024)
      .flat()
      .flatMap((p) => equipmentItems(p.items).map((i) => i.name)),
    ...instruments,
    ...tools,
  ]),
).sort((a, b) => a.localeCompare(b, "ru"));

// Canonical compendium aliases remain metadata; visible inventory/PDF names stay Russian.
export const equipmentEnglish: Record<string, string> = {
  ...weaponEnglish,
  "Кожаный доспех": "Leather Armor",
  Кольчуга: "Chain Mail",
  "Кольчужная рубаха": "Chain Shirt",
  "Проклёпанный кожаный доспех": "Studded Leather Armor",
  "Чешуйчатый доспех": "Scale Mail",
  Щит: "Shield",
  "Деревянный щит": "Shield",
  Стрелы: "Arrow",
  Болты: "Crossbow Bolt",
  Колчан: "Quiver",
  "Набор путешественника": "Explorer’s Pack",
  "Набор исследователя подземелий": "Dungeoneer’s Pack",
  "Набор учёного": "Scholar’s Pack",
  "Набор взломщика": "Burglar’s Pack",
  "Набор священника": "Priest’s Pack",
  "Набор артиста": "Entertainer’s Pack",
  "Набор дипломата": "Diplomat’s Pack",
  "Воровские инструменты": "Thieves’ Tools",
  "Набор травника": "Herbalism Kit",
  "Набор лекаря": "Healer’s Kit",
  "Книга заклинаний": "Spellbook",
  Мантия: "Robe",
  Кошель: "Pouch",
  Ломик: "Crowbar",
  "Мешочек с компонентами": "Component Pouch",
  Лютня: "Lute",
  Флейта: "Flute",
  Барабан: "Drum",
  "Священный символ": "Amulet",
  "Магическая фокусировка (кристалл)": "Crystal",
  "Магическая фокусировка (сфера)": "Orb",
};

export function equipmentDisplayName(name: string): string {
  if (/[А-Яа-яЁё]/.test(name)) return name;
  return (
    Object.entries(equipmentEnglish).find(
      ([, english]) =>
        english.toLowerCase().replaceAll("’", "'") ===
        name.toLowerCase().replaceAll("’", "'"),
    )?.[0] || name
  );
}
