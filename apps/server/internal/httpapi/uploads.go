package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const maxImageUploadSize = 300 << 20
const maxBrowserImagePixels = 64_000_000
const maxBrowserImageDimension = 8192

var uploadImageExtensions = map[string]string{
	"image/gif":  ".gif",
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"video/mp4":  ".mp4",
	"video/webm": ".webm",
}

type uploadImageResult struct {
	URL         string           `json:"url"`
	FileName    string           `json:"fileName"`
	ContentType string           `json:"contentType"`
	Size        int64            `json:"size"`
	DeepZoom    *deepZoomSource  `json:"deepZoom,omitempty"`
	VTT         *vttImportResult `json:"vtt,omitempty"`
}

type vttPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}
type vttWall struct {
	ID       string     `json:"id"`
	Start    vttPoint   `json:"start"`
	End      vttPoint   `json:"end"`
	Points   []vttPoint `json:"points,omitempty"`
	Disabled bool       `json:"disabled,omitempty"`
}
type vttImportResult struct {
	Walls         []vttWall `json:"walls"`
	GridSize      float64   `json:"gridSize"`
	MapWidth      int       `json:"mapWidth"`
	MapHeight     int       `json:"mapHeight"`
	PortalCount   int       `json:"portalCount"`
	LightCount    int       `json:"lightCount"`
	BakedLighting bool      `json:"bakedLighting"`
}
type universalVTTFile struct {
	Format     float64 `json:"format"`
	Resolution struct {
		MapOrigin     vttPoint `json:"map_origin"`
		MapSize       vttPoint `json:"map_size"`
		PixelsPerGrid int      `json:"pixels_per_grid"`
	} `json:"resolution"`
	LineOfSight [][]vttPoint `json:"line_of_sight"`
	Portals     []struct {
		Bounds []vttPoint `json:"bounds"`
		Closed bool       `json:"closed"`
	} `json:"portals"`
	Lights      []json.RawMessage `json:"lights"`
	Environment struct {
		BakedLighting bool `json:"baked_lighting"`
	} `json:"environment"`
	Image string `json:"image"`
}

type deepZoomSource struct {
	DescriptorURL string `json:"descriptorUrl"`
	TileBaseURL   string `json:"tileBaseUrl"`
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	TileSize      int    `json:"tileSize"`
	Format        string `json:"format"`
	MaxLevel      int    `json:"maxLevel"`
}

func newUploadsHandler(uploadDir string) (http.Handler, error) {
	trimmedDir := strings.TrimSpace(uploadDir)
	if trimmedDir == "" {
		return nil, nil
	}

	if err := os.MkdirAll(trimmedDir, 0o755); err != nil {
		return nil, fmt.Errorf("prepare upload directory: %w", err)
	}

	fileServer := http.StripPrefix("/uploads/", http.FileServer(http.Dir(trimmedDir)))
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			http.NotFound(writer, request)
			return
		}

		cleanPath := path.Clean("/" + strings.TrimPrefix(strings.TrimSpace(request.URL.Path), "/uploads/"))
		if cleanPath == "/" {
			http.NotFound(writer, request)
			return
		}

		diskPath := filepath.Join(trimmedDir, filepath.FromSlash(strings.TrimPrefix(cleanPath, "/")))
		info, err := os.Stat(diskPath)
		if err != nil || info.IsDir() {
			http.NotFound(writer, request)
			return
		}

		fileServer.ServeHTTP(writer, request)
	}), nil
}

