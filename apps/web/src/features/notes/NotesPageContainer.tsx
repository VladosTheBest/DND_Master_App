import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import { useDeviceDraft } from "../../app/hooks/useDeviceDraft";
import { isApiError } from "@shadow-edge/api-client";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import type {
  CampaignData,
  CreateEntityInput,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import {
  NEW_LORE_NOTE_ID,
  loreNoteExcerpt,
  resolveLoreNoteTitle
} from "../../app-shared";
import { NotesWorkspace } from "../../notes-events";
import { api } from "../../app/api";
import { emptyEntityForm } from "../entities/entity.utils";

type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;

export function NotesPageContainer({
  ownerId,
  activeCampaignId,
  campaign,
  editorRef,
  entityMap,
  entityToForm,
  hydrateCampaign,
  initialNoteId,
  onContentContextMenu,
  onEditWithAI,
  onOpenEntityImage,
  onOpenPreview,
  serializeEntityForm
}: {
  ownerId: string;
  activeCampaignId: string;
  campaign: CampaignData;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  entityMap: Map<string, KnowledgeEntity>;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  hydrateCampaign: (campaign: CampaignData, focusEntityId?: string) => void;
  initialNoteId?: string;
  onContentContextMenu: (noteId: string, event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  onEditWithAI: (entity: LoreNoteEntity) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenPreview: (id: string) => void;
  serializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [noteEditorEntityId, setNoteEditorEntityId] = useState("");
  const [noteEditorTitle, setNoteEditorTitle] = useState("");
  const [noteEditorContent, setNoteEditorContent] = useState("");
  const [noteEditorDirty, setNoteEditorDirty] = useState(false);
  const [noteEditorNotice, setNoteEditorNotice] = useState("");

  const [baseRevision, setBaseRevision] = useState(0);
  const [conflict, setConflict] = useState<KnowledgeEntity | null>(null);
  const deviceDraft = useDeviceDraft({
    ownerId, campaignId: activeCampaignId, target: `note:${noteEditorEntityId}`,
    enabled: Boolean(noteEditorEntityId), revision: baseRevision, dirty: noteEditorDirty,
    value: { title: noteEditorTitle, content: noteEditorContent },
    restore: ({ value, baseRevision }) => {
      if (!value || typeof value.title !== "string" || typeof value.content !== "string") return false;
      setNoteEditorTitle(value.title); setNoteEditorContent(value.content);
      setBaseRevision(baseRevision); setNoteEditorDirty(true);
    }
  });

  const activeLoreNote = useMemo(() => {
    if (!noteEditorEntityId || noteEditorEntityId === NEW_LORE_NOTE_ID) {
      return null;
    }
    const entity = entityMap.get(noteEditorEntityId);
    return entity?.kind === "lore" ? entity : null;
  }, [entityMap, noteEditorEntityId]);

  useEffect(() => {
    const nextId =
      initialNoteId && entityMap.get(initialNoteId)?.kind === "lore"
        ? initialNoteId
        : campaign.lore[0]?.id ?? NEW_LORE_NOTE_ID;

    if (!noteEditorEntityId) {
      if (nextId === NEW_LORE_NOTE_ID) {
        setNoteEditorEntityId(NEW_LORE_NOTE_ID);
        setNoteEditorTitle("");
        setNoteEditorContent("");
        setNoteEditorDirty(false);
        return;
      }

      const nextNote = entityMap.get(nextId);
      if (nextNote?.kind === "lore") {
        setBaseRevision(nextNote.revision ?? 0);
        setNoteEditorEntityId(nextNote.id);
        setNoteEditorTitle(nextNote.title);
        setNoteEditorContent(nextNote.content);
        setNoteEditorDirty(false);
      }
    }
  }, [campaign.lore, entityMap, initialNoteId, noteEditorEntityId]);

  useEffect(() => {
    if (!activeLoreNote || noteEditorDirty) {
      return;
    }

    setBaseRevision(activeLoreNote.revision ?? 0);
    setNoteEditorTitle(activeLoreNote.title);
    setNoteEditorContent(activeLoreNote.content);
  }, [activeLoreNote, noteEditorDirty]);

  const requestLoreNoteSwitch = (noteId: string) => {
    if (!noteId || (noteEditorEntityId !== NEW_LORE_NOTE_ID && noteEditorEntityId === noteId)) {
      return;
    }

    if (noteEditorDirty && !window.confirm("Есть несохранённые изменения в заметке. Переключиться без сохранения?")) {
      return;
    }

    const nextNote = entityMap.get(noteId);
    if (nextNote?.kind !== "lore") {
      return;
    }

    setNoteEditorNotice("");
    setError("");
    setBaseRevision(nextNote.revision ?? 0); setConflict(null);
    setNoteEditorEntityId(nextNote.id);
    setNoteEditorTitle(nextNote.title);
    setNoteEditorContent(nextNote.content);
    setNoteEditorDirty(false);
  };

  const startNewLoreNote = () => {
    if (noteEditorDirty && !window.confirm("Есть несохранённые изменения в заметке. Открыть новый черновик без сохранения?")) {
      return;
    }

    setBaseRevision(0); setConflict(null);
    setNoteEditorEntityId(NEW_LORE_NOTE_ID);
    setNoteEditorTitle("");
    setNoteEditorContent("");
    setNoteEditorDirty(false);
    setNoteEditorNotice("");
    setError("");
  };

  const saveLoreNote = async () => {
    if (!activeCampaignId) {
      return;
    }

    if (deviceDraft.candidate || conflict) { setError("Сначала разберите найденный черновик или конфликт версий."); return; }
    const resolvedTitle = resolveLoreNoteTitle(noteEditorTitle, noteEditorContent);
    const resolvedContent = noteEditorContent.trim();

    if (!resolvedTitle.trim() && !resolvedContent) {
      setNoteEditorNotice("Сначала добавь текст заметки.");
      return;
    }

    const currentNote = noteEditorEntityId && noteEditorEntityId !== NEW_LORE_NOTE_ID ? entityMap.get(noteEditorEntityId) : null;
    const baseForm = currentNote?.kind === "lore" ? entityToForm(currentNote) : emptyEntityForm("lore");
    const payload = serializeEntityForm({
      ...baseForm,
      expectedRevision: baseRevision,
      kind: "lore",
      title: resolvedTitle,
      summary: loreNoteExcerpt({ summary: "", content: resolvedContent || resolvedTitle }, 150),
      content: noteEditorContent,
      category: baseForm.category ?? "History",
      visibility: baseForm.visibility ?? "gm_only"
    });

    try {
      setSaving(true);
      setError("");
      setNoteEditorNotice("");
      const result =
        currentNote?.kind === "lore"
          ? await api.updateEntity(activeCampaignId, currentNote.id, payload)
          : await api.createEntity(activeCampaignId, payload);
      deviceDraft.clear();
      setBaseRevision(result.entity.revision ?? 0);
      hydrateCampaign(result.campaign, result.entity.id);
      setNoteEditorEntityId(result.entity.id);
      setNoteEditorTitle(result.entity.title);
      setNoteEditorContent(result.entity.content);
      setNoteEditorDirty(false);
      setNoteEditorNotice(currentNote?.kind === "lore" ? "Заметка сохранена." : "Заметка создана.");
    } catch (saveError) {
      if (isApiError(saveError) && saveError.status === 409 && saveError.current) setConflict(saveError.current as KnowledgeEntity);
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить заметку.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <DeviceDraftControls draft={deviceDraft} label="черновик заметки"/>
    {conflict && <div className="card mini"><h3>Конфликт версий заметки</h3>
      <p>Сравните с текущим текстом. После подтверждения заголовок, краткое описание и текст будут заменены вашим вариантом; остальные серверные поля сохранятся.</p>
      <pre style={{whiteSpace:"pre-wrap"}}>{conflict.title}{"\n"}{conflict.content}</pre>
      <button className="ghost" onClick={() => { setBaseRevision(conflict.revision ?? 0); hydrateCampaign({ ...campaign, lore: campaign.lore.map(n => n.id === conflict.id ? conflict as LoreNoteEntity : n) }); setConflict(null); setError(""); }}>Подготовить мой текст поверх этой версии</button>
    </div>}
    <NotesWorkspace
      entityByTitle={new Map([...entityMap.values()].map((entity) => [entity.title, entity]))}
      campaignId={activeCampaignId}
      dirty={noteEditorDirty}
      draftContent={noteEditorContent}
      draftId={noteEditorEntityId}
      draftTitle={noteEditorTitle}
      editorRef={editorRef}
      error={error}
      notice={noteEditorNotice}
      notes={campaign.lore}
      onContentChange={(value) => {
        setNoteEditorContent(value);
        setNoteEditorDirty(true);
        setNoteEditorNotice("");
      }}
      onContentContextMenu={(event) => onContentContextMenu(noteEditorEntityId, event)}
      onCreateNote={startNewLoreNote}
      onEditWithAI={onEditWithAI}
      onOpenEntityImage={onOpenEntityImage}
      onOpenPreview={onOpenPreview}
      onSave={() => void saveLoreNote()}
      onSearchChange={setSearchQuery}
      onSelectNote={requestLoreNoteSwitch}
      onTitleChange={(value) => {
        setNoteEditorTitle(value);
        setNoteEditorDirty(true);
        setNoteEditorNotice("");
      }}
      saving={saving}
      searchQuery={searchQuery}
      selectedNoteId={activeLoreNote?.id ?? ""}
    />
    </>
  );
}
