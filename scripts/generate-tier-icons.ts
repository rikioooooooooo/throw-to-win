import { generateImage } from "./gemini-client";
import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";

const REFERENCE_PATH = "public/tiers/legend.webp";
const OUTPUT_DIR = "public/tiers";

type TierPromptDef = {
  readonly id: string;
  readonly color: string;
  readonly theme: string;
};

const NEW_TIERS: readonly TierPromptDef[] = [
  { id: "mythic",    color: "#F5DEB3", theme: "ancient mythic scroll texture, wheat-gold metallic accents, ornate and legendary" },
  { id: "stellar",   color: "#FFD700", theme: "golden star burst, radiant yellow starlight, sparkling stellar field" },
  { id: "celestial", color: "#87CEEB", theme: "heavenly sky-blue celestial realm, soft clouds, ethereal light" },
  { id: "cosmic",    color: "#6A5ACD", theme: "deep cosmic purple, scattered stars and faint constellations, mystical" },
  { id: "galactic",  color: "#9370DB", theme: "spiral galaxy with purple dust clouds, swirling cosmic energy" },
  { id: "nebula",    color: "#FF1493", theme: "vivid pink nebula gas cloud, magenta and deep-pink space phenomenon" },
  { id: "void",      color: "#0A0A0A", theme: "deep void blackness with tiny scattered sparks, minimalist cosmic darkness" },
  { id: "karman",    color: "#00E5FF", theme: "the Karman line — cyan atmospheric boundary between sky and space, gradient transition" },
  { id: "omega",     color: "#FF4500", theme: "ISS orbital view with solar flare bursts, intense orange-red inferno, apocalyptic final tier" },
];

function buildPrompt(tier: TierPromptDef): string {
  return `STYLE: Match the reference image exactly in art direction — same texture style, same visual density, same rendering quality. The reference is a tier icon texture (pattern used as SVG <pattern> fill for a character silhouette).

DO NOT: Include any characters, phones, devices, human figures, animals, faces, or recognizable subjects. This is a pure texture / abstract background image used as fill pattern. Do NOT add text.

SUBJECT: Abstract ${tier.theme}

PRIMARY COLOR: ${tier.color} should dominate the composition. Complementary shades allowed.

COMPOSITION: Full-frame textured pattern with even visual distribution. No central focus point (will be tiled/patterned). Rich visual interest with organic variation. Match the overall brightness, saturation, and rendering style of the reference image.`;
}

async function main(): Promise<void> {
  const filter = process.env.TIER_FILTER?.split(",").map((s) => s.trim()).filter(Boolean);
  const tiers = filter && filter.length > 0
    ? NEW_TIERS.filter((t) => filter.includes(t.id))
    : [...NEW_TIERS];

  if (filter && filter.length > 0) {
    console.log(`Filter active: generating only ${tiers.map((t) => t.id).join(", ")}\n`);
  }

  console.log(`Generating ${tiers.length} tier icons with Gemini 3.1 Flash Image...\n`);

  for (const tier of tiers) {
    const prompt = buildPrompt(tier);
    console.log(`[${tier.id}] Generating (theme: ${tier.theme.slice(0, 60)}...)`);

    try {
      const pngBuffer = await generateImage(prompt, REFERENCE_PATH, { resolution: "1K" });

      const webpBuffer = await sharp(pngBuffer)
        .resize(648, 444, { fit: "cover" })
        .webp({ quality: 90 })
        .toBuffer();

      const outPath = path.join(OUTPUT_DIR, `${tier.id}.webp`);
      fs.writeFileSync(outPath, webpBuffer);

      console.log(`  → saved to ${outPath} (${(webpBuffer.length / 1024).toFixed(0)} KB)\n`);
    } catch (err) {
      console.error(`  → FAILED for ${tier.id}:`, err);
      throw err;
    }
  }

  console.log("All tier icons generated successfully.");
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
