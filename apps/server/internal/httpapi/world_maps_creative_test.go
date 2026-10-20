package httpapi

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreativeWorldMapPersistenceAndAccess(t *testing.T) {
	file := filepath.Join(t.TempDir(), "store.json")
	store, err := newCampaignStore(file)
	if err != nil {
		t.Fatal(err)
	}
	owner, _ := store.createUser("artist", "password123")
	other, _ := store.createUser("other", "password123")
	campaign, _ := store.createCampaignForUser(owner.ID, createCampaignInput{Title: "Canvas"})
	uploads := t.TempDir()
	dir := filepath.Join(uploads, owner.ID, campaign.ID)
	_ = os.MkdirAll(dir, 0700)
	var pngBytes bytes.Buffer
	_ = png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 1600, 1000)))
	_ = os.WriteFile(filepath.Join(dir, "canvas.png"), pngBytes.Bytes(), 0600)
	handler, err := NewServer(Options{DataFile: file, UploadDir: uploads})
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, route, body, origin string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost"+route, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	cookie := call("POST", "/api/auth/login", `{"username":"artist","password":"password123"}`, "http://localhost", nil).Result().Cookies()[0]
	otherCookie := call("POST", "/api/auth/login", `{"username":"other","password":"password123"}`, "http://localhost", nil).Result().Cookies()[0]
	_ = other
	scene := `{"version":1,"background":"#777568","grid":true,"items":[{"id":"tree-1","kind":"tree","x":200,"y":300,"w":60,"h":60,"rotation":20,"color":"#345b38"}]}`
	input := map[string]any{"id": "manual-map-0000001", "title": "Ручная карта", "revision": 0, "imageUrl": "/uploads/" + owner.ID + "/" + campaign.ID + "/canvas.png", "creative": scene}
	body := func() string { b, _ := json.Marshal(input); return string(b) }
	base := "/api/campaigns/" + campaign.ID + "/world-maps"
	for _, tc := range []struct {
		cookie *http.Cookie
		origin string
		status int
	}{{nil, "http://localhost", 401}, {otherCookie, "http://localhost", 404}, {cookie, "https://evil.invalid", 403}} {
		w := call("POST", base+"/creative", body(), tc.origin, tc.cookie)
		if w.Code != tc.status {
			t.Fatalf("access: %d %s", w.Code, w.Body.String())
		}
	}
	w := call("POST", base+"/creative", body(), "http://localhost", cookie)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = call("POST", base+"/creative", body(), "http://localhost", cookie)
	if w.Code != 409 {
		t.Fatal("stale write accepted", w.Code)
	}
	input["revision"] = 1
	input["title"] = "Обновлённая карта"
	w = call("POST", base+"/creative", body(), "http://localhost", cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	input["revision"] = 2
	input["imageUrl"] = "/uploads/foreign/canvas.png"
	if w = call("POST", base+"/creative", body(), "http://localhost", cookie); w.Code != 400 {
		t.Fatal("foreign reference accepted")
	}
	restored, err := newCampaignStore(file)
	if err != nil {
		t.Fatal(err)
	}
	c, err := restored.getCampaignForUser(owner.ID, campaign.ID)
	if err != nil || len(c.WorldMaps) != 1 {
		t.Fatal("missing map", err)
	}
	m := c.WorldMaps[0]
	if m.Creative != scene || m.Revision != 2 || m.Title != "Обновлённая карта" || m.Provider != "creative" {
		t.Fatal("roundtrip lost editable scene", m)
	}
	for _, bad := range []string{`{}`, strings.Replace(scene, `"tree"`, `"script"`, 1), strings.Replace(scene, `"w":60`, `"w":-1`, 1)} {
		if validateCreative(bad) == nil {
			t.Fatal("invalid scene accepted")
		}
	}
}
