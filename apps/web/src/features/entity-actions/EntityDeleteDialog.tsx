import type { KnowledgeEntity } from "@shadow-edge/shared-types";

type EntityDeleteDialogProps = {
  entity: KnowledgeEntity | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (entity: KnowledgeEntity) => void;
};

export function EntityDeleteDialog({
  entity,
  saving,
  onCancel,
  onConfirm
}: EntityDeleteDialogProps) {
  if (!entity) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette close-confirm-modal" aria-modal="true" onClick={(event) => event.stopPropagation()} role="alertdialog">
        <div className="stack wide">
          <div className="row">
            <div>
              <p className="eyebrow">Delete Entity</p>
              <strong>Удалить «{entity.title}»?</strong>
            </div>
          </div>

          <p className="copy">Сущность будет удалена из кампании. Это действие нельзя отменить.</p>

          <div className="actions">
            <button className="ghost" onClick={onCancel} type="button">
              Отмена
            </button>
            <button className="ghost danger-action" disabled={saving} onClick={() => onConfirm(entity)} type="button">
              {saving ? "Удаляю..." : "Удалить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
