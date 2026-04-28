import { useRef, useState, type FormEvent } from "react";
import type {
  AbilityKey,
  CampaignData,
  CreateEntityInput,
  CreateEntityResult,
  EntityKind,
  FormatPlayerFacingCardResult,
  GenerateEntityDraftResult,
  GalleryImage,
  KnowledgeEntity,
  MonsterLootEntry,
  MonsterRewardProfile,
  NpcEntity,
  NpcStatBlock,
  PlayerFacingCard,
  PlaylistTrack,
  SpellSlotSummary,
  SpellcastingBlock,
  StatBlockEntry
} from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import {
  extractPlainTextFromPlayerFacingHTML,
  preparePlayerFacingHTMLImport
} from "../../player-facing-rich";
import {
  createEmptyPlayerFacingCard,
  defaultPlayerFacingCardTitle
} from "../player-facing/usePlayerFacingCards";
import type {
  EntityModalMode,
  EntityTextField,
  StatEntrySectionKey
} from "./entity.types";
import {
  createEmptyGalleryImage,
  createEmptyMonsterLootEntry,
  createEmptyMonsterRewardProfile,
  createEmptyNpcStatBlock,
  createEmptyPlaylistTrack,
  createEmptySpellcasting,
  createEmptySpellSlot,
  createEmptyStatEntry,
  emptyEntityForm,
  imageTitleFromFileName
} from "./entity.utils";

type PersistEntityPayload = (args: {
  payload: CreateEntityInput;
  mode: EntityModalMode;
  editingId?: string;
  linkedIssuerDraft?: CreateEntityInput | null;
}) => Promise<CreateEntityResult>;

type UseEntityEditorControllerParams = {
  activeCampaignId: string;
  applyCreatedEntity: (result: CreateEntityResult) => void;
  defaultCreateKind: EntityKind;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  entityMap: Map<string, KnowledgeEntity>;
  onEntityDeleted: (result: { campaign: CampaignData; entityId: string; kind: EntityKind }) => void;
  persistEntityPayload: PersistEntityPayload;
  resetEntityLinkState: () => void;
  serializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
  setBootError: (value: string) => void;
  setGenerating: (value: boolean) => void;
  setSaving: (value: boolean) => void;
  uploadCampaignImage: (file: File) => Promise<{ url: string }>;
};

export type EntityEditorController = ReturnType<typeof useEntityEditorController>;

