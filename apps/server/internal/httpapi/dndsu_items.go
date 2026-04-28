package httpapi

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	dndsuItemsIndex      = dndsuBaseURL + "/piece/items/index-list/"
	nextDndsuBaseURL     = "https://next.dnd.su"
	nextEquipmentIndex   = nextDndsuBaseURL + "/equipment/"
	itemCatalogMagic     = "dndsu-magic"
	itemCatalogEquipment = "dndsu-equipment"
)

type itemCatalogSyncState string

const (
	itemCatalogSyncIdle    itemCatalogSyncState = "idle"
	itemCatalogSyncSyncing itemCatalogSyncState = "syncing"
	itemCatalogSyncReady   itemCatalogSyncState = "ready"
	itemCatalogSyncError   itemCatalogSyncState = "error"
)

type itemCatalogFilterOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
	Count int    `json:"count,omitempty"`
}

type itemCatalogFilters struct {
	Sources    []itemCatalogFilterOption `json:"sources"`
	Categories []itemCatalogFilterOption `json:"categories"`
	ArmorTypes []itemCatalogFilterOption `json:"armorTypes"`
}

type itemCatalogSyncStatus struct {
	State          string `json:"state"`
	Total          int    `json:"total"`
	Hydrated       int    `json:"hydrated"`
	LastError      string `json:"lastError,omitempty"`
	LastStartedAt  string `json:"lastStartedAt,omitempty"`
	LastFinishedAt string `json:"lastFinishedAt,omitempty"`
	UpdatedAt      string `json:"updatedAt,omitempty"`
}

type itemCatalogSummary struct {
	ID                string   `json:"id"`
	RemoteID          string   `json:"remoteId"`
	Slug              string   `json:"slug"`
	Title             string   `json:"title"`
	EnglishTitle      string   `json:"englishTitle,omitempty"`
	Source            string   `json:"source"`
	SourceLabel       string   `json:"sourceLabel"`
	Category          string   `json:"category"`
	Subcategory       string   `json:"subcategory,omitempty"`
	ArmorType         string   `json:"armorType,omitempty"`
	Rarity            string   `json:"rarity,omitempty"`
	TypeLabel         string   `json:"typeLabel"`
	Summary           string   `json:"summary"`
	BuyPriceGP        *float64 `json:"buyPriceGp,omitempty"`
	BuyPriceLabel     string   `json:"buyPriceLabel,omitempty"`
	SellPriceGP       *float64 `json:"sellPriceGp,omitempty"`
	SellPriceLabel    string   `json:"sellPriceLabel,omitempty"`
	Reference         string   `json:"reference,omitempty"`
	URL               string   `json:"url"`
	DescriptionLoaded bool     `json:"descriptionLoaded,omitempty"`
}

type itemCatalogListResult struct {
	Items   []itemCatalogSummary  `json:"items"`
	Filters itemCatalogFilters    `json:"filters"`
	Status  itemCatalogSyncStatus `json:"status"`
	Total   int                   `json:"total"`
}

type itemCatalogDetail struct {
	Summary             itemCatalogSummary    `json:"summary"`
	Description         string                `json:"description"`
	DescriptionHTML     string                `json:"descriptionHtml,omitempty"`
	Properties          []string              `json:"properties,omitempty"`
	WeightLB            *float64              `json:"weightLb,omitempty"`
	Damage              string                `json:"damage,omitempty"`
	DamageType          string                `json:"damageType,omitempty"`
	ArmorClass          *int                  `json:"armorClass,omitempty"`
	StrengthRequirement *int                  `json:"strengthRequirement,omitempty"`
	StealthDisadvantage *bool                 `json:"stealthDisadvantage,omitempty"`
	SourceURL           string                `json:"sourceUrl"`
	Status              itemCatalogSyncStatus `json:"status"`
}

type itemCatalogQuery struct {
	Query     string
	Source    string
	Category  string
	ArmorType string
}

type itemCatalogCache struct {
	UpdatedAt string                  `json:"updatedAt"`
	Sync      itemCatalogSyncStatus   `json:"sync"`
	Entries   []itemCatalogCacheEntry `json:"entries"`
}

type itemCatalogDiskCache struct {
	UpdatedAt string                      `json:"updatedAt"`
	Sync      itemCatalogSyncStatus       `json:"sync"`
	Entries   []itemCatalogDiskCacheEntry `json:"entries"`
}

type itemCatalogDiskCacheEntry struct {
	ID                string   `json:"id"`
	RemoteID          string   `json:"remoteId"`
	Slug              string   `json:"slug"`
	Title             string   `json:"title"`
	EnglishTitle      string   `json:"englishTitle,omitempty"`
	Source            string   `json:"source"`
	Category          string   `json:"category"`
	Subcategory       string   `json:"subcategory,omitempty"`
	ArmorType         string   `json:"armorType,omitempty"`
	Rarity            string   `json:"rarity,omitempty"`
	TypeLabel         string   `json:"typeLabel"`
	Summary           string   `json:"summary"`
	SearchText        string   `json:"searchText"`
	BuyPriceGP        *float64 `json:"buyPriceGp,omitempty"`
	BuyPriceLabel     string   `json:"buyPriceLabel,omitempty"`
	SellPriceGP       *float64 `json:"sellPriceGp,omitempty"`
	SellPriceLabel    string   `json:"sellPriceLabel,omitempty"`
	Reference         string   `json:"reference,omitempty"`
	URL               string   `json:"url"`
	DescriptionLoaded bool     `json:"descriptionLoaded,omitempty"`
	LastSyncedAt      string   `json:"lastSyncedAt,omitempty"`
}

type itemCatalogCacheEntry struct {
	ID                  string   `json:"id"`
	RemoteID            string   `json:"remoteId"`
	Slug                string   `json:"slug"`
	Title               string   `json:"title"`
	EnglishTitle        string   `json:"englishTitle,omitempty"`
	Source              string   `json:"source"`
	Category            string   `json:"category"`
	Subcategory         string   `json:"subcategory,omitempty"`
	ArmorType           string   `json:"armorType,omitempty"`
	Rarity              string   `json:"rarity,omitempty"`
	TypeLabel           string   `json:"typeLabel"`
	Summary             string   `json:"summary"`
	SearchText          string   `json:"searchText"`
	BuyPriceGP          *float64 `json:"buyPriceGp,omitempty"`
	BuyPriceLabel       string   `json:"buyPriceLabel,omitempty"`
	SellPriceGP         *float64 `json:"sellPriceGp,omitempty"`
	SellPriceLabel      string   `json:"sellPriceLabel,omitempty"`
	Reference           string   `json:"reference,omitempty"`
	URL                 string   `json:"url"`
	DescriptionLoaded   bool     `json:"descriptionLoaded,omitempty"`
	LastSyncedAt        string   `json:"lastSyncedAt,omitempty"`
	Description         string   `json:"description,omitempty"`
	DescriptionHTML     string   `json:"descriptionHtml,omitempty"`
	Properties          []string `json:"properties,omitempty"`
	WeightLB            *float64 `json:"weightLb,omitempty"`
	Damage              string   `json:"damage,omitempty"`
	DamageType          string   `json:"damageType,omitempty"`
	ArmorClass          *int     `json:"armorClass,omitempty"`
	StrengthRequirement *int     `json:"strengthRequirement,omitempty"`
	StealthDisadvantage *bool    `json:"stealthDisadvantage,omitempty"`
}

