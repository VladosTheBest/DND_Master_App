import {
  ABILITIES,
  ABILITY_LABELS,
  BACKGROUNDS,
  CLASSES,
  FEATS,
  SKILLS,
  SPECIES,
  SPELLS,
  type Ability,
  type Edition,
  type ClassOption,
  type SpeciesOption,
  type BackgroundOption,
  type SpellOption,
} from "./rules-data";
export * from "./rules-data";
import {
  featureDescription,
  featureOriginal,
  featureTitle,
} from "./feature-help";
import { SKILL_HELP, choiceExplanation, choiceName } from "./choice-help";
export interface LevelChoice {
  level: number;
  subclassId?: string;
  asi?: Partial<Record<Ability, number>>;
  featId?: string;
  spellIds: string[];
  cantripIds: string[];
  preparedSpellIds?: string[];
  featureChoices?: Record<string, string[]>;
}
export interface CharacterDraft {
  name: string;
  playerName: string;
  edition: Edition;
  classId: string;
  speciesId: string;
  backgroundId: string;
  targetLevel: number;
  abilityMethod: "standard" | "point-buy";
  abilities: Record<Ability, number>;
  abilityBonuses: Record<Ability, number>;
  skillIds: string[];
  levels: LevelChoice[];
  notes: string;
}
export interface ValidationIssue {
  step: "identity" | "origin" | "abilities" | "skills" | "level";
  level?: number;
  message: string;
  code: string;
}
export interface FeatureGain {
  id: string;
  name: string;
  description: string;
  originalDescription?: string;
  level: number;
}
export interface SpellcastingSource {
  id: string;
  name: string;
  ability: Ability;
  saveDc: number;
  attackBonus: number;
  spellIds: string[];
}
export interface FeatureChoiceOption {
  id: string;
  name: string;
  description: string;
  count: number;
  options: { id: string; name: string; description: string }[];
}
export interface LevelOptions {
  level: number;
  subclassRequired: boolean;
  subclasses: ClassOption["subclasses"];
  asiAvailable: boolean;
  epicBoonAvailable: boolean;
  feats: typeof FEATS;
  spellCount: number;
  cantripCount: number;
  preparedCount: number;
  spellMode: "none" | "known" | "prepared" | "spellbook";
  spellSlots: number[];
  pactSlots: number;
  pactSlotLevel: number;
  maxSpellLevel: number;
  spells: SpellOption[];
  cantrips: SpellOption[];
  features: FeatureGain[];
  featureChoiceOptions: FeatureChoiceOption[];
}
export interface DerivedCharacter {
  level: number;
  class: ClassOption | undefined;
  species: SpeciesOption | undefined;
  background: BackgroundOption | undefined;
  subclass: ClassOption["subclasses"][number] | undefined;
  abilities: Record<Ability, number>;
  modifiers: Record<Ability, number>;
  proficiencyBonus: number;
  maxHp: number;
  armorClass: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  savingThrows: {
    ability: Ability;
    name: string;
    bonus: number;
    proficient: boolean;
  }[];
  skills: {
    id: string;
    name: string;
    ability: Ability;
    bonus: number;
    proficient: boolean;
  }[];
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  spellcastingSources: SpellcastingSource[];
  spellSlots: number[];
  pactSlots: number;
  pactSlotLevel: number;
  selectedSpells: SpellOption[];
  selectedCantrips: SpellOption[];
  preparedSpells: SpellOption[];
  features: FeatureGain[];
  traits: string[];
  feats: typeof FEATS;
  hitDice: string;
  warnings: string[];
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export const FULL_CASTER_SLOTS = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
export const PREPARED_2024 = [
  4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
];
export const WIZARD_PREPARED_2024 = [
  4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25,
];
export const HALF_PREPARED_2024 = [
  2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15,
];
const BARD_KNOWN = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22,
];
const SORCERER_KNOWN = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15,
];
const WARLOCK_KNOWN = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
];
const RANGER_KNOWN = [
  0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
];
const zeroAbilities = (): Record<Ability, number> => ({
  str: 0,
  dex: 0,
  con: 0,
  int: 0,
  wis: 0,
  cha: 0,
});
export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
export const pointBuySpent = (abilities: Record<Ability, number>) =>
  ABILITIES.reduce((n, a) => n + (POINT_BUY_COST[abilities[a]] ?? 100), 0);
const editionSpells = (edition: Edition) =>
  SPELLS.filter((s) => s.editions.includes(edition));
const sid = (id: string, edition: Edition) => `${id}-${edition}`;
const picked = (draft: CharacterDraft, key: string, through = 20) =>
  draft.levels
    .filter((l) => l.level <= through)
    .flatMap((l) => l.featureChoices?.[key] ?? []);
const unique = <T>(items: T[]) => [...new Set(items)];
const currentLevel = (draft: CharacterDraft, level: number) =>
  draft.levels.find((l) => l.level === level);
const availableSpecies = (draft: CharacterDraft) =>
  SPECIES.find(
    (s) => s.id === draft.speciesId && s.editions.includes(draft.edition),
  );
const availableBackground = (draft: CharacterDraft) =>
  BACKGROUNDS.find(
    (b) => b.id === draft.backgroundId && b.editions.includes(draft.edition),
  );

export function createDefaultDraft(edition: Edition = "2024"): CharacterDraft {
  return {
    name: "",
    playerName: "",
    edition,
    classId: "fighter",
    speciesId: "human",
    backgroundId: edition === "2024" ? "soldier" : "acolyte",
    targetLevel: 1,
    abilityMethod: "standard",
    abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    abilityBonuses:
      edition === "2014"
        ? { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }
        : { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
    skillIds: [],
    levels: [],
    notes: "",
  };
}
export function finalAbilities(
  draft: CharacterDraft,
  level = draft.targetLevel,
): Record<Ability, number> {
  const result = zeroAbilities();
  for (const a of ABILITIES)
    result[a] =
      (Number(draft.abilities[a]) || 0) +
      (Number(draft.abilityBonuses[a]) || 0) +
      draft.levels
        .filter((l) => l.level <= level)
        .reduce((n, l) => n + (l.asi?.[a] ?? 0), 0);
  if (level >= 20 && draft.classId === "barbarian") {
    result.str = Math.min(draft.edition === "2024" ? 25 : 24, result.str + 4);
    result.con = Math.min(draft.edition === "2024" ? 25 : 24, result.con + 4);
  }
  if (level >= 20 && draft.classId === "monk" && draft.edition === "2024") {
    result.dex = Math.min(25, result.dex + 4);
    result.wis = Math.min(25, result.wis + 4);
  }
  return result;
}

const FEATURE_NAMES: Record<string, string> = {
  Spellcasting: "Использование заклинаний",
  Rage: "Ярость",
  "Unarmored Defense": "Защита без доспехов",
  "Reckless Attack": "Безрассудная атака",
  "Danger Sense": "Чувство опасности",
  "Extra Attack": "Дополнительная атака",
  "Fast Movement": "Быстрое передвижение",
  "Feral Instinct": "Дикий инстинкт",
  "Relentless Rage": "Неукротимая ярость",
  "Persistent Rage": "Непрерывная ярость",
  "Indomitable Might": "Неукротимая мощь",
  "Primal Champion": "Первобытный чемпион",
  "Bardic Inspiration": "Бардовское вдохновение",
  Expertise: "Компетентность",
  "Jack of All Trades": "Мастер на все руки",
  "Font of Inspiration": "Источник вдохновения",
  Countercharm: "Контрочарование",
  "Magical Secrets": "Тайны магии",
  "Superior Inspiration": "Превосходное вдохновение",
  "Channel Divinity": "Божественный канал",
  "Divine Intervention": "Божественное вмешательство",
  "Wild Shape": "Дикий облик",
  Druidic: "Друидический язык",
  "Beast Spells": "Заклинания в зверином облике",
  Archdruid: "Архидруид",
  "Second Wind": "Второе дыхание",
  "Action Surge": "Всплеск действий",
  Indomitable: "Упорный",
  "Fighting Style": "Боевой стиль",
  "Martial Arts": "Боевые искусства",
  "Deflect Missiles": "Отражение снарядов",
  "Slow Fall": "Медленное падение",
  "Stunning Strike": "Ошеломляющий удар",
  Evasion: "Увёртливость",
  "Stillness of Mind": "Спокойствие разума",
  "Purity of Body": "Чистота тела",
  "Diamond Soul": "Алмазная душа",
  "Timeless Body": "Безвременное тело",
  "Empty Body": "Пустое тело",
  "Perfect Self": "Совершенство",
  "Lay On Hands": "Наложение рук",
  "Divine Sense": "Божественное чувство",
  "Divine Smite": "Божественная кара",
  "Aura of Protection": "Аура защиты",
  "Aura of Courage": "Аура отваги",
  "Improved Divine Smite": "Улучшенная божественная кара",
  "Cleansing Touch": "Очищающее касание",
  "Favored Enemy": "Избранный враг",
  "Natural Explorer": "Исследователь природы",
  "Primeval Awareness": "Первозданная осведомлённость",
  "Land’s Stride": "Тропами земли",
  "Hide in Plain Sight": "Маскировка на виду",
  Vanish: "Исчезновение",
  "Feral Senses": "Дикие чувства",
  "Foe Slayer": "Убийца врагов",
  "Sneak Attack": "Скрытая атака",
  "Thieves’ Cant": "Воровской жаргон",
  "Cunning Action": "Хитрое действие",
  "Uncanny Dodge": "Невероятное уклонение",
  "Reliable Talent": "Надёжный талант",
  Blindsense: "Слепое чутьё",
  "Slippery Mind": "Скользкий ум",
  Elusive: "Неуловимый",
  "Stroke of Luck": "Удача",
  "Font of Magic": "Источник магии",
  Metamagic: "Метамагия",
  "Sorcerous Restoration": "Чародейское восстановление",
  "Pact Magic": "Магия договора",
  "Eldritch Invocations": "Таинственные воззвания",
  "Pact Boon": "Предмет договора",
  "Mystic Arcanum": "Таинственный арканум",
  "Eldritch Master": "Мистический мастер",
  "Arcane Recovery": "Магическое восстановление",
  "Spell Mastery": "Мастерство заклинаний",
  "Signature Spells": "Фирменные заклинания",
  "Ability Score Improvement": "Улучшение характеристик",
  "Epic Boon": "Эпический дар",
  "Weapon Mastery": "Оружейное мастерство",
  "Divine Order": "Божественный орден",
  "Primal Order": "Первобытный орден",
  Scholar: "Учёный",
  "Innate Sorcery": "Врождённое колдовство",
  "Unarmored Movement": "Движение без доспехов",
};
const FEATURES_2014: Record<string, Record<number, string>> = {
  barbarian: {
    1: "Rage|Unarmored Defense",
    2: "Reckless Attack|Danger Sense",
    3: "Берсерк: неистовство",
    5: "Extra Attack|Fast Movement",
    6: "Бездумная ярость",
    7: "Feral Instinct",
    9: "Жестокий критический удар",
    10: "Пугающее присутствие",
    11: "Relentless Rage",
    13: "Жестокий критический удар: 2 кости",
    14: "Ответный удар",
    15: "Persistent Rage",
    17: "Жестокий критический удар: 3 кости",
    18: "Indomitable Might",
    20: "Primal Champion",
  },
  bard: {
    1: "Bardic Inspiration|Spellcasting",
    2: "Jack of All Trades|Песнь отдыха",
    3: "Expertise|Коллегия знаний: острое словцо",
    5: "Font of Inspiration",
    6: "Countercharm|Дополнительные тайны магии",
    9: "Песнь отдыха: d8",
    10: "Expertise|Magical Secrets",
    13: "Песнь отдыха: d10",
    14: "Magical Secrets|Непревзойдённый навык",
    17: "Песнь отдыха: d12",
    18: "Magical Secrets",
    20: "Superior Inspiration",
  },
  cleric: {
    1: "Spellcasting|Домен жизни: поборник жизни и тяжёлые доспехи",
    2: "Channel Divinity|Сохранение жизни",
    5: "Уничтожение нежити: ОП 1/2",
    6: "Благословенный целитель",
    8: "Божественный удар|Уничтожение нежити: ОП 1",
    10: "Divine Intervention",
    11: "Уничтожение нежити: ОП 2",
    14: "Божественный удар: 2d8|Уничтожение нежити: ОП 3",
    17: "Высшее исцеление|Уничтожение нежити: ОП 4",
    18: "Божественный канал: 3 использования",
  },
  druid: {
    1: "Druidic|Spellcasting",
    2: "Wild Shape|Круг земли: естественное восстановление",
    6: "Тропами земли",
    10: "Покровительство природы",
    14: "Природное убежище",
    18: "Timeless Body|Beast Spells",
    20: "Archdruid",
  },
  fighter: {
    1: "Fighting Style|Second Wind",
    2: "Action Surge",
    3: "Чемпион: улучшенный критический удар",
    5: "Extra Attack",
    7: "Выдающийся атлет",
    9: "Indomitable",
    10: "Дополнительный боевой стиль",
    11: "Дополнительная атака: 3 атаки",
    13: "Упорный: 2 использования",
    15: "Превосходный критический удар",
    17: "Всплеск действий: 2 использования|Упорный: 3 использования",
    18: "Уцелевший",
    20: "Дополнительная атака: 4 атаки",
  },
  monk: {
    1: "Unarmored Defense|Martial Arts",
    2: "Ци|Unarmored Movement",
    3: "Deflect Missiles|Техника открытой ладони",
    4: "Slow Fall",
    5: "Extra Attack|Stunning Strike",
    6: "Магические удары|Целостность тела",
    7: "Evasion|Stillness of Mind",
    9: "Движение по стенам и воде",
    10: "Purity of Body",
    11: "Безмятежность",
    13: "Язык солнца и луны",
    14: "Diamond Soul",
    15: "Timeless Body",
    17: "Дрожащая ладонь",
    18: "Empty Body",
    20: "Perfect Self",
  },
  paladin: {
    1: "Divine Sense|Lay On Hands",
    2: "Fighting Style|Spellcasting|Divine Smite",
    3: "Божественное здоровье|Клятва преданности: божественный канал",
    5: "Extra Attack",
    6: "Aura of Protection",
    7: "Аура преданности",
    10: "Aura of Courage",
    11: "Improved Divine Smite",
    14: "Cleansing Touch",
    15: "Чистота духа",
    18: "Увеличение аур до 30 фт.",
    20: "Священный нимб",
  },
  ranger: {
    1: "Favored Enemy|Natural Explorer",
    2: "Fighting Style|Spellcasting",
    3: "Primeval Awareness|Добыча охотника",
    5: "Extra Attack",
    6: "Дополнительный избранный враг и местность",
    7: "Защитная тактика",
    8: "Land’s Stride",
    10: "Hide in Plain Sight|Дополнительная местность",
    11: "Мультиатака",
    14: "Vanish|Дополнительный избранный враг",
    15: "Превосходная защита",
    18: "Feral Senses",
    20: "Foe Slayer",
  },
  rogue: {
    1: "Expertise|Sneak Attack|Thieves’ Cant",
    2: "Cunning Action",
    3: "Вор: быстрые руки и форточник",
    5: "Uncanny Dodge",
    6: "Expertise",
    7: "Evasion",
    9: "Высокая скрытность",
    11: "Reliable Talent",
    13: "Использование магических устройств",
    14: "Blindsense",
    15: "Slippery Mind",
    17: "Воровские рефлексы",
    18: "Elusive",
    20: "Stroke of Luck",
  },
  sorcerer: {
    1: "Spellcasting|Драконья кровь: драконья устойчивость",
    2: "Font of Magic",
    3: "Metamagic",
    6: "Стихийное родство",
    10: "Metamagic",
    14: "Крылья дракона",
    17: "Metamagic",
    18: "Драконье присутствие",
    20: "Sorcerous Restoration",
  },
  warlock: {
    1: "Pact Magic|Покровитель: исчадие; благословение тёмного",
    2: "Eldritch Invocations",
    3: "Pact Boon",
    6: "Удача тёмного",
    10: "Устойчивость исчадия",
    11: "Mystic Arcanum",
    13: "Таинственный арканум: 7 круг",
    14: "Бросок сквозь ад",
    15: "Таинственный арканум: 8 круг",
    17: "Таинственный арканум: 9 круг",
    20: "Eldritch Master",
  },
  wizard: {
    1: "Spellcasting|Arcane Recovery",
    2: "Школа воплощения: мастер воплощения и создание заклинаний",
    6: "Мощный заговор",
    10: "Усиленное воплощение",
    14: "Перегрузка",
    18: "Spell Mastery",
    20: "Signature Spells",
  },
};

export function getLevelOptions(
  draft: CharacterDraft,
  level: number,
): LevelOptions {
  const cls = CLASSES.find((c) => c.id === draft.classId),
    is24 = draft.edition === "2024",
    n = Math.max(1, Math.min(20, level));
  const asiAvailable = [
    4,
    8,
    12,
    16,
    ...(is24 ? [] : [19]),
    ...(cls?.id === "fighter" ? [6, 14] : []),
    ...(cls?.id === "rogue" ? [10] : []),
  ].includes(n);
  const subclassRequired = n === (is24 ? 3 : cls?.subclasses[0]?.level2014);
  const epicBoonAvailable = is24 && n === 19;
  let slots: number[] = [],
    pactSlots = 0,
    pactSlotLevel = 0,
    spellCount = 0,
    cantripCount = 0,
    preparedCount = 0,
    spellMode: LevelOptions["spellMode"] = "none";
  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(finalAbilities(draft, n)[a])]),
  ) as Record<Ability, number>;
  if (cls?.caster === "full") slots = FULL_CASTER_SLOTS[n - 1];
  if (cls?.caster === "half" && (is24 || n >= 2))
    slots = FULL_CASTER_SLOTS[Math.ceil(n / 2) - 1];
  if (cls?.caster === "pact") {
    pactSlots = n === 1 ? 1 : n < 11 ? 2 : n < 17 ? 3 : 4;
    pactSlotLevel = Math.min(5, Math.ceil(n / 2));
  }
  if (cls?.spellAbility) {
    spellMode = is24 ? "prepared" : "known";
    if (["cleric", "druid", "wizard"].includes(cls.id))
      spellMode = cls.id === "wizard" ? "spellbook" : "prepared";
    if (cls.id === "paladin") spellMode = "prepared";
    const cantripBase =
      (
        {
          bard: 2,
          cleric: 3,
          druid: 2,
          sorcerer: 4,
          warlock: 2,
          wizard: 3,
        } as Record<string, number>
      )[cls.id] ?? 0;
    cantripCount = cantripBase
      ? cantripBase + (n >= 4 ? 1 : 0) + (n >= 10 ? 1 : 0)
      : 0;
    if (cls.id === "bard")
      spellCount = is24
        ? PREPARED_2024[n - 1]
        : BARD_KNOWN[n - 1] - [10, 14, 18].filter((l) => n >= l).length * 2;
    if (cls.id === "sorcerer")
      spellCount = is24
        ? n === 1
          ? 2
          : n === 2
            ? 4
            : PREPARED_2024[n - 1]
        : SORCERER_KNOWN[n - 1];
    if (cls.id === "warlock") spellCount = WARLOCK_KNOWN[n - 1];
    if (["cleric", "druid"].includes(cls.id))
      spellCount = is24
        ? PREPARED_2024[n - 1]
        : Math.max(1, n + mods[cls.spellAbility]);
    if (cls.id === "paladin")
      spellCount = is24
        ? HALF_PREPARED_2024[n - 1]
        : n < 2
          ? 0
          : Math.max(1, Math.floor(n / 2) + mods.cha);
    if (cls.id === "ranger")
      spellCount = is24 ? HALF_PREPARED_2024[n - 1] : RANGER_KNOWN[n - 1];
    if (cls.id === "wizard") {
      spellCount = 6 + 2 * (n - 1);
      preparedCount = is24
        ? WIZARD_PREPARED_2024[n - 1]
        : Math.max(1, n + mods.int);
    }
    if (!preparedCount && spellMode === "prepared") preparedCount = spellCount;
  }
  const spellSlots = Array.from({ length: 9 }, (_, i) => slots[i] ?? 0),
    maxSpellLevel = pactSlotLevel || slots.length;
  const freeSpells = grantedSpellIds(draft, n, true),
    savant = picked(draft, "evocation-savant", n - 1);
  const spells = editionSpells(draft.edition).filter(
    (s) =>
      s.level > 0 &&
      s.level <= maxSpellLevel &&
      !freeSpells.includes(s.id) &&
      !savant.includes(s.id) &&
      (s.classes.includes(draft.classId) ||
        (is24 &&
          draft.classId === "bard" &&
          n >= 10 &&
          s.classes.some((c) => ["cleric", "druid", "wizard"].includes(c)))),
  );
  // The Fiend's expanded list grants eligibility in 2014, not free known spells.
  if (!is24 && draft.classId === "warlock")
    for (const [at, ids] of [
      [1, ["burning-hands", "command"]],
      [3, ["blindness-deafness", "scorching-ray"]],
      [5, ["fireball", "stinking-cloud"]],
      [7, ["fire-shield", "wall-of-fire"]],
      [9, ["flame-strike", "hallow"]],
    ] as [number, string[]][])
      if (n >= at)
        for (const id of ids) {
          const s = SPELLS.find((x) => x.id === sid(id, draft.edition));
          if (s && !spells.some((x) => x.id === s.id)) spells.push(s);
        }
  const features: FeatureGain[] = is24
    ? (FEATURES_2024[draft.classId] ?? [])
        .filter((f) => f.level === n)
        .map((f, i) => ({
          ...f,
          id: `${draft.classId}-${n}-${i}`,
          name: FEATURE_NAMES[f.name] ?? featureTitle(f.name),
          description: featureDescription(
            draft.edition,
            draft.classId,
            f.name,
            n,
          ),
          originalDescription: featureOriginal(
            draft.edition,
            draft.classId,
            f.name,
            n,
          ),
        }))
    : (FEATURES_2014[draft.classId]?.[n] ?? "")
        .split("|")
        .filter(Boolean)
        .map((name, i) => ({
          id: `${draft.classId}-${n}-${i}`,
          name: FEATURE_NAMES[name] ?? name,
          description: featureDescription(
            draft.edition,
            draft.classId,
            name,
            n,
          ),
          originalDescription: featureOriginal(
            draft.edition,
            draft.classId,
            name,
            n,
          ),
          level: n,
        }));
  if (!is24 && asiAvailable)
    features.push({
      id: `asi-${n}`,
      name: "Улучшение характеристик или черта",
      description:
        "+2 к одной характеристике или +1 к двум, максимум 20. Вместо этого можно выбрать доступную черту.",
      level: n,
    });
  const feats = FEATS.filter(
    (f) =>
      f.editions.includes(draft.edition) &&
      n >= f.minLevel &&
      (epicBoonAvailable || (asiAvailable && f.category !== "epic")) &&
      (f.id !== "boon-spell-recall" ||
        cls?.caster === "full" ||
        cls?.caster === "half"),
  );
  return {
    level: n,
    subclassRequired,
    subclasses:
      cls?.subclasses.filter((s) => s.editions.includes(draft.edition)) ?? [],
    asiAvailable,
    epicBoonAvailable,
    feats,
    spellCount,
    cantripCount,
    preparedCount,
    spellMode,
    spellSlots,
    pactSlots,
    pactSlotLevel,
    maxSpellLevel,
    spells,
    cantrips: editionSpells(draft.edition).filter(
      (s) => s.level === 0 && s.classes.includes(draft.classId),
    ),
    features,
    featureChoiceOptions: getFeatureChoices(draft, n),
  };
}

