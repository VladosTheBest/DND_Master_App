package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"time"
)

const proposalLifetime = 7 * 24 * time.Hour

var supportedProposalEntityKinds = map[string]struct{}{
	"location": {},
	"player":   {},
	"npc":      {},
	"monster":  {},
	"quest":    {},
	"lore":     {},
}

type proposalService struct {
	store     *campaignStore
	uploadDir string
}

type entityProposalInput struct {
	CampaignID   string                `json:"campaignId,omitempty"`
	Mode         string                `json:"mode"`
	Kind         string                `json:"kind"`
	EntityID     string                `json:"entityId,omitempty"`
	Prompt       string                `json:"prompt"`
	Patch        json.RawMessage       `json:"patch,omitempty"`
	Candidate    json.RawMessage       `json:"candidate,omitempty"`
	Source       proposalSource        `json:"source,omitempty"`
	Warnings     []string              `json:"warnings,omitempty"`
	MediaIntents []proposalMediaIntent `json:"mediaIntents,omitempty"`
}

type eventProposalInput struct {
	CampaignID   string                `json:"campaignId,omitempty"`
	Mode         string                `json:"mode"`
	EventID      string                `json:"eventId,omitempty"`
	Prompt       string                `json:"prompt"`
	Patch        json.RawMessage       `json:"patch,omitempty"`
	Candidate    json.RawMessage       `json:"candidate,omitempty"`
	Source       proposalSource        `json:"source,omitempty"`
	Warnings     []string              `json:"warnings,omitempty"`
	MediaIntents []proposalMediaIntent `json:"mediaIntents,omitempty"`
}

type campaignProposalInput struct {
	Prompt       string                    `json:"prompt"`
	Source       proposalSource            `json:"source,omitempty"`
	Blueprint    campaignProposalBlueprint `json:"blueprint"`
	Warnings     []string                  `json:"warnings,omitempty"`
	MediaIntents []proposalMediaIntent     `json:"mediaIntents,omitempty"`
}

type proposalApplyInput struct {
	SelectedOperationKeys []string `json:"selectedOperationKeys,omitempty"`
}

type proposalActionResult struct {
	Proposal aiProposal       `json:"proposal"`
	Campaign *campaignData    `json:"campaign,omitempty"`
	Entity   *knowledgeEntity `json:"entity,omitempty"`
	Event    *worldEvent      `json:"event,omitempty"`
}

type proposalMediaAttachmentInput struct {
	MediaID      string `json:"mediaId"`
	Purpose      string `json:"purpose,omitempty"`
	OperationKey string `json:"operationKey,omitempty"`
	Field        string `json:"field,omitempty"`
	Alt          string `json:"alt,omitempty"`
	Caption      string `json:"caption,omitempty"`
	Prompt       string `json:"prompt,omitempty"`
	Selected     *bool  `json:"selected,omitempty"`
}

type proposalMediaResult struct {
	Proposal aiProposal          `json:"proposal"`
	Media    proposalMediaIntent `json:"media"`
}

type proposalError struct {
	Status  int
	Code    string
	Message string
}

func (err *proposalError) Error() string {
	return err.Message
}

func newProposalService(store *campaignStore, uploadDir string) *proposalService {
	return &proposalService{store: store, uploadDir: strings.TrimSpace(uploadDir)}
}

func proposalFailure(status int, code, message string) error {
	return &proposalError{Status: status, Code: code, Message: message}
}

func normalizeStoredProposal(proposal aiProposal) aiProposal {
	if proposal.Status == "" {
		proposal.Status = "pending"
	}
	if proposal.BaseRevisions == nil {
		proposal.BaseRevisions = map[string]int{}
	}
	if len(proposal.Before) == 0 {
		proposal.Before = json.RawMessage("null")
	}
	if len(proposal.After) == 0 {
		proposal.After = json.RawMessage("null")
	}
	if proposal.Diff == nil {
		proposal.Diff = []proposalFieldDiff{}
	}
	if proposal.Warnings == nil {
		proposal.Warnings = []string{}
	}
	if proposal.MediaIntents == nil {
		proposal.MediaIntents = []proposalMediaIntent{}
	}
	for index := range proposal.MediaIntents {
		proposal.MediaIntents[index] = normalizeProposalMediaIntent(proposal.MediaIntents[index])
	}
	if proposal.Operations == nil {
		proposal.Operations = []proposalOperation{}
	}
	return proposal
}

func normalizeProposalMediaIntent(intent proposalMediaIntent) proposalMediaIntent {
	intent.ID = strings.TrimSpace(intent.ID)
	if intent.ID == "" {
		intent.ID = newID("media")
	}
	intent.Purpose = strings.TrimSpace(intent.Purpose)
	intent.OperationKey = strings.TrimSpace(intent.OperationKey)
	intent.Field = strings.TrimSpace(intent.Field)
	switch strings.ToLower(intent.Field) {
	case "", "art", "art.url":
		intent.Field = "art.url"
	case "gallery", "gallery[]":
		intent.Field = "gallery"
	}
	intent.Prompt = strings.TrimSpace(intent.Prompt)
	intent.Alt = strings.TrimSpace(intent.Alt)
	intent.Caption = strings.TrimSpace(intent.Caption)
	intent.PreviewURL = strings.TrimSpace(intent.PreviewURL)
	intent.FinalURL = strings.TrimSpace(intent.FinalURL)
	intent.ContentType = strings.TrimSpace(intent.ContentType)
	intent.Status = strings.TrimSpace(intent.Status)
	if intent.Status == "" {
		if intent.Prompt != "" {
			intent.Status = "requested"
		} else {
			intent.Status = "placeholder"
		}
	}
	return intent
}

func normalizeAndValidateProposalMediaIntents(proposal *aiProposal) error {
	for index := range proposal.MediaIntents {
		media := normalizeProposalMediaIntent(proposal.MediaIntents[index])
		if media.PreviewURL != "" || media.FinalURL != "" || media.ContentType != "" || media.Size != 0 {
			return proposalFailure(400, "server_owned_media_fields", "previewUrl, finalUrl, contentType, and size are assigned by the media upload service")
		}
		switch media.Status {
		case "requested", "placeholder", "unavailable", "intent":
		default:
			return proposalFailure(400, "server_owned_media_status", "Client-created media intents cannot set a lifecycle status")
		}
		if err := validateProposalMediaIntent(*proposal, media); err != nil {
			return err
		}
		proposal.MediaIntents[index] = media
	}
	return nil
}

func validateProposalMediaIntent(proposal aiProposal, media proposalMediaIntent) error {
	if media.Field != "art.url" && media.Field != "gallery" {
		return proposalFailure(400, "unsupported_media_field", "Proposal media field must be art.url or gallery")
	}
	switch proposal.Kind {
	case "entity_create", "entity_update":
		if media.OperationKey == "" {
			return nil
		}
		for _, operation := range proposal.Operations {
			if operation.Key == media.OperationKey && operation.Kind != "event" && operation.Kind != "campaign" {
				return nil
			}
		}
		return proposalFailure(400, "invalid_operation", "Media operationKey does not target this entity proposal")
	case "campaign_create":
		if media.OperationKey == "" || media.OperationKey == "campaign" {
			return proposalFailure(400, "unsupported_media_target", "Campaign-root media targets are not supported")
		}
		for _, operation := range proposal.Operations {
			if operation.Key != media.OperationKey {
				continue
			}
			if operation.Kind == "event" || operation.Kind == "campaign" {
				return proposalFailure(400, "unsupported_media_target", "Media can only target campaign blueprint entities")
			}
			return nil
		}
		return proposalFailure(400, "invalid_operation", "Media operationKey does not exist in the proposal")
	case "event_create", "event_update":
		return proposalFailure(400, "unsupported_media_target", "World events do not support art or gallery media")
	default:
		return proposalFailure(400, "unsupported_media_target", "Proposal kind does not support media")
	}
}

func (service *proposalService) list(ownerID, status, campaignID string) ([]aiProposal, error) {
	if err := service.expirePending(ownerID, ""); err != nil {
		return nil, err
	}
	status = strings.TrimSpace(status)
	campaignID = strings.TrimSpace(campaignID)

	service.store.mu.RLock()
	defer service.store.mu.RUnlock()

	result := make([]aiProposal, 0)
	for _, proposal := range service.store.data.AIProposals {
		if proposal.OwnerID != ownerID {
			continue
		}
		if status != "" && proposal.Status != status {
			continue
		}
		if campaignID != "" && proposal.CampaignID != campaignID {
			continue
		}
		result = append(result, cloneProposal(proposal))
	}
	sort.SliceStable(result, func(i, j int) bool { return result[i].CreatedAt > result[j].CreatedAt })
	return result, nil
}

func (service *proposalService) get(ownerID, proposalID string) (aiProposal, error) {
	if err := service.expirePending(ownerID, proposalID); err != nil {
		return aiProposal{}, err
	}
	service.store.mu.RLock()
	defer service.store.mu.RUnlock()
	for _, proposal := range service.store.data.AIProposals {
		if proposal.ID == proposalID && proposal.OwnerID == ownerID {
			return cloneProposal(proposal), nil
		}
	}
	return aiProposal{}, proposalFailure(404, "not_found", "AI proposal not found")
}

