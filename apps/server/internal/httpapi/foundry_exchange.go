package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

type foundryPreviewItem struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Status      string `json:"status"`
	CurrentHash string `json:"currentHash"`
	Message     string `json:"message,omitempty"`
}

func (m *foundryManager) exchange(w http.ResponseWriter, r *http.Request, c foundryConnection, commit bool) {
	var input foundryExport
	if !foundryRead(w, r, &input) {
		return
	}
	if len(input.RequestID) < 16 || len(input.RequestID) > 128 || len(input.Changes) == 0 || len(input.Changes) > 500 {
		writeError(w, 400, "invalid_exchange", "Нужен requestId и от 1 до 500 записей.")
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.srv.store
	s.mu.Lock()
	defer s.mu.Unlock()
	// Recheck revocation under the same lock as the commit.
	active := false
	for _, v := range s.data.FoundryConnections {
		if v.ID == c.ID && v.TokenHash == c.TokenHash {
			active = true
		}
	}
	if !active {
		writeError(w, 401, "connection_revoked", "Подключение отозвано.")
		return
	}
	digest := foundryHash(input.Changes)
	receiptID := foundryHash(c.ID + ":" + input.RequestID)
	for _, v := range s.data.FoundryReceipts {
		if v.ID == receiptID {
			if v.Digest != digest {
				writeError(w, 409, "request_conflict", "Этот requestId уже использован для другого пакета.")
				return
			}
			writeJSON(w, 200, map[string]any{"mappings": v.Mappings, "replayed": true})
			return
		}
	}
	ci := -1
	for i, v := range s.data.Campaigns {
		if v.ID == c.CampaignID && v.OwnerID == c.OwnerID {
			ci = i
		}
	}
	if ci < 0 {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	records, _ := foundryRecords(s.data, c.CampaignID)
	current := map[string]foundryRecord{}
	for _, v := range records {
		current[v.Key] = v
	}
	items := []foundryPreviewItem{}
	normalized := make([]foundryChange, 0, len(input.Changes))
	seen := map[string]bool{}
	blocked := false
	for _, change := range input.Changes {
		item := foundryPreviewItem{Key: change.Key, Status: "new"}
		key := change.Kind + ":" + change.ID
		if change.Key == "" || len(change.Key) > 180 || seen[change.Key] || change.ID != "" && seen[key] {
			writeError(w, 400, "duplicate_record", "Повторная или некорректная запись.")
			return
		}
		seen[change.Key] = true
		if change.ID != "" {
			seen[key] = true
		}
		old, exists := current[key]
		item.CurrentHash = old.Hash
		if change.ID == "" {
			generated := "fvtt-" + foundryHash(c.ID + ":" + change.Key)[:24]
			for _, record := range records {
				if record.ID == generated {
					item.Status = "blocked"
					item.Message = "Эта новая запись уже экспортирована. Обновите с сайта перед повторной отправкой."
					blocked = true
				}
			}
		}
		if change.ID != "" {
			if !exists {
				item.Status = "blocked"
				item.Message = "Исходная запись удалена или не принадлежит кампании."
				blocked = true
			} else if change.BaseHash != old.Hash {
				item.Status = "conflict"
				item.Message = "Запись на сайте изменилась. Выберите версию и повторите предпросмотр."
				blocked = true
			} else {
				item.Status = "update"
			}
		}
		if s.data.Campaigns[ci].ReadyCampaign != nil && change.Kind != "player" && change.Kind != "character" && change.Kind != "session-map" {
			item.Status = "blocked"
			item.Message = "Сюжет готовой кампании неизменяем. Экспортируйте в обычную кампанию."
			blocked = true
		}
		data, title, e := normalizeFoundryChange(change, old, c)
		if e != nil {
			item.Status = "blocked"
			item.Message = e.Error()
			blocked = true
		} else {
			change.Data = data
			item.Title = title
			if exists && item.Status == "update" && foundrySameAuthoring(old.Data, data) {
				item.Status = "unchanged"
			}
		}
		normalized = append(normalized, change)
		items = append(items, item)
	}
	previewKey := c.ID + ":" + input.RequestID
	if !commit {
		for key, v := range m.previews {
			if time.Now().After(v.Expires) {
				delete(m.previews, key)
			}
		}
		if !blocked && len(m.previews) < 512 {
			m.previews[previewKey] = foundryPreview{Digest: digest, Expires: time.Now().Add(5 * time.Minute)}
		}
		writeJSON(w, 200, map[string]any{"items": items, "canCommit": !blocked})
		return
	}
	p, ok := m.previews[previewKey]
	if !ok || p.Digest != digest || time.Now().After(p.Expires) {
		writeError(w, 409, "preview_required", "Сначала подтвердите актуальный предпросмотр пакета.")
		return
	}
	if blocked {
		writeJSON(w, 409, map[string]any{"items": items, "canCommit": false})
		return
	}
	original, e := cloneStorageState(s.data)
	if e != nil {
		writeError(w, 500, "save_failed", "Ошибка сохранения.")
		return
	}
	mappings := map[string]string{}
	for i, v := range normalized {
		id := v.ID
		if id == "" {
			id = "fvtt-" + foundryHash(c.ID + ":" + v.Key)[:24]
		}
		mappings[v.Key] = id
		if items[i].Status == "unchanged" {
			continue
		}
		if e := applyFoundryChange(&s.data, ci, v, id); e != nil {
			s.data = original
			writeError(w, 400, "invalid_exchange", e.Error())
			return
		}
	}
	s.data.Campaigns[ci].Revision++
	s.data.FoundryReceipts = append(s.data.FoundryReceipts, foundryReceipt{ID: receiptID, ConnectionID: c.ID, OwnerID: c.OwnerID, CampaignID: c.CampaignID, Digest: digest, Mappings: mappings})
	if e = s.saveMutationLocked(original); e != nil {
		writeError(w, 500, "save_failed", "Пакет не сохранён.")
		return
	}
	delete(m.previews, previewKey)
	writeJSON(w, 200, map[string]any{"mappings": mappings, "replayed": false})
}
func foundrySameAuthoring(a, b json.RawMessage) bool {
	var x, y map[string]any
	_ = json.Unmarshal(a, &x)
	_ = json.Unmarshal(b, &y)
	for _, key := range []string{"revision", "id", "createdAt", "updatedAt"} {
		delete(x, key)
		delete(y, key)
	}
	return foundryHash(x) == foundryHash(y)
}
func normalizeFoundryChange(v foundryChange, old foundryRecord, c foundryConnection) (json.RawMessage, string, error) {
	marshal := func(x any, title string) (json.RawMessage, string, error) {
		if strings.TrimSpace(title) == "" || len([]rune(title)) > 200 {
			return nil, "", fmt.Errorf("Название должно содержать 1–200 символов.")
		}
		b, e := json.Marshal(x)
		return b, title, e
	}
	switch v.Kind {
	case "location", "player", "npc", "monster", "quest", "lore":
		var e knowledgeEntity
		if json.Unmarshal(v.Data, &e) != nil {
			return nil, "", fmt.Errorf("Некорректная сущность.")
		}
		e.ID = v.ID
		e.Kind = v.Kind
		e.Revision = 1
		if e.StatBlock != nil {
			for _, section := range [][]statBlockEntry{e.StatBlock.Actions, e.StatBlock.BonusActions, e.StatBlock.Reactions, e.StatBlock.Traits} {
				for _, entry := range section {
					if err := validateFoundryMechanics(entry.Foundry); err != nil {
						return nil, "", err
					}
				}
			}
		}
		var previous knowledgeEntity
		_ = json.Unmarshal(old.Data, &previous)
		e.FoundryAI = previous.FoundryAI
		if err := validateProposalEntityMedia(e, &previous, c.OwnerID, c.CampaignID); err != nil {
			return nil, "", err
		}
		if e.FoundryCharacter != nil {
			if err := validateFoundryActor(*e.FoundryCharacter); err != nil {
				return nil, "", err
			}
		}
		return marshal(e, e.Title)
	case "character":
		// Native wizard choices remain authoritative. Foundry changes become a
		// separately labelled external sheet on the linked player entity.
		var a foundryActor
		if json.Unmarshal(v.Data, &a) != nil {
			return nil, "", fmt.Errorf("Некорректный импортированный лист.")
		}
		if e := validateFoundryActor(a); e != nil {
			return nil, "", e
		}
		return marshal(a, a.Name)
	case "event":
		var e worldEvent
		if json.Unmarshal(v.Data, &e) != nil {
			return nil, "", fmt.Errorf("Некорректное событие.")
		}
		e.ID = v.ID
		e.Revision = 1
		return marshal(e, e.Title)
	case "prep":
		var e sessionPrepItem
		if json.Unmarshal(v.Data, &e) != nil {
			return nil, "", fmt.Errorf("Некорректная заметка.")
		}
		e.ID = v.ID
		return marshal(e, e.Title)
	case "shop":
		var e campaignShop
		if json.Unmarshal(v.Data, &e) != nil {
			return nil, "", fmt.Errorf("Некорректный магазин.")
		}
		e.ID = v.ID
		var previous campaignShop
		_ = json.Unmarshal(old.Data, &previous)
		candidate := knowledgeEntity{Art: e.Art, Gallery: e.Gallery}
		before := knowledgeEntity{Art: previous.Art, Gallery: previous.Gallery}
		if err := validateProposalEntityMedia(candidate, &before, c.OwnerID, c.CampaignID); err != nil {
			return nil, "", err
		}
		return marshal(e, e.Name)
	case "world-map":
		var e worldMapDocument
		if json.Unmarshal(v.Data, &e) != nil {
			return nil, "", fmt.Errorf("Некорректная карта.")
		}
		var prev worldMapDocument
		_ = json.Unmarshal(old.Data, &prev)
		if e.ImageURL != prev.ImageURL && !foundryOwnedURL(e.ImageURL, c) {
			return nil, "", fmt.Errorf("Сначала загрузите фон карты в эту кампанию.")
		}
		if err := validateMapLabels(e.Labels); err != nil {
			return nil, "", err
		}
		e.ID = v.ID
		e.Revision = prev.Revision
		e.Prompt = prev.Prompt
		e.Provider = prev.Provider
		e.ReferenceURL = prev.ReferenceURL
		return marshal(e, e.Title)
	case "session-map":
		var e sessionMapDocument
		if json.Unmarshal(v.Data, &e) != nil {
			return nil, "", fmt.Errorf("Некорректная сцена.")
		}
		if err := validateSessionMap(e, c); err != nil {
			return nil, "", err
		}
		e.ID = v.ID
		return marshal(e, e.Title)
	}
	return nil, "", fmt.Errorf("Тип %q пока не поддерживается.", v.Kind)
}
func validateFoundryActor(a foundryActor) error {
	if a.Edition != "2014" && a.Edition != "2024" {
		return fmt.Errorf("Укажите редакцию 2014 или 2024.")
	}
	if a.MaxHP < 0 || a.MaxHP > 100000 || a.ArmorClass < 0 || a.ArmorClass > 100 || a.Speed < 0 || a.Speed > 10000 || len(a.Items) > 500 {
		return fmt.Errorf("Параметры импортированного листа вне допустимых границ.")
	}
	for _, k := range []string{"str", "dex", "con", "int", "wis", "cha"} {
		if a.Abilities[k] < 1 || a.Abilities[k] > 30 {
			return fmt.Errorf("Нужны шесть характеристик в диапазоне 1–30.")
		}
	}
	for _, v := range a.Items {
		if err := validateFoundryMechanics(v.Mechanics); err != nil {
			return err
		}
		if len(v.Description) > 60000 || len(v.Name) > 200 || len(v.Damage) > 80 {
			return fmt.Errorf("Слишком большая способность.")
		}
		if v.Type != "spell" && v.Type != "weapon" && v.Type != "feat" {
			return fmt.Errorf("Неизвестный тип способности.")
		}
	}
	return nil
}
func validateFoundryMechanics(m *foundryMechanics) error {
	if m == nil {
		return nil
	}
	if m.Kind != "attack" && m.Kind != "save" && m.Kind != "heal" && m.Kind != "damage" && m.Kind != "manual" {
		return fmt.Errorf("Неизвестный тип расчёта способности.")
	}
	if m.Activation != "" && m.Activation != "action" && m.Activation != "bonus" && m.Activation != "reaction" || m.AttackMode != "" && m.AttackMode != "melee" && m.AttackMode != "ranged" || m.Range < 0 || m.Range > 10000 || m.SaveDC < 0 || m.SaveDC > 100 {
		return fmt.Errorf("Некорректные параметры способности.")
	}
	if m.SaveAbility != "" && m.SaveAbility != "str" && m.SaveAbility != "dex" && m.SaveAbility != "con" && m.SaveAbility != "int" && m.SaveAbility != "wis" && m.SaveAbility != "cha" || m.SaveDamage != "" && m.SaveDamage != "half" && m.SaveDamage != "none" {
		return fmt.Errorf("Некорректный спасбросок.")
	}
	if m.DamageType != "" && !strings.Contains("|acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder|healing|", "|"+m.DamageType+"|") {
		return fmt.Errorf("Неизвестный тип урона.")
	}
	return nil
}
func applyFoundryChange(state *storageState, ci int, v foundryChange, id string) error {
	c := &state.Campaigns[ci]
	switch v.Kind {
	case "location", "player", "npc", "monster", "quest", "lore":
		var e knowledgeEntity
		_ = json.Unmarshal(v.Data, &e)
		e.ID = id
		bucket, index, old := findEntityInCampaign(c, id)
		if bucket != nil {
			e.Revision = old.Revision + 1
			(*bucket)[index] = e
			return nil
		}
		switch v.Kind {
		case "location":
			c.Locations = append(c.Locations, e)
		case "player":
			c.Players = append(c.Players, e)
		case "npc":
			c.NPCs = append(c.NPCs, e)
		case "monster":
			c.Monsters = append(c.Monsters, e)
		case "quest":
			c.Quests = append(c.Quests, e)
		case "lore":
			c.Lore = append(c.Lore, e)
		}
	case "character":
		var a foundryActor
		_ = json.Unmarshal(v.Data, &a)
		playerID := id
		for _, s := range state.CharacterSheets {
			if s.CampaignID == c.ID && s.Sheet.ID == v.ID {
				playerID = s.Sheet.PlayerID
			}
		}
		bucket, index, e := findEntityInCampaign(c, playerID)
		if bucket != nil {
			if e.Kind != "player" {
				return fmt.Errorf("Лист должен принадлежать игроку.")
			}
			e.FoundryCharacter = &a
			e.Title = a.Name
			e.Revision++
			(*bucket)[index] = e
		} else {
			c.Players = append(c.Players, knowledgeEntity{ID: playerID, Kind: "player", Title: a.Name, Revision: 1, FoundryCharacter: &a, Summary: "Импортированный лист Foundry; выборы конструктора не восстановлены."})
		}
	case "event":
		var e worldEvent
		_ = json.Unmarshal(v.Data, &e)
		e.ID = id
		for i, o := range c.Events {
			if o.ID == id {
				e.Revision = o.Revision + 1
				c.Events[i] = e
				return nil
			}
		}
		c.Events = append(c.Events, e)
	case "prep":
		var e sessionPrepItem
		_ = json.Unmarshal(v.Data, &e)
		e.ID = id
		for i, o := range c.SessionPrep {
			if o.ID == id {
				c.SessionPrep[i] = e
				return nil
			}
		}
		c.SessionPrep = append(c.SessionPrep, e)
	case "shop":
		var e campaignShop
		_ = json.Unmarshal(v.Data, &e)
		e.ID = id
		for i, o := range c.Shops {
			if o.ID == id {
				c.Shops[i] = e
				return nil
			}
		}
		c.Shops = append(c.Shops, e)
	case "world-map":
		var e worldMapDocument
		_ = json.Unmarshal(v.Data, &e)
		e.ID = id
		for i, o := range c.WorldMaps {
			if o.ID == id {
				e.Revision = o.Revision + 1
				e.Prompt, e.ReferenceURL, e.Provider = o.Prompt, o.ReferenceURL, o.Provider
				c.WorldMaps[i] = e
				return nil
			}
		}
		c.WorldMaps = append(c.WorldMaps, e)
	case "session-map":
		var e sessionMapDocument
		_ = json.Unmarshal(v.Data, &e)
		e.ID = id
		for i, o := range c.SessionMaps {
			if o.ID == id {
				e.Revision = o.Revision + 1
				c.SessionMaps[i] = e
				return nil
			}
		}
		e.Revision = 1
		c.SessionMaps = append(c.SessionMaps, e)
	}
	return nil
}
func foundryOwnedURL(raw string, c foundryConnection) bool {
	u, e := url.Parse(raw)
	if e != nil || u.Host != "" || u.Scheme != "" || u.RawQuery != "" || u.Fragment != "" || strings.ContainsAny(u.Path, "\\\x00") {
		return false
	}
	prefix := "/uploads/" + sanitizeUploadPathSegment(c.OwnerID) + "/" + sanitizeUploadPathSegment(c.CampaignID) + "/"
	name := strings.TrimPrefix(u.Path, prefix)
	return strings.HasPrefix(u.Path, prefix) && path.Clean(u.Path) == u.Path && fs.ValidPath(name)
}

// Older generated art predates owner namespaces. Permit only an actual media
// reference in this owner's campaign, never a guessed filename or text mention.
func (m *foundryManager) legacyAsset(raw, host string, c foundryConnection) bool {
	u, err := url.Parse(raw)
	prefix := "/uploads/" + sanitizeUploadPathSegment(c.CampaignID) + "/"
	if err != nil || u.Host != "" || u.Scheme != "" || u.RawQuery != "" || u.Fragment != "" || strings.ContainsAny(u.Path, "\\\x00") || !strings.HasPrefix(u.Path, prefix) || path.Clean(u.Path) != u.Path || !fs.ValidPath(strings.TrimPrefix(u.Path, prefix)) {
		return false
	}
	match := func(candidate string) bool {
		ref, err := url.Parse(candidate)
		return err == nil && (ref.Host == "" || strings.EqualFold(ref.Host, host)) && ref.Path == u.Path && ref.RawQuery == "" && ref.Fragment == ""
	}
	media := func(art *heroArt, gallery []galleryImage) bool {
		if art != nil && match(art.URL) {
			return true
		}
		for _, image := range gallery {
			if match(image.URL) {
				return true
			}
		}
		return false
	}
	m.srv.store.mu.RLock()
	defer m.srv.store.mu.RUnlock()
	for _, campaign := range m.srv.store.data.Campaigns {
		if campaign.ID != c.CampaignID || campaign.OwnerID != c.OwnerID {
			continue
		}
		for _, entity := range campaignEntities(campaign) {
			if media(entity.Art, entity.Gallery) {
				return true
			}
		}
		for _, shop := range campaign.Shops {
			if media(shop.Art, shop.Gallery) {
				return true
			}
		}
		for _, world := range campaign.WorldMaps {
			if match(world.ImageURL) {
				return true
			}
		}
		for _, scene := range campaign.SessionMaps {
			for _, level := range scene.Levels {
				if match(level.ImageURL) {
					return true
				}
			}
		}
	}
	return false
}
func (m *foundryManager) asset(w http.ResponseWriter, r *http.Request, c foundryConnection) {
	raw := r.URL.Query().Get("url")
	prefix := "/api/campaign-templates/icewind-dale-rus/assets/"
	if strings.HasPrefix(raw, prefix) {
		allowed := false
		m.srv.store.mu.RLock()
		for _, campaign := range m.srv.store.data.Campaigns {
			if campaign.ID == c.CampaignID && campaign.OwnerID == c.OwnerID && campaign.ReadyCampaign != nil && campaign.ReadyCampaign.TemplateID == "icewind-dale-rus" {
				allowed = true
			}
		}
		m.srv.store.mu.RUnlock()
		name := strings.TrimPrefix(raw, prefix)
		if allowed && fs.ValidPath(name) && strings.HasSuffix(name, ".webp") && (strings.HasPrefix(name, "maps/") || strings.HasPrefix(name, "pages/")) {
			if body, err := readyCampaignFiles.ReadFile("ready_campaigns/icewind-dale-rus/" + name); err == nil {
				w.Header().Set("Content-Type", "image/webp")
				w.Header().Set("X-Content-Type-Options", "nosniff")
				http.ServeContent(w, r, name, readyAssetModTime, bytes.NewReader(body))
				return
			}
		}
		writeError(w, 404, "asset_not_found", "Медиа этой кампании не найдено.")
		return
	}
	if m.srv.uploads == nil || !foundryOwnedURL(raw, c) && !m.legacyAsset(raw, r.Host, c) {
		writeError(w, 404, "asset_not_found", "Медиа этой кампании не найдено.")
		return
	}
	copy := r.Clone(r.Context())
	u := *r.URL
	u.Path = raw
	u.RawQuery = ""
	copy.URL = &u
	m.srv.uploads.ServeHTTP(w, copy)
}
