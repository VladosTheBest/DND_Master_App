import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { EntityVisual, kindTitle } from "../../../app-shared";
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
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
};

export function CombatParticipantRow({
  entity,
  title,
  subtitle,
  initiative,
  onInitiativeChange,
  onRemove,
  removeLabel,
  className,
  onOpenEntityImage
}: CombatParticipantRowProps) {
  return (
    <article className={className}>
      <EntityVisual entity={entity} onOpenEntityImage={onOpenEntityImage} />
      <div className="combat-prep-field-copy">
        <strong>{title}</strong>
        <span>{subtitle || entity.role || entity.subtitle || kindTitle[entity.kind]}</span>
      </div>
      <CombatInitiativeInput label={`Инициатива: ${title}`} value={initiative} onChange={onInitiativeChange} />
      <button className="combat-prep-remove-ref" onClick={onRemove} type="button" aria-label={`${removeLabel}: ${title}`}>
        ×
      </button>
    </article>
  );
}
