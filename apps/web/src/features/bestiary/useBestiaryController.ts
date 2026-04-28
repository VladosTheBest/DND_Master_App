import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type {
  BestiaryBrowseResult,
  BestiaryMonsterDetail
} from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import type { BestiaryControllerArgs } from "./bestiary.types";
import {
  bestiaryBrowseTabLabel,
  filterImportedMonsters,
  findBestiarySummary,
  isBestiaryBrowseTab
} from "./bestiary.utils";

export function useBestiaryController({
  activeCampaignId,
  activeModule,
  activeTab,
  campaignMonsters,
  onImportSuccess,
  setBootError
}: BestiaryControllerArgs) {
  const [bestiary, setBestiary] = useState<BestiaryBrowseResult | null>(null);
  const [bestiarySearch, setBestiarySearch] = useState("");
  const [bestiaryChallenge, setBestiaryChallenge] = useState("");
  const [bestiaryType, setBestiaryType] = useState("");
  const [selectedBestiaryId, setSelectedBestiaryId] = useState("");
  const [selectedBestiaryMonster, setSelectedBestiaryMonster] = useState<BestiaryMonsterDetail | null>(null);
  const [bestiaryLoading, setBestiaryLoading] = useState(false);
  const [bestiaryDetailLoading, setBestiaryDetailLoading] = useState(false);
  const [importingBestiary, setImportingBestiary] = useState(false);
  const [importedMonsterSearch, setImportedMonsterSearch] = useState("");
  const [importedMonsterChallenge, setImportedMonsterChallenge] = useState("");

  const deferredBestiarySearch = useDeferredValue(bestiarySearch);
  const isBrowseMode = isBestiaryBrowseTab(activeModule, activeTab);
  const isImportedMode = activeModule === "monsters" && activeTab === "Imported";

  const filteredImportedMonsters = useMemo(
    () => filterImportedMonsters(campaignMonsters, importedMonsterSearch, importedMonsterChallenge),
    [campaignMonsters, importedMonsterChallenge, importedMonsterSearch]
  );

  const selectedBestiarySummary = useMemo(
    () => findBestiarySummary(bestiary?.items, selectedBestiaryId),
    [bestiary?.items, selectedBestiaryId]
  );

  const importedMonsterTitles = useMemo(
    () => new Set(campaignMonsters.map((monster) => monster.title.trim().toLowerCase())),
    [campaignMonsters]
  );

  const selectedBestiaryImported =
    selectedBestiaryMonster?.monster.title
      ? importedMonsterTitles.has(selectedBestiaryMonster.monster.title.trim().toLowerCase())
      : false;

  const resetBrowseSelection = () => {
    setSelectedBestiaryId("");
    setSelectedBestiaryMonster(null);
  };

  useEffect(() => {
    let cancelled = false;

    if (!isBrowseMode) {
      return () => {
        cancelled = true;
      };
    }

    const loadBestiary = async () => {
      try {
        setBestiaryLoading(true);
        const result = await api.browseBestiary({
          q: deferredBestiarySearch.trim(),
          challenge: bestiaryChallenge,
          type: bestiaryType,
          namedNpc: activeTab === "Named NPC",
          classic: activeTab === "Classic"
        });
        if (cancelled) {
          return;
        }
        setBestiary(result);
        setSelectedBestiaryId((current) => (result.items.some((item) => item.id === current) ? current : ""));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось загрузить каталог dnd.su.");
        setBestiary(null);
      } finally {
        if (!cancelled) {
          setBestiaryLoading(false);
        }
      }
    };

    void loadBestiary();

    return () => {
      cancelled = true;
    };
  }, [activeTab, bestiaryChallenge, bestiaryType, deferredBestiarySearch, isBrowseMode, setBootError]);

  useEffect(() => {
    let cancelled = false;

    if (!isBrowseMode || !selectedBestiaryId) {
      setSelectedBestiaryMonster(null);
      return () => {
        cancelled = true;
      };
    }

    const loadBestiaryMonster = async () => {
      try {
        setBestiaryDetailLoading(true);
        const result = await api.getBestiaryMonster(selectedBestiaryId);
        if (cancelled) {
          return;
        }
        setSelectedBestiaryMonster(result);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось открыть монстра из dnd.su.");
        setSelectedBestiaryMonster(null);
      } finally {
        if (!cancelled) {
          setBestiaryDetailLoading(false);
        }
      }
    };

    void loadBestiaryMonster();

    return () => {
      cancelled = true;
    };
  }, [isBrowseMode, selectedBestiaryId, setBootError]);

  useEffect(() => {
    if (!isBrowseMode || bestiary?.status.state !== "syncing") {
      return;
    }

    const timer = window.setInterval(() => {
      api
        .browseBestiary({
          q: deferredBestiarySearch.trim(),
          challenge: bestiaryChallenge,
          type: bestiaryType,
          namedNpc: activeTab === "Named NPC",
          classic: activeTab === "Classic"
        })
        .then((result) => {
          setBestiary(result);
          setSelectedBestiaryId((current) => (result.items.some((item) => item.id === current) ? current : ""));
        })
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeTab, bestiary?.status.state, bestiaryChallenge, bestiaryType, deferredBestiarySearch, isBrowseMode]);

  const importSelectedBestiaryMonster = async () => {
    if (!activeCampaignId || !selectedBestiaryId) {
      return;
    }

    try {
      setImportingBestiary(true);
      await onImportSuccess(selectedBestiaryId);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось импортировать монстра из dnd.su.");
    } finally {
      setImportingBestiary(false);
    }
  };

  return {
    bestiary,
    bestiaryBrowseLabel: bestiaryBrowseTabLabel(activeTab),
    bestiaryChallenge,
    bestiaryDetailLoading,
    bestiaryLoading,
    bestiarySearch,
    bestiaryType,
    filteredImportedMonsters,
    importedMonsterChallenge,
    importedMonsterSearch,
    importingBestiary,
    isBrowseMode,
    isImportedMode,
    resetBrowseSelection,
    selectedBestiaryId,
    selectedBestiaryImported,
    selectedBestiaryMonster,
    selectedBestiarySummary,
    setBestiaryChallenge,
    setBestiarySearch,
    setBestiaryType,
    setImportedMonsterChallenge,
    setImportedMonsterSearch,
    setSelectedBestiaryId,
    importSelectedBestiaryMonster
  };
}

export type BestiaryController = ReturnType<typeof useBestiaryController>;
