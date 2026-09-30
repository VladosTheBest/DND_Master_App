import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

/** Load the browser's actual rules in Node, without a second implementation. */
export function loadCharacterRules(includeTests = false) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "dnd-character-rules-"),
  );
  const sourceDirectory = new URL(
    "../apps/web/src/features/characters/",
    import.meta.url,
  );
  for (const name of [
    "personality",
    "subclasses",
    "paladin-subclasses",
    "barbarian-subclasses",
    "bard-subclasses",
    "cleric-subclasses",
    "sorcerer-subclasses",
    "wizard-subclasses",
    "fighter-subclasses",
    "monk-subclasses",
    "rogue-subclasses",
    "ranger-subclasses",
    "druid-subclasses",
    "druid-feature-translations",
    "warlock-subclasses",
    "warlock-feature-translations",
    "warlock-pacts",
    "pact-familiars",
    "random-effect-tables",
    "bard-spirit-tables",
    "rule-creatures",
    "animals-2024",
    "animals-2014",
    "beast-forms-2024",
    "beast-forms-2014",
    "familiar-beasts-2024",
    "familiar-beasts-2014",
    "rule-items",
    "additional-potions-2024",
    "rule-dependencies",
    "rule-conditions",
    "paladin-spells",
    "cleric-spells",
    "sorcerer-spells",
    "wizard-spells",
    "warlock-spells",
    "artificer-spells",
    "artificer-subclasses",
    "artificer-feature-translations",
    "artificer-rules",
    "artificer-infusions",
    "artificer-replicas",
    "artificer-replicas-high",
    "artificer-replicas-2024-high",
    "artificer-replicas-2024",
    "artificer-replicas-2024-common",
    "artificer-replicas-2024-general",
    "artificer-spell-lists",
    "extended-spells",
    "spell-names-ru",
    "spell-summaries-ru",
    "spell-reference-translations",
    "spell-metadata",
    "choice-help",
    "feature-reference",
    "feature-help",
    "ability-controls",
    "rules-data",
    "rules",
    ...(includeTests ? ["rules.test"] : []),
  ]) {
    const source = fs.readFileSync(
      new URL(`${name}.ts`, sourceDirectory),
      "utf8",
    );
    const compiled = ts.transpileModule(source, {
      fileName: `${name}.ts`,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    });
    fs.writeFileSync(path.join(directory, `${name}.js`), compiled.outputText);
  }
  const require = createRequire(import.meta.url);
  return {
    rules: require(path.join(directory, "rules.js")),
    runTests: () => require(path.join(directory, "rules.test.js")),
    cleanup: () => {
      const resolved = fs.realpathSync(directory);
      const tempRoot = fs.realpathSync(os.tmpdir());
      if (
        path.dirname(resolved) !== tempRoot ||
        !path.basename(resolved).startsWith("dnd-character-rules-")
      ) {
        throw new Error(
          "Refusing to remove an unexpected rules compilation directory.",
        );
      }
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}
