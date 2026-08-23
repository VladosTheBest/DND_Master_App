package httpapi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestCampaignUploadImportsUniversalVTT(t *testing.T) {
	uploadDir := filepath.Join(t.TempDir(), "uploads")
	handler, err := NewServer(Options{DataFile: filepath.Join(t.TempDir(), "store.json"), UploadDir: uploadDir})
	if err != nil {
		t.Fatal(err)
	}
	cookies := registerAccountTestUser(t, handler, "vtt-gm")
	created := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"VTT campaign","system":"D&D 5e","settingName":"Test","inWorldDate":"1 Hammer","summary":"Test"}`, cookies)
	campaign := decodeAccountTestData[campaignData](t, created)
	var picture bytes.Buffer
	canvas := image.NewRGBA(image.Rect(0, 0, 2, 2))
	canvas.Set(0, 0, color.White)
	if err := jpeg.Encode(&picture, canvas, nil); err != nil {
		t.Fatal(err)
	}
	fixture := map[string]any{
		"format":        .2,
		"resolution":    map[string]any{"map_origin": map[string]any{"x": 0, "y": 0}, "map_size": map[string]any{"x": 10, "y": 8}, "pixels_per_grid": 100},
		"line_of_sight": []any{[]any{map[string]any{"x": 1, "y": 2}, map[string]any{"x": 3, "y": 4}}},
		"portals":       []any{map[string]any{"bounds": []any{map[string]any{"x": 5, "y": 2}, map[string]any{"x": 5, "y": 3}}, "closed": false}},
		"lights":        []any{}, "environment": map[string]any{"baked_lighting": true}, "image": base64.StdEncoding.EncodeToString(picture.Bytes()),
	}
	encoded, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "map.dd2vtt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(encoded); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/uploads", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Host = "localhost:5173"
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	result := decodeAccountTestData[uploadImageResult](t, response)
	if result.VTT == nil || len(result.VTT.Walls) != 2 {
		t.Fatalf("VTT result = %#v", result.VTT)
	}
	if result.VTT.GridSize != .1 || !result.VTT.Walls[1].Disabled {
		t.Fatalf("unexpected imported grid or open portal: %#v", result.VTT)
	}
	if result.VTT.Walls[0].Kind != "wall" || result.VTT.Walls[1].Kind != "door" {
		t.Fatalf("unexpected imported wall kinds: %#v", result.VTT.Walls)
	}
}

func TestDetectUploadedVideoFormats(t *testing.T) {
	tests := []struct {
		name        string
		data        []byte
		contentType string
		extension   string
	}{
		{name: "mp4", data: []byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}, contentType: "video/mp4", extension: ".mp4"},
		{name: "webm", data: []byte{0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81}, contentType: "video/webm", extension: ".webm"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			file, err := os.CreateTemp(t.TempDir(), "upload-*")
			if err != nil {
				t.Fatal(err)
			}
			defer file.Close()
			if _, err := file.Write(test.data); err != nil {
				t.Fatal(err)
			}
			if _, err := file.Seek(0, 0); err != nil {
				t.Fatal(err)
			}
			contentType, extension, err := detectUploadedMedia(file)
			if err != nil || contentType != test.contentType || extension != test.extension {
				t.Fatalf("detectUploadedMedia() = %q, %q, %v", contentType, extension, err)
			}
		})
	}
}

func TestRequiresImageNormalization(t *testing.T) {
	if !requiresImageNormalization(26400, 26400) {
		t.Fatal("expected Dungeon Alchemist-sized image to require normalization")
	}
	if requiresImageNormalization(8192, 7800) {
		t.Fatal("expected browser-safe image not to require normalization")
	}
}

func TestCampaignUploadReturnsReachableUploadURL(t *testing.T) {
	uploadDir := filepath.Join(t.TempDir(), "uploads")
	handler, err := NewServer(Options{
		DataFile:  filepath.Join(t.TempDir(), "store.json"),
		UploadDir: uploadDir,
	})
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}

	cookies := registerAccountTestUser(t, handler, "upload-gm")
	created := accountTestRequest(t, handler, http.MethodPost, "/api/campaigns", `{"title":"Upload campaign","system":"D&D 5e","settingName":"Test","inWorldDate":"1 Hammer","summary":"Test"}`, cookies)
	if created.Code != http.StatusCreated {
		t.Fatalf("create campaign status = %d, body = %s", created.Code, created.Body.String())
	}
	campaign := decodeAccountTestData[campaignData](t, created)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "map.png")
	if err != nil {
		t.Fatalf("CreateFormFile() error = %v", err)
	}
	if _, err := part.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}); err != nil {
		t.Fatalf("write upload fixture: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/campaigns/"+campaign.ID+"/uploads", &body)
	uploadRequest.Host = "localhost:5173"
	uploadRequest.Header.Set("Content-Type", writer.FormDataContentType())
	for _, cookie := range cookies {
		uploadRequest.AddCookie(cookie)
	}
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", uploadResponse.Code, uploadResponse.Body.String())
	}

	result := decodeAccountTestData[uploadImageResult](t, uploadResponse)
	parsedURL, err := url.Parse(result.URL)
	if err != nil {
		t.Fatalf("parse upload URL %q: %v", result.URL, err)
	}
	if parsedURL.Scheme != "http" || parsedURL.Host != "localhost:5173" {
		t.Fatalf("upload URL = %q, want local app origin", result.URL)
	}

	fileResponse := httptest.NewRecorder()
	handler.ServeHTTP(fileResponse, httptest.NewRequest(http.MethodGet, parsedURL.RequestURI(), nil))
	if fileResponse.Code != http.StatusOK {
		t.Fatalf("uploaded file GET status = %d, body = %s", fileResponse.Code, fileResponse.Body.String())
	}
	if got := fileResponse.Header().Get("Content-Type"); got != "image/png" {
		t.Fatalf("uploaded file Content-Type = %q, want image/png", got)
	}
	if !bytes.Equal(fileResponse.Body.Bytes(), []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}) {
		t.Fatal("uploaded file response does not match the saved file")
	}

}
