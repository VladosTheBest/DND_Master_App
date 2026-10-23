package httpapi

import (
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

func newWebAppHandler(webDir string) (http.Handler, error) {
	webDir = strings.TrimSpace(webDir)
	if webDir == "" {
		return nil, nil
	}

	indexPath := filepath.Join(webDir, "index.html")
	info, err := os.Stat(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read web app index: %w", err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("web app index path is a directory: %s", indexPath)
	}

	fileServer := http.FileServer(http.Dir(webDir))
	var validators sync.Map
	serve := func(w http.ResponseWriter, r *http.Request, filePath string, immutable bool) {
		w.Header().Set("Cache-Control", "no-cache")
		if immutable {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		w.Header().Add("Vary", "Accept-Encoding")
		selected := filePath
		compressed := false
		if acceptsGzip(r.Header.Get("Accept-Encoding")) && r.Header.Get("Range") == "" {
			if entry, err := os.Stat(filePath + ".gz"); err == nil && !entry.IsDir() {
				selected += ".gz"
				compressed = true
			}
		}
		f, err := os.Open(selected)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		stat, err := f.Stat()
		if err != nil {
			http.NotFound(w, r)
			return
		}
		// The representation-specific validator also handles rapid deployments with identical mtimes.
		cacheKey := fmt.Sprintf("%s:%d:%d", selected, stat.ModTime().UnixNano(), stat.Size())
		cached, ok := validators.Load(cacheKey)
		if !ok {
			hash := sha256.New()
			if _, err = io.Copy(hash, f); err != nil {
				http.Error(w, "asset unavailable", 500)
				return
			}
			cached = fmt.Sprintf("\"%x\"", hash.Sum(nil))
			validators.Store(cacheKey, cached)
		}
		_, _ = f.Seek(0, 0)
		w.Header().Set("ETag", cached.(string))
		if compressed {
			w.Header().Set("Content-Encoding", "gzip")
		}
		http.ServeContent(w, r, filepath.Base(filePath), stat.ModTime(), f)
	}

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			http.NotFound(writer, request)
			return
		}

		cleanPath := path.Clean("/" + strings.TrimSpace(request.URL.Path))
		if cleanPath != "/" {
			filePath := filepath.Join(webDir, filepath.FromSlash(strings.TrimPrefix(cleanPath, "/")))
			if entryInfo, err := os.Stat(filePath); err == nil && !entryInfo.IsDir() {
				if cleanPath == "/index.html" || strings.HasPrefix(cleanPath, "/assets/") {
					serve(writer, request, filePath, hashedAsset.MatchString(filepath.Base(cleanPath)))
				} else {
					writer.Header().Set("Cache-Control", "no-cache")
					fileServer.ServeHTTP(writer, request)
				}
				return
			}

			if path.Ext(cleanPath) != "" {
				http.NotFound(writer, request)
				return
			}
		}

		serve(writer, request, indexPath, false)
	}), nil
}

var hashedAsset = regexp.MustCompile(`-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$`)

func acceptsGzip(value string) bool {
	for _, part := range strings.Split(value, ",") {
		fields := strings.Split(strings.TrimSpace(part), ";")
		if fields[0] != "gzip" {
			continue
		}
		for _, p := range fields[1:] {
			if v := strings.TrimSpace(p); strings.HasPrefix(v, "q=") {
				if quality, err := strconv.ParseFloat(strings.TrimPrefix(v, "q="), 64); err == nil && quality <= 0 {
					return false
				}
			}
		}
		return true
	}
	return false
}
