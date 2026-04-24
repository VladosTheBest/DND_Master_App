package httpapi

import (
	"fmt"
	"math"
	"net/http"
	"strings"
)

func (srv *server) handleCombatEntries(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	var input startCombatInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	result, err := srv.store.startCombat(campaignID, input)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		writeError(writer, status, "start_combat_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleCombatState(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPatch {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only PATCH is supported")
		return
	}

	var input updateCombatStateInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	result, err := srv.store.updateCombatState(campaignID, input)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		writeError(writer, status, "update_combat_state_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleCombatEntry(writer http.ResponseWriter, request *http.Request, campaignID string, entryID string) {
	if request.Method != http.MethodPatch {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only PATCH is supported")
		return
	}

	var input updateCombatEntryInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	result, err := srv.store.updateCombatEntry(campaignID, entryID, input)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		writeError(writer, status, "update_combat_entry_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleCombatFinish(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	result, err := srv.store.finishCombat(campaignID)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		writeError(writer, status, "finish_combat_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, result)
}

func (srv *server) handleCombatGenerate(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	campaign, err := srv.store.getCampaign(campaignID)
	if err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	var input generateCombatInput
	if err := readJSON(request, &input); err != nil {
		writeError(writer, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	input.MonsterCount = normalizeEncounterMonsterCount(input.MonsterCount)
	input.PartySize = normalizePartySize(input.PartySize)
	input.PartyLevels = normalizePartyLevels(input.PartyLevels)
	input.Thresholds = computePartyThresholds(input.PartyLevels, input.PartySize, input.Thresholds)
	if len(input.PartyLevels) > 0 {
		input.PartySize = len(input.PartyLevels)
	}

	targetAdjustedXP := resolveTargetAdjustedXP(input)
	multiplier := encounterMultiplier(input.MonsterCount, input.PartySize)
	targetBaseXP := targetAdjustedXP
	if multiplier > 0 {
		targetBaseXP = int(math.Round(float64(targetAdjustedXP) / multiplier))
	}
	if targetBaseXP < 0 {
		targetBaseXP = 0
	}

	perMonsterXP := targetBaseXP
	if input.MonsterCount > 0 {
		perMonsterXP = int(math.Round(float64(targetBaseXP) / float64(input.MonsterCount)))
	}
	challenge, challengeXP := nearestChallengeByExperience(perMonsterXP)

	var roster generateEncounterDraftResult
	if themedRoster, ok := buildThemedEncounterDraft(input, targetAdjustedXP); ok {
		roster = themedRoster
	} else {
		roster, err = srv.generateEncounterRoster(campaign, input, challenge, challengeXP)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, "generate_combat_failed", err.Error())
			return
		}
	}
	roster = rebalanceEncounterDraft(input, roster, targetAdjustedXP, challenge, challengeXP)

	createdEntities := make([]knowledgeEntity, 0, len(roster.Items))
	combatItems := make([]addCombatantItem, 0, len(roster.Items))
	for _, item := range roster.Items {
		entityInput := item.Entity
		entityInput.Kind = "monster"
		entityInput.Tags = ensureEncounterTags(entityInput.Tags, input.Difficulty)

		created, createErr := srv.store.createEntity(campaignID, entityInput)
		if createErr != nil {
			writeError(writer, http.StatusInternalServerError, "generate_combat_failed", createErr.Error())
			return
		}

		createdEntities = append(createdEntities, created.Entity)
		combatItems = append(combatItems, addCombatantItem{
			EntityID: created.Entity.ID,
			Quantity: item.Quantity,
		})
	}

	combatTitle := firstNonEmpty(strings.TrimSpace(input.Title), cleanEncounterTitle(createdEntities))
	combat, err := srv.store.startCombat(campaignID, startCombatInput{
		Title:            combatTitle,
		PartySize:        input.PartySize,
		Thresholds:       input.Thresholds,
		TargetAdjustedXP: targetAdjustedXP,
		TargetBaseXP:     targetBaseXP,
		Items:            combatItems,
	})
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "generate_combat_failed", err.Error())
		return
	}

	writeJSON(writer, http.StatusOK, generateCombatResult{
		Campaign:        combat.Campaign,
		Combat:          combat.Combat,
		CreatedEntities: createdEntities,
	})
}

func generateEncounterFallback(input generateCombatInput, challenge string, challengeXP int) generateEncounterDraftResult {
	seed := createEncounterMonsterSeed(input, challenge, challengeXP)
	return generateEncounterDraftResult{
		Provider: "fallback",
		Notes:    []string{"Fallback encounter roster was used because the configured generator does not support encounter plans."},
		Items: []encounterDraftItem{
			{
				Quantity: input.MonsterCount,
				Entity:   seed,
			},
		},
	}
}

func (srv *server) generateEncounterRoster(campaign campaignData, input generateCombatInput, challenge string, challengeXP int) (generateEncounterDraftResult, error) {
	if generator, ok := srv.generator.(encounterGenerator); ok {
		return generator.GenerateEncounter(campaign, input)
	}

	return generateEncounterFallback(input, challenge, challengeXP), nil
}

