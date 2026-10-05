package httpapi

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type OAuthOptions struct {
	AdminEmail                           string
	BaseURL                              string
	GoogleClientID, GoogleClientSecret   string
	DiscordClientID, DiscordClientSecret string
}
type oauthIdentity struct {
	Email         string `json:"-"`
	EmailVerified bool   `json:"-"`
	Provider      string `json:"provider"`
	Subject       string `json:"subject"`
	Label         string `json:"label,omitempty"`
}
type oauthAttempt struct {
	Admin                               bool
	Provider, Binding, Verifier, UserID string
	ExpiresAt                           time.Time
	Replace                             bool
}
type oauthProvider struct{ ID, Secret, Authorize, Token, UserInfo, Scope string }

var errIdentityConflict = errors.New("identity already linked")

func (m *authManager) provider(name string) (oauthProvider, bool) {
	var p oauthProvider
	switch name {
	case "google":
		p = oauthProvider{m.oauth.GoogleClientID, m.oauth.GoogleClientSecret, "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token", "https://openidconnect.googleapis.com/v1/userinfo", "openid profile email"}
	case "discord":
		p = oauthProvider{m.oauth.DiscordClientID, m.oauth.DiscordClientSecret, "https://discord.com/oauth2/authorize", "https://discord.com/api/oauth2/token", "https://discord.com/api/v10/users/@me", "identify"}
	default:
		return p, false
	}
	return p, p.ID != "" && p.Secret != "" && validOAuthBase(m.oauth.BaseURL)
}
func validOAuthBase(raw string) bool {
	u, e := url.Parse(raw)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return false
	}
	return u.Scheme == "https" || (u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"))
}
func (m *authManager) oauthRedirect(provider string) string {
	return strings.TrimRight(m.oauth.BaseURL, "/") + "/api/auth/oauth/" + provider + "/callback"
}
func (m *authManager) handleOAuth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	path := strings.TrimPrefix(r.URL.Path, "/api/auth/oauth/")
	if path == "providers" {
		if r.Method != http.MethodGet {
			writeError(w, 405, "method_not_allowed", "Only GET is supported")
			return
		}
		linked := map[string]bool{}
		labels := map[string]string{}
		if user, ok := m.currentUser(r); ok {
			if account, found := m.accounts.getUserByID(user.ID); found {
				for _, id := range account.OAuthIdentities {
					linked[id.Provider] = true
					labels[id.Provider] = id.Label
				}
			}
		}
		result := []map[string]interface{}{}
		for _, name := range []string{"google", "discord"} {
			_, enabled := m.provider(name)
			result = append(result, map[string]interface{}{"provider": name, "enabled": enabled, "linked": linked[name], "label": labels[name]})
		}
		writeJSON(w, 200, result)
		return
	}
	parts := strings.Split(path, "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	name, action := parts[0], parts[1]
	p, ok := m.provider(name)
	if !ok {
		writeError(w, 503, "oauth_unavailable", "Этот способ входа пока не настроен.")
		return
	}
	if action == "start" {
		if r.Method != http.MethodPost {
			writeError(w, 405, "method_not_allowed", "Only POST is supported")
			return
		}
		if !isTrustedMutationOrigin(r) {
			writeError(w, 403, "origin_forbidden", "Недопустимый источник запроса.")
			return
		}
		userID := ""
		admin := r.URL.Query().Get("admin") == "1"
		if admin && (name != "google" || strings.TrimSpace(m.oauth.AdminEmail) == "") {
			writeError(w, 403, "admin_forbidden", "Кабинет администратора недоступен.")
			return
		}
		if user, logged := m.currentUser(r); logged {
			userID = user.ID
		} else if r.URL.Query().Get("link") == "1" || r.URL.Query().Get("replace") == "1" {
			writeError(w, 401, "unauthorized", "Сначала войди в аккаунт.")
			return
		}
		replace := r.URL.Query().Get("replace") == "1"
		if admin {
			userID = ""
			replace = false
		}
		if replace && !m.recentOAuthSession(r) {
			writeError(w, 403, "reauth_required", "Для замены сначала выйди и войди снова с паролем или привязанным провайдером.")
			return
		}
		state, e := randomAuthToken()
		if e != nil {
			writeError(w, 500, "oauth_failed", "Не удалось начать вход.")
			return
		}
		binding, e := randomAuthToken()
		if e != nil {
			writeError(w, 500, "oauth_failed", "Не удалось начать вход.")
			return
		}
		verifier, e := randomAuthToken()
		if e != nil {
			writeError(w, 500, "oauth_failed", "Не удалось начать вход.")
			return
		}
		m.mu.Lock()
		for key, a := range m.oauthPending {
			if !time.Now().Before(a.ExpiresAt) {
				delete(m.oauthPending, key)
			}
		}
		if len(m.oauthPending) >= 4096 {
			m.mu.Unlock()
			writeError(w, 429, "oauth_busy", "Повтори попытку позже.")
			return
		}
		m.oauthPending[state] = oauthAttempt{Provider: name, Binding: binding, Verifier: verifier, UserID: userID, ExpiresAt: time.Now().Add(10 * time.Minute), Replace: replace, Admin: admin}
		m.mu.Unlock()
		http.SetCookie(w, &http.Cookie{Name: "shadow_edge_oauth_" + name, Value: binding, Path: "/api/auth/oauth/" + name + "/callback", HttpOnly: true, Secure: requestIsSecure(r), SameSite: http.SameSiteLaxMode, MaxAge: 600})
		q := url.Values{"client_id": {p.ID}, "redirect_uri": {m.oauthRedirect(name)}, "response_type": {"code"}, "scope": {p.Scope}, "state": {state}}
		if name == "google" {
			hash := sha256.Sum256([]byte(verifier))
			q.Set("code_challenge", base64.RawURLEncoding.EncodeToString(hash[:]))
			q.Set("code_challenge_method", "S256")
			q.Set("prompt", "select_account")
		}
		writeJSON(w, 200, map[string]string{"url": p.Authorize + "?" + q.Encode()})
		return
	}
	if action != "callback" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, 405, "method_not_allowed", "Only GET is supported")
		return
	}
	state := r.URL.Query().Get("state")
	cookie, e := r.Cookie("shadow_edge_oauth_" + name)
	m.mu.Lock()
	attempt, found := m.oauthPending[state]
	valid := found && e == nil && attempt.Provider == name && time.Now().Before(attempt.ExpiresAt) && subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(attempt.Binding)) == 1
	if valid {
		delete(m.oauthPending, state)
	}
	m.mu.Unlock()
	if !valid {
		m.oauthFinish(w, r, "invalid_state")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "shadow_edge_oauth_" + name, Path: "/api/auth/oauth/" + name + "/callback", MaxAge: -1, HttpOnly: true, Secure: requestIsSecure(r), SameSite: http.SameSiteLaxMode})
	if r.URL.Query().Get("error") != "" {
		m.oauthFinish(w, r, "denied")
		return
	}
	if attempt.UserID != "" {
		user, logged := m.currentUser(r)
		if !logged || user.ID != attempt.UserID {
			m.oauthFinish(w, r, "session_changed")
			return
		}
	}
	subject, e := m.oauthSubject(r, p, name, attempt.Verifier)
	if e != nil {
		m.oauthFinish(w, r, "provider_failed")
		return
	}
	if attempt.Replace && !m.recentOAuthSession(r) {
		m.oauthFinish(w, r, "session_changed")
		return
	}
	if attempt.Admin && !m.allowedAdminIdentity(subject) {
		http.Redirect(w, r, strings.TrimRight(m.oauth.BaseURL, "/")+"/admin?oauth=forbidden", http.StatusSeeOther)
		return
	}
	user, e := m.accounts.resolveOAuthUser(name, subject.Subject, attempt.UserID, attempt.Replace, subject.Label)
	if e != nil {
		if errors.Is(e, errIdentityConflict) {
			m.oauthFinish(w, r, "already_linked")
		} else {
			m.oauthFinish(w, r, "save_failed")
		}
		return
	}
	if attempt.UserID == "" {
		token, e := m.issueOpaqueSessionToken()
		if e != nil {
			m.oauthFinish(w, r, "session_failed")
			return
		}
		expiry := time.Now().Add(m.sessionTTL)
		m.mu.Lock()
		m.cleanupExpiredLocked(time.Now())
		m.sessions[token] = authSession{UserID: user.ID, Username: user.Username, ExpiresAt: expiry, AuthenticatedAt: time.Now()}
		if attempt.Admin {
			session := m.sessions[token]
			session.AdminEmail = strings.ToLower(strings.TrimSpace(subject.Email))
			session.AdminUntil = time.Now().Add(time.Hour)
			m.sessions[token] = session
		}
		m.mu.Unlock()
		m.writeSessionCookie(w, token, expiry, requestIsSecure(r))
	}
	if attempt.Admin {
		http.Redirect(w, r, strings.TrimRight(m.oauth.BaseURL, "/")+"/admin", http.StatusSeeOther)
		return
	}
	m.oauthFinish(w, r, "success")
}
func (m *authManager) oauthFinish(w http.ResponseWriter, r *http.Request, status string) {
	http.Redirect(w, r, strings.TrimRight(m.oauth.BaseURL, "/")+"/?oauth="+status, http.StatusSeeOther)
}

