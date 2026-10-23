package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
)

// Campaign-owned authoring data. Stored in the campaign JSON/JSONB payload;
// it is deliberately outside the immutable prepared-adventure material.
type customCampaignItem struct {
	ID                  string   `json:"id"`
	Revision            int      `json:"revision"`
	Source              string   `json:"source"`
	Name                string   `json:"name"`
	Category            string   `json:"category"`
	Description         string   `json:"description"`
	Subcategory         string   `json:"subcategory,omitempty"`
	ArmorType           string   `json:"armorType,omitempty"`
	Rarity              string   `json:"rarity,omitempty"`
	BuyPriceGP          *float64 `json:"buyPriceGp,omitempty"`
	SellPriceGP         *float64 `json:"sellPriceGp,omitempty"`
	WeightLB            *float64 `json:"weightLb,omitempty"`
	Properties          []string `json:"properties,omitempty"`
	Damage              string   `json:"damage,omitempty"`
	DamageType          string   `json:"damageType,omitempty"`
	ArmorClass          *int     `json:"armorClass,omitempty"`
	StrengthRequirement *int     `json:"strengthRequirement,omitempty"`
	StealthDisadvantage *bool    `json:"stealthDisadvantage,omitempty"`
	Reference           string   `json:"reference,omitempty"`
}
type customItemsDocument struct {
	Revision int                  `json:"revision"`
	Items    []customCampaignItem `json:"items"`
	Campaign *campaignData        `json:"campaign,omitempty"`
}
type customItemReferenceChange struct {
	ShopID  string `json:"shopId"`
	EntryID string `json:"entryId"`
	FromID  string `json:"fromId"`
	ToID    string `json:"toId"`
	Name    string `json:"name"`
}
type customItemReferenceChoice struct {
	ShopID  string               `json:"shopId"`
	EntryID string               `json:"entryId"`
	FromID  string               `json:"fromId"`
	Name    string               `json:"name"`
	Options []customCampaignItem `json:"options"`
}
type customItemsImport struct {
	Revision         int                         `json:"revision"`
	Digest           string                      `json:"digest"`
	Additions        []customCampaignItem        `json:"additions"`
	Skipped          int                         `json:"skipped"`
	Renamed          map[string]string           `json:"renamed"`
	AlreadyImported  bool                        `json:"alreadyImported"`
	CampaignRevision int                         `json:"campaignRevision"`
	ReferenceChanges []customItemReferenceChange `json:"referenceChanges"`
	Warnings         []string                    `json:"warnings"`
	ReferenceChoices []customItemReferenceChoice `json:"referenceChoices"`
}

var customItemID = regexp.MustCompile(`^[a-zA-Z0-9_.:-]{1,128}$`)

func normalizeCampaignItem(item customCampaignItem) (customCampaignItem, error) {
	item.Name = strings.TrimSpace(item.Name)
	if !customItemID.MatchString(item.ID) || item.ID == "import" || item.Name == "" || len([]rune(item.Name)) > 200 || len([]rune(item.Description)) > 20000 {
		return item, fmt.Errorf("У предмета некорректные ID, название или описание (до 200/20000 символов).")
	}
	if item.Source != "" && item.Source != "custom" {
		return item, fmt.Errorf("Разрешены только пользовательские предметы.")
	}
	switch item.Category {
	case "armor", "weapon", "potion", "poison", "staff", "ring", "scroll", "wand", "tool", "gear", "focus", "clothing", "other":
	default:
		return item, fmt.Errorf("Некорректная категория предмета.")
	}

	if item.ArmorType != "" && item.ArmorType != "light" && item.ArmorType != "medium" && item.ArmorType != "heavy" && item.ArmorType != "shield" {
		return item, fmt.Errorf("Некорректный тип доспеха.")
	}
	for _, v := range []*float64{item.BuyPriceGP, item.SellPriceGP, item.WeightLB} {
		if v != nil && (*v < 0 || *v > 1e12) {
			return item, fmt.Errorf("Цена и вес должны быть от 0 до 10¹².")
		}
	}
	for _, v := range []*int{item.ArmorClass, item.StrengthRequirement} {
		if v != nil && (*v < 0 || *v > 1000) {
			return item, fmt.Errorf("Некорректные числовые характеристики.")
		}
	}
	if len(item.Properties) > 100 {
		return item, fmt.Errorf("Не более 100 свойств предмета.")
	}
	texts := append([]string{item.Subcategory, item.Rarity, item.Damage, item.DamageType, item.Reference}, item.Properties...)
	for _, v := range texts {
		if len([]rune(v)) > 2000 {
			return item, fmt.Errorf("Слишком длинное свойство предмета.")
		}
	}
	item.Source = "custom"
	item.Revision = 0
	if len(item.Properties) == 0 {
		item.Properties = nil
	}
	if raw, err := json.Marshal(item); err != nil || len(raw) > 64<<10 {
		return item, fmt.Errorf("Один предмет не должен превышать 64 КиБ.")
	}
	return item, nil
}
func campaignItemContent(item customCampaignItem) string {
	item.Revision = 0
	raw, _ := json.Marshal(item)
	return string(raw)
}
func customItemsView(c campaignData) customItemsDocument {
	items := c.CustomItems
	if items == nil {
		items = []customCampaignItem{}
	}
	return customItemsDocument{Revision: c.CustomItemsRevision, Items: items}
}

