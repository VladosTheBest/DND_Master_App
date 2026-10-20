package httpapi

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
)

type creativeItem struct {
	ID       string       `json:"id"`
	Kind     string       `json:"kind"`
	X        float64      `json:"x"`
	Y        float64      `json:"y"`
	W        float64      `json:"w"`
	H        float64      `json:"h"`
	Rotation float64      `json:"rotation"`
	Color    string       `json:"color"`
	Points   [][2]float64 `json:"points,omitempty"`
}
type creativeScene struct {
	Version    int            `json:"version"`
	Background string         `json:"background"`
	Grid       bool           `json:"grid"`
	Items      []creativeItem `json:"items"`
}

func validateCreative(raw string) error {
	var scene creativeScene
	if len(raw) > 1<<20 || json.Unmarshal([]byte(raw), &scene) != nil || scene.Version != 1 || !mapColor.MatchString(scene.Background) || scene.Items == nil || len(scene.Items) > 1000 {
		return fmt.Errorf("Некорректный холст: максимум 1000 объектов и 1 МБ.")
	}
	seen := map[string]bool{}
	for _, item := range scene.Items {
		if item.ID == "" || len(item.ID) > 80 || seen[item.ID] || !mapColor.MatchString(item.Color) || len(item.Points) > 5000 {
			return fmt.Errorf("Некорректный объект холста.")
		}
		seen[item.ID] = true
		switch item.Kind {
		case "brush", "wall", "room", "water", "tree", "table", "chair", "bed", "rock", "door", "stairs", "chest", "fire":
		default:
			return fmt.Errorf("Неизвестный объект.")
		}
		for _, v := range []float64{item.X, item.Y, item.W, item.H, item.Rotation} {
			if math.IsNaN(v) || math.IsInf(v, 0) || math.Abs(v) > 4096 {
				return fmt.Errorf("Некорректные размеры.")
			}
		}
		if item.W < 1 || item.H < 1 || item.X < 0 || item.X > 1600 || item.Y < 0 || item.Y > 1000 || item.Rotation < -180 || item.Rotation > 180 {
			return fmt.Errorf("Некорректные размеры.")
		}
		for _, p := range item.Points {
			for axis, v := range p {
				if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 || v > 1600 || (axis == 1 && v > 1000) {
					return fmt.Errorf("Некорректный штрих.")
				}
			}
		}
	}
	return nil
}
func (srv *server) saveCreativeMap(w http.ResponseWriter, r *http.Request, user authUser, campaign campaignData) {
	var input struct {
		ID       string `json:"id"`
		Revision int    `json:"revision"`
		Title    string `json:"title"`
		ImageURL string `json:"imageUrl"`
		Creative string `json:"creative"`
	}
	if !boundedMutationInput(w, r, &input, 2<<20) {
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	if !mapRequestID.MatchString(input.ID) || input.Title == "" || len([]rune(input.Title)) > 160 {
		writeError(w, 400, "invalid_map", "Проверь название и ID карты.")
		return
	}
	if err := validateCreative(input.Creative); err != nil {
		writeError(w, 400, "invalid_map", err.Error())
		return
	}
	canonical, b, err := srv.worldMapReference(r.Context(), user.ID, campaign.ID, input.ImageURL)
	if err != nil {
		writeError(w, 400, "invalid_reference", err.Error())
		return
	}
	cfg, _, err := mapImageConfig(b)
	if err != nil {
		writeError(w, 400, "invalid_image", err.Error())
		return
	}
	if cfg.Width != 1600 || cfg.Height != 1000 {
		writeError(w, 400, "invalid_image", "Холст должен быть 1600 × 1000.")
		return
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	for ci := range srv.store.data.Campaigns {
		c := &srv.store.data.Campaigns[ci]
		if c.ID != campaign.ID || c.OwnerID != user.ID {
			continue
		}
		index := -1
		for i, m := range c.WorldMaps {
			if m.ID == input.ID {
				index = i
				if m.Provider != "creative" || m.Revision != input.Revision {
					writeError(w, 409, "map_conflict", "Карта изменена. Открой сохранённую версию.")
					return
				}
			}
		}
		if index < 0 && (input.Revision != 0 || len(c.WorldMaps) >= 200) {
			writeError(w, 409, "map_limit", "Нельзя создать карту: проверь ревизию и лимит 200 карт.")
			return
		}
		original, err := cloneStorageState(srv.store.data)
		if err != nil {
			writeError(w, 500, "save_failed", "Не удалось сохранить карту.")
			return
		}
		doc := worldMapDocument{ID: input.ID, Title: input.Title, ImageURL: canonical, Creative: input.Creative, Width: 1600, Height: 1000, Labels: []worldMapLabel{}, Provider: "creative", Scale: "site", Context: &worldMapContext{}, CreatedAt: time.Now().UTC(), Revision: input.Revision + 1}
		if index < 0 {
			c.WorldMaps = append(c.WorldMaps, doc)
		} else {
			doc.CreatedAt = c.WorldMaps[index].CreatedAt
			c.WorldMaps[index] = doc
		}
		c.Revision++
		if err := srv.store.saveMutationLocked(original); err != nil {
			writeError(w, 500, "save_failed", "Не удалось сохранить карту.")
			return
		}
		writeJSON(w, 200, doc)
		return
	}
	writeError(w, 404, "not_found", "Кампания не найдена.")
}
