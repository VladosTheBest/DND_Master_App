import type { RuleEntry } from "./rules.types";
import { getRuleCategoryLabel } from "./rules.utils";

type RuleMechanic = {
  label: string;
  formula?: string;
  descriptionRu?: string;
};

type RuleResultCardProps = {
  rule: RuleEntry;
  selected: boolean;
  query?: string;
  onSelect: () => void;
};

const categoryIcons: Record<string, string> = {
  combat: "⚔",
  movement: "➤",
  conditions: "◈",
  checks: "⚖",
  "saving-throws": "◆",
  resting: "☾",
  spellcasting: "✦",
  damage: "✹",
  death: "☠",
  exploration: "⌖",
  equipment: "▣",
  social: "◌",
  "dm-tools": "✧"
};

function getPrimaryMechanic(rule: RuleEntry) {
  const mechanics = (rule as RuleEntry & { mechanics?: RuleMechanic[] }).mechanics ?? [];
  return mechanics[0];
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    return <>{text}</>;
  }

  const index = text.toLocaleLowerCase("ru").indexOf(trimmedQuery.toLocaleLowerCase("ru"));

  if (index < 0) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, index)}
      <mark className="rules-search-highlight">{text.slice(index, index + trimmedQuery.length)}</mark>
      {text.slice(index + trimmedQuery.length)}
    </>
  );
}

export function RuleResultCard({
  onSelect,
  query,
  rule,
  selected
}: RuleResultCardProps) {
  const primaryMechanic = getPrimaryMechanic(rule);
  const categoryLabel = getRuleCategoryLabel(rule.category);

  return (
    <article className={`rules-result-card ${selected ? "selected" : ""}`}>
      <button className="rules-result-card-trigger" onClick={onSelect} type="button">
        <span className="rules-result-icon" aria-hidden="true">
          {categoryIcons[rule.category] ?? "◇"}
        </span>

        <div className="rules-result-content">
          <div className="rules-result-card-head">
            <div>
              <p className="rules-result-title"><HighlightedText text={rule.titleRu} query={query} /></p>
              <small className="rules-result-subtitle">{rule.titleEn}</small>
            </div>
            <span className="rules-result-badge">SRD 5.2.1</span>
          </div>

          <div className="rules-result-meta">
            <span>{categoryLabel}</span>
            <span>{rule.sourceSection}</span>
          </div>

          {primaryMechanic ? (
            <div className="rules-result-mechanic">
              <span>{primaryMechanic.label}</span>
              {primaryMechanic.formula ? <strong>{primaryMechanic.formula}</strong> : null}
            </div>
          ) : null}

          <p className="rules-result-summary"><HighlightedText text={rule.summaryRu} query={query} /></p>
        </div>
      </button>
    </article>
  );
}