// A pure preview also used under the mutation lock. Colliding IDs produce a
// deterministic copy, never a replacement. Receipts prevent replay resurrection.
func planCustomItemsImport(c campaignData, items []customCampaignItem) (customItemsImport, error) {
	result := customItemsImport{Revision: c.CustomItemsRevision, Additions: []customCampaignItem{}, Renamed: map[string]string{}}
	result.CampaignRevision = c.Revision
	result.ReferenceChanges = []customItemReferenceChange{}
	result.Warnings = []string{}
	result.ReferenceChoices = []customItemReferenceChoice{}
	if len(items) == 0 || len(items) > 2000 {
		return result, fmt.Errorf("Импорт должен содержать от 1 до 2000 предметов.")
	}
	normalized := make([]customCampaignItem, 0, len(items))
	keys := []string{}
	for i, item := range items {
		next, err := normalizeCampaignItem(item)
		if err != nil {
			return result, fmt.Errorf("Предмет %d: %w", i+1, err)
		}
		normalized = append(normalized, next)
		keys = append(keys, campaignItemContent(next))
	}
	sort.Strings(keys)
	raw, _ := json.Marshal(keys)
	hash := sha256.Sum256(raw)
	result.Digest = hex.EncodeToString(hash[:])
	if c.CustomItemImports[result.Digest] {
		result.AlreadyImported = true
		result.Skipped = len(items)
		return result, nil
	}
	known := map[string]customCampaignItem{}
	copies := map[string][]customCampaignItem{}
	for _, item := range c.CustomItems {
		known[item.ID] = item
	}
	for _, item := range normalized {
		if old, ok := known[item.ID]; ok {
			if campaignItemContent(old) == campaignItemContent(item) {
				result.Skipped++
				continue
			}
			original := item.ID
			digest := sha256.Sum256([]byte(campaignItemContent(item)))
			item.ID = "custom-import-" + hex.EncodeToString(digest[:12])
			result.Renamed[original] = item.ID
			duplicateCopy := false
			for _, copy := range copies[original] {
				if copy.ID == item.ID {
					duplicateCopy = true
				}
			}
			if !duplicateCopy {
				copies[original] = append(copies[original], item)
			}
			if copy, ok := known[item.ID]; ok {
				if campaignItemContent(copy) != campaignItemContent(item) {
					return result, fmt.Errorf("Конфликт ID копии предмета: %s", item.ID)
				}
				result.Skipped++
				continue
			}
		}
		item.Revision = 1
		known[item.ID] = item
		result.Additions = append(result.Additions, item)
	}
	for _, shop := range c.Shops {
		for _, entry := range shop.Inventory {
			candidates := copies[entry.ItemID]
			if entry.ItemSource != "custom" || len(candidates) == 0 {
				continue
			}
			matches := []customCampaignItem{}
			for _, candidate := range candidates {
				if candidate.Name == entry.ItemName {
					matches = append(matches, candidate)
				}
			}
			if len(matches) == 1 && known[entry.ItemID].Name != entry.ItemName && c.ReadyCampaign == nil {
				result.ReferenceChanges = append(result.ReferenceChanges, customItemReferenceChange{shop.ID, entry.ID, entry.ItemID, matches[0].ID, entry.ItemName})
			} else if c.ReadyCampaign != nil {
				result.Warnings = append(result.Warnings, "Позиция «"+entry.ItemName+"» в магазине «"+shop.Name+"» относится к неизменяемому шаблону; связь останется без изменений.")
			} else {
				options := []customCampaignItem{known[entry.ItemID]}
				options = append(options, candidates...)
				result.ReferenceChoices = append(result.ReferenceChoices, customItemReferenceChoice{shop.ID, entry.ID, entry.ItemID, entry.ItemName, options})
			}
		}
	}
	if len(c.CustomItems)+len(result.Additions) > 2000 {
		return result, fmt.Errorf("В кампании допускается не более 2000 пользовательских предметов.")
	}
	projected := append(append([]customCampaignItem{}, c.CustomItems...), result.Additions...)
	if raw, err := json.Marshal(projected); err != nil || len(raw) > 4<<20 {
		return result, fmt.Errorf("Каталог пользовательских предметов не должен превышать 4 МиБ.")
	}
	return result, nil
}

