package httpapi

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"path"
	"shadowedge/server/internal/videoprep"
	"strings"
)

type sceneLight struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Bright float64 `json:"bright"`
	Dim    float64 `json:"dim"`
	Color  string  `json:"color"`
}

// Door visuals use bundled module assets, never arbitrary external URLs.
type sceneDoorVisual struct {
	Style     string  `json:"style"`
	Direction int     `json:"direction"`
	Double    bool    `json:"double"`
	Flip      bool    `json:"flip"`
	Strength  float64 `json:"strength"`
	Duration  int     `json:"duration"`
}

type sceneVideo struct {
	URL        string `json:"url"`
	Start      int    `json:"startSeconds"`
	Duration   int    `json:"durationSeconds"`
	Height     int    `json:"maxHeight"`
	PreviewURL string `json:"previewUrl,omitempty"`
	PosterURL  string `json:"posterUrl,omitempty"`
}

func validVideoLink(raw string, preview bool) bool {
	u, e := url.Parse(raw)
	return len(raw) <= 4096 && e == nil && u.Hostname() != "" && u.User == nil && (u.Scheme == "https" || preview && u.Scheme == "http")
}
func validateVideo(v *sceneVideo) error {
	if v == nil {
		return nil
	}
	if !validVideoLink(v.URL, false) || v.Start < 0 || v.Start > 86400 || v.Duration < 1 || v.Duration > 600 || (v.Height != 720 && v.Height != 1080 && v.Height != 1440) {
		return fmt.Errorf("Некорректный источник или фрагмент видео")
	}
	u, _ := url.Parse(v.URL)
	ext := strings.ToLower(path.Ext(u.Path))
	if ext != ".mp4" && ext != ".webm" {
		if _, e := (videoprep.Source{URL: v.URL, Start: v.Start, Duration: v.Duration, Height: v.Height}).Normalize(); e != nil {
			return e
		}
	}
	if v.PreviewURL != "" && !validVideoLink(v.PreviewURL, true) || v.PosterURL != "" && !validVideoLink(v.PosterURL, true) {
		return fmt.Errorf("Некорректная ссылка на локальное превью")
	}
	return nil
}

type sessionMapLevelDocument struct {
	Video        *sceneVideo         `json:"video,omitempty"`
	Creative     string              `json:"creative,omitempty"`
	EditorWalls  []publicDisplayWall `json:"editorWalls,omitempty"`
	Lights       []sceneLight        `json:"lights,omitempty"`
	Weather      string              `json:"weather,omitempty"`
	Darkness     float64             `json:"darkness,omitempty"`
	Columns      int                 `json:"columns,omitempty"`
	Rows         int                 `json:"rows,omitempty"`
	ID           string              `json:"id"`
	Name         string              `json:"name"`
	ImageURL     string              `json:"imageUrl"`
	RoofURL      string              `json:"roofUrl,omitempty"`
	Width        int                 `json:"width"`
	Height       int                 `json:"height"`
	Walls        []publicDisplayWall `json:"walls"`
	Grid         *publicDisplayGrid  `json:"grid,omitempty"`
	GridDistance float64             `json:"gridDistance,omitempty"`
	RoofZones    []publicRoofZone    `json:"roofZones,omitempty"`
}
type sceneGenerationInfo struct {
	WallMethod    string `json:"wallMethod,omitempty"`
	Prompt        string `json:"prompt"`
	TopologyError string `json:"topologyError,omitempty"`
	AnimatedDoors bool   `json:"animatedDoors,omitempty"`
}

type sessionMapDocument struct {
	Generation *sceneGenerationInfo      `json:"generation,omitempty"`
	ID         string                    `json:"id"`
	Title      string                    `json:"title"`
	Revision   int                       `json:"revision"`
	Levels     []sessionMapLevelDocument `json:"levels"`
}

