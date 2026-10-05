package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type feedbackEntry struct {
	ID           string    `json:"id"`
	AccountID    string    `json:"accountId"`
	SubmissionID string    `json:"submissionId"`
	Type         string    `json:"type"`
	Message      string    `json:"message"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func feedbackType(value string) bool {
	return value == "bug" || value == "suggestion" || value == "impression"
}
func feedbackStatus(value string) bool {
	return value == "new" || value == "reviewing" || value == "closed"
}
func feedbackInput(w http.ResponseWriter, r *http.Request, input any) bool {
	if r.Header.Get("Origin") == "" || !isTrustedMutationOrigin(r) {
		writeError(w, 403, "origin_forbidden", "Недопустимый источник запроса.")
		return false
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32768))
	dec.DisallowUnknownFields()
	if err := dec.Decode(input); err != nil {
		writeError(w, 400, "invalid_input", "Некорректные данные.")
		return false
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		writeError(w, 400, "invalid_input", "Некорректные данные.")
		return false
	}
	return true
}

func (srv *server) handleFeedback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	user, ok := srv.auth.currentUser(r)
	if !ok {
		writeError(w, 401, "unauthorized", "Войди в аккаунт, чтобы оставить отзыв.")
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Only POST is supported")
		return
	}
	var input struct {
		Type         string `json:"type"`
		Message      string `json:"message"`
		SubmissionID string `json:"submissionId"`
	}
	if !feedbackInput(w, r, &input) {
		return
	}
	input.Message = strings.TrimSpace(input.Message)
	if !feedbackType(input.Type) || len([]rune(input.Message)) < 5 || len([]rune(input.Message)) > 5000 || len(input.SubmissionID) < 16 || len(input.SubmissionID) > 64 {
		writeError(w, 400, "invalid_input", "Выбери тип и напиши от 5 до 5000 символов.")
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	now := time.Now().UTC()
	recent := 0
	for _, entry := range srv.store.data.Feedback {
		if entry.AccountID != user.ID {
			continue
		}
		if entry.SubmissionID == input.SubmissionID {
			if entry.Type != input.Type || entry.Message != input.Message {
				writeError(w, 409, "feedback_changed", "Измени сообщение и отправь заново.")
				return
			}
			writeJSON(w, 200, map[string]string{"id": entry.ID})
			return
		}
		if entry.CreatedAt.After(now.Add(-24 * time.Hour)) {
			recent++
		}
	}
	if recent >= 20 {
		writeError(w, 429, "feedback_limit", "Можно отправить до 20 отзывов за 24 часа. Попробуй позже.")
		return
	}
	original, err := cloneStorageState(srv.store.data)
	if err != nil {
		writeError(w, 500, "save_failed", "Не удалось сохранить отзыв.")
		return
	}
	entry := feedbackEntry{newID("feedback"), user.ID, input.SubmissionID, input.Type, input.Message, "new", now, now}
	srv.store.data.Feedback = append(srv.store.data.Feedback, entry)
	if err = srv.store.saveMutationLocked(original); err != nil {
		writeError(w, 500, "save_failed", "Отзыв не сохранён. Попробуй ещё раз.")
		return
	}
	writeJSON(w, 201, map[string]string{"id": entry.ID})
}

func (srv *server) handleAdminFeedback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if _, ok := srv.auth.adminUser(r); !ok {
		writeError(w, 403, "admin_forbidden", "Нужен вход владельца кабинета.")
		return
	}
	if r.Method == http.MethodGet {
		q := r.URL.Query()
		kind, status := q.Get("type"), q.Get("status")
		if (kind != "" && !feedbackType(kind)) || (status != "" && !feedbackStatus(status)) {
			writeError(w, 400, "invalid_filter", "Некорректный фильтр.")
			return
		}
		offset, _ := strconv.Atoi(q.Get("offset"))
		if offset < 0 {
			offset = 0
		}
		query := strings.ToLower(strings.TrimSpace(q.Get("q")))
		srv.store.mu.RLock()
		defer srv.store.mu.RUnlock()
		names := map[string]string{}
		for _, u := range srv.store.data.Users {
			names[u.ID] = u.Username
		}
		type row struct {
			feedbackEntry
			Username string `json:"username"`
		}
		rows := []row{}
		total := 0
		for i := len(srv.store.data.Feedback) - 1; i >= 0; i-- {
			entry := srv.store.data.Feedback[i]
			if (kind != "" && entry.Type != kind) || (status != "" && entry.Status != status) || !strings.Contains(strings.ToLower(entry.Message+" "+entry.AccountID+" "+names[entry.AccountID]), query) {
				continue
			}
			total++
			if total > offset && len(rows) < 50 {
				rows = append(rows, row{entry, names[entry.AccountID]})
			}
		}
		writeJSON(w, 200, map[string]any{"items": rows, "total": total})
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Only GET and POST are supported")
		return
	}
	var input struct {
		ID       string `json:"id"`
		Status   string `json:"status"`
		Expected string `json:"expected"`
	}
	if !feedbackInput(w, r, &input) {
		return
	}
	if !feedbackStatus(input.Status) || !feedbackStatus(input.Expected) {
		writeError(w, 400, "invalid_status", "Некорректный статус.")
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	for i, entry := range srv.store.data.Feedback {
		if entry.ID != input.ID {
			continue
		}
		if entry.Status != input.Expected {
			writeError(w, 409, "feedback_changed", "Статус уже изменился. Обнови список.")
			return
		}
		original, err := cloneStorageState(srv.store.data)
		if err != nil {
			writeError(w, 500, "save_failed", "Не удалось сохранить статус.")
			return
		}
		srv.store.data.Feedback[i].Status = input.Status
		srv.store.data.Feedback[i].UpdatedAt = time.Now().UTC()
		if err = srv.store.saveMutationLocked(original); err != nil {
			writeError(w, 500, "save_failed", "Статус не сохранён.")
			return
		}
		writeJSON(w, 200, srv.store.data.Feedback[i])
		return
	}
	writeError(w, 404, "not_found", "Отзыв не найден.")
}
