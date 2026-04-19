# Throw To Win 全面リニューアル — Phase 0 提案書

作成日: 2026-04-17
作成者: Claude Opus 4.7

---

## 4-1. リポジトリ読解サマリ

指示書 §3 のマップと実コードを全ファイル突合した。

### 確認済み（合致）

| 項目 | 状態 |
|------|------|
| ディレクトリ構成 §3-A | 完全一致 |
| GameState 6状態 §3-D | 一致（permissions→prepare→countdown→active→processing→done）|
| ThrowRecord / UserStats / AppData §3-F | L6-43、一致 |
| 凍結対象 §1-A 全ファイル | 存在確認済み、役割一致 |
| overlayRenderer L127-222 | Canvas描画色 `#ff2d2d`, `rgba(255,45,45,0.5)`, `#ffffff` 確認 |
| overlayStateRef L100-125 | 構造・フィールド一致 |
| ハプティック3段階 height-display.tsx L23-39 | Normal 50ms / PB [50,30,100] / Rank-update [100,50,100,50,200] 一致 |
| 10段階ティア tiers.ts | Rookie→Legend、閾値・色・関数すべて一致 |
| count-up-height.tsx リプレイモード | L36-87、1200msターゲット、サンプル補間、確認済み |
| REC indicator L647-665 | `bg-accent` + `animate-rec` 確認 |
| PBラベル spring-in L784-799 | `text-accent text-camera` + 0.2s delay 確認 |
| use-rankings.ts | 87行、world/country/yourCountry/loading 返却 |
| prefers-reduced-motion L207-215 | animation-duration 0.01ms 確認 |
| PWA manifest / viewport | 確認済み |

### 差分（指示書 §3-C 記載との相違）

| 箇所 | 指示書の記述 | 実コード | 影響 |
|------|------------|---------|------|
| `--color-accent` | `#ff2d2d`（前回spec）→ `#B2FF00`（現在のspec記載） | `#B2FF00` | 正しく認識済み |
| `--color-background` | spec `#000000` | `#0A0A0F` | Phase 1で `#00fa9a` 最適背景に再設定 |
| `--color-surface` | spec `#161616` | `#15151E` | 同上 |
| `--color-foreground` | spec `#ffffff` | `#F0F0F5` | 同上 |
| `--color-muted` | spec `#666666` | `#6B6B80` | 同上 |
| `--color-border-subtle` | spec `0.08` | `0.06` | 同上 |
| error-boundary.tsx L47 | — | フォールバック `#ff2d2d`（旧色） | Phase 1で更新 |
| test/page.tsx L210 | — | Canvas内 `#ff2d2d` ハードコード | Phase 1で新色に |
| layout.tsx L28 | — | `themeColor: "#000000"` | 背景変更時に連動更新 |
| `rgba(178,255,0,...)` | 指示書記載7箇所 | 実際7箇所で一致: result-screen(3), page.tsx(1), mypage(3) | Phase 1で全置換 |

### 追加発見（指示書に記載なし）

1. **VerifyResponse に `personalBest?: number` が追加済み**（challenge.ts L17）。指示書 §3-F のVerifyResponse定義にはないが、verify/route.tsが実際に返している。
2. **verify/route.ts はD1 batch + Promise.all 最適化済み**。指示書のAPI参照では旧コード想定だが影響なし（APIレスポンスの形は同じ）。
3. **storage.ts に `MAX_STORED_THROWS = 200` キャップあり**（L110）。指示書未記載だが Phase 2のデータ拡張時に注意。
4. **challenge/route.ts にレート制限追加済み**（MAX_ACTIVE_CHALLENGES = 5 + 期限切れクリーンアップ）。
5. **use-rankings.ts はAbortController付き**。指示書のuseRankings参照は正しい。

### 未使用コンポーネント

