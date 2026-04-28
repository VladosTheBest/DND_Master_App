type PreparedCombatActionsProps = {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

export function PreparedCombatActions({
  onClose,
  onSave,
  saving
}: PreparedCombatActionsProps) {
  return (
    <div className="actions">
      <button className="ghost" onClick={onClose} type="button">
        Отмена
      </button>
      <button className="primary" disabled={saving} onClick={onSave} type="button">
        {saving ? "Сохраняю..." : "Сохранить бой"}
      </button>
    </div>
  );
}
