package httpapi

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
)

// The workspace fetches maps/scenes separately. Full legacy/Foundry contracts remain available.
func workspaceCampaign(c campaignData) campaignData {
	c.WorldMaps = nil
	c.SessionMaps = nil
	c.FoundryActorProfiles = nil
	c.CustomItemImports = nil
	return c
}

// Capture before dispatch under the read lock. A shallow campaign copy aliases
// entity/shop slices: in-place authoring would otherwise erase its own delta.
func (store *campaignStore) workspaceBaseline(ownerID, campaignID string) (campaignData, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	index := findOwnedCampaignIndexLocked(&store.data, ownerID, campaignID)
	if index < 0 {
		return campaignData{}, fmt.Errorf("campaign not found")
	}
	raw, err := json.Marshal(workspaceCampaign(store.data.Campaigns[index]))
	if err != nil {
		return campaignData{}, err
	}
	var snapshot campaignData
	err = json.Unmarshal(raw, &snapshot)
	return snapshot, err
}

type workspaceResponseWriter struct {
	http.ResponseWriter
	base campaignData
}

func (w *workspaceResponseWriter) project(data any) any {
	raw, err := json.Marshal(data)
	if err != nil {
		return data
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields == nil {
		return data
	}
	if nested, ok := fields["campaign"]; ok {
		var campaign campaignData
		if json.Unmarshal(nested, &campaign) == nil && campaign.ID == w.base.ID {
			fields["campaign"], _ = json.Marshal(w.changes(campaign))
			return fields
		}
	}
	if _, ok := fields["modules"]; ok {
		var campaign campaignData
		if json.Unmarshal(raw, &campaign) == nil && campaign.ID == w.base.ID {
			return w.changes(campaign)
		}
	}
	return data
}
func (w *workspaceResponseWriter) changes(next campaignData) any {
	next = workspaceCampaign(next)
	if next.Revision <= w.base.Revision {
		return next
	}
	raw, _ := json.Marshal(next)
	old, _ := json.Marshal(workspaceCampaign(w.base))
	var current, base map[string]json.RawMessage
	_ = json.Unmarshal(raw, &current)
	_ = json.Unmarshal(old, &base)
	delta := map[string]any{"id": next.ID, "revision": next.Revision, "__baseRevision": w.base.Revision}
	collections := map[string]any{}
	for key, value := range current {
		if !bytes.Equal(value, base[key]) {
			switch key {
			case "locations", "players", "npcs", "monsters", "quests", "lore", "events", "shops", "customItems":
				if patch, ok := collectionChanges(base[key], value); ok {
					collections[key] = patch
					continue
				}
			}
			delta[key] = value
		}
	}
	for key := range base {
		if _, ok := current[key]; !ok {
			delta[key] = nil
		}
	}
	if len(collections) > 0 {
		delta["__collections"] = collections
	}
	return delta
}
func conditionalJSON(w http.ResponseWriter, r *http.Request, data any) {
	raw, err := json.Marshal(envelope{Data: data, Meta: map[string]any{}})
	if err != nil {
		writeError(w, 500, "encode_failed", "Ответ недоступен.")
		return
	}
	tag := fmt.Sprintf("\"%x\"", sha256.Sum256(raw))
	w.Header().Set("Cache-Control", "private, no-cache")
	w.Header().Set("ETag", tag)
	if r.Header.Get("If-None-Match") == tag {
		w.WriteHeader(304)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	_, _ = w.Write(raw)
}

func collectionChanges(before, after json.RawMessage) (any, bool) {
	var old, next []json.RawMessage
	if json.Unmarshal(before, &old) != nil || json.Unmarshal(after, &next) != nil {
		return nil, false
	}
	index := func(items []json.RawMessage) (map[string]json.RawMessage, []string, bool) {
		byID := map[string]json.RawMessage{}
		ids := []string{}
		for _, raw := range items {
			var id struct {
				ID string `json:"id"`
			}
			if json.Unmarshal(raw, &id) != nil || id.ID == "" || byID[id.ID] != nil {
				return nil, nil, false
			}
			byID[id.ID] = raw
			ids = append(ids, id.ID)
		}
		return byID, ids, true
	}
	oldIndex, oldOrder, ok := index(old)
	if !ok {
		return nil, false
	}
	nextIndex, nextOrder, ok := index(next)
	if !ok {
		return nil, false
	}
	upsert := []json.RawMessage{}
	removed := []string{}
	for _, id := range nextOrder {
		if !bytes.Equal(oldIndex[id], nextIndex[id]) {
			upsert = append(upsert, nextIndex[id])
		}
	}
	for _, id := range oldOrder {
		if nextIndex[id] == nil {
			removed = append(removed, id)
		}
	}
	patch := map[string]any{"upsert": upsert, "remove": removed}
	a, _ := json.Marshal(oldOrder)
	b, _ := json.Marshal(nextOrder)
	if !bytes.Equal(a, b) {
		patch["order"] = nextOrder
	}
	return patch, true
}
