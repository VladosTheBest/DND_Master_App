package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	dndsuBaseURL       = "https://dnd.su"
	dndsuBestiaryIndex = dndsuBaseURL + "/piece/bestiary/index-list/?content=multiverse"
)

type bestiarySyncState string

const (
	bestiarySyncIdle    bestiarySyncState = "idle"
	bestiarySyncSyncing bestiarySyncState = "syncing"
	bestiarySyncReady   bestiarySyncState = "ready"
	bestiarySyncError   bestiarySyncState = "error"
)

type bestiaryFilterOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
	Count int    `json:"count,omitempty"`
}

type bestiaryFilters struct {
	Challenges []bestiaryFilterOption `json:"challenges"`
	Types      []bestiaryFilterOption `json:"types"`
}

type bestiarySyncStatus struct {
	State          string `json:"state"`
	Total          int    `json:"total"`
	Hydrated       int    `json:"hydrated"`
	LastError      string `json:"lastError,omitempty"`
	LastStartedAt  string `json:"lastStartedAt,omitempty"`
	LastFinishedAt string `json:"lastFinishedAt,omitempty"`
	UpdatedAt      string `json:"updatedAt,omitempty"`
}

type bestiaryMonsterSummary struct {
	ID                string   `json:"id"`
	RemoteID          string   `json:"remoteId"`
	Slug              string   `json:"slug"`
	Title             string   `json:"title"`
	EnglishTitle      string   `json:"englishTitle,omitempty"`
	Subtitle          string   `json:"subtitle"`
	Summary           string   `json:"summary"`
	Challenge         string   `json:"challenge"`
	CreatureType      string   `json:"creatureType"`
	CreatureTypeLabel string   `json:"creatureTypeLabel"`
	Size              string   `json:"size"`
	Source            string   `json:"source"`
	URL               string   `json:"url"`
	NamedNPC          bool     `json:"namedNpc"`
	Classic           bool     `json:"classic"`
	Tags              []string `json:"tags,omitempty"`
	ImageURL          string   `json:"imageUrl,omitempty"`
}

type bestiaryListResult struct {
	Items   []bestiaryMonsterSummary `json:"items"`
	Filters bestiaryFilters          `json:"filters"`
	Status  bestiarySyncStatus       `json:"status"`
	Total   int                      `json:"total"`
}

type bestiaryMonsterDetail struct {
	Summary   bestiaryMonsterSummary `json:"summary"`
	Monster   knowledgeEntity        `json:"monster"`
	SourceURL string                 `json:"sourceUrl"`
	Status    bestiarySyncStatus     `json:"status"`
}

type bestiaryQuery struct {
	Query     string
	Challenge string
	Type      string
	NamedNPC  bool
	Classic   bool
}

type bestiaryCache struct {
	UpdatedAt string                 `json:"updatedAt"`
	Sync      bestiarySyncStatus     `json:"sync"`
	Entries   []bestiaryMonsterCache `json:"entries"`
}

type bestiaryMonsterCache struct {
	ID                string                `json:"id"`
	RemoteID          string                `json:"remoteId"`
	Slug              string                `json:"slug"`
	Title             string                `json:"title"`
	EnglishTitle      string                `json:"englishTitle,omitempty"`
	Subtitle          string                `json:"subtitle"`
	Summary           string                `json:"summary"`
	Challenge         string                `json:"challenge"`
	ChallengeSort     float64               `json:"challengeSort"`
	CreatureType      string                `json:"creatureType,omitempty"`
	CreatureTypeLabel string                `json:"creatureTypeLabel,omitempty"`
	Size              string                `json:"size,omitempty"`
	Alignment         string                `json:"alignment,omitempty"`
	Source            string                `json:"source,omitempty"`
	URL               string                `json:"url"`
	SearchText        string                `json:"searchText"`
	NamedNPC          bool                  `json:"namedNpc,omitempty"`
	Classic           bool                  `json:"classic,omitempty"`
	ImageURL          string                `json:"imageUrl,omitempty"`
	LastSyncedAt      string                `json:"lastSyncedAt,omitempty"`
	Monster           *knowledgeEntity      `json:"monster,omitempty"`
	RewardProfile     *monsterRewardProfile `json:"rewardProfile,omitempty"`
}

type bestiaryCatalog struct {
	mu             sync.RWMutex
	path           string
	client         *http.Client
	cache          bestiaryCache
	backgroundKick atomic.Bool
}

