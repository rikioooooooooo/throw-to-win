# Throw to Win — UI 一新実装指示書(Layer 3)

## このタスクの目的

Layer 2(`2026-04-XX-asset-pipeline-proposal.md`)のパイプラインで生成・選別済みのアセット群を、アプリ全体の UI に組み込み、**ロゴと同じ世界観に UI を統一する**。

- 装飾領域(アイコン・空状態・ローディング・達成演出・デコレーション)をロゴトーンのアセットで一新
- ボタン・入力・数値・ナビゲーション等の骨格は **触らない**
- 新しいロゴを視覚的な主役として配置する

---

## 前提

### 必ず事前に読む文書

1. **`docs/design/visual-system.md`**(Layer 1: 視覚システム定義)- 世界観・配色の単一情報源
2. **`docs/plans/2026-04-XX-asset-pipeline-proposal.md`**(Layer 2: アセット生成パイプライン提案)- アセットの所在
3. **`src/assets-catalog.ts`**(自動生成)- 使用可能アセットの型付きカタログ

これら 3 つが存在しない場合、Layer 2 未完了を意味する。Riki に確認して停止。

### 確認済み事実

- Throw to Win の UI は既に `#00FA9A` に移行済み
- 現行 Lucide 風アイコン・シンプルボタンは「ミニマル路線」の残骸であり、**新ロゴ採用により世界観転換が行われる**
- 既存画面数: 9 画面(landing / play の 6 ステート / ranking / mypage / terms)
- ティアアイコン(`public/tiers/*.webp`)は**そのまま残す**(Riki 指示)
- Snow Globe 計画は別タスク。このタスクと**並列 or 順次で、互いに干渉しない領域**

### アセットの使いどころマッピング(参考、Phase 0 で精査)

| 画面 | 使用するアセットカテゴリ |
|---|---|
| Landing | `logo-hero`, `decoration` (stars, sparkles) |
| Countdown | `decoration` (burst, speed-line) |
| Active (flying) | `decoration` (speed-line, sparkle) |
| Result (normal) | `emotion/chill` or `emotion/determined` |
| Result (PB) | `achievement/pb-update`, `emotion/celebrate` |
| Result (Tier up) | `achievement/tier-up-{tier}` |
| Result (Rank update) | `achievement/world-rank-update` |
| Ranking (empty) | `state/empty-ranking` |
| MyPage (empty) | `state/empty-history`, `state/empty-pb` |
| Processing | `state/loading-video` |
| Permission | `state/permission-camera`, `state/permission-motion` |
| Error | `state/error-sensor`, `state/error-network` |

---

## 絶対制約

### 編集禁止ファイル(UI 凍結領域)

| パス | 理由 |
|---|---|
| `src/lib/physics.ts` / `src/lib/sensor.ts` / `src/lib/anti-cheat.ts` | 計測ロジック |
| `src/hooks/use-throw-detection.ts` / `src/hooks/use-camera.ts` | センサー・カメラ |
| `src/lib/video-processor.ts` | 動画処理 |
| `src/app/api/*/route.ts` | サーバー API |
| `src/lib/challenge.ts` / `src/lib/fingerprint.ts` | チャレンジ・識別 |
| `migrations/*.sql` | スキーマ |
| `src/app/[locale]/play/page.tsx` 内 `overlayRenderer` / `overlayStateRef`(L100〜L222 付近) | 動画焼き込み |
| `src/components/slow-mo-player.tsx` | 動画再生 |
| `src/components/gyro-ball.tsx` | 2D 背景 |
| `src/app/globals.css` の `@theme inline` トークン | カラートークン(新ロゴでも `#00FA9A` は維持) |
| `public/tiers/*.webp` | 既存ティアアイコン(Riki 指示で維持) |

### 触ってはいけない領域の原則

- **ボタンの `<button>` → `<svg>` 化は禁止**(a11y・タップ感が劣化する)
- **数値表示の SVG 化は禁止**(`height-number` クラスのタブラー数字が UI の骨格)
- **フォームの入力要素は触らない**(`<input>` のままにする)
- **ナビゲーション構造・URL を変えない**
- **既存の i18n キーを削除しない**(追加は OK、Layer 1 の判断に従う)

