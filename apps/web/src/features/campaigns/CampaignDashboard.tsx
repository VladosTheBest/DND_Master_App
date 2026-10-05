import type { CampaignData, KnowledgeEntity } from "@shadow-edge/shared-types";
import { ArrowRight, BookOpen, MapPin, NotebookPen, Pin, Sparkles, Swords, Users } from "lucide-react";
import { createPortraitSource } from "../../app-shared";
import { buildDashboardFocus } from "./dashboard-focus";
import "./campaign-dashboard.css";

type CampaignDashboardProps = {
  campaign: CampaignData;
  pinnedEntities?: KnowledgeEntity[];
  onOpenEntity?: (entityId: string) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenPreview?: (entityId: string) => void;
  onCreateEvent?: () => void;
  readOnly?: boolean;
  onNavigate?: (section: "players" | "quests" | "locations" | "sessions" | "events" | "combat" | "notes") => void;
};

const urgencyLabels = { Critical: "Критично", High: "Срочно", Medium: "Обычный приоритет", Low: "Без спешки" };
const kindLabels = { location: "Локация", player: "Персонаж", npc: "НПС", monster: "Монстр", quest: "Квест", lore: "Заметка" };

export function CampaignDashboard({ campaign, pinnedEntities = [], onOpenEntity, onNavigate, onCreateEvent, readOnly = false }: CampaignDashboardProps) {
  const { quests, locations, npcs, players } = buildDashboardFocus(campaign);
  const combat = campaign.activeCombat;
  const currentTurn = combat?.entries.find(entry => entry.id === combat.currentTurnEntryId);
  const open = readOnly ? undefined : onOpenEntity;
  const navigate = readOnly ? undefined : onNavigate;
  const pinned = pinnedEntities.filter(entity => [...campaign.locations, ...campaign.players, ...campaign.npcs, ...campaign.monsters, ...campaign.quests, ...campaign.lore].some(item => item.id === entity.id));

  function entityRow(entity: KnowledgeEntity, detail?: string) {
    const content = <><span className="gm-avatar" aria-hidden="true">{entity.art?.url ? <img src={createPortraitSource(entity)} alt="" loading="lazy" /> : kindLabels[entity.kind].slice(0, 1)}</span><span className="gm-row-copy"><strong>{entity.title}</strong><small>{detail || entity.subtitle || kindLabels[entity.kind]}</small></span>{open ? <ArrowRight size={16} aria-hidden="true" /> : null}</>;
    return open ? <button type="button" className="gm-row" key={entity.id} onClick={() => open(entity.id)}>{content}</button> : <div className="gm-row" key={entity.id}>{content}</div>;
  }

  return <div className="campaign-dashboard gm-dashboard">
    <header className="gm-heading"><div><p className="eyebrow">Стол мастера</p><h1>{campaign.title}</h1><p className="gm-muted">{[campaign.settingName, campaign.inWorldDate].filter(Boolean).join(" · ")}</p></div>
      {navigate ? <button className="primary" type="button" onClick={() => navigate("combat")}><Swords size={18} />{combat ? "Продолжить бой" : "Подготовить бой"}</button> : null}
    </header>
    {navigate ? <nav className="gm-tools" aria-label="Инструменты мастера"><button type="button" onClick={() => navigate("sessions")}><BookOpen size={18} />Журнал сессий</button><button type="button" onClick={() => navigate("notes")}><NotebookPen size={18} />Заметки</button><button type="button" onClick={() => navigate("players")}><Users size={18} />Группа</button>{onCreateEvent ? <button type="button" onClick={onCreateEvent}><Sparkles size={18} />Случайное событие</button> : null}</nav> : null}
    {combat ? <section className="gm-combat" aria-label="Текущий бой"><Swords size={24} aria-hidden="true" /><div><small>Бой идёт · Раунд {combat.round}</small><h2>{combat.title}</h2><p>{currentTurn ? `Ход: ${currentTurn.title}` : "Очередь хода не выбрана"}</p></div><strong>{combat.entries.filter(entry => !entry.defeated && entry.currentHitPoints > 0).length} в строю</strong></section> : campaign.preparedCombat ? <section className="gm-prepared"><Swords size={20} /><span>Подготовленная встреча: <strong>{campaign.preparedCombat.title || "Без названия"}</strong></span>{navigate ? <button type="button" onClick={() => navigate("combat")}>Открыть <ArrowRight size={16} /></button> : null}</section> : null}
    <div className="gm-columns"><div className="gm-main">
      <section aria-labelledby="gm-quests"><div className="gm-section-heading"><h2 id="gm-quests">Сюжет в работе <span>{quests.length}</span></h2>{navigate ? <button type="button" onClick={() => navigate("quests")}>Все квесты <ArrowRight size={16} /></button> : null}</div>
        {quests.length ? <div className="gm-quests">{quests.slice(0, 6).map(quest => {
          const location = campaign.locations.find(item => item.id === quest.locationId);
          const issuer = campaign.npcs.find(item => item.id === quest.issuerId);
          return <article className="gm-quest" key={quest.id} data-urgency={quest.urgency}><div className="gm-quest-top"><span>{urgencyLabels[quest.urgency]}</span>{open ? <button type="button" title={`Открыть квест: ${quest.title}`} aria-label={`Открыть квест: ${quest.title}`} onClick={() => open(quest.id)}><ArrowRight size={18} /></button> : null}</div><h3>{quest.title}</h3><p>{quest.summary || quest.subtitle}</p>{location || issuer ? <div className="gm-quest-links">{location ? <span><MapPin size={14} />{location.title}</span> : null}{issuer ? <span><Users size={14} />{issuer.title}</span> : null}</div> : null}</article>;
        })}</div> : <div className="gm-empty"><h3>Нет активных квестов</h3><p>Завершённые и отложенные линии остаются в разделе квестов.</p>{navigate ? <button type="button" onClick={() => navigate("quests")}>Открыть квесты <ArrowRight size={16} /></button> : null}</div>}
        {quests.length > 6 && navigate ? <button className="gm-more" type="button" onClick={() => navigate("quests")}>Остальные активные квесты: {quests.length - 6} <ArrowRight size={16} /></button> : null}
      </section>
      <section aria-labelledby="gm-pinned"><div className="gm-section-heading"><h2 id="gm-pinned"><Pin size={18} />Закреплённое <span>{pinned.length}</span></h2></div>{pinned.length ? <div className="gm-pins">{pinned.map(entity => entityRow(entity))}</div> : <p className="gm-muted">Пока нет закреплённых записей.</p>}</section>
    </div><aside className="gm-side">
      <section aria-labelledby="gm-party"><div className="gm-section-heading"><h2 id="gm-party">Группа за столом <span>{players.length}</span></h2>{navigate ? <button type="button" title="Все персонажи" aria-label="Все персонажи" onClick={() => navigate("players")}><ArrowRight size={18} /></button> : null}</div>{players.length ? players.map(player => entityRow(player, [player.role, player.level ? `${player.level} ур.` : "", player.status === "Guest" ? "Гость" : ""].filter(Boolean).join(" · "))) : <p className="gm-muted">Нет активных персонажей. Резерв остаётся в разделе группы.</p>}</section>
      <section aria-labelledby="gm-places"><div className="gm-section-heading"><h2 id="gm-places">Места активных квестов</h2></div>{locations.length ? locations.map(location => entityRow(location)) : <p className="gm-muted">У активных квестов пока нет связанных локаций.</p>}</section>
      {npcs.length ? <section aria-labelledby="gm-npcs"><div className="gm-section-heading"><h2 id="gm-npcs">Ключевые НПС</h2></div>{npcs.map(npc => entityRow(npc, "Выдаёт активный квест"))}</section> : null}
    </aside></div>
  </div>;
}
