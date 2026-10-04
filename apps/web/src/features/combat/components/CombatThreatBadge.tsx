import type { CombatThresholds } from "@shadow-edge/shared-types";
import { combatDifficultyLabel, deriveEncounterDifficulty, encounterMultiplier, parseChallengeXp } from "../combat.utils";

export type CombatThreatContext = {
  partySize: number;
  thresholds: CombatThresholds;
  ready: boolean;
  approximate: boolean;
};

export function CombatThreatBadge({ challenge, quantity = 1, context }: {
  challenge: string;
  quantity?: number;
  context?: CombatThreatContext;
}) {
  const xp = parseChallengeXp(challenge);
  if (!context?.ready || xp <= 0) {
    return <span className="combat-threat-badge unknown" title={!context?.ready ? "Выберите игроков для оценки опасности." : "В карточке не указан CR или опыт."}>Нет оценки</span>;
  }
  const adjustedXp = Math.round(xp * quantity * encounterMultiplier(quantity, context.partySize));
  const difficulty = deriveEncounterDifficulty(adjustedXp, context.thresholds);
  if (!difficulty) return null;
  return <span className={`combat-threat-badge ${difficulty}`} title={`${context.approximate ? "Примерная оценка по текущим порогам. " : ""}${quantity === 1 ? "Один противник" : `${quantity} противников этого вида`} против выбранной группы: ${adjustedXp} XP с множителем. Общая сложность встречи показана сверху.`}>{combatDifficultyLabel[difficulty]}</span>;
}