### やらないこと

- 画面ルートの増減
- API パスの変更
- データモデルの変更(`UserStats` 等)
- パフォーマンス劣化を伴う大量画像読み込み(lazy load 必須)
- アセット未選別の raw 画像の使用

---

## Phase 0 — 事前調査と方針合意

以下を `docs/plans/2026-04-XX-ui-refresh-proposal.md` にまとめて提出。Riki 承認後に Phase 1 へ。

### 0-1. Layer 1 / Layer 2 成果物の確認

- `docs/design/visual-system.md` の内容を要約せず頭に入れる
- `src/assets-catalog.ts` が生成されていること、各カテゴリに期待数のアセットが揃っていることを検証
- 欠けているアセットがあれば、**Layer 2 の再実行を Riki に依頼**して停止

### 0-2. 既存 UI の棚卸し(Audit)

全画面を走査し、以下を列挙:

- 使われている Lucide 風 SVG の場所(パス・行番号・用途)
- テキストのみで装飾ゼロの空状態(どこに何個)
- 装飾可能な余白(タイトル下・カード内・ボタン横等)
- 既存アイコンの**種類と頻度**(戻るアイコン 5 箇所、外部リンク 2 箇所、等)

出力フォーマット:

```
| 画面 | 要素種別 | 現状 | 差し替え候補アセット | 優先度 |
|---|---|---|---|---|
| landing | ヒーロー装飾 | なし | logo-hero + decoration/stars | 高 |
| landing | デスクトップ警告 | 細線スマホアイコン | - (そのまま) | 低 |
| ranking | 空状態 | テキストのみ | state/empty-ranking | 高 |
...
```

### 0-3. 差し替えマッピング表の確定

0-2 の棚卸しを元に、**どのアセットをどこに使うか**を最終決定。Layer 1 のカテゴリ・命名規則に従って`src/assets-catalog.ts` からの参照で書く。

### 0-4. ロゴの配置戦略

新ロゴ(翼つきスマホ + 手 + 光線)をランディングでどう使うか:

- **案A: ヒーロー完全置換** — 現在の "THROW TO WIN" 文字を消し、ロゴ画像のみに置き換え。文字もロゴに含める(ロゴに "THROW TO WIN" を組み込む)
- **案B: 文字と共存** — 現在のテキストを残しつつ、ロゴを文字の上 or 下に配置
- **案C: 小型ロゴ + 文字** — ロゴを小型(120px)でヘッダー左に、文字は中央

各案の長所短所、ユーザー離脱率への影響見積、SNS 映え度を評価。推奨を 1 つ選ぶ。

### 0-5. アセット埋め込み方式の選択

SVG アセットの React での扱い方:

- **案A: `next/image` で PNG フォールバックを効かせる** — 安全、最適化可能
- **案B: インライン SVG として React コンポーネントに埋め込む** — CSS で色変更可、軽量
- **案C: `<img src="/assets/...svg">`** — シンプル、動的色変更不可

アセット種別ごとに使い分け:
- 大きく表示する静的アセット(ヒーロー等) → A or C
- 色を動的に変えたい小型アセット(アイコン類)→ B
- 決定を Phase 0 で行う

### 0-6. アニメーションの扱い

静止 SVG のままだと寂しいので、CSS アニメーションで揺らぎを追加するかを検討:

- ヒーローのロゴが微かに浮き上がる(Y 軸 ±2px の sin 波、4 秒周期)
- デコレーション(星・キラキラ)が軽く瞬く(opacity 0.7↔1.0)
- PB 達成バッジがロード時にスプリング animate

どこに何を入れるか、全画面分リスト化。既存の `spring-in` / `fade-in-up` keyframe を活用。

### 0-7. パフォーマンス影響の見積

- 追加アセット合計サイズ(Layer 2 で生成された最終 SVG 群のバイト数合計)
- ランディング LCP への影響見積
- 画像 lazy loading 戦略(Intersection Observer or `loading="lazy"`)
- フォントサイズ感じさせない最適化(`decoding="async"`)

### 0-8. Phase 1 タスク分解

画面単位で Phase を分ける:

