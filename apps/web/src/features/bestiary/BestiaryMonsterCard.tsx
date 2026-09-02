import type { MouseEvent as ReactMouseEvent } from "react";
import type { BestiaryMonsterSummary, MonsterEntity } from "@shadow-edge/shared-types";
import {
  badge,
  createBestiaryPortraitSource,
  createPortraitSource,
  gradients,
  hasVisibleArt,
  sigil,
  truncateInlineText
} from "../../app-shared";
import { getEntityChallenge } from "../combat/combat.utils";

type BrowseCardProps = {
  item: BestiaryMonsterSummary;
  onClick: () => void;
  variant: "browse";
};

type ImportedCardProps = {
  item: MonsterEntity;
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenEntityImage?: (entity: MonsterEntity, displayUrl?: string) => void;
  variant: "imported";
};

type BestiaryMonsterCardProps = BrowseCardProps | ImportedCardProps;

export function BestiaryMonsterCard(props: BestiaryMonsterCardProps) {
  if (props.variant === "browse") {
    const { item, onClick } = props;
    return (
      <button className="directory-card bestiary-directory-card" onClick={onClick} type="button">
        <span className="directory-card-thumb">
          <img alt={item.title} className="directory-card-image" loading="lazy" src={createBestiaryPortraitSource(item)} />
        </span>
        <span className="directory-card-copy">
          <span className="directory-card-topline">
            <strong>{item.title}</strong>
            <span className={badge("warning")}>{item.challenge ? `CR ${item.challenge}` : "CR ?"}</span>
          </span>
          <small>{item.creatureTypeLabel || item.source}</small>
          <p>{truncateInlineText(item.summary || item.subtitle, 140)}</p>
        </span>
      </button>
    );
  }

  const { item, onClick, onContextMenu, onOpenEntityImage } = props;
  const displayUrl = hasVisibleArt(item.art) ? createPortraitSource(item) : undefined;

  return (
    <article className="directory-card" onContextMenu={onContextMenu}>
      <button
        aria-haspopup={onOpenEntityImage ? "dialog" : undefined}
        aria-label={onOpenEntityImage ? `Открыть изображение «${item.title}»` : undefined}
        className={`directory-card-thumb ${onOpenEntityImage ? "entity-image-trigger" : ""}`.trim()}
        disabled={!onOpenEntityImage}
        onClick={() => onOpenEntityImage?.(item, displayUrl)}
        title={onOpenEntityImage ? `Открыть изображение «${item.title}»` : undefined}
        type="button"
      >
        {displayUrl ? (
          <img alt={item.title} className="directory-card-image" loading="lazy" src={displayUrl} />
        ) : (
          <span className="sigil big" style={{ backgroundImage: gradients[item.kind] }}>
            {sigil(item.title)}
          </span>
        )}
      </button>
      <button className="directory-card-copy" onClick={onClick} type="button">
        <span className="directory-card-topline">
          <strong>{item.title}</strong>
          <span className={badge("warning")}>{getEntityChallenge(item) ? `CR ${getEntityChallenge(item)}` : "CR ?"}</span>
        </span>
        <small>{item.subtitle}</small>
        <p>{truncateInlineText(item.summary, 150)}</p>
      </button>
    </article>
  );
}
