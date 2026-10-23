package httpapi

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestWorkspaceSearchContentTargetsAndBoundedUnicode(t *testing.T) {
	campaign := campaignData{
		Locations:   []knowledgeEntity{{ID: "place", Kind: "location", Title: "Локация", Content: strings.Repeat("я", 400) + "подземелье" + strings.Repeat("ю", 400)}},
		Events:      []worldEvent{{ID: "event", Title: "Событие", SceneText: "Скрытое подземелье"}},
		Shops:       []campaignShop{{ID: "shop", Name: "Лавка", Description: "Снаряжение для подземелья"}},
		WorldMaps:   []worldMapDocument{{ID: "map", Title: "Атлас", Prompt: "Карта подземелья"}, {ID: "map-label", Title: "Подпись", Labels: []worldMapLabel{{Text: "Подземелье"}}}},
		SessionMaps: []sessionMapDocument{{ID: "scene", Title: "Подземелье"}},
		CustomItems: []customCampaignItem{{ID: "item", Name: "Ключ", Description: "Ключ от подземелья"}},
	}
	results := searchCampaign(campaign, "подземель")
	if len(results) != 7 {
		t.Fatalf("all targets: %#v", results)
	}
	targets := map[string]bool{}
	for _, result := range results {
		targets[result.Target] = true
		if !utf8.ValidString(result.Summary) || len([]rune(result.Summary)) > 222 {
			t.Fatalf("invalid or unbounded snippet: %q", result.Summary)
		}
		if result.ID == "place" && (!strings.Contains(result.Summary, "подземелье") || result.Match != "text") {
			t.Fatal("content match window missing")
		}
		if result.ID == "scene" && result.Match != "title" {
			t.Fatal("title match not distinguished")
		}
	}
	for _, target := range []string{"", "event", "shop", "map", "scene", "item"} {
		if !targets[target] {
			t.Fatal("missing target", target)
		}
	}
	if len(searchCampaign(campaign, " ")) != 0 || len(searchCampaign(campaign, strings.Repeat("x", 301))) != 0 {
		t.Fatal("unbounded search accepted")
	}
}

func TestWorkspaceSearchTranscriptScopeAndOwnerAccess(t *testing.T) {
	store, campaign := newOrdinaryMutationTestStore(t)
	store.mu.Lock()
	store.data.ImportedSessions = append(store.data.ImportedSessions,
		importedSession{ID: "own-session", CampaignID: campaign.ID, Title: "Журнал", Text: "Уникальная реплика"},
		importedSession{ID: "other-session", CampaignID: "unrelated", Title: "Журнал", Text: "Уникальная реплика"})
	store.mu.Unlock()
	results, err := store.search(campaign.ID, "реплика")
	if err != nil || len(results) != 1 || results[0].ID != "own-session" || results[0].Target != "session" {
		t.Fatal("transcript scope", results, err)
	}

	handler := newAccountTestServer(t)
	alice := registerAccountTestUser(t, handler, "search-owner")
	bob := registerAccountTestUser(t, handler, "search-other")
	created := accountTestRequest(t, handler, "POST", "/api/campaigns", `{"title":"Search test","system":"5e"}`, alice)
	owned := decodeAccountTestData[campaignData](t, created)
	path := "/api/campaigns/" + owned.ID + "/search?q=secret"
	if got := accountTestRequest(t, handler, "GET", path, "", bob); got.Code != 404 {
		t.Fatal("foreign search exposed", got.Code)
	}
	if got := accountTestRequest(t, handler, "GET", path, "", nil); got.Code != 401 {
		t.Fatal("public search exposed", got.Code)
	}
	if got := accountTestRequest(t, handler, "GET", path, "", alice); got.Code != 200 {
		t.Fatal("owner search denied", got.Code)
	}
}
