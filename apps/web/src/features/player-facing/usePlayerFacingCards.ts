import { useMemo, useState } from "react";
import type {
  CampaignData,
  CreateEntityInput,
  EntityKind,
  FormatPlayerFacingCardResult,
  KnowledgeEntity,
  PlayerFacingCard
} from "@shadow-edge/shared-types";
import {
  extractPlainTextFromPlayerFacingHTML,
  sanitizePlayerFacingHTML
} from "../../player-facing-rich";
import { api } from "../../app/api";

export type PlayerFacingViewState = {
  entityId: string;
  title?: string;
  content: string;
  contentHtml?: string;
  cardIndex?: number;
  editMode?: boolean;
  isNew?: boolean;
};

type RequestModalClose = (
  title: string,
  onConfirm: () => void,
  description?: string,
  confirmLabel?: string
) => void;

export type UsePlayerFacingCardsParams = {
  activeCampaignId: string;
  entityMap: Map<string, KnowledgeEntity>;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  hydrateCampaign: (campaign: CampaignData, focusEntityId?: string) => void;
  requestModalClose?: RequestModalClose;
  serializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
  setBootError: (value: string) => void;
  setSaving: (value: boolean) => void;
  setPreviewEntityId: (value: string) => void;
};

export const createEmptyPlayerFacingCard = (title = ""): PlayerFacingCard => ({
  title,
  content: "",
  contentHtml: ""
});

export const defaultPlayerFacingCardTitle = (_kind: EntityKind, index: number) =>
  index === 0 ? "Игроки видят" : `Карточка ${index + 1}`;

export const normalizePlayerFacingCardsForClient = (
  kind: EntityKind,
  cards?: PlayerFacingCard[],
  legacyContent?: string
): PlayerFacingCard[] => {
  const normalized = (cards ?? [])
    .map((card) => ({
      title: card.title.trim(),
      content: card.content.trim(),
      contentHtml: sanitizePlayerFacingHTML(card.contentHtml)
    }))
    .map((card) => ({
      ...card,
      content: card.content || extractPlainTextFromPlayerFacingHTML(card.contentHtml)
    }))
    .filter((card) => card.title || card.content || card.contentHtml)
    .filter((card) => card.content)
    .map((card, index) => ({
      title: card.title || defaultPlayerFacingCardTitle(kind, index),
      content: card.content,
      contentHtml: card.contentHtml || undefined
    }));

  if (!normalized.length && legacyContent?.trim()) {
    return [
      {
        title: defaultPlayerFacingCardTitle(kind, 0),
        content: legacyContent.trim(),
        contentHtml: ""
      }
    ];
  }

  return normalized;
};

export const sanitizeSinglePlayerFacingCard = (
  kind: EntityKind,
  card: PlayerFacingCard,
  index: number
): PlayerFacingCard | null => {
  const title = card.title.trim();
  const contentHtml = sanitizePlayerFacingHTML(card.contentHtml);
  const content = card.content.trim() || extractPlainTextFromPlayerFacingHTML(contentHtml);

  if (!title && !content && !contentHtml) {
    return null;
  }

  if (!content) {
    return null;
  }

  return {
    title: title || defaultPlayerFacingCardTitle(kind, index),
    content,
    contentHtml: contentHtml || undefined
  };
};

export const sanitizePlayerFacingCards = (kind: EntityKind, cards: PlayerFacingCard[] = [], legacyContent?: string) => {
  const normalized = cards
    .map((card, index) => sanitizeSinglePlayerFacingCard(kind, card, index))
    .filter((card): card is PlayerFacingCard => Boolean(card));

  if (!normalized.length && legacyContent?.trim()) {
    return [
      {
        title: defaultPlayerFacingCardTitle(kind, 0),
        content: legacyContent.trim(),
        contentHtml: undefined
      }
    ];
  }

  return normalized;
};

export type PlayerFacingCardsController = ReturnType<typeof usePlayerFacingCards>;

