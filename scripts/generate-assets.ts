import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateImage } from "./gemini-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Prompt templates from visual-system.md
// ---------------------------------------------------------------------------

const BASE_PROMPT = `STYLE: Sticker-style illustration with bold black cartoon outlines, flat solid color fill (no gradient), Y2K skater/pop aesthetic. Primary color is vibrant neon mint green (#00FA9A) with black outlines. Transparent background. Centered composition with 5% margin.

DO NOT: Use thin-line icons, photorealistic rendering, 3D CGI, anime/manga style, watercolor, sketch, muted colors, or backgrounds. Do NOT draw any phones, devices, screens, human figures, characters, faces, bodies, animals, or living creatures. Express everything through abstract shapes, objects, symbols, icons, and graphic elements only.`;

function emotionPrompt(def: EmotionDef): string {
  return `${BASE_PROMPT}

SUBJECT: ${def.subject || `A bold sticker illustration expressing ${def.emotion} — NOT a phone, NOT a device`}

DETAILS:
- Pose/composition: ${def.pose}
- Expression/mood: ${def.expression}
- Surrounding elements: ${def.decoration}
- Energy level: ${def.energy}/10`;
}

function statePrompt(def: StateDef): string {
  return `${BASE_PROMPT}

SUBJECT: ${def.subject || `A sticker illustration conveying "${def.state}" — NOT a phone, NOT a device`}

DETAILS:
- Main visual: ${def.mainVisual}
- Mood: ${def.mood} (keep it friendly, not depressing)
- Key elements: ${def.keyElements}
- Composition: Balanced, readable at small sizes

NO TEXT IN THE IMAGE. Do NOT include any phone or device in the image.`;
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
  subject?: string;
  pose: string;
  expression: string;
  decoration: string;
  energy: number;
}

