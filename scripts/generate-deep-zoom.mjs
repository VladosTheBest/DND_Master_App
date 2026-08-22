import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/generate-deep-zoom.mjs <input.jpg> <output.dzi>");
  process.exit(2);
}

try {
  const outputBase = output.toLowerCase().endsWith(".dzi") ? output.slice(0, -4) : output;
  const metadata = await sharp(input, { limitInputPixels: false }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Could not read image dimensions");
  await sharp(input, { limitInputPixels: false, sequentialRead: true })
    .tile({ size: 512, layout: "dz", overlap: 0, container: "fs", format: "webp" })
    .toFile(outputBase);
  process.stdout.write(JSON.stringify({
    width: metadata.width,
    height: metadata.height,
    tileSize: 512,
    format: "webp",
    maxLevel: Math.ceil(Math.log2(Math.max(metadata.width, metadata.height))),
    descriptor: path.resolve(outputBase + ".dzi")
  }) + "\n");
} catch (error) {
  console.error(`Deep Zoom generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
