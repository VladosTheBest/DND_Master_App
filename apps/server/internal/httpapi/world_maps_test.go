package httpapi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func mapFixturePNG() []byte {
	img := image.NewRGBA(image.Rect(0, 0, 120, 80))
	for y := 0; y < 80; y++ {
		for x := 0; x < 120; x++ {
			img.Set(x, y, color.RGBA{uint8(x * 2), uint8(y * 3), 90, 255})
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}
func mapFixturePlan() mapGenerationPlan {
	return mapGenerationPlan{Title: "Северный край", ImagePrompt: "Mountain coast and a settlement at the center. No lettering.", Labels: []mapPlanLabel{{Text: "Тихая гавань", X: .5, Y: .5}}}
}

func TestWorldMapAPIStorageAccessAndReference(t *testing.T) {
	t.Setenv("SHADOW_EDGE_IMAGE_OPTIMIZER", "off")
	calls, edits := 0, 0
	reference := mapFixturePNG()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "POST" || r.Header.Get("Authorization") != "Bearer test" {
			t.Error("bad API transport")
		}
		switch r.URL.Path {
		case "/chat/completions":
			b, _ := io.ReadAll(r.Body)
			if !bytes.Contains(b, []byte("NO")) && !bytes.Contains(b, []byte("prohibit")) {
				t.Error("missing no-lettering instruction")
			}
			plan, _ := json.Marshal(mapFixturePlan())
			_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(plan)}}}})
		case "/images/generations":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["model"] != "test-image" || body["n"] != float64(1) || !strings.Contains(body["prompt"].(string), "NO TEXT") {
				t.Error("image API contract")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]any{"b64_json": base64.StdEncoding.EncodeToString(reference)}}})
		case "/images/edits":
			edits++
			if r.ParseMultipartForm(1<<20) != nil {
				t.Fatal("invalid multipart")
			}
			defer r.MultipartForm.RemoveAll()
			file, _, err := r.FormFile("image[]")
			if err != nil {
				t.Fatal(err)
			}
			actual, _ := io.ReadAll(file)
			file.Close()
			if !bytes.Equal(actual, reference) || r.FormValue("model") != "test-image" {
				t.Error("reference bytes/model lost")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]any{"b64_json": base64.StdEncoding.EncodeToString(reference)}}})
		default:
			t.Error("unexpected upstream route")
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	file := filepath.Join(t.TempDir(), "store.json")
	store, err := newCampaignStore(file)
	if err != nil {
		t.Fatal(err)
	}
	account, _ := store.createUser("map-user", "password123")
	other, _ := store.createUser("map-other", "password123")
	campaign, _ := store.createCampaignForUser(account.ID, createCampaignInput{Title: "Maps"})
	otherCampaign, _ := store.createCampaignForUser(other.ID, createCampaignInput{Title: "Other"})
	for i := range store.data.Users {
		if store.data.Users[i].ID == account.ID {
			store.data.Users[i].Subscription = &accountSubscription{PlanID: "gm", Status: "active", CurrentPeriodStart: time.Now().Add(-time.Hour), CurrentPeriodEnd: time.Now().Add(time.Hour)}
		}
	}
	if err = store.saveLocked(); err != nil {
		t.Fatal(err)
	}
	uploads := t.TempDir()
	dir := filepath.Join(uploads, account.ID, campaign.ID)
	_ = os.MkdirAll(dir, 0700)
	_ = os.WriteFile(filepath.Join(dir, "ref.png"), reference, 0600)
	handler, err := NewServer(Options{DataFile: file, UploadDir: uploads, RequireSubscription: true, AI: AIOptions{Provider: "openai", BaseURL: upstream.URL, APIToken: "test", Model: "test", ImageModel: "test-image"}})
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, route, body, origin string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost"+route, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	cookie := call("POST", "/api/auth/login", `{"username":"map-user","password":"password123"}`, "http://localhost", nil).Result().Cookies()[0]
	otherCookie := call("POST", "/api/auth/login", `{"username":"map-other","password":"password123"}`, "http://localhost", nil).Result().Cookies()[0]
	base := "/api/campaigns/" + campaign.ID + "/world-maps"
	body := `{"requestId":"request-map-0000001","prompt":"Нарисуй мир","referenceUrl":""}`
	for _, test := range []struct {
		cookie *http.Cookie
		origin string
		status int
	}{{nil, "http://localhost", 401}, {otherCookie, "http://localhost", 404}, {cookie, "https://evil.invalid", 403}} {
		w := call("POST", base+"/generate", body, test.origin, test.cookie)
		if w.Code != test.status {
			t.Fatalf("access %d want %d: %s", w.Code, test.status, w.Body.String())
		}
	}
	w := call("POST", "/api/campaigns/"+otherCampaign.ID+"/world-maps/generate", body, "http://localhost", otherCookie)
	if w.Code != 402 || calls != 0 {
		t.Fatal("unsubscribed API was called", w.Code, calls)
	}
	w = call("POST", base+"/generate", body, "http://localhost", cookie)
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var result struct {
		Data worldMapDocument `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &result)
	if result.Data.Width != 120 || len(result.Data.Labels) != 1 || result.Data.Provider != "api" {
		t.Fatal("invalid map result")
	}
	w = call("POST", base+"/generate", body, "http://localhost", cookie)
	if w.Code != 200 || calls != 2 {
		t.Fatal("retry billed twice", w.Code, calls)
	}
	label := result.Data.Labels[0]
	label.Text = "Новая гавань"
	label.Rotation = 25
	label.Color = "#aabbcc"
	edit, _ := json.Marshal(map[string]any{"title": "Обновлённый край", "revision": 0, "labels": []worldMapLabel{label}})
	w = call("PUT", base+"/"+result.Data.ID, string(edit), "http://localhost", cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w = call("PUT", base+"/"+result.Data.ID, string(edit), "http://localhost", cookie); w.Code != 409 {
		t.Fatal("stale edit accepted")
	}
	if w = call("GET", base, "", "http://localhost", otherCookie); w.Code != 404 {
		t.Fatal("foreign maps visible")
	}
	body2, _ := json.Marshal(worldMapGenerateInput{RequestID: "request-map-0000002", ReferenceURL: "/uploads/" + account.ID + "/" + campaign.ID + "/ref.png"})
	if w = call("POST", base+"/generate", string(body2), "http://localhost", cookie); w.Code != 201 || edits != 1 {
		t.Fatal("reference failed", w.Body.String(), edits)
	}
	restored, err := newCampaignStore(file)
	if err != nil {
		t.Fatal(err)
	}
	saved, _ := restored.getCampaignForUser(account.ID, campaign.ID)
	if len(saved.WorldMaps) != 2 || saved.WorldMaps[0].Labels[0].Text != "Новая гавань" {
		t.Fatal("map/labels lost on reopen")
	}
	meta, records, err := splitCloudState(restored.data)
	if err != nil {
		t.Fatal(err)
	}
	joined, err := joinCloudState(meta, records)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range joined.Campaigns {
		if c.ID == campaign.ID {
			found = len(c.WorldMaps) == 2 && c.WorldMaps[0].Labels[0].Rotation == 25
		}
	}
	if !found {
		t.Fatal("SQL codec lost map")
	}
	before := calls
	for _, ref := range []string{"https://evil.invalid/file.png", "/uploads/" + other.ID + "/" + otherCampaign.ID + "/ref.png", "/uploads/" + account.ID + "/" + campaign.ID + "/../ref.png"} {
		b, _ := json.Marshal(worldMapGenerateInput{RequestID: "request-map-0000003", ReferenceURL: ref})
		w = call("POST", base+"/generate", string(b), "http://localhost", cookie)
		if w.Code != 400 {
			t.Fatal("unsafe reference accepted", w.Code)
		}
	}
	if calls != before {
		t.Fatal("invalid references reached API")
	}
	if kind, id := backgroundGenerationRoute(base + "/generate"); kind != "world-map" || id != campaign.ID || requiresGenerationSubscription(base+"/generate") {
		t.Fatal("map queue/provider gate mismatch")
	}
}

func TestWorldMapCodexImageIsolation(t *testing.T) {
	home := t.TempDir()
	root := filepath.Join(home, "generated_images")
	_ = os.MkdirAll(root, 0700)
	inside := filepath.Join(root, "map.png")
	_ = os.WriteFile(inside, mapFixturePNG(), 0600)
	plan := mapFixturePlan()
	plan.ImagePath = inside
	b, _ := json.Marshal(plan)
	result, err := readCodexWorldMap(home, string(b))
	if err != nil || len(result.Image) == 0 {
		t.Fatal("valid image rejected", err)
	}
	outside := filepath.Join(home, "secret.png")
	_ = os.WriteFile(outside, mapFixturePNG(), 0600)
	plan.ImagePath = outside
	b, _ = json.Marshal(plan)
	if _, err = readCodexWorldMap(home, string(b)); err == nil {
		t.Fatal("outside image accepted")
	}
	plan.ImagePath = "../secret.png"
	b, _ = json.Marshal(plan)
	if _, err = readCodexWorldMap(home, string(b)); err == nil {
		t.Fatal("traversal accepted")
	}
	plan.Labels[0].X = 2
	if validateMapPlan(plan) == nil {
		t.Fatal("outside coordinates accepted")
	}
	if _, _, err = mapImageConfig([]byte(`<svg></svg>`)); err == nil {
		t.Fatal("SVG allowed")
	}
}

func TestWorldMapCodexFirstWithoutSubscription(t *testing.T) {
	t.Setenv("GO_WANT_CODEX_BRIDGE_HELPER", "1")
	t.Setenv("SHADOW_EDGE_IMAGE_OPTIMIZER", "off")
	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatal(err)
	}
	account, _ := store.createUser("map-codex-user", "password123")
	campaign, _ := store.createCampaignForUser(account.ID, createCampaignInput{Title: "Map"})
	auth, err := newAuthManager(AuthOptions{SessionTTL: time.Hour}, store)
	if err != nil {
		t.Fatal(err)
	}
	manager := newCodexBridgeManager(CodexBridgeOptions{Enabled: true, Command: os.Args[0], Args: []string{"-test.run=TestCodexBridgeHelperProcess"}, HomeRoot: t.TempDir(), MCPCommand: os.Args[0], MCPArgs: []string{"fake-mcp"}, InternalBaseURL: "http://127.0.0.1:8080", RequestTimeout: 5 * time.Second, MaxUserProcesses: 2}, auth)
	user := authUser{ID: account.ID, Username: account.Username}
	defer manager.stopBridge(user.ID)
	if _, err = manager.startDeviceCode(context.Background(), user); err != nil {
		t.Fatal(err)
	}
	srv := &server{store: store, codex: manager, uploadDir: t.TempDir(), generator: newEntityGenerator(AIOptions{})}
	req := httptest.NewRequest("POST", "http://localhost/api/campaigns/"+campaign.ID+"/world-maps/generate", strings.NewReader(`{"requestId":"codex-map-request-001","prompt":"world-map-fixture","referenceUrl":""}`))
	req.Header.Set("Origin", "http://localhost")
	w := httptest.NewRecorder()
	srv.handleWorldMaps(w, req, user, campaign, "generate")
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var result struct {
		Data worldMapDocument `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &result)
	if result.Data.Provider != "codex" {
		t.Fatal("Codex priority lost")
	}
	bridge := manager.bridges[user.ID]
	entries, _ := os.ReadDir(filepath.Join(bridge.homeDir, "generated_images"))
	if len(entries) != 0 {
		t.Fatal("generated image scope not cleaned")
	}
	// Exercise actual localImage transfer and read-before-cleanup inside the turn.
	generated, err := srv.generateCodexWorldMap(context.Background(), user, campaign.ID, "world-map-fixture-reference", mapFixturePNG())
	if err != nil || len(generated.Image) == 0 {
		t.Fatal("reference turn", err)
	}
}
