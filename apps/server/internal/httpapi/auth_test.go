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

func TestAuthBootstrapClaimsFreshStarterStore(t *testing.T) {
	manager, store := newTestAuthManager(t, AuthOptions{
		Username: "deployment-admin",
		Password: "unique-deployment-password",
	})

	if len(store.data.Users) != 1 {
		t.Fatalf("bootstrap users = %d, want 1", len(store.data.Users))
	}
	owner := store.data.Users[0]
	if owner.Username != "deployment-admin" {
		t.Fatalf("bootstrap username = %q", owner.Username)
	}
	if len(store.data.Campaigns) == 0 {
		t.Fatal("fresh store did not create a starter campaign")
	}
	for _, campaign := range store.data.Campaigns {
		if campaign.OwnerID != owner.ID {
			t.Fatalf("starter campaign %q owner = %q, want %q", campaign.ID, campaign.OwnerID, owner.ID)
		}
	}

	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"deployment-admin","password":"unique-deployment-password"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginRecorder := httptest.NewRecorder()
	manager.handleLogin(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("configured deployment login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}

	unknownRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"deployment-admin","password":"published-old-password"}`))
	unknownRequest.Header.Set("Content-Type", "application/json")
	unknownRecorder := httptest.NewRecorder()
	manager.handleLogin(unknownRecorder, unknownRequest)
	if unknownRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("unconfigured password login status = %d, want %d", unknownRecorder.Code, http.StatusUnauthorized)
	}
}

func TestAuthBootstrapDoesNotOverwriteExistingAccount(t *testing.T) {
	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("newCampaignStore() error = %v", err)
	}
	existing, err := store.createUser("existing-admin", "preserved-password")
	if err != nil {
		t.Fatalf("create existing user: %v", err)
	}

	manager, err := newAuthManager(AuthOptions{
		Username: "replacement-admin",
		Password: "replacement-password",
	}, store)
	if err != nil {
		t.Fatalf("newAuthManager() error = %v", err)
	}
	persisted, ok := store.findUserByUsername("existing-admin")
	if !ok || persisted.ID != existing.ID || !verifyPassword(persisted.PasswordHash, "preserved-password") {
		t.Fatalf("bootstrap credentials changed the existing account: %#v", persisted)
	}
	if _, ok := store.findUserByUsername("replacement-admin"); ok {
		t.Fatal("bootstrap credentials created a replacement user in a non-empty store")
	}

	replacementRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"replacement-admin","password":"replacement-password"}`))
	replacementRequest.Header.Set("Content-Type", "application/json")
	replacementRecorder := httptest.NewRecorder()
	manager.handleLogin(replacementRecorder, replacementRequest)
	if replacementRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("replacement credentials status = %d, want %d", replacementRecorder.Code, http.StatusUnauthorized)
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
	oldTokenReplay := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	oldTokenReplay.AddCookie(&http.Cookie{Name: manager.cookieName, Value: token})
	if _, authenticated := manager.currentUser(oldTokenReplay); authenticated {
		t.Fatal("session renewal left the rotated opaque token usable")
	}
	renewedRequest := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	renewedRequest.AddCookie(cookies[0])
	if _, authenticated := manager.currentUser(renewedRequest); !authenticated {
		t.Fatal("renewed opaque session was not accepted")
	}
}

func TestCurrentUserRejectsUnknownOpaqueCookie(t *testing.T) {
	manager, _ := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})

	request := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	request.AddCookie(&http.Cookie{
		Name:  manager.cookieName,
		Value: "session_valid-looking-but-not-server-issued",
	})

	if currentUser, authenticated := manager.currentUser(request); authenticated {
		t.Fatalf("unknown opaque cookie authenticated as %#v", currentUser)
	}
}

func TestAuthLogoutRejectsReplayOfOriginalCookie(t *testing.T) {
	manager, _ := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})
	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"vladyur4ik","password":"secret"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginRecorder := httptest.NewRecorder()
	manager.handleLogin(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusOK || len(loginRecorder.Result().Cookies()) == 0 {
		t.Fatalf("login status=%d cookies=%d body=%s", loginRecorder.Code, len(loginRecorder.Result().Cookies()), loginRecorder.Body.String())
	}
	originalCookie := loginRecorder.Result().Cookies()[0]

	beforeLogout := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	beforeLogout.AddCookie(originalCookie)
	if _, authenticated := manager.currentUser(beforeLogout); !authenticated {
		t.Fatal("freshly issued opaque session was not accepted")
	}

	logoutRequest := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutRequest.AddCookie(originalCookie)
	logoutRecorder := httptest.NewRecorder()
	manager.handleLogout(logoutRecorder, logoutRequest)
	if logoutRecorder.Code != http.StatusOK {
		t.Fatalf("logout status=%d body=%s", logoutRecorder.Code, logoutRecorder.Body.String())
	}

	replayRequest := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	replayRequest.AddCookie(&http.Cookie{Name: originalCookie.Name, Value: originalCookie.Value})
	if replayedUser, authenticated := manager.currentUser(replayRequest); authenticated {
		t.Fatalf("logged-out cookie replay authenticated as %#v", replayedUser)
	}
	sessionRecorder := httptest.NewRecorder()
	manager.handleSession(sessionRecorder, replayRequest)
	if sessionRecorder.Code != http.StatusOK || !strings.Contains(sessionRecorder.Body.String(), `"authenticated":false`) {
		t.Fatalf("replayed cookie session response status=%d body=%s", sessionRecorder.Code, sessionRecorder.Body.String())
	}
}

