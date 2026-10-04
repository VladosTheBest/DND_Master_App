package httpapi

import (
	"encoding/json"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Only the public description and visible stock participate in illustration proposals.
func shopImageEntity(campaign campaignData, id string) knowledgeEntity {
	for _, shop := range campaign.Shops {
		if shop.ID != id {
			continue
		}
		var stock []string
		for _, item := range shop.Inventory {
			if item.Quantity != nil && *item.Quantity == 0 {
				continue
			}
			label := item.ItemName
			if item.Category != "" {
				label += " [" + item.Category + "]"
			}
			if item.Quantity != nil {
				label += " × " + strconv.Itoa(*item.Quantity)
			} else {
				label += " (количество не ограничено)"
			}
			stock = append(stock, label)
		}
		return knowledgeEntity{ID: shop.ID, Kind: "shop", Title: shop.Name, Summary: shop.Description,
			Content: "Ассортимент: " + strings.Join(stock, ", "), Revision: campaign.Revision, Art: shop.Art, Gallery: shop.Gallery}
	}
	return knowledgeEntity{}
}

func proposalTargetEntity(campaign campaignData, target proposalTarget) knowledgeEntity {
	if target.EntityKind == "shop" {
		return shopImageEntity(campaign, target.EntityID)
	}
	_, _, entity := findEntityInCampaign(&campaign, target.EntityID)
	return entity
}

func (service *proposalService) createShopImageProposalLocked(ownerID string, campaign campaignData, input entityProposalInput) (aiProposal, error) {
	var patch map[string]json.RawMessage
	if input.Mode != "update" || len(input.Candidate) > 0 || json.Unmarshal(input.Patch, &patch) != nil || patch == nil || len(patch) != 0 || len(input.MediaIntents) != 0 {
		return aiProposal{}, proposalFailure(400, "shop_image_only", "Магазин поддерживает только замену изображения с patch: {}.")
	}
	entity := shopImageEntity(campaign, strings.TrimSpace(input.EntityID))
	if entity.ID == "" {
		return aiProposal{}, proposalFailure(404, "not_found", "Shop not found")
	}
	before, _ := json.Marshal(entity)
	now := time.Now().UTC()
	proposal := normalizeStoredProposal(aiProposal{
		ID: newID("proposal"), OwnerID: ownerID, CampaignID: campaign.ID, Kind: "entity_update", Status: "pending",
		Prompt: input.Prompt, Source: input.Source,
		Target:        proposalTarget{CampaignID: campaign.ID, EntityID: entity.ID, EntityKind: "shop"},
		BaseRevisions: map[string]int{"campaign": campaign.Revision, "entity:" + entity.ID: entity.Revision},
		Before:        before, After: before,
		Operations: []proposalOperation{{Key: "entity:" + entity.ID, Action: "update", Kind: "shop", Title: entity.Title, Required: true}},
		CreatedAt:  now.Format(time.RFC3339), UpdatedAt: now.Format(time.RFC3339), ExpiresAt: now.Add(proposalLifetime).Format(time.RFC3339),
	})
	if err := service.persistNewProposalLocked(proposal); err != nil {
		return aiProposal{}, err
	}
	return cloneProposal(proposal), nil
}

func applyShopImageProposalLocked(proposal *aiProposal, campaign *campaignData, undo bool) (proposalActionResult, error) {
	current := shopImageEntity(*campaign, proposal.Target.EntityID)
	if current.ID == "" {
		return proposalActionResult{}, staleRevisionFailure("shop")
	}
	raw := proposal.After
	if undo {
		raw = proposal.Before
	}
	var candidate knowledgeEntity
	if err := json.Unmarshal(raw, &candidate); err != nil {
		return proposalActionResult{}, err
	}
	if undo {
		var applied knowledgeEntity
		if err := json.Unmarshal(proposal.AppliedResult, &applied); err != nil {
			return proposalActionResult{}, err
		}
		if !reflect.DeepEqual(current.Art, applied.Art) || !reflect.DeepEqual(current.Gallery, applied.Gallery) {
			return proposalActionResult{}, staleRevisionFailure("shop image")
		}
	}
	if !undo {
		if err := validateProposalEntityMedia(candidate, &current, proposal.OwnerID, campaign.ID); err != nil {
			return proposalActionResult{}, err
		}
	}
	for index := range campaign.Shops {
		if campaign.Shops[index].ID == current.ID {
			campaign.Shops[index].Art = candidate.Art
			campaign.Shops[index].Gallery = candidate.Gallery
			break
		}
	}
	campaign.Revision++
	if !undo {
		updated := shopImageEntity(*campaign, current.ID)
		proposal.After, _ = json.Marshal(updated)
		proposal.AppliedResult = append(json.RawMessage(nil), proposal.After...)
		proposal.AppliedRevisions = map[string]int{"campaign": campaign.Revision, "entity:" + current.ID: campaign.Revision}
	}
	return proposalActionResult{Campaign: campaignPointer(*campaign)}, nil
}
