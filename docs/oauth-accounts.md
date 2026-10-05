# Google и Discord: аккаунты и эксплуатация

Production сохраняет пользователей и внешние идентичности в Managed PostgreSQL
на Fly (`accounts`, `oauth_identities`); локальный backend по умолчанию остаётся JSON.
Миграция завершена 4 октября 2026 года с сохранением парольного входа, bcrypt hashes,
внутренних user IDs и `campaign.ownerId`. Нужен один writable процесс: SQL session
lock защищает совместимый кеш в памяти. Исходный `/data/store.json` и `.bak` сохранены
только как резервные копии. Подробности: [хранение](storage-subscriptions-design.md).

## Конфигурация

Production origin: `https://dnd-master-app.fly.dev`.
В Google создать OAuth client типа Web application; в Discord — OAuth2 application.
Зарегистрировать точные redirect URIs:

- Google: `https://dnd-master-app.fly.dev/api/auth/oauth/google/callback`
- Discord: `https://dnd-master-app.fly.dev/api/auth/oauth/discord/callback`

Переменные сервера:

- `SHADOW_EDGE_PUBLIC_BASE_URL` — фиксированный доверенный origin, задан в fly.toml.
- `SHADOW_EDGE_GOOGLE_CLIENT_ID`, `SHADOW_EDGE_GOOGLE_CLIENT_SECRET`
- `SHADOW_EDGE_DISCORD_CLIENT_ID`, `SHADOW_EDGE_DISCORD_CLIENT_SECRET`

Client credentials задавать через Fly secrets/окружение, вне Git и пользовательского
чата. Не использовать Discord bot token вместо OAuth client secret. Значения можно
ввести через Fly Dashboard → dnd-master-app → Secrets; перед этим согласовать
готовое развёртывание: изменение Fly secrets может перезапустить действующие Machines.
Без полной конфигурации кнопка провайдера видна, но недоступна.
Google consent screen должен разрешать нужных пользователей; для общего доступа
проверить режим публикации. Запрашиваются только Google `openid profile email` и Discord
`identify`, без доступа к Discord-серверам, сообщениям и без offline refresh tokens.

## Кабинет администратора

`/admin` использует отдельный вход Google (`POST /api/auth/oauth/google/start?admin=1`).
Сервер сравнивает подтверждённый Google email с `SHADOW_EDGE_ADMIN_EMAIL`; пустое значение
отключает доступ. Email не является ключом объединения аккаунтов. Права действуют один час
и не продлеваются ротацией cookie; парольный вход и Discord не дают этих прав.
`GET /api/admin/subscriptions` возвращает безопасный список пользователей и последние изменения,
`POST` выдаёт/заменяет подписку на 1–366 дней или отзывает её. Причина обязательна,
изменения сохраняются атомарно с аудитом; это ручная выдача, не обработка платежей.

Для локальной проверки задать отдельный localhost origin и соответствующие redirect
URIs, например `http://localhost:18081/api/auth/oauth/google/callback`. HTTP разрешён
только для loopback. Callback после обработки всегда перенаправляет на фиксированный
origin приложения; произвольный return URL не принимается.

## Потоки и границы

- Первый вход без сессии создаёт новый внутренний аккаунт. Следующий вход по
  `(provider, subject)` открывает его же; Google subject — `sub`, Discord — user `id`.
- Старый парольный аккаунт не требует миграции или привязки. Его владелец добровольно
  открывает «Настройки аккаунта» и привязывает Google/Discord.
- В подтверждённой сессии OAuth автоматически связывает провайдера с текущим user ID.
  В настройках доступны «Привязать», «Привязан» с именем провайдера и «Заменить».
- Автоматического объединения по email нет: у legacy users отсутствует подтверждённая
  почта. Совпадение username, имени или email не доказывает владение аккаунтом.
  При отсутствии сессии существующий пользователь должен сначала войти старым способом.
