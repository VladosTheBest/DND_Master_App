package httpapi

import (
	"strconv"
	"strings"
)

func starterState() storageState {
	return storageState{
		Campaigns: []campaignData{starterCampaign()},
	}
}

func starterCampaign() campaignData {
	return ensureCampaignShape(campaignData{
		ID:          "campaign-shadow-edge",
		Title:       "Грань Тени",
		System:      "D&D 5e",
		SettingName: "Северная граница после Раскола",
		InWorldDate: "17 Найтала, 1492 DR",
		Summary:     "Чистая backend-first кампания. Создавай города, НПС, монстров, квесты и лор прямо из интерфейса.",
		Locations:   []knowledgeEntity{},
		Players:     []knowledgeEntity{},
		NPCs:        []knowledgeEntity{},
		Monsters:    []knowledgeEntity{},
		Quests:      []knowledgeEntity{},
		Lore:        []knowledgeEntity{},
		Events:      []worldEvent{},
		SessionPrep: []sessionPrepItem{},
	})
}

func ensureCampaignShape(campaign campaignData) campaignData {
	campaign.Modules = defaultModules()
	campaign.Locations = ensureKnowledgeEntities(campaign.Locations)
	campaign.Players = ensureKnowledgeEntities(campaign.Players)
	campaign.NPCs = ensureKnowledgeEntities(campaign.NPCs)
	campaign.Monsters = ensureKnowledgeEntities(campaign.Monsters)
	campaign.Quests = ensureKnowledgeEntities(campaign.Quests)
	campaign.Lore = ensureKnowledgeEntities(campaign.Lore)
	campaign.Events = ensureWorldEvents(campaign.Events, campaign.Locations, campaign.InWorldDate)
	if campaign.SessionPrep == nil {
		campaign.SessionPrep = []sessionPrepItem{}
	}
	campaign.CombatPlaylist = sanitizePlaylistTracks(campaign.CombatPlaylist)
	campaign.PreparedCombat = normalizeCampaignPreparedCombat(campaign.PreparedCombat)
	if campaign.ActiveCombat != nil {
		campaign.ActiveCombat.Entries = ensureCombatEntries(campaign.ActiveCombat.Entries)
		normalizeCombatTurn(campaign.ActiveCombat)
	}
	campaign.LastCombatSummary = normalizeLastCombatSummary(campaign.LastCombatSummary)
	campaign.DashboardCards = rebuildDashboardCards(campaign)
	return campaign
}

func ensureKnowledgeEntities(entities []knowledgeEntity) []knowledgeEntity {
	if entities == nil {
		return []knowledgeEntity{}
	}

	for index := range entities {
		if entities[index].Tags == nil {
			entities[index].Tags = []string{}
		}
		entities[index].PlayerCards = normalizePlayerFacingCards(
			entities[index].Kind,
			entities[index].PlayerCards,
			entities[index].PlayerContent,
		)
		if strings.TrimSpace(entities[index].PlayerContent) == "" && len(entities[index].PlayerCards) > 0 {
			entities[index].PlayerContent = entities[index].PlayerCards[0].Content
		}
		if entities[index].QuickFacts == nil || len(entities[index].QuickFacts) == 0 {
			entities[index].QuickFacts = defaultQuickFacts(entities[index])
		}
		if entities[index].Related == nil {
			entities[index].Related = []relatedEntity{}
		}
		entities[index].Playlist = sanitizePlaylistTracks(entities[index].Playlist)
		entities[index].Gallery = sanitizeGalleryImages(entities[index].Gallery)
		entities[index].RewardProfile = ensureRewardProfile(entities[index].RewardProfile)
		entities[index].PreparedCombat = normalizePreparedCombat(entities[index].PreparedCombat)
	}

	return entities
}

