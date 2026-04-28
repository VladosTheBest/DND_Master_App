import { abilityLabels } from "../../app-shared";
import { StatEntryEditorSection } from "../../combat-ui";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityStatBlockEditorProps = {
  controller: EntityEditorController;
};

export function EntityStatBlockEditor({
  controller
}: EntityStatBlockEditorProps) {
  const {
    addNpcStatEntry,
    addSpellSlot,
    entityForm,
    removeNpcStatEntry,
    removeSpellSlot,
    setSpellcastingEnabled,
    updateNpcAbilityScore,
    updateNpcSpellcasting,
    updateNpcStatBlock,
    updateNpcStatEntry,
    updateSpellSlot
  } = controller;

  if (
    (entityForm.kind !== "player" && entityForm.kind !== "npc" && entityForm.kind !== "monster") ||
    !entityForm.statBlock
  ) {
    return null;
  }

  return (
    <>
      <section className="card npc-section form-subsection">
        <div className="row muted">
          <span>
            {entityForm.kind === "monster"
              ? "Monster Stat Block"
              : entityForm.kind === "player"
                ? "Player Combat Profile"
                : "NPC Stat Block"}
          </span>
          <span>Полное редактирование боевого профиля</span>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Размер</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, size: event.target.value }))}
              value={entityForm.statBlock.size}
            />
          </label>
          <label className="field">
            <span>Тип существа</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, creatureType: event.target.value }))}
              value={entityForm.statBlock.creatureType}
            />
          </label>
          <label className="field">
            <span>Мировоззрение</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, alignment: event.target.value }))}
              value={entityForm.statBlock.alignment}
            />
          </label>
          <label className="field">
            <span>КБ</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, armorClass: event.target.value }))}
              value={entityForm.statBlock.armorClass}
            />
          </label>
          <label className="field">
            <span>ХП</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, hitPoints: event.target.value }))}
              value={entityForm.statBlock.hitPoints}
            />
          </label>
          <label className="field">
            <span>Скорость</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, speed: event.target.value }))}
              value={entityForm.statBlock.speed}
            />
          </label>
          <label className="field">
            <span>Бонус мастерства</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, proficiencyBonus: event.target.value }))}
              value={entityForm.statBlock.proficiencyBonus ?? ""}
            />
          </label>
          <label className="field">
            <span>Опасность / CR</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, challenge: event.target.value }))}
              value={entityForm.statBlock.challenge ?? ""}
            />
          </label>
          <label className="field">
            <span>Чувства</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, senses: event.target.value }))}
              value={entityForm.statBlock.senses ?? ""}
            />
          </label>
          <label className="field">
            <span>Языки</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, languages: event.target.value }))}
              value={entityForm.statBlock.languages ?? ""}
            />
          </label>
          <label className="field">
            <span>Спасброски</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, savingThrows: event.target.value }))}
              value={entityForm.statBlock.savingThrows ?? ""}
            />
          </label>
          <label className="field">
            <span>Навыки</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, skills: event.target.value }))}
              value={entityForm.statBlock.skills ?? ""}
            />
          </label>
          <label className="field">
            <span>Сопротивления</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, resistances: event.target.value }))}
              value={entityForm.statBlock.resistances ?? ""}
            />
          </label>
          <label className="field">
            <span>Иммунитеты</span>
            <input
              className="input"
              onChange={(event) => updateNpcStatBlock((current) => ({ ...current, immunities: event.target.value }))}
              value={entityForm.statBlock.immunities ?? ""}
            />
          </label>
          <label className="field field-full">
            <span>Иммунитеты к состояниям</span>
            <input
              className="input"
              onChange={(event) =>
                updateNpcStatBlock((current) => ({
                  ...current,
                  conditionImmunities: event.target.value
                }))
              }
              value={entityForm.statBlock.conditionImmunities ?? ""}
            />
          </label>
        </div>
      </section>

      <section className="card npc-section form-subsection">
        <div className="row muted">
          <span>Характеристики</span>
          <span>Очки характеристик и модификаторы</span>
        </div>

        <div className="ability-edit-grid">
          {abilityLabels.map(({ key, label }) => (
            <label key={key} className="field ability-edit-card">
              <span>{label}</span>
              <input
                className="input"
                min={1}
                onChange={(event) => updateNpcAbilityScore(key, event.target.value)}
                type="number"
                value={entityForm.statBlock?.abilityScores[key] ?? 10}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card npc-section form-subsection">
        <div className="row muted">
          <span>Магия</span>
          <button
            className="ghost"
            onClick={() => setSpellcastingEnabled(!entityForm.statBlock?.spellcasting)}
            type="button"
          >
            {entityForm.statBlock?.spellcasting ? "Убрать магию" : "Добавить магию"}
          </button>
        </div>

        {entityForm.statBlock?.spellcasting ? (
          <div className="stack">
            <div className="form-grid">
              <label className="field">
                <span>Заголовок</span>
                <input
                  className="input"
                  onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, title: event.target.value }))}
                  value={entityForm.statBlock.spellcasting.title}
                />
              </label>
              <label className="field">
                <span>Базовая характеристика</span>
                <input
                  className="input"
                  onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, ability: event.target.value }))}
                  value={entityForm.statBlock.spellcasting.ability}
                />
              </label>
              <label className="field">
                <span>СЛ спасброска</span>
                <input
                  className="input"
                  onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, saveDc: event.target.value }))}
                  value={entityForm.statBlock.spellcasting.saveDc}
                />
              </label>
              <label className="field">
                <span>Модификатор атаки</span>
                <input
                  className="input"
                  onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, attackBonus: event.target.value }))}
                  value={entityForm.statBlock.spellcasting.attackBonus}
                />
              </label>
              <label className="field field-full">
                <span>Описание магии</span>
                <textarea
                  className="input textarea"
                  onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, description: event.target.value }))}
                  value={entityForm.statBlock.spellcasting.description ?? ""}
                />
              </label>
              <label className="field field-full">
                <span>Список заклинаний</span>
                <textarea
                  className="input textarea"
                  onChange={(event) =>
                    updateNpcSpellcasting((current) => ({
                      ...current,
                      spells: event.target.value
                        .split(/\n|,/)
                        .map((spell) => spell.trim())
                        .filter(Boolean)
                    }))
                  }
                  placeholder={"mage hand\nshield\nmisty step"}
                  value={entityForm.statBlock.spellcasting.spells.join("\n")}
                />
              </label>
            </div>

            <div className="row muted">
              <span>Ячейки заклинаний</span>
              <button className="ghost" onClick={addSpellSlot} type="button">
                Добавить ячейку
              </button>
            </div>

            <div className="spell-slot-editor-list">
              {(entityForm.statBlock.spellcasting.slots ?? []).map((slot, index) => (
                <div key={`${slot.level}-${index}`} className="spell-slot-row">
                  <label className="field">
                    <span>Уровень</span>
                    <input
                      className="input"
                      onChange={(event) => updateSpellSlot(index, { level: event.target.value })}
                      value={slot.level}
                    />
                  </label>
                  <label className="field">
                    <span>Ячейки</span>
                    <input
                      className="input"
                      onChange={(event) => updateSpellSlot(index, { slots: event.target.value })}
                      value={slot.slots}
                    />
                  </label>
                  <button className="ghost danger-action slot-remove" onClick={() => removeSpellSlot(index)} type="button">
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="copy">У этой сущности сейчас нет секции spellcasting.</p>
        )}
      </section>

      <StatEntryEditorSection
        entries={entityForm.statBlock.traits}
        hint="Пассивные особенности, ауры и правила поведения"
        onAdd={() => addNpcStatEntry("traits")}
        onChange={(index, patch) => updateNpcStatEntry("traits", index, patch)}
        onRemove={(index) => removeNpcStatEntry("traits", index)}
        title="Способности"
      />
      <StatEntryEditorSection
        entries={entityForm.statBlock.actions}
        hint="Удары, укусы, заклинания и основные действия"
        onAdd={() => addNpcStatEntry("actions")}
        onChange={(index, patch) => updateNpcStatEntry("actions", index, patch)}
        onRemove={(index) => removeNpcStatEntry("actions", index)}
        title="Действия"
      />
      <StatEntryEditorSection
        entries={entityForm.statBlock.bonusActions ?? []}
        hint="То, что тратит bonus action"
        onAdd={() => addNpcStatEntry("bonusActions")}
        onChange={(index, patch) => updateNpcStatEntry("bonusActions", index, patch)}
        onRemove={(index) => removeNpcStatEntry("bonusActions", index)}
        title="Бонусные действия"
      />
      <StatEntryEditorSection
        entries={entityForm.statBlock.reactions ?? []}
        hint="Ответные действия и защитные приёмы"
        onAdd={() => addNpcStatEntry("reactions")}
        onChange={(index, patch) => updateNpcStatEntry("reactions", index, patch)}
        onRemove={(index) => removeNpcStatEntry("reactions", index)}
        title="Реакции"
      />
    </>
  );
}
