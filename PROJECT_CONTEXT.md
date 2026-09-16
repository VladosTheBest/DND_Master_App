# Shadow Edge GM — контекст проекта

Краткий вход для AI-агента. Общая сверка с рабочим кодом — 14 сентября 2026 года, включая модуль персонажей; журнал и AI-анализ сессий дополнительно сверены 15 сентября 2026 года. Это карта реализации, а не план разработки; перед изменением конкретного участка открой указанные исходники. Правила сопровождения: [AGENTS.md](AGENTS.md).

## 1. Назначение и архитектура

Русскоязычный помощник мастера D&D: кампании, локации, игроки, НПС, монстры, квесты, заметки/лор, события, предметы и магазины, подготовка и ведение боя, медиа и экран игроков, анкеты, создание персонажей, AI-предложения с просмотром перед применением.

```text
React/Vite → API-клиент → Go net/http → campaignStore → JSON + резервная копия
                               ├─ каталоги dnd.su / next.dnd.su → отдельные кеши
                               ├─ генератор scaffold / OpenAI-совместимый HTTP
                               ├─ Codex app-server → MCP stdio → тот же HTTP API
                               └─ публичные HTML/JSON по токену + файлы /uploads/
```

| Участок | Где читать и как устроен |
|---|---|
| Запуск сервера | [apps/server/cmd/server/main.go](apps/server/cmd/server/main.go): настройки, `.env.local`, зависимости, HTTP `:8080`. [go.work](go.work) включает `apps/server`; корневой [main.go](main.go) — старый учебный пример, не приложение. |
| Backend | [server.go][server] создаёт менеджеры и `ServeMux`, проверяет origin/сессию/владение; вложенные пути разбираются вручную. Все доменные части находятся в одном Go-пакете `internal/httpapi`, отдельного ORM/SQL-слоя нет. |
| Данные и контракты | [models.go][models] — Go DTO; [shared-types](packages/shared-types/src/index.ts) — TypeScript-контракты; [api-client](packages/api-client/src/index.ts) — HTTP-обёртки. Они поддерживаются вручную. Персонажи имеют отдельные DTO и [characters.api.ts](apps/web/src/features/characters/characters.api.ts). |
| Вход в UI | [main.tsx](apps/web/src/main.tsx) → [CharacterRoutes.tsx](apps/web/src/features/characters/CharacterRoutes.tsx): лениво выбирает мастерскую персонажа или [App.tsx][app]. Основной App остаётся большим владельцем состояния кампании, редакторов, боя, медиа и навигации. |
| Компоновка UI | [app/](apps/web/src/app) — оболочка, sidebar, header, preview, модальные окна; [AppContentRouter.tsx](apps/web/src/app/AppContentRouter.tsx) распределяет страницы, часть экранов передаётся из App как `legacyContent`. React Router/глобального store нет; состояние в hooks. |
| Оформление и демо | [design-tokens](packages/design-tokens), `apps/web/src/app.css`, `styles/fantasy-theme.css` и CSS модулей. [demo-data](packages/demo-data/src/index.ts) — отдельные примеры, не источник рабочих кампаний; сервер создаёт пустую стартовую кампанию через [data.go][data]. |
| Сборка/эксплуатация | [package.json](package.json), [Dockerfile](Dockerfile), [fly.toml](fly.toml), [scripts/](scripts). Старые материалы в [docs/](docs) полезны как история замысла, но фактическое поведение нужно проверять по коду. |
| Локальный Discord-бот Quill | Самостоятельное Windows-приложение в соседнем репозитории [Quill](../Quill/README.md), вне рабочего дерева сайта. Собственный WPF/трей, Node Discord recorder и Python faster-whisper. Связь с сайтом — только ручной импорт общего UTF-8 TXT во вкладку «Сессии»; общий runtime и зависимости отсутствуют. Архитектура и тесты — [контекст Quill](../Quill/PROJECT_CONTEXT.md). |

## 2. Модули и основные потоки

