package httpapi

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

// Source lines are 1-based in the stored, normalized transcript, including its header.
// This keeps references stable across pagination, speaker filters and repeated timestamps.
type sessionSourceRange struct {
	FromLine int `json:"fromLine"`
	ToLine   int `json:"toLine"`
}

type sessionJournalLocation struct {
	ID      string               `json:"id"`
	Name    string               `json:"name"`
	Summary string               `json:"summary"`
	Sources []sessionSourceRange `json:"sources"`
}

type sessionJournalEntry struct {
	ID         string               `json:"id"`
	Kind       string               `json:"kind"`
	Title      string               `json:"title"`
	Detail     string               `json:"detail"`
	LocationID string               `json:"locationId,omitempty"`
	People     []string             `json:"people"`
	Status     string               `json:"status"`
	Sources    []sessionSourceRange `json:"sources"`
}

type sessionSpeechRange struct {
	sessionSourceRange
	Kind string `json:"kind"`
}

type sessionJournal struct {
	Version   int                      `json:"version"`
	Locations []sessionJournalLocation `json:"locations"`
	Entries   []sessionJournalEntry    `json:"entries"`
	Speech    []sessionSpeechRange     `json:"speech"`
}

func validateSessionJournal(journal *sessionJournal, text string) error {
	if journal == nil { // Existing reports and HTTP clients remain readable/writable.
		return nil
	}
	if journal.Locations == nil {
		journal.Locations = []sessionJournalLocation{}
	}
	if journal.Entries == nil {
		journal.Entries = []sessionJournalEntry{}
	}
	if journal.Speech == nil {
		journal.Speech = []sessionSpeechRange{}
	}
	if journal.Version != 1 || len(journal.Locations) > 60 || len(journal.Entries) > 200 || len(journal.Speech) > 4000 {
		return fmt.Errorf("Неподдерживаемая версия или слишком большой журнал сессии.")
	}
	lines := strings.Split(text, "\n")
	validText := func(value string, limit int) bool {
		return strings.TrimSpace(value) != "" && utf8.ValidString(value) && utf8.RuneCountInString(value) <= limit
	}
	validRange := func(r sessionSourceRange) bool {
		return r.FromLine >= 1 && r.ToLine >= r.FromLine && r.ToLine <= len(lines)
	}
	validSources := func(sources []sessionSourceRange) bool {
		if len(sources) < 1 || len(sources) > 6 {
			return false
		}
		for _, source := range sources {
			if !validRange(source) || strings.TrimSpace(strings.Join(lines[source.FromLine-1:source.ToLine], "\n")) == "" {
				return false
			}
		}
		return true
	}
	locations := map[string]bool{}
	for _, location := range journal.Locations {
		if !validText(location.ID, 100) || locations[location.ID] || !validText(location.Name, 200) || !validText(location.Summary, 2000) || !validSources(location.Sources) {
			return fmt.Errorf("Проверьте локации журнала и ссылки на строки исходного текста.")
		}
		locations[location.ID] = true
	}
	entries := map[string]bool{}
	for index, entry := range journal.Entries {
		if entry.People == nil {
			journal.Entries[index].People = []string{}
		}
		if !validText(entry.ID, 100) || entries[entry.ID] || !validText(entry.Title, 200) || !validText(entry.Detail, 3000) || !validSources(entry.Sources) || len(entry.People) > 30 {
			return fmt.Errorf("Проверьте карточки журнала и ссылки на строки исходного текста.")
		}
		entries[entry.ID] = true
		if entry.LocationID != "" && !locations[entry.LocationID] {
			return fmt.Errorf("Локация карточки отсутствует в журнале.")
		}
		for _, person := range entry.People {
			if !validText(person, 100) {
				return fmt.Errorf("Некорректное имя участника карточки.")
			}
		}
		switch entry.Kind {
		case "event", "dialogue", "loot", "discovery", "encounter":
		default:
			return fmt.Errorf("Неизвестный раздел журнала.")
		}
		switch entry.Status {
		case "confirmed", "planned", "uncertain":
		default:
			return fmt.Errorf("Неизвестный статус события.")
		}
	}
	lastLine := 0
	for _, speech := range journal.Speech {
		if !validRange(speech.sessionSourceRange) || speech.FromLine <= lastLine {
			return fmt.Errorf("Разметка речи должна идти по порядку без пересечений.")
		}
		switch speech.Kind {
		case "game", "table", "uncertain":
		default:
			return fmt.Errorf("Неизвестный тип речи.")
		}
		lastLine = speech.ToLine
	}
	return nil
}
