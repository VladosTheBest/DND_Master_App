package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

type oauthTestTransport func(*http.Request) (*http.Response, error)

func (f oauthTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func oauthTestManager(t *testing.T) (*authManager, *campaignStore) {
	t.Helper()
	return newTestAuthManager(t, AuthOptions{OAuth: OAuthOptions{BaseURL: "https://app.example", GoogleClientID: "google-client", GoogleClientSecret: "test-secret", DiscordClientID: "discord-client", DiscordClientSecret: "test-secret"}})
}
func oauthStart(t *testing.T, m *authManager, provider, query string, session *http.Cookie) (string, *http.Cookie) {
	t.Helper()
	req := httptest.NewRequest("POST", "https://app.example/api/auth/oauth/"+provider+"/start"+query, nil)
	req.Header.Set("Origin", "https://app.example")
	if session != nil {
		req.AddCookie(session)
	}
	rec := httptest.NewRecorder()
	m.handleOAuth(rec, req)
	if rec.Code != 200 {
		t.Fatalf("start: %d %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if e := json.Unmarshal(rec.Body.Bytes(), &payload); e != nil {
		t.Fatal(e)
	}
	u, e := url.Parse(payload.Data.URL)
	if e != nil {
		t.Fatal(e)
	}
	if u.Query().Get("redirect_uri") != m.oauthRedirect(provider) {
		t.Fatal("wrong redirect URI")
	}
	if provider == "google" && (u.Query().Get("code_challenge_method") != "S256" || u.Query().Get("code_challenge") == "") {
		t.Fatal("missing PKCE")
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || !cookies[0].Secure || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatal("unsafe state cookie")
	}
	return u.Query().Get("state"), cookies[0]
}
func oauthCallback(m *authManager, provider, state string, binding, session *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", "https://app.example/api/auth/oauth/"+provider+"/callback?state="+state+"&code=provider-code", nil)
	if binding != nil {
		req.AddCookie(binding)
	}
	if session != nil {
		req.AddCookie(session)
	}
	rec := httptest.NewRecorder()
	m.handleOAuth(rec, req)
	return rec
}
func fakeOAuthIdentity(t *testing.T, m *authManager, provider, subject string) *int {
	t.Helper()
	calls := new(int)
	m.oauthClient = &http.Client{Transport: oauthTestTransport(func(r *http.Request) (*http.Response, error) {
		*calls++
		body := ""
		if r.Method == "POST" {
			if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
				t.Fatal("wrong token content type")
			}
			if e := r.ParseForm(); e != nil {
				t.Fatal(e)
			}
			if r.Form.Get("grant_type") != "authorization_code" || r.Form.Get("code") != "provider-code" || r.Form.Get("client_secret") != "test-secret" || r.Form.Get("redirect_uri") != m.oauthRedirect(provider) {
				t.Fatal("incorrect actual token request")
			}
			if provider == "google" && r.Form.Get("code_verifier") == "" {
				t.Fatal("missing verifier")
			}
			body = `{"access_token":"temporary-test-token","token_type":"Bearer"}`
		} else {
			if r.Header.Get("Authorization") != "Bearer temporary-test-token" {
				t.Fatal("userinfo is not authenticated")
			}
			if provider == "google" {
				body = `{"sub":"` + subject + `"}`
			} else {
				body = `{"id":"` + subject + `"}`
			}
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	return calls
}
func sessionCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == "shadow_edge_session" {
			return c
		}
	}
	return nil
}
func TestOAuthRegistrationRepeatAndPersistence(t *testing.T) {
	for _, provider := range []string{"google", "discord"} {
		t.Run(provider, func(t *testing.T) {
			m, store := oauthTestManager(t)
			fakeOAuthIdentity(t, m, provider, "subject-1")
			state, binding := oauthStart(t, m, provider, "", nil)
			rec := oauthCallback(m, provider, state, binding, nil)
			cookie := sessionCookie(rec)
			if rec.Code != 303 || cookie == nil || !cookie.Secure || !cookie.HttpOnly {
				t.Fatalf("callback %d %s", rec.Code, rec.Header().Get("Location"))
			}
			req := httptest.NewRequest("GET", "https://app.example/api/auth/session", nil)
			req.AddCookie(cookie)
			user, ok := m.currentUser(req)
			if !ok {
				t.Fatal("no authenticated session")
			}
			if len(store.data.Users) != 1 || store.data.Users[0].ID != user.ID {
				t.Fatal("account not created")
			}
			state, binding = oauthStart(t, m, provider, "", nil)
			rec = oauthCallback(m, provider, state, binding, nil)
			if len(store.data.Users) != 1 {
				t.Fatal("duplicate account")
			}
			reopened, e := newCampaignStore(store.path)
			if e != nil {
				t.Fatal(e)
			}
			same, e := reopened.resolveOAuthUser(provider, "subject-1", "", false)
			if e != nil || same.ID != user.ID {
				t.Fatal("identity not preserved after restart")
			}
		})
	}
}
func TestOAuthStateBindingReplayAndProviderMixup(t *testing.T) {
	m, store := oauthTestManager(t)
	calls := fakeOAuthIdentity(t, m, "google", "subject")
	state, binding := oauthStart(t, m, "google", "", nil)
	for _, test := range []struct {
		provider, state string
		cookie          *http.Cookie
	}{{"google", state, nil}, {"google", "unknown", binding}, {"discord", state, binding}} {
		rec := oauthCallback(m, test.provider, test.state, test.cookie, nil)
		if !strings.Contains(rec.Header().Get("Location"), "invalid_state") {
			t.Fatal("accepted invalid state")
		}
	}
	if *calls != 0 || len(store.data.Users) != 0 {
		t.Fatal("invalid callback reached provider")
	}
	oauthCallback(m, "google", state, binding, nil)
	before := *calls
	rec := oauthCallback(m, "google", state, binding, nil)
	if *calls != before || !strings.Contains(rec.Header().Get("Location"), "invalid_state") {
		t.Fatal("replayed callback accepted")
	}
	state, binding = oauthStart(t, m, "google", "", nil)
	m.mu.Lock()
	a := m.oauthPending[state]
	a.ExpiresAt = time.Now().Add(-time.Second)
	m.oauthPending[state] = a
	m.mu.Unlock()
	if !strings.Contains(oauthCallback(m, "google", state, binding, nil).Header().Get("Location"), "invalid_state") {
		t.Fatal("expired state accepted")
	}
}
func TestOAuthLinkReplacePreservesLegacyOwnership(t *testing.T) {
	m, store := oauthTestManager(t)
	legacy, e := store.createUser("legacy-master", "password123")
	if e != nil {
		t.Fatal(e)
	}
	rec := httptest.NewRecorder()
	m.writeAuthenticatedSession(rec, httptest.NewRequest("POST", "https://app.example", nil), authUser{legacy.ID, legacy.Username})
	session := sessionCookie(rec)
	owner := store.data.Campaigns[0].OwnerID
	fakeOAuthIdentity(t, m, "google", "old-subject")
	state, binding := oauthStart(t, m, "google", "", session) // Automatic linking in authenticated context.
	if !strings.Contains(oauthCallback(m, "google", state, binding, session).Header().Get("Location"), "success") {
		t.Fatal("link failed")
	}
	fakeOAuthIdentity(t, m, "discord", "discord-subject")
	state, binding = oauthStart(t, m, "discord", "?link=1", session)
	oauthCallback(m, "discord", state, binding, session)
	fakeOAuthIdentity(t, m, "google", "new-subject")
	state, binding = oauthStart(t, m, "google", "?replace=1", session)
	oauthCallback(m, "google", state, binding, session)
	same, e := store.resolveOAuthUser("google", "new-subject", "", false)
	if e != nil || same.ID != legacy.ID || len(store.data.Users) != 1 || store.data.Campaigns[0].OwnerID != owner || !verifyPassword(same.PasswordHash, "password123") || len(same.OAuthIdentities) != 2 {
		t.Fatal("legacy data changed")
	}
	for _, id := range same.OAuthIdentities {
		if id.Subject == "old-subject" {
			t.Fatal("old identity retained")
		}
	}
	reopened, e := newCampaignStore(store.path)
	if e != nil {
		t.Fatal(e)
	}
	same, e = reopened.resolveOAuthUser("discord", "discord-subject", "", false)
	if e != nil || same.ID != legacy.ID {
		t.Fatal("linked identity lost")
	}
}
func TestOAuthLinkConflictAndChangedSession(t *testing.T) {
	m, store := oauthTestManager(t)
	a, _ := store.createUser("master-a", "password123")
	b, _ := store.createUser("master-b", "password123")
	store.resolveOAuthUser("google", "taken", a.ID, false)
	if _, e := store.resolveOAuthUser("google", "taken", b.ID, true); !errors.Is(e, errIdentityConflict) {
		t.Fatal("identity stolen")
	}
	rec := httptest.NewRecorder()
	m.writeAuthenticatedSession(rec, httptest.NewRequest("POST", "https://app.example", nil), authUser{b.ID, b.Username})
	session := sessionCookie(rec)
	calls := fakeOAuthIdentity(t, m, "google", "other")
	state, binding := oauthStart(t, m, "google", "?link=1", session)
	result := oauthCallback(m, "google", state, binding, nil)
	if *calls != 0 || !strings.Contains(result.Header().Get("Location"), "session_changed") {
		t.Fatal("logged-out link accepted")
	}
	m.mu.Lock()
	s := m.sessions[session.Value]
	s.AuthenticatedAt = time.Now().Add(-time.Hour)
	m.sessions[session.Value] = s
	m.mu.Unlock()
	req := httptest.NewRequest("POST", "https://app.example/api/auth/oauth/google/start?replace=1", nil)
	req.AddCookie(session)
	rec = httptest.NewRecorder()
	m.handleOAuth(rec, req)
	if rec.Code != 403 || !strings.Contains(rec.Body.String(), "reauth_required") {
		t.Fatal("stale replacement accepted")
	}
}
func TestOAuthAtomicFailureAndConcurrentIdentity(t *testing.T) {
	_, store := oauthTestManager(t)
	store.atomicFileWrite = func(string, []byte, os.FileMode) error { return errors.New("disk unavailable") }
	if _, e := store.resolveOAuthUser("google", "first", "", false); e == nil || len(store.data.Users) != 0 {
		t.Fatal("failed save changed memory")
	}
	store.atomicFileWrite = nil
	var wg sync.WaitGroup
	ids := make(chan string, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			u, e := store.resolveOAuthUser("google", "same", "", false)
			if e != nil {
				t.Error(e)
				return
			}
			ids <- u.ID
		}()
	}
	wg.Wait()
	close(ids)
	first := ""
	for id := range ids {
		if first == "" {
			first = id
		}
		if id != first {
			t.Fatal("concurrent duplicates")
		}
	}
	if len(store.data.Users) != 1 {
		t.Fatal("multiple accounts")
	}
}
func TestOAuthStartMethodsOriginAndUnavailable(t *testing.T) {
	m, _ := oauthTestManager(t)
	for _, test := range []struct {
		method, path, origin string
		status               int
	}{
		{"GET", "google/start", "", 405}, {"POST", "google/start", "https://evil.example", 403}, {"POST", "google/start?link=1", "", 401}, {"POST", "google/start?replace=1", "", 401},
	} {
		req := httptest.NewRequest(test.method, "https://app.example/api/auth/oauth/"+test.path, nil)
		req.Header.Set("Origin", test.origin)
		rec := httptest.NewRecorder()
		m.handleOAuth(rec, req)
		if rec.Code != test.status {
			t.Fatalf("%s: %d", test.path, rec.Code)
		}
	}
	m.oauth.GoogleClientSecret = ""
	req := httptest.NewRequest("POST", "https://app.example/api/auth/oauth/google/start", nil)
	rec := httptest.NewRecorder()
	m.handleOAuth(rec, req)
	if rec.Code != 503 {
		t.Fatal("unconfigured provider enabled")
	}
}

func TestOAuthProviderFailuresAndCancellationNeverCreateSession(t *testing.T) {
	for _, body := range []string{`{"error":"secret-provider-error"}`, `{"access_token":"token","token_type":"unexpected"}`} {
		m, store := oauthTestManager(t)
		m.oauthClient = &http.Client{Transport: oauthTestTransport(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
		})}
		state, binding := oauthStart(t, m, "google", "", nil)
		rec := oauthCallback(m, "google", state, binding, nil)
		if !strings.Contains(rec.Header().Get("Location"), "provider_failed") || sessionCookie(rec) != nil || len(store.data.Users) != 0 || strings.Contains(rec.Header().Get("Location"), "secret-provider-error") {
			t.Fatal("unsafe provider failure")
		}
	}
	m, store := oauthTestManager(t)
	calls := fakeOAuthIdentity(t, m, "google", "id")
	state, binding := oauthStart(t, m, "google", "", nil)
	req := httptest.NewRequest("GET", "https://app.example/api/auth/oauth/google/callback?state="+state+"&error=access_denied", nil)
	req.AddCookie(binding)
	rec := httptest.NewRecorder()
	m.handleOAuth(rec, req)
	if *calls != 0 || len(store.data.Users) != 0 || !strings.Contains(rec.Header().Get("Location"), "denied") {
		t.Fatal("cancellation changed account")
	}
}

func TestOAuthReplacementRollbackAndNoCredentialPersistence(t *testing.T) {
	m, store := oauthTestManager(t)
	fakeOAuthIdentity(t, m, "google", "initial")
	state, binding := oauthStart(t, m, "google", "", nil)
	oauthCallback(m, "google", state, binding, nil)
	user := store.data.Users[0]
	raw, e := os.ReadFile(store.path)
	if e != nil {
		t.Fatal(e)
	}
	if strings.Contains(string(raw), "temporary-test-token") || strings.Contains(string(raw), "test-secret") {
		t.Fatal("credential persisted")
	}
	store.atomicFileWrite = func(string, []byte, os.FileMode) error { return errors.New("disk unavailable") }
	if _, e := store.resolveOAuthUser("google", "replacement", user.ID, true); e == nil {
		t.Fatal("expected failed save")
	}
	if store.data.Users[0].OAuthIdentities[0].Subject != "initial" {
		t.Fatal("failed replacement lost previous login")
	}
	store.atomicFileWrite = nil
	same, e := store.resolveOAuthUser("google", "initial", "", false)
	if e != nil || same.ID != user.ID {
		t.Fatal("previous login lost")
	}
}

func TestOAuthSessionRotationDoesNotRenewReplacementAuthentication(t *testing.T) {
	m, _ := oauthTestManager(t)
	rec := httptest.NewRecorder()
	m.writeAuthenticatedSession(rec, httptest.NewRequest("POST", "https://app.example", nil), authUser{"test-id", "test-user"})
	cookie := sessionCookie(rec)
	m.mu.Lock()
	session := m.sessions[cookie.Value]
	session.AuthenticatedAt = time.Now().Add(-time.Hour)
	m.sessions[cookie.Value] = session
	m.mu.Unlock()
	req := httptest.NewRequest("GET", "https://app.example/api/auth/session", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	m.handleSession(rec, req)
	rotated := sessionCookie(rec)
	if rotated == nil {
		t.Fatal("session not rotated")
	}
	req = httptest.NewRequest("POST", "https://app.example/api/auth/oauth/google/start?replace=1", nil)
	req.AddCookie(rotated)
	rec = httptest.NewRecorder()
	m.handleOAuth(rec, req)
	if rec.Code != 403 {
		t.Fatal("rotation renewed authentication")
	}
}
