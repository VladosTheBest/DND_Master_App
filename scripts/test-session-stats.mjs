import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL(
    "../apps/web/src/features/sessions/session-stats.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { parseSessionText, speakerStatistics, highlightedParts } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const text =
  "Quill — demo\nСобытия и возможные пропуски:\n- 00:00:00.000 pause\nРасшифровка:\n[00:00:01.000–00:00:06.000] Арина: Иду к мосту.\n[00:00:04.000–00:00:08.000] Михаил: Я рядом.\n[00:00:05.000–00:00:10.000] Арина: Проверяю верёвку.\nОна крепкая.\n[00:00:11.000–00:00:12.000] Мастер: Всё спокойно.";
const entries = parseSessionText(text);
assert.equal(entries.length, 4);
assert.match(entries[2].text, /Она крепкая/);
const stats = speakerStatistics(entries, "Мастер");
assert.equal(stats.length, 2);
assert.equal(stats.find((s) => s.name === "Арина").seconds, 9);
assert.equal(stats.find((s) => s.name === "Михаил").seconds, 4);
assert.ok(Math.abs(stats.reduce((n, s) => n + s.timeShare, 0) - 100) < 1e-8);
assert.ok(Math.abs(stats.reduce((n, s) => n + s.wordShare, 0) - 100) < 1e-8);
assert.equal(
  highlightedParts("Мост и ещё МОСТ", "мост").filter((p) => p.match).length,
  2,
);
assert.equal(parseSessionText("Обычный текст")[0].start, null);
assert.equal(
  speakerStatistics(parseSessionText("Обычный текст"))[0].seconds,
  0,
);
assert.equal(
  parseSessionText("[00:00:09.000–00:00:01.000] Имя: Фраза.")[0].start,
  null,
);
console.log(
  "PASS: transcript parsing, multiline speech, overlap union, GM exclusion, percentage totals, plain text and Cyrillic highlighting.",
);
