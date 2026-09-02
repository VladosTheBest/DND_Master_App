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
  onOpenPreview,
  readOnly = false
}: CampaignDashboardProps) {
  const firstEntityId = campaign.locations[0]?.id ?? campaign.npcs[0]?.id ?? campaign.monsters[0]?.id ?? "";
  const previewEntityId = campaign.quests[0]?.id ?? campaign.lore[0]?.id ?? campaign.monsters[0]?.id ?? "";

  return (
    <div className="stack wide campaign-dashboard">
      <section className="card hero">
        <div className="hero-copy-block">
          <p className="eyebrow">GM Cockpit</p>
          <h1>{campaign.title}</h1>
          <p className="copy">
            Один кабинет для мира, квестов и живой сессии. Сущности открываются в центре без прыжков страницы,
            а справа можно держать быстрый preview и закреплённые карточки.
          </p>
        </div>

        {!readOnly ? (
          <div className="actions">
            <button className="primary" onClick={() => onOpenEntity?.(firstEntityId)} type="button">
              Открыть первую сущность
            </button>
            <button className="ghost" onClick={() => onOpenPreview?.(previewEntityId)} type="button">
              Preview квеста
            </button>
          </div>
        ) : null}
      </section>

      <section className="stats">
        {campaign.dashboardCards.map((card) => (
          <article key={card.label} className={`card stat dashboard-stat-card dashboard-stat-${card.tone}`}>
            <span aria-hidden="true" className="dashboard-stat-mark">
              {card.label === "Локации" ? "⌖" : card.label === "Игроки" ? "♙" : card.label === "НПС" ? "♜" : card.label === "Монстры" ? "♞" : card.label === "Бой" ? "⚔" : "✦"}
            </span>
            <span className="dashboard-stat-copy">
              <span className={badge(card.tone)}>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </span>
          </article>
        ))}
      </section>

      <section className="split">
        <article className="card section-card">
          <div className="row muted">
            <span>События</span>
            <span>{campaign.events.length}</span>
          </div>
          <div className="stack">
            {campaign.events.map((event) => (
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
              <span className="eyebrow">В фокусе</span>
              <h2>Важные сущности</h2>
            </div>
            <span className="muted">Быстрый переход</span>
          </div>
          <div className="dashboard-hot-grid">
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
