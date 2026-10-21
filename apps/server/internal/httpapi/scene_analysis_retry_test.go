package httpapi

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestSceneAnalysisRetryRecoversThrottle(t *testing.T) {
	calls := 0
	var delays []time.Duration
	result, err := retrySceneAnalysis(context.Background(), func() (codexPromptResult, error) {
		calls++
		if calls < 3 {
			return codexPromptResult{}, errors.New("exceeded retry limit, last status: 429 Too Many Requests")
		}
		return codexPromptResult{Message: "geometry"}, nil
	}, func(_ context.Context, d time.Duration) error { delays = append(delays, d); return nil })
	if err != nil || result.Message != "geometry" || calls != 3 || len(delays) != 2 || delays[0] != 20*time.Second || delays[1] != 40*time.Second {
		t.Fatalf("result=%+v err=%v calls=%d delays=%v", result, err, calls, delays)
	}
}

func TestSceneAnalysisRetryIsBoundedAndSafe(t *testing.T) {
	for _, tt := range []struct {
		raw     string
		calls   int
		message string
	}{
		{"429 Too Many Requests secret-value", 3, "429"},
		{"usage limit exceeded secret-value", 1, "лимит"},
		{"401 unauthorized secret-value", 1, "подключение"},
		{"timeout secret-value", 1, "не успел"},
		{"unexpected secret-value", 1, "с ошибкой"},
	} {
		t.Run(tt.message, func(t *testing.T) {
			calls := 0
			_, err := retrySceneAnalysis(context.Background(), func() (codexPromptResult, error) { calls++; return codexPromptResult{}, errors.New(tt.raw) }, func(context.Context, time.Duration) error { return nil })
			var failure *sceneAnalysisFailure
			if calls != tt.calls || !errors.As(err, &failure) || !strings.Contains(err.Error(), tt.message) || strings.Contains(err.Error(), "secret-value") {
				t.Fatalf("calls=%d err=%v", calls, err)
			}
		})
	}
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	_, err := retrySceneAnalysis(ctx, func() (codexPromptResult, error) { calls++; return codexPromptResult{}, errors.New("429") }, func(ctx context.Context, _ time.Duration) error {
		cancel()
		return waitSceneAnalysisRetry(ctx, time.Hour)
	})
	if !errors.Is(err, context.Canceled) || calls != 1 {
		t.Fatalf("canceled: calls=%d err=%v", calls, err)
	}
}
