package httpapi

import (
	"context"
	"time"
)

type aiCapability struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason"`
}

func (srv *server) aiCapabilities(ctx context.Context, user authUser, account userAccount) map[string]aiCapability {
	c, personal := srv.personalAI(user.ID)
	caps := map[string]aiCapability{}
	codexReady := false
	if srv.codex != nil && c.Mode != "personal" {
		status := srv.codex.status(ctx, user)
		codexReady = status.State == "connected" && status.AuthMode == "chatgpt"
	}
	text := aiCapability{Reason: "Выберите Codex или подключите свой AI в настройках аккаунта."}
	images := aiCapability{Reason: "Для карт подключите Codex. Личное API-подключение пока работает только с текстом."}
	analysis := aiCapability{codexReady, "Для полного анализа сессии выберите Codex и подключите ChatGPT."}
	if c.Mode == "codex" {
		text.Available = codexReady
		images.Available = codexReady
		if codexReady {
			text.Reason = "Используются лимиты вашего ChatGPT."
			images.Reason = "Изображения зависят от доступных инструментов и лимитов ChatGPT."
			analysis.Reason = "Анализ использует лимиты вашего ChatGPT."
		}
	}
	if personal {
		_, err := decryptPersonalKey(user.ID, c)
		text.Available = err == nil && c.Model != ""
		text.Reason = "Оплата запросов — в вашем сервисе AI."
		if err != nil {
			text.Reason = "Ключ недоступен. Подключите сервис заново в настройках AI."
		}
	}
	if c.Mode == "" {
		if g, ok := srv.generator.(openAIGenerator); ok {
			ready := !requiresOpenAIKey(g.config.baseURL) || g.config.apiToken != ""
			text.Available = ready && (!srv.requireSubscription || subscriptionActive(account.Subscription, time.Now()))
			images.Available = ready && subscriptionActive(account.Subscription, time.Now())
			text.Reason = "Используется прежний AI-провайдер сайта."
			if !text.Available {
				text.Reason = "Выберите Codex или подключите свой AI в настройках аккаунта."
			}
		}
	}
	caps["text"], caps["chat"], caps["entityDrafts"], caps["images"], caps["sessionAnalysis"] = text, text, text, images, analysis
	return caps
}
