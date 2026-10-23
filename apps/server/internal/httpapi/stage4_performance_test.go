package httpapi

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStage4StaticRepresentations(t *testing.T) {
	dir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(dir, "assets"), 0700)
	content := []byte(strings.Repeat("const text='Проверка';", 100))
	file := filepath.Join(dir, "assets", "index-abcdefgh.js")
	_ = os.WriteFile(file, content, 0600)
	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>test</html>"), 0600)
	var compressed bytes.Buffer
	gz := gzip.NewWriter(&compressed)
	_, _ = gz.Write(content)
	_ = gz.Close()
	_ = os.WriteFile(file+".gz", compressed.Bytes(), 0600)
	handler, err := newWebAppHandler(dir)
	if err != nil {
		t.Fatal(err)
	}
	request := func(encoding, etag string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/assets/index-abcdefgh.js", nil)
		r.Header.Set("Accept-Encoding", encoding)
		r.Header.Set("If-None-Match", etag)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	w := request("gzip", "")
	if w.Code != 200 || w.Header().Get("Content-Encoding") != "gzip" || !strings.Contains(w.Header().Get("Cache-Control"), "immutable") {
		t.Fatal(w.Code, w.Header())
	}
	reader, _ := gzip.NewReader(w.Body)
	decoded, _ := io.ReadAll(reader)
	if !bytes.Equal(decoded, content) {
		t.Fatal("gzip content mismatch")
	}
	if request("gzip", w.Header().Get("ETag")).Code != 304 {
		t.Fatal("missing 304")
	}
	if request("gzip;q=0", "").Header().Get("Content-Encoding") != "" {
		t.Fatal("q=0 ignored")
	}
	page := httptest.NewRecorder()
	handler.ServeHTTP(page, httptest.NewRequest("GET", "/campaigns/example/locations", nil))
	if page.Code != 200 || page.Header().Get("Cache-Control") != "no-cache" {
		t.Fatal("SPA/cache contract", page.Code)
	}
}
func TestStage4CatalogCursor(t *testing.T) {
	catalog := &itemCatalog{initialized: true}
	for n := 0; n < 125; n++ {
		catalog.cache.Entries = append(catalog.cache.Entries, itemCatalogCacheEntry{ID: fmt.Sprint(n), Title: fmt.Sprintf("Товар %03d", n), Category: "weapon", Source: itemCatalogEquipment})
	}
	q := itemCatalogQuery{Limit: 48, Category: "weapon"}
	seen := map[string]bool{}
	for {
		page := catalog.browse(q)
		if page.Total != 125 || len(page.Items) > 48 || page.CursorInvalid {
			t.Fatal(page.Total, len(page.Items))
		}
		for _, item := range page.Items {
			if seen[item.ID] {
				t.Fatal("duplicate", item.ID)
			}
			seen[item.ID] = true
		}
		if page.NextCursor == "" {
			break
		}
		q.Cursor = page.NextCursor
	}
	if len(seen) != 125 {
		t.Fatal("lost rows")
	}
	q.Cursor = "broken"
	if !catalog.browse(q).CursorInvalid {
		t.Fatal("invalid cursor accepted")
	}
	q.Cursor = catalog.browse(itemCatalogQuery{Limit: 48}).NextCursor
	q.Query = "other"
	if !catalog.browse(q).CursorInvalid {
		t.Fatal("cross-filter cursor accepted")
	}
}
func TestStage4ProjectionAndDirectory(t *testing.T) {
	base := campaignData{ID: "test", Revision: 1, Title: "Original", Locations: []knowledgeEntity{}, WorldMaps: []worldMapDocument{{ID: "m", Creative: strings.Repeat("large", 1000)}}}
	next := base
	next.Revision = 2
	next.Title = "Changed"
	writer := &workspaceResponseWriter{base: base}
	raw, _ := json.Marshal(writer.project(createEntityResult{Campaign: next}))
	if bytes.Contains(raw, []byte("large")) || !bytes.Contains(raw, []byte("__baseRevision")) {
		t.Fatal(string(raw))
	}
	t.Logf("mutation full=%d delta=%d bytes", len(mustStage4JSON(createEntityResult{Campaign: next})), len(raw))
	for i := 0; i < 110; i++ {
		base.Locations = append(base.Locations, knowledgeEntity{ID: fmt.Sprint(i), Kind: "location", Title: fmt.Sprint(i), Category: "City", Content: strings.Repeat("secret", 500)})
	}
	w := httptest.NewRecorder()
	serveDirectory(w, httptest.NewRequest("GET", "/?kind=location&tab=Города&limit=48", nil), base)
	var response struct {
		Data struct {
			Items []knowledgeEntity `json:"items"`
			Total int               `json:"total"`
			Next  string            `json:"nextCursor"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &response)
	if w.Code != 200 || len(response.Data.Items) != 48 || response.Data.Total != 110 || response.Data.Next == "" || bytes.Contains(w.Body.Bytes(), []byte("secret")) {
		t.Fatal("directory contract", w.Code)
	}
	full := mustStage4JSON(base)
	summary := w.Body.Bytes()
	t.Logf("campaign=%d directory page=%d bytes", len(full), len(summary))
}
func mustStage4JSON(v any) []byte { b, _ := json.Marshal(v); return b }
func TestStage4ConditionalOwnerSnapshot(t *testing.T) {
	handler := newAccountTestServer(t)
	owner := registerAccountTestUser(t, handler, "perf-owner")
	other := registerAccountTestUser(t, handler, "perf-other")
	campaign := decodeAccountTestData[campaignData](t, accountTestRequest(t, handler, "POST", "/api/campaigns", `{"title":"Perf test","system":"5e"}`, owner))
	path := "/api/campaigns/" + campaign.ID + "/combat-snapshot"
	for _, cookies := range [][]*http.Cookie{nil, other} {
		w := accountTestRequest(t, handler, "GET", path, "", cookies)
		if w.Code != 401 && w.Code != 404 {
			t.Fatal("snapshot exposed", w.Code)
		}
	}
	first := accountTestRequest(t, handler, "GET", path, "", owner)
	if first.Code != 200 || first.Header().Get("ETag") == "" || strings.Contains(first.Body.String(), "locations") {
		t.Fatal(first.Code, first.Body.String())
	}
	r := httptest.NewRequest("GET", path, nil)
	for _, cookie := range owner {
		r.AddCookie(cookie)
	}
	r.Header.Set("If-None-Match", first.Header().Get("ETag"))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 304 || w.Body.Len() != 0 {
		t.Fatal(w.Code)
	}
}
func TestStage4MapSummaryThumbnail(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "thumb-owner", "thumb-campaign")
	_ = os.MkdirAll(dir, 0700)
	file := filepath.Join(dir, "map.png")
	original := mapFixturePNG()
	_ = os.WriteFile(file, original, 0600)
	srv := &server{uploadDir: root}
	user := authUser{ID: "thumb-owner"}
	campaign := campaignData{ID: "thumb-campaign"}
	m := worldMapDocument{ID: "map", ImageURL: "/uploads/thumb-owner/thumb-campaign/map.png", Prompt: "private prompt", Creative: "private geometry"}
	summary := mustStage4JSON(mapSummary(campaign.ID, m))
	if bytes.Contains(summary, []byte("private")) {
		t.Fatal("summary leaked document")
	}
	w := httptest.NewRecorder()
	srv.serveMapThumbnail(w, httptest.NewRequest("GET", "/thumbnail", nil), user, campaign, m)
	if w.Code != 200 || !strings.HasPrefix(w.Header().Get("Cache-Control"), "private") {
		t.Fatal(w.Code, w.Body.String())
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(w.Body.Bytes()))
	if err != nil || config.Width > 320 || config.Height > 240 {
		t.Fatal(config, err)
	}
	after, _ := os.ReadFile(file)
	if !bytes.Equal(after, original) {
		t.Fatal("original changed")
	}
}
