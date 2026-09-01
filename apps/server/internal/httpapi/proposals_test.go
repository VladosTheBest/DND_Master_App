package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

var (
	errInjectedBackupWrite    = errors.New("injected storage backup failure")
	errInjectedBackupRefresh  = errors.New("injected post-commit backup refresh failure")
	errInjectedPrimaryReplace = errors.New("injected primary replace failure")
)

type proposalSaveFaultProbe struct {
	backupAttempts  int
	primaryAttempts int
}

func injectProposalBackupWriteFailure(store *campaignStore) *proposalSaveFaultProbe {
	probe := &proposalSaveFaultProbe{}
	store.atomicFileWrite = func(path string, body []byte, mode os.FileMode) error {
		if path == store.backupPath() {
			probe.backupAttempts++
			return errInjectedBackupWrite
		}
		return writeFileAtomically(path, body, mode)
	}
	store.atomicFileReplace = func(source, target string) error {
		probe.primaryAttempts++
		return replaceFile(source, target)
	}
	return probe
}

func injectProposalBackupRefreshFailure(store *campaignStore) *proposalSaveFaultProbe {
	probe := &proposalSaveFaultProbe{}
	store.atomicFileWrite = func(path string, body []byte, mode os.FileMode) error {
		if path == store.backupPath() {
			probe.backupAttempts++
			if probe.backupAttempts == 2 {
				return errInjectedBackupRefresh
			}
		}
		return writeFileAtomically(path, body, mode)
	}
	store.atomicFileReplace = func(source, target string) error {
		probe.primaryAttempts++
		return replaceFile(source, target)
	}
	return probe
}

func assertProposalStatusOnDisk(t *testing.T, store *campaignStore, proposalID, wantStatus string) {
	t.Helper()
	state, err := readStorageState(store.path)
	if err != nil {
		t.Fatalf("read primary state: %v", err)
	}
	for _, proposal := range state.AIProposals {
		if proposal.ID == proposalID {
			if proposal.Status != wantStatus {
				t.Fatalf("primary proposal status = %q, want %q", proposal.Status, wantStatus)
			}
			return
		}
	}
	t.Fatalf("proposal %s missing from primary", proposalID)
}

func cloneCampaignForTest(t *testing.T, campaign campaignData) campaignData {
	t.Helper()
	body, err := json.Marshal(campaign)
	if err != nil {
		t.Fatalf("marshal campaign snapshot: %v", err)
	}
	var cloned campaignData
	if err := json.Unmarshal(body, &cloned); err != nil {
		t.Fatalf("unmarshal campaign snapshot: %v", err)
	}
	return ensureCampaignShape(cloned)
}

func assertFailedProposalSaveDidNotCommit(t *testing.T, store *campaignStore, service *proposalService, user userAccount, campaignID, proposalID string, wantProposal aiProposal, wantCampaign campaignData, wantPrimary []byte, probe *proposalSaveFaultProbe) {
	t.Helper()
	if probe.backupAttempts != 1 || probe.primaryAttempts != 0 {
		t.Fatalf("write attempts = backup:%d primary:%d, want backup:1 primary:0", probe.backupAttempts, probe.primaryAttempts)
	}
	gotPrimary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary after failed save: %v", err)
	}
	if !bytes.Equal(gotPrimary, wantPrimary) {
		t.Fatal("primary storage changed after backup write failure")
	}
	gotProposal, err := service.get(user.ID, proposalID)
	if err != nil {
		t.Fatalf("get proposal after failed save: %v", err)
	}
	if !reflect.DeepEqual(gotProposal, wantProposal) {
		t.Fatalf("proposal was not rolled back in memory:\n got: %#v\nwant: %#v", gotProposal, wantProposal)
	}
	gotCampaign, err := store.getCampaignForUser(user.ID, campaignID)
	if err != nil {
		t.Fatalf("get campaign after failed save: %v", err)
	}
	if !reflect.DeepEqual(gotCampaign, wantCampaign) {
		t.Fatalf("campaign was not rolled back in memory:\n got: %#v\nwant: %#v", gotCampaign, wantCampaign)
	}
}

type expiredProposalFixture struct {
	store      *campaignStore
	service    *proposalService
	user       userAccount
	campaign   campaignData
	proposal   aiProposal
	stagingDir string
	auditCount int
	primary    []byte
}

func newExpiredProposalFixture(t *testing.T) expiredProposalFixture {
	t.Helper()
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Expiring proposal"}`),
	})
	if err != nil {
		t.Fatalf("create expiring proposal: %v", err)
	}
	stagingDir := service.proposalStagingDir(user.ID, proposal.ID)
	if err := os.MkdirAll(stagingDir, 0o700); err != nil {
		t.Fatalf("mkdir expiry staging: %v", err)
	}
	fileName := "expiry-media.gif"
	if err := os.WriteFile(filepath.Join(stagingDir, fileName), []byte("GIF89a"), 0o600); err != nil {
		t.Fatalf("write expiry staging: %v", err)
	}
	if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{
		ID: "expiry-media", Field: "art.url", PreviewURL: proposalPreviewPath(proposal.ID, fileName), ContentType: "image/gif", Status: "staged",
	}); err != nil {
		t.Fatalf("register expiry media: %v", err)
	}
	store.mu.Lock()
	proposalIndex := findOwnedProposalIndexLocked(&store.data, user.ID, proposal.ID)
	store.data.AIProposals[proposalIndex].ExpiresAt = time.Now().UTC().Add(-time.Hour).Format(time.RFC3339)
	err = store.saveLocked()
	store.mu.Unlock()
	if err != nil {
		t.Fatalf("persist expired timestamp: %v", err)
	}
	primary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary before expiry transition: %v", err)
	}
	return expiredProposalFixture{
		store: store, service: service, user: user, campaign: campaign, proposal: proposal,
		stagingDir: stagingDir, auditCount: len(store.data.ProposalAudits), primary: primary,
	}
}

func assertExpirySaveFailureRolledBack(t *testing.T, fixture expiredProposalFixture, probe *proposalSaveFaultProbe) {
	t.Helper()
	if probe.backupAttempts != 1 || probe.primaryAttempts != 0 {
		t.Fatalf("write attempts = backup:%d primary:%d, want 1 and 0", probe.backupAttempts, probe.primaryAttempts)
	}
	fixture.store.mu.RLock()
	proposalIndex := findOwnedProposalIndexLocked(&fixture.store.data, fixture.user.ID, fixture.proposal.ID)
	stored := cloneProposal(fixture.store.data.AIProposals[proposalIndex])
	auditCount := len(fixture.store.data.ProposalAudits)
	fixture.store.mu.RUnlock()
	if stored.Status != "pending" || len(stored.MediaIntents) != 1 || stored.MediaIntents[0].Status != "staged" {
		t.Fatalf("failed expiry was not rolled back: %#v", stored)
	}
	if auditCount != fixture.auditCount {
		t.Fatalf("failed expiry left audit: got %d want %d", auditCount, fixture.auditCount)
	}
	if _, err := os.Stat(fixture.stagingDir); err != nil {
		t.Fatalf("failed expiry removed staged media: %v", err)
	}
	gotPrimary, err := os.ReadFile(fixture.store.path)
	if err != nil || !bytes.Equal(gotPrimary, fixture.primary) {
		t.Fatalf("failed expiry changed primary: err=%v", err)
	}
}

func newProposalTestService(t *testing.T) (*campaignStore, *proposalService, userAccount, campaignData) {
	t.Helper()
	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}
	user, err := store.createUser("proposal-gm", "secret123")
	if err != nil {
		t.Fatalf("createUser() error = %v", err)
	}
	campaign, err := store.createCampaignForUser(user.ID, createCampaignInput{Title: "Proposal test", System: "D&D 5e", SettingName: "Test", InWorldDate: "1 Hammer", Summary: "Testing"})
	if err != nil {
		t.Fatalf("createCampaignForUser() error = %v", err)
	}
	return store, newProposalService(store, filepath.Join(t.TempDir(), "uploads")), user, campaign
}

func createProposalTestEntity(t *testing.T, store *campaignStore, campaignID string) knowledgeEntity {
	t.Helper()
	monsterResult, err := store.createEntity(campaignID, createEntityInput{Kind: "monster", Title: "Guard beast", Summary: "Guard", Content: "Guard", Tags: []string{}})
	if err != nil {
		t.Fatalf("create supporting monster: %v", err)
	}
	result, err := store.createEntity(campaignID, createEntityInput{
		Kind: "quest", Title: "Original quest", Subtitle: "Keep subtitle", Summary: "Keep summary", Content: "Keep content",
		PlayerContent: "Keep player text", PlayerCards: []playerFacingCard{{Title: "Handout", Content: "Secret card"}},
		Tags: []string{"old"}, QuickFacts: []quickFact{{Label: "Reward", Value: "100 gp"}},
		Related: []relatedEntity{{ID: monsterResult.Entity.ID, Kind: "monster", Label: monsterResult.Entity.Title, Reason: "Encounter"}}, Art: &heroArt{URL: "/uploads/art.png", Alt: "Quest art", Caption: "Keep caption"},
		Playlist: []playlistTrack{{Title: "Theme", URL: "https://example.test/theme"}},
		Gallery:  []galleryImage{{Title: "Scene", URL: "/uploads/scene.png", Caption: "Keep gallery"}},
		Status:   "active", Urgency: "high",
		PreparedCombats: []preparedCombatPlan{{Title: "Ambush", Items: []preparedCombatItem{{EntityID: monsterResult.Entity.ID, Quantity: 1}}}},
	})
	if err != nil {
		t.Fatalf("createEntity() error = %v", err)
	}
	return result.Entity
}

func proposalErrorCode(t *testing.T, err error) string {
	t.Helper()
	var typed *proposalError
	if !errors.As(err, &typed) {
		t.Fatalf("expected proposalError, got %T: %v", err, err)
	}
	return typed.Code
}

func proposalTestJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal proposal test JSON: %v", err)
	}
	return body
}

