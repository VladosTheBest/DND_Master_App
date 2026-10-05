// Run from the application root, or pipe into `node --input-type=module -` on Fly.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

sharp.cache(false);
const root = await mkdtemp(path.join(tmpdir(), "shadow-optimizer-smoke-"));
try {
  const input = path.join(root, "source.png"), output = path.join(root, "result.webp");
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 50, g: 130, b: 190, alpha: .5 } } })
    .png({ compressionLevel: 0 }).toFile(input);
  await promisify(execFile)(process.execPath, [process.env.SHADOW_EDGE_IMAGE_OPTIMIZER || "scripts/optimize-image.mjs", input, output]);
  const before = (await stat(input)).size, after = (await stat(output)).size;
  assert.ok(after < before * .95);
  assert.deepEqual(await sharp(input).raw().toBuffer(), await sharp(output).raw().toBuffer());
  console.log(JSON.stringify({ syntheticInputBytes: before, optimizedBytes: after, pixelsAndAlphaPreserved: true }));
} finally {
  assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + "shadow-optimizer-smoke-"));
  await rm(root, { recursive: true, force: true });
}
