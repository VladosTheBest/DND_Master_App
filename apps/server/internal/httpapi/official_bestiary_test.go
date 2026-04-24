package httpapi

import "testing"

func TestBuildMonsterDraftUsesOfficialReference(t *testing.T) {
	draft := buildMonsterDraft("капитан разбойников")
	if draft.Title != "Капитан разбойников" {
		t.Fatalf("expected official title, got %q", draft.Title)
	}
	if draft.StatBlock == nil {
		t.Fatal("expected official stat block")
	}
	if draft.StatBlock.ArmorClass != "15 (studded leather)" {
		t.Fatalf("expected official AC, got %q", draft.StatBlock.ArmorClass)
	}
	if draft.StatBlock.HitPoints != "65 (10d8 + 20)" {
		t.Fatalf("expected official HP, got %q", draft.StatBlock.HitPoints)
	}
}

func TestCreateEncounterMonsterSeedUsesPlayableStats(t *testing.T) {
	seed := createEncounterMonsterSeed(generateCombatInput{
		Prompt:     "bandit ambush on the road",
		Difficulty: "custom",
	}, "2", 450)

	if seed.StatBlock == nil {
		t.Fatal("expected stat block on encounter seed")
	}
	if seed.Title == "" {
		t.Fatal("expected title on encounter seed")
	}
	if seed.StatBlock.ArmorClass == "" {
		t.Fatal("expected armor class on encounter seed")
	}
	if seed.StatBlock.HitPoints == "" {
		t.Fatal("expected hit points on encounter seed")
	}
	if got := parseMaximumHitPoints(seed.StatBlock); got <= 1 {
		t.Fatalf("expected more than 1 HP, got %d from %q", got, seed.StatBlock.HitPoints)
	}
}

func TestNormalizeDraftEntityReplacesPlaceholderMonsterTitle(t *testing.T) {
	entity := normalizeDraftEntity("monster", "капитан разбойников", campaignData{}, createEntityInput{
		Kind:  "monster",
		Title: "Новый монстр",
		StatBlock: &npcStatBlock{
			Challenge: "2 (450 XP)",
		},
	})

	if entity.Title != "Капитан разбойников" {
		t.Fatalf("expected official title, got %q", entity.Title)
	}
	if entity.StatBlock == nil || entity.StatBlock.HitPoints != "65 (10d8 + 20)" {
		t.Fatalf("expected official captain stat block, got %#v", entity.StatBlock)
	}
}

func TestBuildBanditEncounterDraftUsesOfficialRosterAndTargetXP(t *testing.T) {
	input := generateCombatInput{
		Prompt:       "bandit ambush with one leader",
		MonsterCount: 5,
		PartySize:    4,
	}
	roster := buildBanditEncounterDraft(input, 4000)
	_, adjustedXP := computeEncounterDraftMetrics(roster.Items, input.PartySize)
	if diff := absInt(adjustedXP - 4000); diff > encounterTargetTolerance(4000) {
		t.Fatalf("expected adjusted XP near 4000, got %d", adjustedXP)
	}

	allowed := map[string]struct{}{
		"Разбойник":           {},
		"Разведчик":           {},
		"Головорез":           {},
		"Капитан разбойников": {},
		"Ветеран":             {},
		"Гладиатор":           {},
	}
	for _, item := range roster.Items {
		if _, ok := allowed[item.Entity.Title]; !ok {
			t.Fatalf("unexpected roster title %q", item.Entity.Title)
		}
	}
}
