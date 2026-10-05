import { build } from "esbuild";
import assert from "node:assert/strict";

const compiled = await build({ entryPoints: ["apps/web/src/features/ai-proposals/aiProposal.utils.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { proposalChangeCount } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const empty = { kind: "entity_update", diff: [], operations: [{ type: "update" }], mediaIntents: [] };
assert.equal(proposalChangeCount(empty), 0, "empty patch is not an applicable update");
assert.equal(proposalChangeCount({ ...empty, diff: [{ path: "/revision" }] }), 0);
assert.equal(proposalChangeCount({ ...empty, diff: [{ path: "/title" }] }), 1);
assert.equal(proposalChangeCount({ ...empty, mediaIntents: [{ status: "intent", field: "art.url" }] }), 0);
assert.equal(proposalChangeCount({ ...empty, diff: [{ path: "/art/url" }], mediaIntents: [{ status: "staged", field: "art.url", previewUrl: "/preview.png" }] }), 1, "do not count staged image twice");
assert.equal(proposalChangeCount({ ...empty, kind: "entity_create" }), 1);
console.log("Proposal readiness: empty production-shaped update, revision, text, placeholder, staged image, create passed.");
