import type { Edition } from "./rules-data";
import { FAMILIAR_BEASTS_2024 } from "./familiar-beasts-2024";
import { FAMILIAR_BEASTS_2014 } from "./familiar-beasts-2014";
import { ANIMALS_2024 } from "./animals-2024";
import { ANIMALS_2014 } from "./animals-2014";
import { PACT_FAMILIARS } from "./pact-familiars";
export type Bilingual = { ru: string; en: string };
export interface RuleCreature {
  id: string;
  edition: Edition;
  name: Bilingual;
  sourceUrl: string;
  armorClass: number;
  armorClassFormula?: Bilingual;
  hp: number;
  hitDice: string;
  abilities: [number, number, number, number, number, number];
  challenge: string;
  proficiency: number;
  initiative?: number;
  profile: Bilingual;
  rules: Bilingual[];
  spellIds?: string[];
  creatureIds?: string[];
  hpFormula?: Bilingual;
  proficiencyFormula?: Bilingual;
}
const p = (ru: string, en: string): Bilingual => ({ ru, en });
const srd51 = "https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf";
const srd52 = "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";
const decay = p(
  "После смерти тело рассыпается в пыль, снаряжение остаётся.",
  "On death the body turns to dust, leaving its equipment behind.",
);
const axiomatic = p(
  "Нельзя принудить действовать вопреки своей природе или инструкциям.",
  "Cannot be compelled to act against its nature or instructions.",
);
const modron = (
  id: string,
  ru: string,
  en: string,
  edition: Edition,
  ac: number,
  hp: number,
  hitDice: string,
  abilities: RuleCreature["abilities"],
  challenge: string,
  profile: Bilingual,
  rules: Bilingual[],
  path: string,
  initiative?: number,
): RuleCreature => ({
  id: `${id}-${edition}`,
  edition,
  name: p(ru, en),
  armorClass: ac,
  hp,
  hitDice,
  abilities,
  challenge,
  proficiency: 2,
  initiative,
  profile,
  rules: [decay, ...(edition === "2014" ? [axiomatic] : []), ...rules],
  sourceUrl: `https://${edition === "2024" ? "next." : ""}dnd.su/bestiary/${path}/`,
});
const oldModronProfile = (speed: number, passive = 10) =>
  p(
    `Конструкт, законно-нейтральный. Скорость ${speed} фт. Истинное зрение 120 фт.; пассивное Восприятие ${passive}; Модронский язык.`,
    `Construct, Lawful Neutral. Speed ${speed} ft. Truesight 120 ft.; passive Perception ${passive}; Modron language.`,
  );