func (service *proposalService) createEntity(ownerID, campaignID string, input entityProposalInput) (aiProposal, error) {
	service.store.mu.Lock()
	defer service.store.mu.Unlock()

	campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, campaignID)
	if campaignIndex < 0 {
		return aiProposal{}, proposalFailure(404, "not_found", "Campaign not found")
	}
	campaign := ensureCampaignShape(service.store.data.Campaigns[campaignIndex])
	mode := strings.ToLower(strings.TrimSpace(input.Mode))
	if mode != "create" && mode != "update" {
		return aiProposal{}, proposalFailure(400, "invalid_mode", "mode must be create or update")
	}

	rawChange := input.Patch
	if len(bytes.TrimSpace(rawChange)) == 0 {
		rawChange = input.Candidate
	}
	if !isJSONObject(rawChange) {
		return aiProposal{}, proposalFailure(400, "invalid_candidate", "patch or candidate must be a JSON object")
	}

	now := time.Now().UTC()
	proposal := normalizeStoredProposal(aiProposal{
		ID:           newID("proposal"),
		OwnerID:      ownerID,
		CampaignID:   campaign.ID,
		Status:       "pending",
		Prompt:       strings.TrimSpace(input.Prompt),
		Source:       input.Source,
		Warnings:     sanitizeStringItems(input.Warnings),
		MediaIntents: input.MediaIntents,
		CreatedAt:    now.Format(time.RFC3339),
		UpdatedAt:    now.Format(time.RFC3339),
		ExpiresAt:    now.Add(proposalLifetime).Format(time.RFC3339),
	})

	if mode == "update" {
		_, _, existing := findEntityInCampaign(&campaign, strings.TrimSpace(input.EntityID))
		if existing.ID == "" {
			return aiProposal{}, proposalFailure(404, "not_found", "Entity not found")
		}
		requestedKind := strings.TrimSpace(input.Kind)
		if requestedKind != "" && requestedKind != existing.Kind {
			return aiProposal{}, proposalFailure(400, "kind_mismatch", "Entity kind does not match the stored entity")
		}
		before, _ := json.Marshal(existing)
		merged, err := mergeJSONObjects(before, rawChange)
		if err != nil {
			return aiProposal{}, proposalFailure(400, "invalid_patch", err.Error())
		}
		var candidate knowledgeEntity
		if err := json.Unmarshal(merged, &candidate); err != nil {
			return aiProposal{}, proposalFailure(400, "invalid_candidate", err.Error())
		}
		candidate.ID = existing.ID
		candidate.Kind = existing.Kind
		candidate.Revision = existing.Revision + 1
		candidate, validationWarnings, err := normalizeAndValidateEntityCandidate(campaign, candidate, false)
		if err != nil {
			return aiProposal{}, err
		}
		if err := validateProposalEntityMedia(candidate, &existing, ownerID, campaign.ID); err != nil {
			return aiProposal{}, err
		}
		after, _ := json.Marshal(candidate)
		proposal.Kind = "entity_update"
		proposal.Target = proposalTarget{CampaignID: campaign.ID, EntityID: existing.ID, EntityKind: existing.Kind}
		proposal.BaseRevisions = map[string]int{
			"campaign":              campaign.Revision,
			"entity:" + existing.ID: existing.Revision,
		}
		proposal.Before = before
		proposal.After = after
		proposal.Warnings = appendUniqueStrings(proposal.Warnings, validationWarnings...)
		proposal.Diff = diffJSON(before, after)
		proposal.Operations = []proposalOperation{{Key: "entity:" + existing.ID, Action: "update", Kind: existing.Kind, Title: candidate.Title, Required: true}}
	} else {
		kind := strings.ToLower(strings.TrimSpace(input.Kind))
		if _, ok := supportedProposalEntityKinds[kind]; !ok {
			return aiProposal{}, proposalFailure(400, "unsupported_entity_kind", fmt.Sprintf("unsupported entity kind %q", kind))
		}
		var createInput createEntityInput
		if err := json.Unmarshal(rawChange, &createInput); err != nil {
			return aiProposal{}, proposalFailure(400, "invalid_candidate", err.Error())
		}
		createInput.Kind = kind
		candidate := materializeEntity(createInput)
		candidate, validationWarnings, err := normalizeAndValidateEntityCandidate(campaign, candidate, true)
		if err != nil {
			return aiProposal{}, err
		}
		if err := validateManagedGeneratedEntityRichness(input.Source, candidate); err != nil {
			return aiProposal{}, err
		}
		if err := validateProposalEntityMedia(candidate, nil, ownerID, campaign.ID); err != nil {
			return aiProposal{}, err
		}
		after, _ := json.Marshal(candidate)
		proposal.Kind = "entity_create"
		proposal.Target = proposalTarget{CampaignID: campaign.ID, EntityID: candidate.ID, EntityKind: candidate.Kind}
		proposal.BaseRevisions = map[string]int{"campaign": campaign.Revision}
		proposal.Before = json.RawMessage("null")
		proposal.After = after
		proposal.Warnings = appendUniqueStrings(proposal.Warnings, validationWarnings...)
		proposal.Diff = diffJSON(proposal.Before, after)
		proposal.Operations = []proposalOperation{{Key: "entity:" + candidate.ID, Action: "create", Kind: candidate.Kind, Title: candidate.Title, Required: true}}
	}
	if err := normalizeAndValidateProposalMediaIntents(&proposal); err != nil {
		return aiProposal{}, err
	}

	if err := service.persistNewProposalLocked(proposal); err != nil {
		return aiProposal{}, err
	}
	return cloneProposal(proposal), nil
}

func validateManagedGeneratedEntityRichness(source proposalSource, candidate knowledgeEntity) error {
	if source.Type != "codex_app_server" {
		return nil
	}
	contentLength := len([]rune(strings.TrimSpace(candidate.Content)))
	if candidate.Kind == "location" {
		if contentLength < 1800 {
			return proposalFailure(400, "generated_entity_too_short", "Новой локации нужно не менее 1800 символов мастерского описания.")
		}
		requiredCards := map[string]bool{
			"описание локации":           false,
			"кого здесь можно встретить": false,
			"что можно найти":            false,
			"проверки и результаты":      false,
		}
		for _, card := range candidate.PlayerCards {
			title := strings.ToLower(strings.TrimSpace(card.Title))
			if _, required := requiredCards[title]; !required {
				continue
			}
			if len([]rune(strings.TrimSpace(card.Content))) < 1200 {
				return proposalFailure(400, "generated_entity_too_short", fmt.Sprintf("Карточке %q нужно не менее 1200 символов содержательного текста.", card.Title))
			}
			requiredCards[title] = true
		}
		for title, present := range requiredCards {
			if !present {
				return proposalFailure(400, "generated_entity_incomplete", fmt.Sprintf("У новой локации отсутствует обязательная карточка %q.", title))
			}
		}
	}
	if candidate.Kind == "quest" {
		if contentLength < 1800 {
			return proposalFailure(400, "generated_entity_too_short", "Новому квесту нужно не менее 1800 символов мастерского описания.")
		}
		if len(candidate.PlayerCards) < 2 {
			return proposalFailure(400, "generated_entity_incomplete", "Новому квесту нужны как минимум две подробные карточки для игроков.")
		}
		for _, card := range candidate.PlayerCards {
			if len([]rune(strings.TrimSpace(card.Content))) < 1000 {
				return proposalFailure(400, "generated_entity_too_short", fmt.Sprintf("Карточке %q нужно не менее 1000 символов содержательного текста.", card.Title))
			}
		}
	}
	return nil
}

func (service *proposalService) createEvent(ownerID, campaignID string, input eventProposalInput) (aiProposal, error) {
	service.store.mu.Lock()
	defer service.store.mu.Unlock()
	campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, campaignID)
	if campaignIndex < 0 {
		return aiProposal{}, proposalFailure(404, "not_found", "Campaign not found")
	}
	campaign := ensureCampaignShape(service.store.data.Campaigns[campaignIndex])
	mode := strings.ToLower(strings.TrimSpace(input.Mode))
	if mode != "create" && mode != "update" {
		return aiProposal{}, proposalFailure(400, "invalid_mode", "mode must be create or update")
	}
	rawChange := input.Patch
	if len(bytes.TrimSpace(rawChange)) == 0 {
		rawChange = input.Candidate
	}
	if !isJSONObject(rawChange) {
		return aiProposal{}, proposalFailure(400, "invalid_candidate", "patch or candidate must be a JSON object")
	}
	now := time.Now().UTC()
	proposal := normalizeStoredProposal(aiProposal{ID: newID("proposal"), OwnerID: ownerID, CampaignID: campaign.ID, Status: "pending", Prompt: strings.TrimSpace(input.Prompt), Source: input.Source, Warnings: sanitizeStringItems(input.Warnings), MediaIntents: input.MediaIntents, CreatedAt: now.Format(time.RFC3339), UpdatedAt: now.Format(time.RFC3339), ExpiresAt: now.Add(proposalLifetime).Format(time.RFC3339)})
	if mode == "update" {
		eventIndex, existing := findEventInCampaign(&campaign, strings.TrimSpace(input.EventID))
		if eventIndex < 0 {
			return aiProposal{}, proposalFailure(404, "not_found", "Event not found")
		}
		before, _ := json.Marshal(existing)
		merged, err := mergeJSONObjects(before, rawChange)
		if err != nil {
			return aiProposal{}, proposalFailure(400, "invalid_patch", err.Error())
		}
		var candidate worldEvent
		if err := json.Unmarshal(merged, &candidate); err != nil {
			return aiProposal{}, proposalFailure(400, "invalid_candidate", err.Error())
		}
		candidate.ID = existing.ID
		candidate.Revision = existing.Revision + 1
		candidate = normalizeWorldEventCandidate(candidate, campaign)
		after, _ := json.Marshal(candidate)
		proposal.Kind = "event_update"
		proposal.Target = proposalTarget{CampaignID: campaign.ID, EventID: existing.ID}
		proposal.BaseRevisions = map[string]int{"campaign": campaign.Revision, "event:" + existing.ID: existing.Revision}
		proposal.Before, proposal.After = before, after
		proposal.Diff = diffJSON(before, after)
		proposal.Operations = []proposalOperation{{Key: "event:" + existing.ID, Action: "update", Kind: "event", Title: candidate.Title, Required: true}}
	} else {
		var eventInput createWorldEventInput
		if err := json.Unmarshal(rawChange, &eventInput); err != nil {
			return aiProposal{}, proposalFailure(400, "invalid_candidate", err.Error())
		}
		candidate := materializeWorldEvent(eventInput, campaign, nil)
		candidate.Revision = 1
		after, _ := json.Marshal(candidate)
		proposal.Kind = "event_create"
		proposal.Target = proposalTarget{CampaignID: campaign.ID, EventID: candidate.ID}
		proposal.BaseRevisions = map[string]int{"campaign": campaign.Revision}
		proposal.Before, proposal.After = json.RawMessage("null"), after
		proposal.Diff = diffJSON(proposal.Before, after)
		proposal.Operations = []proposalOperation{{Key: "event:" + candidate.ID, Action: "create", Kind: "event", Title: candidate.Title, Required: true}}
	}
	if err := normalizeAndValidateProposalMediaIntents(&proposal); err != nil {
		return aiProposal{}, err
	}
	if err := service.persistNewProposalLocked(proposal); err != nil {
		return aiProposal{}, err
	}
	return cloneProposal(proposal), nil
}

