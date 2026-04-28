import type { CombatThresholds } from "@shadow-edge/shared-types";

export type CombatDangerBarProps = {
  combatDifficultyToneClass: string;
  combatLevelDisplayText: string;
  preparedCombatLevelMetricHint: string;
  draftEncounterBaseXp: number;
  combatEnemyMetricHint: string;
  draftEncounterAdjustedXp: number;
  combatDangerThresholdText: string;
  combatDangerText: string;
  combatDangerDetailText: string;
  effectiveCombatThresholds: CombatThresholds;
  draftEncounterDifficulty: "easy" | "medium" | "hard" | "deadly" | "";
  combatMasterRecommendation: string;
  resolvedCombatPartyLevelsText: string;
  onCombatPartyLevelsChange: (value: string) => void;
  onStepCombatPartyLevel: (delta: number) => void;
};

export function CombatDangerBar({
  combatDifficultyToneClass,
  combatLevelDisplayText,
  preparedCombatLevelMetricHint,
  draftEncounterBaseXp,
  combatEnemyMetricHint,
  draftEncounterAdjustedXp,
  combatDangerThresholdText,
  combatDangerText,
  combatDangerDetailText,
  effectiveCombatThresholds,
  draftEncounterDifficulty,
  combatMasterRecommendation,
  resolvedCombatPartyLevelsText,
  onCombatPartyLevelsChange,
  onStepCombatPartyLevel
}: CombatDangerBarProps) {
  return (
    <section className={`combat-prep-danger-board ${combatDifficultyToneClass}`}>
      <article className="combat-prep-danger-metric combat-prep-level-metric">
        <span className="combat-prep-metric-icon" aria-hidden="true">
          ☄
        </span>
        <div>
          <small>Уровень группы</small>
          <strong className="combat-prep-level-value">{combatLevelDisplayText}</strong>
          <div className="combat-prep-level-control">
            <button
              className="combat-prep-level-stepper"
              onClick={() => onStepCombatPartyLevel(-1)}
              type="button"
              aria-label="Уменьшить уровень группы"
            >
              −
            </button>
            <input
              className="combat-prep-level-input"
              inputMode="numeric"
              onChange={(event) => onCombatPartyLevelsChange(event.target.value)}
              placeholder="1-20"
              value={resolvedCombatPartyLevelsText}
            />
            <button
              className="combat-prep-level-stepper"
              onClick={() => onStepCombatPartyLevel(1)}
              type="button"
              aria-label="Увеличить уровень группы"
            >
              +
            </button>
          </div>
          <span>{preparedCombatLevelMetricHint}</span>
        </div>
      </article>

      <article className="combat-prep-danger-metric">
        <div>
          <small>Общий XP противников</small>
          <strong>{`${draftEncounterBaseXp} XP`}</strong>
          <span>{combatEnemyMetricHint}</span>
        </div>
      </article>

      <article className="combat-prep-danger-metric adjusted">
        <div>
          <small>Расчётный XP</small>
          <strong>{`${draftEncounterAdjustedXp} XP`}</strong>
          <span>{combatDangerThresholdText === "—" ? "Порог сложности появится после расчёта" : `Порог: ${combatDangerThresholdText}`}</span>
        </div>
      </article>

      <article className={`combat-prep-danger-core ${combatDifficultyToneClass}`}>
        <div className={`combat-prep-skull-orb ${combatDifficultyToneClass}`} aria-hidden="true">
          ☠
        </div>
        <div>
          <small>Текущая опасность</small>
          <strong>{combatDangerText}</strong>
          <span>{combatDangerDetailText}</span>
        </div>
      </article>

      <div className="combat-prep-threshold-grid-ref">
        <article className={draftEncounterDifficulty === "easy" ? "active" : ""}>
          <small>Легко</small>
          <strong>{effectiveCombatThresholds.easy}</strong>
        </article>
        <article className={draftEncounterDifficulty === "medium" ? "active" : ""}>
          <small>Средне</small>
          <strong>{effectiveCombatThresholds.medium}</strong>
        </article>
        <article className={draftEncounterDifficulty === "hard" ? "active" : ""}>
          <small>Сложно</small>
          <strong>{effectiveCombatThresholds.hard}</strong>
        </article>
        <article className={draftEncounterDifficulty === "deadly" ? "active deadly" : ""}>
          <small>Смертельно</small>
          <strong>{effectiveCombatThresholds.deadly}</strong>
        </article>
      </div>

      <article className="combat-prep-master-tip">
        <small>Рекомендация мастеру</small>
        <p>{combatMasterRecommendation}</p>
      </article>
    </section>
  );
}
