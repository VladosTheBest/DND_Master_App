package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestFeedbackAccessPersistenceAndFilters(t *testing.T) {
	m, store := oauthTestManager(t)
	m.oauth.AdminEmail = "owner@example.com"
	user, err := store.createUser("feedback-user", "password123")
	if err != nil {
		t.Fatal(err)
	}
	m.sessions["user"] = authSession{UserID: user.ID, Username: user.Username, ExpiresAt: time.Now().Add(time.Hour)}
	m.sessions["admin"] = authSession{UserID: user.ID, ExpiresAt: time.Now().Add(time.Hour), AdminUntil: time.Now().Add(time.Hour), AdminEmail: "owner@example.com"}
	srv := &server{auth: m, store: store}
	call := func(path, method, token, origin, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "https://app.example"+path, strings.NewReader(body))
		r.Header.Set("Origin", origin)
		r.AddCookie(&http.Cookie{Name: m.cookieName, Value: token})
		w := httptest.NewRecorder()
		if strings.HasPrefix(path, "/api/admin/") {
			srv.handleAdminFeedback(w, r)
		} else {
			srv.handleFeedback(w, r)
		}
		return w
	}
	body := `{"type":"bug","message":"Не работает кнопка","submissionId":"synthetic-feedback-01"}`
	for _, tc := range []struct {
		path, method, token, origin, body string
		code                              int
	}{
		{"/api/feedback", "POST", "", "https://app.example", body, 401},
		{"/api/feedback", "POST", "user", "https://evil.example", body, 403},
		{"/api/feedback", "POST", "user", "", body, 403},
		{"/api/feedback", "GET", "user", "", "", 405},
		{"/api/admin/feedback", "GET", "user", "", "", 403},
		{"/api/admin/feedback", "GET", "", "", "", 403},
		{"/api/feedback", "POST", "user", "https://app.example", strings.Replace(body, "bug", "invalid", 1), 400},
		{"/api/feedback", "POST", "user", "https://app.example", body + `{}`, 400},
	} {
		if w := call(tc.path, tc.method, tc.token, tc.origin, tc.body); w.Code != tc.code {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body.String())
		}
	}
	store.atomicFileWrite = func(string, []byte, os.FileMode) error { return errors.New("disk failure") }
	if w := call("/api/feedback", "POST", "user", "https://app.example", body); w.Code != 500 || len(store.data.Feedback) != 0 {
		t.Fatal("failed save not rolled back")
	}
	store.atomicFileWrite = nil
	if w := call("/api/feedback", "POST", "user", "https://app.example", body); w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	if w := call("/api/feedback", "POST", "user", "https://app.example", body); w.Code != 200 || len(store.data.Feedback) != 1 {
		t.Fatal("duplicate submission")
	}
	if w := call("/api/feedback", "POST", "user", "https://app.example", strings.Replace(body, "кнопка", "меню", 1)); w.Code != 409 {
		t.Fatal("idempotency mismatch")
	}
	entry := store.data.Feedback[0]
	update := fmt.Sprintf(`{"id":%q,"status":"reviewing","expected":"new"}`, entry.ID)
	if w := call("/api/admin/feedback", "POST", "admin", "https://app.example", update); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := call("/api/admin/feedback", "POST", "admin", "https://app.example", update); w.Code != 409 {
		t.Fatal("stale status accepted")
	}
	if w := call("/api/admin/feedback?status=new", "GET", "admin", "", ""); !strings.Contains(w.Body.String(), `"total":0`) {
		t.Fatal(w.Body.String())
	}
	if w := call("/api/admin/feedback?type=bug&q=feedback-user", "GET", "admin", "", ""); !strings.Contains(w.Body.String(), `"total":1`) || strings.Contains(w.Body.String(), "passwordHash") {
		t.Fatal(w.Body.String())
	}
	loaded, err := newCampaignStore(store.path)
	if err != nil || len(loaded.data.Feedback) != 1 || loaded.data.Feedback[0].Status != "reviewing" {
		t.Fatal("reload lost feedback", err)
	}
	meta, records, err := splitCloudState(store.data)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := joinCloudState(meta, records)
	if err != nil || len(restored.Feedback) != 1 {
		t.Fatal("cloud codec lost feedback", err)
	}
	for i := 1; i < 20; i++ {
		e := entry
		e.ID = fmt.Sprint(i)
		e.SubmissionID = fmt.Sprint(i)
		store.data.Feedback = append(store.data.Feedback, e)
	}
	if w := call("/api/feedback", "POST", "user", "https://app.example", strings.Replace(body, "01", "02", 1)); w.Code != 429 {
		t.Fatal("rate limit absent")
	}
}