interface StateDef {
  state: string;
  subject?: string;
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
    subject: "A bold cartoon trophy or medal exploding with energy, surrounded by fireworks burst and confetti",
    pose: "Central trophy/medal radiating outward",
    expression: "Triumphant, victorious energy",
    decoration: "Fireworks, confetti, speed lines, stars, lightning bolts",
    energy: 10,
  },
  wow: {
    emotion: "surprise and amazement",
    subject: "A giant bold exclamation mark bursting open like a firework, with a starburst behind it",
    pose: "Central exclamation mark cracking open with rays flaring outward in all directions",
    expression: "Explosive shock energy conveyed through jagged burst lines and bright flash",
    decoration: "Exclamation marks, small stars popping out, radial shock waves",
    energy: 8,
  },
  pride: {
    emotion: "pride and confidence",
    subject: "A gleaming crown sitting atop a pedestal with a proud golden aura radiating outward",
    pose: "Crown centered on a small podium, symmetrical glow rays spreading from behind",
    expression: "Regal, self-assured warmth conveyed through steady golden glow and polished shine",
    decoration: "Subtle glow aura, a few sparkles, small laurel branches flanking the crown",
    energy: 7,
  },
  determined: {
    emotion: "intense focus and determination",
    subject: "A bullseye target with crosshairs locked dead-center, surrounded by converging energy arrows",
    pose: "Target centered with arrows and speed lines converging inward toward the bullseye",
    expression: "Laser-focused intensity conveyed through tight converging lines and a glowing red center dot",
    decoration: "Concentration lines (speed lines) radiating from center, small lightning bolts",
    energy: 9,
  },
  "sad-but-ok": {
    emotion: "mild disappointment but still positive",
    subject: "A cracked medal being repaired with gold in kintsugi style, a rain cloud above with a rainbow peeking through",
    pose: "Medal centered with golden repair lines visible, small rain cloud at top with rainbow arc emerging",
    expression: "Bittersweet resilience conveyed through the gold-filled cracks and the emerging rainbow",
    decoration: "A few fading sparkles, small comforting star, single raindrop turning into a sparkle",
    energy: 4,
  },
  chill: {
    emotion: "relaxation and casual confidence",
    subject: "A floating cloud with gentle sparkles drifting around it, shaped loosely like a hammock",
    pose: "Soft cloud shape centered and gently floating, slight upward drift with sparkles trailing below",
    expression: "Easygoing calm conveyed through soft rounded edges and gentle pastel sparkle trail",
    decoration: "Small stars, peace symbols, gentle breeze lines",
    energy: 5,
  },
  fire: {
    emotion: "burning passion and intensity",
    subject: "A blazing flame icon with an upward arrow core, engulfed in intense fire energy",
    pose: "Central flame shape towering upward with dynamic flickering edges spreading wide",
    expression: "Ferocious intensity conveyed through sharp flame tongues and deep orange-red heat glow",
    decoration: "Flames layered around the icon, heat wave distortion lines rising upward",
    energy: 10,
  },
  sparkle: {
    emotion: "magical excitement and wonder",
    subject: "A glowing crystal orb floating upward surrounded by a dense constellation of twinkling stars",
    pose: "Crystal orb centered and floating upward, surrounded by orbiting sparkle particles",
    expression: "Magical wonder conveyed through prismatic light refractions and shimmering glow",
    decoration: "Dense field of stars and sparkles all around, tiny light trails",
    energy: 7,
  },
  dizzy: {
    emotion: "dizziness and disorientation",
    subject: "A spinning compass with its needle whirling out of control, surrounded by spiral motion trails",
    pose: "Compass tilted at an angle with the needle blurred in circular motion, spiral trails around it",
    expression: "Wobbly disorientation conveyed through spiral patterns and tilted off-axis composition",
    decoration: "Circling stars orbiting the compass, motion swirl lines, small dizzy spiral icons",
    energy: 6,
  },
  sleeping: {
    emotion: "peaceful sleeping",
    subject: "A crescent moon resting on a small cloud pillow with Zzz letters floating gently upward",
    pose: "Crescent moon nestled into a fluffy cloud, tilted slightly to one side as if resting",
    expression: "Serene tranquility conveyed through soft curves, dim gentle glow, and slow-floating Zzz",
    decoration: "Zzz letters floating up, tiny dim stars, faint stardust trail",
    energy: 2,
  },
  confused: {
    emotion: "confusion and uncertainty",
    subject: "A tangled knot of arrows pointing in conflicting directions with question marks scattered around",
    pose: "Central arrow knot with paths splitting in contradictory directions, slightly tilted composition",
    expression: "Puzzled uncertainty conveyed through tangled overlapping paths and mismatched directional arrows",
    decoration: "Question marks floating around, swirl lines, small ellipsis dots",
    energy: 5,
  },
  excited: {
    emotion: "hyper excitement and anticipation",
    subject: "A coiled spring launching a star upward with explosive energy, bouncing with dynamic action lines",
    pose: "Spring compressed and releasing upward, star projectile bursting from the top with bounce arcs",
    expression: "Electrifying anticipation conveyed through kinetic bounce energy and rapid motion blur",
    decoration: "Action lines, exclamation marks, small energy sparks, speed streaks",
    energy: 9,
  },
  cool: {
    emotion: "coolness and swagger",
    subject: "A pair of bold sunglasses icon with a subtle ice-crystal shimmer and a cool mint aura behind it",
    pose: "Sunglasses centered with a slight casual tilt, cool-toned aura radiating from behind",
    expression: "Effortless swagger conveyed through reflective lens gleam and frosty shimmer effect",
    decoration: "Subtle sparkle on lens surface, cool aura glow, tiny snowflake accents",
    energy: 6,
  },
  "thumbs-up": {
    emotion: "approval and encouragement",
    subject: "A bold checkmark badge with a glowing approval seal and upward sparkle burst",
    pose: "Checkmark centered inside a circular badge, radiating small approval rays outward",
    expression: "Confident approval conveyed through a solid bold checkmark and warm green glow",
    decoration: "Sparkle on the badge edge, small approval stars, tiny plus signs",
    energy: 6,
  },
  peace: {
    emotion: "peace and friendliness",
    subject: "A peace symbol icon surrounded by gentle hearts and floating flower petals",
    pose: "Peace symbol centered with hearts and petals orbiting in a gentle circular flow",
    expression: "Warm friendliness conveyed through soft rounded shapes and pastel-tinted accents",
    decoration: "Small hearts, peace symbols, gentle sparkles, floating petal shapes",
    energy: 6,
  },
};

