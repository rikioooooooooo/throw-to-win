# Throw to Win — アセット生成パイプライン実装指示書(Layer 2)

## このタスクの目的

`docs/design/visual-system.md`(Layer 1 の視覚システム定義書)に準拠した画像アセット群を、**Gemini API を用いて大量生成 → Riki が選別 → SVG 化 → 最終配置**するパイプラインを Claude Code が構築する。

**このタスクでは UI 実装は行わない**。生成・選別ツール群の構築のみ。UI への組み込みは Layer 3(`2026-04-XX-ui-refresh.md`)で行う。

---

## 前提

### 絶対に読むべき文書

`docs/design/visual-system.md` を**最初に一字一句読み、要約せず全文を頭に入れる**。プロンプトテンプレート・配色・カテゴリ分類・命名規則はそちらが単一情報源。本指示書は**ツール/配線の話のみ**で、視覚品質の判断基準は全て Layer 1 に書いてある。

### 使用する Gemini API(確認済み事実)

- **Nano Banana 2 (Gemini 3.1 Flash Image)**: モデル ID `gemini-3.1-flash-image-preview`。2026年2月リリース。4K 対応・テキストレンダリング強化。**このタスクの主力モデル**
  - 1K (1024px) 出力: $0.067/枚
  - 2K (2048px) 出力: $0.101/枚
  - 4K (4096px) 出力: $0.151/枚
  - 512px 出力: $0.045/枚
- **Nano Banana Pro (Gemini 3 Pro Image)**: モデル ID `gemini-3-pro-image-preview`。$0.134/枚(1K)〜 $0.24/枚(4K)。参考として存在するが、Riki の指定により今回は Nano Banana 2 を使用
- **Imagen 4 Fast**: 参照画像機能が弱いため不使用
- API エンドポイント: Google AI Studio(`https://generativelanguage.googleapis.com`)

### 解像度の選択

Layer 1 §2-3 のキャンバス仕様に従い **1K (1024x1024)** を基本とする。理由:

- SVG 化前の中間アセットとして十分な解像度
- コスト効率(4K は中間アセットには過剰)
- バンドル最終アセットは SVG なので元 PNG 解像度はそこまで影響しない

ただし以下の場合は 2K に上げる:
- Achievement 系(祝福バッジ等、細部まで描かれるもの)で細部が潰れる場合
- 一度 1K で試作して細部が足りないと判断されたとき

### API キーの扱い

- Riki が `.env.local` に `GEMINI_API_KEY=...` を配置する前提
- Claude Code は`.env.local` から読み込む(`dotenv` パッケージは既存環境を確認、無ければ追加提案)
- **API キーを絶対にコミットしない**。`.gitignore` 確認、未登録なら `.env*.local` を追加
- **API キーを `console.log` や生成スクリプトの出力に含めない**

### 予算

Riki の指示: **予算は無制限**。ただし無駄遣いはしない。カテゴリごとに 1 枚ずつ試作 → プロンプト調整 → 本番生成という段階を踏む。

### 人間選別必須

Riki の指示: **自動選別はしない、必ず人間が選別する**。Claude Code は選別 UI を用意し、Riki が手で選ぶ。

---

## 絶対制約

### 編集禁止ファイル(UI 凍結領域)

| パス | 理由 |
|---|---|
| `src/lib/physics.ts` / `src/lib/sensor.ts` / `src/lib/anti-cheat.ts` | 計測ロジック |
| `src/hooks/use-throw-detection.ts` / `src/hooks/use-camera.ts` | センサー・カメラ |
| `src/lib/video-processor.ts` | 動画処理 |
| `src/app/api/verify/route.ts` / `src/app/api/challenge/route.ts` | サーバー検証 |
| `src/lib/challenge.ts` / `src/lib/fingerprint.ts` | チャレンジ・識別 |
| `migrations/*.sql` | スキーマ |
| `src/app/[locale]/play/page.tsx` 内 `overlayRenderer` / `overlayStateRef` | 動画焼き込み |
| `src/components/slow-mo-player.tsx` | 動画再生 |
| `src/components/gyro-ball.tsx` | 2D 背景(Snow Globe 案とは別管理) |
| `src/app/globals.css` の `@theme inline` トークン | カラートークン |

