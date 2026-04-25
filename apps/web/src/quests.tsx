import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CombatThresholds,
  KnowledgeEntity,
  LocationEntity,
  MonsterEntity,
  NpcEntity,
  PlayerEntity,
  PlayerFacingCard,
  QuestEntity,
  QuickFactTone
} from "@shadow-edge/shared-types";
import {
  badge,
  CollapsibleSection,
  createHeroPanelStyle,
  EntityVisual,
  gradients,
  rewardSummaryText,
  truncateInlineText
} from "./app-shared";
import {
  extractPlainTextFromPlayerFacingHTML,
  playerFacingPlainTextToHTML,
  sanitizePlayerFacingHTML
} from "./player-facing-rich";

type CombatProfileEntity = PlayerEntity | NpcEntity | MonsterEntity;

type QuestTextSection = {
  title: string;
  body: string[];
};

type QuestActionCard = {
  title: string;
  description: string;
  detail: string;
  tone: QuickFactTone;
};

type QuestChecklistItem = {
  key: string;
  label: string;
  done: boolean;
};

const summarizePlayerFacingCardPreview = (value?: string, maxItems = 4) => {
  const sections = parseQuestTextSections(value);
  const primarySection = sections.find((section) => section.body.length);
  const sectionLines = collectQuestSectionLines(primarySection, maxItems);
  return sectionLines.length ? sectionLines : splitQuestNarrative(value ?? "", maxItems);
};

export type QuestCombatEntrySummary = {
  entity: CombatProfileEntity;
  quantity: number;
};

