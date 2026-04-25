package httpapi

import (
	"html"
	"regexp"
	"strings"
)

var (
	playerFacingCommentPattern        = regexp.MustCompile(`(?is)<!--.*?-->`)
	playerFacingTagPattern            = regexp.MustCompile(`(?is)<\s*(/?)\s*([a-z0-9]+)([^>]*)>`)
	playerFacingWhitespacePattern     = regexp.MustCompile(`[ \t]+`)
	playerFacingHTMLTagStripPattern   = regexp.MustCompile(`(?is)<[^>]+>`)
	playerFacingListClosePattern      = regexp.MustCompile(`(?is)</\s*(ul|ol)\s*>`)
	playerFacingParagraphEndPattern   = regexp.MustCompile(`(?is)</\s*(p|div|h1|h2|h3|h4|blockquote)\s*>`)
	playerFacingLineBreakPattern      = regexp.MustCompile(`(?is)<\s*br\s*/?\s*>`)
	playerFacingListItemOpenPattern   = regexp.MustCompile(`(?is)<\s*li\b[^>]*>`)
	playerFacingListItemEndPattern    = regexp.MustCompile(`(?is)</\s*li\s*>`)
	playerFacingHeadingTagPattern     = regexp.MustCompile(`(?is)<\s*h[1-4]\b[^>]*>(.*?)</\s*h[1-4]\s*>`)
	playerFacingTableClosePattern     = regexp.MustCompile(`(?is)</\s*table\s*>`)
	playerFacingTableSectionPattern   = regexp.MustCompile(`(?is)</\s*(thead|tbody)\s*>`)
	playerFacingTableRowClosePattern  = regexp.MustCompile(`(?is)</\s*tr\s*>`)
	playerFacingTableCellClosePattern = regexp.MustCompile(`(?is)</\s*(th|td)\s*>`)
	playerFacingColorPattern          = regexp.MustCompile(`(?i)^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$`)
	playerFacingFontSizePattern       = regexp.MustCompile(`(?i)^\d+(?:\.\d+)?(px|rem|em|%)$`)
	playerFacingLetterSpacingPattern  = regexp.MustCompile(`(?i)^-?\d+(?:\.\d+)?(px|rem|em)$`)
	playerFacingTextDecorationPattern = regexp.MustCompile(`(?i)^(none|underline|line-through|overline)(\s+(underline|line-through|overline))*$`)
	playerFacingPipeSpacingPattern    = regexp.MustCompile(`\s*\|\s*`)
	playerFacingLowerUpperPattern     = regexp.MustCompile(`([a-zа-яё])([A-ZА-ЯЁ])`)
	playerFacingDigitLetterPattern    = regexp.MustCompile(`(\d)([A-Za-zА-Яа-яЁё])`)
	playerFacingSkillCheckLinePattern = regexp.MustCompile(`(?i)^(Акробатика|Анализ|Атлетика|Выживание|Выступление|Запугивание|История|Ловкость рук|Магия|Медицина|Обман|Природа|Проницательность|Расследование|Религия|Скрытность|Убеждение|Уход за животными|Восприятие)\s+Сл\s*\d+$`)
)

var allowedPlayerFacingHTMLTags = map[string]string{
	"b":          "strong",
	"strong":     "strong",
	"i":          "em",
	"em":         "em",
	"u":          "u",
	"span":       "span",
	"font":       "span",
	"p":          "p",
	"div":        "p",
	"h1":         "h1",
	"h2":         "h2",
	"h3":         "h3",
	"h4":         "h4",
	"h5":         "h4",
	"h6":         "h4",
	"ul":         "ul",
	"ol":         "ol",
	"li":         "li",
	"blockquote": "blockquote",
	"br":         "br",
	"table":      "table",
	"thead":      "thead",
	"tbody":      "tbody",
	"tr":         "tr",
	"th":         "th",
	"td":         "td",
}

var dangerousPlayerFacingTags = []string{
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"svg",
	"math",
	"form",
	"button",
	"input",
	"textarea",
	"select",
	"option",
	"meta",
	"link",
}

