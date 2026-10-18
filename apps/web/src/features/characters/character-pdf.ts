import { jsPDF } from "jspdf";
import { personalityEntries } from "./personality";
import {
  randomEffectTable,
  type RandomEffectTable,
} from "./random-effect-tables";
import { conditionsForEdition } from "./rule-conditions";
import { spellMetadata } from "./spell-metadata";
import { collectRuleDependencies } from "./rule-dependencies";
import { ruleItem } from "./rule-items";
import { ruleCreature } from "./rule-creatures";
import {
  ABILITIES,
  ABILITY_LABELS,
  SPELLS,
  deriveCharacter,
  currentLandTerrain,
  type CharacterDraft,
} from "./rules";

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const clean = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** Illustrated book with searchable Cyrillic and flowing rules appendices. */
export function createCharacterPdf(draft: CharacterDraft, fontBase64: string) {
  const c = deriveCharacter(draft);
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  pdf.addFileToVFS("DejaVuSans.ttf", fontBase64);
  pdf.addFont("DejaVuSans.ttf", "Character", "normal");
  pdf.setFont("Character");
  pdf.setProperties({
    title: clean(`${draft.name || "Персонаж"} — D&D ${draft.edition}`),
    author: "Shadow Edge GM",
    subject: "Лист персонажа",
  });
  const left = 16,
    width = 178,
    bottom = 278;
  const background = () => {
    pdf.setFillColor("#100e18");
    pdf.rect(0, 0, 210, 297, "F");
    pdf.setDrawColor("#59436e");
    pdf.line(16, 23, 194, 23);
    pdf.setTextColor("#b898e8");
    pdf.setFontSize(8);
    pdf.text("SHADOW EDGE GM  /  КНИГА ПЕРСОНАЖА", 16, 16);
  };
  background();
  let y = 35;
  const page = () => {
    pdf.addPage();
    background();
    y = 35;
  };
  const room = (height: number) => {
    if (y + height > bottom) page();
  };
  const paragraph = (value: string, size = 9, color = "#f5f0fa") => {
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lineHeight = size * 0.48;
    for (const sourceLine of clean(value).split("\n")) {
      const lines: string[] = pdf.splitTextToSize(sourceLine || " ", width);
      for (const line of lines) {
        room(lineHeight);
        pdf.setFontSize(size);
        pdf.setTextColor(color);
        pdf.text(line, left, y);
        y += lineHeight;
      }
    }
    y += 2;
  };
  const section = (title: string) => {
    room(22);
    y += 4;
    pdf.setDrawColor("#a18a60");
    pdf.line(left, y, left + width, y);
    y += 7;
    paragraph(title, 16, "#e7c27e");
  };
  const entry = (title: string, description: string) => {
    room(18);
    pdf.setFillColor("#241c32");
    pdf.roundedRect(left - 2, y - 4, width + 4, 8, 1, 1, "F");
    paragraph(title, 10, "#b898e8");
    paragraph(description);
  };
  const columns = (values: string[]) => {
    const rows = Math.ceil(values.length / 2);
    for (let row = 0; row < rows; row++) {
      room(6);
      pdf.setFontSize(9);
      pdf.setTextColor("#f5f0fa");
      pdf.text(values[row], left, y);
      if (values[row + rows])
        pdf.text(values[row + rows], left + width / 2 + 2, y);
      y += 5;
    }
    y += 2;
  };
  paragraph(draft.name || "Новый персонаж", 32, "#b898e8");
  paragraph(
    `D&D ${draft.edition} · ${c.class?.name || ""} · уровень ${c.level}`,
    12,
  );
  paragraph(
    `${c.species?.name || ""} · ${c.background?.name || ""}${c.subclass ? ` · ${c.subclass.name}` : ""}`,
  );
  if (draft.playerName) paragraph(`Игрок: ${draft.playerName}`);
  y += 6;
  if (draft.portrait) {
    const props = pdf.getImageProperties(draft.portrait);
    const side = 132,
      h = Math.min(
        142,
        Math.max(35, bottom - y - 45),
        (side * props.height) / props.width,
      ),
      w = (h * props.width) / props.height;
    pdf.addImage(draft.portrait, "JPEG", (210 - w) / 2, y, w, h);
    y += h + 10;
  } else {
    pdf.setDrawColor("#b898e8");
    pdf.circle(105, y + 56, 42);
    pdf.setFontSize(58);
    pdf.setTextColor("#e7c27e");
    pdf.text((draft.name || "?").slice(0, 1).toUpperCase(), 105, y + 64, {
      align: "center",
    });
    y += 118;
  }
  const metrics = [
    ["ЗДОРОВЬЕ", String(c.maxHp)],
    ["КЛАСС ДОСПЕХА", String(c.armorClass)],
    ["ИНИЦИАТИВА", sign(c.initiative)],
    ["СКОРОСТЬ", `${c.speed} фт.`],
  ];
  metrics.forEach(([label, value], i) => {
    const x = left + i * 45;
    pdf.setFillColor("#241c32");
    pdf.roundedRect(x, y, 43, 31, 3, 3, "F");
    pdf.setFontSize(7);
    pdf.setTextColor("#b0a5be");
    pdf.text(label, x + 21.5, y + 9, { align: "center" });
    pdf.setFontSize(19);
    pdf.setTextColor("#f5f0fa");
    pdf.text(value, x + 21.5, y + 23, { align: "center" });
  });
  page();
  section("Боевой лист");
  room(28);
  for (const [index, id] of ABILITIES.entries()) {
    const x = left + (index * width) / 6;
    pdf.setDrawColor("#59436e");
    pdf.roundedRect(x, y, width / 6 - 2, 23, 2, 2);
    pdf.setFontSize(8);
    pdf.setTextColor("#e7c27e");
    pdf.text(ABILITY_LABELS[id], x + (width / 6 - 2) / 2, y + 5, {
      align: "center",
    });
    pdf.setFontSize(16);
    pdf.setTextColor("#b898e8");
    pdf.text(String(c.abilities[id]), x + (width / 6 - 2) / 2, y + 13, {
      align: "center",
    });
    pdf.setFontSize(9);
    pdf.text(sign(c.modifiers[id]), x + (width / 6 - 2) / 2, y + 19, {
      align: "center",
    });
  }
  y += 30;
  paragraph(
    `Хиты: ${c.maxHp} · КД без доспехов: ${c.armorClass} · Инициатива: ${sign(c.initiative)} · Скорость: ${c.speed} фт.`,
  );
  paragraph(
    `Бонус мастерства: ${sign(c.proficiencyBonus)} · Кости хитов: ${c.hitDice} · Пассивная внимательность: ${c.passivePerception}`,
  );
  section("Спасброски");
  columns(
    c.savingThrows.map(
      (s) => `${s.name}: ${sign(s.bonus)}${s.proficient ? " (владение)" : ""}`,
    ),
  );
  section("Навыки");
  columns(
    c.skills.map(
      (s) => `${s.name}: ${sign(s.bonus)}${s.proficient ? " (владение)" : ""}`,
    ),
  );
  page();
  section("Способности · происхождение и черты");
  const terrain = currentLandTerrain(draft);
  if (terrain)
    paragraph(
      `Местность / Land: ${terrain.ru} / ${terrain.en}${draft.targetLevel >= 10 ? ` · Сопротивление / Resistance: ${terrain.resistance}` : ""}`,
    );
  c.traits.forEach((t) => paragraph(t));
  c.feats.forEach((f) => entry(f.name, f.description));
  section("Развитие по уровням");
  const {
    spellIds: referenceSpellIds,
    creatureIds: referenceCreatureIds,
    itemIds: referenceItemIds,
  } = collectRuleDependencies([
    ...c.features,
    {
      spellReferenceIds: [
        ...c.selectedCantrips,
        ...c.selectedSpells,
        ...c.preparedSpells,
      ].map((spell) => spell.id),
    },
  ]);
  const appendRandomTable = (table: RandomEffectTable) => {
    entry(
      `${table.name.ru} / ${table.name.en} · ${table.edition} · ${table.dieLabel?.ru ?? `d${table.die}`}`,
      table.note ? `${table.note.ru}\nEnglish: ${table.note.en}` : "",
    );
    for (const row of table.rows) {
      entry(
        `${row.from === row.to ? row.from : `${row.from}–${row.to}`}`,
        `${row.text.ru}\nEnglish: ${row.text.en}`,
      );
      if (row.subtable) appendRandomTable(row.subtable);
    }
    paragraph(`Источник: ${table.sourceUrl}`);
  };
  c.features.forEach((f) => {
    entry(
      `${f.level} уровень · ${f.name}`,
      `${f.description}${f.originalDescription ? `\n\nEnglish: ${f.originalDescription}` : ""}${f.sourceUrl ? `\n${f.source ?? "Источник"}: ${f.sourceUrl}` : ""}`,
    );
    const table = randomEffectTable(f.randomTableId);
    if (table) appendRandomTable(table);
  });
  if (referenceCreatureIds.size) {
    section("Существа и формы: справочник");
    for (const id of referenceCreatureIds) {
      const creature = ruleCreature(id);
      if (!creature) continue;
      entry(
        `${creature.name.ru} / ${creature.name.en} · ${creature.edition}`,
        `${creature.profile.ru}\nКД ${creature.armorClassFormula?.ru ?? creature.armorClass}; хиты ${creature.hpFormula?.ru ?? creature.hp} (${creature.hitDice}); ПО ${creature.challenge}; БМ ${creature.proficiencyFormula?.ru ?? `+${creature.proficiency}`}${creature.initiative !== undefined ? `; Инициатива ${sign(creature.initiative)}` : ""}.\nСИЛ/ЛОВ/ТЕЛ/ИНТ/МДР/ХАР: ${creature.abilities.join(" / ")}`,
      );
      creature.rules.forEach((rule) => paragraph(rule.ru));
      paragraph(
        `English: ${creature.profile.en}\nAC ${creature.armorClassFormula?.en ?? creature.armorClass}; HP ${creature.hpFormula?.en ?? creature.hp} (${creature.hitDice}); CR ${creature.challenge}; PB ${creature.proficiencyFormula?.en ?? `+${creature.proficiency}`}${creature.initiative !== undefined ? `; Initiative ${sign(creature.initiative)}` : ""}.\nSTR/DEX/CON/INT/WIS/CHA: ${creature.abilities.join(" / ")}`,
      );
      creature.rules.forEach((rule) => paragraph(rule.en));
      paragraph(`Источник: ${creature.sourceUrl}`);
    }
  }
  if (referenceItemIds.size) {
    section("Магические предметы: справочник");
    for (const id of referenceItemIds) {
      const item = ruleItem(id);
      if (!item) continue;
      entry(
        `${item.name.ru} · ${item.name.en} · ${item.edition}`,
        `${item.activation?.ru ?? ""}\n${item.rules.ru}\n\nEnglish: ${item.activation?.en ?? ""} ${item.rules.en}`,
      );
      if (item.table) {
        paragraph(
          item.table.columns
            .map((column) => `${column.ru} / ${column.en}`)
            .join(" · "),
        );
        for (const row of item.table.rows)
          paragraph(row.map((cell) => `${cell.ru} / ${cell.en}`).join(" · "));
      }
      const table = randomEffectTable(item.randomTableId);
      if (table) appendRandomTable(table);
      if (!table || table.sourceUrl !== item.sourceUrl)
        paragraph(`Источник: ${item.sourceUrl}`);
    }
  }
  const spells = [
    ...new Map(
      [
        ...c.selectedCantrips,
        ...c.selectedSpells,
        ...c.preparedSpells,
        ...SPELLS.filter((s) => referenceSpellIds.has(s.id)),
      ].map((s) => [s.id, s]),
    ).values(),
  ].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ru"));
  if (spells.length) {
    section("Магия и заклинания");
    c.spellcastingSources.forEach((s) =>
      paragraph(
        `${s.name}: ${ABILITY_LABELS[s.ability]} · сложность спасброска ${s.saveDc} · атака ${sign(s.attackBonus)}`,
      ),
    );
    paragraph(
      `Ячейки: ${
        c.spellSlots
          .map((n, i) => (n ? `${i + 1} круг — ${n}` : ""))
          .filter(Boolean)
          .join("; ") || "нет обычных ячеек"
      }`,
    );
    if (c.pactSlots)
      paragraph(
        `Магия договора: ${c.pactSlots} яч. ${c.pactSlotLevel} круга, восстанавливаются после короткого или долгого отдыха.`,
      );
    const prepared = new Set(c.preparedSpells.map((s) => s.id));
    for (const s of spells) {
      const metadata = spellMetadata(s);
      entry(
        `${s.name} · ${s.level ? `${s.level} круг` : "заговор"}${prepared.has(s.id) ? " · подготовлено" : ""}`,
        `${s.school} · ${metadata.castingTime}\nДистанция: ${metadata.range} · Длительность: ${metadata.duration}${s.concentration ? " · Концентрация" : ""}${s.ritual ? " · Ритуал" : ""}${metadata.components ? `\nКомпоненты: ${metadata.components}` : ""}\n${s.descriptionRu || s.summary || ""}\n\nEnglish: ${s.description}${s.sourceUrl ? `\n${s.source ?? "Источник"}: ${s.sourceUrl}` : ""}`,
      );
      const spellTable = randomEffectTable(s.randomTableId);
      if (spellTable) appendRandomTable(spellTable);
      for (const id of s.randomTableIds ?? []) {
        const table = randomEffectTable(id);
        if (table) appendRandomTable(table);
      }
    }
  }
  if (personalityEntries(draft.personality).length) {
    page();
    section("Личность и история");
    personalityEntries(draft.personality).forEach((field) =>
      entry(field.label, field.text),
    );
  }
  if (draft.equipment?.length) {
    section("Снаряжение");
    draft.equipment.forEach((item) =>
      paragraph(`${item.name} × ${item.quantity}`),
    );
  }
  if (draft.notes) {
    section("Снаряжение и заметки");
    paragraph(draft.notes);
  }
  section("Справочник состояний");
  conditionsForEdition(draft.edition).forEach((condition) =>
    entry(
      `${condition.name.ru} / ${condition.name.en}`,
      `${condition.rules.ru}\nEnglish: ${condition.rules.en}`,
    ),
  );
  section("Примечания");
  c.warnings.forEach((w) => paragraph(w, 8));
  paragraph(
    `Материалы System Reference Document ${draft.edition === "2014" ? "5.1" : "5.2.1"}, Wizards of the Coast LLC. CC BY 4.0. Русские пояснения и формат листа: Shadow Edge GM.`,
    8,
  );
  paragraph(
    "https://www.dndbeyond.com/srd · https://creativecommons.org/licenses/by/4.0/",
    7,
  );
  const pages = pdf.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    pdf.setPage(n);
    pdf.setFontSize(8);
    pdf.setTextColor("#777777");
    pdf.text(`${n} / ${pages} · D&D ${draft.edition}`, 194, 289, {
      align: "right",
    });
  }
  return pdf;
}

let fontPromise: Promise<string> | undefined;
export async function characterPdfFile(draft: CharacterDraft) {
  fontPromise ??= fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`)
    .then(async (response) => {
      if (!response.ok)
        throw new Error(
          "Не удалось загрузить шрифт PDF. Проверьте соединение и повторите скачивание.",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    })
    .catch((error) => {
      fontPromise = undefined;
      throw error;
    });
  const pdf = createCharacterPdf(draft, await fontPromise);
  const filename = `${(draft.name || "Персонаж").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").slice(0, 80)}-DND-${draft.edition}.pdf`;
  return new File([pdf.output("blob")], filename, { type: "application/pdf" });
}

export async function downloadCharacterPdf(draft: CharacterDraft) {
  const file = await characterPdfFile(draft);
  const filename = file.name;
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { url, filename };
}
