import fs from "node:fs";
import assert from "node:assert/strict";

const directory = new URL(
  "../apps/web/src/features/characters/",
  import.meta.url,
);
const inventory = JSON.parse(
  fs.readFileSync(new URL("source-inventory.json", directory), "utf8"),
);
const catalog = JSON.parse(
  fs.readFileSync(
    new URL(
      "../apps/server/internal/httpapi/character_catalog.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const aliases = {
  "2014:artificer": { "battle-smith": "battlesmith" },
  "2024:artificer": { cartographer: "сartographer" },
  "2024:cleric": {
    life: "life-domain",
    war: "war-domain",
    light: "light-domain",
    trickery: "trickery-domain",
    knowledge: "knowledge-domain",
    grave: "grave-domain",
    arcana: "arcana-domain",
  },
  "2024:monk": {
    "open-hand": "warrior-of-the-hand",
    "mystic-arts": "warrior-of-the-mystic-arts",
    shadow: "warrior-of-shadow",
    mercy: "warrior-of-mercy",
    elements: "warrior-of-the-elements",
  },
  "2024:paladin": {
    devotion: "oath-of-devotion",
    glory: "oath-of-glory",
    vengeance: "oath-of-vengeance",
    ancients: "oath-of-the-ancients",
    "noble-genies": "oath-of-the-noble-genies",
  },
  "2024:bard": {
    moon: "college-of-the-moon",
    spirits: "college-of-the-spirits",
  },
  "2024:sorcerer": {
    draconic: "draconic-sorcery",
    aberrant: "aberrant-sorcery",
    clockwork: "clockwork-sorcery",
    "wild-magic": "wild-magic-sorcery",
    spellfire: "spellfire-sorcery",
    shadow: "shadow-sorcery",
  },
  "2014:fighter": { "eldritch-knight": "eldritch-knigh" },
  "2024:fighter": { champion: "сhampion" },
  "2014:rogue": { assassin: "assasin" },
  "2024:warlock": {
    fiend: "fiend-patron",
    "great-old-one": "greate-old-one-patron",
    celestial: "celestial-patron",
    vestige: "vestige-patron",
  },
  "2024:wizard": {
    evocation: "evoker",
    illusion: "illusionist",
    necromancy: "necromancer",
    abjuration: "abjurer",
    enchantment: "enchanter",
    transmutation: "transmuter",
    conjuration: "conjurer",
    divination: "diviner",
    bladesinging: "bladesinger",
  },
  "2024:ranger": { hunter: "hunter-ranger", "beast-master": "beastmaster" },
};
let availableCount = 0;
const rows = inventory.classes.map((row) => {
  const available =
    catalog.classes
      .find((c) => c.id === row.id)
      ?.subclasses.filter((s) => s.editions.includes(row.edition)) ?? [];
  const mapping = aliases[`${row.edition}:${row.id}`] ?? {};
  const ids = available.map((s) => mapping[s.id] ?? s.id);
  const sourceIds = row.subclasses.map((s) =>
    s.id.split(".").slice(1).join("."),
  );
  for (const id of ids)
    assert(
      sourceIds.includes(id),
      `No source mapping: ${row.edition}/${row.id}/${id}`,
    );
  availableCount += available.length;
  const missing = row.subclasses.filter((s, i) => !ids.includes(sourceIds[i]));
  return `| ${row.edition} | [${row.id}](${row.url}) | ${available.length}/${row.subclasses.length} | ${missing.map((s) => `${s.name} (\`${s.id}\`)`).join("; ") || "—"} |`;
});
const report = `# Покрытие конструктора персонажей

Снимок источников: ${inventory.checkedAt}. Перечень dnd.su/next.dnd.su не является доказательством полноты всех изданных книг. UA и отмеченные неофициальные материалы исключены. Повторное издание специализации учитывается отдельно.

В каталоге ${availableCount} сочетаний специализации и редакции из ${inventory.classes.reduce((n, c) => n + c.subclasses.length, 0)} в снимке. «В каталоге» означает наличие варианта и таблицы прогрессии; это **не** подтверждение полной автоматизации его правил, переводов или всех обязательных выборов. Существующие SRD-варианты также требуют проверки полноты. Автоматические проверки описаны в SOURCES.md.

| Редакция | Класс / источник | В каталоге / источник | Отсутствуют в каталоге — полный список по снимку |
|---|---|---:|---|
${rows.join("\n")}

Работа приостановлена по просьбе пользователя 1 октября 2026 года. Общий запрос не завершён; точка продолжения и фактически выполненные проверки: [CHARACTER_BUILDER_HANDOFF.md](../../../../../docs/CHARACTER_BUILDER_HANDOFF.md).

## Открытые сквозные требования

- Обязательный UX-критерий: все необходимые правила доступны внутри сайта в RU/EN. Внешние ссылки служат только атрибуцией; ссылка вместо таблицы, состояния, формы, статблока призыва или описания зависимого заклинания означает незавершённую карточку.
- Встроенные таблицы дикой магии: варвар 2014 и чародей 2014/2024; отдельные истории духов барда 2014/2024 и Брешь в реальности 2014; косметические таблицы масок/происхождения монаха и даров/роя/драконьего происхождения следопыта, звёздных карт друида, типа джинна и сосуда колдуна, эликсиров алхимика и сопротивления зелья; вложенные диапазоны и описания RU/EN. 284 статблока существ из результатов, Танцующего предмета, теневой гончей, призываемых духов и скелетов/зомби и 15 состояний каждой редакции встроены в RU/EN. Для всех 658 SRD-заклинаний проверены полное русское описание и метаданные; это не закрывает каталоги существ и классовых умений. Проверять зависимости, а не только наличие таблицы.
- Аудит прежних карточек обнаружил внешние зависимости в Вызове аберрации/конструкта/элементаля, Теневой гончей и иных формах/призывах. Общий справочник состояний встроен; данные прочих существ/форм ещё не завершены.
- Повелитель зверей 2014 выбирает путь PHB или Tasha’s. PHB предлагает одиночных Зверей SRD 5.1 ПО ≤ 1/4 размером не больше Среднего; TS/Go исключают смешивание путей. КД, максимум хитов и добавляемый бонус мастерства текущего спутника отражены в листе/PDF. Дикий облик 2024 требует 4/6/8 текущих изученных форм; TS/Go проверяют тип, ПО, полёт с 8 уровня и повышенный ПО Луны. Встроены все 95 статблоков Animals SRD 5.2.1, включая 84 одиночных Зверя; все 86 отдельных Зверей SRD 5.1 доступны как виденные формы 2014 без обязательного количества, с проверкой ПО/плавания/полёта в TS/Go; формы других книг ещё не завершены. Четыре элементальных формы Луны 2014 встроены. Круг Земли 2014 включает Подземье; текущий сменяемый выбор местности 2024 после отдыха сохраняется отдельно и обновляет выдачи/сопротивление без переписывания прежних уровней.
- Колдун: Книга и Талисман 2014, Книга 2024 и обязательные выборы её заклинаний проверяются TS/Go; Цепь включает четыре особые формы 2014 и восемь 2024 с полными RU/EN-статблоками и зависимостями. Клинок/Цепь/Книга имеют полные RU/EN-правила; последние переводы базовых умений/Исчадия ещё не прошли отдельную визуальную проверку. Базовый каталог воззваний требует завершения предпосылок, повторных вариантов и замен; замены арканумов 2024 пока не реализованы; наличие всех покровителей из снимка не закрывает эти обязательные выборы.
- Изобретатель: класс 1–20 и 4/6 специализаций включены; TS/Go проверяют известные формулы, уровни, инструмент, замену повторного владения и хранящее заклинание. Встроены 15 инфузий, 128 реплик 2014 (49 именованных и 79 обычных из сверенного снимка); в 2024 — 252 схемы (53 именованные, 65 дополнительных обычных, 61 необычная и 73 редкие) уровней 2/6/10/14. Дополнительная схема Бронника и общий предел одной замены в TS/Go реализованы; умения и варианты специализаций описаны в RU/EN. Категории реплик сверенного снимка встроены; активные предметы, настройка и отдельные текущие боевые выборы остаются незавершёнными. Списки заклинаний (100/86), 44 новые карточки RU/EN, спутники/пушки и 38 вариантов зелий, включая котёл Таши, встроены.
- Виды/расы: полного сверенного перечня дополнительных книг ещё нет; выборы размеров, инструментов и языков требуют отдельного аудита. Наличие базового вида не подтверждает полноту его вариантов.
- Полный интерфейс RU/EN и полные проверенные описания правил на выбранном языке не завершены. Машинные кандидаты перевода не включены в продукт; локальная библиотека позволяет читать весь доступный каталог редакции, для непереведённых карточек явно показывает английский оригинал.
- Специальные ресурсы, состояния и призываемые существа в основном описаны текстом; боевое исполнение не автоматизировано. Отдельно проверять обязательные выборы при создании.
- TS/Go проверяются общими сохранёнными примерами, но общий зелёный прогон не доказывает полноту каталога. Новые варианты требуют проверок выдачи/доступности, уровней, расчётов и отсутствия механик чужой специализации.

Файл воспроизводится командой \`node scripts/character-coverage.mjs\` после обновления серверного каталога. \`--check\` проверяет актуальность без записи.
`;
const destination = new URL("COVERAGE.md", directory);
if (process.argv.includes("--check"))
  assert.equal(
    fs.readFileSync(destination, "utf8"),
    report,
    "Regenerate COVERAGE.md",
  );
else fs.writeFileSync(destination, report);
console.log(
  `Character coverage: ${availableCount} catalog combinations; source mappings verified.`,
);
