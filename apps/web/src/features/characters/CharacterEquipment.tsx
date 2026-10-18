import { useState } from "react";
import type { CharacterDraft } from "./rules";
import {
  CLASS_PACKAGES_2014,
  CLASS_PACKAGES_2024,
  CLASS_GOLD_2024,
  GOLD_DICE_2014,
  BACKGROUND_PACKAGES,
  resolvePackage,
  mergeEquipment,
  equipmentItems,
  EQUIPMENT_NAMES,
} from "./starting-equipment";
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
  onChange: (equipment: CharacterEquipmentItem[], gold?: number) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CharacterEquipmentItem["type"]>("weapon");
  const [startMode, setStartMode] = useState("package");
  const [variant, setVariant] = useState(0);
  const [backgroundGold, setBackgroundGold] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [bgChoices, setBgChoices] = useState<string[]>([]);
  const [rolledGold, setRolledGold] = useState<number | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState("");
  const packages =
    draft.edition === "2024"
      ? CLASS_PACKAGES_2024[draft.classId]
      : CLASS_PACKAGES_2014[draft.classId]
        ? [CLASS_PACKAGES_2014[draft.classId]]
        : [];
  const selected = packages?.[variant] || packages?.[0];
  const background = BACKGROUND_PACKAGES[draft.edition]?.[draft.backgroundId];
  const useBackground = draft.edition === "2024" || startMode === "package";
  const baseGold =
    startMode === "package"
      ? (selected?.gold ?? 0)
      : draft.edition === "2024"
        ? CLASS_GOLD_2024[draft.classId]
        : rolledGold;
  const previewGold =
    (baseGold ?? 0) +
    (useBackground
      ? backgroundGold && draft.edition === "2024"
        ? 50
        : (background?.gold ?? 0)
      : 0);
  const previewItems = mergeEquipment([
    ...(startMode === "package" && selected
      ? resolvePackage(selected, choices)
      : []),
    ...(useBackground &&
    background &&
    !(backgroundGold && draft.edition === "2024")
      ? resolvePackage(background, bgChoices)
      : []),
  ]);
  const choiceControls = (
    options: string[][] | undefined,
    values: string[],
    update: (v: string[]) => void,
  ) =>
    options?.map((items, i) => (
      <label className="ch-notes-field" key={i}>
        Вариант {i + 1}
        <select
          value={items.includes(values[i]) ? values[i] : items[0]}
          onChange={(e) => {
            const next = [...values];
            next[i] = e.target.value;
            update(next);
            setConfirmReplace(false);
          }}
        >
          {items.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll(";", " + ")}
            </option>
          ))}
        </select>
      </label>
    ));
  return (
    <section className="ch-bonus-section">
      <h2>Снаряжение и атаки</h2>
      <p>
        Выберите стартовый набор или золото, затем дополните инвентарь. Доспехи
        в этом списке не меняют КД автоматически.
      </p>
      <details className="ch-equipment-start">
        <summary>Стартовое снаряжение · {draft.edition}</summary>
        {selected ? (
          <>
            <label className="ch-notes-field">
              Способ получения
              <select
                value={startMode}
                onChange={(e) => {
                  setStartMode(e.target.value);
                  setConfirmReplace(false);
                }}
              >
                <option value="package">Набор класса и предыстории</option>
                <option value="gold">
                  Золото вместо набора класса
                  {draft.edition === "2014" ? " и предыстории" : ""}
                </option>
              </select>
            </label>
            {startMode === "package" ? (
              <>
                {packages.length > 1 && (
                  <label className="ch-notes-field">
                    Набор класса
                    <select
                      aria-label="Набор класса"
                      value={variant}
                      onChange={(e) => {
                        setVariant(Number(e.target.value));
                        setConfirmReplace(false);
                      }}
                    >
                      {packages.map((_, i) => (
                        <option key={i} value={i}>
                          Набор {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {choiceControls(selected.choices, choices, setChoices)}
                {draft.classId === "cleric" && draft.edition === "2014" && (
                  <p>
                    Боевой молот и кольчуга доступны только при соответствующем
                    владении от домена или происхождения.
                  </p>
                )}
              </>
            ) : (
              draft.edition === "2014" && (
                <div>
                  <label className="ch-notes-field">
                    Стартовое золото (бросок или сумма от мастера)
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      value={rolledGold ?? ""}
                      onChange={(e) =>
                        setRolledGold(
                          e.target.value === ""
                            ? null
                            : Math.min(
                                1000000,
                                Math.max(
                                  0,
                                  Math.trunc(Number(e.target.value) || 0),
                                ),
                              ),
                        )
                      }
                    />
                  </label>
                  {GOLD_DICE_2014[draft.classId] && (
                    <button
                      type="button"
                      className="chsheet-button"
                      onClick={() => {
                        const dice = Array.from(
                          crypto.getRandomValues(
                            new Uint32Array(GOLD_DICE_2014[draft.classId]),
                          ),
                          (n) => (n % 4) + 1,
                        );
                        setRolledGold(dice.reduce((a, b) => a + b, 0) * 10);
                        setMessage(`Бросок: ${dice.join(" + ")} × 10 зм.`);
                      }}
                    >
                      Бросить {GOLD_DICE_2014[draft.classId]}d4 × 10
                    </button>
                  )}
                </div>
              )
            )}
            {draft.edition === "2024" && (
              <label className="ch-notes-field">
                Предыстория
                <select
                  aria-label="Набор предыстории"
                  value={backgroundGold ? "gold" : "package"}
                  onChange={(e) => {
                    setBackgroundGold(e.target.value === "gold");
                    setConfirmReplace(false);
                  }}
                >
                  <option value="package">Набор предыстории</option>
                  <option value="gold">50 зм. вместо набора</option>
                </select>
              </label>
            )}
            {useBackground &&
              !(backgroundGold && draft.edition === "2024") &&
              choiceControls(background?.choices, bgChoices, setBgChoices)}
            {useBackground && !background && (
              <p>
                Для этой предыстории добавьте согласованные с мастером предметы
                вручную.
              </p>
            )}
            <div className="ch-equipment-preview">
              <strong>В выбранном наборе · {previewGold} зм.</strong>
              <ul>
                {previewItems.map((item) => (
                  <li key={item.name}>
                    {item.name} × {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
            {confirmReplace && (
              <p role="alert">
                Текущий инвентарь и остаток золота будут заменены выбранным
                набором.
              </p>
            )}
            <button
              type="button"
              className="chsheet-button chsheet-button--gold"
              disabled={startMode === "gold" && baseGold == null}
              onClick={() => {
                if (
                  !confirmReplace &&
                  ((draft.equipment?.length ?? 0) > 0 || (draft.gold ?? 0) > 0)
                ) {
                  setConfirmReplace(true);
                  return;
                }
                onChange(previewItems, previewGold);
                setConfirmReplace(false);
                setMessage("Стартовое снаряжение применено.");
              }}
            >
              {confirmReplace
                ? "Подтвердить замену инвентаря"
                : "Применить стартовое снаряжение"}
            </button>
            {confirmReplace && (
              <button
                type="button"
                className="chsheet-button"
                onClick={() => setConfirmReplace(false)}
              >
                Отмена замены
              </button>
            )}
          </>
        ) : (
          <p>
            Готовый набор этого класса пока не добавлен. Выберите предметы из
            списка ниже и укажите золото по согласованию с мастером.
          </p>
        )}
      </details>
      {message && <p role="status">{message}</p>}
      <label className="ch-notes-field">
        Золото, зм. (текущий остаток)
        <input
          type="number"
          min={0}
          max={1000000}
          value={draft.gold ?? 0}
          onChange={(e) =>
            onChange(
              draft.equipment || [],
              Math.max(
                0,
                Math.min(1000000, Math.trunc(Number(e.target.value) || 0)),
              ),
            )
          }
        />
      </label>
      <p className="ch-muted">
        Покупки и расход золота учитывайте вручную. Для героя выше 1-го уровня
        дополнительные предметы определяет мастер.
      </p>
      <label className="ch-notes-field">
        Выбрать из списка
        <select
          value=""
          onChange={(e) => {
            const item = equipmentItems(e.target.value)[0];
            setName(item.name);
            setType(item.type);
          }}
        >
          <option value="">Оружие, доспехи, наборы и инструменты…</option>
          {EQUIPMENT_NAMES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
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
        <div key={i} className="ch-equipment-row">
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
