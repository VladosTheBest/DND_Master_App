package httpapi

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"testing"
)

func TestRasterCaveKeepsEntranceAndCurvedPassage(t *testing.T) {
	im := image.NewRGBA(image.Rect(0, 0, 300, 200))
	for y := 0; y < 200; y++ {
		for x := 0; x < 300; x++ {
			im.SetRGBA(x, y, color.RGBA{8, 8, 8, 255})
		}
	}
	// Open entrance, two chambers, and a bent connecting corridor.
	for _, r := range []image.Rectangle{image.Rect(0, 80, 90, 120), image.Rect(70, 50, 150, 150), image.Rect(140, 90, 200, 120), image.Rect(175, 90, 205, 170), image.Rect(180, 140, 280, 190)} {
		for y := r.Min.Y; y < r.Max.Y; y++ {
			for x := r.Min.X; x < r.Max.X; x++ {
				im.SetRGBA(x, y, color.RGBA{150, 160, 170, 255})
			}
		}
	}
	var b bytes.Buffer
	png.Encode(&b, im)
	result, err := traceCaveRaster(b.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	path := []publicFogPoint{{.01, .5}, {.35, .5}, {.63, .5}, {.63, .825}, {.85, .825}}
	for _, wall := range result.Walls {
		for i := 1; i < len(path); i++ {
			if sceneSegmentsCross(wall.Start, wall.End, path[i-1], path[i]) {
				t.Fatal("raster blocked open entrance/corridor", wall)
			}
		}
	}
	if len(result.Walls) < 10 {
		t.Fatal("missing rock contour")
	}
	again, _ := traceCaveRaster(b.Bytes())
	a, _ := json.Marshal(result)
	c, _ := json.Marshal(again)
	if string(a) != string(c) {
		t.Fatal("nondeterministic trace")
	}
}
func TestRasterCaveRealFixture(t *testing.T) {
	path := os.Getenv("CAVE_FIXTURE")
	if path == "" {
		t.Skip("local real-image check")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	result, err := traceCaveRaster(raw)
	if err != nil {
		t.Fatal(err)
	}
	overlay, err := sceneTopologyOverlay(raw, result.Walls)
	if err != nil {
		t.Fatal(err)
	}
	if out := os.Getenv("CAVE_OVERLAY"); out != "" {
		os.WriteFile(out, overlay, 0600)
	}
	t.Logf("segments=%d", len(result.Walls))
}
func TestRasterCaveRejectsLowContrast(t *testing.T) {
	im := image.NewRGBA(image.Rect(0, 0, 80, 80))
	var b bytes.Buffer
	png.Encode(&b, im)
	if _, err := traceCaveRaster(b.Bytes()); err == nil {
		t.Fatal("solid black accepted")
	}
}
