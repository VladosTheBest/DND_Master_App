import type {
  ApiClient,
  AuthSessionResult,
  BestiaryBrowseResult,
  BestiaryMonsterDetail,
  CampaignData,
  CampaignSummary,
  CombatResult,
  CreateCampaignInput,
  CreateEntityInput,
  CreateEntityResult,
  DeleteWorldEventResult,
  DeleteEntityResult,
  FinishCombatResult,
  GenerateCombatInput,
  GenerateCombatResult,
  GenerateEntityDraftInput,
  GenerateEntityDraftResult,
  GenerateWorldEventInput,
  GenerateWorldEventResult,
  InitiativeShareResult,
  LoginInput,
  SearchResult,
  StartCombatInput,
  UploadImageResult,
  UpdateCampaignInput,
  UpdateCombatStateInput,
  UpdateCombatEntryInput,
  WorldEventInput,
  WorldEventResult
} from "@shadow-edge/shared-types";

interface ApiEnvelope<T> {
  data: T;
  error?: { code: string; message: string } | null;
  meta?: unknown;
}

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const ensureJson = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new ApiError(payload.error?.message ?? `Request failed with status ${response.status}`, response.status, payload.error?.code);
  }

  return payload.data;
};

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  return ensureJson<T>(response);
};

const requestFormData = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    ...init
  });

  return ensureJson<T>(response);
};

export const createHttpApiClient = (baseUrl: string): ApiClient => ({
  async getSession() {
    return requestJson<AuthSessionResult>(`${baseUrl}/api/auth/session`);
  },
  async login(input) {
    return requestJson<AuthSessionResult>(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify(input satisfies LoginInput)
    });
  },
  async logout() {
    return requestJson<AuthSessionResult>(`${baseUrl}/api/auth/logout`, {
      method: "POST"
    });
  },
  async listCampaigns() {
    return requestJson<CampaignSummary[]>(`${baseUrl}/api/campaigns`);
  },
  async getCampaign(campaignId) {
    return requestJson<CampaignData>(`${baseUrl}/api/campaigns/${campaignId}`);
  },
  async browseBestiary(params) {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.challenge) search.set("challenge", params.challenge);
    if (params?.type) search.set("type", params.type);
    if (params?.namedNpc) search.set("namedNpc", "true");
    if (params?.classic) search.set("classic", "true");
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return requestJson<BestiaryBrowseResult>(`${baseUrl}/api/bestiary${suffix}`);
  },
  async getBestiaryMonster(monsterId) {
    return requestJson<BestiaryMonsterDetail>(`${baseUrl}/api/bestiary/${monsterId}`);
  },
  async importBestiaryMonster(campaignId, monsterId) {
    return requestJson<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/bestiary/${monsterId}/import`, {
      method: "POST"
    });
  },
  async uploadImage(campaignId, file) {
    const formData = new FormData();
    formData.set("file", file);

    return requestFormData<UploadImageResult>(`${baseUrl}/api/campaigns/${campaignId}/uploads`, {
      method: "POST",
      body: formData
    });
  },
  async createCampaign(input) {
    return requestJson<CampaignData>(`${baseUrl}/api/campaigns`, {
      method: "POST",
      body: JSON.stringify(input satisfies CreateCampaignInput)
    });
  },
  async updateCampaign(campaignId, input) {
    return requestJson<CampaignData>(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies UpdateCampaignInput)
    });
  },
  async createEntity(campaignId, input) {
    return requestJson<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/entities`, {
      method: "POST",
      body: JSON.stringify(input satisfies CreateEntityInput)
    });
  },
  async updateEntity(campaignId, entityId, input) {
    return requestJson<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/entities/${entityId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  async deleteEntity(campaignId, entityId) {
    return requestJson<DeleteEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/entities/${entityId}`, {
      method: "DELETE"
    });
  },
  async generateEntityDraft(campaignId, input) {
    return requestJson<GenerateEntityDraftResult>(`${baseUrl}/api/campaigns/${campaignId}/ai/drafts`, {
      method: "POST",
      body: JSON.stringify(input satisfies GenerateEntityDraftInput)
    });
  },
  async createWorldEvent(campaignId, input) {
    return requestJson<WorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events`, {
      method: "POST",
      body: JSON.stringify(input satisfies WorldEventInput)
    });
  },
  async updateWorldEvent(campaignId, eventId, input) {
    return requestJson<WorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies WorldEventInput)
    });
  },
  async deleteWorldEvent(campaignId, eventId) {
    return requestJson<DeleteWorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/${eventId}`, {
      method: "DELETE"
    });
  },
  async generateWorldEvent(campaignId, input) {
    return requestJson<GenerateWorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/generate`, {
      method: "POST",
      body: JSON.stringify(input satisfies GenerateWorldEventInput)
    });
  },
  async startCombat(campaignId, input) {
    return requestJson<CombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/entries`, {
      method: "POST",
      body: JSON.stringify(input satisfies StartCombatInput)
    });
  },
  async updateCombatState(campaignId, input) {
    return requestJson<CombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies UpdateCombatStateInput)
    });
  },
  async updateCombatEntry(campaignId, entryId, input) {
    return requestJson<CombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies UpdateCombatEntryInput)
    });
  },
  async finishCombat(campaignId) {
    return requestJson<FinishCombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/finish`, {
      method: "POST"
    });
  },
  async createInitiativeShare(campaignId) {
    return requestJson<InitiativeShareResult>(`${baseUrl}/api/campaigns/${campaignId}/initiative-share`, {
      method: "POST"
    });
  },
  async publishInitiativeShare(campaignId) {
    return requestJson<InitiativeShareResult>(`${baseUrl}/api/campaigns/${campaignId}/initiative-share/publish`, {
      method: "POST"
    });
  },
  async generateCombat(campaignId, input) {
    return requestJson<GenerateCombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/generate`, {
      method: "POST",
      body: JSON.stringify(input satisfies GenerateCombatInput)
    });
  },
  async search(campaignId, query) {
    return requestJson<SearchResult[]>(
      `${baseUrl}/api/campaigns/${campaignId}/search?q=${encodeURIComponent(query)}`
    );
  }
});

export const createApiClient = (baseUrl = ""): ApiClient =>
  createHttpApiClient(baseUrl);
