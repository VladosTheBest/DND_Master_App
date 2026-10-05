import type { CampaignData } from "@shadow-edge/shared-types";

export function buildDashboardFocus(campaign: CampaignData) {
  const urgency = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const quests = campaign.quests.filter(quest => quest.status === "active")
    .sort((a, b) => urgency[a.urgency] - urgency[b.urgency] || a.title.localeCompare(b.title, "ru"));
  // Preserve quest priority, not record creation order, for related references.
  const locations = [...new Set(quests.map(quest => quest.locationId))]
    .flatMap(id => campaign.locations.filter(location => location.id === id));
  const npcs = [...new Set(quests.map(quest => quest.issuerId))]
    .flatMap(id => campaign.npcs.filter(npc => npc.id === id));
  const players = campaign.players.filter(player => player.status !== "Reserve")
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
  return { quests, locations, npcs, players };
}
