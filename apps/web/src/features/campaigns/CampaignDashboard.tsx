import type { CampaignData, KnowledgeEntity } from "@shadow-edge/shared-types";
import {
  badge,
  createPortraitSource,
  kindTitle,
  worldEventTypeLabels,
  worldEventTypeTones
} from "../../app-shared";

type CampaignDashboardProps = {
  campaign: CampaignData;
  onOpenEntity?: (entityId: string) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenPreview?: (entityId: string) => void;
  readOnly?: boolean;
  onNavigate?: (section: "players" | "quests" | "locations" | "sessions" | "events") => void;
};

const featuredEntities = (campaign: CampaignData): KnowledgeEntity[] => [
  ...campaign.locations,
  ...campaign.npcs,
  ...campaign.monsters,
  ...campaign.quests,
  ...campaign.lore
];

export function CampaignDashboard({
  campaign,
  onOpenEntity,
  onOpenEntityImage,
  onOpenEvent,
  onNavigate,
  readOnly = false
}: CampaignDashboardProps) {
  return (
    <div className="stack wide campaign-dashboard">
      <section className="card hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Обзор кампании</p>
          <h1>{campaign.title}</h1>
          <p className="copy">{campaign.settingName} · {campaign.inWorldDate}</p>
        </div>
      </section>

      {!readOnly && onNavigate ? <section className="dashboard-start" aria-label="Быстрый старт">
        <div><h2>{campaign.players.length || campaign.locations.length ? "К следующей игре" : "Начните с вашей группы"}</h2>
          <p className="copy">Игроки → место действия → история. Остальное можно добавить по ходу игры.</p></div>
        <div className="dashboard-shortcuts">
          {([
            ["players", "01", "Собрать группу", "Персонажи и приглашения", campaign.players.length],
            ["locations", "02", "Подготовить мир", "Места, карты и описания", campaign.locations.length],
            ["quests", "03", "Продумать историю", "Квесты и сцены", campaign.quests.length],
            ["sessions", "04", "Открыть журнал", "Записи и итоги ваших игр", null]
          ] as const).map(([key, number, title, detail, count]) => <button className="dashboard-shortcut" key={key} onClick={() => onNavigate(key)} type="button">
            <span className="dashboard-step">{number}</span><strong>{title}</strong><small>{detail}</small>
            {count !== null ? <span className="muted">Записей: {count}</span> : null}
          </button>)}
        </div>
      </section> : null}

      <section className="split">
        <article className="card section-card">
          <div className="row muted">
            <h2>События</h2>
            {onNavigate ? <button className="ghost" onClick={() => onNavigate("events")} type="button">Все · {campaign.events.length}</button> : <span>{campaign.events.length}</span>}
          </div>
          <div className="stack">
            {!campaign.events.length ? <p className="copy dashboard-empty">Здесь появятся подготовленные сцены и события мира. Добавьте первое в разделе «События».</p> : null}
            {campaign.events.slice(0, 4).map((event) => (
              <button
                className="card mini ghost fill"
                disabled={readOnly}
                key={event.id}
                onClick={() => onOpenEvent?.(event.id)}
                type="button"
              >
                <div className="row">
                  <strong>{event.title}</strong>
                  <span className={badge(worldEventTypeTones[event.type])}>{worldEventTypeLabels[event.type]}</span>
                </div>
                <small>{event.locationLabel ? `${event.locationLabel} • ` : ""}{event.date}</small>
                <p>{event.summary}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="card section-card dashboard-hot-entities">
          <div className="dashboard-hot-head">
            <div>
              <h2>Записи кампании</h2>
            </div>
            <span className="muted">Быстрый переход</span>
          </div>
          <div className="dashboard-hot-grid">
            {!featuredEntities(campaign).length ? <p className="copy dashboard-empty">Добавьте локацию или квест, чтобы открыть их отсюда.</p> : null}
            {featuredEntities(campaign).slice(0, 4).map((entity) => (
              <article
                className="dashboard-hot-card"
                key={entity.id}
              >
                <button
                  aria-label={`Открыть изображение «${entity.title}»`}
                  className="dashboard-hot-visual entity-image-trigger"
                  disabled={readOnly || !onOpenEntityImage}
                  onClick={() => onOpenEntityImage?.(entity, entity.art?.url?.trim() || undefined)}
                  title={`Открыть изображение «${entity.title}»`}
                  type="button"
                >
                  <img alt="" loading="lazy" src={createPortraitSource(entity)} />
                </button>
                <button
                  className="dashboard-hot-copy"
                  disabled={readOnly || !onOpenEntity}
                  onClick={() => onOpenEntity?.(entity.id)}
                  type="button"
                >
                  <small>{kindTitle[entity.kind]}</small>
                  <strong>{entity.title}</strong>
                  <span>{entity.subtitle || entity.summary || "Открыть карточку"}</span>
                </button>
                <span aria-hidden="true" className="dashboard-hot-arrow">↗</span>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
