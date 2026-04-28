import "./rules.css";
import { RuleCategoryTabs } from "./RuleCategoryTabs";
import { RuleDetailsPanel } from "./RuleDetailsPanel";
import { RuleResultCard } from "./RuleResultCard";
import { RuleSearchPanel } from "./RuleSearchPanel";
import { useRulePreview } from "./hooks/useRulePreview";
import { useRulesSearch } from "./hooks/useRulesSearch";
import { rulesAttribution } from "./rules.utils";

const quickRuleQueries = [
  "0 хп",
  "концентрация",
  "укрытие",
  "прыжок",
  "истощение",
  "скрытность",
  "захват",
  "падение"
];

type RulesPageProps = {
  initialRuleId?: string;
  initialQuery?: string;
};

export function RulesPage({
  initialQuery,
  initialRuleId
}: RulesPageProps) {
  const {
    allRules,
    clearSearch,
    getRuleById,
    query,
    results,
    selectedCategory,
    selectedRule,
    setQuery,
    setSelectedCategory,
    setSelectedRule
  } = useRulesSearch({
    initialQuery,
    initialRuleId
  });

  const { previewRule, relatedRules } = useRulePreview({
    getRuleById,
    selectedRule
  });

  return (
    <div className="rules-page">
      <section className="rules-results-column">
        <header className="card rules-header">
          <div className="rules-header-copy">
            <p className="eyebrow rules-kicker">Rules Compendium</p>
            <h1>Правила</h1>
            <p className="copy">Быстрый справочник правил SRD 5.2.1 для боевых, исследовательских и общих вопросов за столом.</p>
          </div>
          <div className="rules-header-stats" aria-label="Статистика справочника">
            <strong>{allRules.length}</strong>
            <span>правил в справочнике</span>
          </div>
        </header>

        <RuleSearchPanel
          onChangeQuery={setQuery}
          onClear={clearSearch}
          onQuickQuery={setQuery}
          query={query}
          quickQueries={quickRuleQueries}
          resultCount={results.length}
          totalCount={allRules.length}
        />

        <RuleCategoryTabs onSelectCategory={setSelectedCategory} selectedCategory={selectedCategory} />

        <section className="card rules-results-list">
          <div className="rules-results-head">
            <div>
              <p className="eyebrow">Результаты</p>
              <strong>{query.trim() ? `Найдено ${results.length}` : "Популярные правила"}</strong>
            </div>
            <span className="rules-count-pill">1–{Math.min(results.length, 20)} из {results.length}</span>
          </div>

          {results.length ? (
            <div className="rules-results-stack">
              {results.map((rule) => (
                <RuleResultCard
                  key={rule.id}
                  onSelect={() => setSelectedRule(rule)}
                  query={query}
                  rule={rule}
                  selected={previewRule?.id === rule.id}
                />
              ))}
            </div>
          ) : (
            <div className="rules-empty-state">
              <p className="eyebrow">Ничего не найдено</p>
              <h3>Попробуй другой запрос</h3>
              <p className="copy">Ищи по русским словам, английскому названию, синонимам или разделу источника.</p>
            </div>
          )}
        </section>
      </section>

      <RuleDetailsPanel
        attribution={rulesAttribution}
        onSelectRelatedRule={setSelectedRule}
        relatedRules={relatedRules}
        rule={previewRule}
      />
    </div>
  );
}
