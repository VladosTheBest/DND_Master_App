package httpapi

import (
	"os"
	"testing"
)

func TestMapImageFormatsAndByteLimit(t *testing.T) {
	for _, tc := range []struct {
		file, format string
		w, h         int
	}{{"creative-preview.webp", "webp", 1600, 1000}, {"large-map.png", "png", 9000, 2000}} {
		b, err := os.ReadFile("testdata/" + tc.file)
		if err != nil {
			t.Fatal(err)
		}
		cfg, format, err := mapImageConfig(b)
		if err != nil || format != tc.format || cfg.Width != tc.w || cfg.Height != tc.h {
			t.Fatalf("%s: %v %s %v", tc.file, cfg, format, err)
		}
	}
	large := make([]byte, 100<<20+1)
	copy(large, mapFixturePNG())
	if _, _, err := mapImageConfig(large[:100<<20]); err != nil {
		t.Fatal("100 MiB rejected", err)
	}
	if _, _, err := mapImageConfig(large); err == nil {
		t.Fatal("over 100 MiB accepted")
	}
	if _, _, err := mapImageConfig([]byte("not an image")); err == nil {
		t.Fatal("invalid image accepted")
	}
}
