package httpapi

import (
	"regexp"
	"strconv"
	"strings"
)

var aiAttackSentence = regexp.MustCompile(`(?i)(?:рукопашная|дальнобойная|дальняя|melee|ranged)[^.!?]{0,70}(?:атака|attack)[^.!?]{0,50}?([+-]\s*\d+)\s*(?:к попаданию|to hit)`)
var aiHitSentence = regexp.MustCompile(`(?i)(?:попадание|hit)\s*:\s*([^.!?]+)`)
var aiDamageComponent = regexp.MustCompile(`(?i)^\s*(?:\d+\s*\((\d+\s*[dк]\s*(?:20|12|10|8|6|4)(?:\s*[+-]\s*\d+)?)\)|(\d+\s*[dк]\s*(?:20|12|10|8|6|4)(?:\s*[+-]\s*\d+)?)|(\d+))\s+(.+)$`)
var aiDamageSplit = regexp.MustCompile(`(?i)\s+(?:plus|плюс)\s+`)
var aiConditionalDamage = regexp.MustCompile(`(?i)если|при |спасброс|\bif\b|saving throw|instead`)

// Recover only explicit, unconditional attack/Hit sentences. No inferred ability bonus.
func foundryAITextAttack(source statBlockEntry) (foundryAIAbility, bool) {
	text := foundryAIText(source.Description)
	attack, hit := aiAttackSentence.FindStringSubmatch(text), aiHitSentence.FindStringSubmatch(text)
	if len(attack) < 2 || len(hit) < 2 || aiConditionalDamage.MatchString(hit[1]) {
		return foundryAIAbility{}, false
	}
	types := []struct{ pattern, kind string }{{"рубящ|slashing", "slashing"}, {"колющ|piercing", "piercing"}, {"дробящ|bludgeoning", "bludgeoning"}, {"огн|fire", "fire"}, {"холод|cold", "cold"}, {"кислот|acid", "acid"}, {"излучени|radiant", "radiant"}, {"некрот|necrotic", "necrotic"}, {"яд|poison", "poison"}, {"электр|молни|lightning", "lightning"}, {"психич|psychic", "psychic"}, {"силов|force", "force"}, {"гром|thunder", "thunder"}}
	parts := []string{}
	for _, chunk := range aiDamageSplit.Split(hit[1], -1) {
		m := aiDamageComponent.FindStringSubmatch(chunk)
		if len(m) == 0 {
			return foundryAIAbility{}, false
		}
		kind := ""
		for _, v := range types {
			if regexp.MustCompile("(?i)" + v.pattern).MatchString(m[4]) {
				if kind != "" {
					return foundryAIAbility{}, false
				}
				kind = v.kind
			}
		}
		if kind == "" {
			return foundryAIAbility{}, false
		}
		formula := m[1]
		if formula == "" {
			formula = m[2]
		}
		if formula == "" {
			formula = m[3]
		}
		parts = append(parts, aiFormulaText(formula)+" "+kind)
	}
	mode := "melee"
	if regexp.MustCompile(`(?i)дальн|ranged`).MatchString(attack[0]) {
		mode = "ranged"
	}
	r := 0
	if m := aiRange.FindStringSubmatch(text); len(m) > 1 {
		r, _ = strconv.Atoi(m[1])
	}
	return foundryAIAbility{ToHit: strings.ReplaceAll(attack[1], " ", ""), Damage: strings.Join(parts, " plus "), ItemType: "weapon", Mechanics: foundryMechanics{Kind: "attack", Activation: "action", AttackMode: mode, Range: r}}, true
}

func foundryAIRecoverAttack(a *foundryAIAbility, source statBlockEntry) {
	if parsed, ok := foundryAITextAttack(source); ok {
		a.ToHit, a.Damage = parsed.ToHit, parsed.Damage
		a.Mechanics = parsed.Mechanics
		if a.ItemType != "spell" {
			a.ItemType = "weapon"
		}
	}
}
