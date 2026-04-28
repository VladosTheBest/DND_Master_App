import type {
  CreateEntityInput,
  CreateEntityResult,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  RefObject,
  SetStateAction
} from "react";
import type {
  EntityLinkSelection,
  EntityTextField
} from "../entities/entity.types";

export type { EntityLinkSelection, EntityTextField };

export type UseEntityLinkControllerArgs = {
  activeCampaignId: string;
  allEntities: KnowledgeEntity[];
  editingEntityId: string;
  entityContentRef: RefObject<HTMLTextAreaElement | null>;
  entityForm: CreateEntityInput;
  entityMap: Map<string, KnowledgeEntity>;
  entityPlayerContentRef: RefObject<HTMLTextAreaElement | null>;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  onApplyCreatedEntity: (result: CreateEntityResult) => void;
  onCloseEntityActionMenu: () => void;
  onSerializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
  onSetBootError: (value: string) => void;
  onSetEntityForm: Dispatch<SetStateAction<CreateEntityInput>>;
  onSetPreviewEntityId: (value: string) => void;
  onSetSaving: (value: boolean) => void;
};

export type EntityLinkController = {
  closeEntityLinkContextMenu: () => void;
  closeEntityLinkModal: () => void;
  entityLinkMenuOpen: boolean;
  entityLinkModalOpen: boolean;
  entityLinkQuery: string;
  entityLinkSelection: EntityLinkSelection | null;
  entityLinkTargetId: string;
  handleActiveEntityContentContextMenu: (
    entity: KnowledgeEntity,
    field: EntityTextField,
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  handleEntityContentContextMenu: (field: EntityTextField, event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  handleNoteContentContextMenu: (noteId: string, event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  insertEntityLinkIntoContent: () => void;
  linkableEntities: KnowledgeEntity[];
  noteEditorContentRef: RefObject<HTMLTextAreaElement | null>;
  openEntityLinkModal: () => void;
  resetEntityLinkState: () => void;
  selectedEntityLinkTarget: KnowledgeEntity | null;
  setEntityLinkQuery: (value: string) => void;
  setEntityLinkTargetId: (value: string) => void;
};

export type EntityLinkContextMenuProps = {
  controller: EntityLinkController;
};

export type EntityLinkPickerModalProps = {
  controller: EntityLinkController;
  onClose: () => void;
};
