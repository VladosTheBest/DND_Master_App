package httpapi

import (
	"context"
	"errors"
	"strings"
	"time"
)

// Provider failures are distinct from invalid geometry. Never return raw diagnostics:
// they can contain prompts, image paths or credentials.
type sceneAnalysisFailure struct {
	message string
	retry   bool
}

func (e *sceneAnalysisFailure) Error() string { return e.message }

func classifySceneAnalysisFailure(err error) *sceneAnalysisFailure {
	s := strings.ToLower(err.Error())
	switch {
	case strings.Contains(s, "usage limit"), strings.Contains(s, "quota"), strings.Contains(s, "insufficient_quota"):
		return &sceneAnalysisFailure{message: "Достигнут лимит Codex. Фон сохранён. После восстановления лимита повторите только стены, двери и свет."}
	case strings.Contains(s, "429"), strings.Contains(s, "too many requests"), strings.Contains(s, "rate limit"):
		return &sceneAnalysisFailure{message: "Codex ограничил запросы (429). Фон сохранён. Повторите только стены, двери и свет позже; если ограничение сохраняется, проверьте лимиты Codex в настройках сайта.", retry: true}
	case strings.Contains(s, "401"), strings.Contains(s, "unauthorized"), strings.Contains(s, "authentication"):
		return &sceneAnalysisFailure{message: "Восстановите подключение Codex в настройках сайта. Фон сохранён; затем повторите только стены, двери и свет."}
	case errors.Is(err, context.DeadlineExceeded), strings.Contains(s, "timeout"):
		return &sceneAnalysisFailure{message: "Codex не успел завершить анализ карты. Фон сохранён; повторите только стены, двери и свет."}
	case strings.Contains(s, "503"), strings.Contains(s, "502"), strings.Contains(s, "connection reset"), strings.Contains(s, "temporarily unavailable"):
		return &sceneAnalysisFailure{message: "Сервис анализа Codex временно недоступен. Фон сохранён; повторите только стены, двери и свет позже.", retry: true}
	default:
		return &sceneAnalysisFailure{message: "Codex завершил запрос анализа с ошибкой. Фон сохранён; повторите только стены, двери и свет."}
	}
}

func waitSceneAnalysisRetry(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func retrySceneAnalysis(ctx context.Context, run func() (codexPromptResult, error), wait func(context.Context, time.Duration) error) (codexPromptResult, error) {
	for attempt := 0; ; attempt++ {
		if err := ctx.Err(); err != nil {
			return codexPromptResult{}, err
		}
		result, err := run()
		if err == nil {
			return result, nil
		}
		failure := classifySceneAnalysisFailure(err)
		if !failure.retry || attempt >= 2 || ctx.Err() != nil {
			return codexPromptResult{}, failure
		}
		reportAIJobStage(ctx, "Codex временно ограничил анализ. Ожидаем перед повтором; фон сохранён")
		if err := wait(ctx, time.Duration(attempt+1)*20*time.Second); err != nil {
			return codexPromptResult{}, err
		}
		reportAIJobStage(ctx, "Повторный анализ стен и дверей по сохранённому фону")
	}
}
