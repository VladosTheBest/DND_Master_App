package httpapi

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

type encounterTier struct {
	min        int
	max        int
	multiplier float64
}

var encounterTiers = []encounterTier{
	{min: 1, max: 1, multiplier: 1},
	{min: 2, max: 2, multiplier: 1.5},
	{min: 3, max: 6, multiplier: 2},
	{min: 7, max: 10, multiplier: 2.5},
	{min: 11, max: 14, multiplier: 3},
	{min: 15, max: 1_000_000, multiplier: 4},
}

var challengeExperienceTable = map[string]int{
	"0":   10,
	"1/8": 25,
	"1/4": 50,
	"1/2": 100,
	"1":   200,
	"2":   450,
	"3":   700,
	"4":   1100,
	"5":   1800,
	"6":   2300,
	"7":   2900,
	"8":   3900,
	"9":   5000,
	"10":  5900,
	"11":  7200,
	"12":  8400,
	"13":  10000,
	"14":  11500,
	"15":  13000,
	"16":  15000,
	"17":  18000,
	"18":  20000,
	"19":  22000,
	"20":  25000,
	"21":  33000,
	"22":  41000,
	"23":  50000,
	"24":  62000,
	"25":  75000,
	"26":  90000,
	"27":  105000,
	"28":  120000,
	"29":  135000,
	"30":  155000,
}

var characterThresholdTable = map[int]combatThresholds{
	1:  {Easy: 25, Medium: 50, Hard: 75, Deadly: 100},
	2:  {Easy: 50, Medium: 100, Hard: 150, Deadly: 200},
	3:  {Easy: 75, Medium: 150, Hard: 225, Deadly: 400},
	4:  {Easy: 125, Medium: 250, Hard: 375, Deadly: 500},
	5:  {Easy: 250, Medium: 500, Hard: 750, Deadly: 1100},
	6:  {Easy: 300, Medium: 600, Hard: 900, Deadly: 1400},
	7:  {Easy: 350, Medium: 750, Hard: 1100, Deadly: 1700},
	8:  {Easy: 450, Medium: 900, Hard: 1400, Deadly: 2100},
	9:  {Easy: 550, Medium: 1100, Hard: 1600, Deadly: 2400},
	10: {Easy: 600, Medium: 1200, Hard: 1900, Deadly: 2800},
	11: {Easy: 800, Medium: 1600, Hard: 2400, Deadly: 3600},
	12: {Easy: 1000, Medium: 2000, Hard: 3000, Deadly: 4500},
	13: {Easy: 1100, Medium: 2200, Hard: 3400, Deadly: 5100},
	14: {Easy: 1250, Medium: 2500, Hard: 3800, Deadly: 5700},
	15: {Easy: 1400, Medium: 2800, Hard: 4300, Deadly: 6400},
	16: {Easy: 1600, Medium: 3200, Hard: 4800, Deadly: 7200},
	17: {Easy: 2000, Medium: 3900, Hard: 5900, Deadly: 8800},
	18: {Easy: 2100, Medium: 4200, Hard: 6300, Deadly: 9500},
	19: {Easy: 2400, Medium: 4900, Hard: 7300, Deadly: 10900},
	20: {Easy: 2800, Medium: 5700, Hard: 8500, Deadly: 12700},
}

func findKnowledgeEntity(campaign campaignData, entityID string) (knowledgeEntity, bool) {
	for _, entity := range campaignEntities(campaign) {
		if entity.ID == entityID {
			return entity, true
		}
	}
	return knowledgeEntity{}, false
}

func parseChallengeExperience(challenge string) int {
	token := parseChallengeToken(challenge)
	if token != "" {
		if xp, ok := challengeExperienceTable[token]; ok {
			return xp
		}
	}

	trimmed := strings.TrimSpace(challenge)
	if trimmed == "" {
		return 0
	}

	fallbackToken := trimmed
	for _, separator := range []string{" ", "("} {
		if before, _, ok := strings.Cut(fallbackToken, separator); ok {
			fallbackToken = before
		}
	}

	fallbackToken = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(fallbackToken), "cr"))
	fallbackToken = strings.TrimSpace(strings.TrimPrefix(fallbackToken, "по"))
	fallbackToken = strings.TrimSpace(fallbackToken)

	if xp, ok := challengeExperienceTable[fallbackToken]; ok {
		return xp
	}

	return 0
}

