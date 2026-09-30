import type { RuleItem } from "./rule-items";
const additionalRarePlans: RuleItem[] = [
  {
    id: "bag-of-beans-2024", edition: "2024", name: { ru: "Сумка с бобами", en: "Bag of Beans" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15846-bag-of-beans", randomTableId: "bag-beans-2024",
    rules: {
      ru: "Без настройки. 3d4 бобов; вес сумки всегда ½ фунта. Без бобов она немагическая. Высыпанные из сумки один или несколько бобов уничтожаются взрывом радиусом 10 фт.: каждое существо в Сфере, включая вас, делает спасбросок Ловкости Сл 15, получая 5d4 силового урона при провале или половину при успехе. Вместо высыпания извлеките один, посадите в землю или песок и полейте: боб исчезает, через 1 минуту в этом месте возникает выбранный мастером или определённый таблицей эффект.",
      en: "No attunement. Holds 3d4 beans and always weighs ½ pound; empty, it is nonmagical. Dumping one or more beans destroys them in a 10-foot-radius Sphere explosion: every creature there, including you, makes a DC 15 Dexterity save, taking 5d4 Force damage on failure or half on success. Instead, remove one, plant it in soil or sand, and water it: the bean disappears, producing a DM-chosen or rolled table effect at that location after 1 minute."
    }
  },
  {
    id: "cube-of-summoning-2024", edition: "2024", name: { ru: "Куб вызова", en: "Cube of Summoning" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15895-cube-of-summoning", randomTableId: "cube-summoning-2024",
    rules: {
      ru: "Без настройки. Действием Магия поверните ручку: куб открывается и закрывается, призывая существо в ближайшее свободное пространство. Иным способом открыть крышку нельзя. Бросьте d6 по таблице: соответствующее заклинание сотворяется 5-м кругом, Сл 17, атака заклинанием +9, без Концентрации; в остальном заклинатель — вы. После призыва повторное применение на следующем рассвете.",
      en: "No attunement. Turn the handle as a Magic action: the cube opens and closes, summoning a creature in the nearest unoccupied space. The lid cannot open otherwise. Roll d6 on the table: the resulting spell is cast at level 5, DC 17, spell attack +9, without Concentration; you otherwise count as its caster. Reusable at the next dawn after summoning."
    }
  },
  {
    id: "helm-of-teleportation-2024", edition: "2024", name: { ru: "Шлем телепортации", en: "Helm of Teleportation" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15958-helm-of-teleportation", spellIds: ["teleport-2024"],
    rules: {
      ru: "Требуется настройка. 3 заряда, восстановление 1d3 на рассвете. Пока шлем надет, потратьте 1 заряд, чтобы сотворить Телепортацию. Выберите соответствующую ознакомленности таблицу исходов в карточке заклинания.",
      en: "Requires attunement. Holds 3 charges and regains 1d3 at dawn. While wearing it, spend 1 charge to cast Teleport. Use the outcome table matching your familiarity in the spell reference."
    }
  },
  {
    id: "necklace-of-prayer-beads-2024", edition: "2024", name: { ru: "Ожерелье молитвенных чёток", en: "Necklace of Prayer Beads" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15998-necklace-of-prayer-beads", randomTableId: "prayer-beads-2024",
    rules: {
      ru: "Требуется настройка Друидом, Жрецом или Паладином. 1d4 + 2 магические бусины; тип каждой определяет мастер по таблице, повторения допустимы. Снятая с ожерелья бусина теряет магию. Пока ожерелье надето, сотворяйте заклинание выбранной бусины бонусным действием со своей Сл заклинаний. Каждая использованная бусина восстанавливается на следующем рассвете.",
      en: "Requires attunement by a Druid, Cleric, or Paladin. Holds 1d4 + 2 magic beads; the DM determines each type from the table, allowing duplicates. Removing a bead from the necklace removes its magic. While wearing it, cast a bead’s spell as a Bonus Action using your spell save DC. Each used bead recharges at the next dawn."
    }
  },
  {
    id: "figurine-of-wondrous-power-ivory-goats-2024", edition: "2024", name: { ru: "Статуэтка чудесной силы (костяные козлы)", en: "Figurine of Wondrous Power (Ivory Goats)" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/17786-figurine-of-wondrous-power-ivory-goats", creatureIds: ["giant-goat-2024", "riding-horse-2024"],
    rules: {
      ru: "Без настройки. Набор из трёх разных фигурок. Действием Магия бросьте выбранную на землю в 60 фт.; если места недостаточно или оно занято существами/предметами, превращения нет. Существо Дружелюбно к вам и союзникам, понимает ваши языки, исполняет команды, имеет вашу инициативу и ходит сразу после вас; без команд только защищается. Возвращается в форму фигурки по истечении своего срока, при 0 хитов либо при вашем касании действием Магия. Отсчёт повторного применения начинается после возвращения. Рога козла ужаса — воинское рукопашное оружие: копьё +1 к атаке и урону, 1d10 колющего, досягаемость увеличена на 5 фт., Тяжёлое (Помеха атакам при Силе ниже 13), Двуручное, кроме езды верхом; меч +2 к атаке и урону, 1d8 рубящего или 1d10 двумя руками. Если умение открывает мастерство соответствующего оружия: копьё при попадании может Опрокинуть, спасбросок Телосложения Сл 8 + модификатор атаки + БМ; меч при попадании даёт цели Помеху на следующую атаку до начала вашего следующего хода.",
      en: "No attunement. A set of three different figurines. Use a Magic action to throw one onto the ground within 60 feet; insufficient or creature/object-occupied space prevents transformation. Friendly to you and your allies, it understands your languages, obeys commands, shares your initiative, and acts immediately after you; without orders it only defends itself. It reverts at its duration limit, 0 HP, or your Magic-action touch. Cooldowns start on reversion. Terror’s horns are Martial Melee weapons: Lance +1 to attack and damage, 1d10 Piercing, +5-foot reach, Heavy (Disadvantage on attacks with Strength below 13), Two-Handed unless mounted; Longsword +2 to attack and damage, 1d8 Slashing or 1d10 with two hands. If a feature unlocks the relevant weapon mastery: the lance can Topple on a hit, Constitution save DC 8 + attack ability modifier + PB; the sword’s hit imposes Disadvantage on the target’s next attack before the start of your next turn."
    },
    table: {
      columns: [{ ru: "Козёл", en: "Goat" }, { ru: "Правила", en: "Rules" }],
      rows: [
        [{ ru: "Ужаса", en: "Terror" }, {
          ru: "Гигантский козёл, 3 часа, повтор через 15 дней. Не атакует. Действием Магия безболезненно отделите рог как копьё +1 или меч +2; при возвращении в фигурку оружие исчезает и рога восстанавливаются. Пока вы верхом, Враждебное существо в начале хода в Эманации 30 фт. делает спасбросок Мудрости Сл 15; провал — Испуг до 1 минуты, вашего спешивания или превращения козла в фигурку. Повтор в конце каждого хода, успех заканчивает эффект. Успех любого такого спасброска даёт иммунитет на 24 часа.",
          en: "Giant Goat for 3 hours; 15-day cooldown. Cannot attack. A Magic action painlessly detaches a horn as a +1 Lance or +2 Longsword; reversion makes weapons vanish and restores horns. While you ride it, a Hostile creature starting its turn in a 30-foot Emanation makes a DC 15 Wisdom save or is Frightened for up to 1 minute, until you dismount, or until reversion. Repeat at each turn’s end, ending on success. Any success grants immunity for 24 hours."
        }],
        [{ ru: "Путешествия", en: "Travel" }, {
          ru: "Большой козёл с параметрами Ездовой лошади. 24 заряда, можно активировать при наличии хотя бы одного. Каждый час или часть часа в форме козла расходует 1 заряд. При 0 возвращается в фигурку, недоступен 7 дней, затем восстанавливает все заряды.",
          en: "Large goat with Riding Horse statistics. Has 24 charges and can transform while at least one remains. Each hour or fraction of an hour in goat form spends 1 charge. At 0 it reverts, is unavailable for 7 days, then regains all charges."
        }],
        [{ ru: "Труда", en: "Travail" }, { ru: "Гигантский козёл на 3 часа; повтор через 30 дней.", en: "Giant Goat for 3 hours; 30-day cooldown." }]
      ]
    }
  },
  {
    id: "cube-of-force-2024", edition: "2024", name: { ru: "Куб силы", en: "Cube of Force" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15894-cube-of-force",
    spellIds: ["mage-armor-2024", "shield-2024", "tiny-hut-2024", "private-sanctum-2024", "resilient-sphere-2024", "wall-of-force-2024"],
    rules: {
      ru: "Требуется настройка. Куб со стороной 1 дюйм имеет 10 зарядов и восстанавливает 1d6 на рассвете. Нажмите соответствующую грань и потратьте заряды из таблицы, чтобы сотворить заклинание со Сл 17. Применяется обычное время сотворения выбранного заклинания, включая реакцию и её условие для Щита.",
      en: "Requires attunement. A 1-inch cube holding 10 charges and regaining 1d6 at dawn. Press the corresponding face and spend the listed charges to cast its spell with DC 17. Use the selected spell’s normal casting time, including Shield’s Reaction and trigger."
    },
    table: {
      columns: [{ ru: "Заклинание", en: "Spell" }, { ru: "Заряды", en: "Charges" }],
      rows: [
        [{ ru: "Доспехи мага", en: "Mage Armor" }, { ru: "1", en: "1" }],
        [{ ru: "Щит", en: "Shield" }, { ru: "1", en: "1" }],
        [{ ru: "Хижина Леомунда", en: "Tiny Hut" }, { ru: "3", en: "3" }],
        [{ ru: "Кабинет Морденкайнена", en: "Private Sanctum" }, { ru: "4", en: "4" }],
        [{ ru: "Упругий шар Отилюка", en: "Resilient Sphere" }, { ru: "4", en: "4" }],
        [{ ru: "Силовая стена", en: "Wall of Force" }, { ru: "5", en: "5" }]
      ]
    }
  },
  {
    id: "magen-handbell-2024", edition: "2024", name: { ru: "Колокольчик магена", en: "Magen Handbell" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/17498-magen-handbell", creatureIds: ["terran-magen-2024"],
    rules: {
      ru: "Без настройки. Держа колокольчик, действием Магия позвоните: Маген-земельник появляется в выбранном свободном пространстве в 30 фт. Понимает ваши языки, исполняет команды, имеет вашу инициативу и ходит сразу после вас. Исчезает через 1 час, при смерти или при отпускании бонусным действием. После использования колокольчик недоступен 1d6 дней. В начале каждого хода магена с половиной максимума хитов или меньше бросьте d6: на 6 он впадает в бешенство, перестаёт подчиняться и не может быть отпущен бонусным действием. Каждый ход атакует ближайшее видимое существо; если за ход с перемещением не может достичь существа для атаки, атакует объект. Бешенство заканчивается с исчезновением либо когда держатель колокольчика действием Влияние преуспеет в проверке Харизмы (Убеждение) Сл 15, восстановив контроль.",
      en: "No attunement. Ring the held bell with a Magic action to summon a Terran Magen in a chosen unoccupied space within 30 feet. It understands your languages, obeys commands, shares your initiative, and acts immediately after you. Disappears after 1 hour, on death, or when dismissed as a Bonus Action. The bell is then unavailable for 1d6 days after use. Whenever the magen starts its turn at half maximum HP or less, roll d6: on 6 it goes berserk, stops obeying, and cannot be dismissed as a Bonus Action. Each turn it attacks the nearest visible creature, or an object if movement during the turn cannot bring a creature within attacking reach. Berserk behavior ends when it disappears or the bell’s holder succeeds on a DC 15 Charisma (Persuasion) check using an Influence action to restore control."
    }
  },
  {
    id: "quaals-feather-token-bird-2024", edition: "2024", name: { ru: "Перо Кваля (птица)", en: "Quaal’s Feather Token (Bird)" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/17782-quaals-feather-token-bird", creatureIds: ["roc-2024"],
    rules: {
      ru: "Без настройки, одноразовое. Действием Магия подбросьте перо на 5 фт.: оно исчезает, появляется птица с параметрами Рух, но не способная атаковать и исполняющая ваши простые приказы. Переносит до 500 фунтов со скоростью 16 миль/ч, не более 144 миль в день, с 1 часом отдыха после каждых 3 часов полёта; до 1000 фунтов — с половинной скоростью. Исчезает, достигнув предельной дневной дистанции, при 0 хитов либо при вашем отпускании действием Магия. Атаки базового статблока недоступны этой птице.",
      en: "No attunement; single use. Take a Magic action to toss the token 5 feet into the air: it vanishes and creates a bird using Roc statistics that cannot attack and obeys your simple commands. Carries up to 500 pounds at 16 mph, at most 144 miles per day, resting 1 hour after every 3 hours of flight; it carries up to 1,000 pounds at half speed. Disappears on reaching its daily distance limit, at 0 HP, or when you dismiss it with a Magic action. Its base stat block’s attacks are unavailable."
    }
  },
  {
    id: "fork-of-eddy-summoning-2024", edition: "2024", name: { ru: "Камертон призыва вихря", en: "Fork of Eddy Summoning" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/17496-fork-of-eddy-summoning", creatureIds: ["eldritch-eddy-2024"],
    rules: {
      ru: "Без настройки. Действием Магия ударьте камертоном о любой объект: в ближайшем свободном пространстве появляется Магический вихрь. Дружелюбен к вам и союзникам, исполняет команды; без команд только защищается. Инициатива равна вашей, ход сразу после вас. Исчезает через 1 час, при смерти либо при отпускании бонусным действием. После исчезновения повторный призыв доступен на следующем рассвете.",
      en: "No attunement. Use a Magic action to strike any object with the fork, summoning an Eldritch Eddy in the nearest unoccupied space. Friendly to you and your allies, it obeys commands; without orders it only defends itself. It shares your initiative and acts immediately after you. It disappears after 1 hour, on death, or when dismissed as a Bonus Action. After it disappears, summoning becomes available at the next dawn."
    }
  },
  {
    id: "cloak-of-the-bat-2024", edition: "2024", name: { ru: "Плащ летучей мыши", en: "Cloak of the Bat" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15889-cloak-of-the-bat", spellIds: ["polymorph-2024"], creatureIds: ["bat-2024"],
    rules: {
      ru: "Требуется настройка. Пока плащ надет, Преимущество на проверки Ловкости (Скрытность). При тусклом свете или в темноте, держа края плаща обеими руками, получаете Полёт 40 фт.; отпустив края или оказавшись на ярком свету, теряете эту скорость. При тусклом свете или в темноте можно через надетый плащ сотворить Превращение на себя в летучую мышь, сохраняя Интеллект, Мудрость и Харизму. Эта магия восстанавливается на рассвете.",
      en: "Requires attunement. While worn, Advantage on Dexterity (Stealth) checks. In Dim Light or Darkness, holding both edges of the cloak with your hands grants a Fly Speed of 40 feet; releasing them or entering Bright Light removes that speed. In Dim Light or Darkness, cast Polymorph on yourself through the worn cloak to become a Bat while retaining Intelligence, Wisdom, and Charisma. This casting recharges at dawn."
    }
  },
  {
    id: "figurine-of-wondrous-power-serpentine-owl-2024", edition: "2024", name: { ru: "Статуэтка чудесной силы (серпентиновая сова)", en: "Figurine of Wondrous Power (Serpentine Owl)" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/17791-figurine-of-wondrous-power-serpentine-owl", creatureIds: ["giant-owl-2024"],
    rules: {
      ru: "Без настройки. Действием Магия бросьте фигурку на землю в пределах 60 фт.: она становится Гигантской совой на 8 часов. Если места недостаточно либо оно занято существами или предметами, превращения нет. Сова телепатически общается с вами на любом расстоянии в пределах одного плана. Дружелюбна к вам и союзникам, понимает ваши языки и исполняет команды. Инициатива равна вашей, ход сразу после вас; без команд только защищается. Возвращается в форму фигурки по истечении срока, при 0 хитов или от вашего касания действием Магия. Затем недоступна 2 дня.",
      en: "No attunement. Use a Magic action to throw the figurine onto the ground within 60 feet, transforming it into a Giant Owl for 8 hours. Insufficient space or space occupied by creatures or objects prevents transformation. The owl communicates telepathically with you at any distance on the same plane. Friendly to you and your allies, it understands your languages and obeys commands. It shares your initiative, acting immediately after you; without orders it only defends itself. It reverts when time expires, at 0 HP, or when you touch it with a Magic action, then cannot transform for 2 days."
    }
  },
  {
    id: "secret-keepers-circlet-2024", edition: "2024", name: { ru: "Обруч хранителя тайн", en: "Secret Keeper’s Circlet" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21171-secret-keepers-circlet", spellIds: ["wish-2024"],
    rules: {
      ru: "Требуется настройка. Пока обруч надет, действием Магия задайте условие. Если оно выполнится в следующие 24 часа, обруч стирает ваши воспоминания с момента задания условия до его срабатывания. Восстановить их можно только Желанием. Повторное применение доступно на следующем рассвете.",
      en: "Requires attunement. While wearing the circlet, use a Magic action to set a condition. If it occurs within the next 24 hours, the circlet erases your memories from setting the condition to its trigger. Only Wish can restore them. Reusable at the next dawn."
    }
  },
  {
    id: "daerns-instant-fortress-2024", edition: "2024", name: { ru: "Мгновенная крепость Даэрн", en: "Daern’s Instant Fortress" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15897-daerns-instant-fortress", spellIds: ["knock-2024", "wish-2024"],
    rules: {
      ru: "Требуется настройка. Действием Магия поставьте адамантиновую фигурку размером 1 дюйм на землю и произнесите команду: вырастает адамантиновая башня 20 × 20 фт., высотой 30 фт. Повторение команды сворачивает только пустую башню. Существа и неносимые предметы в занимаемом башней месте отодвигаются в свободное пространство у её границы. На стенах бойницы, на крыше зубчатый парапет; два этажа соединены выбранным вами трапом или лестницей, ведущими к люку на крышу. Единственная дверь на первом этаже обращена к вам; открывается только вашей командой бонусным действием, Стук и сходная магия не действуют. Башню нельзя опрокинуть. Дверь, крыша и каждая стена: КЗ 20, 100 хитов; иммунитет к дробящему, колющему и рубящему урону кроме осадного оружия, сопротивление всем остальным типам. Сворачивание не восстанавливает повреждения. Только Желание полностью восстанавливает хиты башни; такое применение считается копированием заклинания 8-го круга или ниже.",
      en: "Requires attunement. Use a Magic action to place the 1-inch adamantine figurine on the ground and speak its command, growing a 20-by-20-foot adamantine tower 30 feet tall. Repeat the command to retract it only when empty. Creatures and unworn, uncarried objects in its footprint move to unoccupied space beside its boundary. Arrow slits line its walls and battlements surround the roof. Two floors connect by a ramp, ladder, or stairs of your choice leading to a roof hatch. Its sole ground-floor door faces you and opens only to your Bonus Action command; Knock and similar magic cannot open it. Magic prevents toppling. Door, roof, and each wall: AC 20, 100 HP, immunity to Bludgeoning, Piercing, and Slashing except siege weapons, resistance to all other damage. Retracting preserves damage. Only Wish repairs it, fully restoring its HP; this use counts as duplicating a spell of level 8 or lower."
    }
  },
  ...([
    ["golden-lions", "золотые львы", "Golden Lions", "17785", "lion", 1, 7],
    ["marble-elephant", "мраморный слон", "Marble Elephant", "17787", "elephant", 24, 7],
    ["bronze-griffon", "бронзовый грифон", "Bronze Griffon", "17784", "griffon", 6, 5],
    ["ebony-fly", "эбеновая муха", "Ebony Fly", "17792", "giant-fly", 12, 2],
    ["onyx-dog", "ониксовая собака", "Onyx Dog", "17789", "onyx-dog", 6, 7],
  ] as const).map(([slug, ru, en, source, creature, hours, days]): RuleItem => ({
    id: `figurine-of-wondrous-power-${slug}-2024`, edition: "2024",
    name: { ru: `Статуэтка чудесной силы (${ru})`, en: `Figurine of Wondrous Power (${en})` },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: `https://next.dnd.su/items/${source}-figurine-of-wondrous-power-${slug}`,
    creatureIds: [`${creature}-2024`],
    rules: {
      ru: `Без настройки. Действием Магия бросьте фигурку на землю в пределах 60 фт.: она становится указанным существом на ${hours} ч. Если места недостаточно либо оно занято существами или предметами, превращения нет. ${slug === "golden-lions" ? "Комплект содержит две фигурки львов; можно активировать одну или обе. " : slug === "ebony-fly" ? "На мухе можно ездить верхом. " : slug === "onyx-dog" ? "Мастиф имеет Интеллект 8, Слепое зрение 60 фт. и говорит на Общем; изменения уже включены в статблок. " : ""}Существо Дружелюбно к вам и союзникам, понимает ваши языки и исполняет команды. Его инициатива равна вашей, ход сразу после вас; без команд только защищается. Становится фигуркой по истечении срока, при 0 хитов или когда вы касаетесь его действием Магия. После возвращения в форму фигурки повторное применение через ${days} дн.`,
      en: `No attunement. Use a Magic action to throw the figurine onto the ground within 60 feet, turning it into the referenced creature for ${hours} hours. Insufficient space or space occupied by creatures or objects prevents transformation. ${slug === "golden-lions" ? "The set contains two lion figurines; activate either or both. " : slug === "ebony-fly" ? "The fly can be ridden as a mount. " : slug === "onyx-dog" ? "The Mastiff has Intelligence 8, Blindsight 60 feet, and speaks Common; these changes are included in its statistics. " : ""}The creature is Friendly to you and your allies, understands your languages, and obeys commands. It shares your initiative, acting immediately after you; without orders it only defends itself. It reverts when the duration expires, at 0 HP, or when you touch it with a Magic action. After reverting, it cannot transform again for ${days} days.`
    }
  })),
  {
    id: "cli-lyre-2024", edition: "2024", name: { ru: "Лира Кли", en: "Cli Lyre" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/16838-cli-lyre",
    spellIds: ["protection-from-evil-and-good-2024", "stone-shape-2024", "levitate-2024", "invisibility-2024", "wall-of-fire-2024", "fly-2024", "wind-wall-2024"],
    rules: {
      ru: "Требуется настройка Бардом. Попытка играть без настройки: спасбросок Мудрости Сл 15, при провале 2d4 психического урона. Играя, сотворяйте Защиту от добра и зла, Изменение формы камня, Левитацию, Невидимость, Огненную стену, Полёт или Стену ветров. Каждое заклинание доступно один раз до следующего рассвета. Используются ваша заклинательная характеристика и Сл заклинаний.",
      en: "Requires attunement by a Bard. Trying to play while unattuned requires a DC 15 Wisdom save or 2d4 Psychic damage. Play to cast Protection from Evil and Good, Stone Shape, Levitate, Invisibility, Wall of Fire, Fly, or Wind Wall. Each spell is available once until the next dawn, using your spellcasting ability and spell save DC."
    }
  },
  {
    id: "canaith-mandolin-2024", edition: "2024", name: { ru: "Мандолина Канаит", en: "Canaith Mandolin" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/16837-canaith-mandolin",
    spellIds: ["protection-from-evil-and-good-2024", "protection-from-energy-2024", "levitate-2024", "cure-wounds-2024", "invisibility-2024", "fly-2024", "dispel-magic-2024"],
    rules: {
      ru: "Требуется настройка Бардом. Попытка играть без настройки: спасбросок Мудрости Сл 15, при провале 2d4 психического урона. Играя, сотворяйте Защиту от добра и зла, Защиту от энергии (только Электричество), Левитацию, Лечение ран 3-го круга, Невидимость, Полёт или Рассеивание магии. Каждое заклинание доступно один раз до следующего рассвета. Используются ваша заклинательная характеристика и Сл заклинаний.",
      en: "Requires attunement by a Bard. Trying to play while unattuned requires a DC 15 Wisdom save or 2d4 Psychic damage. Play to cast Protection from Evil and Good, Protection from Energy (Lightning only), Levitate, Cure Wounds at level 3, Invisibility, Fly, or Dispel Magic. Each spell is available once until the next dawn, using your spellcasting ability and spell save DC."
    }
  },
  {
    id: "golden-harper-pin-2024", edition: "2024", name: { ru: "Золотая брошь Арфиста", en: "Golden Harper Pin" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/18694-golden-harper-pin", spellIds: ["nondetection-2024"],
    rules: {
      ru: "Требуется настройка. При настройке выберите личность Арфиста, её мировоззрение и тип существа. Пока брошь надета, магия, определяющая ваш тип, мировоззрение или местоположение, воспринимает вас как эту личность. Пока носите брошь, можете сотворять на себя Необнаружимость: действует бессрочно до снятия броши, прекращения настройки или вашего отключения без действия.",
      en: "Requires attunement. On attuning, choose a Harper persona, including its alignment and creature type. While worn, magic detecting your type, alignment, or location perceives that persona instead. While wearing the pin, cast Nondetection on yourself; it lasts indefinitely until you remove the pin, end attunement, or dismiss the effect without an action."
    }
  },
  {
    id: "spell-duelists-trophy-2024", edition: "2024", name: { ru: "Трофей заклинателя-дуэлянта", en: "Spell Duelist’s Trophy" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21173-spell-duelists-trophy", spellIds: ["dispel-magic-2024", "mage-hand-2024"],
    rules: {
      ru: "Требуется настройка заклинателем. Пока трофей надет: попав рукопашной атакой заклинанием по существу, можете в рамках этой атаки сотворить на него Рассеивание магии, один раз до следующего рассвета. Заклинания, сотворяемые с ячейкой, не требуют Соматических компонентов. Можно сотворять Волшебную руку без ограничения числа применений.",
      en: "Requires attunement by a spellcaster. While worn: when a melee spell attack hits a creature, you can cast Dispel Magic on it as part of that attack, once until the next dawn. Spells you cast using a spell slot need no Somatic components. You can cast Mage Hand at will."
    }
  },
  {
    id: "bellows-of-strangulation-2024", edition: "2024", name: { ru: "Меха удушения", en: "Bellows of Strangulation" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21138-bellows-of-strangulation", spellIds: ["cloudkill-2024"],
    rules: {
      ru: "Без настройки. 6 зарядов, восстановление 1d6 + 1 на рассвете. Держа меха, действием Магия произнесите команду и потратьте заряды: 1 — видимое существо в 60 фт. делает спасбросок Телосложения Сл 15, при провале Недееспособно на 1 минуту, повторяет спасбросок в конце каждого своего хода и заканчивает эффект при успехе; 3 — тот же эффект для каждого существа в Конусе 30 фт.; 5 — Облако смерти, Сл 17. Израсходовав последний заряд, бросьте d20: на 1 меха безвозвратно уничтожаются безвредным порывом ветра.",
      en: "No attunement. Holds 6 charges, regaining 1d6 + 1 at dawn. While holding the bellows, take a Magic action, speak a command, and spend charges: 1 targets a visible creature within 60 feet, DC 15 Constitution save or Incapacitated for 1 minute, repeating at the end of each of its turns and ending the effect on success; 3 applies that effect to every creature in a 30-foot Cone; 5 casts Cloudkill, DC 17. Spending the last charge requires a d20 roll: on 1, a harmless gust irreparably destroys the bellows."
    }
  },
  {
    id: "mages-manacle-2024", edition: "2024", name: { ru: "Оковы магов", en: "Mage’s Manacle" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21156-mages-manacle", spellIds: ["disintegrate-2024"],
    rules: {
      ru: "Без настройки. Пока браслет надет, действием Магия выберите Схваченное или Недееспособное существо Большого размера либо меньше в 5 фт. Спасбросок Ловкости Сл 15; при провале призрачная цепь и кандал Опутывают цель, которая перемещается вместе с вами. Срок 8 часов либо до вашего освобождения без действия. Урон Дезинтеграции уничтожает кандал; никакой иной способ не повреждает и не уничтожает его. Повторное применение доступно на следующем рассвете.",
      en: "No attunement. While wearing the bracelet, use a Magic action to target a Grappled or Incapacitated Large or smaller creature within 5 feet. DC 15 Dexterity save; failure binds it with a spectral shackle and chain, Restraining it and moving it with you when you move. Lasts 8 hours or until you release it without an action. Damage from Disintegrate destroys the shackle; no other means can damage or destroy it. Reusable at the next dawn."
    }
  },
  ...(["silver", "brass"] as const).map((metal): RuleItem => ({
    id: `horn-of-valhalla-${metal}-2024`, edition: "2024",
    name: { ru: `Рог Вальхаллы (${metal === "silver" ? "серебряный" : "латунный"})`, en: `Horn of Valhalla (${metal === "silver" ? "Silver" : "Brass"})` },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: `https://next.dnd.su/items/${metal === "silver" ? "17414" : "17415"}-horn-of-valhalla-${metal}`,
    creatureIds: ["berserker-2024"],
    rules: {
      ru: `Без настройки. Действием Магия затрубите в рог: ${metal === "silver" ? "2" : "3"} духа воина появляются в незанятых пространствах в пределах 60 фт. Каждый использует параметры Берсерка с дополнительным иммунитетом к Очарованию и Испугу. Возвращается в Асгард через 1 час или при 0 хитов. Повторное использование через 7 дней. ${metal === "silver" ? "Духи Дружелюбны к вам и союзникам и исполняют ваши команды." : "Требуется владение всем Простым оружием: иначе духи атакуют вас. При выполнении требования они Дружелюбны к вам и союзникам и исполняют ваши команды."}`,
      en: `No attunement. Blow the horn as a Magic action: ${metal === "silver" ? "2" : "3"} warrior spirits appear in unoccupied spaces within 60 feet. Each uses Berserker statistics with additional immunity to Charmed and Frightened, returning to Ysgard after 1 hour or at 0 HP. Reusable after 7 days. ${metal === "silver" ? "The spirits are Friendly to you and your allies and obey your commands." : "Requires proficiency with all Simple weapons; otherwise the spirits attack you. If you meet the requirement, they are Friendly to you and your allies and obey your commands."}`
    }
  })),
  {
    id: "arcane-chatelaine-2024", edition: "2024", name: { ru: "Волшебный шатлен", en: "Arcane Chatelaine" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21136-arcane-chatelaine", spellIds: ["arcane-lock-2024"],
    rules: {
      ru: "Без настройки. Поясная застёжка с шестью призрачными ключами. Действием Магия коснитесь ключом закрытой двери, окна, ворот, контейнера или люка, накладывая Волшебный замок на этот объект. Ключ исчезает после использования; когда израсходованы все шесть, исчезает и шатлен.",
      en: "No attunement. A belt clasp with six spectral keys. Use a Magic action to touch a key to a closed door, window, gate, container, or hatch, casting Arcane Lock on that object. The used key disappears; after all six are spent, the clasp also disappears."
    }
  },
  {
    id: "arcanists-bestiary-2024", edition: "2024", name: { ru: "Бестиарий арканиста", en: "Arcanist’s Bestiary" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21137-arcanists-bestiary", spellIds: ["charm-monster-2024"],
    rules: {
      ru: "Требуется настройка. Держа книгу, сотворите Очарование монстра (Сл 15); не-Гуманоид делает спасбросок с Помехой. Восстановление на рассвете. При настройке выберите владение Историей, Природой, Магией или Религией; меняйте выбор после Долгого отдыха, владение теряется с прекращением настройки. Пока книга при вас, успешное действие Изучение — проверка Интеллекта (Магия) для сведений о видимой Аберрации, Конструкте, Элементале, Фее или Монстре — дополнительно раскрывает все иммунитеты, сопротивления и уязвимости существа либо их отсутствие.",
      en: "Requires attunement. While holding the book, cast Charm Monster (DC 15); a non-Humanoid target saves with Disadvantage. Recharges at dawn. Attuning grants proficiency in your choice of History, Nature, Arcana, or Religion; change the choice after a Long Rest and lose it when attunement ends. While carrying the book, a successful Study action using Intelligence (Arcana) to recall information about a visible Aberration, Construct, Elemental, Fey, or Monstrosity also reveals all its immunities, resistances, and vulnerabilities, or their absence."
    }
  },
  {
    id: "dream-weaver-2024", edition: "2024", name: { ru: "Ткач снов", en: "Dream Weaver" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21147-dream-weaver", spellIds: ["dream-2024"],
    rules: {
      ru: "Требуется настройка. Повесьте гобелен на стену или подходящую вертикальную поверхность: узор отражает образы и эмоции ваших последних снов. Следующие преимущества действуют, пока гобелен висит, а вы в пределах 30 фт. Изучайте его 1 час во время Долгого отдыха; в конце отдыха бросьте d20 и запишите результат. До конца следующего Долгого отдыха один раз замените им бросок Теста d20, решив до броска. Если вы становитесь целью Грёз, гобелен отображает внешность и имя заклинателя. Пока вы Бессознательны, спасброски Интеллекта, Мудрости и Харизмы совершаются с Преимуществом.",
      en: "Requires attunement. Hang the tapestry on a wall or suitable vertical surface; its pattern reflects images and feelings from your recent dreams. These benefits apply while it hangs and you are within 30 feet. Study it for 1 hour during a Long Rest, then roll and record a d20 when that rest ends. Once before finishing your next Long Rest, replace a D20 Test roll with that result, deciding before the roll. If Dream targets you, the tapestry records the caster’s appearance and name. While Unconscious, you have Advantage on Intelligence, Wisdom, and Charisma saves."
    }
  },
  {
    id: "folding-boat-2024", edition: "2024", name: { ru: "Складная лодка", en: "Folding Boat" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15937-folding-boat",
    rules: {
      ru: "Без настройки. Плавающий ящик 12 × 6 × 6 дюймов, 4 фунта, открывается для хранения вещей. Каждая команда требует действия Магия: первая превращает в гребную лодку, вторая — в килевую, третья возвращает ящик, только если на борту нет существ. Вещи остаются внутри при превращении; при складывании не помещающиеся в ящик остаются снаружи. Вес раскрытого судна обычный для его типа. При 0 хитов судна предмет уничтожается. Гребная лодка: 1½ мили/ч, экипаж 1, пассажиры 3, КЗ 11, 50 хитов, без порога урона, вес 100 фунтов. Килевая: 1 миля/ч, экипаж 1, пассажиры 6, груз ½ тонны, КЗ 15, 100 хитов, порог урона 10 (получает урон только от отдельного попадания/эффекта с уроном не менее 10, тогда весь урон). Вместимость пассажиров указана для Маленьких/Средних. Сильный встречный ветер вдвое снижает скорость под парусом; в штиль нужны вёсла. На реках по течению прибавляйте его скорость (обычно 3 мили/ч); против существенного течения грести нельзя, но упряжные животные с берега могут тянуть судно. Ремонт у причала: 1 хит за день и 20 зм; при обилии материалов и умелых работников время и цена вдвое меньше.",
      en: "No attunement. A floating 12 × 6 × 6-inch box weighing 4 pounds can hold items. Each command takes a Magic action: the first unfolds a Rowboat, the second a Keelboat, and the third restores box form only when no creatures are aboard. Stored items remain aboard; when folding, items too large for the box remain outside. An unfolded vessel has its normal weight. Reaching 0 vessel HP destroys the item. Rowboat: 1½ mph, crew 1, passengers 3, AC 11, 50 HP, no damage threshold, weight 100 pounds. Keelboat: 1 mph, crew 1, passengers 6, cargo ½ ton, AC 15, 100 HP, damage threshold 10 (a single attack or effect must deal at least 10 damage to harm it, then deals its full damage). Passenger capacities are for Small/Medium creatures. Sailing against strong wind halves speed; no wind requires rowing. Add downstream current speed, typically 3 mph; these boats cannot be rowed against a significant current but shore-based draft animals can tow them upstream. Berthed repairs restore 1 HP per day for 20 GP; abundant materials and skilled labor halve time and cost."
    }
  },
  {
    id: "bead-of-force-2024", edition: "2024", name: { ru: "Бусина силы", en: "Bead of Force" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/15850-bead-of-force",
    rules: {
      ru: "Без настройки. Бусина диаметром ¾ дюйма весит 1 унцию; обычно находят 1d4 + 4 бусины. Действием Магия бросьте одну до 60 фт. При ударе она уничтожается: каждое существо в Сфере радиусом 10 фт. делает спасбросок Ловкости Сл 15, при провале получает 5d4 Силового урона. Затем область на 1 минуту окружает прозрачное силовое поле. Полностью находящиеся внутри существа, провалившие спасбросок, заперты; преуспевших или находящихся внутри лишь частично выталкивает наружу от центра. Через границу проходит только воздух для дыхания, но не атаки и другие эффекты. Пленник действием Использование может толкнуть сферу, передвинув её до половины своей Скорости. Сферу можно поднять: вместе с содержимым она всегда весит 1 фунт.",
      en: "No attunement. A ¾-inch bead weighs 1 ounce; normally found in groups of 1d4 + 4. Use a Magic action to throw one up to 60 feet. Impact destroys it: each creature in a 10-foot-radius Sphere makes a DC 15 Dexterity save, taking 5d4 Force damage on failure. A transparent force barrier then encloses the area for 1 minute. Creatures entirely inside that failed the save are trapped; successful savers and creatures only partly inside are pushed outward from the center. Only breathable air crosses the barrier, not attacks or other effects. A captive can use a Utilize action to push the sphere up to half its Speed. The sphere can be lifted and always weighs 1 pound including its contents."
    }
  },
  {
    id: "windskiff-2024", edition: "2024", name: { ru: "Ветряной челнок", en: "Windskiff" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/17351-windskiff",
    rules: {
      ru: "Без настройки. 3 заряда, все восстанавливаются на рассвете. Держа украшение, действием Магия потратьте 1 заряд: на 1 час оно становится личным парусным транспортом размером с дверь с парусом высотой 10 фт. Командное слово без действия досрочно возвращает форму украшения. Транспорт — Средний объект: КЗ 12, 30 хитов, Скорость 40 фт. Парит в 2 дюймах над поверхностью; при планировании проходит 5 фт. по горизонтали за каждый фут снижения. Челнок и его пассажиры не получают урон от падения.",
      en: "No attunement. Holds 3 charges, all restored at dawn. While holding the jewelry, use a Magic action and 1 charge to turn it into a personal sailing vehicle for 1 hour: door-sized with a 10-foot sail. A command word, requiring no action, restores jewelry form early. The vehicle is a Medium object: AC 12, 30 HP, Speed 40 feet. It hovers 2 inches above the surface and can glide 5 horizontal feet per foot descended. Neither the skiff nor its passengers take falling damage."
    }
  },
  {
    id: "mechanical-gyrocopter-wonder-2024", edition: "2024", name: { ru: "Механическое диво-гирокоптер", en: "Mechanical Gyrocopter Wonder" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/18703-mechanical-gyrocopter-wonder",
    rules: {
      ru: "Без настройки. Инертный транспорт активируется своим уникальным ключом: заводите 1 минуту, совершая действие Использование каждый ход. После завода работает 8 часов и требует одного возницы. Огромный объект весом 500 фунтов: КЗ 14, 50 хитов, Скорость 5 фт., Полёт 20 фт. Вместимость 2000 фунтов; превышение немедленно отключает транспорт. В грузовом отсеке 8 призрачных шнуров. Пассажир действием Использование привязывается или отвязывается. Привязавшись, может выпрыгнуть и планировать по 5 фт. горизонтально за каждый фут снижения. При удалении пассажира более чем на 500 фт. шнур немедленно исчезает и возвращается в гирокоптер.",
      en: "No attunement. Activate the inert vehicle by winding its unique key for 1 minute, taking the Utilize action each turn. It then operates for 8 hours and needs one driver. A Huge object weighing 500 pounds: AC 14, 50 HP, Speed 5 feet, Fly Speed 20 feet. Carries 2,000 pounds; exceeding this immediately deactivates it. Its cargo compartment holds 8 spectral cords. A passenger uses a Utilize action to attach or detach a cord. An attached passenger can jump out and glide 5 horizontal feet per foot descended. Beyond 500 feet from the vehicle, the cord immediately disappears and returns to the gyrocopter."
    }
  },
  {
    id: "prismatic-rune-2024", edition: "2024", name: { ru: "Многоцветная руна", en: "Prismatic Rune" },
    kind: "wondrous", rarity: "rare", replicationLevel: 14,
    sourceUrl: "https://next.dnd.su/items/21167-prismatic-rune",
    rules: {
      ru: "Требуется настройка заклинателем. После Долгого отдыха выберите Звук, Кислоту, Огонь, Холод, Электричество или Яд; выбор действует до завершения следующего Долгого отдыха. 6 зарядов, восстановление 1d6 на рассвете. Сотворяя заклинание, наносящее урон, можете потратить 1 заряд, чтобы заменить тип его урона выбранным для руны.",
      en: "Requires attunement by a spellcaster. On finishing a Long Rest, choose Thunder, Acid, Fire, Cold, Lightning, or Poison until you finish your next Long Rest. Holds 6 charges and regains 1d6 at dawn. When casting a damaging spell, you can spend 1 charge to change its damage type to the rune’s selected type."
    }
  }
];
/** Reviewed noncursed Wondrous Item category plans, separate from named plan tables. */
export const ARTIFICER_REPLICAS_2024_GENERAL: RuleItem[] = [
  ...additionalRarePlans,
  {
    "id": "amulet-of-proof-against-detection-and-location-2024",
    "edition": "2024",
    "name": {
      "ru": "Амулет защиты от обнаружения и поиска",
      "en": "Amulet of Proof against Detection and Location"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/15835-amulet-of-proof-against-detection-and-location",
    "rules": {
      "ru": "Требуется настройка. Пока амулет надет, без вашего согласия вас нельзя выбрать целью заклинаний Прорицания или воспринимать через магические сенсоры наблюдения.",
      "en": "Requires attunement. While worn, the amulet prevents Divination spells from targeting you and magical scrying sensors from perceiving you unless you allow it."
    },
    "spellIds": []
  },
  {
    "id": "brooch-of-shielding-2024",
    "edition": "2024",
    "name": {
      "ru": "Брошь защиты",
      "en": "Brooch of Shielding"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/15869-brooch-of-shielding",
    "rules": {
      "ru": "Требуется настройка. Пока брошь надета, вы получаете сопротивление силовому урону и иммунитет к урону Волшебных стрел.",
      "en": "Requires attunement. While wearing the brooch, you have Resistance to Force damage and Immunity to damage from Magic Missile."
    },
    "spellIds": [
      "magic-missile-2024"
    ]
  },
  {
    "id": "wind-fan-2024",
    "edition": "2024",
    "name": {
      "ru": "Веер ветра",
      "en": "Wind Fan"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/16171-wind-fan",
    "rules": {
      "ru": "Без настройки. Держа веер, сотворите Порыв ветра, Сл 13. После первого применения до следующего рассвета каждое следующее применение увеличивает вероятность поломки на 20 процентных пунктов: 20%, затем 40% и далее. При поломке заклинание не срабатывает, веер становится бесполезными немагическими лоскутами.",
      "en": "No attunement. While holding the fan, cast Gust of Wind, save DC 13. After the first use before the next dawn, each subsequent use adds a cumulative 20 percentage point failure chance: 20 percent, then 40 percent, and so on. On failure the spell fails and the fan becomes useless nonmagical tatters."
    },
    "spellIds": [
      "gust-of-wind-2024"
    ]
  },
  {
    "id": "eversmoking-bottle-2024",
    "edition": "2024",
    "name": {
      "ru": "Вечнодымящаяся бутылка",
      "en": "Eversmoking Bottle"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/15929-eversmoking-bottle",
    "rules": {
      "ru": "Без настройки. Действием Магия откройте или закройте бутылку. Открытая создаёт сильно заслонённую дымом эманацию 60 фт.; каждую минуту открытого состояния радиус увеличивается на 10 фт., максимум 120 фт. Закрытие фиксирует облако на месте; через 10 минут оно исчезает. Сильный ветер, включая Порыв ветра, рассеивает его за 1 минуту.",
      "en": "No attunement. Open or close the bottle with a Magic action. Opening creates a Heavily Obscured 60-foot Emanation of smoke, expanding by 10 feet each minute it remains open, to 120 feet maximum. Closing fixes the cloud in place; it disperses after 10 minutes. Strong wind, including Gust of Wind, disperses it in 1 minute."
    },
    "spellIds": [
      "gust-of-wind-2024"
    ]
  },
  {
    "id": "decanter-of-endless-water-2024",
    "edition": "2024",
    "name": {
      "ru": "Графин бесконечной воды",
      "en": "Decanter of Endless Water"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/15901-decanter-of-endless-water",
    "rules": {
      "ru": "Без настройки. Графин весит 2 фунта. Действием Магия откройте его и произнесите команду, выбрав пресную или солёную воду. Поток прекращается в начале вашего следующего хода. Плеск: 1 галлон. Фонтан: 5 галлонов. Гейзер: 30 галлонов в линии длиной 30 фт. и шириной 1 фут; направление задаётся без действия, пока держите графин. Выбранное существо в линии делает спасбросок Силы Сл 13; провал — 1d4 дробящего урона и состояние Опрокинутый. Вместо существа можно опрокинуть один предмет в линии весом до 200 фунтов, который никто не несёт и не носит.",
      "en": "No attunement. The decanter weighs 2 pounds. Take a Magic action to open it and speak a command, choosing fresh or salt water. Flow ends at the start of your next turn. Stream: 1 gallon. Fountain: 5 gallons. Geyser: 30 gallons in a Line 30 feet long and 1 foot wide; aim it without an action while holding the decanter. One chosen creature in the Line makes a DC 13 Strength save or takes 1d4 Bludgeoning damage and falls Prone. Instead, topple one object in the Line weighing up to 200 pounds that is not worn or carried."
    },
    "spellIds": []
  },
  {
    "id": "pearl-of-power-2024",
    "edition": "2024",
    "name": {
      "ru": "Жемчужина силы",
      "en": "Pearl of Power"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/16008-pearl-of-power",
    "rules": {
      "ru": "Требуется настройка заклинателем. Пока жемчужина при вас, действием Магия восстановите одну потраченную ячейку 3-го круга или ниже. Свойство восстанавливается на следующем рассвете.",
      "en": "Requires attunement by a spellcaster. While carrying the pearl, take a Magic action to regain one expended spell slot of level 3 or lower. This property recharges at the next dawn."
    },
    "spellIds": []
  },
  {
    "id": "boots-of-the-winterlands-2024",
    "edition": "2024",
    "name": {
      "ru": "Заполярные сапоги",
      "en": "Boots of the Winterlands"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/15864-boots-of-the-winterlands",
    "rules": {
      "ru": "Требуется настройка. Пока сапоги надеты, вы получаете сопротивление холоду, выдерживаете температуру −18 °C (0 °F) и ниже без дополнительной защиты и игнорируете труднопроходимую местность из снега и льда.",
      "en": "Requires attunement. While wearing the boots, you have Resistance to Cold damage, tolerate temperatures of 0 °F (−18 °C) or lower without extra protection, and ignore Difficult Terrain made of snow or ice."
    },
    "spellIds": []
  },
  {
    "id": "gem-of-brightness-2024",
    "edition": "2024",
    "name": {
      "ru": "Камень сияния",
      "en": "Gem of Brightness"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/15940-gem-of-brightness",
    "rules": {
      "ru": "Без настройки. 50 невосстанавливаемых зарядов. Держа призму, действием Магия произнесите команду. Свет: без траты зарядов яркий свет 30 фт. и тусклый ещё 30 фт.; заканчивается при повторе слова бонусным действием или включении другого свойства. Луч: 1 заряд, видимое существо в 60 фт. совершает спасбросок Телосложения Сл 15; провал ослепляет на 1 минуту, повторный спасбросок в конце каждого хода прекращает эффект при успехе. Вспышка: 5 зарядов, каждое существо в конусе 30 фт. делает такой же спасбросок против того же ослепления. После расхода всех зарядов остаётся немагический камень стоимостью 50 зм.",
      "en": "No attunement. Fifty nonrenewable charges. Hold the prism and take a Magic action to speak a command. Light: no charge; Bright Light 30 feet plus Dim Light 30 feet, ending when you repeat the word as a Bonus Action or use another property. Ray: 1 charge; one visible creature within 60 feet makes a DC 15 Constitution save or is Blinded for 1 minute, repeating the save at the end of each turn to end it on success. Flash: 5 charges; every creature in a 30-foot Cone makes the same save against the same blindness. Once all charges are spent, it is a nonmagical gem worth 50 GP."
    },
    "spellIds": []
  },
  {
    "id": "stone-of-good-luck-luckstone-2024",
    "edition": "2024",
    "name": {
      "ru": "Камень удачи",
      "en": "Stone of Good Luck (Luckstone)"
    },
    "kind": "wondrous",
    "rarity": "uncommon",
    "replicationLevel": 10,
    "sourceUrl": "https://next.dnd.su/items/16124-stone-of-good-luck-luckstone",
    "rules": {
      "ru": "Требуется настройка. Пока камень при вас, вы получаете +1 к проверкам характеристик и спасброскам.",
      "en": "Requires attunement. While carrying the stone, gain +1 to ability checks and saving throws."
    },
    "spellIds": []
  }
];

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "quiver-of-ehlonna-2024",
  "edition": "2024",
  "name": {
    "ru": "Колчан Элонны",
    "en": "Quiver of Ehlonna"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16048-quiver-of-ehlonna",
  "rules": {
    "ru": "Без настройки. Колчан весит 2 фунта независимо от содержимого. Три межпространственных отделения вмещают: до 60 стрел, болтов или похожих предметов; до 18 метательных копий или похожих предметов; до 6 длинных предметов вроде луков, боевых посохов и копий. Предметы извлекаются как из обычного колчана или ножен.",
    "en": "No attunement. The quiver weighs 2 pounds regardless of contents. Three extradimensional compartments hold up to 60 arrows, bolts, or similar objects; 18 javelins or similar objects; and six long objects such as bows, quarterstaffs, or spears. Retrieve items as from an ordinary quiver or scabbard."
  },
  "spellIds": []
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "winged-boots-2024",
  "edition": "2024",
  "name": {
    "ru": "Крылатые сапоги",
    "en": "Winged Boots"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16172-winged-boots",
  "rules": {
    "ru": "Требуется настройка. 4 заряда. Пока сапоги надеты, действием Магия потратьте 1 заряд: скорость полёта 30 фт. на 1 час. Если эффект закончился в воздухе, опускайтесь на 30 фт. за раунд до земли. На рассвете восстанавливаются 1d4 потраченных заряда.",
    "en": "Requires attunement. Four charges. While wearing the boots, spend a Magic action and 1 charge to gain a Fly Speed of 30 feet for 1 hour. If the effect ends while airborne, descend 30 feet per round until landing. Regain 1d4 spent charges at dawn."
  },
  "spellIds": []
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "arcane-battery-2024",
  "edition": "2024",
  "name": {
    "ru": "Магический накопитель",
    "en": "Arcane Battery"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/17494-arcane-battery",
  "rules": {
    "ru": "Без настройки. Держа накопитель, действием Магия коснитесь им магического предмета. Если тот обычно восстанавливает заряды на рассвете, он немедленно восстанавливает 1d4 + 1 потраченных заряда, а накопитель становится немагическим.",
    "en": "No attunement. Hold the battery and use a Magic action to touch a magic item with it. If that item normally regains charges at dawn, it immediately regains 1d4 + 1 spent charges and the battery becomes nonmagical."
  },
  "spellIds": []
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "keoghtoms-ointment-2024",
  "edition": "2024",
  "name": {
    "ru": "Мазь Кеогтома",
    "en": "Keoghtom’s Ointment"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15975-keoghtoms-ointment",
  "rules": {
    "ru": "Без настройки. Банка содержит 1d4 + 1 дозу и весит с содержимым ½ фунта. Действием Использование проглотите дозу либо нанесите на существо в 5 фт.: оно восстанавливает 2d8 + 2 хита и прекращает состояние Отравленный. Доза расходуется.",
    "en": "No attunement. The jar contains 1d4 + 1 doses and weighs half a pound with its contents. Use a Utilize action to swallow a dose or apply it to a creature within 5 feet. It regains 2d8 + 2 HP and ends the Poisoned condition. The dose is consumed."
  },
  "spellIds": []
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "periapt-of-wound-closure-2024",
  "edition": "2024",
  "name": {
    "ru": "Медальон затягивающихся ран",
    "en": "Periapt of Wound Closure"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16012-periapt-of-wound-closure",
  "rules": {
    "ru": "Требуется настройка. Пока медальон надет, результат броска спасброска от Смерти 9 или ниже можно заменить на 10, превращая провал в успех. Когда вы бросаете Кость хитов для собственного восстановления, удвойте число восстанавливаемых ею хитов.",
    "en": "Requires attunement. While worn, you may replace a Death Saving Throw result of 9 or lower with 10, turning failure into success. Whenever you roll a Hit Point Die to heal yourself, double the HP it restores."
  },
  "spellIds": []
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "periapt-of-health-2024",
  "edition": "2024",
  "name": {
    "ru": "Медальон здоровья",
    "en": "Periapt of Health"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16010-periapt-of-health",
  "rules": {
    "ru": "Требуется настройка. Пока амулет надет, действием Магия восстановите 2d4 + 2 хита; это свойство восстанавливается на рассвете. Также получаете преимущество на спасброски против получения или для окончания состояния Отравленный.",
    "en": "Requires attunement. While wearing the periapt, use a Magic action to regain 2d4 + 2 HP; this property recharges at dawn. You also have Advantage on saves to avoid or end the Poisoned condition."
  },
  "spellIds": []
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "medallion-of-thoughts-2024",
  "edition": "2024",
  "name": {
    "ru": "Медальон мыслей",
    "en": "Medallion of Thoughts"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15989-medallion-of-thoughts",
  "rules": {
    "ru": "Требуется настройка. 5 зарядов. Пока медальон надет, потратьте 1 заряд и сотворите Обнаружение мыслей, Сл 13. На рассвете восстанавливаются 1d4 потраченных заряда.",
    "en": "Requires attunement. Five charges. While wearing the medallion, spend 1 charge to cast Detect Thoughts, save DC 13. Regain 1d4 spent charges at dawn."
  },
  "spellIds": [
    "detect-thoughts-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "thiefs-thimble-2024",
  "edition": "2024",
  "name": {
    "ru": "Напёрсток вора",
    "en": "Thief's Thimble"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21179-thiefs-thimble",
  "rules": {
    "ru": "Требуется настройка. Когда вы приводите в действие ловушку и должны получить её урон, надетый напёрсток принимает этот урон вместо вас. У него 30 хитов; при 0 он разламывается, и весь оставшийся урон получаете вы.",
    "en": "Requires attunement. When you trigger a trap and would take damage from it, the worn thimble takes that damage instead. It has 30 HP; at 0 it breaks and you take all remaining damage."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "bracers-of-archery-2024",
  "edition": "2024",
  "name": {
    "ru": "Наручи стрельбы из лука",
    "en": "Bracers of Archery"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15866-bracers-of-archery",
  "rules": {
    "ru": "Требуется настройка. Пока наручи надеты, вы владеете длинным и коротким луками и получаете +2 к броскам урона такими луками.",
    "en": "Requires attunement. While wearing the bracers, you have proficiency with Longbows and Shortbows and gain +2 to damage rolls with them."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "natures-mantle-2024",
  "edition": "2024",
  "name": {
    "ru": "Одеяние природы",
    "en": "Nature’s Mantle"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15995-natures-mantle",
  "rules": {
    "ru": "Требуется настройка друидом или следопытом. Надетый плащ служит фокусировкой заклинаний этих классов. В слабо заслонённой области можно бонусным действием совершить Затаивание, даже под прямым наблюдением.",
    "en": "Requires attunement by a Druid or Ranger. While worn, the mantle is a focus for spells of those classes. In a Lightly Obscured area, you can take the Hide action as a Bonus Action even while directly observed."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "eyes-of-deceit-2024",
  "edition": "2024",
  "name": {
    "ru": "Очи обмана",
    "en": "Eyes of Deceit"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21317-eyes-of-deceit",
  "rules": {
    "ru": "Без настройки. Надетые линзы дают +5 к проверкам Харизмы (Обман).",
    "en": "No attunement. While wearing the lenses, gain +5 to Charisma (Deception) checks."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "eyes-of-the-eagle-2024",
  "edition": "2024",
  "name": {
    "ru": "Очки орлиного зрения",
    "en": "Eyes of the Eagle"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15934-eyes-of-the-eagle",
  "rules": {
    "ru": "Без настройки. Надетые линзы дают преимущество на проверки Мудрости (Восприятие), основанные на зрении. При хорошей видимости можно различать подробности очень далёких существ и предметов размером всего 2 фута.",
    "en": "No attunement. While wearing the lenses, you have Advantage on Wisdom (Perception) checks relying on sight. In clear visibility, distinguish details of very distant creatures and objects as small as 2 feet across."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "quaals-feather-token-fan-2024",
  "edition": "2024",
  "name": {
    "ru": "Перо Кваля (веер)",
    "en": "Quaal’s Feather Token (fan)"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/17778-quaals-feather-token-fan",
  "rules": {
    "ru": "Без настройки. Находясь на лодке или корабле, действием Магия бросьте жетон в воздух на расстояние до 10 фт. Жетон исчезает, создавая парящий веер: сильный ветер наполняет паруса одного судна и повышает его скорость на 5 миль в час на 8 часов. Веер можно отпустить действием Магия.",
    "en": "No attunement. While aboard a boat or ship, take a Magic action to throw the token up to 10 feet into the air. It vanishes and creates a hovering fan whose strong wind fills one vessel’s sails, increasing speed by 5 miles per hour for 8 hours. Dismiss the fan with a Magic action."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "quaals-feather-token-tree-2024",
  "edition": "2024",
  "name": {
    "ru": "Перо Кваля (дерево)",
    "en": "Quaal’s Feather Token (tree)"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/17779-quaals-feather-token-tree",
  "rules": {
    "ru": "Без настройки. На открытом воздухе действием Магия коснитесь жетоном свободного места на земле. Жетон исчезает; там вырастает немагический дуб высотой 60 фт., диаметром ствола 5 фт. и радиусом кроны 20 фт.",
    "en": "No attunement. Outdoors, take a Magic action to touch the token to an unoccupied ground space. It vanishes and a nonmagical oak grows there, 60 feet tall with a 5-foot-diameter trunk and a 20-foot canopy radius."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "quaals-feather-token-anchor-2024",
  "edition": "2024",
  "name": {
    "ru": "Перо Кваля (якорь)",
    "en": "Quaal’s Feather Token (anchor)"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/17783-quaals-feather-token-anchor",
  "rules": {
    "ru": "Без настройки. Действием Магия коснитесь жетоном лодки или корабля: на 24 часа судно невозможно сдвинуть никаким способом. Повторное касание прекращает эффект. Когда эффект заканчивается, жетон исчезает.",
    "en": "No attunement. Take a Magic action to touch the token to a boat or ship. For 24 hours, the vessel cannot be moved by any means. Touch it again to end the effect early. The token vanishes when the effect ends."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "gloves-of-missile-snaring-2024",
  "edition": "2024",
  "name": {
    "ru": "Перчатки ловли снарядов",
    "en": "Gloves of Missile Snaring"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15944-gloves-of-missile-snaring",
  "rules": {
    "ru": "Требуется настройка. Пока перчатки надеты и есть свободная рука, при попадании по вам атакой дальнобойным или метательным оружием реакцией уменьшите урон на 1d10 + модификатор Ловкости. Если урон снижен до 0 и боеприпас или оружие помещается в этой руке, можно поймать его.",
    "en": "Requires attunement. While wearing the gloves with a hand free, use a Reaction when hit by a Ranged or Thrown weapon attack to reduce damage by 1d10 plus your Dexterity modifier. If reduced to 0 and the ammunition or weapon fits in that hand, you may catch it."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "magewrights-gloves-2024",
  "edition": "2024",
  "name": {
    "ru": "Перчатки магического ремесла",
    "en": "Magewright's Gloves"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21157-magewrights-gloves",
  "rules": {
    "ru": "Требуется настройка. Пока перчатки надеты, для расчёта времени изготовления немагических предметов вы работаете как два персонажа с инструментами алхимика, каллиграфа, картографа, пивовара, стеклодува или ювелира.",
    "en": "Requires attunement. While wearing the gloves, count as two workers when determining the time to craft nonmagical items with Alchemist’s, Calligrapher’s, Cartographer’s, Brewer’s, Glassblower’s, or Jeweler’s Tools."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "gloves-of-swimming-and-climbing-2024",
  "edition": "2024",
  "name": {
    "ru": "Перчатки плавания и лазания",
    "en": "Gloves of Swimming and Climbing"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15945-gloves-of-swimming-and-climbing",
  "rules": {
    "ru": "Требуется настройка. Надетые перчатки дают скорости плавания и лазания, равные вашей Скорости, и +5 к проверкам Силы (Атлетика) для плавания и лазания.",
    "en": "Requires attunement. While worn, the gloves give Swim and Climb Speeds equal to your Speed and +5 to Strength (Athletics) checks for swimming or climbing."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "cloak-of-protection-2024",
  "edition": "2024",
  "name": {
    "ru": "Плащ защиты",
    "en": "Cloak of Protection"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15888-cloak-of-protection",
  "rules": {
    "ru": "Требуется настройка. Надетый плащ даёт +1 к КД и спасброскам.",
    "en": "Requires attunement. While worn, the cloak gives +1 AC and +1 to saving throws."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "headband-of-intellect-2024",
  "edition": "2024",
  "name": {
    "ru": "Повязка интеллекта",
    "en": "Headband of Intellect"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15954-headband-of-intellect",
  "rules": {
    "ru": "Требуется настройка. Пока повязка надета, ваш Интеллект равен 19. Если без неё он уже 19 или выше, повязка его не меняет.",
    "en": "Requires attunement. While worn, the headband sets your Intelligence to 19. It has no effect if your Intelligence without it is already 19 or higher."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "broom-of-flying-2024",
  "edition": "2024",
  "name": {
    "ru": "Помело полёта",
    "en": "Broom of Flying"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15870-broom-of-flying",
  "rules": {
    "ru": "Требуется настройка. Сядьте на помело и действием Магия поднимите его в воздух: скорость полёта 50 фт., грузоподъёмность 400 фунтов; при грузе свыше 200 фунтов скорость 30 фт. Приземление или спешивание прекращает парение. Действием Магия отправьте его самостоятельно в названное знакомое место в пределах 1 мили. Пока оно в 1 миле, действием Магия и командным словом верните его к себе.",
    "en": "Requires attunement. Straddle the broom and take a Magic action to make it hover: Fly Speed 50 feet, capacity 400 pounds, reduced to 30 feet when carrying over 200 pounds. Landing or dismounting ends hovering. Use a Magic action to send it alone to a named familiar location within 1 mile. While it is within 1 mile, call it back with a Magic action and command word."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "dust-of-disappearance-2024",
  "edition": "2024",
  "name": {
    "ru": "Порошок исчезновения",
    "en": "Dust of Disappearance"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15912-dust-of-disappearance",
  "rules": {
    "ru": "Без настройки. Одна порция. Действием Использование бросьте порошок в воздух: вы, все существа и предметы в вашей эманации 10 фт. Невидимы на общие для всех 2d4 минуты. Порошок расходуется. Для существа невидимость заканчивается сразу после броска атаки, нанесения урона или сотворения заклинания.",
    "en": "No attunement. One use. Take a Utilize action to throw the dust into the air. You and every creature and object in your 10-foot Emanation become Invisible for the same rolled duration of 2d4 minutes. The dust is consumed. A creature’s invisibility ends immediately after it makes an attack roll, deals damage, or casts a spell."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "dust-of-dryness-2024",
  "edition": "2024",
  "name": {
    "ru": "Порошок сухости",
    "en": "Dust of Dryness"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15913-dust-of-dryness",
  "rules": {
    "ru": "Без настройки. Пакет содержит 1d6 + 4 щепотки. Действием Использование рассыпьте одну на воде: объём до куба 15 фт. превращается в почти невесомый шарик рядом, плавающий на воде или лежащий. Действием Использование разбейте шарик о твёрдую поверхность: вся вода освобождается, шарик и его магия исчезают. Либо действием Использование посыпьте щепоткой Элементаля в 5 фт., состоящего главным образом из воды: спасбросок Телосложения Сл 13; 10d6 некротического урона при провале, половина при успехе.",
    "en": "No attunement. Contains 1d6 + 4 pinches. Use a Utilize action to sprinkle one on water, compressing up to a 15-foot Cube into a nearly weightless pellet floating or resting nearby. Use a Utilize action to break it against a hard surface, releasing all water and destroying the pellet and its magic. Alternatively, use a Utilize action to sprinkle a pinch on an Elemental within 5 feet composed mainly of water: DC 13 Constitution save, taking 10d6 Necrotic damage on failure or half on success."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "gauntlets-of-ogre-power-2024",
  "edition": "2024",
  "name": {
    "ru": "Рукавицы силы огра",
    "en": "Gauntlets of Ogre Power"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15939-gauntlets-of-ogre-power",
  "rules": {
    "ru": "Требуется настройка. Пока перчатки надеты, ваша Сила равна 19. Если без них она уже 19 или выше, перчатки её не меняют.",
    "en": "Requires attunement. While worn, the gauntlets set your Strength to 19. They have no effect if your Strength without them is already 19 or higher."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "boots-of-striding-and-springing-2024",
  "edition": "2024",
  "name": {
    "ru": "Сапоги ходьбы и прыжков",
    "en": "Boots of Striding and Springing"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15863-boots-of-striding-and-springing",
  "rules": {
    "ru": "Требуется настройка. Пока сапоги надеты, ваша Скорость не ниже 30 фт. и не уменьшается от превышения грузоподъёмности или тяжёлого доспеха. Один раз в свой ход прыгните до 30 фт., потратив лишь 10 фт. перемещения.",
    "en": "Requires attunement. While wearing the boots, your Speed is at least 30 feet and is not reduced by exceeding carrying capacity or wearing Heavy armor. Once on each of your turns, jump up to 30 feet by spending only 10 feet of movement."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "saddle-of-the-cavalier-2024",
  "edition": "2024",
  "name": {
    "ru": "Седло кавалериста",
    "en": "Saddle of the Cavalier"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16088-saddle-of-the-cavalier",
  "rules": {
    "ru": "Без настройки. Пока сидите в седле на скакуне, атаки по скакуну имеют помеху. Вас нельзя спешить против воли, если вы не Недееспособны.",
    "en": "No attunement. While riding in the saddle, attacks against your mount have Disadvantage. You cannot be dismounted against your will unless Incapacitated."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "silver-harper-pin-2024",
  "edition": "2024",
  "name": {
    "ru": "Серебряная брошь Арфиста",
    "en": "Silver Harper Pin"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/18693-silver-harper-pin",
  "rules": {
    "ru": "Требуется настройка. При настройке задайте личность Арфиста, включая мировоззрение и тип существа. Пока брошь надета, магия определения типа, мировоззрения или местонахождения воспринимает вас как эту личность. При настройке также можно задать мысли максимум из 25 слов: чтение мыслей обнаруживает их вместо настоящих. Читающий мысли действием Изучение совершает проверку Интеллекта (Расследование) Сл 13; успех раскрывает, что мысли запрограммированы.",
    "en": "Requires attunement. During attunement, choose a Harper persona including alignment and creature type. While wearing the pin, magic detecting type, alignment, or location perceives you as that persona. You may also set a train of thought of at most 25 words during attunement; mind readers detect it instead of your real thoughts. A mind reader taking the Study action makes a DC 13 Intelligence (Investigation) check, recognizing the thoughts as programmed on success."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "orb-of-divination-detection-2024",
  "edition": "2024",
  "name": {
    "ru": "Сфера обнаружения прорицания",
    "en": "Orb of Divination Detection"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21163-orb-of-divination-detection",
  "rules": {
    "ru": "Требуется настройка. Сфера служит заклинательной фокусировкой. Когда вы становитесь целью заклинания Прорицания, она ярко-зелёно светится до окончания заклинания.",
    "en": "Requires attunement. The orb serves as a spellcasting focus. When a Divination spell targets you, it glows bright green for that spell’s duration."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "orb-of-sorcery-2024",
  "edition": "2024",
  "name": {
    "ru": "Сфера чародейства",
    "en": "Orb of Sorcery"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21164-orb-of-sorcery",
  "rules": {
    "ru": "Требуется настройка чародеем. Держа сферу, действием Магия восстановите до 2 Очков чародейства; свойство восстанавливается на следующем рассвете. Сфера служит фокусировкой заклинаний чародея.",
    "en": "Requires attunement by a Sorcerer. Hold the orb and take a Magic action to regain up to 2 Sorcery Points; this property recharges at the next dawn. The orb is a focus for Sorcerer spells."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "thespians-playbill-2024",
  "edition": "2024",
  "name": {
    "ru": "Театральная программка",
    "en": "Thespian's Playbill"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21178-thespians-playbill",
  "rules": {
    "ru": "Требуется настройка. Держа программку, добавляйте свой модификатор Харизмы, минимум +1, к проверкам Интеллекта при действии Изучение.",
    "en": "Requires attunement. While holding the playbill, add your Charisma modifier, minimum +1, to Intelligence checks made with the Study action."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "slippers-of-spider-climbing-2024",
  "edition": "2024",
  "name": {
    "ru": "Туфли паука",
    "en": "Slippers of Spider Climbing"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16100-slippers-of-spider-climbing",
  "rules": {
    "ru": "Требуется настройка. Надетые туфли позволяют перемещаться по стенам и потолкам, оставляя руки свободными, и дают скорость лазания, равную вашей Скорости. Это не работает на скользких поверхностях, например покрытых маслом или льдом.",
    "en": "Requires attunement. While worn, the slippers let you move along walls and ceilings with hands free and give a Climb Speed equal to your Speed. This does not work on slippery surfaces, such as those covered in oil or ice."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "hat-of-vortexes-2024",
  "edition": "2024",
  "name": {
    "ru": "Шляпа вихрей",
    "en": "Hat of Vortexes"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/17497-hat-of-vortexes",
  "rules": {
    "ru": "Требуется настройка. 3 заряда, все восстанавливаются на рассвете. Держа шляпу, действием Магия потратьте 1 заряд: вихрь заполняет куб 10 фт., исходящий от вас, на 1 час. Его область — труднопроходимая местность. Облик вихря выбираете при создании.",
    "en": "Requires attunement. Three charges, all regained at dawn. While holding the hat, spend a Magic action and 1 charge to fill a 10-foot Cube originating from you with a vortex for 1 hour. Its area is Difficult Terrain. Choose its appearance when creating it."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "circlet-of-blasting-2024",
  "edition": "2024",
  "name": {
    "ru": "Обруч сжигания",
    "en": "Circlet of Blasting"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15881-circlet-of-blasting",
  "rules": {
    "ru": "Без настройки. Пока обруч надет, сотворите Палящий луч с бонусом атаки +5. Свойство восстанавливается на следующем рассвете.",
    "en": "No attunement. While wearing the circlet, cast Scorching Ray with a +5 attack bonus. This property recharges at the next dawn."
  },
  "spellIds": [
    "scorching-ray-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "driftglobe-2024",
  "edition": "2024",
  "name": {
    "ru": "Парящая сфера",
    "en": "Driftglobe"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15911-driftglobe",
  "rules": {
    "ru": "Без настройки. Шар весит 1 фунт. Находясь в 60 фт., прикажите ему излучать Свет или Дневной свет; Дневной свет доступен раз до следующего рассвета. Действием Магия прикажите светящемуся шару парить не выше 5 фт. над землёй, пока кто-нибудь его не схватит. Если вы дальше 60 фт., он следует кратчайшим путём, пока не приблизится на 60 фт. Если путь преграждён, шар плавно опускается, перестаёт быть активным и гаснет.",
    "en": "No attunement. The globe weighs 1 pound. From within 60 feet, command it to emit Light or Daylight; Daylight recharges at the next dawn. Use a Magic action to make the glowing globe hover no more than 5 feet above ground until someone grasps it. If you move beyond 60 feet, it follows the shortest route until within 60 feet again. If blocked, it gently descends, becomes inactive, and extinguishes."
  },
  "spellIds": [
    "light-2024",
    "daylight-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "hat-of-disguise-2024",
  "edition": "2024",
  "name": {
    "ru": "Шапка маскировки",
    "en": "Hat of Disguise"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15950-hat-of-disguise",
  "rules": {
    "ru": "Требуется настройка. Пока шляпа надета, можно сотворять Маскировку. Снятие шляпы немедленно прекращает это заклинание.",
    "en": "Requires attunement. While wearing the hat, you can cast Disguise Self. Removing the hat immediately ends that spell."
  },
  "spellIds": [
    "disguise-self-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "helm-of-comprehending-languages-2024",
  "edition": "2024",
  "name": {
    "ru": "Шлем понимания языков",
    "en": "Helm of Comprehending Languages"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15956-helm-of-comprehending-languages",
  "rules": {
    "ru": "Без настройки. Пока шлем надет, можно сотворять через него Понимание языков.",
    "en": "No attunement. While wearing the helm, you can cast Comprehend Languages through it."
  },
  "spellIds": [
    "comprehend-languages-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "helm-of-telepathy-2024",
  "edition": "2024",
  "name": {
    "ru": "Шлем телепатии",
    "en": "Helm of Telepathy"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15957-helm-of-telepathy",
  "rules": {
    "ru": "Требуется настройка. Надетый шлем даёт телепатию 30 фт. Через него можно сотворить Обнаружение мыслей и Внушение со Сл 13; каждое заклинание доступно отдельно один раз до следующего рассвета.",
    "en": "Requires attunement. While wearing the helm, you have Telepathy out to 30 feet. Cast Detect Thoughts and Suggestion through it with save DC 13; each spell is separately available once before the next dawn."
  },
  "spellIds": [
    "detect-thoughts-2024",
    "suggestion-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "fochlucan-bandore-2024",
  "edition": "2024",
  "name": {
    "ru": "Бандура Фоклучан",
    "en": "Fochlucan Bandore"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16840-fochlucan-bandore",
  "rules": {
    "ru": "Требуется настройка бардом. Играющий без настройки совершает спасбросок Мудрости Сл 15, получая 2d4 психического урона при провале. Играя, можно сотворить любое из перечисленных заклинаний; каждое доступно отдельно один раз до следующего рассвета. Используйте свою заклинательную характеристику и Сл своих заклинаний.",
    "en": "Requires attunement by a Bard. Playing without attunement requires a DC 15 Wisdom save; failure deals 2d4 Psychic damage. While playing, cast any listed spell, each separately once before the next dawn. Use your own spellcasting ability and spell save DC."
  },
  "spellIds": [
    "shillelagh-2024",
    "protection-from-evil-and-good-2024",
    "levitate-2024",
    "invisibility-2024",
    "faerie-fire-2024",
    "entangle-2024",
    "fly-2024",
    "speak-with-animals-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "doss-lute-2024",
  "edition": "2024",
  "name": {
    "ru": "Лютня Досс",
    "en": "Doss Lute"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16839-doss-lute",
  "rules": {
    "ru": "Требуется настройка бардом. Играющий без настройки совершает спасбросок Мудрости Сл 15, получая 2d4 психического урона при провале. Играя, можно сотворить любое из перечисленных заклинаний; каждое доступно отдельно один раз до следующего рассвета. Используйте свою заклинательную характеристику и Сл своих заклинаний. Защита от энергии даёт только сопротивление огню.",
    "en": "Requires attunement by a Bard. Playing without attunement requires a DC 15 Wisdom save; failure deals 2d4 Psychic damage. While playing, cast any listed spell, each separately once before the next dawn. Use your own spellcasting ability and spell save DC. Protection from Energy can grant only Fire resistance."
  },
  "spellIds": [
    "animal-friendship-2024",
    "protection-from-evil-and-good-2024",
    "protection-from-energy-2024",
    "protection-from-poison-2024",
    "levitate-2024",
    "invisibility-2024",
    "fly-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "mac-fuirmidh-cittern-2024",
  "edition": "2024",
  "name": {
    "ru": "Цитра Мак-Фуирм",
    "en": "Mac-Fuirmidh Cittern"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16841-mac-fuirmidh-cittern",
  "rules": {
    "ru": "Требуется настройка бардом. Играющий без настройки совершает спасбросок Мудрости Сл 15, получая 2d4 психического урона при провале. Играя, можно сотворить любое из перечисленных заклинаний; каждое доступно отдельно один раз до следующего рассвета. Используйте свою заклинательную характеристику и Сл своих заклинаний.",
    "en": "Requires attunement by a Bard. Playing without attunement requires a DC 15 Wisdom save; failure deals 2d4 Psychic damage. While playing, cast any listed spell, each separately once before the next dawn. Use your own spellcasting ability and spell save DC."
  },
  "spellIds": [
    "barkskin-2024",
    "protection-from-evil-and-good-2024",
    "levitate-2024",
    "cure-wounds-2024",
    "invisibility-2024",
    "fly-2024",
    "fog-cloud-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "dust-of-sneezing-and-choking-2024",
  "edition": "2024",
  "name": {
    "ru": "Порошок чихания и удушья",
    "en": "Dust of Sneezing and Choking"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15914-dust-of-sneezing-and-choking",
  "rules": {
    "ru": "Без настройки. Одно применение. Опознание ошибочно определяет его как Порошок исчезновения. Действием Использование подбросьте порошок: вы и каждое существо в эманации 30 фт. совершаете спасбросок Телосложения Сл 15. Конструкты, Элементали, Слизи, Растения и Нежить автоматически преуспевают. При провале существо Недееспособно и задыхается. В конце каждого своего хода оно повторяет спасбросок, заканчивая оба эффекта при успехе. Малое восстановление также прекращает их. Удушье по правилам 2024: задыхающийся получает 1 уровень Истощения в конце каждого своего хода; когда он снова может дышать, все уровни Истощения от удушья исчезают.",
    "en": "No attunement; one use. Identify incorrectly identifies it as Dust of Disappearance. Use a Utilize action to throw the dust into the air: you and every creature in a 30-foot Emanation make a DC 15 Constitution save. Constructs, Elementals, Oozes, Plants, and Undead succeed automatically. Failure leaves a creature Incapacitated and suffocating. It repeats the save at the end of each of its turns, ending both effects on a success. Lesser Restoration also ends them. Under the 2024 suffocation rule, a choking creature gains 1 Exhaustion level at the end of each of its turns; once it can breathe again, all Exhaustion levels caused by suffocation are removed."
  },
  "spellIds": [
    "lesser-restoration-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "deck-of-illusions-2024",
  "edition": "2024",
  "name": {
    "ru": "Колода иллюзий",
    "en": "Deck of Illusions"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15902-deck-of-illusions",
  "randomTableId": "deck-illusions-2024",
  "spellIds": [
    "dispel-magic-2024"
  ],
  "rules": {
    "ru": "Без настройки. Полная колода содержит 34 карты: 32 существа и 2 зеркальные карты. В найденной колоде обычно отсутствует 1d20 − 1 карта. Действием Магия случайно вытяните карту и бросьте её в точку на земле в пределах 30 фт.; выбор карты вручную не активирует её. По таблице определите безвредную иллюзию над картой: она выглядит и ведёт себя как настоящее существо, но не причиняет вреда. Если видите иллюзию и находитесь в 120 фт. от неё, действием Магия переместите её в любую точку в пределах 30 фт. от карты. Физический контакт раскрывает иллюзию; визуальное исследование действием Изучение требует проверки Интеллекта (Расследование) Сл 15. Перемещение карты или рассеивание иллюзии заканчивает эффект. После этого карта пустеет и больше не работает.",
    "en": "No attunement. A complete deck has 34 cards: 32 creatures and 2 mirrors. A found deck usually lacks 1d20 − 1 cards. With a Magic action, draw randomly and throw the card to a point on the ground within 30 feet; deliberately choosing a card does not activate it. Roll the table for a harmless illusion above the card. It looks and behaves like the depicted creature but cannot harm anything. While you see it from within 120 feet, use a Magic action to move it anywhere within 30 feet of its card. Physical contact reveals the illusion; visual examination with a Study action requires DC 15 Intelligence (Investigation). Moving the card or dispelling the illusion ends it. The card then becomes blank and cannot function again."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "mechanical-domestic-wonder-2024",
  "edition": "2024",
  "name": {
    "ru": "Механическое домашнее диво",
    "en": "Mechanical Domestic Wonder"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/18701-mechanical-domestic-wonder",
  "creatureIds": [
    "domestic-wonder-2024"
  ],
  "rules": {
    "ru": "Без настройки. Для активации заводите диво уникальным ключом 1 минуту, совершая действие Использование каждый свой ход. Активное диво Дружелюбно к вам и союзникам. В бою имеет вашу инициативу и ходит сразу после вас. Выполняет ваши устные команды без затраты ваших действий. Без команд совершает Уклонение и перемещается, избегая опасности. При 0 хитов уничтожается; особенность целеустремлённости может оставить ему 1 хит.",
    "en": "No attunement. Wind the wonder with its unique key for 1 minute, taking a Utilize action on each of your turns. While active it is Friendly to you and your allies. In combat it shares your Initiative and acts immediately after you. It obeys your verbal orders without requiring your action. Without orders it Dodges and moves to avoid danger. It is destroyed at 0 HP; its determination trait can leave it at 1 HP instead."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "figurine-of-wondrous-power-silver-raven-2024",
  "edition": "2024",
  "name": {
    "ru": "Статуэтка чудесной силы: серебряный ворон",
    "en": "Figurine of Wondrous Power: Silver Raven"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/17790-figurine-of-wondrous-power-silver-raven",
  "creatureIds": [
    "raven-2024"
  ],
  "spellIds": [
    "animal-messenger-2024"
  ],
  "rules": {
    "ru": "Без настройки. Действием Магия бросьте фигурку на землю в пределах 60 фт.: она становится Вороном на 12 часов. Если место занято существом или предметом либо слишком тесное, превращения нет. Ворон Дружелюбен к вам и союзникам, понимает ваши языки, выполняет команды, имеет вашу инициативу и ходит сразу после вас. Без команд лишь защищает себя. Пока он в форме ворона, можно сотворять на него Почтовое животное. При 0 хитов, истечении срока или если вы коснётесь его действием Магия, он вновь становится фигуркой. После возвращения в форму фигурки ждите 2 дня до следующего превращения.",
    "en": "No attunement. Use a Magic action to throw the figurine onto the ground within 60 feet, turning it into a Raven for up to 12 hours. It stays a figurine if the space is occupied by a creature or object or is too small. The raven is Friendly to you and your allies, understands your languages, obeys your orders, shares your Initiative, and acts immediately after you. Without orders it only defends itself. While it is a raven, you can cast Animal Messenger on it. At 0 HP, when the duration ends, or when you touch it with a Magic action, it reverts to a figurine. After reverting, it must wait 2 days before transforming again."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "pipes-of-the-sewers-2024",
  "edition": "2024",
  "name": {
    "ru": "Свирель канализации",
    "en": "Pipes of the Sewers"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16016-pipes-of-the-sewers",
  "creatureIds": [
    "rat-2024",
    "giant-rat-2024",
    "swarm-of-rats-2024"
  ],
  "rules": {
    "ru": "Требуется настройка. Обычные и Гигантские крысы Безразличны к вам и не атакуют, пока вы им не угрожаете и не вредите. Свирель имеет 3 заряда, восстанавливает 1d3 на рассвете. Действием Магия начните играть, затем бонусным действием потратьте 1–3 заряда: за каждый призовите один Рой крыс, если в радиусе полумили достаточно крыс (решает мастер). При нехватке крыс заряды всё равно тратятся. Рои идут кратчайшим путём, пока ещё не подчиняясь вам. Каждый не подчинённый другому существу рой в 30 фт. во время игры делает спасбросок Мудрости Сл 15: успех оставляет обычное поведение и даёт иммунитет к этой свирели на 24 часа; провал делает его Дружелюбным вам и союзникам, подчинённым вашим устным командам без затраты действий, пока вы каждый раунд действием Магия продолжаете играть. Без команд рой только защищается. Если он начинает ход дальше 30 фт. от вас, контроль кончается и появляется иммунитет к этой свирели на 24 часа.",
    "en": "Requires attunement. Rats and Giant Rats are Indifferent to you and do not attack unless you harm or threaten them. The pipes have 3 charges and regain 1d3 at dawn. Take a Magic action to play, then a Bonus Action to spend 1–3 charges, calling one Swarm of Rats per charge if enough rats exist within half a mile, as the DM determines. Charges are still spent if too few rats exist. Called swarms follow the shortest route but are not yet controlled. While you play, each swarm within 30 feet that is not controlled by another creature makes a DC 15 Wisdom save. Success leaves its normal behavior and grants immunity to these pipes for 24 hours. Failure makes it Friendly to you and your allies and obedient to verbal orders requiring none of your actions, while you keep playing with a Magic action each round. Without orders it only defends itself. Starting a turn more than 30 feet from you ends control and grants immunity to these pipes for 24 hours."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "elemental-gem-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень элементаля",
    "en": "Elemental Gem"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15920-elemental-gem",
  "creatureIds": [
    "air-elemental-2024",
    "water-elemental-2024",
    "fire-elemental-2024",
    "earth-elemental-2024"
  ],
  "table": {
    "columns": [
      {
        "ru": "Камень",
        "en": "Gem"
      },
      {
        "ru": "Элементаль",
        "en": "Elemental"
      }
    ],
    "rows": [
      [
        {
          "ru": "Синий сапфир",
          "en": "Blue sapphire"
        },
        {
          "ru": "Воздушный",
          "en": "Air"
        }
      ],
      [
        {
          "ru": "Изумруд",
          "en": "Emerald"
        },
        {
          "ru": "Водяной",
          "en": "Water"
        }
      ],
      [
        {
          "ru": "Красный корунд",
          "en": "Red corundum"
        },
        {
          "ru": "Огненный",
          "en": "Fire"
        }
      ],
      [
        {
          "ru": "Жёлтый алмаз",
          "en": "Yellow diamond"
        },
        {
          "ru": "Земляной",
          "en": "Earth"
        }
      ]
    ]
  },
  "rules": {
    "ru": "Без настройки. Действием Использование разбейте камень: он теряет магию, а соответствующий элементаль появляется в ближайшем незанятом пространстве. Он понимает ваши языки, подчиняется командам, имеет вашу инициативу и ходит сразу после вас. Исчезает через 1 час, при смерти либо когда вы отпускаете его бонусным действием.",
    "en": "No attunement. Use a Utilize action to break the gem: it loses its magic and the corresponding elemental appears in the nearest unoccupied space. It understands your languages, obeys your commands, shares your Initiative, and acts immediately after you. It disappears after 1 hour, upon death, or when dismissed with your Bonus Action."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "baba-yagas-dancing-broom-2024",
  "edition": "2024",
  "name": {
    "ru": "Танцующая метла Бабы Яги",
    "en": "Baba Yaga’s Dancing Broom"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15845-baba-yagas-dancing-broom",
  "creatureIds": [
    "animated-broom-2024"
  ],
  "rules": {
    "ru": "Требуется настройка. Держа метлу, действием Магия превратите её в Живую метлу под вашим контролем: она появляется в ближайшем незанятом пространстве и ходит сразу после вас. В свой ход, если вы не Недееспособны и метла в 30 фт., мысленно прикажите ей без затраты действия: задайте перемещение и действие следующего хода либо общий приказ. Бонусным действием произнесите командное слово, возвращая метлу в неживую форму. При 0 хитов она уничтожается; если вернуть её в неживую форму раньше, все хиты восстанавливаются.",
    "en": "Requires attunement. While holding the broom, use a Magic action to turn it into an Animated Broom under your control in the nearest unoccupied space; it acts immediately after you. On your turn, while not Incapacitated and within 30 feet, mentally command its next movement and action or give a general order, without using an action. Speak its command word as a Bonus Action to restore its inanimate form. At 0 HP it is destroyed; reverting before that restores all its HP."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "robe-of-useful-items-2024",
  "edition": "2024",
  "name": {
    "ru": "Мантия полезных предметов",
    "en": "Robe of Useful Items"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/16076-robe-of-useful-items",
  "randomTableId": "robe-useful-items-2024",
  "rules": {
    "ru": "Без настройки. Пока мантия надета, действием Магия снимите одну заплату: она становится изображённым предметом или существом. После снятия всех заплат мантия обычная. Изначально по две заплаты каждого вида: верёвка, зеркало, кинжал, мешок, направленный фонарь (заправлен и горит), шест. Дополнительно 4d4 заплаты по таблице; мастер выбирает или бросает результат для каждой.",
    "en": "No attunement. While wearing the robe, use a Magic action to detach one patch, turning it into the depicted object or creature. Once all patches are gone the robe is nonmagical. It starts with two patches of each kind: Rope, Mirror, Dagger, Sack, Bullseye Lantern (filled and lit), and Pole. It also has 4d4 patches from the table, selected or rolled individually by the DM."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "bag-of-tricks-gray-2024",
  "edition": "2024",
  "name": {
    "ru": "Серая сумка фокусов",
    "en": "Gray Bag of Tricks"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15849-bag-of-tricks",
  "randomTableId": "bag-tricks-gray-2024",
  "rules": {
    "ru": "Без настройки. Действием Магия извлеките пушистый комочек и бросьте до 20 фт.: после приземления он становится существом по таблице цвета сумки. Оно исчезает на следующем рассвете или при 0 хитов. Дружелюбно вам и союзникам, имеет вашу инициативу и ходит сразу после вас. Бонусным действием задайте перемещение и действие его следующего хода; без указаний оно действует согласно своей природе. После извлечения трёх комочков сумка не работает до следующего рассвета.",
    "en": "No attunement. With a Magic action, draw a fuzzy object and throw it up to 20 feet; on landing it becomes the creature rolled on the bag’s color table. It disappears at the next dawn or at 0 HP. Friendly to you and your allies, it shares your Initiative and acts immediately after you. Use a Bonus Action to direct its movement and action on its next turn; without instructions it follows its nature. After three objects are drawn, the bag cannot be used again until the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "bag-of-tricks-rust-2024",
  "edition": "2024",
  "name": {
    "ru": "Рыжая сумка фокусов",
    "en": "Rust Bag of Tricks"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15849-bag-of-tricks",
  "randomTableId": "bag-tricks-rust-2024",
  "rules": {
    "ru": "Без настройки. Действием Магия извлеките пушистый комочек и бросьте до 20 фт.: после приземления он становится существом по таблице цвета сумки. Оно исчезает на следующем рассвете или при 0 хитов. Дружелюбно вам и союзникам, имеет вашу инициативу и ходит сразу после вас. Бонусным действием задайте перемещение и действие его следующего хода; без указаний оно действует согласно своей природе. После извлечения трёх комочков сумка не работает до следующего рассвета.",
    "en": "No attunement. With a Magic action, draw a fuzzy object and throw it up to 20 feet; on landing it becomes the creature rolled on the bag’s color table. It disappears at the next dawn or at 0 HP. Friendly to you and your allies, it shares your Initiative and acts immediately after you. Use a Bonus Action to direct its movement and action on its next turn; without instructions it follows its nature. After three objects are drawn, the bag cannot be used again until the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "bag-of-tricks-tan-2024",
  "edition": "2024",
  "name": {
    "ru": "Бежевая сумка фокусов",
    "en": "Tan Bag of Tricks"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/15849-bag-of-tricks",
  "randomTableId": "bag-tricks-tan-2024",
  "rules": {
    "ru": "Без настройки. Действием Магия извлеките пушистый комочек и бросьте до 20 фт.: после приземления он становится существом по таблице цвета сумки. Оно исчезает на следующем рассвете или при 0 хитов. Дружелюбно вам и союзникам, имеет вашу инициативу и ходит сразу после вас. Бонусным действием задайте перемещение и действие его следующего хода; без указаний оно действует согласно своей природе. После извлечения трёх комочков сумка не работает до следующего рассвета.",
    "en": "No attunement. With a Magic action, draw a fuzzy object and throw it up to 20 feet; on landing it becomes the creature rolled on the bag’s color table. It disappears at the next dawn or at 0 HP. Friendly to you and your allies, it shares your Initiative and acts immediately after you. Use a Bonus Action to direct its movement and action on its next turn; without instructions it follows its nature. After three objects are drawn, the bag cannot be used again until the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "spell-slingers-puppet-2024",
  "edition": "2024",
  "name": {
    "ru": "Кукла заклинателя",
    "en": "Spell-Slinger’s Puppet"
  },
  "kind": "wondrous",
  "rarity": "uncommon",
  "replicationLevel": 10,
  "sourceUrl": "https://next.dnd.su/items/21174-spell-slingers-puppet",
  "rules": {
    "ru": "Требуется настройка. Держа куклу, бонусным действием потяните шнур: она парит в видимом незанятом месте в 30 фт. от вас. Пока парит, бонусным действием переместите её до 30 фт. в другое видимое незанятое место в 30 фт. от вас. Парение длится 1 минуту либо пока вы не закончите его бонусным действием. Если кукла в 30 фт., можно говорить её ртом вместо своего, включая вербальные компоненты заклинаний, даже когда вы не можете говорить.",
    "en": "Requires attunement. While holding the doll, pull its cord as a Bonus Action to send it hovering to a visible unoccupied space within 30 feet of you. While it hovers, a Bonus Action moves it up to 30 feet to another visible unoccupied space within 30 feet of you. Hovering lasts 1 minute or until you end it as a Bonus Action. Within 30 feet, you can speak through its mouth instead of yours, including Verbal spell components when unable to speak."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "amulet-of-health-2024",
  "edition": "2024",
  "name": {
    "ru": "Амулет здоровья",
    "en": "Amulet of Health"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15834-amulet-of-health",
  "rules": {
    "ru": "Требуется настройка. Пока амулет надет, Телосложение равно 19, если без него оно ниже 19.",
    "en": "Requires attunement. While worn, Constitution is 19 unless already 19 or higher without the amulet."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "bracers-of-defense-2024",
  "edition": "2024",
  "name": {
    "ru": "Наручи защиты",
    "en": "Bracers of Defense"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15867-bracers-of-defense",
  "rules": {
    "ru": "Требуется настройка. Пока наручи надеты и вы не носите доспехов и щита, КД +2.",
    "en": "Requires attunement. While worn without armor or a Shield, gain +2 AC."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "belt-of-hill-giant-strength-2024",
  "edition": "2024",
  "name": {
    "ru": "Пояс силы холмового великана",
    "en": "Belt of Hill Giant Strength"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17721-belt-of-hill-giant-strength",
  "rules": {
    "ru": "Требуется настройка. Надетый пояс делает Силу равной 21, если без него она ниже 21.",
    "en": "Requires attunement. While worn, Strength is 21 unless already 21 or higher without the belt."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "mantle-of-spell-resistance-2024",
  "edition": "2024",
  "name": {
    "ru": "Мантия сопротивления заклинаниям",
    "en": "Mantle of Spell Resistance"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15983-mantle-of-spell-resistance",
  "rules": {
    "ru": "Требуется настройка. Пока мантия надета, спасброски против заклинаний совершаются с преимуществом.",
    "en": "Requires attunement. While worn, gain Advantage on saving throws against spells."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "periapt-of-proof-against-poison-2024",
  "edition": "2024",
  "name": {
    "ru": "Медальон защиты от яда",
    "en": "Periapt of Proof against Poison"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/16011-periapt-of-proof-against-poison",
  "rules": {
    "ru": "Требуется настройка. Пока медальон надет, иммунитет к урону ядом и состоянию Отравленный.",
    "en": "Requires attunement. While worn, gain immunity to Poison damage and the Poisoned condition."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "horseshoes-of-speed-2024",
  "edition": "2024",
  "name": {
    "ru": "Подковы скорости",
    "en": "Horseshoes of Speed"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15966-horseshoes-of-speed",
  "rules": {
    "ru": "Без настройки. Комплект из четырёх подков. Действием Магия прикрепите одну к копыту лошади или подобного существа; снять одну подкову также можно действием Магия. Когда все четыре закреплены на одном существе, его Скорость увеличивается на 30 фт.",
    "en": "No attunement. A set of four horseshoes. A Magic action attaches one to a horse’s or similar creature’s hoof; a Magic action also removes one. With all four attached to the same creature, its Speed increases by 30 feet."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "cloak-of-displacement-2024",
  "edition": "2024",
  "name": {
    "ru": "Плащ ускользания",
    "en": "Cloak of Displacement"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15884-cloak-of-displacement",
  "rules": {
    "ru": "Требуется настройка. Пока плащ надет, броски атаки по вам совершаются с помехой. Получение урона выключает эффект до начала вашего следующего хода. При Скорости 0 эффект подавлен.",
    "en": "Requires attunement. While worn, attack rolls against you have Disadvantage. Taking damage suspends this benefit until the start of your next turn. The benefit is suppressed while your Speed is 0."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "wings-of-flying-2024",
  "edition": "2024",
  "name": {
    "ru": "Крылья полёта",
    "en": "Wings of Flying"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/16173-wings-of-flying",
  "rules": {
    "ru": "Требуется настройка. Пока плащ надет, действием Магия превратите его в крылья: скорость полёта 60 фт. на 1 час либо до окончания эффекта вашим действием Магия. Если крылья исчезают в полёте, вы падаете. После исчезновения крыльев ждите 1d12 часов до нового применения.",
    "en": "Requires attunement. While wearing the cloak, use a Magic action to turn it into wings, granting Fly Speed 60 feet for 1 hour or until you end the effect with a Magic action. If airborne when the wings vanish, you fall. After they vanish, wait 1d12 hours before using them again."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "boots-of-speed-2024",
  "edition": "2024",
  "name": {
    "ru": "Сапоги скорости",
    "en": "Boots of Speed"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15862-boots-of-speed",
  "rules": {
    "ru": "Требуется настройка. Пока сапоги надеты, бонусным действием щёлкните каблуками: Скорость удваивается, провоцированные атаки по вам совершаются с помехой. Повторное щёлканье каблуками заканчивает эффект. Всего доступно 10 минут действия до завершения Долгого отдыха.",
    "en": "Requires attunement. While wearing the boots, click your heels as a Bonus Action to double your Speed and impose Disadvantage on Opportunity Attacks against you. Click your heels again to end the effect. After 10 total minutes of use, their magic is unavailable until you finish a Long Rest."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "chime-of-opening-2024",
  "edition": "2024",
  "name": {
    "ru": "Колокольчик открывания",
    "en": "Chime of Opening"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15880-chime-of-opening",
  "rules": {
    "ru": "Без настройки. Трубка длиной 1 фут весит 1 фунт. Действием Магия ударьте по ней и сотворите Стук: вместо обычного звука слышен звон колокольчика до 300 фт. После десятого применения предмет трескается и больше не работает.",
    "en": "No attunement. A 1-foot tube weighing 1 pound. Strike it with a Magic action to cast Knock, replacing its usual sound with a clear chime audible up to 300 feet. After its tenth use it cracks and no longer functions."
  },
  "spellIds": [
    "knock-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "ioun-stone-protection-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень Айун (защита)",
    "en": "Ioun Stone (protection)"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17754-ioun-stone-protection",
  "rules": {
    "ru": "Требуется настройка. Действием Магия запустите камень по орбите в 1d3 фт. вокруг головы; одновременно может вращаться до трёх камней Айун. Они считаются надетыми и уклоняются от столкновений и чужих попыток атаковать или схватить их. Действием Использование поймайте любое число своих камней. При окончании настройки камень падает. Пока вращается, КД +1.",
    "en": "Requires attunement. Use a Magic action to set the stone orbiting 1d3 feet from your head; at most three Ioun Stones can orbit you. They count as worn and avoid collisions and others’ attempts to attack or grab them. A Utilize action retrieves any number of your orbiting stones. Ending attunement makes the stone fall. While orbiting, gain +1 AC."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "ioun-stone-awareness-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень Айун (осведомлённость)",
    "en": "Ioun Stone (awareness)"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17758-ioun-stone-awareness",
  "rules": {
    "ru": "Требуется настройка. Действием Магия запустите камень по орбите в 1d3 фт. вокруг головы; одновременно может вращаться до трёх камней Айун. Они считаются надетыми и уклоняются от столкновений и чужих попыток атаковать или схватить их. Действием Использование поймайте любое число своих камней. При окончании настройки камень падает. Пока вращается, преимущество на инициативу и проверки Мудрости (Восприятие).",
    "en": "Requires attunement. Use a Magic action to set the stone orbiting 1d3 feet from your head; at most three Ioun Stones can orbit you. They count as worn and avoid collisions and others’ attempts to attack or grab them. A Utilize action retrieves any number of your orbiting stones. Ending attunement makes the stone fall. While orbiting, gain Advantage on Initiative rolls and Wisdom (Perception) checks."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "ioun-stone-sustenance-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень Айун (питание)",
    "en": "Ioun Stone (sustenance)"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17759-ioun-stone-sustenance",
  "rules": {
    "ru": "Требуется настройка. Действием Магия запустите камень по орбите в 1d3 фт. вокруг головы; одновременно может вращаться до трёх камней Айун. Они считаются надетыми и уклоняются от столкновений и чужих попыток атаковать или схватить их. Действием Использование поймайте любое число своих камней. При окончании настройки камень падает. Пока вращается, еда и питьё не нужны.",
    "en": "Requires attunement. Use a Magic action to set the stone orbiting 1d3 feet from your head; at most three Ioun Stones can orbit you. They count as worn and avoid collisions and others’ attempts to attack or grab them. A Utilize action retrieves any number of your orbiting stones. Ending attunement makes the stone fall. While orbiting, you need no food or drink."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "ioun-stone-reserve-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень Айун (резерв)",
    "en": "Ioun Stone (reserve)"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17765-ioun-stone-reserve",
  "rules": {
    "ru": "Требуется настройка. Действием Магия запустите камень по орбите в 1d3 фт. вокруг головы; одновременно может вращаться до трёх камней Айун. Они считаются надетыми и уклоняются от столкновений и чужих попыток атаковать или схватить их. Действием Использование поймайте любое число своих камней. При окончании настройки камень падает. Хранит до 4 кругов заклинаний одновременно; найденный камень содержит 1d4 − 1 кругов по выбору мастера. Касаясь камня, любое существо может сотворить в него заклинание 1–4 круга: оно сохраняется вместо обычного эффекта. Место определяется кругом потраченной ячейки; при нехватке места заклинание тратится впустую. Пока камень вращается, сотворите любое сохранённое заклинание с исходными кругом, Сл, бонусом атаки и заклинательной характеристикой вложившего его существа. В остальном заклинателем являетесь вы. Сотворение освобождает занятое место.",
    "en": "Requires attunement. Use a Magic action to set the stone orbiting 1d3 feet from your head; at most three Ioun Stones can orbit you. They count as worn and avoid collisions and others’ attempts to attack or grab them. A Utilize action retrieves any number of your orbiting stones. Ending attunement makes the stone fall. Stores up to 4 spell levels at once; a found stone has 1d4 − 1 levels chosen by the DM. Any creature touching the stone can cast a level-1–4 spell into it, storing it instead of producing its normal effect. The slot level determines space used; insufficient space wastes the spell. While the stone orbits you, cast a stored spell using its original level and the storing caster’s save DC, attack bonus, and spellcasting ability. Otherwise you are the caster. Casting removes the stored spell and frees its space."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "boots-of-levitation-2024",
  "edition": "2024",
  "name": {
    "ru": "Сапоги левитации",
    "en": "Boots of Levitation"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15861-boots-of-levitation",
  "rules": {
    "ru": "Требуется настройка. Пока сапоги надеты, можно сотворять Левитацию на себя.",
    "en": "Requires attunement. While wearing the boots, you can cast Levitate on yourself."
  },
  "spellIds": [
    "levitate-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "dimensional-shackles-2024",
  "edition": "2024",
  "name": {
    "ru": "Оковы измерений",
    "en": "Dimensional Shackles"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15907-dimensional-shackles",
  "rules": {
    "ru": "Без настройки. Действием Использование наденьте на Недееспособное существо от Маленького до Большого размера; оковы подстраиваются. Скованный не может телепортироваться и иным способом перемещаться между планами, но может проходить через межпланарные порталы. Вы и существа, назначенные вами при наложении, можете снять оковы действием Использование. Скованный раз в 30 дней может сделать проверку Силы (Атлетика) Сл 30, при успехе разрушая оковы и освобождаясь.",
    "en": "No attunement. Use a Utilize action to fit them to an Incapacitated Small, Medium, or Large creature; they resize to fit. They prevent the bound creature’s teleportation and other extraplanar travel but do not prevent passage through interplanar portals. You and creatures designated when applying them can remove them with a Utilize action. Once every 30 days the bound creature can attempt a DC 30 Strength (Athletics) check, destroying the shackles and escaping on success."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "wraps-of-unarmed-power-2-2024",
  "edition": "2024",
  "name": {
    "ru": "Обмотки безоружной мощи +2",
    "en": "Wraps of Unarmed Power, +2"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17412-2-wraps-of-unarmed-power",
  "rules": {
    "ru": "Без настройки. Пока обмотки надеты, броски атаки и урона Безоружных ударов получают +2. При нанесении урона выбирайте силовой или обычный тип удара.",
    "en": "No attunement. While worn, gain +2 to Unarmed Strike attack and damage rolls. Each strike can deal Force damage or its normal damage type, your choice."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "brooch-of-the-elements-2024",
  "edition": "2024",
  "name": {
    "ru": "Брошь стихий",
    "en": "Brooch of the Elements"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17495-brooch-of-the-elements",
  "rules": {
    "ru": "Требуется настройка. 3 заряда, все восстанавливаются на рассвете. Когда видимое существо в 60 фт. попадает броском атаки и наносит урон, реакцией потратьте 1 заряд: измените тип урона этой атаки на звук, кислоту, огонь, холод, электричество или яд.",
    "en": "Requires attunement. Holds 3 charges, all restored at dawn. When a visible creature within 60 feet hits with an attack roll and deals damage, spend 1 charge as a Reaction to change that attack’s damage type to Thunder, Acid, Fire, Cold, Lightning, or Poison."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "scholars-anchoring-bangle-2024",
  "edition": "2024",
  "name": {
    "ru": "Браслет сосредоточенности учёного",
    "en": "Scholar's Anchoring Bangle"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/21170-scholars-anchoring-bangle",
  "rules": {
    "ru": "Требуется настройка. Пока браслет надет, при действии Изучение для проверки Интеллекта с навыком, которым владеете, можно считать результат d20 9 и ниже равным 10. При провале спасброска Телосложения для поддержания Концентрации реакцией замените провал успехом; это свойство восстанавливается на следующем рассвете.",
    "en": "Requires attunement. While worn, when a Study action makes an Intelligence check using a skill you are proficient in, treat a d20 result of 9 or lower as 10. After failing a Constitution save to maintain Concentration, use a Reaction to succeed instead; this property recharges at the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "scarlet-spellbook-2024",
  "edition": "2024",
  "name": {
    "ru": "Алая книга заклинаний",
    "en": "Scarlet Spellbook"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/21325-scarlet-spellbook",
  "rules": {
    "ru": "Требуется настройка волшебником. Используется как книга заклинаний и магическая фокусировка. При использовании Магического восстановления дополнительно восстановите 2d6 + половина уровня волшебника (вниз) хитов. При использовании Запоминания заклинания можно заменить одно заклинание 1+ круга, подготовленное Сотворением заклинаний, другим заклинанием 1+ круга из своей книги.",
    "en": "Requires attunement by a Wizard. Serves as a spellbook and Arcane Focus. Using Arcane Recovery also restores 2d6 + half your Wizard level, rounded down, HP. Using Memorize Spell lets you replace one level-1+ spell prepared through Spellcasting with another level-1+ spell from your spellbook."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "masqueraders-brooch-2024",
  "edition": "2024",
  "name": {
    "ru": "Брошь маскарада",
    "en": "Masquerader's Brooch"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/21323-masqueraders-brooch",
  "rules": {
    "ru": "Требуется настройка. Пока держите или носите брошь, бонусным действием создайте иллюзию внешнего вида одежды, доспехов, оружия, снаряжения и других вещей при вас: от небольших изменений до полной смены облика вещей. Длится 1 час либо до потери контакта с брошью. Физическая проверка выдаёт иллюзию; действием Изучение можно распознать её проверкой Интеллекта (Расследование) Сл 13. Пока держите или носите брошь, действием Магия сотворяйте Смену обличья без Концентрации, только вариант Изменение внешности.",
    "en": "Requires attunement. While holding or wearing the brooch, use a Bonus Action to disguise your clothing, armor, weapons, equipment, and other possessions with an illusion, from minor changes to a wholly different appearance. It lasts 1 hour or until contact with the brooch ends. Physical examination reveals it; a Study action and DC 13 Intelligence (Investigation) check also reveal it. While holding or wearing the brooch, use a Magic action to cast Alter Self without Concentration, using only Change Appearance."
  },
  "spellIds": [
    "alter-self-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "gem-of-seeing-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень зрения",
    "en": "Gem of Seeing"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15941-gem-of-seeing",
  "rules": {
    "ru": "Требуется настройка. 3 заряда, восстановление 1d3 на рассвете. Действием Магия потратьте 1 заряд: на 10 минут получите Истинное зрение 120 фт., пока смотрите через камень. Истинное зрение: в указанной дистанции видите сквозь обычную и магическую темноту, видите Невидимые предметы и существ, зрительные иллюзии прозрачны и спасброски против них автоматически успешны, видите истинный облик магически превращённых существ и предметов, а также Эфирный план.",
    "en": "Requires attunement. Has 3 charges and regains 1d3 at dawn. A Magic action spends 1 charge for 10 minutes of Truesight 120 feet while looking through the gem. Truesight: within its range, see through normal and magical Darkness, see Invisible creatures and objects, see visual illusions as transparent and automatically succeed on saves against them, discern magically transformed creatures’ and objects’ true forms, and see into the Ethereal Plane."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "robe-of-eyes-2024",
  "edition": "2024",
  "name": {
    "ru": "Мантия глаз",
    "en": "Robe of Eyes"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/16072-robe-of-eyes",
  "rules": {
    "ru": "Требуется настройка. Пока мантия надета, преимущество на проверки Мудрости (Восприятие), использующие зрение, а также Тёмное зрение и Истинное зрение 120 фт. Если Свет сотворён на мантию или Дневной свет в 5 фт. от неё, вы Ослеплены на 1 минуту. В конце каждого своего хода делайте спасбросок Телосложения, заканчивая состояние при успехе: Сл 11 для Света, 15 для Дневного света. Истинное зрение: в указанной дистанции видите сквозь обычную и магическую темноту, видите Невидимые предметы и существ, зрительные иллюзии прозрачны и спасброски против них автоматически успешны, видите истинный облик магически превращённых существ и предметов, а также Эфирный план.",
    "en": "Requires attunement. While worn, gain Advantage on sight-based Wisdom (Perception), Darkvision 120 feet, and Truesight 120 feet. Light cast on the robe or Daylight cast within 5 feet Blinds you for 1 minute. At the end of each of your turns, make a Constitution save to end it: DC 11 for Light, DC 15 for Daylight. Truesight: within its range, see through normal and magical Darkness, see Invisible creatures and objects, see visual illusions as transparent and automatically succeed on saves against them, discern magically transformed creatures’ and objects’ true forms, and see into the Ethereal Plane."
  },
  "spellIds": [
    "light-2024",
    "daylight-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "cape-of-the-mountebank-2024",
  "edition": "2024",
  "name": {
    "ru": "Плащ шарлатана",
    "en": "Cape of the Mountebank"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15874-cape-of-the-mountebank",
  "rules": {
    "ru": "Без настройки. Пока плащ надет, действием Магия сотворите Переносящую дверь; повторное применение после следующего рассвета. При телепортации оставленное вами пространство Слабо заслонено дымом до конца вашего следующего хода.",
    "en": "No attunement. While wearing the cape, use a Magic action to cast Dimension Door, recharging at the next dawn. Teleporting leaves your former space Lightly Obscured by smoke until the end of your next turn."
  },
  "spellIds": [
    "dimension-door-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "quaals-feather-token-whip-2024",
  "edition": "2024",
  "name": {
    "ru": "Перо Кваля (кнут)",
    "en": "Quaal’s Feather Token (whip)"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17780-quaals-feather-token-whip",
  "rules": {
    "ru": "Без настройки; одно применение. Действием Магия бросьте перо в точку в 10 фт.: оно исчезает, появляется парящий кнут. Бонусным действием совершите им рукопашную атаку заклинанием +9 по существу в 10 фт. от кнута: 1d6 + 5 силового урона. В свой ход бонусным действием переместите кнут до 20 фт. и снова атакуйте существо в 10 фт. от него. Кнут исчезает через 1 час, при вашей смерти или Недееспособности либо когда вы отпускаете его действием Магия.",
    "en": "No attunement; one use. With a Magic action, throw the token to a point within 10 feet; it vanishes and a hovering whip appears. A Bonus Action makes a +9 melee spell attack against a creature within 10 feet of the whip, dealing 1d6 + 5 Force damage. On your turn a Bonus Action moves the whip up to 20 feet and attacks again within its 10-foot reach. It vanishes after 1 hour, when you die or become Incapacitated, or when dismissed with a Magic action."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "quaals-feather-token-swan-boat-2024",
  "edition": "2024",
  "name": {
    "ru": "Перо Кваля (лодка-лебедь)",
    "en": "Quaal’s Feather Token (swan boat)"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17781-quaals-feather-token-swan-boat",
  "rules": {
    "ru": "Без настройки; одно применение. Действием Магия коснитесь пером водоёма диаметром минимум 60 фт. Перо исчезает, создавая лодку-лебедя 50 × 20 фт., способную сама двигаться по воде со скоростью 6 миль/час. На борту действием Магия приказывайте двигаться или повернуть на 90 градусов. Лодка исчезает через 24 часа либо когда вы отпускаете её действием Магия.",
    "en": "No attunement; one use. Use a Magic action to touch the token to a body of water at least 60 feet across. It vanishes, creating a 50-by-20-foot swan boat that propels itself at 6 miles per hour. While aboard, use a Magic action to command movement or a 90-degree turn. It vanishes after 24 hours or when dismissed with a Magic action."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "mythallar-cloak-2024",
  "edition": "2024",
  "name": {
    "ru": "Плащ мифаллара",
    "en": "Mythallar Cloak"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/17501-mythallar-cloak",
  "rules": {
    "ru": "Требуется настройка. 10 зарядов, восстановление 1d10 на рассвете. Пока плащ надет, бонусным действием потратьте 1 заряд: на 1 минуту получите полёт 30 фт. с парением; раз в каждый свой ход при попадании по существу броском атаки с уроном добавьте 1d4 урона излучением. Можно закончить эффект без действия. При окончании эффекта в воздухе вы падаете.",
    "en": "Requires attunement. Has 10 charges and regains 1d10 at dawn. While worn, a Bonus Action spends 1 charge for 1 minute of Fly Speed 30 feet with hover. Once on each of your turns during this effect, hitting a creature with a damaging attack roll can add 1d4 Radiant damage. End the effect without an action. If airborne when it ends, you fall."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "belt-of-dwarvenkind-2024",
  "edition": "2024",
  "name": {
    "ru": "Пояс дварфов",
    "en": "Belt of Dwarvenkind"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15853-belt-of-dwarvenkind",
  "rules": {
    "ru": "Требуется настройка. Пока пояс надет, знаете Дварфийский, получаете преимущество на Харизму (Убеждение) при общении с дварфами и дуэргарами, Телосложение +2 до максимума 20. Если вы не дварф и не дуэргар, также получаете Тёмное зрение 60 фт., сопротивление урону ядом и преимущество на спасброски против получения или для окончания состояния Отравленный. Пока настроены, на каждом рассвете шанс 50% отрастить полную бороду, если способны её отращивать; имеющаяся борода становится гуще.",
    "en": "Requires attunement. While worn, learn Dwarvish, gain Advantage on Charisma (Persuasion) with dwarves and duergar, and increase Constitution by 2 to a maximum of 20. If neither dwarf nor duergar, also gain Darkvision 60 feet, Poison resistance, and Advantage on saves to avoid or end Poisoned. While attuned, each dawn has a 50% chance to grow a full beard if you can grow one, or thicken an existing beard."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "blood-amulet-2024",
  "edition": "2024",
  "name": {
    "ru": "Амулет крови",
    "en": "Blood Amulet"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/21139-blood-amulet",
  "rules": {
    "ru": "Требуется настройка. 3 заряда, восстановление 1d3 на рассвете. При нанесении урона существу можно потратить 1 заряд, нанеся дополнительно 2d10 некротического урона. Цель делает спасбросок Телосложения Сл 15; провал добавляет 1 уровень Истощения.",
    "en": "Requires attunement. Has 3 charges and regains 1d3 at dawn. When you damage a creature, spend 1 charge to add 2d10 Necrotic damage. The target makes a DC 15 Constitution save; failure adds 1 Exhaustion level."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "horn-of-blasting-2024",
  "edition": "2024",
  "name": {
    "ru": "Рог взрыва",
    "en": "Horn of Blasting"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15962-horn-of-blasting",
  "rules": {
    "ru": "Без настройки. Действием Магия подуйте в рог: конус 30 фт., звук слышен за 600 фт. Каждое существо в конусе делает спасбросок Телосложения Сл 15: провал — 5d8 урона звуком и Глухота на 1 минуту, успех — только половина урона. Стеклянные и кристаллические предметы в области, которые никто не несёт и не носит, получают 10d8 урона звуком. Каждое применение с вероятностью 20% уничтожает рог взрывом и наносит вам 10d6 силового урона.",
    "en": "No attunement. A Magic action sounds the horn in a 30-foot Cone, audible within 600 feet. Each creature in the cone makes a DC 15 Constitution save: failure deals 5d8 Thunder damage and Deafens for 1 minute; success deals half damage only. Unworn, uncarried glass and crystal objects in the cone take 10d8 Thunder damage. Each use has a 20% chance to explode, destroying the horn and dealing 10d6 Force damage to you."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "rope-of-entanglement-2024",
  "edition": "2024",
  "name": {
    "ru": "Верёвка опутывания",
    "en": "Rope of Entanglement"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/16085-rope-of-entanglement",
  "rules": {
    "ru": "Без настройки. Верёвка длиной 30 фт., КД 20, 20 хитов, иммунитет к психическому урону и яду. Пока остаётся хотя бы 1 хит, восстанавливает 1 хит за 5 минут; при 0 уничтожается. Держа один конец, действием Магия опутайте видимое существо в 20 фт.: спасбросок Ловкости Сл 15 или состояние Опутанный. Бонусным действием повторите команду, освобождая цель и возвращая верёвку в руку, либо отпустите конец — она свернётся в пространстве цели. Опутанный действием делает Силу (Атлетика) или Ловкость (Акробатика) Сл 15, освобождаясь при успехе. Если при этом вы держите конец, реакцией верните верёвку в руку; иначе она свернётся у цели.",
    "en": "No attunement. The 30-foot rope has AC 20, 20 HP, and immunity to Psychic and Poison damage. With at least 1 HP it regains 1 HP every 5 minutes; at 0 it is destroyed. Holding one end, use a Magic action to restrain a visible creature within 20 feet: DC 15 Dexterity save or Restrained. Repeat the command as a Bonus Action to release it and coil the rope into your hand, or drop your end to leave it coiled in the target’s space. The restrained creature can use an action for DC 15 Strength (Athletics) or Dexterity (Acrobatics) to escape. If still holding the end, you can use a Reaction to recall the rope upon escape; otherwise it coils by the target."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "brazier-of-commanding-fire-elementals-2024",
  "edition": "2024",
  "name": {
    "ru": "Жаровня командования огненными элементалями",
    "en": "Brazier of Commanding Fire Elementals"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15868-brazier-of-commanding-fire-elementals",
  "creatureIds": [
    "fire-elemental-2024"
  ],
  "rules": {
    "ru": "Без настройки. Находясь в 5 фт. от жаровни, действием Магия призовите Огненного элементаля в ближайшем к жаровне незанятом пространстве. Элементаль подчиняется вашим командам, имеет вашу инициативу и ходит сразу после вас. Исчезает через 1 час, при смерти либо когда вы отпускаете его бонусным действием. Следующий призыв доступен после следующего рассвета.",
    "en": "No attunement. Within 5 feet of the brazier, use a Magic action to summon a Fire Elemental in the nearest unoccupied space to it. The elemental obeys your commands, shares your Initiative, and acts immediately after you. It vanishes after 1 hour, upon death, or when dismissed with your Bonus Action. The next summoning is available after the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "censer-of-controlling-air-elementals-2024",
  "edition": "2024",
  "name": {
    "ru": "Кадило контролирования воздушных элементалей",
    "en": "Censer of Controlling Air Elementals"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15878-censer-of-controlling-air-elementals",
  "creatureIds": [
    "air-elemental-2024"
  ],
  "rules": {
    "ru": "Без настройки. Слегка раскачивая кадило, действием Магия призовите Воздушного элементаля в ближайшем к кадилу незанятом пространстве. Элементаль подчиняется вашим командам, имеет вашу инициативу и ходит сразу после вас. Исчезает через 1 час, при смерти либо когда вы отпускаете его бонусным действием. Следующий призыв доступен после следующего рассвета.",
    "en": "No attunement. Gently swinging the censer, use a Magic action to summon an Air Elemental in the nearest unoccupied space to it. The elemental obeys your commands, shares your Initiative, and acts immediately after you. It vanishes after 1 hour, upon death, or when dismissed with your Bonus Action. The next summoning is available after the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "stone-of-controlling-earth-elementals-2024",
  "edition": "2024",
  "name": {
    "ru": "Камень контролирования земляных элементалей",
    "en": "Stone of Controlling Earth Elementals"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/16123-stone-of-controlling-earth-elementals",
  "creatureIds": [
    "earth-elemental-2024"
  ],
  "rules": {
    "ru": "Без настройки. Прижимая этот камень весом 5 фунтов к земле, действием Магия призовите Земляного элементаля в выбранном незанятом пространстве в 30 фт. от вас. Элементаль подчиняется вашим командам, имеет вашу инициативу и ходит сразу после вас. Исчезает через 1 час, при смерти либо когда вы отпускаете его бонусным действием. Следующий призыв доступен после следующего рассвета.",
    "en": "No attunement. Holding the 5-pound stone against the ground, use a Magic action to summon an Earth Elemental in an unoccupied space of your choice within 30 feet. The elemental obeys your commands, shares your Initiative, and acts immediately after you. It vanishes after 1 hour, upon death, or when dismissed with your Bonus Action. The next summoning is available after the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "bowl-of-commanding-water-elementals-2024",
  "edition": "2024",
  "name": {
    "ru": "Чаша командования водяными элементалями",
    "en": "Bowl of Commanding Water Elementals"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15865-bowl-of-commanding-water-elementals",
  "creatureIds": [
    "water-elemental-2024"
  ],
  "rules": {
    "ru": "Без настройки. Находясь в 5 фт. от наполненной водой чаши, действием Магия призовите Водяного элементаля в ближайшем к чаше незанятом пространстве. Чаша диаметром примерно 1 фут и глубиной полфута вмещает около 3 галлонов. Элементаль подчиняется вашим командам, имеет вашу инициативу и ходит сразу после вас. Исчезает через 1 час, при смерти либо когда вы отпускаете его бонусным действием. Следующий призыв доступен после следующего рассвета.",
    "en": "No attunement. Within 5 feet of the water-filled bowl, use a Magic action to summon a Water Elemental in the nearest unoccupied space to it. The bowl is about 1 foot across and half a foot deep, holding about 3 gallons. The elemental obeys your commands, shares your Initiative, and acts immediately after you. It vanishes after 1 hour, upon death, or when dismissed with your Bonus Action. The next summoning is available after the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "iron-bands-of-bilarro-2024",
  "edition": "2024",
  "name": {
    "ru": "Железные ленты Биларро",
    "en": "Iron Bands of Bilarro"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15972-iron-bands-of-bilarro",
  "rules": {
    "ru": "Без настройки. Сфера диаметром 3 дюйма, вес 1 фунт. Действием Магия бросьте в видимое существо Огромного размера или меньше в 60 фт.: дальнобойная атака с бонусом Ловкость + БМ. Попадание Опутывает цель. Бонусным действием произнесите команду, освобождая цель; при этом или при промахе ленты сворачиваются в сферу. Любое касающееся лент существо, включая пленника, может действием сделать проверку Силы (Атлетика) Сл 20. Успех уничтожает предмет и освобождает цель; при провале последующие попытки этого существа автоматически проваливаются 24 часа. После применения недоступно до следующего рассвета.",
    "en": "No attunement. A 3-inch sphere weighing 1 pound. Use a Magic action to throw it at a visible Huge or smaller creature within 60 feet, making a ranged attack with Dexterity modifier + PB. A hit Restrains the target. A Bonus Action command releases it; release or a missed attack returns the bands to a sphere. Any creature touching the bands, including the captive, can use an action for a DC 20 Strength (Athletics) check. Success destroys the item and releases the target; failure makes that creature’s subsequent attempts fail automatically for 24 hours. After use, unavailable until the next dawn."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "necklace-of-fireballs-2024",
  "edition": "2024",
  "name": {
    "ru": "Ожерелье огненных шаров",
    "en": "Necklace of Fireballs"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15997-necklace-of-fireballs",
  "rules": {
    "ru": "Без настройки. 1d6 + 3 бусины. Действием Магия снимите и бросьте бусину до 60 фт.: в месте падения Огненный шар 3-го круга, Сл 15. Можно бросить несколько бусин или всё ожерелье; каждая дополнительная бусина добавляет 1d6 урона до максимума 12d6.",
    "en": "No attunement. Holds 1d6 + 3 beads. Use a Magic action to detach and throw a bead up to 60 feet, producing a level-3 Fireball at impact with save DC 15. Throw multiple beads or the whole necklace to add 1d6 damage per bead after the first, up to 12d6."
  },
  "spellIds": [
    "fireball-2024"
  ]
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "hewards-handy-haversack-2024",
  "edition": "2024",
  "name": {
    "ru": "Удобный рюкзак Хеварда",
    "en": "Heward’s Handy Haversack"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/15959-hewards-handy-haversack",
  "rules": {
    "ru": "Без настройки. Рюкзак весит 5 фунтов независимо от содержимого. Два боковых кармана вмещают каждый до 200 фунтов и 25 кубических футов, центральный — до 500 фунтов и 64 кубических футов. Извлекайте предмет действием Использование или бонусным действием: нужная вещь оказывается сверху. Перегрузка, прокол или разрыв любого кармана уничтожает рюкзак и навсегда теряет содержимое, кроме Артефактов, появляющихся где-то ещё. Выворачивание высыпает содержимое без вреда; перед использованием верните обычную форму. Воздуха в каждом кармане хватает на 10 минут, делённые на число дышащих внутри. Если поместить этот предмет в межпространство сумки хранения, переносной дыры, рюкзака Хеварда или подобного другого предмета, оба уничтожаются. В месте вложения открываются односторонние врата на Астральный план: все существа в 10 фт., не защищённые полным укрытием, переносятся в случайное место этого плана. Врата затем закрываются без возможности повторного открытия.",
    "en": "No attunement. Always weighs 5 pounds. Each of two side pockets holds up to 200 pounds and 25 cubic feet; the main pocket holds up to 500 pounds and 64 cubic feet. Retrieve an item with a Utilize action or Bonus Action; the desired item rises to the top. Overloading, piercing, or tearing any pocket destroys the haversack and permanently loses its contents, except Artifacts that reappear elsewhere. Turning it inside out spills contents unharmed; restore its normal shape before use. Each pocket holds 10 minutes of air divided by the number of breathing occupants. Placing this item inside an extradimensional space of a Bag of Holding, Portable Hole, Heward’s Handy Haversack, or similar other item destroys both. A one-way Astral Plane gate opens at the insertion point, transporting every creature within 10 feet without Total Cover to a random location on that plane. The gate then closes and cannot reopen."
  }
});

ARTIFICER_REPLICAS_2024_GENERAL.push({
  "id": "portable-hole-2024",
  "edition": "2024",
  "name": {
    "ru": "Переносная дыра",
    "en": "Portable Hole"
  },
  "kind": "wondrous",
  "rarity": "rare",
  "replicationLevel": 14,
  "sourceUrl": "https://next.dnd.su/items/16020-portable-hole",
  "rules": {
    "ru": "Без настройки. Почти невесомая ткань складывается до размера платка и раскрывается в круг диаметром 6 фт. Действием Магия разложите её на твёрдой поверхности: появляется цилиндрическое межпространство глубиной 10 фт.; оно на другом плане и не создаёт сквозного прохода. Из открытой дыры можно выбраться лазанием. Действием Магия сложите края: содержимое и существа остаются внутри закрытого межпространства. Изнутри закрытой дыры действием сделайте проверку Силы (Атлетика) Сл 10; успех выводит в пределах 5 фт. от неё. Закрытая дыра содержит 1 час воздуха, делённый на число дышащих внутри. Если поместить этот предмет в межпространство сумки хранения, переносной дыры, рюкзака Хеварда или подобного другого предмета, оба уничтожаются. В месте вложения открываются односторонние врата на Астральный план: все существа в 10 фт., не защищённые полным укрытием, переносятся в случайное место этого плана. Врата затем закрываются без возможности повторного открытия.",
    "en": "No attunement. Nearly weightless cloth folds to handkerchief size or unfolds to a 6-foot circle. A Magic action spreads it on a solid surface, creating a 10-foot-deep cylindrical extradimensional space on another plane, not a passage through the surface. An occupant can climb out while open. A Magic action folds it closed, leaving occupants and contents inside. From within the closed hole, use an action and DC 10 Strength (Athletics) check; success exits within 5 feet of it. A closed hole contains 1 hour of air divided by its breathing occupants. Placing this item inside an extradimensional space of a Bag of Holding, Portable Hole, Heward’s Handy Haversack, or similar other item destroys both. A one-way Astral Plane gate opens at the insertion point, transporting every creature within 10 feet without Total Cover to a random location on that plane. The gate then closes and cannot reopen."
  }
});
