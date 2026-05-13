import type { CampaignData } from "@shadow-edge/shared-types";
import { DndGenerationProgress } from "../../auth-ui";

type RandomEventIconName = "spark" | "location" | "card" | "text" | "book" | "close";

type RandomEventModalProps = {
  campaign: CampaignData | null;
  generating: boolean;
  generationSteps: string[];
  notes: string[];
  open: boolean;
  prompt: string;
  selectedDestinationId: string;
  onChangeDestinationId: (value: string) => void;
  onChangePrompt: (value: string) => void;
  onClose: () => void;
  onGenerate: () => void;
};

function RandomEventIcon({ name }: { name: RandomEventIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8
  };

  switch (name) {
    case "spark":
      return (
        <svg className="random-event-icon-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path {...common} d="M10 2.8 11.5 7l4.2 1.5-4.2 1.5L10 14.2 8.5 10 4.3 8.5 8.5 7 10 2.8Z" />
          <path {...common} d="M15.4 12.6 16 14l1.4.6L16 15.2l-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" />
        </svg>
      );
    case "location":
      return (
        <svg className="random-event-icon-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path {...common} d="M10 17s4.4-4.8 4.4-8.1A4.4 4.4 0 0 0 10 4.5a4.4 4.4 0 0 0-4.4 4.4C5.6 12.2 10 17 10 17Z" />
          <circle {...common} cx="10" cy="8.9" r="1.45" />
        </svg>
      );
    case "card":
      return (
        <svg className="random-event-icon-svg" viewBox="0 0 20 20" aria-hidden="true">
          <rect {...common} x="4" y="5" width="12" height="10" rx="1.8" />
          <path {...common} d="M6.6 8h6.8M6.6 10.4h4.8M6.6 12.8h6" />
        </svg>
      );
    case "text":
      return (
        <svg className="random-event-icon-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path {...common} d="M5 5.5h10M5 8.5h8.4M5 11.5h10M5 14.5h6.8" />
        </svg>
      );
    case "book":
      return (
        <svg className="random-event-icon-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path {...common} d="M5.2 4.3h6.2c1.9 0 3.4 1.5 3.4 3.4v8H8.6a3.4 3.4 0 0 1-3.4-3.4v-8Z" />
          <path {...common} d="M8.7 4.3v11.4M8.7 7.3h3.8" />
        </svg>
      );
    case "close":
      return (
        <svg className="random-event-icon-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path {...common} d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
        </svg>
      );
  }
}

export function RandomEventModal({
  campaign,
  generating,
  generationSteps,
  notes,
  open,
  prompt,
  selectedDestinationId,
  onChangeDestinationId,
  onChangePrompt,
  onClose,
  onGenerate
}: RandomEventModalProps) {
  if (!open) {
    return null;
  }

  const selectedDestination =
    campaign && selectedDestinationId
      ? [...campaign.quests, ...campaign.locations].find((entity) => entity.id === selectedDestinationId) ?? null
      : null;
  const selectedLocation = selectedDestination?.kind === "location" ? selectedDestination : null;
  const selectedQuest = selectedDestination?.kind === "quest" ? selectedDestination : null;
  const existingCardCount = selectedDestination?.playerCards?.length ?? 0;
  const destinationLabel = selectedDestination?.title ?? "Новая заметка в лоре";
  const destinationTypeLabel = selectedQuest ? "Квест" : selectedLocation ? "Локация" : "Лор";
  const promptLength = prompt.trim().length;

  return (
    <div className="overlay random-event-overlay" onClick={onClose} role="presentation">
      <div className="panel random-event-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="random-event-shell">
          <header className="random-event-hero">
            <div className="random-event-title-row">
              <span className="random-event-title-icon">
                <RandomEventIcon name="spark" />
              </span>
              <div className="random-event-title-copy">
                <p className="eyebrow">Зачитка</p>
                <h2>Сцена для игроков</h2>
              </div>
            </div>
            <div className="random-event-hero-meta">
              <span>AI название</span>
              <span>Player-facing</span>
              <span>Карточка</span>
            </div>
            <button className="random-event-icon-button" aria-label="Закрыть" onClick={onClose} type="button">
              <RandomEventIcon name="close" />
            </button>
          </header>

          <div className="random-event-layout">
            <section className="random-event-editor-panel">
              <label className="random-event-select-card">
                <span className="random-event-control-icon">
                  <RandomEventIcon name="location" />
                </span>
                <span className="random-event-select-copy">
                  <span>Сохранить карточку</span>
                  <strong>{destinationLabel}</strong>
                </span>
                <select onChange={(event) => onChangeDestinationId(event.target.value)} value={selectedDestinationId}>
                  <option value="">Отдельной заметкой в лоре</option>
                  {campaign?.quests.length ? (
                    <optgroup label="Квесты">
                      {campaign.quests.map((quest) => (
                        <option key={quest.id} value={quest.id}>
                          {quest.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {campaign?.locations.length ? (
                    <optgroup label="Локации">
                      {campaign.locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>

              <label className="random-event-prompt-card">
                <span className="random-event-prompt-head">
                  <span>
                    <RandomEventIcon name="text" />
                    <strong>Где находятся игроки</strong>
                  </span>
                  <small>{promptLength ? `${promptLength} зн.` : "пусто"}</small>
                </span>
                <textarea
                  onChange={(event) => onChangePrompt(event.target.value)}
                  placeholder="Например: партия идёт по заброшенной дороге, впереди тянется дым от старой лесопилки, а у тропы кто-то спешно заметает следы."
                  value={prompt}
                />
              </label>

              {notes.length ? <p className="random-event-notes">{notes.join(" ")}</p> : null}

              <div className="random-event-actions">
                <button className="random-event-secondary-action" onClick={onClose} type="button">
                  Отмена
                </button>
                <button className="random-event-primary-action" disabled={generating} onClick={onGenerate} type="button">
                  <RandomEventIcon name="spark" />
                  {generating ? "Генерирую..." : "Сгенерировать"}
                </button>
              </div>
            </section>

            <aside className="random-event-side-panel">
              <div className="random-event-side-head">
                <span className="random-event-title-icon compact">
                  <RandomEventIcon name="card" />
                </span>
                <div>
                  <p className="eyebrow">Результат</p>
                  <h3>Карточка игроков</h3>
                </div>
              </div>

              <div className="random-event-stat-grid">
                <div className="random-event-stat-card">
                  <RandomEventIcon name="book" />
                  <strong>{destinationTypeLabel}</strong>
                  <span>{destinationLabel}</span>
                </div>
                <div className="random-event-stat-card">
                  <RandomEventIcon name="card" />
                  <strong>{selectedDestination ? existingCardCount + 1 : 1}</strong>
                  <span>{selectedDestination ? "карточка по счёту" : "новая запись"}</span>
                </div>
              </div>

              <div className="random-event-result-preview">
                <span className="random-event-preview-kicker">Сохранится как</span>
                <strong>{selectedDestination ? `Карточка у "${selectedDestination.title}"` : "Lore-запись с карточкой"}</strong>
                <p>
                  Название и текст зачитки придёт из AI. Скрытые заметки, статы и проверки в карточку не попадут.
                </p>
              </div>
            </aside>
          </div>

          {generating ? (
            <DndGenerationProgress
              detail="AI собирает название, встречу, детали происходящего и текст, который можно зачитать за столом."
              steps={generationSteps}
              title="Готовлю сцену для зачитки"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
