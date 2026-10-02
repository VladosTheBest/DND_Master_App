package main

import (
	"os"
	"path/filepath"
	"runtime"
)

// Prefer the runtime pinned by this application's package-lock over an unrelated
// global CLI. Windows needs the native executable, not an npm .cmd wrapper.
func resolveCodexCommand(override, mcpScript string) string {
	if override != "" {
		return override
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(mcpScript), "..", "..", ".."))
	candidate := filepath.Join(root, "node_modules", ".bin", "codex")
	if runtime.GOOS == "windows" {
		arch, triple := "x64", "x86_64-pc-windows-msvc"
		if runtime.GOARCH == "arm64" {
			arch, triple = "arm64", "aarch64-pc-windows-msvc"
		}
		candidate = filepath.Join(root, "node_modules", "@openai", "codex-win32-"+arch, "vendor", triple, "bin", "codex.exe")
	}
	if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
		if absolute, err := filepath.Abs(candidate); err == nil {
			return absolute
		}
	}
	return "codex"
}
