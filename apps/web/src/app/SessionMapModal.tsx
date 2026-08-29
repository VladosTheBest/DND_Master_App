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
  PlayerDisplayRoofZone,
  PlayerDisplayToken,
  PlayerDisplayViewport,
  PlayerDisplayWall,
  UploadImageResult,
} from "@shadow-edge/shared-types";
import { api } from "./api";

type Props = { campaignId: string; open: boolean; onClose: () => void };
type RoofMaskData = {
  url: string;
  width: number;
  height: number;
  insideLabels: Uint16Array;
  labels: Uint16Array;
  cutoutURLs: Map<number, string>;
};
type SessionMapLevel = {
  id: string;
  name: string;
  imageUrl: string;
  roofUrl: string;
  roofMask: RoofMaskData | null;
  roofZones: PlayerDisplayRoofZone[];
  deepZoom: DeepZoomSource | null;
  walls: PlayerDisplayWall[];
  grid: PlayerDisplayGridSettings;
};
const numberedLayerSuffix = (fileName: string) => {
  const match = fileName.match(/(?:^|[-_])(\d+)(?:\.[^.]+)?$/);
  return match ? Number(match[1]) : null;
};
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
const preloadDeepZoom = (
  source: DeepZoomSource | null,
  targetPixels = 1400,
) => {
  if (!source || typeof Image === "undefined") return;
  const level = Math.max(
    0,
    Math.min(source.maxLevel, Math.ceil(Math.log2(targetPixels))),
  );
  const divisor = 2 ** (source.maxLevel - level);
  const columns = Math.ceil(source.width / divisor / source.tileSize);
  const rows = Math.ceil(source.height / divisor / source.tileSize);
  if (columns * rows > 48) return;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const image = new Image();
      image.decoding = "async";
      image.src = `${source.tileBaseUrl}/${level}/${column}_${row}.${source.format}`;
    }
  }
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
const pointInRoofZone = (
  point: PlayerDisplayFogPoint,
  zone: PlayerDisplayRoofZone,
) =>
  pointInPolygon(point, zone.points) &&
  !(zone.openings ?? []).some((opening) => pointInPolygon(point, opening));
// VTT roof layers do not carry a footprint. Use one stable building footprint
// around the imported wall extents so the roof is a continuous layer, not a
// collection of room fragments.
const suggestedRoofZones = (
  walls: PlayerDisplayWall[],
): PlayerDisplayRoofZone[] => {
  const points = walls
    .filter((wall) => !wall.disabled)
    .flatMap((wall) =>
      (wall.points?.length ?? 0) >= 2
        ? wall.points!
        : [wall.start, wall.end],
    );
  if (points.length < 3) return [];
  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - 0.006);
  const maxX = Math.min(1, Math.max(...points.map((point) => point.x)) + 0.006);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - 0.006);
  const maxY = Math.min(1, Math.max(...points.map((point) => point.y)) + 0.006);
  return maxX - minX >= 0.025 && maxY - minY >= 0.025
    ? [
        {
          id: "imported-roof-footprint",
          points: [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
          ],
        },
      ]
    : [];
};

const clipSegmentToVisionCircle = (
  segment: { start: PlayerDisplayFogPoint; end: PlayerDisplayFogPoint },
  origin: PlayerDisplayFogPoint,
  aspect: number,
  radius: number,
) => {
  const start = {
    x: segment.start.x - origin.x,
    y: (segment.start.y - origin.y) / aspect,
  };
  const end = {
    x: segment.end.x - origin.x,
    y: (segment.end.y - origin.y) / aspect,
  };
  const delta = { x: end.x - start.x, y: end.y - start.y };
  const a = delta.x * delta.x + delta.y * delta.y;
  if (a <= 1e-24) return null;
  const b = 2 * (start.x * delta.x + start.y * delta.y);
  const c = start.x * start.x + start.y * start.y - radius * radius;
  let discriminant = b * b - 4 * a * c;
  const tolerance = 1e-12 * Math.max(1, b * b, Math.abs(4 * a * c));
  if (discriminant < -tolerance) return null;
  discriminant = Math.max(0, discriminant);
  const root = Math.sqrt(discriminant);
  const enter = Math.max(0, (-b - root) / (2 * a));
  const exit = Math.min(1, (-b + root) / (2 * a));
  if (exit - enter <= 1e-10) return null;
  const pointAt = (value: number): PlayerDisplayFogPoint => ({
    x: origin.x + start.x + delta.x * value,
    y: origin.y + (start.y + delta.y * value) * aspect,
  });
  return { start: pointAt(enter), end: pointAt(exit) };
};

// Keep the master preview aligned with the player screen: walls trim the vision polygon.
const visibilityPolygon = (
  token: PlayerDisplayToken,
  walls: PlayerDisplayWall[],
  aspectRatio: number,
) => {
  const origin = { x: token.x, y: token.y };
  const radius = Math.max(0.03, token.visionRadius || 0.22);
  const aspect = Math.max(0.2, aspectRatio || 1);
  const segments = walls
    .filter((wall) => !wall.disabled)
    .flatMap((wall) => {
      const points =
        (wall.points?.length ?? 0) >= 2
          ? wall.points!
          : [wall.start, wall.end];
      return points
        .slice(1)
        .map((end, index) => ({ start: points[index], end }));
    })
    // Clipped endpoints add the exact transition angles even when a long wall
    // crosses the FOV with both original endpoints outside it.
    .map((wall) => clipSegmentToVisionCircle(wall, origin, aspect, radius))
    .filter(
      (
        wall,
      ): wall is { start: PlayerDisplayFogPoint; end: PlayerDisplayFogPoint } =>
        Boolean(wall),
    );
  const angles: number[] = [];
  const seenAngles = new Set<number>();
  const pushAngle = (rawAngle: number) => {
    const angle = ((rawAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const key = Math.round(angle * 1e8);
    if (seenAngles.has(key)) return;
    seenAngles.add(key);
    angles.push(angle);
  };
  Array.from(
    { length: 180 },
    (_, index) => (Math.PI * 2 * index) / 180,
  ).forEach(pushAngle);
  segments.forEach((wall) =>
    [wall.start, wall.end].forEach((point) => {
      const angle = Math.atan2(
        (point.y - origin.y) / aspect,
        point.x - origin.x,
      );
      pushAngle(angle - 0.0001);
      pushAngle(angle);
      pushAngle(angle + 0.0001);
    }),
  );
  return angles
    .sort((a, b) => a - b)
    .map((angle) => {
      const ray = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * aspect,
      };
      let distance = 1;
      segments.forEach((wall) => {
        const segment = {
          x: wall.end.x - wall.start.x,
          y: wall.end.y - wall.start.y,
        };
        const cross = ray.x * segment.y - ray.y * segment.x;
        if (Math.abs(cross) < 1e-9) return;
        const offset = {
          x: wall.start.x - origin.x,
          y: wall.start.y - origin.y,
        };
        const t = (offset.x * segment.y - offset.y * segment.x) / cross;
        const u = (offset.x * ray.y - offset.y * ray.x) / cross;
        if (t >= 0 && t <= distance && u >= 0 && u <= 1) distance = t;
      });
      return { x: origin.x + ray.x * distance, y: origin.y + ray.y * distance };
    });
};

// This boundary is published with LOS so the television never derives a
// different ellipse from its own viewport dimensions.
const fovPolygon = (token: PlayerDisplayToken, aspectRatio: number) => {
  const radius = Math.max(0.03, token.visionRadius || 0.22);
  const aspect = Math.max(0.2, aspectRatio || 1);
  return Array.from({ length: 180 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 180;
    return {
      x: Math.max(0, Math.min(1, token.x + Math.cos(angle) * radius)),
      y: Math.max(0, Math.min(1, token.y + Math.sin(angle) * radius * aspect)),
    };
  });
};

type RoofMaskSource = {
  url: string;
  deepZoom: DeepZoomSource | null;
};
type RoofMaskRaster = {
  canvas: HTMLCanvasElement;
  sourceWidth: number;
  sourceHeight: number;
};

const maximumRoofMaskURLLength = 192 * 1024;

const loadRoofMaskImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось прочитать слой крыши."));
    image.src = url;
  });

