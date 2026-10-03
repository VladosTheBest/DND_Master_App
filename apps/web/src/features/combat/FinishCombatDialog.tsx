import { useEffect, useRef } from "react";

export function FinishCombatDialog({ busy, error, onCancel, onConfirm }: {
  busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="overlay" role="presentation">
    <div ref={dialog} className="panel palette combat-finish-confirm" role="alertdialog" aria-modal="true" aria-labelledby="finish-combat-title" aria-describedby="finish-combat-description"
      onKeyDown={event => {
        if (event.key === "Escape" && !busy) onCancel();
        if (event.key !== "Tab") return;
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const target = event.shiftKey ? buttons.at(-1) : buttons[0];
        if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) {
          event.preventDefault(); target?.focus();
        }
      }}>
      <h2 id="finish-combat-title">Завершить бой?</h2>
      <p id="finish-combat-description">Опыт за побеждённых противников будет сохранён. Вы вернётесь в кампанию.</p>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
      <div className="actions">
        <button ref={cancel} className="ghost" disabled={busy} onClick={onCancel} type="button">Продолжить бой</button>
        <button className="primary" disabled={busy} onClick={onConfirm} type="button">{busy ? "Завершаю…" : "Завершить"}</button>
      </div>
    </div>
  </div>;
}
