package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestFoundryWizardSnapshotResolvesCurrentBookAndPreparation(t *testing.T) {
	var draft characterDraft
	for _, f := range characterRules.ValidationFixtures {
		if f.Valid && f.Name == "2024 wizard 5 human soldier" {
			draft = f.Draft
			break
		}
	}
	if len(draft.Levels) == 0 {
		t.Fatal("missing wizard fixture")
	}
	selection := foundryWizardSpells(draft)
	if !characterHas(selection.Known, "continual-flame-2024") || !characterHas(selection.Known, "fireball-2024") {
		t.Fatal("subclass book grants missing")
	}
	if !reflect.DeepEqual(selection.Prepared, draft.Levels[4].PreparedSpellIDs) {
		t.Fatal("preparation is not current")
	}
	sheet := characterSheet{ID: "wizard", Draft: draft}
	state := storageState{CharacterSheets: []storedCharacterSheet{{Sheet: sheet, CampaignID: "campaign"}}}
	records, _ := foundryRecords(state, "campaign")
	var imported foundryCharacterSheet
	if len(records) != 1 || json.Unmarshal(records[0].Data, &imported) != nil || imported.SpellSelection == nil {
		t.Fatal("snapshot lost selection")
	}
	spells := foundrySpells(records)
	seen := map[string]bool{}
	for _, spell := range spells {
		seen[spell.ID] = true
	}
	if !seen["continual-flame-2024"] {
		t.Fatal("unprepared bonus book spell missing from snapshot catalog")
	}
}

