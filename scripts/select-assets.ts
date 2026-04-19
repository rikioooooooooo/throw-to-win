import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4567;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(PROJECT_ROOT, "assets-raw");
const FINAL_DIR = path.join(PROJECT_ROOT, "public", "assets", "final");

// ---------------------------------------------------------------------------
// Scan available assets
// ---------------------------------------------------------------------------

interface AssetEntry {
  category: string;
  kind: string;
  files: string[];
  selected: boolean;
}

function scanAssets(): AssetEntry[] {
  const entries: AssetEntry[] = [];

  if (!fs.existsSync(RAW_DIR)) {
    return entries;
  }

  const categories = fs
    .readdirSync(RAW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const catDir = path.join(RAW_DIR, category);
    const files = fs
      .readdirSync(catDir)
      .filter((f) => f.endsWith(".png"))
      .sort();

    // Group by kind (everything before the last -NNN.png)
    const kindMap = new Map<string, string[]>();
    for (const file of files) {
      const match = file.match(/^(.+)-\d{3}\.png$/);
      if (match) {
        const kind = match[1];
        const existing = kindMap.get(kind) ?? [];
        existing.push(file);
        kindMap.set(kind, existing);
      }
    }

    for (const [kind, kindFiles] of kindMap) {
      const finalPath = path.join(FINAL_DIR, category, `${kind}.png`);
      entries.push({
        category,
        kind,
        files: kindFiles,
        selected: fs.existsSync(finalPath),
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function indexPage(entries: AssetEntry[]): string {
  const categoryMap = new Map<string, AssetEntry[]>();
  for (const e of entries) {
    const existing = categoryMap.get(e.category) ?? [];
    existing.push(e);
    categoryMap.set(e.category, existing);
  }

  let listHtml = "";
  for (const [category, items] of categoryMap) {
    listHtml += `<h2>${category} (${items.length} kinds)</h2><ul>`;
    for (const item of items) {
      const badge = item.selected
        ? ' <span style="color:#00fa9a;font-weight:bold">[SELECTED]</span>'
        : "";
      listHtml += `<li><a href="/?category=${category}&kind=${item.kind}">${item.kind}</a> (${item.files.length} candidates)${badge}</li>`;
    }
    listHtml += "</ul>";
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Asset Selector — Throw To Win</title>
<style>
  body { background: #0a0a0f; color: #e0e0e0; font-family: system-ui, sans-serif; padding: 2rem; }
  a { color: #00fa9a; }
  h1 { color: #00fa9a; }
  h2 { color: #4dffbc; margin-top: 2rem; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.3rem 0; }
</style>
</head>
<body>
<h1>Asset Selector</h1>
<p>Click a kind to view candidates and select the best one.</p>
${listHtml}
</body>
</html>`;
}

function gridPage(
  category: string,
  kind: string,
  files: string[],
  isSelected: boolean
): string {
  let gridHtml = "";
  for (const file of files) {
    gridHtml += `
    <div class="card" data-file="${file}">
      <img src="/raw/${category}/${file}" alt="${file}" loading="lazy">
      <div class="label">${file}</div>
      <button class="select-btn" onclick="selectAsset('${category}','${kind}','${file}')">Select</button>
    </div>`;
  }

  const selectedBadge = isSelected
    ? `<div class="selected-badge">Current selection exists in final/</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${category}/${kind} — Asset Selector</title>
<style>
  body { background: #0a0a0f; color: #e0e0e0; font-family: system-ui, sans-serif; padding: 2rem; }
  a { color: #00fa9a; }
  h1 { color: #00fa9a; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
  .card {
    background: #111; border: 2px solid #333; border-radius: 12px; padding: 1rem;
    display: flex; flex-direction: column; align-items: center; transition: border-color 0.2s;
  }
  .card:hover { border-color: #00fa9a; }
  .card img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #000; border-radius: 8px; }
  .label { margin-top: 0.5rem; font-size: 0.85rem; color: #888; }
  .select-btn {
    margin-top: 0.75rem; padding: 0.5rem 1.5rem; background: #00fa9a; color: #000;
    border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.9rem;
  }
  .select-btn:hover { background: #4dffbc; }
  .selected-badge { background: #00fa9a; color: #000; padding: 0.5rem 1rem; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 1rem; }
  .feedback { position: fixed; top: 2rem; right: 2rem; background: #00fa9a; color: #000; padding: 1rem 2rem; border-radius: 8px; font-weight: bold; font-size: 1.1rem; display: none; z-index: 100; }
  .back { margin-bottom: 1rem; display: inline-block; }
</style>
</head>
<body>
<a href="/" class="back">Back to index</a>
<h1>${category} / ${kind}</h1>
${selectedBadge}
<div class="grid">${gridHtml}</div>
<div class="feedback" id="feedback">Selected!</div>
<script>
async function selectAsset(category, kind, file) {
  const res = await fetch('/api/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, kind, file })
  });
  if (res.ok) {
    const fb = document.getElementById('feedback');
    fb.style.display = 'block';
    setTimeout(() => { fb.style.display = 'none'; }, 2000);
  } else {
    alert('Selection failed: ' + (await res.text()));
  }
}
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Serve raw assets
  app.use("/raw", express.static(RAW_DIR));

  // Main page
  app.get("/", (req, res) => {
    const { category, kind } = req.query as {
      category?: string;
      kind?: string;
    };

    const entries = scanAssets();

    if (category && kind) {
      const entry = entries.find(
        (e) => e.category === category && e.kind === kind
      );
      if (!entry) {
        res.status(404).send("Kind not found");
        return;
      }
      res.send(gridPage(category, kind, entry.files, entry.selected));
      return;
    }

    res.send(indexPage(entries));
  });

  // Select API
  app.post("/api/select", async (req, res) => {
    const { category, kind, file } = req.body as {
      category: string;
      kind: string;
      file: string;
    };

    if (!category || !kind || !file) {
      res.status(400).send("Missing category, kind, or file");
      return;
    }

    const srcPath = path.join(RAW_DIR, category, file);
    if (!fs.existsSync(srcPath)) {
      res.status(404).send("Source file not found");
      return;
    }

    const destDir = path.join(FINAL_DIR, category);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, `${kind}.png`);

    try {
      // Optimize with sharp: resize if >1024px, optimize PNG
      const metadata = await sharp(srcPath).metadata();
      let pipeline = sharp(srcPath);

      const maxDim = Math.max(metadata.width ?? 0, metadata.height ?? 0);
      if (maxDim > 1024) {
        pipeline = pipeline.resize(1024, 1024, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      await pipeline
        .png({ compressionLevel: 9, effort: 10 })
        .toFile(destPath);

      console.log(`Selected: ${category}/${kind} <- ${file}`);
      res.json({ ok: true, path: destPath });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Selection failed: ${msg}`);
      res.status(500).send(msg);
    }
  });

  app.listen(PORT, () => {
    console.log(`Asset Selector running at http://localhost:${PORT}`);
    console.log(`Raw assets: ${RAW_DIR}`);
    console.log(`Final output: ${FINAL_DIR}`);
    console.log();
    console.log("Open the URL in your browser to select assets.");
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
