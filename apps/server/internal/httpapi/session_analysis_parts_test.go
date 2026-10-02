package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestNumberedSessionPartsPreserveLargeUnicodeTranscript(t *testing.T) {
	text := strings.Repeat("[00:00:01.000–00:00:02.000] Игрок: Проверка 🐉\n", 14000) + "КОНЕЦ"
	parts := numberedSessionParts(text)
	marker := regexp.MustCompile(`(?m)^\[L\d+\] `)
	restored := ""
	line := 1
	for _, part := range parts {
		if !strings.HasPrefix(part, fmt.Sprintf("[L%d] ", line)) {
			t.Fatal("line references drifted")
		}
		raw := marker.ReplaceAllString(part, "")
		if utf8.RuneCountInString(raw) > sessionPartCharacters {
			t.Fatal("unbounded part")
		}
		restored += raw
		line += strings.Count(raw, "\n")
	}
	if restored != text || len(parts) < 2 {
		t.Fatal("lost or duplicated transcript text")
	}
}

func TestSessionPartNotesValidation(t *testing.T) {
	for _, bad := range []string{"", "prose", `{"notes":""}`, `{"notes":"too long"}`} {
		if _, err := extractSessionNotes(bad, 3); err == nil {
			t.Fatal("accepted malformed/oversized notes")
		}
	}
	if got, err := extractSessionNotes(`{"notes":"да🐉"}`, 3); err != nil || got != "да🐉" {
		t.Fatal(got, err)
	}
}

func TestSessionPartOverflowRetryExplainsAndRepairsBudget(t *testing.T) {
	store, campaign := newSessionTestStore(t)
	session, _ := parseImportedSession("Synthetic", strings.Repeat("Реплика\n", 69956))
	session.CampaignID = campaign.ID
	session, _, _ = store.importSession(session)
	manager := &codexBridgeManager{auth: &authManager{store: store}}
	calls := 0
	runner := func(_ context.Context, _ authUser, input codexPromptInput) (codexPromptResult, error) {
		if input.SessionExtract == "" {
			return codexPromptResult{SessionID: session.ID}, nil
		}
		calls++
		if calls == 1 {
			body, _ := json.Marshal(map[string]string{"notes": strings.Repeat("я", 6229)})
			return codexPromptResult{Message: string(body)}, nil
		}
		if calls == 2 {
			prompt := buildSessionAnalysisPrompt(input)
			if !strings.Contains(prompt, "6229") || !strings.Contains(prompt, "вместо 5333") || !strings.Contains(prompt, "Repair the output") || !strings.Contains(prompt, "Aim for about 4266") {
				t.Fatal("retry repeated the failed prompt instead of correcting its budget")
			}
		}
		return codexPromptResult{Message: `{"notes":"Подтверждённый факт [L1]."}`}, nil
	}
	if _, err := manager.runSessionAnalysis(context.Background(), authUser{ID: "owner"}, codexPromptInput{CampaignID: campaign.ID, SessionID: session.ID, Prompt: "Разбор"}, runner); err != nil {
		t.Fatal(err)
	}
	if calls != 10 {
		t.Fatalf("expected nine parts and one repair, got %d", calls)
	}
}

func TestSessionPartFailurePreservesReportAndRevealsSafeReason(t *testing.T) {
	store, campaign := newSessionTestStore(t)
	session, _ := parseImportedSession("Synthetic", strings.Repeat("Реплика\n", 18000))
	session.CampaignID = campaign.ID
	session.Analysis = &sessionAnalysis{Summary: "Previously saved", Digest: session.Digest}
	session, _, _ = store.importSession(session)
	manager := &codexBridgeManager{auth: &authManager{store: store}}
	runner := func(_ context.Context, _ authUser, _ codexPromptInput) (codexPromptResult, error) {
		return codexPromptResult{Message: `{"notes":""}`}, nil
	}
	_, err := manager.runSessionAnalysis(context.Background(), authUser{ID: "owner"}, codexPromptInput{CampaignID: campaign.ID, SessionID: session.ID, Prompt: "Разбор"}, runner)
	if err == nil || !strings.Contains(err.Error(), "пустые заметки") {
		t.Fatalf("underlying validation cause hidden: %v", err)
	}
	got, _ := store.sessionForOwner("owner", campaign.ID, session.ID)
	if got.Text != session.Text || got.Digest != session.Digest || got.Analysis == nil || got.Analysis.Summary != "Previously saved" {
		t.Fatal("failed extraction altered transcript")
	}
	if note, err := extractSessionNotes("```json\n{\"notes\":\"да🐉\"}\n```", 3); err != nil || note != "да🐉" {
		t.Fatal("bounded fenced JSON response rejected")
	}
}

func TestLongSessionExtractionCacheAndFinalSaveRetry(t *testing.T) {
	store, campaign := newSessionTestStore(t)
	session, _ := parseImportedSession("Synthetic", strings.Repeat("Реплика\n", 18000))
	session.CampaignID = campaign.ID
	session, _, _ = store.importSession(session)
	manager := &codexBridgeManager{auth: &authManager{store: store}}
	input := codexPromptInput{CampaignID: campaign.ID, SessionID: session.ID, Prompt: "Разбор", Model: "test-model"}
	extracts, finals := 0, 0
	runner := func(_ context.Context, _ authUser, in codexPromptInput) (codexPromptResult, error) {
		if in.SessionExtract != "" {
			extracts++
			b, _ := json.Marshal(map[string]string{"notes": "Подтверждённый факт [L1]."})
			return codexPromptResult{Message: string(b)}, nil
		}
		finals++
		if in.SessionNotes == "" || in.SessionRunID == "" {
			t.Fatal("missing all-part evidence/run identity")
		}
		if finals == 1 {
			return codexPromptResult{}, &codexPromptPublicError{code: "session_analysis_incomplete"}
		}
		return codexPromptResult{SessionID: session.ID}, nil
	}
	if _, err := manager.runSessionAnalysis(context.Background(), authUser{ID: "owner"}, input, runner); err != nil {
		t.Fatal(err)
	}
	if extracts != len(numberedSessionParts(session.Text)) || finals != 2 {
		t.Fatal(extracts, finals)
	}
	before := extracts
	if _, err := manager.runSessionAnalysis(context.Background(), authUser{ID: "owner"}, input, runner); err != nil {
		t.Fatal(err)
	}
	if extracts != before {
		t.Fatal("retry reread completed parts")
	}
	if _, err := manager.runSessionAnalysis(context.Background(), authUser{ID: "outsider"}, input, runner); err == nil {
		t.Fatal("cross-owner access")
	}
	if extracts != before {
		t.Fatal("unauthorized model call")
	}
	input.Model = "different-model"
	if _, err := manager.runSessionAnalysis(context.Background(), authUser{ID: "owner"}, input, runner); err != nil {
		t.Fatal(err)
	}
	if extracts == before {
		t.Fatal("changed model reused notes")
	}
}

func TestSessionPromptsPrioritizeReportAndBoundedEvidence(t *testing.T) {
	p := buildSessionAnalysisPrompt(codexPromptInput{SessionNotes: "synthetic evidence"})
	if strings.Contains(p, "Read the complete transcript using") || !strings.Contains(p, "MUST include recap") || !strings.Contains(p, "synthetic evidence") {
		t.Fatal("invalid synthesis contract")
	}
	p = buildSessionAnalysisPrompt(codexPromptInput{SessionExtract: "[L123] evidence", SessionExtractLimit: 1000})
	if !strings.Contains(p, "at most 1000") || !strings.Contains(p, "Do not call tools") {
		t.Fatal("invalid extraction contract")
	}
}
