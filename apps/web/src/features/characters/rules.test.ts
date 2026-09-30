import { ARTIFICER_SUBCLASSES } from "./artificer-subclasses";
import { ARTIFICER_REPLICAS_2024_COMMON } from "./artificer-replicas-2024-common";
import { ARTIFICER_REPLICAS_2024_HIGH } from "./artificer-replicas-2024-high";
import { ARTIFICER_FEATURE_EN } from "./artificer-feature-translations";
import { featureDescription, featureOriginal } from "./feature-help";
import { BEAST_FORMS_2024, SRD_ANIMAL_IDS_2024 } from "./beast-forms-2024";
import { BEAST_FORMS_2014 } from "./beast-forms-2014";
import { CHAIN_SPECIAL_FORMS } from "./warlock-pacts";
import { RULE_ITEMS } from "./rule-items";
import { collectRuleDependencies } from "./rule-dependencies";
import { ARTIFICER_SPELL_LISTS } from "./artificer-spell-lists";
import {
  ABILITIES,
  BACKGROUNDS,
  CLASSES,
  SPELLS,
  createDefaultDraft,
  deriveCharacter,
  finalAbilities,
  grantedSpellIds,
  expandedSubclassSpellIds,
  getLevelOptions,
  getFeatureChoices,
  currentLandTerrain,
  wizardBookBonusIds,
  pointBuySpent,
  recommendLevelChoices,
  validateDraft,
  type CharacterDraft,
  type Edition,
} from "./rules";
import { adjustAbility } from "./ability-controls";
import { SKILL_HELP } from "./choice-help";
import { SUBCLASS_EXTENSIONS } from "./subclasses";
import {
  RANDOM_EFFECT_TABLES,
  randomEffectForRoll,
  validateRandomEffectTable,
  type RandomEffectTable,
} from "./random-effect-tables";
import { RULE_CREATURES } from "./rule-creatures";
import { conditionsForEdition } from "./rule-conditions";
import { SPELL_REFERENCE_TRANSLATIONS } from "./spell-reference-translations";
import { spellMetadata } from "./spell-metadata";
import { FAMILIAR_FORM_IDS_2024 } from "./familiar-beasts-2024";
import { FAMILIAR_FORM_IDS_2014 } from "./familiar-beasts-2014";

const familiarForms = collectRuleDependencies([{ spellReferenceIds: ["find-familiar-2024"] }]);
const oldWildShape = featureOriginal("2014", "druid", "Wild Shape", 2);
assert(oldWildShape.includes("maximum CR 1, no movement restriction") && oldWildShape.includes("excess damage carries over") && oldWildShape.includes("Equipment that merges"), "2014 Wild Shape must include the table and continuation after its extracted subheading");
const newWildShape = featureOriginal("2024", "druid", "Wild Shape", 2);
assert(newWildShape.includes("6 known forms, maximum CR 1/2") && newWildShape.includes("8 known forms, maximum CR 1") && newWildShape.includes("4 at levels 17–20"), "2024 Wild Shape tables must retain numeric cells lost in PDF extraction");
assert(featureDescription("2014", "druid", "Wild Shape", 2).includes("оставшийся урон переносится") && featureDescription("2024", "druid", "Wild Shape", 2).includes("Ограничения на плавание нет"), "Russian Wild Shape rules must distinguish replacement hit points and swimming restrictions between editions");
assert(featureOriginal("2014", "druid", "Spellcasting", 1).includes("minimum of one spell") && featureOriginal("2014", "druid", "Spellcasting", 1).includes("ritual tag"), "Druid spellcasting must include the preparation and ritual subsections");
assert(featureDescription("2014", "druid", "Druidic", 1).includes("Мудрости (Внимательность)") && featureDescription("2024", "druid", "Druidic", 1).includes("Интеллекта (Расследование)"), "Druidic message checks differ by edition");
assert(featureOriginal("2014", "druid", "Тропами земли", 6).includes("nonmagical difficult terrain"), "Legacy Land feature alias must resolve its complete English reference");
const oldFamiliarForms = collectRuleDependencies([{ spellReferenceIds: ["find-familiar-2014"] }]);
const oldSteeds = collectRuleDependencies([{ spellReferenceIds: ["find-steed-2014"] }]);
assert(oldSteeds.creatureIds.size === 5 && ["warhorse", "pony", "camel", "elk", "mastiff"].every(id => oldSteeds.creatureIds.has(`${id}-2014`)), "2014 Find Steed must embed its five named base forms");
const correctedSanctuary = SPELLS.find(spell => spell.id === "sanctuary-2014")!;
assert(correctedSanctuary.description.includes("inflicts damage on another creature") && correctedSanctuary.descriptionRu?.includes("наносит урон другому существу"), "2014 Sanctuary must include the official damage-ending erratum in both languages");
for (const [id, en, ru] of [
  ["acid-splash-2014", "two visible creatures", "два видимых существа"],
  ["color-spray-2014", "through the end of your next turn", "до конца вашего следующего хода"],
  ["find-familiar-2014", "Equipment stays", "снаряжение остаётся"],
  ["unseen-servant-2014", "Medium size", "Среднего размера"],
  ["find-steed-2014", "with each other", "друг с другом"],
  ["moonbeam-2014", "up to 60 feet", "до 60 фт."],
  ["levitate-2014", "loose object", "незакреплённый предмет"],
  ["call-lightning-2014", "under the cloud", "под тучей"],
  ["sleet-storm-2014", "starts its turn", "начинающее свой ход"],
  ["slow-2014", "each of its turns", "каждого своего хода"],
  ["contagion-2014", "Three failed saves", "После трёх провалов"],
  ["telekinesis-2024", "empty a vial", "выливание жидкости"],
  ["disintegrate-2014", "0 hit points remaining after this damage", "после этого урона у цели осталось 0 хитов"],
  ["heroes-feast-2014", "Up to twelve creatures", "до двенадцати существ"],
  ["magnificent-mansion-2014", "creatures or objects left inside", "существа и предметы"],
  ["simulacrum-2014", "creature type is Construct", "является Конструктом"],
  ["clone-2014", "vessel used to cast the spell", "сосуде, использованном для сотворения"],
  ["prismatic-wall-2014", "violet layer only", "только против фиолетового слоя"],
  ["storm-of-vengeance-2014", "produces different effects", "разные эффекты"],
  ["true-polymorph-2014", "object must be no larger than the creature", "предметом не крупнее прежнего существа"],
  ["true-resurrection-2014", "non-undead form", "свою форму до превращения в Нежить"],
  ["glyph-of-warding-2014", "need not be harmful", "не обязательно вредоносным"],
]) {
  const spell = SPELLS.find(spell => spell.id === id)!;
  assert(spell.description.includes(en) && spell.descriptionRu?.includes(ru), `Low-level spell erratum must survive SRD regeneration: ${id}`);
}
assert(FAMILIAR_FORM_IDS_2014.length === 15 && oldFamiliarForms.creatureIds.size === 15, "2014 familiar must retain exactly its fifteen named base forms");
for (const id of FAMILIAR_FORM_IDS_2014) {
  assert(oldFamiliarForms.creatureIds.has(id), `2014 familiar dependency must be embedded: ${id}`);
  assert(!familiarForms.creatureIds.has(id), `Familiar editions must not mix: ${id}`);
}
for (const id of FAMILIAR_FORM_IDS_2024) {
  const creature = RULE_CREATURES.find(creature => creature.id === id);
  assert(creature?.challenge === "0" && /\bBeast\b/.test(creature.profile.en), `Familiar form must be a CR 0 Beast: ${id}`);
  assert(familiarForms.creatureIds.has(id), `Familiar dependency must be embedded: ${id}`);
}
assert(SPELLS.find(spell => spell.id === "revivify-2014")?.school === "Некромантия", "Revivify retains the corrected school");
assert(SPELLS.find(spell => spell.id === "mass-cure-wounds-2014")?.school === "Воплощение", "Mass Cure Wounds retains the corrected school");
assert(SPELLS.find(spell => spell.id === "mass-heal-2014")?.school === "Воплощение", "Mass Heal retains the corrected school");
assert(SPELLS.find(spell => spell.id === "clone-2014")?.components?.includes("hold the creature being cloned"), "Clone's vessel accommodates the actual creature, not only Medium targets");
assert(conditionsForEdition("2014").find(condition => condition.id === "exhaustion")?.rules.en.includes("Being raised from the dead also removes 1 level"), "Legacy exhaustion includes resurrection recovery");
{
  equal(BEAST_FORMS_2014.length, 86, "2014 has its own 86 individual SRD Beasts");
  equal(collectRuleDependencies([{spellReferenceIds:["polymorph-2014"]}]).creatureIds.size, 86, "Old Polymorph has all old SRD Beasts");
  for (const level of [2, 4, 8]) {
    const d = build("2014", "druid", level, "land");
    const group = getFeatureChoices(d, level).find(g => g.id === "wild-shape-seen")!;
    assert(group.optional, "Seen forms never impose a fabricated fixed count");
    equal(d.levels[level - 1].featureChoices![group.id].length, 0, "Recommendations do not invent encounters");
    equal(group.options.some(o => o.id === "octopus-2014"), level >= 4, "Old swimming limit");
    equal(group.options.some(o => o.id === "bat-2014"), level >= 8, "Old flight limit");
    d.levels[level - 1].featureChoices![group.id] = ["wolf-2014"];
    equal(validateDraft(d).length, 0, "A single actually seen legal form is accepted");
    assert(collectRuleDependencies(deriveCharacter(d).features).creatureIds.has("wolf-2014"), "Seen form carries full rules into the sheet");
    d.levels[level - 1].featureChoices![group.id] = ["wolf-2024"];
    assert(validateDraft(d).length > 0, "Seen form rejects other edition");
  }
  for (const [level, id, legal] of [[2,"brown-bear-2014",true], [2,"crocodile-2014",false], [4,"crocodile-2014",true], [5,"polar-bear-2014",false], [6,"polar-bear-2014",true], [17,"mammoth-2014",false], [18,"mammoth-2014",true]] as const) {
    const d = build("2014", "druid", level, "moon");
    equal(getFeatureChoices(d, level).find(g => g.id === "wild-shape-seen")!.options.some(o => o.id === id), legal, "Old Moon preserves movement limits and CR progression");
  }
}
for (const edition of ["2014", "2024"] as const) {
  assert(collectRuleDependencies([{ spellReferenceIds: [`wish-${edition}`] }]).spellIds.has(`greater-restoration-${edition}`), "Wish must embed the restoration effects it can reproduce");
}
const contagionRules = collectRuleDependencies([{ spellReferenceIds: ["contagion-2014"] }]);
assert(contagionRules.spellIds.has("confusion-2014") && contagionRules.tableIds.has("confusion-2014"), "Contagion must resolve Confusion and its behavior table for sheet/PDF");
const undeadRules = collectRuleDependencies([{ spellReferenceIds: ["create-undead-2024"] }]);
assert(["ghoul", "ghast", "wight", "mummy", "zombie"].every(id => undeadRules.creatureIds.has(`${id}-2024`)), "Create Undead must include upcast forms and the Wight's Zombie dependency");
const wardRules = collectRuleDependencies([{ spellReferenceIds: ["guards-and-wards-2024"] }]);
for (const edition of ["2014", "2024"] as const) {
  const teleport = collectRuleDependencies([{ spellReferenceIds: [`teleport-${edition}`] }]);
  assert(["circle", "object", "familiar", "casual", "once", "false"].every(kind => teleport.tableIds.has(`teleport-${kind}-${edition}`)), `Teleport must embed every arrival table: ${edition}`);
  const familiar = RANDOM_EFFECT_TABLES.find(table => table.id === `teleport-familiar-${edition}`)!;
  const offTarget = randomEffectForRoll(familiar, 14)!;
  assert(offTarget.text.en.includes(edition === "2014" ? "1d10 × 1d10 percent" : "2d12 miles"), `Teleport distance must retain edition-specific units: ${edition}`);
  assert(offTarget.subtable?.rows[0].text.en === (edition === "2014" ? "North" : "East"), `Teleport compass order must retain its edition: ${edition}`);
  assert(collectRuleDependencies([{ spellReferenceIds: [`finger-of-death-${edition}`] }]).creatureIds.has(`zombie-${edition}`), `Finger of Death embeds its edition's Zombie: ${edition}`);
}
assert(["arcane-lock", "web", "dancing-lights", "magic-mouth", "stinking-cloud", "gust-of-wind", "suggestion"].every(id => wardRules.spellIds.has(`${id}-2024`)), "Guards and Wards must embed every spell it can reproduce");
for (const spell of SPELLS.filter(spell => !spell.source)) {
  assert(Boolean(SPELL_REFERENCE_TRANSLATIONS[spell.id]), `Every SRD spell needs reviewed full Russian text: ${spell.id}`);
}