export const RULE_CREATURES: RuleCreature[] = [
  ...ANIMALS_2024,
  ...ANIMALS_2014,
  ...PACT_FAMILIARS,
  {
    id: "ghast-2014", edition: "2014", name: p("Гаст", "Ghast"), sourceUrl: `${srd51}#page=311`,
    armorClass: 13, hp: 36, hitDice: "8d8", abilities: [16,17,10,11,10,8], challenge: "2", proficiency: 2, initiative: 3,
    profile: p("Средняя Нежить, хаотично-злая. Скорость 30 фт. Сопротивление некротическому урону; иммунитет к яду, Очарованию, Истощению и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 10. Общий язык.", "Medium Undead, Chaotic Evil. Speed 30 ft. Resistant to Necrotic damage; immune to Poison damage, Charmed, Exhaustion and Poisoned. Darkvision 60 ft., passive Perception 10. Common."),
    rules: [
      p("Зловоние: существо, начинающее ход в 5 фт. от гаста, делает спасбросок Телосложения Сл 10. Провал: Отравлено до начала своего следующего хода; успех: иммунитет к Зловонию этого гаста 24 часа.", "Stench: a creature starting its turn within 5 ft. makes a DC 10 Constitution save. Failure: Poisoned until the start of its next turn. Success: immune to this ghast's Stench for 24 hours."),
      p("Сопротивление изгнанию: гаст и Вурдалаки в пределах 30 фт. имеют преимущество на спасброски против изгнания нежити.", "Turning Defiance: the ghast and ghouls within 30 ft. have advantage on saves against effects that turn Undead."),
      p("Укус: рукопашная атака оружием +3, досягаемость 5 фт., одно существо; 12 (2d8 + 3) колющего урона.", "Bite: melee weapon attack +3, reach 5 ft., one creature; 12 (2d8 + 3) Piercing damage."),
      p("Когти: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 10 (2d6 + 3) рубящего урона. Существо, кроме Нежити, делает спасбросок Телосложения Сл 10; провал: Парализовано на 1 минуту, повторяет спасбросок в конце каждого своего хода и при успехе освобождается.", "Claws: melee weapon attack +5, reach 5 ft., one target; 10 (2d6 + 3) Slashing damage. A non-Undead creature makes a DC 10 Constitution save; failure: Paralyzed for 1 minute, repeating the save at the end of each turn to end it on a success."),
    ],
  },
  {
    id: "ghoul-2014", edition: "2014", name: p("Вурдалак", "Ghoul"), sourceUrl: `${srd51}#page=312`,
    armorClass: 12, hp: 22, hitDice: "5d8", abilities: [13,15,10,7,10,6], challenge: "1", proficiency: 2, initiative: 2,
    profile: p("Средняя Нежить, хаотично-злая. Скорость 30 фт. Иммунитет к яду, Очарованию, Истощению и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 10. Общий язык.", "Medium Undead, Chaotic Evil. Speed 30 ft. Immune to Poison damage, Charmed, Exhaustion and Poisoned. Darkvision 60 ft., passive Perception 10. Common."),
    rules: [
      p("Укус: рукопашная атака оружием +2, досягаемость 5 фт., одно существо; 9 (2d6 + 2) колющего урона.", "Bite: melee weapon attack +2, reach 5 ft., one creature; 9 (2d6 + 2) Piercing damage."),
      p("Когти: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 7 (2d4 + 2) рубящего урона. Существо, кроме Нежити и эльфов, делает спасбросок Телосложения Сл 10; провал: Парализовано на 1 минуту, повторяет спасбросок в конце каждого своего хода и при успехе освобождается.", "Claws: melee weapon attack +4, reach 5 ft., one target; 7 (2d4 + 2) Slashing damage. A creature other than an Undead or elf makes a DC 10 Constitution save; failure: Paralyzed for 1 minute, repeating the save at the end of each turn to end it on a success."),
    ],
  },
  {
    id: "wight-2014", edition: "2014", name: p("Умертвие", "Wight"), sourceUrl: `${srd51}#page=354`,
    armorClass: 14, hp: 45, hitDice: "6d8 + 18", abilities: [15,14,16,10,13,15], challenge: "3", proficiency: 2, initiative: 2, creatureIds: ["zombie-2014"],
    profile: p("Средняя Нежить, нейтрально-злая. Проклёпанный кожаный доспех. Скорость 30 фт. Внимательность +3, Скрытность +4. Сопротивление некротическому урону и дробящему, колющему, рубящему от немагических непосеребрённых атак; иммунитет к яду, Истощению и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 13. Языки, известные при жизни.", "Medium Undead, Neutral Evil. Studded leather armor. Speed 30 ft. Perception +3, Stealth +4. Resistant to Necrotic damage and Bludgeoning, Piercing, Slashing from nonmagical attacks that aren't silvered; immune to Poison damage, Exhaustion and Poisoned. Darkvision 60 ft., passive Perception 13. Languages known in life."),
    rules: [
      p("Чувствительность к солнцу: на солнечном свету помеха на атаки и проверки Мудрости (Внимательность), основанные на зрении.", "Sunlight Sensitivity: disadvantage on attack rolls and sight-based Wisdom (Perception) checks in sunlight."),
      p("Мультиатака: две атаки Длинным мечом либо две Длинным луком; одну атаку мечом можно заменить Вытягиванием жизни.", "Multiattack: two Longsword attacks or two Longbow attacks; one sword attack may be replaced with Life Drain."),
      p("Длинный меч: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 6 (1d8 + 2) рубящего урона или 7 (1d10 + 2) двумя руками. Длинный лук: дальнобойная атака оружием +4, дистанция 150/600 фт., одна цель; 6 (1d8 + 2) колющего урона.", "Longsword: melee weapon attack +4, reach 5 ft., one target; 6 (1d8 + 2) Slashing damage, or 7 (1d10 + 2) with two hands. Longbow: ranged weapon attack +4, range 150/600 ft., one target; 6 (1d8 + 2) Piercing damage."),
      p("Вытягивание жизни: рукопашная атака оружием +4, досягаемость 5 фт., одно существо; 5 (1d6 + 2) некротического урона. При провале спасброска Телосложения Сл 13 максимум хитов уменьшается на полученный урон до Долгого отдыха; снижение максимума до 0 убивает. Убитый этой атакой Гуманоид через 24 часа становится подконтрольным Зомби, если не оживлён и тело не уничтожено. Предел контроля — двенадцать Зомби одновременно.", "Life Drain: melee weapon attack +4, reach 5 ft., one creature; 5 (1d6 + 2) Necrotic damage. A failed DC 13 Constitution save reduces its HP maximum by the damage taken until a Long Rest; reaching a maximum of 0 kills it. A Humanoid killed by this attack becomes a controlled Zombie after 24 hours unless restored to life or its body is destroyed. At most twelve Zombies can be controlled at once."),
    ],
  },
  {
    id: "mummy-2014", edition: "2014", name: p("Мумия", "Mummy"), sourceUrl: `${srd51}#page=333`,
    armorClass: 11, hp: 58, hitDice: "9d8 + 18", abilities: [16,8,15,6,10,12], challenge: "3", proficiency: 2, initiative: -1,
    profile: p("Средняя Нежить, законно-злая. Природный доспех. Скорость 20 фт.; спасбросок Мудрости +2. Уязвимость к огню; сопротивление дробящему, колющему и рубящему урону от немагических атак; иммунитет к некротическому урону, яду, Очарованию, Истощению, Испугу, Параличу и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 10. Языки, известные при жизни.", "Medium Undead, Lawful Evil. Natural armor. Speed 20 ft.; Wisdom save +2. Vulnerable to Fire; resistant to Bludgeoning, Piercing and Slashing from nonmagical attacks; immune to Necrotic and Poison damage, Charmed, Exhaustion, Frightened, Paralyzed and Poisoned. Darkvision 60 ft., passive Perception 10. Languages known in life."),
    rules: [
      p("Мультиатака: Ужасающий взгляд и одна атака Гниющим кулаком.", "Multiattack: Dreadful Glare and one Rotting Fist attack."),
      p("Гниющий кулак: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 10 (2d6 + 3) дробящего и 10 (3d6) некротического урона. Существо делает спасбросок Телосложения Сл 12; провал накладывает проклятие мумийной гнили: нельзя восстанавливать хиты, максимум уменьшается на 10 (3d6) каждые 24 часа. Снижение максимума до 0 убивает и обращает тело в пыль. Проклятие сохраняется до Снятия проклятия или другой снимающей его магии.", "Rotting Fist: melee weapon attack +5, reach 5 ft., one target; 10 (2d6 + 3) Bludgeoning plus 10 (3d6) Necrotic damage. A creature makes a DC 12 Constitution save; failure inflicts mummy rot: no HP recovery, and HP maximum decreases by 10 (3d6) every 24 hours. A maximum of 0 kills it and turns the body to dust. The curse lasts until Remove Curse or other curse-removing magic ends it."),
      p("Ужасающий взгляд: одно видимое существо в 60 фт., которое видит мумию, делает спасбросок Мудрости Сл 11 против магии. Провал: Испугано до конца следующего хода мумии; провал на 5 или больше также Парализует на тот же срок. Успех даёт иммунитет к Ужасающему взгляду всех мумий, кроме лордов мумий, на 24 часа.", "Dreadful Glare: one visible creature within 60 ft. that can see the mummy makes a DC 11 Wisdom save against magic. Failure: Frightened until the end of the mummy's next turn; failure by 5 or more also Paralyzes for that duration. Success grants immunity to all mummies' Dreadful Glare, except mummy lords, for 24 hours."),
    ],
  },
  {
    id: "ghast-2024", edition: "2024", name: p("Гаст", "Ghast"), sourceUrl: `${srd52}#page=287`,
    armorClass: 13, hp: 36, hitDice: "8d8", abilities: [16,17,10,11,10,8], challenge: "2", proficiency: 2, initiative: 3,
    profile: p("Средняя Нежить, хаотично-злая. Скорость 30 фт. Спасбросок Мудрости +2. Сопротивление некротическому урону; иммунитет к яду, Очарованию, Истощению и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 10. Общий язык.", "Medium Undead, Chaotic Evil. Speed 30 ft. Wisdom save +2. Resistant to Necrotic damage; immune to Poison damage, Charmed, Exhaustion and Poisoned. Darkvision 60 ft., passive Perception 10. Common."),
    rules: [
      p("Зловоние: существо, начинающее ход в эманации 5 фт. от гаста, делает спасбросок Телосложения Сл 10. Провал: Отравлено до начала своего следующего хода; успех: иммунитет к Зловонию этого гаста 24 часа.", "Stench: a creature starting its turn in the ghast's 5-ft. Emanation makes a DC 10 Constitution save. Failure: Poisoned until the start of its next turn. Success: immune to this ghast's Stench for 24 hours."),
      p("Укус: рукопашная атака +5, досягаемость 5 фт.; 7 (1d8 + 3) колющего и 9 (2d8) некротического урона.", "Bite: melee attack +5, reach 5 ft.; 7 (1d8 + 3) Piercing plus 9 (2d8) Necrotic damage."),
      p("Коготь: рукопашная атака +5, досягаемость 5 фт.; 10 (2d6 + 3) рубящего урона. Существо, кроме Нежити, делает спасбросок Телосложения Сл 10; провал: Парализовано до конца своего следующего хода.", "Claw: melee attack +5, reach 5 ft.; 10 (2d6 + 3) Slashing damage. A non-Undead creature makes a DC 10 Constitution save; failure: Paralyzed until the end of its next turn."),
    ],
  },
  {
    id: "ghoul-2024", edition: "2024", name: p("Вурдалак", "Ghoul"), sourceUrl: `${srd52}#page=288`,
    armorClass: 12, hp: 22, hitDice: "5d8", abilities: [13,15,10,7,10,6], challenge: "1", proficiency: 2, initiative: 2,
    profile: p("Средняя Нежить, хаотично-злая. Скорость 30 фт. Иммунитет к яду, Очарованию, Истощению и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 10. Общий язык.", "Medium Undead, Chaotic Evil. Speed 30 ft. Immune to Poison damage, Charmed, Exhaustion and Poisoned. Darkvision 60 ft., passive Perception 10. Common."),
    rules: [
      p("Мультиатака: два Укуса.", "Multiattack: two Bite attacks."),
      p("Укус: рукопашная атака +4, досягаемость 5 фт.; 5 (1d6 + 2) колющего и 3 (1d6) некротического урона.", "Bite: melee attack +4, reach 5 ft.; 5 (1d6 + 2) Piercing plus 3 (1d6) Necrotic damage."),
      p("Коготь: рукопашная атака +4, досягаемость 5 фт.; 4 (1d4 + 2) рубящего урона. Существо, кроме Нежити и эльфов, делает спасбросок Телосложения Сл 10; провал: Парализовано до конца своего следующего хода.", "Claw: melee attack +4, reach 5 ft.; 4 (1d4 + 2) Slashing damage. A creature other than an Undead or elf makes a DC 10 Constitution save; failure: Paralyzed until the end of its next turn."),
    ],
  },
  {
    id: "wight-2024", edition: "2024", name: p("Умертвие", "Wight"), sourceUrl: `${srd52}#page=341`,
    armorClass: 14, hp: 82, hitDice: "11d8 + 33", abilities: [15,14,16,10,13,15], challenge: "3", proficiency: 2, initiative: 4, creatureIds: ["zombie-2024"],
    profile: p("Средняя Нежить, нейтрально-злая. Проклёпанный кожаный доспех. Скорость 30 фт. Внимательность +3, Скрытность +4. Сопротивление некротическому урону; иммунитет к яду, Истощению и Отравлению. Тёмное зрение 60 фт., пассивная Внимательность 13. Общий и ещё один язык.", "Medium Undead, Neutral Evil. Studded leather armor. Speed 30 ft. Perception +3, Stealth +4. Resistant to Necrotic damage; immune to Poison damage, Exhaustion and Poisoned. Darkvision 60 ft., passive Perception 13. Common plus one other language."),
    rules: [
      p("Чувствительность к солнцу: на солнечном свету помеха на проверки характеристик и броски атаки.", "Sunlight Sensitivity: Disadvantage on ability checks and attack rolls in sunlight."),
      p("Мультиатака: две атаки Некротическим мечом или луком в любой комбинации; одну можно заменить Вытягиванием жизни.", "Multiattack: two Necrotic Sword or Necrotic Bow attacks in any combination; one may be replaced with Life Drain."),
      p("Некротический меч: рукопашная атака +4, досягаемость 5 фт.; 6 (1d8 + 2) рубящего и 4 (1d8) некротического урона. Некротический лук: дальнобойная атака +4, дистанция 150/600 фт.; 6 (1d8 + 2) колющего и 4 (1d8) некротического урона.", "Necrotic Sword: melee attack +4, reach 5 ft.; 6 (1d8 + 2) Slashing plus 4 (1d8) Necrotic damage. Necrotic Bow: ranged attack +4, range 150/600 ft.; 6 (1d8 + 2) Piercing plus 4 (1d8) Necrotic damage."),
      p("Вытягивание жизни: одно существо в 5 фт. делает спасбросок Телосложения Сл 13. Провал: 6 (1d8 + 2) некротического урона и уменьшение максимума хитов на полученный урон. Убитый этой атакой Гуманоид через 24 часа становится подконтрольным Зомби, если не оживлён и тело не уничтожено. Предел контроля — двенадцать Зомби одновременно.", "Life Drain: one creature within 5 ft. makes a DC 13 Constitution save. Failure: 6 (1d8 + 2) Necrotic damage, and its HP maximum decreases by the damage taken. A Humanoid killed by this attack becomes a controlled Zombie after 24 hours unless restored to life or its body is destroyed. At most twelve Zombies can be controlled at once."),
    ],
  },
  ...([
    ["tiny", "Крошечный", "Tiny", 20, 18, 4, 18, 8, "1d4 + 4"],
    ["small", "Маленький", "Small", 25, 16, 6, 14, 6, "1d8 + 2"],
    ["medium", "Средний", "Medium", 40, 13, 10, 12, 5, "2d6 + 1"],
    ["large", "Большой", "Large", 50, 10, 14, 10, 6, "2d10 + 2"],
    ["huge", "Огромный", "Huge", 80, 10, 18, 6, 8, "2d12 + 4"],
  ] as const).map(([size, ru, en, hp, armorClass, str, dex, attack, damage]): RuleCreature => ({
    id: `animated-object-${size}-2014`, edition: "2014", name: p(`Оживлённый предмет: ${ru.toLowerCase()}`, `Animated Object: ${en}`), sourceUrl: `${srd51}#page=116`,
    armorClass, hp, hitDice: "—", abilities: [str, dex, 10, 3, 3, 1], challenge: "—", proficiency: 0, proficiencyFormula: p("Не указан; используйте готовый бонус атаки", "Not specified; use the supplied attack bonus"), initiative: Math.floor((dex - 10) / 2),
    profile: p(`${ru} Конструкт. Скорость 30 фт.; без частей для ходьбы вместо неё полёт 30 фт. с парением. При надёжном креплении к поверхности или большему предмету скорость 0. Слепое зрение 30 фт., слеп за этим пределом.`, `${en} Construct. Speed 30 ft.; without walking appendages, fly 30 ft. (hover) instead. Speed 0 if securely attached to a surface or larger object. Blindsight 30 ft., blind beyond this distance.`),
    rules: [
      p(`Удар: одна рукопашная атака +${attack}, досягаемость 5 фт., одно существо; ${damage} дробящего урона. Мастер может заменить тип на колющий или рубящий по форме предмета.`, `Slam: one melee attack +${attack}, reach 5 ft., one creature; ${damage} Bludgeoning damage. The GM may change the type to Piercing or Slashing according to the object's shape.`),
      p("При 0 хитов снова становится обычным предметом; остаток урона переносится на него. Правила контроля и масштабирования приведены в заклинании Оживление предметов.", "At 0 HP it returns to its original object form, which takes any remaining damage. See Animate Objects for control and upcasting rules."),
    ],
  })),
  {
    id: "awakened-tree-2014", edition: "2014", name: p("Пробуждённое дерево", "Awakened Tree"), sourceUrl: `${srd51}#page=366`,
    armorClass: 13, hp: 59, hitDice: "7d12 + 14", abilities: [19, 6, 15, 10, 10, 7], challenge: "2", proficiency: 2, initiative: -2,
    profile: p("Огромное Растение, без мировоззрения. Природный доспех. Скорость 20 фт.; пассивная Внимательность 10. Один язык, известный создателю. Уязвимость к огню; сопротивление дробящему и колющему урону.", "Huge Plant, Unaligned. Natural armor. Speed 20 ft.; passive Perception 10. One language known by its creator. Vulnerable to Fire; resistant to Bludgeoning and Piercing damage."),
    rules: [p("Ложная внешность: пока неподвижно, неотличимо от обычного дерева.", "False Appearance: indistinguishable from an ordinary tree while motionless."), p("Удар: рукопашная атака оружием +6, досягаемость 10 фт., одна цель; 14 (3d6 + 4) дробящего урона.", "Slam: melee weapon attack +6, reach 10 ft., one target; 14 (3d6 + 4) Bludgeoning damage.")],
  },
  {
    id: "animated-object-2024", edition: "2024", name: p("Оживлённый предмет", "Animated Object"), sourceUrl: `${srd52}#page=109`,
    armorClass: 15, hp: 10, hpFormula: p("10 для Среднего и меньшего; 20 для Большого; 40 для Огромного", "10 for Medium or smaller; 20 for Large; 40 for Huge"), hitDice: "—",
    abilities: [16, 10, 10, 3, 3, 1], challenge: "—", proficiency: 2, initiative: 0,
    proficiencyFormula: p("Равен вашему бонусу мастерства", "Equals your Proficiency Bonus"),
    profile: p("Конструкт Огромного или меньшего размера, без мировоззрения. Скорость 30 фт.; Слепое зрение 30 фт., пассивная Внимательность 6. Понимает известные вам языки. Иммунитет к яду и психическому урону, Очарованию, Истощению, Испугу, Параличу и Отравлению. Опыт 0.", "Huge or smaller Construct, Unaligned. Speed 30 ft.; Blindsight 30 ft., passive Perception 6. Understands the languages you know. Immune to Poison and Psychic damage; Charmed, Exhaustion, Frightened, Paralyzed and Poisoned. XP 0."),
    rules: [p("Удар: рукопашная атака с вашим модификатором атаки заклинанием, досягаемость 5 фт. Урон силовым полем: 1d4 + 3 для Среднего и меньшего; 2d6 + 3 + модификатор вашей заклинательной характеристики для Большого; 2d12 + 3 + тот же модификатор для Огромного. За каждый круг ячейки выше 5-го прибавьте соответственно 1d4, 1d6 или 1d12.", "Slam: melee attack using your spell attack modifier, reach 5 ft. Force damage: 1d4 + 3 for Medium or smaller; 2d6 + 3 + your spellcasting ability modifier for Large; 2d12 + 3 + that modifier for Huge. Each slot level above 5 adds 1d4, 1d6 or 1d12 respectively.")],
  },
  {
    id: "awakened-tree-2024", edition: "2024", name: p("Пробуждённое дерево", "Awakened Tree"), sourceUrl: `${srd52}#page=260`,
    armorClass: 13, hp: 59, hitDice: "7d12 + 14", abilities: [19, 6, 15, 10, 10, 7], challenge: "2", proficiency: 2, initiative: -2,
    profile: p("Огромное Растение, нейтральное. Скорость 20 фт.; пассивная Внимательность 10. Общий и ещё один язык. Уязвимость к огню; Сопротивление дробящему и колющему урону.", "Huge Plant, Neutral. Speed 20 ft.; passive Perception 10. Common plus one other language. Vulnerable to Fire; Resistant to Bludgeoning and Piercing damage."),
    rules: [p("Удар: рукопашная атака +6, досягаемость 10 фт.; 14 (3d6 + 4) дробящего урона.", "Slam: melee attack +6, reach 10 ft.; 14 (3d6 + 4) Bludgeoning damage.")],
  },
  {
    id: "giant-centipede-2014", edition: "2014", name: p("Гигантская многоножка", "Giant Centipede"), sourceUrl: `${srd51}#page=374`,
    armorClass: 13, hp: 4, hitDice: "1d6 + 1", abilities: [5, 14, 12, 1, 7, 3], challenge: "1/4", proficiency: 2, initiative: 2,
    profile: p("Маленький Зверь, без мировоззрения. Природный доспех. Скорость 30 фт., лазание 30 фт.; Слепое зрение 30 фт., пассивная Внимательность 8; языков нет.", "Small Beast, Unaligned. Natural armor. Speed 30 ft., climb 30 ft.; blindsight 30 ft., passive Perception 8; no languages."),
    rules: [p("Укус: рукопашная атака оружием +4, досягаемость 5 фт., одно существо; 4 (1d4 + 2) колющего урона. Спасбросок Телосложения Сл 11: при провале ещё 10 (3d6) урона ядом. Если яд опускает цель до 0 хитов, она стабильна, но Отравлена 1 час, даже после восстановления хитов, и Парализована, пока отравлена таким образом.", "Bite: melee weapon attack +4, reach 5 ft., one creature; 4 (1d4 + 2) Piercing damage. DC 11 Constitution save: failure adds 10 (3d6) Poison damage. If the poison reduces the target to 0 HP, it is stable but Poisoned for 1 hour, even after regaining HP, and Paralyzed while Poisoned this way.")],
  },
  {
    id: "giant-spider-2014", edition: "2014", name: p("Гигантский паук", "Giant Spider"), sourceUrl: `${srd51}#page=379`,
    armorClass: 14, hp: 26, hitDice: "4d10 + 4", abilities: [14, 16, 12, 2, 11, 4], challenge: "1", proficiency: 2, initiative: 3,
    profile: p("Большой Зверь, без мировоззрения. Природный доспех. Скорость 30 фт., лазание 30 фт.; Скрытность +7; Слепое зрение 10 фт., Тёмное зрение 60 фт., пассивная Внимательность 10; языков нет.", "Large Beast, Unaligned. Natural armor. Speed 30 ft., climb 30 ft.; Stealth +7; blindsight 10 ft., darkvision 60 ft., passive Perception 10; no languages."),
    rules: [
      p("Паучье лазание: сложные поверхности и потолки без проверки характеристики. Чувство паутины: касаясь паутины, знает точное местонахождение других касающихся её существ. Хождение по паутине: игнорирует ограничения перемещения от паутины.", "Spider Climb: climbs difficult surfaces and ceilings without an ability check. Web Sense: while touching a web, knows the exact location of other creatures touching it. Web Walker: ignores movement restrictions from webbing."),
      p("Укус: рукопашная атака оружием +5, досягаемость 5 фт., одно существо; 7 (1d8 + 3) колющего урона и спасбросок Телосложения Сл 11: 9 (2d8) урона ядом при провале, половина при успехе. При падении до 0 хитов от яда цель стабильна, но Отравлена 1 час, даже после восстановления хитов, и Парализована, пока отравлена так.", "Bite: melee weapon attack +5, reach 5 ft., one creature; 7 (1d8 + 3) Piercing damage, then a DC 11 Constitution save: 9 (2d8) Poison damage on failure, half on success. If poison reduces it to 0 HP, the target is stable but Poisoned for 1 hour even after healing, and Paralyzed while Poisoned this way."),
      p("Паутина, перезарядка 5–6: дальнобойная атака оружием +5, дистанция 30/60 фт., одно существо. Попадание Опутывает паутиной. Действием цель может пройти проверку Силы Сл 12 и разорвать её. Паутину можно уничтожить: КД 10, 5 хитов, уязвимость к огню, иммунитет к дробящему урону, яду и психическому урону.", "Web, Recharge 5–6: ranged weapon attack +5, range 30/60 ft., one creature. Hit: Restrained by webbing. The target can use an action for a DC 12 Strength check to burst it. Webbing: AC 10, HP 5, vulnerable to Fire, immune to Bludgeoning, Poison and Psychic damage."),
    ],
  },
  {
    id: "giant-wasp-2014", edition: "2014", name: p("Гигантская оса", "Giant Wasp"), sourceUrl: `${srd51}#page=380`,
    armorClass: 12, hp: 13, hitDice: "3d8", abilities: [10, 14, 10, 1, 10, 3], challenge: "1/2", proficiency: 2, initiative: 2,
    profile: p("Средний Зверь, без мировоззрения. Скорость 10 фт., полёт 50 фт.; пассивная Внимательность 10; языков нет.", "Medium Beast, Unaligned. Speed 10 ft., fly 50 ft.; passive Perception 10; no languages."),
    rules: [p("Жало: рукопашная атака оружием +4, досягаемость 5 фт., одно существо; 5 (1d6 + 2) колющего урона и спасбросок Телосложения Сл 11: 10 (3d6) урона ядом при провале, половина при успехе. При падении до 0 хитов от яда цель стабильна, но Отравлена 1 час, даже после восстановления хитов, и Парализована, пока отравлена так.", "Sting: melee weapon attack +4, reach 5 ft., one creature; 5 (1d6 + 2) Piercing damage, then a DC 11 Constitution save: 10 (3d6) Poison damage on failure, half on success. If poison reduces it to 0 HP, the target is stable but Poisoned for 1 hour even after healing, and Paralyzed while Poisoned this way.")],
  },
  {
    id: "giant-scorpion-2014", edition: "2014", name: p("Гигантский скорпион", "Giant Scorpion"), sourceUrl: `${srd51}#page=378`,
    armorClass: 15, hp: 52, hitDice: "7d10 + 14", abilities: [15, 13, 15, 1, 9, 3], challenge: "3", proficiency: 2, initiative: 1,
    profile: p("Большой Зверь, без мировоззрения. Природный доспех. Скорость 40 фт.; Слепое зрение 60 фт., пассивная Внимательность 9; языков нет.", "Large Beast, Unaligned. Natural armor. Speed 40 ft.; blindsight 60 ft., passive Perception 9; no languages."),
    rules: [
      p("Мультиатака: две атаки Клешнями и одна Жалом.", "Multiattack: two Claw attacks and one Sting attack."),
      p("Клешня: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 6 (1d8 + 2) дробящего урона и Захват, Сл высвобождения 12. У скорпиона две клешни, каждая удерживает только одну цель.", "Claw: melee weapon attack +4, reach 5 ft., one target; 6 (1d8 + 2) Bludgeoning damage and Grappled, escape DC 12. Each of the two claws can grapple only one target."),
      p("Жало: рукопашная атака оружием +4, досягаемость 5 фт., одно существо; 7 (1d10 + 2) колющего урона и спасбросок Телосложения Сл 12: 22 (4d10) урона ядом при провале, половина при успехе.", "Sting: melee weapon attack +4, reach 5 ft., one creature; 7 (1d10 + 2) Piercing damage, then a DC 12 Constitution save: 22 (4d10) Poison damage on failure, half on success."),
    ],
  },
  {
    id: "giant-insect-spirit-2024", edition: "2024", name: p("Гигантское насекомое", "Giant Insect"), sourceUrl: `${srd52}#page=136`,
    armorClass: 15, armorClassFormula: p("11 + круг заклинания", "11 + spell level"),
    hp: 30, hpFormula: p("30 + 10 за каждый круг заклинания выше 4-го", "30 + 10 for each spell level above 4"), hitDice: "—",
    abilities: [17, 13, 15, 4, 14, 3], challenge: "—", proficiency: 2, initiative: 1,
    proficiencyFormula: p("Равен вашему бонусу мастерства", "Equals your Proficiency Bonus"),
    profile: p("Большой Зверь, без мировоззрения. Скорость 40 фт., лазание 40 фт.; только Оса: полёт 40 фт. Тёмное зрение 60 фт., пассивная Внимательность 12. Понимает известные вам языки. Опыт 0.", "Large Beast, Unaligned. Speed 40 ft., Climb 40 ft.; Wasp only: Fly 40 ft. Darkvision 60 ft., passive Perception 12. Understands the languages you know. XP 0."),
    rules: [
      p("Паучье лазание: поднимается по сложным поверхностям и потолкам без проверки характеристики.", "Spider Climb: climbs difficult surfaces and ceilings without an ability check."),
      p("Мультиатака: число атак равно половине круга заклинания с округлением вниз.", "Multiattack: makes a number of attacks equal to half the spell level, rounded down."),
      p("Ядовитый укол: рукопашная атака с вашим модификатором атаки заклинанием, досягаемость 10 фт.; 1d6 + 3 + круг заклинания колющего урона и 1d4 урона ядом.", "Poison Jab: melee attack using your spell attack modifier, reach 10 ft.; 1d6 + 3 + spell level Piercing damage plus 1d4 Poison damage."),
      p("Паутинный снаряд, только Паук: дальнобойная атака с вашим модификатором атаки заклинанием, дистанция 60 фт.; 1d10 + 3 + круг заклинания дробящего урона. Скорость цели уменьшается до 0 до начала следующего хода насекомого.", "Web Bolt, Spider only: ranged attack using your spell attack modifier, range 60 ft.; 1d10 + 3 + spell level Bludgeoning damage. Target's Speed becomes 0 until the start of the insect's next turn."),
      p("Ядовитый плевок, только Многоножка, бонусное действие: одно видимое насекомым существо в пределах 10 фт. делает спасбросок Телосложения против Сл ваших заклинаний. При провале Отравлено до начала следующего хода насекомого.", "Venomous Spew, Centipede only, Bonus Action: one creature the insect sees within 10 ft. makes a Constitution save against your spell save DC. Failure: Poisoned until the start of the insect's next turn."),
    ],
  },
  {
    id: "riding-horse-2014", edition: "2014", name: p("Верховая лошадь", "Riding Horse"), sourceUrl: `${srd51}#page=388`,
    armorClass: 10, hp: 13, hitDice: "2d10 + 2", abilities: [16, 10, 12, 2, 11, 7], challenge: "1/4", proficiency: 2, initiative: 0,
    profile: p("Большой Зверь, без мировоззрения. Скорость 60 фт.; пассивная Внимательность 10; языков нет.", "Large Beast, Unaligned. Speed 60 ft.; passive Perception 10; no languages."),
    rules: [p("Копыта: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 8 (2d4 + 3) дробящего урона.", "Hooves: melee weapon attack +5, reach 5 ft., one target; 8 (2d4 + 3) Bludgeoning damage.")],
  },
  {
    id: "warhorse-2014", edition: "2014", name: p("Боевой конь", "Warhorse"), sourceUrl: `${srd51}#page=392`,
    armorClass: 11, hp: 19, hitDice: "3d10 + 3", abilities: [18, 12, 13, 2, 12, 7], challenge: "1/2", proficiency: 2, initiative: 1,
    profile: p("Большой Зверь, без мировоззрения. Скорость 60 фт.; пассивная Внимательность 11; языков нет.", "Large Beast, Unaligned. Speed 60 ft.; passive Perception 11; no languages."),
    rules: [
      p("Топчущий разбег: после движения минимум 20 фт. прямо к существу и попадания Копытами по нему в тот же ход цель делает спасбросок Силы Сл 14; провал сбивает Ничком. Если цель лежит Ничком, конь может бонусным действием ещё раз атаковать её Копытами.", "Trampling Charge: after moving at least 20 ft. straight toward a creature and hitting it with Hooves on the same turn, force a DC 14 Strength save; failure knocks it Prone. If it is Prone, the horse can make another Hooves attack against it as a Bonus Action."),
      p("Копыта: рукопашная атака оружием +6, досягаемость 5 фт., одна цель; 11 (2d6 + 4) дробящего урона.", "Hooves: melee weapon attack +6, reach 5 ft., one target; 11 (2d6 + 4) Bludgeoning damage."),
    ],
  },
  {
    id: "pony-2014", edition: "2014", name: p("Пони", "Pony"), sourceUrl: `${srd51}#page=386`,
    armorClass: 10, hp: 11, hitDice: "2d8 + 2", abilities: [15, 10, 13, 2, 11, 7], challenge: "1/8", proficiency: 2, initiative: 0,
    profile: p("Средний Зверь, без мировоззрения. Скорость 40 фт.; пассивная Внимательность 10; языков нет.", "Medium Beast, Unaligned. Speed 40 ft.; passive Perception 10; no languages."),
    rules: [p("Копыта: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 7 (2d4 + 2) дробящего урона.", "Hooves: melee weapon attack +4, reach 5 ft., one target; 7 (2d4 + 2) Bludgeoning damage.")],
  },
  {
    id: "camel-2014", edition: "2014", name: p("Верблюд", "Camel"), sourceUrl: `${srd51}#page=369`,
    armorClass: 9, hp: 15, hitDice: "2d10 + 4", abilities: [16, 8, 14, 2, 8, 5], challenge: "1/8", proficiency: 2, initiative: -1,
    profile: p("Большой Зверь, без мировоззрения. Скорость 50 фт.; пассивная Внимательность 9; языков нет.", "Large Beast, Unaligned. Speed 50 ft.; passive Perception 9; no languages."),
    rules: [p("Укус: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 2 (1d4) дробящего урона.", "Bite: melee weapon attack +5, reach 5 ft., one target; 2 (1d4) Bludgeoning damage.")],
  },
  {
    id: "elk-2014", edition: "2014", name: p("Лось", "Elk"), sourceUrl: `${srd51}#page=372`,
    armorClass: 10, hp: 13, hitDice: "2d10 + 2", abilities: [16, 10, 12, 2, 10, 6], challenge: "1/4", proficiency: 2, initiative: 0,
    profile: p("Большой Зверь, без мировоззрения. Скорость 50 фт.; пассивная Внимательность 10; языков нет.", "Large Beast, Unaligned. Speed 50 ft.; passive Perception 10; no languages."),
    rules: [
      p("Разбег: после движения минимум 20 фт. прямо к цели и попадания Тараном в тот же ход нанесите дополнительно 7 (2d6) урона. Цель-существо также делает спасбросок Силы Сл 13; провал сбивает Ничком.", "Charge: after moving at least 20 ft. straight toward a target and hitting it with Ram on the same turn, deal an extra 7 (2d6) damage. A creature target also makes a DC 13 Strength save; failure knocks it Prone."),
      p("Таран: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 6 (1d6 + 3) дробящего урона. Копыта: рукопашная атака оружием +5, досягаемость 5 фт., одно лежащее Ничком существо; 8 (2d4 + 3) дробящего урона.", "Ram: melee weapon attack +5, reach 5 ft., one target; 6 (1d6 + 3) Bludgeoning damage. Hooves: melee weapon attack +5, reach 5 ft., one Prone creature; 8 (2d4 + 3) Bludgeoning damage."),
    ],
  },
  {
    id: "mastiff-2014", edition: "2014", name: p("Мастиф", "Mastiff"), sourceUrl: `${srd51}#page=384`,
    armorClass: 12, hp: 5, hitDice: "1d8 + 1", abilities: [13, 14, 12, 3, 12, 7], challenge: "1/8", proficiency: 2, initiative: 2,
    profile: p("Средний Зверь, без мировоззрения. Скорость 40 фт.; Внимательность +3, пассивная Внимательность 13; языков нет.", "Medium Beast, Unaligned. Speed 40 ft.; Perception +3, passive Perception 13; no languages."),
    rules: [
      p("Острый слух и нюх: преимущество на проверки Мудрости (Внимательность), использующие слух или обоняние.", "Keen Hearing and Smell: Advantage on Wisdom (Perception) checks relying on hearing or smell."),
      p("Укус: рукопашная атака оружием +3, досягаемость 5 фт., одна цель; 4 (1d6 + 1) колющего урона. Цель-существо делает спасбросок Силы Сл 11; провал сбивает Ничком.", "Bite: melee weapon attack +3, reach 5 ft., one target; 4 (1d6 + 1) Piercing damage. A creature target makes a DC 11 Strength save; failure knocks it Prone."),
    ],
  },
  {
    id:"otherworldly-steed-2024",edition:"2024",name:p("Потусторонний скакун","Otherworldly Steed"),sourceUrl:srd52+"#page=131",
    armorClass:12,armorClassFormula:p("10 + круг заклинания","10 + spell level"),hp:25,hitDice:"2d10",
    hpFormula:p("5 + 10 × круг заклинания; число костей хитов d10 равно кругу","5 + 10 × spell level; number of d10 Hit Dice equals spell level"),
    abilities:[18,12,14,6,12,8],challenge:"—",proficiency:2,initiative:1,
    proficiencyFormula:p("Равен вашему бонусу мастерства","Equals your Proficiency Bonus"),
    profile:p("Большой Небожитель, Фея или Исчадие на выбор, нейтральный. Скорость 60 фт.; Полёт 60 фт. при ячейке 4-го круга и выше. Пассивная Внимательность 11. Телепатия 1 миля только с вами. Опыт 0.","Large Celestial, Fey, or Fiend of your choice, Neutral. Speed 60 ft.; Fly 60 ft. with a level 4+ spell. Passive Perception 11. Telepathy 1 mile, only with you. XP 0."),
    rules:[
      p("Езда верхом (SRD 5.2.1, с. 15–16): согласное существо подходящего строения должно быть минимум на один размер больше всадника. Сесть на него в пределах 5 фт. или спешиться во время перемещения стоит половину вашей Скорости с округлением вниз.","Mounted combat (SRD 5.2.1, pp. 15–16): a willing mount with suitable anatomy must be at least one size larger than its rider. Mounting it within 5 ft. or dismounting during your movement costs half your Speed, rounded down."),
      p("Управляемый скакун перемещается в ваш ход по вашим указаниям; его действие ограничено Рывком, Отходом или Уклонением. Он может двигаться и действовать уже в тот ход, когда вы сели на него.","A controlled mount moves on your turn as directed; its action options are Dash, Disengage, or Dodge. It can move and act even on the turn you mount it."),
      p("Если эффект собирается принудительно переместить скакуна, пока вы на нём, либо вас или скакуна сбивают Ничком, сделайте спасбросок Ловкости Сл 10. При провале вы падаете Ничком в свободное пространство в пределах 5 фт. от скакуна.","When an effect is about to move the mount against its will while you ride it, or either rider or mount is knocked Prone, make a DC 10 Dexterity save. Failure makes you fall off, Prone, into an unoccupied space within 5 ft. of the mount."),
      p("Связь жизни: когда заклинание 1-го круга или выше восстанавливает вам хиты, скакун в пределах 5 фт. от вас восстанавливает столько же.","Life Bond: when a level 1+ spell restores your Hit Points, the steed regains the same amount if within 5 ft. of you."),
      p("Потусторонний удар: рукопашная атака с вашим модификатором атаки заклинанием, досягаемость 5 фт.; 1d8 + круг заклинания урона излучением для Небожителя, психического для Феи или некротического для Исчадия.","Otherworldly Slam: melee attack using your spell attack modifier, reach 5 ft.; 1d8 + spell level Radiant (Celestial), Psychic (Fey), or Necrotic (Fiend) damage."),
      p("Зловещий взгляд, только Исчадие, бонусное действие с восстановлением после долгого отдыха: одно видимое скакуном существо в пределах 60 фт. делает спасбросок Мудрости против Сл ваших заклинаний; провал даёт Испуганный до конца вашего следующего хода.","Fell Glare, Fiend only, Bonus Action recharging after a Long Rest: one creature the steed sees within 60 ft. makes a Wisdom save against your spell save DC; failure causes Frightened until the end of your next turn."),
      p("Шаг феи, только Фея, бонусное действие с восстановлением после долгого отдыха: скакун вместе со всадником телепортируется в свободное пространство в пределах 60 фт.","Fey Step, Fey only, Bonus Action recharging after a Long Rest: teleport the steed and its rider to an unoccupied space within 60 ft."),
      p("Исцеляющее касание, только Небожитель, бонусное действие с восстановлением после долгого отдыха: одно существо в пределах 5 фт. восстанавливает 2d8 + круг заклинания хитов.","Healing Touch, Celestial only, Bonus Action recharging after a Long Rest: one creature within 5 ft. regains 2d8 + spell level Hit Points."),
    ],
  },
  ...FAMILIAR_BEASTS_2024,
  ...FAMILIAR_BEASTS_2014,
  {
    id: "mummy-lord-2024", edition: "2024", name: p("Мумия-владыка", "Mummy Lord"), sourceUrl: `${srd52}#page=309`,
    armorClass: 17, hp: 187, hitDice: "25d8 + 75", abilities: [18, 10, 17, 11, 19, 16], challenge: "15", proficiency: 5, initiative: 10,
    profile: p("Средняя или Маленькая Нежить (Жрец), законно-злая. Скорость 30 фт.; спасброски Интеллекта +5, Мудрости +9; История +5, Восприятие +9, Религия +5. Уязвимость к огню; иммунитет к некротическому урону, яду, Очарованию, Истощению, Испугу, Параличу, Отравлению. Истинное зрение 60 фт., пассивное Восприятие 19. Общий и ещё три языка.", "Medium or Small Lawful Evil Undead (Cleric). Speed 30 ft.; Intelligence save +5, Wisdom save +9; History +5, Perception +9, Religion +5. Vulnerable to Fire; immune to Necrotic, Poison, Charmed, Exhaustion, Frightened, Paralyzed, Poisoned. Truesight 60 ft., passive Perception 19. Common and three other languages."),
    spellIds: ["dispel-magic-2024", "thaumaturgy-2024", "animate-dead-2024", "harm-2024", "insect-plague-2024", "command-2024"],
    rules: [
      p("Легендарное сопротивление 3/день (4/день в логове): заменяет провал спасброска успехом. Сопротивление магии: Преимущество на спасброски от заклинаний и прочих магических эффектов.", "Legendary Resistance 3/day (4/day in lair): replace a failed save with success. Magic Resistance: Advantage on saves against spells and other magical effects."),
      p("Восстановление нежити: после уничтожения при целом сердце через 24 часа получает новое тело с полными хитами в свободном месте логова. Сердце — Крошечный предмет, КЗ 17, 10 хитов, иммунитет ко всему урону кроме огня.", "Undead Restoration: if its heart survives destruction, regains a body with full HP after 24 hours in an unoccupied space in its lair. The heart is a Tiny object, AC 17, 10 HP, immune to all damage except Fire."),
      p("Мультиатака: один Гниющий кулак или Поток отрицательной энергии и Ужасающий взгляд.", "Multiattack: one Rotting Fist or Channel Negative Energy attack and Dreadful Glare."),
      p("Гниющий кулак: рукопашная атака +9, досягаемость 5 фт.; 15 (2d10 + 4) дробящего плюс 10 (3d6) некротического урона. Существо проклято: не восстанавливает хиты, не получает пользы от Долгого отдыха, максимум хитов уменьшается на 10 (3d6) каждые 24 часа. Снижение до 0 хитов этой атакой убивает и обращает в пыль.", "Rotting Fist: melee attack +9, reach 5 ft.; 15 (2d10 + 4) Bludgeoning plus 10 (3d6) Necrotic damage. A creature is cursed: cannot regain HP, gains no benefit from Long Rests, and loses 10 (3d6) HP maximum every 24 hours. Reduction to 0 HP by this attack kills it and turns it to dust."),
      p("Поток отрицательной энергии: дальнобойная атака +9, дистанция 60 фт.; 25 (6d6 + 4) некротического урона.", "Channel Negative Energy: ranged attack +9, range 60 ft.; 25 (6d6 + 4) Necrotic damage."),
      p("Ужасающий взгляд: видимое существо в 60 фт., спасбросок Мудрости Сл 17; провал — 25 (6d6 + 4) психического урона и Паралич до конца следующего хода мумии.", "Dreadful Glare: one visible creature within 60 feet, DC 17 Wisdom save; failure deals 25 (6d6 + 4) Psychic damage and Paralyzed until the end of the mummy’s next turn."),
      p("Заклинания без материальных компонентов, Мудрость, Сл 17, атака +9. Неограниченно Рассеивание магии и Чудотворство; по 1/день Восставший труп, Вред и Нашествие насекомых 7-го круга.", "Spellcasting without Material components, Wisdom, DC 17, attack +9. At will: Dispel Magic and Thaumaturgy. Once per day each: Animate Dead, Harm, Insect Plague at level 7."),
      p("Реакция при попадании броском атаки — Песчаный вихрь: +2 КЗ против этой атаки, возможно превращая попадание в промах; телепортируется до 60 фт. в видимое свободное место. Выбранные видимые существа в 5 фт. от места прибытия Ослеплены до конца следующего хода мумии.", "Reaction when hit by an attack roll — Whirlwind of Sand: +2 AC against that attack, possibly making it miss; teleports up to 60 feet to a visible unoccupied space. Chosen visible creatures within 5 feet of the destination are Blinded until the end of its next turn."),
      p("Легендарные действия: 3 применения (4 в логове), восстановление в начале своего хода. Сразу после хода другого существа тратит одно: Приказ 2-го круга с параметрами своей магии; Ужасающий взгляд; либо одна атака Гниющим кулаком/Потоком отрицательной энергии. Приказ и Взгляд каждый недоступны повторно до начала следующего своего хода.", "Legendary Actions: 3 uses (4 in lair), regained at the start of its turn. Immediately after another creature’s turn, spend one to cast level-2 Command using its spellcasting, use Dreadful Glare, or make a Rotting Fist/Channel Negative Energy attack. Command and Glare each cannot be used again until the start of its next turn.")
    ]
  },
  {
    id: "treant-2024", edition: "2024", name: p("Трент", "Treant"), sourceUrl: `${srd52}#page=333`,
    armorClass: 16, hp: 138, hitDice: "12d12 + 60", abilities: [23, 8, 21, 12, 16, 12], challenge: "9", proficiency: 4, initiative: 3,
    profile: p("Огромное Растение, хаотично-доброе. Скорость 30 фт.; уязвимость к огню, сопротивление дробящему и колющему урону. Пассивное Восприятие 13. Общий, Друидический, Эльфийский, Сильван.", "Huge Chaotic Good Plant. Speed 30 ft.; vulnerable to Fire, resistant to Bludgeoning and Piercing. Passive Perception 13. Common, Druidic, Elvish, Sylvan."),
    rules: [
      p("Осадное чудовище: двойной урон предметам и строениям.", "Siege Monster: double damage to objects and structures."),
      p("Мультиатака: два Размашистых удара.", "Multiattack: two Slam attacks."),
      p("Размашистый удар: рукопашная атака +10, досягаемость 5 фт.; 16 (3d6 + 6) дробящего урона.", "Slam: melee attack +10, reach 5 ft.; 16 (3d6 + 6) Bludgeoning damage."),
      p("Град коры: дальнобойная атака +10, дистанция 180 фт.; 28 (4d10 + 6) колющего урона.", "Hail of Bark: ranged attack +10, range 180 ft.; 28 (4d10 + 6) Piercing damage."),
      p("Оживление деревьев 1/день: до двух видимых деревьев в 60 фт. получают этот статблок, но Интеллект и Харизма равны 1, не говорят и не имеют этого действия. Исполняют приказы трента и ходят сразу после него с той же инициативой. Действует 1 день, до смерти дерева или трента либо удаления дальше 120 фт. Затем дерево укореняется, если возможно.", "Animate Trees once per day: up to two visible trees within 60 feet use this stat block, with Intelligence and Charisma 1, no speech, and no Animate Trees action. They obey the treant and act immediately after it on its initiative. Lasts 1 day, until either tree or treant dies, or until over 120 feet away, then the tree takes root if possible.")
    ]
  },
  {
    id: "shrieker-fungus-2024", edition: "2024", name: p("Гриб-визгун", "Shrieker Fungus"), sourceUrl: `${srd52}#page=286`,
    armorClass: 5, hp: 13, hitDice: "3d8", abilities: [1, 1, 10, 1, 3, 1], challenge: "0", proficiency: 2, initiative: -5,
    profile: p("Среднее Растение без мировоззрения. Скорость 5 фт.; иммунитет к Слепоте, Очарованию, Глухоте и Испугу. Слепое зрение 30 фт., пассивное Восприятие 6; языков нет.", "Medium unaligned Plant. Speed 5 ft.; immune to Blinded, Charmed, Deafened, Frightened. Blindsight 30 ft., passive Perception 6; no languages."),
    rules: [p("Реакция — Визг: если существо или источник яркого света переместится в пределы 30 фт., издаёт слышимый на 300 фт. визг в течение 1 минуты или до своей смерти.", "Reaction — Shriek: when a creature or source of Bright Light moves within 30 feet, shrieks audibly within 300 feet for 1 minute or until it dies.")]
  },
  {
    id: "bulette-2024", edition: "2024", name: p("Панцирница", "Bulette"), sourceUrl: `${srd52}#page=272`,
    armorClass: 17, hp: 94, hitDice: "9d10 + 45", abilities: [19, 11, 21, 2, 10, 5], challenge: "5", proficiency: 3, initiative: 0,
    profile: p("Большой Монстр без мировоззрения. Скорость 40 фт., Копание 40 фт.; Восприятие +6, пассивное 16, Тёмное зрение 60 фт., Чувство вибрации 120 фт.; языков нет.", "Large unaligned Monstrosity. Speed 40 ft., Burrow 40 ft.; Perception +6, passive 16, Darkvision 60 ft., Tremorsense 120 ft.; no languages."),
    rules: [
      p("Мультиатака: два Укуса.", "Multiattack: two Bite attacks."),
      p("Укус: рукопашная атака +7, досягаемость 5 фт.; 17 (2d12 + 4) колющего урона.", "Bite: melee attack +7, reach 5 ft.; 17 (2d12 + 4) Piercing damage."),
      p("Действие — Смертельный прыжок: тратит 5 фт. перемещения, прыгая в пространство в 15 фт., занятое одним или несколькими существами Большого размера или меньше. Каждая цель там делает спасбросок Ловкости Сл 15: провал — 19 (3d12) дробящего урона и Ничком; успех — половина урона и отталкивание на 5 фт. прямо от панцирницы.", "Action — Deadly Leap: spends 5 feet of movement to jump to a space within 15 feet containing one or more Large or smaller creatures. Each creature there makes a DC 15 Dexterity save: failure deals 19 (3d12) Bludgeoning damage and Prone; success deals half and pushes the creature 5 feet directly away."),
      p("Бонусное действие — Прыжок: прыгает до 30 фт., потратив 10 фт. перемещения.", "Bonus Action — Leap: jumps up to 30 feet by spending 10 feet of movement.")
    ]
  },
  {
    id: "mummy-2024", edition: "2024", name: p("Мумия", "Mummy"), sourceUrl: `${srd52}#page=309`,
    armorClass: 11, hp: 58, hitDice: "9d8 + 18", abilities: [16, 8, 15, 6, 12, 12], challenge: "3", proficiency: 2, initiative: -1,
    profile: p("Средняя или Маленькая Нежить, законно-злая. Скорость 20 фт., спасбросок Мудрости +3; уязвимость к огню, иммунитет к некротическому урону, яду, Очарованию, Истощению, Испугу, Параличу, Отравлению. Тёмное зрение 60 фт., пассивное Восприятие 11. Общий и ещё два языка.", "Medium or Small Lawful Evil Undead. Speed 20 ft., Wisdom save +3; vulnerable to Fire, immune to Necrotic, Poison, Charmed, Exhaustion, Frightened, Paralyzed, Poisoned. Darkvision 60 ft., passive Perception 11. Common and two other languages."),
    rules: [
      p("Мультиатака: два Гниющих кулака и Ужасающий взгляд.", "Multiattack: two Rotting Fist attacks and Dreadful Glare."),
      p("Гниющий кулак: рукопашная атака +5, досягаемость 5 фт.; 8 (1d10 + 3) дробящего плюс 10 (3d6) некротического урона. Существо проклято: не восстанавливает хиты, максимум хитов не возвращается после Долгого отдыха и уменьшается на 10 (3d6) каждые 24 часа. Снижение хитов до 0 этой атакой убивает и обращает в пыль.", "Rotting Fist: melee attack +5, reach 5 ft.; 8 (1d10 + 3) Bludgeoning plus 10 (3d6) Necrotic damage. A creature is cursed: it cannot regain HP, its HP maximum does not recover on a Long Rest, and that maximum drops by 10 (3d6) every 24 hours. Being reduced to 0 HP by this attack kills it and turns it to dust."),
      p("Ужасающий взгляд: видимое существо в 60 фт., спасбросок Мудрости Сл 11. Провал — Испуг до конца следующего хода мумии; успех — иммунитет к взгляду этой мумии на 24 часа.", "Dreadful Glare: one visible creature within 60 feet, DC 11 Wisdom save. Failure: Frightened until the end of the mummy’s next turn. Success: immune to this mummy’s glare for 24 hours.")
    ]
  },
  {
    id: "draconic-spirit-2024", edition: "2024", name: p("Драконий дух", "Draconic Spirit"), sourceUrl: `${srd52}#page=166`,
    armorClass: 19, armorClassFormula: p("14 + круг заклинания", "14 + spell level"), hp: 50, hpFormula: p("50 + 10 за каждый круг выше 5", "50 + 10 per spell level above 5"), hitDice: "—",
    abilities: [19, 14, 17, 10, 14, 14], challenge: "—", proficiency: 2, proficiencyFormula: p("ваш БМ", "your PB"),
    profile: p("Большой Дракон, нейтральный. Скорость 30 фт., Полёт 60 фт., Плавание 30 фт. Сопротивление кислоте, холоду, огню, электричеству и яду. Иммунитет к Очарованию, Испугу и Отравлению. Слепое зрение 30 фт., Тёмное зрение 60 фт., пассивное Восприятие 12. Драконий язык; понимает ваши языки.", "Large Neutral Dragon. Speed 30 ft., Fly 60 ft., Swim 30 ft. Resists Acid, Cold, Fire, Lightning, Poison. Immune to Charmed, Frightened, Poisoned. Blindsight 30 ft., Darkvision 60 ft., passive Perception 12. Draconic; understands your languages."),
    rules: [
      p("Общее сопротивление: при призыве выберите одно сопротивление духа; вы получаете его до конца заклинания.", "Shared Resistances: on summoning, choose one of the spirit’s resistances; you gain it until the spell ends."),
      p("Мультиатака: число Разрываний равно половине круга заклинания вниз, затем Оружие дыхания.", "Multiattack: Rend attacks equal to half the spell level rounded down, plus Breath Weapon."),
      p("Разрывание: рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 10 фт.; 1d6 + 4 + круг заклинания колющего урона.", "Rend: melee attack using your spell attack bonus, reach 10 ft.; 1d6 + 4 + spell level Piercing damage."),
      p("Оружие дыхания: каждое существо в Конусе 30 фт. делает спасбросок Ловкости против вашей Сл заклинаний. Провал — 2d6 урона одного из типов сопротивления духа, выбранного при сотворении; успех — половина.", "Breath Weapon: each creature in a 30-foot Cone makes a Dexterity save against your spell save DC. Failure: 2d6 damage of a type the spirit resists, chosen on casting; success: half.")
    ]
  },
  {
    id: "elemental-spirit-2024", edition: "2024", name: p("Дух стихии", "Elemental Spirit"), sourceUrl: "https://next.dnd.su/bestiary/20935-elemental-spirit/",
    armorClass: 15, armorClassFormula: p("11 + круг заклинания", "11 + spell level"), hp: 50, hpFormula: p("50 + 10 за каждый круг выше 4", "50 + 10 per spell level above 4"), hitDice: "—",
    abilities: [18, 15, 17, 4, 10, 16], challenge: "—", proficiency: 2, proficiencyFormula: p("ваш БМ", "your PB"), initiative: 2,
    profile: p("Средний Элементаль, нейтральный. Скорость 40 фт.; Вода — Плавание 40, Воздух — Полёт 40 (парение), Земля — Копание 40. Тёмное зрение 60 фт., пассивное Восприятие 10. Первичный язык, понимает ваши языки. Все варианты невосприимчивы к яду, Истощению, Окаменению, Отравлению и Параличу. Земля сопротивляется колющему и рубящему, Воздух — звуку и электричеству, Вода — кислоте; Огонь невосприимчив к огню.", "Medium Neutral Elemental. Speed 40 ft.; Water: Swim 40, Air: Fly 40 (hover), Earth: Burrow 40. Darkvision 60 ft., passive Perception 10. Primordial, understands your languages. All forms are immune to Poison, Exhaustion, Petrified, Poisoned, Paralyzed. Earth resists Piercing and Slashing; Air resists Thunder and Lightning; Water resists Acid; Fire is immune to Fire."),
    rules: [
      p("Аморфность (Вода, Воздух, Огонь): проходит сквозь отверстие в 1 дюйм без трудной местности.", "Amorphous (Water, Air, Fire): passes through a 1-inch gap without treating it as Difficult Terrain."),
      p("Мультиатака: число Размашистых ударов равно половине круга заклинания вниз.", "Multiattack: Slam attacks equal to half the spell level rounded down."),
      p("Размашистый удар: рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт.; 1d10 + 4 + круг заклинания урона. Тип: дробящий для Земли, огонь для Огня, холод для Воды, электричество для Воздуха.", "Slam: melee attack using your spell attack bonus, reach 5 ft.; 1d10 + 4 + spell level damage. Earth: Bludgeoning; Fire: Fire; Water: Cold; Air: Lightning.")
    ]
  },
  {
    id: "terran-magen-2024", edition: "2024", name: p("Маген-земельник", "Terran Magen"), sourceUrl: "https://next.dnd.su/bestiary/27187-terran-magen",
    armorClass: 21, hp: 121, hitDice: "22d8 + 22", abilities: [16, 10, 12, 10, 18, 10], challenge: "8", proficiency: 3, initiative: 3,
    profile: p("Средний Конструкт без мировоззрения. Скорость 30 фт., Полёт 20 фт. (парение). Спасбросок Мудрости +7, Восприятие +7, пассивное 17. Иммунитет к звуку, яду, Испугу, Истощению, Глухоте, Окаменению, Слепоте, Отравлению, Очарованию, Параличу. Понимает Общий и ещё два языка, не говорит.", "Medium unaligned Construct. Speed 30 ft., Fly 20 ft. (hover). Wisdom save +7, Perception +7, passive 17. Immune to Thunder, Poison, Frightened, Exhaustion, Deafened, Petrified, Blinded, Poisoned, Charmed, Paralyzed. Understands Common and two other languages, cannot speak."),
    spellIds: ["mage-hand-2024", "mending-2024", "prestidigitation-2024", "move-earth-2024", "disintegrate-2024", "stone-shape-2024"],
    rules: [
      decay,
      p("Сопротивление магии: Преимущество на спасброски от заклинаний и прочих магических эффектов.", "Magic Resistance: Advantage on saves against spells and other magical effects."),
      p("Мультиатака: две следующие атаки в любой комбинации.", "Multiattack: two of the following attacks in any combination."),
      p("Кулак-молот: рукопашная атака +6, досягаемость 5 фт.; 16 (3d8 + 3) дробящего плюс 13 (3d8) силового урона.", "Hammer Fist: melee attack +6, reach 5 ft.; 16 (3d8 + 3) Bludgeoning plus 13 (3d8) Force damage."),
      p("Громовой раскат: дальнобойная атака +7, дистанция 60 фт.; 28 (8d6) урона звуком.", "Thunder Blast: ranged attack +7, range 60 ft.; 28 (8d6) Thunder damage."),
      p("Заклинания без материальных компонентов, Мудрость, Сл 15: Волшебная рука, Починка и Фокусы неограниченно; Движение почвы, Дезинтеграция и Изменение формы камня по 1/день.", "Spellcasting without Material components, Wisdom, DC 15: Mage Hand, Mending, and Prestidigitation at will; Move Earth, Disintegrate, and Stone Shape once per day each.")
    ]
  },
  {
    id: "roc-2024", edition: "2024", name: p("Рух", "Roc"), sourceUrl: `${srd52}#page=320`,
    armorClass: 15, hp: 248, hitDice: "16d20 + 80", abilities: [28, 10, 20, 3, 10, 9], challenge: "11", proficiency: 4, initiative: 8,
    profile: p("Громадный Монстр без мировоззрения. Скорость 20 фт., Полёт 120 фт.; спасброски Ловкости и Мудрости +4; Восприятие +8, пассивное 18; языков нет.", "Gargantuan unaligned Monstrosity. Speed 20 ft., Fly 120 ft.; Dexterity and Wisdom saves +4; Perception +8, passive 18; no languages."),
    rules: [
      p("Мультиатака: два Клюва, один можно заменить Когтями.", "Multiattack: two Beak attacks, one replaceable with Talons."),
      p("Клюв: рукопашная атака +13, досягаемость 10 фт.; 28 (3d12 + 9) колющего урона.", "Beak: melee attack +13, reach 10 ft.; 28 (3d12 + 9) Piercing damage."),
      p("Когти: рукопашная атака +13, досягаемость 5 фт.; 23 (4d6 + 9) рубящего урона. Существо Огромного размера либо меньше Схвачено обоими когтями, Сл высвобождения 19, и Опутано до конца захвата.", "Talons: melee attack +13, reach 5 ft.; 23 (4d6 + 9) Slashing damage. A Huge or smaller creature is Grappled by both talons, escape DC 19, and Restrained until the grapple ends."),
      p("Бонусное действие — Взмывание (перезарядка 5–6): если держит Схваченное существо, летит до половины скорости Полёта без провоцирования атак и отпускает его.", "Bonus Action — Swoop (Recharge 5–6): while Grappling a creature, flies up to half its Fly Speed without provoking Opportunity Attacks and drops it.")
    ]
  },
  {
    id: "eldritch-eddy-2024", edition: "2024", name: p("Магический вихрь", "Eldritch Eddy"), sourceUrl: "https://next.dnd.su/bestiary/27185-eldritch-eddy",
    armorClass: 11, hp: 144, hitDice: "17d10 + 51", abilities: [10, 12, 16, 12, 9, 17], challenge: "6", proficiency: 3, initiative: 1,
    profile: p("Большой Конструкт, хаотично-нейтральный. Скорость 10 фт., Полёт 40 фт. (парение). Спасброски Ловкости +4, Интеллекта +4, Харизмы +6. Сопротивление силовому урону; иммунитет к огню, электричеству, Испугу, Истощению, Окаменению, Отравлению, Очарованию, Параличу. Слепое зрение 60 фт., пассивное Восприятие 9; понимает Общий и ещё один язык, не говорит.", "Large Chaotic Neutral Construct. Speed 10 ft., Fly 40 ft. (hover). Saves: Dexterity +4, Intelligence +4, Charisma +6. Resists Force; immune to Fire, Lightning, Frightened, Exhaustion, Petrified, Poisoned, Charmed, Paralyzed. Blindsight 60 ft., passive Perception 9; understands Common and one other language, cannot speak."),
    rules: [
      p("Сопротивление магии: Преимущество на спасброски от заклинаний и других магических эффектов.", "Magic Resistance: Advantage on saves against spells and other magical effects."),
      p("Мультиатака: две следующие атаки в любой комбинации.", "Multiattack: two of the following attacks in any combination."),
      p("Жгучий замах: рукопашная атака +6, досягаемость 10 фт.; 13 (3d6 + 3) урона огнём или электричеством по выбору вихря.", "Searing Swipe: melee attack +6, reach 10 ft.; 13 (3d6 + 3) Fire or Lightning damage, chosen by the eddy."),
      p("Волшебный снаряд: дальнобойная атака +6, дистанция 120 фт.; 14 (2d10 + 3) силового урона.", "Magic Bolt: ranged attack +6, range 120 ft.; 14 (2d10 + 3) Force damage."),
      p("Реакция при получении урона — Магическая перегрузка: выбранные существа в Эманации 5 фт. совершают спасбросок Силы Сл 14. Провал: 7 (2d6) силового урона и падение Ничком.", "Reaction on taking damage — Magic Overload: chosen creatures in a 5-foot Emanation make a DC 14 Strength save. Failure: 7 (2d6) Force damage and Prone.")
    ]
  },
  {
    id: "giant-owl-2024", edition: "2024", name: p("Гигантская сова", "Giant Owl"), sourceUrl: "https://next.dnd.su/bestiary/21339-giant-owl",
    armorClass: 12, hp: 19, hitDice: "3d10 + 3", abilities: [13, 15, 12, 10, 14, 10], challenge: "1/4", proficiency: 2, initiative: 2,
    profile: p("Большой Небожитель, нейтральный. Скорость 5 фт., Полёт 60 фт.; спасбросок Мудрости +4, Восприятие +6, Скрытность +6. Сопротивление излучению и некротическому урону. Тёмное зрение 120 фт., пассивное Восприятие 16. Небесный язык; понимает Общий, Эльфийский и Сильван, но не говорит на них.", "Large Neutral Celestial. Speed 5 ft., Fly 60 ft.; Wisdom save +4, Perception +6, Stealth +6. Resists Radiant and Necrotic damage. Darkvision 120 ft., passive Perception 16. Celestial; understands Common, Elvish, and Sylvan but cannot speak them."),
    spellIds: ["detect-evil-and-good-2024", "detect-magic-2024", "scrying-2024"],
    rules: [
      p("Облёт: вылет из вражеской досягаемости не провоцирует атаки.", "Flyby: flying out of an enemy’s reach does not provoke Opportunity Attacks."),
      p("Когти: рукопашная атака +4, досягаемость 5 фт.; 7 (1d10 + 2) рубящего урона.", "Talons: melee attack +4, reach 5 ft.; 7 (1d10 + 2) Slashing damage."),
      p("Заклинания без компонентов, характеристика Мудрость: Обнаружение зла и добра и Обнаружение магии неограниченно; Подсматривание 1/день.", "Spellcasting without components, using Wisdom: Detect Evil and Good and Detect Magic at will; Scrying once per day.")
    ]
  },
  {
    id: "elephant-2024", edition: "2024", name: p("Слон", "Elephant"), sourceUrl: `${srd52}#page=348`,
    armorClass: 12, hp: 76, hitDice: "8d12 + 24", abilities: [22, 9, 17, 3, 11, 6], challenge: "4", proficiency: 2, initiative: -1,
    profile: p("Огромный Зверь без мировоззрения. Скорость 40 фт., пассивное Восприятие 10; языков нет.", "Huge unaligned Beast. Speed 40 ft., passive Perception 10; no languages."),
    rules: [
      p("Мультиатака: два удара бивнями.", "Multiattack: two Gore attacks."),
      p("Бивни: рукопашная атака +8, досягаемость 5 фт.; 15 (2d8 + 6) колющего урона. Если непосредственно перед попаданием слон прошёл прямо к цели не менее 20 фт., существо Огромного размера или меньше падает Ничком.", "Gore: melee attack +8, reach 5 ft.; 15 (2d8 + 6) Piercing damage. A Huge or smaller creature falls Prone if the elephant moved at least 20 feet straight toward it immediately before the hit."),
      p("Бонусное действие — Топот: одно существо Ничком в 5 фт., спасбросок Ловкости Сл 16; 17 (2d10 + 6) дробящего урона при провале, половина при успехе.", "Bonus Action — Trample: one Prone creature within 5 feet makes a DC 16 Dexterity save; 17 (2d10 + 6) Bludgeoning damage on failure, half on success.")
    ]
  },
  {
    id: "griffon-2024", edition: "2024", name: p("Грифон", "Griffon"), sourceUrl: `${srd52}#page=295`,
    armorClass: 12, hp: 59, hitDice: "7d10 + 21", abilities: [18, 15, 16, 2, 13, 8], challenge: "2", proficiency: 2, initiative: 2,
    profile: p("Большой Монстр без мировоззрения. Скорость 30 фт., Полёт 80 фт.; Восприятие +5, пассивное 15, Тёмное зрение 60 фт.; языков нет.", "Large unaligned Monstrosity. Speed 30 ft., Fly 80 ft.; Perception +5, passive 15, Darkvision 60 ft.; no languages."),
    rules: [p("Мультиатака: два Разрывания.", "Multiattack: two Rend attacks."), p("Разрывание: рукопашная атака +6, досягаемость 5 фт.; 8 (1d8 + 4) колющего урона. Существо Среднего размера или меньше Схвачено обоими передними когтями, Сл высвобождения 14.", "Rend: melee attack +6, reach 5 ft.; 8 (1d8 + 4) Piercing damage. A Medium or smaller creature is Grappled by both front claws, escape DC 14.")]
  },
  {
    id: "giant-fly-2024", edition: "2024", name: p("Гигантская муха", "Giant Fly"), sourceUrl: "https://next.dnd.su/bestiary/25970-giant-fly",
    armorClass: 11, hp: 19, hitDice: "3d10 + 3", abilities: [14, 13, 13, 2, 10, 3], challenge: "0", proficiency: 2, initiative: 1,
    profile: p("Большой Зверь без мировоззрения. Скорость 30 фт., Полёт 60 фт.; Тёмное зрение 60 фт., пассивное Восприятие 10; языков нет.", "Large unaligned Beast. Speed 30 ft., Fly 60 ft.; Darkvision 60 ft., passive Perception 10; no languages."), rules: []
  },
  {
    id: "onyx-dog-2024", edition: "2024", name: p("Ониксовая собака (мастиф)", "Onyx Dog (Mastiff)"), sourceUrl: "https://next.dnd.su/items/17789-figurine-of-wondrous-power-onyx-dog",
    armorClass: 12, hp: 5, hitDice: "1d8 + 1", abilities: [13, 14, 12, 8, 12, 7], challenge: "1/8", proficiency: 2, initiative: 2,
    profile: p("Средний Зверь без мировоззрения. Скорость 40 фт.; спасбросок Мудрости +3, Восприятие +5, пассивное 15; Тёмное зрение 60 фт., Слепое зрение 60 фт. Говорит на Общем, понимает языки владельца.", "Medium unaligned Beast. Speed 40 ft.; Wisdom save +3, Perception +5, passive 15; Darkvision 60 ft., Blindsight 60 ft. Speaks Common, understands its owner’s languages."),
    rules: [p("Укус: рукопашная атака +3, досягаемость 5 фт.; 4 (1d6 + 1) колющего урона. Существо Среднего размера или меньше падает Ничком.", "Bite: melee attack +3, reach 5 ft.; 4 (1d6 + 1) Piercing damage. A Medium or smaller creature falls Prone.")]
  },
  {
    id: "berserker-2024", edition: "2024", name: p("Берсерк", "Berserker"),
    sourceUrl: `${srd52}#page=263`, armorClass: 13, hp: 67, hitDice: "9d8 + 27",
    abilities: [16, 12, 17, 9, 11, 9], challenge: "2", proficiency: 2, initiative: 1,
    profile: p("Средний или Маленький Гуманоид, нейтральный. Скорость 30 фт.; пассивное Восприятие 10. Общий язык. Снаряжение: секира, шкурный доспех.", "Medium or Small Humanoid, Neutral. Speed 30 ft.; passive Perception 10. Common. Gear: Greataxe, Hide Armor."),
    rules: [
      p("Кровавое неистовство: пока хиты не превышают половины максимума, Преимущество на броски атаки и спасброски.", "Bloodied Frenzy: Advantage on attack rolls and saving throws while at no more than half maximum HP."),
      p("Секира: рукопашная атака +5, досягаемость 5 фт.; 9 (1d12 + 3) рубящего урона.", "Greataxe: melee attack +5, reach 5 ft.; 9 (1d12 + 3) Slashing damage.")
    ]
  },
  {
    id:"lion-2024",edition:"2024",name:p("Лев","Lion"),sourceUrl:srd52+"#page=356",
    armorClass:12,hp:22,hitDice:"4d10",abilities:[17,15,11,3,12,8],challenge:"1",proficiency:2,initiative:2,
    profile:p("Большой зверь без мировоззрения. Скорость 50 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Восприятие +3, Скрытность +4. Языков нет.","Large unaligned Beast. Speed 50 ft.; Darkvision 60 ft., passive Perception 13. Perception +3, Stealth +4. No languages."),
    rules:[p("Тактика стаи: атаки по существу с преимуществом, если в 5 фт. от цели есть дееспособный союзник льва. Прыжок с разбега: после разбега 10 фт. прыжок в длину до 25 фт.","Pack Tactics: Advantage on attacks against a creature with an ally of the lion within 5 ft. that is not Incapacitated. Running Leap: a 10-ft. running start permits a Long Jump up to 25 ft."),p("Мультиатака: два Разрывания, одно можно заменить Рёвом. Разрывание: рукопашная атака +5, досягаемость 5 фт.; 7 (1d8 + 3) рубящего урона.","Multiattack: two Rends, one replaceable with Roar. Rend: melee attack +5, reach 5 ft.; 7 (1d8 + 3) Slashing damage."),p("Рёв: одно существо в 15 фт. делает спасбросок Мудрости Сл 11. При провале Испугано до начала следующего хода льва.","Roar: one creature within 15 ft. makes a DC 11 Wisdom save. Failure: Frightened until the start of the lion’s next turn.")],
  },
  {
    id:"brown-bear-2024",edition:"2024",name:p("Бурый медведь","Brown Bear"),sourceUrl:srd52+"#page=346",
    armorClass:11,hp:22,hitDice:"3d10 + 6",abilities:[17,12,15,2,13,7],challenge:"1",proficiency:2,initiative:1,
    profile:p("Большой зверь без мировоззрения. Скорость 40 фт., лазание 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Восприятие +3. Языков нет.","Large unaligned Beast. Speed 40 ft., Climb 30 ft.; Darkvision 60 ft., passive Perception 13. Perception +3. No languages."),
    rules:[p("Мультиатака: один Укус и одна атака Когтями. Укус: рукопашная атака +5, досягаемость 5 фт.; 7 (1d8 + 3) колющего урона. Когти: рукопашная атака +5, досягаемость 5 фт.; 5 (1d4 + 3) рубящего урона; цель Большого размера или меньше также Сбита с ног.","Multiattack: one Bite and one Claw. Bite: melee attack +5, reach 5 ft.; 7 (1d8 + 3) Piercing damage. Claw: melee attack +5, reach 5 ft.; 5 (1d4 + 3) Slashing damage; a Large or smaller creature is also Prone.")],
  },
  {
    id:"jackal-2024",edition:"2024",name:p("Шакал","Jackal"),sourceUrl:srd52+"#page=356",
    armorClass:12,hp:3,hitDice:"1d6",abilities:[8,15,11,3,12,6],challenge:"0",proficiency:2,initiative:2,
    profile:p("Маленький зверь без мировоззрения. Скорость 40 фт.; тёмное зрение 90 фт., пассивное Восприятие 15. Восприятие +5, Скрытность +4. Языков нет.","Small unaligned Beast. Speed 40 ft.; Darkvision 90 ft., passive Perception 15. Perception +5, Stealth +4. No languages."),
    rules:[p("Укус: рукопашная атака +1, досягаемость 5 фт.; 1 (1d4 − 1) колющего урона.","Bite: melee attack +1, reach 5 ft.; 1 (1d4 − 1) Piercing damage.")],
  },
  {
    id:"ape-2024",edition:"2024",name:p("Человекообразная обезьяна","Ape"),sourceUrl:srd52+"#page=344",
    armorClass:12,hp:19,hitDice:"3d8 + 6",abilities:[16,14,14,6,12,7],challenge:"1/2",proficiency:2,initiative:2,
    profile:p("Средний зверь без мировоззрения. Скорость и лазание 30 фт., пассивное Восприятие 13. Атлетика +5, Восприятие +3. Языков нет.","Medium unaligned Beast. Speed and Climb 30 ft., passive Perception 13. Athletics +5, Perception +3. No languages."),
    rules:[p("Мультиатака: два удара Кулаком. Кулак: рукопашная атака +5, досягаемость 5 фт.; 5 (1d4 + 3) дробящего урона. Камень (перезарядка 6): дальнобойная атака +5, дистанция 25/50 фт.; 10 (2d6 + 3) дробящего урона.","Multiattack: two Fists. Fist: melee attack +5, reach 5 ft.; 5 (1d4 + 3) Bludgeoning damage. Rock (Recharge 6): ranged attack +5, range 25/50 ft.; 10 (2d6 + 3) Bludgeoning damage.")],
  },
  {
    id:"baboon-2024",edition:"2024",name:p("Бабуин","Baboon"),sourceUrl:srd52+"#page=345",
    armorClass:12,hp:3,hitDice:"1d6",abilities:[8,14,11,4,12,6],challenge:"0",proficiency:2,initiative:2,
    profile:p("Маленький зверь без мировоззрения. Скорость и лазание 30 фт., пассивное Восприятие 11. Языков нет.","Small unaligned Beast. Speed and Climb 30 ft., passive Perception 11. No languages."),
    rules:[p("Тактика стаи: атаки по существу с преимуществом, если в 5 фт. от цели есть хотя бы один дееспособный союзник бабуина.","Pack Tactics: Advantage on attacks against a creature if an ally of the baboon is within 5 ft. of it and not Incapacitated."),p("Укус: рукопашная атака +1, досягаемость 5 фт.; 1 (1d4 − 1) колющего урона.","Bite: melee attack +1, reach 5 ft.; 1 (1d4 − 1) Piercing damage.")],
  },
  {
    id:"black-bear-2024",edition:"2024",name:p("Чёрный медведь","Black Bear"),sourceUrl:srd52+"#page=345",
    armorClass:11,hp:19,hitDice:"3d8 + 6",abilities:[15,12,14,2,12,7],challenge:"1/2",proficiency:2,initiative:1,
    profile:p("Средний зверь без мировоззрения. Скорость, лазание и плавание 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 15. Восприятие +5. Языков нет.","Medium unaligned Beast. Speed, Climb, and Swim 30 ft.; Darkvision 60 ft., passive Perception 15. Perception +5. No languages."),
    rules:[p("Мультиатака: два Разрывания. Разрывание: рукопашная атака +4, досягаемость 5 фт.; 5 (1d6 + 2) рубящего урона.","Multiattack: two Rends. Rend: melee attack +4, reach 5 ft.; 5 (1d6 + 2) Slashing damage.")],
  },
  {
    id:"giant-weasel-2024",edition:"2024",name:p("Гигантская куница","Giant Weasel"),sourceUrl:srd52+"#page=355",
    armorClass:13,hp:9,hitDice:"2d8",abilities:[11,17,10,4,12,5],challenge:"1/8",proficiency:2,initiative:3,
    profile:p("Средний зверь без мировоззрения. Скорость 40 фт., лазание 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Акробатика +5, Восприятие +3, Скрытность +5. Языков нет.","Medium unaligned Beast. Speed 40 ft., Climb 30 ft.; Darkvision 60 ft., passive Perception 13. Acrobatics +5, Perception +3, Stealth +5. No languages."),
    rules:[p("Укус: рукопашная атака +5, досягаемость 5 фт.; 5 (1d4 + 3) колющего урона.","Bite: melee attack +5, reach 5 ft.; 5 (1d4 + 3) Piercing damage.")],
  },
  {
    id:"giant-hyena-2024",edition:"2024",name:p("Гигантская гиена","Giant Hyena"),sourceUrl:srd52+"#page=352",
    armorClass:12,hp:45,hitDice:"6d10 + 12",abilities:[16,14,14,2,12,7],challenge:"1",proficiency:2,initiative:2,
    profile:p("Большой зверь без мировоззрения. Скорость 50 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Восприятие +3. Языков нет.","Large unaligned Beast. Speed 50 ft.; Darkvision 60 ft., passive Perception 13. Perception +3. No languages."),
    rules:[p("Укус: рукопашная атака +5, досягаемость 5 фт.; 10 (2d6 + 3) колющего урона.","Bite: melee attack +5, reach 5 ft.; 10 (2d6 + 3) Piercing damage."),p("Буйство (1/день), бонусное действие: сразу после нанесения урона существу, у которого уже было не больше половины максимума хитов, перемещается до половины Скорости и делает один Укус.","Rampage (1/Day), Bonus Action: immediately after damaging a creature that was already at no more than half maximum HP, move up to half Speed and make one Bite attack.")],
  },
  {
    id:"tiger-2024",edition:"2024",name:p("Тигр","Tiger"),sourceUrl:srd52+"#page=363",
    armorClass:13,hp:30,hitDice:"4d10 + 8",abilities:[17,16,14,3,12,8],challenge:"1",proficiency:2,initiative:3,
    profile:p("Большой зверь без мировоззрения. Скорость 40 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Восприятие +3, Скрытность +7. Языков нет.","Large unaligned Beast. Speed 40 ft.; Darkvision 60 ft., passive Perception 13. Perception +3, Stealth +7. No languages."),
    rules:[p("Разрывание: рукопашная атака +5, досягаемость 5 фт.; 10 (2d6 + 3) рубящего урона. Существо Большого размера или меньше также Сбито с ног.","Rend: melee attack +5, reach 5 ft.; 10 (2d6 + 3) Slashing damage. A Large or smaller creature is also Prone."),p("Ловкое бегство: бонусным действием Отход или Засада.","Nimble Escape: Disengage or Hide as a Bonus Action.")],
  },
  {
    id:"giant-elk-2024",edition:"2024",name:p("Гигантский лось","Giant Elk"),sourceUrl:"https://next.dnd.su/bestiary/21332-giant-elk",
    armorClass:14,hp:42,hitDice:"5d12 + 10",abilities:[19,18,14,7,14,10],challenge:"2",proficiency:2,initiative:6,
    profile:p("Огромный нейтрально-добрый небожитель. Скорость 60 фт.; тёмное зрение 90 фт., пассивное Восприятие 14. Восприятие +4, спасброски Силы и Ловкости +6. Сопротивление излучению и некротическому урону. Небесный; понимает Общий, Эльфийский и Сильван, но не говорит на них.","Huge Neutral Good Celestial. Speed 60 ft.; Darkvision 90 ft., passive Perception 14. Perception +4, Strength and Dexterity saves +6. Resistant to Radiant and Necrotic. Celestial; understands Common, Elvish, and Sylvan but cannot speak them."),
    rules:[p("Таран: рукопашная атака +6, досягаемость 10 фт.; 11 (2d6 + 4) дробящего и 5 (2d4) урона излучением. Если цель Огромного размера или меньше и лось прямо перед попаданием прошёл к ней по прямой минимум 20 фт., ещё 5 (2d4) дробящего урона и цель Сбита с ног.","Ram: melee attack +6, reach 10 ft.; 11 (2d6 + 4) Bludgeoning plus 5 (2d4) Radiant damage. Against a Huge or smaller creature, moving at least 20 ft. straight toward it immediately before the hit adds 5 (2d4) Bludgeoning damage and knocks it Prone.")],
  },
  {
    id:"axe-beak-2024",edition:"2024",name:p("Топороклюв","Axe Beak"),sourceUrl:"https://next.dnd.su/bestiary/21195-axe-beak",
    armorClass:11,hp:19,hitDice:"3d10 + 3",abilities:[14,12,12,2,10,5],challenge:"1/4",proficiency:2,initiative:1,
    profile:p("Большое чудовище без мировоззрения. Скорость 50 фт., пассивное Восприятие 10. Языков нет.","Large unaligned Monstrosity. Speed 50 ft., passive Perception 10. No languages."),
    rules:[p("Клюв: рукопашная атака +4, досягаемость 5 фт.; 6 (1d8 + 2) рубящего урона.","Beak: melee attack +4, reach 5 ft.; 6 (1d8 + 2) Slashing damage.")],
  },
  {
    id:"owl-2024",edition:"2024",name:p("Сова","Owl"),sourceUrl:srd52+"#page=358",
    armorClass:11,hp:1,hitDice:"1d4 − 1",abilities:[3,13,8,2,12,7],challenge:"0",proficiency:2,initiative:1,
    profile:p("Крошечный зверь без мировоззрения. Скорость 5 фт., полёт 60 фт.; тёмное зрение 120 фт., пассивное Восприятие 15. Восприятие и Скрытность +5. Языков нет.","Tiny unaligned Beast. Speed 5 ft., Fly 60 ft.; Darkvision 120 ft., passive Perception 15. Perception and Stealth +5. No languages."),
    rules:[p("Облёт: не провоцирует атаки при вылете из досягаемости врага.","Flyby: leaving an enemy’s reach while flying does not provoke Opportunity Attacks."),p("Когти: рукопашная атака +3, досягаемость 5 фт.; 1 рубящий урон.","Talons: melee attack +3, reach 5 ft.; 1 Slashing damage.")],
  },
  {
    id:"giant-goat-2024",edition:"2024",name:p("Гигантский козёл","Giant Goat"),sourceUrl:srd52+"#page=351",
    armorClass:11,hp:19,hitDice:"3d10 + 3",abilities:[17,13,12,3,12,6],challenge:"1/2",proficiency:2,initiative:1,
    profile:p("Большой зверь без мировоззрения. Скорость 40 фт., лазание 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Восприятие +3, спасброски Силы +5. Языков нет.","Large unaligned Beast. Speed 40 ft., Climb 30 ft.; Darkvision 60 ft., passive Perception 13. Perception +3, Strength saves +5. No languages."),
    rules:[p("Таран: рукопашная атака +5, досягаемость 5 фт.; 6 (1d6 + 3) дробящего урона. Если цель Большого размера или меньше и козёл прямо перед попаданием переместился к ней по прямой минимум 20 фт., ещё 5 (2d4) дробящего урона и цель Сбита с ног.","Ram: melee attack +5, reach 5 ft.; 6 (1d6 + 3) Bludgeoning damage. Against a Large or smaller creature, moving at least 20 ft. straight toward it immediately before the hit adds 5 (2d4) Bludgeoning damage and knocks it Prone.")],
  },
  {
    id:"giant-boar-2024",edition:"2024",name:p("Гигантский кабан","Giant Boar"),sourceUrl:srd52+"#page=349",
    armorClass:13,hp:42,hitDice:"5d10 + 15",abilities:[17,10,16,2,7,5],challenge:"2",proficiency:2,initiative:0,
    profile:p("Большой зверь без мировоззрения. Скорость 40 фт., пассивное Восприятие 8. Спасброски Силы +5. Языков нет.","Large unaligned Beast. Speed 40 ft., passive Perception 8. Strength saves +5. No languages."),
    rules:[p("Кровавая ярость: при половине максимума хитов или меньше броски рукопашной атаки с преимуществом.","Bloodied Fury: Advantage on melee attack rolls while at no more than half maximum HP."),p("Клыки: рукопашная атака +5, досягаемость 5 фт.; 10 (2d6 + 3) колющего урона. Если цель Большого размера или меньше и кабан прямо перед попаданием переместился к ней по прямой минимум 20 фт., ещё 7 (2d6) колющего урона и цель Сбита с ног.","Gore: melee attack +5, reach 5 ft.; 10 (2d6 + 3) Piercing damage. Against a Large or smaller creature, moving at least 20 ft. straight toward it immediately before the hit adds 7 (2d6) Piercing damage and knocks it Prone.")],
  },
  {
    id:"weasel-2024",edition:"2024",name:p("Куница","Weasel"),sourceUrl:srd52+"#page=364",
    armorClass:13,hp:1,hitDice:"1d4 − 1",abilities:[3,16,8,2,12,3],challenge:"0",proficiency:2,initiative:3,
    profile:p("Крошечный зверь без мировоззрения. Скорость и лазание 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Акробатика +5, Восприятие +3, Скрытность +5. Языков нет.","Tiny unaligned Beast. Speed and Climb 30 ft.; Darkvision 60 ft., passive Perception 13. Acrobatics +5, Perception +3, Stealth +5. No languages."),
    rules:[p("Укус: рукопашная атака +5, досягаемость 5 фт.; 1 колющий урон.","Bite: melee attack +5, reach 5 ft.; 1 Piercing damage.")],
  },
  {
    id:"badger-2024",edition:"2024",name:p("Барсук","Badger"),sourceUrl:srd52+"#page=345",
    armorClass:11,hp:5,hitDice:"1d4 + 3",abilities:[10,11,16,2,12,5],challenge:"0",proficiency:2,initiative:0,
    profile:p("Крошечный зверь без мировоззрения. Скорость 20 фт., копание 5 фт.; тёмное зрение 30 фт., пассивное Восприятие 13. Восприятие +3. Сопротивление яду. Языков нет.","Tiny unaligned Beast. Speed 20 ft., Burrow 5 ft.; Darkvision 30 ft., passive Perception 13. Perception +3. Resistant to Poison. No languages."),
    rules:[p("Укус: рукопашная атака +2, досягаемость 5 фт.; 1 колющий урон.","Bite: melee attack +2, reach 5 ft.; 1 Piercing damage.")],
  },
  {
    id:"boar-2024",edition:"2024",name:p("Кабан","Boar"),sourceUrl:srd52+"#page=346",
    armorClass:11,hp:13,hitDice:"2d8 + 4",abilities:[13,11,14,2,9,5],challenge:"1/4",proficiency:2,initiative:0,
    profile:p("Средний зверь без мировоззрения. Скорость 40 фт., пассивное Восприятие 9. Языков нет.","Medium unaligned Beast. Speed 40 ft., passive Perception 9. No languages."),
    rules:[p("Кровавая ярость: при половине максимума хитов или меньше броски атаки с преимуществом.","Bloodied Fury: Advantage on attack rolls while at no more than half maximum HP."),p("Клыки: рукопашная атака +3, досягаемость 5 фт.; 4 (1d6 + 1) колющего урона. Если цель Среднего размера или меньше и кабан прямо перед попаданием переместился к ней по прямой минимум на 20 фт., ещё 3 (1d6) колющего урона и цель Сбита с ног.","Gore: melee attack +3, reach 5 ft.; 4 (1d6 + 1) Piercing damage. If the target is Medium or smaller and the boar moved at least 20 ft. straight toward it immediately before the hit, add 3 (1d6) Piercing damage and knock it Prone.")],
  },
  {
    id:"panther-2024",edition:"2024",name:p("Пантера","Panther"),sourceUrl:srd52+"#page=358",
    armorClass:13,hp:13,hitDice:"3d8",abilities:[14,16,10,3,14,7],challenge:"1/4",proficiency:2,initiative:3,
    profile:p("Средний зверь без мировоззрения. Скорость 50 фт., лазание 40 фт.; тёмное зрение 60 фт., пассивное Восприятие 14. Восприятие +4, Скрытность +7. Языков нет.","Medium unaligned Beast. Speed 50 ft., Climb 40 ft.; Darkvision 60 ft., passive Perception 14. Perception +4, Stealth +7. No languages."),
    rules:[p("Разрывание: рукопашная атака +5, досягаемость 5 фт.; 6 (1d6 + 3) рубящего урона.","Rend: melee attack +5, reach 5 ft.; 6 (1d6 + 3) Slashing damage."),p("Ловкое бегство: бонусным действием Отход или Засада.","Nimble Escape: Disengage or Hide as a Bonus Action.")],
  },
  {
    id:"giant-badger-2024",edition:"2024",name:p("Гигантский барсук","Giant Badger"),sourceUrl:srd52+"#page=349",
    armorClass:13,hp:15,hitDice:"2d8 + 6",abilities:[13,10,17,2,12,5],challenge:"1/4",proficiency:2,initiative:0,
    profile:p("Средний зверь без мировоззрения. Скорость 30 фт., копание 10 фт.; тёмное зрение 60 фт., пассивное Восприятие 13. Восприятие +3. Сопротивление яду. Языков нет.","Medium unaligned Beast. Speed 30 ft., Burrow 10 ft.; Darkvision 60 ft., passive Perception 13. Perception +3. Resistant to Poison. No languages."),
    rules:[p("Укус: рукопашная атака +3, досягаемость 5 фт.; 6 (2d4 + 1) колющего урона.","Bite: melee attack +3, reach 5 ft.; 6 (2d4 + 1) Piercing damage.")],
  },
  {
    id:"dire-wolf-2024",edition:"2024",name:p("Лютый волк","Dire Wolf"),sourceUrl:srd52+"#page=347",
    armorClass:14,hp:22,hitDice:"3d10 + 6",abilities:[17,15,15,3,12,7],challenge:"1",proficiency:2,initiative:2,
    profile:p("Большой зверь без мировоззрения. Скорость 50 фт.; тёмное зрение 60 фт., пассивное Восприятие 15. Восприятие +5, Скрытность +4. Языков нет.","Large unaligned Beast. Speed 50 ft.; Darkvision 60 ft., passive Perception 15. Perception +5, Stealth +4. No languages."),
    rules:[p("Тактика стаи: атаки по существу с преимуществом, если в 5 фт. от цели есть хотя бы один союзник волка, который не Недееспособен.","Pack Tactics: Advantage on attacks against a creature while an ally of the wolf is within 5 ft. of it and not Incapacitated."),p("Укус: рукопашная атака +5, досягаемость 5 фт.; 8 (1d10 + 3) колющего урона. Цель Большого размера или меньше также Сбита с ног.","Bite: melee attack +5, reach 5 ft.; 8 (1d10 + 3) Piercing damage. A Large or smaller target is also Prone.")],
  },
  {
    id:"mastiff-2024",edition:"2024",name:p("Мастиф","Mastiff"),sourceUrl:srd52+"#page=357",
    armorClass:12,hp:5,hitDice:"1d8 + 1",abilities:[13,14,12,3,12,7],challenge:"1/8",proficiency:2,initiative:2,
    profile:p("Средний зверь без мировоззрения. Скорость 40 фт.; тёмное зрение 60 фт., пассивное Восприятие 15. Восприятие +5, спасброски Мудрости +3. Языков нет.","Medium unaligned Beast. Speed 40 ft.; Darkvision 60 ft., passive Perception 15. Perception +5, Wisdom saves +3. No languages."),
    rules:[p("Укус: рукопашная атака +3, досягаемость 5 фт.; 4 (1d6 + 1) колющего урона. Существо Среднего размера или меньше также Сбито с ног.","Bite: melee attack +3, reach 5 ft.; 4 (1d6 + 1) Piercing damage. A Medium or smaller creature is also Prone.")],
  },
  {
    id:"riding-horse-2024",edition:"2024",name:p("Верховая лошадь","Riding Horse"),sourceUrl:srd52+"#page=360",
    armorClass:11,hp:13,hitDice:"2d10 + 2",abilities:[16,13,12,2,11,7],challenge:"1/4",proficiency:2,initiative:1,
    profile:p("Большой зверь без мировоззрения. Скорость 60 фт., пассивное Восприятие 10. Языков нет.","Large unaligned Beast. Speed 60 ft., passive Perception 10. No languages."),
    rules:[p("Копыта: рукопашная атака +5, досягаемость 5 фт.; 7 (1d8 + 3) дробящего урона.","Hooves: melee attack +5, reach 5 ft.; 7 (1d8 + 3) Bludgeoning damage.")],
  },
  {
    id:"fire-elemental-2024",edition:"2024",name:p("Огненный элементаль","Fire Elemental"),sourceUrl:srd52+"#page=284",
    armorClass:13,hp:93,hitDice:"11d10 + 33",abilities:[10,17,16,6,10,7],challenge:"5",proficiency:3,initiative:3,
    profile:p("Большой нейтральный элементаль. Скорость 50 фт. Тёмное зрение 60 фт., пассивное Восприятие 10; Первичный (Игнан). Сопротивление дробящему, колющему и рубящему урону. Иммунитет к огню и яду, Истощению, Захвату, Параличу, Окаменению, Отравлению, Сбиванию с ног, Опутыванию и Бессознательности.","Large Neutral Elemental. Speed 50 ft. Darkvision 60 ft., passive Perception 10; Primordial (Ignan). Resistant to Bludgeoning, Piercing, Slashing. Immune to Fire, Poison; Exhaustion, Grappled, Paralyzed, Petrified, Poisoned, Prone, Restrained, Unconscious."),
    rules:[
      p("Огненная аура: в конце каждого хода элементаля каждое существо в его эманации 10 фт. получает 5 (1d10) урона огнём; существа и горючие предметы в ней загораются.","Fire Aura: at the end of each of its turns, every creature in its 10-ft. Emanation takes 5 (1d10) Fire damage; creatures and flammable objects there start burning."),
      p("Огненная форма: проходит щель 1 дюйм без дополнительных затрат; может войти в пространство существа и остаться там. При первом входе в пространство существа за ход наносит ему 5 (1d10) огненного урона.","Fire Form: passes through a 1-inch opening without extra movement cost and can enter and stop in a creature’s space. The first time it enters a creature’s space on a turn, that creature takes 5 (1d10) Fire damage."),
      p("Свет: яркий 30 фт., ещё 30 фт. тусклый. Чувствительность к воде: за каждые 5 фт. движения в воде либо каждый вылитый на него галлон воды получает 3 (1d6) урона холодом.","Illumination: Bright Light 30 ft., Dim Light another 30 ft. Water Susceptibility: takes 3 (1d6) Cold damage per 5 ft. moved in water or per gallon splashed onto it."),
      p("Мультиатака: два ожога. Ожог: рукопашная атака +6, досягаемость 5 фт.; 10 (2d6 + 3) огненного урона; существо или горючий предмет загорается.","Multiattack: two Burns. Burn: melee attack +6, reach 5 ft.; 10 (2d6 + 3) Fire damage; a creature or flammable object starts burning."),
      p("Горение: 1d4 урона огнём в начале каждого хода горящего. Действием можно упасть Ничком и перекатиться, туша себя. Обливание, погружение или перекрытие доступа воздуха также тушит огонь.","Burning: 1d4 Fire damage at the start of each of the burning target’s turns. An action to drop Prone and roll extinguishes yourself. Dousing, submerging, or smothering also extinguishes the fire."),
    ],
  },
  {
    id:"water-elemental-2024",edition:"2024",name:p("Водяной элементаль","Water Elemental"),sourceUrl:srd52+"#page=337",
    armorClass:14,hp:114,hitDice:"12d10 + 48",abilities:[18,14,18,5,10,8],challenge:"5",proficiency:3,initiative:2,
    profile:p("Большой нейтральный элементаль. Скорость 30 фт., плавание 90 фт. Тёмное зрение 60 фт., пассивное Восприятие 10; Первичный (Акван). Сопротивление кислоте и огню. Иммунитет к яду, Истощению, Захвату, Параличу, Окаменению, Отравлению, Сбиванию с ног, Опутыванию и Бессознательности.","Large Neutral Elemental. Speed 30 ft., Swim 90 ft. Darkvision 60 ft., passive Perception 10; Primordial (Aquan). Resistant to Acid and Fire. Immune to Poison; Exhaustion, Grappled, Paralyzed, Petrified, Poisoned, Prone, Restrained, Unconscious."),
    rules:[
      p("Замерзание: полученный урон холодом уменьшает Скорость на 20 фт. до конца следующего хода. Водная форма: входит в пространство врага и остаётся там, проходит щель 1 дюйм без дополнительных затрат перемещения.","Freeze: taking Cold damage reduces Speed by 20 ft. until the end of its next turn. Water Form: enters and stops in an enemy’s space and passes through a 1-inch opening without extra movement cost."),
      p("Мультиатака: два удара. Удар: рукопашная атака +7, досягаемость 5 фт.; 13 (2d8 + 4) дробящего урона. Существо Среднего размера или меньше также Сбито с ног.","Multiattack: two Slams. Slam: melee attack +7, reach 5 ft.; 13 (2d8 + 4) Bludgeoning damage. A Medium or smaller creature is also Prone."),
      p("Захлёстывание (перезарядка 4–6): каждое существо в пространстве элементаля делает спасбросок Силы Сл 15. Провал: 22 (4d8 + 4) дробящего урона; существо Большого размера или меньше также Захвачено (Сл освобождения 14). Успех: только половина урона. Вместимость — одно Большое или до двух существ Среднего размера и меньше. Захваченный Опутан, задыхается, если не дышит водой, и получает 9 (2d8) дробящего урона в начале каждого хода элементаля. Существо в 5 фт. от элементаля может действием вытянуть цель при успешной проверке Силы (Атлетика) Сл 14.","Whelm (Recharge 4–6): every creature in its space makes a DC 15 Strength save. Failure: 22 (4d8 + 4) Bludgeoning damage, and a Large or smaller creature is Grappled (escape DC 14). Success: half damage only. Capacity: one Large or up to two Medium or smaller creatures. While Grappled the target is Restrained, suffocates unless it breathes water, and takes 9 (2d8) Bludgeoning damage at the start of each elemental turn. A creature within 5 ft. can use an action and a successful DC 14 Strength (Athletics) check to pull a target free."),
      p("Удушье: 1 уровень Истощения в конце каждого своего хода; все уровни Истощения от удушья исчезают, когда существо снова может дышать.","Suffocation: gain 1 Exhaustion level at the end of each of your turns; all levels caused by suffocation end once you can breathe again."),
    ],
  },
  {
    id:"air-elemental-2024",edition:"2024",name:p("Воздушный элементаль","Air Elemental"),sourceUrl:srd52+"#page=258",
    armorClass:15,hp:90,hitDice:"12d10 + 24",abilities:[14,20,14,6,10,6],challenge:"5",proficiency:3,initiative:5,
    profile:p("Большой нейтральный элементаль. Скорость 10 фт., полёт 90 фт. (парение). Тёмное зрение 60 фт., пассивное Восприятие 10; Первичный (Ауран). Сопротивление дробящему, электрическому, колющему и рубящему урону. Иммунитет к яду и звуку, Истощению, Захвату, Параличу, Окаменению, Отравлению, Сбиванию с ног, Опутыванию и Бессознательности.","Large Neutral Elemental. Speed 10 ft., Fly 90 ft. (hover). Darkvision 60 ft., passive Perception 10; Primordial (Auran). Resistant to Bludgeoning, Lightning, Piercing, Slashing. Immune to Poison, Thunder; Exhaustion, Grappled, Paralyzed, Petrified, Poisoned, Prone, Restrained, Unconscious."),
    rules:[
      p("Воздушная форма: может войти в пространство существа и остаться там; проходит щель шириной 1 дюйм без дополнительных затрат перемещения.","Air Form: can enter and stop in a creature’s space; passes through a 1-inch opening without extra movement cost."),
      p("Мультиатака: два громовых удара. Громовой удар: рукопашная атака +8, досягаемость 10 фт.; 14 (2d8 + 5) урона звуком.","Multiattack: two Thunderous Slams. Thunderous Slam: melee attack +8, reach 10 ft.; 14 (2d8 + 5) Thunder damage."),
      p("Вихрь (перезарядка 4–6): одно существо Среднего размера или меньше в пространстве элементаля делает спасбросок Силы Сл 13. Провал: 24 (4d10 + 2) урона звуком, отталкивание прямо от элементаля до 20 фт. и состояние Сбитый с ног. Успех: только половина урона.","Whirlwind (Recharge 4–6): one Medium or smaller creature in its space makes a DC 13 Strength save. Failure: 24 (4d10 + 2) Thunder damage, pushed up to 20 ft. straight away, and Prone. Success: half damage only."),
    ],
  },
  {
    id:"earth-elemental-2024",edition:"2024",name:p("Земляной элементаль","Earth Elemental"),sourceUrl:srd52+"#page=282",
    armorClass:17,hp:147,hitDice:"14d10 + 70",abilities:[20,8,20,5,10,5],challenge:"5",proficiency:3,initiative:-1,
    profile:p("Большой нейтральный элементаль. Скорость и копание 30 фт. Тёмное зрение и чувство вибрации 60 фт., пассивное Восприятие 10; Первичный (Терран). Уязвимость к звуку. Иммунитет к урону ядом, Истощению, Параличу, Окаменению, Отравлению и Бессознательности.","Large Neutral Elemental. Speed and Burrow 30 ft. Darkvision and Tremorsense 60 ft., passive Perception 10; Primordial (Terran). Vulnerable to Thunder. Immune to Poison damage, Exhaustion, Paralyzed, Petrified, Poisoned, Unconscious."),
    rules:[
      p("Земляное скольжение: копает сквозь немагическую необработанную землю и камень, не нарушая материал. Осадное чудовище: двойной урон предметам и сооружениям.","Earth Glide: burrows through nonmagical unworked earth and stone without disturbing it. Siege Monster: double damage to objects and structures."),
      p("Мультиатака: два удара или броска камня в любом сочетании. Удар: рукопашная атака +8, досягаемость 10 фт.; 14 (2d8 + 5) дробящего урона.","Multiattack: two attacks, Slam or Rock Launch in any combination. Slam: melee attack +8, reach 10 ft.; 14 (2d8 + 5) Bludgeoning damage."),
      p("Бросок камня: дальнобойная атака +8, дистанция 60 фт.; 8 (1d6 + 5) дробящего урона. Существо Большого размера или меньше также Сбито с ног.","Rock Launch: ranged attack +8, range 60 ft.; 8 (1d6 + 5) Bludgeoning damage. A Large or smaller creature is also Prone."),
    ],
  },
  {
    id: "aberrant-spirit-2024",
    edition: "2024",
    name: p("Дух аберрации", "Aberration Spirit"),
    sourceUrl: "https://next.dnd.su/bestiary/23385-aberration-spirit",
    armorClass: 15,
    armorClassFormula: p("11 + круг заклинания", "11 + spell level"),
    hp: 40,
    hpFormula: p(
      "40 + 10 за каждый круг выше 4",
      "40 + 10 per spell level above 4",
    ),
    hitDice: "—",
    abilities: [16, 10, 15, 16, 10, 6],
    challenge: "—",
    proficiency: 2,
    proficiencyFormula: p("ваш БМ", "your PB"),
    initiative: 0,
    profile: p(
      "Средняя аберрация, нейтральная. Ходьба 30 фт.; созерцатель также летает 30 фт. с парением. Иммунитет к психическому урону. Тёмное зрение 60 фт., пассивное Восприятие 10. Глубинная речь; понимает ваши языки.",
      "Medium Aberration, Neutral. Speed 30 ft.; Beholderkin also has Fly 30 ft. (hover). Immune to Psychic damage. Darkvision 60 ft.; Passive Perception 10. Deep Speech; understands your languages.",
    ),
    rules: [
      p(
        "Слаад: в начале хода восстанавливает 5 хитов, если имеет хотя бы 1 хит.",
        "Slaad: at the start of its turn, regains 5 HP if it has at least 1 HP.",
      ),
      p(
        "Свежеватель разума: в начале хода, если не недееспособен, каждое существо в 5 фт., кроме заклинателя, делает спасбросок Мудрости против вашей Сл; провал — 2d6 психического урона.",
        "Mind Flayer: at the start of its turn, unless Incapacitated, each creature within 5 feet except you makes a Wisdom save against your spell DC; failure deals 2d6 Psychic damage.",
      ),
      p(
        "Мультиатака: половина круга заклинания атак, вниз. Все атаки — с вашим бонусом атаки заклинанием, одна цель. Слаад: Коготь, рукопашная, 5 фт.; 1d8 + 3 + круг рубящего урона и запрет восстановления хитов до начала следующего хода духа. Созерцатель: Луч, дальнобойная, 150 фт.; 1d8 + 3 + круг психического урона. Свежеватель: Психическое сокрушение, рукопашная, 5 фт.; тот же психический урон.",
        "Multiattack: half the spell level in attacks, rounded down. All use your spell attack modifier and target one creature. Slaad Claw: melee, reach 5 ft.; 1d8 + 3 + spell level Slashing damage, and the target cannot regain HP until the spirit’s next turn starts. Beholderkin Eye Ray: ranged, 150 ft.; 1d8 + 3 + spell level Psychic damage. Mind Flayer Psychic Slam: melee, reach 5 ft.; the same Psychic damage.",
      ),
    ],
  },
  {
    id: "construct-spirit-2024",
    edition: "2024",
    name: p("Дух конструкта", "Construct Spirit"),
    sourceUrl: "https://next.dnd.su/bestiary/23384-construct-spirit",
    armorClass: 17,
    armorClassFormula: p("13 + круг заклинания", "13 + spell level"),
    hp: 40,
    hpFormula: p(
      "40 + 15 за каждый круг выше 4",
      "40 + 15 per spell level above 4",
    ),
    hitDice: "—",
    abilities: [18, 10, 18, 14, 11, 5],
    challenge: "—",
    proficiency: 2,
    proficiencyFormula: p("ваш БМ", "your PB"),
    initiative: 0,
    profile: p(
      "Средний конструкт, нейтральный. Ходьба 30 фт., сопротивление яду. Иммунитет к очарованию, истощению, испугу, параличу, отравлению. Тёмное зрение 60 фт., пассивное Восприятие 10; понимает ваши языки.",
      "Medium Construct, Neutral. Speed 30 ft.; Resistance to Poison damage. Immune to Charmed, Exhaustion, Frightened, Paralyzed, and Poisoned. Darkvision 60 ft.; Passive Perception 10; understands your languages.",
    ),
    rules: [
      p(
        "Металл: попавшее по духу рукопашной атакой существо, а также существо, начинающее ход захваченным духом либо удерживая его в захвате, получает 1d10 огненного урона.",
        "Metal: a creature hitting the spirit with a melee attack or starting its turn Grappled by or grappling the spirit takes 1d10 Fire damage.",
      ),
      p(
        "Камень: когда видимая цель начинает ход в 10 фт., дух может потребовать спасбросок Мудрости против вашей Сл. Провал: скорость вдвое меньше и нет провоцированных атак до начала следующего хода цели; прочие реакции остаются доступны.",
        "Stone: when a visible creature starts its turn within 10 feet, the spirit may require a Wisdom save against your spell DC. Failure halves Speed and prevents Opportunity Attacks until its next turn starts; other Reactions remain available.",
      ),
      p(
        "Мультиатака: половина круга заклинания Ударов, вниз. Размашистый удар — рукопашная атака, ваш бонус атаки заклинанием, 5 фт., одна цель; попадание 1d8 + 4 + круг заклинания дробящего урона.",
        "Multiattack: make half the spell level in Slam attacks, rounded down. Slam: melee attack using your spell attack modifier, reach 5 ft., one target; hit: 1d8 + 4 + spell level Bludgeoning damage.",
      ),
      p(
        "Глина, реакция на урон от существа: Удар по этому существу, если возможен; иначе движение к нему до половины скорости без провоцирования атак.",
        "Clay, Reaction when damaged by a creature: Slam that creature if possible; otherwise move up to half Speed toward it without provoking Opportunity Attacks.",
      ),
    ],
  },
  {
    id: "hound-of-ill-omen-2014",
    edition: "2014",
    name: p("Гончая дурного знамения", "Hound of Ill Omen"),
    sourceUrl: "https://dnd.su/class/101-sorcerer/#origin.shadow",
    armorClass: 14,
    hp: 37,
    hitDice: "5d10 + 10",
    abilities: [17, 15, 15, 3, 12, 7],
    challenge: "1 (основа / base)",
    proficiency: 2,
    initiative: 2,
    profile: p(
      "Средний монстр, без мировоззрения; основа — лютый волк. Скорость 50 фт.; Восприятие +3, Скрытность +4, пассивное Восприятие 13. При появлении получает временные хиты в половину уровня чародея, вниз.",
      "Medium Monstrosity, Unaligned; based on a Dire Wolf. Speed 50 ft.; Perception +3, Stealth +4, Passive Perception 13. Appears with Temporary HP equal to half your Sorcerer level, rounded down.",
    ),
    rules: [
      p(
        "Преимущество Восприятию на слух и запах; преимущество атакам по существу с не недееспособным союзником гончей в 5 фт. от него.",
        "Advantage on Perception relying on hearing or smell; Advantage on attacks against a creature with a non-Incapacitated ally of the hound within 5 feet of it.",
      ),
      p(
        "Укус: рукопашное оружие, +5 к попаданию, 5 фт., одна цель; 2d6 + 3 колющего урона. Существо при провале спасброска Силы Сл 13 опрокинуто.",
        "Bite: melee weapon attack, +5 to hit, reach 5 ft., one target; 2d6 + 3 Piercing damage. A creature hit makes a DC 13 Strength save or falls Prone.",
      ),
      p(
        "Отдельная инициатива. В начале хода автоматически узнаёт положение назначенной цели; та больше не спрятана от гончей. Движется только кратчайшим путём к цели; действие — только атака цели; провоцированные атаки — также только по ней. В 5 фт. от гончей цель спасается от ваших заклинаний с помехой.",
        "Roll its Initiative separately. At the start of its turn it automatically learns its designated target’s location; that target is no longer hidden from it. It moves only toward that target by the most direct route and uses its action only to attack that target. Opportunity Attacks are also limited to the target. Within 5 feet of the hound, the target has Disadvantage on saves against your spells.",
      ),
      p(
        "Проходит через существ и предметы как трудную местность. Завершив ход внутри предмета, получает 5 силового урона. Исчезает через 5 минут либо при 0 хитов у себя или цели.",
        "Moves through creatures and objects as Difficult Terrain. Ending its turn inside an object deals it 5 Force damage. It disappears after 5 minutes or when it or its target drops to 0 HP.",
      ),
    ],
  },
  {
    id: "aberrant-spirit-2014",
    edition: "2014",
    name: p("Дух аберрации", "Aberrant Spirit"),
    sourceUrl: "https://dnd.su/bestiary/3105-aberrant_spirit/",
    armorClass: 15,
    armorClassFormula: p("11 + круг ячейки", "11 + slot level"),
    hp: 40,
    hpFormula: p(
      "40 + 10 за каждый круг выше 4",
      "40 + 10 per slot level above 4",
    ),
    hitDice: "—",
    abilities: [16, 10, 15, 16, 10, 6],
    challenge: "—",
    proficiency: 2,
    proficiencyFormula: p("ваш БМ", "your PB"),
    profile: p(
      "Средняя аберрация, без мировоззрения. Ходьба 30 фт.; бехолдер также летает 30 фт. с парением. Иммунитет к психическому урону. Тёмное зрение 60 фт., пассивное Восприятие 10. Глубинная речь; понимает ваши языки.",
      "Medium Aberration, Unaligned. Speed 30 ft.; Beholderkin also has Fly 30 ft. (hover). Immune to Psychic damage. Darkvision 60 ft.; Passive Perception 10. Deep Speech; understands your languages.",
    ),
    rules: [
      p(
        "Слаад: восстанавливает 5 хитов в начале хода, если имеет хотя бы 1 хит.",
        "Slaad: regains 5 HP at the start of its turn if it has at least 1 HP.",
      ),
      p(
        "Звёздное порождение: в начале хода, если не недееспособно, каждое существо в 5 фт. делает спасбросок Мудрости против вашей Сл; провал — 2d6 психического урона.",
        "Star Spawn: at the start of its turn, unless Incapacitated, each creature within 5 feet makes a Wisdom save against your spell DC; failure deals 2d6 Psychic damage.",
      ),
      p(
        "Мультиатака: число атак равно половине круга ячейки, вниз. Все атаки используют ваш бонус атаки заклинанием. Когти слаада: рукопашное оружие, 5 фт., одна цель; 1d10 + 3 + круг ячейки рубящего урона; существо не восстанавливает хиты до начала следующего хода духа. Луч бехолдера: дальнобойная атака заклинанием, 150 фт., одно существо; 1d8 + 3 + круг ячейки психического урона. Психический удар звёздного порождения: рукопашная атака заклинанием, 5 фт., одно существо; тот же психический урон.",
        "Multiattack: make half the slot level in attacks, rounded down. All use your spell attack modifier. Slaad Claws: melee weapon, reach 5 ft., one target; 1d10 + 3 + slot level Slashing damage, and a creature hit cannot regain HP until the spirit’s next turn starts. Beholderkin Eye Ray: ranged spell attack, range 150 ft., one creature; 1d8 + 3 + slot level Psychic damage. Star Spawn Psychic Slam: melee spell attack, reach 5 ft., one creature; the same Psychic damage.",
      ),
    ],
  },
  {
    id: "construct-spirit-2014",
    edition: "2014",
    name: p("Дух конструкта", "Construct Spirit"),
    sourceUrl: "https://dnd.su/bestiary/3142-construct_spirit/",
    armorClass: 17,
    armorClassFormula: p("13 + круг ячейки", "13 + slot level"),
    hp: 40,
    hpFormula: p(
      "40 + 15 за каждый круг выше 4",
      "40 + 15 per slot level above 4",
    ),
    hitDice: "—",
    abilities: [18, 10, 18, 14, 11, 5],
    challenge: "—",
    proficiency: 2,
    proficiencyFormula: p("ваш БМ", "your PB"),
    profile: p(
      "Средний конструкт, без мировоззрения. Ходьба 30 фт.; сопротивление яду; иммунитет к очарованию, истощению, испугу, недееспособности, параличу, окаменению, отравлению. Тёмное зрение 60 фт., пассивное Восприятие 10; понимает ваши языки.",
      "Medium Construct, Unaligned. Speed 30 ft.; Resistance to Poison damage; immune to Charmed, Exhaustion, Frightened, Incapacitated, Paralyzed, Petrified, and Poisoned. Darkvision 60 ft.; Passive Perception 10; understands your languages.",
    ),
    rules: [
      p(
        "Металл: касающееся духа существо или попавшее по нему рукопашной атакой с расстояния до 5 фт. получает 1d10 огненного урона.",
        "Metal: a creature touching the spirit or hitting it with a melee attack from within 5 feet takes 1d10 Fire damage.",
      ),
      p(
        "Камень: когда видимое существо начинает ход в 10 фт., дух может потребовать спасбросок Мудрости против вашей Сл; провал запрещает реакции и вдвое уменьшает скорость до начала следующего хода цели.",
        "Stone: when a visible creature starts its turn within 10 feet, the spirit may require a Wisdom save against your spell DC; failure prevents Reactions and halves Speed until that creature’s next turn starts.",
      ),
      p(
        "Мультиатака: половина круга ячейки атак, вниз. Размашистый удар — рукопашное оружие, ваш бонус атаки заклинанием, 5 фт., одна цель; попадание 1d8 + 4 + круг ячейки дробящего урона.",
        "Multiattack: half the slot level in attacks, rounded down. Slam: melee weapon attack using your spell attack modifier, reach 5 ft., one target; hit: 1d8 + 4 + slot level Bludgeoning damage.",
      ),
      p(
        "Глина, реакция на получение урона: Удар по случайному существу в 5 фт. Если никого нет, движение до половины скорости к видимому врагу без провоцирования атак.",
        "Clay, Reaction when damaged: Slam a random creature within 5 feet. If none is in reach, move up to half Speed toward a visible enemy without provoking Opportunity Attacks.",
      ),
    ],
  },
  {
    id: "bestial-spirit-2024",
    edition: "2024",
    name: p("Дух зверя", "Bestial Spirit"),
    sourceUrl: "https://next.dnd.su/bestiary/20934-bestial-spirit/",
    armorClass: 13,
    armorClassFormula: p("11 + круг заклинания", "11 + spell level"),
    hp: 20,
    hpFormula: p(
      "Воздух: 20; Земля/Вода: 30; +5 за каждый круг выше 2",
      "Air: 20; Land/Water: 30; +5 per spell level above 2",
    ),
    hitDice: "—",
    abilities: [18, 11, 16, 4, 14, 5],
    challenge: "—",
    proficiency: 2,
    proficiencyFormula: p("ваш БМ", "your PB"),
    initiative: 0,
    profile: p(
      "Маленький зверь, нейтральный. Ходьба 30 фт.; Воздух: полёт 60; Земля: лазание 30; Вода: плавание 30. Тёмное зрение 60 фт., пассивное Восприятие 12. Понимает ваши языки. Спасброски равны модификаторам характеристик.",
      "Small Beast, Neutral. Speed 30 ft.; Air: Fly 60; Land: Climb 30; Water: Swim 30. Darkvision 60 ft.; Passive Perception 12. Understands your languages. Saving throws use its ability modifiers.",
    ),
    rules: [
      p(
        "Воздух: вылетая из досягаемости врага, не провоцирует атак.",
        "Air: leaving an enemy’s reach by flying does not provoke Opportunity Attacks.",
      ),
      p(
        "Земля/Вода: преимущество атакам по цели, рядом с которой в 5 фт. есть не недееспособный союзник духа.",
        "Land/Water: Advantage on attacks against a creature with a non-Incapacitated ally of the spirit within 5 feet of it.",
      ),
      p("Вода: дышит только под водой.", "Water: can breathe only underwater."),
      p(
        "Мультиатака: число атак Раздиранием равно половине круга заклинания, вниз. Раздирание — рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт., одна цель; попадание: 1d8 + 4 + круг заклинания колющего урона.",
        "Multiattack: make a number of Rend attacks equal to half the spell level, rounded down. Rend is a melee attack using your spell attack modifier, reach 5 ft., one target; hit: 1d8 + 4 + spell level Piercing damage.",
      ),
    ],
  },
  modron(
    "monodrone",
    "Монодрон",
    "Monodrone",
    "2014",
    15,
    5,
    "1d8+1",
    [10, 13, 12, 4, 10, 5],
    "1/8",
    p(
      "Средний. Ходьба 30 фт., полёт 30 фт. Конструкт, законно-нейтральный. Истинное зрение 120 фт.; пассивное Восприятие 10; Модронский.",
      "Medium Construct, Lawful Neutral. Walk 30 ft., fly 30 ft.; Truesight 120 ft.; passive Perception 10; Modron.",
    ),
    [
      p(
        "Кинжал: рукопашная атака +3, 5 фт., одна цель; 3 (1d4+1) колющего. Метательное копьё: рукопашная/дальнобойная атака +2, 5 фт. или 30/120 фт., одна цель; 3 (1d6) колющего.",
        "Dagger: melee +3, reach 5 ft., one target; 3 (1d4+1) Piercing. Javelin: melee/ranged +2, reach 5 ft. or range 30/120 ft., one target; 3 (1d6) Piercing.",
      ),
    ],
    "238-monodrone",
  ),
  modron(
    "duodrone",
    "Дуодрон",
    "Duodrone",
    "2014",
    15,
    11,
    "2d8+2",
    [11, 13, 12, 6, 10, 7],
    "1/4",
    oldModronProfile(30),
    [
      p(
        "Средний. Мультиатака: два кулака или два метательных копья. Кулак: рукопашная +2, 5 фт., одна цель; 2 (1d4) дробящего. Копьё: рукопашная/дальнобойная +3, 5 фт. или 30/120 фт.; 4 (1d6+1) колющего.",
        "Medium. Multiattack: two fists or two javelins. Fist: melee +2, reach 5 ft., one target; 2 (1d4) Bludgeoning. Javelin: melee/ranged +3, reach 5 ft. or range 30/120 ft.; 4 (1d6+1) Piercing.",
      ),
    ],
    "239-duodrone",
  ),
  modron(
    "tridrone",
    "Тридрон",
    "Tridrone",
    "2014",
    15,
    16,
    "3d8+3",
    [12, 13, 12, 9, 10, 9],
    "1/2",
    oldModronProfile(30),
    [
      p(
        "Средний. Мультиатака: три кулака или три метательных копья. Кулак: рукопашная +3, 5 фт.; 3 (1d4+1) дробящего. Копьё: рукопашная/дальнобойная +3, 5 фт. или 30/120 фт.; 4 (1d6+1) колющего. Каждая атака по одной цели.",
        "Medium. Multiattack: three fists or three javelins. Fist: melee +3, reach 5 ft.; 3 (1d4+1) Bludgeoning. Javelin: melee/ranged +3, reach 5 ft. or range 30/120 ft.; 4 (1d6+1) Piercing. Each attack has one target.",
      ),
    ],
    "240-tridrone",
  ),
  modron(
    "quadrone",
    "Квадрон",
    "Quadrone",
    "2014",
    16,
    22,
    "4d8+4",
    [12, 14, 12, 10, 10, 11],
    "1",
    p(
      "Средний конструкт, законно-нейтральный. Ходьба 30 фт., полёт 30 фт.; Восприятие +2, пассивное 12; истинное зрение 120 фт.; Модронский.",
      "Medium Construct, Lawful Neutral. Walk 30 ft., fly 30 ft.; Perception +2, passive 12; Truesight 120 ft.; Modron.",
    ),
    [
      p(
        "Мультиатака: два кулака или четыре выстрела коротким луком. Кулак: рукопашная +3, 5 фт.; 3 (1d4+1) дробящего. Лук: дальнобойная +4, 80/320 фт.; 5 (1d6+2) колющего. Одна цель на атаку.",
        "Multiattack: two fists or four shortbow shots. Fist: melee +3, reach 5 ft.; 3 (1d4+1) Bludgeoning. Shortbow: ranged +4, range 80/320 ft.; 5 (1d6+2) Piercing. One target per attack.",
      ),
    ],
    "241-quadrone",
  ),
  modron(
    "pentadrone",
    "Пентадрон",
    "Pentadrone",
    "2014",
    16,
    32,
    "5d10+5",
    [15, 14, 12, 10, 10, 13],
    "2",
    p(
      "Большой конструкт, законно-нейтральный. Ходьба 40 фт.; Восприятие +4, пассивное 14; истинное зрение 120 фт.; Модронский.",
      "Large Construct, Lawful Neutral. Walk 40 ft.; Perception +4, passive 14; Truesight 120 ft.; Modron.",
    ),
    [
      p(
        "Мультиатака: пять атак рукой. Рука: рукопашная +4, 5 фт., одна цель; 5 (1d6+2) дробящего.",
        "Multiattack: five arm attacks. Arm: melee +4, reach 5 ft., one target; 5 (1d6+2) Bludgeoning.",
      ),
      p(
        "Парализующий газ (перезарядка 5–6): конус 30 фт., спасбросок Телосложения Сл 11; провал парализует на 1 минуту. В конце каждого своего хода цель повторяет спасбросок, успех прекращает эффект.",
        "Paralysis Gas (Recharge 5–6): 30-foot cone, DC 11 Constitution save; failure causes Paralysis for 1 minute. Repeat the save at the end of each turn, ending the effect on success.",
      ),
    ],
    "242-pentadrone",
  ),
  modron(
    "monodrone",
    "Монодрон",
    "Monodrone",
    "2024",
    15,
    5,
    "1d8+1",
    [10, 14, 12, 4, 10, 5],
    "1/8",
    p(
      "Средний конструкт, принципиально-нейтральный. Ходьба и полёт 30 фт.; иммунитет к очарованию; истинное зрение 120 фт.; пассивное Восприятие 10; Модронский.",
      "Medium Construct, Lawful Neutral. Walk and fly 30 ft.; immune to Charmed; Truesight 120 ft.; passive Perception 10; Modron.",
    ),
    [
      p(
        "Шестерня: рукопашная атака +4, 5 фт.; 6 (1d8+2) силового. Метатель шестерней: дальнобойная атака +4, 120 фт.; 6 (1d8+2) силового.",
        "Gear: melee +4, reach 5 ft.; 6 (1d8+2) Force. Gear Launcher: ranged +4, range 120 ft.; 6 (1d8+2) Force.",
      ),
    ],
    "21457-modron-monodrone",
    2,
  ),
  modron(
    "duodrone",
    "Дуодрон",
    "Duodrone",
    "2024",
    15,
    11,
    "2d8+2",
    [11, 13, 12, 6, 10, 7],
    "1/4",
    p(
      "Средний конструкт, принципиально-нейтральный. Ходьба 30 фт.; иммунитет к очарованию; истинное зрение 120 фт.; пассивное Восприятие 10; Модронский.",
      "Medium Construct, Lawful Neutral. Walk 30 ft.; immune to Charmed; Truesight 120 ft.; passive Perception 10; Modron.",
    ),
    [
      p(
        "Мультиатака: два Заводных клинка. Клинок: рукопашная/дальнобойная атака +3, 5 фт. или 30 фт.; 4 (1d6+1) силового. После дальнобойной атаки возвращается в руку при любом результате.",
        "Multiattack: two Clockwork Blades. Blade: melee/ranged +3, reach 5 ft. or range 30 ft.; 4 (1d6+1) Force. After a ranged attack the blade returns to the hand, hit or miss.",
      ),
    ],
    "21456-modron-duodrone",
    1,
  ),
  {
    id: "sheep-2014",
    edition: "2014",
    name: p("Овца", "Sheep"),
    sourceUrl: "https://dnd.su/bestiary/7740-sheep/",
    armorClass: 10,
    hp: 3,
    hitDice: "1d6",
    abilities: [12, 10, 11, 2, 10, 5],
    challenge: "0",
    proficiency: 2,
    profile: p(
      "Маленький зверь, без мировоззрения. Скорость 30 фт.; пассивное Восприятие 10.",
      "Small Beast, Unaligned. Speed 30 ft.; passive Perception 10.",
    ),
    rules: [
      p(
        "Преимущество спасброскам Силы и Ловкости против опрокидывания. Блок овцы не содержит специальных атак.",
        "Advantage on Strength and Dexterity saves against being knocked Prone. The sheep stat block has no special attacks.",
      ),
    ],
  },
  {
    id: "goat-2024",
    edition: "2024",
    name: p("Козёл", "Goat"),
    sourceUrl: "https://next.dnd.su/bestiary/21365-goat/",
    armorClass: 10,
    hp: 4,
    hitDice: "1d8",
    abilities: [11, 10, 11, 2, 10, 5],
    challenge: "0",
    proficiency: 2,
    initiative: 0,
    profile: p(
      "Средний зверь, без мировоззрения. Ходьба 40 фт., лазание 30 фт.; спасбросок Силы +2; Восприятие +2, пассивное 12; тёмное зрение 60 фт.; языков нет.",
      "Medium Beast, Unaligned. Walk 40 ft., climb 30 ft.; Strength save +2; Perception +2, passive 12; Darkvision 60 ft.; no languages.",
    ),
    rules: [
      p(
        "Таран: рукопашная атака +2, 5 фт.; 1 дробящего, либо 2 (1d4), если непосредственно перед попаданием козёл прошёл по прямой к цели 20 фт.",
        "Ram: melee +2, reach 5 ft.; 1 Bludgeoning, or 2 (1d4) if the goat moved 20 feet straight toward the target immediately before the hit.",
      ),
    ],
  },
  ...(["2014", "2024"] as const).map((edition): RuleCreature => ({
    id: `flumph-${edition}`,
    edition,
    name: p("Фламф", "Flumph"),
    sourceUrl:
      edition === "2014"
        ? "https://dnd.su/bestiary/153-flumph/"
        : "https://next.dnd.su/bestiary/21309-flumph/",
    armorClass: 12,
    hp: 7,
    hitDice: "2d6",
    abilities: [6, 15, 10, 14, 14, 11],
    challenge: "1/8",
    proficiency: 2,
    initiative: 2,
    profile:
      edition === "2014"
        ? p(
            "Маленькая аберрация, законно-добрая. Ходьба 5 фт., полёт 30 фт.; История, Магия и Религия +4. Уязвимость к психическому урону; тёмное зрение 60 фт., пассивное Восприятие 12. Понимает Подземный, не говорит; телепатия 60 фт.",
            "Small Aberration, Lawful Good. Walk 5 ft., fly 30 ft.; History, Arcana and Religion +4. Vulnerable to Psychic; Darkvision 60 ft., passive Perception 12. Understands Undercommon but cannot speak; telepathy 60 ft.",
          )
        : p(
            "Маленькая аберрация, принципиально-добрая. Ходьба 5 фт., полёт с парением 30 фт.; История, Магия и Религия +4. Уязвимость к психическому урону; тёмное зрение 60 фт., пассивное Восприятие 12. Понимает Глубинную речь, не говорит; телепатия 60 фт.",
            "Small Aberration, Lawful Good. Walk 5 ft., fly 30 ft. (hover); History, Arcana and Religion +4. Vulnerable to Psychic; Darkvision 60 ft., passive Perception 12. Understands Deep Speech but cannot speak; telepathy 60 ft.",
          ),
    spellIds: edition === "2014" ? ["lesser-restoration-2014"] : [],
    rules: [
      edition === "2014"
        ? p(
            "Воспринимает телепатические сообщения в 60 фт.; телепатические существа не могут застать его врасплох. Невосприимчив к чтению мыслей, чувствованию эмоций и заклинаниям Прорицания.",
            "Perceives telepathic messages within 60 ft.; telepathic creatures cannot surprise it. Immune to thought reading, emotion sensing and Divination spells.",
          )
        : p(
            "Воспринимает телепатические сообщения в 60 фт. Мысли нельзя прочитать; магия не определяет его местоположение и не наблюдает его на расстоянии.",
            "Perceives telepathic messages within 60 ft. Its thoughts cannot be read, and magic cannot locate or remotely observe it.",
          ),
      p(
        "При опрокидывании бросьте любую кость: нечётный результат также лишает дееспособности. В конце каждого хода спасбросок Ловкости Сл 10 позволяет перевернуться и прекращает эту недееспособность при успехе.",
        "When knocked Prone, roll any die: an odd result also Incapacitates it. At each turn’s end, a successful DC 10 Dexterity save lets it turn upright and ends this Incapacitation.",
      ),
      edition === "2014"
        ? p(
            "Усики: рукопашная атака +4, 5 фт., одно существо; 4 (1d4+2) колющего + 2 (1d4) кислоты. В конце каждого хода цель делает спасбросок Телосложения Сл 10: провал наносит ещё 2 (1d4) кислоты, успех прекращает повторный урон. Малое восстановление также его прекращает.",
            "Tendrils: melee +4, reach 5 ft., one creature; 4 (1d4+2) Piercing + 2 (1d4) Acid. At each turn’s end the target makes a DC 10 Constitution save: failure deals another 2 (1d4) Acid, success ends recurring damage. Lesser Restoration also ends it.",
          )
        : p(
            "Щупальце: рукопашная атака +4, 5 фт.; 4 (1d4+2) кислоты.",
            "Tentacle: melee +4, reach 5 ft.; 4 (1d4+2) Acid.",
          ),
      edition === "2014"
        ? p(
            "Вонючие брызги (1/день): конус 15 фт., спасбросок Ловкости Сл 10; провал покрывает цель жидкостью на 1d4 часа. Она отравлена, и другие существа в 5 фт. от неё также отравлены. Короткий отдых с купанием в воде, спирте или уксусе снимает вонь.",
            "Stench Spray (1/day): 15-foot cone, DC 10 Dexterity save; failure coats the target for 1d4 hours. It is Poisoned, as are other creatures within 5 ft. Bathing in water, alcohol or vinegar during a Short Rest removes the stench.",
          )
        : p(
            "Вонючие брызги (1/день): одна видимая цель в 15 фт., спасбросок Ловкости Сл 10; провал покрывает её жидкостью на 1d4 часа. Она отравлена; другие существа в её эманации 5 фт. тоже отравлены. Купание во время короткого или долгого отдыха снимает вонь.",
            "Stench Spray (1/day): one visible target within 15 ft., DC 10 Dexterity save; failure coats it for 1d4 hours. It is Poisoned; other creatures in its 5-foot Emanation are also Poisoned. Bathing during a Short or Long Rest removes the stench.",
          ),
    ],
  })),
  ...(["2014", "2024"] as const).map((edition): RuleCreature => ({
    id: `unicorn-${edition}`,
    edition,
    name: p("Единорог", "Unicorn"),
    sourceUrl:
      edition === "2014"
        ? "https://dnd.su/bestiary/306-unicorn/"
        : "https://next.dnd.su/bestiary/21601-unicorn/",
    armorClass: 12,
    hp: edition === "2014" ? 67 : 97,
    hitDice: edition === "2014" ? "9d10+18" : "13d10+26",
    abilities: [18, 14, 15, 11, 17, 16],
    challenge: "5",
    proficiency: 3,
    initiative: edition === "2014" ? 2 : 8,
    profile: p(
      `Большой небожитель, законно-добрый. Ходьба 50 фт.; иммунитет к яду, отравлению, очарованию и параличу. Тёмное зрение 60 фт.; пассивное Восприятие 13. Небесный, Сильван, Эльфийский; телепатия ${edition === "2014" ? 60 : 120} фт.`,
      `Large Celestial, Lawful Good. Walk 50 ft.; immune to Poison damage, Poisoned, Charmed and Paralyzed. Darkvision 60 ft.; passive Perception 13. Celestial, Sylvan, Elvish; telepathy ${edition === "2014" ? 60 : 120} ft.`,
    ),
    spellIds: [
      "druidcraft",
      "detect-evil-and-good",
      "pass-without-trace",
      "entangle",
      "dispel-evil-and-good",
      "calm-emotions",
      ...(edition === "2024"
        ? ["word-of-recall", "cure-wounds", "lesser-restoration"]
        : []),
    ].map((id) => `${id}-${edition}`),
    rules: [
      p(
        "Преимущество спасброскам против заклинаний и других магических эффектов.",
        "Advantage on saves against spells and other magical effects.",
      ),
      ...(edition === "2014"
        ? [
            p(
              "Атаки оружием магические. Разбег на 20 фт. по прямой перед попаданием рогом в этот ход добавляет 9 (2d8) колющего; существо-цель при провале спасброска Силы Сл 15 опрокидывается.",
              "Weapon attacks are magical. Moving 20 ft. straight toward a target before a horn hit that turn adds 9 (2d8) Piercing; a creature target falls Prone on a failed DC 15 Strength save.",
            ),
            p(
              "Врождённые заклинания без компонентов, Харизма, Сл 14. Неограниченно: Бесследное передвижение, Искусство друидов, Обнаружение зла и добра. По 1/день: Опутывание, Рассеивание зла и добра, Умиротворение.",
              "Innate spells require no components; Charisma, DC 14. At will: Pass without Trace, Druidcraft, Detect Evil and Good. Each 1/day: Entangle, Dispel Evil and Good, Calm Emotions.",
            ),
            p(
              "Мультиатака: копыта и рог. Копыта: рукопашная +7, 5 фт.; 11 (2d6+4) дробящего. Рог: рукопашная +7, 5 фт.; 8 (1d8+4) колющего.",
              "Multiattack: hooves and horn. Hooves: melee +7, reach 5 ft.; 11 (2d6+4) Bludgeoning. Horn: melee +7, reach 5 ft.; 8 (1d8+4) Piercing.",
            ),
            p(
              "Целебное касание (3/день), действие: другое существо при касании восстанавливает 11 (2d8+2) хитов, излечивается от всех болезней и действующих ядов. Телепортация (1/день), действие: единорог и до трёх согласных видимых существ в 5 фт. со снаряжением переносятся в известное ему место в пределах 1 мили.",
              "Healing Touch (3/day), action: touch another creature to restore 11 (2d8+2) HP and cure all diseases and poisons affecting it. Teleport (1/day), action: the unicorn and up to three willing visible creatures within 5 ft., with equipment, travel to a location it knows within 1 mile.",
            ),
            p(
              "3 легендарных действия, восстановление в начале своего хода, по одному после хода другого существа: атака копытами (1); щит +2 КД себе или видимой цели в 60 фт. до конца следующего хода единорога (2); самоисцеление 11 (2d8+2) хитов (3).",
              "3 Legendary Actions, refreshed at its turn’s start, one option after another creature’s turn: hoof attack (1); +2 AC shield for itself or a visible target within 60 ft. until the end of its next turn (2); heal itself for 11 (2d8+2) HP (3).",
            ),
          ]
        : [
            p(
              "Легендарное сопротивление (3/день): замените провал спасброска успехом.",
              "Legendary Resistance (3/day): replace a failed save with success.",
            ),
            p(
              "Действием сотворите заклинание, Харизма, Сл 14. Неограниченно: Искусство друидов, Обнаружение зла и добра. По 1/день: Бесследное передвижение, Опутывание, Рассеивание зла и добра, Слово возврата, Умиротворение.",
              "As an action, cast a spell using Charisma, DC 14. At will: Druidcraft, Detect Evil and Good. Each 1/day: Pass without Trace, Entangle, Dispel Evil and Good, Word of Recall, Calm Emotions.",
            ),
            p(
              "Мультиатака: копыта и сияющий рог. Копыта: рукопашная +7, 5 фт.; 11 (2d6+4) дробящего. Сияющий рог: рукопашная +7, 5 фт.; 9 (1d10+4) излучения.",
              "Multiattack: hooves and shining horn. Hooves: melee +7, reach 5 ft.; 11 (2d6+4) Bludgeoning. Shining Horn: melee +7, reach 5 ft.; 9 (1d10+4) Radiant.",
            ),
            p(
              "Благословение (3/день), бонусное действие: коснитесь другого существа и сотворите Лечение ран или Малое восстановление с той же Харизмой.",
              "Blessing (3/day), Bonus Action: touch another creature and cast Cure Wounds or Lesser Restoration using the same Charisma.",
            ),
            p(
              "3 легендарных действия, восстановление в начале своего хода, по одному после хода другого существа. Налёт рогом: перемещение до половины скорости без провоцированных атак и атака сияющим рогом. Мерцающий щит: себе или видимой цели в 60 фт. дать 10 (3d6) временных хитов и +2 КД до конца следующего хода единорога; щит повторно недоступен до начала следующего хода единорога.",
              "3 Legendary Actions, refreshed at its turn’s start, one option after another creature’s turn. Horn Rush: move up to half Speed without Opportunity Attacks and make a Shining Horn attack. Shimmering Shield: give itself or a visible target within 60 ft. 10 (3d6) Temporary HP and +2 AC until the end of its next turn; this option cannot repeat until its next turn starts.",
            ),
          ]),
    ],
  })),
];
RULE_CREATURES.push({
  id: "dancing-item-2014",
  edition: "2014",
  name: p("Танцующий предмет", "Dancing Item"),
  sourceUrl: "https://dnd.su/bestiary/3989-dancing_item/",
  armorClass: 16,
  hp: 10,
  hpFormula: p("10 + 5 × уровень барда", "10 + 5 × Bard level"),
  hitDice: "—",
  abilities: [18, 14, 16, 4, 10, 6],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("БМ барда", "Bard’s PB"),
  profile: p(
    "Большой или меньший конструкт, без мировоззрения. Ходьба 30 фт., полёт 30 фт. (парение). Иммунитет к психическому урону и яду; состояниям Отравленный, Очарованный, Испуганный, Истощение. Тёмное зрение 60 фт., пассивное Восприятие 10. Понимает ваши языки.",
    "Large or smaller Construct, Unaligned. Walk 30 ft., fly 30 ft. (hover). Immune to Psychic and Poison damage and the Poisoned, Charmed, Frightened, and Exhaustion conditions. Darkvision 60 ft., passive Perception 10. Understands your languages.",
  ),
  rules: [
    p(
      "Неизменяемая форма: иммунитет к эффектам и заклинаниям, меняющим форму.",
      "Immutable Form: immune to spells and effects that alter its form.",
    ),
    p(
      "Если предмет не недееспособен, когда существо начинает ход в 10 фт. от него, предмет может повысить или понизить (ваш выбор) скорость ходьбы существа на 10 фт. до конца хода.",
      "Unless Incapacitated, when a creature starts its turn within 10 feet, the item may increase or decrease (your choice) its Walking Speed by 10 feet until that turn ends.",
    ),
    p(
      "Наделённый силой удар: рукопашная атака оружием, ваш бонус атаки заклинанием, досягаемость 5 фт., одна видимая цель. Попадание: 1d10 + ваш БМ силового урона.",
      "Force-Empowered Slam: melee weapon attack using your spell attack bonus, reach 5 feet, one visible target. Hit: 1d10 + your PB Force damage.",
    ),
  ],
});
export const ruleCreature = (id: string) =>
  RULE_CREATURES.find((c) => c.id === id);

