import { MediaDraftFeedback } from "./MediaDraftFeedback";
import type { EntityMediaDraft } from "./useEntityMediaDraft";
import { AppModal } from "../../app/AppModal";
import type { KnowledgeEntity, PlaylistTrack } from "@shadow-edge/shared-types";
import { PlaylistEditorSection } from "../../media";

type EntityPlaylistModalProps = {
  state:EntityMediaDraft;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<PlaylistTrack>) => void;
  onClose: () => void;
  onRemove: (index: number) => void;
  onSave: () => Promise<void>;
  open: boolean;
  saving: boolean;
  target: KnowledgeEntity | null;
  tracks: PlaylistTrack[];
};

export function EntityPlaylistModal({
  state,
  onAdd,
  onChange,
  onClose,
  onRemove,
  onSave,
  open,
  saving,
  target,
  tracks
}: EntityPlaylistModalProps) {
  if (!open || !target) {
    return null;
  }

  return (
    <AppModal label="Музыка записи" onClose={onClose}>
      <div className="panel palette form-modal combat-playlist-modal entity-media-modal" onClick={(event) => event.stopPropagation()} >
        <header className="record-block-heading">
          <div>
            <h2>Музыка записи</h2>
            <strong>{target.title}</strong>
          </div>
          <button className="ghost" disabled={saving} onClick={onClose} type="button">
            Закрыть
          </button>
        </header>

        <div className="entity-media-body"><MediaDraftFeedback state={state} field="playlist" items={tracks}/><fieldset disabled={saving} className="media-editor-fields"><PlaylistEditorSection
          hint="Добавьте ссылки на YouTube или аудиофайлы для атмосферы этой сцены."
          onAdd={onAdd}
          onChange={onChange}
          onRemove={onRemove}
          title="Плейлист сцены"
          tracks={tracks}
        />

        </fieldset></div><footer className="actions">
          <button className="ghost" disabled={saving} onClick={onClose} type="button">
            Отмена
          </button>
          <button className="primary" disabled={!state.canSave} onClick={() => void onSave()} type="button">
            {saving ? "Сохраняю..." : "Сохранить плейлист"}
          </button>
        </footer>
      </div>
    </AppModal>
  );
}
