type CombatInitiativeInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

export function CombatInitiativeInput({
  value,
  onChange,
  className = "combat-prep-initiative-input"
}: CombatInitiativeInputProps) {
  return (
    <input
      className={className}
      inputMode="numeric"
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
      type="number"
      value={value}
    />
  );
}
