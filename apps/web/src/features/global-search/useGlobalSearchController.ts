import type {
  SearchResult
} from "@shadow-edge/shared-types";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState
} from "react";
import { api } from "../../app/api";
import { requestPageSearchFocus } from "../../app/hooks/usePageSearchHotkey";
import { searchRules } from "../rules/rulesSearch";
import { rulesEntries } from "../rules/rules.utils";
import type { UseGlobalSearchControllerArgs } from "./globalSearch.types";
import {
  buildGlobalSearchDisplayResults,
  buildGlobalSearchFallbackResults
} from "./globalSearch.utils";

export function useGlobalSearchController({
  activeCampaignId,
  campaign,
  entityMap,
  pinnedIds
}: UseGlobalSearchControllerArgs) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const deferredQuery = useDeferredValue(query);
  const ruleResults = useMemo(
    () =>
      deferredQuery.trim()
        ? searchRules({
            limit: 8,
            query: deferredQuery,
            rules: rulesEntries
          })
        : [],
    [deferredQuery]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSearchHotkey =
        (event.ctrlKey || event.metaKey) &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k");

      if (isSearchHotkey) {
        event.preventDefault();
        if (paletteOpen) {
          return;
        }

        if (requestPageSearchFocus()) {
          setPaletteOpen(false);
          return;
        }

        setPaletteOpen(true);
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen]);

  useEffect(() => {
    let active = true;

    if (!campaign || !activeCampaignId) {
      setResults([]);
      return;
    }

    if (!deferredQuery.trim()) {
      setResults(buildGlobalSearchFallbackResults(campaign, entityMap, pinnedIds));
      return;
    }

    api.search(activeCampaignId, deferredQuery)
      .then((nextResults) => {
        if (active) {
          setResults(nextResults);
        }
      })
      .catch(() => {
        if (active) {
          setResults([]);
        }
      });

    return () => {
      active = false;
    };
  }, [activeCampaignId, campaign, deferredQuery, entityMap, pinnedIds]);

  const displayResults = useMemo(
    () => buildGlobalSearchDisplayResults(results, entityMap, ruleResults),
    [entityMap, results, ruleResults]
  );

  const closePalette = () => {
    setPaletteOpen(false);
  };

  const resetPalette = () => {
    setPaletteOpen(false);
    setQuery("");
  };

  return {
    closePalette,
    displayResults,
    openPalette: () => setPaletteOpen(true),
    paletteOpen,
    query,
    resetPalette,
    setPaletteOpen,
    setQuery
  };
}