func (service *proposalService) createCampaign(ownerID string, input campaignProposalInput) (aiProposal, error) {
	blueprint, operations, warnings, err := normalizeCampaignBlueprint(input.Blueprint)
	if err != nil {
		return aiProposal{}, err
	}
	if err := validateProposalCampaignBlueprintMedia(blueprint, ownerID); err != nil {
		return aiProposal{}, err
	}
	after, err := json.Marshal(blueprint)
	if err != nil {
		return aiProposal{}, err
	}
	now := time.Now().UTC()
	proposal := normalizeStoredProposal(aiProposal{
		ID: newID("proposal"), OwnerID: ownerID, Kind: "campaign_create", Status: "pending",
		Prompt: strings.TrimSpace(input.Prompt), Source: input.Source, Before: json.RawMessage("null"), After: after,
		BaseRevisions: map[string]int{}, Diff: diffJSON(json.RawMessage("null"), after),
		Warnings: appendUniqueStrings(sanitizeStringItems(input.Warnings), warnings...), MediaIntents: input.MediaIntents, Operations: operations,
		CreatedAt: now.Format(time.RFC3339), UpdatedAt: now.Format(time.RFC3339), ExpiresAt: now.Add(proposalLifetime).Format(time.RFC3339),
	})

	service.store.mu.Lock()
	defer service.store.mu.Unlock()
	if _, ok := findUserByIDLocked(service.store.data.Users, ownerID); !ok {
		return aiProposal{}, proposalFailure(404, "not_found", "Owner account not found")
	}
	if err := normalizeAndValidateProposalMediaIntents(&proposal); err != nil {
		return aiProposal{}, err
	}
	if err := service.persistNewProposalLocked(proposal); err != nil {
		return aiProposal{}, err
	}
	return cloneProposal(proposal), nil
}

// persistNewProposalLocked makes proposal creation and its audit one durable
// transaction. The caller must hold service.store.mu.
func (service *proposalService) persistNewProposalLocked(proposal aiProposal) error {
	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		return err
	}
	service.store.data.AIProposals = append(service.store.data.AIProposals, proposal)
	service.store.data.ProposalAudits = append(service.store.data.ProposalAudits, newProposalAudit(proposal, "created", proposal.Before, proposal.After, proposal.BaseRevisions))
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		return err
	}
	return nil
}

func findOwnedCampaignIndexLocked(state *storageState, ownerID, campaignID string) int {
	for index := range state.Campaigns {
		if state.Campaigns[index].ID == campaignID && state.Campaigns[index].OwnerID == ownerID {
			return index
		}
	}
	return -1
}

func findUserByIDLocked(users []userAccount, ownerID string) (userAccount, bool) {
	for _, user := range users {
		if user.ID == ownerID {
			return user, true
		}
	}
	return userAccount{}, false
}

func findEventInCampaign(campaign *campaignData, eventID string) (int, worldEvent) {
	for index := range campaign.Events {
		if campaign.Events[index].ID == eventID {
			return index, campaign.Events[index]
		}
	}
	return -1, worldEvent{}
}

func cloneProposal(proposal aiProposal) aiProposal {
	body, err := json.Marshal(proposal)
	if err != nil {
		return proposal
	}
	var cloned aiProposal
	if err := json.Unmarshal(body, &cloned); err != nil {
		return proposal
	}
	return normalizeStoredProposal(cloned)
}

func isJSONObject(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) < 2 || trimmed[0] != '{' || trimmed[len(trimmed)-1] != '}' {
		return false
	}
	var value map[string]any
	return json.Unmarshal(trimmed, &value) == nil
}

func mergeJSONObjects(baseRaw, patchRaw json.RawMessage) (json.RawMessage, error) {
	var base map[string]any
	var patch map[string]any
	if err := json.Unmarshal(baseRaw, &base); err != nil {
		return nil, fmt.Errorf("invalid base object: %w", err)
	}
	if err := json.Unmarshal(patchRaw, &patch); err != nil {
		return nil, fmt.Errorf("invalid patch object: %w", err)
	}
	merged := mergeJSONMap(base, patch)
	return json.Marshal(merged)
}

func mergeJSONMap(base, patch map[string]any) map[string]any {
	result := make(map[string]any, len(base)+len(patch))
	for key, value := range base {
		result[key] = value
	}
	for key, value := range patch {
		if value == nil {
			delete(result, key)
			continue
		}
		patchMap, patchIsMap := value.(map[string]any)
		baseMap, baseIsMap := result[key].(map[string]any)
		if patchIsMap && baseIsMap {
			result[key] = mergeJSONMap(baseMap, patchMap)
			continue
		}
		result[key] = value
	}
	return result
}

func diffJSON(beforeRaw, afterRaw json.RawMessage) []proposalFieldDiff {
	var before any
	var after any
	_ = json.Unmarshal(beforeRaw, &before)
	_ = json.Unmarshal(afterRaw, &after)
	result := make([]proposalFieldDiff, 0)
	collectJSONDiff("", before, after, &result)
	sort.SliceStable(result, func(i, j int) bool { return result[i].Path < result[j].Path })
	return result
}

func collectJSONDiff(prefix string, before, after any, result *[]proposalFieldDiff) {
	beforeMap, beforeOK := before.(map[string]any)
	afterMap, afterOK := after.(map[string]any)
	if beforeOK && afterOK {
		keys := make(map[string]struct{}, len(beforeMap)+len(afterMap))
		for key := range beforeMap {
			keys[key] = struct{}{}
		}
		for key := range afterMap {
			keys[key] = struct{}{}
		}
		ordered := make([]string, 0, len(keys))
		for key := range keys {
			ordered = append(ordered, key)
		}
		sort.Strings(ordered)
		for _, key := range ordered {
			if key == "revision" {
				continue
			}
			pathValue := key
			if prefix != "" {
				pathValue = prefix + "." + key
			}
			collectJSONDiff(pathValue, beforeMap[key], afterMap[key], result)
		}
		return
	}
	if reflect.DeepEqual(before, after) {
		return
	}
	if prefix == "" {
		prefix = "$"
	}
	*result = append(*result, proposalFieldDiff{Path: prefix, Before: before, After: after})
}

func normalizeAndValidateEntityCandidate(campaign campaignData, candidate knowledgeEntity, isCreate bool) (knowledgeEntity, []string, error) {
	candidate.Kind = strings.ToLower(strings.TrimSpace(candidate.Kind))
	if _, ok := supportedProposalEntityKinds[candidate.Kind]; !ok {
		return knowledgeEntity{}, nil, proposalFailure(400, "unsupported_entity_kind", fmt.Sprintf("unsupported entity kind %q", candidate.Kind))
	}
	if strings.TrimSpace(candidate.ID) == "" {
		return knowledgeEntity{}, nil, proposalFailure(400, "invalid_candidate", "entity id is required")
	}
	if isCreate {
		if _, _, existing := findEntityInCampaign(&campaign, candidate.ID); existing.ID != "" {
			return knowledgeEntity{}, nil, proposalFailure(409, "duplicate_entity", "entity id already exists")
		}
	}
	normalized := ensureKnowledgeEntities([]knowledgeEntity{candidate})[0]
	warnings := make([]string, 0)
	known := campaignEntityIDSet(campaign)
	for _, related := range normalized.Related {
		if related.ID != "" {
			if _, exists := known[related.ID]; !exists && related.ID != normalized.ID {
				warnings = append(warnings, fmt.Sprintf("Связь %q указывает на отсутствующую сущность %s.", related.Label, related.ID))
			}
		}
	}
	for label, reference := range map[string]string{"parentId": normalized.ParentID, "locationId": normalized.LocationID, "issuerId": normalized.IssuerID} {
		if reference == "" {
			continue
		}
		if _, exists := known[reference]; !exists && reference != normalized.ID {
			warnings = append(warnings, fmt.Sprintf("%s указывает на отсутствующую сущность %s.", label, reference))
		}
	}
	return normalized, warnings, nil
}

func validateProposalEntityMedia(candidate knowledgeEntity, before *knowledgeEntity, ownerID, campaignID string) error {
	allowedExisting := make(map[string]struct{})
	if before != nil {
		collectEntityMediaURLs(*before, allowedExisting)
	}
	if candidate.Art != nil {
		if err := validateProposalMediaURL(candidate.Art.URL, allowedExisting, ownerID, campaignID); err != nil {
			return fmt.Errorf("art: %w", err)
		}
	}
	for _, image := range candidate.Gallery {
		if err := validateProposalMediaURL(image.URL, allowedExisting, ownerID, campaignID); err != nil {
			return fmt.Errorf("gallery image %q: %w", image.Title, err)
		}
	}
	for _, track := range candidate.Playlist {
		if err := validateProposalMediaURL(track.URL, allowedExisting, ownerID, campaignID); err != nil {
			return fmt.Errorf("playlist track %q: %w", track.Title, err)
		}
	}
	return nil
}

func validateProposalCampaignBlueprintMedia(blueprint campaignProposalBlueprint, ownerID string) error {
	for _, item := range blueprint.Entities {
		candidate := materializeEntity(item.createEntityInput)
		if err := validateProposalEntityMedia(candidate, nil, ownerID, ""); err != nil {
			return fmt.Errorf("%s %q: %w", item.Kind, item.Title, err)
		}
	}
	return nil
}

func collectEntityMediaURLs(entity knowledgeEntity, target map[string]struct{}) {
	if entity.Art != nil {
		if value := strings.TrimSpace(entity.Art.URL); value != "" {
			target[value] = struct{}{}
		}
	}
	for _, image := range entity.Gallery {
		if value := strings.TrimSpace(image.URL); value != "" {
			target[value] = struct{}{}
		}
	}
	for _, track := range entity.Playlist {
		if value := strings.TrimSpace(track.URL); value != "" {
			target[value] = struct{}{}
		}
	}
}

