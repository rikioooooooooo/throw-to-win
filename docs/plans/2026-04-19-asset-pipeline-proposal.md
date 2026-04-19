# アセットパイプライン — Phase 0 提案書

作成日: 2026-04-19
作成者: Claude Opus 4.6

---

## 目次

- [0-1. Layer 1 整合性確認](#0-1-layer-1-整合性確認)
- [0-2. package.json 追加依存](#0-2-packagejson-追加依存)
- [0-3. ディレクトリ構造](#0-3-ディレクトリ構造)
- [0-4. スクリプトアーキテクチャ](#0-4-スクリプトアーキテクチャ)
- [0-5. レート制限・エラー処理](#0-5-レート制限エラー処理)
- [0-6. コスト見積](#0-6-コスト見積)

---

## 0-1. Layer 1 整合性確認

`docs/design/visual-system.md` を全文読み、以下を検証した。

### カテゴリ・枚数

| カテゴリ | 推定枚数 | 種別数(実数) | 状態 |
|----------|---------|-------------|------|
| Emotion(感情表現系) | 15 | 15（celebrate, wow, pride, determined, sad-but-ok, chill, fire, sparkle, dizzy, sleeping, confused, excited, cool, thumbs-up, peace） | 一致 |
| State(状態系) | 10 | 10（empty-ranking, empty-history, empty-pb, loading-video, loading-initial, error-sensor, error-network, error-generic, permission-camera, permission-motion） | 一致 |
| Achievement(達成系) | 15 | 15（pb-update, tier-up x10, streak-3, streak-7, streak-30, world-rank-update, country-rank-update） | 一致 |
| Decoration(装飾系) | 20 | 20（star x3, sparkle x3, burst x3, arrow x4, wing x2, hand x2, speed-line x2, dot-pattern） | 一致 |
| **合計** | **60** | **60** | **一致** |

Achievement の `tier-up-{tier}` は 10 段階（rookie, iron, bronze, silver, gold, platinum, emerald, diamond, master, legend）で 10 枚。これに pb-update, streak x3, world-rank-update, country-rank-update を加えて 15 枚。計算一致。

### プロンプトテンプレート確認

| テンプレート | 確認事項 | 状態 |
|------------|---------|------|
| 世界観ベース（SS4-1） | 全生成で共通使用。カラー・スタイル・禁忌が明記。OUTPUT 指定あり | OK |
| 感情表現系（SS4-2） | `{EMOTION}`, `{POSE}`, `{EXPRESSION}`, `{DECORATION}`, `{ENERGY}` の 5 変数。celebrate の具体例あり | OK |
| 状態系（SS4-3） | `{STATE}`, `{MAIN_VISUAL}`, `{MOOD}`, `{KEY_ELEMENTS}` の 4 変数。`NO TEXT IN THE IMAGE` 指示あり | OK |
| 達成系（SS4-4） | `{ACHIEVEMENT}`, `{CENTRAL}`, `{RADIATING}`, `{TEXT}`, `{ENERGY}` の 5 変数 | OK |
| 装飾系（SS4-5） | `{ASSET_NAME}`, `{SHAPE_DESCRIPTION}`, `{VARIANT_NUMBER}`, `{TOTAL_VARIANTS}` の 4 変数 | OK |

**不明瞭な箇所**: なし。各テンプレートは変数名とサンプル値が明確に定義されている。ただし、60 種別全てのプロンプト変数値（各種別の `{POSE}`, `{EXPRESSION}` 等）は Layer 1 には celebrate 等の例しかない。Phase 1 実装時に Claude Code が種別ごとに適切な値を生成する想定。

### リファレンス画像

| パス | 存在 | サイズ | 備考 |
|------|------|--------|------|
| `public/assets/reference/logo-hero.png` | あり | 656 KB | 翼つきスマホ + 手 + 光線。Gemini API へ参照画像として添付可能 |

Layer 1 SS1-4 に「こすくまくんアセットが `public/` 配下にあれば副参照として追加」とあるが、現時点で該当アセットは未配置。必要に応じて Riki に追加配置を依頼する。

### 結論

Layer 1 は完全で、実装に不足する情報はない。Phase 1 着手可能。

---

## 0-2. package.json 追加依存

### 現状の確認

| パッケージ | 現在の package.json | 必要性 |
|-----------|-------------------|--------|
| `@google/genai` | **未インストール** | 必須 — Gemini API 呼び出し |
| `dotenv` | 未インストール | **不要** — Next.js が `.env.local` を自動読み込み。ただしスクリプト単体実行時は `--env-file` フラグ or `tsx` の `--require` で対処可能 |
| `sharp` | 未インストール | 推奨 — 透過チェック・リサイズ・PNG 最適化 |
| `tsx` | 未インストール | 推奨 — スクリプト実行用 TypeScript ランナー |

### 追加提案

```jsonc
// devDependencies に追加
{
  "@google/genai": "^1.40.0",     // Gemini API SDK（スクリプト専用、本番バンドルに含めない）
  "express": "^5.1.0",            // 選別 Web UI サーバー（スクリプト専用）
  "sharp": "^0.33.0",             // PNG 透過チェック・最適化
  "tsx": "^4.19.0"                // TypeScript スクリプト実行（generate/select/catalog）
}
```

**devDependencies にする根拠**: これらは全てアセット生成ツール用であり、本番の Next.js アプリには不要。`next build` のバンドルサイズに影響しない。

### Vectorize（SVG 化）について

**推奨: Phase 1 では PNG のまま運用する。SVG 化は保留。**

根拠:
- 自動 SVG トレース（potrace, imagetracerjs）はステッカー調イラストの品質が低い。太い輪郭線・ベタ塗りのカートゥーン調は色境界が多く、自動トレースでアーティファクトが発生しやすい
- 有料 SaaS（vectorizer.ai 等）は品質が高いが、パイプラインに外部依存を持ち込む
- PNG を `sharp` で最適化（WebP 変換、適切なリサイズ）すれば、1024px の PNG でもファイルサイズは 50-150 KB 程度に収まる
- Layer 1 SS2-3 で 1024x1024 を指定しており、UI 上では 128-256px 程度で表示される。PNG で十分

したがって `vectorize.ts` スクリプトは「PNG 最適化 + WebP 変換」に置き換える。SVG 化が必要になった場合は Phase 2 以降で再検討する。

### 不要と判断したパッケージ

| パッケージ | 理由 |
|-----------|------|
| `dotenv` | スクリプト実行時は `tsx --env-file=.env.local` で対応。依存追加不要 |
| `potrace` / `imagetracerjs` | 上記 Vectorize 判断により不要 |
| `svgo` | SVG 化保留により不要 |
| `commander` | スクリプト引数は `process.argv` の簡易パースで十分。60 種別程度なら複雑な CLI フレームワーク不要 |

---

## 0-3. ディレクトリ構造

### 課題

Layer 1 SS6-1 では raw 候補を `public/assets/generated/` に配置する案が記載されているが、`public/` 配下は Next.js ビルド時に全てバンドル対象となる。60 種別 x 10 枚 = 600 枚の raw PNG（約 400 MB）がバンドルに含まれるのは不適切。

### 確定構造

```
throw-to-win/
├── assets-raw/                          # git 除外。生成候補の一時保管
│   ├── emotion/
│   │   ├── celebrate-001.png
│   │   ├── celebrate-002.png
│   │   └── ...
│   ├── state/
│   ├── achievement/
│   ├── decoration/
│   └── generation-log.json              # 生成ログ（プロンプト・コスト・成否）
│
├── public/
│   └── assets/
│       ├── reference/
│       │   └── logo-hero.png            # 既存。Gemini 参照画像
│       └── final/                       # Riki 選別済み + 最適化済みのみ
│           ├── emotion/
│           │   ├── celebrate.png
│           │   ├── celebrate.webp
│           │   └── ...
│           ├── state/
│           ├── achievement/
│           └── decoration/
│
├── scripts/
│   ├── asset-utils/
│   │   ├── gemini-client.ts             # Gemini API ラッパー
│   │   ├── prompt-builder.ts            # Layer 1 テンプレート展開
│   │   └── logger.ts                    # 生成ログ管理
│   ├── generate-assets.ts               # 生成 CLI
│   ├── select-assets.ts                 # 選別 Web サーバー
│   ├── optimize-assets.ts               # PNG 最適化 + WebP 変換
│   └── build-catalog.ts                 # カタログ自動生成
│
└── src/
    └── assets-catalog.ts                # 自動生成。手編集禁止
```

### .gitignore 追加

```gitignore
# Asset pipeline raw candidates (not for production)
/assets-raw/
```

根拠: `assets-raw/` はプロジェクトルート直下に置く。`public/` 外なので Next.js ビルドに影響しない。`.env*` は既に `.gitignore` に登録済み（`.env*` パターンで `.env.local` もカバー）。

---

## 0-4. スクリプトアーキテクチャ

### 共通基盤

#### `scripts/asset-utils/gemini-client.ts`

**責務**: Gemini API の薄いラッパー。画像生成リクエストの送信・レスポンスのバイナリ保存。

```
generateImage(prompt: string, referenceImagePath: string, options?: {
  resolution?: '512' | '1K' | '2K' | '4K';  // デフォルト '1K'
  outputPath: string;
}): Promise<{ success: boolean; path: string; durationMs: number }>
```

- モデル: `gemini-3.1-flash-image-preview`（Nano Banana 2）固定
- 参照画像: `logo-hero.png` をバイナリ読み込みして API リクエストに添付
- API キー: `process.env.GOOGLE_API_KEY`（`.env.local` から読み込み）
- 未設定時エラー: `Error: GOOGLE_API_KEY is not set. Create .env.local with your API key.`

#### `scripts/asset-utils/prompt-builder.ts`

**責務**: Layer 1 のプロンプトテンプレートを種別ごとに展開する。

- 世界観ベースプロンプト（SS4-1）を全リクエストの先頭に付与
- カテゴリ別テンプレート（SS4-2〜4-5）に変数を埋め込み
- 60 種別全ての変数値をハードコードした定義オブジェクトを持つ

#### `scripts/asset-utils/logger.ts`

**責務**: `assets-raw/generation-log.json` への追記。

記録する項目: タイムスタンプ、カテゴリ、種別、連番、プロンプト（先頭 200 文字）、モデル ID、解像度、成否、所要時間 ms、エラー内容（失敗時）。

---

### スクリプト 1: `scripts/generate-assets.ts`

**責務**: Gemini API を叩いて raw 候補画像を生成し、`assets-raw/` に保存。

**CLI 使用例**:

```bash
# 特定の種別を 10 枚生成
npx tsx --env-file=.env.local scripts/generate-assets.ts --category emotion --kind celebrate --count 10

# 特定カテゴリの全種別を 10 枚ずつ生成
npx tsx --env-file=.env.local scripts/generate-assets.ts --category emotion --count 10

# 全カテゴリ全種別を 10 枚ずつ生成（本番生成用）
npx tsx --env-file=.env.local scripts/generate-assets.ts --all --count 10

# 2K 解像度で生成（Achievement 系の細部確認用）
npx tsx --env-file=.env.local scripts/generate-assets.ts --category achievement --kind pb-update --count 5 --resolution 2K
```

**処理フロー**:
1. 引数パース（`--category`, `--kind`, `--count`, `--resolution`, `--all`）
2. 対象種別のプロンプトを `prompt-builder.ts` で展開
3. `gemini-client.ts` で並列生成（並列数は SS0-5 で定義）
4. 結果を `assets-raw/{category}/{kind}-{NNN}.png` に保存
5. `generation-log.json` に記録
6. 完了サマリーを標準出力（成功数 / 失敗数 / 合計コスト概算）

**package.json 登録**:
```json
"assets:generate": "tsx --env-file=.env.local scripts/generate-assets.ts"
```

---

### スクリプト 2: `scripts/select-assets.ts`

**責務**: ローカル Web サーバーを起動し、Riki が候補画像をグリッド表示で比較・選別できる UI を提供。

**推奨形式: ローカル Web サーバー（express + 静的 HTML）**

CLI でのプレビューは画像の比較に不向き。ブラウザベースのグリッド表示が UX 上圧倒的に優れる。

**CLI 使用例**:

```bash
# 選別 UI を起動（全カテゴリ表示）
npx tsx scripts/select-assets.ts

# 特定カテゴリのみ表示
npx tsx scripts/select-assets.ts --category emotion

# ポート指定
npx tsx scripts/select-assets.ts --port 4567
```

**処理フロー**:
1. express サーバーを起動（デフォルト `http://localhost:4567`）
2. `assets-raw/` を静的ファイルとして配信
3. HTML ページでカテゴリ別のグリッド表示
   - 各種別ごとに候補画像を横並び表示
   - 黒背景プレビュー（透過確認用）
   - 既に `public/assets/final/` に選別済みのものは緑枠で表示
4. 画像クリックで「採用」→ API エンドポイント経由で `public/assets/final/{category}/{kind}.png` にコピー
5. 右クリック or Shift+クリックで「却下」（raw 側に残す、UI 上でグレーアウト）
6. 選別状態を `assets-raw/selection-state.json` に保存（サーバー再起動後も維持）

express は SS0-2 の依存一覧に含めた（devDependencies）。Node.js 標準の `http` モジュールでも実装可能だが、ルーティング・静的配信・JSON パースを考慮すると express の方が開発効率が高い。

**package.json 登録**:
```json
"assets:select": "tsx scripts/select-assets.ts"
```

---

### スクリプト 3: `scripts/optimize-assets.ts`

**責務**: 選別済み PNG を `sharp` で最適化し、WebP 版も生成。

Layer 2 原文では `vectorize.ts`（SVG 化）だが、SS0-2 で述べた理由により PNG 最適化 + WebP 変換に変更。

**CLI 使用例**:

```bash
# 全選別済みアセットを最適化
npx tsx scripts/optimize-assets.ts

# 特定カテゴリのみ
npx tsx scripts/optimize-assets.ts --category emotion

# 特定アセットのみ
npx tsx scripts/optimize-assets.ts --category emotion --kind celebrate
```

**処理フロー**:
1. `public/assets/final/` 配下の PNG を走査
2. `sharp` で以下を実行:
   - PNG 最適化（メタデータ除去、パレット最適化）
   - WebP 変換（品質 90、透過維持）
   - 最大辺 512px にリサイズ（UI 表示サイズに十分、バンドルサイズ削減）
3. 元の PNG と WebP を並置: `celebrate.png` + `celebrate.webp`
4. サイズ削減レポートを標準出力

**package.json 登録**:
```json
"assets:optimize": "tsx scripts/optimize-assets.ts"
```

---

### スクリプト 4: `scripts/build-catalog.ts`

**責務**: `public/assets/final/` を走査し、`src/assets-catalog.ts` を自動生成。

**CLI 使用例**:

```bash
npx tsx scripts/build-catalog.ts
```

**処理フロー**:
1. `public/assets/final/**/*.{png,webp}` をグロブで走査
2. カテゴリ > 種別 の階層でオブジェクトを構築
3. `src/assets-catalog.ts` を書き出し:

```ts
// Auto-generated by scripts/build-catalog.ts — DO NOT EDIT
export const ASSET_CATALOG = {
  emotion: {
    celebrate: "/assets/final/emotion/celebrate.webp",
    wow: "/assets/final/emotion/wow.webp",
    // ...
  },
  state: { /* ... */ },
  achievement: { /* ... */ },
  decoration: { /* ... */ },
} as const;

export type EmotionAsset = keyof typeof ASSET_CATALOG.emotion;
export type StateAsset = keyof typeof ASSET_CATALOG.state;
export type AchievementAsset = keyof typeof ASSET_CATALOG.achievement;
export type DecorationAsset = keyof typeof ASSET_CATALOG.decoration;
export type AssetCategory = keyof typeof ASSET_CATALOG;
```

4. WebP が存在すれば WebP パスを優先、なければ PNG パスを使用
5. 出力後 `npx tsc --noEmit` で型チェック

**package.json 登録**:
```json
"assets:catalog": "tsx scripts/build-catalog.ts"
```

---

### package.json scripts まとめ

```json
{
  "assets:generate": "tsx --env-file=.env.local scripts/generate-assets.ts",
  "assets:select": "tsx scripts/select-assets.ts",
  "assets:optimize": "tsx scripts/optimize-assets.ts",
  "assets:catalog": "tsx scripts/build-catalog.ts"
}
```

---

## 0-5. レート制限・エラー処理

### 並列実行

| 項目 | 値 | 根拠 |
|------|---|------|
| 同時並列数 | **3** | Gemini API の Free Tier は 10 RPM。有料プランでも安全マージンを取る。3 並列 x 20 秒/枚 = 9 RPM で収まる |
| キュー方式 | Promise ベースの簡易セマフォ | 外部キューライブラリ不要。`Promise.all` + スロットプールで実装 |

### リトライポリシー

| 項目 | 値 |
|------|---|
| 最大リトライ回数 | 3 |
| バックオフ | 指数バックオフ: 2 秒 → 4 秒 → 8 秒 |
| リトライ対象 | HTTP 429 (Rate Limit), 500, 502, 503, ETIMEDOUT, ECONNRESET |
| リトライ非対象 | HTTP 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden) — これらは即失敗 |

### タイムアウト

| 項目 | 値 | 根拠 |
|------|---|------|
| 1 リクエストタイムアウト | 60 秒 | Layer 2 指定通り。画像生成は通常 10-30 秒 |
| 全体タイムアウト | なし | バッチ処理のため全体制限は設けない |

### エラー時の挙動

- 1 枚の生成失敗は他の生成をブロックしない
- 失敗した枚は `generation-log.json` にエラー内容を記録
- バッチ終了時に失敗一覧をサマリー表示:
  ```
  生成完了: 57/60 成功, 3 失敗
  失敗一覧:
    - emotion/dizzy-003: 429 Rate Limited (3 retries exhausted)
    - state/error-network-007: timeout after 60s
    - decoration/wing-left-002: 500 Internal Server Error
  ```
- 失敗分は同じコマンドを再実行すれば既存ファイルをスキップして未生成分のみ生成

### ログ

`assets-raw/generation-log.json` に JSON Lines 形式で追記:

```json
{
  "timestamp": "2026-04-19T12:34:56.789Z",
  "category": "emotion",
  "kind": "celebrate",
  "index": 1,
  "model": "gemini-3.1-flash-image-preview",
  "resolution": "1K",
  "prompt_preview": "STYLE: Sticker-style illustration, bold cartoon...",
  "success": true,
  "duration_ms": 15234,
  "output_path": "assets-raw/emotion/celebrate-001.png",
  "file_size_bytes": 245678
}
```

---

## 0-6. コスト見積

### 基本見積

| 項目 | 枚数 | 単価 | 小計 |
|------|------|------|------|
| 初回生成（1K, 60 種別 x 10 枚） | 600 | $0.067 | $40.20 |
| プロンプト調整の再生成（x2 見込み） | 1,200 | $0.067 | $80.40 |
| Achievement 系 2K 生成（15 種別 x 5 枚） | 75 | $0.101 | $7.58 |
| **合計見積** | **1,875** | — | **$128.18** |

### 段階的な実コスト予測

| フェーズ | 内容 | 推定コスト |
|---------|------|-----------|
| Phase 1 Dry Run（4 種別 x 10 枚） | テンプレート検証 | $2.68 |
| Phase 1 プロンプト微調整（x3 イテレーション） | 品質向上 | $8.04 |
| Phase 2 本番生成（60 種別 x 10 枚） | 全カテゴリ | $40.20 |
| Phase 2 再生成（不採用分、推定 30%） | 追加候補 | $12.06 |
| Phase 2 Achievement 2K（15 種別 x 5 枚） | 高解像度版 | $7.58 |
| **現実的合計** | | **$70.56** |

Layer 2 の見積（$90-130）より下振れの予測。根拠: Dry Run で早期にプロンプト品質を固められれば、再生成回数が 2-3 倍ではなく 1.5 倍程度に収まる。

### API キーの運用

- `D:\ダウンロード\ディスコード\.env` に既存の `GOOGLE_API_KEY` がある
- throw-to-win プロジェクトの `.env.local` に同じキーを設定して使用
- `.env*` は既に `.gitignore` でカバー済み（L34: `.env*`）。追加作業不要

---

## まとめ: Riki 確認事項

Phase 1 着手前に以下の判断を依頼する。

| # | 確認事項 | 提案 |
|---|---------|------|
| 1 | SVG 化を保留し、PNG + WebP で運用してよいか | 推奨。自動トレースの品質問題により、PNG 最適化 + WebP 変換で十分なファイルサイズと品質を実現できる |
| 2 | 選別ツールはローカル Web サーバー（express）でよいか | 推奨。グリッド比較・黒背景プレビュー・クリック選別は CLI より圧倒的に操作性が良い |
| 3 | `express` を devDependencies に追加してよいか | 選別 UI サーバー専用。本番バンドルには影響しない |
| 4 | raw 候補は `assets-raw/`（プロジェクトルート）に配置してよいか | `public/` 外に置くことで Next.js ビルドバンドルへの混入を防止 |
| 5 | 最終アセットの UI 表示サイズに合わせて 512px にリサイズしてよいか | 元は 1024px で生成、最適化時に 512px に縮小。UI 上 128-256px 表示には十分 |
| 6 | こすくまくんの追加参照画像はあるか | Layer 1 SS1-4 に副参照の記載あり。現時点では logo-hero.png のみ配置済み |