func newBestiaryCatalog(path string) (*bestiaryCatalog, error) {
	if strings.TrimSpace(path) == "" {
		return &bestiaryCatalog{
			client: &http.Client{Timeout: 20 * time.Second},
			cache: bestiaryCache{
				Sync: bestiarySyncStatus{State: string(bestiarySyncIdle)},
			},
		}, nil
	}

	catalog := &bestiaryCatalog{
		path:   path,
		client: &http.Client{Timeout: 20 * time.Second},
		cache: bestiaryCache{
			Sync: bestiarySyncStatus{State: string(bestiarySyncIdle)},
		},
	}

	if err := catalog.load(); err != nil {
		return nil, err
	}

	if err := catalog.syncIndex(); err != nil && len(catalog.cache.Entries) == 0 {
		return nil, err
	}

	catalog.startBackgroundHydration()
	return catalog, nil
}

func (catalog *bestiaryCatalog) load() error {
	if catalog.path == "" {
		return nil
	}

	if _, err := os.Stat(catalog.path); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}

	raw, err := os.ReadFile(catalog.path)
	if err != nil {
		return err
	}

	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	if len(raw) == 0 {
		return nil
	}

	var cache bestiaryCache
	if err := json.Unmarshal(raw, &cache); err != nil {
		return err
	}

	cache.Sync.Total = len(cache.Entries)
	cache.Sync.Hydrated = countHydratedEntries(cache.Entries)
	if cache.Sync.State == "" {
		cache.Sync.State = string(bestiarySyncIdle)
	}
	catalog.cache = cache
	return nil
}

