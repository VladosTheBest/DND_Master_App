package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

const maxSessionTextBytes = 4 << 20

type importedSession struct {
	ID           string           `json:"id"`
	CampaignID   string           `json:"campaignId"`
	Title        string           `json:"title"`
	ImportedAt   string           `json:"importedAt"`
	SourceID     string           `json:"sourceId,omitempty"`
	Participants []string         `json:"participants"`
	Text         string           `json:"text,omitempty"`
	Bytes        int              `json:"bytes"`
	Digest       string           `json:"digest"`
	Number       int              `json:"number"`
	Analysis     *sessionAnalysis `json:"analysis,omitempty"`
}

type sessionPlayerAnalysis struct {
	Name             string   `json:"name"`
	Actions          []string `json:"actions"`
	Moments          []string `json:"moments"`
	NextSessionFocus string   `json:"nextSessionFocus"`
}
type sessionAnalysis struct {
	Journal       *sessionJournal         `json:"journal,omitempty"`
	RunID         string                  `json:"runId"`
	Digest        string                  `json:"digest"`
	GeneratedAt   string                  `json:"generatedAt"`
	Summary       string                  `json:"summary"`
	Recap         string                  `json:"recap,omitempty"`
	KeyEvents     []string                `json:"keyEvents"`
	Players       []sessionPlayerAnalysis `json:"players"`
	NextSession   []string                `json:"nextSession"`
	Uncertainties []string                `json:"uncertainties"`
	ProposalIDs   []string                `json:"proposalIds"`
}

var quillSpeakerLine = regexp.MustCompile(`(?m)^\[\d{2,}:\d{2}:\d{2}\.\d{3}[–-]\d{2,}:\d{2}:\d{2}\.\d{3}\] ([^\r\n:]{1,100}): `)
var quillSourceLine = regexp.MustCompile(`^Quill — ([a-zA-Z0-9_-]{1,100})\n`)

func parseImportedSession(title, text string) (importedSession, error) {
	text = strings.TrimPrefix(text, "\ufeff")
	text = strings.ReplaceAll(text, "\r\n", "\n")
	if strings.TrimSpace(text) == "" || len(text) > maxSessionTextBytes || !utf8.ValidString(text) || strings.ContainsRune(text, 0) {
		return importedSession{}, fmt.Errorf("Выберите непустой текстовый файл UTF-8 размером до 4 МБ.")
	}
	title = strings.TrimSpace(title)
	if title == "" {
		title = "Сессия " + time.Now().Format("02.01.2006")
	}
	if !utf8.ValidString(title) || len([]rune(title)) > 160 {
		return importedSession{}, fmt.Errorf("Название должно содержать не более 160 символов.")
	}
	digest := sha256.Sum256([]byte(text))
	session := importedSession{ID: newID("session"), Title: title, Text: text, Bytes: len(text), Digest: hex.EncodeToString(digest[:]), ImportedAt: time.Now().UTC().Format(time.RFC3339), Participants: []string{}}
	if match := quillSourceLine.FindStringSubmatch(text); match != nil {
		session.SourceID = match[1]
	}
	seen := map[string]bool{}
	for _, match := range quillSpeakerLine.FindAllStringSubmatch(text, -1) {
		name := strings.TrimSpace(match[1])
		if name != "" && !seen[name] {
			session.Participants = append(session.Participants, name)
			seen[name] = true
		}
	}
	return session, nil
}

// Caller must have passed requireOwnedCampaign. Imported text is never served publicly.
func (srv *server) handleImportedSessions(w http.ResponseWriter, r *http.Request, campaignID, id string) {
	switch {
	case r.Method == http.MethodGet:
		srv.store.mu.RLock()
		defer srv.store.mu.RUnlock()
		sessions := []importedSession{}
		for _, session := range srv.store.data.ImportedSessions {
			if session.CampaignID != campaignID {
				continue
			}
			if id != "" {
				if session.ID == id {
					writeJSON(w, http.StatusOK, session)
					return
				}
			} else {
				session.Text = ""
				if session.Analysis != nil {
					session.Analysis = &sessionAnalysis{Summary: session.Analysis.Summary, GeneratedAt: session.Analysis.GeneratedAt, RunID: session.Analysis.RunID}
				}
				sessions = append(sessions, session)
			}
		}
		if id != "" {
			writeError(w, 404, "not_found", "Сессия не найдена.")
			return
		}
		sort.SliceStable(sessions, func(i, j int) bool { return sessions[i].ImportedAt > sessions[j].ImportedAt })
		writeJSON(w, http.StatusOK, sessions)
	case r.Method == http.MethodPost && id == "":
		r.Body = http.MaxBytesReader(w, r.Body, maxSessionTextBytes*2+4096)
		var input struct {
			Title string `json:"title"`
			Text  string `json:"text"`
		}
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(w, 400, "invalid_session", "Не удалось прочитать текст сессии. Максимальный размер — 4 МБ.")
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			writeError(w, 400, "invalid_session", "Некорректный формат запроса.")
			return
		}
		session, err := parseImportedSession(input.Title, input.Text)
		if err != nil {
			writeError(w, 400, "invalid_session", err.Error())
			return
		}
		session.CampaignID = campaignID
		saved, duplicate, err := srv.store.importSession(session)
		if err != nil {
			writeError(w, 500, "save_session_failed", "Не удалось сохранить сессию. Повторите попытку.")
			return
		}
		status := http.StatusCreated
		if duplicate {
			status = http.StatusOK
		}
		writeJSON(w, status, struct {
			Session   importedSession `json:"session"`
			Duplicate bool            `json:"duplicate"`
		}{saved, duplicate})
	case r.Method == http.MethodDelete && id != "":
		srv.store.mu.Lock()
		defer srv.store.mu.Unlock()
		for index, session := range srv.store.data.ImportedSessions {
			if session.CampaignID != campaignID || session.ID != id {
				continue
			}
			original, err := cloneStorageState(srv.store.data)
			if err != nil {
				writeError(w, 500, "delete_session_failed", "Не удалось удалить сессию.")
				return
			}
			srv.store.data.ImportedSessions = append(srv.store.data.ImportedSessions[:index], srv.store.data.ImportedSessions[index+1:]...)
			if err := srv.store.saveMutationLocked(original); err != nil {
				writeError(w, 500, "delete_session_failed", "Не удалось удалить сессию.")
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
			return
		}
		writeError(w, 404, "not_found", "Сессия не найдена.")
	default:
		writeError(w, 405, "method_not_allowed", "Действие не поддерживается.")
	}
}

func (store *campaignStore) importSession(session importedSession) (importedSession, bool, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	total := 0
	nextNumber := 1
	for _, existing := range store.data.ImportedSessions {
		if existing.CampaignID != session.CampaignID {
			continue
		}
		if existing.Digest == session.Digest {
			return existing, true, nil
		}
		total += len(existing.Text)
		if existing.Number >= nextNumber {
			nextNumber = existing.Number + 1
		}
	}
	if total+len(session.Text) > 50<<20 {
		return importedSession{}, false, fmt.Errorf("session storage limit")
	}
	session.Number = nextNumber
	original, err := cloneStorageState(store.data)
	if err != nil {
		return importedSession{}, false, err
	}
	store.data.ImportedSessions = append(store.data.ImportedSessions, session)
	if err := store.saveMutationLocked(original); err != nil {
		return importedSession{}, false, err
	}
	return session, false, nil
}
