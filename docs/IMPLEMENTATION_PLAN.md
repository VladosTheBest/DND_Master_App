# IMPLEMENTATION PLAN

## Текущий статус

Уже сделано:

- фронт переведён на backend-first режим
- локальный API поднят как основной источник данных
- создание кампаний работает через сервер
- создание локаций, НПС, квестов и лора работает через сервер
- AI draft endpoint подключён к UI
- заложен AI-ready слой для будущей генерации сущностей

## Ближайшие этапы

### Phase 1. Stabilize CRUD

- `PUT/PATCH` для кампаний и сущностей
- `DELETE/ARCHIVE` для сущностей
- сохранение размеров панелей и pinned state в `localStorage`
- улучшение ошибок и статусов загрузки в UI

### Phase 2. Rich world editing

- редактор связей между сущностями
- richer form для NPC stat block
- формы для событий мира и session prep
- артефакты и предметы

### Phase 3. Real database

- PostgreSQL schema
- migrations
- repository layer
- импорт из `data/store.json`

### Phase 4. Real AI generation

- live provider adapter в `entityGenerator`
- провайдеры: local agent / OpenAI-compatible
- сохранение generation jobs
- кнопки "создать сразу" и "сохранить как черновик"

## Следующие практические задачи

1. Добавить backend endpoints на обновление и архивирование.
2. Сделать форму редактирования NPC stat block в интерфейсе.
3. Подключить PostgreSQL и миграции.
4. Реализовать первый живой AI adapter за текущим `/ai/drafts` endpoint.
5. Добавить сущности `items/artifacts` как новый модуль мира.
