import type { CampaignData } from "@shadow-edge/shared-types";
import { badge } from "../../app-shared";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityPreparedCombatEditorProps = {
  campaign: CampaignData | null;
  controller: EntityEditorController;
};

export function EntityPreparedCombatEditor({
  campaign,
  controller
}: EntityPreparedCombatEditorProps) {
  const {
    entityForm,
    generatedQuestIssuerDraft,
    generatedQuestIssuerNote,
    setEntityForm
  } = controller;

  if (entityForm.kind !== "quest") {
    return null;
  }

  return (
    <>
      <label className="field">
        <span>Статус</span>
        <select
          className="input"
          onChange={(event) => setEntityForm((current) => ({ ...current, status: event.target.value as typeof current.status }))}
          value={entityForm.status ?? "active"}
        >
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="completed">completed</option>
        </select>
      </label>
      <label className="field">
        <span>Срочность</span>
        <select
          className="input"
          onChange={(event) => setEntityForm((current) => ({ ...current, urgency: event.target.value as typeof current.urgency }))}
          value={entityForm.urgency ?? "Medium"}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
      </label>
      <label className="field">
        <span>Квестодатель</span>
        <select
          className="input"
          onChange={(event) => setEntityForm((current) => ({ ...current, issuerId: event.target.value || undefined }))}
          value={entityForm.issuerId ?? ""}
        >
          <option value="">Не указан</option>
          {(campaign?.npcs ?? []).map((npc) => (
            <option key={npc.id} value={npc.id}>
              {npc.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Локация квеста</span>
        <select
          className="input"
          onChange={(event) => setEntityForm((current) => ({ ...current, locationId: event.target.value || undefined }))}
          value={entityForm.locationId ?? ""}
        >
          <option value="">Не указана</option>
          {(campaign?.locations ?? []).map((location) => (
            <option key={location.id} value={location.id}>
              {location.title}
            </option>
          ))}
        </select>
      </label>
      {!entityForm.issuerId && generatedQuestIssuerDraft?.kind === "npc" ? (
        <section className="card npc-section form-subsection field-full generated-linked-draft">
          <div className="row muted">
            <span>AI-квестодатель</span>
            <span>{generatedQuestIssuerNote || "Будет создан вместе с квестом"}</span>
          </div>
          <div className="entry-card">
            <div className="row">
              <strong>{generatedQuestIssuerDraft.title || "Новый НПС-квестодатель"}</strong>
              <span className={badge("accent")}>Создастся автоматически</span>
            </div>
            <p className="copy">{generatedQuestIssuerDraft.summary || "AI подготовил отдельного НПС для выдачи этого квеста."}</p>
            {generatedQuestIssuerDraft.playerContent?.trim() ? (
              <p className="copy">
                <strong>Игрокам:</strong> {generatedQuestIssuerDraft.playerContent}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
      <section className="card npc-section form-subsection field-full">
        <div className="row muted">
          <span>Заготовленный бой</span>
          <span>Настраивается отдельно после сохранения квеста</span>
        </div>
        <p className="copy">
          Сначала сохрани квест, потом открой его страницу и настрой заготовленный бой через отдельное меню с поиском по НПС и монстрам.
        </p>
      </section>
    </>
  );
}