// Read a complete low-resolution DZI level instead of decoding a 15k map into
// browser memory. At a 512px target the common VTT export fits in one tile.
const roofMaskRaster = async ({ url, deepZoom }: RoofMaskSource) => {
  const targetSize = 512;
  if (!deepZoom) {
    const image = await loadRoofMaskImage(url);
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("Слой крыши имеет некорректный размер.");
    const scale = Math.min(
      1,
      targetSize / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas недоступен.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      canvas,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
    } satisfies RoofMaskRaster;
  }

  const level = Math.max(
    0,
    Math.min(deepZoom.maxLevel, Math.floor(Math.log2(targetSize))),
  );
  const divisor = 2 ** (deepZoom.maxLevel - level);
  const width = Math.ceil(deepZoom.width / divisor);
  const height = Math.ceil(deepZoom.height / divisor);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен.");
  const columns = Math.ceil(width / deepZoom.tileSize);
  const rows = Math.ceil(height / deepZoom.tileSize);
  await Promise.all(
    Array.from({ length: rows * columns }, async (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const image = await loadRoofMaskImage(
        `${deepZoom.tileBaseUrl}/${level}/${column}_${row}.${deepZoom.format}`,
      );
      context.drawImage(
        image,
        column * deepZoom.tileSize,
        row * deepZoom.tileSize,
      );
    }),
  );
  return {
    canvas,
    sourceWidth: deepZoom.width,
    sourceHeight: deepZoom.height,
  } satisfies RoofMaskRaster;
};

const morphRoofMask = (
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
  dilate: boolean,
) => {
  const output = new Uint8Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = dilate ? 0 : 1;
      scan: for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          const neighbor =
            nextX >= 0 && nextX < width && nextY >= 0 && nextY < height
              ? source[nextY * width + nextX]
              : dilate
                ? 0
                : 1;
          if ((dilate && neighbor) || (!dilate && !neighbor)) {
            value = dilate ? 1 : 0;
            break scan;
          }
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
};

const fillSmallRoofMaskHoles = (
  source: Uint8Array,
  width: number,
  height: number,
  maximumArea: number,
) => {
  const output = source.slice();
  const visited = new Uint8Array(source.length);
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let touchesEdge = false;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      touchesEdge ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1)
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
            continue;
          const neighbor = nextY * width + nextX;
          if (!source[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
    }
    if (!touchesEdge && queue.length <= maximumArea)
      queue.forEach((index) => {
        output[index] = 1;
      });
  }
  return output;
};

const removeRoofMaskNoise = (
  source: Uint8Array,
  width: number,
  height: number,
  minimumArea: number,
) => {
  const output = source.slice();
  const visited = new Uint8Array(source.length);
  for (let start = 0; start < source.length; start += 1) {
    if (!source[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1)
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
            continue;
          const neighbor = nextY * width + nextX;
          if (source[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
    }
    if (queue.length < minimumArea)
      queue.forEach((index) => {
        output[index] = 0;
      });
  }
  return output;
};

const rasterizeRoofBoundary = (
  target: Uint8Array,
  width: number,
  height: number,
  start: PlayerDisplayFogPoint,
  end: PlayerDisplayFogPoint,
) => {
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(end.x) ||
    !Number.isFinite(end.y)
  )
    return false;
  const delta = { x: end.x - start.x, y: end.y - start.y };
  let enter = 0;
  let exit = 1;
  const clips: [number, number][] = [
    [-delta.x, start.x],
    [delta.x, 1 - start.x],
    [-delta.y, start.y],
    [delta.y, 1 - start.y],
  ];
  for (const [direction, distance] of clips) {
    if (Math.abs(direction) < 1e-12) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) enter = Math.max(enter, ratio);
    else exit = Math.min(exit, ratio);
    if (enter > exit) return false;
  }
  const clippedStart = {
    x: start.x + delta.x * enter,
    y: start.y + delta.y * enter,
  };
  const clippedEnd = {
    x: start.x + delta.x * exit,
    y: start.y + delta.y * exit,
  };
  let x0 = Math.round(clippedStart.x * (width - 1));
  let y0 = Math.round(clippedStart.y * (height - 1));
  const x1 = Math.round(clippedEnd.x * (width - 1));
  const y1 = Math.round(clippedEnd.y * (height - 1));
  const deltaX = Math.abs(x1 - x0);
  const deltaY = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX + deltaY;
  for (;;) {
    target[y0 * width + x0] = 1;
    if (x0 === x1 && y0 === y1) break;
    const doubled = error * 2;
    if (doubled >= deltaY) {
      error += deltaY;
      x0 += stepX;
    }
    if (doubled <= deltaX) {
      error += deltaX;
      y0 += stepY;
    }
  }
  return true;
};

