import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { PlaylistTrack } from "@shadow-edge/shared-types";
import {
  badge,
  clamp,
  playlistTrackHost,
  playlistTrackTitle
} from "./app-shared";
import {
  defaultFloatingPlayerPosition,
  formatPlaybackTime,
  loadYouTubeIframeApi,
  type PlaybackSource
} from "./playback";

type ActivePlaylistPlaybackLike = {
  ownerTitle: string;
  tracks: PlaylistTrack[];
  currentIndex: number;
  token: number;
};

export function FloatingPlaylistPlayer({
  playback,
  track,
  trackLabel,
  source,
  onSelectTrack,
  onPrevious,
  onNext,
  onStop
}: {
  playback: ActivePlaylistPlaybackLike;
  track: PlaylistTrack;
  trackLabel: string;
  source: PlaybackSource;
  onSelectTrack: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<{
    destroy?: () => void;
    loadVideoById?: (options: Record<string, unknown> | string) => void;
    playVideo?: () => void;
    pauseVideo?: () => void;
    seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
    getCurrentTime?: () => number;
    getDuration?: () => number;
    setVolume?: (volume: number) => void;
  } | null>(null);
  const youtubePollRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const onNextRef = useRef(onNext);
  const volumeRef = useRef(72);
  const [collapsed, setCollapsed] = useState(false);
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);
  const [position, setPosition] = useState(defaultFloatingPlayerPosition);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bootError, setBootError] = useState("");
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") {
      return 72;
    }
    const stored = Number.parseInt(window.localStorage.getItem("shadow-edge-player-volume") ?? "72", 10);
    return clamp(Number.isFinite(stored) ? stored : 72, 0, 100);
  });
  const sourceKey = source.kind === "youtube" ? source.videoId : source.url;

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    volumeRef.current = volume;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("shadow-edge-player-volume", String(volume));
    }
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    youtubePlayerRef.current?.setVolume?.(volume);
  }, [volume]);

  const clampPosition = (x: number, y: number) => {
    const panelWidth = panelRef.current?.offsetWidth ?? (collapsed ? 320 : 420);
    const panelHeight = panelRef.current?.offsetHeight ?? (collapsed ? 80 : 240);
    return {
      x: clamp(x, 12, Math.max(12, window.innerWidth - panelWidth - 12)),
      y: clamp(y, 12, Math.max(12, window.innerHeight - panelHeight - 12))
    };
  };

  const syncYouTubeMetrics = () => {
    const player = youtubePlayerRef.current;
    if (!player?.getCurrentTime || !player.getDuration) {
      return;
    }

    setCurrentTime(player.getCurrentTime() ?? 0);
    setDuration(player.getDuration() ?? 0);
  };

  const stopYouTubePolling = () => {
    if (youtubePollRef.current !== null) {
      window.clearInterval(youtubePollRef.current);
      youtubePollRef.current = null;
    }
  };

  const startYouTubePolling = () => {
    stopYouTubePolling();
    youtubePollRef.current = window.setInterval(syncYouTubeMetrics, 500);
  };

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      setPosition(clampPosition(event.clientX - dragRef.current.offsetX, event.clientY - dragRef.current.offsetY));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [collapsed]);

  useEffect(() => {
    setBootError("");
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(true);
    setTrackPickerOpen(false);
  }, [playback.token, playback.currentIndex, source.kind, track.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (source.kind !== "audio") {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => onNextRef.current();
    const handleError = () => setBootError("Этот аудио-источник не удалось воспроизвести.");

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.src = source.url;
    audio.volume = volumeRef.current / 100;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      setIsPlaying(false);
      setBootError("Браузер не дал запустить этот аудио-источник автоматически.");
    });

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [source.kind, sourceKey, track.url]);

  useEffect(() => {
    if (source.kind !== "youtube") {
      stopYouTubePolling();
      youtubePlayerRef.current?.pauseVideo?.();
      return;
    }

    let cancelled = false;
    setBootError("");

    void loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !youtubeHostRef.current) {
          return;
        }

        const bindPlayer = () => {
          if (!youtubePlayerRef.current) {
            youtubePlayerRef.current = new YT.Player(youtubeHostRef.current as HTMLElement, {
              width: "1",
              height: "1",
              videoId: source.videoId,
              playerVars: {
                autoplay: 1,
                controls: 0,
                rel: 0,
                playsinline: 1,
                modestbranding: 1,
                origin: window.location.origin
              },
              events: {
                onReady: (event: { target: { playVideo?: () => void; setVolume?: (volume: number) => void } }) => {
                  if (cancelled) {
                    return;
                  }
                  event.target.setVolume?.(volumeRef.current);
                  event.target.playVideo?.();
                  startYouTubePolling();
                  syncYouTubeMetrics();
                },
                onStateChange: (event: { data: number }) => {
                  if (cancelled) {
                    return;
                  }
                  setIsPlaying(event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING);
                  if (event.data === YT.PlayerState.ENDED) {
                    onNextRef.current();
                  }
                  syncYouTubeMetrics();
                },
                onError: () => {
                  if (cancelled) {
                    return;
                  }
                  setBootError("YouTube не дал воспроизвести этот трек.");
                }
              }
            });
            return;
          }

          youtubePlayerRef.current.loadVideoById?.({
            videoId: source.videoId,
            startSeconds: 0
          });
          startYouTubePolling();
          syncYouTubeMetrics();
        };

        bindPlayer();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось подключить YouTube player.");
      });

    return () => {
      cancelled = true;
    };
  }, [source.kind, sourceKey]);

  useEffect(() => {
    return () => {
      stopYouTubePolling();
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, []);

  const togglePlayback = () => {
    if (source.kind === "audio") {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (audio.paused) {
        void audio.play().catch(() => {
          setBootError("Браузер не дал продолжить аудио.");
        });
      } else {
        audio.pause();
      }
      return;
    }

    const player = youtubePlayerRef.current;
    if (!player) {
      return;
    }
    if (isPlaying) {
      player.pauseVideo?.();
    } else {
      player.playVideo?.();
    }
  };

  const seekPlayback = (nextValue: number) => {
    const normalized = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
    if (source.kind === "audio") {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = normalized;
      setCurrentTime(normalized);
      return;
    }

    youtubePlayerRef.current?.seekTo?.(normalized, true);
    setCurrentTime(normalized);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    const rect = panelRef.current?.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (rect?.left ?? position.x),
      offsetY: event.clientY - (rect?.top ?? position.y)
    };
    target.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={`playlist-player-shell ${collapsed ? "collapsed" : ""}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <section ref={panelRef} className="panel playlist-player">
        <div className="row playlist-player-topbar">
          <button className="ghost playlist-drag-handle" onPointerDown={beginDrag} type="button">
            Перетащить
          </button>
          <div className="actions">
            <button className="ghost" onClick={() => setCollapsed((current) => !current)} type="button">
              {collapsed ? "Развернуть" : "Свернуть"}
            </button>
            <button className="ghost" onClick={onStop} type="button">
              Закрыть
            </button>
          </div>
        </div>

        <div className="stack compact">
          <p className="eyebrow">Now Playing</p>
          <strong>{trackLabel}</strong>
          <small>{playback.ownerTitle}</small>
          {bootError ? <small>{bootError}</small> : null}
        </div>

        <div className="playlist-inline-controls">
          <button className="ghost" onClick={onPrevious} type="button">
            ←
          </button>
          <button className="primary" onClick={togglePlayback} type="button">
            {isPlaying ? "Пауза" : "Play"}
          </button>
          <button className="ghost" onClick={onNext} type="button">
            →
          </button>
          <button className="ghost" onClick={() => setTrackPickerOpen((current) => !current)} type="button">
            {trackPickerOpen ? "Скрыть треки" : "Выбрать трек"}
          </button>
          <button className="ghost" onClick={() => window.open(track.url, "_blank", "noopener,noreferrer")} type="button">
            Источник
          </button>
        </div>

        {!collapsed ? (
          <>
            <label className="playlist-volume-shell">
              <span>Громкость</span>
              <input
                className="playlist-volume"
                max={100}
                min={0}
                onChange={(event) => setVolume(clamp(Number.parseInt(event.target.value, 10) || 0, 0, 100))}
                step={1}
                type="range"
                value={volume}
              />
              <strong>{volume}%</strong>
            </label>

            <label className="playlist-progress-shell">
              <input
                className="playlist-progress"
                max={Math.max(duration, 0.1)}
                min={0}
                onChange={(event) => seekPlayback(Number.parseFloat(event.target.value) || 0)}
                step={0.1}
                type="range"
                value={Math.min(currentTime, duration || 0)}
              />
            </label>

            <div className="row muted">
              <span>{formatPlaybackTime(currentTime)}</span>
              <span>{source.kind === "youtube" ? "YouTube" : playlistTrackHost(track.url)}</span>
              <span>{formatPlaybackTime(duration)}</span>
            </div>

            {trackPickerOpen ? (
              <div className="playlist-floating-track-list">
                {playback.tracks.map((playlistTrack, index) => {
                  const active = index === playback.currentIndex;
                  return (
                    <button
                      key={`${playlistTrack.url}-${index}`}
                      className={`ghost fill playlist-track-row ${active ? "active" : ""}`}
                      onClick={() => {
                        onSelectTrack(index);
                        setTrackPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="playlist-track-copy">
                        <strong>{playlistTrackTitle(playlistTrack, index)}</strong>
                        <small>{playlistTrackHost(playlistTrack.url)}</small>
                      </span>
                      <span className={badge(active ? "success" : "default")}>{active ? "Играет" : "Выбрать"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        <audio ref={audioRef} className="playlist-audio-hidden" preload="auto" />
        <div className="playlist-media-shell" aria-hidden="true">
          <div ref={youtubeHostRef} />
        </div>
      </section>
    </div>
  );
}
