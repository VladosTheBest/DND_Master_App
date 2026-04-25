package httpapi

import "testing"

func TestEnsureKnowledgeEntitiesMigratesLegacyPreparedCombat(t *testing.T) {
	entities := ensureKnowledgeEntities([]knowledgeEntity{
		{
			ID:    "quest-1",
			Kind:  "quest",
			Title: "Ambush",
			PreparedCombat: &preparedCombatPlan{
				Title:     "Bridge ambush",
				PlayerIDs: []string{"player-1", "player-1", "player-2"},
				Items: []preparedCombatItem{
					{EntityID: "monster-1", Quantity: 2},
				},
			},
		},
	})

	if len(entities) != 1 {
		t.Fatalf("expected one entity, got %d", len(entities))
	}
	if len(entities[0].PreparedCombats) != 1 {
		t.Fatalf("expected one migrated prepared combat card, got %d", len(entities[0].PreparedCombats))
	}
	if entities[0].PreparedCombats[0].Title != "Bridge ambush" {
		t.Fatalf("expected migrated title to be preserved, got %q", entities[0].PreparedCombats[0].Title)
	}
	if len(entities[0].PreparedCombats[0].PlayerIDs) != 2 {
		t.Fatalf("expected player ids to be deduplicated, got %d", len(entities[0].PreparedCombats[0].PlayerIDs))
	}
	if entities[0].PreparedCombat == nil || entities[0].PreparedCombat.Title != entities[0].PreparedCombats[0].Title {
		t.Fatalf("expected primary prepared combat to mirror the first prepared combat card")
	}
}

func TestMaterializeEntityKeepsPreparedCombatCards(t *testing.T) {
	entity := materializeEntity(createEntityInput{
		Kind:    "location",
		Title:   "Black Fort",
		Summary: "Prepared battles should survive materialization.",
		PreparedCombats: []preparedCombatPlan{
			{
				PlayerIDs: []string{"player-1", "player-2"},
				Items: []preparedCombatItem{
					{EntityID: "monster-1", Quantity: 2},
				},
			},
			{
				Title:     "Courtyard defense",
				PlayerIDs: []string{"player-3"},
				Items: []preparedCombatItem{
					{EntityID: "npc-1", Quantity: 1},
				},
			},
		},
	})

	if len(entity.PreparedCombats) != 2 {
		t.Fatalf("expected 2 prepared combat cards, got %d", len(entity.PreparedCombats))
	}
	if entity.PreparedCombats[0].Title != "Бой 1" {
		t.Fatalf("expected fallback title for first card, got %q", entity.PreparedCombats[0].Title)
	}
	if entity.PreparedCombat == nil || entity.PreparedCombat.Title != entity.PreparedCombats[0].Title {
		t.Fatalf("expected primary prepared combat to mirror the first card")
	}
	if len(entity.PreparedCombats[0].PlayerIDs) != 2 {
		t.Fatalf("expected first card to keep selected players, got %d", len(entity.PreparedCombats[0].PlayerIDs))
	}
}
