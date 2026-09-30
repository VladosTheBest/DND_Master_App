import type { Edition } from "./rules-data";
import { BARD_SPIRIT_TABLES } from "./bard-spirit-tables";
import { ADDITIONAL_POTIONS_2024 } from "./additional-potions-2024";
export type RuleLanguage = "ru" | "en";
export interface RandomEffectRow {
  from: number;
  to: number;
  text: Record<RuleLanguage, string>;
  spellIds?: string[];
  creatureIds?: string[];
  itemIds?: string[];
  subtable?: RandomEffectTable;
}
export interface RandomEffectTable {
  id: string;
  edition: Edition;
  die: number;
  dieLabel?: Record<RuleLanguage, string>;
  name: Record<RuleLanguage, string>;
  note?: Record<RuleLanguage, string>;
  sourceUrl: string;
  checkedAt: string;
  rows: RandomEffectRow[];
}
const row = (
  from: number,
  to: number,
  ru: string,
  en: string,
  extras: Partial<RandomEffectRow> = {},
): RandomEffectRow => ({ from, to, text: { ru, en }, ...extras });
const oldSource = "https://dnd.su/class/101-sorcerer/#origin.wild-magic";
const teleportSource = "https://next.dnd.su/spells/10673-teleport";
const teleportDirection: RandomEffectTable = {
  id: "teleport-direction-2024", edition: "2024", die: 8,
  name: { ru: "Телепортация: направление промаха", en: "Teleport: Off-Target Direction" },
  sourceUrl: teleportSource, checkedAt: "2026-09-30",
  rows: [["Восток", "East"], ["Юго-восток", "Southeast"], ["Юг", "South"], ["Юго-запад", "Southwest"], ["Запад", "West"], ["Северо-запад", "Northwest"], ["Север", "North"], ["Северо-восток", "Northeast"]].map(([ru, en], i) => row(i + 1, i + 1, ru, en))
};
const teleportTables: RandomEffectTable[] = ([
  ["circle", "Постоянный круг", "Permanent Circle", [0, 0, 0, 100]],
  ["object", "Связанный предмет", "Linked Object", [0, 0, 0, 100]],
  ["familiar", "Очень знакомое", "Very Familiar", [5, 13, 24, 100]],
  ["casual", "Изредка видимое", "Seen Casually", [33, 43, 53, 100]],
  ["once", "Виденное один раз или описанное", "Viewed Once or Described", [43, 53, 73, 100]],
  ["false", "Ложное место", "False Destination", [50, 100, 100, 100]],
] as const).map(([kind, ru, en, ends]) => {
  const descriptions = [
    ["Неудача: каждое перемещаемое существо или предмет получает 3d10 силового урона; мастер снова бросает по этой таблице. Повторные неудачи снова наносят урон.", "Mishap: each transported creature or object takes 3d10 Force damage; the DM rolls on this table again. Repeated mishaps deal damage each time."],
    ["Похожее место: ближайшее другое место, визуально или тематически сходное с целью.", "Similar Area: the nearest different location visually or thematically resembling the destination."],
    ["Мимо цели: 2d12 миль от места назначения; направление определите по вложенной таблице d8.", "Off Target: 2d12 miles from the destination; use the nested d8 direction table."],
    ["Точно в цель: появитесь в выбранном месте.", "On Target: arrive at the intended destination."]
  ];
  let previous = 0;
  const rows: RandomEffectRow[] = [];
  ends.forEach((end, i) => {
    if (end > previous) rows.push(row(previous + 1, end, descriptions[i][0], descriptions[i][1], i === 2 ? { subtable: teleportDirection } : {}));
    previous = end;
  });
  return { id: `teleport-${kind}-2024`, edition: "2024", die: 100, name: { ru: `Телепортация: ${ru}`, en: `Teleport: ${en}` }, sourceUrl: teleportSource, checkedAt: "2026-09-30", rows };
});
const newSource = "https://next.dnd.su/class/sorcerer/wild-surges";
const oldTeleportSource = "https://dnd.su/spells/367-teleport/";
const oldTeleportDirection: RandomEffectTable = {
  id: "teleport-direction-2014", edition: "2014", die: 8,
  name: { ru: "Телепортация: направление промаха", en: "Teleport: Off-Target Direction" },
  sourceUrl: oldTeleportSource, checkedAt: "2026-09-30",
  rows: [["Север", "North"], ["Северо-восток", "Northeast"], ["Восток", "East"], ["Юго-восток", "Southeast"], ["Юг", "South"], ["Юго-запад", "Southwest"], ["Запад", "West"], ["Северо-запад", "Northwest"]].map(([ru, en], i) => row(i + 1, i + 1, ru, en)),
};
// Arrival ranges are identical; the distance formula and compass order are not.
const oldTeleportTables: RandomEffectTable[] = teleportTables.map(table => ({
  ...table, id: table.id.replace("2024", "2014"), edition: "2014", sourceUrl: oldTeleportSource,
  rows: table.rows.map(entry => entry.subtable ? {
    ...entry,
    text: { ru: "Мимо цели: 1d10 × 1d10 процентов запланированной дальности путешествия; направление по вложенной таблице d8.", en: "Off Target: 1d10 × 1d10 percent of the intended travel distance; use the nested d8 direction table." },
    subtable: oldTeleportDirection,
  } : { ...entry }),
}));
const old: RandomEffectTable = {
  id: "sorcerer-wild-2014",
  edition: "2014",
  die: 100,
  name: { ru: "Волна дикой магии", en: "Wild Magic Surge" },
  sourceUrl: oldSource,
  checkedAt: "2026-09-29",
  note: {
    ru: "d100: «00» означает 100. Заклинание волны не требует концентрации и при обычной концентрации длится полное время. Самостоятельное изложение механики, неофициальный перевод.",
    en: "On d100, 00 means 100. A surge spell needs no Concentration; if it normally requires Concentration, it lasts its full duration. Independently worded mechanical reference.",
  },
  rows: [
    row(
      1,
      2,
      "На протяжении 1 минуты бросайте эту таблицу в начале каждого своего хода; результат 01–02 игнорируйте.",
      "For 1 minute, roll here at the start of each of your turns; ignore results 01–02.",
    ),
    row(
      3,
      4,
      "На 1 минуту вы видите невидимых существ в пределах линии обзора.",
      "For 1 minute, you see Invisible creatures to which you have line of sight.",
    ),
    row(
      5,
      6,
      "В свободном месте в 5 фт. появляется модрон, которого выбирает и контролирует мастер. Исчезает через 1 минуту.",
      "A DM-selected and DM-controlled modron appears in an unoccupied space within 5 feet, disappearing after 1 minute.",
      {
        creatureIds: [
          "monodrone-2014",
          "duodrone-2014",
          "tridrone-2014",
          "quadrone-2014",
          "pentadrone-2014",
        ],
      },
    ),
    row(
      7,
      8,
      "Сотворите Огненный шар 3-го круга с центром на себе.",
      "Cast Fireball at level 3, centered on yourself.",
      { spellIds: ["fireball-2014"] },
    ),
    row(
      9,
      10,
      "Сотворите Волшебную стрелу 5-го круга.",
      "Cast Magic Missile at level 5.",
      { spellIds: ["magic-missile-2014"] },
    ),
    row(
      11,
      12,
      "Бросьте d10: нечётное значение уменьшает рост на столько дюймов, чётное увеличивает на столько же.",
      "Roll d10: an odd result reduces your height by that many inches; an even result increases it by that many inches.",
    ),
    row(
      13,
      14,
      "Сотворите Смятение с центром на себе.",
      "Cast Confusion centered on yourself.",
      { spellIds: ["confusion-2014"] },
    ),
    row(
      15,
      16,
      "На протяжении 1 минуты в начале каждого своего хода восстанавливайте 5 хитов.",
      "For 1 minute, regain 5 HP at the start of each of your turns.",
    ),
    row(
      17,
      18,
      "Появляется борода из перьев. Она сохраняется до вашего чихания, после которого перья разлетаются.",
      "A feather beard grows and remains until you sneeze, scattering the feathers.",
    ),
    row(
      19,
      20,
      "Сотворите Скольжение с центром на себе.",
      "Cast Grease centered on yourself.",
      { spellIds: ["grease-2014"] },
    ),
    row(
      21,
      22,
      "Следующее ваше заклинание в течение 1 минуты, требующее спасброска, заставляет цели совершать эти спасброски с помехой.",
      "Creatures have Disadvantage on saves against the next save-requiring spell you cast within 1 minute.",
    ),
    row(
      23,
      24,
      "Кожа становится ярко-синей; Снятие проклятия прекращает изменение.",
      "Your skin becomes bright blue; Remove Curse ends this change.",
      { spellIds: ["remove-curse-2014"] },
    ),
    row(
      25,
      26,
      "На 1 минуту появляется глаз на лбу: преимущество проверкам Восприятия, использующим зрение.",
      "For 1 minute, an eye on your forehead gives Advantage on sight-based Perception checks.",
    ),
    row(
      27,
      28,
      "На 1 минуту заклинания со временем сотворения в действие можно сотворять бонусным действием.",
      "For 1 minute, spells with an action casting time can instead be cast as a Bonus Action.",
    ),
    row(
      29,
      30,
      "Телепортируйтесь до 60 фт. в выбранное видимое свободное место.",
      "Teleport up to 60 feet to a visible unoccupied space you choose.",
    ),
    row(
      31,
      32,
      "Вы на Астральном плане до конца своего следующего хода; затем вернитесь в прежнее место либо ближайшее свободное.",
      "Visit the Astral Plane until the end of your next turn, then return to your previous space or the nearest unoccupied space.",
    ),
    row(
      33,
      34,
      "Следующее ваше наносящее урон заклинание в течение 1 минуты наносит максимальный урон вместо броска костей.",
      "The next damaging spell you cast within 1 minute deals maximum damage instead of rolling its damage dice.",
    ),
    row(
      35,
      36,
      "Бросьте d10: нечётное значение уменьшает возраст на столько лет (не младше 1 года), чётное увеличивает на столько лет.",
      "Roll d10: an odd result makes you that many years younger (minimum age 1); an even result makes you that many years older.",
    ),
    row(
      37,
      38,
      "В свободных местах в 60 фт. появляются 1d6 фламфов под контролем мастера. Они испуганы вами и исчезнут через 1 минуту.",
      "1d6 DM-controlled flumphs appear in unoccupied spaces within 60 feet. They are Frightened of you and disappear after 1 minute.",
      { creatureIds: ["flumph-2014"] },
    ),
    row(39, 40, "Восстановите 2d10 хитов.", "Regain 2d10 HP."),
    row(
      41,
      42,
      "До начала следующего хода вы — растение в горшке: недееспособны и уязвимы ко всему урону. При 0 хитов горшок разбивается и возвращается ваш облик.",
      "Until your next turn starts, you are a potted plant: Incapacitated and Vulnerable to all damage. At 0 HP the pot breaks and your normal form returns.",
    ),
    row(
      43,
      44,
      "На протяжении 1 минуты в каждый свой ход можно бонусным действием телепортироваться до 20 фт.",
      "For 1 minute, on each of your turns you may use a Bonus Action to teleport up to 20 feet.",
    ),
    row(45, 46, "Сотворите Левитацию на себя.", "Cast Levitate on yourself.", {
      spellIds: ["levitate-2014"],
    }),
    row(
      47,
      48,
      "В 5 фт. появляется единорог под контролем мастера; он исчезнет через 1 минуту.",
      "A DM-controlled unicorn appears within 5 feet and disappears after 1 minute.",
      { creatureIds: ["unicorn-2014"] },
    ),
    row(
      49,
      50,
      "На 1 минуту вы не можете говорить; попытки речи создают розовые пузырьки.",
      "For 1 minute you cannot speak; attempts produce pink bubbles.",
    ),
    row(
      51,
      52,
      "На 1 минуту получите +2 КД и иммунитет к Волшебной стреле.",
      "For 1 minute gain +2 AC and immunity to Magic Missile.",
      { spellIds: ["magic-missile-2014"] },
    ),
    row(
      53,
      54,
      "Алкоголь не действует на вас следующие 5d6 дней.",
      "Alcohol has no effect on you for 5d6 days.",
    ),
    row(
      55,
      56,
      "Все волосы выпадают; восстановятся через 24 часа.",
      "All your hair falls out and regrows within 24 hours.",
    ),
    row(
      57,
      58,
      "На 1 минуту ваше касание поджигает горючие предметы, которые другое существо не несёт и не носит.",
      "For 1 minute, your touch ignites flammable objects not worn or carried by another creature.",
    ),
    row(
      59,
      60,
      "Восстановите потраченную ячейку самого низкого доступного круга.",
      "Recover your lowest-level expended spell slot.",
    ),
    row(
      61,
      62,
      "Следующую 1 минуту любая ваша речь — крик.",
      "For 1 minute, you must shout whenever you speak.",
    ),
    row(
      63,
      64,
      "Сотворите Туманное облако с центром на себе.",
      "Cast Fog Cloud centered on yourself.",
      { spellIds: ["fog-cloud-2014"] },
    ),
    row(
      65,
      66,
      "До трёх выбранных существ в 30 фт. получают по 4d10 урона электричеством.",
      "Up to three creatures you choose within 30 feet each take 4d10 Lightning damage.",
    ),
    row(
      67,
      68,
      "До конца следующего своего хода вы испуганы ближайшим существом.",
      "You are Frightened of the nearest creature until the end of your next turn.",
    ),
    row(
      69,
      70,
      "Все существа в 30 фт. невидимы на 1 минуту. Для каждого невидимость заканчивается при его атаке или сотворении заклинания.",
      "All creatures within 30 feet become Invisible for 1 minute; each loses this effect upon attacking or casting a spell.",
    ),
    row(
      71,
      72,
      "Сопротивление всему урону на 1 минуту.",
      "Resistance to all damage for 1 minute.",
    ),
    row(
      73,
      74,
      "Случайное существо в 60 фт. отравлено на 1d4 часа.",
      "A random creature within 60 feet is Poisoned for 1d4 hours.",
    ),
    row(
      75,
      76,
      "На 1 минуту яркий свет от вас распространяется на 30 фт. Закончившее ход в 5 фт. существо ослеплено до конца своего следующего хода.",
      "For 1 minute you emit Bright Light for 30 feet. A creature ending its turn within 5 feet is Blinded until the end of its next turn.",
    ),
    row(
      77,
      78,
      "Сотворите Превращение на себя; при провале спасброска станете овцой на время заклинания.",
      "Cast Polymorph on yourself; a failed save turns you into a sheep for its duration.",
      { spellIds: ["polymorph-2014"], creatureIds: ["sheep-2014"] },
    ),
    row(
      79,
      80,
      "На 1 минуту в 10 фт. от вас появляются иллюзорные бабочки и лепестки.",
      "For 1 minute, illusory butterflies and petals fill the air within 10 feet.",
    ),
    row(
      81,
      82,
      "Немедленно совершите одно дополнительное действие.",
      "Immediately take one additional action.",
    ),
    row(
      83,
      84,
      "Каждое существо в 30 фт. получает 1d10 некротического урона; вы восстанавливаете хиты на общую сумму причинённого урона.",
      "Every creature within 30 feet takes 1d10 Necrotic damage; regain HP equal to the total damage dealt.",
    ),
    row(85, 86, "Сотворите Отражения.", "Cast Mirror Image.", {
      spellIds: ["mirror-image-2014"],
    }),
    row(
      87,
      88,
      "Сотворите Полёт на случайное существо в 60 фт.",
      "Cast Fly on a random creature within 60 feet.",
      { spellIds: ["fly-2014"] },
    ),
    row(
      89,
      90,
      "На 1 минуту вы невидимы и неслышимы другим. Эффект заканчивается после вашей атаки или сотворения заклинания.",
      "For 1 minute you are Invisible and inaudible to others. Attacking or casting a spell ends the effect.",
    ),
    row(
      91,
      92,
      "Смерть в течение следующей 1 минуты немедленно возвращает вас к жизни как Реинкарнация.",
      "If you die within 1 minute, immediately return to life as with Reincarnate.",
      { spellIds: ["reincarnate-2014"] },
    ),
    row(
      93,
      94,
      "На 1 минуту размер увеличивается на одну категорию.",
      "Your size increases by one category for 1 minute.",
    ),
    row(
      95,
      96,
      "Вы и все существа в 30 фт. уязвимы к колющему урону на 1 минуту.",
      "You and all creatures within 30 feet are Vulnerable to Piercing damage for 1 minute.",
    ),
    row(
      97,
      98,
      "На 1 минуту вокруг вас звучит тихая неземная музыка.",
      "Soft otherworldly music surrounds you for 1 minute.",
    ),
    row(
      99,
      100,
      "Восстановите все потраченные очки чародейства.",
      "Recover all expended Sorcery Points.",
    ),
  ],
};

