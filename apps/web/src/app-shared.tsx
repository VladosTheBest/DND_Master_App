import {
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import type {
  AbilityKey,
  BestiaryMonsterSummary,
  EntityKind,
  GalleryImage,
  HeroArt,
  KnowledgeEntity,
  MonsterEntity,
  MonsterRewardProfile,
  NpcEntity,
  PlaylistTrack,
  QuestEntity,
  QuickFactTone,
  WorldEvent,
  WorldEventType
} from "@shadow-edge/shared-types";

type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;
type PortraitEntityLike = {
  kind: EntityKind;
  title: string;
  art?: HeroArt;
};
type RewardableEntity = NpcEntity | MonsterEntity | QuestEntity;

export const NEW_LORE_NOTE_ID = "__new_lore_note__";
export const NEW_WORLD_EVENT_ID = "__new_world_event__";

export const gradients: Record<EntityKind, string> = {
  location: "linear-gradient(135deg, rgba(124,166,255,.88), rgba(68,93,148,.72))",
  player: "linear-gradient(135deg, rgba(109,221,205,.9), rgba(27,109,129,.74))",
  npc: "linear-gradient(135deg, rgba(126,214,161,.88), rgba(46,119,85,.74))",
  monster: "linear-gradient(135deg, rgba(229,124,98,.92), rgba(127,44,38,.78))",
  quest: "linear-gradient(135deg, rgba(241,192,125,.9), rgba(176,105,38,.76))",
  lore: "linear-gradient(135deg, rgba(192,153,255,.88), rgba(96,73,150,.76))"
};

export const kindTitle: Record<EntityKind, string> = {
  location: "Локация",
  player: "Игрок",
  npc: "НПС",
  monster: "Монстр",
  quest: "Квест",
  lore: "Лор"
};

export const worldEventTypeOptions = ["funny", "combat", "heist", "social", "oddity", "danger"] as const satisfies readonly WorldEventType[];
export const worldEventTypeLabels: Record<WorldEventType, string> = {
  funny: "Смешное",
  combat: "Бой",
  heist: "Ограбление",
  social: "Социальное",
  oddity: "Странное",
  danger: "Опасное"
};
export const worldEventTypeTones: Record<WorldEventType, QuickFactTone> = {
  funny: "accent",
  combat: "danger",
  heist: "warning",
  social: "success",
  oddity: "accent",
  danger: "warning"
};

export const toneClass: Record<QuickFactTone, string> = {
  default: "tone-default",
  accent: "tone-accent",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger"
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const abilityLabels: Array<{ key: AbilityKey; label: string }> = [
  { key: "str", label: "СИЛ" },
  { key: "dex", label: "ЛОВ" },
  { key: "con", label: "ТЕЛ" },
  { key: "int", label: "ИНТ" },
  { key: "wis", label: "МДР" },
  { key: "cha", label: "ХАР" }
];

export const badge = (tone?: QuickFactTone) => `badge ${toneClass[tone ?? "default"]}`;

export const sigil = (title: string) =>
  title
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const rewardSummaryText = (rewardProfile?: MonsterRewardProfile) => {
  if (!rewardProfile) {
    return "";
  }
  if (rewardProfile.summary.trim()) {
    return rewardProfile.summary.trim();
  }
  if (rewardProfile.loot.length) {
    return `${rewardProfile.loot.length} позиций`;
  }
  return "";
};

export const rewardSectionLabel = (kind: EntityKind) => {
  switch (kind) {
    case "quest":
      return { title: "Награда", hint: "Оплата, артефакты, репутация и условия получения" };
    case "npc":
      return { title: "Награда и лут", hint: "Что НПС может дать, носит с собой или оставить после смерти" };
    case "monster":
    default:
      return { title: "Награды и добыча", hint: "Лут, трофеи, оружие и проверки на разделку" };
  }
};

export const truncateInlineText = (value: string, maxLength = 96) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

export const worldEventExcerpt = (event: Pick<WorldEvent, "summary" | "sceneText">, max = 120) =>
  truncateInlineText(event.summary?.trim() || event.sceneText?.trim() || "Сценка ещё не заполнена.", max);

export const loreNoteExcerpt = (
  note: Pick<LoreNoteEntity, "summary" | "content"> | { summary?: string; content: string },
  maxLength = 140
) => {
  const source = (note.summary ?? "").trim() || note.content.replace(/\s+/g, " ").trim();
  return source ? truncateInlineText(source, maxLength) : "Пустая заметка";
};

export const resolveLoreNoteTitle = (title: string, content: string) => {
  const explicitTitle = title.trim();
  if (explicitTitle) {
    return truncateInlineText(explicitTitle, 72);
  }

  const firstLine = content
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? truncateInlineText(firstLine, 72) : "Новая заметка";
};

export const matchesEntityDirectorySearch = (entity: KnowledgeEntity, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [entity.title, entity.subtitle, entity.summary, entity.tags.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
};

export const formatModifier = (score: number) => {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
};

export const isRewardableEntity = (entity: KnowledgeEntity | null): entity is RewardableEntity =>
  Boolean(entity && (entity.kind === "npc" || entity.kind === "monster" || entity.kind === "quest"));

export const createPortraitSource = (entity: PortraitEntityLike) => {
  if (entity.art?.url) {
    return entity.art.url;
  }

  const initials =
    sigil(entity.title) ||
    (entity.kind === "monster" ? "MN" : entity.kind === "player" ? "PL" : "NPC");
  const safeTitle = entity.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const accentA = entity.kind === "monster" ? "#e57c62" : entity.kind === "player" ? "#6dddcf" : "#7ed6a1";
  const accentB = entity.kind === "monster" ? "#4d1914" : entity.kind === "player" ? "#164f63" : "#1e3d32";
  const label =
    entity.kind === "monster" ? "MONSTER DOSSIER" : entity.kind === "player" ? "PLAYER DOSSIER" : "NPC DOSSIER";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 900">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accentA}"/>
          <stop offset="100%" stop-color="${accentB}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.2)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="720" height="900" rx="42" fill="url(#bg)"/>
      <rect width="720" height="900" rx="42" fill="url(#glow)"/>
      <circle cx="360" cy="310" r="146" fill="rgba(7, 14, 20, 0.18)"/>
      <path d="M233 620c34-112 107-169 127-182 20-13 40-13 40-13s20 0 40 13c20 13 93 70 127 182" fill="rgba(7, 14, 20, 0.22)"/>
      <text x="64" y="98" fill="rgba(255,255,255,0.92)" font-family="Segoe UI, Arial, sans-serif" font-size="40" letter-spacing="7">${label}</text>
      <text x="64" y="792" fill="rgba(255,255,255,0.96)" font-family="Georgia, serif" font-size="52" font-weight="700">${safeTitle}</text>
      <text x="64" y="852" fill="rgba(255,255,255,0.72)" font-family="Segoe UI, Arial, sans-serif" font-size="28">Портрет-заглушка, пока не задан art.url</text>
      <text x="360" y="352" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-family="Georgia, serif" font-size="126" font-weight="700">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const createHeroPanelStyle = (gradient: string, imageUrl?: string): CSSProperties => ({
  backgroundImage: imageUrl
    ? `linear-gradient(180deg, rgba(6, 10, 16, 0.24), rgba(6, 10, 16, 0.7)), ${gradient}, url("${imageUrl}")`
    : `linear-gradient(180deg, rgba(6, 10, 16, 0.18), rgba(6, 10, 16, 0.42)), ${gradient}`,
  backgroundSize: imageUrl ? "cover, cover, cover" : undefined,
  backgroundPosition: imageUrl ? "center, center, center" : undefined
});

export const createBestiaryPortraitSource = (monster: Pick<BestiaryMonsterSummary, "title" | "imageUrl">) =>
  createPortraitSource({
    kind: "monster",
    title: monster.title,
    art: monster.imageUrl ? { url: monster.imageUrl, alt: monster.title } : undefined
  });

export const playlistTrackTitle = (track: PlaylistTrack, index: number) => track.title.trim() || `Трек ${index + 1}`;
export const galleryImageTitle = (item: GalleryImage, index: number) => item.title.trim() || `Изображение ${index + 1}`;

export const playlistTrackHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "внешняя ссылка";
  }
};

export const hasVisibleArt = (art?: HeroArt) => Boolean(art?.url?.trim());

export function EntityVisual({
  entity,
  variant = "row"
}: {
  entity: Pick<PortraitEntityLike, "kind" | "title" | "art">;
  variant?: "row" | "hero" | "relation";
}) {
  if (!hasVisibleArt(entity.art)) {
    return (
      <span className={`sigil ${variant === "hero" ? "big" : ""}`} style={{ backgroundImage: gradients[entity.kind] }}>
        {sigil(entity.title)}
      </span>
    );
  }

  return (
    <span className={`entity-thumb-frame entity-thumb-${variant}`}>
      <img alt={entity.art?.alt ?? entity.title} className="entity-thumb" loading="lazy" src={createPortraitSource(entity)} />
    </span>
  );
}

export function CollapsibleSection({
  title,
  hint,
  summary,
  defaultCollapsed = false,
  action,
  className = "",
  children
}: {
  title: string;
  hint?: string;
  summary?: ReactNode;
  defaultCollapsed?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className={`card section-card collapsible-section ${collapsed ? "collapsed" : ""} ${className}`.trim()}>
      <div className="collapsible-head">
        <button
          aria-expanded={!collapsed}
          className="collapsible-toggle"
          onClick={() => setCollapsed((current) => !current)}
          type="button"
        >
          <span className="collapsible-copy">
            <strong>{title}</strong>
            {hint ? <small>{hint}</small> : null}
          </span>
          <span className={`collapsible-chevron ${collapsed ? "collapsed" : ""}`}>{collapsed ? "Развернуть" : "Свернуть"}</span>
        </button>
        {action ? <div className="collapsible-action">{action}</div> : null}
      </div>

      {collapsed ? (summary ? <div className="collapsible-summary">{summary}</div> : null) : <div className="collapsible-body">{children}</div>}
    </section>
  );
}
