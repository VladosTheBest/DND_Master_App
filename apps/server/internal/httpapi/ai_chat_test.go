package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestChatRetrievesLateUnicodeAndChunks(t *testing.T) {
	text := strings.Repeat("Обычная беседа\n", 5000) + "Ключ от обсерватории хранит Аделина.\n"
	docs := chatChunks("transcript", "session", "Игра", text)
	found := searchChatSources(docs, "У кого ключ от обсерватории?", 1)
	if len(found) != 1 || !strings.Contains(found[0].Text, "Аделина") || found[0].LastLine < 5001 {
		t.Fatal("late evidence lost")
	}
	long := chatChunks("transcript", "long", "Long", strings.Repeat("ж", 8000))
	joined := ""
	for _, s := range long {
		joined += strings.TrimSuffix(s.Text, "\n")
		if len([]rune(s.Text)) > 2401 {
			t.Fatal("unbounded chunk")
		}
	}
	if joined != strings.Repeat("ж", 8000) {
		t.Fatal("Unicode chunk loss")
	}
}

func TestChatEntityPreviewsAreOwnedCurrentAndPresentationOnly(t *testing.T) {
	campaign := campaignData{NPCs: []knowledgeEntity{{ID: "n1", Title: "Current name", Summary: "Current summary", Art: &heroArt{URL: "/uploads/u/c/portrait.webp"}}, {ID: "external", Title: "External", Art: &heroArt{URL: "https://tracker.invalid/image"}}}}
	history := []aiChatTurn{{Sources: []chatSource{{Kind: "npcs", TargetID: "n1"}, {Kind: "npcs", TargetID: "foreign"}, {Kind: "npcs", TargetID: "external"}}}}
	decorated := decorateChatHistory(history, campaign)
	if decorated[0].Sources[0].Entity.ImageURL != "/uploads/u/c/portrait.webp" || decorated[0].Sources[0].Entity.Title != "Current name" {
		t.Fatal("missing owned preview")
	}
	if decorated[0].Sources[1].Entity != nil || decorated[0].Sources[2].Entity.ImageURL != "" {
		t.Fatal("foreign record or external image leaked")
	}
	if history[0].Sources[0].Entity != nil {
		t.Fatal("mutated stored evidence")
	}
	for _, source := range chatDocuments(campaign, nil) {
		if source.Entity != nil || strings.Contains(source.Text, "portrait.webp") {
			t.Fatal("presentation sent to model")
		}
	}
}

