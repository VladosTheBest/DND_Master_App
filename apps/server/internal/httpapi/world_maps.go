package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const worldMapMaxBytes = 20 << 20

type worldMapLabel struct {
	Role     string  `json:"role,omitempty"`
	Curve    float64 `json:"curve,omitempty"`
	Span     float64 `json:"span,omitempty"`
	ID       string  `json:"id"`
	Text     string  `json:"text"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Size     float64 `json:"size"`
	Rotation float64 `json:"rotation"`
	Font     string  `json:"font"`
	Color    string  `json:"color"`
	Outline  string  `json:"outline"`
	Bold     bool    `json:"bold"`
	Italic   bool    `json:"italic"`
}
type worldMapDocument struct {
	SourceMapID    string           `json:"sourceMapId,omitempty"`
	SourceRevision int              `json:"sourceRevision,omitempty"`
	Scale          string           `json:"scale,omitempty"`
	Context        *worldMapContext `json:"context,omitempty"`
	ID             string           `json:"id"`
	Title          string           `json:"title"`
	Prompt         string           `json:"prompt"`
	ImageURL       string           `json:"imageUrl"`
	ReferenceURL   string           `json:"referenceUrl,omitempty"`
	Labels         []worldMapLabel  `json:"labels"`
	Width          int              `json:"width"`
	Height         int              `json:"height"`
	Revision       int              `json:"revision"`
	Provider       string           `json:"provider"`
	CreatedAt      time.Time        `json:"createdAt"`
}
type worldMapGenerateInput struct {
	SourceMapID    string           `json:"sourceMapId,omitempty"`
	SourceRevision int              `json:"sourceRevision,omitempty"`
	Scale          string           `json:"scale,omitempty"`
	Context        *worldMapContext `json:"context,omitempty"`
	RequestID      string           `json:"requestId"`
	Prompt         string           `json:"prompt"`
	ReferenceURL   string           `json:"referenceUrl"`
}

type worldMapContext struct {
	IncludeCampaign bool   `json:"includeCampaign"`
	LocationID      string `json:"locationId,omitempty"`
}

func normalizedMapContext(c *worldMapContext) worldMapContext {
	if c == nil {
		return worldMapContext{IncludeCampaign: true}
	}
	return *c
}

var mapColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
var mapRequestID = regexp.MustCompile(`^[a-zA-Z0-9_-]{16,64}$`)

func normalizedMapScale(s string) string {
	if s == "" {
		return "auto"
	}
	return s
}
func validMapScale(s string) bool {
	switch normalizedMapScale(s) {
	case "auto", "world", "region", "island", "city", "site":
		return true
	}
	return false
}
func validMapLabelRole(s string) bool {
	switch s {
	case "", "major", "region", "settlement", "site":
		return true
	}
	return false
}

func validateMapLabels(labels []worldMapLabel) error {
	if len(labels) > 100 {
		return fmt.Errorf("Не более 100 подписей на карту.")
	}
	seen := map[string]bool{}
	for _, l := range labels {
		if l.ID == "" || len(l.ID) > 80 || seen[l.ID] || strings.TrimSpace(l.Text) == "" || len([]rune(l.Text)) > 160 || strings.ContainsAny(l.Text, "\r\n") {
			return fmt.Errorf("Проверь текст подписей.")
		}
		seen[l.ID] = true
		for _, v := range []float64{l.X, l.Y, l.Size, l.Rotation, l.Curve, l.Span} {
			if math.IsNaN(v) || math.IsInf(v, 0) {
				return fmt.Errorf("Некорректные координаты.")
			}
		}
		if !validMapLabelRole(l.Role) || l.Curve < -100 || l.Curve > 100 || (l.Span != 0 && (l.Span < 60 || l.Span > 900)) {
			return fmt.Errorf("Некорректный изгиб или уровень подписи.")
		}
		if l.X < 0 || l.X > 1 || l.Y < 0 || l.Y > 1 || l.Size < 8 || l.Size > 100 || l.Rotation < -180 || l.Rotation > 180 || !mapColor.MatchString(l.Color) || !mapColor.MatchString(l.Outline) {
			return fmt.Errorf("Некорректное оформление подписи.")
		}
		if l.Font != "serif" && l.Font != "sans-serif" && l.Font != "monospace" {
			return fmt.Errorf("Неизвестный шрифт.")
		}
	}
	return nil
}

// References are confined to the authenticated owner's campaign. Never fetch model/user URLs.
func (srv *server) worldMapReference(ctx context.Context, owner, campaign, raw string) (string, []byte, error) {
	u, err := url.Parse(raw)
	if err != nil || u.RawQuery != "" || u.Fragment != "" || strings.ContainsAny(u.Path, "\\\x00") {
		return "", nil, fmt.Errorf("Некорректный референс.")
	}
	prefix := "/uploads/" + sanitizeUploadPathSegment(owner) + "/" + sanitizeUploadPathSegment(campaign) + "/"
	if !strings.HasPrefix(u.Path, prefix) || path.Clean(u.Path) != u.Path || strings.Contains(strings.TrimPrefix(u.Path, prefix), "/") {
		return "", nil, fmt.Errorf("Референс должен быть загружен в эту кампанию.")
	}
	key := strings.TrimPrefix(u.Path, "/")
	file := filepath.Join(srv.uploadDir, filepath.FromSlash(strings.TrimPrefix(u.Path, "/uploads/")))
	if srv.assets != nil {
		if err := srv.assets.ensureLocal(ctx, file, key); err != nil {
			return "", nil, fmt.Errorf("Не удалось прочитать референс.")
		}
	}
	root, err := filepath.EvalSymlinks(srv.uploadDir)
	if err != nil {
		return "", nil, err
	}
	real, err := filepath.EvalSymlinks(file)
	if err != nil {
		return "", nil, err
	}
	rel, err := filepath.Rel(root, real)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", nil, fmt.Errorf("Недопустимый путь.")
	}
	b, err := readMapImage(real)
	return u.Path, b, err
}
func readMapImage(file string) ([]byte, error) {
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, worldMapMaxBytes+1))
	if err != nil {
		return nil, err
	}
	_, _, err = mapImageConfig(b)
	return b, err
}
func mapImageConfig(b []byte) (image.Config, string, error) {
	if len(b) > worldMapMaxBytes {
		return image.Config{}, "", fmt.Errorf("Картинка должна быть не больше 20 МБ.")
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(b))
	if err != nil || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 8192 || cfg.Height > 8192 || int64(cfg.Width)*int64(cfg.Height) > 16000000 || (format != "png" && format != "jpeg" && format != "webp") {
		return image.Config{}, "", fmt.Errorf("Нужна PNG, JPEG или WebP до 16 мегапикселей.")
	}
	return cfg, format, nil
}

func (srv *server) handleWorldMaps(w http.ResponseWriter, r *http.Request, user authUser, campaign campaignData, action string) {
	w.Header().Set("Cache-Control", "no-store")
	if action == "" && r.Method == http.MethodGet {
		maps := campaign.WorldMaps
		if maps == nil {
			maps = []worldMapDocument{}
		}
		writeJSON(w, 200, maps)
		return
	}
	if action == "generate" && r.Method == http.MethodPost {
		srv.generateWorldMap(w, r, user, campaign)
		return
	}
	if action == "" || action == "generate" || r.Method != http.MethodPut {
		writeError(w, 405, "method_not_allowed", "Only GET, POST generate and PUT map are supported")
		return
	}
	var input struct {
		Revision int             `json:"revision"`
		Title    string          `json:"title"`
		Labels   []worldMapLabel `json:"labels"`
	}
	if !boundedMutationInput(w, r, &input, 128<<10) {
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" || len([]rune(input.Title)) > 160 {
		writeError(w, 400, "invalid_map", "Укажи название до 160 символов.")
		return
	}
	if err := validateMapLabels(input.Labels); err != nil {
		writeError(w, 400, "invalid_map", err.Error())
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	for ci := range srv.store.data.Campaigns {
		c := &srv.store.data.Campaigns[ci]
		if c.ID != campaign.ID || c.OwnerID != user.ID {
			continue
		}
		for mi := range c.WorldMaps {
			m := &c.WorldMaps[mi]
			if m.ID != action {
				continue
			}
			if m.Revision != input.Revision {
				writeError(w, 409, "map_conflict", "Карта изменена в другом окне. Открой сохранённую версию перед повтором.")
				return
			}
			original, err := cloneStorageState(srv.store.data)
			if err != nil {
				writeError(w, 500, "save_failed", "Не удалось сохранить карту.")
				return
			}
			m.Title = input.Title
			m.Labels = input.Labels
			m.Revision++
			c.Revision++
			result := *m
			if err := srv.store.saveMutationLocked(original); err != nil {
				writeError(w, 500, "save_failed", "Правки не сохранены.")
				return
			}
			writeJSON(w, 200, result)
			return
		}
	}
	writeError(w, 404, "not_found", "Карта не найдена.")
}

func (srv *server) generateWorldMap(w http.ResponseWriter, r *http.Request, user authUser, campaign campaignData) {
	var input worldMapGenerateInput
	if !boundedMutationInput(w, r, &input, 32768) {
		return
	}
	input.Prompt = strings.TrimSpace(input.Prompt)
	input.Scale = normalizedMapScale(input.Scale)
	if !validMapScale(input.Scale) {
		writeError(w, 400, "invalid_map_scale", "Выбери масштаб карты.")
		return
	}
	scope := normalizedMapContext(input.Context)
	if !mapRequestID.MatchString(input.RequestID) || len([]rune(input.Prompt)) > 6000 || len(scope.LocationID) > 200 || (input.Prompt == "" && input.ReferenceURL == "" && !scope.IncludeCampaign && scope.LocationID == "") {
		writeError(w, 400, "invalid_map", "Добавь описание или картинку-референс.")
		return
	}
	id := "worldmap-" + input.RequestID
	if _, active := srv.mapGenerationOwners.LoadOrStore(user.ID, true); active {
		writeError(w, 409, "map_busy", "Дождись завершения текущей карты перед новой генерацией.")
		return
	}
	defer srv.mapGenerationOwners.Delete(user.ID)
	// The queue may have captured an earlier campaign snapshot.
	current, loadErr := srv.store.getCampaignForUser(user.ID, campaign.ID)
	if loadErr != nil {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	campaign = current
	var source *worldMapDocument
	if input.SourceMapID != "" {
		for i := range campaign.WorldMaps {
			if campaign.WorldMaps[i].ID == input.SourceMapID {
				source = &campaign.WorldMaps[i]
				break
			}
		}
		if source == nil {
			writeError(w, 404, "not_found", "Исходная карта не найдена.")
			return
		}
		if input.Prompt == "" {
			writeError(w, 400, "invalid_map", "Опиши, что изменить на карте.")
			return
		}
		input.ReferenceURL = source.ImageURL
		input.Scale = normalizedMapScale(source.Scale)
		scope = normalizedMapContext(source.Context)
	}
	generationPrompt, contextErr := scopedWorldMapPrompt(campaign, input.Prompt, scope, input.Scale)
	if contextErr != nil {
		writeError(w, 400, "invalid_map_context", contextErr.Error())
		return
	}
	// Completed retries return their original result without another paid call.
	for _, m := range campaign.WorldMaps {
		if m.ID == id {
			if m.Prompt != input.Prompt || m.ReferenceURL != input.ReferenceURL || normalizedMapContext(m.Context) != scope || normalizedMapScale(m.Scale) != input.Scale || m.SourceMapID != input.SourceMapID || m.SourceRevision != input.SourceRevision {
				writeError(w, 409, "map_request_changed", "Создай новый запрос для другой карты.")
				return
			}
			writeJSON(w, 200, m)
			return
		}
	}
	if len(campaign.WorldMaps) >= 200 {
		writeError(w, 409, "map_limit", "В кампании уже 200 карт.")
		return
	}
	if source != nil {
		if source.Revision != input.SourceRevision {
			writeError(w, 409, "stale_revision", "Карта изменилась. Обнови её перед AI-редактированием.")
			return
		}
		anchors, _ := json.Marshal(source.Labels)
		generationPrompt += "\nIMAGE EDIT, not a new design. The reference is the current map background. Apply only the requested changes, preserve unrelated geography, composition, framing and aspect ratio. Do not paint text. Existing editable labels will be kept unchanged; keep their geographic anchors aligned. Return no new labels. Original description (reference data):\n" + source.Prompt + "\nExisting label anchors (reference data):\n" + string(anchors) + "\nRequested edit:\n" + input.Prompt
	}
	var reference []byte
	if input.ReferenceURL != "" {
		canonical, b, err := srv.worldMapReference(r.Context(), user.ID, campaign.ID, input.ReferenceURL)
		if err != nil {
			writeError(w, 400, "invalid_reference", err.Error())
			return
		}
		input.ReferenceURL = canonical
		reference = b
	}
	connected := false
	if srv.codex != nil {
		s := srv.codex.status(r.Context(), user)
		allowed, _ := srv.codex.bridgeUserAllowed(user)
		if s.State == "error" || s.State == "connecting" || (s.State == "unavailable" && allowed && srv.codex.options.Enabled) {
			writeError(w, 503, "codex_not_ready", "Проверь подключение Codex. Платный API автоматически не включён.")
			return
		}
		connected = s.State == "connected" && s.AuthMode == "chatgpt"
	}
	var result mapGenerationResult
	var err error
	if connected {
		result, err = srv.generateCodexWorldMap(r.Context(), user, campaign.ID, generationPrompt, reference)
	} else {
		account, found := srv.store.getUserByID(user.ID)
		if !found || !subscriptionActive(account.Subscription, time.Now()) {
			writeError(w, 402, "subscription_required", "Подключи Codex или активируй подписку для генерации через API.")
			return
		}
		g, ok := srv.generator.(openAIGenerator)
		if !ok || g.config.apiToken == "" {
			writeError(w, 503, "image_api_unavailable", "Серверный API изображений не настроен.")
			return
		}
		result, err = g.generateWorldMap(r.Context(), generationPrompt, reference)
	}
	if err != nil {
		writeError(w, 502, "map_generation_failed", "Не удалось создать карту. "+err.Error())
		return
	}
	cfg, format, err := mapImageConfig(result.Image)
	if err != nil {
		writeError(w, 502, "invalid_image", err.Error())
		return
	}
	if len(result.Plan.Labels) > 100 || strings.TrimSpace(result.Plan.Title) == "" || len([]rune(result.Plan.Title)) > 160 {
		writeError(w, 502, "invalid_map", "AI вернул некорректную структуру карты.")
		return
	}
	labels := make([]worldMapLabel, 0, len(result.Plan.Labels))
	for _, l := range result.Plan.Labels {
		labels = append(labels, plannedWorldMapLabel(l, newID("label")))
	}
	if source != nil {
		labels = append([]worldMapLabel(nil), source.Labels...)
	}
	if err := validateMapLabels(labels); err != nil {
		writeError(w, 502, "invalid_map", err.Error())
		return
	}
	ext := "." + format
	if format == "jpeg" {
		ext = ".jpg"
	}
	dir := filepath.Join(srv.uploadDir, sanitizeUploadPathSegment(user.ID), sanitizeUploadPathSegment(campaign.ID))
	if srv.uploadDir == "" || os.MkdirAll(dir, 0700) != nil {
		writeError(w, 500, "save_failed", "Хранилище изображений недоступно.")
		return
	}
	file := filepath.Join(dir, newID("worldmap")+ext)
	if err = os.WriteFile(file, result.Image, 0600); err != nil {
		writeError(w, 500, "save_failed", "Не удалось сохранить изображение.")
		return
	}
	file, _, _ = optimizeUploadedImage(r.Context(), file, http.DetectContentType(result.Image), int64(len(result.Image)))
	if srv.assets != nil {
		if err = srv.assets.publishUpload(r.Context(), file); err != nil {
			writeError(w, 500, "save_failed", "Не удалось сохранить изображение в хранилище.")
			return
		}
	}
	doc := worldMapDocument{ID: id, Title: result.Plan.Title, Prompt: input.Prompt, ImageURL: "/uploads/" + sanitizeUploadPathSegment(user.ID) + "/" + sanitizeUploadPathSegment(campaign.ID) + "/" + filepath.Base(file), ReferenceURL: input.ReferenceURL, Labels: labels, Width: cfg.Width, Height: cfg.Height, Provider: result.Provider, CreatedAt: time.Now().UTC()}
	doc.Context = &scope
	doc.Scale = input.Scale
	doc.SourceMapID = input.SourceMapID
	doc.SourceRevision = input.SourceRevision
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	for ci := range srv.store.data.Campaigns {
		c := &srv.store.data.Campaigns[ci]
		if c.ID != campaign.ID || c.OwnerID != user.ID {
			continue
		}
		for _, existing := range c.WorldMaps {
			if existing.ID == id {
				writeJSON(w, 200, existing)
				return
			}
		}
		original, e := cloneStorageState(srv.store.data)
		if e != nil {
			writeError(w, 500, "save_failed", "Не удалось сохранить карту.")
			return
		}
		c.WorldMaps = append(c.WorldMaps, doc)
		c.Revision++
		if e = srv.store.saveMutationLocked(original); e != nil {
			writeError(w, 500, "save_failed", "Не удалось сохранить карту.")
			return
		}
		writeJSON(w, 201, doc)
		return
	}
	writeError(w, 404, "not_found", "Кампания больше недоступна.")
}

func decodeMapPlan(raw string) (mapGenerationPlan, error) {
	var plan mapGenerationPlan
	raw = strings.TrimSpace(raw)
	if strings.HasPrefix(raw, "```json") {
		raw = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(raw, "```json"), "```"))
	}
	err := json.Unmarshal([]byte(raw), &plan)
	return plan, err
}