| Область | Поведение и точки входа |
|---|---|
| Кампании и справочники | [App.tsx][app], [campaigns](apps/web/src/features/campaigns), [entities](apps/web/src/features/entities), [entity-actions](apps/web/src/features/entity-actions), [entity-links](apps/web/src/features/entity-links). После входа загружаются собственные кампании и полный выбранный документ; ответы мутаций обычно возвращают обновлённую кампанию для `hydrateCampaign`. `knowledgeEntity.kind`: `location`, `player`, `npc`, `monster`, `quest`, `lore`. Карточка объединяет текст, связи, факты, art/gallery/playlist, stat block, награды, player-facing cards и планы боёв. |
| Квесты, заметки, события | [quests.tsx](apps/web/src/quests.tsx), [notes-events.tsx](apps/web/src/notes-events.tsx), features [quests](apps/web/src/features/quests), [notes](apps/web/src/features/notes), [events](apps/web/src/features/events). Заметки — сущности `lore`; события — отдельный массив с датой, локацией, сценой, ветками диалога, добычей, типом и происхождением. [world_events.go](apps/server/internal/httpapi/world_events.go) нормализует генерируемые сцены. Создание квеста может включать связанный черновик НПС-квестодателя. |
| Поиск и правила | [global-search](apps/web/src/features/global-search) объединяет доступные UI-разделы; серверный `searchCampaign` ищет только сущности кампании по title/subtitle/summary/tags, без событий и полного content. [rules](apps/web/src/features/rules) — локальный поиск с ранжированием RU/EN-названий, алиасов, тегов и текста в `data/srd_5_2_1_rules_ru_200.json`; отдельного `/api/rules` нет. |
| Бестиарий и предметы | [bestiary](apps/web/src/features/bestiary), [items](apps/web/src/features/items), [dndsu_bestiary.go][bestiary], [official_bestiary.go](apps/server/internal/httpapi/official_bestiary.go), [dndsu_items.go][items]. Индексы загружаются лениво из кеша; пустой кеш инициирует сетевую загрузку. Детали подгружаются и кешируются отдельно. Импорт монстра создаёт копию в кампании. Предметы совмещают встроенный [JSON](dnd_items_150_ru_official_basic_rules_2014.json), удалённые каталоги и пользовательские записи в localStorage. |
| Магазины | [ShopsPage.tsx](apps/web/src/features/shops/ShopsPage.tsx): локация, ассортимент, количество, заметки, цена из каталога или ручная цена в GP. Массив `campaign.shops` сохраняется через обновление кампании; самостоятельного CRUD `/shops` нет. Пользовательские карточки предметов остаются браузерными, хотя строки ассортимента сохраняются на сервере. |
| Подготовка и бой | [combat](apps/web/src/features/combat), [prepared-combat](apps/web/src/features/prepared-combat), [combat_routes.go][combat-routes], [combat.go][combat], [encounter_themes.go](apps/server/internal/httpapi/encounter_themes.go), [store.go][store]. Планы хранятся у кампании и у сущностей (`preparedCombats`, совместимость с `preparedCombat`). Старт создаёт/дополняет combat entries по сущностям и ручным участникам. Стороны `player/ally/enemy`; XP по CR, пороги по уровням группы, множитель по числу врагов/размеру группы. Изменения HP/инициативы пересчитывают состояние и текущий ход; переход через конец порядка повышает раунд. |
| Завершение боя | `finishCombat` суммирует XP побеждённых врагов, рассчитывает долю участников, сохраняет `lastCombatSummary` и очищает `activeCombat`. Это отчёт о награде, автоматического повышения уровня листов нет. Бой не увеличивает авторскую revision кампании, чтобы независимые AI-предложения не становились устаревшими. `/combat/generate` создаёт монстров и запускает бой сразу; это не только предпросмотр. |
| Медиа и карта | [media.tsx](apps/web/src/media.tsx), [floating-player.tsx](apps/web/src/floating-player.tsx), [playback.ts](apps/web/src/playback.ts), [SessionMapModal.tsx](apps/web/src/app/SessionMapModal.tsx), [entity-images](apps/web/src/features/entity-images), [uploads.go][uploads]. Плейлисты используют YouTube iframe API либо HTML audio по URL. Карта поддерживает сетку, стены/двери, туман, крышу/маски, токен, видимость и viewport; это специальный экран мастера, не универсальная многопользовательская VTT. |
| Карточки для игроков | [player-facing](apps/web/src/features/player-facing), [player-facing-rich.ts](apps/web/src/player-facing-rich.ts), [player_facing_format.go](apps/server/internal/httpapi/player_facing_format.go). Отдельные карточки с текстом/HTML, совместимость с прежним одиночным полем, очистка и форматирование содержимого. Не путать с общим публичным экраном. |
| Экран игроков | [initiative_share.go][share] содержит Go-менеджер и встроенный HTML/JS; `/display/{token}` и `/initiative/{token}` показывают единый snapshot. Режимы: ожидание, инициатива, результат, изображение. UI опрашивает meta/version и обновляет данные; WebSocket/SSE нет. При активном бое только `sessionMap` может перекрывать инициативу; после боя изображение должно быть новее результата. `publish` сейчас эквивалентен `ensureShare`, а snapshot строится из актуальной кампании. |
| Анкеты | [survey.go][survey], [survey_template.go](apps/server/internal/httpapi/survey_template.go), [master_survey_template.go](apps/server/internal/httpapi/master_survey_template.go). Мастер создаёт именованную ссылку, игрок отправляет пожелания/описание персонажа; каждая принятая отправка добавляет ответ и обновляет время приглашения. Есть honeypot, ограничения длины и интервал 10 минут по token+IP. Мастер читает/удаляет ответы через отдельную HTML-страницу `/master/surveys`. |
| Персонажи | [characters](apps/web/src/features/characters), [characters.go][characters], [character_rules.go](apps/server/internal/httpapi/character_rules.go), [character_choices.go](apps/server/internal/httpapi/character_choices.go). Hash-маршруты `#characters`/`#characters/new` — локальное создание, `#characters/join/{token}` — приглашение кампании, `#characters/sheet/{token}` — сохранённый лист. Приглашение задаёт редакцию 2014/2024/any и уровень 1–20. Сервер независимо валидирует draft, рассчитывает stats, атомарно создаёт лист и связанную сущность `player`. |

**Нюансы персонажей.** Редакция и целевой уровень сохранённого листа неизменяемы; редактирование синхронизирует механику/имя игрока, сохраняя заметки, медиа и связи мастера. Удаление игрока удаляет связанный лист. Токен редактирования выдаётся при создании один раз, хранится как SHA-256, даёт чтение и запись только своего листа; токен приглашения хранится отдельно, допускает отзыв/ротацию. До 256 листов на кампанию, создание не чаще раза в 2 секунды по token+IP, JSON до 64 КиБ со строгими полями. Клиентские `rules.ts`/`rules-data.ts` экспортируются в встроенный Go-каталог `character_catalog.json`; менять правила нужно согласованно. Поддерживаются один класс, выбранные открытые опции и усреднённый рост HP; мультикласс, полноценный учёт экипировки/ресурсов и все опубликованные опции не реализованы. PDF формируется в браузере через jsPDF и локальный DejaVu Sans; детали объёма правил и атрибуции — [SOURCES.md](apps/web/src/features/characters/SOURCES.md).

