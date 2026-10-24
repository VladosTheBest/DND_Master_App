# Медиа и характеристики НПС — 24 октября 2026

Свежий браузерный проход варианта 3 на отдельной синтетической кампании. Рабочие кампании/шаблоны и production-сессия не изменялись тестами.

## Найдено, исправлено, проверено

| Приоритет | Подтверждённая проблема | Итог |
|---|---|---|
| P1 | URL строки галереи/плейлиста входил в React key: после первого символа поле пересоздавалось и теряло фокус | В реальном наборе `abc` до исправления оставалось `a`, BODY получал фокус. Теперь введены все символы и полная ссылка трека без потери фокуса. Строки имеют стабильный key во время ввода. [До](02-gallery-url-focus-before.jpg), [после](03-gallery-editor-after.jpg). |
| P1 | Отдельные окна медиа не имели локальных копий и фиксированной исходной revision; ошибки уходили за окно | Scoped drafts галереи/плейлиста восстановлены после закрытия/Escape/reload. Ошибки и 409 видны внутри, Save не стирает текст и не закрывает окно. [Восстановление](04-gallery-restored.jpg). |
| P1 | Конфликт списков требовал потери одной из версий | Реальные параллельные PATCH для gallery и playlist; явное объединение сохраняет обе стороны и параллельные поля мастера, карточки/название и другой media block. [API галереи](gallery-merge-check.json), [плейлист/upload](playlist-and-upload-check.json). Совпадающий URL использует локальные заголовок/подпись; тест подтверждает отсутствие мутации исходных списков. |
| P2 | Ошибка/большой раздел могли остаться выше видимой области, хотя кнопка Save уже заблокирована | Ошибка/конфликт фокусируются и прокручиваются в body. Взятие серверного списка не отправляет mutation и не удаляет локальную копию. [Фокус](media-conflict-focus-check.json), [сравнение на телефоне](13-conflict-phone-after.jpg). Пустая строка не исчезает молча: есть ошибка, после исправления она снимается. |
| P2 | Портреты обрезались в thumbnails, broken img ломал выбор; lightbox не приближал | contain/fallback; новый gallery viewer с zoom/pan, fit, стрелками и portal-меню. Реальное приближение дало scale >1, ArrowRight переключил изображение, Escape вернул фокус к исходной миниатюре. [Desktop](06-gallery-viewer-desktop.jpg), [телефон](07-gallery-viewer-phone.jpg), [метаданные](gallery-viewer-check.json). Музыка не запускалась и платный AI не вызывался. |
| P2 | Галерея имела служебный английский заголовок, перегруженную шапку и сжимающиеся кнопки | Русские подписи, фиксированные header/footer и scroll body. Выбранные изображения сначала явно добавляются в галерею, затем сохраняются; нижняя кнопка показывает текущий шаг. Изображение загружено реальным file chooser, сохранено в WebP и повторно открыто. [Снимок](09-upload-saved.jpg). |
| P2 | Переход к stats центрировал весь огромный раздел; сфокусированный «Размер» находился на y=-436 при body top=97 | Прокрутка к label/полю. Пять переходов summary/content/art/rewards/stats дают видимый focus в body. [Матрица](editor-jump-matrix.json), [контактный лист](jump-contact.jpg), [stats после](11-stats-jump-after.jpg). |
| P2 | Шесть ability inputs оставались в одной тесной строке, заголовок рвался; spellcasting/bonus action были служебным английским | Адаптивная сетка (на 390px две колонки по 121px, inputs по 103px), перенос header/hint, понятные подписи без изменения формул/значений. [До](10-stats-editor.jpg), [после](12-ability-grid-after.jpg), [границы](stats-editor-check.json). |
| P2 | После failed image новый URL оставался скрыт прежним error state | Ошибка привязана к URL. На том же экране без reload сохранена новая иллюстрация и сразу появилась. [Снимок](14-replaced-art-without-reload.jpg), [DOM](replaced-art-check.json). Затем ошибочный синтетический fixture восстановлен. |

## Объём проверки

[Media editor sizes](editor-viewport-matrix.json): 320×568, 768×1024, 1440×1024, 640×240; header/footer доступны, body прокручивается, page horizontal overflow нет. Gallery viewer проверен desktop и 390×844: contain, zoom/fit, next/previous keyboard, menu Escape отдельно от viewer, общий Escape и focus return. Native screenshots сохранены и осмотрены; маленький contact sheet — только обзор.

Проверены добавление из кампании, URL с клавиатуры, редактирование подписи, ошибка пустого URL, guard Escape, восстановление обоих media drafts, две реальные 409, явное объединение, выбор серверной версии, file chooser/upload/save/reopen. Изолированные API-проверки подтверждают сохранённые списки и соседние поля. Сетевые сбои upload/записи и stale async completion дополнительно проверены по коду; отдельного браузерного fault injection для них не было.

Прошли web build (TypeScript/Vite/gzip), test-build-manifest.mjs (52 entries без циклов, четыре startup entries без игровых chunks), test-media-drafts.cjs, test-device-drafts.mjs, test-authoring-transport.mjs, test-workspace-responses.mjs, test-workspace-routes.mjs, test-action-menu-position.cjs, test-format-duration.cjs; git diff --check. Сервер/HTTP contracts/shared types/MCP не менялись, их прошлые проверки не выдаются за свежий прогон.

## Выпуск и оставшиеся границы

Выпущен Fly release **192**, source `c08cb21`, image `registry.fly.io/dnd-master-app:deployment-01M5NX337PN4A4X58WXZ03P9K0`. Health check passing; `/`, `/healthz`, `/livez` — 200, private API без сессии — 401. Все 56 JS/CSS и index.html совпали с локальной сборкой. [Метаданные production](production-check.json). После reload production-вкладки подтверждена обычная форма входа. Private production smoke предмета/связей/сцен требует обычного входа пользователя. Физический touch/TV, live Foundry, платные AI-вызовы/провайдеры и все классы/уровни не проверены. Сводная матрица исходного плана — [acceptance-matrix.md](../acceptance-matrix.md); эти ограничения не позволяют объявить всю цель завершённой.

Финальная проверка runtime: [runtime-check.json](runtime-check.json), ошибок выполнения не обнаружено.
