import type { RuleCategoryFilter } from "./rules.types";
import {
  getRuleCategoryLabel,
  ruleCategoryTabOrder
} from "./rules.utils";

type RuleCategoryTabsProps = {
  selectedCategory: RuleCategoryFilter;
  onSelectCategory: (category: RuleCategoryFilter) => void;
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
