export interface PlayerAnalysis {
  name: string;
  actions: string[];
  moments: string[];
  nextSessionFocus: string;
}
export interface SessionAnalysis {
  runId: string;
  digest: string;
  generatedAt: string;
  summary: string;
  keyEvents: string[];
  players: PlayerAnalysis[];
  nextSession: string[];
  uncertainties: string[];
  proposalIds: string[];
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
