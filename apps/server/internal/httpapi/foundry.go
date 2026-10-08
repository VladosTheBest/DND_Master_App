package httpapi

// Foundry exchange is deliberately manual. Bearer grants are campaign-scoped;
// they are never accepted by the normal cookie-authenticated API.
import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const foundryPrefix = "/api/integrations/foundry/"

type foundryConnection struct {
	ID         string `json:"id"`
	OwnerID    string `json:"ownerId"`
	CampaignID string `json:"campaignId"`
	Origin     string `json:"origin"`
	TokenHash  string `json:"tokenHash"`
	CreatedAt  string `json:"createdAt"`
}

// Resolve the wizard's current book and preparation, including subclass book grants.
// This is an exchange projection, not a change to the saved character draft.
type foundrySpellSelection struct {
	Known    []string `json:"known"`
	Prepared []string `json:"prepared"`
	Always   []string `json:"always"`
	Cantrips []string `json:"cantrips"`
}
type foundryCharacterSheet struct {
	characterSheet
	SpellSelection *foundrySpellSelection `json:"spellSelection,omitempty"`
}

func foundryWizardSpells(d characterDraft) *foundrySpellSelection {
	if d.ClassID != "wizard" || len(d.Levels) == 0 {
		return nil
	}
	current := d.Levels[len(d.Levels)-1]
	unique := func(ids []string) []string {
		result := []string{}
		seen := map[string]bool{}
		for _, id := range ids {
			if !seen[id] {
				seen[id] = true
				result = append(result, id)
			}
		}
		return result
	}
	always := characterWizardAlwaysPrepared(d, d.TargetLevel)
	known := append(append(append([]string{}, current.SpellIDs...), characterWizardBookBonusSpells(d, d.TargetLevel)...), always...)
	return &foundrySpellSelection{Known: unique(known), Prepared: unique(current.PreparedSpellIDs), Always: unique(always), Cantrips: unique(current.CantripIDs)}
}

type foundryReceipt struct {
	ID           string            `json:"id"`
	ConnectionID string            `json:"connectionId"`
	CampaignID   string            `json:"campaignId"`
	OwnerID      string            `json:"ownerId"`
	Digest       string            `json:"digest"`
	Mappings     map[string]string `json:"mappings"`
}
type foundryActor struct {
	Name             string           `json:"name"`
	Edition          string           `json:"edition"`
	Abilities        map[string]int   `json:"abilities"`
	MaxHP            int              `json:"maxHp"`
	ArmorClass       int              `json:"armorClass"`
	Speed            int              `json:"speed"`
	ProficiencyBonus int              `json:"proficiencyBonus"`
	Items            []foundryAbility `json:"items"`
}

// No JavaScript, macros, arbitrary flags or effect expressions are transported.
type foundryAbility struct {
	Mechanics   *foundryMechanics `json:"mechanics,omitempty"`
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Type        string            `json:"type"`
	SpellID     string            `json:"spellId,omitempty"`
	AttackBonus int               `json:"attackBonus,omitempty"`
	Damage      string            `json:"damage,omitempty"`
	DamageType  string            `json:"damageType,omitempty"`
	SaveAbility string            `json:"saveAbility,omitempty"`
	SaveDC      int               `json:"saveDc,omitempty"`
	Range       int               `json:"range,omitempty"`
}

type foundryMechanics struct {
	Kind        string `json:"kind"`
	Activation  string `json:"activation,omitempty"`
	AttackMode  string `json:"attackMode,omitempty"`
	Range       int    `json:"range,omitempty"`
	SaveAbility string `json:"saveAbility,omitempty"`
	SaveDC      int    `json:"saveDc,omitempty"`
	SaveDamage  string `json:"saveDamage,omitempty"`
	DamageType  string `json:"damageType,omitempty"`
}
type foundryRecord struct {
	Key   string          `json:"key"`
	ID    string          `json:"id"`
	Kind  string          `json:"kind"`
	Title string          `json:"title"`
	Hash  string          `json:"hash"`
	Data  json.RawMessage `json:"data"`
}
type foundryChange struct {
	Key      string          `json:"key"`
	ID       string          `json:"id"`
	Kind     string          `json:"kind"`
	BaseHash string          `json:"baseHash"`
	Data     json.RawMessage `json:"data"`
}
type foundryExport struct {
	RequestID string          `json:"requestId"`
	Changes   []foundryChange `json:"changes"`
}
type foundryPairing struct {
	ID, Hash, Origin, ConnectionID string
	Expires                        time.Time
}
type foundryManager struct {
	srv      *server
	mu       sync.Mutex
	pairings map[string]*foundryPairing
	attempts map[string][]time.Time
	previews map[string]foundryPreview
}
type foundryPreview struct {
	Digest  string
	Expires time.Time
}