- Phase 1-1: ランディング刷新(ロゴ + 背景装飾)
- Phase 1-2: 結果画面刷新(PB / Tier / Rank 演出)
- Phase 1-3: 空状態刷新(Ranking / MyPage)
- Phase 1-4: ローディング / エラー / 許可画面刷新
- Phase 1-5: カウントダウン / Active 画面の装飾追加(既存挙動を壊さない範囲で)
- Phase 1-6: デコレーション散布(全画面の余白に星・キラキラ)
- Phase 1-7: アニメーション追加
- Phase 1-8: i18n 追加キー(あれば)

各 Phase の触るファイル・受入条件・ロールバック単位を明記。

### 0-9. 翻訳キーの追加計画

新しい UI 要素にテキストが必要なら、12 言語分の翻訳キーを追加。原則:

- 画像に文字を焼き込まない(Layer 1 の指示通り)
- 画像の補足テキスト(代替テキスト・キャプション)は翻訳キーで管理
- 翻訳は英語・日本語を質高く、他言語は自動翻訳ベースで OK(未翻訳英語混入は NG)

---

## Phase 1 — 実装(Phase 0 承認後)

各サブ Phase は**独立したコミット**として実装。必ず 1 サブ Phase 完了後に Riki が動作確認し、OK が出てから次へ。

### Phase 1-1: ランディング刷新

**触るファイル**: `src/app/[locale]/page.tsx`

- 新ロゴを Phase 0-4 で決めた配置戦略で配置
- 背景に `decoration/stars` 等を散布(既存 `GyroBars` と干渉しないレイヤー配置)
- アニメーション(ロゴの微弱浮遊、星の瞬き)
- テキスト階層(サブタイトル・CTA・PB・ストリーク・今日のベスト)は**文字とレイアウトを維持**
- デスクトップ警告も最小限の調整のみ

**受入条件**:
- 新ロゴがヒーロー位置に表示される
- 既存の START ボタン機能・ジャイロ許可 onClick・consent モーダル動作に一切変更なし
- 再訪ユーザーの PB・ストリーク・今日のベスト表示が従来通り
- `GyroBars`(既存背景)とのレイヤリングが破綻しない(z-index 整理)
- `prefers-reduced-motion: reduce` で新アニメが抑制される
- `npm run lint` / `npm run build` クリーン

**コミット**: `feat(ui-landing): integrate new hero logo and decorations`

### Phase 1-2: 結果画面刷新

**触るファイル**: `src/components/result-screen.tsx`

- PB 更新時: `achievement/pb-update` を表示
- ティア昇格時: `achievement/tier-up-{tier}` を表示
- ランクアップ時: `achievement/world-rank-update` / `country-rank-update` を表示
- 通常の結果: `emotion/chill` や `emotion/determined` など控えめな装飾
- 既存の高度表示・動画プレイヤー・Try Again ボタンは**一切触らない**
- 動画埋め込み(`<video>` / `<SlowMoPlayer>`)は触らない

**受入条件**:
- PB / Tier / Rank 達成時に適切なアセットが表示される
- 通常結果時に装飾が過剰でない
- 既存のカウントアップ・スプリング in アニメが壊れない
- Try Again → カウントダウン → 投擲 のフロー秒数変化なし

**コミット**: `feat(ui-result): add achievement assets and emotion reactions`

### Phase 1-3: 空状態刷新

**触るファイル**:
- `src/app/[locale]/ranking/page.tsx`(空時の表示)
- `src/app/[locale]/mypage/page.tsx`(履歴ゼロ時、PB ゼロ時)

既存のテキストのみの空状態を、`state/empty-*` アセットで置き換え。キャプションは i18n キー。

**受入条件**:
- 空状態に絵が表示される
- 絵が表示されても既存のレイアウト・ソートトグル・ナビが崩れない

**コミット**: `feat(ui-empty-states): add illustrations for empty ranking and history`

### Phase 1-4: ローディング / エラー / 許可画面刷新

**触るファイル**:
- `src/components/loading-screen.tsx`
- `src/components/permission-request.tsx`
- `src/components/error-boundary.tsx`

