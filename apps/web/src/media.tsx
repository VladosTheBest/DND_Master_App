import {
  useEffect,
  useState,
  type ReactNode
} from "react";
import type {
  GalleryImage,
  PlaylistTrack
} from "@shadow-edge/shared-types";
import {
  badge,
  CollapsibleSection,
  galleryImageTitle,
  playlistTrackHost,
  playlistTrackTitle
} from "./app-shared";

export type GalleryViewerState = {
  ownerId: string;
  ownerTitle: string;
  items: GalleryImage[];
  currentIndex: number;
};

export function PlaylistSection({
  title,
  hint,
  tracks,
  activeTrackUrl,
  activeTrackLabel,
  isActive,
  compact = false,
  defaultCollapsed = false,
  action,
  onPlayRandom,
  onPlayTrack,
  onNextRandom,
  onStop
}: {
  title: string;
  hint: string;
  tracks: PlaylistTrack[];
  activeTrackUrl?: string;
  activeTrackLabel?: string;
  isActive?: boolean;
  compact?: boolean;
  defaultCollapsed?: boolean;
  action?: ReactNode;
  onPlayRandom: () => void;
  onPlayTrack: (index: number) => void;
  onNextRandom: () => void;
  onStop: () => void;
}) {
  return (
    <CollapsibleSection
      action={action}
      className={`playlist-section ${compact ? "compact" : ""}`}
      defaultCollapsed={defaultCollapsed}
      hint={hint}
      summary={
        <p className="copy">
          {tracks.length
            ? `${tracks.length} треков${isActive && activeTrackLabel ? ` • сейчас играет: ${activeTrackLabel}` : " • готов к случайному запуску"}`
            : "Плейлист пока пуст."}
        </p>
      }
      title={title}
    >
      {tracks.length ? (
        <>
          <div className="actions playlist-runtime-toolbar">
            <button className="primary" onClick={onPlayRandom} type="button">
              {isActive ? "Случайный следующий" : "Случайный трек"}
            </button>
            <button className="ghost" disabled={!isActive} onClick={onNextRandom} type="button">
              Следующий
            </button>
            <button className="ghost" disabled={!isActive} onClick={onStop} type="button">
              Стоп
            </button>
          </div>

          <div className={`playlist-track-list ${compact ? "compact-entry-list" : ""}`}>
            {tracks.map((track, index) => {
              const label = playlistTrackTitle(track, index);
              const active = Boolean(isActive && activeTrackUrl && track.url === activeTrackUrl);
              return (
                <button
                  key={`${track.url}-${index}`}
                  className={`ghost fill playlist-track-row ${active ? "active" : ""}`}
                  onClick={() => onPlayTrack(index)}
                  type="button"
                >
                  <span className="playlist-track-copy">
                    <strong>{label}</strong>
                    <small>{playlistTrackHost(track.url)}</small>
                  </span>
                  {active ? <span className={badge("success")}>Играет</span> : <span className={badge()}>Play</span>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="copy">Добавь сюда несколько ссылок на YouTube или прямые аудио URL, чтобы запускать атмосферу одним кликом.</p>
      )}
    </CollapsibleSection>
  );
}

export function PlaylistEditorSection({
  title,
  hint,
  tracks,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  hint: string;
  tracks: PlaylistTrack[];
  onChange: (index: number, patch: Partial<PlaylistTrack>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <div className="stack compact">
          <span>{title}</span>
          <small>{hint}</small>
        </div>
        <button className="ghost" onClick={onAdd} type="button">
          Добавить трек
        </button>
      </div>

      <div className="playlist-editor-list">
        {tracks.length ? (
          tracks.map((track, index) => (
            <article key={`${track.url}-${index}`} className="entry-editor playlist-track-editor">
              <div className="row">
                <strong>Трек #{index + 1}</strong>
                <button className="ghost danger-action" onClick={() => onRemove(index)} type="button">
                  Удалить
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { title: event.target.value })}
                    placeholder="Ночной порт"
                    value={track.title}
                  />
                </label>
                <label className="field">
                  <span>Ссылка</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { url: event.target.value })}
                    placeholder="https://youtu.be/... или https://...mp3"
                    value={track.url}
                  />
                </label>
              </div>
            </article>
          ))
        ) : (
          <p className="copy">Пока треков нет. Можно вставлять ссылки на YouTube-видео или прямые аудио URL.</p>
        )}
      </div>
    </section>
  );
}

export function GallerySection({
  title,
  hint,
  items,
  compact = false,
  defaultCollapsed = false,
  displayLimit,
  action,
  onOpenFullscreen,
  onCopyLink
}: {
  title: string;
  hint: string;
  items: GalleryImage[];
  compact?: boolean;
  defaultCollapsed?: boolean;
  displayLimit?: number;
  action?: ReactNode;
  onOpenFullscreen: (index: number) => void;
  onCopyLink: (url: string) => Promise<void> | void;
}) {
  const visibleItems = typeof displayLimit === "number" ? items.slice(0, displayLimit) : items;

  return (
    <CollapsibleSection
      action={action}
      className={`gallery-section ${compact ? "compact" : ""}`}
      defaultCollapsed={defaultCollapsed}
      hint={hint}
      summary={
        <p className="copy">
          {items.length
            ? `${items.length} изображений${displayLimit && items.length > visibleItems.length ? ` • показаны первые ${visibleItems.length}` : ""}`
            : "Галерея пока пустая."}
        </p>
      }
      title={title}
    >
      {visibleItems.length ? (
        <div className={`gallery-grid ${compact ? "compact" : ""}`}>
          {visibleItems.map((item, index) => (
            <article key={`${item.url}-${index}`} className="card gallery-card">
              <button className="gallery-image-button" onClick={() => onOpenFullscreen(index)} type="button">
                <img alt={item.caption ?? galleryImageTitle(item, index)} className="gallery-image" loading="lazy" src={item.url} />
              </button>
              <div className="gallery-card-copy">
                <strong>{galleryImageTitle(item, index)}</strong>
                <small>{item.caption?.trim() || "Открывается на весь экран, ссылку можно копировать отдельно."}</small>
              </div>
              <div className="actions gallery-card-actions">
                <button
                  className="ghost"
                  onClick={() => {
                    void onCopyLink(item.url);
                  }}
                  type="button"
                >
                  Скопировать
                </button>
                <button className="ghost" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} type="button">
                  Файл
                </button>
                <button className="primary" onClick={() => onOpenFullscreen(index)} type="button">
                  Открыть
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="copy">Сюда удобно складывать карты, письма, договоры, гербы, handout-арты и любые другие игровые изображения.</p>
      )}
    </CollapsibleSection>
  );
}

export function GalleryEditorSection({
  title,
  hint,
  items,
  onChange,
  onAdd,
  onRemove,
  onUpload,
  uploadDisabled = false,
  uploadingIndex = null
}: {
  title: string;
  hint: string;
  items: GalleryImage[];
  onChange: (index: number, patch: Partial<GalleryImage>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpload?: (index: number, file: File) => Promise<void> | void;
  uploadDisabled?: boolean;
  uploadingIndex?: number | null;
}) {
  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <div className="stack compact">
          <span>{title}</span>
          <small>{hint}</small>
        </div>
        <button className="ghost" onClick={onAdd} type="button">
          Добавить изображение
        </button>
      </div>

      <div className="playlist-editor-list">
        {items.length ? (
          items.map((item, index) => (
            <article key={`${item.url}-${index}`} className="entry-editor gallery-editor-card">
              <div className="row">
                <strong>{galleryImageTitle(item, index)}</strong>
                <div className="actions">
                  {onUpload ? (
                    <label className={`ghost media-upload-trigger ${uploadDisabled ? "disabled" : ""}`}>
                      <input
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="media-upload-input"
                        disabled={uploadDisabled}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) {
                            return;
                          }
                          void onUpload(index, file);
                        }}
                        type="file"
                      />
                      {uploadingIndex === index ? "Загружаю..." : "Загрузить файл"}
                    </label>
                  ) : null}
                  <button className="ghost danger-action" onClick={() => onRemove(index)} type="button">
                    Удалить
                  </button>
                </div>
              </div>

              <div className="gallery-editor-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { title: event.target.value })}
                    placeholder="Карта Нижнего рынка"
                    value={item.title}
                  />
                </label>
                <label className="field">
                  <span>Ссылка</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { url: event.target.value })}
                    placeholder="https://...png или загрузи файл"
                    value={item.url}
                  />
                </label>
                <label className="field field-full">
                  <span>Подпись</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { caption: event.target.value })}
                    placeholder="Что это за handout и когда его показать игрокам"
                    value={item.caption ?? ""}
                  />
                </label>
              </div>

              {item.url.trim() ? (
                <button className="gallery-editor-preview" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} type="button">
                  <img alt={item.caption ?? galleryImageTitle(item, index)} className="gallery-image" loading="lazy" src={item.url} />
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <p className="copy">Пока изображений нет. Можно вставлять прямые URL на карты, письма, портреты и любые handout-материалы.</p>
        )}
      </div>
    </section>
  );
}

export function GalleryLightbox({
  viewer,
  onClose,
  onSelect,
  onCopyLink
}: {
  viewer: GalleryViewerState;
  onClose: () => void;
  onSelect: (index: number) => void;
  onCopyLink: (url: string) => Promise<void>;
}) {
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
