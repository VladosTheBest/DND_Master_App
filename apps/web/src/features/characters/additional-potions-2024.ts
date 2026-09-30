import type { RuleItem } from "./rule-items";

const potion = (slug: string, source: number, ru: string, en: string, rarity: RuleItem["rarity"], rulesRu: string, rulesEn: string, spellIds?: string[]): RuleItem => ({
  id: `${slug}-2024`, edition: "2024", kind: "potion", rarity,
  name: { ru, en }, sourceUrl: `https://next.dnd.su/items/${source}-${slug}`,
  activation: { ru: "Одноразовое: выпить или дать другому существу бонусным действием; для масла — время нанесения в описании.", en: "Consumable: drink or administer to another creature as a Bonus Action; oils use their stated application time." },
  rules: { ru: rulesRu, en: rulesEn }, spellIds,
});

/** Remaining distinct Potion-category entries in the reviewed 2024 source index. */
export const ADDITIONAL_POTIONS_2024: RuleItem[] = [
  potion("elixir-of-health",15921,"Эликсир здоровья","Elixir of Health","rare","Излечивает все магические заражения и заканчивает Глухоту, Слепоту, Отравление и Паралич.","Cures all magical contagions and ends Deafened, Blinded, Poisoned, and Paralyzed."),
  potion("oil-of-etherealness",16002,"Масло эфирности","Oil of Etherealness","rare","Нанесение 10 минут. Флакон покрывает существо Среднего размера или меньше и всё его носимое снаряжение; за каждую категорию выше Среднего нужен дополнительный флакон. Даёт эффект Эфирности на 1 час.","Application takes 10 minutes. One vial coats a Medium or smaller creature and its worn/carried gear; each size category above Medium needs another vial. Grants Etherealness for 1 hour.",["etherealness-2024"]),
  potion("oil-of-sharpness",16003,"Масло остроты","Oil of Sharpness","very-rare","За 1 минуту покройте одно немагическое рукопашное оружие или 20 немагических боеприпасов, наносящих рубящий либо колющий урон. Масло превращает их в оружие +3 или боеприпасы +3: +3 к броскам атаки и урона. Боеприпас теряет магию после попадания; для оружия ограничение длительности не задано.","Apply for 1 minute to one nonmagical Melee weapon or 20 nonmagical ammunition pieces dealing Slashing or Piercing damage. They become a +3 Weapon or +3 Ammunition, gaining +3 to attack and damage rolls. Ammunition loses its magic after hitting a target; the weapon has no stated duration limit."),
  potion("potion-of-clairvoyance",16023,"Зелье ясновидения","Potion of Clairvoyance","rare","Даёт эффект Ясновидения без Концентрации.","Grants Clairvoyance without Concentration.",["clairvoyance-2024"]),
  potion("potion-of-diminution",16026,"Зелье уменьшения","Potion of Diminution","rare","Даёт уменьшение от Увеличения/уменьшения на 1d4 часа без Концентрации.","Grants the reduce effect of Enlarge/Reduce for 1d4 hours without Concentration.",["enlarge-reduce-2024"]),
  potion("potion-of-flying",16028,"Зелье полёта","Potion of Flying","very-rare","На 1 час даёт скорость Полёта, равную Скорости, и парение. При окончании в воздухе падаете, если нет другого способа удержаться.","For 1 hour, gain a Fly Speed equal to your Speed and hover. When it expires in the air, fall unless another means keeps you aloft."),
  potion("potion-of-gaseous-form",16029,"Зелье газообразной формы","Potion of Gaseous Form","rare","Газообразная форма на 1 час без Концентрации; можете закончить бонусным действием.","Gaseous Form for 1 hour without Concentration; you can end it as a Bonus Action.",["gaseous-form-2024"]),
  potion("potion-of-greater-invisibility",16031,"Зелье высшей невидимости","Potion of Greater Invisibility","very-rare","Состояние Невидимый на 1 час; атаки, урон и сотворение заклинаний не заканчивают эффект.","Invisible for 1 hour; attacks, damage, and spellcasting do not end the effect."),
  potion("potion-of-heroism",16033,"Зелье героизма","Potion of Heroism","rare","10 временных хитов на 1 час и эффект Благословения на то же время без Концентрации.","10 Temporary HP lasting 1 hour, plus Bless for that duration without Concentration.",["bless-2024"]),
  potion("potion-of-invisibility",16034,"Зелье невидимости","Potion of Invisibility","rare","Состояние Невидимый на 1 час. Бросок атаки, нанесение урона или сотворение заклинания заканчивают эффект досрочно.","Invisible for 1 hour. Making an attack roll, dealing damage, or casting a spell ends the effect early."),
  potion("potion-of-invulnerability",16035,"Зелье неуязвимости","Potion of Invulnerability","rare","Сопротивление всему урону на 1 минуту.","Resistance to all damage for 1 minute."),
  potion("potion-of-longevity",16036,"Зелье долголетия","Potion of Longevity","very-rare","Физический возраст уменьшается на 1d6 + 6 лет, минимум до 13. При каждом последующем употреблении такого зелья накапливается 10% вероятности вместо этого постареть на 1d6 + 6 лет.","Physical age decreases by 1d6 + 6 years, to a minimum of 13. Each subsequent use has a cumulative 10% chance to instead increase age by 1d6 + 6 years."),
  potion("potion-of-mind-reading",16037,"Зелье чтения мыслей","Potion of Mind Reading","rare","Обнаружение мыслей, Сл 13, на 10 минут без Концентрации.","Detect Thoughts, DC 13, for 10 minutes without Concentration.",["detect-thoughts-2024"]),
  potion("potion-of-speed",16041,"Зелье скорости","Potion of Speed","very-rare","Ускорение на 1 минуту без Концентрации и без обычного приступа вялости после окончания эффекта.","Haste for 1 minute without Concentration or its usual lethargy when the effect ends.",["haste-2024"]),
  potion("potion-of-vitality",16042,"Зелье жизненной силы","Potion of Vitality","very-rare","Убирает все уровни Истощения и заканчивает Отравление. Следующие 24 часа каждая потраченная Кость хитов восстанавливает максимально возможное число хитов.","Removes all Exhaustion levels and ends Poisoned. For 24 hours, every Hit Point Die you spend restores its maximum possible HP."),
  potion("potion-of-superior-healing",16524,"Зелье превосходного лечения","Potion of Superior Healing","rare","Восстановите 8d4 + 8 хитов.","Regain 8d4 + 8 HP."),
  potion("potion-of-supreme-healing",16525,"Зелье высшего лечения","Potion of Supreme Healing","very-rare","Восстановите 10d4 + 20 хитов.","Regain 10d4 + 20 HP."),
  ...([
    ["frost",16830,"ледяного","Frost",23,"rare"], ["stone",16831,"каменного","Stone",23,"rare"],
    ["fire",16832,"огненного","Fire",25,"rare"], ["cloud",16833,"облачного","Cloud",27,"very-rare"],
    ["storm",16834,"штормового","Storm",29,"legendary"],
  ] as const).map(([slug,source,ru,en,score,rarity]) => potion(`potion-of-giant-strength-${slug}`,source,`Зелье силы ${ru} великана`,`Potion of Giant Strength (${en})`,rarity,`На 1 час Сила становится ${score}, если она ниже этого значения.`, `For 1 hour, Strength becomes ${score} unless already equal or higher.`))
];
