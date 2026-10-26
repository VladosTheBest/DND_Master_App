package httpapi

import (
	"encoding/json"
	"testing"
)

func TestExternalSceneVideoLinksAndRoundtrip(t *testing.T) {
	source := &sceneVideo{URL: "https://youtu.be/SeaI-P8zXbQ", Duration: 300, Height: 1440, PreviewURL: "http://localhost:30000/shadow-edge-gm/video-cache/test.mp4", PosterURL: "http://localhost:30000/shadow-edge-gm/video-cache/test.jpg"}
	scene := sessionMapDocument{Title: "Video", Levels: []sessionMapLevelDocument{{ID: "ground", Name: "Ground", Width: 2560, Height: 1440, Video: source}}}
	if e := validateSessionMap(scene, foundryConnection{}); e != nil {
		t.Fatal(e)
	}
	raw, _ := json.Marshal(scene)
	var again sessionMapDocument
	if json.Unmarshal(raw, &again) != nil || again.Levels[0].Video.URL != source.URL || again.Levels[0].Video.Height != 1440 {
		t.Fatal("source lost")
	}
	for _, u := range []string{"javascript:alert(1)", "file:///test", "https://youtube.com.evil.test/watch?v=SeaI-P8zXbQ", "https://user:password@site.test/a.mp4"} {
		v := *source
		v.URL = u
		if validateVideo(&v) == nil {
			t.Fatal("accepted", u)
		}
	}
	v := *source
	v.URL = "https://cdn.example.test/a.mp4?signature=example"
	if e := validateVideo(&v); e != nil {
		t.Fatal(e)
	}
	scene.Levels[0].Creative = "{}"
	if validateSessionMap(scene, foundryConnection{}) == nil {
		t.Fatal("creative and video accepted")
	}
	scene.Levels[0].Creative = ""
	scene.Levels[0].Video = nil
	if validateSessionMap(scene, foundryConnection{}) == nil {
		t.Fatal("foreign image validation weakened")
	}
}
