# Product Design QA — выбранный вариант 3

Дата: 24 октября 2026. Проверка существующего React-приложения на отдельном JSON-стенде `http://127.0.0.1:4189`, искусственная кампания. Это адаптация выбранного направления к работающим данным и функциям, не замена приложения картинкой.

## Источник и сравнение

- Source visual truth: [concept-3.png](docs/audits/product-design-2026-10-23/concept-3.png), PNG 1487×1058.
- Реализация, пустые связи: [record-final.jpg](docs/audits/product-design-2026-10-23/after/record-final.jpg), JPEG 1487×1058.
- Заполненная запись: [record-with-media.jpg](docs/audits/product-design-2026-10-23/after/record-with-media.jpg), JPEG 1487×1058. Настоящее изображение 900×600 из ручной карты тестового стенда, загрузка complete/naturalWidth проверена DOM; не CSS-заглушка и не изображение интерфейса.
- Full-view comparison: источник и каждый из двух снимков реализации были показаны вместе в одном tool input/result и сопоставлены визуально. Desktop CSS viewport 1487×1058, изображения 1:1, дополнительного масштабирования нет.
- Focused comparison: [record-header-comparison.jpg](docs/audits/product-design-2026-10-23/after/record-header-comparison.jpg) — только аналитические crops исходного макета и browser capture, верх — source, низ — implementation. Исходные файлы не менялись. Проверены заголовок, breadcrumb, edit/action и контраст; текст разный, поэтому переносы не сравнивались как pixel diff.
- Адаптивность: CSS viewport 1024×900 и 390×844; [tablet-record.jpg](docs/audits/product-design-2026-10-23/after/tablet-record.jpg), [mobile-record-with-media.jpg](docs/audits/product-design-2026-10-23/after/mobile-record-with-media.jpg), [mobile-settings-final.jpg](docs/audits/product-design-2026-10-23/after/mobile-settings-final.jpg). Mobile/tablet исходника нет: это проверка responsive поведения, не сравнение с вымышленным мобильным макетом. Browser JPEG некоторых кадров — 381×825/1015×892 при CSS 390×844/1024×900; снимки сохранены как получены, без выдачи их за 1:1 mobile target. Ширина DOM не превышала viewport; масштаб и pixel-размер каждого файла указаны в after/evidence.json.
- Density: desktop 1 image px : 1 CSS px; системный DPR не использовался для вычисления точных расстояний. Mobile JPEG scale около .977; DOM-размеры проверялись отдельно. Выравнивание оценивалось при одинаковом размере desktop frames.

## Итерации и исправления

1. **P2 — служебные блоки забирают первый экран.** Первый вариант имел крупные fact cards и вторичные действия рядом с Edit. Сводка стала строкой, Edit — единственным основным действием, прочее — раскрываемым меню. Фильтры списка убраны из открытой записи. Сравнение: record-pass-1.jpg → record-final.jpg.
2. **P1 — лишняя высота mobile hero.** Унаследованный column layout трактовал flex-basis 280px как высоту. Принудительно задан правильный flex direction, на mobile basis auto/width 100%. Фактическая высота hero уменьшилась с 336 до примерно 127 px; mobile-record-final.jpg и mobile-record-with-media.jpg повторно просмотрены. Недостоверный первый кадр во время смены viewport исключён.
3. **P2 — старые portal-стили.** Account/editor/confirm вне .shell сохраняли serif/gradient primary. Добавлены scoped общие шрифты, поверхности, primary и focus. Сравнение mobile-settings.jpg → mobile-settings-final.jpg: кнопка закрытия видима, rect y≈766–808 при высоте844, сработала.
4. **P2 — четыре колонки при просмотре связи.** [relation-preview-initial.jpg](docs/audits/product-design-2026-10-23/after/relation-preview-initial.jpg) сжимал запись двумя правыми панелями. Preview теперь заменяет контекстную колонку; [relation-preview-final.jpg](docs/audits/product-design-2026-10-23/after/relation-preview-final.jpg) просмотрен после исправления: один main track 797px, context display:none, document width1487. Закрытие возвращает связи.
5. **P2 — растянутое пустое состояние группы.** Удалён min-height16rem, выровнены спокойные поверхности и CTA. [players.jpg](docs/audits/product-design-2026-10-23/after/players.jpg) → [players-final.jpg](docs/audits/product-design-2026-10-23/after/players-final.jpg): краткая запись мастера отделена подписью от серверного листа, пустое состояние компактно.
6. **P1 — переходы и предупреждения.** Location → sessions → items не передаёт чужой target; workshop return `/` переключает реальный экран. Clean combat exit без предупреждения; добавленный противник → warning → confirm возвращает именно в Оффлайн без второго диалога. Итог: [offline-after-confirm.jpg](docs/audits/product-design-2026-10-23/after/offline-after-confirm.jpg). Проверено после отдельного исправления перехода, а не выведено из build.

