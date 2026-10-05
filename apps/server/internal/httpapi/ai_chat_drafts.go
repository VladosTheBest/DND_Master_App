package httpapi

import (
	"fmt"
	"net/http"
	"strings"
)

type chatDraft struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Content   string `json:"content"`
	Subtitle  string `json:"subtitle"`
	CreatedID string `json:"createdId,omitempty"`
	Revision  int    `json:"revision"`
}

type chatDraftRef struct {
	TurnID   string `json:"turnId"`
	DraftID  string `json:"draftId"`
	Revision int    `json:"revision"`
}

func (srv *server) handleChatDraftEdit(w http.ResponseWriter, r *http.Request, user authUser, campaignID string) {
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Only POST is supported")
		return
	}
	var input struct {
		chatDraftRef
		Title    string `json:"title"`
		Subtitle string `json:"subtitle"`
		Summary  string `json:"summary"`
		Content  string `json:"content"`
	}
	if !boundedMutationInput(w, r, &input, 128*1024) {
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	owned := false
	for _, c := range srv.store.data.Campaigns {
		if c.ID == campaignID && c.OwnerID == user.ID {
			owned = true
			break
		}
	}
	if !owned {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	for i := range srv.store.data.AIChatTurns {
		turn := &srv.store.data.AIChatTurns[i]
		if turn.ID != input.TurnID || turn.OwnerID != user.ID || turn.CampaignID != campaignID {
			continue
		}
		for j := range turn.Drafts {
			draft := &turn.Drafts[j]
			if draft.ID != input.DraftID {
				continue
			}
			if draft.CreatedID != "" {
				writeError(w, 409, "already_added", "Запись уже добавлена. Редактируй её в кампании.")
				return
			}
			if draft.Revision != input.Revision {
				writeError(w, 409, "draft_conflict", "Предложение изменилось. Обнови диалог перед редактированием.")
				return
			}
			validated, err := prepareChatDrafts([]chatDraft{{Kind: draft.Kind, Title: input.Title, Subtitle: input.Subtitle, Summary: input.Summary, Content: input.Content}})
			if err != nil {
				writeError(w, 400, "invalid_draft", "Проверь название и описание: они обязательны и должны укладываться в ограничения длины.")
				return
			}
			original, err := cloneStorageState(srv.store.data)
			if err != nil {
				writeError(w, 500, "save_failed", "Не удалось сохранить правки.")
				return
			}
			next := validated[0]
			next.ID = draft.ID
			next.Revision = draft.Revision + 1
			*draft = next
			if err := srv.store.saveMutationLocked(original); err != nil {
				writeError(w, 500, "save_failed", "Правки не сохранены. Попробуй ещё раз.")
				return
			}
			writeJSON(w, 200, map[string]any{"draft": next})
			return
		}
	}
	writeError(w, 404, "draft_not_found", "Предложение не найдено.")
}

func validChatDraftKind(kind string) bool {
	switch kind {
	case "npc", "location", "player", "monster", "quest", "lore", "event", "shop", "sessionPrep", "worldMap":
		return true
	}
	return false
}

func chatDraftSchema() map[string]any {
	str := map[string]any{"type": "string"}
	return map[string]any{"type": "array", "items": map[string]any{"type": "object", "additionalProperties": false, "properties": map[string]any{
		"kind": map[string]any{"type": "string", "enum": []string{"npc", "location", "player", "monster", "quest", "lore", "event", "shop", "sessionPrep", "worldMap"}}, "title": str, "summary": str, "content": str, "subtitle": str,
	}, "required": []string{"kind", "title", "summary", "content", "subtitle"}}}
}

func prepareChatDrafts(drafts []chatDraft) ([]chatDraft, error) {
	if len(drafts) > 4 {
		return nil, fmt.Errorf("too many drafts")
	}
	for i := range drafts {
		d := &drafts[i]
		d.Title = strings.TrimSpace(d.Title)
		d.Content = strings.TrimSpace(d.Content)
		if !validChatDraftKind(d.Kind) || d.Title == "" || len([]rune(d.Title)) > 160 || d.Content == "" || len([]rune(d.Content)) > 20000 || len([]rune(d.Summary)) > 2000 || len([]rune(d.Subtitle)) > 300 {
			return nil, fmt.Errorf("invalid draft")
		}
		d.ID = newID("chatdraft")
		d.CreatedID = ""
		d.Revision = 0
	}
	return drafts, nil
}

func (srv *server) handleChatDraftApply(w http.ResponseWriter, r *http.Request, user authUser, campaignID string) {
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Only POST is supported")
		return
	}
	var input struct {
		TurnID   string `json:"turnId"`
		DraftID  string `json:"draftId"`
		Revision *int   `json:"revision,omitempty"`
	}
	if !feedbackInput(w, r, &input) {
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	var campaign *campaignData
	for i := range srv.store.data.Campaigns {
		c := &srv.store.data.Campaigns[i]
		if c.ID == campaignID && c.OwnerID == user.ID {
			campaign = c
			break
		}
	}
	if campaign == nil {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	for i := range srv.store.data.AIChatTurns {
		turn := &srv.store.data.AIChatTurns[i]
		if turn.ID != input.TurnID || turn.OwnerID != user.ID || turn.CampaignID != campaignID {
			continue
		}
		for j := range turn.Drafts {
			draft := &turn.Drafts[j]
			if draft.ID != input.DraftID {
				continue
			}
			if draft.CreatedID != "" {
				writeJSON(w, 200, map[string]any{"draft": draft, "campaign": campaign})
				return
			}
			if input.Revision != nil && *input.Revision != draft.Revision {
				writeError(w, 409, "draft_conflict", "Предложение изменилось. Обнови диалог перед добавлением.")
				return
			}
			if !validChatDraftKind(draft.Kind) {
				writeError(w, 400, "invalid_draft", "Неподдерживаемый тип записи.")
				return
			}
			original, err := cloneStorageState(srv.store.data)
			if err != nil {
				writeError(w, 500, "save_failed", "Не удалось сохранить запись.")
				return
			}
			switch draft.Kind {
			case "worldMap":
				writeError(w, 400, "map_generation_required", "Используй кнопку создания карты в предложении.")
				return
			case "event":
				event := materializeWorldEvent(createWorldEventInput{Title: draft.Title, Summary: draft.Summary, SceneText: draft.Content, Type: "other", Origin: "manual"}, *campaign, nil)
				campaign.Events = append(campaign.Events, event)
				draft.CreatedID = event.ID
			case "shop":
				shop := campaignShop{ID: newID("shop"), Name: draft.Title, Description: draft.Summary, GMNotes: draft.Content, Inventory: []shopInventoryItem{}}
				campaign.Shops = append(campaign.Shops, shop)
				draft.CreatedID = shop.ID
			case "sessionPrep":
				prep := sessionPrepItem{ID: newID("prep"), Title: draft.Title, Status: "planned", Focus: draft.Content}
				campaign.SessionPrep = append(campaign.SessionPrep, prep)
				draft.CreatedID = prep.ID
			default:
				entity := materializeEntity(createEntityInput{Kind: draft.Kind, Title: draft.Title, Subtitle: draft.Subtitle, Summary: draft.Summary, Content: draft.Content})
				if err = appendEntityToCampaign(campaign, entity); err != nil {
					writeError(w, 400, "invalid_draft", "Неподдерживаемый тип записи.")
					return
				}
				draft.CreatedID = entity.ID
			}
			campaign.Revision++
			*campaign = ensureCampaignShape(*campaign)
			if err = srv.store.saveMutationLocked(original); err != nil {
				writeError(w, 500, "save_failed", "Запись не сохранена. Повтори добавление.")
				return
			}
			writeJSON(w, 200, map[string]any{"draft": draft, "campaign": campaign})
			return
		}
	}
	writeError(w, 404, "draft_not_found", "Предложение не найдено.")
}
