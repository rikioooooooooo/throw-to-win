import { generateImage } from "./gemini-client";
import sharp from "sharp";
import * as fs from "node:fs";

const REF = "public/assets/final/achievement/pb-update.png";
const OUT_DIR = "data/wr-candidates";

const PROMPT = `Look at the reference image carefully. Generate a NEW image in the EXACT SAME style, size, composition, and layout as the reference.

The reference shows: a sticker-style illustration centered on a white background, with bold black outlines, flat green color fill, a crown motif with an upward arrow, lightning bolts, stars, and sparkle effects radiating outward. The illustration is centered and does NOT touch the edges — there is plenty of white space margin around it.

Now create the SAME style illustration but for "WORLD RECORD" instead of "PB":
- Replace the green color with GOLD (#FFD700) and rainbow accents
- Replace "PB" text with "WR" text in the same bold style
- Keep the crown motif but make it more elaborate (larger, more ornate)
- Add a small globe element
- Keep the same lightning bolts, stars, radiating lines style
- Keep the same white background with generous margins
- Keep the same overall SIZE of the illustration relative to the canvas — do NOT make it bigger than the reference
- Same black outline thickness, same sticker aesthetic

CRITICAL: The illustration must be the SAME SIZE as in the reference. Do NOT scale it up to fill the frame. Maintain the same white space margins.`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (let i = 1; i <= 20; i++) {
    const n = String(i).padStart(2, "0");
    console.log(`[${n}/20] Generating...`);
    try {
      const png = await generateImage(PROMPT, REF, { resolution: "1K" });
      const out = await sharp(png)
        .resize(1920, 1080, { fit: "cover" })
        .png()
        .toBuffer();
      fs.writeFileSync(`${OUT_DIR}/wr-${n}.png`, out);
      console.log(`  → OK (${(out.length / 1024) | 0} KB)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err);
      console.error(`  → FAIL: ${msg}`);
    }
  }
  console.log("Done.");
}

main();