Последняя сравнительная проверка после исправлений не выявила новых actionable P0/P1/P2 в перечисленных состояниях. Исходные изображения макета остаются визуальной направляющей; фиктивные NPC, квесты и портовый город не добавлялись пользователям.

## Обязательные поверхности

| Поверхность | Результат |
|---|---|
| Шрифты и типографика | Sans hierarchy, body14, record heading32/24mobile, ясные action labels; существующий Inter/Segoe UI/system fallback. Не заявляется точная идентификация неизвестного шрифта растрового макета. Печатные и игровые handout skins остаются специальными. |
| Интервалы и сетка | 64px shortcuts +230px меню, minmax main, 280px context, mobile одна колонка; пустой art не оставляет пустой баннер. Функциональные media/handout секции сохраняются. |
| Цвета и tokens | Charcoal/navy поверхности, lavender primary, muted copy, понятные focus/disabled/selected. Контраст проверен визуально, полной WCAG-сертификации нет. |
| Изображения | Используются art записей и существующие изображения/иконки приложения. Широкий desktop crop и более высокий mobile crop проверены. Иллюстративный город макета не подменяет карту реальной записи; нет новых CSS/SVG суррогатов. |
| Тексты | Русские названия разделов; Магазины вместо shops; текущий режим AI и ограничения стенда видны; «Оффлайн Beta» честно требует интернет. Fictional source content не переносился в приложение. |

## Реальные проверки взаимодействия

- Sidebar desktop/mobile: переходы, закрытие меню после перехода, Escape и возврат фокуса; настройки доступны в прокручиваемом меню.
- Directory: 110 записей/постраничная выдача, компактная ссылка карты; открытие detail.
- Entity: чтение master content, реальные изображение/handout/связь, preview open/close. Изменение summary → закрытие → предупреждение → продолжить → save → reload; сохранённая строка видна после reload.
- Sessions → items: реальные selected session и каталог; в URL нет target другого раздела. Экранный master report темный; PDF генерация заново не проходилась.
- MapWorkspace: библиотека и существующий Creative canvas, стили controls; движок и координаты не менялись. Платная генерация не запускалась.
- AI: пустой inspector отсутствует, отправка недоступна при отсутствии рабочего подключения стенда; backend capability не подменялась.
- NPC/quests empty directory, notes, events, shops, rules reader, players и public character entry осмотрены после общей миграции. 2014 и2024 отдельны; локальная библиотека раскрывается явно; возврат в кабинет работает.
- Console errors последней record/адаптивной проверки: []. В ходе параллельного локального rebuild один раз получен stale lazy chunk → WorkspaceBoundary → ручное обновление восстановило страницу; maps-initial.jpg относится к этому состоянию стенда, не к итоговой карте.
- Web TypeScript + production build; scripts/test-workspace-routes.mjs, test-device-drafts.mjs, test-authoring-transport.mjs, test-workspace-responses.mjs; git diff --check.

## Принятые отличия и границы

Макет показывает вымышленную полностью заполненную локацию. Существующая app хранит и пустые записи, несколько player handouts, боевые планы, музыку и галерею: они сохранены и не заменены статичным макетом. Иллюстрации и названия зависят от данных. Нет неподтвержденного «Сохранено» для открытого черновика: в контексте написано «Сохранённая запись · изменения через редактор», а редактор показывает собственный статус. Карта справа не угадывается по названию: доступны прежний атлас/контекст создания; автоматическая обратная связь карты с записью требует отдельного data contract.

P3 follow-up: локализация legacy enum фактов (City/Tense), дальнейшая унификация специальных handout-типографик. За рамками: все уровни/classes/PDF мастера, активный бой и TV на реальном втором устройстве, Foundry, live provider inference, все admin/ready-reader состояния, screen reader и полная 200% zoom/WCAG проверка. Product gaps исходного аудита не объявлены закрытыми визуальным обновлением.

## Checklist

- [x] Выбранное направление реализовано в существующем приложении.
- [x] Full-view и focused comparison, пять fidelity surfaces.
- [x] Все найденные P0/P1/P2 этой итерации исправлены и повторно проверены.
- [x] Desktop/tablet/mobile, clean/dirty/empty/filled/preview/modal состояния.
- [x] Actual browser captures и размеры; исходный аудит сохранён.
- [x] Build и применимые регрессии; backend API/storage не менялись.

final result: passed
