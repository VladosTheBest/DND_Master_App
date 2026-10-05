package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestAdminGoogleVerifiedSession(t *testing.T) {
	for _, tc := range []struct {
		name, email, provider    string
		verified, admin, allowed bool
	}{
		{"owner", "owner@example.com", "google", true, true, true},
		{"unverified", "owner@example.com", "google", false, true, false},
		{"other", "other@example.com", "google", true, true, false},
		{"normal login", "owner@example.com", "google", true, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			m, store := oauthTestManager(t)
			m.oauth.AdminEmail = "owner@example.com"
			m.oauthClient = &http.Client{Transport: oauthTestTransport(func(r *http.Request) (*http.Response, error) {
				body := `{"access_token":"token","token_type":"Bearer"}`
				if r.Method == http.MethodGet {
					value := map[string]any{"sub": "owner-subject", "email": tc.email, "email_verified": tc.verified}
					b, _ := json.Marshal(value)
					body = string(b)
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
			})}
			query := ""
			if tc.admin {
				query = "?admin=1"
			}
			state, binding := oauthStart(t, m, tc.provider, query, nil)
			response := oauthCallback(m, tc.provider, state, binding, nil)
			r := httptest.NewRequest("GET", "https://app.example/api/admin/subscriptions", nil)
			if cookie := sessionCookie(response); cookie != nil {
				r.AddCookie(cookie)
			}
			_, allowed := m.adminUser(r)
			if allowed != tc.allowed {
				t.Fatalf("admin access=%v", allowed)
			}
			if tc.admin && !tc.allowed && len(store.data.Users) != 0 {
				t.Fatal("denied admin created account")
			}
			if allowed {
				rec := httptest.NewRecorder()
				m.handleSession(rec, r)
				rotated := httptest.NewRequest("GET", "https://app.example/api/admin/subscriptions", nil)
				rotated.AddCookie(sessionCookie(rec))
				if _, ok := m.adminUser(rotated); !ok {
					t.Fatal("rotation lost admin")
				}
				m.mu.Lock()
				for token, s := range m.sessions {
					s.AdminUntil = time.Now().Add(-time.Second)
					m.sessions[token] = s
				}
				m.mu.Unlock()
				if _, ok := m.adminUser(rotated); ok {
					t.Fatal("expired admin accepted")
				}
			}
		})
	}
}

func TestAdminGrantRevokeAndPersistence(t *testing.T) {
	m, store := oauthTestManager(t)
	m.oauth.AdminEmail = "owner@example.com"
	user, err := store.createUser("target-user", "password123")
	if err != nil {
		t.Fatal(err)
	}
	m.sessions["admin-test"] = authSession{UserID: user.ID, Username: user.Username, ExpiresAt: time.Now().Add(time.Hour), AdminUntil: time.Now().Add(time.Hour), AdminEmail: "owner@example.com"}
	srv := &server{auth: m, store: store}
	call := func(method, token, origin, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "https://app.example/api/admin/subscriptions", strings.NewReader(body))
		r.Header.Set("Origin", origin)
		r.AddCookie(&http.Cookie{Name: m.cookieName, Value: token})
		w := httptest.NewRecorder()
		srv.handleAdminSubscriptions(w, r)
		return w
	}
	grant := `{"accountId":"` + user.ID + `","action":"grant","planId":"gm","days":30,"reason":"Test grant","expected":null}`
	if r := call("POST", "", "https://app.example", grant); r.Code != 403 {
		t.Fatal("anonymous allowed")
	}
	m.sessions["password-test"] = authSession{UserID: user.ID, ExpiresAt: time.Now().Add(time.Hour)}
	if r := call("GET", "password-test", "", ""); r.Code != 403 {
		t.Fatal("password session allowed")
	}
	for _, origin := range []string{"", "https://evil.example"} {
		if r := call("POST", "admin-test", origin, grant); r.Code != 403 {
			t.Fatal("bad origin allowed")
		}
	}
	if r := call("POST", "admin-test", "https://app.example", strings.Replace(grant, `"days":30`, `"days":0`, 1)); r.Code != 400 {
		t.Fatal("bad duration accepted")
	}
	store.atomicFileWrite = func(string, []byte, os.FileMode) error { return errors.New("test disk error") }
	if r := call("POST", "admin-test", "https://app.example", grant); r.Code != 500 {
		t.Fatal("save failure hidden")
	}
	failedUser, _ := store.getUserByID(user.ID)
	if failedUser.Subscription != nil || len(store.data.SubscriptionAudits) != 0 {
		t.Fatal("failed mutation not rolled back")
	}
	store.atomicFileWrite = nil
	if r := call("POST", "admin-test", "https://app.example", grant); r.Code != 200 {
		t.Fatal(r.Body.String())
	}
	u, _ := store.getUserByID(user.ID)
	if !subscriptionActive(u.Subscription, time.Now()) {
		t.Fatal("grant inactive")
	}
	if len(store.data.SubscriptionAudits) != 1 {
		t.Fatal("missing audit")
	}
	if r := call("POST", "admin-test", "https://app.example", grant); r.Code != 409 {
		t.Fatal("stale write accepted")
	}
	if r := call("GET", "admin-test", "", ""); strings.Contains(r.Body.String(), "passwordHash") || r.Code != 200 {
		t.Fatal("unsafe listing")
	}
	metadata, records, err := splitCloudState(store.data)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := joinCloudState(metadata, records)
	if err != nil {
		t.Fatal(err)
	}
	if len(restored.SubscriptionAudits) != 1 {
		t.Fatal("SQL codec lost audit")
	}
	loaded, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.data.SubscriptionAudits) != 1 {
		t.Fatal("reload lost audit")
	}
	expected, _ := json.Marshal(u.Subscription)
	revoke := `{"accountId":"` + user.ID + `","action":"revoke","reason":"Test revoke","expected":` + string(expected) + `}`
	if r := call("POST", "admin-test", "https://app.example", revoke); r.Code != 200 {
		t.Fatal(r.Body.String())
	}
	u, _ = store.getUserByID(user.ID)
	if subscriptionActive(u.Subscription, time.Now()) {
		t.Fatal("revocation inactive gate failed")
	}
}

func TestAdminIdentityFailsClosed(t *testing.T) {
	m, _ := oauthTestManager(t)
	id := oauthIdentity{Provider: "google", Subject: "owner", Email: "owner@example.com", EmailVerified: true}
	if m.allowedAdminIdentity(id) {
		t.Fatal("unset policy allowed access")
	}
	m.oauth.AdminEmail = "owner@example.com"
	id.Provider = "discord"
	if m.allowedAdminIdentity(id) {
		t.Fatal("Discord allowed admin")
	}
}