**Журнал сессий.** [SessionsPage](apps/web/src/features/sessions/SessionsPage.tsx) добавляет пункт «Сессии» выбранной кампании: обзор, хроника, посещённые локации, игроки, активность и полный текст с поиском/подсветкой и страницами по 50 реплик. [SessionJournal](apps/web/src/features/sessions/SessionJournal.tsx) показывает события, важные диалоги, добычу, открытия и встречи: фильтры категории/локации/статуса/текста, отдельная сводка места и переходы к исходным репликам. Статусы различают произошедшее, планы и неопределённость; AI-разметка речи даёт фильтры «В игре», «За столом», «Неясно» в тексте и репликах игрока. Повествование мастера относится к игре; смешанные или неполностью размеченные реплики остаются неясными. Импорт одного или нескольких UTF-8 TXT из Quill в одну сессию до 4 МиБ суммарно: [session-import.ts](apps/web/src/features/sessions/session-import.ts), список частей с перестановкой/удалением, последовательный сдвиг времени без реальных пауз; заголовки и исходное время событий сохранены в преамбуле, HTTP `{title,text}` прежний. Обычные TXT объединяются без меток, смешанный формат отклоняется. Проверка объединения — [test-session-import.mjs](scripts/test-session-import.mjs). Название и защита от дублей; аудио/ZIP не принимаются. [session_transcripts.go](apps/server/internal/httpapi/session_transcripts.go) хранит `importedSessions` отдельно от campaignData в существующем store: лимит текстов 50 МиБ/кампанию, атомарное сохранение/откат, owner-доступ, удаление только импортированной копии. Фильтры не меняют текст и скачиваемый TXT. [session-stats.ts](apps/web/src/features/sessions/session-stats.ts) считает слова, реплики и объединённые интервалы речи каждого человека по полному тексту; выбор мастера исключает его из процентов и хранится локально в браузере. Доля речи не считается мерой интереса/вовлечённости; молчавшие участники из TXT не определяются.

**AI-анализ сессии.** [session_analysis.go](apps/server/internal/httpapi/session_analysis.go) сохраняет отдельный отчёт: summary, события, действия/моменты игроков, зацепки, спорные места, proposal IDs и `journal` версии 1 (локации, карточки, диапазоны типов речи). [session_journal.go](apps/server/internal/httpapi/session_journal.go) проверяет размеры, перечисления, локальные ID локаций, границы источников и порядок/непересечение разметки; истинность выводов остаётся предметом проверки мастером. Источники — включительные номера строк нормализованного TXT от 1, включая заголовок. `POST /api/ai/codex/prompts` принимает `sessionId`: проверка владельца, новый runId/контекст без изображений, результат подтверждается по сохранённому отчёту именно этого запуска с совпадающим digest. MCP читает весь текст страницами по 24 000 Unicode code points через `get_session_transcript` (`numberedText`, `firstLine`, `nextOffset`) и сохраняет отчёт `save_session_analysis`, где `journal` обязателен; HTTP и старые сохранённые отчёты допускают его отсутствие. Для старой сессии новые разделы требуют повторного анализа. Изменения сущностей остаются проверяемыми предложениями, планы и внеигровые обсуждения не должны становиться каноническими фактами. Для сессий более 96 000 Unicode-символов [session_analysis_parts.go](apps/server/internal/httpapi/session_analysis_parts.go) выполняет отдельные read-only extraction turns по 64 000 символов с исходными номерами строк, затем общий анализ по заметкам всех частей (до 48 000 символов суммарно). Части валидируются как JSON с непустыми ограниченными notes, ошибка допускает одну повторную попытку. Кеш до 256 частей в памяти процесса изолирован по владельцу, кампании, сессии/digest, модели и запросу; перезапуск/вытеснение сбрасывают кеш. При несохранённом финальном отчёте выполняется одна повторная попытка с тем же runId и проверкой digest; прежний отчёт остаётся до успешного PUT. Отдельные developer instructions анализа ставят save_session_analysis выше необязательных предложений сущностей; generic-инструкции создания квестов/локаций не используются. Общий тайм-аут анализа 30 минут, каждый turn ограничен тремя обычными тайм-аутами (12 минут по умолчанию); HTTP write deadline продлевается, внешние прокси могут ограничивать время. Сжатие частей может терять мелкие подробности; модель может уточнять их чтением исходника. Старый текст/анализ не стирается при сбое. Проверки: полный Go suite, 32 MCP-теста, web build, [тест статистики и фильтров](scripts/test-session-stats.mjs), изолированный браузерный просмотр синтетического журнала, категорий/локаций/статусов, типов речи и перехода к источнику на второй странице. Тесты разбиения длинного Unicode-текста проверяют полноту, номера строк, кеш, смену модели, owner-доступ и повтор финального сохранения. Реальный AI-анализ пользовательского TXT и шестичасовой игры ещё не проверен. [Описание и API](docs/session-journal.md).

Обзор сессии открывается первым при её выборе. [SessionRecap](apps/web/src/features/sessions/SessionRecap.tsx) выводит короткое резюме и отдельный связный рассказ `analysis.recap`: события по ходу игры, последствия и точка остановки партии, абзацы, ограниченная ширина строки и оценка времени чтения. Ниже расположены переходы к категориям. `recap` — обычный текст до 24 000 символов, хранится в том же анализе; не включается в список метаданных сессий. MCP требует его при новом сохранении, HTTP/старые отчёты допускают отсутствие. Для них UI предлагает дополнить отчёт повторным анализом. Go-тест проверяет сохранение рассказа и отказ без замены при превышении лимита; web/MCP сборки и синтетический браузерный просмотр прошли. Качество реальной генерации этим не подтверждается.

