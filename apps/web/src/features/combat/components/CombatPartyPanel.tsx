import type { MonsterEntity, NpcEntity, PlayerEntity } from "@shadow-edge/shared-types";
import { createPortraitSource, kindTitle } from "../../../app-shared";
import { formatParticipantCountLabel } from "../combat.utils";

export type CombatPartyPanelProps = {
  draftPreparedCombatPartyCount: number;
  draftPreparedCombatPlayers: PlayerEntity[];
  draftPreparedCombatAllyCount: number;
  combatPlayerCatalogItems: PlayerEntity[];
  combatAllyCatalogItems: Array<NpcEntity | MonsterEntity>;
  selectedPlayerIds: string[];
  selectedAllyIds: Set<string>;
  combatPlayerSearchQuery: string;
  combatAllySearchQuery: string;
  onCombatPlayerSearchQueryChange: (value: string) => void;
  onCombatAllySearchQueryChange: (value: string) => void;
  onTogglePlayer: (playerId: string) => void;
  onToggleAlly: (entityId: string) => void;
  onRequestSwapToEntity: (kind: "player" | "npc") => void;
};

export function CombatPartyPanel({
  draftPreparedCombatPartyCount,
  draftPreparedCombatPlayers,
  draftPreparedCombatAllyCount,
  combatPlayerCatalogItems,
  combatAllyCatalogItems,
  selectedPlayerIds,
  selectedAllyIds,
  combatPlayerSearchQuery,
  combatAllySearchQuery,
  onCombatPlayerSearchQueryChange,
  onCombatAllySearchQueryChange,
  onTogglePlayer,
  onToggleAlly,
  onRequestSwapToEntity
}: CombatPartyPanelProps) {
  return (
    <section className="combat-prep-reference-panel party-panel">
      <div className="combat-prep-panel-head">
        <div>
          <h2>Состав группы</h2>
          <span>{`${draftPreparedCombatPartyCount} ${formatParticipantCountLabel(draftPreparedCombatPartyCount)} на стороне партии`}</span>
        </div>
        <button className="combat-prep-small-icon" type="button" aria-label="Настройки состава">
          ⚙
        </button>
      </div>

      <div className="combat-prep-party-tabs">
        <button className="active" type="button">
          Игроки {draftPreparedCombatPlayers.length}
        </button>
        <button className={draftPreparedCombatAllyCount > 0 ? "active ally" : "ally"} type="button">
          Союзники {draftPreparedCombatAllyCount}
        </button>
      </div>

      <div className="combat-prep-subhead">
        <strong>{`Игроки (${draftPreparedCombatPlayers.length})`}</strong>
        <button className="combat-prep-purple-button" onClick={() => onRequestSwapToEntity("player")} type="button">
          + Добавить игрока
        </button>
      </div>

      <label className="combat-prep-search-field">
        <span>⌕</span>
        <input
          onChange={(event) => onCombatPlayerSearchQueryChange(event.target.value)}
          placeholder="Поиск игрока..."
          value={combatPlayerSearchQuery}
        />
      </label>

      <div className="combat-prep-party-list">
        {combatPlayerCatalogItems.length ? (
          combatPlayerCatalogItems.map((player) => {
            const selected = selectedPlayerIds.includes(player.id);
            return (
              <article key={`combat-prep-player-${player.id}`} className={`combat-prep-party-card ${selected ? "selected" : ""}`}>
                <img alt={player.title} loading="lazy" src={createPortraitSource(player)} />
                <div>
                  <strong>{player.title}</strong>
                  <span>{player.role || player.subtitle || "Персонаж партии"}</span>
                </div>
                <button
                  className={`combat-prep-check ${selected ? "active" : ""}`}
                  onClick={() => onTogglePlayer(player.id)}
                  type="button"
                  aria-label={selected ? "Убрать игрока" : "Добавить игрока"}
                >
                  {selected ? "✓" : "+"}
                </button>
              </article>
            );
          })
        ) : (
          <p className="copy">Игроки не найдены.</p>
        )}
      </div>

      <div className="combat-prep-subhead allies-head">
        <strong>{`Союзники (${draftPreparedCombatAllyCount})`}</strong>
        <button className="combat-prep-purple-button" onClick={() => onRequestSwapToEntity("npc")} type="button">
          + Создать NPC
        </button>
      </div>

      <label className="combat-prep-search-field">
        <span>⌕</span>
        <input
          onChange={(event) => onCombatAllySearchQueryChange(event.target.value)}
          placeholder="Поиск союзника среди NPC и монстров..."
          value={combatAllySearchQuery}
        />
      </label>

      <div className="combat-prep-party-list">
        {combatAllyCatalogItems.length ? (
          combatAllyCatalogItems.map((entity) => {
            const selected = selectedAllyIds.has(entity.id);
            return (
              <article key={`combat-prep-ally-${entity.id}`} className={`combat-prep-party-card ally-card ${selected ? "selected" : ""}`}>
                <img alt={entity.title} loading="lazy" src={createPortraitSource(entity)} />
                <div>
                  <strong>{entity.title}</strong>
                  <span>{entity.statBlock?.creatureType || entity.role || entity.subtitle || kindTitle[entity.kind]}</span>
                </div>
                <button
                  className={`combat-prep-check ally-toggle ${selected ? "active" : ""}`}
                  onClick={() => onToggleAlly(entity.id)}
                  type="button"
                  aria-label={selected ? "Убрать союзника" : "Добавить союзника"}
                >
                  {selected ? "✓" : "+"}
                </button>
              </article>
            );
          })
        ) : (
          <div className="combat-prep-empty-ally">
            <span aria-hidden="true">♡</span>
            <p>По текущему поиску союзники не найдены. Можно выбирать любых NPC и монстров: в этой сцене они будут считаться союзниками партии.</p>
          </div>
        )}
      </div>
    </section>
  );
}