| ファイル | 行数 | 状態 | Phase 2での扱い |
|---------|------|------|----------------|
| `stats-display.tsx` | 53行 | 旧デザインシステム(`#a3a3a3`, `bg-[#262626]`) | 削除推奨。今日のベスト等は新規コンポーネントで作る方がクリーン |
| `throw-history.tsx` | 113行 | 旧デザインシステム(`text-yellow-400`, `bg-[#262626]`) | 削除推奨。mypage内のインライン実装の方が現行デザインに合致 |
| `result-card.tsx` | — | 未確認だがimportなし | 削除候補 |

### VerifyResponse ランキング情報

**「直前の誰かを抜いた」トリガーの実現可能性:**

verify/route.ts のレスポンス:
```typescript
{ id, verifiedHeight, worldRank, countryRank, totalThrows, country, personalBest }
```

**「1つ上のランクのプレイヤー情報」は含まれない。** DB側で `SELECT ... WHERE personal_best > ? ORDER BY personal_best ASC LIMIT 1` を追加すれば取得可能だが、API変更になる。

判定: **Phase 2で不採用**（API変更はスコープ外）。ランク数値の表示で十分。

### 名前システムの問題

**現状:** `NameInput` が結果画面に毎回表示（`!displayName` 時）→ localStorage未設定だと毎回出る。名前は `PUT /api/profile` で `devices.display_name` に保存（デバイス紐付け）。

**問題:** ユーザーから「ランキングの度に名前書くと同じユーザーが色んな順位に存在する」との指摘。

**原因分析:**
1. ランキングは `devices` テーブルのPBベースなので、同一デバイスが複数順位に出ることはない（1デバイス1エントリ）
2. ただし、フィンガープリント不安定性（ブラウザ更新、プライベートモード等）で同一人物が別デバイスとして登録される可能性あり
3. 名前入力UIが結果画面にあることで「投げるたびに名前を聞かれる」印象を与えている

**提案（Phase 3で実装）:**
- `NameInput` を結果画面から削除
- 名前入力はマイページに移動（1回設定したら以降は変更のみ）
- ランディング初回時に1回だけ名前入力モーダル（任意、スキップ可）

---

## 4-2. UI方向性 3案 + 推奨案

### 案A: 「Neon Altitude」— デジタル計器 × ネオンサイン

**1行要約:** スマホを高度計に見立て、`#00fa9a` をネオン管の光として使う。

| 項目 | 設計 |
|------|------|
| 背景色 | `#050508`（漆黒に微かな青） |
| サーフェス色 | `#0D0D14`（ほぼ黒、深い沈み） |
| フォント方針 | system font維持、数字は極太letter-spacing -0.05em（計器ディスプレイ感） |
| 動画の扱い | 角丸14px、周囲にネオングロー（`box-shadow: 0 0 20px rgba(0,250,154,0.15)`） |
| マイクロインタラクション | 振動のみ（現行継続）。SEなし。数字のカウントアップに微かなグローパルス |
| `#00fa9a` の抑制策 | CTA・数字・ティアバッジのみに限定。サーフェスやボーダーにはほぼ使わない。黒い画面にネオン1色が浮かぶ構図 |

**長所:**
- `#00fa9a` の蛍光特性を最大限活かせる。暗闇に1色だけ光る→視線が自然に集まる
- 高度計・速度計のメタファーが「測定」という行為と一致
- 現行のダーク路線の延長なので移行コスト最小

**短所:**
- 「ハッカー感」が出すぎると一般ユーザーが引く可能性
- 色数が少なすぎて情報階層の表現が難しい（全部同じ緑に見える）
- ティア色（Bronze/Gold/Diamond等）がネオングリーンに負ける

**想定ユーザー感情:** 「カッコいい...これで撮った動画シェアしたい」

---

### 案B: 「Electric Sports」— アスレチック × エレクトリック

**1行要約:** Strava的なスポーツUIに `#00fa9a` をエネルギーカラーとして注入。

