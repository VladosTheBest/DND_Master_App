package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestCustomItemsHandlerRollsBackFailedDurableWrite(t *testing.T) {
	store, _ := newOrdinaryMutationTestStore(t)
	user, err := store.createUser("items-rollback", "password123")
	if err != nil {
		t.Fatal(err)
	}
	campaign, err := store.createCampaignForUser(user.ID, createCampaignInput{Title: "Rollback items", System: "5e"})
	if err != nil {
		t.Fatal(err)
	}
	srv := &server{store: store}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		srv.handleCustomItems(w, r, authUser{ID: user.ID}, campaign.ID, strings.Split(strings.TrimPrefix(r.URL.Path, "/api/campaigns/"), "/"))
	})
	before := snapshotOrdinaryStoreState(t, store)
	raw, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	injectOrdinaryStoreSaveFailure(store)
	item := customCampaignItem{ID: "custom-rollback", Name: "Retained draft", Category: "gear", Description: "Must not appear before durable success"}
	response := itemsRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/custom-items", map[string]any{"item": item}, nil)
	if response.Code != 503 {
		t.Fatal(response.Code, response.Body.String())
	}
	if !reflect.DeepEqual(before, snapshotOrdinaryStoreState(t, store)) {
		t.Fatal("failed item save changed cache")
	}
	after, err := os.ReadFile(store.path)
	if err != nil || !bytes.Equal(raw, after) {
		t.Fatal("failed item save changed durable file")
	}
	clearOrdinaryStoreSaveFailure(store)
	response = itemsRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/custom-items", map[string]any{"item": item}, nil)
	if response.Code != 200 || len(decodeAccountTestData[customItemsDocument](t, response).Items) != 1 {
		t.Fatal("retry did not persist once", response.Body.String())
	}
	before = snapshotOrdinaryStoreState(t, store)
	raw, err = os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	injectOrdinaryStoreSaveFailure(store)
	item.ID = "custom-import-rollback"
	input := map[string]any{"items": []customCampaignItem{item}, "commit": true, "expectedRevision": 1}
	response = itemsRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/custom-items/import", input, nil)
	if response.Code != 503 || !reflect.DeepEqual(before, snapshotOrdinaryStoreState(t, store)) {
		t.Fatal("failed import changed items or receipt", response.Code)
	}
	after, err = os.ReadFile(store.path)
	if err != nil || !bytes.Equal(raw, after) {
		t.Fatal("failed import changed durable file")
	}
	clearOrdinaryStoreSaveFailure(store)
	response = itemsRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/custom-items/import", input, nil)
	if response.Code != 200 || len(decodeAccountTestData[customItemsDocument](t, response).Items) != 2 {
		t.Fatal("import retry was skipped by an uncommitted receipt", response.Body.String())
	}
}

func itemsRequest(t *testing.T, handler http.Handler, method, path string, body any, cookies []*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
	r.Header.Set("Origin", "http://example.com")
	r.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		r.AddCookie(c)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}