func TestCampaignChatHTTPAndStorage(t *testing.T) {
	calls := 0
	lastPrompt := ""
	requireAdelina := true
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var req openAIChatCompletionRequest
		if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" {
			t.Error("transport contract")
		}
		if json.NewDecoder(r.Body).Decode(&req) != nil {
			t.Error("invalid request")
		}
		if !strings.Contains(req.Messages[0].Content, "read-only") || strings.Contains(req.Messages[1].Content, "FOREIGN_SECRET") {
			t.Error("unsafe context")
		}
		lastPrompt = req.Messages[1].Content
		if requireAdelina && !strings.Contains(req.Messages[1].Content, "Аделина") {
			t.Error("missing relevant source")
		}
		var context struct {
			Sources []chatSource `json:"sources"`
		}
		_ = json.Unmarshal([]byte(req.Messages[1].Content), &context)
		answerBytes, _ := json.Marshal(map[string]any{"answer": "Ключ у Аделины.", "queries": []string{}, "sources": []string{context.Sources[0].ID}, "suggestions": []string{"Уточнить, почему она его хранит."}, "drafts": []chatDraft{{Kind: "npc", Title: "Synthetic candidate", Summary: "Synthetic summary", Content: "Synthetic complete content"}}})
		answer := string(answerBytes)
		if calls == 1 {
			answer = `{"answer":"","queries":["Аделина обсерватория"],"sources":[],"suggestions":[]}`
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": answer}}}})
	}))
	defer upstream.Close()
	path := filepath.Join(t.TempDir(), "store.json")
	handler, err := NewServer(Options{DataFile: path, UploadDir: t.TempDir(), AI: AIOptions{Provider: "openai", BaseURL: upstream.URL, Model: "test", APIToken: "test"}})
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, route, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost"+route, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "http://localhost")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	login := call("POST", "/api/auth/register", `{"username":"chat-user","password":"password123"}`, nil)
	cookie := login.Result().Cookies()[0]
	created := call("POST", "/api/campaigns", `{"title":"Chat campaign"}`, cookie)
	var result struct {
		Data campaignData `json:"data"`
	}
	_ = json.Unmarshal(created.Body.Bytes(), &result)
	base := "/api/campaigns/" + result.Data.ID
	session := call("POST", base+"/sessions", `{"title":"Игра","text":"Ключ от обсерватории хранит Аделина."}`, cookie)
	if session.Code >= 300 {
		t.Fatal(session.Body.String())
	}
	other := call("POST", "/api/auth/register", `{"username":"chat-other","password":"password123"}`, nil).Result().Cookies()[0]
	if w := call("POST", "/api/campaigns", `{"title":"FOREIGN_SECRET"}`, other); w.Code >= 300 {
		t.Fatal(w.Body.String())
	}
	if w := call("GET", base+"/ai/chat", "", other); w.Code != 404 {
		t.Fatal("foreign history allowed", w.Code)
	}
	if w := call("GET", base+"/ai/chat", "", nil); w.Code != 401 {
		t.Fatal("anonymous history allowed")
	}
	if w := call("POST", base+"/ai/chat", `{"id":"synthetic-chat-001","question":"Кто хранит ключ?","sessionId":"foreign"}`, cookie); w.Code != 404 {
		t.Fatal("foreign session allowed")
	}
	body := `{"id":"synthetic-chat-001","question":"Кто хранит ключ?","sessionId":""}`
	if w := call("POST", base+"/ai/chat", body, cookie); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := call("POST", base+"/ai/chat", body, cookie); w.Code != 200 || calls != 2 {
		t.Fatal("repeat generated twice")
	}
	if w := call("GET", base+"/ai/chat", "", cookie); !strings.Contains(w.Body.String(), "Аделины") {
		t.Fatal(w.Body.String())
	}
	restored, err := newCampaignStore(path)
	if err != nil || len(restored.data.AIChatTurns) != 1 {
		t.Fatal("history lost", err)
	}
	if len(restored.data.AIChatTurns[0].Drafts) != 1 {
		t.Fatal("model draft not persisted")
	}
	meta, records, err := splitCloudState(restored.data)
	if err != nil {
		t.Fatal(err)
	}
	joined, err := joinCloudState(meta, records)
	if err != nil || len(joined.AIChatTurns) != 1 {
		t.Fatal("SQL codec lost history", err)
	}
	if kind, id := backgroundGenerationRoute(base + "/ai/chat"); kind != "chat" || id != result.Data.ID {
		t.Fatal("chat not in background/subscription gate")
	}
	requireAdelina = false
	call("POST", base+"/sessions", `{"title":"Second session","text":"SECOND_SESSION_ONLY"}`, cookie)
	call("POST", base+"/sessions", `{"title":"Third session","text":"EXCLUDED_SESSION"}`, cookie)
	latest, _ := newCampaignStore(path)
	ids := []string{latest.data.ImportedSessions[0].ID, latest.data.ImportedSessions[1].ID}
	postContext := func(id string, c chatContext) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"id": id, "question": "Что известно?", "context": c})
		return call("POST", base+"/ai/chat", string(body), cookie)
	}
	if w := postContext("context-two-sessions", chatContext{false, ids}); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if strings.Contains(lastPrompt, "Chat campaign") || strings.Contains(lastPrompt, "EXCLUDED_SESSION") || !strings.Contains(lastPrompt, "SECOND_SESSION_ONLY") || !strings.Contains(lastPrompt, "Аделина") {
		t.Fatal("scope leaked or lost selected sessions")
	}
	if w := postContext("context-campaign-only", chatContext{true, nil}); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if !strings.Contains(lastPrompt, "Chat campaign") || strings.Contains(lastPrompt, "SECOND_SESSION_ONLY") || strings.Contains(lastPrompt, "Аделина") {
		t.Fatal("campaign-only context leaked transcript/history")
	}
	if w := postContext("context-combined-test", chatContext{true, ids}); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if !strings.Contains(lastPrompt, "Chat campaign") || !strings.Contains(lastPrompt, "SECOND_SESSION_ONLY") || strings.Contains(lastPrompt, "EXCLUDED_SESSION") {
		t.Fatal("combined scope invalid")
	}
	if w := postContext("context-empty-invalid", chatContext{false, nil}); w.Code != 400 {
		t.Fatal("empty context accepted")
	}
	if w := postContext("context-foreign-invalid", chatContext{true, []string{"foreign"}}); w.Code != 404 {
		t.Fatal("foreign session accepted")
	}
	query := fmt.Sprintf("?includeCampaign=false&sessionIds=%s&sessionIds=%s", ids[1], ids[0])
	if w := call("GET", base+"/ai/chat"+query, "", cookie); !strings.Contains(w.Body.String(), "context-two-sessions") || strings.Contains(w.Body.String(), "context-combined-test") {
		t.Fatal("history scope not canonical or isolated")
	}
	draft := restored.data.AIChatTurns[0].Drafts[0]
	editBody, _ := json.Marshal(map[string]any{"turnId": "synthetic-chat-001", "draftId": draft.ID, "revision": 0, "title": "Edited candidate", "subtitle": "Edited role", "summary": "Edited summary", "content": strings.Repeat("Описание ", 2200) + "MANUAL_EDIT_TAIL"})
	if w := call("POST", base+"/ai/chat/drafts/edit", string(editBody), other); w.Code != 404 {
		t.Fatal("foreign edit accepted", w.Code)
	}
	if w := call("POST", base+"/ai/chat/drafts/edit", string(editBody), nil); w.Code != 401 {
		t.Fatal("anonymous edit accepted", w.Code)
	}
	if w := call("POST", base+"/ai/chat/drafts/edit", string(editBody), cookie); w.Code != 200 {
		t.Fatal("edit failed", w.Body.String())
	}
	if w := call("POST", base+"/ai/chat/drafts/edit", string(editBody), cookie); w.Code != 409 {
		t.Fatal("stale edit accepted", w.Code)
	}
	refBody, _ := json.Marshal(map[string]any{"id": "refine-synthetic-001", "question": "Expand this candidate", "draftRef": chatDraftRef{TurnID: "synthetic-chat-001", DraftID: draft.ID, Revision: 1}})
	if w := call("POST", base+"/ai/chat", string(refBody), cookie); w.Code != 200 {
		t.Fatal("refine failed", w.Body.String())
	}
	var focused struct {
		Draft chatDraft `json:"focusedDraft"`
	}
	if err := json.Unmarshal([]byte(lastPrompt), &focused); err != nil || focused.Draft.Title != "Edited candidate" || !strings.HasSuffix(focused.Draft.Content, "MANUAL_EDIT_TAIL") {
		t.Fatal("manual edits missing from focused model context", err)
	}
	refBody, _ = json.Marshal(map[string]any{"id": "refine-synthetic-002", "question": "Expand this candidate", "context": chatContext{false, ids}, "draftRef": chatDraftRef{TurnID: "synthetic-chat-001", DraftID: draft.ID, Revision: 1}})
	if w := call("POST", base+"/ai/chat", string(refBody), cookie); w.Code != 404 {
		t.Fatal("draft leaked to another scope", w.Code)
	}
	applyBody, _ := json.Marshal(map[string]string{"turnId": "synthetic-chat-001", "draftId": draft.ID})
	if w := call("POST", base+"/ai/chat/drafts/apply", string(applyBody), other); w.Code != 404 {
		t.Fatal("foreign draft apply accepted")
	}
	if w := call("POST", base+"/ai/chat/drafts/apply", string(applyBody), nil); w.Code != 401 {
		t.Fatal("anonymous draft apply accepted")
	}
	if w := call("POST", base+"/ai/chat/drafts/apply", string(applyBody), cookie); w.Code != 200 || !strings.Contains(w.Body.String(), "createdId") {
		t.Fatal("apply route failed", w.Body.String())
	}
}

func TestChatRosterAndContext(t *testing.T) {
	campaign := campaignData{}
	for i := 0; i < 85; i++ {
		campaign.NPCs = append(campaign.NPCs, knowledgeEntity{ID: fmt.Sprintf("private-id-%03d", i), Title: fmt.Sprintf("Персонаж %03d", i), Summary: "Описание"})
	}
	answer, ok := chatNPCRoster("Перечисли всех НПС которые есть в кампании", campaign)
	if !ok || strings.Count(answer, "| **Персонаж") != 85 || strings.Contains(answer, "private-id") {
		t.Fatal("roster incomplete or leaks IDs")
	}
	if _, ok := chatNPCRoster("Перечисли всех НПС которые погибли", campaign); ok {
		t.Fatal("filtered question treated as entire roster")
	}
	a := chatContext{true, []string{"b", "a", "a"}}
	b := chatContext{true, []string{"a", "b"}}
	if a.normalize() != b.normalize() {
		t.Fatal("context order changed history")
	}
}
