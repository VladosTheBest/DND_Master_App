import path from "node:path";
import process from "node:process";
import sharp from "sharp";

sharp.cache(false);
sharp.concurrency(1);

const [input, output, format = "webp", tileSize = "512", overlap = "0"] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/generate-deep-zoom.mjs <input.jpg> <output.dzi>");
  process.exit(2);
}

try {
  const outputBase = output.toLowerCase().endsWith(".dzi") ? output.slice(0, -4) : output;
  const metadata = await sharp(input, { limitInputPixels: false }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Could not read image dimensions");
  if (!["webp", "jpeg", "png"].includes(format) || ![256,512,1024].includes(Number(tileSize)) || ![0,1,2].includes(Number(overlap))) throw new Error("Invalid tile options");
  await sharp(input, { limitInputPixels: false, sequentialRead: true })
    .toFormat(format, { quality: 90, alphaQuality: 100, effort: 4 })
    .tile({ size: Number(tileSize), layout: "dz", overlap: Number(overlap), container: "fs" })
    .toFile(outputBase);
  process.stdout.write(JSON.stringify({
    width: metadata.width,
    height: metadata.height,
    tileSize: Number(tileSize),
    format,
    maxLevel: Math.ceil(Math.log2(Math.max(metadata.width, metadata.height))),
    descriptor: path.resolve(outputBase + ".dzi")
  }) + "\n");
} catch (error) {
  console.error(`Deep Zoom generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
