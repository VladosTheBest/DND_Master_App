package httpapi

import (
	"strings"
	"testing"
)

func TestEnsureKnowledgeEntitiesMigratesLegacyLocationPlayerContent(t *testing.T) {
	entities := ensureKnowledgeEntities([]knowledgeEntity{
		{
			ID:            "location-1",
			Kind:          "location",
			Title:         "Черный Форт",
			PlayerContent: "Игроки видят тёмные стены и настороженный гарнизон.",
		},
	})

	if len(entities) != 1 {
		t.Fatalf("expected one entity, got %d", len(entities))
	}
	if len(entities[0].PlayerCards) != 1 {
		t.Fatalf("expected legacy player content to produce one player card, got %d", len(entities[0].PlayerCards))
	}
	if entities[0].PlayerCards[0].Title != "Игроки видят" {
		t.Fatalf("expected default title %q, got %q", "Игроки видят", entities[0].PlayerCards[0].Title)
	}
	if entities[0].PlayerCards[0].Content != entities[0].PlayerContent {
		t.Fatalf("expected migrated card content to match legacy player content")
	}
}

func TestEnsureKnowledgeEntitiesMigratesLegacyQuestPlayerContent(t *testing.T) {
	entities := ensureKnowledgeEntities([]knowledgeEntity{
		{
			ID:            "quest-1",
			Kind:          "quest",
			Title:         "Тени на тракте",
			PlayerContent: "Игроки видят следы недавней засады и брошенный фургон.",
		},
	})

	if len(entities) != 1 {
		t.Fatalf("expected one entity, got %d", len(entities))
	}
	if len(entities[0].PlayerCards) != 1 {
		t.Fatalf("expected legacy player content to produce one player card, got %d", len(entities[0].PlayerCards))
	}
	if entities[0].PlayerCards[0].Title != "Игроки видят" {
		t.Fatalf("expected default title %q, got %q", "Игроки видят", entities[0].PlayerCards[0].Title)
	}
	if entities[0].PlayerCards[0].Content != entities[0].PlayerContent {
		t.Fatalf("expected migrated quest card content to match legacy player content")
	}
}

func TestMaterializeEntityKeepsLocationPlayerCards(t *testing.T) {
	entity := materializeEntity(createEntityInput{
		Kind:    "location",
		Title:   "Руины",
		Summary: "Старая крепость на утёсе.",
		Content: "GM notes",
		PlayerCards: []playerFacingCard{
			{Title: "Вход", Content: "Игроки видят разбитые ворота."},
			{Content: "Во дворе слышен ветер и скрип цепей."},
		},
	})

	if len(entity.PlayerCards) != 2 {
		t.Fatalf("expected 2 player cards, got %d", len(entity.PlayerCards))
	}
	if entity.PlayerCards[1].Title != "Карточка 2" {
		t.Fatalf("expected fallback title %q, got %q", "Карточка 2", entity.PlayerCards[1].Title)
	}
	if entity.PlayerContent != "Игроки видят разбитые ворота." {
		t.Fatalf("expected legacy playerContent fallback to mirror the first card, got %q", entity.PlayerContent)
	}
}

func TestMaterializeEntityKeepsQuestPlayerCards(t *testing.T) {
	entity := materializeEntity(createEntityInput{
		Kind:    "quest",
		Title:   "Шёпот у часовни",
		Summary: "Ночью у старой часовни кто-то зовёт путников.",
		Content: "GM notes",
		PlayerCards: []playerFacingCard{
			{Content: "Игроки слышат далёкий колокол и видят огни у часовни."},
			{Title: "Записка", Content: "На двери прибита влажная записка с угрозой."},
		},
	})

	if len(entity.PlayerCards) != 2 {
		t.Fatalf("expected 2 player cards, got %d", len(entity.PlayerCards))
	}
	if entity.PlayerCards[0].Title != "Игроки видят" {
		t.Fatalf("expected fallback title %q, got %q", "Игроки видят", entity.PlayerCards[0].Title)
	}
	if entity.PlayerContent != "Игроки слышат далёкий колокол и видят огни у часовни." {
		t.Fatalf("expected quest playerContent fallback to mirror the first card, got %q", entity.PlayerContent)
	}
}

func TestNormalizeFormattedPlayerFacingCardSanitizesHTML(t *testing.T) {
	card := normalizeFormattedPlayerFacingCard(playerFacingCard{
		Title:       "Игроки видят",
		ContentHTML: `<script>alert('x')</script><h2 onclick="evil()" style="color:#f1c07d;font-size:1.5rem;position:absolute">Что видят сразу</h2><p><strong>Герои</strong> замечают разбитые ворота.</p>`,
	})

	if strings.Contains(card.ContentHTML, "script") {
		t.Fatalf("expected script tags to be removed, got %q", card.ContentHTML)
	}
	if strings.Contains(card.ContentHTML, "onclick") || strings.Contains(card.ContentHTML, "position:absolute") {
		t.Fatalf("expected unsafe attributes to be removed, got %q", card.ContentHTML)
	}
	if !strings.Contains(card.ContentHTML, "<h2") || !strings.Contains(card.ContentHTML, "<p>") {
		t.Fatalf("expected safe rich text tags to remain, got %q", card.ContentHTML)
	}
	if !strings.Contains(card.Content, "## Что видят сразу") || !strings.Contains(card.Content, "Герои замечают разбитые ворота.") {
		t.Fatalf("expected plain text fallback to be derived from html, got %q", card.Content)
	}
}
