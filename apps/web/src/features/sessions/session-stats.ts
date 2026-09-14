export interface SessionUtterance {
  name: string;
  text: string;
  start: number | null;
  end: number | null;
  stamp: string;
}
export interface SpeakerStats {
  name: string;
  words: number;
  turns: number;
  seconds: number;
  wordShare: number;
  timeShare: number;
}
const stampSeconds = (stamp: string) => {
  const [h, m, s] = stamp.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
export const wordCount = (text: string) =>
  (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
export function parseSessionText(text: string): SessionUtterance[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const entries: SessionUtterance[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\[(\d{2,}:\d{2}:\d{2}\.\d{3})[–-](\d{2,}:\d{2}:\d{2}\.\d{3})\] ([^:\r\n]{1,100}):\s?(.*)$/,
    );
    if (match) {
      const start = stampSeconds(match[1]),
        end = stampSeconds(match[2]);
      const valid =
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end >= start &&
        end <= 7 * 24 * 3600;
      entries.push({
        name: match[3].trim(),
        text: match[4],
        start: valid ? start : null,
        end: valid ? end : null,
        stamp: `${match[1]} — ${match[2]}`,
      });
    } else if (entries.length && line.trim())
      entries[entries.length - 1].text += "\n" + line;
  }
  return entries.length
    ? entries
    : text.trim()
      ? [
          {
            name: "Без указания участника",
            text,
            start: null,
            end: null,
            stamp: "",
          },
        ]
      : [];
}
export function speakerStatistics(
  entries: SessionUtterance[],
  excluded = "",
): SpeakerStats[] {
  const speakers = new Map<
    string,
    { words: number; turns: number; intervals: [number, number][] }
  >();
  for (const entry of entries) {
    if (entry.name === excluded) continue;
    const value = speakers.get(entry.name) || {
      words: 0,
      turns: 0,
      intervals: [],
    };
    value.words += wordCount(entry.text);
    value.turns++;
    if (entry.start !== null && entry.end !== null)
      value.intervals.push([entry.start, entry.end]);
    speakers.set(entry.name, value);
  }
  const stats = [...speakers].map(([name, value]) => {
    let seconds = 0,
      end = -1;
    for (const interval of value.intervals.sort((a, b) => a[0] - b[0])) {
      seconds += Math.max(0, interval[1] - Math.max(interval[0], end));
      end = Math.max(end, interval[1]);
    }
    return {
      name,
      words: value.words,
      turns: value.turns,
      seconds,
      wordShare: 0,
      timeShare: 0,
    };
  });
  const words = stats.reduce((sum, s) => sum + s.words, 0),
    seconds = stats.reduce((sum, s) => sum + s.seconds, 0);
  return stats
    .map((s) => ({
      ...s,
      wordShare: words ? (s.words / words) * 100 : 0,
      timeShare: seconds ? (s.seconds / seconds) * 100 : 0,
    }))
    .sort((a, b) => b.words - a.words);
}
export function highlightedParts(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  const parts: Array<{ text: string; match: boolean }> = [];
  const needle = query.trim().toLocaleLowerCase();
  const haystack = text.toLocaleLowerCase();
  let offset = 0,
    at = haystack.indexOf(needle);
  while (at >= 0) {
    if (at > offset) parts.push({ text: text.slice(offset, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    offset = at + needle.length;
    at = haystack.indexOf(needle, offset);
  }
  if (offset < text.length)
    parts.push({ text: text.slice(offset), match: false });
  return parts;
}
