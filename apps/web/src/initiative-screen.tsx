import { useEffect, useRef, useState } from "react";
import type { ActiveCombat, KnowledgeEntity } from "@shadow-edge/shared-types";
import victoryBloodOverlayUrl from "./assets/victory-blood-overlay.png";
import { createPortraitSource } from "./app-shared";
import { combatEntryInitiative, isCombatEntryBloodied, isCombatEntryOut, sortCombatEntriesByInitiative } from "./combat-ui";

export function InitiativeTrackerScreen({
  activeCombat,
  entityMap,
  busy,
  error,
  onNextTurn,
  onSelectTurn
}: {
  activeCombat: ActiveCombat | null;
  entityMap: Map<string, KnowledgeEntity>;
  busy: boolean;
  error: string;
  onNextTurn: () => void;
  onSelectTurn: (entryId: string) => void;
}) {
  const orderedEntries = activeCombat ? sortCombatEntriesByInitiative(activeCombat.entries) : [];
  const trackViewportRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousCombatIdRef = useRef<string | null>(null);
  const previousHitPointsRef = useRef<Record<string, number>>({});
  const damageBurstTimersRef = useRef<Record<string, number>>({});
  const [damageBursts, setDamageBursts] = useState<Record<string, { amount: number; token: number }>>({});
  const currentTurnEntry =
    (activeCombat?.currentTurnEntryId ? orderedEntries.find((entry) => entry.id === activeCombat.currentTurnEntryId) ?? null : null) ??
    orderedEntries[0] ??
    null;

  const clearDamageBursts = () => {
    Object.values(damageBurstTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    damageBurstTimersRef.current = {};
    setDamageBursts({});
  };

  const triggerDamageBurst = (entryId: string, amount: number) => {
    const visibleAmount = Math.max(0, Math.floor(amount));
    if (visibleAmount <= 0) {
      return;
    }

    const token = Date.now() + Math.random();
    setDamageBursts((current) => ({
      ...current,
      [entryId]: { amount: visibleAmount, token }
    }));

    const existingTimer = damageBurstTimersRef.current[entryId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    damageBurstTimersRef.current[entryId] = window.setTimeout(() => {
      setDamageBursts((current) => {
        if (current[entryId]?.token !== token) {
          return current;
        }

        const { [entryId]: _removedBurst, ...next } = current;
        return next;
      });
      delete damageBurstTimersRef.current[entryId];
    }, 2800);
  };

  useEffect(() => {
    if (!currentTurnEntry?.id) {
      return;
    }

    const viewport = trackViewportRef.current;
    const card = cardRefs.current[currentTurnEntry.id];
    if (!viewport || !card) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const nextLeft =
      viewport.scrollLeft +
      (cardRect.left - viewportRect.left) -
      Math.max(0, viewportRect.width / 2 - cardRect.width / 2);

    viewport.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: "smooth"
    });
  }, [currentTurnEntry?.id, orderedEntries.length]);

  useEffect(() => {
    if (!activeCombat) {
      previousCombatIdRef.current = null;
      previousHitPointsRef.current = {};
      clearDamageBursts();
      return;
    }

    const isSameCombat = previousCombatIdRef.current === activeCombat.id;
    const nextHitPoints: Record<string, number> = {};
    activeCombat.entries.forEach((entry) => {
      nextHitPoints[entry.id] = entry.currentHitPoints;
      const previousHitPoints = previousHitPointsRef.current[entry.id];
      if (isSameCombat && previousHitPoints !== undefined && entry.currentHitPoints < previousHitPoints) {
        triggerDamageBurst(entry.id, previousHitPoints - entry.currentHitPoints);
      }
    });

    previousCombatIdRef.current = activeCombat.id;
    previousHitPointsRef.current = nextHitPoints;
  }, [activeCombat?.id, activeCombat?.entries]);

  useEffect(
    () => () => {
      Object.values(damageBurstTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      damageBurstTimersRef.current = {};
    },
    []
  );

  return (
    <div className="initiative-display-screen">
      {activeCombat && orderedEntries.length ? (
        <div className="initiative-display-shell">
          <div className="initiative-round-banner">
            <span className="initiative-ornament-line" />
            <h1>{`Раунд ${Math.max(1, activeCombat.round || 1)}`}</h1>
            <span className="initiative-ornament-line" />
          </div>

          <div className="initiative-display-viewport" ref={trackViewportRef}>
            <div className="initiative-display-track">
              {orderedEntries.map((entry, index) => {
                const linkedEntity = entityMap.get(entry.entityId) ?? null;
                const isCurrent = currentTurnEntry?.id === entry.id;
                const visualSource = linkedEntity
                  ? createPortraitSource(linkedEntity)
                  : createPortraitSource({
                      kind: entry.entityKind === "monster" ? "monster" : "npc",
                      title: entry.title
                    });

                return (
                  <button
                    key={`initiative-card-${entry.id}`}
                    className={`initiative-display-card ${isCurrent ? "current" : ""} ${isCombatEntryOut(entry) ? "defeated" : ""}`}
                    onClick={() => onSelectTurn(entry.id)}
                    ref={(node) => {
                      cardRefs.current[entry.id] = node;
                    }}
                    type="button"
                  >
                    <span className="initiative-order-badge">{index + 1}</span>
                    {damageBursts[entry.id] ? (
                      <span key={damageBursts[entry.id].token} className="initiative-damage-burst" aria-live="polite">
                        -{damageBursts[entry.id].amount}
                      </span>
                    ) : null}
                    <div className="initiative-card-frame">
                      {isCurrent ? <span aria-hidden="true" className="initiative-current-chevron" /> : null}
                      <div className="initiative-card-image-shell">
                        <img alt={entry.title} className="initiative-card-image" loading="lazy" src={visualSource} />
                        {isCombatEntryBloodied(entry) ? (
                          <img alt="" aria-hidden="true" className="combat-blood-overlay" loading="lazy" src={victoryBloodOverlayUrl} />
                        ) : null}
                      </div>
                      <div className="initiative-card-copy">
                        <strong>{entry.title}</strong>
                        <span>{combatEntryInitiative(entry)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="initiative-progress-rail">
            <span className="initiative-progress-line" />
            {orderedEntries.map((entry, index) => (
              <span
                key={`initiative-dot-${entry.id}`}
                className={`initiative-progress-dot ${currentTurnEntry?.id === entry.id ? "current" : ""} ${isCombatEntryOut(entry) ? "defeated" : ""}`}
                style={{ animationDelay: `${index * 90}ms` }}
              />
            ))}
          </div>

          <div className="initiative-display-actions">
            <button className="initiative-next-turn" disabled={busy} onClick={onNextTurn} type="button">
              {busy ? "Переключаю..." : "Следующий ход"}
            </button>
          </div>

          {error ? <p className="initiative-display-error">{error}</p> : null}
        </div>
      ) : (
        <div className="initiative-empty-display">
          <h1>Инициатива ждёт бой</h1>
        </div>
      )}
    </div>
  );
}
