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

const hasOpenAppDialog = () => Array.from(
  document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"], [role="alertdialog"]')
).some((dialog) => {
  if (dialog.closest('[aria-hidden="true"], [hidden], [inert]')) {
    return false;
  }

  const style = window.getComputedStyle(dialog);
  return style.display !== "none" && style.visibility !== "hidden";
});

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
  const [loading,setLoading]=useState(false),[error,setError]=useState("");
  const [scope,setScope]=useState<"all"|"campaign"|"rules">("all"),[retry,setRetry]=useState(0);
  const ruleResults = useMemo(
    () =>
      scope!=="campaign" && deferredQuery.trim()
        ? searchRules({
            limit: 8,
            query: deferredQuery,
            rules: rulesEntries
          })
        : [],
    [deferredQuery,scope]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSearchHotkey =
        (event.ctrlKey || event.metaKey) &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k");

      if (isSearchHotkey) {
        event.preventDefault();
        if (paletteOpen || hasOpenAppDialog()) {
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
    const abort=new AbortController();setError("");
    if(!campaign||!activeCampaignId||scope==="rules"){setResults([]);setLoading(false);return;}
    if(!query.trim()){setResults(buildGlobalSearchFallbackResults(campaign,entityMap,pinnedIds));setLoading(false);return;}
    setLoading(true);setResults([]);
    const key=JSON.stringify([activeCampaignId,campaign.revision,query.trim()]);
    const timer=window.setTimeout(()=>{
      const cached=searchCache.get(key);
      if(cached&&Date.now()-cached.time<30000){setResults(cached.results);setLoading(false);return;}
      void api.search(activeCampaignId,query.trim(),abort.signal).then(next=>{if(abort.signal.aborted)return;if(searchCache.size>100)searchCache.clear();searchCache.set(key,{time:Date.now(),results:next});setResults(next);}).catch(reason=>{if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:"Не удалось выполнить поиск.");}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    },250);
    return()=>{abort.abort();clearTimeout(timer);};
  },[activeCampaignId,campaign?.revision,query,scope,retry]);

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
    loading,error,scope,setScope,retry:()=>{searchCache.clear();setRetry(value=>value+1);},
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

const searchCache=new Map<string,{time:number;results:SearchResult[]}>();
