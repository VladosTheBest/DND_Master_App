package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPasswordRecoveryRevokesCodesAndSessions(t *testing.T) {
	root := t.TempDir()
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: filepath.Join(root, "uploads")})
	if err != nil {
		t.Fatal(err)
	}
	owner := registerAccountTestUser(t, handler, "recover-owner")
	other := registerAccountTestUser(t, handler, "recover-other")
	// The registration helper uses this password; never use real credentials here.
	for _, password := range []string{"wrong-password"} {
		result := personalAIRequest(t, handler, "POST", "/api/account/recovery-codes", `{"password":"`+password+`"}`, owner)
		if result.Code != 403 {
			t.Fatal(result.Code, result.Body.String())
		}
	}
	generated := personalAIRequest(t, handler, "POST", "/api/account/recovery-codes", `{"password":"secret123"}`, owner)
	if generated.Code != 200 {
		t.Fatal(generated.Code, generated.Body.String())
	}
	var envelope struct {
		Data struct {
			Codes []string `json:"codes"`
		} `json:"data"`
	}
	if json.Unmarshal(generated.Body.Bytes(), &envelope) != nil || len(envelope.Data.Codes) != 8 {
		t.Fatal(generated.Body.String())
	}
	code := envelope.Data.Codes[0]
	status := personalAIRequest(t, handler, "GET", "/api/account/recovery-codes", "", owner)
	if strings.Contains(status.Body.String(), code) || !strings.Contains(status.Body.String(), `"remaining":8`) {
		t.Fatal("codes exposed/status wrong")
	}
	payload := `{"username":"recover-owner","code":"` + code + `","newPassword":"new-secret123"}`
	if result := personalAIRequest(t, handler, "POST", "/api/auth/recover", strings.Replace(payload, "recover-owner", "recover-other", 1), nil); result.Code != 400 {
		t.Fatal("cross-owner accepted", result.Code)
	}
	if result := personalAIRequest(t, handler, "POST", "/api/auth/recover", payload, nil); result.Code != 200 {
		t.Fatal(result.Code, result.Body.String())
	}
	if personalAIRequest(t, handler, "GET", "/api/account/ai", "", owner).Code != 401 {
		t.Fatal("old session survived")
	}
	if personalAIRequest(t, handler, "GET", "/api/account/ai", "", other).Code != 200 {
		t.Fatal("other account revoked")
	}
	if personalAIRequest(t, handler, "POST", "/api/auth/recover", payload, nil).Code != 400 {
		t.Fatal("code replay accepted")
	}
	login := personalAIRequest(t, handler, "POST", "/api/auth/login", `{"username":"recover-owner","password":"new-secret123"}`, nil)
	if login.Code != 200 {
		t.Fatal("new password login", login.Code)
	}
	if personalAIRequest(t, handler, "POST", "/api/auth/login", `{"username":"recover-owner","password":"secret123"}`, nil).Code != 401 {
		t.Fatal("old password accepted")
	}
}

func TestPasswordRecoveryEpochRejectsDelayedLoginAndEphemeralSession(t *testing.T) {
	manager, store := newTestAuthManager(t, AuthOptions{})
	account, err := store.createUser("epoch-owner", "secret123")
	if err != nil {
		t.Fatal(err)
	}
	verifiedBeforeReset := authUser{ID: account.ID, Username: account.Username, AuthVersion: account.AuthVersion}
	store.mu.Lock()
	store.data.Users[0].AuthVersion++
	store.mu.Unlock()
	// Simulate password verification completing before reset, then session issuance after it.
	w := httptest.NewRecorder()
	manager.writeAuthenticatedSession(w, httptest.NewRequest("POST", "/", nil), verifiedBeforeReset)
	r := httptest.NewRequest("GET", "/", nil)
	for _, cookie := range w.Result().Cookies() {
		r.AddCookie(cookie)
	}
	if _, ok := manager.currentUser(r); ok {
		t.Fatal("delayed old-password login survived reset")
	}
	token, err := manager.issueEphemeralSession(verifiedBeforeReset, time.Now().Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	r = httptest.NewRequest("GET", "/", nil)
	r.AddCookie(&http.Cookie{Name: manager.cookieName, Value: token})
	if _, ok := manager.currentUser(r); ok {
		t.Fatal("stale bridge capability survived reset")
	}
}

func TestPasswordRecoveryExpiryAndRateLimit(t *testing.T) {
	manager, store := newTestAuthManager(t, AuthOptions{})
	account, err := store.createUser("expired-owner", "secret123")
	if err != nil {
		t.Fatal(err)
	}
	store.mu.Lock()
	store.data.Users[0].RecoveryCodes = []recoveryCode{{Digest: recoveryDigest(account.ID, "EXPIRED"), ExpiresAt: time.Now().Add(-time.Hour)}}
	store.mu.Unlock()
	srv := &server{store: store, auth: manager}
	r := httptest.NewRequest("POST", "/api/auth/recover", strings.NewReader(`{"username":"expired-owner","code":"EXPIRED","newPassword":"new-secret123"}`))
	r.Header.Set("Origin", "http://example.com")
	w := httptest.NewRecorder()
	srv.handlePasswordRecovery(w, r)
	if w.Code != 400 {
		t.Fatal("expired code accepted", w.Code)
	}
	for i := 0; i < 4; i++ {
		if !manager.allowRecovery(r, "expired-owner") {
			t.Fatal("early limit")
		}
	}
	if manager.allowRecovery(r, "expired-owner") {
		t.Fatal("rate limit missing")
	}
}
