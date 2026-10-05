package httpapi

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSubscriptionPeriodAndPlan(t *testing.T) {
	now := time.Now().UTC()
	active := accountSubscription{"gm", "active", now.Add(-time.Hour), now.Add(time.Hour)}
	if !subscriptionActive(&active, now) {
		t.Fatal("active subscription rejected")
	}
	cases := []*accountSubscription{nil,
		{"unknown", "active", active.CurrentPeriodStart, active.CurrentPeriodEnd},
		{"gm", "past_due", active.CurrentPeriodStart, active.CurrentPeriodEnd},
		{"gm", "active", now.Add(time.Hour), now.Add(2 * time.Hour)},
		{"gm", "active", active.CurrentPeriodStart, now},
		{"gm", "active", time.Time{}, active.CurrentPeriodEnd},
	}
	for _, s := range cases {
		if subscriptionActive(s, now) {
			t.Fatalf("invalid subscription accepted: %+v", s)
		}
	}
}

func TestSubscriptionGateBeforeSyncAndAsyncGeneration(t *testing.T) {
	handler, err := NewServer(Options{DataFile: filepath.Join(t.TempDir(), "store.json"), UploadDir: t.TempDir(), RequireSubscription: true})
	if err != nil {
		t.Fatal(err)
	}
	register := httptest.NewRequest("POST", "http://localhost/api/auth/register", strings.NewReader(`{"username":"free-user","password":"password123","subscription":{"planId":"studio","status":"active"}}`))
	result := httptest.NewRecorder()
	handler.ServeHTTP(result, register)
	if result.Code != 400 {
		t.Fatal("registration accepted client subscription")
	}
	register = httptest.NewRequest("POST", "http://localhost/api/auth/register", strings.NewReader(`{"username":"free-user","password":"password123"}`))
	result = httptest.NewRecorder()
	handler.ServeHTTP(result, register)
	if result.Code != 200 {
		t.Fatal(result.Body.String())
	}
	cookie := result.Result().Cookies()[0]
	routes := []string{"/api/ai/codex/prompts", "/api/ai/proposals/campaign", "/api/ai/proposals/campaign/", "/api/campaigns/test/ai/drafts", "/api/campaigns/test/ai/proposals/entities", "/api/campaigns/test/ai/proposals/events", "/api/campaigns/test/events/generate", "/api/campaigns/test/ai/player-facing/format", "/api/campaigns/test/combat/generate"}
	routes = append(routes, "/api/ai/proposals/entity", "/api/ai/proposals/event", "/api/ai/proposals/event/")
	routes = append(routes, "/api/campaigns/test/ai/chat")
	for _, route := range routes {
		for _, prefer := range []string{"", "respond-async"} {
			request := httptest.NewRequest("POST", "http://localhost"+route, strings.NewReader(`{}`))
			request.AddCookie(cookie)
			request.Header.Set("Prefer", prefer)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusPaymentRequired || !strings.Contains(response.Body.String(), "subscription_required") {
				t.Fatalf("%s %s: %d %s", route, prefer, response.Code, response.Body.String())
			}
		}
	}
	request := httptest.NewRequest("POST", "http://localhost/api/campaigns", strings.NewReader(`{"title":"Manual campaign"}`))
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 201 {
		t.Fatalf("manual work blocked: %d", response.Code)
	}
	request = httptest.NewRequest("GET", "http://localhost/api/auth/subscription", nil)
	request.AddCookie(cookie)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 || !strings.Contains(response.Body.String(), `"active":false`) || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("subscription response invalid")
	}
	if !strings.Contains(response.Body.String(), `"available":false`) {
		t.Fatal("local backend must not report a fabricated zero measurement")
	}
	request = httptest.NewRequest("GET", "http://localhost/api/auth/subscription?accountId=another-user", nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 || !strings.Contains(response.Body.String(), `"storageUsage":null`) {
		t.Fatal("anonymous storage usage disclosure")
	}
}

func TestSubscriptionPersistedAndScopedToAccount(t *testing.T) {
	_, store := newTestAuthManager(t, AuthOptions{})
	first, _ := store.createUser("subscribed-user", "password123")
	second, _ := store.createUser("other-user", "password123")
	store.mu.Lock()
	for i := range store.data.Users {
		if store.data.Users[i].ID == first.ID {
			store.data.Users[i].Subscription = &accountSubscription{"starter", "active", time.Now().Add(-time.Hour), time.Now().Add(time.Hour)}
		}
	}
	err := store.saveLocked()
	store.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatal(err)
	}
	a, _ := loaded.getUserByID(first.ID)
	b, _ := loaded.getUserByID(second.ID)
	if !subscriptionActive(a.Subscription, time.Now()) || subscriptionActive(b.Subscription, time.Now()) {
		t.Fatal("subscription lost or leaked to another account")
	}
	handler, err := NewServer(Options{DataFile: store.path, UploadDir: t.TempDir(), RequireSubscription: true})
	if err != nil {
		t.Fatal(err)
	}
	login := httptest.NewRequest("POST", "http://localhost/api/auth/login", strings.NewReader(`{"username":"subscribed-user","password":"password123"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, login)
	if response.Code != 200 {
		t.Fatal("login failed")
	}
	request := httptest.NewRequest("POST", "http://localhost/api/campaigns/missing/ai/drafts", strings.NewReader(`{}`))
	request.AddCookie(response.Result().Cookies()[0])
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 404 {
		t.Fatalf("expected campaign access check after subscription: %d %s", response.Code, response.Body.String())
	}
}
