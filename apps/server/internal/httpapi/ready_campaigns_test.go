package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadyCampaignAssetsAndReferences(t *testing.T) {
	c, err := readReadyCampaign("icewind-dale-rus")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Locations) < 400 || len(c.NPCs) < 150 || len(c.Monsters) != 57 || len(c.WorldMaps) != 41 {
		t.Fatal("incomplete source index")
	}
	ids := map[string]bool{}
	for _, items := range [][]knowledgeEntity{c.Locations, c.NPCs, c.Monsters, c.Quests, c.Lore} {
		for _, e := range items {
			if ids[e.ID] {
				t.Fatalf("duplicate %s", e.ID)
			}
			ids[e.ID] = true
		}
	}
	checkAsset := func(url string) {
		t.Helper()
		path := "ready_campaigns/icewind-dale-rus/" + strings.TrimPrefix(url, "/api/campaign-templates/icewind-dale-rus/assets/")
		body, err := readyCampaignFiles.ReadFile(path)
		if err != nil || len(body) < 12 || string(body[:4]) != "RIFF" || string(body[8:12]) != "WEBP" {
			t.Fatalf("invalid source image %s: %v", url, err)
		}
	}
	coverage := map[string]bool{}
	for _, items := range [][]knowledgeEntity{c.Locations, c.NPCs, c.Monsters, c.Quests, c.Lore} {
		for _, e := range items {
			for _, id := range []string{e.ParentID, e.LocationID, e.IssuerID} {
				if id != "" && !ids[id] {
					t.Fatalf("broken parent/location: %s", id)
				}
			}
			for _, r := range e.Related {
				if !ids[r.ID] {
					t.Fatalf("broken relation %s", r.ID)
				}
			}
			for _, g := range e.Gallery {
				checkAsset(g.URL)
				if e.Kind == "lore" {
					coverage[g.URL] = true
				}
			}
		}
	}
	for _, m := range c.WorldMaps {
		checkAsset(m.ImageURL)
	}
	for n := 1; n <= 323; n++ {
		url := fmt.Sprintf("/api/campaign-templates/icewind-dale-rus/assets/pages/%03d.webp", n)
		if !coverage[url] {
			t.Fatalf("missing book page %d", n)
		}
	}
}