func TestProposalPersistsAcrossStoreReload(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Prompt: "Rename", Patch: json.RawMessage(`{"title":"Persistent proposal"}`),
	})
	if err != nil {
		t.Fatalf("createEntity() proposal error = %v", err)
	}

	reloaded, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatalf("newCampaignStore(reload) error = %v", err)
	}
	reloadedService := newProposalService(reloaded, "")
	got, err := reloadedService.get(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("get(reloaded proposal) error = %v", err)
	}
	if got.Status != "pending" || got.Target.EntityID != entity.ID || len(got.Diff) == 0 {
		t.Fatalf("unexpected reloaded proposal: %#v", got)
	}
	if len(reloaded.data.ProposalAudits) == 0 || reloaded.data.ProposalAudits[len(reloaded.data.ProposalAudits)-1].ProposalID != proposal.ID {
		t.Fatalf("expected persisted creation audit for %s", proposal.ID)
	}
}

func TestProposalCreateRollsBackProposalAndAuditWhenSaveFails(t *testing.T) {
	tests := []struct {
		name   string
		create func(*proposalService, userAccount, campaignData) error
	}{
		{
			name: "entity",
			create: func(service *proposalService, user userAccount, campaign campaignData) error {
				_, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
					Mode: "create", Kind: "npc", Candidate: json.RawMessage(`{"title":"Phantom NPC","summary":"No","content":"No"}`),
				})
				return err
			},
		},
		{
			name: "event",
			create: func(service *proposalService, user userAccount, campaign campaignData) error {
				_, err := service.createEvent(user.ID, campaign.ID, eventProposalInput{
					Mode: "create", Candidate: json.RawMessage(`{"title":"Phantom Event","summary":"No","type":"scene","sceneText":"No"}`),
				})
				return err
			},
		},
		{
			name: "campaign",
			create: func(service *proposalService, user userAccount, _ campaignData) error {
				_, err := service.createCampaign(user.ID, campaignProposalInput{Blueprint: campaignProposalBlueprint{
					Campaign: createCampaignInput{Title: "Phantom Campaign", System: "D&D 5e", SettingName: "No", InWorldDate: "1 Hammer", Summary: "No"},
				}})
				return err
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			store, service, user, campaign := newProposalTestService(t)
			proposalCount := len(store.data.AIProposals)
			auditCount := len(store.data.ProposalAudits)
			wantPrimary, err := os.ReadFile(store.path)
			if err != nil {
				t.Fatalf("read primary before create: %v", err)
			}
			probe := injectProposalBackupWriteFailure(store)
			if err := test.create(service, user, campaign); !errors.Is(err, errInjectedBackupWrite) {
				t.Fatalf("create error = %v, want injected backup failure", err)
			}
			if probe.backupAttempts != 1 || probe.primaryAttempts != 0 {
				t.Fatalf("write attempts = backup:%d primary:%d", probe.backupAttempts, probe.primaryAttempts)
			}
			if len(store.data.AIProposals) != proposalCount || len(store.data.ProposalAudits) != auditCount {
				t.Fatalf("failed create left phantom state: proposals=%d audits=%d", len(store.data.AIProposals), len(store.data.ProposalAudits))
			}
			gotPrimary, err := os.ReadFile(store.path)
			if err != nil || !bytes.Equal(gotPrimary, wantPrimary) {
				t.Fatalf("primary changed after failed create: err=%v", err)
			}
		})
	}
}

func TestProposalOwnershipIsolation(t *testing.T) {
	store, service, alice, campaign := newProposalTestService(t)
	bob, err := store.createUser("other-proposal-gm", "secret123")
	if err != nil {
		t.Fatalf("create bob: %v", err)
	}
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(alice.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Alice only"}`)})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	if _, err := service.get(bob.ID, proposal.ID); proposalErrorCode(t, err) != "not_found" {
		t.Fatalf("expected not_found for cross-owner read, got %v", err)
	}
	if _, err := service.apply(bob.ID, proposal.ID, proposalApplyInput{}); proposalErrorCode(t, err) != "not_found" {
		t.Fatalf("expected not_found for cross-owner apply, got %v", err)
	}
	if proposals, err := service.list(bob.ID, "", ""); err != nil || len(proposals) != 0 {
		t.Fatalf("bob should not list alice proposals: %#v", proposals)
	}
}

func TestEntityProposalMergePreservesOmittedMediaAndRelationships(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: "quest", EntityID: entity.ID, Prompt: "Only rename it", Patch: json.RawMessage(`{"title":"Renamed safely"}`),
	})
	if err != nil {
		t.Fatalf("createEntity proposal error = %v", err)
	}
	var candidate knowledgeEntity
	if err := json.Unmarshal(proposal.After, &candidate); err != nil {
		t.Fatalf("decode candidate: %v", err)
	}
	if candidate.Title != "Renamed safely" {
		t.Fatalf("title = %q", candidate.Title)
	}
	if candidate.Art == nil || candidate.Art.URL != entity.Art.URL || len(candidate.Gallery) != 1 || len(candidate.Playlist) != 1 || len(candidate.PlayerCards) != 1 || len(candidate.QuickFacts) != 1 || len(candidate.PreparedCombats) != 1 {
		t.Fatalf("omitted rich fields were not preserved: %#v", candidate)
	}
	if candidate.PlayerContent != entity.PlayerContent || candidate.Status != entity.Status || candidate.Urgency != entity.Urgency {
		t.Fatalf("omitted scalar fields were not preserved: %#v", candidate)
	}
}

func TestProposalMediaURLsRejectNewExternalAndCrossCampaignValuesWhilePreservingExisting(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	existingArt := "https://cdn.example.test/existing-art.png"
	existingGallery := "https://cdn.example.test/existing-gallery.png"
	existingPlaylist := "https://audio.example.test/existing-theme.mp3"
	created, err := store.createEntity(campaign.ID, createEntityInput{
		Kind: "npc", Title: "Mira", Summary: "Guide", Content: "Guide", Tags: []string{"npc"},
		Art:      &heroArt{URL: existingArt, Alt: "Existing art"},
		Gallery:  []galleryImage{{Title: "Existing scene", URL: existingGallery}},
		Playlist: []playlistTrack{{Title: "Existing theme", URL: existingPlaylist}},
	})
	if err != nil {
		t.Fatalf("create entity: %v", err)
	}

	preserved, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: "npc", EntityID: created.Entity.ID, Patch: json.RawMessage(`{"summary":"Updated safely"}`),
	})
	if err != nil {
		t.Fatalf("preserve existing media: %v", err)
	}
	var candidate knowledgeEntity
	if err := json.Unmarshal(preserved.After, &candidate); err != nil {
		t.Fatalf("decode preserved candidate: %v", err)
	}
	if candidate.Art == nil || candidate.Art.URL != existingArt || len(candidate.Gallery) != 1 || candidate.Gallery[0].URL != existingGallery || len(candidate.Playlist) != 1 || candidate.Playlist[0].URL != existingPlaylist {
		t.Fatalf("existing media changed: %#v", candidate)
	}

	crossCampaignURL := proposalPublicPath(sanitizeUploadPathSegment(user.ID), "another-campaign", "tracker.png")
	tests := []struct {
		name  string
		patch json.RawMessage
	}{
		{name: "external art", patch: proposalTestJSON(t, map[string]any{"art": map[string]any{"url": "https://attacker.example.test/tracker.png"}})},
		{name: "external gallery", patch: proposalTestJSON(t, map[string]any{"gallery": []galleryImage{{Title: "Tracker", URL: "https://attacker.example.test/gallery.png"}}})},
		{name: "external playlist", patch: proposalTestJSON(t, map[string]any{"playlist": []playlistTrack{{Title: "Tracker", URL: "https://attacker.example.test/audio.mp3"}}})},
		{name: "cross campaign upload", patch: proposalTestJSON(t, map[string]any{"art": map[string]any{"url": crossCampaignURL}})},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, createErr := service.createEntity(user.ID, campaign.ID, entityProposalInput{
				Mode: "update", Kind: "npc", EntityID: created.Entity.ID, Patch: test.patch,
			})
			if createErr == nil || proposalErrorCode(t, createErr) != "invalid_media_url" {
				t.Fatalf("new media URL error = %v", createErr)
			}
		})
	}

	sameCampaignURL := proposalPublicPath(sanitizeUploadPathSegment(user.ID), sanitizeUploadPathSegment(campaign.ID), "manual.png")
	if _, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: "npc", EntityID: created.Entity.ID,
		Patch: proposalTestJSON(t, map[string]any{"art": map[string]any{"url": sameCampaignURL}}),
	}); err != nil {
		t.Fatalf("same-campaign upload URL should remain usable: %v", err)
	}

	_, err = service.createCampaign(user.ID, campaignProposalInput{Blueprint: campaignProposalBlueprint{
		Campaign: createCampaignInput{Title: "Unsafe media campaign"},
		Entities: []campaignBlueprintEntity{{
			TempKey: "guide",
			createEntityInput: createEntityInput{
				Kind: "npc", Title: "Guide", Summary: "Guide", Content: "Guide",
				Art: &heroArt{URL: "https://attacker.example.test/campaign-tracker.png"},
			},
		}},
	}})
	if err == nil || proposalErrorCode(t, err) != "invalid_media_url" {
		t.Fatalf("campaign external media error = %v", err)
	}
}