func foundryFixture(t *testing.T) (*foundryManager, foundryConnection) {
	t.Helper()
	auth, s := newTestAuthManager(t, AuthOptions{Username: "foundry-gm", Password: "test-password"})
	user := s.data.Users[0]
	c, e := s.createCampaignForUser(user.ID, createCampaignInput{Title: "Integration fixture"})
	if e != nil {
		t.Fatal(e)
	}
	grant := foundryConnection{ID: "connection-test", OwnerID: user.ID, CampaignID: c.ID, Origin: "http://localhost:30000", TokenHash: foundryTokenHash(strings.Repeat("a", 64))}
	s.mu.Lock()
	s.data.FoundryConnections = append(s.data.FoundryConnections, grant)
	if e = s.saveLocked(); e != nil {
		t.Fatal(e)
	}
	s.mu.Unlock()
	return newFoundryManager(&server{store: s, auth: auth}), grant
}
func foundryCall(t *testing.T, m *foundryManager, method, action string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var data []byte
	if body != nil {
		data, _ = json.Marshal(body)
	}
	r := httptest.NewRequest(method, foundryPrefix+action, bytes.NewReader(data))
	r.Header.Set("Origin", "http://localhost:30000")
	r.Header.Set("Authorization", "Bearer "+strings.Repeat("a", 64))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	m.handle(w, r)
	return w
}
func TestFoundryExchangePreviewCommitConflictAndReplay(t *testing.T) {
	m, c := foundryFixture(t)
	s := m.srv.store
	body, _ := json.Marshal(knowledgeEntity{Kind: "npc", Title: "Imported NPC", Content: "GM text"})
	input := foundryExport{RequestID: "request-for-test-0001", Changes: []foundryChange{{Key: "Actor.new", Kind: "npc", Data: body}}}
	if w := foundryCall(t, m, "POST", "v1/export/commit", input); w.Code != 409 {
		t.Fatalf("commit without preview %d", w.Code)
	}
	w := foundryCall(t, m, "POST", "v1/export/preview", input)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"canCommit":true`) {
		t.Fatalf("preview %d %s", w.Code, w.Body)
	}
	w = foundryCall(t, m, "POST", "v1/export/commit", input)
	if w.Code != 200 {
		t.Fatalf("commit %d %s", w.Code, w.Body)
	}
	if w = foundryCall(t, m, "POST", "v1/export/commit", input); w.Code != 200 || !strings.Contains(w.Body.String(), `"replayed":true`) {
		t.Fatalf("replay %d %s", w.Code, w.Body)
	}
	second := input
	second.RequestID = "different-request-0001"
	if w = foundryCall(t, m, "POST", "v1/export/preview", second); !strings.Contains(w.Body.String(), `"canCommit":false`) {
		t.Fatal("new request overwrote an existing deterministic ID")
	}
	s.mu.RLock()
	records, _ := foundryRecords(s.data, c.CampaignID)
	s.mu.RUnlock()
	if len(records) != 1 {
		t.Fatalf("duplicates: %d", len(records))
	}
	record := records[0]
	var entity knowledgeEntity
	_ = json.Unmarshal(record.Data, &entity)
	entity.Title = "Changed in Foundry"
	body, _ = json.Marshal(entity)
	input = foundryExport{RequestID: "request-for-test-0002", Changes: []foundryChange{{Key: "Actor.new", ID: record.ID, Kind: "npc", BaseHash: "stale", Data: body}}}
	w = foundryCall(t, m, "POST", "v1/export/preview", input)
	if !strings.Contains(w.Body.String(), `"status":"conflict"`) {
		t.Fatalf("no conflict %s", w.Body)
	}
	input.Changes[0].BaseHash = record.Hash
	_ = foundryCall(t, m, "POST", "v1/export/preview", input)
	s.mu.Lock()
	s.data.Campaigns[len(s.data.Campaigns)-1].NPCs[0].Title = "Concurrent site edit"
	s.mu.Unlock()
	if w = foundryCall(t, m, "POST", "v1/export/commit", input); w.Code != 409 {
		t.Fatalf("stale preview commit %d", w.Code)
	}
}
func TestFoundryScopeRevocationAndProjection(t *testing.T) {
	m, c := foundryFixture(t)
	s := m.srv.store
	s.mu.Lock()
	for i := range s.data.Campaigns {
		if s.data.Campaigns[i].ID == c.CampaignID {
			s.data.Campaigns[i].PlayerDisplayToken = "DO-NOT-EXPORT"
		}
	}
	s.mu.Unlock()
	w := foundryCall(t, m, "GET", "v1/snapshot", nil)
	if w.Code != 200 || strings.Contains(w.Body.String(), "DO-NOT-EXPORT") || strings.Contains(w.Body.String(), "tokenHash") {
		t.Fatalf("unsafe projection %d", w.Code)
	}
	r := httptest.NewRequest("GET", foundryPrefix+"v1/snapshot", nil)
	r.Header.Set("Authorization", "Bearer "+strings.Repeat("a", 64))
	r.Header.Set("Origin", "https://foreign.example")
	w = httptest.NewRecorder()
	m.handle(w, r)
	if w.Code != 401 {
		t.Fatalf("foreign origin %d", w.Code)
	}
	s.mu.Lock()
	s.data.FoundryConnections = nil
	s.mu.Unlock()
	if w = foundryCall(t, m, "GET", "v1/snapshot", nil); w.Code != 401 {
		t.Fatalf("revoked grant %d", w.Code)
	}
}
func TestFoundryPersistenceAndCloudCodec(t *testing.T) {
	m, c := foundryFixture(t)
	s := m.srv.store
	s.mu.Lock()
	s.data.Campaigns[len(s.data.Campaigns)-1].SessionMaps = []sessionMapDocument{{ID: "map-1", Title: "Map", Revision: 1, Levels: []sessionMapLevelDocument{{ID: "level", ImageURL: "/uploads/test/map.png", Width: 100, Height: 100}}}}
	if e := s.saveLocked(); e != nil {
		t.Fatal(e)
	}
	meta, records, e := splitCloudState(s.data)
	s.mu.Unlock()
	if e != nil {
		t.Fatal(e)
	}
	restored, e := joinCloudState(meta, records)
	if e != nil {
		t.Fatal(e)
	}
	if len(restored.FoundryConnections) != 1 || restored.FoundryConnections[0].CampaignID != c.CampaignID || len(restored.Campaigns[len(restored.Campaigns)-1].SessionMaps) != 1 {
		t.Fatal("codec lost integration state")
	}
	loaded, e := newCampaignStore(s.path)
	if e != nil {
		t.Fatal(e)
	}
	if len(loaded.data.FoundryConnections) != 1 {
		t.Fatal("restart lost connection")
	}
}
func TestFoundryPairingApprovalAndNoCookieBypass(t *testing.T) {
	m, c := foundryFixture(t)
	m.srv.store.data.FoundryConnections = nil
	w := foundryCall(t, m, "POST", "pairings", map[string]string{"tokenHash": c.TokenHash})
	if w.Code != 201 {
		t.Fatalf("begin %d %s", w.Code, w.Body)
	}
	var b struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &b)
	w = foundryCall(t, m, "POST", "pairings/"+b.Data.ID+"/approve", map[string]string{"campaignId": c.CampaignID})
	if w.Code != 401 {
		t.Fatalf("bearer approved %d", w.Code)
	}
	login := httptest.NewRecorder()
	m.srv.auth.handleLogin(login, httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"username":"foundry-gm","password":"test-password"}`)))
	raw, _ := json.Marshal(map[string]string{"campaignId": c.CampaignID})
	r := httptest.NewRequest("POST", foundryPrefix+"pairings/"+b.Data.ID+"/approve", bytes.NewReader(raw))
	r.AddCookie(login.Result().Cookies()[0])
	r.Header.Set("Origin", "http://example.com")
	w = httptest.NewRecorder()
	m.handle(w, r)
	if w.Code != 200 {
		t.Fatalf("approve %d %s", w.Code, w.Body)
	}
	if w = foundryCall(t, m, "GET", "v1/snapshot", nil); w.Code != 200 {
		t.Fatalf("grant unavailable %d", w.Code)
	}
}
func TestFoundryAtomicFailureAndMediaValidation(t *testing.T) {
	m, c := foundryFixture(t)
	s := m.srv.store
	if foundryOwnedURL("/uploads/other/campaign/a.png", c) || foundryOwnedURL("https://remote.example/a.png", c) || foundryOwnedURL("/uploads/a/../b.png", c) {
		t.Fatal("unsafe media accepted")
	}
	body, _ := json.Marshal(knowledgeEntity{Kind: "npc", Title: "NPC"})
	input := foundryExport{RequestID: "failed-request-0001", Changes: []foundryChange{{Key: "Actor.test", Kind: "npc", Data: body}}}
	_ = foundryCall(t, m, "POST", "v1/export/preview", input)
	s.atomicFileReplace = func(string, string) error { return fmtError("disk unavailable") }
	w := foundryCall(t, m, "POST", "v1/export/commit", input)
	if w.Code != 500 {
		t.Fatalf("expected save failure, got %d", w.Code)
	}
	s.mu.RLock()
	records, _ := foundryRecords(s.data, c.CampaignID)
	s.mu.RUnlock()
	if len(records) != 0 || len(s.data.FoundryReceipts) != 0 {
		t.Fatal("failed commit changed memory")
	}
}

