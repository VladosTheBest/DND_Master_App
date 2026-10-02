package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGMEventUsesAIRequestAndTagsModelResult(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/chat/completions" || r.Header.Get("Content-Type") != "application/json" {
			t.Error("incorrect AI HTTP request")
		}
		var request openAIChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		if len(request.Messages) != 2 || !strings.Contains(request.Messages[0].Content, "GM-only") || !strings.Contains(request.Messages[1].Content, "heist") || !strings.Contains(request.Messages[1].Content, "Missing letter") {
			t.Errorf("wrong model instructions: %#v", request.Messages)
		}
		content, _ := json.Marshal(createWorldEventInput{Title: "Letter", Type: "social", Summary: "Dispute", SceneText: "Private motive", Loot: []string{"If helped: a clue"}, DialogueBranches: []worldEventDialogueBranch{{Title: "Talk", Lines: []string{"Ask about the letter"}, Outcome: "A clue"}}})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(content)}}}})
	}))
	defer upstream.Close()
	store, _, user, campaign := newProposalTestService(t)
	srv := server{store: store, generator: openAIGenerator{config: generatorConfig{baseURL: upstream.URL, model: "test-model"}, client: upstream.Client()}}
	input := eventProposalInput{Mode: "create", GenerationMode: "gm_event", Type: "heist", Prompt: "Missing letter"}
	if err := srv.prepareGeneratedEventProposal(user.ID, campaign.ID, &input); err != nil {
		t.Fatal(err)
	}
	var candidate createWorldEventInput
	if err := json.Unmarshal(input.Candidate, &candidate); err != nil {
		t.Fatal(err)
	}
	if candidate.Type != "heist" || candidate.SceneText != "Private motive" || len(candidate.Loot) != 1 || !strings.Contains(strings.Join(candidate.Tags, ","), "gm-event") {
		t.Fatalf("model result not preserved/enforced: %#v", candidate)
	}
}

func TestRandomGMEventProposalPreservesBriefOnApply(t *testing.T) {
	store, service, user, campaign := newProposalTestService(t)
	location, err := store.createEntity(campaign.ID, createEntityInput{Kind: "location", Title: "Harbour", Content: "Port"})
	if err != nil {
		t.Fatal(err)
	}
	srv := server{store: store, generator: scaffoldGenerator{}}
	input := eventProposalInput{Mode: "create", GenerationMode: "gm_event", LocationID: location.Entity.ID, Type: "danger", Prompt: "Описание мастера: A boat without lights\nUse a concise brief"}
	if err := srv.prepareGeneratedEventProposal(user.ID, campaign.ID, &input); err != nil {
		t.Fatal(err)
	}
	var candidate createWorldEventInput
	if err := json.Unmarshal(input.Candidate, &candidate); err != nil {
		t.Fatal(err)
	}
	if candidate.LocationID != location.Entity.ID || candidate.Type != "danger" || !strings.Contains(candidate.SceneText, "A boat without lights") || !strings.Contains(candidate.SceneText, "Скрытая причина") || len(candidate.Loot) < 2 || len(candidate.DialogueBranches) < 2 {
		t.Fatalf("incomplete GM event: %#v", candidate)
	}
	p, err := service.createEvent(user.ID, campaign.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.apply(user.ID, p.ID, proposalApplyInput{})
	if err != nil {
		t.Fatal(err)
	}
	if result.Event == nil || result.Event.SceneText != candidate.SceneText || !strings.Contains(strings.Join(result.Event.Tags, ","), "gm-event") {
		t.Fatalf("GM brief lost on apply: %#v", result.Event)
	}
	input.GenerationMode = "unknown"
	input.Candidate = nil
	if err := srv.prepareGeneratedEventProposal(user.ID, campaign.ID, &input); proposalErrorCode(t, err) != "invalid_generation_mode" {
		t.Fatalf("invalid mode accepted: %v", err)
	}
}

func TestRandomGMEventAIContractAndReadAloudCompatibility(t *testing.T) {
	input := generateWorldEventInput{GenerationMode: "gm_event", Type: "heist", LocationID: "port", Prompt: "Short idea"}
	system := worldEventSystemPrompt(input)
	for _, required := range []string{"GM-only", "150-250", "conditional", "acquisition conditions", "gm-event", "Never gate"} {
		if !strings.Contains(system, required) {
			t.Fatalf("missing instruction %s", required)
		}
	}
	user := buildOpenAIWorldEventUserPrompt(campaignData{}, input)
	if !strings.Contains(user, "heist") || !strings.Contains(user, "port") || strings.Contains(user, "player-facing card") {
		t.Fatal("wrong AI request mode")
	}
	readAloud := generateWorldEventInput{Prompt: "A traveller"}
	draft := buildWorldEventDraft(campaignData{}, readAloud)
	if worldEventSystemPrompt(readAloud) != buildOpenAIWorldEventSystemPrompt() || len(draft.Loot) != 0 || len(draft.DialogueBranches) != 0 {
		t.Fatal("existing read-aloud mode changed")
	}
	emptyIdea := buildWorldEventDraft(campaignData{}, generateWorldEventInput{GenerationMode: "gm_event", Type: "funny", Prompt: "Описание мастера: Придумай неожиданную ситуацию самостоятельно.\nDo not repeat instructions"})
	if !strings.Contains(emptyIdea.SceneText, "козёл") || strings.Contains(emptyIdea.SceneText, "Do not repeat") {
		t.Fatal("empty idea did not use a type-specific fallback")
	}
}
