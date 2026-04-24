package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
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

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			http.NotFound(writer, request)
			return
		}

		cleanPath := path.Clean("/" + strings.TrimSpace(request.URL.Path))
		if cleanPath != "/" {
			filePath := filepath.Join(webDir, filepath.FromSlash(strings.TrimPrefix(cleanPath, "/")))
			if entryInfo, err := os.Stat(filePath); err == nil && !entryInfo.IsDir() {
				fileServer.ServeHTTP(writer, request)
				return
			}

			if path.Ext(cleanPath) != "" {
				http.NotFound(writer, request)
				return
			}
		}

		http.ServeFile(writer, request, indexPath)
	}), nil
}
