package httpapi

import (
	"net/http"
	"time"
)

// Subscription state is writable only by trusted billing/admin code, never
// registration or campaign input from the browser.
type accountSubscription struct {
	PlanID             string    `json:"planId"`
	Status             string    `json:"status"`
	CurrentPeriodStart time.Time `json:"currentPeriodStart"`
	CurrentPeriodEnd   time.Time `json:"currentPeriodEnd"`
}

type subscriptionPlan struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	MonthlyCents   int    `json:"monthlyCents"`
	Generations    int    `json:"generations"`
	StorageGB      int    `json:"storageGB"`
	RecordingHours int    `json:"recordingHours"`
	DiscordServers int    `json:"discordServers"`
}

var subscriptionPlans = []subscriptionPlan{
	{"starter", "Starter", 500, 100, 2, 2, 1},
	{"gm", "GM", 1000, 300, 10, 6, 2},
	{"studio", "Studio", 2000, 800, 30, 16, 5},
}

func requiresGenerationSubscription(route string) bool {
	kind, _ := backgroundGenerationRoute(route)
	// Maps choose Codex first; their handler enforces the API subscription gate.
	if kind == "world-map" {
		return false
	}
	return kind != "" || route == "/api/ai/proposals/entity" || route == "/api/ai/proposals/event"
}

func subscriptionActive(s *accountSubscription, now time.Time) bool {
	if s == nil || s.Status != "active" || s.CurrentPeriodStart.IsZero() || now.Before(s.CurrentPeriodStart) || !now.Before(s.CurrentPeriodEnd) {
		return false
	}
	for _, plan := range subscriptionPlans {
		if plan.ID == s.PlanID {
			return true
		}
	}
	return false
}

func (srv *server) handleSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, 405, "method_not_allowed", "Only GET is supported")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	var subscription *accountSubscription
	var usage *storageUsage
	if user, ok := srv.auth.currentUser(r); ok {
		if account, found := srv.store.getUserByID(user.ID); found {
			subscription = account.Subscription
			usage = &storageUsage{}
			if srv.cloud != nil {
				var err error
				usage, err = srv.cloud.storageUsage(r.Context(), user.ID)
				if err != nil {
					writeError(w, 503, "storage_usage_unavailable", "Storage usage is temporarily unavailable")
					return
				}
			}
			if subscriptionActive(subscription, time.Now()) {
				for _, plan := range subscriptionPlans {
					if plan.ID == subscription.PlanID {
						limit := int64(plan.StorageGB) * 1_000_000_000
						usage.LimitBytes = &limit
					}
				}
			}
		}
	}
	writeJSON(w, 200, struct {
		Plans             []subscriptionPlan   `json:"plans"`
		Subscription      *accountSubscription `json:"subscription"`
		Active            bool                 `json:"active"`
		CheckoutAvailable bool                 `json:"checkoutAvailable"`
		StorageUsage      *storageUsage        `json:"storageUsage"`
	}{subscriptionPlans, subscription, subscriptionActive(subscription, time.Now()), false, usage})
}