func (srv *server) handleCampaignUpload(writer http.ResponseWriter, request *http.Request, userID string, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if strings.TrimSpace(srv.uploadDir) == "" {
		writeError(writer, http.StatusInternalServerError, "uploads_disabled", "Директория загрузок не настроена.")
		return
	}

	if _, err := srv.store.getCampaignForUser(userID, campaignID); err != nil {
		writeError(writer, http.StatusNotFound, "not_found", err.Error())
		return
	}

	request.Body = http.MaxBytesReader(writer, request.Body, maxImageUploadSize)
	if err := request.ParseMultipartForm(maxImageUploadSize); err != nil {
		status := http.StatusBadRequest
		code := "bad_request"
		message := "Не удалось разобрать форму загрузки."
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			code = "file_too_large"
			message = "Файл слишком большой. Загружай карты до 300 МБ."
		}
		writeError(writer, status, code, message)
		return
	}

	file, header, err := request.FormFile("file")
	if err != nil {
		writeError(writer, http.StatusBadRequest, "missing_file", "Выбери изображение или видео перед загрузкой.")
		return
	}
	defer file.Close()
	if strings.EqualFold(filepath.Ext(header.Filename), ".dd2vtt") {
		srv.handleUniversalVTTUpload(writer, request, file, header, userID, campaignID)
		return
	}

	contentType, extension, err := detectUploadedMedia(file)
	if err != nil {
		writeError(writer, http.StatusBadRequest, "unsupported_image", err.Error())
		return
	}

	userSegment := sanitizeUploadPathSegment(userID)
	campaignSegment := sanitizeUploadPathSegment(campaignID)
	campaignDir := filepath.Join(srv.uploadDir, userSegment, campaignSegment)
	if err := os.MkdirAll(campaignDir, 0o755); err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_prepare_failed", "Не удалось подготовить директорию для загрузки.")
		return
	}

	fileName := newID("upload") + extension
	filePath := filepath.Join(campaignDir, fileName)
	target, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_open_failed", "Не удалось сохранить изображение.")
		return
	}

	size, copyErr := io.Copy(target, file)
	closeErr := target.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(filePath)
		writeError(writer, http.StatusInternalServerError, "upload_write_failed", "Не удалось записать изображение на диск.")
		return
	}
	var deepZoom *deepZoomSource
	if contentType == "image/jpeg" {
		stored, err := os.Open(filePath)
		if err != nil {
			writeError(writer, http.StatusInternalServerError, "upload_open_failed", "Не удалось проверить сохранённую карту.")
			return
		}
		config, _, decodeErr := image.DecodeConfig(stored)
		_ = stored.Close()
		if decodeErr != nil {
			writeError(writer, http.StatusBadRequest, "invalid_image", "Не удалось прочитать размеры JPEG-карты.")
			return
		}
		if requiresImageNormalization(config.Width, config.Height) {
			descriptorName := strings.TrimSuffix(fileName, extension) + ".dzi"
			descriptorPath := filepath.Join(campaignDir, descriptorName)
			generated, generateErr := generateDeepZoom(request.Context(), filePath, descriptorPath)
			if generateErr != nil {
				_ = os.Remove(descriptorPath)
				_ = os.RemoveAll(strings.TrimSuffix(descriptorPath, ".dzi") + "_files")
				writeError(writer, http.StatusInternalServerError, "tile_generation_failed", "Большая карта сохранена, но не удалось подготовить тайлы для быстрого просмотра.")
				return
			}
			publicDir := path.Join("/uploads", userSegment, campaignSegment)
			deepZoom = &deepZoomSource{DescriptorURL: path.Join(publicDir, descriptorName), TileBaseURL: path.Join(publicDir, strings.TrimSuffix(descriptorName, ".dzi")+"_files"), Width: generated.Width, Height: generated.Height, TileSize: generated.TileSize, Format: generated.Format, MaxLevel: generated.MaxLevel}
		}
	}

	publicPath := path.Join("/uploads", userSegment, campaignSegment, fileName)
	baseURL := strings.TrimRight(publicBaseURLFromRequest(request), "/")
	if baseURL != "" {
		publicPath = baseURL + publicPath
		if deepZoom != nil {
			deepZoom.DescriptorURL = baseURL + deepZoom.DescriptorURL
			deepZoom.TileBaseURL = baseURL + deepZoom.TileBaseURL
		}
	}

	writeJSON(writer, http.StatusCreated, uploadImageResult{
		URL:         publicPath,
		FileName:    fallbackUploadFileName(header, fileName),
		ContentType: contentType,
		Size:        size,
		DeepZoom:    deepZoom,
	})
}