RULE_CREATURES.push({
  id: "fey-spirit-2024",
  edition: "2024",
  name: p("Дух феи", "Fey Spirit"),
  sourceUrl: "https://next.dnd.su/bestiary/20936-fey-spirit/",
  armorClass: 15,
  armorClassFormula: p("12 + круг заклинания", "12 + spell level"),
  hp: 30,
  hpFormula: p(
    "30 + 10 за каждый круг выше 3",
    "30 + 10 per spell level above 3",
  ),
  hitDice: "—",
  abilities: [13, 16, 14, 14, 11, 16],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 3,
  profile: p(
    "Маленькая фея, нейтральная. Ходьба и полёт 30 фт.; иммунитет к очарованию. Тёмное зрение 60 фт., пассивное Восприятие 10. Сильван; понимает ваши языки.",
    "Small Fey, Neutral. Speed and Fly 30 ft.; immune to Charmed. Darkvision 60 ft.; Passive Perception 10. Sylvan; understands your languages.",
  ),
  rules: [
    p(
      "Мультиатака: половина круга заклинания вниз атак Клинком феи. Рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт., одна цель; 2d6 + 3 + круг силового урона.",
      "Multiattack: half the spell level, rounded down, Fey Blade attacks. Melee attack using your spell attack modifier, reach 5 ft., one target; 2d6 + 3 + spell level Force damage.",
    ),
    p(
      "Бонусное действие — Фейский шаг: телепортация до 30 фт. в видимое свободное место, затем эффект настроения. Сердитое: преимущество следующей атаке до конца текущего хода. Довольное: видимая цель в 10 фт. делает спасбросок Мудрости против вашей Сл; провал — очарована вами и духом на 1 минуту либо до урона. Игривое: магическая тьма в кубе 10 фт. в пределах 5 фт. от духа до конца его следующего хода.",
      "Bonus Action — Fey Step: teleport up to 30 ft. to a visible unoccupied space, then apply the mood. Fuming: Advantage on the next attack before this turn ends. Mirthful: one visible target within 10 ft. makes a Wisdom save against your spell DC; failure causes Charmed by you and the spirit for 1 minute or until damaged. Tricksy: magical Darkness fills a 10-foot Cube within 5 ft. of the spirit until its next turn ends.",
    ),
  ],
});