const sub = (
  id: string,
  die: number,
  ru: string,
  en: string,
  rows: RandomEffectRow[],
): RandomEffectTable => ({
  id,
  die,
  edition: "2024",
  name: { ru, en },
  rows,
  sourceUrl: newSource,
  checkedAt: "2026-09-29",
});
const appearance = sub(
  "sorcerer-wild-2024-appearance",
  8,
  "Проявление всплеска",
  "Surge manifestation",
  [
    row(
      1,
      1,
      "На 1 минуту тихая музыка слышна вам и существам в 5 фт.",
      "For 1 minute, quiet music is audible to you and creatures within 5 feet.",
    ),
    row(
      2,
      2,
      "На 1 минуту размер увеличивается на одну категорию.",
      "Increase your size by one category for 1 minute.",
    ),
    row(
      3,
      3,
      "Борода из перьев сохраняется до чихания; затем перья разлетаются и исчезают.",
      "A feather beard lasts until you sneeze; its feathers then scatter and vanish.",
    ),
    row(
      4,
      4,
      "В течение 1 минуты говорите только криком.",
      "For 1 minute, you must shout when speaking.",
    ),
    row(
      5,
      5,
      "На 1 минуту в воздухе в 10 фт. от вас порхают иллюзорные бабочки.",
      "For 1 minute, illusory butterflies flutter within 10 feet.",
    ),
    row(
      6,
      6,
      "На 1 минуту глаз на лбу даёт преимущество проверкам Восприятия.",
      "For 1 minute, a forehead eye gives Advantage on Perception checks.",
    ),
    row(
      7,
      7,
      "На 1 минуту речь сопровождается розовыми пузырьками; говорить можно.",
      "For 1 minute, speech produces pink bubbles; you can still speak.",
    ),
    row(
      8,
      8,
      "Кожа ярко-голубая 24 часа либо до Снятия проклятия.",
      "Skin turns bright blue for 24 hours or until Remove Curse ends it.",
      { spellIds: ["remove-curse-2024"] },
    ),
  ],
);
const randomSpell = sub(
  "sorcerer-wild-2024-spell",
  10,
  "Заклинание всплеска",
  "Surge spell",
  [
    row(1, 1, "Сотворите Смятение.", "Cast Confusion.", {
      spellIds: ["confusion-2024"],
    }),
    row(2, 2, "Сотворите Огненный шар.", "Cast Fireball.", {
      spellIds: ["fireball-2024"],
    }),
    row(3, 3, "Сотворите Туманное облако.", "Cast Fog Cloud.", {
      spellIds: ["fog-cloud-2024"],
    }),
    row(
      4,
      4,
      "Сотворите Полёт на случайное существо в 60 фт.",
      "Cast Fly on a random creature within 60 feet.",
      { spellIds: ["fly-2024"] },
    ),
    row(5, 5, "Сотворите Смазывание.", "Cast Grease.", {
      spellIds: ["grease-2024"],
    }),
    row(6, 6, "Сотворите Левитацию на себя.", "Cast Levitate on yourself.", {
      spellIds: ["levitate-2024"],
    }),
    row(
      7,
      7,
      "Сотворите Волшебную стрелу 5-го круга.",
      "Cast Magic Missile at level 5.",
      { spellIds: ["magic-missile-2024"] },
    ),
    row(8, 8, "Сотворите Отражения.", "Cast Mirror Image.", {
      spellIds: ["mirror-image-2024"],
    }),
    row(
      9,
      9,
      "Сотворите Превращение на себя; провал спасброска превращает вас в козла.",
      "Cast Polymorph on yourself; a failed save turns you into a goat.",
      { spellIds: ["polymorph-2024"], creatureIds: ["goat-2024"] },
    ),
    row(10, 10, "Сотворите Видение невидимого.", "Cast See Invisibility.", {
      spellIds: ["see-invisibility-2024"],
    }),
  ],
);
const modern: RandomEffectTable = {
  id: "sorcerer-wild-2024",
  edition: "2024",
  die: 100,
  name: { ru: "Всплески дикой магии", en: "Wild Magic Surge" },
  sourceUrl: newSource,
  checkedAt: "2026-09-29",
  note: {
    ru: "d100: «00» означает 100. Метамагия не применяется к заклинаниям всплеска. Укрощённый всплеск уровня 18 не позволяет выбрать строку 97–100. Самостоятельное изложение механики, неофициальный перевод.",
    en: "On d100, 00 means 100. Metamagic cannot modify surge spells. Level 18 Tamed Surge cannot select row 97–100. Independently worded mechanical reference.",
  },
  rows: [
    row(
      1,
      4,
      "На протяжении 1 минуты бросайте таблицу в начале каждого своего хода; результат 01–04 игнорируйте.",
      "For 1 minute, roll here at the start of each of your turns, ignoring results 01–04.",
    ),
    row(
      5,
      8,
      "Дружелюбное существо под контролем мастера появляется в случайном свободном месте в 60 фт. и исчезает через 1 минуту. Бросьте d4 ниже.",
      "A friendly DM-controlled creature appears in a random unoccupied space within 60 feet, disappearing after 1 minute. Roll d4 below.",
      {
        subtable: sub(
          "sorcerer-wild-2024-creature",
          4,
          "Появившееся существо",
          "Appearing creature",
          [
            row(1, 1, "Дуодрон.", "Duodrone.", {
              creatureIds: ["duodrone-2024"],
            }),
            row(2, 2, "Фламф.", "Flumph.", { creatureIds: ["flumph-2024"] }),
            row(3, 3, "Монодрон.", "Monodrone.", {
              creatureIds: ["monodrone-2024"],
            }),
            row(4, 4, "Единорог.", "Unicorn.", {
              creatureIds: ["unicorn-2024"],
            }),
          ],
        ),
      },
    ),
    row(
      9,
      12,
      "В течение 1 минуты в начале каждого своего хода восстанавливайте 5 хитов.",
      "For 1 minute, regain 5 HP at the start of each of your turns.",
    ),
    row(
      13,
      16,
      "Следующее ваше заклинание в течение 1 минуты, требующее спасброска, заставляет цели совершать эти спасброски с помехой.",
      "Creatures have Disadvantage on saves against the next save-requiring spell you cast within 1 minute.",
    ),
    row(
      17,
      20,
      "Бросьте d8 по вложенной таблице; эффект обычно длится 1 минуту, исключения указаны отдельно.",
      "Roll d8 on the nested table; effects normally last 1 minute unless stated otherwise.",
      { subtable: appearance },
    ),
    row(
      21,
      24,
      "На 1 минуту заклинания со временем сотворения в действие имеют время сотворения в бонусное действие.",
      "For 1 minute, your spells with an action casting time have a Bonus Action casting time instead.",
    ),
    row(
      25,
      28,
      "Вы на Астральном плане до конца следующего своего хода; затем вернитесь в прежнее место либо ближайшее свободное.",
      "Visit the Astral Plane until the end of your next turn, then return to your previous space or the nearest unoccupied space.",
    ),
    row(
      29,
      32,
      "Для следующего наносящего урон заклинания, сотворённого в течение 1 минуты, используйте максимумы костей урона вместо бросков.",
      "For your next damaging spell cast within 1 minute, use the maximum on each damage die instead of rolling.",
    ),
    row(
      33,
      36,
      "Сопротивление всему урону на 1 минуту.",
      "Resistance to all damage for 1 minute.",
    ),
    row(
      37,
      40,
      "До начала следующего своего хода вы — растение в горшке, недееспособны и уязвимы ко всему урону. При 0 хитов горшок разбивается, возвращая ваш облик.",
      "Until your next turn starts, you are a potted plant, Incapacitated and Vulnerable to all damage. At 0 HP the pot breaks and your form returns.",
    ),
    row(
      41,
      44,
      "На протяжении 1 минуты в каждый свой ход можно бонусным действием телепортироваться до 20 фт.",
      "For 1 minute, on each of your turns you may use a Bonus Action to teleport up to 20 feet.",
    ),
    row(
      45,
      48,
      "Вы и до трёх выбранных существ в 30 фт. невидимы на 1 минуту. Для каждой цели эффект заканчивается после её атаки или сотворения заклинания.",
      "You and up to three chosen creatures within 30 feet are Invisible for 1 minute; each loses the effect upon attacking or casting a spell.",
    ),
    row(
      49,
      52,
      "На 1 минуту +2 КД и иммунитет к Волшебной стреле.",
      "For 1 minute gain +2 AC and immunity to Magic Missile.",
      { spellIds: ["magic-missile-2024"] },
    ),
    row(
      53,
      56,
      "В текущий ход можно совершить одно дополнительное действие.",
      "Take one additional action this turn.",
    ),
    row(
      57,
      60,
      "Бросьте d10 и сотворите указанное заклинание без концентрации на полную длительность.",
      "Roll d10 and cast the indicated spell without Concentration for its full duration.",
      { subtable: randomSpell },
    ),
    row(
      61,
      64,
      "На 1 минуту ваше касание наносит 1d4 огненного урона и поджигает горючие немагические объекты, которые другое существо не носит и не несёт.",
      "For 1 minute your touch deals 1d4 Fire damage to and ignites flammable nonmagical objects not worn or carried by another creature.",
    ),
    row(
      65,
      68,
      "Смерть в течение следующего 1 часа немедленно возвращает вас к жизни как Реинкарнация.",
      "If you die within 1 hour, immediately return to life as with Reincarnate.",
      { spellIds: ["reincarnate-2024"] },
    ),
    row(
      69,
      72,
      "Вы испуганы до конца следующего своего хода; источник страха определяет мастер.",
      "You are Frightened until the end of your next turn; the DM determines the source of fear.",
    ),
    row(
      73,
      76,
      "Телепортируйтесь в видимое свободное место в пределах 60 фт.",
      "Teleport to a visible unoccupied space within 60 feet.",
    ),
    row(
      77,
      80,
      "Случайное существо в 60 фт. отравлено на 1d4 часа.",
      "A random creature within 60 feet is Poisoned for 1d4 hours.",
    ),
    row(
      81,
      84,
      "На 1 минуту излучайте яркий свет на 30 фт. Существо, заканчивающее ход в 5 фт., ослеплено до конца своего следующего хода.",
      "For 1 minute emit Bright Light for 30 feet. A creature ending its turn within 5 feet is Blinded until the end of its next turn.",
    ),
    row(
      85,
      88,
      "До трёх видимых выбранных существ в 30 фт. получают по 1d10 некротического урона; вы лечитесь на общую сумму этого урона.",
      "Up to three chosen visible creatures within 30 feet each take 1d10 Necrotic damage; regain HP equal to the total damage.",
    ),
    row(
      89,
      92,
      "До трёх видимых выбранных существ в 30 фт. получают по 4d10 урона электричеством.",
      "Up to three chosen visible creatures within 30 feet each take 4d10 Lightning damage.",
    ),
    row(
      93,
      96,
      "Вы и все существа в 30 фт. уязвимы к колющему урону на 1 минуту.",
      "You and all creatures within 30 feet are Vulnerable to Piercing damage for 1 minute.",
    ),
    row(
      97,
      100,
      "Бросьте d6 по вложенной таблице восстановления.",
      "Roll d6 on the nested recovery table.",
      {
        subtable: sub(
          "sorcerer-wild-2024-recovery",
          6,
          "Восстановление",
          "Recovery",
          [
            row(1, 1, "Восстановите 2d10 хитов.", "Regain 2d10 HP."),
            row(
              2,
              2,
              "Выбранный союзник в 300 фт. восстанавливает 2d10 хитов.",
              "A chosen ally within 300 feet regains 2d10 HP.",
            ),
            row(
              3,
              3,
              "Восстановите свою потраченную ячейку наименьшего круга.",
              "Recover your lowest-level expended spell slot.",
            ),
            row(
              4,
              4,
              "Выбранный союзник в 300 фт. восстанавливает потраченную ячейку наименьшего круга.",
              "A chosen ally within 300 feet recovers their lowest-level expended spell slot.",
            ),
            row(
              5,
              5,
              "Восстановите все очки чародейства.",
              "Recover all expended Sorcery Points.",
            ),
            row(
              6,
              6,
              "Примените все восемь проявлений строки 17–20 одновременно.",
              "Apply all eight manifestations from row 17–20 simultaneously.",
              { subtable: appearance },
            ),
          ],
        ),
      },
    ),
  ],
};
const barbarian: RandomEffectTable = {
  id: "barbarian-wild-2014",
  edition: "2014",
  die: 8,
  name: { ru: "Всплеск дикости", en: "Wild Surge" },
  sourceUrl: "https://dnd.su/class/87-barbarian/#primal.wild-magic",
  checkedAt: "2026-09-29",
  note: {
    ru: "Сл спасбросков = 8 + бонус мастерства + модификатор Телосложения. Результат выбирается броском при входе в ярость; повторная активация заменяет прежний эффект. Самостоятельное изложение механики, неофициальный перевод.",
    en: "Save DC = 8 + Proficiency Bonus + Constitution modifier. Roll when entering Rage; a new activation replaces the previous effect. Independently worded mechanical reference.",
  },
  rows: [
    row(
      1,
      1,
      "Выбранные видимые существа в 30 фт. совершают спасбросок Телосложения: провал наносит 1d12 некротического урона. Вы получаете 1d12 временных хитов.",
      "Chosen visible creatures within 30 feet make Constitution saves, taking 1d12 Necrotic damage on failure. Gain 1d12 Temporary HP.",
    ),
    row(
      2,
      2,
      "Телепортируйтесь до 30 фт. в видимое свободное место. До конца ярости повторяйте бонусным действием в каждый свой ход.",
      "Teleport up to 30 feet to a visible unoccupied space. Until Rage ends, repeat as a Bonus Action on each of your turns.",
    ),
    row(
      3,
      3,
      "Дух появляется в 5 фт. от видимой выбранной цели в 30 фт. В конце текущего хода он взрывается: существа в 5 фт. при провале спасброска Ловкости получают 1d6 силового урона. До конца ярости бонусным действием в свой ход можно создать нового духа.",
      "A spirit appears within 5 feet of a chosen visible creature within 30 feet. At this turn’s end it explodes; creatures within 5 feet take 1d6 Force damage on a failed Dexterity save. Until Rage ends, use a Bonus Action on your turn to summon another.",
    ),
    row(
      4,
      4,
      "До конца ярости одно выбранное удерживаемое оружие наносит силовой урон, становится лёгким и метательным (20/60 фт.). Покинув руку, возвращается в конце текущего хода.",
      "Until Rage ends, a chosen held weapon deals Force damage and gains Light and Thrown (20/60 feet). If it leaves your hand, it returns at the end of the current turn.",
    ),
    row(
      5,
      5,
      "До конца ярости каждое существо, попавшее по вам атакой, получает 1d6 силового урона.",
      "Until Rage ends, each creature hitting you with an attack takes 1d6 Force damage.",
    ),
    row(
      6,
      6,
      "До конца ярости вы и союзники в 10 фт. получаете +1 КД.",
      "Until Rage ends, you and allies within 10 feet gain +1 AC.",
    ),
    row(
      7,
      7,
      "До конца ярости земля в пределах 15 фт. от вас — трудная местность для врагов.",
      "Until Rage ends, ground within 15 feet is Difficult Terrain for your enemies.",
    ),
    row(
      8,
      8,
      "Другая выбранная видимая цель в 30 фт. при провале спасброска Телосложения получает 1d6 излучения и ослепляется до начала вашего следующего хода. До конца ярости повторяйте бонусным действием в свой ход.",
      "Another chosen visible creature within 30 feet takes 1d6 Radiant damage and is Blinded until your next turn starts on a failed Constitution save. Until Rage ends, repeat as a Bonus Action on your turn.",
    ),
  ],
};

