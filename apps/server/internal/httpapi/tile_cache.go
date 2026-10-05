package httpapi

import (
	"context"
	"encoding/xml"
	"errors"
	"io/fs"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

const tileCacheTTL = 4 * time.Hour

var tileKeyPattern = regexp.MustCompile(`^(uploads/.+)_files/([0-9]{1,2})/([0-9]{1,6})_([0-9]{1,6})\.(jpeg|jpg|png|webp)$`)
var tilePropertiesPattern = regexp.MustCompile(`^uploads/.+_files/vips-properties\.xml$`)

func isTileCacheObject(key string) bool {
	return tileKeyPattern.MatchString(key) || tilePropertiesPattern.MatchString(key)
}

type tileCache struct {
	root   string
	assets *cloudAssets
	gate   chan struct{}
}

func newTileCache(root string, assets *cloudAssets) *tileCache {
	root, _ = filepath.Abs(root)
	return &tileCache{root: root, assets: assets, gate: make(chan struct{}, 1)}
}

func (c *tileCache) local(key string) (string, error) {
	valid, ok := publicObjectKey("/" + key)
	if !ok || valid != key {
		return "", errors.New("invalid cache path")
	}
	p := filepath.Join(c.root, filepath.FromSlash(strings.TrimPrefix(key, "uploads/")))
	rel, err := filepath.Rel(c.root, p)
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") {
		return "", errors.New("cache path outside root")
	}
	// Never follow links while downloading, serving, or removing cache entries.
	for cur := p; cur != c.root; cur = filepath.Dir(cur) {
		info, e := os.Lstat(cur)
		if e == nil && info.Mode()&os.ModeSymlink != 0 {
			return "", errors.New("symlink in cache path")
		}
		if e != nil && !errors.Is(e, os.ErrNotExist) {
			return "", e
		}
	}
	return p, nil
}

func (c *tileCache) handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, ok := publicObjectKey(r.URL.Path)
		match := tileKeyPattern.FindStringSubmatch(key)
		if !ok || match == nil {
			next.ServeHTTP(w, r)
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			http.NotFound(w, r)
			return
		}
		select {
		case c.gate <- struct{}{}:
			defer func() { <-c.gate }()
		case <-r.Context().Done():
			return
		}
		file, err := c.local(key)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		info, err := os.Stat(file)
		if err != nil || !info.Mode().IsRegular() || time.Since(info.ModTime()) >= tileCacheTTL {
			if err = c.rebuild(r.Context(), match); err != nil {
				http.Error(w, "Map cache temporarily unavailable", 503)
				return
			}
		}
		// Browser/CDN caches must not outlive the server cache.
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeFile(w, r, file)
	})
}

type tileDescriptor struct {
	Format   string `xml:"Format,attr"`
	TileSize int    `xml:"TileSize,attr"`
	Overlap  int    `xml:"Overlap,attr"`
	Size     struct {
		Width  int `xml:"Width,attr"`
		Height int `xml:"Height,attr"`
	} `xml:"Size"`
}