func TestProposalApplyRejectsStaleRevision(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"AI title"}`)})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	manual := entityCreateInputFromData(entity)
	manual.Title = "Manual title"
	if _, err := store.updateEntity(campaign.ID, entity.ID, manual); err != nil {
		t.Fatalf("manual update: %v", err)
	}
	if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); proposalErrorCode(t, err) != "stale_revision" {
		t.Fatalf("expected stale_revision, got %v", err)
	}
	current, err := store.getCampaignForUser(user.ID, campaign.ID)
	if err != nil {
		t.Fatalf("get campaign: %v", err)
	}
	_, _, got := findEntityInCampaign(&current, entity.ID)
	if got.Title != "Manual title" {
		t.Fatalf("stale apply mutated entity: %#v", got)
	}
	stored, _ := service.get(user.ID, proposal.ID)
	if stored.Status != "pending" {
		t.Fatalf("stale proposal status = %q", stored.Status)
	}
}

func TestProposalHTTPApplyMapsStaleRevisionToConflict(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "proposal-http-stale-gm")

	createCampaign := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Stale proposal","system":"D&D 5e","settingName":"Test","inWorldDate":"1 Hammer","summary":"Test"}`, cookies)
	if createCampaign.Code != http.StatusCreated {
		t.Fatalf("create campaign status=%d body=%s", createCampaign.Code, createCampaign.Body.String())
	}
	campaign := decodeAccountTestData[campaignData](t, createCampaign)

	entityInput := createEntityInput{Kind: "quest", Title: "Original quest", Summary: "Before", Content: "Before", Tags: []string{}}
	createEntity := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/entities", string(proposalTestJSON(t, entityInput)), cookies)
	if createEntity.Code != http.StatusCreated {
		t.Fatalf("create entity status=%d body=%s", createEntity.Code, createEntity.Body.String())
	}
	entity := decodeAccountTestData[createEntityResult](t, createEntity).Entity

	proposalInput := entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID,
		Patch: json.RawMessage(`{"summary":"AI summary"}`),
	}
	createProposal := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/ai/proposals/entities", string(proposalTestJSON(t, proposalInput)), cookies)
	if createProposal.Code != http.StatusCreated {
		t.Fatalf("create proposal status=%d body=%s", createProposal.Code, createProposal.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, createProposal)

	manualUpdate := entityCreateInputFromData(entity)
	manualUpdate.Summary = "Manual summary"
	updateEntity := accountTestRequest(t, handler, http.MethodPatch, "/api/campaigns/"+campaign.ID+"/entities/"+entity.ID, string(proposalTestJSON(t, manualUpdate)), cookies)
	if updateEntity.Code != http.StatusOK {
		t.Fatalf("manual entity update status=%d body=%s", updateEntity.Code, updateEntity.Body.String())
	}

	apply := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/"+proposal.ID+"/apply", `{}`, cookies)
	if apply.Code != http.StatusConflict {
		t.Fatalf("stale apply status=%d body=%s", apply.Code, apply.Body.String())
	}
	var failure envelope
	if err := json.Unmarshal(apply.Body.Bytes(), &failure); err != nil {
		t.Fatalf("decode stale apply response: %v", err)
	}
	if failure.Error == nil || failure.Error.Code != "stale_revision" {
		t.Fatalf("stale apply error=%#v body=%s", failure.Error, apply.Body.String())
	}

	storedResponse := accountTestRequest(t, handler, http.MethodGet, "/api/ai/proposals/"+proposal.ID, "", cookies)
	stored := decodeAccountTestData[aiProposal](t, storedResponse)
	if stored.Status != "pending" {
		t.Fatalf("stale HTTP apply changed proposal status to %q", stored.Status)
	}
}

func TestLiveCombatDoesNotAdvanceProposalAuthoringRevision(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Still applicable during combat"}`),
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	baseRevision := proposal.BaseRevisions["campaign"]
	combat, err := store.startCombat(campaign.ID, startCombatInput{
		Title: "Runtime combat", PartySize: 1, ManualParticipants: []manualCombatantInput{{Title: "Runtime participant", Initiative: 12, MaxHitPoints: 10}},
	})
	if err != nil {
		t.Fatalf("start combat: %v", err)
	}
	if combat.Campaign.Revision != baseRevision {
		t.Fatalf("live combat revision = %d, want authoring revision %d", combat.Campaign.Revision, baseRevision)
	}
	if _, err := store.updateCombatState(campaign.ID, updateCombatStateInput{NextTurn: true}); err != nil {
		t.Fatalf("update combat: %v", err)
	}
	applied, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
	if err != nil {
		t.Fatalf("apply proposal during live combat: %v", err)
	}
	if applied.Entity == nil || applied.Entity.Title != "Still applicable during combat" {
		t.Fatalf("unexpected applied entity: %#v", applied.Entity)
	}
}

func TestProposalRejectDoesNotMutateCampaign(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	before, _ := store.getCampaignForUser(user.ID, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Never apply"}`)})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	result, err := service.reject(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("reject: %v", err)
	}
	if result.Proposal.Status != "rejected" || result.Proposal.RejectedAt == "" {
		t.Fatalf("unexpected rejected proposal: %#v", result.Proposal)
	}
	after, _ := store.getCampaignForUser(user.ID, campaign.ID)
	if before.Revision != after.Revision {
		t.Fatalf("reject changed campaign revision: before=%d after=%d", before.Revision, after.Revision)
	}
	_, _, current := findEntityInCampaign(&after, entity.ID)
	if current.Title != entity.Title {
		t.Fatalf("reject changed campaign entity: %#v", current)
	}
}

func TestProposalUndoRestoresSnapshotAsNewRevision(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Applied title"}`)})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	applied, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if applied.Entity == nil || applied.Entity.Title != "Applied title" {
		t.Fatalf("unexpected applied entity: %#v", applied.Entity)
	}
	undone, err := service.undo(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("undo: %v", err)
	}
	if undone.Proposal.Status != "undone" || undone.Proposal.UndoneAt == "" || undone.Entity == nil {
		t.Fatalf("unexpected undo result: %#v", undone)
	}
	if undone.Entity.Title != entity.Title {
		t.Fatalf("undo title = %q, want %q", undone.Entity.Title, entity.Title)
	}
	if undone.Entity.Revision <= applied.Entity.Revision {
		t.Fatalf("undo revision %d must be newer than applied revision %d", undone.Entity.Revision, applied.Entity.Revision)
	}
	current, _ := store.getCampaignForUser(user.ID, campaign.ID)
	_, _, restored := findEntityInCampaign(&current, entity.ID)
	if restored.Title != entity.Title || restored.Revision != undone.Entity.Revision {
		t.Fatalf("stored undo snapshot mismatch: %#v", restored)
	}
}

func TestProposalTransactionsFailBeforePrimaryCommitWhenBackupWriteFails(t *testing.T) {
	t.Run("apply", func(t *testing.T) {
		store, service, user, campaign := newProposalTestService(t)
		entity := createProposalTestEntity(t, store, campaign.ID)
		proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
			Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Must not commit"}`),
		})
		if err != nil {
			t.Fatalf("create proposal: %v", err)
		}
		wantProposal, _ := service.get(user.ID, proposal.ID)
		wantCampaign, _ := store.getCampaignForUser(user.ID, campaign.ID)
		wantCampaign = cloneCampaignForTest(t, wantCampaign)
		wantPrimary, err := os.ReadFile(store.path)
		if err != nil {
			t.Fatalf("read primary before apply: %v", err)
		}
		probe := injectProposalBackupWriteFailure(store)

		if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); !errors.Is(err, errProposalSaveFailed) {
			t.Fatalf("apply error = %v, want %v", err, errProposalSaveFailed)
		}
		assertFailedProposalSaveDidNotCommit(t, store, service, user, campaign.ID, proposal.ID, wantProposal, wantCampaign, wantPrimary, probe)
	})

	t.Run("reject", func(t *testing.T) {
		store, service, user, campaign := newProposalTestService(t)
		entity := createProposalTestEntity(t, store, campaign.ID)
		proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
			Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Reject must not commit"}`),
		})
		if err != nil {
			t.Fatalf("create proposal: %v", err)
		}
		wantProposal, _ := service.get(user.ID, proposal.ID)
		wantCampaign, _ := store.getCampaignForUser(user.ID, campaign.ID)
		wantCampaign = cloneCampaignForTest(t, wantCampaign)
		wantPrimary, err := os.ReadFile(store.path)
		if err != nil {
			t.Fatalf("read primary before reject: %v", err)
		}
		probe := injectProposalBackupWriteFailure(store)

		if _, err := service.reject(user.ID, proposal.ID); !errors.Is(err, errInjectedBackupWrite) {
			t.Fatalf("reject error = %v, want injected backup failure", err)
		}
		assertFailedProposalSaveDidNotCommit(t, store, service, user, campaign.ID, proposal.ID, wantProposal, wantCampaign, wantPrimary, probe)
	})

	t.Run("undo", func(t *testing.T) {
		store, service, user, campaign := newProposalTestService(t)
		entity := createProposalTestEntity(t, store, campaign.ID)
		proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
			Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Applied before failed undo"}`),
		})
		if err != nil {
			t.Fatalf("create proposal: %v", err)
		}
		if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); err != nil {
			t.Fatalf("apply before undo: %v", err)
		}
		wantProposal, _ := service.get(user.ID, proposal.ID)
		wantCampaign, _ := store.getCampaignForUser(user.ID, campaign.ID)
		wantCampaign = cloneCampaignForTest(t, wantCampaign)
		wantPrimary, err := os.ReadFile(store.path)
		if err != nil {
			t.Fatalf("read primary before undo: %v", err)
		}
		probe := injectProposalBackupWriteFailure(store)

		if _, err := service.undo(user.ID, proposal.ID); !errors.Is(err, errInjectedBackupWrite) {
			t.Fatalf("undo error = %v, want injected backup failure", err)
		}
		assertFailedProposalSaveDidNotCommit(t, store, service, user, campaign.ID, proposal.ID, wantProposal, wantCampaign, wantPrimary, probe)
	})
}

func TestProposalActionsStayCommittedWhenPostCommitBackupRefreshFails(t *testing.T) {
	t.Run("apply", func(t *testing.T) {
		store, service, user, campaign := newProposalTestService(t)
		entity := createProposalTestEntity(t, store, campaign.ID)
		proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
			Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Committed apply"}`),
		})
		if err != nil {
			t.Fatalf("create proposal: %v", err)
		}
		probe := injectProposalBackupRefreshFailure(store)
		result, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
		if err != nil {
			t.Fatalf("apply reported failure after primary commit: %v", err)
		}
		if result.Proposal.Status != "applied" || probe.backupAttempts != 2 || probe.primaryAttempts != 1 {
			t.Fatalf("unexpected committed apply result=%#v writes=%#v", result.Proposal, probe)
		}
		assertProposalStatusOnDisk(t, store, proposal.ID, "applied")
	})

	t.Run("reject", func(t *testing.T) {
		store, service, user, campaign := newProposalTestService(t)
		entity := createProposalTestEntity(t, store, campaign.ID)
		proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
			Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Committed reject"}`),
		})
		if err != nil {
			t.Fatalf("create proposal: %v", err)
		}
		probe := injectProposalBackupRefreshFailure(store)
		result, err := service.reject(user.ID, proposal.ID)
		if err != nil {
			t.Fatalf("reject reported failure after primary commit: %v", err)
		}
		if result.Proposal.Status != "rejected" || probe.backupAttempts != 2 || probe.primaryAttempts != 1 {
			t.Fatalf("unexpected committed reject result=%#v writes=%#v", result.Proposal, probe)
		}
		assertProposalStatusOnDisk(t, store, proposal.ID, "rejected")
	})

	t.Run("undo", func(t *testing.T) {
		store, service, user, campaign := newProposalTestService(t)
		entity := createProposalTestEntity(t, store, campaign.ID)
		proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
			Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Committed undo"}`),
		})
		if err != nil {
			t.Fatalf("create proposal: %v", err)
		}
		if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); err != nil {
			t.Fatalf("apply before undo: %v", err)
		}
		probe := injectProposalBackupRefreshFailure(store)
		result, err := service.undo(user.ID, proposal.ID)
		if err != nil {
			t.Fatalf("undo reported failure after primary commit: %v", err)
		}
		if result.Proposal.Status != "undone" || probe.backupAttempts != 2 || probe.primaryAttempts != 1 {
			t.Fatalf("unexpected committed undo result=%#v writes=%#v", result.Proposal, probe)
		}
		assertProposalStatusOnDisk(t, store, proposal.ID, "undone")
	})
}

