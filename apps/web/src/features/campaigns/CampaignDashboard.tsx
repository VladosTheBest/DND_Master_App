import type { CampaignData, KnowledgeEntity } from "@shadow-edge/shared-types";
import { createPortraitSource, worldEventTypeLabels } from "../../app-shared";
import "./campaign-dashboard.css";

type CampaignDashboardProps = {
  campaign: CampaignData;
  onOpenEntity?: (entityId: string) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenPreview?: (entityId: string) => void;
  onCreateEvent?: () => void;
  readOnly?: boolean;
  onNavigate?: (section: "players" | "quests" | "locations" | "sessions" | "events") => void;
};

const eventSymbols = { funny: "✧", combat: "⚔", heist: "◇", social: "◌", oddity: "✦", danger: "△" };
const excerpt = (value: string, limit = 150) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
};

export function CampaignDashboard({ campaign, onOpenEntity, onOpenEntityImage, onOpenEvent, onNavigate, onCreateEvent, readOnly = false }: CampaignDashboardProps) {
  // Campaign dates are fictional free text: insertion order is more reliable than parsing them.
  const events = [...campaign.events].reverse().slice(0, 3);
  const urgencyOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const quests = campaign.quests.filter((quest) => quest.status === "active").sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]).slice(0, 3);
  const locations = [...campaign.locations].reverse().slice(0, 3);
  const isEmpty = !campaign.players.length && !campaign.locations.length && !campaign.quests.length && !campaign.events.length;

  return <div className="campaign-dashboard home-dashboard">
    <header className="home-heading">
      <div><p className="eyebrow">Ваша кампания</p><h1>{campaign.title}</h1>
        <p className="home-setting">{[campaign.settingName, campaign.inWorldDate].filter(Boolean).join(" · ")}</p>
      </div>
      {!readOnly && onNavigate ? <button className="primary home-journal" onClick={() => onNavigate("sessions")} type="button">Журнал сессий <span aria-hidden="true">↗</span></button> : null}
    </header>

    {isEmpty && !readOnly && onNavigate ? <section className="home-welcome">
      <div><h2>Подготовьте первую игру</h2><p>Добавьте героев и место встречи. Сцену можно придумать вместе с AI.</p></div>
      <div className="home-welcome-actions"><button className="ghost" onClick={() => onNavigate("players")} type="button">Добавить игроков</button><button className="ghost" onClick={() => onNavigate("locations")} type="button">Создать локацию</button></div>
    </section> : null}

    <div className="home-columns">
      <section className="home-events" aria-labelledby="home-events-heading">
        <div className="home-section-heading"><div><h2 id="home-events-heading">Сцены для игры</h2><p>{events.length ? "Последние добавленные события" : "Короткие эпизоды для вашей партии"}</p></div>
          {events.length > 0 && !readOnly && onCreateEvent ? <button className="ghost home-create-event" onClick={onCreateEvent} type="button"><span aria-hidden="true">✦</span> Случайное событие</button> : null}
        </div>
        {events.length ? <div className="home-event-list">{events.map((event) => {
          const location = event.locationLabel || campaign.locations.find((item) => item.id === event.locationId)?.title;
          const reward = event.loot?.find((item) => item.trim());
          const description = excerpt(event.summary || event.sceneText || "Откройте событие, чтобы подготовить детали.");
          return <button className={`home-event home-event-${event.type}`} key={event.id} type="button" disabled={readOnly || !onOpenEvent} onClick={() => onOpenEvent?.(event.id)}>
            <span className="home-event-symbol" aria-hidden="true">{eventSymbols[event.type]}</span>
            <span className="home-event-content">
              <span className="home-event-context"><span className="home-event-type">{worldEventTypeLabels[event.type]}</span>{location ? <span>{location}</span> : null}{event.tags?.includes("gm-event") ? <span>Для мастера</span> : null}</span>
              <strong>{event.title}</strong>
              <span className="home-event-summary">{description}</span>
              {reward ? <span className="home-event-reward"><span>Возможная находка</span> {excerpt(reward, 110)}</span> : null}
              {event.date ? <span className="home-event-date">{event.date}</span> : null}
            </span>
            <span className="home-event-arrow" aria-hidden="true">→</span>
          </button>;
        })}</div> : <div className="home-empty-state"><span aria-hidden="true">✦</span><h3>Место для следующей сцены</h3><p>Неожиданная встреча, странная находка или небольшой конфликт — сохраните идею здесь.</p>{!readOnly && onCreateEvent ? <button className="primary" onClick={onCreateEvent} type="button">Придумать событие</button> : null}</div>}
        {campaign.events.length && onNavigate ? <button className="home-section-link" type="button" onClick={() => onNavigate("events")}>Все события <span>{campaign.events.length}</span><span aria-hidden="true">→</span></button> : null}
      </section>

      <aside className="home-reference" aria-label="Под рукой">
        <section className="home-reference-section">
          <div className="home-section-heading"><h2>Активные квесты</h2>{onNavigate ? <button className="home-text-link" type="button" onClick={() => onNavigate("quests")}>Все квесты →</button> : null}</div>
          {quests.length ? <div className="home-reference-list">{quests.map((quest) => <button className="home-reference-row" key={quest.id} type="button" disabled={readOnly || !onOpenEntity} onClick={() => onOpenEntity?.(quest.id)}><span className="home-quest-dot" aria-hidden="true"/><span><strong>{quest.title}</strong>{quest.urgency === "Critical" || quest.urgency === "High" ? <span className="home-quest-urgency">{quest.urgency === "Critical" ? "Требует внимания" : "Срочный"}</span> : null}<small>{excerpt(quest.summary || quest.subtitle || "Открыть детали квеста", 90)}</small></span><span aria-hidden="true">›</span></button>)}</div> : <p className="home-reference-empty">Активных квестов пока нет.</p>}
        </section>
        <section className="home-reference-section">
          <div className="home-section-heading"><h2>Места действия</h2>{onNavigate ? <button className="home-text-link" type="button" onClick={() => onNavigate("locations")}>Все места →</button> : null}</div>
          {locations.length ? <div className="home-reference-list">{locations.map((location) => <article className="home-location" key={location.id}>
            {location.art?.url ? <button className="home-location-image" type="button" disabled={readOnly || !onOpenEntityImage} aria-label={`Открыть изображение «${location.title}»`} onClick={() => onOpenEntityImage?.(location, location.art?.url)}><img alt="" loading="lazy" src={createPortraitSource(location)} /></button> : <span className="home-location-placeholder" aria-hidden="true">◇</span>}
            <button className="home-location-copy" type="button" disabled={readOnly || !onOpenEntity} onClick={() => onOpenEntity?.(location.id)}><strong>{location.title}</strong><small>{excerpt(location.subtitle || location.summary || "Открыть локацию", 90)}</small></button>
          </article>)}</div> : <p className="home-reference-empty">Добавьте место, где начнётся приключение.</p>}
        </section>
        {onNavigate && !isEmpty ? <button className="home-party-link" type="button" onClick={() => onNavigate("players")}><span>Группа</span><strong>{campaign.players.length ? `Персонажей: ${campaign.players.length}` : "Добавить игроков"}</strong><span aria-hidden="true">→</span></button> : null}
      </aside>
    </div>
  </div>;
}
