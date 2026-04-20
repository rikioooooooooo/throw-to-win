/**
 * Generate a World Record badge PNG using Gemini image generation.
 *
 * Usage:
 *   GOOGLE_API_KEY=... npx tsx scripts/generate-wr-badge.ts
 *
 * Output: public/assets/final/achievement/wr-badge.png
 */

import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUTPUT_PATH = resolve(
  import.meta.dirname ?? ".",
  "../public/assets/final/achievement/wr-badge.png",
);

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY is required");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Generate a pixel-art badge icon for "WORLD RECORD" achievement in a phone-throwing game.
Style: retro gaming, 128x72 pixels, transparent background, gold/orange metallic crown on top, "WR" text in bold pixel font, subtle glow effect.
Output as a single PNG image.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const part = parts.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    console.error("No image data in response");
    process.exit(1);
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, Buffer.from(part.inlineData.data, "base64"));
  console.log(`Saved to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
