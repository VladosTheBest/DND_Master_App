import { jsPDF } from "jspdf";
import type { ImportedSession, SourceRange } from "./sessions.api";
import { sections, basis, status, clock } from "./dm-report-content";
import { parseSessionText, speakerStatistics, transcriptDiagnostics } from "./session-stats";

const clean = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
/** Browser-local, searchable Cyrillic PDF; no campaign data is sent to a PDF service. */
export function createSessionPdf(session: ImportedSession, master: string, fontBase64: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS("DejaVuSans.ttf", fontBase64);
  pdf.addFont("DejaVuSans.ttf", "DMReport", "normal");
  pdf.setFont("DMReport");
  pdf.setProperties({ title: clean(`${session.title} — Хроника мастера`), author: "Shadow Edge GM" });
  const left = 18, width = 174, bottom = 277;
  let y = 24;
  const background = () => { pdf.setFillColor("#faf7ef"); pdf.rect(0, 0, 210, 297, "F"); };
  background();
  const room = (height: number) => { if (y + height > bottom) { pdf.addPage(); background(); y = 22; } };
  const paragraph = (value: string, size = 10, color = "#253e3e") => {
    pdf.setFontSize(size); pdf.setTextColor(color);
    const height = size * .49;
    for (const original of clean(value).split("\n")) {
      const lines: string[] = pdf.splitTextToSize(original || " ", width);
      for (const line of lines) { room(height); pdf.text(line, left, y); y += height; }
    }
    y += 2;
  };
  const heading = (title: string) => { room(50); y += 5; pdf.setDrawColor("#cbb887"); pdf.line(left, y, left + width, y); y += 8; paragraph(title, 15, "#245d5b"); };
  const sources = (refs: SourceRange[]) => paragraph("Источник: " + refs.map(ref => `строки ${ref.fromLine}–${ref.toLine}`).join("; "), 8, "#586761");
  const report = session.analysis?.dmReport;
  paragraph(`ХРОНИКА МАСТЕРА · СЕССИЯ ${session.number}`, 10, "#245d5b");
  paragraph(session.title, 23);
  paragraph("Личный отчёт · итоги, наблюдения и подготовка игры", 11);
  if (session.analysis?.generatedAt) paragraph(`Анализ: ${new Date(session.analysis.generatedAt).toLocaleDateString("ru-RU")}`, 8);
  heading("Сессия за две минуты");
  paragraph(session.analysis?.summary || "Анализ ещё не выполнен. Доступна статистика записи.");
  if (!report) paragraph("Отчёт мастера ещё не подготовлен. Запустите новый анализ в разделе «Сессии».", 10, "#805b22");
  heading("Запись и участие в разговоре");
  const entries = parseSessionText(session.text || ""), diagnostics = transcriptDiagnostics(session.text || "", entries);
  const stats = speakerStatistics(entries, master);
  paragraph(`До последней реплики: ${diagnostics.lastSecond === null ? "нет меток времени" : clock(diagnostics.lastSecond)} · реплик без точных дублей: ${diagnostics.utterances}`);
  paragraph(master ? `Мастер (${master}) исключён из таблицы и долей.` : "Мастер не выбран: в таблице все говорящие.", 9);
  const columns = [left + 2, left + 71, left + 94, left + 121, left + 143];
  const tableHeader = () => {
    room(13); pdf.setFillColor("#245d5b"); pdf.rect(left, y - 4, width, 9, "F");
    pdf.setFontSize(8); pdf.setTextColor("#ffffff");
    ["Участник", "Реплики", "Слова", "Доля слов", "Время"].forEach((v, i) => pdf.text(v, columns[i], y)); y += 10;
  };
  tableHeader();
  for (const s of stats) {
    pdf.setFontSize(8);
    const names: string[] = pdf.splitTextToSize(clean(s.name), 66);
    const height = Math.max(9, names.length * 4 + 3);
    if (y + height > bottom) { room(height); tableHeader(); }
    pdf.setFontSize(8); pdf.setTextColor("#253e3e");
    pdf.text(names, columns[0], y, { lineHeightFactor: 1.4 });
    [String(s.turns), String(s.words), `${Math.round(s.wordShare)}%`, clock(s.seconds)].forEach((v, i) => pdf.text(v, columns[i + 1], y));
    y += height; pdf.setDrawColor("#ded6c5"); pdf.line(left, y - 4, left + width, y - 4);
  }
  paragraph(`Точных дублей исключено: ${diagnostics.duplicates}. Технических отметок Quill: ${diagnostics.technicalEvents}. Это отметки журнала, а не число сбоев или время простоя. Реплик без корректного времени: ${diagnostics.untimed}.`, 8, "#586761");
  paragraph("Количество речи не измеряет удовольствие или вовлечённость. Время — интервалы распознанных реплик; пересечения одного участника объединены. Одновременная речь разных людей сохраняется. Исходный TXT не изменён.", 8, "#586761");
  if (report) {
  heading("Хронология и темп");
  paragraph("Порядок сцен по расшифровке. Время записи не равно игровому времени.", 8, "#586761");
  for (const [i, scene] of (report?.scenes || []).entries()) {
    room(22); paragraph(`${i + 1}. ${scene.title}`, 11, "#245d5b"); paragraph(scene.detail); sources(scene.sources);
  }
  if (!report?.scenes.length) paragraph("Сцены не выделены.");
  for (const section of sections) {
    heading(section.title);
    if (section.key === "interests") paragraph("Гипотезы по одной сессии нужно проверять с игроком. Это не постоянный психологический профиль.", 8, "#586761");
    const findings = report?.findings.filter(f => f.section === section.key) || [];
    if (!findings.length) paragraph(report ? section.empty : "Раздел ещё не проанализирован.", 9, "#586761");
    for (const f of findings) {
      room(26);
      paragraph([basis[f.basis], f.speaker, f.status && status[f.status]].filter(Boolean).join(" · "), 8, "#805b22");
      paragraph(f.title, 11, "#245d5b"); paragraph(f.detail); sources(f.sources);
    }
  }
  }
  if (session.analysis?.recap) { heading("Полная хроника"); paragraph(session.analysis.recap); }
  if (session.analysis?.uncertainties.length) { heading("Что остаётся неясным"); for (const item of session.analysis.uncertainties) paragraph(`• ${item}`); }
  heading("О точности отчёта");
  paragraph("Распознавание и AI-анализ могут ошибаться. Номера строк относятся к исходному TXT, включая заголовок; проверяйте их в разделе «Полный текст». Рекомендации не являются событиями игры и не изменяют сущности кампании.", 9);
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor("#586761");
    pdf.text(`Хроника мастера · ${i} / ${pages}`, left, 287);
  }
  return pdf;
}

let fontPromise: Promise<string> | undefined;
export async function downloadSessionPdf(session: ImportedSession, master: string) {
  fontPromise ??= fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`).then(async response => {
    if (!response.ok) throw new Error("Не удалось загрузить шрифт PDF. Повторите скачивание.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }).catch(error => { fontPromise = undefined; throw error; });
  const pdf = createSessionPdf(session, master, await fontPromise);
  const filename = `${session.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").slice(0, 80) || "Сессия"}-Мастеру.pdf`;
  const url = URL.createObjectURL(pdf.output("blob"));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  return { url, filename };
}
