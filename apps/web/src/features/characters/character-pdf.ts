import { jsPDF } from "jspdf";
import {
  ABILITIES,
  ABILITY_LABELS,
  deriveCharacter,
  type CharacterDraft,
} from "./rules";

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const clean = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** Text-based pages retain searchable Cyrillic and split long descriptions safely. */
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
  let y = 19;
  const page = () => {
    pdf.addPage();
    y = 19;
  };
  const room = (height: number) => {
    if (y + height > bottom) page();
  };
  const paragraph = (value: string, size = 9, color = "#272331") => {
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lineHeight = size * 0.48;
    for (const sourceLine of clean(value).split("\n")) {
      const lines: string[] = pdf.splitTextToSize(sourceLine || " ", width);
      for (const line of lines) {
        room(lineHeight);
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
    paragraph(title, 13, "#594526");
  };
  const entry = (title: string, description: string) => {
    room(18);
    paragraph(title, 10, "#4e3c60");
    paragraph(description);
  };
  const columns = (values: string[]) => {
    const rows = Math.ceil(values.length / 2);
    for (let row = 0; row < rows; row++) {
      room(6);
      pdf.setFontSize(9);
      pdf.setTextColor("#272331");
      pdf.text(values[row], left, y);
      if (values[row + rows])
        pdf.text(values[row + rows], left + width / 2 + 2, y);
      y += 5;
    }
    y += 2;
  };
  paragraph(draft.name || "Новый персонаж", 23, "#4e3c60");
  paragraph(
    `D&D ${draft.edition} · ${c.class?.name || ""} · уровень ${c.level}`,
    12,
  );
  paragraph(
    `${c.species?.name || ""} · ${c.background?.name || ""}${c.subclass ? ` · ${c.subclass.name}` : ""}`,
  );
  if (draft.playerName) paragraph(`Игрок: ${draft.playerName}`);
  section("Характеристики и бой");
  room(28);
  for (const [index, id] of ABILITIES.entries()) {
    const x = left + (index * width) / 6;
    pdf.setDrawColor("#cfc5d7");
    pdf.roundedRect(x, y, width / 6 - 2, 23, 2, 2);
    pdf.setFontSize(8);
    pdf.setTextColor("#594526");
    pdf.text(ABILITY_LABELS[id], x + (width / 6 - 2) / 2, y + 5, {
      align: "center",
    });
    pdf.setFontSize(16);
    pdf.setTextColor("#4e3c60");
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
  section("Происхождение и черты");
  c.traits.forEach((t) => paragraph(t));
  c.feats.forEach((f) => entry(f.name, f.description));
  section("Развитие по уровням");
  c.features.forEach((f) =>
    entry(`${f.level} уровень · ${f.name}`, f.description),
  );
  const spells = [
    ...new Map(
      [...c.selectedCantrips, ...c.selectedSpells, ...c.preparedSpells].map(
        (s) => [s.id, s],
      ),
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
      entry(
        `${s.name} · ${s.level ? `${s.level} круг` : "заговор"}${prepared.has(s.id) ? " · подготовлено" : ""}`,
        `${s.school} · ${s.castingTime}\nДистанция: ${s.range} · Длительность: ${s.duration}${s.concentration ? " · Концентрация" : ""}${s.ritual ? " · Ритуал" : ""}\n${s.summary || ""}\n\nТекст редакции (English): ${s.description}`,
      );
    }
  }
  if (draft.notes) {
    section("Снаряжение и заметки");
    paragraph(draft.notes);
  }
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
export async function downloadCharacterPdf(draft: CharacterDraft) {
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
  const url = URL.createObjectURL(pdf.output("blob"));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { url, filename };
}