type fmtError string

func (e fmtError) Error() string { return string(e) }

func TestFoundryStructuredMechanicsPersistAndValidate(t *testing.T) {
	m, c := foundryFixture(t)
	profile := &foundryMechanics{Kind: "save", Activation: "reaction", Range: 30, SaveAbility: "dex", SaveDC: 15, SaveDamage: "half", DamageType: "fire"}
	entity := knowledgeEntity{Kind: "npc", Title: "Breath", StatBlock: &npcStatBlock{Actions: []statBlockEntry{{Name: "Breath", Damage: "4d6 fire", Foundry: profile}}}}
	data, _ := json.Marshal(entity)
	input := foundryExport{RequestID: "structured-profile-0001", Changes: []foundryChange{{Key: "Actor.profile", Kind: "npc", Data: data}}}
	if w := foundryCall(t, m, "POST", "v1/export/preview", input); !strings.Contains(w.Body.String(), `"canCommit":true`) {
		t.Fatal(w.Body.String())
	}
	if w := foundryCall(t, m, "POST", "v1/export/commit", input); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	campaign, _ := m.srv.store.getCampaignForUser(c.OwnerID, c.CampaignID)
	npc := campaign.NPCs[0]
	if _, err := m.srv.store.updateEntity(c.CampaignID, npc.ID, createEntityInput{Kind: "npc", Title: "Renamed", StatBlock: npc.StatBlock}); err != nil {
		t.Fatal(err)
	}
	loaded, err := newCampaignStore(m.srv.store.path)
	if err != nil {
		t.Fatal(err)
	}
	saved, _ := loaded.getCampaignForUser(c.OwnerID, c.CampaignID)
	if p := saved.NPCs[0].StatBlock.Actions[0].Foundry; p == nil || *p != *profile {
		t.Fatal("profile lost after CRUD/restart")
	}
	for _, bad := range []foundryMechanics{{Kind: "script"}, {Kind: "save", SaveAbility: "eval"}, {Kind: "attack", Range: -1}, {Kind: "heal", DamageType: "macro"}} {
		if validateFoundryMechanics(&bad) == nil {
			t.Fatal("invalid profile accepted")
		}
	}
}

