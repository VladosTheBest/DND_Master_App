import type { RuleEntry } from "./rules.types";
import { getRuleCategoryLabel } from "./rules.utils";

type RuleResultCardProps = {
  rule: RuleEntry;
  selected: boolean;
  onSelect: () => void;
};

export function RuleResultCard({
  onSelect,
  rule,
  selected
}: RuleResultCardProps) {
  return (
    <article className={`rules-result-card ${selected ? "selected" : ""}`}>
      <button className="rules-result-card-trigger" onClick={onSelect} type="button">
        <div className="rules-result-card-head">
          <div>
            <p className="rules-result-title">{rule.titleRu}</p>
            <small className="rules-result-subtitle">{rule.titleEn}</small>
          </div>
          <span className="rules-result-badge">SRD 5.2.1</span>
        </div>

        <div className="rules-result-meta">
          <span>{getRuleCategoryLabel(rule.category)}</span>
          <span>{rule.sourceSection}</span>
        </div>

        <p className="rules-result-summary">{rule.summaryRu}</p>
      </button>
    </article>
  );
}