for (const edition of ["2014", "2024"] as const) {
  const modern = edition === "2024",
    sourceUrl = modern
      ? "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
      : "https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf";
  RULE_CREATURES.push({
    id: "skeleton-" + edition,
    edition,
    name: p("Скелет", "Skeleton"),
    sourceUrl,
    armorClass: modern ? 14 : 13,
    hp: 13,
    hitDice: "2d8 + 4",
    abilities: [10, modern ? 16 : 14, 15, 6, 8, 5],
    challenge: "1/4",
    proficiency: 2,
    initiative: modern ? 3 : 2,
    profile: p(
      "Средняя нежить, законно-злая. Ходьба 30 фт. Уязвимость дробящему урону; иммунитет к яду, истощению и отравлению. Тёмное зрение 60 фт., пассивное Восприятие 9. Не говорит; " +
        (modern
          ? "понимает Общий и ещё один язык."
          : "понимает языки, известные при жизни."),
      "Medium Undead, Lawful Evil. Speed 30 ft. Vulnerable to Bludgeoning; immune to Poison damage, Exhaustion, and Poisoned. Darkvision 60 ft.; Passive Perception 9. Cannot speak; " +
        (modern
          ? "understands Common and one other language."
          : "understands languages known in life."),
    ),
    rules: [
      p(
        `Короткий меч: рукопашная атака +${modern ? 5 : 4}, 5 фт., одна цель. Короткий лук: дальнобойная атака +${modern ? 5 : 4}, 80/320 фт., одна цель. Каждая наносит 1d6 + ${modern ? 3 : 2} колющего урона.`,
        `Shortsword: melee attack +${modern ? 5 : 4}, reach 5 ft., one target. Shortbow: ranged attack +${modern ? 5 : 4}, range 80/320 ft., one target. Each deals 1d6 + ${modern ? 3 : 2} Piercing damage.`,
      ),
    ],
  });
  RULE_CREATURES.push({
    id: "zombie-" + edition,
    edition,
    name: p("Зомби", "Zombie"),
    sourceUrl,
    armorClass: 8,
    hp: modern ? 15 : 22,
    hitDice: modern ? "2d8 + 6" : "3d8 + 9",
    abilities: [13, 6, 16, 3, 6, 5],
    challenge: "1/4",
    proficiency: 2,
    initiative: -2,
    profile: p(
      "Средняя нежить, нейтрально-злая. Ходьба 20 фт., спасбросок Мудрости +0. Иммунитет к яду и отравлению" +
        (modern ? ", а также истощению" : "") +
        ". Тёмное зрение 60 фт., пассивное Восприятие 8. Не говорит; " +
        (modern
          ? "понимает Общий и ещё один язык."
          : "понимает языки, известные при жизни."),
      "Medium Undead, Neutral Evil. Speed 20 ft.; Wisdom save +0. Immune to Poison damage and Poisoned" +
        (modern ? ", as well as Exhaustion" : "") +
        ". Darkvision 60 ft.; Passive Perception 8. Cannot speak; " +
        (modern
          ? "understands Common and one other language."
          : "understands languages known in life."),
    ),
    rules: [
      p(
        "Стойкость нежити: когда урон снижает хиты до 0, спасбросок Телосложения со Сл 5 + полученный урон позволяет остаться с 1 хитом. Не действует против излучения и критического попадания.",
        "Undead Fortitude: when damage would reduce HP to 0, a Constitution save at DC 5 + damage taken leaves 1 HP instead. Does not apply to Radiant damage or Critical Hits.",
      ),
      p(
        `Удар: рукопашная атака +3, досягаемость 5 фт., одна цель; 1d${modern ? 8 : 6} + 1 дробящего урона.`,
        `Slam: melee attack +3, reach 5 ft., one target; 1d${modern ? 8 : 6} + 1 Bludgeoning damage.`,
      ),
    ],
  });
}

