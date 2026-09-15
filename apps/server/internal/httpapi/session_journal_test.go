package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func syntheticJournal() *sessionJournal {
	return &sessionJournal{Version: 1,
		Locations: []sessionJournalLocation{{ID: "bridge", Name: "Мост", Summary: "Партия осмотрела мост.", Sources: []sessionSourceRange{{4, 6}}}},
		Entries:   []sessionJournalEntry{{ID: "rope", Kind: "loot", Title: "Найдена верёвка", Detail: "Арина нашла верёвку; кому передали — не указано.", LocationID: "bridge", Status: "confirmed", People: []string{"Арина"}, Sources: []sessionSourceRange{{6, 6}}}},
		Speech:    []sessionSpeechRange{{sessionSourceRange{4, 6}, "game"}},
	}
}

func TestSessionJournalValidation(t *testing.T) {
	cases := map[string]func(*sessionJournal){
		"unknown version":    func(j *sessionJournal) { j.Version = 99 },
		"missing location":   func(j *sessionJournal) { j.Entries[0].LocationID = "never-visited" },
		"duplicate id":       func(j *sessionJournal) { j.Entries = append(j.Entries, j.Entries[0]) },
		"duplicate location": func(j *sessionJournal) { j.Locations = append(j.Locations, j.Locations[0]) },
		"missing evidence":   func(j *sessionJournal) { j.Entries[0].Sources = nil },
		"invalid source":     func(j *sessionJournal) { j.Entries[0].Sources[0] = sessionSourceRange{6, 999} },
		"reversed source":    func(j *sessionJournal) { j.Entries[0].Sources[0] = sessionSourceRange{6, 4} },
		"empty source":       func(j *sessionJournal) { j.Entries[0].Sources[0] = sessionSourceRange{2, 2} },
		"invalid kind":       func(j *sessionJournal) { j.Entries[0].Kind = "made-up" },
		"invalid status":     func(j *sessionJournal) { j.Entries[0].Status = "probably" },
		"overlapping speech": func(j *sessionJournal) {
			j.Speech = append(j.Speech, sessionSpeechRange{sessionSourceRange{5, 6}, "table"})
		},
		"out of bounds speech": func(j *sessionJournal) { j.Speech[0].ToLine = 100 },
		"invalid speech":       func(j *sessionJournal) { j.Speech[0].Kind = "npc" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			journal := syntheticJournal()
			mutate(journal)
			if err := validateSessionJournal(journal, syntheticQuillText); err == nil {
				t.Fatal("invalid journal accepted")
			}
		})
	}
	if err := validateSessionJournal(syntheticJournal(), syntheticQuillText); err != nil {
		t.Fatal(err)
	}
	if err := validateSessionJournal(nil, syntheticQuillText); err != nil {
		t.Fatal("legacy report rejected")
	}
	empty := &sessionJournal{Version: 1}
	if err := validateSessionJournal(empty, syntheticQuillText); err != nil {
		t.Fatal(err)
	}
	if empty.Entries == nil || empty.Locations == nil || empty.Speech == nil {
		t.Fatal("empty lists must serialize as arrays")
	}
}

func TestSessionJournalRoundTripAndRejectedReplacement(t *testing.T) {
	store, campaign := newSessionTestStore(t)
	session, _ := parseImportedSession("Игра", syntheticQuillText)
	session.CampaignID = campaign.ID
	session, _, _ = store.importSession(session)
	srv := &server{store: store}
	input := sessionAnalysis{RunID: "journal-run", Digest: session.Digest, Summary: "Осмотрели мост.", Recap: "Партия подошла к мосту.\n\nАрина нашла верёвку.", Journal: syntheticJournal()}
	save := func() int {
		body, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		response := httptest.NewRecorder()
		srv.handleSessionAnalysis(response, httptest.NewRequest("PUT", "/", strings.NewReader(string(body))), "owner", campaign.ID, session.ID)
		return response.Code
	}
	if code := save(); code != 200 {
		t.Fatalf("save: %d", code)
	}
	input.Recap = strings.Repeat("я", 24001)
	if code := save(); code != 400 {
		t.Fatalf("oversized recap: %d", code)
	}
	input.Recap = "Партия подошла к мосту.\n\nАрина нашла верёвку."
	input.Journal.Entries[0].Sources[0].ToLine = 900
	input.Summary = "Invalid replacement"
	if code := save(); code != 400 {
		t.Fatalf("invalid replacement: %d", code)
	}
	reopened, err := newCampaignStore(store.path)
	if err != nil {
		t.Fatal(err)
	}
	got, ok := reopened.sessionForOwner("owner", campaign.ID, session.ID)
	if !ok || got.Text != syntheticQuillText || got.Analysis == nil || got.Analysis.Summary != "Осмотрели мост." || got.Analysis.Journal.Entries[0].Sources[0].ToLine != 6 {
		t.Fatal("journal or source changed after invalid save/restart")
	}
	if len(got.Analysis.Journal.Speech) != 1 || got.Analysis.Journal.Speech[0].FromLine != 4 {
		t.Fatal("speech ranges lost")
	}
	if got.Analysis.Recap != "Партия подошла к мосту.\n\nАрина нашла верёвку." {
		t.Fatal("recap lost after save/restart or overwritten by rejected report")
	}
}