// Provider identity is fetched server-side with the access token issued for our
// authorization code. No browser-supplied claims or unverified JWT are trusted.
func (m *authManager) oauthSubject(r *http.Request, p oauthProvider, name, verifier string) (oauthIdentity, error) {
	code := r.URL.Query().Get("code")
	if code == "" || len(code) > 8192 {
		return oauthIdentity{}, errors.New("missing code")
	}
	form := url.Values{"grant_type": {"authorization_code"}, "code": {code}, "client_id": {p.ID}, "client_secret": {p.Secret}, "redirect_uri": {m.oauthRedirect(name)}}
	if name == "google" {
		form.Set("code_verifier", verifier)
	}
	req, e := http.NewRequestWithContext(r.Context(), http.MethodPost, p.Token, strings.NewReader(form.Encode()))
	if e != nil {
		return oauthIdentity{}, e
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := m.oauthClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	}
	response, e := client.Do(req)
	if e != nil {
		return oauthIdentity{}, e
	}
	defer response.Body.Close()
	var token struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&token) != nil || token.AccessToken == "" || !strings.EqualFold(token.TokenType, "Bearer") {
		return oauthIdentity{}, errors.New("token exchange failed")
	}
	req, e = http.NewRequestWithContext(r.Context(), http.MethodGet, p.UserInfo, nil)
	if e != nil {
		return oauthIdentity{}, e
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	info, e := client.Do(req)
	if e != nil {
		return oauthIdentity{}, e
	}
	defer info.Body.Close()
	var identity struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Sub           string `json:"sub"`
		Name          string `json:"name"`
		Username      string `json:"username"`
		ID            string `json:"id"`
	}
	if info.StatusCode != 200 || json.NewDecoder(io.LimitReader(info.Body, 65536)).Decode(&identity) != nil {
		return oauthIdentity{}, errors.New("identity verification failed")
	}
	subject := identity.Sub
	if name == "discord" {
		subject = identity.ID
	}
	if subject == "" || len(subject) > 255 {
		return oauthIdentity{}, errors.New("missing identity")
	}
	label := identity.Name
	if name == "discord" {
		label = identity.Username
	}
	label = strings.Join(strings.Fields(label), " ")
	chars := []rune(label)
	if len(chars) > 80 {
		label = string(chars[:80])
	}
	return oauthIdentity{Provider: name, Subject: subject, Label: label, Email: identity.Email, EmailVerified: identity.EmailVerified}, nil
}

func (m *authManager) recentOAuthSession(r *http.Request) bool {
	cookie, e := r.Cookie(m.cookieName)
	if e != nil {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[cookie.Value]
	return ok && time.Now().Before(s.ExpiresAt) && !s.AuthenticatedAt.IsZero() && time.Since(s.AuthenticatedAt) < 10*time.Minute
}
