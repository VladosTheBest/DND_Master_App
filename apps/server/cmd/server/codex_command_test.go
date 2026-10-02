package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestResolveCodexCommandPrefersBundledRuntimeAndHonorsOverride(t *testing.T) {
	root := t.TempDir()
	script := filepath.Join(root, "packages", "mcp-server", "dist", "index.js")
	if got := resolveCodexCommand("custom-codex", script); got != "custom-codex" {
		t.Fatal(got)
	}
	if got := resolveCodexCommand("", script); got != "codex" {
		t.Fatal(got)
	}
	candidate := filepath.Join(root, "node_modules", ".bin", "codex")
	if runtime.GOOS == "windows" {
		arch, triple := "x64", "x86_64-pc-windows-msvc"
		if runtime.GOARCH == "arm64" {
			arch, triple = "arm64", "aarch64-pc-windows-msvc"
		}
		candidate = filepath.Join(root, "node_modules", "@openai", "codex-win32-"+arch, "vendor", triple, "bin", "codex.exe")
	}
	if err := os.MkdirAll(filepath.Dir(candidate), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(candidate, nil, 0o700); err != nil {
		t.Fatal(err)
	}
	if got := resolveCodexCommand("", script); got != candidate {
		t.Fatalf("got %s; want bundled %s", got, candidate)
	}
}
