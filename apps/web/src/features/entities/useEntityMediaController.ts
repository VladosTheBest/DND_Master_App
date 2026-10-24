import { useMemo, useRef, useState } from "react";
import type {
  CampaignData,
  CreateEntityInput,
  GalleryImage,
  KnowledgeEntity,
  PlaylistTrack
} from "@shadow-edge/shared-types";
import { isApiError } from "@shadow-edge/api-client";
import { useEntityMediaDraft } from "./useEntityMediaDraft";
import { api } from "../../app/api";
import {
  cloneGalleryImages,
  clonePlaylistTracks,
  createEmptyGalleryImage,
  createEmptyPlaylistTrack,
  imageTitleFromFileName
} from "./entity.utils";
import { kindTitle } from "../../app-shared";

export type ProjectGalleryImageOption = GalleryImage & {
  key: string;
  sourceEntityId: string;
  sourceEntityTitle: string;
  sourceLabel: string;
};

type UseEntityMediaControllerParams = {
  ownerId: string;
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
  ownerId,
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
  const [entityPlaylistTarget,setEntityPlaylistTarget]=useState<KnowledgeEntity|null>(null);
  const [entityPlaylistDraft,setEntityPlaylistDraft]=useState<PlaylistTrack[]>([]);
  const [entityGalleryTarget,setEntityGalleryTarget]=useState<KnowledgeEntity|null>(null);
  const [entityGalleryDraft,setEntityGalleryDraft]=useState<GalleryImage[]>([]);
  const [mediaSaving,setMediaSaving]=useState(false);
  const gallerySession=useRef(0),playlistSession=useRef(0);
  const entityGalleryModalUploading=galleryUploadKey.startsWith("entity-gallery:");
  const galleryState=useEntityMediaDraft({ownerId,campaignId:activeCampaignId,field:"gallery",target:entityGalleryTarget,setTarget:setEntityGalleryTarget,items:entityGalleryDraft,setItems:setEntityGalleryDraft,open:entityGalleryModalOpen,busy:mediaSaving||entityGalleryModalUploading,onClose:closeEntityGalleryModal});
  const playlistState=useEntityMediaDraft({ownerId,campaignId:activeCampaignId,field:"playlist",target:entityPlaylistTarget,setTarget:setEntityPlaylistTarget,items:entityPlaylistDraft,setItems:setEntityPlaylistDraft,open:entityPlaylistModalOpen,busy:mediaSaving,onClose:closeEntityPlaylistModal});
  const projectGalleryImages = useMemo(() => {
    const items: ProjectGalleryImageOption[] = [];
    const seen = new Set<string>();

    const pushImage = (image: GalleryImage, sourceEntity: KnowledgeEntity, sourceLabel: string) => {
      const url = image.url.trim();
      if (!url || seen.has(url)) {
        return;
      }

      seen.add(url);
      items.push({
        caption: image.caption?.trim() ?? "",
        key: `${sourceEntity.id}:${sourceLabel}:${url}`,
        sourceEntityId: sourceEntity.id,
        sourceEntityTitle: sourceEntity.title,
        sourceLabel,
        title: image.title.trim() || sourceEntity.title,
        url
      });
    };

    entityMap.forEach((entity) => {
      if (entity.art?.url?.trim()) {
        pushImage(
          {
            caption: entity.art.caption?.trim() ?? "",
            title: entity.title,
            url: entity.art.url.trim()
          },
          entity,
          `${kindTitle[entity.kind]} • арт`
        );
      }

      (entity.gallery ?? []).forEach((image) => {
        pushImage(image, entity, `${kindTitle[entity.kind]} • галерея`);
      });
    });

    return items;
  }, [entityMap]);


  const openEntityPlaylistModal = (entity: KnowledgeEntity) => {
    playlistSession.current++;setEntityPlaylistTarget(entity);
    const tracks=clonePlaylistTracks(entity.playlist)??[];setEntityPlaylistDraft(tracks);playlistState.begin(entity,tracks);
    setEntityPlaylistModalOpen(true);
  };

  function closeEntityPlaylistModal() {
    playlistSession.current++;
    setEntityPlaylistModalOpen(false);
    setEntityPlaylistTarget(null);
    setEntityPlaylistDraft([]);
  };

  const updateEntityPlaylistDraftTrack = (index: number, patch: Partial<PlaylistTrack>) => {
    playlistState.setError("");
    setEntityPlaylistDraft((current) => current.map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track)));
  };

  const addEntityPlaylistDraftTrack = () => {
    playlistState.setError("");
    setEntityPlaylistDraft((current) => [...current, createEmptyPlaylistTrack()]);
  };

  const removeEntityPlaylistDraftTrack = (index: number) => {
    playlistState.setError("");
    setEntityPlaylistDraft((current) => current.filter((_, trackIndex) => trackIndex !== index));
  };

  const saveEntityPlaylist = async () => {
    if (!activeCampaignId || !entityPlaylistTarget || !playlistState.canSave) {
      return;
    }

    if(entityPlaylistDraft.some(item=>!item.url.trim())){playlistState.setError("Укажите ссылку у каждой записи или удалите пустую строку.");return;}
    const session=playlistSession.current;
    try {
      setSaving(true);setMediaSaving(true);playlistState.setError("");
      const nextForm = entityToForm(entityPlaylistTarget);
      nextForm.expectedRevision = playlistState.revision;
      nextForm.playlist = sanitizePlaylistTracks(entityPlaylistDraft);
      const result = await api.updateEntity(activeCampaignId, entityPlaylistTarget.id, serializeEntityForm(nextForm));
      if(session!==playlistSession.current)return;
      playlistState.draft.clear();hydrateCampaign(result.campaign);
      closeEntityPlaylistModal();
    } catch (error) {
      if(session!==playlistSession.current)return;
      if(isApiError(error)&&error.status===409&&error.current)playlistState.setConflict(error.current as KnowledgeEntity);
      playlistState.setError(error instanceof Error ? error.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);setMediaSaving(false);
    }
  };

  const openEntityGalleryModal = (entity: KnowledgeEntity) => {
    gallerySession.current++;setEntityGalleryTarget(entity);
    const images=cloneGalleryImages(entity.gallery)??[];setEntityGalleryDraft(images);galleryState.begin(entity,images);
    setEntityGalleryModalOpen(true);
  };

  function closeEntityGalleryModal() {
    gallerySession.current++;
    setEntityGalleryModalOpen(false);
    setEntityGalleryTarget(null);
    setEntityGalleryDraft([]);
    setGalleryUploadKey("");
  };

  const updateEntityGalleryDraftItem = (index: number, patch: Partial<GalleryImage>) => {
    galleryState.setError("");
    setEntityGalleryDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const uploadEntityGalleryDraftFile = async (index: number, file: File) => {
    const session=gallerySession.current;
    try {
      galleryState.setError("");
      setGalleryUploadKey(`entity-gallery:${index}`);
      const uploaded = await uploadCampaignImage(file);
      if(session!==gallerySession.current)return;

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
      if(session===gallerySession.current)galleryState.setError(error instanceof Error ? error.message : "Не удалось загрузить изображение в галерею.");
    } finally {
      if(session===gallerySession.current)setGalleryUploadKey("");
    }
  };

  const addEntityGalleryDraftItem = () => {
    galleryState.setError("");
    setEntityGalleryDraft((current) => [...current, createEmptyGalleryImage()]);
  };

  const removeEntityGalleryDraftItem = (index: number) => {
    galleryState.setError("");
    setEntityGalleryDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addProjectImagesToEntityGalleryDraft = (images: GalleryImage[]) => {
    galleryState.setError("");
    setEntityGalleryDraft((current) => {
      const seen = new Set(current.map((item) => item.url.trim()).filter(Boolean));
      const nextGallery = [...current];

      images.forEach((image) => {
        const url = image.url.trim();
        if (!url || seen.has(url)) {
          return;
        }

        seen.add(url);
        nextGallery.push({
          caption: image.caption?.trim() ?? "",
          title: image.title.trim() || `Изображение ${nextGallery.length + 1}`,
          url
        });
      });

      return nextGallery;
    });
  };

  const saveEntityGallery = async () => {
    if (!activeCampaignId || !entityGalleryTarget || !galleryState.canSave) {
      return;
    }

    if(entityGalleryDraft.some(item=>!item.url.trim())){galleryState.setError("Укажите ссылку у каждой записи или удалите пустую строку.");return;}
    const session=gallerySession.current;
    try {
      setSaving(true);setMediaSaving(true);galleryState.setError("");
      const nextForm = entityToForm(entityGalleryTarget);
      nextForm.expectedRevision = galleryState.revision;
      nextForm.gallery = sanitizeGalleryImages(entityGalleryDraft);
      const result = await api.updateEntity(activeCampaignId, entityGalleryTarget.id, serializeEntityForm(nextForm));
      if(session!==gallerySession.current)return;
      galleryState.draft.clear();hydrateCampaign(result.campaign);
      closeEntityGalleryModal();
    } catch (error) {
      if(session!==gallerySession.current)return;
      if(isApiError(error)&&error.status===409&&error.current)galleryState.setConflict(error.current as KnowledgeEntity);
      galleryState.setError(error instanceof Error ? error.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);setMediaSaving(false);
    }
  };

  return {
    galleryState,playlistState,mediaSaving,
    addProjectImagesToEntityGalleryDraft,
    addEntityGalleryDraftItem,
    addEntityPlaylistDraftTrack,
    closeEntityGalleryModal,
    closeEntityPlaylistModal,
    entityGalleryDraft,
    entityGalleryModalOpen,
    entityGalleryModalUploading,
    entityGalleryTarget,
    projectGalleryImages,
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
