package httpapi

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
)

type creativeLayer struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Visible bool    `json:"visible"`
	Locked  bool    `json:"locked"`
	Opacity float64 `json:"opacity"`
}
type creativeItem struct {
	AssetID  string      `json:"assetId,omitempty"`
	ImageURL string      `json:"imageUrl,omitempty"`
	Text     string      `json:"text,omitempty"`
	LayerID  string      `json:"layerId,omitempty"`
	Locked   bool        `json:"locked,omitempty"`
	FlipX    bool        `json:"flipX,omitempty"`
	ID       string      `json:"id"`
	Kind     string      `json:"kind"`
	X        float64     `json:"x"`
	Y        float64     `json:"y"`
	W        float64     `json:"w"`
	H        float64     `json:"h"`
	Rotation float64     `json:"rotation"`
	Color    string      `json:"color"`
	Points   [][]float64 `json:"points,omitempty"`
}
type creativeScene struct {
	Layers     []creativeLayer `json:"layers,omitempty"`
	Style      string          `json:"style,omitempty"`
	GridSize   float64         `json:"gridSize,omitempty"`
	WallWidth  float64         `json:"wallWidth,omitempty"`
	FloorColor string          `json:"floorColor,omitempty"`
	WallColor  string          `json:"wallColor,omitempty"`
	Hatching   bool            `json:"hatching,omitempty"`
	Version    int             `json:"version"`
	Background string          `json:"background"`
	Grid       bool            `json:"grid"`
	Items      []creativeItem  `json:"items"`
}

var creativeAssetIDs = map[string]bool{"tree": true, "pine": true, "bush": true, "stump": true, "rock": true, "rocks": true, "mushrooms": true, "lilies": true, "table": true, "round-table": true, "chair": true, "bench": true, "bed": true, "double-bed": true, "wardrobe": true, "bookshelf": true, "rug": true, "sofa": true, "desk": true, "door": true, "double-door": true, "portcullis": true, "stairs": true, "spiral-stairs": true, "chest": true, "crate": true, "barrel": true, "pillar": true, "pit": true, "spikes": true, "bones": true, "chain": true, "bar": true, "keg": true, "plates": true, "hearth": true, "cauldron": true, "sacks": true, "bottles": true, "fire": true, "tent": true, "bedroll": true, "cart": true, "boat": true, "log": true, "altar": true, "statue": true, "sarcophagus": true, "pentagram": true, "candles": true, "throne": true, "gravestone": true, "fountain": true, "well": true, "stall": true, "bridge": true, "fence": true, "anvil": true, "hay": true, "banner": true}

func validateCreative(raw string) error {
	var scene creativeScene
	if len(raw) > 1<<20 || json.Unmarshal([]byte(raw), &scene) != nil || (scene.Version != 1 && scene.Version != 2) || !mapColor.MatchString(scene.Background) || scene.Items == nil || len(scene.Items) > 1000 {
		return fmt.Errorf("Некорректный холст: максимум 1000 объектов и 1 МБ.")
	}
	layers := map[string]bool{}
	if scene.Version == 2 && (len(scene.Layers) < 1 || len(scene.Layers) > 16) {
		return fmt.Errorf("Нужно от 1 до 16 слоёв.")
	}
	for _, l := range scene.Layers {
		if l.ID == "" || len(l.ID) > 80 || layers[l.ID] || strings.TrimSpace(l.Name) == "" || len([]rune(l.Name)) > 80 || l.Opacity < 0 || l.Opacity > 1 {
			return fmt.Errorf("Некорректный слой.")
		}
		layers[l.ID] = true
	}
	if (scene.GridSize != 0 && (scene.GridSize < 10 || scene.GridSize > 200)) || (scene.WallWidth != 0 && (scene.WallWidth < 1 || scene.WallWidth > 20)) || (scene.FloorColor != "" && !mapColor.MatchString(scene.FloorColor)) || (scene.WallColor != "" && !mapColor.MatchString(scene.WallColor)) {
		return fmt.Errorf("Некорректное оформление холста.")
	}
	switch scene.Style {
	case "", "classic", "parchment", "blueprint", "stone", "night", "forest":
	default:
		return fmt.Errorf("Неизвестный стиль.")
	}
	images := map[string]bool{}
	seen := map[string]bool{}
	for _, item := range scene.Items {
		if item.ID == "" || len(item.ID) > 80 || seen[item.ID] || !mapColor.MatchString(item.Color) || len(item.Points) > 5000 {
			return fmt.Errorf("Некорректный объект холста.")
		}
		seen[item.ID] = true
		if scene.Version == 2 && !layers[item.LayerID] {
			return fmt.Errorf("Не найден слой объекта.")
		}
		if item.Kind == "asset" && !creativeAssetIDs[item.AssetID] {
			return fmt.Errorf("Неизвестный ассет.")
		}
		if item.Kind == "text" && (strings.TrimSpace(item.Text) == "" || len([]rune(item.Text)) > 160) {
			return fmt.Errorf("Подпись должна содержать 1–160 символов.")
		}
		if item.Kind == "image" {
			if !strings.HasPrefix(item.ImageURL, "/uploads/") || len(item.ImageURL) > 500 {
				return fmt.Errorf("Изображение должно быть загружено в кампанию.")
			}
			images[item.ImageURL] = true
			if len(images) > 30 {
				return fmt.Errorf("Не более 30 разных изображений.")
			}
		}
		if scene.Version == 2 {
			switch item.Kind {
			case "polygon":
				if len(item.Points) < 3 {
					return fmt.Errorf("Не хватает вершин.")
				}
			case "wall", "brush", "corridor", "cave", "cut":
				if len(item.Points) < 2 {
					return fmt.Errorf("Не хватает точек.")
				}
			}
		}
		switch item.Kind {
		case "brush", "wall", "room", "water", "tree", "table", "chair", "bed", "rock", "door", "stairs", "chest", "fire", "ellipse", "polygon", "corridor", "cave", "cut", "asset", "image", "text":
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
			if len(p) != 2 {
				return fmt.Errorf("Точка должна иметь две координаты.")
			}
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
	var scene creativeScene
	_ = json.Unmarshal([]byte(input.Creative), &scene)
	checked := map[string]bool{}
	for _, item := range scene.Items {
		if item.Kind == "image" && !checked[item.ImageURL] {
			if _, _, err := srv.worldMapReference(r.Context(), user.ID, campaign.ID, item.ImageURL); err != nil {
				writeError(w, 400, "invalid_reference", err.Error())
				return
			}
			checked[item.ImageURL] = true
		}
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
