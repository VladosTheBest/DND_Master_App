import type { Bilingual, RuleCreature } from "./rule-creatures";

// Independently worded mechanics from SRD 5.2.1, Animals pp. 345–364.
const p = (ru: string, en: string): Bilingual => ({ru, en});
const beast = (id: string, ru: string, en: string, page: number, armorClass: number, hp: number, hitDice: string, abilities: RuleCreature["abilities"], profile: Bilingual, rules: Bilingual[]): RuleCreature => ({
  id: `${id}-2024`, edition: "2024", name: p(ru,en),
  sourceUrl: `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=${page}`,
  armorClass, hp, hitDice, abilities, challenge: "0", proficiency: 2,
  initiative: Math.floor((abilities[1]-10)/2), profile, rules,
});
const pack = p("Тактика стаи: Преимущество на атаку по существу, если в пределах 5 фт. от него есть союзник зверя, который не Недееспособен.", "Pack Tactics: Advantage on attacks against a creature with an ally of the beast within 5 feet of it, provided that ally is not Incapacitated.");
const climb = p("Паучье лазание: сложные поверхности, включая потолки, преодолеваются без проверки характеристики.", "Spider Climb: climb difficult surfaces, including ceilings, without an ability check.");
const water = p("Дыхание только под водой.", "Breathe only underwater.");
export const FAMILIAR_BEASTS_2024: RuleCreature[] = [
  beast("cat","Кошка","Cat",346,12,2,"1d4",[3,15,10,3,12,7],p("Крошечный Зверь, без мировоззрения. Скорость 40 фт., Лазание 40 фт.; спасбросок Ловкости +4; Внимательность +3, Скрытность +4; Тёмное зрение 60 фт., пассивная Внимательность 13; языков нет.","Tiny unaligned Beast. Speed 40 ft., Climb 40 ft.; Dexterity saves +4; Perception +3, Stealth +4; Darkvision 60 ft., passive Perception 13; no languages."),[
    p("Прыгун: расстояние прыжка определяется Ловкостью вместо Силы.","Jumper: use Dexterity instead of Strength to determine jump distance."),
    p("Царапина: рукопашная атака +4, досягаемость 5 фт.; 1 рубящий урон.","Scratch: melee attack +4, reach 5 ft.; 1 Slashing damage."),
  ]),
  beast("crab","Краб","Crab",347,11,3,"1d4+1",[6,11,12,1,8,2],p("Крошечный Зверь, без мировоззрения. Скорость 20 фт., Плавание 20 фт.; Скрытность +2; Слепое зрение 30 фт., пассивная Внимательность 9; языков нет.","Tiny unaligned Beast. Speed 20 ft., Swim 20 ft.; Stealth +2; Blindsight 30 ft., passive Perception 9; no languages."),[
    p("Амфибия: дышит воздухом и водой.","Amphibious: breathe air and water."),
    p("Клешня: рукопашная атака +2, досягаемость 5 фт.; 1 дробящий урон.","Claw: melee attack +2, reach 5 ft.; 1 Bludgeoning damage."),
  ]),
  beast("deer","Олень","Deer",347,13,4,"1d8",[11,16,11,2,14,5],p("Средний Зверь, без мировоззрения. Скорость 50 фт.; Внимательность +4; Тёмное зрение 60 фт., пассивная Внимательность 14; языков нет.","Medium unaligned Beast. Speed 50 ft.; Perception +4; Darkvision 60 ft., passive Perception 14; no languages."),[
    p("Проворство: выход из досягаемости врага не провоцирует атаку.","Agile: moving out of an enemy's reach does not provoke an Opportunity Attack."),
    p("Таран: рукопашная атака +2, досягаемость 5 фт.; 2 (1d4) дробящего урона.","Ram: melee attack +2, reach 5 ft.; 2 (1d4) Bludgeoning damage."),
  ]),
  beast("eagle","Орёл","Eagle",348,12,4,"1d6+1",[6,15,12,2,14,7],p("Маленький Зверь, без мировоззрения. Скорость 10 фт., Полёт 60 фт.; Внимательность +6, пассивная Внимательность 16; языков нет.","Small unaligned Beast. Speed 10 ft., Fly 60 ft.; Perception +6, passive Perception 16; no languages."),[
    p("Когти: рукопашная атака +4, досягаемость 5 фт.; 4 (1d4+2) рубящего урона.","Talons: melee attack +4, reach 5 ft.; 4 (1d4+2) Slashing damage."),
  ]),
  beast("giant-fire-beetle","Гигантский огненный жук","Giant Fire Beetle",351,13,4,"1d6+1",[8,10,12,1,7,3],p("Маленький Зверь, без мировоззрения. Скорость 30 фт., Лазание 30 фт.; сопротивление огню; Слепое зрение 30 фт., пассивная Внимательность 8; языков нет.","Small unaligned Beast. Speed 30 ft., Climb 30 ft.; Fire Resistance; Blindsight 30 ft., passive Perception 8; no languages."),[
    p("Свечение: яркий свет на 10 фт. и тусклый ещё на 10 фт.","Illumination: Bright Light for 10 ft. and Dim Light for another 10 ft."),
    p("Укус: рукопашная атака +1, досягаемость 5 фт.; 1 урон огнём.","Bite: melee attack +1, reach 5 ft.; 1 Fire damage."),
  ]),
  beast("hawk","Ястреб","Hawk",355,13,1,"1d4-1",[5,16,8,2,14,6],p("Крошечный Зверь, без мировоззрения. Скорость 10 фт., Полёт 60 фт.; Внимательность +6, пассивная Внимательность 16; языков нет.","Tiny unaligned Beast. Speed 10 ft., Fly 60 ft.; Perception +6, passive Perception 16; no languages."),[
    p("Когти: рукопашная атака +5, досягаемость 5 фт.; 1 рубящий урон.","Talons: melee attack +5, reach 5 ft.; 1 Slashing damage."),
  ]),
  beast("hyena","Гиена","Hyena",356,11,5,"1d8+1",[11,13,12,2,12,5],p("Средний Зверь, без мировоззрения. Скорость 50 фт.; Внимательность +3; Тёмное зрение 60 фт., пассивная Внимательность 13; языков нет.","Medium unaligned Beast. Speed 50 ft.; Perception +3; Darkvision 60 ft., passive Perception 13; no languages."),[pack,
    p("Укус: рукопашная атака +2, досягаемость 5 фт.; 3 (1d6) колющего урона.","Bite: melee attack +2, reach 5 ft.; 3 (1d6) Piercing damage."),
  ]),
  beast("lizard","Ящерица","Lizard",357,10,2,"1d4",[2,11,10,1,8,3],p("Крошечный Зверь, без мировоззрения. Скорость 20 фт., Лазание 20 фт.; Тёмное зрение 30 фт., пассивная Внимательность 9; языков нет.","Tiny unaligned Beast. Speed 20 ft., Climb 20 ft.; Darkvision 30 ft., passive Perception 9; no languages."),[climb,
    p("Укус: рукопашная атака +2, досягаемость 5 фт.; 1 колющий урон.","Bite: melee attack +2, reach 5 ft.; 1 Piercing damage."),
  ]),
  beast("octopus","Осьминог","Octopus",357,12,3,"1d6",[4,15,11,3,10,4],p("Маленький Зверь, без мировоззрения. Скорость 5 фт., Плавание 30 фт.; Внимательность +2, Скрытность +6; Тёмное зрение 30 фт., пассивная Внимательность 12; языков нет.","Small unaligned Beast. Speed 5 ft., Swim 30 ft.; Perception +2, Stealth +6; Darkvision 30 ft., passive Perception 12; no languages."),[water,
    p("Сжатие: проходит сквозь пространство шириной 1 дюйм без дополнительных затрат перемещения.","Compression: pass through spaces as narrow as 1 inch without extra movement cost."),
    p("Щупальца: рукопашная атака +4, досягаемость 5 фт.; 1 дробящий урон.","Tentacles: melee attack +4, reach 5 ft.; 1 Bludgeoning damage."),
    p("Чернильное облако, реакция 1/день: когда под водой существо заканчивает ход в пределах 5 фт., выпускает чернила в Куб с ребром 5 фт. вокруг себя и перемещается до своей скорости Плавания. Куб сильно заслонён на 1 минуту либо пока течение или подобный эффект не рассеет чернила.","Ink Cloud, Reaction 1/day: when a creature ends its turn within 5 ft. underwater, fill a 5-ft. Cube centered on the octopus with ink and move up to its Swim Speed. The Cube is Heavily Obscured for 1 minute or until dispersed by a strong current or similar effect."),
  ]),
  beast("piranha","Пиранья","Piranha",358,13,1,"1d4-1",[2,16,9,1,7,2],p("Крошечный Зверь, без мировоззрения. Скорость 5 фт., Плавание 40 фт.; Тёмное зрение 60 фт., пассивная Внимательность 8; языков нет.","Tiny unaligned Beast. Speed 5 ft., Swim 40 ft.; Darkvision 60 ft., passive Perception 8; no languages."),[water,
    p("Укус: рукопашная атака +5, досягаемость 5 фт., с Преимуществом, если у цели неполные хиты; 1 колющий урон.","Bite: melee attack +5, reach 5 ft., with Advantage if the target is below its Hit Point maximum; 1 Piercing damage."),
  ]),
  beast("scorpion","Скорпион","Scorpion",360,11,1,"1d4-1",[2,11,8,1,8,2],p("Крошечный Зверь, без мировоззрения. Скорость 10 фт.; Слепое зрение 10 фт., пассивная Внимательность 9; языков нет.","Tiny unaligned Beast. Speed 10 ft.; Blindsight 10 ft., passive Perception 9; no languages."),[
    p("Жало: рукопашная атака +2, досягаемость 5 фт.; 1 колющий урон и 3 (1d6) урона ядом.","Sting: melee attack +2, reach 5 ft.; 1 Piercing plus 3 (1d6) Poison damage."),
  ]),
  beast("seahorse","Морской конёк","Seahorse",361,12,1,"1d4-1",[1,12,8,1,10,2],p("Крошечный Зверь, без мировоззрения. Скорость 5 фт., Плавание 20 фт.; Внимательность +2, Скрытность +5; пассивная Внимательность 12; языков нет. Опыт 0.","Tiny unaligned Beast. Speed 5 ft., Swim 20 ft.; Perception +2, Stealth +5; passive Perception 12; no languages. XP 0."),[water,
    p("Пузырьковый рывок, действие: под водой перемещается до своей скорости Плавания, не провоцируя атак.","Bubble Dash, Action: while underwater, move up to its Swim Speed without provoking Opportunity Attacks."),
  ]),
  beast("spider","Паук","Spider",361,12,1,"1d4-1",[2,14,8,1,10,2],p("Крошечный Зверь, без мировоззрения. Скорость 20 фт., Лазание 20 фт.; Скрытность +4; Тёмное зрение 30 фт., пассивная Внимательность 10; языков нет.","Tiny unaligned Beast. Speed 20 ft., Climb 20 ft.; Stealth +4; Darkvision 30 ft., passive Perception 10; no languages."),[climb,
    p("Хождение по паутине: игнорирует ограничения движения от паутин и знает местоположение других существ, касающихся той же паутины.","Web Walker: ignore movement restrictions from webs and know the location of other creatures touching the same web."),
    p("Укус: рукопашная атака +4, досягаемость 5 фт.; 1 колющий урон и 2 (1d4) урона ядом.","Bite: melee attack +4, reach 5 ft.; 1 Piercing plus 2 (1d4) Poison damage."),
  ]),
  beast("vulture","Стервятник","Vulture",363,10,5,"1d8+1",[7,10,13,2,12,4],p("Средний Зверь, без мировоззрения. Скорость 10 фт., Полёт 50 фт.; Внимательность +3, пассивная Внимательность 13; языков нет.","Medium unaligned Beast. Speed 10 ft., Fly 50 ft.; Perception +3, passive Perception 13; no languages."),[pack,
    p("Клюв: рукопашная атака +2, досягаемость 5 фт.; 2 (1d4) колющего урона.","Beak: melee attack +2, reach 5 ft.; 2 (1d4) Piercing damage."),
  ]),
];

/** All CR 0 Beasts in the SRD 5.2.1 Animals appendix, plus the reviewed Giant Fly. */
export const FAMILIAR_FORM_IDS_2024 = [
  ...FAMILIAR_BEASTS_2024.map(beast => beast.id),
  ...["baboon","badger","bat","frog","goat","jackal","owl","rat","raven","weasel","giant-fly"].map(id => `${id}-2024`),
];