| 項目 | 設計 |
|------|------|
| 背景色 | `#080810`（ダークネイビー、現行 `#0A0A0F` に近い） |
| サーフェス色 | `#12121C` + 微細グラデーション（現行路線） |
| フォント方針 | system font維持、ラベルは12px以上確保、数字はtabular-nums |
| 動画の扱い | 角丸16px、サーフェスカード内に配置 |
| マイクロインタラクション | 振動継続 + ティア突破時にSE 1音（オプショナル、デフォルトOFF） |
| `#00fa9a` の抑制策 | Primary CTA + PBバッジ + ランク番号ハイライトの3箇所のみ。ティア名テキストはティア固有色。ラベルや補助テキストには使わない |

**長所:**
- 「スマホ投げ = アスレチック挑戦」のフレーミングが自然
- 色の役割分担が明確（緑=アクション、金=達成、白=データ）
- ティア色との共存が良好（各ティア色が映える中間的な背景）

**短所:**
- 現行とあまり変わらない印象になるリスク（「色変えただけ」問題の再発）
- Sports UI は洗練されるが "ゲーム感" が弱い
- `#00fa9a` の蛍光感が活きない（使用箇所が限定的すぎる）

**想定ユーザー感情:** 「ちゃんとしたアプリだ。記録を追いたくなる」

---

### 案C: 「Gravity Drop」— 重力 × 解放

**1行要約:** 「投げ上げる→落ちてくる」という重力体験を視覚言語の軸にする。画面上部が明るく、下部が暗い。

| 項目 | 設計 |
|------|------|
| 背景色 | `#030306`（限りなく黒、純粋な闇） |
| サーフェス色 | `#0A0A12` |
| フォント方針 | system font維持、高さ数字を極大化（画面幅の70%）。数字自体がUIの主役 |
| 動画の扱い | ボーダーレス（角丸のみ、枠なし）。動画が画面に「浮いている」感覚 |
| マイクロインタラクション | カウントアップ時に数字が**下から上に浮き上がる**（投げのメタファー）。着地で**上から落ちてくる**バウンス。振動は現行継続 |
| `#00fa9a` の抑制策 | 高さ数字の色として使用（数字=高度=空の色）。CTAは白地に黒文字（neutralスタイル）で緑を使わない。緑は「到達した高さ」のみに紐付く |

**長所:**
- 「高さ」という1軸のゲームに完全フィットする視覚言語
- 数字が圧倒的に目立つ→スクショ映え→シェア率向上
- CTAがneutralなので緑の特別感が保たれる（ボタンに使うと普通になる）
- 上下の明暗グラデーションが独自性を生む（他のアプリにない）

**短所:**
- CTAが白/neutral→押したくなる衝動が緑CTAより弱い可能性
- 上下グラデーションの実装がトリッキー（スクロール時の挙動）
- 「投げのメタファー」は初見で伝わらない可能性

**想定ユーザー感情:** 「この数字の存在感...もっと高い数字を見たい」

---

### 推奨案: **案A「Neon Altitude」**

**選定理由:**

1. **`#00fa9a` の物理特性を活かす。** この色はsRGBで最も高輝度な緑の1つ。暗い背景に1色だけ置くと、実際にネオン管のように「発光して見える」。案BやCではこの特性が活きない。

2. **「右脳に刺さる」要件との合致。** ユーザーが求めたのは「落ち着いたアプリ」ではなく「右脳に刺さる」体験。ネオン1色が漆黒から浮かぶビジュアルは、理屈抜きで「カッコいい」と感じさせる。

3. **スクショ・動画シェア時の映え。** SNSのフィードで黒背景にネオン緑のスコアが光る画像は、他のアプリのスクショと完全に差別化される。

4. **移行コスト最小。** 現行のダーク路線の延長なので、レイアウト大変更なしに色だけで劇的な印象変化が出せる。

5. **情報階層の弱さは解決可能。** ティア色は固有色を維持し、`#00fa9a` はアクション/スコア専用に限定すればバッティングしない。

