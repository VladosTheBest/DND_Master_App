package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type Options struct {
	DataFile          string
	BestiaryCacheFile string
	WebDir            string
	AI                AIOptions
	Auth              AuthOptions
	PublicBaseURL     string
}

type server struct {
	store     *campaignStore
	bestiary  *bestiaryCatalog
	generator entityGenerator
	shares    *initiativeShareManager
	auth      *authManager
	web       http.Handler
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
	store, err := newCampaignStore(options.DataFile)
	if err != nil {
		return nil, err
	}

	bestiary, err := newBestiaryCatalog(options.BestiaryCacheFile)
	if err != nil {
		return nil, err
	}

	webHandler, err := newWebAppHandler(options.WebDir)
	if err != nil {
		return nil, err
	}

	srv := &server{
		store:     store,
		bestiary:  bestiary,
		generator: newEntityGenerator(options.AI),
		shares:    newInitiativeShareManager(store, options.PublicBaseURL),
		auth:      newAuthManager(options.Auth),
		web:       webHandler,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", srv.handleHealth)
	mux.HandleFunc("/initiative/", srv.shares.handlePublicInitiativePage)
	mux.HandleFunc("/api/initiative-meta/", srv.shares.handlePublicInitiativeMeta)
	mux.HandleFunc("/api/initiative/", srv.shares.handlePublicInitiativeAPI)
	mux.HandleFunc("/api/auth/session", srv.auth.handleSession)
	mux.HandleFunc("/api/auth/login", srv.auth.handleLogin)
	mux.HandleFunc("/api/auth/logout", srv.auth.handleLogout)
	mux.HandleFunc("/api/campaigns", srv.handleCampaigns)
	mux.HandleFunc("/api/campaigns/", srv.handleCampaignByPath)
	mux.HandleFunc("/api/bestiary", srv.handleBestiary)
	mux.HandleFunc("/api/bestiary/", srv.handleBestiaryByPath)

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		applyCORSHeaders(writer, request)
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		if srv.auth.shouldProtect(request.URL.Path) {
			if _, ok := srv.auth.currentUser(request); !ok {
				writeError(writer, http.StatusUnauthorized, "auth_required", "Нужен вход в кабинет мастера.")
				return
			}
		}
		switch {
		case isServerManagedPath(request.URL.Path):
			mux.ServeHTTP(writer, request)
		case srv.web != nil:
			srv.web.ServeHTTP(writer, request)
		default:
			http.NotFound(writer, request)
		}
	}), nil
}

func isServerManagedPath(path string) bool {
	return path == "/healthz" || strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/initiative/")
}

func (srv *server) handleHealth(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}

func (srv *server) handleCampaigns(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		writeJSON(writer, http.StatusOK, srv.store.listCampaigns())
	case http.MethodPost:
		var input createCampaignInput
		if err := readJSON(request, &input); err != nil {
			writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
			return
		}

		campaign, err := srv.store.createCampaign(input)
		if err != nil {
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

	if len(segments) == 1 {
		switch request.Method {
		case http.MethodGet:
			campaign, err := srv.store.getCampaign(campaignID)
			if err != nil {
				writeError(writer, http.StatusNotFound, "not_found", err.Error())
				return
			}

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
	case len(segments) == 2 && segments[1] == "initiative-share":
		srv.handleInitiativeShare(writer, request, campaignID)
	case len(segments) == 3 && segments[1] == "initiative-share" && segments[2] == "publish":
		srv.handleInitiativeSharePublish(writer, request, campaignID)
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

		campaign, err := srv.store.getCampaign(campaignID)
		if err != nil {
			writeError(writer, http.StatusNotFound, "not_found", err.Error())
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

		campaign, err := srv.store.getCampaign(campaignID)
		if err != nil {
			writeError(writer, http.StatusNotFound, "not_found", err.Error())
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
