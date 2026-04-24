import { useEffect, useRef } from "react";
import type { ActiveCombat, KnowledgeEntity, LastCombatSummary } from "@shadow-edge/shared-types";
import victoryBloodOverlayUrl from "./assets/victory-blood-overlay.png";
import { createPortraitSource } from "./app-shared";
import { combatEntryInitiative, combatVictoryLoserLabel, isCombatEntryOut, sortCombatEntriesByInitiative } from "./combat-ui";

export function InitiativeTrackerScreen({
  activeCombat,
  lastCombatSummary,
  entityMap,
  busy,
  error,
  onNextTurn,
  onSelectTurn
}: {
  activeCombat: ActiveCombat | null;
  lastCombatSummary: LastCombatSummary | null;
  entityMap: Map<string, KnowledgeEntity>;
  busy: boolean;
  error: string;
  onNextTurn: () => void;
  onSelectTurn: (entryId: string) => void;
}) {
  const orderedEntries = activeCombat ? sortCombatEntriesByInitiative(activeCombat.entries) : [];
  const enemyEntries = activeCombat?.entries.filter((entry) => entry.side === "enemy") ?? [];
  const showActiveCombatVictory = Boolean(activeCombat && enemyEntries.length && enemyEntries.every((entry) => isCombatEntryOut(entry)));
  const activeVictoryPlayerEntries = orderedEntries.filter((entry) => entry.side === "player");
  const victoryEntries = showActiveCombatVictory
    ? orderedEntries
    : lastCombatSummary?.entries
      ? sortCombatEntriesByInitiative(lastCombatSummary.entries)
      : [];
  const victoryTotalExperience = showActiveCombatVictory
    ? enemyEntries.reduce((sum, entry) => sum + (isCombatEntryOut(entry) ? entry.experience : 0), 0)
    : lastCombatSummary?.totalExperience ?? 0;
  const activeVictoryExperiencePerPlayer = activeVictoryPlayerEntries.length
    ? Math.round(victoryTotalExperience / activeVictoryPlayerEntries.length)
    : 0;
  const victoryPlayerRewards = showActiveCombatVictory
    ? activeVictoryPlayerEntries.map((entry) => ({
          title: entry.title,
          experience: activeVictoryExperiencePerPlayer
        }))
    : lastCombatSummary?.playerRewards ?? [];
  const victoryRound = showActiveCombatVictory ? Math.max(1, activeCombat?.round || 1) : Math.max(1, lastCombatSummary?.round || 1);
  const victoryPerPlayerExperience = showActiveCombatVictory
    ? activeVictoryExperiencePerPlayer
    : lastCombatSummary?.experiencePerPlayer ?? victoryPlayerRewards[0]?.experience ?? 0;
  const victoryRewardByTitle = new Map(victoryPlayerRewards.map((reward) => [reward.title, reward.experience]));
  const victoryWinnerEntries = victoryEntries.filter((entry) => entry.side === "player");
  const victoryLoserEntries = victoryEntries.filter((entry) => entry.side === "enemy");
  const trackViewportRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const currentTurnEntry =
    (activeCombat?.currentTurnEntryId ? orderedEntries.find((entry) => entry.id === activeCombat.currentTurnEntryId) ?? null : null) ??
    orderedEntries[0] ??
    null;

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

  return (
    <div className="initiative-display-screen">
      {activeCombat && orderedEntries.length && !showActiveCombatVictory ? (
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
                    className={`initiative-display-card ${isCurrent ? "current" : ""} ${entry.defeated ? "defeated" : ""}`}
                    onClick={() => onSelectTurn(entry.id)}
                    ref={(node) => {
                      cardRefs.current[entry.id] = node;
                    }}
                    type="button"
                  >
                    <span className="initiative-order-badge">{index + 1}</span>
                    <div className="initiative-card-frame">
                      {isCurrent ? <span aria-hidden="true" className="initiative-current-chevron" /> : null}
                      <div className="initiative-card-image-shell">
                        <img alt={entry.title} className="initiative-card-image" loading="lazy" src={visualSource} />
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
                className={`initiative-progress-dot ${currentTurnEntry?.id === entry.id ? "current" : ""} ${entry.defeated ? "defeated" : ""}`}
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
      ) : showActiveCombatVictory || lastCombatSummary ? (
        <div className="initiative-display-shell">
          <div className="initiative-round-banner">
            <span className="initiative-ornament-line" />
            <h1>Победа</h1>
            <span className="initiative-ornament-line" />
          </div>

          <div className="initiative-victory-display">
            <p className="initiative-victory-kicker">{showActiveCombatVictory ? activeCombat?.title || "Активный бой" : lastCombatSummary?.title || "Последний бой"}</p>
            <h2>Победа</h2>
            <p className="initiative-victory-copy">{`Раунд ${victoryRound}. Бой завершён, и игроки забирают награду.`}</p>

            {victoryWinnerEntries.length ? (
              <section className="initiative-victory-section">
                <p className="initiative-victory-section-label">Победители</p>
                <div className="initiative-victory-grid">
                  {victoryWinnerEntries.map((entry) => {
                    const linkedEntity = entityMap.get(entry.entityId) ?? null;
                    const visualSource = linkedEntity
                      ? createPortraitSource(linkedEntity)
                      : createPortraitSource({
                          kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
                          title: entry.title
                        });
                    const rewardExperience = victoryRewardByTitle.get(entry.title) ?? victoryPerPlayerExperience;

                    return (
                      <article key={`victory-winner-${entry.id}`} className="initiative-victory-panel initiative-victory-panel-winner">
                        <div className="initiative-victory-avatar-shell">
                          <img alt={entry.title} className="initiative-victory-avatar" loading="lazy" src={visualSource} />
                        </div>
                        <strong className="initiative-victory-name">{entry.title}</strong>
                        <span className="initiative-victory-value">{`${rewardExperience} XP`}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="initiative-victory-total">
              <small>Общий опыт</small>
              <strong>{`${victoryTotalExperience} XP`}</strong>
              <span>{`${victoryPerPlayerExperience} XP на игрока`}</span>
            </section>

            {victoryLoserEntries.length ? (
              <section className="initiative-victory-section initiative-victory-section-defeated">
                <p className="initiative-victory-section-label defeated">Проигравшие</p>
                <div className="initiative-victory-grid initiative-victory-grid-defeated">
                  {victoryLoserEntries.map((entry) => {
                    const linkedEntity = entityMap.get(entry.entityId) ?? null;
                    const visualSource = linkedEntity
                      ? createPortraitSource(linkedEntity)
                      : createPortraitSource({
                          kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
                          title: entry.title
                        });

                    return (
                      <article key={`victory-loser-${entry.id}`} className="initiative-victory-panel initiative-victory-panel-loser">
                        <div className="initiative-victory-avatar-shell initiative-victory-avatar-shell-loser">
                          <img alt={entry.title} className="initiative-victory-avatar" loading="lazy" src={visualSource} />
                          <img
                            alt=""
                            aria-hidden="true"
                            className="initiative-victory-blood-overlay"
                            loading="lazy"
                            src={victoryBloodOverlayUrl}
                          />
                        </div>
                        <strong className="initiative-victory-name">{entry.title}</strong>
                        <span className="initiative-victory-loser-meta">{combatVictoryLoserLabel(entry)}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
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