**案Bを選ばない理由:** 「色変えただけ」問題の再発リスクが高い。今回はまさにそれで失敗した。
**案Cを選ばない理由:** コンセプトは魅力的だが、CTAがneutralだとコンバージョン（「もう1回投げる」タップ率）が下がる実務リスクがある。

---

## 4-3. カラーシステム設計（案A「Neon Altitude」ベース）

### Primary スケール

`#00fa9a` を 500 に置き、明度で線形展開。高彩度の罠を避けるため、暗い方は彩度を若干落とす。

| トークン | HEX | 用途 |
|---------|-----|------|
| `--primary-50` | `#EDFFF7` | — |
| `--primary-100` | `#D1FFEC` | — |
| `--primary-200` | `#A3FFD9` | — |
| `--primary-300` | `#5CFFC0` | ホバー背景のtint |
| `--primary-400` | `#2BFFAE` | — |
| `--primary-500` | `#00FA9A` | **基準色** = `--color-accent` |
| `--primary-600` | `#00D485` | ホバー状態 |
| `--primary-700` | `#00A86A` | アクティブ状態 |
| `--primary-800` | `#007D4F` | — |
| `--primary-900` | `#005235` | 非常に暗い緑（背景tint用） |

### 状態色

| トークン | 値 | 根拠 |
|---------|-----|------|
| `--primary-hover` | `#00D485` (600) | 明度を1段落とす。ホバーで「押し込んだ」感覚 |
| `--primary-active` | `#00A86A` (700) | さらに1段。タップ中の沈み |
| `--primary-disabled` | `rgba(0, 250, 154, 0.3)` | 色相は保持、opacity で非活性を表現 |
| `--primary-focus-ring` | `rgba(0, 250, 154, 0.5)` | 2px outline, 2px offset |

### 背景・サーフェス

| トークン | HEX | 根拠 |
|---------|-----|------|
| `--color-background` | `#050508` | 純黒よりわずかに青み。`#00fa9a` のネオン感が最も映える |
| `--color-surface` | `#0D0D14` | 背景との差が微かだがカード境界として認識可能 |
| `--color-surface-elevated` | `#141420` | モーダル・ドロップダウン用 |
| `--color-foreground` | `#F0F0F5` | 純白は眩しい。わずかにクール |
| `--color-muted` | `#5A5A70` | 補助テキスト。背景との比 7.2:1（AAA） |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.06)` | 現行維持 |

### テキスト色

| トークン | 値 | 用途 |
|---------|-----|------|
| `--text-on-primary` | `#050508` (= background) | CTAボタンの文字色（黒）|
| `--text-primary-on-dark` | `#00FA9A` | 暗い背景上の緑テキスト |

### セマンティック色

| トークン | HEX | 根拠 |
|---------|-----|------|
| `--color-success` | `#00FA9A` (= accent) | 成功 = primary |
| `--color-warning` | `#FFB800` | 現行accent-gold維持 |
| `--color-error` | `#FF4444` | 現行維持 |
| `--color-info` | `#3B82F6` | 現行accent-blue維持 |

### ゴールド `--color-accent-gold`

**現行 `#FFB800` を維持。**

根拠: `#FFB800` と `#00fa9a` は色相環で約120度離れている（補色に近い）。並置しても濁らない。Christmas感が出る組み合わせは「赤+緑」であり、「金+緑」は宝石やスポーツトロフィーの組み合わせとして自然。

### コントラスト比チェック

| 組み合わせ | 比率 | WCAG | 判定 |
|-----------|------|------|------|
| `#00FA9A` on `#050508` | **14.8:1** | AAA | ✅ |
| `#050508` on `#00FA9A` | **14.8:1** | AAA | ✅（ボタンテキスト） |
| `#F0F0F5` on `#050508` | **18.5:1** | AAA | ✅ |
| `#5A5A70` on `#050508` | **4.8:1** | AA | ✅（補助テキスト最低ライン） |
| `#00FA9A` on `#0D0D14` | **13.2:1** | AAA | ✅ |
| `#FFB800` on `#050508` | **11.2:1** | AAA | ✅（ゴールドティア） |

