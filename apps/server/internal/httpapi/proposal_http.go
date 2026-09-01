package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const maxProposalMediaSize = 32 << 20
const maxProposalMediaRequestSize = maxProposalMediaSize + (1 << 20)

var proposalImageContentTypes = map[string]struct{}{
	"image/jpeg": {},
	"image/png":  {},
	"image/webp": {},
}

func (srv *server) handleAIProposals(writer http.ResponseWriter, request *http.Request) {
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}
	if srv.proposals == nil {
		writeError(writer, http.StatusServiceUnavailable, "proposals_unavailable", "AI proposals are unavailable")
		return
	}

	trimmed := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/ai/proposals"), "/")
	if trimmed == "" {
		if request.Method != http.MethodGet {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
			return
		}
		proposals, err := srv.proposals.list(user.ID, request.URL.Query().Get("status"), request.URL.Query().Get("campaignId"))
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, proposals)
		return
	}

	segments := strings.Split(trimmed, "/")
	if len(segments) == 1 && segments[0] == "campaign" {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}
		var input campaignProposalInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		if err := bindProposalSourceToSession(request, &input.Source); err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		if err := srv.prepareGeneratedCampaignProposal(&input); err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		proposal, err := srv.proposals.createCampaign(user.ID, input)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusCreated, proposal)
		return
	}
	if len(segments) == 1 && segments[0] == "entity" {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}
		var input entityProposalInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		if err := bindProposalSourceToSession(request, &input.Source); err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		if err := srv.prepareGeneratedEntityProposal(user.ID, strings.TrimSpace(input.CampaignID), &input); err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		proposal, err := srv.proposals.createEntity(user.ID, strings.TrimSpace(input.CampaignID), input)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusCreated, proposal)
		return
	}
	if len(segments) == 1 && segments[0] == "event" {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}
		var input eventProposalInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		if err := bindProposalSourceToSession(request, &input.Source); err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		if err := srv.prepareGeneratedEventProposal(user.ID, strings.TrimSpace(input.CampaignID), &input); err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		proposal, err := srv.proposals.createEvent(user.ID, strings.TrimSpace(input.CampaignID), input)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusCreated, proposal)
		return
	}

	proposalID := segments[0]
	if len(segments) == 1 {
		if request.Method != http.MethodGet {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
			return
		}
		proposal, err := srv.proposals.get(user.ID, proposalID)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, proposal)
		return
	}
	if len(segments) == 2 && segments[1] == "apply" {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}
		var input proposalApplyInput
		if request.ContentLength != 0 {
			if err := readJSON(request, &input); err != nil {
				writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
				return
			}
		}
		result, err := srv.proposals.apply(user.ID, proposalID, input)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, result)
		return
	}
	if len(segments) == 2 && segments[1] == "reject" {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}
		result, err := srv.proposals.reject(user.ID, proposalID)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, result)
		return
	}
	if len(segments) == 2 && segments[1] == "undo" {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}
		result, err := srv.proposals.undo(user.ID, proposalID)
		if err != nil {
			writeProposalHTTPError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, result)
		return
	}
	if len(segments) == 2 && segments[1] == "media" {
		srv.handleProposalMediaUpload(writer, request, user.ID, proposalID)
		return
	}
	if len(segments) == 3 && segments[1] == "media" && segments[2] == "attachments" {
		srv.handleProposalMediaAttachment(writer, request, user.ID, proposalID)
		return
	}
	if len(segments) == 3 && segments[1] == "media" {
		srv.handleProposalMediaPreview(writer, request, user.ID, proposalID, segments[2])
		return
	}
	writeError(writer, http.StatusNotFound, "not_found", "AI proposal route not found")
}

func (srv *server) handleCampaignProposalCollection(writer http.ResponseWriter, request *http.Request, user authUser, campaignID string) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}
	proposals, err := srv.proposals.list(user.ID, request.URL.Query().Get("status"), campaignID)
	if err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, proposals)
}

func (srv *server) handleCampaignEntityProposal(writer http.ResponseWriter, request *http.Request, user authUser, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	var input entityProposalInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	input.CampaignID = campaignID
	if err := bindProposalSourceToSession(request, &input.Source); err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	if err := srv.prepareGeneratedEntityProposal(user.ID, campaignID, &input); err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	proposal, err := srv.proposals.createEntity(user.ID, campaignID, input)
	if err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	writeJSON(writer, http.StatusCreated, proposal)
}