func validateProposalMediaURL(value string, allowedExisting map[string]struct{}, ownerID, campaignID string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	if _, ok := allowedExisting[trimmed]; ok {
		return nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(parsed.Path, "/") || strings.HasPrefix(parsed.Path, "//") || strings.Contains(parsed.Path, "\\") {
		return proposalFailure(400, "invalid_media_url", "New external media URLs are not allowed; stage a local proposal image instead")
	}
	cleanPath := path.Clean(parsed.Path)
	if strings.TrimSpace(campaignID) == "" {
		return proposalFailure(400, "invalid_media_url", "New campaign media must be staged on the proposal")
	}
	expectedPrefix := proposalPublicPath(sanitizeUploadPathSegment(ownerID), sanitizeUploadPathSegment(campaignID)) + "/"
	if !strings.HasPrefix(cleanPath, expectedPrefix) {
		return proposalFailure(400, "invalid_media_url", "New media URLs must belong to this campaign's uploads")
	}
	return nil
}

func normalizeWorldEventCandidate(candidate worldEvent, campaign campaignData) worldEvent {
	items := ensureWorldEvents([]worldEvent{candidate}, campaign.Locations, campaign.InWorldDate)
	return items[0]
}

func campaignEntityIDSet(campaign campaignData) map[string]struct{} {
	result := make(map[string]struct{})
	for _, entity := range campaignEntities(campaign) {
		result[entity.ID] = struct{}{}
	}
	return result
}

func appendUniqueStrings(items []string, additions ...string) []string {
	seen := make(map[string]struct{}, len(items)+len(additions))
	result := make([]string, 0, len(items)+len(additions))
	for _, item := range append(items, additions...) {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func newProposalAudit(proposal aiProposal, action string, before, after json.RawMessage, revisions map[string]int) proposalAudit {
	return proposalAudit{
		ID: newID("audit"), ProposalID: proposal.ID, OwnerID: proposal.OwnerID, CampaignID: proposal.CampaignID,
		Action: action, Before: append(json.RawMessage(nil), before...), After: append(json.RawMessage(nil), after...),
		Revisions: cloneRevisionMap(revisions), CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func cloneRevisionMap(source map[string]int) map[string]int {
	if source == nil {
		return nil
	}
	result := make(map[string]int, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func normalizeCampaignBlueprint(input campaignProposalBlueprint) (campaignProposalBlueprint, []proposalOperation, []string, error) {
	input.Campaign.Title = firstNonEmpty(strings.TrimSpace(input.Campaign.Title), "Новая AI-кампания")
	input.Campaign.System = firstNonEmpty(strings.TrimSpace(input.Campaign.System), "D&D 5e")
	input.Campaign.SettingName = firstNonEmpty(strings.TrimSpace(input.Campaign.SettingName), "Новый мир")
	input.Campaign.InWorldDate = firstNonEmpty(strings.TrimSpace(input.Campaign.InWorldDate), "1 Чес, 1492 DR")
	input.Campaign.Summary = firstNonEmpty(strings.TrimSpace(input.Campaign.Summary), "Кампания подготовлена AI и ожидает подтверждения мастера.")
	operations := []proposalOperation{{Key: "campaign", Action: "create", Kind: "campaign", Title: input.Campaign.Title, Required: true}}
	warnings := make([]string, 0)
	seen := map[string]struct{}{}
	for index := range input.Entities {
		entity := &input.Entities[index]
		entity.TempKey = strings.TrimSpace(entity.TempKey)
		if entity.TempKey == "" {
			entity.TempKey = fmt.Sprintf("entity-%d", index+1)
		}
		if _, duplicate := seen[entity.TempKey]; duplicate {
			return campaignProposalBlueprint{}, nil, nil, proposalFailure(400, "duplicate_temp_key", fmt.Sprintf("duplicate tempKey %q", entity.TempKey))
		}
		seen[entity.TempKey] = struct{}{}
		entity.Kind = strings.ToLower(strings.TrimSpace(entity.Kind))
		if _, ok := supportedProposalEntityKinds[entity.Kind]; !ok {
			return campaignProposalBlueprint{}, nil, nil, proposalFailure(400, "unsupported_entity_kind", fmt.Sprintf("unsupported entity kind %q", entity.Kind))
		}
		dependencies := blueprintEntityDependencies(entity.createEntityInput)
		operations = append(operations, proposalOperation{Key: "entity:" + entity.TempKey, Action: "create", Kind: entity.Kind, TempKey: entity.TempKey, Title: firstNonEmpty(entity.Title, fallbackEntityTitle(entity.Kind)), DependsOn: dependencies})
	}
	for index := range input.Events {
		event := &input.Events[index]
		event.TempKey = strings.TrimSpace(event.TempKey)
		if event.TempKey == "" {
			event.TempKey = fmt.Sprintf("event-%d", index+1)
		}
		if _, duplicate := seen[event.TempKey]; duplicate {
			return campaignProposalBlueprint{}, nil, nil, proposalFailure(400, "duplicate_temp_key", fmt.Sprintf("duplicate tempKey %q", event.TempKey))
		}
		seen[event.TempKey] = struct{}{}
		dependencies := []string{}
		if strings.TrimSpace(event.LocationID) != "" {
			dependencies = append(dependencies, "entity:"+strings.TrimSpace(event.LocationID))
		}
		operations = append(operations, proposalOperation{Key: "event:" + event.TempKey, Action: "create", Kind: "event", TempKey: event.TempKey, Title: firstNonEmpty(event.Title, "Новая сцена"), DependsOn: dependencies})
	}
	known := make(map[string]struct{}, len(seen))
	for key := range seen {
		known[key] = struct{}{}
	}
	for _, operation := range operations {
		for _, dependency := range operation.DependsOn {
			tempKey := strings.TrimPrefix(dependency, "entity:")
			if _, exists := known[tempKey]; !exists {
				warnings = append(warnings, fmt.Sprintf("Операция %s ссылается на неизвестный временный ключ %s.", operation.Key, tempKey))
			}
		}
	}
	return input, operations, warnings, nil
}

func blueprintEntityDependencies(input createEntityInput) []string {
	seen := map[string]struct{}{}
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value != "" {
			seen["entity:"+value] = struct{}{}
		}
	}
	add(input.ParentID)
	add(input.LocationID)
	add(input.IssuerID)
	for _, related := range input.Related {
		add(related.ID)
	}
	addPreparedCombatDependencies := func(plan preparedCombatPlan) {
		for _, id := range plan.PlayerIDs {
			add(id)
		}
		for _, item := range plan.Allies {
			add(item.EntityID)
		}
		for _, item := range plan.Items {
			add(item.EntityID)
		}
	}
	if input.PreparedCombat != nil {
		addPreparedCombatDependencies(*input.PreparedCombat)
	}
	for _, plan := range input.PreparedCombats {
		addPreparedCombatDependencies(plan)
	}
	result := make([]string, 0, len(seen))
	for dependency := range seen {
		result = append(result, dependency)
	}
	sort.Strings(result)
	return result
}

func (service *proposalService) expirePending(ownerID, proposalID string) error {
	service.store.mu.Lock()
	expiredIDs, err := service.expirePendingLocked(ownerID, proposalID, time.Now().UTC())
	service.store.mu.Unlock()
	if err != nil {
		return err
	}
	for _, expiredID := range expiredIDs {
		service.cleanupStagedMedia(ownerID, expiredID)
	}
	return nil
}

// expirePendingLocked commits status, media disposition, and audit together.
// The caller must hold service.store.mu; staged files are removed by the caller
// only after this transaction succeeds.
func (service *proposalService) expirePendingLocked(ownerID, proposalID string, now time.Time) ([]string, error) {
	expiredIndexes := make([]int, 0)
	for index := range service.store.data.AIProposals {
		proposal := service.store.data.AIProposals[index]
		if proposal.OwnerID != ownerID || (proposalID != "" && proposal.ID != proposalID) || proposal.Status != "pending" || proposal.ExpiresAt == "" {
			continue
		}
		expiresAt, err := time.Parse(time.RFC3339, proposal.ExpiresAt)
		if err != nil || now.Before(expiresAt) {
			continue
		}
		expiredIndexes = append(expiredIndexes, index)
	}
	if len(expiredIndexes) == 0 {
		return nil, nil
	}
	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		return nil, err
	}
	expiredIDs := make([]string, 0, len(expiredIndexes))
	for _, index := range expiredIndexes {
		proposal := &service.store.data.AIProposals[index]
		proposal.Status = "expired"
		proposal.UpdatedAt = now.Format(time.RFC3339)
		for mediaIndex := range proposal.MediaIntents {
			if proposal.MediaIntents[mediaIndex].Status == "staged" {
				proposal.MediaIntents[mediaIndex].Status = "discarded"
			}
		}
		service.store.data.ProposalAudits = append(service.store.data.ProposalAudits, newProposalAudit(*proposal, "expired", proposal.Before, proposal.After, proposal.BaseRevisions))
		expiredIDs = append(expiredIDs, proposal.ID)
	}
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		return nil, err
	}
	return expiredIDs, nil
}

func (service *proposalService) cleanupStagedMedia(ownerID, proposalID string) {
	root := service.proposalStagingRoot()
	if root == "" {
		return
	}
	target := service.proposalStagingDir(ownerID, proposalID)
	resolvedRoot, rootErr := filepath.Abs(root)
	resolvedTarget, targetErr := filepath.Abs(target)
	if rootErr != nil || targetErr != nil || resolvedTarget == resolvedRoot || !strings.HasPrefix(resolvedTarget, resolvedRoot+string(os.PathSeparator)) {
		return
	}
	_ = os.RemoveAll(resolvedTarget)
}

func (service *proposalService) proposalStagingRoot() string {
	if strings.TrimSpace(service.uploadDir) == "" {
		return ""
	}
	return filepath.Clean(service.uploadDir) + ".proposals"
}

func (service *proposalService) proposalStagingDir(ownerID, proposalID string) string {
	return filepath.Join(service.proposalStagingRoot(), sanitizeUploadPathSegment(ownerID), sanitizeUploadPathSegment(proposalID))
}

func proposalPreviewPath(proposalID, fileName string) string {
	return path.Join("/api/ai/proposals", sanitizeUploadPathSegment(proposalID), "media", filepath.Base(fileName))
}

func proposalPublicPath(parts ...string) string {
	all := append([]string{"/uploads"}, parts...)
	return path.Join(all...)
}

var errProposalSaveFailed = errors.New("proposal save failed")

type promotedMediaMove struct {
	from string
	to   string
}

func (service *proposalService) apply(ownerID, proposalID string, input proposalApplyInput) (proposalActionResult, error) {
	service.store.mu.Lock()
	proposalIndex := findOwnedProposalIndexLocked(&service.store.data, ownerID, proposalID)
	if proposalIndex < 0 {
		service.store.mu.Unlock()
		return proposalActionResult{}, proposalFailure(404, "not_found", "AI proposal not found")
	}
	proposal := &service.store.data.AIProposals[proposalIndex]
	if proposal.Status != "pending" {
		service.store.mu.Unlock()
		return proposalActionResult{}, proposalFailure(409, "proposal_not_pending", "Only a pending proposal can be applied")
	}
	if proposalExpired(*proposal, time.Now().UTC()) {
		expiredIDs, expireErr := service.expirePendingLocked(ownerID, proposalID, time.Now().UTC())
		service.store.mu.Unlock()
		if expireErr != nil {
			return proposalActionResult{}, fmt.Errorf("%w: %v", errProposalSaveFailed, expireErr)
		}
		for _, expiredID := range expiredIDs {
			service.cleanupStagedMedia(ownerID, expiredID)
		}
		return proposalActionResult{}, proposalFailure(409, "proposal_expired", "The proposal has expired")
	}

	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}

	result := proposalActionResult{}
	var moves []promotedMediaMove
	switch proposal.Kind {
	case "entity_create", "entity_update":
		campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, proposal.CampaignID)
		if campaignIndex < 0 {
			service.store.mu.Unlock()
			return proposalActionResult{}, proposalFailure(404, "not_found", "Campaign not found")
		}
		if err := verifyProposalBaseRevisions(*proposal, service.store.data.Campaigns[campaignIndex]); err != nil {
			service.store.mu.Unlock()
			return proposalActionResult{}, err
		}
		moves, err = service.promoteMediaLocked(proposal, service.store.data.Campaigns[campaignIndex].ID, nil)
		if err == nil && proposal.Kind == "entity_update" && len(proposal.Diff) == 0 {
			err = proposalFailure(409, "proposal_no_changes", "В черновике нет готовых изменений. Отклони его и повтори генерацию изображения.")
		}
		if err == nil {
			result, err = applyEntityProposalLocked(proposal, &service.store.data.Campaigns[campaignIndex])
		}
	case "event_create", "event_update":
		campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, proposal.CampaignID)
		if campaignIndex < 0 {
			service.store.mu.Unlock()
			return proposalActionResult{}, proposalFailure(404, "not_found", "Campaign not found")
		}
		if err := verifyProposalBaseRevisions(*proposal, service.store.data.Campaigns[campaignIndex]); err != nil {
			service.store.mu.Unlock()
			return proposalActionResult{}, err
		}
		moves, err = service.promoteMediaLocked(proposal, service.store.data.Campaigns[campaignIndex].ID, nil)
		if err == nil {
			result, err = applyEventProposalLocked(proposal, &service.store.data.Campaigns[campaignIndex])
		}
	case "campaign_create":
		campaignID := newID("campaign")
		var selectedOperations map[string]struct{}
		selectedOperations, err = selectedProposalOperations(proposal.Operations, input.SelectedOperationKeys)
		if err == nil {
			err = validateSelectedProposalOperationDependencies(proposal.Operations, selectedOperations)
		}
		if err == nil {
			moves, err = service.promoteMediaLocked(proposal, campaignID, selectedOperations)
		}
		if err == nil {
			var campaign campaignData
			campaign, err = instantiateCampaignBlueprint(*proposal, ownerID, campaignID, selectedOperations)
			if err == nil {
				service.store.data.Campaigns = append(service.store.data.Campaigns, campaign)
				proposal.CampaignID = campaign.ID
				proposal.Target.CampaignID = campaign.ID
				appliedResult, _ := json.Marshal(campaign)
				proposal.AppliedResult = appliedResult
				proposal.AppliedRevisions = campaignRevisionMap(campaign)
				result.Campaign = campaignPointer(campaign)
			}
		}
	default:
		err = proposalFailure(400, "unsupported_proposal_kind", fmt.Sprintf("unsupported proposal kind %q", proposal.Kind))
	}
	if err != nil {
		service.store.data = originalState
		rollbackPromotedMedia(moves)
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	proposal.Status = "applied"
	proposal.AppliedAt = now
	proposal.UpdatedAt = now
	auditAfter := proposal.AppliedResult
	if len(auditAfter) == 0 {
		auditAfter = proposal.After
	}
	service.store.data.ProposalAudits = append(service.store.data.ProposalAudits, newProposalAudit(*proposal, "applied", proposal.Before, auditAfter, proposal.AppliedRevisions))
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		rollbackPromotedMedia(moves)
		service.store.mu.Unlock()
		return proposalActionResult{}, fmt.Errorf("%w: %v", errProposalSaveFailed, err)
	}
	result.Proposal = cloneProposal(*proposal)
	service.store.mu.Unlock()
	service.cleanupStagedMedia(ownerID, proposalID)
	return result, nil
}

func (service *proposalService) reject(ownerID, proposalID string) (proposalActionResult, error) {
	service.store.mu.Lock()
	proposalIndex := findOwnedProposalIndexLocked(&service.store.data, ownerID, proposalID)
	if proposalIndex < 0 {
		service.store.mu.Unlock()
		return proposalActionResult{}, proposalFailure(404, "not_found", "AI proposal not found")
	}
	proposal := &service.store.data.AIProposals[proposalIndex]
	if proposal.Status != "pending" {
		service.store.mu.Unlock()
		return proposalActionResult{}, proposalFailure(409, "proposal_not_pending", "Only a pending proposal can be rejected")
	}
	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	proposal.Status = "rejected"
	proposal.RejectedAt = now
	proposal.UpdatedAt = now
	for index := range proposal.MediaIntents {
		if proposal.MediaIntents[index].Status == "staged" {
			proposal.MediaIntents[index].Status = "discarded"
		}
	}
	service.store.data.ProposalAudits = append(service.store.data.ProposalAudits, newProposalAudit(*proposal, "rejected", proposal.Before, proposal.After, proposal.BaseRevisions))
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}
	result := proposalActionResult{Proposal: cloneProposal(*proposal)}
	service.store.mu.Unlock()
	service.cleanupStagedMedia(ownerID, proposalID)
	return result, nil
}

