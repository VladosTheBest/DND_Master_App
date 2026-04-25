package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var idSequence uint64

type campaignStore struct {
	mu   sync.RWMutex
	path string
	data storageState
}

func newCampaignStore(path string) (*campaignStore, error) {
	store := &campaignStore{path: path}

	if err := store.load(); err != nil {
		return nil, err
	}

	return store, nil
}

func (store *campaignStore) load() error {
	store.mu.Lock()
	defer store.mu.Unlock()

	state, repairedFromBackup, err := store.loadBestAvailableState()
	if err != nil {
		return err
	}
	store.data = state

	repairedEncoding := repairStorageEncoding(&store.data)

	if len(store.data.Campaigns) == 0 {
		store.data = starterState()
		return store.saveLocked()
	}

	for index := range store.data.Campaigns {
		store.data.Campaigns[index] = ensureCampaignShape(store.data.Campaigns[index])
	}

	if repairedFromBackup || repairedEncoding {
		return store.saveLocked()
	}

	return nil
}

func (store *campaignStore) saveLocked() error {
	store.data.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := os.MkdirAll(filepath.Dir(store.path), 0o755); err != nil {
		return err
	}

	body, err := json.MarshalIndent(store.data, "", "  ")
	if err != nil {
		return err
	}

	if err := writeFileAtomically(store.path, body, 0o644); err != nil {
		return err
	}
	if err := writeFileAtomically(store.backupPath(), body, 0o644); err != nil {
		return err
	}

	return nil
}

func (store *campaignStore) backupPath() string {
	return store.path + ".bak"
}

func (store *campaignStore) loadBestAvailableState() (storageState, bool, error) {
	primary, primaryErr := readStorageState(store.path)
	if primaryErr == nil {
		return primary, false, nil
	}

	backup, backupErr := readStorageState(store.backupPath())
	if backupErr == nil {
		return backup, true, nil
	}

	if errors.Is(primaryErr, os.ErrNotExist) && errors.Is(backupErr, os.ErrNotExist) {
		return starterState(), true, nil
	}

	if !errors.Is(primaryErr, os.ErrNotExist) {
		return storageState{}, false, primaryErr
	}

	return storageState{}, false, backupErr
}

func readStorageState(path string) (storageState, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return storageState{}, err
	}
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	if len(bytes.TrimSpace(raw)) == 0 {
		return storageState{}, fmt.Errorf("storage file %q is empty", path)
	}

	var state storageState
	if err := json.Unmarshal(raw, &state); err != nil {
		return storageState{}, fmt.Errorf("parse storage file %q: %w", path, err)
	}

	return state, nil
}

func writeFileAtomically(path string, body []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	file, err := os.CreateTemp(dir, filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}

	tempPath := file.Name()
	cleanupTemp := true
	defer func() {
		if cleanupTemp {
			_ = os.Remove(tempPath)
		}
	}()

	if _, err := file.Write(body); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Chmod(mode); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := replaceFile(tempPath, path); err != nil {
		return err
	}
	cleanupTemp = false

	syncDirectoryBestEffort(dir)
	return nil
}

func replaceFile(sourcePath string, targetPath string) error {
	if err := os.Rename(sourcePath, targetPath); err == nil {
		return nil
	} else if removeErr := os.Remove(targetPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
		return err
	}

	return os.Rename(sourcePath, targetPath)
}

func syncDirectoryBestEffort(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()
	_ = file.Sync()
}

func (store *campaignStore) listCampaigns() []campaignSummary {
	store.mu.RLock()
	defer store.mu.RUnlock()

	items := make([]campaignSummary, 0, len(store.data.Campaigns))
	for _, campaign := range store.data.Campaigns {
		items = append(items, campaignSummaryFromData(campaign))
	}

	return items
}

func (store *campaignStore) getCampaign(id string) (campaignData, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	for _, campaign := range store.data.Campaigns {
		if campaign.ID == id {
			return ensureCampaignShape(campaign), nil
		}
	}

	return campaignData{}, fmt.Errorf("campaign %q not found", id)
}