for (const id of Object.keys(SPELL_REFERENCE_TRANSLATIONS)) {
  const spell = SPELLS.find((s) => s.id === id)!;
  assert(
    spell?.descriptionRu === SPELL_REFERENCE_TRANSLATIONS[id],
    `Reviewed translation must be used: ${id}`,
  );
  const meta = spellMetadata(spell);
  assert(
    Object.values(meta).every((value) => !/[a-z]/i.test(value)),
    `Reviewed reference metadata must be Russian: ${id}`,
  );
}
assert(
  spellMetadata(
    SPELLS.find((s) => s.id === "reincarnate-2014")!,
  ).components.includes("1000 зм, расходуемые"),
  "Reincarnation keeps material cost and consumption",
);
assert(
  spellMetadata(SPELLS.find((s) => s.id === "lesser-restoration-2024")!)
    .castingTime === "бонусное действие",
  "2024 Lesser Restoration retains Bonus Action timing",
);

for (const edition of ["2014", "2024"] as const) {
  const conditions = conditionsForEdition(edition);
  equal(
    new Set(conditions.map((c) => c.id)).size,
    15,
    `${edition}: complete unique condition reference`,
  );
  assert(
    conditions.every((c) => c.rules.ru.length > 30 && c.rules.en.length > 30),
    `${edition}: bilingual condition mechanics`,
  );
}
assert(
  conditionsForEdition("2024")
    .find((c) => c.id === "invisible")!
    .rules.en.includes("can somehow see"),
  "2024 invisibility respects special sight",
);
assert(
  conditionsForEdition("2014")
    .find((c) => c.id === "exhaustion")!
    .rules.en.includes("Speed halved"),
  "2014 exhaustion retains tiered penalties",
);
assert(
  conditionsForEdition("2024")
    .find((c) => c.id === "exhaustion")!
    .rules.en.includes("twice"),
  "2024 exhaustion uses cumulative D20 penalty",
);
assert(
  !SPELLS.find((s) => s.id === "fireball-2024")!.description.includes(
    "Otherworldly Steed",
  ),
  "PDF columns cannot attach steed to Fireball",
);
assert(
  SPELLS.find((s) => s.id === "find-steed-2024")!.description.includes(
    "Otherworldly Steed",
  ),
  "Steed spell contains its own stat block",
);
assert(
  SPELLS.find((s) => s.id === "animate-objects-2024")!.description.includes(
    "Animated Object",
  ),
  "Animate Objects contains its own stat block",
);
assert(
  !SPELLS.find((s) => s.id === "antilife-shell-2024")!.description.includes(
    "Animated Object",
  ),
  "PDF columns cannot attach object to Antilife Shell",
);