// A roof/interior pair can differ across the whole image because of baked
// lighting or a vignette. In that case walls plus portal spans are the more
// reliable building footprint. Disabled portals remain part of this boundary
// even though they are deliberately omitted from LOS ray casting.
const enclosedRoofMask = (
  walls: PlayerDisplayWall[],
  width: number,
  height: number,
  minimumArea: number,
  referenceMask: Uint8Array,
  supportWallLevels: PlayerDisplayWall[][] = [],
) => {
  const boundary = new Uint8Array(width * height);
  let segmentCount = 0;
  walls.forEach((wall) => {
    const points =
      (wall.points?.length ?? 0) >= 2
        ? wall.points!
        : [wall.start, wall.end];
    points.slice(1).forEach((end, index) => {
      if (rasterizeRoofBoundary(boundary, width, height, points[index], end))
        segmentCount += 1;
    });
  });
  if (segmentCount < 3) return null;

  // Some floors intentionally omit an exterior span for an open arch even
  // though the same roof footprint is closed on adjacent aligned floors.
  // Borrow only an explicitly matching missing span for footprint flood-fill;
  // never add it to the level's LOS walls.
  if (supportWallLevels.length) {
    const currentLabels = labelRoofMask(boundary, width, height);
    const maximumCurrentLabel = currentLabels.reduce(
      (maximum, label) => Math.max(maximum, label),
      0,
    );
    const endpoints: number[][] = Array.from(
      { length: maximumCurrentLabel + 1 },
      () => [],
    );
    const componentSizes = new Uint32Array(maximumCurrentLabel + 1);
    const componentBounds = Array.from(
      { length: maximumCurrentLabel + 1 },
      () => ({ minX: width, minY: height, maxX: -1, maxY: -1 }),
    );
    currentLabels.forEach((label, index) => {
      if (!label) return;
      componentSizes[label] += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      const bounds = componentBounds[label];
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
      let neighbors = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1)
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
            continue;
          if (currentLabels[nextY * width + nextX] === label) neighbors += 1;
        }
      if (neighbors <= 1) endpoints[label].push(index);
    });
    const supportSegments = supportWallLevels.map((levelWalls) =>
      levelWalls.flatMap((wall) => {
        const points =
          (wall.points?.length ?? 0) >= 2
            ? wall.points!
            : [wall.start, wall.end];
        return points.slice(1).map((end, index) => ({
          start: points[index],
          end,
        }));
      }),
    );
    const endpointMatches = (
      point: PlayerDisplayFogPoint,
      endpoint: number,
    ) => {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
      )
        return false;
      const x = Math.round(point.x * (width - 1));
      const y = Math.round(point.y * (height - 1));
      return (
        Math.abs((endpoint % width) - x) <= 1 &&
        Math.abs(Math.floor(endpoint / width) - y) <= 1
      );
    };
    for (let label = 1; label <= maximumCurrentLabel; label += 1) {
      if (endpoints[label].length !== 2) continue;
      const [startIndex, endIndex] = endpoints[label];
      const startX = startIndex % width;
      const startY = Math.floor(startIndex / width);
      const endX = endIndex % width;
      const endY = Math.floor(endIndex / width);
      const gap = Math.hypot(endX - startX, endY - startY);
      const bounds = componentBounds[label];
      const smallerSpan = Math.min(
        bounds.maxX - bounds.minX + 1,
        bounds.maxY - bounds.minY + 1,
      );
      if (
        gap > Math.min(width, height) * 0.05 ||
        gap > smallerSpan * 0.25 ||
        gap > (componentSizes[label] + gap) * 0.1
      )
        continue;
      const supportVotes = supportSegments.filter((levelSegments) =>
        levelSegments.some(
          (segment) =>
            (endpointMatches(segment.start, startIndex) &&
              endpointMatches(segment.end, endIndex)) ||
            (endpointMatches(segment.start, endIndex) &&
              endpointMatches(segment.end, startIndex)),
        ),
      ).length;
      const minimumSupportVotes = supportWallLevels.length > 1 ? 2 : 1;
      if (supportVotes < minimumSupportVotes) continue;
      const bridge = new Uint8Array(boundary.length);
      rasterizeRoofBoundary(
        bridge,
        width,
        height,
        { x: startX / (width - 1), y: startY / (height - 1) },
        { x: endX / (width - 1), y: endY / (height - 1) },
      );
      let intersectsAnotherWall = false;
      const bridgeClearance = morphRoofMask(
        bridge,
        width,
        height,
        1,
        true,
      );
      bridgeClearance.forEach((value, index) => {
        if (!value || !boundary[index]) return;
        const x = index % width;
        const y = Math.floor(index / width);
        const nearStart =
          Math.abs(x - startX) <= 2 && Math.abs(y - startY) <= 2;
        const nearEnd = Math.abs(x - endX) <= 2 && Math.abs(y - endY) <= 2;
        if (!nearStart && !nearEnd) intersectsAnotherWall = true;
      });
      if (intersectsAnotherWall) continue;
      bridge.forEach((value, index) => {
        if (value) boundary[index] = 1;
      });
    }
  }

  // A one-pixel seal absorbs coordinate rounding at VTT portal endpoints.
  const sealedBoundary = morphRoofMask(boundary, width, height, 1, true);
  const outside = new Uint8Array(width * height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    const index = y * width + x;
    if (sealedBoundary[index] || outside[index]) return;
    outside[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  let enclosed = new Uint8Array(width * height);
  for (let index = 0; index < enclosed.length; index += 1)
    enclosed[index] = !sealedBoundary[index] && !outside[index] ? 1 : 0;
  const roomLabels = labelRoofMask(enclosed, width, height);
  const maximumRoomLabel = roomLabels.reduce(
    (maximum, label) => Math.max(maximum, label),
    0,
  );
  if (!maximumRoomLabel) return null;

  // Internal walls and portal spans split the flood-fill into rooms. Unite
  // rooms that touch the same boundary component before filtering or adding
  // roof overhang; separate buildings keep distinct labels.
  const parents = new Uint32Array(maximumRoomLabel + 1);
  for (let label = 1; label <= maximumRoomLabel; label += 1)
    parents[label] = label;
  const findRoot = (label: number) => {
    let root = label;
    while (parents[root] !== root) root = parents[root];
    while (parents[label] !== label) {
      const next = parents[label];
      parents[label] = root;
      label = next;
    }
    return root;
  };
  const unite = (left: number, right: number) => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot === rightRoot) return;
    if (leftRoot < rightRoot) parents[rightRoot] = leftRoot;
    else parents[leftRoot] = rightRoot;
  };
  // Keep the identity of the original wall networks while extending them to
  // the one-pixel sealing band. Labelling the already-dilated mask would join
  // two different buildings across a narrow alley and make entering either
  // one remove both roofs.
  const rawBoundaryLabels = labelRoofMask(boundary, width, height);
  const boundaryLabels = new Uint16Array(sealedBoundary.length);
  const boundaryDistance = new Uint8Array(sealedBoundary.length);
  boundaryDistance.fill(255);
  const boundaryQueue: number[] = [];
  rawBoundaryLabels.forEach((label, index) => {
    if (!label) return;
    boundaryLabels[index] = label;
    boundaryDistance[index] = 0;
    boundaryQueue.push(index);
  });
  for (let cursor = 0; cursor < boundaryQueue.length; cursor += 1) {
    const index = boundaryQueue[cursor];
    const distance = boundaryDistance[index];
    if (distance >= 1) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1)
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (!offsetX && !offsetY) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
          continue;
        const next = nextY * width + nextX;
        if (!sealedBoundary[next]) continue;
        const nextDistance = distance + 1;
        const label = boundaryLabels[index];
        if (
          nextDistance < boundaryDistance[next] ||
          (nextDistance === boundaryDistance[next] &&
            label < boundaryLabels[next])
        ) {
          boundaryDistance[next] = nextDistance;
          boundaryLabels[next] = label;
          boundaryQueue.push(next);
        }
      }
  }
  const maximumBoundaryLabel = boundaryLabels.reduce(
    (maximum, label) => Math.max(maximum, label),
    0,
  );
  const boundaryParents = new Uint32Array(maximumBoundaryLabel + 1);
  for (let label = 1; label <= maximumBoundaryLabel; label += 1)
    boundaryParents[label] = label;
  const findBoundaryRoot = (label: number) => {
    let root = label;
    while (boundaryParents[root] !== root) root = boundaryParents[root];
    while (boundaryParents[label] !== label) {
      const next = boundaryParents[label];
      boundaryParents[label] = root;
      label = next;
    }
    return root;
  };
  const uniteBoundaries = (left: number, right: number) => {
    const leftRoot = findBoundaryRoot(left);
    const rightRoot = findBoundaryRoot(right);
    if (leftRoot === rightRoot) return;
    if (leftRoot < rightRoot) boundaryParents[rightRoot] = leftRoot;
    else boundaryParents[leftRoot] = rightRoot;
  };
  const boundaryRooms: Array<Set<number> | undefined> = Array(
    maximumBoundaryLabel + 1,
  );
  const boundaryTouchesOutside = new Uint8Array(maximumBoundaryLabel + 1);
  const adjacentBoundaries = new Set<number>();
  boundaryLabels.forEach((boundaryLabel, index) => {
    if (!boundaryLabel) return;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1)
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (!offsetX && !offsetY) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
          continue;
        const next = nextY * width + nextX;
        if (outside[next])
          boundaryTouchesOutside[boundaryLabel] = 1;
        const roomLabel = roomLabels[next];
        if (roomLabel) {
          const rooms =
            boundaryRooms[boundaryLabel] ??
            (boundaryRooms[boundaryLabel] = new Set());
          rooms.add(roomLabel);
        }
        const otherBoundary = boundaryLabels[next];
        if (otherBoundary && otherBoundary !== boundaryLabel) {
          const lower = Math.min(boundaryLabel, otherBoundary);
          const upper = Math.max(boundaryLabel, otherBoundary);
          adjacentBoundaries.add(lower * 65_536 + upper);
        }
      }
  });
  // Reconnect raw wall pieces only when their one-pixel sealing bands meet
  // and both touch the same enclosed room. This repairs rounded portal/T-joint
  // gaps without joining two buildings whose bands merely meet in an alley.
  adjacentBoundaries.forEach((pair) => {
    const left = Math.floor(pair / 65_536);
    const right = pair % 65_536;
    const leftRooms = boundaryRooms[left];
    const rightRooms = boundaryRooms[right];
    if (!leftRooms || !rightRooms) return;
    const smaller = leftRooms.size <= rightRooms.size ? leftRooms : rightRooms;
    const larger = smaller === leftRooms ? rightRooms : leftRooms;
    if ([...smaller].some((room) => larger.has(room)))
      uniteBoundaries(left, right);
  });
  const networkTouchesOutside = new Uint8Array(maximumBoundaryLabel + 1);
  for (let label = 1; label <= maximumBoundaryLabel; label += 1)
    if (boundaryTouchesOutside[label])
      networkTouchesOutside[findBoundaryRoot(label)] = 1;
  const networkRoom = new Uint16Array(maximumBoundaryLabel + 1);
  for (let label = 1; label <= maximumBoundaryLabel; label += 1) {
    const root = findBoundaryRoot(label);
    // A detached inner loop may be a courtyard, column, or fountain. Only a
    // wall network connected to an outside-facing boundary may join rooms.
    if (!networkTouchesOutside[root]) continue;
    boundaryRooms[label]?.forEach((roomLabel) => {
      if (networkRoom[root]) unite(networkRoom[root], roomLabel);
      else networkRoom[root] = roomLabel;
    });
  }

  const rootToBuilding = new Map<number, number>();
  let maximumLabel = 0;
  const componentLabels = new Uint16Array(roomLabels.length);
  roomLabels.forEach((roomLabel, index) => {
    if (!roomLabel) return;
    const root = findRoot(roomLabel);
    let building = rootToBuilding.get(root);
    if (!building) {
      maximumLabel += 1;
      building = maximumLabel;
      rootToBuilding.set(root, building);
    }
    componentLabels[index] = building;
  });
  const componentSizes = new Uint32Array(maximumLabel + 1);
  const componentOverlap = new Uint32Array(maximumLabel + 1);
  componentLabels.forEach((label, index) => {
    if (!label) return;
    componentSizes[label] += 1;
    if (referenceMask[index]) componentOverlap[label] += 1;
  });
  const accepted = new Uint8Array(maximumLabel + 1);
  const referenceCoverage =
    referenceMask.reduce((total, value) => total + value, 0) /
    referenceMask.length;
  const agreementThreshold = Math.min(
    0.9,
    Math.max(0.75, referenceCoverage + 0.15),
  );
  for (let label = 1; label <= maximumLabel; label += 1)
    if (
      componentSizes[label] >= minimumArea &&
      componentOverlap[label] / componentSizes[label] >= agreementThreshold
    )
      accepted[label] = 1;

  const insideLabels = new Uint16Array(componentLabels.length);
  componentLabels.forEach((label, index) => {
    if (label && accepted[label]) insideLabels[index] = label;
  });

  const overhang = Math.max(
    2,
    Math.round(Math.min(width, height) / 160),
  );
  // Expand components independently. Adjacent buildings may share coverage
  // pixels, but their labels stay separate so entering one never removes both.
  const expandedLabels = new Uint16Array(enclosed.length);
  const expandedDistance = new Uint8Array(enclosed.length);
  expandedDistance.fill(255);
  const expansionQueue: number[] = [];
  componentLabels.forEach((label, index) => {
    if (!label || !accepted[label]) return;
    expandedLabels[index] = label;
    expandedDistance[index] = 0;
    expansionQueue.push(index);
  });
  for (let cursor = 0; cursor < expansionQueue.length; cursor += 1) {
    const index = expansionQueue[cursor];
    const distance = expandedDistance[index];
    if (distance >= overhang) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1)
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (!offsetX && !offsetY) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
          continue;
        const next = nextY * width + nextX;
        const nextDistance = distance + 1;
        const label = expandedLabels[index];
        if (
          nextDistance < expandedDistance[next] ||
          (nextDistance === expandedDistance[next] &&
            label < expandedLabels[next])
        ) {
          expandedDistance[next] = nextDistance;
          expandedLabels[next] = label;
          expansionQueue.push(next);
        }
      }
  }
  enclosed = new Uint8Array(enclosed.length);
  expandedLabels.forEach((label, index) => {
    if (label) enclosed[index] = 1;
  });
  const covered = enclosed.reduce((total, value) => total + value, 0);
  return covered >= minimumArea && covered <= enclosed.length * 0.75
    ? { insideLabels, labels: expandedLabels, mask: enclosed }
    : null;
};

