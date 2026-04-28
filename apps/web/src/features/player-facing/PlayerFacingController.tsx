import { PlayerFacingEntityModal } from "../../quests";
import type { PlayerFacingCardsController } from "./usePlayerFacingCards";

export function PlayerFacingController({
  controller,
  onClose
}: {
  controller: PlayerFacingCardsController;
  onClose: () => void;
}) {
  const {
    cancelPlayerFacingEditMode,
    enterPlayerFacingEditMode,
    formatPlayerFacingCardFromModal,
    playerFacingEntity,
    playerFacingModalFormatting,
    playerFacingModalSaving,
    playerFacingView,
    savePlayerFacingCardFromModal
  } = controller;

  if (!playerFacingEntity || !playerFacingView) {
    return null;
  }

  return (
    <PlayerFacingEntityModal
      content={playerFacingView.content}
      contentHtml={playerFacingView.contentHtml}
      editable={typeof playerFacingView.cardIndex === "number"}
      editMode={Boolean(playerFacingView.editMode)}
      entity={playerFacingEntity}
      formatting={playerFacingModalFormatting}
      isNew={Boolean(playerFacingView.isNew)}
      onAutoFormat={formatPlayerFacingCardFromModal}
      onCancelEdit={cancelPlayerFacingEditMode}
      onClose={onClose}
      onEnterEdit={enterPlayerFacingEditMode}
      onSave={savePlayerFacingCardFromModal}
      saving={playerFacingModalSaving}
      title={playerFacingView.title}
    />
  );
}
