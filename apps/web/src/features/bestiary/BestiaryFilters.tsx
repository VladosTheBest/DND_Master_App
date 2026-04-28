import type { BestiaryBrowseResult } from "@shadow-edge/shared-types";
import { challengeFilterOptions } from "../combat/combat.utils";

type BrowseFiltersProps = {
  activeTab: string;
  bestiary: BestiaryBrowseResult | null;
  browseLabel: string;
  loading: boolean;
  onChallengeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  search: string;
  type: string;
  value: string;
  variant: "browse";
};

type ImportedFiltersProps = {
  count: number;
  layout?: "panel" | "inline";
  onChallengeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
  value: string;
  variant: "imported";
};

type BestiaryFiltersProps = BrowseFiltersProps | ImportedFiltersProps;

export function BestiaryFilters(props: BestiaryFiltersProps) {
  if (props.variant === "browse") {
    return (
      <section className="card section-card bestiary-toolbar">
        <div className="row muted">
          <span>Официальный bestiary dnd.su</span>
          <span>
            {props.bestiary?.status.total ?? 0} записей • {props.bestiary?.status.hydrated ?? 0} в детальном кэше
          </span>
        </div>

        <div className="bestiary-filter-grid">
          <label className="field field-full">
            <span>Поиск по названию</span>
            <input
              className="input"
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder="Например: giant spider, дракон, нежить"
              value={props.search}
            />
          </label>

          <label className="field">
            <span>Опасность / CR</span>
            <select className="input" onChange={(event) => props.onChallengeChange(event.target.value)} value={props.value}>
              <option value="">Все значения</option>
              {props.bestiary?.filters.challenges.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Тип существа</span>
            <select className="input" onChange={(event) => props.onTypeChange(event.target.value)} value={props.type}>
              <option value="">Все типы</option>
              {props.bestiary?.filters.types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row muted">
          <span>{props.browseLabel}</span>
          <span>{props.loading ? "Обновляю каталог..." : `${props.bestiary?.total ?? 0} результатов`}</span>
        </div>
      </section>
    );
  }

  if (props.layout === "inline") {
    return (
      <div className="directory-toolbar directory-toolbar-wide">
        <label className="field">
          <span>Поиск по названию</span>
          <input
            className="input"
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="Например: волк, паук, капитан"
            value={props.search}
          />
        </label>
        <label className="field">
          <span>Опасность / CR</span>
          <select className="input" onChange={(event) => props.onChallengeChange(event.target.value)} value={props.value}>
            <option value="">Все значения</option>
            {challengeFilterOptions.map((option) => (
              <option key={option} value={option}>
                {`CR ${option}`}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <section className="card section-card bestiary-toolbar">
      <div className="row muted">
        <span>Монстры кампании</span>
        <span>{props.count} результатов</span>
      </div>

      <div className="bestiary-filter-grid">
        <label className="field field-full">
          <span>Поиск по названию</span>
          <input
            className="input"
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="Ищи монстра по имени или краткому описанию"
            value={props.search}
          />
        </label>

        <label className="field">
          <span>Опасность / CR</span>
          <select className="input" onChange={(event) => props.onChallengeChange(event.target.value)} value={props.value}>
            <option value="">Все значения</option>
            {challengeFilterOptions.map((option) => (
              <option key={option} value={option}>
                {`CR ${option}`}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Что сейчас показано</span>
          <div className="combat-selected-summary">
            <strong>{props.count} монстров в выборке</strong>
            <small>Фильтруются только уже импортированные монстры кампании, чтобы быстро открыть нужную карточку.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
