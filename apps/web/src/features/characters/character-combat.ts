import { equipmentDisplayName } from "./starting-equipment";
import {
  deriveCharacter,
  type CharacterDraft,
  type DerivedCharacter,
  type Ability,
} from "./rules";
import {
  combatEquipmentCatalog,
  resolveCombatEquipment,
  type CombatEquipment,
} from "./combat-equipment";
export interface CombatAttack {
  name: string;
  hit: string;
  damage: string;
  details: string;
  source: "weapon" | "spell" | "natural";
}
export interface CombatResource {
  name: string;
  maximum: number | null;
  manual?: boolean;
  recovery: string;
  details: string;
}
export interface CombatSheet {
  armorClass: number;
  armorLabel: string;
  speed: number;
  attacks: CombatAttack[];
  resources: CombatResource[];
  effects: { name: string; text: string }[];
  warnings: string[];
  attacksPerAction: number;
}
const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
const formula = (dice: string, bonus: number) =>
  bonus ? `${dice} ${sign(bonus)}` : dice;
export function characterChoices(d: CharacterDraft, key: string) {
  return d.levels
    .filter((l) => l.level <= d.targetLevel)
    .flatMap((l) => l.featureChoices?.[key] ?? []);
}
function weaponProficiency(
  d: CharacterDraft,
  c: DerivedCharacter,
  w: CombatEquipment,
) {
  const id = d.classId,
    sub = c.subclass?.id,
    modern = d.edition === "2024";
  if (["barbarian", "fighter", "paladin", "ranger"].includes(id)) return true;
  if (
    (id === "bard" && sub === "valor") ||
    (id === "warlock" && sub === "hexblade") ||
    (id === "artificer" && sub === "battle-smith")
  )
    return true;
  if (
    (id === "cleric" &&
      characterChoices(d, "divine-order").includes("protector")) ||
    (id === "druid" && characterChoices(d, "primal-order").includes("warden"))
  )
    return true;
  if (modern)
    return (
      w.category === "simple" ||
      (id === "monk" && !!w.light) ||
      (id === "rogue" && (!!w.light || !!w.finesse))
    );
  if (["sorcerer", "wizard"].includes(id))
    return [
      "dagger",
      "dart",
      "sling",
      "quarterstaff",
      "light-crossbow",
    ].includes(w.id);
  if (id === "druid")
    return [
      "club",
      "dagger",
      "dart",
      "javelin",
      "mace",
      "quarterstaff",
      "scimitar",
      "sickle",
      "sling",
      "spear",
    ].includes(w.id);
  return (
    w.category === "simple" ||
    (["bard", "rogue"].includes(id) &&
      ["hand-crossbow", "longsword", "rapier", "shortsword"].includes(w.id)) ||
    (id === "monk" && w.id === "shortsword") ||
    (id === "bard" && sub === "swords" && w.id === "scimitar")
  );
}
const cantripDamage: Record<
  string,
  [
    number,
    string,
    "attack" | "str" | "dex" | "con" | "int" | "wis" | "cha",
    string,
  ]