// Ranger companions use formulas, not a misleading fixed level-3 snapshot.
for (const edition of ["2014", "2024"] as const) {
  const modern = edition === "2024";
  for (const [i, kind] of ["land", "sea", "sky"].entries()) {
    const sky = kind === "sky",
      sea = kind === "sea";
    RULE_CREATURES.push({
      id: `primal-${kind}-${edition}`,
      edition,
      name: p(
        ["Земной зверь", "Морской зверь", "Небесный зверь"][i],
        ["Beast of the Land", "Beast of the Sea", "Beast of the Sky"][i],
      ),
      sourceUrl: modern
        ? `https://next.dnd.su/bestiary/${20072 + i}-beast-of-the-land`
        : `https://dnd.su/bestiary/${4311 + i}-beast_of_the_${kind}/`,
      armorClass: 13,
      armorClassFormula: p(
        modern ? "13 + ваша Мудрость" : "13 + ваш БМ",
        modern ? "13 + your Wisdom modifier" : "13 + your PB",
      ),
      hp: sky ? 16 : 20,
      hpFormula: p(
        sky ? "4 + 4 × уровень следопыта" : "5 + 5 × уровень следопыта",
        sky ? "4 + 4 × Ranger level" : "5 + 5 × Ranger level",
      ),
      hitDice: sky ? "уровень / level × d6" : "уровень / level × d8",
      abilities: sky ? [6, 16, 13, 8, 14, 11] : [14, 14, 15, 8, 14, 11],
      challenge: "—",
      proficiency: 2,
      proficiencyFormula: p("ваш БМ", "your PB"),
      initiative: sky ? 3 : 2,
      profile: p(
        `${sky ? "Маленький" : "Средний"} зверь, ${modern ? "нейтральный" : "без мировоззрения"}. ${sky ? "Ходьба 10, полёт 60" : sea ? "Ходьба 5, плавание 60" : "Ходьба и лазание 40"} фт. Тёмное зрение ${modern && sea ? 90 : 60} фт., пассивное Восприятие 12. Понимает ваши языки.`,
        `${sky ? "Small" : "Medium"} Beast, ${modern ? "Neutral" : "Unaligned"}. ${sky ? "Speed 10, Fly 60" : sea ? "Speed 5, Swim 60" : "Speed and Climb 40"} ft. Darkvision ${modern && sea ? 90 : 60} ft.; Passive Perception 12. Understands your languages.`,
      ),
      rules: [
        p(
          "Первичная связь: добавьте ваш БМ ко всем проверкам характеристик и спасброскам зверя (в том числе инициативе).",
          "Primal Bond: add your PB to every ability check and saving throw the beast makes (including Initiative).",
        ),
        ...(sea
          ? [
              p(
                "Амфибия: дышит воздухом и водой.",
                "Amphibious: breathes air and water.",
              ),
            ]
          : []),
        ...(sky
          ? [
              p(
                "Облёт: вылетая из досягаемости противника, не провоцирует атаки.",
                "Flyby: leaving an enemy’s reach by flying does not provoke Opportunity Attacks.",
              ),
            ]
          : []),
        p(
          `Атака: рукопашная, ваш бонус атаки заклинанием, досягаемость 5 фт., одна цель. Урон ${sky ? "1d4 + 3" : sea ? "1d6 + 2" : "1d8 + 2"} + ${modern ? "ваша Мудрость" : "ваш БМ"}. Тип: ${sky ? "рубящий" : sea ? "дробящий или колющий" : modern ? "дробящий, колющий или рубящий" : "рубящий"}${!sky && (modern || sea) ? (modern ? " (выберите при призыве)" : " (выберите при попадании)") : ""}.`,
          `Melee attack: your spell attack modifier, reach 5 ft., one target. Damage ${sky ? "1d4 + 3" : sea ? "1d6 + 2" : "1d8 + 2"} + ${modern ? "your Wisdom modifier" : "your PB"}. Type: ${sky ? "Slashing" : sea ? "Bludgeoning or Piercing" : modern ? "Bludgeoning, Piercing, or Slashing" : "Slashing"}${!sky && (modern || sea) ? (modern ? " (choose when summoned)" : " (choose on hit)") : ""}.`,
        ),
        ...(sea
          ? [
              p(
                `Попадание захватывает цель; Сл высвобождения равна Сл ваших заклинаний.${modern ? "" : " Пока захват длится, нельзя атаковать этим ударом другую цель."}`,
                `A hit grapples the target; escape DC equals your spell save DC.${modern ? "" : " Until the grapple ends, this attack cannot target another creature."}`,
              ),
            ]
          : []),
        ...(kind === "land"
          ? [
              p(
                `Если в тот же ход зверь прошёл прямо к цели не менее 20 фт. перед попаданием, добавьте 1d6 ${modern ? "того же" : "рубящего"} урона. ${modern ? "Большая или меньшая цель Опрокинута без спасброска." : "Цель-существо делает спасбросок Силы против Сл ваших заклинаний, при провале сбита с ног."}`,
                `After moving at least 20 ft. straight toward the target that turn, a hit adds 1d6 ${modern ? "of the same" : "Slashing"} damage. ${modern ? "A Large or smaller target is Prone without a save." : "A creature target makes a Strength save against your spell DC or falls Prone."}`,
              ),
            ]
          : []),
      ],
    });
  }
}
RULE_CREATURES.push({
  id: "drake-companion-2014",
  edition: "2014",
  name: p("Дрейк-компаньон", "Drake Companion"),
  sourceUrl: "https://dnd.su/bestiary/4842-drake_companion/",
  armorClass: 14,
  armorClassFormula: p("14 + ваш БМ", "14 + your PB"),
  hp: 20,
  hpFormula: p("5 + 5 × уровень следопыта", "5 + 5 × Ranger level"),
  hitDice: "уровень / level × d10",
  abilities: [16, 12, 15, 8, 14, 8],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 1,
  profile: p(
    "Маленький дракон. Ходьба 40 фт.; тёмное зрение 60 фт., пассивное Восприятие 12. Драконий язык. Спасброски Ловкости +1 + ваш БМ, Мудрости +2 + ваш БМ.",
    "Small Dragon. Speed 40 ft.; Darkvision 60 ft.; Passive Perception 12. Draconic. Dexterity saves +1 + your PB; Wisdom saves +2 + your PB.",
  ),
  rules: [
    p(
      "Сущность: при призыве выберите кислоту, холод, огонь, электричество или яд. Дрейк невосприимчив к этому урону; этот же тип используется в Усиленных ударах.",
      "Essence: choose Acid, Cold, Fire, Lightning, or Poison on summoning. The drake is immune to this damage type and uses it for Infused Strikes.",
    ),
    p(
      "Укус: рукопашная атака оружием +3 + ваш БМ, досягаемость 5 фт., одна цель; 1d6 + ваш БМ колющего урона.",
      "Bite: melee weapon attack +3 + your PB, reach 5 ft., one target; 1d6 + your PB Piercing damage.",
    ),
    p(
      "Реакция — Усиленные удары: когда другое видимое существо в 30 фт. от дрейка попадает оружием, добавьте к той атаке 1d6 урона сущности.",
      "Reaction — Infused Strikes: when another visible creature within 30 ft. of the drake hits with a weapon attack, add 1d6 of the essence damage to that attack.",
    ),
    p(
      "Улучшения следопыта: с 7 уровня Средний размер, полёт 40 фт. (без вас верхом), Укус +1d6 сущности. С 15 уровня Большой размер, полёт с вами верхом, Укус +2d6 сущности вместо +1d6. Команды и дыхание описаны в умениях подкласса.",
      "Ranger upgrades: at level 7, Medium size, Fly 40 ft. (not while you ride it), and Bite +1d6 essence damage. At level 15, Large size, flight while you ride it, and Bite +2d6 essence damage instead of +1d6. Commands and breath are detailed in the subclass features.",
    ),
  ],
});
RULE_CREATURES.push({
  id: "fey-spirit-2014",
  edition: "2014",
  name: p("Дух феи", "Fey Spirit"),
  sourceUrl: "https://dnd.su/bestiary/3144-fey_spirit/",
  armorClass: 15,
  armorClassFormula: p("12 + круг заклинания", "12 + spell level"),
  hp: 30,
  hpFormula: p(
    "30 + 10 за каждый круг выше 3",
    "30 + 10 per spell level above 3",
  ),
  hitDice: "—",
  abilities: [13, 16, 14, 14, 11, 16],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 3,
  profile: p(
    "Маленькая фея, без мировоззрения. Ходьба 40 фт.; иммунитет к очарованию. Тёмное зрение 60 фт., пассивное Восприятие 10. Сильван; понимает ваши языки.",
    "Small Fey, Unaligned. Speed 40 ft.; immune to Charmed. Darkvision 60 ft.; Passive Perception 10. Sylvan; understands your languages.",
  ),
  rules: [
    p(
      "Мультиатака: число атак Коротким мечом равно половине круга заклинания, округляя вниз. Короткий меч: рукопашная атака оружием с вашим бонусом атаки заклинанием, досягаемость 5 фт., одна цель; 1d6 + 3 + круг колющего и 1d6 силового урона.",
      "Multiattack: a number of Shortsword attacks equal to half the spell level, rounded down. Shortsword: melee weapon attack with your spell attack modifier, reach 5 ft., one target; 1d6 + 3 + spell level Piercing plus 1d6 Force damage.",
    ),
    p(
      "Бонусное действие — Фейский шаг: телепортация до 30 фт. в видимое свободное место, затем эффект настроения. Сердитое: преимущество следующей атаке в этот ход. Довольное: видимая цель в 10 фт. делает спасбросок Мудрости против вашей Сл; провал — очарована вами и духом на 1 минуту либо до любого урона. Игривое: куб магической тьмы 5 фт. в пределах 5 фт. от духа до конца его следующего хода.",
      "Bonus Action — Fey Step: teleport up to 30 ft. to a visible unoccupied space, then apply the mood. Fuming: Advantage on the next attack this turn. Mirthful: a visible creature within 10 ft. makes a Wisdom save against your spell DC; failure charms it by you and the spirit for 1 minute or until any damage. Tricksy: a 5-foot cube of magical Darkness within 5 ft. of the spirit, lasting until the end of its next turn.",
    ),
  ],
});

