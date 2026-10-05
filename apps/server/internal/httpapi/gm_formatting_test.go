package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestGMFormattingUsesMarkdownAndPreservesSource(t *testing.T) {
	source := "Secret: [[Mira]] hides 17 gp. Investigation DC 14. Failure: alarm."
	formatted := "## Secret\n\n**[[Mira]]** hides 17 gp.\n\n| Check | Failure |\n| --- | --- |\n| Investigation DC 14 | alarm |"
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
			t.Error("invalid upstream request")
		}
		var request openAIChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if len(request.Messages) != 2 || !strings.Contains(request.Messages[0].Content, "Preserve ALL facts, secrets") || !strings.Contains(request.Messages[0].Content, "Markdown tables") || !strings.Contains(request.Messages[1].Content, source) {
			t.Errorf("formatter did not receive preservation contract and source: %+v", request.Messages)
		}
		if strings.Contains(request.Messages[1].Content, "UNRELATED_CAMPAIGN_SECRET") {
			t.Error("formatter should not send unrelated campaign context")
		}
		payload, _ := json.Marshal(playerFacingCard{Title: "Notes", Content: formatted})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(payload)}}}})
	}))
	defer upstream.Close()
	generator := openAIGenerator{config: generatorConfig{baseURL: upstream.URL, model: "test"}, client: upstream.Client()}
	result, err := generator.FormatPlayerFacingCard(campaignData{Title: "UNRELATED_CAMPAIGN_SECRET"}, formatPlayerFacingCardInput{Mode: "format_markdown", Title: "Notes", Content: source})
	if err != nil {
		t.Fatal(err)
	}
	if result.Card.Content != formatted {
		t.Fatalf("markdown changed: %q", result.Card.Content)
	}
}

func TestGenerationPromptsIncludeStructuredFormatting(t *testing.T) {
	for name, prompt := range map[string]string{
		"entity": buildOpenAISystemPrompt(), "patch": buildOpenAIEntityPatchSystemPrompt(),
		"event": worldEventSystemPrompt(generateWorldEventInput{GenerationMode: "gm_event"}), "codex": codexBridgeInstructions,
	} {
		if !strings.Contains(prompt, gmMarkdownInstructions) {
			t.Errorf("%s missing formatting contract", name)
		}
	}
}

func TestMarkdownFormattingHTTPAndPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	handler, err := NewServer(Options{DataFile: path, UploadDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, route string, input any, cookie *http.Cookie) *httptest.ResponseRecorder {
		body, _ := json.Marshal(input)
		r := httptest.NewRequest(method, "http://localhost"+route, strings.NewReader(string(body)))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	login := call("POST", "/api/auth/register", map[string]string{"username": "format-test", "password": "password123"}, nil)
	if login.Code != 200 {
		t.Fatal(login.Body.String())
	}
	cookie := login.Result().Cookies()[0]
	created := call("POST", "/api/campaigns", map[string]string{"title": "Format campaign"}, cookie)
	var envelope struct {
		Data campaignData `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &envelope); err != nil || envelope.Data.ID == "" {
		t.Fatal(created.Body.String())
	}
	base := "/api/campaigns/" + envelope.Data.ID
	text := "## Clues\n\n| Check | Result |\n| --- | --- |\n| **DC 14** | <u>Secret</u> |"
	formatted := call("POST", base+"/ai/player-facing/format", formatPlayerFacingCardInput{Mode: "format_markdown", Content: text}, cookie)
	if formatted.Code != 200 {
		t.Fatal(formatted.Body.String())
	}
	for _, mode := range []formatPlayerFacingCardInput{{Mode: "bad", Content: text}, {Mode: "format_markdown"}} {
		if result := call("POST", base+"/ai/player-facing/format", mode, cookie); result.Code != 400 {
			t.Fatalf("invalid input accepted: %d", result.Code)
		}
	}
	if result := call("POST", base+"/ai/player-facing/format", formatPlayerFacingCardInput{Mode: "format_markdown", Content: text}, nil); result.Code != 401 {
		t.Fatalf("anonymous format: %d", result.Code)
	}
	for route, input := range map[string]any{
		"/entities": createEntityInput{Kind: "lore", Title: "Clues", Content: text, Visibility: "gm_only"},
		"/events":   createWorldEventInput{Title: "Scene", Type: "heist", Summary: "Clues", SceneText: text},
	} {
		result := call("POST", base+route, input, cookie)
		if result.Code != 201 {
			t.Fatalf("save %s: %d %s", route, result.Code, result.Body.String())
		}
	}
	loaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	campaign, err := loaded.getCampaign(envelope.Data.ID)
	if err != nil || len(campaign.Lore) != 1 || campaign.Lore[0].Content != text || len(campaign.Events) != 1 || campaign.Events[0].SceneText != text {
		t.Fatal("Markdown did not survive storage reload")
	}
}
