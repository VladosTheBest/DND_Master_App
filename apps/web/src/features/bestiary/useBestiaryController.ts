import { useWorkspaceRoute, workspaceURL, navigateWorkspace, workspaceFilters } from "../../app/workspace-route";
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
  const route=useWorkspaceRoute();
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
  const isImportedMode = activeModule === "monsters" && (activeTab === "Импорт" || activeTab === "Imported");
  const isNamedNpcTab = activeTab === "Именные НПС" || activeTab === "Named NPC";
  const isClassicTab = activeTab === "Классика" || activeTab === "Classic";

  useEffect(()=>{
    if(route.section!=="monsters")return;
    const filters=workspaceFilters(route.filters);
    setBestiarySearch(route.view==="catalog"?route.query:"");setImportedMonsterSearch(route.view!=="catalog"?route.query:"");
    setBestiaryChallenge(String(filters["bestiary.challenge"]||""));setBestiaryType(String(filters["bestiary.type"]||""));setImportedMonsterChallenge(String(filters["bestiary.importedChallenge"]||""));
    setSelectedBestiaryId(route.view==="catalog"?route.target:"");
  },[JSON.stringify(route)]);
  function listFilter(key:string,value:string,set:(value:string)=>void){set(value);if(route.section!=="monsters")return;const next={...route};if(key==="q")next.query=value;else{const filters=workspaceFilters(next.filters);if(value)filters[key]=value;else delete filters[key];next.filters=Object.keys(filters).length?JSON.stringify(filters):undefined;}navigateWorkspace(workspaceURL(next),true);}
  function selectCatalog(id:string){setSelectedBestiaryId(id);navigateWorkspace(workspaceURL({...route,campaignId:activeCampaignId,section:"monsters",view:"catalog",target:id}));}
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
          namedNpc: isNamedNpcTab,
          classic: isClassicTab
        });
        if (cancelled) {
          return;
        }
        setBestiary(result);

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
  }, [activeTab, bestiaryChallenge, bestiaryType, deferredBestiarySearch, isBrowseMode, isClassicTab, isNamedNpcTab, setBootError]);

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
          namedNpc: isNamedNpcTab,
          classic: isClassicTab
        })
        .then((result) => {
          setBestiary(result);

        })
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeTab, bestiary?.status.state, bestiaryChallenge, bestiaryType, deferredBestiarySearch, isBrowseMode, isClassicTab, isNamedNpcTab]);

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
    setBestiaryChallenge:(value:string)=>listFilter("bestiary.challenge",value,setBestiaryChallenge),
    setBestiarySearch:(value:string)=>listFilter("q",value,setBestiarySearch),
    setBestiaryType:(value:string)=>listFilter("bestiary.type",value,setBestiaryType),
    setImportedMonsterChallenge:(value:string)=>listFilter("bestiary.importedChallenge",value,setImportedMonsterChallenge),
    setImportedMonsterSearch:(value:string)=>listFilter("q",value,setImportedMonsterSearch),
    setSelectedBestiaryId:selectCatalog,
    importSelectedBestiaryMonster
  };
}

export type BestiaryController = ReturnType<typeof useBestiaryController>;
