package httpapi

import (
	"html"
	"regexp"
	"strings"
)

var aiTextTags = regexp.MustCompile(`<[^>]*>`)
var aiTextLink = regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
var aiTextHyphen = regexp.MustCompile(`([\p{Ll}])[-\x{00ad}]\s+([\p{Ll}])`)
var aiTextHeading = regexp.MustCompile(`[.!?]\s+([\p{Lu}][\p{L}-]*(?:\s+[\p{L}-]+){0,5}(?:\s*\([^)]{1,80}\))?)[.:]\s+`)
var aiLineWidth = regexp.MustCompile(`(?i)(?:лини[а-яё]*.{0,50}шириной|line.{0,30}is)[^\d]{0,10}(\d+)`)
var aiRecharge = regexp.MustCompile(`(?i)(?:перезарядка|recharge)\s*[5-6](?:\s*-\s*6)?`)

// Canonicalize presentation only. Numeric evidence still comes from the source.
func foundryAIText(s string) string {
	s = html.UnescapeString(aiTextTags.ReplaceAllString(s, " "))
	s = aiTextLink.ReplaceAllString(s, "$1")
	s = strings.NewReplacer("**", "", "__", "", "`", "", "\u00ad", "", "−", "-", "–", "-", "—", "-", "ё", "е", "Ё", "Е").Replace(s)
	s = aiTextHyphen.ReplaceAllString(s, "$1$2")
	return strings.Join(strings.Fields(s), " ")
}

func foundryAITexts(e knowledgeEntity) []string {
	sources := []string{}
	// Prefer actual features to adjacent book narrative, in deterministic order.
	sections := foundryAISections(e.StatBlock)
	for _, section := range []string{"actions", "bonusActions", "reactions", "traits"} {
		for _, entry := range sections[section] {
			sources = append(sources, entry.Description)
		}
	}
	return append(sources, e.Content, e.PlayerContent, e.Summary)
}

func foundryAIExtractedSource(e knowledgeEntity, a foundryAIAbility) (statBlockEntry, bool) {
	name, description := foundryAIText(a.Name), foundryAIText(a.Description)
	if len([]rune(name)) < 2 || strings.EqualFold(name, foundryAIText(e.Title)) {
		return statBlockEntry{}, false
	}
	// Descriptions may be paraphrased. Locate a named ability heading and validate
	// against its original passage, never against AI's rewritten mechanics.
	suffix := regexp.QuoteMeta(name) + `(?:\s*\[[^\]]+\])?(?:\s*\([^)]{1,80}\))?\s*[.:]\s*`
	heading := regexp.MustCompile(`(?i)(?:^|[.!?:]\s+|\s(?:действия|особенности|actions|traits)\s+)` + suffix)
	looseHeading := regexp.MustCompile(`(?i)(?:^|[^\p{L}\p{N}])` + suffix)
	for _, raw := range foundryAITexts(e) {
		text := foundryAIText(raw)
		loc := heading.FindStringIndex(text)
		if loc == nil {
			loc = looseHeading.FindStringIndex(text)
		}
		if loc == nil {
			continue
		}
		start := loc[0]
		end := len(text)
		for _, next := range aiTextHeading.FindAllStringSubmatchIndex(text[loc[1]:], -1) {
			label := strings.ToLower(text[loc[1]+next[2] : loc[1]+next[3]])
			if label == "попадание" || label == "hit" || strings.Contains(label, "атака") || strings.Contains(label, "attack") {
				continue
			}
			end = loc[1] + next[0] + 1
			break
		}
		passage := strings.TrimLeft(strings.TrimSpace(text[start:end]), ".!?:;•- ")
		if len([]rune(passage)) > 8000 {
			continue
		}
		return statBlockEntry{Name: name, Description: passage}, true
	}
	// A model may quote only the attack sentence, omitting Hit and damage.
	// Prefer the entire named passage above; exact excerpts are a fallback only.
	for _, raw := range foundryAITexts(e) {
		text := foundryAIText(raw)
		if len([]rune(description)) >= 16 && strings.Contains(strings.ToLower(text), strings.ToLower(description)) {
			return statBlockEntry{Name: name, Description: description}, true
		}
	}
	return statBlockEntry{}, false
}

func foundryAINote(p *foundryAIProfile, note string) {
	if len(p.Notes) < 15 {
		p.Notes = append(p.Notes, chatClip(note, 1800))
	}
}