- Замена требует текущей сессии с входом за последние 10 минут и подтверждения нового
  аккаунта провайдера; ротация session cookie не продлевает время этой проверки.
  Для повторного подтверждения выйти и войти с паролем или текущим провайдером.
  Новый provider ID, занятый другим пользователем, возвращает конфликт. Замена атомарна:
  прежняя идентичность перестаёт открывать этот аккаунт, новая открывает тот же user ID.
  Пароль и остальные привязки сохраняются; последнего способа входа удалением здесь нет.
- Одноразовый state действует 10 минут, связан с HttpOnly/SameSite cookie и провайдером;
  Google использует PKCE S256. Привязка проверяет текущего пользователя и на callback.
  Код меняется на token сервером; идентичность берётся из аутентифицированного userinfo,
  браузерные claims/JWT не принимаются. Access tokens и client secrets не сохраняются
  в account store, URL возврата, сообщениях об ошибках или логах.
- Browser sessions и OAuth attempts остаются в памяти: перезапуск потребует нового
  входа/начала OAuth; сохранённые аккаунты и привязки переживают перезапуск.

## HTTP и SQL-хранение

- `GET /api/auth/oauth/providers`: доступность; для текущей сессии ещё статус и имя привязки.
- `POST /api/auth/oauth/{google|discord}/start`: URL авторизации; `link=1` требует сессию,
  `replace=1` требует недавний вход. Проверяется Origin.
- `GET /api/auth/oauth/{google|discord}/callback`: проверка state, provider exchange,
  атомарная регистрация/привязка/замена, cookie session, redirect в приложение.

`authAccountRepository` отделяет операции аккаунтов от OAuth/HTTP.
`oauth_accounts.go` использует mutex и rollback `saveMutationLocked` общего
campaignStore. PostgreSQL-адаптер транзакционно сохраняет аккаунты и игровые данные.
`accounts` имеет уникальные id/username_key, `oauth_identities` — account FK и
уникальность provider/subject, допускающую перестановку привязок в транзакции.
Одна привязка провайдера на пользователя дополнительно обеспечивается кодом.
OAuth-only password hash пустой и не допускает парольного входа. Label является
только подписью. Сессии и временные OAuth attempts пока в памяти.

Импорт проверен чтением SQL и сравнением канонического digest; исходный volume и
приватные S3-снимки сохранены. Повторный импорт выключен, параллельной записи в JSON
нет. После SQL-записей нельзя просто вернуть старый JSON. Экспорт содержит личные
данные, hashes и bearer tokens: не класть его в Git, публичные uploads или документы.

Live OAuth требует настоящих credentials и настройки обеих консолей провайдеров.
Mock provider tests проверяют реальные HTTP method/body/content type и identity
responses, но не подтверждают готовность внешних consent screens.

## Production-конфигурация

На 4 октября 2026 года четыре OAuth-переменные добавлены в Fly Secrets и применены
к `dnd-master-app`; публичный providers API возвращает enabled=true для обоих
провайдеров. Google настроен в отдельном проекте `shadow-edge-gm`, Audience —
External / In production. Discord использует отдельное приложение Shadow Edge GM.
В обеих консолях зарегистрированы production redirect URIs из раздела выше.

Google consent screen ссылается на `/privacy.html` и `/terms.html` на том же origin.
Исходники находятся в `apps/web/public`, вместе с `legal.css`; Vite копирует их
в dist, существующий web handler выдаёт файлы публично по GET/HEAD. OAuthControls
показывает ссылки на эти страницы при входе и в настройках аккаунта.

Проверены применение секретов, Fly healthcheck, HTTP 200 для публичных страниц,
OAuth Go-тесты и production web-сборка. Реальная привязка каждого провайдера вернула
`oauth=success` и отметку «Привязан» в существующем аккаунте для обоих провайдеров.
После выхода обычный вход через каждую из кнопок Google и Discord также вернул
успешную сессию существующего аккаунта с прежними кампаниями.
