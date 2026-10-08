package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"
)

type Options struct {
	DatabaseURL          string
	ImportLegacyJSON     bool
	RequireSubscription  bool
	DataFile             string
	BestiaryCacheFile    string
	ItemCatalogCacheFile string
	WebDir               string
	UploadDir            string
	AI                   AIOptions
	Codex                CodexBridgeOptions
	Auth                 AuthOptions
	PublicBaseURL        string
}

type server struct {
	foundry             *foundryManager
	mapGenerationOwners sync.Map
	cloud               *cloudDatabase
	assets              *cloudAssets
	store               *campaignStore
	bestiary            *bestiaryCatalog
	items               *itemCatalog
	generator           entityGenerator
	shares              *initiativeShareManager
	auth                *authManager
	web                 http.Handler
	webDir              string
	uploads             http.Handler
	uploadDir           string
	surveys             *surveyManager
	proposals           *proposalService
	codex               *codexBridgeManager
	characters          *characterManager
	aiJobs              *aiJobManager
}

type envelope struct {
	Data  any        `json:"data"`
	Error *errorBody `json:"error"`
	Meta  any        `json:"meta"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewServer(options Options) (http.Handler, error) {
	var store *campaignStore
	var cloud *cloudDatabase
	var assets *cloudAssets
	var err error
	initialized := false
	defer func() {
		if !initialized && cloud != nil {
			cloud.close()
		}
	}()
	if options.DatabaseURL != "" {
		cloud, err = openCloudDatabase(options.DatabaseURL)
		if err != nil {
			return nil, err
		}
		assets, err = newCloudAssets(cloud, options.UploadDir)
		if err != nil {
			return nil, err
		}
		store, err = loadCloudCampaignStore(cloud, assets, options)
	} else {
		store, err = newCampaignStore(options.DataFile)
	}
	if err != nil {
		return nil, err
	}

	bestiary, err := newBestiaryCatalog(options.BestiaryCacheFile)
	if err != nil {
		return nil, err
	}

	items, err := newItemCatalog(options.ItemCatalogCacheFile)
	if err != nil {
		return nil, err
	}

	webHandler, err := newWebAppHandler(options.WebDir)
	if err != nil {
		return nil, err
	}

	uploadHandler, err := newUploadsHandler(options.UploadDir)
	if err != nil {
		return nil, err
	}
	var tiles *tileCache
	if assets != nil {
		uploadHandler = assets.handler()
		tiles = newTileCache(options.UploadDir, assets)
		uploadHandler = tiles.handler(uploadHandler)
	}

	auth, err := newAuthManager(options.Auth, store)
	if err != nil {
		return nil, err
	}

	srv := &server{
		cloud:     cloud,
		assets:    assets,
		store:     store,
		bestiary:  bestiary,
		items:     items,
		generator: newEntityGenerator(options.AI),
		shares:    newInitiativeShareManager(store, options.PublicBaseURL),
		auth:      auth,
		web:       webHandler,
		webDir:    options.WebDir,
		uploads:   uploadHandler,
		uploadDir: options.UploadDir,
		proposals: newProposalService(store, options.UploadDir),
		codex:     newCodexBridgeManager(options.Codex, auth),
	}
	srv.proposals.assets = assets
	srv.surveys = newSurveyManager(store, options.PublicBaseURL)
	srv.characters = newCharacterManager(store, options.PublicBaseURL)
	srv.foundry = newFoundryManager(srv)
	srv.aiJobs, err = newAIJobManagerWithCloud(store.path+".ai-jobs.json", cloud, options.ImportLegacyJSON)
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", srv.handleHealth)
	mux.HandleFunc("/foundry/connect", srv.foundry.connectPage)
	mux.HandleFunc("/foundry/module.json", srv.foundry.distribution)
	mux.HandleFunc("/foundry/shadow-edge-gm.zip", srv.foundry.distribution)
	mux.HandleFunc("/display/", srv.shares.handlePublicDisplayPage)
	mux.HandleFunc("/api/display-meta/", srv.shares.handlePublicDisplayMeta)
	mux.HandleFunc("/api/display/", srv.shares.handlePublicDisplayAPI)
	mux.HandleFunc("/initiative/", srv.shares.handlePublicInitiativePage)
	mux.HandleFunc("/survey/", srv.surveys.handlePublicPage)
	mux.HandleFunc("/master/surveys", srv.handleMasterSurveyPage)
	mux.HandleFunc("/api/initiative-meta/", srv.shares.handlePublicInitiativeMeta)
	mux.HandleFunc("/api/initiative/", srv.shares.handlePublicInitiativeAPI)
	mux.HandleFunc("/api/survey/", srv.surveys.handlePublicAPI)
	mux.HandleFunc("/api/character-invites/", srv.characters.handlePublicInvite)
	mux.HandleFunc("/api/character-sheets/", srv.characters.handlePublicSheet)
	mux.HandleFunc("/api/auth/session", srv.auth.handleSession)
	mux.HandleFunc("/api/auth/subscription", srv.handleSubscription)
	mux.HandleFunc("/api/admin/subscriptions", srv.handleAdminSubscriptions)
	mux.HandleFunc("/api/feedback", srv.handleFeedback)
	mux.HandleFunc("/api/admin/feedback", srv.handleAdminFeedback)
	mux.HandleFunc("/api/auth/login", srv.auth.handleLogin)
	mux.HandleFunc("/api/auth/register", srv.auth.handleRegister)
	mux.HandleFunc("/api/auth/logout", srv.auth.handleLogout)
	mux.HandleFunc("/api/auth/oauth/", srv.auth.handleOAuth)
	mux.HandleFunc("/api/campaigns", srv.handleCampaigns)
	mux.HandleFunc("/api/campaign-templates", srv.handleReadyCampaigns)
	mux.HandleFunc("/api/campaign-templates/", srv.handleReadyCampaigns)
	mux.HandleFunc("/api/campaigns/", srv.handleCampaignByPath)
	mux.HandleFunc("/api/ai/proposals", srv.handleAIProposals)
	mux.HandleFunc("/api/ai/proposals/", srv.handleAIProposals)
	mux.HandleFunc("/api/ai/codex/status", srv.handleCodexStatus)
	mux.HandleFunc("/api/ai/codex/connect", srv.handleCodexConnect)
	mux.HandleFunc("/api/ai/codex/disconnect", srv.handleCodexDisconnect)
	mux.HandleFunc("/api/ai/codex/prompts", srv.handleCodexPrompt)
	mux.HandleFunc("/api/ai/jobs", srv.handleAIJobs)
	mux.HandleFunc("/api/ai/jobs/", srv.handleAIJobs)
	mux.HandleFunc("/api/bestiary", srv.handleBestiary)
	mux.HandleFunc("/api/bestiary/", srv.handleBestiaryByPath)
	mux.HandleFunc("/api/items-catalog", srv.handleItemCatalog)
	mux.HandleFunc("/api/items-catalog/", srv.handleItemCatalogByPath)
	if uploadHandler != nil {
		mux.Handle("/uploads/", uploadHandler)
	}

	initialized = true
	if tiles != nil {
		go tiles.run()
	}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if cloud != nil {
			if err := cloud.check(); err != nil {
				writeError(writer, 503, "storage_unavailable", "Хранилище временно недоступно.")
				return
			}
		}
		applyCORSHeaders(writer, request)
		if strings.HasPrefix(request.URL.Path, "/api/integrations/foundry/") {
			srv.foundry.handle(writer, request)
			return
		}
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		if requiresTrustedMutationOrigin(srv.auth, request) && !isTrustedMutationOrigin(request) {
			writeError(writer, http.StatusForbidden, "origin_not_allowed", "Источник запроса не разрешён.")
			return
		}
		if srv.auth.shouldProtect(request.URL.Path) {
			if _, ok := srv.auth.currentUser(request); !ok {
				writeError(writer, http.StatusUnauthorized, "auth_required", "Нужен вход в кабинет мастера.")
				return
			}
		}
		if options.RequireSubscription && request.Method == http.MethodPost {
			if requiresGenerationSubscription(path.Clean(request.URL.Path)) {
				user, ok := srv.requireAuthUser(writer, request)
				if !ok {
					return
				}
				account, found := srv.store.getUserByID(user.ID)
				if !found || !subscriptionActive(account.Subscription, time.Now()) {
					writeError(writer, http.StatusPaymentRequired, "subscription_required", "Генерации доступны только с активной подпиской Shadow Edge GM.")
					return
				}
			}
		}
		switch {
		case isServerManagedPath(request.URL.Path):
			if srv.queueAIGeneration(writer, request, mux) {
				return
			}
			mux.ServeHTTP(writer, request)
		case srv.web != nil:
			srv.web.ServeHTTP(writer, request)
		default:
			http.NotFound(writer, request)
		}
	}), nil
}

func requiresTrustedMutationOrigin(auth *authManager, request *http.Request) bool {
	if request == nil {
		return false
	}
	switch request.Method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
	default:
		return false
	}
	return strings.HasPrefix(request.URL.Path, "/api/auth/") || (auth != nil && auth.shouldProtect(request.URL.Path))
}

func isServerManagedPath(path string) bool {
	return path == "/healthz" ||
		strings.HasPrefix(path, "/foundry/") ||
		strings.HasPrefix(path, "/api/") ||
		strings.HasPrefix(path, "/initiative/") ||
		strings.HasPrefix(path, "/survey/") ||
		path == "/master/surveys" ||
		strings.HasPrefix(path, "/display/") ||
		strings.HasPrefix(path, "/uploads/")
}

func (srv *server) handleHealth(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}

func (srv *server) handleMasterSurveyPage(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		http.NotFound(writer, request)
		return
	}
	if _, ok := srv.requireAuthUser(writer, request); !ok {
		return
	}
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = writer.Write([]byte(masterSurveyHTMLV2))
}

func (srv *server) requireAuthUser(writer http.ResponseWriter, request *http.Request) (authUser, bool) {
	user, ok := srv.auth.currentUser(request)
	if !ok {
		writeError(writer, http.StatusUnauthorized, "auth_required", "Нужен вход в кабинет мастера.")
		return authUser{}, false
	}

	return user, true
}

func (srv *server) requireOwnedCampaign(writer http.ResponseWriter, user authUser, campaignID string) (campaignData, bool) {
	campaign, err := srv.store.getCampaignForUser(user.ID, campaignID)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return campaignData{}, false
	}

	return campaign, true
}

func (srv *server) handleCampaigns(writer http.ResponseWriter, request *http.Request) {
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}

	switch request.Method {
	case http.MethodGet:
		writeJSON(writer, http.StatusOK, srv.store.listCampaignsForUser(user.ID))
	case http.MethodPost:
		var input createCampaignInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}

		campaign, err := srv.store.createCampaignForUser(user.ID, input)
		if err != nil {
			if input.TemplateID != "" && input.TemplateID != "icewind-dale-rus" {
				writeError(writer, http.StatusBadRequest, "unknown_campaign_template", "Готовая кампания не найдена.")
				return
			}
			writeError(writer, http.StatusInternalServerError, "create_campaign_failed", err.Error())
			return
		}

		writeJSON(writer, http.StatusCreated, campaign)
	default:
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET and POST are supported")
	}
}

func (srv *server) handleCampaignByPath(writer http.ResponseWriter, request *http.Request) {
	path := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/campaigns/"), "/")
	if path == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Campaign not found")
		return
	}

	segments := strings.Split(path, "/")
	campaignID := segments[0]
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}
	campaign, ok := srv.requireOwnedCampaign(writer, user, campaignID)
	if !ok {
		return
	}
	if campaign.ReadyCampaign != nil && request.Method != http.MethodGet && request.Method != http.MethodHead {
		// Gameplay endpoints remain available; authoring cannot trigger media/AI
		// side effects before the store's integrity check rejects the change.
		locked := len(segments) > 1 && (segments[1] == "world-maps" || segments[1] == "events" || segments[1] == "bestiary")
		locked = locked || (len(segments) > 2 && segments[1] == "combat" && segments[2] == "generate")
		locked = locked || (len(segments) > 2 && segments[1] == "ai" && (segments[2] == "proposals" || len(segments) > 3))
		if locked {
			writeError(writer, 403, "ready_campaign_read_only", errReadyCampaignReadOnly.Error())
			return
		}
	}

	if len(segments) == 1 {
		switch request.Method {
		case http.MethodGet:
			writeJSON(writer, http.StatusOK, campaign)
		case http.MethodPut, http.MethodPatch:
			var input updateCampaignInput
			if err := readJSON(request, &input); err != nil {
				writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
				return
			}

			campaign, err := srv.store.updateCampaign(campaignID, input)
			if err != nil {
				status := http.StatusInternalServerError
				if strings.Contains(err.Error(), "not found") {
					status = http.StatusNotFound
				}
				writeError(writer, status, "update_campaign_failed", err.Error())
				return
			}

			writeJSON(writer, http.StatusOK, campaign)
		default:
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET, PUT and PATCH are supported")
		}
		return
	}

	switch {
	case (len(segments) == 2 || len(segments) == 3) && segments[1] == "session-maps":
		srv.handleSessionMaps(writer, request, user, campaign, segments)
	case (len(segments) == 2 || len(segments) == 3) && segments[1] == "world-maps":
		action := ""
		if len(segments) == 3 {
			action = segments[2]
		}
		srv.handleWorldMaps(writer, request, user, campaign, action)
	case len(segments) == 4 && segments[1] == "sessions" && segments[3] == "analysis":
		srv.handleSessionAnalysis(writer, request, user.ID, campaignID, segments[2])
	case len(segments) == 3 && segments[1] == "ai" && segments[2] == "chat":
		srv.handleCampaignChat(writer, request, user, campaign)
	case len(segments) == 5 && segments[1] == "ai" && segments[2] == "chat" && segments[3] == "drafts" && segments[4] == "apply":
		srv.handleChatDraftApply(writer, request, user, campaignID)
	case len(segments) == 5 && segments[1] == "ai" && segments[2] == "chat" && segments[3] == "drafts" && segments[4] == "edit":
		srv.handleChatDraftEdit(writer, request, user, campaignID)
	case (len(segments) == 2 || len(segments) == 3) && segments[1] == "sessions":
		id := ""
		if len(segments) == 3 {
			id = segments[2]
		}
		srv.handleImportedSessions(writer, request, campaignID, id)
	case len(segments) == 2 && segments[1] == "character-invite":
		srv.characters.handleOwnerInvite(writer, request, user.ID, campaignID)
	case (len(segments) == 2 || len(segments) == 3) && segments[1] == "character-sheets":
		sheetID := ""
		if len(segments) == 3 {
			sheetID = segments[2]
		}
		srv.characters.handleOwnerSheets(writer, request, user.ID, campaignID, sheetID)
	case len(segments) == 2 && segments[1] == "initiative-share":
		srv.handleInitiativeShare(writer, request, campaignID)
	case len(segments) == 2 && segments[1] == "survey-link":
		srv.surveys.handleCreateLink(writer, request, campaignID)
	case len(segments) == 2 && segments[1] == "survey-responses":
		srv.surveys.handleResponses(writer, request, campaignID)
	case len(segments) == 3 && segments[1] == "survey-responses":
		srv.surveys.handleDeleteResponse(writer, request, campaignID, segments[2])
	case len(segments) == 3 && segments[1] == "initiative-share" && segments[2] == "publish":
		srv.handleInitiativeSharePublish(writer, request, campaignID)
	case len(segments) == 2 && segments[1] == "player-display":
		srv.handlePlayerDisplay(writer, request, campaignID)
	case len(segments) == 3 && segments[1] == "player-display" && segments[2] == "rotate":
		srv.handlePlayerDisplayRotate(writer, request, campaignID)
	case len(segments) == 2 && segments[1] == "events":
		switch request.Method {
		case http.MethodPost:
			var input createWorldEventInput
			if err := readJSON(request, &input); err != nil {
				writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
				return
			}

			result, err := srv.store.createWorldEvent(campaignID, input)
			if err != nil {
				status := http.StatusInternalServerError
				if strings.Contains(err.Error(), "not found") {
					status = http.StatusNotFound
				}
				writeError(writer, status, "create_event_failed", err.Error())
				return
			}

			writeJSON(writer, http.StatusCreated, result)
		default:
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		}
	case len(segments) == 3 && segments[1] == "events" && segments[2] == "generate":
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}

		var input generateWorldEventInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}

		result, err := srv.generator.GenerateWorldEvent(campaign, input)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, "generate_event_failed", err.Error())
			return
		}

		writeJSON(writer, http.StatusOK, result)
	case len(segments) == 3 && segments[1] == "events":
		eventID := segments[2]
		switch request.Method {
		case http.MethodPatch, http.MethodPut:
			var input createWorldEventInput
			if err := readJSON(request, &input); err != nil {
				writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
				return
			}

			result, err := srv.store.updateWorldEvent(campaignID, eventID, input)
			if err != nil {
				status := http.StatusInternalServerError
				if strings.Contains(err.Error(), "not found") {
					status = http.StatusNotFound
				}
				writeError(writer, status, "update_event_failed", err.Error())
				return
			}

			writeJSON(writer, http.StatusOK, result)
		case http.MethodDelete:
			result, err := srv.store.deleteWorldEvent(campaignID, eventID)
			if err != nil {
				status := http.StatusInternalServerError
				if strings.Contains(err.Error(), "not found") {
					status = http.StatusNotFound
				}
				writeError(writer, status, "delete_event_failed", err.Error())
				return
			}

			writeJSON(writer, http.StatusOK, result)
		default:
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only PUT, PATCH and DELETE are supported")
		}
	case len(segments) == 2 && segments[1] == "combat":
		srv.handleCombatState(writer, request, campaignID)
	case len(segments) == 4 && segments[1] == "bestiary" && segments[3] == "import":
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}

		detail, err := srv.bestiary.getMonster(segments[2])
		if err != nil {
			writeError(writer, http.StatusNotFound, "not_found", err.Error())
			return
		}

		result, err := srv.store.createEntity(campaignID, bestiaryDetailToCreateInput(detail))
		if err != nil {
			status := http.StatusInternalServerError
			if strings.Contains(err.Error(), "not found") {
				status = http.StatusNotFound
			}
			writeError(writer, status, "import_bestiary_failed", err.Error())
			return
		}

		writeJSON(writer, http.StatusCreated, result)
	case len(segments) == 2 && segments[1] == "search":
		if request.Method != http.MethodGet {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
			return
		}

		results, err := srv.store.search(campaignID, request.URL.Query().Get("q"))
		if err != nil {
			writeError(writer, http.StatusNotFound, "not_found", err.Error())
			return
		}

		writeJSON(writer, http.StatusOK, results)
	case len(segments) == 2 && segments[1] == "uploads":
		srv.handleCampaignUpload(writer, request, user.ID, campaignID)
	case len(segments) == 3 && segments[1] == "ai" && segments[2] == "proposals":
		srv.handleCampaignProposalCollection(writer, request, user, campaignID)
	case len(segments) == 4 && segments[1] == "ai" && segments[2] == "proposals" && segments[3] == "entities":
		srv.handleCampaignEntityProposal(writer, request, user, campaignID)
	case len(segments) == 4 && segments[1] == "ai" && segments[2] == "proposals" && segments[3] == "events":
		srv.handleCampaignEventProposal(writer, request, user, campaignID)
	case len(segments) == 2 && segments[1] == "entities":
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}

		var input createEntityInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}

		result, err := srv.store.createEntity(campaignID, input)
		if err != nil {
			status := http.StatusInternalServerError
			if strings.Contains(err.Error(), "not found") {
				status = http.StatusNotFound
			} else if strings.Contains(err.Error(), "unsupported") {
				status = http.StatusBadRequest
			}
			writeError(writer, status, "create_entity_failed", err.Error())
			return
		}

		writeJSON(writer, http.StatusCreated, result)
	case len(segments) == 3 && segments[1] == "entities":
		entityID := segments[2]
		switch request.Method {
		case http.MethodPut, http.MethodPatch:
			var input createEntityInput
			if err := readJSON(request, &input); err != nil {
				writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
				return
			}

			result, err := srv.store.updateEntity(campaignID, entityID, input)
			if err != nil {
				status := http.StatusInternalServerError
				if strings.Contains(err.Error(), "not found") {
					status = http.StatusNotFound
				} else if strings.Contains(err.Error(), "unsupported") || strings.Contains(err.Error(), "mismatch") {
					status = http.StatusBadRequest
				}
				writeError(writer, status, "update_entity_failed", err.Error())
				return
			}

			writeJSON(writer, http.StatusOK, result)
		case http.MethodDelete:
			result, err := srv.store.deleteEntity(campaignID, entityID)
			if err != nil {
				status := http.StatusInternalServerError
				if strings.Contains(err.Error(), "not found") {
					status = http.StatusNotFound
				}
				writeError(writer, status, "delete_entity_failed", err.Error())
				return
			}

			writeJSON(writer, http.StatusOK, result)
		default:
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only PUT, PATCH and DELETE are supported")
		}
	case len(segments) == 3 && segments[1] == "ai" && segments[2] == "drafts":
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}

		var input generateEntityDraftInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}

		result, err := srv.generator.Generate(campaign, input)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, "generate_draft_failed", err.Error())
			return
		}

		writeJSON(writer, http.StatusOK, result)
	case len(segments) == 4 && segments[1] == "ai" && segments[2] == "player-facing" && segments[3] == "format":
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
			return
		}

		var input formatPlayerFacingCardInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		if input.Mode != "" && input.Mode != "format" && input.Mode != "generate" && input.Mode != "format_markdown" {
			writeError(writer, http.StatusBadRequest, "invalid_mode", "Unknown formatting mode")
			return
		}
		if input.Mode == "format_markdown" && (strings.TrimSpace(input.Content) == "" || len([]rune(input.Content)) > 60000) {
			writeError(writer, http.StatusBadRequest, "invalid_content", "Formatting requires 1-60000 characters")
			return
		}

		result, err := srv.generator.FormatPlayerFacingCard(campaign, input)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, "format_player_facing_failed", err.Error())
			return
		}

		writeJSON(writer, http.StatusOK, result)
	case len(segments) == 3 && segments[1] == "combat" && segments[2] == "entries":
		srv.handleCombatEntries(writer, request, campaignID)
	case len(segments) == 4 && segments[1] == "combat" && segments[2] == "entries":
		srv.handleCombatEntry(writer, request, campaignID, segments[3])
	case len(segments) == 3 && segments[1] == "combat" && segments[2] == "finish":
		srv.handleCombatFinish(writer, request, campaignID)
	case len(segments) == 3 && segments[1] == "combat" && segments[2] == "generate":
		srv.handleCombatGenerate(writer, request, campaignID)
	default:
		writeError(writer, http.StatusNotFound, "not_found", fmt.Sprintf("Unknown API path: %s", request.URL.Path))
	}
}

func (srv *server) handleBestiary(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	writeJSON(writer, http.StatusOK, srv.bestiary.browse(bestiaryQuery{
		Query:     request.URL.Query().Get("q"),
		Challenge: request.URL.Query().Get("challenge"),
		Type:      request.URL.Query().Get("type"),
		NamedNPC:  request.URL.Query().Get("namedNpc") == "true",
		Classic:   request.URL.Query().Get("classic") == "true",
	}))
}

func (srv *server) handleBestiaryByPath(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	id := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/bestiary/"), "/")
	if id == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Bestiary monster not found")
		return
	}

	detail, err := srv.bestiary.getMonster(id)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, detail)
}

func (srv *server) handleItemCatalog(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	writeJSON(writer, http.StatusOK, srv.items.browse(itemCatalogQuery{
		Query:     request.URL.Query().Get("q"),
		Source:    request.URL.Query().Get("source"),
		Category:  request.URL.Query().Get("category"),
		ArmorType: request.URL.Query().Get("armorType"),
	}))
}

func (srv *server) handleItemCatalogByPath(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	id := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/items-catalog/"), "/")
	if id == "" {
		writeError(writer, http.StatusNotFound, "not_found", "Item not found")
		return
	}

	detail, err := srv.items.getItem(id)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, detail)
}

func bestiaryDetailToCreateInput(detail bestiaryMonsterDetail) createEntityInput {
	entity := detail.Monster
	art := entity.Art
	if art == nil && strings.TrimSpace(detail.Summary.ImageURL) != "" {
		art = &heroArt{
			URL: detail.Summary.ImageURL,
			Alt: firstNonEmpty(entity.Title, detail.Summary.Title),
		}
	}
	return createEntityInput{
		Kind:          "monster",
		Title:         entity.Title,
		Subtitle:      entity.Subtitle,
		Summary:       entity.Summary,
		Content:       entity.Content,
		Tags:          entity.Tags,
		QuickFacts:    entity.QuickFacts,
		Related:       entity.Related,
		Art:           art,
		Role:          entity.Role,
		Status:        entity.Status,
		Importance:    entity.Importance,
		StatBlock:     entity.StatBlock,
		RewardProfile: entity.RewardProfile,
	}
}

func readJSON(request *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(request.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeJSON(writer http.ResponseWriter, status int, data any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(envelope{Data: data, Meta: map[string]any{}})
}

func writeError(writer http.ResponseWriter, status int, code string, message string) {
	if strings.Contains(message, errReadyCampaignReadOnly.Error()) {
		status, code, message = http.StatusForbidden, "ready_campaign_read_only", errReadyCampaignReadOnly.Error()
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(envelope{
		Data: nil,
		Error: &errorBody{
			Code:    code,
			Message: message,
		},
		Meta: map[string]any{},
	})
}