func newFoundryManager(s *server) *foundryManager {
	return &foundryManager{srv: s, pairings: map[string]*foundryPairing{}, attempts: map[string][]time.Time{}, previews: map[string]foundryPreview{}}
}
func foundryHash(v any) string {
	b, _ := json.Marshal(v)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func foundryTokenHash(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
func validFoundryOrigin(raw string) bool {
	u, e := url.Parse(raw)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" {
		return false
	}
	return u.Scheme == "https" || u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1")
}
func foundryRead(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		writeError(w, 400, "invalid_exchange", "Некорректный пакет обмена.")
		return false
	}
	if d.Decode(&struct{}{}) != io.EOF {
		writeError(w, 400, "invalid_exchange", "Ожидается один JSON-пакет.")
		return false
	}
	return true
}
func (m *foundryManager) cookieUser(w http.ResponseWriter, r *http.Request) (authUser, bool) {
	u, ok := m.srv.requireAuthUser(w, r)
	if !ok {
		return u, false
	}
	if r.Method != http.MethodGet && !isTrustedMutationOrigin(r) {
		writeError(w, 403, "origin_not_allowed", "Источник запроса не разрешён.")
		return u, false
	}
	return u, true
}
func (m *foundryManager) grant(r *http.Request) (foundryConnection, bool) {
	if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
		return foundryConnection{}, false
	}
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if len(token) < 32 || len(token) > 128 {
		return foundryConnection{}, false
	}
	m.srv.store.mu.RLock()
	defer m.srv.store.mu.RUnlock()
	for _, c := range m.srv.store.data.FoundryConnections {
		if c.TokenHash == foundryTokenHash(token) && (r.Header.Get("Origin") == "" || r.Header.Get("Origin") == c.Origin) {
			for _, campaign := range m.srv.store.data.Campaigns {
				if campaign.ID == c.CampaignID && campaign.OwnerID == c.OwnerID {
					return c, true
				}
			}
		}
	}
	return foundryConnection{}, false
}
func (m *foundryManager) handle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	action := strings.TrimPrefix(r.URL.Path, foundryPrefix)
	cookieRoute := action == "connections" || strings.HasPrefix(action, "connections/") || strings.HasSuffix(action, "/approve")
	origin := r.Header.Get("Origin")
	if !cookieRoute && validFoundryOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Add("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, If-None-Match")
		w.Header().Set("Access-Control-Expose-Headers", "ETag")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	}
	if r.Method == http.MethodOptions {
		if cookieRoute || !validFoundryOrigin(origin) {
			writeError(w, 403, "origin_not_allowed", "Источник не разрешён.")
		} else {
			w.WriteHeader(204)
		}
		return
	}
	if action == "pairings" && r.Method == http.MethodPost {
		m.beginPairing(w, r)
		return
	}
	if strings.HasPrefix(action, "pairings/") {
		m.pairing(w, r, strings.TrimPrefix(action, "pairings/"))
		return
	}
	if cookieRoute {
		m.connections(w, r, action)
		return
	}
	c, ok := m.grant(r)
	if !ok {
		writeError(w, 401, "foundry_connection_required", "Подключите кампанию или повторите вход.")
		return
	}
	switch {
	case action == "v1/snapshot" && r.Method == http.MethodGet:
		m.srv.store.mu.RLock()
		records, title := foundryRecords(m.srv.store.data, c.CampaignID)
		aliases := map[string]string{}
		for _, receipt := range m.srv.store.data.FoundryReceipts {
			if receipt.ConnectionID == c.ID {
				for key, id := range receipt.Mappings {
					for _, sheet := range m.srv.store.data.CharacterSheets {
						if sheet.CampaignID == c.CampaignID && sheet.Sheet.ID == id {
							id = sheet.Sheet.PlayerID
						}
					}
					aliases[key] = id
				}
			}
		}
		m.srv.store.mu.RUnlock()
		spells := foundrySpells(records)
		etag := `"` + foundryHash([]any{records, spells, title, aliases}) + `"`
		w.Header().Set("ETag", etag)
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(304)
			return
		}
		writeJSON(w, 200, map[string]any{"schemaVersion": 1, "campaignId": c.CampaignID, "title": title, "records": records, "spells": spells, "aliases": aliases})
	case (action == "v1/export/preview" || action == "v1/export/commit") && r.Method == http.MethodPost:
		m.exchange(w, r, c, strings.HasSuffix(action, "commit"))
	case action == "v1/assets" && r.Method == http.MethodPost:
		m.srv.handleCampaignUpload(w, r, c.OwnerID, c.CampaignID)
	case action == "v1/assets" && r.Method == http.MethodGet:
		m.asset(w, r, c)
	default:
		writeError(w, 405, "method_not_allowed", "Неизвестная команда или метод обмена.")
	}
}
func (m *foundryManager) beginPairing(w http.ResponseWriter, r *http.Request) {
	var input struct {
		TokenHash string `json:"tokenHash"`
	}
	if !foundryRead(w, r, &input) {
		return
	}
	if b, e := hex.DecodeString(input.TokenHash); e != nil || len(b) != 32 || !validFoundryOrigin(r.Header.Get("Origin")) {
		writeError(w, 400, "invalid_pairing", "Нужен безопасный запрос из Foundry.")
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	for id, p := range m.pairings {
		if now.After(p.Expires) {
			delete(m.pairings, id)
		}
	}
	for ip, times := range m.attempts {
		kept := times[:0]
		for _, t := range times {
			if now.Sub(t) < 10*time.Minute {
				kept = append(kept, t)
			}
		}
		if len(kept) == 0 {
			delete(m.attempts, ip)
		} else {
			m.attempts[ip] = kept
		}
	}
	clientIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		clientIP = r.RemoteAddr
	}
	if len(m.pairings) >= 512 || len(m.attempts[clientIP]) >= 20 {
		writeError(w, 429, "pairing_limit", "Повторите подключение позже.")
		return
	}
	m.attempts[clientIP] = append(m.attempts[clientIP], now)
	id, _ := randomAuthToken()
	p := &foundryPairing{ID: id, Hash: input.TokenHash, Origin: r.Header.Get("Origin"), Expires: now.Add(5 * time.Minute)}
	m.pairings[id] = p
	writeJSON(w, 201, map[string]any{"id": id, "expiresAt": p.Expires.UTC().Format(time.RFC3339), "url": "/foundry/connect?id=" + url.QueryEscape(id)})
}
func (m *foundryManager) pairing(w http.ResponseWriter, r *http.Request, action string) {
	parts := strings.Split(action, "/")
	m.mu.Lock()
	defer m.mu.Unlock()
	p := m.pairings[parts[0]]
	if p == nil || time.Now().After(p.Expires) {
		writeError(w, 404, "pairing_expired", "Запрос подключения истёк.")
		return
	}
	if len(parts) == 1 && r.Method == http.MethodGet {
		if p.Hash != foundryTokenHash(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")) || r.Header.Get("Origin") != p.Origin {
			writeError(w, 403, "pairing_denied", "Запрос не разрешён.")
			return
		}
		writeJSON(w, 200, map[string]any{"approved": p.ConnectionID != "", "connectionId": p.ConnectionID})
		return
	}
	if len(parts) != 2 || parts[1] != "approve" || r.Method != http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Неверная команда.")
		return
	}
	u, ok := m.cookieUser(w, r)
	if !ok {
		return
	}
	var input struct {
		CampaignID string `json:"campaignId"`
	}
	if !foundryRead(w, r, &input) {
		return
	}
	if p.ConnectionID != "" {
		writeError(w, 409, "already_approved", "Запрос уже подтверждён.")
		return
	}
	s := m.srv.store
	s.mu.Lock()
	defer s.mu.Unlock()
	owned := false
	for _, c := range s.data.Campaigns {
		if c.ID == input.CampaignID && c.OwnerID == u.ID {
			owned = true
		}
	}
	if !owned {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	original, e := cloneStorageState(s.data)
	if e != nil {
		writeError(w, 500, "save_failed", "Ошибка сохранения.")
		return
	}
	id, _ := randomAuthToken()
	c := foundryConnection{ID: id, OwnerID: u.ID, CampaignID: input.CampaignID, Origin: p.Origin, TokenHash: p.Hash, CreatedAt: time.Now().UTC().Format(time.RFC3339)}
	s.data.FoundryConnections = append(s.data.FoundryConnections, c)
	if e = s.saveMutationLocked(original); e != nil {
		writeError(w, 500, "save_failed", "Подключение не сохранено.")
		return
	}
	p.ConnectionID = id
	writeJSON(w, 200, map[string]bool{"approved": true})
}
func (m *foundryManager) connections(w http.ResponseWriter, r *http.Request, action string) {
	u, ok := m.cookieUser(w, r)
	if !ok {
		return
	}
	s := m.srv.store
	s.mu.Lock()
	defer s.mu.Unlock()
	if action == "connections" && r.Method == http.MethodGet {
		rows := []map[string]string{}
		for _, c := range s.data.FoundryConnections {
			if c.OwnerID == u.ID {
				rows = append(rows, map[string]string{"id": c.ID, "campaignId": c.CampaignID, "origin": c.Origin, "createdAt": c.CreatedAt})
			}
		}
		writeJSON(w, 200, rows)
		return
	}
	if r.Method == http.MethodDelete && strings.HasPrefix(action, "connections/") {
		id := strings.TrimPrefix(action, "connections/")
		for i, c := range s.data.FoundryConnections {
			if c.ID == id && c.OwnerID == u.ID {
				old, e := cloneStorageState(s.data)
				if e != nil {
					writeError(w, 500, "save_failed", "Ошибка сохранения.")
					return
				}
				s.data.FoundryConnections = append(s.data.FoundryConnections[:i], s.data.FoundryConnections[i+1:]...)
				if s.saveMutationLocked(old) != nil {
					writeError(w, 500, "save_failed", "Ошибка сохранения.")
					return
				}
				writeJSON(w, 200, map[string]bool{"revoked": true})
				return
			}
		}
	}
	writeError(w, 404, "not_found", "Подключение не найдено.")
}
func foundryRecords(state storageState, campaignID string) ([]foundryRecord, string) {
	rows := []foundryRecord{}
	title := ""
	add := func(kind, id, name string, data any) {
		body, _ := json.Marshal(data)
		rows = append(rows, foundryRecord{kind + ":" + id, id, kind, name, foundryHash(data), body})
	}
	for _, c := range state.Campaigns {
		if c.ID != campaignID {
			continue
		}
		title = c.Title
		for _, e := range campaignEntities(c) {
			add(e.Kind, e.ID, e.Title, e)
		}
		for _, v := range c.Events {
			add("event", v.ID, v.Title, v)
		}
		for _, v := range c.SessionPrep {
			add("prep", v.ID, v.Title, v)
		}
		for _, v := range c.Shops {
			add("shop", v.ID, v.Name, v)
		}
		for _, v := range c.WorldMaps {
			v.Prompt = ""
			v.ReferenceURL = ""
			v.Provider = ""
			add("world-map", v.ID, v.Title, v)
		}
		for _, v := range c.SessionMaps {
			add("session-map", v.ID, v.Title, v)
		}
	}
	for _, s := range state.CharacterSheets {
		if s.CampaignID == campaignID {
			add("character", s.Sheet.ID, s.Sheet.Draft.Name, foundryCharacterSheet{characterSheet: s.Sheet, SpellSelection: foundryWizardSpells(s.Sheet.Draft)})
		}
	}
	return rows, title
}

