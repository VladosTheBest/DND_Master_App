import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActiveCombat,
  CampaignData,
  CombatEntry,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import { hasVisibleArt, truncateInlineText } from "../../app-shared";
import {
  combatRosterFilters,
  CombatEntryCard,
  CombatEntryTile,
  isCombatEntryOut,
  sortCombatEntriesByInitiative,
  type CombatRosterFilter
} from "../../combat-ui";
import { formatPlaybackTime } from "../../playback";
import { combatDifficultyLabel } from "./combat.utils";

export type CombatTrackerPageProps = {
  campaign: CampaignData;
  activeCombat: ActiveCombat | null;
  entityMap: Map<string, KnowledgeEntity>;
  selectedEntry: CombatEntry | null;
  selectedEntity: KnowledgeEntity | null;
  combatPortraitNotice: string;
  initiativePublishNotice: string;
  bootError: string;
  isCombatPlaylistActive: boolean;
  currentPlaybackTrackLabel: string;
  initiativeShareBusy: boolean;
  combatStateBusy: boolean;
  saving: boolean;
  combatPlayerEntityId: string;
  combatPlayerInitiative: number;
  onCombatPlayerEntityIdChange: (value: string) => void;
  onCombatPlayerInitiativeChange: (value: number) => void;
  onAddManualPlayer: () => void;
  onPlayCombatPlaylist: () => void;
  onPlayNextRandomTrack: () => void;
  onOpenCombatPlaylistModal: () => void;
  onOpenPublicTracker: () => void;
  onCopyPublicTracker: () => void;
  onSyncCombatPortraits: () => void;
  onOpenCombatSetupModal: () => void;
  onOpenRandomEventModal: () => void;
  onSelectEntry: (entryId: string) => void;
  onChangeHitPoints: (entry: CombatEntry, nextHp: number) => void;
  onChangeInitiative: (entry: CombatEntry, nextInitiative: number) => void;
  onSetTurn: (entryId: string) => void;
  onNextTurn: () => void;
  onDeclarePlayersVictory: () => void;
  onFinishCombat: () => void;
};

