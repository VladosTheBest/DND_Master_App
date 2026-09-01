package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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
	if len(os.Args) > 1 && os.Args[1] == "reset-password" {
		if err := runPasswordReset(dataFile); err != nil {
			log.Fatal(err)
		}
		return
	}
	bestiaryCacheFile := os.Getenv("SHADOW_EDGE_BESTIARY_CACHE_FILE")
	if bestiaryCacheFile == "" {
		bestiaryCacheFile = filepath.Join("data", "dndsu-bestiary.json")
	}
	itemCatalogCacheFile := os.Getenv("SHADOW_EDGE_ITEM_CATALOG_CACHE_FILE")
	if itemCatalogCacheFile == "" {
		itemCatalogCacheFile = filepath.Join("data", "dndsu-items.json")
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
	codexHomeRoot := firstEnv("SHADOW_EDGE_CODEX_HOME_ROOT")
	if codexHomeRoot == "" {
		codexHomeRoot = filepath.Join(filepath.Dir(dataFile), "codex-users")
	}
	codexMCPScript := firstEnv("SHADOW_EDGE_CODEX_MCP_SCRIPT")
	if codexMCPScript == "" {
		codexMCPScript = filepath.Join("packages", "mcp-server", "dist", "index.js")
	}
	if absoluteScript, absoluteErr := filepath.Abs(codexMCPScript); absoluteErr == nil {
		codexMCPScript = absoluteScript
	}
	codexInternalBaseURL := firstEnv("SHADOW_EDGE_CODEX_INTERNAL_BASE_URL")
	if codexInternalBaseURL == "" {
		codexInternalBaseURL = "http://127.0.0.1:" + port
	}

	server, err := httpapi.NewServer(httpapi.Options{
		DataFile:             dataFile,
		BestiaryCacheFile:    bestiaryCacheFile,
		ItemCatalogCacheFile: itemCatalogCacheFile,
		WebDir:               webDir,
		UploadDir:            uploadDir,
		AI: httpapi.AIOptions{
			Provider: aiProvider,
			Model:    aiModel,
			BaseURL:  aiBaseURL,
			APIToken: aiToken,
		},
		Codex: httpapi.CodexBridgeOptions{
			Enabled:          envBool("SHADOW_EDGE_CODEX_BRIDGE_ENABLED", true),
			Command:          firstEnv("SHADOW_EDGE_CODEX_COMMAND", "CODEX_COMMAND"),
			Args:             []string{"app-server", "--strict-config"},
			HomeRoot:         codexHomeRoot,
			MCPCommand:       firstEnv("SHADOW_EDGE_CODEX_MCP_COMMAND"),
			MCPArgs:          []string{codexMCPScript},
			InternalBaseURL:  codexInternalBaseURL,
			RequestTimeout:   4 * time.Minute,
			IdleTimeout:      time.Duration(envInt("SHADOW_EDGE_CODEX_IDLE_TIMEOUT_MINUTES", 30)) * time.Minute,
			MaxUserProcesses: envInt("SHADOW_EDGE_CODEX_MAX_USER_PROCESSES", 1),
			APIKeyConfigured: aiToken != "",
			AllowedUsername:  firstEnv("SHADOW_EDGE_CODEX_ALLOWED_USERNAME"),
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
	// VTT imports contain a base64 map and can take minutes on slower links.
	// Bound connections explicitly without cutting off valid large uploads.
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           server,
		ReadHeaderTimeout: 15 * time.Second,
		ReadTimeout:       5 * time.Minute,
		WriteTimeout:      5 * time.Minute,
		IdleTimeout:       2 * time.Minute,
		MaxHeaderBytes:    1 << 20,
	}
	if err := httpServer.ListenAndServe(); err != nil {
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

func envBool(key string, fallback bool) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
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