func parseChallengeToken(challenge string) string {
	token := strings.TrimSpace(strings.ToLower(challenge))
	if token == "" {
		return ""
	}

	for _, prefix := range []string{"cr", "challenge", "challenge rating", "опасность", "рїрѕ"} {
		if strings.HasPrefix(token, prefix) {
			token = strings.TrimSpace(strings.TrimPrefix(token, prefix))
			break
		}
	}

	if before, _, ok := strings.Cut(token, "("); ok {
		token = before
	}

	token = strings.TrimSpace(token)
	fields := strings.Fields(token)
	if len(fields) > 0 {
		token = fields[0]
	}

	token = strings.TrimSpace(strings.Trim(token, ":.-"))
	return token
}

func parseMaximumHitPoints(statBlock *npcStatBlock) int {
	if statBlock == nil {
		return 1
	}

	value := strings.TrimSpace(statBlock.HitPoints)
	if value == "" {
		return 1
	}

	digits := strings.Builder{}
	for _, symbol := range value {
		if symbol < '0' || symbol > '9' {
			if digits.Len() > 0 {
				break
			}
			continue
		}
		digits.WriteRune(symbol)
	}

	if digits.Len() == 0 {
		return 1
	}

	var parsed int
	for _, symbol := range digits.String() {
		parsed = parsed*10 + int(symbol-'0')
	}
	if parsed <= 0 {
		return 1
	}

	return parsed
}

func normalizeCombatThresholds(thresholds combatThresholds) combatThresholds {
	if thresholds.Easy < 0 {
		thresholds.Easy = 0
	}
	if thresholds.Medium < thresholds.Easy {
		thresholds.Medium = thresholds.Easy
	}
	if thresholds.Hard < thresholds.Medium {
		thresholds.Hard = thresholds.Medium
	}
	if thresholds.Deadly < thresholds.Hard {
		thresholds.Deadly = thresholds.Hard
	}
	return thresholds
}

func normalizePartyLevels(levels []int) []int {
	result := make([]int, 0, len(levels))
	for _, level := range levels {
		switch {
		case level < 1:
			level = 1
		case level > 20:
			level = 20
		}
		result = append(result, level)
	}
	return result
}

func computePartyThresholds(levels []int, partySize int, fallback combatThresholds) combatThresholds {
	normalizedLevels := normalizePartyLevels(levels)
	if len(normalizedLevels) == 0 {
		return normalizeCombatThresholds(fallback)
	}

	var thresholds combatThresholds
	for _, level := range normalizedLevels {
		perCharacter, ok := characterThresholdTable[level]
		if !ok {
			continue
		}
		thresholds.Easy += perCharacter.Easy
		thresholds.Medium += perCharacter.Medium
		thresholds.Hard += perCharacter.Hard
		thresholds.Deadly += perCharacter.Deadly
	}

	if thresholds.Easy == 0 && thresholds.Medium == 0 && thresholds.Hard == 0 && thresholds.Deadly == 0 {
		return normalizeCombatThresholds(fallback)
	}

	return normalizeCombatThresholds(thresholds)
}

func normalizePartySize(value int) int {
	if value < 1 {
		return 4
	}
	return value
}

func encounterMultiplier(monsterCount int, partySize int) float64 {
	if monsterCount <= 0 {
		return 1
	}

	index := len(encounterTiers) - 1
	for tierIndex, tier := range encounterTiers {
		if monsterCount >= tier.min && monsterCount <= tier.max {
			index = tierIndex
			break
		}
	}

	switch {
	case partySize < 3 && index < len(encounterTiers)-1:
		index++
	case partySize >= 6 && index > 0:
		index--
	case partySize < 3 && index == len(encounterTiers)-1:
		return 5
	case partySize >= 6 && index == 0:
		return 0.5
	}

	return encounterTiers[index].multiplier
}

func computeCombatMetrics(entries []combatEntry, partySize int) (baseXP int, adjustedXP int) {
	hostileCount := 0
	for _, entry := range entries {
		if combatEntrySide(entry) != "enemy" {
			continue
		}
		baseXP += entry.Experience
		if entry.Experience > 0 {
			hostileCount++
		}
	}
	multiplier := encounterMultiplier(hostileCount, partySize)
	adjustedXP = int(math.Round(float64(baseXP) * multiplier))
	return baseXP, adjustedXP
}

