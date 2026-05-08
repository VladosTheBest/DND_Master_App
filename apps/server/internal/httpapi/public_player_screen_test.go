package httpapi

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPlayerDisplayAndInitiativeShareUseSamePublicURL(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	manager := newInitiativeShareManager(store, "https://players.example")
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/initiative-share", nil)

	share, err := manager.ensureShare(campaign.ID, request)
	if err != nil {
		t.Fatalf("ensureShare() error = %v", err)
	}

	imageShare, err := manager.showPlayerDisplayImage(campaign.ID, request, playerDisplayImageInput{
		URL:   "/uploads/map.png",
		Title: "Dungeon map",
	})
	if err != nil {
		t.Fatalf("showPlayerDisplayImage() error = %v", err)
	}

	if imageShare.URL != share.URL {
		t.Fatalf("expected image display and initiative share to use the same URL, got %q and %q", imageShare.URL, share.URL)
	}
	if strings.Contains(imageShare.URL, "/display/") {
		t.Fatalf("expected canonical URL to stay under /initiative/, got %q", imageShare.URL)
	}

	snapshot, err := manager.snapshotForToken(share.Token)
	if err != nil {
		t.Fatalf("snapshotForToken() error = %v", err)
	}
	if snapshot.Mode != publicScreenModeImage {
		t.Fatalf("expected image mode without active combat, got %q", snapshot.Mode)
	}
	if snapshot.Image == nil || snapshot.Image.URL != "https://players.example/uploads/map.png" {
		t.Fatalf("expected display image to be included and resolved against the public base URL, got %+v", snapshot.Image)
	}
}

func TestPublicScreenActiveCombatOverridesPublishedImage(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	manager := newInitiativeShareManager(store, "https://players.example")
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/player-display", nil)

	imageShare, err := manager.showPlayerDisplayImage(campaign.ID, request, playerDisplayImageInput{
		URL:   "/uploads/map.png",
		Title: "Dungeon map",
	})
	if err != nil {
		t.Fatalf("showPlayerDisplayImage() error = %v", err)
	}

	if _, err := store.startCombat(campaign.ID, startCombatInput{
		Title:      "Ambush",
		PartySize:  1,
		Thresholds: combatThresholds{Easy: 25, Medium: 50, Hard: 75, Deadly: 100},
		ManualParticipants: []manualCombatantInput{
			{Title: "Aelar", Initiative: 14, MaxHitPoints: 18},
		},
	}); err != nil {
		t.Fatalf("startCombat() error = %v", err)
	}

	snapshot, err := manager.snapshotForToken(imageShare.Token)
	if err != nil {
		t.Fatalf("snapshotForToken() error = %v", err)
	}
	if snapshot.Mode != publicScreenModeInitiative {
		t.Fatalf("expected active combat to override image mode, got %q", snapshot.Mode)
	}
	if snapshot.Combat == nil || snapshot.Image != nil {
		t.Fatalf("expected combat snapshot without image payload, got combat=%+v image=%+v", snapshot.Combat, snapshot.Image)
	}
}

func TestPublicScreenResultStaysUntilNewImageIsShown(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	manager := newInitiativeShareManager(store, "https://players.example")
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/initiative-share", nil)

	share, err := manager.ensureShare(campaign.ID, request)
	if err != nil {
		t.Fatalf("ensureShare() error = %v", err)
	}

	finishedAt := time.Now().UTC().Add(-time.Minute)
	manager.mu.Lock()
	manager.displayPublished[campaign.ID] = publicDisplaySnapshot{
		CampaignID:    campaign.ID,
		CampaignTitle: campaign.Title,
		Image:         &publicDisplayImage{URL: "https://players.example/uploads/old-map.png"},
		Version:       1,
		UpdatedAt:     finishedAt.Add(-time.Minute).Format(time.RFC3339),
	}
	manager.mu.Unlock()

	mutatePublicScreenCampaign(t, store, campaign.ID, func(campaign *campaignData) {
		campaign.LastCombatSummary = &lastCombatSummary{
			CombatID:            "combat-1",
			Title:               "Bridge fight",
			Outcome:             "victory",
			DefeatedCount:       1,
			TotalExperience:     200,
			ExperiencePerPlayer: 200,
			Round:               3,
			FinishedAt:          finishedAt.Format(time.RFC3339),
			Entries: []combatEntry{
				{ID: "player-1", EntityID: "player-1", EntityKind: "player", Side: "player", Title: "Aelar"},
				{ID: "enemy-1", EntityID: "enemy-1", EntityKind: "monster", Side: "enemy", Title: "Ghoul", Experience: 200, Defeated: true},
			},
		}
	})

	resultSnapshot, err := manager.snapshotForToken(share.Token)
	if err != nil {
		t.Fatalf("snapshotForToken() error = %v", err)
	}
	if resultSnapshot.Mode != publicScreenModeResult {
		t.Fatalf("expected combat result to outlive an older image, got %q", resultSnapshot.Mode)
	}
	if resultSnapshot.Result == nil || resultSnapshot.Image != nil {
		t.Fatalf("expected result snapshot without image payload, got result=%+v image=%+v", resultSnapshot.Result, resultSnapshot.Image)
	}

	if _, err := manager.showPlayerDisplayImage(campaign.ID, request, playerDisplayImageInput{
		URL:   "/uploads/new-map.png",
		Title: "Next room",
	}); err != nil {
		t.Fatalf("showPlayerDisplayImage() after result error = %v", err)
	}

	imageSnapshot, err := manager.snapshotForToken(share.Token)
	if err != nil {
		t.Fatalf("snapshotForToken() after image error = %v", err)
	}
	if imageSnapshot.Mode != publicScreenModeImage {
		t.Fatalf("expected a newly shown image to replace the old combat result, got %q", imageSnapshot.Mode)
	}
	if imageSnapshot.Image == nil || !strings.HasSuffix(imageSnapshot.Image.URL, "/uploads/new-map.png") {
		t.Fatalf("expected new image payload, got %+v", imageSnapshot.Image)
	}
}

func TestLegacyDisplayRouteServesUnifiedViewer(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	manager := newInitiativeShareManager(store, "https://players.example")
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/initiative-share", nil)

	share, err := manager.ensureShare(campaign.ID, request)
	if err != nil {
		t.Fatalf("ensureShare() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	manager.handlePublicDisplayPage(recorder, httptest.NewRequest(http.MethodGet, "/display/"+share.Token, nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected legacy /display route to stay available, got status %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "/api/initiative/") {
		t.Fatalf("expected legacy /display route to serve the unified initiative viewer")
	}
}

func newPublicScreenTestStore(t *testing.T) (*campaignStore, campaignData) {
	t.Helper()

	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}

	campaign, err := store.createCampaign(createCampaignInput{
		Title:       "Shadow Edge",
		System:      "D&D 5e",
		SettingName: "Test",
		InWorldDate: "17 Nightal",
		Summary:     "Test campaign",
	})
	if err != nil {
		t.Fatalf("createCampaign() error = %v", err)
	}

	return store, campaign
}

func mutatePublicScreenCampaign(t *testing.T, store *campaignStore, campaignID string, mutate func(*campaignData)) {
	t.Helper()

	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID == campaignID {
			mutate(&store.data.Campaigns[index])
			return
		}
	}

	t.Fatalf("campaign %q not found", campaignID)
}
