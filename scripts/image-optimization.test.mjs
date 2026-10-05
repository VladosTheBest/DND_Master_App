import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, stat, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

sharp.cache(false);

const run = promisify(execFile);
const scripts = path.dirname(fileURLToPath(import.meta.url));
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "shadow-image-test-"));
  t.after(async () => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + "shadow-image-test-"));
    await rm(dir, { recursive: true, force: true });
  });
  const pixels = Buffer.alloc(512 * 512 * 4);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4;
    pixels[i] = x % 256; pixels[i + 1] = y % 256;
    pixels[i + 2] = (x + y) % 256; pixels[i + 3] = x < 256 ? 128 : 255;
  }
  const input = path.join(dir, "image.png"), output = path.join(dir, "image.webp");
  await sharp(pixels, { raw: { width: 512, height: 512, channels: 4 } }).png({ compressionLevel: 0 }).toFile(input);
  return { dir, input, output };
}
const optimize = (input, output) => run(process.execPath, [path.join(scripts, "optimize-image.mjs"), input, output]);

test("PNG optimization preserves dimensions, alpha and decoded pixels", async t => {
  const { input, output } = await fixture(t);
  await optimize(input, output);
  assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(input).raw().toBuffer());
  const meta = await sharp(output).metadata();
  assert.equal(meta.width, 512); assert.equal(meta.height, 512); assert.equal(meta.hasAlpha, true);
  assert.ok((await stat(output)).size < (await stat(input)).size * 0.95);
});

test("JPEG becomes smaller without resizing; oriented images are skipped", async t => {
  const { dir, input, output } = await fixture(t);
  const jpeg = path.join(dir, "image.jpg");
  await sharp(input).jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toFile(jpeg);
  await optimize(jpeg, output);
  assert.ok((await stat(output)).size < (await stat(jpeg)).size * .95);
  assert.equal((await sharp(output).metadata()).width, 512);
  await rm(output);
  const oriented = path.join(dir, "oriented.jpg");
  await sharp(input).withMetadata({ orientation: 6 }).jpeg().toFile(oriented);
  await optimize(oriented, output);
  await assert.rejects(stat(output), { code: "ENOENT" });
});

test("invalid inputs fail without modifying their source; WebP is not recompressed", async t => {
  const { dir, input, output } = await fixture(t);
  await optimize(input, output);
  const ignored = path.join(dir, "ignored.webp");
  await optimize(output, ignored);
  await assert.rejects(stat(ignored), { code: "ENOENT" });
  const invalid = path.join(dir, "invalid.png");
  await writeFile(invalid, "invalid image");
  await assert.rejects(optimize(invalid, ignored));
  assert.equal(await readFile(invalid, "utf8"), "invalid image");
});

test("Deep Zoom declares WebP and produces matching usable tiles", async t => {
  const { input, dir } = await fixture(t);
  const descriptor = path.join(dir, "map.dzi");
  const { stdout } = await run(process.execPath, [path.join(scripts, "generate-deep-zoom.mjs"), input, descriptor]);
  const result = JSON.parse(stdout);
  assert.equal(result.format, "webp");
  assert.equal(result.width, 512); assert.equal(result.height, 512);
  assert.match(await readFile(descriptor, "utf8"), /Format="webp"/);
  const tile = await sharp(path.join(dir, "map_files", String(result.maxLevel), "0_0.webp")).metadata();
  assert.equal(tile.width, 512); assert.equal(tile.format, "webp");
});
