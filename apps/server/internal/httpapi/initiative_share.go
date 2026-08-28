package httpapi

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html"
	"html/template"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"
)

type initiativeShareManager struct {
	store *campaignStore

	mu               sync.RWMutex
	tokenToCampaign  map[string]string
	campaignToToken  map[string]string
	published        map[string]publicInitiativeSnapshot
	displayPublished map[string]publicDisplaySnapshot
	configuredBase   string
	publicServer     *http.Server
	publicListener   net.Listener
	publicOrigin     string
	publicBaseURL    string
	publicProvider   string
	tunnelCmd        *exec.Cmd
}

type initiativeShareResponse struct {
	CampaignID       string `json:"campaignId"`
	Token            string `json:"token"`
	URL              string `json:"url"`
	Provider         string `json:"provider,omitempty"`
	PublishedVersion int64  `json:"publishedVersion,omitempty"`
	PublishedAt      string `json:"publishedAt,omitempty"`
}

type publicInitiativeSnapshot struct {
	CampaignID    string                  `json:"campaignId"`
	CampaignTitle string                  `json:"campaignTitle"`
	Mode          string                  `json:"mode"`
	Combat        *publicInitiativeCombat `json:"combat"`
	Result        *publicInitiativeResult `json:"result,omitempty"`
	Image         *publicDisplayImage     `json:"image,omitempty"`
	Version       int64                   `json:"version"`
	UpdatedAt     string                  `json:"updatedAt"`
}

type publicInitiativeMeta struct {
	CampaignID string `json:"campaignId"`
	Mode       string `json:"mode"`
	Version    int64  `json:"version"`
	UpdatedAt  string `json:"updatedAt"`
	HasImage   bool   `json:"hasImage"`
}

type playerDisplayImageInput struct {
	URL            string              `json:"url"`
	RoofURL        string              `json:"roofUrl"`
	RoofVisionOnly bool                `json:"roofVisionOnly"`
	RoofZones      []publicRoofZone    `json:"roofZones"`
	Title          string              `json:"title"`
	Alt            string              `json:"alt"`
	Caption        string              `json:"caption"`
	FogRows        int                 `json:"fogRows"`
	FogColumns     int                 `json:"fogColumns"`
	Revealed       []int               `json:"revealed"`
	ShowGrid       bool                `json:"showGrid"`
	SessionMap     bool                `json:"sessionMap"`
	MediaType      string              `json:"mediaType"`
	FogRegions     []publicFogRegion   `json:"fogRegions"`
	Walls          []publicDisplayWall `json:"walls"`
	Token          *publicDisplayToken `json:"token"`
	VisionPolygon  []publicFogPoint    `json:"visionPolygon"`
	FOVPolygon     []publicFogPoint    `json:"fovPolygon"`
	MapAspectRatio float64             `json:"mapAspectRatio"`
	Grid           *publicDisplayGrid  `json:"grid"`
	Viewport       *publicViewport     `json:"viewport"`
	DeepZoom       *publicDeepZoom     `json:"deepZoom"`
}

type publicDeepZoom struct {
	DescriptorURL string `json:"descriptorUrl"`
	TileBaseURL   string `json:"tileBaseUrl"`
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	TileSize      int    `json:"tileSize"`
	Format        string `json:"format"`
	MaxLevel      int    `json:"maxLevel"`
}

type publicFogPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type publicFogRegion struct {
	ID       string           `json:"id"`
	Points   []publicFogPoint `json:"points"`
	Revealed bool             `json:"revealed"`
}

type publicRoofZone struct {
	ID       string             `json:"id"`
	Points   []publicFogPoint   `json:"points"`
	Openings [][]publicFogPoint `json:"openings,omitempty"`
}

type publicDisplayWall struct {
	ID       string           `json:"id"`
	Kind     string           `json:"kind,omitempty"`
	Start    publicFogPoint   `json:"start"`
	End      publicFogPoint   `json:"end"`
	Disabled bool             `json:"disabled,omitempty"`
	Points   []publicFogPoint `json:"points,omitempty"`
}

type publicDisplayToken struct {
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	VisionRadius float64 `json:"visionRadius"`
}

type publicDisplayGrid struct {
	Type    string  `json:"type"`
	Size    float64 `json:"size"`
	Color   string  `json:"color"`
	Opacity float64 `json:"opacity"`
}

