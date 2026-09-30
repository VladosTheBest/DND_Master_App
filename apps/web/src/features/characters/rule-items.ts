import { ARTIFICER_REPLICAS_2024 } from "./artificer-replicas-2024";
import { ADDITIONAL_POTIONS_2024 } from "./additional-potions-2024";
import { ARTIFICER_REPLICAS_2024_COMMON } from "./artificer-replicas-2024-common";
import { ARTIFICER_REPLICAS_2024_GENERAL } from "./artificer-replicas-2024-general";
import { ARTIFICER_REPLICAS_HIGH } from "./artificer-replicas-high";
import { ARTIFICER_REPLICAS_2024_HIGH } from "./artificer-replicas-2024-high";
import { ARTIFICER_REPLICAS } from "./artificer-replicas";
import { ARTIFICER_INFUSION_OPTIONS } from "./artificer-infusions";
import type { Edition } from "./rules-data";
import type { Bilingual } from "./rule-creatures";
export interface RuleItem {
 id: string;
 edition: Edition;
 name: Bilingual;
 kind: "potion" | "weapon" | "armor" | "wondrous" | "ring" | "wand" | "staff" | "scroll" | "object";
 rarity: "common" | "uncommon" | "rare" | "very-rare" | "legendary" | "class-feature";
 sourceUrl: string;
 replicationLevel?: number;
 rules: Bilingual;
 activation?: Bilingual;
 spellIds?: string[];
 creatureIds?: string[];
 randomTableId?: string;
 table?: { columns: Bilingual[]; rows: Bilingual[][] };
}
/** Bundled mechanical references; licensed SRD excerpts are attributed in SOURCES.md. */
export const RULE_ITEMS: RuleItem[] = [
  ...ADDITIONAL_POTIONS_2024,
  ...([1, 2, 3] as const).map((level): RuleItem => ({
    id: `spell-scroll-${level}-2024`, edition:"2024", kind:"scroll", rarity:level === 1 ? "common" : "uncommon",
    name:{ru:`Свиток заклинания ${level}-го круга`,en:`Spell Scroll, Level ${level}`},
    sourceUrl:"https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=244",
    rules:{
      ru:`Содержит одно определённое заклинание ${level}-го круга. Если оно есть в вашем списке заклинаний, можно прочесть свиток и сотворить его с обычным временем сотворения, без материальных компонентов. Иначе запись непонятна. Если круг выше доступного вам, сделайте проверку заклинательной характеристики Сл ${10+level}; провал стирает заклинание без эффекта. Успешное сотворение уничтожает свиток, прерывание сотворения его сохраняет. Сл заклинания ${level === 3 ? 15 : 13}, бонус атаки +${level === 3 ? 7 : 5}. Заклинание волшебника можно переписать в книгу: проверка Интеллекта (Магия) Сл ${10+level}; успех позволяет переписать, но при любом исходе свиток уничтожается.`,
      en:`Contains one specified level-${level} spell. If it is on your spell list, read the scroll to cast it with its normal casting time and no Material components; otherwise it is unintelligible. If the spell exceeds the level you can normally cast, make a DC ${10+level} spellcasting ability check; failure erases it without effect. Casting destroys the scroll, but interrupted casting does not. Spell save DC ${level === 3 ? 15 : 13}, attack bonus +${level === 3 ? 7 : 5}. A Wizard spell can be copied into a spellbook with a DC ${10+level} Intelligence (Arcana) check; success copies it, but either result destroys the scroll.`,
    },
  })),
  {
    "id": "oil-of-slipperiness-2024",
    "edition": "2024",
    "name": {
      "ru": "Масло ускользания",
      "en": "Oil of Slipperiness"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16004-oil-of-slipperiness",
    "rules": {
      "ru": "За 10 минут нанесите масло на существо Среднего размера или меньше и его снаряжение; для каждой категории размера выше требуется ещё флакон. Оно получает Свободу передвижения на 8 часов. Либо действием Магия вылейте масло в квадрат 10 × 10 фт.: там на 8 часов действует Намасливание.",
      "en": "Spend 10 minutes coating a Medium or smaller creature and its equipment; each size category above Medium requires one more flask. It gains Freedom of Movement for 8 hours. Alternatively, use a Magic action to pour the oil over a 10-foot square, producing Grease there for 8 hours."
    },
    "spellIds": [
      "freedom-of-movement-2024",
      "grease-2024"
    ]
  },
  {
    "id": "philter-of-love-2024",
    "edition": "2024",
    "name": {
      "ru": "Любовное зелье",
      "en": "Philter of Love"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16013-philter-of-love",
    "rules": {
      "ru": "Первое существо, которое вы увидите в течение 10 минут после выпивания, очаровывает вас на 1 час; спасброска нет.",
      "en": "The first creature you see within 10 minutes after drinking Charms you for 1 hour; no saving throw."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-animal-friendship-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье дружбы с животными",
      "en": "Potion of Animal Friendship"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16022-potion-of-animal-friendship",
    "rules": {
      "ru": "После выпивания можете сотворить Дружбу с животными 3-го круга со Сл 13. Это одно применение, а не многократное сотворение в течение часа.",
      "en": "After drinking, you can cast Animal Friendship at third level with save DC 13. This is one casting, not repeated casting over an hour."
    },
    "spellIds": [
      "animal-friendship-2024"
    ],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-climbing-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье лазания",
      "en": "Potion of Climbing"
    },
    "kind": "potion",
    "rarity": "common",
    "sourceUrl": "https://next.dnd.su/items/16024-potion-of-climbing",
    "rules": {
      "ru": "На 1 час получите скорость лазания, равную вашей Скорости, и преимущество на проверки Силы (Атлетика) при лазании.",
      "en": "For 1 hour gain a Climb Speed equal to your Speed and advantage on Strength (Athletics) checks made to climb."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-comprehension-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье понимания",
      "en": "Potion of Comprehension"
    },
    "kind": "potion",
    "rarity": "common",
    "sourceUrl": "https://next.dnd.su/items/16025-potion-of-comprehension",
    "rules": {
      "ru": "На 1 час получите эффект Понимания языков.",
      "en": "Gain the effect of Comprehend Languages for 1 hour."
    },
    "spellIds": [
      "comprehend-languages-2024"
    ],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-dragons-breath-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье дыхания дракона",
      "en": "Potion of Dragon's Breath"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/21165-potion-of-dragons-breath",
    "rules": {
      "ru": "На 1 минуту получите Дыхание дракона без концентрации, Сл 13. Тип урона определён при создании: белый — холод, зелёный — яд, красный — огонь, синий — электричество, чёрный — кислота.",
      "en": "Gain Dragon’s Breath for 1 minute without Concentration, save DC 13. Damage is set when created: white Cold, green Poison, red Fire, blue Lightning, black Acid."
    },
    "spellIds": [
      "dragons-breath-2024"
    ],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-fire-breath-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье огненного дыхания",
      "en": "Potion of Fire Breath"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16027-potion-of-fire-breath",
    "rules": {
      "ru": "Бонусным действием выдохните огонь в цель в 30 фт.: спасбросок Ловкости Сл 13 против 4к6 огненного урона, успех — половина. Эффект заканчивается после трёх выдохов или через 1 час.",
      "en": "As a Bonus Action breathe fire at a target within 30 feet: Dexterity save DC 13 against 4d6 Fire damage, half on success. The effect ends after three breaths or 1 hour."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-giant-strength-hill-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье силы холмового великана",
      "en": "Potion of Giant Strength (hill)"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16829-potion-of-giant-strength-hill",
    "rules": {
      "ru": "На 1 час Сила становится 21. При исходной Силе 21 или выше эффекта нет.",
      "en": "Strength becomes 21 for 1 hour. No effect if it is already 21 or higher."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-greater-healing-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье большого лечения",
      "en": "Potion of Greater Healing"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16523-potion-of-greater-healing",
    "rules": {
      "ru": "Выпивший восстанавливает 4к4 + 4 хита.",
      "en": "The drinker regains 4d4 + 4 hit points."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-growth-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье увеличения",
      "en": "Potion of Growth"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16032-potion-of-growth",
    "rules": {
      "ru": "На 10 минут получите вариант «Увеличение» заклинания Увеличение/уменьшение, без концентрации.",
      "en": "Gain the Enlarge option of Enlarge/Reduce for 10 minutes without Concentration."
    },
    "spellIds": [
      "enlarge-reduce-2024"
    ],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-healing-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье лечения",
      "en": "Potion of Healing"
    },
    "kind": "potion",
    "rarity": "common",
    "sourceUrl": "https://next.dnd.su/items/256-potion-of-healing",
    "rules": {
      "ru": "Выпивший восстанавливает 2к4 + 2 хита.",
      "en": "The drinker regains 2d4 + 2 hit points."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-poison-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье яда",
      "en": "Potion of Poison"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16038-potion-of-poison",
    "rules": {
      "ru": "Выглядит, пахнет и имеет вкус полезного зелья; Опознание раскрывает обман. Выпивание наносит 4к6 ядовитого урона, затем требуется спасбросок Телосложения Сл 13: провал также отравляет на 1 час. Спасбросок не уменьшает начальный урон.",
      "en": "Looks, smells, and tastes like a beneficial potion; Identify reveals the deception. Drinking deals 4d6 Poison damage, then requires a DC 13 Constitution save; failure also Poisons the drinker for 1 hour. The save does not reduce the initial damage."
    },
    "spellIds": [
      "identify-2024"
    ],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-pugilism-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье кулачного боя",
      "en": "Potion of Pugilism"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16039-potion-of-pugilism",
    "rules": {
      "ru": "На 10 минут каждое попадание безоружным ударом наносит дополнительно 1к6 силового урона.",
      "en": "For 10 minutes every Unarmed Strike hit deals an extra 1d6 Force damage."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-resistance-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье сопротивления",
      "en": "Potion of Resistance"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16040-potion-of-resistance",
    "rules": {
      "ru": "На 1 час получите сопротивление одному типу урона. Мастер выбирает тип либо бросает d10 по встроенной таблице.",
      "en": "Gain resistance to one damage type for 1 hour. The DM chooses the type or rolls d10 on the included table."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    },
    "randomTableId": "potion-resistance-2024"
  },
  {
    "id": "potion-of-tirelessness-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье неустанности",
      "en": "Potion of Tirelessness"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/21166-potion-of-tirelessness",
    "rules": {
      "ru": "На 24 часа не нуждаетесь во сне, и магия не может усыпить вас. В это время долгий отдых занимает 4 часа спокойной сосредоточенности, на протяжении которых вы остаётесь в сознании.",
      "en": "For 24 hours you need no sleep and magic cannot put you to sleep. During that time a long rest takes 4 hours of quiet focus while you remain conscious."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  },
  {
    "id": "potion-of-water-breathing-2024",
    "edition": "2024",
    "name": {
      "ru": "Зелье подводного дыхания",
      "en": "Potion of Water Breathing"
    },
    "kind": "potion",
    "rarity": "uncommon",
    "sourceUrl": "https://next.dnd.su/items/16043-potion-of-water-breathing",
    "rules": {
      "ru": "На 24 часа получите возможность дышать под водой.",
      "en": "Gain the ability to breathe underwater for 24 hours."
    },
    "spellIds": [],
    "activation": {
      "ru": "Бонусным действием выпейте зелье или влейте другому существу в 5 фт.",
      "en": "Use a Bonus Action to drink or administer the potion to another creature within 5 feet."
    }
  }
];
export const ruleItem = (id: string) => RULE_ITEMS.find((item) => item.id === id);

for (const edition of ["2014","2024"] as const) RULE_ITEMS.push({
 id:`eldritch-cannon-${edition}`,edition,name:{ru:"Мистическая пушка",en:"Eldritch Cannon"},kind:"object",rarity:"class-feature",
 sourceUrl:edition === "2014" ? "https://dnd.su/class/137-artificer/#specialist.artillerist" : "https://next.dnd.su/bestiary/27369-eldritch-cannon",
 rules:{
 ru:"Маленький или Крошечный объект, КД 18, хиты 5 × уровень изобретателя. Иммунитет к яду и психическому урону. "+(edition === "2014" ? "Все характеристики для проверок и спасбросков 10 (+0); Починка лечит 2d6 хитов. Тип выбирается при создании. Если есть ноги, при активации переместите или поднимите пушку на 15 фт. в свободное место." : "Инициатива −5; Починка лечит 2d8 хитов. При каждой активации выбирайте режим и до или после переместите пушку на расстояние до 15 фт.")+" Бонусным действием в 60 фт. активируйте режим. Огнемёт: конус 15 фт., спасбросок Ловкости против Сл ваших заклинаний, 2d8 огнём при провале, половина при успехе; загораются горючие неносимые предметы. Баллиста: ваша дальнобойная атака заклинанием по существу или предмету в 120 фт. от пушки, 2d8 силового урона; существо отталкивается на 5 фт. Защитник: пушка и выбранные существа в 10 фт. получают 1d8 + Интеллект временных хитов (минимум "+(edition === "2014" ? "+1 к броску" : "1 хит")+").",
 en:"Small or Tiny object, AC 18, HP 5 × Artificer level. Immune to Poison and Psychic damage. "+(edition === "2014" ? "For checks and saves, every ability score is 10 (+0); Mending restores 2d6 HP. Choose its mode when creating it. If it has legs, activation can also move or climb it up to 15 ft. to an unoccupied space." : "Initiative −5; Mending restores 2d8 HP. Choose the mode on each activation and move the cannon up to 15 ft. before or after it.")+" Use a Bonus Action within 60 ft. to activate a mode. Flamethrower: 15-ft. Cone, Dexterity save against your spell DC, 2d8 Fire damage on failure or half on success; unattended flammable objects ignite. Force Ballista: your ranged spell attack against a creature or object within 120 ft. of the cannon; 2d8 Force damage and push a creature 5 ft. away. Protector: the cannon and chosen creatures within 10 ft. gain 1d8 + your Intelligence modifier Temporary HP (minimum "+(edition === "2014" ? "+1 modifier" : "1 HP")+").",
 },spellIds:[`mending-${edition}`],
});

const infusionNames: Record<string,string> = {"returning-weapon": "Returning Weapon", "arcane-propulsion-armor": "Arcane Propulsion Armor", "armor-magical-strength": "Armor of Magical Strength", "resistant-armor": "Resistant Armor", "radiant-weapon": "Radiant Weapon", "spell-refueling-ring": "Spell-Refueling Ring", "repulsion-shield": "Repulsion Shield", "repeating-shot": "Repeating Shot", "boots-winding-path": "Boots of the Winding Path", "homunculus-servant": "Homunculus Servant", "enhanced-defense": "Enhanced Defense", "enhanced-focus": "Enhanced Arcane Focus", "enhanced-weapon": "Enhanced Weapon", "mind-sharpener": "Mind Sharpener", "helm-awareness": "Helm of Awareness"};
for (const option of ARTIFICER_INFUSION_OPTIONS) RULE_ITEMS.push({
 id:`infusion-${option.id}-2014`,edition:"2014",name:{ru:option.name,en:infusionNames[option.id]},
 kind:"object",rarity:"class-feature",sourceUrl:"https://dnd.su/class/137-artificer/",
 rules:{ru:`Минимальный уровень изобретателя: ${option.level ?? 2}. ${option.description}`,en:`Minimum Artificer level: ${option.level ?? 2}. ${option.originalDescription}`},
 spellIds:option.spellReferenceIds,creatureIds:option.creatureReferenceIds,
});

RULE_ITEMS.push(...ARTIFICER_REPLICAS);

RULE_ITEMS.push(...ARTIFICER_REPLICAS_2024);
RULE_ITEMS.push(...ARTIFICER_REPLICAS_HIGH);
RULE_ITEMS.push(...ARTIFICER_REPLICAS_2024_HIGH);
RULE_ITEMS.push(...ARTIFICER_REPLICAS_2024_COMMON);
RULE_ITEMS.push(...ARTIFICER_REPLICAS_2024_GENERAL);
