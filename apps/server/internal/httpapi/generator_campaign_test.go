package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOpenAIGeneratorCampaignBlueprintUsesBoundedStructuredSchema(t *testing.T) {
	responseBlueprint := campaignProposalBlueprint{
		Campaign: createCampaignInput{Title: "Sunken Roads", System: "D&D 5e", SettingName: "The Drowned March", InWorldDate: "1 Hammer", Summary: "Roads surface when the black tide falls."},
		Entities: []campaignBlueprintEntity{
			{TempKey: "drowned-port", createEntityInput: createEntityInput{Kind: "location", Title: "Drowned Port", Summary: "A half-submerged harbor.", Content: "A half-submerged harbor.", Tags: []string{"harbor"}, Category: "City", Danger: "Dangerous"}},
			{TempKey: "guide", createEntityInput: createEntityInput{Kind: "npc", Title: "Mara", Summary: "A tide guide.", Content: "A tide guide.", PlayerContent: "Mara knows the safe road.", Tags: []string{"guide"}, Related: []relatedEntity{{ID: "drowned-port", Kind: "location", Label: "Drowned Port", Reason: "Home"}}, LocationID: "drowned-port"}},
			{TempKey: "first-road", createEntityInput: createEntityInput{Kind: "quest", Title: "The First Road", Summary: "Map the road.", Content: "Map the road before the tide.", PlayerContent: "Mara needs a road mapped.", Tags: []string{"opening"}, LocationID: "drowned-port", IssuerID: "guide"}},
		},
		Events: []campaignBlueprintEvent{{TempKey: "low-tide", createWorldEventInput: createWorldEventInput{Title: "Low Tide", Date: "1 Hammer", Summary: "The road appears.", Type: "oddity", LocationID: "drowned-port", LocationLabel: "Drowned Port", SceneText: "Black water slides away from an ancient road.", Tags: []string{"opening"}, Origin: "ai"}}},
	}
	responseJSON, err := json.Marshal(responseBlueprint)
	if err != nil {
		t.Fatalf("marshal response blueprint: %v", err)
	}
	var captured openAIChatCompletionRequest
	api := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if err := json.NewDecoder(request.Body).Decode(&captured); err != nil {
			http.Error(writer, err.Error(), http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(writer).Encode(map[string]any{
			"choices": []any{map[string]any{"message": map[string]any{"content": string(responseJSON)}}},
		})
	}))
	defer api.Close()

	generator := openAIGenerator{
		config: generatorConfig{activeProvider: "openai", model: "test-model", baseURL: api.URL},
		client: api.Client(),
	}
	result, err := generator.GenerateCampaignBlueprint(generateCampaignBlueprintInput{Prompt: "A campaign about drowned roads"})
	if err != nil {
		t.Fatalf("GenerateCampaignBlueprint() error = %v", err)
	}
	if captured.ResponseFormat.Type != "json_schema" || !captured.ResponseFormat.JSONSchema.Strict || captured.ResponseFormat.JSONSchema.Name != "shadow_edge_campaign_blueprint" {
		t.Fatalf("unexpected response schema request: %#v", captured.ResponseFormat)
	}
	properties, _ := captured.ResponseFormat.JSONSchema.Schema["properties"].(map[string]any)
	entities, _ := properties["entities"].(map[string]any)
	events, _ := properties["events"].(map[string]any)
	if entities["maxItems"] != float64(12) || events["maxItems"] != float64(8) {
		t.Fatalf("campaign schema is not bounded: entities=%#v events=%#v", entities, events)
	}
	if result.Provider != "openai" || len(result.Blueprint.Entities) != 3 || len(result.Blueprint.Events) != 1 {
		t.Fatalf("unexpected generated result: %#v", result)
	}
	if result.Blueprint.Entities[1].LocationID != "drowned-port" || result.Blueprint.Entities[2].IssuerID != "guide" {
		t.Fatalf("generated temp references were not preserved: %#v", result.Blueprint)
	}
}

func TestOpenAICampaignBlueprintRequiresAPIKeyForOfficialEndpoint(t *testing.T) {
	generator := openAIGenerator{config: generatorConfig{activeProvider: "openai", model: "test-model", baseURL: "https://api.openai.com/v1"}, client: http.DefaultClient}
	_, err := generator.GenerateCampaignBlueprint(generateCampaignBlueprintInput{Prompt: "A campaign"})
	if err == nil || !strings.Contains(err.Error(), "API key is not configured") {
		t.Fatalf("expected missing API key error, got %v", err)
	}
}
