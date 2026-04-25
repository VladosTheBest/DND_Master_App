package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type openAIGenerator struct {
	config generatorConfig
	client *http.Client
}

type openAIChatCompletionRequest struct {
	Model          string               `json:"model"`
	Messages       []openAIChatMessage  `json:"messages"`
	ResponseFormat openAIResponseFormat `json:"response_format"`
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponseFormat struct {
	Type       string                 `json:"type"`
	JSONSchema openAIJSONSchemaConfig `json:"json_schema"`
}

type openAIJSONSchemaConfig struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

type openAIChatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content json.RawMessage `json:"content"`
			Refusal string          `json:"refusal,omitempty"`
		} `json:"message"`
	} `json:"choices"`
}

type openAIErrorResponse struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

type openAIEncounterDraftPayload struct {
	Items []openAIEncounterDraftItem `json:"items"`
}

type openAIEncounterDraftItem struct {
	Quantity int               `json:"quantity"`
	Entity   createEntityInput `json:"entity"`
}

type openAIPlayerFacingCardPayload struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentHTML string `json:"contentHtml"`
}

var encounterNumberSuffixPattern = regexp.MustCompile(`(?i)\s*(?:#\d+|\(\d+\)|\d+)$`)

func newOpenAIGenerator(config generatorConfig) entityGenerator {
	if strings.TrimSpace(config.model) == "" {
		config.model = "gpt-5.4-mini"
	}
	if strings.TrimSpace(config.baseURL) == "" {
		config.baseURL = "https://api.openai.com/v1"
	}
	config.activeProvider = "openai"

	return openAIGenerator{
		config: config,
		client: &http.Client{Timeout: 90 * time.Second},
	}
}

func (generator openAIGenerator) Generate(campaign campaignData, input generateEntityDraftInput) (generateEntityDraftResult, error) {
	kind := normalizeEntityKind(input.Kind)
	if kind == "" {
		kind = "location"
	}

	if requiresOpenAIKey(generator.config.baseURL) && strings.TrimSpace(generator.config.apiToken) == "" {
		return generateEntityDraftResult{}, fmt.Errorf("OpenAI API key is not configured. Set SHADOW_EDGE_AI_API_KEY or OPENAI_API_KEY in .env.local or the shell environment")
	}

	entity, err := generator.requestDraft(campaign, generateEntityDraftInput{
		Kind:    kind,
		Prompt:  strings.TrimSpace(input.Prompt),
		Current: input.Current,
	})
	if err != nil {
		return generateEntityDraftResult{}, err
	}

	result := generateEntityDraftResult{
		Provider: generator.config.activeProvider,
		Notes:    generator.buildNotes(campaign),
		Entity:   normalizeDraftEntity(kind, strings.TrimSpace(input.Prompt), campaign, entity),
	}

	if shouldGenerateQuestIssuerDraft(input, result.Entity) {
		issuerDraft, err := generator.generateQuestIssuerDraft(campaign, input, result.Entity)
		if err == nil {
			result.LinkedDrafts = []linkedEntityDraft{
				{
					Role:   "issuer",
					Note:   "Новый квестодатель будет создан вместе с квестом, если ты не выберешь существующего НПС.",
					Entity: issuerDraft,
				},
			}
			result.Notes = append(result.Notes, "Так как квестодатель не выбран, AI подготовил отдельный draft НПС для этого квеста.")
		} else {
			result.Notes = append(result.Notes, "AI не смог подготовить отдельного квестодателя автоматически, поэтому его можно выбрать или создать вручную.")
		}
	}

	return result, nil
}

func (generator openAIGenerator) GenerateWorldEvent(campaign campaignData, input generateWorldEventInput) (generateWorldEventResult, error) {
	if requiresOpenAIKey(generator.config.baseURL) && strings.TrimSpace(generator.config.apiToken) == "" {
		return generateWorldEventResult{}, fmt.Errorf("OpenAI API key is not configured. Set SHADOW_EDGE_AI_API_KEY or OPENAI_API_KEY in .env.local or the shell environment")
	}

	event, err := generator.requestWorldEvent(campaign, input)
	if err != nil {
		return generateWorldEventResult{}, err
	}

	return generateWorldEventResult{
		Provider: generator.config.activeProvider,
		Notes: append(generator.buildNotes(campaign),
			"Событие подготовлено как короткая сценка, а не как полноценный квест.",
		),
		Event: normalizeWorldEventDraftInput(campaign, input, event),
	}, nil
}

func (generator openAIGenerator) FormatPlayerFacingCard(campaign campaignData, input formatPlayerFacingCardInput) (formatPlayerFacingCardResult, error) {
	if requiresOpenAIKey(generator.config.baseURL) && strings.TrimSpace(generator.config.apiToken) == "" {
		return formatPlayerFacingCardResult{}, fmt.Errorf("OpenAI API key is not configured. Set SHADOW_EDGE_AI_API_KEY or OPENAI_API_KEY in .env.local or the shell environment")
	}

	card, err := generator.requestPlayerFacingCardFormat(campaign, input)
	if err != nil {
		return formatPlayerFacingCardResult{}, err
	}

	return formatPlayerFacingCardResult{
		Provider: generator.config.activeProvider,
		Notes: append(generator.buildNotes(campaign),
			"AI сохранил смысл текста, но оформил его как player-facing handout с безопасным HTML-фрагментом.",
		),
		Card: normalizeFormattedPlayerFacingCard(playerFacingCard{
			Title:       card.Title,
			Content:     card.Content,
			ContentHTML: card.ContentHTML,
		}),
	}, nil
}

func (generator openAIGenerator) generateQuestIssuerDraft(
	campaign campaignData,
	input generateEntityDraftInput,
	quest createEntityInput,
) (createEntityInput, error) {
	issuerDraft, err := generator.requestDraft(campaign, generateEntityDraftInput{
		Kind:   "npc",
		Prompt: buildQuestIssuerPrompt(strings.TrimSpace(input.Prompt), quest),
		Current: &createEntityInput{
			Kind:          "npc",
			LocationID:    quest.LocationID,
			PlayerContent: "",
		},
	})
	if err != nil {
		return createEntityInput{}, err
	}

	return normalizeDraftEntity("npc", buildQuestIssuerPrompt(strings.TrimSpace(input.Prompt), quest), campaign, issuerDraft), nil
}

func (generator openAIGenerator) GenerateEncounter(campaign campaignData, input generateCombatInput) (generateEncounterDraftResult, error) {
	if requiresOpenAIKey(generator.config.baseURL) && strings.TrimSpace(generator.config.apiToken) == "" {
		return generateEncounterDraftResult{}, fmt.Errorf("OpenAI API key is not configured. Set SHADOW_EDGE_AI_API_KEY or OPENAI_API_KEY in .env.local or the shell environment")
	}

	payload, err := generator.requestEncounter(campaign, input)
	if err != nil {
		return generateEncounterDraftResult{}, err
	}

	return generateEncounterDraftResult{
		Provider: generator.config.activeProvider,
		Notes: append(generator.buildNotes(campaign),
			"Encounter generation asked the model for unique monster entries with quantities instead of numbered duplicates.",
		),
		Items: normalizeEncounterDraftItems(campaign, input, payload.Items),
	}, nil
}

