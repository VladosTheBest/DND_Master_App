import type { AIProposal, CampaignData, KnowledgeEntity, WorldEvent, WorldEventInput } from "@shadow-edge/shared-types";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ImageIcon, AlertTriangle, FileText } from "lucide-react";
import { EventSceneCard } from "../../notes-events";
import { CampaignDashboard } from "../campaigns/CampaignDashboard";
import type { AIProposalController } from "./useAIProposalController";
import {
  buildSelectedBlueprintCampaign,
  campaignWithEntityCandidate,
  campaignWithEventCandidate,
  formatProposalDate,
  formatProposalValue,
  normalizeProposalEntity,
  normalizeProposalEvent,
  proposalAfterEntity,
  proposalAfterEvent,
  proposalAppliedCampaign,
  proposalBeforeEntity,
  proposalBeforeEvent,
  proposalCampaignEntities,
  proposalKindLabels,
  proposalSourceLabel,
  proposalStatusLabels,
  proposalTitle
} from "./aiProposal.utils";
import { proposalChangeCount } from "./aiProposal.utils";
import { CodexConnectionPanel } from "./CodexConnectionPanel";
import "./ai-proposals.css";

type AIProposalCenterProps = {
  campaignId?: string;
  controller: AIProposalController;
  renderEntity: (entity: KnowledgeEntity, campaign: CampaignData) => ReactNode;
};

const entityKindLabel: Record<KnowledgeEntity["kind"], string> = {
  location: "Локация",
  player: "Персонаж игрока",
  npc: "НПС",
  monster: "Монстр",
  quest: "Квест",
  lore: "Лор"
};

