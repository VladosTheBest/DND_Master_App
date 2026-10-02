package httpapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestProposalMergePreservesIndependentChangesAndUndo(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{"title":"AI title"}`)})
	if err != nil {
		t.Fatal(err)
	}
	manual := entityCreateInputFromData(entity)
	manual.Summary = "New manual description"
	if _, err := store.updateEntity(campaign.ID, entity.ID, manual); err != nil {
		t.Fatal(err)
	}
	result, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
	if err != nil {
		t.Fatal(err)
	}
	if result.Entity.Title != "AI title" || result.Entity.Summary != manual.Summary {
		t.Fatalf("merge lost changes: %#v", result.Entity)
	}
	// Another record must not invalidate undo for this unchanged target.
	createProposalTestEntity(t, store, campaign.ID)
	undone, err := service.undo(user.ID, proposal.ID)
	if err != nil {
		t.Fatal(err)
	}
	if undone.Entity.Title != entity.Title || undone.Entity.Summary != manual.Summary {
		t.Fatalf("undo lost manual changes: %#v", undone.Entity)
	}
}

func TestSiblingUpdateProposalsApplyIndependently(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	first := createProposalTestEntity(t, store, campaign.ID)
	second := createProposalTestEntity(t, store, campaign.ID)
	a, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: first.Kind, EntityID: first.ID, Patch: json.RawMessage(`{"title":"First"}`)})
	if err != nil {
		t.Fatal(err)
	}
	b, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: second.Kind, EntityID: second.ID, Patch: json.RawMessage(`{"title":"Second"}`)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.apply(user.ID, a.ID, proposalApplyInput{}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.apply(user.ID, b.ID, proposalApplyInput{}); err != nil {
		t.Fatal(err)
	}
}

func TestImageProposalSurvivesManualTextEdit(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	p, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{}`)})
	if err != nil {
		t.Fatal(err)
	}
	dir := service.proposalStagingDir(user.ID, p.ID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "art.png"), []byte("test-image"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.registerStagedMedia(user.ID, p.ID, proposalMediaIntent{ID: "art", Field: "art.url", PreviewURL: proposalPreviewPath(p.ID, "art.png"), Status: "staged"}); err != nil {
		t.Fatal(err)
	}
	manual := entityCreateInputFromData(entity)
	manual.Content = "Manual text while image was generated"
	if _, err := store.updateEntity(campaign.ID, entity.ID, manual); err != nil {
		t.Fatal(err)
	}
	result, err := service.apply(user.ID, p.ID, proposalApplyInput{})
	if err != nil {
		t.Fatal(err)
	}
	if result.Entity.Content != manual.Content || result.Entity.Art == nil {
		t.Fatalf("image merge lost content: %#v", result.Entity)
	}
}

func TestProposalMergeArraysAndDeletionConflict(t *testing.T) {
	for _, test := range []struct{ before, after, current string }{
		{`{"tags":["a"]}`, `{"tags":["a","b"]}`, `{"tags":["c"]}`},
		{`{"art":{"url":"old"}}`, `{}`, `{"art":{"url":"manual"}}`},
	} {
		_, err := mergeProposalSnapshot(json.RawMessage(test.before), json.RawMessage(test.after), json.RawMessage(test.current))
		if proposalErrorCode(t, err) != "stale_revision" {
			t.Fatalf("conflict silently merged: %v", err)
		}
	}
}

