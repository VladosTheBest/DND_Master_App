package httpapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestCampaignStoreSaveLockedWritesBackup(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")

	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}

	if _, err := store.createCampaign(createCampaignInput{
		Title:       "Persistent backup",
		System:      "D&D 5e",
		SettingName: "Test world",
		InWorldDate: "1 Hammer, 1492 DR",
		Summary:     "Save me",
	}); err != nil {
		t.Fatalf("createCampaign() error = %v", err)
	}

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected primary store file to exist: %v", err)
	}
	if _, err := os.Stat(path + ".bak"); err != nil {
		t.Fatalf("expected backup store file to exist: %v", err)
	}
}

func TestCampaignStoreLoadsBackupWhenPrimaryMissing(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")

	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}

	created, err := store.createCampaign(createCampaignInput{
		Title:       "Recovered from backup",
		System:      "D&D 5e",
		SettingName: "Persistence world",
		InWorldDate: "17 Nightal, 1492 DR",
		Summary:     "Needs recovery",
	})
	if err != nil {
		t.Fatalf("createCampaign() error = %v", err)
	}

	if err := os.Remove(path); err != nil {
		t.Fatalf("os.Remove(primary) error = %v", err)
	}

	reloaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatalf("newCampaignStore(reload) error = %v", err)
	}

	found := false
	for _, campaign := range reloaded.listCampaigns() {
		if campaign.ID == created.ID && campaign.Title == created.Title {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected campaign %q to be restored from backup", created.Title)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("expected primary store file to be recreated: %v", err)
	}
	var state storageState
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("expected recreated primary store file to be valid json: %v", err)
	}
}

func TestCampaignStoreLoadsBackupWhenPrimaryCorrupted(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")

	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}

	created, err := store.createCampaign(createCampaignInput{
		Title:       "Recovered from corrupt primary",
		System:      "D&D 5e",
		SettingName: "Persistence world",
		InWorldDate: "17 Nightal, 1492 DR",
		Summary:     "Needs recovery from corruption",
	})
	if err != nil {
		t.Fatalf("createCampaign() error = %v", err)
	}

	if err := os.WriteFile(path, []byte("{invalid-json"), 0o644); err != nil {
		t.Fatalf("os.WriteFile(corrupt primary) error = %v", err)
	}

	reloaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatalf("newCampaignStore(reload) error = %v", err)
	}

	found := false
	for _, campaign := range reloaded.listCampaigns() {
		if campaign.ID == created.ID && campaign.Title == created.Title {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected campaign %q to be restored from backup", created.Title)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("expected repaired primary store file to exist: %v", err)
	}
	var state storageState
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("expected repaired primary store file to be valid json: %v", err)
	}
}