type publicViewport struct {
	Zoom float64 `json:"zoom"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}

type publicDisplayImage struct {
	URL            string              `json:"url"`
	RoofURL        string              `json:"roofUrl,omitempty"`
	RoofVisionOnly bool                `json:"roofVisionOnly,omitempty"`
	RoofZones      []publicRoofZone    `json:"roofZones,omitempty"`
	Title          string              `json:"title,omitempty"`
	Alt            string              `json:"alt,omitempty"`
	Caption        string              `json:"caption,omitempty"`
	FogRows        int                 `json:"fogRows,omitempty"`
	FogColumns     int                 `json:"fogColumns,omitempty"`
	Revealed       []int               `json:"revealed,omitempty"`
	ShowGrid       bool                `json:"showGrid,omitempty"`
	SessionMap     bool                `json:"sessionMap,omitempty"`
	MediaType      string              `json:"mediaType,omitempty"`
	FogRegions     []publicFogRegion   `json:"fogRegions,omitempty"`
	Walls          []publicDisplayWall `json:"walls,omitempty"`
	Token          *publicDisplayToken `json:"token,omitempty"`
	VisionPolygon  []publicFogPoint    `json:"visionPolygon,omitempty"`
	FOVPolygon     []publicFogPoint    `json:"fovPolygon,omitempty"`
	MapAspectRatio float64             `json:"mapAspectRatio,omitempty"`
	Grid           *publicDisplayGrid  `json:"grid,omitempty"`
	Viewport       *publicViewport     `json:"viewport,omitempty"`
	DeepZoom       *publicDeepZoom     `json:"deepZoom,omitempty"`
}

type publicDisplaySnapshot struct {
	CampaignID    string              `json:"campaignId"`
	CampaignTitle string              `json:"campaignTitle"`
	Image         *publicDisplayImage `json:"image,omitempty"`
	Version       int64               `json:"version"`
	UpdatedAt     string              `json:"updatedAt"`
}

type publicDisplayMeta struct {
	CampaignID string `json:"campaignId"`
	Mode       string `json:"mode"`
	Version    int64  `json:"version"`
	UpdatedAt  string `json:"updatedAt"`
	HasImage   bool   `json:"hasImage"`
}

type publicInitiativeCombat struct {
	ID                 string                  `json:"id"`
	Title              string                  `json:"title"`
	Round              int                     `json:"round"`
	PartySize          int                     `json:"partySize"`
	Difficulty         string                  `json:"difficulty,omitempty"`
	CurrentTurnEntryID string                  `json:"currentTurnEntryId,omitempty"`
	Entries            []publicInitiativeEntry `json:"entries"`
}

type publicInitiativeResult struct {
	CombatID            string                   `json:"combatId"`
	Title               string                   `json:"title"`
	Outcome             string                   `json:"outcome"`
	DefeatedCount       int                      `json:"defeatedCount"`
	TotalExperience     int                      `json:"totalExperience"`
	ExperiencePerPlayer int                      `json:"experiencePerPlayer"`
	Round               int                      `json:"round,omitempty"`
	Entries             []publicInitiativeEntry  `json:"entries,omitempty"`
	PlayerRewards       []publicInitiativeReward `json:"playerRewards,omitempty"`
	FinishedAt          string                   `json:"finishedAt,omitempty"`
}

type publicInitiativeReward struct {
	Title      string `json:"title"`
	Experience int    `json:"experience"`
}

type publicInitiativeEntry struct {
	ID            string `json:"id"`
	EntityID      string `json:"entityId"`
	EntityKind    string `json:"entityKind"`
	Side          string `json:"side"`
	Title         string `json:"title"`
	Summary       string `json:"summary"`
	Role          string `json:"role"`
	ImageURL      string `json:"imageUrl,omitempty"`
	ImageAlt      string `json:"imageAlt,omitempty"`
	ArmorClass    string `json:"armorClass"`
	Initiative    int    `json:"initiative"`
	Challenge     string `json:"challenge,omitempty"`
	Experience    int    `json:"experience,omitempty"`
	Bloodied      bool   `json:"bloodied,omitempty"`
	Condition     string `json:"condition,omitempty"`
	ConditionTone string `json:"conditionTone,omitempty"`
	Defeated      bool   `json:"defeated"`
	IsCurrentTurn bool   `json:"isCurrentTurn"`
}

type initiativeViewerPageData struct {
	Token         string
	CampaignTitle string
}

type publicDisplayPageData struct {
	Token         string
	CampaignTitle string
}

const (
	publicScreenModeInitiative = "initiative"
	publicScreenModeImage      = "image"
	publicScreenModeResult     = "result"
	publicScreenModeWaiting    = "waiting"
)

var (
	tunnelURLPattern         = regexp.MustCompile(`https://[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)*(?:trycloudflare\.com|loca\.lt|localtunnel\.me)(?:/[^\s"'<>]*)?`)
	initiativeViewerTemplate = template.Must(template.New("initiative-viewer").Parse(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ .CampaignTitle }} - Трекер инициативы</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #06080d;
        color: #f0e6d6;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 50% 0%, rgba(160, 118, 57, 0.18), transparent 24%),
          radial-gradient(circle at 50% 100%, rgba(255, 189, 91, 0.08), transparent 26%),
          radial-gradient(circle at 15% 30%, rgba(60, 44, 24, 0.12), transparent 22%),
          linear-gradient(180deg, #06070c, #070910 48%, #06080d);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.03), transparent 30%),
          radial-gradient(circle at 82% 12%, rgba(255, 216, 151, 0.03), transparent 28%);
        opacity: 0.8;
      }
      body::after {
        content: "";
        position: fixed;
        inset: -8%;
        pointer-events: none;
        background:
          radial-gradient(circle at 24% 32%, rgba(201, 142, 72, 0.08), transparent 26%),
          radial-gradient(circle at 78% 26%, rgba(116, 78, 191, 0.08), transparent 24%),
          radial-gradient(circle at 58% 76%, rgba(255, 203, 128, 0.06), transparent 22%);
        filter: blur(28px);
        animation: ambienceFloat 16s ease-in-out infinite alternate;
        opacity: 0.9;
      }
      .shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px 20px;
      }
      .stage {
        width: min(100%, 112rem);
        display: grid;
        gap: 1.55rem;
        justify-items: center;
      }
      .stage-head {
        display: grid;
        gap: 0.4rem;
        justify-items: center;
        text-align: center;
      }
      .eyebrow {
        margin: 0;
        font-size: 0.82rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #b9a58b;
      }
      .subcopy {
        margin: 0;
        color: #cfbda4;
        font-size: 1rem;
      }
      .round-banner {
        width: min(100%, 76rem);
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 1rem;
        align-items: center;
      }
      .round-banner[hidden] {
        display: none;
      }
      .round-banner h1 {
        margin: 0;
        font-size: clamp(2rem, 3vw, 3.2rem);
        font-weight: 600;
        letter-spacing: 0.02em;
        color: #dfc09a;
        font-family: Georgia, "Times New Roman", serif;
      }
      .ornament-line {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(205, 159, 103, 0.42), transparent);
        position: relative;
      }
      .track-viewport {
        position: relative;
        width: 100%;
        overflow-x: auto;
        overflow-y: visible;
        padding: 1.85rem 4.5rem 1.35rem;
        scroll-behavior: smooth;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
      }
      .track-viewport::-webkit-scrollbar {
        display: none;
      }
      .track-viewport::before,
      .track-viewport::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 5.5rem;
        z-index: 2;
        pointer-events: none;
      }
      .track-viewport::before {
        left: 0;
        background: linear-gradient(90deg, rgba(6, 7, 12, 0.96), transparent);
      }
      .track-viewport::after {
        right: 0;
        background: linear-gradient(270deg, rgba(6, 7, 12, 0.96), transparent);
      }
      .track {
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 1.1rem;
        width: max-content;
        min-width: 100%;
        padding: 1rem 0 0.85rem;
        margin: 0 auto;
      }
      .card {
        position: relative;
        display: grid;
        flex: 0 0 clamp(11rem, 14vw, 13.4rem);
        gap: 0.72rem;
        padding-top: 1.8rem;
        background: transparent;
        color: #f0e6d6;
        scroll-snap-align: center;
        transition:
          transform 0.42s ease,
          opacity 0.32s ease,
          filter 0.32s ease;
      }
      .card.defeated {
        opacity: 0.45;
        filter: saturate(0.4);
      }
      .card.current {
        transform: translateY(-0.95rem) scale(1.03);
      }
      .order-badge {
        position: absolute;
        top: 0.1rem;
        left: 50%;
        transform: translate(-50%, -48%);
        width: 3rem;
        height: 3rem;
        display: grid;
        place-items: center;
        border-radius: 999px;
        border: 1px solid rgba(214, 170, 113, 0.55);
        background: rgba(14, 18, 28, 0.94);
        color: #e7d3b0;
        font-size: 1.5rem;
        font-family: Georgia, "Times New Roman", serif;
        box-shadow:
          0 0 0 2px rgba(255, 255, 255, 0.03) inset,
          0 10px 20px rgba(0, 0, 0, 0.22);
        z-index: 4;
      }
      .card-frame {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 0.9rem;
        min-height: 24rem;
        padding: 1.45rem 1rem 1.15rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(135, 103, 64, 0.4);
        background:
          linear-gradient(180deg, rgba(18, 22, 32, 0.96), rgba(12, 15, 24, 0.98)),
          rgba(10, 12, 18, 0.98);
        box-shadow:
          0 0 0 1px rgba(255, 219, 171, 0.04) inset,
          0 18px 44px rgba(0, 0, 0, 0.34);
        transition:
          border-color 0.32s ease,
          box-shadow 0.38s ease,
          background 0.38s ease;
      }
      .card-frame::before {
        content: "";
        position: absolute;
        inset: 0.34rem;
        border-radius: 1rem;
        border: 1px solid rgba(223, 190, 145, 0.08);
        pointer-events: none;
      }
      .card.current .card-frame {
        border-color: rgba(235, 174, 92, 0.88);
        background:
          radial-gradient(circle at top, rgba(255, 201, 108, 0.18), transparent 36%),
          linear-gradient(180deg, rgba(34, 27, 18, 0.96), rgba(17, 15, 18, 0.98));
        box-shadow:
          0 0 0 1px rgba(255, 198, 97, 0.3) inset,
          0 0 28px rgba(255, 176, 75, 0.24),
          0 18px 44px rgba(0, 0, 0, 0.38);
        animation: initiativeGlow 2.8s ease-in-out infinite;
      }
      .current-chevron {
        position: absolute;
        top: 0.92rem;
        left: 50%;
        width: 1rem;
        height: 1rem;
        margin-left: -0.5rem;
        border-right: 3px solid #ffcf7a;
        border-bottom: 3px solid #ffcf7a;
        transform: rotate(45deg);
        filter: drop-shadow(0 0 10px rgba(255, 194, 88, 0.5));
        animation: initiativeChevron 1.75s ease-in-out infinite;
      }
      .card-image-shell {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 5;
        border-radius: 0.95rem;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.03);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.04) inset,
          0 10px 22px rgba(0, 0, 0, 0.18);
      }
      .card-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .card-copy {
        display: grid;
        gap: 0.4rem;
        align-content: end;
        text-align: center;
      }
      .card-copy strong,
      .card-copy span {
        font-family: Georgia, "Times New Roman", serif;
      }
      .card-copy strong {
        font-size: 1.05rem;
        font-weight: 500;
        line-height: 1.25;
        color: #f2e8db;
      }
      .card-copy small {
        color: #b6a894;
        font-size: 0.8rem;
        line-height: 1.2;
        min-height: 1.9em;
      }
      .card-copy span {
        font-size: 2.2rem;
        line-height: 1;
        color: #efe4d6;
      }
      .card.current .card-copy span {
        color: #ffcc79;
        text-shadow: 0 0 14px rgba(255, 184, 74, 0.42);
      }
      .card.bloodied:not(.current) .card-frame {
        border-color: rgba(188, 78, 66, 0.68);
        box-shadow:
          0 0 0 1px rgba(202, 109, 96, 0.18) inset,
          0 14px 34px rgba(0, 0, 0, 0.34);
      }
      .card.critical:not(.current) .card-frame {
        border-color: rgba(229, 124, 98, 0.88);
        box-shadow:
          0 0 0 1px rgba(239, 146, 122, 0.24) inset,
          0 0 24px rgba(186, 64, 49, 0.18),
          0 18px 44px rgba(0, 0, 0, 0.36);
      }
      .card-condition {
        min-height: 1.35rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cbbca7;
        background: rgba(255, 255, 255, 0.03);
        font-size: 0.72rem;
        line-height: 1;
        justify-self: center;
      }
      .card-condition.bloodied {
        color: #f7bfad;
        border-color: rgba(212, 112, 93, 0.34);
        background: rgba(122, 38, 31, 0.18);
      }
      .card-condition.critical,
      .card-condition.defeated {
        color: #ffd4c7;
        border-color: rgba(229, 124, 98, 0.42);
        background: rgba(143, 34, 24, 0.26);
      }
      .progress-rail {
        position: relative;
        width: min(100%, 82rem);
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0 4.25rem;
      }
      .progress-rail[hidden] {
        display: none;
      }
      .progress-line {
        position: absolute;
        left: 4.25rem;
        right: 4.25rem;
        top: 50%;
        height: 2px;
        transform: translateY(-50%);
        background: linear-gradient(90deg, rgba(112, 91, 62, 0.32), rgba(220, 167, 88, 0.82), rgba(112, 91, 62, 0.32));
      }
      .progress-dots {
        position: relative;
        z-index: 1;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .progress-dot {
        width: 0.9rem;
        height: 0.9rem;
        border-radius: 999px;
        background: rgba(98, 101, 108, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .progress-dot.current {
        background: #ffd071;
        box-shadow: 0 0 18px rgba(255, 189, 77, 0.48);
        animation: initiativeDotPulse 1.8s ease-in-out infinite;
      }
      .progress-dot.defeated {
        opacity: 0.45;
      }
      .status-row {
        width: min(100%, 82rem);
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.8rem 1.5rem;
        color: #b9a58b;
        font-size: 0.95rem;
      }
      .image-state {
        position: relative;
        width: min(100%, 92rem);
        height: min(76vh, 58rem);
        min-height: 28rem;
        overflow: hidden;
        border-radius: 1.2rem;
        border: 1px solid rgba(124, 96, 197, 0.28);
        background:
          radial-gradient(circle at center, rgba(255, 255, 255, 0.04), transparent 48%),
          linear-gradient(180deg, rgba(9, 12, 18, 0.86), rgba(5, 7, 12, 0.96));
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.04) inset,
          0 24px 72px rgba(0, 0, 0, 0.46);
        display: grid;
        place-items: center;
      }
      .image-canvas {
        position: relative;
        display: inline-block;
        max-width: 100%;
        max-height: 100%;
        line-height: 0;
        transform-origin: center;
        will-change: transform;
      }
      .image-canvas img {
        max-width: 100%;
        max-height: min(76vh, 58rem);
        display: block;
        object-fit: contain;
        object-position: center;
      }
      .tile-layer { position:absolute; inset:0; overflow:hidden; }
      .tile-layer img { position:absolute; max-width:none; pointer-events:none; }
      .image-canvas.video-canvas {
        width: min(100%, calc(76vh * 16 / 9));
        aspect-ratio: 16 / 9;
      }
      .image-canvas.tile-canvas { width:min(100%,76vh); aspect-ratio:var(--tile-aspect,1); }
      .image-canvas iframe,
      .image-canvas video {
        width: 100%;
        height: 100%;
        display: block;
        border: 0;
        pointer-events: none;
        object-fit: contain;
      }
      body.media-only {
        height: 100vh;
        min-height: 0;
        overflow: hidden;
        background: #000;
      }
      body.media-only::before,
      body.media-only::after,
      body.media-only .stage-head,
      body.media-only .progress-rail,
      body.media-only .status-row {
        display: none;
      }
      body.media-only .shell,
      body.media-only .stage,
      body.media-only .track-viewport,
      body.media-only .track {
        width: 100vw;
        height: 100vh;
        min-height: 0;
        max-width: none;
        margin: 0;
        padding: 0;
        gap: 0;
        overflow: hidden;
      }
      body.media-only .track-viewport::before,
      body.media-only .track-viewport::after {
        display: none;
      }
      body.media-only .image-state {
        width: 100vw;
        height: 100vh;
        min-height: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        background: #000;
      }
      body.media-only .image-canvas,
      body.media-only .image-canvas img {
        max-width: 100vw;
        max-height: 100vh;
      }
      body.media-only .image-canvas.video-canvas {
        width: min(100vw, calc(100vh * 16 / 9));
      }
      body.media-only .image-canvas.tile-canvas {
        width: min(100vw, calc(100vh * var(--tile-aspect, 1)));
        height: auto;
      }
      .fog-grid {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        pointer-events: none;
      }
      .fog-regions {
        position: absolute;
        inset: 0;
        z-index: 2;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .roof-overlay {
        position: absolute;
        inset: 0;
        z-index: 3;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: 1;
        transition: opacity 380ms ease;
      }
      .roof-overlay.inside { opacity: 0; }
      .roof-overlay img {
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        object-fit: fill;
      }
      .token-overlay {
        position: absolute;
        inset: 0;
        z-index: 4;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .player-token-image {
        position: absolute;
        width: 44px;
        height: 44px;
        aspect-ratio: 1 / 1;
        max-width: none;
        max-height: none;
        display: block;
        object-fit: contain;
        transform-origin: center;
      }
      .map-grid-overlay {
        position: absolute;
        inset: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .fog-region {
        fill: #020308;
        stroke: rgba(65, 44, 78, 0.42);
        stroke-width: 0.003;
        opacity: 0.995;
        filter: drop-shadow(0 0 0.012px #000);
        transition: opacity 520ms ease;
      }
      .fog-region.revealed {
        opacity: 0;
      }
      .vision-fog { fill: #020308; opacity: 1; }
      .player-token-image { pointer-events: none; filter: drop-shadow(0 0 8px rgba(230,184,95,.8)); }
      .fog-cell {
        min-width: 0;
        min-height: 0;
        background:
          radial-gradient(circle at 45% 48%, rgba(34, 25, 49, 0.94), rgba(3, 5, 10, 0.995) 72%),
          linear-gradient(135deg, rgba(73, 47, 93, 0.24), rgba(0, 0, 0, 0.94));
        box-shadow: 0 0 18px rgba(0, 0, 0, 0.88) inset;
        opacity: 1;
        transition: opacity 520ms ease, filter 520ms ease;
      }
      .fog-cell.revealed {
        opacity: 0;
        filter: blur(8px);
      }
      .fog-grid.show-grid .fog-cell:not(.revealed) {
        outline: 1px solid rgba(210, 173, 255, 0.08);
        outline-offset: -1px;
      }
      .image-overlay {
        position: absolute;
        left: 1.25rem;
        right: 1.25rem;
        bottom: 1.25rem;
        display: grid;
        gap: 0.42rem;
        padding: 0.95rem 1.08rem;
        border-radius: 0.95rem;
        border: 1px solid rgba(122, 94, 198, 0.24);
        background: linear-gradient(180deg, rgba(8, 10, 16, 0.76), rgba(8, 10, 16, 0.92));
        backdrop-filter: blur(18px);
        z-index: 3;
      }
      .image-overlay[hidden] {
        display: none;
      }
      .image-overlay strong {
        color: #fff2df;
        font-size: clamp(1.15rem, 2vw, 1.55rem);
      }
      .image-overlay p {
        margin: 0;
        color: rgba(244, 234, 217, 0.86);
        line-height: 1.55;
      }
      .empty-state {
        width: min(100%, 46rem);
        padding: 2rem 2.2rem;
        border-radius: 1.2rem;
        border: 1px solid rgba(135, 103, 64, 0.3);
        background: rgba(12, 15, 24, 0.82);
        text-align: center;
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
      }
      .empty-state h2 {
        margin: 0 0 0.7rem;
        font-size: clamp(1.8rem, 3vw, 2.5rem);
        font-family: Georgia, "Times New Roman", serif;
        color: #e4c59b;
      }
      .empty-state p {
        margin: 0;
        color: #bcae98;
        line-height: 1.55;
      }
      .victory-state {
        position: relative;
        overflow: hidden;
        width: min(100%, 70rem);
        padding: 1.8rem clamp(1rem, 2.2vw, 2rem) 2rem;
        border-color: rgba(225, 177, 100, 0.3);
        background:
          radial-gradient(circle at 50% 0%, rgba(255, 206, 120, 0.16), transparent 24%),
          radial-gradient(circle at 50% 100%, rgba(156, 24, 17, 0.18), transparent 28%),
          linear-gradient(180deg, rgba(12, 15, 24, 0.94), rgba(7, 9, 15, 0.98));
        box-shadow:
          0 0 0 1px rgba(255, 220, 171, 0.06) inset,
          0 22px 54px rgba(0, 0, 0, 0.34);
      }
      .victory-state::before {
        content: "";
        position: absolute;
        inset: 0.8rem;
        border: 1px solid rgba(226, 191, 131, 0.08);
        border-radius: 1rem;
        pointer-events: none;
      }
      .victory-state::after {
        content: "";
        position: absolute;
        inset: auto 12% -14% 12%;
        height: 34%;
        background: radial-gradient(circle, rgba(131, 18, 16, 0.28), transparent 68%);
        filter: blur(22px);
        pointer-events: none;
      }
      .victory-kicker {
        margin: 0 0 0.65rem;
        color: #f1cf93;
        font-size: 0.82rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .victory-copy {
        margin: 0 auto;
        max-width: 34rem;
      }
      .victory-section {
        width: 100%;
        display: grid;
        gap: 0.7rem;
        justify-items: center;
      }
      .victory-section-label {
        position: relative;
        margin: 0;
        color: #f1cf93;
        font-size: 0.9rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .victory-section-label::before,
      .victory-section-label::after {
        content: "";
        position: absolute;
        top: 50%;
        width: clamp(3rem, 10vw, 8rem);
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(226, 191, 131, 0.46), transparent);
      }
      .victory-section-label::before {
        right: calc(100% + 0.7rem);
      }
      .victory-section-label::after {
        left: calc(100% + 0.7rem);
      }
      .victory-section-label.defeated {
        color: #e07f73;
      }
      .victory-grid {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.8rem;
      }
      .victory-panel {
        position: relative;
        display: grid;
        flex: 0 0 clamp(8.2rem, 11vw, 9.4rem);
        max-width: 9.4rem;
        gap: 0.5rem;
        padding: 0.8rem 0.68rem 0.9rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.03);
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.24);
      }
      .victory-panel.winner {
        border: 1px solid rgba(223, 179, 108, 0.22);
        background:
          linear-gradient(180deg, rgba(255, 214, 152, 0.07), rgba(255, 255, 255, 0.02)),
          rgba(255, 255, 255, 0.03);
      }
      .victory-panel.loser {
        border: 1px solid rgba(191, 89, 80, 0.28);
        background:
          linear-gradient(180deg, rgba(128, 28, 21, 0.16), rgba(255, 255, 255, 0.015)),
          rgba(255, 255, 255, 0.02);
      }
      .victory-panel .card-image-shell {
        position: relative;
        aspect-ratio: 4 / 4.75;
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.04) inset,
          0 10px 22px rgba(0, 0, 0, 0.2);
      }
      .victory-panel.loser .card-image-shell {
        border-color: rgba(184, 73, 61, 0.28);
      }
      .victory-panel.loser .card-image {
        filter: saturate(0.68) brightness(0.72);
      }
      .card-blood-overlay {
        position: absolute;
        inset: -7%;
        width: 114%;
        height: 114%;
        object-fit: cover;
        pointer-events: none;
        mix-blend-mode: screen;
        opacity: 0.88;
      }
      .card-blood-overlay-live {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
        mix-blend-mode: screen;
        opacity: 0.86;
      }
      .victory-panel .card-copy {
        gap: 0.42rem;
      }
      .victory-panel .card-copy strong {
        font-size: 0.98rem;
      }
      .victory-panel .card-copy small {
        min-height: 0;
        font-size: 0.8rem;
      }
      .victory-panel.winner .card-copy span {
        font-size: 1.3rem;
        color: #efcc92;
      }
      .victory-panel.loser .card-copy span {
        font-size: 0.78rem;
        color: #e69383;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .victory-total {
        width: min(100%, 22rem);
        display: grid;
        gap: 0.3rem;
        padding: 0.9rem 1.3rem 1rem;
        border-radius: 1.15rem;
        border: 1px solid rgba(223, 179, 108, 0.28);
        background:
          linear-gradient(180deg, rgba(255, 220, 171, 0.06), rgba(255, 255, 255, 0.015)),
          rgba(255, 255, 255, 0.03);
        box-shadow:
          0 0 0 1px rgba(255, 232, 190, 0.05) inset,
          0 18px 34px rgba(0, 0, 0, 0.26);
      }
      .victory-total small {
        color: #c9b79f;
        font-size: 0.84rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .victory-total strong {
        color: #f6ead3;
        font-size: clamp(2rem, 4vw, 3rem);
        font-family: Georgia, "Times New Roman", serif;
        line-height: 1;
      }
      .victory-total span {
        color: #efcc92;
        font-size: 0.92rem;
        font-family: Georgia, "Times New Roman", serif;
      }
      @keyframes initiativeGlow {
        0%, 100% {
          box-shadow:
            0 0 0 1px rgba(255, 198, 97, 0.28) inset,
            0 0 22px rgba(255, 176, 75, 0.18),
            0 18px 44px rgba(0, 0, 0, 0.38);
        }
        50% {
          box-shadow:
            0 0 0 1px rgba(255, 216, 151, 0.42) inset,
            0 0 34px rgba(255, 188, 86, 0.32),
            0 18px 44px rgba(0, 0, 0, 0.42);
        }
      }
      @keyframes initiativeChevron {
        0%, 100% {
          transform: translateY(0) rotate(45deg);
          opacity: 0.86;
        }
        50% {
          transform: translateY(0.22rem) rotate(45deg);
          opacity: 1;
        }
      }
      @keyframes initiativeDotPulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.16);
        }
      }
      @keyframes ambienceFloat {
        0% {
          transform: translate3d(-1.5%, 0, 0) scale(1);
        }
        50% {
          transform: translate3d(1.2%, -1.4%, 0) scale(1.04);
        }
        100% {
          transform: translate3d(0.8%, 1.2%, 0) scale(1.02);
        }
      }
      @media (max-width: 900px) {
        .shell {
          padding: 22px 14px;
        }
        .victory-grid {
          gap: 0.65rem;
        }
        .victory-total {
          width: 100%;
        }
        .track-viewport {
          padding: 1.6rem 1.8rem 1rem;
        }
        .track-viewport::before,
        .track-viewport::after {
          width: 2rem;
        }
        .progress-rail {
          padding: 0 1.7rem;
        }
        .progress-line {
          left: 1.7rem;
          right: 1.7rem;
        }
      }
      @media (max-width: 1024px) and (orientation: landscape), (max-height: 820px) and (orientation: landscape) {
        .shell {
          padding: 16px 14px;
        }
        .stage {
          width: min(100%, 100rem);
          gap: 0.95rem;
        }
        .stage-head {
          gap: 0.28rem;
        }
        .eyebrow {
          font-size: 0.72rem;
        }
        .subcopy,
        .status-row {
          font-size: 0.88rem;
        }
        .round-banner {
          width: min(100%, 58rem);
          gap: 0.7rem;
        }
        .round-banner h1 {
          font-size: clamp(1.55rem, 3vw, 2.35rem);
        }
        .track-viewport {
          padding: 0.95rem 2rem 0.7rem;
        }
        .track-viewport::before,
        .track-viewport::after {
          width: 2rem;
        }
        .track {
          gap: 0.78rem;
          padding: 0.65rem 0 0.55rem;
        }
        .card {
          flex-basis: clamp(8.4rem, 16vw, 10rem);
          gap: 0.52rem;
          padding-top: 1.3rem;
        }
        .card.current {
          transform: translateY(-0.55rem) scale(1.02);
        }
        .order-badge {
          top: 0.05rem;
          width: 2.35rem;
          height: 2.35rem;
          font-size: 1.16rem;
        }
        .card-frame {
          min-height: 15.7rem;
          padding: 1.02rem 0.78rem 0.78rem;
          gap: 0.58rem;
        }
        .card-image-shell {
          border-radius: 0.82rem;
        }
        .card-copy strong {
          font-size: 0.92rem;
        }
        .card-copy small {
          min-height: 1.55em;
          font-size: 0.72rem;
        }
        .card-copy span {
          font-size: 1.62rem;
        }
        .progress-rail {
          width: min(100%, 72rem);
          padding: 0 2rem;
        }
        .progress-line {
          left: 2rem;
          right: 2rem;
        }
        .progress-dot {
          width: 0.76rem;
          height: 0.76rem;
        }
      }
      @media (max-height: 560px) and (orientation: landscape) {
        .shell {
          padding: 12px 10px;
        }
        .stage {
          gap: 0.72rem;
        }
        .round-banner {
          width: min(100%, 48rem);
        }
        .round-banner h1 {
          font-size: clamp(1.3rem, 2.8vw, 2rem);
        }
        .track-viewport {
          padding: 0.72rem 1.2rem 0.55rem;
        }
        .track-viewport::before,
        .track-viewport::after {
          width: 1.2rem;
        }
        .card {
          flex-basis: clamp(7.6rem, 15vw, 9rem);
          padding-top: 1.08rem;
        }
        .order-badge {
          width: 2rem;
          height: 2rem;
          font-size: 1rem;
        }
        .card-frame {
          min-height: 13.8rem;
          padding: 0.88rem 0.68rem 0.7rem;
        }
        .card-copy strong {
          font-size: 0.84rem;
        }
        .card-copy span {
          font-size: 1.38rem;
        }
        .progress-rail {
          padding: 0 1.15rem;
        }
        .progress-line {
          left: 1.15rem;
          right: 1.15rem;
        }
      }
      @media (max-width: 640px) {
        .round-banner {
          width: 100%;
        }
        .stage {
          gap: 1.15rem;
        }
        .card {
          flex-basis: 10rem;
        }
        .card-frame {
          min-height: 21rem;
          padding: 1.35rem 0.8rem 0.95rem;
        }
        .image-state {
          height: min(72vh, 44rem);
          min-height: 22rem;
          border-radius: 0.95rem;
        }
        .image-overlay {
          left: 0.8rem;
          right: 0.8rem;
          bottom: 0.8rem;
        }
        .card-copy span {
          font-size: 1.8rem;
        }
        .progress-dots {
          gap: 0.6rem;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="stage">
        <header class="stage-head">
          <p class="eyebrow">Shadow Edge GM / Публичный трекер</p>
          <div class="round-banner" id="round-banner">
            <span class="ornament-line"></span>
            <h1 id="round-title">Round 1</h1>
            <span class="ornament-line"></span>
          </div>
          <p class="subcopy" id="subcopy">Loading combat state...</p>
        </header>

        <section class="track-viewport">
          <div class="track" id="track"></div>
        </section>

        <div class="progress-rail" id="progress-rail">
          <span class="progress-line"></span>
          <div class="progress-dots" id="progress-dots"></div>
        </div>

        <div class="status-row">
          <span id="status">Waiting for data...</span>
          <span id="meta"></span>
        </div>
      </section>
    </main>

    <script>
      const token = "{{ .Token }}";
      const roundBannerNode = document.getElementById("round-banner");
      const roundTitleNode = document.getElementById("round-title");
      const subcopyNode = document.getElementById("subcopy");
      const trackNode = document.getElementById("track");
      const progressRailNode = document.getElementById("progress-rail");
      const progressDotsNode = document.getElementById("progress-dots");
      const statusNode = document.getElementById("status");
      const metaNode = document.getElementById("meta");
      let currentVersion = 0;

      const UI = {
        campaign: "\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u044f",
        activeCombat: "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0431\u043e\u0439",
        victory: "\u041f\u043e\u0431\u0435\u0434\u0430",
        victoryCopy: "\u0411\u043e\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d. \u041f\u0430\u0440\u0442\u0438\u044f \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 \u043d\u0430\u0433\u0440\u0430\u0434\u0443 \u0438 \u0433\u043e\u0442\u043e\u0432\u0430 \u0434\u0432\u0438\u0433\u0430\u0442\u044c\u0441\u044f \u0434\u0430\u043b\u044c\u0448\u0435.",
        victors: "\u041f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u0438",
        defeatedGroup: "\u041f\u0440\u043e\u0438\u0433\u0440\u0430\u0432\u0448\u0438\u0435",
        totalXp: "\u041e\u0431\u0449\u0438\u0439 \u043e\u043f\u044b\u0442",
        xpPerPlayer: "\u041d\u0430 \u0438\u0433\u0440\u043e\u043a\u0430",
        player: "\u0418\u0433\u0440\u043e\u043a",
        enemy: "\u041f\u0440\u043e\u0442\u0438\u0432\u043d\u0438\u043a",
        portrait: "\u041f\u043e\u0440\u0442\u0440\u0435\u0442",
        waiting: "\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445...",
        updated: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e: ",
        nowActs: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0445\u043e\u0434\u0438\u0442: ",
        round: "\u0420\u0430\u0443\u043d\u0434 ",
        out: "\u0412\u044b\u0432\u0435\u0434\u0435\u043d",
        bloodied: "\u041e\u043a\u0440\u043e\u0432\u0430\u0432\u043b\u0435\u043d",
        critical: "\u041d\u0430 \u0433\u0440\u0430\u043d\u0438",
        participantsSuffix: "\u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432",
        waitingCombat: "\u0418\u043d\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u0430 \u0436\u0434\u0451\u0442 \u0431\u043e\u0439",
        waitingCombatCopy:
          "\u2014 \u043a\u0430\u043a \u0442\u043e\u043b\u044c\u043a\u043e \u043c\u0430\u0441\u0442\u0435\u0440 \u043d\u0430\u0447\u043d\u0451\u0442 \u0431\u043e\u0439, \u0437\u0434\u0435\u0441\u044c \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0436\u0438\u0432\u043e\u0439 \u0442\u0440\u0435\u043a\u0435\u0440 \u0438\u043d\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u044b.",
        imageMode: "\u042d\u043a\u0440\u0430\u043d \u0438\u0433\u0440\u043e\u043a\u043e\u0432",
        imageAlt: "\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0434\u043b\u044f \u0438\u0433\u0440\u043e\u043a\u043e\u0432",
        emptyTitle: "\u0411\u043e\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u043f\u0443\u0449\u0435\u043d",
        emptyBody:
          "\u041e\u0442\u043a\u0440\u043e\u0439 \u0431\u043e\u0435\u0432\u0443\u044e \u0441\u0446\u0435\u043d\u0443 \u0443 \u043c\u0430\u0441\u0442\u0435\u0440\u0430 \u0438 \u043d\u0430\u0447\u043d\u0438 \u0431\u043e\u0439. \u042d\u0442\u0430 \u0441\u0441\u044b\u043b\u043a\u0430 \u0437\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438.",
        refreshFailed: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0438\u043d\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u0443.",
        justNow: "\u0422\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e"
      };

      const escapeHtml = (value) =>
        String(value ?? "").replace(/[&<>\"']/g, (symbol) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        })[symbol] ?? symbol);

      const formatUpdatedAt = (value) => {
        if (!value) return UI.justNow;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      };

      const roleLabel = (entry) => {
        if (entry.side === "player") {
          return UI.player;
        }
        const experience = Number(entry.experience || 0) || 0;
        if (experience > 0) {
          return String(experience) + " XP";
        }
        if (entry.role) {
          return String(entry.role);
        }
        return UI.enemy;
      };

      const victoryMetaLabel = (entry) => {
        const experience = Number(entry.experience || 0) || 0;
        if (experience > 0) {
          return String(experience) + " XP";
        }
        if (entry.role) {
          return String(entry.role);
        }
        return UI.enemy;
      };

      const shouldShowLiveBloodOverlay = (entry) => Boolean(entry && entry.bloodied);

      const setPublishedStatus = (updatedAt) => {
        statusNode.textContent = UI.updated + formatUpdatedAt(updatedAt);
      };

      const visibilityPolygon = (token, walls, aspectRatio) => {
        if (!token) return [];
        const origin = { x: Number(token.x || 0), y: Number(token.y || 0) };
        const radius = Math.max(0.03, Number(token.visionRadius || 0.22));
        const aspect = Math.max(0.2, Number(aspectRatio || 1));
        const angles = Array.from({ length: 180 }, (_, index) => (Math.PI * 2 * index) / 180);
        const wallSegments = (walls || []).filter((wall) => !wall?.disabled).flatMap((wall) => {
          const points = Array.isArray(wall?.points) && wall.points.length >= 2 ? wall.points : [wall.start, wall.end];
          return points.slice(1).map((end, index) => ({ start: points[index], end }));
        });
        wallSegments.forEach((wall) => [wall.start, wall.end].forEach((point) => {
          const angle = Math.atan2((Number(point.y) - origin.y) / aspect, Number(point.x) - origin.x);
          angles.push(angle - 0.0001, angle, angle + 0.0001);
        }));
        const normalizedAngles = angles
          .map((angle) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
          .sort((a, b) => a - b);
        return normalizedAngles.map((angle) => {
          const ray = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * aspect };
          let distance = 1;
          wallSegments.forEach((wall) => {
            const q = wall.start, segment = { x: wall.end.x - q.x, y: wall.end.y - q.y };
            const cross = ray.x * segment.y - ray.y * segment.x;
            if (Math.abs(cross) < 1e-9) return;
            const offset = { x: q.x - origin.x, y: q.y - origin.y };
            const t = (offset.x * segment.y - offset.y * segment.x) / cross;
            const u = (offset.x * ray.y - offset.y * ray.x) / cross;
            if (t >= 0 && t <= distance && u >= 0 && u <= 1) distance = t;
          });
          return { x: origin.x + ray.x * distance, y: origin.y + ray.y * distance };
        });
      };

      // FOV is a hard radius independent of line-of-sight.  LOS still shapes
      // the fog (and the matching roof cut-out), while this clip ensures that
      // no layer of the map leaks beyond the token's actual range.
      const fovClipPath = (token, aspectRatio) => {
        if (!token) return 'none';
        const radius = Math.max(0.03, Number(token.visionRadius || 0.22));
        const aspect = Math.max(0.2, Number(aspectRatio || 1));
        return 'ellipse(' + (radius * 100) + '% ' + (radius * aspect * 100) + '% at ' + (Number(token.x) * 100) + '% ' + (Number(token.y) * 100) + '%)';
      };

      const pointInPolygon = (point, polygon) => {
        let inside = false;
        for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
          const a=polygon[i],b=polygon[j];
          if (((Number(a.y)>Number(point.y)) !== (Number(b.y)>Number(point.y))) && Number(point.x) < (Number(b.x)-Number(a.x))*(Number(point.y)-Number(a.y))/(Number(b.y)-Number(a.y))+Number(a.x)) inside=!inside;
        }
        return inside;
      };

      let displayedSessionToken = null;
      let sessionTokenAnimationFrame = 0;
      const animateSessionToken = (canvas, target, walls, aspect, zoom, publishedVisionPoints, publishedFovClip) => {
        cancelAnimationFrame(sessionTokenAnimationFrame);
        if (!target) { displayedSessionToken = null; return; }
        const start = displayedSessionToken || target;
        const distance = Math.hypot(Number(target.x)-Number(start.x), Number(target.y)-Number(start.y));
        const duration = Math.min(650, Math.max(240, distance * 1100));
        const startedAt = performance.now();
        const tokenNode = canvas.querySelector('.player-token-image');
        const fogNode = canvas.querySelector('.vision-fog');
        const roofCutoutNodes = canvas.querySelectorAll('.roof-vision-cutout');
        const draw = (now) => {
          const raw = Math.min(1, (now-startedAt)/duration);
          const eased = 1-Math.pow(1-raw,3);
          const current = {...target,x:Number(start.x)+(Number(target.x)-Number(start.x))*eased,y:Number(start.y)+(Number(target.y)-Number(start.y))*eased};
          displayedSessionToken = current;
          if (tokenNode) {
            tokenNode.style.left = (current.x * 100) + '%';
            tokenNode.style.top = (current.y * 100) + '%';
            tokenNode.style.transform = 'translate(-50%,-50%) scale(' + (1 / zoom) + ')';
          }
          if (fogNode) {
            const points = String(publishedVisionPoints || '').trim().split(/\s+/).join(' L ');
            fogNode.setAttribute('d',points?'M 0 0 H 1000 V 1000 H 0 Z M '+points+' Z':'');
          }
          // Geometry comes from the GM renderer; do not rederive it here.
          canvas.style.clipPath = publishedFovClip || fovClipPath(current, aspect);
          if (roofCutoutNodes.length) {
            const points = String(publishedVisionPoints || '');
            roofCutoutNodes.forEach((node) => node.setAttribute('points', points));
          }
          if (raw<1) sessionTokenAnimationFrame=requestAnimationFrame(draw);
          else displayedSessionToken=target;
        };
        sessionTokenAnimationFrame=requestAnimationFrame(draw);
      };

      const renderImage = (snapshot, image) => {
        const isSessionMap = Boolean(image?.sessionMap);
        roundBannerNode.hidden = isSessionMap;
        roundTitleNode.textContent = UI.imageMode;
        subcopyNode.textContent = snapshot?.campaignTitle ?? UI.campaign;
        progressRailNode.hidden = true;
        progressDotsNode.innerHTML = "";
        metaNode.textContent = "";

        const title = String(image?.title || "").trim();
        const caption = String(image?.caption || "").trim();
        const overlay = !isSessionMap && (title || caption)
          ? '<figcaption class="image-overlay"><strong>' +
            escapeHtml(title || UI.imageMode) +
            '</strong>' +
            (caption ? '<p>' + escapeHtml(caption) + '</p>' : "") +
            '</figcaption>'
          : "";
        const rows = Math.max(0, Number(image?.fogRows || 0));
        const columns = Math.max(0, Number(image?.fogColumns || 0));
        const revealed = new Set(Array.isArray(image?.revealed) ? image.revealed.map(Number) : []);
        const fogCells = rows >= 2 && columns >= 2
          ? Array.from({ length: rows * columns }, (_, index) =>
              '<span class="fog-cell' + (revealed.has(index) ? ' revealed' : '') + '"></span>'
            ).join("")
          : "";
        const regions = Array.isArray(image?.fogRegions) ? image.fogRegions : [];
        const walls = Array.isArray(image?.walls) ? image.walls : [];
        const token = image?.token || null;
        const grid = image?.grid || null;
        const gridSize = Math.max(5, Math.min(200, Number(grid?.size || .08) * 1000));
        const gridColor = /^#[0-9a-f]{6}$/i.test(String(grid?.color || '')) ? grid.color : '#ffffff';
        const gridOpacity = Math.max(0, Math.min(1, Number(grid?.opacity ?? .35)));
        const gridAspect = Math.max(.2, Math.min(5, Number(image?.mapAspectRatio || 1)));
        const hexWidth = gridSize * 1.732;
        const gridY = (value) => value * gridAspect;
        const hexPath = (cx, cy) => 'M ' + cx + ' ' + gridY(cy-gridSize) + ' L ' + (cx+hexWidth/2) + ' ' + gridY(cy-gridSize/2) + ' L ' + (cx+hexWidth/2) + ' ' + gridY(cy+gridSize/2) + ' L ' + cx + ' ' + gridY(cy+gridSize) + ' L ' + (cx-hexWidth/2) + ' ' + gridY(cy+gridSize/2) + ' L ' + (cx-hexWidth/2) + ' ' + gridY(cy-gridSize/2) + ' Z ';
        const hexes = hexPath(hexWidth/2,gridSize) + hexPath(hexWidth*1.5,gridSize) + hexPath(0,gridSize*2.5) + hexPath(hexWidth,gridSize*2.5) + hexPath(hexWidth*2,gridSize*2.5);
        const gridPattern = grid?.type === 'square'
          ? '<pattern id="session-grid" patternUnits="userSpaceOnUse" width="' + gridSize + '" height="' + (gridSize * gridAspect) + '"><path d="M ' + gridSize + ' 0 H 0 V ' + (gridSize * gridAspect) + '" fill="none" stroke="' + gridColor + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></pattern>'
          : grid?.type === 'hex'
            ? '<pattern id="session-grid" patternUnits="userSpaceOnUse" width="' + (hexWidth * 2) + '" height="' + (gridSize * 3 * gridAspect) + '"><path d="' + hexes + '" fill="none" stroke="' + gridColor + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></pattern>'
            : '';
        const mapGrid = gridPattern ? '<svg class="map-grid-overlay" style="opacity:' + gridOpacity + '" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs>' + gridPattern + '</defs><rect width="1000" height="1000" fill="url(#session-grid)"/></svg>' : '';
        const existingCanvas = trackNode.querySelector(".image-canvas");
        const renderedAspect = existingCanvas?.clientHeight ? existingCanvas.clientWidth / existingCanvas.clientHeight : image?.mapAspectRatio;
        const suppliedVisionPoints = Array.isArray(image?.visionPolygon) && image.visionPolygon.length > 2
          ? image.visionPolygon.map((point) => (Number(point.x) * 1000) + ',' + (Number(point.y) * 1000)).join(' ')
          : '';
        const visionPoints = suppliedVisionPoints || visibilityPolygon(token, walls, renderedAspect).map((point) => (point.x * 1000) + ',' + (point.y * 1000)).join(' ');
        // Match the master preview exactly. A serialized FOV polygon is
        // clamped to map bounds before publication; using it as CSS polygon
        // can fold over itself at an edge and produce wedges on TV. The
        // master uses this unclamped ellipse, while the canvas itself clips it
        // safely to the map rectangle.
        const visionClip = token
          ? fovClipPath(token, Number(image?.mapAspectRatio || renderedAspect))
          : 'none';
        const regionShapes = regions.map((region) => {
          const points = Array.isArray(region?.points)
            ? region.points.map((point) => (Math.max(0, Math.min(1, Number(point?.x || 0))) * 1000) + ',' + (Math.max(0, Math.min(1, Number(point?.y || 0))) * 1000)).join(' ')
            : '';
          return points
            ? '<polygon class="fog-region' + (region?.revealed ? ' revealed' : '') + '" points="' + points + '"></polygon>'
            : '';
        }).join('');
        const visionPath = visionPoints
          ? 'M 0 0 H 1000 V 1000 H 0 Z M ' + visionPoints.trim().split(/\s+/).join(' L ') + ' Z'
          : '';
        const visionFog = visionPath
          ? '<path class="vision-fog" d="' + visionPath + '" fill-rule="evenodd"></path>'
          : '';
        const tokenZoom = Math.max(1, Number(image?.viewport?.zoom || 1));
        const tokenShape = token
          ? '<img class="player-token-image" alt="" src="/session-token.png" style="left:' + (Number(token.x) * 100) + '%;top:' + (Number(token.y) * 100) + '%;transform:translate(-50%,-50%) scale(' + (1 / tokenZoom) + ')">'
          : '';
        const manualFog = token ? '' : regionShapes;
        const fog = manualFog || visionFog
          ? '<svg class="fog-regions" preserveAspectRatio="none" viewBox="0 0 1000 1000">' + visionFog + manualFog + '</svg>'
          : fogCells
            ? '<div class="fog-grid' + (image?.showGrid ? ' show-grid' : '') + '" style="grid-template-columns:repeat(' + columns + ',1fr);grid-template-rows:repeat(' + rows + ',1fr)">' + fogCells + '</div>'
            : "";
        // Paired VTTs are geometrically identical. With a token, roof is the
        // roof-layer in the LOS-dark part of the hard FOV; visible LOS remains
        // the base/current-floor. This is automatic and never requires zones.
        const roofShape = image?.roofUrl
          ? (() => {
              if (token && visionPoints) {
                return '<svg class="roof-overlay vision-only" preserveAspectRatio="none" viewBox="0 0 1000 1000"><defs><mask id="roof-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="white"></rect><polygon class="roof-vision-cutout" points="' + visionPoints + '" fill="black"></polygon></mask></defs><image href="' + escapeHtml(image.roofUrl) + '" width="1000" height="1000" preserveAspectRatio="none" mask="url(#roof-mask)"></image></svg>';
              }
              // The paired roof VTT is an aligned full-map layer. Never infer
              // its extent from walls or roof zones: those are editor aids,
              // not image geometry, and would crop valid roof pixels.
              return '<svg class="roof-overlay" preserveAspectRatio="none" viewBox="0 0 1000 1000"><image href="' + escapeHtml(image.roofUrl) + '" width="1000" height="1000" preserveAspectRatio="none"></image></svg>';
            })()
          : '';
        const tokenOverlay = tokenShape ? '<div class="token-overlay">' + tokenShape + '</div>' : '';
        const isYoutube = image?.mediaType === "youtube";
        const isVideo = image?.mediaType === "video";
        const isTiles = image?.mediaType === "tiles" && image?.deepZoom;
        const viewport = image?.viewport || { zoom: 1, x: 0, y: 0 };
        const cameraTransform = 'translate(' + (Number(viewport.x || 0) * 100) + '%, ' + (Number(viewport.y || 0) * 100) + '%) scale(' + Math.max(1, Number(viewport.zoom || 1)) + ')';
        const mediaKey = String(image?.mediaType || "image") + "|" + String(image?.url || "") + "|" + String(image?.roofUrl || "");
        const tileMarkup = () => {
          if (!isTiles) return "";
          const source=image.deepZoom, zoom=Math.max(1,Number(viewport.zoom||1));
          const level=Math.max(0,Math.min(source.maxLevel,Math.ceil(Math.log2(Math.max(innerWidth,innerHeight)*Math.max(1,devicePixelRatio||1)*zoom*2))));
          const divisor=Math.pow(2,source.maxLevel-level),w=Math.ceil(source.width/divisor),h=Math.ceil(source.height/divisor),size=source.tileSize;
          const left=Math.max(0,.5+(-.5-Number(viewport.x||0))/zoom),right=Math.min(1,.5+(.5-Number(viewport.x||0))/zoom),top=Math.max(0,.5+(-.5-Number(viewport.y||0))/zoom),bottom=Math.min(1,.5+(.5-Number(viewport.y||0))/zoom);
          const c0=Math.max(0,Math.floor(left*w/size)-8),c1=Math.min(Math.ceil(w/size)-1,Math.floor(right*w/size)+8),r0=Math.max(0,Math.floor(top*h/size)-8),r1=Math.min(Math.ceil(h/size)-1,Math.floor(bottom*h/size)+8);
          let html='<div class="tile-layer">'; for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){const tw=Math.min(size,w-col*size),th=Math.min(size,h-row*size);html+='<img alt="" src="'+escapeHtml(source.tileBaseUrl+'/'+level+'/'+col+'_'+row+'.'+source.format)+'" style="left:'+(col*size/w*100)+'%;top:'+(row*size/h*100)+'%;width:calc('+(tw/w*100)+'% + 1px);height:calc('+(th/h*100)+'% + 1px)">';} return html+'</div>';
        };
        const currentCanvas = existingCanvas;
        if (currentCanvas?.dataset?.mediaKey === mediaKey) {
          currentCanvas.style.transform = cameraTransform;
          currentCanvas.style.clipPath = visionClip || 'none';
          if (isTiles) { currentCanvas.querySelector('.tile-layer')?.remove(); currentCanvas.insertAdjacentHTML('afterbegin',tileMarkup()); }
          currentCanvas.querySelectorAll(".fog-regions, .fog-grid, .roof-overlay, .token-overlay").forEach((node) => node.remove());
          currentCanvas.querySelector(".map-grid-overlay")?.remove();
          if (mapGrid) currentCanvas.insertAdjacentHTML("beforeend", mapGrid);
          if (fog) {
            currentCanvas.insertAdjacentHTML("beforeend", fog);
          }
          if (roofShape) currentCanvas.insertAdjacentHTML("beforeend", roofShape);
          if (tokenOverlay) currentCanvas.insertAdjacentHTML("beforeend", tokenOverlay);
          animateSessionToken(currentCanvas, token, walls, renderedAspect, tokenZoom, visionPoints, visionClip);
          setPublishedStatus(snapshot?.updatedAt);
          return;
        }
        const media = isTiles ? tileMarkup() : isYoutube
          ? '<iframe allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="' + escapeHtml(title || UI.imageAlt) + '" src="' + escapeHtml(image?.url || "") + '"></iframe>'
          : isVideo
            ? '<video autoplay loop muted playsinline src="' + escapeHtml(image?.url || "") + '"></video>'
            : '<img alt="' + escapeHtml(image?.alt || title || UI.imageAlt) + '" src="' + escapeHtml(image?.url || "") + '">';
        trackNode.innerHTML =
          '<figure class="image-state"><div class="image-canvas' + (isYoutube || isVideo ? ' video-canvas' : isTiles ? ' tile-canvas' : '') + '" data-media-key="' + escapeHtml(mediaKey) + '" style="transform:' + cameraTransform + ';clip-path:' + (visionClip || 'none') + (isTiles?';--tile-aspect:'+(image.deepZoom.width/image.deepZoom.height):'') + '">' +
          media +
          mapGrid +
          fog +
          roofShape +
          tokenOverlay +
          '</div>' +
          overlay +
          '</figure>';
        animateSessionToken(trackNode.querySelector('.image-canvas'), token, walls, renderedAspect, tokenZoom, visionPoints, visionClip);
        setPublishedStatus(snapshot?.updatedAt);
      };

      document.addEventListener("keydown", (event) => {
        if (String(event.key || "").toLowerCase() === "f" && !document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      });
      document.addEventListener("dblclick", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      });

      const victoryBloodOverlay = "/initiative/assets/victory-blood-overlay.png";

      const render = (snapshot) => {
        const combat = snapshot?.combat ?? null;
        const result = snapshot?.result ?? null;
        const image = snapshot?.image ?? null;
        const mode = snapshot?.mode || (combat ? "initiative" : result ? "result" : image ? "image" : "waiting");
        document.body.classList.toggle("media-only", mode === "image" && Boolean(image?.sessionMap));
        currentVersion = Number(snapshot?.version ?? 0) || 0;
        document.title = combat
          ? combat.title + " - Трекер инициативы"
          : mode === "image"
            ? (snapshot?.campaignTitle ?? "Shadow Edge GM") + " - Player Display"
            : (snapshot?.campaignTitle ?? "Shadow Edge GM") + " - Initiative";

        if (mode === "image" && image?.url) {
          renderImage(snapshot, image);
          return;
        }

        if (result && !combat) {
          const victoryEntries = result.entries || [];
          const perPlayerExperience = Number(result.experiencePerPlayer || result.playerRewards?.[0]?.experience || 0) || 0;
          const rewardByTitle = new Map(
            (result.playerRewards || []).map((reward) => [reward.title, Number(reward.experience || perPlayerExperience) || 0])
          );
          const victoryWinners = victoryEntries
            .filter((entry) => entry.side === "player")
            .map((entry) => {
              const rewardExperience = rewardByTitle.get(entry.title) || perPlayerExperience;
              return (
                '<article class="victory-panel winner">' +
                '<div class="card-image-shell">' +
                '<img alt="' +
                escapeHtml(entry.imageAlt || entry.title || UI.portrait) +
                '" class="card-image" loading="lazy" src="' +
                escapeHtml(entry.imageUrl || "") +
                '">' +
                "</div>" +
                '<div class="card-copy">' +
                "<strong>" +
                escapeHtml(entry.title) +
                "</strong>" +
                "<span>" +
                escapeHtml(String(rewardExperience)) +
                " XP</span>" +
                "</div>" +
                "</article>"
              );
            })
            .join("");
          const victoryLosers = victoryEntries
            .filter((entry) => entry.side === "enemy")
            .map((entry) => {
              return (
                '<article class="victory-panel loser">' +
                '<div class="card-image-shell">' +
                '<img alt="' +
                escapeHtml(entry.imageAlt || entry.title || UI.portrait) +
                '" class="card-image" loading="lazy" src="' +
                escapeHtml(entry.imageUrl || "") +
                '">' +
                '<img alt="" aria-hidden="true" class="card-blood-overlay" loading="lazy" src="' +
                escapeHtml(victoryBloodOverlay) +
                '">' +
                "</div>" +
                '<div class="card-copy">' +
                "<strong>" +
                escapeHtml(entry.title) +
                "</strong>" +
                "<span>" +
                escapeHtml(victoryMetaLabel(entry)) +
                "</span>" +
                "</div>" +
                "</article>"
              );
            })
            .join("");
          const victoryRoundText = "Раунд " + String(Math.max(1, result.round || 1)) + ". Бой завершён.";
          const victoryCards = victoryWinners;
          const victoryRewards = "";
          roundBannerNode.hidden = false;
          roundTitleNode.textContent = UI.victory;
          subcopyNode.textContent =
            (snapshot?.campaignTitle ?? UI.campaign) +
            " - " +
            (result.title || UI.activeCombat) +
            " - " +
            "Раунд " +
            String(Math.max(1, result.round || 1)) +
            ". " +
            UI.victoryCopy;
          const victoryDisplayText =
            UI.round + String(Math.max(1, result.round || 1)) + ". " + "\u0411\u043e\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d.";
          subcopyNode.textContent =
            (snapshot?.campaignTitle ?? UI.campaign) +
            " - " +
            (result.title || UI.activeCombat) +
            " - " +
            victoryDisplayText;
          trackNode.innerHTML =
            '<section class="empty-state victory-state victory-board"><p class="victory-kicker">' +
            UI.victory +
            '</p><h2>' +
            UI.victory +
            '</h2><p>' +
            UI.victoryCopy +
            '</p>' +
            (victoryCards ? '<div class="victory-board-track">' + victoryCards + "</div>" : "") +
            '<div class="victory-stats"><article class="victory-stat"><small>' +
            UI.totalXp +
            '</small><strong>' +
            escapeHtml(String(result.totalExperience || 0)) +
            ' XP</strong></article><article class="victory-stat"><small>' +
            UI.xpPerPlayer +
            '</small><strong>' +
            escapeHtml(String(result.experiencePerPlayer || 0)) +
            ' XP</strong></article></div>' +
            (victoryRewards ? '<div class="victory-rewards">' + victoryRewards + "</div>" : "") +
            '</section>';
          trackNode.innerHTML =
            '<section class="empty-state victory-state"><p class="victory-kicker">' +
            escapeHtml(result.title || UI.activeCombat) +
            '</p><h2>' +
            UI.victory +
            '</h2><p class="victory-copy">' +
            escapeHtml(victoryDisplayText) +
            '</p>' +
            (victoryWinners
              ? '<section class="victory-section"><p class="victory-section-label">' +
                UI.victors +
                '</p><div class="victory-grid">' +
                victoryWinners +
                "</div></section>"
              : "") +
            '<section class="victory-total"><small>' +
            UI.totalXp +
            '</small><strong>' +
            escapeHtml(String(result.totalExperience || 0)) +
            ' XP</strong><span>' +
            escapeHtml(String(perPlayerExperience)) +
            ' XP \u043d\u0430 \u0438\u0433\u0440\u043e\u043a\u0430</span></section>' +
            (victoryLosers
              ? '<section class="victory-section"><p class="victory-section-label defeated">' +
                UI.defeatedGroup +
                '</p><div class="victory-grid">' +
                victoryLosers +
                "</div></section>"
              : "") +
            '</section>';
          progressRailNode.hidden = true;
          metaNode.textContent = "";
          setPublishedStatus(snapshot?.updatedAt);
          return;
        }

        if (!combat || !combat.entries?.length) {
          roundBannerNode.hidden = false;
          roundTitleNode.textContent = UI.waitingCombat;
          subcopyNode.textContent = (snapshot?.campaignTitle ?? UI.campaign) + " " + UI.waitingCombatCopy;
          trackNode.innerHTML =
            '<section class="empty-state"><h2>' +
            UI.emptyTitle +
            '</h2><p>' +
            UI.emptyBody +
            '</p></section>';
          progressRailNode.hidden = true;
          metaNode.textContent = "";
          setPublishedStatus(snapshot?.updatedAt);
          return;
        }

        roundBannerNode.hidden = false;
        roundTitleNode.textContent = UI.round + Math.max(1, combat.round || 1);
        subcopyNode.textContent =
          (snapshot?.campaignTitle ?? UI.campaign) +
          " - " +
          (combat.title || UI.activeCombat) +
          " - " +
          combat.entries.length +
          " " +
          UI.participantsSuffix;

        trackNode.innerHTML = combat.entries
          .map((entry, index) => {
            const classes = ["card"];
            if (entry.isCurrentTurn) {
              classes.push("current");
            }
            if (entry.defeated) {
              classes.push("defeated");
            }
            if (entry.conditionTone) {
              classes.push(entry.conditionTone);
            }
            const conditionMarkup = entry.condition
              ? '<span class="card-condition ' + escapeHtml(entry.conditionTone || "") + '">' + escapeHtml(entry.condition) + "</span>"
              : "";
            return (
              '<article class="' +
              classes.join(" ") +
              '"' +
              (entry.isCurrentTurn ? ' data-current="true"' : "") +
              ">" +
              '<span class="order-badge">' +
              (index + 1) +
              "</span>" +
              '<div class="card-frame">' +
              (entry.isCurrentTurn ? '<span aria-hidden="true" class="current-chevron"></span>' : "") +
              '<div class="card-image-shell">' +
              '<img alt="' +
              escapeHtml(entry.imageAlt || entry.title || UI.portrait) +
              '" class="card-image" loading="lazy" src="' +
              escapeHtml(entry.imageUrl || "") +
              '">' +
              (shouldShowLiveBloodOverlay(entry)
                ? '<img alt="" aria-hidden="true" class="card-blood-overlay-live" loading="lazy" src="' +
                  escapeHtml(victoryBloodOverlay) +
                  '">'
                : "") +
              "</div>" +
              '<div class="card-copy">' +
              "<strong>" +
              escapeHtml(entry.title) +
              "</strong>" +
              "<small>" +
              escapeHtml(roleLabel(entry)) +
              "</small>" +
              conditionMarkup +
              "<span>" +
              entry.initiative +
              "</span>" +
              "</div>" +
              "</div>" +
              "</article>"
            );
          })
          .join("");

        progressRailNode.hidden = false;
        progressDotsNode.innerHTML = combat.entries
          .map(
            (entry) =>
              '<span class="progress-dot' +
              (entry.isCurrentTurn ? " current" : "") +
              (entry.defeated ? " defeated" : "") +
              '"></span>'
          )
          .join("");

        const currentEntry = combat.entries.find((entry) => entry.isCurrentTurn) ?? null;
        metaNode.textContent = currentEntry ? UI.nowActs + currentEntry.title : "";
        setPublishedStatus(snapshot?.updatedAt);

        window.requestAnimationFrame(() => {
          const currentCard = trackNode.querySelector("[data-current='true']");
          if (currentCard && typeof currentCard.scrollIntoView === "function") {
            currentCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          }
        });
      };

      const readJSON = async (response) => {
        const body = await response.text();
        if (!body.trim()) throw new Error(UI.refreshFailed);
        try { return JSON.parse(body); } catch { throw new Error(UI.refreshFailed); }
      };
      const fetchSnapshot = async (force) => {
        const response = await fetch("/api/initiative/" + encodeURIComponent(token), {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = await readJSON(response);
        if (!response.ok) {
          throw new Error(payload?.error?.message || UI.refreshFailed);
        }
        const snapshot = payload?.data ?? payload;
        const nextVersion = Number(snapshot?.version ?? 0) || 0;
        if (!force && currentVersion && nextVersion === currentVersion) {
          setPublishedStatus(snapshot?.updatedAt);
          return;
        }
        render(snapshot);
      };

      const checkForPublishedUpdates = async () => {
        const response = await fetch("/api/initiative-meta/" + encodeURIComponent(token), {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = await readJSON(response);
        if (!response.ok) {
          throw new Error(payload?.error?.message || UI.refreshFailed);
        }
        const meta = payload?.data ?? payload;
        const nextVersion = Number(meta?.version ?? 0) || 0;
        if (!currentVersion || nextVersion !== currentVersion) {
          await fetchSnapshot(true);
          return;
        }
        setPublishedStatus(meta?.updatedAt);
      };

      const tick = async () => {
        try {
          await checkForPublishedUpdates();
        } catch (error) {
          statusNode.textContent = error instanceof Error ? error.message : UI.refreshFailed;
        }
      };

      statusNode.textContent = UI.waiting;
      void fetchSnapshot(true).catch((error) => {
        statusNode.textContent = error instanceof Error ? error.message : UI.refreshFailed;
      });
      window.setInterval(() => {
        void tick();
      }, 2200);
    </script>
  </body>
</html>`))
)

var playerDisplayViewerTemplate = template.Must(template.New("player-display-viewer").Parse(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ .CampaignTitle }} - Экран для игроков</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #05070c;
        color: #f4ead9;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #05070c; }
      body {
        min-height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(circle at top, rgba(114, 82, 211, 0.18), transparent 28%),
          radial-gradient(circle at bottom, rgba(224, 161, 94, 0.14), transparent 24%),
          linear-gradient(180deg, #06080d, #04060a);
      }
      .viewer-shell {
        position: relative;
        min-height: 100vh;
        width: 100vw;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }
      .viewer-stage {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: calc(100vh - 3rem);
        border-radius: 1.5rem;
        border: 1px solid rgba(124, 96, 197, 0.28);
        background: rgba(9, 12, 18, 0.72);
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.46);
      }
      .viewer-empty,
      .viewer-asset {
        position: absolute;
        inset: 0;
      }
      .viewer-empty {
        display: grid;
        place-items: center;
        padding: 2rem;
        text-align: center;
      }
      .viewer-empty-copy {
        max-width: 36rem;
        display: grid;
        gap: 0.75rem;
      }
      .viewer-empty-copy h1 {
        margin: 0;
        font-size: clamp(2rem, 3vw, 3rem);
        font-family: Georgia, "Times New Roman", serif;
        color: #f2e6d3;
      }
      .viewer-empty-copy p,
      .viewer-meta {
        margin: 0;
        color: rgba(244, 234, 217, 0.72);
      }
      .viewer-asset {
        display: none;
        align-items: center;
        justify-content: center;
      }
      .viewer-asset.active {
        display: flex;
      }
      .viewer-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        background:
          radial-gradient(circle at center, rgba(255, 255, 255, 0.03), transparent 50%),
          linear-gradient(180deg, rgba(8, 10, 16, 0.2), rgba(8, 10, 16, 0.5));
      }
      .viewer-overlay {
        position: absolute;
        left: 1.5rem;
        right: 1.5rem;
        bottom: 1.5rem;
        display: grid;
        gap: 0.45rem;
        padding: 1rem 1.15rem;
        border-radius: 1rem;
        background: linear-gradient(180deg, rgba(8, 10, 16, 0.78), rgba(8, 10, 16, 0.92));
        border: 1px solid rgba(122, 94, 198, 0.24);
        backdrop-filter: blur(18px);
      }
      .viewer-overlay[hidden] {
        display: none;
      }
      .viewer-title {
        margin: 0;
        font-size: clamp(1.15rem, 2vw, 1.55rem);
        color: #fff2df;
      }
      .viewer-caption {
        margin: 0;
        font-size: 1rem;
        line-height: 1.55;
        color: rgba(244, 234, 217, 0.86);
      }
      .viewer-status {
        position: absolute;
        top: 1.25rem;
        right: 1.25rem;
        padding: 0.55rem 0.8rem;
        border-radius: 999px;
        background: rgba(11, 14, 22, 0.78);
        border: 1px solid rgba(122, 94, 198, 0.22);
        font-size: 0.9rem;
        color: rgba(244, 234, 217, 0.72);
      }
      @media (max-width: 900px) {
        .viewer-shell { padding: 0.75rem; }
        .viewer-stage { min-height: calc(100vh - 1.5rem); border-radius: 1rem; }
        .viewer-overlay { left: 0.9rem; right: 0.9rem; bottom: 0.9rem; }
      }
    </style>
  </head>
  <body>
    <main class="viewer-shell">
      <section class="viewer-stage">
        <div class="viewer-empty" id="empty-state">
          <div class="viewer-empty-copy">
            <p class="viewer-meta">Экран игроков</p>
            <h1>{{ .CampaignTitle }}</h1>
            <p>Пока мастер не вывел картинку на экран. Как только он нажмёт «Показать игрокам», изображение появится здесь автоматически.</p>
          </div>
        </div>

        <figure class="viewer-asset" id="asset">
          <img class="viewer-image" id="asset-image" alt="" />
          <figcaption class="viewer-overlay" id="asset-overlay" hidden>
            <h2 class="viewer-title" id="asset-title"></h2>
            <p class="viewer-caption" id="asset-caption"></p>
          </figcaption>
        </figure>

        <div class="viewer-status" id="status">Ожидание изображения...</div>
      </section>
    </main>

    <script>
      const token = "{{ .Token }}";
      const emptyStateNode = document.getElementById("empty-state");
      const assetNode = document.getElementById("asset");
      const imageNode = document.getElementById("asset-image");
      const overlayNode = document.getElementById("asset-overlay");
      const titleNode = document.getElementById("asset-title");
      const captionNode = document.getElementById("asset-caption");
      const statusNode = document.getElementById("status");
      let currentVersion = 0;

      const setWaitingState = () => {
        emptyStateNode.hidden = false;
        assetNode.classList.remove("active");
      };

      const setImageState = (image) => {
        if (!image || !image.url) {
          setWaitingState();
          return;
        }

        emptyStateNode.hidden = true;
        assetNode.classList.add("active");
        imageNode.src = image.url;
        imageNode.alt = image.alt || image.title || "Изображение для игроков";

        const title = (image.title || "").trim();
        const caption = (image.caption || "").trim();
        if (!title && !caption) {
          overlayNode.hidden = true;
          titleNode.textContent = "";
          captionNode.textContent = "";
          return;
        }

        overlayNode.hidden = false;
        titleNode.textContent = title;
        captionNode.textContent = caption;
      };

      const applySnapshot = (snapshot) => {
        currentVersion = Number(snapshot?.version || 0) || 0;
        setImageState(snapshot?.image || null);
        if (snapshot?.updatedAt) {
          statusNode.textContent = "Обновлено: " + new Date(snapshot.updatedAt).toLocaleTimeString();
        } else {
          statusNode.textContent = snapshot?.image?.url ? "Показано игрокам" : "Ожидание изображения...";
        }
      };

      const readJSON = async (response) => {
        const body = await response.text();
        if (!body.trim()) throw new Error("Экран игроков временно недоступен.");
        try { return JSON.parse(body); } catch { throw new Error("Экран игроков временно недоступен."); }
      };
      const fetchSnapshot = async (force) => {
        const response = await fetch("/api/display/" + encodeURIComponent(token), {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = await readJSON(response);
        if (!response.ok) {
          throw new Error(payload?.error?.message || "Не удалось обновить экран игроков.");
        }
        const snapshot = payload?.data ?? payload;
        const nextVersion = Number(snapshot?.version || 0) || 0;
        if (!force && currentVersion && nextVersion === currentVersion) {
          if (snapshot?.updatedAt) {
            statusNode.textContent = "Обновлено: " + new Date(snapshot.updatedAt).toLocaleTimeString();
          }
          return;
        }
        applySnapshot(snapshot);
      };

      const checkForUpdates = async () => {
        const response = await fetch("/api/display-meta/" + encodeURIComponent(token), {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = await readJSON(response);
        if (!response.ok) {
          throw new Error(payload?.error?.message || "Не удалось проверить обновления экрана игроков.");
        }
        const meta = payload?.data ?? payload;
        const nextVersion = Number(meta?.version || 0) || 0;
        if (!currentVersion || nextVersion !== currentVersion) {
          await fetchSnapshot(true);
          return;
        }
        statusNode.textContent = meta?.updatedAt ? "Обновлено: " + new Date(meta.updatedAt).toLocaleTimeString() : "Ожидание изображения...";
      };

      void fetchSnapshot(true).catch((error) => {
        setWaitingState();
        statusNode.textContent = error instanceof Error ? error.message : "Не удалось обновить экран игроков.";
      });

      let displayUpdateInFlight = false;
      window.setInterval(() => {
        if (displayUpdateInFlight) return;
        displayUpdateInFlight = true;
        void checkForUpdates().catch((error) => {
          statusNode.textContent = error instanceof Error ? error.message : "Не удалось проверить обновления экрана игроков.";
        }).finally(() => { displayUpdateInFlight = false; });
      }, 300);
    </script>
  </body>
</html>`))

func newInitiativeShareManager(store *campaignStore, publicBaseURL string) *initiativeShareManager {
	return &initiativeShareManager{
		store:            store,
		tokenToCampaign:  map[string]string{},
		campaignToToken:  map[string]string{},
		published:        map[string]publicInitiativeSnapshot{},
		displayPublished: map[string]publicDisplaySnapshot{},
		configuredBase:   strings.TrimRight(strings.TrimSpace(publicBaseURL), "/"),
	}
}

func (srv *server) handleInitiativeShareLegacy(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	campaign, err := srv.store.getCampaign(campaignID)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}
	if campaign.ActiveCombat == nil || len(campaign.ActiveCombat.Entries) == 0 {
		writeError(
			writer,
			http.StatusBadRequest,
			"initiative_share_unavailable",
			"Сначала начни бой, чтобы открыть публичный трекер инициативы.",
		)
		return
	}

	result, err := srv.shares.ensureShare(campaignID, request)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "initiative_share_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleInitiativeSharePublishLegacy(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	campaign, err := srv.store.getCampaign(campaignID)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}
	if campaign.ActiveCombat == nil || len(campaign.ActiveCombat.Entries) == 0 {
		writeError(
			writer,
			http.StatusBadRequest,
			"initiative_share_unavailable",
			"Сначала начни бой, чтобы опубликовать публичный трекер инициативы.",
		)
		return
	}

	result, err := srv.shares.publishShare(campaignID, request)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "initiative_share_publish_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleInitiativeShare(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if _, err := srv.store.getCampaign(campaignID); err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	result, err := srv.shares.ensureShare(campaignID, request)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "initiative_share_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleInitiativeSharePublish(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if _, err := srv.store.getCampaign(campaignID); err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	result, err := srv.shares.publishShare(campaignID, request)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "initiative_share_publish_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handlePlayerDisplay(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if _, err := srv.store.getCampaign(campaignID); err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	var input playerDisplayImageInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if strings.TrimSpace(input.URL) == "" {
		writeError(writer, http.StatusBadRequest, "player_display_missing_url", "Нужно передать URL изображения.")
		return
	}

	result, err := srv.shares.showPlayerDisplayImage(campaignID, request, input)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "player_display_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handlePlayerDisplayRotate(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	result, err := srv.shares.rotatePlayerDisplayShare(campaignID, request)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "player_display_rotate_failed", err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (manager *initiativeShareManager) ensureDisplayTokenLocked(campaign campaignData) (string, error) {
	token := manager.campaignToToken[campaign.ID]
	if token == "" {
		token = strings.TrimSpace(campaign.PlayerDisplayToken)
	}
	if token == "" {
		token = newInitiativeShareToken()
		if err := manager.store.setPlayerDisplayToken(campaign.ID, token); err != nil {
			return "", err
		}
	}
	manager.campaignToToken[campaign.ID] = token
	manager.tokenToCampaign[token] = campaign.ID
	return token, nil
}

func (manager *initiativeShareManager) ensureShare(campaignID string, request *http.Request) (initiativeShareResponse, error) {
	campaign, err := manager.store.getCampaign(campaignID)
	if err != nil {
		return initiativeShareResponse{}, err
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()

	token, err := manager.ensureDisplayTokenLocked(campaign)
	if err != nil {
		return initiativeShareResponse{}, err
	}
	snapshot := manager.currentSnapshotLocked(campaign)
	baseURL, provider, err := manager.resolvePublicBaseURLLocked(request)
	if err != nil {
		return initiativeShareResponse{}, err
	}

	return manager.shareResponseLocked(campaignID, token, snapshot, baseURL, provider), nil
}

func (manager *initiativeShareManager) publishShare(campaignID string, request *http.Request) (initiativeShareResponse, error) {
	return manager.ensureShare(campaignID, request)
}

func (manager *initiativeShareManager) showPlayerDisplayImage(
	campaignID string,
	request *http.Request,
	input playerDisplayImageInput,
) (initiativeShareResponse, error) {
	campaign, err := manager.store.getCampaign(campaignID)
	if err != nil {
		return initiativeShareResponse{}, err
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()

	token, err := manager.ensureDisplayTokenLocked(campaign)
	if err != nil {
		return initiativeShareResponse{}, err
	}

	baseURL, provider, err := manager.resolvePublicBaseURLLocked(request)
	if err != nil {
		return initiativeShareResponse{}, err
	}

	manager.currentDisplaySnapshotLocked(campaign, &publicDisplayImage{
		URL:            resolvePublicDisplayAssetURL(strings.TrimSpace(input.URL), baseURL),
		RoofURL:        resolvePublicDisplayAssetURL(strings.TrimSpace(input.RoofURL), baseURL),
		RoofVisionOnly: input.RoofVisionOnly,
		RoofZones:      input.RoofZones,
		Title:          strings.TrimSpace(input.Title),
		Alt:            strings.TrimSpace(input.Alt),
		Caption:        strings.TrimSpace(input.Caption),
		FogRows:        input.FogRows,
		FogColumns:     input.FogColumns,
		Revealed:       input.Revealed,
		ShowGrid:       input.ShowGrid,
		SessionMap:     input.SessionMap,
		MediaType:      input.MediaType,
		FogRegions:     input.FogRegions,
		Walls:          input.Walls,
		Token:          input.Token,
		VisionPolygon:  input.VisionPolygon,
		FOVPolygon:     input.FOVPolygon,
		MapAspectRatio: input.MapAspectRatio,
		Grid:           input.Grid,
		Viewport:       input.Viewport,
		DeepZoom:       input.DeepZoom,
	})

	publicSnapshot := manager.currentSnapshotLocked(campaign)
	return manager.shareResponseLocked(campaignID, token, publicSnapshot, baseURL, provider), nil
}

func (manager *initiativeShareManager) rotatePlayerDisplayShare(campaignID string, request *http.Request) (initiativeShareResponse, error) {
	campaign, err := manager.store.getCampaign(campaignID)
	if err != nil {
		return initiativeShareResponse{}, err
	}
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if previous := manager.campaignToToken[campaignID]; previous != "" {
		delete(manager.tokenToCampaign, previous)
	}
	token := newInitiativeShareToken()
	if err := manager.store.setPlayerDisplayToken(campaignID, token); err != nil {
		return initiativeShareResponse{}, err
	}
	manager.campaignToToken[campaignID] = token
	manager.tokenToCampaign[token] = campaignID
	baseURL, provider, err := manager.resolvePublicBaseURLLocked(request)
	if err != nil {
		return initiativeShareResponse{}, err
	}
	snapshot := manager.currentSnapshotLocked(campaign)
	return manager.shareResponseLocked(campaignID, token, snapshot, baseURL, provider), nil
}

func (manager *initiativeShareManager) shareResponseLocked(
	campaignID string,
	token string,
	snapshot publicInitiativeSnapshot,
	baseURL string,
	provider string,
) initiativeShareResponse {
	return initiativeShareResponse{
		CampaignID:       campaignID,
		Token:            token,
		URL:              fmt.Sprintf("%s/initiative/%s", strings.TrimRight(baseURL, "/"), url.PathEscape(token)),
		Provider:         provider,
		PublishedVersion: snapshot.Version,
		PublishedAt:      snapshot.UpdatedAt,
	}
}

func (manager *initiativeShareManager) displayShareResponseLocked(
	campaignID string,
	token string,
	snapshot publicDisplaySnapshot,
	baseURL string,
	provider string,
) initiativeShareResponse {
	return initiativeShareResponse{
		CampaignID:       campaignID,
		Token:            token,
		URL:              fmt.Sprintf("%s/display/%s", strings.TrimRight(baseURL, "/"), url.PathEscape(token)),
		Provider:         provider,
		PublishedVersion: snapshot.Version,
		PublishedAt:      snapshot.UpdatedAt,
	}
}

func (manager *initiativeShareManager) currentSnapshotLocked(campaign campaignData) publicInitiativeSnapshot {
	previous := manager.published[campaign.ID]
	snapshot := manager.buildPublicScreenSnapshotLocked(campaign)

	if previous.CampaignID != "" && publicSnapshotFingerprint(previous) == publicSnapshotFingerprint(snapshot) {
		snapshot.Version = previous.Version
		snapshot.UpdatedAt = previous.UpdatedAt
	} else {
		snapshot.Version = previous.Version + 1
		if snapshot.Version <= 0 {
			snapshot.Version = 1
		}
		snapshot.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	manager.published[campaign.ID] = snapshot
	return snapshot
}

func (manager *initiativeShareManager) buildPublicScreenSnapshotLocked(campaign campaignData) publicInitiativeSnapshot {
	snapshot := buildPublicInitiativeSnapshot(campaign)
	display := manager.displayPublished[campaign.ID]

	if shouldShowPublicDisplayImage(campaign, display) {
		snapshot.Mode = publicScreenModeImage
		snapshot.Combat = nil
		snapshot.Result = nil
		snapshot.Image = display.Image
		return snapshot
	}

	snapshot.Mode = publicInitiativeSnapshotMode(snapshot)
	snapshot.Image = nil
	return snapshot
}

func (manager *initiativeShareManager) currentDisplaySnapshotLocked(
	campaign campaignData,
	nextImage *publicDisplayImage,
) publicDisplaySnapshot {
	previous := manager.displayPublished[campaign.ID]
	snapshot := publicDisplaySnapshot{
		CampaignID:    campaign.ID,
		CampaignTitle: campaign.Title,
		Image:         previous.Image,
	}

	if nextImage != nil {
		snapshot.Image = sanitizePublicDisplayImage(*nextImage)
	}

	if previous.CampaignID != "" && publicDisplaySnapshotFingerprint(previous) == publicDisplaySnapshotFingerprint(snapshot) {
		snapshot.Version = previous.Version
		snapshot.UpdatedAt = previous.UpdatedAt
	} else {
		snapshot.Version = previous.Version + 1
		if snapshot.Version <= 0 {
			snapshot.Version = 1
		}
		snapshot.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	manager.displayPublished[campaign.ID] = snapshot
	return snapshot
}

func publicInitiativeSnapshotMode(snapshot publicInitiativeSnapshot) string {
	if snapshot.Combat != nil {
		return publicScreenModeInitiative
	}
	if snapshot.Result != nil {
		return publicScreenModeResult
	}
	if snapshot.Image != nil {
		return publicScreenModeImage
	}
	return publicScreenModeWaiting
}

func shouldShowPublicDisplayImage(campaign campaignData, display publicDisplaySnapshot) bool {
	if display.Image == nil {
		return false
	}
	if campaign.ActiveCombat != nil {
		return display.Image.SessionMap
	}
	if campaign.LastCombatSummary == nil {
		return true
	}

	return publicTimeAfter(display.UpdatedAt, campaign.LastCombatSummary.FinishedAt)
}

func publicTimeAfter(left string, right string) bool {
	leftTime, leftErr := time.Parse(time.RFC3339, strings.TrimSpace(left))
	rightTime, rightErr := time.Parse(time.RFC3339, strings.TrimSpace(right))
	if leftErr != nil || rightErr != nil {
		return false
	}
	return leftTime.After(rightTime)
}

func publicSnapshotFingerprint(snapshot publicInitiativeSnapshot) string {
	var builder strings.Builder
	mode := snapshot.Mode
	if mode == "" {
		mode = publicInitiativeSnapshotMode(snapshot)
	}
	fmt.Fprintf(&builder, "%s|%s|%s|", snapshot.CampaignID, snapshot.CampaignTitle, mode)
	if mode == publicScreenModeImage && snapshot.Image != nil {
		fmt.Fprintf(
			&builder,
			"image|%s|%s|%s|%s|%s|%d|%d|%t|%t|%v|%v|%v|%v|%f|%v|%v|",
			snapshot.Image.URL,
			snapshot.Image.Title,
			snapshot.Image.Alt,
			snapshot.Image.Caption,
			snapshot.Image.MediaType,
			snapshot.Image.FogRows,
			snapshot.Image.FogColumns,
			snapshot.Image.ShowGrid,
			snapshot.Image.SessionMap,
			snapshot.Image.Revealed,
			snapshot.Image.FogRegions,
			snapshot.Image.Walls,
			snapshot.Image.Token,
			snapshot.Image.MapAspectRatio,
			snapshot.Image.Grid,
			snapshot.Image.Viewport,
		)
		return builder.String()
	}
	if snapshot.Combat == nil {
		if snapshot.Result != nil {
			fmt.Fprintf(
				&builder,
				"result|%s|%s|%s|%d|%d|%d|%d|%s|",
				snapshot.Result.CombatID,
				snapshot.Result.Title,
				snapshot.Result.Outcome,
				snapshot.Result.DefeatedCount,
				snapshot.Result.TotalExperience,
				snapshot.Result.ExperiencePerPlayer,
				snapshot.Result.Round,
				snapshot.Result.FinishedAt,
			)
			for _, entry := range snapshot.Result.Entries {
				fmt.Fprintf(
					&builder,
					"%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%d|%s|%d|%t|%s|%s|%t|%t|",
					entry.ID,
					entry.EntityID,
					entry.EntityKind,
					entry.Side,
					entry.Title,
					entry.Summary,
					entry.Role,
					entry.ImageURL,
					entry.ImageAlt,
					entry.ArmorClass,
					entry.Initiative,
					entry.Challenge,
					entry.Experience,
					entry.Bloodied,
					entry.Condition,
					entry.ConditionTone,
					entry.Defeated,
					entry.IsCurrentTurn,
				)
			}
			for _, reward := range snapshot.Result.PlayerRewards {
				fmt.Fprintf(&builder, "reward|%s|%d|", reward.Title, reward.Experience)
			}
			return builder.String()
		}
		builder.WriteString("waiting")
		return builder.String()
	}

	combat := snapshot.Combat
	fmt.Fprintf(
		&builder,
		"%s|%s|%d|%d|%s|%s|",
		combat.ID,
		combat.Title,
		combat.Round,
		combat.PartySize,
		combat.Difficulty,
		combat.CurrentTurnEntryID,
	)
	for _, entry := range combat.Entries {
		fmt.Fprintf(
			&builder,
			"%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%d|%s|%d|%t|%s|%s|%t|%t|",
			entry.ID,
			entry.EntityID,
			entry.EntityKind,
			entry.Side,
			entry.Title,
			entry.Summary,
			entry.Role,
			entry.ImageURL,
			entry.ImageAlt,
			entry.ArmorClass,
			entry.Initiative,
			entry.Challenge,
			entry.Experience,
			entry.Bloodied,
			entry.Condition,
			entry.ConditionTone,
			entry.Defeated,
			entry.IsCurrentTurn,
		)
	}

	return builder.String()
}

func publicDisplaySnapshotFingerprint(snapshot publicDisplaySnapshot) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "%s|%s|", snapshot.CampaignID, snapshot.CampaignTitle)
	if snapshot.Image == nil {
		builder.WriteString("empty")
		return builder.String()
	}

	fmt.Fprintf(
		&builder,
		"%s|%s|%t|%v|%s|%s|%s|%s|%d|%d|%t|%t|%v|%v|%v|%v|%f|%v|%v|%v|",
		snapshot.Image.URL,
		snapshot.Image.RoofURL,
		snapshot.Image.RoofVisionOnly,
		snapshot.Image.RoofZones,
		snapshot.Image.Title,
		snapshot.Image.Alt,
		snapshot.Image.Caption,
		snapshot.Image.MediaType,
		snapshot.Image.FogRows,
		snapshot.Image.FogColumns,
		snapshot.Image.ShowGrid,
		snapshot.Image.SessionMap,
		snapshot.Image.Revealed,
		snapshot.Image.FogRegions,
		snapshot.Image.Walls,
		snapshot.Image.Token,
		snapshot.Image.MapAspectRatio,
		snapshot.Image.Grid,
		snapshot.Image.Viewport,
		snapshot.Image.DeepZoom,
	)
	return builder.String()
}

func sanitizePublicDisplayImage(image publicDisplayImage) *publicDisplayImage {
	url := strings.TrimSpace(image.URL)
	if url == "" {
		return nil
	}
	mediaType := strings.ToLower(strings.TrimSpace(image.MediaType))
	if mediaType == "youtube" {
		videoID := youtubeVideoID(url)
		if videoID == "" {
			return nil
		}
		url = fmt.Sprintf("https://www.youtube-nocookie.com/embed/%s?autoplay=1&mute=1&loop=1&playlist=%s&controls=0&disablekb=1&fs=0&playsinline=1&rel=0", videoID, videoID)
	} else if mediaType == "video" {
		if !strings.HasSuffix(strings.ToLower(url), ".mp4") && !strings.HasSuffix(strings.ToLower(url), ".webm") {
			return nil
		}
	} else if mediaType == "tiles" {
		if image.DeepZoom == nil || image.DeepZoom.Width <= 0 || image.DeepZoom.Height <= 0 || image.DeepZoom.TileSize <= 0 || image.DeepZoom.MaxLevel <= 0 || strings.TrimSpace(image.DeepZoom.TileBaseURL) == "" {
			return nil
		}
	} else {
		mediaType = "image"
	}

	rows := max(0, min(image.FogRows, 24))
	columns := max(0, min(image.FogColumns, 24))
	if rows < 2 || columns < 2 {
		rows, columns = 0, 0
	}
	limit := rows * columns
	revealed := make([]int, 0, len(image.Revealed))
	seen := make(map[int]struct{}, len(image.Revealed))
	for _, index := range image.Revealed {
		if index < 0 || index >= limit {
			continue
		}
		if _, exists := seen[index]; exists {
			continue
		}
		seen[index] = struct{}{}
		revealed = append(revealed, index)
	}
	slices.Sort(revealed)
	regions := sanitizePublicFogRegions(image.FogRegions)
	roofZones := sanitizePublicRoofZones(image.RoofZones)
	walls := sanitizePublicDisplayWalls(image.Walls)
	token := sanitizePublicDisplayToken(image.Token)
	visionPolygon := sanitizePublicPolygon(image.VisionPolygon)
	fovPolygon := sanitizePublicPolygon(image.FOVPolygon)
	aspectRatio := max(0.2, min(image.MapAspectRatio, 5))
	if image.MapAspectRatio == 0 {
		aspectRatio = 1
	}
	grid := sanitizePublicDisplayGrid(image.Grid)
	viewport := sanitizePublicViewport(image.Viewport)

	return &publicDisplayImage{
		URL:            url,
		RoofURL:        strings.TrimSpace(image.RoofURL),
		RoofVisionOnly: image.RoofVisionOnly,
		RoofZones:      roofZones,
		Title:          strings.TrimSpace(image.Title),
		Alt:            strings.TrimSpace(image.Alt),
		Caption:        strings.TrimSpace(image.Caption),
		FogRows:        rows,
		FogColumns:     columns,
		Revealed:       revealed,
		ShowGrid:       image.ShowGrid,
		SessionMap:     image.SessionMap,
		MediaType:      mediaType,
		FogRegions:     regions,
		Walls:          walls,
		Token:          token,
		VisionPolygon:  visionPolygon,
		FOVPolygon:     fovPolygon,
		MapAspectRatio: aspectRatio,
		Grid:           grid,
		Viewport:       viewport,
		DeepZoom:       image.DeepZoom,
	}
}

func sanitizePublicViewport(viewport *publicViewport) *publicViewport {
	if viewport == nil {
		return &publicViewport{Zoom: 1}
	}
	zoom := max(1, min(viewport.Zoom, 6))
	limit := (zoom - 1) / 2
	return &publicViewport{Zoom: zoom, X: max(-limit, min(viewport.X, limit)), Y: max(-limit, min(viewport.Y, limit))}
}

func sanitizePublicDisplayGrid(grid *publicDisplayGrid) *publicDisplayGrid {
	if grid == nil || (grid.Type != "square" && grid.Type != "hex") {
		return nil
	}
	color := strings.ToLower(strings.TrimSpace(grid.Color))
	matched, _ := regexp.MatchString(`^#[0-9a-f]{6}$`, color)
	if !matched {
		color = "#ffffff"
	}
	return &publicDisplayGrid{Type: grid.Type, Size: max(.005, min(grid.Size, .2)), Color: color, Opacity: max(0, min(grid.Opacity, 1))}
}

func sanitizePublicDisplayWalls(walls []publicDisplayWall) []publicDisplayWall {
	result := make([]publicDisplayWall, 0, len(walls))
	for index, wall := range walls {
		id := strings.TrimSpace(wall.ID)
		if id == "" {
			id = fmt.Sprintf("wall-%d", index+1)
		}
		points := wall.Points
		if len(points) < 2 {
			points = []publicFogPoint{wall.Start, wall.End}
		}
		if len(points) > 512 {
			points = points[:512]
		}
		cleanPoints := make([]publicFogPoint, 0, len(points))
		for _, point := range points {
			point = publicFogPoint{X: max(0, min(point.X, 1)), Y: max(0, min(point.Y, 1))}
			if len(cleanPoints) == 0 || cleanPoints[len(cleanPoints)-1] != point {
				cleanPoints = append(cleanPoints, point)
			}
		}
		if len(cleanPoints) < 2 {
			continue
		}
		kind := strings.ToLower(strings.TrimSpace(wall.Kind))
		if kind != "door" {
			kind = "wall"
		}
		result = append(result, publicDisplayWall{ID: id, Kind: kind, Start: cleanPoints[0], End: cleanPoints[len(cleanPoints)-1], Points: cleanPoints, Disabled: wall.Disabled})
	}
	return result
}

func sanitizePublicDisplayToken(token *publicDisplayToken) *publicDisplayToken {
	if token == nil {
		return nil
	}
	return &publicDisplayToken{X: max(0, min(token.X, 1)), Y: max(0, min(token.Y, 1)), VisionRadius: max(0.03, min(token.VisionRadius, 1.5))}
}

func sanitizePublicFogRegions(regions []publicFogRegion) []publicFogRegion {
	if len(regions) > 128 {
		regions = regions[:128]
	}
	result := make([]publicFogRegion, 0, len(regions))
	for regionIndex, region := range regions {
		if len(region.Points) < 3 {
			continue
		}
		points := region.Points
		if len(points) > 256 {
			points = points[:256]
		}
		clean := make([]publicFogPoint, 0, len(points))
		for _, point := range points {
			clean = append(clean, publicFogPoint{X: max(0, min(point.X, 1)), Y: max(0, min(point.Y, 1))})
		}
		id := strings.TrimSpace(region.ID)
		if id == "" {
			id = fmt.Sprintf("region-%d", regionIndex+1)
		}
		result = append(result, publicFogRegion{ID: id, Points: clean, Revealed: region.Revealed})
	}
	return result
}

func sanitizePublicRoofZones(zones []publicRoofZone) []publicRoofZone {
	if len(zones) > 64 {
		zones = zones[:64]
	}
	result := make([]publicRoofZone, 0, len(zones))
	for index, zone := range zones {
		if len(zone.Points) < 3 {
			continue
		}
		points := zone.Points
		if len(points) > 256 {
			points = points[:256]
		}
		clean := make([]publicFogPoint, 0, len(points))
		for _, point := range points {
			clean = append(clean, publicFogPoint{X: max(0, min(point.X, 1)), Y: max(0, min(point.Y, 1))})
		}
		id := strings.TrimSpace(zone.ID)
		if id == "" {
			id = fmt.Sprintf("roof-%d", index+1)
		}
		openings := make([][]publicFogPoint, 0, len(zone.Openings))
		for _, opening := range zone.Openings {
			if len(opening) < 3 {
				continue
			}
			if len(opening) > 256 {
				opening = opening[:256]
			}
			cleanOpening := make([]publicFogPoint, 0, len(opening))
			for _, point := range opening {
				cleanOpening = append(cleanOpening, publicFogPoint{X: max(0, min(point.X, 1)), Y: max(0, min(point.Y, 1))})
			}
			openings = append(openings, cleanOpening)
		}
		result = append(result, publicRoofZone{ID: id, Points: clean, Openings: openings})
	}
	return result
}

// Geometry is calculated by the master renderer and sent normalized. Keeping
// this sanitizer generic lets the TV reuse exactly those coordinates.
func sanitizePublicPolygon(points []publicFogPoint) []publicFogPoint {
	if len(points) < 3 {
		return nil
	}
	if len(points) > 2048 {
		points = points[:2048]
	}
	result := make([]publicFogPoint, 0, len(points))
	for _, point := range points {
		result = append(result, publicFogPoint{X: max(0, min(point.X, 1)), Y: max(0, min(point.Y, 1))})
	}
	return result
}

func youtubeVideoID(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	host := strings.ToLower(strings.TrimPrefix(parsed.Hostname(), "www."))
	var id string
	switch host {
	case "youtu.be":
		id = strings.Trim(parsed.Path, "/")
	case "youtube.com", "m.youtube.com", "youtube-nocookie.com":
		if strings.HasPrefix(parsed.Path, "/embed/") {
			id = strings.TrimPrefix(parsed.Path, "/embed/")
		} else if strings.HasPrefix(parsed.Path, "/shorts/") {
			id = strings.TrimPrefix(parsed.Path, "/shorts/")
		} else {
			id = parsed.Query().Get("v")
		}
	}
	id = strings.Split(strings.Trim(id, "/"), "/")[0]
	if matched, _ := regexp.MatchString(`^[A-Za-z0-9_-]{11}$`, id); !matched {
		return ""
	}
	return id
}

func resolvePublicDisplayAssetURL(raw string, baseURL string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:") ||
		strings.HasPrefix(lower, "blob:") {
		return trimmed
	}

	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		return trimmed
	}

	if strings.HasPrefix(trimmed, "/") {
		return base + trimmed
	}

	return base + "/" + strings.TrimLeft(trimmed, "/")
}

func (manager *initiativeShareManager) resolvePublicBaseURLLocked(request *http.Request) (string, string, error) {
	if manager.configuredBase != "" {
		return manager.configuredBase, "public", nil
	}

	if requestBase := publicBaseURLFromRequest(request); requestBase != "" {
		return requestBase, "request", nil
	}

	return manager.ensurePublicTunnelLocked("http://127.0.0.1:8080")
}

func publicBaseURLFromRequest(request *http.Request) string {
	if request == nil {
		return ""
	}

	host := strings.TrimSpace(request.Host)
	if forwardedHost := strings.TrimSpace(request.Header.Get("X-Forwarded-Host")); forwardedHost != "" {
		host = strings.TrimSpace(strings.Split(forwardedHost, ",")[0])
	}
	if host == "" {
		return ""
	}

	proto := strings.TrimSpace(request.Header.Get("X-Forwarded-Proto"))
	if proto != "" {
		proto = strings.TrimSpace(strings.Split(proto, ",")[0])
	}
	if proto == "" {
		if request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}

	return fmt.Sprintf("%s://%s", proto, host)
}
func (manager *initiativeShareManager) ensurePublicServerLocked() (string, error) {
	if manager.publicOrigin != "" && manager.publicListener != nil {
		return manager.publicOrigin, nil
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", fmt.Errorf("не удалось поднять локальный viewer инициативы: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc(publicVictoryBloodOverlayPath, manager.handlePublicInitiativeBloodOverlay)
	mux.HandleFunc("/display/", manager.handlePublicDisplayPage)
	mux.HandleFunc("/api/display-meta/", manager.handlePublicDisplayMeta)
	mux.HandleFunc("/api/display/", manager.handlePublicDisplayAPI)
	mux.HandleFunc("/initiative/", manager.handlePublicInitiativePage)
	mux.HandleFunc("/api/initiative-meta/", manager.handlePublicInitiativeMeta)
	mux.HandleFunc("/api/initiative/", manager.handlePublicInitiativeAPI)

	server := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	manager.publicServer = server
	manager.publicListener = listener
	manager.publicOrigin = "http://" + listener.Addr().String()

	go func(current *http.Server, currentListener net.Listener) {
		if err := current.Serve(currentListener); err != nil && err != http.ErrServerClosed {
			log.Printf("initiative viewer server stopped: %v", err)
		}

		manager.mu.Lock()
		defer manager.mu.Unlock()
		if manager.publicServer == current {
			manager.publicServer = nil
			manager.publicListener = nil
			manager.publicOrigin = ""
		}
	}(server, listener)

	return manager.publicOrigin, nil
}

func (manager *initiativeShareManager) ensurePublicTunnelLocked(targetOrigin string) (string, string, error) {
	if manager.publicBaseURL != "" && manager.tunnelCmd != nil {
		return manager.publicBaseURL, manager.publicProvider, nil
	}

	targetURL, err := url.Parse(targetOrigin)
	if err != nil {
		return "", "", fmt.Errorf("failed to prepare initiative viewer URL: %w", err)
	}

	port := targetURL.Port()
	if port == "" {
		return "", "", fmt.Errorf("failed to resolve initiative viewer local port")
	}

	type tunnelStrategy struct {
		provider string
		command  string
		args     []string
	}

	strategies := make([]tunnelStrategy, 0, 5)
	for _, command := range preferredCloudflaredCommands() {
		strategies = append(strategies, tunnelStrategy{
			provider: "cloudflared",
			command:  command,
			args:     []string{"tunnel", "--url", targetOrigin, "--no-autoupdate"},
		})
	}
	strategies = append(
		strategies,
		tunnelStrategy{
			provider: "localtunnel",
			command:  "npx.cmd",
			args:     []string{"--yes", "localtunnel", "--port", port},
		},
		tunnelStrategy{
			provider: "localtunnel",
			command:  "npx",
			args:     []string{"--yes", "localtunnel", "--port", port},
		},
	)

	var attempts []string
	for _, strategy := range strategies {
		baseURL, cmd, err := startInitiativeTunnel(strategy.command, strategy.args)
		if err != nil {
			attempts = append(attempts, fmt.Sprintf("%s: %v", strategy.command, err))
			continue
		}

		manager.publicBaseURL = baseURL
		manager.publicProvider = strategy.provider
		manager.tunnelCmd = cmd
		go manager.watchTunnel(cmd)
		return manager.publicBaseURL, manager.publicProvider, nil
	}

	return "", "", fmt.Errorf(
		"failed to start a public initiative tracker link. Make sure cloudflared or npx is available: %s",
		strings.Join(attempts, "; "),
	)
}

func (manager *initiativeShareManager) watchTunnel(cmd *exec.Cmd) {
	err := cmd.Wait()
	if err != nil {
		log.Printf("initiative tunnel stopped: %v", err)
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()
	if manager.tunnelCmd == cmd {
		manager.tunnelCmd = nil
		manager.publicBaseURL = ""
		manager.publicProvider = ""
	}
}

func startInitiativeTunnel(command string, args []string) (string, *exec.Cmd, error) {
	cmd := exec.Command(command, args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", nil, err
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", nil, err
	}

	if err := cmd.Start(); err != nil {
		return "", nil, err
	}

	lines := make(chan string, 32)
	go streamTunnelLogs(stdout, lines)
	go streamTunnelLogs(stderr, lines)

	timeout := time.NewTimer(45 * time.Second)
	defer timeout.Stop()

	var history []string
	for {
		select {
		case line := <-lines:
			if line == "" {
				continue
			}

			if len(history) < 12 {
				history = append(history, line)
			}

			if publicURL := extractTunnelURL(line); publicURL != "" {
				readyURL, readyErr := waitForPublicTunnelReady(strings.TrimRight(publicURL, "/"))
				if readyErr != nil {
					_ = cmd.Process.Kill()
					_ = cmd.Wait()
					return "", nil, fmt.Errorf("%s reported %s, but it never became reachable: %w", command, publicURL, readyErr)
				}
				return readyURL, cmd, nil
			}
		case <-timeout.C:
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			return "", nil, fmt.Errorf("timeout while waiting for a public address (%s)", strings.Join(history, " | "))
		}
	}
}

func waitForPublicTunnelReady(baseURL string) (string, error) {
	client := &http.Client{Timeout: 4 * time.Second}
	healthURL := strings.TrimRight(baseURL, "/") + "/healthz"
	deadline := time.Now().Add(25 * time.Second)
	var lastErr error

	for time.Now().Before(deadline) {
		response, err := client.Get(healthURL)
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode >= 200 && response.StatusCode < 300 {
				return strings.TrimRight(baseURL, "/"), nil
			}
			lastErr = fmt.Errorf("health check returned %s", response.Status)
		} else {
			lastErr = err
		}

		time.Sleep(1200 * time.Millisecond)
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("health check did not succeed in time")
	}
	return "", lastErr
}
func preferredCloudflaredCommands() []string {
	seen := map[string]struct{}{}
	commands := make([]string, 0, 3)

	appendUnique := func(command string) {
		command = strings.TrimSpace(command)
		if command == "" {
			return
		}
		if _, ok := seen[command]; ok {
			return
		}
		seen[command] = struct{}{}
		commands = append(commands, command)
	}

	if downloaded, err := ensureBundledCloudflared(); err == nil {
		appendUnique(downloaded)
	}

	appendUnique("cloudflared")
	appendUnique("cloudflared.exe")
	return commands
}

func ensureBundledCloudflared() (string, error) {
	downloadURL, fileName, err := cloudflaredDownloadTarget()
	if err != nil {
		return "", err
	}

	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}

	binDir := filepath.Join(cacheDir, "shadow-edge-gm", "bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		return "", err
	}

	binaryPath := filepath.Join(binDir, fileName)
	if info, err := os.Stat(binaryPath); err == nil && info.Size() > 0 {
		return binaryPath, nil
	}

	tempPath := binaryPath + ".download"
	client := &http.Client{Timeout: 2 * time.Minute}
	response, err := client.Get(downloadURL)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("cloudflared download failed with status %s", response.Status)
	}

	file, err := os.Create(tempPath)
	if err != nil {
		return "", err
	}

	_, copyErr := io.Copy(file, response.Body)
	closeErr := file.Close()
	if copyErr != nil {
		_ = os.Remove(tempPath)
		return "", copyErr
	}
	if closeErr != nil {
		_ = os.Remove(tempPath)
		return "", closeErr
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(tempPath, 0o755); err != nil {
			_ = os.Remove(tempPath)
			return "", err
		}
	}

	if err := os.Rename(tempPath, binaryPath); err != nil {
		_ = os.Remove(tempPath)
		return "", err
	}

	return binaryPath, nil
}

func cloudflaredDownloadTarget() (string, string, error) {
	switch runtime.GOOS {
	case "windows":
		switch runtime.GOARCH {
		case "amd64":
			return "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe", "cloudflared-windows-amd64.exe", nil
		case "arm64":
			return "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-arm64.exe", "cloudflared-windows-arm64.exe", nil
		}
	case "linux":
		switch runtime.GOARCH {
		case "amd64":
			return "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64", "cloudflared-linux-amd64", nil
		case "arm64":
			return "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64", "cloudflared-linux-arm64", nil
		}
	case "darwin":
		switch runtime.GOARCH {
		case "amd64":
			return "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz", "", fmt.Errorf("automatic cloudflared bootstrap is not configured for darwin-amd64")
		case "arm64":
			return "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz", "", fmt.Errorf("automatic cloudflared bootstrap is not configured for darwin-arm64")
		}
	}

	return "", "", fmt.Errorf("automatic cloudflared bootstrap is not supported for %s/%s", runtime.GOOS, runtime.GOARCH)
}

func streamTunnelLogs(reader io.Reader, lines chan<- string) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			lines <- line
		}
	}
}

func extractTunnelURL(line string) string {
	return strings.TrimRight(tunnelURLPattern.FindString(line), "/.,);")
}

func (manager *initiativeShareManager) handlePublicInitiativePage(writer http.ResponseWriter, request *http.Request) {
	token := initiativeTokenFromPath(request.URL.Path, "/initiative/")
	if token == "" {
		http.NotFound(writer, request)
		return
	}

	snapshot, err := manager.snapshotForToken(token)
	if err != nil {
		http.NotFound(writer, request)
		return
	}

	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := initiativeViewerTemplate.Execute(writer, initiativeViewerPageData{
		Token:         token,
		CampaignTitle: snapshot.CampaignTitle,
	}); err != nil {
		http.Error(writer, "initiative viewer render failed", http.StatusInternalServerError)
	}
}

func (manager *initiativeShareManager) handlePublicDisplayPage(writer http.ResponseWriter, request *http.Request) {
	token := initiativeTokenFromPath(request.URL.Path, "/display/")
	if token == "" {
		http.NotFound(writer, request)
		return
	}

	snapshot, err := manager.snapshotForToken(token)
	if err != nil {
		http.NotFound(writer, request)
		return
	}

	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := initiativeViewerTemplate.Execute(writer, initiativeViewerPageData{
		Token:         token,
		CampaignTitle: snapshot.CampaignTitle,
	}); err != nil {
		http.Error(writer, "player display render failed", http.StatusInternalServerError)
	}
}

func (manager *initiativeShareManager) handlePublicInitiativeBloodOverlay(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writer.Header().Set("Content-Type", "image/png")
	writer.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	if request.Method == http.MethodHead {
		return
	}
	_, _ = writer.Write(publicVictoryBloodOverlayPNG)
}

func (manager *initiativeShareManager) handlePublicInitiativeAPI(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	token := initiativeTokenFromPath(request.URL.Path, "/api/initiative/")
	if token == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Initiative share not found")
		return
	}

	snapshot, err := manager.snapshotForToken(token)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, snapshot)
}

func (manager *initiativeShareManager) handlePublicInitiativeMeta(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	token := initiativeTokenFromPath(request.URL.Path, "/api/initiative-meta/")
	if token == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Initiative share not found")
		return
	}

	snapshot, err := manager.snapshotForToken(token)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, publicInitiativeMeta{
		CampaignID: snapshot.CampaignID,
		Mode:       snapshot.Mode,
		Version:    snapshot.Version,
		UpdatedAt:  snapshot.UpdatedAt,
		HasImage:   snapshot.Image != nil,
	})
}

