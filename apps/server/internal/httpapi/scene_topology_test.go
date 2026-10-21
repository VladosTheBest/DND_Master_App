package httpapi

import (
	"encoding/json"
	"math"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSceneEnvironmentRejectsInvalidValues(t *testing.T) {
	valid := sessionMapLevelDocument{Columns: 30, Rows: 20, Weather: "storm", Darkness: .6, Lights: []sceneLight{{ID: "torch", X: .2, Y: .3, Bright: 10, Dim: 20, Color: "#ffbb77"}}}
	if err := validateSceneEnvironment(valid); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*sessionMapLevelDocument){func(l *sessionMapLevelDocument) { l.Darkness = math.NaN() }, func(l *sessionMapLevelDocument) { l.Weather = "arbitrary-script" }, func(l *sessionMapLevelDocument) { l.Rows = 0 }, func(l *sessionMapLevelDocument) { l.Lights[0].X = 1.01 }, func(l *sessionMapLevelDocument) { l.Lights[0].Dim = 2 }, func(l *sessionMapLevelDocument) { l.Lights[0].Color = "javascript:" }, func(l *sessionMapLevelDocument) { l.Lights = append(l.Lights, l.Lights[0]) }} {
		copy := valid
		copy.Lights = append([]sceneLight{}, valid.Lights...)
		mutate(&copy)
		if validateSceneEnvironment(copy) == nil {
			t.Fatal("accepted invalid environment")
		}
	}
}

func TestSceneDoorVisualValidationAndCodec(t *testing.T) {
	valid := sceneDoorVisual{Style: "iron", Direction: -1, Double: true, Strength: 1, Duration: 700}
	level := sessionMapLevelDocument{Walls: []publicDisplayWall{{Kind: "door", DoorVisual: &valid}}}
	if err := validateSceneEnvironment(level); err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(level)
	var copy sessionMapLevelDocument
	if json.Unmarshal(raw, &copy) != nil || *copy.Walls[0].DoorVisual != valid {
		t.Fatal("door visual lost in storage codec")
	}
	for _, change := range []func(*sceneDoorVisual){
		func(v *sceneDoorVisual) { v.Style = "https://outside/door.png" },
		func(v *sceneDoorVisual) { v.Direction = 0 },
		func(v *sceneDoorVisual) { v.Strength = math.NaN() },
		func(v *sceneDoorVisual) { v.Duration = 6000 },
	} {
		bad := valid
		change(&bad)
		level.Walls[0].DoorVisual = &bad
		if validateSceneEnvironment(level) == nil {
			t.Fatal("invalid door accepted")
		}
	}
	level.Walls[0].DoorVisual = &valid
	level.Walls[0].Kind = "wall"
	if validateSceneEnvironment(level) == nil {
		t.Fatal("door visual on solid wall")
	}
}

func TestWebSceneUploadJobScopeAndApply(t *testing.T) {
	t.Setenv("SHADOW_EDGE_IMAGE_OPTIMIZER", "off")
	m, c, _ := aiFixture(t)
	m.srv.uploadDir = t.TempDir()
	jobs, err := newAIJobManager(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	m.srv.aiJobs = jobs
	dir := filepath.Join(m.srv.uploadDir, sanitizeUploadPathSegment(c.OwnerID), sanitizeUploadPathSegment(c.CampaignID))
	if err = os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(dir, "input.png"), mapFixturePNG(), 0600); err != nil {
		t.Fatal(err)
	}
	login := httptest.NewRecorder()
	m.srv.auth.handleLogin(login, httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"username":"foundry-gm","password":"test-password"}`)))
	cookies := login.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("fixture login")
	}
	call := func(method, path, body string, authenticated bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/campaigns/"+c.CampaignID+"/scenes/ai"+path, strings.NewReader(body))
		if authenticated {
			r.AddCookie(cookies[0])
		}
		w := httptest.NewRecorder()
		m.srv.handleCampaignByPath(w, r)
		return w
	}
	if w := call("POST", "", "{}", false); w.Code != 401 {
		t.Fatal("anonymous scene request")
	}
	input := foundrySceneInput{RequestID: "web-scene-test-request", Title: "Uploaded map", Columns: 30, Rows: 20, Distance: 5, Weather: "snow", ReferenceURL: "/uploads/" + sanitizeUploadPathSegment(c.OwnerID) + "/" + sanitizeUploadPathSegment(c.CampaignID) + "/input.png"}
	raw, _ := json.Marshal(input)
	w := call("POST", "", string(raw), true)
	if w.Code != 202 {
		t.Fatal(w.Body.String())
	}
	var response struct {
		Data aiJob `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &response)
	id := response.Data.ID
	deadline := time.Now().Add(10 * time.Second)
	for {
		w = call("GET", "/"+id, "", true)
		json.Unmarshal(w.Body.Bytes(), &response)
		if response.Data.State == "succeeded" {
			break
		}
		if response.Data.State == "failed" || time.Now().After(deadline) {
			t.Fatal(w.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if w = foundryCall(t, m, "GET", "v1/scenes/ai/"+id, nil); w.Code != 404 {
		t.Fatal("module connection read web-only job")
	}
	for i := 0; i < 2; i++ {
		w = call("POST", "/"+id+"/apply", "{}", true)
		if w.Code != 200 && w.Code != 201 {
			t.Fatal(w.Body.String())
		}
	}
	campaign, _ := m.srv.store.getCampaignForUser(c.OwnerID, c.CampaignID)
	if len(campaign.SessionMaps) != 1 || campaign.SessionMaps[0].Levels[0].Weather != "snow" {
		t.Fatal("upload scene not persisted exactly once")
	}
	input.RequestID = "web-scene-foreign-file"
	input.ReferenceURL = "/uploads/other/other/input.png"
	raw, _ = json.Marshal(input)
	if w = call("POST", "", string(raw), true); w.Code != 400 {
		t.Fatal("foreign asset accepted")
	}
}
