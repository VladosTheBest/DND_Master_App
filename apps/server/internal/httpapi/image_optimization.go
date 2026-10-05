package httpapi

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var imageOptimizationSlot = make(chan struct{}, 1)

// Only unpublished uploads enter this path. Existing URLs and bucket objects are
// never rewritten; any failure preserves the original file and metadata.
func optimizeUploadedImage(parent context.Context, input, contentType string, size int64) (string, string, int64) {
	if (contentType != "image/png" && contentType != "image/jpeg") || size < 64<<10 || size > 128<<20 {
		return input, contentType, size
	}
	worker := strings.TrimSpace(os.Getenv("SHADOW_EDGE_IMAGE_OPTIMIZER"))
	if worker == "off" {
		return input, contentType, size
	}
	if worker == "" {
		worker = filepath.Join("scripts", "optimize-image.mjs")
	}
	if _, err := os.Stat(worker); err != nil {
		return input, contentType, size
	}
	ctx, cancel := context.WithTimeout(parent, 45*time.Second)
	defer cancel()
	select {
	case imageOptimizationSlot <- struct{}{}:
		defer func() { <-imageOptimizationSlot }()
	case <-ctx.Done():
		return input, contentType, size
	}
	temp, err := os.CreateTemp(filepath.Dir(input), ".optimize-*.webp")
	if err != nil {
		return input, contentType, size
	}
	candidate := temp.Name()
	temp.Close()
	defer os.Remove(candidate)
	node := strings.TrimSpace(os.Getenv("SHADOW_EDGE_NODE_BINARY"))
	if node == "" {
		node = "node"
	}
	if err = exec.CommandContext(ctx, node, worker, input, candidate).Run(); err != nil {
		return input, contentType, size
	}
	info, err := os.Stat(candidate)
	if err != nil || info.Size() <= 0 || info.Size() >= size*95/100 {
		return input, contentType, size
	}
	f, err := os.Open(candidate)
	if err != nil {
		return input, contentType, size
	}
	header := make([]byte, 12)
	_, err = io.ReadFull(f, header)
	f.Close()
	if err != nil || string(header[:4]) != "RIFF" || string(header[8:12]) != "WEBP" {
		return input, contentType, size
	}
	output := strings.TrimSuffix(input, filepath.Ext(input)) + ".webp"
	if _, err = os.Lstat(output); !os.IsNotExist(err) {
		return input, contentType, size
	}
	if err = os.Rename(candidate, output); err != nil {
		return input, contentType, size
	}
	if err = os.Remove(input); err != nil {
		os.Remove(output)
		return input, contentType, size
	}
	return output, "image/webp", info.Size()
}

func optimizedUploadFileName(original, contentType string) string {
	if contentType == "image/webp" && !strings.EqualFold(filepath.Ext(original), ".webp") {
		return strings.TrimSuffix(original, filepath.Ext(original)) + ".webp"
	}
	return original
}
