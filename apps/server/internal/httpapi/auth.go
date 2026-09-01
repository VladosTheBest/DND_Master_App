package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

type AuthOptions struct {
	Username   string
	Password   string
	SessionTTL time.Duration
}

type authManager struct {
	store      *campaignStore
	cookieName string
	sessionTTL time.Duration

	mu sync.Mutex
	// sessions is the authoritative allowlist for both browser and ephemeral
	// bridge tokens. Cookies are opaque references and are never self-validating.
	sessions map[string]authSession
}

type authUser struct {
	ID       string
	Username string
}

type authSession struct {
	UserID    string
	Username  string
	ExpiresAt time.Time
}

type loginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type registerInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authSessionResult struct {
	Authenticated       bool   `json:"authenticated"`
	UserID              string `json:"userId,omitempty"`
	Username            string `json:"username,omitempty"`
	RegistrationEnabled bool   `json:"registrationEnabled"`
}

func newAuthManager(options AuthOptions, store *campaignStore) (*authManager, error) {
	if store == nil {
		return nil, fmt.Errorf("auth store is required")
	}

	if err := store.bootstrapLegacyUser(options.Username, options.Password); err != nil {
		return nil, err
	}

	ttl := options.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}

	return &authManager{
		store:      store,
		cookieName: "shadow_edge_session",
		sessionTTL: ttl,
		sessions:   make(map[string]authSession),
	}, nil
}

func (manager *authManager) enabled() bool {
	return manager != nil && manager.store != nil
}

func (manager *authManager) shouldProtect(path string) bool {
	if manager == nil || !manager.enabled() {
		return false
	}

	if !strings.HasPrefix(path, "/api/") {
		return false
	}

	if strings.HasPrefix(path, "/api/auth/") ||
		strings.HasPrefix(path, "/api/initiative/") ||
		strings.HasPrefix(path, "/api/initiative-meta/") ||
		strings.HasPrefix(path, "/api/survey/") ||
		strings.HasPrefix(path, "/api/display/") ||
		strings.HasPrefix(path, "/api/display-meta/") {
		return false
	}

	return true
}

func (manager *authManager) currentUser(request *http.Request) (authUser, bool) {
	if manager == nil || !manager.enabled() {
		return authUser{}, false
	}

	cookie, err := request.Cookie(manager.cookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return authUser{}, false
	}

	manager.mu.Lock()
	manager.cleanupExpiredLocked(time.Now())
	session, ok := manager.sessions[cookie.Value]
	manager.mu.Unlock()
	if !ok {
		return authUser{}, false
	}

	return authUser{ID: session.UserID, Username: session.Username}, true
}

func (manager *authManager) handleSession(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is supported")
		return
	}

	user, ok := manager.currentUser(request)
	if !ok {
		writeJSON(writer, http.StatusOK, authSessionResult{
			Authenticated:       false,
			RegistrationEnabled: true,
		})
		return
	}

	if cookie, err := request.Cookie(manager.cookieName); err == nil && strings.TrimSpace(cookie.Value) != "" {
		expiresAt := time.Now().Add(manager.sessionTTL)
		token, tokenErr := manager.issueOpaqueSessionToken()
		if tokenErr == nil {
			rotated := false
			manager.mu.Lock()
			manager.cleanupExpiredLocked(time.Now())
			if previous, exists := manager.sessions[cookie.Value]; exists && previous.UserID == user.ID {
				delete(manager.sessions, cookie.Value)
				manager.sessions[token] = authSession{
					UserID:    user.ID,
					Username:  user.Username,
					ExpiresAt: expiresAt,
				}
				rotated = true
			}
			manager.mu.Unlock()
			if rotated {
				manager.writeSessionCookie(writer, token, expiresAt, requestIsSecure(request))
			}
		}
	}

	writeJSON(writer, http.StatusOK, authSessionResult{
		Authenticated:       true,
		UserID:              user.ID,
		Username:            user.Username,
		RegistrationEnabled: true,
	})
}

func (manager *authManager) handleLogin(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	var input loginInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	user, ok := manager.store.findUserByUsername(input.Username)
	if !ok || !verifyPassword(user.PasswordHash, input.Password) {
		writeError(writer, http.StatusUnauthorized, "invalid_credentials", "Неверный логин или пароль.")
		return
	}

	manager.writeAuthenticatedSession(writer, request, authUser{ID: user.ID, Username: user.Username})
}

func (manager *authManager) handleRegister(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	var input registerInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	user, err := manager.store.createUser(input.Username, input.Password)
	if err != nil {
		switch {
		case errors.Is(err, errUsernameTaken):
			writeError(writer, http.StatusConflict, "username_taken", "Такой логин уже занят.")
		default:
			writeError(writer, http.StatusBadRequest, "registration_failed", err.Error())
		}
		return
	}

	manager.writeAuthenticatedSession(writer, request, authUser{ID: user.ID, Username: user.Username})
}

