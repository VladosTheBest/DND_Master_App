package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"testing"
)

func TestQuestAppearancePersistenceAndPartialUpdates(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	campaign, err := store.createCampaignForUser("owner", createCampaignInput{Title: "Synthetic quest"})
	if err != nil {
		t.Fatal(err)
	}
	style := &questAppearance{TextColor: "#EEE5FF", BackgroundColor: "#302b40", AccentColor: "#B4A5ED", Density: "compact"}
	created, err := store.createEntity(campaign.ID, createEntityInput{Kind: "quest", Title: "Quest", Content: "Full script", QuestAppearance: style})
	if err != nil {
		t.Fatal(err)
	}
	expected := &questAppearance{TextColor: "#eee5ff", BackgroundColor: "#302b40", AccentColor: "#b4a5ed", Density: "compact"}
	if !reflect.DeepEqual(created.Entity.QuestAppearance, expected) || style.TextColor != "#EEE5FF" {
		t.Fatal("normalization or input mutation")
	}
	var patch createEntityInput
	payload := map[string]any{"kind": "quest", "expectedRevision": created.Entity.Revision, "summary": "Changed synopsis"}
	raw, _ := json.Marshal(payload)
	if patch, err = readEntityUpdate(httptest.NewRequest(http.MethodPatch, "/", bytes.NewReader(raw))); err != nil {
		t.Fatal(err)
	}
	updated, err := store.updateEntity(campaign.ID, created.Entity.ID, patch)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(updated.Entity.QuestAppearance, expected) || updated.Entity.Content != "Full script" {
		t.Fatal("partial update lost sibling fields")
	}
	if _, err = store.updateEntity(campaign.ID, created.Entity.ID, patch); err == nil {
		t.Fatal("stale update accepted")
	}
	reloaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := reloaded.getCampaign(campaign.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(saved.Quests[0].QuestAppearance, expected) {
		t.Fatal("JSON restart lost style")
	}
	meta, records, err := splitCloudState(store.data)
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
			found = true
			if !reflect.DeepEqual(c.Quests[0].QuestAppearance, expected) {
				t.Fatal("JSONB lost style")
			}
		}
	}
	if !found {
		t.Fatal("campaign missing")
	}
	rev := updated.Entity.Revision
	cleared, err := store.updateEntity(campaign.ID, created.Entity.ID, createEntityInput{Kind: "quest", ExpectedRevision: &rev, QuestAppearance: &questAppearance{}})
	if err != nil {
		t.Fatal(err)
	}
	if cleared.Entity.QuestAppearance == nil || *cleared.Entity.QuestAppearance != (questAppearance{}) {
		t.Fatal("explicit reset failed")
	}
	invalid := sanitizeQuestAppearance("quest", &questAppearance{TextColor: "red", BackgroundColor: "url(x)", AccentColor: "#123456;display:none", Density: "giant"})
	if invalid == nil || *invalid != (questAppearance{}) {
		t.Fatal("unsafe style accepted")
	}
	if sanitizeQuestAppearance("npc", style) != nil {
		t.Fatal("quest-only style leaked")
	}
}