func normalizePlayerFacingCards(kind string, cards []playerFacingCard, legacyContent string) []playerFacingCard {
	result := make([]playerFacingCard, 0, len(cards))
	for _, card := range cards {
		normalizedCard := normalizeFormattedPlayerFacingCard(card)
		if normalizedCard.Title == "" && normalizedCard.Content == "" && normalizedCard.ContentHTML == "" {
			continue
		}
		if normalizedCard.Content == "" {
			continue
		}
		result = append(result, normalizedCard)
	}

	for index := range result {
		if result[index].Title == "" {
			result[index].Title = defaultPlayerFacingCardTitle(kind, index)
		}
	}

	if len(result) == 0 {
		trimmedLegacy := strings.TrimSpace(legacyContent)
		if trimmedLegacy != "" {
			return []playerFacingCard{
				{
					Title:   defaultPlayerFacingCardTitle(kind, 0),
					Content: trimmedLegacy,
				},
			}
		}
	}

	if len(result) == 0 {
		return []playerFacingCard{}
	}

	return result
}

func defaultPlayerFacingCardTitle(kind string, index int) string {
	if index == 0 {
		return "Игроки видят"
	}
	return "Карточка " + strconv.Itoa(index+1)
}

func ensureWorldEvents(events []worldEvent, locations []knowledgeEntity, fallbackDate string) []worldEvent {
	if events == nil {
		return []worldEvent{}
	}

	for index := range events {
		events[index].Type = normalizeWorldEventType(events[index].Type)
		events[index].Title = firstNonEmpty(strings.TrimSpace(events[index].Title), fallbackWorldEventTitle(events[index].Type))
		events[index].Date = firstNonEmpty(strings.TrimSpace(events[index].Date), strings.TrimSpace(fallbackDate))
		events[index].LocationID = strings.TrimSpace(events[index].LocationID)
		events[index].LocationLabel = firstNonEmpty(strings.TrimSpace(events[index].LocationLabel), lookupLocationLabel(locations, events[index].LocationID))
		events[index].SceneText = firstNonEmpty(strings.TrimSpace(events[index].SceneText), strings.TrimSpace(events[index].Summary), events[index].Title)
		events[index].Summary = firstNonEmpty(strings.TrimSpace(events[index].Summary), summarizeWorldEventScene(events[index].SceneText))
		events[index].DialogueBranches = sanitizeWorldEventDialogueBranches(events[index].DialogueBranches)
		events[index].Loot = sanitizeStringItems(events[index].Loot)
		events[index].Tags = sanitizeTags(events[index].Tags)
		events[index].Origin = normalizeWorldEventOrigin(events[index].Origin)
		if strings.TrimSpace(events[index].ID) == "" {
			events[index].ID = newID("event")
		}
	}

	return events
}

func normalizeLastCombatSummary(summary *lastCombatSummary) *lastCombatSummary {
	if summary == nil {
		return nil
	}

	combatID := strings.TrimSpace(summary.CombatID)
	title := strings.TrimSpace(summary.Title)
	if combatID == "" && title == "" && summary.TotalExperience <= 0 && summary.DefeatedCount <= 0 {
		return nil
	}

	normalized := &lastCombatSummary{
		CombatID:            combatID,
		Title:               firstNonEmpty(title, "Последний бой"),
		Outcome:             "victory",
		DefeatedCount:       summary.DefeatedCount,
		TotalExperience:     summary.TotalExperience,
		ExperiencePerPlayer: summary.ExperiencePerPlayer,
		Round:               summary.Round,
		Entries:             ensureCombatEntries(summary.Entries),
		PlayerRewards:       normalizeCombatRewardShares(summary.PlayerRewards),
		FinishedAt:          strings.TrimSpace(summary.FinishedAt),
	}

	if normalized.DefeatedCount < 0 {
		normalized.DefeatedCount = 0
	}
	if normalized.TotalExperience < 0 {
		normalized.TotalExperience = 0
	}
	if normalized.ExperiencePerPlayer < 0 {
		normalized.ExperiencePerPlayer = 0
	}

	if strings.EqualFold(strings.TrimSpace(summary.Outcome), "victory") {
		normalized.Outcome = "victory"
	}

	return normalized
}

