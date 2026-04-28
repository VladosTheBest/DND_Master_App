import { useMemo } from "react";
import type { CombatThresholds } from "@shadow-edge/shared-types";
import type { EncounterDifficultyId } from "../combat.types";
import {
  computeEncounterThresholds,
  deriveEncounterDifficulty,
  derivePartyLevels,
  encounterMultiplier,
  formatAllyCountLabel,
  formatEnemyCountLabel,
  formatPartyCountLabel,
  formatPartyLevelText,
  formatPartyLevelsText,
  parseStoredPartyLevel,
  targetThresholdValue
} from "../combat.utils";

type UseCombatDifficultyParams = {
  combatSetupOpen: boolean;
  hasActiveCombatEntries: boolean;
  draftPreparedCombatPartyCount: number;
  campaignPreparedCombatPartyCount: number;
  combatPartySize: number;
  combatPartyLevelsText: string;
  draftPreparedCombatPlayerLevels: number[];
  campaignPreparedCombatPartyLevel?: number | null;
  draftPreparedCombatPlayersCount: number;
  draftPreparedCombatAllyCount: number;
  draftEncounterMonsterCount: number;
  draftEncounterBaseXp: number;
  combatThresholds: CombatThresholds;
};

type CombatThresholdRow = {
  id: EncounterDifficultyId;
  label: string;
  threshold: number;
};

export type UseCombatDifficultyResult = {
  combatThresholdPartySize: number;
  fallbackCombatPartyLevelsText: string;
  resolvedCombatPartyLevelsText: string;
  persistedCombatPartyLevel?: number;
  enteredPartyLevel?: number;
  hasMultipleEnteredPartyLevels: boolean;
  effectivePartyLevels: number[];
  hasExplicitPartyLevels: boolean;
  effectivePartySize: number;
  effectiveCombatThresholds: CombatThresholds;
  combatLevelDisplayText: string;
  combatThresholdSummary: string;
  combatPartySummary: string;
  draftEncounterMultiplier: number;
  draftEncounterAdjustedXp: number;
  draftEncounterDifficulty: EncounterDifficultyId | "";
  draftEncounterDifficultyThreshold: number;
  partyCompositionText: string;
  draftEncounterProgressMax: number;
  draftEncounterProgressPercent: number;
  combatDifficultyThresholdRows: CombatThresholdRow[];
};