## 3. Хранение и инварианты

- [storageState в models.go][models]: `users`, `authSecret`, `campaigns`, `aiProposals`, `proposalAudits`, `importedSessions`, анкеты/приглашения и листы/приглашения персонажей. Основной файл по умолчанию `data/store.json`; он и `.bak` остаются локальными и исключены из Git. Новая копия репозитория создаёт стартовое хранилище при первом запуске, существующие рабочие данные сохраняются на месте. Пользовательское содержимое не является документацией или тестовыми fixtures; резервное копирование данных выполняется отдельно от Git.
- [campaignStore][store] загружает весь JSON в память; `sync.RWMutex` защищает операции внутри процесса. Сохранение переписывает всё состояние: staging-файл → сохранение валидной резервной копии → атомарная замена primary → best-effort обновление `.bak`. `saveMutationLocked` восстанавливает снимок памяти при ошибке до commit. Платформенная замена — [replace_file_windows.go](apps/server/internal/httpapi/replace_file_windows.go) / [replace_file_unix.go](apps/server/internal/httpapi/replace_file_unix.go).
- Загрузка восстанавливается из `.bak`, нормализует формы/ревизии, ремонтирует кодировку ([encoding_repair.go](apps/server/internal/httpapi/encoding_repair.go)); при отсутствии кампаний создаёт стартовую. Кампании без владельца назначаются первому аккаунту; осиротевшие ссылки анкет перепривязываются только при одной кампании. Это реальные побочные эффекты запуска, не SQL-миграции.
- [data.go][data] пересобирает модули/dashboard и нормализует сущности, события, планы боёв, карточки игроков, магазины. `revision` кампании/сущностей/событий используется для конфликтов AI, а не общей блокировки редактирования.
- Кеши каталогов: `data/dndsu-bestiary.json`, `data/dndsu-items.json` и соседние каталоги `*-details`. Загрузки: `data/uploads/{user}/{campaign}/…`; staging AI — **соседний** `data/uploads.proposals/{owner}/{proposal}/…`, не публичная подпапка uploads. Каталоги, медиа и Codex credentials не входят в основной JSON.
- Перезапуск теряет сессии входа, live snapshot изображений/карты, счётчики опроса и активные процессы. Токен экрана хранится в кампании, но его lookup-таблица заполняется только через `ensureDisplayTokenLocked`: после перезапуска мастер должен повторно запросить share/показ, иначе прежняя публичная ссылка даёт 404. Бой, итог боя, анкеты и листы — в JSON. Браузерное localStorage хранит настройки, черновики персонажей, выбранную кампанию, пользовательские предметы и кеш деталей; эти данные не синхронизируются между устройствами.
- Один writable JSON требует одного серверного процесса: межпроцессных блокировок/общей БД нет. Не редактировать store вручную параллельно серверу и не направлять второй экземпляр на тот же файл. Резервное копирование для эксплуатации должно учитывать и медиа, а не только JSON.
- Quill хранит токен, настройки, аудио и расшифровки отдельно в `%LOCALAPPDATA%/Quill`. Перенос исходников в соседний репозиторий не меняет папку данных. Токен защищён Windows DPAPI, аудио не зашифровано. В Git сайта эти данные и исходники Quill не входят; детали хранения и очистки — [контекст Quill](../Quill/PROJECT_CONTEXT.md).

## 4. Доступ и интеграции

**Discord / Quill.** Внешнее локальное приложение самостоятельно подключается к Discord и по /quill start начинает запись после видимого уведомления без отдельных подтверждений (режим для заранее договорившейся группы); любой участник может остановить запись. Сохраняются отдельные голоса и общий текст. Сайт не управляет ботом и не получает аудио/токен: пользователь импортирует TXT в свою кампанию. Одна активная сессия на одном сервере/канале поддерживается самим Quill. История, команды и ограничения описаны в [README Quill](../Quill/README.md); контракт импорта/анализа сайта — [журнал сессий](docs/session-journal.md).

**Вход.** [auth.go][auth]: регистрация доступна, пароли bcrypt, opaque cookie `shadow_edge_session`, `HttpOnly`, `SameSite=Lax`, `Secure` для HTTPS. Сессии в памяти; основной запуск задаёт TTL 14 дней, `GET /api/auth/session` продлевает сессию с ротацией токена. Настроенные начальные username/password создают legacy-аккаунт, но не отключают регистрацию. Большинство `/api/*` требуют входа; операции кампаний дополнительно проверяют `ownerId`, чужая кампания возвращает 404. Отдельной системы совместного доступа/ролей нет.

**Публичный доступ.** Анкеты, экран и листы открываются по bearer-ссылкам без GM-cookie. `/uploads/*` доступен без входа по известному пути; разделение каталогов по аккаунтам не делает файлы приватными. Staging AI выдаётся только через проверяемый owner-endpoint. Origin проверяется для мутаций auth и защищённых API; отсутствие Origin допускается для небраузерных клиентов. CORS с credentials разрешает порт 5173 только для loopback origin и loopback API host. `OPTIONS` возвращает 204 до авторизации. За обратным прокси схема/публичный адрес используют `X-Forwarded-*`.