// UI arithmetic must preserve legal arrays and never overspend point buy.
{
  const draft = createDefaultDraft("2024");
  for (const id of ABILITIES)
    for (const direction of [-1, 1] as const) {
      const changed = adjustAbility(draft, id, direction);
      if (changed)
        equal(
          Object.values(changed).sort((a, b) => a - b),
          [8, 10, 12, 13, 14, 15],
          "Stepper preserves standard array",
        );
    }
  draft.abilityMethod = "point-buy";
  draft.abilities = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
  equal(
    adjustAbility(draft, "int", 1),
    null,
    "Point buy cannot spend beyond 27",
  );
  equal(adjustAbility(draft, "str", 1), null, "Point buy maximum is 15");
  equal(adjustAbility(draft, "int", -1), null, "Point buy minimum is 8");
  const lowered = adjustAbility(draft, "str", -1);
  assert(lowered, "Decreasing expensive score remains available");
  equal(pointBuySpent(lowered), 25, "15 to 14 refunds two points");
  assert(
    adjustAbility({ ...draft, abilities: lowered }, "int", 1),
    "Refunded budget can be reassigned",
  );
  assert(Object.keys(SKILL_HELP).length === 18, "All skills have explanations");
  for (const spell of SPELLS)
    assert(
      spell.summary && spell.summary.length > 60,
      `Missing useful spell explanation: ${spell.id}`,
    );
  for (const edition of ["2014", "2024"] as const)
    for (const cls of CLASSES)
      for (let level = 1; level <= 20; level++) {
        const options = getLevelOptions(
          { ...draft, edition, classId: cls.id, targetLevel: level },
          level,
        );
        for (const feature of options.features)
          assert(
            /[А-Яа-я]/.test(feature.description) &&
              feature.description.length > 20 &&
              !feature.description.endsWith("…"),
            `Missing feature explanation: ${edition}/${cls.id}/${feature.name}`,
          );
        for (const group of options.featureChoiceOptions)
          for (const option of group.options)
            assert(
              option.description !== option.name,
              `Choice is only a repeated label: ${group.id}/${option.id}`,
            );
      }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
  );
}
function build(
  edition: Edition,
  classId: string,
  level: number,
  subclassId?: string,
): CharacterDraft {
  const d = {
    ...createDefaultDraft(edition),
    name: "Тест",
    playerName: "Игрок",
    classId,
    targetLevel: level,
  };
  const background = BACKGROUNDS.find(
    (b) => b.id === d.backgroundId && b.editions.includes(edition),
  )!;
  const cls = CLASSES.find((c) => c.id === classId)!;
  d.skillIds = cls.skillIds
    .filter((id) => !background.skillIds.includes(id))
    .slice(0, cls.skillCount);
  for (let n = 1; n <= level; n++) {
    if (subclassId && getLevelOptions(d, n).subclassRequired) {
      const previous = d.levels.at(-1);
      d.levels.push({
        ...previous,
        level: n,
        subclassId,
        featureChoices: {},
        spellIds: previous?.spellIds ?? [],
        cantripIds: previous?.cantripIds ?? [],
      });
    }
    const choice = recommendLevelChoices(d, n);
    d.levels = d.levels.filter((entry) => entry.level !== n);
    d.levels.push(choice);
  }
  return d;
}
let checks = 0;
for (const edition of ["2014","2024"] as const) {
  const d=build(edition,"warlock",3);
  if (edition==="2014") d.levels[2].featureChoices!["pact-boon"]=["chain"];
  else d.levels[0].featureChoices!.invocations=["pact-of-the-chain"];
  for(let n=1;n<=3;n++)d.levels[n-1]=recommendLevelChoices(d,n);
  equal(validateDraft(d).length,0,"Chain path is valid");
  const sheet=deriveCharacter(d),refs=collectRuleDependencies(sheet.features);
  for(const id of CHAIN_SPECIAL_FORMS[edition])assert(RULE_CREATURES.some(c=>c.id===id)&&refs.creatureIds.has(id),`Special familiar embedded: ${id}`);
  assert(refs.spellIds.has('find-familiar-'+edition),"Chain embeds the familiar spell");
  if(edition==='2024')assert(refs.spellIds.has('invisibility-2024'),"New familiar Invisibility has a transitive spell reference");
  assert(sheet.spellcastingSources.find(s=>s.id==='class')?.spellIds.includes('find-familiar-'+edition),"Chain spell uses the Warlock source");
}
{
  const old = build("2014", "warlock", 3);
  old.levels[2].featureChoices!["pact-boon"] = ["tome"];
  old.levels[2] = recommendLevelChoices(old,3);
  equal(validateDraft(old).length,0,"2014 Tome includes three mandatory cantrips");
  equal(old.levels[2].featureChoices!["tome-cantrips"].length,3,"Three old book cantrips");
  const oldSheet=deriveCharacter(old);
  assert(old.levels[2].featureChoices!["tome-cantrips"].every(id=>oldSheet.spellcastingSources.find(s=>s.id==='class')?.spellIds.includes(id)),"Tome uses Charisma and the Warlock casting source");
  delete old.levels[2].featureChoices!["tome-cantrips"];
  assert(validateDraft(old).length>0,"Missing Tome cantrips are rejected");
  old.levels[2].featureChoices!["pact-boon"]=["talisman"];
  equal(validateDraft(old).length,0,"Talisman has no fabricated spell choice");
  for (const level of [1,3,8]) {
    const d=build("2024","warlock",level);
    for(const step of d.levels) {
      const ids=step.featureChoices?.invocations;
      if(ids) step.featureChoices!.invocations=ids.map(id=>id==='pact-of-the-tome'?'armor-of-shadows':id);
    }
    d.levels[0].featureChoices!.invocations=['pact-of-the-tome'];
    for(let n=1;n<=level;n++)d.levels[n-1]=recommendLevelChoices(d,n);
    equal(validateDraft(d).length,0,"2024 Tome full progression remains valid");
    const choices=d.levels[level-1].featureChoices!;
    equal(choices['tome-cantrips'].length,3,"New book has three cantrips");
    equal(choices['tome-rituals'].length,2,"New book has two rituals");
    assert(choices['tome-rituals'].every(id=>SPELLS.some(s=>s.id===id&&s.level===1&&s.ritual)),"Only level-one rituals qualify");
    equal(deriveCharacter(d).features.filter(f=>f.id.includes('tome-cantrips')).length,3,"Only current book spells enter sheet");
    choices['tome-rituals'][0]='fireball-2024';
    assert(validateDraft(d).length>0,"Invalid book ritual rejected");
  }
}
{
  const d = build("2014", "ranger", 20, "beast-master");
  d.levels[2].featureChoices!["companion-rules"] = ["phb"];
  for (const step of d.levels.filter(step => step.level >= 3)) {
    delete step.featureChoices!["primal-companion"];
    step.featureChoices!["ranger-companion"] = ["wolf-2014"];
  }
  equal(validateDraft(d).length, 0, "PHB companion progression is valid through level twenty");
  const feature = deriveCharacter(d).features.find(f => f.id.includes("ranger-companion"))!;
  assert(feature.description.includes("КД 19") && feature.description.includes("хитов 80") && feature.description.includes("+6"), "PHB companion scales AC, HP and bonuses from final level");
  assert(!collectRuleDependencies(deriveCharacter(d).features).creatureIds.has("primal-land-2014"), "PHB path does not expose Tasha companion rules");
  const options = getFeatureChoices(d,20).find(g => g.id === "ranger-companion")!.options;
  assert(options.some(o => o.id === "hawk-2014") && options.some(o => o.id === "octopus-2014"), "PHB ranger has no druid flight/swim restriction");
  assert(!options.some(o => ["giant-owl-2014", "brown-bear-2014", "wolf-2024"].includes(o.id)), "PHB rejects large, excessive CR and other edition");
  d.levels[19].featureChoices!["ranger-companion"] = ["panther-2014"];
  equal(validateDraft(d).length, 0, "Replacing a deceased bonded companion is allowed");
  equal(deriveCharacter(d).features.filter(f => f.id.includes("ranger-companion")).length, 1, "Only current bonded animal enters sheet");
  d.levels[19].featureChoices!["primal-companion"] = ["land"];
  assert(validateDraft(d).length > 0, "PHB and replacement companion cannot coexist");
}
for (const table of RANDOM_EFFECT_TABLES) {
  equal(
    validateRandomEffectTable(table),
    [],
    `Complete non-overlapping ranges: ${table.id}`,
  );
  for (let roll = 1; roll <= table.die; roll++)
    assert(randomEffectForRoll(table, roll), `${table.id} covers ${roll}`);
  for (const roll of [0, -1, table.die + 1, 1.5, NaN])
    assert(
      !randomEffectForRoll(table, roll),
      `${table.id} rejects invalid roll`,
    );
  const verifyDependencies = (t: RandomEffectTable) => {
    for (const row of t.rows) {
      for (const id of row.spellIds ?? [])
        assert(
          SPELLS.some((s) => s.id === id && s.editions.includes(t.edition)),
          `Embedded table spell exists in edition: ${id}`,
        );
      for (const id of row.creatureIds ?? [])
        assert(
          RULE_CREATURES.some((c) => c.id === id && c.edition === t.edition),
          `Embedded table creature exists in edition: ${id}`,
        );
      if (row.subtable) verifyDependencies(row.subtable);
    }
  };
  verifyDependencies(table);
  for (const delta of [-1, 1]) {
    const broken = structuredClone(table);
    if (broken.rows.length === 1) {
      const original = broken.rows[0];
      const midpoint = Math.floor((original.from + original.to) / 2);
      broken.rows = [{ ...original, to: midpoint }, { ...original, from: midpoint + 1 }];
      equal(validateRandomEffectTable(broken), [], "Splitting a constant result preserves complete coverage");
    }
    broken.rows[1].from += delta;
    assert(
      validateRandomEffectTable(broken).length > 0,
      "Reject gaps and overlaps",
    );
  }
  const broken = structuredClone(table);
  broken.rows.pop();
  assert(
    validateRandomEffectTable(broken).length > 0,
    "Reject missing final range",
  );
}
for (const creature of RULE_CREATURES) {
  for (const id of creature.spellIds ?? [])
    assert(
      SPELLS.some((s) => s.id === id && s.editions.includes(creature.edition)),
      `Creature spell reference exists: ${creature.id}/${id}`,
    );
  assert(
    creature.abilities.length === 6 &&
      creature.rules.every((r) => r.ru.length && r.en.length),
    "Creature statistics and bilingual rules complete",
  );
}
for (const edition of ["2014", "2024"] as Edition[]) {
  const wild = build(edition, "sorcerer", 3, "wild-magic");
  equal(
    deriveCharacter(wild)
      .features.filter((f) => f.randomTableId)
      .map((f) => f.randomTableId),
    [`sorcerer-wild-${edition}`],
    "Only selected edition surge table",
  );
  const other = build(edition, "sorcerer", 3, "draconic");
  assert(
    !deriveCharacter(other).features.some((f) => f.randomTableId),
    "No surge table for another subclass",
  );
}
for (const edition of ["2014", "2024"] as Edition[]) {
  const wild = build(edition, "barbarian", 20, "zealot");
  for (let n = 1; n <= 20; n++)
    assert(
      !deriveCharacter(wild, n).features.some((f) =>
        /Берсерк:|Бездумная ярость|Пугающее присутствие|Ответный удар/.test(
          f.name,
        ),
      ),
      `No Berserker features on Zealot ${edition}/${n}`,
    );
}
{
  const giant = build("2014", "barbarian", 3, "giant");
  assert(
    deriveCharacter(giant).spellcastingSources.some(
      (s) => s.ability === "wis" && s.spellIds.includes("druidcraft-2014"),
    ),
    "Giant selected cantrip uses Wisdom",
  );
  const zealot = build("2014", "barbarian", 3, "zealot");
  delete zealot.levels.find((l) => l.level === 3)!.featureChoices![
    "zealot-damage"
  ];
  assert(
    validateDraft(zealot).length > 0,
    "2014 Zealot damage type is required",
  );
}
for (const subclass of SUBCLASS_EXTENSIONS) {
  for (const edition of subclass.editions) {
    const draft = build(edition, subclass.classId, 20, subclass.id);
    equal(
      validateDraft(draft),
      [],
      `Valid extension ${edition}/${subclass.classId}/${subclass.id}`,
    );
    for (const [level, names] of subclass.grants ?? []) {
      const granted = deriveCharacter(draft, level);
      const spellIds = [
        ...granted.selectedSpells,
        ...granted.selectedCantrips,
      ].map((s) => s.id);
      for (const name of names)
        assert(
          spellIds.includes(`${name}-${edition}`),
          `Grant exists at correct level: ${subclass.id}/${level}/${name}`,
        );
    }
    for (let level = 1; level <= 20; level++) {
      const features = deriveCharacter(draft, level).features;
      for (const feature of subclass.features)
        equal(
          features.some((f) => f.name === feature.name),
          feature.level <= level,
          `Feature level gate ${subclass.id}/${feature.name}/${level}`,
        );
    }
  }
}
{
  const draft = build("2024", "fighter", 1);
  draft.personality = { backstory: "Я".repeat(3000), flaws: "😀".repeat(1000) };
  equal(
    validateDraft(draft),
    [],
    "Narrative fields accept limits measured in Unicode code points",
  );
  draft.personality.backstory += "Я";
  assert(
    validateDraft(draft).some((issue) => issue.code === "personality-length"),
    "Reject oversized backstory",
  );
  draft.personality = {
    traits: 42,
  } as unknown as CharacterDraft["personality"];
  assert(
    validateDraft(draft).some((issue) => issue.code === "personality"),
    "Reject invalid narrative field types without throwing",
  );
}
for (const edition of ["2014", "2024"] as Edition[])
  for (const cls of CLASSES) {
    const d = build(edition, cls.id, 20);
    equal(validateDraft(d), [], `20-level ${edition} ${cls.id} progression`);
    for (let n = 1; n <= 20; n++) {
      const o = getLevelOptions(d, n),
        derived = deriveCharacter(d, n);
      equal(
        derived.proficiencyBonus,
        2 + Math.floor((n - 1) / 4),
        "Proficiency progression",
      );
      assert(
        o.spells.every(
          (s) => s.editions.includes(edition) && s.level <= o.maxSpellLevel,
        ),
        "No wrong-edition or over-level spells",
      );
      assert(derived.maxHp >= n, "Positive hit points at every level");
      checks++;
    }
  }
equal(
  SPELLS.filter((s) => s.editions.includes("2014") && !s.source).length,
  319,
  "Complete 2014 SRD spell catalogue",
);
equal(
  SPELLS.filter((s) => s.editions.includes("2024") && !s.source).length,
  339,
  "Complete 2024 SRD spell catalogue",
);
for (const edition of ["2014", "2024"] as Edition[]) {
  const vengeance = build(edition, "paladin", 20, "vengeance");
  for (let n = 1; n <= 20; n++) {
    const names = deriveCharacter(vengeance, n)
      .features.map((f) => f.name)
      .join(" ");
    assert(
      !/Аура преданности|Чистота духа|Священный нимб|Священное оружие|Клятва преданности/.test(
        names,
      ),
      `No Devotion features on Vengeance ${edition}/${n}`,
    );
  }
  assert(
    !deriveCharacter(vengeance, 3)
      .spellcastingSources.flatMap((s) => s.spellIds)
      .includes(`sanctuary-${edition}`),
    "No free Devotion Sanctuary",
  );
  const glory = build(edition, "paladin", 7, "glory");
  equal(
    deriveCharacter(glory, 7).speed,
    deriveCharacter(glory, 6).speed + 10,
    `Glory speed at 7/${edition}`,
  );
}
{
  const watcher = build("2014", "paladin", 7, "watchers");
  const stats = deriveCharacter(watcher);
  equal(
    stats.initiative,
    stats.modifiers.dex + stats.proficiencyBonus,
    "Watcher initiative includes aura",
  );
  const genie = build("2024", "paladin", 3, "noble-genies");
  const g = deriveCharacter(genie);
  equal(
    g.armorClass,
    Math.max(10 + g.modifiers.dex, 10 + g.modifiers.dex + g.modifiers.cha),
    "Genie unarmored defense",
  );
  const third = genie.levels.find((l) => l.level === 3)!;
  delete third.featureChoices?.["genie-skill"];
  assert(validateDraft(genie).length > 0, "Genie skill is mandatory");
}
for (const subclass of ["war", "light", "trickery"]) {
  const d = build("2024", "cleric", 20, subclass);
  equal(validateDraft(d), [], `Valid cleric ${subclass}`);
  const result = deriveCharacter(d);
  assert(
    result.features.some(
      (f) => f.sourceUrl === "https://next.dnd.su/class/cleric",
    ),
    "Selected domain features appear",
  );
  assert(
    !result.features.some((f) =>
      /Disciple of Life|Поборник жизни|Высшее исцеление/.test(f.name),
    ),
    "No Life features in other domains",
  );
  const level3 = deriveCharacter(d, 3);
  assert(
    !level3.selectedSpells.some((s) => s.id === "steel-wind-strike-2024"),
    "Level 5 domain spell not granted early",
  );
}
{
  const war = build("2024", "cleric", 9, "war");
  assert(
    deriveCharacter(war).selectedSpells.some(
      (s) => s.id === "steel-wind-strike-2024",
    ),
    "War domain receives non-cleric spell at level 9",
  );
  assert(
    !getLevelOptions(war, 9).spells.some(
      (s) => s.id === "spiritual-weapon-2024",
    ),
    "Domain spells do not occupy selectable preparation slots",
  );
}
for (const edition of ["2014", "2024"] as Edition[]) {
  const draconic = deriveCharacter(build(edition, "sorcerer", 20, "draconic"));
  const wild = deriveCharacter(build(edition, "sorcerer", 20, "wild-magic"));
  equal(draconic.maxHp - wild.maxHp, 20, "Only Draconic gains subclass HP");
  assert(
    !wild.features.some((f) => /Крылья дракона|Dragon Wings/.test(f.name)),
    "Wild Magic has no Draconic features",
  );
}
equal(
  new Set(SPELLS.map((s) => s.id)).size,
  SPELLS.length,
  "Unambiguous edition-specific ids",
);
assert(
  SPELLS.every((s) => s.classes.length > 0),
  "Every spell has a verified class list",
);
assert(
  !SPELLS.find((s) => s.id === "zone-of-truth-2024")!.description.includes(
    "Rules Glossary",
  ),
  "Spell text stops before glossary",
);
assert(
  !SPELLS.find((s) => s.id === "zone-of-truth-2014")!.description.includes(
    "Traps can be found",
  ),
  "Spell text stops before trap rules",
);
for (const edition of ["2014", "2024"] as Edition[]) {
  const wizard = build(edition, "wizard", 5),
    o = getLevelOptions(wizard, 5);
  equal(o.spellSlots, [4, 3, 2, 0, 0, 0, 0, 0, 0], "Full caster level 5 slots");
  equal(o.spellCount, 14, "Wizard learns 6 + 2 per additional level");
  equal(
    o.preparedCount,
    edition === "2024"
      ? 9
      : 5 + Math.floor((finalAbilities(wizard).int - 10) / 2),
    "Edition-specific preparation",
  );
  const bad = structuredClone(wizard);
  bad.levels[0].spellIds[0] = "wish-" + edition;
  assert(
    validateDraft(bad).some(
      (i) => i.code === "spell-unavailable" && i.level === 1,
    ),
    "Reject spell acquired before its circle unlocks",
  );
  const tampered = structuredClone(wizard);
  tampered.levels[4].spellIds[0] = o.spells.find(
    (s) => !tampered.levels[4].spellIds.includes(s.id),
  )!.id;
  assert(
    validateDraft(tampered).some((i) => i.code === "spellbook-retain"),
    "Wizard cannot silently discard earlier book entries",
  );
  const warlock = getLevelOptions(build(edition, "warlock", 5), 5);
  equal(
    [warlock.pactSlots, warlock.pactSlotLevel],
    [2, 3],
    "Pact magic separate from full caster slots",
  );
  equal(
    warlock.spellSlots,
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Pact slots are not ordinary slots",
  );
}
equal(
  getLevelOptions(build("2014", "paladin", 1), 1).spellCount,
  0,
  "2014 paladin starts casting at 2",
);
equal(
  getLevelOptions(build("2024", "paladin", 1), 1).spellCount,
  2,
  "2024 paladin starts casting at 1",
);
equal(
  deriveCharacter(build("2014", "paladin", 1)).spellSaveDc,
  null,
  "No class spell DC before spellcasting",
);
assert(
  getLevelOptions(build("2014", "cleric", 1), 1).subclassRequired,
  "2014 cleric subclass at 1",
);
assert(
  !getLevelOptions(build("2024", "cleric", 1), 1).subclassRequired,
  "2024 cleric subclass deferred",
);
assert(
  getLevelOptions(build("2024", "cleric", 3), 3).subclassRequired,
  "2024 subclasses at 3",
);
equal(
  deriveCharacter(build("2024", "monk", 20)).savingThrows.filter(
    (s) => s.proficient,
  ).length,
  6,
  "Diamond Soul all saving throws",
);
equal(
  deriveCharacter(build("2014", "rogue", 20)).savingThrows.filter(
    (s) => s.proficient,
  ).length,
  3,
  "2014 Slippery Mind",
);
equal(
  deriveCharacter(build("2024", "rogue", 20)).savingThrows.filter(
    (s) => s.proficient,
  ).length,
  4,
  "2024 Slippery Mind",
);
for (const level of [2, 5, 6, 10, 14, 18])
  equal(
    deriveCharacter(build("2014", "monk", level)).speed,
    30 + 10 + Math.floor((level - 2) / 4) * 5,
    "Monk movement thresholds",
  );
