# Throw to Win — ビジュアルシステム定義書

**目的**: Throw to Win アプリの視覚的装飾領域を、新ロゴ(翼つきスマホ + 手 + 光線)と同じ世界観で一貫させるための原則・パラメータ・プロンプトテンプレート集。

**位置付け**: この文書は Claude Code・Gemini 画像生成 API・Riki(選別者)の三者が共通参照する**憲法**。アセット生成・UI 実装の全判断はこの文書に準拠する。

**文書の使われ方**:
1. Claude Code はアセット生成スクリプトを書くとき、この文書のプロンプトテンプレートを使う
2. Gemini はこの文書の「世界観ベースプロンプト」+「カテゴリ別プロンプト」に従って画像を生成する
3. Riki は生成された画像を「品質チェックリスト」に照らして採用/却下を判断する
4. Claude Code は UI に組み込むとき、この文書の命名規則・配色・サイズ規則に従う

---

## 1. 世界観の定義

### 1-1. コア原則(1 行)

**「ステッカー文化から来た、#00fa9a の神聖な遊び」**

### 1-2. 採用されるビジュアル言語

- **太い輪郭線**(outline, 黒 or 濃色で全ての形状に必須)
- **ベタ塗り**(2-3 色まで、グラデーションは極小使用)
- **カートゥーン調**(ディズニー的ではなく、スケーターステッカー寄り)
- **Y2K / 90s-2000s ポップ・スケート・グラフィティ DNA**
- **光線・星・キラキラ・汗マーク・集中線**など装飾プリミティブを使う
- **キャラクター性が強い**(無機質を避ける)
- **中心対称 or 視点明確**(左右バランス・アングル統一)
- **アクセントカラー `#00fa9a`** を常に主役として使う
- **背景は純黒** (#000000 or #0A0A0F) を想定した**透過 PNG**

### 1-3. 禁忌(絶対に出してはいけない)

- ミニマル細線アイコン(Lucide / Heroicons / Feather 調)
- グラデーションの過剰使用(2 色間の単純グラデ以外)
- 3D レンダ調(Blender や Cinema4D 的ツルツル質感)
- 写実的フォトレアル
- テクスチャの重ね合わせ(ノイズ、紙、布感など)
- 日本のアニメ絵柄(萌え系)
- インフォグラフィック調(矢印・吹き出しが情報記号的)
- 水彩・ペン画・スケッチ風などの手作り風
- ダーク・ゴシック・ホラー系

### 1-4. リファレンス画像

- `public/assets/reference/logo-hero.png`(Throw to Win メインロゴ: 翼つきスマホ + 手 + 光線 + 星)
- 画像生成時は**常にこれを参照画像として添付する**。Nano Banana 2 の参照画像一貫性機能でトーンを揃える。
- ロゴ以外のこすくまくんアセットが `public/` 配下に見つかった場合、それも副参照として追加

---

## 2. 固定パラメータ

以下は全アセットで統一する。バラバラだと世界観が崩れる。

### 2-1. 配色パレット

| 役割 | 値 | 備考 |
|---|---|---|
| Primary(ベタ塗り・光・輪郭強調) | `#00FA9A` | メインアクセント |
| Primary Deep(影・暗部) | `#00B370` | 立体感用、Primary の 70% 明度 |
| Primary Light(ハイライト) | `#4DFFBC` | ごく一部の光沢用 |
| Outline Black(全輪郭線) | `#000000` | 透過背景時の視認性のため |
| Background Assumed | `#000000` / `#0A0A0F` | 透過前提だがプレビュー時はこれを背景に |

**ルール**: この 5 色以外は使わない。スター・光線等で白 `#FFFFFF` を補助的に使うのは OK。

### 2-2. 輪郭線の太さ

- ベース輪郭: **画像短辺の 1.2% 〜 2.0%**(1024px なら 12-20px)
- 内部ディテール線: **ベース輪郭の 50%**
- 全アセットで比率を統一

### 2-3. キャンバス仕様

- **出力解像度**: 1024x1024(ほとんどのアセット)、1024x1536(縦長キャラ)
- **背景**: 透過 PNG(alpha channel)
- **余白**: 被写体周囲に最低 5% の余白を確保(SVG 変換後のクリップ事故防止)
- **中央配置**: 重心が画像中央 ±10% に来ること

### 2-4. タイポグラフィ(画像内に文字を入れる場合)

- 画像内テキストは**極力避ける**(i18n の制約で差し替えが必要になるため)
- やむを得ず入れる場合は、日本語ではなく**英数字のみ**(`GO!` `PB` `NEW` 等短単語)
- フォント指定: 「bold, blocky, condensed, slight 3D effect」
- 色: Primary `#00FA9A` ベタ塗り + 黒輪郭

---

## 3. アセットカテゴリ定義

Throw to Win の UI を棚卸しした結果、必要なアセットを 4 カテゴリに分類。

### 3-1. 感情表現系(Emotion)- 推定 15 枚

投擲結果や達成時のリアクションに使う表情・ポーズアイコン。ほとんどは**翼つきスマホをベースに派生**させる。

- `celebrate` - 歓喜(両手挙げ、光線 MAX、星撒き)
- `wow` - 驚き(目を見開く、口あんぐり)
- `pride` - 誇らしげ(胸を張る、にやり)
- `determined` - 集中(目を細める、集中線)
- `sad-but-ok` - 惜しい(涙目、でも笑顔)
- `chill` - リラックス(片目閉じ、親指立て)
- `fire` - 燃える(炎を背負う)
- `sparkle` - キラキラ(星に囲まれる)
- `dizzy` - めまい(目がぐるぐる)
- `sleeping` - 待機(Zzz)
- `confused` - 困惑(?マーク)
- `excited` - 興奮(汗、ピース)
- `cool` - クール(サングラス)
- `thumbs-up` - 承認(親指立て)
- `peace` - ピースサイン

### 3-2. 状態系(State)- 推定 10 枚

空データ・読み込み・エラー・許可待ちなどの **"何も起きていない" 画面を埋める** 絵。

- `empty-ranking` - ランキングデータなし
- `empty-history` - 投擲履歴なし
- `empty-pb` - まだ PB なし
- `loading-video` - 動画処理中
- `loading-initial` - 初回ロード
- `error-sensor` - センサー使えない
- `error-network` - 通信失敗
- `error-generic` - その他エラー
- `permission-camera` - カメラ許可待ち
- `permission-motion` - モーション許可待ち

### 3-3. 達成系(Achievement)- 推定 15 枚

記録更新・ティア昇格・ストリーク等の瞬間に出す**祝福バッジ** or **一枚絵**。

- `pb-update` - 自己ベスト更新バッジ
- `tier-up-{tier}` × 10(rookie→iron→bronze→silver→gold→platinum→emerald→diamond→master→legend の昇格演出)
  - ※ 既存 `public/tiers/*.webp` は「ティアアイコン」で別物。これは「昇格の瞬間の演出画像」
- `streak-3` - 3 日連続
- `streak-7` - 7 日連続
- `streak-30` - 30 日連続(特別デザイン)
- `world-rank-update` - 世界ランク上昇
- `country-rank-update` - 国ランク上昇

### 3-4. 装飾系(Decoration)- 推定 20 枚

画面の隙間を埋める・演出を盛る**小物素材**。

- `star-small` / `star-medium` / `star-large`(サイズ違い)
- `sparkle-1` / `sparkle-2` / `sparkle-3`(形違い)
- `burst-small` / `burst-medium` / `burst-large`(爆発・光線)
- `arrow-up` / `arrow-down` / `arrow-left` / `arrow-right`(装飾矢印)
- `wing-left` / `wing-right`(翼パーツ単体)
- `hand-open` / `hand-closed`(手のパーツ単体)
- `speed-line-1` / `speed-line-2`(集中線)
- `dot-pattern`(ドットパターン)

**合計: 約 60 アセット**

---

## 4. カテゴリ別プロンプトテンプレート

Nano Banana 2(Gemini 3.1 Flash Image、モデル ID `gemini-3.1-flash-image-preview`)への入力用。**参照画像はロゴ必須**。

### 4-1. 世界観ベースプロンプト(全生成で共通)

```
STYLE: Sticker-style illustration, bold cartoon outlines, flat solid fill (no gradient), Y2K skater/pop aesthetic, vibrant neon mint green (#00FA9A) as primary color with black outlines. Transparent background. Centered composition with 5% margin. Reference image provided: match the exact color, outline weight, and graphic energy of the reference.

DO NOT: Use minimal thin-line icons, photorealistic rendering, 3D CGI, anime/manga style, watercolor, sketch, muted colors, non-neon palettes, or backgrounds.

OUTPUT: 1024x1024 PNG with transparent background.
```

### 4-2. 感情表現系テンプレート

```
{世界観ベースプロンプト}

SUBJECT: A cartoon smartphone character (based on the reference logo's winged phone) expressing {EMOTION}.

DETAILS:
- Pose: {POSE}
- Face expression on phone screen: {EXPRESSION}
- Surrounding elements: {DECORATION}
- Energy level: {ENERGY}/10

EXAMPLE for "celebrate":
- Pose: Wings fully spread, tilted slightly upward
- Face: Big smile with closed eyes, arched eyebrows
- Decoration: Stars bursting around, radial light rays, small sparkles
- Energy: 10/10
```

### 4-3. 状態系テンプレート

```
{世界観ベースプロンプト}

SUBJECT: A single-scene illustration conveying "{STATE}".

DETAILS:
- Main visual: {MAIN_VISUAL}
- Mood: {MOOD} (keep it friendly, not depressing)
- Key elements: {KEY_ELEMENTS}
- Composition: Balanced, readable at small sizes

NO TEXT IN THE IMAGE. The state will be communicated through translated captions in the UI.

EXAMPLE for "empty-ranking":
- Main visual: A confused winged phone character floating in empty space with magnifying glass
- Mood: Friendly, "nothing here yet"
- Key elements: Small scattered stars, tumbleweed-style decoration
```

### 4-4. 達成系テンプレート

```
{世界観ベースプロンプト}

SUBJECT: Celebration burst for achievement "{ACHIEVEMENT}".

DETAILS:
- Central element: {CENTRAL}
- Radiating elements: {RADIATING}
- Typography if any: {TEXT} in bold blocky condensed font, 3D effect
- Energy level: {ENERGY}/10 (higher for rarer achievements)

EXAMPLE for "pb-update":
- Central element: Winged phone with radiant glow, thumbs-up hands
- Radiating elements: Lightning bolts, stars, "PB" text banner
- Typography: "PB" in 3D bold letters, primary green with black outline
- Energy: 9/10
```

### 4-5. 装飾系テンプレート

```
{世界観ベースプロンプト}

SUBJECT: Single decorative asset "{ASSET_NAME}" — minimal, reusable, designed to be placed as an accent.

DETAILS:
- Shape: {SHAPE_DESCRIPTION}
- Complexity: Simple enough to work at small sizes (32px minimum)
- Variations: This is variant {VARIANT_NUMBER} of {TOTAL_VARIANTS}

EXAMPLE for "star-small":
- Shape: 5-pointed star, slightly chunky proportions
- Complexity: Solid fill with single highlight spot
- Variant: 1 of 3 sizes
```

---

## 5. 品質チェックリスト(Riki の選別基準)

生成された画像を採用するかどうかは、以下のチェックリストで判定。**全 10 項目をパスしたものだけ採用**。1 つでも NG なら即却下。

### 5-1. 必須項目(10 項目)

- [ ] 背景が完全に透過されている(背景色が混入していない)
- [ ] 主役が `#00FA9A` 系の緑で塗られている(別色ではない)
- [ ] 黒の輪郭線が全形状に入っている
- [ ] グラデーションが過剰でない(ベタ塗り中心)
- [ ] スケーターステッカー調である(ミニマルでも写実でもない)
- [ ] 画像中央 ±10% に重心がある
- [ ] 周囲に最低 5% の余白がある
- [ ] 画像内テキストが無い、または英数字短単語のみ
- [ ] ロゴリファレンスと**明らかに同一世界観**である
- [ ] 32px まで縮小しても意図が読める(装飾系のみ 64px 基準)

### 5-2. 推奨項目(参考、必須ではない)

- 左右対称 or 明確な視線方向
- キラキラ / 星 / 光線のいずれかの装飾プリミティブが入っている
- 表情・ポーズに感情がある(無機質でない)
- ブランド色 `#00FA9A` が画像面積の 30-60% を占めている

---

## 6. ファイル命名規則

### 6-1. 生成物の保存

```
public/assets/
├── reference/              # Gemini 参照画像
│   ├── logo-hero.png
│   └── (こすくま本体 if exists)
├── generated/              # Claude Code が生成した raw 候補(人間の選別前)
│   ├── emotion/
│   │   ├── celebrate-001.png
│   │   ├── celebrate-002.png
│   │   └── ...
│   ├── state/
│   ├── achievement/
│   └── decoration/
└── final/                  # Riki が採用し、SVG 化 or 最適化済みのアセット
    ├── emotion/
    │   ├── celebrate.svg
    │   ├── wow.svg
    │   └── ...
    ├── state/
    ├── achievement/
    └── decoration/
```

### 6-2. 命名ルール

- snake-case
- カテゴリをパス、種別をファイル名(例: `emotion/celebrate.svg`)
- バリエーション違いは接尾辞(例: `star-small.svg` / `star-medium.svg`)
- raw 候補はカテゴリ + 種別 + 3 桁連番(例: `celebrate-001.png`)

### 6-3. アセットカタログ

最終的に `src/assets-catalog.ts` として TypeScript 型付けで管理:

```ts
// 自動生成ファイル。手編集禁止。
export const ASSET_CATALOG = {
  emotion: {
    celebrate: "/assets/final/emotion/celebrate.svg",
    wow: "/assets/final/emotion/wow.svg",
    // ...
  },
  state: { /* ... */ },
  achievement: { /* ... */ },
  decoration: { /* ... */ },
} as const;

export type EmotionAsset = keyof typeof ASSET_CATALOG.emotion;
// ...
```

---

## 7. 変更管理

この文書は**単一情報源(Single Source of Truth)**。以下を守る:

1. 配色・輪郭比率・カテゴリ分類を変えるときは、まず本文書を更新する
2. 更新後、既存アセットの再生成が必要かを判断する
3. プロンプトテンプレートの改訂履歴を本文書末尾に追記する
4. Claude Code はこの文書を**初回参照時に一字一句読む**(要約しない)

---

## 8. 改訂履歴

- 2026-04-XX: 初版作成
