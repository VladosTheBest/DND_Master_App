import { build } from "esbuild";
import assert from "node:assert/strict";

const result = await build({ entryPoints: ["apps/web/src/features/campaigns/dashboard-focus.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { buildDashboardFocus } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const campaign = {
  quests: [
    { id: "low", title: "A", status: "active", urgency: "Low", locationId: "l2" },
    { id: "done", title: "B", status: "completed", urgency: "Critical", locationId: "unused" },
    { id: "critical", title: "C", status: "active", urgency: "Critical", locationId: "l1", issuerId: "npc" },
    { id: "paused", title: "D", status: "paused", urgency: "Critical" },
    { id: "high", title: "E", status: "active", urgency: "High", locationId: "l1", issuerId: "npc" },
    { id: "missing", title: "F", status: "active", urgency: "Medium", locationId: "deleted", issuerId: "deleted" }
  ], locations: [{ id: "unused" }, { id: "l2" }, { id: "l1" }], npcs: [{ id: "npc" }],
  players: [{ title: "B", status: "Guest" }, { title: "C", status: "Reserve" }, { title: "A", status: "Active" }]
};
const original = JSON.stringify(campaign);
const focus = buildDashboardFocus(campaign);
assert.deepEqual(focus.quests.map(q => q.id), ["critical", "high", "missing", "low"]);
assert.deepEqual(focus.locations.map(l => l.id), ["l1", "l2"]);
assert.equal(focus.npcs.length, 1);
assert.deepEqual(focus.players.map(p => p.title), ["A", "B"]);
assert.equal(JSON.stringify(campaign), original, "must not mutate campaign");
assert.deepEqual(buildDashboardFocus({ quests: [], locations: [], npcs: [], players: [] }), { quests: [], locations: [], npcs: [], players: [] });
console.log("Dashboard priority, status, deduplication, dangling references, empty state and immutability passed.");
