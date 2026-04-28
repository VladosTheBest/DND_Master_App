import type { KnowledgeEntity, PreparedCombatPlan } from "@shadow-edge/shared-types";
import {
  EntityVisual,
  badge,
  createBestiaryPortraitSource,
  createPortraitSource,
  hasVisibleArt,
  kindTitle
} from "../../app-shared";
import type { CombatSearchItem } from "../combat/combat.types";
import { challengeFilterOptions, extractChallengeToken, getEntityChallenge } from "../combat/combat.utils";

type PreparedCombatEnemyPickerProps = {
  entityMap: Map<string, KnowledgeEntity>;
  preparedCombatBestiaryLoading: boolean;
  preparedCombatChallenge: string;
  preparedCombatDraft: PreparedCombatPlan;
  preparedCombatQuantity: number;
  preparedCombatSearchItems: CombatSearchItem[];
  preparedCombatSearchQuery: string;
  selectedPreparedCombatSearchItem: CombatSearchItem | null;
  saving: boolean;
  onAddEnemy: () => void;
  onChangeChallenge: (value: string) => void;
  onChangeQuantity: (value: number) => void;
  onChangeSearchQuery: (value: string) => void;
  onPeekEntity: (entityId: string) => void;
  onRemoveEnemy: (entityId: string) => void;
  onSelectItem: (itemKey: string) => void;
  onUpdateEnemyQuantity: (entityId: string, quantity: number) => void;
};