const opts = (values: [string, string, string?][]) =>
  values.map(([id, name, description]) => ({
    id,
    name,
    description: description ?? name,
  }));
const skillOpts = (ids: string[]) =>
  SKILLS.filter((s) => ids.includes(s.id)).map((s) => ({
    id: s.id,
    name: s.name,
    description: `${SKILL_HELP[s.id]} Владение добавляет бонус мастерства к проверке ${ABILITY_LABELS[s.ability]}.`,
  }));
const spellOpts = (draft: CharacterDraft, cls: string, level: number) =>
  editionSpells(draft.edition).filter(
    (s) => s.classes.includes(cls) && s.level === level,
  );
const STYLES = opts([
  ["archery", "Стрельба", "+2 к броскам атак дальнобойным оружием."],
  ["defense", "Оборона", "+1 к КД, пока вы носите доспех."],
  [
    "great-weapon-fighting",
    "Бой большим оружием",
    "2014: переброс 1 и 2 урона двуручным/универсальным оружием. 2024: 1 и 2 считаются 3.",
  ],
  [
    "two-weapon-fighting",
    "Бой двумя оружиями",
    "Добавьте модификатор характеристики к урону дополнительной атаки вторым оружием.",
  ],
]);
const METAMAGIC = opts([
  [
    "careful",
    "Осторожное заклинание",
    "Защитите выбранных существ от заклинания со спасброском.",
  ],
  ["distant", "Далёкое заклинание", "Увеличьте дальность заклинания."],
  ["empowered", "Усиленное заклинание", "Перебросьте часть костей урона."],
  [
    "extended",
    "Продлённое заклинание",
    "Удвойте длительность, максимум 24 часа.",
  ],
  [
    "heightened",
    "Непреодолимое заклинание",
    "Помеха на спасбросок выбранной цели; стоимость зависит от редакции.",
  ],
  [
    "quickened",
    "Ускоренное заклинание",
    "Заклинание за действие превращается в бонусное действие.",
  ],
  [
    "subtle",
    "Неуловимое заклинание",
    "Убирает вербальные и соматические компоненты.",
  ],
  [
    "twinned",
    "Удвоенное заклинание",
    "2014: вторая цель подходящего заклинания. 2024: усиливает подходящее заклинание с дополнительными целями.",
  ],
]);
const WEAPONS = opts([
  ["club", "Дубинка — замедление"],
  ["dagger", "Кинжал — рассечение"],
  ["handaxe", "Ручной топор — изнурение"],
  ["javelin", "Метательное копьё — замедление"],
  ["light-hammer", "Лёгкий молот — рассечение"],
  ["mace", "Булава — ослабление"],
  ["quarterstaff", "Боевой посох — опрокидывание"],
  ["sickle", "Серп — рассечение"],
  ["spear", "Копьё — ослабление"],
  ["light-crossbow", "Лёгкий арбалет — замедление"],
  ["shortbow", "Короткий лук — изнурение"],
  ["sling", "Праща — замедление"],
  ["battleaxe", "Боевой топор — опрокидывание"],
  ["flail", "Цеп — ослабление"],
  ["glaive", "Глефа — скользящий удар"],
  ["greataxe", "Секира — размах"],
  ["greatsword", "Двуручный меч — скользящий удар"],
  ["halberd", "Алебарда — размах"],
  ["lance", "Копьё рыцаря — опрокидывание"],
  ["longsword", "Длинный меч — ослабление"],
  ["maul", "Молот — опрокидывание"],
  ["morningstar", "Моргенштерн — ослабление"],
  ["pike", "Пика — толчок"],
  ["rapier", "Рапира — изнурение"],
  ["scimitar", "Скимитар — рассечение"],
  ["shortsword", "Короткий меч — изнурение"],
  ["trident", "Трезубец — опрокидывание"],
  ["warhammer", "Боевой молот — толчок"],
  ["war-pick", "Боевая кирка — ослабление"],
  ["whip", "Кнут — замедление"],
  ["blowgun", "Духовая трубка — изнурение"],
  ["hand-crossbow", "Ручной арбалет — изнурение"],
  ["heavy-crossbow", "Тяжёлый арбалет — толчок"],
  ["longbow", "Длинный лук — замедление"],
]);

