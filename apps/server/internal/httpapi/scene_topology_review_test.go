package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSceneReviewUsesOriginalAndOverlayAndReplacesCandidate(t *testing.T) {
	m, c, _ := aiFixture(t)
	candidate, err := parseSceneTopology(`{"walls":[{"id":"floating","kind":"door","start":{"x":0.4,"y":0.3},"end":{"x":0.5,"y":0.3}}],"lights":[],"darkness":0.2,"walkablePaths":[]}`)
	if err != nil {
		t.Fatal(err)
	}
	fail := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Messages []struct {
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if json.NewDecoder(r.Body).Decode(&request) != nil || len(request.Messages) != 2 {
			t.Error("missing review messages")
			return
		}
		var parts []map[string]any
		json.Unmarshal(request.Messages[1].Content, &parts)
		if len(parts) != 11 || parts[1]["type"] != "image_url" || parts[2]["type"] != "image_url" || !strings.Contains(string(request.Messages[0].Content), "final visual alignment reviewer") {
			t.Error("review must see original and rendered candidate")
		}
		if !strings.Contains(parts[0]["text"].(string), "Candidate geometry") {
			t.Error("missing candidate coordinates")
		}
		if fail {
			w.WriteHeader(400)
			return
		}
		// Reviewer removes a door in open floor. Unchecked candidate must not survive.
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": `{"walls":[],"lights":[],"darkness":0.2,"walkablePaths":[]}`}}}})
	}))
	defer upstream.Close()
	m.srv.generator = newEntityGenerator(AIOptions{Provider: "openai", BaseURL: upstream.URL, APIToken: "test", Model: "test"})
	result, err := m.srv.reviewSceneTopology(context.Background(), authUser{ID: c.OwnerID}, c.CampaignID, mapFixturePNG(), false, foundrySceneInput{Columns: 60, Rows: 30, Distance: 5}, candidate)
	if err != nil || len(result.Walls) != 0 {
		t.Fatalf("unchecked door retained: %+v %v", result, err)
	}
	fail = true
	result, err = m.srv.reviewSceneTopology(context.Background(), authUser{ID: c.OwnerID}, c.CampaignID, mapFixturePNG(), false, foundrySceneInput{}, candidate)
	if err == nil || len(result.Walls) != 0 {
		t.Fatal("failed review accepted candidate")
	}
}

func TestSceneOverlayPreservesNonSquareCoordinatesAndSource(t *testing.T) {
	original := image.NewRGBA(image.Rect(0, 0, 600, 300))
	original.SetRGBA(30, 30, color.RGBA{10, 20, 30, 255})
	var raw bytes.Buffer
	png.Encode(&raw, original)
	candidate, _ := parseSceneTopology(`{"walls":[{"kind":"wall","start":{"x":0.2,"y":0.5},"end":{"x":0.8,"y":0.5}},{"kind":"door","start":{"x":0.8,"y":0.5},"end":{"x":0.9,"y":0.5}}],"lights":[],"darkness":0}`)
	encoded, err := sceneTopologyOverlay(raw.Bytes(), candidate.Walls)
	if err != nil {
		t.Fatal(err)
	}
	actual, _, err := image.Decode(bytes.NewReader(encoded))
	if err != nil || actual.Bounds() != original.Bounds() {
		t.Fatal("framing changed", err)
	}
	for _, point := range []struct {
		x, y int
		want color.RGBA
	}{{300, 150, color.RGBA{0, 255, 255, 255}}, {510, 150, color.RGBA{255, 0, 255, 255}}, {30, 30, color.RGBA{10, 20, 30, 255}}} {
		if got := color.RGBAModel.Convert(actual.At(point.x, point.y)); got != point.want {
			t.Fatalf("pixel %d,%d: %v", point.x, point.y, got)
		}
	}
	if original.RGBAAt(300, 150) != (color.RGBA{}) {
		t.Fatal("source mutated")
	}
}

func TestSceneReviewDetailsKeepQuadrantOrder(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 20, 12))
	inks := []color.RGBA{{10, 0, 0, 255}, {20, 0, 0, 255}, {30, 0, 0, 255}, {40, 0, 0, 255}}
	for y := 0; y < 12; y++ {
		for x := 0; x < 20; x++ {
			src.SetRGBA(x, y, inks[(y/6)*2+x/10])
		}
	}
	var raw bytes.Buffer
	png.Encode(&raw, src)
	crops, err := sceneTopologyDetails(raw.Bytes(), raw.Bytes())
	if err != nil || len(crops) != 8 {
		t.Fatal(err, len(crops))
	}
	for i, crop := range crops {
		actual, _, err := image.Decode(bytes.NewReader(crop))
		if err != nil || actual.Bounds().Dx() != 10 || actual.Bounds().Dy() != 6 {
			t.Fatal("invalid crop", err)
		}
		if color.RGBAModel.Convert(actual.At(2, 2)) != inks[i/2] {
			t.Fatal("quadrant coordinates/order changed", i)
		}
	}
}

func TestSceneOpenCaveRouteRemovesEntranceAndTunnelBlockers(t *testing.T) {
	result, err := parseSceneTopology(`{"walls":[{"kind":"wall","start":{"x":0.2,"y":0.3},"end":{"x":0.2,"y":0.7}},{"kind":"wall","start":{"x":0.6,"y":0.4},"end":{"x":0.6,"y":0.6}},{"kind":"wall","start":{"x":0.2,"y":0.2},"end":{"x":0.8,"y":0.2}}],"lights":[],"darkness":0}`)
	if err != nil {
		t.Fatal(err)
	}
	checked, err := protectSceneWalkablePaths(result, `{"walkablePaths":[[{"x":0.1,"y":0.5},{"x":0.8,"y":0.5}]]}`)
	if err != nil || len(checked.Walls) != 1 || checked.Walls[0].Start.Y != 0.2 {
		t.Fatal("entrance/tunnel blocked or rock boundary lost", err, checked.Walls)
	}
	door := result.Walls[0]
	door.Kind = "door"
	kept, err := protectSceneWalkablePaths(sessionMapLevelDocument{Walls: []publicDisplayWall{door}}, `{"walkablePaths":[[{"x":0.1,"y":0.5},{"x":0.8,"y":0.5}]]}`)
	if err != nil || len(kept.Walls) != 1 || kept.Walls[0].Kind != "door" {
		t.Fatal("interactive doorway removed", err)
	}
	for _, bad := range []string{`{}`, `{"walkablePaths":null}`, `{"walkablePaths":[[{"x":2,"y":0},{"x":0,"y":0}]]}`} {
		if _, err := protectSceneWalkablePaths(result, bad); err == nil {
			t.Fatal("unverified route accepted")
		}
	}
	if sceneSegmentsCross(publicFogPoint{X: 0, Y: 0}, publicFogPoint{X: .1, Y: 0}, publicFogPoint{X: .2, Y: 0}, publicFogPoint{X: .3, Y: 0}) {
		t.Fatal("disjoint collinear segments")
	}
}
