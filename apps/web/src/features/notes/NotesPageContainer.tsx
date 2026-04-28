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
  activeCampaignId,
  campaign,
  editorRef,
  entityMap,
  entityToForm,
  hydrateCampaign,
  initialNoteId,
  onContentContextMenu,
  onOpenPreview,
  serializeEntityForm
}: {
  activeCampaignId: string;
  campaign: CampaignData;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  entityMap: Map<string, KnowledgeEntity>;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  hydrateCampaign: (campaign: CampaignData, focusEntityId?: string) => void;
  initialNoteId?: string;
  onContentContextMenu: (noteId: string, event: ReactMouseEvent<HTMLTextAreaElement>) => void;
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
    setNoteEditorEntityId(nextNote.id);
    setNoteEditorTitle(nextNote.title);
    setNoteEditorContent(nextNote.content);
    setNoteEditorDirty(false);
    onOpenPreview(nextNote.id);
  };

  const startNewLoreNote = () => {
    if (noteEditorDirty && !window.confirm("Есть несохранённые изменения в заметке. Открыть новый черновик без сохранения?")) {
      return;
    }

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
      hydrateCampaign(result.campaign, result.entity.id);
      setNoteEditorEntityId(result.entity.id);
      setNoteEditorTitle(result.entity.title);
      setNoteEditorContent(result.entity.content);
      setNoteEditorDirty(false);
      setNoteEditorNotice(currentNote?.kind === "lore" ? "Заметка сохранена." : "Заметка создана.");
      onOpenPreview(result.entity.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить заметку.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NotesWorkspace
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
  );
}