### やらないこと

- UI ファイルの編集(Layer 3 で行う)
- 既存アセット(`public/tiers/*.webp` 等)の改変
- 生成物の**自動採用**(必ず Riki の選別を挟む)
- API キーのハードコード・ログ出力・コミット
- **選別前の raw 画像を `public/final/` に置く**(選別済み専用フォルダ)

---

## Phase 0 — 事前調査と方針合意

以下 6 項目を `docs/plans/2026-04-XX-asset-pipeline-proposal.md` にまとめて提出。Riki 承認後に Phase 1 へ。

### 0-1. Layer 1 の整合性確認

`docs/design/visual-system.md` を読み、以下を確認:

- カテゴリ数・枚数(Emotion 15 / State 10 / Achievement 15 / Decoration 20 = 60)が本実装でもそのままか
- プロンプトテンプレートに不明瞭な箇所がないか
- リファレンス画像 `public/assets/reference/logo-hero.png` の **配置場所を Riki に確認**(まだ無い可能性。配置パスと実ファイルを Riki が用意)

不明点は Phase 0 報告に明記し、Riki の回答を待つ。

### 0-2. `package.json` への追加依存

Phase 1 で必要なパッケージを特定し、追加依存を提案:

- **`@google/generative-ai`** (Gemini SDK、必須)
- **`dotenv`** (環境変数読み込み、既に Next.js が読み込むので不要の可能性)
- **`sharp`** (画像の軽量処理・透過チェック、必要なら)
- **`potrace`** or **`imagetracerjs`** (自動 SVG 化、必要なら)
- **`svgo`** (SVG 最適化、必要なら)

**Vectorize 手段の選定**: 自動ツールで SVG 化するか、手動で vectorizer.ai 等の有料ツールに流すかを提案。Riki の判断を仰ぐ。

### 0-3. ディレクトリ構造の確定

Layer 1 §6-1 の構造をそのまま採用するか、調整が必要か。特に:

- `public/` 配下は Next.js のビルド時コピー対象。raw 候補画像(60 × 10 枚 = 600 枚)を置くと bundle に含まれてしまわないか検証
- **推奨**: `public/assets/final/` のみ `public/` に置き、`public/assets/generated/` は `/assets-raw/`(プロジェクトルート配下)に置く。`.gitignore` で raw を除外
- 最終案を図示

### 0-4. 生成スクリプトのアーキテクチャ

以下のスクリプトを提案(ファイルパス・責務・CLI 使用例):

- `scripts/generate-assets.ts` — カテゴリと枚数を指定して Gemini に投げる
  - 例: `npm run generate -- --category emotion --kind celebrate --count 10`
  - 指定した種別について、Layer 1 のプロンプトテンプレートを展開して N 枚生成
  - リファレンス画像を必ず添付
  - 結果を `/assets-raw/emotion/celebrate-001.png` ... `celebrate-010.png` に保存
- `scripts/select-assets.ts` or **Web UI ベースの選別ツール**
  - Riki が候補を見比べて採用/却下する
  - 採用したら `/assets-raw/emotion/celebrate-003.png` を `public/assets/final/emotion/celebrate.png` にコピー
  - **選別ツールの形式を Phase 0 で提案**(CLI でプレビューコマンド? ローカル Web サーバー?)
- `scripts/vectorize.ts` — 採用された PNG を SVG に変換
  - Phase 0 で決めた vectorize 手段を使う
  - 出力を `public/assets/final/emotion/celebrate.svg` に
  - SVGO で最適化
