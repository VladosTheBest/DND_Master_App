package httpapi

import (
	"os"
	"testing"
)

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
