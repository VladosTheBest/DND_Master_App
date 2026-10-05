package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type aiJob struct {
	ID         string          `json:"id"`
	CampaignID string          `json:"campaignId,omitempty"`
	SessionID  string          `json:"sessionId,omitempty"`
	Kind       string          `json:"kind"`
	Title      string          `json:"title"`
	State      string          `json:"state"`
	Stage      string          `json:"stage"`
	CreatedAt  time.Time       `json:"createdAt"`
	StartedAt  *time.Time      `json:"startedAt,omitempty"`
	FinishedAt *time.Time      `json:"finishedAt,omitempty"`
	HTTPStatus int             `json:"httpStatus,omitempty"`
	Result     json.RawMessage `json:"result,omitempty"`
}

type storedAIJob struct {
	aiJob
	OwnerID string `json:"ownerId"`
	Key     string `json:"key"`
}

type aiJobManager struct {
	cloud *cloudDatabase
	mu    sync.Mutex
	path  string
	jobs  map[string]*storedAIJob
	slots chan struct{}
}

func activeAIJob(job aiJob) bool { return job.State == "queued" || job.State == "running" }

func newAIJobManager(path string) (*aiJobManager, error) {
	return newAIJobManagerWithCloud(path, nil, false)
}

func newAIJobManagerWithCloud(path string, cloud *cloudDatabase, allowImport bool) (*aiJobManager, error) {
	m := &aiJobManager{cloud: cloud, path: path, jobs: make(map[string]*storedAIJob), slots: make(chan struct{}, 4)}
	var data []byte
	var err error
	if cloud != nil {
		_, records, exists, readErr := cloud.readGroup("jobs", []string{"ai_jobs"})
		if readErr != nil {
			return nil, readErr
		}
		if exists {
			items := []json.RawMessage{}
			for _, record := range records {
				items = append(items, record.Body)
			}
			data, err = json.Marshal(items)
		} else if allowImport {
			data, err = os.ReadFile(path)
			if os.IsNotExist(err) {
				data = []byte(`[]`)
				err = nil
			}
		} else {
			return nil, fmt.Errorf("AI job migration has not been completed")
		}
	} else {
		data, err = os.ReadFile(path)
	}
	if os.IsNotExist(err) {
		return m, nil
	}
	if err != nil {
		return nil, err
	}
	var jobs []*storedAIJob
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&jobs); err != nil {
		return nil, fmt.Errorf("read AI task storage: %w", err)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return nil, fmt.Errorf("trailing data in AI task storage")
	}
	for _, job := range jobs {
		if job == nil {
			return nil, fmt.Errorf("null AI task in storage")
		}
		if job.ID == "" || m.jobs[job.ID] != nil {
			return nil, fmt.Errorf("missing or duplicate AI task ID")
		}
		if activeAIJob(job.aiJob) {
			now := time.Now().UTC()
			job.State, job.Stage, job.FinishedAt = "failed", "Сервер был перезапущен. Проверь сохранённый результат перед повтором.", &now
			job.HTTPStatus = http.StatusServiceUnavailable
			job.Result = jobFailure("ai_job_interrupted", job.Stage)
		}
		m.jobs[job.ID] = job
	}
	if err := m.saveLocked(); err != nil {
		return nil, err
	}
	if cloud != nil {
		_, records, _, err := cloud.readGroup("jobs", []string{"ai_jobs"})
		if err != nil {
			return nil, err
		}
		if len(records) != len(m.jobs) {
			return nil, fmt.Errorf("AI task count verification failed")
		}
		for _, record := range records {
			body, _ := json.Marshal(m.jobs[record.ID])
			if cloudJSONDigest(body) != cloudJSONDigest(record.Body) {
				return nil, fmt.Errorf("AI task content verification failed")
			}
		}
	}
	return m, nil
}

func jobFailure(code, message string) json.RawMessage {
	data, _ := json.Marshal(envelope{Error: &errorBody{Code: code, Message: message}})
	return data
}

func (m *aiJobManager) saveLocked() error {
	jobs := make([]*storedAIJob, 0, len(m.jobs))
	for _, job := range m.jobs {
		jobs = append(jobs, job)
	}
	if m.cloud != nil {
		sort.Slice(jobs, func(i, j int) bool { return jobs[i].ID < jobs[j].ID })
		records := make([]cloudRecord, 0, len(jobs))
		for index, job := range jobs {
			body, err := json.Marshal(job)
			if err != nil {
				return err
			}
			records = append(records, cloudRecord{"ai_jobs", job.ID, job.ID, "", job.Kind, index, body})
		}
		return m.cloud.writeGroup("jobs", json.RawMessage(`{"version":1}`), records, []string{"ai_jobs"})
	}
	data, err := json.Marshal(jobs)
	if err != nil {
		return err
	}
	return writeFileAtomically(m.path, data, 0o600)
}

