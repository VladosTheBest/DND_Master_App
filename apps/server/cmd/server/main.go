package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"shadowedge/server/internal/httpapi"
)

func main() {
	loadLocalEnvFiles(".env.local", filepath.Join("apps", "server", ".env.local"))

	port := firstEnv("PORT")
	if port == "" {
		port = "8080"
	}

	dataFile := os.Getenv("SHADOW_EDGE_DATA_FILE")
	if dataFile == "" {
		dataFile = filepath.Join("data", "store.json")
	}
	bestiaryCacheFile := os.Getenv("SHADOW_EDGE_BESTIARY_CACHE_FILE")
	if bestiaryCacheFile == "" {
		bestiaryCacheFile = filepath.Join("data", "dndsu-bestiary.json")
	}
	webDir := os.Getenv("SHADOW_EDGE_WEB_DIR")
	if webDir == "" {
		webDir = filepath.Join("apps", "web", "dist")
	}
	uploadDir := os.Getenv("SHADOW_EDGE_UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = filepath.Join("data", "uploads")
	}

	aiProvider := firstEnv("SHADOW_EDGE_AI_PROVIDER")
	aiModel := firstEnv("SHADOW_EDGE_AI_MODEL", "OPENAI_MODEL")
	aiBaseURL := firstEnv("SHADOW_EDGE_AI_BASE_URL", "OPENAI_BASE_URL")
	aiToken := firstEnv("SHADOW_EDGE_AI_API_KEY", "OPENAI_API_KEY")

	server, err := httpapi.NewServer(httpapi.Options{
		DataFile:          dataFile,
		BestiaryCacheFile: bestiaryCacheFile,
		WebDir:            webDir,
		UploadDir:         uploadDir,
		AI: httpapi.AIOptions{
			Provider: aiProvider,
			Model:    aiModel,
			BaseURL:  aiBaseURL,
			APIToken: aiToken,
		},
		Auth: httpapi.AuthOptions{
			Username:   firstEnv("SHADOW_EDGE_AUTH_USERNAME"),
			Password:   firstEnv("SHADOW_EDGE_AUTH_PASSWORD"),
			SessionTTL: 14 * 24 * time.Hour,
		},
		PublicBaseURL: firstEnv("SHADOW_EDGE_PUBLIC_BASE_URL"),
	})
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("shadow-edge server using data file %s", dataFile)
	log.Printf("shadow-edge server using upload dir %s", uploadDir)
	if aiProvider != "" {
		log.Printf("shadow-edge AI provider requested: %s", aiProvider)
	}
	log.Printf("shadow-edge server listening on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, server); err != nil {
		log.Fatal(err)
	}
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if value := os.Getenv(key); value != "" {
			return value
		}
	}
	return ""
}

func loadLocalEnvFiles(paths ...string) {
	for _, path := range paths {
		loadLocalEnvFile(path)
	}
}

func loadLocalEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), "\"'")
		if key == "" || os.Getenv(key) != "" {
			continue
		}

		_ = os.Setenv(key, value)
	}
}
