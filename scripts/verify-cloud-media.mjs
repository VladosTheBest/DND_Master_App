// Run inside the application machine after cutover. Reports counts, never paths.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.env.SHADOW_EDGE_UPLOAD_DIR || "/data/uploads";
const base = "http://127.0.0.1:" + (process.env.PORT || "8080");
const chosen = new Map();
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    if (!entry.isFile()) continue;
    const extension = path.extname(file).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".dzi", ".mp4", ".webm"].includes(extension)) continue;
    const kind = file.includes("_files/") ? "tile" : extension;
    if (!chosen.has(kind) && (await stat(file)).size <= 8 * 1024 * 1024) chosen.set(kind, file);
  }
}
async function digest(stream) {
  const hash = createHash("sha256");
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}
await walk(root);
assert.ok(chosen.size > 0, "No media available to verify");
for (const file of chosen.values()) {
  const relative = path.relative(root, file).split(path.sep).map(encodeURIComponent).join("/");
  const url = `${base}/uploads/${relative}`;
  const full = await fetch(url);
  assert.equal(full.status, 200, "Media GET failed");
  assert.equal(await digest(full.body), await digest(createReadStream(file)), "Media bytes differ");
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200, "Media HEAD failed");
  assert.equal(Number(head.headers.get("content-length")), (await stat(file)).size, "Media size differs");
  const range = await fetch(url, { headers: { Range: "bytes=0-15" } });
  assert.equal(range.status, 206, "Media range failed");
  assert.equal(await digest(range.body), await digest(createReadStream(file, { start: 0, end: 15 })), "Media range differs");
}
for (const target of ["/uploads/.proposals/test.png", "/uploads/", "/api/ai/proposals/missing/media/test.png"]) {
  const response = await fetch(base + target, { redirect: "manual" });
  assert.ok([401, 404].includes(response.status), "Private media boundary failed");
}
console.log(JSON.stringify({ verifiedMediaSamples: chosen.size, getHeadRange: true, privateBoundaries: true }));
