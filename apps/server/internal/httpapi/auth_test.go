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
