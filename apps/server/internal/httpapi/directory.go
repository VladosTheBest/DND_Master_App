package httpapi

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

func serveDirectory(w http.ResponseWriter, r *http.Request, c campaignData) {
	limit := 48
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 100 {
			writeError(w, 400, "invalid_page", "limit must be 1..100")
			return
		}
		limit = n
	}
	kind, q := r.URL.Query().Get("kind"), strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	entries := []knowledgeEntity{}
	for _, e := range campaignEntities(c) {
		if e.Kind != kind || !directoryTabMatches(e, r.URL.Query().Get("tab")) {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(e.Title+" "+e.Subtitle+" "+e.Summary+" "+strings.Join(e.Tags, " ")), q) {
			continue
		}
		e.Content = ""
		e.PlayerContent = ""
		e.PlayerCards = nil
		e.Gallery = nil
		e.Playlist = nil
		e.StatBlock = nil
		e.FoundryAI = nil
		entries = append(entries, e)
	}
	raw, _ := json.Marshal(entries)
	version := fmt.Sprintf("%x", sha256.Sum256(append([]byte(kind+q), raw...)))[:20]
	offset := 0
	if cursor := r.URL.Query().Get("cursor"); cursor != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(cursor)
		parts := strings.Split(string(decoded), ":")
		if err != nil || len(parts) != 2 || parts[0] != version {
			writeError(w, 409, "directory_cursor_expired", "Список изменился. Обновите его.")
			return
		}
		offset, err = strconv.Atoi(parts[1])
		if err != nil || offset < 0 || offset > len(entries) {
			writeError(w, 400, "invalid_cursor", "Некорректная страница.")
			return
		}
	}
	end := min(offset+limit, len(entries))
	next := ""
	if end < len(entries) {
		next = base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%d", version, end)))
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, map[string]any{"items": entries[offset:end], "total": len(entries), "nextCursor": next})
}

func directoryTabMatches(e knowledgeEntity, tab string) bool {
	if tab == "" || tab == "Все" || tab == "All" || tab == "Импорт" || tab == "Imported" {
		return true
	}
	switch tab {
	case "Города", "Cities":
		return e.Category == "City"
	case "Регионы", "Regions":
		return e.Category == "Region"
	case "Подземелья", "Dungeons":
		return e.Category == "Dungeon"
	case "Точки", "POI":
		return e.Category == "POI"
	case "Активные", "Active":
		return e.Status == "Active" || e.Status == "active"
	case "Резерв", "Reserve":
		return e.Status == "Reserve"
	case "Гости", "Guest":
		return e.Status == "Guest"
	case "Важные", "Critical":
		return e.Importance == "Critical"
	case "Союзники", "Allies":
		return e.Status == "Ally"
	case "Угрозы", "Threats", "Threat Files":
		return e.Status == "Threat" || e.Category == "Threat"
	case "Пауза", "Paused":
		return e.Status == "paused"
	case "Завершены", "Completed":
		return e.Status == "completed"
	case "Только GM", "GM Only":
		return e.Visibility == "gm_only"
	case "Для игроков", "Player Safe":
		return e.Visibility == "player_safe"
	}
	return false
}