> = {
  "fire-bolt": [10, "огонь", "attack", "120 фт."],
  "ray-of-frost": [
    8,
    "холод",
    "attack",
    "60 фт.; скорость цели −10 фт. до вашего следующего хода",
  ],
  "shocking-grasp": [8, "электричество", "attack", "касание"],
  "chill-touch": [8, "некротический", "attack", "120 фт."],
  "eldritch-blast": [
    10,
    "силовой",
    "attack",
    "120 фт.; отдельный бросок атаки на каждый луч",
  ],
  "acid-splash": [6, "кислота", "dex", "60 фт."],
  "poison-spray": [12, "яд", "con", "10 фт."],
  "sacred-flame": [
    8,
    "излучение",
    "dex",
    "60 фт.; укрытие не помогает спасброску",
  ],
  "vicious-mockery": [4, "психический", "wis", "60 фт."],
  "produce-flame": [8, "огонь", "attack", "30 фт."],
  "thorn-whip": [
    6,
    "колющий",
    "attack",
    "30 фт.; рукопашная атака заклинанием",
  ],
  thunderclap: [6, "звук", "con", "5 фт."],
  frostbite: [6, "холод", "con", "60 фт."],
  "word-of-radiance": [6, "излучение", "con", "5 фт."],
  "toll-the-dead": [
    8,
    "некротический",
    "wis",
    "60 фт.; d12 вместо d8, если цель потеряла хиты",
  ],
  "mind-sliver": [
    6,
    "психический",
    "int",
    "60 фт.; −1d4 к следующему спасброску цели до конца вашего следующего хода",
  ],
};
const saveNames: Record<string, string> = {
  str: "Сила",
  dex: "Ловкость",
  con: "Телосложение",
  int: "Интеллект",
  wis: "Мудрость",
  cha: "Харизма",
};
export function deriveCombatSheet(
  d: CharacterDraft,
  c = deriveCharacter(d),
): CombatSheet {
  const n = c.level,
    modern = d.edition === "2024",
    m = c.modifiers,
    pb = c.proficiencyBonus,
    cls = d.classId,
    sub = c.subclass?.id;
  const result: CombatSheet = {
    armorClass: c.armorClass,
    armorLabel: "Без доспеха",
    speed: c.speed,
    attacks: [],
    resources: [],
    effects: [],
    warnings: [],
    attacksPerAction: 1,
  };
  const inv = (d.equipment || []).map((item) => ({
    item,
    rule: resolveCombatEquipment(item, d.edition),
  }));
  const worn = inv.filter((v) => v.item.equipped && v.rule?.kind === "armor"),
    shields = inv.filter((v) => v.item.equipped && v.rule?.kind === "shield");
  const armor = worn.length === 1 ? worn[0] : undefined,
    shield = shields.length === 1 ? shields[0] : undefined;
  if (worn.length > 1 || shields.length > 1)
    result.warnings.push(
      "Отмечено несколько доспехов или щитов. Выберите один доспех и один щит; их КД не складывается.",
    );
  const martialArts = cls === "monk" && !armor && !shield;
  if (armor) {
    result.armorClass =
      armor.rule!.ac! +
      (armor.rule!.category === "heavy"
        ? 0
        : armor.rule!.category === "medium"
          ? Math.min(2, m.dex)
          : m.dex) +
      (armor.item.magicBonus || 0);
    result.armorLabel = equipmentDisplayName(armor.item.name);
  } else if (
    shield &&
    (cls === "monk" || (modern && cls === "bard" && sub === "dance"))
  )
    result.armorClass = 10 + m.dex;
  const shieldTrained =
    shield?.item.proficient ??
    ([
      "barbarian",
      "cleric",
      "druid",
      "fighter",
      "paladin",
      "ranger",
      "artificer",
    ].includes(cls) ||
      (cls === "bard" && sub === "valor") ||
      (cls === "warlock" && sub === "hexblade"));
  if (shield && (!modern || shieldTrained)) {
    result.armorClass += 2 + (shield.item.magicBonus || 0);
    result.armorLabel += " + щит";
  }
  if (shield && !shieldTrained)
    result.warnings.push(
      modern
        ? "Нет владения щитом: бонус КД не учтён."
        : "Щит без владения: помеха проверкам, спасброскам и атакам Силой/Ловкостью; нельзя колдовать.",
    );
  const styles = d.levels
    .filter((l) => l.level <= n)
    .flatMap((l) =>
      Object.entries(l.featureChoices || {})
        .filter(([k]) => /style/.test(k))
        .flatMap(([, v]) => v),
    );
  if (armor && styles.includes("defense")) result.armorClass++;
  if (armor) {
    const light =
      [
        "barbarian",
        "bard",
        "cleric",
        "druid",
        "fighter",
        "paladin",
        "ranger",
        "rogue",
        "warlock",
        "artificer",
      ].includes(cls) ||
      (cls === "wizard" && sub === "bladesinging");
    const medium =
      [
        "barbarian",
        "cleric",
        "fighter",
        "paladin",
        "ranger",
        "artificer",
      ].includes(cls) ||
      (cls === "druid" &&
        (!modern || characterChoices(d, "primal-order").includes("warden"))) ||
      (cls === "bard" && ["valor", "swords"].includes(sub || "")) ||
      (cls === "warlock" && sub === "hexblade");
    const heavy =
      ["fighter", "paladin"].includes(cls) ||
      (cls === "artificer" && sub === "armorer") ||
      (cls === "cleric" &&
        (modern
          ? characterChoices(d, "divine-order").includes("protector")
          : [
              "life",
              "nature",
              "tempest",
              "war",
              "forge",
              "order",
              "twilight",
            ].includes(sub || "")));
    const trained =
      armor.item.proficient ??
      (armor.rule!.category === "heavy"
        ? heavy
        : armor.rule!.category === "medium"
          ? medium
          : light);
    if (!trained)
      result.warnings.push(
        "Доспех без владения: помеха проверкам, спасброскам и атакам Силой/Ловкостью; нельзя накладывать заклинания. Если владение дано другой способностью, отметьте его у предмета.",
      );
  }
  if (armor?.rule?.stealth)
    result.effects.push({
      name: "Доспех",
      text: "Помеха проверкам Скрытности.",
    });
  if (
    armor?.rule?.strength &&
    c.abilities.str < armor.rule.strength &&
    !(d.edition === "2014" && /dwarf/.test(d.speciesId))
  )
    result.speed -= 10;
  if (armor?.rule?.category === "heavy" && cls === "barbarian" && n >= 5)
    result.speed -= 10;
  if ((armor || shield) && cls === "monk" && n >= 2)
    result.speed -= 10 + Math.floor((n - 2) / 4) * 5;
  if (armor?.rule?.category === "heavy" && modern && cls === "ranger" && n >= 6)
    result.speed -= 10;
  for (const { item, rule } of inv)
    if (!rule && (item.type === "weapon" || item.equipped))
      result.warnings.push(
        `«${item.name}»: выберите базовый предмет, чтобы рассчитать атаку или КД.`,
      );
  if (!worn.length && inv.some((v) => v.rule?.kind === "armor"))
    result.warnings.push(
      "В инвентаре есть доспех, но он не отмечен как надетый. Показана КД без доспеха.",
    );
  const knownWeapons = inv.filter((v) => v.rule?.kind === "weapon");
  const active = knownWeapons.some((v) => v.item.equipped)
    ? knownWeapons.filter((v) => v.item.equipped)
    : knownWeapons.filter((v) => v.item.equipped !== false);
  const die = modern
    ? n < 5
      ? 6
      : n < 11
        ? 8
        : n < 17
          ? 10
          : 12
    : n < 5
      ? 4
      : n < 11
        ? 6
        : n < 17
          ? 8
          : 10;
  const rage =
    cls === "barbarian" && armor?.rule?.category !== "heavy"
      ? n < 9
        ? 2
        : n < 16
          ? 3
          : 4
      : 0;
  for (const { item, rule: w } of active) {
    if (!w) continue;
    const monkWeapon =
      martialArts &&
      (modern
        ? !w.ranged && (w.category === "simple" || !!w.light)
        : w.id === "shortsword" ||
          (w.category === "simple" && !w.ranged && !w.twoHanded));
    let ability: Ability = w.ranged ? "dex" : "str";
    if ((w.finesse || monkWeapon) && m.dex > m.str) ability = "dex";
    if (item.attackAbility) ability = item.attackAbility;
    const proficient = item.proficient ?? weaponProficiency(d, c, w),
      bonus = item.magicBonus || 0;
    const hit =
      m[ability] +
      (proficient ? pb : 0) +
      bonus +
      (styles.includes("archery") && w.ranged ? 2 : 0);
    let dice = item.twoHanded && w.versatile ? w.versatile : w.damage!;
    if (monkWeapon && Number(dice.split("d")[1] || 0) < die) dice = `1d${die}`;
    const two = w.twoHanded || !!(item.twoHanded && w.versatile);
    const dueling =
      styles.includes("dueling") && !two && !w.ranged && active.length === 1
        ? 2
        : 0;
    const dmg = m[ability] + bonus + dueling;
    let details = `${w.damageType}; ${w.ranged ? `${w.range} фт.` : `досягаемость ${w.reach} фт.`}${w.range && !w.ranged ? `; метание ${w.range} фт.` : ""}; ${saveNames[ability]}${proficient ? "" : "; без владения"}`;
    if (two) details += "; две руки";
    if (w.id === "lance")
      details += modern
        ? "; верхом можно одной рукой"
        : "; помеха по цели в 5 фт.; верхом можно одной рукой";
    if (two && shield)
      result.warnings.push(
        `«${item.name}»: для атаки двумя руками уберите щит; КД со щитом и этот хват одновременно недоступны.`,
      );
    if (w.heavy)
      details += modern
        ? c.abilities[w.ranged ? "dex" : "str"] < 13
          ? "; помеха: для тяжёлого оружия нужна характеристика 13"
          : ""
        : "; Маленькие и Крошечные существа атакуют с помехой";
    if (w.loading)
      details +=
        "; перезарядка: не более одного выстрела за действие/бонусное действие/реакцию";
    if (rage && ability === "str" && (!w.ranged || modern))
      details += `; в ярости ${formula(dice, dmg + rage)}${!modern && w.range ? " (только рукопашно)" : ""}`;
    if (cls === "rogue" && (w.finesse || w.ranged))
      details += `; скрытая атака +${Math.ceil(n / 2)}d6 раз за ход при выполнении условий`;
    if (cls === "paladin" && n >= 11 && !w.ranged)
      details += "; +1d8 излучением";
    result.attacks.push({
      name: equipmentDisplayName(item.name),
      hit: sign(hit),
      damage: w.id === "net" ? "без урона" : formula(dice, dmg),
      details,
      source: "weapon",
    });
  }
  const unarmedAbility = martialArts && m.dex > m.str ? "dex" : "str";
  result.attacks.push({
    name: "Безоружный удар",
    hit: sign(m[unarmedAbility] + pb),
    damage: martialArts
      ? formula(`1d${die}`, m[unarmedAbility])
      : String(Math.max(0, 1 + m.str)),
    details: `дробящий; 5 фт.${rage && unarmedAbility === "str" ? `; в ярости +${rage} урона` : ""}${martialArts ? "; бонусная атака по правилам Боевых искусств" : ""}`,
    source: "natural",
  });
  if (
    n >= 5 &&
    ["barbarian", "fighter", "monk", "paladin", "ranger"].includes(cls)
  )
    result.attacksPerAction = 2;
  if (cls === "fighter" && n >= 11) result.attacksPerAction = n >= 20 ? 4 : 3;
  if (
    (cls === "bard" && ["valor", "swords"].includes(sub || "") && n >= 6) ||
    (cls === "wizard" && sub === "bladesinging" && n >= 6) ||
    (cls === "artificer" &&
      ["battle-smith", "armorer"].includes(sub || "") &&
      n >= 5)
  )
    result.attacksPerAction = 2;
  if (
    cls === "warlock" &&
    characterChoices(d, "invocations").some((x) => /thirsting-blade/.test(x))
  )
    result.effects.push({
      name: "Клинок договора",
      text: "Жаждущий клинок: две атаки только оружием договора.",
    });
  const resource = (
    name: string,
    maximum: number | null,
    recovery: string,
    details = "",
  ) => result.resources.push({ name, maximum, recovery, details });
  const effect = (name: string, text: string) =>
    result.effects.push({ name, text });
  const lr = "Долгий отдых",
    sr = "Короткий или долгий отдых";
  resource(
    "Кости хитов",
    n,
    modern
      ? "Все после долгого отдыха"
      : "Половина максимума вниз (мин. 1) после долгого отдыха",
    `${c.hitDice}; тратятся на коротком отдыхе`,
  );
  if (cls === "barbarian") {
    resource(
      "Ярость",
      !modern && n === 20
        ? null
        : n < 3
          ? 2
          : n < 6
            ? 3
            : n < 12
              ? 4
              : n < 17
                ? 5
                : 6,
      modern ? "1 — короткий отдых; все — долгий" : lr,
      `Бонусное действие; +${n < 9 ? 2 : n < 16 ? 3 : 4} урона подходящих атак${armor?.rule?.category === "heavy" ? "; недоступна в тяжёлом доспехе" : ""}`,
    );
    effect(
      "Защита в ярости",
      "Сопротивление дробящему, колющему и рубящему урону; преимущество проверок и спасбросков Силы.",
    );
    if (n >= 2)
      effect(
        "Безрассудная атака",
        modern
          ? "Преимущество атак Силой до следующего хода; атаки по вам тоже с преимуществом."
          : "Преимущество рукопашных атак оружием Силой в свой ход; атаки по вам с преимуществом до следующего хода.",
      );
    if (sub === "zealot" && n >= 3) {
      const damage = characterChoices(d, "zealot-damage")[0];
      effect(
        "Божественный гнев",
        `В ярости первое попадание оружием в свой ход: +1d6 + ${Math.floor(n / 2)} ${damage === "necrotic" ? "некротическим уроном" : damage === "radiant" ? "излучением" : "(выберите тип урона)"}.`,
      );
    }
  }
  if (cls === "bard")
    resource(
      "Бардовское вдохновение",
      Math.max(1, m.cha),
      n >= 5 ? sr : lr,
      `Кость d${n < 5 ? 6 : n < 10 ? 8 : n < 15 ? 10 : 12}; бонусное действие; 60 фт.`,
    );
  if (cls === "cleric" && n >= 2)
    resource(
      "Божественный канал",
      modern ? (n < 6 ? 2 : n < 18 ? 3 : 4) : n < 6 ? 1 : n < 18 ? 2 : 3,
      modern ? "1 — короткий отдых; все — долгий" : sr,
      "Общий запас всех вариантов канала",
    );
  if (cls === "druid" && n >= 2)
    resource(
      "Дикий облик",
      !modern && n === 20 ? null : modern ? (n < 6 ? 2 : n < 17 ? 3 : 4) : 2,
      modern ? "1 — короткий отдых; все — долгий" : sr,
      modern
        ? "Бонусное действие; формы и ограничения — в способностях"
        : "Действие; Круг Луны может превращаться бонусным действием",
    );
  if (cls === "fighter") {
    resource(
      "Второе дыхание",
      modern ? (n < 4 ? 2 : n < 10 ? 3 : 4) : 1,
      modern ? "1 — короткий отдых; все — долгий" : sr,
      `Бонусное действие: лечение 1d10 + ${n}`,
    );
    if (n >= 2)
      resource(
        "Всплеск действий",
        n >= 17 ? 2 : 1,
        sr,
        modern
          ? "Дополнительное действие, кроме Магии; не более одного использования за ход"
          : "Дополнительное действие; не более одного использования за ход",
      );
    if (n >= 9)
      resource(
        "Несгибаемый",
        n < 13 ? 1 : n < 17 ? 2 : 3,
        lr,
        modern
          ? `Перебросить проваленный спасбросок с +${n}`
          : "Перебросить проваленный спасбросок",
      );
  }
  if (cls === "monk" && n >= 2)
    resource(
      modern ? "Фокус" : "Ци",
      n,
      sr,
      `Сл ${8 + pb + m.wis}; Шквал ударов — 1 очко${!modern ? "; восстановление требует 30 минут медитации" : ""}`,
    );
  if (cls === "paladin") {
    resource(
      "Наложение рук",
      n * 5,
      lr,
      `${modern ? "Бонусное действие" : "Действие"}; запас лечения в хитах`,
    );
    if (n >= 3)
      resource(
        "Божественный канал",
        modern ? (n >= 11 ? 3 : 2) : 1,
        modern ? "1 — короткий отдых; все — долгий" : sr,
      );
    if (!modern)
      resource(
        "Божественное чувство",
        Math.max(0, 1 + m.cha),
        lr,
        "Действие; 60 фт.",
      );
    if (modern && n >= 2)
      resource(
        "Божественная кара без ячейки",
        1,
        lr,
        "Бонусное действие после попадания; последующие применения расходуют ячейки",
      );
  }
  if (cls === "ranger" && modern)
    resource(
      "Метка охотника без ячейки",
      pb,
      lr,
      "Концентрация; дополнительные применения — за ячейки",
    );
  if (cls === "rogue") {
    effect(
      "Скрытая атака",
      `+${Math.ceil(n / 2)}d6 раз за ход при преимуществе или подходящем союзнике рядом с целью, без помехи; фехтовальное или дальнобойное оружие.`,
    );
    if (n >= 2)
      effect("Хитрое действие", "Бонусным действием: Рывок, Отход или Засада.");
    if (n === 20) resource("Удача", 1, sr);
  }
  if (cls === "sorcerer") {
    if (n >= 2)
      resource(
        "Очки чародейства",
        n,
        lr,
        "Метамагия и преобразование ячеек по правилам класса",
      );
    if (modern)
      resource(
        "Врождённое колдовство",
        2,
        lr,
        "Бонусное действие, 1 минута: +1 к Сл заклинаний чародея, преимущество их атак",
      );
  }
  if (cls === "wizard")
    resource(
      "Магическое восстановление",
      1,
      modern ? lr : "Раз в день",
      `После короткого отдыха: ячейки суммой до ${Math.ceil(n / 2)} кругов; не выше 5 круга`,
    );
  if (cls === "artificer" && n >= 7)
    resource(
      "Вспышка гениальности",
      Math.max(1, m.int),
      lr,
      `Реакция: +${m.int} к проверке или спасброску в 30 фт.`,
    );
  if (cls === "warlock") {
    if (modern && n >= 2)
      resource(
        "Магическая хитрость",
        1,
        lr,
        `1 минута: восстановить ${n === 20 ? c.pactSlots : Math.ceil(c.pactSlots / 2)} ячейки договора`,
      );
    for (let level = 6; level <= 9; level++)
      if (n >= 11 + (level - 6) * 2)
        resource(`Таинственный арканум · ${level} круг`, 1, lr);
    if (!modern && n === 20)
      resource("Мастер оккультизма", 1, lr, "1 минута: все ячейки договора");
  }
  if (n >= 3 && cls === "fighter" && sub === "battlemaster")
    resource(
      "Кости превосходства",
      n < 7 ? 4 : n < 15 ? 5 : 6,
      sr,
      `d${n < 10 ? 8 : n < 18 ? 10 : 12}; Сл ${8 + pb + Math.max(m.str, m.dex)}; один приём на атаку`,
    );
  if (
    n >= 3 &&
    ((cls === "fighter" && sub === "psi-warrior") ||
      (cls === "rogue" && sub === "soulknife"))
  )
    resource(
      "Кости пси-энергии",
      pb * 2,
      modern ? "1 — короткий отдых; все — долгий" : lr,
      `d${n < 5 ? 6 : n < 11 ? 8 : n < 17 ? 10 : 12}${modern ? "" : "; бонусным действием восстановить одну кость раз за короткий или долгий отдых"}`,
    );
  if (n >= 3 && cls === "fighter" && sub === "arcane-archer")
    resource(
      "Магический выстрел",
      modern ? Math.max(1, m.int) : 2,
      sr,
      `Сл ${8 + pb + m.int}`,
    );
  if (n >= 6 && cls === "monk" && sub === "open-hand")
    resource(
      "Целостность тела",
      modern ? Math.max(1, m.wis) : 1,
      lr,
      modern
        ? `Бонусное действие: 1d${die} ${sign(m.wis)} хитов`
        : `Действие: ${3 * n} хитов`,
    );
  if (n >= 2 && cls === "monk" && modern)
    resource(
      "Необычный метаболизм",
      1,
      lr,
      `При инициативе: весь фокус и лечение 1d${die} + ${n}`,
    );
  if (n >= 3 && cls === "warlock" && sub === "celestial")
    resource(
      "Исцеляющий свет",
      n + 1,
      lr,
      `Кости d6; бонусное действие, 60 фт.; за раз до ${Math.max(1, m.cha)} костей`,
    );
  if (cls === "paladin" && !modern && n >= 2)
    effect(
      "Божественная кара",
      "После попадания рукопашным оружием: ячейка 1 круга +2d8 излучением, каждый круг выше +1d8 (до 5d8); против нежити или исчадия ещё +1d8 (до 6d8). Не требует действия.",
    );
  c.spellSlots.forEach((count, i) => {
    if (count) resource(`Ячейки · ${i + 1} круг`, count, lr);
  });
  if (c.pactSlots)
    resource(`Ячейки договора · ${c.pactSlotLevel} круг`, c.pactSlots, sr);
  if (d.speciesId === "dragonborn") {
    const ancestry = characterChoices(d, "ancestry")[0];
    const types: Record<string, string> = {
      black: "кислота",
      blue: "электричество",
      brass: "огонь",
      bronze: "электричество",
      copper: "кислота",
      gold: "огонь",
      green: "яд",
      red: "огонь",
      silver: "холод",
      white: "холод",
    };
    if (ancestry && types[ancestry]) {
      const con = ["silver", "white", "green"].includes(ancestry),
        line = ["black", "blue", "brass", "bronze", "copper"].includes(
          ancestry,
        );
      const dice = modern
        ? `${n < 5 ? 1 : n < 11 ? 2 : n < 17 ? 3 : 4}d10`
        : `${n < 6 ? 2 : n < 11 ? 3 : n < 16 ? 4 : 5}d6`;
      result.attacks.push({
        name: "Драконье дыхание",
        hit: `Сл ${8 + pb + m.con}`,
        damage: dice,
        details: `${types[ancestry]}; спасбросок ${modern || !con ? "Ловкости" : "Телосложения"}, половина при успехе; ${modern ? "конус 15 фт. или линия 30 × 5 фт.; вместо одной атаки" : "действие; " + (line ? "линия 30 × 5 фт." : "конус 15 фт.")}`,
        source: "natural",
      });
      resource("Драконье дыхание", modern ? pb : 1, modern ? lr : sr);
      effect("Сопротивление", types[ancestry]);
    } else
      result.warnings.push(
        "Не выбран драконий предок: проверьте тип и область дыхания.",
      );
  }
  const spells = [
    ...new Map(
      [...c.selectedCantrips, ...c.preparedSpells].map((s) => [s.id, s]),
    ).values(),
  ];
  for (const s of spells) {
    const id = s.id.replace(/-(2014|2024)$/, ""),
      info = cantripDamage[id];
    if (!info || s.level !== 0) continue;
    const sources = c.spellcastingSources.filter((source) =>
      source.spellIds.includes(s.id),
    );
    for (const source of sources) {
      let [sides, type, save, range] = info;
      if (modern && id === "poison-spray") {
        save = "attack";
        range = "30 фт.";
      }
      if (modern && id === "chill-touch") {
        sides = 10;
        range = "касание";
      }
      if (modern && id === "vicious-mockery") sides = 6;
      if (modern && id === "produce-flame") range = "60 фт.";
      const count = n < 5 ? 1 : n < 11 ? 2 : n < 17 ? 3 : 4;
      let damageBonus = 0;
      if (
        id === "eldritch-blast" &&
        source.id === "class" &&
        characterChoices(d, "invocations").includes("agonizing-blast")
      )
        damageBonus += m.cha;
      if (
        modern &&
        n >= 7 &&
        ((cls === "cleric" &&
          characterChoices(d, "blessed-strikes").includes(
            "potent-spellcasting",
          )) ||
          (cls === "druid" &&
            characterChoices(d, "elemental-fury").includes(
              "potent-spellcasting",
            ))) &&
        source.ability === "wis"
      )
        damageBonus += m.wis;
      result.attacks.push({
        name: s.name + (sources.length > 1 ? ` (${source.name})` : ""),
        hit:
          save === "attack" ? sign(source.attackBonus) : `Сл ${source.saveDc}`,
        damage:
          id === "eldritch-blast"
            ? `${count} × (${formula("1d10", damageBonus)})`
            : formula(`${count}d${sides}`, damageBonus),
        details: `${type}; ${range}${save !== "attack" ? `; спасбросок: ${saveNames[save]}; без урона при успехе` : ""}; заговор; дополнительные эффекты — в карточке`,
        source: "spell",
      });
    }
  }
  for (const source of c.spellcastingSources)
    effect(
      source.name,
      `Атака ${sign(source.attackBonus)}; Сл ${source.saveDc}; ${saveNames[source.ability]}. Урон, лечение, усиление и условия каждого подготовленного заклинания приведены в разделе магии.`,
    );
  const notes = (d.notes || "").toLowerCase().replaceAll("ё", "е");
  const mentioned = combatEquipmentCatalog(d.edition).filter(
    (w) =>
      w.kind === "weapon" &&
      notes.includes(w.name.toLowerCase().replaceAll("ё", "е")) &&
      !inv.some((v) => v.rule?.id === w.id),
  );
  if (mentioned.length)
    result.warnings.push(
      `В заметках есть оружие вне инвентаря: ${mentioned.map((w) => w.name).join(", ")}. Оно не добавлено в атаки автоматически.`,
    );
  // Keep unstructured subclass/feat pools visible without inventing a numeric maximum.
  const pooledFeatures = new Set([
    "Боевое превосходство",
    "Улучшенное боевое превосходство",
    "Псионическая сила",
    "Псионическая энергия",
    "Магический выстрел",
    "Исцеляющий свет",
  ]);
  for (const f of [...c.features, ...c.feats]) {
    if (
      ("ruleName" in f && f.ruleName) ||
      pooledFeatures.has(f.name) ||
      spells.some((s) => s.name === f.name)
    )
      continue;
    if (
      !/отдых/i.test(f.description) ||
      !/использован|применен|применён|раз за|заряд|кост[ьи]|очк/i.test(
        f.description,
      )
    )
      continue;
    if (
      result.resources.some(
        (r) =>
          r.name.toLowerCase().includes(f.name.toLowerCase()) ||
          f.name.toLowerCase().includes(r.name.toLowerCase()),
      )
    )
      continue;
    result.resources.push({
      name: f.name,
      maximum: null,
      manual: true,
      recovery: "См. описание способности",
      details:
        "Условия, расход и восстановление — в разделе способностей. Осталось: ______",
    });
  }
  result.warnings = [...new Set(result.warnings)];
  return result;
}
