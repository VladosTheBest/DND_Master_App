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
var aiAverageDice = regexp.MustCompile(`(?i)\b\d+\s*\((\d+\s*[dк](?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?)\)`)
var aiSpacedDice = regexp.MustCompile(`(?i)\d+\s*[dк](?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?`)
var aiDiceBonus = regexp.MustCompile(`[+-]\d+$`)

// The source owns damage bonuses. Reconcile only unambiguous identical dice
// counts/sizes; changed dice or ambiguous versatile variants still fail validation.
func foundryAISourceDamage(damage string, source statBlockEntry) string {
	terms := map[string]map[string]bool{}
	for _, term := range aiDice.FindAllString(aiFormulaText(source.Damage+" "+source.Description), -1) {
		base := aiDiceBonus.ReplaceAllString(term, "")
		if terms[base] == nil {
			terms[base] = map[string]bool{}
		}
		terms[base][term] = true
	}
	return aiSpacedDice.ReplaceAllStringFunc(damage, func(term string) string {
		base := aiDiceBonus.ReplaceAllString(aiFormulaText(term), "")
		if len(terms[base]) == 1 {
			for original := range terms[base] {
				return original
			}
		}
		return term
	})
}

// Dice type annotations are data, not executable Foundry formulas.
func normalizeAIDamage(s string) string {
	s = aiDamageLabel.ReplaceAllString(s, " $1")
	s = strings.ReplaceAll(s, "−", "-")
	s = aiAverageDice.ReplaceAllString(s, "$1")
	return strings.TrimSpace(aiDamageJoin.ReplaceAllString(s, " plus $1"))
}

// Models sometimes number only the actionable entries, skipping passive traits.
// Recover only a unique source-name match; all mechanics are still validated.
func foundryAIAbilityIndex(values []statBlockEntry, name string, fallback int) int {
	normalize := func(s string) string { return strings.ToLower(strings.TrimSpace(strings.SplitN(s, "(", 2)[0])) }
	match := -1
	for i, entry := range values {
		if normalize(entry.Name) == normalize(name) {
			if match >= 0 {
				return fallback
			}
			match = i
		}
	}
	if match >= 0 {
		return match
	}
	return fallback
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

var foundryAISkillAliases = map[string]string{
	"acrobatics": "acr", "animal handling": "ani", "arcana": "arc", "athletics": "ath", "deception": "dec", "history": "his", "insight": "ins", "intimidation": "itm", "investigation": "inv", "medicine": "med", "nature": "nat", "perception": "prc", "performance": "prf", "persuasion": "per", "religion": "rel", "sleight of hand": "slt", "stealth": "ste", "survival": "sur",
}

// Configure never adds thematic spells. Discard unsupported suggestions before
// validating the retained profile, rather than blocking unrelated source attacks.
func foundryAIKeepSourceSpells(p *foundryAIProfile, e knowledgeEntity) {
	if p.Mode != "configure" {
		return
	}
	evidence, _ := json.Marshal([]any{e.StatBlock, e.Content, e.PlayerContent, e.Summary})
	text := strings.ToLower(string(evidence))
	kept := make([]foundryAISpell, 0, len(p.Spells))
	for _, choice := range p.Spells {
		name, matched := choice.ID, false
		for _, spell := range characterRules.Spells {
			if spell.ID != choice.ID || !strings.HasSuffix(spell.ID, "-"+p.Edition) {
				continue
			}
			name = spell.Name
			for _, alias := range strings.Split(name, " · ") {
				if strings.Contains(text, strings.ToLower(strings.TrimSpace(alias))) {
					matched = true
				}
			}
			break
		}
		if matched {
			kept = append(kept, choice)
		} else if len(p.Notes) < 15 {
			p.Notes = append(p.Notes, "Не добавлено заклинание без подтверждения в исходном описании: "+name)
		}
	}
	p.Spells = kept
}
