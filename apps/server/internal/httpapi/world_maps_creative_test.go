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
	// Replay the upload optimizer's WebP output through the real save route.
	webp, readErr := os.ReadFile("testdata/creative-preview.webp")
	if readErr != nil {
		t.Fatal(readErr)
	}
	if err := os.WriteFile(filepath.Join(dir, "canvas.webp"), webp, 0600); err != nil {
		t.Fatal(err)
	}
	input["imageUrl"] = "/uploads/" + owner.ID + "/" + campaign.ID + "/canvas.webp"
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
	pngBytes.Reset()
	_ = png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 2000, 1500)))
	_ = os.WriteFile(filepath.Join(dir, "canvas.png"), pngBytes.Bytes(), 0600)
	v2 := `{"version":2,"width":2000,"height":1500,"feetPerCell":5,"mapType":"city","surface":"cobble","background":"#e9e4d8","grid":true,"style":"classic","wallWidth":5,"gridSize":50,"floorColor":"#faf7ed","wallColor":"#35352f","hatching":true,"layers":[{"id":"dungeon","name":"Комнаты","visible":true,"locked":false,"opacity":0.75}],"items":[{"id":"prop","kind":"asset","assetId":"altar","layerId":"dungeon","x":200,"y":300,"w":90,"h":60,"rotation":45,"color":"#345b38","flipX":true},{"id":"picture","kind":"image","imageUrl":"IMAGE","layerId":"dungeon","x":500,"y":500,"w":100,"h":60,"rotation":0,"color":"#ffffff"}]}`
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
	if m.Creative != scene || m.Revision != 3 || m.Title != "Обновлённая карта" || m.Provider != "creative" || m.Scale != "city" || m.Width != 2000 || m.Height != 1500 {
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

func TestCreativeOutdoorValidation(t *testing.T) {
	base := creativeScene{Version: 2, MapType: "village", Surface: "grass", Background: "#819061", Layers: []creativeLayer{{ID: "terrain", Name: "Земля", Visible: true, Opacity: 1}}, Items: []creativeItem{}}
	for _, kind := range []string{"terrain", "road", "river"} {
		base.Items = append(base.Items, creativeItem{ID: kind, Kind: kind, LayerID: "terrain", Material: "earth", X: 20, Y: 20, W: 100, H: 100, Color: "#ffffff", Points: [][]float64{{20, 20}, {300, 300}}})
	}
	check := func(wantError bool) {
		t.Helper()
		raw, _ := json.Marshal(base)
		if err := validateCreative(string(raw)); (err != nil) != wantError {
			t.Fatalf("validate=%v, wantError=%v", err, wantError)
		}
	}
	check(false)
	for _, material := range []string{"forest-path", "mud", "flagstone", "brick-road"} {
		base.Surface = material
		base.Items[1].Material = material
		check(false)
	}
	base.MapType = "unknown"
	check(true)
	base.MapType = "wilderness"
	base.Surface = "lava"
	check(true)
	base.Surface = "snow"
	base.Items[0].Material = "unknown"
	check(true)
	base.Items[0].Material = "sand"
	base.Items[1].Points = nil
	check(true)
	base.Items[1].Points = [][]float64{{20, 20}, {40, 40}}
	check(false)
}

func TestCreativeMapDimensions(t *testing.T) {
	scene := creativeScene{Version: 1, Background: "#eeeeee", Items: []creativeItem{}}
	check := func(want bool) {
		t.Helper()
		b, _ := json.Marshal(scene)
		if err := validateCreative(string(b)); (err == nil) != want {
			t.Fatalf("valid=%v error=%v", want, err)
		}
	}
	check(true)
	width, height, feet := 2400, 800, 5.0
	scene.Width = &width
	scene.Height = &height
	scene.FeetPerCell = &feet
	scene.Items = []creativeItem{{ID: "far", Kind: "tree", X: 2300, Y: 700, W: 50, H: 50, Color: "#ffffff"}}
	check(true)
	width = 1600
	check(false)
	width = 2400
	height = 600
	check(false)
	height = 800
	feet = 0
	check(false)
	feet = 5
	width = 3201
	check(false)
	width = 0
	check(false)
}

func TestCreativePortalValidation(t *testing.T) {
	s := creativeScene{Version: 2, Background: "#ffffff", Layers: []creativeLayer{{ID: "dungeon", Name: "Rooms", Visible: true, Opacity: 1}}, Items: []creativeItem{{ID: "door", Kind: "portal", X: 100, Y: 100, W: 32, H: 32, Color: "#ffffff", LayerID: "dungeon", Points: [][]float64{{100, 100}, {150, 100}}}}}
	check := func(want bool) {
		t.Helper()
		b, _ := json.Marshal(s)
		if err := validateCreative(string(b)); (err == nil) != want {
			t.Fatalf("portal validation: %v; want valid=%v", err, want)
		}
	}
	check(true)
	for _, points := range [][][]float64{nil, {{100, 100}}, {{100, 100}, {100, 100}}, {{100, 100}, {101, 100}}, {{100, 100}, {150, 100}, {200, 100}}, {{100}, {150, 100}}, {{100, 100}, {4000, 100}}} {
		s.Items[0].Points = points
		check(false)
	}
	s.Items[0].Points = [][]float64{{100, 100}, {150, 100}}
	s.Items[0].Rotation = 45
	check(false)
}
