import { useState } from "react";
import { RelatedRules } from "./RelatedRules";
import type { RuleEntry } from "./rules.types";
import { getRuleCategoryLabel } from "./rules.utils";

type RuleMechanic = {
  label: string;
  formula?: string;
  descriptionRu?: string;
};

type RuleCommonQuestion = {
  questionRu: string;
  answerRu: string;
};

type RuleTableRow = {
  [key: string]: string | number | boolean | null | undefined;
};

type EnhancedRuleEntry = RuleEntry & {
  mechanics?: RuleMechanic[];
  commonQuestions?: RuleCommonQuestion[];
  levelTable?: RuleTableRow[];
  paceTable?: RuleTableRow[];
};

type RuleDetailsPanelProps = {
  attribution: string;
  relatedRules: RuleEntry[];
  rule: RuleEntry | null;
  onSelectRelatedRule: (rule: RuleEntry) => void;
};

function formatTableKey(key: string) {
  const labels: Record<string, string> = {
    level: "Уровень",
    d20Penalty: "D20",
    speedPenaltyFt: "Скорость",
    noteRu: "Эффект",
    pace: "Темп",
    minute: "Минута",
    hour: "Час",
    day: "День",
    effectRu: "Эффект"
  };

  return labels[key] ?? key;
}

function formatTableValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  return String(value);
}

function RuleDataTable({ rows }: { rows: RuleTableRow[] }) {
  if (!rows.length) {
    return null;
  }

  const columns = Object.keys(rows[0] ?? {});

  return (
    <div className="rules-table-wrap">
      <table className="rules-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{formatTableKey(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{formatTableValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RuleDetailsPanel({
  attribution,
  onSelectRelatedRule,
  relatedRules,
  rule
}: RuleDetailsPanelProps) {
  const [mode, setMode] = useState<"short" | "full">("short");

  if (!rule) {
    return (
      <aside className="card rules-details-panel rules-details-empty">
        <p className="eyebrow">Правило</p>
        <h3>Выбери запись из списка</h3>
        <p className="copy">Справа откроется полный текст, примеры и связанные правила.</p>
      </aside>
    );
  }

  const enhancedRule = rule as EnhancedRuleEntry;
  const levelRows = enhancedRule.levelTable ?? enhancedRule.paceTable ?? [];

  return (
    <aside className="card rules-details-panel">
      <div className="rules-details-sticky-head">
        <div className="rules-details-header">
          <div>
            <p className="eyebrow rules-kicker">Правило</p>
            <h2>{rule.titleRu}</h2>
            <small>{rule.titleEn}</small>
          </div>
          <span className="rules-result-badge">SRD 5.2.1</span>
        </div>

        <div className="rules-details-mode" role="tablist" aria-label="Режим просмотра правила">
          <button className={mode === "short" ? "active" : ""} onClick={() => setMode("short")} type="button">Кратко</button>
          <button className={mode === "full" ? "active" : ""} onClick={() => setMode("full")} type="button">Подробно</button>
        </div>
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

      <section className="rules-info-card rules-summary-card">
        <span className="rules-section-icon" aria-hidden="true">⚖</span>
        <div>
          <strong>Быстрый ответ</strong>
          <p className="copy">{rule.summaryRu}</p>
        </div>
      </section>

      {enhancedRule.mechanics?.length ? (
        <section className="rules-details-section">
          <div className="rules-section-title">
            <span className="rules-section-icon" aria-hidden="true">✦</span>
            <strong>Механика</strong>
          </div>
          <div className="rules-mechanics-grid">
            {enhancedRule.mechanics.map((mechanic, index) => (
              <article className="rules-mechanic-card" key={`${rule.id}-mechanic-${index}`}>
                <span>{mechanic.label}</span>
                {mechanic.formula ? <strong>{mechanic.formula}</strong> : null}
                {mechanic.descriptionRu ? <p>{mechanic.descriptionRu}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {levelRows.length ? (
        <section className="rules-details-section">
          <div className="rules-section-title">
            <span className="rules-section-icon" aria-hidden="true">▦</span>
            <strong>Таблица</strong>
          </div>
          <RuleDataTable rows={levelRows} />
        </section>
      ) : null}

      {mode === "full" ? (
        <section className="rules-info-card rules-details-text-card">
          <span className="rules-section-icon" aria-hidden="true">▣</span>
          <div>
            <strong>Полный текст</strong>
            <div className="copy rules-body-text">{rule.ruleTextRu}</div>
          </div>
        </section>
      ) : null}

      {mode === "full" && rule.examplesRu?.length ? (
        <section className="rules-info-card rules-details-text-card">
          <span className="rules-section-icon" aria-hidden="true">✧</span>
          <div>
            <strong>Примеры</strong>
            <div className="rules-example-list">
              {rule.examplesRu.map((example, index) => (
                <p key={`${rule.id}-example-${index}`} className="copy">
                  {example}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {mode === "full" && enhancedRule.commonQuestions?.length ? (
        <section className="rules-details-section">
          <div className="rules-section-title">
            <span className="rules-section-icon" aria-hidden="true">?</span>
            <strong>Частые вопросы</strong>
          </div>
          <div className="rules-faq-list">
            {enhancedRule.commonQuestions.map((item, index) => (
              <article className="rules-faq-card" key={`${rule.id}-faq-${index}`}>
                <strong>{item.questionRu}</strong>
                <p>{item.answerRu}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <RelatedRules onSelectRule={onSelectRelatedRule} rules={relatedRules} />

      {attribution ? (
        <details className="rules-attribution">
          <summary>Источник и лицензия</summary>
          <p>{attribution}</p>
        </details>
      ) : null}
    </aside>
  );
}