function AIProposalPromptModal({ controller }: { controller: AIProposalController }) {
  const target = controller.promptTarget;
  if (!target) return null;
  const entity = target.type === "entity" ? target.entity : null;

  return (
    <div className="overlay ai-proposal-overlay" onMouseDown={controller.closePrompt} role="presentation">
      <section
        aria-label={entity ? `Изменить ${entity.title} с AI` : "Создать кампанию с AI"}
        aria-modal="true"
        className="panel form-modal ai-proposal-prompt"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ai-proposal-modal-head">
          <div>
            <p className="eyebrow">AI → черновик → проверка</p>
            <h2>{entity ? `Изменить с AI: ${entity.title}` : "Создать кампанию с AI"}</h2>
            <p className="copy">
              AI подготовит предложение и не изменит данные кампании, пока ты не нажмёшь «Применить» в карточке проверки.
            </p>
          </div>
          <button className="ghost" disabled={controller.action === "create"} onClick={controller.closePrompt} type="button">
            Закрыть
          </button>
        </header>

        <label className="field">
          <span>{entity ? "Что изменить" : "Какую кампанию подготовить"}</span>
          <textarea
            autoFocus
            className="input textarea ai-proposal-prompt-input"
            disabled={controller.action === "create"}
            onChange={(event) => controller.setPrompt(event.target.value)}
            placeholder={
              entity
                ? "Например: сделай мотивацию убедительнее, добавь две зацепки и сохрани текущий арт, связи и карточки игроков."
                : "Опиши сеттинг, тон, стартовую ситуацию, ключевые локации, НПС, квесты и первую сцену."
            }
            value={controller.prompt}
          />
        </label>

        {entity ? <label className="ai-proposal-image-choice">
          <input
            checked={controller.includeImage}
            disabled={controller.action === "create"}
            onChange={(event) => controller.setIncludeImage(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Подготовить один выбранный портрет / ключевой арт</strong>
            <small>Опционально. Если генерация изображений недоступна, черновик сохранит промпт-заглушку и не сорвёт остальные изменения.</small>
          </span>
        </label> : null}

        <details className="ai-proposal-connection-modes">
          <summary>Режимы подключения AI</summary>
          <div>
            <p><strong>OpenAI API</strong><span>Существующий провайдер и ключ остаются запасным вариантом.</span></p>
            <p><strong>ChatGPT через Codex App Server</strong><span>Управляемое подключение личного ChatGPT; доступность и план показывает сервер.</span></p>
            <p><strong>Внешний Codex / ChatGPT через MCP</strong><span>Создаёт такие же серверные предложения, которые появляются в этом inbox.</span></p>
          </div>
        </details>

        {controller.error ? <div className="ai-proposal-alert danger">{controller.error}</div> : null}

        <footer className="ai-proposal-actions">
          <button className="ghost" disabled={controller.action === "create"} onClick={controller.closePrompt} type="button">
            Отмена
          </button>
          <button
            className="primary"
            disabled={controller.action === "create" || !controller.prompt.trim()}
            onClick={() => void controller.submitPrompt()}
            type="button"
          >
            {controller.action === "create" ? "Готовлю безопасный черновик…" : "Подготовить предложение"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AIProposalInbox({ controller, campaignId }: { controller: AIProposalController; campaignId?: string }) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [allCampaigns, setAllCampaigns] = useState(true);
  const scoped = controller.proposals.filter((proposal) => allCampaigns || !campaignId || (proposal.campaignId || proposal.target.campaignId) === campaignId || proposal.kind === "campaign_create");
  const visible = scoped.filter((proposal) => (kind === "all" || proposal.kind.startsWith(kind)) && `${proposalTitle(proposal)} ${proposal.prompt}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    if (controller.inboxOpen && controller.codexPromptOutcome) {
      controller.setCodexPromptOutcome(null);
    }
  }, [controller.codexPromptOutcome, controller.inboxOpen, controller.setCodexPromptOutcome]);

  useEffect(() => {
    if (controller.inboxOpen) {
      setQuery("");
      setKind("all");
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [controller.inboxOpen]);

  return (
    <div
      aria-hidden={!controller.inboxOpen}
      className={`overlay ai-proposal-overlay ${controller.inboxOpen ? "" : "ai-proposal-hidden"}`.trim()}
      onMouseDown={controller.closeInbox}
      role="presentation"
    >
      <section
        aria-label="AI-черновики"
        aria-modal="true"
        className="panel ai-proposal-inbox"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ai-proposal-modal-head">
          <div>
            <p className="eyebrow">Проверка перед применением</p>
            <h2>AI-черновики</h2>
            <p className="copy">
              {controller.codexPromptRunning
                ? "Codex готовит новый проверяемый черновик. Кампания в это время не изменяется."
                : "Выбери черновик, посмотри изменения и реши, что добавить в кампанию."}
            </p>
          </div>
          <div className="actions">
            <button className="ghost" disabled={controller.loading} onClick={() => void controller.refresh()} type="button">
              {controller.loading ? "Обновляю…" : "Обновить"}
            </button>
            <button className="ghost" onClick={controller.closeInbox} ref={closeButtonRef} type="button">
              {controller.codexPromptRunning ? "Свернуть" : "Закрыть"}
            </button>
          </div>
        </header>

        {controller.error ? <div className="ai-proposal-alert danger">{controller.error}</div> : null}

        <details className="ai-proposal-compose">
        <summary>Новый запрос к AI</summary>
        <CodexConnectionPanel
          campaignId={campaignId}
          onPromptOutcome={controller.setCodexPromptOutcome}
          onPromptRunningChange={controller.setCodexPromptRunning}
          onPromptSettled={async () => {
            const proposals = await controller.refresh(true);
            return proposals?.filter((proposal) => (proposal.campaignId || proposal.target.campaignId) === campaignId).length;
          }}
          onProposalsCreated={(proposalIds, hasWarning) => {
            if (!hasWarning && proposalIds[0]) void controller.openProposal(proposalIds[0]);
          }}
        />
        </details>

        <div className="ai-proposal-inbox-toolbar">
          <label className="field"><span>Поиск черновика</span><input className="input" placeholder="Название или запрос…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="field"><span>Содержимое</span><select className="input" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Все типы</option><option value="entity">Карточки и изображения</option><option value="event">События</option><option value="campaign">Кампании</option></select></label>
          <label className="ai-proposal-scope"><input type="checkbox" checked={allCampaigns} onChange={(event) => setAllCampaigns(event.target.checked)} />Все кампании</label>
        </div>
        <div className="ai-proposal-list-count">Готовы: {scoped.filter((item) => proposalChangeCount(item) > 0).length} · Без готовых изменений: {scoped.filter((item) => proposalChangeCount(item) === 0).length}{visible.length !== scoped.length ? ` · найдено ${visible.length}` : ""}</div>
        <div className="ai-proposal-inbox-list">
          {visible.length ? visible.map((proposal) => (
            <button
              className="ai-proposal-inbox-item"
              key={proposal.id}
              onClick={() => void controller.openProposal(proposal)}
              type="button"
            >
              <span className="ai-proposal-inbox-mark">
                {proposal.mediaIntents.find((item) => item.status === "staged" && item.previewUrl)?.previewUrl
                  ? <img alt="" src={proposal.mediaIntents.find((item) => item.status === "staged" && item.previewUrl)!.previewUrl} />
                  : proposalChangeCount(proposal) === 0 ? <AlertTriangle size={20} /> : proposal.mediaIntents.length ? <ImageIcon size={20} /> : <FileText size={20} />}
              </span>
              <span className="ai-proposal-inbox-copy">
                <small>{proposalKindLabels[proposal.kind]} · {proposalSourceLabel(proposal.source)}</small>
                <strong>{proposalTitle(proposal)}</strong>
                <span>{proposal.prompt}</span>
              </span>
              <span className="ai-proposal-inbox-meta">
                <b>{proposalChangeCount(proposal) || "Нет результата"}</b>
                <small>{proposalChangeCount(proposal) ? "изменений" : "Требует внимания"}</small>
                <time>{formatProposalDate(proposal.createdAt)}</time>
              </span>
            </button>
          )) : controller.codexPromptRunning ? (
            <div aria-live="polite" className="ai-proposal-empty working" role="status">
              <span className="ai-proposal-empty-spinner" />
              <strong>Черновик ещё готовится</strong>
              <p>Это нормально: карточка появится здесь только после серверной проверки.</p>
            </div>
          ) : (
            <div className="ai-proposal-empty">
              <span>✓</span>
              <strong>{scoped.length ? "Ничего не найдено" : controller.proposals.length ? "В этой кампании нет черновиков" : "Нет черновиков на проверке"}</strong>
              <p>{scoped.length ? "Попробуй другой запрос или тип." : controller.proposals.length ? `В других кампаниях: ${controller.proposals.length}.` : "Новые результаты появятся здесь после сохранения."}</p>
              {query || kind !== "all" || !allCampaigns ? <button className="ghost" type="button" onClick={() => { setQuery(""); setKind("all"); setAllCampaigns(true); }}>Показать все черновики</button> : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductionEventPreview({ event }: { event: WorldEvent; campaign: CampaignData }) {
  return <div className="ai-proposal-production-event"><EventSceneCard event={event as WorldEventInput} /></div>;
}

function ProposalSnapshot({
  entity,
  event,
  campaign,
  campaignPreview,
  campaignEntities,
  selectedCampaignItemId,
  onSelectCampaignItem,
  renderEntity
}: {
  entity: KnowledgeEntity | null;
  event: WorldEvent | null;
  campaign: CampaignData | null;
  campaignPreview: boolean;
  campaignEntities: KnowledgeEntity[];
  selectedCampaignItemId: string;
  onSelectCampaignItem: (id: string) => void;
  renderEntity: (entity: KnowledgeEntity, campaign: CampaignData) => ReactNode;
}) {
  const campaignEntity = campaignEntities.find((item) => `entity:${item.id}` === selectedCampaignItemId) ?? null;
  const campaignEvent = campaign?.events.find((item) => `event:${item.id}` === selectedCampaignItemId) ?? null;
  if (entity && campaign) {
    const context = campaignWithEntityCandidate(campaign, entity);
    return <div className="ai-proposal-production-preview">{renderEntity(entity, context)}</div>;
  }
  if (event && campaign) return <ProductionEventPreview campaign={campaignWithEventCandidate(campaign, event)} event={event} />;
  if (campaignPreview && campaign) {
    const entityCount = campaign.locations.length + campaign.players.length + campaign.npcs.length + campaign.monsters.length + campaign.quests.length + campaign.lore.length;
    return (
      <div className="stack">
        <div className="ai-proposal-selection-summary">
          <span><strong>{entityCount}</strong> сущностей выбрано</span>
          <span><strong>{campaign.events.length}</strong> событий выбрано</span>
        </div>
        <div className="ai-proposal-production-preview"><CampaignDashboard campaign={campaign} readOnly /></div>
        {campaignEntities.length || campaign.events.length ? (
          <>
            <div className="ai-proposal-candidate-picker" role="tablist" aria-label="Содержимое кампании">
              {campaignEntities.map((item) => (
                <button
                  aria-selected={campaignEntity?.id === item.id}
                  className={campaignEntity?.id === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => onSelectCampaignItem(`entity:${item.id}`)}
                  role="tab"
                  type="button"
                >
                  <small>{entityKindLabel[item.kind]}</small>
                  <strong>{item.title}</strong>
                </button>
              ))}
              {campaign.events.map((item) => (
                <button
                  aria-selected={campaignEvent?.id === item.id}
                  className={campaignEvent?.id === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => onSelectCampaignItem(`event:${item.id}`)}
                  role="tab"
                  type="button"
                >
                  <small>Событие</small>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>
            {campaignEntity ? <div className="ai-proposal-production-preview">{renderEntity(campaignEntity, campaign)}</div> : null}
            {campaignEvent ? <ProductionEventPreview campaign={campaign} event={campaignEvent} /> : null}
          </>
        ) : null}
      </div>
    );
  }
  return (
    <div className="ai-proposal-empty">
      <span>◇</span>
      <strong>Снимка нет</strong>
      <p>Для новой записи состояние «сейчас» пустое. Итог станет доступен после применения.</p>
    </div>
  );
}

const proposalFieldNames: Record<string, string> = { title: "Название", subtitle: "Подзаголовок", summary: "Краткое описание", content: "Описание для мастера", sceneText: "Текст сцены", art: "Изображение", url: "Файл", alt: "Описание изображения", caption: "Подпись", tags: "Теги", related: "Связи", quickFacts: "Ключевые факты", playerFacing: "Текст для игроков", playerFacingCards: "Карточки для игроков", playerCards: "Карточки для игроков", playerContent: "Текст для игроков", dialogueBranches: "Варианты развития", loot: "Награды и находки", type: "Тип", date: "Дата", locationId: "Локация", locationLabel: "Название локации", revision: "Версия", role: "Роль", status: "Статус", statBlock: "Характеристики", preparedCombats: "Подготовленные бои", reward: "Награда", gallery: "Галерея" };
function proposalFieldLabel(path: string) {
  return path.split(/[./]/).filter((part) => part && part !== "$").map((part) => proposalFieldNames[part] || (/^\d+$/.test(part) ? `№ ${Number(part) + 1}` : part)).join(" · ") || "Новая запись";
}

function proposalCurrentRecord(proposal: AIProposal, campaign: CampaignData | null): Record<string, unknown> | null {
  if (!campaign) return null;
  const record = proposal.target.entityKind === "shop" ? campaign.shops?.find((item) => item.id === proposal.target.entityId) : proposal.target.eventId ? campaign.events.find((item) => item.id === proposal.target.eventId) : [...campaign.locations, ...campaign.players, ...campaign.npcs, ...campaign.monsters, ...campaign.quests, ...campaign.lore].find((item) => item.id === proposal.target.entityId);
  return record ? record as unknown as Record<string, unknown> : null;
}
function proposalValueAtPath(record: unknown, path: string): unknown {
  return path.split(/[./]/).filter((part) => part && part !== "$").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined, record);
}
function ProposalDiff({ proposal, campaign }: { proposal: AIProposal; campaign: CampaignData | null }) {
  const live = proposal.status === "pending" ? proposalCurrentRecord(proposal, campaign) : null;
  const changes = proposal.diff.filter((item) => !(proposal.mediaIntents.length && /^\/?art(?:[./]|$)/.test(item.path)) && item.path !== "/revision" && item.path !== "revision");
  if (!changes.length) return null;
  return (
    <div className="ai-proposal-diff-list">
      {changes.map((item, index) => (
        <article className="ai-proposal-diff-row" key={`${item.path}-${index}`}>
          <strong>{proposalFieldLabel(item.path)}</strong>
          <div>
            <small>{live ? "В карточке сейчас" : "До предложения"}</small>
            <pre>{formatProposalValue(live ? proposalValueAtPath(live, item.path) : item.before)}</pre>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <small>После AI</small>
            <pre>{formatProposalValue(item.after)}</pre>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProposalMedia({ controller, proposal }: { controller: AIProposalController; proposal: AIProposal }) {
  if (!proposal.mediaIntents.length) return null;
  const previousArt = ((proposal.status === "pending" ? proposalCurrentRecord(proposal, controller.proposalCampaign) || proposal.before : proposal.before) as { art?: { url?: string } } | null)?.art?.url;
  return (
    <section className="ai-proposal-support-section">
      <header><strong>Изображения предложения</strong><small>Выбери изображение, которое будет добавлено в карточку</small></header>
      <div className="ai-proposal-media-grid">
        {proposal.mediaIntents.map((intent) => {
          const url = intent.finalUrl || intent.previewUrl;
          const selected = intent.selected !== false;
          return (
            <article className={`ai-proposal-media-card ${selected ? "selected" : "deselected"}`} key={intent.id}>
              <div className="ai-proposal-image-comparison">
                {previousArt && intent.field?.startsWith("art.") ? <figure><figcaption>Текущее изображение</figcaption><img alt="Изображение до изменения" src={previousArt} /></figure> : null}
                <figure><figcaption>{proposal.status === "applied" ? "Добавлено" : "Новое изображение"}</figcaption>{url ? <img alt={intent.alt || intent.caption || intent.purpose || "Новое изображение"} src={url} /> : <div className="ai-proposal-media-placeholder">Изображение пока не готово</div>}</figure>
              </div>
              <div>
                <strong>{intent.caption || intent.purpose || "Изображение"}</strong>
                <small>{({ staged: "Готово к применению", promoted: "Добавлено в карточку", placeholder: "Изображение не получено", failed: "Не удалось создать" } as Record<string, string>)[intent.status] || "Подготовка изображения"}</small>
                {intent.prompt ? <details><summary>Описание для генерации</summary><p>{intent.prompt}</p></details> : null}
                {proposal.status === "pending" ? (
                  <label className="ai-proposal-media-toggle">
                    <input
                      checked={selected}
                      disabled={Boolean(controller.action)}
                      onChange={(event) => void controller.setProposalMediaSelected(intent.id, event.target.checked)}
                      type="checkbox"
                    />
                    <span>{selected ? "Включено в предложение" : "Исключено из предложения"}</span>
                  </label>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProposalOperations({
  proposal,
  selectedKeys,
  onToggle
}: {
  proposal: AIProposal;
  selectedKeys: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
}) {
  if (proposal.kind !== "campaign_create" || !proposal.operations.length) return null;
  return (
    <section className="ai-proposal-support-section">
      <header><strong>Что добавить в кампанию</strong><small>Связанные записи выбираются вместе</small></header>
      <div className="ai-proposal-operation-list">
        {proposal.operations.map((operation) => (
          <label className={operation.required ? "required" : ""} key={operation.key}>
            <input
              checked={selectedKeys.has(operation.key)}
              disabled={operation.required || proposal.status !== "pending"}
              onChange={(event) => onToggle(operation.key, event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>{operation.title || operation.key}</strong>
              <small>{(entityKindLabel as Record<string, string>)[operation.kind] || "Событие"}{operation.dependsOn?.length ? " · есть связанные записи" : ""}</small>
            </span>
            {operation.required ? <em>обязательно</em> : null}
          </label>
        ))}
      </div>
    </section>
  );
}

function AIProposalReviewModal({ controller, renderEntity }: AIProposalCenterProps) {
  const proposal = controller.selectedProposal;
  const [tab, setTab] = useState<"before" | "after" | "diff">("diff");
  const [selectedOperationKeys, setSelectedOperationKeys] = useState<Set<string>>(new Set());
  const [selectedCampaignItemId, setSelectedCampaignItemId] = useState("");

  useEffect(() => {
    if (!proposal) return;
    setTab("diff");
    setSelectedOperationKeys(new Set(proposal.operations.map((operation) => operation.key)));
    const firstEntity = proposalCampaignEntities(proposal)[0];
    setSelectedCampaignItemId(firstEntity ? `entity:${firstEntity.id}` : "");
  }, [proposal?.id]);

  const currentRecord = proposal ? proposalCurrentRecord(proposal, controller.proposalCampaign) : null;
  const beforeEntity = useMemo(() => proposal ? proposalBeforeEntity(proposal) : null, [proposal]);
  const afterEntity = useMemo(() => proposal ? proposalAfterEntity(proposal) : null, [proposal]);
  const beforeEvent = useMemo(() => proposal ? proposalBeforeEvent(proposal) : null, [proposal]);
  const afterEvent = useMemo(() => proposal ? proposalAfterEvent(proposal) : null, [proposal]);
  const blueprintCampaign = useMemo(
    () => proposal?.kind === "campaign_create" ? buildSelectedBlueprintCampaign(proposal, selectedOperationKeys) : null,
    [proposal, selectedOperationKeys]
  );
  const appliedCampaign = useMemo(() => proposal ? proposalAppliedCampaign(proposal) : null, [proposal]);
  const campaignAfter = proposal?.kind === "campaign_create" && proposal.status !== "pending"
    ? controller.proposalCampaign ?? appliedCampaign ?? blueprintCampaign
    : blueprintCampaign;
  const campaignEntities = useMemo(() => campaignAfter ? [
    ...campaignAfter.locations,
    ...campaignAfter.players,
    ...campaignAfter.npcs,
    ...campaignAfter.monsters,
    ...campaignAfter.quests,
    ...campaignAfter.lore
  ] : [], [campaignAfter]);

  useEffect(() => {
    if (!campaignAfter) return;
    const available = new Set([
      ...campaignEntities.map((entity) => `entity:${entity.id}`),
      ...campaignAfter.events.map((event) => `event:${event.id}`)
    ]);
    if (available.has(selectedCampaignItemId)) return;
    setSelectedCampaignItemId(available.values().next().value ?? "");
  }, [campaignAfter, campaignEntities, selectedCampaignItemId]);

  if (!proposal) return null;

  const toggleOperation = (key: string, checked: boolean) => {
    setSelectedOperationKeys((current) => {
      const next = new Set(current);
      const operation = proposal.operations.find((item) => item.key === key);
      if (!operation || operation.required) return next;
      if (checked) {
        const pending = [key];
        while (pending.length) {
          const pendingKey = pending.pop();
          if (!pendingKey || next.has(pendingKey)) continue;
          next.add(pendingKey);
          proposal.operations
            .find((candidate) => candidate.key === pendingKey)
            ?.dependsOn?.forEach((dependency) => pending.push(dependency));
        }
      } else {
        next.delete(key);
        let removedDependent = true;
        while (removedDependent) {
          removedDependent = false;
          proposal.operations.forEach((candidate) => {
            if (
              !candidate.required
              && next.has(candidate.key)
              && candidate.dependsOn?.some((dependency) => !next.has(dependency))
            ) {
              next.delete(candidate.key);
              removedDependent = true;
            }
          });
        }
      }
      return next;
    });
  };

  const isPending = proposal.status === "pending";
  const isApplied = proposal.status === "applied";
  const selectedKeys = proposal.kind === "campaign_create" ? Array.from(selectedOperationKeys) : undefined;
  const hasSelectedStagedMedia = proposal.mediaIntents.some((intent) =>
    intent.selected !== false && intent.status === "staged" && Boolean(intent.previewUrl)
  );
  const hasApplicableChanges = proposal.diff.length > 0 || (proposal.kind.endsWith("create") && proposal.operations.length > 0) || hasSelectedStagedMedia;
  const emptyEntityUpdate = proposal.kind === "entity_update" && !hasApplicableChanges;

  return (
    <div className="overlay ai-proposal-overlay ai-proposal-review-overlay" role="presentation">
      <section aria-label={`Проверка: ${proposalTitle(proposal)}`} aria-modal="true" className="panel ai-proposal-review" role="dialog">
        <header className="ai-proposal-review-head">
          <div>
            <div className="ai-proposal-review-kicker">
              <span>{proposalKindLabels[proposal.kind]}</span>
              <span className={`ai-proposal-status ${proposal.status}`}>{proposalStatusLabels[proposal.status]}</span>
              <span>{proposalSourceLabel(proposal.source)}</span>
            </div>
            <h2>{proposalTitle(proposal)}</h2>
            <details className="ai-proposal-original-request"><summary>Исходный запрос</summary><p>{proposal.prompt}</p></details>
          </div>
          <button autoFocus className="ghost" disabled={Boolean(controller.action)} onClick={controller.closeProposal} type="button">К списку черновиков</button>
          <button className="ghost" disabled={controller.loading || Boolean(controller.action)} onClick={() => void controller.openProposal(proposal.id)} type="button">{controller.loading ? "Обновляю…" : "Обновить"}</button>
        </header>

        <div className="ai-proposal-review-tabs" role="tablist">
          <button aria-selected={tab === "diff"} className={tab === "diff" ? "active" : ""} onClick={() => setTab("diff")} role="tab" type="button">Обзор изменений <span>{proposal.diff.length}</span></button>
          <button aria-selected={tab === "before"} className={tab === "before" ? "active" : ""} onClick={() => setTab("before")} role="tab" type="button">{isPending && currentRecord ? "Текущая карточка" : "До изменений"}</button>
          <button aria-selected={tab === "after"} className={tab === "after" ? "active" : ""} onClick={() => setTab("after")} role="tab" type="button">Версия AI целиком</button>
        </div>

        <div className="ai-proposal-review-scroll">
          {proposal.warnings.length ? (
            <details className="ai-proposal-warning-list" open={emptyEntityUpdate || undefined}>
              <summary>Замечания к черновику · {proposal.warnings.length}</summary>
              {proposal.warnings.map((warning, index) => <div key={`${warning}-${index}`}>{warning}</div>)}
            </details>
          ) : null}
          {controller.conflict ? <div className="ai-proposal-alert danger" role="alert"><strong>Нужно проверить пересекающиеся изменения</strong><span>{controller.conflict.replace(/\/[a-zA-Z][a-zA-Z0-9/~]*/g, (path) => proposalFieldLabel(path))}</span><button className="ghost" onClick={() => void controller.openProposal(proposal.id)} type="button">Обновить данные</button></div> : null}
          {controller.error ? <div className="ai-proposal-alert danger">{controller.error}</div> : null}
          {emptyEntityUpdate ? (
            <div className="ai-proposal-alert danger">
              <strong>В этом черновике нечего применять</strong>
              <span>Изображение или изменения ещё не прикреплены. Если задача завершилась, проверь её результат в «Задачах AI»: там сохранена причина сбоя. Текущая карточка не изменена.</span>
            </div>
          ) : null}
          {isApplied ? <div className="ai-proposal-alert success"><strong>Изменения сохранены</strong><span>Карточка обновлена. При необходимости можно отменить применение.</span></div> : null}
          {proposal.status === "undone" ? <div className="ai-proposal-alert neutral">Применение отменено. Предыдущее содержимое восстановлено.</div> : null}
          {proposal.status === "rejected" ? <div className="ai-proposal-alert neutral">Черновик отклонён. Данные кампании не менялись.</div> : null}

          {tab === "diff" ? (
            <div className="stack">
              <div className="ai-proposal-review-intro"><strong>{isApplied ? "Сохранённое содержимое" : proposal.kind.endsWith("create") ? "Готово к добавлению" : "Предлагаемые изменения"}</strong><p>{isApplied ? "Ниже сохранённый результат и сравнение с версией до применения." : proposal.mediaIntents.length && proposal.diff.every((item) => /^\/?art(?:[./]|$)/.test(item.path)) ? "Замена изображения. Остальные поля карточки сохранятся." : "Проверь содержимое ниже. Независимые изменения в кампании сохраняются автоматически."}</p></div>
              <ProposalMedia controller={controller} proposal={proposal} />
              {proposal.kind.endsWith("create") ? <ProposalSnapshot campaign={proposal.kind === "campaign_create" ? campaignAfter : controller.proposalCampaign} campaignPreview={proposal.kind === "campaign_create"} campaignEntities={campaignEntities} entity={afterEntity} event={afterEvent} onSelectCampaignItem={setSelectedCampaignItemId} renderEntity={renderEntity} selectedCampaignItemId={selectedCampaignItemId} /> : <ProposalDiff proposal={proposal} campaign={controller.proposalCampaign} />}
            </div>
          ) : (
            <ProposalSnapshot
              campaign={proposal.kind === "campaign_create" && tab === "after" ? campaignAfter : controller.proposalCampaign}
              campaignPreview={proposal.kind === "campaign_create" && tab === "after"}
              campaignEntities={tab === "after" ? campaignEntities : []}
              entity={tab === "before" ? isPending && currentRecord ? normalizeProposalEntity(currentRecord) : beforeEntity : afterEntity}
              event={tab === "before" ? isPending && currentRecord ? normalizeProposalEvent(currentRecord) : beforeEvent : afterEvent}
              onSelectCampaignItem={setSelectedCampaignItemId}
              renderEntity={renderEntity}
              selectedCampaignItemId={selectedCampaignItemId}
            />
          )}

          {tab !== "diff" ? <ProposalMedia controller={controller} proposal={proposal} /> : null}
          <ProposalOperations proposal={proposal} selectedKeys={selectedOperationKeys} onToggle={toggleOperation} />
        </div>

        <footer className="ai-proposal-review-footer">
          <div>
            <small>Создан {formatProposalDate(proposal.createdAt)}</small>
            {isPending && proposal.expiresAt ? <small>Истекает {formatProposalDate(proposal.expiresAt)}</small> : null}
          </div>
          <div className="actions">
            {isPending ? (
              <>
                <button className="ghost danger-action" disabled={Boolean(controller.action)} onClick={() => void controller.rejectProposal()} type="button">
                  {controller.action === "reject" ? "Отклоняю…" : "Отклонить"}
                </button>
                <button
                  className="primary"
                  disabled={Boolean(controller.action) || emptyEntityUpdate || (proposal.kind === "campaign_create" && selectedOperationKeys.size === 0)}
                  onClick={() => void controller.applyProposal(selectedKeys)}
                  type="button"
                >
                  {controller.action === "apply" ? "Сохраняю изменения…" : emptyEntityUpdate ? "Нет готовых изменений" : proposal.mediaIntents.length && proposal.diff.every((item) => /^\/?art(?:[./]|$)/.test(item.path)) ? "Применить изображение" : "Применить изменения"}
                </button>
              </>
            ) : null}
            {isApplied ? (
              <button className="ghost" disabled={Boolean(controller.action)} onClick={() => void controller.undoProposal()} type="button">
                {controller.action === "undo" ? "Отменяю…" : "Отменить применение"}
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function AIProposalCenter({ campaignId, controller, renderEntity }: AIProposalCenterProps) {
  const modalOpen = Boolean(controller.inboxOpen || controller.selectedProposal || controller.promptTarget);
  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (controller.action) return;
        event.preventDefault();
        if (controller.promptTarget) controller.closePrompt();
        else if (controller.selectedProposal) controller.closeProposal();
        else controller.closeInbox();
      }
      if (event.key !== "Tab") return;
      const dialogs = document.querySelectorAll<HTMLElement>(".ai-proposal-overlay:not(.ai-proposal-hidden) [role='dialog']");
      const dialog = dialogs[dialogs.length - 1];
      const controls = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex='0']")).filter((element) => element.getClientRects().length) : [];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [modalOpen, controller.action, controller.promptTarget, controller.selectedProposal, controller.closePrompt, controller.closeProposal, controller.closeInbox]);
  return (
    <>
      <AIProposalInbox campaignId={campaignId} controller={controller} />
      <AIProposalPromptModal controller={controller} />
      <AIProposalReviewModal controller={controller} renderEntity={renderEntity} />
    </>
  );
}
