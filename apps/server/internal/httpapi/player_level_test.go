package httpapi

import "testing"

func TestMaterializePlayerNormalizesLevelAndAddsQuickFact(t *testing.T) {
	entity := materializeEntity(createEntityInput{
		Kind:    "player",
		Title:   "Aelar",
		Summary: "Arcane scout",
		Content: "Notes",
		Role:    "Wizard",
		Status:  "Active",
		Level:   27,
	})

	if entity.Level != 20 {
		t.Fatalf("expected player level to be clamped to 20, got %d", entity.Level)
	}

	levelFactFound := false
	for _, fact := range entity.QuickFacts {
		if fact.Label == "Уровень" {
			levelFactFound = true
			if fact.Value != "20" {
				t.Fatalf("expected level quick fact value 20, got %q", fact.Value)
			}
		}
	}

	if !levelFactFound {
		t.Fatalf("expected player quick facts to include level, got %+v", entity.QuickFacts)
	}
}
