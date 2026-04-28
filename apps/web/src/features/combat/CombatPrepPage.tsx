import { CombatBattlefieldPanel, type CombatBattlefieldPanelProps } from "./components/CombatBattlefieldPanel";
import { CombatBestiaryPanel, type CombatBestiaryPanelProps } from "./components/CombatBestiaryPanel";
import { CombatDangerBar, type CombatDangerBarProps } from "./components/CombatDangerBar";
import { CombatPartyPanel, type CombatPartyPanelProps } from "./components/CombatPartyPanel";

export type CombatPrepPageProps = {
  campaignTitle: string;
  sceneTitle: string;
  hasHostEntity: boolean;
  saving: boolean;
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
  canStartPreparedCombatDraft,
  bootError,
  campaignPreparedCombatNotice,
  dangerProps,
  partyPanelProps,
  battlefieldPanelProps,
  bestiaryPanelProps,
  enteredPartyLevel,
  hasExplicitPartyLevels,
  partyCompositionText,
  onBack,
  onClear,
  onSave,
  onStart
}: CombatPrepPageProps) {
  return (
    <div className="combat-prep-page combat-prep-reference">
      <section className="combat-prep-reference-header">
        <button className="combat-prep-back" onClick={onBack} type="button">
          <span aria-hidden="true">←</span>
          <span>{hasHostEntity ? "К карточкам боя" : "Назад к кампании"}</span>
        </button>

        <div className="combat-prep-context-row">
          <div className="combat-prep-context-mark" aria-hidden="true">
            ✦
          </div>
          <div className="combat-prep-context-block">
            <span>Кампания</span>
            <strong>{campaignTitle}</strong>
          </div>
          <span className="combat-prep-context-separator">›</span>
          <div className="combat-prep-context-block">
            <span>Сцена</span>
            <strong>{sceneTitle}</strong>
          </div>
        </div>

        <div className="combat-prep-title-block">
          <span className="combat-prep-title-line" />
          <h1>Подготовка боя</h1>
          <span className="combat-prep-title-line" />
        </div>

        <div className="combat-prep-reference-actions">
          <button className="ghost combat-prep-action" onClick={onClear} type="button">
            Очистить
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
            <span>{saving ? "Запускаю..." : "Начать бой"}</span>
          </button>
        </div>
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
        <CombatPartyPanel {...partyPanelProps} />
        <CombatBattlefieldPanel {...battlefieldPanelProps} />
        <CombatBestiaryPanel {...bestiaryPanelProps} />
      </div>

      <footer className="combat-prep-reference-footer">
        <div>
          <span>Правила:</span>
          <strong>D&D 5e</strong>
        </div>
        <div>
          <span>Партия:</span>
          <strong>{hasExplicitPartyLevels && enteredPartyLevel ? `ур. ${enteredPartyLevel} • ${partyCompositionText}` : partyCompositionText}</strong>
        </div>
        <div>
          <span>Статус:</span>
          <strong>Черновик</strong>
        </div>
      </footer>
    </div>
  );
}
