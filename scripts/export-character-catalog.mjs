import fs from "node:fs";
import { loadCharacterRules } from "./character-rules-runtime.mjs";
const runtime = loadCharacterRules();
try {
  const r = runtime.rules;
  const data = {
    classes: r.CLASSES,
    species: r.SPECIES,
    backgrounds: r.BACKGROUNDS,
    feats: r.FEATS,
    spells: r.SPELLS,
    skills: r.SKILLS,
    progression: [],
    validationFixtures: [],
    choiceRules: {},
  };
  for (const edition of ["2014", "2024"])
    for (const cls of r.CLASSES) {
      const draft = { ...r.createDefaultDraft(edition), classId: cls.id };
      data.progression.push({
        edition,
        classId: cls.id,
        levels: Array.from({ length: 20 }, (_, i) => {
          const o = r.getLevelOptions(draft, i + 1);
          return {
            ...o,
            spellIds: o.spells.map((s) => s.id),
            cantripIds: o.cantrips.map((s) => s.id),
            prepareFormula:
              edition === "2014"
                ? cls.id === "paladin" && i > 0
                  ? "half-level+modifier"
                  : ["cleric", "druid", "wizard"].includes(cls.id)
                    ? "class-level+modifier"
                    : ""
                : "",
            spells: undefined,
            cantrips: undefined,
            features: undefined,
            featureChoiceOptions: undefined,
          };
        }),
      });
    }
  function fixture(
    edition,
    classId,
    level,
    speciesId = "human",
    backgroundId = edition === "2024" ? "soldier" : "acolyte",
    humanFeat,
  ) {
    const d = {
      ...r.createDefaultDraft(edition),
      classId,
      targetLevel: level,
      speciesId,
      backgroundId,
      name: `Проверка ${classId}`,
      playerName: "Игрок",
    };
    const species = r.SPECIES.find(
      (s) => s.id === speciesId && s.editions.includes(edition),
    );
    const background = r.BACKGROUNDS.find(
      (b) => b.id === backgroundId && b.editions.includes(edition),
    );
    const cls = r.CLASSES.find((c) => c.id === classId);
    d.abilityBonuses = Object.fromEntries(
      r.ABILITIES.map((a) => [
        a,
        edition === "2014" ? (species.bonuses2014[a] ?? 0) : 0,
      ]),
    );
    if (edition === "2014" && species.flexibleBonuses2014) {
      d.abilityBonuses.str++;
      d.abilityBonuses.con++;
    }
    if (edition === "2024") {
      d.abilityBonuses[background.abilities2024[0]] = 2;
      d.abilityBonuses[background.abilities2024[1]] = 1;
    }
    const speciesSkills =
      edition === "2014" && speciesId === "high-elf"
        ? ["perception"]
        : speciesId === "half-orc"
          ? ["intimidation"]
          : [];
    d.skillIds = cls.skillIds
      .filter(
        (id) =>
          !background.skillIds.includes(id) && !speciesSkills.includes(id),
      )
      .slice(0, cls.skillCount);
    for (let n = 1; n <= level; n++) {
      if (n === 1 && humanFeat)
        d.levels.push({
          level: 1,
          spellIds: [],
          cantripIds: [],
          featureChoices: { "human-feat": [humanFeat] },
        });
      const choice = r.recommendLevelChoices(d, n);
      d.levels = d.levels.filter((l) => l.level !== n);
      d.levels.push(choice);
    }
    const issues = r.validateDraft(d),
      stats = r.deriveCharacter(d);
    const name = [edition, classId, level, speciesId, backgroundId, humanFeat]
      .filter(Boolean)
      .join(" ");
    const featureRequirements = d.levels.map((l) => ({
      level: l.level,
      choices: r.getFeatureChoices(d, l.level),
    }));
    for (const entry of featureRequirements)
      for (const group of entry.choices) {
        data.choiceRules[group.id] ??= { optionIds: [] };
        data.choiceRules[group.id].optionIds = [
          ...new Set([
            ...data.choiceRules[group.id].optionIds,
            ...group.options.map((o) => o.id),
          ]),
        ];
      }
    data.validationFixtures.push({
      name,
      draft: d,
      valid: issues.length === 0,
      stats,
      featureRequirements,
    });
    if (issues.length)
      throw new Error(
        `Invalid generated fixture ${name}: ${JSON.stringify(issues)}`,
      );
  }
  for (const edition of ["2014", "2024"])
    for (const cls of r.CLASSES)
      for (const level of [1, 5, 20]) fixture(edition, cls.id, level);
  for (const edition of ["2014", "2024"])
    for (const species of r.SPECIES.filter((s) => s.editions.includes(edition)))
      fixture(edition, "fighter", 5, species.id);
  for (const edition of ["2014", "2024"])
    for (const background of r.BACKGROUNDS.filter((b) =>
      b.editions.includes(edition),
    ))
      fixture(edition, "wizard", 5, "human", background.id);
  for (const feat of [
    "magic-initiate-cleric",
    "magic-initiate-druid",
    "magic-initiate-wizard",
  ])
    fixture("2024", "fighter", 1, "human", "soldier", feat);
  const output = new URL(
    "../apps/server/internal/httpapi/character_catalog.json",
    import.meta.url,
  );
  const serialized = JSON.stringify(data);
  if (process.argv.includes("--check")) {
    if (
      !fs.existsSync(output) ||
      fs.readFileSync(output, "utf8") !== serialized
    ) {
      throw new Error(
        "Character rules and server catalogue differ. Run npm run generate:character-catalog and commit the updated snapshot.",
      );
    }
    console.log(
      `Server catalogue is in sync: ${data.spells.length} spells and ${data.validationFixtures.length} valid parity fixtures.`,
    );
  } else {
    fs.writeFileSync(output, serialized);
    console.log(
      `Exported ${data.spells.length} edition-specific spells, ${data.progression.length} progression tables and ${data.validationFixtures.length} valid parity fixtures.`,
    );
  }
} finally {
  runtime.cleanup();
}