func (catalog *bestiaryCatalog) saveLocked() error {
	if catalog.path == "" {
		return nil
	}

	catalog.cache.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	catalog.cache.Sync.UpdatedAt = catalog.cache.UpdatedAt

	if err := os.MkdirAll(filepath.Dir(catalog.path), 0o755); err != nil {
		return err
	}

	body, err := json.MarshalIndent(catalog.cache, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(catalog.path, body, 0o644)
}

func (catalog *bestiaryCatalog) syncIndex() error {
	body, err := catalog.fetchURL(dndsuBestiaryIndex)
	if err != nil {
		catalog.recordIndexError(err)
		return err
	}

	parsed, err := parseDndsuBestiaryIndex(body)
	if err != nil {
		catalog.recordIndexError(err)
		return err
	}

	existingByID := map[string]bestiaryMonsterCache{}
	catalog.mu.RLock()
	for _, entry := range catalog.cache.Entries {
		existingByID[entry.ID] = entry
	}
	catalog.mu.RUnlock()

	merged := make([]bestiaryMonsterCache, 0, len(parsed))
	for _, entry := range parsed {
		if existing, ok := existingByID[entry.ID]; ok {
			entry.CreatureType = firstNonEmpty(existing.CreatureType, entry.CreatureType)
			entry.CreatureTypeLabel = firstNonEmpty(existing.CreatureTypeLabel, entry.CreatureTypeLabel)
			entry.Size = firstNonEmpty(existing.Size, entry.Size)
			entry.Alignment = firstNonEmpty(existing.Alignment, entry.Alignment)
			entry.Source = firstNonEmpty(existing.Source, entry.Source)
			entry.ImageURL = firstNonEmpty(existing.ImageURL, entry.ImageURL)
			entry.LastSyncedAt = existing.LastSyncedAt
			entry.Monster = existing.Monster
			entry.RewardProfile = existing.RewardProfile
			if entry.Subtitle == "" {
				entry.Subtitle = existing.Subtitle
			}
			if entry.Summary == "" {
				entry.Summary = existing.Summary
			}
		}
		merged = append(merged, entry)
	}

	sort.SliceStable(merged, func(i, j int) bool {
		return strings.ToLower(merged[i].Title) < strings.ToLower(merged[j].Title)
	})

	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	catalog.cache.Entries = merged
	catalog.cache.Sync.Total = len(merged)
	catalog.cache.Sync.Hydrated = countHydratedEntries(merged)
	catalog.cache.Sync.LastError = ""
	catalog.cache.Sync.State = string(bestiarySyncReady)
	if catalog.cache.Sync.Hydrated < len(merged) {
		catalog.cache.Sync.State = string(bestiarySyncSyncing)
	}
	catalog.cache.Sync.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return catalog.saveLocked()
}

func (catalog *bestiaryCatalog) startBackgroundHydration() {
	if !catalog.backgroundKick.CompareAndSwap(false, true) {
		return
	}

	go catalog.hydratePendingEntries()
}

func (catalog *bestiaryCatalog) hydratePendingEntries() {
	catalog.mu.Lock()
	catalog.cache.Sync.State = string(bestiarySyncSyncing)
	catalog.cache.Sync.LastStartedAt = time.Now().UTC().Format(time.RFC3339)
	_ = catalog.saveLocked()
	pending := make([]string, 0, len(catalog.cache.Entries))
	for _, entry := range catalog.cache.Entries {
		if entry.Monster == nil {
			pending = append(pending, entry.ID)
		}
	}
	catalog.mu.Unlock()

	if len(pending) == 0 {
		catalog.mu.Lock()
		catalog.cache.Sync.State = string(bestiarySyncReady)
		catalog.cache.Sync.LastFinishedAt = time.Now().UTC().Format(time.RFC3339)
		_ = catalog.saveLocked()
		catalog.mu.Unlock()
		return
	}

	sem := make(chan struct{}, 5)
	var wg sync.WaitGroup
	for _, id := range pending {
		wg.Add(1)
		go func(monsterID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			if _, err := catalog.fetchAndStoreDetail(monsterID); err != nil {
				catalog.recordDetailError(err)
			}
			time.Sleep(70 * time.Millisecond)
		}(id)
	}
	wg.Wait()

	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	catalog.cache.Sync.Hydrated = countHydratedEntries(catalog.cache.Entries)
	catalog.cache.Sync.LastFinishedAt = time.Now().UTC().Format(time.RFC3339)
	if catalog.cache.Sync.Hydrated == len(catalog.cache.Entries) {
		catalog.cache.Sync.State = string(bestiarySyncReady)
	} else {
		catalog.cache.Sync.State = string(bestiarySyncError)
	}
	_ = catalog.saveLocked()
}

func (catalog *bestiaryCatalog) browse(query bestiaryQuery) bestiaryListResult {
	catalog.mu.RLock()
	entries := append([]bestiaryMonsterCache(nil), catalog.cache.Entries...)
	status := catalog.cache.Sync
	catalog.mu.RUnlock()

	filtered := make([]bestiaryMonsterSummary, 0, len(entries))
	for _, entry := range entries {
		if !matchBestiaryQuery(entry, query) {
			continue
		}
		filtered = append(filtered, summaryFromBestiaryCache(entry))
	}

	return bestiaryListResult{
		Items:   filtered,
		Filters: buildBestiaryFilters(entries),
		Status:  status,
		Total:   len(filtered),
	}
}

func (catalog *bestiaryCatalog) getMonster(id string) (bestiaryMonsterDetail, error) {
	if detail, ok := catalog.getCachedMonster(id); ok && detail.Monster.ID != "" {
		return detail, nil
	}

	cacheEntry, err := catalog.fetchAndStoreDetail(id)
	if err != nil {
		return bestiaryMonsterDetail{}, err
	}

	catalog.mu.RLock()
	status := catalog.cache.Sync
	catalog.mu.RUnlock()

	return bestiaryMonsterDetail{
		Summary:   summaryFromBestiaryCache(cacheEntry),
		Monster:   *cacheEntry.Monster,
		SourceURL: cacheEntry.URL,
		Status:    status,
	}, nil
}

func (catalog *bestiaryCatalog) getCachedMonster(id string) (bestiaryMonsterDetail, bool) {
	catalog.mu.RLock()
	defer catalog.mu.RUnlock()

	for _, entry := range catalog.cache.Entries {
		if entry.ID != id {
			continue
		}
		if entry.Monster == nil {
			return bestiaryMonsterDetail{}, false
		}

		return bestiaryMonsterDetail{
			Summary:   summaryFromBestiaryCache(entry),
			Monster:   *entry.Monster,
			SourceURL: entry.URL,
			Status:    catalog.cache.Sync,
		}, true
	}

	return bestiaryMonsterDetail{}, false
}

func (catalog *bestiaryCatalog) fetchAndStoreDetail(id string) (bestiaryMonsterCache, error) {
	catalog.mu.RLock()
	var target bestiaryMonsterCache
	var found bool
	for _, entry := range catalog.cache.Entries {
		if entry.ID == id {
			target = entry
			found = true
			break
		}
	}
	catalog.mu.RUnlock()

	if !found {
		return bestiaryMonsterCache{}, fmt.Errorf("bestiary monster %q not found", id)
	}

	if target.Monster != nil {
		return target, nil
	}

	body, err := catalog.fetchURL(target.URL)
	if err != nil {
		return bestiaryMonsterCache{}, err
	}

	detail, err := parseDndsuBestiaryDetail(target, body)
	if err != nil {
		return bestiaryMonsterCache{}, err
	}

	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	for index := range catalog.cache.Entries {
		if catalog.cache.Entries[index].ID != id {
			continue
		}
		catalog.cache.Entries[index] = detail
		catalog.cache.Sync.Hydrated = countHydratedEntries(catalog.cache.Entries)
		catalog.cache.Sync.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if catalog.cache.Sync.Hydrated == len(catalog.cache.Entries) {
			catalog.cache.Sync.State = string(bestiarySyncReady)
		}
		_ = catalog.saveLocked()
		return detail, nil
	}

	return bestiaryMonsterCache{}, fmt.Errorf("bestiary monster %q disappeared during sync", id)
}

func (catalog *bestiaryCatalog) fetchURL(rawURL string) (string, error) {
	request, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("User-Agent", "ShadowEdgeGM/1.0 (+https://localhost)")

	response, err := catalog.client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("dnd.su request failed with status %d for %s", response.StatusCode, rawURL)
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return "", err
	}

	return string(body), nil
}