func (service *proposalService) undo(ownerID, proposalID string) (proposalActionResult, error) {
	service.store.mu.Lock()
	proposalIndex := findOwnedProposalIndexLocked(&service.store.data, ownerID, proposalID)
	if proposalIndex < 0 {
		service.store.mu.Unlock()
		return proposalActionResult{}, proposalFailure(404, "not_found", "AI proposal not found")
	}
	proposal := &service.store.data.AIProposals[proposalIndex]
	if proposal.Status != "applied" {
		service.store.mu.Unlock()
		return proposalActionResult{}, proposalFailure(409, "proposal_not_applied", "Only an applied proposal can be undone")
	}
	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}

	result := proposalActionResult{}
	switch proposal.Kind {
	case "entity_update", "entity_create":
		campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, proposal.CampaignID)
		if campaignIndex < 0 {
			err = proposalFailure(409, "stale_revision", "The applied campaign no longer exists")
			break
		}
		campaign := &service.store.data.Campaigns[campaignIndex]
		if campaign.Revision != proposal.AppliedRevisions["campaign"] {
			err = staleRevisionFailure("campaign")
			break
		}
		entities, entityIndex, current := findEntityInCampaign(campaign, proposal.Target.EntityID)
		if entities == nil || current.Revision != proposal.AppliedRevisions["entity:"+proposal.Target.EntityID] {
			err = staleRevisionFailure("entity")
			break
		}
		if proposal.Kind == "entity_create" {
			*entities = append((*entities)[:entityIndex], (*entities)[entityIndex+1:]...)
			campaign.Revision++
			*campaign = ensureCampaignShape(*campaign)
			result.Campaign = campaignPointer(*campaign)
		} else {
			var restored knowledgeEntity
			if unmarshalErr := json.Unmarshal(proposal.Before, &restored); unmarshalErr != nil {
				err = unmarshalErr
				break
			}
			restored.ID = current.ID
			restored.Kind = current.Kind
			restored.Revision = current.Revision + 1
			restored = ensureKnowledgeEntities([]knowledgeEntity{restored})[0]
			(*entities)[entityIndex] = restored
			campaign.Revision++
			*campaign = ensureCampaignShape(*campaign)
			result.Campaign = campaignPointer(*campaign)
			result.Entity = entityPointer(restored)
		}
	case "event_update", "event_create":
		campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, proposal.CampaignID)
		if campaignIndex < 0 {
			err = proposalFailure(409, "stale_revision", "The applied campaign no longer exists")
			break
		}
		campaign := &service.store.data.Campaigns[campaignIndex]
		if campaign.Revision != proposal.AppliedRevisions["campaign"] {
			err = staleRevisionFailure("campaign")
			break
		}
		eventIndex, current := findEventInCampaign(campaign, proposal.Target.EventID)
		if eventIndex < 0 || current.Revision != proposal.AppliedRevisions["event:"+proposal.Target.EventID] {
			err = staleRevisionFailure("event")
			break
		}
		if proposal.Kind == "event_create" {
			campaign.Events = append(campaign.Events[:eventIndex], campaign.Events[eventIndex+1:]...)
			campaign.Revision++
			*campaign = ensureCampaignShape(*campaign)
			result.Campaign = campaignPointer(*campaign)
		} else {
			var restored worldEvent
			if unmarshalErr := json.Unmarshal(proposal.Before, &restored); unmarshalErr != nil {
				err = unmarshalErr
				break
			}
			restored.ID = current.ID
			restored.Revision = current.Revision + 1
			restored = normalizeWorldEventCandidate(restored, *campaign)
			campaign.Events[eventIndex] = restored
			campaign.Revision++
			*campaign = ensureCampaignShape(*campaign)
			result.Campaign = campaignPointer(*campaign)
			result.Event = eventPointer(restored)
		}
	case "campaign_create":
		campaignIndex := findOwnedCampaignIndexLocked(&service.store.data, ownerID, proposal.CampaignID)
		if campaignIndex < 0 || service.store.data.Campaigns[campaignIndex].Revision != proposal.AppliedRevisions["campaign"] {
			err = staleRevisionFailure("campaign")
			break
		}
		service.store.data.Campaigns = append(service.store.data.Campaigns[:campaignIndex], service.store.data.Campaigns[campaignIndex+1:]...)
	default:
		err = proposalFailure(400, "unsupported_proposal_kind", fmt.Sprintf("unsupported proposal kind %q", proposal.Kind))
	}
	if err != nil {
		service.store.data = originalState
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	proposal = &service.store.data.AIProposals[proposalIndex]
	proposal.Status = "undone"
	proposal.UndoneAt = now
	proposal.UpdatedAt = now
	undoAfter, _ := json.Marshal(result)
	service.store.data.ProposalAudits = append(service.store.data.ProposalAudits, newProposalAudit(*proposal, "undone", proposal.AppliedResult, undoAfter, nil))
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		service.store.mu.Unlock()
		return proposalActionResult{}, err
	}
	result.Proposal = cloneProposal(*proposal)
	service.store.mu.Unlock()
	return result, nil
}

