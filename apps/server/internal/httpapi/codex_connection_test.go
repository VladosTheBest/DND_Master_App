package httpapi

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCodexPendingLoginSurvivesPollingAndCanBeCancelled(t *testing.T) {
	t.Setenv("GO_WANT_CODEX_BRIDGE_HELPER", "1")
	store, err := newCampaignStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatal(err)
	}
	account, err := store.createUser("connection-test", "test-password-only")
	if err != nil {
		t.Fatal(err)
	}
	auth, err := newAuthManager(AuthOptions{SessionTTL: time.Hour}, store)
	if err != nil {
		t.Fatal(err)
	}
	manager := newCodexBridgeManager(CodexBridgeOptions{Enabled: true, Command: os.Args[0], Args: []string{"-test.run=TestCodexBridgeHelperProcess"}, HomeRoot: t.TempDir(), MCPCommand: os.Args[0], MCPArgs: []string{"fake-mcp"}, InternalBaseURL: "http://127.0.0.1:8080"}, auth)
	user := authUser{ID: account.ID, Username: account.Username}
	defer manager.stopBridge(user.ID)
	bridge, err := manager.ensureBridge(context.Background(), user)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(bridge.homeDir, "helper-pending-login"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.startDeviceCode(context.Background(), user); err != nil {
		t.Fatal(err)
	}
	if status := manager.status(context.Background(), user); status.State != "connecting" {
		t.Fatalf("poll lost pending login: %+v", status)
	}
	failed := json.RawMessage(`{"loginId":"pending-test","success":false,"error":"Device code expired"}`)
	bridge.handleNotification(codexRPCNotification{Method: "account/login/completed", Params: failed})
	if status := manager.status(context.Background(), user); status.State != "disconnected" || !strings.Contains(status.Message, "expired") {
		t.Fatalf("poll lost login failure: %+v", status)
	}
	if _, err := manager.startDeviceCode(context.Background(), user); err != nil {
		t.Fatal(err)
	}
	if status, err := manager.logout(context.Background(), user); err != nil || status.State != "disconnected" {
		t.Fatalf("cancel: %+v, %v", status, err)
	}
	data, err := os.ReadFile(filepath.Join(bridge.homeDir, "helper-login-cancelled"))
	if err != nil || !strings.Contains(string(data), `"loginId":"pending-test"`) {
		t.Fatalf("device login was not cancelled: %s, %v", data, err)
	}
	if err := os.WriteFile(filepath.Join(bridge.homeDir, "helper-api-key"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if status := manager.status(context.Background(), user); status.State != "error" || !strings.Contains(status.Message, "API") {
		t.Fatalf("API credentials must not appear as a connected subscription: %+v", status)
	}
	if _, err := manager.runPrompt(context.Background(), user, codexPromptInput{Prompt: "test"}); err == nil || !strings.Contains(err.Error(), "ChatGPT") {
		t.Fatalf("subscription request must reject API credentials: %v", err)
	}
}

func TestCodexSubscriptionConfigAndVerificationURL(t *testing.T) {
	if !strings.Contains(buildCodexUserConfig("node", nil, t.TempDir()), `forced_login_method = "chatgpt"`) {
		t.Fatal("subscription bridge must require ChatGPT authentication")
	}
	for _, url := range []string{"https://auth.openai.com:444/device", "https://user@auth.openai.com/device", "http://auth.openai.com/device"} {
		if validateOpenAIDeviceURL(url) == nil {
			t.Fatalf("accepted unexpected URL %s", url)
		}
	}
}