func TestProposalPrimaryReplaceFailureKeepsCommittedStateAndRecoveryBackup(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Uncommitted replacement"}`),
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	wantPrimary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary before failure: %v", err)
	}
	backupWrites := 0
	primaryReplaces := 0
	store.atomicFileWrite = func(target string, body []byte, mode os.FileMode) error {
		backupWrites++
		return writeFileAtomically(target, body, mode)
	}
	store.atomicFileReplace = func(_, _ string) error {
		primaryReplaces++
		return errInjectedPrimaryReplace
	}

	if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); !errors.Is(err, errProposalSaveFailed) {
		t.Fatalf("apply error = %v, want %v", err, errProposalSaveFailed)
	}
	if backupWrites != 1 || primaryReplaces != 1 {
		t.Fatalf("writes = backup:%d primary:%d, want 1 and 1", backupWrites, primaryReplaces)
	}
	gotPrimary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary after failure: %v", err)
	}
	if !bytes.Equal(gotPrimary, wantPrimary) {
		t.Fatal("failed atomic replacement changed primary storage")
	}

	// Remove the still-valid primary to force recovery from the preserved
	// backup. A failed proposal transaction must not be resurrected there.
	if err := os.Remove(store.path); err != nil {
		t.Fatalf("remove primary before recovery reload: %v", err)
	}
	reloaded, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatalf("reload from recovery backup: %v", err)
	}
	reloadedService := newProposalService(reloaded, service.uploadDir)
	reloadedProposal, err := reloadedService.get(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("get recovered proposal: %v", err)
	}
	if reloadedProposal.Status != "pending" {
		t.Fatalf("recovered proposal status = %q, want pending", reloadedProposal.Status)
	}
	recoveredCampaign, err := reloaded.getCampaignForUser(user.ID, campaign.ID)
	if err != nil {
		t.Fatalf("get recovered campaign: %v", err)
	}
	_, _, recoveredEntity := findEntityInCampaign(&recoveredCampaign, entity.ID)
	if recoveredEntity.Title != entity.Title || recoveredEntity.Revision != entity.Revision {
		t.Fatalf("recovery backup resurrected failed apply: %#v", recoveredEntity)
	}
}

func TestProposalExpiryRollsBackAndKeepsStagedMediaWhenSaveFails(t *testing.T) {
	tests := []struct {
		name string
		run  func(expiredProposalFixture) error
	}{
		{
			name: "list",
			run: func(fixture expiredProposalFixture) error {
				_, err := fixture.service.list(fixture.user.ID, "", "")
				return err
			},
		},
		{
			name: "get",
			run: func(fixture expiredProposalFixture) error {
				_, err := fixture.service.get(fixture.user.ID, fixture.proposal.ID)
				return err
			},
		},
		{
			name: "apply",
			run: func(fixture expiredProposalFixture) error {
				_, err := fixture.service.apply(fixture.user.ID, fixture.proposal.ID, proposalApplyInput{})
				return err
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixture := newExpiredProposalFixture(t)
			probe := injectProposalBackupWriteFailure(fixture.store)
			err := test.run(fixture)
			if test.name == "apply" {
				if !errors.Is(err, errProposalSaveFailed) {
					t.Fatalf("expiry apply error = %v, want %v", err, errProposalSaveFailed)
				}
			} else if !errors.Is(err, errInjectedBackupWrite) {
				t.Fatalf("expiry %s error = %v, want injected backup failure", test.name, err)
			}
			assertExpirySaveFailureRolledBack(t, fixture, probe)
		})
	}
}

func TestProposalExpiryCommitsAuditBeforeCleaningStagedMedia(t *testing.T) {
	fixture := newExpiredProposalFixture(t)
	proposals, err := fixture.service.list(fixture.user.ID, "", "")
	if err != nil {
		t.Fatalf("list expired proposals: %v", err)
	}
	found := false
	for _, proposal := range proposals {
		if proposal.ID == fixture.proposal.ID {
			found = true
			if proposal.Status != "expired" || proposal.MediaIntents[0].Status != "discarded" {
				t.Fatalf("unexpected expired proposal: %#v", proposal)
			}
		}
	}
	if !found {
		t.Fatalf("expired proposal %s missing from list", fixture.proposal.ID)
	}
	if len(fixture.store.data.ProposalAudits) != fixture.auditCount+1 || fixture.store.data.ProposalAudits[len(fixture.store.data.ProposalAudits)-1].Action != "expired" {
		t.Fatalf("expiry audit was not committed exactly once: %#v", fixture.store.data.ProposalAudits)
	}
	if _, err := os.Stat(fixture.stagingDir); !os.IsNotExist(err) {
		t.Fatalf("staging should be cleaned after committed expiry, stat err = %v", err)
	}
}

func TestCampaignProposalAppliesAtomicallyAndRewritesTemporaryLinks(t *testing.T) {
	store, service, user, _ := newProposalTestService(t)
	proposal, err := service.createCampaign(user.ID, campaignProposalInput{
		Prompt: "Create a linked campaign",
		Blueprint: campaignProposalBlueprint{
			Campaign: createCampaignInput{Title: "Linked world", System: "D&D 5e", SettingName: "Links", InWorldDate: "1 Hammer", Summary: "Atomic"},
			Entities: []campaignBlueprintEntity{
				{TempKey: "town", createEntityInput: createEntityInput{Kind: "location", Title: "Town", Summary: "Town", Content: "Town"}},
				{TempKey: "guide", createEntityInput: createEntityInput{Kind: "npc", Title: "Guide", Summary: "Guide", Content: "Guide", LocationID: "town", Related: []relatedEntity{{ID: "town", Kind: "location", Label: "Town"}}}},
			},
			Events: []campaignBlueprintEvent{{TempKey: "arrival", createWorldEventInput: createWorldEventInput{Title: "Arrival", Summary: "Arrive", Type: "scene", LocationID: "town", SceneText: "You arrive."}}},
		},
	})
	if err != nil {
		t.Fatalf("create campaign proposal: %v", err)
	}
	result, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
	if err != nil {
		t.Fatalf("apply campaign proposal: %v", err)
	}
	if result.Campaign == nil || result.Campaign.Title != "Linked world" || result.Campaign.Revision != 1 {
		t.Fatalf("unexpected campaign result: %#v", result.Campaign)
	}
	if len(result.Campaign.Locations) != 1 || len(result.Campaign.NPCs) != 1 || len(result.Campaign.Events) != 1 {
		t.Fatalf("campaign was not applied as one complete blueprint: %#v", result.Campaign)
	}
	locationID := result.Campaign.Locations[0].ID
	if locationID == "town" || result.Campaign.NPCs[0].LocationID != locationID || result.Campaign.NPCs[0].Related[0].ID != locationID || result.Campaign.Events[0].LocationID != locationID {
		t.Fatalf("temporary ids were not rewritten: %#v", result.Campaign)
	}
	stored, err := store.getCampaignForUser(user.ID, result.Campaign.ID)
	if err != nil || stored.Events[0].LocationID != locationID {
		t.Fatalf("atomic campaign not persisted correctly: campaign=%#v err=%v", stored, err)
	}
}

