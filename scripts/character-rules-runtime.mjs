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
    "spell-names-ru",
    "spell-summaries-ru",
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
