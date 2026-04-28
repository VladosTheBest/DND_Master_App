import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import type {
  KnowledgeEntity,
  PreparedCombatPlan
} from "@shadow-edge/shared-types";
import { badge, clamp, CollapsibleSection } from "../../app-shared";
import type { PreparedCombatHostEntity } from "../combat/combat.types";
import { resolveEntityPreparedCombats } from "../combat/combat.utils";
import { PreparedCombatCard } from "./PreparedCombatCard";
import "./preparedCombat.css";
import {
  buildPreparedCombatCardView,
  resolvePreparedCombatListCopy
} from "./preparedCombat.utils";

type PreparedCombatListProps = {
  entity: PreparedCombatHostEntity;
  entityMap: Map<string, KnowledgeEntity>;
  hasActiveCombatEntries: boolean;
  onCreateCard: () => void;
  onDeleteCard?: (plan: PreparedCombatPlan | undefined, index: number, title: string) => void;
  onOpenCard: (plan: PreparedCombatPlan | undefined, index: number) => void;
  onStartCard: (plan: PreparedCombatPlan | undefined, index: number) => void;
};

export function PreparedCombatList({
  entity,
  entityMap,
  hasActiveCombatEntries,
  onCreateCard,
  onDeleteCard,
  onOpenCard,
  onStartCard
}: PreparedCombatListProps) {
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const plans = useMemo(() => resolveEntityPreparedCombats(entity), [entity]);
  const cards = useMemo(
    () =>
      plans.map((plan, index) =>
        buildPreparedCombatCardView({
          entity,
          entityMap,
          hasActiveCombatEntries,
          plan,
          planIndex: index
        })
      ),
    [entity, entityMap, hasActiveCombatEntries, plans]
  );
  const copy = useMemo(() => resolvePreparedCombatListCopy(entity), [entity]);

  useEffect(() => {
    setContextMenu((current) => (current && current.index >= cards.length ? null : current));
  }, [cards.length]);

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleCardContextMenu = (event: ReactMouseEvent<HTMLElement>, index: number) => {
    if (!onDeleteCard) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      index,
      x: clamp(event.clientX, 12, window.innerWidth - 260),
      y: clamp(event.clientY, 12, window.innerHeight - 120)
    });
  };

  const contextMenuCard = contextMenu ? cards[contextMenu.index] ?? null : null;
  const contextMenuPlan = contextMenu ? plans[contextMenu.index] : undefined;

  return (
    <>
      <CollapsibleSection
        action={<span className={badge(cards.length ? "danger" : "default")}>{cards.length ? `${cards.length} карточек` : "Черновик нужен"}</span>}
        className="entity-prepared-combat-stack entity-player-facing-collapsible"
        hint={copy.description}
        summary={
          <p className="copy entity-player-facing-summary">
            {cards.length
              ? `Секция скрыта. Внутри ${cards.length} ${cards.length === 1 ? "карточка боя" : cards.length < 5 ? "карточки боя" : "карточек боя"}.`
              : "Секция скрыта. Карточек боя пока нет."}
          </p>
        }
        title="Заготовленные бои"
      >
        <div className="entity-player-facing-grid">
          {cards.length ? (
            cards.map((card, index) => (
              <div key={`${entity.id}-prepared-combat-${index}`} onContextMenu={(event) => handleCardContextMenu(event, index)}>
                <PreparedCombatCard
                  card={card}
                  onOpen={() => onOpenCard(plans[index], index)}
                  onStart={() => onStartCard(plans[index], index)}
                />
              </div>
            ))
          ) : (
            <article className="card entity-player-facing-panel entity-player-facing-panel-compact entity-prepared-combat-panel">
              <div className="quest-story-head">
                <strong>Карточек боя пока нет</strong>
                <span className={badge("default")}>0</span>
              </div>
              <p className="copy">{copy.emptyDescription}</p>
            </article>
          )}

          <button
            className="card entity-player-facing-panel entity-player-facing-panel-compact entity-player-facing-panel-create entity-prepared-combat-panel-create"
            onClick={onCreateCard}
            type="button"
          >
            <span className="entity-player-facing-create-mark">+</span>
            <strong>Создать ещё</strong>
            <p className="copy">{copy.createDescription}</p>
          </button>
        </div>
      </CollapsibleSection>

      {contextMenu && contextMenuCard && onDeleteCard ? (
        <div className="entity-action-backdrop" onClick={closeContextMenu} role="presentation">
          <div
            className="entity-action-menu"
            onClick={(event) => event.stopPropagation()}
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="entity-action-menu-label">
              <small>Карточка боя</small>
              <strong>{contextMenuCard.title}</strong>
            </div>
            <button
              className="ghost fill danger-action"
              onClick={() => {
                onDeleteCard(contextMenuPlan, contextMenu.index, contextMenuCard.title);
                closeContextMenu();
              }}
              type="button"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
