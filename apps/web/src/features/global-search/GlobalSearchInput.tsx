type GlobalSearchInputProps = {
  query: string;
  onChange: (value: string) => void;
};

export function GlobalSearchInput({ query, onChange }: GlobalSearchInputProps) {
  return (
    <input
      autoFocus
      className="input"
      onChange={(event) => onChange(event.target.value)}
      placeholder="Лускан, Аркадий, волк, мост, руины..."
      value={query}
    />
  );
}