func deriveCombatDifficulty(adjustedXP int, thresholds combatThresholds) string {
	switch {
	case adjustedXP <= 0:
		return ""
	case adjustedXP >= thresholds.Deadly && thresholds.Deadly > 0:
		return "deadly"
	case adjustedXP >= thresholds.Hard && thresholds.Hard > 0:
		return "hard"
	case adjustedXP >= thresholds.Medium && thresholds.Medium > 0:
		return "medium"
	default:
		return "easy"
	}
}

func buildCombatEntry(entity knowledgeEntity, sequence int, initiative int) combatEntry {
	maxHitPoints := parseMaximumHitPoints(entity.StatBlock)
	title := entity.Title
	if sequence > 1 {
		title = fmt.Sprintf("%s #%d", entity.Title, sequence)
	}
	challenge := challengeForEntityCombat(entity)

	side := "enemy"
	if entity.Kind == "player" {
		side = "player"
	}

	return combatEntry{
		ID:               newID("combat-entry"),
		EntityID:         entity.ID,
		EntityKind:       entity.Kind,
		Side:             side,
		Title:            title,
		Summary:          entity.Summary,
		Role:             entity.Role,
		ArmorClass:       armorClassForCombat(entity.StatBlock),
		Initiative:       initiative,
		Challenge:        challenge,
		Experience:       parseChallengeExperience(challenge),
		MaxHitPoints:     maxHitPoints,
		CurrentHitPoints: maxHitPoints,
		Defeated:         false,
		StatBlock:        entity.StatBlock,
	}
}

func buildManualCombatEntry(input manualCombatantInput) combatEntry {
	maxHitPoints := input.MaxHitPoints
	if maxHitPoints < 0 {
		maxHitPoints = 0
	}
	currentHitPoints := input.CurrentHitPoints
	if currentHitPoints <= 0 {
		currentHitPoints = maxHitPoints
	}
	if maxHitPoints > 0 && currentHitPoints > maxHitPoints {
		currentHitPoints = maxHitPoints
	}
	if maxHitPoints == 0 {
		currentHitPoints = 0
	}

	entityID := newID("combat-player")
	return combatEntry{
		ID:               newID("combat-entry"),
		EntityID:         entityID,
		EntityKind:       "player",
		Side:             "player",
		Title:            firstNonEmpty(strings.TrimSpace(input.Title), "Игрок"),
		Summary:          "Ручной участник инициативы.",
		Role:             firstNonEmpty(strings.TrimSpace(input.Role), "Player character"),
		ArmorClass:       firstNonEmpty(strings.TrimSpace(input.ArmorClass), "—"),
		Initiative:       input.Initiative,
		Experience:       0,
		MaxHitPoints:     maxHitPoints,
		CurrentHitPoints: currentHitPoints,
		Defeated:         maxHitPoints > 0 && currentHitPoints <= 0,
		StatBlock:        nil,
	}
}

func combatEntrySide(entry combatEntry) string {
	side := strings.ToLower(strings.TrimSpace(entry.Side))
	if side == "player" {
		return "player"
	}
	return "enemy"
}

func initiativeOrderedCombatEntries(entries []combatEntry, includeDefeated bool) []combatEntry {
	ordered := make([]combatEntry, 0, len(entries))
	for _, entry := range entries {
		if !includeDefeated && (entry.Defeated || entry.CurrentHitPoints <= 0) {
			continue
		}
		ordered = append(ordered, entry)
	}

	sort.SliceStable(ordered, func(left, right int) bool {
		if ordered[left].Initiative != ordered[right].Initiative {
			return ordered[left].Initiative > ordered[right].Initiative
		}
		leftSide := combatEntrySide(ordered[left])
		rightSide := combatEntrySide(ordered[right])
		if leftSide != rightSide {
			return leftSide == "player"
		}
		return ordered[left].Title < ordered[right].Title
	})

	return ordered
}