func (srv *server) handleCampaignEventProposal(writer http.ResponseWriter, request *http.Request, user authUser, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	var input eventProposalInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	input.CampaignID = campaignID
	if err := bindProposalSourceToSession(request, &input.Source); err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	if err := srv.prepareGeneratedEventProposal(user.ID, campaignID, &input); err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	proposal, err := srv.proposals.createEvent(user.ID, campaignID, input)
	if err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	writeJSON(writer, http.StatusCreated, proposal)
}

func bindProposalSourceToSession(request *http.Request, source *proposalSource) error {
	if source == nil {
		return nil
	}
	bridgeSession := false
	if request != nil {
		if cookie, err := request.Cookie("shadow_edge_session"); err == nil {
			bridgeSession = strings.HasPrefix(strings.TrimSpace(cookie.Value), "ephemeral_")
		}
	}
	if bridgeSession {
		source.Type = "codex_app_server"
		return nil
	}
	if strings.EqualFold(strings.TrimSpace(source.Type), "codex_app_server") {
		return proposalFailure(http.StatusForbidden, "invalid_proposal_source", "codex_app_server provenance is reserved for the managed bridge")
	}
	return nil
}

func (srv *server) handleProposalMediaUpload(writer http.ResponseWriter, request *http.Request, ownerID, proposalID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	if strings.TrimSpace(srv.uploadDir) == "" {
		writeError(writer, http.StatusServiceUnavailable, "uploads_disabled", "Uploads are not configured")
		return
	}
	if _, err := srv.proposals.get(ownerID, proposalID); err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	// Multipart boundaries and form fields sit outside the file payload. Give
	// the envelope bounded headroom while enforcing the advertised 32 MiB cap
	// against the file bytes below.
	request.Body = http.MaxBytesReader(writer, request.Body, maxProposalMediaRequestSize)
	if err := request.ParseMultipartForm(multipartMemoryLimit); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(writer, http.StatusRequestEntityTooLarge, "file_too_large", "Proposal media must be 32 MiB or smaller")
			return
		}
		writeError(writer, http.StatusBadRequest, "bad_request", "Could not parse proposal media upload")
		return
	}
	if request.MultipartForm != nil {
		defer request.MultipartForm.RemoveAll()
	}
	file, header, err := request.FormFile("file")
	if err != nil {
		writeError(writer, http.StatusBadRequest, "missing_file", "file is required")
		return
	}
	defer file.Close()
	contentType, extension, err := detectUploadedMedia(file)
	if err == nil {
		if _, supported := proposalImageContentTypes[contentType]; !supported {
			err = fmt.Errorf("proposal media supports only PNG, JPEG, and WebP images")
		}
	}
	if err != nil {
		writeError(writer, http.StatusBadRequest, "unsupported_media", err.Error())
		return
	}
	mediaID := newID("media")
	stagingDir := srv.proposals.proposalStagingDir(ownerID, proposalID)
	if err := os.MkdirAll(stagingDir, 0o700); err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_prepare_failed", "Could not prepare proposal media staging")
		return
	}
	fileName := mediaID + extension
	filePath := filepath.Join(stagingDir, fileName)
	target, err := os.OpenFile(filePath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_open_failed", "Could not create proposal media")
		return
	}
	size, copyErr := io.Copy(target, io.LimitReader(file, maxProposalMediaSize+1))
	closeErr := target.Close()
	if size > maxProposalMediaSize {
		_ = os.Remove(filePath)
		writeError(writer, http.StatusRequestEntityTooLarge, "file_too_large", "Proposal media must be 32 MiB or smaller")
		return
	}
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(filePath)
		writeError(writer, http.StatusBadRequest, "upload_write_failed", "Could not store proposal media")
		return
	}
	alt := strings.TrimSpace(request.FormValue("alt"))
	if alt == "" && header != nil {
		alt = strings.TrimSpace(header.Filename)
	}
	intent := proposalMediaIntent{
		ID: mediaID, Purpose: request.FormValue("purpose"), OperationKey: request.FormValue("operationKey"),
		Field: request.FormValue("field"), Prompt: request.FormValue("prompt"), Alt: alt, Caption: request.FormValue("caption"),
		PreviewURL:  proposalPreviewPath(proposalID, fileName),
		ContentType: contentType, Size: size, Status: "staged",
	}
	result, err := srv.proposals.registerStagedMedia(ownerID, proposalID, intent)
	if err != nil {
		_ = os.Remove(filePath)
		writeProposalHTTPError(writer, err)
		return
	}
	writeJSON(writer, http.StatusCreated, result)
}

