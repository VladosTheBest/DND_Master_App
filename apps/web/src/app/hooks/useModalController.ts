import { useRef, useState } from "react";

export type CloseConfirmState = {
  title: string;
  description?: string;
  confirmLabel: string;
};

type UseModalControllerParams = {
  closeEntityModal: () => void;
  closeRandomEventModal: () => void;
  closeCombatPlaylistModal: () => void;
  closeCombatSetupModal: () => void;
  closeEntityPlaylistModal: () => void;
  closeEntityGalleryModal: () => void;
  closePreparedCombatModal: () => void;
  closeEntityLinkModal: () => void;
  closeGalleryViewer: () => void;
  closePlayerFacingView: () => void;
  openEntityModal: (kind: "player" | "npc" | "monster") => void;
  setCampaignModalOpen: (value: boolean) => void;
  setPaletteOpen: (value: boolean) => void;
};

export function useModalController({
  closeEntityModal,
  closeRandomEventModal,
  closeCombatPlaylistModal,
  closeCombatSetupModal,
  closeEntityPlaylistModal,
  closeEntityGalleryModal,
  closePreparedCombatModal,
  closeEntityLinkModal,
  closeGalleryViewer,
  closePlayerFacingView,
  openEntityModal,
  setCampaignModalOpen,
  setPaletteOpen
}: UseModalControllerParams) {
  const pendingModalCloseRef = useRef<(() => void) | null>(null);
  const [closeConfirmState, setCloseConfirmState] = useState<CloseConfirmState | null>(null);

  const requestModalClose = (title: string, onConfirm: () => void, description?: string, confirmLabel = "Закрыть") => {
    pendingModalCloseRef.current = onConfirm;
    setCloseConfirmState({
      title,
      description,
      confirmLabel
    });
  };

  const cancelModalCloseRequest = () => {
    pendingModalCloseRef.current = null;
    setCloseConfirmState(null);
  };

  const confirmModalCloseRequest = () => {
    const pendingAction = pendingModalCloseRef.current;
    pendingModalCloseRef.current = null;
    setCloseConfirmState(null);
    pendingAction?.();
  };

  const requestCampaignModalClose = () => {
    requestModalClose(
      "Закрыть создание кампании?",
      () => setCampaignModalOpen(false),
      "Название, дата и описание кампании останутся несохранёнными."
    );
  };

  const requestPaletteClose = () => {
    requestModalClose(
      "Закрыть глобальный поиск?",
      () => setPaletteOpen(false),
      "Текущий поиск закроется. Если ещё не открыл нужную сущность, его придётся набрать заново.",
      "Закрыть поиск"
    );
  };

  const requestEntityModalClose = () => {
    requestModalClose(
      "Закрыть редактор сущности?",
      closeEntityModal,
      "Поля, черновик AI и несохранённые правки в редакторе могут потеряться."
    );
  };

  const requestRandomEventModalClose = () => {
    requestModalClose(
      "Закрыть генератор случайного события?",
      closeRandomEventModal,
      "Описание сцены и текущий результат генерации могут пропасть, если окно закрыть сейчас."
    );
  };

  const requestCombatPlaylistModalClose = () => {
    requestModalClose(
      "Закрыть плейлист боя?",
      closeCombatPlaylistModal,
      "Несохранённые треки и правки боевого плейлиста будут потеряны."
    );
  };

  const requestCombatSetupModalClose = () => {
    requestModalClose(
      "Закрыть настройку боя?",
      closeCombatSetupModal,
      "Подбор врагов и текущие настройки старта боя не сохранятся автоматически."
    );
  };

  const requestCombatSetupSwapToEntity = (kind: "player" | "npc" | "monster") => {
    const targetTitle = kind === "player" ? "игрока" : kind === "npc" ? "NPC" : "монстра";
    const actionLabel = kind === "player" ? "К игроку" : kind === "npc" ? "К NPC" : "К монстру";
    requestModalClose(
      `Открыть создание ${targetTitle}?`,
      () => {
        closeCombatSetupModal();
        openEntityModal(kind);
      },
      "Текущая настройка боя закроется. Если что-то ещё не сохранено, эти правки пропадут.",
      actionLabel
    );
  };

  const requestEntityPlaylistModalClose = () => {
    requestModalClose(
      "Закрыть редактор плейлиста?",
      closeEntityPlaylistModal,
      "Добавленные треки и правки плейлиста этой сущности будут потеряны."
    );
  };

  const requestEntityGalleryModalClose = () => {
    requestModalClose(
      "Закрыть редактор галереи?",
      closeEntityGalleryModal,
      "Несохранённые изображения и подписи в галерее будут потеряны."
    );
  };

  const requestPreparedCombatModalClose = () => {
    requestModalClose(
      "Закрыть заготовленный бой?",
      closePreparedCombatModal,
      "Текущий состав врагов и правки заготовки не сохранятся автоматически."
    );
  };

  const requestEntityLinkModalClose = () => {
    requestModalClose(
      "Закрыть вставку ссылки?",
      closeEntityLinkModal,
      "Выбранная текстовая привязка и найденная цель будут сброшены."
    );
  };

  const requestGalleryViewerClose = () => {
    requestModalClose(
      "Закрыть просмотр галереи?",
      closeGalleryViewer,
      "Окно полноэкранного просмотра закроется.",
      "Закрыть просмотр"
    );
  };

  const requestPlayerFacingViewClose = () => {
    closePlayerFacingView();
  };

  return {
    cancelModalCloseRequest,
    closeConfirmState,
    confirmModalCloseRequest,
    requestCampaignModalClose,
    requestCombatPlaylistModalClose,
    requestCombatSetupModalClose,
    requestCombatSetupSwapToEntity,
    requestEntityGalleryModalClose,
    requestEntityLinkModalClose,
    requestEntityModalClose,
    requestEntityPlaylistModalClose,
    requestGalleryViewerClose,
    requestModalClose,
    requestPaletteClose,
    requestPlayerFacingViewClose,
    requestPreparedCombatModalClose,
    requestRandomEventModalClose
  };
}