func (store *campaignStore) createCampaign(input createCampaignInput) (campaignData, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	campaign := ensureCampaignShape(campaignData{
		ID:          newID("campaign"),
		Title:       firstNonEmpty(input.Title, "Новая кампания"),
		System:      firstNonEmpty(input.System, "D&D 5e"),
		SettingName: firstNonEmpty(input.SettingName, "Новый мир"),
		InWorldDate: firstNonEmpty(input.InWorldDate, "1 Чес, 1492 DR"),
		Summary:     firstNonEmpty(input.Summary, "Кампания создана через backend и готова к наполнению."),
	})

	store.data.Campaigns = append(store.data.Campaigns, campaign)
	if err := store.saveLocked(); err != nil {
		return campaignData{}, err
	}

	return campaign, nil
}

func (store *campaignStore) updateCampaign(campaignID string, input updateCampaignInput) (campaignData, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		if input.CombatPlaylist != nil {
			campaign.CombatPlaylist = sanitizePlaylistTracks(input.CombatPlaylist)
		}
		if input.UpdatePreparedCombat {
			campaign.PreparedCombat = normalizeCampaignPreparedCombat(input.PreparedCombat)
		}

		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return campaignData{}, err
		}

		return *campaign, nil
	}

	return campaignData{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) createWorldEvent(campaignID string, input createWorldEventInput) (worldEventResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		event := materializeWorldEvent(input, *campaign, nil)
		campaign.Events = append(campaign.Events, event)
		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return worldEventResult{}, err
		}

		return worldEventResult{
			Campaign: *campaign,
			Event:    event,
		}, nil
	}

	return worldEventResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) updateWorldEvent(campaignID string, eventID string, input createWorldEventInput) (worldEventResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		eventIndex := -1
		var existing worldEvent
		for currentIndex := range campaign.Events {
			if campaign.Events[currentIndex].ID == eventID {
				eventIndex = currentIndex
				existing = campaign.Events[currentIndex]
				break
			}
		}
		if eventIndex < 0 {
			return worldEventResult{}, fmt.Errorf("event %q not found", eventID)
		}

		event := materializeWorldEvent(input, *campaign, &existing)
		event.ID = existing.ID
		campaign.Events[eventIndex] = event
		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return worldEventResult{}, err
		}

		return worldEventResult{
			Campaign: *campaign,
			Event:    event,
		}, nil
	}

	return worldEventResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) deleteWorldEvent(campaignID string, eventID string) (deleteWorldEventResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		eventIndex := -1
		for currentIndex := range campaign.Events {
			if campaign.Events[currentIndex].ID == eventID {
				eventIndex = currentIndex
				break
			}
		}
		if eventIndex < 0 {
			return deleteWorldEventResult{}, fmt.Errorf("event %q not found", eventID)
		}

		campaign.Events = append(campaign.Events[:eventIndex], campaign.Events[eventIndex+1:]...)
		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return deleteWorldEventResult{}, err
		}

		return deleteWorldEventResult{
			Campaign: *campaign,
			EventID:  eventID,
		}, nil
	}

	return deleteWorldEventResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) createEntity(campaignID string, input createEntityInput) (createEntityResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		entity := materializeEntity(input)
		campaign := &store.data.Campaigns[index]
		if entity.Kind == "monster" {
			if existing, ok := findMonsterByTitle(*campaign, entity.Title); ok {
				for monsterIndex := range campaign.Monsters {
					if campaign.Monsters[monsterIndex].ID != existing.ID {
						continue
					}

					mergedArt, changed := mergeHeroArt(campaign.Monsters[monsterIndex].Art, entity.Art)
					if changed {
						campaign.Monsters[monsterIndex].Art = mergedArt
						*campaign = ensureCampaignShape(*campaign)
						if err := store.saveLocked(); err != nil {
							return createEntityResult{}, err
						}
						existing = campaign.Monsters[monsterIndex]
					}
					break
				}
				*campaign = ensureCampaignShape(*campaign)
				return createEntityResult{
					Campaign: *campaign,
					Entity:   existing,
				}, nil
			}
		}

		switch entity.Kind {
		case "location":
			campaign.Locations = append(campaign.Locations, entity)
		case "player":
			campaign.Players = append(campaign.Players, entity)
		case "npc":
			campaign.NPCs = append(campaign.NPCs, entity)
		case "monster":
			campaign.Monsters = append(campaign.Monsters, entity)
		case "quest":
			campaign.Quests = append(campaign.Quests, entity)
		case "lore":
			campaign.Lore = append(campaign.Lore, entity)
		default:
			return createEntityResult{}, fmt.Errorf("unsupported entity kind %q", entity.Kind)
		}

		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return createEntityResult{}, err
		}

		return createEntityResult{
			Campaign: *campaign,
			Entity:   entity,
		}, nil
	}

	return createEntityResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) updateEntity(campaignID string, entityID string, input createEntityInput) (createEntityResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		entities, entityIndex, existing := findEntityInCampaign(campaign, entityID)
		if entities == nil {
			return createEntityResult{}, fmt.Errorf("entity %q not found", entityID)
		}

		if strings.TrimSpace(input.Kind) == "" {
			input.Kind = existing.Kind
		}
		if input.Kind != existing.Kind {
			return createEntityResult{}, fmt.Errorf("entity kind mismatch: expected %q, got %q", existing.Kind, input.Kind)
		}

		entity := materializeEntity(input)
		entity.ID = existing.ID
		(*entities)[entityIndex] = entity

		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return createEntityResult{}, err
		}

		return createEntityResult{
			Campaign: *campaign,
			Entity:   entity,
		}, nil
	}

	return createEntityResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) deleteEntity(campaignID string, entityID string) (deleteEntityResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		entities, entityIndex, existing := findEntityInCampaign(campaign, entityID)
		if entities == nil {
			return deleteEntityResult{}, fmt.Errorf("entity %q not found", entityID)
		}

		*entities = append((*entities)[:entityIndex], (*entities)[entityIndex+1:]...)
		if campaign.ActiveCombat != nil {
			filteredEntries := make([]combatEntry, 0, len(campaign.ActiveCombat.Entries))
			for _, entry := range campaign.ActiveCombat.Entries {
				if entry.EntityID == entityID {
					continue
				}
				filteredEntries = append(filteredEntries, entry)
			}
			campaign.ActiveCombat.Entries = filteredEntries
			recalculateActiveCombat(campaign.ActiveCombat)
			if len(campaign.ActiveCombat.Entries) == 0 {
				campaign.ActiveCombat = nil
			}
		}

		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return deleteEntityResult{}, err
		}

		return deleteEntityResult{
			Campaign: *campaign,
			EntityID: entityID,
			Kind:     existing.Kind,
		}, nil
	}

	return deleteEntityResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) startCombat(campaignID string, input startCombatInput) (combatResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		if campaign.ActiveCombat == nil {
			campaign.ActiveCombat = &activeCombat{
				ID:         newID("combat"),
				Title:      firstNonEmpty(input.Title, "Активный бой"),
				PartySize:  normalizePartySize(input.PartySize),
				Thresholds: normalizeCombatThresholds(input.Thresholds),
				Entries:    []combatEntry{},
			}
		}

		campaign.ActiveCombat.Title = firstNonEmpty(input.Title, campaign.ActiveCombat.Title, "Активный бой")
		campaign.ActiveCombat.PartySize = normalizePartySize(input.PartySize)
		campaign.ActiveCombat.Thresholds = normalizeCombatThresholds(input.Thresholds)
		campaign.ActiveCombat.TargetAdjustedXP = input.TargetAdjustedXP
		campaign.ActiveCombat.TargetBaseXP = input.TargetBaseXP
		campaign.LastCombatSummary = nil
		campaign.ActiveCombat.Entries = append(campaign.ActiveCombat.Entries, buildCombatEntriesForItems(*campaign, campaign.ActiveCombat.Entries, input.Items)...)
		campaign.ActiveCombat.Entries = append(campaign.ActiveCombat.Entries, buildManualCombatEntries(input.ManualParticipants)...)
		recalculateActiveCombat(campaign.ActiveCombat)

		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return combatResult{}, err
		}

		return combatResult{
			Campaign: *campaign,
			Combat:   campaign.ActiveCombat,
		}, nil
	}

	return combatResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) updateCombatEntry(campaignID string, entryID string, input updateCombatEntryInput) (combatResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		if campaign.ActiveCombat == nil {
			return combatResult{}, fmt.Errorf("active combat not found")
		}
		campaign.ActiveCombat.Entries = ensureCombatEntries(campaign.ActiveCombat.Entries)

		for entryIndex := range campaign.ActiveCombat.Entries {
			entry := &campaign.ActiveCombat.Entries[entryIndex]
			if entry.ID != entryID {
				continue
			}
			if input.EntityID != "" && entry.EntityID != input.EntityID {
				continue
			}
			if input.Title != "" && entry.Title != input.Title {
				continue
			}

			if input.CurrentHitPoints != nil {
				if *input.CurrentHitPoints < 0 {
					*input.CurrentHitPoints = 0
				}
				if *input.CurrentHitPoints > entry.MaxHitPoints {
					*input.CurrentHitPoints = entry.MaxHitPoints
				}

				entry.CurrentHitPoints = *input.CurrentHitPoints
			}
			if input.Initiative != nil {
				entry.Initiative = *input.Initiative
			}
			if input.Defeated != nil {
				entry.Defeated = *input.Defeated
			} else if entry.MaxHitPoints > 0 {
				entry.Defeated = entry.CurrentHitPoints <= 0
			}
			recalculateActiveCombat(campaign.ActiveCombat)

			*campaign = ensureCampaignShape(*campaign)
			if err := store.saveLocked(); err != nil {
				return combatResult{}, err
			}

			return combatResult{
				Campaign: *campaign,
				Combat:   campaign.ActiveCombat,
			}, nil
		}

		return combatResult{}, fmt.Errorf("combat entry %q not found", entryID)
	}

	return combatResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) updateCombatState(campaignID string, input updateCombatStateInput) (combatResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		if campaign.ActiveCombat == nil {
			return combatResult{}, fmt.Errorf("active combat not found")
		}

		campaign.ActiveCombat.Entries = ensureCombatEntries(campaign.ActiveCombat.Entries)
		normalizeCombatTurn(campaign.ActiveCombat)
		if input.CurrentTurnEntryID != "" {
			campaign.ActiveCombat.CurrentTurnEntryID = input.CurrentTurnEntryID
			normalizeCombatTurn(campaign.ActiveCombat)
		}
		if input.NextTurn {
			advanceCombatTurn(campaign.ActiveCombat)
		}
		if input.PlayersVictory {
			for entryIndex := range campaign.ActiveCombat.Entries {
				entry := &campaign.ActiveCombat.Entries[entryIndex]
				if combatEntrySide(*entry) != "enemy" {
					continue
				}
				entry.Defeated = true
				if entry.MaxHitPoints > 0 {
					entry.CurrentHitPoints = 0
				}
			}
		}
		recalculateActiveCombat(campaign.ActiveCombat)

		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return combatResult{}, err
		}

		return combatResult{
			Campaign: *campaign,
			Combat:   campaign.ActiveCombat,
		}, nil
	}

	return combatResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) finishCombat(campaignID string) (finishCombatResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	for index := range store.data.Campaigns {
		if store.data.Campaigns[index].ID != campaignID {
			continue
		}

		campaign := &store.data.Campaigns[index]
		if campaign.ActiveCombat == nil {
			return finishCombatResult{}, fmt.Errorf("active combat not found")
		}

		report := finishCombatResult{
			CombatID:        campaign.ActiveCombat.ID,
			DefeatedEntries: []combatEntry{},
		}

		for _, entry := range campaign.ActiveCombat.Entries {
			if !entry.Defeated || combatEntrySide(entry) != "enemy" {
				continue
			}
			report.DefeatedEntries = append(report.DefeatedEntries, entry)
			report.TotalExperience += entry.Experience
		}

		report.DefeatedCount = len(report.DefeatedEntries)
		if campaign.ActiveCombat.PartySize > 0 {
			report.ExperiencePerPlayer = report.TotalExperience / campaign.ActiveCombat.PartySize
		}

		playerRewards := make([]combatRewardShare, 0)
		for _, entry := range campaign.ActiveCombat.Entries {
			if combatEntrySide(entry) != "player" {
				continue
			}
			playerRewards = append(playerRewards, combatRewardShare{
				Title:      strings.TrimSpace(entry.Title),
				Experience: report.ExperiencePerPlayer,
			})
		}

		report.Summary = &lastCombatSummary{
			CombatID:            campaign.ActiveCombat.ID,
			Title:               firstNonEmpty(strings.TrimSpace(campaign.ActiveCombat.Title), "Последний бой"),
			Outcome:             "victory",
			DefeatedCount:       report.DefeatedCount,
			TotalExperience:     report.TotalExperience,
			ExperiencePerPlayer: report.ExperiencePerPlayer,
			Round:               campaign.ActiveCombat.Round,
			Entries:             ensureCombatEntries(campaign.ActiveCombat.Entries),
			PlayerRewards:       normalizeCombatRewardShares(playerRewards),
			FinishedAt:          time.Now().UTC().Format(time.RFC3339),
		}

		campaign.LastCombatSummary = report.Summary
		campaign.ActiveCombat = nil
		*campaign = ensureCampaignShape(*campaign)
		if err := store.saveLocked(); err != nil {
			return finishCombatResult{}, err
		}

		report.Campaign = *campaign
		return report, nil
	}

	return finishCombatResult{}, fmt.Errorf("campaign %q not found", campaignID)
}

