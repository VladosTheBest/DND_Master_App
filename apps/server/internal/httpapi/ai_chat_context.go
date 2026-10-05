package httpapi

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

type chatContext struct {
	IncludeCampaign bool     `json:"includeCampaign"`
	SessionIDs      []string `json:"sessionIds"`
}

func (c *chatContext) normalize() string {
	seen := map[string]bool{}
	ids := []string{}
	for _, id := range c.SessionIDs {
		if id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	c.SessionIDs = ids
	raw, _ := json.Marshal(c)
	return "context:" + string(raw)
}

func chatNPCRoster(question string, campaign campaignData) (string, bool) {
	q := strings.ToLower(question)
	if !regexp.MustCompile(`^(пожалуйста[, ]+)?(перечисли|покажи|выведи|список|список всех)\s+(мне\s+)?(всех\s+|все\s+)?нпс(\s+(которые есть в кампании|которые есть|в кампании|кампании|из кампании))?[.!? ]*$`).MatchString(strings.TrimSpace(q)) {
		return "", false
	}
	cell := func(s string) string {
		return strings.NewReplacer("|", "\\|", "\n", " ", "\r", " ", "<", "&lt;", ">", "&gt;").Replace(s)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "## НПС кампании\n\nВсего во вкладке **НПС: %d**.\n\n", len(campaign.NPCs))
	if len(campaign.NPCs) == 0 {
		return b.String() + "Пока нет записей.", true
	}
	b.WriteString("| Имя | Роль | Кратко |\n| --- | --- | --- |\n")
	for _, npc := range campaign.NPCs {
		title := npc.Title
		if title == "" {
			title = "Без имени"
		}
		role := npc.Role
		if role == "" {
			role = "—"
		}
		summary := chatClip(npc.Summary, 240)
		if summary == "" {
			summary = "—"
		}
		fmt.Fprintf(&b, "| **%s** | %s | %s |\n", cell(title), cell(role), cell(summary))
	}
	return b.String(), true
}

// Replace internal references after generation; technical IDs stay in the API metadata only.
func readableChatText(text string, docs []chatSource) string {
	for _, source := range docs {
		if source.ID != "" {
			text = strings.ReplaceAll(text, source.ID, source.Title)
		}
	}
	for _, source := range docs {
		if source.TargetID != "" {
			text = strings.ReplaceAll(text, source.TargetID, source.Title)
		}
	}
	return text
}
