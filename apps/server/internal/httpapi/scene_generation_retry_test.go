package httpapi

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSceneCombinedValidationAndTopologyUsesTwoTurns(t *testing.T) {
	for _, message := range []string{`{"isMap":true,"walls":[],"lights":[],"darkness":0.4}`, `{"isMap":true,"walls":"bad","lights":[],"darkness":0.4}`, `{"isMap":false,"walls":[],"lights":[],"darkness":0}`} {
		calls := 0
		result, err := generateVerifiedCodexMap(context.Background(), "campaign", "60 by 30 cells, 5 feet", nil, true, func(in codexPromptInput) (codexPromptResult, error) {
			calls++
			if calls == 1 {
				return codexPromptResult{WorldMap: &mapGenerationResult{Image: mapFixturePNG()}}, nil
			}
			if !in.WorldMap.Validate || !in.WorldMap.SceneAnalysis || in.IncludeImages {
				t.Fatal("combined read-only check missing")
			}
			return codexPromptResult{Message: message}, nil
		}, true)
		if calls != 2 {
			t.Fatal(calls)
		}
		if strings.Contains(message, `false`) {
			if err == nil {
				t.Fatal("rejected image accepted")
			}
			continue
		}
		if err != nil || len(result.Image) == 0 {
			t.Fatal(err)
		}
		if strings.Contains(message, `"bad"`) {
			if result.Topology != nil {
				t.Fatal("invalid trace accepted")
			}
		} else if result.Topology == nil || result.Topology.Darkness != .4 {
			t.Fatal("trace lost")
		}
	}
	schema := sceneValidatedTopologySchema()
	if schema["properties"].(map[string]any)["isMap"] == nil {
		t.Fatal("schema missing image check")
	}
	if sceneTopologySchema()["properties"].(map[string]any)["isMap"] != nil {
		t.Fatal("standalone schema mutated")
	}
}

func TestSceneBackgroundRetriesMalformedResultAndChecksSameImage(t *testing.T) {
	image := mapFixturePNG()
	generates, checks := 0, 0
	result, err := generateVerifiedCodexMap(context.Background(), "campaign", "estate 60x30 storm", nil, true, func(in codexPromptInput) (codexPromptResult, error) {
		if in.WorldMap.Validate {
			checks++
			if string(in.WorldMap.Reference) != string(image) {
				t.Fatal("changed image")
			}
			if checks == 1 {
				return codexPromptResult{}, errors.New("temporary transport failure")
			}
			return codexPromptResult{Message: `{"isMap":true}`}, nil
		}
		generates++
		if !in.WorldMap.SceneBackground {
			t.Fatal("atlas instructions used")
		}
		if generates == 1 {
			return codexPromptResult{}, errors.New("Codex вернул некорректное описание карты.")
		}
		return codexPromptResult{WorldMap: &mapGenerationResult{Image: image}}, nil
	})
	if err != nil || generates != 2 || checks != 2 || len(result.Image) == 0 {
		t.Fatalf("%v generations=%d checks=%d", err, generates, checks)
	}
}

func TestSceneBackgroundDoesNotRetryQuotaOrTimeoutOrAcceptRejectedImage(t *testing.T) {
	for _, failure := range []error{errors.New("usage limit exceeded secret"), context.DeadlineExceeded} {
		calls := 0
		_, err := generateVerifiedCodexMap(context.Background(), "campaign", "estate", nil, true, func(codexPromptInput) (codexPromptResult, error) { calls++; return codexPromptResult{}, failure })
		var public *codexPromptPublicError
		if calls != 1 || !errors.As(err, &public) || strings.Contains(err.Error(), "secret") {
			t.Fatal(calls, err)
		}
	}
	calls := 0
	_, err := generateVerifiedCodexMap(context.Background(), "campaign", "estate", nil, true, func(in codexPromptInput) (codexPromptResult, error) {
		calls++
		if in.WorldMap.Validate {
			return codexPromptResult{Message: `{"isMap":false}`}, nil
		}
		return codexPromptResult{WorldMap: &mapGenerationResult{Image: mapFixturePNG()}}, nil
	})
	if err == nil || calls != 2 {
		t.Fatal("rejected bitmap accepted", err, calls)
	}
}