RULE_CREATURES.push({
  id: "wildfire-spirit-2014",
  edition: "2014",
  name: p("Дух дикого огня", "Wildfire Spirit"),
  sourceUrl: "https://dnd.su/bestiary/4235-wildfire-spirit/",
  armorClass: 13,
  hp: 15,
  hpFormula: p("5 + 5 × уровень друида", "5 + 5 × Druid level"),
  hitDice: "—",
  abilities: [10, 14, 14, 13, 15, 11],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 2,
  profile: p(
    "Маленький элементаль, любое мировоззрение. Ходьба и полёт 30 фт., зависание. Иммунитет к огню, очарованию, испугу, захвату, падению ничком и опутанности. Тёмное зрение 60 фт., пассивное Восприятие 12. Понимает ваши языки.",
    "Small Elemental, any alignment. Speed and Fly 30 ft., hover. Immune to Fire, Charmed, Frightened, Grappled, Prone, and Restrained. Darkvision 60 ft.; Passive Perception 12. Understands your languages.",
  ),
  rules: [
    p(
      "Огненное семя: дальнобойная атака оружием с вашим бонусом атаки заклинанием, дистанция 60 фт., одна видимая цель; 1d6 + ваш БМ огня.",
      "Flame Seed: ranged weapon attack using your spell attack modifier, range 60 ft., one visible target; 1d6 + your PB Fire damage.",
    ),
    p(
      "Действие — Огненная телепортация: дух и выбранные согласные существа в 5 фт. от него телепортируются на 15 фт. в видимые вами свободные места. После этого каждое существо в 5 фт. от исходного места духа делает спасбросок Ловкости против Сл ваших заклинаний; при провале 1d6 + ваш БМ огня, при успехе урона нет.",
      "Action — Fiery Teleportation: the spirit and chosen willing creatures within 5 ft. teleport up to 15 ft. to unoccupied spaces you can see. Then each creature within 5 ft. of the spirit’s former space makes a Dexterity save against your spell DC; failure deals 1d6 + your PB Fire damage, success deals none.",
    ),
  ],
});

const elementalSource =
  "https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf";
