package httpapi

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestChatDraftApplyAtomicAndIdempotent(t *testing.T) {
	kinds := []string{"npc", "location", "player", "monster", "quest", "lore", "event", "shop", "sessionPrep"}
	for _, kind := range kinds {
		t.Run(kind, func(t *testing.T) {
			drafts, err := prepareChatDrafts([]chatDraft{{Kind: kind, Title: "Synthetic", Summary: "Summary", Content: "## Details\nComplete description"}})
			if err != nil {
				t.Fatal(err)
			}
			store := &campaignStore{path: filepath.Join(t.TempDir(), "store.json"), data: storageState{Campaigns: []campaignData{{ID: "c", OwnerID: "u"}}, AIChatTurns: []aiChatTurn{{ID: "turn", OwnerID: "u", CampaignID: "c", Drafts: drafts}}}}
			srv := &server{store: store}
			call := func(user, origin string) *httptest.ResponseRecorder {
				body, _ := json.Marshal(map[string]string{"turnId": "turn", "draftId": drafts[0].ID})
				r := httptest.NewRequest("POST", "http://localhost/api/campaigns/c/ai/chat/drafts/apply", strings.NewReader(string(body)))
				r.Header.Set("Content-Type", "application/json")
				r.Header.Set("Origin", origin)
				w := httptest.NewRecorder()
				srv.handleChatDraftApply(w, r, authUser{ID: user}, "c")
				return w
			}
			if w := call("other", "http://localhost"); w.Code != 404 {
				t.Fatal("foreign access", w.Code)
			}
			if w := call("u", "https://evil.invalid"); w.Code != 403 {
				t.Fatal("origin accepted", w.Code)
			}
			store.atomicFileReplace = func(string, string) error { return errors.New("injected write failure") }
			if w := call("u", "http://localhost"); w.Code != 500 {
				t.Fatal("save failure not returned", w.Code)
			}
			if store.data.AIChatTurns[0].Drafts[0].CreatedID != "" || store.data.Campaigns[0].Revision != 0 {
				t.Fatal("failed mutation not rolled back")
			}
			store.atomicFileReplace = nil
			if w := call("u", "http://localhost"); w.Code != 200 {
				t.Fatal(w.Body.String())
			}
			saved := store.data.AIChatTurns[0].Drafts[0].CreatedID
			if saved == "" || store.data.Campaigns[0].Revision != 1 {
				t.Fatal("missing mutation")
			}
			if w := call("u", "http://localhost"); w.Code != 200 {
				t.Fatal(w.Body.String())
			}
			if store.data.AIChatTurns[0].Drafts[0].CreatedID != saved || store.data.Campaigns[0].Revision != 1 {
				t.Fatal("duplicate creation")
			}
			restored, err := newCampaignStore(store.path)
			if err != nil || restored.data.AIChatTurns[0].Drafts[0].CreatedID != saved {
				t.Fatal("draft state lost", err)
			}
			meta, records, err := splitCloudState(store.data)
			if err != nil {
				t.Fatal(err)
			}
			roundtrip, err := joinCloudState(meta, records)
			if err != nil || roundtrip.AIChatTurns[0].Drafts[0].CreatedID != saved {
				t.Fatal("cloud codec lost draft", err)
			}
		})
	}
}

func TestChatDraftValidation(t *testing.T) {
	for _, draft := range []chatDraft{{Kind: "account", Title: "Bad", Content: "Bad"}, {Kind: "npc", Title: "", Content: "Text"}, {Kind: "npc", Title: "Title", Content: ""}} {
		if _, err := prepareChatDrafts([]chatDraft{draft}); err == nil {
			t.Fatal("invalid draft accepted")
		}
	}
	draft, err := prepareChatDrafts([]chatDraft{{ID: "untrusted", CreatedID: "untrusted", Kind: "npc", Title: "Test", Content: "Test"}})
	if err != nil || draft[0].ID == "untrusted" || draft[0].CreatedID != "" {
		t.Fatal("trusted model IDs")
	}
}

func TestChatDraftEditRollback(t *testing.T) {
	store := &campaignStore{path: filepath.Join(t.TempDir(), "store.json"), data: storageState{
		Campaigns:   []campaignData{{ID: "c", OwnerID: "u"}},
		AIChatTurns: []aiChatTurn{{ID: "t", OwnerID: "u", CampaignID: "c", Drafts: []chatDraft{{ID: "d", Kind: "npc", Title: "Old", Content: "Original"}}}},
	}}
	srv := &server{store: store}
	call := func(origin, content string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"turnId": "t", "draftId": "d", "revision": 0, "title": "New", "content": content})
		r := httptest.NewRequest("POST", "http://localhost/api/campaigns/c/ai/chat/drafts/edit", strings.NewReader(string(body)))
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		srv.handleChatDraftEdit(w, r, authUser{ID: "u"}, "c")
		return w
	}
	if w := call("https://evil.invalid", "Updated"); w.Code != 403 {
		t.Fatal("origin", w.Code)
	}
	if w := call("http://localhost", ""); w.Code != 400 {
		t.Fatal("empty accepted", w.Code)
	}
	store.atomicFileReplace = func(string, string) error { return errors.New("injected") }
	if w := call("http://localhost", "Updated"); w.Code != 500 {
		t.Fatal("failure", w.Code)
	}
	if store.data.AIChatTurns[0].Drafts[0].Title != "Old" {
		t.Fatal("not rolled back")
	}
	store.atomicFileReplace = nil
	if w := call("http://localhost", "Updated"); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	restored, err := newCampaignStore(store.path)
	if err != nil || restored.data.AIChatTurns[0].Drafts[0].Content != "Updated" || restored.data.AIChatTurns[0].Drafts[0].Revision != 1 {
		t.Fatal("edit not persisted", err)
	}
	if len(store.data.Campaigns[0].NPCs) != 0 {
		t.Fatal("editing created entity")
	}
}