func TestCampaignProposalSelectionFailureLeavesNoPartialCampaign(t *testing.T) {
	store, service, user, _ := newProposalTestService(t)
	proposal, err := service.createCampaign(user.ID, campaignProposalInput{
		Blueprint: campaignProposalBlueprint{
			Campaign: createCampaignInput{Title: "Must stay atomic"},
			Entities: []campaignBlueprintEntity{{TempKey: "town", createEntityInput: createEntityInput{Kind: "location", Title: "Town", Summary: "Town", Content: "Town"}}},
			Events:   []campaignBlueprintEvent{{TempKey: "arrival", createWorldEventInput: createWorldEventInput{Title: "Arrival", Type: "scene", LocationID: "town", SceneText: "Arrival"}}},
		},
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	before := len(store.listCampaignsForUser(user.ID))
	_, err = service.apply(user.ID, proposal.ID, proposalApplyInput{SelectedOperationKeys: []string{"event:arrival"}})
	if proposalErrorCode(t, err) != "missing_dependency" {
		t.Fatalf("expected missing_dependency, got %v", err)
	}
	if after := len(store.listCampaignsForUser(user.ID)); after != before {
		t.Fatalf("failed atomic apply left partial campaign: before=%d after=%d", before, after)
	}
	stored, _ := service.get(user.ID, proposal.ID)
	if stored.Status != "pending" {
		t.Fatalf("failed campaign proposal status = %q", stored.Status)
	}
}

func TestCampaignProposalSelectionPreflightsSingularPreparedCombatDependencies(t *testing.T) {
	store, service, user, _ := newProposalTestService(t)
	proposal, err := service.createCampaign(user.ID, campaignProposalInput{
		Blueprint: campaignProposalBlueprint{
			Campaign: createCampaignInput{Title: "Singular combat dependencies"},
			Entities: []campaignBlueprintEntity{
				{
					TempKey: "ambush",
					createEntityInput: createEntityInput{
						Kind: "quest", Title: "The ambush", Summary: "A dangerous road", Content: "Prepare for battle",
						PreparedCombat: &preparedCombatPlan{Items: []preparedCombatItem{{EntityID: "wolf", Quantity: 1}}},
					},
				},
				{TempKey: "wolf", createEntityInput: createEntityInput{Kind: "monster", Title: "Dire wolf", Summary: "A hunter", Content: "A large wolf"}},
			},
		},
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	var ambushOperation proposalOperation
	for _, operation := range proposal.Operations {
		if operation.Key == "entity:ambush" {
			ambushOperation = operation
			break
		}
	}
	if !reflect.DeepEqual(ambushOperation.DependsOn, []string{"entity:wolf"}) {
		t.Fatalf("singular preparedCombat dependencies = %#v", ambushOperation.DependsOn)
	}

	before := len(store.listCampaignsForUser(user.ID))
	_, err = service.apply(user.ID, proposal.ID, proposalApplyInput{SelectedOperationKeys: []string{"entity:ambush"}})
	if proposalErrorCode(t, err) != "missing_dependency" {
		t.Fatalf("expected singular preparedCombat dependency preflight, got %v", err)
	}
	if after := len(store.listCampaignsForUser(user.ID)); after != before {
		t.Fatalf("failed selective apply left a partial campaign: before=%d after=%d", before, after)
	}

	result, err := service.apply(user.ID, proposal.ID, proposalApplyInput{SelectedOperationKeys: []string{"entity:ambush", "entity:wolf"}})
	if err != nil {
		t.Fatalf("apply proposal with singular preparedCombat dependency: %v", err)
	}
	if result.Campaign == nil || len(result.Campaign.Quests) != 1 || len(result.Campaign.Monsters) != 1 {
		t.Fatalf("unexpected applied campaign: %#v", result.Campaign)
	}
	combat := result.Campaign.Quests[0].PreparedCombat
	if combat == nil || len(combat.Items) != 1 || combat.Items[0].EntityID != result.Campaign.Monsters[0].ID {
		t.Fatalf("singular preparedCombat reference was not rewritten: %#v", combat)
	}
}

func TestCampaignProposalApplyDoesNotPromoteMediaForExcludedOperations(t *testing.T) {
	t.Run("successful partial apply discards excluded media", func(t *testing.T) {
		_, service, user, _ := newProposalTestService(t)
		proposal, err := service.createCampaign(user.ID, campaignProposalInput{
			Blueprint: campaignProposalBlueprint{
				Campaign: createCampaignInput{Title: "Partial media campaign"},
				Entities: []campaignBlueprintEntity{
					{TempKey: "kept", createEntityInput: createEntityInput{Kind: "location", Title: "Kept place", Summary: "Kept", Content: "Kept"}},
					{TempKey: "dropped", createEntityInput: createEntityInput{Kind: "npc", Title: "Dropped guide", Summary: "Dropped", Content: "Dropped"}},
				},
			},
		})
		if err != nil {
			t.Fatalf("create campaign proposal: %v", err)
		}

		stagingDir := service.proposalStagingDir(user.ID, proposal.ID)
		if err := os.MkdirAll(stagingDir, 0o700); err != nil {
			t.Fatalf("mkdir proposal staging: %v", err)
		}
		fileName := "dropped-guide.gif"
		stagedPath := filepath.Join(stagingDir, fileName)
		if err := os.WriteFile(stagedPath, []byte("GIF89a-dropped"), 0o600); err != nil {
			t.Fatalf("write staged media: %v", err)
		}
		previewURL := proposalPreviewPath(proposal.ID, fileName)
		if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{
			ID: "dropped-media", OperationKey: "entity:dropped", Field: "art.url",
			PreviewURL: previewURL, ContentType: "image/gif", Status: "staged",
		}); err != nil {
			t.Fatalf("register staged media: %v", err)
		}

		result, err := service.apply(user.ID, proposal.ID, proposalApplyInput{SelectedOperationKeys: []string{"entity:kept"}})
		if err != nil {
			t.Fatalf("apply selected campaign operations: %v", err)
		}
		if result.Campaign == nil || len(result.Campaign.Locations) != 1 || len(result.Campaign.NPCs) != 0 {
			t.Fatalf("unexpected partial campaign: %#v", result.Campaign)
		}
		if len(result.Proposal.MediaIntents) != 1 || result.Proposal.MediaIntents[0].Status != "discarded" || result.Proposal.MediaIntents[0].FinalURL != "" {
			t.Fatalf("excluded media was not discarded: %#v", result.Proposal.MediaIntents)
		}
		if bytes.Contains(result.Proposal.After, []byte(previewURL)) {
			t.Fatalf("excluded media remained injected in applied blueprint: %s", result.Proposal.After)
		}
		if _, err := os.Stat(stagingDir); !os.IsNotExist(err) {
			t.Fatalf("committed apply should clean staging directory, stat err = %v", err)
		}
		promotedPath := filepath.Join(
			service.uploadDir,
			sanitizeUploadPathSegment(user.ID),
			sanitizeUploadPathSegment(result.Campaign.ID),
			"proposal-"+sanitizeUploadPathSegment(proposal.ID),
			fileName,
		)
		if _, err := os.Stat(promotedPath); !os.IsNotExist(err) {
			t.Fatalf("excluded media was promoted to public uploads, stat err = %v", err)
		}
	})

	t.Run("failed save restores selected and excluded staging", func(t *testing.T) {
		store, service, user, _ := newProposalTestService(t)
		proposal, err := service.createCampaign(user.ID, campaignProposalInput{
			Blueprint: campaignProposalBlueprint{
				Campaign: createCampaignInput{Title: "Rollback media campaign"},
				Entities: []campaignBlueprintEntity{
					{TempKey: "kept", createEntityInput: createEntityInput{Kind: "location", Title: "Kept place", Summary: "Kept", Content: "Kept"}},
					{TempKey: "dropped", createEntityInput: createEntityInput{Kind: "npc", Title: "Dropped guide", Summary: "Dropped", Content: "Dropped"}},
				},
			},
		})
		if err != nil {
			t.Fatalf("create campaign proposal: %v", err)
		}

		stagingDir := service.proposalStagingDir(user.ID, proposal.ID)
		if err := os.MkdirAll(stagingDir, 0o700); err != nil {
			t.Fatalf("mkdir proposal staging: %v", err)
		}
		for _, media := range []struct {
			id           string
			operationKey string
			fileName     string
		}{
			{id: "kept-media", operationKey: "entity:kept", fileName: "kept-place.gif"},
			{id: "dropped-media", operationKey: "entity:dropped", fileName: "dropped-guide.gif"},
		} {
			if err := os.WriteFile(filepath.Join(stagingDir, media.fileName), []byte("GIF89a-"+media.id), 0o600); err != nil {
				t.Fatalf("write %s: %v", media.id, err)
			}
			if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{
				ID: media.id, OperationKey: media.operationKey, Field: "art.url",
				PreviewURL: proposalPreviewPath(proposal.ID, media.fileName), ContentType: "image/gif", Status: "staged",
			}); err != nil {
				t.Fatalf("register %s: %v", media.id, err)
			}
		}
		before, err := service.get(user.ID, proposal.ID)
		if err != nil {
			t.Fatalf("get proposal before failed apply: %v", err)
		}
		campaignCount := len(store.listCampaignsForUser(user.ID))
		probe := injectProposalBackupWriteFailure(store)

		_, err = service.apply(user.ID, proposal.ID, proposalApplyInput{SelectedOperationKeys: []string{"entity:kept"}})
		if !errors.Is(err, errProposalSaveFailed) {
			t.Fatalf("apply error = %v, want proposal save failure", err)
		}
		if probe.backupAttempts != 1 || probe.primaryAttempts != 0 {
			t.Fatalf("write attempts = backup:%d primary:%d, want backup:1 primary:0", probe.backupAttempts, probe.primaryAttempts)
		}
		after, err := service.get(user.ID, proposal.ID)
		if err != nil {
			t.Fatalf("get proposal after failed apply: %v", err)
		}
		if !reflect.DeepEqual(after, before) {
			t.Fatalf("failed apply did not restore proposal:\n got: %#v\nwant: %#v", after, before)
		}
		if got := len(store.listCampaignsForUser(user.ID)); got != campaignCount {
			t.Fatalf("failed apply persisted a campaign: got %d campaigns, want %d", got, campaignCount)
		}
		for _, fileName := range []string{"kept-place.gif", "dropped-guide.gif"} {
			if _, err := os.Stat(filepath.Join(stagingDir, fileName)); err != nil {
				t.Fatalf("failed apply did not retain staged %s: %v", fileName, err)
			}
		}
		if _, err := os.Stat(service.uploadDir); err == nil {
			err = filepath.WalkDir(service.uploadDir, func(path string, entry os.DirEntry, walkErr error) error {
				if walkErr != nil {
					return walkErr
				}
				if entry.Type().IsRegular() {
					t.Fatalf("failed apply left promoted public media at %s", path)
				}
				return nil
			})
			if err != nil {
				t.Fatalf("inspect public uploads after rollback: %v", err)
			}
		} else if !os.IsNotExist(err) {
			t.Fatalf("stat public uploads after rollback: %v", err)
		}
	})
}

func TestPromptOnlyCampaignProposalGeneratesBlueprintAndApplies(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "campaign-generator-gm")
	beforeRecorder := accountTestRequest(t, handler, http.MethodGet, "/api/campaigns", "", cookies)
	before := decodeAccountTestData[[]campaignSummary](t, beforeRecorder)

	create := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/campaign", `{"prompt":"Мрачная кампания о затонувшем городе и пропавшем картографе"}`, cookies)
	if create.Code != http.StatusCreated {
		t.Fatalf("prompt-only campaign proposal status = %d, body = %s", create.Code, create.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, create)
	if proposal.Kind != "campaign_create" || proposal.Status != "pending" || proposal.Source.Provider != "local-scaffold" {
		t.Fatalf("unexpected generated campaign proposal: %#v", proposal)
	}
	var blueprint campaignProposalBlueprint
	if err := json.Unmarshal(proposal.After, &blueprint); err != nil {
		t.Fatalf("decode generated blueprint: %v", err)
	}
	if len(blueprint.Entities) < 3 || len(blueprint.Events) < 1 || blueprint.Campaign.Title == "" {
		t.Fatalf("generated blueprint is not a usable bounded campaign: %#v", blueprint)
	}
	beforeApplyRecorder := accountTestRequest(t, handler, http.MethodGet, "/api/campaigns", "", cookies)
	beforeApply := decodeAccountTestData[[]campaignSummary](t, beforeApplyRecorder)
	if len(beforeApply) != len(before) {
		t.Fatalf("proposal creation directly mutated campaign list: before=%d after=%d", len(before), len(beforeApply))
	}

	apply := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/"+proposal.ID+"/apply", "", cookies)
	if apply.Code != http.StatusOK {
		t.Fatalf("apply generated campaign status = %d, body = %s", apply.Code, apply.Body.String())
	}
	result := decodeAccountTestData[proposalActionResult](t, apply)
	if result.Campaign == nil || len(result.Campaign.Locations) == 0 || len(result.Campaign.NPCs) == 0 || len(result.Campaign.Quests) == 0 || len(result.Campaign.Events) == 0 {
		t.Fatalf("generated campaign did not apply coherently: %#v", result.Campaign)
	}
	if result.Campaign.NPCs[0].LocationID != result.Campaign.Locations[0].ID || result.Campaign.Quests[0].IssuerID != result.Campaign.NPCs[0].ID {
		t.Fatalf("generated temp-key links were not rewritten: %#v", result.Campaign)
	}
}

func TestDirectCampaignBlueprintIsNotReplacedByPromptGenerator(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "direct-blueprint-gm")
	body := `{
		"prompt":"This prompt must not replace the supplied blueprint",
		"blueprint":{
			"campaign":{"title":"Direct blueprint","system":"D&D 5e","settingName":"Direct world","inWorldDate":"2 Hammer","summary":"Supplied by MCP"},
			"entities":[{"tempKey":"direct-town","kind":"location","title":"Direct Town","summary":"Town","content":"Town"}],
			"events":[]
		}
	}`
	create := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/campaign", body, cookies)
	if create.Code != http.StatusCreated {
		t.Fatalf("direct campaign proposal status = %d, body = %s", create.Code, create.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, create)
	var blueprint campaignProposalBlueprint
	if err := json.Unmarshal(proposal.After, &blueprint); err != nil {
		t.Fatalf("decode direct blueprint: %v", err)
	}
	if blueprint.Campaign.Title != "Direct blueprint" || len(blueprint.Entities) != 1 || blueprint.Entities[0].Title != "Direct Town" {
		t.Fatalf("direct blueprint was replaced by generator: %#v", blueprint)
	}
}

func TestPromptOnlyEntityUpdateRouteUsesConstrainedPatch(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "constrained-update-gm")
	createCampaign := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Safe AI","system":"D&D 5e","settingName":"Safe","inWorldDate":"1 Hammer","summary":"Safe"}`, cookies)
	campaign := decodeAccountTestData[campaignData](t, createCampaign)
	entityBody := `{
		"kind":"quest","title":"Original title","subtitle":"Original subtitle","summary":"Original summary","content":"Original content",
		"playerContent":"Original player content","playerCards":[{"title":"Handout","content":"Keep handout"}],
		"tags":["keep-tag"],"quickFacts":[{"label":"Reward","value":"100 gp"}],"related":[],
		"art":{"url":"/uploads/original.png","alt":"Original art","caption":"Original caption"},
		"playlist":[{"title":"Theme","url":"https://example.test/theme"}],
		"gallery":[{"title":"Gallery","url":"/uploads/gallery.png","caption":"Keep gallery"}],
		"status":"active","urgency":"High","preparedCombats":[]
	}`
	createEntityRecorder := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/entities", entityBody, cookies)
	if createEntityRecorder.Code != http.StatusCreated {
		t.Fatalf("create route entity status = %d, body = %s", createEntityRecorder.Code, createEntityRecorder.Body.String())
	}
	created := decodeAccountTestData[createEntityResult](t, createEntityRecorder).Entity

	proposalBody := `{"mode":"update","kind":"quest","entityId":` + strconvQuote(created.ID) + `,"prompt":"Переименуй квест в «Новый путь»"}`
	propose := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/ai/proposals/entities", proposalBody, cookies)
	if propose.Code != http.StatusCreated {
		t.Fatalf("prompt-only update status = %d, body = %s", propose.Code, propose.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, propose)
	var candidate knowledgeEntity
	if err := json.Unmarshal(proposal.After, &candidate); err != nil {
		t.Fatalf("decode constrained candidate: %v", err)
	}
	if candidate.Title != "Новый путь" {
		t.Fatalf("candidate title = %q", candidate.Title)
	}
	if candidate.Summary != created.Summary || candidate.Content != created.Content || candidate.PlayerContent != created.PlayerContent || candidate.Subtitle != created.Subtitle {
		t.Fatalf("constrained title change rewrote unrelated text: %#v", candidate)
	}
	if candidate.Art == nil || candidate.Art.URL != created.Art.URL || len(candidate.Gallery) != 1 || len(candidate.Playlist) != 1 || len(candidate.PlayerCards) != 1 || len(candidate.QuickFacts) != 1 {
		t.Fatalf("constrained update lost rich fields: %#v", candidate)
	}
	if len(proposal.Diff) != 1 || proposal.Diff[0].Path != "title" {
		t.Fatalf("expected title-only diff, got %#v", proposal.Diff)
	}
}

func TestProposalMediaIntentValidationAndCanonicalFields(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Canonical media"}`),
		MediaIntents: []proposalMediaIntent{{ID: "intent-art", Field: "art", Prompt: "Portrait", Status: "intent"}},
	})
	if err != nil {
		t.Fatalf("create proposal with art alias: %v", err)
	}
	if len(proposal.MediaIntents) != 1 || proposal.MediaIntents[0].Field != "art.url" {
		t.Fatalf("art alias was not canonicalized: %#v", proposal.MediaIntents)
	}

	beforeCount := len(store.data.AIProposals)
	_, err = service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Forged media"}`),
		MediaIntents: []proposalMediaIntent{{ID: "forged", Field: "art.url", PreviewURL: "/uploads/forged.png", ContentType: "image/png", Size: 10, Status: "staged"}},
	})
	if proposalErrorCode(t, err) != "server_owned_media_fields" {
		t.Fatalf("forged media fields error = %v", err)
	}
	if len(store.data.AIProposals) != beforeCount {
		t.Fatal("invalid client media intent created a proposal")
	}
	_, err = service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Forged status"}`),
		MediaIntents: []proposalMediaIntent{{ID: "forged-status", Field: "art.url", Status: "promoted"}},
	})
	if proposalErrorCode(t, err) != "server_owned_media_status" {
		t.Fatalf("forged media status error = %v", err)
	}

	_, err = service.createCampaign(user.ID, campaignProposalInput{
		Blueprint: campaignProposalBlueprint{
			Campaign: createCampaignInput{Title: "Media campaign", System: "D&D 5e", SettingName: "Test", InWorldDate: "1 Hammer", Summary: "Test"},
			Entities: []campaignBlueprintEntity{{TempKey: "town", createEntityInput: createEntityInput{Kind: "location", Title: "Town"}}},
		},
		MediaIntents: []proposalMediaIntent{{ID: "root-image", Field: "keyScene", Prompt: "Scene", Status: "intent"}},
	})
	if proposalErrorCode(t, err) != "unsupported_media_field" {
		t.Fatalf("campaign-root media error = %v", err)
	}

	_, err = service.createCampaign(user.ID, campaignProposalInput{
		Blueprint: campaignProposalBlueprint{
			Campaign: createCampaignInput{Title: "Media campaign", System: "D&D 5e", SettingName: "Test", InWorldDate: "1 Hammer", Summary: "Test"},
			Entities: []campaignBlueprintEntity{{TempKey: "town", createEntityInput: createEntityInput{Kind: "location", Title: "Town"}}},
		},
		MediaIntents: []proposalMediaIntent{{ID: "root-art", Field: "art.url", Prompt: "Scene", Status: "intent"}},
	})
	if proposalErrorCode(t, err) != "unsupported_media_target" {
		t.Fatalf("campaign-root art target error = %v", err)
	}
}

