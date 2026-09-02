import { isApiError } from "@shadow-edge/api-client";
import type {
  AIProposal,
  AIProposalMediaIntent,
  AIProposalMutationResult,
  CampaignData,
  CampaignSummary,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";

export type AIProposalPromptTarget =
  | { type: "entity"; entity: KnowledgeEntity }
  | { type: "campaign" };

export type EntityImageGenerationResult = {
  proposal: AIProposal;
  warning?: string;
};

const hasSelectedStagedArtPreview = (proposal: AIProposal) => {
  const candidates = proposal.mediaIntents.filter((intent) =>
    intent.field === "art.url"
    && intent.selected !== false
    && intent.status === "staged"
    && Boolean(intent.previewUrl)
  );
  return candidates.length === 1;
};

type UseAIProposalControllerArgs = {
  activeCampaign: CampaignData | null;
  activeCampaignId: string;
  authenticated: boolean;
  onCampaignChanged: (campaign: CampaignData, focusEntityId?: string) => void;
  onCampaignsChanged: (campaigns: CampaignSummary[]) => void;
};

const createIntentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createMediaIntents = (
  includeImage: boolean,
  target: AIProposalPromptTarget,
  prompt: string
): AIProposalMediaIntent[] | undefined => {
  if (!includeImage || target.type !== "entity") return undefined;

  const entity = target.entity;
  return [
    {
      id: createIntentId(),
      purpose: "selected-entity-art",
      field: "art.url",
      prompt: `Портрет или ключевой арт для «${entity.title}». Указание пользователя: ${prompt}`,
      status: "intent",
      selected: true
    }
  ];
};

export function useAIProposalController({
  activeCampaign,
  activeCampaignId,
  authenticated,
  onCampaignChanged,
  onCampaignsChanged
}: UseAIProposalControllerArgs) {
  const [proposals, setProposals] = useState<AIProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<AIProposal | null>(null);
  const [proposalCampaign, setProposalCampaign] = useState<CampaignData | null>(null);
  const [promptTarget, setPromptTarget] = useState<AIProposalPromptTarget | null>(null);
  const [prompt, setPrompt] = useState("");
  const [includeImage, setIncludeImage] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"create" | "apply" | "reject" | "undo" | "media" | null>(null);
  const [codexPromptRunning, setCodexPromptRunning] = useState(false);
  const [codexPromptOutcome, setCodexPromptOutcome] = useState<"error" | "warning" | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");

  const refresh = useCallback(async (silent = false) => {
    if (!authenticated) {
      setProposals([]);
      return [];
    }

    try {
      if (!silent) setLoading(true);
      const next = await api.listAIProposals({ status: "pending" });
      setProposals(next);
      if (!silent) setError("");
      return next;
    } catch (nextError) {
      if (!silent) {
        setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить AI-черновики.");
      }
      return undefined;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return undefined;
    void refresh(true);
    const interval = window.setInterval(() => void refresh(true), 45_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authenticated, refresh]);

  useEffect(() => {
    if (authenticated) return;
    setCodexPromptOutcome(null);
    setCodexPromptRunning(false);
    setInboxOpen(false);
  }, [authenticated]);

  const pendingCount = proposals.length;

  const openInbox = useCallback(() => {
    setInboxOpen(true);
    setCodexPromptOutcome(null);
    setError("");
    void refresh();
  }, [refresh]);

  const closeInbox = useCallback(() => setInboxOpen(false), []);

  const resolveProposalCampaign = useCallback(async (proposal: AIProposal) => {
    if (proposal.kind === "campaign_create") return null;
    const campaignId = proposal.campaignId || proposal.target.campaignId;
    if (!campaignId) return null;
    if (activeCampaign?.id === campaignId) return activeCampaign;
    return api.getCampaign(campaignId);
  }, [activeCampaign]);

  const openProposal = useCallback(async (proposalOrId: AIProposal | string) => {
    setError("");
    setConflict("");
    setLoading(true);
    try {
      const next = typeof proposalOrId === "string"
        ? await api.getAIProposal(proposalOrId)
        : await api.getAIProposal(proposalOrId.id);
      const contextCampaign = await resolveProposalCampaign(next);
      setSelectedProposal(next);
      setProposalCampaign(contextCampaign);
      setInboxOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось открыть AI-черновик.");
    } finally {
      setLoading(false);
    }
  }, [resolveProposalCampaign]);

  useEffect(() => {
    if (!selectedProposal || selectedProposal.kind === "campaign_create") return;
    const campaignId = selectedProposal.campaignId || selectedProposal.target.campaignId;
    if (activeCampaign?.id === campaignId) setProposalCampaign(activeCampaign);
  }, [activeCampaign, selectedProposal]);

  const closeProposal = useCallback(() => {
    if (action) return;
    setSelectedProposal(null);
    setProposalCampaign(null);
    setConflict("");
    setError("");
  }, [action]);

  const requestEntityProposal = useCallback((entity: KnowledgeEntity) => {
    setPromptTarget({ type: "entity", entity });
    setPrompt("");
    setIncludeImage(false);
    setError("");
  }, []);

  const requestCampaignProposal = useCallback(() => {
    setPromptTarget({ type: "campaign" });
    setPrompt("");
    setIncludeImage(false);
    setError("");
  }, []);

  const closePrompt = useCallback(() => {
    if (action === "create") return;
    setPromptTarget(null);
    setPrompt("");
    setIncludeImage(false);
    setError("");
  }, [action]);

  const submitPrompt = useCallback(async () => {
    const normalizedPrompt = prompt.trim();
    if (!promptTarget || !normalizedPrompt) {
      setError("Опиши, что именно должен подготовить AI.");
      return;
    }

    if (promptTarget.type === "entity" && !activeCampaignId) {
      setError("Сначала открой кампанию.");
      return;
    }

    setAction("create");
    setError("");
    try {
      const mediaIntents = createMediaIntents(includeImage, promptTarget, normalizedPrompt);
      const created = promptTarget.type === "entity"
        ? await api.proposeEntity(activeCampaignId, {
            mode: "update",
            kind: promptTarget.entity.kind,
            entityId: promptTarget.entity.id,
            prompt: normalizedPrompt,
            source: { type: "website_ai" },
            mediaIntents
          })
        : await api.proposeCampaign({
            prompt: normalizedPrompt,
            source: { type: "website_ai" },
            mediaIntents
          });

      setPromptTarget(null);
      setPrompt("");
      setIncludeImage(false);
      setSelectedProposal(created);
      setProposalCampaign(promptTarget.type === "entity" ? activeCampaign : null);
      setProposals((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      void refresh(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось подготовить AI-черновик.");
    } finally {
      setAction(null);
    }
  }, [activeCampaign, activeCampaignId, includeImage, prompt, promptTarget, refresh]);

  const generateEntityImageProposal = useCallback(async (
    entity: KnowledgeEntity,
    direction?: string
  ): Promise<EntityImageGenerationResult> => {
    if (!activeCampaignId) {
      throw new Error("Сначала открой кампанию.");
    }
    if (codexPromptRunning) {
      throw new Error("Codex уже выполняет другой запрос. Дождись его завершения или проверь AI-черновики.");
    }

    setCodexPromptRunning(true);
    setCodexPromptOutcome(null);
    try {
      const result = await api.runCodexPrompt({
        campaignId: activeCampaignId,
        imageTarget: {
          entityId: entity.id,
          entityKind: entity.kind
        },
        includeImages: true,
        prompt: direction?.trim() ?? ""
      });
      const returned = await Promise.all(result.proposalIds.map((proposalId) => api.getAIProposal(proposalId)));
      const created = returned.filter((proposal) =>
        proposal.status === "pending"
        && proposal.target.entityId === entity.id
        && proposal.target.entityKind === entity.kind
      );
      const proposal = created.find(hasSelectedStagedArtPreview) ?? created[0];
      if (!proposal) {
        const serverDetail = result.warning?.trim() ? ` ${result.warning.trim()}` : "";
        if (!returned.length) {
          throw new Error(`Codex завершил запрос без нового AI-черновика. Обычно это значит, что инструмент создания черновика не был успешно вызван. Кампания не изменилась.${serverDetail}`);
        }
        if (returned.some((candidate) => candidate.target.entityId !== entity.id || candidate.target.entityKind !== entity.kind)) {
          throw new Error(`Codex создал черновик не для этой карточки, поэтому он не был принят как результат. Кампания не изменилась; проверь очередь и отклони лишний черновик.${serverDetail}`);
        }
        throw new Error(`Codex вернул черновик, но он уже не ожидает проверки. Обнови очередь AI-черновиков и повтори генерацию.${serverDetail}`);
      }

      setProposals((current) => [
        ...created,
        ...current.filter((item) => !created.some((candidate) => candidate.id === item.id))
      ]);
      const hasPreview = hasSelectedStagedArtPreview(proposal);
      const warning = result.warning?.trim()
        || (!hasPreview
          ? "Черновик сохранён, но генератор не вернул изображение. Открой черновик, чтобы проверить подробности."
          : undefined);
      setCodexPromptOutcome(warning ? "warning" : null);
      void refresh(true);
      return { proposal, warning };
    } catch (nextError) {
      setCodexPromptOutcome("error");
      throw nextError;
    } finally {
      setCodexPromptRunning(false);
    }
  }, [activeCampaignId, codexPromptRunning, refresh]);

  const syncMutationResult = useCallback(async (result: AIProposalMutationResult) => {
    const campaignId = result.campaign?.id ?? result.proposal.campaignId ?? result.proposal.target.campaignId;
    if (result.campaign) {
      setProposalCampaign(result.campaign);
      onCampaignChanged(result.campaign, result.entity?.id);
    } else if (result.proposal.kind !== "campaign_create" && campaignId && campaignId === activeCampaignId) {
      const latestCampaign = await api.getCampaign(campaignId);
      setProposalCampaign(latestCampaign);
      onCampaignChanged(latestCampaign, result.entity?.id);
    } else if (result.proposal.kind === "campaign_create" && result.proposal.status === "undone") {
      setProposalCampaign(null);
    }

    if (result.proposal.kind === "campaign_create" || result.campaign) {
      onCampaignsChanged(await api.listCampaigns());
    }
  }, [activeCampaignId, onCampaignChanged, onCampaignsChanged]);

  const runMutation = useCallback(async (
    nextAction: "apply" | "reject" | "undo",
    execute: () => Promise<AIProposalMutationResult>
  ) => {
    setAction(nextAction);
    setError("");
    setConflict("");
    try {
      const result = await execute();
      setSelectedProposal(result.proposal);
      setProposals((current) =>
        result.proposal.status === "pending"
          ? [result.proposal, ...current.filter((item) => item.id !== result.proposal.id)]
          : current.filter((item) => item.id !== result.proposal.id)
      );
      await syncMutationResult(result);
      void refresh(true);
      return result;
    } catch (nextError) {
      if (isApiError(nextError) && nextError.code === "stale_revision") {
        setConflict("Данные изменились после создания черновика. Обнови карточку и попроси AI подготовить предложение заново.");
      } else {
        setError(nextError instanceof Error ? nextError.message : "Не удалось обработать AI-черновик.");
      }
      return null;
    } finally {
      setAction(null);
    }
  }, [refresh, syncMutationResult]);

  const applyProposal = useCallback(async (selectedOperationKeys?: string[]) => {
    if (!selectedProposal) return null;
    return runMutation("apply", () =>
      api.applyAIProposal(selectedProposal.id, selectedOperationKeys ? { selectedOperationKeys } : undefined)
    );
  }, [runMutation, selectedProposal]);

  const rejectProposal = useCallback(async () => {
    if (!selectedProposal) return null;
    return runMutation("reject", () => api.rejectAIProposal(selectedProposal.id));
  }, [runMutation, selectedProposal]);

  const undoProposal = useCallback(async () => {
    if (!selectedProposal) return null;
    return runMutation("undo", () => api.undoAIProposal(selectedProposal.id));
  }, [runMutation, selectedProposal]);

  const setProposalMediaSelected = useCallback(async (mediaId: string, selected: boolean) => {
    if (!selectedProposal || selectedProposal.status !== "pending") return null;
    setAction("media");
    setError("");
    try {
      const result = await api.attachAIProposalMedia(selectedProposal.id, { mediaId, selected });
      setSelectedProposal(result.proposal);
      setProposals((current) => [result.proposal, ...current.filter((item) => item.id !== result.proposal.id)]);
      return result;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось изменить выбор изображения.");
      return null;
    } finally {
      setAction(null);
    }
  }, [selectedProposal]);

  return {
    action,
    applyProposal,
    closeInbox,
    closePrompt,
    closeProposal,
    codexPromptOutcome,
    codexPromptRunning,
    conflict,
    error,
    generateEntityImageProposal,
    inboxOpen,
    includeImage,
    loading,
    openInbox,
    openProposal,
    pendingCount,
    prompt,
    promptTarget,
    proposalCampaign,
    proposals,
    refresh,
    rejectProposal,
    requestCampaignProposal,
    requestEntityProposal,
    selectedProposal,
    setIncludeImage,
    setCodexPromptOutcome,
    setCodexPromptRunning,
    setProposalMediaSelected,
    setPrompt,
    submitPrompt,
    undoProposal
  };
}

export type AIProposalController = ReturnType<typeof useAIProposalController>;
