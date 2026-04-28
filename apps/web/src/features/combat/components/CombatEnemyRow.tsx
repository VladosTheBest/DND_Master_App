import { createPortraitSource, kindTitle } from "../../../app-shared";
import type { CombatProfileEntity } from "../combat.types";
import { getEntityChallenge } from "../combat.utils";
import { CombatInitiativeInput } from "./CombatInitiativeInput";

type CombatEnemyRowProps = {
  entity: CombatProfileEntity;
  quantity: number;
  initiative: number;
  xp: number;
  onQuantityChange: (quantity: number) => void;
  onInitiativeChange: (value: number) => void;
  onRemove: () => void;
};

export function CombatEnemyRow({
  entity,
  quantity,
  initiative,
  xp,
  onQuantityChange,
  onInitiativeChange,
  onRemove
}: CombatEnemyRowProps) {
  return (
    <article className="combat-prep-field-row enemy-row">
      <span className="combat-prep-drag-handle">⋮⋮</span>
      <img alt={entity.title} loading="lazy" src={createPortraitSource(entity)} />
      <div className="combat-prep-field-copy">
        <strong>{entity.title}</strong>
        <span>
          {entity.statBlock?.creatureType || kindTitle[entity.kind]} • {getEntityChallenge(entity) || "CR не указан"}
        </span>
      </div>
      <div className="combat-prep-quantity-control">
        <button onClick={() => onQuantityChange(Math.max(1, quantity - 1))} type="button">
          −
        </button>
        <input
          inputMode="numeric"
          onChange={(event) => onQuantityChange(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
          type="number"
          value={quantity}
        />
        <button onClick={() => onQuantityChange(quantity + 1)} type="button">
          +
        </button>
      </div>
      <CombatInitiativeInput value={initiative} onChange={onInitiativeChange} />
      <strong className="combat-prep-enemy-xp">{xp} XP</strong>
      <button className="combat-prep-remove-ref" onClick={onRemove} type="button" aria-label="Убрать">
        ×
      </button>
    </article>
  );
}