func (srv *server) handleProposalMediaPreview(writer http.ResponseWriter, request *http.Request, ownerID, proposalID, fileName string) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET and HEAD are supported")
		return
	}
	fileName = strings.TrimSpace(fileName)
	if fileName == "" || fileName == "." || fileName == ".." || filepath.Base(fileName) != fileName {
		writeError(writer, http.StatusNotFound, "not_found", "Proposal media not found")
		return
	}
	proposal, err := srv.proposals.get(ownerID, proposalID)
	if err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	expectedURL := proposalPreviewPath(proposalID, fileName)
	var media *proposalMediaIntent
	for index := range proposal.MediaIntents {
		candidate := &proposal.MediaIntents[index]
		if candidate.Status == "staged" && candidate.PreviewURL == expectedURL {
			media = candidate
			break
		}
	}
	if media == nil {
		writeError(writer, http.StatusNotFound, "not_found", "Proposal media not found")
		return
	}
	file, err := os.Open(filepath.Join(srv.proposals.proposalStagingDir(ownerID, proposalID), fileName))
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", "Proposal media not found")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		writeError(writer, http.StatusNotFound, "not_found", "Proposal media not found")
		return
	}
	writer.Header().Set("Cache-Control", "private, no-store")
	writer.Header().Set("X-Content-Type-Options", "nosniff")
	if media.ContentType != "" {
		writer.Header().Set("Content-Type", media.ContentType)
	}
	http.ServeContent(writer, request, fileName, info.ModTime(), file)
}

