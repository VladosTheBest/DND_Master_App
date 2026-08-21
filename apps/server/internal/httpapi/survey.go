package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html/template"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// surveyManager uses opaque invitation tokens; responses stay scoped to campaigns.
type surveyManager struct {
	store    *campaignStore
	baseURL  string
	mu       sync.Mutex
	attempts map[string]time.Time
}
type surveyLinkResponse struct {
	URL   string `json:"url"`
	Token string `json:"token"`
}
type surveyInput struct {
	Name           string `json:"name"`
	Setting        string `json:"setting"`
	Inspirations   string `json:"inspirations"`
	Character      string `json:"character"`
	CharacterName  string `json:"characterName"`
	CharacterClass string `json:"characterClass"`
	Ancestry       string `json:"ancestry"`
	PartyRole      string `json:"partyRole"`
	Backstory      string `json:"backstory"`
	Tone           string `json:"tone"`
	Atmosphere     string `json:"atmosphere"`
	Expectations   string `json:"expectations"`
	Boundaries     string `json:"boundaries"`
	Website        string `json:"website"`
}

func newSurveyManager(store *campaignStore, baseURL string) *surveyManager {
	return &surveyManager{store: store, baseURL: strings.TrimRight(baseURL, "/"), attempts: map[string]time.Time{}}
}

func (m *surveyManager) handleCreateLink(w http.ResponseWriter, r *http.Request, campaignID string) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	token, err := m.store.ensureSurveyInvite(campaignID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "survey_link_failed", err.Error())
		return
	}
	base := m.baseURL
	if base == "" {
		base = publicBaseURLFromRequest(r)
	}
	writeJSON(w, http.StatusOK, surveyLinkResponse{URL: strings.TrimRight(base, "/") + "/survey/" + url.PathEscape(token), Token: token})
}

func (m *surveyManager) handlePublicPage(w http.ResponseWriter, r *http.Request) {
	token := surveyToken(r.URL.Path, "/survey/")
	if token == "" || !m.store.surveyInviteExists(token) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = surveyTemplateV2.Execute(w, surveyPageData(token))
}
func (m *surveyManager) handlePublicAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}
	token := surveyToken(r.URL.Path, "/api/survey/")
	if token == "" {
		writeError(w, 404, "not_found", "Survey not found")
		return
	}
	if !m.allow(remoteIP(r)) {
		writeError(w, 429, "rate_limited", "Попробуйте снова через несколько минут.")
		return
	}
	var input surveyInput
	if err := readJSON(r, &input); err != nil {
		writeError(w, 400, "bad_request", err.Error())
		return
	}
	if strings.TrimSpace(input.Website) != "" {
		writeJSON(w, 200, map[string]bool{"accepted": true})
		return
	}
	if err := validateSurvey(input); err != nil {
		writeError(w, 400, "invalid_survey", err.Error())
		return
	}
	campaign, ok := m.store.campaignForSurveyToken(token)
	if !ok {
		writeError(w, 404, "not_found", "Survey not found")
		return
	}
	if err := m.store.saveSurveyResponse(token, campaign.ID, input); err != nil {
		writeError(w, 500, "survey_save_failed", "Не удалось сохранить анкету.")
		return
	}
	writeJSON(w, 201, map[string]bool{"accepted": true})
}
func (m *surveyManager) handleResponses(w http.ResponseWriter, r *http.Request, campaignID string) {
	if r.Method != http.MethodGet {
		writeError(w, 405, "method_not_allowed", "Only GET is supported")
		return
	}
	writeJSON(w, 200, m.store.listSurveyResponses(campaignID))
}
func (m *surveyManager) allow(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	if last := m.attempts[key]; !last.IsZero() && now.Sub(last) < 10*time.Minute {
		return false
	}
	m.attempts[key] = now
	return true
}
func surveyToken(path, prefix string) string {
	t := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if t == "" || strings.Contains(t, "/") {
		return ""
	}
	return t
}
func remoteIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
func validateSurvey(i surveyInput) error {
	for _, v := range []string{i.Name, i.Setting, i.Inspirations, i.Character, i.CharacterName, i.CharacterClass, i.Ancestry, i.PartyRole, i.Backstory, i.Tone, i.Atmosphere, i.Expectations, i.Boundaries} {
		if len([]rune(strings.TrimSpace(v))) > 2000 {
			return fmt.Errorf("поле анкеты слишком длинное")
		}
	}
	if strings.TrimSpace(i.Name) == "" {
		return fmt.Errorf("укажите, как к вам обращаться")
	}
	return nil
}

