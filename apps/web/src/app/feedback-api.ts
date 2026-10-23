import { requestJson, isApiError } from "@shadow-edge/api-client";
export const feedbackTypes = { bug: "Сообщить об ошибке", suggestion: "Предложить улучшение", impression: "Поделиться впечатлением" };
export const feedbackStatuses = { new: "Новое", reviewing: "В работе", closed: "Закрыто" };
export type FeedbackEntry = { id: string; accountId: string; username: string; type: keyof typeof feedbackTypes; message: string; status: keyof typeof feedbackStatuses; createdAt: string; updatedAt: string };
export class FeedbackAccessError extends Error {}
export async function feedbackRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  try {return await requestJson<T>(`${import.meta.env.VITE_API_BASE_URL || ""}${path}`, {signal,method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body)});}
  catch(error){if(isApiError(error)&&(error.status===401||error.status===403))throw new FeedbackAccessError(error.message);throw error;}
}