func (store *campaignStore) search(campaignID string, query string) ([]searchResult, error) {
	campaign, err := store.getCampaign(campaignID)
	if err != nil {
		return nil, err
	}

	return searchCampaign(campaign, query), nil
}

func buildCombatEntriesForItems(campaign campaignData, existing []combatEntry, items []addCombatantItem) []combatEntry {
	entries := make([]combatEntry, 0)
	counts := map[string]int{}
	for _, entry := range existing {
		counts[entry.EntityID]++
	}

	for _, item := range items {
		if item.Quantity < 1 {
			item.Quantity = 1
		}

		entity, ok := findKnowledgeEntity(campaign, item.EntityID)
		if !ok || (entity.Kind != "player" && entity.Kind != "npc" && entity.Kind != "monster") {
			continue
		}

		for quantityIndex := 0; quantityIndex < item.Quantity; quantityIndex++ {
			counts[entity.ID]++
			entries = append(entries, buildCombatEntry(entity, counts[entity.ID], item.Initiative))
		}
	}

	return entries
}

func buildManualCombatEntries(items []manualCombatantInput) []combatEntry {
	entries := make([]combatEntry, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.Title) == "" {
			continue
		}
		entries = append(entries, buildManualCombatEntry(item))
	}
	return entries
}

func recalculateActiveCombat(combat *activeCombat) {
	if combat == nil {
		return
	}

	combat.Thresholds = normalizeCombatThresholds(combat.Thresholds)
	combat.PartySize = normalizePartySize(combat.PartySize)
	combat.Entries = ensureCombatEntries(combat.Entries)
	combat.ActualBaseXP, combat.ActualAdjustedXP = computeCombatMetrics(combat.Entries, combat.PartySize)
	combat.Difficulty = deriveCombatDifficulty(combat.ActualAdjustedXP, combat.Thresholds)
	normalizeCombatTurn(combat)
}