type itemCatalog struct {
	mu          sync.RWMutex
	initMu      sync.Mutex
	initialized bool
	path        string
	detailDir   string
	client      *http.Client
	cache       itemCatalogCache
}

func newItemCatalog(path string) (*itemCatalog, error) {
	if strings.TrimSpace(path) == "" {
		return &itemCatalog{
			client: &http.Client{Timeout: 20 * time.Second},
			cache: itemCatalogCache{
				Sync: itemCatalogSyncStatus{State: string(itemCatalogSyncIdle)},
			},
		}, nil
	}

	return &itemCatalog{
		path:      path,
		detailDir: strings.TrimSuffix(path, filepath.Ext(path)) + "-details",
		client:    &http.Client{Timeout: 20 * time.Second},
		cache: itemCatalogCache{
			Sync: itemCatalogSyncStatus{State: string(itemCatalogSyncIdle)},
		},
	}, nil
}

func (catalog *itemCatalog) ensureIndexLoaded() error {
	catalog.initMu.Lock()
	defer catalog.initMu.Unlock()

	if catalog.initialized {
		return nil
	}

	if err := catalog.load(); err != nil {
		return err
	}

	if len(catalog.cache.Entries) == 0 {
		if err := catalog.syncIndex(); err != nil {
			return err
		}
	}

	catalog.initialized = true
	return nil
}

func (catalog *itemCatalog) load() error {
	if catalog.path == "" {
		return nil
	}

	if _, err := os.Stat(catalog.path); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}

	file, err := os.Open(catalog.path)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := bufio.NewReader(file)
	if bom, _ := reader.Peek(3); len(bom) == 3 && bom[0] == 0xEF && bom[1] == 0xBB && bom[2] == 0xBF {
		if _, err := reader.Discard(3); err != nil {
			return err
		}
	}

	var cache itemCatalogDiskCache
	if err := json.NewDecoder(reader).Decode(&cache); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}

	entries := make([]itemCatalogCacheEntry, 0, len(cache.Entries))
	for _, entry := range cache.Entries {
		entries = append(entries, itemCatalogCacheEntryFromDisk(entry))
	}

	cache.Sync.Total = len(entries)
	cache.Sync.Hydrated = countHydratedItemEntries(entries)
	if cache.Sync.State == "" {
		cache.Sync.State = string(itemCatalogSyncIdle)
	}

	catalog.cache = itemCatalogCache{
		UpdatedAt: cache.UpdatedAt,
		Sync:      cache.Sync,
		Entries:   entries,
	}
	return nil
}

func (catalog *itemCatalog) saveLocked() error {
	if catalog.path == "" {
		return nil
	}

	catalog.cache.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	catalog.cache.Sync.UpdatedAt = catalog.cache.UpdatedAt

	if err := os.MkdirAll(filepath.Dir(catalog.path), 0o755); err != nil {
		return err
	}

	entries := make([]itemCatalogDiskCacheEntry, 0, len(catalog.cache.Entries))
	for _, entry := range catalog.cache.Entries {
		entries = append(entries, itemCatalogDiskEntryFromCache(entry))
	}

	body, err := json.MarshalIndent(itemCatalogDiskCache{
		UpdatedAt: catalog.cache.UpdatedAt,
		Sync:      catalog.cache.Sync,
		Entries:   entries,
	}, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(catalog.path, body, 0o644)
}

func (catalog *itemCatalog) syncIndex() error {
	magicBody, err := catalog.fetchURL(dndsuItemsIndex)
	if err != nil {
		catalog.recordIndexError(err)
		return err
	}

	equipmentBody, err := catalog.fetchURL(nextEquipmentIndex)
	if err != nil {
		catalog.recordIndexError(err)
		return err
	}

	magicEntries, err := parseDndsuItemIndex(magicBody)
	if err != nil {
		catalog.recordIndexError(err)
		return err
	}

	equipmentEntries, err := parseNextEquipmentIndex(equipmentBody)
	if err != nil {
		catalog.recordIndexError(err)
		return err
	}

	existingByID := map[string]itemCatalogCacheEntry{}
	catalog.mu.RLock()
	for _, entry := range catalog.cache.Entries {
		existingByID[entry.ID] = entry
	}
	catalog.mu.RUnlock()

	parsed := append(magicEntries, equipmentEntries...)
	merged := make([]itemCatalogCacheEntry, 0, len(parsed))
	for _, entry := range parsed {
		if existing, ok := existingByID[entry.ID]; ok {
			entry = mergeItemSummary(existing, entry)
		}
		merged = append(merged, entry)
	}

	sort.SliceStable(merged, func(i, j int) bool {
		if merged[i].Source != merged[j].Source {
			return merged[i].Source < merged[j].Source
		}
		return strings.ToLower(merged[i].Title) < strings.ToLower(merged[j].Title)
	})

	catalog.mu.Lock()
	defer catalog.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)
	catalog.cache.Entries = merged
	catalog.cache.Sync.State = string(itemCatalogSyncReady)
	catalog.cache.Sync.Total = len(merged)
	catalog.cache.Sync.Hydrated = countHydratedItemEntries(merged)
	catalog.cache.Sync.LastError = ""
	catalog.cache.Sync.LastStartedAt = now
	catalog.cache.Sync.LastFinishedAt = now
	return catalog.saveLocked()
}

func (catalog *itemCatalog) browse(query itemCatalogQuery) itemCatalogListResult {
	if err := catalog.ensureIndexLoaded(); err != nil {
		status := itemCatalogSyncStatus{State: string(itemCatalogSyncError), LastError: err.Error()}
		return itemCatalogListResult{Status: status}
	}

	catalog.mu.RLock()
	entries := append([]itemCatalogCacheEntry(nil), catalog.cache.Entries...)
	status := catalog.cache.Sync
	catalog.mu.RUnlock()

	filtered := make([]itemCatalogSummary, 0, len(entries))
	for _, entry := range entries {
		if !matchItemCatalogQuery(entry, query) {
			continue
		}
		filtered = append(filtered, summaryFromItemCache(entry))
	}

	return itemCatalogListResult{
		Items:   filtered,
		Filters: buildItemCatalogFilters(entries),
		Status:  status,
		Total:   len(filtered),
	}
}