func normalizeCombatTurn(combat *activeCombat) {
	if combat == nil {
		return
	}

	ordered := initiativeOrderedCombatEntries(combat.Entries, false)
	if len(ordered) == 0 {
		ordered = initiativeOrderedCombatEntries(combat.Entries, true)
	}
	if len(ordered) == 0 {
		combat.Round = 0
		combat.CurrentTurnEntryID = ""
		return
	}
	if combat.Round <= 0 {
		combat.Round = 1
	}

	for _, entry := range ordered {
		if entry.ID == combat.CurrentTurnEntryID {
			return
		}
	}

	combat.CurrentTurnEntryID = ordered[0].ID
}

func advanceCombatTurn(combat *activeCombat) {
	if combat == nil {
		return
	}

	ordered := initiativeOrderedCombatEntries(combat.Entries, false)
	if len(ordered) == 0 {
		ordered = initiativeOrderedCombatEntries(combat.Entries, true)
	}
	if len(ordered) == 0 {
		combat.Round = 0
		combat.CurrentTurnEntryID = ""
		return
	}
	if combat.Round <= 0 {
		combat.Round = 1
	}

	currentIndex := -1
	for index, entry := range ordered {
		if entry.ID == combat.CurrentTurnEntryID {
			currentIndex = index
			break
		}
	}

	if currentIndex == -1 {
		combat.CurrentTurnEntryID = ordered[0].ID
		return
	}

	nextIndex := currentIndex + 1
	if nextIndex >= len(ordered) {
		nextIndex = 0
		combat.Round++
	}
	combat.CurrentTurnEntryID = ordered[nextIndex].ID
}

func armorClassForCombat(statBlock *npcStatBlock) string {
	if statBlock == nil || strings.TrimSpace(statBlock.ArmorClass) == "" {
		return "10"
	}
	return strings.TrimSpace(statBlock.ArmorClass)
}

func challengeForEntityCombat(entity knowledgeEntity) string {
	if entity.StatBlock != nil {
		if challenge := strings.TrimSpace(entity.StatBlock.Challenge); challenge != "" {
			return challenge
		}
	}

	if challenge := challengeFromQuickFacts(entity.QuickFacts); challenge != "" {
		return challenge
	}

	return strings.TrimSpace(entity.Danger)
}

func experienceForEntity(entity knowledgeEntity) int {
	return parseChallengeExperience(challengeForEntityCombat(entity))
}

func challengeForCombatEntry(entry combatEntry) string {
	if challenge := strings.TrimSpace(entry.Challenge); challenge != "" {
		return challenge
	}
	if entry.StatBlock != nil {
		return strings.TrimSpace(entry.StatBlock.Challenge)
	}
	return ""
}

func experienceForCombatEntry(entry combatEntry) int {
	return parseChallengeExperience(challengeForCombatEntry(entry))
}

func challengeFromQuickFacts(facts []quickFact) string {
	for _, fact := range facts {
		if !isChallengeQuickFactLabel(fact.Label) {
			continue
		}
		if value := strings.TrimSpace(fact.Value); value != "" {
			return value
		}
	}
	return ""
}

func isChallengeQuickFactLabel(label string) bool {
	normalized := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(label)), " ", "")
	switch normalized {
	case "cr", "cr/xp", "challenge", "challengerating", "опасность", "опасность/cr", "cr/опасность":
		return true
	default:
		return false
	}
}

func targetThresholdValue(thresholds combatThresholds, difficulty string) int {
	switch strings.ToLower(strings.TrimSpace(difficulty)) {
	case "easy":
		return thresholds.Easy
	case "medium":
		return thresholds.Medium
	case "hard":
		return thresholds.Hard
	case "deadly":
		return thresholds.Deadly
	case "custom":
		return thresholds.Deadly
	default:
		return thresholds.Medium
	}
}

func nearestChallengeByExperience(targetXP int) (string, int) {
	if targetXP <= 0 {
		return "0", 10
	}

	bestChallenge := "0"
	bestXP := 10
	bestDistance := math.MaxInt

	for challenge, xp := range challengeExperienceTable {
		distance := xp - targetXP
		if distance < 0 {
			distance = -distance
		}
		if distance < bestDistance {
			bestDistance = distance
			bestChallenge = challenge
			bestXP = xp
		}
	}

	return bestChallenge, bestXP
}
