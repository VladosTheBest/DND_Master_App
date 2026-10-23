export type AppRouteState =
  | { mode: "app" }
  | {
      mode: "initiative";
      campaignId: string;
    };

export const parseAppRoute = (hash: string): AppRouteState => {
  const normalized = hash.replace(/^#/, "").trim();
  if (normalized.toLowerCase().startsWith("initiative/")) {
    let campaignId="";
    try { campaignId=decodeURIComponent(normalized.slice("initiative/".length)).trim(); } catch { return {mode:"app"}; }
    if (campaignId) {
      return {
        mode: "initiative",
        campaignId
      };
    }
  }
  return { mode: "app" };
};

export const buildInitiativeHash = (campaignId: string) => `#initiative/${encodeURIComponent(campaignId)}`;

export function buildAIResultURL(campaignId: string, target: { sessionId?: string; proposalId?: string }) {
  const params = new URLSearchParams({ campaign: campaignId });
  if (target.sessionId) params.set("session", target.sessionId);
  if (target.proposalId) params.set("proposal", target.proposalId);
  return `/?${params}`;
}
