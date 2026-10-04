import { useMemo } from "react";
import type { CombatCatalogOption, CombatSearchItem } from "../combat.types";
import {
  combatSetupTypeLabelMap,
  resolveCombatSearchItemType,
  resolveCombatSearchItemTypeLabel
} from "../combat.utils";

type UseCombatPreparationParams = {
  combatSearchItems: CombatSearchItem[];
  combatEnemyTypeFilter: string;
  combatSelectionId: string;
  catalogTypes?: CombatCatalogOption[];
};

export const useCombatPreparation = ({
  combatSearchItems,
  combatEnemyTypeFilter,
  combatSelectionId,
  catalogTypes
}: UseCombatPreparationParams) => {
  const combatEnemyTypeOptions = useMemo<CombatCatalogOption[]>(() => {
    const entries = new Map<string, string>();
    entries.set("all", combatSetupTypeLabelMap.all);
    catalogTypes?.forEach(option => entries.set(option.value.trim().toLowerCase(), option.label));
    if (combatEnemyTypeFilter !== "all") entries.set(combatEnemyTypeFilter, entries.get(combatEnemyTypeFilter) ?? combatEnemyTypeFilter);
    combatSearchItems.forEach((item) => {
      const key = resolveCombatSearchItemType(item);
      if (!entries.has(key)) {
        entries.set(key, resolveCombatSearchItemTypeLabel(item));
      }
    });
    return Array.from(entries, ([value, label]) => ({ value, label }));
  }, [catalogTypes, combatEnemyTypeFilter, combatSearchItems]);

  const filteredCombatCatalogItems = useMemo(
    () =>
      combatSearchItems.filter((item) =>
        combatEnemyTypeFilter === "all" ? true : resolveCombatSearchItemType(item) === combatEnemyTypeFilter
      ),
    [combatEnemyTypeFilter, combatSearchItems]
  );

  const selectedCombatSearchItem = useMemo(
    () => combatSearchItems.find((item) => item.key === combatSelectionId) ?? null,
    [combatSearchItems, combatSelectionId]
  );

  return {
    combatEnemyTypeOptions,
    filteredCombatCatalogItems,
    selectedCombatSearchItem
  };
};