func normalizeFormattedPlayerFacingCard(input playerFacingCard) playerFacingCard {
	card := playerFacingCard{
		Title:       strings.TrimSpace(input.Title),
		Content:     strings.TrimSpace(input.Content),
		ContentHTML: sanitizePlayerFacingHTMLFragment(input.ContentHTML),
	}
	if card.Content == "" {
		card.Content = extractTextFromPlayerFacingHTML(card.ContentHTML)
	}
	return card
}

func sanitizePlayerFacingHTMLFragment(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	working := stripDangerousPlayerFacingBlocks(playerFacingCommentPattern.ReplaceAllString(trimmed, ""))
	sanitized := playerFacingTagPattern.ReplaceAllStringFunc(working, func(token string) string {
		match := playerFacingTagPattern.FindStringSubmatch(token)
		if len(match) != 4 {
			return ""
		}

		closing := strings.TrimSpace(match[1]) == "/"
		tagName := strings.ToLower(strings.TrimSpace(match[2]))
		mappedTag, ok := allowedPlayerFacingHTMLTags[tagName]
		if !ok {
			return ""
		}
		if mappedTag == "br" {
			return "<br>"
		}
		if closing {
			return "</" + mappedTag + ">"
		}

		styleValue := sanitizePlayerFacingStyle(extractPlayerFacingStyle(match[3]))
		if styleValue == "" {
			return "<" + mappedTag + ">"
		}
		return "<" + mappedTag + ` style="` + styleValue + `">`
	})

	return strings.TrimSpace(sanitized)
}

func extractTextFromPlayerFacingHTML(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	working := sanitizePlayerFacingHTMLFragment(trimmed)
	working = playerFacingHeadingTagPattern.ReplaceAllStringFunc(working, func(token string) string {
		match := playerFacingHeadingTagPattern.FindStringSubmatch(token)
		if len(match) != 2 {
			return token
		}
		return "\n## " + html.UnescapeString(strings.TrimSpace(playerFacingHTMLTagStripPattern.ReplaceAllString(match[1], ""))) + "\n"
	})
	working = playerFacingLineBreakPattern.ReplaceAllString(working, "\n")
	working = playerFacingParagraphEndPattern.ReplaceAllString(working, "\n\n")
	working = playerFacingListClosePattern.ReplaceAllString(working, "\n")
	working = playerFacingListItemOpenPattern.ReplaceAllString(working, "\n- ")
	working = playerFacingListItemEndPattern.ReplaceAllString(working, "")
	working = playerFacingTableCellClosePattern.ReplaceAllString(working, " | ")
	working = playerFacingTableRowClosePattern.ReplaceAllString(working, "\n")
	working = playerFacingTableSectionPattern.ReplaceAllString(working, "\n")
	working = playerFacingTableClosePattern.ReplaceAllString(working, "\n")
	working = playerFacingHTMLTagStripPattern.ReplaceAllString(working, "")
	working = html.UnescapeString(working)
	working = strings.ReplaceAll(working, "\u00a0", " ")
	working = strings.ReplaceAll(working, "\r", "")

	lines := strings.Split(working, "\n")
	normalized := make([]string, 0, len(lines))
	for _, line := range lines {
		cleanLine := playerFacingWhitespacePattern.ReplaceAllString(strings.TrimSpace(line), " ")
		cleanLine = playerFacingPipeSpacingPattern.ReplaceAllString(cleanLine, " | ")
		cleanLine = strings.TrimSpace(strings.Trim(cleanLine, "|"))
		if cleanLine == "" {
			if len(normalized) > 0 && normalized[len(normalized)-1] != "" {
				normalized = append(normalized, "")
			}
			continue
		}
		normalized = append(normalized, cleanLine)
	}

	return strings.TrimSpace(strings.Join(normalized, "\n"))
}

