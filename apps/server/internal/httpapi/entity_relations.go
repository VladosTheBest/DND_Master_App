package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
)

// An owned playthrough overlay. A tombstone hides a legacy pair without
// rewriting either entity (including immutable prepared-adventure records).
type entityRelationPair struct {
	Left    string `json:"left"`
	Right   string `json:"right"`
	Reason  string `json:"reason,omitempty"`
	Removed bool   `json:"removed,omitempty"`
}

func relationKey(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "\x00" + b
}

func entityRelations(c campaignData, id string) []relatedEntity {
	entities := map[string]knowledgeEntity{}
	pairs := map[string]entityRelationPair{}
	for _, e := range campaignEntities(c) {
		entities[e.ID] = e
	}
	for _, e := range campaignEntities(c) {
		for _, r := range e.Related {
			if e.ID == r.ID || (e.ID != id && r.ID != id) {
				continue
			}
			key := relationKey(e.ID, r.ID)
			if _, exists := pairs[key]; !exists {
				pairs[key] = entityRelationPair{Left: e.ID, Right: r.ID, Reason: r.Reason}
			}
		}
	}
	for _, p := range c.EntityRelations {
		pairs[relationKey(p.Left, p.Right)] = p
	}
	result := []relatedEntity{}
	for _, p := range pairs {
		if p.Removed || (p.Left != id && p.Right != id) {
			continue
		}
		target := p.Left
		if target == id {
			target = p.Right
		}
		if e, ok := entities[target]; ok && target != id {
			result = append(result, relatedEntity{ID: e.ID, Kind: e.Kind, Label: e.Title, Reason: p.Reason})
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Label == result[j].Label {
			return result[i].ID < result[j].ID
		}
		return result[i].Label < result[j].Label
	})
	return result
}

func mutateEntityRelations(c *campaignData, source string, targets []string, reason string, remove bool) error {
	if bucket, _, _ := findEntityInCampaign(c, source); bucket == nil {
		return fmt.Errorf("Запись не найдена в этой кампании.")
	}
	if len(targets) == 0 || len(targets) > 100 || len([]rune(reason)) > 2000 {
		return fmt.Errorf("Выберите 1–100 записей; пояснение — до 2000 символов.")
	}
	// Validate the whole batch before changing anything.
	for _, target := range targets {
		bucket, _, _ := findEntityInCampaign(c, target)
		if bucket == nil || source == target {
			return fmt.Errorf("Связь с собой или с записью другой кампании запрещена.")
		}
	}
	pairs := append([]entityRelationPair{}, c.EntityRelations...)
	for _, target := range targets {
		key := relationKey(source, target)
		index := -1
		for i, p := range pairs {
			if relationKey(p.Left, p.Right) == key {
				index = i
				break
			}
		}
		a, b := source, target
		if a > b {
			a, b = b, a
		}
		pair := entityRelationPair{Left: a, Right: b, Reason: strings.TrimSpace(reason), Removed: remove}
		if index < 0 {
			pairs = append(pairs, pair)
		} else {
			pairs[index] = pair
		}
	}
	c.EntityRelations = pairs
	return nil
}

func (srv *server) handleEntityRelations(w http.ResponseWriter, r *http.Request, user authUser, campaignID string, segments []string) {
	var input struct {
		ExpectedRevision *int     `json:"expectedRevision"`
		TargetIDs        []string `json:"targetIds"`
		Reason           string   `json:"reason"`
	}
	if !(r.Method == http.MethodGet && len(segments) == 4) {
		if !((r.Method == http.MethodPost && len(segments) == 4) || ((r.Method == http.MethodPatch || r.Method == http.MethodDelete) && len(segments) == 5)) {
			writeError(w, 405, "method_not_allowed", "Метод не поддерживается.")
			return
		}

		if err := readJSON(r, &input); err != nil {
			writeError(w, 400, "bad_request", err.Error())
			return
		}
		if input.ExpectedRevision == nil {
			writeError(w, 428, "revision_required", "Требуется версия кампании.")
			return
		}
	}
	srv.store.mu.Lock()
	locked := true
	unlock := func() { srv.store.mu.Unlock(); locked = false }
	defer func() {
		if locked {
			srv.store.mu.Unlock()
		}
	}()
	index := findOwnedCampaignIndexLocked(&srv.store.data, user.ID, campaignID)
	if index < 0 {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	c := srv.store.data.Campaigns[index]
	source := segments[2]
	if bucket, _, _ := findEntityInCampaign(&c, source); bucket == nil {
		writeError(w, 404, "not_found", "Запись не найдена.")
		return
	}
	if r.Method == http.MethodGet && len(segments) == 4 {
		w.Header().Set("Cache-Control", "no-store")
		result := map[string]any{"revision": c.Revision, "items": entityRelations(c, source)}
		unlock()
		writeJSON(w, 200, result)
		return
	}
	if *input.ExpectedRevision != c.Revision {
		raw, _ := json.Marshal(c)
		unlock()
		writeAuthoringError(w, &authoringConflict{Current: json.RawMessage(raw)})
		return
	}
	if len(segments) == 5 {
		input.TargetIDs = []string{segments[4]}
	}
	if err := mutateEntityRelations(&c, source, input.TargetIDs, input.Reason, r.Method == http.MethodDelete); err != nil {
		writeError(w, 400, "invalid_relation", err.Error())
		return
	}
	original, err := cloneStorageState(srv.store.data)
	if err != nil {
		writeError(w, 500, "storage_error", "Не удалось подготовить сохранение.")
		return
	}
	c.Revision++
	srv.store.data.Campaigns[index] = c
	if err = srv.store.saveMutationLocked(original); err != nil {
		writeError(w, 503, "save_failed", "Связи не сохранены. Повторите попытку.")
		return
	}
	raw, err := json.Marshal(c)
	unlock()
	if err != nil {
		writeError(w, 500, "encode_failed", "Не удалось сформировать ответ.")
		return
	}
	writeJSON(w, 200, json.RawMessage(raw))
}
