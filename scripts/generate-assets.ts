import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateImage } from "./gemini-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Prompt templates from visual-system.md
// ---------------------------------------------------------------------------

const BASE_PROMPT = `STYLE: Sticker-style illustration, bold cartoon outlines, flat solid fill (no gradient), Y2K skater/pop aesthetic, vibrant neon mint green (#00FA9A) as primary color with black outlines. Transparent background. Centered composition with 5% margin. Reference image provided: match the exact color, outline weight, and graphic energy of the reference.

DO NOT: Use minimal thin-line icons, photorealistic rendering, 3D CGI, anime/manga style, watercolor, sketch, muted colors, non-neon palettes, or backgrounds.`;

function emotionPrompt(def: EmotionDef): string {
  return `${BASE_PROMPT}

SUBJECT: A cartoon smartphone character (based on the reference logo's winged phone) expressing ${def.emotion}.

DETAILS:
- Pose: ${def.pose}
- Face expression on phone screen: ${def.expression}
- Surrounding elements: ${def.decoration}
- Energy level: ${def.energy}/10`;
}

function statePrompt(def: StateDef): string {
  return `${BASE_PROMPT}

SUBJECT: A single-scene illustration conveying "${def.state}".

DETAILS:
- Main visual: ${def.mainVisual}
- Mood: ${def.mood} (keep it friendly, not depressing)
- Key elements: ${def.keyElements}
- Composition: Balanced, readable at small sizes

NO TEXT IN THE IMAGE. The state will be communicated through translated captions in the UI.`;
}

function achievementPrompt(def: AchievementDef): string {
  return `${BASE_PROMPT}

SUBJECT: Celebration burst for achievement "${def.achievement}".

DETAILS:
- Central element: ${def.central}
- Radiating elements: ${def.radiating}
- Typography if any: ${def.text} in bold blocky condensed font, 3D effect
- Energy level: ${def.energy}/10`;
}

function decorationPrompt(def: DecorationDef): string {
  return `${BASE_PROMPT}

SUBJECT: Single decorative asset "${def.assetName}" — minimal, reusable, designed to be placed as an accent.

DETAILS:
- Shape: ${def.shapeDescription}
- Complexity: Simple enough to work at small sizes (32px minimum)
- Variations: This is variant ${def.variantNumber} of ${def.totalVariants}`;
}

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface EmotionDef {
  emotion: string;
  pose: string;
  expression: string;
  decoration: string;
  energy: number;
}

interface StateDef {
  state: string;
  mainVisual: string;
  mood: string;
  keyElements: string;
}

interface AchievementDef {
  achievement: string;
  central: string;
  radiating: string;
  text: string;
  energy: number;
}

interface DecorationDef {
  assetName: string;
  shapeDescription: string;
  variantNumber: number;
  totalVariants: number;
}

type AssetDef =
  | { category: "emotion"; def: EmotionDef }
  | { category: "state"; def: StateDef }
  | { category: "achievement"; def: AchievementDef }
  | { category: "decoration"; def: DecorationDef };

// ---------------------------------------------------------------------------
// Asset definitions
// ---------------------------------------------------------------------------