- `scripts/build-catalog.ts` — `public/assets/final/` を走査して `src/assets-catalog.ts` を自動生成

### 0-5. レート制限・エラー処理

Gemini API のレート制限・エラー処理方針:

- 並列実行数の上限(推奨 3-5 並列)
- リトライポリシー(指数バックオフ、最大 3 回)
- 1 枚失敗時は他の枚数生成を継続、失敗ログを残す
- タイムアウト(1 リクエスト 60 秒)
- 生成ログを `/assets-raw/generation-log.json` に追記(プロンプト・モデル・コスト・成功失敗を記録)

### 0-6. コスト見積

60 カテゴリ × 1 回目 10 枚ずつ = 600 枚(Nano Banana 2 1K 出力 $0.067/枚)= **約 $40.2**

プロンプト微調整で再生成が入る可能性:実質 2-3 倍に膨らむと予測 = **$80-120**

一部 2K 出力に上げる案件(Achievement 系など細部重要)を想定: 15 カテゴリ × 5 枚 × $0.101 = **+$7.6**

**合計見積 $90-130**(無制限指定なので問題にならないが、記録として報告)

---

## Phase 1 — 実装

### 1-1. 依存追加

Phase 0 で承認した依存を追加。コミット:

```
chore(deps): add gemini sdk and image processing tools
```

### 1-2. ディレクトリ構築

Phase 0 で確定した構造を作成。`.gitignore` 更新。

```
chore(assets): setup asset directory structure
```

### 1-3. Layer 1 文書の配置

**前提**: Layer 1(`docs/design/visual-system.md`)は Riki が**このタスク開始時に別途配置する**(本セッション外で、Riki の手元にある文書をリポジトリに配置済み)。

Claude Code は:
1. タスク開始時に `docs/design/visual-system.md` の存在を確認
2. 無ければ Riki に報告して停止
3. 存在すれば**一字一句読み**、要約せずに頭に入れる
4. Phase 0 以降の全判断はこの文書に準拠する

**Claude Code は Layer 1 文書を生成・改変しない**。Layer 1 の改訂が必要な場合は Riki に提案し、Riki が手動で文書を更新する。

### 1-4. リファレンス画像の配置

`public/assets/reference/logo-hero.png` が無い場合、Riki に配置を依頼して停止。配置後、Claude Code が画像サイズ・透過・ファイルサイズを検証。

### 1-5. スクリプト実装順

以下の順で実装。各スクリプト実装後に動作確認し、次へ:

1. **`scripts/gemini-client.ts`** — Gemini API のラッパー
   - `generateImage(prompt, referenceImagePath, options): Promise<Buffer>`
   - デフォルトモデル: `gemini-3.1-flash-image-preview`(Nano Banana 2)
   - デフォルト解像度: 1K(`1024x1024`)
   - オプションで解像度変更可(`512` / `1K` / `2K` / `4K`)
   - リトライ・タイムアウト・ログ込み
   - API キー未設定時は明確なエラー

2. **`scripts/generate-assets.ts`** — 生成 CLI
   - コマンドライン引数処理(`commander` 等)
   - Layer 1 のプロンプトテンプレート展開
   - カテゴリ・種別・枚数を指定して一気に生成
   - **動作確認**: `--category decoration --kind star-small --count 3` で 3 枚生成、目視確認

3. **`scripts/select-assets.ts`** — 選別ツール
   - Phase 0 で決めた形式で実装(CLI or Web)
   - 採用すると自動で `public/assets/final/{category}/{kind}.png` にコピー
   - 却下は raw 側に残す(再選別可能)
   - **動作確認**: 上で生成した 3 枚から 1 枚採用、ファイル配置を検証

4. **`scripts/vectorize.ts`** — SVG 化 CLI
   - PNG → SVG 変換
   - SVGO で最適化
   - `public/assets/final/{category}/{kind}.svg` を出力
   - PNG は残す(フォールバック用)
   - **動作確認**: 採用した 1 枚を SVG 化、ブラウザで表示確認

