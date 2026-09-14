import {
  ABILITIES,
  BACKGROUNDS,
  CLASSES,
  SPELLS,
  createDefaultDraft,
  deriveCharacter,
  finalAbilities,
  getLevelOptions,
  pointBuySpent,
  recommendLevelChoices,
  validateDraft,
  type CharacterDraft,
  type Edition,
} from "./rules";
import { adjustAbility } from "./ability-controls";
import { SKILL_HELP } from "./choice-help";

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
  for (let n = 1; n <= level; n++) d.levels.push(recommendLevelChoices(d, n));
  return d;
}
let checks = 0;
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
  SPELLS.filter((s) => s.editions.includes("2014")).length,
  319,
  "Complete 2014 SRD spell catalogue",
);
equal(
  SPELLS.filter((s) => s.editions.includes("2024")).length,
  339,
  "Complete 2024 SRD spell catalogue",
);
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
console.log(
  `Character rules: ${checks} class/edition/level checks and rule regression assertions passed.`,
);