func findOwnedProposalIndexLocked(state *storageState, ownerID, proposalID string) int {
	for index := range state.AIProposals {
		if state.AIProposals[index].ID == proposalID && state.AIProposals[index].OwnerID == ownerID {
			return index
		}
	}
	return -1
}

func proposalExpired(proposal aiProposal, now time.Time) bool {
	if proposal.ExpiresAt == "" {
		return false
	}
	expiresAt, err := time.Parse(time.RFC3339, proposal.ExpiresAt)
	return err == nil && !now.Before(expiresAt)
}

func verifyProposalBaseRevisions(proposal aiProposal, campaign campaignData) error {
	if expected, ok := proposal.BaseRevisions["campaign"]; ok && campaign.Revision != expected {
		return staleRevisionFailure("campaign")
	}
	if proposal.Target.EntityID != "" {
		_, _, entity := findEntityInCampaign(&campaign, proposal.Target.EntityID)
		if expected, ok := proposal.BaseRevisions["entity:"+proposal.Target.EntityID]; ok {
			if entity.ID == "" || entity.Revision != expected {
				return staleRevisionFailure("entity")
			}
		}
	}
	if proposal.Target.EventID != "" {
		_, event := findEventInCampaign(&campaign, proposal.Target.EventID)
		if expected, ok := proposal.BaseRevisions["event:"+proposal.Target.EventID]; ok {
			if event.ID == "" || event.Revision != expected {
				return staleRevisionFailure("event")
			}
		}
	}
	return nil
}

func staleRevisionFailure(target string) error {
	return proposalFailure(409, "stale_revision", fmt.Sprintf("The %s changed after this proposal was created", target))
}

func applyEntityProposalLocked(proposal *aiProposal, campaign *campaignData) (proposalActionResult, error) {
	var candidate knowledgeEntity
	if err := json.Unmarshal(proposal.After, &candidate); err != nil {
		return proposalActionResult{}, proposalFailure(400, "invalid_candidate", err.Error())
	}
	if proposal.Kind == "entity_update" {
		entities, entityIndex, existing := findEntityInCampaign(campaign, proposal.Target.EntityID)
		if entities == nil {
			return proposalActionResult{}, staleRevisionFailure("entity")
		}
		candidate.ID = existing.ID
		candidate.Kind = existing.Kind
		candidate.Revision = existing.Revision + 1
		candidate = ensureKnowledgeEntities([]knowledgeEntity{candidate})[0]
		if err := validateProposalEntityMedia(candidate, &existing, proposal.OwnerID, campaign.ID); err != nil {
			return proposalActionResult{}, err
		}
		if err := validateEntityReferencesStrict(*campaign, candidate); err != nil {
			return proposalActionResult{}, err
		}
		(*entities)[entityIndex] = candidate
	} else {
		if _, _, existing := findEntityInCampaign(campaign, candidate.ID); existing.ID != "" {
			return proposalActionResult{}, proposalFailure(409, "duplicate_entity", "The proposed entity id already exists")
		}
		candidate.Revision = 1
		candidate = ensureKnowledgeEntities([]knowledgeEntity{candidate})[0]
		if err := validateProposalEntityMedia(candidate, nil, proposal.OwnerID, campaign.ID); err != nil {
			return proposalActionResult{}, err
		}
		if err := validateEntityReferencesStrict(*campaign, candidate); err != nil {
			return proposalActionResult{}, err
		}
		if err := appendEntityToCampaign(campaign, candidate); err != nil {
			return proposalActionResult{}, err
		}
	}
	campaign.Revision++
	*campaign = ensureCampaignShape(*campaign)
	proposal.After, _ = json.Marshal(candidate)
	proposal.AppliedResult = append(json.RawMessage(nil), proposal.After...)
	proposal.AppliedRevisions = map[string]int{"campaign": campaign.Revision, "entity:" + candidate.ID: candidate.Revision}
	return proposalActionResult{Campaign: campaignPointer(*campaign), Entity: entityPointer(candidate)}, nil
}

func applyEventProposalLocked(proposal *aiProposal, campaign *campaignData) (proposalActionResult, error) {
	var candidate worldEvent
	if err := json.Unmarshal(proposal.After, &candidate); err != nil {
		return proposalActionResult{}, proposalFailure(400, "invalid_candidate", err.Error())
	}
	if candidate.LocationID != "" {
		if _, _, location := findEntityInCampaign(campaign, candidate.LocationID); location.ID == "" || location.Kind != "location" {
			return proposalActionResult{}, proposalFailure(400, "invalid_relationship", "event locationId does not reference an existing location")
		}
	}
	if proposal.Kind == "event_update" {
		eventIndex, existing := findEventInCampaign(campaign, proposal.Target.EventID)
		if eventIndex < 0 {
			return proposalActionResult{}, staleRevisionFailure("event")
		}
		candidate.ID = existing.ID
		candidate.Revision = existing.Revision + 1
		candidate = normalizeWorldEventCandidate(candidate, *campaign)
		campaign.Events[eventIndex] = candidate
	} else {
		if eventIndex, _ := findEventInCampaign(campaign, candidate.ID); eventIndex >= 0 {
			return proposalActionResult{}, proposalFailure(409, "duplicate_event", "The proposed event id already exists")
		}
		candidate.Revision = 1
		candidate = normalizeWorldEventCandidate(candidate, *campaign)
		campaign.Events = append(campaign.Events, candidate)
	}
	campaign.Revision++
	*campaign = ensureCampaignShape(*campaign)
	proposal.After, _ = json.Marshal(candidate)
	proposal.AppliedResult = append(json.RawMessage(nil), proposal.After...)
	proposal.AppliedRevisions = map[string]int{"campaign": campaign.Revision, "event:" + candidate.ID: candidate.Revision}
	return proposalActionResult{Campaign: campaignPointer(*campaign), Event: eventPointer(candidate)}, nil
}

func appendEntityToCampaign(campaign *campaignData, entity knowledgeEntity) error {
	switch entity.Kind {
	case "location":
		campaign.Locations = append(campaign.Locations, entity)
	case "player":
		campaign.Players = append(campaign.Players, entity)
	case "npc":
		campaign.NPCs = append(campaign.NPCs, entity)
	case "monster":
		campaign.Monsters = append(campaign.Monsters, entity)
	case "quest":
		campaign.Quests = append(campaign.Quests, entity)
	case "lore":
		campaign.Lore = append(campaign.Lore, entity)
	default:
		return proposalFailure(400, "unsupported_entity_kind", fmt.Sprintf("unsupported entity kind %q", entity.Kind))
	}
	return nil
}

func validateEntityReferencesStrict(campaign campaignData, entity knowledgeEntity) error {
	known := campaignEntityIDSet(campaign)
	known[entity.ID] = struct{}{}
	validate := func(field, reference string) error {
		if reference == "" {
			return nil
		}
		if _, exists := known[reference]; !exists {
			return proposalFailure(400, "invalid_relationship", fmt.Sprintf("%s references missing entity %s", field, reference))
		}
		return nil
	}
	if err := validate("parentId", entity.ParentID); err != nil {
		return err
	}
	if err := validate("locationId", entity.LocationID); err != nil {
		return err
	}
	if err := validate("issuerId", entity.IssuerID); err != nil {
		return err
	}
	for _, related := range entity.Related {
		if err := validate("related", related.ID); err != nil {
			return err
		}
	}
	for _, plan := range entity.PreparedCombats {
		for _, playerID := range plan.PlayerIDs {
			if err := validate("preparedCombats.playerIds", playerID); err != nil {
				return err
			}
		}
		for _, item := range append(append([]preparedCombatItem{}, plan.Allies...), plan.Items...) {
			if err := validate("preparedCombats.items", item.EntityID); err != nil {
				return err
			}
		}
	}
	return nil
}

func campaignPointer(value campaignData) *campaignData     { return &value }
func entityPointer(value knowledgeEntity) *knowledgeEntity { return &value }
func eventPointer(value worldEvent) *worldEvent            { return &value }

func campaignRevisionMap(campaign campaignData) map[string]int {
	result := map[string]int{"campaign": campaign.Revision}
	for _, entity := range campaignEntities(campaign) {
		result["entity:"+entity.ID] = entity.Revision
	}
	for _, event := range campaign.Events {
		result["event:"+event.ID] = event.Revision
	}
	return result
}

