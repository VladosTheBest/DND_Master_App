import type { RuleEntry } from "./rules.types";

type RelatedRulesProps = {
  rules: RuleEntry[];
  onSelectRule: (rule: RuleEntry) => void;
};

export function RelatedRules({
  onSelectRule,
  rules
}: RelatedRulesProps) {
  if (!rules.length) {
    return null;
  }

  return (
    <section className="rules-related-section">
      <div className="rules-section-title">
        <span className="rules-section-icon" aria-hidden="true">↔</span>
        <strong>Связанные правила</strong>
        <span className="eyebrow">{rules.length}</span>
      </div>

      <div className="rules-related-list">
        {rules.map((rule) => (
          <button
            key={rule.id}
            className="rules-related-chip"
            onClick={() => onSelectRule(rule)}
            type="button"
          >
            <strong>{rule.titleRu}</strong>
            <small>{rule.titleEn}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
