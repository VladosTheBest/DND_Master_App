# DATABASE

## Текущее состояние

Сейчас сервер хранит данные в `data/store.json`. Это удобно для локальной разработки и быстрого старта, но следующая полноценная база для проекта должна быть PostgreSQL.

## Почему PostgreSQL

Для кабинета мастера нужны:

- связанные сущности
- быстрый поиск
- удобные фильтры по кампании, типу и статусу
- мягкое архивирование
- read-model для preview и dashboard
- база под AI-генерацию и историю изменений

## Базовые таблицы Phase 2

### `campaigns`

- `id`
- `title`
- `slug`
- `system`
- `setting_name`
- `summary`
- `in_world_date`
- `status`
- `created_at`
- `updated_at`
- `archived_at`

### `locations`

- `id`
- `campaign_id`
- `name`
- `slug`
- `type`
- `parent_location_id`
- `summary`
- `description`
- `danger_level`
- `tags`
- `created_at`
- `updated_at`
- `archived_at`

### `npcs`

- `id`
- `campaign_id`
- `name`
- `slug`
- `role`
- `status`
- `importance`
- `location_id`
- `summary`
- `public_description`
- `private_notes`
- `portrait_url`
- `tags`
- `created_at`
- `updated_at`
- `archived_at`

### `npc_stat_blocks`

- `npc_id`
- `size`
- `creature_type`
- `alignment`
- `armor_class`
- `hit_points`
- `speed`
- `proficiency_bonus`
- `challenge`
- `senses`
- `languages`
- `saving_throws`
- `skills`
- `resistances`
- `immunities`
- `condition_immunities`
- `ability_scores_json`
- `spellcasting_json`

### `npc_actions`

- `id`
- `npc_id`
- `section`
- `name`
- `subtitle`
- `to_hit`
- `damage`
- `save_dc`
- `description`
- `sort_order`

### `quests`

- `id`
- `campaign_id`
- `title`
- `slug`
- `status`
- `summary`
- `description`
- `urgency`
- `issuer_npc_id`
- `location_id`
- `created_at`
- `updated_at`
- `archived_at`

### `lore_pages`

- `id`
- `campaign_id`
- `title`
- `slug`
- `category`
- `summary`
- `content`
- `visibility`
- `tags`
- `created_at`
- `updated_at`

### `entity_links`

Связующая таблица для backlinks, preview blocks и knowledge graph:

- `id`
- `campaign_id`
- `source_type`
- `source_id`
- `target_type`
- `target_id`
- `relation_kind`
- `relation_note`
- `created_at`

## Поиск

Для глобального поиска и AI-assisted retrieval подойдут:

- `tsvector` по `title/name`, `summary`, `content`
- `pg_trgm` для неточных совпадений
- read-model или materialized view для preview payloads

## AI storage layer

Когда будет подключён реальный AI provider, стоит добавить:

### `generation_jobs`

- `id`
- `campaign_id`
- `entity_type`
- `provider`
- `model`
- `prompt`
- `status`
- `raw_response`
- `created_at`
- `finished_at`

### `generation_artifacts`

- `id`
- `generation_job_id`
- `entity_id`
- `draft_json`
- `accepted_at`

Это позволит хранить историю генераций, пересобирать draft'ы и понимать, что именно создал AI.
