import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { EntityVisual, kindTitle } from "../../../app-shared";
import type { CombatProfileEntity } from "../combat.types";
import { getEntityChallenge } from "../combat.utils";
import { CombatInitiativeInput } from "./CombatInitiativeInput";

import { CombatThreatBadge, type CombatThreatContext } from "./CombatThreatBadge";

type CombatEnemyRowProps = {
  entity: CombatProfileEntity;
  threatContext?: CombatThreatContext;
  quantity: number;
  initiative: number;
  xp: number;
  onQuantityChange: (quantity: number) => void;
  onInitiativeChange: (value: number) => void;
  onRemove: () => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
};

export function CombatEnemyRow({
  entity,
  threatContext,
  quantity,
  initiative,
  xp,
  onQuantityChange,
  onInitiativeChange,
  onRemove,
  onOpenEntityImage
}: CombatEnemyRowProps) {
  return (
    <article className="combat-prep-field-row enemy-row">
      <EntityVisual entity={entity} onOpenEntityImage={onOpenEntityImage} />
      <div className="combat-prep-field-copy">
        <strong>{entity.title}</strong>
        <span>
          {entity.statBlock?.creatureType || kindTitle[entity.kind]} • {getEntityChallenge(entity) || "CR не указан"}
        </span>
        <CombatThreatBadge challenge={entity.statBlock?.challenge ?? ""} quantity={quantity} context={threatContext} />
      </div>
      <div className="combat-prep-enemy-quantity"><span>Количество</span><div className="combat-prep-quantity-control">
        <button aria-label={`Уменьшить количество: ${entity.title}`} onClick={() => onQuantityChange(Math.max(1, quantity - 1))} type="button">
          −
        </button>
        <input
          aria-label={`Количество: ${entity.title}`} min={1} inputMode="numeric"
          onChange={(event) => onQuantityChange(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
          type="number"
          value={quantity}
        />
        <button aria-label={`Увеличить количество: ${entity.title}`} onClick={() => onQuantityChange(quantity + 1)} type="button">
          +
        </button>
      </div>
      </div>
      <label className="combat-prep-enemy-initiative"><span>Инициатива</span><CombatInitiativeInput label={`Инициатива: ${entity.title}`} value={initiative} onChange={onInitiativeChange} /></label>
      <strong className="combat-prep-enemy-xp">{xp} XP</strong>
      <button className="combat-prep-remove-ref" onClick={onRemove} type="button" aria-label={`Убрать: ${entity.title}`}>
        ×
      </button>
    </article>
  );
}