**AI — два пути.** [generator.go](apps/server/internal/httpapi/generator.go) выбирает scaffold без ключа/base URL, иначе OpenAI; `openai`/`chatgpt` — HTTP-генератор, прочие имена ведут к local scaffold. [openai_generator.go](apps/server/internal/httpapi/openai_generator.go) вызывает Chat Completions со structured JSON, таймаутом 90 секунд, текущим default `gpt-5.4-mini`. Это значение кода, не рекомендация модели. `/ai/drafts`, генерация событий и форматирование возвращают результат для просмотра; обычные entity/event CRUD сохраняют сразу.

**Предложения.** [proposal_http.go][proposal-http] + [proposals.go][proposals]: создание `pending` с before/after/diff, base revisions, зависимостями операций и media intents → просмотр → `apply` или `reject`; после применения возможен `undo` с проверкой актуальности ревизий. Срок pending — 7 дней, expiration выполняется лениво при обращении. `apply` проверяет владельца, статус, зависимости и ссылки, переносит выбранные staged media и сохраняет audit; конфликты дают 409. Чтение proposal может вызвать сохранение истечения срока. MCP не имеет инструментов apply/undo/reject.

**Встроенный Codex.** [codex_bridge.go](apps/server/internal/httpapi/codex_bridge.go), [codex_bridge_http.go][codex-http]: запускает `codex app-server --strict-config`, device-code вход ChatGPT, отдельный `CODEX_HOME`, ограниченное окружение и краткоживущую сессию для MCP. Bridge доступен указанному username либо закреплённому единственному владельцу; по умолчанию один процесс, idle 30 минут, запрос 4 минуты. Настройки turn: read-only, networkAccess=false, approval never; контент идёт через MCP в review-only proposals. Изображения включаются отдельно и проходят staging/проверку цели. Успех подтверждается реально сохранёнными новыми proposal IDs, а не текстом ответа модели. API-key генерация и ChatGPT-сессия bridge — разные механизмы.

**MCP.** [server.ts](packages/mcp-server/src/server.ts), [client.ts](packages/mcp-server/src/client.ts), [schemas.ts](packages/mcp-server/src/schemas.ts), [config.ts](packages/mcp-server/src/config.ts), [model-output.ts](packages/mcp-server/src/model-output.ts): stdio-процесс Node, не дополнительный HTTP-сервер. Инструменты: `list_campaigns`, `get_campaign`, `get_campaign_outline`, `search_entities`, `get_entity`, `get_session_transcript`, `save_session_analysis`, `propose_campaign`, `propose_entity_create`, `propose_entity_update`, `list_proposals`, `get_proposal`, `stage_proposal_media`, `attach_proposal_media`. События поддерживаются через proposal-kind `event`. Требуются `DND_MASTER_BASE_URL` и cookie; конфиг также допускает `DND_MASTER_BEARER_TOKEN`, но текущий Go auth читает только cookie. Медиа ограничены разрешёнными локальными корнями, проверкой пути/типа/размера; default 10 МиБ, максимум 32 МиБ. Внешний HTTP без TLS требует явной настройки.

**Сеть/медиа.** Каталоги парсят dnd.su/next.dnd.su; их доступность и HTML влияют на импорт. Обычная загрузка принимает GIF/JPEG/PNG/WebP/MP4/WebM и `.dd2vtt`; лимит запроса 512 МиБ, multipart в памяти до 16 МиБ. Большие изображения (>8192 по стороне или >64 млн пикселей) проходят [generate-deep-zoom.mjs](scripts/generate-deep-zoom.mjs) с Node/sharp; `.dd2vtt` извлекает карту, стены, порталы и метаданные. Публичный адрес берётся из `SHADOW_EDGE_PUBLIC_BASE_URL`, затем запроса; код fallback-туннеля cloudflared/localtunnel сохранён, но обычный запрос с Host не включает туннель автоматически.

## 5. Карта HTTP

Маршруты фактического основного сервера. `{c}` — campaign ID, `{id}` — ID сущности области, `{p}` — proposal ID, `{t}` — непрозрачный публичный токен. **GM** — вход; **owner** — GM плюс владение кампанией/предложением; **token** — публичная ссылка. Ответы API обычно `{data,error,meta}`, ошибки `{error:{code,message}}`; HTML/файлы — исключения. `readJSON` ограничивает общий JSON через 1 МиБ `LimitReader`; у персонажей/медиа отдельные правила. HEAD не подразумевается для всех GET: методы проверяются внутри handlers, а не в регистрации mux.

