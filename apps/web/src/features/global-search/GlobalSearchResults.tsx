import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import {
  badge,
  EntityVisual,
  kindTitle
} from "../../app-shared";
import type { GlobalSearchDisplayResult } from "./globalSearch.types";

type GlobalSearchResultsProps = {
  entityMap: Map<string, KnowledgeEntity>;
  results: GlobalSearchDisplayResult[];
  onOpenPrimary: (result: GlobalSearchDisplayResult) => void;
  onOpenSecondary: (result: GlobalSearchDisplayResult) => void;
};

export function GlobalSearchResults({
  entityMap,
  results,
  onOpenPrimary,
  onOpenSecondary
}: GlobalSearchResultsProps) {
  const entityResults = results.filter(
    (result): result is Extract<GlobalSearchDisplayResult, { type: "entity" }> => result.type === "entity"
  );
  const ruleResults = results.filter(
    (result): result is Extract<GlobalSearchDisplayResult, { type: "rule" }> => result.type === "rule"
  );

  return (
    <div className="stack">
      {entityResults.length ? (
        <div className="stack">
          <p className="eyebrow">Сущности</p>
          {entityResults.map((result) => (
            <div key={`${result.kind}-${result.id}`} className="palette-item">
              <button
                className="ghost fill left palette-main palette-main-with-visual"
                onClick={() => onOpenPrimary(result)}
                type="button"
              >
                <EntityVisual
                  entity={{
                    kind: result.kind,
                    title: result.title,
                    art: result.art ?? entityMap.get(result.id)?.art
                  }}
                />
                <span className="palette-copy">
                  <span className={badge("accent")}>{kindTitle[result.kind]}</span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <p>{result.summary}</p>
                </span>
              </button>
              <button className="ghost palette-side" onClick={() => onOpenSecondary(result)} type="button">
                Открыть
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {ruleResults.length ? (
        <div className="stack">
          <p className="eyebrow">Правила</p>
          {ruleResults.map((result) => (
            <div key={`${result.kind}-${result.id}`} className="palette-item">
              <button className="ghost fill left palette-main" onClick={() => onOpenPrimary(result)} type="button">
                <span className="palette-copy">
                  <span className={badge("warning")}>Правило</span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <p>{result.summary}</p>
                </span>
              </button>
              <button className="ghost palette-side" onClick={() => onOpenSecondary(result)} type="button">
                Открыть
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