func (generator openAIGenerator) requestDraft(campaign campaignData, input generateEntityDraftInput) (createEntityInput, error) {
	requestBody := openAIChatCompletionRequest{
		Model: generator.config.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: buildOpenAISystemPrompt()},
			{Role: "user", Content: buildOpenAIUserPrompt(campaign, input)},
		},
		ResponseFormat: openAIResponseFormat{
			Type: "json_schema",
			JSONSchema: openAIJSONSchemaConfig{
				Name:   "shadow_edge_entity_draft",
				Strict: true,
				Schema: entityDraftSchema(),
			},
		},
	}

	payload, err := json.Marshal(requestBody)
	if err != nil {
		return createEntityInput{}, fmt.Errorf("marshal OpenAI request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	url := strings.TrimRight(generator.config.baseURL, "/") + "/chat/completions"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return createEntityInput{}, fmt.Errorf("build OpenAI request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(generator.config.apiToken); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := generator.client.Do(request)
	if err != nil {
		return createEntityInput{}, fmt.Errorf("request OpenAI draft: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return createEntityInput{}, fmt.Errorf("read OpenAI response: %w", err)
	}

	if response.StatusCode >= http.StatusBadRequest {
		var apiError openAIErrorResponse
		if err := json.Unmarshal(body, &apiError); err == nil && strings.TrimSpace(apiError.Error.Message) != "" {
			return createEntityInput{}, fmt.Errorf("OpenAI request failed (%d): %s", response.StatusCode, apiError.Error.Message)
		}
		return createEntityInput{}, fmt.Errorf("OpenAI request failed (%d)", response.StatusCode)
	}

	var completion openAIChatCompletionResponse
	if err := json.Unmarshal(body, &completion); err != nil {
		return createEntityInput{}, fmt.Errorf("decode OpenAI response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return createEntityInput{}, fmt.Errorf("OpenAI returned no choices")
	}
	if refusal := strings.TrimSpace(completion.Choices[0].Message.Refusal); refusal != "" {
		return createEntityInput{}, fmt.Errorf("OpenAI refused the draft request: %s", refusal)
	}

	content, err := extractChatCompletionContent(completion.Choices[0].Message.Content)
	if err != nil {
		return createEntityInput{}, err
	}

	var entity createEntityInput
	if err := json.Unmarshal([]byte(content), &entity); err != nil {
		return createEntityInput{}, fmt.Errorf("decode draft JSON: %w", err)
	}

	return entity, nil
}

func (generator openAIGenerator) requestWorldEvent(campaign campaignData, input generateWorldEventInput) (createWorldEventInput, error) {
	requestBody := openAIChatCompletionRequest{
		Model: generator.config.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: buildOpenAIWorldEventSystemPrompt()},
			{Role: "user", Content: buildOpenAIWorldEventUserPrompt(campaign, input)},
		},
		ResponseFormat: openAIResponseFormat{
			Type: "json_schema",
			JSONSchema: openAIJSONSchemaConfig{
				Name:   "shadow_edge_world_event",
				Strict: true,
				Schema: worldEventDraftSchema(),
			},
		},
	}

	payload, err := json.Marshal(requestBody)
	if err != nil {
		return createWorldEventInput{}, fmt.Errorf("marshal OpenAI event request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	url := strings.TrimRight(generator.config.baseURL, "/") + "/chat/completions"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return createWorldEventInput{}, fmt.Errorf("build OpenAI event request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(generator.config.apiToken); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := generator.client.Do(request)
	if err != nil {
		return createWorldEventInput{}, fmt.Errorf("request OpenAI event: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return createWorldEventInput{}, fmt.Errorf("read OpenAI event response: %w", err)
	}

	if response.StatusCode >= http.StatusBadRequest {
		var apiError openAIErrorResponse
		if err := json.Unmarshal(body, &apiError); err == nil && strings.TrimSpace(apiError.Error.Message) != "" {
			return createWorldEventInput{}, fmt.Errorf("OpenAI event request failed (%d): %s", response.StatusCode, apiError.Error.Message)
		}
		return createWorldEventInput{}, fmt.Errorf("OpenAI event request failed (%d)", response.StatusCode)
	}

	var completion openAIChatCompletionResponse
	if err := json.Unmarshal(body, &completion); err != nil {
		return createWorldEventInput{}, fmt.Errorf("decode OpenAI event response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return createWorldEventInput{}, fmt.Errorf("OpenAI returned no choices for event generation")
	}
	if refusal := strings.TrimSpace(completion.Choices[0].Message.Refusal); refusal != "" {
		return createWorldEventInput{}, fmt.Errorf("OpenAI refused the event request: %s", refusal)
	}

	content, err := extractChatCompletionContent(completion.Choices[0].Message.Content)
	if err != nil {
		return createWorldEventInput{}, err
	}

	var event createWorldEventInput
	if err := json.Unmarshal([]byte(content), &event); err != nil {
		return createWorldEventInput{}, fmt.Errorf("decode event JSON: %w", err)
	}

	return event, nil
}

func (generator openAIGenerator) requestPlayerFacingCardFormat(campaign campaignData, input formatPlayerFacingCardInput) (openAIPlayerFacingCardPayload, error) {
	requestBody := openAIChatCompletionRequest{
		Model: generator.config.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: buildOpenAIPlayerFacingFormatSystemPrompt()},
			{Role: "user", Content: buildOpenAIPlayerFacingFormatUserPrompt(campaign, input)},
		},
		ResponseFormat: openAIResponseFormat{
			Type: "json_schema",
			JSONSchema: openAIJSONSchemaConfig{
				Name:   "shadow_edge_player_facing_card_format",
				Strict: true,
				Schema: playerFacingCardFormatSchema(),
			},
		},
	}

	payload, err := json.Marshal(requestBody)
	if err != nil {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("marshal OpenAI player-facing request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	url := strings.TrimRight(generator.config.baseURL, "/") + "/chat/completions"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("build OpenAI player-facing request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(generator.config.apiToken); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := generator.client.Do(request)
	if err != nil {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("request OpenAI player-facing format: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("read OpenAI player-facing response: %w", err)
	}

	if response.StatusCode >= http.StatusBadRequest {
		var apiError openAIErrorResponse
		if err := json.Unmarshal(body, &apiError); err == nil && strings.TrimSpace(apiError.Error.Message) != "" {
			return openAIPlayerFacingCardPayload{}, fmt.Errorf("OpenAI player-facing request failed (%d): %s", response.StatusCode, apiError.Error.Message)
		}
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("OpenAI player-facing request failed (%d)", response.StatusCode)
	}

	var completion openAIChatCompletionResponse
	if err := json.Unmarshal(body, &completion); err != nil {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("decode OpenAI player-facing response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("OpenAI returned no choices for player-facing formatting")
	}
	if refusal := strings.TrimSpace(completion.Choices[0].Message.Refusal); refusal != "" {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("OpenAI refused the player-facing formatting request: %s", refusal)
	}

	content, err := extractChatCompletionContent(completion.Choices[0].Message.Content)
	if err != nil {
		return openAIPlayerFacingCardPayload{}, err
	}

	var card openAIPlayerFacingCardPayload
	if err := json.Unmarshal([]byte(content), &card); err != nil {
		return openAIPlayerFacingCardPayload{}, fmt.Errorf("decode player-facing format JSON: %w", err)
	}

	card.Title = strings.TrimSpace(firstNonEmpty(card.Title, input.Title))
	card.ContentHTML = sanitizePlayerFacingHTMLFragment(card.ContentHTML)
	card.Content = strings.TrimSpace(firstNonEmpty(card.Content, extractTextFromPlayerFacingHTML(card.ContentHTML), input.Content))
	if card.ContentHTML == "" || !strings.Contains(card.ContentHTML, "<") {
		card.ContentHTML = buildScaffoldPlayerFacingHTML(card.Title, card.Content)
	}

	return card, nil
}

func (generator openAIGenerator) requestEncounter(campaign campaignData, input generateCombatInput) (openAIEncounterDraftPayload, error) {
	requestBody := openAIChatCompletionRequest{
		Model: generator.config.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: buildOpenAIEncounterSystemPrompt()},
			{Role: "user", Content: buildOpenAIEncounterUserPrompt(campaign, input)},
		},
		ResponseFormat: openAIResponseFormat{
			Type: "json_schema",
			JSONSchema: openAIJSONSchemaConfig{
				Name:   "shadow_edge_encounter_draft",
				Strict: true,
				Schema: encounterDraftSchema(),
			},
		},
	}

	payload, err := json.Marshal(requestBody)
	if err != nil {
		return openAIEncounterDraftPayload{}, fmt.Errorf("marshal OpenAI encounter request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	url := strings.TrimRight(generator.config.baseURL, "/") + "/chat/completions"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return openAIEncounterDraftPayload{}, fmt.Errorf("build OpenAI encounter request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(generator.config.apiToken); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := generator.client.Do(request)
	if err != nil {
		return openAIEncounterDraftPayload{}, fmt.Errorf("request OpenAI encounter: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return openAIEncounterDraftPayload{}, fmt.Errorf("read OpenAI encounter response: %w", err)
	}

	if response.StatusCode >= http.StatusBadRequest {
		var apiError openAIErrorResponse
		if err := json.Unmarshal(body, &apiError); err == nil && strings.TrimSpace(apiError.Error.Message) != "" {
			return openAIEncounterDraftPayload{}, fmt.Errorf("OpenAI encounter request failed (%d): %s", response.StatusCode, apiError.Error.Message)
		}
		return openAIEncounterDraftPayload{}, fmt.Errorf("OpenAI encounter request failed (%d)", response.StatusCode)
	}

	var completion openAIChatCompletionResponse
	if err := json.Unmarshal(body, &completion); err != nil {
		return openAIEncounterDraftPayload{}, fmt.Errorf("decode OpenAI encounter response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return openAIEncounterDraftPayload{}, fmt.Errorf("OpenAI returned no choices for encounter generation")
	}
	if refusal := strings.TrimSpace(completion.Choices[0].Message.Refusal); refusal != "" {
		return openAIEncounterDraftPayload{}, fmt.Errorf("OpenAI refused the encounter request: %s", refusal)
	}

	content, err := extractChatCompletionContent(completion.Choices[0].Message.Content)
	if err != nil {
		return openAIEncounterDraftPayload{}, err
	}

	var encounter openAIEncounterDraftPayload
	if err := json.Unmarshal([]byte(content), &encounter); err != nil {
		return openAIEncounterDraftPayload{}, fmt.Errorf("decode encounter JSON: %w", err)
	}

	return encounter, nil
}

func (generator openAIGenerator) buildNotes(campaign campaignData) []string {
	notes := []string{
		"Draft generated by OpenAI using the active campaign as context.",
		"Review numbers, relations and combat balance before using the draft at the table.",
		"Model: " + generator.config.model + ".",
	}

	if title := strings.TrimSpace(campaign.Title); title != "" {
		notes = append(notes, "Campaign context: "+title+".")
	}

	if baseURL := strings.TrimSpace(generator.config.baseURL); baseURL != "" && !strings.EqualFold(strings.TrimRight(baseURL, "/"), "https://api.openai.com/v1") {
		notes = append(notes, "Custom OpenAI-compatible base URL is active on the server.")
	}

	return notes
}

func buildOpenAISystemPrompt() string {
	return strings.TrimSpace(`You generate structured entity drafts for a Game Master's D&D 5e campaign app.

Rules:
- Output only JSON matching the schema.
- Respect the current campaign canon and reuse existing places, factions, NPCs, monsters and tone where it helps.
- Prefer the dominant language used in the prompt and campaign data. If mixed or unclear, default to Russian.
- Treat the current form fields as hints from the user and complete the missing parts.
- If you reference existing entities, only use IDs that appear in the campaign context.
- Do not invent image URLs.
- For NPCs and quests, content is the GM-only full truth: secrets, hidden motives, backstage links, consequences and what is really happening.
- For NPCs and quests, playerContent is the player-facing version: what the NPC can tell the party, what rumors or job pitch the players can hear, and what remains hidden.
- For other entity kinds, playerContent may be an empty string.
- For quests, prefer a structured, scene-ready writeup instead of a vague synopsis: hook, what players notice, who speaks first, what is really happening, what the party can do, possible checks/DCs, escalation, outcomes, rewards and losses.
- For NPCs, make both GM and player-facing text concrete and detailed: voice, manner, motives, leverage, secrets, what they reveal openly and what they hide.
- For NPCs and monsters, include a usable D&D-style stat block with AC, HP, speed in feet, six ability scores, useful traits and at least one action.
- When the user asks for an existing official D&D 5e monster or humanoid archetype, prefer the official bestiary version as represented on dnd.su instead of inventing a custom creature.
- This is especially important for wolf, giant spider, bandit, scout, thug, bandit captain, veteran and gladiator style requests.
- For monsters, also include rewardProfile with loot, trophies, salvage or weapon drops and the relevant checks/DC when useful.
- rewardProfile must be concrete. If coins are involved, specify exact denominations and amounts like "17 sp and 3 gp" instead of vague phrases, wide ranges or only dice expressions.
- rewardProfile.details should explain where the loot is found, who pays it, what checks are needed, what can be lost on failure and what condition the loot is in.
- For NPCs and quests, write rich detail in both GM-only and player-facing text instead of one-line placeholders.
- Use dice notation for damage when appropriate.`)
}

func buildOpenAIUserPrompt(campaign campaignData, input generateEntityDraftInput) string {
	return strings.TrimSpace(fmt.Sprintf(`Generate one %s draft for a D&D GM app.

User request:
%s

Current form values:
%s

Campaign context:
%s

Return one complete draft object.

If this is a quest and the current form has no issuerId, keep the issuer concept clear in the text because the server may ask for a separate quest-giver NPC draft after this step.`, input.Kind, firstNonEmpty(strings.TrimSpace(input.Prompt), "Create a useful draft from the current form and campaign context."), marshalAIJSON(input.Current), marshalAIJSON(compactCampaignContext(campaign))))
}

func buildOpenAIWorldEventSystemPrompt() string {
	return strings.TrimSpace(`You generate compact world events for a D&D 5e Game Master's app.

Rules:
- Output only JSON matching the schema.
- Prefer Russian when the prompt or campaign uses Russian.
- Respect the current campaign canon, locations, factions, NPCs, monsters and tone where useful.
- This is not a quest. Keep it punchy, table-ready and small enough to drop into play immediately.
- summary should explain in one or two sentences why the scene matters.
- sceneText should describe what is happening right now and why the party is drawn in.
- dialogueBranches should feel playable: each branch needs a title, a few spoken lines and a short outcome.
- loot must stay short, concrete and specific. Coins should use exact counts and denominations.
- Do not invent image URLs.`)
}

func buildOpenAIWorldEventUserPrompt(campaign campaignData, input generateWorldEventInput) string {
	return strings.TrimSpace(fmt.Sprintf(`Generate one small world event for a D&D GM app.

Requested event type:
%s

Requested location id:
%s

Additional GM request:
%s

Current event values:
%s

Campaign context:
%s

Return one complete world event object that feels fun, short and ready to run immediately.`, firstNonEmpty(strings.TrimSpace(input.Type), "social"), strings.TrimSpace(input.LocationID), firstNonEmpty(strings.TrimSpace(input.Prompt), "Create a lively, table-ready scene."), marshalAIJSON(input.Current), marshalAIJSON(compactCampaignContext(campaign))))
}

func buildOpenAIPlayerFacingFormatSystemPrompt() string {
	return strings.TrimSpace(`You format one player-facing D&D scene card for a Game Master's app.

Rules:
- Output only JSON matching the schema.
- Keep the same facts, meaning and sequence of events as the source text. You may reorganize for readability, but do not invent new lore.
- Prefer Russian when the prompt or campaign uses Russian.
- content must stay readable as plain text and preserve the same story beats.
- contentHtml must be a safe HTML fragment only, not a full document.
- Allowed tags in contentHtml: h1, h2, h3, h4, p, strong, em, u, span, ul, ol, li, blockquote, br, table, thead, tbody, tr, th, td.
- Allowed inline styles in contentHtml: color, background-color, font-size, text-align, font-weight, font-style, text-decoration, text-transform, letter-spacing.
- Do not use font-family. The app keeps its own built-in typography and will ignore custom fonts.
- Typography rules:
  - h1 is for the main scene title only. Keep it large and rare.
  - h2 is for major reading beats or sub-scenes.
  - h3 and h4 are for small callouts, notes, whispers, warnings or handout labels.
  - Body text should stay close to normal reading size, not poster-sized and not tiny.
  - Prefer one calm body size and a clear heading hierarchy instead of many different font sizes.
  - Use bold for emphasis, not for whole paragraphs.
  - Use italic only for quotes, internal thoughts, whispers or soft flavor text.
  - Underline only for 1-2 key fragments when needed, not as a default style.
  - Avoid all-caps for body text. Uppercase is acceptable only for tiny labels or short section markers.
  - Letter spacing should stay subtle and only on headings or small labels.
- Visual rules:
  - Use at most two accent colors plus the main readable text color.
  - Prefer warm parchment-like or muted fantasy accents over neon colors.
  - High contrast is required for all body text.
  - Do not paint long paragraphs with bright colors or heavy backgrounds.
  - Keep decorative styling secondary to readability for reading aloud at the table.
- When the source looks like a clue matrix, schedule, roster, loot summary, repeated checks/results list or any clear 2-4 column structure, convert it into a clean HTML table.
- Keep tables compact and readable: simple header row, plain cells, no nested tables, no decorative layout tricks.
- Do not use scripts, classes, ids, links, images, iframes, inline event handlers, external resources or CSS blocks.
- Favor a beautiful handout-like rhythm: clear heading hierarchy, short readable paragraphs, highlighted key phrases, tasteful accent colors and bullet lists where useful.
- If the source is already structured, preserve that structure and make it cleaner instead of rewriting it from scratch.`)
}

func buildOpenAIPlayerFacingFormatUserPrompt(campaign campaignData, input formatPlayerFacingCardInput) string {
	return strings.TrimSpace(fmt.Sprintf(`Format one player-facing card for the GM app.

Card metadata:
%s

Current plain text:
%s

Current formatted HTML:
%s

Campaign context:
%s

Return the same scene content, but make it more beautiful and easier to read aloud.`, marshalAIJSON(map[string]any{
		"title":      strings.TrimSpace(input.Title),
		"entityId":   strings.TrimSpace(input.EntityID),
		"entityKind": strings.TrimSpace(input.EntityKind),
	}), firstNonEmpty(strings.TrimSpace(input.Content), "No plain text supplied."), firstNonEmpty(strings.TrimSpace(input.ContentHTML), "No current HTML supplied."), marshalAIJSON(compactCampaignContext(campaign))))
}

func buildOpenAIEncounterSystemPrompt() string {
	return strings.TrimSpace(`You generate structured combat encounter rosters for a D&D 5e Game Master's app.

Rules:
- Output only JSON matching the schema.
- Return unique monster entity drafts plus quantities. Do not output numbered duplicates of the same monster.
- If the request implies a leader and followers, represent them as separate unique entries.
- Respect current campaign canon, tone, existing locations, factions, NPCs and monsters where useful.
- Prefer Russian when the prompt or campaign uses Russian.
- Do not invent image URLs.
- Each monster entity must include a usable D&D-style stat block with AC, HP, speed in feet, six ability scores, traits and actions.
- If the request matches official D&D 5e monsters or humanoid enemies, prefer official dnd.su-style bestiary entries over custom placeholders.
- For bandit or outlaw encounters, strongly prefer official stat blocks such as Bandit, Scout, Thug, Bandit Captain, Veteran and Gladiator.
- Each monster entity should also include rewardProfile with loot, trophies or salvage checks when that makes sense.
- rewardProfile must use concrete loot data. If the encounter gives money, use exact coin counts and denominations instead of vague wording or broad ranges.
- Use dice notation for damage when appropriate.
- The total quantity across all items must exactly match the requested monster count.`)
}

func buildOpenAIEncounterUserPrompt(campaign campaignData, input generateCombatInput) string {
	return strings.TrimSpace(fmt.Sprintf(`Generate a combat encounter roster for a D&D GM app.

User request:
%s

Encounter requirements:
%s

Campaign context:
%s

Return only unique monster entities with quantities.`, firstNonEmpty(strings.TrimSpace(input.Prompt), "Create a useful encounter from the current campaign context."), marshalAIJSON(compactEncounterContext(input)), marshalAIJSON(compactCampaignContext(campaign))))
}

func compactCampaignContext(campaign campaignData) map[string]any {
	return map[string]any{
		"campaign": map[string]any{
			"id":          campaign.ID,
			"title":       campaign.Title,
			"system":      campaign.System,
			"settingName": campaign.SettingName,
			"inWorldDate": campaign.InWorldDate,
			"summary":     truncateAIText(campaign.Summary, 320),
		},
		"locations":   trimEntitySlice(campaign.Locations, 30),
		"npcs":        trimEntitySlice(campaign.NPCs, 30),
		"monsters":    trimEntitySlice(campaign.Monsters, 30),
		"quests":      trimEntitySlice(campaign.Quests, 30),
		"lore":        trimEntitySlice(campaign.Lore, 30),
		"events":      campaign.Events,
		"sessionPrep": campaign.SessionPrep,
	}
}

func compactEncounterContext(input generateCombatInput) map[string]any {
	return map[string]any{
		"title":            strings.TrimSpace(input.Title),
		"prompt":           strings.TrimSpace(input.Prompt),
		"monsterCount":     input.MonsterCount,
		"difficulty":       strings.TrimSpace(input.Difficulty),
		"partySize":        input.PartySize,
		"partyLevels":      normalizePartyLevels(input.PartyLevels),
		"thresholds":       normalizeCombatThresholds(input.Thresholds),
		"customAdjustedXp": input.CustomAdjustedXP,
	}
}

func trimEntitySlice(items []knowledgeEntity, limit int) []map[string]any {
	if len(items) > limit {
		items = items[:limit]
	}
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":            item.ID,
			"kind":          item.Kind,
			"title":         item.Title,
			"subtitle":      truncateAIText(item.Subtitle, 120),
			"summary":       truncateAIText(item.Summary, 220),
			"playerContent": truncateAIText(item.PlayerContent, 220),
			"tags":          item.Tags,
			"category":      item.Category,
			"region":        item.Region,
			"danger":        item.Danger,
			"role":          item.Role,
			"status":        item.Status,
			"importance":    item.Importance,
			"locationId":    item.LocationID,
			"rewardSummary": func() string {
				if item.RewardProfile == nil {
					return ""
				}
				return truncateAIText(item.RewardProfile.Summary, 180)
			}(),
			"urgency":    item.Urgency,
			"issuerId":   item.IssuerID,
			"visibility": item.Visibility,
		})
	}
	return result
}

func entityDraftSchema() map[string]any {
	properties := map[string]any{
		"kind":          map[string]any{"type": "string", "enum": []string{"location", "npc", "monster", "quest", "lore"}},
		"title":         map[string]any{"type": "string"},
		"subtitle":      map[string]any{"type": "string"},
		"summary":       map[string]any{"type": "string"},
		"content":       map[string]any{"type": "string"},
		"playerContent": map[string]any{"type": "string"},
		"tags":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"related":       relatedEntitySchema(),
		"art":           nullableObject(heroArtSchema()),
		"category":      nullableEnum("City", "Region", "Dungeon", "POI", "History", "Rumor", "Religion", "Threat"),
		"region":        nullableString(),
		"danger":        nullableEnum("Safe", "Tense", "Dangerous", "Deadly"),
		"parentId":      nullableString(),
		"role":          nullableString(),
		"status":        nullableEnum("Ally", "Watcher", "Threat", "Unknown", "Hostile", "Territorial", "Summoned", "Neutral", "active", "paused", "completed"),
		"importance":    nullableEnum("Background", "Major", "Critical", "Minion", "Standard", "Elite", "Boss"),
		"locationId":    nullableString(),
		"statBlock":     nullableObject(npcStatBlockSchema()),
		"rewardProfile": nullableObject(monsterRewardProfileSchema()),
		"urgency":       nullableEnum("Low", "Medium", "High", "Critical"),
		"issuerId":      nullableString(),
		"visibility":    nullableEnum("gm_only", "player_safe"),
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func playerFacingCardFormatSchema() map[string]any {
	properties := map[string]any{
		"title":       map[string]any{"type": "string"},
		"content":     map[string]any{"type": "string"},
		"contentHtml": map[string]any{"type": "string"},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func worldEventDraftSchema() map[string]any {
	properties := map[string]any{
		"title":         map[string]any{"type": "string"},
		"date":          map[string]any{"type": "string"},
		"summary":       map[string]any{"type": "string"},
		"type":          map[string]any{"type": "string", "enum": []string{"funny", "combat", "heist", "social", "oddity", "danger"}},
		"locationId":    map[string]any{"type": "string"},
		"locationLabel": map[string]any{"type": "string"},
		"sceneText":     map[string]any{"type": "string"},
		"dialogueBranches": map[string]any{
			"type":  "array",
			"items": worldEventDialogueBranchSchema(),
		},
		"loot": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
		"tags": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
		"origin": map[string]any{"type": "string", "enum": []string{"manual", "ai"}},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func worldEventDialogueBranchSchema() map[string]any {
	properties := map[string]any{
		"title":   map[string]any{"type": "string"},
		"lines":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"outcome": map[string]any{"type": "string"},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func encounterDraftSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"items"},
		"properties": map[string]any{
			"items": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"quantity", "entity"},
					"properties": map[string]any{
						"quantity": map[string]any{"type": "integer"},
						"entity":   monsterEncounterEntitySchema(),
					},
				},
			},
		},
	}
}

func monsterEncounterEntitySchema() map[string]any {
	schema := entityDraftSchema()
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		return schema
	}

	properties["kind"] = map[string]any{"type": "string", "enum": []string{"monster"}}
	schema["required"] = requiredKeys(properties)
	return schema
}

func relatedEntitySchema() map[string]any {
	return map[string]any{
		"type": "array",
		"items": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []string{"id", "kind", "label", "reason"},
			"properties": map[string]any{
				"id":     map[string]any{"type": "string"},
				"kind":   map[string]any{"type": "string", "enum": []string{"location", "npc", "monster", "quest", "lore"}},
				"label":  map[string]any{"type": "string"},
				"reason": map[string]any{"type": "string"},
			},
		},
	}
}

func heroArtSchema() map[string]any {
	properties := map[string]any{
		"url":     nullableString(),
		"alt":     nullableString(),
		"caption": nullableString(),
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func monsterRewardProfileSchema() map[string]any {
	properties := map[string]any{
		"summary": map[string]any{"type": "string"},
		"loot": map[string]any{
			"type":  "array",
			"items": monsterLootEntrySchema(),
		},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func monsterLootEntrySchema() map[string]any {
	properties := map[string]any{
		"name":     map[string]any{"type": "string"},
		"category": map[string]any{"type": "string"},
		"quantity": map[string]any{"type": "string"},
		"check":    map[string]any{"type": "string"},
		"dc":       nullableString(),
		"details":  nullableString(),
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func npcStatBlockSchema() map[string]any {
	properties := map[string]any{
		"size":                map[string]any{"type": "string"},
		"creatureType":        map[string]any{"type": "string"},
		"alignment":           map[string]any{"type": "string"},
		"armorClass":          map[string]any{"type": "string"},
		"hitPoints":           map[string]any{"type": "string"},
		"speed":               map[string]any{"type": "string"},
		"proficiencyBonus":    nullableString(),
		"challenge":           nullableString(),
		"senses":              nullableString(),
		"languages":           nullableString(),
		"savingThrows":        nullableString(),
		"skills":              nullableString(),
		"resistances":         nullableString(),
		"immunities":          nullableString(),
		"conditionImmunities": nullableString(),
		"abilityScores": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []string{"str", "dex", "con", "int", "wis", "cha"},
			"properties": map[string]any{
				"str": map[string]any{"type": "integer"},
				"dex": map[string]any{"type": "integer"},
				"con": map[string]any{"type": "integer"},
				"int": map[string]any{"type": "integer"},
				"wis": map[string]any{"type": "integer"},
				"cha": map[string]any{"type": "integer"},
			},
		},
		"traits":       map[string]any{"type": "array", "items": statBlockEntrySchema()},
		"actions":      map[string]any{"type": "array", "items": statBlockEntrySchema()},
		"bonusActions": map[string]any{"type": "array", "items": statBlockEntrySchema()},
		"reactions":    map[string]any{"type": "array", "items": statBlockEntrySchema()},
		"spellcasting": nullableObject(spellcastingSchema()),
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func statBlockEntrySchema() map[string]any {
	properties := map[string]any{
		"name":        map[string]any{"type": "string"},
		"subtitle":    nullableString(),
		"toHit":       nullableString(),
		"damage":      nullableString(),
		"saveDc":      nullableString(),
		"description": map[string]any{"type": "string"},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func spellcastingSchema() map[string]any {
	properties := map[string]any{
		"title":       map[string]any{"type": "string"},
		"ability":     map[string]any{"type": "string"},
		"saveDc":      map[string]any{"type": "string"},
		"attackBonus": map[string]any{"type": "string"},
		"description": nullableString(),
		"slots": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"level", "slots"},
				"properties": map[string]any{
					"level": map[string]any{"type": "string"},
					"slots": map[string]any{"type": "string"},
				},
			},
		},
		"spells": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             requiredKeys(properties),
		"properties":           properties,
	}
}

func requiredKeys(properties map[string]any) []string {
	keys := make([]string, 0, len(properties))
	seen := make(map[string]struct{}, len(properties))
	appendKey := func(key string) {
		if _, ok := properties[key]; !ok {
			return
		}
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		keys = append(keys, key)
	}

	for _, key := range []string{
		"kind", "title", "subtitle", "summary", "content", "tags", "related", "art", "category", "region", "danger",
		"parentId", "role", "status", "importance", "locationId", "statBlock", "urgency", "issuerId", "visibility",
		"url", "alt", "caption",
		"size", "creatureType", "alignment", "armorClass", "hitPoints", "speed", "proficiencyBonus", "challenge", "senses",
		"languages", "savingThrows", "skills", "resistances", "immunities", "conditionImmunities", "abilityScores",
		"traits", "actions", "bonusActions", "reactions", "spellcasting",
		"name", "subtitle", "toHit", "damage", "saveDc", "description",
		"title", "ability", "saveDc", "attackBonus", "slots", "spells",
		"level", "slots",
		"str", "dex", "con", "int", "wis", "cha",
		"id", "kind", "label", "reason",
	} {
		appendKey(key)
	}
	for key := range properties {
		appendKey(key)
	}
	return keys
}

func nullableString() map[string]any {
	return map[string]any{"type": []string{"string", "null"}}
}

func nullableEnum(values ...string) map[string]any {
	items := append([]string{}, values...)
	items = append(items, "null")
	return map[string]any{
		"type": []string{"string", "null"},
		"enum": items,
	}
}

func nullableObject(schema map[string]any) map[string]any {
	clone := map[string]any{}
	for key, value := range schema {
		clone[key] = value
	}
	clone["type"] = []string{"object", "null"}
	return clone
}

func extractChatCompletionContent(raw json.RawMessage) (string, error) {
	var text string
	if err := json.Unmarshal(raw, &text); err == nil && strings.TrimSpace(text) != "" {
		return strings.TrimSpace(text), nil
	}

	var parts []map[string]any
	if err := json.Unmarshal(raw, &parts); err == nil {
		var builder strings.Builder
		for _, part := range parts {
			value, ok := part["text"].(string)
			if !ok || strings.TrimSpace(value) == "" {
				continue
			}
			if builder.Len() > 0 {
				builder.WriteString("\n")
			}
			builder.WriteString(value)
		}
		if builder.Len() > 0 {
			return strings.TrimSpace(builder.String()), nil
		}
	}

	return "", fmt.Errorf("OpenAI response did not include text content")
}

func marshalAIJSON(value any) string {
	if value == nil {
		return "null"
	}
	body, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(body)
}

func requiresOpenAIKey(baseURL string) bool {
	trimmed := strings.TrimSpace(strings.ToLower(baseURL))
	return trimmed == "" || strings.Contains(trimmed, "openai.com")
}

func normalizeEntityKind(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "location", "npc", "monster", "quest", "lore":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func normalizeDraftEntity(kind string, prompt string, campaign campaignData, input createEntityInput) createEntityInput {
	entity := createEntityInput{
		Kind:          firstNonEmpty(normalizeEntityKind(kind), normalizeEntityKind(input.Kind), "location"),
		Title:         strings.TrimSpace(input.Title),
		Subtitle:      strings.TrimSpace(input.Subtitle),
		Summary:       strings.TrimSpace(input.Summary),
		Content:       strings.TrimSpace(input.Content),
		PlayerContent: strings.TrimSpace(input.PlayerContent),
		Tags:          ensureAITags(input.Tags),
		Related:       normalizeRelatedEntities(campaign, input.Related),
		Art:           sanitizeHeroArt(input.Art),
	}

	switch entity.Kind {
	case "location":
		entity.Category = normalizeLocationCategory(input.Category)
		entity.Region = strings.TrimSpace(input.Region)
		entity.Danger = normalizeLocationDanger(input.Danger)
		entity.ParentID = normalizeExistingID(campaign, input.ParentID, "location")
	case "npc":
		entity.Role = strings.TrimSpace(input.Role)
		entity.Status = normalizeNPCStatus(input.Status)
		entity.Importance = normalizeNPCImportance(input.Importance)
		entity.LocationID = normalizeExistingID(campaign, input.LocationID, "location")
		entity.StatBlock = normalizeNPCStatBlock(input.StatBlock, prompt, entity.Title)
		entity.RewardProfile = normalizeRewardProfile(input.RewardProfile, prompt, entity.Title, entity.Kind)
	case "monster":
		entity.Role = strings.TrimSpace(input.Role)
		entity.Status = normalizeMonsterStatus(input.Status)
		entity.Importance = normalizeMonsterImportance(input.Importance)
		entity.LocationID = normalizeExistingID(campaign, input.LocationID, "location")
		entity.StatBlock = normalizeMonsterStatBlock(input.StatBlock, prompt, entity.Title)
		entity.RewardProfile = normalizeRewardProfile(input.RewardProfile, prompt, entity.Title, entity.Kind)
		if official, ok := officialMonsterDraft(prompt, entity.Title); ok {
			if isPlaceholderMonsterTitle(entity.Title) {
				entity.Title = official.Title
			}
			if strings.TrimSpace(input.Role) == "" && strings.TrimSpace(entity.Role) == "" {
				entity.Role = official.Role
			}
			if strings.TrimSpace(input.Subtitle) == "" && strings.TrimSpace(entity.Subtitle) == "" {
				entity.Subtitle = official.Subtitle
			}
			if strings.TrimSpace(input.Summary) == "" && strings.TrimSpace(entity.Summary) == "" {
				entity.Summary = official.Summary
			}
			if strings.TrimSpace(input.Content) == "" && strings.TrimSpace(entity.Content) == "" {
				entity.Content = official.Content
			}
			if input.RewardProfile == nil && official.RewardProfile != nil {
				entity.RewardProfile = official.RewardProfile
			}
			if strings.TrimSpace(input.Importance) == "" && strings.TrimSpace(official.Importance) != "" {
				entity.Importance = official.Importance
			}
		}
	case "quest":
		entity.Status = normalizeQuestStatus(input.Status)
		entity.Urgency = normalizeQuestUrgency(input.Urgency)
		entity.LocationID = normalizeExistingID(campaign, input.LocationID, "location")
		entity.IssuerID = normalizeExistingID(campaign, input.IssuerID, "npc")
		entity.RewardProfile = normalizeRewardProfile(input.RewardProfile, prompt, entity.Title, entity.Kind)
	case "lore":
		entity.Category = normalizeLoreCategory(input.Category)
		entity.Visibility = normalizeLoreVisibility(input.Visibility)
	}

	if entity.Title == "" {
		entity.Title = draftFallbackTitle(entity.Kind, prompt)
	}
	if entity.Subtitle == "" {
		entity.Subtitle = draftFallbackSubtitle(entity)
	}
	if entity.Summary == "" {
		entity.Summary = draftFallbackSummary(entity)
	}
	if entity.Content == "" {
		entity.Content = draftFallbackContent(entity)
	}
	if entity.PlayerContent == "" {
		entity.PlayerContent = draftFallbackPlayerContent(entity)
	}

	return entity
}

func normalizeEncounterDraftItems(campaign campaignData, input generateCombatInput, rawItems []openAIEncounterDraftItem) []encounterDraftItem {
	targetCount := normalizeEncounterMonsterCount(input.MonsterCount)
	result := make([]encounterDraftItem, 0, len(rawItems))
	byTitle := map[string]int{}

	for _, item := range rawItems {
		quantity := item.Quantity
		if quantity < 1 {
			quantity = 1
		}

		entity := normalizeDraftEntity("monster", strings.TrimSpace(input.Prompt), campaign, item.Entity)
		entity.Title = normalizeEncounterDisplayTitle(entity.Title)
		key := normalizeEncounterTitleKey(entity.Title)
		if index, ok := byTitle[key]; ok {
			result[index].Quantity += quantity
			continue
		}

		byTitle[key] = len(result)
		result = append(result, encounterDraftItem{
			Quantity: quantity,
			Entity:   entity,
		})
	}

	if len(result) == 0 {
		result = append(result, encounterDraftItem{
			Quantity: targetCount,
			Entity:   buildMonsterDraft(strings.TrimSpace(input.Prompt)),
		})
	}

	if containsAny(input.Prompt, "leader", "глав", "captain", "chief", "boss") && targetCount > 1 && len(result) == 1 {
		leader := result[0]
		leader.Quantity = 1
		follower := leader
		if containsAny(input.Prompt, "bandit", "разбой", "brigand", "raider") {
			follower.Entity = buildOfficialBanditDraft()
		} else {
			follower.Entity.Title = fallbackEncounterFollowerTitle(follower.Entity.Title)
			follower.Entity.Importance = "Standard"
		}
		follower.Quantity = targetCount - 1
		result = []encounterDraftItem{leader, follower}
	}

	leaderPrompt := containsAny(input.Prompt, "leader", "глав", "captain", "chief", "boss")
	banditPrompt := containsAny(input.Prompt, "bandit", "разбой", "brigand", "raider")
	if leaderPrompt && targetCount > 1 && len(result) == 1 {
		leader := result[0]
		leader.Quantity = 1
		follower := leader
		if banditPrompt {
			follower.Entity = buildOfficialBanditDraft()
		} else {
			follower.Entity.Title = fallbackEncounterFollowerTitle(follower.Entity.Title)
			follower.Entity.Importance = "Standard"
		}
		follower.Quantity = targetCount - 1
		result = []encounterDraftItem{leader, follower}
	}

	totalCount := 0
	for _, item := range result {
		totalCount += item.Quantity
	}

	switch {
	case totalCount < targetCount:
		result[0].Quantity += targetCount - totalCount
	case totalCount > targetCount:
		excess := totalCount - targetCount
		for index := len(result) - 1; index >= 0 && excess > 0; index-- {
			reducible := result[index].Quantity - 1
			if reducible <= 0 {
				continue
			}
			delta := reducible
			if delta > excess {
				delta = excess
			}
			result[index].Quantity -= delta
			excess -= delta
		}
	}

	return result
}

func normalizeEncounterTitleKey(title string) string {
	return normalizeEntityTitle(normalizeEncounterDisplayTitle(title))
}

func normalizeEncounterDisplayTitle(title string) string {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		return ""
	}

	normalized := trimmed
	for {
		next := strings.TrimSpace(encounterNumberSuffixPattern.ReplaceAllString(normalized, ""))
		if next == "" || next == normalized {
			break
		}
		normalized = next
	}

	return normalized
}

func sanitizeHeroArt(art *heroArt) *heroArt {
	if art == nil {
		return nil
	}
	sanitized := &heroArt{
		URL:     strings.TrimSpace(art.URL),
		Alt:     strings.TrimSpace(art.Alt),
		Caption: strings.TrimSpace(art.Caption),
	}
	if sanitized.URL == "" && sanitized.Alt == "" && sanitized.Caption == "" {
		return nil
	}
	return sanitized
}

func normalizeRewardProfile(input *monsterRewardProfile, prompt string, title string, kind string) *monsterRewardProfile {
	if input == nil {
		return fallbackRewardProfile(prompt, title, kind)
	}

	loot := make([]monsterLootEntry, 0, len(input.Loot))
	for _, item := range input.Loot {
		name := strings.TrimSpace(item.Name)
		category := strings.TrimSpace(item.Category)
		quantity := strings.TrimSpace(item.Quantity)
		check := strings.TrimSpace(item.Check)
		dc := strings.TrimSpace(item.DC)
		details := strings.TrimSpace(item.Details)
		if name == "" && category == "" && quantity == "" && check == "" && dc == "" && details == "" {
			continue
		}

		loot = append(loot, monsterLootEntry{
			Name:     firstNonEmpty(name, "Unspecified loot"),
			Category: firstNonEmpty(category, "Loot"),
			Quantity: firstNonEmpty(quantity, "1"),
			Check:    firstNonEmpty(check, "No check"),
			DC:       dc,
			Details:  details,
		})
	}

	summary := strings.TrimSpace(input.Summary)
	if summary == "" && len(loot) == 0 {
		return fallbackRewardProfile(prompt, title, kind)
	}
	if summary == "" {
		switch kind {
		case "quest":
			summary = firstNonEmpty(title, "This quest") + " pays out money, leverage, access or story rewards when the party closes it."
		case "npc":
			summary = firstNonEmpty(title, "This NPC") + " can pay, trade, hand over key items or leave behind recoverable gear."
		default:
			summary = firstNonEmpty(title, "This monster") + " leaves behind useful remains, salvage or gear after the fight."
		}
	}

	return &monsterRewardProfile{
		Summary: summary,
		Loot:    loot,
	}
}

func fallbackRewardProfile(prompt string, title string, kind string) *monsterRewardProfile {
	switch kind {
	case "npc":
		return &monsterRewardProfile{
			Summary: firstNonEmpty(title, "НПС") + " должен давать группе конкретную оплату, полезный предмет или понятную личную добычу, а не абстрактную награду.",
			Loot: []monsterLootEntry{
				{Name: "Кошель и личные мелочи", Category: "Деньги", Quantity: "12 см и 3 зм", Check: "Обыск тела или без проверки", Details: "Монеты лежат в поясе, а рядом можно найти письмо, жетон, ключ или короткую личную запись."},
				{Name: "Оружие или полезная вещь", Category: "Снаряжение", Quantity: "1 предмет", Check: "Без проверки", Details: "Носимое оружие, инструмент, амулет или другой заметный предмет, который можно забрать сразу после сцены."},
			},
		}
	case "quest":
		return &monsterRewardProfile{
			Summary: firstNonEmpty(title, "Квест") + " должен обещать партии понятную награду с точными суммами, предметами и дополнительными выгодами.",
			Loot: []monsterLootEntry{
				{Name: "Денежная выплата", Category: "Награда", Quantity: "180 зм", Check: "Без проверки", Details: "Точная выплата после подтверждения результата: 120 зм сразу и ещё 60 зм при возврате с доказательством."},
				{Name: "Дополнительная выгода", Category: "Репутация или доступ", Quantity: "1 услуга", Check: "Зависит от условий", Details: "Скидка, покровительство, пропуск, секретная информация или право пройти к следующей сюжетной точке."},
			},
		}
	default:
		return fallbackMonsterRewardProfile(prompt, title)
	}
}

func fallbackMonsterRewardProfile(prompt string, title string) *monsterRewardProfile {
	switch {
	case containsAny(prompt, "bandit", "разбой", "brigand", "raider"):
		return defaultBanditRewardProfile(false)
	default:
		return defaultMonsterRewardProfile(prompt, title)
	}
}

func ensureAITags(tags []string) []string {
	result := sanitizeTags(tags)
	hasDraftTag := false
	for _, tag := range result {
		if strings.EqualFold(tag, "ai-draft") {
			hasDraftTag = true
			break
		}
	}
	if !hasDraftTag {
		result = append([]string{"ai-draft"}, result...)
	}
	if len(result) == 0 {
		return []string{"ai-draft"}
	}
	return result
}

func normalizeRelatedEntities(campaign campaignData, related []relatedEntity) []relatedEntity {
	if len(related) == 0 {
		return nil
	}

	available := map[string]knowledgeEntity{}
	for _, entity := range campaignEntities(campaign) {
		available[entity.ID] = entity
	}

	seen := map[string]struct{}{}
	result := make([]relatedEntity, 0, len(related))
	for _, item := range related {
		id := strings.TrimSpace(item.ID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		entity, ok := available[id]
		if len(available) > 0 && !ok {
			continue
		}

		kind := normalizeEntityKind(item.Kind)
		label := strings.TrimSpace(item.Label)
		if ok {
			kind = entity.Kind
			label = firstNonEmpty(label, entity.Title)
		}
		if kind == "" || label == "" {
			continue
		}

		seen[id] = struct{}{}
		result = append(result, relatedEntity{
			ID:     id,
			Kind:   kind,
			Label:  label,
			Reason: firstNonEmpty(strings.TrimSpace(item.Reason), "Связано с текущей сущностью."),
		})
	}

	if len(result) == 0 {
		return nil
	}
	return result
}

func normalizeExistingID(campaign campaignData, id string, allowedKinds ...string) string {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return ""
	}
	for _, entity := range campaignEntities(campaign) {
		if entity.ID != trimmed {
			continue
		}
		if len(allowedKinds) == 0 {
			return trimmed
		}
		for _, kind := range allowedKinds {
			if entity.Kind == kind {
				return trimmed
			}
		}
		return ""
	}
	return ""
}

func normalizeLocationCategory(value string) string {
	switch strings.TrimSpace(value) {
	case "City", "Region", "Dungeon", "POI":
		return strings.TrimSpace(value)
	default:
		return "City"
	}
}

func normalizeLocationDanger(value string) string {
	switch strings.TrimSpace(value) {
	case "Safe", "Tense", "Dangerous", "Deadly":
		return strings.TrimSpace(value)
	default:
		return "Tense"
	}
}

func normalizeNPCStatus(value string) string {
	switch strings.TrimSpace(value) {
	case "Ally", "Watcher", "Threat", "Unknown":
		return strings.TrimSpace(value)
	default:
		return "Unknown"
	}
}

func normalizeNPCImportance(value string) string {
	switch strings.TrimSpace(value) {
	case "Background", "Major", "Critical":
		return strings.TrimSpace(value)
	default:
		return "Major"
	}
}

func normalizeMonsterStatus(value string) string {
	switch strings.TrimSpace(value) {
	case "Hostile", "Territorial", "Summoned", "Neutral":
		return strings.TrimSpace(value)
	default:
		return "Hostile"
	}
}

func normalizeMonsterImportance(value string) string {
	switch strings.TrimSpace(value) {
	case "Minion", "Standard", "Elite", "Boss":
		return strings.TrimSpace(value)
	default:
		return "Standard"
	}
}

func normalizeQuestStatus(value string) string {
	switch strings.TrimSpace(value) {
	case "active", "paused", "completed":
		return strings.TrimSpace(value)
	default:
		return "active"
	}
}

func normalizeQuestUrgency(value string) string {
	switch strings.TrimSpace(value) {
	case "Low", "Medium", "High", "Critical":
		return strings.TrimSpace(value)
	default:
		return "Medium"
	}
}

func normalizeLoreCategory(value string) string {
	switch strings.TrimSpace(value) {
	case "History", "Rumor", "Religion", "Threat":
		return strings.TrimSpace(value)
	default:
		return "History"
	}
}

func normalizeLoreVisibility(value string) string {
	switch strings.TrimSpace(value) {
	case "gm_only", "player_safe":
		return strings.TrimSpace(value)
	default:
		return "gm_only"
	}
}

func normalizeNPCStatBlock(statBlock *npcStatBlock, prompt string, title string) *npcStatBlock {
	base := defaultHumanoidStatBlock(firstNonEmpty(title, "Generated NPC"))
	if containsAny(prompt, "wolf", "волк") {
		base = defaultWolfStatBlock()
	}
	if statBlock == nil {
		return base
	}

	normalized := *base
	if value := strings.TrimSpace(statBlock.Size); value != "" {
		normalized.Size = value
	}
	if value := strings.TrimSpace(statBlock.CreatureType); value != "" {
		normalized.CreatureType = value
	}
	if value := strings.TrimSpace(statBlock.Alignment); value != "" {
		normalized.Alignment = value
	}
	if value := strings.TrimSpace(statBlock.ArmorClass); value != "" {
		normalized.ArmorClass = value
	}
	if value := strings.TrimSpace(statBlock.HitPoints); value != "" {
		normalized.HitPoints = value
	}
	if value := strings.TrimSpace(statBlock.Speed); value != "" {
		normalized.Speed = value
	}
	if value := strings.TrimSpace(statBlock.ProficiencyBonus); value != "" {
		normalized.ProficiencyBonus = value
	}
	if value := strings.TrimSpace(statBlock.Challenge); value != "" {
		normalized.Challenge = value
	}
	if value := strings.TrimSpace(statBlock.Senses); value != "" {
		normalized.Senses = value
	}
	if value := strings.TrimSpace(statBlock.Languages); value != "" {
		normalized.Languages = value
	}
	if value := strings.TrimSpace(statBlock.SavingThrows); value != "" {
		normalized.SavingThrows = value
	}
	if value := strings.TrimSpace(statBlock.Skills); value != "" {
		normalized.Skills = value
	}
	if value := strings.TrimSpace(statBlock.Resistances); value != "" {
		normalized.Resistances = value
	}
	if value := strings.TrimSpace(statBlock.Immunities); value != "" {
		normalized.Immunities = value
	}
	if value := strings.TrimSpace(statBlock.ConditionImmunities); value != "" {
		normalized.ConditionImmunities = value
	}

	normalized.AbilityScores = normalizeAbilityScores(statBlock.AbilityScores, base.AbilityScores)
	normalized.Traits = normalizeStatBlockEntries(statBlock.Traits, base.Traits)
	normalized.Actions = normalizeStatBlockEntries(statBlock.Actions, base.Actions)
	normalized.BonusActions = normalizeStatBlockEntries(statBlock.BonusActions, nil)
	normalized.Reactions = normalizeStatBlockEntries(statBlock.Reactions, nil)
	normalized.Spellcasting = normalizeSpellcasting(statBlock.Spellcasting)
	return &normalized
}

func normalizeMonsterStatBlock(statBlock *npcStatBlock, prompt string, title string) *npcStatBlock {
	base := defaultMonsterStatBlock(firstNonEmpty(title, "Generated Monster"))
	if official, ok := officialMonsterDraft(prompt, title); ok && official.StatBlock != nil {
		base = official.StatBlock
	}
	switch {
	case containsAny(prompt, "wolf", "волк"):
		base = defaultWolfStatBlock()
	case containsAny(prompt, "spider", "паук"):
		base = defaultSpiderStatBlock()
	}
	if statBlock == nil {
		return base
	}

	normalized := *base
	if value := strings.TrimSpace(statBlock.Size); value != "" {
		normalized.Size = value
	}
	if value := strings.TrimSpace(statBlock.CreatureType); value != "" {
		normalized.CreatureType = value
	}
	if value := strings.TrimSpace(statBlock.Alignment); value != "" {
		normalized.Alignment = value
	}
	if value := strings.TrimSpace(statBlock.ArmorClass); value != "" {
		normalized.ArmorClass = value
	}
	if value := strings.TrimSpace(statBlock.HitPoints); value != "" {
		normalized.HitPoints = value
	}
	if value := strings.TrimSpace(statBlock.Speed); value != "" {
		normalized.Speed = value
	}
	if value := strings.TrimSpace(statBlock.ProficiencyBonus); value != "" {
		normalized.ProficiencyBonus = value
	}
	if value := strings.TrimSpace(statBlock.Challenge); value != "" {
		normalized.Challenge = value
	}
	if value := strings.TrimSpace(statBlock.Senses); value != "" {
		normalized.Senses = value
	}
	if value := strings.TrimSpace(statBlock.Languages); value != "" {
		normalized.Languages = value
	}
	if value := strings.TrimSpace(statBlock.SavingThrows); value != "" {
		normalized.SavingThrows = value
	}
	if value := strings.TrimSpace(statBlock.Skills); value != "" {
		normalized.Skills = value
	}
	if value := strings.TrimSpace(statBlock.Resistances); value != "" {
		normalized.Resistances = value
	}
	if value := strings.TrimSpace(statBlock.Immunities); value != "" {
		normalized.Immunities = value
	}
	if value := strings.TrimSpace(statBlock.ConditionImmunities); value != "" {
		normalized.ConditionImmunities = value
	}

	normalized.AbilityScores = normalizeAbilityScores(statBlock.AbilityScores, base.AbilityScores)
	normalized.Traits = normalizeStatBlockEntries(statBlock.Traits, base.Traits)
	normalized.Actions = normalizeStatBlockEntries(statBlock.Actions, base.Actions)
	normalized.BonusActions = normalizeStatBlockEntries(statBlock.BonusActions, nil)
	normalized.Reactions = normalizeStatBlockEntries(statBlock.Reactions, nil)
	normalized.Spellcasting = normalizeSpellcasting(statBlock.Spellcasting)
	return &normalized
}

func normalizeAbilityScores(input abilityScores, fallback abilityScores) abilityScores {
	result := fallback
	if input.STR >= 1 && input.STR <= 30 {
		result.STR = input.STR
	}
	if input.DEX >= 1 && input.DEX <= 30 {
		result.DEX = input.DEX
	}
	if input.CON >= 1 && input.CON <= 30 {
		result.CON = input.CON
	}
	if input.INT >= 1 && input.INT <= 30 {
		result.INT = input.INT
	}
	if input.WIS >= 1 && input.WIS <= 30 {
		result.WIS = input.WIS
	}
	if input.CHA >= 1 && input.CHA <= 30 {
		result.CHA = input.CHA
	}
	return result
}

func normalizeStatBlockEntries(entries []statBlockEntry, fallback []statBlockEntry) []statBlockEntry {
	result := make([]statBlockEntry, 0, len(entries))
	for _, entry := range entries {
		name := strings.TrimSpace(entry.Name)
		description := strings.TrimSpace(entry.Description)
		subtitle := strings.TrimSpace(entry.Subtitle)
		toHit := strings.TrimSpace(entry.ToHit)
		damage := strings.TrimSpace(entry.Damage)
		saveDC := strings.TrimSpace(entry.SaveDC)
		if name == "" && description == "" && subtitle == "" && toHit == "" && damage == "" && saveDC == "" {
			continue
		}
		result = append(result, statBlockEntry{
			Name:        firstNonEmpty(name, "Unnamed feature"),
			Subtitle:    subtitle,
			ToHit:       toHit,
			Damage:      damage,
			SaveDC:      saveDC,
			Description: firstNonEmpty(description, "Description pending."),
		})
	}
	if len(result) > 0 {
		return result
	}
	if len(fallback) == 0 {
		return nil
	}
	return cloneStatBlockEntries(fallback)
}

func cloneStatBlockEntries(entries []statBlockEntry) []statBlockEntry {
	result := make([]statBlockEntry, 0, len(entries))
	for _, entry := range entries {
		result = append(result, statBlockEntry{
			Name:        entry.Name,
			Subtitle:    entry.Subtitle,
			ToHit:       entry.ToHit,
			Damage:      entry.Damage,
			SaveDC:      entry.SaveDC,
			Description: entry.Description,
		})
	}
	return result
}

func normalizeSpellcasting(spellcasting *spellcastingBlock) *spellcastingBlock {
	if spellcasting == nil {
		return nil
	}
	slots := normalizeSpellSlots(spellcasting.Slots)
	spells := normalizeSpellNames(spellcasting.Spells)
	description := strings.TrimSpace(spellcasting.Description)
	if strings.TrimSpace(spellcasting.Title) == "" && strings.TrimSpace(spellcasting.Ability) == "" &&
		strings.TrimSpace(spellcasting.SaveDC) == "" && strings.TrimSpace(spellcasting.AttackBonus) == "" &&
		description == "" && len(slots) == 0 && len(spells) == 0 {
		return nil
	}
	return &spellcastingBlock{
		Title:       firstNonEmpty(strings.TrimSpace(spellcasting.Title), "Spellcasting"),
		Ability:     firstNonEmpty(strings.TrimSpace(spellcasting.Ability), "INT"),
		SaveDC:      firstNonEmpty(strings.TrimSpace(spellcasting.SaveDC), "13"),
		AttackBonus: firstNonEmpty(strings.TrimSpace(spellcasting.AttackBonus), "+5"),
		Slots:       slots,
		Spells:      spells,
		Description: description,
	}
}

func normalizeSpellSlots(slots []spellSlotSummary) []spellSlotSummary {
	result := make([]spellSlotSummary, 0, len(slots))
	for _, slot := range slots {
		level := strings.TrimSpace(slot.Level)
		count := strings.TrimSpace(slot.Slots)
		if level == "" && count == "" {
			continue
		}
		result = append(result, spellSlotSummary{
			Level: firstNonEmpty(level, "1st"),
			Slots: firstNonEmpty(count, "1"),
		})
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func normalizeSpellNames(spells []string) []string {
	result := make([]string, 0, len(spells))
	seen := map[string]struct{}{}
	for _, spell := range spells {
		trimmed := strings.TrimSpace(spell)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func draftFallbackTitle(kind string, prompt string) string {
	switch kind {
	case "location":
		return draftTitle(prompt, "Новая локация")
	case "npc":
		return draftTitle(prompt, "Новый НПС")
	case "monster":
		return draftTitle(prompt, "Новый монстр")
	case "quest":
		return draftTitle(prompt, "Новый квест")
	case "lore":
		return draftTitle(prompt, "Новая запись лора")
	default:
		return draftTitle(prompt, "Новая сущность")
	}
}

func draftFallbackSubtitle(entity createEntityInput) string {
	switch entity.Kind {
	case "location":
		return firstNonEmpty(entity.Category, "Location") + " • AI draft"
	case "npc":
		return firstNonEmpty(entity.Role, "NPC") + " • AI draft"
	case "monster":
		return firstNonEmpty(entity.Role, "Monster") + " • AI draft"
	case "quest":
		return firstNonEmpty(entity.Status, "active") + " • AI draft"
	case "lore":
		return firstNonEmpty(entity.Category, "History") + " • AI draft"
	default:
		return "AI draft"
	}
}

func draftFallbackSummary(entity createEntityInput) string {
	switch entity.Kind {
	case "location":
		return entity.Title + " готова как игровая сцена с опасностями, атмосферой и зацепками."
	case "npc":
		return entity.Title + " подготовлен как игровой персонаж или существо с usable stat block."
	case "monster":
		return entity.Title + " подготовлен как encounter-ready монстр с полным stat block."
	case "quest":
		return entity.Title + " оформлен как сюжетная линия с давлением и последствиями."
	case "lore":
		return entity.Title + " оформлен как usable lore fragment для мастера."
	default:
		return entity.Title + " подготовлена как AI-черновик."
	}
}

func draftFallbackContent(entity createEntityInput) string {
	return firstNonEmpty(entity.Content, entity.Summary, entity.Title+" подготовлена как AI-черновик.")
}

func draftFallbackPlayerContent(entity createEntityInput) string {
	switch entity.Kind {
	case "npc":
		return firstNonEmpty(entity.PlayerContent, entity.Title+" может рассказать группе только видимую часть ситуации: кто пострадал, что нужно сделать, какую награду он обещает и чего опасается вслух.")
	case "quest":
		return firstNonEmpty(entity.PlayerContent, entity.Title+" подаётся игрокам как понятный заказ, слух, просьба о помощи или зацепка без раскрытия скрытых мотивов и закулисных угроз.")
	default:
		return strings.TrimSpace(entity.PlayerContent)
	}
}

func truncateAIText(value string, limit int) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= limit {
		return trimmed
	}
	if limit <= 3 {
		return trimmed[:limit]
	}
	return strings.TrimSpace(trimmed[:limit-3]) + "..."
}
