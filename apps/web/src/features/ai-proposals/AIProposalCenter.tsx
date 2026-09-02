import type { AIProposal, CampaignData, KnowledgeEntity, WorldEvent, WorldEventInput } from "@shadow-edge/shared-types";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EventsWorkspace } from "../../notes-events";
import { CampaignDashboard } from "../campaigns/CampaignDashboard";
import type { AIProposalController } from "./useAIProposalController";
import {
  buildSelectedBlueprintCampaign,
  campaignWithEntityCandidate,
  campaignWithEventCandidate,
  formatProposalDate,
  formatProposalValue,
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
  useEffect(() => {
    if (controller.inboxOpen && controller.codexPromptOutcome) {
      controller.setCodexPromptOutcome(null);
    }
  }, [controller.codexPromptOutcome, controller.inboxOpen, controller.setCodexPromptOutcome]);

  useEffect(() => {
    if (controller.inboxOpen) window.requestAnimationFrame(() => closeButtonRef.current?.focus());
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
            <p className="eyebrow">Безопасная очередь изменений</p>
            <h2>AI-черновики</h2>
            <p className="copy">
              {controller.codexPromptRunning
                ? "Codex готовит новый проверяемый черновик. Кампания в это время не изменяется."
                : "Предложения из сайта, Codex App Server и MCP. Ни одно из них ещё не изменило кампанию."}
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

        <div className="ai-proposal-inbox-list">
          {controller.proposals.length ? controller.proposals.map((proposal) => (
            <button
              className="ai-proposal-inbox-item"
              key={proposal.id}
              onClick={() => void controller.openProposal(proposal)}
              type="button"
            >
              <span className="ai-proposal-inbox-mark">✦</span>
              <span className="ai-proposal-inbox-copy">
                <small>{proposalKindLabels[proposal.kind]} · {proposalSourceLabel(proposal.source)}</small>
                <strong>{proposalTitle(proposal)}</strong>
                <span>{proposal.prompt}</span>
              </span>
              <span className="ai-proposal-inbox-meta">
                <b>{proposal.diff.length || proposal.operations.length}</b>
                <small>изменений</small>
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
              <strong>Очередь разобрана</strong>
              <p>Новых AI-предложений для этой кампании пока нет.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const noOp = () => undefined;

function ProductionEventPreview({ event, campaign }: { event: WorldEvent; campaign: CampaignData }) {
  return (
    <div className="ai-proposal-production-event">
      <EventsWorkspace
        draft={event as WorldEventInput}
        draftId={event.id}
        error=""
        events={campaign.events}
        generating={false}
        locations={campaign.locations}
        notice=""
        onAddBranch={noOp}
        onAddLoot={noOp}
        onBranchChange={noOp}
        onCreateEvent={noOp}
        onDelete={noOp}
        onDraftChange={noOp}
        onLootChange={noOp}
        onOpenGenerator={noOp}
        onOpenLocation={noOp}
        onRemoveBranch={noOp}
        onRemoveLoot={noOp}
        onSave={noOp}
        onSearchChange={noOp}
        onSelectEvent={noOp}
        readOnly
        saving={false}
        searchQuery=""
        selectedEventId={event.id}
      />
    </div>
  );
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

function ProposalDiff({ proposal }: { proposal: AIProposal }) {
  if (!proposal.diff.length) {
    return <div className="ai-proposal-empty"><span>≡</span><strong>Структурный черновик</strong><p>Изменения перечислены в операциях ниже.</p></div>;
  }
  return (
    <div className="ai-proposal-diff-list">
      {proposal.diff.map((item, index) => (
        <article className="ai-proposal-diff-row" key={`${item.path}-${index}`}>
          <code>{item.path}</code>
          <div>
            <small>Сейчас</small>
            <pre>{formatProposalValue(item.before)}</pre>
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
  return (
    <section className="ai-proposal-support-section">
      <header><strong>Изображения предложения</strong><small>Выбранные staged-файлы продвигаются только при применении</small></header>
      <div className="ai-proposal-media-grid">
        {proposal.mediaIntents.map((intent) => {
          const url = intent.finalUrl || intent.previewUrl;
          const selected = intent.selected !== false;
          return (
            <article className={`ai-proposal-media-card ${selected ? "selected" : "deselected"}`} key={intent.id}>
              {url ? <img alt={intent.alt || intent.caption || intent.purpose || "AI preview"} src={url} /> : <div className="ai-proposal-media-placeholder">✦</div>}
              <div>
                <strong>{intent.caption || intent.purpose || "Изображение"}</strong>
                <small>{intent.status} · {intent.field || "art.url"}{intent.operationKey ? ` · ${intent.operationKey}` : ""}</small>
                {intent.prompt ? <p>{intent.prompt}</p> : null}
                {proposal.status === "pending" ? (
                  <label className="ai-proposal-media-toggle">
                    <input
                      checked={selected}
                      disabled={controller.action === "media"}
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
  if (!proposal.operations.length) return null;
  return (
    <section className="ai-proposal-support-section">
      <header><strong>Операции применения</strong><small>Связи проверяются сервером перед одной атомарной записью</small></header>
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
              <small>{operation.action} · {operation.kind}{operation.dependsOn?.length ? ` · зависит от ${operation.dependsOn.join(", ")}` : ""}</small>
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
  const [tab, setTab] = useState<"before" | "after" | "diff">("after");
  const [selectedOperationKeys, setSelectedOperationKeys] = useState<Set<string>>(new Set());
  const [selectedCampaignItemId, setSelectedCampaignItemId] = useState("");

  useEffect(() => {
    if (!proposal) return;
    setTab(proposal.before ? "after" : "after");
    setSelectedOperationKeys(new Set(proposal.operations.map((operation) => operation.key)));
    const firstEntity = proposalCampaignEntities(proposal)[0];
    setSelectedCampaignItemId(firstEntity ? `entity:${firstEntity.id}` : "");
  }, [proposal?.id]);

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
  const hasApplicableChanges = proposal.diff.length > 0 || proposal.operations.length > 0 || hasSelectedStagedMedia;
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
            <p>{proposal.prompt}</p>
          </div>
          <button autoFocus className="ghost" disabled={Boolean(controller.action)} onClick={controller.closeProposal} type="button">К списку черновиков</button>
        </header>

        <div className="ai-proposal-review-tabs" role="tablist">
          <button aria-selected={tab === "before"} className={tab === "before" ? "active" : ""} onClick={() => setTab("before")} role="tab" type="button">Сейчас</button>
          <button aria-selected={tab === "after"} className={tab === "after" ? "active" : ""} onClick={() => setTab("after")} role="tab" type="button">После AI</button>
          <button aria-selected={tab === "diff"} className={tab === "diff" ? "active" : ""} onClick={() => setTab("diff")} role="tab" type="button">Что изменилось <span>{proposal.diff.length}</span></button>
        </div>

        <div className="ai-proposal-review-scroll">
          {proposal.warnings.length ? (
            <div className="ai-proposal-warning-list">
              {proposal.warnings.map((warning, index) => <div key={`${warning}-${index}`}>⚠ {warning}</div>)}
            </div>
          ) : null}
          {controller.conflict ? <div className="ai-proposal-alert danger"><strong>Конфликт ревизий</strong><span>{controller.conflict}</span></div> : null}
          {controller.error ? <div className="ai-proposal-alert danger">{controller.error}</div> : null}
          {emptyEntityUpdate ? (
            <div className="ai-proposal-alert danger">
              <strong>В этом черновике нечего применять</strong>
              <span>Изображение не было подготовлено. Отклони черновик и запусти генерацию ещё раз — ревизия карточки не изменится.</span>
            </div>
          ) : null}
          {isApplied ? <div className="ai-proposal-alert success"><strong>Изменения применены атомарно</strong><span>Создана новая ревизия. Отмена доступна, пока данные не были изменены ещё раз.</span></div> : null}
          {proposal.status === "undone" ? <div className="ai-proposal-alert neutral">Применение отменено новой ревизией; история сохранена.</div> : null}
          {proposal.status === "rejected" ? <div className="ai-proposal-alert neutral">Черновик отклонён. Данные кампании не менялись.</div> : null}

          {tab === "diff" ? (
            <ProposalDiff proposal={proposal} />
          ) : (
            <ProposalSnapshot
              campaign={proposal.kind === "campaign_create" && tab === "after" ? campaignAfter : controller.proposalCampaign}
              campaignPreview={proposal.kind === "campaign_create" && tab === "after"}
              campaignEntities={tab === "after" ? campaignEntities : []}
              entity={tab === "before" ? beforeEntity : afterEntity}
              event={tab === "before" ? beforeEvent : afterEvent}
              onSelectCampaignItem={setSelectedCampaignItemId}
              renderEntity={renderEntity}
              selectedCampaignItemId={selectedCampaignItemId}
            />
          )}

          <ProposalMedia controller={controller} proposal={proposal} />
          <ProposalOperations proposal={proposal} selectedKeys={selectedOperationKeys} onToggle={toggleOperation} />
        </div>

        <footer className="ai-proposal-review-footer">
          <div>
            <small>Создан {formatProposalDate(proposal.createdAt)}</small>
            {proposal.expiresAt ? <small>Истекает {formatProposalDate(proposal.expiresAt)}</small> : null}
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
                  {controller.action === "apply" ? "Проверяю ревизии и применяю…" : emptyEntityUpdate ? "Нет готовых изменений" : "Применить выбранное"}
                </button>
              </>
            ) : null}
            {isApplied ? (
              <button className="ghost" disabled={Boolean(controller.action)} onClick={() => void controller.undoProposal()} type="button">
                {controller.action === "undo" ? "Создаю отменяющую ревизию…" : "Отменить применение"}
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function AIProposalCenter({ campaignId, controller, renderEntity }: AIProposalCenterProps) {
  return (
    <>
      <AIProposalInbox campaignId={campaignId} controller={controller} />
      <AIProposalPromptModal controller={controller} />
      <AIProposalReviewModal controller={controller} renderEntity={renderEntity} />
    </>
  );
}