const STATE_DEFS: Record<string, StateDef> = {
  "empty-ranking": {
    state: "No ranking data yet — be the first!",
    subject: "A cartoon magnifying glass searching over an empty leaderboard scroll/paper, with a cute question mark floating above",
    mainVisual: "Rolled-up scroll or blank scoreboard with a magnifying glass hovering over it",
    mood: "Curious, inviting, playful emptiness",
    keyElements: "Blank scroll/paper, magnifying glass, floating question mark, tiny scattered stars",
  },
  "empty-history": {
    state: "No throw history yet",
    subject: "An empty open book or journal with blank pages and a bookmark ribbon, a small upward arrow inviting the first entry",
    mainVisual: "An open blank journal/book with empty dotted lines, a bookmark ribbon hanging off the side",
    mood: "Inviting, encouraging first try",
    keyElements: "Empty book with blank pages, dotted placeholder lines, small upward arrow, faint pencil icon",
  },
  "empty-pb": {
    state: "No personal best recorded",
    subject: "A dotted-outline trophy silhouette with a question mark inside, waiting to be filled in",
    mainVisual: "A trophy shape drawn in dashed/dotted lines (unfilled), with a glowing question mark at its center",
    mood: "Anticipating, ready to start",
    keyElements: "Dotted outline of a trophy, question mark inside, small sparkle stars around the outline",
  },
  "loading-video": {
    state: "Processing video",
    subject: "A film reel with a spinning star at its center, processing frames with circular motion lines",
    mainVisual: "A film reel icon with its frames spinning, a glowing star rotating at the hub center",
    mood: "Patient, working on it",
    keyElements: "Film reel with spinning frames, central rotating star, circular loading dots, small gear icons",
  },
  "loading-initial": {
    state: "Initial loading",
    subject: "A power-up battery icon gradually filling with glowing energy from bottom to top",
    mainVisual: "A bold battery shape with energy bars filling up progressively, sparks at the charging tip",
    mood: "Waking up, energizing",
    keyElements: "Battery icon with gradual fill, sparkle build-up at top, warming glow, small lightning bolt",
  },
  "error-sensor": {
    state: "Sensor not available",
    subject: "A broken compass or gauge dial with a bold red X mark over it",
    mainVisual: "A compass/gauge with its needle snapped and a prominent red X overlaid on top",
    mood: "Helpful, suggesting a fix",
    keyElements: "Broken gauge needle, red X mark overlay, small question marks, warning triangle accent",
  },
  "error-network": {
    state: "Network connection failed",
    subject: "A wifi signal icon with cracked/broken signal waves and a disconnected plug below",
    mainVisual: "A wifi symbol with fractured signal arcs breaking apart, an unplugged cable dangling below",
    mood: "Oops, try again",
    keyElements: "Broken wifi signal arcs, disconnected plug icon, small lightning bolt of disconnection",
  },
  "error-generic": {
    state: "Something went wrong",
    subject: "A wrench crossed with a screwdriver over a gear icon, with a small bandage patch on the gear",
    mainVisual: "A gear icon with a bandage cross on it, a wrench and screwdriver crossed behind it in an X pattern",
    mood: "Reassuring, we will fix this",
    keyElements: "Gear with bandage patch, crossed wrench and screwdriver, small sorry-style sweat drop accent",
  },
  "permission-camera": {
    state: "Camera permission needed",
    subject: "A camera lens icon with a lock symbol overlaid, and a glowing unlock arrow pointing to the lock",
    mainVisual: "A bold camera lens shape with a padlock at its center, a curved arrow suggesting unlocking action",
    mood: "Friendly request, please allow",
    keyElements: "Camera lens icon, lock symbol, unlock arrow, small sparkle glow around the lens",
  },
  "permission-motion": {
    state: "Motion sensor permission needed",
    subject: "A gyroscope/motion sensor icon with wave ripples emanating outward, and a toggle switch set to ON",
    mainVisual: "A gyroscope or accelerometer icon emitting concentric motion waves, with a toggle switch icon beside it",
    mood: "Playful demonstration",
    keyElements: "Gyroscope/sensor icon, concentric motion wave lines, toggle switch icon, shake indicator arrows",
  },
};

