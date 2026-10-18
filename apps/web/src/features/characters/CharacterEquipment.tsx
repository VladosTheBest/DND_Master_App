import { useState } from "react";
import type { CharacterDraft } from "./rules";
export interface CharacterEquipmentItem {
  name: string;
  quantity: number;
  type: "weapon" | "equipment" | "loot";
}
export function CharacterEquipment({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (equipment: CharacterEquipmentItem[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CharacterEquipmentItem["type"]>("weapon");
  return (
    <section className="ch-bonus-section">
      <h2>Снаряжение и атаки</h2>
      <p>
        Добавьте реальные предметы героя. Для оружия используйте название из
        компендиума Foundry (например, Longsword / Длинный меч). Импортёр
        возьмёт оттуда атаки и урон.
      </p>
      <label className="ch-notes-field">
        Предмет
        <input
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="ch-notes-field">
        Тип
        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value as CharacterEquipmentItem["type"])
          }
        >
          <option value="weapon">Оружие</option>
          <option value="equipment">Экипировка</option>
          <option value="loot">Прочий предмет</option>
        </select>
      </label>
      <button
        type="button"
        className="chsheet-button"
        disabled={!name.trim() || (draft.equipment?.length || 0) >= 100}
        onClick={() => {
          onChange([
            ...(draft.equipment || []),
            { name: name.trim(), type, quantity: 1 },
          ]);
          setName("");
        }}
      >
        Добавить предмет
      </button>
      {(draft.equipment || []).map((item, i) => (
        <div key={i}>
          <span>{item.name} × </span>
          <input
            aria-label={`Количество: ${item.name}`}
            type="number"
            min={1}
            max={999}
            value={item.quantity}
            onChange={(e) =>
              onChange(
                (draft.equipment || []).map((v, j) =>
                  i === j
                    ? {
                        ...v,
                        quantity: Math.max(
                          1,
                          Math.min(
                            999,
                            Math.trunc(Number(e.target.value) || 1),
                          ),
                        ),
                      }
                    : v,
                ),
              )
            }
          />
          <button
            type="button"
            className="chsheet-button"
            onClick={() =>
              onChange((draft.equipment || []).filter((_, j) => j !== i))
            }
          >
            Убрать {item.name}
          </button>
        </div>
      ))}
    </section>
  );
}
