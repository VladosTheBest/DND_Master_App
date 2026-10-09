package httpapi

import (
	_ "embed"
	"encoding/json"
)

// Shared with the module's generated animation-catalog.mjs; build and tests enforce parity.
//
//go:embed foundry_animation_catalog.json
var foundryAnimationCatalogJSON []byte

type foundryAnimationDefinition struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Aliases     []string `json:"aliases,omitempty"`
	Foundation  bool     `json:"foundation,omitempty"`
	SpellLevel  int      `json:"spellLevel"`
}

var foundryAnimationCatalog = func() []foundryAnimationDefinition {
	var definitions []foundryAnimationDefinition
	if err := json.Unmarshal(foundryAnimationCatalogJSON, &definitions); err != nil {
		panic(err)
	}
	return definitions
}()

func validAIAnimation(key string) bool {
	if key == "" {
		return true
	}
	for _, definition := range foundryAnimationCatalog {
		if definition.Key == key {
			return true
		}
	}
	return false
}
func foundryAnimationKeys() []string {
	keys := []string{""}
	for _, definition := range foundryAnimationCatalog {
		keys = append(keys, definition.Key)
	}
	return keys
}