// Reconcile AI formatting and indexing before strict mechanics validation.
func prepareFoundryAIProfile(p *foundryAIProfile, e knowledgeEntity) {
	sections := foundryAISections(e.StatBlock)
	if p.Mode == "configure" {
		p.CasterLevel = 0
	}
	if len(p.Notes) > 10 {
		p.Notes = p.Notes[:10]
	}
	for i := range p.Notes {
		p.Notes[i] = chatClip(p.Notes[i], 1800)
	}
	for i := range p.Abilities {
		a := &p.Abilities[i]
		a.Name = strings.TrimSpace(a.Name)
		a.Description = foundryAIText(a.Description)
		a.ToHit = foundryAIText(a.ToHit)
		a.Damage = foundryAIText(a.Damage)
		switch strings.ToLower(a.Section) {
		case "action":
			a.Section = "actions"
		case "trait", "features", "feature":
			a.Section = "traits"
		case "reaction":
			a.Section = "reactions"
		case "bonusaction", "bonusactions":
			a.Section = "bonusActions"
		}
		entries := sections[a.Section]
		matched := -1
		for j, v := range entries {
			if strings.EqualFold(foundryAIText(v.Name), foundryAIText(a.Name)) {
				matched = j
				break
			}
		}
		if matched >= 0 {
			if strings.Contains(strings.ToLower(a.Name), "из источника") {
				a.Mechanics = foundryMechanics{Kind: "manual"}
				a.Damage = ""
				a.ToHit = ""
				a.Radius = 0
				a.DailyUses = 0
				a.ItemType = "feat"
			}
			a.Index = matched
			if len(a.Description) > 8000 {
				a.Description = ""
			}
			continue
		}
		if old, ok := foundryAIExtractedSource(e, *a); ok {
			a.Index = -1
			a.Description = old.Description
			// Line width is not a circular radius; recharge is not uses per day.
			if aiLineWidth.MatchString(old.Description) && !aiRadius.MatchString(old.Description) {
				a.Radius = 0
			}
			if aiRecharge.MatchString(old.Description) && !aiDaily.MatchString(old.Description) {
				a.DailyUses = 0
			}
		} else if a.Index >= 0 && a.Index < len(entries) && strings.Contains(strings.ToLower(entries[a.Index].Name), "из источника") {
			a.Index = -1
		}
	}
	if p.Mode == "configure" {
		kept := []foundryAILoot{}
		for _, l := range p.Loot {
			if e.RewardProfile != nil {
				for _, old := range e.RewardProfile.Loot {
					if old.Name == l.Name && l.Quantity > 0 && l.Quantity <= 100 {
						kept = append(kept, l)
						break
					}
				}
			}
		}
		if len(kept) != len(p.Loot) {
			foundryAINote(p, "Предметы вне исходного списка добычи пропущены; настройка способностей продолжена.")
		}
		p.Loot = kept
	}
	foundryAIKeepSourceSpells(p, e)
}

// A malformed field must not discard correctly extracted sibling abilities.
// Unsupported mechanics become visible manual features with source text.
func salvageFoundryAIProfile(p *foundryAIProfile, e knowledgeEntity) {
	original := *p
	p.Abilities = nil
	p.Spells = nil
	p.Skills = nil
	p.Loot = nil
	validate := func(candidate *foundryAIProfile) bool { return validateFoundryAIProfile(candidate, e) == nil }
	for _, a := range original.Abilities {
		candidate := *p
		candidate.Abilities = append(append([]foundryAIAbility{}, p.Abilities...), a)
		reason := validateFoundryAIProfile(&candidate, e)
		if reason == nil {
			*p = candidate
			continue
		}
		var source statBlockEntry
		ok := false
		entries := foundryAISections(e.StatBlock)[a.Section]
		if a.Index >= 0 && a.Index < len(entries) {
			source = entries[a.Index]
			ok = true
		} else {
			source, ok = foundryAIExtractedSource(e, a)
		}
		if ok && a.Name != "" && len(a.Name) <= 200 {
			a.Description = chatClip(source.Description, 7900)
			a.Damage = ""
			a.ToHit = ""
			a.Radius = 0
			a.DailyUses = 0
			a.Mechanics = foundryMechanics{Kind: "manual"}
			a.ItemType = "feat"
			a.SpellLevel = 0
			a.Animation = ""
			a.AnimationColor = ""
			candidate = *p
			candidate.Abilities = append(append([]foundryAIAbility{}, p.Abilities...), a)
			if validate(&candidate) {
				*p = candidate
				foundryAINote(p, a.Name+": описание сохранено; механика требует проверки мастером. "+reason.Error())
				continue
			}
		}
		foundryAINote(p, "Пропущена неподтвержденная или повторная способность: "+a.Name)
	}
	for _, v := range original.Spells {
		candidate := *p
		candidate.Spells = append(append([]foundryAISpell{}, p.Spells...), v)
		if validate(&candidate) {
			*p = candidate
		} else {
			foundryAINote(p, "Требует проверки заклинание: "+v.ID)
		}
	}
	for _, v := range original.Skills {
		candidate := *p
		candidate.Skills = append(append([]foundryAISkill{}, p.Skills...), v)
		if validate(&candidate) {
			*p = candidate
		} else {
			foundryAINote(p, "Требует проверки навык: "+v.ID)
		}
	}
	for _, v := range original.Loot {
		candidate := *p
		candidate.Loot = append(append([]foundryAILoot{}, p.Loot...), v)
		if validate(&candidate) {
			*p = candidate
		} else {
			foundryAINote(p, "Пропущен неподтвержденный предмет: "+v.Name)
		}
	}
}
