# Раскрытие и переходы

Короткие эффекты в существующем варианте 3: высота раскрываемой карточки — 280 мс, страница — 200 мс, tabpanel — 220 мс, окно — 180 мс, меню — 160 мс. Карточки списка появляются с задержкой не более 70 мс; никаких новых библиотек/сетевых ресурсов.

- CollapsibleSection сохраняет прежние условия показа children/summary. До клика измеряется текущая высота, после обновления — целевая; повторный клик отменяет предыдущее движение. После завершения снимается clipping и фиксированная высота не остаётся. Форма/данные/aria-expanded не заменены анимационным состоянием.
- PageTransition плавно меняет opacity существующего content при изменении сущности/раздела/кампании/вида. Нет key/remount, transform камеры, блокировки ввода или искусственной задержки навигации. Обычный ввод, сохранение и поиск не входят в identity.
- Native details используют progressive enhancement ::details-content/interpolate-size/allow-discrete. Без поддержки остаётся обычное мгновенное раскрытие. Popover и служебные меню исключены из обрезки; focus outline имеет запас.
- Окна, backdrop, меню и вкладки появляются отдельно. Reduced-motion отключает CSS-движение; playWorkspaceMotion также проверяет настройку, прекращает активный эффект при её изменении и снимает listener по finish/cancel. Настройка системы не менялась; ветка reduced-motion проверена по коду, отдельная эмуляция в браузере не выполнялась.

## Проверки

На одном изолированном сервере 4189 с копией кампании: измерены opacity перехода 0.55 → 1; native раскрытие/закрытие цены товара; открытие/быстрое обратное закрытие статблока игрока, завершение без animation marker/inline height; модальное окно предмета, фокус внутри, Escape и возврат к исходной кнопке; меню инструментов и Escape/focus return. На 390 px нет горизонтального overflow, карточки получают workspace-card-arrive. Цифры и флаги — runtime.json. Приватные снимки — игнорируемый tmp/motion.

При открытии встроенной «Булавы» обнаружен лишний getCatalogItem для builtin-ID из магазина. handleOpenItemInfo/handleAddItem теперь вызывают загрузку только для isRemoteItem; карточка встроенного предмета повторно открыта без alert. Удалённые DnD.su-ID сохраняют прежний путь.

Web tsc/Vite/compression, test-build-manifest, test-workspace-routes, test-editable-list-keys, test-authoring-transport и test-action-menu-position прошли. Backend/API/данные и игровые расчёты не менялись; платные AI-запросы не запускались. Общий Go suite не запускался для этой frontend-правки. Предыдущее предупреждение Vite о крупных rules/PDF chunks остаётся.

## Выпуск

Fly release **202**, исходники **745afdc**, image `registry.fly.io/dnd-master-app:deployment-01M5QGW2FQ1X1TGQCFMYZBTDV1`. Health passing; `/`, `/healthz`, `/livez` — 200, `/api/campaigns` без сессии — 401. HTML и все 60 JS/CSS совпали с локальной сборкой (production.json). Авторизованный production smoke остаётся в ожидании обычного входа пользователя; локальная UI-проверка не считается проверкой под аккаунтом на проде.
