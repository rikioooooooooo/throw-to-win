import { generateImage } from "./gemini-client";
import sharp from "sharp";
import * as fs from "node:fs";

const REFERENCE_PATH = "public/assets/final/achievement/pb-update.png";
const OUTPUT_PATH = "public/assets/final/achievement/wr-update.png";

const PROMPT = `STYLE: Match the reference image exactly in art direction — same sticker-style illustration with bold black cartoon outlines, flat solid color fill, Y2K skater/pop aesthetic. Transparent background.

DO NOT: Use thin-line icons, photorealistic rendering, 3D CGI, anime/manga style, watercolor, sketch. Do NOT include phones, devices, human figures, characters, faces, bodies, animals. Do NOT include text in the image.

SUBJECT: A bold celebration badge for achieving WORLD RECORD (#1 globally). Central motif: a stylized crown or globe symbol conveying supremacy and world-scale achievement. Radiating elements: rainbow gradient rays bursting outward, gold accent stars, sparkle dots.

PRIMARY COLORS: Rainbow gradient (red → orange → yellow → green → blue → indigo → violet) combined with bold gold (#FFD700) for crown/star accents. Black outlines preserve the sticker aesthetic. White highlights add shine.

COMPOSITION: Horizontal 16:9 layout with central main element, decorative elements extending to left and right. Balanced, readable at small sizes.`;

async function main(): Promise<void> {
  console.log("Generating WR badge with Gemini 3.1 Flash Image...");

  const pngBuffer = await generateImage(PROMPT, REFERENCE_PATH, { resolution: "1K" });

  const resized = await sharp(pngBuffer)
    .resize(1920, 1080, { fit: "cover", position: "center" })
    .png({ quality: 90 })
    .toBuffer();

  fs.writeFileSync(OUTPUT_PATH, resized);
  console.log(`Saved to ${OUTPUT_PATH} (${(resized.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
