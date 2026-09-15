export interface PlayerAnalysis {
  name: string;
  actions: string[];
  moments: string[];
  nextSessionFocus: string;
}
export interface SessionAnalysis {
  journal?: SessionJournal;
  runId: string;
  digest: string;
  generatedAt: string;
  summary: string;
  recap?: string;
  keyEvents: string[];
  players: PlayerAnalysis[];
  nextSession: string[];
  uncertainties: string[];
  proposalIds: string[];
}
export interface SourceRange { fromLine: number; toLine: number }
export type SpeechKind = "game" | "table" | "uncertain";
export type JournalKind = "event" | "dialogue" | "loot" | "discovery" | "encounter";
export interface JournalEntry {
  id: string;
  kind: JournalKind;
  title: string;
  detail: string;
  locationId?: string;
  people: string[];
  status: "confirmed" | "planned" | "uncertain";
  sources: SourceRange[];
}
export interface SessionJournal {
  version: 1;
  locations: { id: string; name: string; summary: string; sources: SourceRange[] }[];
  entries: JournalEntry[];
  speech: (SourceRange & { kind: SpeechKind })[];
}
export interface ImportedSession {
  id: string;
  campaignId: string;
  number: number;
  title: string;
  importedAt: string;
  sourceId?: string;
  participants: string[];
  text?: string;
  bytes: number;
  digest: string;
  analysis?: SessionAnalysis;
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || ""}/api${path}`,
    {
      method,
      credentials: "include",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const envelope = await response.json().catch(() => null);
  if (!response.ok || envelope?.error)
    throw new Error(
      envelope?.error?.message ||
        "Не удалось загрузить сессии. Повторите попытку.",
    );
  return envelope.data as T;
}
const root = (campaignId: string) =>
  `/campaigns/${encodeURIComponent(campaignId)}/sessions`;
export const sessionsApi = {
  list: (campaignId: string) => request<ImportedSession[]>(root(campaignId)),
  get: (campaignId: string, id: string) =>
    request<ImportedSession>(`${root(campaignId)}/${encodeURIComponent(id)}`),
  import: (campaignId: string, title: string, text: string) =>
    request<{ session: ImportedSession; duplicate: boolean }>(
      root(campaignId),
      "POST",
      { title, text },
    ),
  remove: (campaignId: string, id: string) =>
    request<{ deleted: boolean }>(
      `${root(campaignId)}/${encodeURIComponent(id)}`,
      "DELETE",
    ),
};