export function getFeatureChoices(
  draft: CharacterDraft,
  level: number,
): FeatureChoiceOption[] {
  const result: FeatureChoiceOption[] = [],
    is24 = draft.edition === "2024",
    c = draft.classId;
  const add = (
    id: string,
    name: string,
    count: number,
    options: FeatureChoiceOption["options"],
    description = "Выберите доступные варианты. Выбор сохраняется в листе персонажа.",
  ) => {
    if (count > 0)
      result.push({
        id,
        name,
        description,
        count,
        options: options.map((option) => ({
          ...option,
          name: choiceName(id, option.id, option.name),
          description: choiceExplanation(
            id,
            option.id,
            option.name,
            option.description,
            draft.edition,
            c,
          ),
        })),
      });
  };
  const prior = (key: string) => picked(draft, key, level - 1);
  const skillIds = unique([
    ...draft.skillIds,
    ...(availableBackground(draft)?.skillIds ?? []),
    ...picked(draft, "background-skills", level),
    ...picked(draft, "human-skill", level),
    ...picked(draft, "half-elf-skills", level),
    ...picked(draft, "elf-skill", level),
    ...picked(draft, "lore-skills", level),
    ...(draft.speciesId === "high-elf" && !is24 ? ["perception"] : []),
    ...(draft.speciesId === "half-orc" ? ["intimidation"] : []),
  ]);
  if (level === 1) {
    if (draft.backgroundId === "custom")
      add(
        "background-skills",
        "Навыки своей предыстории",
        2,
        skillOpts(
          SKILLS.map((s) => s.id).filter((id) => !draft.skillIds.includes(id)),
        ),
      );
    if (is24 && draft.speciesId === "human") {
      add(
        "human-skill",
        "Умелый: дополнительный навык",
        1,
        skillOpts(
          SKILLS.map((s) => s.id).filter(
            (id) =>
              !draft.skillIds.includes(id) &&
              !availableBackground(draft)?.skillIds.includes(id),
          ),
        ),
      );
      add(
        "human-feat",
        "Универсальность: черта происхождения",
        1,
        FEATS.filter(
          (f) =>
            f.category === "origin" &&
            f.id !== availableBackground(draft)?.featId,
        ),
      );
    }
    if (draft.speciesId === "half-elf")
      add(
        "half-elf-skills",
        "Универсальность полуэльфа",
        2,
        skillOpts(
          SKILLS.map((s) => s.id).filter(
            (id) =>
              !draft.skillIds.includes(id) &&
              !availableBackground(draft)?.skillIds.includes(id) &&
              !picked(draft, "background-skills", level).includes(id),
          ),
        ),
      );
    if (is24 && ["high-elf", "wood-elf"].includes(draft.speciesId))
      add(
        "elf-skill",
        "Острые чувства",
        1,
        skillOpts(
          ["insight", "perception", "survival"].filter(
            (id) =>
              !draft.skillIds.includes(id) &&
              !availableBackground(draft)?.skillIds.includes(id),
          ),
        ),
      );
    if (draft.speciesId === "high-elf")
      add(
        "elf-cantrip",
        "Эльфийский заговор",
        1,
        spellOpts(draft, "wizard", 0),
      );
    if (
      is24 &&
      ["high-elf", "wood-elf", "rock-gnome", "tiefling"].includes(
        draft.speciesId,
      )
    )
      add(
        "innate-ability",
        "Характеристика врождённой магии",
        1,
        opts(
          ["int", "wis", "cha"].map((a) => [a, ABILITY_LABELS[a as Ability]]),
        ),
      );
    if (draft.speciesId === "dragonborn" || (c === "sorcerer" && !is24))
      add(
        "ancestry",
        "Драконий предок",
        1,
        opts([
          ["black", "Чёрный — кислота"],
          ["blue", "Синий — электричество"],
          ["brass", "Латунный — огонь"],
          ["bronze", "Бронзовый — электричество"],
          ["copper", "Медный — кислота"],
          ["gold", "Золотой — огонь"],
          ["green", "Зелёный — яд"],
          ["red", "Красный — огонь"],
          ["silver", "Серебряный — холод"],
          ["white", "Белый — холод"],
        ]),
      );
    if (draft.speciesId === "goliath")
      add(
        "giant-ancestry",
        "Наследие великанов",
        1,
        opts([
          ["cloud", "Облачный: телепортация 30 фт."],
          ["fire", "Огненный: +1d10 урона огнём"],
          ["frost", "Ледяной: +1d6 холодом и −10 фт. скорости"],
          ["hill", "Холмовой: сбить с ног"],
          ["stone", "Каменный: реакция, уменьшить урон на 1d12 + Тел."],
          ["storm", "Штормовой: реакция, 1d8 звукового урона"],
        ]),
      );
  }
  const allFeats = unique([
    ...(is24 ? [availableBackground(draft)?.featId ?? ""] : []),
    ...picked(draft, "human-feat", level),
    ...draft.levels
      .filter((l) => l.level <= level)
      .flatMap((l) => (l.featId ? [l.featId] : [])),
  ]);
  for (const feat of allFeats.filter((f) => f.startsWith("magic-initiate-"))) {
    const cls = feat.slice("magic-initiate-".length);
    if (level === 1 || currentLevel(draft, level)?.featId === feat) {
      add(
        `${feat}-cantrips`,
        "Посвящённый: два заговора",
        2,
        spellOpts(draft, cls, 0),
      );
      add(
        `${feat}-spell`,
        "Посвящённый: заклинание 1 круга",
        1,
        spellOpts(draft, cls, 1),
      );
      add(
        `${feat}-ability`,
        "Посвящённый: характеристика магии",
        1,
        opts(
          ["int", "wis", "cha"].map((a) => [a, ABILITY_LABELS[a as Ability]]),
        ),
      );
    }
  }
  if (
    (c === "fighter" && (level === 1 || level === (is24 ? 7 : 10))) ||
    (["paladin", "ranger"].includes(c) && level === 2)
  )
    add(
      "fighting-style",
      "Боевой стиль",
      1,
      STYLES.filter(
        (s) =>
          !prior("fighting-style").includes(s.id) &&
          (is24 ||
            c !== "paladin" ||
            !["archery", "two-weapon-fighting"].includes(s.id)),
      ),
    );
  if (c === "sorcerer" && [is24 ? 2 : 3, 10, 17].includes(level))
    add(
      "metamagic",
      "Метамагия",
      level === (is24 ? 2 : 3) || is24 ? 2 : 1,
      METAMAGIC.filter((s) => !prior("metamagic").includes(s.id)),
    );
  if (
    (c === "rogue" && [1, 6].includes(level)) ||
    (c === "bard" && [is24 ? 2 : 3, is24 ? 9 : 10].includes(level)) ||
    (is24 && c === "ranger" && [2, 9].includes(level)) ||
    (is24 && c === "wizard" && level === 2)
  ) {
    const ids = (
      c === "wizard"
        ? skillIds.filter((id) =>
            [
              "arcana",
              "history",
              "investigation",
              "medicine",
              "nature",
              "religion",
            ].includes(id),
          )
        : skillIds
    ).filter((id) => !prior("expertise").includes(id));
    add(
      "expertise",
      "Компетентность: двойной бонус мастерства",
      c === "wizard" || (c === "ranger" && level === 2) ? 1 : 2,
      skillOpts(ids),
    );
  }
  if (c === "bard" && level === 3)
    add(
      "lore-skills",
      "Коллегия знаний: три навыка",
      3,
      skillOpts(
        SKILLS.map((s) => s.id).filter(
          (id) =>
            !skillIds.includes(id) ||
            picked(draft, "lore-skills", level).includes(id),
        ),
      ),
    );
  if (is24 && level === 1 && c === "cleric") {
    add(
      "divine-order",
      "Божественный орден",
      1,
      opts([
        ["protector", "Защитник", "Воинское оружие и тяжёлые доспехи."],
        [
          "thaumaturge",
          "Чудотворец",
          "Дополнительный заговор; бонус Мудрости к Магии и Религии.",
        ],
      ]),
    );
    if (picked(draft, "divine-order", 1).includes("thaumaturge"))
      add(
        "order-cantrip",
        "Заговор чудотворца",
        1,
        spellOpts(draft, "cleric", 0).filter(
          (s) => !currentLevel(draft, 1)?.cantripIds.includes(s.id),
        ),
      );
  }
  if (is24 && level === 1 && c === "druid") {
    add(
      "primal-order",
      "Первобытный орден",
      1,
      opts([
        ["warden", "Страж", "Воинское оружие и средние доспехи."],
        [
          "magician",
          "Маг",
          "Дополнительный заговор; бонус Мудрости к Магии и Природе.",
        ],
      ]),
    );
    if (picked(draft, "primal-order", 1).includes("magician"))
      add(
        "order-cantrip",
        "Заговор мага",
        1,
        spellOpts(draft, "druid", 0).filter(
          (s) => !currentLevel(draft, 1)?.cantripIds.includes(s.id),
        ),
      );
  }
  if (
    is24 &&
    ["barbarian", "fighter", "paladin", "ranger", "rogue"].includes(c)
  ) {
    const total =
      c === "fighter"
        ? 3 +
          (level >= 4 ? 1 : 0) +
          (level >= 10 ? 1 : 0) +
          (level >= 16 ? 1 : 0)
        : c === "barbarian"
          ? 2 + (level >= 4 ? 1 : 0) + (level >= 10 ? 1 : 0)
          : 2;
    const count = total - prior("weapon-mastery").length;
    add(
      "weapon-mastery",
      "Оружейное мастерство",
      count,
      WEAPONS.filter(
        (w) =>
          !prior("weapon-mastery").includes(w.id) &&
          (c !== "rogue" ||
            [
              "dagger",
              "shortbow",
              "light-crossbow",
              "sling",
              "club",
              "mace",
              "quarterstaff",
              "sickle",
              "spear",
              "javelin",
              "handaxe",
              "light-hammer",
              "rapier",
              "scimitar",
              "shortsword",
              "whip",
              "hand-crossbow",
            ].includes(w.id)),
      ),
    );
  }
  if (c === "warlock") {
    const invTotal = is24
      ? [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10][
          level - 1
        ]
      : [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8][level - 1];
    const invocations = opts([
      [
        "armor-of-shadows",
        "Доспех теней",
        "Доспехи мага по желанию, без ячеек.",
      ],
      [
        "eldritch-sight",
        "Мистическое зрение",
        "2014: Обнаружение магии без ячеек.",
      ],
      [
        "eyes-of-the-rune-keeper",
        "Глаза хранителя рун",
        "2014: чтение любого письма.",
      ],
      ["mask-of-many-faces", "Маска многих лиц", "Маскировка без ячеек."],
      ["misty-visions", "Туманные образы", "Безмолвный образ без ячеек."],
      [
        "devils-sight",
        "Дьявольское зрение",
        "Зрение в обычной и магической темноте на 120 фт.",
      ],
      [
        "agonizing-blast",
        "Мучительный заряд",
        "Добавьте Харизму к урону Мистического заряда.",
      ],
      [
        "repelling-blast",
        "Отталкивающий заряд",
        "Попадание Мистическим зарядом отталкивает цель.",
      ],
      [
        "eldritch-spear",
        "Мистическое копьё",
        "Увеличение дальности Мистического заряда.",
      ],
      [
        "pact-of-the-blade",
        "Договор клинка",
        "2024: призовите оружие договора.",
      ],
      ["pact-of-the-chain", "Договор цепи", "2024: особый фамильяр."],
      [
        "one-with-shadows",
        "Один среди теней",
        "Невидимость в тусклом свете или темноте; условия зависят от редакции.",
      ],
      ["ascendant-step", "Восходящий шаг", "Левитация на себя без ячеек."],
      [
        "otherworldly-leap",
        "Потусторонний прыжок",
        "Прыжок на себя без ячеек.",
      ],
      [
        "visions-of-distant-realms",
        "Видения далёких королевств",
        "Магический глаз без ячеек.",
      ],
      [
        "whispers-of-the-grave",
        "Шёпот могилы",
        "Разговор с мёртвыми без ячеек.",
      ],
      [
        "witch-sight",
        "Ведьминское зрение",
        "Распознавание истинного облика; 2024: истинное зрение.",
      ],
    ]);
    const min: Record<string, number> = {
      "devils-sight": is24 ? 2 : 1,
      "agonizing-blast": is24 ? 2 : 1,
      "repelling-blast": is24 ? 2 : 1,
      "eldritch-spear": is24 ? 2 : 1,
      "mask-of-many-faces": is24 ? 2 : 1,
      "misty-visions": is24 ? 2 : 1,
      "one-with-shadows": 5,
      "ascendant-step": is24 ? 5 : 9,
      "otherworldly-leap": is24 ? 2 : 9,
      "visions-of-distant-realms": is24 ? 9 : 15,
      "whispers-of-the-grave": is24 ? 7 : 9,
      "witch-sight": 15,
    };
    add(
      "invocations",
      "Таинственные воззвания",
      invTotal - prior("invocations").length,
      invocations
        .filter(
          (o) =>
            !prior("invocations").includes(o.id) &&
            level >= (min[o.id] ?? 1) &&
            (is24
              ? !["eldritch-sight", "eyes-of-the-rune-keeper"].includes(o.id)
              : !o.id.startsWith("pact-")) &&
            (!["agonizing-blast", "repelling-blast", "eldritch-spear"].includes(
              o.id,
            ) ||
              currentLevel(draft, level)?.cantripIds.includes(
                sid("eldritch-blast", draft.edition),
              )),
        )
        .map((o) =>
          is24 &&
          ["agonizing-blast", "repelling-blast", "eldritch-spear"].includes(
            o.id,
          )
            ? {
                ...o,
                name: `${o.name} — Мистический заряд`,
                description: `В этой подборке целью улучшения выбран Мистический заряд. ${o.description}`,
              }
            : o,
        ),
    );
    if (!is24 && level === 3)
      add(
        "pact-boon",
        "Предмет договора",
        1,
        opts([
          ["blade", "Договор клинка"],
          ["chain", "Договор цепи"],
        ]),
      );
    if ([11, 13, 15, 17].includes(level))
      add(
        `mystic-arcanum-${(level + 1) / 2}`,
        "Таинственный арканум: одно применение за долгий отдых",
        1,
        spellOpts(draft, "warlock", (level + 1) / 2),
      );
  }
  if (c === "ranger" && !is24) {
    if ([1, 6, 14].includes(level))
      add(
        "favored-enemy",
        "Избранный враг",
        1,
        opts(
          [
            "aberrations",
            "beasts",
            "celestials",
            "constructs",
            "dragons",
            "elementals",
            "fey",
            "fiends",
            "giants",
            "monstrosities",
            "oozes",
            "plants",
            "undead",
          ]
            .filter((id) => !prior("favored-enemy").includes(id))
            .map((id) => [id, id]),
        ),
      );
    if ([1, 6, 10].includes(level))
      add(
        "favored-terrain",
        "Избранная местность",
        1,
        opts(
          [
            ["arctic", "Арктика"],
            ["coast", "Побережье"],
            ["desert", "Пустыня"],
            ["forest", "Лес"],
            ["grassland", "Луга"],
            ["mountain", "Горы"],
            ["swamp", "Болота"],
            ["underdark", "Подземье"],
          ].filter(([id]) => !prior("favored-terrain").includes(id)) as [
            string,
            string,
          ][],
        ),
      );
  }
  if (c === "ranger" && level === 3)
    add(
      "hunter-prey",
      "Добыча охотника",
      1,
      opts([
        [
          "colossus-slayer",
          "Убийца колоссов",
          "Раз за ход +1d8 по цели, чьи текущие хиты ниже максимума.",
        ],
        [
          "horde-breaker",
          "Сокрушитель орды",
          "Раз за ход дополнительная атака по соседней цели.",
        ],
        ...(!is24
          ? [
              [
                "giant-killer",
                "Убийца великанов",
                "Реакция на промах большого врага в 5 фт.",
              ] as [string, string, string],
            ]
          : []),
      ]),
    );
  if (c === "druid" && !is24 && level === 3)
    add(
      "land-terrain",
      "Заклинания круга земли: местность",
      1,
      opts([
        ["arctic", "Арктика"],
        ["coast", "Побережье"],
        ["desert", "Пустыня"],
        ["forest", "Лес"],
        ["grassland", "Луга"],
        ["mountain", "Горы"],
        ["swamp", "Болота"],
      ]),
    );
  if (
    c === "wizard" &&
    is24 &&
    (level === 3 || [5, 7, 9, 11, 13, 15, 17].includes(level))
  )
    add(
      "evocation-savant",
      "Мастер воплощения: дополнительные заклинания в книге",
      level === 3 ? 2 : 1,
      editionSpells(draft.edition).filter(
        (s) =>
          s.classes.includes("wizard") &&
          s.school === "Воплощение" &&
          s.level > 0 &&
          s.level <= Math.ceil(level / 2) &&
          !currentLevel(draft, level)?.spellIds.includes(s.id) &&
          !prior("evocation-savant").includes(s.id),
      ),
    );
  if (c === "bard" && !is24 && [6, 10, 14, 18].includes(level))
    add(
      "magical-secrets",
      "Тайны магии: заклинания любых классов",
      2,
      editionSpells(draft.edition).filter(
        (s) =>
          s.level <= Math.ceil(level / 2) &&
          !prior("magical-secrets").includes(s.id) &&
          !currentLevel(draft, level)?.spellIds.includes(s.id),
      ),
    );
  if (c === "bard" && is24 && level === 6)
    add(
      "magical-discoveries",
      "Магические открытия Коллегии знаний",
      2,
      editionSpells(draft.edition).filter(
        (s) =>
          s.level <= 3 &&
          s.classes.some((id) => ["cleric", "druid", "wizard"].includes(id)) &&
          !currentLevel(draft, level)?.spellIds.includes(s.id) &&
          !currentLevel(draft, level)?.cantripIds.includes(s.id),
      ),
    );
  if (c === "ranger" && [7, ...(!is24 ? [11, 15] : [])].includes(level))
    add(
      `hunter-${level}`,
      "Тактика охотника",
      1,
      level === 7
        ? opts([
            ["escape-the-horde", "Защита от провоцированных атак"],
            ["multiattack-defense", "Защита от повторных атак"],
            ...(!is24
              ? [
                  ["steel-will", "Преимущество против испуга"] as [
                    string,
                    string,
                  ],
                ]
              : []),
          ])
        : level === 11
          ? opts([
              ["volley", "Залп"],
              ["whirlwind", "Вихревая атака"],
            ])
          : opts([
              ["evasion", "Увёртливость"],
              ["stand-against-the-tide", "Против течения"],
              ["uncanny-dodge", "Невероятное уклонение"],
            ]),
    );
  if (is24 && c === "cleric" && level === 7)
    add(
      "blessed-strikes",
      "Благословенные удары",
      1,
      opts([
        [
          "divine-strike",
          "Божественный удар",
          "Раз за ход +1d8 некротического или лучистого урона оружием.",
        ],
        [
          "potent-spellcasting",
          "Мощное колдовство",
          "Добавьте Мудрость к урону заговоров жреца.",
        ],
      ]),
    );
  if (is24 && c === "druid" && level === 7)
    add(
      "elemental-fury",
      "Стихийная ярость",
      1,
      opts([
        ["primal-strike", "Первобытный удар"],
        ["potent-spellcasting", "Мощное колдовство"],
      ]),
    );
  if (is24 && c === "druid" && level === 3)
    add(
      "land-terrain",
      "Круг земли: выбранная местность после отдыха",
      1,
      opts([
        ["arid", "Засушливая"],
        ["polar", "Полярная"],
        ["temperate", "Умеренная"],
        ["tropical", "Тропическая"],
      ]),
    );
  if (!is24 && c === "druid" && level === 2)
    add(
      "land-cantrip",
      "Круг земли: дополнительный заговор",
      1,
      spellOpts(draft, "druid", 0).filter(
        (s) => !currentLevel(draft, level)?.cantripIds.includes(s.id),
      ),
    );
  if (is24 && c === "sorcerer" && level === 6)
    add(
      "elemental-affinity",
      "Стихийное родство драконьей крови",
      1,
      opts([
        ["acid", "Кислота"],
        ["cold", "Холод"],
        ["fire", "Огонь"],
        ["lightning", "Электричество"],
        ["poison", "Яд"],
      ]),
    );
  if (c === "wizard" && level === 18) {
    const book = unique([
      ...(currentLevel(draft, level)?.spellIds ?? []),
      ...picked(draft, "evocation-savant", level),
    ]);
    for (const circle of [1, 2])
      add(
        `spell-mastery-${circle}`,
        `Мастерство заклинаний: ${circle} круг`,
        1,
        editionSpells(draft.edition).filter(
          (s) =>
            book.includes(s.id) &&
            s.level === circle &&
            (!is24 || s.castingTime === "Action"),
        ),
      );
  }
  if (c === "wizard" && level === 20)
    add(
      "signature-spells",
      "Фирменные заклинания: два заклинания 3 круга",
      2,
      editionSpells(draft.edition).filter(
        (s) =>
          s.level === 3 &&
          [
            ...(currentLevel(draft, level)?.spellIds ?? []),
            ...picked(draft, "evocation-savant", level),
          ].includes(s.id),
      ),
    );
  return result;
}