export const RANDOM_EFFECT_TABLES: RandomEffectTable[] = [
  {
    id: "prismatic-spray-2014", edition: "2014", die: 8,
    name: { ru: "Радужные брызги: лучи", en: "Prismatic Spray: Rays" },
    sourceUrl: "https://dnd.su/spells/291-prismatic_spray/", checkedAt: "2026-09-30",
    note: { ru: "Каждое существо в конусе 60 фт. делает спасбросок Ловкости; отдельно бросьте d8 для каждой цели.", en: "Each creature in the 60-foot cone makes a Dexterity save; roll a separate d8 for each target." },
    rows: [
      ...[["Красный", "Red", "огнём", "fire"], ["Оранжевый", "Orange", "кислотой", "acid"], ["Жёлтый", "Yellow", "электричеством", "lightning"], ["Зелёный", "Green", "ядом", "poison"], ["Синий", "Blue", "холодом", "cold"]].map(([ru, en, damageRu, damageEn], i) => row(i + 1, i + 1, `${ru}: 10d6 урона ${damageRu} при провале, половина при успехе.`, `${en}: 10d6 ${damageEn} damage on a failed save, half on a success.`)),
      row(6, 6, "Индиго: провал опутывает. В конце каждого своего хода спасбросок Телосложения: три успеха заканчивают заклинание для цели; три провала навсегда превращают её в камень с Окаменением. Считайте оба итога отдельно; последовательность не нужна.", "Indigo: failure restrains the target. At the end of each turn it makes a Constitution save. Three successes end the spell for it; three failures permanently turn it to stone with the petrified condition. Track both totals; consecutive results are not required."),
      row(7, 7, "Фиолетовый: провал ослепляет. В начале следующего хода заклинателя спасбросок Мудрости: успех снимает Ослепление; провал также снимает его и переносит цель на план по выбору мастера, обычно родной для чужака либо Астральный или Эфирный для остальных.", "Violet: failure blinds the target. At the start of the caster's next turn it makes a Wisdom save: success removes blindness; failure also removes it and transports the target to a GM-chosen plane, typically home for an outsider or the Astral or Ethereal Plane otherwise."),
      row(8, 8, "Два луча: бросьте ещё два раза, перебрасывая восьмёрки.", "Two rays: roll twice more, rerolling any 8."),
    ],
  },
  {
    id: "prismatic-spray-2024", edition: "2024", die: 8,
    name: { ru: "Радужные брызги: лучи", en: "Prismatic Spray: Rays" },
    sourceUrl: "https://next.dnd.su/spells/10611-prismatic-spray/", checkedAt: "2026-09-30",
    note: { ru: "Для каждого существа в конусе 60 фт. — спасбросок Ловкости и отдельный бросок d8.", en: "Each creature in the 60-ft. Cone makes a Dexterity save; roll a separate d8 for each target." },
    rows: [
      ...[["Красный", "Red", "огнём", "Fire"], ["Оранжевый", "Orange", "кислотой", "Acid"], ["Жёлтый", "Yellow", "электричеством", "Lightning"], ["Зелёный", "Green", "ядом", "Poison"], ["Синий", "Blue", "холодом", "Cold"]].map(([ru, en, damageRu, damageEn], i) => row(i + 1, i + 1, `${ru}: 12d6 урона ${damageRu} при провале, половина при успехе.`, `${en}: 12d6 ${damageEn} damage on a failed save, half on a success.`)),
      row(6, 6, "Индиго: при провале Опутан; в конце каждого своего хода спасбросок Телосложения. Три успеха заканчивают состояние, три провала дают Окаменение до освобождения Высшим восстановлением или подобной магией. Считайте успехи и провалы отдельно, они не обязаны идти подряд.", "Indigo: a failed save Restrains the target. At the end of each turn it makes a Constitution save. Three successes end the condition; three failures Petrify it until freed by Greater Restoration or similar magic. Track both totals; they need not be consecutive."),
      row(7, 7, "Фиолетовый: при провале Ослеплён. В начале следующего хода заклинателя спасбросок Мудрости: успех снимает состояние; провал также снимает его и телепортирует на план по выбору мастера.", "Violet: a failed save Blinds the target. At the start of the caster's next turn, it makes a Wisdom save: success ends the condition; failure also ends it and teleports the target to a plane chosen by the GM."),
      row(8, 8, "Два луча: бросьте дважды, перебрасывая восьмёрки.", "Two rays: roll twice, rerolling any 8."),
    ],
  },
  ...(["2014", "2024"] as const).map((edition): RandomEffectTable => ({
    id: `confusion-${edition}`, edition, die: 10,
    name: { ru: "Смятение: поведение", en: "Confusion: Behavior" },
    sourceUrl: edition === "2014" ? "https://dnd.su/spells/325-confusion/" : "https://next.dnd.su/spells/10203-compulsion",
    checkedAt: "2026-09-30",
    note: { ru: "Бросайте в начале каждого своего хода под эффектом Смятения.", en: "Roll at the start of each of your turns while affected by Confusion." },
    rows: [
      row(1, 1, edition === "2014" ? "Без действия; потратьте всё перемещение в случайном направлении. Назначьте восемь направлений результатам d8 и бросьте его." : "Без действия; потратьте всё перемещение в направлении по вложенной таблице d4.", edition === "2014" ? "Take no action; spend all movement in a random direction. Assign eight directions to a d8 and roll it." : "Take no action; spend all movement in the direction from the nested d4 table.", edition === "2024" ? { subtable: {
        id: "confusion-direction-2024", edition, die: 4,
        name: { ru: "Смятение: направление", en: "Confusion: Direction" },
        sourceUrl: "https://next.dnd.su/spells/10203-compulsion", checkedAt: "2026-09-30",
        rows: [["Север", "North"], ["Восток", "East"], ["Юг", "South"], ["Запад", "West"]].map(([ru, en], i) => row(i + 1, i + 1, ru, en)),
      } } : {}),
      row(2, 6, "Не перемещайтесь и не совершайте действий.", "Do not move or take actions."),
      row(7, 8, edition === "2014" ? "Действием совершите одну рукопашную атаку по случайному существу в досягаемости. Если таких нет, ничего не делайте в этот ход." : "Не перемещайтесь; действием Атака совершите одну рукопашную атаку по случайному существу в досягаемости. Если таких нет, не совершайте действия.", edition === "2014" ? "Use your action for one melee attack against a random creature in reach. With no such creature, do nothing this turn." : "Do not move; take the Attack action for one melee attack against a random creature in reach. With no such creature, take no action."),
      row(9, 10, "Действуйте и перемещайтесь по своему выбору.", "Choose your actions and movement normally."),
    ],
  })),
  {
    id: "bag-beans-2024", edition: "2024", die: 100,
    name: { ru: "Посаженный волшебный боб", en: "Planted Magic Bean" },
    sourceUrl: "https://next.dnd.su/items/15846-bag-of-beans", checkedAt: "2026-09-30",
    note: { ru: "Мастер выбирает эффект или бросает d100; 00 означает 100. Произвольные монстр, сокровища и место назначения остаются решениями мастера; таблица не ограничивает их встроенным каталогом.", en: "The DM chooses or rolls d100; 00 means 100. Unspecified monsters, treasure, and destinations remain DM decisions, not limited to the embedded catalogue." },
    rows: [
      row(1,1,"5d4 грибов. При поедании бросьте любую кость: нечётное — спасбросок Телосложения Сл 15, провал даёт 5d6 урона ядом и Отравление на 1 час; чётное — 5d6 временных хитов на 1 час.","5d4 mushrooms. On eating one, roll any die: odd requires DC 15 Constitution save or 5d6 Poison damage and Poisoned for 1 hour; even grants 5d6 Temporary HP for 1 hour."),
      row(2,10,"Гейзер высотой 30 фт. на 1d4 минуты; мастер выбирает воду, пиво, майонез, чай, уксус, вино или масло.","A 30-foot geyser for 1d4 minutes; DM chooses water, beer, mayonnaise, tea, vinegar, wine, or oil."),
      row(11,20,"Вырастает Трент. Бросьте любую кость: нечётное — хаотично-злой, чётное — хаотично-добрый.","A Treant grows. Roll any die: odd makes it Chaotic Evil, even Chaotic Good.",{creatureIds:["treant-2024"]}),
      row(21,30,"На 24 часа оживает неподвижная каменная статуя вашего вида, угрожающая вам. В ваше отсутствие описывает вас пришедшим как злодея и посылает их найти и атаковать вас. Знает ваше местоположение, пока вы на одном плане.","A stationary stone likeness of you animates for 24 hours and threatens you. In your absence it denounces you to visitors and sends them to find and attack you. Knows your location while on the same plane."),
      row(31,40,"Зелёный костёр горит 24 часа или до тушения.","A green campfire burns for 24 hours or until extinguished."),
      row(41,50,"Вырастают три Гриба-визгуна.","Three Shrieker Fungi grow.",{creatureIds:["shrieker-fungus-2024"]}),
      row(51,60,"Появляются 1d4 + 4 ярко-розовые жабы. Каждая при касании становится выбранным мастером монстром Большого размера или меньше, действующим по своему мировоззрению и природе. Через 1 минуту монстр исчезает.","1d4 + 4 bright pink toads appear. Touching one turns it into a DM-chosen Large or smaller monster acting according to its alignment and nature. The monster disappears after 1 minute."),
      row(61,70,"Появляется голодная Панцирница и атакует.","A hungry Bulette appears and attacks.",{creatureIds:["bulette-2024"]}),
      row(71,80,"Дерево с 1d10 + 20 плодами; 1d8 плодов действуют как случайно определённые зелья. Дерево исчезает через 1 час; сорванные плоды остаются, их магия сохраняется 30 дней. Источник не задаёт распределение вероятностей зелий; мастер определяет способ выбора.","A tree bears 1d10 + 20 fruits; 1d8 act as randomly determined potions. The tree disappears after 1 hour; picked fruit remains and retains its magic for 30 days. The source specifies no potion probability distribution; the DM determines selection.",{itemIds:[
        ...ADDITIONAL_POTIONS_2024.map((item)=>item.id),
        ...["oil-of-slipperiness","philter-of-love","potion-of-animal-friendship","potion-of-climbing","potion-of-comprehension","potion-of-dragons-breath","potion-of-fire-breath","potion-of-giant-strength-hill","potion-of-greater-healing","potion-of-growth","potion-of-healing","potion-of-poison","potion-of-pugilism","potion-of-resistance","potion-of-tirelessness","potion-of-water-breathing"].map((id)=>`${id}-2024`)
      ]}),
      row(81,90,"Гнездо с 1d4 + 3 радужными яйцами. Съевший яйцо делает спасбросок Телосложения Сл 20: успех навсегда повышает на 1 самую низкую характеристику (при равенстве выберите случайно); провал наносит 10d6 силового урона внутренним взрывом.","A nest with 1d4 + 3 rainbow eggs. Eating one requires a DC 20 Constitution save: success permanently increases the lowest ability score by 1, randomly breaking ties; failure deals 10d6 Force damage from an internal explosion."),
      row(91,95,"Возникает пирамида с основанием 60 × 60 фт. Внутри гробница Мумии, Мумии-владыки или иной Нежити по выбору мастера; в саркофаге выбранное мастером сокровище.","A pyramid with a 60-by-60-foot base appears. Its burial chamber contains a Mummy, Mummy Lord, or other DM-chosen Undead; its sarcophagus holds DM-chosen treasure.",{creatureIds:["mummy-2024","mummy-lord-2024"]}),
      row(96,100,"Гигантский бобовый стебель растёт до выбранной мастером высоты и ведёт в выбранное им место, возможно на другой план.","A giant beanstalk reaches a DM-chosen height and destination, possibly another plane.")
    ]
  },
  {
    id: "cube-summoning-2024", edition: "2024", die: 6,
    name: { ru: "Куб вызова", en: "Cube of Summoning" },
    sourceUrl: "https://next.dnd.su/items/15895-cube-of-summoning", checkedAt: "2026-09-30",
    note: { ru: "Все результаты: круг 5, Сл 17, атака заклинанием +9, без Концентрации.", en: "All results: spell level 5, DC 17, spell attack +9, no Concentration." },
    rows: [
      row(1, 1, "Вызов аберрации", "Summon Aberration", { spellIds: ["summon-aberration-2024"] }),
      row(2, 2, "Вызов дракона", "Summon Dragon", { spellIds: ["summon-dragon-2024"] }),
      row(3, 3, "Вызов зверя", "Summon Beast", { spellIds: ["summon-beast-2024"] }),
      row(4, 4, "Вызов конструкта", "Summon Construct", { spellIds: ["summon-construct-2024"] }),
      row(5, 5, "Вызов феи", "Summon Fey", { spellIds: ["summon-fey-2024"] }),
      row(6, 6, "Вызов элементаля", "Summon Elemental", { spellIds: ["summon-elemental-2024"] })
    ]
  },
  ...teleportTables,
  ...oldTeleportTables,
  {
    id: "prayer-beads-2024", edition: "2024", die: 20,
    name: { ru: "Магические молитвенные бусины", en: "Magic Prayer Beads" },
    sourceUrl: "https://next.dnd.su/items/15998-necklace-of-prayer-beads", checkedAt: "2026-09-30",
    note: { ru: "Мастер выбирает или бросает d20 для каждой из 1d4 + 2 бусин. Повторения допустимы.", en: "The DM chooses or rolls d20 for each of 1d4 + 2 beads. Duplicates are allowed." },
    rows: [
      row(1, 6, "Благословения: Благословение.", "Blessing: Bless.", { spellIds: ["bless-2024"] }),
      row(7, 8, "Кары: Сияющая кара.", "Smiting: Shining Smite.", { spellIds: ["shining-smite-2024"] }),
      row(9, 14, "Лечения: Лечение ран 2-го круга.", "Curing: Cure Wounds at level 2.", { spellIds: ["cure-wounds-2024"] }),
      row(15, 18, "Оберега: Высшее восстановление.", "Favor: Greater Restoration.", { spellIds: ["greater-restoration-2024"] }),
      row(19, 19, "Призыва: Страж веры.", "Summons: Guardian of Faith.", { spellIds: ["guardian-of-faith-2024"] }),
      row(20, 20, "Хождения по ветру: Хождение по ветру.", "Wind Walking: Wind Walk.", { spellIds: ["wind-walk-2024"] })
    ]
  },
  {
    id: "mercy-masks-2014",
    edition: "2014",
    die: 6,
    name: { ru: "Маски милосердия", en: "Merciful Masks" },
    sourceUrl: "https://dnd.su/class/93-monk/#tradition.mercy",
    checkedAt: "2026-09-29",
    note: {
      ru: "Можно выбрать облик самостоятельно; маска не меняет механику.",
      en: "You may choose an appearance instead of rolling; the mask has no mechanical effect.",
    },
    rows: [
      row(1, 1, "Ворон", "Raven"),
      row(2, 2, "Белая маска без деталей", "Blank white"),
      row(3, 3, "Плачущий лик", "Crying visage"),
      row(4, 4, "Смеющийся лик", "Laughing visage"),
      row(5, 5, "Череп", "Skull"),
      row(6, 6, "Бабочка", "Butterfly"),
    ],
  },
  {
    id: "dragon-origin-2014",
    edition: "2014",
    die: 6,
    name: {
      ru: "Происхождение восходящего дракона",
      en: "Ascendant Dragon Origin",
    },
    sourceUrl: "https://dnd.su/class/93-monk/#tradition.ascending-dragon",
    checkedAt: "2026-09-29",
    note: {
      ru: "Необязательная идея предыстории; механических бонусов нет. Самостоятельное изложение.",
      en: "Optional background inspiration with no mechanical benefits. Independently worded reference.",
    },
    rows: [
      row(
        1,
        1,
        "Духовное единение с могуществом дракона.",
        "Spiritual communion with draconic power.",
      ),
      row(
        2,
        2,
        "Дракон преобразил вашу внутреннюю энергию.",
        "A dragon transformed your inner energy.",
      ),
      row(
        3,
        3,
        "Монастырские техники, восходящие к учению дракона.",
        "Monastic techniques descended from a dragon’s teaching.",
      ),
      row(
        4,
        4,
        "Медитация возле древнего драконьего логова.",
        "Meditation near an ancient dragon’s lair.",
      ),
      row(
        5,
        5,
        "Изучение техник из драконьего свитка.",
        "Techniques learned from a Draconic scroll.",
      ),
      row(
        6,
        6,
        "Дыхание пробудилось после сна о пятиглавом драконорождённом.",
        "Breath awakened after a dream of a five-headed dragonborn.",
      ),
    ],
  },

  {
    id: "reality-break-2014",
    edition: "2014",
    die: 10,
    name: { ru: "Брешь в реальности", en: "Reality Break" },
    sourceUrl: "https://dnd.su/spells/2454-reality-break/",
    checkedAt: "2026-09-29",
    rows: [
      row(
        1,
        2,
        "6d12 психического урона; ошеломление до конца хода.",
        "6d12 Psychic damage; Stunned until turn end.",
      ),
      row(
        3,
        5,
        "Спасбросок Ловкости: 8d12 силового урона при провале, половина при успехе.",
        "Dexterity save: 8d12 Force damage on failure, half on success.",
      ),
      row(
        6,
        8,
        "Телепортация со снаряжением до 30 фт. в выбранное заклинателем видимое свободное место; 10d12 силового урона и падение ничком.",
        "Teleport with equipment up to 30 ft. to a visible unoccupied space chosen by the caster; 10d12 Force damage and Prone.",
      ),
      row(
        9,
        10,
        "10d12 урона холодом; ослепление до конца хода.",
        "10d12 Cold damage; Blinded until turn end.",
      ),
    ],
  },
  old,
  modern,
  barbarian,
  ...BARD_SPIRIT_TABLES,
];
export function randomEffectTable(
  id: string | undefined,
): RandomEffectTable | undefined {
  return RANDOM_EFFECT_TABLES.find((t) => t.id === id);
}
export function randomEffectForRoll(
  table: RandomEffectTable,
  roll: number,
): RandomEffectRow | undefined {
  if (!Number.isInteger(roll) || roll < 1 || roll > table.die) return undefined;
  return table.rows.find((r) => roll >= r.from && roll <= r.to);
}
/** Returns diagnostics; never silently normalizes gaps, overlaps or wrong-edition children. */
export function validateRandomEffectTable(table: RandomEffectTable): string[] {
  const errors: string[] = [];
  let next = 1;
  for (const r of table.rows) {
    if (
      !Number.isInteger(r.from) ||
      !Number.isInteger(r.to) ||
      r.from !== next ||
      r.to < r.from ||
      r.to > table.die
    )
      errors.push(
        `${table.id}: invalid range ${r.from}-${r.to}; expected ${next}`,
      );
    if (!r.text.ru.trim() || !r.text.en.trim())
      errors.push(`${table.id}: missing translation`);
    next = r.to + 1;
    if (r.subtable) {
      if (r.subtable.edition !== table.edition)
        errors.push(`${table.id}: child edition mismatch`);
      errors.push(...validateRandomEffectTable(r.subtable));
    }
  }
  if (next !== table.die + 1)
    errors.push(`${table.id}: incomplete die coverage`);
  return errors;
}

