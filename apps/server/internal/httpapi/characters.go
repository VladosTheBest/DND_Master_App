package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var errCharacterNotFound = errors.New("Ссылка или персонаж не найдены.")
var errCharacterInvalid = errors.New("Неверный персонаж")

type characterDraft struct {
	Name           string                 `json:"name"`
	PlayerName     string                 `json:"playerName"`
	Edition        string                 `json:"edition"`
	ClassID        string                 `json:"classId"`
	SpeciesID      string                 `json:"speciesId"`
	BackgroundID   string                 `json:"backgroundId"`
	TargetLevel    int                    `json:"targetLevel"`
	AbilityMethod  string                 `json:"abilityMethod"`
	Abilities      map[string]int         `json:"abilities"`
	AbilityBonuses map[string]int         `json:"abilityBonuses"`
	SkillIDs       []string               `json:"skillIds"`
	Levels         []characterLevelChoice `json:"levels"`
	Notes          string                 `json:"notes"`
}
type characterLevelChoice struct {
	Level            int                 `json:"level"`
	SubclassID       string              `json:"subclassId,omitempty"`
	ASI              map[string]int      `json:"asi,omitempty"`
	FeatID           string              `json:"featId,omitempty"`
	SpellIDs         []string            `json:"spellIds"`
	CantripIDs       []string            `json:"cantripIds"`
	PreparedSpellIDs []string            `json:"preparedSpellIds,omitempty"`
	FeatureChoices   map[string][]string `json:"featureChoices,omitempty"`
}
type characterInvite struct {
	CampaignID string `json:"campaignId"`
	Token      string `json:"token"`
	Edition    string `json:"edition"`
	Level      int    `json:"level"`
}
type characterInviteInput struct {
	Edition string `json:"edition"`
	Level   int    `json:"level"`
	Rotate  bool   `json:"rotate,omitempty"`
}
type characterInviteResponse struct {
	Token   string `json:"token"`
	URL     string `json:"url"`
	Edition string `json:"edition"`
	Level   int    `json:"level"`
}
type publicCharacterInvite struct {
	CampaignName string `json:"campaignName"`
	Edition      string `json:"edition"`
	Level        int    `json:"level"`
}
type characterSheet struct {
	ID           string         `json:"id"`
	PlayerID     string         `json:"playerId"`
	CampaignName string         `json:"campaignName"`
	Draft        characterDraft `json:"draft"`
	Stats        characterStats `json:"stats"`
	CreatedAt    string         `json:"createdAt"`
	UpdatedAt    string         `json:"updatedAt"`
}
type storedCharacterSheet struct {
	Sheet         characterSheet `json:"sheet"`
	CampaignID    string         `json:"campaignId"`
	EditTokenHash string         `json:"editTokenHash"`
}
type createdCharacterSheet struct {
	characterSheet
	EditToken string `json:"editToken"`
}
type characterManager struct {
	store    *campaignStore
	baseURL  string
	mu       sync.Mutex
	attempts map[string]time.Time
}