func TestCustomItemsOwnershipVersionsAndMigration(t *testing.T) {
	handler := newAccountTestServer(t)
	alice := registerAccountTestUser(t, handler, "items-alice")
	bob := registerAccountTestUser(t, handler, "items-bob")
	c := decodeAccountTestData[campaignData](t, accountTestRequest(t, handler, "POST", "/api/campaigns", `{"title":"Items","system":"5e"}`, alice))
	root := "/api/campaigns/" + c.ID + "/custom-items"
	item := customCampaignItem{ID: "custom-old", Name: "Server sword", Category: "weapon", Description: "Kept", Source: "custom"}
	created := itemsRequest(t, handler, "POST", root, map[string]any{"item": item}, alice)
	if created.Code != 200 {
		t.Fatal(created.Code, created.Body.String())
	}
	first := decodeAccountTestData[customItemsDocument](t, created)
	if len(first.Items) != 1 || first.Items[0].Revision != 1 {
		t.Fatal(first)
	}
	// Repeating a create after a lost response is safe.
	retry := itemsRequest(t, handler, "POST", root, map[string]any{"item": item}, alice)
	if retry.Code != 200 || decodeAccountTestData[customItemsDocument](t, retry).Revision != first.Revision {
		t.Fatal("create retry changed data")
	}
	for _, cookies := range [][]*http.Cookie{nil, bob} {
		r := itemsRequest(t, handler, "GET", root, nil, cookies)
		if r.Code != 401 && r.Code != 404 {
			t.Fatal("owner leak", r.Code)
		}
	}
	legacy := item
	legacy.Name = "Local sword"
	addition := item
	addition.ID = "custom-new"
	addition.Name = "Shield"
	rows := []customCampaignItem{legacy, addition, addition}
	shopBody := map[string]any{"expectedRevision": c.Revision, "shops": []campaignShop{{ID: "shop-local", Name: "Shop", Inventory: []shopInventoryItem{{ID: "stock-local", ItemID: legacy.ID, ItemSource: "custom", ItemName: legacy.Name, Category: "weapon", PriceMode: "manual", Note: "Keep note"}}}}}
	shopJSON, _ := json.Marshal(shopBody)
	shopSave := accountTestRequest(t, handler, "PUT", "/api/campaigns/"+c.ID, string(shopJSON), alice)
	if shopSave.Code != 200 {
		t.Fatal(shopSave.Code, shopSave.Body.String())
	}

	preview := itemsRequest(t, handler, "POST", root+"/import", map[string]any{"items": rows}, alice)
	if preview.Code != 200 {
		t.Fatal(preview.Code, preview.Body.String())
	}
	plan := decodeAccountTestData[customItemsImport](t, preview)
	if len(plan.Additions) != 2 || plan.Skipped != 1 || plan.Renamed[item.ID] == "" {
		t.Fatal(plan)
	}
	before := decodeAccountTestData[customItemsDocument](t, itemsRequest(t, handler, "GET", root, nil, alice))
	if len(before.Items) != 1 {
		t.Fatal("preview wrote data")
	}
	bad := itemsRequest(t, handler, "POST", root+"/import", map[string]any{"items": rows, "commit": true, "expectedRevision": 0}, alice)
	if bad.Code != 409 {
		t.Fatal("stale migration accepted", bad.Code)
	}
	commit := itemsRequest(t, handler, "POST", root+"/import", map[string]any{"items": rows, "commit": true, "expectedRevision": plan.Revision, "expectedCampaignRevision": plan.CampaignRevision}, alice)
	if commit.Code != 200 {
		t.Fatal(commit.Code, commit.Body.String())
	}
	doc := decodeAccountTestData[customItemsDocument](t, commit)
	if doc.Campaign == nil || doc.Campaign.Shops[0].Inventory[0].ItemID != plan.Renamed[item.ID] || doc.Campaign.Shops[0].Inventory[0].Note != "Keep note" {
		t.Fatal("shop reference migration lost snapshot or link")
	}
	if len(doc.Items) != 3 || doc.Items[0].Name != "Server sword" {
		t.Fatal("collision overwrote server", doc)
	}
	// A different device sees the durable server collection without localStorage.
	otherDevice := decodeAccountTestData[customItemsDocument](t, itemsRequest(t, handler, "GET", root, nil, alice))
	if doc.Revision != otherDevice.Revision || !reflect.DeepEqual(doc.Items, otherDevice.Items) {
		t.Fatal("device mismatch")
	}
	updated := doc.Items[0]
	updated.Description = "New text"
	save := itemsRequest(t, handler, "PUT", root+"/"+updated.ID, map[string]any{"item": updated, "expectedRevision": updated.Revision}, alice)
	if save.Code != 200 {
		t.Fatal(save.Code, save.Body.String())
	}
	stale := itemsRequest(t, handler, "PUT", root+"/"+updated.ID, map[string]any{"item": updated, "expectedRevision": updated.Revision}, alice)
	if stale.Code != 409 || decodeAccountTestData[customCampaignItem](t, stale).Description != "New text" {
		t.Fatal("stale overwrite accepted")
	}
	staleDelete := itemsRequest(t, handler, "DELETE", root+"/"+updated.ID, map[string]any{"expectedRevision": updated.Revision}, alice)
	if staleDelete.Code != 409 {
		t.Fatal("stale delete accepted")
	}
	removed := itemsRequest(t, handler, "DELETE", root+"/custom-new", map[string]any{"expectedRevision": 1}, alice)
	if removed.Code != 200 {
		t.Fatal(removed.Body.String())
	}
	replay := itemsRequest(t, handler, "POST", root+"/import", map[string]any{"items": rows, "commit": true, "expectedRevision": plan.Revision, "expectedCampaignRevision": plan.CampaignRevision}, alice)
	if replay.Code != 200 || len(decodeAccountTestData[customItemsDocument](t, replay).Items) != 2 {
		t.Fatal("migration replay resurrected deleted item", replay.Body.String())
	}
	invalid := rows
	invalid[1].Name = ""
	fail := itemsRequest(t, handler, "POST", root+"/import", map[string]any{"items": invalid, "commit": true, "expectedRevision": 1}, alice)
	if fail.Code != 400 {
		t.Fatal("invalid import accepted")
	}
	req := httptest.NewRequest("POST", root, strings.NewReader(`{}`))
	for _, cookie := range alice {
		req.AddCookie(cookie)
	}
	req.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatal("bad origin accepted")
	}
}