func (srv *server) handleUniversalVTTUpload(writer http.ResponseWriter, request *http.Request, file multipart.File, header *multipart.FileHeader, userID, campaignID string) {
	var source universalVTTFile
	if err := json.NewDecoder(io.LimitReader(file, maxImageUploadSize)).Decode(&source); err != nil || source.Format <= 0 || source.Resolution.MapSize.X <= 0 || source.Resolution.MapSize.Y <= 0 || source.Image == "" {
		writeError(writer, http.StatusBadRequest, "invalid_vtt", "Не удалось прочитать Universal VTT. Экспортируй карту из Dungeon Alchemist в формате Universal VTT.")
		return
	}
	imageBytes, err := base64.StdEncoding.DecodeString(source.Image)
	if err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_vtt_image", "В Universal VTT повреждено встроенное изображение карты.")
		return
	}
	userSegment, campaignSegment := sanitizeUploadPathSegment(userID), sanitizeUploadPathSegment(campaignID)
	campaignDir := filepath.Join(srv.uploadDir, userSegment, campaignSegment)
	if err := os.MkdirAll(campaignDir, 0o755); err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_prepare_failed", "Не удалось подготовить директорию для загрузки.")
		return
	}
	fileName := newID("upload") + ".jpg"
	filePath := filepath.Join(campaignDir, fileName)
	if err := os.WriteFile(filePath, imageBytes, 0o644); err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_write_failed", "Не удалось извлечь карту из Universal VTT.")
		return
	}
	stored, err := os.Open(filePath)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "upload_open_failed", "Не удалось проверить карту.")
		return
	}
	config, _, decodeErr := image.DecodeConfig(stored)
	_ = stored.Close()
	if decodeErr != nil {
		_ = os.Remove(filePath)
		writeError(writer, http.StatusBadRequest, "invalid_vtt_image", "Встроенное изображение карты имеет неподдерживаемый формат.")
		return
	}
	var deepZoom *deepZoomSource
	if requiresImageNormalization(config.Width, config.Height) {
		descriptorName := strings.TrimSuffix(fileName, ".jpg") + ".dzi"
		descriptorPath := filepath.Join(campaignDir, descriptorName)
		generated, generateErr := generateDeepZoom(request.Context(), filePath, descriptorPath)
		if generateErr != nil {
			_ = os.Remove(filePath)
			writeError(writer, http.StatusInternalServerError, "tile_generation_failed", "Карта извлечена, но не удалось подготовить тайлы.")
			return
		}
		publicDir := path.Join("/uploads", userSegment, campaignSegment)
		deepZoom = &deepZoomSource{DescriptorURL: path.Join(publicDir, descriptorName), TileBaseURL: path.Join(publicDir, strings.TrimSuffix(descriptorName, ".dzi")+"_files"), Width: generated.Width, Height: generated.Height, TileSize: generated.TileSize, Format: generated.Format, MaxLevel: generated.MaxLevel}
	}
	normalize := func(point vttPoint) vttPoint {
		return vttPoint{X: (point.X - source.Resolution.MapOrigin.X) / source.Resolution.MapSize.X, Y: (point.Y - source.Resolution.MapOrigin.Y) / source.Resolution.MapSize.Y}
	}
	walls := make([]vttWall, 0, len(source.LineOfSight)+len(source.Portals))
	for index, line := range source.LineOfSight {
		if len(line) < 2 {
			continue
		}
		points := make([]vttPoint, len(line))
		for i, p := range line {
			points[i] = normalize(p)
		}
		walls = append(walls, vttWall{ID: fmt.Sprintf("vtt-wall-%d", index+1), Start: points[0], End: points[len(points)-1], Points: points})
	}
	for index, portal := range source.Portals {
		if len(portal.Bounds) < 2 {
			continue
		}
		start, end := normalize(portal.Bounds[0]), normalize(portal.Bounds[len(portal.Bounds)-1])
		walls = append(walls, vttWall{ID: fmt.Sprintf("vtt-door-%d", index+1), Start: start, End: end, Points: []vttPoint{start, end}, Disabled: !portal.Closed})
	}
	publicPath := path.Join("/uploads", userSegment, campaignSegment, fileName)
	baseURL := strings.TrimRight(publicBaseURLFromRequest(request), "/")
	if baseURL != "" {
		publicPath = baseURL + publicPath
		if deepZoom != nil {
			deepZoom.DescriptorURL = baseURL + deepZoom.DescriptorURL
			deepZoom.TileBaseURL = baseURL + deepZoom.TileBaseURL
		}
	}
	writeJSON(writer, http.StatusCreated, uploadImageResult{URL: publicPath, FileName: fallbackUploadFileName(header, fileName), ContentType: "image/jpeg", Size: int64(len(imageBytes)), DeepZoom: deepZoom, VTT: &vttImportResult{Walls: walls, GridSize: 1 / source.Resolution.MapSize.X, MapWidth: int(source.Resolution.MapSize.X), MapHeight: int(source.Resolution.MapSize.Y), PortalCount: len(source.Portals), LightCount: len(source.Lights), BakedLighting: source.Environment.BakedLighting}})
}

