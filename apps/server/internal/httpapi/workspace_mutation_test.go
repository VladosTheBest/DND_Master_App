package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWorkspaceEntityEditIncludesUpdatedRecordInDelta(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "delta-editor")
	c := decodeAccountTestData[campaignData](t, itemsRequest(t, handler, "POST", "/api/campaigns", map[string]any{"title": "Delta editor", "system": "5e"}, cookies))
	created := decodeAccountTestData[createEntityResult](t, itemsRequest(t, handler, "POST", "/api/campaigns/"+c.ID+"/entities", map[string]any{"kind": "npc", "title": "Before", "content": "Old"}, cookies))
	for _, content := range []string{"First save", "Second save"} {
		body, _ := json.Marshal(map[string]any{"kind": "npc", "title": "After", "content": content, "expectedRevision": created.Entity.Revision})
		r := httptest.NewRequest(http.MethodPatch, "/api/campaigns/"+c.ID+"/entities/"+created.Entity.ID, strings.NewReader(string(body)))
		r.Header.Set("Origin", "http://example.com")
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Workspace-View", "compact")
		for _, cookie := range cookies {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		type deltaResult struct {
			Entity   knowledgeEntity `json:"entity"`
			Campaign struct {
				Base        int `json:"__baseRevision"`
				Collections map[string]struct {
					Upsert []knowledgeEntity `json:"upsert"`
				} `json:"__collections"`
			} `json:"campaign"`
		}
		result := decodeAccountTestData[deltaResult](t, w)
		patch := result.Campaign.Collections["npcs"].Upsert
		if len(patch) != 1 || patch[0].Content != content || patch[0].Revision != created.Entity.Revision+1 || result.Campaign.Base != created.Campaign.Revision {
			t.Fatalf("saved entity disappeared from delta: %s", w.Body.String())
		}
		created.Entity = result.Entity
		created.Campaign.Revision++
	}
}

func TestWorkspaceBaselineDoesNotAliasMutableAuthoringSlices(t *testing.T) {
	store, _ := newOrdinaryMutationTestStore(t)
	c, err := store.createCampaignForUser("owner", createCampaignInput{Title: "Snapshot", System: "5e"})
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.createEntity(c.ID, createEntityInput{Kind: "location", Title: "Before"})
	if err != nil {
		t.Fatal(err)
	}
	before, err := store.workspaceBaseline("owner", c.ID)
	if err != nil {
		t.Fatal(err)
	}
	revision := created.Entity.Revision
	_, err = store.updateEntity(c.ID, created.Entity.ID, createEntityInput{Kind: "location", Title: "After", ExpectedRevision: &revision})
	if err != nil {
		t.Fatal(err)
	}
	if before.Locations[len(before.Locations)-1].Title != "Before" {
		t.Fatal("snapshot changed with storage")
	}
}

func TestFullEntityEditorCanExplicitlyClearRewards(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "reward-editor")
	c := decodeAccountTestData[campaignData](t, itemsRequest(t, handler, "POST", "/api/campaigns", map[string]any{"title": "Reward editor", "system": "5e"}, cookies))
	created := decodeAccountTestData[createEntityResult](t, itemsRequest(t, handler, "POST", "/api/campaigns/"+c.ID+"/entities", map[string]any{"kind": "monster", "title": "Guard", "rewardProfile": map[string]any{"summary": "Key", "loot": []any{map[string]any{"name": "Key", "category": "Loot", "quantity": "1", "check": "None"}}}}, cookies))
	response := itemsRequest(t, handler, "PATCH", "/api/campaigns/"+c.ID+"/entities/"+created.Entity.ID, map[string]any{"kind": "monster", "title": "Guard", "expectedRevision": created.Entity.Revision, "rewardProfile": map[string]any{"summary": "", "loot": []any{}}}, cookies)
	if response.Code != 200 {
		t.Fatal(response.Code, response.Body.String())
	}
	updated := decodeAccountTestData[createEntityResult](t, response)
	if updated.Entity.RewardProfile != nil && (updated.Entity.RewardProfile.Summary != "" || len(updated.Entity.RewardProfile.Loot) != 0) {
		t.Fatal("empty reward document retained old loot")
	}
}