const EMOTION_DEFS: Record<string, EmotionDef> = {
  celebrate: {
    emotion: "celebration and joy",
    pose: "Wings fully spread, tilted slightly upward",
    expression: "Big smile with closed eyes, arched eyebrows",
    decoration: "Stars bursting around, radial light rays, small sparkles",
    energy: 10,
  },
  wow: {
    emotion: "surprise and amazement",
    pose: "Leaning back slightly, wings flared wide",
    expression: "Wide open eyes, mouth in a big O shape",
    decoration: "Exclamation marks, small stars popping out",
    energy: 8,
  },
  pride: {
    emotion: "pride and confidence",
    pose: "Standing tall, chest puffed out, wings half-spread",
    expression: "Smug grin, one eyebrow raised, half-closed eyes",
    decoration: "Subtle glow aura, a few sparkles",
    energy: 7,
  },
  determined: {
    emotion: "intense focus and determination",
    pose: "Leaning forward aggressively, wings angled back",
    expression: "Narrowed eyes, tight jaw, fierce look",
    decoration: "Concentration lines (speed lines) radiating from center",
    energy: 9,
  },
  "sad-but-ok": {
    emotion: "mild disappointment but still positive",
    pose: "Slightly drooping wings, small shrug",
    expression: "Watery eyes with a small smile, single sweat drop",
    decoration: "A few fading sparkles, small comforting star",
    energy: 4,
  },
  chill: {
    emotion: "relaxation and casual confidence",
    pose: "Leaning back casually, one wing folded, thumbs up",
    expression: "One eye closed in a wink, relaxed grin",
    decoration: "Small stars, peace sign vibes",
    energy: 5,
  },
  fire: {
    emotion: "burning passion and intensity",
    pose: "Dynamic forward lean, wings spread with flame shapes",
    expression: "Fierce determined eyes with fire reflected in them",
    decoration: "Flames surrounding the character, heat waves rising",
    energy: 10,
  },
  sparkle: {
    emotion: "magical excitement and wonder",
    pose: "Floating upward with wings gently spread",
    expression: "Starry eyes, open mouth smile of wonder",
    decoration: "Dense field of stars and sparkles all around",
    energy: 7,
  },
  dizzy: {
    emotion: "dizziness and disorientation",
    pose: "Tilted at an angle, wings askew",
    expression: "Spiral eyes, wobbly mouth",
    decoration: "Circling stars above head, motion swirls",
    energy: 6,
  },
  sleeping: {
    emotion: "peaceful sleeping",
    pose: "Wings folded in, slight lean to one side",
    expression: "Closed eyes, peaceful face, tiny snore bubble",
    decoration: "Zzz letters floating up, tiny stars",
    energy: 2,
  },
  confused: {
    emotion: "confusion and uncertainty",
    pose: "Head tilted, one wing up one wing down",
    expression: "One raised eyebrow, squiggly mouth",
    decoration: "Question marks floating around, swirl lines",
    energy: 5,
  },
  excited: {
    emotion: "hyper excitement and anticipation",
    pose: "Bouncing pose, wings flapping rapidly",
    expression: "Huge grin, wide sparkling eyes, sweat drops from excitement",
    decoration: "Action lines, exclamation marks, small hearts",
    energy: 9,
  },
  cool: {
    emotion: "coolness and swagger",
    pose: "Confident lean, wings folded like a cape",
    expression: "Wearing sunglasses, slight smirk",
    decoration: "Subtle sparkle on sunglasses, cool aura glow",
    energy: 6,
  },
  "thumbs-up": {
    emotion: "approval and encouragement",
    pose: "One hand giving thumbs up, wings relaxed",
    expression: "Confident smile, friendly wink",
    decoration: "Sparkle on the thumb, small approval stars",
    energy: 6,
  },
  peace: {
    emotion: "peace and friendliness",
    pose: "Peace sign with fingers, wings casually spread",
    expression: "Happy closed-eye smile, tongue slightly out",
    decoration: "Small hearts, peace symbols, gentle sparkles",
    energy: 6,
  },
};

