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
// Japanese descriptions for each asset
// ---------------------------------------------------------------------------

const CATEGORY_NAMES: Record<string, string> = {
  emotion: "感情表現系",
  state: "状態系",
  achievement: "達成系",
  decoration: "装飾系",
};

const KIND_DESCRIPTIONS: Record<string, Record<string, string>> = {
  emotion: {
    celebrate: "歓喜 — 自己ベスト更新・ティア昇格時のリアクション",
    wow: "驚き — すごい高さが出た時",
    pride: "誇り — 安定して良い記録を出した時",
    determined: "集中 — 投げる前の画面、気合い",
    "sad-but-ok": "惜しい — PB逃した時のリアクション",
    chill: "リラックス — 通常の結果画面",
    fire: "燃える — 連続PB更新中",
    sparkle: "キラキラ — ティア昇格時",
    dizzy: "めまい — センサーエラー時",
    sleeping: "居眠り — 待機画面",
    confused: "困惑 — エラー時",
    excited: "興奮 — 高い記録が出た時",
    cool: "クール — 上位ランク",
    "thumbs-up": "承認 — 投げ成功",
    peace: "ピース — シェア時",
  },
  state: {
    "empty-ranking": "ランキングが空 — まだ誰もいない時",
    "empty-history": "投擲履歴なし — マイページの空状態",
    "empty-pb": "PBなし — まだ記録がない時",
    "loading-video": "動画処理中 — ffmpegスローモ処理",
    "loading-initial": "初回ロード — アプリ起動時",
    "error-sensor": "センサーエラー — 加速度センサーが使えない",
    "error-network": "通信エラー — ネットワーク接続失敗",
    "error-generic": "エラー — その他のエラー",
    "permission-camera": "カメラ許可待ち — 許可ダイアログ前",
    "permission-motion": "モーション許可待ち — 許可ダイアログ前",
  },
  achievement: {
    "pb-update": "自己ベスト更新 — PB更新時のバッジ",
    "tier-up-rookie": "ルーキー昇格",
    "tier-up-iron": "アイアン昇格",
    "tier-up-bronze": "ブロンズ昇格",
    "tier-up-silver": "シルバー昇格",
    "tier-up-gold": "ゴールド昇格",
    "tier-up-platinum": "プラチナ昇格",
    "tier-up-emerald": "エメラルド昇格",
    "tier-up-diamond": "ダイヤモンド昇格",
    "tier-up-master": "マスター昇格",
    "tier-up-legend": "レジェンド昇格",
    "streak-3": "3日連続投げ達成",
    "streak-7": "7日連続投げ達成",
    "streak-30": "30日連続投げ達成（特別）",
    "world-rank-update": "世界ランク上昇",
    "country-rank-update": "国内ランク上昇",
  },
  decoration: {
    "star-small": "小さい星 — 装飾用",
    "star-medium": "中くらいの星 — 装飾用",
    "star-large": "大きい星 — 装飾用",
    "sparkle-1": "キラキラ1 — 形違い装飾",
    "sparkle-2": "キラキラ2 — 形違い装飾",
    "sparkle-3": "キラキラ3 — 形違い装飾",
    "burst-small": "小さい爆発 — 光線エフェクト",
    "burst-medium": "中くらいの爆発",
    "burst-large": "大きい爆発",
    "arrow-up": "上向き矢印",
    "arrow-down": "下向き矢印",
    "arrow-left": "左向き矢印",
    "arrow-right": "右向き矢印",
    "wing-left": "左翼パーツ",
    "wing-right": "右翼パーツ",
    "hand-open": "開いた手パーツ",
    "hand-closed": "閉じた手パーツ",
    "speed-line-1": "集中線1",
    "speed-line-2": "集中線2",
    "dot-pattern": "ドットパターン",
  },
};

function getDescription(category: string, kind: string): string {
  return KIND_DESCRIPTIONS[category]?.[kind] ?? kind;
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
    const catName = CATEGORY_NAMES[category] ?? category;
    listHtml += `<h2>${catName}（${items.length}種）</h2><ul>`;
    for (const item of items) {
      const desc = getDescription(category, item.kind);
      const badge = item.selected
        ? ' <span style="color:#00fa9a;font-weight:bold">✓ 選別済み</span>'
        : "";
      listHtml += `<li><a href="/?category=${category}&kind=${item.kind}">${desc}</a>（${item.files.length}候補）${badge}</li>`;
    }
    listHtml += "</ul>";
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>アセット選別 — Throw To Win</title>
<style>
  body { background: #0a0a0f; color: #e0e0e0; font-family: system-ui, sans-serif; padding: 2rem; }
  a { color: #00fa9a; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { color: #00fa9a; }
  h2 { color: #4dffbc; margin-top: 2rem; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.4rem 0; font-size: 15px; }
</style>
</head>
<body>
<h1>アセット選別</h1>
<p>クリックして候補一覧を表示。ベストな1枚を選んでください。</p>
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
      <button class="select-btn" onclick="selectAsset('${category}','${kind}','${file}')">これを採用</button>
    </div>`;
  }

  const desc = getDescription(category, kind);
  const catName = CATEGORY_NAMES[category] ?? category;
  const selectedBadge = isSelected
    ? `<div class="selected-badge">✓ 選別済み（再選択で上書き可能）</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${desc} — アセット選別</title>
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
<a href="/" class="back">← 一覧に戻る</a>
<h1>${catName} / ${desc}</h1>
${selectedBadge}
<div class="grid">${gridHtml}</div>
<div class="feedback" id="feedback">採用しました！</div>
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
    alert('採用に失敗しました: ' + (await res.text()));
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
