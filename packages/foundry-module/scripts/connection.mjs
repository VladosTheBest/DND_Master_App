// An approved grant survives the short-lived pairing request and server restarts.
export async function completeConnection(state, request) {
  if (state.campaignId) return state;
  if (!state.pairing || !state.token || !state.base) throw Error("Сначала начните подключение.");
  let result;
  try {
    result = await request(state, `pairings/${encodeURIComponent(state.pairing)}`);
    if (!result.approved) throw Error("Подтвердите кампанию на сайте, затем снова нажмите «Завершить подключение».");
  } catch (error) {
    if (error.code !== "pairing_expired") throw error;
    // The scoped snapshot authenticates the saved secret even after pairing expiry.
  }
  let snapshot;
  try { snapshot = await request(state, "v1/snapshot"); }
  catch (error) {
    if (!result && error.status === 401) throw Error("Запрос подключения истёк или разрешение отозвано. Нажмите «Новое подключение».");
    throw error;
  }
  const next = {...state, campaignId: snapshot.campaignId, title: snapshot.title};
  if (result?.connectionId) next.connectionId = result.connectionId;
  delete next.pairing;
  return next;
}