5. **`scripts/build-catalog.ts`** — カタログ自動生成
   - `public/assets/final/**/*.svg` を走査
   - `src/assets-catalog.ts` を TypeScript 型付きで生成
   - **動作確認**: `src/assets-catalog.ts` が生成され、型エラーなしでビルド通る

各スクリプトは `package.json` の `scripts` にコマンド登録:

```json
{
  "scripts": {
    "assets:generate": "tsx scripts/generate-assets.ts",
    "assets:select": "tsx scripts/select-assets.ts",
    "assets:vectorize": "tsx scripts/vectorize.ts",
    "assets:catalog": "tsx scripts/build-catalog.ts"
  }
}
```

### 1-6. 最初の試作(Dry Run)

全カテゴリ一気に生成する前に、**各カテゴリから 1 種別だけ先に 10 枚生成**してプロンプト品質を検証:

- Emotion: `celebrate` を 10 枚
- State: `empty-ranking` を 10 枚
- Achievement: `pb-update` を 10 枚
- Decoration: `star-small` を 10 枚

Riki が選別し、品質を確認。**プロンプトテンプレートに不満があれば Layer 1 を改訂**し、再生成。

この段階で世界観が固まったら、Phase 2(全カテゴリ本番生成)に進む。

### 1-7. Phase 1 受入条件

1. `npm run assets:generate` で指定種別の画像が raw フォルダに保存される
2. `npm run assets:select` で Riki が選別できる(形式は Phase 0 で決めたもの)
3. `npm run assets:vectorize` で選別済み PNG が SVG 化される
4. `npm run assets:catalog` で `src/assets-catalog.ts` が生成される
5. `.env.local` の `GEMINI_API_KEY` が未設定のとき、わかりやすいエラーメッセージが出る
6. API キー・個人情報が git 履歴・コンソールログ・生成ファイルに含まれない
7. Phase 1-6 の試作 40 枚が生成され、Riki の目視確認を通過している
8. `npm run lint` / `npm run build` クリーン

---

## Phase 2 — 全カテゴリ本番生成(Phase 1 承認後、Riki 主導)

Claude Code のタスクは**ツール提供まで**。Phase 2 以降は Riki がツールを使って実行する。ただし Claude Code は以下をサポート:

- Riki が `npm run assets:generate` を順に回す補助(バッチ実行スクリプト `scripts/generate-all.ts` の提供)
- 生成失敗時のリトライ手順のドキュメント化(`docs/asset-pipeline-operations.md`)
- 全カテゴリ生成完了後のカタログ再構築

---

## 常時ルール

1. **Layer 1 文書を一字一句守る**。視覚品質の判断基準は Layer 1。本指示書では配線のみ扱う。
2. **API キーを絶対に露出しない**。ログ・コミット・生成ファイル全てチェック。
3. **選別前の画像を `public/final/` に配置しない**。
4. **日本語で報告・質問する**(コードコメントは英語優先、既存慣習に合わせる)。
5. **Phase 0 提案書は、自分で 1 回以上再レビューしてから提出**。
6. **判断には 1 行で根拠を添える**。技術制約・UX・既存実装整合性のいずれか。
7. **ハルシネーション禁止**。分からないことは「調査が必要」と書く。

---

## 開始手順

1. `docs/design/visual-system.md` を **全文読む**(要約しない)
2. `src/app/[locale]/page.tsx`・`package.json`・`.gitignore` を view して現物の差分を裏取り
3. `public/assets/reference/logo-hero.png` の存在確認。無ければ Riki に依頼
4. `docs/plans/2026-04-XX-asset-pipeline-proposal.md` を書く(§0-1〜0-6 の順)
5. 書いたら自己レビューして、矛盾・抜け・根拠不足を直してから Riki に提示
6. Riki の承認後、Phase 1 に進む

以上。