func TestCustomItemsDurableCodecAndRollback(t *testing.T) {
	store, c := newOrdinaryMutationTestStore(t)
	item := customCampaignItem{ID: "custom-durable", Revision: 4, Source: "custom", Name: "Retained", Category: "gear", Description: "Exact text"}
	store.mu.Lock()
	for i := range store.data.Campaigns {
		if store.data.Campaigns[i].ID == c.ID {
			store.data.Campaigns[i].CustomItems = []customCampaignItem{item}
			store.data.Campaigns[i].CustomItemsRevision = 8
			store.data.Campaigns[i].CustomItemImports = map[string]bool{"receipt": true}
		}
	}
	err := store.saveLocked()
	store.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(store.path)
	if err != nil {
		t.Fatal(err)
	}
	var disk storageState
	if err = json.Unmarshal(raw, &disk); err != nil {
		t.Fatal(err)
	}
	meta, records, err := splitCloudState(disk)
	if err != nil {
		t.Fatal(err)
	}
	joined, err := joinCloudState(meta, records)
	if err != nil {
		t.Fatal(err)
	}
	if cloudStateDigest(joined) != cloudStateDigest(disk) {
		t.Fatal("custom item/receipt lost in PostgreSQL codec")
	}
	// Exercise the same handler/save path with a failing durable write.
	assertOrdinaryMutationRollsBack(t, store, func() error {
		store.mu.Lock()
		defer store.mu.Unlock()
		old, err := cloneStorageState(store.data)
		if err != nil {
			return err
		}
		for i := range store.data.Campaigns {
			if store.data.Campaigns[i].ID == c.ID {
				store.data.Campaigns[i].CustomItems = nil
			}
		}
		return store.saveMutationLocked(old)
	})
	found := false
	for _, restored := range joined.Campaigns {
		if restored.ID == c.ID {
			found = true
			if restored.CustomItemsRevision != 8 || !restored.CustomItemImports["receipt"] || len(restored.CustomItems) != 1 || !reflect.DeepEqual(restored.CustomItems[0], item) {
				t.Fatal("durable item or receipt changed")
			}
		}
	}
	if !found {
		t.Fatal("campaign missing from roundtrip")
	}
}

func TestCustomItemsAmbiguousShopReferenceRequiresChoice(t *testing.T) {
	handler := newAccountTestServer(t)
	cookies := registerAccountTestUser(t, handler, "item-reference-owner")
	created := accountTestRequest(t, handler, "POST", "/api/campaigns", `{"title":"References","system":"5e"}`, cookies)
	c := decodeAccountTestData[campaignData](t, created)
	root := "/api/campaigns/" + c.ID
	item := customCampaignItem{ID: "same-id", Name: "Same name", Category: "gear", Description: "Server description"}
	response := itemsRequest(t, handler, "POST", root+"/custom-items", map[string]any{"item": item}, cookies)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	shop := campaignShop{ID: "shop", Name: "Shop", Inventory: []shopInventoryItem{{ID: "stock", ItemID: item.ID, ItemSource: "custom", ItemName: item.Name, PriceMode: "manual", Note: "Preserve", Category: "gear"}}}
	body, _ := json.Marshal(map[string]any{"expectedRevision": c.Revision, "shops": []campaignShop{shop}})
	response = accountTestRequest(t, handler, "PUT", root, string(body), cookies)
	if response.Code != 200 {
		t.Fatal(response.Code, response.Body.String())
	}
	item.Description = "Local description"
	rows := []customCampaignItem{item}
	previewResponse := itemsRequest(t, handler, "POST", root+"/custom-items/import", map[string]any{"items": rows}, cookies)
	if previewResponse.Code != 200 {
		t.Fatal(previewResponse.Body.String())
	}
	preview := decodeAccountTestData[customItemsImport](t, previewResponse)
	if len(preview.ReferenceChoices) != 1 || len(preview.ReferenceChanges) != 0 || len(preview.Additions) != 1 {
		t.Fatal("ambiguous link guessed", preview)
	}
	input := map[string]any{"items": rows, "commit": true, "expectedRevision": preview.Revision, "expectedCampaignRevision": preview.CampaignRevision}
	response = itemsRequest(t, handler, "POST", root+"/custom-items/import", input, cookies)
	if response.Code != 400 {
		t.Fatal("missing explicit choice accepted", response.Code)
	}
	input["referenceChoices"] = map[string]string{recordKey("shop", "stock"): preview.Additions[0].ID}
	input["expectedCampaignRevision"] = -1
	response = itemsRequest(t, handler, "POST", root+"/custom-items/import", input, cookies)
	if response.Code != 409 {
		t.Fatal("stale shop snapshot accepted", response.Code)
	}
	input["expectedCampaignRevision"] = preview.CampaignRevision
	response = itemsRequest(t, handler, "POST", root+"/custom-items/import", input, cookies)
	if response.Code != 200 {
		t.Fatal(response.Code, response.Body.String())
	}
	result := decodeAccountTestData[customItemsDocument](t, response)
	if result.Campaign == nil || len(result.Items) != 2 || result.Campaign.Shops[0].Inventory[0].ItemID != preview.Additions[0].ID || result.Campaign.Shops[0].Inventory[0].Note != "Preserve" {
		t.Fatal("choice or snapshot lost", response.Body.String())
	}
}