equal(
  pointBuySpent({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }),
  27,
  "27 point buy cost",
);
const illegal = build("2024", "fighter", 4);
illegal.levels[3].asi = { str: 3 };
assert(
  validateDraft(illegal).some((i) => i.code === "asi-invalid"),
  "ASI cannot add three points",
);
const mismatch = build("2014", "fighter", 1);
mismatch.abilityBonuses.str = 2;
assert(
  validateDraft(mismatch).some((i) => i.code === "species-bonuses"),
  "2014 bonuses fixed by race",
);
const wrongBackground = build("2024", "fighter", 1);
wrongBackground.abilityBonuses = {
  str: 0,
  dex: 0,
  con: 0,
  int: 2,
  wis: 1,
  cha: 0,
};
assert(
  validateDraft(wrongBackground).some((i) => i.code === "background-bonuses"),
  "2024 bonuses constrained by background",
);
const kept = build("2024", "wizard", 5);
kept.levels[4].spellIds[12] = "fireball-2024";
kept.levels[4].preparedSpellIds = ["fireball-2024"];
const recommended = recommendLevelChoices(kept, 5);
assert(
  recommended.spellIds.includes("fireball-2024") &&
    recommended.preparedSpellIds?.includes("fireball-2024"),
  "Recommendation preserves manual valid spell choices",
);
const snapshot = JSON.stringify(kept);
recommendLevelChoices(kept, 5);
equal(JSON.stringify(kept), snapshot, "Recommendation does not mutate input");
const missing = build("2024", "fighter", 1);
missing.levels[0].featureChoices = {};
assert(
  validateDraft(missing).some(
    (i) => i.step === "level" && i.level === 1 && i.code === "feature-choice",
  ),
  "Mandatory choices cannot be silently skipped",
);
const lore = build("2024", "bard", 6);
equal(
  lore.levels[5].featureChoices?.["magical-discoveries"].length,
  2,
  "2024 Lore Magical Discoveries choices",
);
const loreSpell = lore.levels[5].featureChoices!["magical-discoveries"][0];
assert(
  [
    ...deriveCharacter(lore).selectedSpells,
    ...deriveCharacter(lore).selectedCantrips,
  ].some((s) => s.id === loreSpell),
  "Magical discoveries appear on sheet",
);
assert(
  deriveCharacter(build("2024", "druid", 1)).selectedSpells.some(
    (s) => s.id === "speak-with-animals-2024",
  ),
  "Druidic always prepared spell",
);
assert(
  deriveCharacter(build("2024", "warlock", 9)).selectedSpells.some(
    (s) => s.id === "contact-other-plane-2024",
  ),
  "Contact Patron always prepared spell",
);
assert(
  deriveCharacter(build("2024", "bard", 20)).selectedSpells.some(
    (s) => s.id === "power-word-heal-2024",
  ),
  "Words of Creation always prepared spell",
);
const innate = build("2014", "fighter", 3);
innate.speciesId = "tiefling";
innate.abilityBonuses = { str: 0, dex: 0, con: 0, int: 1, wis: 0, cha: 2 };
const innateSheet = deriveCharacter(innate);
assert(
  innateSheet.spellcastingSources.some(
    (s) =>
      s.id === "innate" &&
      s.ability === "cha" &&
      s.spellIds.includes("hellish-rebuke-2014"),
  ),
  "Racial magic has its own ability and DC",
);
equal(innateSheet.spellSaveDc, 11, "Noncaster falls back to racial magic DC");
assert(
  !getLevelOptions(build("2024", "fighter", 19), 19).feats.some(
    (f) => f.id === "boon-spell-recall",
  ),
  "Spell Recall requires Spellcasting feature",
);
assert(
  ABILITIES.every((a) =>
    Number.isFinite(
      deriveCharacter(build("2024", "barbarian", 20)).abilities[a],
    ),
  ),
  "Capstone stats finite",
);
const champion = deriveCharacter(build("2014", "fighter", 7));
equal(
  champion.initiative,
  champion.modifiers.dex + 2,
  "Champion Remarkable Athlete applies to initiative",
);
const championSkill = champion.skills.find(
  (s) => !s.proficient && s.ability === "dex",
)!;
equal(
  championSkill.bonus,
  champion.modifiers.dex + 2,
  "Champion improves nonproficient physical checks",
);
const master = build("2024", "wizard", 20);
const mastery = master.levels[17].featureChoices!["spell-mastery-1"][0];
assert(
  !master.levels[19].preparedSpellIds!.includes(mastery),
  "Spell Mastery is outside normal preparation count",
);
assert(
  deriveCharacter(master).preparedSpells.some((s) => s.id === mastery),
  "Spell Mastery is always prepared",
);
equal(
  master.levels[19].preparedSpellIds!.length,
  25,
  "Wizard keeps all 25 normal preparations plus automatic spells",
);
{
  const valor = build("2014", "bard", 14, "valor");
  assert(
    !getLevelOptions(valor, 6).featureChoiceOptions.some(
      (g) => g.id === "magical-secrets",
    ),
    "2014 Valor cannot take Lore level-6 secrets",
  );
  assert(
    getLevelOptions(valor, 10).featureChoiceOptions.some(
      (g) => g.id === "magical-secrets",
    ),
    "2014 Valor retains class level-10 secrets",
  );
  assert(
    !deriveCharacter(valor).features.some((f) =>
      [
        "Коллегия знаний: острое словцо",
        "Дополнительные тайны магии",
        "Непревзойдённый навык",
      ].includes(f.name),
    ),
    "2014 bard extensions must not inherit Lore mechanics",
  );
  const swords = build("2014", "bard", 3, "swords");
  swords.levels[2].featureChoices!["swords-style"] = [];
  assert(
    validateDraft(swords).some(
      (i) => i.code === "feature-choice" && i.level === 3,
    ),
    "Swords requires its fighting-style selection",
  );
  const moon = build("2024", "bard", 4, "moon");
  const oldMoon = moon.levels[2].featureChoices!["moon-cantrip"][0];
  const replacement = getLevelOptions(moon, 4)
    .featureChoiceOptions.find((g) => g.id === "moon-cantrip")!
    .options.find((s) => s.id !== oldMoon)!.id;
  moon.levels[3].featureChoices!["moon-cantrip"] = [replacement];
  const moonSheet = deriveCharacter(moon);
  assert(
    moonSheet.selectedCantrips.some((s) => s.id === replacement) &&
      !moonSheet.selectedCantrips.some((s) => s.id === oldMoon),
    "Moon replacement removes the previous extra cantrip",
  );
  assert(
    moonSheet.spellcastingSources
      .find((s) => s.id === "class")!
      .spellIds.includes(replacement),
    "Moon cantrip uses Bard Charisma",
  );
  const moonSkill = moon.levels[2].featureChoices!["moon-skill"][0];
  assert(
    moonSheet.skills.some((s) => s.id === moonSkill && s.proficient),
    "Moon skill is included on the sheet",
  );
  assert(
    deriveCharacter(build("2024", "bard", 6, "spirits")).preparedSpells.some(
      (s) => s.id === "spirit-guardians-2024",
    ),
    "2024 Spirits always prepares Spirit Guardians",
  );
  for (const extension of SUBCLASS_EXTENSIONS)
    for (const feature of extension.features) {
      assert(
        (feature.spellReferenceIds ?? []).every((id) =>
          SPELLS.some(
            (s) =>
              s.id === id &&
              extension.editions.some((e) => s.editions.includes(e)),
          ),
        ),
        "Feature spell references resolve in their edition",
      );
      assert(
        (feature.creatureReferenceIds ?? []).every((id) =>
          RULE_CREATURES.some(
            (c) => c.id === id && extension.editions.includes(c.edition),
          ),
        ),
        "Feature creature references resolve in their edition",
      );
    }
}
{
  for (const edition of ["2014", "2024"] as const)
    for (const domain of CLASSES.find(
      (c) => c.id === "cleric",
    )!.subclasses.filter((s) => s.editions.includes(edition))) {
      const draft = build(edition, "cleric", 20, domain.id);
      equal(
        validateDraft(draft).length,
        0,
        `${edition}/${domain.id}: valid full progression`,
      );
      if (domain.id !== "life")
        assert(
          !deriveCharacter(draft).features.some((f) =>
            [
              "Сохранение жизни",
              "Высшее исцеление",
              "Благословенный целитель",
              "Домен жизни: поборник жизни и тяжёлые доспехи",
            ].includes(f.name),
          ),
          "Other domains cannot inherit Life features",
        );
    }
  for (const extension of SUBCLASS_EXTENSIONS)
    for (const edition of extension.editions)
      for (const [, ids] of extension.grants ?? [])
        for (const id of ids)
          assert(
            SPELLS.some((s) => s.id === `${id}-${edition}`),
            `Missing domain/subclass spell: ${id}-${edition}`,
          );
  const knowledge = build("2024", "cleric", 6, "knowledge"),
    ks = deriveCharacter(knowledge);
  for (const id of knowledge.levels[2].featureChoices!["domain-skills"]) {
    const s = ks.skills.find((s) => s.id === id)!;
    equal(
      s.bonus,
      ks.modifiers[s.ability] + 2 * ks.proficiencyBonus,
      "Knowledge grants expertise",
    );
  }
  assert(
    ks.savingThrows.some((s) => s.ability === "int" && s.proficient),
    "Knowledge grants Intelligence save proficiency at 6",
  );
  const arcana = build("2024", "cleric", 18, "arcana");
  const oldCantrips = arcana.levels[16].featureChoices!["domain-cantrips"];
  const replacement = getLevelOptions(arcana, 18)
    .featureChoiceOptions.find((g) => g.id === "domain-cantrips")!
    .options.find((s) => !oldCantrips.includes(s.id))!.id;
  arcana.levels[17].featureChoices!["domain-cantrips"] = [
    oldCantrips[0],
    replacement,
  ];
  equal(
    validateDraft(arcana).length,
    0,
    "Arcana accepts one cantrip replacement",
  );
  const arcanaSheet = deriveCharacter(arcana);
  assert(
    arcanaSheet.selectedCantrips.some((s) => s.id === replacement) &&
      !arcanaSheet.selectedCantrips.some((s) => s.id === oldCantrips[1]),
    "Arcana replacement removes the old bonus cantrip",
  );
  for (const circle of [6, 7]) {
    const key = `domain-mastery-${circle}`;
    arcana.levels[17].featureChoices![key] = [
      getLevelOptions(arcana, 18)
        .featureChoiceOptions.find((g) => g.id === key)!
        .options.find(
          (s) => s.id !== arcana.levels[16].featureChoices![key][0],
        )!.id,
    ];
  }
  assert(
    validateDraft(arcana).some((i) => i.code === "domain-replacement"),
    "Arcana rejects replacing two mastery spells at one level",
  );
}
{
  for (const sub of [
    "storm",
    "divine-soul",
    "lunar-sorcery",
    "aberrant-mind",
    "clockwork-soul",
  ])
    equal(
      validateDraft(build("2014", "sorcerer", 20, sub)).length,
      0,
      `${sub}: complete valid progression`,
    );
  const aberrant = build("2014", "sorcerer", 3, "aberrant-mind"),
    step = aberrant.levels[2];
  equal(
    deriveCharacter(aberrant).features.filter((f) =>
      f.id.includes("origin-spell-0-"),
    ).length,
    1,
    "Unchanged origin choices appear once in the sheet/PDF history",
  );
  const old = step.featureChoices!["origin-spell-0"][0];
  for (const [index, key] of ["origin-spell-0", "origin-spell-2"].entries()) {
    const occupied = [
      ...step.spellIds,
      ...step.cantripIds,
      ...Object.values(step.featureChoices!).flat(),
    ];
    const option = getLevelOptions(aberrant, 3)
      .featureChoiceOptions.find((g) => g.id === key)!
      .options.find((s) => !occupied.includes(s.id))!;
    assert(!!option, "Replacement candidate exists");
    step.featureChoices![key] = [option.id];
    if (index === 0) {
      equal(
        validateDraft(aberrant).length,
        0,
        "One origin spell replacement accepted",
      );
      assert(
        !deriveCharacter(aberrant).selectedSpells.some((s) => s.id === old),
        "Replaced psionic spell disappears",
      );
    } else
      assert(
        validateDraft(aberrant).some((i) => i.code === "origin-replacement"),
        "Two psionic replacements rejected",
      );
  }
  const divine = build("2014", "sorcerer", 2, "divine-soul"),
    level = divine.levels[1];
  assert(
    getLevelOptions(divine, 2).cantrips.some(
      (s) => s.id === "sacred-flame-2014",
    ),
    "Divine Soul can learn Cleric cantrips",
  );
  level.featureChoices!["divine-bonus-spell"] = ["sanctuary-2014"];
  const choices = getLevelOptions(divine, 2).spells.filter(
    (s) => !level.spellIds.includes(s.id),
  );
  level.spellIds[0] = choices[0].id;
  assert(
    validateDraft(divine).some((i) => i.code === "spell-replacement"),
    "Divine bonus and ordinary spell share one replacement allowance",
  );
  for (const extension of SUBCLASS_EXTENSIONS)
    for (const edition of extension.editions)
      for (const entry of extension.replaceableSpells?.entries ?? [])
        assert(
          SPELLS.some((s) => s.id === `${entry.id}-${edition}`),
          `Replaceable spell exists: ${entry.id}`,
        );
  for (const spell of SPELLS)
    for (const id of spell.creatureReferenceIds ?? [])
      assert(
        RULE_CREATURES.some(
          (c) => c.id === id && spell.editions.includes(c.edition),
        ),
        "Summon creature reference resolves in the correct edition",
      );
}
console.log(
  `Character rules: ${checks} class/edition/level checks and rule regression assertions passed.`,
);

