import { useNativeDialog } from "../../app/hooks/useNativeDialog";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import type { GlobalSearchDisplayResult } from "./globalSearch.types";
import { GlobalSearchInput } from "./GlobalSearchInput";
import { GlobalSearchResults } from "./GlobalSearchResults";
import "./global-search.css";

type GlobalSearchModalProps = {
  loading:boolean; error:string; scope:"all"|"campaign"|"rules"; onScope:(scope:"all"|"campaign"|"rules")=>void; onRetry:()=>void;
  entityMap: Map<string, KnowledgeEntity>;
  open: boolean;
  query: string;
  results: GlobalSearchDisplayResult[];
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenPrimaryResult: (result: GlobalSearchDisplayResult) => void;
  onOpenSecondaryResult: (result: GlobalSearchDisplayResult) => void;
};

export function GlobalSearchModal({
  entityMap,
  loading,error,scope,onScope,onRetry,
  open,
  query,
  results,
  onChangeQuery,
  onClose,
  onOpenEntityImage,
  onOpenPrimaryResult,
  onOpenSecondaryResult
}: GlobalSearchModalProps) {
  const dialog=useNativeDialog(open,"input");
  if (!open) {
    return null;
  }

  return (
    <dialog ref={dialog} className="app-native-dialog" aria-label="Поиск в кампании и правилах" onCancel={event=>{event.preventDefault();onClose();}}>
      <div className="panel palette" onClick={(event) => event.stopPropagation()}>
        <div className="row">
          <div>
            <p className="eyebrow">Поиск</p>
            <strong>Записи, события, магазины, предметы, карты, сессии и правила</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <label>Область поиска<select aria-label="Область поиска" value={scope} onChange={event=>onScope(event.target.value as typeof scope)}><option value="all">Кампания и правила</option><option value="campaign">Только кампания</option><option value="rules">Только правила</option></select></label>
        <GlobalSearchInput onChange={onChangeQuery} query={query} />
        {loading&&<p role="status">Ищу…</p>}{error&&<p role="alert">{error} <button onClick={onRetry}>Повторить поиск</button></p>}{!loading&&!error&&!results.length&&<p role="status">Ничего не найдено. Попробуйте другой запрос или область поиска.</p>}
        <GlobalSearchResults
          entityMap={entityMap}
          onOpenEntityImage={onOpenEntityImage}
          onOpenPrimary={onOpenPrimaryResult}
          onOpenSecondary={onOpenSecondaryResult}
          results={results}
        />
      </div>
    </dialog>
  );
}
