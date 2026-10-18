const assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
(async () => {
  if (!process.env.FOUNDRY_TEST_URL)
    throw Error("Set FOUNDRY_TEST_URL to a disposable world.");
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(process.env.FOUNDRY_TEST_URL);
    await page.locator("input[name=username]").fill("Gamemaster");
    await page.locator("button[name=join]").click();
    await page.waitForFunction(() => globalThis.game?.ready);
    const files = [
      {
        actor: JSON.parse(
          await fs.readFile("tmp/character-export-qa/actor.json", "utf8"),
        ),
        macro: JSON.parse(
          await fs.readFile(
            "tmp/character-export-qa/import-macro.json",
            "utf8",
          ),
        ),
      },
      ...(await Promise.all(
        ["2014", "2024"].map(async (e) =>
          JSON.parse(
            await fs.readFile(
              `tmp/character-export-qa/wizard-${e}.json`,
              "utf8",
            ),
          ),
        ),
      )),
    ];
    const results = await page.evaluate(async (files) => {
      const out = [];
      for (const file of files) {
        const before = new Set(game.actors.keys());
        let macro;
        try {
          const direct = await Actor.create(file.actor);
          out.push({
            kind: "direct",
            type: direct.type,
            edition: direct.flags["shadow-edge-gm"].edition,
            hp: direct.system.attributes.hp.max,
            ac: direct.system.attributes.ac.value,
            itemCount: direct.items.size,
            portrait: direct.img.startsWith("data:image/jpeg;"),
          });
          await direct.delete();
          macro = await Macro.create(file.macro);
          await macro.execute();
          const created = game.actors.find((a) => !before.has(a.id));
          if (!created) throw Error("Macro created no actor");
          const spells = created.items.filter((i) => i.type === "spell"),
            weapons = created.items.filter((i) => i.type === "weapon");
          out.push({
            kind: "macro",
            portrait: created.img.startsWith("worlds/"),
            edition: created.flags["shadow-edge-gm"].edition,
            hp: created.system.attributes.hp.max,
            classLevels: created.items.find((i) => i.type === "class")?.system
              .levels,
            slots: created.system.spells.spell1.max,
            spells: spells.length,
            spellsWithActivities: spells.filter(
              (i) => i.system.activities.size > 0,
            ).length,
            weapons: weapons.length,
            configuredWeapons: weapons.filter(i=>i.flags["shadow-edge"]?.attackAbility).map(i=>({name:i.name,magic:i.system.magicalBonus,equipped:i.system.equipped,proficient:i.system.proficiencyMultiplier,abilities:[...i.system.activities.values()].filter(a=>a.type === "attack").map(a=>a.attack.ability)})),
            weaponProficiencies: weapons.map(i => i.system.proficiencyMultiplier),
              weaponActivities: weapons.reduce(
              (n, i) => n + i.system.activities.size,
              0,
            ),
          });
        } finally {
          for (const actor of game.actors.filter((a) => !before.has(a.id)))
            await actor.delete();
          if (macro) await macro.delete();
          for (const app of Object.values(ui.windows))
            if (app instanceof Dialog) await app.close();
        }
      }
      return out;
    }, files);
    for (const row of results) {
      assert(row.hp > 0);
      if (row.kind === "macro") {
        assert(row.classLevels > 0);
        if (row.spells) assert(row.spellsWithActivities > 0);
        for(const weapon of row.configuredWeapons || []) {
          assert.equal(Number(weapon.magic),2); assert.equal(weapon.equipped,true); assert.equal(weapon.proficient,1); assert(weapon.abilities.length && weapon.abilities.every(a=>a === "cha"));
        }
        if (row.weapons) {
          assert(row.weaponActivities > 0);
          assert(row.weaponProficiencies.every(p => p === 1));
          assert(row.portrait);
        }
      }
    }
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