func TestProposalMediaRetargetRemovesPriorEntityInjection(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Retarget media"}`),
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	previewURL := proposalPreviewPath(proposal.ID, "retarget.gif")
	if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{
		ID: "retarget", Field: "art", PreviewURL: previewURL, Alt: "Retargeted", Status: "staged",
	}); err != nil {
		t.Fatalf("register media: %v", err)
	}
	result, err := service.updateMediaAttachment(user.ID, proposal.ID, proposalMediaAttachmentInput{MediaID: "retarget", Field: "gallery"})
	if err != nil {
		t.Fatalf("retarget media: %v", err)
	}
	var candidate knowledgeEntity
	if err := json.Unmarshal(result.Proposal.After, &candidate); err != nil {
		t.Fatalf("decode retargeted candidate: %v", err)
	}
	if candidate.Art == nil || candidate.Art.URL != entity.Art.URL {
		t.Fatalf("old art injection was not restored: %#v", candidate.Art)
	}
	previewCount := 0
	for _, image := range candidate.Gallery {
		if image.URL == previewURL {
			previewCount++
		}
	}
	if previewCount != 1 || result.Media.Field != "gallery" {
		t.Fatalf("retargeted gallery injection count=%d media=%#v candidate=%#v", previewCount, result.Media, candidate)
	}
}

func TestCampaignProposalMediaRetargetRemovesPriorOperationInjection(t *testing.T) {
	_, service, user, _ := newProposalTestService(t)
	proposal, err := service.createCampaign(user.ID, campaignProposalInput{Blueprint: campaignProposalBlueprint{
		Campaign: createCampaignInput{Title: "Retarget ops", System: "D&D 5e", SettingName: "Test", InWorldDate: "1 Hammer", Summary: "Test"},
		Entities: []campaignBlueprintEntity{
			{TempKey: "first", createEntityInput: createEntityInput{Kind: "location", Title: "First"}},
			{TempKey: "second", createEntityInput: createEntityInput{Kind: "npc", Title: "Second"}},
		},
	}})
	if err != nil {
		t.Fatalf("create campaign proposal: %v", err)
	}
	previewURL := proposalPreviewPath(proposal.ID, "operation-retarget.gif")
	if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{
		ID: "operation-retarget", OperationKey: "entity:first", Field: "art.url", PreviewURL: previewURL, Status: "staged",
	}); err != nil {
		t.Fatalf("register operation media: %v", err)
	}
	result, err := service.updateMediaAttachment(user.ID, proposal.ID, proposalMediaAttachmentInput{
		MediaID: "operation-retarget", OperationKey: "entity:second",
	})
	if err != nil {
		t.Fatalf("retarget operation media: %v", err)
	}
	var blueprint campaignProposalBlueprint
	if err := json.Unmarshal(result.Proposal.After, &blueprint); err != nil {
		t.Fatalf("decode retargeted blueprint: %v", err)
	}
	if blueprint.Entities[0].Art != nil {
		t.Fatalf("old operation retained injected art: %#v", blueprint.Entities[0])
	}
	if blueprint.Entities[1].Art == nil || blueprint.Entities[1].Art.URL != previewURL {
		t.Fatalf("new operation did not receive media: %#v", blueprint.Entities[1])
	}
}

