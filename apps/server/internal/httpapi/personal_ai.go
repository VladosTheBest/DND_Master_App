package httpapi

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

type personalAIConnection struct {
	Mode       string `json:"mode"`
	Provider   string `json:"provider,omitempty"`
	BaseURL    string `json:"baseUrl,omitempty"`
	Model      string `json:"model,omitempty"`
	Ciphertext string `json:"ciphertext,omitempty"`
	VerifiedAt string `json:"verifiedAt,omitempty"`
}
type personalAIInput struct {
	Mode             string `json:"mode"`
	Provider         string `json:"provider"`
	BaseURL          string `json:"baseUrl"`
	Model            string `json:"model"`
	Key              string `json:"key"`
	ExpectedRevision *int   `json:"expectedRevision"`
}
type aiProviderPreset struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
	KeyURL  string `json:"keyUrl"`
	Help    string `json:"help"`
}

var aiProviderPresets = []aiProviderPreset{
	{"openai", "OpenAI", "https://api.openai.com/v1", "https://platform.openai.com/api-keys", "Создайте ключ API в аккаунте OpenAI. Подписка ChatGPT и оплата API — разные услуги."},
	{"anthropic", "Claude", "https://api.anthropic.com/v1", "https://platform.claude.com/settings/keys", "Откройте API keys, создайте ключ и скопируйте его. Подписка Claude не заменяет баланс API."},
	{"google", "Gemini · Google", "https://generativelanguage.googleapis.com/v1beta/openai", "https://aistudio.google.com/api-keys", "В Google AI Studio нажмите «Create API key» и скопируйте ключ. Доступность зависит от страны и аккаунта."},
	{"xai", "Grok", "https://api.x.ai/v1", "https://console.x.ai/", "В консоли Grok откройте API Keys и создайте ключ. Проверьте баланс API."},
	{"deepseek", "DeepSeek", "https://api.deepseek.com/v1", "https://platform.deepseek.com/api_keys", "В кабинете DeepSeek откройте API keys, создайте ключ и скопируйте его."},
	{"custom", "Другой совместимый сервис", "", "", "Нужен сервис с OpenAI-совместимым API. Адрес и ключ выдаёт его личный кабинет; обычная ссылка на чат не подходит."},
}

