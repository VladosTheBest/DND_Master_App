package httpapi

import "strings"

func buildWorldEventDraft(campaign campaignData, input generateWorldEventInput) createWorldEventInput {
	current := input.Current
	locationID := strings.TrimSpace(input.LocationID)
	if locationID == "" && current != nil {
		locationID = strings.TrimSpace(current.LocationID)
	}
	locationLabel := lookupLocationLabel(campaign.Locations, locationID)
	if locationLabel == "" && current != nil {
		locationLabel = strings.TrimSpace(current.LocationLabel)
	}

	eventType := normalizeWorldEventType(input.Type)
	if current != nil && strings.TrimSpace(input.Type) == "" {
		eventType = normalizeWorldEventType(current.Type)
	}

	prompt := strings.TrimSpace(input.Prompt)
	title, summary, sceneText, loot, branches := scaffoldWorldEventContent(eventType, locationLabel, prompt)
	tags := []string{"event", eventType}
	if input.GenerationMode == "gm_event" {
		title, summary, sceneText, loot, branches = scaffoldGMEventContent(eventType, locationLabel, prompt)
		tags = append(tags, "gm-event", "random-event")
	}
	if locationLabel != "" {
		tags = append(tags, strings.ToLower(locationLabel))
	}

	draft := createWorldEventInput{
		Title:            title,
		Date:             strings.TrimSpace(campaign.InWorldDate),
		Summary:          summary,
		Type:             eventType,
		LocationID:       locationID,
		LocationLabel:    locationLabel,
		SceneText:        sceneText,
		DialogueBranches: branches,
		Loot:             loot,
		Tags:             tags,
		Origin:           "ai",
	}

	if current == nil {
		return draft
	}

	if value := strings.TrimSpace(current.Title); value != "" {
		draft.Title = value
	}
	if value := strings.TrimSpace(current.Date); value != "" {
		draft.Date = value
	}
	if value := strings.TrimSpace(current.Summary); value != "" {
		draft.Summary = value
	}
	if value := strings.TrimSpace(current.SceneText); value != "" {
		draft.SceneText = value
	}
	if len(current.DialogueBranches) > 0 {
		draft.DialogueBranches = current.DialogueBranches
	}
	if len(current.Loot) > 0 {
		draft.Loot = current.Loot
	}
	if len(current.Tags) > 0 {
		draft.Tags = current.Tags
	}
	if value := strings.TrimSpace(current.Origin); value != "" {
		draft.Origin = normalizeWorldEventOrigin(value)
	}

	return draft
}

func normalizeWorldEventDraftInput(campaign campaignData, input generateWorldEventInput, draft createWorldEventInput) createWorldEventInput {
	current := input.Current
	locationID := firstNonEmpty(strings.TrimSpace(draft.LocationID), strings.TrimSpace(input.LocationID), func() string {
		if current != nil {
			return strings.TrimSpace(current.LocationID)
		}
		return ""
	}())
	locationLabel := firstNonEmpty(strings.TrimSpace(draft.LocationLabel), lookupLocationLabel(campaign.Locations, locationID), func() string {
		if current != nil {
			return strings.TrimSpace(current.LocationLabel)
		}
		return ""
	}())
	sceneText := firstNonEmpty(strings.TrimSpace(draft.SceneText), strings.TrimSpace(draft.Summary), func() string {
		if current != nil {
			return strings.TrimSpace(current.SceneText)
		}
		return ""
	}())

	return createWorldEventInput{
		Title: firstNonEmpty(strings.TrimSpace(draft.Title), func() string {
			if current != nil {
				return strings.TrimSpace(current.Title)
			}
			return ""
		}(), fallbackWorldEventTitle(firstNonEmpty(draft.Type, input.Type))),
		Date: firstNonEmpty(strings.TrimSpace(draft.Date), func() string {
			if current != nil {
				return strings.TrimSpace(current.Date)
			}
			return ""
		}(), strings.TrimSpace(campaign.InWorldDate)),
		Summary: firstNonEmpty(strings.TrimSpace(draft.Summary), summarizeWorldEventScene(sceneText)),
		Type: normalizeWorldEventType(firstNonEmpty(strings.TrimSpace(draft.Type), strings.TrimSpace(input.Type), func() string {
			if current != nil {
				return strings.TrimSpace(current.Type)
			}
			return ""
		}())),
		LocationID:       locationID,
		LocationLabel:    locationLabel,
		SceneText:        sceneText,
		DialogueBranches: sanitizeWorldEventDialogueBranches(draft.DialogueBranches),
		Loot:             sanitizeStringItems(draft.Loot),
		Tags:             sanitizeTags(draft.Tags),
		Origin:           normalizeWorldEventOrigin(firstNonEmpty(strings.TrimSpace(draft.Origin), "ai")),
	}
}

func extractReadAloudSceneRequest(prompt string) string {
	trimmed := strings.TrimSpace(prompt)
	marker := "Описание мастера:"
	if index := strings.Index(trimmed, marker); index >= 0 {
		afterMarker := strings.TrimSpace(trimmed[index+len(marker):])
		if nextLine := strings.Index(afterMarker, "\n"); nextLine >= 0 {
			afterMarker = strings.TrimSpace(afterMarker[:nextLine])
		}
		if afterMarker != "" {
			return afterMarker
		}
	}
	return trimmed
}

