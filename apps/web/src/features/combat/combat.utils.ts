import type {
  CampaignPreparedCombat,
  CombatDifficulty,
  CombatThresholds,
  PreparedCombatItem,
  PreparedCombatPlan
} from "@shadow-edge/shared-types";
import { clamp } from "../../app-shared";
import type {
  CombatProfileEntity,
  CombatSearchItem,
  EncounterDifficultyId,
  PreparedCombatHostEntity
} from "./combat.types";

export const combatDifficultyLabel: Record<CombatDifficulty, string> = {
  easy: "Легко",
  medium: "Средне",
  hard: "Сложно",
  deadly: "Смертоносно",
  custom: "Своя сложность"
};

export const combatDifficultyShortLabel: Record<EncounterDifficultyId, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly"
};

const challengeExperienceTable: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000
};

const encounterTiers = [
  { min: 1, max: 1, multiplier: 1 },
  { min: 2, max: 2, multiplier: 1.5 },
  { min: 3, max: 6, multiplier: 2 },
  { min: 7, max: 10, multiplier: 2.5 },
  { min: 11, max: 14, multiplier: 3 },
  { min: 15, max: Number.POSITIVE_INFINITY, multiplier: 4 }
] as const;

export const challengeFilterOptions = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30"
] as const;

export const combatSetupTypeLabelMap: Record<string, string> = {
  all: "Все",
  monster: "Монстры",
  humanoid: "Гуманоиды",
  undead: "Нежить",
  beast: "Звери",
  elemental: "Стихии",
  fiend: "Изверги",
  dragon: "Драконы",
  monstrosity: "Чудовища"
};

export const combatSelectionEntityKey = (id: string) => `entity:${id}`;
export const combatSelectionBestiaryKey = (id: string) => `bestiary:${id}`;

export const parseChallengeToken = (challenge: string) => {
  let token = challenge.trim().toLowerCase();
  if (!token) {
    return "";
  }

  for (const prefix of ["cr", "challenge", "challenge rating", "опасность"]) {
    if (token.startsWith(prefix)) {
      token = token.slice(prefix.length).trim();
      break;
    }
  }

  const beforeParenthesis = token.split("(")[0]?.trim() ?? token;
  const firstChunk = beforeParenthesis.split(/\s+/u)[0]?.trim() ?? beforeParenthesis;
  return firstChunk.replace(/^[:.-]+|[:.-]+$/g, "").trim();
};

export const extractChallengeToken = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^([0-9]+(?:\/[0-9]+)?)/);
  return match?.[1] ?? trimmed;
};

export const parseChallengeXp = (challenge: string) => {
  const token = parseChallengeToken(challenge);
  if (token && challengeExperienceTable[token] !== undefined) {
    return challengeExperienceTable[token];
  }

  const explicitXp = challenge.match(/([\d\s]+)\s*XP/i);
  if (explicitXp) {
    const digits = explicitXp[1].replace(/[^\d]/g, "");
    if (digits) {
      return Number.parseInt(digits, 10);
    }
  }

  const fallbackToken = challenge
    .trim()
    .split(/[ (\u00a0]/u)[0]
    ?.replace(/^cr/i, "")
    .trim();

  return fallbackToken ? challengeExperienceTable[fallbackToken] ?? 0 : 0;
};

export const normalizeCombatSetupTypeKey = (value: string) => value.trim().toLowerCase();

export const formatCombatSetupTypeLabel = (value: string) => {
  const normalized = normalizeCombatSetupTypeKey(value);
  if (!normalized) {
    return combatSetupTypeLabelMap.monster;
  }
  return combatSetupTypeLabelMap[normalized] ?? value.charAt(0).toUpperCase() + value.slice(1);
};

export const resolveCombatSearchItemType = (item: CombatSearchItem) => {
  if (item.bestiary?.creatureType) {
    return normalizeCombatSetupTypeKey(item.bestiary.creatureType);
  }
  if (item.entity?.statBlock?.creatureType) {
    return normalizeCombatSetupTypeKey(item.entity.statBlock.creatureType);
  }
  return item.kind === "npc" ? "humanoid" : "monster";
};

export const resolveCombatSearchItemTypeLabel = (item: CombatSearchItem) =>
  item.bestiary?.creatureTypeLabel ||
  formatCombatSetupTypeLabel(item.entity?.statBlock?.creatureType || resolveCombatSearchItemType(item));

export const encounterMultiplier = (monsterCount: number, partySize: number) => {
  if (monsterCount <= 0) {
    return 1;
  }

  let index = encounterTiers.length - 1;
  for (const [tierIndex, tier] of encounterTiers.entries()) {
    if (monsterCount >= tier.min && monsterCount <= tier.max) {
      index = tierIndex;
      break;
    }
  }

  if (partySize < 3) {
    if (index === encounterTiers.length - 1) {
      return 5;
    }
    index += 1;
  } else if (partySize >= 6) {
    if (index === 0) {
      return 0.5;
    }
    index -= 1;
  }

  return encounterTiers[index]?.multiplier ?? 1;
};

export const deriveEncounterDifficulty = (adjustedXp: number, thresholds: CombatThresholds): EncounterDifficultyId | "" => {
  if (adjustedXp <= 0) {
    return "";
  }
  if (thresholds.deadly > 0 && adjustedXp >= thresholds.deadly) {
    return "deadly";
  }
  if (thresholds.hard > 0 && adjustedXp >= thresholds.hard) {
    return "hard";
  }
  if (thresholds.medium > 0 && adjustedXp >= thresholds.medium) {
    return "medium";
  }
  return "easy";
};

export const targetThresholdValue = (thresholds: CombatThresholds, difficulty: EncounterDifficultyId) => {
  switch (difficulty) {
    case "easy":
      return thresholds.easy;
    case "medium":
      return thresholds.medium;
    case "hard":
      return thresholds.hard;
    case "deadly":
      return thresholds.deadly;
    default:
      return thresholds.medium;
  }
};

export const formatPartyCountLabel = (count: number) => (count === 1 ? "игрок" : count < 5 ? "игрока" : "игроков");
export const formatEnemyCountLabel = (count: number) =>
  count === 1 ? "противник" : count < 5 ? "противника" : "противников";
export const formatAllyCountLabel = (count: number) => (count === 1 ? "союзник" : count < 5 ? "союзника" : "союзников");
export const formatParticipantCountLabel = (count: number) =>
  count === 1 ? "участник" : count < 5 ? "участника" : "участников";

export const countPreparedCombatItems = (items: PreparedCombatItem[] = []) =>
  items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);