export function CombatTrackerPage({
  campaign,
  activeCombat,
  entityMap,
  selectedEntry,
  selectedEntity,
  combatPortraitNotice,
  initiativePublishNotice,
  bootError,
  isCombatPlaylistActive,
  currentPlaybackTrackLabel,
  initiativeShareBusy,
  combatStateBusy,
  saving,
  combatPlayerEntityId,
  combatPlayerInitiative,
  onCombatPlayerEntityIdChange,
  onCombatPlayerInitiativeChange,
  onAddManualPlayer,
  onPlayCombatPlaylist,
  onPlayNextRandomTrack,
  onOpenCombatPlaylistModal,
  onOpenPublicTracker,
  onCopyPublicTracker,
  onSyncCombatPortraits,
  onOpenCombatSetupModal,
  onOpenRandomEventModal,
  onSelectEntry,
  onChangeHitPoints,
  onChangeInitiative,
  onSetTurn,
  onNextTurn,
  onDeclarePlayersVictory,
  onFinishCombat
}: CombatTrackerPageProps) {
  if (!activeCombat) {
    return null;
  }

  const [rosterFilter, setRosterFilter] = useState<CombatRosterFilter>("all");
  const [checklistOverrides, setChecklistOverrides] = useState<Record<string, boolean>>({});
  const [clockNow, setClockNow] = useState(() => Date.now());
  const combatStartedAtRef = useRef<{ id: string; startedAt: number } | null>(null);
  const orderedEntries = useMemo(() => sortCombatEntriesByInitiative(activeCombat.entries), [activeCombat.entries]);
  const currentTurnEntry =
    (activeCombat.currentTurnEntryId ? orderedEntries.find((entry) => entry.id === activeCombat.currentTurnEntryId) ?? null : null) ??
    orderedEntries[0] ??
    null;
  const selectedEntryResolved = selectedEntry ?? orderedEntries[0] ?? null;
  const selectedEntityResolved =
    selectedEntryResolved && selectedEntryResolved.id === selectedEntry?.id
      ? selectedEntity
      : selectedEntryResolved
        ? entityMap.get(selectedEntryResolved.entityId) ?? null
        : null;
  const playerCount = activeCombat.entries.filter((entry) => entry.side === "player").length;
  const enemyCount = activeCombat.entries.filter((entry) => entry.side === "enemy").length;
  const livingEnemyCount = activeCombat.entries.filter((entry) => entry.side === "enemy" && !isCombatEntryOut(entry)).length;
  const defeatedCount = activeCombat.entries.filter((entry) => isCombatEntryOut(entry)).length;
  const revealEnemyRewards = enemyCount > 0 && livingEnemyCount === 0;
  const resolvedEnemyExperienceTotal = activeCombat.entries.reduce(
    (sum, entry) => sum + (entry.side === "enemy" && isCombatEntryOut(entry) ? entry.experience : 0),
    0
  );
  const currentTurnIndex = currentTurnEntry ? orderedEntries.findIndex((entry) => entry.id === currentTurnEntry.id) : -1;
  const turnProgressPercent = orderedEntries.length ? ((Math.max(currentTurnIndex, 0) + 1) / orderedEntries.length) * 100 : 0;
  const selectedCombatPlayer =
    combatPlayerEntityId && campaign.players.find((player) => player.id === combatPlayerEntityId) ? campaign.players.find((player) => player.id === combatPlayerEntityId) ?? null : null;
  const selectedCombatPlayerAlreadyInFight = Boolean(
    combatPlayerEntityId && activeCombat.entries.some((entry) => entry.entityId === combatPlayerEntityId && entry.side === "player")
  );
  const portraitsReady = activeCombat.entries.every((entry) => {
    const entity = entityMap.get(entry.entityId);
    return entity ? hasVisibleArt(entity.art) : false;
  });
  const actualExperiencePerPlayer = activeCombat.partySize
    ? Math.floor(resolvedEnemyExperienceTotal / Math.max(activeCombat.partySize, 1))
    : resolvedEnemyExperienceTotal;
  const sceneTags = Array.from(
    new Set(
      [
        activeCombat.difficulty ? combatDifficultyLabel[activeCombat.difficulty] : "",
        `Раунд ${Math.max(1, activeCombat.round || 1)}`,
        livingEnemyCount ? `${livingEnemyCount} врага в строю` : "Все враги выведены",
        ...(selectedEntityResolved?.tags ?? []).slice(0, 2)
      ].filter(Boolean)
    )
  ).slice(0, 4);
  const masterNotes = [
    currentTurnEntry ? `Сейчас темп сцены держит ${currentTurnEntry.title}.` : "",
    selectedEntryResolved?.summary ? truncateInlineText(selectedEntryResolved.summary, 148) : "",
    activeCombat.difficulty ? `Сложность: ${combatDifficultyLabel[activeCombat.difficulty]}.` : "",
    livingEnemyCount ? `На ногах осталось ${livingEnemyCount} противников.` : "Все противники уже выведены из сцены."
  ]
    .filter(Boolean)
    .slice(0, 4);
  const checklistItems = [
    { id: "portraits", label: "Портреты участников готовы", done: portraitsReady },
    { id: "public", label: "Публичная ссылка подготовлена", done: Boolean(initiativePublishNotice) },
    { id: "turn", label: "Текущий ход выбран", done: Boolean(currentTurnEntry) },
    { id: "pressure", label: "На сцене ещё есть активные враги", done: livingEnemyCount > 0 }
  ];
  const visibleRosterEntries = orderedEntries.filter((entry) => {
    if (rosterFilter === "players") {
      return entry.side === "player";
    }
    if (rosterFilter === "enemies") {
      return entry.side === "enemy";
    }
    return true;
  });

  useEffect(() => {
    if (combatStartedAtRef.current?.id !== activeCombat.id) {
      combatStartedAtRef.current = {
        id: activeCombat.id,
        startedAt: Date.now() - Math.max(activeCombat.round - 1, 0) * 45_000
      };
      setChecklistOverrides({});
    }
  }, [activeCombat.id, activeCombat.round]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const combatDurationLabel = formatPlaybackTime(
    Math.max(0, (clockNow - (combatStartedAtRef.current?.startedAt ?? clockNow)) / 1000)
  );

  return (
    <div className="combat-studio">
      {combatPortraitNotice || initiativePublishNotice || bootError ? (
        <div className="combat-notice-grid">
          {combatPortraitNotice ? (
            <div className="card mini form-success" role="status">
              <strong>Портреты обновлены</strong>
              <p>{combatPortraitNotice}</p>
            </div>
          ) : null}
          {initiativePublishNotice ? (
            <div className="card mini form-success" role="status">
              <strong>Публичный трекер</strong>
              <p>{initiativePublishNotice}</p>
            </div>
          ) : null}
          {bootError ? (
            <div className="card mini form-error" role="status">
              <strong>Проблема в бою</strong>
              <p>{bootError}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="combat-summary-grid">
        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Общая боевая инициатива</span>
            <span>{orderedEntries.length} участников</span>
          </div>
          <strong>{currentTurnEntry ? `Следующий ход: ${currentTurnEntry.title}` : "Порядок готов"}</strong>
          <div className="combat-summary-progress">
            <span style={{ width: `${turnProgressPercent}%` }} />
          </div>
          <div className="combat-summary-actions">
            <button
              className="primary combat-turn-advance-button"
              disabled={combatStateBusy || !orderedEntries.length}
              onClick={onNextTurn}
              type="button"
            >
              {combatStateBusy ? "РџРµСЂРµРєР»СЋС‡Р°СЋ..." : "РЎР»РµРґСѓСЋС‰РёР№ С…РѕРґ"}
            </button>
          </div>
        </section>

        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Плейлист треков</span>
            <span>{isCombatPlaylistActive ? "Играет" : "Готов"}</span>
          </div>
          <strong>{currentPlaybackTrackLabel || "Бой — Напряжение"}</strong>
          <div className="combat-summary-actions">
            <button className="ghost" disabled={!(campaign.combatPlaylist ?? []).length} onClick={onPlayCombatPlaylist} type="button">
              {isCombatPlaylistActive ? "Следующий трек" : "Запустить"}
            </button>
            <button className="ghost" disabled={!(campaign.combatPlaylist ?? []).length} onClick={onPlayNextRandomTrack} type="button">
              Рандом
            </button>
            <button className="ghost" onClick={onOpenCombatPlaylistModal} type="button">
              Плейлист
            </button>
          </div>
        </section>

        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Условия сцены</span>
            <span>{sceneTags.length} метки</span>
          </div>
          <div className="combat-tag-list">
            {sceneTags.map((tag) => (
              <span key={`${activeCombat.id}-${tag}`} className="combat-tag-pill">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Быстрые действия</span>
            <span>{initiativeShareBusy ? "Готовлю ссылку" : "На стол"}</span>
          </div>
          <div className="combat-summary-action-grid">
            <button className="ghost" disabled={saving} onClick={onSyncCombatPortraits} type="button">
              Подтянуть фотки
            </button>
            <button className="ghost" onClick={onOpenCombatSetupModal} type="button">
              Добавить врага
            </button>
            <button className="ghost" disabled={initiativeShareBusy} onClick={onOpenPublicTracker} type="button">
              {initiativeShareBusy ? "Готовлю..." : "Публичный трекер"}
            </button>
            <button className="ghost" disabled={initiativeShareBusy} onClick={onCopyPublicTracker} type="button">
              Копировать ссылку
            </button>
            <button className="ghost" onClick={onOpenRandomEventModal} type="button">
              Случайное событие
            </button>
            <button className="ghost" disabled={combatStateBusy || saving} onClick={onDeclarePlayersVictory} type="button">
              Победа игроков
            </button>
            <button className="danger-action ghost" disabled={saving} onClick={onFinishCombat} type="button">
              Завершить бой
            </button>
          </div>
        </section>
      </div>

      <div className="combat-studio-grid">
        <aside className="card combat-roster-panel">
          <div className="row muted">
            <strong>Порядок инициативы</strong>
            <div className="combat-roster-filter">
              {combatRosterFilters.map((filter) => (
                <button
                  key={`${activeCombat.id}-${filter.id}`}
                  className={`combat-roster-filter-btn ${rosterFilter === filter.id ? "active" : ""}`}
                  onClick={() => setRosterFilter(filter.id)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="combat-roster-list">
            {visibleRosterEntries.map((entry) => (
              <CombatEntryTile
                key={`roster-${entry.id}`}
                currentTurn={currentTurnEntry?.id === entry.id}
                entry={entry}
                linkedEntity={entityMap.get(entry.entityId) ?? null}
                onSelect={() => onSelectEntry(entry.id)}
                revealEnemyMeta={revealEnemyRewards}
                selected={selectedEntryResolved?.id === entry.id}
              />
            ))}
          </div>

          <button className="ghost fill" onClick={onOpenCombatSetupModal} type="button">
            + Добавить участника
          </button>
        </aside>

        <section className="combat-stage-panel">
          {selectedEntryResolved ? (
            <CombatEntryCard
              busy={combatStateBusy}
              currentTurnEntryId={currentTurnEntry?.id}
              entry={selectedEntryResolved}
              linkedEntity={selectedEntityResolved}
              onChangeHitPoints={onChangeHitPoints}
              onChangeInitiative={onChangeInitiative}
              onNextTurn={onNextTurn}
              onSetCurrentTurn={onSetTurn}
              revealEnemyMeta={revealEnemyRewards}
            />
          ) : (
            <section className="card combat-focus-card">
              <p className="copy">Выбери участника слева, чтобы открыть его профиль боя.</p>
            </section>
          )}
        </section>

        <aside className="combat-side-panel">
          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Детали боя</strong>
              <span>{currentTurnEntry ? `Ходит ${currentTurnEntry.title}` : "Без активного хода"}</span>
            </div>
            <div className="combat-side-detail-grid">
              <div className="combat-side-detail-row">
                <span>Тип боя</span>
                <strong>Боевой</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Сложность</span>
                <strong>
                  {revealEnemyRewards
                    ? activeCombat.difficulty
                      ? `${combatDifficultyLabel[activeCombat.difficulty]} (${activeCombat.actualAdjustedXp} XP)`
                      : `${activeCombat.actualAdjustedXp} XP`
                    : activeCombat.difficulty
                      ? combatDifficultyLabel[activeCombat.difficulty]
                      : "Откроется после финала"}
                </strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Опыт за победу</span>
                <strong>{revealEnemyRewards ? `${actualExperiencePerPlayer} XP / игрока` : "Откроется после победы"}</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Раунд</span>
                <strong>{Math.max(1, activeCombat.round || 1)}</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Время боя</span>
                <strong>{combatDurationLabel}</strong>
              </div>
            </div>
          </section>

          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Участники боя</strong>
              <span>
                {playerCount} игрока • {enemyCount} врага
              </span>
            </div>
            <div className="combat-side-participants-bar">
              <span className="players" style={{ width: `${(playerCount / Math.max(playerCount + enemyCount, 1)) * 100}%` }} />
              <span className="enemies" style={{ width: `${(enemyCount / Math.max(playerCount + enemyCount, 1)) * 100}%` }} />
            </div>
            <p className="copy">
              В строю: {playerCount - activeCombat.entries.filter((entry) => entry.side === "player" && entry.defeated).length} игроков • {livingEnemyCount} врагов
            </p>
          </section>

          <section className="card mini combat-side-card combat-player-panel">
            <div className="row muted">
              <strong>Добавить участника</strong>
              <span>Из вкладки Игроки</span>
            </div>
            <div className="combat-player-form">
              <label className="field">
                <span>Игрок</span>
                <select
                  className="input"
                  onChange={(event) => onCombatPlayerEntityIdChange(event.target.value)}
                  value={combatPlayerEntityId}
                >
                  <option value="">Выбери игрока</option>
                  {campaign.players.map((player) => {
                    const alreadyInFight = activeCombat.entries.some((entry) => entry.entityId === player.id && entry.side === "player");
                    return (
                      <option key={player.id} value={player.id}>
                        {alreadyInFight ? `${player.title} • уже в бою` : player.title}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="field combat-start-initiative-field">
                <span>Init</span>
                <input
                  className="input"
                  onChange={(event) => onCombatPlayerInitiativeChange(Number.parseInt(event.target.value, 10) || 0)}
                  type="number"
                  value={combatPlayerInitiative}
                />
              </label>
            </div>
            {selectedCombatPlayer ? (
              <p className="copy">
                {selectedCombatPlayerAlreadyInFight
                  ? `${selectedCombatPlayer.title} уже участвует в текущем бою.`
                  : selectedCombatPlayer.summary || `${selectedCombatPlayer.title} можно сразу добавить в инициативу.`}
              </p>
            ) : null}
            <button
              className="ghost fill"
              disabled={saving || !combatPlayerEntityId || selectedCombatPlayerAlreadyInFight}
              onClick={onAddManualPlayer}
              type="button"
            >
              Добавить игрока
            </button>
          </section>

          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Заметки для мастера</strong>
              <span>{defeatedCount} выведено</span>
            </div>
            <div className="combat-side-notes">
              {masterNotes.map((note, index) => (
                <p key={`${activeCombat.id}-note-${index}`}>{note}</p>
              ))}
            </div>
          </section>

          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Чек-лист мастера</strong>
              <span>{checklistItems.filter((item) => checklistOverrides[item.id] ?? item.done).length}/{checklistItems.length}</span>
            </div>
            <div className="combat-side-checklist">
              {checklistItems.map((item) => {
                const checked = checklistOverrides[item.id] ?? item.done;
                return (
                  <label key={`${activeCombat.id}-${item.id}`} className={`combat-side-checklist-item ${checked ? "done" : ""}`}>
                    <input
                      checked={checked}
                      onChange={() =>
                        setChecklistOverrides((current) => ({
                          ...current,
                          [item.id]: !(current[item.id] ?? item.done)
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
