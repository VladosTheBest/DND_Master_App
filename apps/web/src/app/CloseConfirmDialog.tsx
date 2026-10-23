import type { CloseConfirmState } from "./hooks/useModalController";
import { useNativeDialog } from "./hooks/useNativeDialog";

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
  const dialogRef = useNativeDialog(Boolean(state));
  if (!state) {
    return null;
  }

  return (
    <dialog ref={dialogRef} role="alertdialog" className="app-native-dialog app-confirm-dialog" aria-label={state.title} onCancel={event => { event.preventDefault(); onCancel(); }}>
      <div className="panel palette close-confirm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="stack wide">
          <div className="row">
            <div>
              <p className="eyebrow">Несохранённые изменения</p>
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
    </dialog>
  );
}
