package httpapi

import (
	"strings"
	"testing"
)

func TestBuildScaffoldPlayerFacingHTMLBuildsCompactSkillCheckTable(t *testing.T) {
	input := "НаходкаПроверкаЗначениеСледы воска на полуВосприятие Сл 13кто-то приходил со свечой из чёрного воскаЦарапины у замкаРасследование Сл 14дверь открывали не ключомСдвинутая табличкаРасследование Сл 12кто-то проверял именно это телоЧернильное пятно на тканиВосприятие Сл 15след от руки писаряСлабый запах лавандыВосприятие Сл 13такой запах есть у чернил Орена Малка"

	html := buildScaffoldPlayerFacingHTML("", input)

	expectedFragments := []string{
		"<table>",
		"<th>Находка</th>",
		"<th>Проверка</th>",
		"<th>Значение</th>",
		"<td>Следы воска на полу</td>",
		"<td>Восприятие Сл 13</td>",
		"<td>дверь открывали не ключом</td>",
		"<td>такой запах есть у чернил Орена Малка</td>",
	}
	for _, expected := range expectedFragments {
		if !strings.Contains(html, expected) {
			t.Fatalf("expected compact skill-check text to render as table containing %q, got %q", expected, html)
		}
	}
}

func TestNormalizeFormattedPlayerFacingCardKeepsTableMarkupAndText(t *testing.T) {
	card := normalizeFormattedPlayerFacingCard(playerFacingCard{
		Title:       "Улики",
		ContentHTML: `<table style="color:#f1c07d;position:absolute"><thead><tr><th>Находка</th><th>Проверка</th><th>Значение</th></tr></thead><tbody><tr><td>Следы воска</td><td>Восприятие Сл 13</td><td>Чёрный воск</td></tr></tbody></table>`,
	})

	if strings.Contains(card.ContentHTML, "position:absolute") {
		t.Fatalf("expected unsafe table styles to be removed, got %q", card.ContentHTML)
	}
	if !strings.Contains(card.ContentHTML, "<table") || !strings.Contains(card.ContentHTML, "<td>Чёрный воск</td>") {
		t.Fatalf("expected safe table markup to survive sanitization, got %q", card.ContentHTML)
	}

	expectedLines := []string{
		"Находка | Проверка | Значение",
		"Следы воска | Восприятие Сл 13 | Чёрный воск",
	}
	for _, expected := range expectedLines {
		if !strings.Contains(card.Content, expected) {
			t.Fatalf("expected plain text extraction to include %q, got %q", expected, card.Content)
		}
	}
}
