import { rewardSectionLabel } from "../../app-shared";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityRewardEditorProps = {
  controller: EntityEditorController;
};

export function EntityRewardEditor({
  controller
}: EntityRewardEditorProps) {
  const {
    addMonsterLootEntry,
    entityForm,
    removeMonsterLootEntry,
    updateEntityRewardProfile,
    updateMonsterLootEntry
  } = controller;

  if (entityForm.kind !== "npc" && entityForm.kind !== "monster" && entityForm.kind !== "quest") {
    return null;
  }

  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <span>{rewardSectionLabel(entityForm.kind).title}</span>
        <span>{rewardSectionLabel(entityForm.kind).hint}</span>
      </div>

      <div className="form-grid">
        <label className="field field-full">
          <span>{entityForm.kind === "quest" ? "Описание награды" : "Сводка наград и лута"}</span>
          <textarea
            className="input textarea"
            onChange={(event) => updateEntityRewardProfile((current) => ({ ...current, summary: event.target.value }))}
            placeholder={
              entityForm.kind === "quest"
                ? "Золото, артефакт, покровительство, доступ к локации, политическая услуга."
                : entityForm.kind === "npc"
                  ? "Что НПС может заплатить, отдать добровольно или что можно забрать у него как трофей."
                  : "Что можно снять с монстра, сколько это стоит, какие риски и в каком состоянии находится добыча."
            }
            value={entityForm.rewardProfile?.summary ?? ""}
          />
        </label>
      </div>

      <div className="row muted">
        <span>{entityForm.kind === "quest" ? "Список наград" : "Список добычи"}</span>
        <button className="ghost" onClick={addMonsterLootEntry} type="button">
          Добавить предмет
        </button>
      </div>

      <div className="entry-editor-list">
        {(entityForm.rewardProfile?.loot ?? []).map((entry, index) => (
          <article key={`loot-${index}`} className="entry-editor">
            <div className="row">
              <strong>{entityForm.kind === "quest" ? `Награда #${index + 1}` : `Добыча #${index + 1}`}</strong>
              <button className="ghost danger-action" onClick={() => removeMonsterLootEntry(index)} type="button">
                Удалить
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Название</span>
                <input
                  className="input"
                  onChange={(event) => updateMonsterLootEntry(index, { name: event.target.value })}
                  placeholder={entityForm.kind === "quest" ? "Кошель с золотом" : "Клыки ледяного волка"}
                  value={entry.name}
                />
              </label>
              <label className="field">
                <span>Категория</span>
                <input
                  className="input"
                  onChange={(event) => updateMonsterLootEntry(index, { category: event.target.value })}
                  placeholder={
                    entityForm.kind === "quest"
                      ? "Деньги / Артефакт / Репутация / Услуга"
                      : "Трофей / Алхимия / Оружие / Квест"
                  }
                  value={entry.category}
                />
              </label>
              <label className="field">
                <span>Количество</span>
                <input
                  className="input"
                  onChange={(event) => updateMonsterLootEntry(index, { quantity: event.target.value })}
                  placeholder={entityForm.kind === "quest" ? "200 зм" : "2 клыка"}
                  value={entry.quantity}
                />
              </label>
              <label className="field">
                <span>Проверка</span>
                <input
                  className="input"
                  onChange={(event) => updateMonsterLootEntry(index, { check: event.target.value })}
                  placeholder={
                    entityForm.kind === "quest"
                      ? "Убеждение, История, доступ по статусу, без проверки"
                      : "Медицина, Выживание, Воровские инструменты"
                  }
                  value={entry.check}
                />
              </label>
              <label className="field">
                <span>СЛ</span>
                <input
                  className="input"
                  onChange={(event) => updateMonsterLootEntry(index, { dc: event.target.value })}
                  placeholder="СЛ 14"
                  value={entry.dc ?? ""}
                />
              </label>
              <label className="field field-full">
                <span>Детали</span>
                <textarea
                  className="input textarea"
                  onChange={(event) => updateMonsterLootEntry(index, { details: event.target.value })}
                  placeholder={
                    entityForm.kind === "quest"
                      ? "Условия получения награды, кто вручает, какие есть ограничения и что меняется в мире."
                      : "Что именно получает группа, при каких условиях добыча портится и как это можно использовать."
                  }
                  value={entry.details ?? ""}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