func findEntityInCampaign(campaign *campaignData, entityID string) (*[]knowledgeEntity, int, knowledgeEntity) {
	buckets := []*[]knowledgeEntity{
		&campaign.Locations,
		&campaign.Players,
		&campaign.NPCs,
		&campaign.Monsters,
		&campaign.Quests,
		&campaign.Lore,
	}

	for _, bucket := range buckets {
		for index := range *bucket {
			if (*bucket)[index].ID == entityID {
				return bucket, index, (*bucket)[index]
			}
		}
	}

	return nil, -1, knowledgeEntity{}
}

func materializeWorldEvent(input createWorldEventInput, campaign campaignData, existing *worldEvent) worldEvent {
	title := firstNonEmpty(strings.TrimSpace(input.Title), func() string {
		if existing != nil {
			return strings.TrimSpace(existing.Title)
		}
		return ""
	}(), fallbackWorldEventTitle(input.Type))
	sceneText := firstNonEmpty(
		strings.TrimSpace(input.SceneText),
		strings.TrimSpace(input.Summary),
		func() string {
			if existing != nil {
				return strings.TrimSpace(existing.SceneText)
			}
			return ""
		}(),
		title,
	)
	locationID := strings.TrimSpace(input.LocationID)
	locationLabel := firstNonEmpty(strings.TrimSpace(input.LocationLabel), lookupLocationLabel(campaign.Locations, locationID))
	event := worldEvent{
		ID:    newID("event"),
		Title: title,
		Date: firstNonEmpty(strings.TrimSpace(input.Date), func() string {
			if existing != nil {
				return strings.TrimSpace(existing.Date)
			}
			return ""
		}(), strings.TrimSpace(campaign.InWorldDate)),
		Summary:          firstNonEmpty(strings.TrimSpace(input.Summary), summarizeWorldEventScene(sceneText)),
		Type:             normalizeWorldEventType(input.Type),
		LocationID:       locationID,
		LocationLabel:    locationLabel,
		SceneText:        sceneText,
		DialogueBranches: sanitizeWorldEventDialogueBranches(input.DialogueBranches),
		Loot:             sanitizeStringItems(input.Loot),
		Tags:             sanitizeTags(input.Tags),
		Origin: normalizeWorldEventOrigin(firstNonEmpty(strings.TrimSpace(input.Origin), func() string {
			if existing != nil {
				return strings.TrimSpace(existing.Origin)
			}
			return ""
		}())),
	}
	if existing != nil && strings.TrimSpace(existing.ID) != "" {
		event.ID = existing.ID
	}
	return event
}