const STATE_DEFS: Record<string, StateDef> = {
  "empty-ranking": {
    state: "No ranking data yet",
    mainVisual:
      "A confused winged phone character floating in empty space with magnifying glass",
    mood: "Friendly, nothing here yet",
    keyElements: "Small scattered stars, tumbleweed-style decoration",
  },
  "empty-history": {
    state: "No throw history yet",
    mainVisual:
      "Winged phone character looking at an empty scroll or blank page",
    mood: "Inviting, encouraging first try",
    keyElements: "Empty frame outline, small arrow pointing upward",
  },
  "empty-pb": {
    state: "No personal best recorded",
    mainVisual:
      "Winged phone character holding a blank trophy or medal outline",
    mood: "Anticipating, ready to start",
    keyElements: "Dotted outline of a trophy, small question mark stars",
  },
  "loading-video": {
    state: "Processing video",
    mainVisual:
      "Winged phone character with a loading spinner or film reel spinning around it",
    mood: "Patient, working on it",
    keyElements: "Circular loading dots, small gear icons",
  },
  "loading-initial": {
    state: "Initial loading",
    mainVisual:
      "Winged phone character stretching and yawning, getting ready",
    mood: "Waking up, energizing",
    keyElements: "Gradual sparkle build-up, warming glow",
  },
  "error-sensor": {
    state: "Sensor not available",
    mainVisual:
      "Winged phone character with a crossed-out motion sensor icon, looking puzzled",
    mood: "Helpful, suggesting a fix",
    keyElements: "Red X mark over sensor icon, question marks",
  },
  "error-network": {
    state: "Network connection failed",
    mainVisual:
      "Winged phone character tangled in a broken wifi signal or disconnected cable",
    mood: "Oops, try again",
    keyElements: "Broken signal waves, small lightning bolt of disconnection",
  },
  "error-generic": {
    state: "Something went wrong",
    mainVisual:
      "Winged phone character with bandages and a tiny wrench, fixing itself",
    mood: "Reassuring, we will fix this",
    keyElements: "Small wrench, bandage cross, apologetic sweat drop",
  },
  "permission-camera": {
    state: "Camera permission needed",
    mainVisual:
      "Winged phone character pointing at a camera icon with an encouraging gesture",
    mood: "Friendly request, please allow",
    keyElements: "Camera icon with glow, pointing hand, small sparkle",
  },
  "permission-motion": {
    state: "Motion sensor permission needed",
    mainVisual:
      "Winged phone character shaking itself to demonstrate motion, with a permission toggle icon",
    mood: "Playful demonstration",
    keyElements: "Motion wave lines, toggle switch icon, shake indicators",
  },
};

const ACHIEVEMENT_DEFS: Record<string, AchievementDef> = {
  "pb-update": {
    achievement: "Personal Best Updated",
    central: "Winged phone with radiant glow, thumbs-up hands",
    radiating: "Lightning bolts, stars, PB text banner",
    text: "PB",
    energy: 9,
  },
  "tier-up-iron": {
    achievement: "Tier Up to Iron",
    central: "Winged phone breaking through an iron shield",
    radiating: "Metal shards, sparks, upward arrows",
    text: "IRON",
    energy: 6,
  },
  "tier-up-bronze": {
    achievement: "Tier Up to Bronze",
    central: "Winged phone wearing a bronze laurel crown",
    radiating: "Bronze-tinted stars, warm sparkles",
    text: "BRONZE",
    energy: 7,
  },
  "tier-up-silver": {
    achievement: "Tier Up to Silver",
    central: "Winged phone with shimmering silver aura",
    radiating: "Silver stars, crescent moon shapes, gleaming rays",
    text: "SILVER",
    energy: 7,
  },
  "tier-up-gold": {
    achievement: "Tier Up to Gold",
    central: "Winged phone with golden crown and wings glowing",
    radiating: "Gold coins, trophy shapes, sunburst rays",
    text: "GOLD",
    energy: 8,
  },
  "tier-up-platinum": {
    achievement: "Tier Up to Platinum",
    central: "Winged phone encased in platinum crystalline glow",
    radiating: "Diamond sparkles, prismatic light rays",
    text: "PLATINUM",
    energy: 8,
  },
  "tier-up-emerald": {
    achievement: "Tier Up to Emerald",
    central: "Winged phone surrounded by emerald gem formations",
    radiating: "Green crystal shards, nature energy swirls",
    text: "EMERALD",
    energy: 9,
  },
  "tier-up-diamond": {
    achievement: "Tier Up to Diamond",
    central: "Winged phone transformed into a brilliant diamond shape",
    radiating: "Prismatic rainbow refractions, intense sparkles",
    text: "DIAMOND",
    energy: 9,
  },
  "tier-up-master": {
    achievement: "Tier Up to Master",
    central: "Winged phone with master emblem, intense power aura",
    radiating: "Lightning, cosmic energy rings, star explosions",
    text: "MASTER",
    energy: 10,
  },
  "tier-up-legend": {
    achievement: "Tier Up to Legend",
    central:
      "Winged phone ascended to godlike form, massive wings, divine halo",
    radiating:
      "Supernova burst, cascading stars, heavenly light pillars",
    text: "LEGEND",
    energy: 10,
  },
  "tier-up-rookie": {
    achievement: "Tier Up to Rookie",
    central: "Winged phone taking its first flight, small but eager",
    radiating: "Gentle sparkles, small stars, upward motion lines",
    text: "ROOKIE",
    energy: 5,
  },
  "streak-3": {
    achievement: "3-Day Streak",
    central: "Winged phone with a flame trail showing 3 days",
    radiating: "Three flame icons, streak lines, small stars",
    text: "3",
    energy: 6,
  },
  "streak-7": {
    achievement: "7-Day Streak",
    central: "Winged phone surrounded by a ring of seven flames",
    radiating: "Fire ring, intense sparkles, momentum arrows",
    text: "7",
    energy: 8,
  },
  "streak-30": {
    achievement: "30-Day Streak — Legendary Dedication",
    central:
      "Winged phone with massive blazing aura, crown of flames",
    radiating:
      "Inferno burst, golden stars, legendary badge, cosmic fire",
    text: "30",
    energy: 10,
  },
  "world-rank-update": {
    achievement: "World Rank Improved",
    central: "Winged phone standing on top of a globe",
    radiating: "Upward arrows, world map outline, ranking stars",
    text: "UP",
    energy: 8,
  },
  "country-rank-update": {
    achievement: "Country Rank Improved",
    central: "Winged phone with a flag-style banner behind it",
    radiating: "Upward arrows, country silhouette, ranking sparkles",
    text: "UP",
    energy: 7,
  },
};

