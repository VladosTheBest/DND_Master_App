package httpapi

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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
	store             *campaignStore
	cookieName        string
	sessionTTL        time.Duration
	sessionSigningKey []byte

	mu       sync.Mutex
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

type signedSessionPayload struct {
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	ExpiresAt int64  `json:"expiresAt"`
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

	secret := strings.TrimSpace(store.authSecret())
	if secret == "" {
		return nil, fmt.Errorf("auth secret is not initialized")
	}

	ttl := options.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}

	return &authManager{
		store:             store,
		cookieName:        "shadow_edge_session",
		sessionTTL:        ttl,
		sessionSigningKey: []byte(secret),
		sessions:          make(map[string]authSession),
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
	if ok {
		return authUser{ID: session.UserID, Username: session.Username}, true
	}

	session, ok = manager.sessionFromToken(cookie.Value)
	if !ok {
		return authUser{}, false
	}

	manager.mu.Lock()
	manager.sessions[cookie.Value] = session
	manager.mu.Unlock()

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
		token, tokenErr := manager.issueSessionToken(user, expiresAt)
		if tokenErr == nil {
			manager.mu.Lock()
			manager.cleanupExpiredLocked(time.Now())
			delete(manager.sessions, cookie.Value)
			manager.sessions[token] = authSession{
				UserID:    user.ID,
				Username:  user.Username,
				ExpiresAt: expiresAt,
			}
			manager.mu.Unlock()
			manager.writeSessionCookie(writer, token, expiresAt, requestIsSecure(request))
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
	token, err := manager.issueSessionToken(user, expiresAt)
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
		if now.After(session.ExpiresAt) {
			delete(manager.sessions, token)
		}
	}
}

func (manager *authManager) issueSessionToken(user authUser, expiresAt time.Time) (string, error) {
	payloadBytes, err := json.Marshal(signedSessionPayload{
		UserID:    user.ID,
		Username:  user.Username,
		ExpiresAt: expiresAt.Unix(),
	})
	if err != nil {
		return "", err
	}

	signature := manager.signSessionPayload(payloadBytes)
	return base64.RawURLEncoding.EncodeToString(payloadBytes) + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func (manager *authManager) sessionFromToken(token string) (authSession, bool) {
	payloadToken, signatureToken, ok := strings.Cut(token, ".")
	if !ok || strings.TrimSpace(payloadToken) == "" || strings.TrimSpace(signatureToken) == "" {
		return authSession{}, false
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadToken)
	if err != nil {
		return authSession{}, false
	}
	signatureBytes, err := base64.RawURLEncoding.DecodeString(signatureToken)
	if err != nil {
		return authSession{}, false
	}

	expectedSignature := manager.signSessionPayload(payloadBytes)
	if !hmac.Equal(signatureBytes, expectedSignature) {
		return authSession{}, false
	}

	var payload signedSessionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return authSession{}, false
	}

	expiresAt := time.Unix(payload.ExpiresAt, 0)
	if time.Now().After(expiresAt) || strings.TrimSpace(payload.UserID) == "" {
		return authSession{}, false
	}

	user, ok := manager.store.getUserByID(payload.UserID)
	if !ok {
		return authSession{}, false
	}

	return authSession{
		UserID:    user.ID,
		Username:  user.Username,
		ExpiresAt: expiresAt,
	}, true
}

func (manager *authManager) signSessionPayload(payload []byte) []byte {
	mac := hmac.New(sha256.New, manager.sessionSigningKey)
	mac.Write(payload)
	return mac.Sum(nil)
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
