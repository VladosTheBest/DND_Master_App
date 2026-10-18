package httpapi

import (
	"encoding/json"
	"testing"
)

func TestFreeRacialAbilityBonuses(t *testing.T) {
	d := characterTestDraft(t)
	d.AbilityBonuses = map[string]int{"str": 0, "dex": 0, "con": 1, "int": 0, "wis": 2, "cha": 0}
	species := characterSpecies{Bonuses2014: map[string]int{"str": 2, "cha": 1}}
	if _, err := validateCharacterAbilities(d, species, characterBackground{}); err == nil {
		t.Fatal("fixed bonuses must remain the default")
	}
	d.FreeAbilityBonuses = true
	scores, err := validateCharacterAbilities(d, species, characterBackground{})
	if err != nil || scores["wis"] != d.Abilities["wis"]+2 {
		t.Fatalf("relocated bonus not applied: %v %v", scores, err)
	}
	encoded, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	var restored characterDraft
	if err := json.Unmarshal(encoded, &restored); err != nil || !restored.FreeAbilityBonuses {
		t.Fatalf("option not persisted: %v", err)
	}
	for _, bad := range []map[string]int{
		{"str": 0, "dex": 1, "con": 1, "int": 0, "wis": 1, "cha": 0},
		{"str": 0, "dex": 0, "con": 0, "int": 0, "wis": 3, "cha": 0},
		{"str": 0, "dex": 0, "con": 2, "int": 0, "wis": 2, "cha": 0},
	} {
		d.AbilityBonuses = bad
		if _, err := validateCharacterAbilities(d, species, characterBackground{}); err == nil {
			t.Fatalf("accepted invalid bonus package: %v", bad)
		}
	}
	d.Edition = "2024"
	d.AbilityBonuses = restored.AbilityBonuses
	if _, err := validateCharacterAbilities(d, species, characterBackground{Abilities2024: []string{"wis", "con", "dex"}}); err == nil {
		t.Fatal("2014 option bypassed 2024 rules")
	}
}
