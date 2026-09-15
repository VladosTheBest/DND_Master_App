import type { JournalEntry, JournalKind, SessionJournal, SourceRange, SpeechKind } from "./sessions.api";

export const journalKinds: { id: JournalKind; label: string; icon: string }[] = [
  { id: "event", label: "События", icon: "✦" },
  { id: "dialogue", label: "Важные диалоги", icon: "❞" },
  { id: "loot", label: "Добыча", icon: "◇" },
  { id: "discovery", label: "Открытия", icon: "⌕" },
  { id: "encounter", label: "Встречи", icon: "♧" },
];
export const speechLabels: Record<SpeechKind, string> = {
  game: "В игре", table: "За столом", uncertain: "Неясно",
};
export const overlapsSource = (a: SourceRange, b: SourceRange) => a.fromLine <= b.toLine && b.fromLine <= a.toLine;

// A mixed or partially classified utterance must not silently become fictional fact.
export function classifySpeech(entry: SourceRange, speech: SessionJournal["speech"] = []): SpeechKind {
  let cursor = entry.fromLine;
  let kind: SpeechKind | undefined;
  for (const range of speech) {
    if (range.toLine < cursor) continue;
    if (range.fromLine > cursor) return "uncertain";
    if (kind && kind !== range.kind) return "uncertain";
    kind = range.kind;
    cursor = range.toLine + 1;
    if (cursor > entry.toLine) return kind;
  }
  return "uncertain";
}

export function filterJournal(entries: JournalEntry[], filters: { kind?: string; location?: string; status?: string; query?: string }) {
  const query = filters.query?.trim().toLocaleLowerCase() || "";
  return entries.filter(entry =>
    (!filters.kind || entry.kind === filters.kind) &&
    (!filters.location || (filters.location === "__unknown" ? !entry.locationId : entry.locationId === filters.location)) &&
    (!filters.status || entry.status === filters.status) &&
    (!query || `${entry.title} ${entry.detail} ${entry.people.join(" ")}`.toLocaleLowerCase().includes(query))
  );
}
