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
	prompt := strings.TrimSpace(input.Prompt)
	if prompt == "" {
		writeError(writer, http.StatusBadRequest, "missing_prompt", "Укажи, что нужно подготовить через AI.")
		return
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

func writeCodexBridgeError(writer http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	code := "codex_bridge_failed"
	if errors.Is(err, context.DeadlineExceeded) {
		status = http.StatusGatewayTimeout
		code = "codex_bridge_timeout"
	}
	writeError(writer, status, code, safeCodexBridgeError(err))
}
