import type { MouseEvent as ReactMouseEvent } from "react";
import type { BestiaryMonsterSummary, MonsterEntity } from "@shadow-edge/shared-types";
import { BestiaryMonsterCard } from "./BestiaryMonsterCard";

type BrowseResultsProps = {
  emptyDescription: string;
  emptyTitle: string;
  items: BestiaryMonsterSummary[];
  onSelect: (monsterId: string) => void;
  variant: "browse";
};

type ImportedResultsProps = {
  emptyDescription: string;
  emptyTitle: string;
  items: MonsterEntity[];
  onContextMenu?: (monster: MonsterEntity, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: (monsterId: string) => void;
  variant: "imported";
};

type BestiarySearchResultsProps = BrowseResultsProps | ImportedResultsProps;

export function BestiarySearchResults(props: BestiarySearchResultsProps) {
  if (!props.items.length) {
    return (
      <div className="directory-empty">
        <h3>{props.emptyTitle}</h3>
        <p className="copy">{props.emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="directory-grid">
      {props.variant === "browse"
        ? props.items.map((item) => (
            <BestiaryMonsterCard key={item.id} item={item} onClick={() => props.onSelect(item.id)} variant="browse" />
          ))
        : props.items.map((item) => (
            <BestiaryMonsterCard
              key={item.id}
              item={item}
              onClick={() => props.onOpen(item.id)}
              onContextMenu={props.onContextMenu ? (event) => props.onContextMenu?.(item, event) : undefined}
              variant="imported"
            />
          ))}
    </div>
  );
}