const labelRoofMask = (source: Uint8Array, width: number, height: number) => {
  const labels = new Uint16Array(source.length);
  let label = 0;
  for (let start = 0; start < source.length; start += 1) {
    if (!source[start] || labels[start]) continue;
    label += 1;
    if (label > 65_535)
      throw new Error("Слой крыши содержит слишком много областей.");
    const queue = [start];
    labels[start] = label;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1)
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
            continue;
          const neighbor = nextY * width + nextX;
          if (source[neighbor] && !labels[neighbor]) {
            labels[neighbor] = label;
            queue.push(neighbor);
          }
        }
    }
  }
  return labels;
};

const roofMaskLooksGlobal = (
  source: Uint8Array,
  width: number,
  height: number,
) => {
  const covered = source.reduce((total, value) => total + value, 0);
  if (!covered) return false;
  const labels = labelRoofMask(source, width, height);
  const counts = new Uint32Array(
    labels.reduce((maximum, label) => Math.max(maximum, label), 0) + 1,
  );
  labels.forEach((label) => {
    if (label) counts[label] += 1;
  });
  let largestLabel = 0;
  for (let label = 1; label < counts.length; label += 1)
    if (counts[label] > counts[largestLabel]) largestLabel = label;
  if (!largestLabel) return false;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] !== largestLabel) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const edgeCount =
    Number(minX === 0) +
    Number(minY === 0) +
    Number(maxX === width - 1) +
    Number(maxY === height - 1);
  const spanX = (maxX - minX + 1) / width;
  const spanY = (maxY - minY + 1) / height;
  const dominant = counts[largestLabel] / covered > 0.8;
  const mapCoverage = covered / source.length;
  const borderDepth = Math.max(
    2,
    Math.round(Math.min(width, height) * 0.04),
  );
  const cornerDepth = Math.max(
    borderDepth,
    Math.round(Math.min(width, height) * 0.08),
  );
  let borderCovered = 0;
  let borderPixels = 0;
  const cornerCovered = [0, 0, 0, 0];
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const value = source[y * width + x];
      if (
        x < borderDepth ||
        x >= width - borderDepth ||
        y < borderDepth ||
        y >= height - borderDepth
      ) {
        borderPixels += 1;
        if (value) borderCovered += 1;
      }
      if (!value) continue;
      if (x < cornerDepth && y < cornerDepth) cornerCovered[0] += 1;
      if (x >= width - cornerDepth && y < cornerDepth)
        cornerCovered[1] += 1;
      if (x < cornerDepth && y >= height - cornerDepth)
        cornerCovered[2] += 1;
      if (x >= width - cornerDepth && y >= height - cornerDepth)
        cornerCovered[3] += 1;
    }
  const cornerArea = cornerDepth * cornerDepth;
  const occupiedCorners = cornerCovered.filter(
    (value) => value / cornerArea > 0.2,
  ).length;
  const dominantGlobal =
    dominant &&
    edgeCount >= 2 &&
    spanX > 0.9 &&
    spanY > 0.9 &&
    mapCoverage > 0.3;
  const fragmentedGlobal =
    occupiedCorners >= 3 &&
    borderCovered / Math.max(1, borderPixels) > 0.25 &&
    (mapCoverage > 0.2 || borderCovered / covered > 0.6);
  return dominantGlobal || fragmentedGlobal;
};

const groupRoofComponentsByBuilding = (
  insideLabels: Uint16Array,
  roofLabels: Uint16Array,
) => {
  const maximumInsideLabel = insideLabels.reduce(
    (maximum, label) => Math.max(maximum, label),
    0,
  );
  if (!maximumInsideLabel) return null;
  const maximumRoofLabel = roofLabels.reduce(
    (maximum, label) => Math.max(maximum, label),
    0,
  );
  const bestBuilding = new Uint16Array(maximumRoofLabel + 1);
  const bestOverlap = new Uint32Array(maximumRoofLabel + 1);
  const overlaps = new Map<number, number>();
  insideLabels.forEach((insideLabel, index) => {
    const roofLabel = roofLabels[index];
    if (!insideLabel || !roofLabel) return;
    const key = insideLabel * 65_536 + roofLabel;
    overlaps.set(key, (overlaps.get(key) ?? 0) + 1);
  });
  overlaps.forEach((overlap, key) => {
    const insideLabel = Math.floor(key / 65_536);
    const roofLabel = key % 65_536;
    if (overlap > bestOverlap[roofLabel]) {
      bestOverlap[roofLabel] = overlap;
      bestBuilding[roofLabel] = insideLabel;
    }
  });
  if (!bestBuilding.some((label) => label)) return null;

  const roofGroups = new Uint16Array(maximumRoofLabel + 1);
  let nextGroup = maximumInsideLabel;
  for (let roofLabel = 1; roofLabel <= maximumRoofLabel; roofLabel += 1) {
    if (bestBuilding[roofLabel]) roofGroups[roofLabel] = bestBuilding[roofLabel];
    else {
      nextGroup += 1;
      if (nextGroup > 65_535)
        throw new Error("Слой крыши содержит слишком много областей.");
      roofGroups[roofLabel] = nextGroup;
    }
  }
  const cutoutLabels = new Uint16Array(roofLabels.length);
  roofLabels.forEach((roofLabel, index) => {
    if (roofLabel) cutoutLabels[index] = roofGroups[roofLabel];
  });
  return { cutoutLabels, insideLabels };
};