const sanitizePreparedCombatText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizePreparedCombatItems = (items: PreparedCombatItem[] = []) =>
  items
    .map((item) => ({
      entityId: item.entityId.trim(),
      quantity: Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1
    }))
    .filter((item) => item.entityId);

export const createEmptyCampaignPreparedCombat = (): CampaignPreparedCombat => ({
  title: "",
  partyLevel: undefined,
  playerIds: [],
  allies: [],
  items: []
});

export const clonePreparedCombatPlan = (plan?: PreparedCombatPlan): PreparedCombatPlan | undefined =>
  plan
    ? {
        title: plan.title,
        partyLevel: sanitizePartyLevel(plan.partyLevel),
        playerIds: [...(plan.playerIds ?? [])],
        allies: (plan.allies ?? []).map((item) => ({ ...item })),
        items: (plan.items ?? []).map((item) => ({ ...item }))
      }
    : undefined;

export const cloneCampaignPreparedCombat = (plan?: CampaignPreparedCombat | null): CampaignPreparedCombat =>
  plan
    ? {
        title: plan.title,
        partyLevel: sanitizePartyLevel(plan.partyLevel),
        playerIds: [...(plan.playerIds ?? [])],
        allies: (plan.allies ?? []).map((item) => ({ ...item })),
        items: (plan.items ?? []).map((item) => ({ ...item }))
      }
    : createEmptyCampaignPreparedCombat();

export const defaultPreparedCombatTitle = (index: number) => `Бой ${index + 1}`;

export const isPreparedCombatHostEntity = (entity: { kind: string }): entity is PreparedCombatHostEntity =>
  entity.kind === "location" || entity.kind === "quest";

export const normalizePreparedCombatPlansForClient = (
  plans?: PreparedCombatPlan[],
  legacyPlan?: PreparedCombatPlan
): PreparedCombatPlan[] => {
  const normalized = (plans ?? [])
    .map((plan) => ({
      title: plan.title?.trim() || "",
      partyLevel: sanitizePartyLevel(plan.partyLevel),
      playerIds: Array.from(new Set((plan.playerIds ?? []).map((playerId) => playerId.trim()).filter(Boolean))),
      allies: normalizePreparedCombatItems(plan.allies ?? []),
      items: normalizePreparedCombatItems(plan.items ?? [])
    }))
    .filter((plan) => plan.title || plan.partyLevel || plan.playerIds.length || plan.allies.length || plan.items.length)
    .map((plan, index) => ({
      title: plan.title || defaultPreparedCombatTitle(index),
      partyLevel: plan.partyLevel,
      playerIds: plan.playerIds,
      allies: plan.allies,
      items: plan.items
    }));

  if (!normalized.length && legacyPlan) {
    const legacy = clonePreparedCombatPlan(legacyPlan);
    if (legacy) {
      const title = legacy.title?.trim() || "";
      const partyLevel = sanitizePartyLevel(legacy.partyLevel);
      const playerIds = Array.from(new Set((legacy.playerIds ?? []).map((playerId) => playerId.trim()).filter(Boolean)));
      const allies = normalizePreparedCombatItems(legacy.allies ?? []);
      const items = normalizePreparedCombatItems(legacy.items ?? []);

      if (title || partyLevel || playerIds.length || allies.length || items.length) {
        return [
          {
            title: title || defaultPreparedCombatTitle(0),
            partyLevel,
            playerIds,
            allies,
            items
          }
        ];
      }
    }
  }

  return normalized;
};

