type RuleSearchPanelProps = {
  query: string;
  resultCount: number;
  totalCount: number;
  onChangeQuery: (value: string) => void;
  onClear: () => void;
};

export function RuleSearchPanel({
  onChangeQuery,
  onClear,
  query,
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
          <button className="ghost" onClick={onClear} type="button">
            Сбросить
          </button>
        ) : null}
      </div>

      <label className="field field-full">
        <span>Поиск правила</span>
        <input
          className="input"
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder="Например: прыжок, концентрация, стабилизация, 0 хп"
          type="search"
          value={query}
        />
      </label>
    </section>
  );
}
