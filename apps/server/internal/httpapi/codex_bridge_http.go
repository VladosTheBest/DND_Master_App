package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

func (srv *server) handleCodexStatus(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}
	writeJSON(writer, http.StatusOK, srv.codex.status(request.Context(), user))
}

func (srv *server) handleCodexConnect(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}
	result, err := srv.codex.startDeviceCode(request.Context(), user)
	if err != nil {
		writeCodexBridgeError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleCodexDisconnect(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}
	status, err := srv.codex.logout(request.Context(), user)
	if err != nil {
		writeCodexBridgeError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, status)
}

func (srv *server) handleCodexPrompt(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	user, ok := srv.requireAuthUser(writer, request)
	if !ok {
		return
	}
	var input codexPromptInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	input.CampaignID = strings.TrimSpace(input.CampaignID)
	if err := srv.validateCodexImageTarget(user.ID, &input); err != nil {
		writeProposalHTTPError(writer, err)
		return
	}
	prompt := strings.TrimSpace(input.Prompt)
	if prompt == "" {
		if input.ImageTarget == nil {
			writeError(writer, http.StatusBadRequest, "missing_prompt", "Укажи, что нужно подготовить через AI.")
			return
		}
		prompt = "Сгенерируй новое изображение автоматически по полному контексту выбранной карточки."
	}
	if len([]rune(prompt)) > 12000 {
		writeError(writer, http.StatusBadRequest, "prompt_too_long", "AI-запрос слишком длинный.")
		return
	}
	input.Prompt = prompt
	result, err := srv.codex.runPrompt(request.Context(), user, input)
	if err != nil {
		writeCodexBridgeError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) validateCodexImageTarget(ownerID string, input *codexPromptInput) error {
	if input == nil || input.ImageTarget == nil {
		return nil
	}
	if strings.TrimSpace(input.CampaignID) == "" {
		return proposalFailure(http.StatusBadRequest, "image_target_requires_campaign", "Для генерации изображения нужно выбрать кампанию.")
	}
	if !input.IncludeImages {
		return proposalFailure(http.StatusBadRequest, "image_target_requires_images", "Для выбранной карточки нужно разрешить генерацию изображений.")
	}
	target := input.ImageTarget
	target.EntityID = strings.TrimSpace(target.EntityID)
	target.EntityKind = strings.ToLower(strings.TrimSpace(target.EntityKind))
	if target.EntityID == "" || target.EntityKind == "" {
		return proposalFailure(http.StatusBadRequest, "invalid_image_target", "imageTarget должен содержать entityId и entityKind.")
	}
	if _, ok := supportedProposalEntityKinds[target.EntityKind]; !ok {
		return proposalFailure(http.StatusBadRequest, "unsupported_image_target_kind", "Изображение можно подготовить только для локации, персонажа, NPC, монстра, квеста или лора.")
	}
	if srv == nil || srv.store == nil {
		return proposalFailure(http.StatusServiceUnavailable, "image_target_unavailable", "Хранилище кампании недоступно.")
	}
	campaign, err := srv.store.getCampaignForUser(ownerID, input.CampaignID)
	if err != nil {
		return proposalFailure(http.StatusNotFound, "image_target_not_found", "Кампания или карточка не найдена.")
	}
	_, _, entity := findEntityInCampaign(&campaign, target.EntityID)
	if entity.ID == "" {
		return proposalFailure(http.StatusNotFound, "image_target_not_found", "Карточка для генерации изображения не найдена в выбранной кампании.")
	}
	if entity.Kind != target.EntityKind {
		return proposalFailure(http.StatusBadRequest, "image_target_kind_mismatch", "Тип выбранной карточки не совпадает с entityKind.")
	}
	return nil
}

func writeCodexBridgeError(writer http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	code := "codex_bridge_failed"
	var publicFailure *codexPromptPublicError
	if errors.As(err, &publicFailure) {
		writeError(writer, status, publicFailure.code, publicFailure.message)
		return
	}
	if errors.Is(err, context.DeadlineExceeded) {
		status = http.StatusGatewayTimeout
		code = "codex_bridge_timeout"
	}
	writeError(writer, status, code, safeCodexBridgeError(err))
}