func (s *campaignStore) ensureSurveyInvite(campaignID string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	found := false
	for _, c := range s.data.Campaigns {
		if c.ID == campaignID {
			found = true
		}
	}
	if !found {
		return "", fmt.Errorf("campaign %q not found", campaignID)
	}
	for _, i := range s.data.SurveyInvites {
		if i.CampaignID == campaignID {
			return i.Token, nil
		}
	}
	token, err := newSurveyToken()
	if err != nil {
		return "", err
	}
	s.data.SurveyInvites = append(s.data.SurveyInvites, surveyInvite{Token: token, CampaignID: campaignID, CreatedAt: time.Now().UTC().Format(time.RFC3339)})
	return token, s.saveLocked()
}
func (s *campaignStore) surveyInviteExists(token string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, i := range s.data.SurveyInvites {
		if i.Token == token {
			return true
		}
	}
	return false
}
func (s *campaignStore) campaignForSurveyToken(token string) (campaignData, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, i := range s.data.SurveyInvites {
		if i.Token == token {
			for _, c := range s.data.Campaigns {
				if c.ID == i.CampaignID {
					return c, true
				}
			}
		}
	}
	return campaignData{}, false
}
func (s *campaignStore) saveSurveyResponse(token, campaignID string, input surveyInput) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for n := range s.data.SurveyInvites {
		if s.data.SurveyInvites[n].Token == token {
			s.data.SurveyInvites[n].LastSubmissionAt = time.Now().UTC().Format(time.RFC3339)
			s.data.SurveyResponses = append(s.data.SurveyResponses, surveyResponse{ID: newID("survey"), CampaignID: campaignID, SubmittedAt: s.data.SurveyInvites[n].LastSubmissionAt, Name: strings.TrimSpace(input.Name), Setting: strings.TrimSpace(input.Setting), Inspirations: strings.TrimSpace(input.Inspirations), Character: strings.TrimSpace(input.Character), CharacterName: strings.TrimSpace(input.CharacterName), CharacterClass: strings.TrimSpace(input.CharacterClass), Ancestry: strings.TrimSpace(input.Ancestry), PartyRole: strings.TrimSpace(input.PartyRole), Backstory: strings.TrimSpace(input.Backstory), Tone: strings.TrimSpace(input.Tone), Atmosphere: strings.TrimSpace(input.Atmosphere), Expectations: strings.TrimSpace(input.Expectations), Boundaries: strings.TrimSpace(input.Boundaries)})
			return s.saveLocked()
		}
	}
	return fmt.Errorf("survey invite not found")
}
func (s *campaignStore) listSurveyResponses(campaignID string) []surveyResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []surveyResponse{}
	for _, response := range s.data.SurveyResponses {
		if response.CampaignID == campaignID {
			out = append(out, response)
		}
	}
	return out
}
func newSurveyToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