func normalizeCombatRewardShares(items []combatRewardShare) []combatRewardShare {
	if len(items) == 0 {
		return []combatRewardShare{}
	}

	result := make([]combatRewardShare, 0, len(items))
	for _, item := range items {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		experience := item.Experience
		if experience < 0 {
			experience = 0
		}
		result = append(result, combatRewardShare{
			Title:      title,
			Experience: experience,
		})
	}

	return result
}

func ensureRewardProfile(profile *monsterRewardProfile) *monsterRewardProfile {
	if profile == nil {
		return nil
	}
	if profile.Loot == nil {
		profile.Loot = []monsterLootEntry{}
	}
	return profile
}

func ensureCombatEntries(entries []combatEntry) []combatEntry {
	if entries == nil {
		return []combatEntry{}
	}
	seen := make(map[string]struct{}, len(entries))
	for index := range entries {
		if entries[index].ID == "" {
			entries[index].ID = newID("combat-entry")
		}
		if _, exists := seen[entries[index].ID]; exists {
			entries[index].ID = newID("combat-entry")
		}
		seen[entries[index].ID] = struct{}{}
		if entries[index].CurrentHitPoints < 0 {
			entries[index].CurrentHitPoints = 0
		}
		if entries[index].MaxHitPoints < 0 {
			entries[index].MaxHitPoints = 0
		}
		if strings.TrimSpace(entries[index].EntityKind) == "" {
			entries[index].EntityKind = "monster"
		}
		if strings.TrimSpace(entries[index].Side) == "" {
			if entries[index].EntityKind == "player" {
				entries[index].Side = "player"
			} else {
				entries[index].Side = "enemy"
			}
		}
		if entries[index].ArmorClass == "" {
			if entries[index].EntityKind == "player" {
				entries[index].ArmorClass = "—"
			} else {
				entries[index].ArmorClass = "10"
			}
		}
		if challenge := challengeForCombatEntry(entries[index]); challenge != "" {
			entries[index].Challenge = challenge
		}
		if entries[index].Experience <= 0 {
			entries[index].Experience = experienceForCombatEntry(entries[index])
		}
		entries[index].Defeated = entries[index].Defeated || (entries[index].MaxHitPoints > 0 && entries[index].CurrentHitPoints <= 0)
	}
	return entries
}

func defaultModules() []appModule {
	return []appModule{
		{ID: "dashboard", Label: "Главная", Hint: "Сводка кампании и подготовка"},
		{ID: "combat", Label: "Бой", Hint: "Активная сцена, HP и опыт"},
		{ID: "locations", Label: "Локации", Hint: "Города, регионы, руины и POI"},
		{ID: "players", Label: "Игроки", Hint: "Персонажи партии, портреты и боевые профили"},
		{ID: "npcs", Label: "НПС", Hint: "Союзники, враги и социальные профили"},
		{ID: "monsters", Label: "Монстры", Hint: "Бестиарий, stat block и боевые угрозы"},
		{ID: "quests", Label: "Квесты", Hint: "Активные линии и последствия"},
		{ID: "lore", Label: "Лор", Hint: "История мира и скрытая информация"},
	}
}

func rebuildDashboardCards(campaign campaignData) []dashboardCard {
	combatValue := "Нет"
	combatDetail := "Активного боя сейчас нет"
	combatTone := "success"
	if campaign.ActiveCombat != nil && len(campaign.ActiveCombat.Entries) > 0 {
		combatValue = intString(len(campaign.ActiveCombat.Entries))
		combatDetail = "Существ в активном бою"
		combatTone = "danger"
	}

	return []dashboardCard{
		{Label: "Локации", Value: intString(len(campaign.Locations)), Detail: "Города, регионы и точки интереса", Tone: "warning"},
		{Label: "Игроки", Value: intString(len(campaign.Players)), Detail: "Персонажи партии и их портреты", Tone: "accent"},
		{Label: "НПС", Value: intString(len(campaign.NPCs)), Detail: "Союзники, соперники и действующие лица", Tone: "success"},
		{Label: "Монстры", Value: intString(len(campaign.Monsters)), Detail: "Бестиарий и боевые угрозы", Tone: "danger"},
		{Label: "Бой", Value: combatValue, Detail: combatDetail, Tone: combatTone},
	}
}