func TestReadyCampaignHTTPProtectsSourceAllowsPlay(t *testing.T) {
	handler := newAccountTestServer(t)
	alice := registerAccountTestUser(t, handler, "ready-alice")
	bob := registerAccountTestUser(t, handler, "ready-bob")
	if r := accountTestRequest(t, handler, "GET", "/api/campaign-templates", "", nil); r.Code != 401 {
		t.Fatal("catalog requires authentication")
	}
	catalog := accountTestRequest(t, handler, "GET", "/api/campaign-templates", "", alice)
	if catalog.Code != 200 {
		t.Fatal(catalog.Code)
	}
	create := accountTestRequest(t, handler, "POST", "/api/campaigns", `{"templateId":"icewind-dale-rus","title":"Cannot override title"}`, alice)
	if create.Code != 201 {
		t.Fatalf("create %d: %s", create.Code, create.Body.String())
	}
	c := decodeAccountTestData[campaignData](t, create)
	if c.ReadyCampaign == nil || c.ReadyCampaign.Label != "Готовые Кампании" || c.Title == "Cannot override title" {
		t.Fatal("missing immutable template identity")
	}
	base := "/api/campaigns/" + c.ID
	if r := accountTestRequest(t, handler, "GET", base, "", bob); r.Code != 404 {
		t.Fatal("playthrough leaked to another master")
	}
	if r := accountTestRequest(t, handler, "POST", "/api/campaigns", `{"templateId":"unknown"}`, alice); r.Code != 400 {
		t.Fatal("unknown template should be rejected")
	}
	for _, operation := range []struct{ method, path, body string }{
		{"POST", base + "/entities", `{"kind":"npc","title":"Injected"}`},
		{"PUT", base + "/entities/" + c.NPCs[0].ID, `{"kind":"npc","title":"Changed"}`},
		{"DELETE", base + "/entities/" + c.Locations[0].ID, ""},
		{"POST", base + "/events", `{"title":"Changed"}`},
		{"POST", base + "/world-maps/generate", `{"prompt":"Changed"}`},
		{"PATCH", base, `{"shops":[]}`},
		{"POST", base + "/ai/proposals", `{"kind":"npc","mode":"create"}`},
		{"POST", base + "/combat/generate", `{"prompt":"Changed"}`},
	} {
		r := accountTestRequest(t, handler, operation.method, operation.path, operation.body, alice)
		if r.Code != 403 || !strings.Contains(r.Body.String(), "ready_campaign_read_only") {
			t.Fatalf("%s %s returned %d: %s", operation.method, operation.path, r.Code, r.Body.String())
		}
	}
	playerResponse := accountTestRequest(t, handler, "POST", base+"/entities", `{"kind":"player","title":"Участник","level":3}`, alice)
	if playerResponse.Code != 201 {
		t.Fatalf("player %d: %s", playerResponse.Code, playerResponse.Body.String())
	}
	player := decodeAccountTestData[createEntityResult](t, playerResponse).Entity
	body, _ := json.Marshal(startCombatInput{Title: "Бой по книге", Items: []addCombatantItem{{EntityID: player.ID, Quantity: 1, Side: "player"}, {EntityID: c.Monsters[0].ID, Quantity: 1, Side: "enemy"}}})
	combat := accountTestRequest(t, handler, "POST", base+"/combat/entries", string(body), alice)
	if combat.Code != 200 {
		t.Fatalf("combat %d: %s", combat.Code, combat.Body.String())
	}
	state := decodeAccountTestData[combatResult](t, combat)
	if state.Combat == nil || len(state.Combat.Entries) != 2 {
		t.Fatal("book creature unavailable in combat")
	}
	entryID := state.Combat.Entries[0].ID
	if r := accountTestRequest(t, handler, "PATCH", base+"/combat/entries/"+entryID, `{"currentHitPoints":0,"defeated":true}`, alice); r.Code != 200 {
		t.Fatalf("combat update %d", r.Code)
	}
	if r := accountTestRequest(t, handler, "POST", base+"/combat/finish", "", alice); r.Code != 200 {
		t.Fatalf("combat finish %d: %s", r.Code, r.Body.String())
	}
	if r := accountTestRequest(t, handler, "POST", base+"/sessions", `{"title":"Сессия 1","text":"Мастер: Группа отправилась в Бремен."}`, alice); r.Code != 201 {
		t.Fatalf("session import %d: %s", r.Code, r.Body.String())
	}
	after := decodeAccountTestData[campaignData](t, accountTestRequest(t, handler, "GET", base, "", alice))
	if readyCampaignDigest(after) != c.ReadyCampaign.ContentHash {
		t.Fatal("gameplay changed source")
	}
	asset := accountTestRequest(t, handler, "GET", "/api/campaign-templates/icewind-dale-rus/assets/maps/7-2.webp", "", alice)
	if asset.Code != 200 || asset.Header().Get("Content-Type") != "image/webp" {
		t.Fatal("original spread unavailable")
	}
}

func TestReadyCampaignRollbackAndReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	c, err := store.createCampaignForUser("owner", createCampaignInput{TemplateID: "icewind-dale-rus"})
	if err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(path)
	if _, err = store.updateEntity(c.ID, c.Quests[0].ID, createEntityInput{Kind: "quest", Title: "Corrupted"}); !errors.Is(err, errReadyCampaignReadOnly) {
		t.Fatalf("edit error %v", err)
	}
	after, _ := os.ReadFile(path)
	if !bytes.Equal(before, after) {
		t.Fatal("rejected edit changed durable store")
	}
	got, _ := store.getCampaign(c.ID)
	if readyCampaignDigest(got) != c.ReadyCampaign.ContentHash {
		t.Fatal("rejected edit changed memory")
	}
	second, err := store.createCampaignForUser("other", createCampaignInput{TemplateID: "icewind-dale-rus"})
	if err != nil {
		t.Fatal(err)
	}
	if c.NPCs[0].ID == second.NPCs[0].ID {
		t.Fatal("playthrough entities share IDs")
	}
	reloaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	got, err = reloaded.getCampaign(c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ReadyCampaign == nil || readyCampaignDigest(got) != got.ReadyCampaign.ContentHash {
		t.Fatal("seal did not survive restart")
	}
	meta, records, err := splitCloudState(reloaded.data)
	if err != nil {
		t.Fatal(err)
	}
	state, err := joinCloudState(meta, records)
	if err != nil {
		t.Fatal(err)
	}
	for _, campaign := range state.Campaigns {
		if campaign.ReadyCampaign != nil && readyCampaignDigest(campaign) != campaign.ReadyCampaign.ContentHash {
			t.Fatal("cloud codec changed source seal")
		}
	}
}