// Wizard school mechanics: free book entries differ from always-prepared spells.
for (const edition of ["2014", "2024"] as const)
  for (const sub of CLASSES.find((c) => c.id === "wizard")!.subclasses.filter(
    (s) => s.editions.includes(edition),
  )) {
    const draft = build(edition, "wizard", 20, sub.id);
    equal(
      validateDraft(draft),
      [],
      `Wizard ${edition}/${sub.id} progresses to 20`,
    );
    if (sub.id !== "evocation")
      assert(
        !deriveCharacter(draft).features.some((f) =>
          ["Усиленное воплощение", "Перегрузка"].includes(f.name),
        ),
        `${sub.id} excludes Evoker features`,
      );
  }
for (const sub of ["war-magic", "chronurgy"]) {
  const d = deriveCharacter(build("2014", "wizard", 2, sub));
  equal(
    d.initiative,
    d.modifiers.dex + d.modifiers.int,
    `${sub} adds Intelligence to initiative`,
  );
}
{
  const d = build("2014", "wizard", 5, "necromancy");
  d.levels[4].spellIds = d.levels[4].spellIds.filter(
    (id) => id !== "animate-dead-2014",
  );
  d.targetLevel = 6;
  d.levels.push(recommendLevelChoices(d, 6));
  assert(
    wizardBookBonusIds(d, 6).includes("animate-dead-2014"),
    "Necromancy adds absent Animate Dead to book",
  );
  assert(
    deriveCharacter(d).selectedSpells.some((s) => s.id === "animate-dead-2014"),
    "Free book spell is visible",
  );
  const before = build("2014", "wizard", 5, "necromancy");
  if (!before.levels[4].spellIds.includes("animate-dead-2014"))
    before.levels[4].spellIds[before.levels[4].spellIds.length - 1] =
      "animate-dead-2014";
  before.targetLevel = 6;
  before.levels.push(recommendLevelChoices(before, 6));
  assert(
    !wizardBookBonusIds(before, 6).includes("animate-dead-2014"),
    "Already-known spell gives no duplicate bonus",
  );
  assert(
    before.levels[5].spellIds.includes("animate-dead-2014"),
    "Previously learned spell remains in ordinary book",
  );
}
{
  const d = build("2024", "wizard", 10, "abjuration");
  const derived = deriveCharacter(d);
  for (const id of ["counterspell-2024", "dispel-magic-2024"]) {
    assert(
      derived.preparedSpells.some((s) => s.id === id),
      "Abjurer always prepares " + id,
    );
    assert(
      !d.levels[9].preparedSpellIds?.includes(id),
      "Always-prepared spell uses no preparation slot",
    );
  }
  const illusion = build("2024", "wizard", 6, "illusion");
  assert(
    deriveCharacter(illusion).preparedSpells.some(
      (s) => s.id === "summon-fey-2024",
    ),
    "Illusionist has full Fey spell",
  );
  assert(
    illusion.levels[2].featureChoices?.["illusion-cantrip"]?.length === 1,
    "Illusion bonus cantrip is mandatory",
  );
  const enchant = build("2024", "wizard", 3, "enchantment"),
    sheet = deriveCharacter(enchant),
    skill = enchant.levels[2].featureChoices!["enchanter-skill"][0];
  const value = sheet.skills.find((s) => s.id === skill)!;
  equal(
    value.bonus,
    sheet.modifiers[value.ability] +
      sheet.proficiencyBonus +
      Math.max(1, sheet.modifiers.int),
    "Enchanter skill bonus includes Intelligence",
  );
}

{
  const ordinary = build("2014", "wizard", 20, "evocation");
  assert(
    !getLevelOptions(ordinary, 20).spells.some(
      (s) => s.id === "temporal-shunt-2014",
    ),
    "Dunamancy is not an unrestricted Wizard spell",
  );
  for (const id of ["chronurgy", "graviturgy"]) {
    const d = build("2014", "wizard", 20, id),
      options = getLevelOptions(d, 20);
    assert(
      options.spells.some((s) => s.id === "temporal-shunt-2014"),
      "Dunamancy is available to " + id,
    );
    assert(
      options.cantrips.some((s) => s.id === "sapping-sting-2014"),
      "Sapping Sting available to " + id,
    );
  }
  assert(
    SPELLS.find((s) => s.id === "reality-break-2014")!.randomTableId ===
      "reality-break-2014",
    "Reality Break has an inline table",
  );
}

for (const edition of ["2014", "2024"] as const) {
  const battle = build(edition, "fighter", 20, "battlemaster");
  equal(
    battle.levels[19].featureChoices?.maneuvers.length,
    9,
    "Battle Master learns nine maneuvers",
  );
  const bad = structuredClone(battle);
  const pool = SUBCLASS_EXTENSIONS.find(
    (s) =>
      s.classId === "fighter" &&
      s.id === "battlemaster" &&
      s.editions.includes(edition),
  )!.choicePools![0];
  const unused = pool.options.find(
    (o) => !bad.levels[3].featureChoices!.maneuvers.includes(o.id),
  )!.id;
  bad.levels[3].featureChoices!.maneuvers[0] = unused;
  assert(
    validateDraft(bad).some((i) => i.code === "pool-replacement"),
    "Maneuvers cannot be replaced at level four",
  );
  const knight = build(edition, "fighter", 20, "eldritch-knight");
  equal(
    getLevelOptions(knight, 20).spellSlots[3],
    1,
    "Eldritch Knight reaches one fourth-circle slot",
  );
  assert(
    !knight.levels.some(
      (l) =>
        (l.featureChoices?.["fighting-style"]?.length ?? 0) > 0 && l.level > 1,
    ),
    "Non-Champion gets no second style",
  );
}
{
  const rune = build("2014", "fighter", 6, "rune-knight");
  const pool = getLevelOptions(rune, 6).featureChoiceOptions.find(
    (g) => g.id === "runes",
  )!;
  assert(
    !pool.options.some((o) => o.id === "hill" || o.id === "storm"),
    "Advanced runes require level seven",
  );
  const bad = structuredClone(rune);
  bad.levels[5].featureChoices!.runes = ["hill", "storm"];
  assert(
    validateDraft(bad).length > 0,
    "Premature advanced runes are rejected",
  );
}

