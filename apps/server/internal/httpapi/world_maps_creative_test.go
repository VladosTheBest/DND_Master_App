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
	// New-format fields and nested owned images must survive storage together.
	input["imageUrl"] = "/uploads/" + owner.ID + "/" + campaign.ID + "/canvas.png"
	v2 := `{"version":2,"background":"#e9e4d8","grid":true,"style":"classic","wallWidth":5,"gridSize":50,"floorColor":"#faf7ed","wallColor":"#35352f","hatching":true,"layers":[{"id":"dungeon","name":"Комнаты","visible":true,"locked":false,"opacity":0.75}],"items":[{"id":"prop","kind":"asset","assetId":"altar","layerId":"dungeon","x":200,"y":300,"w":90,"h":60,"rotation":45,"color":"#345b38","flipX":true},{"id":"picture","kind":"image","imageUrl":"IMAGE","layerId":"dungeon","x":500,"y":500,"w":100,"h":60,"rotation":0,"color":"#ffffff"}]}`
	scene = strings.Replace(v2, "IMAGE", input["imageUrl"].(string), 1)
	input["creative"] = strings.Replace(v2, "IMAGE", "/uploads/foreign/other/image.png", 1)
	if w = call("POST", base+"/creative", body(), "http://localhost", cookie); w.Code != 400 {
		t.Fatal("nested foreign image accepted", w.Code)
	}
	input["creative"] = scene
	if w = call("POST", base+"/creative", body(), "http://localhost", cookie); w.Code != 200 {
		t.Fatal("v2 save", w.Code, w.Body.String())
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
	if m.Creative != scene || m.Revision != 3 || m.Title != "Обновлённая карта" || m.Provider != "creative" {
		t.Fatal("roundtrip lost editable scene", m)
	}
	for _, bad := range []string{`{}`, strings.Replace(scene, `"altar"`, `"script"`, 1), strings.Replace(scene, `"w":90`, `"w":-1`, 1), strings.Replace(scene, `"opacity":0.75`, `"opacity":1.5`, 1), strings.Replace(scene, `"layerId":"dungeon"`, `"layerId":"missing"`, 1)} {
		if validateCreative(bad) == nil {
			t.Fatal("invalid scene accepted")
		}
	}
}

func TestCreativeWorldMapV2GeometryValidation(t *testing.T) {
	scene := creativeScene{Version: 2, Background: "#eeeeee", Grid: true, Layers: []creativeLayer{{ID: "floor", Name: "Floor", Visible: true, Opacity: 1}}, Items: []creativeItem{{ID: "polygon", Kind: "polygon", LayerID: "floor", X: 200, Y: 200, W: 100, H: 100, Color: "#eeeeee", Points: [][]float64{{100, 100}, {200, 100}, {200, 200}}}}}
	encode := func() string {
		b, err := json.Marshal(scene)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	if err := validateCreative(encode()); err != nil {
		t.Fatal(err)
	}
	scene.Items[0].Points = [][]float64{{100, 100}, {200, 100}}
	if validateCreative(encode()) == nil {
		t.Fatal("two-point polygon accepted")
	}
	scene.Items[0].Kind = "corridor"
	if err := validateCreative(encode()); err != nil {
		t.Fatal(err)
	}
	scene.Items[0].Points[1] = []float64{200, 100, 300}
	if validateCreative(encode()) == nil {
		t.Fatal("three-coordinate point accepted")
	}
	scene.Items[0].Points[1] = []float64{200, 1001}
	if validateCreative(encode()) == nil {
		t.Fatal("off-canvas point accepted")
	}
	scene.Items[0].Points[1] = []float64{200, 100}
	scene.Layers = append(scene.Layers, scene.Layers[0])
	if validateCreative(encode()) == nil {
		t.Fatal("duplicate layer accepted")
	}
}