export function useEntityEditorController({
  activeCampaignId,
  applyCreatedEntity,
  defaultCreateKind,
  entityMap,
  entityToForm,
  onEntityDeleted,
  persistEntityPayload,
  resetEntityLinkState,
  serializeEntityForm,
  setBootError,
  setGenerating,
  setSaving,
  uploadCampaignImage
}: UseEntityEditorControllerParams) {
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [entityModalMode, setEntityModalMode] = useState<EntityModalMode>("create");
  const [editingEntityId, setEditingEntityId] = useState("");
  const [entityModalSourceNpcId, setEntityModalSourceNpcId] = useState("");
  const [generatedQuestIssuerDraft, setGeneratedQuestIssuerDraft] = useState<CreateEntityInput | null>(null);
  const [generatedQuestIssuerNote, setGeneratedQuestIssuerNote] = useState("");
  const [entityForm, setEntityForm] = useState<CreateEntityInput>(emptyEntityForm);
  const [entityArtUploading, setEntityArtUploading] = useState(false);
  const [galleryUploadKey, setGalleryUploadKey] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [playerCardFormattingIndex, setPlayerCardFormattingIndex] = useState<number | null>(null);

  const entityContentRef = useRef<HTMLTextAreaElement | null>(null);
  const entityPlayerContentRef = useRef<HTMLTextAreaElement | null>(null);
  const playerCardImportInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const openEntityModal = (kind: EntityKind = defaultCreateKind) => {
    setBootError("");
    setGenerating(false);
    setEntityModalMode("create");
    setEditingEntityId("");
    setEntityModalSourceNpcId("");
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt("");
    setDraftNotes([]);
    resetEntityLinkState();
    setEntityForm(emptyEntityForm(kind));
    setEntityModalOpen(true);
  };

  const openEntityEditor = (entityId: string) => {
    const entity = entityMap.get(entityId);
    if (!entity) {
      return;
    }

    setBootError("");
    setGenerating(false);
    setEntityModalMode("edit");
    setEditingEntityId(entityId);
    setEntityModalSourceNpcId("");
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt("");
    setDraftNotes([]);
    resetEntityLinkState();
    setEntityForm(entityToForm(entity));
    setEntityModalOpen(true);
  };

  const openNpcQuestModal = (npc: NpcEntity) => {
    setBootError("");
    setGenerating(false);
    setEntityModalMode("create");
    setEditingEntityId("");
    setEntityModalSourceNpcId(npc.id);
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt(`Создай квест для НПС ${npc.title}. Контекст НПС: ${npc.summary}`);
    setDraftNotes([]);
    resetEntityLinkState();
    setEntityForm({
      ...emptyEntityForm("quest"),
      subtitle: npc.title ? `Квест от ${npc.title}` : "",
      issuerId: npc.id,
      related: [
        {
          id: npc.id,
          kind: "npc",
          label: npc.title,
          reason: "Этот НПС выдаёт, сопровождает или двигает этот квест."
        }
      ]
    });
    setEntityModalOpen(true);
  };

  const closeEntityModal = () => {
    setBootError("");
    setGenerating(false);
    setEntityModalOpen(false);
    setEntityModalMode("create");
    setEditingEntityId("");
    setEntityModalSourceNpcId("");
    setEntityArtUploading(false);
    setGalleryUploadKey("");
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt("");
    setDraftNotes([]);
    resetEntityLinkState();
  };

  const updateEntityForm = (updater: (current: CreateEntityInput) => CreateEntityInput) => {
    setEntityForm((current) => updater(current));
  };

  const updateEntityPlayerCard = (index: number, patch: Partial<PlayerFacingCard>) => {
    updateEntityForm((current) => ({
      ...current,
      playerCards: (current.playerCards ?? []).map((card, cardIndex) => {
        if (cardIndex !== index) {
          return card;
        }

        const nextCard = { ...card, ...patch };
        if ("content" in patch && !("contentHtml" in patch)) {
          nextCard.contentHtml = "";
        }
        return nextCard;
      })
    }));
  };

  const addEntityPlayerCard = () => {
    updateEntityForm((current) => {
      const nextIndex = (current.playerCards ?? []).length;
      return {
        ...current,
        playerCards: [...(current.playerCards ?? []), createEmptyPlayerFacingCard(defaultPlayerFacingCardTitle(current.kind, nextIndex))]
      };
    });
  };

  const removeEntityPlayerCard = (index: number) => {
    updateEntityForm((current) => ({
      ...current,
      playerCards: (current.playerCards ?? []).filter((_, cardIndex) => cardIndex !== index)
    }));
  };

  const applyImportedPlayerFacingCardHtml = (index: number, rawHtml: string) => {
    const imported = preparePlayerFacingHTMLImport(rawHtml);
    if (!imported.content && !imported.contentHtml) {
      throw new Error("HTML-фрагмент пустой или после очистки в нём не осталось безопасного содержимого.");
    }

    updateEntityForm((current) => ({
      ...current,
      playerCards: (current.playerCards ?? []).map((card, cardIndex) => {
        if (cardIndex !== index) {
          return card;
        }

        const currentTitle = card.title.trim();
        const fallbackTitle = defaultPlayerFacingCardTitle(current.kind, index);
        const nextTitle = !currentTitle || currentTitle === fallbackTitle ? imported.title || currentTitle || fallbackTitle : card.title;

        return {
          ...card,
          title: nextTitle,
          content: imported.content || card.content,
          contentHtml: imported.contentHtml
        };
      })
    }));
  };

  const handleEntityPlayerCardHtmlImport = async (index: number, event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    try {
      setBootError("");
      applyImportedPlayerFacingCardHtml(index, await file.text());
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось импортировать HTML в карточку игроков.");
    }
  };

  const openEntityPlayerCardHtmlImport = (index: number) => {
    playerCardImportInputRefs.current[index]?.click();
  };

  const readPlayerFacingHtmlFromClipboard = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("Буфер обмена недоступен в этом браузере.");
    }

    if ("read" in navigator.clipboard) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          return await blob.text();
        }
      }
    }

    if ("readText" in navigator.clipboard) {
      return await navigator.clipboard.readText();
    }

    throw new Error("Не получилось прочитать HTML из буфера обмена.");
  };

  const pasteEntityPlayerCardHtmlFromClipboard = async (index: number) => {
    try {
      setBootError("");
      applyImportedPlayerFacingCardHtml(index, await readPlayerFacingHtmlFromClipboard());
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось вставить HTML из буфера обмена.");
    }
  };

  const clearEntityPlayerCardHtml = (index: number) => {
    updateEntityPlayerCard(index, { contentHtml: "" });
  };

  const autoFormatEntityPlayerCard = async (index: number) => {
    if (!activeCampaignId) {
      return;
    }

    const card = (entityForm.playerCards ?? [])[index];
    if (!card) {
      return;
    }

    const sourceText = card.content.trim() || extractPlainTextFromPlayerFacingHTML(card.contentHtml);
    if (!sourceText) {
      setBootError("Сначала добавь текст в карточку, а потом уже проси AI оформить его.");
      return;
    }

    try {
      setBootError("");
      setPlayerCardFormattingIndex(index);
      const result: FormatPlayerFacingCardResult = await api.formatPlayerFacingCard(activeCampaignId, {
        title: card.title,
        content: sourceText,
        contentHtml: card.contentHtml,
        entityId: editingEntityId || undefined,
        entityKind: entityForm.kind
      });
      updateEntityPlayerCard(index, {
        title: result.card.title || card.title,
        content: result.card.content,
        contentHtml: result.card.contentHtml ?? ""
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось оформить карточку игроков через AI.");
    } finally {
      setPlayerCardFormattingIndex(null);
    }
  };

  const uploadEntityArtFile = async (file: File) => {
    try {
      setBootError("");
      setEntityArtUploading(true);
      const uploaded = await uploadCampaignImage(file);
      const suggestedAlt = imageTitleFromFileName(file.name);

      updateEntityForm((current) => ({
        ...current,
        art: {
          ...(current.art ?? {}),
          url: uploaded.url,
          alt: current.art?.alt?.trim() || current.title.trim() || suggestedAlt
        }
      }));
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось загрузить изображение в приложение.");
    } finally {
      setEntityArtUploading(false);
    }
  };

  const uploadEntityGalleryFile = async (index: number, file: File) => {
    try {
      setBootError("");
      setGalleryUploadKey(`entity-form:${index}`);
      const uploaded = await uploadCampaignImage(file);

      updateEntityForm((current) => {
        const nextGallery = [...(current.gallery ?? [])];
        const existing = nextGallery[index] ?? createEmptyGalleryImage();
        nextGallery[index] = {
          ...existing,
          title: existing.title.trim() || imageTitleFromFileName(file.name) || `Изображение ${index + 1}`,
          url: uploaded.url
        };
        return {
          ...current,
          gallery: nextGallery
        };
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось загрузить изображение в галерею.");
    } finally {
      setGalleryUploadKey("");
    }
  };

  const updateEntityPlaylistTrack = (index: number, patch: Partial<PlaylistTrack>) => {
    updateEntityForm((current) => ({
      ...current,
      playlist: (current.playlist ?? []).map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track))
    }));
  };

  const addEntityPlaylistTrack = () => {
    updateEntityForm((current) => ({
      ...current,
      playlist: [...(current.playlist ?? []), createEmptyPlaylistTrack()]
    }));
  };

  const removeEntityPlaylistTrack = (index: number) => {
    updateEntityForm((current) => ({
      ...current,
      playlist: (current.playlist ?? []).filter((_, trackIndex) => trackIndex !== index)
    }));
  };

  const updateEntityGalleryItem = (index: number, patch: Partial<GalleryImage>) => {
    updateEntityForm((current) => ({
      ...current,
      gallery: (current.gallery ?? []).map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    }));
  };

  const addEntityGalleryItem = () => {
    updateEntityForm((current) => ({
      ...current,
      gallery: [...(current.gallery ?? []), createEmptyGalleryImage()]
    }));
  };

  const removeEntityGalleryItem = (index: number) => {
    updateEntityForm((current) => ({
      ...current,
      gallery: (current.gallery ?? []).filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const updateNpcStatBlock = (updater: (current: NpcStatBlock) => NpcStatBlock) => {
    updateEntityForm((current) => {
      if (current.kind !== "npc" && current.kind !== "monster") {
        return current;
      }

      return {
        ...current,
        statBlock: updater(current.statBlock ?? createEmptyNpcStatBlock())
      };
    });
  };

  const updateNpcAbilityScore = (key: AbilityKey, value: string) => {
    updateNpcStatBlock((current) => ({
      ...current,
      abilityScores: {
        ...current.abilityScores,
        [key]: Number.parseInt(value, 10) || 0
      }
    }));
  };

  const updateNpcStatEntry = (section: StatEntrySectionKey, index: number, patch: Partial<StatBlockEntry>) => {
    updateNpcStatBlock((current) => {
      const entries = [...(current[section] ?? [])];
      entries[index] = {
        ...entries[index],
        ...patch
      };
      return {
        ...current,
        [section]: entries
      };
    });
  };

  const addNpcStatEntry = (section: StatEntrySectionKey) => {
    updateNpcStatBlock((current) => ({
      ...current,
      [section]: [...(current[section] ?? []), createEmptyStatEntry()]
    }));
  };

  const removeNpcStatEntry = (section: StatEntrySectionKey, index: number) => {
    updateNpcStatBlock((current) => ({
      ...current,
      [section]: (current[section] ?? []).filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const setSpellcastingEnabled = (enabled: boolean) => {
    updateNpcStatBlock((current) => ({
      ...current,
      spellcasting: enabled ? current.spellcasting ?? createEmptySpellcasting() : null
    }));
  };

  const updateNpcSpellcasting = (updater: (current: SpellcastingBlock) => SpellcastingBlock) => {
    updateNpcStatBlock((current) => ({
      ...current,
      spellcasting: updater(current.spellcasting ?? createEmptySpellcasting())
    }));
  };

  const addSpellSlot = () => {
    updateNpcSpellcasting((current) => ({
      ...current,
      slots: [...(current.slots ?? []), createEmptySpellSlot()]
    }));
  };

  const updateSpellSlot = (index: number, patch: Partial<SpellSlotSummary>) => {
    updateNpcSpellcasting((current) => ({
      ...current,
      slots: (current.slots ?? []).map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot))
    }));
  };

  const removeSpellSlot = (index: number) => {
    updateNpcSpellcasting((current) => ({
      ...current,
      slots: (current.slots ?? []).filter((_, slotIndex) => slotIndex !== index)
    }));
  };

  const updateEntityRewardProfile = (updater: (current: MonsterRewardProfile) => MonsterRewardProfile) => {
    updateEntityForm((current) => {
      if (current.kind !== "npc" && current.kind !== "monster" && current.kind !== "quest") {
        return current;
      }

      return {
        ...current,
        rewardProfile: updater(current.rewardProfile ?? createEmptyMonsterRewardProfile())
      };
    });
  };

  const updateMonsterLootEntry = (index: number, patch: Partial<MonsterLootEntry>) => {
    updateEntityRewardProfile((current) => ({
      ...current,
      loot: current.loot.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry))
    }));
  };

  const addMonsterLootEntry = () => {
    updateEntityRewardProfile((current) => ({
      ...current,
      loot: [...current.loot, createEmptyMonsterLootEntry()]
    }));
  };

  const removeMonsterLootEntry = (index: number) => {
    updateEntityRewardProfile((current) => ({
      ...current,
      loot:
        current.loot.length > 1
          ? current.loot.filter((_, entryIndex) => entryIndex !== index)
          : [createEmptyMonsterLootEntry()]
    }));
  };

  const submitEntity = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setSaving(true);
      const result = await persistEntityPayload({
        payload: serializeEntityForm(entityForm),
        mode: entityModalMode,
        editingId: editingEntityId,
        linkedIssuerDraft: generatedQuestIssuerDraft
      });
      applyCreatedEntity(result);
      closeEntityModal();
    } catch (error) {
      setBootError(
        error instanceof Error
          ? error.message
          : entityModalMode === "edit"
            ? "Не удалось сохранить сущность."
            : "Не удалось создать сущность."
      );
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    if (!activeCampaignId || !draftPrompt.trim()) {
      return;
    }

    try {
      setBootError("");
      setDraftNotes([]);
      setGenerating(true);
      const result: GenerateEntityDraftResult = await api.generateEntityDraft(activeCampaignId, {
        kind: entityForm.kind,
        prompt: draftPrompt,
        current: entityForm
      });
      const generatedIssuer = result.linkedDrafts?.find((item) => item.role === "issuer" && item.entity.kind === "npc");
      setEntityForm({
        ...emptyEntityForm(result.entity.kind),
        ...result.entity,
        related: result.entity.related ?? [],
        tags: result.entity.tags ?? []
      });
      setDraftNotes(result.notes);
      setGeneratedQuestIssuerDraft(generatedIssuer?.entity ?? null);
      setGeneratedQuestIssuerNote(generatedIssuer?.note ?? "");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сгенерировать AI-черновик.");
    } finally {
      setGenerating(false);
    }
  };

  const deleteEntity = async () => {
    if (!editingEntityId || !activeCampaignId) {
      return;
    }
    if (!window.confirm("Удалить эту сущность из кампании?")) {
      return;
    }

    try {
      setSaving(true);
      const result = await api.deleteEntity(activeCampaignId, editingEntityId);
      onEntityDeleted(result);
      closeEntityModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось удалить сущность.");
    } finally {
      setSaving(false);
    }
  };

  const isEditingEntity = entityModalMode === "edit";
  const entityFormImageUploading = entityArtUploading || galleryUploadKey.startsWith("entity-form:");
  const entityModalTitle = isEditingEntity ? "Edit Entity" : "Create Entity";
  const entityModalDescription = isEditingEntity
    ? "Правь текущую сущность вручную или попроси AI подготовить новый черновик поверх существующих данных."
    : "Собери новую запись вручную или попроси AI сразу заполнить форму.";
  const entitySubmitLabel = isEditingEntity ? "Сохранить изменения" : "Создать";

  return {
    addEntityGalleryItem,
    addEntityPlayerCard,
    addEntityPlaylistTrack,
    addMonsterLootEntry,
    addNpcStatEntry,
    addSpellSlot,
    autoFormatEntityPlayerCard,
    clearEntityPlayerCardHtml,
    closeEntityModal,
    deleteEntity,
    draftNotes,
    draftPrompt,
    editingEntityId,
    entityArtUploading,
    entityContentRef,
    entityForm,
    entityFormImageUploading,
    entityModalDescription,
    entityModalMode,
    entityModalOpen,
    entityModalSourceNpcId,
    entityModalTitle,
    entityPlayerContentRef,
    entitySubmitLabel,
    galleryUploadKey,
    generateDraft,
    generatedQuestIssuerDraft,
    generatedQuestIssuerNote,
    handleEntityPlayerCardHtmlImport,
    isEditingEntity,
    openEntityEditor,
    openEntityModal,
    openEntityPlayerCardHtmlImport,
    openNpcQuestModal,
    pasteEntityPlayerCardHtmlFromClipboard,
    playerCardFormattingIndex,
    playerCardImportInputRefs,
    removeEntityGalleryItem,
    removeEntityPlayerCard,
    removeEntityPlaylistTrack,
    removeMonsterLootEntry,
    removeNpcStatEntry,
    removeSpellSlot,
    setDraftPrompt,
    setEntityForm,
    setGalleryUploadKey,
    setGeneratedQuestIssuerDraft,
    setGeneratedQuestIssuerNote,
    setSpellcastingEnabled,
    submitEntity,
    updateEntityForm,
    updateEntityGalleryItem,
    updateEntityPlayerCard,
    updateEntityPlaylistTrack,
    updateEntityRewardProfile,
    updateMonsterLootEntry,
    updateNpcAbilityScore,
    updateNpcSpellcasting,
    updateNpcStatBlock,
    updateNpcStatEntry,
    updateSpellSlot,
    uploadEntityArtFile,
    uploadEntityGalleryFile
  };
}
