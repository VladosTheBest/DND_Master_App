import type { SpellOption } from "./rules-data";
export const WARLOCK_SPELLS: SpellOption[] = [
  {
    id: "phantasmal-force-2014",
    name: "Воображаемая сила · Phantasmal Force",
    editions: ["2014"],
    level: 2,
    school: "Иллюзия",
    classes: ["bard", "wizard", "sorcerer"],
    castingTime: "Action",
    range: "60 feet",
    duration: "1 minute",
    components: "V, S, M (a bit of fleece)",
    concentration: true,
    ritual: false,
    source: "Player’s Handbook",
    sourceUrl: "https://dnd.su/spells/31-phantasmal_force/",
    summary:
      "При провале спасброска Интеллекта цель воспринимает личную иллюзию объёмом до куба 10 фт.",
    descriptionRu:
      "Видимое существо делает спасбросок Интеллекта; нежить и конструкты невосприимчивы. При провале только цель воспринимает созданный вами предмет, существо или явление в кубе 10 фт., включая звуки, температуру и другие ощущения. Она считает его реальным и объясняет несоответствия сама. Действием может проверить Интеллект (Расследование) против вашей Сл; успех раскрывает иллюзию и заканчивает заклинание. Каждый раунд в ваш ход опасная иллюзия может нанести 1d6 психического урона цели, если она внутри её области либо в 5 фт. от иллюзорного существа/опасности, способного причинить урон. Цель воспринимает тип урона соответственно иллюзии.",
    description:
      "A visible creature makes an Intelligence save; Undead and Constructs are unaffected. On failure, only the target perceives your illusory object, creature, or phenomenon fitting a 10-foot cube, with sound, temperature, and other sensations. It treats the illusion as real and rationalizes inconsistent interactions. As an action it may make an Intelligence (Investigation) check against your spell DC; success reveals the illusion and ends the spell. Each round on your turn, a harmful illusion may deal 1d6 Psychic damage if the target is in its area or within 5 ft. of an illusory creature or hazard capable of causing damage. The target perceives a damage type appropriate to the illusion.",
  },
  {
    id: "feign-death-2014",
    name: "Притворная смерть · Feign Death",
    editions: ["2014"],
    level: 3,
    school: "Некромантия",
    classes: ["bard", "wizard", "druid", "cleric"],
    castingTime: "Action",
    range: "Touch",
    duration: "1 hour",
    components: "V, S, M (a pinch of graveyard dirt)",
    concentration: false,
    ritual: true,
    source: "Player’s Handbook",
    sourceUrl: "https://dnd.su/spells/280-feign_death/",
    summary:
      "Согласная цель кажется мёртвой, становится недееспособной и получает сопротивление почти всему урону.",
    descriptionRu:
      "Коснитесь согласного существа: на 1 час оно кажется мёртвым при любом осмотре и для заклинаний, определяющих его состояние. Оно ослеплено, недееспособно, имеет скорость 0 и сопротивление всему урону кроме психического. Болезни и яды, уже действующие или полученные за это время, не оказывают эффекта до конца заклинания. Вы можете раньше закончить его действием, коснувшись цели.",
    description:
      "Touch a willing creature. For 1 hour it appears dead to inspection and spells that determine its status. It is Blinded and Incapacitated, has Speed 0, and resists all damage except Psychic. Diseases and poisons already present or acquired during the spell have no effect until it ends. You may end it early by touching the target as an action.",
  },
  {
    id: "summon-celestial-2024",
    name: "Вызов небожителя · Summon Celestial",
    editions: ["2024"],
    level: 5,
    school: "Вызов",
    classes: ["cleric", "paladin"],
    castingTime: "Action",
    range: "90 feet",
    duration: "1 hour",
    components: "V, S, M (a reliquary worth 500+ GP)",
    concentration: true,
    ritual: false,
    source: "Player’s Handbook (2024)",
    sourceUrl: "https://next.dnd.su/spells/10660-summon-celestial",
    creatureReferenceIds: ["celestial-spirit-2024"],
    summary:
      "Призовите союзного духа Защитника или Мстителя; его полный блок характеристик приведён здесь.",
    descriptionRu:
      "Призовите духа небожителя в видимом свободном месте в дистанции, выбрав Защитника или Мстителя. Используйте встроенный блок с кругом потраченной ячейки во всех формулах. Дух — союзник вам и союзникам, имеет вашу инициативу и ходит сразу после вас. Словесные приказы не требуют вашего действия; без приказов Уклоняется и избегает опасности перемещением. Исчезает при 0 хитов или окончании заклинания.",
    description:
      "Summon a Celestial Spirit in a visible unoccupied space within range, choosing Defender or Avenger. Use the included block with the expended slot level in its formulas. It is allied with you and your allies, shares your Initiative, and acts immediately after you. Verbal commands cost no action; without orders it Dodges and moves away from danger. It disappears at 0 HP or when the spell ends.",
  },
];
for (const waterOnly of [false, true])
  WARLOCK_SPELLS.push({
    id: waterOnly ? "summon-elemental-water-2014" : "summon-elemental-2014",
    name: waterOnly
      ? "Призыв духа стихии — только вода · Summon Elemental (Water Only)"
      : "Призыв духа стихии · Summon Elemental",
    editions: ["2014"],
    level: 4,
    school: "Вызов",
    classes: waterOnly ? ["warlock"] : ["wizard", "druid", "ranger"],
    ...(waterOnly ? { subclassOnly: ["fathomless"] } : {}),
    castingTime: "Action",
    range: "90 feet",
    duration: "1 hour",
    components:
      "V, S, M (air, a pebble, ash, and water in a gold-inlaid vial worth at least 400 GP)",
    concentration: true,
    ritual: false,
    source: "Tasha’s Cauldron of Everything",
    sourceUrl: "https://dnd.su/spells/3068-summon_elemental/",
    creatureReferenceIds: [
      waterOnly ? "elemental-water-spirit-2014" : "elemental-spirit-2014",
    ],
    summary:
      "Призванный дух ходит сразу после вас, следует словесным приказам и использует встроенный блок.",
    descriptionRu: `В видимом свободном месте в дистанции призовите духа стихии. ${waterOnly ? "Расширенный список Бездонного разрешает только водяную форму." : "Выберите воздух, землю, огонь или воду."} Используйте встроенные характеристики и круг потраченной ячейки во всех формулах. Дух дружественен вам и вашим спутникам, имеет вашу инициативу и ходит сразу после вас. Словесные приказы не требуют действия. Без приказов Уклоняется и двигается, избегая опасности. Исчезает при 0 хитов или окончании заклинания.`,
    description: `Summon an Elemental Spirit in a visible unoccupied space within range. ${waterOnly ? "The Fathomless expanded list permits only Water." : "Choose Air, Earth, Fire, or Water."} Use the included statistics and expended slot level in all formulas. It is friendly to you and your companions, shares your Initiative, and acts immediately after you. Verbal commands cost no action. Without orders it Dodges and moves away from danger. It vanishes at 0 HP or when the spell ends.`,
  });