func buildScaffoldPlayerFacingHTML(title string, content string) string {
	text := strings.TrimSpace(firstNonEmpty(content, title))
	if text == "" {
		return ""
	}

	if tableHTML := buildDelimitedPlayerFacingTableHTML(text); tableHTML != "" {
		return tableHTML
	}
	if tableHTML := buildCompactSkillCheckTableHTML(text); tableHTML != "" {
		return tableHTML
	}

	lines := strings.Split(strings.ReplaceAll(text, "\r", ""), "\n")
	var builder strings.Builder
	inList := false
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			if inList {
				builder.WriteString("</ul>")
				inList = false
			}
			continue
		}

		if strings.HasPrefix(line, "## ") || strings.HasPrefix(line, "# ") {
			if inList {
				builder.WriteString("</ul>")
				inList = false
			}
			builder.WriteString(`<h2 style="color: #f1c07d;">`)
			builder.WriteString(escapePlayerFacingHTMLText(strings.TrimSpace(strings.TrimLeft(line, "#"))))
			builder.WriteString("</h2>")
			continue
		}

		if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			if !inList {
				builder.WriteString(`<ul style="color: #f7f1e6;">`)
				inList = true
			}
			builder.WriteString("<li>")
			builder.WriteString(escapePlayerFacingHTMLText(strings.TrimSpace(line[2:])))
			builder.WriteString("</li>")
			continue
		}

		if inList {
			builder.WriteString("</ul>")
			inList = false
		}

		builder.WriteString(`<p style="color: #f7f1e6;">`)
		builder.WriteString(escapePlayerFacingHTMLText(line))
		builder.WriteString("</p>")
	}

	if inList {
		builder.WriteString("</ul>")
	}

	return sanitizePlayerFacingHTMLFragment(builder.String())
}

func buildDelimitedPlayerFacingTableHTML(text string) string {
	lines := strings.Split(strings.ReplaceAll(text, "\r", ""), "\n")
	delimiter := ""
	rows := make([][]string, 0, len(lines))

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}

		if delimiter == "" {
			switch {
			case strings.Contains(line, "\t"):
				delimiter = "\t"
			case strings.Contains(line, "|"):
				delimiter = "|"
			case strings.Count(line, ";") >= 2:
				delimiter = ";"
			default:
				return ""
			}
		}

		cells := strings.Split(line, delimiter)
		row := make([]string, 0, len(cells))
		for _, cell := range cells {
			value := strings.TrimSpace(strings.Trim(cell, "|"))
			if value == "" {
				continue
			}
			row = append(row, value)
		}

		if len(row) < 2 {
			return ""
		}
		if len(rows) > 0 && len(row) != len(rows[0]) {
			return ""
		}
		rows = append(rows, row)
	}

	if len(rows) < 2 {
		return ""
	}

	return buildPlayerFacingTableHTML(rows[0], rows[1:])
}

func buildCompactSkillCheckTableHTML(text string) string {
	normalized := strings.ReplaceAll(text, "\r", "")
	normalized = playerFacingLowerUpperPattern.ReplaceAllString(normalized, "$1\n$2")
	normalized = playerFacingDigitLetterPattern.ReplaceAllString(normalized, "$1\n$2")
	lines := strings.Split(normalized, "\n")
	cleanLines := make([]string, 0, len(lines))
	for _, line := range lines {
		cleaned := playerFacingWhitespacePattern.ReplaceAllString(strings.TrimSpace(line), " ")
		if cleaned == "" {
			continue
		}
		cleanLines = append(cleanLines, cleaned)
	}

	if len(cleanLines) < 6 {
		return ""
	}

	headers := []string{"Находка", "Проверка", "Значение"}
	startIndex := 0
	if len(cleanLines) >= 3 &&
		equalPlayerFacingHeader(cleanLines[0], headers[0]) &&
		equalPlayerFacingHeader(cleanLines[1], headers[1]) &&
		equalPlayerFacingHeader(cleanLines[2], headers[2]) {
		startIndex = 3
	}

	if (len(cleanLines)-startIndex)%3 != 0 {
		return ""
	}

	rows := make([][]string, 0, (len(cleanLines)-startIndex)/3)
	for index := startIndex; index+2 < len(cleanLines); index += 3 {
		finding := cleanLines[index]
		check := cleanLines[index+1]
		value := cleanLines[index+2]
		if finding == "" || value == "" || !playerFacingSkillCheckLinePattern.MatchString(check) {
			return ""
		}
		rows = append(rows, []string{finding, check, value})
	}

	if len(rows) == 0 {
		return ""
	}

	return buildPlayerFacingTableHTML(headers, rows)
}

func equalPlayerFacingHeader(value string, expected string) bool {
	return strings.EqualFold(
		playerFacingWhitespacePattern.ReplaceAllString(strings.TrimSpace(value), ""),
		playerFacingWhitespacePattern.ReplaceAllString(strings.TrimSpace(expected), ""),
	)
}