const roofComponentLabelAtToken = (
  mask: RoofMaskData | null,
  token: PlayerDisplayToken | null,
) => {
  if (!mask || !token) return 0;
  const x = Math.max(
    0,
    Math.min(mask.width - 1, Math.floor(token.x * mask.width)),
  );
  const y = Math.max(
    0,
    Math.min(mask.height - 1, Math.floor(token.y * mask.height)),
  );
  return (mask.insideLabels ?? mask.labels)[y * mask.width + x];
};

const roofComponentCutoutURL = (
  mask: RoofMaskData | null,
  token: PlayerDisplayToken | null,
) => {
  if (!mask || !token || typeof document === "undefined") return "";
  const label = roofComponentLabelAtToken(mask, token);
  if (!label) return "";
  const cached = mask.cutoutURLs.get(label);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const output = context.createImageData(mask.width, mask.height);
  let matched = false;
  for (let index = 0; index < mask.labels.length; index += 1) {
    if (mask.labels[index] !== label) continue;
    matched = true;
    const offset = index * 4;
    // Opaque black removes the whole connected roof component containing the
    // token. The LOS fog below then decides which parts of its interior are
    // visible; transparent pixels leave every other roof untouched.
    output.data[offset + 3] = 255;
  }
  if (!matched) return "";
  context.putImageData(output, 0, 0);
  const result = canvas.toDataURL("image/png");
  if (result.length > maximumRoofMaskURLLength) return "";
  mask.cutoutURLs.set(label, result);
  return result;
};