for (const edition of ["2014", "2024"] as const)
  RANDOM_EFFECT_TABLES.push({
    id: "fey-gifts-" + edition,
    edition,
    die: 6,
    name: { ru: "Фейские дары (внешность)", en: "Fey Gifts (appearance)" },
    sourceUrl:
      edition === "2014"
        ? "https://dnd.su/class/97-ranger/#archetype.fey-wanderer"
        : "https://next.dnd.su/class/ranger#subclass.fey-wanderer",
    checkedAt: "2026-09-29",
    rows: [
      row(
        1,
        1,
        "Отдых сопровождается иллюзорными бабочками.",
        "Illusory butterflies surround you during Short or Long Rests.",
      ),
      row(
        2,
        2,
        edition === "2014"
          ? "На рассвете в волосах появляется цветок текущего сезона."
          : "На рассвете в волосах распускаются цветы.",
        edition === "2014"
          ? "A seasonal flower blooms in your hair at dawn."
          : "Flowers bloom in your hair at dawn.",
      ),
      row(
        3,
        3,
        "От вас исходит слабый приятный аромат трав или пряностей.",
        "You carry a faint pleasant herbal or spicy scent.",
      ),
      row(
        4,
        4,
        "Пока на тень не смотрят, она танцует.",
        "Your shadow dances while nobody watches it directly.",
      ),
      row(
        5,
        5,
        "На голове растут рога выбранного облика.",
        "Horns or antlers grow on your head.",
      ),
      row(
        6,
        6,
        edition === "2014"
          ? "На рассвете волосы и кожа принимают сезонные оттенки."
          : "На рассвете меняется цвет волос и кожи.",
        edition === "2014"
          ? "At dawn your hair and skin take on seasonal colors."
          : "Your hair and skin change color at dawn.",
      ),
    ],
  });