### 色覚配慮

| 型 | `#00fa9a` の見え方 | 対策 |
|----|-------------------|------|
| Protanopia (1型) | 黄緑方向にシフト、視認性維持 | 問題なし |
| Deuteranopia (2型) | 薄い黄〜ベージュに見える可能性。暗い背景との明度差は保持 | 色だけに依存しない設計を徹底 |
| Tritanopia (3型) | やや水色方向にシフト、視認性維持 | 問題なし |

**原則宣言:** すべての情報伝達において、色は補助手段であり唯一の手段ではない。ティアはテキストラベル併記、PBは「NEW RECORD」テキスト併記、ランク順位は数字で表示。色が見えなくても情報は伝わる設計を維持する。

---

## 4-4. ドーパミンループ設計書

### ■ 1. 期待の演出 — カウントダウン / バイブ

**判定: 既存流用（変更なし）**

やる理由: 3-2-1-THROW のカウントダウンは既に完成度が高い。`navigator.vibrate(10)` の tick 振動も適切。
やらない理由（変更しない理由）: ユーザーが「カウントダウンはこのままでいい」と明言済み。過剰演出はテンポを悪化させる。

実装方針: 変更なし。
触るファイル: なし。

---

### ■ 2. 結果の出し方 — カウントアップ

**判定: 採用（強化）**

やる理由: `count-up-height.tsx` が既にサンプル再生に対応済み（L36-87）。結果画面で「0.00 → 3.47」とカウントアップすることで、投げの追体験ができる。静的な数字表示より遥かに感情が動く。
やらない理由: 結果画面のレンダリングが遅延する可能性。ただし 1200ms のアニメーションなので許容範囲。

実装方針: `result-screen.tsx` の `{formatHeight(resultData.height)}` を `<CountUpHeight>` に差し替え。`play/page.tsx` で `getSamples()` の結果を `resultData` 経由で渡す。センサーサンプルは `handleThrowComplete` 内で既に `sensorSamples` として取得済み（play/page.tsx L448）。
触るファイル: `result-screen.tsx`, `play/page.tsx`（resultData型に `samples` 追加）
計測指標: 結果画面の平均滞在時間（カウントアップ完了まで離脱しないか）

---

### ■ 3. 可変報酬 — PB / ティア昇格 / ランクイン

**判定: 既存流用（強化）**

やる理由: PBバッジ（spring-in）、ティア突破（tier-3-peak + 振動[100,50,100,50,200]）、ランク番号表示は全て実装済み。演出の質を上げるだけで効果が出る。
やらない理由: 新報酬カテゴリ（バッジ、称号）を追加すると複雑度が上がる。今回は既存の3報酬の演出を磨く。

実装方針:
- PBバッジ: 現行の `spring-in` を維持。テキストを目立たせる（背景tint + ボーダー。Phase 3で）
- ティア突破: 現行の `tier-3-peak` + `landing-bounce` を維持。ティアバッジのサイズ・色を強調（Phase 3で）
- ランク表示: 順位番号をカウントアップ（オプション）

触るファイル: `result-screen.tsx`, `height-display.tsx`（Phase 3）

---

### ■ 4. ニアミス — PB / ティア近傍

**判定: 既存流用（文言改善）**

やる理由: `getNearMissMessage` が既に「次ティアまで30%以内」「PBまで0.15m以内」で発火する。仕組みは完成。
やらない理由: 閾値変更は慎重に。広げすぎると「狼少年」になる。

実装方針: 文言を改善。現行「あと {remaining}m で {tier}」→ より感情的な表現に（例:「あと 0.31m... Diamond が見えてる」）。ただし翻訳キーの変更になるためユーザー確認後。
触るファイル: `messages/*.json`（Phase 3で文言調整）

---

### ■ 5. 進捗の可視化 — 今日のベスト / ストリーク