func TestProposalMediaAttachmentSaveFailureRestoresEntireProposal(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Rollback media"}`),
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	previewURL := proposalPreviewPath(proposal.ID, "rollback.gif")
	if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{ID: "rollback", Field: "art.url", PreviewURL: previewURL, Status: "staged"}); err != nil {
		t.Fatalf("register media: %v", err)
	}
	store.mu.Lock()
	proposalIndex := findOwnedProposalIndexLocked(&store.data, user.ID, proposal.ID)
	store.data.AIProposals[proposalIndex].UpdatedAt = "2001-02-03T04:05:06Z"
	store.data.AIProposals[proposalIndex].Diff = []proposalFieldDiff{{Path: "sentinel", Before: "before", After: "after"}}
	want := cloneProposal(store.data.AIProposals[proposalIndex])
	store.mu.Unlock()
	probe := injectProposalBackupWriteFailure(store)

	if _, err := service.updateMediaAttachment(user.ID, proposal.ID, proposalMediaAttachmentInput{MediaID: "rollback", Field: "gallery", Alt: "Changed"}); !errors.Is(err, errInjectedBackupWrite) {
		t.Fatalf("update attachment error = %v, want injected backup failure", err)
	}
	got, err := service.get(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("get proposal after failed media update: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("failed media save did not restore full proposal:\n got: %#v\nwant: %#v", got, want)
	}
	if probe.backupAttempts != 1 || probe.primaryAttempts != 0 {
		t.Fatalf("write attempts = backup:%d primary:%d", probe.backupAttempts, probe.primaryAttempts)
	}
}

func TestProposalMediaRegisterSaveFailureRestoresEntireProposal(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Register rollback"}`),
	})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	want, err := service.get(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("get proposal snapshot: %v", err)
	}
	wantPrimary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary before register: %v", err)
	}
	probe := injectProposalBackupWriteFailure(store)
	_, err = service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{
		ID: "failed-register", Field: "art.url", PreviewURL: proposalPreviewPath(proposal.ID, "failed-register.gif"), Status: "staged",
	})
	if !errors.Is(err, errInjectedBackupWrite) {
		t.Fatalf("register media error = %v, want injected backup failure", err)
	}
	got, err := service.get(user.ID, proposal.ID)
	if err != nil {
		t.Fatalf("get proposal after register failure: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("failed register did not restore full proposal:\n got: %#v\nwant: %#v", got, want)
	}
	gotPrimary, err := os.ReadFile(store.path)
	if err != nil || !bytes.Equal(gotPrimary, wantPrimary) {
		t.Fatalf("failed register changed primary: err=%v", err)
	}
	if probe.backupAttempts != 1 || probe.primaryAttempts != 0 {
		t.Fatalf("write attempts = backup:%d primary:%d", probe.backupAttempts, probe.primaryAttempts)
	}
}

func TestDeselectedProposalMediaRestoresCandidateAndIsNotApplied(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"With optional art"}`)})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	stagingDir := service.proposalStagingDir(user.ID, proposal.ID)
	if err := os.MkdirAll(stagingDir, 0o700); err != nil {
		t.Fatalf("mkdir staging: %v", err)
	}
	fileName := "media-test.png"
	if err := os.WriteFile(filepath.Join(stagingDir, fileName), []byte("staged"), 0o600); err != nil {
		t.Fatalf("write staged media: %v", err)
	}
	previewURL := proposalPreviewPath(proposal.ID, fileName)
	mediaResult, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{ID: "media-test", Field: "art.url", PreviewURL: previewURL, Alt: "Generated art", Status: "staged"})
	if err != nil {
		t.Fatalf("register staged media: %v", err)
	}
	if !strings.Contains(string(mediaResult.Proposal.After), previewURL) {
		t.Fatalf("staged media was not injected into preview: %s", mediaResult.Proposal.After)
	}
	selected := false
	deselected, err := service.updateMediaAttachment(user.ID, proposal.ID, proposalMediaAttachmentInput{MediaID: "media-test", Selected: &selected})
	if err != nil {
		t.Fatalf("deselect media: %v", err)
	}
	if strings.Contains(string(deselected.Proposal.After), previewURL) {
		t.Fatalf("deselected staging URL remained in candidate: %s", deselected.Proposal.After)
	}
	var candidate knowledgeEntity
	if err := json.Unmarshal(deselected.Proposal.After, &candidate); err != nil {
		t.Fatalf("decode deselected candidate: %v", err)
	}
	if candidate.Art == nil || candidate.Art.URL != entity.Art.URL || candidate.Art.Alt != entity.Art.Alt {
		t.Fatalf("deselect did not restore authoritative art: %#v", candidate.Art)
	}
	applied, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
	if err != nil {
		t.Fatalf("apply deselected media proposal: %v", err)
	}
	if applied.Entity == nil || applied.Entity.Art == nil || applied.Entity.Art.URL != entity.Art.URL || strings.Contains(string(applied.Proposal.AppliedResult), previewURL) {
		t.Fatalf("deselected staged URL was applied: %#v", applied)
	}
	if _, err := os.Stat(stagingDir); !os.IsNotExist(err) {
		t.Fatalf("staging directory should be cleaned after apply, stat err = %v", err)
	}
}

func TestRejectCleansStagedProposalMedia(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"Reject media"}`)})
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	stagingDir := service.proposalStagingDir(user.ID, proposal.ID)
	if err := os.MkdirAll(stagingDir, 0o700); err != nil {
		t.Fatalf("mkdir staging: %v", err)
	}
	fileName := "reject-media.png"
	if err := os.WriteFile(filepath.Join(stagingDir, fileName), []byte("staged"), 0o600); err != nil {
		t.Fatalf("write staged media: %v", err)
	}
	previewURL := proposalPreviewPath(proposal.ID, fileName)
	if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{ID: "reject-media", Field: "gallery", PreviewURL: previewURL, Status: "staged"}); err != nil {
		t.Fatalf("register staged media: %v", err)
	}
	if _, err := service.reject(user.ID, proposal.ID); err != nil {
		t.Fatalf("reject proposal: %v", err)
	}
	if _, err := os.Stat(stagingDir); !os.IsNotExist(err) {
		t.Fatalf("staging directory should be cleaned after reject, stat err = %v", err)
	}
	current, _ := store.getCampaignForUser(user.ID, campaign.ID)
	_, _, storedEntity := findEntityInCampaign(&current, entity.ID)
	if storedEntity.Title != entity.Title || storedEntity.Art.URL != entity.Art.URL {
		t.Fatalf("reject mutated entity: %#v", storedEntity)
	}
}

