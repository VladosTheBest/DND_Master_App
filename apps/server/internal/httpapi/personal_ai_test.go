package httpapi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"

	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

type personalRoundTripFunc func(*http.Request) (*http.Response, error)

func (f personalRoundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func personalTestResponse(r *http.Request, status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(body)), Request: r}
}
func TestPersonalAIEncryptionAndEndpointSafety(t *testing.T) {
	t.Setenv("SHADOW_EDGE_AI_CREDENTIAL_KEY", base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32)))
	c, err := normalizePersonalAI(personalAIInput{Mode: "personal", Provider: "anthropic", Model: "unit-model"})
	if err != nil {
		t.Fatal(err)
	}
	encrypted, err := encryptPersonalKey("owner-a", c, "test-key-private")
	if err != nil || strings.Contains(encrypted, "test-key-private") {
		t.Fatal("encryption")
	}
	c.Ciphertext = encrypted
	value, err := decryptPersonalKey("owner-a", c)
	if err != nil || value != "test-key-private" {
		t.Fatal("decrypt")
	}
	if _, err = decryptPersonalKey("owner-b", c); err == nil {
		t.Fatal("cross-owner ciphertext accepted")
	}
	c.BaseURL = "https://other.example/v1"
	if _, err = decryptPersonalKey("owner-a", c); err == nil {
		t.Fatal("cross-endpoint ciphertext accepted")
	}
	for _, raw := range []string{"http://api.example.com/v1", "https://127.0.0.1/v1", "https://169.254.169.254/v1", "https://[::1]/v1", "https://host.internal/v1", "https://name:secret@api.example.com/v1", "https://api.example.com/v1?key=secret"} {
		if _, err = normalizePersonalAI(personalAIInput{Mode: "personal", Provider: "custom", BaseURL: raw}); err == nil {
			t.Fatal("unsafe endpoint", raw)
		}
	}
	for _, ip := range []string{"127.0.0.1", "10.1.2.3", "169.254.169.254", "100.64.0.1", "::ffff:127.0.0.1", "fc00::1", "64:ff9b::a00:1", "2002:7f00:1::"} {
		if publicAIAddress(netip.MustParseAddr(ip)) {
			t.Fatal("private address", ip)
		}
	}
}
func TestPersonalAIAdaptersAndSecretRedaction(t *testing.T) {
	for _, provider := range []string{"anthropic", "google", "xai", "deepseek", "custom", "openai"} {
		t.Run(provider, func(t *testing.T) {
			transport := personalAITransport{provider: provider, base: personalRoundTripFunc(func(r *http.Request) (*http.Response, error) {
				if r.Header.Get("Authorization") != "Bearer test-key-private" {
					t.Fatal("lost credentials")
				}
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				if provider == "anthropic" {
					if !strings.HasSuffix(r.URL.Path, "/messages") || body["max_tokens"] == nil || r.Header.Get("anthropic-version") == "" {
						t.Fatal("native Claude format")
					}
					return personalTestResponse(r, 200, `{"content":[{"type":"text","text":"{\"answer\":\"ok\"}"}]}`), nil
				}
				if body["response_format"].(map[string]any)["type"] != "json_object" {
					t.Fatal("compatibility format")
				}
				return personalTestResponse(r, 200, `{"choices":[{"message":{"content":"{\"answer\":\"ok\"}"}}]}`), nil
			})}
			request, _ := http.NewRequest("POST", "https://api.example.com/v1/chat/completions", strings.NewReader(`{"model":"test","messages":[{"role":"system","content":"system"},{"role":"user","content":"prompt"}],"response_format":{"type":"json_schema","json_schema":{"schema":{"type":"object"}}}}`))
			request.Header.Set("Authorization", "Bearer test-key-private")
			response, err := transport.RoundTrip(request)
			if err != nil {
				t.Fatal(err)
			}
			raw, _ := io.ReadAll(response.Body)
			if !strings.Contains(string(raw), "answer") {
				t.Fatal(string(raw))
			}
		})
	}
	transport := personalAITransport{base: personalRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		return personalTestResponse(r, 401, `{"error":{"message":"upstream leaked test-key-private"}}`), nil
	})}
	request, _ := http.NewRequest("GET", "https://api.example.com/models", nil)
	response, _ := transport.RoundTrip(request)
	raw, _ := io.ReadAll(response.Body)
	if strings.Contains(string(raw), "test-key-private") || strings.Contains(string(raw), "upstream") {
		t.Fatal("upstream secret leak")
	}
}
func TestPersonalAIHTTPPersistenceAndOwnerIsolation(t *testing.T) {
	t.Setenv("SHADOW_EDGE_AI_CREDENTIAL_KEY", base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{9}, 32)))
	previous := personalAIBaseTransport
	defer func() { personalAIBaseTransport = previous }()
	var mu sync.Mutex
	inferences := 0
	personalAIBaseTransport = personalRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method == "GET" {
			return personalTestResponse(r, 200, `{"data":[{"id":"unit-a"},{"id":"unit-b"}]}`), nil
		}
		mu.Lock()
		inferences++
		mu.Unlock()
		var input map[string]any
		_ = json.NewDecoder(r.Body).Decode(&input)
		key := r.Header.Get("Authorization")
		model := input["model"].(string)
		if !strings.HasSuffix(key, model) {
			t.Error("account/model crossed")
		}
		return personalTestResponse(r, 200, `{"choices":[{"message":{"content":"{\"kind\":\"location\",\"title\":\"Test place\",\"summary\":\"Safe\",\"content\":\"Synthetic\"}"}}]}`), nil
	})
	root := t.TempDir()
	file := filepath.Join(root, "store.json")
	handler, err := NewServer(Options{DataFile: file, UploadDir: filepath.Join(root, "uploads"), RequireSubscription: true})
	if err != nil {
		t.Fatal(err)
	}
	owner := registerAccountTestUser(t, handler, "personal-owner")
	other := registerAccountTestUser(t, handler, "personal-other")
	if personalAIRequest(t, handler, "GET", "/api/account/ai", "", nil).Code != 401 {
		t.Fatal("anonymous settings")
	}
	for i, cookies := range [][]*http.Cookie{owner, other} {
		model := []string{"unit-a", "unit-b"}[i]
		body := `{"mode":"personal","provider":"deepseek","model":"` + model + `","key":"test-key-` + model + `","expectedRevision":0}`
		check := personalAIRequest(t, handler, "POST", "/api/account/ai/check", body, cookies)
		if check.Code != 200 {
			t.Fatal(check.Code, check.Body.String())
		}
		mu.Lock()
		count := inferences
		mu.Unlock()
		if count != 0 {
			t.Fatal("check spent inference")
		}
		saved := personalAIRequest(t, handler, "POST", "/api/account/ai", body, cookies)
		if saved.Code != 200 || strings.Contains(saved.Body.String(), "test-key") {
			t.Fatal("save contract", saved.Code)
		}
		if personalAIRequest(t, handler, "POST", "/api/account/ai", body, cookies).Code != 409 {
			t.Fatal("stale config accepted")
		}
	}
	disk, _ := os.ReadFile(file)
	if bytes.Contains(disk, []byte("test-key-unit")) || !bytes.Contains(disk, []byte("ciphertext")) {
		t.Fatal("plaintext persisted")
	}
	var state storageState
	if json.Unmarshal(disk, &state) != nil || state.Users[0].AIConnection == nil {
		t.Fatal("durable settings missing")
	}
	for _, cookies := range [][]*http.Cookie{owner, other} {
		campaign := decodeAccountTestData[campaignData](t, personalAIRequest(t, handler, "POST", "/api/campaigns", `{"title":"Personal AI test"}`, cookies))
		generated := personalAIRequest(t, handler, "POST", "/api/campaigns/"+campaign.ID+"/ai/drafts", `{"kind":"location","prompt":"Create a synthetic place"}`, cookies)
		if generated.Code != 200 || !strings.Contains(generated.Body.String(), "Test place") {
			t.Fatal("personal generation", generated.Code, generated.Body.String())
		}
	}
	mu.Lock()
	count := inferences
	mu.Unlock()
	if count != 2 {
		t.Fatal("wrong inference count", count)
	}
	removed := personalAIRequest(t, handler, "DELETE", "/api/account/ai", `{"expectedRevision":1}`, owner)
	if removed.Code != 200 {
		t.Fatal(removed.Code)
	}
	disk, _ = os.ReadFile(file)
	var cleared storageState
	_ = json.Unmarshal(disk, &cleared)
	for _, u := range cleared.Users {
		if u.Username == "personal-owner" && u.AIConnection.Ciphertext != "" {
			t.Fatal("key retained after disconnect")
		}
	}

}

func personalAIRequest(t *testing.T, h http.Handler, method, path, body string, cookies []*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Origin", "http://example.com")
	r.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