func newCharacterManager(store *campaignStore, baseURL string) *characterManager {
	return &characterManager{store: store, baseURL: strings.TrimRight(baseURL, "/"), attempts: map[string]time.Time{}}
}
func characterHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store, max-age=0")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
}
func readCharacterJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("Некорректный JSON или превышен размер 64 КБ: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("Ожидается один JSON-объект")
	}
	return nil
}
func characterHTTPError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errCharacterNotFound):
		writeError(w, 404, "not_found", errCharacterNotFound.Error())
	case errors.Is(err, errCharacterInvalid):
		writeError(w, 400, "invalid_character", err.Error())
	default:
		writeError(w, 500, "character_save_failed", "Не удалось сохранить персонажа. Попробуйте ещё раз.")
	}
}
func characterToken(path, prefix string) string {
	token := strings.TrimPrefix(path, prefix)
	if len(token) != 64 {
		return ""
	}
	if _, err := hex.DecodeString(token); err != nil {
		return ""
	}
	return token
}
func characterTokenHash(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
func newCharacterToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}
func sameCharacterToken(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
func (m *characterManager) inviteResponse(r *http.Request, invite characterInvite) characterInviteResponse {
	base := m.baseURL
	if base == "" {
		base = publicBaseURLFromRequest(r)
	}
	return characterInviteResponse{Token: invite.Token, URL: strings.TrimRight(base, "/") + "/#characters/join/" + invite.Token, Edition: invite.Edition, Level: invite.Level}
}
func (m *characterManager) handleOwnerInvite(w http.ResponseWriter, r *http.Request, ownerID, campaignID string) {
	characterHeaders(w)
	switch r.Method {
	case http.MethodGet:
		invite, err := m.store.getCharacterInvite(ownerID, campaignID)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		if invite == nil {
			writeJSON(w, 200, nil)
			return
		}
		writeJSON(w, 200, m.inviteResponse(r, *invite))
	case http.MethodPost:
		var input characterInviteInput
		if err := readCharacterJSON(w, r, &input); err != nil {
			writeError(w, 400, "bad_request", err.Error())
			return
		}
		invite, err := m.store.setCharacterInvite(ownerID, campaignID, input)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 200, m.inviteResponse(r, invite))
	case http.MethodDelete:
		if err := m.store.revokeCharacterInvite(ownerID, campaignID); err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"deleted": true})
	default:
		writeError(w, 405, "method_not_allowed", "Допустимы GET, POST и DELETE.")
	}
}
func (m *characterManager) handlePublicInvite(w http.ResponseWriter, r *http.Request) {
	characterHeaders(w)
	token := characterToken(r.URL.Path, "/api/character-invites/")
	if token == "" {
		characterHTTPError(w, errCharacterNotFound)
		return
	}
	switch r.Method {
	case http.MethodGet:
		invite, err := m.store.publicCharacterInvitation(token)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 200, invite)
	case http.MethodPost:
		if _, err := m.store.publicCharacterInvitation(token); err != nil {
			characterHTTPError(w, err)
			return
		}
		var draft characterDraft
		if err := readCharacterJSON(w, r, &draft); err != nil {
			writeError(w, 400, "bad_request", err.Error())
			return
		}
		if !m.allowCreation(token + "|" + remoteIP(r)) {
			writeError(w, 429, "rate_limited", "Подождите несколько секунд перед созданием следующего персонажа.")
			return
		}
		sheet, err := m.store.createCharacterSheet(token, draft)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 201, sheet)
	default:
		writeError(w, 405, "method_not_allowed", "Допустимы GET и POST.")
	}
}
func (m *characterManager) allowCreation(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	for k, stamp := range m.attempts {
		if now.Sub(stamp) > time.Minute {
			delete(m.attempts, k)
		}
	}
	if last, ok := m.attempts[key]; ok && now.Sub(last) < 2*time.Second {
		return false
	}
	if len(m.attempts) >= 4096 {
		return false
	}
	m.attempts[key] = now
	return true
}
func (m *characterManager) handlePublicSheet(w http.ResponseWriter, r *http.Request) {
	characterHeaders(w)
	token := characterToken(r.URL.Path, "/api/character-sheets/")
	if token == "" {
		characterHTTPError(w, errCharacterNotFound)
		return
	}
	switch r.Method {
	case http.MethodGet:
		sheet, err := m.store.characterSheetByToken(token)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 200, sheet)
	case http.MethodPut:
		if _, err := m.store.characterSheetByToken(token); err != nil {
			characterHTTPError(w, err)
			return
		}
		var draft characterDraft
		if err := readCharacterJSON(w, r, &draft); err != nil {
			writeError(w, 400, "bad_request", err.Error())
			return
		}
		sheet, err := m.store.updateCharacterSheet(token, draft)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 200, sheet)
	default:
		writeError(w, 405, "method_not_allowed", "Допустимы GET и PUT.")
	}
}
func (m *characterManager) handleOwnerSheets(w http.ResponseWriter, r *http.Request, ownerID, campaignID, sheetID string) {
	characterHeaders(w)
	switch {
	case r.Method == http.MethodGet:
		sheets, err := m.store.listCharacterSheets(ownerID, campaignID)
		if err != nil {
			characterHTTPError(w, err)
			return
		}
		if sheetID == "" {
			writeJSON(w, 200, sheets)
			return
		}
		for _, sheet := range sheets {
			if sheet.ID == sheetID {
				writeJSON(w, 200, sheet)
				return
			}
		}
		characterHTTPError(w, errCharacterNotFound)
	case r.Method == http.MethodDelete && sheetID != "":
		if err := m.store.deleteCharacterSheet(ownerID, campaignID, sheetID); err != nil {
			characterHTTPError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"deleted": true})
	default:
		writeError(w, 405, "method_not_allowed", "Допустим GET; для отдельного листа — DELETE.")
	}
}

