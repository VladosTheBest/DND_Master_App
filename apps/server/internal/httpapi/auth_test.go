package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAuthLoginSessionFlow(t *testing.T) {
	manager := newAuthManager(AuthOptions{
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

func TestHandleSessionRenewsCookieExpiry(t *testing.T) {
	manager := newAuthManager(AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})

	token := "session-token"
	initialExpiry := time.Now().Add(5 * time.Minute)
	manager.sessions[token] = authSession{
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
	manager := newAuthManager(AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})

	token, err := manager.issueSessionToken("vladyur4ik", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("expected token creation to succeed, got %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	request.AddCookie(&http.Cookie{
		Name:  manager.cookieName,
		Value: token,
	})

	username, ok := manager.currentUser(request)
	if !ok {
		t.Fatal("expected currentUser to recover a valid signed cookie")
	}

	if username != "vladyur4ik" {
		t.Fatalf("expected username %q, got %q", "vladyur4ik", username)
	}

	if _, exists := manager.sessions[token]; !exists {
		t.Fatal("expected recovered session to be hydrated into the in-memory cache")
	}
}
