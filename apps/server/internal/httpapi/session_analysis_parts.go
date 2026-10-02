package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode/utf8"
)

const sessionAnalysisTimeout = 30 * time.Minute
const sessionPartCharacters = 64000

// Parts are bounded even for a transcript with no newlines. A split line retains its number.
func numberedSessionParts(text string) []string {
	runes := []rune(text)
	parts := []string{}
	line := 1
	for offset := 0; offset < len(runes); {
		end := min(offset+sessionPartCharacters, len(runes))
		piece := string(runes[offset:end])
		lines := strings.Split(piece, "\n")
		for i := range lines {
			lines[i] = fmt.Sprintf("[L%d] %s", line+i, lines[i])
		}
		parts = append(parts, strings.Join(lines, "\n"))
		line += strings.Count(piece, "\n")
		offset = end
	}
	return parts
}

func extractSessionNotes(message string, limit int) (string, error) {
	raw := strings.TrimSpace(message)
	// Accept a single fenced JSON object from older clients, never arbitrary prose.
	if strings.HasPrefix(raw, "```json\n") && strings.HasSuffix(raw, "```") {
		raw = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(raw, "```json\n"), "```"))
	}
	var result struct {
		Notes string `json:"notes"`
	}
	if json.Unmarshal([]byte(raw), &result) != nil {
		return "", fmt.Errorf("AI вернул ответ не в формате JSON с полем notes")
	}
	if strings.TrimSpace(result.Notes) == "" {
		return "", fmt.Errorf("AI вернул пустые заметки части сессии")
	}
	if length := utf8.RuneCountInString(result.Notes); length > limit {
		return "", fmt.Errorf("Заметки AI превышают лимит: %d символов вместо %d", length, limit)
	}

	return result.Notes, nil
}

func (manager *codexBridgeManager) runPrompt(ctx context.Context, user authUser, input codexPromptInput) (codexPromptResult, error) {
	return manager.runSessionAnalysis(ctx, user, input, manager.runPromptOnce)
}

func (manager *codexBridgeManager) runSessionAnalysis(ctx context.Context, user authUser, input codexPromptInput, run func(context.Context, authUser, codexPromptInput) (codexPromptResult, error)) (codexPromptResult, error) {
	if input.SessionID == "" {
		return run(ctx, user, input)
	}
	if manager.auth == nil || manager.auth.store == nil {
		return codexPromptResult{}, fmt.Errorf("Хранилище сессий недоступно.")
	}
	session, ok := manager.auth.store.sessionForOwner(user.ID, input.CampaignID, input.SessionID)
	if !ok {
		return codexPromptResult{}, fmt.Errorf("Сессия не найдена в выбранной кампании.")
	}
	ctx, cancel := context.WithTimeout(ctx, sessionAnalysisTimeout)
	defer cancel()
	input.SessionRunID = newID("analysis")
	if utf8.RuneCountInString(session.Text) > 96000 {
		parts := numberedSessionParts(session.Text)
		limit := min(6000, 48000/len(parts))
		notes := make([]string, 0, len(parts))
		for index, part := range parts {
			reportAIJobStage(ctx, fmt.Sprintf("Разбираю часть %d из %d", index+1, len(parts)))
			if err := ctx.Err(); err != nil {
				return codexPromptResult{}, err
			}
			key := fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("v2-dm-report|%s|%s|%s|%s|%s|%s|%d", user.ID, input.CampaignID, session.ID, session.Digest, input.Model, input.Prompt, index))))
			manager.mu.Lock()
			note := manager.sessionPartNotes[key]
			manager.mu.Unlock()
			if note == "" {
				pieceInput := input
				pieceInput.SessionExtract = part
				pieceInput.SessionExtractLimit = limit
				var partErr error
				for attempt := 0; attempt < 2; attempt++ {
					if attempt > 0 {
						pieceInput.SessionExtractFeedback = safeCodexBridgeError(partErr)
					}
					result, err := run(ctx, user, pieceInput)
					partErr = err
					if err == nil {
						note, partErr = extractSessionNotes(result.Message, limit)
					}
					if partErr == nil || ctx.Err() != nil {
						break
					}
				}
				if partErr != nil {
					if ctx.Err() != nil {
						return codexPromptResult{}, ctx.Err()
					}
					reason := safeCodexBridgeError(partErr)
					log.Printf("session analysis extraction failed: part=%d/%d reason=%s", index+1, len(parts), reason)
					return codexPromptResult{}, &codexPromptPublicError{code: "session_part_failed", message: fmt.Sprintf("Не удалось разобрать часть %d из %d. Причина: %s. Исходный текст и прежний отчёт не изменены; готовые части временно сохранены на сервере.", index+1, len(parts), reason)}
				}
				manager.mu.Lock()
				if manager.sessionPartNotes == nil || len(manager.sessionPartNotes) >= 256 {
					manager.sessionPartNotes = make(map[string]string)
				}
				manager.sessionPartNotes[key] = note
				manager.mu.Unlock()
			}
			notes = append(notes, fmt.Sprintf("Часть %d/%d:\n%s", index+1, len(parts), note))
		}
		input.SessionNotes = strings.Join(notes, "\n\n")
	}
	// Never treat a prose answer or an old report as success. A second isolated turn can
	// repair missing/invalid save arguments while reusing all long-session extraction.
	var result codexPromptResult
	reportAIJobStage(ctx, "Собираю отчёт мастера и проверяю сохранение")
	var err error
	for attempt := 0; attempt < 2; attempt++ {
		current, exists := manager.auth.store.sessionForOwner(user.ID, input.CampaignID, input.SessionID)
		if !exists || current.Digest != session.Digest {
			return codexPromptResult{}, fmt.Errorf("Сессия удалена или изменена во время анализа.")
		}
		result, err = run(ctx, user, input)
		var public *codexPromptPublicError
		if err == nil || !errors.As(err, &public) || public.code != "session_analysis_incomplete" || ctx.Err() != nil {
			return result, err
		}
	}
	return result, err
}

func sessionPartOutputSchema(limit int) map[string]any {
	return map[string]any{"type": "object", "properties": map[string]any{"notes": map[string]any{"type": "string", "minLength": 1, "maxLength": limit}}, "required": []string{"notes"}, "additionalProperties": false}
}

func sessionExtractionRepairPrompt(input codexPromptInput) string {
	if input.SessionExtractFeedback == "" {
		return ""
	}
	return "The previous extraction was rejected: " + input.SessionExtractFeedback + ". Repair the output format or compress the notes to fit the budget. Preserve source references, confirmed outcomes and the end of the part; remove repetition, not evidence.\n"
}
