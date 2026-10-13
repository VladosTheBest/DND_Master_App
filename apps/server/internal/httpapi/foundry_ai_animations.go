package httpapi

import "regexp"

var foundryAnimationPath = regexp.MustCompile(`^jb2a\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+){0,8}$`)

func foundryAISchemaForOptions(edition string, options []string) map[string]any {
	schema := foundryAISchema(edition)
	// Share the catalog: repeating it for spells and abilities exceeds the provider's
	// 1000-value schema limit with the spell catalog and a full JB2A installation.
	schema["$defs"] = map[string]any{"sequencerAnimation": map[string]any{"type": "string", "enum": append([]string{""}, options...)}}
	props := schema["properties"].(map[string]any)
	for _, name := range []string{"abilities", "spells"} {
		item := props[name].(map[string]any)["items"].(map[string]any)
		item["properties"].(map[string]any)["sequencerAnimation"] = map[string]any{"$ref": "#/$defs/sequencerAnimation"}
	}
	return schema
}
func foundryAISelectAnimations(p *foundryAIProfile, options []string) {
	allowed := map[string]bool{"": true}
	for _, s := range options {
		allowed[s] = true
	}
	for i := range p.Abilities {
		if !allowed[p.Abilities[i].SequencerAnimation] {
			p.Abilities[i].SequencerAnimation = ""
		}
	}
	for i := range p.Spells {
		if !allowed[p.Spells[i].SequencerAnimation] {
			p.Spells[i].SequencerAnimation = ""
		}
	}
	p.AnimationCatalogHash = foundryHash(options)
}
