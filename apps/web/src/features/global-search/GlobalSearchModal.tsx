import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import type { GlobalSearchDisplayResult } from "./globalSearch.types";
import { GlobalSearchInput } from "./GlobalSearchInput";
import { GlobalSearchResults } from "./GlobalSearchResults";
import "./global-search.css";

type GlobalSearchModalProps = {
  entityMap: Map<string, KnowledgeEntity>;
  open: boolean;
  query: string;
  results: GlobalSearchDisplayResult[];
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenPrimaryResult: (result: GlobalSearchDisplayResult) => void;
  onOpenSecondaryResult: (result: GlobalSearchDisplayResult) => void;
};

export function GlobalSearchModal({
  entityMap,
  open,
  query,
  results,
  onChangeQuery,
  onClose,
  onOpenPrimaryResult,
  onOpenSecondaryResult
}: GlobalSearchModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">Global Search</p>
            <strong>Ищет сущности и правила, а затем открывает нужный модуль без ручной навигации</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <GlobalSearchInput onChange={onChangeQuery} query={query} />
        <GlobalSearchResults
          entityMap={entityMap}
          onOpenPrimary={onOpenPrimaryResult}
          onOpenSecondary={onOpenSecondaryResult}
          results={results}
        />
      </div>
    </div>
  );
}