func rebalanceEncounterDraft(
	input generateCombatInput,
	roster generateEncounterDraftResult,
	targetAdjustedXP int,
	fallbackChallenge string,
	fallbackChallengeXP int,
) generateEncounterDraftResult {
	if targetAdjustedXP <= 0 {
		return roster
	}

	_, actualAdjustedXP := computeEncounterDraftMetrics(roster.Items, input.PartySize)
	if absInt(actualAdjustedXP-targetAdjustedXP) <= encounterTargetTolerance(targetAdjustedXP) {
		return roster
	}

	if themedRoster, ok := buildThemedEncounterDraft(input, targetAdjustedXP); ok {
		_, themedAdjustedXP := computeEncounterDraftMetrics(themedRoster.Items, input.PartySize)
		if absInt(themedAdjustedXP-targetAdjustedXP) < absInt(actualAdjustedXP-targetAdjustedXP) {
			themedRoster.Notes = append(
				themedRoster.Notes,
				fmt.Sprintf(
					"Server rebalanced the roster to land closer to the requested adjusted XP target: %d -> %d.",
					actualAdjustedXP,
					themedAdjustedXP,
				),
			)
			return themedRoster
		}
	}

	fallback := generateEncounterFallback(input, fallbackChallenge, fallbackChallengeXP)
	_, fallbackAdjustedXP := computeEncounterDraftMetrics(fallback.Items, input.PartySize)
	if absInt(fallbackAdjustedXP-targetAdjustedXP) < absInt(actualAdjustedXP-targetAdjustedXP) {
		fallback.Notes = append(
			fallback.Notes,
			fmt.Sprintf(
				"Server swapped to a fallback roster because the generated encounter missed the requested adjusted XP target: %d -> %d.",
				actualAdjustedXP,
				fallbackAdjustedXP,
			),
		)
		return fallback
	}

	roster.Notes = append(
		roster.Notes,
		fmt.Sprintf("Requested %d adjusted XP, generated roster landed at %d.", targetAdjustedXP, actualAdjustedXP),
	)
	return roster
}

func computeEncounterDraftMetrics(items []encounterDraftItem, partySize int) (int, int) {
	baseXP := 0
	monsterCount := 0
	for _, item := range items {
		quantity := item.Quantity
		if quantity < 1 {
			quantity = 1
		}
		monsterCount += quantity
		baseXP += quantity * experienceForDraftEntity(item.Entity)
	}

	multiplier := encounterMultiplier(monsterCount, partySize)
	adjustedXP := int(math.Round(float64(baseXP) * multiplier))
	return baseXP, adjustedXP
}

func experienceForDraftEntity(entity createEntityInput) int {
	if entity.StatBlock == nil {
		return 0
	}
	return parseChallengeExperience(entity.StatBlock.Challenge)
}

func resolveTargetAdjustedXP(input generateCombatInput) int {
	if strings.EqualFold(strings.TrimSpace(input.Difficulty), "custom") && input.CustomAdjustedXP > 0 {
		return input.CustomAdjustedXP
	}

	target := targetThresholdValue(input.Thresholds, input.Difficulty)
	if target > 0 {
		return target
	}

	return input.Thresholds.Medium
}

func normalizeEncounterMonsterCount(value int) int {
	if value < 1 {
		return 1
	}
	if value > 16 {
		return 16
	}
	return value
}

func createEncounterMonsterSeed(input generateCombatInput, challenge string, challengeXP int) createEntityInput {
	importance := "Standard"
	switch strings.ToLower(strings.TrimSpace(input.Difficulty)) {
	case "easy":
		importance = "Minion"
	case "hard":
		importance = "Elite"
	case "deadly", "custom":
		importance = "Boss"
	}

	seed := buildMonsterDraft(strings.TrimSpace(input.Prompt))
	seed.Kind = "monster"
	seed.Status = "Hostile"
	seed.Importance = importance
	seed.Tags = ensureEncounterTags(seed.Tags, input.Difficulty)

	if strings.TrimSpace(seed.Role) == "" {
		seed.Role = "Encounter threat"
	}
	if seed.StatBlock == nil {
		seed.StatBlock = defaultMonsterStatBlock(firstNonEmpty(seed.Title, "Encounter Monster"))
	}
	if strings.TrimSpace(seed.StatBlock.Challenge) == "" && challenge != "" && challengeXP > 0 {
		seed.StatBlock.Challenge = fmt.Sprintf("%s (%d XP)", challenge, challengeXP)
	}
	if strings.TrimSpace(seed.StatBlock.ArmorClass) == "" {
		seed.StatBlock.ArmorClass = "13"
	}
	if strings.TrimSpace(seed.StatBlock.HitPoints) == "" {
		seed.StatBlock.HitPoints = "45 (6d10 + 12)"
	}
	if strings.TrimSpace(seed.StatBlock.Speed) == "" {
		seed.StatBlock.Speed = "30 ft."
	}
	if len(seed.StatBlock.Actions) == 0 {
		seed.StatBlock.Actions = []statBlockEntry{
			{Name: "Strike", ToHit: "+4 to hit", Damage: "2d6 + 2 damage", Description: "Fallback encounter attack used when the source draft omitted actions."},
		}
	}

	return seed
}

func defaultEncounterTitle(entities []knowledgeEntity) string {
	if len(entities) == 0 {
		return "Активный бой"
	}
	if len(entities) == 1 {
		return "Бой: " + entities[0].Title
	}
	return "Бой: " + entities[0].Title + " и союзники"
}

func cleanEncounterTitle(entities []knowledgeEntity) string {
	if len(entities) == 0 {
		return "Активный бой"
	}
	if len(entities) == 1 {
		return "Бой: " + entities[0].Title
	}
	return "Бой: " + entities[0].Title + " и союзники"
}

func ensureEncounterTags(tags []string, difficulty string) []string {
	result := sanitizeTags(tags)
	result = append(result, "encounter-generated")
	if normalized := strings.ToLower(strings.TrimSpace(difficulty)); normalized != "" {
		result = append(result, normalized)
	}
	return sanitizeTags(result)
}
