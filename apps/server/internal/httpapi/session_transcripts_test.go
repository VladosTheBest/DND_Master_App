package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

const syntheticQuillText = "Quill — 2026-09-14T20-00-00-000Z_demo\n\nРасшифровка:\n[00:00:01.000–00:00:06.000] Арина: Проверяю мост.\n[00:00:04.000–00:00:08.000] Михаил: Ищу следы.\n[00:00:09.000–00:00:12.000] Арина: Нашла верёвку.\n"

func newSessionTestStore(t *testing.T) (*campaignStore, campaignData) {
	store, campaign := newOrdinaryMutationTestStore(t)
	store.mu.Lock()
	for i := range store.data.Campaigns {
		if store.data.Campaigns[i].ID == campaign.ID {
			store.data.Campaigns[i].OwnerID = "owner"
			campaign = store.data.Campaigns[i]
		}
	}
	err := store.saveLocked()
	store.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	return store, campaign
}

func TestSessionImportIsolationAndAnalysis(t *testing.T) {
	handler := newAccountTestServer(t)
	owner := registerAccountTestUser(t, handler, "session-owner")
	outsider := registerAccountTestUser(t, handler, "session-outsider")
	root := "/api/campaigns/campaign-shadow-edge/sessions"
	body, _ := json.Marshal(map[string]string{"title": "Первый вечер", "text": syntheticQuillText})
	for _, cookie := range [][]*http.Cookie{nil, outsider} {
		result := accountTestRequest(t, handler, "POST", root, string(body), cookie)
		if result.Code != 401 && result.Code != 404 {
			t.Fatalf("unauthorized status %d", result.Code)
		}
	}
	created := accountTestRequest(t, handler, "POST", root, string(body), owner)
	if created.Code != 201 {
		t.Fatal(created.Body.String())
	}
	imported := decodeAccountTestData[struct {
		Session   importedSession `json:"session"`
		Duplicate bool            `json:"duplicate"`
	}](t, created)
	session := imported.Session
	if session.Number != 1 || session.Text != syntheticQuillText || len(session.Participants) != 2 || session.SourceID == "" {
		t.Fatalf("bad import: %v", session.Participants)
	}
	duplicate := accountTestRequest(t, handler, "POST", root, string(body), owner)
	if duplicate.Code != 200 || !strings.Contains(duplicate.Body.String(), `"duplicate":true`) {
		t.Fatal("duplicate import not deduplicated")
	}
	list := accountTestRequest(t, handler, "GET", root, "", owner)
	if list.Code != 200 || strings.Contains(list.Body.String(), "Проверяю мост") {
		t.Fatal("list must contain metadata only")
	}
	for _, method := range []string{"GET", "DELETE"} {
		if response := accountTestRequest(t, handler, method, root+"/"+session.ID, "", outsider); response.Code != 404 {
			t.Fatalf("outsider %s: %d", method, response.Code)
		}
	}
	analysis := sessionAnalysis{RunID: "run-demo", Digest: session.Digest, Summary: "Партия осмотрела мост.", Players: []sessionPlayerAnalysis{{Name: "Арина", Actions: []string{"Осмотрела мост."}}}, ProposalIDs: []string{}}
	analysisBody, _ := json.Marshal(analysis)
	analysisPath := root + "/" + session.ID + "/analysis"
	if response := accountTestRequest(t, handler, "PUT", analysisPath, string(analysisBody), outsider); response.Code != 404 {
		t.Fatal("outsider analysis allowed")
	}
	if response := accountTestRequest(t, handler, "PUT", analysisPath, string(analysisBody), owner); response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	analysis.Digest = "wrong"
	analysis.Summary = "Wrong replacement"
	analysisBody, _ = json.Marshal(analysis)
	if response := accountTestRequest(t, handler, "PUT", analysisPath, string(analysisBody), owner); response.Code != 409 {
		t.Fatal("stale analysis accepted")
	}
	detail := accountTestRequest(t, handler, "GET", root+"/"+session.ID, "", owner)
	if !strings.Contains(detail.Body.String(), "Партия осмотрела мост.") || strings.Contains(detail.Body.String(), "Wrong replacement") {
		t.Fatal("failed analysis erased good report")
	}
	if response := accountTestRequest(t, handler, "DELETE", root+"/"+session.ID, "", owner); response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	if response := accountTestRequest(t, handler, "GET", root+"/"+session.ID, "", owner); response.Code != 404 {
		t.Fatal("deleted session still visible")
	}
}

func TestSessionPersistenceAndFailedWrite(t *testing.T) {
	store, campaign := newSessionTestStore(t)
	session, err := parseImportedSession("Тест", syntheticQuillText)
	if err != nil {
		t.Fatal(err)
	}
	session.CampaignID = campaign.ID
	saved, _, err := store.importSession(session)
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatal(err)
	}
	got, ok := reopened.sessionForOwner("owner", campaign.ID, saved.ID)
	if !ok || got.Text != syntheticQuillText {
		t.Fatal("session lost on restart")
	}
	store.atomicFileWrite = func(string, []byte, os.FileMode) error { return errors.New("synthetic disk failure") }
	other, _ := parseImportedSession("Другая", syntheticQuillText+"\nЕщё реплика")
	other.CampaignID = campaign.ID
	if _, _, err := store.importSession(other); err == nil {
		t.Fatal("write should fail")
	}
	if len(store.data.ImportedSessions) != 1 {
		t.Fatal("failed save left in-memory mutation")
	}
}

func TestSessionInputAndVerifiedAnalysis(t *testing.T) {
	for _, text := range []string{"", "\x00binary", strings.Repeat("a", maxSessionTextBytes+1)} {
		if _, err := parseImportedSession("Игра", text); err == nil {
			t.Fatal("invalid text accepted")
		}
	}
	store, campaign := newSessionTestStore(t)
	session, _ := parseImportedSession("Игра", syntheticQuillText)
	session.CampaignID = campaign.ID
	session, _, _ = store.importSession(session)
	srv := &server{store: store}
	analysis := sessionAnalysis{RunID: "fresh-run", Digest: session.Digest, Summary: "Итог", ProposalIDs: []string{}}
	payload, _ := json.Marshal(analysis)
	recorder := httptest.NewRecorder()
	srv.handleSessionAnalysis(recorder, httptest.NewRequest("PUT", "/", strings.NewReader(string(payload))), "owner", campaign.ID, session.ID)
	if recorder.Code != 200 {
		t.Fatal(recorder.Body.String())
	}
	manager := &codexBridgeManager{auth: &authManager{store: store}}
	input := codexPromptInput{CampaignID: campaign.ID, SessionID: session.ID, SessionRunID: "fresh-run"}
	if result, ok := manager.verifiedCodexPromptResult("owner", campaign.ID, nil, codexTurnObservation{}, nil, "thread", "turn", "completed", "", input); !ok || result.SessionID != session.ID {
		t.Fatal("persisted analysis not verified")
	}
	input.SessionRunID = "different-run"
	if _, ok := manager.verifiedCodexPromptResult("owner", campaign.ID, nil, codexTurnObservation{}, nil, "thread", "turn", "completed", "", input); ok {
		t.Fatal("old analysis incorrectly verifies new run")
	}
	if _, ok := manager.verifiedSessionAnalysis("outsider", input, "thread", "turn", "completed", ""); ok {
		t.Fatal("cross-owner analysis verified")
	}
}
