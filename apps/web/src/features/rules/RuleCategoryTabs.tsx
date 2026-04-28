import type { RuleCategoryFilter } from "./rules.types";
import {
  getRuleCategoryLabel,
  ruleCategoryTabOrder
} from "./rules.utils";

type RuleCategoryTabsProps = {
  selectedCategory: RuleCategoryFilter;
  onSelectCategory: (category: RuleCategoryFilter) => void;
};

const categoryIcons: Partial<Record<RuleCategoryFilter, string>> = {
  all: "✦",
  combat: "⚔",
  movement: "➤",
  conditions: "◈",
  spellcasting: "✦",
  death: "☠",
  checks: "⚖",
  exploration: "⌖",
  equipment: "▣"
};

export function RuleCategoryTabs({
  onSelectCategory,
  selectedCategory
}: RuleCategoryTabsProps) {
  return (
    <div className="rules-category-tabs" role="tablist" aria-label="Категории правил">
      {ruleCategoryTabOrder.map((category) => {
        const label = category === "all" ? "Все" : getRuleCategoryLabel(category);
        const active = selectedCategory === category;

        return (
          <button
            key={category}
            className={`rules-category-tab ${active ? "active" : ""}`}
            onClick={() => onSelectCategory(category)}
            role="tab"
            type="button"
          >
            <span aria-hidden="true">{categoryIcons[category] ?? "•"}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
