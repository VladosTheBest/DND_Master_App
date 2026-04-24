package httpapi

import "strings"

func officialMonsterDraft(prompt string, title string) (createEntityInput, bool) {
	haystack := normalizeEntityTitle(strings.TrimSpace(title) + " " + strings.TrimSpace(prompt))

	switch {
	case containsAll(haystack, []string{"bandit", "captain"}) ||
		(containsAny(haystack, "капитан", "captain") && containsAny(haystack, "bandit", "brigand", "raider", "outlaw", "highwayman", "бандит", "разбой")) ||
		containsAny(haystack, "капитан разбойников", "капитана разбойников", "главарь разбойников", "главарь банды", "главарь шайки") ||
		(containsAny(haystack, "leader", "captain", "chief", "boss", "главарь", "лидер") && containsAny(haystack, "bandit", "brigand", "raider", "outlaw", "highwayman", "бандит", "разбой")):
		return buildOfficialBanditCaptainDraft(), true
	case containsAny(haystack, "veteran", "ветеран"):
		return buildOfficialVeteranDraft(), true
	case containsAny(haystack, "gladiator", "гладиатор", "champion", "чемпион"):
		return buildOfficialGladiatorDraft(), true
	case containsAny(haystack, "thug", "головорез", "bruiser", "громила"):
		return buildOfficialThugDraft(), true
	case containsAny(haystack, "scout", "разведчик", "лучник", "archer"):
		return buildOfficialScoutDraft(), true
	case containsAny(haystack, "giant spider", "гигантский паук", "гигантского паука", "spider", "паук"):
		return buildOfficialGiantSpiderDraft(), true
	case containsAny(haystack, "wolf", "волк"):
		return buildOfficialWolfDraft(), true
	case containsAny(haystack, "bandit", "brigand", "raider", "outlaw", "highwayman", "бандит", "разбойник", "разбой"):
		return buildOfficialBanditDraft(), true
	default:
		return createEntityInput{}, false
	}
}

func containsAll(value string, options []string) bool {
	for _, option := range options {
		if !containsAny(value, option) {
			return false
		}
	}
	return true
}

func isPlaceholderMonsterTitle(title string) bool {
	normalized := normalizeEncounterTitleKey(title)
	switch normalized {
	case "", "monster", "new monster", "generated monster", "новый монстр", "сгенерированный монстр", "безымянный монстр":
		return true
	default:
		return false
	}
}

func buildOfficialWolfDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Волк",
		Subtitle:   "Официальный зверь из бестиария D&D 5e",
		Summary:    "Стайный хищник, который давит целью в ближнем бою и старается опрокинуть жертву.",
		Content:    "Волк лучше всего работает рядом с союзниками: заходит во фланг, использует скорость и добивает отставших.",
		Tags:       []string{"ai-draft", "monster", "beast", "wolf", "dndsu-reference"},
		Role:       "Pack hunter",
		Status:     "Hostile",
		Importance: "Standard",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "beast",
			Alignment:        "unaligned",
			ArmorClass:       "13 (natural armor)",
			HitPoints:        "11 (2d8 + 2)",
			Speed:            "40 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/4 (50 XP)",
			Senses:           "passive Perception 13",
			Skills:           "Perception +3, Stealth +4",
			Languages:        "—",
			AbilityScores:    abilityScores{STR: 12, DEX: 15, CON: 12, INT: 3, WIS: 12, CHA: 6},
			Traits: []statBlockEntry{
				{Name: "Keen Hearing and Smell", Description: "Волк получает преимущество на проверки Внимательности, завязанные на слух или запах."},
				{Name: "Pack Tactics", Description: "Если у цели есть союзник волка в пределах 5 футов, волк получает преимущество на бросок атаки по этой цели."},
			},
			Actions: []statBlockEntry{
				{Name: "Bite", ToHit: "+4 to hit", Damage: "2d4 + 2 piercing damage", SaveDC: "DC 11 Strength", Description: "При попадании по существу цель должна пройти спасбросок Силы, иначе падает ничком."},
			},
		},
		RewardProfile: defaultMonsterRewardProfile("wolf", "Волк"),
	}
}

func buildOfficialGiantSpiderDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Гигантский паук",
		Subtitle:   "Официальный зверь из бестиария D&D 5e",
		Summary:    "Хищник-засадник, который удерживает цель паутиной и добивает ядовитым укусом.",
		Content:    "Гигантский паук особенно опасен в тесных проходах, на стенах и в тёмных залах, где может первым навязать дистанцию и контроль.",
		Tags:       []string{"ai-draft", "monster", "beast", "spider", "dndsu-reference"},
		Role:       "Ambush controller",
		Status:     "Hostile",
		Importance: "Standard",
		StatBlock: &npcStatBlock{
			Size:             "Large",
			CreatureType:     "beast",
			Alignment:        "unaligned",
			ArmorClass:       "14 (natural armor)",
			HitPoints:        "26 (4d10 + 4)",
			Speed:            "30 ft., climb 30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1 (200 XP)",
			Senses:           "blindsight 10 ft., darkvision 60 ft., passive Perception 10",
			Skills:           "Stealth +7",
			Languages:        "—",
			AbilityScores:    abilityScores{STR: 14, DEX: 16, CON: 12, INT: 2, WIS: 11, CHA: 4},
			Traits: []statBlockEntry{
				{Name: "Spider Climb", Description: "Паук может карабкаться по сложным поверхностям и потолкам без дополнительных проверок."},
				{Name: "Web Sense", Description: "Находясь в контакте с паутиной, паук точно знает, где находится другое существо, касающееся той же паутины."},
				{Name: "Web Walker", Description: "Паук игнорирует ограничения перемещения от собственной паутины."},
			},
			Actions: []statBlockEntry{
				{Name: "Bite", ToHit: "+5 to hit", Damage: "1d8 + 3 piercing damage plus 2d8 poison damage", SaveDC: "DC 11 Constitution", Description: "При провале спасброска цель получает полный урон ядом; при успехе - половину."},
				{Name: "Web (Recharge 5-6)", ToHit: "+5 to hit", SaveDC: "DC 12 Strength", Description: "Дальнобойная атака паутиной. Попавшая цель становится restrained, пока не вырвется проверкой Силы."},
			},
		},
		RewardProfile: defaultMonsterRewardProfile("spider", "Гигантский паук"),
	}
}

func buildOfficialBanditDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Разбойник",
		Subtitle:   "Официальный гуманоид из бестиария D&D 5e",
		Summary:    "Базовый налётчик, который опасен числом, фокусом целей и постоянным огнём из лука или арбалета.",
		Content:    "Разбойник не любит честный размен ударами: он держится рядом с шайкой, ищет слабую цель и быстро отходит, если бой складывается плохо.",
		Tags:       []string{"ai-draft", "monster", "humanoid", "bandit", "dndsu-reference"},
		Role:       "Skirmisher",
		Status:     "Hostile",
		Importance: "Minion",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-lawful alignment",
			ArmorClass:       "12 (leather armor)",
			HitPoints:        "11 (2d8 + 2)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/8 (25 XP)",
			Senses:           "passive Perception 10",
			Languages:        "any one language (usually Common)",
			AbilityScores:    abilityScores{STR: 11, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10},
			Actions: []statBlockEntry{
				{Name: "Scimitar", ToHit: "+3 to hit", Damage: "1d6 + 1 slashing damage", Description: "Рукопашная атака оружием на 5 футов по одной цели."},
				{Name: "Light Crossbow", ToHit: "+3 to hit", Damage: "1d8 + 1 piercing damage", Description: "Дальнобойная атака оружием с дистанцией 80/320 футов по одной цели."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(false),
	}
}

func buildOfficialScoutDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Разведчик",
		Subtitle:   "Официальный гуманоид из бестиария D&D 5e",
		Summary:    "Полевой стрелок и следопыт, который держит дистанцию и хорошо замечает угрозы.",
		Content:    "Разведчик полезен для засад, преследования и прикрытия отхода. В бою он старается работать издалека и выбирать цели без укрытия.",
		Tags:       []string{"ai-draft", "monster", "humanoid", "bandit", "scout", "dndsu-reference"},
		Role:       "Ranged support",
		Status:     "Hostile",
		Importance: "Standard",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any alignment",
			ArmorClass:       "13 (leather armor)",
			HitPoints:        "16 (3d8 + 3)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/2 (100 XP)",
			Senses:           "passive Perception 15",
			Skills:           "Nature +4, Perception +5, Stealth +6, Survival +5",
			Languages:        "any one language (usually Common)",
			AbilityScores:    abilityScores{STR: 11, DEX: 14, CON: 12, INT: 11, WIS: 13, CHA: 11},
			Traits: []statBlockEntry{
				{Name: "Keen Hearing and Sight", Description: "Разведчик получает преимущество на проверки Внимательности, завязанные на зрение или слух."},
			},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "Разведчик делает две атаки оружием."},
				{Name: "Shortsword", ToHit: "+4 to hit", Damage: "1d6 + 2 piercing damage", Description: "Рукопашная атака оружием по одной цели в пределах 5 футов."},
				{Name: "Longbow", ToHit: "+4 to hit", Damage: "1d8 + 2 piercing damage", Description: "Дальнобойная атака оружием с дистанцией 150/600 футов по одной цели."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(false),
	}
}

func buildOfficialThugDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Головорез",
		Subtitle:   "Официальный гуманоид из бестиария D&D 5e",
		Summary:    "Грубая ударная сила шайки, которая вжимает цель в стену и выигрывает бой за счёт парного фокуса.",
		Content:    "Головорез силён, когда работает рядом с союзниками: его лучше использовать в узких проходах, дверях и на прикрытии лидера.",
		Tags:       []string{"ai-draft", "monster", "humanoid", "bandit", "thug", "dndsu-reference"},
		Role:       "Frontliner",
		Status:     "Hostile",
		Importance: "Standard",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-good alignment",
			ArmorClass:       "11 (leather armor)",
			HitPoints:        "32 (5d8 + 10)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "1/2 (100 XP)",
			Senses:           "passive Perception 10",
			Skills:           "Intimidation +2",
			Languages:        "any one language (usually Common)",
			AbilityScores:    abilityScores{STR: 15, DEX: 11, CON: 14, INT: 10, WIS: 10, CHA: 11},
			Traits: []statBlockEntry{
				{Name: "Pack Tactics", Description: "Если рядом с целью есть союзник головореза, он получает преимущество на бросок атаки по этой цели."},
			},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "Головорез делает две рукопашные атаки."},
				{Name: "Mace", ToHit: "+4 to hit", Damage: "1d6 + 2 bludgeoning damage", Description: "Рукопашная атака оружием по одной цели в пределах 5 футов."},
				{Name: "Heavy Crossbow", ToHit: "+2 to hit", Damage: "1d10 piercing damage", Description: "Дальнобойная атака оружием с дистанцией 100/400 футов по одной цели."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(false),
	}
}

func buildOfficialBanditCaptainDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Капитан разбойников",
		Subtitle:   "Официальный гуманоид из бестиария D&D 5e",
		Summary:    "Тактический лидер шайки, который прикрывается реакцией, быстро режет цель вблизи и умеет держать строй.",
		Content:    "Капитан разбойников опасен не только сам по себе: он хорошо работает как центр отряда, который добивает цель, уже зажатую рядовыми бандитами.",
		Tags:       []string{"ai-draft", "monster", "humanoid", "bandit", "captain", "dndsu-reference"},
		Role:       "Leader",
		Status:     "Hostile",
		Importance: "Elite",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any non-lawful alignment",
			ArmorClass:       "15 (studded leather)",
			HitPoints:        "65 (10d8 + 20)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "2 (450 XP)",
			Senses:           "passive Perception 10",
			SavingThrows:     "STR +4, DEX +5, WIS +2",
			Languages:        "any two languages",
			AbilityScores:    abilityScores{STR: 15, DEX: 16, CON: 14, INT: 14, WIS: 11, CHA: 14},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "Капитан делает три рукопашные атаки: две скимитаром и одну кинжалом, либо две атаки кинжалом на расстоянии."},
				{Name: "Scimitar", ToHit: "+5 to hit", Damage: "1d6 + 3 slashing damage", Description: "Рукопашная атака оружием по одной цели в пределах 5 футов."},
				{Name: "Dagger", ToHit: "+5 to hit", Damage: "1d4 + 3 piercing damage", Description: "Рукопашная или дальнобойная атака оружием с дистанцией 20/60 футов по одной цели."},
			},
			Reactions: []statBlockEntry{
				{Name: "Parry", Description: "Капитан добавляет +2 к КБ против одной рукопашной атаки, которую он видит и от которой держит оружие в руках."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(true),
	}
}

func buildOfficialVeteranDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Ветеран",
		Subtitle:   "Официальный гуманоид из бестиария D&D 5e",
		Summary:    "Закалённый боец, который уверенно держит переднюю линию и стабильно наносит урон каждый ход.",
		Content:    "Ветеран хорош как тяжёлый элитный противник-гуманоид: он прост в управлении, живуч и опасен и в ближнем, и в дальнем бою.",
		Tags:       []string{"ai-draft", "monster", "humanoid", "veteran", "dndsu-reference"},
		Role:       "Elite striker",
		Status:     "Hostile",
		Importance: "Elite",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any alignment",
			ArmorClass:       "17 (splint)",
			HitPoints:        "58 (9d8 + 18)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+2",
			Challenge:        "3 (700 XP)",
			Senses:           "passive Perception 12",
			Skills:           "Athletics +5, Perception +2",
			Languages:        "any one language (usually Common)",
			AbilityScores:    abilityScores{STR: 16, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 10},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "Ветеран делает две атаки длинным мечом. Если у него вынут короткий меч, он может заменить одну из них атакой коротким мечом."},
				{Name: "Longsword", ToHit: "+5 to hit", Damage: "1d8 + 3 slashing damage", Description: "Рукопашная атака оружием по одной цели. Если меч держат двумя руками, урон становится 1d10 + 3."},
				{Name: "Shortsword", ToHit: "+5 to hit", Damage: "1d6 + 3 piercing damage", Description: "Рукопашная атака оружием по одной цели в пределах 5 футов."},
				{Name: "Heavy Crossbow", ToHit: "+3 to hit", Damage: "1d10 + 1 piercing damage", Description: "Дальнобойная атака оружием с дистанцией 100/400 футов по одной цели."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(true),
	}
}

func buildOfficialGladiatorDraft() createEntityInput {
	return createEntityInput{
		Kind:       "monster",
		Title:      "Гладиатор",
		Subtitle:   "Официальный гуманоид из бестиария D&D 5e",
		Summary:    "Тяжёлый мастер арены, который выдерживает много урона, атакует сериями и опасен даже против хорошо одетой партии.",
		Content:    "Гладиатор подходит как главный гуманоидный босс сцены: он давит темпом, переживает фокус и наказывает тех, кто идёт в ближний бой без плана.",
		Tags:       []string{"ai-draft", "monster", "humanoid", "gladiator", "dndsu-reference"},
		Role:       "Boss bruiser",
		Status:     "Hostile",
		Importance: "Boss",
		StatBlock: &npcStatBlock{
			Size:             "Medium",
			CreatureType:     "humanoid",
			Alignment:        "any alignment",
			ArmorClass:       "16 (studded leather, shield)",
			HitPoints:        "112 (15d8 + 45)",
			Speed:            "30 ft.",
			ProficiencyBonus: "+3",
			Challenge:        "5 (1800 XP)",
			Senses:           "passive Perception 11",
			SavingThrows:     "STR +7, DEX +5, CON +6",
			Skills:           "Athletics +10, Intimidation +5",
			Languages:        "any one language (usually Common)",
			AbilityScores:    abilityScores{STR: 18, DEX: 15, CON: 16, INT: 10, WIS: 12, CHA: 15},
			Traits: []statBlockEntry{
				{Name: "Brave", Description: "Гладиатор получает преимущество на спасброски от состояния frightened."},
				{Name: "Brute", Description: "Рукопашные атаки гладиатора наносят на одну дополнительную кость урона больше обычного."},
			},
			Actions: []statBlockEntry{
				{Name: "Multiattack", Description: "Гладиатор делает три рукопашные атаки или две дальнобойные атаки."},
				{Name: "Spear", ToHit: "+7 to hit", Damage: "2d6 + 4 piercing damage", Description: "Рукопашная или дальнобойная атака оружием. В ближнем бою двумя руками урон становится 2d8 + 4, на дистанции 20/60 футов - 2d6 + 4."},
				{Name: "Shield Bash", ToHit: "+7 to hit", Damage: "2d4 + 4 bludgeoning damage", SaveDC: "DC 15 Strength", Description: "При попадании по существу среднего размера или меньше цель должна пройти спасбросок Силы, иначе падает ничком."},
			},
			Reactions: []statBlockEntry{
				{Name: "Parry", Description: "Гладиатор добавляет +3 к КБ против одной рукопашной атаки, которую он видит и от которой держит оружие в руках."},
			},
		},
		RewardProfile: defaultBanditRewardProfile(true),
	}
}
