export type AppRouteState =
  | { mode: "app" }
  | {
      mode: "initiative";
      campaignId: string;
    };

export const parseAppRoute = (hash: string): AppRouteState => {
  const normalized = hash.replace(/^#/, "").trim();
  if (normalized.toLowerCase().startsWith("initiative/")) {
    const campaignId = decodeURIComponent(normalized.slice("initiative/".length)).trim();
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
