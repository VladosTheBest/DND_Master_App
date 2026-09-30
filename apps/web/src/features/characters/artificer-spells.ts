import { RULE_ITEMS } from "./rule-items";
import type { SpellOption } from "./rules-data";
/** Independently worded mechanical references; source links are attribution. */
export const ARTIFICER_SPELLS: SpellOption[] = [
  {
    "id": "booming-blade-2014",
    "name": "Громовой клинок · Booming blade",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Self (5-foot radius)",
    "duration": "1 round",
    "components": "S, M (a melee weapon worth at least 1 SP)",
    "concentration": false,
    "ritual": false,
    "source": "Tasha’s Cauldron of Everything",
    "sourceUrl": "https://dnd.su/spells/458-booming-blade/",
    "summary": "Оружием-компонентом совершите одну рукопашную атаку по существу в 5 фт.",
    "descriptionRu": "Оружием-компонентом совершите одну рукопашную атаку по существу в 5 фт. При попадании действуют обычные последствия удара, а до начала вашего следующего хода цель окружена энергией. Если она добровольно переместится на 5 фт. или больше, получает 1к8 звукового урона, и эффект заканчивается. На уровнях персонажа 5/11/17 удар наносит дополнительно 1к8/2к8/3к8 звукового урона, а перемещение — 2к8/3к8/4к8.",
    "description": "Make one melee weapon attack with the component weapon against a creature within 5 feet. A hit has its normal effects and surrounds the target with energy until the start of your next turn. If it willingly moves at least 5 feet before then, it takes 1d8 Thunder damage and the effect ends. At character levels 5/11/17, the hit deals an extra 1d8/2d8/3d8 Thunder damage and the movement damage becomes 2d8/3d8/4d8."
  },
  {
    "id": "green-flame-blade-2014",
    "name": "Клинок зелёного пламени · Green-flame blade",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Self (5-foot radius)",
    "duration": "Instantaneous",
    "components": "S, M (a melee weapon worth at least 1 SP)",
    "concentration": false,
    "ritual": false,
    "source": "Tasha’s Cauldron of Everything",
    "sourceUrl": "https://dnd.su/spells/459-green-flame-blade/",
    "summary": "Оружием-компонентом совершите одну рукопашную атаку по существу в 5 фт.",
    "descriptionRu": "Оружием-компонентом совершите одну рукопашную атаку по существу в 5 фт. При попадании действуют обычные последствия удара; по желанию пламя наносит другому видимому существу в 5 фт. от цели огненный урон, равный вашей заклинательной характеристике (модификатору). С уровней персонажа 5/11/17 добавьте 1к8/2к8/3к8 огненного урона к удару по первой цели и столько же костей к урону второй.",
    "description": "Make one melee weapon attack with the component weapon against a creature within 5 feet. A hit has its normal effects; you may also deal Fire damage equal to your spellcasting ability modifier to another visible creature within 5 feet of the first. At character levels 5/11/17, add 1d8/2d8/3d8 Fire damage to the first hit and add the same dice to the second creature’s damage."
  },
  {
    "id": "create-bonfire-2014",
    "name": "Сотворение костра · Create bonfire",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Вызов",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "60 feet",
    "duration": "1 minute",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/410-create-bonfire/",
    "summary": "Костёр в кубе 5 фт. наносит огненный урон при появлении, входе и окончании хода; спасбросок Ловкости.",
    "descriptionRu": "На видимой точке земли создайте костёр в кубе 5 фт. Существо в области при появлении огня делает спасбросок Ловкости: провал — 1к8 огненного урона, успех — без урона. Повторная проверка при первом входе за ход или окончании хода в области. Воспламеняются горючие предметы, которые никто не носит и не держит. Урон 2к8/3к8/4к8 с уровней персонажа 5/11/17.",
    "description": "Create a bonfire filling a 5-foot cube at a visible point on the ground. Creatures there when it appears make a Dexterity save, taking 1d8 Fire damage on failure and none on success. A creature also saves when entering for the first time on a turn or ending its turn there. Unworn, uncarried flammable objects ignite. Damage becomes 2d8/3d8/4d8 at character levels 5/11/17."
  },
  {
    "id": "frostbite-2014",
    "name": "Обморожение · Frostbite",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "60 feet",
    "duration": "Instantaneous",
    "components": "V, S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/396-frostbite/",
    "summary": "Провал спасброска Телосложения наносит холодный урон и даёт помеху на следующую атаку оружием.",
    "descriptionRu": "Видимое существо делает спасбросок Телосложения. При провале получает 1к6 урона холодом и помеху на следующую атаку оружием до конца своего следующего хода. При успехе эффекта нет. Урон 2к6/3к6/4к6 с уровней персонажа 5/11/17.",
    "description": "A visible creature makes a Constitution save. On failure it takes 1d6 Cold damage and has disadvantage on its next weapon attack before the end of its next turn. Success has no effect. Damage increases to 2d6/3d6/4d6 at character levels 5/11/17."
  },
  {
    "id": "lightning-lure-2014",
    "name": "Лассо молнии · Lightning lure",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Self (15-foot radius)",
    "duration": "Instantaneous",
    "components": "V",
    "concentration": false,
    "ritual": false,
    "source": "Tasha’s Cauldron of Everything",
    "sourceUrl": "https://dnd.su/spells/460-lightning-lure/",
    "summary": "Провал спасброска Силы притягивает цель до 10 фт.; электрический урон наносится только рядом с вами.",
    "descriptionRu": "Выберите видимое существо в 15 фт. При провале спасброска Силы притяните его по прямой к себе до 10 фт.; после этого оно получает 1к8 урона электричеством, только если находится в 5 фт. от вас. Урон 2к8/3к8/4к8 с уровней персонажа 5/11/17.",
    "description": "Choose a visible creature within 15 feet. On a failed Strength save, pull it up to 10 feet straight toward you; it then takes 1d8 Lightning damage only if within 5 feet of you. Damage increases to 2d8/3d8/4d8 at character levels 5/11/17."
  },
  {
    "id": "magic-stone-2014",
    "name": "Волшебный камень · Magic stone",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Преобразование",
    "classes": [
      "druid",
      "artificer",
      "warlock"
    ],
    "castingTime": "Bonus Action",
    "range": "Touch",
    "duration": "1 minute",
    "components": "V, S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/378-magic-stone/",
    "summary": "До трёх зачарованных камней позволяют вам или союзнику атаковать с вашим модификатором магии.",
    "descriptionRu": "Зачаруйте от 1 до 3 камешков. Вы или другое существо можете метнуть камень рукой на 60 фт. либо пращой, совершая дальнобойную атаку заклинанием. Используется ваш модификатор заклинательной характеристики вместо модификатора атакующего; попадание — 1к6 + ваш модификатор дробящего урона. Магия камня заканчивается после попадания или промаха. Повторное сотворение завершает эффект на прежних камнях.",
    "description": "Enchant one to three pebbles. You or another creature can make a ranged spell attack by throwing one up to 60 feet or using a sling. Use your spellcasting ability modifier instead of the attacker’s modifier. A hit deals 1d6 plus your modifier Bludgeoning damage. Whether the attack hits or misses, that pebble loses its magic. Casting again ends the effect on previously enchanted stones."
  },
  {
    "id": "sword-burst-2014",
    "name": "Вспышка мечей · Sword burst",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Вызов",
    "classes": [
      "wizard",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Self (5-foot radius)",
    "duration": "Instantaneous",
    "components": "V",
    "concentration": false,
    "ritual": false,
    "source": "Tasha’s Cauldron of Everything",
    "sourceUrl": "https://dnd.su/spells/461-sword-burst/",
    "summary": "Все остальные существа в 5 фт. получают силовой урон при провале спасброска Ловкости.",
    "descriptionRu": "Каждое другое существо в 5 фт. делает спасбросок Ловкости. Провал — 1к6 силового урона; успех — без урона. Урон 2к6/3к6/4к6 с уровней персонажа 5/11/17.",
    "description": "Each other creature within 5 feet makes a Dexterity save, taking 1d6 Force damage on failure and none on success. Damage increases to 2d6/3d6/4d6 at character levels 5/11/17."
  },
  {
    "id": "thorn-whip-2014",
    "name": "Терновый кнут · Thorn whip",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Преобразование",
    "classes": [
      "druid",
      "artificer"
    ],
    "castingTime": "Action",
    "range": "30 feet",
    "duration": "Instantaneous",
    "components": "V, S, M (a stem from a thorny plant)",
    "concentration": false,
    "ritual": false,
    "source": "Player’s Handbook",
    "sourceUrl": "https://dnd.su/spells/348-thorn-whip/",
    "summary": "Совершите рукопашную атаку заклинанием по существу в дистанции.",
    "descriptionRu": "Совершите рукопашную атаку заклинанием по существу в дистанции. Попадание наносит 1к6 колющего урона. Если цель Большая или меньше, можете притянуть её к себе до 10 фт. Урон 2к6/3к6/4к6 с уровней персонажа 5/11/17.",
    "description": "Make a melee spell attack against a creature within range. A hit deals 1d6 Piercing damage. If the target is Large or smaller, you can pull it up to 10 feet toward you. Damage increases to 2d6/3d6/4d6 at character levels 5/11/17."
  },
  {
    "id": "thunderclap-2014",
    "name": "Раскат грома · Thunderclap",
    "editions": [
      "2014"
    ],
    "level": 0,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "bard",
      "druid",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "5 feet",
    "duration": "Instantaneous",
    "components": "S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/407-thunderclap/",
    "summary": "Гром поражает других существ в 5 фт.: спасбросок Телосложения отменяет урон; звук слышен в 100 фт.",
    "descriptionRu": "Каждое другое существо в 5 фт. от вас делает спасбросок Телосложения: провал — 1к6 звукового урона, успех — без урона. Грохот слышен в 100 фт. Урон 2к6/3к6/4к6 с уровней персонажа 5/11/17.",
    "description": "Each other creature within 5 feet of you makes a Constitution save, taking 1d6 Thunder damage on failure and none on success. The noise is audible within 100 feet. Damage increases to 2d6/3d6/4d6 at character levels 5/11/17."
  },
  {
    "id": "thorn-whip-2024",
    "name": "Терновый кнут · Thorn Whip",
    "editions": [
      "2024"
    ],
    "level": 0,
    "school": "Преобразование",
    "classes": [
      "artificer",
      "druid"
    ],
    "castingTime": "Action",
    "range": "30 feet",
    "duration": "Instantaneous",
    "components": "V, S, M (a stem from a thorny plant)",
    "concentration": false,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10677-thorn-whip",
    "summary": "Совершите рукопашную атаку заклинанием по существу в дистанции.",
    "descriptionRu": "Совершите рукопашную атаку заклинанием по существу в дистанции. Попадание наносит 1к6 колющего урона. Если цель Большая или меньше, можете притянуть её к себе до 10 фт. Урон 2к6/3к6/4к6 с уровней персонажа 5/11/17.",
    "description": "Make a melee spell attack against a creature within range. A hit deals 1d6 Piercing damage. If the target is Large or smaller, you can pull it up to 10 feet toward you. Damage increases to 2d6/3d6/4d6 at character levels 5/11/17."
  },
  {
    "id": "thunderclap-2024",
    "name": "Раскат грома · Thunderclap",
    "editions": [
      "2024"
    ],
    "level": 0,
    "school": "Воплощение",
    "classes": [
      "artificer",
      "bard",
      "wizard",
      "druid",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Self (5-foot Emanation)",
    "duration": "Instantaneous",
    "components": "S",
    "concentration": false,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10678-thunderclap",
    "summary": "Эманация грома радиусом 5 фт.: спасбросок Телосложения отменяет урон; себя можно исключить.",
    "descriptionRu": "Каждое существо в Эманации 5 фт.; вы можете исключить себя. Каждая затронутая цель делает спасбросок Телосложения: провал — 1к6 звукового урона, успех — без урона. Грохот слышен в 100 фт. Урон 2к6/3к6/4к6 с уровней персонажа 5/11/17.",
    "description": "Each creature in a 5-foot Emanation originating from you; you can exclude yourself. Each affected creature makes a Constitution save, taking 1d6 Thunder damage on failure and none on success. The noise is audible within 100 feet. Damage increases to 2d6/3d6/4d6 at character levels 5/11/17."
  },
  {
    "id": "absorb-elements-2014",
    "name": "Поглощение стихий · Absorb elements",
    "editions": [
      "2014"
    ],
    "level": 1,
    "school": "Ограждение",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "ranger",
      "sorcerer"
    ],
    "castingTime": "Reaction, when you take Acid, Cold, Fire, Lightning, or Thunder damage",
    "range": "Self",
    "duration": "1 round",
    "components": "S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/401-absorb-elements/",
    "summary": "Получив кислотный, холодный, огненный, электрический или звуковой урон, реакцией получите сопротивление этому типу до начала своего следующего хода, включая вызвавший реакцию урон.",
    "descriptionRu": "Получив кислотный, холодный, огненный, электрический или звуковой урон, реакцией получите сопротивление этому типу до начала своего следующего хода, включая вызвавший реакцию урон. При первом попадании рукопашной атакой в ваш следующий ход нанесите ещё 1к6 этого типа, после чего заклинание заканчивается. Дополнительный урон +1к6 за круг ячейки выше 1.",
    "description": "When you take Acid, Cold, Fire, Lightning, or Thunder damage, your reaction grants resistance to that type until the start of your next turn, including the triggering damage. The first melee attack you hit with on your next turn deals an extra 1d6 of that type, then the spell ends. Increase that extra damage by 1d6 per slot level above first."
  },
  {
    "id": "air-bubble-2014",
    "name": "Воздушный пузырь · Air bubble",
    "editions": [
      "2014"
    ],
    "level": 2,
    "school": "Вызов",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "ranger",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "60 feet",
    "duration": "24 hours",
    "components": "S",
    "concentration": false,
    "ritual": false,
    "source": "Spelljammer: Adventures in Space",
    "sourceUrl": "https://dnd.su/spells/4760-air-bubble/",
    "summary": "Создайте вокруг головы видимого согласного существа пузырь свежего воздуха на 24 часа.",
    "descriptionRu": "Создайте вокруг головы видимого согласного существа пузырь свежего воздуха на 24 часа. При нескольких головах покрывается одна; этого достаточно против удушения, если дыхательная система общая. За каждый круг ячейки выше 2 создайте ещё два пузыря для дополнительных существ.",
    "description": "For 24 hours surround the head of a willing visible creature with a bubble of fresh air. Only one head is covered if it has several; that prevents suffocation if the heads share a respiratory system. Each slot level above second allows two additional bubbles for other creatures."
  },
  {
    "id": "arcane-vigor-2024",
    "name": "Мистическая бодрость · Arcane Vigor",
    "editions": [
      "2024"
    ],
    "level": 2,
    "school": "Ограждение",
    "classes": [
      "artificer",
      "wizard",
      "sorcerer"
    ],
    "castingTime": "Bonus Action",
    "range": "Self",
    "duration": "Instantaneous",
    "components": "V, S",
    "concentration": false,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10430-arcane-vigor",
    "summary": "Потратьте и бросьте одну или две неизрасходованные Кости хитов.",
    "descriptionRu": "Потратьте и бросьте одну или две неизрасходованные Кости хитов. Восстановите хиты, равные сумме бросков + модификатор заклинательной характеристики; модификатор Телосложения не добавляется. За каждый круг ячейки выше 2 можно потратить ещё две Кости хитов.",
    "description": "Roll and expend one or two unexpended Hit Point Dice. Regain hit points equal to their combined rolls plus your spellcasting ability modifier; do not add Constitution. Each slot level above second raises the maximum number of dice you can expend by two."
  },
  {
    "id": "catapult-2014",
    "name": "Катапульта · Catapult",
    "editions": [
      "2014"
    ],
    "level": 1,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "60 feet",
    "duration": "Instantaneous",
    "components": "S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/386-catapult/",
    "summary": "Выберите предмет весом 1–5 фунтов, который никто не носит и не держит.",
    "descriptionRu": "Выберите предмет весом 1–5 фунтов, который никто не носит и не держит. Он летит по прямой до 90 фт. в выбранном направлении, останавливаясь о твёрдую поверхность. Существо на пути делает спасбросок Ловкости; провал — столкновение и остановка, успех — предмет летит дальше. При столкновении и предмет, и поражённая цель получают 3к8 дробящего урона. За круг ячейки выше 1 предел массы +5 фунтов, урон +1к8.",
    "description": "Choose an unworn, uncarried object weighing 1–5 pounds. It flies up to 90 feet in a direction you choose, stopping at a solid surface. A creature in its path makes a Dexterity save: failure causes a collision and stops the object; success lets it continue. On collision both the object and what it strikes take 3d8 Bludgeoning damage. Each slot level above first increases the maximum weight by 5 pounds and damage by 1d8."
  },
  {
    "id": "kinetic-jaunt-2014",
    "name": "Увлекательная прогулка · Kinetic Jaunt",
    "editions": [
      "2014"
    ],
    "level": 2,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "bard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Bonus Action",
    "range": "Self",
    "duration": "1 minute",
    "components": "S",
    "concentration": true,
    "ritual": false,
    "source": "Strixhaven: A Curriculum of Chaos",
    "sourceUrl": "https://dnd.su/spells/3939-kinetic-jaunt/",
    "summary": "На время концентрации скорость ходьбы +10 фт.; ваше перемещение не провоцирует атаки.",
    "descriptionRu": "На время концентрации скорость ходьбы +10 фт.; ваше перемещение не провоцирует атаки. Можете проходить сквозь существ без дополнительной стоимости перемещения. Завершив ход в пространстве существа, перемещаетесь в последнее свободное место, которое занимали, и получаете 1к8 силового урона.",
    "description": "While concentrating, increase walking speed by 10 feet, provoke no Opportunity Attacks, and move through other creatures without treating their spaces as difficult terrain. Ending a turn in another creature’s space ejects you to the last unoccupied space you occupied and deals you 1d8 Force damage."
  },
  {
    "id": "pyrotechnics-2014",
    "name": "Пиротехника · Pyrotechnics",
    "editions": [
      "2014"
    ],
    "level": 2,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "bard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "60 feet",
    "duration": "Instantaneous",
    "components": "V, S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/400-pyrotechnics/",
    "summary": "Преобразуйте немагический огонь в ослепляющий фейерверк или сильно заслоняющую дымовую завесу.",
    "descriptionRu": "Выберите видимый немагический огонь в кубе 5 фт. Можете потушить его и создайте один эффект: фейерверк заставляет существ в 10 фт. сделать спасбросок Телосложения, провал ослепляет до конца вашего следующего хода; дым заполняет радиус 20 фт., огибает углы и сильно заслоняет область на 1 минуту либо до рассеивания сильным ветром.",
    "description": "Choose nonmagical fire within a visible 5-foot cube. You may extinguish it and create one effect. Fireworks force creatures within 10 feet to make a Constitution save or be Blinded until the end of your next turn. Smoke instead fills a 20-foot radius, spreads around corners, and heavily obscures the area for 1 minute or until dispersed by strong wind."
  },
  {
    "id": "skywrite-2014",
    "name": "Небесные письмена · Skywrite",
    "editions": [
      "2014"
    ],
    "level": 2,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "bard",
      "druid",
      "artificer"
    ],
    "castingTime": "Action",
    "range": "Sight",
    "duration": "1 hour",
    "components": "V, S",
    "concentration": true,
    "ritual": true,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/391-skywrite/",
    "summary": "До десяти облачных слов появляются в небе и сохраняются с концентрацией; сильный ветер рассеивает их.",
    "descriptionRu": "Создайте до десяти слов из облаков в видимой части неба. Они остаются неподвижны до конца заклинания. Сильный ветер рассеивает их и завершает заклинание досрочно.",
    "description": "Form up to ten words of cloud in a visible part of the sky. They remain stationary until the spell ends. Strong wind disperses them and ends the spell early."
  },
  {
    "id": "snare-2014",
    "name": "Силок · Snare",
    "editions": [
      "2014"
    ],
    "level": 1,
    "school": "Ограждение",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "ranger"
    ],
    "castingTime": "1 minute",
    "range": "Touch",
    "duration": "8 hours",
    "components": "S, M (25 feet of rope, consumed)",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/463-snare/",
    "summary": "Верёвка становится скрытой ловушкой: провал спасброска Ловкости подвешивает и опутывает вошедшее существо.",
    "descriptionRu": "Создайте на земле круг радиусом 5 фт., расходуя верёвку. Ловушку обнаруживает проверка Интеллекта (Расследование) против вашей Сл. Когда Маленькое, Среднее или Большое существо входит по земле в круг, спасбросок Ловкости: провал подвешивает его вниз головой в 3 фт. над землёй с состоянием Опутанный. Повторяйте спасбросок в конце каждого его хода. Оно или тот, кто может дотянуться, действием проверяет Интеллект (Магия) против вашей Сл; успех освобождает. После срабатывания заклинание заканчивается, как только перестаёт удерживать существо.",
    "description": "Consume the rope to form a 5-foot-radius circle on the ground. Detecting the nearly invisible trap requires an Intelligence (Investigation) check against your spell DC. A Small, Medium, or Large creature entering across the ground makes a Dexterity save; failure suspends it upside down 3 feet above the ground, Restrained. It repeats the save at the end of each turn. It or a creature able to reach it may instead take an action for an Intelligence (Arcana) check against your DC, freeing it on success. Once triggered, the spell ends when it no longer restrains a creature."
  },
  {
    "id": "tashas-caustic-brew-2014",
    "name": "Едкое варево Таши · Tasha's Caustic Brew",
    "editions": [
      "2014"
    ],
    "level": 1,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Self (30-foot line)",
    "duration": "1 minute",
    "components": "V, S, M (a bit of rotten food)",
    "concentration": true,
    "ritual": false,
    "source": "Tasha’s Cauldron of Everything",
    "sourceUrl": "https://dnd.su/spells/3047-tashas-caustic-brew/",
    "summary": "Линия кислоты покрывает цели, провалившие спасбросок Ловкости; урон повторяется, пока кислоту не очистят.",
    "descriptionRu": "Линия кислоты длиной 30 фт. и шириной 5 фт. Каждое существо в ней делает спасбросок Ловкости. Провал покрывает кислотой до конца заклинания либо пока существо действием не очистит себя или другого. Покрытая цель получает 2к4 кислотного урона в начале каждого своего хода. Урон +2к4 за круг ячейки выше 1.",
    "description": "Project a 30-foot-long, 5-foot-wide line of acid. Each creature in it makes a Dexterity save. Failure coats it until the spell ends or a creature spends an action cleaning the acid from itself or someone else. A coated creature takes 2d4 Acid damage at the start of each of its turns. Increase damage by 2d4 per slot level above first."
  },
  {
    "id": "vortex-warp-2014",
    "name": "Вихрь искривления · Vortex warp",
    "editions": [
      "2014"
    ],
    "level": 2,
    "school": "Вызов",
    "classes": [
      "wizard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "90 feet",
    "duration": "Instantaneous",
    "components": "V, S",
    "concentration": false,
    "ritual": false,
    "source": "Strixhaven: A Curriculum of Chaos",
    "sourceUrl": "https://dnd.su/spells/3947-vortex-warp/",
    "summary": "Выберите другое видимое существо: спасбросок Телосложения, который оно может добровольно провалить.",
    "descriptionRu": "Выберите другое видимое существо: спасбросок Телосложения, который оно может добровольно провалить. При провале телепортируйте его в видимое свободное место в дистанции. Оно должно находиться на поверхности или в жидкости, способной удерживать цель без протискивания. Дистанция +30 фт. за круг ячейки выше 2.",
    "description": "Choose another visible creature. It makes a Constitution save, which it may willingly fail. On failure teleport it to a visible unoccupied space within range on a surface or in a liquid capable of supporting it without squeezing. Range increases by 30 feet per slot level above second."
  },
  {
    "id": "witch-bolt-2014",
    "name": "Ведьмин снаряд · Witch bolt",
    "editions": [
      "2014"
    ],
    "level": 1,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "30 feet",
    "duration": "1 minute",
    "components": "V, S, M (a twig struck by lightning)",
    "concentration": true,
    "ritual": false,
    "source": "Player’s Handbook",
    "sourceUrl": "https://dnd.su/spells/15-witch-bolt/",
    "summary": "Дальнобойная атака заклинанием по существу: при попадании 1к12 электрического урона.",
    "descriptionRu": "Дальнобойная атака заклинанием по существу: при попадании 1к12 электрического урона. Пока действует связь, действием в каждый свой ход можете автоматически нанести ещё 1к12. Иное использование действия завершает заклинание; оно также заканчивается, если цель выходит за дистанцию или получает полное укрытие от вас. Первичный урон +1к12 за круг ячейки выше 1; повторный не усиливается.",
    "description": "Make a ranged spell attack against a creature, dealing 1d12 Lightning damage on a hit. While the link lasts, use your action on each turn to automatically deal another 1d12. Using your action for anything else ends the spell, as does the target leaving range or gaining total cover from you. Each slot level above first increases only the initial hit by 1d12; later damage does not scale."
  },
  {
    "id": "witch-bolt-2024",
    "name": "Ведьмин снаряд · Witch Bolt",
    "editions": [
      "2024"
    ],
    "level": 1,
    "school": "Воплощение",
    "classes": [
      "wizard",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "60 feet",
    "duration": "1 minute",
    "components": "V, S, M (a twig struck by lightning)",
    "concentration": true,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10704-witch-bolt",
    "summary": "Дальнобойная атака заклинанием по существу: попадание наносит 2к12 электрического урона.",
    "descriptionRu": "Дальнобойная атака заклинанием по существу: попадание наносит 2к12 электрического урона. В каждый последующий свой ход бонусным действием можете автоматически нанести цели 1к12, даже если первая атака промахнулась. Связь заканчивается при выходе цели за дистанцию либо полном укрытии от вас. Первичный урон +1к12 за круг ячейки выше 1; повторный не усиливается.",
    "description": "Make a ranged spell attack against a creature, dealing 2d12 Lightning damage on a hit. On each later turn you can use a Bonus Action to deal it 1d12 automatically, even if the initial attack missed. The link ends if the target leaves range or has total cover from you. Each slot level above first adds 1d12 to the initial damage only."
  },
  {
    "id": "ashardalons-stride-2014",
    "name": "Ашардалонова поступь · Ashardalon's Stride",
    "editions": [
      "2014"
    ],
    "level": 3,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "artificer",
      "ranger",
      "sorcerer"
    ],
    "castingTime": "Bonus Action",
    "range": "Self",
    "duration": "1 minute",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Fizban’s Treasury of Dragons",
    "sourceUrl": "https://dnd.su/spells/3813-ashardalons-stride/",
    "summary": "Скорость ходьбы +20 фт.; ваше перемещение не провоцирует атаки.",
    "descriptionRu": "Скорость ходьбы +20 фт.; ваше перемещение не провоцирует атаки. Проходя в 5 фт. от существа или никем не носимого предмета, наносите ему 1к6 огненного урона без спасброска, не чаще раза за ход для каждой цели. За круг ячейки выше 3 бонус скорости +5 фт., урон +1к6.",
    "description": "Increase walking speed by 20 feet; your movement provokes no Opportunity Attacks. Moving within 5 feet of a creature or an unworn, uncarried object deals it 1d6 Fire damage without a save, at most once per turn per target. Each slot level above third adds 5 feet to the speed bonus and 1d6 damage."
  },
  {
    "id": "catnap-2014",
    "name": "Дрёма · Catnap",
    "editions": [
      "2014"
    ],
    "level": 3,
    "school": "Очарование",
    "classes": [
      "wizard",
      "bard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "30 feet",
    "duration": "10 minutes",
    "components": "S, M (a pinch of sand)",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/472-catnap/",
    "summary": "До трёх видимых согласных существ теряют сознание на 10 минут.",
    "descriptionRu": "До трёх видимых согласных существ теряют сознание на 10 минут. Урон или действие другого существа, пробуждающего цель, заканчивает её сон досрочно. Только непрерывные 10 минут дают преимущества короткого отдыха; после этого цель не может повторно получить этот эффект до долгого отдыха. За круг ячейки выше 3 — ещё одна согласная цель.",
    "description": "Up to three willing visible creatures become Unconscious for 10 minutes. Damage or another creature using an action to wake a target ends its sleep early. Only a full uninterrupted 10 minutes grants the benefits of a short rest; after receiving that benefit the target cannot be affected again until finishing a long rest. Each slot level above third adds one willing target."
  },
  {
    "id": "catnap-2024",
    "name": "Дрёма · Catnap",
    "editions": [
      "2024"
    ],
    "level": 3,
    "school": "Очарование",
    "classes": [
      "artificer",
      "bard",
      "wizard",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "30 feet",
    "duration": "10 minutes",
    "components": "S, M (a pinch of sand)",
    "concentration": false,
    "ritual": false,
    "source": "Eberron: Forge of the Artificer",
    "sourceUrl": "https://next.dnd.su/spells/14124-catnap",
    "summary": "До трёх видимых согласных существ теряют сознание на 10 минут.",
    "descriptionRu": "До трёх видимых согласных существ теряют сознание на 10 минут. Урон или действие другого существа, пробуждающего цель, заканчивает её сон досрочно. Только непрерывные 10 минут дают преимущества короткого отдыха; после этого цель не может повторно получить этот эффект до долгого отдыха. За круг ячейки выше 3 — ещё одна согласная цель.",
    "description": "Up to three willing visible creatures become Unconscious for 10 minutes. Damage or another creature using an action to wake a target ends its sleep early. Only a full uninterrupted 10 minutes grants the benefits of a short rest; after receiving that benefit the target cannot be affected again until finishing a long rest. Each slot level above third adds one willing target."
  },
  {
    "id": "conjure-barrage-2014",
    "name": "Призыв заграждения · Conjure barrage",
    "editions": [
      "2014"
    ],
    "level": 3,
    "school": "Вызов",
    "classes": [
      "ranger"
    ],
    "castingTime": "Action",
    "range": "Self (60-foot cone)",
    "duration": "Instantaneous",
    "components": "V, S, M (a thrown weapon or one piece of ammunition)",
    "concentration": false,
    "ritual": false,
    "source": "Player’s Handbook",
    "sourceUrl": "https://dnd.su/spells/268-conjure-barrage/",
    "summary": "Метните немагическое оружие или выстрелите немагическим боеприпасом: его копии образуют конус 60 фт.",
    "descriptionRu": "Метните немагическое оружие или выстрелите немагическим боеприпасом: его копии образуют конус 60 фт. Все существа в конусе делают спасбросок Ловкости, получая 3к8 урона типа исходного оружия/боеприпаса при провале либо половину при успехе. Копии исчезают. Ячейка большего круга не усиливает урон.",
    "description": "Throw a nonmagical weapon or fire nonmagical ammunition, producing duplicates in a 60-foot cone. Every creature in it makes a Dexterity save, taking 3d8 damage of the original weapon or ammunition’s type on failure, or half on success. The duplicates vanish. Higher-level slots do not increase damage."
  },
  {
    "id": "conjure-barrage-2024",
    "name": "Призыв шквала снарядов · Conjure Barrage",
    "editions": [
      "2024"
    ],
    "level": 3,
    "school": "Вызов",
    "classes": [
      "ranger"
    ],
    "castingTime": "Action",
    "range": "Self (60-foot cone)",
    "duration": "Instantaneous",
    "components": "V, S, M (a melee or ranged weapon worth at least 1 CP)",
    "concentration": false,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10205-conjure-barrage",
    "summary": "Взмахните оружием-компонентом: его копии или подходящие боеприпасы образуют конус 60 фт.",
    "descriptionRu": "Взмахните оружием-компонентом: его копии или подходящие боеприпасы образуют конус 60 фт. Выберите видимых существ в конусе. Каждое делает спасбросок Ловкости: провал — 5к8 силового урона, успех — половина. Копии исчезают. Урон +1к8 за круг ячейки выше 3.",
    "description": "Brandish the component weapon to form duplicates or suitable ammunition in a 60-foot cone. Choose visible creatures in that cone. Each makes a Dexterity save, taking 5d8 Force damage on failure or half on success. The duplicates vanish. Add 1d8 damage per slot level above third."
  },
  {
    "id": "elemental-weapon-2024",
    "name": "Стихийное оружие · Elemental Weapon",
    "editions": [
      "2024"
    ],
    "level": 3,
    "school": "Преобразование",
    "classes": [
      "artificer",
      "druid",
      "paladin",
      "ranger"
    ],
    "castingTime": "Action",
    "range": "Touch",
    "duration": "1 hour",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10280-elemental-weapon",
    "summary": "Немагическое оружие получает бонус к атакам и дополнительный стихийный урон; усиление зависит от ячейки.",
    "descriptionRu": "Касанием сделайте немагическое оружие магическим. Выберите кислоту, холод, огонь, электричество или звук: оружие получает +1 к атакам и дополнительно 1к4 выбранного урона при попадании. Ячейка 5–6 круга даёт +2 и 2к4; ячейка 7+ — +3 и 3к4. Бонус к атаке не является дополнительным бонусом к обычному урону.",
    "description": "Touch a nonmagical weapon to make it magical. Choose Acid, Cold, Fire, Lightning, or Thunder. It gains +1 to attack rolls and an extra 1d4 of the chosen damage on a hit. A fifth- or sixth-level slot gives +2 and 2d4; a slot of seventh level or higher gives +3 and 3d4. The attack bonus is not a bonus to the weapon’s normal damage."
  },
  {
    "id": "flame-arrows-2014",
    "name": "Пылающие стрелы · Flame arrows",
    "editions": [
      "2014"
    ],
    "level": 3,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "ranger",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Touch",
    "duration": "1 hour",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/405-flame-arrows/",
    "summary": "Боеприпасы из выбранного колчана наносят дополнительный огненный урон; число боеприпасов ограничено.",
    "descriptionRu": "Коснитесь колчана со стрелами или болтами. Попадание дальнобойной атакой оружием с извлечённым боеприпасом наносит ещё 1к6 огненного урона. После попадания или промаха магия этого боеприпаса заканчивается. Заклинание заканчивается после извлечения 12 боеприпасов; за круг ячейки выше 3 предел увеличивается на 2.",
    "description": "Touch a quiver containing arrows or bolts. A ranged weapon hit with ammunition drawn from it deals an extra 1d6 Fire damage. Whether the attack hits or misses, that piece loses its magic. The spell ends after 12 pieces are drawn; each slot level above third increases that limit by two."
  },
  {
    "id": "intellect-fortress-2014",
    "name": "Крепость интеллекта · Intellect Fortress",
    "editions": [
      "2014"
    ],
    "level": 3,
    "school": "Ограждение",
    "classes": [
      "wizard",
      "bard",
      "artificer",
      "warlock",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "30 feet",
    "duration": "1 hour",
    "components": "V",
    "concentration": true,
    "ritual": false,
    "source": "Tasha’s Cauldron of Everything",
    "sourceUrl": "https://dnd.su/spells/3049-intellect-fortress/",
    "summary": "Вы или одно видимое согласное существо получаете сопротивление психическому урону и преимущество на спасброски Интеллекта, Мудрости и Харизмы.",
    "descriptionRu": "Вы или одно видимое согласное существо получаете сопротивление психическому урону и преимущество на спасброски Интеллекта, Мудрости и Харизмы. За круг ячейки выше 3 добавьте одну цель; при сотворении все цели должны быть в 30 фт. друг от друга.",
    "description": "You or one willing visible creature gains resistance to Psychic damage and advantage on Intelligence, Wisdom, and Charisma saving throws. Each slot level above third adds one target; all targets must be within 30 feet of each other when the spell is cast."
  },
  {
    "id": "circle-of-power-2024",
    "name": "Круг силы · Circle of Power",
    "editions": [
      "2024"
    ],
    "level": 5,
    "school": "Ограждение",
    "classes": [
      "artificer",
      "wizard",
      "cleric",
      "paladin"
    ],
    "castingTime": "Action",
    "range": "Self (30-foot Emanation)",
    "duration": "10 minutes",
    "components": "V",
    "concentration": true,
    "ritual": false,
    "source": "Player’s Handbook (2024)",
    "sourceUrl": "https://next.dnd.su/spells/10460-circle-of-power",
    "summary": "Аура даёт союзникам преимущество на спасброски от магии и отменяет урон при успешном спасброске на половину.",
    "descriptionRu": "Аура движется с вами. Вы и союзники в ней получаете преимущество на спасброски от заклинаний и иных магических эффектов. Если такой эффект при успешном спасброске наносит половину урона, успешный спасбросок вместо этого позволяет избежать всего урона.",
    "description": "The aura moves with you. You and allies in it have advantage on saving throws against spells and other magical effects. If such an effect normally deals half damage on a successful save, success instead prevents all its damage."
  },
  {
    "id": "distorted-distance-2024",
    "name": "Искривление расстояния · Distorted Distance",
    "editions": [
      "2024"
    ],
    "level": 4,
    "school": "Иллюзия",
    "classes": [
      "artificer",
      "bard",
      "wizard",
      "warlock"
    ],
    "castingTime": "Action",
    "range": "120 feet",
    "duration": "10 minutes",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Arcana Unleashed",
    "sourceUrl": "https://next.dnd.su/spells/15017-distorted-distance",
    "summary": "Иллюзорная сфера ускоряет выбранные цели либо наносит психический урон и затрудняет их перемещение.",
    "descriptionRu": "Создайте сферу радиусом 60 фт. в точке дистанции. Для каждого видимого в ней существа можете выбрать эффект: спасбросок Интеллекта, при провале 2к10 психического урона и сфера — трудная местность для цели до конца её хода; либо +20 фт. Скорости до конца её следующего хода. При входе существа в сферу или окончании его хода в ней можете применить к нему один из эффектов. Не чаще раза за ход для каждого существа.",
    "description": "Create a 60-foot-radius sphere centered within range. For each visible creature in it you may choose an effect: an Intelligence save, with failure dealing 2d10 Psychic damage and making the sphere difficult terrain for it until the end of its turn; or +20 feet to its Speed until the end of its next turn. Whenever a creature enters the sphere or ends its turn there, you may apply one effect. A creature can be affected at most once per turn."
  },
  {
    "id": "dueling-ground-2024",
    "name": "Дуэльная площадка · Dueling Ground",
    "editions": [
      "2024"
    ],
    "level": 2,
    "school": "Ограждение",
    "classes": [
      "artificer",
      "bard",
      "wizard",
      "druid",
      "cleric",
      "warlock",
      "paladin",
      "ranger",
      "sorcerer"
    ],
    "castingTime": "10 minutes",
    "range": "Touch",
    "duration": "1 hour",
    "components": "V, S, M (a silk flag worth at least 100 GP)",
    "concentration": false,
    "ritual": true,
    "source": "Arcana Unleashed",
    "sourceUrl": "https://next.dnd.su/spells/15018-dueling-ground",
    "summary": "Касанием земли создайте площадку-сферу радиусом 15 фт.; выберите двух согласных существ внутри.",
    "descriptionRu": "Касанием земли создайте площадку-сферу радиусом 15 фт.; выберите двух согласных существ внутри. Вход любого другого существа завершает заклинание. Если цель на площадке падает до 0 хитов, она стабилизируется и телепортируется в ближайшее свободное место снаружи. Эффект, мгновенно убивающий без урона, вместо смерти опускает цель до 0, делает бессознательной, стабилизирует и переносит наружу. Когда внутри остаётся одна цель, над ней появляется венец рун. За круг ячейки выше 2 — ещё одна согласная цель.",
    "description": "Touch the ground to create a dueling area in a 15-foot-radius sphere and choose two willing creatures inside it. Another creature entering ends the spell. A target reduced to 0 hit points while inside is stabilized and teleported to the nearest unoccupied space outside. An effect that would kill it instantly without damage instead reduces it to 0 hit points, renders it Unconscious, stabilizes it, and teleports it outside. When one target remains inside, matching runes crown it. Each slot level above second adds one willing target."
  },
  {
    "id": "elemental-bane-2014",
    "name": "Проклятие стихии · Elemental Bane",
    "editions": [
      "2014"
    ],
    "level": 4,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "druid",
      "artificer",
      "warlock"
    ],
    "castingTime": "Action",
    "range": "90 feet",
    "duration": "1 minute",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/404-elemental-bane/",
    "summary": "Выберите видимое существо и тип урона: кислота, холод, огонь, электричество или звук.",
    "descriptionRu": "Выберите видимое существо и тип урона: кислота, холод, огонь, электричество или звук. Спасбросок Телосложения: при провале цель теряет сопротивление этому типу до конца заклинания; первый раз за каждый ход, когда получает такой урон, получает ещё 2к6 того же типа. Иммунитет не отменяется. За круг ячейки выше 4 — ещё одна цель; цели должны быть в 30 фт. друг от друга.",
    "description": "Choose a visible creature and Acid, Cold, Fire, Lightning, or Thunder. On a failed Constitution save it loses resistance to that type for the spell’s duration and takes an extra 2d6 of that type the first time it takes such damage on each turn. Immunity is not removed. Each slot level above fourth adds one target; targets must be within 30 feet of each other."
  },
  {
    "id": "skill-empowerment-2014",
    "name": "Усиление навыка · Skill empowerment",
    "editions": [
      "2014"
    ],
    "level": 5,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "bard",
      "artificer",
      "sorcerer"
    ],
    "castingTime": "Action",
    "range": "Touch",
    "duration": "1 hour",
    "components": "V, S",
    "concentration": true,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/494-skill-empowerment/",
    "summary": "Коснитесь согласного существа и выберите навык, которым оно владеет и для которого ещё не удваивает мастерство.",
    "descriptionRu": "Коснитесь согласного существа и выберите навык, которым оно владеет и для которого ещё не удваивает мастерство. На время заклинания удваивайте его бонус мастерства в проверках этого навыка. Эффект не складывается с Компетентностью и аналогичными удвоениями.",
    "description": "Touch a willing creature and choose a skill in which it is proficient and does not already double proficiency. For the duration, double its proficiency bonus on checks using that skill. This does not stack with Expertise or similar doubling effects."
  },
  {
    "id": "spirit-lantern-2024",
    "name": "Фонарь духов · Spirit Lantern",
    "editions": [
      "2024"
    ],
    "level": 5,
    "school": "Некромантия",
    "classes": [
      "artificer",
      "wizard",
      "cleric",
      "warlock"
    ],
    "castingTime": "Action",
    "range": "Self",
    "duration": "10 minutes",
    "components": "V, S, M (a black lantern)",
    "concentration": false,
    "ritual": false,
    "source": "Arcana Unleashed",
    "sourceUrl": "https://next.dnd.su/spells/15030-spirit-lantern",
    "summary": "Фонарь собирает частицы душ погибших врагов для некротических атак, исцеления нежити или защиты союзника.",
    "descriptionRu": "Над вами парит фонарь, излучающий тусклый свет на 60 фт. Умерший в его свете враг оставляет частицу души; вместимость — ваш модификатор заклинательной характеристики. Неиспользованные частицы исчезают с заклинанием. Бонусным действием потратьте частицу и выберите видимую цель в 60 фт.: существо делает спасбросок Телосложения против 4к8 + ваш модификатор некротического урона, успех — половина; либо нежить восстанавливает 4к8 + ваш модификатор хитов; либо атаки других существ по выбранному существу получают помеху до начала вашего следующего хода.",
    "description": "A hovering lantern above you sheds Dim Light for 60 feet. An enemy dying in that light leaves a soul fragment; capacity equals your spellcasting ability modifier. Unused fragments vanish when the spell ends. As a Bonus Action expend one and choose a visible target within 60 feet: a creature makes a Constitution save against 4d8 plus your modifier Necrotic damage, taking half on success; an Undead instead regains 4d8 plus your modifier hit points; or attacks by other creatures against the chosen creature have disadvantage until the start of your next turn."
  },
  {
    "id": "uncertain-footing-2024",
    "name": "Мнимые препоны · Uncertain Footing",
    "editions": [
      "2024"
    ],
    "level": 2,
    "school": "Иллюзия",
    "classes": [
      "artificer",
      "bard",
      "wizard",
      "warlock"
    ],
    "castingTime": "Action",
    "range": "120 feet",
    "duration": "1 minute",
    "components": "V, S, M (a distorting lens)",
    "concentration": true,
    "ritual": false,
    "source": "Arcana Unleashed",
    "sourceUrl": "https://next.dnd.su/spells/15032-uncertain-footing",
    "summary": "Иллюзорные препятствия замедляют до трёх существ и запрещают Рывок; спасброски Интеллекта завершают эффект.",
    "descriptionRu": "До трёх видимых существ делают спасброски Интеллекта. При провале иллюзорные препятствия уменьшают Скорость вдвое и запрещают действие Рывок. В конце каждого своего хода цель повторяет спасбросок, завершая эффект на себе при успехе.",
    "description": "Up to three visible creatures make Intelligence saves. On failure, illusory obstacles halve their Speed and prevent the Dash action. Each repeats the save at the end of its turns, ending its own effect on success."
  },
  {
    "id": "transmute-rock-2014",
    "name": "Преобразование камня · Transmute rock",
    "editions": [
      "2014"
    ],
    "level": 5,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "druid",
      "artificer"
    ],
    "castingTime": "Action",
    "range": "120 feet",
    "duration": "Until dispelled",
    "components": "V, S, M (clay and water)",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/402-transmute-rock/",
    "summary": "Превратите камень в вязкую грязь или грязь в камень; область может опутывать существ либо обрушиваться.",
    "descriptionRu": "Выберите видимый куб 40 фт. камня или грязи. Камень в грязь: немагический камень становится вязкой грязью; каждый фут перемещения стоит 4 фт. Существо в ней при сотворении, первом входе за ход или окончании хода делает спасбросок Силы; провал погружает и опутывает, освобождение — действием. Если меняется потолок, грязь обваливается: существа внизу делают спасброски Ловкости против 4к8 дробящего урона, успех — половина. Грязь в камень: немагические грязь/зыбучий песок глубиной до 10 фт. застывают. Существо внутри делает спасбросок Ловкости: успех переносит в ближайшее свободное место, провал опутывает. Оно или существо в пределах досягаемости может действием разломать камень проверкой Силы Сл 20 либо разрушить его уроном: КД 15, 25 хитов, иммунитет к яду и психическому урону. Изменённый материал сохраняется до рассеивания заклинания.",
    "description": "Choose a visible 40-foot cube of rock or mud. Rock to mud: nonmagical rock becomes thick mud, with each foot of movement costing 4 feet. A creature there when cast, entering for the first time on a turn, or ending its turn there makes a Strength save; failure sinks and Restrains it, but it can use an action to free itself. If cast on a ceiling, falling mud forces creatures below to make Dexterity saves against 4d8 Bludgeoning damage, half on success. Mud to rock: nonmagical mud or quicksand up to 10 feet deep hardens. Creatures inside make Dexterity saves: success moves them to the nearest unoccupied space, failure Restrains them. A trapped creature or another within reach can take an action for a DC 20 Strength check to break the rock, or destroy it with damage: AC 15, 25 HP, immune to Poison and Psychic damage. The material remains transformed until dispelled."
  },
  {
    "id": "tiny-servant-2014",
    "name": "Крошечный слуга · Tiny servant",
    "editions": [
      "2014"
    ],
    "level": 3,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "artificer"
    ],
    "castingTime": "1 minute",
    "range": "Touch",
    "duration": "8 hours",
    "components": "V, S",
    "concentration": false,
    "ritual": false,
    "source": "Xanathar’s Guide to Everything",
    "sourceUrl": "https://dnd.su/spells/474-tiny-servant/",
    "summary": "Коснитесь Крошечного немагического предмета, не прикреплённого к поверхности или другому предмету и не переносимого другим существом.",
    "descriptionRu": "Коснитесь Крошечного немагического предмета, не прикреплённого к поверхности или другому предмету и не переносимого другим существом. Он становится Крошечным слугой из встроенного блока на 8 часов либо до 0 хитов. Бонусным действием мысленно прикажите слугам в 120 фт., задав действие/движение на следующий ход либо общую задачу. Одним приказом можно управлять несколькими, давая всем одинаковую команду. Без приказа лишь защищается; полученную задачу продолжает до выполнения. При 0 хитов становится прежним предметом, и остаток урона переносится на него. За круг ячейки выше 3 оживите ещё два предмета.",
    "description": "Touch a Tiny nonmagical object that is neither attached to another object or surface nor carried by another creature. It becomes the included Tiny Servant for 8 hours or until reduced to 0 HP. As a Bonus Action, mentally command servants within 120 feet, specifying their next action and movement or a general task. One command can direct several servants, but gives them the same instructions. Without orders they only defend themselves; an assigned task continues until completed. At 0 HP it becomes its original object and excess damage carries over. Each slot level above third animates two additional objects.",
    "creatureReferenceIds": [
      "tiny-servant-2014"
    ]
  },
  {
    "id": "homunculus-servant-2024",
    "name": "Гомункул-слуга · Homunculus Servant",
    "editions": [
      "2024"
    ],
    "level": 2,
    "school": "Вызов",
    "classes": [
      "artificer"
    ],
    "castingTime": "1 hour",
    "range": "10 feet",
    "duration": "Instantaneous",
    "components": "V, S, M (a gem worth at least 100 GP)",
    "concentration": false,
    "ritual": true,
    "source": "Eberron: Forge of the Artificer",
    "sourceUrl": "https://next.dnd.su/spells/12581-homunculus-servant",
    "summary": "Призовите гомункула в свободном месте дистанции; прежний гомункул этого заклинания заменяется новым.",
    "descriptionRu": "Призовите гомункула в свободном месте дистанции; прежний гомункул этого заклинания заменяется новым. Внешность выбираете вы, она не меняет встроенный блок. Гомункул союзник вам и союзникам, имеет вашу инициативу и ходит сразу после вас. Словесные приказы не требуют действия. Без приказа Уклоняется и перемещается прочь от опасности. Во всех формулах блока используйте круг потраченной ячейки; ритуал использует базовый 2 круг.",
    "description": "Summon a homunculus into an unoccupied space within range, replacing any previous homunculus you summoned with this spell. Choose its appearance without changing the included statistics. It is allied with you and your allies, shares your Initiative, and acts immediately after you. Verbal commands cost no action. Without orders it Dodges and moves away from danger. Use the expended slot level in its formulas; a ritual uses the base second level.",
    "creatureReferenceIds": [
      "homunculus-servant-2024"
    ]
  },
  {
    "id": "creating-spelljamming-helm-2014",
    "name": "Сотворение магического руля · Creating spelljamming helm",
    "editions": [
      "2014"
    ],
    "level": 5,
    "school": "Преобразование",
    "classes": [
      "wizard",
      "artificer"
    ],
    "castingTime": "Action",
    "range": "Touch",
    "duration": "Instantaneous",
    "components": "V, S, M (a crystal rod worth at least 5000 GP, consumed)",
    "concentration": false,
    "ritual": false,
    "source": "Spelljammer: Adventures in Space",
    "sourceUrl": "https://dnd.su/spells/4761-creating-spelljamming-helm/",
    "summary": "Коснитесь незанятого сиденья Большого размера или меньше, держа жезл-компонент: жезл расходуется, сиденье становится магическим рулём.",
    "descriptionRu": "Коснитесь незанятого сиденья Большого размера или меньше, держа жезл-компонент: жезл расходуется, сиденье становится магическим рулём. Это редкий чудесный предмет с настройкой заклинателем. Настроенный сидящий пилот поддерживает концентрацию как на заклинании: может перемещать корабль массой хотя бы 1 тонна в космосе, воздухе или воде с его скоростью, поворачивать его и видеть/слышать происходящее на корабле и вокруг, словно находится в выбранном месте на борту. Для воды или подводного движения корабль должен быть предназначен для такой среды. В космосе, если в 1 миле нет иных объектов массой хотя бы 1 тонна, скорость позволяет пройти 100 миллионов миль за 24 часа. Действием пилот касается согласного заклинателя: тот немедленно настраивается, прежняя настройка прекращается.",
    "description": "While holding the component rod, touch an unoccupied seat no larger than Large. The rod is consumed and the seat becomes a spelljamming helm: a rare wondrous item requiring attunement by a spellcaster. An attuned seated pilot maintains concentration as on a spell to move a ship weighing at least 1 ton through space, air, or water at its speed, steer it, and see or hear on and around it as if at a chosen location aboard. Water or underwater travel requires a ship designed for that environment. In space, if no other object weighing at least 1 ton is within 1 mile, the helm allows travel of 100 million miles per 24 hours. As an action the pilot can touch a willing spellcaster, immediately transferring attunement and ending their own."
  },
{
  "id": "tashas-bubbling-cauldron-2024",
  "name": "Бурлящий котёл Таши · Tasha’s Bubbling Cauldron",
  "editions": [
    "2024"
  ],
  "level": 6,
  "school": "Вызов",
  "classes": [
    "wizard",
    "warlock"
  ],
  "castingTime": "Action",
  "range": "5 feet",
  "duration": "10 minutes",
  "components": "V, S, M (a gilded ladle worth at least 500 GP)",
  "concentration": false,
  "ritual": false,
  "source": "Player’s Handbook 2024",
  "sourceUrl": "https://next.dnd.su/spells/10669-tashas-bubbling-cauldron",
  "summary": "Создайте неподвижный котёл с выбранным обычным или необычным зельем; число порций равно модификатору заклинательной характеристики, минимум 1.",
  "descriptionRu": "В свободном месте на земле в пределах 5 фт. появляется неподвижный котёл. Его жидкость имеет свойства одного выбранного вами обычного или необычного зелья. Вы или союзник можете бонусным действием дотянуться до котла и извлечь порцию во флаконе; флакон исчезает после выпивания. Всего можно извлечь число порций, равное модификатору вашей заклинательной характеристики (минимум 1). Извлечение последней порции немедленно завершает заклинание. При завершении котёл и оставшаяся внутри жидкость исчезают. Уже извлечённые невыпитые зелья сохраняются после завершения, но исчезают, когда вы снова сотворяете это заклинание.",
  "description": "An immovable cauldron appears in an unoccupied space on the ground within 5 feet. Its liquid has the properties of one Common or Uncommon potion you choose. You or an ally can use a Bonus Action to reach into the cauldron and withdraw one dose in a vial; the vial disappears when the potion is consumed. The maximum number of doses equals your spellcasting ability modifier, minimum 1. Withdrawing the final dose immediately ends the spell. When the spell ends, the cauldron and any liquid still inside disappear. Withdrawn, unconsumed potions survive the spell ending but disappear when you cast this spell again.",
"itemReferenceIds": RULE_ITEMS.filter(item => item.edition === "2024" && item.kind === "potion" && ["common", "uncommon"].includes(item.rarity)).map(item => item.id)
}
];

ARTIFICER_SPELLS.push({
 id:"aura-of-purity-2024",name:"Аура очищения · Aura of Purity",editions:["2024"],level:4,school:"Ограждение",classes:["cleric","paladin"],castingTime:"Action",range:"Self",duration:"Concentration, up to 10 minutes",components:"V",concentration:true,ritual:false,source:"Player’s Handbook 2024",sourceUrl:"https://next.dnd.su/spells/10436-aura-of-purity/",
 summary:"Вы и союзники в эманации 30 фт. получаете сопротивление яду и преимущество на спасброски против семи перечисленных состояний.",
 descriptionRu:"До конца заклинания от вас исходит эманация 30 фт. Пока вы или союзник внутри неё, действуют сопротивление урону ядом и преимущество на спасброски для избегания или окончания эффектов, накладывающих Испуганный, Оглохший, Ослеплённый, Отравленный, Очарованный, Ошеломлённый или Парализованный.",
 description:"For the duration, a 30-foot Emanation surrounds you. You and allies inside it have Resistance to Poison damage and Advantage on saving throws to avoid or end effects imposing Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned.",
});
