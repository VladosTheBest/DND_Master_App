package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

// Adapt the existing validated JSON workflows to an isolated Codex text turn.
// No MCP write tools, image tools, shell or automatic paid API fallback are enabled.
type codexTextTransport struct {
	manager *codexBridgeManager
	user    authUser
}

func (t codexTextTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if t.manager == nil {
		return nil, errors.New("Подключите ChatGPT в настройках AI.")
	}
	var input openAIChatCompletionRequest
	if json.NewDecoder(io.LimitReader(request.Body, 4<<20)).Decode(&input) != nil {
		return nil, errors.New("Не удалось подготовить запрос AI.")
	}
	_ = request.Body.Close()
	system, prompt := "", ""
	for _, m := range input.Messages {
		if m.Role == "system" {
			system += "\n" + m.Content
		} else {
			prompt += "\n" + m.Content
		}
	}
	ctx, cancel := context.WithTimeout(request.Context(), 90*time.Second)
	defer cancel()
	status := t.manager.status(ctx, t.user)
	if status.State != "connected" || status.AuthMode != "chatgpt" {
		return nil, errors.New("Сначала подключите свой ChatGPT в настройках AI. Платный API автоматически не включён.")
	}
	result, err := t.manager.runPromptOnce(ctx, t.user, codexPromptInput{Prompt: system + "\nEvidence and user request:\n" + prompt, TextSchema: input.ResponseFormat.JSONSchema.Schema})
	if err != nil {
		return nil, err
	}
	content := strings.TrimSpace(result.Message)
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(content, "```json"), "```"))
	}
	if !json.Valid([]byte(content)) {
		return nil, errors.New("AI вернул неполный ответ. Результат не применён; попробуйте сократить запрос.")
	}
	payload, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": content}}}})
	return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(bytes.NewReader(payload)), ContentLength: int64(len(payload)), Request: request}, nil
}
func (srv *server) usesCodexAI(owner string) bool {
	c, _ := srv.personalAI(owner)
	return c.Mode == "codex"
}