func (catalog *itemCatalog) getItem(id string) (itemCatalogDetail, error) {
	if err := catalog.ensureIndexLoaded(); err != nil {
		return itemCatalogDetail{}, err
	}

	if detail, ok := catalog.getCachedItem(id); ok {
		return detail, nil
	}

	entry, err := catalog.fetchAndStoreDetail(id)
	if err != nil {
		catalog.recordDetailError(err)
		return itemCatalogDetail{}, err
	}

	catalog.mu.RLock()
	status := catalog.cache.Sync
	catalog.mu.RUnlock()
	return detailFromItemCache(entry, status), nil
}

func (catalog *itemCatalog) getCachedItem(id string) (itemCatalogDetail, bool) {
	catalog.mu.RLock()
	defer catalog.mu.RUnlock()

	status := catalog.cache.Sync
	for _, entry := range catalog.cache.Entries {
		if entry.ID != id {
			continue
		}
		if entry.DescriptionLoaded && strings.TrimSpace(entry.Description) != "" {
			return detailFromItemCache(entry, status), true
		}
	}

	if loaded, ok := catalog.loadDetail(id); ok {
		return detailFromItemCache(loaded, status), true
	}
	return itemCatalogDetail{}, false
}

func (catalog *itemCatalog) fetchAndStoreDetail(id string) (itemCatalogCacheEntry, error) {
	catalog.mu.RLock()
	var target itemCatalogCacheEntry
	found := false
	for _, entry := range catalog.cache.Entries {
		if entry.ID == id {
			target = entry
			found = true
			break
		}
	}
	catalog.mu.RUnlock()

	if !found {
		return itemCatalogCacheEntry{}, fmt.Errorf("item %q not found", id)
	}

	body, err := catalog.fetchURL(target.URL)
	if err != nil {
		return itemCatalogCacheEntry{}, err
	}

	var detail itemCatalogCacheEntry
	switch target.Source {
	case itemCatalogMagic:
		detail, err = parseDndsuItemDetail(target, body)
	case itemCatalogEquipment:
		detail, err = parseNextEquipmentDetail(target, body)
	default:
		err = fmt.Errorf("unsupported item source %q", target.Source)
	}
	if err != nil {
		return itemCatalogCacheEntry{}, err
	}

	catalog.mu.Lock()
	defer catalog.mu.Unlock()

	for index := range catalog.cache.Entries {
		if catalog.cache.Entries[index].ID != id {
			continue
		}
		catalog.cache.Entries[index] = mergeItemSummary(catalog.cache.Entries[index], detail)
		catalog.cache.Sync.State = string(itemCatalogSyncReady)
		catalog.cache.Sync.Total = len(catalog.cache.Entries)
		catalog.cache.Sync.Hydrated = countHydratedItemEntries(catalog.cache.Entries)
		catalog.cache.Sync.LastError = ""
		if err := catalog.saveLocked(); err != nil {
			return itemCatalogCacheEntry{}, err
		}
		if err := catalog.saveDetail(catalog.cache.Entries[index]); err != nil {
			return itemCatalogCacheEntry{}, err
		}
		return catalog.cache.Entries[index], nil
	}

	return itemCatalogCacheEntry{}, fmt.Errorf("item %q disappeared during sync", id)
}

func (catalog *itemCatalog) fetchURL(rawURL string) (string, error) {
	request, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("User-Agent", "ShadowEdgeGM/1.0 (+https://github.com/openai)")

	response, err := catalog.client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("remote request to %s returned %s", rawURL, response.Status)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (catalog *itemCatalog) recordIndexError(err error) {
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	catalog.cache.Sync.State = string(itemCatalogSyncError)
	catalog.cache.Sync.LastError = err.Error()
	catalog.cache.Sync.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
}

func (catalog *itemCatalog) recordDetailError(err error) {
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	catalog.cache.Sync.State = string(itemCatalogSyncError)
	catalog.cache.Sync.LastError = err.Error()
	catalog.cache.Sync.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
}

func (catalog *itemCatalog) loadDetail(id string) (itemCatalogCacheEntry, bool) {
	if catalog.detailDir == "" {
		return itemCatalogCacheEntry{}, false
	}

	path := filepath.Join(catalog.detailDir, id+".json")
	file, err := os.Open(path)
	if err != nil {
		return itemCatalogCacheEntry{}, false
	}
	defer file.Close()

	var entry itemCatalogCacheEntry
	if err := json.NewDecoder(file).Decode(&entry); err != nil {
		return itemCatalogCacheEntry{}, false
	}
	return entry, true
}

func (catalog *itemCatalog) saveDetail(entry itemCatalogCacheEntry) error {
	if catalog.detailDir == "" || !entry.DescriptionLoaded {
		return nil
	}

	if err := os.MkdirAll(catalog.detailDir, 0o755); err != nil {
		return err
	}

	body, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(catalog.detailDir, entry.ID+".json"), body, 0o644)
}

func countHydratedItemEntries(entries []itemCatalogCacheEntry) int {
	total := 0
	for _, entry := range entries {
		if entry.DescriptionLoaded {
			total++
		}
	}
	return total
}

func buildItemCatalogFilters(entries []itemCatalogCacheEntry) itemCatalogFilters {
	sourceCounts := map[string]int{}
	categoryCounts := map[string]int{}
	armorTypeCounts := map[string]int{}

	for _, entry := range entries {
		sourceCounts[entry.Source]++
		categoryCounts[entry.Category]++
		if strings.TrimSpace(entry.ArmorType) != "" {
			armorTypeCounts[entry.ArmorType]++
		}
	}

	sources := make([]itemCatalogFilterOption, 0, len(sourceCounts))
	for value, count := range sourceCounts {
		sources = append(sources, itemCatalogFilterOption{Value: value, Label: itemCatalogSourceLabel(value), Count: count})
	}
	sort.Slice(sources, func(i, j int) bool { return sources[i].Label < sources[j].Label })

	categories := make([]itemCatalogFilterOption, 0, len(categoryCounts))
	for value, count := range categoryCounts {
		categories = append(categories, itemCatalogFilterOption{Value: value, Label: itemCatalogCategoryLabel(value), Count: count})
	}
	sort.Slice(categories, func(i, j int) bool { return categories[i].Label < categories[j].Label })

	armorTypes := make([]itemCatalogFilterOption, 0, len(armorTypeCounts))
	for value, count := range armorTypeCounts {
		armorTypes = append(armorTypes, itemCatalogFilterOption{Value: value, Label: itemCatalogArmorTypeLabel(value), Count: count})
	}
	sort.Slice(armorTypes, func(i, j int) bool { return armorTypes[i].Label < armorTypes[j].Label })

	return itemCatalogFilters{
		Sources:    sources,
		Categories: categories,
		ArmorTypes: armorTypes,
	}
}

func matchItemCatalogQuery(entry itemCatalogCacheEntry, query itemCatalogQuery) bool {
	if query.Source != "" && entry.Source != query.Source {
		return false
	}
	if query.Category != "" && entry.Category != query.Category {
		return false
	}
	if query.ArmorType != "" && entry.ArmorType != query.ArmorType {
		return false
	}
	if strings.TrimSpace(query.Query) == "" {
		return true
	}

	search := normalizeWhitespace(strings.ToLower(strings.TrimSpace(query.Query)))
	return strings.Contains(strings.ToLower(entry.SearchText), search)
}

