import type { Ability, Edition } from "./rules-data";
import { equipmentDisplayName } from "./starting-equipment";
/** SRD 5.1 Equipment / SRD 5.2.1 pp. 89–92. Values are edition-specific. */
export interface CombatEquipment {
  id: string;
  name: string;
  kind: "weapon" | "armor" | "shield";
  category: "simple" | "martial" | "light" | "medium" | "heavy" | "shield";
  damage?: string;
  damageType?: string;
  finesse?: boolean;
  ranged?: boolean;
  light?: boolean;
  heavy?: boolean;
  twoHanded?: boolean;
  versatile?: string;
  reach?: number;
  range?: string;
  loading?: boolean;
  ac?: number;
  strength?: number;
  stealth?: boolean;
}
// id, Russian name, dice, damage type, category, properties, range, versatile die.
const weaponRows: [
  string,
  string,
  string,
  string,
  "simple" | "martial",
  string,
  string?,
  string?,
][] = [
  ["club", "Дубинка", "1d4", "дробящий", "simple", "light"],
  ["dagger", "Кинжал", "1d4", "колющий", "simple", "finesse light", "20/60"],
  ["greatclub", "Палица", "1d8", "дробящий", "simple", "two"],
  ["handaxe", "Ручной топор", "1d6", "рубящий", "simple", "light", "20/60"],
  ["javelin", "Метательное копьё", "1d6", "колющий", "simple", "", "30/120"],
  [
    "light-hammer",
    "Лёгкий молот",
    "1d4",
    "дробящий",
    "simple",
    "light",
    "20/60",
  ],
  ["mace", "Булава", "1d6", "дробящий", "simple", ""],
  [
    "quarterstaff",
    "Боевой посох",
    "1d6",
    "дробящий",
    "simple",
    "",
    undefined,
    "1d8",
  ],
  ["sickle", "Серп", "1d4", "рубящий", "simple", "light"],
  ["spear", "Копьё", "1d6", "колющий", "simple", "", "20/60", "1d8"],
  [
    "light-crossbow",
    "Лёгкий арбалет",
    "1d8",
    "колющий",
    "simple",
    "ranged loading two",
    "80/320",
  ],
  ["dart", "Дротик", "1d4", "колющий", "simple", "ranged finesse", "20/60"],
  [
    "shortbow",
    "Короткий лук",
    "1d6",
    "колющий",
    "simple",
    "ranged two",
    "80/320",
  ],
  ["sling", "Праща", "1d4", "дробящий", "simple", "ranged", "30/120"],
  [
    "battleaxe",
    "Боевой топор",
    "1d8",
    "рубящий",
    "martial",
    "",
    undefined,
    "1d10",
  ],
  ["flail", "Цеп", "1d8", "дробящий", "martial", ""],
  ["glaive", "Глефа", "1d10", "рубящий", "martial", "heavy reach two"],
  ["greataxe", "Секира", "1d12", "рубящий", "martial", "heavy two"],
  ["greatsword", "Двуручный меч", "2d6", "рубящий", "martial", "heavy two"],
  ["halberd", "Алебарда", "1d10", "рубящий", "martial", "heavy reach two"],
  ["lance", "Длинное копьё", "1d12", "колющий", "martial", "reach two"],
  [
    "longsword",
    "Длинный меч",
    "1d8",
    "рубящий",
    "martial",
    "",
    undefined,
    "1d10",
  ],
  ["maul", "Молот", "2d6", "дробящий", "martial", "heavy two"],
  ["morningstar", "Моргенштерн", "1d8", "колющий", "martial", ""],
  ["pike", "Пика", "1d10", "колющий", "martial", "heavy reach two"],
  ["rapier", "Рапира", "1d8", "колющий", "martial", "finesse"],
  ["scimitar", "Скимитар", "1d6", "рубящий", "martial", "finesse light"],
  ["shortsword", "Короткий меч", "1d6", "колющий", "martial", "finesse light"],
  ["trident", "Трезубец", "1d6", "колющий", "martial", "", "20/60", "1d8"],
  [
    "warhammer",
    "Боевой молот",
    "1d8",
    "дробящий",
    "martial",
    "",
    undefined,
    "1d10",
  ],
  ["war-pick", "Боевая кирка", "1d8", "колющий", "martial", ""],
  ["whip", "Кнут", "1d4", "рубящий", "martial", "finesse reach"],
  [
    "longbow",
    "Длинный лук",
    "1d8",
    "колющий",
    "martial",
    "ranged heavy two",
    "150/600",
  ],
  [
    "hand-crossbow",
    "Ручной арбалет",
    "1d6",
    "колющий",
    "martial",
    "ranged loading light",
    "30/120",
  ],
  [
    "heavy-crossbow",
    "Тяжёлый арбалет",
    "1d10",
    "колющий",
    "martial",
    "ranged heavy loading two",
    "100/400",
  ],
  [
    "blowgun",
    "Духовая трубка",
    "1",
    "колющий",
    "martial",
    "ranged loading",
    "25/100",
  ],
  ["net", "Сеть", "0", "без урона", "martial", "ranged", "5/15"],
];
const armorRows: [
  string,
  string,
  "light" | "medium" | "heavy" | "shield",
  number,
  number?,
  boolean?,
][] = [
  ["padded", "Стёганый доспех", "light", 11, 0, true],
  ["leather", "Кожаный доспех", "light", 11],
  ["studded", "Проклёпанный кожаный доспех", "light", 12],
  ["hide", "Шкурный доспех", "medium", 12],
  ["chain-shirt", "Кольчужная рубаха", "medium", 13],
  ["scale", "Чешуйчатый доспех", "medium", 14, 0, true],
  ["breastplate", "Кираса", "medium", 14],
  ["half-plate", "Полулаты", "medium", 15, 0, true],
  ["ring", "Колечный доспех", "heavy", 14, 0, true],
  ["chain", "Кольчуга", "heavy", 16, 13, true],
  ["splint", "Наборный доспех", "heavy", 17, 15, true],
  ["plate", "Латы", "heavy", 18, 15, true],
  ["shield", "Щит", "shield", 2],
];
export function combatEquipmentCatalog(edition: Edition): CombatEquipment[] {
  const weapons: CombatEquipment[] = weaponRows
    .filter((v) => edition === "2014" || v[0] !== "net")
    .map(
      ([id, name, damage, damageType, category, props, range, versatile]) => ({
        id,
        name,
        kind: "weapon",
        damage,
        damageType,
        category,
        range,
        versatile,
        light: props.includes("light"),
        heavy: props.includes("heavy"),
        twoHanded: props.includes("two"),
        finesse: props.includes("finesse"),
        ranged: props.includes("ranged"),
        loading: props.includes("loading"),
        reach: props.includes("reach") ? 10 : 5,
      }),
    );
  if (edition === "2024") {
    Object.assign(weapons.find((v) => v.id === "lance")!, {
      damage: "1d10",
      heavy: true,
    });
    Object.assign(weapons.find((v) => v.id === "trident")!, {
      damage: "1d8",
      versatile: "1d10",
    });
    weapons.find((v) => v.id === "war-pick")!.versatile = "1d10";
    weapons.push(
      {
        id: "musket",
        name: "Мушкет",
        kind: "weapon",
        category: "martial",
        damage: "1d12",
        damageType: "колющий",
        ranged: true,
        loading: true,
        twoHanded: true,
        range: "40/120",
      },
      {
        id: "pistol",
        name: "Пистолет",
        kind: "weapon",
        category: "martial",
        damage: "1d10",
        damageType: "колющий",
        ranged: true,
        loading: true,
        range: "30/90",
      },
    );
  }
  return [
    ...weapons,
    ...armorRows.map(([id, name, category, ac, strength, stealth]) => ({
      id,
      name,
      category,
      ac,
      strength,
      stealth,
      kind: category === "shield" ? ("shield" as const) : ("armor" as const),
    })),
  ];
}
export interface EquipmentCombatSettings {
  baseItem?: string;
  equipped?: boolean;
  twoHanded?: boolean;
  magicBonus?: number;
  attackAbility?: Ability;
  proficient?: boolean;
}
export function resolveCombatEquipment(
  item: { name: string } & EquipmentCombatSettings,
  edition: Edition,
) {
  const catalog = combatEquipmentCatalog(edition);
  if (item.baseItem) return catalog.find((v) => v.id === item.baseItem);
  const name = equipmentDisplayName(item.name)
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");
  return catalog.find(
    (v) =>
      v.name.toLowerCase().replaceAll("ё", "е") === name ||
      (v.id === "shield" && name === "деревянный щит"),
  );
}
export function isEquipmentCombatSettings(item: EquipmentCombatSettings) {
  return (
    (item.baseItem === undefined ||
      (typeof item.baseItem === "string" &&
        combatEquipmentCatalog("2024")
          .concat(combatEquipmentCatalog("2014"))
          .some((v) => v.id === item.baseItem))) &&
    [item.equipped, item.twoHanded, item.proficient].every(
      (v) => v === undefined || typeof v === "boolean",
    ) &&
    (item.magicBonus === undefined ||
      (Number.isInteger(item.magicBonus) &&
        item.magicBonus >= 0 &&
        item.magicBonus <= 3)) &&
    (item.attackAbility === undefined ||
      ["str", "dex", "con", "int", "wis", "cha"].includes(item.attackAbility))
  );
}