func TestEventProposalMergesManualSceneAndRejectsOverlap(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	input := createWorldEventInput{Title: "Scene", Summary: "Original", SceneText: "Old scene", Type: "social"}
	saved, err := store.createWorldEvent(campaign.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	p, err := service.createEvent(user.ID, campaign.ID, eventProposalInput{Mode: "update", EventID: saved.Event.ID, Patch: json.RawMessage(`{"summary":"AI summary"}`)})
	if err != nil {
		t.Fatal(err)
	}
	input.SceneText = "Manual scene"
	if _, err := store.updateWorldEvent(campaign.ID, saved.Event.ID, input); err != nil {
		t.Fatal(err)
	}
	result, err := service.apply(user.ID, p.ID, proposalApplyInput{})
	if err != nil {
		t.Fatal(err)
	}
	if result.Event.Summary != "AI summary" || result.Event.SceneText != input.SceneText {
		t.Fatalf("event merge lost edits: %#v", result.Event)
	}
	p, err = service.createEvent(user.ID, campaign.ID, eventProposalInput{Mode: "update", EventID: saved.Event.ID, Patch: json.RawMessage(`{"summary":"Next AI summary"}`)})
	if err != nil {
		t.Fatal(err)
	}
	input.Summary = "Manual summary"
	if _, err := store.updateWorldEvent(campaign.ID, saved.Event.ID, input); err != nil {
		t.Fatal(err)
	}
	if _, err := service.apply(user.ID, p.ID, proposalApplyInput{}); proposalErrorCode(t, err) != "stale_revision" {
		t.Fatalf("overlap not blocked: %v", err)
	}
}

func TestGeneratedEventProposalUsesSelectedLocationAndType(t *testing.T) {
	store, _, user, campaign := newProposalTestService(t)
	location, err := store.createEntity(campaign.ID, createEntityInput{Kind: "location", Title: "Harbour", Summary: "Port", Content: "Port"})
	if err != nil {
		t.Fatal(err)
	}
	srv := server{store: store, generator: scaffoldGenerator{}}
	input := eventProposalInput{Mode: "create", Prompt: "A messenger arrives", LocationID: location.Entity.ID, Type: "danger"}
	if err := srv.prepareGeneratedEventProposal(user.ID, campaign.ID, &input); err != nil {
		t.Fatal(err)
	}
	var candidate worldEvent
	if err := json.Unmarshal(input.Candidate, &candidate); err != nil {
		t.Fatal(err)
	}
	if candidate.LocationID != location.Entity.ID || candidate.Type != "danger" {
		t.Fatalf("selection lost: %#v", candidate)
	}
	invalid := eventProposalInput{Mode: "create", Prompt: "Scene", LocationID: "missing"}
	if err := srv.prepareGeneratedEventProposal(user.ID, campaign.ID, &invalid); proposalErrorCode(t, err) != "invalid_relationship" {
		t.Fatalf("invalid location accepted: %v", err)
	}
}

func TestImageConflictRetainsStagedFileAndPendingProposal(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	entity := createProposalTestEntity(t, store, campaign.ID)
	p, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: entity.Kind, EntityID: entity.ID, Patch: json.RawMessage(`{}`)})
	if err != nil {
		t.Fatal(err)
	}
	dir := service.proposalStagingDir(user.ID, p.ID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(dir, "image.png")
	if err := os.WriteFile(file, []byte("image"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.registerStagedMedia(user.ID, p.ID, proposalMediaIntent{ID: "image", Field: "art.url", PreviewURL: proposalPreviewPath(p.ID, "image.png"), Status: "staged"}); err != nil {
		t.Fatal(err)
	}
	manual := entityCreateInputFromData(entity)
	manual.Art = &heroArt{URL: "https://example.com/manual.png"}
	if _, err := store.updateEntity(campaign.ID, entity.ID, manual); err != nil {
		t.Fatal(err)
	}
	if _, err := service.apply(user.ID, p.ID, proposalApplyInput{}); proposalErrorCode(t, err) != "stale_revision" {
		t.Fatalf("conflicting portrait replaced: %v", err)
	}
	if _, err := os.Stat(file); err != nil {
		t.Fatalf("pending image lost: %v", err)
	}
	stored, err := service.get(user.ID, p.ID)
	if err != nil || stored.Status != "pending" {
		t.Fatalf("conflict consumed proposal: %#v %v", stored, err)
	}
}

func TestShopImageMergesInventoryAndGMNotes(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	shop := campaignShop{ID: "shop-merge", Name: "Shop", Description: "Shop", GMNotes: "Before"}
	if _, err := store.updateCampaign(campaign.ID, updateCampaignInput{Shops: []campaignShop{shop}}); err != nil {
		t.Fatal(err)
	}
	p, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: "shop", EntityID: shop.ID, Patch: json.RawMessage(`{}`)})
	if err != nil {
		t.Fatal(err)
	}
	dir := service.proposalStagingDir(user.ID, p.ID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "shop.png"), []byte("image"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.registerStagedMedia(user.ID, p.ID, proposalMediaIntent{ID: "image", Field: "art.url", PreviewURL: proposalPreviewPath(p.ID, "shop.png"), Status: "staged"}); err != nil {
		t.Fatal(err)
	}
	shop.GMNotes = "Manual secret"
	shop.Inventory = []shopInventoryItem{{ID: "stock", ItemID: "ring", ItemName: "Ring"}}
	if _, err := store.updateCampaign(campaign.ID, updateCampaignInput{Shops: []campaignShop{shop}}); err != nil {
		t.Fatal(err)
	}
	result, err := service.apply(user.ID, p.ID, proposalApplyInput{})
	if err != nil {
		t.Fatal(err)
	}
	got := result.Campaign.Shops[0]
	if got.GMNotes != shop.GMNotes || len(got.Inventory) != 1 || got.Art == nil {
		t.Fatalf("shop changes lost: %#v", got)
	}
	shop = got
	shop.GMNotes = "Another manual note"
	if _, err := store.updateCampaign(campaign.ID, updateCampaignInput{Shops: []campaignShop{shop}}); err != nil {
		t.Fatal(err)
	}
	undone, err := service.undo(user.ID, p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if undone.Campaign.Shops[0].GMNotes != shop.GMNotes || undone.Campaign.Shops[0].Art != nil {
		t.Fatal("shop undo changed manual notes")
	}
}
