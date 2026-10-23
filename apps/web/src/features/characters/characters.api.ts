import { requestJson } from "@shadow-edge/api-client";
import type { CharacterDraft } from "./rules";

export interface CharacterInvite {
  token: string;
  url: string;
  edition: "2014" | "2024" | "any";
  level: number;
}

export interface PublicCharacterInvite {
  campaignName: string;
  edition: CharacterInvite["edition"];
  level: number;
}

export interface SavedCharacter {
  revision: number;
  id: string;
  playerId: string;
  campaignName: string;
  draft: CharacterDraft;
  createdAt: string;
  updatedAt: string;
  editToken?: string;
}

function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(`${import.meta.env.VITE_API_BASE_URL || ""}/api${path}`, {
    method, signal, body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const campaignPath = (id: string) => `/campaigns/${encodeURIComponent(id)}`;
export const characterApi = {
  getInvite: (id: string) =>
    request<CharacterInvite | null>(`${campaignPath(id)}/character-invite`),
  saveInvite: (
    id: string,
    settings: {
      edition: CharacterInvite["edition"];
      level: number;
      rotate?: boolean;
    },
  ) =>
    request<CharacterInvite>(
      `${campaignPath(id)}/character-invite`,
      "POST",
      settings,
    ),
  revokeInvite: (id: string) =>
    request<unknown>(`${campaignPath(id)}/character-invite`, "DELETE"),
  listSheets: (id: string) =>
    request<SavedCharacter[]>(`${campaignPath(id)}/character-sheets`),
  getPublicInvite: (token: string) =>
    request<PublicCharacterInvite>(
      `/character-invites/${encodeURIComponent(token)}`,
    ),
  create: (token: string, draft: CharacterDraft) =>
    request<SavedCharacter>(
      `/character-invites/${encodeURIComponent(token)}`,
      "POST",
      draft,
    ),
  getSheet: (token: string) =>
    request<SavedCharacter>(`/character-sheets/${encodeURIComponent(token)}`),
  update: (token: string, draft: CharacterDraft, expectedRevision:number) =>
    request<SavedCharacter>(
      `/character-sheets/${encodeURIComponent(token)}`,
      "PUT",
      {draft,expectedRevision},
    ),
};

export function characterURL(path = "") {
  const url = new URL(window.location.href);
  url.hash = `characters${path ? `/${path}` : ""}`;
  return url.href;
}

export async function copyCharacterLink(value: string) {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Автокопирование недоступно. Выделите ссылку в поле и скопируйте её.",
    );
  await navigator.clipboard.writeText(value);
}