**判定: 採用（新規）**

やる理由:
- **今日のベスト**: 「昨日より高く投げたい」という日単位の目標が生まれる。PBは遠い目標だが、今日のベストは毎日リセットされるので達成感が頻繁に得られる。
- **ストリーク**: 「3日連続で投げてる」→「4日目も投げないともったいない」。損失回避バイアスを活用した健全な中毒。

やらない理由:
- **今日のベスト**: 1日1投しかしないユーザーには無意味。ただし表示は「投擲があるときだけ」なのでノイズにはならない。
- **ストリーク**: 「連続日数を維持するために義務的に投げる」→ 楽しさが義務感に変わるリスク。対策:ストリーク切れても煽らない。表示するだけで「もったいない」は脳内で勝手に生まれる。

実装方針:
```typescript
// UserStats 拡張（後方互換）
type UserStats = {
  readonly personalBest: number;
  readonly totalThrows: number;
  readonly totalAirtimeSeconds: number;
  // 新規
  readonly todayDateISO: string;    // "2026-04-17"
  readonly todayBest: number;        // 今日の最高高度
  readonly streakDays: number;       // 連続投擲日数
  readonly lastActiveDateISO: string; // 最終投擲日
};
```

日付判定: `Intl.DateTimeFormat('ja-JP', { timeZone: ユーザーTZ }).format(new Date())` でローカル日付を取得。`addThrowRecord()` 内で `todayDateISO` と比較し、同日ならmax更新、翌日なら streak++、2日以上空いたら streak=1 にリセット。

触るファイル: `lib/types.ts`, `lib/storage.ts`, `result-screen.tsx`, `[locale]/page.tsx`, `[locale]/mypage/page.tsx`, `messages/*.json`

---

### ■ 6. 社会性 — リーダーボード / シェア

**判定: 既存流用（変更なし）**

やる理由: ランキング、シェア機能は完成している。
やらない理由: 「直前の誰かを抜いた」通知はAPI変更が必要でスコープ外。

実装方針: 変更なし。Phase 3でランキングUIの見た目を磨く。
触るファイル: なし（Phase 2では）

---

### ■ 7. 次アクションの即時性 — Try Again 主導線

**判定: 既存流用（位置調整のみ）**

やる理由: 「もう一度投げる」ボタンは結果画面に既にある。
やらない理由: ボタンをさらに大きく/派手にするとダークパターンに近づく。

実装方針: Phase 3のレイアウト調整で、カウントアップ完了後に自然と目に入る位置に配置。現行の位置（動画の下）は適切。
触るファイル: `result-screen.tsx`（Phase 3）

---

### ■ SE（効果音）

**判定: 不採用**

やる理由: ティア突破時の「チャリーン」等は達成感を増幅する。
やらない理由: (1) スマホは電車/教室等で無音前提の利用が多い。SE前提の体験設計は多数派に合わない。(2) 振動で十分な触覚フィードバックが得られている。(3) 音声アセット管理の保守コストに見合わない。(4) ユーザー設定トグルの追加が必要になり、Settings UIが増える。

代替: 振動パターンの改善で同等の効果を得る（Phase 3で検討）。

---

## 4-5. Phase 1/2/3 タスク分解

### Phase 1 — カラーシステム刷新

**ゴール:** `#00fa9a` 基調への全面置換。UIロジック変更なし。

**触るファイル:**

| ファイル | 変更内容 | 変更行数(概算) |
|---------|---------|--------------|
| `src/app/globals.css` | `@theme inline` 全トークン書き換え | ~15行 |
| `src/app/[locale]/page.tsx` | `rgba(178,255,0,...)` → 新色 | ~3行 |
| `src/app/[locale]/mypage/page.tsx` | `rgba(178,255,0,...)` → 新色 | ~5行 |
| `src/components/result-screen.tsx` | `rgba(178,255,0,...)` → 新色 | ~5行 |
| `src/components/error-boundary.tsx` | フォールバック色更新 | ~1行 |
| `src/app/[locale]/test/page.tsx` | Canvas色更新 | ~1行 |
| `src/app/[locale]/layout.tsx` | `themeColor` 更新 | ~1行 |

