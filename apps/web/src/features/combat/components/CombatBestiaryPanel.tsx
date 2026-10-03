import { useEffect, useState } from "react";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { EntityVisual, createBestiaryPortraitSource, createPortraitSource } from "../../../app-shared";
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
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
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
  onAddEnemy,
  onOpenEntityImage
}: CombatBestiaryPanelProps) {
  const [visibleCount, setVisibleCount] = useState(48);
  useEffect(() => setVisibleCount(48), [combatSearchQuery, combatEnemyTypeFilter]);
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
            aria-label="Поиск противников" placeholder="Найти противника…"
            value={combatSearchQuery}
          />
        </label>

      </div>

      <label className="field"><span>Тип противника</span><select className="input" value={combatEnemyTypeFilter} onChange={event => onCombatEnemyTypeFilterChange(event.target.value)}>{combatEnemyTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>

      <div className="combat-prep-bestiary-list">
        {filteredCombatCatalogItems.length ? (
          filteredCombatCatalogItems.slice(0, visibleCount).map((item) => {
            const itemXp = parseChallengeXp(item.challenge ?? "");
            return (
              <article key={`combat-prep-enemy-${item.key}`} className="combat-prep-bestiary-row">
                {item.source === "entity" && item.entity ? (
                  <EntityVisual entity={item.entity} onOpenEntityImage={onOpenEntityImage} />
                ) : (
                  <img
                    alt={item.title}
                    loading="lazy"
                    src={
                      item.bestiary
                        ? createBestiaryPortraitSource(item.bestiary)
                        : createPortraitSource({ kind: item.kind, title: item.title })
                    }
                  />
                )}
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
                  aria-label={`Добавить противника: ${item.title}`}
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
      {visibleCount < filteredCombatCatalogItems.length ? <button className="ghost" onClick={() => setVisibleCount(count => count + 48)} type="button">Показать ещё</button> : null}
    </section>
  );
}