// Paired VTT images repeat the same ground and differ primarily at buildings.
// Turn that difference into a compact roof-only mask, closing JPEG pinholes
// and removing isolated compression noise before it can reveal ground on TV.
const pairedRoofMask = async (
  base: RoofMaskSource,
  roof: RoofMaskSource,
  preparedRoof?: RoofMaskRaster,
  walls: PlayerDisplayWall[] = [],
  footprintFallbackWalls: PlayerDisplayWall[][] = [],
): Promise<RoofMaskData> => {
  if (!base.url || !roof.url || typeof document === "undefined")
    throw new Error("Не удалось построить геометрию крыши.");
  const [baseRaster, roofRaster] = await Promise.all([
    roofMaskRaster(base),
    preparedRoof ? Promise.resolve(preparedRoof) : roofMaskRaster(roof),
  ]);
  if (
    baseRaster.sourceWidth !== roofRaster.sourceWidth ||
    baseRaster.sourceHeight !== roofRaster.sourceHeight
  )
    throw new Error(
      "Интерьер и крыша имеют разные размеры и не могут быть совмещены.",
    );
  const width = baseRaster.canvas.width;
  const height = baseRaster.canvas.height;
  if (width !== roofRaster.canvas.width || height !== roofRaster.canvas.height)
    throw new Error(
      "Интерьер и крыша используют несовместимую геометрию тайлов.",
    );
  const sample = document.createElement("canvas");
  sample.width = width;
  sample.height = height;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas недоступен.");
  context.drawImage(baseRaster.canvas, 0, 0, width, height);
  const basePixels = context.getImageData(0, 0, width, height).data;
  context.clearRect(0, 0, width, height);
  context.drawImage(roofRaster.canvas, 0, 0, width, height);
  const roofPixels = context.getImageData(0, 0, width, height).data;
  let mask = new Uint8Array(width * height);
  let labelsOverride: Uint16Array | null = null;
  let insideLabelsOverride: Uint16Array | null = null;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const difference =
      Math.abs(basePixels[offset] - roofPixels[offset]) +
      Math.abs(basePixels[offset + 1] - roofPixels[offset + 1]) +
      Math.abs(basePixels[offset + 2] - roofPixels[offset + 2]);
    mask[index] = difference >= 72 ? 1 : 0;
  }
  const closingRadius = Math.max(1, Math.round(Math.min(width, height) / 240));
  const componentArea = Math.max(8, Math.round(width * height * 0.0004));
  mask = morphRoofMask(mask, width, height, closingRadius, true);
  mask = morphRoofMask(mask, width, height, closingRadius, false);
  mask = fillSmallRoofMaskHoles(mask, width, height, componentArea);
  mask = morphRoofMask(mask, width, height, 1, false);
  mask = morphRoofMask(mask, width, height, 1, true);
  mask = removeRoofMaskNoise(mask, width, height, componentArea);
  const globalMask = roofMaskLooksGlobal(mask, width, height);
  const enclosed = enclosedRoofMask(
    walls,
    width,
    height,
    componentArea,
    mask,
    footprintFallbackWalls,
  );
  const processedPixels = mask.reduce((total, value) => total + value, 0);
  const enclosurePixels = enclosed
    ? enclosed.mask.reduce((total, value) => total + value, 0)
    : 0;
  const processedCoverage = processedPixels / mask.length;
  const enclosureCoverage = enclosurePixels / mask.length;
  let enclosureSupportedPixels = 0;
  let outsideDifferencePixels = 0;
  let outsideMinX = width;
  let outsideMinY = height;
  let outsideMaxX = -1;
  let outsideMaxY = -1;
  if (enclosed)
    mask.forEach((value, index) => {
      if (!value) return;
      if (enclosed.mask[index]) {
        enclosureSupportedPixels += 1;
        return;
      }
      outsideDifferencePixels += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      outsideMinX = Math.min(outsideMinX, x);
      outsideMinY = Math.min(outsideMinY, y);
      outsideMaxX = Math.max(outsideMaxX, x);
      outsideMaxY = Math.max(outsideMaxY, y);
    });
  const outsideSpanX = outsideDifferencePixels
    ? (outsideMaxX - outsideMinX + 1) / width
    : 0;
  const outsideSpanY = outsideDifferencePixels
    ? (outsideMaxY - outsideMinY + 1) / height
    : 0;
  // A floor can differ from the shared roof across a huge outdoor area because
  // of baked lighting even when the border/corner heuristic is inconclusive.
  // Once walls provide a strongly image-supported footprint, prefer it when
  // the raw difference is many times larger; broad masks would repaint LOS fog.
  const differenceIsBroad = Boolean(
    enclosed &&
    processedCoverage >= 0.15 &&
    processedCoverage >= enclosureCoverage * 4 &&
    enclosureSupportedPixels / Math.max(1, enclosurePixels) >= 0.7 &&
    outsideDifferencePixels / Math.max(1, processedPixels) >= 0.6 &&
    outsideSpanX >= 0.75 &&
    outsideSpanY >= 0.75,
  );
  if (globalMask || differenceIsBroad) {
    if (!enclosed)
      throw new Error(
        "Различия слоёв затрагивают всю карту, а стены не образуют надёжный замкнутый контур крыши.",
      );
    mask = enclosed.mask;
    labelsOverride = enclosed.labels;
    insideLabelsOverride = enclosed.insideLabels;
  }
  const covered = mask.reduce((total, value) => total + value, 0);
  if (covered < mask.length * 0.001 || covered > mask.length * 0.75)
    throw new Error("Не удалось надёжно отделить крыши от интерьера.");
  let labels = labelsOverride ?? labelRoofMask(mask, width, height);
  if (!insideLabelsOverride && enclosed) {
    const grouped = groupRoofComponentsByBuilding(
      enclosed.insideLabels,
      labels,
    );
    if (grouped) {
      labels = grouped.cutoutLabels;
      insideLabelsOverride = grouped.insideLabels;
    }
  }
  if (!insideLabelsOverride) {
    const inset = Math.max(
      1,
      Math.round(Math.min(width, height) / 240),
    );
    const insetMask = morphRoofMask(mask, width, height, inset, false);
    insideLabelsOverride = new Uint16Array(labels.length);
    labels.forEach((label, index) => {
      if (insetMask[index]) insideLabelsOverride![index] = label;
    });
  }
  const output = context.createImageData(width, height);
  for (let index = 0; index < mask.length; index += 1) {
    const value = mask[index] ? 255 : 0;
    const offset = index * 4;
    output.data[offset] = value;
    output.data[offset + 1] = value;
    output.data[offset + 2] = value;
    output.data[offset + 3] = 255;
  }
  context.putImageData(output, 0, 0);
  const result = sample.toDataURL("image/png");
  if (result.length > maximumRoofMaskURLLength)
    throw new Error("Маска крыши получилась слишком большой.");
  return {
    url: result,
    width,
    height,
    insideLabels: insideLabelsOverride ?? labels,
    labels,
    cutoutURLs: new Map(),
  };
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
          decoding="async"
          draggable={false}
          fetchPriority="high"
          key={`${level}-${col}-${row}`}
          loading="eager"
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
  const [roofMask, setRoofMask] = useState<RoofMaskData | null>(null);
  const [levels, setLevels] = useState<SessionMapLevel[]>([]);
  const [activeLevel, setActiveLevel] = useState(0);
  const [mediaType, setMediaType] = useState<
    "image" | "youtube" | "video" | "tiles"
  >("image");
  const [deepZoom, setDeepZoom] = useState<DeepZoomSource | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("Карта приключения");
  const [regions, setRegions] = useState<PlayerDisplayFogRegion[]>([]);
  const [roofZones, setRoofZones] = useState<PlayerDisplayRoofZone[]>([]);
  const [walls, setWalls] = useState<PlayerDisplayWall[]>([]);
  const [token, setToken] = useState<PlayerDisplayToken | null>(null);
  const [tool, setTool] = useState<
    "fog" | "roof" | "roofOpening" | "wall" | "door" | "token" | null
  >(null);
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
    kind: "region" | "roof" | "wall";
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
  const publishQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingPublishes = useRef(0);
  const [imageAspect, setImageAspect] = useState(1);
  const mapAspect =
    mediaType === "youtube"
      ? 16 / 9
      : deepZoom
        ? deepZoom.width / deepZoom.height
        : imageAspect;
  // A multi-VTT scene is an automatic base/roof pair. Legacy hand-drawn
  // zones must never leak into this mode: they are not map geometry and the
  // roof renderer does not consume them.
  const pairedVTT = Boolean(roofUrl && roofMask);
  const visionCellSize = grid.type === "none" ? 0.01 : grid.size;
  const roofZonesToRender = pairedVTT
    ? []
    : roofZones.length
      ? roofZones
      : suggestedRoofZones(walls);
  const masterVisionPoints = token
    ? visibilityPolygon(token, walls, mapAspect)
    : [];
  const masterRoofCutoutURL = roofComponentCutoutURL(roofMask, token);
  const containingRoofZones = token
    ? roofZonesToRender.filter((zone) => pointInRoofZone(token, zone))
    : [];
  const masterTokenInsideRoof = Boolean(
    token &&
    (roofMask
      ? roofComponentLabelAtToken(roofMask, token)
      : containingRoofZones.length),
  );
  const masterRoofCutoutReady =
    !masterTokenInsideRoof ||
    Boolean(masterRoofCutoutURL || (!roofMask && containingRoofZones.length));
  const masterFovClip = token
    ? `ellipse(${token.visionRadius * 100}% ${token.visionRadius * mapAspect * 100}% at ${token.x * 100}% ${token.y * 100}%)`
    : undefined;

  useEffect(() => {
    if (!pairedVTT) return;
    // Migrate an already-open scene created before paired VTTs stopped using
    // zones. The conditional updates prevent a render loop.
    if (roofZones.length) setRoofZones([]);
    if (tool === "roof" || tool === "roofOpening") setTool(null);
    setDraft([]);
    draftRef.current = [];
    setLevels((current) =>
      current.some((level) => level.roofZones.length)
        ? current.map((level) => ({ ...level, roofZones: [] }))
        : current,
    );
  }, [pairedVTT, roofZones.length, tool]);

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

  const publish = (
    nextRegions = regions,
    nextWalls = walls,
    nextToken = token,
    openDisplay = false,
    nextGrid = grid,
    nextViewport = viewport,
    nextLevel?: SessionMapLevel,
    nextRoofZones = roofZones,
  ) => {
    const publishedImageUrl = nextLevel?.imageUrl ?? imageUrl;
    const publishedRoofUrl = nextLevel?.roofUrl ?? roofUrl;
    const publishedRoofMask = nextLevel?.roofMask ?? roofMask;
    const publishedDeepZoom = nextLevel?.deepZoom ?? deepZoom;
    if (!publishedImageUrl) {
      setNotice("Сначала загрузите или подключите карту.");
      return;
    }
    const displayWindow = openDisplay
      ? window.open("about:blank", "shadow-edge-session-display")
      : null;
    const shell = mapShell.current;
    const mapAspectRatio = publishedDeepZoom
      ? publishedDeepZoom.width / publishedDeepZoom.height
      : mediaType === "youtube"
        ? 16 / 9
        : shell && shell.clientHeight
          ? shell.clientWidth / shell.clientHeight
          : 1;
    const publishedVisionPolygon = nextToken
      ? visibilityPolygon(nextToken, nextWalls, mapAspectRatio)
      : undefined;
    const publishedFovPolygon = nextToken
      ? fovPolygon(nextToken, mapAspectRatio)
      : undefined;
    const publishedRoofCutoutURL = roofComponentCutoutURL(
      publishedRoofMask,
      nextToken,
    );
    const publishedRoofZones = publishedRoofMask
      ? []
      : nextRoofZones.length
        ? nextRoofZones
        : suggestedRoofZones(nextWalls);
    const tokenInsidePublishedRoof = Boolean(
      nextToken &&
      (publishedRoofMask
        ? roofComponentLabelAtToken(publishedRoofMask, nextToken)
        : publishedRoofZones.some((zone) =>
            pointInRoofZone(nextToken, zone),
          )),
    );
    pendingPublishes.current += 1;
    setBusy(true);
    const run = async () => {
      try {
        const share = await api.showPlayerDisplayImage(campaignId, {
        alt: title || "Карта игровой сессии",
        deepZoom: publishedDeepZoom ?? undefined,
        fogRegions: nextRegions,
        grid: nextGrid,
        viewport: nextViewport,
        walls: nextWalls,
        token: nextToken ?? undefined,
        visionPolygon: publishedVisionPolygon,
        fovPolygon: publishedFovPolygon,
        mapAspectRatio,
        mediaType: nextLevel
          ? nextLevel.deepZoom
            ? "tiles"
            : "image"
          : mediaType,
        roofUrl: publishedRoofUrl || undefined,
        roofMaskUrl: publishedRoofMask?.url || undefined,
        roofCutoutMaskUrl: publishedRoofCutoutURL || undefined,
        // The player renderer derives the roof automatically from paired VTT
        // layers. The active building is removed as one component so LOS fog
        // can make every area behind its solid walls fully dark.
        roofVisionOnly: tokenInsidePublishedRoof,
        roofZones: publishedRoofZones,
        sessionMap: true,
        title,
        url: publishedImageUrl,
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
        pendingPublishes.current = Math.max(0, pendingPublishes.current - 1);
        setBusy(pendingPublishes.current > 0);
      }
    };
    // Pointer-down, pointer-up and range updates can publish almost at once.
    // Send them in creation order so an older LOS snapshot cannot arrive last
    // and leave the TV out of sync with the master preview.
    const queued = publishQueue.current.then(run, run);
    publishQueue.current = queued;
    return queued;
  };
  const updateRegions = (next: PlayerDisplayFogRegion[]) => {
    setRegions(next);
    if (displayUrl) void publish(next, walls, token);
  };
  const updateWalls = (next: PlayerDisplayWall[]) => {
    setWalls(next);
    setLevels((current) =>
      current.map((level, index) =>
        index === activeLevel ? { ...level, walls: next } : level,
      ),
    );
    if (displayUrl) void publish(regions, next, token);
  };
  const updateRoofZones = (next: PlayerDisplayRoofZone[]) => {
    if (pairedVTT) return;
    setRoofZones(next);
    setLevels((current) =>
      current.map((level, index) =>
        index === activeLevel ? { ...level, roofZones: next } : level,
      ),
    );
    if (displayUrl)
      void publish(
        regions,
        walls,
        token,
        false,
        grid,
        viewport,
        undefined,
        next,
      );
  };
  const updateToken = (next: PlayerDisplayToken | null) => {
    setToken(next);
    if (displayUrl) void publish(regions, walls, next);
  };
  const updateGrid = (next: PlayerDisplayGridSettings) => {
    setGrid(next);
    setLevels((current) =>
      current.map((level, index) =>
        index === activeLevel ? { ...level, grid: next } : level,
      ),
    );
    if (displayUrl) void publish(regions, walls, token, false, next);
  };
  const resetFog = () => {
    setRegions([]);
    setWalls([]);
    setRoofZones([]);
    setToken(null);
    setDraft([]);
    draftRef.current = [];
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 12);
    if (!files.length) return;
    setBusy(true);
    try {
      const uploaded: { file: File; result: UploadImageResult }[] =
        await Promise.all(
          files.map(async (file) => ({
            file,
            result: await api.uploadImage(campaignId, file),
          })),
        );
      const vttLayers = uploaded.filter((item) => item.result.vtt);
      if (vttLayers.length >= 2) {
        const numberedLayers = vttLayers.map((item, inputIndex) => ({
          item,
          inputIndex,
          suffix: numberedLayerSuffix(item.file.name),
        }));
        const hasNumericSuffixes = numberedLayers.every(
          (layer) => layer.suffix !== null,
        );
        // Numeric suffixes define floor order; this keeps -10 after -9 and
        // selects the greatest suffix as the roof regardless of picker order.
        const orderedLayers = hasNumericSuffixes
          ? [...numberedLayers].sort(
              (a, b) => a.suffix! - b.suffix! || a.inputIndex - b.inputIndex,
            )
          : numberedLayers;
        const roofLayer = orderedLayers.at(-1)!.item;
        const playable = orderedLayers.slice(0, -1).map((layer) => layer.item);
        const roofSource = {
          url: roofLayer.result.url,
          deepZoom: roofLayer.result.deepZoom ?? null,
        };
        // Decode the common roof layer once and process floors sequentially.
        // The mask work is CPU-bound on the browser main thread.
        const preparedRoof = await roofMaskRaster(roofSource);
        const floorWalls = playable.map(
          (layer) => layer.result.vtt?.walls ?? [],
        );
        const nextLevels: SessionMapLevel[] = [];
        for (let index = 0; index < playable.length; index += 1) {
          const item = playable[index];
          const footprintFallbackWalls = floorWalls
            .map((candidate, candidateIndex) => ({
              candidate,
              distance: Math.abs(candidateIndex - index),
            }))
            .filter(({ candidate, distance }) => distance && candidate.length)
            .sort((left, right) => left.distance - right.distance)
            .map(({ candidate }) => candidate);
          nextLevels.push({
            id: `${item.file.name}-${index}`,
            name: `Уровень ${index + 1}`,
            imageUrl: item.result.url,
            roofUrl: roofLayer.result.url,
            roofMask: await pairedRoofMask(
              {
                url: item.result.url,
                deepZoom: item.result.deepZoom ?? null,
              },
              roofSource,
              preparedRoof,
              floorWalls[index],
              footprintFallbackWalls,
            ),
            roofZones: [],
            deepZoom: item.result.deepZoom ?? null,
            walls: item.result.vtt?.walls ?? [],
            grid: {
              type: "none",
              size: item.result.vtt?.gridSize ?? 0.08,
              color: "#ffffff",
              opacity: 0.35,
            },
          });
        }
        const first = nextLevels[0];
        nextLevels.forEach((level, index) =>
          window.setTimeout(
            () => preloadDeepZoom(level.deepZoom, index === 0 ? 1600 : 1100),
            index * 120,
          ),
        );
        setLevels(nextLevels);
        setActiveLevel(0);
        setImageUrl(first.imageUrl);
        setRoofUrl(first.roofUrl);
        setRoofMask(first.roofMask);
        setDeepZoom(first.deepZoom);
        setMediaType(first.deepZoom ? "tiles" : "image");
        setWalls(first.walls);
        setRoofZones([]);
        setGrid(first.grid);
        setToken(null);
        setRegions([]);
        setViewport({ zoom: 1, x: 0, y: 0 });
        setTitle(
          files[0].name.replace(/_\d+\.dd2vtt$/i, "") || "Многоэтажная карта",
        );
        setNotice(
          hasNumericSuffixes
            ? `Многоэтажная сцена импортирована: ${nextLevels.length} уровня; файл с максимальным числовым суффиксом используется как крыша.`
            : `Многоэтажная сцена импортирована: ${nextLevels.length} уровня; в именах не найден числовой суффикс, поэтому крышей выбран последний файл в порядке выбора.`,
        );
        return;
      }
      const base = uploaded.reduce((best, item) =>
        (item.result.vtt?.walls.length ?? 0) >
        (best.result.vtt?.walls.length ?? 0)
          ? item
          : best,
      );
      const roof =
        uploaded.length > 1
          ? uploaded.find((item) => item !== base)
          : undefined;
      const { file, result } = base;
      const video = result.contentType.startsWith("video/");
      const nextRoofMask = roof
        ? await pairedRoofMask(
            { url: result.url, deepZoom: result.deepZoom ?? null },
            {
              url: roof.result.url,
              deepZoom: roof.result.deepZoom ?? null,
            },
            undefined,
            result.vtt?.walls ?? [],
          )
        : null;
      setImageUrl(result.url);
      setLevels([]);
      setActiveLevel(0);
      setRoofUrl(roof?.result.url ?? "");
      setRoofMask(nextRoofMask);
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
        setNotice(
          roof
            ? `Пара Universal VTT импортирована: интерьер, крыша и ${result.vtt.walls.length} стен и дверей.`
            : `Universal VTT импортирован: ${result.vtt.walls.length} стен и дверей, карта ${result.vtt.mapWidth}×${result.vtt.mapHeight} клеток. Для крыши загрузите отдельный VTT-файл с большим числовым суффиксом.`,
        );
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
  const selectLevel = (index: number) => {
    const level = levels[index];
    if (!level || index === activeLevel) return;
    setLevels((current) =>
      current.map((item, itemIndex) =>
        itemIndex === activeLevel
          ? { ...item, walls, grid, roofZones: pairedVTT ? [] : roofZones }
          : item,
      ),
    );
    setActiveLevel(index);
    setImageUrl(level.imageUrl);
    setRoofUrl(level.roofUrl);
    setRoofMask(level.roofMask);
    setDeepZoom(level.deepZoom);
    setMediaType(level.deepZoom ? "tiles" : "image");
    setWalls(level.walls);
    setRoofZones(pairedVTT ? [] : level.roofZones);
    setGrid(level.grid);
    setRegions([]);
    setViewport({ zoom: 1, x: 0, y: 0 });
    setNotice(
      `${level.name} активирован. На телевизоре будет показан только этот этаж.`,
    );
    preloadDeepZoom(
      level.deepZoom,
      Math.max(1400, (mapShell.current?.clientWidth ?? 1000) * 2),
    );
    preloadDeepZoom(levels[index + 1]?.deepZoom ?? null, 1000);
    if (displayUrl)
      void publish(
        [],
        level.walls,
        token,
        false,
        level.grid,
        { zoom: 1, x: 0, y: 0 },
        level,
        level.roofZones,
      );
  };
  const useUrl = () => {
    const value = sourceUrl.trim();
    if (!value) return;
    const id = youtubeId(value);
    if (id) {
      setImageUrl(value);
      setRoofUrl("");
      setRoofMask(null);
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
      setRoofMask(null);
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
    if (tool === "roof") {
      const next = [
        ...roofZones,
        { id: crypto.randomUUID?.() ?? `roof-${Date.now()}`, points },
      ];
      updateRoofZones(next);
      setNotice(`Добавлена зона крыши ${next.length}.`);
      return;
    }
    if (tool === "roofOpening") {
      const zone = roofZones.find((candidate) =>
        pointInPolygon(points[0], candidate.points),
      );
      if (!zone) {
        setNotice("Начните проём внутри нарисованной зоны крыши.");
        return;
      }
      updateRoofZones(
        roofZones.map((candidate) =>
          candidate.id === zone.id
            ? {
                ...candidate,
                openings: [...(candidate.openings ?? []), points],
              }
            : candidate,
        ),
      );
      setNotice("Добавлен проём в зоне крыши.");
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
    kind: "region" | "roof" | "wall",
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
    else if (regionMenu.kind === "roof")
      updateRoofZones(roofZones.filter((zone) => zone.id !== regionMenu.id));
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
      const copied = await navigator.clipboard
        ?.writeText(share.url)
        .then(() => true)
        .catch(() => false);
      setNotice(
        copied
          ? "Создана новая ссылка на телевизор и скопирована. Старая ссылка больше не работает."
          : "Создана новая ссылка на телевизор. Старая ссылка больше не работает.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось создать новую ссылку.",
      );
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
                  {!pairedVTT &&
                    roofZones.map((zone, index) => (
                      <g key={zone.id}>
                        <polygon
                          className="roof-zone"
                          onContextMenu={(event) =>
                            openRegionMenu(event, "roof", zone.id)
                          }
                          points={svgPoints(zone.points)}
                        >
                          <title>{`Зона крыши ${index + 1}`}</title>
                        </polygon>
                        {(zone.openings ?? []).map((opening, openingIndex) => (
                          <polygon
                            className="roof-opening"
                            key={`${zone.id}-${openingIndex}`}
                            points={svgPoints(opening)}
                          >
                            <title>{`Проём ${openingIndex + 1}`}</title>
                          </polygon>
                        ))}
                      </g>
                    ))}
                  {walls.map((w) => {
                    const points = (w.points?.length ?? 0) >= 2
                      ? w.points!
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
                          : tool === "roof"
                            ? "draft roof-zone"
                            : tool === "roofOpening"
                              ? "draft roof-opening"
                              : "draft"
                      }
                      points={svgPoints(draft)}
                    />
                  ) : null}
                </svg>
                {roofUrl &&
                token &&
                masterVisionPoints.length &&
                masterRoofCutoutReady &&
                (roofMask || roofZonesToRender.length) ? (
                  <svg
                    className="session-map-roof"
                    preserveAspectRatio="none"
                    style={{ ...cameraStyle, clipPath: masterFovClip }}
                    viewBox="0 0 1000 1000"
                  >
                    <defs>
                      {masterTokenInsideRoof ? (
                        <clipPath id="master-roof-los-clip">
                          <polygon points={svgPoints(masterVisionPoints)} />
                        </clipPath>
                      ) : null}
                      <mask
                        id="master-roof-mask"
                        height="1000"
                        maskContentUnits="userSpaceOnUse"
                        maskUnits="userSpaceOnUse"
                        width="1000"
                        x="0"
                        y="0"
                        style={{ maskType: "luminance" }}
                      >
                        {roofMask ? (
                          <image
                            height="1000"
                            href={roofMask.url}
                            preserveAspectRatio="none"
                            width="1000"
                          />
                        ) : (
                          <>
                            <rect fill="black" height="1000" width="1000" />
                            {roofZonesToRender.map((zone) => (
                              <polygon
                                fill="white"
                                key={zone.id}
                                points={svgPoints(zone.points)}
                              />
                            ))}
                            {roofZonesToRender.flatMap((zone) =>
                              (zone.openings ?? []).map((opening, index) => (
                                <polygon
                                  fill="black"
                                  key={`${zone.id}-opening-${index}`}
                                  points={svgPoints(opening)}
                                />
                              )),
                            )}
                          </>
                        )}
                        {masterRoofCutoutURL ? (
                          <image
                            height="1000"
                            href={masterRoofCutoutURL}
                            preserveAspectRatio="none"
                            width="1000"
                          />
                        ) : (
                          containingRoofZones.map((zone) => (
                            <polygon
                              fill="black"
                              key={`${zone.id}-roof-cutout`}
                              points={svgPoints(zone.points)}
                            />
                          ))
                        )}
                      </mask>
                    </defs>
                    <image
                      clipPath={
                        masterTokenInsideRoof
                          ? "url(#master-roof-los-clip)"
                          : undefined
                      }
                      height="1000"
                      href={roofUrl}
                      mask="url(#master-roof-mask)"
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
            {levels.length > 1 ? (
              <section className="session-map-levels" aria-label="Этажи сцены">
                <div>
                  <strong>Этажи</strong>
                  <span>
                    {activeLevel + 1} из {levels.length}
                  </span>
                </div>
                <div className="session-map-level-buttons">
                  {levels.map((level, index) => (
                    <button
                      className={index === activeLevel ? "primary" : "ghost"}
                      key={level.id}
                      onClick={() => selectLevel(index)}
                      type="button"
                    >
                      {`${index + 1}-й этаж`}
                    </button>
                  ))}
                </div>
                <small>
                  На телевизоре показывается только выбранный этаж; следующий
                  слой работает как крыша.
                </small>
              </section>
            ) : null}
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
              {!pairedVTT ? (
                <button
                  className={tool === "roof" ? "primary" : "ghost"}
                  disabled={!imageUrl || !roofUrl}
                  onClick={() => setTool(tool === "roof" ? null : "roof")}
                  type="button"
                >
                  Нарисовать зону крыши
                </button>
              ) : null}
              {!pairedVTT ? (
                <button
                  className={tool === "roofOpening" ? "primary" : "ghost"}
                  disabled={!imageUrl || !roofUrl || !roofZones.length}
                  onClick={() =>
                    setTool(tool === "roofOpening" ? null : "roofOpening")
                  }
                  type="button"
                >
                  Нарисовать проём крыши
                </button>
              ) : null}
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
            {roofUrl && !pairedVTT ? (
              <div className="session-map-region-list">
                {roofZones.map((zone, index) => (
                  <div className="session-map-region-row" key={zone.id}>
                    <span>
                      Зона крыши {index + 1} · проёмов:{" "}
                      {(zone.openings ?? []).length}
                    </span>
                    <button
                      aria-label={`Удалить зону крыши ${index + 1}`}
                      className="ghost danger"
                      onClick={() =>
                        updateRoofZones(
                          roofZones.filter((item) => item.id !== zone.id),
                        )
                      }
                      type="button"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
                {!roofZones.length ? (
                  <>
                    <p className="session-map-tip">
                      Для старой VTT-сцены можно автоматически создать отдельные
                      зоны по связным группам стен.
                    </p>
                    <button
                      className="ghost"
                      onClick={() => updateRoofZones(suggestedRoofZones(walls))}
                      type="button"
                    >
                      Создать зоны крыши из стен
                    </button>
                  </>
                ) : null}
                {roofZones.flatMap((zone, zoneIndex) =>
                  (zone.openings ?? []).map((opening, openingIndex) => (
                    <div
                      className="session-map-region-row"
                      key={`${zone.id}-opening-${openingIndex}`}
                    >
                      <span>
                        Проём {openingIndex + 1} · зона {zoneIndex + 1}
                      </span>
                      <button
                        className="ghost danger"
                        onClick={() =>
                          updateRoofZones(
                            roofZones.map((candidate) =>
                              candidate.id === zone.id
                                ? {
                                    ...candidate,
                                    openings: (candidate.openings ?? []).filter(
                                      (_, index) => index !== openingIndex,
                                    ),
                                  }
                                : candidate,
                            ),
                          )
                        }
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  )),
                )}
              </div>
            ) : null}
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
                <button
                  className="ghost"
                  disabled={busy}
                  onClick={() => void rotateDisplayLink()}
                  type="button"
                >
                  Создать новую ссылку
                </button>
                <p className="session-map-tip">
                  Эта ссылка сохраняется для всех карт и после перезапуска
                  приложения. Туман, стены и положение фишки обновляются
                  автоматически.
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
                : regionMenu.kind === "roof"
                  ? "Удалить зону крыши"
                  : "Удалить область"}
            </button>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