func instantiateCampaignBlueprint(proposal aiProposal, ownerID, campaignID string, selected map[string]struct{}) (campaignData, error) {
	var blueprint campaignProposalBlueprint
	if err := json.Unmarshal(proposal.After, &blueprint); err != nil {
		return campaignData{}, proposalFailure(400, "invalid_blueprint", err.Error())
	}

	campaign := ensureCampaignShape(campaignData{
		ID: campaignID, Revision: 1, OwnerID: ownerID,
		Title: blueprint.Campaign.Title, System: blueprint.Campaign.System, SettingName: blueprint.Campaign.SettingName,
		InWorldDate: blueprint.Campaign.InWorldDate, Summary: blueprint.Campaign.Summary,
	})
	tempIDs := make(map[string]string)
	knownTemps := make(map[string]struct{})
	for _, item := range blueprint.Entities {
		knownTemps[item.TempKey] = struct{}{}
		if _, included := selected["entity:"+item.TempKey]; included {
			tempIDs[item.TempKey] = newID(item.Kind)
		}
	}
	for _, item := range blueprint.Events {
		knownTemps[item.TempKey] = struct{}{}
		if _, included := selected["event:"+item.TempKey]; included {
			tempIDs[item.TempKey] = newID("event")
		}
	}

	for _, item := range blueprint.Entities {
		if _, included := selected["entity:"+item.TempKey]; !included {
			continue
		}
		entityInput := item.createEntityInput
		if err := rewriteEntityInputReferences(&entityInput, tempIDs, knownTemps); err != nil {
			return campaignData{}, err
		}
		entity := materializeEntity(entityInput)
		entity.ID = tempIDs[item.TempKey]
		entity.Revision = 1
		entity = ensureKnowledgeEntities([]knowledgeEntity{entity})[0]
		if err := appendEntityToCampaign(&campaign, entity); err != nil {
			return campaignData{}, err
		}
	}
	campaign = ensureCampaignShape(campaign)

	for _, item := range blueprint.Events {
		if _, included := selected["event:"+item.TempKey]; !included {
			continue
		}
		eventInput := item.createWorldEventInput
		if eventInput.LocationID != "" {
			rewritten, rewriteErr := rewriteTemporaryReference(eventInput.LocationID, tempIDs, knownTemps)
			if rewriteErr != nil {
				return campaignData{}, rewriteErr
			}
			eventInput.LocationID = rewritten
		}
		event := materializeWorldEvent(eventInput, campaign, nil)
		event.ID = tempIDs[item.TempKey]
		event.Revision = 1
		campaign.Events = append(campaign.Events, event)
	}
	campaign = ensureCampaignShape(campaign)
	for _, entity := range campaignEntities(campaign) {
		if err := validateProposalEntityMedia(entity, nil, ownerID, campaignID); err != nil {
			return campaignData{}, err
		}
	}
	if err := validateCampaignReferences(campaign); err != nil {
		return campaignData{}, err
	}
	return campaign, nil
}

func selectedProposalOperations(operations []proposalOperation, selectedKeys []string) (map[string]struct{}, error) {
	known := make(map[string]proposalOperation, len(operations))
	for _, operation := range operations {
		known[operation.Key] = operation
	}
	selected := make(map[string]struct{})
	if len(selectedKeys) == 0 {
		for key := range known {
			selected[key] = struct{}{}
		}
		return selected, nil
	}
	for _, key := range selectedKeys {
		key = strings.TrimSpace(key)
		if _, exists := known[key]; !exists {
			return nil, proposalFailure(400, "unknown_operation", fmt.Sprintf("unknown proposal operation %q", key))
		}
		selected[key] = struct{}{}
	}
	for key, operation := range known {
		if operation.Required {
			selected[key] = struct{}{}
		}
	}
	return selected, nil
}

func validateSelectedProposalOperationDependencies(operations []proposalOperation, selected map[string]struct{}) error {
	operationByKey := make(map[string]proposalOperation, len(operations))
	for _, operation := range operations {
		operationByKey[operation.Key] = operation
	}
	for key := range selected {
		operation := operationByKey[key]
		for _, dependency := range operation.DependsOn {
			if _, known := operationByKey[dependency]; !known {
				continue
			}
			if _, included := selected[dependency]; !included {
				return proposalFailure(400, "missing_dependency", fmt.Sprintf("operation %s requires %s", key, dependency))
			}
		}
	}
	return nil
}

func rewriteEntityInputReferences(input *createEntityInput, tempIDs map[string]string, knownTemps map[string]struct{}) error {
	var err error
	if input.ParentID, err = rewriteTemporaryReference(input.ParentID, tempIDs, knownTemps); err != nil {
		return err
	}
	if input.LocationID, err = rewriteTemporaryReference(input.LocationID, tempIDs, knownTemps); err != nil {
		return err
	}
	if input.IssuerID, err = rewriteTemporaryReference(input.IssuerID, tempIDs, knownTemps); err != nil {
		return err
	}
	for index := range input.Related {
		input.Related[index].ID, err = rewriteTemporaryReference(input.Related[index].ID, tempIDs, knownTemps)
		if err != nil {
			return err
		}
	}
	rewritePlan := func(plan *preparedCombatPlan) error {
		if plan == nil {
			return nil
		}
		for index := range plan.PlayerIDs {
			plan.PlayerIDs[index], err = rewriteTemporaryReference(plan.PlayerIDs[index], tempIDs, knownTemps)
			if err != nil {
				return err
			}
		}
		for index := range plan.Allies {
			plan.Allies[index].EntityID, err = rewriteTemporaryReference(plan.Allies[index].EntityID, tempIDs, knownTemps)
			if err != nil {
				return err
			}
		}
		for index := range plan.Items {
			plan.Items[index].EntityID, err = rewriteTemporaryReference(plan.Items[index].EntityID, tempIDs, knownTemps)
			if err != nil {
				return err
			}
		}
		return nil
	}
	if err := rewritePlan(input.PreparedCombat); err != nil {
		return err
	}
	for index := range input.PreparedCombats {
		if err := rewritePlan(&input.PreparedCombats[index]); err != nil {
			return err
		}
	}
	return nil
}

func rewriteTemporaryReference(reference string, tempIDs map[string]string, knownTemps map[string]struct{}) (string, error) {
	reference = strings.TrimSpace(reference)
	if reference == "" {
		return "", nil
	}
	if resolved, exists := tempIDs[reference]; exists {
		return resolved, nil
	}
	if _, isTemporary := knownTemps[reference]; isTemporary {
		return "", proposalFailure(400, "missing_dependency", fmt.Sprintf("excluded operation is still referenced by temp key %s", reference))
	}
	return reference, nil
}

func validateCampaignReferences(campaign campaignData) error {
	known := campaignEntityIDSet(campaign)
	for _, entity := range campaignEntities(campaign) {
		if err := validateEntityReferencesStrict(campaign, entity); err != nil {
			return err
		}
	}
	for _, event := range campaign.Events {
		if event.LocationID == "" {
			continue
		}
		if _, exists := known[event.LocationID]; !exists {
			return proposalFailure(400, "invalid_relationship", fmt.Sprintf("event %s references missing location %s", event.ID, event.LocationID))
		}
		_, _, location := findEntityInCampaign(&campaign, event.LocationID)
		if location.Kind != "location" {
			return proposalFailure(400, "invalid_relationship", fmt.Sprintf("event %s locationId does not reference a location", event.ID))
		}
	}
	return nil
}

func (service *proposalService) registerStagedMedia(ownerID, proposalID string, intent proposalMediaIntent) (proposalMediaResult, error) {
	service.store.mu.Lock()
	defer service.store.mu.Unlock()
	proposalIndex := findOwnedProposalIndexLocked(&service.store.data, ownerID, proposalID)
	if proposalIndex < 0 {
		return proposalMediaResult{}, proposalFailure(404, "not_found", "AI proposal not found")
	}
	proposal := &service.store.data.AIProposals[proposalIndex]
	if proposal.Status != "pending" {
		return proposalMediaResult{}, proposalFailure(409, "proposal_not_pending", "Media can only be attached to a pending proposal")
	}
	intent = normalizeProposalMediaIntent(intent)
	if err := validateProposalMediaIntent(*proposal, intent); err != nil {
		return proposalMediaResult{}, err
	}
	intent.Status = "staged"
	expectedPrefix := path.Join("/api/ai/proposals", sanitizeUploadPathSegment(proposalID), "media") + "/"
	if !strings.HasPrefix(intent.PreviewURL, expectedPrefix) {
		return proposalMediaResult{}, proposalFailure(400, "invalid_media_path", "Staged media path is outside this proposal")
	}
	for _, existing := range proposal.MediaIntents {
		if existing.ID == intent.ID {
			return proposalMediaResult{}, proposalFailure(409, "duplicate_media", "Media id already exists")
		}
	}
	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		return proposalMediaResult{}, err
	}
	proposal.MediaIntents = append(proposal.MediaIntents, intent)
	if err := applyMediaIntentToAfter(proposal, intent); err != nil {
		service.store.data = originalState
		return proposalMediaResult{}, err
	}
	proposal.Diff = diffJSON(proposal.Before, proposal.After)
	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		return proposalMediaResult{}, err
	}
	return proposalMediaResult{Proposal: cloneProposal(*proposal), Media: intent}, nil
}

func (service *proposalService) updateMediaAttachment(ownerID, proposalID string, input proposalMediaAttachmentInput) (proposalMediaResult, error) {
	service.store.mu.Lock()
	defer service.store.mu.Unlock()
	proposalIndex := findOwnedProposalIndexLocked(&service.store.data, ownerID, proposalID)
	if proposalIndex < 0 {
		return proposalMediaResult{}, proposalFailure(404, "not_found", "AI proposal not found")
	}
	proposal := &service.store.data.AIProposals[proposalIndex]
	if proposal.Status != "pending" {
		return proposalMediaResult{}, proposalFailure(409, "proposal_not_pending", "Media can only be attached to a pending proposal")
	}
	mediaIndex := -1
	for index := range proposal.MediaIntents {
		if proposal.MediaIntents[index].ID == strings.TrimSpace(input.MediaID) {
			mediaIndex = index
			break
		}
	}
	if mediaIndex < 0 {
		return proposalMediaResult{}, proposalFailure(404, "media_not_found", "Proposal media not found")
	}
	originalState, err := cloneStorageState(service.store.data)
	if err != nil {
		return proposalMediaResult{}, err
	}
	originalMediaIntents := append([]proposalMediaIntent(nil), proposal.MediaIntents...)
	media := proposal.MediaIntents[mediaIndex]
	if strings.TrimSpace(input.Purpose) != "" {
		media.Purpose = strings.TrimSpace(input.Purpose)
	}
	if strings.TrimSpace(input.OperationKey) != "" {
		media.OperationKey = strings.TrimSpace(input.OperationKey)
	}
	if strings.TrimSpace(input.Field) != "" {
		media.Field = strings.TrimSpace(input.Field)
	}
	if input.Alt != "" {
		media.Alt = strings.TrimSpace(input.Alt)
	}
	if input.Caption != "" {
		media.Caption = strings.TrimSpace(input.Caption)
	}
	if input.Prompt != "" {
		media.Prompt = strings.TrimSpace(input.Prompt)
	}
	if input.Selected != nil {
		media.Selected = input.Selected
	}
	media = normalizeProposalMediaIntent(media)
	if err := validateProposalMediaIntent(*proposal, media); err != nil {
		return proposalMediaResult{}, err
	}
	proposal.MediaIntents[mediaIndex] = media
	if err := rebuildProposalMediaInjections(proposal, originalMediaIntents); err != nil {
		service.store.data = originalState
		return proposalMediaResult{}, err
	}
	proposal.Diff = diffJSON(proposal.Before, proposal.After)
	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := service.store.saveLocked(); err != nil {
		service.store.data = originalState
		return proposalMediaResult{}, err
	}
	return proposalMediaResult{Proposal: cloneProposal(*proposal), Media: media}, nil
}

