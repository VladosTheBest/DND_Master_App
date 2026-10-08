import type {
  AIJob,
  AIProposal,
  AIProposalListParams,
  AIProposalMediaResult,
  AIProposalMutationResult,
  ApiClient,
  ApplyAIProposalInput,
  AttachAIProposalMediaInput,
  AuthSessionResult,
  OAuthProviderStatus,
  BestiaryBrowseResult,
  BestiaryMonsterDetail,
  CampaignData,
  CampaignSummary,
  ReadyCampaignTemplate,
  CombatResult,
  CodexConnectionStatus,
  CodexDeviceCodeResult,
  CodexPromptInput,
  CodexPromptResult,
  CreateCampaignInput,
  CreateEntityInput,
  CreateEntityResult,
  DeleteWorldEventResult,
  DeleteEntityResult,
  FinishCombatResult,
  FormatPlayerFacingCardInput,
  FormatPlayerFacingCardResult,
  GenerateCombatInput,
  GenerateCombatResult,
  GenerateEntityDraftInput,
  GenerateEntityDraftResult,
  ItemCatalogBrowseResult,
  ItemCatalogDetail,
  GenerateWorldEventInput,
  GenerateWorldEventResult,
  InitiativeShareResult,
  LoginInput,
  PlayerDisplayImageInput,
  PlayerDisplayShareResult,
  ProposeCampaignInput,
  ProposeEntityInput,
  ProposeWorldEventInput,
  RegisterInput,
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

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

const aiProposalRoutes = (baseUrl: string) => {
  const root = `${baseUrl}/api/ai/proposals`;
  return {
    root,
    campaign: `${root}/campaign`,
    detail: (proposalId: string) => `${root}/${encodeURIComponent(proposalId)}`,
    action: (proposalId: string, action: "apply" | "reject" | "undo") =>
      `${root}/${encodeURIComponent(proposalId)}/${action}`,
    mediaAttachments: (proposalId: string) =>
      `${root}/${encodeURIComponent(proposalId)}/media/attachments`,
    entity: (campaignId: string) =>
      `${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/ai/proposals/entities`,
    event: (campaignId: string) =>
      `${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/ai/proposals/events`
  };
};

const codexBridgeRoutes = (baseUrl: string) => {
  const root = `${baseUrl}/api/ai/codex`;
  return {
    status: `${root}/status`,
    connect: `${root}/connect`,
    disconnect: `${root}/disconnect`,
    prompts: `${root}/prompts`
  };
};

const ensureJson = async <T>(response: Response): Promise<T> => {
  // A restart/proxy failure can legitimately return an empty HTML/body. Do not
  // leak a JSON parser exception to the GM UI in that case.
  const body = await response.text();
  let payload: ApiEnvelope<T> | undefined;
  if (body.trim()) {
    try {
      payload = JSON.parse(body) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(
        `Server returned an invalid response (status ${response.status})`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    if (payload?.error?.code === "subscription_required" && typeof window !== "undefined") {
      window.dispatchEvent(new Event("shadow-edge:subscription-required"));
    }
    throw new ApiError(payload?.error?.message ?? `Request failed with status ${response.status}`, response.status, payload?.error?.code);
  }

  if (!payload) {
    throw new ApiError("Server returned an empty response", response.status);
  }

  return payload.data;
};

const resolveRequestUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

const isAuthEndpoint = (input: RequestInfo | URL) => resolveRequestUrl(input).includes("/api/auth/");

export const createHttpApiClient = (baseUrl: string): ApiClient => {
  const sessionUrl = `${baseUrl}/api/auth/session`;
  const proposalRoutes = aiProposalRoutes(baseUrl);
  const codexRoutes = codexBridgeRoutes(baseUrl);

  const fetchWithSessionRecovery = async (input: RequestInfo | URL, init?: RequestInit) => {
    const execute = () =>
      fetch(input, {
        credentials: "include",
        ...init
      });

    const response = await execute();
    if (response.status !== 401 || isAuthEndpoint(input)) {
      return response;
    }

    try {
      const sessionResponse = await fetch(sessionUrl, {
        credentials: "include"
      });

      if (sessionResponse.ok) {
        const payload = (await sessionResponse.json()) as ApiEnvelope<AuthSessionResult>;
        if (payload.data?.authenticated) {
          return execute();
        }
      }
    } catch {
      // Let the original 401 bubble up if session recovery fails.
    }

    return response;
  };

  const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
    const response = await fetchWithSessionRecovery(input, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      ...init
    });

    return ensureJson<T>(response);
  };

  const requestFormData = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
    const response = await fetchWithSessionRecovery(input, init);
    return ensureJson<T>(response);
  };

  const startGeneration = (url: string, init?: RequestInit) => requestJson<AIJob>(url, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers, Prefer: "respond-async" }
  });
  const requestGeneration = async <T>(url: string, init?: RequestInit): Promise<T> => {
    let job = await startGeneration(url, init);
    let pollFailures = 0;
    while (job.state === "queued" || job.state === "running") {
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        job = await requestJson<AIJob>(`${baseUrl}/api/ai/jobs/${encodeURIComponent(job.id)}`);
        pollFailures = 0;
      } catch (error) {
        if (++pollFailures < 5 && !(isApiError(error) && (error.status === 401 || error.status === 404))) continue;
        throw new ApiError("Задача принята сервером, но её статус сейчас недоступен. Не запускай её повторно: после восстановления связи открой «Задачи AI».", 503, "ai_job_status_unavailable");
      }
    }
    if (job.state === "failed" || job.result?.error) {
      throw new ApiError(job.result?.error?.message || job.stage, job.httpStatus || 500, job.result?.error?.code || "ai_job_failed");
    }
    return job.result?.data as T;
  };

  return {
    async getSession() {
      return requestJson<AuthSessionResult>(sessionUrl);
    },
    async getOAuthProviders() {
      return requestJson<OAuthProviderStatus[]>(`${baseUrl}/api/auth/oauth/providers`);
    },
    async startOAuth(provider, link = false, replace = false) {
      const query = new URLSearchParams();
      if (link) query.set("link", "1");
      if (replace) query.set("replace", "1");
      return requestJson<{ url: string }>(`${baseUrl}/api/auth/oauth/${provider}/start?${query}`, { method: "POST" });
    },
  async login(input) {
    return requestJson<AuthSessionResult>(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify(input satisfies LoginInput)
    });
  },
  async register(input) {
    return requestJson<AuthSessionResult>(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify(input satisfies RegisterInput)
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

  async listReadyCampaignTemplates() {
    return requestJson<ReadyCampaignTemplate[]>(`${baseUrl}/api/campaign-templates`);
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
  async browseItemCatalog(params) {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.source) search.set("source", params.source);
    if (params?.category) search.set("category", params.category);
    if (params?.armorType) search.set("armorType", params.armorType);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return requestJson<ItemCatalogBrowseResult>(`${baseUrl}/api/items-catalog${suffix}`);
  },
  async getCatalogItem(itemId) {
    return requestJson<ItemCatalogDetail>(`${baseUrl}/api/items-catalog/${itemId}`);
  },
  async importBestiaryMonster(campaignId, monsterId) {
    return requestJson<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/bestiary/${monsterId}/import`, {
      method: "POST"
    });
  },
  async listSessionMaps(campaignId) {
    return requestJson<import("@shadow-edge/shared-types").SessionMapDocument[]>(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-maps`);
  },
  async saveSessionMap(campaignId, map) {
    return requestJson<import("@shadow-edge/shared-types").SessionMapDocument>(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-maps${map.id ? `/${encodeURIComponent(map.id)}` : ""}`, {
      method: map.id ? "PUT" : "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(map)
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
    return requestGeneration<GenerateEntityDraftResult>(`${baseUrl}/api/campaigns/${campaignId}/ai/drafts`, {
      method: "POST",
      body: JSON.stringify(input satisfies GenerateEntityDraftInput)
    });
  },
  async listAIProposals(params) {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.campaignId) search.set("campaignId", params.campaignId);
    const suffix = search.size ? `?${search.toString()}` : "";
    return requestJson<AIProposal[]>(`${proposalRoutes.root}${suffix}`);
  },
  async getAIProposal(proposalId) {
    return requestJson<AIProposal>(proposalRoutes.detail(proposalId));
  },
  async proposeEntity(campaignId, input) {
    return requestGeneration<AIProposal>(proposalRoutes.entity(campaignId), {
      method: "POST",
      body: JSON.stringify(input satisfies ProposeEntityInput)
    });
  },
  async proposeCampaign(input) {
    return requestGeneration<AIProposal>(proposalRoutes.campaign, {
      method: "POST",
      body: JSON.stringify(input satisfies ProposeCampaignInput)
    });
  },
  async proposeWorldEvent(campaignId, input) {
    return requestGeneration<AIProposal>(proposalRoutes.event(campaignId), {
      method: "POST",
      body: JSON.stringify(input satisfies ProposeWorldEventInput)
    });
  },
  async applyAIProposal(proposalId, input = {}) {
    return requestJson<AIProposalMutationResult>(proposalRoutes.action(proposalId, "apply"), {
      method: "POST",
      body: JSON.stringify(input satisfies ApplyAIProposalInput)
    });
  },
  async rejectAIProposal(proposalId) {
    return requestJson<AIProposalMutationResult>(proposalRoutes.action(proposalId, "reject"), {
      method: "POST"
    });
  },
  async undoAIProposal(proposalId) {
    return requestJson<AIProposalMutationResult>(proposalRoutes.action(proposalId, "undo"), {
      method: "POST"
    });
  },
  async attachAIProposalMedia(proposalId, input) {
    return requestJson<AIProposalMediaResult>(proposalRoutes.mediaAttachments(proposalId), {
      method: "POST",
      body: JSON.stringify(input satisfies AttachAIProposalMediaInput)
    });
  },
  async getCodexConnectionStatus() {
    return requestJson<CodexConnectionStatus>(codexRoutes.status);
  },
  async connectCodexChatGPT() {
    return requestJson<CodexDeviceCodeResult>(codexRoutes.connect, {
      method: "POST"
    });
  },
  async disconnectCodexChatGPT() {
    return requestJson<CodexConnectionStatus>(codexRoutes.disconnect, {
      method: "POST"
    });
  },
  async runCodexPrompt(input) {
    return requestGeneration<CodexPromptResult>(codexRoutes.prompts, {
      method: "POST",
      body: JSON.stringify(input satisfies CodexPromptInput)
    });
  },
  async startCodexPrompt(input) {
    return startGeneration(codexRoutes.prompts, { method: "POST", body: JSON.stringify(input) });
  },
  async listAIJobs(campaignId) {
    return requestJson<AIJob[]>(`${baseUrl}/api/ai/jobs${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`);
  },
  async getAIJob(id) {
    return requestJson<AIJob>(`${baseUrl}/api/ai/jobs/${encodeURIComponent(id)}`);
  },
  async formatPlayerFacingCard(campaignId, input) {
    return requestGeneration<FormatPlayerFacingCardResult>(`${baseUrl}/api/campaigns/${campaignId}/ai/player-facing/format`, {
      method: "POST",
      body: JSON.stringify(input satisfies FormatPlayerFacingCardInput)
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
    return requestGeneration<GenerateWorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/generate`, {
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
  async showPlayerDisplayImage(campaignId, input) {
    return requestJson<PlayerDisplayShareResult>(`${baseUrl}/api/campaigns/${campaignId}/player-display`, {
      method: "POST",
      body: JSON.stringify(input satisfies PlayerDisplayImageInput)
    });
  },
  async rotatePlayerDisplayLink(campaignId) {
    return requestJson<PlayerDisplayShareResult>(`${baseUrl}/api/campaigns/${campaignId}/player-display/rotate`, {
      method: "POST"
    });
  },
  async generateCombat(campaignId, input) {
    return requestGeneration<GenerateCombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/generate`, {
      method: "POST",
      body: JSON.stringify(input satisfies GenerateCombatInput)
    });
  },
    async search(campaignId, query) {
      return requestJson<SearchResult[]>(
        `${baseUrl}/api/campaigns/${campaignId}/search?q=${encodeURIComponent(query)}`
      );
    }
  };
};

export const createApiClient = (baseUrl = ""): ApiClient =>
  createHttpApiClient(baseUrl);
