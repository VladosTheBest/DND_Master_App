type RuleSearchPanelProps = {
  query: string;
  resultCount: number;
  totalCount: number;
  quickQueries?: string[];
  onChangeQuery: (value: string) => void;
  onClear: () => void;
  onQuickQuery?: (value: string) => void;
};

export function RuleSearchPanel({
  onChangeQuery,
  onClear,
  onQuickQuery,
  query,
  quickQueries = [],
  resultCount,
  totalCount
}: RuleSearchPanelProps) {
  return (
    <section className="card rules-search-panel">
      <div className="rules-search-meta">
        <div>
          <p className="eyebrow">Поиск по SRD</p>
          <strong>{query.trim() ? `${resultCount} совпадений` : `${totalCount} правил в справочнике`}</strong>
        </div>
        {query.trim() ? (
          <button className="ghost rules-clear-button" onClick={onClear} type="button">
            Сбросить
          </button>
        ) : null}
      </div>

      <label className="rules-search-field">
        <span className="rules-search-icon" aria-hidden="true">⌕</span>
        <input
          className="input rules-search-input"
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder="Например: прыжок, концентрация, стабилизация, 0 хп"
          type="search"
          value={query}
        />
        <kbd>Ctrl K</kbd>
      </label>

      {quickQueries.length ? (
        <div className="rules-quick-row" aria-label="Быстрые запросы">
          {quickQueries.map((quickQuery) => (
            <button
              key={quickQuery}
              className="rules-quick-chip"
              onClick={() => onQuickQuery?.(quickQuery)}
              type="button"
            >
              {quickQuery}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