func (catalog *bestiaryCatalog) recordIndexError(err error) {
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	catalog.cache.Sync.State = string(bestiarySyncError)
	catalog.cache.Sync.LastError = err.Error()
	catalog.cache.Sync.LastFinishedAt = time.Now().UTC().Format(time.RFC3339)
	_ = catalog.saveLocked()
}

func (catalog *bestiaryCatalog) recordDetailError(err error) {
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	catalog.cache.Sync.State = string(bestiarySyncSyncing)
	catalog.cache.Sync.LastError = err.Error()
	catalog.cache.Sync.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	_ = catalog.saveLocked()
}

func countHydratedEntries(entries []bestiaryMonsterCache) int {
	total := 0
	for _, entry := range entries {
		if entry.Monster != nil {
			total++
		}
	}
	return total
}

func buildBestiaryFilters(entries []bestiaryMonsterCache) bestiaryFilters {
	challengeCounts := map[string]int{}
	typeCounts := map[string]int{}
	for _, entry := range entries {
		if entry.Challenge != "" {
			challengeCounts[entry.Challenge]++
		}
		if entry.CreatureTypeLabel != "" {
			typeCounts[entry.CreatureTypeLabel]++
		}
	}

	challenges := make([]bestiaryFilterOption, 0, len(challengeCounts))
	for challenge, count := range challengeCounts {
		challenges = append(challenges, bestiaryFilterOption{Value: challenge, Label: challenge, Count: count})
	}
	sort.SliceStable(challenges, func(i, j int) bool {
		return challengeSortValue(challenges[i].Value) < challengeSortValue(challenges[j].Value)
	})

	types := make([]bestiaryFilterOption, 0, len(typeCounts))
	for creatureType, count := range typeCounts {
		types = append(types, bestiaryFilterOption{Value: creatureType, Label: creatureType, Count: count})
	}
	sort.SliceStable(types, func(i, j int) bool {
		return strings.ToLower(types[i].Label) < strings.ToLower(types[j].Label)
	})

	return bestiaryFilters{Challenges: challenges, Types: types}
}

func matchBestiaryQuery(entry bestiaryMonsterCache, query bestiaryQuery) bool {
	if query.NamedNPC && !entry.NamedNPC {
		return false
	}
	if query.Classic && !entry.Classic {
		return false
	}
	if strings.TrimSpace(query.Challenge) != "" && !strings.EqualFold(strings.TrimSpace(query.Challenge), strings.TrimSpace(entry.Challenge)) {
		return false
	}
	if strings.TrimSpace(query.Type) != "" && !strings.EqualFold(strings.TrimSpace(query.Type), strings.TrimSpace(entry.CreatureTypeLabel)) {
		return false
	}
	if strings.TrimSpace(query.Query) == "" {
		return true
	}

	return strings.Contains(normalizeEntityTitle(entry.SearchText), normalizeEntityTitle(query.Query))
}

func summaryFromBestiaryCache(entry bestiaryMonsterCache) bestiaryMonsterSummary {
	imageURL := entry.ImageURL
	tags := []string{}
	if entry.Monster != nil {
		tags = entry.Monster.Tags
		if imageURL == "" && entry.Monster.Art != nil {
			imageURL = entry.Monster.Art.URL
		}
	}

	return bestiaryMonsterSummary{
		ID:                entry.ID,
		RemoteID:          entry.RemoteID,
		Slug:              entry.Slug,
		Title:             entry.Title,
		EnglishTitle:      entry.EnglishTitle,
		Subtitle:          entry.Subtitle,
		Summary:           entry.Summary,
		Challenge:         entry.Challenge,
		CreatureType:      entry.CreatureType,
		CreatureTypeLabel: entry.CreatureTypeLabel,
		Size:              entry.Size,
		Source:            entry.Source,
		URL:               entry.URL,
		NamedNPC:          entry.NamedNPC,
		Classic:           entry.Classic,
		Tags:              tags,
		ImageURL:          imageURL,
	}
}

