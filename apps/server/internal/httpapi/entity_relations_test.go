package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestReadyRelationsOverlaySurvivesReloadWithoutChangingBook(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	store, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	c, err := store.createCampaignForUser("owner", createCampaignInput{TemplateID: "icewind-dale-rus"})
	if err != nil {
		t.Fatal(err)
	}
	source, target := c.Locations[0].ID, c.Quests[0].ID
	srv := &server{store: store}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		srv.handleEntityRelations(w, r, authUser{ID: "owner"}, c.ID, []string{c.ID, "entities", source, "relations"})
	})
	r := itemsRequest(t, handler, "POST", "/", map[string]any{"expectedRevision": c.Revision, "targetIds": []string{target}, "reason": "playthrough"}, nil)
	if r.Code != 200 {
		t.Fatal(r.Code, r.Body.String())
	}
	reloaded, err := newCampaignStore(path)
	if err != nil {
		t.Fatal(err)
	}
	next, err := reloaded.getCampaign(c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if readyCampaignDigest(next) != c.ReadyCampaign.ContentHash || len(next.EntityRelations) != 1 {
		t.Fatal("source changed or overlay lost")
	}
	if !reflect.DeepEqual(entityRelations(next, source), entityRelations(decodeAccountTestData[campaignData](t, r), source)) {
		t.Fatal("reload changed pairs")
	}
	meta, records, err := splitCloudState(reloaded.data)
	if err != nil {
		t.Fatal(err)
	}
	joined, err := joinCloudState(meta, records)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, campaign := range joined.Campaigns {
		if campaign.ID == next.ID {
			found = true
			if !reflect.DeepEqual(campaign.EntityRelations, next.EntityRelations) {
				t.Fatal("JSONB record split lost overlay")
			}
		}
	}
	if !found {
		t.Fatal("JSONB record split lost campaign")
	}
	raw, err := os.ReadFile(path)
	if err != nil || !json.Valid(raw) {
		t.Fatal("invalid durable snapshot")
	}
}

func TestRelationsLegacyOverlayAndAtomicBatch(t *testing.T) {
	c := campaignData{Locations: []knowledgeEntity{{ID: "a", Kind: "location", Title: "A", Related: []relatedEntity{{ID: "b", Kind: "npc", Label: "Old B", Reason: "legacy"}}}}, NPCs: []knowledgeEntity{{ID: "b", Kind: "npc", Title: "B"}}}
	before := append([]relatedEntity{}, c.Locations[0].Related...)
	if len(entityRelations(c, "b")) != 1 {
		t.Fatal("legacy backlink missing")
	}
	if err := mutateEntityRelations(&c, "a", []string{"b", "foreign"}, "invalid", false); err == nil || len(c.EntityRelations) != 0 {
		t.Fatal("partial batch")
	}
	if err := mutateEntityRelations(&c, "a", []string{"a"}, "self", false); err == nil {
		t.Fatal("self relation")
	}
	for i := 0; i < 2; i++ {
		if err := mutateEntityRelations(&c, "a", []string{"b", "b"}, "new note", false); err != nil {
			t.Fatal(err)
		}
	}
	if len(c.EntityRelations) != 1 || entityRelations(c, "a")[0].Reason != "new note" || entityRelations(c, "b")[0].Reason != "new note" {
		t.Fatal("pair not unique or symmetric")
	}
	if err := mutateEntityRelations(&c, "b", []string{"a"}, "", true); err != nil {
		t.Fatal(err)
	}
	if len(entityRelations(c, "a")) != 0 || len(entityRelations(c, "b")) != 0 || !reflect.DeepEqual(before, c.Locations[0].Related) {
		t.Fatal("legacy pair resurrected or source rewritten")
	}
}

