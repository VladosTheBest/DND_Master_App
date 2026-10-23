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
	Material string      `json:"material,omitempty"`
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
	Width       *int            `json:"width,omitempty"`
	Height      *int            `json:"height,omitempty"`
	FeetPerCell *float64        `json:"feetPerCell,omitempty"`
	MapType     string          `json:"mapType,omitempty"`
	Surface     string          `json:"surface,omitempty"`
	Layers      []creativeLayer `json:"layers,omitempty"`
	Style       string          `json:"style,omitempty"`
	GridSize    float64         `json:"gridSize,omitempty"`
	WallWidth   float64         `json:"wallWidth,omitempty"`
	FloorColor  string          `json:"floorColor,omitempty"`
	WallColor   string          `json:"wallColor,omitempty"`
	Hatching    bool            `json:"hatching,omitempty"`
	Version     int             `json:"version"`
	Background  string          `json:"background"`
	Grid        bool            `json:"grid"`
	Items       []creativeItem  `json:"items"`
}

var creativeAssetIDs = map[string]bool{"altar": true, "anvil": true, "banner": true, "bar": true, "barn": true, "barn-long": true, "barrel": true, "battlement": true, "beacon": true, "bed": true, "bedroll": true, "bench": true, "birch-1": true, "birch-2": true, "birch-3": true, "boat": true, "bones": true, "bookshelf": true, "bottles": true, "boulders-1": true, "boulders-2": true, "boulders-3": true, "boulders-4": true, "brazier": true, "bridge": true, "bush": true, "candelabra": true, "candles": true, "cart": true, "cauldron": true, "chain": true, "chair": true, "cherry-1": true, "cherry-2": true, "cherry-3": true, "chest": true, "city-gate": true, "cliff": true, "conifer-1": true, "conifer-2": true, "conifer-3": true, "conifer-4": true, "conifer-5": true, "cottage": true, "cottage-long": true, "crate": true, "crystal-blue": true, "crystal-purple": true, "deadwood-1": true, "deadwood-2": true, "deadwood-3": true, "desk": true, "dining-1": true, "dining-2": true, "dining-3": true, "door": true, "door-1": true, "door-2": true, "door-3": true, "double-bed": true, "double-door": true, "fence": true, "field-1": true, "field-2": true, "field-3": true, "field-4": true, "fire": true, "flowers-1": true, "flowers-2": true, "flowers-3": true, "forge": true, "fountain": true, "golden-1": true, "golden-2": true, "golden-3": true, "gravestone": true, "hanging-lamp": true, "hatch": true, "hay": true, "haystack": true, "hearth": true, "jungle-1": true, "jungle-2": true, "jungle-3": true, "keg": true, "lamp-green": true, "lantern": true, "large-tent": true, "lilies": true, "log": true, "manor": true, "manor-long": true, "maple-1": true, "maple-2": true, "maple-3": true, "market-1": true, "market-2": true, "market-3": true, "market-4": true, "mushrooms": true, "oak-1": true, "oak-2": true, "oak-3": true, "obelisk": true, "oven": true, "palisade": true, "palm": true, "pentagram": true, "pier": true, "pillar": true, "pine": true, "pit": true, "plates": true, "pond-stones": true, "portcullis": true, "reeds": true, "rock": true, "rocks": true, "round-hut": true, "round-rug": true, "round-table": true, "rug": true, "ruined-house": true, "ruined-house-long": true, "rune-circle": true, "sacks": true, "sarcophagus": true, "shrub-1": true, "shrub-2": true, "shrub-3": true, "shrub-4": true, "slate-house": true, "slate-house-long": true, "smithy": true, "smithy-long": true, "sofa": true, "spikes": true, "spiral-stairs": true, "stable": true, "stable-long": true, "stairs": true, "stall": true, "statue": true, "stone-wall-1": true, "stone-wall-2": true, "stone-wall-3": true, "streetlamp": true, "stump": true, "table": true, "tavern-roof": true, "tavern-roof-long": true, "temple-roof": true, "temple-roof-long": true, "tent": true, "thatch-house": true, "thatch-house-long": true, "throne": true, "tomb": true, "torch": true, "townhouse": true, "townhouse-long": true, "tree": true, "wagon-covered": true, "wardrobe": true, "warehouse": true, "warehouse-long": true, "watchtower-roof": true, "watermill": true, "well": true, "well-roof": true, "willow-1": true, "willow-2": true, "willow-3": true, "windmill": true, "window": true, "woodpile": true, "workbench": true}