{
  const d = build("2014", "monk", 3, "four-elements");
  assert(
    d.levels[2].featureChoices!.disciplines.includes("attunement"),
    "Four Elements starts with Elemental Attunement",
  );
  const bad = structuredClone(d);
  bad.levels[2].featureChoices!.disciplines = ["water-whip", "fire-snake"];
  assert(
    validateDraft(bad).some((i) => i.code === "pool-initial"),
    "Required initial discipline cannot be omitted",
  );
  assert(
    !deriveCharacter(d).features.some(
      (f) => f.name === "Техника открытой ладони",
    ),
    "Four Elements does not inherit Open Hand",
  );
  const ken = build("2014", "monk", 3, "kensei");
  ken.levels[2].featureChoices!["kensei-weapons"] = ["club", "dagger"];
  assert(
    validateDraft(ken).some((i) => i.code === "pool-initial"),
    "Kensei must choose a ranged weapon",
  );
  const mystic = build("2024", "monk", 20, "mystic-arts");
  equal(
    getLevelOptions(mystic, 20).spellSlots[3],
    1,
    "Mystic monk fourth-level slot",
  );
  assert(
    deriveCharacter(mystic).spellcastingSources.some(
      (s) => s.ability === "wis",
    ),
    "Mystic monk Wisdom casting",
  );
  assert(
    getLevelOptions(mystic, 20).spells.every((s) =>
      s.classes.includes("sorcerer"),
    ),
    "Mystic monk uses Sorcerer list",
  );
}

{
  const shadow = build("2014", "monk", 20, "shadow");
  assert(
    !deriveCharacter(shadow).features.some((f) =>
      [
        "Техника открытой ладони",
        "Целостность тела",
        "Безмятежность",
        "Дрожащая ладонь",
      ].includes(f.name),
    ),
    "All Open Hand features are absent from Shadow monk",
  );
}

for (const edition of ["2014", "2024"] as const) {
  const trick = build(edition, "rogue", 20, "arcane-trickster"),
    derived = deriveCharacter(trick);
  equal(
    derived.selectedCantrips.length,
    4,
    "Arcane Trickster has four total cantrips at level twenty",
  );
  assert(
    derived.selectedCantrips.some((s) => s.id === "mage-hand-" + edition),
    "Mage Hand is mandatory",
  );
  assert(
    !derived.features.some((f) => f.name === "Воровские рефлексы"),
    "Arcane Trickster does not inherit Thief reflexes",
  );
  const ghost = build(edition, "rogue", 6, "phantom");
  const first = ghost.levels[2].featureChoices!["ghost-proficiency"][0];
  const next = getLevelOptions(ghost, 4)
    .featureChoiceOptions.find((g) => g.id === "ghost-proficiency")!
    .options.find((o) => o.id !== first && !o.id.startsWith("tool-"))!.id;
  for (const l of ghost.levels)
    if (l.level >= 4) l.featureChoices!["ghost-proficiency"] = [next];
  equal(
    validateDraft(ghost).length,
    0,
    "Phantom may change its borrowed proficiency",
  );
  const sheet = deriveCharacter(ghost);
  assert(
    !sheet.skills.find((s) => s.id === first)!.proficient,
    "Phantom forgets old borrowed proficiency",
  );
  assert(
    sheet.skills.find((s) => s.id === next)!.proficient,
    "Phantom gains current borrowed proficiency",
  );
}
{
  const scout = deriveCharacter(build("2014", "rogue", 9, "scout"));
  equal(scout.speed, 40, "Scout receives ten feet of speed");
  for (const id of ["nature", "survival"]) {
    const skill = scout.skills.find((s) => s.id === id)!;
    equal(
      skill.bonus,
      scout.modifiers[skill.ability] + 2 * scout.proficiencyBonus,
      "Scout doubles proficiency",
    );
  }
  const d = build("2014", "rogue", 3, "swashbuckler");
  d.abilities.cha = 15;
  const sheet = deriveCharacter(d);
  equal(
    sheet.initiative,
    sheet.modifiers.dex + sheet.modifiers.cha,
    "Swashbuckler Charisma initiative",
  );
  const scion = build("2024", "rogue", 4, "scion-of-the-three");
  scion.levels[3].featureChoices!["dread-allegiance"] = ["myrkul"];
  const spells = deriveCharacter(scion).selectedCantrips.map((s) => s.id);
  assert(
    spells.includes("chill-touch-2024") && !spells.includes("blade-ward-2024"),
    "Current patron alone grants its cantrip",
  );
}
for (const sub of SUBCLASS_EXTENSIONS)
  for (const pool of sub.choicePools ?? [])
    for (const option of pool.options)
      for (const id of option.spellReferenceIds ?? [])
        assert(
          SPELLS.some((s) => s.id === id),
          "Choice spell dependency exists: " + id,
        );

for (const edition of ["2014", "2024"] as const) {
  const d = build(edition, "ranger", 20, "gloom-stalker");
  d.abilities.wis = 15;
  const sheet = deriveCharacter(d);
  equal(
    sheet.initiative,
    sheet.modifiers.dex +
      sheet.modifiers.wis +
      (edition === "2024" && sheet.feats.some((f) => f.id === "alert")
        ? sheet.proficiencyBonus
        : 0),
    "Gloom Stalker Wisdom initiative",
  );
  assert(
    sheet.savingThrows.find((s) => s.ability === "wis")!.proficient,
    "Gloom Stalker Wisdom saving throws",
  );
  assert(
    !d.levels.some((l) =>
      Object.keys(l.featureChoices ?? {}).some((k) => k.startsWith("hunter-")),
    ),
    "Other ranger subclasses have no Hunter choices",
  );
  assert(
    !sheet.features.some((f) =>
      [
        "Добыча охотника",
        "Защитная тактика",
        "Мультиатака",
        "Превосходная защита",
        "Hunter’s Lore",
        "Hunter’s Prey",
      ].includes(f.name),
    ),
    "Other ranger subclasses have no Hunter features",
  );
  const fey = build(edition, "ranger", 3, "fey-wanderer");
  fey.abilities.wis = 15;
  const f = deriveCharacter(fey);
  for (const skill of f.skills.filter((s) => s.ability === "cha"))
    equal(
      skill.bonus,
      f.modifiers.cha +
        (skill.proficient ? f.proficiencyBonus : 0) +
        Math.max(1, f.modifiers.wis),
      "Fey Wanderer bonus applies to every Charisma skill",
    );
  const beast = build(edition, "ranger", 4, "beast-master");
  delete beast.levels[2].featureChoices!["primal-companion"];
  assert(
    validateDraft(beast).length > 0,
    "Beast companion choice is mandatory",
  );
  const sea = RULE_CREATURES.find((c) => c.id === "primal-sea-" + edition)!;
  equal(
    sea.abilities[0],
    14,
    "Sea beast Strength is fourteen in both editions",
  );
  assert(
    sea.armorClassFormula!.en.includes(edition === "2014" ? "PB" : "Wisdom"),
    "Companion armor formula follows edition",
  );
}
{
  const d = build("2024", "ranger", 7, "hollow-warden");
  d.abilities.wis = 15;
  const sheet = deriveCharacter(d);
  equal(
    sheet.savingThrows.find((s) => s.ability === "con")!.bonus,
    sheet.modifiers.con + Math.max(1, sheet.modifiers.wis),
    "Hollow Warden Constitution save bonus",
  );
}