func (manager *authManager) writeAuthenticatedSession(writer http.ResponseWriter, request *http.Request, user authUser) {
	expiresAt := time.Now().Add(manager.sessionTTL)
	token, err := manager.issueOpaqueSessionToken()
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "session_create_failed", "Не удалось создать сессию.")
		return
	}

	manager.mu.Lock()
	manager.cleanupExpiredLocked(time.Now())
	manager.sessions[token] = authSession{
		UserID:    user.ID,
		Username:  user.Username,
		ExpiresAt: expiresAt,
	}
	manager.mu.Unlock()

	manager.writeSessionCookie(writer, token, expiresAt, requestIsSecure(request))

	writeJSON(writer, http.StatusOK, authSessionResult{
		Authenticated:       true,
		UserID:              user.ID,
		Username:            user.Username,
		RegistrationEnabled: true,
	})
}

func (manager *authManager) issueEphemeralSession(user authUser, expiresAt time.Time) (string, error) {
	if manager == nil || !manager.enabled() || strings.TrimSpace(user.ID) == "" || !expiresAt.After(time.Now()) {
		return "", fmt.Errorf("cannot issue ephemeral session")
	}
	random, err := randomAuthToken()
	if err != nil {
		return "", fmt.Errorf("generate ephemeral session: %w", err)
	}
	token := "ephemeral_" + random
	manager.mu.Lock()
	manager.cleanupExpiredLocked(time.Now())
	manager.sessions[token] = authSession{UserID: user.ID, Username: user.Username, ExpiresAt: expiresAt}
	manager.mu.Unlock()
	return token, nil
}

func (manager *authManager) revokeSession(token string) {
	if manager == nil || strings.TrimSpace(token) == "" {
		return
	}
	manager.mu.Lock()
	delete(manager.sessions, token)
	manager.mu.Unlock()
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
	writeJSON(writer, http.StatusOK, authSessionResult{
		Authenticated:       false,
		RegistrationEnabled: true,
	})
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
		if !now.Before(session.ExpiresAt) {
			delete(manager.sessions, token)
		}
	}
}

func (manager *authManager) issueOpaqueSessionToken() (string, error) {
	token, err := randomAuthToken()
	if err != nil {
		return "", err
	}
	return "session_" + token, nil
}

func normalizeAccountUsername(value string) (string, string, error) {
	username := strings.TrimSpace(value)
	length := utf8.RuneCountInString(username)
	if length < 3 {
		return "", "", fmt.Errorf("Логин должен быть не короче 3 символов.")
	}
	if length > 48 {
		return "", "", fmt.Errorf("Логин должен быть не длиннее 48 символов.")
	}
	for _, char := range username {
		if unicode.IsControl(char) {
			return "", "", fmt.Errorf("Логин не должен содержать управляющие символы.")
		}
	}

	usernameKey := normalizeUsernameKey(username)
	if usernameKey == "" {
		return "", "", fmt.Errorf("Укажи логин.")
	}

	return username, usernameKey, nil
}

func normalizeUsernameKey(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func validateAccountPassword(password string) error {
	if utf8.RuneCountInString(password) < 8 {
		return fmt.Errorf("Пароль должен быть не короче 8 символов.")
	}

	return nil
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func verifyPassword(passwordHash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) == nil
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

	// Cross-origin credentials are needed only for the local Vite development
	// server. Never reflect a development origin when the API host itself is not
	// loopback (for example, on a production deployment).
	if !isLoopbackRequestHost(request) || !isAllowedCORSOrigin(origin) {
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
	if err != nil || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
		return false
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "localhost" && host != "127.0.0.1" && host != "::1" {
		return false
	}
	return parsed.Port() == "5173"
}

func isLoopbackRequestHost(request *http.Request) bool {
	if request == nil || strings.TrimSpace(request.Host) == "" {
		return false
	}
	parsed, err := url.Parse("http://" + request.Host)
	if err != nil {
		return false
	}
	switch strings.ToLower(parsed.Hostname()) {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}

func isTrustedMutationOrigin(request *http.Request) bool {
	if request == nil {
		return false
	}
	origin := strings.TrimSpace(request.Header.Get("Origin"))
	if origin == "" {
		// Non-browser clients and same-origin legacy callers may omit Origin.
		return true
	}
	parsedOrigin, err := url.Parse(origin)
	if err != nil || parsedOrigin.User != nil || parsedOrigin.RawQuery != "" || parsedOrigin.Fragment != "" || (parsedOrigin.Path != "" && parsedOrigin.Path != "/") {
		return false
	}
	scheme := "http"
	if requestIsSecure(request) {
		scheme = "https"
	}
	requestOrigin, err := url.Parse(scheme + "://" + request.Host)
	if err == nil && sameHTTPOrigin(parsedOrigin, requestOrigin) {
		return true
	}
	return isLoopbackRequestHost(request) && isAllowedCORSOrigin(origin)
}

func sameHTTPOrigin(first, second *url.URL) bool {
	if first == nil || second == nil || !strings.EqualFold(first.Scheme, second.Scheme) || !strings.EqualFold(first.Hostname(), second.Hostname()) {
		return false
	}
	return effectiveHTTPPort(first) == effectiveHTTPPort(second)
}

func effectiveHTTPPort(value *url.URL) string {
	if value == nil {
		return ""
	}
	if port := value.Port(); port != "" {
		return port
	}
	if strings.EqualFold(value.Scheme, "https") {
		return "443"
	}
	if strings.EqualFold(value.Scheme, "http") {
		return "80"
	}
	return ""
}
