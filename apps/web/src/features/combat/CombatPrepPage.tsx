import { CombatBattlefieldPanel, type CombatBattlefieldPanelProps } from "./components/CombatBattlefieldPanel";
import { CombatBestiaryPanel, type CombatBestiaryPanelProps } from "./components/CombatBestiaryPanel";
import { CombatDangerBar, type CombatDangerBarProps } from "./components/CombatDangerBar";
import { CombatPartyPanel, type CombatPartyPanelProps } from "./components/CombatPartyPanel";

export type CombatPrepPageProps = {
  campaignTitle: string;
  sceneTitle: string;
  hasHostEntity: boolean;
  saving: boolean;
  difficultyPartySize: number;
  canStartPreparedCombatDraft: boolean;
  bootError: string;
  campaignPreparedCombatNotice: string;
  dangerProps: CombatDangerBarProps;
  partyPanelProps: CombatPartyPanelProps;
  battlefieldPanelProps: CombatBattlefieldPanelProps;
  bestiaryPanelProps: CombatBestiaryPanelProps;
  enteredPartyLevel?: number;
  hasExplicitPartyLevels: boolean;
  partyCompositionText: string;
  onBack: () => void;
  onClear: () => void;
  onSave: () => void;
  onStart: () => void;
};

export function CombatPrepPage({
  campaignTitle,
  sceneTitle,
  hasHostEntity,
  saving,
  difficultyPartySize,
  canStartPreparedCombatDraft,
  bootError,
  campaignPreparedCombatNotice,
  dangerProps,
  partyPanelProps,
  battlefieldPanelProps,
  bestiaryPanelProps,
  hasExplicitPartyLevels,
  onBack,
  onClear,
  onSave,
  onStart
}: CombatPrepPageProps) {
  const threatContext = {
    partySize: difficultyPartySize,
    thresholds: dangerProps.effectiveCombatThresholds,
    ready: partyPanelProps.draftPreparedCombatPlayers.length > 0 && dangerProps.effectiveCombatThresholds.deadly > 0,
    approximate: !hasExplicitPartyLevels
  };
  return (
    <div className="combat-prep-page combat-prep-reference combat-prep-modern">
      <section className="combat-prep-reference-header">
        <button className="combat-prep-back" onClick={onBack} type="button">
          <span aria-hidden="true">←</span>
          <span>{hasHostEntity ? "К карточкам боя" : "Назад к кампании"}</span>
        </button>

        <div className="combat-prep-title-block"><span className="combat-prep-context">{campaignTitle} · {sceneTitle}</span><h1>Подготовка боя</h1><p className="muted">Выберите группу и противников, затем задайте инициативу.</p></div>

      </section>

      {bootError ? (
        <div className="card mini form-error combat-prep-status-message" role="status">
          <strong>Проблема при выполнении действия</strong>
          <p>{bootError}</p>
        </div>
      ) : null}

      {campaignPreparedCombatNotice ? (
        <div className="card mini form-success combat-prep-status-message" role="status">
          <strong>Сохранено</strong>
          <p>{campaignPreparedCombatNotice}</p>
        </div>
      ) : null}

      <CombatDangerBar {...dangerProps} />

      <div className="combat-prep-reference-grid">
        <CombatPartyPanel {...partyPanelProps} playerInitiatives={battlefieldPanelProps.preparedCombatPlayerInitiatives} onPlayerInitiativeChange={battlefieldPanelProps.onPlayerInitiativeChange} />
        <CombatBattlefieldPanel {...battlefieldPanelProps} threatContext={threatContext} />
        <CombatBestiaryPanel {...bestiaryPanelProps} threatContext={threatContext} />
      </div>
      <footer className="combat-prep-footer"><div><strong>{partyPanelProps.draftPreparedCombatPartyCount} в группе · {battlefieldPanelProps.campaignPreparedCombatDraftEnemyCount} противников</strong><span>{canStartPreparedCombatDraft ? "" : "Выберите хотя бы одного игрока и одного противника."}</span></div>
        <div className="combat-prep-reference-actions">
          <button className="ghost combat-prep-action" onClick={onClear} type="button">
            Сбросить
          </button>
          <button className="ghost combat-prep-action" disabled={saving} onClick={onSave} type="button">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
          <button
            className="primary combat-prep-start-button"
            disabled={!canStartPreparedCombatDraft || saving}
            onClick={onStart}
            type="button"
          >
            <span aria-hidden="true">⚔</span>
            <span>{saving ? "Подождите…" : "Начать бой"}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