const DECORATION_DEFS: Record<string, DecorationDef> = {
  "star-small": {
    assetName: "star-small",
    shapeDescription:
      "5-pointed star, slightly chunky proportions, solid fill with single highlight spot",
    variantNumber: 1,
    totalVariants: 3,
  },
  "star-medium": {
    assetName: "star-medium",
    shapeDescription:
      "5-pointed star, medium size, solid fill with highlight spot, slightly thicker outline",
    variantNumber: 2,
    totalVariants: 3,
  },
  "star-large": {
    assetName: "star-large",
    shapeDescription:
      "5-pointed star, large and bold, solid fill with bright highlight, thick black outline",
    variantNumber: 3,
    totalVariants: 3,
  },
  "sparkle-1": {
    assetName: "sparkle-1",
    shapeDescription:
      "4-pointed sparkle/twinkle shape, thin elongated points, bright center",
    variantNumber: 1,
    totalVariants: 3,
  },
  "sparkle-2": {
    assetName: "sparkle-2",
    shapeDescription:
      "6-pointed sparkle, rounder points than sparkle-1, gentle glow effect",
    variantNumber: 2,
    totalVariants: 3,
  },
  "sparkle-3": {
    assetName: "sparkle-3",
    shapeDescription:
      "8-pointed starburst sparkle, compact and dense, high contrast",
    variantNumber: 3,
    totalVariants: 3,
  },
  "burst-small": {
    assetName: "burst-small",
    shapeDescription:
      "Small explosion/starburst shape with jagged edges, compact radial burst",
    variantNumber: 1,
    totalVariants: 3,
  },
  "burst-medium": {
    assetName: "burst-medium",
    shapeDescription:
      "Medium explosion burst with dynamic jagged rays, comic book style",
    variantNumber: 2,
    totalVariants: 3,
  },
  "burst-large": {
    assetName: "burst-large",
    shapeDescription:
      "Large dramatic starburst explosion, bold jagged rays radiating outward, high energy",
    variantNumber: 3,
    totalVariants: 3,
  },
  "arrow-up": {
    assetName: "arrow-up",
    shapeDescription:
      "Bold upward-pointing arrow with chunky proportions, skater-style with slight 3D bevel",
    variantNumber: 1,
    totalVariants: 4,
  },
  "arrow-down": {
    assetName: "arrow-down",
    shapeDescription:
      "Bold downward-pointing arrow, matching arrow-up style but inverted",
    variantNumber: 2,
    totalVariants: 4,
  },
  "arrow-left": {
    assetName: "arrow-left",
    shapeDescription:
      "Bold left-pointing arrow, chunky skater-style, same weight as other arrows",
    variantNumber: 3,
    totalVariants: 4,
  },
  "arrow-right": {
    assetName: "arrow-right",
    shapeDescription:
      "Bold right-pointing arrow, chunky skater-style, same weight as other arrows",
    variantNumber: 4,
    totalVariants: 4,
  },
  "wing-left": {
    assetName: "wing-left",
    shapeDescription:
      "Single left wing, matching the reference logo's wing style exactly, feathered cartoon style",
    variantNumber: 1,
    totalVariants: 2,
  },
  "wing-right": {
    assetName: "wing-right",
    shapeDescription:
      "Single right wing, mirrored version of wing-left, matching reference logo exactly",
    variantNumber: 2,
    totalVariants: 2,
  },
  "hand-open": {
    assetName: "hand-open",
    shapeDescription:
      "Open hand with spread fingers, cartoon style matching reference logo's hand, palm facing forward",
    variantNumber: 1,
    totalVariants: 2,
  },
  "hand-closed": {
    assetName: "hand-closed",
    shapeDescription:
      "Closed fist, cartoon style matching reference logo's hand, power grip pose",
    variantNumber: 2,
    totalVariants: 2,
  },
  "speed-line-1": {
    assetName: "speed-line-1",
    shapeDescription:
      "Horizontal speed/motion lines, 3-4 parallel lines tapering to a point, manga-style action lines",
    variantNumber: 1,
    totalVariants: 2,
  },
  "speed-line-2": {
    assetName: "speed-line-2",
    shapeDescription:
      "Radial speed lines emanating from center point, concentration/focus line effect",
    variantNumber: 2,
    totalVariants: 2,
  },
  "dot-pattern": {
    assetName: "dot-pattern",
    shapeDescription:
      "Halftone dot pattern in a circular fade arrangement, retro pop-art style, dots in primary green",
    variantNumber: 1,
    totalVariants: 1,
  },
};

