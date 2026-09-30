import type { SpellOption } from "./rules-data";
import { PALADIN_SPELLS } from "./paladin-spells";
import { CLERIC_SPELLS } from "./cleric-spells";
import { SORCERER_SPELLS } from "./sorcerer-spells";

/** Original mechanical descriptions, checked against the linked 2024 cards. */
export const EXTENDED_SPELLS: SpellOption[] = [
  ...PALADIN_SPELLS,
  ...CLERIC_SPELLS,
  ...SORCERER_SPELLS,
  ...(["2014", "2024"] as const).map((edition): SpellOption => ({
    id: `beast-sense-${edition}`,
    name: "Животные чувства · Beast Sense",
    editions: [edition],
    level: 2,
    school: "Прорицание",
    classes: ["druid", "ranger"],
    concentration: true,
    ritual: true,
    castingTime: "Action or Ritual",
    range: "Touch",
    duration: "1 hour",
    components: "S",
    source: `Player's Handbook (${edition})`,
    sourceUrl:
      edition === "2014"
        ? "https://dnd.su/spells/76-beast_sense/"
        : "https://next.dnd.su/spells/10267-beast-sense/",
    summary:
      "Восприятие чувствами согласного зверя, которого вы коснулись; концентрация до часа.",
    descriptionRu:
      edition === "2014"
        ? "Коснитесь согласного зверя. Во время действия заклинания действием можно перейти к его зрению и слуху, включая особые чувства; своим окружением при этом вы ослеплены и оглохли. Ещё одно действие возвращает собственное восприятие."
        : "Коснитесь согласного зверя. На время заклинания можно воспринимать окружение собственными чувствами либо чувствами зверя, включая его особые чувства.",
    description:
      edition === "2014"
        ? "Touch a willing Beast. For the duration, an action lets you use its sight and hearing, including special senses, until you spend another action returning to your own. While using its senses, you are Blinded and Deafened to your own surroundings."
        : "Touch a willing Beast. For the duration you can perceive through either your own senses or the Beast’s senses, including its special senses.",
  })),
  {
    id: "mind-sliver-2024",
    name: "Расщепление разума · Mind Sliver",
    editions: ["2024"],
    level: 0,
    school: "Очарование",
    classes: ["wizard", "warlock", "sorcerer"],
    concentration: false,
    ritual: false,
    castingTime: "Action",
    range: "60 feet",
    duration: "1 round",
    components: "V",
    summary:
      "Интеллект: 1d6 психического урона и −1d4 к следующему спасброску.",
    descriptionRu:
      "Одно видимое существо в пределах дистанции совершает спасбросок Интеллекта. При провале: 1d6 психического урона и вычитание 1d4 из следующего спасброска до конца вашего следующего хода. Урон растёт до 2d6 на 5-м, 3d6 на 11-м и 4d6 на 17-м уровне персонажа.",
    description:
      "One visible target makes an Intelligence save. Failure: 1d6 Psychic damage and subtract 1d4 from its next saving throw before your next turn ends. Damage becomes 2d6 at character level 5, 3d6 at 11, and 4d6 at 17.",
    source: "Player’s Handbook (2024)",
    sourceUrl: "https://next.dnd.su/spells/10580-mind-sliver/",
  },
  {
    id: "arms-of-hadar-2024",
    name: "Руки Хадара · Arms of Hadar",
    editions: ["2024"],
    level: 1,
    school: "Вызов",
    classes: ["warlock"],
    concentration: false,
    ritual: false,
    castingTime: "Action",
    range: "Self",
    duration: "Instantaneous",
    components: "V, S",
    summary:
      "Эманация 10 фт.: 2d6 некротического урона и запрет реакций при провале спасброска Силы.",
    descriptionRu:
      "Каждое существо в вашей эманации 10 фт. делает спасбросок Силы. Провал: 2d6 некротического урона, реакции недоступны до начала его следующего хода. Успех: половина урона, реакции остаются. За каждый круг ячейки выше первого добавьте 1d6 урона.",
    description:
      "Each creature in your 10-foot Emanation makes a Strength save. Failure: 2d6 Necrotic damage and no Reactions until its next turn starts. Success: half damage only. Add 1d6 damage per slot level above 1.",
    source: "Player’s Handbook (2024)",
    sourceUrl: "https://next.dnd.su/spells/10432-arms-of-hadar/",
  },
  {
    id: "hunger-of-hadar-2024",
    name: "Голод Хадара · Hunger of Hadar",
    editions: ["2024"],
    level: 3,
    school: "Вызов",
    classes: ["warlock"],
    concentration: true,
    ritual: false,
    castingTime: "Action",
    range: "150 feet",
    duration: "1 minute",
    components: "V, S, M (pickled tentacle)",
    summary:
      "Сфера 20 фт.: непроглядная тьма, трудная местность, урон холодом и кислотой.",
    descriptionRu:
      "Создайте сферу радиусом 20 фт. с центром в пределах дистанции. Внутри труднопроходимая область; любой свет бессилен, полностью находящиеся внутри существа ослеплены. Шумы слышны в 30 фт. от сферы. Начало хода внутри: 2d6 холода. Конец хода внутри: спасбросок Ловкости, при провале 2d6 кислоты. Ячейка выше третьего круга усиливает выбранный вами тип урона на 1d6 за круг. Материал: маринованное щупальце.",
    description:
      "Create a 20-foot-radius Sphere centered within range. It is Difficult Terrain, cannot be lit by any light, and Blinds creatures wholly inside. Its noises carry 30 feet beyond it. Starting a turn inside deals 2d6 Cold damage. Ending a turn inside requires a Dexterity save; failure deals 2d6 Acid damage. Per slot level above 3, increase either Cold or Acid damage (your choice) by 1d6.",
    source: "Player’s Handbook (2024)",
    sourceUrl: "https://next.dnd.su/spells/10545-hunger-of-hadar/",
  },
  ...(["aberration", "construct"] as const).map((kind): SpellOption => ({
    id: `summon-${kind}-2024`,
    creatureReferenceIds: [
      `${kind === "aberration" ? "aberrant" : kind}-spirit-2024`,
    ],
    name:
      kind === "aberration"
        ? "Вызов аберрации · Summon Aberration"
        : "Вызов конструкта · Summon Construct",
    editions: ["2024"],
    level: 4,
    school: "Вызов",
    classes:
      kind === "aberration" ? ["wizard", "warlock"] : ["artificer", "wizard"],
    concentration: true,
    ritual: false,
    castingTime: "Action",
    range: "90 feet",
    duration: "1 hour",
    components:
      kind === "aberration"
        ? "V, S, M (preserved tentacle and eyeball in a platinum-inlaid vial worth 400+ GP)"
        : "V, S, M (lockbox worth 400+ GP)",
    summary:
      "Призванный дух действует сразу после вас и подчиняется словесным приказам без затраты действия.",
    descriptionRu: `Призовите союзного духа в видимое свободное место в 90 фт. Выберите ${kind === "aberration" ? "форму: свежеватель разума, слаад или созерцатель. Материал — заспиртованные щупальце и глаз в сосуде с платиновой инкрустацией стоимостью от 400 зм" : "материал: глина, камень или металл. Компонент — шкатулка стоимостью от 400 зм"}. Дух использует приведённый здесь блок статистики; его параметры зависят от круга ячейки. Он ходит сразу после вас с той же инициативой. Приказы словесные, без действия; без приказа — Уклонение и безопасное перемещение. Исчезает при 0 хитов или окончании заклинания.`,
    description: `Summon an allied spirit into a visible unoccupied space within 90 feet. Choose ${kind === "aberration" ? "Beholder, Mind Flayer, or Slaad" : "Clay, Metal, or Stone"}. Use its included spirit stat block with the expended slot level. It takes its turn immediately after yours on your initiative. Verbal orders cost no action; without orders it Dodges and avoids danger. It disappears at 0 HP or when the spell ends. The material component is not consumed.`,
    source: "Player’s Handbook (2024)",
    sourceUrl: `https://next.dnd.su/spells/${kind === "aberration" ? "10659-summon-aberration" : "10661-summon-construct"}/`,
  })),
];

