package httpapi

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

var aiDamageLabel = regexp.MustCompile(`\[([a-zA-Zа-яА-ЯёЁ ]+)\]`)
var aiDamageJoin = regexp.MustCompile(`(?i)\s*\+\s*(\d+\s*[dк])`)
var aiColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Dice type annotations are data, not executable Foundry formulas.
func normalizeAIDamage(s string) string {
	s = aiDamageLabel.ReplaceAllString(s, " $1")
	s = strings.ReplaceAll(s, "−", "-")
	return strings.TrimSpace(aiDamageJoin.ReplaceAllString(s, " plus $1"))
}
func validAIColor(s string) bool { return s == "" || aiColor.MatchString(s) }
func foundryAISpellDC(e knowledgeEntity) int {
	dcPattern := regexp.MustCompile(`(?i)(?:Сл|DC)[^\d.\n]{0,45}(\d+)`)
	for _, entries := range foundryAISections(e.StatBlock) {
		for _, entry := range entries {
			if !strings.Contains(strings.ToLower(entry.Name), "заклинан") && !strings.Contains(strings.ToLower(entry.Name), "spellcast") {
				continue
			}
			if m := dcPattern.FindStringSubmatch(entry.Description); len(m) > 1 {
				n, _ := strconv.Atoi(m[1])
				if n > 0 && n <= 100 {
					return n
				}
			}
		}
	}
	return 0
}
func validAIAnimation(s string) bool {
	return strings.Contains("||sword|axe|hammer|dagger|spear|claw|bow|crossbow|thrown|impact|fire-bolt|ray-of-frost|magic-missile|cure-wounds|healing-word|fireball|burning-hands|lightning-bolt|bless|shield|", "|"+s+"|")
}
func foundryAICastingEvidence(e knowledgeEntity, ability string) bool {
	names := map[string]string{"str": "сил|strength", "dex": "ловк|dexterity", "con": "телослож|constitution", "int": "интеллект|intelligence", "wis": "мудрост|wisdom", "cha": "харизм|charisma"}
	for _, entries := range foundryAISections(e.StatBlock) {
		for _, entry := range entries {
			text := strings.ToLower(entry.Name + " " + entry.Description)
			if !strings.Contains(text, "заклинан") && !strings.Contains(text, "spellcast") {
				continue
			}
			for _, name := range strings.Split(names[ability], "|") {
				if name != "" && strings.Contains(text, name) {
					return true
				}
			}
		}
	}
	return false
}
func foundryAISpellUses(e knowledgeEntity, name string, uses int) bool {
	raw, _ := json.Marshal([]any{e.Content, e.PlayerContent, e.StatBlock})
	text := strings.ToLower(strings.ReplaceAll(string(raw), `\n`, "\n"))
	// Frequency applies to the following list until the next frequency or line.
	frequency := regexp.MustCompile(`(?i)(\d+)\s*/\s*(?:день|day|д)(?:\s*кажд\w*)?`)
	positions := frequency.FindAllStringSubmatchIndex(text, -1)
	for i, pos := range positions {
		if text[pos[2]:pos[3]] != strconv.Itoa(uses) {
			continue
		}
		end := len(text)
		if i+1 < len(positions) {
			end = positions[i+1][0]
		}
		part := text[pos[1]:end]
		if n := strings.Index(part, "\n"); n >= 0 {
			part = part[:n]
		}
		for _, alias := range strings.Split(name, " · ") {
			if strings.Contains(part, strings.ToLower(strings.TrimSpace(alias))) {
				return true
			}
		}
	}
	return false
}