func personalCipher() (cipher.AEAD, error) {
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(os.Getenv("SHADOW_EDGE_AI_CREDENTIAL_KEY")))
	if err != nil || len(key) != 32 {
		return nil, errors.New("Сохранение ключей пока не настроено администратором.")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
func aiAAD(owner string, c personalAIConnection) []byte {
	return []byte(owner + "\n" + c.Provider + "\n" + c.BaseURL)
}
func encryptPersonalKey(owner string, c personalAIConnection, key string) (string, error) {
	aead, err := personalCipher()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(aead.Seal(nonce, nonce, []byte(key), aiAAD(owner, c))), nil
}
func decryptPersonalKey(owner string, c personalAIConnection) (string, error) {
	aead, err := personalCipher()
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(c.Ciphertext)
	if err != nil || len(raw) < aead.NonceSize() {
		return "", errors.New("Ключ недоступен. Подключите сервис заново.")
	}
	plain, err := aead.Open(nil, raw[:aead.NonceSize()], raw[aead.NonceSize():], aiAAD(owner, c))
	if err != nil {
		return "", errors.New("Ключ недоступен. Подключите сервис заново.")
	}
	return string(plain), nil
}
func normalizePersonalAI(input personalAIInput) (personalAIConnection, error) {
	c := personalAIConnection{Mode: input.Mode, Provider: input.Provider, Model: strings.TrimSpace(input.Model)}
	if c.Mode == "codex" {
		return personalAIConnection{Mode: "codex"}, nil
	}
	if c.Mode != "personal" {
		return c, errors.New("Выберите Codex или свой сервис AI.")
	}
	found := false
	for _, p := range aiProviderPresets {
		if p.ID == c.Provider {
			found = true
			c.BaseURL = p.BaseURL
			break
		}
	}
	if !found {
		return c, errors.New("Выберите сервис из списка.")
	}
	if c.Provider == "custom" {
		c.BaseURL = strings.TrimRight(strings.TrimSpace(input.BaseURL), "/")
	}
	u, err := url.Parse(c.BaseURL)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Port() != "" && u.Port() != "443" || strings.ContainsAny(c.BaseURL, "\\\r\n") {
		return c, errors.New("Укажите HTTPS-адрес API, например https://api.example.com/v1.")
	}
	if !publicAIHostname(u.Hostname()) {
		return c, errors.New("Для подключения нужен публичный адрес API.")
	}
	if len(c.Model) > 160 || strings.ContainsAny(c.Model, "\r\n\x00") {
		return c, errors.New("Некорректное имя модели.")
	}
	return c, nil
}
func (srv *server) personalAI(owner string) (personalAIConnection, bool) {
	account, ok := srv.store.getUserByID(owner)
	if !ok || account.AIConnection == nil {
		return personalAIConnection{}, false
	}
	return *account.AIConnection, account.AIConnection.Mode == "personal"
}
func (srv *server) usesPersonalAI(owner string) bool { _, ok := srv.personalAI(owner); return ok }
func (srv *server) handlePersonalAI(w http.ResponseWriter, r *http.Request) {
	user, ok := srv.requireAuthUser(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	account, ok := srv.store.getUserByID(user.ID)
	if !ok {
		writeError(w, 401, "auth_required", "Войдите снова.")
		return
	}
	if r.Method == http.MethodGet {
		safe := personalAIConnection{Mode: "server"}
		if account.AIConnection != nil {
			safe = *account.AIConnection
		}
		safe.Ciphertext = ""
		_, err := personalCipher()
		writeJSON(w, 200, map[string]any{"connection": safe, "hasKey": account.AIConnection != nil && account.AIConnection.Ciphertext != "", "revision": account.AIConnectionRevision, "providers": aiProviderPresets, "keyStorageAvailable": err == nil, "capabilities": srv.aiCapabilities(r.Context(), user, account), "billing": "Личный API оплачивается в аккаунте выбранного сервиса. Подписка Shadow Edge не требуется."})
		return
	}
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		writeError(w, 405, "method_not_allowed", "Поддерживаются GET, POST и DELETE.")
		return
	}
	var input personalAIInput
	if !boundedMutationInput(w, r, &input, 16<<10) {
		return
	}
	if input.ExpectedRevision == nil {
		writeError(w, 428, "revision_required", "Обновите настройки перед сохранением.")
		return
	}
	if account.AIConnectionRevision != *input.ExpectedRevision {
		writeError(w, 409, "ai_settings_conflict", "Настройки изменены в другом окне. Обновите их.")
		return
	}
	if r.Method == http.MethodDelete {
		input.Mode = "codex"
	}
	settings, err := normalizePersonalAI(input)
	if err != nil {
		writeError(w, 400, "invalid_ai_settings", err.Error())
		return
	}
	if settings.Mode == "codex" && r.Method != http.MethodDelete && account.AIConnection != nil {
		settings = *account.AIConnection
		settings.Mode = "codex"
	}
	if settings.Mode == "personal" {
		key := strings.TrimSpace(input.Key)
		if key == "" && account.AIConnection != nil && account.AIConnection.Provider == settings.Provider && account.AIConnection.BaseURL == settings.BaseURL {
			key, err = decryptPersonalKey(user.ID, *account.AIConnection)
		}
		if err != nil || len(key) < 8 || len(key) > 4096 || strings.ContainsAny(key, "\r\n\x00") {
			writeError(w, 400, "invalid_ai_key", "Вставьте ключ API из кабинета выбранного сервиса.")
			return
		}
		if _, err = personalCipher(); err != nil {
			writeError(w, 503, "key_storage_unavailable", err.Error())
			return
		}
		models, checkErr := personalAIModels(r.Context(), settings, key)
		if checkErr != nil {
			writeError(w, 422, "ai_connection_failed", checkErr.Error())
			return
		}
		if strings.HasSuffix(r.URL.Path, "/check") {
			writeJSON(w, 200, map[string]any{"models": models, "message": "Ключ принят. Выберите модель и сохраните. Проверка не запускала генерацию."})
			return
		}
		if settings.Model == "" {
			writeError(w, 400, "ai_model_required", "Выберите модель.")
			return
		}
		available := false
		for _, model := range models {
			if model == settings.Model {
				available = true
				break
			}
		}
		if !available {
			writeError(w, 400, "ai_model_unavailable", "Этой модели нет в списке доступных. Обновите подключение и выберите другую.")
			return
		}
		settings.Ciphertext, err = encryptPersonalKey(user.ID, settings, key)
		if err != nil {
			writeError(w, 503, "key_storage_unavailable", "Не удалось сохранить ключ.")
			return
		}
		settings.VerifiedAt = time.Now().UTC().Format(time.RFC3339)
	}
	srv.store.mu.Lock()
	defer srv.store.mu.Unlock()
	for index := range srv.store.data.Users {
		u := &srv.store.data.Users[index]
		if u.ID != user.ID {
			continue
		}
		if u.AIConnectionRevision != *input.ExpectedRevision {
			writeError(w, 409, "ai_settings_conflict", "Настройки изменены в другом окне. Обновите их.")
			return
		}
		original, e := cloneStorageState(srv.store.data)
		if e != nil {
			writeError(w, 500, "save_failed", "Настройки не сохранены.")
			return
		}
		u.AIConnection = &settings
		u.AIConnectionRevision++
		if e = srv.store.saveMutationLocked(original); e != nil {
			writeError(w, 500, "save_failed", "Настройки не сохранены.")
			return
		}
		safe := settings
		safe.Ciphertext = ""
		writeJSON(w, 200, map[string]any{"connection": safe, "revision": u.AIConnectionRevision, "hasKey": settings.Ciphertext != ""})
		return
	}
	writeError(w, 404, "not_found", "Аккаунт недоступен.")
}
func personalAIModels(ctx context.Context, c personalAIConnection, key string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/models", nil)
	if err != nil {
		return nil, errors.New("Некорректный адрес API.")
	}
	request.Header.Set("Authorization", "Bearer "+key)
	if c.Provider == "anthropic" {
		request.Header.Set("anthropic-version", "2023-06-01")
	}
	response, err := personalHTTPClient().Do(request)
	if err != nil {
		return nil, errors.New("Не удалось связаться с сервисом. Проверьте адрес и доступность сервиса.")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, personalStatusError(response.StatusCode)
	}
	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&result) != nil {
		return nil, errors.New("Сервис вернул непонятный список моделей. Нужен совместимый API.")
	}
	models := []string{}
	for _, m := range result.Data {
		if m.ID != "" && len(m.ID) <= 160 && len(models) < 300 {
			models = append(models, m.ID)
		}
	}
	sort.Strings(models)
	if len(models) == 0 {
		return nil, errors.New("У ключа нет доступных моделей. Проверьте доступ и баланс в кабинете сервиса.")
	}
	return models, nil
}
func personalStatusError(status int) error {
	switch status {
	case 401, 403:
		return errors.New("Сервис не принял ключ или не дал доступ. Скопируйте новый API-ключ и проверьте права.")
	case 402:
		return errors.New("Недостаточно средств у выбранного сервиса. Проверьте его баланс API.")
	case 429:
		return errors.New("Сервис ограничил число запросов. Подождите и повторите.")
	case 404:
		return errors.New("Не найден адрес API или модель. Проверьте настройки.")
	}
	return fmt.Errorf("Сервис AI временно недоступен (код %d). Попробуйте позже.", status)
}