func (c *tileCache) rebuild(ctx context.Context, match []string) error {
	base := match[1]
	descriptor, err := c.local(base + ".dzi")
	if err != nil {
		return err
	}
	if err = c.assets.ensureLocal(ctx, descriptor, base+".dzi"); err != nil {
		return err
	}
	body, err := os.ReadFile(descriptor)
	if err != nil {
		return err
	}
	var d tileDescriptor
	if err = xml.Unmarshal(body, &d); err != nil {
		return err
	}
	if d.Size.Width <= 0 || d.Size.Height <= 0 || d.TileSize <= 0 {
		return errors.New("invalid descriptor")
	}
	level, _ := strconv.Atoi(match[2])
	x, _ := strconv.Atoi(match[3])
	y, _ := strconv.Atoi(match[4])
	max := int(math.Ceil(math.Log2(float64(max(d.Size.Width, d.Size.Height)))))
	if level > max || match[5] != d.Format || x >= int(math.Ceil(float64(d.Size.Width)/math.Pow(2, float64(max-level))/float64(d.TileSize))) || y >= int(math.Ceil(float64(d.Size.Height)/math.Pow(2, float64(max-level))/float64(d.TileSize))) {
		return errors.New("invalid tile coordinates")
	}
	var sourceKey string
	c.assets.mu.Lock()
	for _, ext := range []string{".webp", ".jpg", ".jpeg", ".png"} {
		if _, ok := c.assets.objects[base+ext]; ok {
			sourceKey = base + ext
			break
		}
	}
	c.assets.mu.Unlock()
	if sourceKey == "" {
		return errors.New("original unavailable")
	}
	source, err := c.local(sourceKey)
	if err != nil {
		return err
	}
	if err = c.assets.ensureLocal(ctx, source, sourceKey); err != nil {
		return err
	}
	tmp, err := os.MkdirTemp(c.root, ".tile-build-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)
	result, err := generateDeepZoomOptions(ctx, source, filepath.Join(tmp, "map.dzi"), d.Format, d.TileSize, d.Overlap)
	if err != nil {
		return err
	}
	if result.Width != d.Size.Width || result.Height != d.Size.Height {
		return errors.New("original geometry changed")
	}
	target, err := c.local(base + "_files")
	if err != nil {
		return err
	}
	if err = os.RemoveAll(target); err != nil {
		return err
	}
	return os.Rename(filepath.Join(tmp, "map_files"), target)
}

func (c *tileCache) sweep(ctx context.Context, now time.Time) error {
	// Delete only recognized tile objects, never originals/descriptors/backups.
	c.assets.mu.Lock()
	keys := []string{}
	for key, o := range c.assets.objects {
		if isTileCacheObject(key) && now.Sub(time.Unix(0, o.Mtime)) >= tileCacheTTL {
			keys = append(keys, key)
		}
	}
	c.assets.mu.Unlock()
	for len(keys) > 0 {
		n := len(keys)
		if n > 1000 {
			n = 1000
		}
		batch := keys[:n]
		keys = keys[n:]
		ids := make([]types.ObjectIdentifier, len(batch))
		for i, key := range batch {
			ids[i] = types.ObjectIdentifier{Key: aws.String(key)}
		}
		out, err := c.assets.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: aws.String(c.assets.bucket), Delete: &types.Delete{Objects: ids, Quiet: aws.Bool(true)}})
		if err != nil {
			return errors.New("tile S3 cleanup failed")
		}
		failed := map[string]bool{}
		for _, e := range out.Errors {
			failed[aws.ToString(e.Key)] = true
		}
		done := []string{}
		for _, key := range batch {
			if !failed[key] {
				done = append(done, key)
			}
		}
		c.assets.db.mu.Lock()
		_, err = c.assets.db.conn.Exec(ctx, "DELETE FROM storage_objects WHERE object_key=ANY($1::text[])", done)
		c.assets.db.mu.Unlock()
		if err != nil {
			return errors.New("tile manifest cleanup failed")
		}
		c.assets.mu.Lock()
		for _, key := range done {
			delete(c.assets.objects, key)
		}
		c.assets.mu.Unlock()
		if len(failed) > 0 {
			return errors.New("some tile objects could not be deleted")
		}
	}
	select {
	case c.gate <- struct{}{}:
		defer func() { <-c.gate }()
	case <-ctx.Done():
		return ctx.Err()
	}
	return filepath.WalkDir(c.root, func(p string, e fs.DirEntry, err error) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err != nil {
			return err
		}
		if e.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if e.IsDir() {
			if strings.HasPrefix(e.Name(), ".tile-build-") {
				info, err := e.Info()
				if err != nil {
					return err
				}
				if now.Sub(info.ModTime()) >= tileCacheTTL {
					rel, err := filepath.Rel(c.root, p)
					if err != nil {
						return err
					}
					safe, err := c.local("uploads/" + filepath.ToSlash(rel))
					if err != nil {
						return err
					}
					if err = os.RemoveAll(safe); err != nil {
						return err
					}
				}
				return filepath.SkipDir
			}
			return nil
		}
		rel, err := filepath.Rel(c.root, p)
		if err != nil {
			return err
		}
		key := "uploads/" + filepath.ToSlash(rel)
		if !isTileCacheObject(key) {
			return nil
		}
		if _, err = c.local(key); err != nil {
			return err
		}
		info, err := e.Info()
		if err != nil {
			return err
		}
		if now.Sub(info.ModTime()) >= tileCacheTTL {
			return os.Remove(p)
		}
		return nil
	})
}

func (c *tileCache) run() {
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		err := c.sweep(ctx, time.Now())
		cancel()
		if err != nil {
			log.Printf("tile cache cleanup: %v", err)
		}
		time.Sleep(time.Minute)
	}
}