{
  const land = build("2024", "druid", 10, "land");
  const history = JSON.stringify(land.levels);
  land.landTerrain = "polar";
  equal(currentLandTerrain(land)?.resistance, "Холод / Cold", "Nature's Ward follows the current terrain");
  assert(grantedSpellIds(land, 10).includes("cone-of-cold-2024"), "A Long Rest can prepare the Polar circle list");
  assert(!grantedSpellIds(land, 10).includes("wall-of-stone-2024"), "Previous Arid circle spells are not retained as free grants");
  assert(grantedSpellIds(land, 9).includes("wall-of-stone-2024"), "Rest choice does not rewrite earlier level grants");
  equal(JSON.stringify(land.levels), history, "Changing current terrain preserves advancement choices");
  equal(validateDraft(land).length, 0, "Valid current terrain is accepted");
  land.landTerrain = "underdark";
  assert(validateDraft(land).some(issue => issue.code === "land-terrain"), "2014 terrain is not a 2024 rest option");
  const old = build("2014", "druid", 10, "land");
  old.levels[2].featureChoices!["land-terrain"] = ["underdark"];
  for (const id of ["spider-climb", "web", "gaseous-form", "stinking-cloud", "greater-invisibility", "stone-shape", "insect-plague", "cloudkill"])
    assert(grantedSpellIds(old, 10).includes(`${id}-2014`), `Underdark circle spell is granted: ${id}`);
  assert(getFeatureChoices(old, 3).find(choice => choice.id === "land-terrain")?.options.some(option => option.id === "underdark"), "2014 Land includes Underdark");
  old.landTerrain = "polar";
  assert(validateDraft(old).some(issue => issue.code === "land-terrain"), "2014 cannot change terrain through a 2024 rest choice");
}
{
  equal(SRD_ANIMAL_IDS_2024.length, 95, "Complete SRD 5.2.1 Animals inventory");
  equal(BEAST_FORMS_2024.length, 84, "Only individual Beasts are Wild Shape candidates");
  const polymorph = collectRuleDependencies([{spellReferenceIds:["polymorph-2024"]}]);
  equal(polymorph.creatureIds.size, 84, "Polymorph embeds the full SRD Beast catalogue");
  const animalShapes = collectRuleDependencies([{spellReferenceIds:["animal-shapes-2024"]}]);
  assert(animalShapes.creatureIds.has("hippopotamus-2024") && !animalShapes.creatureIds.has("archelon-2024") && !animalShapes.creatureIds.has("mammoth-2024"), "Animal Shapes excludes Huge forms and CR above four");
  for (const id of SRD_ANIMAL_IDS_2024) {
    const creature = RULE_CREATURES.find(c => c.id === id);
    assert(!!creature && creature.rules.every(rule => !!rule.ru && !!rule.en), `Every SRD animal has bilingual embedded rules: ${id}`);
  }
  for (const [level, count] of [[2,4], [4,6], [8,8], [20,8]]) {
    const d = build("2024", "druid", level, "land");
    const group = getFeatureChoices(d, level).find(g => g.id === "wild-shape-forms")!;
    equal(group.count, count, `Known forms at level ${level}`);
    assert(group.options.some(o => o.id === "octopus-2024"), "Swimming forms are legal from level two");
    equal(group.options.some(o => o.id === "bat-2024"), level >= 8, "Flight unlocks only at eight");
    assert(!group.options.some(o => ["swarm-of-rats-2024", "giant-eagle-2024", "flying-snake-2024", "mammoth-2024"].includes(o.id)), "Swarms, non-Beasts and excessive CR cannot be chosen");
    equal(deriveCharacter(d).features.filter(f => f.id.includes("wild-shape-forms")).length, count, "Sheet has current forms without stale historical duplicates");
    const ids = d.levels[level - 1].featureChoices!["wild-shape-forms"];
    ids[0] = "giant-eagle-2024";
    assert(validateDraft(d).length > 0, "Non-Beast form cannot be saved");
  }
  for (const [level, permitted] of [[17,false], [18,true]] as const) {
    const d = build("2024", "druid", level, "moon");
    const group = getFeatureChoices(d, level).find(g => g.id === "wild-shape-forms")!;
    equal(group.options.some(o => o.id === "mammoth-2024"), permitted, "Moon CR follows floor(level / 3)");
  }
  const d = build("2024", "druid", 8, "land");
  d.levels[7].featureChoices!["wild-shape-forms"][0] = "blood-hawk-2024";
  equal(validateDraft(d).length, 0, "Legal changed form set is accepted");
  const dependencies = collectRuleDependencies(deriveCharacter(d).features);
  assert(dependencies.creatureIds.has("blood-hawk-2024") && !deriveCharacter(d).features.some(f => f.id.includes("wild-shape-forms-rat-2024")), "Only current known forms appear as selected features");
  assert(dependencies.spellIds.has("find-familiar-2024") && dependencies.creatureIds.has("rat-2024"), "Wild Companion also embeds its spell and familiar forms, independently of known forms");
  delete d.levels[7].featureChoices!["wild-shape-forms"];
  assert(validateDraft(d).length > 0, "Known forms are required, not optional notes");
}
for (const edition of ["2014", "2024"] as const) {
  const moon = build(edition, "druid", 20, "moon");
  assert(
    !moon.levels.some((l) =>
      Object.keys(l.featureChoices ?? {}).some((k) => k.startsWith("land-")),
    ),
    "Moon druid cannot receive Land choices",
  );
  assert(
    !deriveCharacter(moon).features.some((f) =>
      [
        "Круг земли: естественное восстановление",
        "Тропами земли",
        "Покровительство природы",
        "Природное убежище",
        "Заклинания круга земли",
      ].includes(f.name),
    ),
    "Moon druid cannot receive Land features",
  );
  const stars = build(edition, "druid", 4, "stars");
  equal(
    validateDraft(stars).length,
    0,
    "Stars can retain Guidance learned before Star Map",
  );
  if (edition === "2014")
    assert(
      stars.levels[1].cantripIds.includes("guidance-2014"),
      "Previously known Guidance remains a legal class cantrip",
    );
  const text = deriveCharacter(stars).features.find(
    (f) => f.name === "Звёздная карта",
  )!.description;
  assert(
    text.includes(edition === "2014" ? "БМ" : "Мудрость"),
    "Star Map free uses follow edition",
  );
}
{
  const moon = deriveCharacter(build("2014", "druid", 10, "moon"));
  const ids = moon.features.find(
    (f) => f.name === "Стихийный дикий облик",
  )!.creatureReferenceIds!;
  equal(ids.length, 4, "Moon elemental forms have four embedded stat blocks");
  for (const id of ids)
    assert(
      RULE_CREATURES.some((c) => c.id === id),
      "Elemental form exists: " + id,
    );
  const spore = deriveCharacter(build("2014", "druid", 6, "spores"));
  assert(
    spore.features.some((f) => f.creatureReferenceIds?.includes("zombie-2014")),
    "Fungal Infestation embeds Zombie",
  );
  const wild = deriveCharacter(build("2014", "druid", 2, "wildfire"));
  assert(
    wild.features.some((f) =>
      f.creatureReferenceIds?.includes("wildfire-spirit-2014"),
    ),
    "Wildfire Spirit is embedded at level two",
  );
}

for (const edition of ["2014", "2024"] as const) {
  const fey = build(edition, "warlock", 9, "archfey");
  assert(!deriveCharacter(fey).features.some((f) => /Благословение тёмного|Благословение Тёмного|Удача тёмного|Dark One/.test(f.name)), "Archfey does not inherit Fiend features");
  const id = "faerie-fire-" + edition;
  equal(grantedSpellIds(fey, 9).includes(id), edition === "2024", "Only revised patron grants free prepared spells");
  equal(getLevelOptions(fey, 9).spells.some((s) => s.id === id), edition === "2014", "Old patron spell occupies a normal known spell choice");
}
{
  const d = build("2014", "warlock", 3, "genie");
  d.levels[0].featureChoices!["genie-kind"] = ["dao"];
  assert(expandedSubclassSpellIds(d, 3).includes("spike-growth-2014"), "Dao expands Spike Growth");
  assert(!expandedSubclassSpellIds(d, 3).includes("scorching-ray-2014"), "Dao excludes Efreeti spells");
  const wrong = structuredClone(d);
  wrong.levels[2].spellIds[0] = "scorching-ray-2014";
  assert(validateDraft(wrong).length > 0, "Foreign genie spell is rejected");
  const high = build("2014", "warlock", 17, "genie");
  assert(getLevelOptions(high, 17).featureChoiceOptions.find((c) => c.id === "mystic-arcanum-9")!.options.some((s) => s.id === "wish-2014"), "Genie Wish is available as ninth circle arcanum");
}
{
  for (const domain of ["war", "trickery", "light"]) {
    const d = build("2024", "warlock", 9, "vestige");
    d.levels[2].featureChoices!["vestige-domain"] = [domain];
    const cleric = SUBCLASS_EXTENSIONS.find((s) => s.classId === "cleric" && s.id === domain && s.editions.includes("2024"))!;
    for (const [, ids] of cleric.grants!) for (const id of ids)
      assert(grantedSpellIds(d, 9).includes(id + "-2024"), "Vestige spells match the revised domain: " + id);
    delete d.levels[2].featureChoices!["vestige-domain"];
    assert(validateDraft(d).length > 0, "Vestige domain choice is mandatory");
  }
}

for (const subclass of SUBCLASS_EXTENSIONS) for (const edition of subclass.editions) {
  const rows = [...(subclass.expandedSpells ?? []), ...(subclass.conditionalSpells ?? []).flatMap((c) => c.entries)];
  for (const [, ids] of rows) for (const id of ids)
    assert(SPELLS.some((s) => s.id === id + "-" + edition), `Expanded/conditional spell exists: ${subclass.id}/${id}/${edition}`);
}

for (const edition of ["2014", "2024"] as const) {
  for (const baseId of ARTIFICER_SPELL_LISTS[edition]) {
    const spell = SPELLS.find((s) => s.id === baseId + "-" + edition);
    assert(spell?.classes.includes("artificer"), `Artificer source spell has a local card: ${baseId}/${edition}`);
  }
}

// Every bundled reference must resolve in the same edition; recursive UI must remain acyclic.
equal(new Set(RULE_ITEMS.map(item => item.id)).size, RULE_ITEMS.length, "Item references have unique identities");
equal(new Set(RULE_CREATURES.map(creature => creature.id)).size, RULE_CREATURES.length, "Creature references have unique identities");
equal(RULE_ITEMS.filter(item => item.edition === "2014" && item.rarity === "common" && item.replicationLevel === 2).length, 79, "Reviewed common 2014 replica inventory");
equal(ARTIFICER_REPLICAS_2024_COMMON.length, 65, "Reviewed additional common 2024 replica inventory");
{
  const plans = getFeatureChoices(build("2024", "artificer", 2), 2).find(group => group.id === "artificer-plans")!;
  assert(plans.options.some(option => option.id === "trick-weapon-2024"), "Common weapons are eligible plans at level two");
  assert(!plans.options.some(option => option.id === "trick-weapon-2014"), "Plans cannot mix item editions");
  const armor = getFeatureChoices(build("2024", "artificer", 9, "armorer"), 9).find(group => group.id === "artificer-armor-plan")!;
  assert(armor.options.some(option => option.id === "cast-off-armor-2024"), "Armorer extra plan includes eligible common armor");
  assert(!armor.options.some(option => option.id === "trick-weapon-2024"), "Armorer extra armor plan excludes common weapons");
  const early = getFeatureChoices(build("2024", "artificer", 9), 9).find(group => group.id === "artificer-plans")!;
  const unlocked = getFeatureChoices(build("2024", "artificer", 10), 10).find(group => group.id === "artificer-plans")!;
  assert(!early.options.some(option => option.id === "winged-boots-2024"), "Generic uncommon wondrous plans are unavailable before ten");
  assert(unlocked.options.some(option => option.id === "winged-boots-2024"), "Generic uncommon wondrous plans unlock at ten");
  assert(!unlocked.options.some(option => option.id === "hag-eye-2024"), "Hag Eye requires creation by a hag coven and is not an ordinary Artificer plan");
  for (const color of ["gray", "rust", "tan"]) {
    assert(unlocked.options.some(option => option.id === `bag-of-tricks-${color}-2024`), `Bag color is a separate plan: ${color}`);
    const dependencies = collectRuleDependencies([{itemReferenceIds:[`bag-of-tricks-${color}-2024`]}]);
    equal(dependencies.creatureIds.size, 8, `Bag includes every outcome creature: ${color}`);
  }
  assert(!armor.options.some(option => option.id === "winged-boots-2024"), "Armorer extra plan excludes wondrous items");
  for (const level of [13, 14]) {
    const choices = getFeatureChoices(build("2024", "artificer", level), level).find(group => group.id === "artificer-plans")!;
    equal(choices.options.some(option => option.id === "amulet-of-health-2024"), level === 14, `Generic rare plan gate at ${level}`);
  }
}
for (const spell of SPELLS.filter(spell => spell.descriptionRu)) {
  assert(Object.values(spellMetadata(spell)).every(value => !/[a-z]/i.test(value)), `Every Russian spell card needs localized metadata: ${spell.id}`);
}
const teleportDependencies = collectRuleDependencies([{ itemReferenceIds: ["helm-of-teleportation-2024"] }]);
const cubeDependencies = collectRuleDependencies([{ itemReferenceIds: ["cube-of-summoning-2024"] }]);
const beanDependencies = collectRuleDependencies([{ itemReferenceIds: ["bag-of-beans-2024"] }]);
for (const id of ["treant", "shrieker-fungus", "bulette", "mummy", "mummy-lord"]) {
  assert(beanDependencies.creatureIds.has(`${id}-2024`), `Bag of Beans embeds ${id}`);
}
const potionReferences = RULE_ITEMS.filter((item) => item.edition === "2024" && item.kind === "potion");
equal(potionReferences.length, 38, "Distinct reviewed 2024 potion variants");
assert(potionReferences.every((item) => beanDependencies.itemIds.has(item.id)), "Bean fruit resolves all reviewed potion variants");
for (const creature of ["aberrant", "draconic", "bestial", "construct", "fey", "elemental"]) {
  assert(cubeDependencies.creatureIds.has(`${creature}-spirit-2024`), `Cube embeds ${creature} spirit`);
}
assert(teleportDependencies.spellIds.has("teleport-2024"), "Helm resolves Teleport");
for (const kind of ["circle", "object", "familiar", "casual", "once", "false", "direction"]) {
  assert(teleportDependencies.tableIds.has(`teleport-${kind}-2024`), `Teleport resolves ${kind} table`);
}
assert(randomEffectForRoll(RANDOM_EFFECT_TABLES.find((t) => t.id === "teleport-familiar-2024")!, 14)?.subtable?.die === 8, "Teleport off-target includes direction table");
const referenceGraph = new Map<string, string[]>();
const robeDependencies = collectRuleDependencies([{itemReferenceIds:["robe-of-useful-items-2024"]}]);
assert(robeDependencies.itemIds.has("potion-of-healing-2024") && robeDependencies.itemIds.has("spell-scroll-3-2024"), "Robe table includes item dependencies for sheet and PDF");
assert(robeDependencies.creatureIds.has("riding-horse-2024") && robeDependencies.creatureIds.has("mastiff-2024"), "Robe table includes creature dependencies for sheet and PDF");
for (const spell of SPELLS) referenceGraph.set(`spell:${spell.id}`, [
  ...(spell.spellReferenceIds ?? []).map(id => `spell:${id}`),
  ...(spell.creatureReferenceIds ?? []).map(id => `creature:${id}`),
  ...(spell.itemReferenceIds ?? []).map(id => `item:${id}`),
  ...(spell.randomTableId ? [`table:${spell.randomTableId}`] : []),
  ...(spell.randomTableIds ?? []).map((id) => `table:${id}`),
]);
for (const creature of RULE_CREATURES) referenceGraph.set(`creature:${creature.id}`, [
  ...(creature.spellIds ?? []).map(id => `spell:${id}`),
  ...(creature.creatureIds ?? []).map(id => `creature:${id}`),
]);
for (const item of RULE_ITEMS) {
  assert(item.rules.ru.trim().length > 0 && item.rules.en.trim().length > 0, `Complete item reference: ${item.id}`);
  assert(item.spellIds?.every(id => SPELLS.some(spell => spell.id === id && spell.editions.includes(item.edition))) ?? true, `Item spell edition: ${item.id}`);
  referenceGraph.set(`item:${item.id}`, [
    ...(item.spellIds ?? []).map(id => `spell:${id}`),
    ...(item.creatureIds ?? []).map(id => `creature:${id}`),
    ...(item.randomTableId ? [`table:${item.randomTableId}`] : []),
  ]);
}
function registerTableDependencies(table: RandomEffectTable) {
  referenceGraph.set(`table:${table.id}`, table.rows.flatMap(row => [
    ...(row.spellIds ?? []).map(id => `spell:${id}`),
    ...(row.creatureIds ?? []).map(id => `creature:${id}`),
    ...(row.itemIds ?? []).map(id => `item:${id}`),
    ...(row.subtable ? [`table:${row.subtable.id}`] : []),
  ]));
  table.rows.forEach(row => { if (row.subtable) registerTableDependencies(row.subtable); });
}
RANDOM_EFFECT_TABLES.forEach(registerTableDependencies);
const finishedReferences = new Set<string>();
function visitReference(id: string, ancestors = new Set<string>()) {
  assert(referenceGraph.has(id), `Missing bundled dependency: ${id}`);
  assert(!ancestors.has(id), `Recursive UI dependency cycle: ${[...ancestors, id].join(" -> ")}`);
  if (finishedReferences.has(id)) return;
  for (const next of referenceGraph.get(id)!) visitReference(next, new Set([...ancestors, id]));
  finishedReferences.add(id);
}
for (const id of referenceGraph.keys()) visitReference(id);
const cauldronDependencies = collectRuleDependencies([{ spellReferenceIds: ["tashas-bubbling-cauldron-2024"] }]);
assert(cauldronDependencies.itemIds.size === 16, "Cauldron exports every bundled eligible potion");
assert(cauldronDependencies.spellIds.has("dragons-breath-2024"), "Cauldron -> potion -> spell closure");
assert(cauldronDependencies.tableIds.has("potion-resistance-2024"), "Cauldron -> potion -> table closure");
const surgeDependencies = collectRuleDependencies([{ randomTableId: "sorcerer-wild-2014" }]);
assert(surgeDependencies.creatureIds.has("monodrone-2014") && surgeDependencies.spellIds.has("fireball-2014"), "Tables contribute both creature and spell dependencies before PDF sections render");

