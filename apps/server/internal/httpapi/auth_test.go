package httpapi

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestAuthManager(t *testing.T, options AuthOptions) (*authManager, *campaignStore) {
	t.Helper()

	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}

	manager, err := newAuthManager(options, store)
	if err != nil {
		t.Fatalf("newAuthManager() error = %v", err)
	}

	return manager, store
}

func TestAuthLoginSessionFlow(t *testing.T) {
	manager, _ := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})

	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"vladyur4ik","password":"secret"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginRecorder := httptest.NewRecorder()

	manager.handleLogin(loginRecorder, loginRequest)

	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("expected login status 200, got %d", loginRecorder.Code)
	}

	cookies := loginRecorder.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie to be set")
	}

	sessionRequest := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	sessionRequest.AddCookie(cookies[0])
	sessionRecorder := httptest.NewRecorder()

	manager.handleSession(sessionRecorder, sessionRequest)

	if sessionRecorder.Code != http.StatusOK {
		t.Fatalf("expected session status 200, got %d", sessionRecorder.Code)
	}

	if !strings.Contains(sessionRecorder.Body.String(), `"authenticated":true`) {
		t.Fatalf("expected authenticated session payload, got %s", sessionRecorder.Body.String())
	}
}

func TestAuthRegisterCreatesSessionAndRejectsDuplicateUsername(t *testing.T) {
	manager, _ := newTestAuthManager(t, AuthOptions{SessionTTL: time.Hour})

	registerRequest := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{"username":"new-gm","password":"secret123"}`))
	registerRequest.Header.Set("Content-Type", "application/json")
	registerRecorder := httptest.NewRecorder()

	manager.handleRegister(registerRecorder, registerRequest)

	if registerRecorder.Code != http.StatusOK {
		t.Fatalf("expected register status 200, got %d: %s", registerRecorder.Code, registerRecorder.Body.String())
	}
	if !strings.Contains(registerRecorder.Body.String(), `"authenticated":true`) {
		t.Fatalf("expected authenticated register payload, got %s", registerRecorder.Body.String())
	}
	if len(registerRecorder.Result().Cookies()) == 0 {
		t.Fatal("expected register to set a session cookie")
	}

	duplicateRequest := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{"username":"NEW-GM","password":"secret123"}`))
	duplicateRequest.Header.Set("Content-Type", "application/json")
	duplicateRecorder := httptest.NewRecorder()

	manager.handleRegister(duplicateRecorder, duplicateRequest)

	if duplicateRecorder.Code != http.StatusConflict {
		t.Fatalf("expected duplicate register status 409, got %d", duplicateRecorder.Code)
	}
}

func TestAuthLoginRejectsWrongPassword(t *testing.T) {
	manager, _ := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})

	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"vladyur4ik","password":"wrong-password"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	manager.handleLogin(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected login status 401, got %d", recorder.Code)
	}
}

func TestHandleSessionRenewsCookieExpiry(t *testing.T) {
	manager, store := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})
	user, ok := store.findUserByUsername("vladyur4ik")
	if !ok {
		t.Fatal("expected bootstrap user")
	}

	token := "session-token"
	initialExpiry := time.Now().Add(5 * time.Minute)
	manager.sessions[token] = authSession{
		UserID:    user.ID,
		Username:  "vladyur4ik",
		ExpiresAt: initialExpiry,
	}

	request := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	request.AddCookie(&http.Cookie{
		Name:  manager.cookieName,
		Value: token,
	})
	recorder := httptest.NewRecorder()

	manager.handleSession(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected session status 200, got %d", recorder.Code)
	}

	cookies := recorder.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected renewed session cookie to be written")
	}

	if cookies[0].Name != manager.cookieName {
		t.Fatalf("expected cookie %q, got %q", manager.cookieName, cookies[0].Name)
	}

	renewed := manager.sessions[cookies[0].Value]
	if !renewed.ExpiresAt.After(initialExpiry) {
		t.Fatalf("expected session expiry to be renewed, got %v <= %v", renewed.ExpiresAt, initialExpiry)
	}
}

func TestCurrentUserRecoversFromSignedCookieWithoutInMemorySession(t *testing.T) {
	manager, store := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})
	user, ok := store.findUserByUsername("vladyur4ik")
	if !ok {
		t.Fatal("expected bootstrap user")
	}

	token, err := manager.issueSessionToken(authUser{ID: user.ID, Username: user.Username}, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("expected token creation to succeed, got %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	request.AddCookie(&http.Cookie{
		Name:  manager.cookieName,
		Value: token,
	})

	currentUser, ok := manager.currentUser(request)
	if !ok {
		t.Fatal("expected currentUser to recover a valid signed cookie")
	}

	if currentUser.Username != "vladyur4ik" {
		t.Fatalf("expected username %q, got %q", "vladyur4ik", currentUser.Username)
	}
	if currentUser.ID != user.ID {
		t.Fatalf("expected user ID %q, got %q", user.ID, currentUser.ID)
	}

	if _, exists := manager.sessions[token]; !exists {
		t.Fatal("expected recovered session to be hydrated into the in-memory cache")
	}
}