func scaffoldReadAloudSceneContent(locationLabel string, prompt string) (string, string, string, []string, []worldEventDialogueBranch) {
	locationText := firstNonEmpty(strings.TrimSpace(locationLabel), "месте, где сейчас находится партия")
	requestText := firstNonEmpty(extractReadAloudSceneRequest(prompt), "партия замечает странный след обычной жизни, который быстро превращается в сцену для разговора, решения или импровизации")
	title := draftTitle(requestText, "Дым за поворотом")
	summary := "Карточка для зачитки: партия видит живую сцену, получает понятный крючок и может сама решить, вмешиваться ли дальше."
	sceneText := "Вы находитесь в " + locationText + ", когда привычный ритм места внезапно сбивается. " + requestText + ".\n\n" +
		"Сначала это выглядит как мелочь, которую легко пройти мимо: чужие голоса звучат слишком громко, воздух пахнет пылью, гарью и мокрым деревом, а несколько прохожих делают вид, что ничего необычного не происходит. Но чем ближе вы подходите, тем яснее становится: здесь уже случилось что-то неловкое, важное или опасное, и участники сцены отчаянно пытаются решить всё до того, как появятся лишние свидетели.\n\n" +
		"В центре происходящего стоит человек с усталым лицом и сбившимся дыханием. Он говорит быстро, будто оправдывается перед всеми сразу, и постоянно оглядывается на следы недавней суматохи. Из его слов складывается маленькая история: сегодня он хотел провернуть обычное дело, доказать кому-то свою правоту или спасти собственную репутацию, но всё пошло не по плану. Теперь ему нужна помощь, зрители или хотя бы кто-то, кто не станет сразу судить по первому впечатлению.\n\n" +
		"Когда он замечает вас, разговор обрывается. Несколько взглядов одновременно поворачиваются к партии. Кто-то явно надеется, что вы уйдёте мимо, кто-то уже примеряет на вас роль спасителей, а кто-то прячет за спиной вещь, которую не должен был держать. Сцена висит на одном вопросе: вы вмешаетесь сейчас или позволите ей развалиться без вас?"
	return title, summary, sceneText, []string{}, []worldEventDialogueBranch{}
}

func scaffoldWorldEventContent(_ string, locationLabel string, prompt string) (string, string, string, []string, []worldEventDialogueBranch) {
	return scaffoldReadAloudSceneContent(locationLabel, prompt)
}

// Local fallback demonstrates the GM brief contract without pretending to use an AI model.
func scaffoldGMEventContent(eventType, locationLabel, prompt string) (string, string, string, []string, []worldEventDialogueBranch) {
	hooks := map[string]string{
		"funny":  "Сбежавший козёл утащил сумку курьера и устроил погоню среди прохожих",
		"combat": "Два наёмника пытаются отнять у курьера запечатанную сумку",
		"heist":  "В толпе кто-то подменил сумку курьера похожей пустой сумкой",
		"social": "Курьер просит рассудить спор о том, кому принадлежит найденная сумка",
		"oddity": "Из закрытой сумки курьера доносится голос, повторяющий ещё не сказанные слова",
		"danger": "Курьер провалился через прогнивший настил, а его сумка зацепилась над водой",
	}
	idea := extractReadAloudSceneRequest(prompt)
	if idea == "" || idea == "Придумай неожиданную ситуацию самостоятельно." {
		idea = hooks[eventType]
	}
	idea = firstNonEmpty(idea, hooks["social"])
	title := draftTitle(idea, "Сумка курьера")
	summary := idea
	scene := "Что происходит\n" + firstNonEmpty(locationLabel, "На пути партии") + ": " + idea + ". Ситуация ещё не разрешилась; у партии есть время вмешаться или пройти мимо.\n\n" +
		"Скрытая причина\nКурьер доставляет письмо, которое может раскрыть нечестную сделку. Он боится потерять работу и скрывает, кому адресован пакет. За сумкой наблюдает человек, которому выгодно исчезновение письма. Свяжите адресата с подходящим знакомым NPC, не меняя установленный канон.\n\n" +
		"Что заметят игроки\nСумка помечена знаком местного торговца, а курьер всё время смотрит на один и тот же выход. Эти детали видны без проверки и дают понятный повод заговорить с ним.\n\n" +
		"Проверки и подсказки\nВнимательность, СЛ 12: заметить наблюдателя; при неудаче он уйдёт, но оставит след обуви. Проницательность, СЛ 13: понять, что курьер боится работодателя; при неудаче получить только его официальную версию. Подстройте сложность под обстоятельства.\n\n" +
		"Если пройти мимо\nПисьмо попадёт к заинтересованному наблюдателю. Позже партия услышит противоречивый слух о сделке; это возможный крючок, а не обязательный новый квест."
	return title, summary, scene, []string{
			"За помощь курьеру: небольшая плата или услуга доставки; размер определяет мастер.",
			"Если проверить письмо с согласия курьера: имя участника сделки и полезная зацепка.",
			"Если сохранить письмо и расположить к себе адресата: знакомство или доступ к местному торговцу.",
		}, []worldEventDialogueBranch{
			{Title: "Помочь курьеру", Lines: []string{"Дайте партии выбрать способ вмешательства и цену риска."}, Outcome: "При успехе сумка остаётся у курьера; он готов рассказать о доставке."},
			{Title: "Проследить за наблюдателем", Lines: []string{"Он старается уйти через людное место; оставьте возможность разговора вместо боя."}, Outcome: "Партия может выяснить, кто заинтересован в письме, но курьер тем временем уходит."},
			{Title: "Договориться", Lines: []string{"Обе стороны хотят избежать огласки. Спросите, какие гарантии предлагают игроки."}, Outcome: "Компромисс даёт информацию или услугу, но не решает спор о сделке окончательно."},
		}
}
