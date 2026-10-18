import { equipmentDisplayName } from "./starting-equipment";
import { jsPDF } from "jspdf";
import { personalityEntries } from "./personality";
import {
  randomEffectTable,
  type RandomEffectTable,
} from "./random-effect-tables";
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
export function createCharacterPdf(
  draft: CharacterDraft,
  fontBase64: string,
  boldFontBase64 = fontBase64,
) {
  const c = deriveCharacter(draft);
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  pdf.addFileToVFS("DejaVuSans.ttf", fontBase64);
  pdf.addFont("DejaVuSans.ttf", "Character", "normal");
  pdf.addFileToVFS("DejaVuSans-Bold.ttf", boldFontBase64);
  pdf.addFont("DejaVuSans-Bold.ttf", "Character", "bold");
  pdf.setFont("Character", "normal");
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
  // Parse a small, non-executable subset of Markdown/HTML into measured PDF runs.
  const richLines = (value: string, maxWidth: number, size: number) => {
    const text = clean(value)
      .replace(/<br\s*\/?>(?:\r?\n)?/gi, "\n")
      .replace(/<\/(?:p|div|li)>/gi, "\n")
      .replace(/<(?:p|div|li)\b[^>]*>/gi, "")
      .replace(/<\/?(?:strong|b)>/gi, "**")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    type Run = { text: string; bold: boolean; width: number };
    const lines: Run[][] = [];
    let bold = false;
    pdf.setFontSize(size);
    for (const source of text.split("\n")) {
      let line: Run[] = [],
        used = 0;
      const push = () => {
        lines.push(line);
        line = [];
        used = 0;
      };
      for (const part of source.split(/(\*\*)/)) {
        if (part === "**") {
          bold = !bold;
          continue;
        }
        for (let word of part.match(/\s+|\S+/g) || []) {
          pdf.setFont("Character", bold ? "bold" : "normal");
          let w = pdf.getTextWidth(word);
          if (used + w > maxWidth && line.length) push();
          if (!line.length && !word.trim()) continue;
          // Split exceptionally long unbroken input without running outside a card.
          while (w > maxWidth) {
            let end = 1;
            while (
              end < word.length &&
              pdf.getTextWidth(word.slice(0, end + 1)) <= maxWidth
            )
              end++;
            const chunk = word.slice(0, end);
            line.push({ text: chunk, bold, width: pdf.getTextWidth(chunk) });
            push();
            word = word.slice(end);
            w = pdf.getTextWidth(word);
          }
          if (word) {
            line.push({ text: word, bold, width: w });
            used += w;
          }
        }
      }
      push();
    }
    pdf.setFont("Character", "normal");
    return lines;
  };
  const drawLine = (
    line: ReturnType<typeof richLines>[number],
    x: number,
    baseline: number,
    size: number,
    color: string,
  ) => {
    pdf.setFontSize(size);
    for (const run of line) {
      pdf.setFont("Character", run.bold ? "bold" : "normal");
      pdf.setTextColor(run.bold ? "#e7c27e" : color);
      pdf.text(run.text, x, baseline);
      x += run.width;
    }
    pdf.setFont("Character", "normal");
  };
  const paragraph = (value: string, size = 9.5, color = "#f5f0fa") => {
    const lineHeight = size * 0.52;
    for (const line of richLines(value, width, size)) {
      room(lineHeight);
      drawLine(line, left, y, size, color);
      y += line.length ? lineHeight : lineHeight * 0.55;
    }
    y += 3;
  };
  const lineAdvance = (line: ReturnType<typeof richLines>[number]) =>
    line.length ? 5.4 : 2.5;
  const narrativeHeight = (text: string, textWidth: number) =>
    21 +
    richLines(text, textWidth, 10).reduce(
      (sum, line) => sum + lineAdvance(line),
      0,
    );
  const narrativeCard = (
    title: string,
    text: string,
    x = left,
    cardWidth = width,
  ) => {
    const lines = richLines(text, cardWidth - 14, 10);
    const fullHeight = narrativeHeight(text, cardWidth - 14);
    if (fullHeight <= bottom - 35) room(fullHeight);
    let offset = 0;
    while (offset < lines.length) {
      room(34);
      let count = 0,
        height = 21;
      while (
        offset + count < lines.length &&
        y + height + lineAdvance(lines[offset + count]) <= bottom
      ) {
        height += lineAdvance(lines[offset + count]);
        count++;
      }
      pdf.setFillColor("#211b2d");
      pdf.roundedRect(x, y, cardWidth, height, 3, 3, "F");
      pdf.setFillColor("#b898e8");
      pdf.rect(x, y + 6, 1, 7, "F");
      pdf.setFont("Character", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor("#b898e8");
      pdf.text(
        title.replace("Моральные ценности и идеалы", "Ценности и идеалы") +
          (offset ? " · продолжение" : ""),
        x + 7,
        y + 10,
      );
      let baseline = y + 20;
      lines.slice(offset, offset + count).forEach((line) => {
        drawLine(line, x + 7, baseline, 10, "#eee8f5");
        baseline += lineAdvance(line);
      });
      offset += count;
      y += height + 6;
      if (offset < lines.length) page();
    }
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
  const scoreGrid = (
    values: { name: string; bonus: number; proficient: boolean }[],
  ) => {
    for (let i = 0; i < values.length; i += 2) {
      room(9);
      values.slice(i, i + 2).forEach((s, column) => {
        const x = left + column * 91;
        pdf.setFillColor(s.proficient ? "#30243f" : "#1c1826");
        pdf.roundedRect(x, y, 87, 7.5, 2, 2, "F");
        pdf.setFontSize(9);
        pdf.setTextColor("#eee8f5");
        pdf.text(s.name, x + 7, y + 5);
        if (s.proficient) {
          pdf.setFillColor("#e7c27e");
          pdf.circle(x + 3, y + 3.8, 0.7, "F");
        }
        pdf.setFont("Character", "bold");
        pdf.setTextColor("#e7c27e");
        pdf.text(sign(s.bonus), x + 82, y + 5, { align: "right" });
        pdf.setFont("Character", "normal");
      });
      y += 9;
    }
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
    ["КД БЕЗ ДОСПЕХА", String(c.armorClass)],
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
  scoreGrid(c.savingThrows);
  section("Навыки");
  scoreGrid(c.skills);
  paragraph(
    "Золотая отметка — владение навыком или спасброском.",
    7.5,
    "#b0a5be",
  );
  page();
  section("Способности · происхождение и черты");
  const terrain = currentLandTerrain(draft);
  if (terrain)
    paragraph(
      `Местность: ${terrain.ru}${draft.targetLevel >= 10 ? ` · Сопротивление: ${terrain.resistance}` : ""}`,
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
      `${table.name.ru} · ${table.edition} · ${table.dieLabel?.ru ?? `d${table.die}`}`,
      table.note?.ru ?? "",
    );
    for (const row of table.rows) {
      entry(
        `${row.from === row.to ? row.from : `${row.from}–${row.to}`}`,
        row.text.ru,
      );
      if (row.subtable) appendRandomTable(row.subtable);
    }
    paragraph(`Источник: ${table.sourceUrl}`);
  };
  c.features.forEach((f) => {
    entry(`${f.level} уровень · ${f.name}`, f.description);
    const table = randomEffectTable(f.randomTableId);
    if (table) appendRandomTable(table);
  });
  if (referenceCreatureIds.size) {
    section("Существа и формы: справочник");
    for (const id of referenceCreatureIds) {
      const creature = ruleCreature(id);
      if (!creature) continue;
      entry(
        `${creature.name.ru} · ${creature.edition}`,
        `${creature.profile.ru}\nКД ${creature.armorClassFormula?.ru ?? creature.armorClass}; хиты ${creature.hpFormula?.ru ?? creature.hp} (${creature.hitDice}); ПО ${creature.challenge}; БМ ${creature.proficiencyFormula?.ru ?? `+${creature.proficiency}`}${creature.initiative !== undefined ? `; Инициатива ${sign(creature.initiative)}` : ""}.\nСИЛ/ЛОВ/ТЕЛ/ИНТ/МДР/ХАР: ${creature.abilities.join(" / ")}`,
      );
      creature.rules.forEach((rule) => paragraph(rule.ru));
    }
  }
  if (referenceItemIds.size) {
    section("Магические предметы: справочник");
    for (const id of referenceItemIds) {
      const item = ruleItem(id);
      if (!item) continue;
      entry(
        `${item.name.ru} · ${item.edition}`,
        `${item.activation?.ru ?? ""}\n${item.rules.ru}`,
      );
      if (item.table) {
        paragraph(item.table.columns.map((column) => column.ru).join(" · "));
        for (const row of item.table.rows)
          paragraph(row.map((cell) => cell.ru).join(" · "));
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
        `${s.school} · ${metadata.castingTime}\nДистанция: ${metadata.range} · Длительность: ${metadata.duration}${s.concentration ? " · Концентрация" : ""}${s.ritual ? " · Ритуал" : ""}${metadata.components ? `\nКомпоненты: ${metadata.components}` : ""}\n${s.descriptionRu || s.summary || ""}`,
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
    const fields = personalityEntries(draft.personality);
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i],
        next = fields[i + 1];
      const short = (text: string) => richLines(text, 72, 10).length <= 28;
      if (
        field.id !== "backstory" &&
        next &&
        short(field.text) &&
        short(next.text)
      ) {
        const height =
          6 +
          Math.max(
            narrativeHeight(field.text, 72),
            narrativeHeight(next.text, 72),
          );
        room(height);
        const start = y;
        narrativeCard(field.label, field.text, left, 86);
        const end = y;
        y = start;
        narrativeCard(next.label, next.text, left + 92, 86);
        y = Math.max(y, end);
        i++;
      } else narrativeCard(field.label, field.text);
    }
  }
  if (draft.equipment?.length || draft.gold !== undefined) {
    section("Снаряжение");
    if (draft.gold !== undefined) paragraph(`Золото: **${draft.gold} зм.**`);
    draft.equipment?.forEach((item) =>
      paragraph(`${equipmentDisplayName(item.name)} × ${item.quantity}`),
    );
  }
  if (draft.notes) {
    section("Заметки");
    paragraph(draft.notes);
  }
  const relevantWarnings = c.warnings.filter(
    (w) =>
      !w.startsWith("КД рассчитан без доспехов") &&
      !w.startsWith("Один класс, фиксированный прирост хитов"),
  );
  if (relevantWarnings.length) {
    section("Проверить перед игрой");
    relevantWarnings.forEach((w) => paragraph(w, 8));
  }
  // Compact legal credit; never create an extra page solely for generic notices.
  pdf.setFont("Character", "normal");
  pdf.setFontSize(5.5);
  pdf.setTextColor("#b0a5be");
  pdf.text(
    `Материалы SRD ${draft.edition === "2014" ? "5.1" : "5.2.1"}: Wizards of the Coast LLC. CC BY 4.0. Перевод и оформление: Shadow Edge GM.`,
    left,
    282,
  );
  pdf.text(
    "https://www.dndbeyond.com/srd · https://creativecommons.org/licenses/by/4.0/",
    left,
    285,
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

let fontPromise: Promise<string[]> | undefined;
export async function characterPdfFile(draft: CharacterDraft) {
  fontPromise ??= Promise.all(
    ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map((name) =>
      fetch(`${import.meta.env.BASE_URL}fonts/${name}`).then(
        async (response) => {
          if (!response.ok)
            throw new Error(
              "Не удалось загрузить шрифт PDF. Проверьте соединение и повторите скачивание.",
            );
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          return btoa(binary);
        },
      ),
    ),
  ).catch((error) => {
    fontPromise = undefined;
    throw error;
  });
  const [normal, bold] = await fontPromise;
  const pdf = createCharacterPdf(draft, normal, bold);
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
