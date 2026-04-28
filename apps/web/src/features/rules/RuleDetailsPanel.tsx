import { RelatedRules } from "./RelatedRules";
import type { RuleEntry } from "./rules.types";
import { getRuleCategoryLabel } from "./rules.utils";

type RuleDetailsPanelProps = {
  attribution: string;
  relatedRules: RuleEntry[];
  rule: RuleEntry | null;
  onSelectRelatedRule: (rule: RuleEntry) => void;
};

export function RuleDetailsPanel({
  attribution,
  onSelectRelatedRule,
  relatedRules,
  rule
}: RuleDetailsPanelProps) {
  if (!rule) {
    return (
      <aside className="card rules-details-panel">
        <p className="eyebrow">Правило</p>
        <h3>Выбери запись из списка</h3>
        <p className="copy">Справа откроется полный текст, примеры и связанные правила.</p>
      </aside>
    );
  }

  return (
    <aside className="card rules-details-panel">
      <div className="rules-details-header">
        <div>
          <p className="eyebrow">Правило</p>
          <h2>{rule.titleRu}</h2>
          <small>{rule.titleEn}</small>
        </div>
        <span className="rules-result-badge">SRD 5.2.1</span>
      </div>

      <div className="rules-details-meta">
        <span>Категория</span>
        <strong>{getRuleCategoryLabel(rule.category)}</strong>
        <span>Источник</span>
        <strong>{rule.source}</strong>
        <span>Раздел</span>
        <strong>{rule.sourceSection}</strong>
        {rule.sourcePage != null ? (
          <>
            <span>Страница</span>
            <strong>{rule.sourcePage}</strong>
          </>
        ) : null}
      </div>

      <section className="card mini rules-details-section">
        <strong>Кратко</strong>
        <p className="copy">{rule.summaryRu}</p>
      </section>

      <section className="card mini rules-details-section">
        <strong>Полный текст</strong>
        <div className="copy rules-body-text">{rule.ruleTextRu}</div>
      </section>

      {rule.examplesRu?.length ? (
        <section className="card mini rules-details-section">
          <strong>Примеры</strong>
          <div className="rules-example-list">
            {rule.examplesRu.map((example, index) => (
              <p key={`${rule.id}-example-${index}`} className="copy">
                {example}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <RelatedRules onSelectRule={onSelectRelatedRule} rules={relatedRules} />

      {attribution ? (
        <section className="rules-attribution">
          <strong>Attribution</strong>
          <p>{attribution}</p>
        </section>
      ) : null}
    </aside>
  );
}
