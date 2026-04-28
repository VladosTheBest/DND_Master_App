import { useMemo, type ReactNode } from "react";
import type {
  KnowledgeEntity,
  QuestEntity,
  RelatedEntity
} from "@shadow-edge/shared-types";
import { kindTitle } from "../../app-shared";
import { resolveEntityPreparedCombats } from "../combat/combat.utils";
import { resolvePreparedCombatEntriesForPlans } from "../prepared-combat/preparedCombat.utils";
import {
  normalizePlayerFacingCardsForClient,
  type PlayerFacingCardsController
} from "../player-facing/usePlayerFacingCards";
import {
  type QuestCombatEntrySummary,
  type QuestLinkedEntity,
  QuestWorkspace
} from "../../quests";

export function QuestPageContainer({
  campaignQuests,
  currentPlaybackTrackLabel,
  entityMap,
  isEntityPlaylistActive,
  onEditEntity,
  onOpenDirectory,
  onOpenEntity,
  onOpenPlaylist,
  onOpenQuest,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onTogglePin,
  pinned,
  playerFacing,
  preparedCombatSection,
  quest,
  questScopeEntities,
  resolveLinkedEntity
}: {
  campaignQuests: QuestEntity[];
  currentPlaybackTrackLabel: string;
  entityMap: Map<string, KnowledgeEntity>;
  isEntityPlaylistActive: (entityId?: string) => boolean;
  onEditEntity: (entityId: string) => void;
  onOpenDirectory: () => void;
  onOpenEntity: (entityId: string) => void;
  onOpenPlaylist: (quest: QuestEntity) => void;
  onOpenQuest: (questId: string) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: (quest: QuestEntity) => void;
  onTogglePin: (entityId: string) => void;
  pinned: boolean;
  playerFacing: PlayerFacingCardsController;
  preparedCombatSection: ReactNode;
  quest: QuestEntity;
  questScopeEntities: QuestEntity[];
  resolveLinkedEntity: (item: Pick<RelatedEntity, "id" | "label">) => KnowledgeEntity | null;
}) {
  const activeQuestLocation = useMemo(() => {
    if (!quest.locationId) {
      return null;
    }
    const entity = resolveLinkedEntity({ id: quest.locationId, label: "" });
    return entity?.kind === "location" ? entity : null;
  }, [quest, resolveLinkedEntity]);

  const activeQuestIssuer = useMemo(() => {
    if (!quest.issuerId) {
      return null;
    }
    const entity = resolveLinkedEntity({ id: quest.issuerId, label: "" });
    return entity?.kind === "npc" ? entity : null;
  }, [quest, resolveLinkedEntity]);

  const preparedCombatEntries = useMemo(
    () => resolvePreparedCombatEntriesForPlans(entityMap, resolveEntityPreparedCombats(quest)),
    [entityMap, quest]
  );

  const linkedEntities = useMemo(() => {
    const seen = new Set<string>();
    const items: QuestLinkedEntity[] = [];
    const pushItem = (item: QuestLinkedEntity | null) => {
      if (!item || seen.has(item.entity.id)) {
        return;
      }
      seen.add(item.entity.id);
      items.push(item);
    };

    if (activeQuestLocation) {
      pushItem({
        entity: activeQuestLocation,
        label: "Локация",
        tone: "accent",
        note: activeQuestLocation.summary
      });
    }

    if (activeQuestIssuer) {
      pushItem({
        entity: activeQuestIssuer,
        label: "Квестодатель",
        tone: "warning",
        note: activeQuestIssuer.summary
      });
    }

    quest.related.forEach((item) => {
      const entity = resolveLinkedEntity(item);
      if (!entity) {
        return;
      }
      pushItem({
        entity,
        label: kindTitle[entity.kind],
        tone:
          entity.kind === "monster"
            ? "danger"
            : entity.kind === "npc"
              ? "accent"
              : entity.kind === "location"
                ? "success"
                : "default",
        note: item.reason
      });
    });

    return items;
  }, [activeQuestIssuer, activeQuestLocation, quest.related, resolveLinkedEntity]);

  const relatedQuests = useMemo(
    () =>
      campaignQuests
        .filter(
          (item) =>
            item.id !== quest.id &&
            (Boolean(quest.locationId && item.locationId === quest.locationId) ||
              Boolean(quest.issuerId && item.issuerId === quest.issuerId) ||
              item.related.some((related) => related.id === quest.id))
        )
        .slice(0, 3),
    [campaignQuests, quest]
  );

  const activeQuestIndex = questScopeEntities.findIndex((item) => item.id === quest.id);
  const previousQuest = activeQuestIndex > 0 ? questScopeEntities[activeQuestIndex - 1] : null;
  const nextQuest =
    activeQuestIndex >= 0 && activeQuestIndex < questScopeEntities.length - 1 ? questScopeEntities[activeQuestIndex + 1] : null;
  const playerCards = useMemo(
    () => normalizePlayerFacingCardsForClient(quest.kind, quest.playerCards, quest.playerContent),
    [quest]
  );

  return (
    <QuestWorkspace
      issuer={activeQuestIssuer}
      linkedEntities={linkedEntities}
      location={activeQuestLocation}
      nextQuest={nextQuest}
      onCreatePlayerCard={() => playerFacing.openNewPlayerFacingEditor(quest)}
      onDeletePlayerCard={(card, index) => playerFacing.requestPlayerFacingCardDeletion(quest, card, index)}
      onEdit={onEditEntity}
      onEditPlayerCard={(card, index) => playerFacing.openPlayerFacingEditor(quest, card, index)}
      onOpenDirectory={onOpenDirectory}
      onOpenEntity={onOpenEntity}
      onOpenPlayerCard={(card, index) => playerFacing.openPlayerFacingView(quest, card, { cardIndex: index })}
      onOpenPlaylist={onOpenPlaylist}
      onOpenQuest={onOpenQuest}
      onPlayNextPlaylistTrack={onPlayNextPlaylistTrack}
      onPlayPlaylist={() => onPlayPlaylist(quest)}
      onTogglePin={onTogglePin}
      pinned={pinned}
      playerCards={playerCards}
      playlistActive={isEntityPlaylistActive(quest.id)}
      playlistTrackLabel={currentPlaybackTrackLabel}
      preparedCombatEntries={preparedCombatEntries as QuestCombatEntrySummary[]}
      preparedCombatSection={preparedCombatSection}
      previousQuest={previousQuest}
      quest={quest}
      relatedQuests={relatedQuests}
    />
  );
}