func TestProposalMediaMultipartRejectsVideoBeforeStaging(t *testing.T) {
	root := t.TempDir()
	uploadDir := filepath.Join(root, "uploads")
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: uploadDir})
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}
	cookies := registerAccountTestUser(t, handler, "proposal-video-gm")
	create := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/campaign", `{
		"prompt":"Prepare an image-only proposal",
		"blueprint":{
			"campaign":{"title":"Image-only campaign"},
			"entities":[{"tempKey":"subject","kind":"npc","title":"Subject"}]
		}
	}`, cookies)
	if create.Code != http.StatusCreated {
		t.Fatalf("create proposal status=%d body=%s", create.Code, create.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, create)

	tests := []struct {
		name     string
		fileName string
		content  []byte
	}{
		{name: "mp4", fileName: "portrait.mp4", content: []byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}},
		{name: "webm", fileName: "portrait.webm", content: []byte{0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var requestBody bytes.Buffer
			form := multipart.NewWriter(&requestBody)
			part, createErr := form.CreateFormFile("file", test.fileName)
			if createErr != nil {
				t.Fatalf("create media form file: %v", createErr)
			}
			if _, writeErr := part.Write(test.content); writeErr != nil {
				t.Fatalf("write media form file: %v", writeErr)
			}
			if writeErr := form.WriteField("operationKey", "entity:subject"); writeErr != nil {
				t.Fatalf("write media operation key: %v", writeErr)
			}
			if writeErr := form.WriteField("field", "art.url"); writeErr != nil {
				t.Fatalf("write media field: %v", writeErr)
			}
			if closeErr := form.Close(); closeErr != nil {
				t.Fatalf("close media form: %v", closeErr)
			}

			request := httptest.NewRequest(http.MethodPost, "/api/ai/proposals/"+proposal.ID+"/media", &requestBody)
			request.Header.Set("Content-Type", form.FormDataContentType())
			for _, cookie := range cookies {
				request.AddCookie(cookie)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusBadRequest || !strings.Contains(response.Body.String(), `"code":"unsupported_media"`) {
				t.Fatalf("video upload status=%d body=%s", response.Code, response.Body.String())
			}

			storedResponse := accountTestRequest(t, handler, http.MethodGet, "/api/ai/proposals/"+proposal.ID, "", cookies)
			stored := decodeAccountTestData[aiProposal](t, storedResponse)
			if len(stored.MediaIntents) != 0 {
				t.Fatalf("rejected video created media intents: %#v", stored.MediaIntents)
			}
			if _, statErr := os.Stat(uploadDir + ".proposals"); !os.IsNotExist(statErr) {
				t.Fatalf("rejected video created proposal staging, stat err = %v", statErr)
			}
		})
	}
}

func TestProposalMediaMultipartEnforcesFileLimitOutsideMultipartEnvelope(t *testing.T) {
	root := t.TempDir()
	uploadDir := filepath.Join(root, "uploads")
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: uploadDir})
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}
	cookies := registerAccountTestUser(t, handler, "proposal-size-gm")
	create := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/campaign", `{
		"prompt":"Prepare bounded proposal media",
		"blueprint":{
			"campaign":{"title":"Bounded media campaign"},
			"entities":[{"tempKey":"subject","kind":"npc","title":"Subject"}]
		}
	}`, cookies)
	if create.Code != http.StatusCreated {
		t.Fatalf("create proposal status=%d body=%s", create.Code, create.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, create)

	upload := func(t *testing.T, fileSize int) *httptest.ResponseRecorder {
		t.Helper()
		var requestBody bytes.Buffer
		requestBody.Grow(fileSize + 1024)
		form := multipart.NewWriter(&requestBody)
		part, createErr := form.CreateFormFile("file", "portrait.png")
		if createErr != nil {
			t.Fatalf("create media form file: %v", createErr)
		}
		signature := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
		if _, writeErr := part.Write(signature); writeErr != nil {
			t.Fatalf("write PNG signature: %v", writeErr)
		}
		padding := make([]byte, 64<<10)
		for remaining := fileSize - len(signature); remaining > 0; {
			chunkSize := len(padding)
			if remaining < chunkSize {
				chunkSize = remaining
			}
			if _, writeErr := part.Write(padding[:chunkSize]); writeErr != nil {
				t.Fatalf("write PNG padding: %v", writeErr)
			}
			remaining -= chunkSize
		}
		if writeErr := form.WriteField("operationKey", "entity:subject"); writeErr != nil {
			t.Fatalf("write media operation key: %v", writeErr)
		}
		if writeErr := form.WriteField("field", "art.url"); writeErr != nil {
			t.Fatalf("write media field: %v", writeErr)
		}
		if closeErr := form.Close(); closeErr != nil {
			t.Fatalf("close media form: %v", closeErr)
		}

		request := httptest.NewRequest(http.MethodPost, "/api/ai/proposals/"+proposal.ID+"/media", &requestBody)
		request.Header.Set("Content-Type", form.FormDataContentType())
		for _, cookie := range cookies {
			request.AddCookie(cookie)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}

	oversized := upload(t, maxProposalMediaSize+1)
	if oversized.Code != http.StatusRequestEntityTooLarge || !strings.Contains(oversized.Body.String(), `"code":"file_too_large"`) {
		t.Fatalf("oversized upload status=%d body=%s", oversized.Code, oversized.Body.String())
	}
	storedResponse := accountTestRequest(t, handler, http.MethodGet, "/api/ai/proposals/"+proposal.ID, "", cookies)
	stored := decodeAccountTestData[aiProposal](t, storedResponse)
	if len(stored.MediaIntents) != 0 {
		t.Fatalf("oversized upload created media intents: %#v", stored.MediaIntents)
	}

	exact := upload(t, maxProposalMediaSize)
	if exact.Code != http.StatusCreated {
		t.Fatalf("exact-limit upload status=%d body=%s", exact.Code, exact.Body.String())
	}
	result := decodeAccountTestData[proposalMediaResult](t, exact)
	if result.Media.Size != maxProposalMediaSize || result.Media.ContentType != "image/png" {
		t.Fatalf("exact-limit media = %#v", result.Media)
	}
}

func TestProposalMediaPreviewRequiresOwnerAndPromotionRemainsPublic(t *testing.T) {
	root := t.TempDir()
	uploadDir := filepath.Join(root, "uploads")
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: uploadDir})
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}
	aliceCookies := registerAccountTestUser(t, handler, "preview-alice")
	bobCookies := registerAccountTestUser(t, handler, "preview-bob")
	createCampaign := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Private previews","system":"D&D 5e","settingName":"Test","inWorldDate":"1 Hammer","summary":"Test"}`, aliceCookies)
	campaign := decodeAccountTestData[campaignData](t, createCampaign)
	createEntity := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/entities", `{"kind":"npc","title":"Portrait target","summary":"Test","content":"Test"}`, aliceCookies)
	entity := decodeAccountTestData[createEntityResult](t, createEntity).Entity
	createProposal := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns/"+campaign.ID+"/ai/proposals/entities", `{"mode":"update","kind":"npc","entityId":`+strconvQuote(entity.ID)+`,"patch":{"title":"With portrait"}}`, aliceCookies)
	if createProposal.Code != http.StatusCreated {
		t.Fatalf("create proposal status=%d body=%s", createProposal.Code, createProposal.Body.String())
	}
	proposal := decodeAccountTestData[aiProposal](t, createProposal)

	mediaBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
	var requestBody bytes.Buffer
	form := multipart.NewWriter(&requestBody)
	part, err := form.CreateFormFile("file", "portrait.png")
	if err != nil {
		t.Fatalf("create media form file: %v", err)
	}
	if _, err := part.Write(mediaBytes); err != nil {
		t.Fatalf("write media form file: %v", err)
	}
	if err := form.WriteField("field", "art"); err != nil {
		t.Fatalf("write media field: %v", err)
	}
	if err := form.Close(); err != nil {
		t.Fatalf("close media form: %v", err)
	}
	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/ai/proposals/"+proposal.ID+"/media", &requestBody)
	uploadRequest.Header.Set("Content-Type", form.FormDataContentType())
	for _, cookie := range aliceCookies {
		uploadRequest.AddCookie(cookie)
	}
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("media upload status=%d body=%s", uploadResponse.Code, uploadResponse.Body.String())
	}
	mediaResult := decodeAccountTestData[proposalMediaResult](t, uploadResponse)
	if mediaResult.Media.Field != "art.url" || mediaResult.Media.Alt != "portrait.png" || !strings.HasPrefix(mediaResult.Media.PreviewURL, "/api/ai/proposals/"+proposal.ID+"/media/") {
		t.Fatalf("unexpected private media result: %#v", mediaResult.Media)
	}
	if _, err := os.Stat(filepath.Join(uploadDir, ".proposals")); !os.IsNotExist(err) {
		t.Fatalf("proposal staging must not exist inside public uploads, stat err=%v", err)
	}

	anonymous := accountTestRequest(t, handler, http.MethodGet, mediaResult.Media.PreviewURL, "", nil)
	if anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous preview status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}
	crossOwner := accountTestRequest(t, handler, http.MethodGet, mediaResult.Media.PreviewURL, "", bobCookies)
	if crossOwner.Code != http.StatusNotFound {
		t.Fatalf("cross-owner preview status=%d body=%s", crossOwner.Code, crossOwner.Body.String())
	}
	ownerPreview := accountTestRequest(t, handler, http.MethodGet, mediaResult.Media.PreviewURL, "", aliceCookies)
	if ownerPreview.Code != http.StatusOK || !bytes.Equal(ownerPreview.Body.Bytes(), mediaBytes) {
		t.Fatalf("owner preview status=%d body=%q", ownerPreview.Code, ownerPreview.Body.Bytes())
	}
	if ownerPreview.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("owner preview cache control=%q", ownerPreview.Header().Get("Cache-Control"))
	}

	legacyDir := filepath.Join(uploadDir, ".proposals")
	if err := os.MkdirAll(legacyDir, 0o700); err != nil {
		t.Fatalf("mkdir legacy staging: %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "leak.gif"), mediaBytes, 0o600); err != nil {
		t.Fatalf("write legacy staging: %v", err)
	}
	legacyPublic := accountTestRequest(t, handler, http.MethodGet, "/uploads/.proposals/leak.gif", "", nil)
	if legacyPublic.Code != http.StatusNotFound {
		t.Fatalf("legacy public staging status=%d", legacyPublic.Code)
	}

	apply := accountTestRequest(t, handler, http.MethodPost, "/api/ai/proposals/"+proposal.ID+"/apply", "", aliceCookies)
	if apply.Code != http.StatusOK {
		t.Fatalf("apply media proposal status=%d body=%s", apply.Code, apply.Body.String())
	}
	applied := decodeAccountTestData[proposalActionResult](t, apply)
	if len(applied.Proposal.MediaIntents) != 1 || applied.Proposal.MediaIntents[0].Status != "promoted" || !strings.HasPrefix(applied.Proposal.MediaIntents[0].FinalURL, "/uploads/") {
		t.Fatalf("unexpected promoted media: %#v", applied.Proposal.MediaIntents)
	}
	if applied.Entity == nil || applied.Entity.Art == nil || applied.Entity.Art.Alt != "portrait.png" {
		t.Fatalf("multipart filename alt was not persisted into candidate: %#v", applied.Entity)
	}
	previewAfterApply := accountTestRequest(t, handler, http.MethodGet, mediaResult.Media.PreviewURL, "", aliceCookies)
	if previewAfterApply.Code != http.StatusNotFound {
		t.Fatalf("staged preview after apply status=%d", previewAfterApply.Code)
	}
	publicFinal := accountTestRequest(t, handler, http.MethodGet, applied.Proposal.MediaIntents[0].FinalURL, "", nil)
	if publicFinal.Code != http.StatusOK || !bytes.Equal(publicFinal.Body.Bytes(), mediaBytes) {
		t.Fatalf("promoted public media status=%d body=%q", publicFinal.Code, publicFinal.Body.Bytes())
	}
}

func TestProposalSourceCodexProvenanceRequiresEphemeralBridgeSession(t *testing.T) {
	browserRequest := httptest.NewRequest(http.MethodPost, "/api/ai/proposals/entity", nil)
	browserRequest.AddCookie(&http.Cookie{Name: "shadow_edge_session", Value: "session-browser"})
	browserSource := proposalSource{Type: "codex_app_server"}
	if err := bindProposalSourceToSession(browserRequest, &browserSource); err == nil {
		t.Fatal("browser session was allowed to forge codex_app_server provenance")
	}

	bridgeRequest := httptest.NewRequest(http.MethodPost, "/api/ai/proposals/entity", nil)
	bridgeRequest.AddCookie(&http.Cookie{Name: "shadow_edge_session", Value: "ephemeral_managed_bridge"})
	bridgeSource := proposalSource{Type: "mcp"}
	if err := bindProposalSourceToSession(bridgeRequest, &bridgeSource); err != nil {
		t.Fatalf("bridge provenance binding failed: %v", err)
	}
	if bridgeSource.Type != "codex_app_server" {
		t.Fatalf("bridge source type = %q", bridgeSource.Type)
	}
}