RANDOM_EFFECT_TABLES.push({
  id: "swarm-appearance-2014",
  edition: "2014",
  die: 4,
  name: { ru: "Облик роя", en: "Swarm Appearance" },
  sourceUrl: "https://dnd.su/class/97-ranger/#archetype.swarmkeeper",
  checkedAt: "2026-09-29",
  rows: [
    row(1, 1, "Множество насекомых.", "A swarm of insects."),
    row(2, 2, "Крошечные ветвистые заразы.", "Miniature twig blights."),
    row(3, 3, "Стайка порхающих птиц.", "Fluttering birds."),
    row(4, 4, "Играющие пикси.", "Playful pixies."),
  ],
});
RANDOM_EFFECT_TABLES.push({
  id: "drake-origin-2014",
  edition: "2014",
  die: 6,
  name: { ru: "Происхождение связи с дрейком", en: "Draconic Origin" },
  sourceUrl: "https://dnd.su/class/97-ranger/#archetype.drakewarden",
  checkedAt: "2026-09-29",
  rows: [
    row(
      1,
      1,
      "Связь возникла при изучении предмета, сохранившего драконью магию.",
      "Studying a dragon-related object awakened its lingering magic.",
    ),
    row(
      2,
      2,
      "Вас посвятил орден хранителей знаний о драконах.",
      "An order preserving dragon lore trained you.",
    ),
    row(
      3,
      3,
      "Доверенный вам драконом камень оказался яйцом дрейка.",
      "A stone entrusted to you by a dragon hatched into a drake.",
    ),
    row(
      4,
      4,
      "Капли драконьей крови изменили вашу природную магию.",
      "A few drops of dragon blood transformed your natural magic.",
    ),
    row(
      5,
      5,
      "Прочитанная древняя драконья надпись пробудила силу.",
      "Reading ancient Draconic inscriptions awakened your power.",
    ),
    row(
      6,
      6,
      "После сна-предупреждения о страннике с семью канарейками вы проснулись рядом с дрейком.",
      "After a warning dream of a stranger with seven canaries, you awoke beside a drake.",
    ),
  ],
});