func resolveDndsuURL(raw string) string {
	value := strings.TrimSpace(html.UnescapeString(raw))
	switch {
	case value == "":
		return ""
	case strings.HasPrefix(value, "//"):
		return "https:" + value
	case strings.HasPrefix(value, "/"):
		return dndsuBaseURL + value
	default:
		return value
	}
}

var bestiaryIndexItemPattern = regexp.MustCompile(`(?s)<div class='col list-item__beast for_filter'[^>]*data-search='([^']*)'[^>]*data-id='([^']*)'[^>]*>\s*<a href='([^']*)'[^>]*>\s*<span class='list-mark__danger'>\[\s*<span>([^<]+)</span>\s*\]</span>\s*<div class='list-item-title'>(.*?)</div>(.*?)</a>`)

func parseDndsuBestiaryIndex(body string) ([]bestiaryMonsterCache, error) {
	matches := bestiaryIndexItemPattern.FindAllStringSubmatch(body, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("dnd.su bestiary index markup did not match expected pattern")
	}

	entries := make([]bestiaryMonsterCache, 0, len(matches))
	for _, match := range matches {
		searchText := html.UnescapeString(strings.TrimSpace(match[1]))
		remoteID := strings.TrimSpace(match[2])
		href := strings.TrimSpace(match[3])
		challenge := strings.TrimSpace(stripHTML(match[4]))
		title := strings.TrimSpace(stripHTML(match[5]))
		flagsHTML := match[6]

		if remoteID == "" || title == "" || href == "" {
			continue
		}

		url := resolveDndsuURL(href)
		slug := strings.Trim(strings.TrimPrefix(href, "/bestiary/"), "/")
		if dash := strings.Index(slug, "-"); dash >= 0 {
			slug = slug[dash+1:]
		}
		imageURL := resolveDndsuURL(findFirstSubmatch(match[0], `(?i)<img[^>]+src=['"]([^'"]+)`))

		titleParts := strings.Split(searchText, ",")
		englishTitle := ""
		if len(titleParts) > 1 {
			englishTitle = strings.TrimSpace(titleParts[1])
		}
		subtitle := strings.TrimSpace(strings.Join(filterNonEmpty([]string{
			englishTitle,
			firstNonEmpty(challenge, "CR неизвестен"),
		}), " • "))
		if subtitle == "" {
			subtitle = "Официальный монстр dnd.su"
		}

		entries = append(entries, bestiaryMonsterCache{
			ID:            remoteID,
			RemoteID:      remoteID,
			Slug:          slug,
			Title:         title,
			EnglishTitle:  englishTitle,
			Subtitle:      subtitle,
			Summary:       "Официальный монстр dnd.su. Детальная карточка подтянется в кэш при синхронизации или при первом открытии.",
			Challenge:     challenge,
			ChallengeSort: challengeSortValue(challenge),
			ImageURL:      imageURL,
			URL:           url,
			SearchText:    strings.TrimSpace(searchText + " " + title + " " + englishTitle + " " + challenge),
			NamedNPC:      strings.Contains(flagsHTML, "list-icon__npc"),
			Classic:       strings.Contains(flagsHTML, "list-icon__classic"),
		})
	}

	return entries, nil
}