// All campaign checks and writes happen under the same store lock. Public
// bearer tokens never grant access to the campaign document or other sheets.
func (s *campaignStore) characterCampaignIndexLocked(campaignID string) int {
	for i, c := range s.data.Campaigns {
		if c.ID == campaignID {
			return i
		}
	}
	return -1
}
func (s *campaignStore) ownedCharacterCampaignLocked(ownerID, campaignID string) int {
	i := s.characterCampaignIndexLocked(campaignID)
	if i < 0 || ownerID == "" || s.data.Campaigns[i].OwnerID != ownerID {
		return -1
	}
	return i
}
func (s *campaignStore) getCharacterInvite(ownerID, campaignID string) (*characterInvite, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.ownedCharacterCampaignLocked(ownerID, campaignID) < 0 {
		return nil, errCharacterNotFound
	}
	for _, invite := range s.data.CharacterInvites {
		if invite.CampaignID == campaignID {
			return &invite, nil
		}
	}
	return nil, nil
}
func (s *campaignStore) setCharacterInvite(ownerID, campaignID string, input characterInviteInput) (characterInvite, error) {
	if input.Edition != "2014" && input.Edition != "2024" && input.Edition != "any" {
		return characterInvite{}, fmt.Errorf("%w: выберите редакцию 2014, 2024 или любую", errCharacterInvalid)
	}
	if input.Level < 1 || input.Level > 20 {
		return characterInvite{}, fmt.Errorf("%w: уровень должен быть от 1 до 20", errCharacterInvalid)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ownedCharacterCampaignLocked(ownerID, campaignID) < 0 {
		return characterInvite{}, errCharacterNotFound
	}
	index := -1
	invite := characterInvite{CampaignID: campaignID, Edition: input.Edition, Level: input.Level}
	for i, v := range s.data.CharacterInvites {
		if v.CampaignID == campaignID {
			index = i
			invite.Token = v.Token
			break
		}
	}
	if invite.Token == "" || input.Rotate {
		token, err := newCharacterToken()
		if err != nil {
			return characterInvite{}, err
		}
		invite.Token = token
	}
	original, err := cloneStorageState(s.data)
	if err != nil {
		return characterInvite{}, err
	}
	if index < 0 {
		s.data.CharacterInvites = append(s.data.CharacterInvites, invite)
	} else {
		s.data.CharacterInvites[index] = invite
	}
	if err := s.saveMutationLocked(original); err != nil {
		return characterInvite{}, err
	}
	return invite, nil
}
func (s *campaignStore) revokeCharacterInvite(ownerID, campaignID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ownedCharacterCampaignLocked(ownerID, campaignID) < 0 {
		return errCharacterNotFound
	}
	original, err := cloneStorageState(s.data)
	if err != nil {
		return err
	}
	for i, invite := range s.data.CharacterInvites {
		if invite.CampaignID == campaignID {
			s.data.CharacterInvites = append(s.data.CharacterInvites[:i], s.data.CharacterInvites[i+1:]...)
			return s.saveMutationLocked(original)
		}
	}
	return nil
}
func (s *campaignStore) characterInviteLocked(token string) (characterInvite, int, error) {
	for _, invite := range s.data.CharacterInvites {
		if sameCharacterToken(invite.Token, token) {
			if index := s.characterCampaignIndexLocked(invite.CampaignID); index >= 0 {
				return invite, index, nil
			}
		}
	}
	return characterInvite{}, -1, errCharacterNotFound
}
func (s *campaignStore) publicCharacterInvitation(token string) (publicCharacterInvite, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	invite, index, err := s.characterInviteLocked(token)
	if err != nil {
		return publicCharacterInvite{}, err
	}
	return publicCharacterInvite{CampaignName: s.data.Campaigns[index].Title, Edition: invite.Edition, Level: invite.Level}, nil
}
func copyCharacterSheet(sheet characterSheet) characterSheet {
	// Slice and map fields must not alias the persisted state after unlocking.
	body, _ := json.Marshal(sheet)
	var clone characterSheet
	_ = json.Unmarshal(body, &clone)
	return clone
}
func (s *campaignStore) createCharacterSheet(token string, draft characterDraft) (createdCharacterSheet, error) {
	stats, err := validateAndDeriveCharacter(draft)
	if err != nil {
		return createdCharacterSheet{}, fmt.Errorf("%w: %v", errCharacterInvalid, err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	invite, index, err := s.characterInviteLocked(token)
	if err != nil {
		return createdCharacterSheet{}, err
	}
	if (invite.Edition != "any" && draft.Edition != invite.Edition) || draft.TargetLevel != invite.Level {
		return createdCharacterSheet{}, fmt.Errorf("%w: редакция и уровень должны соответствовать приглашению мастера", errCharacterInvalid)
	}
	count := 0
	for _, sheet := range s.data.CharacterSheets {
		if sheet.CampaignID == invite.CampaignID {
			count++
		}
	}
	if count >= 256 {
		return createdCharacterSheet{}, fmt.Errorf("%w: в кампании достигнут лимит персонажей", errCharacterInvalid)
	}
	editToken, err := newCharacterToken()
	if err != nil {
		return createdCharacterSheet{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	sheet := characterSheet{ID: newID("sheet"), PlayerID: newID("player"), CampaignName: s.data.Campaigns[index].Title, Draft: draft, Stats: stats, CreatedAt: now, UpdatedAt: now}
	original, err := cloneStorageState(s.data)
	if err != nil {
		return createdCharacterSheet{}, err
	}
	s.data.CharacterSheets = append(s.data.CharacterSheets, storedCharacterSheet{Sheet: copyCharacterSheet(sheet), CampaignID: invite.CampaignID, EditTokenHash: characterTokenHash(editToken)})
	campaign := &s.data.Campaigns[index]
	campaign.Players = append(campaign.Players, characterPlayerEntity(sheet))
	campaign.Revision++
	*campaign = ensureCampaignShape(*campaign)
	if err := s.saveMutationLocked(original); err != nil {
		return createdCharacterSheet{}, err
	}
	return createdCharacterSheet{characterSheet: copyCharacterSheet(sheet), EditToken: editToken}, nil
}
func (s *campaignStore) characterSheetIndexLocked(token string) int {
	hash := characterTokenHash(token)
	for i, sheet := range s.data.CharacterSheets {
		if sameCharacterToken(sheet.EditTokenHash, hash) && s.characterCampaignIndexLocked(sheet.CampaignID) >= 0 {
			return i
		}
	}
	return -1
}
func (s *campaignStore) characterSheetByToken(token string) (characterSheet, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	index := s.characterSheetIndexLocked(token)
	if index < 0 {
		return characterSheet{}, errCharacterNotFound
	}
	sheet := copyCharacterSheet(s.data.CharacterSheets[index].Sheet)
	sheet.CampaignName = s.data.Campaigns[s.characterCampaignIndexLocked(s.data.CharacterSheets[index].CampaignID)].Title
	return sheet, nil
}
func (s *campaignStore) updateCharacterSheet(token string, draft characterDraft) (characterSheet, error) {
	stats, err := validateAndDeriveCharacter(draft)
	if err != nil {
		return characterSheet{}, fmt.Errorf("%w: %v", errCharacterInvalid, err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.characterSheetIndexLocked(token)
	if index < 0 {
		return characterSheet{}, errCharacterNotFound
	}
	previous := s.data.CharacterSheets[index]
	if draft.Edition != previous.Sheet.Draft.Edition || draft.TargetLevel != previous.Sheet.Draft.TargetLevel {
		return characterSheet{}, fmt.Errorf("%w: редакция и уровень сохранённого персонажа не меняются", errCharacterInvalid)
	}
	campaignIndex := s.characterCampaignIndexLocked(previous.CampaignID)
	playerIndex := -1
	for i, player := range s.data.Campaigns[campaignIndex].Players {
		if player.ID == previous.Sheet.PlayerID {
			playerIndex = i
			break
		}
	}
	if playerIndex < 0 {
		return characterSheet{}, errCharacterNotFound
	}
	original, err := cloneStorageState(s.data)
	if err != nil {
		return characterSheet{}, err
	}
	sheet := previous.Sheet
	sheet.Draft = draft
	sheet.Stats = stats
	sheet.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	sheet.CampaignName = s.data.Campaigns[campaignIndex].Title
	s.data.CharacterSheets[index].Sheet = copyCharacterSheet(sheet)
	player := characterPlayerEntity(sheet)
	existing := s.data.Campaigns[campaignIndex].Players[playerIndex]
	// Preserve the GM's annotations, media and relationships while syncing the
	// mechanics and player-authored identity from the saved sheet.
	existing.Title = player.Title
	existing.Subtitle = player.Subtitle
	existing.Summary = player.Summary
	existing.Level = player.Level
	existing.QuickFacts = player.QuickFacts
	existing.StatBlock = player.StatBlock
	if previous.Sheet.Stats.ClassName != sheet.Stats.ClassName {
		tags := []string{}
		for _, tag := range existing.Tags {
			if tag != previous.Sheet.Stats.ClassName {
				tags = append(tags, tag)
			}
		}
		if !characterHas(tags, sheet.Stats.ClassName) {
			tags = append(tags, sheet.Stats.ClassName)
		}
		existing.Tags = tags
	}
	existing.Revision++
	s.data.Campaigns[campaignIndex].Players[playerIndex] = existing
	s.data.Campaigns[campaignIndex].Revision++
	s.data.Campaigns[campaignIndex] = ensureCampaignShape(s.data.Campaigns[campaignIndex])
	if err := s.saveMutationLocked(original); err != nil {
		return characterSheet{}, err
	}
	return copyCharacterSheet(sheet), nil
}
func (s *campaignStore) listCharacterSheets(ownerID, campaignID string) ([]characterSheet, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	campaignIndex := s.ownedCharacterCampaignLocked(ownerID, campaignID)
	if campaignIndex < 0 {
		return nil, errCharacterNotFound
	}
	result := []characterSheet{}
	for _, record := range s.data.CharacterSheets {
		if record.CampaignID == campaignID {
			sheet := copyCharacterSheet(record.Sheet)
			sheet.CampaignName = s.data.Campaigns[campaignIndex].Title
			result = append(result, sheet)
		}
	}
	return result, nil
}
func (s *campaignStore) deleteCharacterSheet(ownerID, campaignID, sheetID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	campaignIndex := s.ownedCharacterCampaignLocked(ownerID, campaignID)
	if campaignIndex < 0 {
		return errCharacterNotFound
	}
	for i, record := range s.data.CharacterSheets {
		if record.CampaignID == campaignID && record.Sheet.ID == sheetID {
			original, err := cloneStorageState(s.data)
			if err != nil {
				return err
			}
			s.data.CharacterSheets = append(s.data.CharacterSheets[:i], s.data.CharacterSheets[i+1:]...)
			campaign := &s.data.Campaigns[campaignIndex]
			for pi, player := range campaign.Players {
				if player.ID == record.Sheet.PlayerID {
					campaign.Players = append(campaign.Players[:pi], campaign.Players[pi+1:]...)
					break
				}
			}
			if campaign.ActiveCombat != nil {
				entries := campaign.ActiveCombat.Entries[:0]
				for _, entry := range campaign.ActiveCombat.Entries {
					if entry.EntityID != record.Sheet.PlayerID {
						entries = append(entries, entry)
					}
				}
				campaign.ActiveCombat.Entries = entries
				if len(entries) == 0 {
					campaign.ActiveCombat = nil
				} else {
					recalculateActiveCombat(campaign.ActiveCombat)
				}
			}
			campaign.Revision++
			*campaign = ensureCampaignShape(*campaign)
			return s.saveMutationLocked(original)
		}
	}
	return errCharacterNotFound
}
