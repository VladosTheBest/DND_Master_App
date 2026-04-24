package httpapi

import "math"

type encounterArchetype struct {
	Builder func() createEntityInput
	XP      int
	Leader  bool
}

func buildThemedEncounterDraft(input generateCombatInput, targetAdjustedXP int) (generateEncounterDraftResult, bool) {
	if containsAny(input.Prompt, "bandit", "бандит", "разбой", "brigand", "raider", "outlaw", "highwayman") {
		return buildBanditEncounterDraft(input, targetAdjustedXP), true
	}

	return generateEncounterDraftResult{}, false
}

func buildBanditEncounterDraft(input generateCombatInput, targetAdjustedXP int) generateEncounterDraftResult {
	count := normalizeEncounterMonsterCount(input.MonsterCount)
	partySize := input.PartySize
	if len(input.PartyLevels) > 0 {
		partySize = len(normalizePartyLevels(input.PartyLevels))
	}
	multiplier := encounterMultiplier(count, partySize)
	minimumAdjustedXP := int(math.Round(float64(count*25) * multiplier))
	if targetAdjustedXP < minimumAdjustedXP {
		targetAdjustedXP = minimumAdjustedXP
	}

	leaderRequested := containsAny(input.Prompt, "leader", "глав", "captain", "chief", "boss")
	archetypes := []encounterArchetype{
		{Builder: buildOfficialBanditDraft, XP: 25},
		{Builder: buildOfficialScoutDraft, XP: 100},
		{Builder: buildOfficialThugDraft, XP: 100},
		{Builder: buildOfficialBanditCaptainDraft, XP: 450, Leader: true},
		{Builder: buildOfficialVeteranDraft, XP: 700, Leader: true},
		{Builder: buildOfficialGladiatorDraft, XP: 1800, Leader: true},
	}

	counts := chooseEncounterCounts(archetypes, count, targetAdjustedXP, partySize, leaderRequested)
	items := make([]encounterDraftItem, 0, len(archetypes))
	for index, quantity := range counts {
		if quantity <= 0 {
			continue
		}

		items = append(items, encounterDraftItem{
			Quantity: quantity,
			Entity:   archetypes[index].Builder(),
		})
	}

	if len(items) == 0 {
		items = append(items, encounterDraftItem{
			Quantity: count,
			Entity:   buildOfficialBanditDraft(),
		})
	}

	return generateEncounterDraftResult{
		Provider: "theme-bandit",
		Notes: []string{
			"Encounter tuned by the server for a bandit-style roster.",
			"Target adjusted XP is tuned against the requested count and party thresholds.",
		},
		Items: items,
	}
}

func chooseEncounterCounts(archetypes []encounterArchetype, totalCount int, targetAdjustedXP int, partySize int, leaderRequested bool) []int {
	bestCounts := make([]int, len(archetypes))
	current := make([]int, len(archetypes))
	bestScore := math.MaxInt
	bestAdjustedXP := 0
	multiplier := encounterMultiplier(totalCount, partySize)
	tolerance := encounterTargetTolerance(targetAdjustedXP)

	var walk func(index int, remaining int, sumXP int, leaders int)
	walk = func(index int, remaining int, sumXP int, leaders int) {
		if index == len(archetypes) {
			if remaining != 0 {
				return
			}

			adjustedXP := int(math.Round(float64(sumXP) * multiplier))
			score := absInt(adjustedXP - targetAdjustedXP)
			if score > tolerance {
				score += (score - tolerance) * 3
			}
			minAcceptable := targetAdjustedXP - tolerance
			if adjustedXP < minAcceptable {
				score += (minAcceptable - adjustedXP) * 4
			}
			maxAcceptable := targetAdjustedXP + tolerance
			if adjustedXP > maxAcceptable {
				score += (adjustedXP - maxAcceptable) * 2
			}
			if leaderRequested && totalCount > 1 && leaders == 0 {
				score += 5000
			}
			if !leaderRequested && totalCount > 1 && targetAdjustedXP >= 900 && leaders == 0 {
				score += 600
			}
			if leaders > 1 {
				score += (leaders - 1) * 120
			}

			if score < bestScore || (score == bestScore && adjustedXP > bestAdjustedXP) {
				bestScore = score
				bestAdjustedXP = adjustedXP
				copy(bestCounts, current)
			}
			return
		}

		for quantity := 0; quantity <= remaining; quantity++ {
			current[index] = quantity
			nextLeaders := leaders
			if archetypes[index].Leader {
				nextLeaders += quantity
			}
			walk(index+1, remaining-quantity, sumXP+quantity*archetypes[index].XP, nextLeaders)
		}
		current[index] = 0
	}

	walk(0, totalCount, 0, 0)
	return bestCounts
}

func buildBanditRaiderDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Разбойник-налетчик",
		Subtitle:   "Рядовой грабитель и участник засады",
		Summary:    "Лёгкий бандит, который давит числом и бьёт по ослабленным целям.",
		Content:    "Разбойник-налетчик держится рядом с шайкой, ищет фланг и отступает, если бой складывается не в его пользу.",
		Tags:       []string{"ai-draft", "monster", "bandit", "raider"},
		Role:       "Skirmisher",
		Status:     "Hostile",
		Importance: "Minion",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "12 (leather armor)",
			HitPoints:        "11 (2d8 + 2)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/8 (25 XP)",
			Senses:           "passive Perception 10",
			Languages:        "Common",
			AbilityScores:    abilityScores{STR: 11, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10},
			Actions: []statBlockEntry{
				{Name: "Scimitar", ToHit: "+3 to hit", Damage: "1d6 + 1 slashing damage", Description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target."},
				{Name: "Light Crossbow", ToHit: "+3 to hit", Damage: "1d8 + 1 piercing damage", Description: "Ranged Weapon Attack: +3 to hit, range 80/320 ft., one target."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(false),
	}
}

func buildBanditScoutDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Разбойник-разведчик",
		Subtitle:   "Меткий стрелок и дозорный шайки",
		Summary:    "Ставит метки, держит дистанцию и помогает вести преследование.",
		Content:    "Разбойник-разведчик работает из укрытия, первым замечает засаду и старается снимать опасные цели издалека.",
		Tags:       []string{"ai-draft", "monster", "bandit", "scout"},
		Role:       "Ranged support",
		Status:     "Hostile",
		Importance: "Standard",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "13 (leather armor)",
			HitPoints:        "16 (3d8 + 3)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/4 (50 XP)",
			Senses:           "passive Perception 13",
			Skills:           "Perception +3, Stealth +4",
			Languages:        "Common",
			AbilityScores:    abilityScores{STR: 10, DEX: 15, CON: 12, INT: 10, WIS: 13, CHA: 10},
			Traits: []statBlockEntry{
				{Name: "Nimble Escape", Description: "The scout can take the Disengage or Hide action as a bonus action on each of its turns."},
			},
			Actions: []statBlockEntry{
				{Name: "Shortsword", ToHit: "+4 to hit", Damage: "1d6 + 2 piercing damage", Description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target."},
				{Name: "Shortbow", ToHit: "+4 to hit", Damage: "1d6 + 2 piercing damage", Description: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(false),
	}
}

func buildBanditBruiserDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Разбойник-громила",
		Subtitle:   "Силовик шайки для ближнего боя",
		Summary:    "Ломает строй, прикрывает отход и давит фронт грубой силой.",
		Content:    "Разбойник-громила идёт в ближний бой первым, старается выбить щитоносцев и блокирует узкие проходы.",
		Tags:       []string{"ai-draft", "monster", "bandit", "bruiser"},
		Role:       "Frontliner",
		Status:     "Hostile",
		Importance: "Standard",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "13 (studded leather)",
			HitPoints:        "32 (5d8 + 10)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/2 (100 XP)",
			Senses:           "passive Perception 10",
			Languages:        "Common",
			AbilityScores:    abilityScores{STR: 15, DEX: 12, CON: 14, INT: 9, WIS: 10, CHA: 10},
			Traits: []statBlockEntry{
				{Name: "Press the Weak", Description: "The bruiser deals an extra 1d4 damage against creatures that are prone or restrained."},
			},
			Actions: []statBlockEntry{
				{Name: "Mace", ToHit: "+4 to hit", Damage: "1d6 + 2 bludgeoning damage", Description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target."},
				{Name: "Heavy Crossbow", ToHit: "+3 to hit", Damage: "1d10 + 1 piercing damage", Description: "Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(false),
	}
}

func buildBanditCaptainDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Капитан шайки",
		Subtitle:   "Тактик засады и координатор налета",
		Summary:    "Держит банду в строю, выбирает цели и усиливает давление на самую уязвимую цель.",
		Content:    "Капитан шайки прячется за укрытием, раздаёт приказы и вступает в бой, когда видит шанс быстро сломать строй партии.",
		Tags:       []string{"ai-draft", "monster", "bandit", "captain"},
		Role:       "Leader",
		Status:     "Hostile",
		Importance: "Elite",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "15 (studded leather, shield)",
			HitPoints:        "65 (10d8 + 20)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "2 (450 XP)",
			Senses:           "passive Perception 12",
			Languages:        "Common plus one other",
			AbilityScores:    abilityScores{STR: 14, DEX: 16, CON: 14, INT: 11, WIS: 12, CHA: 14},
			Traits: []statBlockEntry{
				{Name: "Command Ally", Description: "Once on each of its turns, the captain can let one allied bandit within 30 feet make one weapon attack as a reaction."},
			},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "The captain makes two scimitar attacks."},
				{Name: "Scimitar", ToHit: "+5 to hit", Damage: "1d6 + 3 slashing damage", Description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target."},
				{Name: "Light Crossbow", ToHit: "+5 to hit", Damage: "1d8 + 3 piercing damage", Description: "Ranged Weapon Attack: +5 to hit, range 80/320 ft., one target."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(true),
	}
}

func buildBanditVeteranDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Ветеран налетчиков",
		Subtitle:   "Опытный боец, переживший десятки стычек",
		Summary:    "Сильный командир звена, который держит фронт и быстро добивает раненых.",
		Content:    "Ветеран налетчиков не тратит движения зря, выбирает опасную цель и методично ломает сопротивление на передней линии.",
		Tags:       []string{"ai-draft", "monster", "bandit", "veteran"},
		Role:       "Elite striker",
		Status:     "Hostile",
		Importance: "Elite",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "17 (chain shirt, shield)",
			HitPoints:        "58 (9d8 + 18)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "3 (700 XP)",
			Senses:           "passive Perception 11",
			Languages:        "Common plus one other",
			AbilityScores:    abilityScores{STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 11},
			Traits: []statBlockEntry{
				{Name: "Battle Rhythm", Description: "When the veteran hits the same target twice in one turn, that target has disadvantage on its next attack roll before the end of its next turn."},
			},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "The veteran makes two weapon attacks."},
				{Name: "Longsword", ToHit: "+5 to hit", Damage: "1d8 + 3 slashing damage", Description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target."},
				{Name: "Heavy Crossbow", ToHit: "+3 to hit", Damage: "1d10 + 1 piercing damage", Description: "Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(true),
	}
}

func buildBanditChampionDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Атаман разбойников",
		Subtitle:   "Жестокий лидер крупной шайки",
		Summary:    "Тяжёлая цель для опасных засад и кульминационных столкновений с бандой.",
		Content:    "Атаман разбойников ведёт бой лично, давит мораль партии и использует подручных как живой щит, пока не увидит шанс добить цель.",
		Tags:       []string{"ai-draft", "monster", "bandit", "warlord"},
		Role:       "Boss leader",
		Status:     "Hostile",
		Importance: "Boss",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "17 (breastplate)",
			HitPoints:        "95 (10d10 + 40)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+3",
			Challenge:        "5 (1800 XP)",
			Senses:           "passive Perception 13",
			Languages:        "Common plus two others",
			AbilityScores:    abilityScores{STR: 18, DEX: 14, CON: 18, INT: 11, WIS: 12, CHA: 15},
			Traits: []statBlockEntry{
				{Name: "Tyrant's Command", Description: "Allied bandits within 30 feet add +2 to attack rolls while the ataman is not incapacitated."},
			},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "The ataman makes three weapon attacks."},
				{Name: "Sabre", ToHit: "+7 to hit", Damage: "1d8 + 4 slashing damage", Description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target."},
				{Name: "Pistol Shot", ToHit: "+6 to hit", Damage: "2d10 + 2 piercing damage", Description: "Ranged Weapon Attack: +6 to hit, range 30/90 ft., one target."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(true),
	}
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func encounterTargetTolerance(targetAdjustedXP int) int {
	switch {
	case targetAdjustedXP >= 1500:
		return 200
	case targetAdjustedXP >= 600:
		return 125
	default:
		return 75
	}
}
