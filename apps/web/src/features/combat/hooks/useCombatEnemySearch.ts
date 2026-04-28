import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { BestiaryBrowseResult, BestiaryMonsterDetail } from "@shadow-edge/shared-types";
import { api } from "../../../app/api";
import type {
  CombatEnemySearchControllerActions,
  CombatEnemySearchControllerState,
  UseCombatEnemySearchArgs
} from "../combatEnemy.types";
import {
  isCombatSelectionBestiaryKey,
  mapBestiaryMonsterToSearchItem,
  mapCombatEntityToSearchItem,
  matchesCombatEnemySearch,
  normalizeCombatInitiative,
  normalizeCombatQuantity,
  unwrapCombatSelectionKey
} from "../combatEnemy.utils";
import { combatSelectionEntityKey } from "../combat.utils";
import { useCombatPreparation } from "./useCombatPreparation";

export function useCombatEnemySearch({
  combatRoster,
  combatSetupOpen,
  hasActiveCombatEntries,
  preparedCombatModalOpen,
  setBootError
}: UseCombatEnemySearchArgs): CombatEnemySearchControllerState & CombatEnemySearchControllerActions {
  const [combatSelectionId, setCombatSelectionId] = useState("");
  const [combatSelectionQuantity, setCombatSelectionQuantityState] = useState(1);
  const [combatSelectionInitiative, setCombatSelectionInitiativeState] = useState(0);
  const [combatSearchQuery, setCombatSearchQueryState] = useState("");
  const [combatSearchChallenge, setCombatSearchChallengeState] = useState("");
  const [combatEnemyTypeFilter, setCombatEnemyTypeFilterState] = useState("all");
  const [combatBestiary, setCombatBestiary] = useState<BestiaryBrowseResult | null>(null);
  const [combatBestiaryLoading, setCombatBestiaryLoading] = useState(false);
  const [combatSelectedBestiaryMonster, setCombatSelectedBestiaryMonster] = useState<BestiaryMonsterDetail | null>(null);
  const [preparedCombatSearchQuery, setPreparedCombatSearchQueryState] = useState("");
  const [preparedCombatChallenge, setPreparedCombatChallengeState] = useState("");
  const [preparedCombatSelectionId, setPreparedCombatSelectionId] = useState("");
  const [preparedCombatQuantity, setPreparedCombatQuantityState] = useState(1);
  const [preparedCombatBestiary, setPreparedCombatBestiary] = useState<BestiaryBrowseResult | null>(null);
  const [preparedCombatBestiaryLoading, setPreparedCombatBestiaryLoading] = useState(false);

  const deferredCombatSearchQuery = useDeferredValue(combatSearchQuery);
  const deferredPreparedCombatSearchQuery = useDeferredValue(preparedCombatSearchQuery);

  useEffect(() => {
    let cancelled = false;

    if (!combatSetupOpen) {
      setCombatBestiary(null);
      setCombatBestiaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!deferredCombatSearchQuery.trim() && !combatSearchChallenge) {
      setCombatBestiary(null);
      setCombatBestiaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadCombatBestiary = async () => {
      try {
        setCombatBestiaryLoading(true);
        const result = await api.browseBestiary({
          q: deferredCombatSearchQuery.trim(),
          challenge: combatSearchChallenge
        });
        if (cancelled) {
          return;
        }
        setCombatBestiary(result);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось загрузить dnd.su для боя.");
        setCombatBestiary(null);
      } finally {
        if (!cancelled) {
          setCombatBestiaryLoading(false);
        }
      }
    };

    void loadCombatBestiary();
    return () => {
      cancelled = true;
    };
  }, [combatSearchChallenge, combatSetupOpen, deferredCombatSearchQuery, setBootError]);

  useEffect(() => {
    let cancelled = false;

    if (!combatSetupOpen || !isCombatSelectionBestiaryKey(combatSelectionId)) {
      setCombatSelectedBestiaryMonster(null);
      return () => {
        cancelled = true;
      };
    }

    const loadSelectedBestiaryMonster = async () => {
      try {
        const result = await api.getBestiaryMonster(unwrapCombatSelectionKey(combatSelectionId));
        if (cancelled) {
          return;
        }
        setCombatSelectedBestiaryMonster(result);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось открыть монстра для боя.");
        setCombatSelectedBestiaryMonster(null);
      }
    };

    void loadSelectedBestiaryMonster();
    return () => {
      cancelled = true;
    };
  }, [combatSelectionId, combatSetupOpen, setBootError]);

  useEffect(() => {
    let cancelled = false;

    if (!preparedCombatModalOpen) {
      setPreparedCombatBestiary(null);
      setPreparedCombatBestiaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadPreparedCombatBestiary = async () => {
      try {
        setPreparedCombatBestiaryLoading(true);
        const result = await api.browseBestiary({
          q: deferredPreparedCombatSearchQuery.trim(),
          challenge: preparedCombatChallenge
        });
        if (cancelled) {
          return;
        }
        setPreparedCombatBestiary(result);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось загрузить бестиарий для заготовки боя.");
        setPreparedCombatBestiary(null);
      } finally {
        if (!cancelled) {
          setPreparedCombatBestiaryLoading(false);
        }
      }
    };

    void loadPreparedCombatBestiary();
    return () => {
      cancelled = true;
    };
  }, [deferredPreparedCombatSearchQuery, preparedCombatChallenge, preparedCombatModalOpen, setBootError]);

  const preparedCombatEntityItems = useMemo(
    () => combatRoster.filter((entity) => matchesCombatEnemySearch(entity, deferredPreparedCombatSearchQuery, preparedCombatChallenge)),
    [combatRoster, deferredPreparedCombatSearchQuery, preparedCombatChallenge]
  );

  const preparedCombatBestiaryItems = useMemo(
    () => (preparedCombatBestiary?.items ?? []).map(mapBestiaryMonsterToSearchItem),
    [preparedCombatBestiary]
  );

  const preparedCombatSearchItems = useMemo(
    () => [...preparedCombatEntityItems.map(mapCombatEntityToSearchItem), ...preparedCombatBestiaryItems],
    [preparedCombatBestiaryItems, preparedCombatEntityItems]
  );

  const selectedPreparedCombatSearchItem = useMemo(
    () => preparedCombatSearchItems.find((item) => item.key === preparedCombatSelectionId) ?? preparedCombatSearchItems[0] ?? null,
    [preparedCombatSearchItems, preparedCombatSelectionId]
  );

  const combatEntitySearchItems = useMemo(
    () =>
      combatRoster
        .filter((entity) => matchesCombatEnemySearch(entity, deferredCombatSearchQuery, combatSearchChallenge))
        .map(mapCombatEntityToSearchItem),
    [combatRoster, combatSearchChallenge, deferredCombatSearchQuery]
  );

  const combatBestiarySearchItems = useMemo(
    () => (combatBestiary?.items ?? []).map(mapBestiaryMonsterToSearchItem),
    [combatBestiary]
  );

  const combatSearchItems = useMemo(
    () => [...combatEntitySearchItems.slice(0, 18), ...combatBestiarySearchItems.slice(0, 24)],
    [combatBestiarySearchItems, combatEntitySearchItems]
  );

  const {
    combatEnemyTypeOptions,
    filteredCombatCatalogItems,
    selectedCombatSearchItem
  } = useCombatPreparation({
    combatSearchItems,
    combatEnemyTypeFilter,
    combatSelectionId
  });

  const selectedCombatSearchProfile =
    selectedCombatSearchItem?.source === "entity"
      ? selectedCombatSearchItem.entity ?? null
      : combatSelectedBestiaryMonster?.monster ?? null;

  useEffect(() => {
    if (!preparedCombatModalOpen) {
      return;
    }

    if (!preparedCombatSearchItems.some((item) => item.key === preparedCombatSelectionId)) {
      setPreparedCombatSelectionId(preparedCombatSearchItems[0]?.key ?? "");
    }
  }, [preparedCombatModalOpen, preparedCombatSearchItems, preparedCombatSelectionId]);

  useEffect(() => {
    if (!combatSetupOpen) {
      return;
    }

    if (!combatSearchItems.some((item) => item.key === combatSelectionId)) {
      setCombatSelectionId(combatSearchItems[0]?.key ?? "");
    }
  }, [combatSearchItems, combatSelectionId, combatSetupOpen]);

  useEffect(() => {
    if (!combatSetupOpen || hasActiveCombatEntries) {
      return;
    }

    if (!filteredCombatCatalogItems.some((item) => item.key === combatSelectionId)) {
      setCombatSelectionId(filteredCombatCatalogItems[0]?.key ?? "");
    }
  }, [combatSelectionId, combatSetupOpen, filteredCombatCatalogItems, hasActiveCombatEntries]);

  const setCombatSearchQuery = (value: string) => {
    setCombatSearchQueryState(value);
  };

  const setCombatSearchChallenge = (value: string) => {
    setCombatSearchChallengeState(value);
  };

  const setCombatEnemyTypeFilter = (value: string) => {
    setCombatEnemyTypeFilterState(value);
  };

  const setCombatSelectionQuantity = (value: number) => {
    setCombatSelectionQuantityState(normalizeCombatQuantity(value));
  };

  const setCombatSelectionInitiative = (value: number) => {
    setCombatSelectionInitiativeState(normalizeCombatInitiative(value));
  };

  const setPreparedCombatSearchQuery = (value: string) => {
    setPreparedCombatSearchQueryState(value);
  };

  const setPreparedCombatChallenge = (value: string) => {
    setPreparedCombatChallengeState(value);
  };

  const setPreparedCombatQuantity = (value: number) => {
    setPreparedCombatQuantityState(normalizeCombatQuantity(value));
  };

  const resetCombatEnemySearch = () => {
    setCombatSearchQueryState("");
    setCombatSearchChallengeState("");
    setCombatEnemyTypeFilterState("all");
    setCombatSelectionQuantityState(1);
    setCombatSelectionInitiativeState(0);
    setCombatSelectionId("");
  };

  const resetPreparedCombatEnemySearch = () => {
    setPreparedCombatSearchQueryState("");
    setPreparedCombatChallengeState("");
    setPreparedCombatSelectionId("");
    setPreparedCombatQuantityState(1);
  };

  const selectCombatEntity = (entityId: string) => {
    setCombatSelectionId(combatSelectionEntityKey(entityId));
  };

  const selectPreparedCombatEntity = (entityId: string) => {
    setPreparedCombatSelectionId(combatSelectionEntityKey(entityId));
  };

  return {
    combatBestiary,
    combatBestiaryLoading,
    combatEnemyTypeFilter,
    combatEnemyTypeOptions,
    combatSearchChallenge,
    combatSearchItems,
    combatSearchQuery,
    combatSelectedBestiaryMonster,
    combatSelectionId,
    combatSelectionInitiative,
    combatSelectionQuantity,
    filteredCombatCatalogItems,
    preparedCombatBestiaryLoading,
    preparedCombatChallenge,
    preparedCombatQuantity,
    preparedCombatSearchItems,
    preparedCombatSearchQuery,
    preparedCombatSelectionId,
    resetCombatEnemySearch,
    resetPreparedCombatEnemySearch,
    selectCombatEntity,
    selectPreparedCombatEntity,
    selectedCombatSearchItem,
    selectedCombatSearchProfile,
    selectedPreparedCombatSearchItem,
    setCombatEnemyTypeFilter,
    setCombatSearchChallenge,
    setCombatSearchQuery,
    setCombatSelectionId,
    setCombatSelectionInitiative,
    setCombatSelectionQuantity,
    setPreparedCombatChallenge,
    setPreparedCombatQuantity,
    setPreparedCombatSearchQuery,
    setPreparedCombatSelectionId
  };
}