func materializeEntity(input createEntityInput) knowledgeEntity {
	playerContent := strings.TrimSpace(input.PlayerContent)
	playerCards := normalizePlayerFacingCards(input.Kind, input.PlayerCards, playerContent)
	if playerContent == "" && len(playerCards) > 0 {
		playerContent = playerCards[0].Content
	}
	preparedCombats := normalizePreparedCombats(input.PreparedCombats, input.PreparedCombat)

	entity := knowledgeEntity{
		ID:              newID(input.Kind),
		Kind:            input.Kind,
		Title:           firstNonEmpty(input.Title, fallbackEntityTitle(input.Kind)),
		Subtitle:        input.Subtitle,
		Summary:         firstNonEmpty(input.Summary, "Описание пока не заполнено."),
		Content:         firstNonEmpty(input.Content, input.Summary, "Описание пока не заполнено."),
		PlayerContent:   playerContent,
		PlayerCards:     playerCards,
		Tags:            sanitizeTags(input.Tags),
		QuickFacts:      input.QuickFacts,
		Related:         input.Related,
		Art:             input.Art,
		Playlist:        sanitizePlaylistTracks(input.Playlist),
		Gallery:         sanitizeGalleryImages(input.Gallery),
		Category:        input.Category,
		Region:          input.Region,
		Danger:          input.Danger,
		ParentID:        input.ParentID,
		Role:            input.Role,
		Status:          input.Status,
		Importance:      input.Importance,
		LocationID:      input.LocationID,
		StatBlock:       input.StatBlock,
		RewardProfile:   input.RewardProfile,
		Urgency:         input.Urgency,
		IssuerID:        input.IssuerID,
		PreparedCombat:  primaryPreparedCombat(preparedCombats),
		PreparedCombats: preparedCombats,
		Visibility:      input.Visibility,
	}

	if len(entity.QuickFacts) == 0 {
		entity.QuickFacts = defaultQuickFacts(entity)
	}

	return entity
}

