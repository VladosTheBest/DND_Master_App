package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

var errInjectedOrdinaryStoreSave = errors.New("injected ordinary store save failure")

func newOrdinaryMutationTestStore(t *testing.T) (*campaignStore, campaignData) {
	t.Helper()
	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}
	campaign, err := store.createCampaign(createCampaignInput{
		Title:       "Transactional campaign",
		System:      "D&D 5e",
		SettingName: "Rollback world",
		InWorldDate: "1 Hammer",
		Summary:     "Committed baseline",
	})
	if err != nil {
		t.Fatalf("createCampaign() error = %v", err)
	}
	return store, campaign
}

func snapshotOrdinaryStoreState(t *testing.T, store *campaignStore) storageState {
	t.Helper()
	store.mu.RLock()
	defer store.mu.RUnlock()
	state, err := cloneStorageState(store.data)
	if err != nil {
		t.Fatalf("cloneStorageState() error = %v", err)
	}
	return state
}

func injectOrdinaryStoreSaveFailure(store *campaignStore) {
	store.atomicFileWrite = func(target string, body []byte, mode os.FileMode) error {
		if target == store.backupPath() {
			return errInjectedOrdinaryStoreSave
		}
		return writeFileAtomically(target, body, mode)
	}
	store.atomicFileReplace = replaceFile
}

func clearOrdinaryStoreSaveFailure(store *campaignStore) {
	store.atomicFileWrite = nil
	store.atomicFileReplace = nil
}

func assertOrdinaryMutationRollsBack(t *testing.T, store *campaignStore, mutate func() error) {
	t.Helper()
	wantState := snapshotOrdinaryStoreState(t, store)
	wantPrimary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary before mutation: %v", err)
	}

	injectOrdinaryStoreSaveFailure(store)
	defer clearOrdinaryStoreSaveFailure(store)
	if err := mutate(); !errors.Is(err, errInjectedOrdinaryStoreSave) {
		t.Fatalf("mutation error = %v, want injected save failure", err)
	}

	gotState := snapshotOrdinaryStoreState(t, store)
	if !reflect.DeepEqual(gotState, wantState) {
		t.Fatalf("failed mutation changed live state:\n got: %#v\nwant: %#v", gotState, wantState)
	}
	gotPrimary, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatalf("read primary after mutation: %v", err)
	}
	if !bytes.Equal(gotPrimary, wantPrimary) {
		t.Fatal("failed mutation changed durable primary")
	}
}

