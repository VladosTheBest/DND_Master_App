import type { CampaignData } from "@shadow-edge/shared-types";
import { DndGenerationProgress } from "../../auth-ui";
import type { EntityTextField } from "./entity.types";
import { EntityEditorForm } from "./EntityEditorForm";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityEditorModalProps = {
  campaign: CampaignData | null;
  controller: EntityEditorController;
  entityGenerationSteps: string[];
  error: string;
  generating: boolean;
  onClose: () => void;
  onContentContextMenu: (field: EntityTextField, event: React.MouseEvent<HTMLTextAreaElement>) => void;
  saving: boolean;
};

export function EntityEditorModal({
  campaign,
  controller,
  entityGenerationSteps,
  error,
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
    entityModalOpen,
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
      <div className="panel palette form-modal entity-editor-modal" aria-label={isEditingEntity ? "Редактирование записи" : "Новая запись"} onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <h2>{isEditingEntity ? "Редактирование записи" : "Новая запись"}</h2>
            <p className="copy">Начните с названия и описания. Остальное можно дополнить позже.</p>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <details className="editor-disclosure">
          <summary>Заполнить с помощью AI</summary>
        <div className="field field-full">
          <label htmlFor="entity-ai-prompt">Описание для AI</label>
          <textarea
            id="entity-ai-prompt"
            className="input textarea"
            disabled={generating}
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

        </details>

        {error ? (
          <div className="card mini form-error" role="status">
            <strong>Не удалось собрать AI-черновик</strong>
            <p>{error}</p>
          </div>
        ) : null}

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

        <div className="actions editor-submit-bar">
          {isEditingEntity ? (
            <button className="ghost danger-action" disabled={saving || generating} onClick={() => void deleteEntity()} type="button">
              Удалить
            </button>
          ) : null}
          <button className="primary" disabled={saving || generating || entityFormImageUploading} onClick={() => void submitEntity()} type="button">
            {saving ? "Сохраняю..." : entitySubmitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
