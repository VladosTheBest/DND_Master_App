package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"time"
)

var blockedAINetworks = []string{"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4", "::/128", "::1/128", "fc00::/7", "fe80::/10", "ff00::/8", "2001:db8::/32", "64:ff9b::/96", "64:ff9b:1::/48", "2001::/32", "2002::/16"}

func publicAIAddress(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		return false
	}
	for _, raw := range blockedAINetworks {
		if netip.MustParsePrefix(raw).Contains(ip) {
			return false
		}
	}
	return true
}
func publicAIHostname(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") || !strings.Contains(host, ".") {
		return false
	}
	if ip, err := netip.ParseAddr(host); err == nil {
		return publicAIAddress(ip)
	}
	return true
}

var personalAIBaseTransport http.RoundTripper = &http.Transport{Proxy: nil, MaxIdleConns: 20, MaxIdleConnsPerHost: 4, IdleConnTimeout: 60 * time.Second, TLSHandshakeTimeout: 10 * time.Second, ResponseHeaderTimeout: 90 * time.Second, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil || !publicAIHostname(host) {
		return nil, errors.New("private AI endpoint denied")
	}
	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(ips) == 0 {
		return nil, errors.New("AI endpoint unavailable")
	}
	for _, ip := range ips {
		if !publicAIAddress(ip) {
			return nil, errors.New("private AI endpoint denied")
		}
	}
	dialer := net.Dialer{Timeout: 10 * time.Second}
	for _, ip := range ips {
		conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		if dialErr == nil {
			return conn, nil
		}
		if ctx.Err() != nil {
			break
		}
	}
	return nil, errors.New("AI endpoint unavailable")
}}

func personalHTTPClient() *http.Client {
	return &http.Client{Timeout: 90 * time.Second, Transport: personalAIBaseTransport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

type personalAITransport struct {
	base     http.RoundTripper
	provider string
}

func (t personalAITransport) RoundTrip(original *http.Request) (*http.Response, error) {
	request := original.Clone(original.Context())
	request.Header = original.Header.Clone()
	if original.Method == "POST" && strings.HasSuffix(original.URL.Path, "/chat/completions") {
		var body map[string]any
		if json.NewDecoder(io.LimitReader(original.Body, 4<<20)).Decode(&body) != nil {
			return nil, errors.New("AI request unavailable")
		}
		_ = original.Body.Close()
		messages, _ := body["messages"].([]any)
		schema := body["response_format"]
		schemaJSON, _ := json.Marshal(schema)
		instruction := "Return only valid JSON matching this response schema: " + string(schemaJSON)
		if t.provider == "anthropic" {
			system := instruction
			chat := []any{}
			for _, raw := range messages {
				message, _ := raw.(map[string]any)
				if message["role"] == "system" {
					if content, ok := message["content"].(string); ok {
						system += "\n" + content
					}
				} else {
					chat = append(chat, message)
				}
			}
			body = map[string]any{"model": body["model"], "system": system, "messages": chat, "max_tokens": 8192}
			u := *request.URL
			u.Path = strings.TrimSuffix(u.Path, "/chat/completions") + "/messages"
			request.URL = &u
			request.Header.Set("anthropic-version", "2023-06-01")
		} else {
			messages = append([]any{map[string]any{"role": "system", "content": instruction}}, messages...)
			body["messages"] = messages
			body["response_format"] = map[string]any{"type": "json_object"}
		}
		payload, _ := json.Marshal(body)
		request.Body = io.NopCloser(bytes.NewReader(payload))
		request.ContentLength = int64(len(payload))
		request.GetBody = func() (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(payload)), nil }
	}
	response, err := t.base.RoundTrip(request)
	if err != nil {
		return nil, errors.New("Не удалось получить ответ выбранного сервиса AI. Проверьте подключение.")
	}
	if response.StatusCode >= 300 {
		_ = response.Body.Close()
		payload, _ := json.Marshal(map[string]any{"error": map[string]any{"message": personalStatusError(response.StatusCode).Error()}})
		response.Body = io.NopCloser(bytes.NewReader(payload))
		response.ContentLength = int64(len(payload))
		return response, nil
	}
	if t.provider == "anthropic" {
		var result struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		}
		err = json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&result)
		_ = response.Body.Close()
		if err != nil {
			return nil, errors.New("Сервис AI вернул непонятный ответ.")
		}
		text := ""
		for _, block := range result.Content {
			if block.Type == "text" {
				text += block.Text
			}
		}
		payload, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": text}}}})
		response.Body = io.NopCloser(bytes.NewReader(payload))
		response.ContentLength = int64(len(payload))
	}
	return response, nil
}
func (srv *server) generatorFor(owner string) entityGenerator {
	c, personal := srv.personalAI(owner)
	if !personal {
		if c.Mode == "codex" {
			return openAIGenerator{config: generatorConfig{activeProvider: "codex", baseURL: "https://codex.invalid", model: "codex"}, client: &http.Client{Timeout: 90 * time.Second, Transport: codexTextTransport{manager: srv.codex, user: personalAuthUser(srv.store, owner)}}}
		}
		return srv.generator
	}
	key, err := decryptPersonalKey(owner, c)
	if err != nil {
		return unavailablePersonalGenerator{message: err.Error()}
	}
	client := personalHTTPClient()
	client.Transport = personalAITransport{base: personalAIBaseTransport, provider: c.Provider}
	return openAIGenerator{config: generatorConfig{activeProvider: c.Provider, requestedProvider: c.Provider, model: c.Model, baseURL: c.BaseURL, apiToken: key, apiKeyConfigured: true}, client: client}
}

type unavailablePersonalGenerator struct {
	scaffoldGenerator
	message string
}

func (g unavailablePersonalGenerator) Generate(c campaignData, i generateEntityDraftInput) (generateEntityDraftResult, error) {
	return generateEntityDraftResult{}, errors.New(g.message)
}
func (g unavailablePersonalGenerator) GenerateEntityPatch(c campaignData, i generateEntityDraftInput) (generateEntityPatchResult, error) {
	return generateEntityPatchResult{}, errors.New(g.message)
}
func (g unavailablePersonalGenerator) GenerateCampaignBlueprint(i generateCampaignBlueprintInput) (generateCampaignBlueprintResult, error) {
	return generateCampaignBlueprintResult{}, errors.New(g.message)
}
func (g unavailablePersonalGenerator) GenerateWorldEvent(c campaignData, i generateWorldEventInput) (generateWorldEventResult, error) {
	return generateWorldEventResult{}, errors.New(g.message)
}
func (g unavailablePersonalGenerator) GenerateWorldEventPatch(c campaignData, i generateWorldEventInput) (generateWorldEventPatchResult, error) {
	return generateWorldEventPatchResult{}, errors.New(g.message)
}
func (g unavailablePersonalGenerator) FormatPlayerFacingCard(c campaignData, i formatPlayerFacingCardInput) (formatPlayerFacingCardResult, error) {
	return formatPlayerFacingCardResult{}, errors.New(g.message)
}

func (g unavailablePersonalGenerator) requestConstrainedPatch(string, string, string, map[string]any) (json.RawMessage, error) {
	return nil, errors.New(g.message)
}

func personalAuthUser(store *campaignStore, owner string) authUser {
	account, _ := store.getUserByID(owner)
	return authUser{ID: owner, Username: account.Username, AuthVersion: account.AuthVersion}
}