| Методы | Путь | Доступ | Обработчик → источник |
|---|---|---|---|
| любой, кроме перехваченного OPTIONS | `/healthz` | публичный | `handleHealth` → [server.go][server] |
| GET | `/api/auth/session` | публичный | `handleSession` → [auth.go][auth] |
| POST | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` | публичный | `handleLogin`, `handleRegister`, `handleLogout` → [auth.go][auth] |
| GET, POST | `/api/campaigns` | GM | `handleCampaigns` → [server.go][server] |
| GET, PUT, PATCH | `/api/campaigns/{c}` | owner | `handleCampaignByPath` → [server.go][server] |
| GET, POST | `/api/campaigns/{c}/sessions` | owner | метаданные/краткие итоги; импорт `{title,text}` → [session_transcripts.go](apps/server/internal/httpapi/session_transcripts.go) |
| GET, DELETE | `/api/campaigns/{c}/sessions/{id}` | owner | полный текст/анализ; удаление копии → [session_transcripts.go](apps/server/internal/httpapi/session_transcripts.go) |
| PUT | `/api/campaigns/{c}/sessions/{id}/analysis` | owner | отчёт с проверкой digest, принадлежности proposal IDs и необязательного `journal` → [session_analysis.go](apps/server/internal/httpapi/session_analysis.go), [валидация](apps/server/internal/httpapi/session_journal.go) |
| GET | `/api/campaigns/{c}/search?q=…` | owner | `handleCampaignByPath` → `store.search` → [server.go][server], [data.go][data] |
| POST | `/api/campaigns/{c}/entities` | owner | `handleCampaignByPath` → `store.createEntity` → [server.go][server] |
| PUT, PATCH, DELETE | `/api/campaigns/{c}/entities/{id}` | owner | `handleCampaignByPath` → `store.updateEntity/deleteEntity` → [server.go][server] |
| POST | `/api/campaigns/{c}/events` | owner | `handleCampaignByPath` → `store.createWorldEvent` → [server.go][server] |
| PUT, PATCH, DELETE | `/api/campaigns/{c}/events/{id}` | owner | `handleCampaignByPath` → `store.updateWorldEvent/deleteWorldEvent` → [server.go][server] |
| POST | `/api/campaigns/{c}/events/generate` | owner | `handleCampaignByPath` → `generator.GenerateWorldEvent` → [server.go][server] |
| POST | `/api/campaigns/{c}/uploads` | owner | `handleCampaignUpload` → [uploads.go][uploads] |
| GET | `/api/bestiary`, `/api/bestiary/{id}` | GM | `handleBestiary`, `handleBestiaryByPath` → [server.go][server], [dndsu_bestiary.go][bestiary] |
| POST | `/api/campaigns/{c}/bestiary/{id}/import` | owner | `handleCampaignByPath` → [server.go][server] |
| GET | `/api/items-catalog`, `/api/items-catalog/{id}` | GM | `handleItemCatalog`, `handleItemCatalogByPath` → [server.go][server], [dndsu_items.go][items] |
| PATCH | `/api/campaigns/{c}/combat` | owner | `handleCombatState` → [combat_routes.go][combat-routes] |
| POST | `/api/campaigns/{c}/combat/entries` | owner | `handleCombatEntries` → [combat_routes.go][combat-routes] |
| PATCH | `/api/campaigns/{c}/combat/entries/{id}` | owner | `handleCombatEntry` → [combat_routes.go][combat-routes] |
| POST | `/api/campaigns/{c}/combat/finish`, `/api/campaigns/{c}/combat/generate` | owner | `handleCombatFinish`, `handleCombatGenerate` → [combat_routes.go][combat-routes] |
| POST | `/api/campaigns/{c}/initiative-share`, `/api/campaigns/{c}/initiative-share/publish` | owner | `handleInitiativeShare`, `handleInitiativeSharePublish` → [initiative_share.go][share] |
| POST | `/api/campaigns/{c}/player-display`, `/api/campaigns/{c}/player-display/rotate` | owner | `handlePlayerDisplay`, `handlePlayerDisplayRotate` → [initiative_share.go][share] |
| GET (явной проверки метода нет) | `/initiative/{t}`, `/display/{t}` | token | `handlePublicInitiativePage`, `handlePublicDisplayPage` → [initiative_share.go][share] |
| GET | `/api/initiative/{t}`, `/api/display/{t}` | token | `handlePublicInitiativeAPI`, `handlePublicDisplayAPI` → [initiative_share.go][share] |
| GET | `/api/initiative-meta/{t}`, `/api/display-meta/{t}` | token | `handlePublicInitiativeMeta`, `handlePublicDisplayMeta` → [initiative_share.go][share] |
| POST | `/api/campaigns/{c}/survey-link` | owner | `handleCreateLink` → [survey.go][survey] |
| GET | `/api/campaigns/{c}/survey-responses` | owner | `handleResponses` → [survey.go][survey] |
| DELETE | `/api/campaigns/{c}/survey-responses/{id}` | owner | `handleDeleteResponse` → [survey.go][survey] |
| GET (явной проверки метода нет) | `/survey/{t}` | token | `handlePublicPage` → [survey.go][survey] |
| POST | `/api/survey/{t}` | token | `handlePublicAPI` → [survey.go][survey] |
| GET | `/master/surveys` | GM | `handleMasterSurveyPage` → [server.go][server] |
| GET, POST, DELETE | `/api/campaigns/{c}/character-invite` | owner | `handleOwnerInvite` → [characters.go][characters] |
| GET | `/api/campaigns/{c}/character-sheets` | owner | `handleOwnerSheets` → [characters.go][characters] |
| GET, DELETE | `/api/campaigns/{c}/character-sheets/{id}` | owner | `handleOwnerSheets` → [characters.go][characters] |
| GET, POST | `/api/character-invites/{t}` | token | `handlePublicInvite` → [characters.go][characters] |
| GET, PUT | `/api/character-sheets/{t}` | token | `handlePublicSheet` → [characters.go][characters] |
| POST | `/api/campaigns/{c}/ai/drafts` | owner | `handleCampaignByPath` → `generator.Generate` → [server.go][server] |
| POST | `/api/campaigns/{c}/ai/player-facing/format` | owner | `handleCampaignByPath` → `generator.FormatPlayerFacingCard` → [server.go][server] |
| GET | `/api/ai/proposals` | GM, свои | `handleAIProposals` → [proposal_http.go][proposal-http] |
| POST | `/api/ai/proposals/campaign`, `/api/ai/proposals/entity`, `/api/ai/proposals/event` | GM; для entity/event owner кампании | `handleAIProposals` → [proposal_http.go][proposal-http] |
| GET | `/api/ai/proposals/{p}` | owner | `handleAIProposals` → [proposal_http.go][proposal-http] |
| POST | `/api/ai/proposals/{p}/apply`, `/api/ai/proposals/{p}/reject`, `/api/ai/proposals/{p}/undo` | owner | `handleAIProposals` → [proposal_http.go][proposal-http], [proposals.go][proposals] |
| POST | `/api/ai/proposals/{p}/media` | owner | `handleProposalMediaUpload` → [proposal_http.go][proposal-http] |
| POST | `/api/ai/proposals/{p}/media/attachments` | owner | `handleProposalMediaAttachment` → [proposal_http.go][proposal-http] |
| GET, HEAD | `/api/ai/proposals/{p}/media/{file}` | owner | `handleProposalMediaPreview` → [proposal_http.go][proposal-http] |
| GET | `/api/campaigns/{c}/ai/proposals` | owner | `handleCampaignProposalCollection` → [proposal_http.go][proposal-http] |
| POST | `/api/campaigns/{c}/ai/proposals/entities`, `/api/campaigns/{c}/ai/proposals/events` | owner | `handleCampaignEntityProposal`, `handleCampaignEventProposal` → [proposal_http.go][proposal-http] |
| GET | `/api/ai/codex/status` | GM + правила bridge | `handleCodexStatus` → [codex_bridge_http.go][codex-http] |
| POST | `/api/ai/codex/connect`, `/api/ai/codex/disconnect`, `/api/ai/codex/prompts` | GM + правила bridge | `handleCodexConnect`, `handleCodexDisconnect`, `handleCodexPrompt` → [codex_bridge_http.go][codex-http] |
| GET, HEAD | `/uploads/{path}` | публичный | `newUploadsHandler` → [uploads.go][uploads]; директории не выдаются |
| GET, HEAD | `/` и прочие несерверные пути | публичная оболочка | `newWebAppHandler` → [web_app.go](apps/server/internal/httpapi/web_app.go): файл либо SPA fallback; неизвестный путь с расширением → 404 |
| OPTIONS | любой путь основного сервера | публичный | middleware `NewServer` → [server.go][server], 204 |

Фильтры бестиария: `q`, `challenge`, `type`, `namedNpc=true`, `classic=true`; предметов: `q`, `source`, `category`, `armorType`; предложений: `status`, `campaignId` (у campaign-collection ID берётся из пути). Отдельных GET для entity/event/боевого состояния нет: читать полный документ кампании. Удаления кампании через HTTP нет.

**Внутренний legacy viewer.** `ensurePublicServerLocked` в [initiative_share.go][share] содержит отдельный mux на случайном loopback-порту: healthz, шесть display/initiative page/API/meta маршрутов выше и `GET/HEAD /initiative/assets/victory-blood-overlay.png` → `handlePublicInitiativeBloodOverlay` ([assets](apps/server/internal/httpapi/initiative_share_assets.go)). В основном `NewServer` этот asset отдельно не зарегистрирован; helper отдельного viewer и `handleInitiativeShareLegacy` не являются основным текущим потоком. Не считать наличие функции доказательством доступности маршрута на 8080.

## 6. Запуск и проверки

**Quill запускается отдельно:** ярлык Quill указывает на [Quill.vbs](../Quill/Quill.vbs) в соседнем репозитории. [create-shortcut.ps1](../Quill/create-shortcut.ps1) обновляет путь при перемещении. Node/npm/Python устанавливаются внутри Quill, общий npm workspace и Docker/Fly сайта не используются. Тесты приложения и диагностика запуска описаны в его [README](../Quill/README.md) и [PROJECT_CONTEXT](../Quill/PROJECT_CONTEXT.md).

Команды выполнять из корня репозитория. Требования по конфигурации: Go 1.24.2+, Node 20+ для MCP (Docker использует Node 22), npm workspaces. Основные scripts — [package.json](package.json), [web/package.json](apps/web/package.json), [mcp-server/package.json](packages/mcp-server/package.json).

```sh
npm ci
npm run server                         # Go API, порт 8080
npm run dev                            # отдельный терминал: Vite, порт 5173
npm run build                          # tsc --noEmit + Vite → apps/web/dist
npm run build --workspace @shadow-edge/mcp-server
```

Go отдаёт SPA, если `apps/web/dist/index.html` существует при создании сервера; без него API работает отдельно. [vite.config.ts](apps/web/vite.config.ts) проксирует `/api`, `/healthz`, `/initiative`, `/uploads`; `/survey`, `/display`, `/master/surveys` открывать на backend-origin либо настроенном публичном адресе. `VITE_API_BASE_URL` меняет origin API; по умолчанию same-origin. Внутренний GM-трекер использует `#initiative/{campaignId}` — это не публичный токен.

