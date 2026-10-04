import type { KnowledgeEntity, MonsterEntity, NpcEntity, PlayerEntity } from "@shadow-edge/shared-types";
import { parseChallengeXp } from "../combat.utils";
import { CombatEnemyRow } from "./CombatEnemyRow";
import { CombatParticipantRow } from "./CombatParticipantRow";

import type { CombatThreatContext } from "./CombatThreatBadge";

export type CombatBattlefieldPanelProps = {
  threatContext?: CombatThreatContext;
  draftPreparedCombatPlayers: PlayerEntity[];
  draftPreparedCombatAllyCount: number;
  draftPreparedCombatAllies: Array<{ entity: NpcEntity | MonsterEntity; quantity: number }>;
  draftPreparedCombatEnemies: Array<{ entity: NpcEntity | MonsterEntity; quantity: number }>;
  campaignPreparedCombatDraftEnemyCount: number;
  preparedCombatPlayerInitiatives: Record<string, number>;
  preparedCombatAllyInitiatives: Record<string, number>;
  preparedCombatEnemyInitiatives: Record<string, number>;
  onPlayerInitiativeChange: (playerId: string, value: number) => void;
  onAllyInitiativeChange: (entityId: string, value: number) => void;
  onEnemyInitiativeChange: (entityId: string, value: number) => void;
  onTogglePlayer: (playerId: string) => void;
  onRemoveAlly: (entityId: string) => void;
  onEnemyQuantityChange: (entityId: string, quantity: number) => void;
  onRemoveEnemy: (entityId: string) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
};

export function CombatBattlefieldPanel({
  threatContext,
  draftPreparedCombatAllies,
  draftPreparedCombatEnemies,
  preparedCombatAllyInitiatives,
  preparedCombatEnemyInitiatives,
  onAllyInitiativeChange,
  onEnemyInitiativeChange,
  onRemoveAlly,
  onEnemyQuantityChange,
  onRemoveEnemy,
  onOpenEntityImage
}: CombatBattlefieldPanelProps) {
  return (
    <section className="combat-prep-reference-panel field-panel">
      <div className="combat-prep-panel-head field-head">
        <div>
          <h2>Противники</h2>
          <span>Добавьте врагов и настройте их количество</span>
        </div>
      </div>

      {draftPreparedCombatAllies.length ? <>
      <div className="combat-prep-field-section allies">
        <div className="combat-prep-field-title">
          <strong>♧ Союзники</strong>
          <span title="Инициатива">Иниц.</span>
          <span aria-hidden="true">×</span>
        </div>
        <div className="combat-prep-field-list">
          {draftPreparedCombatAllies.length ? (
            draftPreparedCombatAllies.map(({ entity, quantity }) => (
              <CombatParticipantRow
                key={`combat-prep-selected-ally-${entity.id}`}
                className="combat-prep-field-row ally-row"
                entity={entity}
                initiative={preparedCombatAllyInitiatives[entity.id] ?? 0}
                onInitiativeChange={(value) => onAllyInitiativeChange(entity.id, value)}
                onOpenEntityImage={onOpenEntityImage}
                onRemove={() => onRemoveAlly(entity.id)}
                removeLabel="Убрать"
                subtitle={entity.statBlock?.creatureType || entity.role || entity.subtitle}
                title={quantity > 1 ? `${entity.title} ×${quantity}` : entity.title}
              />
            ))
          ) : (
            <div className="combat-prep-empty-drop">Добавь союзника слева, если он участвует в бою.</div>
          )}
        </div>
      </div>

      </> : null}
      <div className="combat-prep-field-section enemies">
        <div className="combat-prep-enemy-columns"><span>Участник</span><span>Кол-во</span><span>Иниц.</span><span /></div>
        <div className="combat-prep-field-list enemy-list">
          {draftPreparedCombatEnemies.length ? (
            draftPreparedCombatEnemies.map(({ entity, quantity }) => (
              <CombatEnemyRow
                key={`combat-prep-selected-enemy-${entity.id}`}
                entity={entity}
                threatContext={threatContext}
                initiative={preparedCombatEnemyInitiatives[entity.id] ?? 0}
                onInitiativeChange={(value) => onEnemyInitiativeChange(entity.id, value)}
                onOpenEntityImage={onOpenEntityImage}
                onQuantityChange={(nextQuantity) => onEnemyQuantityChange(entity.id, nextQuantity)}
                onRemove={() => onRemoveEnemy(entity.id)}
                quantity={quantity}
                xp={parseChallengeXp(entity.statBlock?.challenge ?? "") * quantity}
              />
            ))
          ) : (
            <p className="copy">Найдите противника в каталоге и нажмите «+».</p>
          )}
        </div>

      </div>
    </section>
  );
}
