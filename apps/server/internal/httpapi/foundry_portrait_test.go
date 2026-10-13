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

func TestFoundryPortraitStartsAtActorHeading(t *testing.T) {
	campaign, err := readReadyCampaign("icewind-dale-rus")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range campaign.Monsters {
		if e.Title != "Тюлень" {
			continue
		}
		text := foundryPortraitDescription(e)
		if strings.Contains(text, "Тупоголовая форель") || !strings.Contains(text, "серебристо-серым") {
			t.Fatal("portrait includes adjacent creature instead of seal")
		}
		return
	}
	t.Fatal("seal fixture missing")
}

func TestFoundryPortraitScopedJobIdempotent(t *testing.T) {
	t.Setenv("SHADOW_EDGE_IMAGE_OPTIMIZER", "off")
	m, c, _ := aiFixture(t)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/images/generations" {
			t.Error("wrong endpoint")
		}
		var b map[string]any
		json.NewDecoder(r.Body).Decode(&b)
		if b["model"] != "test-image" || b["size"] != "1024x1024" {
			t.Error("image config changed")
		}
		json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]any{"b64_json": base64.StdEncoding.EncodeToString(mapFixturePNG())}}})
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
	input := map[string]any{"requestId": "portrait-request-test", "recordKey": "monster:ai-test"}
	w := foundryCall(t, m, "POST", "v1/actors/portraits", input)
	if w.Code != 202 {
		t.Fatal(w.Body.String())
	}
	var b struct {
		Data aiJob `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &b)
	id := b.Data.ID
	deadline := time.Now().Add(10 * time.Second)
	for b.Data.State != "succeeded" {
		w = foundryCall(t, m, "GET", "v1/actors/portraits/"+id, nil)
		json.Unmarshal(w.Body.Bytes(), &b)
		if b.Data.State == "failed" || time.Now().After(deadline) {
			t.Fatal(w.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	var result struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	json.Unmarshal(b.Data.Result, &result)
	if foundryCall(t, m, "GET", "v1/assets?url="+result.Data.URL, nil).Code != 200 {
		t.Fatal("image not accessible")
	}
	w = foundryCall(t, m, "POST", "v1/actors/portraits", input)
	json.Unmarshal(w.Body.Bytes(), &b)
	if b.Data.ID != id || calls.Load() != 1 {
		t.Fatal("paid retry repeated")
	}
	campaign, _ := m.srv.store.getCampaignForUser(c.OwnerID, c.CampaignID)
	if campaign.Monsters[0].Art != nil {
		t.Fatal("campaign changed")
	}
	jobs.mu.Lock()
	jobs.jobs[id].Key = "foundry-portrait:foreign:request:hash"
	jobs.mu.Unlock()
	if foundryCall(t, m, "GET", "v1/actors/portraits/"+id, nil).Code != 404 {
		t.Fatal("foreign job exposed")
	}
	input["recordKey"] = "monster:missing"
	if foundryCall(t, m, "POST", "v1/actors/portraits", input).Code != 404 {
		t.Fatal("foreign actor accepted")
	}
}
