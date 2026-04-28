import type { CloseConfirmState } from "./hooks/useModalController";

type CloseConfirmDialogProps = {
  state: CloseConfirmState | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CloseConfirmDialog({
  state,
  onCancel,
  onConfirm
}: CloseConfirmDialogProps) {
  if (!state) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette close-confirm-modal" aria-modal="true" onClick={(event) => event.stopPropagation()} role="alertdialog">
        <div className="stack wide">
          <div className="row">
            <div>
              <p className="eyebrow">Confirm Close</p>
              <strong>{state.title}</strong>
            </div>
          </div>

          <p className="copy">{state.description}</p>

          <div className="actions">
            <button className="ghost" onClick={onCancel} type="button">
              Продолжить редактирование
            </button>
            <button className="ghost danger-action" onClick={onConfirm} type="button">
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