export const useCombatDifficulty = ({
  combatSetupOpen,
  hasActiveCombatEntries,
  draftPreparedCombatPartyCount,
  campaignPreparedCombatPartyCount,
  combatPartySize,
  combatPartyLevelsText,
  draftPreparedCombatPlayerLevels,
  campaignPreparedCombatPartyLevel,
  draftPreparedCombatPlayersCount,
  draftPreparedCombatAllyCount,
  draftEncounterMonsterCount,
  draftEncounterBaseXp,
  combatThresholds
}: UseCombatDifficultyParams): UseCombatDifficultyResult => {
  const lockedPartyLevelsToPlayers = combatSetupOpen && !hasActiveCombatEntries && draftPreparedCombatPlayerLevels.length > 0;

  const combatThresholdPartySize =
    combatSetupOpen && !hasActiveCombatEntries
      ? draftPreparedCombatPartyCount > 0
        ? draftPreparedCombatPartyCount
        : campaignPreparedCombatPartyCount > 0
          ? campaignPreparedCombatPartyCount
          : combatPartySize
      : campaignPreparedCombatPartyCount > 0
        ? campaignPreparedCombatPartyCount
        : combatPartySize;

  const fallbackCombatPartyLevelsText = useMemo(() => {
    if (draftPreparedCombatPlayerLevels.length) {
      return formatPartyLevelsText(draftPreparedCombatPlayerLevels);
    }
    return formatPartyLevelText(campaignPreparedCombatPartyLevel);
  }, [campaignPreparedCombatPartyLevel, draftPreparedCombatPlayerLevels]);

  const resolvedCombatPartyLevelsText = lockedPartyLevelsToPlayers
    ? fallbackCombatPartyLevelsText
    : combatPartyLevelsText.trim() || fallbackCombatPartyLevelsText;

  const persistedCombatPartyLevel = useMemo(() => {
    if (lockedPartyLevelsToPlayers) {
      return undefined;
    }
    if (combatPartyLevelsText.trim()) {
      return parseStoredPartyLevel(combatPartyLevelsText);
    }
    if (draftPreparedCombatPlayerLevels.length) {
      return undefined;
    }
    return parseStoredPartyLevel(resolvedCombatPartyLevelsText);
  }, [combatPartyLevelsText, draftPreparedCombatPlayerLevels.length, lockedPartyLevelsToPlayers, resolvedCombatPartyLevelsText]);

  const effectivePartyLevels = useMemo(
    () => derivePartyLevels(resolvedCombatPartyLevelsText, combatThresholdPartySize),
    [combatThresholdPartySize, resolvedCombatPartyLevelsText]
  );

  const enteredPartyLevel = useMemo(() => {
    if (!effectivePartyLevels.length) {
      return undefined;
    }
    return effectivePartyLevels.every((level) => level === effectivePartyLevels[0]) ? effectivePartyLevels[0] : undefined;
  }, [effectivePartyLevels]);

  const hasMultipleEnteredPartyLevels = useMemo(
    () => effectivePartyLevels.length > 1 && effectivePartyLevels.some((level) => level !== effectivePartyLevels[0]),
    [effectivePartyLevels]
  );

  const hasExplicitPartyLevels = effectivePartyLevels.length > 0;
  const effectivePartySize = hasExplicitPartyLevels ? effectivePartyLevels.length : combatThresholdPartySize;

  const effectiveCombatThresholds = useMemo(
    () => (hasExplicitPartyLevels ? computeEncounterThresholds(effectivePartyLevels, combatThresholds) : combatThresholds),
    [combatThresholds, effectivePartyLevels, hasExplicitPartyLevels]
  );

  const combatLevelDisplayText = useMemo(() => {
    if (!effectivePartyLevels.length) {
      return "—";
    }
    return effectivePartyLevels.every((level) => level === effectivePartyLevels[0])
      ? String(effectivePartyLevels[0])
      : effectivePartyLevels.join(" / ");
  }, [effectivePartyLevels]);

  const combatThresholdSummary = `${effectiveCombatThresholds.easy} / ${effectiveCombatThresholds.medium} / ${effectiveCombatThresholds.hard} / ${effectiveCombatThresholds.deadly}`;

  const combatPartySummary = !hasExplicitPartyLevels
    ? `Заполни уровни в карточках игроков, чтобы расчёт сложности стал точным. Пока используются пороги ${combatThresholdSummary} для ${effectivePartySize} ${formatPartyCountLabel(effectivePartySize)}.`
    : lockedPartyLevelsToPlayers
      ? hasMultipleEnteredPartyLevels
        ? `Уровни взяты из карточек игроков: ${effectivePartyLevels.join(", ")}.`
        : `Уровень группы взят из карточек игроков: ${enteredPartyLevel} для ${effectivePartySize} ${formatPartyCountLabel(effectivePartySize)}.`
      : hasMultipleEnteredPartyLevels
        ? `Сейчас считается партия из ${effectivePartySize} ${formatPartyCountLabel(effectivePartySize)}: ${effectivePartyLevels.join(", ")} уровни.`
        : `Уровень ${enteredPartyLevel} применяется ко всем ${effectivePartySize} ${formatPartyCountLabel(effectivePartySize)} в сцене.`;

  const draftEncounterMultiplier =
    draftEncounterMonsterCount > 0 ? encounterMultiplier(draftEncounterMonsterCount, Math.max(effectivePartySize, 1)) : 1;
  const draftEncounterAdjustedXp =
    draftEncounterBaseXp > 0 ? Math.round(draftEncounterBaseXp * draftEncounterMultiplier) : 0;
  const draftEncounterDifficulty = deriveEncounterDifficulty(draftEncounterAdjustedXp, effectiveCombatThresholds);
  const draftEncounterDifficultyThreshold = draftEncounterDifficulty
    ? targetThresholdValue(effectiveCombatThresholds, draftEncounterDifficulty)
    : effectiveCombatThresholds.medium;

  const partyCompositionText =
    draftPreparedCombatAllyCount > 0
      ? `${draftPreparedCombatPlayersCount} ${formatPartyCountLabel(draftPreparedCombatPlayersCount)} + ${draftPreparedCombatAllyCount} ${formatAllyCountLabel(
          draftPreparedCombatAllyCount
        )}`
      : `${draftPreparedCombatPlayersCount} ${formatPartyCountLabel(draftPreparedCombatPlayersCount)}`;

  const draftEncounterProgressMax = Math.max(effectiveCombatThresholds.deadly, draftEncounterAdjustedXp, 1);
  const draftEncounterProgressPercent =
    draftEncounterAdjustedXp > 0 ? Math.min(Math.max((draftEncounterAdjustedXp / draftEncounterProgressMax) * 100, 0), 100) : 0;

  const combatDifficultyThresholdRows: CombatThresholdRow[] = [
    { id: "easy", label: "Лёгкий", threshold: effectiveCombatThresholds.easy },
    { id: "medium", label: "Средний", threshold: effectiveCombatThresholds.medium },
    { id: "hard", label: "Сложный", threshold: effectiveCombatThresholds.hard },
    { id: "deadly", label: "Очень сложный", threshold: effectiveCombatThresholds.deadly }
  ];

  return {
    combatThresholdPartySize,
    fallbackCombatPartyLevelsText,
    resolvedCombatPartyLevelsText,
    persistedCombatPartyLevel,
    enteredPartyLevel,
    hasMultipleEnteredPartyLevels,
    effectivePartyLevels,
    hasExplicitPartyLevels,
    effectivePartySize,
    effectiveCombatThresholds,
    combatLevelDisplayText,
    combatThresholdSummary,
    combatPartySummary,
    draftEncounterMultiplier,
    draftEncounterAdjustedXp,
    draftEncounterDifficulty,
    draftEncounterDifficultyThreshold,
    partyCompositionText,
    draftEncounterProgressMax,
    draftEncounterProgressPercent,
    combatDifficultyThresholdRows
  };
};