func normalizePreparedCombat(plan *preparedCombatPlan) *preparedCombatPlan {
	if plan == nil {
		return nil
	}

	playerSeen := map[string]struct{}{}
	playerIDs := make([]string, 0, len(plan.PlayerIDs))
	for _, playerID := range plan.PlayerIDs {
		trimmed := strings.TrimSpace(playerID)
		if trimmed == "" {
			continue
		}
		if _, exists := playerSeen[trimmed]; exists {
			continue
		}
		playerSeen[trimmed] = struct{}{}
		playerIDs = append(playerIDs, trimmed)
	}

	items := make([]preparedCombatItem, 0, len(plan.Items))
	for _, item := range plan.Items {
		entityID := strings.TrimSpace(item.EntityID)
		quantity := item.Quantity
		if entityID == "" || quantity <= 0 {
			continue
		}
		items = append(items, preparedCombatItem{
			EntityID: entityID,
			Quantity: quantity,
		})
	}

	if len(playerIDs) == 0 && len(items) == 0 && strings.TrimSpace(plan.Title) == "" {
		return nil
	}

	return &preparedCombatPlan{
		Title:     strings.TrimSpace(plan.Title),
		PlayerIDs: playerIDs,
		Items:     items,
	}
}

func normalizePreparedCombats(plans []preparedCombatPlan, legacy *preparedCombatPlan) []preparedCombatPlan {
	result := make([]preparedCombatPlan, 0, len(plans))
	for _, plan := range plans {
		normalized := normalizePreparedCombat(&plan)
		if normalized == nil {
			continue
		}
		if normalized.Title == "" {
			normalized.Title = defaultPreparedCombatTitle(len(result))
		}
		result = append(result, *normalized)
	}

	if len(result) == 0 {
		normalizedLegacy := normalizePreparedCombat(legacy)
		if normalizedLegacy == nil {
			return []preparedCombatPlan{}
		}
		if normalizedLegacy.Title == "" {
			normalizedLegacy.Title = defaultPreparedCombatTitle(0)
		}
		return []preparedCombatPlan{*normalizedLegacy}
	}

	return result
}

