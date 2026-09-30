import type { Bilingual, RuleCreature } from "./rule-creatures";

// Independently worded mechanics from the edition-specific SRD 5.1 stat blocks.
const p = (ru: string, en: string): Bilingual => ({ru,en});
const beast = (id: string, ru: string, en: string, page: number, armorClass: number, hp: number, hitDice: string, abilities: RuleCreature["abilities"], profile: Bilingual, rules: Bilingual[]): RuleCreature => ({
  id:`${id}-2014`,edition:"2014",name:p(ru,en),sourceUrl:`https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf#page=${page}`,
  armorClass,hp,hitDice,abilities,challenge:id === "poisonous-snake" ? "1/8" : "0",proficiency:2,initiative:Math.floor((abilities[1]-10)/2),profile,rules,
});
const water=p("Дыхание только под водой.","Breathe only underwater.");
export const FAMILIAR_BEASTS_2014: RuleCreature[] = [
  beast("cat","Кошка","Cat",369,12,2,"1d4",[3,15,10,3,12,7],p("Крошечный Зверь, без мировоззрения. Скорость 40 фт., лазание 30 фт.; Внимательность +3, Скрытность +4; пассивная Внимательность 13; языков нет.","Tiny unaligned Beast. Speed 40 ft., climb 30 ft.; Perception +3, Stealth +4; passive Perception 13; no languages."),[
    p("Острый нюх: Преимущество на проверки Мудрости (Внимательность), полагающиеся на обоняние.","Keen Smell: Advantage on Wisdom (Perception) checks relying on smell."),
    p("Когти: рукопашная атака оружием +0, досягаемость 5 фт., одна цель; 1 рубящий урон.","Claws: melee weapon attack +0, reach 5 ft., one target; 1 Slashing damage."),
  ]),
  beast("crab","Краб","Crab",370,11,2,"1d4",[2,11,10,1,8,2],p("Крошечный Зверь, без мировоззрения. Природный доспех. Скорость 20 фт., плавание 20 фт.; Скрытность +2; Слепое зрение 30 фт., пассивная Внимательность 9; языков нет.","Tiny unaligned Beast. Natural armor. Speed 20 ft., swim 20 ft.; Stealth +2; Blindsight 30 ft., passive Perception 9; no languages."),[
    p("Амфибия: дышит воздухом и водой.","Amphibious: breathe air and water."),
    p("Клешня: рукопашная атака оружием +0, досягаемость 5 фт., одна цель; 1 дробящий урон.","Claw: melee weapon attack +0, reach 5 ft., one target; 1 Bludgeoning damage."),
  ]),
  beast("hawk","Ястреб","Hawk",382,13,1,"1d4-1",[5,16,8,2,14,6],p("Крошечный Зверь, без мировоззрения. Скорость 10 фт., полёт 60 фт.; Внимательность +4, пассивная Внимательность 14; языков нет.","Tiny unaligned Beast. Speed 10 ft., fly 60 ft.; Perception +4, passive Perception 14; no languages."),[
    p("Острое зрение: Преимущество на проверки Мудрости (Внимательность), полагающиеся на зрение.","Keen Sight: Advantage on Wisdom (Perception) checks relying on sight."),
    p("Когти: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 1 рубящий урон.","Talons: melee weapon attack +5, reach 5 ft., one target; 1 Slashing damage."),
  ]),
  beast("lizard","Ящерица","Lizard",383,10,2,"1d4",[2,11,10,1,8,3],p("Крошечный Зверь, без мировоззрения. Скорость 20 фт., лазание 20 фт.; Тёмное зрение 30 фт., пассивная Внимательность 9; языков нет.","Tiny unaligned Beast. Speed 20 ft., climb 20 ft.; Darkvision 30 ft., passive Perception 9; no languages."),[
    p("Укус: рукопашная атака оружием +0, досягаемость 5 фт., одна цель; 1 колющий урон.","Bite: melee weapon attack +0, reach 5 ft., one target; 1 Piercing damage."),
  ]),
  beast("octopus","Осьминог","Octopus",384,12,3,"1d6",[4,15,11,3,10,4],p("Маленький Зверь, без мировоззрения. Скорость 5 фт., плавание 30 фт.; Внимательность +2, Скрытность +4; Тёмное зрение 30 фт., пассивная Внимательность 12; языков нет.","Small unaligned Beast. Speed 5 ft., swim 30 ft.; Perception +2, Stealth +4; Darkvision 30 ft., passive Perception 12; no languages."),[water,
    p("Задержка дыхания вне воды до 30 минут. Под водой Преимущество на проверки Ловкости (Скрытность).","Hold breath out of water for 30 minutes. Advantage on Dexterity (Stealth) checks underwater."),
    p("Щупальца: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 1 дробящий урон и Схваченный, Сл высвобождения 10. До конца захвата нельзя использовать щупальца против другой цели.","Tentacles: melee weapon attack +4, reach 5 ft., one target; 1 Bludgeoning damage and Grappled, escape DC 10. Cannot use tentacles against another target until this grapple ends."),
    p("Чернильное облако, действие, восстановление после короткого или долгого отдыха: под водой создаёт облако радиусом 5 фт. вокруг себя. Область сильно заслонена на 1 минуту, пока значительное течение не рассеет чернила. Выпустив чернила, может бонусным действием совершить Рывок.","Ink Cloud, Action, recharges after a Short or Long Rest: underwater, create an ink cloud with a 5-ft. radius around itself. The area is heavily obscured for 1 minute unless dispersed by a significant current. After releasing the ink, it can Dash as a bonus action."),
  ]),
  beast("owl","Сова","Owl",385,11,1,"1d4-1",[3,13,8,2,12,7],p("Крошечный Зверь, без мировоззрения. Скорость 5 фт., полёт 60 фт.; Внимательность +3, Скрытность +3; Тёмное зрение 120 фт., пассивная Внимательность 13; языков нет.","Tiny unaligned Beast. Speed 5 ft., fly 60 ft.; Perception +3, Stealth +3; Darkvision 120 ft., passive Perception 13; no languages."),[
    p("Пролёт: покидая досягаемость врага в полёте, не провоцирует атак. Острые слух и зрение: Преимущество на проверки Мудрости (Внимательность), полагающиеся на слух или зрение.","Flyby: flying out of an enemy's reach does not provoke Opportunity Attacks. Keen Hearing and Sight: Advantage on Wisdom (Perception) checks relying on hearing or sight."),
    p("Когти: рукопашная атака оружием +3, досягаемость 5 фт., одна цель; 1 рубящий урон.","Talons: melee weapon attack +3, reach 5 ft., one target; 1 Slashing damage."),
  ]),
  beast("poisonous-snake","Ядовитая змея","Poisonous Snake",386,13,2,"1d4",[2,16,11,1,10,3],p("Крошечный Зверь, без мировоззрения. Скорость 30 фт., плавание 30 фт.; Слепое зрение 10 фт., пассивная Внимательность 10; языков нет.","Tiny unaligned Beast. Speed 30 ft., swim 30 ft.; Blindsight 10 ft., passive Perception 10; no languages."),[
    p("Укус: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 1 колющий урон. Цель делает спасбросок Телосложения Сл 10: 5 (2d4) урона ядом при провале, половина при успехе.","Bite: melee weapon attack +5, reach 5 ft., one target; 1 Piercing damage. Target makes a DC 10 Constitution save: 5 (2d4) Poison damage on failure, half on success."),
  ]),
  beast("quipper","Пиранья","Quipper",387,13,1,"1d4-1",[2,16,9,1,7,2],p("Крошечный Зверь, без мировоззрения. Скорость 0 фт., плавание 40 фт.; Тёмное зрение 60 фт., пассивная Внимательность 8; языков нет.","Tiny unaligned Beast. Speed 0 ft., swim 40 ft.; Darkvision 60 ft., passive Perception 8; no languages."),[water,
    p("Кровавое безумие: Преимущество на рукопашные атаки по существам с неполными хитами.","Blood Frenzy: Advantage on melee attacks against creatures below their Hit Point maximum."),
    p("Укус: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 1 колющий урон.","Bite: melee weapon attack +5, reach 5 ft., one target; 1 Piercing damage."),
  ]),
  beast("raven","Ворон","Raven",387,12,1,"1d4-1",[2,14,8,2,12,6],p("Крошечный Зверь, без мировоззрения. Скорость 10 фт., полёт 50 фт.; Внимательность +3, пассивная Внимательность 13; языков нет.","Tiny unaligned Beast. Speed 10 ft., fly 50 ft.; Perception +3, passive Perception 13; no languages."),[
    p("Подражание: воспроизводит простые услышанные звуки. Успешная проверка Мудрости (Проницательность) Сл 10 позволяет слушателю распознать имитацию.","Mimicry: imitate simple sounds previously heard. A listener can recognize an imitation with a successful DC 10 Wisdom (Insight) check."),
    p("Клюв: рукопашная атака оружием +4, досягаемость 5 фт., одна цель; 1 колющий урон.","Beak: melee weapon attack +4, reach 5 ft., one target; 1 Piercing damage."),
  ]),
  beast("sea-horse","Морской конёк","Sea Horse",389,11,1,"1d4-1",[1,12,8,1,10,2],p("Крошечный Зверь, без мировоззрения. Скорость 0 фт., плавание 20 фт.; пассивная Внимательность 10; языков нет. Опыт 0.","Tiny unaligned Beast. Speed 0 ft., swim 20 ft.; passive Perception 10; no languages. XP 0."),[water]),
  beast("spider","Паук","Spider",389,12,1,"1d4-1",[2,14,8,1,10,2],p("Крошечный Зверь, без мировоззрения. Скорость 20 фт., лазание 20 фт.; Скрытность +4; Тёмное зрение 30 фт., пассивная Внимательность 10; языков нет.","Tiny unaligned Beast. Speed 20 ft., climb 20 ft.; Stealth +4; Darkvision 30 ft., passive Perception 10; no languages."),[
    p("Паучье лазание: сложные поверхности, включая потолки, преодолевает без проверки характеристики. Касаясь паутины, знает точное местоположение других существ на ней; игнорирует ограничения движения от паутин.","Spider Climb: climb difficult surfaces, including ceilings, without an ability check. While touching a web, know the exact location of other creatures touching it; ignore movement restrictions from webs."),
    p("Укус: рукопашная атака оружием +4, досягаемость 5 фт., одно существо; 1 колющий урон. Провал спасброска Телосложения Сл 9 дополнительно наносит 2 (1d4) урона ядом.","Bite: melee weapon attack +4, reach 5 ft., one creature; 1 Piercing damage. A failed DC 9 Constitution save deals an additional 2 (1d4) Poison damage."),
  ]),
  beast("weasel","Ласка","Weasel",392,13,1,"1d4-1",[3,16,8,2,12,3],p("Крошечный Зверь, без мировоззрения. Скорость 30 фт.; Внимательность +3, Скрытность +5; пассивная Внимательность 13; языков нет.","Tiny unaligned Beast. Speed 30 ft.; Perception +3, Stealth +5; passive Perception 13; no languages."),[
    p("Острые слух и нюх: Преимущество на проверки Мудрости (Внимательность), полагающиеся на слух или обоняние.","Keen Hearing and Smell: Advantage on Wisdom (Perception) checks relying on hearing or smell."),
    p("Укус: рукопашная атака оружием +5, досягаемость 5 фт., одна цель; 1 колющий урон.","Bite: melee weapon attack +5, reach 5 ft., one target; 1 Piercing damage."),
  ]),
];
export const FAMILIAR_FORM_IDS_2014 = [...FAMILIAR_BEASTS_2014.map(beast => beast.id), "bat-2014", "frog-2014", "rat-2014"];
