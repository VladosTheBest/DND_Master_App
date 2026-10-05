export const feedbackTypes = { bug: "Сообщить об ошибке", suggestion: "Предложить улучшение", impression: "Поделиться впечатлением" };
export const feedbackStatuses = { new: "Новое", reviewing: "В работе", closed: "Закрыто" };
export type FeedbackEntry = { id: string; accountId: string; username: string; type: keyof typeof feedbackTypes; message: string; status: keyof typeof feedbackStatuses; createdAt: string; updatedAt: string };
export class FeedbackAccessError extends Error {}
export async function feedbackRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}${path}`, { credentials: "include", signal, method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) { const ErrorType = response.status === 401 || response.status === 403 ? FeedbackAccessError : Error; throw new ErrorType(result.error?.message || "Не удалось выполнить запрос."); }
  return result.data as T;
}