type deepZoomWorkerResult struct {
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	TileSize int    `json:"tileSize"`
	Format   string `json:"format"`
	MaxLevel int    `json:"maxLevel"`
}

func generateDeepZoom(parent context.Context, input, output string) (*deepZoomWorkerResult, error) {
	ctx, cancel := context.WithTimeout(parent, 10*time.Minute)
	defer cancel()
	worker := strings.TrimSpace(os.Getenv("SHADOW_EDGE_DEEP_ZOOM_WORKER"))
	if worker == "" {
		worker = filepath.Join("scripts", "generate-deep-zoom.mjs")
	}
	node := strings.TrimSpace(os.Getenv("SHADOW_EDGE_NODE_BINARY"))
	if node == "" {
		node = "node"
	}
	cmd := exec.CommandContext(ctx, node, worker, input, output)
	stdout, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("generate deep zoom: %w", err)
	}
	var result deepZoomWorkerResult
	if err := json.Unmarshal(stdout, &result); err != nil {
		return nil, fmt.Errorf("decode deep zoom result: %w", err)
	}
	if result.Width <= 0 || result.Height <= 0 || result.TileSize <= 0 || result.MaxLevel <= 0 || result.Format == "" {
		return nil, fmt.Errorf("invalid deep zoom result")
	}
	return &result, nil
}

func requiresImageNormalization(width, height int) bool {
	return width > maxBrowserImageDimension || height > maxBrowserImageDimension || int64(width)*int64(height) > maxBrowserImagePixels
}

func detectUploadedMedia(file multipart.File) (string, string, error) {
	header := make([]byte, 512)
	readBytes, err := file.Read(header)
	if err != nil && err != io.EOF {
		return "", "", fmt.Errorf("не удалось прочитать файл перед сохранением")
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", "", fmt.Errorf("не удалось подготовить файл к сохранению")
	}

	contentType := http.DetectContentType(header[:readBytes])
	if readBytes >= 12 && string(header[4:8]) == "ftyp" {
		contentType = "video/mp4"
	} else if readBytes >= 4 && header[0] == 0x1a && header[1] == 0x45 && header[2] == 0xdf && header[3] == 0xa3 {
		contentType = "video/webm"
	}
	extension, ok := uploadImageExtensions[contentType]
	if !ok {
		return "", "", fmt.Errorf("поддерживаются PNG, JPG, GIF, WEBP, MP4 и WEBM")
	}

	return contentType, extension, nil
}

func sanitizeUploadPathSegment(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return "campaign"
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	for _, char := range trimmed {
		switch {
		case char >= 'a' && char <= 'z':
			builder.WriteRune(char)
		case char >= '0' && char <= '9':
			builder.WriteRune(char)
		case char == '-' || char == '_':
			builder.WriteRune(char)
		default:
			builder.WriteRune('-')
		}
	}

	sanitized := strings.Trim(builder.String(), "-")
	if sanitized == "" {
		return "campaign"
	}

	return sanitized
}

func fallbackUploadFileName(header *multipart.FileHeader, fallback string) string {
	if header == nil {
		return fallback
	}

	name := strings.TrimSpace(header.Filename)
	if name == "" {
		return fallback
	}

	return filepath.Base(name)
}