func parseDndsuBestiaryDetail(base bestiaryMonsterCache, body string) (bestiaryMonsterCache, error) {
	metaTitle := findMetaContent(body, "og:title")
	metaDescription := findMetaContent(body, "og:description")
	metaImage := resolveDndsuURL(findMetaContent(body, "og:image"))
	cardTitleHTML := findFirstSubmatch(body, `(?s)<h2 class="card-title[^"]*">(.*?)</h2>`)
	cardTitleText := strings.TrimSpace(stripHTML(cardTitleHTML))

	englishTitle := base.EnglishTitle
	if inner := findFirstSubmatch(cardTitleText, `\[(.*?)\]`); inner != "" {
		englishTitle = strings.TrimSpace(inner)
	}

	source := strings.TrimSpace(sourceFromOgTitle(metaTitle))
	if source == "" {
		source = strings.TrimSpace(sourceFromCardTitle(cardTitleText))
	}

	sizeTypeAlignmentText := strings.TrimSpace(stripHTML(findFirstSubmatch(body, `(?s)<li class='size-type-alignment'>(.*?)</li>`)))
	size, creatureTypeLabel, alignment := parseSizeTypeAlignment(sizeTypeAlignmentText)

	abilityScores := parseAbilityScoresBlock(body)
	details := parseMonsterDetailList(body)
	traits, sections := parseSubsections(body)
	actions := parseStatEntries(sections["Действия"])
	bonusActions := parseStatEntries(sections["Бонусные действия"])
	reactions := parseStatEntries(sections["Реакции"])

	descriptionParts := []string{}
	if text := cleanParagraphBlock(sections["Описание"]); text != "" {
		descriptionParts = append(descriptionParts, text)
	}
	for title, content := range sections {
		if title == "" || title == "Действия" || title == "Бонусные действия" || title == "Реакции" || title == "Описание" {
			continue
		}
		clean := cleanParagraphBlock(content)
		if clean == "" {
			continue
		}
		descriptionParts = append(descriptionParts, title+"\n"+clean)
	}

	summary := strings.TrimSpace(metaDescription)
	if summary == "" {
		summary = firstNonEmpty(base.Summary, "Официальный монстр из dnd.su.")
	}

	statBlock := &npcStatBlock{
		Size:             firstNonEmpty(size, base.Size, "Средний"),
		CreatureType:     firstNonEmpty(creatureTypeLabel, base.CreatureTypeLabel, "Существо"),
		Alignment:        firstNonEmpty(alignment, "без мировоззрения"),
		ArmorClass:       details["Класс Доспеха"],
		HitPoints:        details["Хиты"],
		Speed:            details["Скорость"],
		ProficiencyBonus: parseProficiencyBonus(body, details),
		Challenge:        normalizeChallenge(details["Опасность"]),
		Senses:           details["Чувства"],
		Languages:        details["Языки"],
		SavingThrows:     details["Спасброски"],
		Skills:           details["Навыки"],
		Resistances:      details["Сопротивление урону"],
		Immunities:       combineNonEmpty(details["Иммунитет к урону"], details["Иммунитет к урону:"]),
		ConditionImmunities: combineNonEmpty(
			details["Иммунитет к состоянию"],
			details["Иммунитет к состояниям"],
		),
		AbilityScores: abilityScores,
		Traits:        parseStatEntries(traits),
		Actions:       actions,
	}
	if len(bonusActions) > 0 {
		statBlock.BonusActions = bonusActions
	}
	if len(reactions) > 0 {
		statBlock.Reactions = reactions
	}

	quickFacts := []quickFact{
		{Label: "Опасность", Value: firstNonEmpty(statBlock.Challenge, base.Challenge)},
		{Label: "Вид", Value: firstNonEmpty(creatureTypeLabel, base.CreatureTypeLabel, "Существо")},
		{Label: "Скорость", Value: firstNonEmpty(statBlock.Speed, "не указана")},
	}
	if source != "" {
		quickFacts = append(quickFacts, quickFact{Label: "Источник", Value: source})
	}

	subtitle := strings.Join(filterNonEmpty([]string{
		englishTitle,
		source,
	}), " • ")
	if subtitle == "" {
		subtitle = firstNonEmpty(base.Subtitle, "Официальный монстр dnd.su")
	}

	reward := defaultMonsterRewardProfile(strings.ToLower(base.Title+" "+creatureTypeLabel), base.Title)

	monster := knowledgeEntity{
		ID:       base.ID,
		Kind:     "monster",
		Title:    base.Title,
		Subtitle: subtitle,
		Summary:  summary,
		Content:  strings.Join(filterNonEmpty(descriptionParts), "\n\n"),
		Tags: filterNonEmpty([]string{
			"dndsu",
			"official-bestiary",
			normalizeEntityTitle(creatureTypeLabel),
			normalizeEntityTitle(source),
		}),
		QuickFacts:    quickFacts,
		Related:       []relatedEntity{},
		Role:          "Официальный бестиарий",
		Status:        "Hostile",
		Importance:    "Standard",
		StatBlock:     statBlock,
		RewardProfile: reward,
	}
	if imageURL := firstNonEmpty(metaImage, base.ImageURL); imageURL != "" {
		monster.Art = &heroArt{URL: imageURL, Alt: base.Title}
	}

	base.EnglishTitle = englishTitle
	base.Subtitle = subtitle
	base.Summary = summary
	base.Source = source
	base.Size = statBlock.Size
	base.CreatureType = normalizeEntityTitle(creatureTypeLabel)
	base.CreatureTypeLabel = creatureTypeLabel
	base.Alignment = statBlock.Alignment
	base.ImageURL = firstNonEmpty(metaImage, base.ImageURL)
	base.LastSyncedAt = time.Now().UTC().Format(time.RFC3339)
	base.Monster = &monster
	base.RewardProfile = reward
	return base, nil
}

