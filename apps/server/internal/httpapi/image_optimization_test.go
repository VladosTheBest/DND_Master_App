package httpapi

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func enableImageOptimizer(t *testing.T) {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("node", "--input-type=module", "-e", "import('sharp')")
	cmd.Dir = root
	if cmd.Run() != nil {
		t.Skip("node and installed sharp are required for image integration tests")
	}
	t.Setenv("SHADOW_EDGE_IMAGE_OPTIMIZER", filepath.Join(root, "scripts", "optimize-image.mjs"))
}

func uncompressedImageFixture(t *testing.T) []byte {
	t.Helper()
	canvas := image.NewNRGBA(image.Rect(0, 0, 256, 256))
	for y := 0; y < 256; y++ {
		for x := 0; x < 256; x++ {
			canvas.SetNRGBA(x, y, color.NRGBA{uint8(x), uint8(y), 80, 128})
		}
	}
	var buffer bytes.Buffer
	encoder := png.Encoder{CompressionLevel: png.NoCompression}
	if err := encoder.Encode(&buffer, canvas); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestImageOptimizerFallbackAndGeometry(t *testing.T) {
	enableImageOptimizer(t)
	body := uncompressedImageFixture(t)
	input := filepath.Join(t.TempDir(), "image.png")
	if err := os.WriteFile(input, body, 0600); err != nil {
		t.Fatal(err)
	}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	file, mime, size := optimizeUploadedImage(cancelled, input, "image/png", int64(len(body)))
	if file != input || mime != "image/png" || size != int64(len(body)) {
		t.Fatal("cancelled optimization changed upload")
	}
	file, mime, size = optimizeUploadedImage(context.Background(), input, "image/png", int64(len(body)))
	if !strings.HasSuffix(file, ".webp") || mime != "image/webp" || size >= int64(len(body)) {
		t.Fatal("expected smaller WebP")
	}
	if _, err := os.Stat(input); !os.IsNotExist(err) {
		t.Fatal("redundant original retained")
	}
	if info, err := os.Stat(file); err != nil || info.Size() != size {
		t.Fatal("wrong returned size")
	}
	bad := filepath.Join(t.TempDir(), "invalid.png")
	os.WriteFile(bad, bytes.Repeat([]byte{1}, 70000), 0600)
	file, _, size = optimizeUploadedImage(context.Background(), bad, "image/png", 70000)
	if file != bad || size != 70000 {
		t.Fatal("invalid source was replaced")
	}
	if files, _ := filepath.Glob(filepath.Join(filepath.Dir(bad), ".optimize-*")); len(files) != 0 {
		t.Fatal("temporary output leaked")
	}
}

func TestOptimizedCampaignAndProposalUploads(t *testing.T) {
	enableImageOptimizer(t)
	root := t.TempDir()
	handler, err := NewServer(Options{DataFile: filepath.Join(root, "store.json"), UploadDir: filepath.Join(root, "uploads")})
	if err != nil {
		t.Fatal(err)
	}
	cookies := registerAccountTestUser(t, handler, "compression-gm")
	campaign := decodeAccountTestData[campaignData](t, accountTestRequest(t, handler, "POST", "/api/campaigns", `{"title":"Compression","system":"D&D 5e"}`, cookies))
	body := uncompressedImageFixture(t)
	upload := func(endpoint string) *httptest.ResponseRecorder {
		var payload bytes.Buffer
		form := multipart.NewWriter(&payload)
		part, _ := form.CreateFormFile("file", "image.png")
		part.Write(body)
		form.WriteField("field", "art")
		form.Close()
		req := httptest.NewRequest("POST", endpoint, &payload)
		req.Header.Set("Content-Type", form.FormDataContentType())
		for _, cookie := range cookies {
			req.AddCookie(cookie)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != 201 {
			t.Fatalf("upload failed: %d %s", response.Code, response.Body.String())
		}
		return response
	}
	result := decodeAccountTestData[uploadImageResult](t, upload("/api/campaigns/"+campaign.ID+"/uploads"))
	if result.ContentType != "image/webp" || result.FileName != "image.webp" || result.Size >= int64(len(body)) {
		t.Fatal("wrong optimized metadata")
	}
	parsed, _ := url.Parse(result.URL)
	served := accountTestRequest(t, handler, "GET", parsed.Path, "", nil)
	if served.Code != 200 || served.Body.Len() != int(result.Size) || !strings.HasPrefix(served.Header().Get("Content-Type"), "image/webp") {
		t.Fatal("optimized upload unreachable")
	}
	entity := decodeAccountTestData[createEntityResult](t, accountTestRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/entities", `{"kind":"npc","title":"Test","summary":"Test","content":"Test"}`, cookies)).Entity
	proposal := decodeAccountTestData[aiProposal](t, accountTestRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/ai/proposals/entities", `{"mode":"update","kind":"npc","entityId":`+strconvQuote(entity.ID)+`,"patch":{"title":"Portrait"}}`, cookies))
	media := decodeAccountTestData[proposalMediaResult](t, upload("/api/ai/proposals/"+proposal.ID+"/media"))
	if media.Media.ContentType != "image/webp" || !strings.HasSuffix(media.Media.PreviewURL, ".webp") {
		t.Fatal("proposal not optimized")
	}
	if anonymous := accountTestRequest(t, handler, "GET", media.Media.PreviewURL, "", nil); anonymous.Code != http.StatusUnauthorized {
		t.Fatal("private preview exposed")
	}
	preview := accountTestRequest(t, handler, "GET", media.Media.PreviewURL, "", cookies)
	if preview.Code != 200 || int64(preview.Body.Len()) != media.Media.Size {
		t.Fatal("private preview differs")
	}
	applied := decodeAccountTestData[proposalActionResult](t, accountTestRequest(t, handler, "POST", "/api/ai/proposals/"+proposal.ID+"/apply", "", cookies))
	final := accountTestRequest(t, handler, "GET", applied.Proposal.MediaIntents[0].FinalURL, "", nil)
	if final.Code != 200 || !bytes.Equal(final.Body.Bytes(), preview.Body.Bytes()) {
		t.Fatal("promotion changed optimized bytes")
	}
}