// ---------------------------------------------------------------------------
// Build prompt for a given category/kind
// ---------------------------------------------------------------------------

function buildPrompt(category: string, kind: string): string {
  switch (category) {
    case "emotion": {
      const def = EMOTION_DEFS[kind];
      if (!def) throw new Error(`Unknown emotion kind: ${kind}`);
      return emotionPrompt(def);
    }
    case "state": {
      const def = STATE_DEFS[kind];
      if (!def) throw new Error(`Unknown state kind: ${kind}`);
      return statePrompt(def);
    }
    case "achievement": {
      const def = ACHIEVEMENT_DEFS[kind];
      if (!def) throw new Error(`Unknown achievement kind: ${kind}`);
      return achievementPrompt(def);
    }
    case "decoration": {
      const def = DECORATION_DEFS[kind];
      if (!def) throw new Error(`Unknown decoration kind: ${kind}`);
      return decorationPrompt(def);
    }
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

// ---------------------------------------------------------------------------
// All category/kind definitions
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: Record<string, string[]> = {
  emotion: Object.keys(EMOTION_DEFS),
  state: Object.keys(STATE_DEFS),
  achievement: Object.keys(ACHIEVEMENT_DEFS),
  decoration: Object.keys(DECORATION_DEFS),
};

// ---------------------------------------------------------------------------
// Concurrency limiter (semaphore)
// ---------------------------------------------------------------------------

function createSemaphore(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function acquire(): Promise<void> {
    if (running < limit) {
      running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(resolve);
    });
  }

  function release(): void {
    running--;
    const next = queue.shift();
    if (next) {
      running++;
      next();
    }
  }

  return { acquire, release };
}

// ---------------------------------------------------------------------------
// Generation log
// ---------------------------------------------------------------------------

interface LogEntry {
  timestamp: string;
  category: string;
  kind: string;
  index: number;
  model: string;
  resolution: string;
  prompt_preview: string;
  success: boolean;
  duration_ms: number;
  output_path: string;
  file_size_bytes: number;
  error?: string;
}

function appendLog(projectRoot: string, entry: LogEntry): void {
  const logPath = path.join(projectRoot, "assets-raw", "generation-log.json");
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let entries: LogEntry[] = [];
  if (fs.existsSync(logPath)) {
    try {
      entries = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    } catch {
      entries = [];
    }
  }
  entries.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(entries, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  category?: string;
  kind?: string;
  count: number;
  resolution: "512" | "1K" | "2K" | "4K";
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { count: 10, resolution: "1K" };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--category":
        result.category = args[++i];
        break;
      case "--kind":
        result.kind = args[++i];
        break;
      case "--count":
        result.count = parseInt(args[++i], 10);
        break;
      case "--resolution":
        result.resolution = args[++i] as CliArgs["resolution"];
        break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, "..");
  const refImage = path.join(
    projectRoot,
    "public",
    "assets",
    "reference",
    "logo-hero.png"
  );
  const cliArgs = parseArgs();

  // Determine targets
  const targets: Array<{ category: string; kind: string }> = [];

  if (cliArgs.category && cliArgs.kind) {
    targets.push({ category: cliArgs.category, kind: cliArgs.kind });
  } else if (cliArgs.category) {
    const kinds = ALL_CATEGORIES[cliArgs.category];
    if (!kinds) {
      console.error(`Unknown category: ${cliArgs.category}`);
      process.exit(1);
    }
    for (const kind of kinds) {
      targets.push({ category: cliArgs.category, kind });
    }
  } else {
    console.error(
      "Usage: npx tsx scripts/generate-assets.ts --category <cat> [--kind <kind>] [--count N] [--resolution 1K]"
    );
    process.exit(1);
  }

  console.log(
    `Generating ${targets.length} kind(s) x ${cliArgs.count} images = ${targets.length * cliArgs.count} total`
  );
  console.log(`Resolution: ${cliArgs.resolution}`);
  console.log();

  const sem = createSemaphore(3);
  let successCount = 0;
  let failCount = 0;
  const failures: string[] = [];

  const tasks: Array<Promise<void>> = [];

  for (const target of targets) {
    for (let i = 1; i <= cliArgs.count; i++) {
      const idx = i;
      const { category, kind } = target;

      tasks.push(
        (async () => {
          const numStr = String(idx).padStart(3, "0");
          const outDir = path.join(projectRoot, "assets-raw", category);
          const outFile = path.join(outDir, `${kind}-${numStr}.png`);

          // Skip if already exists
          if (fs.existsSync(outFile)) {
            console.log(`  SKIP ${category}/${kind}-${numStr}.png (exists)`);
            return;
          }

          await sem.acquire();
          const start = Date.now();
          const prompt = buildPrompt(category, kind);

          try {
            console.log(
              `  GEN  ${category}/${kind}-${numStr}.png ...`
            );
            const buf = await generateImage(prompt, refImage, {
              resolution: cliArgs.resolution,
            });

            if (!fs.existsSync(outDir)) {
              fs.mkdirSync(outDir, { recursive: true });
            }
            fs.writeFileSync(outFile, buf);

            const durationMs = Date.now() - start;
            successCount++;
            console.log(
              `  OK   ${category}/${kind}-${numStr}.png (${(buf.length / 1024).toFixed(0)} KB, ${(durationMs / 1000).toFixed(1)}s)`
            );

            appendLog(projectRoot, {
              timestamp: new Date().toISOString(),
              category,
              kind,
              index: idx,
              model: "gemini-3.1-flash-image-preview",
              resolution: cliArgs.resolution,
              prompt_preview: prompt.slice(0, 200),
              success: true,
              duration_ms: durationMs,
              output_path: `assets-raw/${category}/${kind}-${numStr}.png`,
              file_size_bytes: buf.length,
            });
          } catch (err: unknown) {
            const durationMs = Date.now() - start;
            failCount++;
            const errMsg =
              err instanceof Error ? err.message : String(err);
            failures.push(`${category}/${kind}-${numStr}: ${errMsg}`);
            console.error(
              `  FAIL ${category}/${kind}-${numStr}.png: ${errMsg}`
            );

            appendLog(projectRoot, {
              timestamp: new Date().toISOString(),
              category,
              kind,
              index: idx,
              model: "gemini-3.1-flash-image-preview",
              resolution: cliArgs.resolution,
              prompt_preview: prompt.slice(0, 200),
              success: false,
              duration_ms: durationMs,
              output_path: `assets-raw/${category}/${kind}-${numStr}.png`,
              file_size_bytes: 0,
              error: errMsg,
            });
          } finally {
            sem.release();
          }
        })()
      );
    }
  }

  await Promise.all(tasks);

  // Summary
  console.log();
  console.log("=".repeat(60));
  console.log(
    `Generation complete: ${successCount}/${successCount + failCount} success, ${failCount} failed`
  );
  if (failures.length > 0) {
    console.log("Failed:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
