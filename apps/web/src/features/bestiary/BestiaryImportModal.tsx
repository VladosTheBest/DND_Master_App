type BestiaryImportModalProps = {
  compact?: boolean;
  imported: boolean;
  importing: boolean;
  onImport: () => void;
  onOpenSource: () => void;
};

export function BestiaryImportModal({
  compact = false,
  imported,
  importing,
  onImport,
  onOpenSource
}: BestiaryImportModalProps) {
  return (
    <div className={`actions bestiary-import-actions ${compact ? "compact" : ""}`}>
      <button className="ghost" onClick={onOpenSource} type="button">
        {compact ? "dnd.su" : "Открыть dnd.su"}
      </button>
      <button className="primary" disabled={importing} onClick={onImport} type="button">
        {importing ? "Импорт..." : imported ? (compact ? "Импорт ещё раз" : "Импортировать ещё раз") : compact ? "Импорт" : "Импортировать в кампанию"}
      </button>
    </div>
  );
}