export function PreparedCombatEnemyPicker({
  entityMap,
  preparedCombatBestiaryLoading,
  preparedCombatChallenge,
  preparedCombatDraft,
  preparedCombatQuantity,
  preparedCombatSearchItems,
  preparedCombatSearchQuery,
  selectedPreparedCombatSearchItem,
  saving,
  onAddEnemy,
  onChangeChallenge,
  onChangeQuantity,
  onChangeSearchQuery,
  onPeekEntity,
  onRemoveEnemy,
  onSelectItem,
  onUpdateEnemyQuantity
}: PreparedCombatEnemyPickerProps) {
  return (
    <div className="prepared-combat-layout">
      <div className="stack">
        <div className="form-grid">
          <label className="field field-full">
            <span>Поиск по названию</span>
            <input
              className="input"
              onChange={(event) => onChangeSearchQuery(event.target.value)}
              placeholder="Бандит, волк, капитан, паук, сторож..."
              value={preparedCombatSearchQuery}
            />
          </label>

          <label className="field">
            <span>CR</span>
            <select className="input" onChange={(event) => onChangeChallenge(event.target.value)} value={preparedCombatChallenge}>
              <option value="">Все значения</option>
              {challengeFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {`CR ${option}`}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Количество</span>
            <input
              className="input"
              min={1}
              onChange={(event) => onChangeQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
              type="number"
              value={preparedCombatQuantity}
            />
          </label>

          <div className="field">
            <span>Добавить врага</span>
            <button className="ghost fill" disabled={!selectedPreparedCombatSearchItem || saving} onClick={onAddEnemy} type="button">
              Добавить в сцену
            </button>
          </div>
        </div>

        <div className="row muted">
          <span>НПС кампании + бестиарий dnd.su</span>
          <span>{preparedCombatSearchItems.length} результатов</span>
        </div>
        <div className="combat-search-results prepared-combat-results">
          {preparedCombatSearchItems.length ? (
            preparedCombatSearchItems.map((item) => (
              <button
                key={item.key}
                className={`entity-row combat-search-result ${
                  hasVisibleArt(item.source === "entity" ? item.entity?.art : undefined) || item.source === "bestiary" ? "has-thumb" : ""
                } ${selectedPreparedCombatSearchItem?.key === item.key ? "active" : ""}`}
                onClick={() => onSelectItem(item.key)}
                type="button"
              >
                {item.source === "entity" && item.entity ? (
                  <EntityVisual entity={item.entity} />
                ) : (
                  <span className="entity-thumb-frame">
                    <img
                      alt={item.title}
                      className="entity-thumb"
                      loading="lazy"
                      src={
                        item.bestiary
                          ? createBestiaryPortraitSource(item.bestiary)
                          : createPortraitSource({ kind: item.kind, title: item.title })
                      }
                    />
                  </span>
                )}
                <span className="entity-row-copy">
                  <strong>{item.title}</strong>
                  <small>
                    {[
                      item.source === "bestiary" ? "dnd.su" : item.kind === "monster" ? "Кампания • монстр" : "Кампания • НПС",
                      item.challenge ? `CR ${extractChallengeToken(item.challenge)}` : "CR не указан",
                      item.subtitle || item.summary
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="copy">
              По текущему поиску и фильтру ничего не найдено. Попробуй убрать CR-фильтр или изменить запрос.
            </p>
          )}
        </div>
        {preparedCombatBestiaryLoading ? <p className="copy">Подтягиваю полный список dnd.su под текущий фильтр…</p> : null}
      </div>

      <div className="stack">
        {selectedPreparedCombatSearchItem ? (
          <div className="combat-selected-summary">
            <div className="row">
              <span
                className={badge(
                  selectedPreparedCombatSearchItem.source === "bestiary"
                    ? "accent"
                    : selectedPreparedCombatSearchItem.kind === "monster"
                      ? "danger"
                      : "accent"
                )}
              >
                {selectedPreparedCombatSearchItem.source === "bestiary"
                  ? "dnd.su"
                  : kindTitle[selectedPreparedCombatSearchItem.kind]}
              </span>
              <span className={badge("accent")}>
                {selectedPreparedCombatSearchItem.challenge
                  ? `CR ${extractChallengeToken(selectedPreparedCombatSearchItem.challenge)}`
                  : "CR не указан"}
              </span>
            </div>
            <strong>{selectedPreparedCombatSearchItem.title}</strong>
            <small>
              {selectedPreparedCombatSearchItem.source === "entity" && selectedPreparedCombatSearchItem.entity?.statBlock
                ? `КБ ${selectedPreparedCombatSearchItem.entity.statBlock.armorClass ?? "—"} • ХП ${selectedPreparedCombatSearchItem.entity.statBlock.hitPoints ?? "—"}`
                : selectedPreparedCombatSearchItem.subtitle || "Монстр из dnd.su будет импортирован в кампанию при добавлении в сцену."}
            </small>
            <small>{selectedPreparedCombatSearchItem.summary || "Готовый боевой профиль."}</small>
            {selectedPreparedCombatSearchItem.source === "entity" ? (
              <button className="ghost" onClick={() => onPeekEntity(selectedPreparedCombatSearchItem.id)} type="button">
                Открыть в preview
              </button>
            ) : null}
          </div>
        ) : (
          <p className="copy">
            Выбери НПС кампании или монстра из dnd.su слева, чтобы посмотреть краткую сводку и добавить его в заготовленный бой.
          </p>
        )}

        <div className="row muted">
          <span>Текущий состав сцены</span>
          <span>{preparedCombatDraft.items.reduce((sum, item) => sum + item.quantity, 0)} существ</span>
        </div>

        {preparedCombatDraft.items.length ? (
          <div className="entry-editor-list prepared-combat-entry-list">
            {preparedCombatDraft.items.map((item) => {
              const linked = entityMap.get(item.entityId);
              const linkedEntity =
                linked && (linked.kind === "player" || linked.kind === "npc" || linked.kind === "monster") ? linked : null;

              return (
                <article key={`prepared-combat-draft-${item.entityId}`} className="entry-editor">
                  <div className="row">
                    <strong>{linkedEntity?.title ?? "Сущность не найдена"}</strong>
                    <button className="ghost danger-action" onClick={() => onRemoveEnemy(item.entityId)} type="button">
                      Удалить
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Количество</span>
                      <input
                        className="input"
                        min={1}
                        onChange={(event) =>
                          onUpdateEnemyQuantity(item.entityId, Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                        }
                        type="number"
                        value={item.quantity}
                      />
                    </label>
                    <div className="field">
                      <span>Профиль</span>
                      <div className="combat-selected-summary">
                        <strong>{linkedEntity ? `${kindTitle[linkedEntity.kind]} • ${linkedEntity.title}` : item.entityId}</strong>
                        <small>
                          {linkedEntity
                            ? `${getEntityChallenge(linkedEntity) || "CR не указан"} • ${linkedEntity.summary || linkedEntity.subtitle || "Готов к бою"}`
                            : "Эта запись больше не найдена в кампании и будет пропущена при старте боя."}
                        </small>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="copy">
            Пока враги не добавлены. Выбери подходящих НПС или монстров слева и собери сцену так, как она должна стартовать в квесте.
          </p>
        )}
      </div>
    </div>
  );
}