func parseAbilityScoresBlock(body string) abilityScores {
	result := abilityScores{STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10}
	block := findFirstSubmatch(body, `(?s)<li class='abilities'>(.*?)</li>`)
	if block == "" {
		return result
	}

	pattern := regexp.MustCompile(`(?s)<div class='stat'[^>]*><div>([^<]+)</div><div>(\d+)`)
	for _, match := range pattern.FindAllStringSubmatch(block, -1) {
		label := strings.TrimSpace(stripHTML(match[1]))
		score, err := strconv.Atoi(match[2])
		if err != nil {
			continue
		}

		switch label {
		case "Сил":
			result.STR = score
		case "Лов":
			result.DEX = score
		case "Тел":
			result.CON = score
		case "Инт":
			result.INT = score
		case "Мдр":
			result.WIS = score
		case "Хар":
			result.CHA = score
		}
	}

	return result
}

func parseMonsterDetailList(body string) map[string]string {
	result := map[string]string{}
	pattern := regexp.MustCompile(`(?s)<li class='[^']*'><strong>([^<]+)</strong>\s*(.*?)</li>`)
	for _, match := range pattern.FindAllStringSubmatch(body, -1) {
		label := strings.TrimSpace(stripHTML(match[1]))
		value := normalizeWhitespace(stripHTML(match[2]))
		if label == "" || value == "" {
			continue
		}
		result[label] = value
	}
	return result
}

func parseSubsections(body string) (string, map[string]string) {
	result := map[string]string{}
	traits := ""
	pattern := regexp.MustCompile(`(?s)<li class="subsection desc">(.*?)</li>`)
	matches := pattern.FindAllStringSubmatch(body, -1)
	for _, match := range matches {
		block := match[1]
		title := strings.TrimSpace(stripHTML(findFirstSubmatch(block, `(?s)<h3 class="subsection-title">(.*?)</h3>`)))
		cleaned := cleanParagraphBlock(block)
		if cleaned == "" {
			continue
		}
		if title == "" && traits == "" {
			traits = block
			continue
		}
		if title == "" {
			title = "Дополнительно"
		}
		if existing := result[title]; existing != "" {
			result[title] = existing + "\n\n" + block
		} else {
			result[title] = block
		}
	}
	return traits, result
}

func parseStatEntries(sectionHTML string) []statBlockEntry {
	if strings.TrimSpace(sectionHTML) == "" {
		return []statBlockEntry{}
	}

	paragraphPattern := regexp.MustCompile(`(?s)<p>(.*?)</p>`)
	paragraphs := paragraphPattern.FindAllStringSubmatch(sectionHTML, -1)
	entries := make([]statBlockEntry, 0, len(paragraphs))
	for _, paragraph := range paragraphs {
		raw := paragraph[1]
		plain := normalizeWhitespace(stripHTML(raw))
		if plain == "" {
			continue
		}

		name := strings.TrimSpace(stripHTML(findFirstSubmatch(raw, `(?s)<strong>(.*?)</strong>`)))
		name = strings.TrimSuffix(name, ".")
		description := strings.TrimSpace(plain)
		if name != "" {
			description = strings.TrimSpace(strings.TrimPrefix(description, name))
			description = strings.TrimLeft(description, ".: ")
		}

		entry := statBlockEntry{
			Name:        firstNonEmpty(name, "Способность"),
			Description: firstNonEmpty(description, plain),
		}
		if toHit := findFirstSubmatch(plain, `([+\-]\d+\s*к попаданию)`); toHit != "" {
			entry.ToHit = strings.TrimSpace(toHit)
		}
		if saveDC := findFirstSubmatch(plain, `(Сл\s*\d+\s*[А-Яа-яA-Za-z]+)`); saveDC != "" {
			entry.SaveDC = strings.TrimSpace(saveDC)
		}
		if damage := extractDamageSnippet(plain); damage != "" {
			entry.Damage = damage
		}

		entries = append(entries, entry)
	}
	return entries
}

func parseSizeTypeAlignment(value string) (string, string, string) {
	if value == "" {
		return "", "", ""
	}

	parts := strings.SplitN(value, ",", 2)
	sizeAndType := strings.Fields(strings.TrimSpace(parts[0]))
	size := ""
	creatureType := ""
	if len(sizeAndType) > 0 {
		size = sizeAndType[0]
	}
	if len(sizeAndType) > 1 {
		creatureType = strings.TrimSpace(strings.Join(sizeAndType[1:], " "))
	}
	alignment := ""
	if len(parts) > 1 {
		alignment = strings.TrimSpace(parts[1])
	}
	return size, creatureType, alignment
}

