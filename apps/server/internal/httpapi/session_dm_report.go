package httpapi

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

// This is evidence-backed GM preparation, never an automatic campaign mutation.
type sessionDMFinding struct {
	Section string               `json:"section"`
	Title   string               `json:"title"`
	Detail  string               `json:"detail"`
	Basis   string               `json:"basis"`
	Speaker string               `json:"speaker,omitempty"`
	Status  string               `json:"status,omitempty"`
	Sources []sessionSourceRange `json:"sources"`
}
type sessionDMScene struct {
	Title   string               `json:"title"`
	Detail  string               `json:"detail"`
	Sources []sessionSourceRange `json:"sources"`
}
type sessionDMReport struct {
	Version  int                `json:"version"`
	Scenes   []sessionDMScene   `json:"scenes"`
	Findings []sessionDMFinding `json:"findings"`
}

func validateSessionDMReport(report *sessionDMReport, text string) error {
	if report == nil {
		return nil
	} // Legacy reports remain supported.
	if report.Version != 1 || len(report.Scenes) > 40 || len(report.Findings) > 100 {
		return fmt.Errorf("Неподдерживаемая версия или слишком большой отчёт мастера.")
	}
	if report.Scenes == nil {
		report.Scenes = []sessionDMScene{}
	}
	if report.Findings == nil {
		report.Findings = []sessionDMFinding{}
	}
	lines := strings.Split(text, "\n")
	validText := func(s string, max int) bool {
		return strings.TrimSpace(s) != "" && utf8.ValidString(s) && utf8.RuneCountInString(s) <= max
	}
	validSources := func(sources []sessionSourceRange) bool {
		if len(sources) < 1 || len(sources) > 6 {
			return false
		}
		for _, s := range sources {
			if s.FromLine < 1 || s.ToLine < s.FromLine || s.ToLine > len(lines) || strings.TrimSpace(strings.Join(lines[s.FromLine-1:s.ToLine], "\n")) == "" {
				return false
			}
		}
		return true
	}
	last := 0
	for _, scene := range report.Scenes {
		if !validText(scene.Title, 200) || !validText(scene.Detail, 2000) || !validSources(scene.Sources) || scene.Sources[0].FromLine < last {
			return fmt.Errorf("Проверьте хронологию сцен и ссылки на исходные строки.")
		}
		last = scene.Sources[0].FromLine
	}
	for _, f := range report.Findings {
		if !validText(f.Title, 200) || !validText(f.Detail, 2000) || !validSources(f.Sources) || (f.Speaker != "" && !validText(f.Speaker, 100)) {
			return fmt.Errorf("Вывод мастера должен содержать текст и проверяемые источники.")
		}
		switch f.Section {
		case "decisions", "spotlight", "interests", "feedback", "world", "threads", "continuity", "preparation":
		default:
			return fmt.Errorf("Неизвестный раздел отчёта мастера.")
		}
		switch f.Basis {
		case "observed", "explicit", "hypothesis", "suggestion":
		default:
			return fmt.Errorf("Укажите основание вывода мастера.")
		}
		if f.Section == "feedback" && f.Basis != "explicit" {
			return fmt.Errorf("Отзывы должны опираться на прямые слова участников.")
		}
		if f.Section == "preparation" && f.Basis != "suggestion" {
			return fmt.Errorf("Подготовку отмечайте как рекомендацию, а не факт.")
		}
		switch f.Status {
		case "", "open", "resolved", "uncertain":
		default:
			return fmt.Errorf("Неизвестный статус сюжетной линии.")
		}
	}
	return nil
}
