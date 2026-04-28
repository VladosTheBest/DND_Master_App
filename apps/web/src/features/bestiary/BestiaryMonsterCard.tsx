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
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
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

  const { item, onClick, onContextMenu } = props;

  return (
    <button className="directory-card" onClick={onClick} onContextMenu={onContextMenu} type="button">
      <span className="directory-card-thumb">
        {hasVisibleArt(item.art) ? (
          <img alt={item.title} className="directory-card-image" loading="lazy" src={createPortraitSource(item)} />
        ) : (
          <span className="sigil big" style={{ backgroundImage: gradients[item.kind] }}>
            {sigil(item.title)}
          </span>
        )}
      </span>
      <span className="directory-card-copy">
        <span className="directory-card-topline">
          <strong>{item.title}</strong>
          <span className={badge("warning")}>{getEntityChallenge(item) ? `CR ${getEntityChallenge(item)}` : "CR ?"}</span>
        </span>
        <small>{item.subtitle}</small>
        <p>{truncateInlineText(item.summary, 150)}</p>
      </span>
    </button>
  );
}