export function usePlayerFacingCards({
  activeCampaignId,
  entityMap,
  entityToForm,
  hydrateCampaign,
  requestModalClose,
  serializeEntityForm,
  setBootError,
  setSaving,
  setPreviewEntityId
}: UsePlayerFacingCardsParams) {
  const [playerFacingView, setPlayerFacingView] = useState<PlayerFacingViewState | null>(null);
  const [playerFacingModalSaving, setPlayerFacingModalSaving] = useState(false);
  const [playerFacingModalFormatting, setPlayerFacingModalFormatting] = useState(false);

  const playerFacingEntity =
    playerFacingView?.entityId && entityMap.has(playerFacingView.entityId) ? entityMap.get(playerFacingView.entityId) ?? null : null;

  const openPlayerFacingView = (
    entity: KnowledgeEntity,
    card?: PlayerFacingCard,
    options?: { cardIndex?: number; editMode?: boolean; isNew?: boolean }
  ) => {
    const normalizedCards = normalizePlayerFacingCardsForClient(entity.kind, entity.playerCards, entity.playerContent);
    const selectedCard =
      card && (options?.editMode || options?.isNew || card.title.trim() || card.content.trim() || card.contentHtml?.trim())
        ? card
        : normalizedCards[options?.cardIndex ?? 0] ?? normalizedCards[0];
    const content =
      selectedCard?.content?.trim() || (!options?.editMode && !options?.isNew ? entity.playerContent?.trim() || "" : "");
    const contentHtml = selectedCard?.contentHtml?.trim() || undefined;

    if (!content && !contentHtml && !options?.editMode) {
      setBootError("Для этой сущности пока не заполнена отдельная версия для игроков.");
      return;
    }

    setBootError("");
    setPlayerFacingView({
      entityId: entity.id,
      title: selectedCard?.title?.trim() || entity.title,
      content,
      contentHtml,
      cardIndex: options?.cardIndex,
      editMode: options?.editMode ?? false,
      isNew: options?.isNew ?? false
    });
  };

  const openPlayerFacingEditor = (entity: KnowledgeEntity, card: PlayerFacingCard, cardIndex: number, isNew = false) => {
    openPlayerFacingView(entity, card, { cardIndex, editMode: true, isNew });
  };

  const openNewPlayerFacingEditor = (entity: KnowledgeEntity) => {
    const nextIndex = normalizePlayerFacingCardsForClient(entity.kind, entity.playerCards, entity.playerContent).length;
    openPlayerFacingEditor(entity, createEmptyPlayerFacingCard(defaultPlayerFacingCardTitle(entity.kind, nextIndex)), nextIndex, true);
  };

  const closePlayerFacingView = () => {
    setPlayerFacingView(null);
  };

  const enterPlayerFacingEditMode = () => {
    if (!playerFacingView || !playerFacingEntity) {
      return;
    }

    const cardIndex = playerFacingView.cardIndex ?? 0;
    const cards = normalizePlayerFacingCardsForClient(
      playerFacingEntity.kind,
      playerFacingEntity.playerCards,
      playerFacingEntity.playerContent
    );
    const card =
      cards[cardIndex] ??
      createEmptyPlayerFacingCard(defaultPlayerFacingCardTitle(playerFacingEntity.kind, cardIndex));

    openPlayerFacingEditor(playerFacingEntity, card, cardIndex, Boolean(playerFacingView.isNew));
  };

  const cancelPlayerFacingEditMode = () => {
    if (!playerFacingView || !playerFacingEntity) {
      closePlayerFacingView();
      return;
    }

    if (playerFacingView.isNew) {
      closePlayerFacingView();
      return;
    }

    const cardIndex = playerFacingView.cardIndex ?? 0;
    const cards = normalizePlayerFacingCardsForClient(
      playerFacingEntity.kind,
      playerFacingEntity.playerCards,
      playerFacingEntity.playerContent
    );
    const card = cards[cardIndex];

    if (!card) {
      closePlayerFacingView();
      return;
    }

    openPlayerFacingView(playerFacingEntity, card, { cardIndex, editMode: false, isNew: false });
  };

  const savePlayerFacingCardFromModal = async (card: PlayerFacingCard) => {
    if (!activeCampaignId || !playerFacingEntity) {
      return;
    }

    const cardIndex =
      playerFacingView?.cardIndex ??
      normalizePlayerFacingCardsForClient(
        playerFacingEntity.kind,
        playerFacingEntity.playerCards,
        playerFacingEntity.playerContent
      ).length;
    const normalizedCard = sanitizeSinglePlayerFacingCard(playerFacingEntity.kind, card, cardIndex);

    if (!normalizedCard) {
      setBootError("Добавь текст в карточку, а потом уже сохраняй её.");
      return;
    }

    try {
      setPlayerFacingModalSaving(true);
      setBootError("");
      const nextForm = entityToForm(playerFacingEntity);
      const nextCards = [...(nextForm.playerCards ?? [])];

      if (cardIndex >= nextCards.length) {
        nextCards.push(normalizedCard);
      } else {
        nextCards[cardIndex] = normalizedCard;
      }

      nextForm.playerCards = nextCards;
      const result = await api.updateEntity(activeCampaignId, playerFacingEntity.id, serializeEntityForm(nextForm));
      hydrateCampaign(result.campaign, result.entity.id);
      setPreviewEntityId(result.entity.id);

      const updatedEntity = result.entity.kind === playerFacingEntity.kind ? result.entity : playerFacingEntity;
      const updatedCards = normalizePlayerFacingCardsForClient(
        updatedEntity.kind,
        updatedEntity.playerCards,
        updatedEntity.playerContent
      );
      const resolvedIndex = Math.min(cardIndex, Math.max(updatedCards.length - 1, 0));
      openPlayerFacingView(updatedEntity, updatedCards[resolvedIndex], {
        cardIndex: resolvedIndex,
        editMode: false,
        isNew: false
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить карточку для игроков.");
    } finally {
      setPlayerFacingModalSaving(false);
    }
  };

  const requestPlayerFacingCardDeletion = (entity: KnowledgeEntity, card: PlayerFacingCard, cardIndex: number) => {
    if (!activeCampaignId) {
      return;
    }

    const runDeletion = () => {
      void (async () => {
        try {
          setSaving(true);
          setBootError("");

          const nextForm = entityToForm(entity);
          nextForm.playerCards = normalizePlayerFacingCardsForClient(entity.kind, entity.playerCards, entity.playerContent).filter(
            (_, index) => index !== cardIndex
          );
          nextForm.playerContent = nextForm.playerCards[0]?.content ?? "";

          const result = await api.updateEntity(activeCampaignId, entity.id, serializeEntityForm(nextForm));
          hydrateCampaign(result.campaign, result.entity.id);
          setPreviewEntityId(result.entity.id);

          if (playerFacingView?.entityId === entity.id && playerFacingView.cardIndex === cardIndex) {
            closePlayerFacingView();
          }
        } catch (error) {
          setBootError(error instanceof Error ? error.message : "Не удалось удалить карточку для игроков.");
        } finally {
          setSaving(false);
        }
      })();
    };

    if (requestModalClose) {
      requestModalClose(
        `Удалить карточку «${card.title}»?`,
        runDeletion,
        "Карточка исчезнет из сущности сразу после подтверждения.",
        "Удалить"
      );
      return;
    }

    if (window.confirm(`Удалить карточку «${card.title}»?`)) {
      runDeletion();
    }
  };

  const formatPlayerFacingCardFromModal = async (card: PlayerFacingCard) => {
    if (!activeCampaignId || !playerFacingEntity) {
      return undefined;
    }

    const sourceText = card.content.trim() || extractPlainTextFromPlayerFacingHTML(card.contentHtml);
    if (!sourceText) {
      throw new Error("Сначала добавь текст в карточку, а потом уже проси AI оформить его.");
    }

    try {
      setPlayerFacingModalFormatting(true);
      setBootError("");
      const result: FormatPlayerFacingCardResult = await api.formatPlayerFacingCard(activeCampaignId, {
        title: card.title.trim(),
        content: sourceText,
        contentHtml: card.contentHtml,
        entityId: playerFacingEntity.id,
        entityKind: playerFacingEntity.kind
      });
      const cardIndex = playerFacingView?.cardIndex ?? 0;
      return (
        sanitizeSinglePlayerFacingCard(playerFacingEntity.kind, result.card, cardIndex) ?? {
          title: card.title.trim() || defaultPlayerFacingCardTitle(playerFacingEntity.kind, cardIndex),
          content: result.card.content || sourceText,
          contentHtml: sanitizePlayerFacingHTML(result.card.contentHtml) || undefined
        }
      );
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось оформить карточку игроков через AI.");
      throw error;
    } finally {
      setPlayerFacingModalFormatting(false);
    }
  };

  return {
    cancelPlayerFacingEditMode,
    closePlayerFacingView,
    enterPlayerFacingEditMode,
    formatPlayerFacingCardFromModal,
    openNewPlayerFacingEditor,
    openPlayerFacingEditor,
    openPlayerFacingView,
    playerFacingEntity,
    playerFacingModalFormatting,
    playerFacingModalSaving,
    playerFacingView,
    requestPlayerFacingCardDeletion,
    savePlayerFacingCardFromModal
  };
}
