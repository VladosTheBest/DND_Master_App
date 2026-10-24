import { AIJobsFeed } from "./ai-jobs-feed";
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

  constructor(message: string, status: number, code?: string, public current?: unknown) {
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

export const ensureJson = async <T>(response: Response): Promise<T> => {
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

  if (!response.ok || payload?.error) {
    if (payload?.error?.code === "subscription_required" && typeof window !== "undefined") {
      window.dispatchEvent(new Event("shadow-edge:subscription-required"));
    }
    throw new ApiError(payload?.error?.message ?? `Request failed with status ${response.status}`, response.status, payload?.error?.code, payload?.data);
  }

  if (!payload || typeof payload !== "object" || !("data" in payload)) {
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

export const fetchWithSessionRecovery = async (input: RequestInfo | URL, init?: RequestInit) => {
  const execute = async () => {
    try { return await fetch(input, { credentials: "include", ...init }); }
    catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError("Не удалось связаться с сервером. Изменения не отправлены повторно; проверьте соединение.", 0, "network_error");
    }
  };

  const response = await execute();
  if (response.status !== 401 || isAuthEndpoint(input) || /\/api\/character-(?:invites|sheets)\//.test(resolveRequestUrl(input)) || !["GET", "HEAD"].includes((init?.method ?? "GET").toUpperCase())) {
    return response;
  }

  try {
    const sessionResponse = await fetch(new URL("/api/auth/session", new URL(resolveRequestUrl(input), typeof location === "undefined" ? "http://localhost" : location.href)).href, {
      credentials: "include", signal: init?.signal
    });

    if (sessionResponse.ok) {
      const payload = (await sessionResponse.json()) as ApiEnvelope<AuthSessionResult>;
      if (payload.data?.authenticated) {
        return execute();
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    // Let the original 401 bubble up if session recovery fails.
  }

  return response;
};


export const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetchWithSessionRecovery(input, { ...init, headers });
  return ensureJson<T>(response);
};


export const createHttpApiClient = (baseUrl: string, options:{workspace?:boolean}={}): ApiClient => {
 const campaignCache=new Map<string,CampaignData>();
 const validators=new Map<string,string>();
 const request = async<T>(url:string,init?:RequestInit):Promise<T>=>{
  if(!options.workspace||!url.includes("/api/campaigns/"))return requestJson<T>(url,init);
  const headers=new Headers(init?.headers);headers.set("X-Workspace-View","compact");
  const campaignId=decodeURIComponent(url.split("/api/campaigns/")[1].split(/[/?]/)[0]);
  const isCampaignGet=(init?.method||"GET")==="GET"&&url===`${baseUrl}/api/campaigns/${campaignId}`;
  if(isCampaignGet&&campaignCache.has(campaignId)&&validators.has(campaignId))headers.set("If-None-Match",validators.get(campaignId)!);
  const response=await fetchWithSessionRecovery(url,{...init,headers});
  if(response.status===304&&isCampaignGet)return campaignCache.get(campaignId) as T;
  let data=await ensureJson<any>(response);
  async function expand(value:any){if(!value||value.id!==campaignId||typeof value.revision!=="number")return value;
   if(typeof value.__baseRevision==="number"){const cached=campaignCache.get(campaignId);if(!cached||cached.revision!==value.__baseRevision){return request<CampaignData>(`${baseUrl}/api/campaigns/${campaignId}`);}
    const {__baseRevision,__collections,...delta}=value;value={...cached,...delta};
    if(__collections)for(const [key,patch] of Object.entries(__collections) as [string,{upsert:any[];remove:string[];order?:string[]}][]){const byId=new Map((cached as any)[key]?.map((item:any)=>[item.id,item])||[]);for(const id of patch.remove)byId.delete(id);for(const item of patch.upsert)byId.set(item.id,item);value[key]=patch.order?patch.order.map(id=>byId.get(id)):[...byId.values()];}
   }
   campaignCache.set(campaignId,value);return value;
  }
  if(data?.campaign)data.campaign=await expand(data.campaign);else if(data?.id===campaignId)data=await expand(data);
  if(isCampaignGet&&response.headers.get("ETag"))validators.set(campaignId,response.headers.get("ETag")!);else if((init?.method||"GET")!=="GET")validators.delete(campaignId);
  return data as T;
 };

  const sessionUrl = `${baseUrl}/api/auth/session`;
  const proposalRoutes = aiProposalRoutes(baseUrl);
  const codexRoutes = codexBridgeRoutes(baseUrl);

  const requestFormData = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
    const response = await fetchWithSessionRecovery(input, init);
    return ensureJson<T>(response);
  };

  const startGeneration = (url: string, init?: RequestInit) => request<AIJob>(url, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers, Prefer: "respond-async" }
  });
  const jobsFeed=new AIJobsFeed(()=>request<AIJob[]>(`${baseUrl}/api/ai/jobs`));
  let owner="";
  const requestGeneration = async <T>(url: string, init?: RequestInit): Promise<T> => {
    let job=await startGeneration(url,init);
    if(job.state==="queued"||job.state==="running"){
      try { await jobsFeed.wait(job.id,init?.signal||undefined); job=await request<AIJob>(`${baseUrl}/api/ai/jobs/${encodeURIComponent(job.id)}`,{signal:init?.signal}); }
      catch(error){if(error instanceof Error&&error.name==="AbortError")throw error;throw new ApiError("Задача принята сервером, но её статус сейчас недоступен. Не запускай её повторно: после восстановления связи открой «Задачи AI».",503,"ai_job_status_unavailable");}
    }
    if(job.state==="failed"||job.result?.error)throw new ApiError(job.result?.error?.message||job.stage,job.httpStatus||500,job.result?.error?.code||"ai_job_failed");
    return job.result?.data as T;
  };

  return {
    subscribeAIJobs:jobsFeed.subscribe,
    getAIJobsSnapshot:jobsFeed.getSnapshot,
    refreshAIJobs:jobsFeed.refresh,
    resetAIJobs:()=>jobsFeed.reset(),
    async getSession() {
      const session=await request<AuthSessionResult>(sessionUrl);const next=session.userId||"";if(next!==owner){owner=next;campaignCache.clear();validators.clear();jobsFeed.reset();}return session;
    },
    async getOAuthProviders() {
      return request<OAuthProviderStatus[]>(`${baseUrl}/api/auth/oauth/providers`);
    },
    async startOAuth(provider, link = false, replace = false) {
      const query = new URLSearchParams();
      if (link) query.set("link", "1");
      if (replace) query.set("replace", "1");
      return request<{ url: string }>(`${baseUrl}/api/auth/oauth/${provider}/start?${query}`, { method: "POST" });
    },
  async login(input) {
    jobsFeed.reset();
    return request<AuthSessionResult>(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify(input satisfies LoginInput)
    });
  },
  async register(input) {
    jobsFeed.reset();
    return request<AuthSessionResult>(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify(input satisfies RegisterInput)
    });
  },
  async logout() {
    owner="";campaignCache.clear();validators.clear();jobsFeed.reset();
    return request<AuthSessionResult>(`${baseUrl}/api/auth/logout`, {
      method: "POST"
    });
  },
  async listCampaigns() {
    return request<CampaignSummary[]>(`${baseUrl}/api/campaigns`);
  },

  async listReadyCampaignTemplates() {
    return request<ReadyCampaignTemplate[]>(`${baseUrl}/api/campaign-templates`);
  },
  async getCombatSnapshot(campaignId,etag) {
   const headers:Record<string,string>={};if(etag)headers["If-None-Match"]=etag;
   const response=await fetchWithSessionRecovery(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/combat-snapshot`,{headers});
   if(response.status===304)return {etag:etag!,snapshot:null};return {etag:response.headers.get("ETag")||"",snapshot:await ensureJson<import("@shadow-edge/shared-types").CombatSnapshot>(response)};
  },
  async getEntityRelations(campaignId,entityId,signal) {
    return request(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/entities/${encodeURIComponent(entityId)}/relations`,{signal});
  },
  async mutateEntityRelations(campaignId,entityId,input,targetId,remove) {
    return request(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/entities/${encodeURIComponent(entityId)}/relations${targetId?`/${encodeURIComponent(targetId)}`:""}`,{method:targetId?(remove?"DELETE":"PATCH"):"POST",body:JSON.stringify(input)});
  },
  async searchEntities(campaignId,params,signal) {
    const query=new URLSearchParams({kind:"all",limit:"24",...params});
    return request(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/entities?${query}`,{signal});
  },
  async getCampaign(campaignId) {
    return request<CampaignData>(`${baseUrl}/api/campaigns/${campaignId}`);
  },
  async browseBestiary(params) {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.challenge) search.set("challenge", params.challenge);
    if (params?.type) search.set("type", params.type);
    if (params?.namedNpc) search.set("namedNpc", "true");
    if (params?.classic) search.set("classic", "true");
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<BestiaryBrowseResult>(`${baseUrl}/api/bestiary${suffix}`);
  },
  async getBestiaryMonster(monsterId) {
    return request<BestiaryMonsterDetail>(`${baseUrl}/api/bestiary/${monsterId}`);
  },
  async browseItemCatalog(params) {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.source) search.set("source", params.source);
    if (params?.category) search.set("category", params.category);
    if (params?.armorType) search.set("armorType", params.armorType);
    for(const key of ["limit","cursor","sort","price","rarity"] as const)if(params?.[key])search.set(key,String(params[key]));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<ItemCatalogBrowseResult>(`${baseUrl}/api/items-catalog${suffix}`);
  },
  async getCatalogItem(itemId) {
    return request<ItemCatalogDetail>(`${baseUrl}/api/items-catalog/${itemId}`);
  },
  async importBestiaryMonster(campaignId, monsterId) {
    return request<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/bestiary/${monsterId}/import`, {
      method: "POST"
    });
  },
  async listSessionMaps(campaignId) {
    return request<import("@shadow-edge/shared-types").SessionMapDocument[]>(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-maps`);
  },
  async saveSessionMap(campaignId, map) {
    return request<import("@shadow-edge/shared-types").SessionMapDocument>(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-maps${map.id ? `/${encodeURIComponent(map.id)}` : ""}`, {
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
    return request<CampaignData>(`${baseUrl}/api/campaigns`, {
      method: "POST",
      body: JSON.stringify(input satisfies CreateCampaignInput)
    });
  },
  async updateCampaign(campaignId, input) {
    return request<CampaignData>(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies UpdateCampaignInput)
    });
  },
  async createEntity(campaignId, input) {
    return request<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/entities`, {
      method: "POST",
      body: JSON.stringify(input satisfies CreateEntityInput)
    });
  },
  async updateEntity(campaignId, entityId, input) {
    return request<CreateEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/entities/${entityId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  async deleteEntity(campaignId, entityId, expectedRevision) {
    return request<DeleteEntityResult>(`${baseUrl}/api/campaigns/${campaignId}/entities/${entityId}?expectedRevision=${expectedRevision}`, {
      method: "DELETE"
    });
  },
  async generateEntityDraft(campaignId, input, options) {
    return requestGeneration<GenerateEntityDraftResult>(`${baseUrl}/api/campaigns/${campaignId}/ai/drafts`, {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies GenerateEntityDraftInput)
    });
  },
  async listAIProposals(params) {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.campaignId) search.set("campaignId", params.campaignId);
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<AIProposal[]>(`${proposalRoutes.root}${suffix}`);
  },
  async getAIProposal(proposalId) {
    return request<AIProposal>(proposalRoutes.detail(proposalId));
  },
  async proposeEntity(campaignId, input, options) {
    return requestGeneration<AIProposal>(proposalRoutes.entity(campaignId), {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies ProposeEntityInput)
    });
  },
  async proposeCampaign(input, options) {
    return requestGeneration<AIProposal>(proposalRoutes.campaign, {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies ProposeCampaignInput)
    });
  },
  async proposeWorldEvent(campaignId, input, options) {
    return requestGeneration<AIProposal>(proposalRoutes.event(campaignId), {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies ProposeWorldEventInput)
    });
  },
  async applyAIProposal(proposalId, input = {}) {
    return request<AIProposalMutationResult>(proposalRoutes.action(proposalId, "apply"), {
      method: "POST",
      body: JSON.stringify(input satisfies ApplyAIProposalInput)
    });
  },
  async rejectAIProposal(proposalId) {
    return request<AIProposalMutationResult>(proposalRoutes.action(proposalId, "reject"), {
      method: "POST"
    });
  },
  async undoAIProposal(proposalId) {
    return request<AIProposalMutationResult>(proposalRoutes.action(proposalId, "undo"), {
      method: "POST"
    });
  },
  async attachAIProposalMedia(proposalId, input) {
    return request<AIProposalMediaResult>(proposalRoutes.mediaAttachments(proposalId), {
      method: "POST",
      body: JSON.stringify(input satisfies AttachAIProposalMediaInput)
    });
  },
  async getCodexConnectionStatus() {
    return request<CodexConnectionStatus>(codexRoutes.status);
  },
  async connectCodexChatGPT() {
    return request<CodexDeviceCodeResult>(codexRoutes.connect, {
      method: "POST"
    });
  },
  async disconnectCodexChatGPT() {
    return request<CodexConnectionStatus>(codexRoutes.disconnect, {
      method: "POST"
    });
  },
  async runCodexPrompt(input, options) {
    return requestGeneration<CodexPromptResult>(codexRoutes.prompts, {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies CodexPromptInput)
    });
  },
  async startCodexPrompt(input) {
    return startGeneration(codexRoutes.prompts, { method: "POST", body: JSON.stringify(input) });
  },
  async listAIJobs(campaignId) {
    return request<AIJob[]>(`${baseUrl}/api/ai/jobs${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`);
  },
  async getAIJob(id) {
    return request<AIJob>(`${baseUrl}/api/ai/jobs/${encodeURIComponent(id)}`);
  },
  async formatPlayerFacingCard(campaignId, input, options) {
    return requestGeneration<FormatPlayerFacingCardResult>(`${baseUrl}/api/campaigns/${campaignId}/ai/player-facing/format`, {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies FormatPlayerFacingCardInput)
    });
  },
  async createWorldEvent(campaignId, input) {
    return request<WorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events`, {
      method: "POST",
      body: JSON.stringify(input satisfies WorldEventInput)
    });
  },
  async updateWorldEvent(campaignId, eventId, input) {
    return request<WorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies WorldEventInput)
    });
  },
  async deleteWorldEvent(campaignId, eventId, expectedRevision) {
    return request<DeleteWorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/${eventId}?expectedRevision=${expectedRevision}`, {
      method: "DELETE"
    });
  },
  async generateWorldEvent(campaignId, input, options) {
    return requestGeneration<GenerateWorldEventResult>(`${baseUrl}/api/campaigns/${campaignId}/events/generate`, {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies GenerateWorldEventInput)
    });
  },
  async startCombat(campaignId, input) {
    return request<CombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/entries`, {
      method: "POST",
      body: JSON.stringify(input satisfies StartCombatInput)
    });
  },
  async updateCombatState(campaignId, input) {
    return request<CombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies UpdateCombatStateInput)
    });
  },
  async updateCombatEntry(campaignId, entryId, input) {
    return request<CombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(input satisfies UpdateCombatEntryInput)
    });
  },
  async finishCombat(campaignId) {
    return request<FinishCombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/finish`, {
      method: "POST"
    });
  },
  async createInitiativeShare(campaignId) {
    return request<InitiativeShareResult>(`${baseUrl}/api/campaigns/${campaignId}/initiative-share`, {
      method: "POST"
    });
  },
  async publishInitiativeShare(campaignId) {
    return request<InitiativeShareResult>(`${baseUrl}/api/campaigns/${campaignId}/initiative-share/publish`, {
      method: "POST"
    });
  },
  async showPlayerDisplayImage(campaignId, input) {
    return request<PlayerDisplayShareResult>(`${baseUrl}/api/campaigns/${campaignId}/player-display`, {
      method: "POST",
      body: JSON.stringify(input satisfies PlayerDisplayImageInput)
    });
  },
  async rotatePlayerDisplayLink(campaignId) {
    return request<PlayerDisplayShareResult>(`${baseUrl}/api/campaigns/${campaignId}/player-display/rotate`, {
      method: "POST"
    });
  },
  async generateCombat(campaignId, input, options) {
    return requestGeneration<GenerateCombatResult>(`${baseUrl}/api/campaigns/${campaignId}/combat/generate`, {
      method: "POST", signal:options?.signal,
      body: JSON.stringify(input satisfies GenerateCombatInput)
    });
  },
    async search(campaignId, query, signal) {
      return request<SearchResult[]>(
        `${baseUrl}/api/campaigns/${campaignId}/search?q=${encodeURIComponent(query)}`, { signal }
      );
    }
  };
};

export const createApiClient = (baseUrl = "",options:{workspace?:boolean}={}): ApiClient =>
  createHttpApiClient(baseUrl,options);