func summaryFromItemCache(entry itemCatalogCacheEntry) itemCatalogSummary {
	return itemCatalogSummary{
		ID:                entry.ID,
		RemoteID:          entry.RemoteID,
		Slug:              entry.Slug,
		Title:             entry.Title,
		EnglishTitle:      entry.EnglishTitle,
		Source:            entry.Source,
		SourceLabel:       itemCatalogSourceLabel(entry.Source),
		Category:          entry.Category,
		Subcategory:       entry.Subcategory,
		ArmorType:         entry.ArmorType,
		Rarity:            entry.Rarity,
		TypeLabel:         entry.TypeLabel,
		Summary:           entry.Summary,
		BuyPriceGP:        entry.BuyPriceGP,
		BuyPriceLabel:     entry.BuyPriceLabel,
		SellPriceGP:       entry.SellPriceGP,
		SellPriceLabel:    entry.SellPriceLabel,
		Reference:         entry.Reference,
		URL:               entry.URL,
		DescriptionLoaded: entry.DescriptionLoaded,
	}
}

func detailFromItemCache(entry itemCatalogCacheEntry, status itemCatalogSyncStatus) itemCatalogDetail {
	return itemCatalogDetail{
		Summary:             summaryFromItemCache(entry),
		Description:         entry.Description,
		DescriptionHTML:     entry.DescriptionHTML,
		Properties:          append([]string(nil), entry.Properties...),
		WeightLB:            entry.WeightLB,
		Damage:              entry.Damage,
		DamageType:          entry.DamageType,
		ArmorClass:          entry.ArmorClass,
		StrengthRequirement: entry.StrengthRequirement,
		StealthDisadvantage: entry.StealthDisadvantage,
		SourceURL:           entry.URL,
		Status:              status,
	}
}

func itemCatalogDiskEntryFromCache(entry itemCatalogCacheEntry) itemCatalogDiskCacheEntry {
	return itemCatalogDiskCacheEntry{
		ID:                entry.ID,
		RemoteID:          entry.RemoteID,
		Slug:              entry.Slug,
		Title:             entry.Title,
		EnglishTitle:      entry.EnglishTitle,
		Source:            entry.Source,
		Category:          entry.Category,
		Subcategory:       entry.Subcategory,
		ArmorType:         entry.ArmorType,
		Rarity:            entry.Rarity,
		TypeLabel:         entry.TypeLabel,
		Summary:           entry.Summary,
		SearchText:        entry.SearchText,
		BuyPriceGP:        entry.BuyPriceGP,
		BuyPriceLabel:     entry.BuyPriceLabel,
		SellPriceGP:       entry.SellPriceGP,
		SellPriceLabel:    entry.SellPriceLabel,
		Reference:         entry.Reference,
		URL:               entry.URL,
		DescriptionLoaded: entry.DescriptionLoaded,
		LastSyncedAt:      entry.LastSyncedAt,
	}
}

func itemCatalogCacheEntryFromDisk(entry itemCatalogDiskCacheEntry) itemCatalogCacheEntry {
	return itemCatalogCacheEntry{
		ID:                entry.ID,
		RemoteID:          entry.RemoteID,
		Slug:              entry.Slug,
		Title:             entry.Title,
		EnglishTitle:      entry.EnglishTitle,
		Source:            entry.Source,
		Category:          entry.Category,
		Subcategory:       entry.Subcategory,
		ArmorType:         entry.ArmorType,
		Rarity:            entry.Rarity,
		TypeLabel:         entry.TypeLabel,
		Summary:           entry.Summary,
		SearchText:        entry.SearchText,
		BuyPriceGP:        entry.BuyPriceGP,
		BuyPriceLabel:     entry.BuyPriceLabel,
		SellPriceGP:       entry.SellPriceGP,
		SellPriceLabel:    entry.SellPriceLabel,
		Reference:         entry.Reference,
		URL:               entry.URL,
		DescriptionLoaded: entry.DescriptionLoaded,
		LastSyncedAt:      entry.LastSyncedAt,
	}
}

func mergeItemSummary(current itemCatalogCacheEntry, incoming itemCatalogCacheEntry) itemCatalogCacheEntry {
	merged := incoming
	merged.Subcategory = firstNonEmpty(incoming.Subcategory, current.Subcategory)
	merged.ArmorType = firstNonEmpty(incoming.ArmorType, current.ArmorType)
	merged.Rarity = firstNonEmpty(incoming.Rarity, current.Rarity)
	merged.TypeLabel = firstNonEmpty(incoming.TypeLabel, current.TypeLabel)
	merged.Summary = firstNonEmpty(incoming.Summary, current.Summary)
	merged.BuyPriceGP = firstNonNilFloat(incoming.BuyPriceGP, current.BuyPriceGP)
	merged.BuyPriceLabel = firstNonEmpty(incoming.BuyPriceLabel, current.BuyPriceLabel)
	merged.SellPriceGP = firstNonNilFloat(incoming.SellPriceGP, current.SellPriceGP)
	merged.SellPriceLabel = firstNonEmpty(incoming.SellPriceLabel, current.SellPriceLabel)
	merged.Reference = firstNonEmpty(incoming.Reference, current.Reference)
	merged.DescriptionLoaded = incoming.DescriptionLoaded || current.DescriptionLoaded
	merged.LastSyncedAt = firstNonEmpty(incoming.LastSyncedAt, current.LastSyncedAt)
	merged.Description = firstNonEmpty(incoming.Description, current.Description)
	merged.DescriptionHTML = firstNonEmpty(incoming.DescriptionHTML, current.DescriptionHTML)
	if len(incoming.Properties) == 0 {
		merged.Properties = append([]string(nil), current.Properties...)
	}
	merged.WeightLB = firstNonNilFloat(incoming.WeightLB, current.WeightLB)
	merged.Damage = firstNonEmpty(incoming.Damage, current.Damage)
	merged.DamageType = firstNonEmpty(incoming.DamageType, current.DamageType)
	merged.ArmorClass = firstNonNilInt(incoming.ArmorClass, current.ArmorClass)
	merged.StrengthRequirement = firstNonNilInt(incoming.StrengthRequirement, current.StrengthRequirement)
	merged.StealthDisadvantage = firstNonNilBool(incoming.StealthDisadvantage, current.StealthDisadvantage)
	return merged
}

func firstNonNilFloat(values ...*float64) *float64 {
	for _, value := range values {
		if value != nil {
			copy := *value
			return &copy
		}
	}
	return nil
}

func firstNonNilInt(values ...*int) *int {
	for _, value := range values {
		if value != nil {
			copy := *value
			return &copy
		}
	}
	return nil
}