func validateSessionMap(v sessionMapDocument, c foundryConnection) error {
	if v.Generation != nil && (len([]rune(v.Generation.Prompt)) > 4000 || len([]rune(v.Generation.TopologyError)) > 2000) {
		return fmt.Errorf("Некорректные параметры генерации сцены.")
	}
	if strings.TrimSpace(v.Title) == "" || len([]rune(v.Title)) > 200 || len(v.Levels) < 1 || len(v.Levels) > 30 {
		return fmt.Errorf("Нужно название и от 1 до 30 этажей.")
	}
	ids := map[string]bool{}
	for _, l := range v.Levels {
		if err := validateVideo(l.Video); err != nil {
			return err
		}
		if l.Video != nil && (l.Creative != "" || l.ImageURL != "") {
			return fmt.Errorf("Видеофон хранится отдельно от изображения и рисунка")
		}
		if l.ID == "" || len(l.ID) > 128 || ids[l.ID] || (l.Video == nil && !foundryOwnedURL(l.ImageURL, c)) || l.RoofURL != "" && !foundryOwnedURL(l.RoofURL, c) || l.Width < 1 || l.Width > 32000 || l.Height < 1 || l.Height > 32000 || len(l.Walls) > 10000 || len(l.EditorWalls) > 10000 || len(l.RoofZones) > 100 {
			return fmt.Errorf("Некорректный этаж или фон не загружен в эту кампанию.")
		}
		if l.Creative != "" {
			if err := validateCreative(l.Creative); err != nil {
				return err
			}
			var drawing creativeScene
			if json.Unmarshal([]byte(l.Creative), &drawing) != nil {
				return fmt.Errorf("Некорректный рисунок сцены.")
			}
			width, height := creativeDimensions(drawing)
			if width != l.Width || height != l.Height {
				return fmt.Errorf("Размер рисунка не совпадает с фоном сцены.")
			}
			for _, item := range drawing.Items {
				if item.Kind == "image" && !foundryOwnedURL(item.ImageURL, c) {
					return fmt.Errorf("Изображение рисунка не принадлежит кампании.")
				}
			}
		}
		ids[l.ID] = true
		environment := l
		environment.Walls = append(append([]publicDisplayWall{}, l.Walls...), l.EditorWalls...)
		if err := validateSceneEnvironment(environment); err != nil {
			return err
		}
		if math.IsNaN(l.GridDistance) || math.IsInf(l.GridDistance, 0) || l.GridDistance < 0 || l.GridDistance > 10000 {
			return fmt.Errorf("Некорректный масштаб.")
		}
		if l.Grid != nil && (l.Grid.Size <= 0 || l.Grid.Size > 1 || math.IsNaN(l.Grid.Size) || math.IsInf(l.Grid.Size, 0)) {
			return fmt.Errorf("Некорректная сетка.")
		}
		for _, wall := range append(append([]publicDisplayWall{}, l.Walls...), l.EditorWalls...) {
			for _, p := range append([]publicFogPoint{wall.Start, wall.End}, wall.Points...) {
				if math.IsNaN(p.X) || math.IsNaN(p.Y) || math.IsInf(p.X, 0) || math.IsInf(p.Y, 0) || p.X < 0 || p.X > 1 || p.Y < 0 || p.Y > 1 {
					return fmt.Errorf("Координаты стен должны быть нормализованы.")
				}
			}
		}
		for _, zone := range l.RoofZones {
			if len(zone.Points) < 3 || len(zone.Points) > 1000 || len(zone.Openings) > 100 {
				return fmt.Errorf("Некорректная зона крыши.")
			}
			points := append([]publicFogPoint{}, zone.Points...)
			for _, opening := range zone.Openings {
				if len(opening) > 1000 {
					return fmt.Errorf("Некорректный проём.")
				}
				points = append(points, opening...)
			}
			for _, p := range points {
				if math.IsNaN(p.X) || math.IsNaN(p.Y) || math.IsInf(p.X, 0) || math.IsInf(p.Y, 0) || p.X < 0 || p.X > 1 || p.Y < 0 || p.Y > 1 {
					return fmt.Errorf("Координаты крыши должны быть нормализованы.")
				}
			}
		}
	}
	return nil
}
func (srv *server) handleSessionMaps(w http.ResponseWriter, r *http.Request, u authUser, c campaignData, parts []string) {
	if r.Method == http.MethodGet {
		if len(parts) == 3 {
			for _, v := range c.SessionMaps {
				if v.ID == parts[2] {
					writeJSON(w, 200, v)
					return
				}
			}
			writeError(w, 404, "not_found", "Карта не найдена.")
			return
		}
		writeJSON(w, 200, c.SessionMaps)
		return
	}
	if r.Method != http.MethodPost && r.Method != http.MethodPut && r.Method != http.MethodDelete {
		writeError(w, 405, "method_not_allowed", "Допустимы GET, POST, PUT и DELETE.")
		return
	}
	if len(parts) == 2 && r.Method != http.MethodPost || len(parts) == 3 && r.Method == http.MethodPost {
		writeError(w, 405, "method_not_allowed", "Неверный путь команды карты.")
		return
	}
	var input sessionMapDocument
	if r.Method != http.MethodDelete {
		if !foundryRead(w, r, &input) {
			return
		}
		if err := validateSessionMap(input, foundryConnection{OwnerID: u.ID, CampaignID: c.ID}); err != nil {
			writeError(w, 400, "invalid_map", err.Error())
			return
		}
	}
	s := srv.store
	s.mu.Lock()
	defer s.mu.Unlock()
	for ci := range s.data.Campaigns {
		current := &s.data.Campaigns[ci]
		if current.ID != c.ID || current.OwnerID != u.ID {
			continue
		}
		index := -1
		if len(parts) == 3 {
			for i, v := range current.SessionMaps {
				if v.ID == parts[2] {
					index = i
				}
			}
			if index < 0 {
				writeError(w, 404, "not_found", "Карта не найдена.")
				return
			}
		}
		if index >= 0 && r.Method == http.MethodPut && input.Revision != current.SessionMaps[index].Revision {
			writeError(w, 409, "map_conflict", "Карта изменена. Откройте актуальную версию.")
			return
		}
		old, e := cloneStorageState(s.data)
		if e != nil {
			writeError(w, 500, "save_failed", "Ошибка сохранения.")
			return
		}
		if r.Method == http.MethodDelete {
			current.SessionMaps = append(current.SessionMaps[:index], current.SessionMaps[index+1:]...)
		} else if index >= 0 {
			input.ID = current.SessionMaps[index].ID
			input.Revision++
			current.SessionMaps[index] = input
		} else {
			if len(current.SessionMaps) >= 200 {
				writeError(w, 400, "map_limit", "Не более 200 карт сессий.")
				return
			}
			input.ID = newID("smap")
			input.Revision = 1
			current.SessionMaps = append(current.SessionMaps, input)
		}
		current.Revision++
		if s.saveMutationLocked(old) != nil {
			writeError(w, 500, "save_failed", "Карта не сохранена.")
			return
		}
		writeJSON(w, 200, input)
		return
	}
	writeError(w, 404, "not_found", "Кампания не найдена.")
}