func validateCreative(raw string) error {
	var scene creativeScene
	if len(raw) > 1<<20 || json.Unmarshal([]byte(raw), &scene) != nil || (scene.Version != 1 && scene.Version != 2) || !mapColor.MatchString(scene.Background) || scene.Items == nil || len(scene.Items) > 1000 {
		return fmt.Errorf("Некорректный холст: максимум 1000 объектов и 1 МБ.")
	}
	if scene.MapType != "" && scene.MapType != "dungeon" && scene.MapType != "city" && scene.MapType != "village" && scene.MapType != "wilderness" {
		return fmt.Errorf("Неизвестный тип карты.")
	}
	if !creativeMaterial(scene.Surface) {
		return fmt.Errorf("Неизвестная поверхность.")
	}
	width, height := creativeDimensions(scene)
	if width < 200 || width > 3200 || height < 200 || height > 3200 {
		return fmt.Errorf("Сторона карты: от 200 до 3200 пикселей.")
	}
	if scene.FeetPerCell != nil && (*scene.FeetPerCell < 1 || *scene.FeetPerCell > 1000) {
		return fmt.Errorf("Масштаб клетки: от 1 до 1000 футов.")
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
		if !creativeMaterial(item.Material) {
			return fmt.Errorf("Неизвестный материал.")
		}
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
			case "terrain", "road", "river", "wall", "brush", "corridor", "cave", "cut":
				if len(item.Points) < 2 {
					return fmt.Errorf("Не хватает точек.")
				}
			}
		}
		switch item.Kind {
		case "portal", "terrain", "road", "river", "brush", "wall", "room", "water", "tree", "table", "chair", "bed", "rock", "door", "stairs", "chest", "fire", "ellipse", "polygon", "corridor", "cave", "cut", "asset", "image", "text":
		default:
			return fmt.Errorf("Неизвестный объект.")
		}
		for _, v := range []float64{item.X, item.Y, item.W, item.H, item.Rotation} {
			if math.IsNaN(v) || math.IsInf(v, 0) || math.Abs(v) > 4096 {
				return fmt.Errorf("Некорректные размеры.")
			}
		}
		if item.W < 1 || item.H < 1 || item.X < 0 || item.X > float64(width) || item.Y < 0 || item.Y > float64(height) || item.Rotation < -180 || item.Rotation > 180 {
			return fmt.Errorf("Некорректные размеры.")
		}
		for _, p := range item.Points {
			if len(p) != 2 {
				return fmt.Errorf("Точка должна иметь две координаты.")
			}
			for axis, v := range p {
				if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 || (axis == 0 && v > float64(width)) || (axis == 1 && v > float64(height)) {
					return fmt.Errorf("Некорректный штрих.")
				}
			}
		}
		if item.Kind == "portal" && (len(item.Points) != 2 || item.Rotation != 0 || math.Hypot(item.Points[1][0]-item.Points[0][0], item.Points[1][1]-item.Points[0][1]) < 4) {
			return fmt.Errorf("Дверь должна быть отрезком длиной не менее 4 пикселей.")
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
	width, height := creativeDimensions(scene)
	if cfg.Width != width || cfg.Height != height {
		writeError(w, 400, "invalid_image", "Размер изображения не совпадает с размером холста.")
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
					writeCurrentConflict(w, "map_conflict", "Карта изменилась в другом окне. Черновик не записан; сравните проекты.", m)
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
		scale := "site"
		if scene.MapType == "city" || scene.MapType == "village" {
			scale = "city"
		}
		doc := worldMapDocument{ID: input.ID, Title: input.Title, ImageURL: canonical, Creative: input.Creative, Width: width, Height: height, Labels: []worldMapLabel{}, Provider: "creative", Scale: scale, Context: &worldMapContext{}, CreatedAt: time.Now().UTC(), Revision: input.Revision + 1}
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

func creativeMaterial(value string) bool {
	switch value {
	case "", "grass", "earth", "sand", "snow", "cobble", "water", "forest-path", "mud", "flagstone", "brick-road":
		return true
	}
	return false
}

func creativeDimensions(scene creativeScene) (int, int) {
	w, h := 1600, 1000
	if scene.Width != nil {
		w = *scene.Width
	}
	if scene.Height != nil {
		h = *scene.Height
	}
	return w, h
}