for (const [id, name, level, path, ru, en] of [
  [
    "wrathful-smite",
    "Гневная кара · Wrathful Smite",
    1,
    "46-wrathful_smite",
    "Следующее попадание рукопашной атакой оружием за время концентрации наносит +1d6 психического урона. Цель-существо делает спасбросок Мудрости; провал пугает её до конца заклинания. Действием она может проверить Мудрость против вашей Сл; успех заканчивает заклинание. Это проверка характеристики, а не повторный спасбросок.",
    "Your next melee weapon hit while concentrating adds 1d6 Psychic damage. A creature target makes a Wisdom save or becomes Frightened until the spell ends. It may use an action to make a Wisdom ability check against your spell DC, ending the spell on success. This is an ability check, not another save.",
  ],
  [
    "staggering-smite",
    "Оглушающая кара · Staggering Smite",
    4,
    "200-staggering_smite",
    "Следующее попадание рукопашной атакой оружием по существу за время концентрации наносит +4d6 психического урона. Цель делает спасбросок Мудрости. При провале до конца её следующего хода атаки и проверки характеристик имеют помеху, реакции недоступны.",
    "Your next melee weapon hit against a creature while concentrating adds 4d6 Psychic damage. The target makes a Wisdom save. Failure imposes Disadvantage on attacks and ability checks and prevents Reactions until the end of its next turn.",
  ],
  [
    "banishing-smite",
    "Изгоняющая кара · Banishing Smite",
    5,
    "117-banishing_smite",
    "Следующее попадание атакой оружием по существу за время концентрации наносит +5d10 силового урона. Если после атаки у цели 50 хитов или меньше, она изгнана без спасброска: существо с другого плана возвращается на родной план; местное исчезает в безопасном демиплане, где недееспособно до конца заклинания. Тогда местная цель возвращается в прежнее или ближайшее свободное место.",
    "Your next weapon hit against a creature while concentrating adds 5d10 Force damage. If the target has 50 HP or fewer after the attack, it is banished without a save. An extraplanar target returns to its home plane. A native target disappears into a safe demiplane, Incapacitated until the spell ends, then returns to its former space or the nearest unoccupied space.",
  ],
] as [string, string, number, string, string, string][])
  WARLOCK_SPELLS.push({
    id: id + "-2014",
    name,
    editions: ["2014"],
    level,
    school: level === 5 ? "Ограждение" : "Воплощение",
    classes: ["paladin"],
    castingTime: "Bonus Action",
    range: "Self",
    duration: "1 minute",
    components: "V",
    concentration: true,
    ritual: false,
    source: "Player’s Handbook",
    sourceUrl: "https://dnd.su/spells/" + path + "/",
    summary: ru,
    descriptionRu: ru,
    description: en,
  });
WARLOCK_SPELLS.push({
  id: "summon-undead-2024",
  name: "Вызов нежити · Summon Undead",
  editions: ["2024"],
  level: 3,
  school: "Некромантия",
  classes: ["wizard", "warlock"],
  castingTime: "Action",
  range: "90 feet",
  duration: "1 hour",
  components: "V, S, M (gilded skull worth 300+ GP)",
  concentration: true,
  ritual: false,
  source: "Player’s Handbook (2024)",
  sourceUrl: "https://next.dnd.su/spells/10664-summon-undead",
  creatureReferenceIds: ["undead-spirit-2024"],
  summary:
    "Призовите Гнилостного, Скелетного или Призрачного духа; полный блок характеристик включён.",
  descriptionRu:
    "Призовите духа нежити в видимом свободном месте в дистанции, выбрав Гнилостную, Скелетную или Призрачную форму. Используйте встроенный блок и круг потраченной ячейки во всех формулах. Дух — союзник вам и союзникам, имеет вашу инициативу и ходит сразу после вас. Словесные приказы не требуют вашего действия; без них Уклоняется и перемещается, избегая опасности. Исчезает при 0 хитов или конце заклинания.",
  description:
    "Summon an Undead Spirit in a visible unoccupied space within range, choosing Putrid, Skeletal, or Ghostly form. Use the included block and expended slot level in all formulas. The spirit is allied with you and your allies, shares your Initiative, and acts immediately after you. Verbal commands cost no action; without them it Dodges and moves away from danger. It disappears at 0 HP or when the spell ends.",
});