func rebuildProposalMediaInjections(proposal *aiProposal, previous []proposalMediaIntent) error {
	for _, media := range previous {
		if err := removeMediaIntentFromAfter(proposal, media); err != nil {
			return err
		}
	}
	for _, media := range proposal.MediaIntents {
		if media.Selected != nil && !*media.Selected {
			continue
		}
		if err := applyMediaIntentToAfter(proposal, media); err != nil {
			return err
		}
	}
	return nil
}

func removeMediaIntentFromAfter(proposal *aiProposal, media proposalMediaIntent) error {
	if media.PreviewURL == "" && media.FinalURL == "" {
		return nil
	}
	var root any
	if err := json.Unmarshal(proposal.After, &root); err != nil {
		return proposalFailure(400, "invalid_candidate", "Proposal candidate cannot remove media")
	}
	target, err := proposalMediaTarget(root, proposal, media)
	if err != nil {
		return err
	}
	field := strings.TrimSpace(media.Field)
	if field == "" {
		field = "art.url"
	}
	if field == "gallery" || field == "gallery[]" {
		gallery, _ := target["gallery"].([]any)
		filtered := make([]any, 0, len(gallery))
		for _, rawItem := range gallery {
			item, _ := rawItem.(map[string]any)
			urlValue := strings.TrimSpace(fmt.Sprint(item["url"]))
			if urlValue == media.PreviewURL || (media.FinalURL != "" && urlValue == media.FinalURL) {
				continue
			}
			filtered = append(filtered, rawItem)
		}
		target["gallery"] = filtered
	} else {
		parts := strings.Split(field, ".")
		fallback, hasFallback := proposalMediaFallbackValue(proposal, parts)
		current, hasCurrent := getMapPath(target, parts)
		currentText := strings.TrimSpace(fmt.Sprint(current))
		if hasCurrent && (currentText == media.PreviewURL || (media.FinalURL != "" && currentText == media.FinalURL)) {
			if hasFallback {
				setMapPath(target, parts, fallback)
			} else {
				deleteMapPath(target, parts)
			}
		}
		if strings.HasPrefix(field, "art.") {
			art, _ := target["art"].(map[string]any)
			if art != nil {
				for _, property := range []string{"alt", "caption"} {
					mediaValue := media.Alt
					if property == "caption" {
						mediaValue = media.Caption
					}
					if mediaValue == "" || strings.TrimSpace(fmt.Sprint(art[property])) != mediaValue {
						continue
					}
					fallbackValue, fallbackExists := proposalMediaFallbackValue(proposal, []string{"art", property})
					if fallbackExists {
						art[property] = fallbackValue
					} else {
						delete(art, property)
					}
				}
				if len(art) == 0 {
					delete(target, "art")
				}
			}
		}
	}
	updated, err := json.Marshal(root)
	if err != nil {
		return err
	}
	proposal.After = updated
	return nil
}

func proposalMediaTarget(root any, proposal *aiProposal, media proposalMediaIntent) (map[string]any, error) {
	target, ok := root.(map[string]any)
	if !ok {
		return nil, proposalFailure(400, "invalid_candidate", "Proposal candidate must be an object")
	}
	if proposal.Kind != "campaign_create" || media.OperationKey == "" || media.OperationKey == "campaign" {
		return target, nil
	}
	parts := strings.SplitN(media.OperationKey, ":", 2)
	if len(parts) != 2 {
		return nil, proposalFailure(400, "invalid_operation", "Invalid media operationKey")
	}
	collectionName := "entities"
	if parts[0] == "event" {
		collectionName = "events"
	}
	collection, _ := target[collectionName].([]any)
	for _, rawItem := range collection {
		item, itemOK := rawItem.(map[string]any)
		if itemOK && fmt.Sprint(item["tempKey"]) == parts[1] {
			return item, nil
		}
	}
	return nil, proposalFailure(400, "invalid_operation", "Media operationKey does not exist in the proposal")
}

func proposalMediaFallbackValue(proposal *aiProposal, parts []string) (any, bool) {
	if proposal.Kind == "campaign_create" || len(proposal.Before) == 0 || bytes.Equal(bytes.TrimSpace(proposal.Before), []byte("null")) {
		return nil, false
	}
	var before map[string]any
	if err := json.Unmarshal(proposal.Before, &before); err != nil {
		return nil, false
	}
	return getMapPath(before, parts)
}

func applyMediaIntentToAfter(proposal *aiProposal, media proposalMediaIntent) error {
	if media.PreviewURL == "" || (media.Selected != nil && !*media.Selected) {
		return nil
	}
	var root any
	if err := json.Unmarshal(proposal.After, &root); err != nil {
		return proposalFailure(400, "invalid_candidate", "Proposal candidate cannot accept media")
	}
	target, err := proposalMediaTarget(root, proposal, media)
	if err != nil {
		return err
	}
	field := strings.TrimSpace(media.Field)
	if field == "" {
		field = "art.url"
	}
	if field == "gallery" || field == "gallery[]" {
		gallery, _ := target["gallery"].([]any)
		gallery = append(gallery, map[string]any{"title": firstNonEmpty(media.Alt, "AI image"), "url": media.PreviewURL, "caption": media.Caption})
		target["gallery"] = gallery
	} else {
		setMapPath(target, strings.Split(field, "."), media.PreviewURL)
		if strings.HasPrefix(field, "art.") {
			art, _ := target["art"].(map[string]any)
			if media.Alt != "" {
				art["alt"] = media.Alt
			}
			if media.Caption != "" {
				art["caption"] = media.Caption
			}
		}
	}
	updated, err := json.Marshal(root)
	if err != nil {
		return err
	}
	proposal.After = updated
	return nil
}

func setMapPath(target map[string]any, parts []string, value any) {
	if len(parts) == 0 {
		return
	}
	if len(parts) == 1 {
		target[parts[0]] = value
		return
	}
	child, _ := target[parts[0]].(map[string]any)
	if child == nil {
		child = map[string]any{}
		target[parts[0]] = child
	}
	setMapPath(child, parts[1:], value)
}

func getMapPath(target map[string]any, parts []string) (any, bool) {
	if len(parts) == 0 {
		return target, true
	}
	value, exists := target[parts[0]]
	if !exists {
		return nil, false
	}
	if len(parts) == 1 {
		return value, true
	}
	child, ok := value.(map[string]any)
	if !ok {
		return nil, false
	}
	return getMapPath(child, parts[1:])
}

func deleteMapPath(target map[string]any, parts []string) bool {
	if len(parts) == 0 {
		return false
	}
	if len(parts) == 1 {
		if _, exists := target[parts[0]]; !exists {
			return false
		}
		delete(target, parts[0])
		return true
	}
	child, ok := target[parts[0]].(map[string]any)
	if !ok {
		return false
	}
	deleted := deleteMapPath(child, parts[1:])
	if deleted && len(child) == 0 {
		delete(target, parts[0])
	}
	return deleted
}

func (service *proposalService) promoteMediaLocked(proposal *aiProposal, campaignID string, selectedOperations map[string]struct{}) ([]promotedMediaMove, error) {
	moves := make([]promotedMediaMove, 0)
	for index := range proposal.MediaIntents {
		media := &proposal.MediaIntents[index]
		if media.Status != "staged" {
			continue
		}
		if err := validateProposalMediaIntent(*proposal, *media); err != nil {
			rollbackPromotedMedia(moves)
			return nil, err
		}
		operationSelected := true
		if selectedOperations != nil {
			_, operationSelected = selectedOperations[media.OperationKey]
		}
		if !operationSelected || (media.Selected != nil && !*media.Selected) {
			if err := removeMediaIntentFromAfter(proposal, *media); err != nil {
				rollbackPromotedMedia(moves)
				return nil, err
			}
			media.Status = "discarded"
			continue
		}
		if service.uploadDir == "" {
			rollbackPromotedMedia(moves)
			return nil, proposalFailure(500, "uploads_disabled", "Proposal has staged media but uploads are disabled")
		}
		fileName := path.Base(strings.TrimSpace(media.PreviewURL))
		if fileName == "." || fileName == "" {
			rollbackPromotedMedia(moves)
			return nil, proposalFailure(400, "invalid_media_path", "Invalid staged media path")
		}
		from := filepath.Join(service.proposalStagingDir(proposal.OwnerID, proposal.ID), fileName)
		toDir := filepath.Join(service.uploadDir, sanitizeUploadPathSegment(proposal.OwnerID), sanitizeUploadPathSegment(campaignID), "proposal-"+sanitizeUploadPathSegment(proposal.ID))
		if err := os.MkdirAll(toDir, 0o755); err != nil {
			rollbackPromotedMedia(moves)
			return nil, err
		}
		to := filepath.Join(toDir, fileName)
		if err := os.Rename(from, to); err != nil {
			rollbackPromotedMedia(moves)
			return nil, fmt.Errorf("promote proposal media: %w", err)
		}
		moves = append(moves, promotedMediaMove{from: from, to: to})
		finalURL := proposalPublicPath(sanitizeUploadPathSegment(proposal.OwnerID), sanitizeUploadPathSegment(campaignID), "proposal-"+sanitizeUploadPathSegment(proposal.ID), fileName)
		proposal.After = bytes.ReplaceAll(proposal.After, []byte(media.PreviewURL), []byte(finalURL))
		media.FinalURL = finalURL
		media.Status = "promoted"
	}
	proposal.Diff = diffJSON(proposal.Before, proposal.After)
	return moves, nil
}

func rollbackPromotedMedia(moves []promotedMediaMove) {
	for index := len(moves) - 1; index >= 0; index-- {
		_ = os.MkdirAll(filepath.Dir(moves[index].from), 0o755)
		_ = os.Rename(moves[index].to, moves[index].from)
	}
}
