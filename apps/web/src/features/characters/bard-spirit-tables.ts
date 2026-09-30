import type {
  RandomEffectTable,
  RandomEffectRow,
} from "./random-effect-tables";
const r = (n: number, ru: string, en: string): RandomEffectRow => ({
  from: n,
  to: n,
  text: { ru, en },
});
const note = {
  ru: "Бросается кость вдохновения барда: d6 на уровнях 3–4, d8 на 5–9, d10 на 10–14, d12 на 15–20. Здесь приведены все 12 результатов, но обычный бросок ограничен текущей костью. «Кость» ниже означает вашу кость вдохновения; Сл — сложность ваших заклинаний барда. Неофициальное изложение механики.",
  en: "Roll the Bardic Inspiration die: d6 at levels 3–4, d8 at 5–9, d10 at 10–14, d12 at 15–20. All 12 results are listed, but a normal roll is limited by the current die. “Die” below means your Inspiration die; DC means your Bard spell save DC. Independently worded rules reference.",
};
export const BARD_SPIRIT_TABLES: RandomEffectTable[] = [
  {
    id: "bard-spirits-2014",
    edition: "2014",
    die: 12,
    dieLabel: { ru: "Кость вдохновения", en: "Inspiration die" },
    name: { ru: "Истории духов", en: "Spirit Tales" },
    note,
    sourceUrl: "https://dnd.su/class/88-bard/#college.spirits",
    checkedAt: "2026-09-29",
    rows: [
      r(
        1,
        "Умное животное. На 10 минут цель после каждого d20 проверки Интеллекта, Мудрости или Харизмы может бросить дополнительную кость и добавить результат к проверке.",
        "Clever Animal. For 10 minutes, after each Intelligence, Wisdom, or Charisma check’s d20, the target may roll an additional die and add it to the check.",
      ),
      r(
        2,
        "Знаменитый дуэлянт. Совершите рукопашную атаку заклинанием по цели; попадание наносит силовой урон на два броска кости + ваш модификатор Харизмы.",
        "Renowned Duelist. Make a melee spell attack against the target; a hit deals Force damage equal to two die rolls + your Charisma modifier.",
      ),
      r(
        3,
        "Возлюбленные друзья. Цель и другое выбранное ею видимое существо в 5 фт. получают временные хиты: бросок кости + ваш модификатор Харизмы.",
        "Beloved Friends. The target and another creature it chooses and can see within 5 feet gain Temporary HP equal to a die roll + your Charisma modifier.",
      ),
      r(
        4,
        "Беглец. Цель немедленно может реакцией телепортироваться до 30 фт. в видимое свободное место. При этом до вашего модификатора Харизмы (минимум 0) выбранных ею видимых существ в 30 фт. могут сразу сделать то же своими реакциями.",
        "Runaway. The target may immediately use its Reaction to teleport up to 30 feet to a visible unoccupied space. When it does, up to your Charisma modifier (minimum 0) creatures it chooses and sees within 30 feet may immediately do the same with their Reactions.",
      ),
      r(
        5,
        "Мститель. На 1 минуту любое существо, попавшее по цели рукопашной атакой, получает силовой урон на бросок кости.",
        "Avenger. For 1 minute, any creature hitting the target with a melee attack takes Force damage equal to a die roll.",
      ),
      r(
        6,
        "Путешественник. Временные хиты: бросок кости + ваш уровень барда. Пока эти хиты остаются, скорость ходьбы цели +10 фт. и КД +1.",
        "Traveler. Temporary HP equal a die roll + your Bard level. While those HP remain, the target gains +10 feet Walking Speed and +1 AC.",
      ),
      r(
        7,
        "Обольститель. Спасбросок Мудрости; при провале цель получает психический урон на два броска кости и недееспособна до конца своего следующего хода. Успех предотвращает оба эффекта.",
        "Beguiler. Wisdom save; failure deals Psychic damage equal to two die rolls and Incapacitates the target until its next turn ends. Success prevents both effects.",
      ),
      r(
        8,
        "Фантом. Цель невидима до конца своего следующего хода либо до попадания атакой по существу. Если такое попадание произошло во время этой невидимости, жертва получает дополнительный некротический урон на бросок кости и испугана целью до конца своего следующего хода.",
        "Phantom. The target is Invisible until its next turn ends or it hits a creature with an attack. Such a hit during this invisibility deals an additional die of Necrotic damage, and the victim is Frightened of the target until the victim’s next turn ends.",
      ),
      r(
        9,
        "Зверь. Выбранные целью видимые существа в 30 фт. делают спасбросок Силы. Провал: звуковой урон на три броска кости и падение ничком. Успех: половина урона, без падения.",
        "Brute. Creatures the target chooses and sees within 30 feet make Strength saves. Failure: Thunder damage equal to three die rolls and Prone. Success: half damage without falling Prone.",
      ),
      r(
        10,
        "Дракон. Цель выпускает огонь конусом 30 фт. Существа в области делают спасбросок Ловкости: четыре броска кости урона огнём при провале, половина при успехе.",
        "Dragon. The target releases a 30-foot Cone of fire. Creatures inside make Dexterity saves: four die rolls of Fire damage on failure, half on success.",
      ),
      r(
        11,
        "Ангел. Цель восстанавливает хиты на два броска кости + ваш модификатор Харизмы; закончите одно из её состояний: Оглохший, Окаменевший, Отравленный, Парализованный или Ослеплённый.",
        "Angel. The target regains HP equal to two die rolls + your Charisma modifier; end one of its conditions: Deafened, Petrified, Poisoned, Paralyzed, or Blinded.",
      ),
      r(
        12,
        "Повелитель разума. Спасбросок Интеллекта: провал наносит психический урон на три броска кости и ошеломляет до конца следующего хода цели. Успех предотвращает оба эффекта.",
        "Mind-Bender. Intelligence save: failure deals Psychic damage equal to three die rolls and Stuns the target until its next turn ends. Success prevents both effects.",
      ),
    ],
  },
  {
    id: "bard-spirits-2024",
    edition: "2024",
    die: 12,
    dieLabel: { ru: "Кость вдохновения", en: "Inspiration die" },
    name: { ru: "Замогильные духи", en: "Spirits from Beyond" },
    note,
    sourceUrl: "https://next.dnd.su/class/bard",
    checkedAt: "2026-09-29",
    rows: [
      r(
        1,
        "Возлюбленный. Цель восстанавливает хиты на бросок кости + ваш модификатор Харизмы.",
        "Beloved. The target regains HP equal to a die roll + your Charisma modifier.",
      ),
      r(
        2,
        "Стрелок. Цель получает силовой урон на бросок кости + ваш модификатор Харизмы.",
        "Marksman. The target takes Force damage equal to a die roll + your Charisma modifier.",
      ),
      r(
        3,
        "Мститель. До конца вашего следующего хода существа, попадающие по цели броском рукопашной атаки, получают силовой урон на бросок кости.",
        "Avenger. Until your next turn ends, creatures hitting the target with a melee attack roll take Force damage equal to a die roll.",
      ),
      r(
        4,
        "Отступник. Цель может немедленно реакцией телепортироваться до 30 фт. в видимое свободное место.",
        "Runaway. The target may immediately use its Reaction to teleport up to 30 feet to a visible unoccupied space.",
      ),
      r(
        5,
        "Предсказатель. До начала вашего следующего хода цель совершает все проверки d20 с преимуществом.",
        "Seer. The target has Advantage on every D20 Test until your next turn starts.",
      ),
      r(
        6,
        "Странник. Цель получает временные хиты на бросок кости + ваш уровень барда. Пока эти хиты остаются, скорость цели увеличена на 10 фт.",
        "Traveler. The target gains Temporary HP equal to a die roll + your Bard level. While those HP remain, its Speed increases by 10 feet.",
      ),
      r(
        7,
        "Проказник. Спасбросок Мудрости: при провале два броска кости психического урона и очарование до начала вашего следующего хода. При успехе — только половина урона.",
        "Trickster. Wisdom save: failure deals two die rolls of Psychic damage and Charms the target until your next turn starts. Success deals only half damage.",
      ),
      r(
        8,
        "Тень. Цель невидима до конца своего следующего хода либо до атаки, урона или заклинания. Когда невидимость заканчивается, все существа в исходящей от цели эманации 5 фт. делают спасбросок Телосложения: провал наносит два броска кости некротического урона, успех предотвращает урон.",
        "Shade. The target is Invisible until its next turn ends, or until it makes an attack roll, deals damage, or casts a spell. When invisibility ends, every creature in a 5-foot Emanation from it makes a Constitution save: failure deals two die rolls of Necrotic damage; success prevents damage.",
      ),
      r(
        9,
        "Поджигатель. Цель совершает спасбросок Ловкости: четыре броска кости урона огнём при провале, половина при успехе.",
        "Firebrand. The target makes a Dexterity save: four die rolls of Fire damage on failure, half on success.",
      ),
      r(
        10,
        "Трус. Цель и выбранные вами существа в исходящей от неё эманации 30 фт. делают спасбросок Мудрости. Провал: испуганы до начала вашего следующего хода, скорость вдвое меньше (округление вниз), в свой ход могут совершить действие либо бонусное действие, но не оба.",
        "Coward. The target and creatures you choose in its 30-foot Emanation make Wisdom saves. Failure: Frightened until your next turn starts, Speed halved (round down), and on their turn they may take an action or Bonus Action, not both.",
      ),
      r(
        11,
        "Силач. Выбранные вами существа в исходящей от цели эманации 30 фт. делают спасбросок Силы. Провал: три броска кости звукового урона и падение ничком. Успех: только половина урона.",
        "Brute. Creatures you choose in the target’s 30-foot Emanation make Strength saves. Failure: three die rolls of Thunder damage and Prone. Success: only half damage.",
      ),
      r(
        12,
        "Жрец. Цель восстанавливает хиты на два броска кости; закончите одно выбранное состояние: Оглохший, Ослеплённый, Отравленный, Очарованный, Ошеломлённый или Парализованный.",
        "Priest. The target regains HP equal to two die rolls; end one chosen condition: Deafened, Blinded, Poisoned, Charmed, Stunned, or Paralyzed.",
      ),
    ],
  },
];