EXTENDED_SPELLS.push({
  id: "blade-ward-2024",
  name: "Защита от оружия · Blade Ward",
  editions: ["2024"],
  level: 0,
  school: "Ограждение",
  classes: ["bard", "sorcerer", "warlock", "wizard"],
  concentration: true,
  ritual: false,
  castingTime: "Action",
  range: "Self",
  duration: "1 minute",
  components: "V, S",
  source: "Player’s Handbook (2024)",
  sourceUrl: "https://next.dnd.su/spells/10444-blade-ward/",
  summary:
    "Концентрация до 1 минуты: каждое существо, атакующее вас, вычитает 1d4 из своего броска атаки.",
  descriptionRu:
    "Пока поддерживаете концентрацию, не дольше 1 минуты, каждое существо, совершающее бросок атаки по вам, вычитает 1d4 из результата этой атаки.",
  description:
    "For up to 1 minute while you maintain Concentration, each creature making an attack roll against you subtracts 1d4 from that attack roll.",
});

EXTENDED_SPELLS.push({
  id: "wrathful-smite-2024",
  name: "Гневная кара · Wrathful Smite",
  editions: ["2024"],
  level: 1,
  school: "Некромантия",
  classes: ["paladin"],
  concentration: false,
  ritual: false,
  castingTime:
    "Bonus Action, immediately after hitting with a melee weapon or Unarmed Strike",
  range: "Self",
  duration: "1 minute",
  components: "V",
  source: "Player’s Handbook (2024)",
  sourceUrl: "https://next.dnd.su/spells/10707-wrathful-smite",
  summary:
    "После попадания: некротический урон и спасбросок Мудрости против испуга.",
  descriptionRu:
    "Бонусным действием сразу после попадания рукопашным оружием или безоружным ударом нанесите цели дополнительно 1d6 некротического урона. Она делает спасбросок Мудрости; при провале напугана на 1 минуту. В конце каждого своего хода напуганная цель повторяет спасбросок, успех заканчивает на ней заклинание. Концентрация не требуется. Ячейка выше 1 круга добавляет по 1d6 урона за каждый дополнительный круг.",
  description:
    "As a Bonus Action immediately after hitting with a melee weapon or Unarmed Strike, add 1d6 Necrotic damage to that hit. The target makes a Wisdom save; failure causes Frightened for 1 minute. While Frightened, it repeats the save at the end of each of its turns, ending the spell on a success. No Concentration is required. Each slot level above 1 adds 1d6 damage.",
});

