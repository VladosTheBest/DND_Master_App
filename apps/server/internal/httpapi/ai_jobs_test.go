package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func waitAIJob(t *testing.T, m *aiJobManager, id string) aiJob {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		m.mu.Lock()
		job := m.jobs[id].aiJob
		m.mu.Unlock()
		if !activeAIJob(job) {
			return job
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("background job did not finish")
	return aiJob{}
}

func TestAIJobsDetachSessionFromRequestAndDeduplicate(t *testing.T) {
	auth, store := newTestAuthManager(t, AuthOptions{})
	user, err := store.createUser("background-owner", "password123")
	if err != nil {
		t.Fatal(err)
	}
	campaign, err := store.createCampaignForUser(user.ID, createCampaignInput{Title: "Background test"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := parseImportedSession("Test session", syntheticQuillText)
	if err != nil {
		t.Fatal(err)
	}
	session.CampaignID = campaign.ID
	session, _, err = store.importSession(session)
	if err != nil {
		t.Fatal(err)
	}
	token, err := auth.issueEphemeralSession(authUser{ID: user.ID, Username: user.Username}, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	m, err := newAIJobManager(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	srv := &server{auth: auth, store: store, aiJobs: m}
	started, release := make(chan struct{}), make(chan struct{})
	var executions atomic.Int32
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		executions.Add(1)
		close(started)
		reportAIJobStage(r.Context(), "Разбираю часть 1 из 2")
		<-release
		if r.Context().Err() != nil {
			writeError(w, 500, "cancelled", "browser cancelled background work")
			return
		}
		writeJSON(w, 200, map[string]string{"sessionId": session.ID, "message": "saved"})
	})
	request := func(prompt string, ctx context.Context) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"campaignId": campaign.ID, "sessionId": session.ID, "prompt": prompt})
		r := httptest.NewRequest("POST", "/api/ai/codex/prompts", strings.NewReader(string(body))).WithContext(ctx)
		r.AddCookie(&http.Cookie{Name: auth.cookieName, Value: token})
		r.Header.Set("Prefer", "respond-async")
		w := httptest.NewRecorder()
		if !srv.queueAIGeneration(w, r, next) {
			t.Fatal("request was not queued")
		}
		return w
	}
	ctx, cancel := context.WithCancel(context.Background())
	w := request("First prompt", ctx)
	if w.Code != 202 {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	job := decodeAccountTestData[aiJob](t, w)
	<-started
	cancel()
	duplicate := decodeAccountTestData[aiJob](t, request("Different prompt for same session", context.Background()))
	if duplicate.ID != job.ID || duplicate.Stage != "Разбираю часть 1 из 2" {
		t.Fatalf("duplicate or lost stage: %+v", duplicate)
	}
	close(release)
	finished := waitAIJob(t, m, job.ID)
	if finished.State != "succeeded" || executions.Load() != 1 {
		t.Fatalf("background: %+v, calls=%d", finished, executions.Load())
	}
	restored, err := newAIJobManager(m.path)
	if err != nil {
		t.Fatal(err)
	}
	if restored.jobs[job.ID].State != "succeeded" || !strings.Contains(string(restored.jobs[job.ID].Result), "saved") {
		t.Fatal("completed result did not survive reload")
	}
}

func TestAIJobsHTTPAccessResultsAndSynchronousCompatibility(t *testing.T) {
	handler := newAccountTestServer(t)
	owner := registerAccountTestUser(t, handler, "jobs-owner")
	other := registerAccountTestUser(t, handler, "jobs-other")
	path := "/api/campaigns/campaign-shadow-edge/ai/drafts"
	body := `{"kind":"npc","prompt":"A friendly innkeeper"}`
	post := func(cookies []*http.Cookie, origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, strings.NewReader(body))
		r.Header.Set("Prefer", "respond-async")
		r.Header.Set("Content-Type", "application/json")
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		for _, cookie := range cookies {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if w := post(nil, ""); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := post(other, ""); w.Code != 404 {
		t.Fatal(w.Code)
	}
	if w := post(owner, "https://evil.example"); w.Code != 403 {
		t.Fatal(w.Code)
	}
	w := post(owner, "")
	if w.Code != 202 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	job := decodeAccountTestData[aiJob](t, w)
	deadline := time.Now().Add(5 * time.Second)
	for activeAIJob(job) && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
		job = decodeAccountTestData[aiJob](t, accountTestRequest(t, handler, "GET", "/api/ai/jobs/"+job.ID, "", owner))
	}
	if job.State != "succeeded" || !strings.Contains(string(job.Result), `"entity"`) {
		t.Fatalf("result: %+v", job)
	}
	if w := accountTestRequest(t, handler, "GET", "/api/ai/jobs/"+job.ID, "", other); w.Code != 404 {
		t.Fatal("owner leak", w.Code)
	}
	if jobs := decodeAccountTestData[[]aiJob](t, accountTestRequest(t, handler, "GET", "/api/ai/jobs", "", other)); len(jobs) != 0 {
		t.Fatal("list owner leak")
	}
	list := accountTestRequest(t, handler, "GET", "/api/ai/jobs", "", owner)
	if strings.Contains(list.Body.String(), `"result"`) || strings.Contains(list.Body.String(), `"ownerId"`) {
		t.Fatal("list exposes private storage or full results")
	}
	syncResult := accountTestRequest(t, handler, "POST", path, body, owner)
	if syncResult.Code != 200 || !strings.Contains(syncResult.Body.String(), `"entity"`) {
		t.Fatalf("sync API changed: %s", syncResult.Body.String())
	}
}

func TestAIJobsRestartFailureQueueLimitsAndPersistenceFailure(t *testing.T) {
	path := filepath.Join(t.TempDir(), "jobs.json")
	m, err := newAIJobManager(path)
	if err != nil {
		t.Fatal(err)
	}
	m.jobs["interrupted"] = &storedAIJob{aiJob: aiJob{ID: "interrupted", State: "running", Kind: "session", CreatedAt: time.Now()}, OwnerID: "owner"}
	if err := m.saveLocked(); err != nil {
		t.Fatal(err)
	}
	m, err = newAIJobManager(path)
	if err != nil {
		t.Fatal(err)
	}
	if m.jobs["interrupted"].State != "failed" || !strings.Contains(string(m.jobs["interrupted"].Result), "ai_job_interrupted") {
		t.Fatal("restart looks like perpetual progress")
	}
	failed, err := m.start("owner", "failure", aiJob{}, func(context.Context) (int, []byte) { return 429, jobFailure("rate_limit", "No capacity") })
	if err != nil {
		t.Fatal(err)
	}
	if job := waitAIJob(t, m, failed.ID); job.State != "failed" || job.HTTPStatus != 429 || !strings.Contains(string(job.Result), "rate_limit") {
		t.Fatalf("lost upstream failure: %+v", job)
	}
	m.mu.Lock()
	for i := 0; i < 8; i++ {
		id := newID("queued")
		m.jobs[id] = &storedAIJob{aiJob: aiJob{ID: id, State: "queued"}, OwnerID: "full"}
	}
	m.mu.Unlock()
	if _, err := m.start("full", "ninth", aiJob{}, nil); err == nil {
		t.Fatal("unbounded queue")
	}
	blocked := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocked, []byte("occupied"), 0o600); err != nil {
		t.Fatal(err)
	}
	m.path = filepath.Join(blocked, "jobs.json")
	if _, err := m.start("another", "not-started", aiJob{}, func(context.Context) (int, []byte) { panic("must not run") }); err == nil {
		t.Fatal("accepted job without durable receipt")
	}
}