func TestEphemeralSessionRemainsServerRevocable(t *testing.T) {
	manager, store := newTestAuthManager(t, AuthOptions{
		Username:   "vladyur4ik",
		Password:   "secret",
		SessionTTL: time.Hour,
	})
	user, ok := store.findUserByUsername("vladyur4ik")
	if !ok {
		t.Fatal("expected bootstrap user")
	}
	token, err := manager.issueEphemeralSession(authUser{ID: user.ID, Username: user.Username}, time.Now().Add(time.Minute))
	if err != nil {
		t.Fatalf("issue ephemeral session: %v", err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	request.AddCookie(&http.Cookie{Name: manager.cookieName, Value: token})
	if _, authenticated := manager.currentUser(request); !authenticated {
		t.Fatal("fresh ephemeral session was not accepted")
	}
	manager.revokeSession(token)
	replay := httptest.NewRequest(http.MethodGet, "/api/campaigns", nil)
	replay.AddCookie(&http.Cookie{Name: manager.cookieName, Value: token})
	if replayedUser, authenticated := manager.currentUser(replay); authenticated {
		t.Fatalf("revoked ephemeral session authenticated as %#v", replayedUser)
	}
}

func TestCORSAllowsOnlyExactLoopbackDevOrigin(t *testing.T) {
	for _, origin := range []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://[::1]:5173",
	} {
		if !isAllowedCORSOrigin(origin) {
			t.Fatalf("expected exact development origin %q to be allowed", origin)
		}
	}
	for _, origin := range []string{
		"http://localhost:5174",
		"http://127.0.0.1:8080",
		"http://localhost.evil.example:5173",
		"https://example.com",
	} {
		if isAllowedCORSOrigin(origin) {
			t.Fatalf("unexpected CORS origin allowed: %q", origin)
		}
	}

	trustedRequest := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8080/api/campaigns", nil)
	trustedRequest.Header.Set("Origin", "http://localhost:5173")
	trustedRecorder := httptest.NewRecorder()
	applyCORSHeaders(trustedRecorder, trustedRequest)
	if got := trustedRecorder.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("trusted development CORS origin = %q", got)
	}

	productionRequest := httptest.NewRequest(http.MethodGet, "https://dnd.example.com/api/campaigns", nil)
	productionRequest.Header.Set("Origin", "http://localhost:5173")
	productionRecorder := httptest.NewRecorder()
	applyCORSHeaders(productionRecorder, productionRequest)
	if got := productionRecorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("production API reflected a development origin: %q", got)
	}
}

func TestServerRejectsUntrustedOriginForAuthenticatedMutation(t *testing.T) {
	handler, err := NewServer(Options{
		DataFile:  filepath.Join(t.TempDir(), "store.json"),
		UploadDir: t.TempDir(),
	})
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}

	registerRequest := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/auth/register", strings.NewReader(`{"username":"origin-owner","password":"secret123"}`))
	registerRequest.Header.Set("Content-Type", "application/json")
	registerRecorder := httptest.NewRecorder()
	handler.ServeHTTP(registerRecorder, registerRequest)
	if registerRecorder.Code != http.StatusOK || len(registerRecorder.Result().Cookies()) == 0 {
		t.Fatalf("register status=%d body=%s", registerRecorder.Code, registerRecorder.Body.String())
	}
	sessionCookie := registerRecorder.Result().Cookies()[0]

	hostileRequest := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/campaigns", strings.NewReader(`{"title":"Blocked"}`))
	hostileRequest.Header.Set("Content-Type", "application/json")
	hostileRequest.Header.Set("Origin", "http://localhost:9999")
	hostileRequest.AddCookie(sessionCookie)
	hostileRecorder := httptest.NewRecorder()
	handler.ServeHTTP(hostileRecorder, hostileRequest)
	if hostileRecorder.Code != http.StatusForbidden || !strings.Contains(hostileRecorder.Body.String(), `"code":"origin_not_allowed"`) {
		t.Fatalf("hostile mutation status=%d body=%s", hostileRecorder.Code, hostileRecorder.Body.String())
	}

	trustedRequest := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/campaigns", strings.NewReader(`{"title":"Allowed"}`))
	trustedRequest.Header.Set("Content-Type", "application/json")
	trustedRequest.Header.Set("Origin", "http://localhost:5173")
	trustedRequest.AddCookie(sessionCookie)
	trustedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(trustedRecorder, trustedRequest)
	if trustedRecorder.Code != http.StatusCreated {
		t.Fatalf("trusted development mutation status=%d body=%s", trustedRecorder.Code, trustedRecorder.Body.String())
	}

	sameOriginRequest := httptest.NewRequest(http.MethodPost, "https://dnd.example.com:443/api/campaigns", strings.NewReader(`{"title":"Same origin"}`))
	sameOriginRequest.Header.Set("Content-Type", "application/json")
	sameOriginRequest.Header.Set("Origin", "https://dnd.example.com")
	sameOriginRequest.AddCookie(sessionCookie)
	sameOriginRecorder := httptest.NewRecorder()
	handler.ServeHTTP(sameOriginRecorder, sameOriginRequest)
	if sameOriginRecorder.Code != http.StatusCreated {
		t.Fatalf("same-origin mutation status=%d body=%s", sameOriginRecorder.Code, sameOriginRecorder.Body.String())
	}
}
