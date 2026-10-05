// Run inside the Fly machine after cleanup; prints no user filenames or URLs.
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.env.SHADOW_EDGE_UPLOAD_DIR || "/data/uploads";
const candidates = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!entry.name.endsWith("_files")) await walk(file); continue; }
    if (!entry.name.endsWith(".dzi")) continue;
    const base = file.slice(0, -4);
    for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
      try { candidates.push({ descriptor: file, source: base + ext, bytes: (await stat(base + ext)).size }); break; } catch {}
    }
  }
}
await walk(root);
candidates.sort((a,b) => a.bytes-b.bytes);
assert.ok(candidates.length, "No persistent map available");
const chosen = candidates[0];
const descriptor = await readFile(chosen.descriptor, "utf8");
const format = descriptor.match(/\bFormat="(jpeg|png|webp)"/)?.[1];
assert.ok(format, "Unsupported test descriptor");
const tile = chosen.descriptor.slice(0,-4) + `_files/0/0_0.${format}`;
let absent = false;
try { await stat(tile); } catch { absent = true; }
assert.ok(absent, "Test requires an evicted tile, not an already warm cache");
const hash = async file => createHash("sha256").update(await readFile(file)).digest("hex");
const before = await hash(chosen.source);
const url = "http://127.0.0.1:" + (process.env.PORT || "8080") + "/uploads/" + path.relative(root,tile).split(path.sep).map(encodeURIComponent).join("/");
const started = Date.now();
const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
assert.equal(response.status,200,"Cold tile rebuild failed");
assert.equal(response.headers.get("cache-control"),"private, no-store");
assert.ok((await response.arrayBuffer()).byteLength>0);
assert.ok((await stat(tile)).size>0);
assert.equal(await hash(chosen.source),before,"Original changed");
const head = await fetch(url,{method:"HEAD"});
assert.equal(head.status,200);
console.log(JSON.stringify({coldRebuild:true,originalUnchanged:true,head:true,noStore:true,elapsedMs:Date.now()-started}));
