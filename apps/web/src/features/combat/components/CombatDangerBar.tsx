import type { CombatThresholds } from "@shadow-edge/shared-types";

export type CombatDangerBarProps = {
  partyLevelText: string;
  onPartyLevelChange: (value: string) => void;
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
};

export function CombatDangerBar({
  partyLevelText,
  onPartyLevelChange,
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
  combatMasterRecommendation
}: CombatDangerBarProps) {
  return <details className={`combat-prep-danger-board combat-danger-compact ${combatDifficultyToneClass}`}>
    <summary><span className="combat-prep-difficulty-label">Сложность встречи</span><strong>{combatDangerText}</strong><span className="muted">Уровень группы: {combatLevelDisplayText}</span><span className="combat-prep-difficulty-more">Расчёт и настройки <span aria-hidden="true">⌄</span></span></summary>
    <label className="field"><span>Общий уровень группы</span><input className="input" inputMode="numeric" placeholder="Например: 3" value={partyLevelText} onChange={event => onPartyLevelChange(event.target.value)} /><small>Для расчёта сложности, если уровни игроков ещё не заполнены.</small></label>
    <p>{combatDangerDetailText}</p><p>{combatMasterRecommendation}</p>
    <p className="muted">Опыт противников: {draftEncounterBaseXp} XP · для оценки сложности: {draftEncounterAdjustedXp} XP</p>
  </details>;
}
