package httpapi

import (
	"path/filepath"
	"testing"
)

func TestCampaignStoreFinishCombatCountsZeroHitPointEnemiesForExperience(t *testing.T) {
	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}

	campaign, err := store.createCampaign(createCampaignInput{
		Title:       "Finish combat XP",
		System:      "D&D 5e",
		SettingName: "Shadow Edge",
		InWorldDate: "17 Nightal, 1492 DR",
		Summary:     "Test campaign",
	})
	if err != nil {
		t.Fatalf("createCampaign() error = %v", err)
	}

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaign.ID {
			continue
		}

		store.data.Campaigns[index].ActiveCombat = &activeCombat{
			ID:        "combat-1",
			Title:     "Ambush",
			PartySize: 2,
			Entries: []combatEntry{
				{ID: "player-1", EntityID: "player-1", EntityKind: "player", Side: "player", Title: "Aelar", CurrentHitPoints: 18, MaxHitPoints: 18},
				{ID: "player-2", EntityID: "player-2", EntityKind: "player", Side: "player", Title: "Mira", CurrentHitPoints: 14, MaxHitPoints: 14},
				{ID: "enemy-down", EntityID: "enemy-down", EntityKind: "monster", Side: "enemy", Title: "Shadow Hound", Challenge: "1", Experience: 200, CurrentHitPoints: 0, MaxHitPoints: 22},
				{ID: "enemy-up", EntityID: "enemy-up", EntityKind: "monster", Side: "enemy", Title: "Cult Enforcer", Challenge: "2", Experience: 450, CurrentHitPoints: 11, MaxHitPoints: 27},
			},
		}
		break
	}

	result, err := store.finishCombat(campaign.ID)
	if err != nil {
		t.Fatalf("finishCombat() error = %v", err)
	}

	if result.DefeatedCount != 1 {
		t.Fatalf("expected 1 defeated enemy to count for rewards, got %d", result.DefeatedCount)
	}
	if result.TotalExperience != 200 {
		t.Fatalf("expected only zero-hit-point enemy XP to be counted, got %d", result.TotalExperience)
	}
	if result.ExperiencePerPlayer != 100 {
		t.Fatalf("expected XP per player to use party size, got %d", result.ExperiencePerPlayer)
	}
	if len(result.DefeatedEntries) != 1 || result.DefeatedEntries[0].ID != "enemy-down" {
		t.Fatalf("expected defeated entries to contain only the zero-hit-point enemy, got %+v", result.DefeatedEntries)
	}
}

func TestBuildPublicInitiativeSnapshotHidesEnemyMetaUntilVictory(t *testing.T) {
	campaign := campaignData{
		ID:    "campaign-1",
		Title: "Shadow Edge",
		ActiveCombat: &activeCombat{
			ID:                 "combat-1",
			Title:              "Roadside Clash",
			Round:              2,
			PartySize:          1,
			CurrentTurnEntryID: "player-1",
			Entries: []combatEntry{
				{ID: "player-1", EntityID: "player-1", EntityKind: "player", Side: "player", Title: "Aelar", CurrentHitPoints: 18, MaxHitPoints: 18},
				{ID: "enemy-1", EntityID: "enemy-1", EntityKind: "monster", Side: "enemy", Title: "Ghoul", Challenge: "CR 3", Experience: 700, CurrentHitPoints: 9, MaxHitPoints: 9},
			},
		},
	}

	activeSnapshot := buildPublicInitiativeSnapshot(campaign)
	if activeSnapshot.Combat == nil {
		t.Fatal("expected active snapshot to expose combat data")
	}
	activeEnemy := findPublicInitiativeEntryByID(activeSnapshot.Combat.Entries, "enemy-1")
	if activeEnemy == nil {
		t.Fatal("expected active snapshot to contain the enemy entry")
	}
	if activeEnemy.Challenge != "" {
		t.Fatalf("expected active public tracker to hide challenge, got %q", activeEnemy.Challenge)
	}
	if activeEnemy.Experience != 0 {
		t.Fatalf("expected active public tracker to hide experience, got %d", activeEnemy.Experience)
	}
	if activeEnemy.Bloodied {
		t.Fatalf("expected full-health enemy to not be marked bloodied")
	}

	revealedPreview := buildPublicInitiativeEntries(campaign, campaign.ActiveCombat.Entries, "", true)
	revealedEnemyPreview := findPublicInitiativeEntryByID(revealedPreview, "enemy-1")
	if revealedEnemyPreview == nil {
		t.Fatal("expected preview entries to contain the enemy entry")
	}
	if revealedEnemyPreview.Experience != 0 {
		t.Fatalf("expected living enemy to hide experience even in revealed preview, got %d", revealedEnemyPreview.Experience)
	}

	campaign.ActiveCombat.Entries[1].CurrentHitPoints = 0
	campaign.ActiveCombat.Entries[1].Defeated = true

	victorySnapshot := buildPublicInitiativeSnapshot(campaign)
	if victorySnapshot.Result == nil {
		t.Fatal("expected victory snapshot once every enemy is out")
	}
	victoryEnemy := findPublicInitiativeEntryByID(victorySnapshot.Result.Entries, "enemy-1")
	if victoryEnemy == nil {
		t.Fatal("expected victory snapshot to contain the enemy entry")
	}
	if victoryEnemy.Challenge != "" {
		t.Fatalf("expected victory snapshot to keep challenge hidden, got %q", victoryEnemy.Challenge)
	}
	if victoryEnemy.Experience != 700 {
		t.Fatalf("expected victory snapshot to reveal experience, got %d", victoryEnemy.Experience)
	}
	if !victoryEnemy.Bloodied {
		t.Fatalf("expected defeated enemy to be marked bloodied for overlay")
	}
}

func findPublicInitiativeEntryByID(entries []publicInitiativeEntry, entryID string) *publicInitiativeEntry {
	for index := range entries {
		if entries[index].ID == entryID {
			return &entries[index]
		}
	}
	return nil
}
