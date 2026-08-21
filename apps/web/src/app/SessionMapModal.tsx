import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "./api";

type SessionMapModalProps = {
  campaignId: string;
  open: boolean;
  onClose: () => void;
};

const DEFAULT_ROWS = 8;
const DEFAULT_COLUMNS = 12;

export function SessionMapModal({ campaignId, open, onClose }: SessionMapModalProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("Карта приключения");
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [showGrid, setShowGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  const cellCount = rows * columns;
  const cells = useMemo(() => Array.from({ length: cellCount }, (_, index) => index), [cellCount]);

  if (!open || typeof document === "undefined") return null;

  const publish = async (nextRevealed = revealed, openDisplay = false) => {
    if (!imageUrl) {
      setNotice("Сначала загрузите карту.");
      return;
    }
    setBusy(true);
    try {
      const share = await api.showPlayerDisplayImage(campaignId, {
        alt: title || "Карта игровой сессии",
        fogColumns: columns,
        fogRows: rows,
        revealed: [...nextRevealed],
        showGrid,
        sessionMap: true,
        title,
        url: imageUrl
      });
      setDisplayUrl(share.url);
      setNotice("Экран игроков обновлён.");
      if (openDisplay) {
        const popup = window.open(share.url, "shadow-edge-session-display");
        popup?.focus();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось обновить экран игроков.");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const result = await api.uploadImage(campaignId, file);
      setImageUrl(result.url);
      setTitle(file.name.replace(/\.[^.]+$/, "") || "Карта приключения");
      setRevealed(new Set());
      setNotice("Карта загружена. Все зоны пока скрыты.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось загрузить карту.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const toggleCell = (index: number) => {
    const next = new Set(revealed);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setRevealed(next);
    if (displayUrl) void publish(next);
  };

  const replaceRevealed = (next: Set<number>) => {
    setRevealed(next);
    if (displayUrl) void publish(next);
  };

  return createPortal(
    <div className="session-map-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-modal="true" className="session-map-modal" role="dialog">
        <header className="session-map-head">
          <div>
            <p className="eyebrow">Режим сессии</p>
            <h2>Карта на телевизоре</h2>
            <p>Загрузите карту и открывайте игрокам только исследованные зоны.</p>
          </div>
          <button aria-label="Закрыть" className="ghost" onClick={onClose} type="button">✕</button>
        </header>

        <div className="session-map-layout">
          <div className="session-map-stage">
            {imageUrl ? (
              <div className="session-map-image-shell">
                <img alt={title} src={imageUrl} />
                <div
                  className={`session-map-fog ${showGrid ? "show-grid" : ""}`}
                  style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
                >
                  {cells.map((index) => (
                    <button
                      aria-label={revealed.has(index) ? "Скрыть зону" : "Открыть зону"}
                      className={revealed.has(index) ? "revealed" : ""}
                      key={index}
                      onClick={() => toggleCell(index)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <label className="session-map-dropzone">
                <strong>Загрузить карту</strong>
                <span>PNG, JPG, WEBP или GIF до 10 МБ</span>
                <input accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={upload} type="file" />
              </label>
            )}
          </div>

          <aside className="session-map-controls">
            {imageUrl ? <label className="session-map-upload-small">Заменить карту<input accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={upload} type="file" /></label> : null}
            <label>Название сцены<input onChange={(event) => setTitle(event.target.value)} value={title} /></label>
            <div className="session-map-resolution">
              <label>Строки<input max="24" min="2" onChange={(event) => { setRows(Number(event.target.value)); setRevealed(new Set()); }} type="number" value={rows} /></label>
              <label>Колонки<input max="24" min="2" onChange={(event) => { setColumns(Number(event.target.value)); setRevealed(new Set()); }} type="number" value={columns} /></label>
            </div>
            <label className="session-map-check"><input checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} type="checkbox" /> Показывать сетку на телевизоре</label>
            <div className="session-map-actions-grid">
              <button className="ghost" onClick={() => replaceRevealed(new Set())} type="button">Скрыть всё</button>
              <button className="ghost" onClick={() => replaceRevealed(new Set(cells))} type="button">Открыть всё</button>
            </div>
            <button className="primary session-map-launch" disabled={busy || !imageUrl} onClick={() => void publish(revealed, true)} type="button">
              {busy ? "Обновляю…" : displayUrl ? "Открыть экран телевизора" : "Запустить сцену"}
            </button>
            {displayUrl ? <p className="session-map-tip">Кликайте зоны на карте — телевизор обновится автоматически. На экране телевизора нажмите F или дважды кликните для полноэкранного режима.</p> : null}
            {notice ? <p className="session-map-notice">{notice}</p> : null}
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}