func TestFoundryDistributionUsesServerRouting(t *testing.T) {
	if !isServerManagedPath("/foundry/connect") || !isServerManagedPath("/foundry/module.json") {
		t.Fatal("Foundry endpoints would be intercepted by SPA")
	}
	m, _ := foundryFixture(t)
	web := t.TempDir()
	m.srv.webDir = web
	m.srv.shares = &initiativeShareManager{configuredBase: "https://example.test"}
	if err := os.Mkdir(filepath.Join(web, "foundry"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(web, "foundry", "module.json"), []byte(`{"id":"shadow-edge-gm"}`), 0600); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	m.distribution(w, httptest.NewRequest("GET", "https://example.test/foundry/module.json", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `https://example.test/foundry/shadow-edge-gm.zip`) {
		t.Fatalf("distribution %d %s", w.Code, w.Body)
	}
	if err := os.WriteFile(filepath.Join(web, "foundry", "shadow-edge-gm.zip"), []byte("ZIP fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	w = httptest.NewRecorder()
	m.distribution(w, httptest.NewRequest("GET", "https://example.test/foundry/shadow-edge-gm.zip", nil))
	if w.Code != 200 || w.Body.String() != "ZIP fixture" {
		t.Fatal("module download failed")
	}
}

func TestFoundryPublicHTTPRoutesBypassSPAFallback(t *testing.T) {
	root := t.TempDir()
	web := filepath.Join(root, "web")
	if err := os.MkdirAll(filepath.Join(web, "foundry"), 0700); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{"index.html": "SPA fallback", "foundry/module.json": `{"id":"shadow-edge-gm"}`, "foundry/shadow-edge-gm.zip": "ZIP fixture"} {
		if err := os.WriteFile(filepath.Join(web, filepath.FromSlash(name)), []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "state.json"), UploadDir: filepath.Join(root, "uploads"), WebDir: web, PublicBaseURL: "https://example.test"})
	if err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]string{"/foundry/connect": "Подключение Foundry", "/foundry/module.json": "https://example.test/foundry/shadow-edge-gm.zip", "/foundry/shadow-edge-gm.zip": "ZIP fixture"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 || !strings.Contains(w.Body.String(), want) {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body)
		}
	}
	r := httptest.NewRequest("POST", foundryPrefix+"pairings", strings.NewReader(`{"tokenHash":"`+foundryTokenHash(strings.Repeat("a", 64))+`"}`))
	r.Header.Set("Origin", "http://localhost:30000")
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 201 {
		t.Fatalf("pairing behind middleware: %d %s", w.Code, w.Body)
	}
}

func TestFoundryWorldMapUpdatePreservesPrivateGenerationData(t *testing.T) {
	m, c := foundryFixture(t)
	s := m.srv.store
	s.mu.Lock()
	ci := len(s.data.Campaigns) - 1
	s.data.Campaigns[ci].WorldMaps = []worldMapDocument{{ID: "map", Title: "Map", Prompt: "Private prompt", Provider: "provider", ReferenceURL: "private", Revision: 1}}
	records, _ := foundryRecords(s.data, c.CampaignID)
	s.mu.Unlock()
	r := records[0]
	var data worldMapDocument
	_ = json.Unmarshal(r.Data, &data)
	data.Title = "Renamed"
	body, _ := json.Marshal(data)
	input := foundryExport{RequestID: "world-map-update-0001", Changes: []foundryChange{{Key: "Scene.map", Kind: "world-map", ID: r.ID, BaseHash: r.Hash, Data: body}}}
	if w := foundryCall(t, m, "POST", "v1/export/preview", input); !strings.Contains(w.Body.String(), `"canCommit":true`) {
		t.Fatal(w.Body.String())
	}
	if w := foundryCall(t, m, "POST", "v1/export/commit", input); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	v := s.data.Campaigns[ci].WorldMaps[0]
	if v.Title != "Renamed" || v.Prompt != "Private prompt" || v.Provider != "provider" || v.ReferenceURL != "private" {
		t.Fatal("authoring export destroyed private metadata")
	}
}

func TestSessionMapCRUDRevisionAndPersistence(t *testing.T) {
	m, c := foundryFixture(t)
	s := m.srv.store
	user := s.data.Users[0]
	campaign, _ := s.getCampaignForUser(user.ID, c.CampaignID)
	input := sessionMapDocument{Title: "Floor", Levels: []sessionMapLevelDocument{{ID: "floor", Name: "Floor", ImageURL: "/uploads/" + sanitizeUploadPathSegment(c.OwnerID) + "/" + sanitizeUploadPathSegment(c.CampaignID) + "/map.png", Width: 1000, Height: 500}}}
	call := func(method string, parts []string, v sessionMapDocument) *httptest.ResponseRecorder {
		body, _ := json.Marshal(v)
		w := httptest.NewRecorder()
		m.srv.handleSessionMaps(w, httptest.NewRequest(method, "/", bytes.NewReader(body)), authUser{ID: user.ID}, campaign, parts)
		return w
	}
	w := call("POST", []string{c.CampaignID, "session-maps"}, input)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var response struct {
		Data sessionMapDocument `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &response)
	saved := response.Data
	if saved.ID == "" || saved.Revision != 1 {
		t.Fatal(w.Body.String())
	}
	parts := []string{c.CampaignID, "session-maps", saved.ID}
	saved.Title = "Edited"
	if w = call("PUT", parts, saved); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w = call("PUT", parts, saved); w.Code != 409 {
		t.Fatal("stale save accepted")
	}
	state, err := readStorageState(s.path)
	if err != nil || len(state.Campaigns[len(state.Campaigns)-1].SessionMaps) != 1 {
		t.Fatal("session map not persisted", err)
	}
	if w = call("DELETE", parts, saved); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
}
