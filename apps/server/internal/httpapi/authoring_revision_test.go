package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"
)

func TestAuthoringHTTPRejectsStaleWritesAndPatchPreservesFields(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "authoring-gm")
	created := accountTestRequest(t, handler, "POST", "/api/campaigns", `{"title":"Versions","system":"D&D 5e"}`, cookies)
	if created.Code != 201 {
		t.Fatal(created.Body.String())
	}
	campaign := decodeAccountTestData[campaignData](t, created)
	root := "/api/campaigns/" + campaign.ID
	create := accountTestRequest(t, handler, "POST", root+"/entities", `{"kind":"lore","title":"Original","summary":"Keep summary","content":"Keep content","tags":["keep"]}`, cookies)
	if create.Code != 201 {
		t.Fatal(create.Body.String())
	}
	first := decodeAccountTestData[createEntityResult](t, create)
	path := root + "/entities/" + first.Entity.ID
	missing := accountTestRequest(t, handler, "PUT", path, `{"kind":"lore","title":"Unsafe"}`, cookies)
	if missing.Code != http.StatusPreconditionRequired {
		t.Fatalf("missing revision: %d %s", missing.Code, missing.Body.String())
	}
	// Two independent editors both start from this revision; only one wins.
	body := fmt.Sprintf(`{"expectedRevision":%d,"title":"Changed"}`, first.Entity.Revision)
	patch := accountTestRequest(t, handler, "PATCH", path, body, cookies)
	if patch.Code != 200 {
		t.Fatalf("patch %d %s", patch.Code, patch.Body.String())
	}
	saved := decodeAccountTestData[createEntityResult](t, patch)
	if saved.Entity.Content != "Keep content" || saved.Entity.Summary != "Keep summary" || len(saved.Entity.Tags) != 1 {
		t.Fatalf("partial patch erased fields: %#v", saved.Entity)
	}
	stale := accountTestRequest(t, handler, "PUT", path, fmt.Sprintf(`{"expectedRevision":%d,"kind":"lore","title":"Old tab","content":"Overwrite"}`, first.Entity.Revision), cookies)
	if stale.Code != 409 {
		t.Fatalf("stale %d %s", stale.Code, stale.Body.String())
	}
	current := decodeAccountTestData[knowledgeEntity](t, stale)
	if current.Title != "Changed" || current.Content != "Keep content" {
		t.Fatalf("conflict missing current data: %#v", current)
	}
	staleDelete := accountTestRequest(t, handler, "DELETE", path+fmt.Sprintf("?expectedRevision=%d", first.Entity.Revision), "", cookies)
	if staleDelete.Code != 409 {
		t.Fatalf("stale deletion accepted: %d", staleDelete.Code)
	}
	eventCreate := accountTestRequest(t, handler, "POST", root+"/events", `{"title":"Scene","type":"social","sceneText":"Keep scene","tags":["keep"]}`, cookies)
	if eventCreate.Code != 201 {
		t.Fatal(eventCreate.Code, eventCreate.Body.String())
	}
	event := decodeAccountTestData[worldEventResult](t, eventCreate)
	eventPath := root + "/events/" + event.Event.ID
	eventPatch := accountTestRequest(t, handler, "PATCH", eventPath, fmt.Sprintf(`{"title":"New scene title","expectedRevision":%d}`, event.Event.Revision), cookies)
	if eventPatch.Code != 200 {
		t.Fatal(eventPatch.Code, eventPatch.Body.String())
	}
	eventSaved := decodeAccountTestData[worldEventResult](t, eventPatch)
	if eventSaved.Event.SceneText != "Keep scene" || len(eventSaved.Event.Tags) != 1 {
		t.Fatal("event PATCH erased omitted fields")
	}
	eventStale := accountTestRequest(t, handler, "PATCH", eventPath, fmt.Sprintf(`{"summary":"Stale","expectedRevision":%d}`, event.Event.Revision), cookies)
	if eventStale.Code != 409 {
		t.Fatal("stale event update accepted")
	}
	eventDelete := accountTestRequest(t, handler, "DELETE", eventPath+fmt.Sprintf("?expectedRevision=%d", event.Event.Revision), "", cookies)
	if eventDelete.Code != 409 {
		t.Fatal("stale event deletion accepted")
	}
	// Continue the collection test from the latest campaign revision.
	saved.Campaign = eventSaved.Campaign
	// A campaign-level full collection cannot overwrite a newer shop list either.
	body = fmt.Sprintf(`{"expectedRevision":%d,"shops":[{"id":"shop-one","name":"First","inventory":[]}]}`, saved.Campaign.Revision)
	shops := accountTestRequest(t, handler, "PUT", root, body, cookies)
	if shops.Code != 200 {
		t.Fatalf("shops %d %s", shops.Code, shops.Body.String())
	}
	staleShops := accountTestRequest(t, handler, "PATCH", root, fmt.Sprintf(`{"expectedRevision":%d,"shops":[]}`, saved.Campaign.Revision), cookies)
	if staleShops.Code != 409 || len(decodeAccountTestData[campaignData](t, staleShops).Shops) != 1 {
		t.Fatalf("shop loss: %d %s", staleShops.Code, staleShops.Body.String())
	}
	other := registerAccountTestUser(t, handler, "authoring-other")
	forbidden := accountTestRequest(t, handler, "PATCH", path, body, other)
	if forbidden.Code != 404 {
		t.Fatalf("cross-owner response %d", forbidden.Code)
	}
}

func TestAuthoringConcurrentWritersOnlyOnePersists(t *testing.T) {
	store, campaign := newOrdinaryMutationTestStore(t)
	created, err := store.createEntity(campaign.ID, createEntityInput{Kind: "lore", Title: "Base", Content: "Untouched"})
	if err != nil {
		t.Fatal(err)
	}
	revision := created.Entity.Revision
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, title := range []string{"Editor A", "Editor B"} {
		wg.Add(1)
		go func(title string) {
			defer wg.Done()
			_, err := store.updateEntity(campaign.ID, created.Entity.ID, createEntityInput{ExpectedRevision: &revision, Kind: "lore", Title: title, Content: "Untouched"})
			results <- err
		}(title)
	}
	wg.Wait()
	close(results)
	wins, conflicts := 0, 0
	for err := range results {
		if err == nil {
			wins++
		} else if _, ok := err.(*authoringConflict); ok {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if wins != 1 || conflicts != 1 {
		t.Fatalf("wins=%d conflicts=%d", wins, conflicts)
	}
	raw, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	var disk storageState
	if err = json.Unmarshal(raw, &disk); err != nil {
		t.Fatal(err)
	}
	for _, c := range disk.Campaigns {
		if c.ID == campaign.ID {
			_, _, e := findEntityInCampaign(&c, created.Entity.ID)
			if e.Revision != revision+1 || e.Content != "Untouched" {
				t.Fatalf("durable state %#v", e)
			}
		}
	}
}
