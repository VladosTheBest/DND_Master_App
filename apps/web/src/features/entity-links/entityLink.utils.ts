import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { createWikiLinkMarkup } from "../../rich-text";
import type { EntityLinkSelection } from "./entityLink.types";

const normalizeEntityLinkQuery = (value: string) => value.trim().toLowerCase();

export const filterLinkableEntities = ({
  allEntities,
  editingEntityId,
  query,
  selectionEntityId
}: {
  allEntities: KnowledgeEntity[];
  editingEntityId: string;
  query: string;
  selectionEntityId?: string;
}) => {
  const normalizedQuery = normalizeEntityLinkQuery(query);

  return allEntities.filter((entity) => {
    if (entity.id === editingEntityId || entity.id === selectionEntityId) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [entity.title, entity.subtitle, entity.summary, entity.tags.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
};

export const replaceSelectionWithEntityLink = ({
  currentValue,
  selection,
  targetTitle
}: {
  currentValue: string;
  selection: EntityLinkSelection;
  targetTitle: string;
}) =>
  currentValue.slice(0, selection.start) +
  createWikiLinkMarkup(targetTitle, selection.text) +
  currentValue.slice(selection.end);

export const resolveExactEntityLinkTarget = ({
  allEntities,
  editingEntityId,
  selection,
  selectionText
}: {
  allEntities: KnowledgeEntity[];
  editingEntityId: string;
  selection: EntityLinkSelection;
  selectionText: string;
}) => {
  const normalizedSelection = normalizeEntityLinkQuery(selectionText);
  if (!normalizedSelection) {
    return null;
  }

  return (
    allEntities.find(
      (entity) =>
        entity.id !== editingEntityId &&
        entity.id !== selection.entityId &&
        entity.title.trim().toLowerCase() === normalizedSelection
    ) ?? null
  );
};

export const resolveValidEntityLinkTargetId = (entities: KnowledgeEntity[], currentTargetId: string) =>
  entities.some((entity) => entity.id === currentTargetId) ? currentTargetId : entities[0]?.id ?? "";
