# AI PROVIDERS

## Что уже работает

Сервер уже отделяет генерацию сущностей в слой `entityGenerator`.
Сейчас в проекте есть:

- `POST /api/campaigns/:id/ai/drafts`
- `openAIGenerator` для живой генерации через OpenAI Chat Completions + Structured Outputs
- `scaffoldGenerator` как fallback-провайдер

Frontend flow при этом не меняется: UI всё так же просит draft у backend, получает `GenerateEntityDraftResult` и заполняет модалку создания/редактирования.

## Поддерживаемая конфигурация

Сервер читает:

- `SHADOW_EDGE_AI_PROVIDER`
- `SHADOW_EDGE_AI_MODEL`
- `SHADOW_EDGE_AI_BASE_URL`
- `SHADOW_EDGE_AI_API_KEY`

Также поддерживаются алиасы:

- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`

И локальные env-файлы:

- `.env.local`
- `apps/server/.env.local`

## Как теперь идёт генерация

1. `server.go` получает HTTP-запрос на draft.
2. `entityGenerator` выбирает провайдера.
3. `openAIGenerator` собирает prompt из:
   - типа сущности
   - пользовательского запроса
   - текущих полей формы
   - контекста активной кампании
4. Модель возвращает JSON по schema `CreateEntityInput`.
5. Backend нормализует значения, enum-поля, связи и NPC stat block.
6. UI заполняет форму и пользователь уже вручную жмёт `Создать` или `Сохранить`.

## Контракт провайдера

```go
type entityGenerator interface {
    Generate(campaign campaignData, input generateEntityDraftInput) (generateEntityDraftResult, error)
}
```

Для живого провайдера стоит сохранить именно этот контракт и сделать отдельные реализации:

- `scaffoldGenerator`
- `openAIGenerator`
- `localAgentGenerator`
- `ollamaGenerator`

## Что уже учитывает живой генератор

- учитывать тип сущности
- читать контекст кампании
- выдавать готовый `CreateEntityInput`
- при генерации НПС наполнять stat block
- поддерживать города, монстров, NPC, квесты и lore-фрагменты
- возвращать notes, чтобы мастер видел источник и ограничения draft'а

## Что дальше логично добавить

- `ollamaGenerator` или другой локальный OpenAI-compatible provider
- системные prompt templates по жанрам кампаний
- post-processing для автосвязывания сущностей между собой
- audit metadata: какой provider/model породил сущность и из какого prompt
