import { useMemo, useState } from "react";
import type {
  CampaignData,
  CreateEntityInput,
  GalleryImage,
  KnowledgeEntity,
  PlaylistTrack
} from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import {
  cloneGalleryImages,
  clonePlaylistTracks,
  createEmptyGalleryImage,
  createEmptyPlaylistTrack,
  imageTitleFromFileName
} from "./entity.utils";

type UseEntityMediaControllerParams = {
  activeCampaignId: string;
  entityMap: Map<string, KnowledgeEntity>;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  galleryUploadKey: string;
  hydrateCampaign: (data: CampaignData, preferredEntityId?: string) => void;
  sanitizeGalleryImages: (items: GalleryImage[]) => GalleryImage[];
  sanitizePlaylistTracks: (tracks: PlaylistTrack[]) => PlaylistTrack[];
  serializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
  setBootError: (value: string) => void;
  setGalleryUploadKey: (value: string) => void;
  setSaving: (value: boolean) => void;
  uploadCampaignImage: (file: File) => Promise<{ url: string }>;
};

export type EntityMediaController = ReturnType<typeof useEntityMediaController>;

export function useEntityMediaController({
  activeCampaignId,
  entityMap,
  entityToForm,
  galleryUploadKey,
  hydrateCampaign,
  sanitizeGalleryImages,
  sanitizePlaylistTracks,
  serializeEntityForm,
  setBootError,
  setGalleryUploadKey,
  setSaving,
  uploadCampaignImage
}: UseEntityMediaControllerParams) {
  const [entityPlaylistModalOpen, setEntityPlaylistModalOpen] = useState(false);
  const [entityGalleryModalOpen, setEntityGalleryModalOpen] = useState(false);
  const [entityPlaylistEntityId, setEntityPlaylistEntityId] = useState("");
  const [entityPlaylistDraft, setEntityPlaylistDraft] = useState<PlaylistTrack[]>([]);
  const [entityGalleryEntityId, setEntityGalleryEntityId] = useState("");
  const [entityGalleryDraft, setEntityGalleryDraft] = useState<GalleryImage[]>([]);

  const entityPlaylistTarget = useMemo(
    () => (entityPlaylistEntityId && entityMap.has(entityPlaylistEntityId) ? entityMap.get(entityPlaylistEntityId) ?? null : null),
    [entityMap, entityPlaylistEntityId]
  );
  const entityGalleryTarget = useMemo(
    () => (entityGalleryEntityId && entityMap.has(entityGalleryEntityId) ? entityMap.get(entityGalleryEntityId) ?? null : null),
    [entityGalleryEntityId, entityMap]
  );

  const entityGalleryModalUploading = galleryUploadKey.startsWith("entity-gallery:");

  const openEntityPlaylistModal = (entity: KnowledgeEntity) => {
    setEntityPlaylistEntityId(entity.id);
    setEntityPlaylistDraft(clonePlaylistTracks(entity.playlist) ?? []);
    setEntityPlaylistModalOpen(true);
  };

  const closeEntityPlaylistModal = () => {
    setEntityPlaylistModalOpen(false);
    setEntityPlaylistEntityId("");
    setEntityPlaylistDraft([]);
  };

  const updateEntityPlaylistDraftTrack = (index: number, patch: Partial<PlaylistTrack>) => {
    setEntityPlaylistDraft((current) => current.map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track)));
  };

  const addEntityPlaylistDraftTrack = () => {
    setEntityPlaylistDraft((current) => [...current, createEmptyPlaylistTrack()]);
  };

  const removeEntityPlaylistDraftTrack = (index: number) => {
    setEntityPlaylistDraft((current) => current.filter((_, trackIndex) => trackIndex !== index));
  };

  const saveEntityPlaylist = async () => {
    if (!activeCampaignId || !entityPlaylistTarget) {
      return;
    }

    try {
      setSaving(true);
      const nextForm = entityToForm(entityPlaylistTarget);
      nextForm.playlist = sanitizePlaylistTracks(entityPlaylistDraft);
      const result = await api.updateEntity(activeCampaignId, entityPlaylistTarget.id, serializeEntityForm(nextForm));
      hydrateCampaign(result.campaign);
      closeEntityPlaylistModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить плейлист сущности.");
    } finally {
      setSaving(false);
    }
  };

  const openEntityGalleryModal = (entity: KnowledgeEntity) => {
    setEntityGalleryEntityId(entity.id);
    setEntityGalleryDraft(cloneGalleryImages(entity.gallery) ?? []);
    setEntityGalleryModalOpen(true);
  };

  const closeEntityGalleryModal = () => {
    setEntityGalleryModalOpen(false);
    setEntityGalleryEntityId("");
    setEntityGalleryDraft([]);
    setGalleryUploadKey("");
  };

  const updateEntityGalleryDraftItem = (index: number, patch: Partial<GalleryImage>) => {
    setEntityGalleryDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const uploadEntityGalleryDraftFile = async (index: number, file: File) => {
    try {
      setBootError("");
      setGalleryUploadKey(`entity-gallery:${index}`);
      const uploaded = await uploadCampaignImage(file);

      setEntityGalleryDraft((current) => {
        const nextGallery = [...current];
        const existing = nextGallery[index] ?? createEmptyGalleryImage();
        nextGallery[index] = {
          ...existing,
          title: existing.title.trim() || imageTitleFromFileName(file.name) || `Изображение ${index + 1}`,
          url: uploaded.url
        };
        return nextGallery;
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось загрузить изображение в галерею.");
    } finally {
      setGalleryUploadKey("");
    }
  };

  const addEntityGalleryDraftItem = () => {
    setEntityGalleryDraft((current) => [...current, createEmptyGalleryImage()]);
  };

  const removeEntityGalleryDraftItem = (index: number) => {
    setEntityGalleryDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveEntityGallery = async () => {
    if (!activeCampaignId || !entityGalleryTarget) {
      return;
    }

    try {
      setSaving(true);
      const nextForm = entityToForm(entityGalleryTarget);
      nextForm.gallery = sanitizeGalleryImages(entityGalleryDraft);
      const result = await api.updateEntity(activeCampaignId, entityGalleryTarget.id, serializeEntityForm(nextForm));
      hydrateCampaign(result.campaign);
      closeEntityGalleryModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить галерею сущности.");
    } finally {
      setSaving(false);
    }
  };

  return {
    addEntityGalleryDraftItem,
    addEntityPlaylistDraftTrack,
    closeEntityGalleryModal,
    closeEntityPlaylistModal,
    entityGalleryDraft,
    entityGalleryModalOpen,
    entityGalleryModalUploading,
    entityGalleryTarget,
    entityPlaylistDraft,
    entityPlaylistModalOpen,
    entityPlaylistTarget,
    openEntityGalleryModal,
    openEntityPlaylistModal,
    removeEntityGalleryDraftItem,
    removeEntityPlaylistDraftTrack,
    saveEntityGallery,
    saveEntityPlaylist,
    updateEntityGalleryDraftItem,
    updateEntityPlaylistDraftTrack,
    uploadEntityGalleryDraftFile
  };
}
