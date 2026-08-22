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

func TestSessionMapOverridesCombatAndSanitizesFog(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	manager := newInitiativeShareManager(store, "https://players.example")
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/player-display", nil)

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

	share, err := manager.showPlayerDisplayImage(campaign.ID, request, playerDisplayImageInput{
		URL:        "/uploads/map.png",
		FogRows:    2,
		FogColumns: 3,
		Revealed:   []int{5, 1, 1, -1, 6},
		ShowGrid:   true,
		SessionMap: true,
	})
	if err != nil {
		t.Fatalf("showPlayerDisplayImage() error = %v", err)
	}

	snapshot, err := manager.snapshotForToken(share.Token)
	if err != nil {
		t.Fatalf("snapshotForToken() error = %v", err)
	}
	if snapshot.Mode != publicScreenModeImage || snapshot.Image == nil {
		t.Fatalf("expected session map to override combat, got mode=%q image=%+v", snapshot.Mode, snapshot.Image)
	}
	if got := snapshot.Image.Revealed; len(got) != 2 || got[0] != 1 || got[1] != 5 {
		t.Fatalf("expected valid unique sorted fog cells, got %v", got)
	}
}

func TestPublicDisplaySanitizesYouTubeMap(t *testing.T) {
	image := sanitizePublicDisplayImage(publicDisplayImage{
		URL:       "https://youtu.be/dQw4w9WgXcQ",
		MediaType: "youtube",
	})
	if image == nil || image.MediaType != "youtube" {
		t.Fatalf("expected valid YouTube display image, got %+v", image)
	}
	if !strings.HasPrefix(image.URL, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?") {
		t.Fatalf("expected privacy-enhanced embed URL, got %q", image.URL)
	}
	if invalid := sanitizePublicDisplayImage(publicDisplayImage{URL: "https://example.com/video", MediaType: "youtube"}); invalid != nil {
		t.Fatalf("expected invalid YouTube host to be rejected, got %+v", invalid)
	}
}

func TestPublicDisplaySanitizesFreeformFogRegions(t *testing.T) {
	regions := sanitizePublicFogRegions([]publicFogRegion{
		{ID: " room ", Points: []publicFogPoint{{X: -1, Y: 0.2}, {X: 0.5, Y: 2}, {X: 0.8, Y: 0.7}}, Revealed: true},
		{ID: "short", Points: []publicFogPoint{{X: 0, Y: 0}, {X: 1, Y: 1}}},
	})
	if len(regions) != 1 || regions[0].ID != "room" || !regions[0].Revealed {
		t.Fatalf("expected one valid normalized region, got %+v", regions)
	}
	if regions[0].Points[0].X != 0 || regions[0].Points[1].Y != 1 {
		t.Fatalf("expected region points to be clamped, got %+v", regions[0].Points)
	}
}

func TestPublicDisplaySanitizesWallsAndVisionToken(t *testing.T) {
	walls := sanitizePublicDisplayWalls([]publicDisplayWall{
		{ID: " wall ", Start: publicFogPoint{X: -2, Y: .2}, End: publicFogPoint{X: .8, Y: 2}, Disabled: true},
		{ID: "curve", Points: []publicFogPoint{{X: -.2, Y: .1}, {X: .4, Y: .6}, {X: 1.4, Y: .9}}},
		{ID: "empty", Start: publicFogPoint{X: .5, Y: .5}, End: publicFogPoint{X: .5, Y: .5}},
	})
	if len(walls) != 2 || walls[0].ID != "wall" || walls[0].Start.X != 0 || walls[0].End.Y != 1 || !walls[0].Disabled {
		t.Fatalf("expected normalized walls, got %+v", walls)
	}
	if len(walls[1].Points) != 3 || walls[1].Start.X != 0 || walls[1].End.X != 1 || walls[1].Points[1].Y != .6 {
		t.Fatalf("expected freehand wall points to be retained and clamped, got %+v", walls[1])
	}
	token := sanitizePublicDisplayToken(&publicDisplayToken{X: -1, Y: 2, VisionRadius: 10})
	if token == nil || token.X != 0 || token.Y != 1 || token.VisionRadius != 1.5 {
		t.Fatalf("expected clamped token, got %+v", token)
	}
	image := sanitizePublicDisplayImage(publicDisplayImage{URL: "/map.png", MapAspectRatio: 99})
	if image == nil || image.MapAspectRatio != 5 {
		t.Fatalf("expected clamped map aspect ratio, got %+v", image)
	}
}

func TestPublicDisplaySanitizesMapGrid(t *testing.T) {
	grid := sanitizePublicDisplayGrid(&publicDisplayGrid{Type: "hex", Size: 2, Color: " not-a-color ", Opacity: -1})
	if grid == nil || grid.Type != "hex" || grid.Size != .3 || grid.Color != "#ffffff" || grid.Opacity != 0 {
		t.Fatalf("expected normalized map grid, got %+v", grid)
	}
	if sanitizePublicDisplayGrid(&publicDisplayGrid{Type: "triangle"}) != nil {
		t.Fatal("expected unsupported grid type to be removed")
	}
}

func TestPublicDisplaySanitizesViewport(t *testing.T) {
	viewport := sanitizePublicViewport(&publicViewport{Zoom: 20, X: -4, Y: 3})
	if viewport.Zoom != 6 || viewport.X != -2.5 || viewport.Y != 2.5 {
		t.Fatalf("expected clamped viewport, got %+v", viewport)
	}
	centered := sanitizePublicViewport(&publicViewport{Zoom: 1, X: 0.8, Y: -0.8})
	if centered.X != 0 || centered.Y != 0 {
		t.Fatalf("viewport at 100%% zoom must stay centered: %+v", centered)
	}
	defaults := sanitizePublicViewport(nil)
	if defaults.Zoom != 1 || defaults.X != 0 || defaults.Y != 0 {
		t.Fatalf("expected default viewport, got %+v", defaults)
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
	if !strings.Contains(recorder.Body.String(), "data-media-key") {
		t.Fatalf("expected viewer to preserve the media element while fog updates")
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
