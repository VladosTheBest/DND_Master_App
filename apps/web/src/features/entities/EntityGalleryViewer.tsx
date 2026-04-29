import {
  useEffect,
  useState
} from "react";
import { galleryImageTitle } from "../../app-shared";
import type { GalleryImage } from "@shadow-edge/shared-types";
import type { GalleryViewerState } from "../../media";

type EntityGalleryViewerProps = {
  onClose: () => void;
  onCopyLink: (url: string) => Promise<void>;
  onSelect: (index: number) => void;
  onShowToPlayers?: (item: GalleryImage) => Promise<void> | void;
  showToPlayersBusy?: boolean;
  viewer: GalleryViewerState | null;
};

export function EntityGalleryViewer({
  onClose,
  onCopyLink,
  onSelect,
  onShowToPlayers,
  showToPlayersBusy = false,
  viewer
}: EntityGalleryViewerProps) {
  if (!viewer) {
    return null;
  }

  const item = viewer.items[viewer.currentIndex];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [viewer.currentIndex, item.url]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && viewer.items.length > 1) {
        onSelect(viewer.currentIndex - 1);
      }
      if (event.key === "ArrowRight" && viewer.items.length > 1) {
        onSelect(viewer.currentIndex + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, viewer.currentIndex, viewer.items.length]);

  return (
    <div className="gallery-lightbox-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="panel gallery-lightbox"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="row">
          <div className="stack compact">
            <p className="eyebrow">Галерея / Fullscreen</p>
            <strong>{galleryImageTitle(item, viewer.currentIndex)}</strong>
            <small>
              {viewer.ownerTitle} • {viewer.currentIndex + 1}/{viewer.items.length}
            </small>
          </div>
          <div className="actions">
            <button className="ghost" disabled={viewer.items.length < 2} onClick={() => onSelect(viewer.currentIndex - 1)} type="button">
              ←
            </button>
            <button className="ghost" disabled={viewer.items.length < 2} onClick={() => onSelect(viewer.currentIndex + 1)} type="button">
              →
            </button>
            <button
              className="ghost"
              onClick={() => {
                void onCopyLink(item.url)
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
              type="button"
            >
              {copied ? "Скопировано" : "Скопировать ссылку"}
            </button>
            {onShowToPlayers ? (
              <button
                className="primary"
                disabled={showToPlayersBusy}
                onClick={() => {
                  void onShowToPlayers(item);
                }}
                type="button"
              >
                {showToPlayersBusy ? "Показываю..." : "Показать игрокам"}
              </button>
            ) : null}
            <button className="ghost" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} type="button">
              Открыть файл
            </button>
            <button className="ghost" onClick={onClose} type="button">
              Закрыть
            </button>
          </div>
        </div>

        <div
          className="gallery-lightbox-image-shell"
          onClick={onClose}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClose();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <img alt={item.caption ?? galleryImageTitle(item, viewer.currentIndex)} className="gallery-lightbox-image" src={item.url} />
        </div>

        <div className="stack compact">
          {item.caption?.trim() ? <p className="copy">{item.caption}</p> : null}
          <small>{item.url}</small>
        </div>
      </div>
    </div>
  );
}
