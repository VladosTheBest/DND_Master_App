package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestFoundryAISceneImageJobReviewIdempotencyAndScopedApply(t *testing.T) {
	t.Setenv("SHADOW_EDGE_IMAGE_OPTIMIZER", "off")
	m, c, _ := aiFixture(t)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Method != "POST" || r.Header.Get("Authorization") != "Bearer test" {
			t.Error("upstream auth/method")
		}
		if r.URL.Path == "/images/generations" {
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			if body["model"] != "test-image" {
				t.Error("image model changed")
			}
			json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]any{"b64_json": base64.StdEncoding.EncodeToString(mapFixturePNG())}}})
			return
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		raw, _ := json.Marshal(body)
		plan, _ := json.Marshal(mapFixturePlan())
		if strings.Contains(string(raw), "world_map_visual_check") {
			plan = []byte(`{"isMap":true}`)
		} else if !strings.Contains(string(raw), "orthographic top-down") || !strings.Contains(string(raw), "NO GRID") {
			t.Error("battlemap prompt missing")
		}
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(plan)}}}})
	}))
	defer upstream.Close()
	m.srv.generator = newEntityGenerator(AIOptions{Provider: "openai", BaseURL: upstream.URL, APIToken: "test", Model: "test", ImageModel: "test-image"})
	m.srv.uploadDir = t.TempDir()
	m.srv.uploads = http.StripPrefix("/uploads/", http.FileServer(http.Dir(m.srv.uploadDir)))
	jobs, err := newAIJobManager(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	m.srv.aiJobs = jobs
	input := foundrySceneInput{RequestID: "scene-request-for-test", Title: "Battlemap", Prompt: "A ruined tavern with kitchen and courtyard", Columns: 30, Rows: 20, Distance: 5}
	start := foundryCall(t, m, "POST", "v1/scenes/ai", input)
	if start.Code != 202 {
		t.Fatal(start.Body.String())
	}
	var b struct {
		Data aiJob `json:"data"`
	}
	json.Unmarshal(start.Body.Bytes(), &b)
	id := b.Data.ID
	deadline := time.Now().Add(10 * time.Second)
	for {
		w := foundryCall(t, m, "GET", "v1/scenes/ai/"+id, nil)
		json.Unmarshal(w.Body.Bytes(), &b)
		if b.Data.State == "succeeded" {
			break
		}
		if b.Data.State == "failed" || time.Now().After(deadline) {
			t.Fatal(w.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	var result struct {
		Data sessionMapDocument `json:"data"`
	}
	json.Unmarshal(b.Data.Result, &result)
	if result.Data.Title != input.Title || len(result.Data.Levels) != 1 || result.Data.Levels[0].Width != 120 || result.Data.Levels[0].GridDistance != 5 {
		t.Fatal("scene result")
	}
	campaign, _ := m.srv.store.getCampaignForUser(c.OwnerID, c.CampaignID)
	if len(campaign.SessionMaps) != 0 || len(campaign.WorldMaps) != 0 {
		t.Fatal("preview persisted a scene")
	}
	asset := foundryCall(t, m, "GET", "v1/assets?url="+result.Data.Levels[0].ImageURL, nil)
	if asset.Code != 200 {
		t.Fatal("scoped preview asset")
	}
	count := calls.Load()
	again := foundryCall(t, m, "POST", "v1/scenes/ai", input)
	var same struct {
		Data aiJob `json:"data"`
	}
	json.Unmarshal(again.Body.Bytes(), &same)
	if same.Data.ID != id || calls.Load() != count {
		t.Fatal("paid call repeated")
	}
	input.Prompt = "Another room layout"
	if w := foundryCall(t, m, "POST", "v1/scenes/ai", input); w.Code != 409 {
		t.Fatal("request ID reused with different data")
	}
	jobs.mu.Lock()
	saved := jobs.jobs[id].Key
	jobs.jobs[id].Key = "foundry-scene:foreign:" + input.RequestID + ":hash"
	jobs.mu.Unlock()
	if w := foundryCall(t, m, "GET", "v1/scenes/ai/"+id, nil); w.Code != 404 {
		t.Fatal("foreign connection read result")
	}
	jobs.mu.Lock()
	jobs.jobs[id].Key = saved
	jobs.mu.Unlock()
	m.srv.store.atomicFileReplace = func(string, string) error { return fmtError("disk unavailable") }
	if w := foundryCall(t, m, "POST", "v1/scenes/ai/"+id+"/apply", map[string]any{}); w.Code != 500 {
		t.Fatal("save failure missing")
	}
	campaign, _ = m.srv.store.getCampaignForUser(c.OwnerID, c.CampaignID)
	if len(campaign.SessionMaps) != 0 {
		t.Fatal("failed save persisted scene")
	}
	m.srv.store.atomicFileReplace = nil
	for i := 0; i < 2; i++ {
		if w := foundryCall(t, m, "POST", "v1/scenes/ai/"+id+"/apply", map[string]any{}); w.Code != 200 && w.Code != 201 {
			t.Fatal(w.Body.String())
		}
	}
	campaign, _ = m.srv.store.getCampaignForUser(c.OwnerID, c.CampaignID)
	if len(campaign.SessionMaps) != 1 {
		t.Fatal("duplicate scenes")
	}
	rows, _ := foundryRecords(m.srv.store.data, c.CampaignID)
	found := false
	for _, row := range rows {
		if row.Key == "session-map:"+result.Data.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("scene not exported in snapshot")
	}
}
