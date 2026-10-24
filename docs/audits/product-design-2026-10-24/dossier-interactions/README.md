# Досье, карточки игроков и начальная загрузка — 24 октября 2026

Продолжение выбранного варианта 3. Снимки сняты через браузер с текущего приложения; данные — отдельная синтетическая кампания, не рабочие кампании. Сервер этой итерацией не менялся.

## Найдено и исправлено

| Приоритет | Дефект и последствие | Проверенный результат |
|---|---|---|
| P1 | Escape/backdrop карточки обходили dirty guard; карточка и набранный AI-запрос не имели собственной восстанавливаемой копии | Все способы закрытия проходят guard, draft scoped по владельцу/кампании/записи/карточке; восстановлены название, текст и AI prompt с custom length после reload. Запрос не отправляется автоматически. [05](05-escape-guard.jpg), [06](06-recovered-card.jpg), [11](11-ai-prompt-restored.jpg). |
| P1 | Save использовал свежую revision вместо версии при открытии; ошибка уходила за модалку | Фиксированная исходная revision, ошибка внутри формы, реальные 409 через параллельный PATCH. «Сохранить копию» добавляет карточку к актуальной версии, не затирает старую/сведения мастера/HP. [Метаданные](card-conflict-check.json), [длинный случай](card-long-conflict-check.json). |
| P2 | Длинное сравнение сжималось grid-строкой и накладывалось на редактор | max-content rows, отдельная прокрутка текста, стабильный footer. [Границы](comparison-layout-check.json), [вид](08c-editor-after-comparison.jpg). |
| P2 | Enter на вложенном Edit открывал просмотр вместо редактора | Отдельные native Open/Edit; обе кнопки проверены Enter. Read-only карточки имеют Open. Игрок ready campaign остаётся редактируемым; source не открывает Edit. [Игрок прохождения](16-ready-player-card.jpg). |
| P2 | Меню не закрывалось Escape и могло смещаться/обрезаться внутри filtered containers | Portal body/dialog, clamp/flip/scroll, Escape возвращает фокус, Tab выводит к следующему действию. [9 состояний](menu-matrix.json), [короткое окно](12-long-menu-short-window.jpg), [AI в dialog](07-ai-menu-in-dialog.jpg). |
| P2 | Preview скрывал портрет за фоном, разбивал короткие факты; закрытие прыгало наверх | Настоящая contain-миниатюра, адаптивные факты; фокус Close, Escape и возврат к кнопке открытия. [До](13-quick-preview.jpg), [после](14-quick-preview-after.jpg). |
| P2 | Описание предмета игнорировало готовую HTML-таблицу сервера | Общий FormattedText + DOMPurify без разрешённых атрибутов; абзацы/таблица сохранены, таблица доступна клавиатуре. Прямая ссылка вне первой страницы каталога, 13 строк таблицы реального предмета. [Снимок](18-item-description.jpg). |
| P2 | Login статически загружал combat/media/quests/notes через общие зависимости | workspace-ui/auth-ui и чистый format-duration, manifest без статических циклов. Начальный gzip JS 155304 → 85970 байт (-44,6%), без оценки TTI. [Измерения](startup-load-check.json). |

## Объём проверки

- [26 состояний 13 разделов](screen-matrix.json), desktop 1440×1024 и phone 390×844: заголовки загружены, page horizontal overflow отсутствует; снимки screen-* и просмотренные [desktop](contact-1440.jpg)/[phone](contact-390.jpg) contact sheets. Это проверка корней разделов, а не всех возможных вложенных сценариев.
- Досье/menu: desktop, phone 320×568/390×844, короткое окно 640×240; девять menu состояний в viewport. Escape/Shift+Tab/Tab-last/закладка/закрытие кликом снаружи проверены фактически; AI menu внутри native dialog закрывается отдельно.
- Карточка: native Open/Edit; close guard; сохранение/reload/recovery; ошибка 409; длинное сравнение и сохранение копии с проверкой обеих версий через API. Неотправленный AI prompt восстановлен вместе с custom 750, без платного вызова. Снимок [узкого телефона](15-card-small-phone.jpg).
- Ready: в отдельной кампании создан player, contentHash immutable template непустой и не изменился; карточка игрока открывает Edit.
- Предмет: прямая ссылка, полное описание/таблица и Escape; AI chat без второго launcher, поле вопроса на телефоне, ошибок JavaScript не обнаружено. [AI](19-ai-chat-phone.jpg).
- TypeScript/Vite/gzip build; test-action-menu-position.cjs, test-format-duration.cjs, test-build-manifest.mjs, test-device-drafts.mjs, test-authoring-transport.mjs, test-workspace-routes.mjs, test-workspace-responses.mjs, test-reward-input.cjs; git diff --check. Нового Go suite нет: сервер этой итерацией не менялся; исходные серверные/сценовые проверки описаны в родительском аудите.

## Границы и выпуск

Платные AI-запросы, внешние OAuth, физические touch/TV и live Foundry не проверены. Эта итерация не меняет модели/цены, игровые расчёты и template content. Авторизованный production smoke связей/сцен по-прежнему требует обычного входа пользователя; локальные проверки не являются его заменой. Выпущен Fly release **190**, исходники `566deaf`, image `registry.fly.io/dnd-master-app:deployment-01M5NT77ZPKXGANEZV3RF63ZZX`. Health check passing, `/`, `/healthz`, `/livez` — 200, private API без сессии — 401. Совпали все 56 JS/CSS и index.html; четыре стартовых JS подтверждены в DOM production. Gzip-байты измерены с production, -44,6%. [Метаданные](production-check.json), [экран входа](21-production-sign-in.jpg). Private smoke не выполнен: production по-прежнему показывает обычную форму входа.
