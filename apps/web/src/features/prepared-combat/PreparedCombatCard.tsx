import { badge } from "../../app-shared";
import type {
  PreparedCombatCardView
} from "./preparedCombat.types";

type PreparedCombatCardProps = {
  card: PreparedCombatCardView;
  onOpen: () => void;
  onStart: () => void;
};

export function PreparedCombatCard({
  card,
  onOpen,
  onStart
}: PreparedCombatCardProps) {
  return (
    <article className="card entity-player-facing-panel entity-player-facing-panel-compact entity-prepared-combat-panel">
      <div className="quest-story-head">
        <strong>{card.title}</strong>
        <span className={badge("danger")}>Бой</span>
      </div>

      <div className="entity-prepared-combat-preview">
        <p className="entity-prepared-combat-line">{card.playersText}</p>
        <p className="entity-prepared-combat-line">{card.enemiesText}</p>
        <p className="entity-prepared-combat-xp">{card.xpText}</p>
      </div>

      <div className="entity-player-facing-actions">
        <button className="ghost fill" onClick={onOpen} type="button">
          Посмотреть бой
        </button>
        <button className="primary" disabled={card.startDisabled} onClick={onStart} type="button">
          {card.startLabel || "Начать бой"}
        </button>
      </div>
    </article>
  );
}