func primaryPreparedCombat(plans []preparedCombatPlan) *preparedCombatPlan {
	if len(plans) == 0 {
		return nil
	}

	primary := plans[0]
	return &primary
}

func defaultPreparedCombatTitle(index int) string {
	return "Бой " + strconv.Itoa(index+1)
}

func normalizeCampaignPreparedCombat(plan *campaignPreparedCombat) *campaignPreparedCombat {
	if plan == nil {
		return nil
	}

	playerSeen := map[string]struct{}{}
	playerIDs := make([]string, 0, len(plan.PlayerIDs))
	for _, playerID := range plan.PlayerIDs {
		trimmed := strings.TrimSpace(playerID)
		if trimmed == "" {
			continue
		}
		if _, exists := playerSeen[trimmed]; exists {
			continue
		}
		playerSeen[trimmed] = struct{}{}
		playerIDs = append(playerIDs, trimmed)
	}

	items := make([]preparedCombatItem, 0, len(plan.Items))
	for _, item := range plan.Items {
		entityID := strings.TrimSpace(item.EntityID)
		quantity := item.Quantity
		if entityID == "" || quantity <= 0 {
			continue
		}
		items = append(items, preparedCombatItem{
			EntityID: entityID,
			Quantity: quantity,
		})
	}

	title := strings.TrimSpace(plan.Title)
	if title == "" && len(playerIDs) == 0 && len(items) == 0 {
		return nil
	}

	return &campaignPreparedCombat{
		Title:     title,
		PlayerIDs: playerIDs,
		Items:     items,
	}
}

func fallbackEntityTitle(kind string) string {
	switch kind {
	case "monster":
		return "Новый монстр"
	case "player":
		return "Новый игрок"
	case "npc":
		return "Новый НПС"
	case "location":
		return "Новая локация"
	case "quest":
		return "Новый квест"
	case "lore":
		return "Новая запись лора"
	default:
		return "Новая сущность"
	}
}

func defaultQuickFacts(entity knowledgeEntity) []quickFact {
	switch entity.Kind {
	case "location":
		return []quickFact{
			{Label: "Опасность", Value: firstNonEmpty(entity.Danger, "Tense"), Tone: "warning"},
			{Label: "Регион", Value: firstNonEmpty(entity.Region, "Не указан")},
			{Label: "Категория", Value: firstNonEmpty(entity.Category, "City")},
		}
	case "player":
		facts := []quickFact{
			{Label: "Статус", Value: firstNonEmpty(entity.Status, "Active"), Tone: "success"},
			{Label: "Роль", Value: firstNonEmpty(entity.Role, "Персонаж игрока")},
		}
		if entity.StatBlock != nil {
			facts = append(facts, quickFact{Label: "КБ / ХП", Value: entity.StatBlock.ArmorClass + " / " + entity.StatBlock.HitPoints})
		}
		return facts
	case "npc":
		facts := []quickFact{
			{Label: "Статус", Value: firstNonEmpty(entity.Status, "Unknown"), Tone: "accent"},
			{Label: "Роль", Value: firstNonEmpty(entity.Role, "Не указана")},
		}
		if entity.StatBlock != nil {
			facts = append(facts, quickFact{Label: "КБ / ХП", Value: entity.StatBlock.ArmorClass + " / " + entity.StatBlock.HitPoints})
		}
		return facts
	case "monster":
		facts := []quickFact{
			{Label: "Поведение", Value: firstNonEmpty(entity.Status, "Hostile"), Tone: "danger"},
			{Label: "Роль", Value: firstNonEmpty(entity.Role, "Угроза")},
		}
		if entity.StatBlock != nil {
			facts = append(facts, quickFact{Label: "CR / XP", Value: firstNonEmpty(entity.StatBlock.Challenge, "—")})
		}
		if entity.RewardProfile != nil && len(entity.RewardProfile.Loot) > 0 {
			facts = append(facts, quickFact{Label: "Лут", Value: fmt.Sprintf("%d поз.", len(entity.RewardProfile.Loot)), Tone: "warning"})
		}
		return facts
	case "quest":
		return []quickFact{
			{Label: "Статус", Value: firstNonEmpty(entity.Status, "active"), Tone: "accent"},
			{Label: "Срочность", Value: firstNonEmpty(entity.Urgency, "Medium"), Tone: "warning"},
		}
	case "lore":
		return []quickFact{
			{Label: "Категория", Value: firstNonEmpty(entity.Category, "History")},
			{Label: "Видимость", Value: firstNonEmpty(entity.Visibility, "gm_only"), Tone: "danger"},
		}
	default:
		return []quickFact{{Label: "Статус", Value: "draft"}}
	}
}

