import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import { api } from "../../app/api";
import { clamp, NEW_LORE_NOTE_ID } from "../../app-shared";
import { resolveRichSelectionFromContainer } from "../../rich-text";
import type {
  EntityLinkController,
  EntityLinkSelection,
  EntityTextField,
  UseEntityLinkControllerArgs
} from "./entityLink.types";
import {
  filterLinkableEntities,
  replaceSelectionWithEntityLink,
  resolveExactEntityLinkTarget,
  resolveValidEntityLinkTargetId
} from "./entityLink.utils";

export function useEntityLinkController({
  activeCampaignId,
  allEntities,
  editingEntityId,
  entityContentRef,
  entityForm,
  entityMap,
  entityPlayerContentRef,
  entityToForm,
  onApplyCreatedEntity,
  onCloseEntityActionMenu,
  onSerializeEntityForm,
  onSetBootError,
  onSetEntityForm,
  onSetPreviewEntityId,
  onSetSaving
}: UseEntityLinkControllerArgs): EntityLinkController {
  const noteEditorContentRef = useRef<HTMLTextAreaElement | null>(null);
  const [entityLinkSelection, setEntityLinkSelection] = useState<EntityLinkSelection | null>(null);
  const [entityLinkMenuOpen, setEntityLinkMenuOpen] = useState(false);
  const [entityLinkModalOpen, setEntityLinkModalOpen] = useState(false);
  const [entityLinkQuery, setEntityLinkQuery] = useState("");
  const [entityLinkTargetId, setEntityLinkTargetId] = useState("");

  const closeEntityLinkContextMenu = () => {
    setEntityLinkMenuOpen(false);
    setEntityLinkSelection(null);
  };

  const closeEntityLinkModal = () => {
    setEntityLinkModalOpen(false);
    setEntityLinkSelection(null);
    setEntityLinkMenuOpen(false);
    setEntityLinkQuery("");
    setEntityLinkTargetId("");
  };

  const resetEntityLinkState = () => {
    closeEntityLinkModal();
  };

  const handleTextareaContextMenuSelection = (
    field: EntityTextField | "noteContent",
    entityId: string | undefined,
    event: ReactMouseEvent<HTMLTextAreaElement>,
    mode: "editor" | "noteEditor"
  ) => {
    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selectedText = textarea.value.slice(start, end).trim();

    if (!selectedText || start === end) {
      closeEntityLinkContextMenu();
      return;
    }

    event.preventDefault();
    onCloseEntityActionMenu();
    setEntityLinkSelection({
      mode,
      field,
      start,
      end,
      text: textarea.value.slice(start, end),
      x: clamp(event.clientX, 12, window.innerWidth - 240),
      y: clamp(event.clientY, 12, window.innerHeight - 80),
      entityId
    });
    setEntityLinkMenuOpen(true);
  };

  const handleEntityContentContextMenu = (field: EntityTextField, event: ReactMouseEvent<HTMLTextAreaElement>) => {
    handleTextareaContextMenuSelection(field, editingEntityId || undefined, event, "editor");
  };

  const handleNoteContentContextMenu = (noteId: string, event: ReactMouseEvent<HTMLTextAreaElement>) => {
    handleTextareaContextMenuSelection(
      "noteContent",
      noteId && noteId !== NEW_LORE_NOTE_ID ? noteId : undefined,
      event,
      "noteEditor"
    );
  };

  const handleActiveEntityContentContextMenu = (
    entity: Parameters<EntityLinkController["handleActiveEntityContentContextMenu"]>[0],
    field: EntityTextField,
    event: ReactMouseEvent<HTMLElement>
  ) => {
    const selection = resolveRichSelectionFromContainer(event.currentTarget);
    if (!selection || !selection.text.trim()) {
      closeEntityLinkContextMenu();
      return;
    }

    event.preventDefault();
    onCloseEntityActionMenu();
    setEntityLinkSelection({
      mode: "entity",
      field,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      x: clamp(event.clientX, 12, window.innerWidth - 240),
      y: clamp(event.clientY, 12, window.innerHeight - 80),
      entityId: entity.id
    });
    setEntityLinkMenuOpen(true);
  };

  const linkableEntities = useMemo(
    () =>
      filterLinkableEntities({
        allEntities,
        editingEntityId,
        query: entityLinkQuery,
        selectionEntityId: entityLinkSelection?.entityId
      }),
    [allEntities, editingEntityId, entityLinkQuery, entityLinkSelection?.entityId]
  );

  const selectedEntityLinkTarget = useMemo(
    () => (entityLinkTargetId ? entityMap.get(entityLinkTargetId) ?? null : null),
    [entityLinkTargetId, entityMap]
  );

  useEffect(() => {
    if (!entityLinkModalOpen) {
      return;
    }

    const nextTargetId = resolveValidEntityLinkTargetId(linkableEntities, entityLinkTargetId);
    if (nextTargetId !== entityLinkTargetId) {
      setEntityLinkTargetId(nextTargetId);
    }
  }, [entityLinkModalOpen, entityLinkTargetId, linkableEntities]);

  const openEntityLinkModal = () => {
    if (!entityLinkSelection) {
      return;
    }

    const normalizedSelection = entityLinkSelection.text.trim();
    setEntityLinkQuery(normalizedSelection);
    const exactMatch = resolveExactEntityLinkTarget({
      allEntities,
      editingEntityId,
      selection: entityLinkSelection,
      selectionText: normalizedSelection
    });
    setEntityLinkTargetId(exactMatch?.id ?? "");
    setEntityLinkMenuOpen(false);
    setEntityLinkModalOpen(true);
  };

  const insertEntityLinkIntoContent = () => {
    if (!entityLinkSelection || !entityLinkTargetId) {
      return;
    }

    const target = entityMap.get(entityLinkTargetId);
    if (!target) {
      return;
    }

    const sourceField = entityLinkSelection.field;
    const currentValue =
      sourceField === "noteContent"
        ? noteEditorContentRef.current?.value ?? ""
        : sourceField === "playerContent"
          ? entityForm.playerContent ?? ""
          : entityForm.content;
    const nextValue = replaceSelectionWithEntityLink({
      currentValue,
      selection: entityLinkSelection,
      targetTitle: target.title
    });

    if (entityLinkSelection.mode === "noteEditor" || sourceField === "noteContent") {
      const noteTextarea = noteEditorContentRef.current;
      if (!noteTextarea) {
        closeEntityLinkModal();
        return;
      }

      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      descriptor?.set?.call(noteTextarea, nextValue);
      noteTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      closeEntityLinkModal();

      requestAnimationFrame(() => {
        noteTextarea.focus();
      });
      return;
    }

    if (entityLinkSelection.mode === "editor") {
      onSetEntityForm((current) => ({
        ...current,
        [sourceField]: nextValue
      }));
      closeEntityLinkModal();

      requestAnimationFrame(() => {
        if (sourceField === "playerContent") {
          entityPlayerContentRef.current?.focus();
          return;
        }
        entityContentRef.current?.focus();
      });
      return;
    }

    const sourceEntity = entityLinkSelection.entityId ? entityMap.get(entityLinkSelection.entityId) ?? null : null;
    if (!sourceEntity || !activeCampaignId) {
      closeEntityLinkModal();
      return;
    }

    void (async () => {
      try {
        onSetSaving(true);
        const form = entityToForm(sourceEntity);
        const sourceValue = sourceField === "playerContent" ? sourceEntity.playerContent ?? "" : sourceEntity.content;
        form[sourceField] = replaceSelectionWithEntityLink({
          currentValue: sourceValue,
          selection: entityLinkSelection,
          targetTitle: target.title
        });
        const result = await api.updateEntity(activeCampaignId, sourceEntity.id, onSerializeEntityForm(form));
        onApplyCreatedEntity(result);
        closeEntityLinkModal();
        onSetPreviewEntityId(target.id);
      } catch (error) {
        onSetBootError(error instanceof Error ? error.message : "Не удалось сохранить ссылку в сущности.");
      } finally {
        onSetSaving(false);
      }
    })();
  };

  return {
    closeEntityLinkContextMenu,
    closeEntityLinkModal,
    entityLinkMenuOpen,
    entityLinkModalOpen,
    entityLinkQuery,
    entityLinkSelection,
    entityLinkTargetId,
    handleActiveEntityContentContextMenu,
    handleEntityContentContextMenu,
    handleNoteContentContextMenu,
    insertEntityLinkIntoContent,
    linkableEntities,
    noteEditorContentRef,
    openEntityLinkModal,
    resetEntityLinkState,
    selectedEntityLinkTarget,
    setEntityLinkQuery,
    setEntityLinkTargetId
  };
}
