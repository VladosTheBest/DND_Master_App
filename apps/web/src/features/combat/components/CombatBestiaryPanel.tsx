import { createBestiaryPortraitSource, createPortraitSource } from "../../../app-shared";
import type { CombatCatalogOption, CombatSearchItem } from "../combat.types";
import { extractChallengeToken, parseChallengeXp, resolveCombatSearchItemTypeLabel } from "../combat.utils";

export type CombatBestiaryPanelProps = {
  filteredCombatCatalogItems: CombatSearchItem[];
  combatSearchQuery: string;
  combatEnemyTypeOptions: CombatCatalogOption[];
  combatEnemyTypeFilter: string;
  combatSelectionId: string;
  onCombatSearchQueryChange: (value: string) => void;
  onCombatEnemyTypeFilterChange: (value: string) => void;
  onSelectCatalogItem: (key: string) => void;
  onAddEnemy: (item: CombatSearchItem) => void;
};

export function CombatBestiaryPanel({
  filteredCombatCatalogItems,
  combatSearchQuery,
  combatEnemyTypeOptions,
  combatEnemyTypeFilter,
  combatSelectionId,
  onCombatSearchQueryChange,
  onCombatEnemyTypeFilterChange,
  onSelectCatalogItem,
  onAddEnemy
}: CombatBestiaryPanelProps) {
  return (
    <section className="combat-prep-reference-panel bestiary-panel">
      <div className="combat-prep-panel-head">
        <div>
          <h2>Бестиарий</h2>
          <span>{`${filteredCombatCatalogItems.length} найдено`}</span>
        </div>
      </div>

      <div className="combat-prep-bestiary-search-row">
        <label className="combat-prep-search-field">
          <span>⌕</span>
          <input
            onChange={(event) => onCombatSearchQueryChange(event.target.value)}
            placeholder="Поиск монстров..."
            value={combatSearchQuery}
          />
        </label>
        <button className="combat-prep-filter-button" type="button" aria-label="Фильтр">
          ⌯
        </button>
      </div>

      <div className="combat-prep-filter-grid-ref">
        {combatEnemyTypeOptions.map((option) => (
          <button
            key={`combat-type-${option.value}`}
            className={`combat-prep-filter-chip-ref ${combatEnemyTypeFilter === option.value ? "active" : ""}`}
            onClick={() => onCombatEnemyTypeFilterChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="combat-prep-bestiary-list">
        {filteredCombatCatalogItems.length ? (
          filteredCombatCatalogItems.map((item) => {
            const itemXp = parseChallengeXp(item.challenge ?? "");
            return (
              <article key={`combat-prep-enemy-${item.key}`} className="combat-prep-bestiary-row">
                <img
                  alt={item.title}
                  loading="lazy"
                  src={
                    item.source === "entity" && item.entity
                      ? createPortraitSource(item.entity)
                      : item.bestiary
                        ? createBestiaryPortraitSource(item.bestiary)
                        : createPortraitSource({ kind: item.kind, title: item.title })
                  }
                />
                <button className="combat-prep-row-main" onClick={() => onSelectCatalogItem(item.key)} type="button">
                  <div className="combat-prep-row-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {resolveCombatSearchItemTypeLabel(item)} • {item.challenge ? `CR ${extractChallengeToken(item.challenge)}` : "CR не указан"}
                    </small>
                  </div>
                </button>
                <span className="combat-prep-catalog-xp">{itemXp ? `${itemXp} XP` : "XP —"}</span>
                <button
                  className={`combat-prep-add-enemy ${combatSelectionId === item.key ? "active" : ""}`}
                  onClick={() => {
                    onSelectCatalogItem(item.key);
                    onAddEnemy(item);
                  }}
                  type="button"
                  aria-label="Добавить противника"
                >
                  +
                </button>
              </article>
            );
          })
        ) : (
          <p className="copy">По текущему фильтру противники не найдены.</p>
        )}
      </div>
    </section>
  );
}
