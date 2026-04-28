import type { CampaignData } from "@shadow-edge/shared-types";
import { DndGenerationProgress } from "../../auth-ui";
import type { EntityTextField } from "./entity.types";
import { EntityEditorForm } from "./EntityEditorForm";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityEditorModalProps = {
  campaign: CampaignData | null;
  controller: EntityEditorController;
  entityGenerationSteps: string[];
  generating: boolean;
  onClose: () => void;
  onContentContextMenu: (field: EntityTextField, event: React.MouseEvent<HTMLTextAreaElement>) => void;
  saving: boolean;
};

export function EntityEditorModal({
  campaign,
  controller,
  entityGenerationSteps,
  generating,
  onClose,
  onContentContextMenu,
  saving
}: EntityEditorModalProps) {
  const {
    deleteEntity,
    draftNotes,
    draftPrompt,
    entityFormImageUploading,
    entityModalDescription,
    entityModalOpen,
    entityModalTitle,
    entitySubmitLabel,
    generateDraft,
    isEditingEntity,
    setDraftPrompt,
    submitEntity
  } = controller;

  if (!entityModalOpen) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette form-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">{entityModalTitle}</p>
            <strong>{entityModalDescription}</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <div className="field field-full">
          <span>Описание для AI</span>
          <textarea
            className="input textarea"
            onChange={(event) => setDraftPrompt(event.target.value)}
            placeholder="Опиши город, НПС, монстра или квест. AI заполнит форму, а ты потом отредактируешь её вручную."
            value={draftPrompt}
          />
        </div>

        <div className="actions">
          <button className="ghost" disabled={generating || !draftPrompt.trim()} onClick={() => void generateDraft()} type="button">
            {generating ? "Генерирую..." : "Сгенерировать и заполнить"}
          </button>
        </div>

        {generating ? (
          <DndGenerationProgress
            detail="Собираю текущую форму, контекст кампании и прошу AI подготовить новый черновик сущности."
            steps={entityGenerationSteps}
            title="Пишу новый черновик"
          />
        ) : null}

        {draftNotes.length ? <p className="copy draft-notes">{draftNotes.join(" ")}</p> : null}

        <EntityEditorForm
          campaign={campaign}
          controller={controller}
          onContentContextMenu={onContentContextMenu}
        />

        <div className="actions">
          {isEditingEntity ? (
            <button className="ghost danger-action" disabled={saving} onClick={() => void deleteEntity()} type="button">
              Удалить
            </button>
          ) : null}
          <button className="primary" disabled={saving || entityFormImageUploading} onClick={() => void submitEntity()} type="button">
            {saving ? "Сохраняю..." : entitySubmitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
