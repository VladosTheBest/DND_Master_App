package httpapi

import (
	"context"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTileCachePaths(t *testing.T) {
	if !isTileCacheObject("uploads/u/c/map_files/vips-properties.xml") || isTileCacheObject("uploads/u/c/map.dzi") || isTileCacheObject("uploads/u/c/vips-properties.xml") {
		t.Fatal("tile metadata boundary")
	}
	for _, key := range []string{"uploads/u/c/map_files/0/0_0.jpeg", "uploads/c/map_files/14/4_6.webp"} {
		if !tileKeyPattern.MatchString(key) {
			t.Fatal(key)
		}
	}
	for _, key := range []string{"uploads/u/c/map.jpg", "uploads/u/c/map.dzi", "backups/map_files/0/0_0.jpeg", "staging/u/map_files/0/0_0.jpeg"} {
		if tileKeyPattern.MatchString(key) {
			t.Fatal(key)
		}
	}
	c := newTileCache(t.TempDir(), nil)
	for _, key := range []string{"uploads/../outside", "uploads/.proposals/a", "uploads/u\\a"} {
		if _, err := c.local(key); err == nil {
			t.Fatal(key)
		}
	}
	file, _ := c.local("uploads/u/c/map_files/0/0_0.jpeg")
	os.MkdirAll(filepath.Dir(file), 0700)
	os.WriteFile(file, []byte("tile"), 0600)
	handler := c.handler(http.NotFoundHandler())
	r := httptest.NewRecorder()
	handler.ServeHTTP(r, httptest.NewRequest("GET", "/uploads/u/c/map_files/0/0_0.jpeg", nil))
	if r.Code != 200 || r.Body.String() != "tile" || r.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("cached tile unavailable")
	}
}

func testTileCacheLifecycle(t *testing.T, db *cloudDatabase, assets *cloudAssets, root string) {
	t.Helper()
	worker, err := filepath.Abs("../../../../scripts/generate-deep-zoom.mjs")
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("SHADOW_EDGE_DEEP_ZOOM_WORKER", worker)
	source := filepath.Join(root, "map.png")
	f, err := os.Create(source)
	if err != nil {
		t.Fatal(err)
	}
	if err = png.Encode(f, image.NewRGBA(image.Rect(0, 0, 64, 32))); err != nil {
		t.Fatal(err)
	}
	f.Close()
	ctx := context.Background()
	if _, err = generateDeepZoomOptions(ctx, source, filepath.Join(root, "map.dzi"), "jpeg", 512, 0); err != nil {
		t.Fatal(err)
	}
	if err = assets.publishUpload(ctx, source); err != nil {
		t.Fatal(err)
	}
	if _, ok := assets.objects["uploads/map_files/6/0_0.jpeg"]; ok {
		t.Fatal("new tiles persisted in S3")
	}
	tile := filepath.Join(root, "map_files", "6", "0_0.jpeg")
	old := time.Now().Add(-5 * time.Hour)
	os.Chtimes(tile, old, old)
	if err = assets.putFile(ctx, tile, "uploads/map_files/6/0_0.jpeg", true); err != nil {
		t.Fatal(err)
	}
	c := newTileCache(root, assets)
	if err = c.sweep(ctx, old.Add(tileCacheTTL-time.Second)); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(tile); err != nil {
		t.Fatal("tile removed before TTL")
	}
	if err = c.sweep(ctx, time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(tile); !os.IsNotExist(err) {
		t.Fatal("expired local tile retained")
	}
	if _, ok := assets.objects["uploads/map_files/6/0_0.jpeg"]; ok {
		t.Fatal("expired manifest retained")
	}
	var n int
	if err = db.conn.QueryRow(ctx, "SELECT count(*) FROM storage_objects WHERE object_key='uploads/map_files/6/0_0.jpeg'").Scan(&n); err != nil || n != 0 {
		t.Fatal("SQL still counts expired tile")
	}
	if _, err = os.Stat(source); err != nil {
		t.Fatal("original removed")
	}
	r := httptest.NewRecorder()
	c.handler(http.NotFoundHandler()).ServeHTTP(r, httptest.NewRequest("GET", "/uploads/map_files/6/0_0.jpeg", nil))
	if r.Code != 200 || r.Body.Len() == 0 {
		t.Fatalf("rebuild: %d %s", r.Code, r.Body.String())
	}
	if _, ok := assets.objects["uploads/map_files/6/0_0.jpeg"]; ok {
		t.Fatal("rebuilt tiles persisted in S3")
	}
	if err = c.sweep(ctx, time.Now().Add(5*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(tile); !os.IsNotExist(err) {
		t.Fatal("rebuilt tiles not expired")
	}
}
