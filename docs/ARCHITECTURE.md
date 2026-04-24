# ARCHITECTURE

## Цель текущего среза

Текущий срез переводит приложение в backend-first режим:

- фронт по умолчанию работает с `http://localhost:8080`
- кампании и сущности создаются через API
- данные сохраняются в локальное хранилище сервера
- AI-генерация отделена в самостоятельный серверный слой

## Слои

### `apps/web`

React + TypeScript + Vite клиент. Отвечает за:

- layout приложения
- модульную навигацию
- центральную knowledge page
- preview panel
- command-palette-поиск
- создание кампаний и сущностей через backend

### `apps/server`

Go HTTP API. Отвечает за:

- хранение кампаний и сущностей
- загрузку активной кампании
- поиск по кампании
- создание сущностей
- AI draft endpoint
- единый JSON envelope

### `packages/shared-types`

Общие TypeScript-контракты между фронтом и backend API.

### `packages/api-client`

Клиентский слой, который инкапсулирует HTTP-вызовы:

- `listCampaigns()`
- `getCampaign(id)`
- `createCampaign(input)`
- `createEntity(campaignId, input)`
- `generateEntityDraft(campaignId, input)`
- `search(campaignId, query)`

### `data/store.json`

Текущее локальное файловое хранилище. Это временный storage-слой до миграции в PostgreSQL.

## Навигационная модель

Текущий shell уже поддерживает нужный мастерский ритм:

1. список кампаний и модулей слева
2. список сущностей по активному модулю
3. основная knowledge page в центре
4. preview panel справа
5. pinning и быстрые открытия без потери контекста

## Backend-first курс

Фронт теперь не зависит от mock-данных по умолчанию. Основной сценарий такой:

1. поднимается сервер
2. фронт получает кампании и данные только по API
3. создание новых сущностей сразу пишет их в `data/store.json`
4. поиск и preview работают на тех данных, которые уже пришли с backend

## AI integration seam

Для будущей генерации городов, артефактов, НПС и противников сервер уже содержит `entityGenerator`.

Это важно, потому что позже можно будет подменить реализацию, не меняя:

- роут `POST /api/campaigns/:id/ai/drafts`
- frontend-код модалки создания сущности
- общие DTO между фронтом и сервером

На следующем этапе сюда можно подключить:

- локального агента
- OpenAI
- Ollama / LM Studio / другой OpenAI-compatible endpoint

## Ближайшие архитектурные шаги

1. Вынести storage в репозиторный слой.
2. Добавить update/delete API.
3. Завести PostgreSQL + migrations.
4. Подключить реальный AI provider к `entityGenerator`.
5. Добавить richer editor и явный graph связей между сущностями.
