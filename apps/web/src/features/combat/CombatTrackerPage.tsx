import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActiveCombat,
  CampaignData,
  CombatEntry,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import {
  combatRosterFilters,
  CombatEntryCard,
  CombatEntryTile,
  isCombatEntryOut,
  sortCombatEntriesByInitiative,
  type CombatRosterFilter
} from "../../combat-ui";
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
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenRandomEventModal: () => void;
  onSelectEntry: (entryId: string) => void;
  onChangeHitPoints: (entry: CombatEntry, nextHp: number) => void;
  onChangeInitiative: (entry: CombatEntry, nextInitiative: number) => void;
  onSetTurn: (entryId: string) => void;
  onNextTurn: () => void;
  onDeclarePlayersVictory: () => void;
  onFinishCombat: () => void;
};

export function CombatTrackerPage({ activeCombat, entityMap, selectedEntry, selectedEntity, bootError, combatStateBusy, combatPortraitNotice, initiativePublishNotice,
  onOpenEntityImage, onSelectEntry, onChangeHitPoints, onChangeInitiative, onSetTurn, onNextTurn
}: CombatTrackerPageProps) {
  const [rosterFilter, setRosterFilter] = useState<CombatRosterFilter>("all");
  const [damageBursts, setDamageBursts] = useState<Record<string, { amount: number; token: number }>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);
  const orderedEntries = useMemo(() => sortCombatEntriesByInitiative(activeCombat?.entries ?? []), [activeCombat?.entries]);
  if (!activeCombat) return null;
  const current = orderedEntries.find(entry => entry.id === activeCombat.currentTurnEntryId) ?? orderedEntries[0];
  const selected = selectedEntry ?? current ?? null;
  const entity = selected && selected.id === selectedEntry?.id ? selectedEntity : selected ? entityMap.get(selected.entityId) ?? null : null;
  const visible = orderedEntries.filter(entry => rosterFilter === "all" || entry.side === (rosterFilter === "players" ? "player" : "enemy"));
  const livingEnemies = orderedEntries.filter(entry => entry.side === "enemy" && !isCombatEntryOut(entry)).length;
  const earnedXp = orderedEntries.reduce((sum, entry) => sum + (entry.side === "enemy" && isCombatEntryOut(entry) ? entry.experience : 0), 0);
  const applyDamage = (entry: CombatEntry, amount: number) => {
    const damage = Math.min(entry.currentHitPoints, Math.max(0, Math.floor(amount)));
    if (!damage || entry.maxHitPoints <= 0) return;
    const token = Date.now();
    setDamageBursts(old => ({...old, [entry.id]: {amount: damage, token}}));
    timers.current.push(window.setTimeout(() => setDamageBursts(old => {
      if (old[entry.id]?.token !== token) return old;
      const next = {...old}; delete next[entry.id]; return next;
    }), 1400));
    onChangeHitPoints(entry, Math.max(0, entry.currentHitPoints - damage));
  };
  return <div className="combat-studio combat-simple">
    {combatPortraitNotice || initiativePublishNotice ? <p role="status" className="form-success">{[combatPortraitNotice, initiativePublishNotice].filter(Boolean).join(" · ")}</p> : null}
    {bootError ? <p className="form-error" role="alert">{bootError}</p> : null}
    <header className="combat-turn-bar">
      <div className="combat-turn-identity"><span className="combat-round-label">Раунд {Math.max(1, activeCombat.round || 1)}</span><div><span className="combat-turn-caption"><i aria-hidden="true" />Сейчас ходит</span><h2>{current?.title || "Выберите участника"}</h2></div></div>
      <button className="primary combat-turn-advance-button" disabled={combatStateBusy || !orderedEntries.length} onClick={onNextTurn} type="button">{combatStateBusy ? "Переключаю…" : "Следующий ход →"}</button>
    </header>
    <div className="combat-studio-grid">
      <aside className="card combat-roster-panel">
        <div className="row"><strong>Очередь ходов</strong><span className="muted">{orderedEntries.length}</span></div>
        <div className="combat-roster-filter">{combatRosterFilters.map(filter => <button key={filter.id} aria-pressed={rosterFilter === filter.id} className={`combat-roster-filter-btn ${rosterFilter === filter.id ? "active" : ""}`} onClick={() => setRosterFilter(filter.id)} type="button">{filter.label}</button>)}</div>
        <div className="combat-roster-list">{visible.map(entry => <CombatEntryTile key={entry.id} currentTurn={current?.id === entry.id} damageFlash={damageBursts[entry.id]} entry={entry} linkedEntity={entityMap.get(entry.entityId) ?? null} onOpenEntityImage={onOpenEntityImage} onSelect={() => onSelectEntry(entry.id)} revealEnemyMeta selected={selected?.id === entry.id} />)}</div>
        {!visible.length ? <p className="muted">Нет участников этой стороны.</p> : null}
        <details className="combat-extra"><summary>Сведения о бое</summary><p>Врагов в строю: {livingEnemies}</p><p>Опыт за побеждённых: {earnedXp} XP</p>{activeCombat.difficulty ? <p>Сложность: {combatDifficultyLabel[activeCombat.difficulty]}</p> : null}</details>
      </aside>
      <section className="combat-stage-panel">{selected ? <CombatEntryCard busy={combatStateBusy} currentTurnEntryId={current?.id} entry={selected} linkedEntity={entity} onOpenEntityImage={onOpenEntityImage} onApplyDamage={applyDamage} onChangeHitPoints={onChangeHitPoints} onChangeInitiative={onChangeInitiative} onSetCurrentTurn={onSetTurn} revealEnemyMeta /> : null}</section>
    </div>
  </div>;
}