| Конфигурация | Значение/нюанс |
|---|---|
| Загрузка env | Сначала окружение, затем `.env.local`, затем `apps/server/.env.local`; уже непустые значения не переопределяются. Не копировать содержимое env в отчёты. |
| Сервер/данные | `PORT=8080`, `SHADOW_EDGE_DATA_FILE=data/store.json`, `SHADOW_EDGE_UPLOAD_DIR=data/uploads`, `SHADOW_EDGE_WEB_DIR=apps/web/dist`; пути относительны cwd. |
| Каталоги | `SHADOW_EDGE_BESTIARY_CACHE_FILE=data/dndsu-bestiary.json`, `SHADOW_EDGE_ITEM_CATALOG_CACHE_FILE=data/dndsu-items.json`. |
| Вход/публичные ссылки | `SHADOW_EDGE_AUTH_USERNAME`, `SHADOW_EDGE_AUTH_PASSWORD` — bootstrap; `SHADOW_EDGE_PUBLIC_BASE_URL` — стабильный публичный origin. |
| Генерация | `SHADOW_EDGE_AI_PROVIDER`, `SHADOW_EDGE_AI_MODEL`, `SHADOW_EDGE_AI_BASE_URL`, `SHADOW_EDGE_AI_API_KEY`; fallback переменные `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`. |
| Bridge | `SHADOW_EDGE_CODEX_BRIDGE_ENABLED` default true, `SHADOW_EDGE_CODEX_COMMAND`/`CODEX_COMMAND`, `SHADOW_EDGE_CODEX_HOME_ROOT` default рядом со store в `codex-users`; `SHADOW_EDGE_CODEX_ALLOWED_USERNAME`, `SHADOW_EDGE_CODEX_MAX_USER_PROCESSES=1`, `SHADOW_EDGE_CODEX_IDLE_TIMEOUT_MINUTES=30`. |
| MCP bridge | `SHADOW_EDGE_CODEX_MCP_COMMAND`, `SHADOW_EDGE_CODEX_MCP_SCRIPT=packages/mcp-server/dist/index.js`, `SHADOW_EDGE_CODEX_INTERNAL_BASE_URL=http://127.0.0.1:<PORT>` (только loopback). Собрать MCP перед использованием bridge. |
| Крупные карты | `SHADOW_EDGE_DEEP_ZOOM_WORKER=scripts/generate-deep-zoom.mjs`, `SHADOW_EDGE_NODE_BINARY=node`. |

