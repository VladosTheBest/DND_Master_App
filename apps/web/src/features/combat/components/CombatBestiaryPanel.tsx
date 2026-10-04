import { useEffect, useState } from "react";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { EntityVisual, createBestiaryPortraitSource, createPortraitSource } from "../../../app-shared";
import type { CombatCatalogOption, CombatSearchItem } from "../combat.types";
import { challengeFilterOptions, extractChallengeToken, parseChallengeXp, resolveCombatSearchItemTypeLabel } from "../combat.utils";

import { CombatThreatBadge, type CombatThreatContext } from "./CombatThreatBadge";

export type CombatBestiaryPanelProps = {
  filteredCombatCatalogItems: CombatSearchItem[];
  combatSearchQuery: string;
  combatSearchChallenge: string;
  loading: boolean;
  threatContext?: CombatThreatContext;
  onCombatSearchChallengeChange: (value: string) => void;
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
  combatSearchChallenge,
  loading,
  threatContext,
  onCombatSearchChallengeChange,
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
  useEffect(() => setVisibleCount(48), [combatSearchQuery, combatEnemyTypeFilter, combatSearchChallenge]);
  const activeFilters = Number(Boolean(combatSearchChallenge)) + Number(combatEnemyTypeFilter !== "all");
  const resetFilters = () => { onCombatSearchChallengeChange(""); onCombatEnemyTypeFilterChange("all"); };
  return (
    <section className="combat-prep-reference-panel bestiary-panel">
      <div className="combat-prep-panel-head">
        <div>
          <h2>Добавить противника</h2>
          <span>{loading ? "Загружаю каталог…" : `${filteredCombatCatalogItems.length} найдено`}</span>
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

      <details className="combat-prep-catalog-filters">
        <summary>Фильтры{activeFilters ? ` · ${activeFilters}` : ""}</summary>
        <div className="combat-prep-catalog-filter-grid">
          <label className="field"><span>Опасность / CR</span>
            <select aria-label="Опасность / CR" className="input" value={combatSearchChallenge} onChange={event => onCombatSearchChallengeChange(event.target.value)}>
              <option value="">Все значения</option>
              {challengeFilterOptions.map(value => <option key={value} value={value}>CR {value}</option>)}
            </select>
          </label>
          <label className="field"><span>Тип существа</span>
            <select aria-label="Тип существа" className="input" value={combatEnemyTypeFilter} onChange={event => onCombatEnemyTypeFilterChange(event.target.value)}>
              {combatEnemyTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {activeFilters ? <button className="ghost" onClick={resetFilters} type="button">Сбросить фильтры</button> : null}
      </details>
      {activeFilters ? <div className="combat-prep-active-filters">
        {combatSearchChallenge ? <button type="button" onClick={() => onCombatSearchChallengeChange("")} aria-label="Убрать фильтр опасности">CR {combatSearchChallenge} ×</button> : null}
        {combatEnemyTypeFilter !== "all" ? <button type="button" onClick={() => onCombatEnemyTypeFilterChange("all")} aria-label="Убрать фильтр типа">{combatEnemyTypeOptions.find(option => option.value === combatEnemyTypeFilter)?.label ?? combatEnemyTypeFilter} ×</button> : null}
      </div> : null}

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
                    <CombatThreatBadge challenge={item.challenge} context={threatContext} />
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
          <div className="combat-prep-catalog-empty"><p className="copy">{loading ? "Ищу противников…" : "Противники не найдены. Измените поиск или фильтры."}</p>{!loading && (activeFilters || combatSearchQuery) ? <button className="ghost" onClick={() => { resetFilters(); onCombatSearchQueryChange(""); }} type="button">Показать всех</button> : null}</div>
        )}
      </div>
      {visibleCount < filteredCombatCatalogItems.length ? <button className="ghost" onClick={() => setVisibleCount(count => count + 48)} type="button">Показать ещё</button> : null}
    </section>
  );
}
