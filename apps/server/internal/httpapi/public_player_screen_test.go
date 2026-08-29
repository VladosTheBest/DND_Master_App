package httpapi

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"math"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestPublicDisplayFingerprintIncludesPublishedVisionGeometry(t *testing.T) {
	base := publicDisplaySnapshot{Image: &publicDisplayImage{
		URL:           "https://players.example/uploads/map.png",
		VisionPolygon: []publicFogPoint{{X: .1, Y: .1}, {X: .2, Y: .1}, {X: .1, Y: .2}},
		FOVPolygon:    []publicFogPoint{{X: .05, Y: .05}, {X: .3, Y: .05}, {X: .05, Y: .3}},
	}}
	changed := base
	changed.Image = &publicDisplayImage{
		URL:           base.Image.URL,
		VisionPolygon: []publicFogPoint{{X: .1, Y: .1}, {X: .25, Y: .1}, {X: .1, Y: .2}},
		FOVPolygon:    base.Image.FOVPolygon,
	}

	if publicDisplaySnapshotFingerprint(base) == publicDisplaySnapshotFingerprint(changed) {
		t.Fatal("published LOS geometry must change the TV snapshot fingerprint")
	}
	unifiedBase := publicInitiativeSnapshot{CampaignID: "campaign", CampaignTitle: "Campaign", Mode: publicScreenModeImage, Image: base.Image}
	unifiedChanged := unifiedBase
	unifiedChanged.Image = changed.Image
	if publicSnapshotFingerprint(unifiedBase) == publicSnapshotFingerprint(unifiedChanged) {
		t.Fatal("published LOS geometry must change the unified snapshot fingerprint")
	}
}

func TestUnifiedPublicSnapshotVersionTracksVisionAndRoofGeometry(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	manager := newInitiativeShareManager(store, "https://players.example")
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/player-display", nil)
	input := playerDisplayImageInput{
		URL:            "/uploads/interior.jpg",
		RoofURL:        "/uploads/roof.jpg",
		RoofMaskURL:    testRoofMaskURL(t, 32),
		RoofVisionOnly: true,
		SessionMap:     true,
		Token:          &publicDisplayToken{X: .5, Y: .5, VisionRadius: .2},
		VisionPolygon: []publicFogPoint{
			{X: .3, Y: .3}, {X: .7, Y: .3}, {X: .5, Y: .7},
		},
		FOVPolygon: []publicFogPoint{
			{X: .2, Y: .2}, {X: .8, Y: .2}, {X: .5, Y: .8},
		},
		RoofZones: []publicRoofZone{{
			ID: "house",
			Points: []publicFogPoint{
				{X: .25, Y: .25}, {X: .75, Y: .25}, {X: .75, Y: .75}, {X: .25, Y: .75},
			},
		}},
	}

	first, err := manager.showPlayerDisplayImage(campaign.ID, request, input)
	if err != nil {
		t.Fatalf("initial showPlayerDisplayImage() error = %v", err)
	}

	input.VisionPolygon = []publicFogPoint{{X: .3, Y: .3}, {X: .72, Y: .3}, {X: .5, Y: .7}}
	visionChanged, err := manager.showPlayerDisplayImage(campaign.ID, request, input)
	if err != nil {
		t.Fatalf("vision update showPlayerDisplayImage() error = %v", err)
	}
	if visionChanged.PublishedVersion <= first.PublishedVersion {
		t.Fatalf("unified version must advance for vision-only geometry changes: first=%d changed=%d", first.PublishedVersion, visionChanged.PublishedVersion)
	}

	input.RoofMaskURL = testRoofMaskURL(t, 224)
	roofChanged, err := manager.showPlayerDisplayImage(campaign.ID, request, input)
	if err != nil {
		t.Fatalf("roof update showPlayerDisplayImage() error = %v", err)
	}
	if roofChanged.PublishedVersion <= visionChanged.PublishedVersion {
		t.Fatalf("unified version must advance for roof-only geometry changes: vision=%d roof=%d", visionChanged.PublishedVersion, roofChanged.PublishedVersion)
	}

	input.RoofCutoutMaskURL = testRoofMaskURL(t, 96)
	cutoutChanged, err := manager.showPlayerDisplayImage(campaign.ID, request, input)
	if err != nil {
		t.Fatalf("cutout update showPlayerDisplayImage() error = %v", err)
	}
	if cutoutChanged.PublishedVersion <= roofChanged.PublishedVersion {
		t.Fatalf("unified version must advance for active roof component changes: roof=%d cutout=%d", roofChanged.PublishedVersion, cutoutChanged.PublishedVersion)
	}

	input.RoofCutoutMaskURL = ""
	input.RoofVisionOnly = false
	outsideChanged, err := manager.showPlayerDisplayImage(campaign.ID, request, input)
	if err != nil {
		t.Fatalf("outside-roof update showPlayerDisplayImage() error = %v", err)
	}
	if outsideChanged.PublishedVersion <= cutoutChanged.PublishedVersion {
		t.Fatalf("unified version must advance when the token leaves its roof component: cutout=%d outside=%d", cutoutChanged.PublishedVersion, outsideChanged.PublishedVersion)
	}
}

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

