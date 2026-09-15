export interface TranscriptFile { name: string; text: string }
export const maxImportBytes = 4 * 1024 * 1024;
const linePattern = /^\[(\d{2,}:\d{2}:\d{2}\.\d{3})[–-](\d{2,}:\d{2}:\d{2}\.\d{3})\] ([^:\r\n]{1,100}):\s?(.*)$/gm;
const milliseconds = (stamp: string) => {
  const [h, m, s] = stamp.split(":").map(Number);
  if (m >= 60 || s >= 60) throw new Error("Некорректное время в расшифровке.");
  return Math.round((h * 3600 + m * 60 + s) * 1000);
};
const stamp = (ms: number) => `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;

/** Combine in the displayed order. Each source clock starts after the previous last utterance. */
export function combineTranscripts(files: TranscriptFile[]): string {
  if (!files.length) throw new Error("Выберите хотя бы один TXT-файл.");
  const texts = files.map(file => file.text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"));
  if (texts.some(text => !text.trim() || text.includes("\0"))) throw new Error("Один из файлов пуст или не содержит обычный текст.");
  let result = texts[0];
  if (texts.length > 1) {
    const matches = texts.map(text => [...text.matchAll(linePattern)]);
    if (matches.some(items => items.length) && matches.some(items => !items.length))
      throw new Error("Не смешивайте файлы с временными метками и без них. Выберите общие расшифровки Quill для всех частей.");
    if (matches.every(items => !items.length)) {
      result = texts.map((text, i) => `Часть ${i + 1}: ${files[i].name}\n\n${text}`).join("\n\n");
    } else {
      let offset = 0;
      const headers: string[] = [], bodies: string[] = [];
      texts.forEach((text, i) => {
        const first = matches[i][0].index!;
        headers.push(`Часть ${i + 1}: ${files[i].name.replace(/[\r\n]/g, " ")} · смещение ${stamp(offset)}\n${text.slice(0, first).trim()}`);
        let endOfPart = 0;
        const body = text.slice(first).replace(linePattern, (_line, from: string, to: string, name: string, words: string) => {
          const start = milliseconds(from), end = milliseconds(to);
          if (end < start || end + offset > 7 * 24 * 3600000) throw new Error("Некорректная длительность: объединённый текст должен укладываться в 7 суток.");
          endOfPart = Math.max(endOfPart, end);
          return `[${stamp(start + offset)}–${stamp(end + offset)}] ${name}: ${words}`;
        });
        bodies.push(body.trimEnd());
        offset += endOfPart + 1;
      });
      result = `Объединённая сессия Quill\nВремя реплик последовательное; паузы между файлами не включены. В служебных событиях каждой части сохранено исходное время.\n\n${headers.join("\n\n")}\n\nРасшифровка:\n${bodies.join("\n")}`;
    }
  }
  if (new TextEncoder().encode(result).length > maxImportBytes) throw new Error("Общий текст с заголовками превышает 4 МБ. Выберите меньше файлов.");
  return result;
}
