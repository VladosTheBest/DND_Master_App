package httpapi

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const maxImageUploadSize = 10 << 20

var uploadImageExtensions = map[string]string{
	"image/gif":  ".gif",
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type uploadImageResult struct {
	URL         string `json:"url"`
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
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

func (srv *server) handleCampaignUpload(writer http.ResponseWriter, request *http.Request, campaignID string) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is supported")
		return
	}

	if strings.TrimSpace(srv.uploadDir) == "" {
		writeError(writer, http.StatusInternalServerError, "uploads_disabled", "Директория загрузок не настроена.")
		return
	}

	if _, err := srv.store.getCampaign(campaignID); err != nil {
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
			code = "image_too_large"
			message = "Изображение слишком большое. Загружай файлы до 10 МБ."
		}
		writeError(writer, status, code, message)
		return
	}

	file, header, err := request.FormFile("file")
	if err != nil {
		writeError(writer, http.StatusBadRequest, "missing_file", "Выбери изображение перед загрузкой.")
		return
	}
	defer file.Close()

	contentType, extension, err := detectUploadedImage(file)
	if err != nil {
		writeError(writer, http.StatusBadRequest, "unsupported_image", err.Error())
		return
	}

	campaignDir := filepath.Join(srv.uploadDir, sanitizeUploadPathSegment(campaignID))
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

	publicPath := path.Join("/uploads", sanitizeUploadPathSegment(campaignID), fileName)
	baseURL := strings.TrimRight(publicBaseURLFromRequest(request), "/")
	if baseURL != "" {
		publicPath = baseURL + publicPath
	}

	writeJSON(writer, http.StatusCreated, uploadImageResult{
		URL:         publicPath,
		FileName:    fallbackUploadFileName(header, fileName),
		ContentType: contentType,
		Size:        size,
	})
}

func detectUploadedImage(file multipart.File) (string, string, error) {
	header := make([]byte, 512)
	readBytes, err := file.Read(header)
	if err != nil && err != io.EOF {
		return "", "", fmt.Errorf("не удалось прочитать изображение перед сохранением")
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", "", fmt.Errorf("не удалось подготовить изображение к сохранению")
	}

	contentType := http.DetectContentType(header[:readBytes])
	extension, ok := uploadImageExtensions[contentType]
	if !ok {
		return "", "", fmt.Errorf("поддерживаются только PNG, JPG, GIF и WEBP")
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