export function PlayerFacingCardStrip({
  cards,
  createDescription,
  description,
  emptyDescription,
  entityId,
  onCreateCard,
  onEditCard,
  onOpenCard
}: {
  cards: PlayerFacingCard[];
  createDescription: string;
  description: string;
  emptyDescription: string;
  entityId: string;
  onCreateCard: () => void;
  onEditCard: (card: PlayerFacingCard, index: number) => void;
  onOpenCard: (card: PlayerFacingCard, index: number) => void;
}) {
  return (
    <CollapsibleSection
      action={<span className={badge(cards.length ? "success" : "default")}>{cards.length ? `${cards.length} карточек` : "Черновик нужен"}</span>}
      className="entity-player-facing-stack entity-player-facing-collapsible"
      hint={description}
      summary={
        <p className="copy entity-player-facing-summary">
          {cards.length
            ? `Секция скрыта. Внутри ${cards.length} ${cards.length === 1 ? "карточка" : cards.length < 5 ? "карточки" : "карточек"}.`
            : "Секция скрыта. Карточек пока нет."}
        </p>
      }
      title="Игроки видят"
    >
      <div className="entity-player-facing-grid">
        {cards.length ? (
          cards.map((card, index) => {
            const highlights = summarizePlayerFacingCardPreview(card.content, 4);
            const previewHtml = sanitizePlayerFacingHTML(card.contentHtml);

            return (
              <article
                key={`${entityId}-player-card-${index}`}
                className="card entity-player-facing-panel entity-player-facing-panel-compact"
              >
                <div className="quest-story-head">
                  <strong>{card.title}</strong>
                  <span className={badge("success")}>Player-safe</span>
                </div>

                <div className="entity-player-facing-preview">
                  {previewHtml ? (
                    <div
                      className="player-facing-rich entity-player-facing-rich-preview"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : highlights.length ? (
                    <ul className="quest-bullet-list">
                      {highlights.map((line, lineIndex) => (
                        <li key={`${entityId}-player-card-${index}-line-${lineIndex}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="copy">В этой карточке пока нет текста для показа игрокам.</p>
                  )}
                </div>

                <div className="entity-player-facing-actions">
                  <button className="ghost fill" onClick={() => onOpenCard(card, index)} type="button">
                    Открыть
                  </button>
                  <button className="ghost" onClick={() => onEditCard(card, index)} type="button">
                    Редактировать
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <article className="card entity-player-facing-panel entity-player-facing-panel-compact">
            <div className="quest-story-head">
              <strong>Карточек пока нет</strong>
              <span className={badge("default")}>0</span>
            </div>
            <p className="copy">{emptyDescription}</p>
          </article>
        )}

        <button
          className="card entity-player-facing-panel entity-player-facing-panel-compact entity-player-facing-panel-create"
          onClick={onCreateCard}
          type="button"
        >
          <span className="entity-player-facing-create-mark">+</span>
          <strong>Создать еще</strong>
          <p className="copy">{createDescription}</p>
        </button>
      </div>
    </CollapsibleSection>
  );
}

export type QuestLinkedEntity = {
  entity: KnowledgeEntity;
  label: string;
  tone: QuickFactTone;
  note?: string;
};

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripWikiMarkup = (value: string) =>
  value.replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_, targetTitle: string, label?: string) => label ?? targetTitle);

const normalizeQuestText = (value: string) =>
  stripWikiMarkup(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s*/gm, "")
    .trim();

const cleanQuestLine = (value: string) =>
  normalizeQuestText(value)
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

export const splitQuestNarrative = (value: string, maxItems = 5) =>
  normalizeQuestText(value)
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?:[.!?])\s+/u))
    .map((line) => cleanQuestLine(line))
    .filter(Boolean)
    .slice(0, maxItems);

export const parseQuestTextSections = (value?: string): QuestTextSection[] => {
  if (!value?.trim()) {
    return [];
  }

  const lines = value.replace(/\r/g, "").split("\n");
  const sections: QuestTextSection[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  const pushCurrent = () => {
    const body = currentBody.map((line) => line.trim()).filter(Boolean);
    if (currentTitle || body.length) {
      sections.push({
        title: cleanQuestLine(currentTitle || "Общее"),
        body
      });
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (/^#{1,6}\s+/.test(line)) {
      pushCurrent();
      currentTitle = line.replace(/^#{1,6}\s+/, "");
      currentBody = [];
      return;
    }

    currentBody.push(line);
  });

  pushCurrent();

  return sections;
};

const findQuestTextSection = (sections: QuestTextSection[], keywords: string[]) =>
  sections.find((section) => {
    const title = section.title.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  });

export const collectQuestSectionLines = (section?: QuestTextSection | null, maxItems = 5) => {
  if (!section) {
    return [];
  }

  return section.body
    .flatMap((line) =>
      /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) ? [cleanQuestLine(line)] : splitQuestNarrative(line, maxItems)
    )
    .filter(Boolean)
    .slice(0, maxItems);
};

const dedupeQuestLines = (lines: string[], maxItems = 5) => {
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
};

export const questStatusTone = (status: QuestEntity["status"]): QuickFactTone => {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "completed":
      return "accent";
    default:
      return "default";
  }
};

const questUrgencyTone = (urgency?: QuestEntity["urgency"]): QuickFactTone => {
  switch (urgency) {
    case "Critical":
      return "danger";
    case "High":
      return "warning";
    case "Medium":
      return "accent";
    case "Low":
      return "success";
    default:
      return "default";
  }
};

const actionToneFromText = (value: string): QuickFactTone => {
  const lower = value.toLowerCase();
  if (/(атак|бой|угроз|силой|оруж|удар)/.test(lower)) {
    return "danger";
  }
  if (/(осмотр|след|улики|проверк|поиск|замет)/.test(lower)) {
    return "accent";
  }
  if (/(скрыт|подкра|тихо|развед|обойти)/.test(lower)) {
    return "warning";
  }
  return "success";
};

const actionDetailFromText = (value: string) => {
  const lower = value.toLowerCase();
  if (/(поговор|спрос|убеж|соц|допрос)/.test(lower)) {
    return "Социально";
  }
  if (/(маг|заклин|чары|ритуал)/.test(lower)) {
    return "Магия";
  }
  if (/(осмотр|след|улики|проверк|воспр|анализ)/.test(lower)) {
    return "Наблюдение";
  }
  if (/(скрыт|подкра|тихо|развед|обойти)/.test(lower)) {
    return "Скрытность";
  }
  if (/(атак|бой|сил|угроз|оруж)/.test(lower)) {
    return "Силовое решение";
  }
  return "Свободный ход";
};

const buildQuestActionCards = ({
  quest,
  playerSections,
  location,
  issuer,
  preparedCombatEntries
}: {
  quest: QuestEntity;
  playerSections: QuestTextSection[];
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  preparedCombatEntries: QuestCombatEntrySummary[];
}): QuestActionCard[] => {
  const actionSection = findQuestTextSection(playerSections, ["что вы можете", "возможные действия", "действия игроков"]);
  const explicitActions = collectQuestSectionLines(actionSection, 6).map((line, index) => {
    const match = line.match(/^([^:.-]{2,48})[:.-]\s*(.+)$/);
    const title = cleanQuestLine(match?.[1] ?? `Ход ${index + 1}`);
    const description = cleanQuestLine(match?.[2] ?? line);
    const source = `${title} ${description}`;

    return {
      title,
      description,
      detail: actionDetailFromText(source),
      tone: actionToneFromText(source)
    };
  });

  if (explicitActions.length) {
    return explicitActions.slice(0, 4);
  }

  const fallback: QuestActionCard[] = [];

  if (issuer) {
    fallback.push({
      title: "Поговорить",
      description: `Расспросить ${issuer.title} о мотивах, маршруте и том, что здесь пошло не так.`,
      detail: "Социально",
      tone: "success"
    });
  }

  if (location) {
    fallback.push({
      title: "Осмотреть место",
      description: `Проверить ${location.title} и собрать улики, пока сцена не успела сменить темп.`,
      detail: "Наблюдение",
      tone: "accent"
    });
  }

  fallback.push({
    title: "Проверить подвох",
    description: "Сверить детали, отследить противоречия и понять, где именно сцена может сорваться.",
    detail: "Проверка",
    tone: "warning"
  });

  if (preparedCombatEntries.length) {
    fallback.push({
      title: "Вступить в бой",
      description: `Если переговоры провалятся, сцена может перейти в столкновение с ${preparedCombatEntries.reduce(
        (sum, item) => sum + item.quantity,
        0
      )} противниками.`,
      detail: "Силовое решение",
      tone: "danger"
    });
  }

  if (quest.rewardProfile?.summary.trim()) {
    fallback.push({
      title: "Торговаться",
      description: truncateInlineText(cleanQuestLine(quest.rewardProfile.summary), 110),
      detail: "Ставка",
      tone: "accent"
    });
  }

  return fallback.slice(0, 4);
};

const buildQuestChecklistItems = ({
  quest,
  location,
  issuer,
  preparedCombatEntries
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  preparedCombatEntries: QuestCombatEntrySummary[];
}): QuestChecklistItem[] => [
  {
    key: "players",
    label: quest.playerCards?.length || quest.playerContent?.trim() ? "Версия для игроков подготовлена" : "Подготовить версию для игроков",
    done: Boolean(quest.playerCards?.length || quest.playerContent?.trim())
  },
  {
    key: "issuer",
    label: issuer ? `Ввести в сцену ${issuer.title}` : "Определить квестодателя",
    done: Boolean(issuer)
  },
  {
    key: "location",
    label: location ? `Собрать сцену в ${location.title}` : "Привязать сцену к локации",
    done: Boolean(location)
  },
  {
    key: "combat",
    label: preparedCombatEntries.length ? "Заготовленный бой готов" : "Собрать возможный бой",
    done: preparedCombatEntries.length > 0
  },
  {
    key: "rewards",
    label: rewardSummaryText(quest.rewardProfile) ? "Награды и последствия описаны" : "Прописать награды и последствия",
    done: Boolean(rewardSummaryText(quest.rewardProfile))
  },
  {
    key: "followup",
    label: quest.related.length ? "Следующие связи сцены отмечены" : "Добавить продолжение и связи",
    done: quest.related.length > 0
  }
];

const buildQuestObjectiveLines = ({
  quest,
  location,
  issuer,
  preparedCombatEntries,
  relatedQuests
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  preparedCombatEntries: QuestCombatEntrySummary[];
  relatedQuests: QuestEntity[];
}) => {
  const lines = [
    quest.summary.trim(),
    location ? `Локация сцены: ${location.title}.` : "",
    issuer ? `Квест ведёт ${issuer.title}.` : "",
    quest.urgency ? `Срочность: ${quest.urgency}.` : "",
    preparedCombatEntries.length
      ? `В резерве ${preparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0)} противников, если сцена сорвётся в бой.`
      : "Сцена пока не привязана к отдельному бою и может решиться разговором, осмотром или обходным ходом.",
    rewardSummaryText(quest.rewardProfile) ? `Ставка: ${cleanQuestLine(rewardSummaryText(quest.rewardProfile) ?? "")}.` : "",
    relatedQuests.length ? `${relatedQuests.length} соседних квестовых нитей уже связаны с этой сценой.` : ""
  ].filter(Boolean);

  return dedupeQuestLines(lines.map((line) => cleanQuestLine(line)), 5);
};

const createGeneratedQuestSceneBackdrop = (quest: QuestEntity, location: LocationEntity | null) => {
  const accent =
    quest.urgency === "Critical"
      ? "#f0937d"
      : quest.urgency === "High"
        ? "#e6c07d"
        : quest.urgency === "Medium"
          ? "#8ea7ff"
          : "#7ed6a1";
  const safeTitle = escapeSvgText(quest.title);
  const safeLocation = escapeSvgText(location?.title ?? quest.subtitle ?? "Quest dossier");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0e1624"/>
          <stop offset="55%" stop-color="#111c2f"/>
          <stop offset="100%" stop-color="#060a11"/>
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#11161d"/>
          <stop offset="100%" stop-color="#05070b"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="720" fill="url(#sky)"/>
      <circle cx="1180" cy="150" r="120" fill="rgba(146,179,255,0.12)"/>
      <circle cx="1180" cy="150" r="58" fill="rgba(255,255,255,0.14)"/>
      <path d="M0 430 C180 360 340 370 520 420 C660 458 760 430 900 390 C1060 344 1220 336 1600 420 L1600 720 L0 720 Z" fill="rgba(16,20,29,0.88)"/>
      <path d="M0 520 C140 468 280 470 430 520 C600 575 760 560 920 514 C1080 468 1260 462 1600 540 L1600 720 L0 720 Z" fill="url(#ground)"/>
      <path d="M1060 330 L1105 230 L1148 330 Z" fill="rgba(32,39,52,0.82)"/>
      <path d="M1110 330 L1164 190 L1220 330 Z" fill="rgba(26,33,44,0.9)"/>
      <path d="M1180 330 L1230 215 L1280 330 Z" fill="rgba(32,39,52,0.82)"/>
      <rect x="1122" y="330" width="126" height="98" rx="8" fill="rgba(18,22,30,0.92)"/>
      <rect x="1172" y="360" width="28" height="48" rx="4" fill="rgba(255,214,136,0.72)"/>
      <path d="M320 520 C412 436 504 426 604 466 C686 500 744 496 820 462" fill="none" stroke="rgba(184,155,102,0.22)" stroke-width="34" stroke-linecap="round"/>
      <path d="M280 502 C362 422 462 412 560 452" fill="none" stroke="rgba(0,0,0,0.26)" stroke-width="6" stroke-linecap="round"/>
      <g fill="rgba(14,18,24,0.92)">
        <path d="M314 466 l40 -70 l42 70 z"/>
        <path d="M354 470 l48 -86 l52 86 z"/>
        <path d="M402 470 l40 -72 l44 72 z"/>
        <path d="M1240 470 l36 -66 l38 66 z"/>
        <path d="M1270 472 l48 -92 l52 92 z"/>
        <path d="M1322 472 l36 -66 l40 66 z"/>
      </g>
      <rect x="84" y="70" width="340" height="36" rx="18" fill="rgba(18,23,33,0.62)" stroke="rgba(255,255,255,0.06)"/>
      <text x="112" y="95" fill="rgba(235,241,255,0.72)" font-family="Segoe UI, Arial, sans-serif" font-size="20" letter-spacing="3">${safeLocation}</text>
      <text x="84" y="618" fill="rgba(243,246,255,0.95)" font-family="Georgia, serif" font-size="66" font-weight="700">${safeTitle}</text>
      <text x="84" y="664" fill="${accent}" font-family="Segoe UI, Arial, sans-serif" font-size="24">Scene preview</text>
      <rect x="0" y="0" width="1600" height="720" fill="rgba(4,7,12,0.14)"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const resolveQuestSceneArtwork = (
  quest: QuestEntity,
  location: LocationEntity | null,
  issuer: NpcEntity | null,
  preparedCombatEntries: QuestCombatEntrySummary[] = []
) =>
  quest.art?.url ||
  location?.art?.url ||
  issuer?.art?.url ||
  preparedCombatEntries.find((item) => item.entity.art?.url)?.entity.art?.url ||
  createGeneratedQuestSceneBackdrop(quest, location);

function QuestMetaPill({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: QuickFactTone;
}) {
  return (
    <div className={`quest-meta-pill quest-tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuestEntityChip({
  entity,
  label,
  tone = "default",
  onOpen
}: {
  entity: KnowledgeEntity;
  label: string;
  tone?: QuickFactTone;
  onOpen: (id: string) => void;
}) {
  return (
    <button className={`quest-entity-chip quest-tone-${tone}`} onClick={() => onOpen(entity.id)} type="button">
      <small>{label}</small>
      <strong>{entity.title}</strong>
    </button>
  );
}

function QuestPreviewActionButton({
  label,
  hint,
  tone = "default",
  disabled = false,
  onClick
}: {
  label: string;
  hint: string;
  tone?: QuickFactTone;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`quest-preview-action quest-tone-${tone}`} disabled={disabled} onClick={onClick} type="button">
      <strong>{label}</strong>
      <span>{hint}</span>
    </button>
  );
}

function QuestPreviewEntityCard({
  item,
  onOpen
}: {
  item: QuestLinkedEntity;
  onOpen: (id: string) => void;
}) {
  return (
    <button className="quest-preview-entity" onClick={() => onOpen(item.entity.id)} type="button">
      <EntityVisual entity={item.entity} />
      <span className="quest-preview-entity-copy">
        <small>{item.label}</small>
        <strong>{item.entity.title}</strong>
        <span>{item.note || item.entity.subtitle || item.entity.summary}</span>
      </span>
    </button>
  );
}

export function QuestWorkspace({
  quest,
  location,
  issuer,
  playerCards,
  linkedEntities,
  relatedQuests,
  playlistActive,
  playlistTrackLabel,
  preparedCombatEntries,
  previousQuest,
  nextQuest,
  pinned,
  onCreatePlayerCard,
  onEdit,
  onEditPlayerCard,
  onTogglePin,
  onOpenDirectory,
  onOpenPlayerCard,
  onOpenEntity,
  onOpenPlaylist,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onOpenQuest
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  playerCards: PlayerFacingCard[];
  linkedEntities: QuestLinkedEntity[];
  relatedQuests: QuestEntity[];
  playlistActive: boolean;
  playlistTrackLabel?: string;
  preparedCombatEntries: QuestCombatEntrySummary[];
  previousQuest: QuestEntity | null;
  nextQuest: QuestEntity | null;
  pinned: boolean;
  onCreatePlayerCard: () => void;
  onEdit: (id: string) => void;
  onEditPlayerCard: (card: PlayerFacingCard, index: number) => void;
  onTogglePin: (id: string) => void;
  onOpenDirectory: () => void;
  onOpenPlayerCard: (card: PlayerFacingCard, index: number) => void;
  onOpenEntity: (id: string) => void;
  onOpenPlaylist: (quest: QuestEntity) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: () => void;
  onOpenQuest: (id: string) => void;
}) {
  const playerSections = useMemo(() => parseQuestTextSections(quest.playerContent), [quest.playerContent]);
  const gmSections = useMemo(() => parseQuestTextSections(quest.content), [quest.content]);
  const sceneImage = useMemo(
    () => resolveQuestSceneArtwork(quest, location, issuer, preparedCombatEntries),
    [issuer, location, preparedCombatEntries, quest]
  );
  const hiddenHighlights = useMemo(() => {
    const prioritized = [
      ...collectQuestSectionLines(findQuestTextSection(gmSections, ["на самом деле", "что происходит", "скрыто", "правда"]), 5),
      ...collectQuestSectionLines(findQuestTextSection(gmSections, ["опасность", "угроза", "засада"]), 3)
    ];
    return prioritized.length ? dedupeQuestLines(prioritized, 5) : splitQuestNarrative(quest.content, 5);
  }, [gmSections, quest.content]);
  const objectiveLines = useMemo(
    () =>
      buildQuestObjectiveLines({
        quest,
        location,
        issuer,
        preparedCombatEntries,
        relatedQuests
      }),
    [issuer, location, preparedCombatEntries, quest, relatedQuests]
  );
  const actionCards = useMemo(
    () =>
      buildQuestActionCards({
        quest,
        playerSections,
        location,
        issuer,
        preparedCombatEntries
      }),
    [issuer, location, playerSections, preparedCombatEntries, quest]
  );
  const checklistItems = useMemo(
    () =>
      buildQuestChecklistItems({
        quest,
        location,
        issuer,
        preparedCombatEntries
      }),
    [issuer, location, preparedCombatEntries, quest]
  );
  const rewardItems = quest.rewardProfile?.loot ?? [];
  const playerVisible = Boolean(playerCards.length || quest.playerContent?.trim());
  const preparedCombatCount = preparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0);
  const heroLinkedEntities = linkedEntities.slice(0, 4);
  const sceneLead =
    collectQuestSectionLines(findQuestTextSection(playerSections, ["что происходит", "суть", "контекст"]), 1)[0] ??
    quest.summary;

  return (
    <div className="quest-shell">
      <section className="card quest-hero-panel">
        <div className="quest-hero-top">
          <div className="quest-breadcrumbs">
            <button className="quest-breadcrumb-btn" onClick={onOpenDirectory} type="button">
              Квесты
            </button>
            <span>/</span>
            <strong>{quest.title}</strong>
          </div>

          <div className="quest-nav-buttons">
            <button className="ghost quest-nav-btn" disabled={!previousQuest} onClick={() => previousQuest && onOpenQuest(previousQuest.id)} type="button">
              Предыдущий
            </button>
            <button className="ghost quest-nav-btn" disabled={!nextQuest} onClick={() => nextQuest && onOpenQuest(nextQuest.id)} type="button">
              Следующий
            </button>
          </div>
        </div>

        <div className="quest-hero-main">
          <div className="quest-hero-copy">
            <div className="quest-title-row">
              <h1>{quest.title}</h1>
              <span className={badge("warning")}>Квест</span>
            </div>
            <p className="quest-hero-summary">{quest.summary}</p>
            <p className="quest-hero-subtitle">{quest.subtitle}</p>

            {heroLinkedEntities.length ? (
              <div className="quest-anchor-row">
                {heroLinkedEntities.map((item) => (
                  <QuestEntityChip key={`${quest.id}-hero-link-${item.entity.id}`} entity={item.entity} label={item.label} onOpen={onOpenEntity} tone={item.tone} />
                ))}
              </div>
            ) : null}
          </div>

          <div className="quest-hero-actions">
            <button className="ghost" onClick={() => onEdit(quest.id)} type="button">
              Редактировать
            </button>
            <button className="ghost" disabled={!playerCards.length} onClick={() => playerCards[0] && onOpenPlayerCard(playerCards[0], 0)} type="button">
              Показать игрокам
            </button>
            <button className={pinned ? "primary" : "ghost"} onClick={() => onTogglePin(quest.id)} type="button">
              {pinned ? "Закреплено" : "Закрепить"}
            </button>
          </div>
        </div>

        <div className="quest-status-grid">
          <QuestMetaPill label="Статус" tone={questStatusTone(quest.status)} value={quest.status} />
          <QuestMetaPill label="Срочность" tone={questUrgencyTone(quest.urgency)} value={quest.urgency} />
          <QuestMetaPill label="Игроки" tone={playerVisible ? "success" : "warning"} value={playerVisible ? "Есть версия" : "Не заполнено"} />
          <QuestMetaPill label="Бой" tone={preparedCombatCount ? "danger" : "default"} value={preparedCombatCount ? `${preparedCombatCount} в сцене` : "Не настроен"} />
          <QuestMetaPill
            label="Награда"
            tone={rewardSummaryText(quest.rewardProfile) ? "success" : "default"}
            value={rewardSummaryText(quest.rewardProfile) || "Не заполнена"}
          />
        </div>
      </section>

      <section className="card quest-scene-spotlight">
        <div className="quest-scene-copy">
          <span className="quest-scene-label">Суть сцены</span>
          <strong>{findQuestTextSection(playerSections, ["что происходит", "суть"])?.title || "Фокус текущего эпизода"}</strong>
          <p>{sceneLead}</p>
          <div className="quest-scene-inline-meta">
            {location ? <span>{location.title}</span> : null}
            {issuer ? <span>{issuer.title}</span> : null}
            {preparedCombatCount ? <span>{preparedCombatCount} противников в резерве</span> : null}
          </div>
        </div>

        <div className="quest-scene-visual">
          <img alt={quest.title} className="quest-scene-image" loading="lazy" src={sceneImage} />
        </div>
      </section>

      <PlayerFacingCardStrip
        cards={playerCards}
        createDescription="Новая handout-карточка, сцена или отдельный player-safe фрагмент для этого квеста."
        description="Отдельные карточки-сцены для игроков: вводная, речь квестодателя, записка, отдельная улика или развилка."
        emptyDescription="Пока карточек нет. Создай первую, чтобы открывать нужный текст игрокам по одной карточке, без длинной общей простыни."
        entityId={quest.id}
        onCreateCard={onCreatePlayerCard}
        onEditCard={onEditPlayerCard}
        onOpenCard={onOpenPlayerCard}
      />

      <div className="quest-story-grid">
        <article className="card quest-story-card quest-story-card-hidden">
          <div className="quest-story-head">
            <strong>Скрыто от игроков</strong>
            <span className={badge("warning")}>GM only</span>
          </div>

          {hiddenHighlights.length ? (
            <ul className="quest-bullet-list">
              {hiddenHighlights.map((line) => (
                <li key={`${quest.id}-hidden-${line}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="copy">GM-заметки пока не заполнены.</p>
          )}
        </article>

        <article className="card quest-story-card quest-story-card-goal">
          <div className="quest-story-head">
            <strong>Цель сцены</strong>
            <span className={badge("accent")}>Фокус мастера</span>
          </div>

          <ul className="quest-bullet-list">
            {objectiveLines.map((line) => (
              <li key={`${quest.id}-goal-${line}`}>{line}</li>
            ))}
          </ul>

          {relatedQuests.length ? (
            <div className="quest-inline-links">
              {relatedQuests.slice(0, 2).map((item) => (
                <button key={`${quest.id}-inline-related-${item.id}`} className="ghost" onClick={() => onOpenQuest(item.id)} type="button">
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="card quest-story-card quest-story-card-playlist">
          <div className="quest-story-head">
            <strong>Плейлист сцены</strong>
            <span className={badge(playlistActive ? "accent" : quest.playlist?.length ? "success" : "default")}>
              {playlistActive ? "Играет" : quest.playlist?.length ? `${quest.playlist.length} треков` : "Пусто"}
            </span>
          </div>

          <p className="copy quest-story-note">
            {quest.playlist?.length
              ? playlistActive && playlistTrackLabel
                ? `Сейчас играет: ${playlistTrackLabel}. Можно быстро переключить или открыть редактор плейлиста.`
                : `В квесте подготовлено ${quest.playlist.length} треков. Запусти случайный трек или подправь список отдельно.`
              : "У этого квеста пока нет своего плейлиста. Его можно открыть и настроить отдельно, не заходя в общий редактор."}
          </p>

          <div className="quest-story-actions">
            <button className="ghost fill" onClick={() => onOpenPlaylist(quest)} type="button">
              Настроить
            </button>
            {quest.playlist?.length ? (
              <button className="ghost" onClick={playlistActive ? onPlayNextPlaylistTrack : onPlayPlaylist} type="button">
                {playlistActive ? "Следующий трек" : "Случайный трек"}
              </button>
            ) : null}
          </div>
        </article>
      </div>

      <section className="card quest-action-section">
        <div className="row">
          <strong>Возможные действия игроков</strong>
          <small>{actionCards.length} направления сцены</small>
        </div>

        <div className="quest-action-grid">
          {actionCards.map((action) => (
            <article key={`${quest.id}-${action.title}`} className={`quest-action-card quest-tone-${action.tone}`}>
              <span>{action.detail}</span>
              <strong>{action.title}</strong>
              <p>{action.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card quest-checklist-section">
        <div className="row">
          <strong>Чек-лист мастера</strong>
          <small>
            {checklistItems.filter((item) => item.done).length}/{checklistItems.length} готово
          </small>
        </div>

        <div className="quest-checklist-grid">
          {checklistItems.map((item) => (
            <label key={`${quest.id}-${item.key}`} className={`quest-checklist-item ${item.done ? "done" : ""}`}>
              <input defaultChecked={item.done} type="checkbox" />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card quest-reward-section">
        <div className="row">
          <strong>Награды и ставка</strong>
          <small>{rewardItems.length ? `${rewardItems.length} позиций` : "Награды пока не заданы"}</small>
        </div>

        {quest.rewardProfile?.summary.trim() ? <p className="copy quest-reward-summary">{quest.rewardProfile.summary.trim()}</p> : null}

        {rewardItems.length ? (
          <div className="quest-reward-grid">
            {rewardItems.slice(0, 4).map((item, index) => (
              <article key={`${quest.id}-reward-${item.name}-${index}`} className="quest-reward-card">
                <span>{item.category}</span>
                <strong>{item.name}</strong>
                <p>{item.quantity}</p>
                <small>
                  {item.check}
                  {item.dc ? ` • ${item.dc}` : ""}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="quest-empty-state">
            Здесь пока пусто. Когда заполнишь награды в редакторе, они появятся в этом компактном блоке.
          </p>
        )}
      </section>
    </div>
  );
}

export function QuestPreviewPanel({
  quest,
  location,
  issuer,
  linkedEntities,
  relatedQuests,
  preparedCombatEntries,
  pinned,
  hasActiveCombat,
  combatPartyLevelsText,
  combatPartySummary,
  hasExplicitPartyLevels,
  effectiveCombatThresholds,
  onTogglePin,
  onRunCombat,
  onOpenRandomEvent,
  onOpenPlayerView,
  onEdit,
  onOpenEntity,
  onOpenQuest,
  onOpenPlaylist,
  onOpenGallery,
  onCombatPartyLevelsChange
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  linkedEntities: QuestLinkedEntity[];
  relatedQuests: QuestEntity[];
  preparedCombatEntries: QuestCombatEntrySummary[];
  pinned: boolean;
  hasActiveCombat: boolean;
  combatPartyLevelsText: string;
  combatPartySummary: string;
  hasExplicitPartyLevels: boolean;
  effectiveCombatThresholds: CombatThresholds;
  onTogglePin: (id: string) => void;
  onRunCombat: (quest: QuestEntity) => void;
  onOpenRandomEvent: () => void;
  onOpenPlayerView: (quest: QuestEntity) => void;
  onEdit: (id: string) => void;
  onOpenEntity: (id: string) => void;
  onOpenQuest: (id: string) => void;
  onOpenPlaylist: (quest: QuestEntity) => void;
  onOpenGallery: (quest: QuestEntity) => void;
  onCombatPartyLevelsChange: (value: string) => void;
}) {
  const sceneImage = useMemo(
    () => resolveQuestSceneArtwork(quest, location, issuer, preparedCombatEntries),
    [issuer, location, preparedCombatEntries, quest]
  );
  const preparedCombatCount = preparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0);
  const participants = useMemo(() => {
    const nextItems: Array<{ key: string; title: string; note: string; tone: QuickFactTone; quantity?: number; id: string }> = [];

    if (issuer) {
      nextItems.push({
        key: `issuer-${issuer.id}`,
        id: issuer.id,
        title: issuer.title,
        note: issuer.role || "Квестодатель",
        tone: "accent"
      });
    }

    preparedCombatEntries.forEach((item) => {
      nextItems.push({
        key: `combat-${item.entity.id}`,
        id: item.entity.id,
        title: item.entity.title,
        note: item.entity.kind === "monster" ? "Противник" : "Участник сцены",
        tone: item.entity.kind === "monster" ? "danger" : "warning",
        quantity: item.quantity
      });
    });

    if (!nextItems.length) {
      linkedEntities
        .filter((item) => item.entity.kind === "npc" || item.entity.kind === "monster")
        .slice(0, 4)
        .forEach((item) => {
          nextItems.push({
            key: `linked-${item.entity.id}`,
            id: item.entity.id,
            title: item.entity.title,
            note: item.note || item.label,
            tone: item.tone
          });
        });
    }

    return nextItems.slice(0, 6);
  }, [issuer, linkedEntities, preparedCombatEntries]);
  const hasPlayerFacingVersion = Boolean(quest.playerCards?.length || quest.playerContent?.trim());
  const combatPrimaryLabel = hasActiveCombat ? "Открыть бой" : preparedCombatCount ? "Начать бой" : "Настроить бой";
  const combatPrimaryHint = hasActiveCombat
    ? "Сейчас уже идёт активная сцена"
    : preparedCombatCount
      ? `${preparedCombatCount} противников готовы`
      : "Собрать сцену перед запуском";

  return (
    <div className="quest-preview-shell">
      <div className="row">
        <p className="eyebrow">Peek / Preview</p>
        <button className={`quest-pin-toggle ${pinned ? "active" : ""}`} onClick={() => onTogglePin(quest.id)} type="button">
          {pinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <section className="quest-preview-hero" style={createHeroPanelStyle(gradients.quest, sceneImage)}>
        <span>Квест</span>
        <strong>{quest.title}</strong>
        <small>{quest.summary}</small>
      </section>

      {linkedEntities.length ? (
        <section className="quest-preview-section">
          <div className="row">
            <strong>Закреплённые сущности</strong>
            <small>{linkedEntities.length}</small>
          </div>
          <div className="quest-preview-entity-grid">
            {linkedEntities.slice(0, 4).map((item) => (
              <QuestPreviewEntityCard key={`${quest.id}-preview-link-${item.entity.id}`} item={item} onOpen={onOpenEntity} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="quest-preview-section">
        <div className="row">
          <strong>Быстрые действия</strong>
          <small>{preparedCombatCount ? "Сцена готова к запуску" : "Можно добрать настройку"}</small>
        </div>

        <div className="quest-preview-action-grid">
          <QuestPreviewActionButton hint={combatPrimaryHint} label={combatPrimaryLabel} onClick={() => onRunCombat(quest)} tone="danger" />
          <QuestPreviewActionButton hint="Подбросить поворот прямо в текущую сцену" label="Случайное событие" onClick={onOpenRandomEvent} tone="warning" />
          <QuestPreviewActionButton
            disabled={!hasPlayerFacingVersion}
            hint={hasPlayerFacingVersion ? "Открыть версию для игроков" : "Отдельная версия не заполнена"}
            label="Показать игрокам"
            onClick={() => onOpenPlayerView(quest)}
            tone="accent"
          />
          <QuestPreviewActionButton hint="Исправить текст, связи и награды" label="Редактировать" onClick={() => onEdit(quest.id)} tone="success" />
        </div>

        {preparedCombatCount ? (
          <div className="quest-preview-combat-settings">
            <label className="field">
              <span>Уровни группы</span>
              <input
                className="input"
                onChange={(event) => onCombatPartyLevelsChange(event.target.value)}
                placeholder="4,4,4,4"
                value={combatPartyLevelsText}
              />
            </label>
            <p className="copy quest-preview-note">{combatPartySummary}</p>
            {!hasExplicitPartyLevels ? (
              <p className="copy quest-preview-note">
                Пороги: Easy {effectiveCombatThresholds.easy} • Medium {effectiveCombatThresholds.medium} • Hard{" "}
                {effectiveCombatThresholds.hard} • Deadly {effectiveCombatThresholds.deadly}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="quest-preview-section">
        <div className="row">
          <strong>Участники сцены</strong>
          <small>{participants.length}</small>
        </div>

        {participants.length ? (
          <div className="quest-preview-list">
            {participants.map((item) => (
              <button key={item.key} className={`quest-preview-list-item quest-tone-${item.tone}`} onClick={() => onOpenEntity(item.id)} type="button">
                <span className="quest-preview-list-copy">
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </span>
                {item.quantity ? <span className="quest-preview-list-badge">x{item.quantity}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="quest-empty-state">Пока отдельные участники сцены не отмечены.</p>
        )}
      </section>

      {location ? (
        <section className="quest-preview-section">
          <div className="row">
            <strong>Связанная локация</strong>
            <small>1</small>
          </div>
          <QuestPreviewEntityCard
            item={{
              entity: location,
              label: "Локация",
              tone: "accent",
              note: location.summary
            }}
            onOpen={onOpenEntity}
          />
        </section>
      ) : null}

      {relatedQuests.length ? (
        <section className="quest-preview-section">
          <div className="row">
            <strong>Связанные квесты</strong>
            <small>{relatedQuests.length}</small>
          </div>
          <div className="quest-preview-list">
            {relatedQuests.slice(0, 3).map((item) => (
              <button key={`${quest.id}-related-preview-${item.id}`} className="quest-preview-list-item quest-tone-warning" onClick={() => onOpenQuest(item.id)} type="button">
                <span className="quest-preview-list-copy">
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {quest.tags.length ? (
        <section className="quest-preview-section">
          <strong>Метки</strong>
          <div className="quest-tag-list">
            {quest.tags.map((tag) => (
              <span key={`${quest.id}-tag-${tag}`} className="quest-tag">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="quest-preview-footer">
        {quest.playlist?.length ? (
          <button className="ghost" onClick={() => onOpenPlaylist(quest)} type="button">
            Плейлист
          </button>
        ) : null}
        {quest.gallery?.length ? (
          <button className="ghost" onClick={() => onOpenGallery(quest)} type="button">
            Галерея
          </button>
        ) : null}
        <button className="primary" onClick={() => onOpenQuest(quest.id)} type="button">
          Открыть полностью
        </button>
      </div>
    </div>
  );
}

type PlayerFacingEntityModalProps = {
  content?: string;
  contentHtml?: string;
  editable?: boolean;
  editMode?: boolean;
  entity: KnowledgeEntity;
  formatting?: boolean;
  isNew?: boolean;
  onAutoFormat?: (card: PlayerFacingCard) => Promise<PlayerFacingCard | void>;
  onCancelEdit?: () => void;
  onClose: () => void;
  onEnterEdit?: () => void;
  onSave?: (card: PlayerFacingCard) => void | Promise<void>;
  saving?: boolean;
  title?: string;
};

export function PlayerFacingEntityModal({
  content,
  contentHtml,
  editable = false,
  editMode = false,
  entity,
  formatting = false,
  isNew = false,
  onAutoFormat,
  onCancelEdit,
  onClose,
  onEnterEdit,
  onSave,
  saving = false,
  title
}: PlayerFacingEntityModalProps) {
  const resolvedContent = content ?? entity.playerContent ?? "";
  const resolvedTitle = title?.trim() || entity.title;
  const resolvedContentHtml = useMemo(() => sanitizePlayerFacingHTML(contentHtml), [contentHtml]);
  const sections = useMemo(() => parseQuestTextSections(resolvedContent), [resolvedContent]);
  const fallbackLines = useMemo(() => splitQuestNarrative(resolvedContent, 8), [resolvedContent]);
  const initialEditableHtml = useMemo(
    () => resolvedContentHtml || playerFacingPlainTextToHTML(resolvedContent),
    [resolvedContent, resolvedContentHtml]
  );
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [draftTitle, setDraftTitle] = useState(resolvedTitle);
  const [draftContent, setDraftContent] = useState(resolvedContent);
  const [draftContentHtml, setDraftContentHtml] = useState(initialEditableHtml);

  useEffect(() => {
    setDraftTitle(resolvedTitle);
    setDraftContent(resolvedContent);
    setDraftContentHtml(initialEditableHtml);
  }, [initialEditableHtml, resolvedContent, resolvedTitle]);

  useEffect(() => {
    if (!editMode || !editorRef.current) {
      return;
    }

    const nextHtml = draftContentHtml || playerFacingPlainTextToHTML(draftContent) || "<p></p>";
    if (editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [draftContent, draftContentHtml, editMode]);

  const readDraftCard = (): PlayerFacingCard => {
    const liveHtml = editMode && editorRef.current ? sanitizePlayerFacingHTML(editorRef.current.innerHTML) : sanitizePlayerFacingHTML(draftContentHtml);
    const normalizedHtml = liveHtml || (draftContent.trim() ? playerFacingPlainTextToHTML(draftContent) : "");
    const normalizedContent = draftContent.trim() || extractPlainTextFromPlayerFacingHTML(normalizedHtml);

    return {
      title: draftTitle.trim(),
      content: normalizedContent,
      contentHtml: normalizedHtml || undefined
    };
  };

  const syncDraftCard = (card: PlayerFacingCard) => {
    const normalizedHtml = sanitizePlayerFacingHTML(card.contentHtml) || playerFacingPlainTextToHTML(card.content);
    const normalizedContent = card.content.trim() || extractPlainTextFromPlayerFacingHTML(normalizedHtml);
    setDraftTitle(card.title);
    setDraftContent(normalizedContent);
    setDraftContentHtml(normalizedHtml);
  };

  const initialDraftCard = useMemo<PlayerFacingCard>(
    () => ({
      title: resolvedTitle,
      content: resolvedContent,
      contentHtml: initialEditableHtml || undefined
    }),
    [initialEditableHtml, resolvedContent, resolvedTitle]
  );
  const liveDraftCard = readDraftCard();
  const hasDraftChanges =
    draftTitle.trim() !== initialDraftCard.title.trim() ||
    liveDraftCard.content !== initialDraftCard.content.trim() ||
    (liveDraftCard.contentHtml ?? "") !== (initialDraftCard.contentHtml ?? "");

  const handleEditorInput = () => {
    if (!editorRef.current) {
      return;
    }

    const nextHtml = sanitizePlayerFacingHTML(editorRef.current.innerHTML);
    setDraftContentHtml(nextHtml);
    setDraftContent(extractPlainTextFromPlayerFacingHTML(nextHtml));
  };

  const handleRequestClose = () => {
    if (editMode && hasDraftChanges && !window.confirm("Закрыть карточку без сохранения?")) {
      return;
    }

    onClose();
  };

  const handleCancelEdit = () => {
    if (hasDraftChanges && !window.confirm("Отменить изменения в карточке?")) {
      return;
    }

    syncDraftCard(initialDraftCard);
    onCancelEdit?.();
  };

  const handleSave = async () => {
    if (!onSave) {
      return;
    }

    const nextCard = readDraftCard();
    syncDraftCard(nextCard);
    await onSave(nextCard);
  };

  const handleAutoFormat = async () => {
    if (!onAutoFormat) {
      return;
    }

    try {
      const formatted = await onAutoFormat(readDraftCard());
      if (formatted) {
        syncDraftCard(formatted);
      }
    } catch {
      // Parent already reports the error to the shared UI notice area.
    }
  };

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette player-facing-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="stack wide player-facing-modal-layout">
          <div className="row player-facing-modal-head">
            <div>
              <p className="eyebrow">{editMode ? (isNew ? "Новая карточка игроков" : "Редактирование карточки") : "Текст для игроков"}</p>
              {editMode ? (
                <input
                  className="input player-facing-title-input"
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="Название карточки"
                  value={draftTitle}
                />
              ) : (
                <h2>{resolvedTitle}</h2>
              )}
              <p className="copy">{resolvedTitle !== entity.title ? entity.title : entity.subtitle || entity.summary}</p>
            </div>

            <div className="player-facing-modal-toolbar">
              {editable && !editMode ? (
                <button className="ghost fill" onClick={onEnterEdit} type="button">
                  Редактировать
                </button>
              ) : null}
              {editMode ? (
                <button className="ghost" disabled={formatting || saving} onClick={() => void handleAutoFormat()} type="button">
                  {formatting ? "AI форматирует..." : "AI форматирование"}
                </button>
              ) : null}
              {editMode ? (
                <button className="ghost fill" disabled={saving || formatting} onClick={() => void handleSave()} type="button">
                  {saving ? "Сохраняем..." : "Сохранить"}
                </button>
              ) : null}
              {editMode ? (
                <button className="ghost" disabled={saving} onClick={handleCancelEdit} type="button">
                  Отмена
                </button>
              ) : null}
              <button className="ghost" onClick={handleRequestClose} type="button">
                Закрыть
              </button>
            </div>
          </div>

          <section className="card section-card player-facing-card">
            <div className="player-facing-scroll">
              {editMode ? (
                <div className="player-facing-editor-layout">
                  <p className="copy player-facing-editor-copy">
                    Редактируй карточку прямо в том виде, в котором будешь её показывать игрокам. Можно вставлять HTML со стилями и потом
                    дооформить через AI.
                  </p>
                  <div
                    className="player-facing-rich player-facing-rich-editor"
                    contentEditable
                    onInput={handleEditorInput}
                    ref={editorRef}
                    suppressContentEditableWarning
                  />
                </div>
              ) : resolvedContentHtml ? (
                <div
                  className="player-facing-rich"
                  dangerouslySetInnerHTML={{ __html: resolvedContentHtml }}
                />
              ) : sections.length ? (
                <div className="player-facing-sections">
                  {sections.map((section, index) => {
                    const lines = collectQuestSectionLines(section, 12);
                    return (
                      <article key={`${entity.id}-player-section-${section.title}-${index}`} className="player-facing-section">
                        <strong>{section.title}</strong>
                        {lines.length > 1 ? (
                          <ul className="quest-bullet-list">
                            {lines.map((line) => (
                              <li key={`${entity.id}-player-line-${line}`}>{line}</li>
                            ))}
                          </ul>
                        ) : lines[0] ? (
                          <p>{lines[0]}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : fallbackLines.length ? (
                <ul className="quest-bullet-list">
                  {fallbackLines.map((line) => (
                    <li key={`${entity.id}-player-fallback-${line}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="copy">Отдельная версия для игроков пока не заполнена.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
