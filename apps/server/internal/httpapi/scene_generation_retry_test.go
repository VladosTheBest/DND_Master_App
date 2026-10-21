package httpapi

import (
	"context"
	"errors"
	"strings"
	"testing"
)

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