func campaignSummaryFromData(campaign campaignData) campaignSummary {
	return campaignSummary{
		ID:          campaign.ID,
		Title:       campaign.Title,
		System:      campaign.System,
		SettingName: campaign.SettingName,
		InWorldDate: campaign.InWorldDate,
		Summary:     campaign.Summary,
	}
}

func searchCampaign(campaign campaignData, query string) []searchResult {
	needle := strings.TrimSpace(strings.ToLower(query))
	if needle == "" {
		return []searchResult{}
	}

	results := make([]searchResult, 0)
	for _, entity := range campaignEntities(campaign) {
		haystack := strings.ToLower(entity.Title + " " + entity.Subtitle + " " + entity.Summary + " " + strings.Join(entity.Tags, " "))
		if !strings.Contains(haystack, needle) {
			continue
		}

		results = append(results, searchResult{
			ID:       entity.ID,
			Kind:     entity.Kind,
			Title:    entity.Title,
			Subtitle: entity.Subtitle,
			Summary:  entity.Summary,
			Tags:     entity.Tags,
		})
	}

	return results
}

func campaignEntities(campaign campaignData) []knowledgeEntity {
	all := append([]knowledgeEntity{}, campaign.Locations...)
	all = append(all, campaign.Players...)
	all = append(all, campaign.NPCs...)
	all = append(all, campaign.Monsters...)
	all = append(all, campaign.Quests...)
	all = append(all, campaign.Lore...)
	return all
}

func normalizeWorldEventType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "funny", "combat", "heist", "social", "oddity", "danger":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "social"
	}
}

func normalizeWorldEventOrigin(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "ai":
		return "ai"
	default:
		return "manual"
	}
}

func lookupLocationLabel(locations []knowledgeEntity, locationID string) string {
	if strings.TrimSpace(locationID) == "" {
		return ""
	}

	for _, location := range locations {
		if location.ID == locationID {
			return strings.TrimSpace(location.Title)
		}
	}

	return ""
}

func fallbackWorldEventTitle(eventType string) string {
	switch normalizeWorldEventType(eventType) {
	case "funny":
		return "Неловкая сценка"
	case "combat":
		return "Короткая стычка"
	case "heist":
		return "Мелкое ограбление"
	case "oddity":
		return "Странный эпизод"
	case "danger":
		return "Тревожный момент"
	default:
		return "Случайное событие"
	}
}

func summarizeWorldEventScene(sceneText string) string {
	trimmed := strings.TrimSpace(sceneText)
	if trimmed == "" {
		return "Небольшая сценка для стола."
	}

	words := strings.Fields(trimmed)
	if len(words) <= 18 {
		return strings.Join(words, " ")
	}
	return strings.Join(words[:18], " ") + "..."
}

func sanitizeWorldEventDialogueBranches(branches []worldEventDialogueBranch) []worldEventDialogueBranch {
	if branches == nil {
		return []worldEventDialogueBranch{}
	}

	result := make([]worldEventDialogueBranch, 0, len(branches))
	for _, branch := range branches {
		lines := sanitizeStringItems(branch.Lines)
		title := strings.TrimSpace(branch.Title)
		outcome := strings.TrimSpace(branch.Outcome)
		if title == "" && len(lines) == 0 && outcome == "" {
			continue
		}
		result = append(result, worldEventDialogueBranch{
			Title:   firstNonEmpty(title, "Ветка"),
			Lines:   lines,
			Outcome: outcome,
		})
	}
	return result
}

func sanitizeStringItems(items []string) []string {
	if items == nil {
		return []string{}
	}

	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func intString(value int) string {
	return strconv.Itoa(value)
}