const ACHIEVEMENT_DEFS: Record<string, AchievementDef> = {
  "pb-update": {
    achievement: "Personal Best Updated",
    central: "A glowing crown or medal with upward arrow breaking through a ceiling",
    radiating: "Lightning bolts, explosion lines, stars, fireworks burst",
    text: "PB",
    energy: 9,
  },
  "tier-up-iron": {
    achievement: "Tier Up to Iron",
    central: "Glowing emblem breaking through an iron shield",
    radiating: "Metal shards, sparks, upward arrows",
    text: "IRON",
    energy: 6,
  },
  "tier-up-bronze": {
    achievement: "Tier Up to Bronze",
    central: "Glowing emblem wearing a bronze laurel crown",
    radiating: "Bronze-tinted stars, warm sparkles",
    text: "BRONZE",
    energy: 7,
  },
  "tier-up-silver": {
    achievement: "Tier Up to Silver",
    central: "Glowing emblem with shimmering silver aura",
    radiating: "Silver stars, crescent moon shapes, gleaming rays",
    text: "SILVER",
    energy: 7,
  },
  "tier-up-gold": {
    achievement: "Tier Up to Gold",
    central: "Glowing emblem with golden crown and rays glowing",
    radiating: "Gold coins, trophy shapes, sunburst rays",
    text: "GOLD",
    energy: 8,
  },
  "tier-up-platinum": {
    achievement: "Tier Up to Platinum",
    central: "Glowing emblem encased in platinum crystalline glow",
    radiating: "Diamond sparkles, prismatic light rays",
    text: "PLATINUM",
    energy: 8,
  },
  "tier-up-emerald": {
    achievement: "Tier Up to Emerald",
    central: "Glowing emblem surrounded by emerald gem formations",
    radiating: "Green crystal shards, nature energy swirls",
    text: "EMERALD",
    energy: 9,
  },
  "tier-up-diamond": {
    achievement: "Tier Up to Diamond",
    central: "Glowing emblem transformed into a brilliant diamond shape",
    radiating: "Prismatic rainbow refractions, intense sparkles",
    text: "DIAMOND",
    energy: 9,
  },
  "tier-up-master": {
    achievement: "Tier Up to Master",
    central: "Glowing emblem with master emblem, intense power aura",
    radiating: "Lightning, cosmic energy rings, star explosions",
    text: "MASTER",
    energy: 10,
  },
  "tier-up-legend": {
    achievement: "Tier Up to Legend",
    central:
      "Glowing emblem ascended to godlike form, massive rays, divine halo",
    radiating:
      "Supernova burst, cascading stars, heavenly light pillars",
    text: "LEGEND",
    energy: 10,
  },
  "tier-up-rookie": {
    achievement: "Tier Up to Rookie",
    central: "Glowing emblem taking its first flight, small but eager",
    radiating: "Gentle sparkles, small stars, upward motion lines",
    text: "ROOKIE",
    energy: 5,
  },
  "streak-3": {
    achievement: "3-Day Streak",
    central: "Glowing emblem with a flame trail showing 3 days",
    radiating: "Three flame icons, streak lines, small stars",
    text: "3",
    energy: 6,
  },
  "streak-7": {
    achievement: "7-Day Streak",
    central: "Glowing emblem surrounded by a ring of seven flames",
    radiating: "Fire ring, intense sparkles, momentum arrows",
    text: "7",
    energy: 8,
  },
  "streak-30": {
    achievement: "30-Day Streak — Legendary Dedication",
    central:
      "Glowing emblem with massive blazing aura, crown of flames",
    radiating:
      "Inferno burst, golden stars, legendary badge, cosmic fire",
    text: "30",
    energy: 10,
  },
  "world-rank-update": {
    achievement: "World Rank Improved",
    central: "Glowing emblem standing on top of a globe",
    radiating: "Upward arrows, world map outline, ranking stars",
    text: "UP",
    energy: 8,
  },
  "country-rank-update": {
    achievement: "Country Rank Improved",
    central: "Glowing emblem with a flag-style banner behind it",
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
              skipReference: true, // Don't send logo — prevents Gemini from copying the phone subject
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
