import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import type {
  DeepZoomSource,
  PlayerDisplayFogPoint,
  PlayerDisplayFogRegion,
  PlayerDisplayGridSettings,
  PlayerDisplayToken,
  PlayerDisplayViewport,
  PlayerDisplayWall,
} from "@shadow-edge/shared-types";
import { api } from "./api";

type Props = { campaignId: string; open: boolean; onClose: () => void };
const youtubeId = (raw: string) => {
  try {
    const u = new URL(raw.trim());
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(h))
      return (
        u.searchParams.get("v") ||
        u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ||
        ""
      );
  } catch {
    return "";
  }
  return "";
};
const eventPoint = (
  event: ReactPointerEvent<SVGSVGElement>,
): PlayerDisplayFogPoint => {
  const r = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
  };
};
const svgPoints = (points: PlayerDisplayFogPoint[]) =>
  points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ");
const hexGridPath = (size: number, aspect: number) => {
  const r = size * 1000,
    w = r * 1.732,
    y = (value: number) => value * aspect;
  const hex = (cx: number, cy: number) =>
    `M ${cx} ${y(cy - r)} L ${cx + w / 2} ${y(cy - r / 2)} L ${cx + w / 2} ${y(cy + r / 2)} L ${cx} ${y(cy + r)} L ${cx - w / 2} ${y(cy + r / 2)} L ${cx - w / 2} ${y(cy - r / 2)} Z `;
  return (
    hex(w / 2, r) +
    hex(w * 1.5, r) +
    hex(0, r * 2.5) +
    hex(w, r * 2.5) +
    hex(w * 2, r * 2.5)
  );
};
const clampViewport = (value: PlayerDisplayViewport): PlayerDisplayViewport => {
  const zoom = Math.max(1, Math.min(6, value.zoom)),
    limit = (zoom - 1) / 2;
  return {
    zoom,
    x: Math.max(-limit, Math.min(limit, value.x)),
    y: Math.max(-limit, Math.min(limit, value.y)),
  };
};
const wallHull = (walls: PlayerDisplayWall[]) => {
  const points = walls.flatMap((w) =>
    w.points?.length ? w.points : [w.start, w.end],
  );
  if (points.length < 3) return [];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y),
    cross = (
      o: PlayerDisplayFogPoint,
      a: PlayerDisplayFogPoint,
      b: PlayerDisplayFogPoint,
    ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x),
    lower: PlayerDisplayFogPoint[] = [],
    upper: PlayerDisplayFogPoint[] = [];
  for (const p of sorted) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of sorted.reverse()) {
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};
const pointInPolygon = (
  point: PlayerDisplayFogPoint,
  polygon: PlayerDisplayFogPoint[],
) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
};

function DeepZoomLayer({
  source,
  viewport,
  style,
}: {
  source: DeepZoomSource;
  viewport: PlayerDisplayViewport;
  style: CSSProperties;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1000, height: 1000 });
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const level = Math.max(
    0,
    Math.min(
      source.maxLevel,
      Math.ceil(Math.log2(Math.max(size.width, size.height) * viewport.zoom)),
    ),
  );
  const divisor = 2 ** (source.maxLevel - level),
    levelWidth = Math.ceil(source.width / divisor),
    levelHeight = Math.ceil(source.height / divisor);
  const left = Math.max(0, 0.5 + (-0.5 - viewport.x) / viewport.zoom),
    right = Math.min(1, 0.5 + (0.5 - viewport.x) / viewport.zoom),
    top = Math.max(0, 0.5 + (-0.5 - viewport.y) / viewport.zoom),
    bottom = Math.min(1, 0.5 + (0.5 - viewport.y) / viewport.zoom);
  const firstCol = Math.max(
      0,
      Math.floor((left * levelWidth) / source.tileSize) - 8,
    ),
    lastCol = Math.min(
      Math.ceil(levelWidth / source.tileSize) - 1,
      Math.floor((right * levelWidth) / source.tileSize) + 8,
    ),
    firstRow = Math.max(
      0,
      Math.floor((top * levelHeight) / source.tileSize) - 8,
    ),
    lastRow = Math.min(
      Math.ceil(levelHeight / source.tileSize) - 1,
      Math.floor((bottom * levelHeight) / source.tileSize) + 8,
    );
  const tiles = [];
  for (let row = firstRow; row <= lastRow; row++)
    for (let col = firstCol; col <= lastCol; col++) {
      const width = Math.min(
          source.tileSize,
          levelWidth - col * source.tileSize,
        ),
        height = Math.min(source.tileSize, levelHeight - row * source.tileSize);
      tiles.push(
        <img
          alt=""
          draggable={false}
          key={`${level}-${col}-${row}`}
          src={`${source.tileBaseUrl}/${level}/${col}_${row}.${source.format}`}
          style={{
            position: "absolute",
            left: `${((col * source.tileSize) / levelWidth) * 100}%`,
            top: `${((row * source.tileSize) / levelHeight) * 100}%`,
            width: `calc(${(width / levelWidth) * 100}% + 1px)`,
            height: `calc(${(height / levelHeight) * 100}% + 1px)`,
            maxWidth: "none",
          }}
        />,
      );
    }
  return (
    <div className="session-map-tile-viewport" ref={host}>
      <div className="session-map-tile-layer" style={style}>
        {tiles}
      </div>
    </div>
  );
}

