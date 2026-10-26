// Package videoprep runs only beside Foundry, never inside the website server.
package videoprep

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Source struct {
	URL      string `json:"url"`
	Start    int    `json:"startSeconds"`
	Duration int    `json:"durationSeconds"`
	Height   int    `json:"maxHeight"`
}

func (s Source) Normalize() (Source, error) {
	u, e := url.Parse(s.URL)
	if e != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" {
		return s, errors.New("Нужна HTTPS-ссылка YouTube")
	}
	var id string
	switch strings.ToLower(u.Hostname()) {
	case "youtu.be":
		id = strings.TrimPrefix(u.Path, "/")
	case "youtube.com", "www.youtube.com", "m.youtube.com":
		if u.Path == "/watch" {
			id = u.Query().Get("v")
		} else {
			parts := strings.Split(strings.Trim(u.Path, "/"), "/")
			if len(parts) == 2 && (parts[0] == "shorts" || parts[0] == "embed") {
				id = parts[1]
			}
		}
	}
	if !regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`).MatchString(id) {
		return s, errors.New("Нужна ссылка на одно видео YouTube, без плейлиста")
	}
	if s.Start < 0 || s.Start > 86400 || s.Duration < 1 || s.Duration > 600 {
		return s, errors.New("Фрагмент: 1–600 секунд, начало: 0–86400")
	}
	if s.Height != 720 && s.Height != 1080 && s.Height != 1440 {
		return s, errors.New("Качество: 720, 1080 или 1440")
	}
	s.URL = "https://www.youtube.com/watch?v=" + id
	return s, nil
}
func Key(s Source) string {
	b, _ := json.Marshal(s)
	h := sha256.Sum256(append([]byte("v1:"), b...))
	return hex.EncodeToString(h[:16])
}

type Result struct {
	Path       string  `json:"path"`
	PreviewURL string  `json:"previewUrl"`
	PosterURL  string  `json:"posterUrl"`
	Width      int     `json:"width"`
	Height     int     `json:"height"`
	Duration   float64 `json:"duration"`
}
type Job struct {
	ID     string  `json:"id"`
	State  string  `json:"state"`
	Stage  string  `json:"stage"`
	Error  string  `json:"error,omitempty"`
	Result *Result `json:"result,omitempty"`
}
type Helper struct {
	Root, FoundryURL, Token, YTDLP, FFmpeg, FFprobe string
	Origins                                         map[string]bool
	mu                                              sync.Mutex
	jobs                                            map[string]Job
	running                                         bool
	// Run is replaceable in offline tests; production always uses exec.CommandContext.
	Run func(context.Context, string, ...string) ([]byte, error)
}

func (h *Helper) run(ctx context.Context, bin string, args ...string) ([]byte, error) {
	if h.Run != nil {
		return h.Run(ctx, bin, args...)
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Env = append(os.Environ(), "YTDLP_NO_PLUGINS=1")
	return cmd.Output()
}
func (h *Helper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Vary", "Origin")
	origin := r.Header.Get("Origin")
	if origin != "" && !h.Origins[origin] {
		http.Error(w, "Origin запрещён", 403)
		return
	}
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
	}
	if r.Method == "OPTIONS" {
		w.WriteHeader(204)
		return
	}
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if len(h.Token) < 24 || subtle.ConstantTimeCompare([]byte(token), []byte(h.Token)) != 1 {
		http.Error(w, "Неверный ключ помощника", 401)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" && r.URL.Path == "/health" {
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
		return
	}
	if r.Method == "POST" && r.URL.Path == "/jobs" {
		var source Source
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		dec.DisallowUnknownFields()
		if dec.Decode(&source) != nil {
			http.Error(w, "Некорректный запрос", 400)
			return
		}
		s, err := source.Normalize()
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		id := Key(s)
		h.mu.Lock()
		if h.jobs == nil {
			h.jobs = map[string]Job{}
		}
		old, exists := h.jobs[id]
		if exists && (old.State == "ready" || old.State == "working") {
			h.mu.Unlock()
			json.NewEncoder(w).Encode(old)
			return
		}
		if h.running {
			h.mu.Unlock()
			http.Error(w, "Уже готовится видео. Дождитесь завершения.", 409)
			return
		}
		j := Job{ID: id, State: "working", Stage: "Подготовка фрагмента"}
		h.jobs[id] = j
		h.running = true
		h.mu.Unlock()
		go func() {
			result, e := h.prepare(s, id)
			h.mu.Lock()
			defer h.mu.Unlock()
			j := h.jobs[id]
			h.running = false
			if e != nil {
				j.State = "failed"
				j.Error = e.Error()
			} else {
				j.State = "ready"
				j.Result = result
				j.Stage = "Фон готов"
			}
			h.jobs[id] = j
		}()
		w.WriteHeader(202)
		json.NewEncoder(w).Encode(j)
		return
	}
	if r.Method == "GET" && strings.HasPrefix(r.URL.Path, "/jobs/") {
		h.mu.Lock()
		j, ok := h.jobs[strings.TrimPrefix(r.URL.Path, "/jobs/")]
		h.mu.Unlock()
		if !ok {
			http.NotFound(w, r)
			return
		}
		json.NewEncoder(w).Encode(j)
		return
	}
	http.NotFound(w, r)
}
func (h *Helper) prepare(s Source, id string) (*Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Minute)
	defer cancel()
	dir := filepath.Join(h.Root, "shadow-edge-gm", "video-cache")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, errors.New("Не удалось создать папку видео в Foundry Data")
	}
	target := filepath.Join(dir, id+".mp4")
	poster := filepath.Join(dir, id+".jpg")
	manifest := filepath.Join(dir, id+".json")
	if raw, e := os.ReadFile(manifest); e == nil {
		var result Result
		if json.Unmarshal(raw, &result) == nil && result.Width > 0 {
			if a, e := os.Stat(target); e == nil && a.Size() > 0 {
				if _, e = os.Stat(poster); e == nil {
					result.PreviewURL = h.FoundryURL + "/" + result.Path
					result.PosterURL = h.FoundryURL + "/shadow-edge-gm/video-cache/" + id + ".jpg"
					return &result, nil
				}
			}
		}
	}
	entries, _ := os.ReadDir(dir)
	var total int64
	for _, entry := range entries {
		if info, e := entry.Info(); e == nil {
			total += info.Size()
		}
	}
	if total > 8*1024*1024*1024 {
		return nil, errors.New("Кеш видео превысил 8 ГБ. Освободите место в shadow-edge-gm/video-cache в Foundry Data.")
	}
	source := filepath.Join(dir, id+"-source.mkv")
	pending := filepath.Join(dir, id+"-pending.mp4")
	defer os.Remove(source)
	defer os.Remove(pending)
	_, err := h.run(ctx, h.YTDLP, "--ignore-config", "--no-playlist", "--no-progress", "--no-part", "--no-cache-dir", "--js-runtimes", "node", "--use-extractors", "youtube", "--socket-timeout", "30", "--retries", "2", "--fragment-retries", "2", "--max-filesize", "512M", "--ffmpeg-location", filepath.Dir(h.FFmpeg), "--download-sections", fmt.Sprintf("*%d-%d", s.Start, s.Start+s.Duration), "-f", fmt.Sprintf("bestvideo[height<=%d]/best[height<=%d]", s.Height, s.Height), "--remux-video", "mkv", "-o", source, "--", s.URL)
	if err != nil {
		return nil, errors.New("Не удалось получить фрагмент YouTube. Проверьте доступность ролика и обновите yt-dlp. Авторизация и cookies автоматически не используются.")
	}
	_, err = h.run(ctx, h.FFmpeg, "-nostdin", "-y", "-protocol_whitelist", "file,pipe", "-i", source, "-t", strconv.Itoa(s.Duration), "-map", "0:v:0", "-an", "-vf", fmt.Sprintf("scale=-2:'min(ih,%d)',fps=30", s.Height), "-c:v", "libx264", "-preset", "veryfast", "-threads", "2", "-filter_threads", "2", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", pending)
	if err != nil {
		return nil, errors.New("FFmpeg не смог подготовить совместимый MP4")
	}
	raw, err := h.run(ctx, h.FFprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", pending)
	if err != nil {
		return nil, errors.New("Не удалось проверить готовый фрагмент")
	}
	var meta struct {
		Streams []struct {
			Width  int `json:"width"`
			Height int `json:"height"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if json.Unmarshal(raw, &meta) != nil || len(meta.Streams) != 1 || meta.Streams[0].Width < 1 {
		return nil, errors.New("Некорректное видео")
	}
	duration, _ := strconv.ParseFloat(meta.Format.Duration, 64)
	if duration <= 0 || duration > float64(s.Duration)+2 {
		return nil, errors.New("Продолжительность фрагмента не прошла проверку")
	}
	_, err = h.run(ctx, h.FFmpeg, "-nostdin", "-y", "-protocol_whitelist", "file,pipe", "-i", pending, "-frames:v", "1", "-vf", "scale=1280:-2", poster)
	if err != nil {
		return nil, errors.New("Не удалось создать первый кадр")
	}
	if err = os.Rename(pending, target); err != nil {
		return nil, errors.New("Не удалось сохранить видео в Foundry Data")
	}
	result := &Result{Path: "shadow-edge-gm/video-cache/" + id + ".mp4", PreviewURL: h.FoundryURL + "/shadow-edge-gm/video-cache/" + id + ".mp4", PosterURL: h.FoundryURL + "/shadow-edge-gm/video-cache/" + id + ".jpg", Width: meta.Streams[0].Width, Height: meta.Streams[0].Height, Duration: duration}
	data, _ := json.Marshal(result)
	if err = os.WriteFile(manifest, data, 0600); err != nil {
		return nil, errors.New("Не удалось сохранить описание кеша")
	}
	return result, nil
}