for (const edition of ["2014", "2024"] as const)
  RANDOM_EFFECT_TABLES.push({
    id: "star-map-" + edition,
    edition,
    die: 6,
    name: { ru: "Звёздная карта", en: "Star Map" },
    sourceUrl:
      edition === "2014"
        ? "https://dnd.su/class/90-druid/#circle.stars"
        : "https://next.dnd.su/class/druid#subclass.stars",
    checkedAt: "2026-09-29",
    rows: [
      row(
        1,
        1,
        "Свиток со схемами созвездий.",
        "A scroll depicting constellations.",
      ),
      row(
        2,
        2,
        "Табличка из камня с отверстиями.",
        "A stone tablet pierced with holes.",
      ),
      row(
        3,
        3,
        "Отмеченная звёздными знаками шкура совомедведя.",
        "Owlbear hide marked with star symbols.",
      ),
      row(
        4,
        4,
        "Атлас с переплётом из чёрного дерева.",
        "An atlas bound in ebony.",
      ),
      row(
        5,
        5,
        edition === "2014"
          ? "Кристалл, проецирующий созвездия при попадании света."
          : "Кристалл со звёздной гравировкой.",
        edition === "2014"
          ? "A crystal that projects star patterns when lit."
          : "A crystal engraved with star patterns.",
      ),
      row(
        6,
        6,
        edition === "2014"
          ? "Стеклянные диски с созвездиями."
          : "Стеклянный диск с гравировкой созвездий.",
        edition === "2014"
          ? "Glass disks bearing constellations."
          : "A glass disk engraved with constellations.",
      ),
    ],
  });

RANDOM_EFFECT_TABLES.push({
  id: "genie-kind-2014",
  edition: "2014",
  die: 4,
  name: { ru: "Вид гения", en: "Genie Kind" },
  sourceUrl: "https://dnd.su/class/104-warlock/#patron.genie",
  checkedAt: "2026-09-29",
  rows: [
    row(1, 1, "Дао — земля.", "Dao — Earth."),
    row(2, 2, "Джинн — воздух.", "Djinni — Air."),
    row(3, 3, "Ифрит — огонь.", "Efreeti — Fire."),
    row(4, 4, "Марид — вода.", "Marid — Water."),
  ],
});
RANDOM_EFFECT_TABLES.push({
  id: "genie-vessel-2014",
  edition: "2014",
  die: 6,
  name: { ru: "Сосуд гения", en: "Genie Vessel" },
  sourceUrl: "https://dnd.su/class/104-warlock/#patron.genie",
  checkedAt: "2026-09-29",
  rows: [
    row(1, 1, "Лампа для масла.", "An oil lamp."),
    row(2, 2, "Погребальная урна.", "An urn."),
    row(
      3,
      3,
      "Кольцо с потайным отсеком.",
      "A ring with a hidden compartment.",
    ),
    row(4, 4, "Бутылка с пробкой.", "A stoppered bottle."),
    row(5, 5, "Полая статуэтка.", "A hollow statuette."),
    row(6, 6, "Украшенный фонарь.", "An ornate lantern."),
  ],
});

for (const edition of ["2014", "2024"] as const) RANDOM_EFFECT_TABLES.push({
 id:"alchemist-elixirs-"+edition,edition,die:6,
 name:{ru:"Экспериментальный эликсир",en:"Experimental Elixir"},
 sourceUrl:edition === "2014" ? "https://dnd.su/class/137-artificer/#specialist.alchemist" : "https://next.dnd.su/class/artificer#subclass.alchemist",
 checkedAt:"2026-09-29",
 note:{ru:"Самостоятельное изложение механики. Неофициальный перевод. Эликсиры не требуют концентрации; усиления 2024 зависят от уровня изобретателя.",en:"Independently worded mechanical reference. Elixirs do not require Concentration; 2024 improvements use Artificer level."},
 rows:[
 row(1,1,edition === "2014" ? "Лечение: восстановите 2к4 + Интеллект изобретателя хитов." : "Лечение: восстановите 2к8 + Интеллект изобретателя хитов; 3к8 с уровня 9, 4к8 с уровня 15.",edition === "2014" ? "Healing: regain 2d4 + the Artificer's Intelligence modifier hit points." : "Healing: regain 2d8 + the Artificer's Intelligence modifier hit points; 3d8 at level 9 and 4d8 at level 15."),
 row(2,2,edition === "2014" ? "Стремительность: скорость ходьбы +10 фт. на 1 час." : "Проворность: Скорость +10 фт. на 1 час; +15 фт. с уровня 9, +20 фт. с уровня 15.",edition === "2014" ? "Swiftness: walking speed increases by 10 feet for 1 hour." : "Swiftness: Speed increases by 10 feet for 1 hour; 15 feet at level 9 and 20 feet at level 15."),
 row(3,3,edition === "2014" ? "Устойчивость: +1 КД на 10 минут." : "Устойчивость: +1 КД на 10 минут; на 1 час с уровня 9, на 8 часов с уровня 15.",edition === "2014" ? "Resilience: +1 AC for 10 minutes." : "Resilience: +1 AC for 10 minutes; 1 hour at level 9 and 8 hours at level 15."),
 row(4,4,edition === "2014" ? "Смелость: добавляйте d4 к броскам атаки и спасброскам в течение 1 минуты." : "Смелость: добавляйте d4 к броскам атаки и спасброскам в течение 1 минуты; 10 минут с уровня 9, 1 час с уровня 15.",edition === "2014" ? "Boldness: add a d4 to attack rolls and saving throws for 1 minute." : "Boldness: add a d4 to attack rolls and saving throws for 1 minute; 10 minutes at level 9 and 1 hour at level 15."),
 row(5,5,edition === "2014" ? "Полёт: скорость полёта 10 фт. на 10 минут." : "Полёт: скорость полёта 10 фт. на 10 минут; 20 фт. с уровня 9, 30 фт. с уровня 15.",edition === "2014" ? "Flight: flying speed of 10 feet for 10 minutes." : "Flight: Fly Speed of 10 feet for 10 minutes; 20 feet at level 9 and 30 feet at level 15."),
 row(6,6,edition === "2014" ? "Трансформация: на 10 минут получите эффект Смены обличья; выпивший выбирает превращение." : "Выберите один из эффектов 1–5.",edition === "2014" ? "Transformation: gain the effect of Alter Self for 10 minutes; the drinker chooses the transformation." : "Choose any effect from rows 1–5.",edition === "2014" ? {spellIds:["alter-self-2014"]} : {}),
 ],
});