func (manager *initiativeShareManager) handlePublicDisplayAPI(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	token := initiativeTokenFromPath(request.URL.Path, "/api/display/")
	if token == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Player display not found")
		return
	}

	snapshot, err := manager.snapshotForToken(token)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, snapshot)
}

func (manager *initiativeShareManager) handlePublicDisplayMeta(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	token := initiativeTokenFromPath(request.URL.Path, "/api/display-meta/")
	if token == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Player display not found")
		return
	}

	snapshot, err := manager.snapshotForToken(token)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, publicDisplayMeta{
		CampaignID: snapshot.CampaignID,
		Mode:       snapshot.Mode,
		Version:    snapshot.Version,
		UpdatedAt:  snapshot.UpdatedAt,
		HasImage:   snapshot.Image != nil,
	})
}

func (manager *initiativeShareManager) snapshotForToken(token string) (publicInitiativeSnapshot, error) {
	manager.mu.RLock()
	campaignID := manager.tokenToCampaign[token]
	manager.mu.RUnlock()
	if campaignID == "" {
		return publicInitiativeSnapshot{}, fmt.Errorf("initiative share %q not found", token)
	}

	campaign, err := manager.store.getCampaign(campaignID)
	if err != nil {
		return publicInitiativeSnapshot{}, err
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()
	return manager.currentSnapshotLocked(campaign), nil
}

func (manager *initiativeShareManager) displaySnapshotForToken(token string) (publicDisplaySnapshot, error) {
	manager.mu.RLock()
	campaignID := manager.tokenToCampaign[token]
	manager.mu.RUnlock()
	if campaignID == "" {
		return publicDisplaySnapshot{}, fmt.Errorf("player display %q not found", token)
	}

	campaign, err := manager.store.getCampaign(campaignID)
	if err != nil {
		return publicDisplaySnapshot{}, err
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()
	return manager.currentDisplaySnapshotLocked(campaign, nil), nil
}

func buildPublicInitiativeSnapshot(campaign campaignData) publicInitiativeSnapshot {
	snapshot := publicInitiativeSnapshot{
		CampaignID:    campaign.ID,
		CampaignTitle: campaign.Title,
	}

	if campaign.ActiveCombat == nil {
		if campaign.LastCombatSummary != nil {
			snapshot.Result = &publicInitiativeResult{
				CombatID:            campaign.LastCombatSummary.CombatID,
				Title:               campaign.LastCombatSummary.Title,
				Outcome:             campaign.LastCombatSummary.Outcome,
				DefeatedCount:       campaign.LastCombatSummary.DefeatedCount,
				TotalExperience:     campaign.LastCombatSummary.TotalExperience,
				ExperiencePerPlayer: campaign.LastCombatSummary.ExperiencePerPlayer,
				Round:               campaign.LastCombatSummary.Round,
				Entries:             buildPublicInitiativeEntries(campaign, campaign.LastCombatSummary.Entries, "", true),
				PlayerRewards:       buildPublicInitiativeRewards(campaign.LastCombatSummary.PlayerRewards),
				FinishedAt:          campaign.LastCombatSummary.FinishedAt,
			}
		}
		snapshot.Mode = publicInitiativeSnapshotMode(snapshot)
		return snapshot
	}

	if combatShouldShowVictory(campaign.ActiveCombat) {
		playerRewards := make([]combatRewardShare, 0)
		for _, entry := range campaign.ActiveCombat.Entries {
			if combatEntrySide(entry) != "player" || entry.EntityKind != "player" {
				continue
			}
			playerRewards = append(playerRewards, combatRewardShare{
				Title:      strings.TrimSpace(entry.Title),
				Experience: publicCombatVictoryExperiencePerPlayer(campaign.ActiveCombat),
			})
		}

		snapshot.Result = &publicInitiativeResult{
			CombatID:            campaign.ActiveCombat.ID,
			Title:               campaign.ActiveCombat.Title,
			Outcome:             "victory",
			DefeatedCount:       countPublicDefeatedEnemies(campaign.ActiveCombat.Entries),
			TotalExperience:     publicCombatVictoryTotalExperience(campaign.ActiveCombat),
			ExperiencePerPlayer: publicCombatVictoryExperiencePerPlayer(campaign.ActiveCombat),
			Round:               campaign.ActiveCombat.Round,
			Entries:             buildPublicInitiativeEntries(campaign, campaign.ActiveCombat.Entries, campaign.ActiveCombat.CurrentTurnEntryID, true),
			PlayerRewards:       buildPublicInitiativeRewards(playerRewards),
		}
		snapshot.Mode = publicInitiativeSnapshotMode(snapshot)
		return snapshot
	}

	snapshot.Combat = &publicInitiativeCombat{
		ID:                 campaign.ActiveCombat.ID,
		Title:              campaign.ActiveCombat.Title,
		Round:              campaign.ActiveCombat.Round,
		PartySize:          campaign.ActiveCombat.PartySize,
		Difficulty:         campaign.ActiveCombat.Difficulty,
		CurrentTurnEntryID: campaign.ActiveCombat.CurrentTurnEntryID,
		Entries:            buildPublicInitiativeEntries(campaign, campaign.ActiveCombat.Entries, campaign.ActiveCombat.CurrentTurnEntryID, false),
	}

	snapshot.Mode = publicInitiativeSnapshotMode(snapshot)
	return snapshot
}

func buildPublicInitiativeEntries(campaign campaignData, source []combatEntry, currentTurnEntryID string, revealResolutionMeta bool) []publicInitiativeEntry {
	ordered := orderedInitiativeEntriesForPublic(source)
	entries := make([]publicInitiativeEntry, 0, len(ordered))
	for _, entry := range ordered {
		armorClass := strings.TrimSpace(entry.ArmorClass)
		if armorClass == "" {
			armorClass = "-"
		}
		imageURL, imageAlt := publicInitiativeVisual(campaign, entry)
		conditionLabel, conditionTone := publicCombatCondition(entry)

		entries = append(entries, publicInitiativeEntry{
			ID:            entry.ID,
			EntityID:      entry.EntityID,
			EntityKind:    entry.EntityKind,
			Side:          combatEntrySide(entry),
			Title:         entry.Title,
			Summary:       entry.Summary,
			Role:          entry.Role,
			ImageURL:      imageURL,
			ImageAlt:      imageAlt,
			ArmorClass:    armorClass,
			Initiative:    entry.Initiative,
			Challenge:     revealPublicInitiativeChallenge(entry, revealResolutionMeta),
			Experience:    revealPublicInitiativeExperience(entry, revealResolutionMeta),
			Bloodied:      publicInitiativeEntryIsBloodied(entry),
			Condition:     conditionLabel,
			ConditionTone: conditionTone,
			Defeated:      entry.Defeated || entry.CurrentHitPoints <= 0,
			IsCurrentTurn: currentTurnEntryID != "" && entry.ID == currentTurnEntryID,
		})
	}
	return entries
}

func revealPublicInitiativeChallenge(_ combatEntry, _ bool) string {
	return ""
}

func revealPublicInitiativeExperience(entry combatEntry, revealResolutionMeta bool) int {
	if combatEntrySide(entry) == "enemy" && revealResolutionMeta && (entry.Defeated || entry.CurrentHitPoints <= 0) {
		return entry.Experience
	}
	return 0
}

func publicInitiativeEntryIsBloodied(entry combatEntry) bool {
	return combatEntrySide(entry) == "enemy" && entry.MaxHitPoints > 0 && entry.CurrentHitPoints*2 < entry.MaxHitPoints
}

func buildPublicInitiativeRewards(source []combatRewardShare) []publicInitiativeReward {
	if len(source) == 0 {
		return []publicInitiativeReward{}
	}
	items := make([]publicInitiativeReward, 0, len(source))
	for _, item := range source {
		items = append(items, publicInitiativeReward{
			Title:      item.Title,
			Experience: item.Experience,
		})
	}
	return items
}

func combatShouldShowVictory(combat *activeCombat) bool {
	if combat == nil {
		return false
	}
	enemyCount := 0
	for _, entry := range combat.Entries {
		if combatEntrySide(entry) != "enemy" {
			continue
		}
		enemyCount++
		if !entry.Defeated && entry.CurrentHitPoints > 0 {
			return false
		}
	}
	return enemyCount > 0
}

func publicCombatVictoryTotalExperience(combat *activeCombat) int {
	if combat == nil {
		return 0
	}
	total := 0
	for _, entry := range combat.Entries {
		if combatEntrySide(entry) == "enemy" && (entry.Defeated || entry.CurrentHitPoints <= 0) {
			total += entry.Experience
		}
	}
	return total
}

func publicCombatVictoryExperiencePerPlayer(combat *activeCombat) int {
	if combat == nil {
		return 0
	}
	playerCount := combatRewardParticipantCount(combat.Entries)
	if playerCount <= 0 {
		return 0
	}
	return publicCombatVictoryTotalExperience(combat) / playerCount
}

func countPublicDefeatedEnemies(entries []combatEntry) int {
	total := 0
	for _, entry := range entries {
		if combatEntrySide(entry) == "enemy" && (entry.Defeated || entry.CurrentHitPoints <= 0) {
			total++
		}
	}
	return total
}

func publicInitiativeVisual(campaign campaignData, entry combatEntry) (string, string) {
	alt := strings.TrimSpace(entry.Title)
	if alt == "" {
		alt = "Combatant"
	}

	if linked, ok := findKnowledgeEntity(campaign, entry.EntityID); ok {
		if linked.Art != nil && strings.TrimSpace(linked.Art.URL) != "" {
			return strings.TrimSpace(linked.Art.URL), firstNonEmpty(strings.TrimSpace(linked.Art.Alt), alt)
		}
		if linked.Kind != "" {
			return publicPortraitDataURI(linked.Kind, firstNonEmpty(linked.Title, alt)), firstNonEmpty(strings.TrimSpace(linked.Art.Alt), alt)
		}
	}

	return publicPortraitDataURI(firstNonEmpty(entry.EntityKind, "npc"), alt), alt
}

func publicCombatConditionLegacy(entry combatEntry) (string, string) {
	if entry.Defeated || entry.CurrentHitPoints <= 0 {
		return "Выведен", "defeated"
	}
	if entry.MaxHitPoints <= 0 {
		return "", ""
	}

	ratio := float64(entry.CurrentHitPoints) / float64(entry.MaxHitPoints)
	switch {
	case ratio <= 0.10:
		return "На грани", "critical"
	case ratio < 0.50:
		return "Окровавлен", "bloodied"
	default:
		return "", ""
	}
}

func publicCombatCondition(entry combatEntry) (string, string) {
	if entry.Defeated || entry.CurrentHitPoints <= 0 {
		return "Выведен", "defeated"
	}
	if entry.MaxHitPoints <= 0 {
		return "", ""
	}

	ratio := float64(entry.CurrentHitPoints) / float64(entry.MaxHitPoints)
	switch {
	case ratio <= 0.10:
		return "На грани", "critical"
	case ratio < 0.50:
		return "Окровавлен", "bloodied"
	default:
		return "", ""
	}
}

func publicPortraitDataURI(kind string, title string) string {
	initials := publicPortraitInitials(title, kind)
	safeTitle := html.EscapeString(firstNonEmpty(strings.TrimSpace(title), "Combatant"))

	accentA := "#7ed6a1"
	accentB := "#1e3d32"
	label := "NPC DOSSIER"
	switch strings.TrimSpace(strings.ToLower(kind)) {
	case "monster":
		accentA = "#e57c62"
		accentB = "#4d1914"
		label = "MONSTER DOSSIER"
	case "player":
		accentA = "#6dddcf"
		accentB = "#164f63"
		label = "PLAYER DOSSIER"
	}

	svg := fmt.Sprintf(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%%" stop-color="%s"/>
      <stop offset="100%%" stop-color="%s"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%%" cy="30%%" r="60%%">
      <stop offset="0%%" stop-color="rgba(255,255,255,0.2)"/>
      <stop offset="100%%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="720" height="900" rx="42" fill="url(#bg)"/>
  <rect width="720" height="900" rx="42" fill="url(#glow)"/>
  <circle cx="360" cy="310" r="146" fill="rgba(7, 14, 20, 0.18)"/>
  <path d="M233 620c34-112 107-169 127-182 20-13 40-13 40-13s20 0 40 13c20 13 93 70 127 182" fill="rgba(7, 14, 20, 0.22)"/>
  <text x="64" y="98" fill="rgba(255,255,255,0.92)" font-family="Segoe UI, Arial, sans-serif" font-size="40" letter-spacing="7">%s</text>
  <text x="64" y="792" fill="rgba(255,255,255,0.96)" font-family="Georgia, serif" font-size="52" font-weight="700">%s</text>
  <text x="64" y="852" fill="rgba(255,255,255,0.72)" font-family="Segoe UI, Arial, sans-serif" font-size="28">Autoportrait for initiative tracker</text>
  <text x="360" y="352" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-family="Georgia, serif" font-size="126" font-weight="700">%s</text>
</svg>`, accentA, accentB, label, safeTitle, initials)

	return "data:image/svg+xml;charset=UTF-8," + url.QueryEscape(svg)
}

func publicPortraitInitials(title string, kind string) string {
	parts := strings.Fields(strings.TrimSpace(title))
	if len(parts) == 0 {
		switch strings.TrimSpace(strings.ToLower(kind)) {
		case "monster":
			return "MN"
		case "player":
			return "PL"
		default:
			return "NPC"
		}
	}

	initials := make([]string, 0, 2)
	for _, part := range parts {
		runes := []rune(part)
		if len(runes) == 0 {
			continue
		}
		initials = append(initials, strings.ToUpper(string(runes[0])))
		if len(initials) == 2 {
			break
		}
	}
	if len(initials) == 0 {
		return "GM"
	}
	return strings.Join(initials, "")
}

func orderedInitiativeEntriesForPublic(entries []combatEntry) []combatEntry {
	activeEntries := initiativeOrderedCombatEntries(entries, false)
	defeatedEntries := make([]combatEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.Defeated || entry.CurrentHitPoints <= 0 {
			defeatedEntries = append(defeatedEntries, entry)
		}
	}
	defeatedEntries = initiativeOrderedCombatEntries(defeatedEntries, true)
	return append(activeEntries, defeatedEntries...)
}

func initiativeTokenFromPath(path string, prefix string) string {
	token := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if token == "" || strings.Contains(token, "/") {
		return ""
	}
	return token
}

func newInitiativeShareToken() string {
	buffer := make([]byte, 12)
	if _, err := rand.Read(buffer); err != nil {
		return strings.TrimPrefix(newID("initiative"), "initiative-")
	}
	return hex.EncodeToString(buffer)
}