export const resolveEntityPreparedCombats = (entity?: PreparedCombatHostEntity | null) =>
  normalizePreparedCombatPlansForClient(entity?.preparedCombats, entity?.preparedCombat);

export const sanitizePreparedCombatPlan = (plan?: PreparedCombatPlan): PreparedCombatPlan | undefined => {
  if (!plan) {
    return undefined;
  }

  const title = sanitizePreparedCombatText(plan.title);
  const partyLevel = sanitizePartyLevel(plan.partyLevel);
  const playerIds = Array.from(
    new Set(
      (plan.playerIds ?? [])
        .map((playerId) => playerId.trim())
        .filter(Boolean)
    )
  );
  const allies = normalizePreparedCombatItems(plan.allies ?? []);
  const items = normalizePreparedCombatItems(plan.items);

  if (!title && !partyLevel && !playerIds.length && !allies.length && !items.length) {
    return undefined;
  }

  return {
    title,
    partyLevel,
    playerIds,
    allies,
    items
  };
};

export const sanitizePreparedCombatPlans = (
  plans: PreparedCombatPlan[] = [],
  legacyPlan?: PreparedCombatPlan
): PreparedCombatPlan[] => {
  const sanitized = plans
    .map((plan) => sanitizePreparedCombatPlan(plan))
    .filter((plan): plan is PreparedCombatPlan => Boolean(plan))
    .map((plan, index) => ({
      ...plan,
      title: plan.title || defaultPreparedCombatTitle(index)
    }));

  if (!sanitized.length) {
    const legacy = sanitizePreparedCombatPlan(legacyPlan);
    return legacy
      ? [
          {
            ...legacy,
            title: legacy.title || defaultPreparedCombatTitle(0)
          }
        ]
      : [];
  }

  return sanitized;
};

export const sanitizeCampaignPreparedCombat = (plan?: CampaignPreparedCombat | null): CampaignPreparedCombat | null => {
  if (!plan) {
    return null;
  }

  const title = sanitizePreparedCombatText(plan.title);
  const partyLevel = sanitizePartyLevel(plan.partyLevel);
  const playerIds = Array.from(
    new Set(
      (plan.playerIds ?? [])
        .map((playerId) => playerId.trim())
        .filter(Boolean)
    )
  );
  const allies = normalizePreparedCombatItems(plan.allies ?? []);
  const items = normalizePreparedCombatItems(plan.items ?? []);

  if (!title && !partyLevel && !playerIds.length && !allies.length && !items.length) {
    return null;
  }

  return {
    title,
    partyLevel,
    playerIds,
    allies,
    items
  };
};

export const createDefaultCombatThresholds = (): CombatThresholds => ({
  easy: 100,
  medium: 200,
  hard: 300,
  deadly: 400
});

export const getEntityChallenge = (entity: Pick<CombatProfileEntity, "statBlock">) =>
  extractChallengeToken(entity.statBlock?.challenge);

export const partyThresholdTable: Record<number, CombatThresholds> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 }
};

export const clampPartyLevel = (value: number) => clamp(value, 1, 20);

export const sanitizePartyLevel = (value?: number | null) => {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return clampPartyLevel(Math.floor(value as number));
};

export const formatPartyLevelText = (value?: number | null) => {
  const normalized = sanitizePartyLevel(value);
  return normalized ? String(normalized) : "";
};

export const formatPartyLevelsText = (levels: number[]) => levels.map((level) => String(clampPartyLevel(level))).join(" ");

export const parseStoredPartyLevel = (raw: string) => {
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? clampPartyLevel(parsed) : undefined;
};

export const derivePartyLevels = (raw: string, partySize: number) => {
  const parsed = raw
    .split(/[\s,;]+/u)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value))
    .map((value) => clampPartyLevel(value));

  if (!parsed.length) {
    return [];
  }

  if (parsed.length === 1) {
    return Array.from({ length: Math.max(1, partySize) }, () => parsed[0]);
  }

  return parsed;
};

export const computeEncounterThresholds = (levels: number[], fallback: CombatThresholds): CombatThresholds => {
  if (!levels.length) {
    return fallback;
  }

  return levels.reduce<CombatThresholds>(
    (totals, level) => {
      const perCharacter = partyThresholdTable[clampPartyLevel(level)] ?? fallback;
      return {
        easy: totals.easy + perCharacter.easy,
        medium: totals.medium + perCharacter.medium,
        hard: totals.hard + perCharacter.hard,
        deadly: totals.deadly + perCharacter.deadly
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 }
  );
};