func TestRelationsHTTPAccessRevisionsAndDurability(t *testing.T) {
	handler := newAccountTestServer(t)
	alice := registerAccountTestUser(t, handler, "relations-alice")
	bob := registerAccountTestUser(t, handler, "relations-bob")
	c := decodeAccountTestData[campaignData](t, itemsRequest(t, handler, "POST", "/api/campaigns", map[string]any{"title": "Relations", "system": "5e"}, alice))
	for _, kind := range []string{"location", "npc", "lore"} {
		r := itemsRequest(t, handler, "POST", "/api/campaigns/"+c.ID+"/entities", map[string]any{"kind": kind, "title": kind}, alice)
		if r.Code != 201 {
			t.Fatal(r.Code, r.Body.String())
		}
	}
	c = decodeAccountTestData[campaignData](t, itemsRequest(t, handler, "GET", "/api/campaigns/"+c.ID, nil, alice))
	a, b := c.Locations[0].ID, c.NPCs[0].ID
	root := "/api/campaigns/" + c.ID + "/entities/" + a + "/relations"
	input := map[string]any{"expectedRevision": c.Revision, "targetIds": []string{b, c.Lore[0].ID}, "reason": "note"}
	for _, cookies := range [][]*http.Cookie{nil, bob} {
		r := itemsRequest(t, handler, "POST", root, input, cookies)
		if r.Code != 401 && r.Code != 404 && r.Code != 403 {
			t.Fatal("access", r.Code)
		}
	}
	if r := itemsRequest(t, handler, "POST", root, map[string]any{"targetIds": []string{b}}, alice); r.Code != 428 {
		t.Fatal("missing revision", r.Code)
	}
	r := itemsRequest(t, handler, "POST", root, input, alice)
	if r.Code != 200 {
		t.Fatal(r.Code, r.Body.String())
	}
	next := decodeAccountTestData[campaignData](t, r)
	if len(entityRelations(next, a)) != 2 || len(entityRelations(next, b)) != 1 {
		t.Fatal("bidirectional batch")
	}
	if r = itemsRequest(t, handler, "POST", root, input, alice); r.Code != 409 {
		t.Fatal("stale write", r.Code)
	}
	if r = itemsRequest(t, handler, "PATCH", root+"/"+b, map[string]any{"expectedRevision": next.Revision, "reason": "changed"}, alice); r.Code != 200 {
		t.Fatal(r.Code, r.Body.String())
	}
	next = decodeAccountTestData[campaignData](t, r)
	if r = itemsRequest(t, handler, "DELETE", root+"/"+b, map[string]any{"expectedRevision": next.Revision}, alice); r.Code != 200 {
		t.Fatal(r.Code, r.Body.String())
	}
	next = decodeAccountTestData[campaignData](t, itemsRequest(t, handler, "GET", "/api/campaigns/"+c.ID, nil, alice))
	if len(entityRelations(next, a)) != 1 || len(entityRelations(next, b)) != 0 || len(next.NPCs) != 1 {
		t.Fatal("unlink deleted entity or persisted wrong pair")
	}
	r = itemsRequest(t, handler, "GET", "/api/campaigns/"+c.ID+"/entities?kind=all&limit=1&exclude="+a, nil, alice)
	if r.Code != 200 || strings.Contains(r.Body.String(), `"id":"`+a+`"`) {
		t.Fatal("directory exclude", r.Body.String())
	}
}

func TestRelationsFailedSaveRollsBackBothEnds(t *testing.T) {
	store, _ := newOrdinaryMutationTestStore(t)
	user, _ := store.createUser("relations-rollback", "password123")
	c, _ := store.createCampaignForUser(user.ID, createCampaignInput{Title: "Rollback", System: "5e"})
	// Reuse campaign fixture entities without a second server or shared data file.
	store.mu.Lock()
	i := findOwnedCampaignIndexLocked(&store.data, user.ID, c.ID)
	store.data.Campaigns[i].Locations = []knowledgeEntity{{ID: "a", Kind: "location"}, {ID: "b", Kind: "location"}}
	c = store.data.Campaigns[i]
	store.mu.Unlock()
	before := snapshotOrdinaryStoreState(t, store)
	injectOrdinaryStoreSaveFailure(store)
	srv := &server{store: store}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		srv.handleEntityRelations(w, r, authUser{ID: user.ID}, c.ID, []string{c.ID, "entities", "a", "relations"})
	})
	r := itemsRequest(t, handler, "POST", "/", map[string]any{"expectedRevision": c.Revision, "targetIds": []string{"b"}}, nil)
	if r.Code != 503 || !reflect.DeepEqual(before, snapshotOrdinaryStoreState(t, store)) {
		t.Fatal("failed durable write changed relation state", r.Code)
	}
}