for (const kind of ["air", "earth", "fire", "water"] as const) {
  const earth = kind === "earth",
    fire = kind === "fire";
  const data = {
    air: {
      name: p("Воздушный элементаль", "Air Elemental"),
      ac: 15,
      hp: 90,
      hd: "12d10 + 24",
      scores: [14, 20, 14, 6, 10, 6],
      profile: p(
        "Ходьба 0 фт., полёт 90 фт. с зависанием. Сопротивление электричеству и звуку. Ауран.",
        "Speed 0 ft., Fly 90 ft., hover. Resistance to Lightning and Thunder. Auran.",
      ),
      rules: [
        p(
          "Воздушное тело: может входить в пространство врага и оставаться там; проходит щели шириной 1 дюйм без протискивания.",
          "Air Form: can enter and remain in an enemy’s space, and pass through a 1-inch gap without squeezing.",
        ),
        p(
          "Мультиатака — два Удара. Удар: рукопашная атака оружием +8, досягаемость 5 фт., одна цель; 2d8 + 5 дробящего урона.",
          "Multiattack — two Slams. Slam: melee weapon attack +8, reach 5 ft., one target; 2d8 + 5 Bludgeoning damage.",
        ),
        p(
          "Вихрь (перезарядка 4–6): все существа в его пространстве делают спасбросок Силы Сл 13. Провал: 3d8 + 2 дробящего урона, отброшены на 20 фт. в случайном направлении и сбиты с ног. При ударе о предмет — дополнительно 1d6 дробящего за каждые 10 фт. броска. При попадании в другое существо оно делает спасбросок Ловкости Сл 13: провал — тот же урон столкновения и падение ничком. Успех исходного спасброска: половина урона Вихря без отбрасывания и падения.",
          "Whirlwind (Recharge 4–6): creatures in its space make a DC 13 Strength save. Failure deals 3d8 + 2 Bludgeoning, throws the target up to 20 ft. in a random direction, and knocks it Prone. Hitting an object adds 1d6 Bludgeoning per 10 ft. thrown. A creature struck by a thrown target makes a DC 13 Dexterity save or takes the same collision damage and falls Prone. Success on the initial save halves the Whirlwind damage and prevents throwing and Prone.",
        ),
      ],
    },
    earth: {
      name: p("Земляной элементаль", "Earth Elemental"),
      ac: 17,
      hp: 126,
      hd: "12d10 + 60",
      scores: [20, 8, 20, 5, 10, 5],
      profile: p(
        "Ходьба и рытьё 30 фт. Чувство вибрации 60 фт. Уязвимость к звуку. Терран.",
        "Speed and Burrow 30 ft. Tremorsense 60 ft. Vulnerable to Thunder. Terran.",
      ),
      rules: [
        p(
          "Скольжение сквозь землю: проходит через немагические необработанные землю и камень, не нарушая их. Осадное чудовище: удвоенный урон предметам и сооружениям.",
          "Earth Glide: burrows through nonmagical unworked earth and stone without disturbing it. Siege Monster: double damage to objects and structures.",
        ),
        p(
          "Мультиатака — два Удара. Удар: рукопашная атака оружием +8, досягаемость 10 фт., одна цель; 2d8 + 5 дробящего урона.",
          "Multiattack — two Slams. Slam: melee weapon attack +8, reach 10 ft., one target; 2d8 + 5 Bludgeoning damage.",
        ),
      ],
    },
    fire: {
      name: p("Огненный элементаль", "Fire Elemental"),
      ac: 13,
      hp: 102,
      hd: "12d10 + 36",
      scores: [10, 17, 16, 6, 10, 7],
      profile: p(
        "Ходьба 50 фт. Иммунитет к огню. Яркий свет 30 фт., тусклый ещё 30 фт. Игнан.",
        "Speed 50 ft. Immune to Fire. Bright Light 30 ft., Dim Light another 30 ft. Ignan.",
      ),
      rules: [
        p(
          "Огненное тело: проходит щели 1 дюйм без протискивания и может занимать пространство врага. Коснувшееся его существо или попавшее по нему рукопашной атакой с расстояния не более 5 фт. получает 1d10 огня. Первый вход элементаля в пространство существа за ход наносит ему 1d10 огня и поджигает. Горящая цель получает 1d10 огня в начале своих ходов, пока кто-либо действием не потушит её.",
          "Fire Form: passes 1-inch gaps without squeezing and may occupy enemy spaces. A creature touching it or hitting it with a melee attack from within 5 ft. takes 1d10 Fire. Its first entry into a creature’s space on a turn deals 1d10 Fire and ignites that creature. Burning targets take 1d10 Fire at the start of their turns until someone uses an action to extinguish the flames.",
        ),
        p(
          "Чувствительность к воде: за каждые 5 фт. движения в воде или каждый вылитый на него галлон воды получает 1 урон холодом.",
          "Water Susceptibility: takes 1 Cold damage for every 5 ft. traveled in water or gallon of water splashed on it.",
        ),
        p(
          "Мультиатака — два Касания. Касание: рукопашная атака оружием +6, досягаемость 5 фт., одна цель; 2d6 + 3 огня. Существо или горючий предмет загорается: 1d10 огня в начале каждого хода до тушения действием.",
          "Multiattack — two Touches. Touch: melee weapon attack +6, reach 5 ft., one target; 2d6 + 3 Fire. A creature or flammable object ignites, taking 1d10 Fire at the start of each turn until extinguished with an action.",
        ),
      ],
    },
    water: {
      name: p("Водяной элементаль", "Water Elemental"),
      ac: 14,
      hp: 114,
      hd: "12d10 + 48",
      scores: [18, 14, 18, 5, 10, 8],
      profile: p(
        "Ходьба 30 фт., плавание 90 фт. Сопротивление кислоте. Акван.",
        "Speed 30 ft., Swim 90 ft. Resistance to Acid. Aquan.",
      ),
      rules: [
        p(
          "Водяное тело: может входить в пространство врага и оставаться там; проходит щели 1 дюйм без протискивания. Замерзание: получив холод, теряет 20 фт. скорости до конца своего следующего хода.",
          "Water Form: may enter and stay in an enemy’s space and pass 1-inch gaps without squeezing. Freeze: taking Cold damage reduces its Speed by 20 ft. until the end of its next turn.",
        ),
        p(
          "Мультиатака — два Удара. Удар: рукопашная атака оружием +7, досягаемость 5 фт., одна цель; 2d8 + 4 дробящего урона.",
          "Multiattack — two Slams. Slam: melee weapon attack +7, reach 5 ft., one target; 2d8 + 4 Bludgeoning damage.",
        ),
        p(
          "Захлёстывание (перезарядка 4–6): все существа в его пространстве делают спасбросок Силы Сл 15. Провал: 2d8 + 4 дробящего урона; Большая или меньшая цель схвачена (высвобождение Сл 14), опутана и не дышит, если не умеет дышать водой. Успех выталкивает цель из пространства без урона. Одновременно держит одно Большое или до двух Средних/меньших существ. В начале каждого хода элементаля схваченные им цели получают 2d8 + 4 дробящего урона. Существо в 5 фт. может действием успешно проверить Силу Сл 14, чтобы вытащить существо или предмет.",
          "Whelm (Recharge 4–6): creatures in its space make a DC 15 Strength save. Failure deals 2d8 + 4 Bludgeoning; a Large or smaller target is Grappled (escape DC 14), Restrained, and unable to breathe unless it breathes water. Success pushes it out without damage. It holds one Large or up to two Medium or smaller creatures. At the start of its turns, each held target takes 2d8 + 4 Bludgeoning. A creature within 5 ft. may use an action and succeed on a DC 14 Strength check to pull a creature or object out.",
        ),
      ],
    },
  }[kind];
  RULE_CREATURES.push({
    id: `${kind}-elemental-2014`,
    edition: "2014",
    name: data.name,
    sourceUrl: elementalSource,
    armorClass: data.ac,
    hp: data.hp,
    hitDice: data.hd,
    abilities: data.scores as RuleCreature["abilities"],
    challenge: "5",
    proficiency: 3,
    profile: p(
      "Большой элементаль, нейтральный. Тёмное зрение 60 фт., пассивное Восприятие 10. " +
        data.profile.ru,
      "Large Elemental, Neutral. Darkvision 60 ft.; Passive Perception 10. " +
        data.profile.en,
    ),
    rules: [
      p(
        "Сопротивление дробящему, колющему и рубящему урону немагических атак. Иммунитет к яду, истощению, параличу, окаменению, отравленному и бессознательному состояниям." +
          (earth
            ? ""
            : " Также иммунитет к захвату, падению ничком и опутанности."),
        "Resistance to Bludgeoning, Piercing, and Slashing from nonmagical attacks. Immune to Poison damage, Exhaustion, Paralyzed, Petrified, Poisoned, and Unconscious." +
          (earth ? "" : " Also immune to Grappled, Prone, and Restrained."),
      ),
      ...data.rules,
    ],
  });
}

RULE_CREATURES.push({
  id: "celestial-spirit-2024",
  edition: "2024",
  name: p("Дух небожителя", "Celestial Spirit"),
  sourceUrl: "https://next.dnd.su/bestiary/23584-celestial-spirit",
  armorClass: 16,
  armorClassFormula: p(
    "11 + круг; у Защитника ещё +2",
    "11 + spell level; Defender adds +2",
  ),
  hp: 40,
  hpFormula: p(
    "40 + 10 за каждый круг выше 5",
    "40 + 10 per spell level above 5",
  ),
  hitDice: "—",
  abilities: [16, 14, 16, 10, 14, 16],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 2,
  profile: p(
    "Большой небожитель, нейтральный. Ходьба 30 фт., полёт 40 фт. Сопротивление излучению, иммунитет к испугу и очарованию. Тёмное зрение 60 фт., пассивное Восприятие 12. Небесный; понимает ваши языки.",
    "Large Celestial, Neutral. Speed 30 ft., Fly 40 ft. Resistance to Radiant; immune to Frightened and Charmed. Darkvision 60 ft.; Passive Perception 12. Celestial; understands your languages.",
  ),
  rules: [
    p(
      "Мультиатака: число атак равно половине круга заклинания, округляя вниз.",
      "Multiattack: a number of attacks equal to half the spell level, rounded down.",
    ),
    p(
      "Мститель — Сияющий лук: дальнобойная атака с вашим бонусом атаки заклинанием, дистанция 600 фт.; 2d6 + 2 + круг излучения.",
      "Avenger — Radiant Bow: ranged attack using your spell attack modifier, range 600 ft.; 2d6 + 2 + spell level Radiant damage.",
    ),
    p(
      "Защитник — Сияющая булава: рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт.; 1d10 + 3 + круг излучения. При попадании дух может дать 1d10 временных хитов себе либо другому видимому существу в 10 фт. от цели.",
      "Defender — Radiant Mace: melee attack using your spell attack modifier, reach 5 ft.; 1d10 + 3 + spell level Radiant damage. On a hit the spirit may grant 1d10 Temporary HP to itself or another visible creature within 10 ft. of the target.",
    ),
    p(
      "Целебное касание (действие, 1/день): коснитесь другого существа и восстановите ему 2d8 + круг хитов.",
      "Healing Touch (action, 1/day): touch another creature and restore 2d8 + spell level HP.",
    ),
  ],
});
for (const waterOnly of [false, true])
  RULE_CREATURES.push({
    id: waterOnly ? "elemental-water-spirit-2014" : "elemental-spirit-2014",
    edition: "2014",
    name: p(
      waterOnly ? "Дух стихии: вода" : "Дух стихии",
      waterOnly ? "Elemental Spirit: Water" : "Elemental Spirit",
    ),
    sourceUrl: "https://dnd.su/bestiary/3143-elemental_spirit/",
    armorClass: 15,
    armorClassFormula: p("11 + круг заклинания", "11 + spell level"),
    hp: 50,
    hpFormula: p(
      "50 + 10 за каждый круг выше 4",
      "50 + 10 per spell level above 4",
    ),
    hitDice: "—",
    abilities: [18, 15, 17, 4, 10, 16],
    challenge: "—",
    proficiency: 2,
    proficiencyFormula: p("ваш БМ", "your PB"),
    initiative: 2,
    profile: p(
      "Средний элементаль, без мировоззрения. Ходьба 40 фт." +
        (waterOnly
          ? " Плавание 40 фт.; сопротивление кислоте."
          : " Воздух: полёт 40 фт. с зависанием, сопротивление электричеству и звуку; земля: рытьё 40 фт., сопротивление колющему и рубящему; огонь: иммунитет к огню; вода: плавание 40 фт., сопротивление кислоте.") +
        " Иммунитет к яду, окаменению, отравлению, параличу и истощению. Тёмное зрение 60 фт., пассивное Восприятие 10. Первичный; понимает ваши языки.",
      "Medium Elemental, Unaligned. Speed 40 ft." +
        (waterOnly
          ? " Swim 40 ft.; Resistance to Acid."
          : " Air: Fly 40 ft., hover, Resistance to Lightning and Thunder; Earth: Burrow 40 ft., Resistance to Piercing and Slashing; Fire: immune to Fire; Water: Swim 40 ft., Resistance to Acid.") +
        " Immune to Poison damage, Petrified, Poisoned, Paralyzed, and Exhaustion. Darkvision 60 ft.; Passive Perception 10. Primordial; understands your languages.",
    ),
    rules: [
      p(
        (waterOnly ? "" : "Воздух, огонь и вода: ") +
          "проходит щели 1 дюйм без протискивания.",
        (waterOnly ? "" : "Air, Fire, and Water: ") +
          "passes 1-inch gaps without squeezing.",
      ),
      p(
        "Мультиатака: число Размашистых ударов равно половине круга заклинания, округляя вниз. Удар: рукопашная атака оружием с вашим бонусом атаки заклинанием, досягаемость 5 фт., одна цель; 1d10 + 4 + круг дробящего урона" +
          (waterOnly ? "." : " (у огненной формы — огонь)."),
        "Multiattack: half the spell level, rounded down, Slam attacks. Slam: melee weapon attack using your spell attack modifier, reach 5 ft., one target; 1d10 + 4 + spell level Bludgeoning damage" +
          (waterOnly ? "." : " (Fire damage for the Fire form)."),
      ),
    ],
  });

RULE_CREATURES.push({
  id: "specter-2014",
  edition: "2014",
  name: p("Спектр", "Specter"),
  sourceUrl: elementalSource,
  armorClass: 12,
  hp: 22,
  hitDice: "5d8",
  abilities: [1, 14, 11, 10, 10, 11],
  challenge: "1",
  proficiency: 2,
  initiative: 2,
  profile: p(
    "Средняя нежить, хаотично-злая. Ходьба 0 фт., полёт 50 фт. с зависанием. Тёмное зрение 60 фт., пассивное Восприятие 10. Понимает прижизненные языки, не говорит.",
    "Medium Undead, Chaotic Evil. Speed 0 ft., Fly 50 ft., hover. Darkvision 60 ft.; Passive Perception 10. Understands languages known in life but cannot speak.",
  ),
  rules: [
    p(
      "Сопротивление кислоте, холоду, огню, электричеству, звуку; дробящему, колющему и рубящему от немагических атак. Иммунитет к некротическому урону, яду, очарованию, истощению, захвату, параличу, окаменению, отравлению, падению ничком, опутанности и бессознательности.",
      "Resistance to Acid, Cold, Fire, Lightning, Thunder, and Bludgeoning/Piercing/Slashing from nonmagical attacks. Immune to Necrotic and Poison damage, Charmed, Exhaustion, Grappled, Paralyzed, Petrified, Poisoned, Prone, Restrained, and Unconscious.",
    ),
    p(
      "Проходит через существ и предметы как через труднопроходимую местность; конец хода внутри предмета наносит ему 1d10 силового урона. На солнечном свету имеет помеху атакам и основанному на зрении Восприятию.",
      "Moves through creatures and objects as difficult terrain; ending its turn inside an object deals it 1d10 Force damage. In sunlight, has Disadvantage on attacks and sight-based Perception checks.",
    ),
    p(
      "Вытягивание жизни: рукопашная атака заклинанием +4, досягаемость 5 фт., одно существо; 3d6 некротического урона. Спасбросок Телосложения Сл 10; провал уменьшает максимум хитов на фактически полученный урон до продолжительного отдыха цели. Снижение максимума до 0 убивает цель. Спектр Ведьмовского клинка дополнительно получает бонус к атакам и временные хиты из умения подкласса.",
      "Life Drain: melee spell attack +4, reach 5 ft., one creature; 3d6 Necrotic damage. DC 10 Constitution save; failure reduces maximum HP by the damage actually taken until the target finishes a Long Rest. Reducing the maximum to 0 kills the target. A Hexblade’s Specter additionally receives the subclass’s attack bonus and Temporary HP.",
    ),
  ],
});
RULE_CREATURES.push({
  id: "undead-spirit-2024",
  edition: "2024",
  name: p("Дух нежити", "Undead Spirit"),
  sourceUrl: "https://next.dnd.su/bestiary/23144-undead-spirit",
  armorClass: 14,
  armorClassFormula: p("11 + круг заклинания", "11 + spell level"),
  hp: 30,
  hpFormula: p(
    "30 (Гнилостный/Призрачный) или 20 (Скелетный) + 10 за каждый круг выше 3",
    "30 (Putrid/Ghostly) or 20 (Skeletal) + 10 per spell level above 3",
  ),
  hitDice: "—",
  abilities: [12, 16, 15, 4, 10, 9],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 3,
  profile: p(
    "Средняя нежить, нейтральная. Ходьба 30 фт.; Призрачный: полёт 40 фт. с зависанием. Иммунитет к некротическому урону, яду, испугу, истощению, отравлению и параличу. Тёмное зрение 60 фт., пассивное Восприятие 10. Понимает ваши языки.",
    "Medium Undead, Neutral. Speed 30 ft.; Ghostly: Fly 40 ft., hover. Immune to Necrotic and Poison damage, Frightened, Exhaustion, Poisoned, and Paralyzed. Darkvision 60 ft.; Passive Perception 10. Understands your languages.",
  ),
  rules: [
    p(
      "Гнилостный — Гнойная аура: все существа кроме заклинателя, начинающие ход в эманации духа 5 фт., делают спасбросок Телосложения против Сл заклинателя; провал отравляет до начала их следующего хода.",
      "Putrid — Festering Aura: each creature except the caster starting its turn in the spirit’s 5-foot Emanation makes a Constitution save against the caster’s spell DC; failure causes Poisoned until the start of its next turn.",
    ),
    p(
      "Призрачный — проходит существ/объекты как труднопроходимую местность. Если заканчивает ход внутри объекта, выталкивается в ближайшее свободное место и получает 1d10 силового урона за каждые 5 фт. такого перемещения.",
      "Ghostly — moves through creatures and objects as difficult terrain. Ending its turn inside an object ejects it to the nearest unoccupied space and deals 1d10 Force damage per 5 ft. moved.",
    ),
    p(
      "Мультиатака: половина круга заклинания атак, округляя вниз. Все атаки используют ваш бонус атаки заклинанием.",
      "Multiattack: half the spell level attacks, rounded down. Every attack uses your spell attack modifier.",
    ),
    p(
      "Призрачный — Смертное касание: рукопашная атака, досягаемость 5 фт.; 1d8 + 3 + круг некротического урона, цель напугана до конца своего следующего хода без спасброска.",
      "Ghostly — Deathly Touch: melee attack, reach 5 ft.; 1d8 + 3 + spell level Necrotic damage; target is Frightened until the end of its next turn without a save.",
    ),
    p(
      "Скелетный — Могильный выстрел: дальнобойная атака, дистанция 150 фт.; 2d4 + 3 + круг некротического урона.",
      "Skeletal — Grave Bolt: ranged attack, range 150 ft.; 2d4 + 3 + spell level Necrotic damage.",
    ),
    p(
      "Гнилостный — Гниющие когти: рукопашная атака, досягаемость 5 фт.; 1d6 + 3 + круг рубящего урона. Отравленная цель также парализована до конца своего следующего хода без спасброска.",
      "Putrid — Rotting Claw: melee attack, reach 5 ft.; 1d6 + 3 + spell level Slashing damage. A Poisoned target is also Paralyzed until the end of its next turn without a save.",
    ),
  ],
});

RULE_CREATURES.push({
  id: "vestige-companion-2024",
  edition: "2024",
  name: p("Спутник-предтеча", "Vestige Companion"),
  sourceUrl: "https://next.dnd.su/bestiary/35683-vestige-companion",
  armorClass: 13,
  armorClassFormula: p("13 + ваша Харизма", "13 + your Charisma modifier"),
  hp: 16,
  hpFormula: p("4 + 4 × уровень колдуна", "4 + 4 × Warlock level"),
  hitDice: "уровень / level × d6",
  abilities: [1, 14, 10, 15, 15, 16],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 2,
  profile: p(
    "Маленький, нейтральный; тип выбирается при призыве: Исчадие, Небожитель или Нежить. Ходьба 5 фт., полёт 30 фт. с зависанием. Сопротивление: огонь (Исчадие), излучение (Небожитель), некротический урон (Нежить). Иммунитет к испугу, падению ничком и очарованию. Тёмное зрение 60 фт., пассивное Восприятие 12. Понимает ваши языки.",
    "Small, Neutral; choose Fiend, Celestial, or Undead on summoning. Speed 5 ft., Fly 30 ft., hover. Resistance: Fire (Fiend), Radiant (Celestial), Necrotic (Undead). Immune to Frightened, Prone, and Charmed. Darkvision 60 ft.; Passive Perception 12. Understands your languages.",
  ),
  rules: [
    p(
      "Связь договора: добавьте ваш БМ ко всем проверкам характеристик и спасброскам спутника, включая инициативу.",
      "Pact Bond: add your PB to all the companion’s ability checks and saving throws, including Initiative.",
    ),
    p(
      "Удар предтечи: рукопашная или дальнобойная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт. или дистанция 60 фт.; 1d6 + 3 + ваша Харизма урона типа сопротивления спутника.",
      "Vestige Strike: melee or ranged attack using your spell attack modifier, reach 5 ft. or range 60 ft.; 1d6 + 3 + your Charisma modifier damage of the companion’s resistance type.",
    ),
    p(
      "Бонусное действие — Божественная сила (1/день; улучшенное восстановление с 6 уровня колдуна). Исчадие: вы и спутник в 60 фт. телепортируетесь, меняясь местами. Небожитель: касанием другому существу восстановите 2d8 + ваша Харизма хитов и снимите одно состояние — глухота, слепота или отравление. Нежить: видимое вами существо в 30 фт. от спутника на 1 минуту получает помеху атакам по вам и спутнику; спасброска нет.",
      "Bonus Action — Divine Power (1/day; improved recovery at Warlock level 6). Fiend: you and the companion, within 60 ft., teleport to exchange spaces. Celestial: touch another creature, restore 2d8 + your Charisma modifier HP, and end one condition: Deafened, Blinded, or Poisoned. Undead: a creature you can see within 30 ft. of the companion has Disadvantage on attacks against you and it for 1 minute; no save.",
    ),
  ],
});
RULE_CREATURES.push({
  id: "fiendish-spirit-2024",
  edition: "2024",
  name: p("Дух исчадия", "Fiendish Spirit"),
  sourceUrl: "https://next.dnd.su/bestiary/23586-fiendish-spirit",
  armorClass: 18,
  armorClassFormula: p("12 + круг заклинания", "12 + spell level"),
  hp: 50,
  hpFormula: p(
    "50 (Демон), 40 (Дьявол) или 60 (Юголот) + 15 за каждый круг выше 6",
    "50 (Demon), 40 (Devil), or 60 (Yugoloth) + 15 per spell level above 6",
  ),
  hitDice: "—",
  abilities: [13, 16, 15, 10, 10, 16],
  challenge: "—",
  proficiency: 2,
  proficiencyFormula: p("ваш БМ", "your PB"),
  initiative: 3,
  profile: p(
    "Большое исчадие, нейтральное. Ходьба 40 фт.; Демон: лазание 40 фт.; Дьявол: полёт 60 фт. Сопротивление огню, иммунитет к яду и отравлению. Тёмное зрение 60 фт., пассивное Восприятие 10. Бездны, Инфернальный, телепатия 60 фт.",
    "Large Fiend, Neutral. Speed 40 ft.; Demon: Climb 40 ft.; Devil: Fly 60 ft. Resistance to Fire; immune to Poison damage and Poisoned. Darkvision 60 ft.; Passive Perception 10. Abyssal, Infernal, Telepathy 60 ft.",
  ),
  rules: [
    p(
      "Преимущество спасброскам против заклинаний и других магических эффектов. Дьявол видит сквозь магическую тьму тёмным зрением.",
      "Advantage on saves against spells and other magical effects. A Devil’s Darkvision works through magical Darkness.",
    ),
    p(
      "Демон — Предсмертная агония: при 0 хитов или конце заклинания взрывается. Все существа в эманации 10 фт. делают спасбросок Ловкости против вашей Сл: 2d10 + круг огня при провале, половина при успехе.",
      "Demon — Death Throes: explodes at 0 HP or when the spell ends. Creatures in a 10-foot Emanation make a Dexterity save against your spell DC: 2d10 + spell level Fire on failure, half on success.",
    ),
    p(
      "Мультиатака: половина круга атак, округляя вниз. Все атаки используют ваш бонус атаки заклинанием. Демон — Укус: рукопашная, 5 фт., 1d12 + 3 + круг некротического урона. Юголот — Когти: рукопашная, 5 фт., 1d8 + 3 + круг рубящего; сразу после попадания или промаха может телепортироваться в видимое свободное место в 30 фт. Дьявол — Огненный удар: рукопашная 5 фт. либо дальнобойная 150 фт., 2d6 + 3 + круг огня.",
      "Multiattack: half the spell level attacks, rounded down. All attacks use your spell attack modifier. Demon — Bite: melee, 5 ft., 1d12 + 3 + spell level Necrotic. Yugoloth — Claws: melee, 5 ft., 1d8 + 3 + spell level Slashing; immediately after a hit or miss it may teleport to a visible unoccupied space within 30 ft. Devil — Fiery Strike: melee 5 ft. or ranged 150 ft., 2d6 + 3 + spell level Fire.",
    ),
  ],
});

RULE_CREATURES.push({
 id:"tiny-servant-2014",edition:"2014",name:p("Крошечный слуга","Tiny Servant"),sourceUrl:"https://dnd.su/bestiary/501-tiny_servant/",
 armorClass:15,hp:10,hitDice:"4d4",abilities:[4,16,10,2,10,1],challenge:"—",proficiency:2,initiative:3,
 profile:p("Крошечный конструкт без мировоззрения. Ходьба 30 фт., лазание 30 фт. Иммунитет к яду и психическому урону, ослеплению, очарованию, глухоте, истощению, испугу, параличу, окаменению и отравлению. Слепое зрение 60 фт.; за пределами радиуса слеп. Пассивное Восприятие 10; языков нет.","Tiny unaligned Construct. Speed 30 ft., Climb 30 ft. Immune to Poison and Psychic damage and to Blinded, Charmed, Deafened, Exhaustion, Frightened, Paralyzed, Petrified, and Poisoned. Blindsight 60 ft.; blind beyond it. Passive Perception 10; no languages."),
 rules:[p("Удар: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 1d4 + 3 дробящего урона.","Slam: melee weapon attack +5, reach 5 ft., one target; 1d4 + 3 Bludgeoning damage.")],
});
RULE_CREATURES.push({
 id:"homunculus-servant-2024",edition:"2024",name:p("Слуга-гомункул","Homunculus Servant"),sourceUrl:"https://next.dnd.su/bestiary/27366-homunculus-servant",
 armorClass:13,hp:15,hpFormula:p("5 + 5 × круг заклинания","5 + 5 × spell level"),hitDice:"круг / level × d4",abilities:[4,15,12,10,10,7],challenge:"—",proficiency:0,initiative:2,
 profile:p("Крошечный нейтральный конструкт. Ходьба 20 фт., полёт 30 фт. Иммунитет к яду, отравлению и истощению. Тёмное зрение 60 фт.; пассивное Восприятие 10 до Магической связи. Телепатия 1 миля только с вами.","Tiny Neutral Construct. Speed 20 ft., Fly 30 ft. Immune to Poison damage, Poisoned, and Exhaustion. Darkvision 60 ft.; Passive Perception 10 before Magical Bond. Telepathy 1 mile, only with you."),
 rules:[
 p("Магическая связь: добавьте круг заклинания ко всем проверкам характеристик и спасброскам гомункула, в том числе инициативе и пассивным проверкам.","Magical Bond: add the spell level to all the homunculus’s ability checks and saving throws, including Initiative and passive checks."),
 p("Увёртливость: эффект, разрешающий спасбросок Ловкости для половины урона, при успехе не наносит урона, при провале наносит половину. Не работает при недееспособности.","Evasion: when an effect allows a Dexterity save for half damage, success instead prevents damage and failure deals half. Unavailable while Incapacitated."),
 p("Силовой удар: рукопашная или дальнобойная атака с вашим бонусом атаки заклинанием; досягаемость 5 фт. или дистанция 30 фт.; 1d6 + круг силового урона.","Force Strike: melee or ranged attack using your spell attack modifier; reach 5 ft. or range 30 ft.; 1d6 + spell level Force damage."),
 p("Проведение магии: реакцией, когда вы в 120 фт. сотворяете заклинание с дистанцией Касание, гомункул передаёт его своим касанием.","Channel Magic: as a Reaction when you cast a Touch-range spell while the homunculus is within 120 ft., it delivers the spell with its own touch."),
 ],
});