func foundrySpells(records []foundryRecord) []characterSpell {
	ids := map[string]bool{}
	names := []string{}
	for _, r := range records {
		if r.Kind == "character" {
			var s foundryCharacterSheet
			_ = json.Unmarshal(r.Data, &s)
			if s.SpellSelection != nil {
				for _, id := range append(append([]string{}, s.SpellSelection.Known...), s.SpellSelection.Cantrips...) {
					ids[id] = true
				}
			} else {
				for _, l := range s.Draft.Levels {
					for _, id := range append(append(append([]string{}, l.SpellIDs...), l.CantripIDs...), l.PreparedSpellIDs...) {
						ids[id] = true
					}
				}
			}
		} else if r.Kind == "npc" || r.Kind == "monster" {
			var e knowledgeEntity
			_ = json.Unmarshal(r.Data, &e)
			if e.StatBlock != nil && e.StatBlock.Spellcasting != nil {
				names = append(names, e.StatBlock.Spellcasting.Spells...)
			}
		}
	}
	spells := []characterSpell{}
	for _, s := range characterRules.Spells {
		include := ids[s.ID]
		for _, name := range names {
			for _, part := range strings.Split(s.Name, " · ") {
				if strings.EqualFold(strings.TrimSpace(name), strings.TrimSpace(part)) {
					include = true
				}
			}
		}
		if include {
			spells = append(spells, s)
		}
	}
	return spells
}
func (m *foundryManager) connectPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(405)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	u, ok := m.srv.auth.currentUser(r)
	if !ok {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<h1>Подключение Foundry</h1><p>Войдите в кабинет мастера в соседней вкладке, затем обновите эту страницу.</p><a href="/" target="_blank" rel="noopener">Открыть сайт</a>`)
		return
	}
	rows := m.srv.store.listCampaignsForUser(u.ID)
	t := template.Must(template.New("connect").Parse(foundryConnectHTML))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = t.Execute(w, map[string]any{"ID": r.URL.Query().Get("id"), "Campaigns": rows})
}

func (m *foundryManager) distribution(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(405)
		return
	}
	if r.URL.Path == "/foundry/shadow-edge-gm.zip" {
		w.Header().Set("Content-Type", "application/zip")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeFile(w, r, filepath.Join(m.srv.webDir, "foundry", "shadow-edge-gm.zip"))
		return
	}
	body, e := os.ReadFile(filepath.Join(m.srv.webDir, "foundry", "module.json"))
	if e != nil {
		writeError(w, 404, "module_not_built", "Сначала соберите web-приложение.")
		return
	}
	var manifest map[string]any
	if json.Unmarshal(body, &manifest) != nil {
		writeError(w, 500, "invalid_manifest", "Манифест недоступен.")
		return
	}
	base := strings.TrimRight(m.srv.shares.configuredBase, "/")
	if base == "" {
		scheme := "http"
		if requestIsSecure(r) {
			scheme = "https"
		}
		base = scheme + "://" + r.Host
	}
	manifest["manifest"] = base + "/foundry/module.json"
	manifest["download"] = base + "/foundry/shadow-edge-gm.zip"
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	if r.Method == http.MethodGet {
		_ = json.NewEncoder(w).Encode(manifest)
	}
}

const foundryConnectHTML = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Foundry — Shadow Edge GM</title><style>body{font:17px system-ui;background:#191520;color:#eee;max-width:700px;margin:50px auto;padding:20px}button,select{padding:12px;margin:8px}a{color:#cbb4ff}</style><h1>Подключить Foundry</h1><p>Разрешение позволяет читать материалы выбранной кампании и сохранять изменения по команде «Экспортировать на сайт».</p><select id="campaign">{{range .Campaigns}}<option value="{{.ID}}">{{.Title}}</option>{{end}}</select><button id="approve">Подключить</button><p id="notice"></p><h2>Подключения</h2><div id="connections"></div><script>const pairing={{.ID}};const notice=document.querySelector('#notice');const request=async(path,options={})=>{const r=await fetch('/api/integrations/foundry/'+path,options);const body=await r.json();if(!r.ok)throw Error(body.error?.message||'Ошибка');return body.data};document.querySelector('#approve').onclick=async()=>{try{await request('pairings/'+encodeURIComponent(pairing)+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaignId:document.querySelector('#campaign').value})});notice.textContent='Подключено. Вернитесь в Foundry и нажмите «Завершить подключение».';await load()}catch(e){notice.textContent=e.message}};async function load(){try{const rows=await request('connections');const root=document.querySelector('#connections');root.replaceChildren();for(const c of rows){const p=document.createElement('p');p.textContent=c.origin+' · '+c.campaignId+' ';const b=document.createElement('button');b.textContent='Отозвать';b.onclick=async()=>{await request('connections/'+encodeURIComponent(c.id),{method:'DELETE'});await load()};p.append(b);root.append(p)}}catch(e){notice.textContent=e.message}}load();</script></html>`
