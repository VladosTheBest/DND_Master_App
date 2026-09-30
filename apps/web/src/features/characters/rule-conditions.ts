import type { RuleLanguage } from "./random-effect-tables";

type Text = Record<RuleLanguage, string>;
export interface RuleCondition {
  id: string;
  name: Text;
  rules: Text;
}
const text = (ru: string, en: string): Text => ({ ru, en });
const common: RuleCondition[] = [
  {
    id: "blinded",
    name: text("Ослеплённый", "Blinded"),
    rules: text(
      "Вы не видите и автоматически проваливаете проверки характеристик, требующие зрения. Ваши броски атаки совершаются с помехой, а броски атаки по вам — с преимуществом.",
      "You cannot see and automatically fail ability checks requiring sight. Your attack rolls have Disadvantage; attack rolls against you have Advantage.",
    ),
  },
  {
    id: "charmed",
    name: text("Очарованный", "Charmed"),
    rules: text(
      "Вы не можете атаковать очаровавшее вас существо или выбирать его целью вредоносных способностей либо магических эффектов. Оно совершает с преимуществом проверки характеристик при социальном взаимодействии с вами.",
      "You cannot attack your charmer or target it with harmful abilities or magical effects. It has Advantage on ability checks for social interaction with you.",
    ),
  },
  {
    id: "deafened",
    name: text("Оглохший", "Deafened"),
    rules: text(
      "Вы не слышите и автоматически проваливаете проверки характеристик, требующие слуха.",
      "You cannot hear and automatically fail ability checks requiring hearing.",
    ),
  },
  {
    id: "frightened",
    name: text("Испуганный", "Frightened"),
    rules: text(
      "Пока источник страха находится в пределах линии обзора, ваши проверки характеристик и броски атаки совершаются с помехой. Вы не можете добровольно приближаться к источнику страха.",
      "While the source of fear is within line of sight, your ability checks and attack rolls have Disadvantage. You cannot willingly move closer to that source.",
    ),
  },
  {
    id: "poisoned",
    name: text("Отравленный", "Poisoned"),
    rules: text(
      "Ваши броски атаки и проверки характеристик совершаются с помехой.",
      "Your attack rolls and ability checks have Disadvantage.",
    ),
  },
  {
    id: "restrained",
    name: text("Опутанный", "Restrained"),
    rules: text(
      "Скорость равна 0 и не может увеличиваться. Броски атаки по вам совершаются с преимуществом, ваши броски атаки — с помехой. Спасброски Ловкости совершаются с помехой.",
      "Your Speed is 0 and cannot increase. Attack rolls against you have Advantage; your attack rolls have Disadvantage. Your Dexterity saving throws have Disadvantage.",
    ),
  },
  {
    id: "prone",
    name: text("Лежащий ничком", "Prone"),
    rules: text(
      "Для перемещения нужно ползти либо встать, завершив состояние. Чтобы встать, потратьте перемещение в размере половины скорости; при скорости 0 встать нельзя. Ваши броски атаки совершаются с помехой. Броски атаки по вам имеют преимущество, если атакующий находится в пределах 5 фт., и помеху в остальных случаях.",
      "Movement requires crawling or standing up to end the condition. Standing costs movement equal to half your Speed; you cannot stand with Speed 0. Your attack rolls have Disadvantage. Attack rolls against you have Advantage if the attacker is within 5 feet, and Disadvantage otherwise.",
    ),
  },
];
const legacy: RuleCondition[] = [
  {
    id: "exhaustion",
    name: text("Истощение", "Exhaustion"),
    rules: text(
      "Уровни складываются; действуют эффекты текущего и всех меньших уровней. 1: помеха проверкам характеристик. 2: скорость вдвое меньше. 3: помеха броскам атаки и спасброскам. 4: максимум хитов вдвое меньше. 5: скорость 0. 6: смерть. Долгий отдых снижает уровень на 1, если вы также получили пищу и питьё. Возвращение к жизни также снижает уровень на 1. Другие эффекты снижают уровень на указанное ими количество; при уровне 0 состояние заканчивается.",
      "Levels accumulate, and all effects up to your current level apply. 1: Disadvantage on ability checks. 2: Speed halved. 3: Disadvantage on attack rolls and saving throws. 4: Hit Point maximum halved. 5: Speed 0. 6: death. A Long Rest removes 1 level if you also consumed food and drink. Being raised from the dead also removes 1 level. Other effects remove the number of levels they specify; at level 0 the condition ends.",
    ),
  },
  {
    id: "grappled",
    name: text("Схваченный", "Grappled"),
    rules: text(
      "Скорость равна 0; бонусы к скорости не действуют. Состояние заканчивается, если захвативший становится недееспособным либо эффект выводит вас за пределы досягаемости захватившего или захвата. Действием можно попытаться вырваться: проверка Силы (Атлетика) или Ловкости (Акробатика) против Силы (Атлетика) захватившего. Захвативший может отпустить без действия; при перемещении с вами его скорость вдвое меньше, если вы не меньше него хотя бы на две категории размера.",
      "Your Speed is 0 and speed bonuses do not apply. The condition ends if the grappler is Incapacitated or an effect moves you beyond the reach of the grappler or grapple. You can use an action to escape with Strength (Athletics) or Dexterity (Acrobatics) contested by the grappler’s Strength (Athletics). The grappler can release you without an action; its Speed is halved when moving with you unless you are at least two sizes smaller.",
    ),
  },
  {
    id: "incapacitated",
    name: text("Недееспособный", "Incapacitated"),
    rules: text(
      "Вы не можете совершать действия или реакции; запрет действий также запрещает бонусные действия. Концентрация заканчивается. Само это состояние не запрещает перемещение или речь.",
      "You cannot take actions or reactions; being unable to take actions also prevents bonus actions. Concentration ends. This condition alone does not prevent movement or speech.",
    ),
  },
  {
    id: "invisible",
    name: text("Невидимый", "Invisible"),
    rules: text(
      "Вас нельзя увидеть без магии или особого чувства; при попытке спрятаться вы считаетесь сильно заслонённым. Шум или следы могут выдать ваше местоположение. Броски атаки по вам совершаются с помехой, ваши броски атаки — с преимуществом.",
      "You cannot be seen without magic or a special sense and count as heavily obscured when hiding. Noise or tracks can reveal your location. Attack rolls against you have Disadvantage; your attack rolls have Advantage.",
    ),
  },
  {
    id: "paralyzed",
    name: text("Парализованный", "Paralyzed"),
    rules: text(
      "Вы недееспособны, не можете двигаться или говорить. Автоматически проваливаете спасброски Силы и Ловкости. Броски атаки по вам имеют преимущество; любое попадание является критическим, если атакующий находится в пределах 5 фт.",
      "You are Incapacitated and cannot move or speak. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage; any hit is critical if the attacker is within 5 feet.",
    ),
  },
  {
    id: "petrified",
    name: text("Окаменевший", "Petrified"),
    rules: text(
      "Вы и носимые немагические предметы превращаетесь в твёрдое неодушевлённое вещество, обычно камень. Вес увеличивается в 10 раз, старение прекращается. Вы недееспособны, не можете двигаться или говорить и не осознаёте происходящее вокруг. Броски атаки по вам имеют преимущество; спасброски Силы и Ловкости автоматически проваливаются. Вы получаете сопротивление всему урону и иммунитет к яду и болезням. Уже действующие яд и болезнь приостанавливаются, но не устраняются.",
      "You and your nonmagical worn or carried objects become a solid inanimate substance, usually stone. Your weight becomes ten times greater and aging stops. You are Incapacitated, cannot move or speak, and are unaware of your surroundings. Attack rolls against you have Advantage; you automatically fail Strength and Dexterity saves. You resist all damage and are immune to poison and disease. Existing poison and disease are suspended, not removed.",
    ),
  },
  {
    id: "stunned",
    name: text("Ошеломлённый", "Stunned"),
    rules: text(
      "Вы недееспособны, не можете двигаться и говорите лишь с трудом. Автоматически проваливаете спасброски Силы и Ловкости. Броски атаки по вам имеют преимущество.",
      "You are Incapacitated, cannot move, and can speak only falteringly. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage.",
    ),
  },
  {
    id: "unconscious",
    name: text("Бессознательный", "Unconscious"),
    rules: text(
      "Вы недееспособны, не можете двигаться или говорить и не осознаёте происходящее вокруг. Роняете всё, что держите, и падаете ничком. Автоматически проваливаете спасброски Силы и Ловкости. Броски атаки по вам имеют преимущество; любое попадание является критическим, если атакующий находится в пределах 5 фт.",
      "You are Incapacitated, cannot move or speak, and are unaware of your surroundings. You drop everything held and fall Prone. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage; any hit is critical if the attacker is within 5 feet.",
    ),
  },
];
const revised: Record<string, Text> = {
  charmed: text(
    "Вы не можете атаковать очаровавшее вас существо или выбирать его целью наносящих урон способностей либо магических эффектов. Оно совершает с преимуществом проверки характеристик при социальном взаимодействии с вами.",
    "You cannot attack your charmer or target it with damaging abilities or magical effects. It has Advantage on ability checks for social interaction with you.",
  ),
  exhaustion: text(
    "Каждое получение состояния добавляет 1 уровень истощения. При уровне 6 вы умираете. Из результата каждой проверки d20 (проверка характеристики, бросок атаки или спасбросок) вычитается удвоенный уровень истощения. Скорость уменьшается на 5 фт. за уровень. Долгий отдых убирает 1 уровень; при уровне 0 состояние заканчивается.",
    "Each application adds 1 Exhaustion level. At level 6 you die. Subtract twice your Exhaustion level from each D20 Test (ability check, attack roll, or saving throw). Reduce your Speed by 5 feet per level. A Long Rest removes 1 level; the condition ends at level 0.",
  ),
  grappled: text(
    "Скорость равна 0 и не может увеличиваться. Броски атаки по целям, кроме захватившего, совершаются с помехой. Захвативший может тащить или нести вас; каждый фут стоит ему 1 дополнительный фут перемещения, кроме случаев, когда вы Крошечный или меньше него хотя бы на две категории. Действием можно выполнить проверку Силы (Атлетика) или Ловкости (Акробатика) против сложности освобождения захвата; успех завершает его. Захват также заканчивается, если захвативший недееспособен, расстояние превышает досягаемость захвата либо захвативший отпускает вас (действие не нужно).",
    "Your Speed is 0 and cannot increase. Attacks against anyone other than the grappler have Disadvantage. The grappler can drag or carry you, paying 1 extra foot per foot moved unless you are Tiny or at least two sizes smaller. As an action, make Strength (Athletics) or Dexterity (Acrobatics) against the grapple’s escape DC, ending it on success. It also ends if the grappler is Incapacitated, the distance exceeds the grapple’s reach, or the grappler releases you (no action).",
  ),
  incapacitated: text(
    "Нельзя совершать действия, бонусные действия и реакции. Концентрация прерывается. Нельзя говорить. Если вы бросаете инициативу в этом состоянии, бросок совершается с помехой. Само состояние не запрещает перемещение.",
    "You cannot take an action, Bonus Action, or Reaction. Concentration is broken. You cannot speak. Initiative rolls made while Incapacitated have Disadvantage. This condition alone does not prevent movement.",
  ),
  invisible: text(
    "Если при броске инициативы вы невидимы, бросок имеет преимущество. Эффекты, требующие видеть цель, на вас не действуют, если их создатель не может вас видеть особым способом; носимое и переносимое снаряжение также скрыто. Броски атаки по вам имеют помеху, ваши броски атаки — преимущество, но эти преимущества не действуют против существа, которое каким-либо способом вас видит.",
    "Initiative rolls made while Invisible have Advantage. Effects requiring a visible target cannot affect you unless their creator can somehow see you; your worn and carried equipment is concealed too. Attack rolls against you have Disadvantage and yours have Advantage, but neither benefit applies against a creature that can somehow see you.",
  ),
  paralyzed: text(
    "Вы недееспособны. Скорость равна 0 и не может увеличиваться. Автоматически проваливаете спасброски Силы и Ловкости. Броски атаки по вам имеют преимущество; любое попадание является критическим, если атакующий находится в пределах 5 фт.",
    "You are Incapacitated. Your Speed is 0 and cannot increase. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage; any hit is critical if the attacker is within 5 feet.",
  ),
  petrified: text(
    "Вы и носимые немагические предметы превращаетесь в твёрдое неодушевлённое вещество, обычно камень. Вес увеличивается в 10 раз, старение прекращается. Вы недееспособны. Скорость равна 0 и не может увеличиваться. Броски атаки по вам имеют преимущество; спасброски Силы и Ловкости автоматически проваливаются. Вы получаете сопротивление всему урону и иммунитет к состоянию «Отравленный».",
    "You and your nonmagical worn or carried objects become a solid inanimate substance, usually stone. Your weight becomes ten times greater and aging stops. You are Incapacitated. Your Speed is 0 and cannot increase. Attack rolls against you have Advantage; you automatically fail Strength and Dexterity saves. You resist all damage and are immune to the Poisoned condition.",
  ),
  stunned: text(
    "Вы недееспособны. Автоматически проваливаете спасброски Силы и Ловкости. Броски атаки по вам имеют преимущество. Эта редакция состояния сама по себе не обнуляет скорость.",
    "You are Incapacitated. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. This version of the condition does not itself reduce your Speed to 0.",
  ),
  unconscious: text(
    "Вы недееспособны, лежите ничком и роняете всё, что держите. После окончания бессознательности вы остаётесь лежать ничком. Скорость равна 0 и не может увеличиваться. Броски атаки по вам имеют преимущество; спасброски Силы и Ловкости автоматически проваливаются. Любое попадание является критическим, если атакующий находится в пределах 5 фт. Вы не осознаёте происходящее вокруг.",
    "You are Incapacitated and Prone and drop everything held. You remain Prone when Unconscious ends. Your Speed is 0 and cannot increase. Attack rolls against you have Advantage; you automatically fail Strength and Dexterity saving throws. Any hit is critical if the attacker is within 5 feet. You are unaware of your surroundings.",
  ),
};

/** Original mechanical wording, checked against the edition-specific CC-BY SRD. */
export function conditionsForEdition(
  edition: "2014" | "2024",
): RuleCondition[] {
  return [...common, ...legacy].map((c) =>
    edition === "2024" && revised[c.id] ? { ...c, rules: revised[c.id] } : c,
  );
}
export const CONDITION_SOURCES = {
  "2014":
    "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf#page=358",
  "2024":
    "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=176",
};