RANDOM_EFFECT_TABLES.push({
 id:"potion-resistance-2024",edition:"2024",die:10,
 name:{ru:"Зелье сопротивления: тип урона",en:"Potion of Resistance: Damage Type"},
 sourceUrl:"https://next.dnd.su/items/16040-potion-of-resistance",checkedAt:"2026-09-29",
 rows:[
 row(1,1,"Звук.","Thunder."),row(2,2,"Излучение.","Radiant."),row(3,3,"Кислота.","Acid."),row(4,4,"Некротический.","Necrotic."),row(5,5,"Огонь.","Fire."),row(6,6,"Психический.","Psychic."),row(7,7,"Силовой.","Force."),row(8,8,"Холод.","Cold."),row(9,9,"Электричество.","Lightning."),row(10,10,"Яд.","Poison."),
 ],
});

RANDOM_EFFECT_TABLES.push({
 id:"armor-resistance-2024",edition:"2024",die:10,
 name:{ru:"Сопротивление доспеха",en:"Armor Resistance"},
 sourceUrl:"https://next.dnd.su/items/15842-armor-of-resistance",checkedAt:"2026-09-29",
 note:{ru:"Мастер выбирает тип урона или бросает d10. Пока носите настроенный доспех, получаете сопротивление этому типу.",en:"The GM chooses the damage type or rolls d10. While wearing the attuned armor, gain Resistance to that damage type."},
 rows:[row(1,1,"Звук","Thunder"),row(2,2,"Излучение","Radiant"),row(3,3,"Кислота","Acid"),row(4,4,"Некротический","Necrotic"),row(5,5,"Огонь","Fire"),row(6,6,"Психический","Psychic"),row(7,7,"Силовой","Force"),row(8,8,"Холод","Cold"),row(9,9,"Электричество","Lightning"),row(10,10,"Яд","Poison")],
});
RANDOM_EFFECT_TABLES.push({
 id:"lantern-tracking-2014",edition:"2014",die:10,name:{ru:"Фонарь отслеживания",en:"Lantern of Tracking"},sourceUrl:"https://dnd.su/items/2330-lantern-of-tracking/",checkedAt:"2026-09-30",
 note:{ru:"Бросьте d10 при определении вида фонаря. Выбранный тип существа впоследствии не меняется. Неофициальный перевод.",en:"Roll d10 to determine the lantern’s creature type. The type cannot change afterward."},
 rows:[row(1,1,"Аберрация","Aberration"),row(2,2,"Небожитель","Celestial"),row(3,3,"Конструкт","Construct"),row(4,4,"Дракон","Dragon"),row(5,5,"Элементаль","Elemental"),row(6,6,"Фея","Fey"),row(7,7,"Исчадие","Fiend"),row(8,8,"Великан","Giant"),row(9,9,"Монстр","Monstrosity"),row(10,10,"Нежить","Undead")],
},{
 id:"cartographer-landmarks-2014",edition:"2014",die:8,name:{ru:"Ориентиры актуальной карты",en:"Map of the Moment Landmarks"},sourceUrl:"https://dnd.su/items/2140-cartographers-map-case/",checkedAt:"2026-09-30",
 note:{ru:"Возможные ориентиры для карты текущего задания, d8. Самостоятельное изложение, неофициальный перевод.",en:"Possible landmarks for the current mission’s map, d8. Independently worded reference."},
 rows:[row(1,1,"Старинный саркофаг Джеральда Смита.","Gerald Smith’s ancient sarcophagus."),row(2,2,"Дерево с надписью, что это дерево.","A tree bearing a sign identifying it as a tree."),row(3,3,"Могила богатого брата в медвежьей пещере.","A wealthy brother’s grave in a bear cave."),row(4,4,"Горный хребет «Слегка колеблющиеся пики».","A mountain range called the Slightly Wavering Peaks."),row(5,5,"В пустоши постоянно протекает немагический кран с чистой водой.","A constantly leaking nonmagical clean-water tap in a wasteland."),row(6,6,"Пещера кричащих светящихся червей.","A cave of screaming bioluminescent worms."),row(7,7,"Лес с привидениями на 10 миль вокруг.","A genuinely haunted forest extending 10 miles in every direction."),row(8,8,"Огромная груда камней; других камней вокруг не видно.","A huge pile of stones with no other stones in sight.")],
});
RANDOM_EFFECT_TABLES.push({
 id:"trick-weapon-2024",edition:"2024",die:10,name:{ru:"Облик потайного оружия",en:"Trick Weapon Form"},sourceUrl:"https://next.dnd.su/items/21331-trick-weapon",checkedAt:"2026-09-30",
 note:{ru:"Мастер выбирает облик или бросает d10. Неофициальный перевод.",en:"The DM chooses the form or rolls d10."},
 rows:[row(1,1,"Браслет","Bracelet"),row(2,2,"Бубенец","Jingle bell"),row(3,3,"Гребень","Comb"),row(4,4,"Игральная карта","Playing card"),row(5,5,"Костыль","Crutch"),row(6,6,"Ложка","Spoon"),row(7,7,"Ожерелье с подвеской","Pendant necklace"),row(8,8,"Писчее перо","Writing quill"),row(9,9,"Фальшивая монета","Counterfeit coin"),row(10,10,"Шпилька","Hairpin")],
});

RANDOM_EFFECT_TABLES.push({
  "id": "deck-illusions-2024",
  "edition": "2024",
  "die": 100,
  "name": {
    "ru": "Колода иллюзий",
    "en": "Deck of Illusions"
  },
  "sourceUrl": "https://next.dnd.su/items/15902-deck-of-illusions",
  "checkedAt": "2026-09-30",
  "note": {
    "ru": "d100: 00 означает 100. Это безвредные иллюзии, а не призванные существа: они не используют боевую статистику изображённого чудовища. Неофициальный перевод.",
    "en": "On d100, 00 means 100. These are harmless illusions, not summoned creatures; they do not use the depicted monster’s combat statistics."
  },
  "rows": [
    {
      "from": 1,
      "to": 3,
      "text": {
        "ru": "Взрослый красный дракон",
        "en": "Adult Red Dragon"
      }
    },
    {
      "from": 4,
      "to": 6,
      "text": {
        "ru": "Архимаг",
        "en": "Archmage"
      }
    },
    {
      "from": 7,
      "to": 9,
      "text": {
        "ru": "Ассасин",
        "en": "Assassin"
      }
    },
    {
      "from": 10,
      "to": 12,
      "text": {
        "ru": "Бандитский атаман",
        "en": "Bandit Captain"
      }
    },
    {
      "from": 13,
      "to": 15,
      "text": {
        "ru": "Бехолдер",
        "en": "Beholder"
      }
    },
    {
      "from": 16,
      "to": 18,
      "text": {
        "ru": "Берсерк",
        "en": "Berserker"
      }
    },
    {
      "from": 19,
      "to": 21,
      "text": {
        "ru": "Медвежатник воин",
        "en": "Bugbear Warrior"
      }
    },
    {
      "from": 22,
      "to": 24,
      "text": {
        "ru": "Облачный великан",
        "en": "Cloud Giant"
      }
    },
    {
      "from": 25,
      "to": 27,
      "text": {
        "ru": "Друид",
        "en": "Druid"
      }
    },
    {
      "from": 28,
      "to": 30,
      "text": {
        "ru": "Эриния",
        "en": "Erinyes"
      }
    },
    {
      "from": 31,
      "to": 33,
      "text": {
        "ru": "Эттин",
        "en": "Ettin"
      }
    },
    {
      "from": 34,
      "to": 36,
      "text": {
        "ru": "Огненный великан",
        "en": "Fire Giant"
      }
    },
    {
      "from": 37,
      "to": 39,
      "text": {
        "ru": "Ледяной великан",
        "en": "Frost Giant"
      }
    },
    {
      "from": 40,
      "to": 42,
      "text": {
        "ru": "Гнолл-воитель",
        "en": "Gnoll Warrior"
      }
    },
    {
      "from": 43,
      "to": 45,
      "text": {
        "ru": "Гоблин-воитель",
        "en": "Goblin Warrior"
      }
    },
    {
      "from": 46,
      "to": 48,
      "text": {
        "ru": "Охранная нага",
        "en": "Guardian Naga"
      }
    },
    {
      "from": 49,
      "to": 51,
      "text": {
        "ru": "Холмовой великан",
        "en": "Hill Giant"
      }
    },
    {
      "from": 52,
      "to": 54,
      "text": {
        "ru": "Хобгоблин воин",
        "en": "Hobgoblin Warrior"
      }
    },
    {
      "from": 55,
      "to": 57,
      "text": {
        "ru": "Инкуб",
        "en": "Incubus"
      }
    },
    {
      "from": 58,
      "to": 60,
      "text": {
        "ru": "Железный голем",
        "en": "Iron Golem"
      }
    },
    {
      "from": 61,
      "to": 63,
      "text": {
        "ru": "Рыцарь",
        "en": "Knight"
      }
    },
    {
      "from": 64,
      "to": 66,
      "text": {
        "ru": "Кобольд-воитель",
        "en": "Kobold Warrior"
      }
    },
    {
      "from": 67,
      "to": 69,
      "text": {
        "ru": "Лич",
        "en": "Lich"
      }
    },
    {
      "from": 70,
      "to": 72,
      "text": {
        "ru": "Медуза",
        "en": "Medusa"
      }
    },
    {
      "from": 73,
      "to": 75,
      "text": {
        "ru": "Ночная карга",
        "en": "Night Hag"
      }
    },
    {
      "from": 76,
      "to": 78,
      "text": {
        "ru": "Огр",
        "en": "Ogre"
      }
    },
    {
      "from": 79,
      "to": 81,
      "text": {
        "ru": "Они",
        "en": "Oni"
      }
    },
    {
      "from": 82,
      "to": 84,
      "text": {
        "ru": "Священник",
        "en": "Priest"
      }
    },
    {
      "from": 85,
      "to": 87,
      "text": {
        "ru": "Суккуб",
        "en": "Succubus"
      }
    },
    {
      "from": 88,
      "to": 90,
      "text": {
        "ru": "Тролль",
        "en": "Troll"
      }
    },
    {
      "from": 91,
      "to": 93,
      "text": {
        "ru": "Воитель-ветеран",
        "en": "Warrior Veteran"
      }
    },
    {
      "from": 94,
      "to": 96,
      "text": {
        "ru": "Виверна",
        "en": "Wyvern"
      }
    },
    {
      "from": 97,
      "to": 100,
      "text": {
        "ru": "Вытянувший карту",
        "en": "The creature that drew the card"
      }
    }
  ]
});

