type CombatInitiativeInputProps = {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

export function CombatInitiativeInput({
  label = "Инициатива",
  value,
  onChange,
  className = "combat-prep-initiative-input"
}: CombatInitiativeInputProps) {
  return (
    <input
      aria-label={label}
      className={className}
      inputMode="numeric"
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
      type="number"
      value={value}
    />
  );
}
