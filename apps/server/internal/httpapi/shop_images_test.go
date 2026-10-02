package httpapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestShopIllustrationPersistenceAndApproval(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	zero := 0
	shop := campaignShop{ID: "shop-test", Name: "Лавка", Description: "Свечи и стеклянные витрины", GMNotes: "SECRET hidden drawer DC15",
		Inventory: []shopInventoryItem{{ID: "stock", ItemID: "ring", ItemName: "Кольцо", Note: "SECRET cursed"}, {ID: "empty", ItemID: "hidden", ItemName: "UNAVAILABLE", Quantity: &zero}},
		Art:       &heroArt{URL: "https://example.com/old.png", Alt: "Old"}}
	saved, err := store.updateCampaign(campaign.ID, updateCampaignInput{Shops: []campaignShop{shop}})
	if err != nil {
		t.Fatal(err)
	}
	shop = saved.Shops[0]
	disk, err := readStorageState(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(disk.Campaigns[findOwnedCampaignIndexLocked(&disk, user.ID, campaign.ID)].Shops[0], shop) {
		t.Fatal("shop fields did not persist")
	}
	input := entityProposalInput{Mode: "update", Kind: "shop", EntityID: shop.ID, Patch: json.RawMessage(`{}`)}
	proposal, err := service.createEntity(user.ID, campaign.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(proposal.Before), "SECRET") || strings.Contains(string(proposal.Before), "UNAVAILABLE") {
		t.Fatal("private/unavailable stock leaked into image context")
	}
	if _, err := service.apply(user.ID, proposal.ID, proposalApplyInput{}); proposalErrorCode(t, err) != "proposal_no_changes" {
		t.Fatalf("empty image applied: %v", err)
	}
	dir := service.proposalStagingDir(user.ID, proposal.ID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "shop.png"), []byte("test staged media"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{ID: "art", Field: "art.url", PreviewURL: proposalPreviewPath(proposal.ID, "shop.png"), Status: "staged", Alt: "Shop"}); err != nil {
		t.Fatal(err)
	}
	if err := validateProposalMediaIntent(proposal, proposalMediaIntent{Field: "gallery"}); proposalErrorCode(t, err) != "shop_image_only" {
		t.Fatalf("shop gallery accepted: %v", err)
	}
	srv := &server{store: store}
	imageInput := codexPromptInput{CampaignID: campaign.ID, IncludeImages: true, ImageTarget: &codexImageTarget{EntityID: shop.ID, EntityKind: "shop"}}
	if err := srv.validateCodexImageTarget(user.ID, &imageInput); err != nil {
		t.Fatal(err)
	}
	if err := srv.validateCodexImageTarget("other-owner", &imageInput); err == nil {
		t.Fatal("foreign image target accepted")
	}
	prompt := buildCodexImageProposalPrompt(imageInput)
	if !strings.Contains(prompt, "get_entity exactly once") || !strings.Contains(prompt, "Never read or depict GM notes") || strings.Contains(prompt, "call search_entities") {
		t.Fatal("shop image prompt scope incorrect")
	}
	staged, _ := service.get(user.ID, proposal.ID)
	if !codexImageProposalHasOnlyArtChanges(staged) || !codexImageProposalHasSelectedStagedArt(staged) {
		t.Fatal("bridge cannot verify shop image result")
	}
	before, _ := store.getCampaignForUser(user.ID, campaign.ID)
	if !reflect.DeepEqual(before.Shops[0], shop) {
		t.Fatal("staging changed shop")
	}
	applied, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
	if err != nil {
		t.Fatal(err)
	}
	got := applied.Campaign.Shops[0]
	if got.Art == nil || !strings.HasPrefix(got.Art.URL, "/uploads/") {
		t.Fatal("image not promoted")
	}
	got.Art = shop.Art
	if !reflect.DeepEqual(got, shop) {
		t.Fatal("approval changed stock or GM notes")
	}
	undone, err := service.undo(user.ID, proposal.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(undone.Campaign.Shops[0], shop) {
		t.Fatal("undo did not restore shop")
	}
	stale, err := service.createEntity(user.ID, campaign.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.updateCampaign(campaign.ID, updateCampaignInput{Shops: []campaignShop{shop}}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.apply(user.ID, stale.ID, proposalApplyInput{}); proposalErrorCode(t, err) != "stale_revision" {
		t.Fatalf("stale proposal not blocked: %v", err)
	}
	input.Mode = "create"
	if _, err := service.createEntity(user.ID, campaign.ID, input); proposalErrorCode(t, err) != "shop_image_only" {
		t.Fatalf("shop create accepted: %v", err)
	}
	input.Mode = "update"
	input.Patch = json.RawMessage(`{"title":"changed"}`)
	if _, err := service.createEntity(user.ID, campaign.ID, input); proposalErrorCode(t, err) != "shop_image_only" {
		t.Fatalf("non-media patch accepted: %v", err)
	}
	if _, err := service.createEntity("other-owner", campaign.ID, input); proposalErrorCode(t, err) != "not_found" {
		t.Fatalf("foreign campaign accepted: %v", err)
	}
}
