import { stat, unlink } from "node:fs/promises";
import sharp from "sharp";

// Bound memory on the shared application VM; maps keep their original geometry.
sharp.cache(false);
sharp.concurrency(1);
const [input, output] = process.argv.slice(2);
if (!input || !output) process.exit(2);
try {
  const options = { limitInputPixels: 32_000_000, sequentialRead: true };
  const meta = await sharp(input, options).metadata();
  if (!["png", "jpeg"].includes(meta.format) || (meta.pages || 1) > 1 ||
      !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192 ||
      meta.orientation > 1 || meta.space === "cmyk" || meta.depth !== "uchar") {
    process.exit(0);
  }
  await sharp(input, options)
    .keepIccProfile()
    .webp({ lossless: meta.format === "png", quality: 92, alphaQuality: 100, effort: 4 })
    .toFile(output);
  const original = await stat(input);
  const optimized = await stat(output);
  if (optimized.size >= original.size * 0.95) await unlink(output);
} catch {
  await unlink(output).catch(() => {});
  // Compression is optional; a valid upload must survive worker/codec failures.
  process.exitCode = 1;
}
