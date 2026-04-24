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

func scaffoldWorldEventContent(eventType string, locationLabel string, prompt string) (string, string, string, []string, []worldEventDialogueBranch) {
	locationText := firstNonEmpty(locationLabel, "этой локации")
	lowerPrompt := strings.ToLower(prompt)

	if eventType == "funny" && containsAny(lowerPrompt, "рын", "торгов", "мат", "руг") {
		return "Торговец-сквернослов", "На рынке к партии липнет торговец, который продаёт ерунду и ругается так изобретательно, что вокруг уже собираются зеваки.",
			"Проходя по рынку, герои слышат, как у лотка с дешёвой утварью кто-то орёт на полплощади. Торговец в заляпанном фартуке клянётся, что его товар лучший во всём округе, а любой, кто усомнится, мгновенно станет целью его цветистых оскорблений. Он цепляется именно к партии: у одного просит купить 'нож достойный дворянина', другого обвиняет в лице, которое отпугивает удачу, а третьему обещает скидку, если тот сможет выдержать минуту брани, не моргнув. Толпа вокруг уже ждёт, чем это закончится, а сам торговец, кажется, больше развлекается, чем злится.",
			[]string{"15 зм мелочью в засаленном кошеле", "кинжал с кривой гардой", "2 какашки бабуина в льняном мешочке"}, []worldEventDialogueBranch{
				{
					Title: "Если отвечать ему в том же тоне",
					Lines: []string{
						"\"О, вот это разговор! Хоть кто-то в этом болоте умеет ругаться красиво!\"",
						"\"Купи нож и я бесплатно расскажу, кто сегодня пытался меня обчистить.\"",
					},
					Outcome: "Торговец проникается и сдаёт местного карманника или слух о тайнике.",
				},
				{
					Title: "Если давить авторитетом",
					Lines: []string{
						"\"Ладно-ладно, не смотри так. Я громкий, а не бессмертный.\"",
						"\"Забирайте дрянь со стола и идите с миром, только не бейте витрину.\"",
					},
					Outcome: "Он быстро отдаёт мелкий лут и пытается замять сцену.",
				},
			}
	}

	switch eventType {
	case "combat":
		return "Стычка у повозки", "В " + locationText + " вспыхивает короткая драка из-за повозки с грузом, и партии предлагают решить всё прямо сейчас.",
			"В " + locationText + " на узком проходе застряла нагруженная повозка. Один возчик клянётся, что его только что пытались обчистить, а двое крепких типов уже тянут из кузова ящик и готовы прикрыться толпой. Пока спор только на криках, но рука одного из грабителей уже лежит на рукояти дубинки, а второй высматривает, кто из героев выглядит самым опасным. Драка может вспыхнуть из-за одного резкого слова.",
			[]string{"12 зм из пояса одного из налётчиков", "дубинка с латунной вставкой", "ящик с дешёвыми специями"}, []worldEventDialogueBranch{
				{
					Title: "Если влезть словами",
					Lines: []string{
						"\"Это не ваше дело, путники. Идите мимо, пока вежливо.\"",
						"\"Хочешь быть героем — плати за товар сам.\"",
					},
					Outcome: "Есть шанс сбить накал и вытащить признание, кто первый полез в кузов.",
				},
				{
					Title: "Если схватиться за оружие",
					Lines: []string{
						"\"Ну всё, режь их, пока не подняли стражу!\"",
					},
					Outcome: "Грабители атакуют первыми, но один попытается сбежать с ящиком.",
				},
			}
	case "heist":
		return "Крик про украденный кошель", "Кто-то в " + locationText + " устроил маленькое ограбление и пытается раствориться в толпе, пока свидетели валят вину друг на друга.",
			"В " + locationText + " сквозь гул голосов прорывается отчаянный крик о краже. Молодой паренёк уверяет, что он просто бежал за настоящим вором, а толстый ювелир держит его за ворот и требует немедленно обыскать. Настоящий интерес в том, что украденный кошель уже переложен в корзину нищенки неподалёку, и вся сцена сейчас держится на том, кто первым это заметит.",
			[]string{"кошель с 15 зм и 8 см", "серебряная булавка", "маленький складной нож"}, []worldEventDialogueBranch{
				{
					Title: "Если поверить парнишке",
					Lines: []string{
						"\"Я не крал, клянусь! Он сунул это не мне, а в ту корзину, пока все смотрели на меня!\"",
					},
					Outcome: "Можно быстро найти настоящий тайник и прижать сообщницу.",
				},
				{
					Title: "Если слушать ювелира",
					Lines: []string{
						"\"Мне всё равно, кто из них врёт. Верните кошель — и я плачу за помощь.\"",
					},
					Outcome: "Ювелир обещает награду, если вернуть всё без шума и стражи.",
				},
			}
	case "oddity":
		return "Нелепое чудо", "В " + locationText + " происходит маленькая странность, которая легко выглядит как фарс, но может дать зацепку или пользу.",
			"В " + locationText + " по мостовой прыгает жаба в крошечной медной короне и упрямо преследует людей с флягами. За ней, запыхавшись, гонится молодой чародей и уверяет, что это вообще-то важный эксперимент, а не проклятый принц. Жаба на самом деле тянется к браге и в нужный момент может выплюнуть чужое кольцо, которое проглотила утром вместе с приманкой.",
			[]string{"медное колечко с аметистовой крошкой", "фляга дешёвой браги", "серебряный жетон уличного мага"}, []worldEventDialogueBranch{
				{
					Title: "Если помочь чародею",
					Lines: []string{
						"\"Поймайте её аккуратно! Она кусается только по юридическим причинам!\"",
					},
					Outcome: "Чародей отдаст жетон и пару полезных слухов в благодарность.",
				},
			}
	case "danger":
		return "Опасный миг", "В " + locationText + " что-то идёт не так, и партии нужно решать быстро: спасать, гнаться или просто уносить ноги.",
			"В " + locationText + " рвётся крепёж на верхнем настиле, и вниз уже сыплются доски, корзины и чьи-то сапоги. Один рабочий висит на канате и орёт, что внизу остался сын, а хозяин склада одновременно требует спасать товар. Пока все кричат друг на друга, из пролома видно мешок с монетой, который сейчас сорвётся в грязь или в чьи-то чужие руки.",
			[]string{"20 зм в промокшем мешке", "крепкая верёвка", "молоток мастера"}, []worldEventDialogueBranch{
				{
					Title: "Если спасать людей",
					Lines: []string{
						"\"Парень внизу! Сначала парень, потом уже проклятые доски!\"",
					},
					Outcome: "Рабочие запомнят помощь и позже выручат партией слухов или услугой.",
				},
				{
					Title: "Если спасать товар",
					Lines: []string{
						"\"Я плачу втрое, если вытащите сундук первым!\"",
					},
					Outcome: "Быстрые деньги, но дурная репутация среди местных.",
				},
			}
	default:
		return "Случайная сценка", "В " + locationText + " назревает короткая, но цепкая сцена, которая может дать деньги, слухи или неприятности.",
			"В " + locationText + " партия натыкается на небольшую суматоху: спор, обвинение и слишком быструю попытку замять случившееся. Любая выбранная сторона сразу втянет героев глубже, потому что у каждого участника здесь есть мелкая правда, маленькая ложь и собственный расчёт на чужую наивность.",
			[]string{"10 зм", "полезный слух", "небольшой должок от местного жителя"}, []worldEventDialogueBranch{
				{
					Title: "Если говорить спокойно",
					Lines: []string{
						"\"Ладно, чужаки. Раз вы уже влезли, то хотя бы выслушайте обе стороны.\"",
					},
					Outcome: "Можно вскрыть ложь без драки и получить полезную зацепку.",
				},
			}
	}
}