func (srv *server) handleProposalMediaAttachment(writer http.ResponseWriter, request *http.Request, ownerID, proposalID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	var input proposalMediaAttachmentInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	result, err := srv.proposals.updateMediaAttachment(ownerID, proposalID, input)
	if err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func writeProposalHTTPError(writer http.ResponseWriter, err error) {
	var typed *proposalError
	if errors.As(err, &typed) {
		writeError(writer, typed.Status, typed.Code, typed.Message)
		return
	}
	writeError(writer, http.StatusInternalServerError, "proposal_failed", fmt.Sprint(err))
}

func (srv *server) prepareGeneratedEntityProposal(ownerID, campaignID string, input *entityProposalInput) error {
	if input == nil || len(strings.TrimSpace(string(input.Patch))) > 0 || len(strings.TrimSpace(string(input.Candidate))) > 0 {
		return nil
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return proposalFailure(http.StatusBadRequest, "missing_candidate", "prompt, patch, or candidate is required")
	}
	campaign, err := srv.store.getCampaignForUser(ownerID, campaignID)
	if err != nil {
		return proposalFailure(http.StatusNotFound, "not_found", "Campaign not found")
	}
	generateInput := generateEntityDraftInput{Kind: strings.TrimSpace(input.Kind), Prompt: strings.TrimSpace(input.Prompt)}
	isUpdate := strings.EqualFold(strings.TrimSpace(input.Mode), "update")
	if isUpdate {
		_, _, existing := findEntityInCampaign(&campaign, strings.TrimSpace(input.EntityID))
		if existing.ID == "" {
			return proposalFailure(http.StatusNotFound, "not_found", "Entity not found")
		}
		current := entityCreateInputFromData(existing)
		generateInput.Kind = existing.Kind
		generateInput.Current = &current
		generated, generateErr := srv.generator.GenerateEntityPatch(campaign, generateInput)
		if generateErr != nil {
			return proposalFailure(http.StatusInternalServerError, "generate_proposal_failed", generateErr.Error())
		}
		if !isJSONObject(generated.Patch) {
			return proposalFailure(http.StatusInternalServerError, "invalid_generated_patch", "Generator returned an invalid entity patch")
		}
		input.Patch = generated.Patch
		input.Kind = existing.Kind
		input.Warnings = appendUniqueStrings(input.Warnings, generated.Notes...)
		if input.Source.Type == "" {
			input.Source.Type = "website_ai"
		}
		if input.Source.Provider == "" {
			input.Source.Provider = generated.Provider
		}
		return nil
	}
	generated, err := srv.generator.Generate(campaign, generateInput)
	if err != nil {
		return proposalFailure(http.StatusInternalServerError, "generate_proposal_failed", err.Error())
	}
	raw, err := json.Marshal(generated.Entity)
	if err != nil {
		return err
	}
	input.Candidate = raw
	if input.Kind == "" {
		input.Kind = generated.Entity.Kind
	}
	input.Warnings = appendUniqueStrings(input.Warnings, generated.Notes...)
	if input.Source.Type == "" {
		input.Source.Type = "website_ai"
	}
	if input.Source.Provider == "" {
		input.Source.Provider = generated.Provider
	}
	return nil
}

func (srv *server) prepareGeneratedCampaignProposal(input *campaignProposalInput) error {
	if input == nil || campaignBlueprintSupplied(input.Blueprint) {
		return nil
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return proposalFailure(http.StatusBadRequest, "missing_blueprint", "prompt or blueprint is required")
	}
	if srv.generator == nil {
		return proposalFailure(http.StatusServiceUnavailable, "generator_unavailable", "Campaign generator is unavailable")
	}
	generated, err := srv.generator.GenerateCampaignBlueprint(generateCampaignBlueprintInput{Prompt: strings.TrimSpace(input.Prompt)})
	if err != nil {
		return proposalFailure(http.StatusInternalServerError, "generate_campaign_proposal_failed", err.Error())
	}
	input.Blueprint = generated.Blueprint
	input.Warnings = appendUniqueStrings(input.Warnings, generated.Notes...)
	if input.Source.Type == "" {
		input.Source.Type = "website_ai"
	}
	if input.Source.Provider == "" {
		input.Source.Provider = generated.Provider
	}
	return nil
}

func campaignBlueprintSupplied(blueprint campaignProposalBlueprint) bool {
	return strings.TrimSpace(blueprint.Campaign.Title) != "" ||
		strings.TrimSpace(blueprint.Campaign.System) != "" ||
		strings.TrimSpace(blueprint.Campaign.SettingName) != "" ||
		strings.TrimSpace(blueprint.Campaign.InWorldDate) != "" ||
		strings.TrimSpace(blueprint.Campaign.Summary) != "" ||
		len(blueprint.Entities) > 0 || len(blueprint.Events) > 0
}

func (srv *server) prepareGeneratedEventProposal(ownerID, campaignID string, input *eventProposalInput) error {
	if input == nil || len(strings.TrimSpace(string(input.Patch))) > 0 || len(strings.TrimSpace(string(input.Candidate))) > 0 {
		return nil
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return proposalFailure(http.StatusBadRequest, "missing_candidate", "prompt, patch, or candidate is required")
	}
	campaign, err := srv.store.getCampaignForUser(ownerID, campaignID)
	if err != nil {
		return proposalFailure(http.StatusNotFound, "not_found", "Campaign not found")
	}
	generateInput := generateWorldEventInput{Prompt: strings.TrimSpace(input.Prompt)}
	isUpdate := strings.EqualFold(strings.TrimSpace(input.Mode), "update")
	if isUpdate {
		_, existing := findEventInCampaign(&campaign, strings.TrimSpace(input.EventID))
		if existing.ID == "" {
			return proposalFailure(http.StatusNotFound, "not_found", "Event not found")
		}
		current := worldEventCreateInputFromData(existing)
		generateInput.Current = &current
		generateInput.LocationID = existing.LocationID
		generateInput.Type = existing.Type
		generated, generateErr := srv.generator.GenerateWorldEventPatch(campaign, generateInput)
		if generateErr != nil {
			return proposalFailure(http.StatusInternalServerError, "generate_proposal_failed", generateErr.Error())
		}
		if !isJSONObject(generated.Patch) {
			return proposalFailure(http.StatusInternalServerError, "invalid_generated_patch", "Generator returned an invalid event patch")
		}
		input.Patch = generated.Patch
		input.Warnings = appendUniqueStrings(input.Warnings, generated.Notes...)
		if input.Source.Type == "" {
			input.Source.Type = "website_ai"
		}
		if input.Source.Provider == "" {
			input.Source.Provider = generated.Provider
		}
		return nil
	}
	generated, err := srv.generator.GenerateWorldEvent(campaign, generateInput)
	if err != nil {
		return proposalFailure(http.StatusInternalServerError, "generate_proposal_failed", err.Error())
	}
	raw, err := json.Marshal(generated.Event)
	if err != nil {
		return err
	}
	input.Candidate = raw
	input.Warnings = appendUniqueStrings(input.Warnings, generated.Notes...)
	if input.Source.Type == "" {
		input.Source.Type = "website_ai"
	}
	if input.Source.Provider == "" {
		input.Source.Provider = generated.Provider
	}
	return nil
}

func entityCreateInputFromData(entity knowledgeEntity) createEntityInput {
	body, _ := json.Marshal(entity)
	var input createEntityInput
	_ = json.Unmarshal(body, &input)
	return input
}

func worldEventCreateInputFromData(event worldEvent) createWorldEventInput {
	body, _ := json.Marshal(event)
	var input createWorldEventInput
	_ = json.Unmarshal(body, &input)
	return input
}

func generatedValueIsEmpty(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(typed) == ""
	case float64:
		return typed == 0
	case []any:
		return len(typed) == 0
	case map[string]any:
		return len(typed) == 0
	default:
		return false
	}
}
