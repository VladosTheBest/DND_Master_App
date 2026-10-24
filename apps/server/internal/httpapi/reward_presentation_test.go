package httpapi

import (
	"path/filepath"
	"reflect"
	"testing"
)

func TestRewardPresentationPersistsAndRejectsCSS(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	campaign, err := store.createCampaignForUser("owner", createCampaignInput{Title: "Synthetic color test"})
	if err != nil {
		t.Fatal(err)
	}
	profile := &monsterRewardProfile{Summary: "A key", TextColor: "#EEE5FF", BackgroundColor: "url(javascript:bad)", Loot: []monsterLootEntry{{Name: "Key", Quantity: "1", Check: "Investigation", DC: "14", TextColor: "#342a21", BackgroundColor: "#efe2c7"}}}
	created, err := store.createEntity(campaign.ID, createEntityInput{Kind: "npc", Title: "Keeper", RewardProfile: profile})
	if err != nil {
		t.Fatal(err)
	}
	got := created.Entity.RewardProfile
	if got.TextColor != "#eee5ff" || got.BackgroundColor != "" || got.Loot[0].BackgroundColor != "#efe2c7" || got.Loot[0].DC != "14" {
		t.Fatal("presentation or loot lost", got)
	}
	if profile.TextColor != "#EEE5FF" {
		t.Fatal("input mutated")
	}
	reloaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := reloaded.getCampaign(campaign.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(saved.NPCs[0].RewardProfile, got) {
		t.Fatal("restart lost presentation")
	}
	revision := created.Entity.Revision
	clear := &monsterRewardProfile{Summary: "No style", Loot: []monsterLootEntry{}}
	updated, err := reloaded.updateEntity(campaign.ID, created.Entity.ID, createEntityInput{Kind: "npc", ExpectedRevision: &revision, RewardProfile: clear})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Entity.RewardProfile.TextColor != "" || len(updated.Entity.RewardProfile.Loot) != 0 {
		t.Fatal("explicit clear failed")
	}
	if _, err = reloaded.updateEntity(campaign.ID, created.Entity.ID, createEntityInput{Kind: "npc", ExpectedRevision: &revision, RewardProfile: profile}); err == nil {
		t.Fatal("stale revision overwrote rewards")
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
			if !reflect.DeepEqual(c.NPCs[0].RewardProfile, got) {
				t.Fatal("JSONB split lost presentation")
			}
		}
	}
	if !found {
		t.Fatal("JSONB split lost campaign")
	}
	for _, bad := range []string{"red", "#123", "#12345678", "#000000;background:red", "url(x)"} {
		if safeRewardColor(bad) != "" {
			t.Fatal("accepted CSS", bad)
		}
	}
}
