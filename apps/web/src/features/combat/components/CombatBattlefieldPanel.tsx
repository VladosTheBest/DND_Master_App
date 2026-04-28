import type { MonsterEntity, NpcEntity, PlayerEntity } from "@shadow-edge/shared-types";
import { parseChallengeXp } from "../combat.utils";
import { CombatEnemyRow } from "./CombatEnemyRow";
import { CombatParticipantRow } from "./CombatParticipantRow";

export type CombatBattlefieldPanelProps = {
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
};

export function CombatBattlefieldPanel({
  draftPreparedCombatPlayers,
  draftPreparedCombatAllyCount,
  draftPreparedCombatAllies,
  draftPreparedCombatEnemies,
  campaignPreparedCombatDraftEnemyCount,
  preparedCombatPlayerInitiatives,
  preparedCombatAllyInitiatives,
  preparedCombatEnemyInitiatives,
  onPlayerInitiativeChange,
  onAllyInitiativeChange,
  onEnemyInitiativeChange,
  onTogglePlayer,
  onRemoveAlly,
  onEnemyQuantityChange,
  onRemoveEnemy
}: CombatBattlefieldPanelProps) {
  return (
    <section className="combat-prep-reference-panel field-panel">
      <div className="combat-prep-panel-head field-head">
        <div>
          <h2>Бой на поле</h2>
          <span>Готов к инициативе</span>
        </div>
        <div className="combat-prep-count-tabs">
          <span>{`Персонажи ${draftPreparedCombatPlayers.length + draftPreparedCombatAllyCount}`}</span>
          <span>{`Противники ${campaignPreparedCombatDraftEnemyCount}`}</span>
          <span>{`Всего ${draftPreparedCombatPlayers.length + draftPreparedCombatAllyCount + campaignPreparedCombatDraftEnemyCount}`}</span>
        </div>
      </div>

      <div className="combat-prep-field-section players">
        <div className="combat-prep-field-title">
          <strong>♟ Игроки</strong>
          <span>Инициатива</span>
          <span>Заметки</span>
        </div>
        <div className="combat-prep-field-list">
          {draftPreparedCombatPlayers.length ? (
            draftPreparedCombatPlayers.map((player) => (
              <CombatParticipantRow
                key={`combat-prep-selected-player-${player.id}`}
                className="combat-prep-field-row player-row"
                entity={player}
                initiative={preparedCombatPlayerInitiatives[player.id] ?? 0}
                onInitiativeChange={(value) => onPlayerInitiativeChange(player.id, value)}
                onRemove={() => onTogglePlayer(player.id)}
                removeLabel="Убрать"
                subtitle={player.role || player.subtitle || "Игрок"}
                title={player.title}
              />
            ))
          ) : (
            <p className="copy">Добавь игроков слева.</p>
          )}
        </div>
      </div>

      <div className="combat-prep-field-section allies">
        <div className="combat-prep-field-title">
          <strong>♧ Союзники</strong>
          <span>Инициатива</span>
          <span>Заметки</span>
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

      <div className="combat-prep-field-section enemies">
        <div className="combat-prep-field-title">
          <strong>☠ Противники</strong>
          <span>Кол-во</span>
          <span>Инициатива</span>
          <span>XP</span>
        </div>
        <div className="combat-prep-field-list enemy-list">
          {draftPreparedCombatEnemies.length ? (
            draftPreparedCombatEnemies.map(({ entity, quantity }) => (
              <CombatEnemyRow
                key={`combat-prep-selected-enemy-${entity.id}`}
                entity={entity}
                initiative={preparedCombatEnemyInitiatives[entity.id] ?? 0}
                onInitiativeChange={(value) => onEnemyInitiativeChange(entity.id, value)}
                onQuantityChange={(nextQuantity) => onEnemyQuantityChange(entity.id, nextQuantity)}
                onRemove={() => onRemoveEnemy(entity.id)}
                quantity={quantity}
                xp={parseChallengeXp(entity.statBlock?.challenge ?? "") * quantity}
              />
            ))
          ) : (
            <p className="copy">Добавь противников справа.</p>
          )}
        </div>
        <button className="combat-prep-drop-zone" type="button">
          ↙ Перетащи монстров сюда или добавь из списка справа
        </button>
      </div>
    </section>
  );
}