Временные снимки, PDF и результаты проверок в `tmp/` исключены из Git и Docker; сохранять их можно вне рабочего дерева. Актуальная сборка web, полный Go suite, 480 проверок правил персонажей с регрессиями, свежесть каталога (658 заклинаний/105 fixtures) и проверки deployment-конфигурации прошли.

Проверки выбирать по изменённой области; не запускать production-сервер на пользовательском store ради проверки документации:

```sh
npm run test:go                         # go test ./apps/server/...
npm run build                          # типы и production-сборка web
npm run test:deployment                 # существующие проверки Docker/entrypoint
npm test --workspace @shadow-edge/mcp-server
npm run test:characters                 # TS-правила + свежесть Go-каталога
node scripts/export-character-catalog.mjs --check
```

После изменения правил персонажей `npm run generate:character-catalog` обновляет встроенный каталог/fixtures, затем нужны проверки TS и Go. Go-тесты покрывают изоляцию аккаунтов, auth, атомарное хранение, proposals/media, bridge, бой/XP, публичный экран, анкеты и персонажей; тесты находятся рядом с исходниками в `*_test.go`. Для документации достаточно сверки путей, обработчиков и актуальности утверждений; перечисленные команды не означают, что все они выполнялись при последнем редактировании обзора.

Эксплуатация: Docker собирает web, MCP и Go, сохраняет состояние в `/data`; entrypoint восстанавливает отсутствующий primary из `.bak`. Fly настроен на один постоянно работающий экземпляр с volume `/data`, healthcheck `/healthz`. Сброс пароля — `npm run reset-password` ([CLI](apps/server/cmd/server/reset_password.go)); остановить сервер перед этой записью в store и запустить после неё. Не путать проверку health с проверкой доступности каталогов/AI.

## 7. Что легко упустить при изменениях

- PUT/PATCH сущности вызывают полную `materializeEntity`: пропущенные поля могут очиститься; это не JSON Merge Patch. У кампании update сейчас меняет только playlist, shops и preparedCombat (через `updatePreparedCombat`), а не все поля создания.
- Обычные CRUD не принимают универсальный expected revision; конкурентные редакторы могут перезаписать изменения. Контроль ревизий proposal не решает это для всего API.
- `/combat/generate` сохраняет монстров по одному перед стартом боя: весь запрос не является одной транзакцией и при поздней ошибке возможен частичный результат.
- UI-расчёты боя дублируют backend; правила персонажей также реализованы в TS и Go. Контракты, нормализацию legacy-полей и публичную проекцию проверять на обеих сторонах.
- Текст/HTML/URL для игроков проходит отдельные преобразования. Не отправлять полный `campaignData` в публичные ответы вместо специально построенных DTO; не делать staging AI доступным через uploads.
- Пользовательские предметы и черновики localStorage — не серверные сущности. Нет автоматической синхронизации между браузерами, SQL-БД, общего realtime-канала или фонового планировщика AI.
- Сохранившиеся legacy helper-функции, старые docs и учебный корневой Go-файл не определяют текущую архитектуру. Источник HTTP-карты — регистрации в `NewServer` и ветки вложенных dispatchers.

[server]: apps/server/internal/httpapi/server.go
[models]: apps/server/internal/httpapi/models.go
[store]: apps/server/internal/httpapi/store.go
[data]: apps/server/internal/httpapi/data.go
[auth]: apps/server/internal/httpapi/auth.go
[app]: apps/web/src/App.tsx
[combat]: apps/server/internal/httpapi/combat.go
[combat-routes]: apps/server/internal/httpapi/combat_routes.go
[share]: apps/server/internal/httpapi/initiative_share.go
[survey]: apps/server/internal/httpapi/survey.go
[characters]: apps/server/internal/httpapi/characters.go
[uploads]: apps/server/internal/httpapi/uploads.go
[bestiary]: apps/server/internal/httpapi/dndsu_bestiary.go
[items]: apps/server/internal/httpapi/dndsu_items.go
[proposal-http]: apps/server/internal/httpapi/proposal_http.go
[proposals]: apps/server/internal/httpapi/proposals.go
[codex-http]: apps/server/internal/httpapi/codex_bridge_http.go
