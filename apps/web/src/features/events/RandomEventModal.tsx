import type {
  CampaignData,
  WorldEventType
} from "@shadow-edge/shared-types";
import { DndGenerationProgress } from "../../auth-ui";
import {
  worldEventTypeLabels,
  worldEventTypeOptions
} from "../../app-shared";

type RandomEventModalProps = {
  campaign: CampaignData | null;
  generating: boolean;
  generationSteps: string[];
  notes: string[];
  open: boolean;
  prompt: string;
  selectedLocationId: string;
  selectedType: WorldEventType;
  onChangeLocationId: (value: string) => void;
  onChangePrompt: (value: string) => void;
  onChangeType: (value: WorldEventType) => void;
  onClose: () => void;
  onGenerate: () => void;
};

export function RandomEventModal({
  campaign,
  generating,
  generationSteps,
  notes,
  open,
  prompt,
  selectedLocationId,
  selectedType,
  onChangeLocationId,
  onChangePrompt,
  onChangeType,
  onClose,
  onGenerate
}: RandomEventModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette random-event-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="stack wide">
          <div className="row">
            <div>
              <p className="eyebrow">Событие</p>
              <h2>Подбросить сценку</h2>
              <p className="copy">
                AI соберёт маленькое событие для стола: короткую сцену, реплики, пару веток разговора и конкретный
                лут или награду.
              </p>
            </div>
            <button className="ghost" onClick={onClose} type="button">
              Esc
            </button>
          </div>

          <section className="card section-card random-event-card">
            <div className="form-grid">
              <label className="field">
                <span>Локация</span>
                <select className="input" onChange={(event) => onChangeLocationId(event.target.value)} value={selectedLocationId}>
                  <option value="">Без привязки</option>
                  {campaign?.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Тип сценки</span>
                <select className="input" onChange={(event) => onChangeType(event.target.value as WorldEventType)} value={selectedType}>
                  {worldEventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {worldEventTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-full">
                <span>Дополнительное пожелание</span>
                <small className="field-hint">
                  Необязательно. Можно уточнить настроение, тему или гэг: например, «торговец ругается только матом»,
                  «маленькая стычка без смертей», «неловкое ограбление», «мрачная, но короткая сценка».
                </small>
                <textarea
                  className="input textarea"
                  onChange={(event) => onChangePrompt(event.target.value)}
                  placeholder="Например: на рынке партии липнет торговец, который оскорбляет всех подряд, но может продать полезную наводку."
                  value={prompt}
                />
              </label>
            </div>
          </section>

          {notes.length ? <p className="copy draft-notes">{notes.join(" ")}</p> : null}

          <div className="actions">
            <button className="ghost" onClick={onClose} type="button">
              Отмена
            </button>
            <button className="primary" disabled={generating} onClick={onGenerate} type="button">
              {generating ? "Генерирую событие..." : "Сгенерировать событие"}
            </button>
          </div>

          {generating ? (
            <DndGenerationProgress
              detail="AI собирает короткую сцену, подбирает реплики, ветки разговора и быстрый лут."
              steps={generationSteps}
              title="Тку маленькое событие"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