EXTENDED_SPELLS.push({
  id: "fount-of-moonlight-2024",
  name: "Источник лунного света · Fount of Moonlight",
  editions: ["2024"],
  level: 4,
  school: "Воплощение",
  classes: ["bard", "druid"],
  castingTime: "Action",
  range: "Self",
  duration: "10 minutes",
  components: "V, S",
  concentration: true,
  ritual: false,
  source: "Player’s Handbook (2024)",
  sourceUrl: "https://next.dnd.su/spells/10522-fount-of-moonlight",
  summary:
    "Лунное сияние даёт сопротивление излучению, усиливает рукопашные атаки и ослепляет нападающих.",
  descriptionRu:
    "На время концентрации излучайте яркий свет 20 фт. и тусклый ещё 20 фт.; получите сопротивление излучению, а попадания рукопашными атаками наносят +2d6 излучения. Сразу после получения урона от видимого существа в 60 фт. можно реакцией заставить его сделать спасбросок Телосложения; при провале оно Ослеплено до конца вашего следующего хода.",
  description:
    "While concentrating, shed Bright Light 20 ft. and Dim Light another 20 ft., gain Resistance to Radiant damage, and add 2d6 Radiant damage to hits with your melee attacks. Immediately after a visible creature within 60 ft. damages you, you may use a Reaction to force its Constitution save; failure Blinds it until the end of your next turn.",
});