func parseProficiencyBonus(body string, details map[string]string) string {
	if value, ok := details["Бонус мастерства"]; ok {
		return normalizeWhitespace(value)
	}
	if direct := findFirstSubmatch(body, `<strong>Бонус мастерства\s*([+\-]?\d+)</strong>`); direct != "" {
		if strings.HasPrefix(direct, "+") || strings.HasPrefix(direct, "-") {
			return direct
		}
		return "+" + direct
	}
	return ""
}

func normalizeChallenge(value string) string {
	if value == "" {
		return ""
	}
	trimmed := strings.TrimSpace(value)
	if xp := parseChallengeExperience(trimmed); xp > 0 {
		token := strings.TrimSpace(trimmed)
		for _, separator := range []string{" ", "("} {
			if before, _, ok := strings.Cut(token, separator); ok {
				token = before
				break
			}
		}
		return fmt.Sprintf("%s (%d XP)", token, xp)
	}
	return trimmed
}

func extractDamageSnippet(value string) string {
	if value == "" {
		return ""
	}
	hitIndex := strings.Index(strings.ToLower(value), "попадание")
	if hitIndex >= 0 {
		snippet := strings.TrimSpace(value[hitIndex+len("попадание"):])
		snippet = strings.TrimLeft(snippet, " :")
		if dot := strings.Index(snippet, ". "); dot >= 0 {
			snippet = snippet[:dot]
		}
		return strings.TrimSpace(snippet)
	}
	return strings.TrimSpace(findFirstSubmatch(value, `(\d+\s*\([^)]+\)\s*[А-Яа-яA-Za-zёЁ\s]+урона)`))
}

func challengeSortValue(raw string) float64 {
	token := strings.TrimSpace(raw)
	if token == "" {
		return 999
	}
	if slash := strings.Index(token, " "); slash >= 0 {
		token = token[:slash]
	}
	if before, _, ok := strings.Cut(token, "("); ok {
		token = before
	}
	token = strings.TrimSpace(token)
	if strings.Contains(token, "/") {
		parts := strings.SplitN(token, "/", 2)
		if len(parts) == 2 {
			left, leftErr := strconv.ParseFloat(parts[0], 64)
			right, rightErr := strconv.ParseFloat(parts[1], 64)
			if leftErr == nil && rightErr == nil && right != 0 {
				return left / right
			}
		}
	}
	value, err := strconv.ParseFloat(token, 64)
	if err != nil {
		return 999
	}
	return value
}

func cleanParagraphBlock(block string) string {
	paragraphPattern := regexp.MustCompile(`(?s)<p>(.*?)</p>`)
	paragraphs := paragraphPattern.FindAllStringSubmatch(block, -1)
	clean := make([]string, 0, len(paragraphs))
	for _, paragraph := range paragraphs {
		text := normalizeWhitespace(stripHTML(paragraph[1]))
		if text == "" {
			continue
		}
		clean = append(clean, text)
	}
	return strings.Join(clean, "\n\n")
}

func findMetaContent(body string, property string) string {
	pattern := regexp.MustCompile(fmt.Sprintf(`<meta property="%s" content="([^"]+)"`, regexp.QuoteMeta(property)))
	return html.UnescapeString(strings.TrimSpace(findFirstSubmatch(body, pattern.String())))
}

func findFirstSubmatch(body string, pattern string) string {
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(body)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func sourceFromOgTitle(value string) string {
	parts := strings.Split(value, " / ")
	if len(parts) < 3 {
		return ""
	}
	return strings.TrimSpace(parts[2])
}

func sourceFromCardTitle(value string) string {
	if value == "" {
		return ""
	}
	if close := strings.Index(value, "]"); close >= 0 && close+1 < len(value) {
		return strings.TrimSpace(value[close+1:])
	}
	return ""
}

func stripHTML(value string) string {
	tagPattern := regexp.MustCompile(`(?s)<[^>]+>`)
	text := tagPattern.ReplaceAllString(value, " ")
	text = html.UnescapeString(text)
	text = strings.ReplaceAll(text, "\u00a0", " ")
	return normalizeWhitespace(text)
}

func normalizeWhitespace(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func filterNonEmpty(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		result = append(result, strings.TrimSpace(value))
	}
	return result
}

func combineNonEmpty(values ...string) string {
	return strings.Join(filterNonEmpty(values), " • ")
}
