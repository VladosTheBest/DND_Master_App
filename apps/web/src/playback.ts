import type { PlaylistTrack } from "@shadow-edge/shared-types";

declare global {
  interface Window {
    YT?: {
      Player: new (element: string | HTMLElement, options: Record<string, unknown>) => {
        destroy?: () => void;
        loadVideoById?: (options: Record<string, unknown> | string) => void;
        playVideo?: () => void;
        pauseVideo?: () => void;
        seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
        getCurrentTime?: () => number;
        getDuration?: () => number;
        setVolume?: (volume: number) => void;
      };
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
    __shadowEdgeYouTubeApiPromise?: Promise<NonNullable<Window["YT"]>>;
  }
}

export type PlaybackSource =
  | {
      kind: "youtube";
      videoId: string;
      embedUrl: string;
    }
  | {
      kind: "audio";
      url: string;
    };

export const defaultFloatingPlayerPosition = () => {
  if (typeof window === "undefined") {
    return { x: 16, y: 16 };
  }

  return {
    x: Math.max(16, window.innerWidth - 428),
    y: Math.max(16, window.innerHeight - 232)
  };
};

export const extractYouTubeVideoId = (value: string) => {
  const url = value.trim();
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") ?? "";
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") {
        return segments[1] ?? "";
      }
    }
  } catch {
    return "";
  }

  return "";
};

export const resolvePlaylistSource = (url: string): PlaybackSource => {
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return {
      kind: "youtube",
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1`
    };
  }

  return {
    kind: "audio",
    url
  };
};

export const pickRandomTrackIndex = (tracks: PlaylistTrack[], excludeIndex?: number) => {
  if (!tracks.length) {
    return -1;
  }
  if (tracks.length === 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * tracks.length);
  if (excludeIndex === undefined) {
    return nextIndex;
  }

  while (nextIndex === excludeIndex) {
    nextIndex = Math.floor(Math.random() * tracks.length);
  }

  return nextIndex;
};

export const formatPlaybackTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export const loadYouTubeIframeApi = (): Promise<NonNullable<Window["YT"]>> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API недоступен вне браузера."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__shadowEdgeYouTubeApiPromise) {
    return window.__shadowEdgeYouTubeApiPromise;
  }

  window.__shadowEdgeYouTubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube API загрузилась некорректно."));
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Не удалось загрузить YouTube IFrame API."));
      document.head.appendChild(script);
    }
  });

  return window.__shadowEdgeYouTubeApiPromise;
};