func sanitizeTags(tags []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func findMonsterByTitle(campaign campaignData, title string) (knowledgeEntity, bool) {
	needle := normalizeEntityTitle(title)
	if needle == "" {
		return knowledgeEntity{}, false
	}

	for _, entity := range campaign.Monsters {
		if normalizeEntityTitle(entity.Title) == needle {
			return entity, true
		}
	}

	return knowledgeEntity{}, false
}

func sanitizePlaylistTracks(tracks []playlistTrack) []playlistTrack {
	if len(tracks) == 0 {
		return []playlistTrack{}
	}

	result := make([]playlistTrack, 0, len(tracks))
	for _, track := range tracks {
		title := strings.TrimSpace(track.Title)
		url := strings.TrimSpace(track.URL)
		if url == "" {
			continue
		}

		result = append(result, playlistTrack{
			Title: title,
			URL:   url,
		})
	}

	if len(result) == 0 {
		return []playlistTrack{}
	}

	return result
}

func sanitizeGalleryImages(items []galleryImage) []galleryImage {
	if len(items) == 0 {
		return []galleryImage{}
	}

	result := make([]galleryImage, 0, len(items))
	for _, item := range items {
		title := strings.TrimSpace(item.Title)
		url := strings.TrimSpace(item.URL)
		caption := strings.TrimSpace(item.Caption)
		if url == "" {
			continue
		}

		if title == "" {
			title = fmt.Sprintf("Изображение %d", len(result)+1)
		}

		result = append(result, galleryImage{
			Title:   title,
			URL:     url,
			Caption: caption,
		})
	}

	if len(result) == 0 {
		return []galleryImage{}
	}

	return result
}

func mergeHeroArt(existing *heroArt, incoming *heroArt) (*heroArt, bool) {
	if incoming == nil {
		return existing, false
	}
	if existing == nil {
		return &heroArt{
			URL:     incoming.URL,
			Alt:     incoming.Alt,
			Caption: incoming.Caption,
		}, strings.TrimSpace(incoming.URL+incoming.Alt+incoming.Caption) != ""
	}

	merged := *existing
	changed := false
	if strings.TrimSpace(merged.URL) == "" && strings.TrimSpace(incoming.URL) != "" {
		merged.URL = incoming.URL
		changed = true
	}
	if strings.TrimSpace(merged.Alt) == "" && strings.TrimSpace(incoming.Alt) != "" {
		merged.Alt = incoming.Alt
		changed = true
	}
	if strings.TrimSpace(merged.Caption) == "" && strings.TrimSpace(incoming.Caption) != "" {
		merged.Caption = incoming.Caption
		changed = true
	}

	if !changed {
		return existing, false
	}
	return &merged, true
}

func normalizeEntityTitle(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

func newID(prefix string) string {
	return fmt.Sprintf(
		"%s-%d-%d",
		firstNonEmpty(prefix, "entity"),
		time.Now().UnixNano(),
		atomic.AddUint64(&idSequence, 1),
	)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