var surveyTemplate = template.Must(template.New("survey").Parse(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Анкета игрока</title><style>:root{color-scheme:dark;font-family:Inter,system-ui;background:#090b13;color:#f4eadb}body{margin:0;background:radial-gradient(circle at 15% 10%,#54382788,transparent 30%),radial-gradient(circle at 85% 85%,#30206399,transparent 35%),#090b13;min-height:100vh}.card{width:min(92vw,720px);margin:5rem auto;padding:2.5rem;background:#121522dd;border:1px solid #c69c5b55;border-radius:24px;box-shadow:0 30px 90px #0008;animation:rise .7s ease both}h1{font-family:Georgia,serif;font-size:clamp(2rem,7vw,3.5rem);margin:.2rem 0}p{color:#cfc5b6;line-height:1.6}.hint{font-size:.86rem}label{display:block;margin:1.2rem 0 .4rem;font-weight:650}input,textarea,select,button{font:inherit}input,textarea,select{width:100%;box-sizing:border-box;padding:.8rem;border-radius:10px;border:1px solid #ffffff26;background:#090b13;color:inherit}textarea{min-height:100px}button{margin-top:1.5rem;padding:.85rem 1.15rem;border:0;border-radius:10px;background:#d3a65f;color:#19120a;font-weight:800;cursor:pointer}.music{float:right;margin:0;background:#ffffff12;color:#f4eadb}.trap{position:absolute;left:-9999px}@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body><main class="card"><button class="music" id="music" type="button">♪ Включить атмосферу</button><h1>Перед первым костром</h1><p>Эта анкета поможет мастеру собрать кампанию, в которую хочется возвращаться. Ответы увидит только мастер.</p><p class="hint">Черновик сохраняется только в этом браузере до отправки.</p><form id="f"><div class="trap"><label>Website <input name="website" autocomplete="off"></label></div><label>Как к вам обращаться?<input name="name" required maxlength="120"></label><label>Желаемый мир / сеттинг<textarea name="setting" maxlength="2000"></textarea></label><label>Игры, книги, фильмы и другие вдохновения<textarea name="inspirations" maxlength="2000"></textarea></label><label>Персонаж или роль, которую хочется попробовать<textarea name="character" maxlength="2000"></textarea></label><label>Тон кампании<select name="tone"><option>Героическое приключение</option><option>Мрачное фэнтези</option><option>Лёгкое и смешное</option><option>Политические интриги</option><option>Другое / смешанный</option></select></label><label>Что особенно хочется увидеть?<textarea name="expectations" maxlength="2000"></textarea></label><label>Темы и границы, которых стоит избегать<textarea name="boundaries" maxlength="2000"></textarea></label><button>Отправить мастеру</button><p id="status" aria-live="polite"></p></form></main><script>const t={{printf "%q" .Token}},k='shadow-edge:survey-draft:'+t,f=document.querySelector('#f'),s=document.querySelector('#status');try{let d=JSON.parse(localStorage.getItem(k)||'{}');for(let n in d){let e=f.elements.namedItem(n);if(e)e.value=d[n]}}catch{}f.oninput=()=>{try{localStorage.setItem(k,JSON.stringify(Object.fromEntries(new FormData(f))))}catch{}};document.querySelector('#music').onclick=()=>{let x=new AudioContext(),o=x.createOscillator(),g=x.createGain();o.frequency.value=110;g.gain.value=.02;o.connect(g).connect(x.destination);o.start();s.textContent='Атмосфера включена.'};f.onsubmit=async e=>{e.preventDefault();let b=f.querySelector('button[type=submit]');b.disabled=true;let d=Object.fromEntries(new FormData(f));try{let r=await fetch('/api/survey/'+encodeURIComponent(t),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}),j=await r.json();if(!r.ok)throw Error(j.error?.message);localStorage.removeItem(k);f.innerHTML='<h2>Спасибо. Мастер получил вашу весть.</h2>'}catch(x){s.textContent=x.message||'Не удалось отправить.';b.disabled=false}};</script></body></html>`))

const masterSurveyHTML = `<!doctype html><meta charset="utf-8"><title>Анкеты игроков</title><style>body{font:16px system-ui;margin:3rem auto;max-width:900px;background:#11131d;color:#eee}button,select{padding:.7rem;margin:.4rem}.card{padding:1rem;margin:1rem 0;background:#1c2030;border-radius:12px}pre{white-space:pre-wrap}</style><h1>Анкеты игроков</h1><p>Ссылка и ответы доступны только в защищённом кабинете.</p><select id="campaign"></select><button id="link">Создать / скопировать ссылку</button><div id="linkout"></div><section id="answers"></section><script>const c=document.querySelector('#campaign'),a=document.querySelector('#answers'),e=s=>String(s||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));async function j(u,o){let r=await fetch(u,o),x=await r.json();if(!r.ok)throw Error(x.error?.message);return x.data}async function answers(){let xs=await j('/api/campaigns/'+c.value+'/survey-responses');a.innerHTML='<h2>Ответы ('+xs.length+')</h2>'+xs.map(x=>'<article class="card"><b>'+e(x.name)+'</b><pre>Сеттинг: '+e(x.setting)+'\\nВдохновения: '+e(x.inspirations)+'\\nРоль: '+e(x.character)+'\\nТон: '+e(x.tone)+'\\nОжидания: '+e(x.expectations)+'\\nГраницы: '+e(x.boundaries)+'</pre></article>').join('')}async function load(){let cs=await j('/api/campaigns');c.innerHTML=cs.map(x=>'<option value="'+e(x.id)+'">'+e(x.title)+'</option>').join('');answers()}c.onchange=answers;document.querySelector('#link').onclick=async()=>{let x=await j('/api/campaigns/'+c.value+'/survey-link',{method:'POST'});await navigator.clipboard.writeText(x.url);document.querySelector('#linkout').textContent='Ссылка скопирована: '+x.url};load().catch(e=>a.textContent=e.message)</script>`