既存の細線アイコン・シンプル円弧ローディングを、ロゴトーンのキャラクターベースに刷新。ただし:

- ローディング進行状況(ステップ・%)の表示は維持
- エラーメッセージの i18n キーは維持
- 許可ボタンの挙動・イベントハンドラは一切触らない

**受入条件**:
- ローディング・エラー・許可画面に絵が表示される
- 既存の動作・テキスト・イベントに変更なし

**コミット**: `feat(ui-system-screens): refresh loading, error, permission screens`

### Phase 1-5: カウントダウン / Active 画面の装飾追加

**触るファイル**:
- `src/components/countdown.tsx`
- `src/app/[locale]/play/page.tsx` の Active 画面 UI 部分のみ(**overlayRenderer と overlayStateRef は絶対に触らない**)

既存の数字アニメ・高度表示・REC インジケータは**一切触らない**。周囲に控えめな装飾(星・光線)を足すのみ。

**受入条件**:
- 高度計測・センサー・動画録画に一切影響なし
- 投擲計測の精度に誤差 ±5% 以内
- 数字表示・ハプティック・アニメーションに変更なし

**コミット**: `feat(ui-active): add subtle decorations to countdown and active screens`

### Phase 1-6: デコレーション散布(オプショナル)

各画面の余白に、ランダムな位置で小型装飾(星・キラキラ)を配置。

- 過剰にならないよう、1 画面につき 3-5 個まで
- 文字や操作要素にかぶらないよう配置ロジックを工夫

Riki が Phase 1-5 までの状態で「装飾が足りない」と感じなければ**スキップ可**。

### Phase 1-7: アニメーション追加

Phase 0-6 で決めたアニメーションを実装。既存 `globals.css` の keyframe を活用 or 必要なら追加。

**受入条件**:
- すべてのアニメが `prefers-reduced-motion: reduce` で抑制される
- パフォーマンス劣化なし(60fps 維持)

### Phase 1-8: i18n キー追加

新アセットの alt 属性 や キャプション用のキーを 12 言語分追加。

---

## Phase 2 — 全体調整 / 最終調整

### 2-1. スクリーンショット比較

全画面(landing / permission / prepare / countdown / active / processing / result 各種 / ranking / mypage / terms / error)のスクリーンショットを撮り、**刷新前後を並べて比較**。Riki が最終 OK / NG 判定。

### 2-2. パフォーマンス検証

- Lighthouse モバイル Performance スコア 90 以上維持
- LCP 劣化 10% 以内
- バンドルサイズ増加は画像込みで許容(ただし SVG が大きすぎないか確認)

### 2-3. 最終受入条件

1. **投擲計測の精度に影響なし**(同一端末・同一動作で誤差 ±5% 以内)
2. **既存のユーザーフロー全てが動作**(新規ユーザーの consent → permission → START → 結果まで)
3. **12 言語全てで崩れない**(特に ja / en / ar(RTL) / hi)
4. **`prefers-reduced-motion: reduce` が効く**
5. **`npm run lint` / `npm run build` クリーン**
6. **Lighthouse Performance / Accessibility / Best Practices が 90 以上維持**

---

## 常時ルール

1. **計測ロジック・センサー・アンチチート・動画領域を絶対に触らない**
2. **Layer 1・Layer 2 の成果物を単一情報源とする**。独自判断で色・配置・命名を変えない
3. **日本語で報告・質問する**
4. **各 Phase 完了ごとに Riki に動作確認を依頼**。OK が出るまで次 Phase に進まない
5. **判断には 1 行で根拠を添える**
6. **ハルシネーション禁止**
7. **破壊的変更が必要になったら、影響範囲を報告して承認を取る**

---

## 開始手順

1. `docs/design/visual-system.md` を全文読む
2. `docs/plans/2026-04-XX-asset-pipeline-proposal.md` を読む
3. `src/assets-catalog.ts` の存在とアセット充足を検証
4. 既存 UI 全画面の棚卸し(0-2 の出力を作成)
5. `docs/plans/2026-04-XX-ui-refresh-proposal.md` を書く(§0-1〜0-9 の順)
6. 自己レビューしてから Riki に提示
7. Riki の承認後、Phase 1-1 から着手

以上。