func (m *aiJobManager) start(owner, key string, job aiJob, work func(context.Context) (int, []byte)) (aiJob, error) {
	m.mu.Lock()
	count, total := 0, 0
	for _, existing := range m.jobs {
		if activeAIJob(existing.aiJob) {
			total++
			if existing.OwnerID == owner {
				if existing.Key == key {
					result := existing.aiJob
					m.mu.Unlock()
					return result, nil
				}
				count++
			}
		}
	}
	if count >= 8 || total >= 32 {
		m.mu.Unlock()
		return aiJob{}, fmt.Errorf("Очередь заполнена. Дождись завершения текущих задач.")
	}
	m.pruneLocked(owner)
	job.ID, job.State, job.Stage, job.CreatedAt = newID("ai-job"), "queued", "Ожидает свободного места", time.Now().UTC()
	record := &storedAIJob{aiJob: job, OwnerID: owner, Key: key}
	m.jobs[job.ID] = record
	if err := m.saveLocked(); err != nil {
		delete(m.jobs, job.ID)
		m.mu.Unlock()
		return aiJob{}, err
	}
	m.mu.Unlock()
	go m.run(record.ID, work)
	return job, nil
}

func (m *aiJobManager) pruneLocked(owner string) {
	// Retain the latest 50 completed results for each owner, up to seven days.
	completed := []*storedAIJob{}
	for _, existing := range m.jobs {
		if existing.OwnerID == owner && !activeAIJob(existing.aiJob) {
			completed = append(completed, existing)
		}
	}
	sort.Slice(completed, func(i, j int) bool { return completed[i].CreatedAt.After(completed[j].CreatedAt) })
	for i, old := range completed {
		if i >= 50 || time.Since(old.CreatedAt) > 7*24*time.Hour {
			delete(m.jobs, old.ID)
		}
	}
}

type aiJobProgressKey struct{}

func reportAIJobStage(ctx context.Context, stage string) {
	if update, ok := ctx.Value(aiJobProgressKey{}).(func(string)); ok {
		update(stage)
	}
}

func (m *aiJobManager) run(id string, work func(context.Context) (int, []byte)) {
	m.slots <- struct{}{}
	defer func() { <-m.slots }()
	m.mu.Lock()
	job := m.jobs[id]
	now := time.Now().UTC()
	job.State, job.Stage, job.StartedAt = "running", "Подготавливаю результат", &now
	m.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Minute)
	defer cancel()
	ctx = context.WithValue(ctx, aiJobProgressKey{}, func(stage string) {
		m.mu.Lock()
		job.Stage = stage
		m.mu.Unlock()
	})
	status, body := http.StatusInternalServerError, []byte(nil)
	func() {
		defer func() {
			if recover() != nil {
				body = jobFailure("ai_job_failed", "Не удалось завершить задачу. Попробуй ещё раз.")
			}
		}()
		status, body = work(ctx)
	}()
	if !json.Valid(body) {
		status, body = http.StatusBadGateway, jobFailure("ai_job_invalid_result", "Генератор вернул некорректный ответ.")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	now = time.Now().UTC()
	job.FinishedAt, job.HTTPStatus, job.Result = &now, status, append(json.RawMessage(nil), body...)
	job.State, job.Stage = "succeeded", "Готово"
	if status < 200 || status >= 300 {
		job.State, job.Stage = "failed", "Не удалось завершить"
	}
	m.pruneLocked(job.OwnerID)
	if err := m.saveLocked(); err != nil {
		job.Stage = "Результат доступен, но не записан в историю задач. Сохрани его до перезапуска сервера."
	}
}

func (srv *server) handleAIJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, 405, "method_not_allowed", "Only GET is supported")
		return
	}
	user, ok := srv.requireAuthUser(w, r)
	if !ok {
		return
	}
	m := srv.aiJobs
	w.Header().Set("Cache-Control", "no-store")
	m.mu.Lock()
	id := strings.TrimPrefix(r.URL.Path, "/api/ai/jobs")
	if id != "" && id != "/" {
		job := m.jobs[strings.TrimPrefix(id, "/")]
		if job == nil || job.OwnerID != user.ID {
			m.mu.Unlock()
			writeError(w, 404, "not_found", "Задача не найдена.")
			return
		}
		item := job.aiJob
		m.mu.Unlock()
		writeJSON(w, 200, item)
		return
	}
	jobs := []aiJob{}
	for _, job := range m.jobs {
		if job.OwnerID != user.ID || (r.URL.Query().Get("campaignId") != "" && job.CampaignID != r.URL.Query().Get("campaignId")) {
			continue
		}
		item := job.aiJob
		item.Result = nil
		jobs = append(jobs, item)
	}
	m.mu.Unlock()
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].CreatedAt.After(jobs[j].CreatedAt) })
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, jobs)
}