export function grantedSpellIds(
  draft: CharacterDraft,
  level: number,
  classOnly = false,
): string[] {
  const is24 = draft.edition === "2024",
    ids: string[] = [];
  const grant = (at: number, spells: string[]) => {
    if (level >= at) ids.push(...spells.map((s) => sid(s, draft.edition)));
  };
  const table = (rows: [number, string[]][]) =>
    rows.forEach(([at, s]) => grant(at, s));
  if (draft.classId === "cleric")
    table(
      is24
        ? [
            [3, ["aid", "bless", "cure-wounds", "lesser-restoration"]],
            [5, ["mass-healing-word", "revivify"]],
            [7, ["aura-of-life", "death-ward"]],
            [9, ["greater-restoration", "mass-cure-wounds"]],
          ]
        : [
            [1, ["bless", "cure-wounds"]],
            [3, ["lesser-restoration", "spiritual-weapon"]],
            [5, ["beacon-of-hope", "revivify"]],
            [7, ["death-ward", "guardian-of-faith"]],
            [9, ["mass-cure-wounds", "raise-dead"]],
          ],
    );
  if (draft.classId === "paladin") {
    table([
      [
        3,
        [
          "protection-from-evil-and-good",
          is24 ? "shield-of-faith" : "sanctuary",
        ],
      ],
      [5, [is24 ? "aid" : "lesser-restoration", "zone-of-truth"]],
      [9, ["beacon-of-hope", "dispel-magic"]],
      [13, ["freedom-of-movement", "guardian-of-faith"]],
      [17, ["commune", "flame-strike"]],
    ]);
    if (is24) {
      grant(2, ["divine-smite"]);
      grant(5, ["find-steed"]);
    }
  }
  if (is24 && draft.classId === "ranger") grant(1, ["hunters-mark"]);
  if (is24 && draft.classId === "druid") grant(1, ["speak-with-animals"]);
  if (is24 && draft.classId === "warlock") grant(9, ["contact-other-plane"]);
  if (is24 && draft.classId === "bard")
    grant(20, ["power-word-heal", "power-word-kill"]);
  if (is24 && draft.classId === "sorcerer")
    table([
      [3, ["alter-self", "chromatic-orb", "command", "dragons-breath"]],
      [5, ["fear", "fly"]],
      [7, ["arcane-eye", "charm-monster"]],
      [9, ["legend-lore", "summon-dragon"]],
    ]);
  if (is24 && draft.classId === "warlock")
    table([
      [3, ["burning-hands", "command", "scorching-ray", "suggestion"]],
      [5, ["fireball", "stinking-cloud"]],
      [7, ["fire-shield", "wall-of-fire"]],
      [9, ["geas", "insect-plague"]],
    ]);
  if (draft.classId === "druid") {
    const terrain = picked(draft, "land-terrain", level)[0];
    const rows: Record<string, string[][]> = is24
      ? {
          arid: [
            ["blur", "burning-hands", "fire-bolt"],
            ["fireball"],
            ["blight"],
            ["wall-of-stone"],
          ],
          polar: [
            ["fog-cloud", "hold-person", "ray-of-frost"],
            ["sleet-storm"],
            ["ice-storm"],
            ["cone-of-cold"],
          ],
          temperate: [
            ["misty-step", "shocking-grasp", "sleep"],
            ["lightning-bolt"],
            ["freedom-of-movement"],
            ["tree-stride"],
          ],
          tropical: [
            ["acid-splash", "ray-of-sickness", "web"],
            ["stinking-cloud"],
            ["polymorph"],
            ["insect-plague"],
          ],
        }
      : {
          arctic: [
            ["hold-person", "spike-growth"],
            ["sleet-storm", "slow"],
            ["freedom-of-movement", "ice-storm"],
            ["commune-with-nature", "cone-of-cold"],
          ],
          coast: [
            ["mirror-image", "misty-step"],
            ["water-breathing", "water-walk"],
            ["control-water", "freedom-of-movement"],
            ["conjure-elemental", "scrying"],
          ],
          desert: [
            ["blur", "silence"],
            ["create-food-and-water", "protection-from-energy"],
            ["blight", "hallucinatory-terrain"],
            ["insect-plague", "wall-of-stone"],
          ],
          forest: [
            ["barkskin", "spider-climb"],
            ["call-lightning", "plant-growth"],
            ["divination", "freedom-of-movement"],
            ["commune-with-nature", "tree-stride"],
          ],
          grassland: [
            ["invisibility", "pass-without-trace"],
            ["daylight", "haste"],
            ["divination", "freedom-of-movement"],
            ["dream", "insect-plague"],
          ],
          mountain: [
            ["spider-climb", "spike-growth"],
            ["lightning-bolt", "meld-into-stone"],
            ["stone-shape", "stoneskin"],
            ["passwall", "wall-of-stone"],
          ],
          swamp: [
            ["acid-arrow", "darkness"],
            ["water-walk", "stinking-cloud"],
            ["freedom-of-movement", "locate-creature"],
            ["insect-plague", "scrying"],
          ],
        };
    (rows[terrain] ?? []).forEach((spells, i) => grant(3 + 2 * i, spells));
  }
  if (classOnly) return unique(ids);
  if (draft.speciesId === "tiefling") {
    grant(1, ["thaumaturgy", ...(is24 ? ["fire-bolt"] : [])]);
    grant(3, ["hellish-rebuke"]);
    grant(5, ["darkness"]);
  }
  if (is24 && draft.speciesId === "high-elf") {
    grant(3, ["detect-magic"]);
    grant(5, ["misty-step"]);
  }
  if (is24 && draft.speciesId === "wood-elf") {
    grant(1, ["druidcraft"]);
    grant(3, ["longstrider"]);
    grant(5, ["pass-without-trace"]);
  }
  if (is24 && draft.speciesId === "rock-gnome")
    grant(1, ["mending", "prestidigitation"]);
  for (const l of draft.levels.filter((l) => l.level <= level))
    for (const [key, values] of Object.entries(l.featureChoices ?? {}))
      if (
        key.endsWith("-cantrips") ||
        key.endsWith("-cantrip") ||
        key.endsWith("-spell") ||
        key === "magical-secrets" ||
        key === "magical-discoveries" ||
        key === "signature-spells" ||
        key.startsWith("mystic-arcanum-") ||
        (is24 && key.startsWith("spell-mastery-"))
      )
        ids.push(...values);
  return unique(ids);
}

export function wizardAlwaysPreparedSpellIds(
  draft: CharacterDraft,
  level = draft.targetLevel,
): string[] {
  return draft.classId === "wizard"
    ? unique([
        ...picked(draft, "signature-spells", level),
        ...(draft.edition === "2024"
          ? ["spell-mastery-1", "spell-mastery-2"].flatMap((key) =>
              picked(draft, key, level),
            )
          : []),
      ])
    : [];
}

export function deriveCharacter(
  draft: CharacterDraft,
  level = draft.targetLevel,
): DerivedCharacter {
  const n = Math.max(1, Math.min(20, level)),
    cls = CLASSES.find((c) => c.id === draft.classId),
    species = availableSpecies(draft),
    background = availableBackground(draft),
    is24 = draft.edition === "2024";
  const abilities = finalAbilities(draft, n),
    modifiers = Object.fromEntries(
      ABILITIES.map((a) => [a, abilityModifier(abilities[a])]),
    ) as Record<Ability, number>;
  const proficiencyBonus = 2 + Math.floor((n - 1) / 4),
    l = currentLevel(draft, n),
    options = getLevelOptions(draft, n);
  const feats = FEATS.filter(
    (f) =>
      f.editions.includes(draft.edition) &&
      [
        ...(is24 ? [background?.featId] : []),
        ...picked(draft, "human-feat", n),
        ...draft.levels.filter((v) => v.level <= n).map((v) => v.featId),
      ].includes(f.id),
  );
  let armorClass = 10 + modifiers.dex;
  if (cls?.id === "barbarian") armorClass += modifiers.con;
  if (cls?.id === "monk") armorClass += modifiers.wis;
  if (cls?.id === "sorcerer" && (!is24 || n >= 3))
    armorClass = is24 ? 10 + modifiers.dex + modifiers.cha : 13 + modifiers.dex;
  armorClass = Math.max(10 + modifiers.dex, armorClass);
  let maxHp =
    Math.max(1, (cls?.hitDie ?? 8) + modifiers.con) +
    (n - 1) *
      Math.max(1, Math.floor((cls?.hitDie ?? 8) / 2) + 1 + modifiers.con);
  if (["hill-dwarf", "dwarf"].includes(draft.speciesId)) maxHp += n;
  if (cls?.id === "sorcerer" && (!is24 || n >= 3)) maxHp += n;
  let speed = species?.speed ?? 30;
  if (is24 && ["lightfoot-halfling", "rock-gnome"].includes(draft.speciesId))
    speed = 30;
  if (cls?.id === "barbarian" && n >= 5) speed += 10;
  if (cls?.id === "monk" && n >= 2) speed += 10 + Math.floor((n - 2) / 4) * 5;
  if (is24 && cls?.id === "ranger" && n >= 6) speed += 10;
  const skillIds = unique([
      ...draft.skillIds,
      ...(background?.skillIds ?? []),
      ...[
        "human-skill",
        "half-elf-skills",
        "background-skills",
        "elf-skill",
        "lore-skills",
      ].flatMap((k) => picked(draft, k, n)),
      ...(!is24 && draft.speciesId === "high-elf" ? ["perception"] : []),
      ...(draft.speciesId === "half-orc" ? ["intimidation"] : []),
    ]),
    expert = picked(draft, "expertise", n);
  const skills = SKILLS.map((s) => {
    const proficient = skillIds.includes(s.id);
    let bonus =
      modifiers[s.ability] +
      (proficient
        ? proficiencyBonus * (expert.includes(s.id) ? 2 : 1)
        : cls?.id === "bard" && n >= 2
          ? Math.floor(proficiencyBonus / 2)
          : !is24 &&
              cls?.id === "fighter" &&
              n >= 7 &&
              ["str", "dex", "con"].includes(s.ability)
            ? Math.ceil(proficiencyBonus / 2)
            : 0);
    if (
      is24 &&
      ((picked(draft, "divine-order", n).includes("thaumaturge") &&
        ["arcana", "religion"].includes(s.id)) ||
        (picked(draft, "primal-order", n).includes("magician") &&
          ["arcana", "nature"].includes(s.id)))
    )
      bonus += Math.max(1, modifiers.wis);
    return { ...s, proficient, bonus };
  });
  const extra = grantedSpellIds(draft, n),
    bookExtra = picked(draft, "evocation-savant", n),
    catalog = editionSpells(draft.edition);
  const selectedSpells = catalog.filter(
      (s) =>
        s.level > 0 &&
        [...(l?.spellIds ?? []), ...bookExtra, ...extra].includes(s.id),
    ),
    selectedCantrips = catalog.filter(
      (s) =>
        s.level === 0 && [...(l?.cantripIds ?? []), ...extra].includes(s.id),
    );
  const preparedSpells =
    options.spellMode === "spellbook"
      ? selectedSpells.filter((s) =>
          [...(l?.preparedSpellIds ?? []), ...extra].includes(s.id),
        )
      : selectedSpells;
  const features = Array.from(
    { length: n },
    (_, i) => getLevelOptions(draft, i + 1).features,
  ).flat();
  for (const step of draft.levels.filter((v) => v.level <= n))
    for (const group of getFeatureChoices(draft, step.level))
      for (const id of step.featureChoices?.[group.id] ?? []) {
        const option = group.options.find((o) => o.id === id);
        if (option)
          features.push({
            id: `choice-${step.level}-${group.id}-${id}`,
            name: option.name,
            description:
              SPELLS.find((s) => s.id === option.id)?.summary ||
              option.description,
            level: step.level,
          });
      }
  const spellAbility =
    options.maxSpellLevel > 0 || options.cantripCount > 0
      ? cls?.spellAbility
      : undefined;
  const spellcastingSources: SpellcastingSource[] = [];
  const source = (
    id: string,
    name: string,
    ability: Ability,
    ids: string[],
  ) => {
    if (ids.length)
      spellcastingSources.push({
        id,
        name,
        ability,
        saveDc: 8 + proficiencyBonus + modifiers[ability],
        attackBonus: proficiencyBonus + modifiers[ability],
        spellIds: unique(ids),
      });
  };
  if (spellAbility)
    source("class", cls?.name ?? "Класс", spellAbility, [
      ...(l?.spellIds ?? []),
      ...(l?.cantripIds ?? []),
      ...bookExtra,
      ...grantedSpellIds(draft, n, true),
      ...[
        "order-cantrip",
        "land-cantrip",
        "magical-secrets",
        "magical-discoveries",
        "signature-spells",
        "mystic-arcanum-6",
        "mystic-arcanum-7",
        "mystic-arcanum-8",
        "mystic-arcanum-9",
      ].flatMap((key) => picked(draft, key, n)),
    ]);
  const innate = grantedSpellIds(
    {
      ...draft,
      classId: "fighter",
      levels: draft.levels.map((step) => ({
        ...step,
        featureChoices: {
          "elf-cantrip": step.featureChoices?.["elf-cantrip"] ?? [],
        },
      })),
    },
    n,
  );
  source(
    "innate",
    `Врождённая магия: ${species?.name ?? ""}`,
    (picked(draft, "innate-ability", n)[0] as Ability) ||
      (!is24 && draft.speciesId === "tiefling" ? "cha" : "int"),
    innate,
  );
  for (const feat of feats.filter((f) => f.id.startsWith("magic-initiate-")))
    source(
      feat.id,
      feat.name,
      (picked(draft, `${feat.id}-ability`, n)[0] as Ability) || "int",
      [
        ...picked(draft, `${feat.id}-cantrips`, n),
        ...picked(draft, `${feat.id}-spell`, n),
      ],
    );
  const primarySource =
    spellcastingSources.find((s) => s.id === "class") ?? spellcastingSources[0];
  const saveProficient = (a: Ability) =>
    !!cls?.savingThrows.includes(a) ||
    (cls?.id === "monk" && n >= 14) ||
    (cls?.id === "rogue" && n >= 15 && (a === "wis" || (is24 && a === "cha")));
  return {
    level: n,
    class: cls,
    species,
    background,
    subclass: cls?.subclasses.find((s) =>
      draft.levels.some((v) => v.level <= n && v.subclassId === s.id),
    ),
    abilities,
    modifiers,
    proficiencyBonus,
    maxHp,
    armorClass,
    initiative:
      modifiers.dex +
      (feats.some((f) => f.id === "alert") ? proficiencyBonus : 0) +
      (!is24 && cls?.id === "bard" && n >= 2
        ? Math.floor(proficiencyBonus / 2)
        : !is24 && cls?.id === "fighter" && n >= 7
          ? Math.ceil(proficiencyBonus / 2)
          : 0),
    speed,
    passivePerception:
      10 + (skills.find((s) => s.id === "perception")?.bonus ?? 0),
    skills,
    savingThrows: ABILITIES.map((a) => ({
      ability: a,
      name: ABILITY_LABELS[a],
      proficient: saveProficient(a),
      bonus:
        modifiers[a] +
        (saveProficient(a) ? proficiencyBonus : 0) +
        (cls?.id === "paladin" && n >= 6 ? Math.max(1, modifiers.cha) : 0),
    })),
    spellSaveDc: primarySource?.saveDc ?? null,
    spellAttackBonus: primarySource?.attackBonus ?? null,
    spellcastingSources,
    spellSlots: options.spellSlots,
    pactSlots: options.pactSlots,
    pactSlotLevel: options.pactSlotLevel,
    selectedSpells,
    selectedCantrips,
    preparedSpells,
    features,
    traits: (species?.traits ?? [])
      .filter((t) => !t.startsWith(is24 ? "2014:" : "2024:"))
      .map((t) => t.replace(/^(2014|2024): /, "")),
    feats,
    hitDice: `${n}d${cls?.hitDie ?? 8}`,
    warnings: [
      "КД рассчитан без доспехов и щита. Снаряжение, языки, инструменты и расходуемые ресурсы внесите в заметки по правилам кампании.",
      "Один класс, фиксированный прирост хитов. Подклассы и черты — выбранная открытая подборка; мультикласс и другие книги не включены.",
    ],
  };
}