for (const edition of ["2014","2024"] as const) RULE_CREATURES.push({
 id:`steel-defender-${edition}`,edition,name:p("Стальной защитник","Steel Defender"),sourceUrl:edition === "2014" ? "https://dnd.su/bestiary/3988-steel-defender/" : "https://next.dnd.su/bestiary/27372-steel-defender",
 armorClass:15,...(edition === "2024" ? {armorClassFormula:p("12 + ваш Интеллект","12 + your Intelligence modifier")} : {}),hp:20,
 hpFormula:edition === "2014" ? p("2 + ваш Интеллект + 5 × уровень изобретателя","2 + your Intelligence modifier + 5 × Artificer level") : p("5 + 5 × уровень изобретателя","5 + 5 × Artificer level"),
 hitDice:"уровень / level × d8",abilities:[14,12,14,4,10,6],challenge:"—",proficiency:0,proficiencyFormula:p("ваш БМ","your PB"),initiative:1,
 profile:p("Средний конструкт"+(edition === "2024" ? ", нейтральный" : "")+". Скорость 40 фт.; тёмное зрение 60 фт. Иммунитет к яду, отравлению, очарованию и истощению. Понимает ваши языки.","Medium Construct"+(edition === "2024" ? ", Neutral" : "")+". Speed 40 ft.; Darkvision 60 ft. Immune to Poison damage, Poisoned, Charmed, and Exhaustion. Understands your languages."),
 rules:edition === "2014" ? [
 p("Спасброски Ловкости 1 + ваш БМ, Телосложения 2 + ваш БМ; Атлетика 2 + БМ, Восприятие 2 × БМ, пассивное Восприятие 10 + 2 × БМ. Нельзя застать врасплох.","Dexterity saves 1 + your PB, Constitution saves 2 + your PB; Athletics 2 + PB, Perception 2 × PB, passive Perception 10 + 2 × PB. Cannot be surprised."),
 p("Силовой удар: рукопашная атака оружием с вашим бонусом атаки заклинанием, досягаемость 5 фт., одна видимая цель; 1d8 + ваш БМ силового урона.","Force-Empowered Rend: melee weapon attack using your spell attack bonus, reach 5 ft., one visible target; 1d8 + your PB Force damage."),
 p("Ремонт, 3/день: действием восстановите 2d8 + ваш БМ хитов защитнику, конструкту или предмету в 5 фт.","Repair, 3/day: as an action restore 2d8 + your PB HP to the defender, a Construct, or an object within 5 ft."),
 p("Отражение атаки: реакцией дайте помеху атаке видимого существа в 5 фт., если оно атакует не защитника.","Deflect Attack: use a reaction to impose disadvantage on an attack by a visible creature within 5 ft. against a target other than the defender."),
 ] : [
 p("Стальная связь: добавьте ваш БМ ко всем проверкам характеристик и спасброскам защитника. Пассивное Восприятие до этого бонуса 10; инициатива до бонуса +1.","Steel Bond: add your PB to all its ability checks and saving throws. Base passive Perception is 10 and base Initiative is +1 before this bonus."),
 p("Силовой разрыв: рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт.; 1d8 + 2 + ваш Интеллект силового урона.","Force-Empowered Rend: melee attack using your spell attack bonus, reach 5 ft.; 1d8 + 2 + your Intelligence modifier Force damage."),
 p("Ремонт, 3/день: действием восстановите 2d8 + ваш Интеллект хитов защитнику либо видимому конструкту или предмету в 5 фт.","Repair, 3/day: as an action restore 2d8 + your Intelligence modifier HP to itself or a visible Construct or object within 5 ft."),
 p("Отражение атаки: когда видимое существо в 5 фт. атакует другое существо, реакцией наложите помеху на эту атаку.","Deflect Attack: when a visible creature within 5 ft. attacks another creature, use a Reaction to impose Disadvantage on that attack."),
 ],
});
RULE_CREATURES.push({
 id:"reanimated-companion-2024",edition:"2024",name:p("Реанимированный спутник","Reanimated Companion"),sourceUrl:"https://next.dnd.su/bestiary/31225-reanimated-companion",
 armorClass:10,armorClassFormula:p("10 + ваш Интеллект","10 + your Intelligence modifier"),hp:20,hpFormula:p("5 + 5 × уровень изобретателя","5 + 5 × Artificer level"),hitDice:"уровень / level × d8",abilities:[11,10,16,4,10,6],challenge:"—",proficiency:0,initiative:0,
 profile:p("Средняя нейтральная нежить. Скорость 30 фт.; слепое зрение 60 фт., пассивное Восприятие 10. Сопротивление некротическому урону и яду; иммунитет к электричеству, истощению, отравлению и очарованию. Понимает ваши языки.","Medium Neutral Undead. Speed 30 ft.; Blindsight 60 ft., passive Perception 10. Resistance to Necrotic and Poison; immunity to Lightning, Exhaustion, Poisoned, and Charmed. Understands your languages."),
 rules:[
 p("Взрыв смерти: при смерти все существа в эманации 10 фт. делают спасбросок Ловкости против Сл ваших заклинаний; 2d4 некротического урона при провале, половина при успехе.","Death Burst: on death, every creature in a 10-ft. Emanation makes a Dexterity save against your spell save DC; 2d4 Necrotic damage on failure, half on success."),
 p("Поглощение электричества: вместо электрического урона восстанавливает столько же хитов.","Lightning Absorption: instead of taking Lightning damage, regain that many HP."),
 p("Ужасающий замах: рукопашная атака с вашим бонусом атаки заклинанием, досягаемость 5 фт.; 1d4 + ваш Интеллект некротического урона. Попавшая под удар цель не может совершать провоцированные атаки до начала своего следующего хода.","Dreadful Swipe: melee attack using your spell attack modifier, reach 5 ft.; 1d4 + your Intelligence modifier Necrotic damage. The target cannot make Opportunity Attacks until the start of its next turn."),
 ],
});

RULE_CREATURES.push({
 id:"homunculus-servant-2014",edition:"2014",name:p("Слуга-гомункул","Homunculus Servant"),sourceUrl:"https://dnd.su/bestiary/3987-homunculus-servant/",
 armorClass:13,hp:5,hpFormula:p("1 + ваш Интеллект + уровень изобретателя","1 + your Intelligence modifier + Artificer level"),hitDice:"уровень / level × d4",abilities:[4,15,12,10,10,7],challenge:"—",proficiency:0,proficiencyFormula:p("ваш БМ","your PB"),initiative:2,
 profile:p("Крошечный конструкт. Ходьба 20 фт., полёт 30 фт.; тёмное зрение 60 фт. Иммунитет к яду, отравлению и истощению. Понимает ваши языки.","Tiny Construct. Speed 20 ft., Fly 30 ft.; Darkvision 60 ft. Immune to Poison damage, Poisoned, and Exhaustion. Understands your languages."),
 rules:[
 p("Спасброски Ловкости 2 + ваш БМ; Скрытность 2 + БМ, Восприятие 2 × БМ, пассивное Восприятие 10 + 2 × БМ.","Dexterity saves 2 + your PB; Stealth 2 + PB, Perception 2 × PB, passive Perception 10 + 2 × PB."),
 p("Увёртливость: если эффект разрешает спасбросок Ловкости для половины урона, успех предотвращает весь урон, провал оставляет половину. Не действует при недееспособности.","Evasion: a Dexterity save for half damage instead prevents all damage on success and halves it on failure. Unavailable while incapacitated."),
 p("Силовой удар: дальнобойная атака оружием с вашим бонусом атаки заклинанием, дистанция 30 фт., одна видимая цель; 1d4 + ваш БМ силового урона.","Force Strike: ranged weapon attack using your spell attack bonus, range 30 ft., one visible target; 1d4 + your PB Force damage."),
 p("Канал магии: реакцией передайте вашим касанием заклинание хозяина с дистанцией Касание, если хозяин в 120 фт.","Channel Magic: use a reaction to deliver your master's Touch-range spell with your touch while your master is within 120 ft."),
 ],
});

RULE_CREATURES.push({
 id:"bat-2014",edition:"2014",name:p("Летучая мышь","Bat"),sourceUrl:srd51+"#page=367",
 armorClass:12,hp:1,hitDice:"1d4 − 1",abilities:[2,15,8,2,12,4],challenge:"0",proficiency:2,initiative:2,
 profile:p("Крошечный зверь без мировоззрения. Ходьба 5 фт., полёт 30 фт.; слепое зрение 60 фт., пассивное Восприятие 11. Языков нет.","Tiny unaligned Beast. Speed 5 ft., Fly 30 ft.; Blindsight 60 ft., passive Perception 11. No languages."),
 rules:[p("Эхолокация: слепое зрение не работает при Глухоте. Острый слух: преимущество на проверки Мудрости (Внимательность), основанные на слухе.","Echolocation: Blindsight cannot be used while Deafened. Keen Hearing: Advantage on Wisdom (Perception) checks relying on hearing."),p("Укус: рукопашная атака оружием +0, досягаемость 5 фт., одно существо; 1 колющего урона.","Bite: melee weapon attack +0, reach 5 ft., one creature; 1 Piercing damage.")],
},{
 id:"rat-2014",edition:"2014",name:p("Крыса","Rat"),sourceUrl:srd51+"#page=387",
 armorClass:10,hp:1,hitDice:"1d4 − 1",abilities:[2,11,9,2,10,4],challenge:"0",proficiency:2,initiative:0,
 profile:p("Крошечный зверь без мировоззрения. Ходьба 20 фт.; тёмное зрение 30 фт., пассивное Восприятие 10. Языков нет.","Tiny unaligned Beast. Speed 20 ft.; Darkvision 30 ft., passive Perception 10. No languages."),
 rules:[p("Острое обоняние: преимущество на проверки Мудрости (Внимательность), основанные на запахе.","Keen Smell: Advantage on Wisdom (Perception) checks relying on smell."),p("Укус: рукопашная атака оружием +0, досягаемость 5 фт., одна цель; 1 колющего урона.","Bite: melee weapon attack +0, reach 5 ft., one target; 1 Piercing damage.")],
},{
 id:"giant-rat-2014",edition:"2014",name:p("Гигантская крыса","Giant Rat"),sourceUrl:srd51+"#page=378",
 armorClass:12,hp:7,hitDice:"2d6",abilities:[7,15,11,2,10,4],challenge:"1/8",proficiency:2,initiative:2,
 profile:p("Маленький зверь без мировоззрения. Ходьба 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 10. Языков нет.","Small unaligned Beast. Speed 30 ft.; Darkvision 60 ft., passive Perception 10. No languages."),
 rules:[p("Острое обоняние: преимущество на проверки Мудрости (Внимательность), основанные на запахе. Тактика стаи: атаки существа с преимуществом, если хотя бы один дееспособный союзник крысы находится в 5 фт. от цели.","Keen Smell: Advantage on Wisdom (Perception) checks relying on smell. Pack Tactics: Advantage on an attack against a creature if at least one ally is within 5 ft. of it and is not Incapacitated."),p("Укус: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 4 (1d4 + 2) колющего урона.","Bite: melee weapon attack +4, reach 5 ft., one target; 4 (1d4 + 2) Piercing damage.")],
},{
 id:"swarm-of-rats-2014",edition:"2014",name:p("Рой крыс","Swarm of Rats"),sourceUrl:srd51+"#page=390",
 armorClass:10,hp:24,hitDice:"7d8 − 7",abilities:[9,11,9,2,10,3],challenge:"1/4",proficiency:2,initiative:0,
 profile:p("Средний рой Крошечных зверей без мировоззрения. Ходьба 30 фт.; тёмное зрение 30 фт., пассивное Восприятие 10. Языков нет. Сопротивление дробящему, колющему и рубящему урону. Иммунитет к Очарованию, Испугу, Захвату, Параличу, Окаменению, Сбиванию с ног, Опутыванию и Ошеломлению.","Medium swarm of Tiny unaligned Beasts. Speed 30 ft.; Darkvision 30 ft., passive Perception 10. No languages. Resistance to Bludgeoning, Piercing, and Slashing. Immune to Charmed, Frightened, Grappled, Paralyzed, Petrified, Prone, Restrained, and Stunned."),
 rules:[p("Острое обоняние: преимущество на проверки Мудрости (Внимательность), основанные на запахе.","Keen Smell: Advantage on Wisdom (Perception) checks relying on smell."),p("Рой может находиться в пространстве другого существа и наоборот; проходит в отверстия, достаточные для Крошечной крысы. Не восстанавливает хиты и не получает временные хиты.","Swarm: occupy another creature's space and vice versa; pass through openings large enough for a Tiny rat. Cannot regain HP or gain temporary HP."),p("Укусы: рукопашная атака оружием +2, досягаемость 0 фт., одна цель в пространстве роя; 7 (2d6) колющего урона либо 3 (1d6), если у роя половина хитов или меньше.","Bites: melee weapon attack +2, reach 0 ft., one target in the swarm's space; 7 (2d6) Piercing damage, or 3 (1d6) while at half HP or less.")],
});
RULE_CREATURES.push({
 id:"awakened-shrub-2014",edition:"2014",name:p("Пробуждённый куст","Awakened Shrub"),sourceUrl:srd51+"#page=366",
 armorClass:9,hp:10,hitDice:"3d6",abilities:[3,8,11,10,10,6],challenge:"0",proficiency:2,initiative:-1,
 profile:p("Маленькое растение без мировоззрения. Ходьба 20 фт.; пассивное Восприятие 10. Один язык, известный создателю. Уязвимость к огню, сопротивление колющему урону.","Small unaligned Plant. Speed 20 ft.; passive Perception 10. One language known to its creator. Vulnerable to Fire; resistant to Piercing."),
 rules:[p("Обманчивая внешность: неподвижный куст неотличим от обычного.","False Appearance: while motionless, indistinguishable from an ordinary shrub."),p("Разрывание: рукопашная атака оружием +1, досягаемость 5 фт., одна цель; 1 (1d4 − 1) рубящего урона.","Rake: melee weapon attack +1, reach 5 ft., one target; 1 (1d4 − 1) Slashing damage.")],
},{
 id:"frog-2014",edition:"2014",name:p("Лягушка","Frog"),sourceUrl:srd51+"#page=372",
 armorClass:11,hp:1,hitDice:"1d4 − 1",abilities:[1,13,8,1,8,3],challenge:"0",proficiency:2,initiative:1,
 profile:p("Крошечный зверь без мировоззрения. Ходьба и плавание 20 фт.; тёмное зрение 30 фт., пассивное Восприятие 11. Восприятие +1, Скрытность +3. Языков нет.","Tiny unaligned Beast. Speed and Swim 20 ft.; Darkvision 30 ft., passive Perception 11. Perception +1, Stealth +3. No languages."),
 rules:[p("Амфибия: дышит воздухом и водой. Прыжок с места или разбега: в длину до 10 фт., в высоту до 5 фт. Эффективных атак нет.","Amphibious: breathes air and water. Standing Leap: long jump up to 10 ft., high jump up to 5 ft., with or without a running start. No effective attacks.")],
},{
 id:"vox-seeker-2014",edition:"2014",name:p("Искатель голоса","Vox Seeker"),sourceUrl:"https://dnd.su/bestiary/3610-vox_seeker/",
 armorClass:14,hp:7,hitDice:"2d4 + 2",abilities:[2,10,12,1,10,1],challenge:"1/8",proficiency:2,initiative:0,
 profile:p("Крошечный конструкт без мировоззрения. Ходьба и лазание 20 фт.; слепое зрение 60 фт., слеп за его пределами; пассивное Восприятие 10. Языков нет. Иммунитет к яду и психическому урону; к Ослеплению, Очарованию, Глухоте, Истощению, Испугу, Параличу, Окаменению и Отравлению.","Tiny unaligned Construct. Speed and Climb 20 ft.; Blindsight 60 ft., blind beyond it; passive Perception 10. No languages. Immune to Poison and Psychic damage; Blinded, Charmed, Deafened, Exhaustion, Frightened, Paralyzed, Petrified, and Poisoned."),
 rules:[p("Голосовое наведение: пока работает, обязан двигаться к источнику ближайшего голоса в пределах 60 фт. и атаковать его, игнорируя другие цели.","Voice Lock: while operational, must move toward and attack the nearest voice within 60 ft., excluding all other targets."),p("Паучье лазанье: сложные поверхности и потолки преодолевает без проверки.","Spider Climb: climbs difficult surfaces and ceilings without an ability check."),p("Щипок: рукопашная атака оружием +2, досягаемость 5 фт., одна цель; 2 (1d4) колющего урона и 3 электрического.","Pincer: melee weapon attack +2, reach 5 ft., one target; 2 (1d4) Piercing plus 3 Lightning damage.")],
});
RULE_CREATURES.push({
 id:"awakened-shrub-2024",edition:"2024",name:p("Пробуждённый куст","Awakened Shrub"),sourceUrl:"https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=260",
 armorClass:9,hp:10,hitDice:"3d6",abilities:[3,8,11,10,10,6],challenge:"0",proficiency:2,initiative:-1,
 profile:p("Маленькое нейтральное растение. Ходьба 20 фт.; пассивное Восприятие 10. Общий и ещё один язык. Уязвимость к огню, сопротивление колющему урону.","Small Neutral Plant. Speed 20 ft.; passive Perception 10. Common plus one language. Vulnerable to Fire; resistant to Piercing."),
 rules:[p("Разрывание: рукопашная атака +1, досягаемость 5 фт.; 1 рубящий урон.","Rake: melee attack +1, reach 5 ft.; 1 Slashing damage.")],
},{
 id:"frog-2024",edition:"2024",name:p("Лягушка","Frog"),sourceUrl:"https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=348",
 armorClass:11,hp:1,hitDice:"1d4 − 1",abilities:[1,13,8,1,8,3],challenge:"0",proficiency:2,initiative:1,
 profile:p("Крошечный зверь без мировоззрения. Ходьба и плавание 20 фт.; тёмное зрение 30 фт., пассивное Восприятие 11. Восприятие +1, Скрытность +3. Языков нет.","Tiny unaligned Beast. Speed and Swim 20 ft.; Darkvision 30 ft., passive Perception 11. Perception +1, Stealth +3. No languages."),
 rules:[p("Амфибия: дышит воздухом и водой. Прыжок с места или разбега: в длину до 10 фт., в высоту до 5 фт.","Amphibious: breathes air and water. Standing Leap: long jump up to 10 ft., high jump up to 5 ft., with or without a running start."),p("Укус: рукопашная атака +3, досягаемость 5 фт.; 1 колющий урон.","Bite: melee attack +3, reach 5 ft.; 1 Piercing damage.")],
},{
 id:"bat-2024",edition:"2024",name:p("Летучая мышь","Bat"),sourceUrl:"https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=345",
 armorClass:12,hp:1,hitDice:"1d4 − 1",abilities:[2,15,8,2,12,4],challenge:"0",proficiency:2,initiative:2,
 profile:p("Крошечный зверь без мировоззрения. Ходьба 5 фт., полёт 30 фт.; слепое зрение 60 фт., пассивное Восприятие 11. Языков нет.","Tiny unaligned Beast. Speed 5 ft., Fly 30 ft.; Blindsight 60 ft., passive Perception 11. No languages."),
 rules:[p("Укус: рукопашная атака +4, досягаемость 5 фт.; 1 колющий урон.","Bite: melee attack +4, reach 5 ft.; 1 Piercing damage.")],
},{
 id:"rat-2024",edition:"2024",name:p("Крыса","Rat"),sourceUrl:"https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=359",
 armorClass:10,hp:1,hitDice:"1d4 − 1",abilities:[2,11,9,2,10,4],challenge:"0",proficiency:2,initiative:0,
 profile:p("Крошечный зверь без мировоззрения. Ходьба и лазание 20 фт.; тёмное зрение 30 фт., пассивное Восприятие 12. Восприятие +2. Языков нет.","Tiny unaligned Beast. Speed and Climb 20 ft.; Darkvision 30 ft., passive Perception 12. Perception +2. No languages."),
 rules:[p("Проворство: выход из досягаемости врага не провоцирует его атаку.","Agile: leaving an enemy’s reach does not provoke an Opportunity Attack."),p("Укус: рукопашная атака +2, досягаемость 5 фт.; 1 колющий урон.","Bite: melee attack +2, reach 5 ft.; 1 Piercing damage.")],
});
RULE_CREATURES.push({
 id:"flying-wonder-2024",edition:"2024",name:p("Летающее диво","Flying Wonder"),sourceUrl:"https://next.dnd.su/bestiary/29385-flying-wonder",
 armorClass:12,hp:2,hitDice:"1d4",abilities:[2,15,10,3,10,1],challenge:"0",proficiency:2,initiative:2,
 profile:p("Крошечный конструкт без мировоззрения. Ходьба 5 фт., полёт 30 фт.; слепое зрение 60 фт., пассивное Восприятие 10. Понимает Общий, но не говорит. Иммунитет к яду, Истощению и Отравлению.","Tiny unaligned Construct. Speed 5 ft., Fly 30 ft.; Blindsight 60 ft., passive Perception 10. Understands Common but cannot speak. Immune to Poison damage, Exhaustion, and Poisoned."),
 rules:[p("Увеличенная грузоподъёмность: несёт до 100 фунтов.","Increased Carrying Capacity: carries up to 100 pounds."),p("Завод: Бессознательно, пока другое существо не заводит его уникальным ключом 1 минуту. Работает 24 часа либо до деактивации действием Использование с касанием ключом; затем снова Бессознательно до нового завода.","Wind-Up: Unconscious until another creature winds it for 1 minute with its unique key. Operates for 24 hours or until deactivated by a Utilize action touching it with that key; then Unconscious until rewound."),p("Перезвон, бонусное действие: выбранный видимый союзник в 60 фт. получает преимущество на следующую проверку характеристики с музыкальным инструментом или инструментами ремонтника до начала следующего хода дива.","Chime, Bonus Action: one visible ally within 60 ft. has Advantage on its next ability check with a Musical Instrument or Tinker’s Tools before the start of the wonder’s next turn."),p("Ускорение, бонусное действие: совершает Рывок.","Speed Up, Bonus Action: takes the Dash action.")],
});

RULE_CREATURES.push({
  "id": "domestic-wonder-2024",
  "edition": "2024",
  "name": {
    "ru": "Домашнее диво",
    "en": "Domestic Wonder"
  },
  "sourceUrl": "https://next.dnd.su/bestiary/29384-domestic-wonder",
  "armorClass": 9,
  "hp": 5,
  "hitDice": "1d8 + 1",
  "abilities": [
    13,
    8,
    13,
    3,
    8,
    1
  ],
  "challenge": "0",
  "proficiency": 2,
  "initiative": -1,
  "profile": {
    "ru": "Средний конструкт без мировоззрения. Скорость 30 фт.; пассивное Восприятие 9. Понимает Общий, но не говорит. Иммунитет к урону ядом, Истощению и Отравлению.",
    "en": "Medium unaligned Construct. Speed 30 ft.; passive Perception 9. Understands Common but cannot speak. Immune to Poison damage, Exhaustion, and Poisoned."
  },
  "rules": [
    {
      "ru": "Механическая целеустремлённость: при снижении хитов до 0 уроном, кроме электрического или критического попадания, совершает спасбросок Телосложения Сл 5 + полученный урон. Успех оставляет 1 хит.",
      "en": "Mechanical Determination: when damage reduces it to 0 HP, unless Lightning damage or a Critical Hit, it makes a Constitution save with DC 5 + the damage taken. Success leaves 1 HP."
    },
    {
      "ru": "Завод: Бессознательно, пока другое существо не заводит его уникальным ключом 1 минуту. Затем работает 10 дней либо до деактивации действием Использование с касанием этим ключом. Деактивированное диво снова Бессознательно до нового завода.",
      "en": "Wind-Up: Unconscious until another creature winds it for 1 minute with its unique key. Operates for 10 days or until a Utilize action deactivates it by touching it with the key. It is then Unconscious until rewound."
    }
  ]
});

RULE_CREATURES.push({
  "id": "raven-2024",
  "edition": "2024",
  "name": {
    "ru": "Ворон",
    "en": "Raven"
  },
  "sourceUrl": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=359",
  "armorClass": 12,
  "hp": 2,
  "hitDice": "1d4",
  "abilities": [
    2,
    14,
    10,
    5,
    13,
    6
  ],
  "challenge": "0",
  "proficiency": 2,
  "initiative": 2,
  "profile": {
    "ru": "Крошечный зверь без мировоззрения. Скорость 10 фт., полёт 50 фт.; Восприятие +3, пассивное Восприятие 13. Языков нет.",
    "en": "Tiny unaligned Beast. Speed 10 ft., Fly 50 ft.; Perception +3, passive Perception 13. No languages."
  },
  "rules": [
    {
      "ru": "Подражание: повторяет услышанные простые звуки. Слушатель распознаёт подражание при успешной проверке Мудрости (Проницательность) Сл 10.",
      "en": "Mimicry: imitates simple sounds it has heard. A listener recognizes the imitation with a successful DC 10 Wisdom (Insight) check."
    },
    {
      "ru": "Клюв: рукопашная атака +4, досягаемость 5 фт.; 1 колющий урон.",
      "en": "Beak: melee attack +4, reach 5 ft.; 1 Piercing damage."
    }
  ]
});

RULE_CREATURES.push({
  "id": "giant-rat-2024",
  "edition": "2024",
  "name": {
    "ru": "Гигантская крыса",
    "en": "Giant Rat"
  },
  "sourceUrl": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=353",
  "armorClass": 13,
  "hp": 7,
  "hitDice": "2d6",
  "abilities": [
    7,
    16,
    11,
    2,
    10,
    4
  ],
  "challenge": "1/8",
  "proficiency": 2,
  "initiative": 3,
  "profile": {
    "ru": "Маленький зверь без мировоззрения. Скорость и лазание 30 фт.; тёмное зрение 60 фт., пассивное Восприятие 12. Восприятие +2, спасброски Ловкости +5. Языков нет.",
    "en": "Small unaligned Beast. Speed and Climb 30 ft.; Darkvision 60 ft., passive Perception 12. Perception +2, Dexterity saves +5. No languages."
  },
  "rules": [
    {
      "ru": "Тактика стаи: преимущество на бросок атаки по существу, если в 5 фт. от цели есть хотя бы один союзник крысы, который не Недееспособен.",
      "en": "Pack Tactics: Advantage on an attack against a creature if an ally of the rat is within 5 ft. of the target and is not Incapacitated."
    },
    {
      "ru": "Укус: рукопашная атака +5, досягаемость 5 фт.; 5 (1d4 + 3) колющего урона.",
      "en": "Bite: melee attack +5, reach 5 ft.; 5 (1d4 + 3) Piercing damage."
    }
  ]
});

RULE_CREATURES.push({
  "id": "swarm-of-rats-2024",
  "edition": "2024",
  "name": {
    "ru": "Рой крыс",
    "en": "Swarm of Rats"
  },
  "sourceUrl": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=362",
  "armorClass": 10,
  "hp": 14,
  "hitDice": "4d8 − 4",
  "abilities": [
    9,
    11,
    9,
    2,
    10,
    3
  ],
  "challenge": "1/4",
  "proficiency": 2,
  "initiative": 0,
  "profile": {
    "ru": "Средний рой Крошечных зверей без мировоззрения. Скорость и лазание 30 фт.; тёмное зрение 30 фт., пассивное Восприятие 10. Спасброски Ловкости +2. Языков нет. Сопротивление дробящему, колющему и рубящему урону. Иммунитет к Очарованию, Испугу, Захвату, Параличу, Окаменению, Сбиванию с ног, Опутыванию и Ошеломлению.",
    "en": "Medium swarm of Tiny unaligned Beasts. Speed and Climb 30 ft.; Darkvision 30 ft., passive Perception 10. Dexterity saves +2. No languages. Resistant to Bludgeoning, Piercing, Slashing. Immune to Charmed, Frightened, Grappled, Paralyzed, Petrified, Prone, Restrained, Stunned."
  },
  "rules": [
    {
      "ru": "Рой может находиться в пространстве другого существа, и наоборот; проходит в отверстие для Крошечной крысы. Не восстанавливает хиты и не получает временные хиты.",
      "en": "The swarm can share another creature’s space and pass through an opening large enough for a Tiny rat. It cannot regain HP or gain Temporary HP."
    },
    {
      "ru": "Укусы: рукопашная атака +2, досягаемость 5 фт.; 5 (2d4) колющего урона, либо 2 (1d4), когда остаётся не больше половины максимума хитов.",
      "en": "Bites: melee attack +2, reach 5 ft.; 5 (2d4) Piercing damage, or 2 (1d4) while at no more than half its maximum HP."
    }
  ]
});

RULE_CREATURES.push({
  "id": "animated-broom-2024",
  "edition": "2024",
  "name": {
    "ru": "Живая метла",
    "en": "Animated Broom"
  },
  "sourceUrl": "https://next.dnd.su/bestiary/21181-animated-broom",
  "armorClass": 15,
  "hp": 14,
  "hitDice": "4d6",
  "abilities": [
    10,
    17,
    10,
    1,
    5,
    1
  ],
  "challenge": "1/4",
  "proficiency": 2,
  "initiative": 5,
  "profile": {
    "ru": "Маленький конструкт без мировоззрения. Скорость 5 фт., полёт 50 фт. (парение). Слепое зрение 60 фт., пассивное Восприятие 7. Языков нет. Иммунитет к психическому урону и яду, Испугу, Истощению, Глухоте, Окаменению, Отравлению, Очарованию и Параличу.",
    "en": "Small unaligned Construct. Speed 5 ft., Fly 50 ft. (hover). Blindsight 60 ft., passive Perception 7. No languages. Immune to Psychic and Poison damage, Frightened, Exhaustion, Deafened, Petrified, Poisoned, Charmed, Paralyzed."
  },
  "rules": [
    {
      "ru": "Облёт: не провоцирует атаки при вылете из досягаемости врага.",
      "en": "Flyby: does not provoke Opportunity Attacks when flying out of an enemy’s reach."
    },
    {
      "ru": "Размашистый удар: рукопашная атака +5, досягаемость 5 фт.; 5 (1d4 + 3) дробящего урона.",
      "en": "Broomstick: melee attack +5, reach 5 ft.; 5 (1d4 + 3) Bludgeoning damage."
    }
  ]
});