func TestCampaignStoreOrdinaryMutatorsRollbackOnSaveFailure(t *testing.T) {
	t.Run("user creation and first-owner assignment", func(t *testing.T) {
		store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
		if err != nil {
			t.Fatalf("newCampaignStore() error = %v", err)
		}
		assertOrdinaryMutationRollsBack(t, store, func() error {
			_, err := store.createUser("rollback-user", "secret123")
			return err
		})
	})

	t.Run("campaign update", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		assertOrdinaryMutationRollsBack(t, store, func() error {
			_, err := store.updateCampaign(campaign.ID, updateCampaignInput{
				CombatPlaylist: []playlistTrack{{Title: "Should roll back", URL: "https://example.test/rollback"}},
			})
			return err
		})
	})

	t.Run("player display token", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		assertOrdinaryMutationRollsBack(t, store, func() error {
			return store.setPlayerDisplayToken(campaign.ID, "should-not-survive")
		})
	})

	t.Run("event deletion", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		created, err := store.createWorldEvent(campaign.ID, createWorldEventInput{
			Title: "Committed event", Summary: "Baseline", Type: "scene", SceneText: "Baseline",
		})
		if err != nil {
			t.Fatalf("createWorldEvent() error = %v", err)
		}
		assertOrdinaryMutationRollsBack(t, store, func() error {
			_, err := store.deleteWorldEvent(campaign.ID, created.Event.ID)
			return err
		})
	})

	t.Run("entity deletion", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		created, err := store.createEntity(campaign.ID, createEntityInput{
			Kind: "npc", Title: "Committed NPC", Summary: "Baseline", Content: "Baseline",
		})
		if err != nil {
			t.Fatalf("createEntity() error = %v", err)
		}
		assertOrdinaryMutationRollsBack(t, store, func() error {
			_, err := store.deleteEntity(campaign.ID, created.Entity.ID)
			return err
		})
	})

	t.Run("combat start", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		assertOrdinaryMutationRollsBack(t, store, func() error {
			_, err := store.startCombat(campaign.ID, startCombatInput{
				Title: "Should roll back",
				ManualParticipants: []manualCombatantInput{{
					Title: "Temporary foe", Role: "enemy", MaxHitPoints: 10, CurrentHitPoints: 10,
				}},
			})
			return err
		})
	})

	t.Run("survey invitation", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		assertOrdinaryMutationRollsBack(t, store, func() error {
			_, err := store.createSurveyInvite(campaign.ID, "Temporary player")
			return err
		})
	})

	t.Run("survey submission", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		token, err := store.createSurveyInvite(campaign.ID, "Committed player")
		if err != nil {
			t.Fatalf("createSurveyInvite() error = %v", err)
		}
		assertOrdinaryMutationRollsBack(t, store, func() error {
			return store.saveSurveyResponse(token, campaign.ID, surveyInput{Name: "Temporary response"})
		})
	})

	t.Run("survey response deletion", func(t *testing.T) {
		store, campaign := newOrdinaryMutationTestStore(t)
		token, err := store.createSurveyInvite(campaign.ID, "Committed player")
		if err != nil {
			t.Fatalf("createSurveyInvite() error = %v", err)
		}
		if err := store.saveSurveyResponse(token, campaign.ID, surveyInput{Name: "Committed response"}); err != nil {
			t.Fatalf("saveSurveyResponse() error = %v", err)
		}
		responses := store.listSurveyResponses(campaign.ID)
		if len(responses) != 1 {
			t.Fatalf("response count = %d, want 1", len(responses))
		}
		assertOrdinaryMutationRollsBack(t, store, func() error {
			if store.deleteSurveyResponse(campaign.ID, responses[0].ID) {
				return nil
			}
			return errInjectedOrdinaryStoreSave
		})
	})
}

func TestFailedOrdinaryEntityUpdateDoesNotPersistOrStaleProposal(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{
		Mode:     "update",
		Kind:     entity.Kind,
		EntityID: entity.ID,
		Prompt:   "Update only the summary",
		Patch:    json.RawMessage(`{"summary":"Proposal summary"}`),
	})
	if err != nil {
		t.Fatalf("createEntity() proposal error = %v", err)
	}

	failedInput := entityCreateInputFromData(entity)
	failedInput.Title = "Failed ordinary update"
	assertOrdinaryMutationRollsBack(t, store, func() error {
		_, err := store.updateEntity(campaign.ID, entity.ID, failedInput)
		return err
	})

	if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); err != nil {
		t.Fatalf("apply proposal after failed ordinary update: %v", err)
	}

	reloaded, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatalf("newCampaignStore(reload) error = %v", err)
	}
	reloadedCampaign, err := reloaded.getCampaignForUser(user.ID, campaign.ID)
	if err != nil {
		t.Fatalf("getCampaignForUser(reload) error = %v", err)
	}
	reloadedEntity, ok := findKnowledgeEntity(reloadedCampaign, entity.ID)
	if !ok {
		t.Fatalf("entity %s missing after reload", entity.ID)
	}
	if reloadedEntity.Title != entity.Title {
		t.Fatalf("failed title persisted: got %q want %q", reloadedEntity.Title, entity.Title)
	}
	if reloadedEntity.Summary != "Proposal summary" {
		t.Fatalf("proposal summary = %q, want %q", reloadedEntity.Summary, "Proposal summary")
	}
}
