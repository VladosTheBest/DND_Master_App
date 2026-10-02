# Google и Discord: аккаунты и эксплуатация

Текущая реализация сохраняет пользователей и внешние идентичности в существующем
JSON account store на Fly volume: `/data/store.json` и резервная `.bak`.
Docker не хранит аккаунты в эфемерном слое образа. Нужен один writable процесс;
отдельная платная база не требуется. Парольный вход, bcrypt hashes, внутренние
user IDs и `campaign.ownerId` остаются прежними.

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
проверить режим публикации. Запрашиваются только Google `openid profile` и Discord
`identify`, без доступа к Discord-серверам, сообщениям и без offline refresh tokens.

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

## HTTP и будущая SQL миграция

- `GET /api/auth/oauth/providers`: доступность; для текущей сессии ещё статус и имя привязки.
- `POST /api/auth/oauth/{google|discord}/start`: URL авторизации; `link=1` требует сессию,
  `replace=1` требует недавний вход. Проверяется Origin.
- `GET /api/auth/oauth/{google|discord}/callback`: проверка state, provider exchange,
  атомарная регистрация/привязка/замена, cookie session, redirect в приложение.

`authAccountRepository` отделяет операции аккаунтов от OAuth/HTTP.
`oauth_accounts.go` — текущий JSON адаптер, использующий mutex и rollback
`saveMutationLocked`. Bridge пока отдельно использует campaignStore; SQL замена
account repository не означает миграцию всего игрового хранилища.

Будущая схема: `users(id PRIMARY KEY, username, username_key UNIQUE,
password_hash NULL, created_at)` и `external_identities(provider, subject, user_id
REFERENCES users(id), label, PRIMARY KEY(provider, subject), UNIQUE(user_id, provider))`.
OAuth-only password hash пустой и не допускает парольного входа. Поле label лишь
подпись интерфейса, не ключ авторизации. Старый JSON без oauthIdentities совместим;
новое поле опционально, отдельная версия формата для этого расширения не требуется.

Перед переносом остановить запись, сделать защищённую копию всего /data (включая
медиа), проверить уникальность IDs, username keys и provider/subject. В транзакции
импортировать users и развернуть oauthIdentities в external_identities, сохранив
ID, hashes и timestamps буквально; сопоставление ownerId кампаний не изменять.
Проверить counts, внешние ключи и вход тестового пользователя обоими способами.
Переключить адаптер только после проверки; оригинал оставить для отката без
параллельной записи в обе базы. Реальный export содержит персональные данные и
password hashes: не класть его в Git, публичные uploads или документацию.

Live OAuth требует настоящих credentials и настройки обеих консолей провайдеров.
Mock provider tests проверяют реальные HTTP method/body/content type и identity
responses, но не подтверждают готовность внешних consent screens.