for (const edition of ["2014", "2024"] as const) {
  const prepared = ARTIFICER_SUBCLASSES.filter(s => s.editions.includes(edition));
  assert(prepared.length === (edition === "2014" ? 4 : 6), `Prepared Artificer inventory ${edition}`);
  for (const subclass of prepared) {
    equal(ARTIFICER_FEATURE_EN[edition][subclass.id].length, subclass.features.length, `English feature coverage ${edition}/${subclass.id}`);
    assert(subclass.features.every(f => f.originalDescription && !f.originalDescription.endsWith("…")), "All Artificer features have full English mechanics");
    const references = collectRuleDependencies([
      ...subclass.features,
      { spellReferenceIds: (subclass.grants ?? []).flatMap(([,ids]) => ids.map(id => `${id}-${edition}`)) },
    ]);
    for (const id of references.spellIds) assert(SPELLS.some(s => s.id === id && s.editions.includes(edition)), `Prepared Artificer dependency ${subclass.id}/${id}`);
    for (const id of references.creatureIds) assert(RULE_CREATURES.some(c => c.id === id && c.edition === edition), `Prepared Artificer creature ${id}`);
    for (const id of references.itemIds) assert(RULE_ITEMS.some(item => item.id === id && item.edition === edition), `Prepared Artificer item ${id}`);
  }
}

const infusionDependencies = collectRuleDependencies([{itemReferenceIds:["infusion-homunculus-servant-2014"]}]);
assert(infusionDependencies.creatureIds.has("homunculus-servant-2014") && infusionDependencies.spellIds.has("mending-2014"), "Infusion -> creature and spell closure");

{
  const d = build("2014", "artificer", 15, "artillerist");
  assert(!getFeatureChoices(d, 14).some(group => group.id === "second-cannon-mode"), "Second cannon is unavailable before level fifteen");
  d.levels[14].featureChoices!["cannon-mode"] = ["protector"];
  d.levels[14].featureChoices!["second-cannon-mode"] = ["protector"];
  equal(validateDraft(d).length, 0, "Both cannons can use the same type");
  d.levels[14].featureChoices!["second-cannon-mode"] = ["none"];
  equal(validateDraft(d).length, 0, "Second cannon need not be created");
  d.levels[14].featureChoices!["second-cannon-mode"] = ["unknown"];
  assert(validateDraft(d).length > 0, "Unknown second cannon type rejected");
  assert(!getFeatureChoices(build("2024", "artificer", 15, "artillerist"), 15).some(group => group.id === "second-cannon-mode"), "Revised cannon chooses its mode at activation, not creation");
}

const jug=RULE_ITEMS.find(item=>item.id==="alchemy-jug-2014")!;
assert(jug.table?.rows.length === 10, "Alchemy Jug contains all ten liquid quotas");
for (const item of RULE_ITEMS) if (item.table) assert(item.table.rows.every(row=>row.length===item.table!.columns.length && row.every(cell=>cell.ru && cell.en)), `Complete bilingual item table: ${item.id}`);
for (const [edition, counts] of [["2014", [[6,8],[10,21],[14,12]]], ["2024", [[6,22],[10,10],[14,6]]]] as const) {
  for (const [level, count] of counts)
    equal((edition === "2024" ? ARTIFICER_REPLICAS_2024_HIGH : RULE_ITEMS).filter(i => i.edition === edition && i.replicationLevel === level).length, count, `Named replica table ${edition}/${level}`);
}
{
  const d = build("2024", "artificer", 10, "armorer");
  const bad = structuredClone(d);
  delete bad.levels[8].featureChoices!["artificer-armor-plan"];
  assert(validateDraft(bad).length > 0, "Armorer extra armor plan is mandatory at nine");
  const next = d.levels[9].featureChoices!;
  const groups = getLevelOptions(d, 10).featureChoiceOptions;
  const occupied = [...next["artificer-plans"], ...next["artificer-armor-plan"]];
  const armor = groups.find(g => g.id === "artificer-armor-plan")!.options.find(o => !occupied.includes(o.id))!;
  const ordinary = groups.find(g => g.id === "artificer-plans")!.options.find(o => !occupied.includes(o.id) && o.id !== armor.id)!;
  next["artificer-armor-plan"] = [armor.id];
  next["artificer-plans"][0] = ordinary.id;
  assert(validateDraft(d).some(i => i.code === "plan-replacement"), "Combined normal and armor plans permit only one replacement per level");
}

for (const edition of ["2014", "2024"] as const) {
  const d = build(edition, "artificer", 20, "alchemist");
  equal(getLevelOptions(d, 1).spellSlots[0], 2, "Artificer casts at first level in both editions");
  for (const [level, expected] of [[1,2],[4,2],[9,2],[10,3],[13,3],[14,4],[20,4]])
    equal(getLevelOptions(d, level).cantripCount, expected, `Artificer cantrip progression ${edition}/${level}`);
  equal(grantedSpellIds(d, 1).includes(`mending-${edition}`), edition === "2024", "Only revised Artificer gains free Mending");
  const groupId = edition === "2014" ? "artificer-infusions" : "artificer-plans";
  equal(getLevelOptions(d, 2).featureChoiceOptions.find(g => g.id === groupId)!.count, 4, "Four initial formulas");
  equal(getLevelOptions(d, 20).featureChoiceOptions.find(g => g.id === groupId)!.count, edition === "2014" ? 12 : 8, "Final formulas follow edition");
  const corrupted = structuredClone(d);
  corrupted.levels[1].featureChoices![groupId].pop();
  assert(validateDraft(corrupted).length > 0, "Missing formula is invalid");
  const stored = getLevelOptions(d, 11).featureChoiceOptions.find(g => g.id === "artificer-stored-magic")!;
  assert(stored.options.some(o => o.id === `cure-wounds-${edition}`), "Action spell may be stored");
  assert(!stored.options.some(o => o.id === `revivify-${edition}`), "Revivify excluded: old circle limit or new consumed component");
  equal(stored.options.some(o => o.id === `dispel-magic-${edition}`), edition === "2024", "Third-circle storage only in 2024");
  const storedOnly = stored.options.find(o => o.id !== "none" && !grantedSpellIds(d, 11).includes(o.id))!;
  d.levels[10].featureChoices!["artificer-stored-magic"] = [storedOnly.id];
  assert(!grantedSpellIds(d, 11).includes(storedOnly.id), "Storing a spell does not grant it as prepared");
}
{
  const d = build("2014", "artificer", 2);
  const pool = d.levels[1].featureChoices!["artificer-infusions"];
  pool[0] = "arcane-propulsion-armor";
  assert(validateDraft(d).length > 0, "Level 14 infusion unavailable at level 2");
}
{
  const d = build("2024", "artificer", 10, "reanimator");
  const before = d.levels[8].featureChoices!["companion-modifications"];
  const alternatives = getLevelOptions(d, 10).featureChoiceOptions.find(g => g.id === "companion-modifications")!.options.filter(o => !before.includes(o.id));
  assert(alternatives.length >= 2, "Reanimation has two replacement candidates");
  d.levels[9].featureChoices!["companion-modifications"] = alternatives.slice(0,2).map(o=>o.id);
  equal(validateDraft(d), [], "Recreating a companion can replace all modifications");
}