func (srv *server) handleCustomItems(w http.ResponseWriter, r *http.Request, user authUser, campaignID string, segments []string) {
	w.Header().Set("Cache-Control", "no-store")
	if len(segments) < 2 || len(segments) > 3 {
		writeError(w, 404, "not_found", "Маршрут предметов не найден.")
		return
	}
	id := ""
	if len(segments) == 3 {
		id = segments[2]
	}
	if r.Method == "GET" && id == "" {
		srv.store.mu.RLock()
		defer srv.store.mu.RUnlock()
		index := findOwnedCampaignIndexLocked(&srv.store.data, user.ID, campaignID)
		if index < 0 {
			writeError(w, 404, "not_found", "Кампания не найдена.")
			return
		}
		writeJSON(w, 200, customItemsView(srv.store.data.Campaigns[index]))
		return
	}
	if !(r.Method == "POST" && (id == "" || id == "import")) && !(id != "" && id != "import" && (r.Method == "PUT" || r.Method == "DELETE")) {
		writeError(w, 405, "method_not_allowed", "Метод не поддерживается.")
		return
	}
	var input struct {
		Item                     *customCampaignItem  `json:"item,omitempty"`
		Items                    []customCampaignItem `json:"items,omitempty"`
		ExpectedRevision         *int                 `json:"expectedRevision,omitempty"`
		ExpectedCampaignRevision *int                 `json:"expectedCampaignRevision,omitempty"`
		ReferenceChoices         map[string]string    `json:"referenceChoices,omitempty"`
		Commit                   bool                 `json:"commit,omitempty"`
	}
	if !boundedMutationInput(w, r, &input, 4<<20) {
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	index := findOwnedCampaignIndexLocked(&srv.store.data, user.ID, campaignID)
	if index < 0 {
		writeError(w, 404, "not_found", "Кампания не найдена.")
		return
	}
	current := srv.store.data.Campaigns[index]
	var preview customItemsImport
	var err error
	if id == "import" {
		preview, err = planCustomItemsImport(current, input.Items)
		if err != nil {
			writeError(w, 400, "invalid_items", err.Error())
			return
		}
		if !input.Commit {
			writeJSON(w, 200, preview)
			return
		}
		if preview.AlreadyImported {
			doc := customItemsView(current)
			doc.Campaign = &current
			writeJSON(w, 200, doc)
			return
		}
		for _, choice := range preview.ReferenceChoices {
			selected, ok := input.ReferenceChoices[recordKey(choice.ShopID, choice.EntryID)]
			allowed := false
			for _, option := range choice.Options {
				if option.ID == selected {
					allowed = true
				}
			}
			if !ok || !allowed {
				writeError(w, 400, "item_reference_choice_required", "Выберите предмет для каждой неоднозначной позиции магазина.")
				return
			}
			if selected != choice.FromID {
				preview.ReferenceChanges = append(preview.ReferenceChanges, customItemReferenceChange{choice.ShopID, choice.EntryID, choice.FromID, selected, choice.Name})
			}
		}
	}
	if r.Method != "POST" || id == "import" {
		if input.ExpectedRevision == nil {
			writeError(w, 428, "revision_required", "Требуется исходная версия.")
			return
		}
		if id == "import" && *input.ExpectedRevision != current.CustomItemsRevision {
			writeAuthoringError(w, &authoringConflict{Current: customItemsView(current)})
			return
		}
		if id == "import" && (len(preview.ReferenceChanges) > 0 || len(preview.ReferenceChoices) > 0) && (input.ExpectedCampaignRevision == nil || *input.ExpectedCampaignRevision != current.Revision) {
			writeAuthoringError(w, &authoringConflict{Current: customItemsView(current)})
			return
		}
	}
	next := current
	next.CustomItems = append([]customCampaignItem{}, current.CustomItems...)
	position := -1
	for i, item := range current.CustomItems {
		if item.ID == id {
			position = i
			break
		}
	}
	if id != "import" {
		if r.Method == "DELETE" {
			if position < 0 {
				writeJSON(w, 200, customItemsView(current))
				return
			}
			if *input.ExpectedRevision != current.CustomItems[position].Revision {
				writeAuthoringError(w, &authoringConflict{Current: current.CustomItems[position]})
				return
			}
			next.CustomItems = append(next.CustomItems[:position], next.CustomItems[position+1:]...)
		} else {
			if input.Item == nil {
				writeError(w, 400, "invalid_item", "Предмет не задан.")
				return
			}
			item, err := normalizeCampaignItem(*input.Item)
			if err != nil {
				writeError(w, 400, "invalid_item", err.Error())
				return
			}
			if r.Method == "POST" {
				for _, old := range current.CustomItems {
					if old.ID == item.ID {
						if campaignItemContent(old) == campaignItemContent(item) {
							writeJSON(w, 200, customItemsView(current))
							return
						}
						writeAuthoringError(w, &authoringConflict{Current: old})
						return
					}
				}
				if len(next.CustomItems) >= 2000 {
					writeError(w, 400, "items_limit", "Достигнут предел 2000 предметов.")
					return
				}
				item.Revision = 1
				next.CustomItems = append(next.CustomItems, item)
			} else {
				if position < 0 {
					writeError(w, 404, "not_found", "Предмет удалён. Черновик можно сохранить как новый предмет.")
					return
				}
				if item.ID != id {
					writeError(w, 400, "id_mismatch", "ID предмета нельзя изменить.")
					return
				}
				if *input.ExpectedRevision != current.CustomItems[position].Revision {
					writeAuthoringError(w, &authoringConflict{Current: current.CustomItems[position]})
					return
				}
				item.Revision = current.CustomItems[position].Revision + 1
				next.CustomItems[position] = item
			}
		}
	} else {
		if len(current.CustomItemImports) >= 2000 {
			writeError(w, 400, "imports_limit", "Достигнут предел пакетов импорта.")
			return
		}
		next.CustomItemImports = map[string]bool{}
		for key, value := range current.CustomItemImports {
			next.CustomItemImports[key] = value
		}
		next.CustomItemImports[preview.Digest] = true
		next.CustomItems = append(next.CustomItems, preview.Additions...)
		if len(preview.ReferenceChanges) > 0 {
			next.Shops = append([]campaignShop{}, current.Shops...)
			for i := range next.Shops {
				next.Shops[i].Inventory = append([]shopInventoryItem{}, current.Shops[i].Inventory...)
				for j := range next.Shops[i].Inventory {
					entry := &next.Shops[i].Inventory[j]
					for _, change := range preview.ReferenceChanges {
						if next.Shops[i].ID == change.ShopID && entry.ID == change.EntryID && entry.ItemID == change.FromID && entry.ItemName == change.Name {
							entry.ItemID = change.ToID
						}
					}
				}
			}
			next.Revision++
		}
	}
	next.CustomItemsRevision++
	if raw, err := json.Marshal(next.CustomItems); err != nil || len(raw) > 4<<20 {
		writeError(w, 400, "items_size_limit", "Каталог пользовательских предметов не должен превышать 4 МиБ.")
		return
	}
	original, err := cloneStorageState(srv.store.data)
	if err != nil {
		writeError(w, 500, "storage_error", "Не удалось подготовить сохранение.")
		return
	}
	srv.store.data.Campaigns[index] = next
	if err = srv.store.saveMutationLocked(original); err != nil {
		writeError(w, 503, "save_failed", "Не удалось подтвердить сохранение. Черновик оставлен; обновите список перед повтором.")
		return
	}
	doc := customItemsView(next)
	if id == "import" {
		doc.Campaign = &next
	}
	writeJSON(w, 200, doc)
}
