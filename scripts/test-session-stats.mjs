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
assert.equal(entries[0].fromLine, 5);
assert.equal(entries[2].toLine, 8);
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
const journalSource = await readFile(new URL("../apps/web/src/features/sessions/session-journal.ts", import.meta.url), "utf8");
const journalCompiled = ts.transpileModule(journalSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { classifySpeech, filterJournal, overlapsSource } = await import(`data:text/javascript;base64,${Buffer.from(journalCompiled).toString("base64")}`);
assert.equal(classifySpeech(entries[0], [{fromLine:5,toLine:6,kind:"game"}]), "game");
assert.equal(classifySpeech(entries[2], [{fromLine:7,toLine:7,kind:"game"},{fromLine:8,toLine:8,kind:"table"}]), "uncertain");
assert.equal(classifySpeech(entries[2], [{fromLine:7,toLine:7,kind:"game"}]), "uncertain");
assert.equal(classifySpeech(entries[2], [{fromLine:7,toLine:7,kind:"table"},{fromLine:8,toLine:8,kind:"table"}]), "table");
assert.equal(classifySpeech(entries[0]), "uncertain");
assert.equal(overlapsSource(entries[2], {fromLine:8,toLine:8}), true);
const cards = [
  {id:"a",kind:"loot",title:"Верёвка",detail:"Нашли у моста",locationId:"bridge",people:["Арина"],status:"confirmed"},
  {id:"b",kind:"loot",title:"Меч",detail:"Хотят купить",locationId:"town",people:[],status:"planned"},
  {id:"c",kind:"discovery",title:"Следы",detail:"Неизвестное место",people:[],status:"uncertain"},
];
assert.deepEqual(filterJournal(cards,{kind:"loot",location:"bridge",status:"confirmed",query:"АРИНА"}).map(e=>e.id), ["a"]);
assert.deepEqual(filterJournal(cards,{location:"__unknown"}).map(e=>e.id), ["c"]);
assert.equal(filterJournal(cards,{status:"planned",location:"bridge"}).length, 0);
assert.equal(filterJournal(cards,{}).length,3);
console.log("PASS: source line tracking, mixed/unclassified speech, source navigation and combined journal filters.");