func TestPublicDisplayPreservesRoofLayer(t *testing.T) {
	roofMask := testRoofMaskURL(t, 32)
	roofCutoutMask := testRoofMaskURL(t, 224)
	image := sanitizePublicDisplayImage(publicDisplayImage{
		URL:               "/uploads/interior.jpg",
		RoofURL:           "/uploads/roof.jpg",
		RoofMaskURL:       roofMask,
		RoofCutoutMaskURL: roofCutoutMask,
		RoofVisionOnly:    true,
		RoofZones:         []publicRoofZone{{ID: "house", Points: []publicFogPoint{{X: -.2, Y: .2}, {X: .8, Y: .2}, {X: .8, Y: 1.2}}}},
	})
	if image == nil || image.RoofURL != "/uploads/roof.jpg" || image.RoofMaskURL != roofMask || image.RoofCutoutMaskURL != roofCutoutMask || !image.RoofVisionOnly || len(image.RoofZones) != 1 || image.RoofZones[0].Points[0].X != 0 || image.RoofZones[0].Points[2].Y != 1 {
		t.Fatalf("expected roof layer URL to survive sanitization, got %+v", image)
	}

	oversized := roofMask + strings.Repeat("A", maxPublicRoofMaskURLLength)
	if got := sanitizeRoofMaskURL(oversized); got != "" {
		t.Fatalf("expected oversized roof mask to be removed, got length %d", len(got))
	}
	if got := sanitizeRoofMaskURL("data:image/jpeg;base64,AAAA"); got != "" {
		t.Fatalf("expected non-PNG roof mask to be removed, got %q", got)
	}
	if got := sanitizeRoofMaskURL("data:image/png;base64,AAAA"); got != "" {
		t.Fatalf("expected malformed PNG roof mask to be removed, got %q", got)
	}
}