export function validateDraft(
  draft: CharacterDraft,
  config: { throughLevel?: number; requireComplete?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [],
    limit = config.throughLevel ?? draft.targetLevel,
    complete = config.requireComplete !== false,
    is24 = draft.edition === "2024";
  const issue = (
    step: ValidationIssue["step"],
    code: string,
    message: string,
    level?: number,
  ) => issues.push({ step, code, message, ...(level ? { level } : {}) });
  const cls = CLASSES.find((c) => c.id === draft.classId),
    species = availableSpecies(draft),
    background = availableBackground(draft);
  if (!["2014", "2024"].includes(draft.edition))
    issue("identity", "edition", "Выберите редакцию 2014 или 2024.");
  if (!draft.name.trim()) issue("identity", "name", "Укажите имя персонажа.");
  if (!draft.playerName.trim())
    issue("identity", "player-name", "Укажите имя игрока.");
  if (
    !Number.isInteger(draft.targetLevel) ||
    draft.targetLevel < 1 ||
    draft.targetLevel > 20
  )
    issue("identity", "target-level", "Уровень должен быть от 1 до 20.");
  if (!cls) issue("origin", "class", "Выберите класс.");
  if (!species)
    issue("origin", "species", "Выберите происхождение из этой редакции.");
  if (!background)
    issue("origin", "background", "Выберите предысторию из этой редакции.");
  if (
    ABILITIES.some(
      (a) =>
        !Number.isInteger(draft.abilities[a]) ||
        draft.abilities[a] < 8 ||
        draft.abilities[a] > 15,
    )
  )
    issue(
      "abilities",
      "ability-range",
      "Базовые характеристики должны быть целыми числами от 8 до 15.",
    );
  if (
    draft.abilityMethod === "standard" &&
    Object.values(draft.abilities)
      .sort((a, b) => b - a)
      .join(",") !== STANDARD_ARRAY.join(",")
  )
    issue(
      "abilities",
      "standard-array",
      "Распределите стандартный набор: 15, 14, 13, 12, 10, 8.",
    );
  if (
    draft.abilityMethod === "point-buy" &&
    pointBuySpent(draft.abilities) > 27
  )
    issue(
      "abilities",
      "point-buy",
      "Для покупки характеристик доступно 27 очков.",
    );
  if (!["standard", "point-buy"].includes(draft.abilityMethod))
    issue(
      "abilities",
      "ability-method",
      "Выберите стандартный набор или покупку очков.",
    );
  const bonuses = ABILITIES.map((a) => draft.abilityBonuses[a]);
  if (bonuses.some((b) => !Number.isInteger(b) || b < 0 || b > 2))
    issue(
      "abilities",
      "bonuses-range",
      "Бонусы происхождения: целые числа от 0 до 2.",
    );
  if (is24) {
    const nonzero = bonuses
      .filter(Boolean)
      .sort((a, b) => b - a)
      .join(",");
    if (
      !["2,1", "1,1,1"].includes(nonzero) ||
      ABILITIES.some(
        (a) =>
          draft.abilityBonuses[a] > 0 && !background?.abilities2024.includes(a),
      )
    )
      issue(
        "abilities",
        "background-bonuses",
        "Предыстория даёт +2 и +1 к двум разрешённым характеристикам или +1 ко всем трём.",
      );
  } else if (species) {
    const extra = ABILITIES.map(
      (a) => draft.abilityBonuses[a] - (species.bonuses2014[a] ?? 0),
    );
    if (
      species.flexibleBonuses2014
        ? extra.some(
            (v, i) => v < 0 || v > 1 || (v > 0 && ABILITIES[i] === "cha"),
          ) || extra.reduce((a, b) => a + b, 0) !== 2
        : extra.some((v) => v !== 0)
    )
      issue(
        "abilities",
        "species-bonuses",
        "Бонусы характеристик должны соответствовать выбранной расе 2014.",
      );
  }
  if (
    cls &&
    (draft.skillIds.length !== cls.skillCount ||
      unique(draft.skillIds).length !== draft.skillIds.length ||
      draft.skillIds.some(
        (id) =>
          !cls.skillIds.includes(id) ||
          background?.skillIds.includes(id) ||
          (!is24 && draft.speciesId === "high-elf" && id === "perception") ||
          (draft.speciesId === "half-orc" && id === "intimidation"),
      ))
  )
    issue(
      "skills",
      "class-skills",
      `Выберите ${cls.skillCount} разных навыка класса, не повторяя навыки предыстории и происхождения.`,
    );
  if (
    unique(draft.levels.map((l) => l.level)).length !== draft.levels.length ||
    draft.levels.some(
      (l) =>
        !Number.isInteger(l.level) ||
        l.level < 1 ||
        l.level > draft.targetLevel,
    )
  )
    issue(
      "level",
      "level-order",
      "Уровни должны быть уникальными и в пределах выбранного уровня.",
    );
  for (let n = 1; n <= Math.min(20, limit); n++) {
    const l = currentLevel(draft, n);
    if (!l) {
      if (complete)
        issue(
          "level",
          "missing-level",
          `Пройдите повышение до ${n} уровня.`,
          n,
        );
      continue;
    }
    const o = getLevelOptions(draft, n),
      previous = currentLevel(draft, n - 1),
      asi = ABILITIES.map((a) => l.asi?.[a] ?? 0),
      asiSum = asi.reduce((a, b) => a + b, 0),
      feat = l.featId
        ? FEATS.find(
            (f) => f.id === l.featId && f.editions.includes(draft.edition),
          )
        : undefined;
    const add = (code: string, message: string) =>
      issue("level", code, message, n);
    if (o.subclassRequired && !l.subclassId)
      add("subclass", "Выберите подкласс.");
    if (
      l.subclassId &&
      (!o.subclasses.some((s) => s.id === l.subclassId) ||
        n < (is24 ? 3 : (cls?.subclasses[0]?.level2014 ?? 3)))
    )
      add("subclass-invalid", "Подкласс недоступен на этом уровне.");
    if (asi.some((v) => !Number.isInteger(v) || v < 0 || v > 2))
      add("asi-invalid", "Некорректное повышение характеристики.");
    if (o.asiAvailable || o.epicBoonAvailable) {
      if (l.featId) {
        if (!feat || !o.feats.some((f) => f.id === l.featId))
          add("feat-unavailable", "Эта черта недоступна на этом уровне.");
        const wanted = is24 && feat?.ability ? 1 : 0;
        if (
          asiSum !== wanted ||
          (asiSum > 0 &&
            ABILITIES.some(
              (a) => (l.asi?.[a] ?? 0) > 0 && !feat?.ability?.includes(a),
            ))
        )
          add(
            "feat-bonus",
            wanted
              ? "Выберите +1 к характеристике от черты."
              : "Эта черта заменяет повышение характеристик.",
          );
        if (l.featId === "grappler") {
          const before = finalAbilities(
            {
              ...draft,
              levels: draft.levels.map((v) =>
                v.level === n ? { ...v, asi: {} } : v,
              ),
            },
            n,
          );
          if (is24 ? Math.max(before.str, before.dex) < 13 : before.str < 13)
            add(
              "feat-prerequisite",
              is24
                ? "Борец требует Силу или Ловкость 13."
                : "Борец требует Силу 13.",
            );
        }
        if (
          draft.levels.some((v) => v.level < n && v.featId === l.featId) ||
          (is24 &&
            [background?.featId, ...picked(draft, "human-feat", n)].includes(
              l.featId,
            ))
        )
          add("feat-repeat", "Эту черту нельзя взять повторно.");
      } else if (asiSum !== 2)
        add(
          "asi-required",
          "Распределите +2 к характеристикам или выберите черту.",
        );
    } else if (l.featId || asiSum)
      add("asi-level", "На этом уровне нет улучшения характеристик или черты.");
    const values = finalAbilities(draft, n);
    if (
      ABILITIES.some(
        (a) =>
          (l.asi?.[a] ?? 0) > 0 &&
          values[a] > (feat?.category === "epic" ? 30 : 20),
      )
    )
      add(
        "ability-cap",
        "Повышение не может превысить 20 (эпический дар: 30).",
      );
    const countCheck = (
      values: string[],
      count: number,
      allowed: SpellOption[],
      label: string,
    ) => {
      if (unique(values).length !== values.length || values.length !== count)
        add(
          "spell-count",
          `${label}: выберите ${count}. Сейчас ${values.length}.`,
        );
      if (values.some((id) => !allowed.some((s) => s.id === id)))
        add(
          "spell-unavailable",
          `${label}: выбрано заклинание другого класса, круга или редакции.`,
        );
    };
    countCheck(
      l.spellIds,
      o.spellCount,
      o.spells,
      o.spellMode === "spellbook"
        ? "Заклинания в основной книге"
        : "Заклинания класса",
    );
    countCheck(l.cantripIds, o.cantripCount, o.cantrips, "Заговоры класса");
    if (o.spellMode === "spellbook") {
      const book = unique([
          ...l.spellIds,
          ...picked(draft, "evocation-savant", n),
        ]).filter((id) => !wizardAlwaysPreparedSpellIds(draft, n).includes(id)),
        prepared = l.preparedSpellIds ?? [];
      if (
        prepared.length !== Math.min(o.preparedCount, book.length) ||
        unique(prepared).length !== prepared.length ||
        prepared.some((id) => !book.includes(id))
      )
        add(
          "prepared-spells",
          `Подготовьте ${Math.min(o.preparedCount, book.length)} заклинаний из книги.`,
        );
      if (previous && previous.spellIds.some((id) => !l.spellIds.includes(id)))
        add(
          "spellbook-retain",
          "При повышении сохраняйте все заклинания в книге предыдущего уровня.",
        );
    }
    if (previous) {
      const removed = previous.spellIds.filter(
        (id) =>
          !l.spellIds.includes(id) &&
          !grantedSpellIds(draft, n, true).includes(id),
      ).length;
      if (
        ["bard", "sorcerer", "warlock", "ranger"].includes(draft.classId) &&
        removed > 1
      )
        add(
          "spell-replacement",
          "При повышении можно заменить не более одного заклинания класса.",
        );
      const replacedCantrips = previous.cantripIds.filter(
        (id) => !l.cantripIds.includes(id),
      ).length;
      if (
        replacedCantrips > (is24 ? (draft.classId === "wizard" ? 100 : 1) : 0)
      )
        add(
          "cantrip-replacement",
          is24
            ? "При повышении можно заменить один заговор."
            : "В SRD 2014 заговоры не заменяются при повышении.",
        );
    }
    const groups = getFeatureChoices(draft, n);
    for (const group of groups) {
      const selections = l.featureChoices?.[group.id] ?? [];
      if (
        selections.length !== group.count ||
        unique(selections).length !== selections.length ||
        selections.some((id) => !group.options.some((s) => s.id === id))
      )
        add(
          "feature-choice",
          `${group.name}: выберите ${group.count} доступных варианта.`,
        );
    }
    for (const [key, values] of Object.entries(l.featureChoices ?? {}))
      if (values.length && !groups.some((g) => g.id === key))
        add(
          "unknown-feature",
          "Этот выбор особенности недоступен на данном уровне.",
        );
  }
  return issues;
}

export function recommendLevelChoices(
  draft: CharacterDraft,
  level: number,
): LevelChoice {
  const prev = currentLevel(draft, level - 1),
    existing = currentLevel(draft, level),
    choice: LevelChoice = {
      level,
      spellIds: [...(existing?.spellIds ?? prev?.spellIds ?? [])],
      cantripIds: [...(existing?.cantripIds ?? prev?.cantripIds ?? [])],
      preparedSpellIds: [...(existing?.preparedSpellIds ?? [])],
      featureChoices: structuredClone(existing?.featureChoices ?? {}),
      ...(existing?.asi ? { asi: { ...existing.asi } } : {}),
      ...(existing?.featId ? { featId: existing.featId } : {}),
      ...((existing?.subclassId ?? prev?.subclassId)
        ? { subclassId: existing?.subclassId ?? prev?.subclassId }
        : {}),
    };
  const working: CharacterDraft = {
    ...draft,
    levels: [...draft.levels.filter((l) => l.level !== level), choice],
  };
  let options = getLevelOptions(working, level);
  if (
    options.subclassRequired &&
    !options.subclasses.some((s) => s.id === choice.subclassId)
  )
    choice.subclassId = options.subclasses[0]?.id;
  if (options.asiAvailable || options.epicBoonAvailable) {
    choice.asi ??= {};
    if (
      options.epicBoonAvailable &&
      !choice.featId &&
      !Object.values(choice.asi).some(Boolean)
    ) {
      choice.featId = "boon-truesight";
      choice.asi.int = 1;
    } else if (choice.featId) {
      const feat = options.feats.find((f) => f.id === choice.featId);
      if (
        draft.edition === "2024" &&
        feat?.ability &&
        !Object.values(choice.asi).some(Boolean)
      )
        choice.asi[feat.ability[0]] = 1;
    } else {
      const existingPoints = Object.values(choice.asi).reduce(
        (a, b) => a + (b ?? 0),
        0,
      );
      for (let count = existingPoints; count < 2; count++) {
        const values = finalAbilities(working, level),
          order = unique([
            ...(CLASSES.find((c) => c.id === draft.classId)?.primaryAbilities ??
              []),
            ...ABILITIES,
          ]),
          a = order.find((a) => values[a] < 20);
        if (a) choice.asi[a] = (choice.asi[a] ?? 0) + 1;
      }
    }
  }
  options = getLevelOptions(working, level);
  const fill = (selected: string[], catalog: SpellOption[], count: number) =>
    unique([
      ...selected.filter((id) => catalog.some((s) => s.id === id)),
      ...catalog.map((s) => s.id),
    ]).slice(0, count);
  choice.spellIds = fill(
    choice.spellIds,
    [...options.spells].sort((a, b) => b.level - a.level),
    options.spellCount,
  );
  choice.cantripIds = fill(
    choice.cantripIds,
    options.cantrips,
    options.cantripCount,
  );
  for (let pass = 0; pass < 3; pass++)
    for (const group of getFeatureChoices(working, level)) {
      const current = choice.featureChoices?.[group.id] ?? [],
        occupied = new Set([
          ...choice.spellIds,
          ...choice.cantripIds,
          ...Object.entries(choice.featureChoices ?? {})
            .filter(([key]) => key !== group.id)
            .flatMap(([, values]) => values),
        ]),
        ordered = [...group.options].sort(
          (a, b) => Number(occupied.has(a.id)) - Number(occupied.has(b.id)),
        );
      choice.featureChoices![group.id] = unique([
        ...current.filter((id) => group.options.some((o) => o.id === id)),
        ...ordered.map((o) => o.id),
      ]).slice(0, group.count);
    }
  if (options.spellMode === "spellbook") {
    const book = unique([
      ...choice.spellIds,
      ...picked(working, "evocation-savant", level),
    ])
      .filter(
        (id) => !wizardAlwaysPreparedSpellIds(working, level).includes(id),
      )
      .sort(
        (a, b) =>
          (SPELLS.find((s) => s.id === b)?.level ?? 0) -
          (SPELLS.find((s) => s.id === a)?.level ?? 0),
      );
    choice.preparedSpellIds = unique([
      ...(choice.preparedSpellIds ?? []).filter((id) => book.includes(id)),
      ...book,
    ]).slice(0, options.preparedCount);
  }
  return choice;
}

const FEATURES_2024: Record<
  string,
  { level: number; name: string; description: string }[]
> = {
  barbarian: [
    {
      level: 1,
      name: "Rage",
      description:
        "You can imbue yourself with a primal power called Rage, a force that grants you extraordinary might and resilience. You can enter it as a Bonus Action if you aren’t wearing Heavy armor. You can enter your Rage the number of times shown for your Barbarian level in the Rages…",
    },
    {
      level: 1,
      name: "Unarmored Defense",
      description:
        "While you aren’t wearing any armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield and still gain this…",
    },
    {
      level: 1,
      name: "Weapon Mastery",
      description:
        "Your training with weapons allows you to use the mastery properties of two kinds of Simple or Martial Melee weapons of your choice, such as Greataxes and Handaxes. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices. When you…",
    },
    {
      level: 2,
      name: "Danger Sense",
      description:
        "You gain an uncanny sense of when things aren’t as they should be, giving you an edge when you dodge perils. You have Advantage on Dexterity saving throws unless you have the Incapacitated…",
    },
    {
      level: 2,
      name: "Reckless Attack",
      description:
        "You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack roll on your turn, you can decide to attack recklessly. Doing so gives you Advantage on attack rolls using Strength until the start of your next turn, but attack rolls…",
    },
    {
      level: 3,
      name: "Barbarian Subclass",
      description:
        "You gain a Barbarian subclass of your choice. The Path of the Berserker subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Barbarian levels. For the rest of your career, you gain each of your subclass’s…",
    },
    {
      level: 3,
      name: "Primal Knowledge",
      description:
        "You gain proficiency in another skill of your choice from the skill list available to Barbarians at level 1. In addition, while your Rage is active, you can channel primal power when you attempt certain tasks; whenever you make an ability check using one of the following skills,…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Barbarian levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Extra Attack",
      description:
        "You can attack twice instead of once whenever you take the Attack action on your…",
    },
    {
      level: 5,
      name: "Fast Movement",
      description:
        "Your speed increases by 10 feet while you aren’t wearing Heavy…",
    },
    {
      level: 7,
      name: "Feral Instinct",
      description:
        "Your instincts are so honed that you have Advantage on Initiative…",
    },
    {
      level: 7,
      name: "Instinctive Pounce",
      description:
        "As part of the Bonus Action you take to enter your Rage, you can move up to half your…",
    },
    {
      level: 9,
      name: "Brutal Strike",
      description:
        "If you use Reckless Attack, you can forgo any Advantage on one Strength-based attack roll of your choice on your turn. The chosen attack roll mustn’t have Disadvantage. If the chosen attack roll hits, the target takes an extra 1d10 damage of the same type dealt by the weapon or…",
    },
    {
      level: 11,
      name: "Relentless Rage",
      description:
        "Your Rage can keep you fighting despite grievous wounds. If you drop to 0 Hit Points while your Rage is active and don’t die outright, you can make a DC 10 Constitution saving throw. If you succeed, your Hit Points instead change to a number equal to twice your Barbarian level.…",
    },
    {
      level: 13,
      name: "Improved Brutal Strike",
      description:
        "You have honed new ways to attack furiously. The following effects are now among your Brutal Strike options. Staggering Blow. The target has Disadvantage on the next saving throw it makes, and it can’t make Opportunity Attacks until the start of your next turn. Sundering Blow.…",
    },
    {
      level: 15,
      name: "Persistent Rage",
      description:
        "When you roll Initiative, you can regain all expended uses of Rage. After you regain uses of Rage in this way, you can’t do so again until you finish a Long Rest. In addition, your Rage is so fierce that it now lasts for 10 minutes without you needing to do anything to extend it…",
    },
    {
      level: 17,
      name: "Improved Brutal Strike",
      description:
        "The extra damage of your Brutal Strike increases to 2d10. In addition, you can use two different Brutal Strike effects whenever you use your Brutal Strike…",
    },
    {
      level: 18,
      name: "Indomitable Might",
      description:
        "If your total for a Strength check or Strength saving throw is less than your Strength score, you can use that score in place of the…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Irresistible Offense is…",
    },
    {
      level: 20,
      name: "Primal Champion",
      description:
        "You embody primal power. Your Strength and Constitution scores increase by 4, to a maximum of 25. Barbarian Subclass: Path of the Berserker Channel Rage into Violent Fury Barbarians who walk the Path of the Berserker direct their Rage primarily toward violence. Their path is one…",
    },
    {
      level: 3,
      name: "Frenzy",
      description:
        "If you use Reckless Attack while your Rage is active, you deal extra damage to the first target you hit on your turn with a Strength-based attack. To determine the extra damage, roll a number of d6s equal to your Rage Damage bonus, and add them together. The damage has the same…",
    },
    {
      level: 6,
      name: "Mindless Rage",
      description:
        "You have Immunity to the Charmed and Frightened conditions while your Rage is active. If you’re Charmed or Frightened when you enter your Rage, the condition ends on…",
    },
    {
      level: 10,
      name: "Retaliation",
      description:
        "When you take damage from a creature that is within 5 feet of you, you can take a Reaction to make one melee attack against that creature, using a weapon or an Unarmed…",
    },
    {
      level: 14,
      name: "Intimidating Presence",
      description:
        "As a Bonus Action, you can strike terror into others with your menacing presence and primal power. When you do so, each creature of your choice in a 30-foot Emanation originating from you must make a Wisdom saving throw (DC 8 plus your Strength modifier and Proficiency Bonus).…",
    },
  ],
  bard: [
    {
      level: 1,
      name: "Bardic Inspiration",
      description:
        "You can supernaturally inspire others through words, music, or dance. This inspiration is represented by your Bardic Inspiration die, which is a d6. Using Bardic Inspiration. As a Bonus Action, you can inspire another creature within 60 feet of yourself who can see or hear you.…",
    },
    {
      level: 1,
      name: "Spellcasting",
      description:
        "You have learned to cast spells through your bardic arts. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Bard spells, which appear in the Bard spell list later in the class’s description. Cantrips. You know two cantrips of…",
    },
    {
      level: 2,
      name: "Expertise",
      description:
        "You gain Expertise (see “Rules Glossary”) in two of your skill proficiencies of your choice. Performance and Persuasion are recommended if you have proficiency in them. At Bard level 9, you gain Expertise in two more of your skill proficiencies of your…",
    },
    {
      level: 2,
      name: "Jack of All Trades",
      description:
        "You can add half your Proficiency Bonus (round down) to any ability check you make that uses a skill proficiency you lack and that doesn’t otherwise use your Proficiency Bonus. For example, if you make a Strength (Athletics) check and lack Athletics proficiency, you can add half…",
    },
    {
      level: 3,
      name: "Bard Subclass",
      description:
        "You gain a Bard subclass of your choice. The College of Lore subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Bard levels. For the rest of your career, you gain each of your subclass’s features that are of…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Bard levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Font of Inspiration",
      description:
        "You now regain all your expended uses of Bardic Inspiration when you finish a Short or Long Rest. In addition, you can expend a spell slot (no action required) to regain one expended use of Bardic Inspiration. System Reference Document 5.2.1…",
    },
    {
      level: 7,
      name: "Countercharm",
      description:
        "You can use musical notes or words of power to disrupt mind-influencing effects. If you or a creature within 30 feet of you fails a saving throw against an effect that applies the Charmed or Frightened condition, you can take a Reaction to cause the save to be rerolled, and the…",
    },
    {
      level: 10,
      name: "Magical Secrets",
      description:
        "You’ve learned secrets from various magical traditions. Whenever you reach a Bard level (including this level) and the Prepared Spells number in the Bard Features table increases, you can choose any of your new prepared spells from the Bard, Cleric, Druid, and Wizard spell…",
    },
    {
      level: 18,
      name: "Superior Inspiration",
      description:
        "When you roll Initiative, you regain expended uses of Bardic Inspiration until you have two if you have fewer than…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Spell Recall is…",
    },
    {
      level: 20,
      name: "Words of Creation",
      description:
        "You have mastered two of the Words of Creation: the words of life and death. You therefore always have the Power Word Heal and Power Word Kill spells prepared. When you cast either spell, you can target a second creature with it if that creature is within 10 feet of the first…",
    },
    {
      level: 3,
      name: "Bonus Proficiencies",
      description: "You gain proficiency with three skills of your…",
    },
    {
      level: 3,
      name: "Cutting Words",
      description:
        "You learn to use your wit to supernaturally distract, confuse, and otherwise sap the confidence and competence of others. When a creature that you can see within 60 feet of yourself makes a damage roll or succeeds on an ability check or attack roll, you can take a Reaction to…",
    },
    {
      level: 6,
      name: "Magical Discoveries",
      description:
        "You learn two spells of your choice. These spells can come from the Cleric, Druid, or Wizard spell list or any combination thereof (see a class’s section for its spell list). A spell you choose must be a cantrip or a spell for which you have spell slots, as shown in the Bard…",
    },
    {
      level: 14,
      name: "Peerless Skill",
      description:
        "When you make an ability check or attack roll and fail, you can expend one use of Bardic Inspiration; roll the Bardic Inspiration die, and add the number rolled to the d20, potentially turning a failure into a success. On a failure, the Bardic Inspiration isn’t expended. System…",
    },
  ],
  cleric: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "You have learned to cast spells through prayer and meditation. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Cleric spells, which appear on the Cleric spell list later in the class’s description. Cantrips. You know three…",
    },
    {
      level: 1,
      name: "Divine Order",
      description:
        "You have dedicated yourself to one of the following sacred roles of your choice. Protector. Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor. Thaumaturge. You know one extra cantrip from the Cleric spell list. In addition, your mystical…",
    },
    {
      level: 2,
      name: "Channel Divinity",
      description:
        "You can channel divine energy directly from the Outer Planes to fuel magical effects. You start with two such effects: Divine Spark and Turn Undead, each of which is described below. Each time you use this class’s Channel Divinity, choose which Channel Divinity effect from this…",
    },
    {
      level: 3,
      name: "Cleric Subclass",
      description:
        "You gain a Cleric subclass of your choice. The Life Domain subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Cleric levels. For the rest of your career, you gain each of your subclass’s features that are of…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Cleric levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Sear Undead",
      description:
        "Whenever you use Turn Undead, you can roll a number of d8s equal to your Wisdom modifier (minimum of 1d8) and add the rolls together. Each Undead that fails its saving throw against that use of Turn Undead takes Radiant damage equal to the roll’s total. This damage doesn’t end…",
    },
    {
      level: 7,
      name: "Blessed Strikes",
      description:
        "Divine power infuses you in battle. You gain one of the following options of your choice (if you get either option from a Cleric subclass in an older book, use only the option you choose for this feature). Divine Strike. Once on each of your turns when you hit a creature with an…",
    },
    {
      level: 10,
      name: "Divine Intervention",
      description:
        "You can call on your deity or pantheon to intervene on your behalf. As a Magic action, choose any Cleric spell of level 5 or lower that doesn’t require a Reaction to cast. As part of the same action, you cast that spell without expending a spell slot or needing Material…",
    },
    {
      level: 14,
      name: "Improved Blessed Strikes",
      description:
        "The option you chose for Blessed Strikes grows more powerful. Divine Strike. The extra damage of your Divine Strike increases to 2d8. Potent Spellcasting. When you cast a Cleric cantrip and deal damage to a creature with it, you can give vitality to yourself or another creature…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Fate is…",
    },
    {
      level: 20,
      name: "Greater Divine Intervention",
      description:
        "You can call on even more powerful divine intervention. When you use your Divine Intervention feature, you can choose Wish when you select a spell. If you do so, you can’t use Divine Intervention again until you finish 2d4 Long Rests. Cleric Spell List This section presents the…",
    },
    {
      level: 3,
      name: "Disciple of Life",
      description:
        "When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains additional Hit Points on the turn you cast the spell. The additional Hit Points equal 2 plus the spell slot’s…",
    },
    {
      level: 3,
      name: "Life Domain Spells",
      description:
        "Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric level specified in the Life Domain Spells table, you thereafter always have the listed spells prepared. Life Domain Spells Cleric Level Prepared Spells 3 Aid, Bless, Cure…",
    },
    {
      level: 3,
      name: "Preserve Life",
      description:
        "As a Magic action, you present your Holy Symbol and expend a use of your Channel Divinity to evoke healing energy that can restore a number of Hit Points equal to five times your Cleric level. Choose Bloodied creatures within 30 feet of yourself (which can include you), and…",
    },
    {
      level: 6,
      name: "Blessed Healer",
      description:
        "The healing spells you cast on others heal you as well. Immediately after you cast a spell with a spell slot that restores Hit Points to one or more creatures other than yourself, you regain Hit Points equal to 2 plus the spell slot’s…",
    },
    {
      level: 17,
      name: "Supreme Healing",
      description:
        "When you would normally roll one or more dice to restore Hit Points to a creature with a spell or Channel Divinity, don’t roll those dice for the healing; instead use the highest number possible for each die. For example, instead of restoring 2d6 Hit Points to a creature with a…",
    },
  ],
  druid: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "You have learned to cast spells through studying the mystical forces of nature. See “Spells” for the rules on spellcasting. The information below details Druid Features Proficiency Bonus Wild Shape Prepared Spells ——Spell Slots per Spell Level—— Level Class Features Cantrips 1 2…",
    },
    {
      level: 1,
      name: "Druidic",
      description:
        "You know Druidic, the secret language of Druids. While learning this ancient tongue, you also unlocked the magic of communicating with animals; you always have the Speak with Animals spell prepared. You can use Druidic to leave hidden messages. You and others who know Druidic…",
    },
    {
      level: 1,
      name: "Primal Order",
      description:
        "You have dedicated yourself to one of the following sacred roles of your choice. Magician. You know one extra cantrip from the Druid spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks. The bonus equals…",
    },
    {
      level: 2,
      name: "Wild Shape",
      description:
        "The power of nature allows you to assume the form of an animal. As a Bonus Action, you shape-shift into a Beast form that you have learned for this feature (see “Known Forms” below). You stay in that form for a number of hours equal to half your Druid level or until you use Wild…",
    },
    {
      level: 2,
      name: "Wild Companion",
      description:
        "You can summon a nature spirit that assumes an animal form to aid you. As a Magic action, you can expend a spell slot or a use of Wild Shape to cast the Find Familiar spell without Material components. When you cast the spell in this way, the familiar is Fey and disappears when…",
    },
    {
      level: 3,
      name: "Druid Subclass",
      description:
        "You gain a Druid subclass of your choice. The Circle of the Land subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Druid levels. For the rest of your career, you gain each of your subclass’s features that are…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Druid levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Wild Resurgence",
      description:
        "Once on each of your turns, if you have no uses of Wild Shape left, you can give yourself one use by expending a spell slot (no action required). In addition, you can expend one use of Wild Shape (no action required) to give yourself a level 1 spell slot, but you can’t do so…",
    },
    {
      level: 7,
      name: "Elemental Fury",
      description:
        "The might of the elements flows through you. You gain one of the following options of your choice. Potent Spellcasting. Add your Wisdom modifier to the damage you deal with any Druid cantrip. Primal Strike. Once on each of your turns when you hit a creature with an attack roll…",
    },
    {
      level: 15,
      name: "Improved Elemental Fury",
      description:
        "The option you chose for Elemental Fury grows more powerful, as detailed below. Potent Spellcasting. When you cast a Druid cantrip with a range of 10 feet or greater, the spell’s range increases by 300 feet. Primal Strike. The extra damage of your Primal Strike increases to…",
    },
    {
      level: 18,
      name: "Beast Spells",
      description:
        "While using Wild Shape, you can cast spells in Beast form, except for any spell that has a Material component with a cost specified or that consumes its Material…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Dimensional Travel is…",
    },
    {
      level: 20,
      name: "Archdruid",
      description:
        "The vitality of nature constantly blooms within you, granting you the following benefits. Evergreen Wild Shape. Whenever you roll Initiative and have no uses of Wild Shape left, you regain one expended use of it. Nature Magician. You can convert uses of Wild Shape into a spell…",
    },
    {
      level: 3,
      name: "Circle of the Land Spells",
      description:
        "Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. Consult the table below that corresponds to the chosen type; you have the spells listed for your Druid level and lower prepared. Arid Land Druid Level Circle Spells 3 Blur, Burning…",
    },
    {
      level: 3,
      name: "Land’s Aid",
      description:
        "As a Magic action, you can expend a use of your Wild Shape and choose a point within 60 feet of yourself. Vitality-giving flowers and life-draining thorns appear for a moment in a 10-foot-radius Sphere centered on that point. Each creature of your choice in the Sphere must make…",
    },
    {
      level: 6,
      name: "Natural Recovery",
      description:
        "You can cast one of the level 1+ spells that you have prepared from your Circle Spells feature without expending a spell slot, and you must finish a Long Rest before you do so again. In addition, when you finish a Short Rest, you can choose expended spell slots to recover. The…",
    },
    {
      level: 10,
      name: "Nature’s Ward",
      description:
        "You are immune to the Poisoned condition, and you have Resistance to a damage type associated with your current land choice in the Circle Spells feature, as shown in the Nature’s Ward table. Nature’s Ward Land Type Resistance Arid Fire Polar Cold Land Type Resistance Temperate…",
    },
    {
      level: 14,
      name: "Nature’s Sanctuary",
      description:
        "As a Magic action, you can expend a use of your Wild Shape and cause spectral trees and vines to appear in a 15-foot Cube on the ground within 120 feet of yourself. They last there for 1 minute or until you have the Incapacitated condition or die. You and your allies have Half…",
    },
  ],
  fighter: [
    {
      level: 1,
      name: "Fighting Style",
      description:
        "You have honed your martial prowess and gain a Fighting Style feat of your choice (see “Feats”). Defense is recommended. Whenever you gain a Fighter level, you can replace the feat you chose with a different Fighting Style feat. Fighter Features Level Proficiency Bonus Class…",
    },
    {
      level: 1,
      name: "Second Wind",
      description:
        "You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level. You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all…",
    },
    {
      level: 1,
      name: "Weapon Mastery",
      description:
        "Your training with weapons allows you to use the mastery properties of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices. When you reach certain Fighter levels, you gain…",
    },
    {
      level: 2,
      name: "Action Surge",
      description:
        "You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action, except the Magic action. Once you use this feature, you can’t do so again until you finish a Short or Long Rest. Starting at level 17, you can use it twice before a…",
    },
    {
      level: 2,
      name: "Tactical Mind",
      description:
        "You have a mind for tactics on and off the battlefield. When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check, potentially turning…",
    },
    {
      level: 3,
      name: "Fighter Subclass",
      description:
        "You gain a Fighter subclass of your choice. The Champion subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Fighter levels. For the rest of your career, you gain each of your subclass’s features that are of…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Fighter levels 6, 8, 12, 14, and…",
    },
    {
      level: 5,
      name: "Extra Attack",
      description:
        "You can attack twice instead of once whenever you take the Attack action on your…",
    },
    {
      level: 5,
      name: "Tactical Shift",
      description:
        "Whenever you activate your Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity…",
    },
    {
      level: 9,
      name: "Indomitable",
      description:
        "If you fail a saving throw, you can reroll it with a bonus equal to your Fighter level. You must use the new roll, and you can’t use this feature again until you finish a Long Rest. You can use this feature twice before a Long Rest starting at level 13 and three times before a…",
    },
    {
      level: 9,
      name: "Tactical Master",
      description:
        "When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that…",
    },
    {
      level: 11,
      name: "Two Extra Attacks",
      description:
        "You can attack three times instead of once whenever you take the Attack action on your…",
    },
    {
      level: 13,
      name: "Studied Attacks",
      description:
        "You study your opponents and learn from each attack you make. If you make an attack roll against a creature and miss, you have Advantage on your next attack roll against that creature before the end of your next…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Combat Prowess is…",
    },
    {
      level: 20,
      name: "Three Extra Attacks",
      description:
        "You can attack four times instead of once whenever you take the Attack action on your turn. System Reference Document 5.2.1 49 Fighter Subclass: Champion Pursue Physical Excellence in Combat A Champion focuses on the development of martial prowess in a relentless pursuit of…",
    },
    {
      level: 3,
      name: "Improved Critical",
      description:
        "Your attack rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20 on the…",
    },
    {
      level: 3,
      name: "Remarkable Athlete",
      description:
        "Thanks to your athleticism, you have Advantage on Initiative rolls and Strength (Athletics) checks. In addition, immediately after you score a Critical Hit, you can move up to half your Speed without provoking Opportunity…",
    },
    {
      level: 7,
      name: "Additional Fighting Style",
      description: "You gain another Fighting Style feat of your…",
    },
    {
      level: 10,
      name: "Heroic Warrior",
      description:
        "The thrill of battle drives you toward victory. During combat, you can give yourself Heroic Inspiration whenever you start your turn without…",
    },
    {
      level: 15,
      name: "Superior Critical",
      description:
        "Your attack rolls with weapons and Unarmed Strikes can now score a Critical Hit on a roll of 18–20 on the…",
    },
    {
      level: 18,
      name: "Survivor",
      description:
        "You attain the pinnacle of resilience in battle, giving you these benefits. Defy Death. You have Advantage on Death Saving Throws. Moreover, when you roll 18–20 on a Death Saving Throw, you gain the benefit of rolling a 20 on it. Heroic Rally. At the start of each of your turns,…",
    },
  ],
  monk: [
    {
      level: 1,
      name: "Martial Arts",
      description:
        "Your practice of martial arts gives you mastery of combat styles that use your Unarmed Strike and Monk weapons, which are the following: • Simple Melee weapons • Martial Melee weapons that have the Light property You gain the following benefits while you are unarmed or wielding…",
    },
    {
      level: 1,
      name: "Unarmored Defense",
      description:
        "While you aren’t wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom…",
    },
    {
      level: 2,
      name: "Monk’s Focus",
      description:
        "Your focus and martial training allow you to harness a well of extraordinary energy within yourself. This energy is represented by Focus Points. Your Monk level determines the number of points you have, as shown in the Focus Points column of the Monk Features table. You can…",
    },
    {
      level: 2,
      name: "Unarmored Movement",
      description:
        "Your speed increases by 10 feet while you aren’t wearing armor or wielding a Shield. This bonus increases when you reach certain Monk levels, as shown on the Monk Features…",
    },
    {
      level: 2,
      name: "Uncanny Metabolism",
      description:
        "When you roll Initiative, you can regain all expended Focus Points. When you do so, roll your Martial Arts die, and regain a number of Hit Points equal to your Monk level plus the number rolled. Once you use this feature, you can’t use it again until you finish a Long…",
    },
    {
      level: 3,
      name: "Deflect Attacks",
      description:
        "When an attack roll hits you and its damage includes Bludgeoning, Piercing, or Slashing damage, you can take a Reaction to reduce the attack’s total damage against you. The reduction equals 1d10 plus your Dexterity modifier and Monk level. If you reduce the damage to 0, you can…",
    },
    {
      level: 3,
      name: "Monk Subclass",
      description:
        "You gain a Monk subclass of your choice. The Warrior of the Open Hand subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Monk levels. For the rest of your career, you gain each of your subclass’s features that…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Monk levels 8, 12, and…",
    },
    {
      level: 4,
      name: "Slow Fall",
      description:
        "You can take a Reaction when you fall to reduce any damage you take from the fall by an amount equal to five times your Monk…",
    },
    {
      level: 5,
      name: "Extra Attack",
      description:
        "You can attack twice instead of once whenever you take the Attack action on your…",
    },
    {
      level: 5,
      name: "Stunning Strike",
      description:
        "Once per turn when you hit a creature with a Monk weapon or an Unarmed Strike, you can expend 1 Focus Point to attempt a stunning strike. The target must make a Constitution saving throw. On a failed save, the target has the Stunned condition until the start of your next turn.…",
    },
    {
      level: 6,
      name: "Empowered Strikes",
      description:
        "Whenever you deal damage with your Unarmed Strike, it can deal your choice of Force damage or its normal damage…",
    },
    {
      level: 7,
      name: "Evasion",
      description:
        "When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail. You don’t benefit from this feature if you have the Incapacitated…",
    },
    {
      level: 9,
      name: "Acrobatic Movement",
      description:
        "While you aren’t wearing armor or wielding a Shield, you gain the ability to move along vertical surfaces and across liquids on your turn without falling during the…",
    },
    {
      level: 10,
      name: "Heightened Focus",
      description:
        "Your Flurry of Blows, Patient Defense, and Step of the Wind gain the following benefits. Flurry of Blows. You can expend 1 Focus Point to use Flurry of Blows and make three Unarmed Strikes with it instead of two. System Reference Document 5.2.1 52 Patient Defense. When you…",
    },
    {
      level: 10,
      name: "Self-Restoration",
      description:
        "Through sheer force of will, you can remove one of the following conditions from yourself at the end of each of your turns: Charmed, Frightened, or Poisoned. In addition, forgoing food and drink doesn’t give you levels of…",
    },
    {
      level: 13,
      name: "Deflect Energy",
      description:
        "You can now use your Deflect Attacks feature against attacks that deal any damage type, not just Bludgeoning, Piercing, or…",
    },
    {
      level: 14,
      name: "Disciplined Survivor",
      description:
        "Your physical and mental discipline grant you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can expend 1 Focus Point to reroll it, and you must use the new…",
    },
    {
      level: 15,
      name: "Perfect Focus",
      description:
        "When you roll Initiative and don’t use Uncanny Metabolism, you regain expended Focus Points until you have 4 if you have 3 or…",
    },
    {
      level: 18,
      name: "Superior Defense",
      description:
        "At the start of your turn, you can expend 3 Focus Points to bolster yourself against harm for 1 minute or until you have the Incapacitated condition. During that time, you have Resistance to all damage except Force…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Irresistible Offense is…",
    },
    {
      level: 20,
      name: "Body and Mind",
      description:
        "You have developed your body and mind to new heights. Your Dexterity and Wisdom scores increase by 4, to a maximum of 25. Monk Subclass: Warrior of the Open Hand Master Unarmed Combat Techniques Warriors of the Open Hand are masters of unarmed combat. They learn techniques to…",
    },
    {
      level: 3,
      name: "Open Hand Technique",
      description:
        "Whenever you hit a creature with an attack granted by your Flurry of Blows, you can impose one of the following effects on that target. Addle. The target can’t make Opportunity Attacks until the start of its next turn. Push. The target must succeed on a Strength saving throw or…",
    },
    {
      level: 6,
      name: "Wholeness of Body",
      description:
        "You gain the ability to heal yourself. As a Bonus Action, you can roll your Martial Arts die. You regain a number of Hit Points equal to the number rolled plus your Wisdom modifier (minimum of 1 Hit Point regained). You can use this feature a number of times equal to your Wisdom…",
    },
    {
      level: 11,
      name: "Fleet Step",
      description:
        "When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind immediately after that Bonus…",
    },
    {
      level: 17,
      name: "Quivering Palm",
      description:
        "You gain the ability to set up lethal vibrations in someone’s body. When you hit a creature with an Unarmed Strike, you can expend 4 Focus Points to start these imperceptible vibrations, which last for a number of days equal to your Monk level. The vibrations are harmless unless…",
    },
  ],
  paladin: [
    {
      level: 1,
      name: "Lay On Hands",
      description:
        "Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you finish a Long Rest. With that pool, you can restore a total number of Hit Points equal to five times your Paladin level. Paladin Features Proficiency Bonus Channel Divinity Prepared…",
    },
    {
      level: 1,
      name: "Spellcasting",
      description:
        "You have learned to cast spells through prayer and meditation. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Paladin spells, which appear in the Paladin spell list later in the class’s description. Spell Slots. The Paladin…",
    },
    {
      level: 1,
      name: "Weapon Mastery",
      description:
        "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Longswords and Javelins. Whenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could…",
    },
    {
      level: 2,
      name: "Fighting Style",
      description:
        "You gain a Fighting Style feat of your choice (see “Feats” for feats). Instead of choosing one of those feats, you can choose the option below. Blessed Warrior. You learn two Cleric cantrips of your choice (see the Cleric class’s section for a list of Cleric spells). Guidance…",
    },
    {
      level: 2,
      name: "Paladin’s Smite",
      description:
        "You always have the Divine Smite spell prepared. In addition, you can cast it without expending a spell slot, but you must finish a Long Rest before you can cast it in this way…",
    },
    {
      level: 3,
      name: "Channel Divinity",
      description:
        "You can channel divine energy directly from the Outer Planes, using it to fuel magical effects. You start with one such effect: Divine Sense, which is described below. Other Paladin features give additional Channel Divinity effect options. Each time you use this class’s Channel…",
    },
    {
      level: 3,
      name: "Paladin Subclass",
      description:
        "You gain a Paladin subclass of your choice. The Oath of Devotion subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Paladin levels. For the rest of your career, you gain each of your subclass’s features that…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Paladin levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Extra Attack",
      description:
        "You can attack twice instead of once whenever you take the Attack action on your…",
    },
    {
      level: 5,
      name: "Faithful Steed",
      description:
        "You can call on the aid of an otherworldly steed. You always have the Find Steed spell prepared. You can also cast the spell once without expending a spell slot, and you regain the ability to do so when you finish a Long…",
    },
    {
      level: 6,
      name: "Aura of Protection",
      description:
        "You radiate a protective, unseeable aura in a 10-foot Emanation that originates from you. The aura is inactive while you have the Incapacitated condition. You and your allies in the aura gain a bonus to saving throws equal to your Charisma modifier (minimum bonus of +1). If…",
    },
    {
      level: 9,
      name: "Abjure Foes",
      description:
        "As a Magic action, you can expend one use of this class’s Channel Divinity to overwhelm foes with awe. As you present your Holy Symbol or weapon, you can target a number of creatures equal to your Charisma modifier (minimum of one creature) that you can see within 60 feet of…",
    },
    {
      level: 10,
      name: "Aura of Courage",
      description:
        "You and your allies have Immunity to the Frightened condition while in your Aura of Protection. If a Frightened ally enters the aura, that condition has no effect on that ally while…",
    },
    {
      level: 11,
      name: "Radiant Strikes",
      description:
        "Your strikes now carry supernatural power. When you hit a target with an attack roll using a Melee weapon or an Unarmed Strike, the target takes an extra 1d8 Radiant…",
    },
    {
      level: 14,
      name: "Restoring Touch",
      description:
        "When you use Lay On Hands on a creature, you can also remove one or more of the following conditions from the creature: Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned. You must expend 5 Hit Points from the healing pool of Lay On Hands for each of these conditions…",
    },
    {
      level: 18,
      name: "Aura Expansion",
      description: "Your Aura of Protection is now a 30-foot…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Truesight is recommended. Paladin Spell List This section presents the Paladin spell list. The spells are organized by spell level and then alphabetized, and each spell’s…",
    },
    {
      level: 3,
      name: "Oath of Devotion Spells",
      description:
        "The magic of your oath ensures you always have certain spells ready; when you reach a Paladin level specified in the Oath of Devotion Spells table, you thereafter always have the listed spells prepared. Oath of Devotion Spells Paladin Level Spells 3 Protection from Evil and Good…",
    },
    {
      level: 3,
      name: "Sacred Weapon",
      description:
        "When you take the Attack action, you can expend one use of your Channel Divinity to imbue one Melee weapon that you are holding with positive energy. For 10 minutes or until you use this feature again, you add your Charisma modifier to attack rolls you make with that weapon…",
    },
    {
      level: 7,
      name: "Aura of Devotion",
      description:
        "You and your allies have Immunity to the Charmed condition while in your Aura of Protection. If a Charmed ally enters the aura, that condition has no effect on that ally while there. System Reference Document 5.2.1…",
    },
    {
      level: 15,
      name: "Smite of Protection",
      description:
        "Your magical smite now radiates protective energy. Whenever you cast Divine Smite , you and your allies have Half Cover while in your Aura of Protection. The aura has this benefit until the start of your next…",
    },
    {
      level: 20,
      name: "Holy Nimbus",
      description:
        "As a Bonus Action, you can imbue your Aura of Protection with holy power, granting the benefits below for 10 minutes or until you end them (no action required). Once you use this feature, you can’t use it again until you finish a Long Rest. You can also restore your use of it by…",
    },
  ],
  ranger: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "You have learned to channel the magical essence of nature to cast spells. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Ranger spells, which appear in the Ranger spell list later in the class’s description. Spell Slots.…",
    },
    {
      level: 1,
      name: "Favored Enemy",
      description:
        "You always have the Hunter’s Mark spell prepared. You can cast it twice without expending a spell slot, and you regain all expended uses of this ability when you finish a Long Rest. The number of times you can cast the spell without a spell slot increases when you reach certain…",
    },
    {
      level: 1,
      name: "Weapon Mastery",
      description:
        "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your Ranger Features Proficiency Bonus Favored Enemy Prepared Spells —Spell Slots per Spell Level— Level Class Features 1 2 3 4 5 1 +2 Spellcasting, Favored Enemy, Weapon Mastery 2 2 2…",
    },
    {
      level: 2,
      name: "Deft Explorer",
      description:
        "Thanks to your travels, you gain the following benefits. Expertise. Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill. Languages. You know two languages of your choice from the language tables in “Character…",
    },
    {
      level: 2,
      name: "Fighting Style",
      description:
        "You gain a Fighting Style feat of your choice (see “Feats”). Instead of choosing one of those feats, you can choose the option below. Druidic Warrior. You learn two Druid cantrips of your choice (see the Druid class’s section for a list of Druid spells). Guidance and Starry Wisp…",
    },
    {
      level: 3,
      name: "Ranger Subclass",
      description:
        "You gain a Ranger subclass of your choice. The Hunter subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Ranger levels. For the rest of your career, you gain each of your subclass’s features that are of your…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Ranger levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Extra Attack",
      description:
        "You can attack twice instead of once whenever you take the Attack action on your…",
    },
    {
      level: 6,
      name: "Roving",
      description:
        "Your Speed increases by 10 feet while you aren’t wearing Heavy armor. You also have a Climb Speed and a Swim Speed equal to your…",
    },
    {
      level: 9,
      name: "Expertise",
      description:
        "Choose two of your skill proficiencies with which you lack Expertise. You gain Expertise in those…",
    },
    {
      level: 10,
      name: "Tireless",
      description:
        "Primal forces now help fuel you on your journeys, granting you the following benefits. Temporary Hit Points. As a Magic action, you can give yourself a number of Temporary Hit Points equal to 1d8 plus your Wisdom modifier (minimum of 1). You can use this action a number of times…",
    },
    {
      level: 13,
      name: "Relentless Hunter",
      description: "Taking damage can’t break your Concentration on Hunter’s…",
    },
    {
      level: 14,
      name: "Nature’s Veil",
      description:
        "You invoke spirits of nature to magically hide yourself. As a Bonus Action, you can give yourself the Invisible condition until the end of your next turn. You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses…",
    },
    {
      level: 17,
      name: "Precise Hunter",
      description:
        "You have Advantage on attack rolls against the creature currently marked by your Hunter’s…",
    },
    {
      level: 18,
      name: "Feral Senses",
      description:
        "Your connection to the forces of nature grants you Blindsight with a range of 30…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Dimensional Travel is…",
    },
    {
      level: 20,
      name: "Foe Slayer",
      description:
        "The damage die of your Hunter’s Mark is a d10 rather than a d6. System Reference Document 5.2.1 60 Ranger Spell List This section presents the Ranger spell list. The spells are organized by spell level and then alphabetized, and each spell’s school of magic is listed. In the…",
    },
    {
      level: 3,
      name: "Hunter’s Lore",
      description:
        "You can call on the forces of nature to reveal certain strengths and weaknesses of your prey. While a creature is marked by your Hunter’s Mark, you know whether that creature has any Immunities, Resistances, or Vulnerabilities, and if the creature has any, you know what they…",
    },
    {
      level: 3,
      name: "Hunter’s Prey",
      description:
        "You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one. Colossus Slayer. Your tenacity can wear down even the most resilient foes. When you hit a creature with a weapon, the…",
    },
    {
      level: 7,
      name: "Defensive Tactics",
      description:
        "You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one. Escape the Horde. Opportunity Attacks have Disadvantage against you. Multiattack Defense. When a creature hits you with…",
    },
    {
      level: 11,
      name: "Superior Hunter’s Prey",
      description:
        "Once per turn when you deal damage to a creature marked by your Hunter’s Mark, you can also deal that spell’s extra damage to a different creature that you can see within 30 feet of the first…",
    },
    {
      level: 15,
      name: "Superior Hunter’s Defense",
      description:
        "When you take damage, you can take a Reaction to give yourself Resistance to that damage and any other damage of the same type until the end of the current turn.…",
    },
  ],
  rogue: [
    {
      level: 1,
      name: "Expertise",
      description:
        "You gain Expertise in two of your skill proficiencies of your choice. Sleight of Hand and Stealth are recommended if you have proficiency in them. At Rogue level 6, you gain Expertise in two more of your skill proficiencies of your…",
    },
    {
      level: 1,
      name: "Sneak Attack",
      description:
        "You know how to strike subtly and exploit a foe’s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack System Reference Document 5.2.1 62 roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The…",
    },
    {
      level: 1,
      name: "Thieves’ Cant",
      description:
        "You picked up various languages in the communities where you plied your roguish talents. You know Thieves’ Cant and one other language of your choice, which you choose from the language tables in “Character…",
    },
    {
      level: 1,
      name: "Weapon Mastery",
      description:
        "Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Daggers and Shortbows. Whenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could…",
    },
    {
      level: 2,
      name: "Cunning Action",
      description:
        "Your quick thinking and agility allow you to move and act quickly. On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or…",
    },
    {
      level: 3,
      name: "Rogue Subclass",
      description:
        "You gain a Rogue subclass of your choice. The Thief subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Rogue levels. For the rest of your career, you gain each of your subclass’s features that are of your Rogue…",
    },
    {
      level: 3,
      name: "Steady Aim",
      description:
        "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn. Rogue Features Level Proficiency Bonus Class…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Rogue levels 8, 10, 12, and…",
    },
    {
      level: 5,
      name: "Cunning Strike",
      description:
        "You’ve developed cunning ways to use your Sneak Attack. When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die…",
    },
    {
      level: 5,
      name: "Uncanny Dodge",
      description:
        "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s damage against you (round…",
    },
    {
      level: 7,
      name: "Evasion",
      description:
        "You can nimbly dodge out of the way of certain dangers. When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail. You can’t use…",
    },
    {
      level: 7,
      name: "Reliable Talent",
      description:
        "Whenever you make an ability check that uses one of your skill or tool proficiencies, you can treat a d20 roll of 9 or lower as a…",
    },
    {
      level: 11,
      name: "Improved Cunning Strike",
      description:
        "You can use up to two Cunning Strike effects when you deal Sneak Attack damage, paying the die cost for each…",
    },
    {
      level: 14,
      name: "Devious Strikes",
      description:
        "You’ve practiced new ways to use your Sneak Attack deviously. The following effects are now among your Cunning Strike options. Daze (Cost: 2d6). The target must succeed on a Constitution saving throw, or on its next turn, it can do only one of the following: move or take an…",
    },
    {
      level: 15,
      name: "Slippery Mind",
      description:
        "Your cunning mind is exceptionally difficult to control. You gain proficiency in Wisdom and Charisma saving…",
    },
    {
      level: 18,
      name: "Elusive",
      description:
        "You’re so evasive that attackers rarely gain the upper hand against you. No attack roll can have Advantage against you unless you have the Incapacitated…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of the Night Spirit is…",
    },
    {
      level: 20,
      name: "Stroke of Luck",
      description:
        "You have a marvelous knack for succeeding when you need to. If you fail a D20 Test, you can turn the roll into a 20. Once you use this feature, you can’t use it again until you finish a Short or Long Rest. System Reference Document 5.2.1 64 Rogue Subclass: Thief Hunt for…",
    },
    {
      level: 3,
      name: "Fast Hands",
      description:
        "As a Bonus Action, you can do one of the following. Sleight of Hand. Make a Dexterity (Sleight of Hand) check to pick a lock or disarm a trap with Thieves’ Tools or to pick a pocket. Use an Object. Take the Utilize action, or take the Magic action to use a magic item that…",
    },
    {
      level: 3,
      name: "Second-Story Work",
      description:
        "You’ve trained to get into especially hard-to-reach places, granting you these benefits. Climber. You gain a Climb Speed equal to your Speed. Jumper. You can determine your jump distance using your Dexterity rather than your…",
    },
    {
      level: 9,
      name: "Supreme Sneak",
      description:
        "You gain the following Cunning Strike option. Stealth Attack (Cost: 1d6). If you have the Hide action’s Invisible condition, this attack doesn’t end that condition on you if you end the turn behind Three-Quarters Cover or Total…",
    },
    {
      level: 13,
      name: "Use Magic Device",
      description:
        "You’ve learned how to maximize use of magic items, granting you the following benefits. Attunement. You can attune to up to four magic items at once. Charges. Whenever you use a magic item property that expends charges, roll 1d6. On a roll of 6, you use the property without…",
    },
    {
      level: 17,
      name: "Thief’s Reflexes",
      description:
        "You are adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of any combat. You take your first turn at your normal Initiative and your second turn at your Initiative minus 10.…",
    },
  ],
  sorcerer: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "Drawing from your innate magic, you can cast spells. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Sorcerer spells, which appear in the Sorcerer spell list later in the class’s description. Cantrips. You know four Sorcerer…",
    },
    {
      level: 1,
      name: "Innate Sorcery",
      description:
        "An event in your past left an indelible mark on you, infusing you with simmering magic. As a Bonus Action, you can unleash that magic for 1 minute, during which you gain the following benefits: Sorcerer Features Proficiency Bonus Sorcery Points Prepared Spells ——Spell Slots per…",
    },
    {
      level: 2,
      name: "Font of Magic",
      description:
        "You can tap into the wellspring of magic within yourself. This wellspring is represented by Sorcery Points, which allow you to create a variety of magical effects. You have 2 Sorcery Points, and you gain more as you reach higher levels, as shown in the Sorcery Points column of…",
    },
    {
      level: 2,
      name: "Metamagic",
      description:
        "Because your magic flows from within, you can alter your spells to suit your needs; you gain two Metamagic options of your choice from “Meta magic Options” later in this class’s description. You use the chosen options to temporarily modify spells you cast. To use an option, you…",
    },
    {
      level: 3,
      name: "Sorcerer Subclass",
      description:
        "You gain a Sorcerer subclass of your choice. The Draconic Sorcery subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Sorcerer levels. For the rest of your career, you gain each of your subclass’s features that…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Sorcerer levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Sorcerous Restoration",
      description:
        "When you finish a Short Rest, you can regain expended Sorcery Points, but no more than a number equal to half your Sorcerer level (round down). Once you use this feature, you can’t do so again until you finish a Long…",
    },
    {
      level: 7,
      name: "Sorcery Incarnate",
      description:
        "If you have no uses of Innate Sorcery left, you can use it if you spend 2 Sorcery Points when you take the Bonus Action to activate it. In addition, while your Innate Sorcery feature is active, you can use up to two of your Metamagic options on each spell you…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Dimensional Travel is…",
    },
    {
      level: 20,
      name: "Arcane Apotheosis",
      description:
        "While your Innate Sorcery feature is active, you can use one Metamagic option on each of your turns without spending Sorcery Points on it. Metamagic Options The following options are available to your Metamagic feature. The options are presented in alphabetical order. Careful…",
    },
    {
      level: 3,
      name: "Draconic Resilience",
      description:
        "The magic in your body manifests physical traits of your draconic gift. Your Hit Point maximum increases by 3, and it increases by 1 whenever you gain another Sorcerer level. Parts of you are also covered by dragon-like scales. While you aren’t wearing armor, your base Armor…",
    },
    {
      level: 3,
      name: "Draconic Spells",
      description:
        "When you reach a Sorcerer level specified in the Draconic Spells table, you thereafter always have the listed spells prepared. Draconic Spells Sorcerer Level Spells 3 Alter Self, Chromatic Orb, Command, Dragon’s Breath 5 Fear, Fly 7 Arcane Eye, Charm Monster 9 Legend Lore,…",
    },
    {
      level: 6,
      name: "Elemental Affinity",
      description:
        "Your draconic magic has an affinity with a damage type associated with dragons. Choose one of those types: Acid, Cold, Fire, Lightning, or Poison. You have Resistance to that damage type, and when you cast a spell that deals damage of that type, you can add your Charisma…",
    },
    {
      level: 14,
      name: "Dragon Wings",
      description:
        "As a Bonus Action, you can cause draconic wings to appear on your back. The wings last for 1 hour or until you dismiss them (no action required). For the duration, you have a Fly Speed of 60 feet. Once you use this feature, you can’t use it again until you finish a Long Rest…",
    },
    {
      level: 18,
      name: "Dragon Companion",
      description:
        "You can cast Summon Dragon without a Material component. You can also cast it once without a spell slot, and you regain the ability to cast it in this way when you finish a Long Rest. Whenever you start casting the spell, you can modify it so that it doesn’t require…",
    },
  ],
  warlock: [
    {
      level: 1,
      name: "Eldritch Invocations",
      description:
        "You have unearthed Eldritch Invocations, pieces of forbidden knowledge that imbue you with an abiding magical ability or other lessons. You gain one invocation of your choice, such as Pact of the Tome. Invocations are described in the “Eldritch Invocation Options” section later…",
    },
    {
      level: 1,
      name: "Pact Magic",
      description:
        "Through occult ceremony, you have formed a pact with a mysterious entity to gain magical powers. The entity is a voice in the shadows—its identity unclear—but its boon to you is concrete: the ability to cast spells. See “Spells” for the rules on spellcasting. The information…",
    },
    {
      level: 2,
      name: "Magical Cunning",
      description:
        "You can perform an esoteric rite for 1 minute. At the end of it, you regain expended Pact Magic spell slots but no more than a number equal to half your maximum (round up). Once you use this feature, you can’t do so again until you finish a Long…",
    },
    {
      level: 3,
      name: "Warlock Subclass",
      description:
        "You gain a Warlock subclass of your choice. The Fiend Patron subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Warlock levels. For the rest of your career, you gain each of your subclass’s features that are of…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Warlock levels 8, 12, and…",
    },
    {
      level: 9,
      name: "Contact Patron",
      description:
        "In the past, you usually contacted your patron through intermediaries. Now you can communicate directly; you always have the Contact Other Plane spell prepared. With this feature, you can cast the spell without expending a spell slot to contact your patron, and you automatically…",
    },
    {
      level: 11,
      name: "Mystic Arcanum",
      description:
        "Your patron grants you a magical secret called an arcanum. Choose one level 6 Warlock spell as this arcanum. You can cast your arcanum spell once without expending a spell slot, and you must finish a Long Rest before you can cast it in this way again. As shown in the Warlock…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Fate is…",
    },
    {
      level: 20,
      name: "Eldritch Master",
      description:
        "When you use your Magical Cunning feature, you regain all your expended Pact Magic spell slots. Eldritch Invocation Options Eldritch Invocation options appear in alphabetical order. Agonizing Blast Prerequisite: Level 2+ Warlock, a Warlock Cantrip That Deals Damage Choose one of…",
    },
    {
      level: 3,
      name: "Dark One’s Blessing",
      description:
        "When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier plus your Warlock level (minimum of 1 Temporary Hit Point). You also gain this benefit if someone else reduces an enemy within 10 feet of you to 0 Hit…",
    },
    {
      level: 3,
      name: "Fiend Spells",
      description:
        "The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specified in the Fiend Spells table, you thereafter always have the listed spells prepared. Fiend Spells Warlock Level Spells 3 Burning Hands, Command, Scorching Ray, Suggestion…",
    },
    {
      level: 6,
      name: "Dark One’s Own Luck",
      description:
        "You can call on your fiendish patron to alter fate in your favor. When you make an ability check or a saving throw, you can use this feature to add 1d10 to your roll. You can do so after seeing the roll but before any of the roll’s effects occur. You can use this feature a…",
    },
    {
      level: 10,
      name: "Fiendish Resilience",
      description:
        "Choose one damage type, other than Force, whenever you finish a Short or Long Rest. You have Resistance to that damage type until you choose a different one with this…",
    },
    {
      level: 14,
      name: "Hurl Through Hell",
      description:
        "Once per turn when you hit a creature with an attack roll, you can try to instantly transport the target through the Lower Planes. The target must succeed on a Charisma saving throw against your spell save DC, or the target disappears and hurtles through a nightmare landscape.…",
    },
  ],
  wizard: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "As a student of arcane magic, you have learned to cast spells. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Wizard spells, which appear in the Wizard spell list later in the class’s description. Cantrips. You know three…",
    },
    {
      level: 1,
      name: "Ritual Adept",
      description:
        "You can cast any spell as a Ritual if that spell has the Ritual tag and the spell is in your spellbook. You needn’t have the spell prepared, but you must read from the book to cast a spell in this…",
    },
    {
      level: 1,
      name: "Arcane Recovery",
      description:
        "You can regain some of your magical energy by studying your spellbook. When you finish a Short Rest, you can choose expended spell slots to recover. The spell slots can have a combined level equal to no more than half your Wizard level (round up), and none of the slots can be…",
    },
    {
      level: 2,
      name: "Scholar",
      description:
        "While studying magic, you also specialized in another field of study. Choose one of the following skills in which you have proficiency: Arcana, History, Investigation, Medicine, Nature, or Religion. You have Expertise in the chosen…",
    },
    {
      level: 3,
      name: "Wizard Subclass",
      description:
        "You gain a Wizard subclass of your choice. The Evoker subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Wizard levels. For the rest System Reference Document 5.2.1 79 of your career, you gain each of your…",
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Wizard levels 8, 12, and…",
    },
    {
      level: 5,
      name: "Memorize Spell",
      description:
        "Whenever you finish a Short Rest, you can study your spellbook and replace one of the level 1+ Wizard spells you have prepared for your Spellcasting feature with another level 1+ spell from the…",
    },
    {
      level: 18,
      name: "Spell Mastery",
      description:
        "You have achieved such mastery over certain spells that you can cast them at will. Choose a level 1 and a level 2 spell in your spellbook that have a casting time of an action. You always have those spells prepared, and you can cast them at their lowest level without expending a…",
    },
    {
      level: 19,
      name: "Epic Boon",
      description:
        "You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Spell Recall is…",
    },
    {
      level: 20,
      name: "Signature Spells",
      description:
        "Choose two level 3 spells in your spellbook as your signature spells. You always have these spells prepared, and you can cast each of them once at level 3 without expending a spell slot. When you do so, you can’t cast them in this way again until you finish a Short or Long Rest.…",
    },
    {
      level: 3,
      name: "Evocation Savant",
      description:
        "Choose two Wizard spells from the Evocation school, each of which must be no higher than level 2, and add them to your spellbook for free. In addition, whenever you gain access to a new level of spell slots in this class, you can add one Wizard spell from the Evocation school to…",
    },
    {
      level: 3,
      name: "Potent Cantrip",
      description:
        "Your damaging cantrips affect even creatures that avoid the brunt of the effect. When you cast a cantrip at a creature and you miss with the attack roll or the target succeeds on a saving throw against the cantrip, the target takes half the cantrip’s damage (if any) but suffers…",
    },
    {
      level: 6,
      name: "Sculpt Spells",
      description:
        "You can create pockets of relative safety within the effects of your evocations. When you cast an Evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 plus the spell’s level. The chosen creatures automatically succeed on their…",
    },
    {
      level: 10,
      name: "Empowered Evocation",
      description:
        "Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that…",
    },
    {
      level: 14,
      name: "Overchannel",
      description:
        "You can increase the power of your spells. When you cast a Wizard spell with a spell slot of levels 1–5 that deals damage, you can deal maximum damage with that spell on the turn you cast it. The first time you do so, you suffer no adverse effect. If you use this feature again…",
    },
  ],
};