func buildPlayerFacingTableHTML(headers []string, rows [][]string) string {
	if len(headers) < 2 || len(rows) == 0 {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("<table><thead><tr>")
	for _, header := range headers {
		builder.WriteString("<th>")
		builder.WriteString(escapePlayerFacingHTMLText(header))
		builder.WriteString("</th>")
	}
	builder.WriteString("</tr></thead><tbody>")
	for _, row := range rows {
		if len(row) != len(headers) {
			continue
		}
		builder.WriteString("<tr>")
		for _, cell := range row {
			builder.WriteString("<td>")
			builder.WriteString(escapePlayerFacingHTMLText(cell))
			builder.WriteString("</td>")
		}
		builder.WriteString("</tr>")
	}
	builder.WriteString("</tbody></table>")

	return sanitizePlayerFacingHTMLFragment(builder.String())
}

func stripDangerousPlayerFacingBlocks(value string) string {
	result := value
	for _, tagName := range dangerousPlayerFacingTags {
		blockPattern := regexp.MustCompile(`(?is)<\s*` + tagName + `\b[^>]*>.*?<\s*/\s*` + tagName + `\s*>`)
		selfClosingPattern := regexp.MustCompile(`(?is)<\s*` + tagName + `\b[^>]*?/?>`)
		result = blockPattern.ReplaceAllString(result, "")
		result = selfClosingPattern.ReplaceAllString(result, "")
	}
	return result
}

func extractPlayerFacingStyle(attributes string) string {
	lower := strings.ToLower(attributes)
	index := strings.Index(lower, "style=")
	if index < 0 {
		return ""
	}
	rest := strings.TrimSpace(attributes[index+len("style="):])
	if rest == "" {
		return ""
	}

	quote := rest[0]
	if quote != '"' && quote != '\'' {
		return ""
	}

	endIndex := strings.IndexByte(rest[1:], quote)
	if endIndex < 0 {
		return ""
	}

	return rest[1 : endIndex+1]
}

func sanitizePlayerFacingStyle(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	pairs := strings.Split(trimmed, ";")
	sanitized := make([]string, 0, len(pairs))
	for _, pair := range pairs {
		property, rawValue, ok := strings.Cut(pair, ":")
		if !ok {
			continue
		}

		name := strings.ToLower(strings.TrimSpace(property))
		styleValue := sanitizePlayerFacingStyleValue(name, rawValue)
		if styleValue == "" {
			continue
		}
		sanitized = append(sanitized, name+": "+styleValue)
	}

	return strings.Join(sanitized, "; ")
}

func sanitizePlayerFacingStyleValue(property string, value string) string {
	cleaned := strings.TrimSpace(strings.ReplaceAll(value, "\u00a0", " "))
	if cleaned == "" || strings.ContainsAny(cleaned, `"'`) {
		return ""
	}
	lower := strings.ToLower(cleaned)
	if strings.Contains(lower, "url(") || strings.Contains(lower, "expression(") || strings.Contains(lower, "javascript:") || strings.Contains(lower, "data:") || strings.Contains(lower, "var(") {
		return ""
	}

	switch property {
	case "color", "background-color":
		if playerFacingColorPattern.MatchString(cleaned) {
			return cleaned
		}
	case "font-size":
		if playerFacingFontSizePattern.MatchString(cleaned) {
			return cleaned
		}
	case "text-align":
		switch lower {
		case "left", "center", "right", "justify":
			return lower
		}
	case "font-weight":
		switch lower {
		case "normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "700", "800", "900":
			return lower
		}
	case "font-style":
		switch lower {
		case "normal", "italic", "oblique":
			return lower
		}
	case "text-decoration":
		if playerFacingTextDecorationPattern.MatchString(lower) {
			return lower
		}
	case "text-transform":
		switch lower {
		case "none", "uppercase", "lowercase", "capitalize":
			return lower
		}
	case "letter-spacing":
		if playerFacingLetterSpacingPattern.MatchString(cleaned) {
			return cleaned
		}
	}

	return ""
}

func escapePlayerFacingHTMLText(value string) string {
	return html.EscapeString(strings.TrimSpace(value))
}
