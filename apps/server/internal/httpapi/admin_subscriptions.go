package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"
)

type subscriptionAudit struct {
	ID        string               `json:"id"`
	AccountID string               `json:"accountId"`
	ActorID   string               `json:"actorId"`
	Action    string               `json:"action"`
	Reason    string               `json:"reason"`
	At        time.Time            `json:"at"`
	Previous  *accountSubscription `json:"previous"`
	Next      *accountSubscription `json:"next"`
}

func (m *authManager) allowedAdminIdentity(id oauthIdentity) bool {
	email := strings.TrimSpace(m.oauth.AdminEmail)
	return email != "" && id.Provider == "google" && id.EmailVerified && strings.EqualFold(strings.TrimSpace(id.Email), email)
}

func (m *authManager) adminUser(r *http.Request) (string, bool) {
	if m == nil || strings.TrimSpace(m.oauth.AdminEmail) == "" {
		return "", false
	}
	cookie, err := r.Cookie(m.cookieName)
	if err != nil {
		return "", false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[cookie.Value]
	now := time.Now()
	return s.UserID, ok && now.Before(s.ExpiresAt) && now.Before(s.AdminUntil) && strings.EqualFold(s.AdminEmail, strings.TrimSpace(m.oauth.AdminEmail))
}

func (srv *server) handleAdminSubscriptions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := srv.auth.adminUser(r)
	if !ok {
		writeError(w, 403, "admin_forbidden", "Нужен вход через Google владельца кабинета.")
		return
	}
	if r.Method == http.MethodGet {
		type row struct {
			ID           string               `json:"id"`
			Username     string               `json:"username"`
			Labels       []string             `json:"labels"`
			CreatedAt    string               `json:"createdAt"`
			Subscription *accountSubscription `json:"subscription"`
			Active       bool                 `json:"active"`
		}
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		if offset < 0 {
			offset = 0
		}
		query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
		srv.store.mu.RLock()
		defer srv.store.mu.RUnlock()
		rows := []row{}
		total := 0
		for _, u := range srv.store.data.Users {
			labels := []string{}
			for _, id := range u.OAuthIdentities {
				labels = append(labels, id.Provider+": "+id.Label)
			}
			if !strings.Contains(strings.ToLower(u.ID+" "+u.Username+" "+strings.Join(labels, " ")), query) {
				continue
			}
			total++
			if total <= offset || len(rows) >= 50 {
				continue
			}
			rows = append(rows, row{u.ID, u.Username, labels, u.CreatedAt, u.Subscription, subscriptionActive(u.Subscription, time.Now())})
		}
		audits := []subscriptionAudit{}
		for i := len(srv.store.data.SubscriptionAudits) - 1; i >= 0 && len(audits) < 50; i-- {
			audits = append(audits, srv.store.data.SubscriptionAudits[i])
		}
		writeJSON(w, 200, map[string]any{"users": rows, "total": total, "plans": subscriptionPlans, "audits": audits})
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Only GET and POST are supported")
		return
	}
	if r.Header.Get("Origin") == "" || !isTrustedMutationOrigin(r) {
		writeError(w, 403, "origin_forbidden", "Недопустимый источник запроса.")
		return
	}
	var input struct {
		AccountID string               `json:"accountId"`
		Action    string               `json:"action"`
		PlanID    string               `json:"planId"`
		Days      int                  `json:"days"`
		Reason    string               `json:"reason"`
		Expected  *accountSubscription `json:"expected"`
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&input); err != nil {
		writeError(w, 400, "invalid_input", "Некорректные данные.")
		return
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		writeError(w, 400, "invalid_input", "Некорректные данные.")
		return
	}
	input.Reason = strings.TrimSpace(input.Reason)
	validPlan := false
	for _, p := range subscriptionPlans {
		if p.ID == input.PlanID {
			validPlan = true
		}
	}
	if input.Reason == "" || len([]rune(input.Reason)) > 500 || (input.Action != "grant" && input.Action != "revoke") || (input.Action == "grant" && (!validPlan || input.Days < 1 || input.Days > 366)) {
		writeError(w, 400, "invalid_input", "Укажи тариф, срок от 1 до 366 дней и причину изменения.")
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	index := -1
	for i, u := range srv.store.data.Users {
		if u.ID == input.AccountID {
			index = i
			break
		}
	}
	if index < 0 {
		writeError(w, 404, "not_found", "Пользователь не найден.")
		return
	}
	previous := srv.store.data.Users[index].Subscription
	if !reflect.DeepEqual(previous, input.Expected) {
		writeError(w, 409, "subscription_changed", "Подписка уже изменилась. Обнови список.")
		return
	}
	original, err := cloneStorageState(srv.store.data)
	if err != nil {
		writeError(w, 500, "save_failed", "Не удалось сохранить подписку.")
		return
	}
	now := time.Now().UTC()
	var next *accountSubscription
	if input.Action == "grant" {
		next = &accountSubscription{input.PlanID, "active", now, now.AddDate(0, 0, input.Days)}
	}
	srv.store.data.Users[index].Subscription = next
	audit := subscriptionAudit{newID("subscription_audit"), input.AccountID, actor, input.Action, input.Reason, now, previous, next}
	srv.store.data.SubscriptionAudits = append(srv.store.data.SubscriptionAudits, audit)
	if err = srv.store.saveMutationLocked(original); err != nil {
		writeError(w, 500, "save_failed", "Изменение не сохранено.")
		return
	}
	writeJSON(w, 200, audit)
}
