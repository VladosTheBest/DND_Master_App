package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func syntheticDMReport() *sessionDMReport {
	return &sessionDMReport{Version: 1, Scenes: []sessionDMScene{{Title: "Мост", Detail: "Осмотр моста и поиск следов.", Sources: []sessionSourceRange{{4, 6}}}}, Findings: []sessionDMFinding{{Section: "continuity", Title: "Кто несёт верёвку", Detail: "Уточнить владельца перед продолжением.", Basis: "suggestion", Sources: []sessionSourceRange{{6, 6}}}}}
}

func TestSessionDMReportValidation(t *testing.T) {
	cases := map[string]func(*sessionDMReport){
		"version":             func(r *sessionDMReport) { r.Version = 2 },
		"source bounds":       func(r *sessionDMReport) { r.Findings[0].Sources[0].ToLine = 900 },
		"reversed source":     func(r *sessionDMReport) { r.Findings[0].Sources[0].FromLine = 7 },
		"empty evidence":      func(r *sessionDMReport) { r.Findings[0].Sources = []sessionSourceRange{{2, 2}} },
		"missing evidence":    func(r *sessionDMReport) { r.Findings[0].Sources = nil },
		"invented section":    func(r *sessionDMReport) { r.Findings[0].Section = "personality" },
		"invented basis":      func(r *sessionDMReport) { r.Findings[0].Basis = "certain" },
		"feedback inference":  func(r *sessionDMReport) { r.Findings[0].Section = "feedback" },
		"preparation as fact": func(r *sessionDMReport) { r.Findings[0].Section = "preparation"; r.Findings[0].Basis = "observed" },
		"status":              func(r *sessionDMReport) { r.Findings[0].Status = "maybe" },
		"too much text":       func(r *sessionDMReport) { r.Findings[0].Detail = strings.Repeat("я", 2001) },
		"scenes unordered": func(r *sessionDMReport) {
			r.Scenes = append(r.Scenes, sessionDMScene{Title: "Раньше", Detail: "Описание", Sources: []sessionSourceRange{{1, 1}}})
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			r := syntheticDMReport()
			mutate(r)
			if validateSessionDMReport(r, syntheticQuillText) == nil {
				t.Fatal("invalid report accepted")
			}
		})
	}
	if err := validateSessionDMReport(syntheticDMReport(), syntheticQuillText); err != nil {
		t.Fatal(err)
	}
	if err := validateSessionDMReport(nil, syntheticQuillText); err != nil {
		t.Fatal(err)
	}
}

func TestSessionDMReportPersistenceAndRejectedReplacement(t *testing.T) {
	store, campaign := newSessionTestStore(t)
	session, _ := parseImportedSession("Игра", syntheticQuillText)
	session.CampaignID = campaign.ID
	session, _, _ = store.importSession(session)
	srv := &server{store: store}
	input := sessionAnalysis{RunID: "dm-report", Digest: session.Digest, Summary: "Осмотр моста", DMReport: syntheticDMReport()}
	save := func() int {
		body, _ := json.Marshal(input)
		res := httptest.NewRecorder()
		srv.handleSessionAnalysis(res, httptest.NewRequest("PUT", "/", strings.NewReader(string(body))), "owner", campaign.ID, session.ID)
		return res.Code
	}
	if code := save(); code != 200 {
		t.Fatalf("save %d", code)
	}
	input.DMReport.Findings[0].Sources = nil
	if code := save(); code != 400 {
		t.Fatalf("invalid save %d", code)
	}
	reopened, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatal(err)
	}
	got, ok := reopened.sessionForOwner("owner", campaign.ID, session.ID)
	if !ok || got.Analysis.DMReport == nil || len(got.Analysis.DMReport.Findings[0].Sources) != 1 {
		t.Fatal("report lost after rejected write or reload")
	}
	list := httptest.NewRecorder()
	srv.handleImportedSessions(list, httptest.NewRequest("GET", "/", nil), campaign.ID, "")
	if strings.Contains(list.Body.String(), "dmReport") {
		t.Fatal("detailed report leaked into metadata list")
	}
}

func TestDMReportPromptIncludesFeedbackAcrossParts(t *testing.T) {
	extraction := buildSessionAnalysisPrompt(codexPromptInput{SessionExtract: "evidence", SessionExtractLimit: 6000})
	if !strings.Contains(extraction, "end-of-session feedback") {
		t.Fatal("feedback dropped from long transcript extraction")
	}
	prompt := buildSessionAnalysisPrompt(codexPromptInput{SessionNotes: "last-part evidence"})
	for _, required := range []string{"dmReport version 1", "feedback: ONLY explicit", "last-part evidence", "hypothesis", "suggestion"} {
		if !strings.Contains(prompt, required) {
			t.Fatal("missing " + required)
		}
	}
}