export function SessionMapModal({ campaignId, open, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [roofUrl, setRoofUrl] = useState("");
  const [mediaType, setMediaType] = useState<
    "image" | "youtube" | "video" | "tiles"
  >("image");
  const [deepZoom, setDeepZoom] = useState<DeepZoomSource | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("Карта приключения");
  const [regions, setRegions] = useState<PlayerDisplayFogRegion[]>([]);
  const [walls, setWalls] = useState<PlayerDisplayWall[]>([]);
  const [token, setToken] = useState<PlayerDisplayToken | null>(null);
  const [tool, setTool] = useState<"fog" | "wall" | "door" | "token" | null>(
    null,
  );
  const [draft, setDraft] = useState<PlayerDisplayFogPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");
  const [grid, setGrid] = useState<PlayerDisplayGridSettings>({
    type: "none",
    size: 0.08,
    color: "#ffffff",
    opacity: 0.35,
  });
  const [viewport, setViewport] = useState<PlayerDisplayViewport>({
    zoom: 1,
    x: 0,
    y: 0,
  });
  const [regionMenu, setRegionMenu] = useState<{
    kind: "region" | "wall";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const drawing = useRef(false);
  const draftRef = useRef<PlayerDisplayFogPoint[]>([]);
  const previewPlayer = useRef<HTMLIFrameElement | null>(null);
  const [previewMuted, setPreviewMuted] = useState(true);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const mapShell = useRef<HTMLDivElement | null>(null);
  const pan = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewport: PlayerDisplayViewport;
    next: PlayerDisplayViewport;
    moved: boolean;
  } | null>(null);
  const suppressContext = useRef(false);
  const wheelTimer = useRef<number>();
  const [imageAspect, setImageAspect] = useState(1);
  const mapAspect =
    mediaType === "youtube"
      ? 16 / 9
      : deepZoom
        ? deepZoom.width / deepZoom.height
        : imageAspect;
  const visionCellSize = grid.type === "none" ? 0.01 : grid.size;
  const roofPolygon = wallHull(walls);
  const tokenInsideRoof = Boolean(
    token && roofPolygon.length > 2 && pointInPolygon(token, roofPolygon),
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = old;
    };
  }, [onClose, open]);
  if (!open || typeof document === "undefined") return null;

  const publish = async (
    nextRegions = regions,
    nextWalls = walls,
    nextToken = token,
    openDisplay = false,
    nextGrid = grid,
    nextViewport = viewport,
  ) => {
    if (!imageUrl) {
      setNotice("Сначала загрузите или подключите карту.");
      return;
    }
    const displayWindow = openDisplay
      ? window.open("about:blank", "shadow-edge-session-display")
      : null;
    const shell = mapShell.current;
    const mapAspectRatio =
      mediaType === "youtube"
        ? 16 / 9
        : shell && shell.clientHeight
          ? shell.clientWidth / shell.clientHeight
          : 1;
    setBusy(true);
    try {
      const share = await api.showPlayerDisplayImage(campaignId, {
        alt: title || "Карта игровой сессии",
        deepZoom: deepZoom ?? undefined,
        fogRegions: nextRegions,
        grid: nextGrid,
        viewport: nextViewport,
        walls: nextWalls,
        token: nextToken ?? undefined,
          mapAspectRatio,
          mediaType,
          roofUrl: roofUrl || undefined,
          sessionMap: true,
        title,
        url: imageUrl,
      });
      setDisplayUrl(share.url);
      if (openDisplay && displayWindow) {
        displayWindow.location.href = share.url;
        displayWindow.focus();
        setNotice("Экран игроков открыт.");
      } else if (openDisplay) {
        setNotice(
          "Браузер заблокировал окно. Разреши всплывающие окна для приложения и нажми ещё раз.",
        );
      } else setNotice("Экран игроков обновлён.");
    } catch (error) {
      displayWindow?.close();
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось обновить экран игроков.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateRegions = (next: PlayerDisplayFogRegion[]) => {
    setRegions(next);
    if (displayUrl) void publish(next, walls, token);
  };
  const updateWalls = (next: PlayerDisplayWall[]) => {
    setWalls(next);
    if (displayUrl) void publish(regions, next, token);
  };
  const updateToken = (next: PlayerDisplayToken | null) => {
    setToken(next);
    if (displayUrl) void publish(regions, walls, next);
  };
  const updateGrid = (next: PlayerDisplayGridSettings) => {
    setGrid(next);
    if (displayUrl) void publish(regions, walls, token, false, next);
  };
  const resetFog = () => {
    setRegions([]);
    setWalls([]);
    setToken(null);
    setDraft([]);
    draftRef.current = [];
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 2);
    if (!files.length) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => ({ file, result: await api.uploadImage(campaignId, file) })),
      );
      const base = uploaded.reduce((best, item) =>
        (item.result.vtt?.walls.length ?? 0) > (best.result.vtt?.walls.length ?? 0) ? item : best,
      );
      const roof = uploaded.length > 1 ? uploaded.find((item) => item !== base) : undefined;
      const { file, result } = base;
      const video = result.contentType.startsWith("video/");
      setImageUrl(result.url);
      setRoofUrl(roof?.result.url ?? "");
      setDeepZoom(result.deepZoom ?? null);
      setMediaType(result.deepZoom ? "tiles" : video ? "video" : "image");
      setTitle(file.name.replace(/\.[^.]+$/, "") || "Карта приключения");
      setPreviewMuted(true);
      resetFog();
      if (result.vtt) {
        setWalls(result.vtt.walls);
        setGrid({
          type: "square",
          size: result.vtt.gridSize,
          color: "#ffffff",
          opacity: 0.35,
        });
        setNotice(roof
          ? `Пара Universal VTT импортирована: интерьер, крыша и ${result.vtt.walls.length} стен и дверей.`
          : `Universal VTT импортирован: ${result.vtt.walls.length} стен и дверей, карта ${result.vtt.mapWidth}×${result.vtt.mapHeight} клеток.`);
      } else
        setNotice(
          video
            ? "Видео-карта загружена и будет воспроизводиться по кругу."
            : "Карта загружена. Обведите скрываемые области.",
        );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не удалось загрузить карту.",
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  const useUrl = () => {
    const value = sourceUrl.trim();
    if (!value) return;
    const id = youtubeId(value);
    if (id) {
      setImageUrl(value);
      setRoofUrl("");
      setDeepZoom(null);
      setMediaType("youtube");
      setTitle("Анимированная карта");
      resetFog();
      setNotice("YouTube-карта подключена. Обведите зоны тумана.");
      return;
    }
    try {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      setImageUrl(value);
      setRoofUrl("");
      setDeepZoom(null);
      setMediaType("image");
      resetFog();
      setNotice("Карта по ссылке подключена.");
    } catch {
      setNotice("Укажите прямую ссылку на изображение или YouTube.");
    }
  };
  const begin = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 2) {
      event.preventDefault();
      setRegionMenu(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewport,
        next: viewport,
        moved: false,
      };
      return;
    }
    if (!tool || event.button !== 0) return;
    setRegionMenu(null);
    const p = eventPoint(event);
    if (tool === "token") {
      updateToken({
        ...p,
        visionRadius: token?.visionRadius ?? visionCellSize * 12,
      });
      drawing.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    draftRef.current = [p];
    setDraft([p]);
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pan.current?.pointerId === event.pointerId) {
      const shell = mapShell.current;
      if (!shell) return;
      const dx = (event.clientX - pan.current.startX) / shell.clientWidth,
        dy = (event.clientY - pan.current.startY) / shell.clientHeight;
      const next = clampViewport({
        ...pan.current.viewport,
        x: pan.current.viewport.x + dx,
        y: pan.current.viewport.y + dy,
      });
      pan.current.next = next;
      pan.current.moved =
        pan.current.moved ||
        Math.hypot(
          event.clientX - pan.current.startX,
          event.clientY - pan.current.startY,
        ) > 4;
      setViewport(next);
      return;
    }
    if (!tool || !drawing.current) return;
    const p = eventPoint(event);
    if (tool === "token") {
      setToken({ ...p, visionRadius: token?.visionRadius ?? 0.22 });
      return;
    }
    const last = draftRef.current.at(-1);
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.006) return;
    draftRef.current = [...draftRef.current, p];
    setDraft(draftRef.current);
  };
  const finish = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pan.current?.pointerId === event.pointerId) {
      const finished = pan.current;
      pan.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      suppressContext.current = finished.moved;
      if (finished.moved && displayUrl)
        void publish(regions, walls, token, false, grid, finished.next);
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (tool === "token") {
      const next = {
        ...eventPoint(event),
        visionRadius: token?.visionRadius ?? visionCellSize * 12,
      };
      setToken(next);
      if (displayUrl) void publish(regions, walls, next);
      return;
    }
    const points = draftRef.current;
    draftRef.current = [];
    setDraft([]);
    if (tool === "wall" || tool === "door") {
      if (points.length < 2) return;
      const kind = tool;
      const next = [
        ...walls,
        {
          id: crypto.randomUUID?.() ?? `${kind}-${Date.now()}`,
          kind,
          start: points[0],
          end: points.at(-1)!,
          points,
          disabled: false,
        },
      ];
      updateWalls(next);
      setNotice(
        kind === "door"
          ? "Добавлена закрытая дверь."
          : `Добавлена стена ${next.length}.`,
      );
      return;
    }
    if (points.length < 3) {
      setNotice("Нарисуйте область чуть длиннее.");
      return;
    }
    const next = [
      ...regions,
      {
        id: crypto.randomUUID?.() ?? `region-${Date.now()}`,
        points,
        revealed: false,
      },
    ];
    updateRegions(next);
    setNotice(`Добавлена область ${next.length}. Она скрыта.`);
  };
  const zoomMap = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const next = clampViewport({
      ...viewport,
      zoom: viewport.zoom * (event.deltaY < 0 ? 1.12 : 0.89),
    });
    setViewport(next);
    if (displayUrl) {
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(
        () => void publish(regions, walls, token, false, grid, next),
        180,
      );
    }
  };
  const togglePreviewSound = () => {
    const next = !previewMuted;
    previewPlayer.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: next ? "mute" : "unMute",
        args: [],
      }),
      "https://www.youtube-nocookie.com",
    );
    if (previewVideo.current) previewVideo.current.muted = next;
    setPreviewMuted(next);
  };
  const openRegionMenu = (
    event: ReactMouseEvent<SVGElement>,
    kind: "region" | "wall",
    id: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (suppressContext.current) {
      suppressContext.current = false;
      return;
    }
    setRegionMenu({ kind, id, x: event.clientX, y: event.clientY });
  };
  const deleteRegionFromMenu = () => {
    if (!regionMenu) return;
    if (regionMenu.kind === "wall")
      updateWalls(walls.filter((wall) => wall.id !== regionMenu.id));
    else updateRegions(regions.filter((region) => region.id !== regionMenu.id));
    setRegionMenu(null);
  };
  const toggleWallFromMenu = () => {
    if (!regionMenu || regionMenu.kind !== "wall") return;
    updateWalls(
      walls.map((wall) =>
        wall.id === regionMenu.id
          ? { ...wall, disabled: !wall.disabled }
          : wall,
      ),
    );
    setRegionMenu(null);
  };
  const resetViewport = () => {
    const next = { zoom: 1, x: 0, y: 0 };
    setViewport(next);
    if (displayUrl) void publish(regions, walls, token, false, grid, next);
  };
  const rotateDisplayLink = async () => {
    setBusy(true);
    try {
      const share = await api.rotatePlayerDisplayLink(campaignId);
      setDisplayUrl(share.url);
      const copied = await navigator.clipboard?.writeText(share.url).then(() => true).catch(() => false);
      setNotice(copied
        ? "Создана новая ссылка на телевизор и скопирована. Старая ссылка больше не работает."
        : "Создана новая ссылка на телевизор. Старая ссылка больше не работает.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось создать новую ссылку.");
    } finally {
      setBusy(false);
    }
  };
  const cameraStyle: CSSProperties = {
    transform: `translate(${viewport.x * 100}%,${viewport.y * 100}%) scale(${viewport.zoom})`,
    transformOrigin: "center",
  };

  return createPortal(
    <div
      className="session-map-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
        else setRegionMenu(null);
      }}
    >
      <section aria-modal="true" className="session-map-modal" role="dialog">
        <header className="session-map-head">
          <div>
            <p className="eyebrow">Режим сессии</p>
            <h2>Карта на телевизоре</h2>
            <p>Обводите комнаты и открывайте их по мере исследования.</p>
          </div>
          <button
            aria-label="Закрыть"
            className="ghost"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>
        <div className="session-map-layout">
          <div className="session-map-stage">
            {imageUrl ? (
              <div
                className={`session-map-image-shell ${mediaType === "youtube" || mediaType === "video" ? "video" : mediaType === "tiles" ? "tiled" : ""}`}
                ref={mapShell}
                style={
                  mediaType === "tiles" && deepZoom
                    ? { aspectRatio: `${deepZoom.width}/${deepZoom.height}` }
                    : undefined
                }
              >
                {mediaType === "youtube" ? (
                  <iframe
                    allow="autoplay; encrypted-media"
                    ref={previewPlayer}
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId(imageUrl)}?autoplay=1&mute=1&loop=1&playlist=${youtubeId(imageUrl)}&controls=0&disablekb=1&enablejsapi=1&fs=0&playsinline=1&rel=0`}
                    style={cameraStyle}
                    title={title}
                  />
                ) : mediaType === "video" ? (
                  <video
                    autoPlay
                    loop
                    muted
                    ref={previewVideo}
                    onLoadedMetadata={(event) =>
                      setImageAspect(
                        event.currentTarget.videoWidth /
                          event.currentTarget.videoHeight || 1,
                      )
                    }
                    playsInline
                    src={imageUrl}
                    style={cameraStyle}
                  />
                ) : mediaType === "tiles" && deepZoom ? (
                  <DeepZoomLayer
                    source={deepZoom}
                    style={cameraStyle}
                    viewport={viewport}
                  />
                ) : (
                  <img
                    alt={title}
                    onLoad={(event) =>
                      setImageAspect(
                        event.currentTarget.naturalWidth /
                          event.currentTarget.naturalHeight || 1,
                      )
                    }
                    src={imageUrl}
                    style={cameraStyle}
                  />
                )}
                {grid.type !== "none" ? (
                  <svg
                    className="session-map-grid-preview"
                    preserveAspectRatio="none"
                    style={cameraStyle}
                    viewBox="0 0 1000 1000"
                  >
                    <defs>
                      <pattern
                        height={
                          grid.type === "hex"
                            ? grid.size * 3000 * mapAspect
                            : grid.size * 1000 * mapAspect
                        }
                        id="master-grid"
                        patternUnits="userSpaceOnUse"
                        width={
                          grid.type === "hex"
                            ? grid.size * 3464
                            : grid.size * 1000
                        }
                      >
                        {grid.type === "square" ? (
                          <path
                            d={`M ${grid.size * 1000} 0 H 0 V ${grid.size * 1000 * mapAspect}`}
                            fill="none"
                            stroke={grid.color}
                            strokeWidth="1.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : (
                          <path
                            d={hexGridPath(grid.size, mapAspect)}
                            fill="none"
                            stroke={grid.color}
                            strokeWidth="1.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </pattern>
                    </defs>
                    <rect
                      fill="url(#master-grid)"
                      height="1000"
                      opacity={grid.opacity}
                      width="1000"
                    />
                  </svg>
                ) : null}
                <svg
                  className={`session-map-region-editor ${tool ? "drawing" : ""}`}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={begin}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onWheel={zoomMap}
                  preserveAspectRatio="none"
                  style={cameraStyle}
                  viewBox="0 0 1000 1000"
                >
                  {regions.map((r, i) => (
                    <polygon
                      className={r.revealed ? "revealed" : "hidden"}
                      key={r.id}
                      onContextMenu={(event) =>
                        openRegionMenu(event, "region", r.id)
                      }
                      points={svgPoints(r.points)}
                    >
                      <title>{`Область ${i + 1}`}</title>
                    </polygon>
                  ))}
                  {walls.map((w) => {
                    const points = w.points?.length
                      ? w.points
                      : [w.start, w.end];
                    return (
                      <g key={w.id}>
                        <polyline
                          className="map-wall-hit"
                          onContextMenu={(event) =>
                            openRegionMenu(event, "wall", w.id)
                          }
                          points={svgPoints(points)}
                        />
                        <polyline
                          className={`map-wall ${w.kind === "door" ? "door" : ""} ${w.disabled ? "disabled" : ""}`}
                          points={svgPoints(points)}
                        />
                      </g>
                    );
                  })}
                  {token ? (
                    <ellipse
                      className="vision-preview"
                      cx={token.x * 1000}
                      cy={token.y * 1000}
                      rx={token.visionRadius * 1000}
                      ry={
                        token.visionRadius *
                        1000 *
                        (mediaType === "youtube"
                          ? 16 / 9
                          : mapShell.current && mapShell.current.clientHeight
                            ? mapShell.current.clientWidth /
                              mapShell.current.clientHeight
                            : 1)
                      }
                    />
                  ) : null}
                  {draft.length > 1 ? (
                    <polyline
                      className={
                        tool === "wall" || tool === "door"
                          ? "draft wall-draft"
                          : "draft"
                      }
                      points={svgPoints(draft)}
                    />
                  ) : null}
                </svg>
                {roofUrl && roofPolygon.length > 2 ? (
                  <svg
                    className={`session-map-roof ${tokenInsideRoof ? "inside" : ""}`}
                    preserveAspectRatio="none"
                    style={cameraStyle}
                    viewBox="0 0 1000 1000"
                  >
                    <defs>
                      <clipPath id="master-roof-clip">
                        <polygon points={svgPoints(roofPolygon)} />
                      </clipPath>
                    </defs>
                    <image
                      clipPath="url(#master-roof-clip)"
                      height="1000"
                      href={roofUrl}
                      preserveAspectRatio="none"
                      width="1000"
                    />
                  </svg>
                ) : null}
                {token ? (
                  <img
                    alt="Фишка игрока"
                    className="map-token-screen"
                    src="/session-token.png"
                    style={{
                      left: `${(0.5 + (token.x - 0.5) * viewport.zoom + viewport.x) * 100}%`,
                      top: `${(0.5 + (token.y - 0.5) * viewport.zoom + viewport.y) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            ) : (
              <label className="session-map-dropzone">
                <strong>Загрузить карту</strong>
                <span>Universal VTT, изображение или видео до 300 МБ</span>
                <input
                  accept=".dd2vtt,image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  disabled={busy}
                  multiple
                  onChange={upload}
                  type="file"
                />
              </label>
            )}
          </div>
          <aside className="session-map-controls">
            <label>
              Ссылка на карту или YouTube
              <div className="session-map-url-row">
                <input
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                  value={sourceUrl}
                />
                <button className="ghost" onClick={useUrl} type="button">
                  Подключить
                </button>
              </div>
            </label>
            {imageUrl ? (
              <label className="session-map-upload-small">
                Заменить карту, VTT или видео
                <input
                  accept=".dd2vtt,image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  disabled={busy}
                  multiple
                  onChange={upload}
                  type="file"
                />
              </label>
            ) : null}
            <label>
              Название сцены
              <input onChange={(e) => setTitle(e.target.value)} value={title} />
            </label>
            {mediaType === "youtube" || mediaType === "video" ? (
              <button
                className="ghost"
                onClick={togglePreviewSound}
                type="button"
              >
                {previewMuted
                  ? "Включить музыку у мастера"
                  : "Выключить музыку у мастера"}
              </button>
            ) : null}
            <div className="session-map-tool-grid">
              <button
                className={tool === "fog" ? "primary" : "ghost"}
                disabled={!imageUrl}
                onClick={() => setTool(tool === "fog" ? null : "fog")}
                type="button"
              >
                Туман
              </button>
              <button
                className={tool === "wall" ? "primary" : "ghost"}
                disabled={!imageUrl}
                onClick={() => setTool(tool === "wall" ? null : "wall")}
                type="button"
              >
                Стена
              </button>
              <button
                className={tool === "door" ? "primary" : "ghost"}
                disabled={!imageUrl}
                onClick={() => setTool(tool === "door" ? null : "door")}
                type="button"
              >
                Дверь
              </button>
              <button
                className={tool === "token" ? "primary" : "ghost"}
                disabled={!imageUrl}
                onClick={() => setTool(tool === "token" ? null : "token")}
                type="button"
              >
                Фишка
              </button>
            </div>
            <div className="session-map-camera-row">
              <span>Масштаб {Math.round(viewport.zoom * 100)}%</span>
              <button
                className="ghost"
                disabled={
                  viewport.zoom === 1 && viewport.x === 0 && viewport.y === 0
                }
                onClick={resetViewport}
                type="button"
              >
                Сбросить вид
              </button>
            </div>
            <details className="session-map-settings">
              <summary>
                Сетка карты{" "}
                <span>
                  {grid.type === "none"
                    ? "выключена"
                    : grid.type === "square"
                      ? "квадраты"
                      : "гексы"}
                </span>
              </summary>
              <div className="session-map-settings-body">
                <div className="session-map-grid-types">
                  <button
                    className={grid.type === "none" ? "primary" : "ghost"}
                    onClick={() => updateGrid({ ...grid, type: "none" })}
                    type="button"
                  >
                    Нет
                  </button>
                  <button
                    className={grid.type === "square" ? "primary" : "ghost"}
                    onClick={() => updateGrid({ ...grid, type: "square" })}
                    type="button"
                  >
                    Квадраты
                  </button>
                  <button
                    className={grid.type === "hex" ? "primary" : "ghost"}
                    onClick={() => updateGrid({ ...grid, type: "hex" })}
                    type="button"
                  >
                    Гексы
                  </button>
                </div>
                {grid.type !== "none" ? (
                  <>
                    <label>
                      Размер клетки: {Math.round(grid.size * 1000)}
                      <input
                        max="200"
                        min="5"
                        onChange={(e) =>
                          updateGrid({
                            ...grid,
                            size: Number(e.target.value) / 1000,
                          })
                        }
                        type="range"
                        value={Math.round(grid.size * 1000)}
                      />
                      <small>
                        Положите фигурку 25 мм на телевизор и совместите
                        основание с клеткой.
                      </small>
                    </label>
                    <div className="session-map-grid-style">
                      <label>
                        Цвет
                        <input
                          onChange={(e) =>
                            updateGrid({ ...grid, color: e.target.value })
                          }
                          type="color"
                          value={grid.color}
                        />
                      </label>
                      <label>
                        Прозрачность: {Math.round(grid.opacity * 100)}%
                        <input
                          max="100"
                          min="5"
                          onChange={(e) =>
                            updateGrid({
                              ...grid,
                              opacity: Number(e.target.value) / 100,
                            })
                          }
                          type="range"
                          value={Math.round(grid.opacity * 100)}
                        />
                      </label>
                    </div>
                  </>
                ) : null}
              </div>
            </details>
            {token ? (
              <label>
                Радиус зрения:{" "}
                {Math.round((token.visionRadius / visionCellSize) * 5)} футов
                <input
                  max="300"
                  min="5"
                  step="5"
                  onChange={(event) =>
                    updateToken({
                      ...token,
                      visionRadius:
                        (Number(event.target.value) / 5) * visionCellSize,
                    })
                  }
                  type="range"
                  value={Math.round((token.visionRadius / visionCellSize) * 5)}
                />
                <small>
                  Одна клетка равна 5 футам. По умолчанию — 60 футов, или 12
                  клеток.
                </small>
              </label>
            ) : null}
            <p className="session-map-source-hint">
              Зажмите мышь и обведите комнату или зону. Контур замкнётся
              автоматически.
            </p>
            <div className="session-map-region-list">
              {regions.map((r, i) => (
                <div className="session-map-region-row" key={r.id}>
                  <span>Область {i + 1}</span>
                  <button
                    className="ghost"
                    onClick={() =>
                      updateRegions(
                        regions.map((item) =>
                          item.id === r.id
                            ? { ...item, revealed: !item.revealed }
                            : item,
                        ),
                      )
                    }
                    type="button"
                  >
                    {r.revealed ? "Скрыть" : "Показать"}
                  </button>
                  <button
                    aria-label="Удалить"
                    className="ghost danger"
                    onClick={() =>
                      updateRegions(regions.filter((item) => item.id !== r.id))
                    }
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!regions.length ? (
                <p className="session-map-tip">
                  Нарисованных областей пока нет.
                </p>
              ) : null}
            </div>
            {walls.length ? (
              <div className="session-map-region-list">
                {walls.map((wall, index) => (
                  <div className="session-map-region-row" key={wall.id}>
                    <span>
                      {wall.kind === "door" ? "Дверь" : "Стена"} {index + 1}
                    </span>
                    <button
                      className="ghost"
                      onClick={() =>
                        updateWalls(
                          walls.map((item) =>
                            item.id === wall.id
                              ? { ...item, disabled: !item.disabled }
                              : item,
                          ),
                        )
                      }
                      type="button"
                    >
                      {wall.kind === "door"
                        ? wall.disabled
                          ? "Закрыть"
                          : "Открыть"
                        : wall.disabled
                          ? "Включить"
                          : "Пропускать"}
                    </button>
                    <button
                      className="ghost danger"
                      onClick={() =>
                        updateWalls(walls.filter((item) => item.id !== wall.id))
                      }
                      type="button"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {token ? (
              <button
                className="ghost danger"
                onClick={() => updateToken(null)}
                type="button"
              >
                Убрать фишку
              </button>
            ) : null}
            <div className="session-map-actions-grid">
              <button
                className="ghost"
                onClick={() =>
                  updateRegions(regions.map((r) => ({ ...r, revealed: false })))
                }
                type="button"
              >
                Скрыть всё
              </button>
              <button
                className="ghost"
                onClick={() =>
                  updateRegions(regions.map((r) => ({ ...r, revealed: true })))
                }
                type="button"
              >
                Показать всё
              </button>
            </div>
            <button
              className="primary session-map-launch"
              disabled={busy || !imageUrl}
              onClick={() => void publish(regions, walls, token, true)}
              type="button"
            >
              {busy
                ? "Обновляю…"
                : displayUrl
                  ? "Открыть экран телевизора"
                  : "Запустить сцену"}
            </button>
            {displayUrl ? (
              <>
                <button className="ghost" disabled={busy} onClick={() => void rotateDisplayLink()} type="button">
                  Создать новую ссылку
                </button>
                <p className="session-map-tip">
                  Эта ссылка сохраняется для всех карт и после перезапуска приложения. Туман, стены и положение фишки обновляются автоматически.
                </p>
              </>
            ) : null}
            {notice ? <p className="session-map-notice">{notice}</p> : null}
          </aside>
        </div>
        {regionMenu ? (
          <div
            className="session-map-region-menu"
            onMouseDown={(event) => event.stopPropagation()}
            style={{ left: regionMenu.x, top: regionMenu.y }}
          >
            {regionMenu.kind === "wall" ? (
              <button onClick={toggleWallFromMenu} type="button">
                {walls.find((wall) => wall.id === regionMenu.id)?.kind ===
                "door"
                  ? walls.find((wall) => wall.id === regionMenu.id)?.disabled
                    ? "Закрыть дверь"
                    : "Открыть дверь"
                  : walls.find((wall) => wall.id === regionMenu.id)?.disabled
                    ? "Блокировать зрение"
                    : "Пропускать зрение"}
              </button>
            ) : null}
            <button onClick={deleteRegionFromMenu} type="button">
              {regionMenu.kind === "wall"
                ? walls.find((wall) => wall.id === regionMenu.id)?.kind ===
                  "door"
                  ? "Удалить дверь"
                  : "Удалить стену"
                : "Удалить область"}
            </button>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
