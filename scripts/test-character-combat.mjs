import assert from "node:assert/strict";
import fs from "node:fs";
import { loadCharacterRules } from "./character-rules-runtime.mjs";
const runtime = loadCharacterRules();
try {
  const { deriveCharacter } = runtime.rules,
    { deriveCombatSheet } = runtime.combat;
  const fixtures = JSON.parse(
    fs.readFileSync(
      "apps/server/internal/httpapi/character_catalog.json",
      "utf8",
    ),
  ).validationFixtures.filter((f) => f.valid);
  const seeds = new Map(
    fixtures.map((f) => [f.draft.edition + "/" + f.draft.classId, f.draft]),
  );
  const draft = (cls = "barbarian", level = 3, edition = "2014") => ({
    ...structuredClone(seeds.get(edition + "/" + cls)),
    targetLevel: level,
    speciesId: "dragonborn",
    abilities: { str: 16, dex: 14, con: 14, int: 12, wis: 12, cha: 14 },
    abilityBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    levels: Array.from({ length: level }, (_, i) => ({
      level: i + 1,
      spellIds: [],
      cantripIds: [],
      preparedSpellIds: [],
      featureChoices: i === 0 ? { ancestry: ["gold"] } : {},
    })),
    equipment: [],
    notes: "",
  });
  const pool = (c, name) => c.resources.find((r) => r.name === name)?.maximum;
  const serverSource=fs.readFileSync("apps/server/internal/httpapi/character_rules.go","utf8");
  const serverBases=serverSource.match(/!strings\.Contains\("(\|battleaxe[^"\n]+)"/)[1].split("|").filter(Boolean);
  const clientBases=[...new Set([...runtime.equipment.combatEquipmentCatalog("2014"),...runtime.equipment.combatEquipmentCatalog("2024")].map(i=>i.id))].sort();
  assert.deepEqual(serverBases,clientBases,"Server and browser equipment identifiers must agree");
  let count = 0;
  for (const seed of seeds.values())
    for (let level = 1; level <= 20; level++) {
      const d = draft(seed.classId, level, seed.edition),
        c = deriveCharacter(d),
        sheet = deriveCombatSheet(d, c);
      assert(Number.isFinite(sheet.armorClass) && sheet.speed >= 0);
      assert(sheet.attacks.length > 0);
      assert(
        sheet.resources.every(
          (r) =>
            r.maximum === null ||
            (Number.isInteger(r.maximum) && r.maximum >= 0),
        ),
      );
      for (const f of c.features)
        assert(
          !f.description.includes(d.edition === "2014" ? "2024" : "2014"),
          `${seed.classId} ${level}: ${f.name}`,
        );
      count++;
    }
  for (const { draft: d } of fixtures)
    for (const f of deriveCharacter(d).features)
      assert(
        !f.description.includes(d.edition === "2014" ? "2024" : "2014"),
        f.name,
      );
  let d = draft();
  d.levels[2].subclassId = "zealot";
  d.levels[2].featureChoices = { "zealot-damage": ["necrotic"] };
  d.equipment = [
    {
      name: "Именной клинок",
      quantity: 1,
      type: "weapon",
      baseItem: "greatsword",
      equipped: true,
    },
    {
      name: "Чешуя",
      quantity: 1,
      type: "equipment",
      baseItem: "scale",
      equipped: true,
    },
  ];
  let c = deriveCharacter(d),
    s = deriveCombatSheet(d, c);
  assert.equal(pool(s, "Ярость"), 3);
  assert.equal(s.armorClass, 14 + Math.min(2, c.modifiers.dex));
  assert.equal(s.attacks[0].hit, "+" + (c.modifiers.str + c.proficiencyBonus));
  assert.match(s.attacks[0].damage, /^2d6/);
  assert(
    s.effects
      .find((e) => e.name === "Божественный гнев")
      .text.includes("некротическим"),
  );
  assert(
    c.features
      .find((f) => f.name === "Ярость")
      .description.includes("3 использования"),
  );
  assert(
    !c.features
      .find((f) => f.ruleName === "Unarmored Defense")
      .description.includes("монах"),
  );
  assert.equal(
    s.attacks.find((a) => a.name === "Драконье дыхание").damage,
    "2d6",
  );
  assert.equal(pool(deriveCombatSheet(draft("barbarian", 20)), "Ярость"), null);
  assert.equal(
    pool(deriveCombatSheet(draft("barbarian", 20, "2024")), "Ярость"),
    6,
  );
  for (const edition of ["2014", "2024"]) {
    s = deriveCombatSheet(draft("fighter", 11, edition));
    assert.equal(s.attacksPerAction, 3);
    assert.equal(pool(s, "Второе дыхание"), edition === "2014" ? 1 : 4);
    assert.equal(
      pool(
        deriveCombatSheet(draft("monk", 11, edition)),
        edition === "2014" ? "Ци" : "Фокус",
      ),
      11,
    );
    assert.equal(
      pool(deriveCombatSheet(draft("paladin", 5, edition)), "Наложение рук"),
      25,
    );
    assert.equal(
      pool(
        deriveCombatSheet(draft("sorcerer", 9, edition)),
        "Очки чародейства",
      ),
      9,
    );
  }
  d = draft("fighter", 5);
  d.equipment = [
    { name: "Рапира", type: "weapon", quantity: 1 },
    { name: "Кольчуга", type: "equipment", quantity: 1, equipped: true },
    { name: "Щит", type: "equipment", quantity: 1, equipped: true },
  ];
  d.abilities.dex = 18;
  d.abilities.str = 10;
  s = deriveCombatSheet(d);
  c = deriveCharacter(d);
  assert.equal(s.armorClass, 18);
  assert.equal(s.speed, c.speed - 10);
  assert.equal(s.attacks[0].hit, "+" + (c.modifiers.dex + c.proficiencyBonus));
  d.equipment[1].equipped = false;
  assert.equal(deriveCombatSheet(d).armorClass, c.armorClass + 2);
  d = draft("fighter", 5, "2024");
  d.equipment = [
    {
      name: "Трезубец",
      type: "weapon",
      quantity: 1,
      twoHanded: true,
      magicBonus: 1,
    },
  ];
  assert.match(deriveCombatSheet(d).attacks[0].damage, /^1d10/);
  d.edition = "2014";
  assert.match(deriveCombatSheet(d).attacks[0].damage, /^1d8/);
  d = draft("warlock", 5);
  d.levels[4].cantripIds = ["eldritch-blast-2014"];
  d.levels[1].featureChoices = { invocations: ["agonizing-blast"] };
  c = deriveCharacter(d);
  s = deriveCombatSheet(d);
  assert.equal(
    s.attacks.find((a) => a.source === "spell").damage,
    `2 × (1d10 +${c.modifiers.cha})`,
  );
  assert.equal(pool(s, "Ячейки договора · 3 круг"), 2);
  d = draft("fighter", 7);
  d.levels[2].subclassId = "battlemaster";
  assert.equal(pool(deriveCombatSheet(d), "Кости превосходства"), 5);
  d = draft();
  d.equipment = [{ name: "Неизвестный клинок", type: "weapon", quantity: 1 }];
  s = deriveCombatSheet(d);
  assert(s.warnings.some((w) => w.includes("базовый предмет")));
  assert(!s.attacks.some((a) => a.name === "Неизвестный клинок"));
  assert(!runtime.equipment.isEquipmentCombatSettings({ magicBonus: 99 }));
  assert(
    !runtime.equipment.isEquipmentCombatSettings({ attackAbility: "bad" }),
  );
  console.log(
    `Combat: ${count} class/edition/level cases; ${fixtures.length} saved fixtures; armor, weapons, rage, pools, spell scaling and edition isolation verified.`,
  );
} finally {
  runtime.cleanup();
}