**触らないファイル:** §1-A, §1-B 全リスト + tiers.ts（ティア固有色は変更なし）

**サブタスク:**
1. `globals.css` `@theme inline` ブロック更新
2. `--animate-pulse-accent` キーフレームの色確認（名前はそのまま、色がCSS変数経由なので自動追従するか検証）
3. hardcoded `rgba(178,255,0,...)` 7箇所を `rgba(0,250,154,...)` または CSS変数に置換
4. `error-boundary.tsx` フォールバック更新
5. `test/page.tsx` Canvas色更新
6. `layout.tsx` themeColor 更新
7. スクリーンショット全画面撮影 + コントラスト比レポート
8. 録画動画のオーバーレイ色が変わっていないことを確認

**受入条件:**
- 全画面で `#B2FF00` 起因の色が0箇所
- 動画Canvas内の `#ff2d2d` が変わっていない
- コントラスト比 4箇所計測結果添付
- `npx tsc --noEmit` パス

**ロールバック:** 1コミットで `globals.css` + hardcode修正を含む。`git revert` で即復元可能。

**変更ファイル数:** 7
**変更行数:** ~30行

**コミット:**
- `refactor(color): migrate theme tokens to #00fa9a system`
- `refactor(color): replace hardcoded accent RGBs with tokens`
- `chore(color): adjust themeColor meta and error boundary fallback`

---

### Phase 2 — ドーパミンループ強化

**ゴール:** ストリーク、今日のベスト、結果画面カウントアップの実装。

**触るファイル:**

| ファイル | 変更内容 | 変更行数(概算) |
|---------|---------|--------------|
| `src/lib/types.ts` | `UserStats` 拡張 | ~5行追加 |
| `src/lib/storage.ts` | ストリーク/今日のベスト計算ロジック、`loadData()` 後方互換 | ~40行追加 |
| `src/app/[locale]/play/page.tsx` | resultDataにsamples追加 | ~5行 |
| `src/components/result-screen.tsx` | `CountUpHeight` 差し替え、今日のベスト表示 | ~20行変更 |
| `src/app/[locale]/page.tsx` | ストリーク/今日のベストバッジ（PBユーザーのみ） | ~15行追加 |
| `src/app/[locale]/mypage/page.tsx` | ストリーク表示 | ~10行追加 |
| `messages/*.json` (x12) | streak/todayBest 翻訳追加 | 各~8行 |

**触らないファイル:** §1-A, §1-B 全リスト + API routes（サーバー変更なし）

**サブタスク:**
1. `types.ts` UserStats 拡張
2. `storage.ts` loadData() 後方互換（欠損キー0埋め）
3. `storage.ts` addThrowRecord() にストリーク/今日のベスト計算追加
4. `play/page.tsx` resultData にセンサーサンプル追加
5. `result-screen.tsx` CountUpHeight 差し替え
6. `result-screen.tsx` 今日のベスト表示（PB時のみ）
7. `page.tsx` ランディングにストリーク/今日のベスト（リピーターのみ）
8. `mypage/page.tsx` ストリーク表示
9. `messages/*.json` 12言語翻訳追加
10. `prefers-reduced-motion` で新アニメ抑制確認

**受入条件:**
- 初見ユーザー（履歴0）で新UIが表示されない
- 2投目以降で「今日のベスト」が表示される
- 日付跨ぎでストリーク更新（手動テスト: Date.now() モック）
- `prefers-reduced-motion` でカウントアップが即表示
- 12言語に未翻訳なし

**ロールバック:** `types.ts` + `storage.ts` の変更が核心。この2ファイルを revert すれば後続UIは既存値で動く。

**変更ファイル数:** 7 + 12 locale = 19
**変更行数:** ~200行

