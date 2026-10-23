package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

type recoveryCode struct {
	Digest    string    `json:"digest"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type recoveryWindow struct {
	Count     int
	ExpiresAt time.Time
}

func recoveryDigest(owner, code string) string {
	clean := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
	sum := sha256.Sum256([]byte(owner + "\n" + clean))
	return hex.EncodeToString(sum[:])
}
func (m *authManager) allowRecovery(r *http.Request, username string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.recoveryAttempts == nil {
		m.recoveryAttempts = map[string]recoveryWindow{}
	}
	now := time.Now()
	for key, value := range m.recoveryAttempts {
		if now.After(value.ExpiresAt) {
			delete(m.recoveryAttempts, key)
		}
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	digest := sha256.Sum256([]byte(normalizeUsernameKey(username)))
	keys := []string{"ip:" + ip, fmt.Sprintf("account:%x:%s", digest, ip)}
	if len(m.recoveryAttempts) > 8192 {
		return false
	}
	for i, key := range keys {
		window := m.recoveryAttempts[key]
		limit := 30
		if i == 1 {
			limit = 5
		}
		if window.Count >= limit && now.Before(window.ExpiresAt) {
			return false
		}
	}
	for _, key := range keys {
		window := m.recoveryAttempts[key]
		if window.ExpiresAt.IsZero() {
			window.ExpiresAt = now.Add(15 * time.Minute)
		}
		window.Count++
		m.recoveryAttempts[key] = window
	}
	return true
}
func (srv *server) handleRecoveryCodes(w http.ResponseWriter, r *http.Request) {
	user, ok := srv.requireAuthUser(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	account, ok := srv.store.getUserByID(user.ID)
	if !ok {
		writeError(w, 401, "auth_required", "Войдите снова.")
		return
	}
	if r.Method == http.MethodGet {
		count := 0
		var expires time.Time
		for _, code := range account.RecoveryCodes {
			if time.Now().Before(code.ExpiresAt) {
				count++
				expires = code.ExpiresAt
			}
		}
		writeJSON(w, 200, map[string]any{"remaining": count, "expiresAt": expires})
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Поддерживаются GET и POST.")
		return
	}
	var input struct {
		Password string `json:"password"`
	}
	if !boundedMutationInput(w, r, &input, 4<<10) {
		return
	}
	if !srv.auth.allowRecovery(r, "codes:"+user.ID) {
		writeError(w, 429, "recovery_rate_limited", "Слишком много попыток. Попробуйте через 15 минут.")
		return
	}
	if !verifyPassword(account.PasswordHash, input.Password) {
		writeError(w, 403, "password_required", "Подтвердите текущий пароль. Если входите только через Google/Discord, используйте этот способ входа для восстановления.")
		return
	}
	codes := []string{}
	stored := []recoveryCode{}
	expires := time.Now().UTC().Add(180 * 24 * time.Hour)
	for range 8 {
		raw := make([]byte, 12)
		if _, err := rand.Read(raw); err != nil {
			writeError(w, 500, "codes_unavailable", "Не удалось подготовить коды.")
			return
		}
		value := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
		parts := []string{}
		for start := 0; start < len(value); start += 5 {
			parts = append(parts, value[start:min(start+5, len(value))])
		}
		code := strings.Join(parts, "-")
		codes = append(codes, code)
		stored = append(stored, recoveryCode{recoveryDigest(user.ID, code), expires})
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	for index := range srv.store.data.Users {
		u := &srv.store.data.Users[index]
		if u.ID != user.ID {
			continue
		}
		if u.PasswordHash != account.PasswordHash {
			writeError(w, 409, "account_changed", "Пароль изменился. Войдите снова.")
			return
		}
		original, err := cloneStorageState(srv.store.data)
		if err != nil {
			writeError(w, 500, "save_failed", "Коды не сохранены.")
			return
		}
		u.RecoveryCodes = stored
		if err = srv.store.saveMutationLocked(original); err != nil {
			writeError(w, 500, "save_failed", "Коды не сохранены.")
			return
		}
		writeJSON(w, 200, map[string]any{"codes": codes, "expiresAt": expires, "username": account.Username})
		return
	}
}
func (srv *server) handlePasswordRecovery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Используйте POST.")
		return
	}
	var input struct {
		Username    string `json:"username"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
	}
	if !boundedMutationInput(w, r, &input, 8<<10) {
		return
	}
	if !srv.auth.allowRecovery(r, input.Username) {
		writeError(w, 429, "recovery_rate_limited", "Слишком много попыток. Попробуйте через 15 минут.")
		return
	}
	if len(input.Username) > 200 || len(input.Code) > 100 {
		writeError(w, 400, "invalid_recovery", "Проверьте логин и код восстановления.")
		return
	}
	if err := validateAccountPassword(input.NewPassword); err != nil {
		writeError(w, 400, "invalid_password", err.Error())
		return
	}
	hash, err := hashPassword(input.NewPassword)
	if err != nil {
		writeError(w, 500, "recovery_unavailable", "Не удалось изменить пароль.")
		return
	}
	owner := ""
	srv.store.mu.Lock()
	for index := range srv.store.data.Users {
		u := &srv.store.data.Users[index]
		if u.UsernameKey != normalizeUsernameKey(input.Username) {
			continue
		}
		digest := recoveryDigest(u.ID, input.Code)
		valid := false
		for _, code := range u.RecoveryCodes {
			valid = valid || time.Now().Before(code.ExpiresAt) && subtle.ConstantTimeCompare([]byte(digest), []byte(code.Digest)) == 1
		}
		if !valid {
			break
		}
		original, e := cloneStorageState(srv.store.data)
		if e != nil {
			srv.store.mu.Unlock()
			writeError(w, 500, "recovery_unavailable", "Пароль не изменён. Попробуйте позже.")
			return
		}
		u.PasswordHash = hash
		u.AuthVersion++
		u.RecoveryCodes = nil
		if e = srv.store.saveMutationLocked(original); e != nil {
			srv.store.mu.Unlock()
			writeError(w, 500, "recovery_unavailable", "Пароль не изменён. Попробуйте позже.")
			return
		}
		owner = u.ID
		break
	}
	srv.store.mu.Unlock()
	if owner == "" {
		writeError(w, 400, "invalid_recovery", "Проверьте логин и код восстановления. Код мог истечь или уже использоваться.")
		return
	}
	if srv.codex != nil {
		srv.codex.stopBridge(owner)
	}
	srv.auth.mu.Lock()
	for token, session := range srv.auth.sessions {
		if session.UserID == owner {
			delete(srv.auth.sessions, token)
		}
	}
	srv.auth.mu.Unlock()
	srv.auth.clearSessionCookie(w, requestIsSecure(r))
	writeJSON(w, 200, map[string]any{"recovered": true, "message": "Пароль изменён, прежние сессии закрыты. Войдите с новым паролем и подготовьте новые коды."})
}
