import type { KnowledgeEntity, PlaylistTrack } from "@shadow-edge/shared-types";
import { PlaylistEditorSection } from "../../media";

type EntityPlaylistModalProps = {
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
    <div className="overlay" role="presentation">
      <div className="panel palette form-modal combat-playlist-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">Entity Playlist</p>
            <strong>{target.title}</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <PlaylistEditorSection
          hint="Точечная правка только для музыки этой сущности. Никакого полного редактора и длинной формы."
          onAdd={onAdd}
          onChange={onChange}
          onRemove={onRemove}
          title="Плейлист сцены"
          tracks={tracks}
        />

        <div className="actions">
          <button className="ghost" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="primary" disabled={saving} onClick={() => void onSave()} type="button">
            {saving ? "Сохраняю..." : "Сохранить плейлист"}
          </button>
        </div>
      </div>
    </div>
  );
}
