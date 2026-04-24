package httpapi

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type AuthOptions struct {
	Username   string
	Password   string
	SessionTTL time.Duration
}

type authManager struct {
	username   string
	password   string
	cookieName string
	sessionTTL time.Duration

	mu       sync.Mutex
	sessions map[string]authSession
}

type authSession struct {
	Username  string
	ExpiresAt time.Time
}

type loginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authSessionResult struct {
	Authenticated bool   `json:"authenticated"`
	Username      string `json:"username,omitempty"`
}

func newAuthManager(options AuthOptions) *authManager {
	ttl := options.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}

	return &authManager{
		username:   strings.TrimSpace(options.Username),
		password:   options.Password,
		cookieName: "shadow_edge_session",
		sessionTTL: ttl,
		sessions:   make(map[string]authSession),
	}
}

func (manager *authManager) enabled() bool {
	return manager.username != "" && manager.password != ""
}

func (manager *authManager) shouldProtect(path string) bool {
	if !manager.enabled() {
		return false
	}

	if !strings.HasPrefix(path, "/api/") {
		return false
	}

	if strings.HasPrefix(path, "/api/auth/") || strings.HasPrefix(path, "/api/initiative/") || strings.HasPrefix(path, "/api/initiative-meta/") {
		return false
	}

	return true
}

func (manager *authManager) currentUser(request *http.Request) (string, bool) {
	if !manager.enabled() {
		return "gm", true
	}

	cookie, err := request.Cookie(manager.cookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return "", false
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()
	manager.cleanupExpiredLocked(time.Now())

	session, ok := manager.sessions[cookie.Value]
	if !ok {
		return "", false
	}

	return session.Username, true
}

func (manager *authManager) handleSession(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	username, ok := manager.currentUser(request)
	if !ok {
		writeJSON(writer, http.StatusOK, authSessionResult{Authenticated: false})
		return
	}

	writeJSON(writer, http.StatusOK, authSessionResult{
		Authenticated: true,
		Username:      username,
	})
}

func (manager *authManager) handleLogin(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if !manager.enabled() {
		writeJSON(writer, http.StatusOK, authSessionResult{
			Authenticated: true,
			Username:      "gm",
		})
		return
	}

	var input loginInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(input.Username)), []byte(manager.username)) != 1 ||
		subtle.ConstantTimeCompare([]byte(input.Password), []byte(manager.password)) != 1 {
		writeError(writer, http.StatusUnauthorized, "invalid_credentials", "Неверный логин или пароль.")
		return
	}

	token, err := randomAuthToken()
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "session_create_failed", "Не удалось создать сессию.")
		return
	}

	expiresAt := time.Now().Add(manager.sessionTTL)

	manager.mu.Lock()
	manager.cleanupExpiredLocked(time.Now())
	manager.sessions[token] = authSession{
		Username:  manager.username,
		ExpiresAt: expiresAt,
	}
	manager.mu.Unlock()

	manager.writeSessionCookie(writer, token, expiresAt, requestIsSecure(request))

	writeJSON(writer, http.StatusOK, authSessionResult{
		Authenticated: true,
		Username:      manager.username,
	})
}

func (manager *authManager) handleLogout(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if cookie, err := request.Cookie(manager.cookieName); err == nil && strings.TrimSpace(cookie.Value) != "" {
		manager.mu.Lock()
		delete(manager.sessions, cookie.Value)
		manager.mu.Unlock()
	}

	manager.clearSessionCookie(writer, requestIsSecure(request))
	writeJSON(writer, http.StatusOK, authSessionResult{Authenticated: false})
}

func (manager *authManager) writeSessionCookie(writer http.ResponseWriter, token string, expiresAt time.Time, secure bool) {
	http.SetCookie(writer, &http.Cookie{
		Name:     manager.cookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
		MaxAge:   int(manager.sessionTTL / time.Second),
	})
}

func (manager *authManager) clearSessionCookie(writer http.ResponseWriter, secure bool) {
	http.SetCookie(writer, &http.Cookie{
		Name:     manager.cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func requestIsSecure(request *http.Request) bool {
	if request == nil {
		return false
	}

	if request.TLS != nil {
		return true
	}

	forwardedProto := strings.TrimSpace(request.Header.Get("X-Forwarded-Proto"))
	if forwardedProto == "" {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(strings.Split(forwardedProto, ",")[0]), "https")
}

func (manager *authManager) cleanupExpiredLocked(now time.Time) {
	for token, session := range manager.sessions {
		if now.After(session.ExpiresAt) {
			delete(manager.sessions, token)
		}
	}
}

func randomAuthToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func applyCORSHeaders(writer http.ResponseWriter, request *http.Request) {
	origin := strings.TrimSpace(request.Header.Get("Origin"))
	if origin == "" {
		return
	}

	if !isAllowedCORSOrigin(origin) {
		return
	}

	writer.Header().Set("Access-Control-Allow-Origin", origin)
	writer.Header().Set("Access-Control-Allow-Credentials", "true")
	writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	writer.Header().Add("Vary", "Origin")
}

func isAllowedCORSOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}
