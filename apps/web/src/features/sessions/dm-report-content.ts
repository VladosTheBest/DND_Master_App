import type { DMFinding } from "./sessions.api";
export const sections: { key: DMFinding["section"]; title: string; empty: string }[] = [
  { key: "decisions", title: "Решения и точка остановки", empty: "Решения и точка остановки не выделены." },
  { key: "spotlight", title: "Моменты игроков", empty: "Наблюдаемые инициативы не выделены." },
  { key: "interests", title: "Что может заинтересовать игроков", empty: "Недостаточно свидетельств для гипотез об интересах." },
  { key: "feedback", title: "Что понравилось и что мешало", empty: "Прямые отзывы не найдены. Это не означает, что у игроков нет пожеланий." },
  { key: "world", title: "Состояние мира", empty: "Изменения состояния мира не выделены." },
  { key: "threads", title: "Сюжетные линии", empty: "Сюжетные линии не выделены." },
  { key: "continuity", title: "Что проверить до игры", empty: "Дополнительные проверки не выделены." },
  { key: "preparation", title: "Подготовка следующей сессии", empty: "Рекомендации пока не подготовлены." },
];
export const basis = { observed: "Наблюдение", explicit: "Прямые слова", hypothesis: "Гипотеза", suggestion: "Рекомендация" };
export const status = { open: "Открыто", resolved: "Завершено", uncertain: "Уточнить" };
export const clock = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