func firstNonNilBool(values ...*bool) *bool {
	for _, value := range values {
		if value != nil {
			copy := *value
			return &copy
		}
	}
	return nil
}

var dndsuItemIndexPattern = regexp.MustCompile(`(?s)<div class='col list-item__spell for_filter'[^>]*data-search='([^']*)'[^>]*data-id='([^']*)'[^>]*>\s*<a href='([^']*)'[^>]*>\s*<span class='[^']*' title='([^']*)'>.*?</span>\s*<div class='list-item-title'>(.*?)</div>\s*(?:<span class='list-icon__quality[^']*' title='([^']*)'>.*?</span>)?`)
var nextEquipmentIndexPattern = regexp.MustCompile(`(?s)<div class='col list-item__spell for_filter'[^>]*data-search='([^']*)'[^>]*data-id='([^']*)'[^>]*data-letter='([^']*)'[^>]*>\s*<a href='([^']*)'[^>]*>\s*<span class='[^']*' title='([^']*)'>.*?</span>\s*<div class='list-item-title'>(.*?)</div>`)
var nextEquipmentGroupPattern = regexp.MustCompile(`(?s)<div class='first-letter list-group col-24' id='([^']*)'><div class='list-group__wrapper'>(.*?)</div></div>`)

func parseDndsuItemIndex(body string) ([]itemCatalogCacheEntry, error) {
	matches := dndsuItemIndexPattern.FindAllStringSubmatch(body, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("dnd.su item index markup did not match expected pattern")
	}

	entries := make([]itemCatalogCacheEntry, 0, len(matches))
	for _, match := range matches {
		searchText := html.UnescapeString(strings.TrimSpace(match[1]))
		remoteID := strings.TrimSpace(match[2])
		href := strings.TrimSpace(match[3])
		typeLabel := strings.TrimSpace(stripHTML(match[4]))
		title := strings.TrimSpace(stripHTML(match[5]))
		rarity := strings.TrimSpace(stripHTML(match[6]))

		russianTitle, englishTitle := splitCatalogSearchNames(searchText, title)
		slug := strings.Trim(strings.TrimPrefix(href, "/items/"), "/")
		category, subcategory, armorType := resolveMagicItemShape(typeLabel, title)
		reference := sourceFromOgTitle(findMetaContent(body, "og:title"))

		entry := itemCatalogCacheEntry{
			ID:           composeItemCatalogID(itemCatalogMagic, remoteID),
			RemoteID:     remoteID,
			Slug:         slug,
			Title:        firstNonEmpty(russianTitle, title),
			EnglishTitle: englishTitle,
			Source:       itemCatalogMagic,
			Category:     category,
			Subcategory:  subcategory,
			ArmorType:    armorType,
			Rarity:       rarity,
			TypeLabel:    typeLabel,
			Summary:      buildSummaryPlaceholder(typeLabel, rarity),
			SearchText:   normalizeWhitespace(strings.ToLower(searchText + " " + typeLabel + " " + rarity + " " + title)),
			URL:          ensureAbsoluteURL(dndsuBaseURL, href),
			Reference:    reference,
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func parseNextEquipmentIndex(body string) ([]itemCatalogCacheEntry, error) {
	matches := nextEquipmentIndexPattern.FindAllStringSubmatch(body, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("next.dnd.su equipment index markup did not match expected pattern")
	}

	groupLabels := map[string]string{}
	for _, match := range nextEquipmentGroupPattern.FindAllStringSubmatch(body, -1) {
		groupLabels[strings.TrimSpace(match[1])] = strings.TrimSpace(stripHTML(match[2]))
	}

	entries := make([]itemCatalogCacheEntry, 0, len(matches))
	for _, match := range matches {
		searchText := html.UnescapeString(strings.TrimSpace(match[1]))
		remoteID := strings.TrimSpace(match[2])
		groupKey := strings.TrimSpace(match[3])
		href := strings.TrimSpace(match[4])
		typeLabel := strings.TrimSpace(stripHTML(match[5]))
		title := strings.TrimSpace(stripHTML(match[6]))
		groupLabel := groupLabels[groupKey]

		russianTitle, englishTitle := splitCatalogSearchNames(searchText, title)
		slug := strings.Trim(strings.TrimPrefix(href, "/equipment/"), "/")
		category, subcategory, armorType := resolveEquipmentItemShape(groupKey, typeLabel, groupLabel, title)

		entry := itemCatalogCacheEntry{
			ID:           composeItemCatalogID(itemCatalogEquipment, remoteID),
			RemoteID:     remoteID,
			Slug:         slug,
			Title:        firstNonEmpty(russianTitle, title),
			EnglishTitle: englishTitle,
			Source:       itemCatalogEquipment,
			Category:     category,
			Subcategory:  firstNonEmpty(subcategory, groupLabel),
			ArmorType:    armorType,
			TypeLabel:    firstNonEmpty(groupLabel, typeLabel),
			Summary:      buildSummaryPlaceholder(firstNonEmpty(groupLabel, typeLabel), ""),
			SearchText:   normalizeWhitespace(strings.ToLower(searchText + " " + groupKey + " " + groupLabel + " " + typeLabel + " " + title)),
			URL:          ensureAbsoluteURL(nextDndsuBaseURL, href),
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func parseDndsuItemDetail(base itemCatalogCacheEntry, body string) (itemCatalogCacheEntry, error) {
	paramsHTML := findItemParamsBlock(body)
	if paramsHTML == "" {
		return itemCatalogCacheEntry{}, fmt.Errorf("dnd.su item detail card params were not found")
	}

	entry := base
	typeLine := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]size-type-alignment['"]>(.*?)</li>`)))
	priceLabel := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]price['"]>\s*<strong>[^<]+</strong>\s*(.*?)</li>`)))
	descriptionBlock := findFirstSubmatch(paramsHTML, `(?s)<li class=["']subsection desc["']><div itemprop="description">(.*?)</div></li>`)

	entry.TypeLabel = firstNonEmpty(typeLine, entry.TypeLabel)
	entry.Reference = firstNonEmpty(sourceFromOgTitle(findMetaContent(body, "og:title")), entry.Reference)
	entry.Summary = itemDescriptionExcerpt(descriptionBlock, entry.TypeLabel)
	entry.Description = htmlBlockToPlainText(descriptionBlock)
	entry.DescriptionHTML = sanitizeItemDescriptionHTML(descriptionBlock)
	entry.Properties = appendUniqueProperties(entry.Properties, extractAttunementProperty(typeLine))
	entry.Properties = appendUniqueProperties(entry.Properties, extractFeatureProperties(paramsHTML)...)
	entry.DescriptionLoaded = entry.Description != ""
	entry.LastSyncedAt = time.Now().UTC().Format(time.RFC3339)

	if parsed := parsePriceMetadata(priceLabel); parsed.ok {
		entry.BuyPriceGP = floatPointer(parsed.midpoint)
		entry.BuyPriceLabel = parsed.displayLabel
		entry.SellPriceGP = floatPointer(parsed.midpoint / 2)
		entry.SellPriceLabel = formatPriceRangeLabel(parsed.min/2, parsed.max/2)
	}

	category, subcategory, armorType, rarity := resolveMagicDetailShape(typeLine, base)
	entry.Category = firstNonEmpty(category, entry.Category)
	entry.Subcategory = firstNonEmpty(subcategory, entry.Subcategory)
	entry.ArmorType = firstNonEmpty(armorType, entry.ArmorType)
	entry.Rarity = firstNonEmpty(rarity, entry.Rarity)

	return entry, nil
}

func parseNextEquipmentDetail(base itemCatalogCacheEntry, body string) (itemCatalogCacheEntry, error) {
	paramsHTML := findItemParamsBlock(body)
	if paramsHTML == "" {
		return itemCatalogCacheEntry{}, fmt.Errorf("next.dnd.su equipment detail card params were not found")
	}

	entry := base
	typeLine := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]size-type-alignment['"]>(.*?)</li>`)))
	priceLabel := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]price['"]>\s*<strong>[^<]+</strong>\s*(.*?)</li>`)))
	weightLabel := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]weight['"]>\s*<strong>[^<]+</strong>\s*(.*?)</li>`)))
	damageLabel := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]weapons['"]>\s*<strong>[^<]+</strong>\s*(.*?)</li>`)))
	armorClassLabel := strings.TrimSpace(stripHTML(findFirstSubmatch(paramsHTML, `(?s)<li class=['"]armors['"]>\s*<strong>[^<]+</strong>\s*(.*?)</li>`)))
	descriptionBlock := findFirstSubmatch(paramsHTML, `(?s)<li class=["']subsection desc["']><div itemprop="description">(.*?)</div></li>`)

	entry.TypeLabel = firstNonEmpty(typeLine, entry.TypeLabel)
	entry.Reference = firstNonEmpty(sourceFromOgTitle(findMetaContent(body, "og:title")), entry.Reference)
	entry.Summary = itemDescriptionExcerpt(descriptionBlock, entry.TypeLabel)
	entry.Description = htmlBlockToPlainText(descriptionBlock)
	entry.DescriptionHTML = sanitizeItemDescriptionHTML(descriptionBlock)
	entry.Properties = appendUniqueProperties(entry.Properties, extractFeatureProperties(paramsHTML)...)
	entry.DescriptionLoaded = entry.Description != ""
	entry.LastSyncedAt = time.Now().UTC().Format(time.RFC3339)

	if parsed := parsePriceMetadata(priceLabel); parsed.ok {
		entry.BuyPriceGP = floatPointer(parsed.midpoint)
		entry.BuyPriceLabel = parsed.displayLabel
		entry.SellPriceGP = floatPointer(parsed.midpoint / 2)
		entry.SellPriceLabel = formatPriceRangeLabel(parsed.min/2, parsed.max/2)
	}
	if weight := parseWeightValue(weightLabel); weight != nil {
		entry.WeightLB = weight
	}
	if damage, damageType := parseDamageLabel(damageLabel); damage != "" || damageType != "" {
		entry.Damage = damage
		entry.DamageType = damageType
	}
	if armorClass := parseArmorClassValue(armorClassLabel); armorClass != nil {
		entry.ArmorClass = armorClass
	}
	if requirement := parseStrengthRequirement(paramsHTML); requirement != nil {
		entry.StrengthRequirement = requirement
	}
	if disadvantage := parseStealthDisadvantage(paramsHTML); disadvantage != nil {
		entry.StealthDisadvantage = disadvantage
	}

	category, subcategory, armorType := resolveEquipmentDetailShape(typeLine, base)
	entry.Category = firstNonEmpty(category, entry.Category)
	entry.Subcategory = firstNonEmpty(subcategory, entry.Subcategory)
	entry.ArmorType = firstNonEmpty(armorType, entry.ArmorType)

	return entry, nil
}

func findItemParamsBlock(body string) string {
	return findFirstSubmatch(body, `(?s)<ul class=["']params[^>]*>(.*?)</ul>`)
}

func splitCatalogSearchNames(searchText string, fallbackTitle string) (string, string) {
	parts := strings.Split(searchText, ",")
	russian := ""
	english := ""
	if len(parts) > 0 {
		russian = strings.TrimSpace(parts[0])
	}
	if len(parts) > 1 {
		english = strings.TrimSpace(parts[1])
	}
	return firstNonEmpty(russian, fallbackTitle), english
}

func composeItemCatalogID(source string, remoteID string) string {
	return source + "-" + strings.TrimSpace(remoteID)
}

func ensureAbsoluteURL(base string, href string) string {
	href = strings.TrimSpace(href)
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(href, "/")
}

func itemCatalogSourceLabel(source string) string {
	switch source {
	case itemCatalogMagic:
		return "DnD.su • магические предметы"
	case itemCatalogEquipment:
		return "DnD.su • снаряжение"
	default:
		return source
	}
}

func itemCatalogCategoryLabel(category string) string {
	switch category {
	case "armor":
		return "Броня"
	case "weapon":
		return "Оружие"
	case "potion":
		return "Зелье"
	case "poison":
		return "Яд"
	case "staff":
		return "Посох"
	case "ring":
		return "Кольцо"
	case "scroll":
		return "Свиток"
	case "wand":
		return "Палочка"
	case "tool":
		return "Инструмент"
	case "gear":
		return "Снаряжение"
	case "focus":
		return "Фокус"
	case "clothing":
		return "Одежда"
	default:
		return "Другое"
	}
}

func itemCatalogArmorTypeLabel(armorType string) string {
	switch armorType {
	case "light":
		return "Лёгкая"
	case "medium":
		return "Средняя"
	case "heavy":
		return "Тяжёлая"
	case "shield":
		return "Щит"
	default:
		return armorType
	}
}

func resolveMagicItemShape(typeLabel string, title string) (string, string, string) {
	lowerType := strings.ToLower(typeLabel)
	lowerTitle := strings.ToLower(title)

	switch {
	case strings.Contains(lowerType, "доспех"):
		return "armor", "Доспех", ""
	case strings.Contains(lowerType, "щит"):
		return "armor", "Щит", "shield"
	case strings.Contains(lowerType, "оружие"):
		return "weapon", "Оружие", ""
	case strings.Contains(lowerType, "зелье"):
		return "potion", "Зелье", ""
	case strings.Contains(lowerType, "кольцо"):
		return "ring", "Кольцо", ""
	case strings.Contains(lowerType, "посох"):
		return "staff", "Посох", ""
	case strings.Contains(lowerType, "волшебная палочка"):
		return "wand", "Волшебная палочка", ""
	case strings.Contains(lowerType, "жезл"):
		return "wand", "Жезл", ""
	case strings.Contains(lowerType, "свиток"):
		return "scroll", "Свиток", ""
	case strings.Contains(lowerType, "яд"):
		return "poison", "Яд", ""
	}

	if looksLikeClothing(lowerTitle) {
		return "clothing", typeLabel, ""
	}
	return "other", typeLabel, ""
}

func resolveEquipmentItemShape(groupKey string, typeLabel string, groupLabel string, title string) (string, string, string) {
	switch groupKey {
	case "light_armor":
		return "armor", firstNonEmpty(groupLabel, "Лёгкий доспех"), "light"
	case "medium_armor":
		return "armor", firstNonEmpty(groupLabel, "Средний доспех"), "medium"
	case "heavy_armor":
		return "armor", firstNonEmpty(groupLabel, "Тяжёлый доспех"), "heavy"
	case "shield":
		return "armor", firstNonEmpty(groupLabel, "Щит"), "shield"
	case "melee_simple_weapon", "ranged_simple_weapon", "melee_martial_weapon", "ranged_martial_weapon":
		return "weapon", firstNonEmpty(groupLabel, typeLabel), ""
	case "toolkit", "artisan_tool":
		return "tool", firstNonEmpty(groupLabel, typeLabel), ""
	case "spellcasting_focus":
		return "focus", firstNonEmpty(groupLabel, typeLabel), ""
	case "item_pack":
		return "gear", firstNonEmpty(groupLabel, typeLabel), ""
	case "ammunition":
		return "gear", firstNonEmpty(groupLabel, typeLabel), ""
	case "equipment":
		if looksLikeClothing(strings.ToLower(title)) {
			return "clothing", firstNonEmpty(groupLabel, typeLabel), ""
		}
		return "gear", firstNonEmpty(groupLabel, typeLabel), ""
	default:
		return "other", firstNonEmpty(groupLabel, typeLabel), ""
	}
}

func resolveMagicDetailShape(typeLine string, fallback itemCatalogCacheEntry) (string, string, string, string) {
	category, subcategory, armorType := resolveMagicItemShape(typeLine, fallback.Title)
	rarity := parseRarityFromTypeLine(typeLine)
	segment := strings.TrimSpace(strings.Split(typeLine, ",")[0])
	if inner := findFirstSubmatch(segment, `\((.*?)\)`); inner != "" {
		subcategory = titleCase(strings.TrimSpace(inner))
	} else if category == "weapon" || category == "armor" {
		subcategory = titleCase(strings.TrimSpace(segment))
	}

	if category == "armor" && armorType == "" {
		lower := strings.ToLower(typeLine)
		switch {
		case strings.Contains(lower, "лёгк"):
			armorType = "light"
		case strings.Contains(lower, "средн"):
			armorType = "medium"
		case strings.Contains(lower, "тяж"):
			armorType = "heavy"
		}
	}
	return category, subcategory, armorType, rarity
}

func resolveEquipmentDetailShape(typeLine string, fallback itemCatalogCacheEntry) (string, string, string) {
	lower := strings.ToLower(typeLine)
	switch {
	case strings.Contains(lower, "лёгкий доспех"):
		return "armor", "Лёгкий доспех", "light"
	case strings.Contains(lower, "средний доспех"):
		return "armor", "Средний доспех", "medium"
	case strings.Contains(lower, "тяжёлый доспех"):
		return "armor", "Тяжёлый доспех", "heavy"
	case strings.Contains(lower, "щит"):
		return "armor", "Щит", "shield"
	case strings.Contains(lower, "оружие"):
		return "weapon", titleCase(strings.TrimSpace(typeLine)), ""
	case strings.Contains(lower, "заклинательная фокусировка"):
		return "focus", "Заклинательная фокусировка", ""
	case strings.Contains(lower, "инструмент"):
		return "tool", titleCase(strings.TrimSpace(strings.Split(typeLine, "(")[0])), ""
	case strings.Contains(lower, "набор снаряжения"):
		return "gear", "Набор снаряжения", ""
	case strings.Contains(lower, "предмет снаряжения"):
		if looksLikeClothing(strings.ToLower(fallback.Title)) {
			return "clothing", "Предмет снаряжения", ""
		}
		return "gear", "Предмет снаряжения", ""
	default:
		return fallback.Category, fallback.Subcategory, fallback.ArmorType
	}
}

func looksLikeClothing(value string) bool {
	for _, token := range []string{"плащ", "одежд", "мант", "шляп", "шап", "ботин", "сапог", "перчат", "маск", "пончо"} {
		if strings.Contains(value, token) {
			return true
		}
	}
	return false
}

func titleCase(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	runes := []rune(value)
	runes[0] = []rune(strings.ToUpper(string(runes[0])))[0]
	return string(runes)
}

func parseRarityFromTypeLine(typeLine string) string {
	lower := strings.ToLower(typeLine)
	for _, rarity := range []string{"артефакт", "легендарный", "очень редкий", "редкий", "необычный", "обычный"} {
		if strings.Contains(lower, rarity) {
			return titleCase(rarity)
		}
	}
	return ""
}

func extractAttunementProperty(typeLine string) string {
	lower := strings.ToLower(typeLine)
	if strings.Contains(lower, "требуется настройка") {
		return "Требуется настройка"
	}
	return ""
}

func extractFeatureProperties(paramsHTML string) []string {
	matches := regexp.MustCompile(`(?s)<span class=['"]article-body__feature-name['"]>(.*?)</span>`).FindAllStringSubmatch(paramsHTML, -1)
	properties := make([]string, 0, len(matches))
	for _, match := range matches {
		property := normalizeWhitespace(stripHTML(match[1]))
		if property == "" {
			continue
		}
		properties = append(properties, property)
	}
	return uniqueStrings(properties)
}

func appendUniqueProperties(current []string, values ...string) []string {
	combined := append([]string(nil), current...)
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		combined = append(combined, value)
	}
	return uniqueStrings(combined)
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		key := strings.TrimSpace(value)
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, key)
	}
	return result
}

type parsedPriceMetadata struct {
	ok           bool
	min          float64
	max          float64
	midpoint     float64
	displayLabel string
}

func parsePriceMetadata(raw string) parsedPriceMetadata {
	label := normalizePriceLabel(raw)
	if label == "" {
		return parsedPriceMetadata{}
	}

	normalized := strings.ToLower(label)
	normalized = strings.ReplaceAll(normalized, "–", "-")
	normalized = strings.ReplaceAll(normalized, "—", "-")
	normalized = strings.ReplaceAll(normalized, "−", "-")

	unit := ""
	multiplier := 0.0
	switch {
	case strings.HasSuffix(normalized, "зм"):
		unit = "зм"
		multiplier = 1
	case strings.HasSuffix(normalized, "см"):
		unit = "см"
		multiplier = 0.1
	case strings.HasSuffix(normalized, "мм"):
		unit = "мм"
		multiplier = 0.01
	default:
		return parsedPriceMetadata{}
	}

	numeric := strings.TrimSpace(strings.TrimSuffix(normalized, unit))
	numeric = strings.ReplaceAll(numeric, " ", "")
	numeric = strings.ReplaceAll(numeric, "\u00a0", "")
	if numeric == "" {
		return parsedPriceMetadata{}
	}

	parseNumber := func(value string) (float64, error) {
		value = strings.ReplaceAll(value, ",", ".")
		return strconv.ParseFloat(value, 64)
	}

	min := 0.0
	max := 0.0
	if strings.Contains(numeric, "-") {
		parts := strings.SplitN(numeric, "-", 2)
		left, err := parseNumber(parts[0])
		if err != nil {
			return parsedPriceMetadata{}
		}
		right, err := parseNumber(parts[1])
		if err != nil {
			return parsedPriceMetadata{}
		}
		min = left * multiplier
		max = right * multiplier
	} else {
		value, err := parseNumber(numeric)
		if err != nil {
			return parsedPriceMetadata{}
		}
		min = value * multiplier
		max = min
	}

	return parsedPriceMetadata{
		ok:           true,
		min:          min,
		max:          max,
		midpoint:     (min + max) / 2,
		displayLabel: label,
	}
}

func normalizePriceLabel(value string) string {
	value = html.UnescapeString(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "\u00a0", " ")
	value = strings.ReplaceAll(value, "\u2009", " ")
	return normalizeWhitespace(value)
}

func parseWeightValue(raw string) *float64 {
	raw = normalizeWhitespace(strings.TrimSpace(strings.TrimSuffix(strings.ToLower(raw), "фнт.")))
	if raw == "" {
		return nil
	}
	raw = strings.ReplaceAll(raw, ",", ".")
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return nil
	}
	return floatPointer(value)
}

func parseArmorClassValue(raw string) *int {
	if raw == "" {
		return nil
	}
	match := regexp.MustCompile(`-?\d+`).FindString(raw)
	if match == "" {
		return nil
	}
	value, err := strconv.Atoi(match)
	if err != nil {
		return nil
	}
	return intPointer(value)
}

func parseDamageLabel(raw string) (string, string) {
	raw = normalizeWhitespace(raw)
	if raw == "" {
		return "", ""
	}
	parts := strings.SplitN(raw, ",", 2)
	if len(parts) == 1 {
		return parts[0], ""
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
}

func parseStrengthRequirement(paramsHTML string) *int {
	text := normalizeWhitespace(stripHTML(paramsHTML))
	match := regexp.MustCompile(`(?:значение силы меньше|силы меньше)\s+(\d+)`).FindStringSubmatch(strings.ToLower(text))
	if len(match) < 2 {
		return nil
	}
	value, err := strconv.Atoi(match[1])
	if err != nil {
		return nil
	}
	return intPointer(value)
}

func parseStealthDisadvantage(paramsHTML string) *bool {
	text := strings.ToLower(normalizeWhitespace(stripHTML(paramsHTML)))
	if strings.Contains(text, "скрытность") && strings.Contains(text, "помех") {
		return boolPointer(true)
	}
	return nil
}

func sanitizeItemDescriptionHTML(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	replacements := []*regexp.Regexp{
		regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`),
		regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`),
		regexp.MustCompile(`(?is)<!--.*?-->`),
	}
	for _, pattern := range replacements {
		value = pattern.ReplaceAllString(value, "")
	}

	value = regexp.MustCompile(`(?is)<a[^>]*>(.*?)</a>`).ReplaceAllString(value, `$1`)
	value = regexp.MustCompile(`(?is)<span[^>]*>(.*?)</span>`).ReplaceAllString(value, `$1`)
	value = regexp.MustCompile(`(?is)<div[^>]*>(.*?)</div>`).ReplaceAllString(value, `$1`)
	value = regexp.MustCompile(`(?is)<(p|ul|ol|li|table|tbody|thead|tr|td|th|em|strong|b|i|br)[^>]*>`).ReplaceAllString(value, `<$1>`)
	value = strings.ReplaceAll(value, "\r", "")
	return strings.TrimSpace(value)
}

func htmlBlockToPlainText(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	value := raw
	replacements := []struct {
		old *regexp.Regexp
		new string
	}{
		{regexp.MustCompile(`(?is)</p>`), "\n\n"},
		{regexp.MustCompile(`(?is)</li>`), "\n"},
		{regexp.MustCompile(`(?is)</tr>`), "\n"},
		{regexp.MustCompile(`(?is)</td>`), " | "},
		{regexp.MustCompile(`(?is)<br\s*/?>`), "\n"},
	}
	for _, replacement := range replacements {
		value = replacement.old.ReplaceAllString(value, replacement.new)
	}
	value = stripHTML(value)
	value = regexp.MustCompile(`\n{3,}`).ReplaceAllString(value, "\n\n")
	return strings.TrimSpace(value)
}

func itemDescriptionExcerpt(descriptionHTML string, fallback string) string {
	text := htmlBlockToPlainText(descriptionHTML)
	if text == "" {
		return fallback
	}
	if len([]rune(text)) <= 220 {
		return text
	}
	runes := []rune(text)
	return strings.TrimSpace(string(runes[:219])) + "…"
}

func buildSummaryPlaceholder(typeLabel string, rarity string) string {
	parts := filterNonEmpty([]string{typeLabel, rarity})
	if len(parts) == 0 {
		return "Предмет из справочника"
	}
	return strings.Join(parts, " • ")
}

func formatPriceRangeLabel(min float64, max float64) string {
	if almostEqual(min, max) {
		return formatGoldValue(min)
	}
	return fmt.Sprintf("%s-%s", formatGoldValue(min), formatGoldValue(max))
}

func formatGoldValue(value float64) string {
	totalCopper := int(math.Round(value * 100))
	gold := totalCopper / 100
	silver := (totalCopper % 100) / 10
	copper := totalCopper % 10

	parts := make([]string, 0, 3)
	if gold > 0 {
		parts = append(parts, formatIntWithSpace(gold)+" зм")
	}
	if silver > 0 {
		parts = append(parts, formatIntWithSpace(silver)+" см")
	}
	if copper > 0 {
		parts = append(parts, formatIntWithSpace(copper)+" мм")
	}
	if len(parts) == 0 {
		return "0 мм"
	}
	return strings.Join(parts, " ")
}

func formatIntWithSpace(value int) string {
	raw := strconv.Itoa(value)
	if len(raw) <= 3 {
		return raw
	}
	parts := make([]string, 0, (len(raw)+2)/3)
	for len(raw) > 3 {
		parts = append([]string{raw[len(raw)-3:]}, parts...)
		raw = raw[:len(raw)-3]
	}
	if raw != "" {
		parts = append([]string{raw}, parts...)
	}
	return strings.Join(parts, " ")
}

func almostEqual(left float64, right float64) bool {
	return math.Abs(left-right) < 0.0001
}

func floatPointer(value float64) *float64 {
	copy := value
	return &copy
}

func intPointer(value int) *int {
	copy := value
	return &copy
}

func boolPointer(value bool) *bool {
	copy := value
	return &copy
}