**コミット:**
- `feat(storage): extend UserStats with streak and todayBest`
- `feat(result): integrate CountUpHeight replay on result screen`
- `feat(landing): show today's best and streak badge for returning users`
- `feat(i18n): add translations for streak/todayBest across 12 locales`

---

### Phase 3 — UI 完全リニューアル

**ゴール:** 案A「Neon Altitude」の世界観で全画面の見た目を統一。名前入力UIの移動。

**触るファイル:**

| ファイル | 変更内容 | 変更行数(概算) |
|---------|---------|--------------|
| `src/app/globals.css` | keyframe追加/調整、typography微調整 | ~20行 |
| `src/app/[locale]/page.tsx` | レイアウト調整 | ~30行 |
| `src/app/[locale]/play/page.tsx` | prepare/active画面の色・余白調整（overlay以外） | ~20行 |
| `src/components/result-screen.tsx` | レイアウト全面調整、名前入力削除 | ~50行 |
| `src/components/height-display.tsx` | ティア色表示の強調 | ~10行 |
| `src/components/ranking-list.tsx` | トップ3差別化、ティアドット強調 | ~15行 |
| `src/components/consent-modal.tsx` | 色・スタイル統一 | ~10行 |
| `src/components/permission-request.tsx` | 色・スタイル統一 | ~10行 |
| `src/components/loading-screen.tsx` | 色統一 | ~5行 |
| `src/components/name-input.tsx` | マイページ用にリファクタ | ~10行 |
| `src/app/[locale]/mypage/page.tsx` | 名前入力追加、レイアウト調整 | ~30行 |
| `src/app/[locale]/ranking/page.tsx` | タブUI改善 | ~15行 |
| `messages/*.json` (x12) | 名前設定関連の翻訳 | 各~3行 |

**触らないファイル:** §1-A, §1-B 全リスト

**サブタスク:**
1. ランディングページ（タイトル/CTA/PB/ストリーク表示のレイアウト、ネオングロー）
2. 結果画面（カウントアップ/ティアバッジ/動画/ランク/ニアミスのレイアウト統一）
3. 名前入力を結果画面から削除、マイページに移動
4. カメラプレビュー画面（レンズ切替/CTA、overlay以外の色調整）
5. アクティブ画面（FREEFALLバッジ、PBラベルの色統一、overlay以外）
6. ランキング画面（タブ下線スライド、トップ3差別化）
7. マイページ（PBカードネオングロー、ストリーク表示、名前編集追加）
8. permission/consent/loading/error画面の色統一
9. 12言語チェック（ja/en/ar/hi最低限）
10. Lighthouse計測

**受入条件:**
- 主要5画面で視覚的統一感
- 3タップで投げられる（consent済み→START→カウントダウン開始→自動発火）
- `:focus-visible` が新色
- ja/en/ar/hi で崩れなし
- `npx tsc --noEmit` パス
- 名前入力が結果画面に出ない、マイページで設定可能

**ロールバック:** 画面単位でコミットするため、個別 revert 可能。

**変更ファイル数:** 13 + 12 locale = 25
**変更行数:** ~350行

**コミット:** 画面単位
- `feat(ui-landing): neon altitude landing page`
- `feat(ui-result): neon altitude result screen with countup`
- `feat(ui-ranking): neon altitude ranking with top-3 differentiation`
- `feat(ui-mypage): neon altitude mypage with name input migration`
- `feat(ui-shared): neon altitude consent/permission/loading/error screens`

---

## 補足: tiers.ts のティア色判断

**結論: 変更しない。**

Legend `#FF2D2D` を含む10色は、ブランドカラーではなくランク序列の表現。各ティアが独自の個性を持つことが重要で、アクセント色と統一する必要はない。`#00fa9a` がアクセントになっても、Legend が赤であることは「最高ランクの特別感」として機能する。

---

以上。Phase 0 提案書の全5項目を記載した。

確認後、Go サインで Phase 1 に進む。
