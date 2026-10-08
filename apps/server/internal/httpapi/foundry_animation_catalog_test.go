package httpapi

import (
	"reflect"
	"testing"
)

func TestFoundryAIAnimationCatalog(t *testing.T) {
	seen := map[string]bool{}
	for _, entry := range foundryAnimationCatalog {
		if entry.Key == "" || seen[entry.Key] || entry.Label == "" || entry.Description == "" || !validAIAnimation(entry.Key) {
			t.Fatalf("invalid animation definition: %+v", entry)
		}
		seen[entry.Key] = true
	}
	for _, key := range []string{"sword-blood", "axe-blood", "vine-bind", "thorn-whip", "eldritch-blast", "holy-smite"} {
		if !seen[key] {
			t.Fatalf("missing profile %s", key)
		}
	}
	if validAIAnimation("sword|axe") || validAIAnimation("external-script") || !validAIAnimation("") {
		t.Fatal("animation validation must accept only catalog keys or automatic selection")
	}
	properties := foundryAISchema()["properties"].(map[string]any)
	for _, field := range []string{"abilities", "spells"} {
		items := properties[field].(map[string]any)["items"].(map[string]any)
		animation := items["properties"].(map[string]any)["animation"].(map[string]any)
		if !reflect.DeepEqual(animation["enum"], foundryAnimationKeys()) {
			t.Fatalf("%s schema differs from renderer catalog", field)
		}
	}
}
