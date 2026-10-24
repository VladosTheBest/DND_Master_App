import { PlayerFacingEntityModal } from "../../quests";
import type { PlayerFacingCardsController } from "./usePlayerFacingCards";

export function PlayerFacingController({
  inlineTargetId,
  controller,
  ownerId,
  campaignId,
  readOnly = false,
  onClose
}: {
  inlineTargetId?:string;
  controller: PlayerFacingCardsController;
  ownerId: string;
  campaignId: string;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const {
    cancelPlayerFacingEditMode,
    enterPlayerFacingEditMode,
    formatPlayerFacingCardFromModal,
    generatePlayerFacingCardFromModal,
    playerFacingEntity,
    playerFacingModalFormatting,
    playerFacingModalSaving,
    playerFacingView,
    savePlayerFacingCardFromModal
  } = controller;

  if (!playerFacingEntity || !playerFacingView) {
    return null;
  }

  const protectedSource = readOnly && playerFacingEntity.kind !== "player";
  return (
    <PlayerFacingEntityModal
      inlineTargetId={inlineTargetId}
      ownerId={ownerId}
      campaignId={campaignId}
      cardIndex={playerFacingView.cardIndex}
      baseRevision={playerFacingView.baseRevision ?? 0}
      error={controller.playerFacingModalError}
      conflict={controller.playerFacingModalConflict}
      content={playerFacingView.content}
      contentHtml={playerFacingView.contentHtml}
      editable={!protectedSource&&typeof playerFacingView.cardIndex === "number"}
      editMode={!protectedSource&&Boolean(playerFacingView.editMode)}
      entity={playerFacingEntity}
      formatting={playerFacingModalFormatting}
      isNew={Boolean(playerFacingView.isNew)}
      onAutoFormat={formatPlayerFacingCardFromModal}
      onGenerate={generatePlayerFacingCardFromModal}
      onCancelEdit={cancelPlayerFacingEditMode}
      onClose={onClose}
      onEnterEdit={enterPlayerFacingEditMode}
      onSave={savePlayerFacingCardFromModal}
      saving={playerFacingModalSaving}
      title={playerFacingView.title}
    />
  );
}