RANDOM_EFFECT_TABLES.push({
  "id": "robe-useful-items-2024",
  "edition": "2024",
  "die": 100,
  "name": {
    "ru": "Дополнительные заплаты мантии",
    "en": "Additional Robe Patches"
  },
  "sourceUrl": "https://next.dnd.su/items/16076-robe-of-useful-items",
  "checkedAt": "2026-09-30",
  "note": {
    "ru": "Мантия имеет 4d4 дополнительных заплат: мастер выбирает результаты или бросает d100 для каждой. 00 означает 100. Неофициальный перевод.",
    "en": "The robe has 4d4 additional patches; the DM chooses or rolls d100 for each. 00 means 100."
  },
  "rows": [
    {
      "from": 1,
      "to": 8,
      "text": {
        "ru": "Кошель со 100 зм.",
        "en": "A pouch containing 100 GP."
      }
    },
    {
      "from": 9,
      "to": 15,
      "text": {
        "ru": "Серебряный ларец 1 фут × 6 дюймов × 6 дюймов, стоимость 500 зм.",
        "en": "A silver coffer, 1 foot long and 6 inches wide and deep, worth 500 GP."
      }
    },
    {
      "from": 16,
      "to": 22,
      "text": {
        "ru": "Железная дверь до 10 × 10 фт., засов с выбранной стороны. Установите в достижимый проём: размер подстраивается, петли закрепляются сами.",
        "en": "An iron door up to 10 feet square, barred on your chosen side. Place it in an opening you can reach; it adjusts to fit and attaches its own hinges."
      }
    },
    {
      "from": 23,
      "to": 30,
      "text": {
        "ru": "Десять самоцветов по 100 зм.",
        "en": "Ten gems worth 100 GP each."
      }
    },
    {
      "from": 31,
      "to": 44,
      "text": {
        "ru": "Деревянная лестница длиной 24 фт.",
        "en": "A 24-foot wooden ladder."
      }
    },
    {
      "from": 45,
      "to": 51,
      "text": {
        "ru": "Верховая лошадь с седлом.",
        "en": "A Riding Horse with a riding saddle."
      },
      "creatureIds": [
        "riding-horse-2024"
      ]
    },
    {
      "from": 52,
      "to": 59,
      "text": {
        "ru": "Открытая яма: куб 10 фт. в земле в пределах 10 фт. от вас.",
        "en": "An open 10-foot Cube pit in the ground within 10 feet of you."
      }
    },
    {
      "from": 60,
      "to": 68,
      "text": {
        "ru": "Четыре зелья лечения.",
        "en": "Four Potions of Healing."
      },
      "itemIds": [
        "potion-of-healing-2024"
      ]
    },
    {
      "from": 69,
      "to": 75,
      "text": {
        "ru": "Лодка длиной 12 фт.",
        "en": "A 12-foot rowboat."
      }
    },
    {
      "from": 76,
      "to": 83,
      "text": {
        "ru": "Свиток с одним заклинанием 1-го, 2-го или 3-го круга по вашему выбору.",
        "en": "A Spell Scroll containing one level-1, level-2, or level-3 spell of your choice."
      },
      "itemIds": [
        "spell-scroll-1-2024",
        "spell-scroll-2-2024",
        "spell-scroll-3-2024"
      ]
    },
    {
      "from": 84,
      "to": 90,
      "text": {
        "ru": "Два мастифа.",
        "en": "Two Mastiffs."
      },
      "creatureIds": [
        "mastiff-2024"
      ]
    },
    {
      "from": 91,
      "to": 96,
      "text": {
        "ru": "Окно 2 × 4 фт., глубиной до 2 фт.; разместите на достижимой вертикальной поверхности.",
        "en": "A window 2 by 4 feet, up to 2 feet deep, placed on a vertical surface you can reach."
      }
    },
    {
      "from": 97,
      "to": 100,
      "text": {
        "ru": "Портативный таран.",
        "en": "A Portable Ram."
      }
    }
  ]
});

RANDOM_EFFECT_TABLES.push({
  "id": "bag-tricks-gray-2024",
  "edition": "2024",
  "die": 8,
  "name": {
    "ru": "Серая сумка фокусов",
    "en": "Gray Bag of Tricks"
  },
  "sourceUrl": "https://next.dnd.su/items/15849-bag-of-tricks",
  "checkedAt": "2026-09-30",
  "rows": [
    {
      "from": 1,
      "to": 1,
      "text": {
        "ru": "Куница",
        "en": "Weasel"
      },
      "creatureIds": [
        "weasel-2024"
      ]
    },
    {
      "from": 2,
      "to": 2,
      "text": {
        "ru": "Гигантская крыса",
        "en": "Giant Rat"
      },
      "creatureIds": [
        "giant-rat-2024"
      ]
    },
    {
      "from": 3,
      "to": 3,
      "text": {
        "ru": "Барсук",
        "en": "Badger"
      },
      "creatureIds": [
        "badger-2024"
      ]
    },
    {
      "from": 4,
      "to": 4,
      "text": {
        "ru": "Кабан",
        "en": "Boar"
      },
      "creatureIds": [
        "boar-2024"
      ]
    },
    {
      "from": 5,
      "to": 5,
      "text": {
        "ru": "Пантера",
        "en": "Panther"
      },
      "creatureIds": [
        "panther-2024"
      ]
    },
    {
      "from": 6,
      "to": 6,
      "text": {
        "ru": "Гигантский барсук",
        "en": "Giant Badger"
      },
      "creatureIds": [
        "giant-badger-2024"
      ]
    },
    {
      "from": 7,
      "to": 7,
      "text": {
        "ru": "Лютый волк",
        "en": "Dire Wolf"
      },
      "creatureIds": [
        "dire-wolf-2024"
      ]
    },
    {
      "from": 8,
      "to": 8,
      "text": {
        "ru": "Гигантский лось",
        "en": "Giant Elk"
      },
      "creatureIds": [
        "giant-elk-2024"
      ]
    }
  ]
});

RANDOM_EFFECT_TABLES.push({
  "id": "bag-tricks-rust-2024",
  "edition": "2024",
  "die": 8,
  "name": {
    "ru": "Рыжая сумка фокусов",
    "en": "Rust Bag of Tricks"
  },
  "sourceUrl": "https://next.dnd.su/items/15849-bag-of-tricks",
  "checkedAt": "2026-09-30",
  "rows": [
    {
      "from": 1,
      "to": 1,
      "text": {
        "ru": "Крыса",
        "en": "Rat"
      },
      "creatureIds": [
        "rat-2024"
      ]
    },
    {
      "from": 2,
      "to": 2,
      "text": {
        "ru": "Сова",
        "en": "Owl"
      },
      "creatureIds": [
        "owl-2024"
      ]
    },
    {
      "from": 3,
      "to": 3,
      "text": {
        "ru": "Мастиф",
        "en": "Mastiff"
      },
      "creatureIds": [
        "mastiff-2024"
      ]
    },
    {
      "from": 4,
      "to": 4,
      "text": {
        "ru": "Козёл",
        "en": "Goat"
      },
      "creatureIds": [
        "goat-2024"
      ]
    },
    {
      "from": 5,
      "to": 5,
      "text": {
        "ru": "Гигантский козёл",
        "en": "Giant Goat"
      },
      "creatureIds": [
        "giant-goat-2024"
      ]
    },
    {
      "from": 6,
      "to": 6,
      "text": {
        "ru": "Гигантский кабан",
        "en": "Giant Boar"
      },
      "creatureIds": [
        "giant-boar-2024"
      ]
    },
    {
      "from": 7,
      "to": 7,
      "text": {
        "ru": "Лев",
        "en": "Lion"
      },
      "creatureIds": [
        "lion-2024"
      ]
    },
    {
      "from": 8,
      "to": 8,
      "text": {
        "ru": "Бурый медведь",
        "en": "Brown Bear"
      },
      "creatureIds": [
        "brown-bear-2024"
      ]
    }
  ]
});

RANDOM_EFFECT_TABLES.push({
  "id": "bag-tricks-tan-2024",
  "edition": "2024",
  "die": 8,
  "name": {
    "ru": "Бежевая сумка фокусов",
    "en": "Tan Bag of Tricks"
  },
  "sourceUrl": "https://next.dnd.su/items/15849-bag-of-tricks",
  "checkedAt": "2026-09-30",
  "rows": [
    {
      "from": 1,
      "to": 1,
      "text": {
        "ru": "Шакал",
        "en": "Jackal"
      },
      "creatureIds": [
        "jackal-2024"
      ]
    },
    {
      "from": 2,
      "to": 2,
      "text": {
        "ru": "Человекообразная обезьяна",
        "en": "Ape"
      },
      "creatureIds": [
        "ape-2024"
      ]
    },
    {
      "from": 3,
      "to": 3,
      "text": {
        "ru": "Бабуин",
        "en": "Baboon"
      },
      "creatureIds": [
        "baboon-2024"
      ]
    },
    {
      "from": 4,
      "to": 4,
      "text": {
        "ru": "Топороклюв",
        "en": "Axe Beak"
      },
      "creatureIds": [
        "axe-beak-2024"
      ]
    },
    {
      "from": 5,
      "to": 5,
      "text": {
        "ru": "Чёрный медведь",
        "en": "Black Bear"
      },
      "creatureIds": [
        "black-bear-2024"
      ]
    },
    {
      "from": 6,
      "to": 6,
      "text": {
        "ru": "Гигантская куница",
        "en": "Giant Weasel"
      },
      "creatureIds": [
        "giant-weasel-2024"
      ]
    },
    {
      "from": 7,
      "to": 7,
      "text": {
        "ru": "Гигантская гиена",
        "en": "Giant Hyena"
      },
      "creatureIds": [
        "giant-hyena-2024"
      ]
    },
    {
      "from": 8,
      "to": 8,
      "text": {
        "ru": "Тигр",
        "en": "Tiger"
      },
      "creatureIds": [
        "tiger-2024"
      ]
    }
  ]
});