func TestPlayerDisplayLinkPersistsUntilRotated(t *testing.T) {
	store, campaign := newPublicScreenTestStore(t)
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/player-display", nil)
	firstManager := newInitiativeShareManager(store, "https://players.example")
	first, err := firstManager.showPlayerDisplayImage(campaign.ID, request, playerDisplayImageInput{URL: "/map-one.jpg"})
	if err != nil {
		t.Fatalf("showPlayerDisplayImage() error = %v", err)
	}

	secondManager := newInitiativeShareManager(store, "https://players.example")
	second, err := secondManager.showPlayerDisplayImage(campaign.ID, request, playerDisplayImageInput{URL: "/map-two.jpg"})
	if err != nil {
		t.Fatalf("showPlayerDisplayImage() after restart error = %v", err)
	}
	if second.Token != first.Token || second.URL != first.URL {
		t.Fatalf("expected stable display link, first=%+v second=%+v", first, second)
	}

	rotated, err := secondManager.rotatePlayerDisplayShare(campaign.ID, request)
	if err != nil {
		t.Fatalf("rotatePlayerDisplayShare() error = %v", err)
	}
	if rotated.Token == first.Token || rotated.URL == first.URL {
		t.Fatalf("expected rotated display link, first=%+v rotated=%+v", first, rotated)
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

func TestPublicDisplayPreservesComplete2964PointVisionPolygon(t *testing.T) {
	points := testCircularPolygon(2964)
	got := sanitizePublicPolygon(points)
	if len(got) != len(points) {
		t.Fatalf("expected all %d LOS points below the cap, got %d", len(points), len(got))
	}
	for index := range points {
		if got[index] != points[index] {
			t.Fatalf("LOS point %d changed below the cap: got %+v want %+v", index, got[index], points[index])
		}
	}
}

func TestPublicDisplayPreservesOffMapVisionCoordinates(t *testing.T) {
	points := []publicFogPoint{
		{X: -.25, Y: .4},
		{X: .5, Y: -1.2},
		{X: 1.4, Y: .7},
	}
	got := sanitizePublicPolygon(points)
	if !slices.Equal(got, points) {
		t.Fatalf("expected off-map LOS vertices to remain unchanged for SVG clipping, got %+v", got)
	}
}

func TestPublicDisplayRejectsUnsafeVisionCoordinates(t *testing.T) {
	points := []publicFogPoint{{X: 0, Y: 0}, {X: .5, Y: .5}, {X: maxPublicPolygonCoordinate + 1, Y: 1}}
	if got := sanitizePublicPolygon(points); got != nil {
		t.Fatalf("expected unsafe LOS coordinates to be rejected, got %+v", got)
	}
}

func TestPublicDisplaySamplesOversizedVisionPolygonAcrossFullCircumference(t *testing.T) {
	points := testCircularPolygon(maxPublicPolygonPoints * 2)
	got := sanitizePublicPolygon(points)
	if len(got) != maxPublicPolygonPoints {
		t.Fatalf("expected oversized LOS polygon to be capped at %d points, got %d", maxPublicPolygonPoints, len(got))
	}

	var quadrants [4]bool
	maxAngle := 0.0
	for _, point := range got {
		angle := math.Atan2(point.Y-.5, point.X-.5)
		if angle < 0 {
			angle += 2 * math.Pi
		}
		quadrants[min(3, int(angle/(math.Pi/2)))] = true
		maxAngle = max(maxAngle, angle)
	}
	for quadrant, covered := range quadrants {
		if !covered {
			t.Fatalf("uniform LOS sampling omitted angular quadrant %d", quadrant+1)
		}
	}
	if maxAngle < 1.9*math.Pi {
		t.Fatalf("uniform LOS sampling did not reach the final angular sector: max angle %.3f radians", maxAngle)
	}
}

func TestPublicDisplaySanitizesMapGrid(t *testing.T) {
	grid := sanitizePublicDisplayGrid(&publicDisplayGrid{Type: "hex", Size: 2, Color: " not-a-color ", Opacity: -1})
	if grid == nil || grid.Type != "hex" || grid.Size != .2 || grid.Color != "#ffffff" || grid.Opacity != 0 {
		t.Fatalf("expected normalized map grid, got %+v", grid)
	}
	small := sanitizePublicDisplayGrid(&publicDisplayGrid{Type: "square", Size: .001, Color: "#123456", Opacity: .5})
	if small == nil || small.Size != .005 {
		t.Fatalf("expected minimum grid size .005, got %+v", small)
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
	body := recorder.Body.String()
	if !strings.Contains(body, "/api/initiative/") {
		t.Fatalf("expected legacy /display route to serve the unified initiative viewer")
	}
	if !strings.Contains(body, "data-media-key") {
		t.Fatalf("expected viewer to preserve the media element while fog updates")
	}
	for _, fragment := range []string{
		"roofCutoutMaskUrl",
		"pointInRoofZone(token, zone)",
		"const insideRoof = Boolean(image?.roofVisionOnly || componentCutout);",
		"if (insideRoof && !componentCutout) return '';",
		".roof-overlay.inside-roof { z-index: 1; }",
		".vision-fog { fill: #000; opacity: 1; }",
		"(insideRoof ? ' inside-roof' : '')",
		"clip-path=\"url(#roof-los-clip)\"",
		"if (!visionPoints || !coverage) return '';",
		"style=\"mask-type:luminance\"",
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected component-scoped fail-closed roof policy to contain %q", fragment)
		}
	}
	for _, forbidden := range []string{
		"preserveAspectRatio=\"none\" clip-path=\"url(#roof-los-clip)\"></image>",
		"fill=\"black\" clip-path=\"url(#roof-los-clip)\"></polygon>",
		"roof-vision-cutout",
	} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("active roof component itself must be removed completely before the final roof overlay is clipped to LOS; found %q", forbidden)
		}
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

func testCircularPolygon(count int) []publicFogPoint {
	points := make([]publicFogPoint, count)
	for index := range points {
		angle := 2 * math.Pi * float64(index) / float64(count)
		points[index] = publicFogPoint{X: .5 + math.Cos(angle)*.4, Y: .5 + math.Sin(angle)*.4}
	}
	return points
}

func testRoofMaskURL(t *testing.T, value uint8) string {
	t.Helper()
	mask := image.NewGray(image.Rect(0, 0, 2, 2))
	for y := 0; y < 2; y++ {
		for x := 0; x < 2; x++ {
			mask.SetGray(x, y, color.Gray{Y: value})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, mask); err != nil {
		t.Fatalf("encode test roof mask: %v", err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(encoded.Bytes())
}
