package httpapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestApprovedArtGalleryAcrossEntityKinds(t *testing.T) {
	for _, kind := range []string{"location", "player", "npc", "monster", "quest", "lore"} {
		t.Run(kind, func(t *testing.T) {
			store, service, user, campaign := newProposalTestService(t)
			created, err := store.createEntity(campaign.ID, createEntityInput{Kind: kind, Title: "Gallery test"})
			if err != nil {
				t.Fatal(err)
			}
			for round := 1; round <= 2; round++ {
				proposal, err := service.createEntity(user.ID, campaign.ID, entityProposalInput{Mode: "update", Kind: kind, EntityID: created.Entity.ID, Patch: json.RawMessage(`{}`)})
				if err != nil {
					t.Fatal(err)
				}
				dir := service.proposalStagingDir(user.ID, proposal.ID)
				if err := os.MkdirAll(dir, 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dir, "art.png"), []byte("staged"), 0600); err != nil {
					t.Fatal(err)
				}
				if _, err := service.registerStagedMedia(user.ID, proposal.ID, proposalMediaIntent{ID: "art", Field: "art.url", PreviewURL: proposalPreviewPath(proposal.ID, "art.png"), Status: "staged", Alt: "Generated", Caption: "Caption"}); err != nil {
					t.Fatal(err)
				}
				before, _ := store.getCampaignForUser(user.ID, campaign.ID)
				_, _, entity := findEntityInCampaign(&before, created.Entity.ID)
				if len(entity.Gallery) != round-1 {
					t.Fatal("staging modified gallery")
				}
				expectedCount := round
				if round == 2 {
					manual := entityCreateInputFromData(entity)
					manual.Gallery = append(manual.Gallery, galleryImage{Title: "Manual addition", URL: "/uploads/manual.png"})
					if _, err := store.updateEntity(campaign.ID, entity.ID, manual); err != nil {
						t.Fatal(err)
					}
					expectedCount++
				}
				applied, err := service.apply(user.ID, proposal.ID, proposalApplyInput{})
				if err != nil {
					t.Fatal(err)
				}
				if len(applied.Entity.Gallery) != expectedCount || applied.Entity.Gallery[expectedCount-1].URL != applied.Entity.Art.URL || applied.Entity.Gallery[expectedCount-1].Caption != "Caption" {
					t.Fatal("approval did not preserve gallery and append generated art")
				}
				disk, err := readStorageState(store.path)
				if err != nil {
					t.Fatal(err)
				}
				_, _, persisted := findEntityInCampaign(&disk.Campaigns[findOwnedCampaignIndexLocked(&disk, user.ID, campaign.ID)], created.Entity.ID)
				if len(persisted.Gallery) != expectedCount {
					t.Fatal("gallery did not persist")
				}
				if round == 2 {
					undone, err := service.undo(user.ID, proposal.ID)
					if err != nil {
						t.Fatal(err)
					}
					if len(undone.Entity.Gallery) != 2 || undone.Entity.Art.URL != undone.Entity.Gallery[0].URL || undone.Entity.Gallery[1].URL != "/uploads/manual.png" {
						t.Fatal("undo lost previous image")
					}
				}
			}
		})
	}
}

func TestApprovedGalleryDeduplicatesAndIgnoresUnselectedMedia(t *testing.T) {
	proposal := aiProposal{Kind: "entity_update", Before: json.RawMessage(`{}`), After: json.RawMessage(`{"art":{"url":"/uploads/approved.png"},"gallery":[{"title":"Existing","url":"/uploads/approved.png"}]}`), MediaIntents: []proposalMediaIntent{{Field: "art.url", Status: "promoted", FinalURL: "/uploads/approved.png"}}}
	if err := appendApprovedImagesToGallery(&proposal); err != nil {
		t.Fatal(err)
	}
	var entity knowledgeEntity
	if err := json.Unmarshal(proposal.After, &entity); err != nil {
		t.Fatal(err)
	}
	if len(entity.Gallery) != 1 {
		t.Fatal("duplicate gallery image")
	}
	selected := false
	proposal.After = json.RawMessage(`{"art":{"url":"/uploads/approved.png"}}`)
	proposal.MediaIntents[0].Selected = &selected
	if err := appendApprovedImagesToGallery(&proposal); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(proposal.After, &entity); err != nil {
		t.Fatal(err)
	}
	var result map[string]any
	_ = json.Unmarshal(proposal.After, &result)
	if _, exists := result["gallery"]; exists {
		t.Fatal("unselected image added to gallery")
	}
}