func backgroundGenerationRoute(path string) (kind, campaign string) {
	if path == "/api/ai/codex/prompts" {
		return "codex", ""
	}
	if path == "/api/ai/proposals/campaign" {
		return "campaign", ""
	}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 5 || parts[0] != "api" || parts[1] != "campaigns" {
		return "", ""
	}
	switch strings.Join(parts[3:], "/") {
	case "ai/drafts", "ai/proposals/entities":
		kind = "entity"
	case "ai/proposals/events", "events/generate":
		kind = "event"
	case "ai/player-facing/format":
		kind = "card"
	case "ai/chat":
		kind = "chat"
	case "combat/generate":
		kind = "combat"
	}
	return kind, parts[2]
}

// Opt-in transport keeps existing synchronous HTTP and MCP clients compatible.
func (srv *server) queueAIGeneration(w http.ResponseWriter, r *http.Request, next http.Handler) bool {
	kind, campaign := backgroundGenerationRoute(r.URL.Path)
	if kind == "" || r.Method != http.MethodPost || r.Header.Get("Prefer") != "respond-async" {
		return false
	}
	user, ok := srv.requireAuthUser(w, r)
	if !ok {
		return true
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, (1<<20)+1))
	if err != nil || len(body) > 1<<20 {
		writeError(w, 413, "bad_request", "Слишком большой запрос.")
		return true
	}
	var input struct {
		CampaignID    string `json:"campaignId"`
		SessionID     string `json:"sessionId"`
		IncludeImages bool   `json:"includeImages"`
		ImageTarget   *struct {
			EntityID string `json:"entityId"`
		} `json:"imageTarget"`
	}
	if json.Unmarshal(body, &input) != nil {
		writeError(w, 400, "bad_request", "Некорректный запрос.")
		return true
	}
	if campaign == "" {
		campaign = input.CampaignID
	}
	if campaign != "" {
		if _, err := srv.store.getCampaignForUser(user.ID, campaign); err != nil {
			writeError(w, 404, "not_found", "Кампания не найдена.")
			return true
		}
	}
	key := fmt.Sprintf("%s:%x", r.URL.Path, sha256.Sum256(body))
	title := map[string]string{"codex": "AI-черновики", "campaign": "Новая кампания", "entity": "Генерация записи", "event": "Генерация события", "card": "Карточка для игроков", "combat": "Генерация боя"}[kind]
	if kind == "codex" && input.IncludeImages {
		kind, title = "image", "Генерация изображений"
	}
	if kind == "chat" {
		title = "Ответ AI в чате"
	}
	if r.URL.Path == "/api/ai/codex/prompts" && input.SessionID != "" {
		session, exists := srv.store.sessionForOwner(user.ID, campaign, input.SessionID)
		if !exists {
			writeError(w, 404, "not_found", "Сессия не найдена.")
			return true
		}
		kind, title, key = "session", "Анализ: "+session.Title, "session:"+campaign+":"+input.SessionID
	}
	if input.ImageTarget != nil {
		key = "image:" + campaign + ":" + input.ImageTarget.EntityID
	}
	job, err := srv.aiJobs.start(user.ID, key, aiJob{Kind: kind, Title: title, CampaignID: campaign, SessionID: input.SessionID}, func(ctx context.Context) (int, []byte) {
		request := r.Clone(ctx)
		request.Body = io.NopCloser(bytes.NewReader(body))
		request.Header.Del("Prefer")
		response := &aiJobResponse{header: make(http.Header), status: 200}
		next.ServeHTTP(response, request)
		return response.status, response.body.Bytes()
	})
	if err != nil {
		writeError(w, 503, "ai_queue_unavailable", "Не удалось поставить задачу в очередь. Проверь место на сервере и текущие задачи.")
		return true
	}
	w.Header().Set("Preference-Applied", "respond-async")
	writeJSON(w, http.StatusAccepted, job)
	return true
}

type aiJobResponse struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (w *aiJobResponse) Header() http.Header    { return w.header }
func (w *aiJobResponse) WriteHeader(status int) { w.status = status }
func (w *aiJobResponse) Write(data []byte) (int, error) {
	if w.body.Len()+len(data) > 8<<20 {
		return 0, fmt.Errorf("AI result exceeds storage limit")
	}
	return w.body.Write(data)
}
