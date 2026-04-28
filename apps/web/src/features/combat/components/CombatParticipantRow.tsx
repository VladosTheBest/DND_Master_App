import { createPortraitSource, kindTitle } from "../../../app-shared";
import type { CombatProfileEntity } from "../combat.types";
import { CombatInitiativeInput } from "./CombatInitiativeInput";

type CombatParticipantRowProps = {
  entity: CombatProfileEntity;
  title: string;
  subtitle?: string;
  initiative: number;
  onInitiativeChange: (value: number) => void;
  onRemove: () => void;
  removeLabel: string;
  className: string;
};

export function CombatParticipantRow({
  entity,
  title,
  subtitle,
  initiative,
  onInitiativeChange,
  onRemove,
  removeLabel,
  className
}: CombatParticipantRowProps) {
  return (
    <article className={className}>
      <span className="combat-prep-drag-handle">⋮⋮</span>
      <img alt={entity.title} loading="lazy" src={createPortraitSource(entity)} />
      <div className="combat-prep-field-copy">
        <strong>{title}</strong>
        <span>{subtitle || entity.role || entity.subtitle || kindTitle[entity.kind]}</span>
      </div>
      <CombatInitiativeInput value={initiative} onChange={onInitiativeChange} />
      <button className="combat-prep-note-button" type="button" aria-label="Заметка">
        ▱
      </button>
      <button className="combat-prep-remove-ref" onClick={onRemove} type="button" aria-label={removeLabel}>
        ×
      </button>
    </article>
  );
}
