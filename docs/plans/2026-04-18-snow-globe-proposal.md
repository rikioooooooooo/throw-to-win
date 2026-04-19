# Snow Globe — Phase 0 提案書

作成日: 2026-04-18
作成者: Claude Opus 4.7

---

## 目次

- [0-1. リポジトリ検証](#0-1-リポジトリ検証)
- [0-2. こすくまくんアセット調査](#0-2-こすくまくんアセット調査)
- [0-3. Three.js ライブラリ選定](#0-3-threejs-ライブラリ選定)
- [0-4. 入力設計](#0-4-入力設計)
- [0-5. 物理モデル](#0-5-物理モデル)
- [0-6. Bloom エフェクト](#0-6-bloom-エフェクト)
- [0-7. こすくまくんシルエット壁](#0-7-こすくまくんシルエット壁)
- [0-8. デバイス能力ティア](#0-8-デバイス能力ティア)
- [0-9. ビジュアル方向性](#0-9-ビジュアル方向性)
- [0-10. 2D フォールバック](#0-10-2d-フォールバック)
- [0-11. START ボタン統合](#0-11-start-ボタン統合)
- [0-12. タスク分解](#0-12-タスク分解)

---

## 0-1. リポジトリ検証

指示書の前提をソースコードと全行突合した。全項目一致。

### LP ページ (`src/app/[locale]/page.tsx`)

| 行 | 内容 | 状態 |
|----|------|------|
| L11 | `import { GyroBars } from "@/components/gyro-ball"` | 一致 |
| L52-62 | `handleGyroPermission`: `DeviceMotionEvent.requestPermission()` を iOS 初回タップで呼び出し | 一致 |
| L65 | `<main ... onClick={handleGyroPermission}>` | 一致 |
| L66 | `<GyroBars className="fixed inset-0 z-0 pointer-events-none" />` | 一致 |

### GyroBars (`src/components/gyro-ball.tsx`)

| 項目 | 実装 | 状態 |
|------|------|------|
| export | `export function GyroBars` | 一致 |
| センサー | `deviceorientation` イベント、`e.beta` / `e.gamma` 使用 | 一致 |
| キャリブレーション | `betaOffsetRef` で初回 beta を基準点として保存 | 一致 |
| フォールバック | 2秒タイマー(`GYRO_TIMEOUT_MS = 2000`)、sin/cos ドリフト | 一致 |
| アクセシビリティ | `prefers-reduced-motion: reduce` で即 return | 一致 |
| 描画 | Canvas 2D: 床(inset矩形)、壁(台形)、エッジライン(4本)、ポール(円) | 一致 |

### package.json

| パッケージ | 状態 |
|-----------|------|
| `three` | **未インストール** |
| `postprocessing` | **未インストール** |
| `react` | 19.2.4 |
| `next` | 16.2.3 |

### device-capability.ts

| 項目 | 実装 | 状態 |
|------|------|------|
| `QualityTier` | `"high" | "medium" | "low"` | 一致 |
| high 閾値 | `cores >= 6` | 一致 |
| medium 閾値 | `cores >= 4` | 一致 |
| `deviceMemory` | 使用していない(Safari/iOS で取得不可のため) | 一致 |

### 凍結対象ファイル

以下のファイルは Snow Globe 実装で**一切変更しない**:

- `src/lib/physics.ts`
- `src/lib/sensor.ts`
- `src/lib/anti-cheat.ts`
- `src/hooks/use-throw-detection.ts`
- `src/hooks/use-camera.ts`
- `src/lib/video-processor.ts`
- `src/app/api/verify/route.ts`
- `src/app/api/challenge/route.ts`
- `src/lib/challenge.ts`
- `src/lib/fingerprint.ts`
- `migrations/*.sql`
- `src/app/[locale]/play/page.tsx` のオーバーレイセクション
- `src/components/slow-mo-player.tsx`
- `src/components/gyro-ball.tsx` (2D フォールバックとして温存)

---

## 0-2. こすくまくんアセット調査

### 現状

`src/components/tier-icon.tsx` にこすくまくんの全 SVG パスデータがインライン記述されている。

- viewBox: `0 0 648.37 444.18`
- パーツ: おしり、右耳、左耳、右腕、左腕、顔、左目、右目、鼻、しっぽ、ほくろ
- 塗りは `<pattern>` + テクスチャ画像、輪郭は `#040000` (OUTLINE定数)
- 全パスデータは React JSX 内の `d` 属性として存在
- **独立した `.svg` / `.png` ファイルは存在しない**

### Snow Globe 用アセット方針

**Three.js の `SVGLoader` を使用するため、SVG 文字列をランタイムで構築する。**

手順:
1. `tier-icon.tsx` から輪郭パス(`fill={OUTLINE}`)の `d` 属性値を抽出
2. `src/components/snow-globe/kosukuma-paths.ts` に定数配列として配置
3. ランタイムで SVG 文字列を組み立て → `SVGLoader.parse()` → `ShapeGeometry`

塗りパスは不要。シルエットとして使うため、輪郭パスのみ抽出する。

### 抽出対象パス一覧

| パーツ | 行 | 用途 |
|--------|-----|------|
| 右耳 | L61 | 輪郭 |
| 右腕 | L65 | 輪郭 |
| おしり | L67 | 輪郭(メイン胴体) |
| 顔 | L71 | 輪郭(メイン顔面) |
| 左耳 | L75 | 輪郭 |
| 左目 | L77 | `<circle>` → パス変換 |
| 右目 | L79 | `<circle>` → パス変換 |
| 鼻 | L81 | 輪郭 |
| 左腕 | L85 | 輪郭 |
| しっぽ | L89 | 輪郭 |
| ほくろ | L91 | `<ellipse>` → パス変換 |

`<circle>` と `<ellipse>` は SVGLoader が直接パースできないため、アーク記法のパスに事前変換する。

---

## 0-3. Three.js ライブラリ選定

### 推奨: `three` + `postprocessing` (pmndrs)

| パッケージ | gzip サイズ | 役割 |
|-----------|-----------|------|
| `three` | ~150 KB | 3D レンダリング、SVGLoader、InstancedMesh |
| `postprocessing` | ~30 KB | SelectiveBloomEffect (Bloom ティア用) |

### R3F (react-three-fiber) を採用しない理由

1. Snow Globe は LP 背景であり、React コンポーネントツリーとのインタラクションが最小限
2. R3F の宣言的 API は 15,000 パーティクルの手動制御に不向き(`useFrame` + 参照操作になるため生 Three.js と変わらない)
3. バンドルが `@react-three/fiber` (~40KB) + `@react-three/drei` (~可変) 分増える
4. 生 Three.js の方が `dispose()` / `forceContextLoss()` のタイミングを完全制御できる(センサーサーマルドリフト対策に必須)

### バンドル影響

LP 初期ロードには影響なし。Snow Globe コンポーネント全体を `dynamic(() => import(...), { ssr: false })` で遅延ロードする。

```
LP 初期バンドル: 変化なし
Snow Globe チャンク: ~180 KB gzip (three + postprocessing + 自前コード)
ロードタイミング: LP マウント後に非同期ロード → WebGL コンテキスト初期化 → 描画開始
```

### インストールコマンド

```bash
npm install three postprocessing
npm install -D @types/three
```

---

## 0-4. 入力設計

### A. 傾き (Tilt)

**方式: `DeviceOrientationEvent` (beta / gamma)**

既存の `gyro-ball.tsx` と同じ `deviceorientation` イベントを使用する。

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| イベント | `deviceorientation` | GyroBars と同一。一貫性重視 |
| X軸入力 | `e.gamma / 35` | GyroBars L77 と同じ正規化 |
| Y軸入力 | `(e.beta - betaOffset) / 35` | GyroBars L78 と同じ。初回 beta でキャリブレーション |
| 重力方向 | 傾きベクトルから 3D 重力ベクトルを算出 | `gx = -sin(gamma) * 9.81 * 0.8`, `gy = sin(beta-offset) * 9.81 * 0.8` |
| スムージング | 低域フィルタ `current += (target - current) * 0.15` | 急な傾き変化をなめらかに |

**iOS パーミッション:** LP 上の `handleGyroPermission` (L53-62) が初回タップで `DeviceMotionEvent.requestPermission()` を呼ぶ。これにより `deviceorientation` も許可される(iOS は Motion/Orientation を同一パーミッションで管理)。Snow Globe 側で追加のパーミッション要求は不要。

### B. シェイク (Shake)

**方式: `DeviceMotionEvent.acceleration`**

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| イベント | `devicemotion` | `acceleration` (重力除去済み) を使用 |
| 発火閾値 | 加速度マグニチュード > **12 m/s^2** | 手首を振る動作で 15-25 m/s^2 程度。12 は軽い振りでも拾える閾値 |
| クールダウン | **300 ms** | 連打防止。1振り = 1インパルスを保証 |
| インパルス方向 | 加速度ベクトルの**逆方向** | 「振った方向から跳ね返る」直感に合致 |
| ランダム拡散 | 方向に **+/-15度** のランダム回転 | 毎回同じ軌道にならない |
| インパルス強度 | `min(accelMagnitude / 25, 1.0) * MAX_IMPULSE` | 加速度に比例、上限あり |

```typescript
// 疑似コード
const mag = Math.sqrt(ax*ax + ay*ay + az*az);
if (mag > 12 && now - lastShakeTime > 300) {
  lastShakeTime = now;
  const dir = normalize(-ax, -ay, -az); // 逆方向
  const spread = randomRotation(dir, 15 * DEG2RAD); // +-15度
  const strength = Math.min(mag / 25, 1.0);
  applyImpulse(spread, strength * MAX_IMPULSE);
}
```

### C. 初回ディスカバリー (Auto-Impulse)

**採用: マウント後 1.2 秒で自動インパルスを発射。**

やる理由:
- ユーザーはパーティクルが動くことを知らない。静止状態だと「ただの背景」と認識して傾けもしない
- 1.2 秒は LP テキストが読める前の「目が泳ぐ」瞬間。そこでパーティクルが動き始めると注意を引ける
- 40% 強度なので派手すぎず、「お、動くのか」と気づかせる程度

やらない理由のリスク:
- アニメーション酔いの可能性。ただし `prefers-reduced-motion` チェックで無効化するため問題なし

| パラメータ | 値 |
|-----------|-----|
| 遅延 | 1200 ms |
| 強度 | `MAX_IMPULSE * 0.4` |
| 方向 | 上向き(+Y) + ランダム拡散 +-30度 |
| 発火条件 | `prefers-reduced-motion` が `no-preference` の場合のみ |
| 1回のみ | `useRef(false)` で再発火防止 |

### D. カメラ (視点)

**方式: 固定視点 — カメラは動かさない。**

やる理由:
1. こすくまくんシルエットが常に見える。カメラ追従だとシルエットがフレームアウトする
2. LP のテキスト(タイトル、CTA)とパーティクルの位置関係が安定する
3. 実装が単純。`camera.position.set(0, 0, 2.5)` + `lookAt(0, 0, 0)` で固定

やらない理由(カメラ追従を不採用とする理由):
- 傾き入力でカメラも動くと、パーティクルの相対運動がキャンセルされて「動いている感」が減る
- 画面上の UI 要素(テキスト、ボタン)が揺れて酔いの原因になる

カメラパラメータ:

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| Position | `(0, 0, 2.5)` | ボックス全体がビューポートに収まる距離 |
| FOV | `60` | モバイル画面でちょうど良い画角 |
| Near / Far | `0.1 / 10` | ボックス内のみ描画 |
| Rotation | なし(固定) | UI安定性 |

---

## 0-5. 物理モデル

### ボックス空間

```typescript
const BOX_WIDTH  = 2.0;   // x: -1.0 ~ +1.0
const BOX_HEIGHT = 2.0 * (screenHeight / screenWidth); // y: アスペクト比連動
const BOX_DEPTH  = 1.2;   // z: -0.6 ~ +0.6
```

- `BOX_HEIGHT` を画面アスペクト比に連動させることで、縦長画面(モバイル)でもボックスが画面を埋める
- iPhone 16 Pro (402x874): `BOX_HEIGHT = 2.0 * (874/402) = 4.35`
- `BOX_DEPTH = 1.2` は奥行き方向の余裕。Bloom の散乱を収めるのに十分

### パーティクル数

| ティア | パーティクル数 | 根拠 |
|--------|-------------|------|
| Full (Bloom あり) | **15,000** | InstancedMesh で 1 draw call。GPU 負荷はメッシュ数ではなく描画ピクセル数に依存 |
| No-Bloom | **8,000** | Bloom なしでも視覚密度を確保しつつ CPU 負荷を抑える |
| 2D フォールバック | **0** (GyroBars 使用) | Three.js 不使用 |

### 物理パラメータ

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| 重力スケール | **0.8** | 実際の 9.81 m/s^2 は画面スケールで速すぎる。0.8 倍で「水中」感が出る |
| 減衰 (Damping) | **v *= 0.92 / frame** | スノーグローブ内の液体粘性。0.92 で約 3 秒かけて速度半減 |
| ブラウン運動 | **+/-0.003 / 軸 / frame** | パーティクルが完全に静止しない。微かな揺らぎが生命感を与える |
| 壁反発係数 | **0.3** | 壁にぶつかっても跳ね返らず「吸収される」感覚。水中なので |
| dt 制限 | **Math.min(frameDelta, 0.033)** | 33ms = ~30fps。タブ復帰時の dt 爆発を防止 |
| サブステップ | **1** | パーティクル間衝突なし。壁判定のみなので 1 ステップで十分 |

### パーティクル間衝突

**不採用。**

15,000 パーティクルの全対判定は O(n^2) = 2.25 億回/frame。空間分割(BVH / Grid)でも O(n * k) で数百万回。モバイル CPU では 16ms を守れない。

代替策: パーティクルが密集する底面付近で若干の上向きランダム力を加え、「積み重なる」ような視覚効果を出す。物理的正確性は不要 — 見た目がそれっぽければ良い。

### 更新ループ

```typescript
// 疑似コード — 1フレームの物理更新
function updateParticles(dt: number, gravity: Vec3, particles: Float32Array) {
  const clampedDt = Math.min(dt, 0.033);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const offset = i * 6; // [px, py, pz, vx, vy, vz]

    // 重力 + ブラウン運動
    particles[offset + 3] += gravity.x * clampedDt + (Math.random() - 0.5) * 0.006;
    particles[offset + 4] += gravity.y * clampedDt + (Math.random() - 0.5) * 0.006;
    particles[offset + 5] += gravity.z * clampedDt + (Math.random() - 0.5) * 0.006;

    // 減衰
    particles[offset + 3] *= 0.92;
    particles[offset + 4] *= 0.92;
    particles[offset + 5] *= 0.92;

    // 位置更新
    particles[offset + 0] += particles[offset + 3] * clampedDt;
    particles[offset + 1] += particles[offset + 4] * clampedDt;
    particles[offset + 2] += particles[offset + 5] * clampedDt;

    // 壁衝突
    wallBounce(particles, offset, BOX_HALF_W, BOX_HALF_H, BOX_HALF_D, 0.3);

    // こすくまシルエット衝突
    silhouetteCollision(particles, offset);
  }
}
```

---

## 0-6. Bloom エフェクト

### ライブラリ: `postprocessing` の `SelectiveBloomEffect`

**`UnrealBloomPass` を不採用とする理由:**

| 項目 | UnrealBloomPass | SelectiveBloomEffect |
|------|----------------|---------------------|
| 起源 | Three.js 同梱 examples | pmndrs/postprocessing |
| 全画面ブラー | 必須(全オブジェクトに適用) | 選択的(特定レイヤーのみ) |
| パフォーマンス | 重い(複数パス) | 軽い(EffectComposer で1パス統合) |
| 解像度制御 | 手動 | `resolutionScale` で簡単に半解像度化 |

### Bloom パラメータ

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| threshold | **0.1** | パーティクル色 `#00fa9a` の輝度(0.71)は十分高い。0.1 でほぼ全パーティクルが発光 |
| intensity | **1.0** | 控えめな発光。パーティクル周囲にうっすらとしたグロー |
| radius | **0.5** | グローの広がり。0.5 で隣のパーティクルとグローが重なり始める距離 |
| resolutionScale | **0.5** | Bloom テクスチャを半解像度で計算。モバイルGPU負荷を半減 |
| luminanceSmoothing | **0.1** | 急な明暗変化を緩和 |

### レイヤー分離

```
Layer 0 (Default): UI要素(なし — Snow Globe は Canvas のみ)
Layer 1 (Bloom):   パーティクル InstancedMesh
```

`SelectiveBloomEffect` に Layer 1 のみ登録。背景やシルエット壁は Bloom 対象外。

### バッテリー自動オフ

**採用。**

```typescript
// Battery Status API (Chrome/Edge のみ、Safari 非対応)
async function shouldDisableBloom(): Promise<boolean> {
  if (!('getBattery' in navigator)) return false;
  const battery = await (navigator as any).getBattery();
  return !battery.charging && battery.level < 0.20;
}
```

- バッテリー残量 20% 未満 & 充電中でない場合、Bloom を無効化して No-Bloom ティアにフォールバック
- Safari では Battery Status API が使えないため、常に Bloom 有効のまま(コア数判定で制御)
- チェックタイミング: コンポーネントマウント時の1回のみ。バッテリーレベル変化のリアルタイム監視は不要(LP滞在時間は短い)

---

## 0-7. こすくまくんシルエット壁

### コンセプト

ボックスの中央やや手前に、こすくまくんのシルエットが「ガラスの壁」として浮かぶ。パーティクルはシルエットの輪郭に沿って集まり、内側を通過できない。

### SVG → Three.js 変換

```
tier-icon.tsx の d 属性
  → kosukuma-paths.ts (定数配列)
  → ランタイムで SVG 文字列構築
  → SVGLoader.parse()
  → ShapePath[] → Shape[] → ShapeGeometry
  → Mesh (MeshBasicMaterial, transparent, opacity: 0.03)
```

### 配置パラメータ

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| Z位置 | **0.3** (ボックス前面から約25%) | 手前すぎるとパーティクルが裏に溜まって見えない。0.3 なら前後に余裕がある |
| スケール | ボックス高の **60%** | 大きすぎると壁として支配的になりすぎる。60% で「中にいる」感覚 |
| 水平位置 | **中央** | こすくまくんは左右対称ではないが、視覚的重心で中央配置 |
| マテリアル | `MeshBasicMaterial({ transparent: true, opacity: 0.03, color: 0x00fa9a })` | ほぼ見えないが、パーティクルが集まると輪郭が浮かび上がる |

### 可視性: ハイブリッド方式 (吸引 + 内部不可視)

**パーティクルがシルエット輪郭に引き寄せられ、内部には侵入できない。**

#### 吸引力 (Attraction)

シルエット輪郭からの距離に応じた吸引力を適用:

```typescript
// 輪郭からの距離が 0.15 以内のパーティクルに吸引力
const distToOutline = computeDistanceToOutline(px, py, silhouettePath);
if (distToOutline < 0.15) {
  const attractionForce = (0.15 - distToOutline) * 0.02;
  // 輪郭方向に引っ張る
  vx += dirToOutline.x * attractionForce;
  vy += dirToOutline.y * attractionForce;
}
```

これにより、重力で底面に沈んだパーティクルの一部がこすくまの輪郭に沿って分布し、シルエットが「パーティクルで描かれる」効果が生まれる。

#### 内部衝突 (Interior Collision)

```typescript
// Z平面通過チェック + 2D isPointInPath
if (Math.abs(pz - SILHOUETTE_Z) < 0.05) { // Z方向の判定厚み
  if (isPointInsideSilhouette(px, py)) {
    // Z方向に押し戻す
    vz *= -WALL_RESTITUTION;
    pz = SILHOUETTE_Z + Math.sign(pz - SILHOUETTE_Z) * 0.05;
  }
}
```

`isPointInsideSilhouette` は Canvas 2D の `isPointInPath` を利用。`Path2D` オブジェクトをマウント時に1回だけ生成し、オフスクリーン Canvas でヒットテストする。

パフォーマンス考慮: 全 15,000 パーティクルに対して毎フレーム `isPointInPath` を呼ぶと重い。最適化:
- Z 座標がシルエットの +-0.05 範囲外のパーティクルはスキップ (大多数がスキップされる)
- バウンディングボックスで事前判定 (シルエットの矩形外ならスキップ)

### 呼吸 (Breathing)

**採用。こすくまシルエットに微かな生命感を与える。**

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| Z振動 | **+/-0.03** (sin波、周期 4秒) | 前後にわずかに揺れる。パーティクルとの相互作用で動きが生まれる |
| スケール変動 | **+/-0.5%** (sin波、周期 6秒) | Z振動と異なる周期で、単調さを避ける |
| 位相差 | Z と スケールで位相を 90度ずらす | 同時に極大/極小にならない |

```typescript
const breathZ = Math.sin(time * (2 * Math.PI / 4)) * 0.03;
const breathScale = 1.0 + Math.sin(time * (2 * Math.PI / 6) + Math.PI / 2) * 0.005;
silhouetteMesh.position.z = SILHOUETTE_Z + breathZ;
silhouetteMesh.scale.setScalar(baseScale * breathScale);
```

---

## 0-8. デバイス能力ティア

### 既存の `device-capability.ts` との統合

現行の `QualityTier` (`high` / `medium` / `low`) を拡張するのではなく、Snow Globe 専用の判定関数を新設する。既存の `detectCapabilities()` / `detectPerformanceTier()` は凍結対象ファイル内の `/play` ページ用であり、変更しない。

### Snow Globe 3段階ティア

```typescript
type SnowGlobeTier = "full" | "no-bloom" | "2d-fallback";
```

| ティア | 条件 | 描画方式 | パーティクル数 |
|--------|------|---------|-------------|
| **full** | `canRun3D` AND `canRunBloom` | Three.js + Bloom | 15,000 |
| **no-bloom** | `canRun3D` AND NOT `canRunBloom` | Three.js のみ | 8,000 |
| **2d-fallback** | NOT `canRun3D` | GyroBars (既存) | 0 |

### 判定ロジック

```typescript
function detectSnowGlobeTier(): SnowGlobeTier {
  // prefers-reduced-motion → 2D フォールバック
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "2d-fallback";
  }

  // WebGL 存在チェック
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return "2d-fallback";

  const cores = navigator.hardwareConcurrency ?? 2;

  // 3D 実行可能: WebGL あり + 4コア以上 (A12+ / SD 845+)
  const canRun3D = cores >= 4;
  if (!canRun3D) return "2d-fallback";

  // Bloom 実行可能: 6コア以上 (A14+ / SD 870+)
  const canRunBloom = cores >= 6;
  return canRunBloom ? "full" : "no-bloom";
}
```

### コア数閾値の根拠

| 閾値 | 対象デバイス | 判断 |
|------|------------|------|
| 4コア (`canRun3D`) | iPhone SE2/SE3 (A13, 6コア) → pass, iPhone 8 (A11, 6コア) → pass, Galaxy A14 (Helio G80, 8コア) → pass | **4コアでエントリーレベル Android をカバー。** A12 Bionic は 6コアだが、4コアの SD 845 世代でも WebGL + 8,000 パーティクルは十分動く |
| 6コア (`canRunBloom`) | iPhone 12+ (A14+, 6コア) → pass, iPhone 16 Pro (A18 Pro, 6コア) → **pass** | **重要: iPhone 16 Pro は 6コアであり、指示書の8コア閾値では Bloom が無効になる。6コアに引き下げることで iPhone 12 以降全機種で Bloom 有効** |

### フォールバック条件まとめ

```
prefers-reduced-motion: reduce → 2d-fallback (即決)
WebGL なし                     → 2d-fallback
cores < 4                     → 2d-fallback
4 <= cores < 6                → no-bloom (8,000 particles)
cores >= 6                    → full (15,000 particles + Bloom)
Battery < 20% (非充電)          → no-bloom にダウングレード
```

---

## 0-9. ビジュアル方向性

### 推奨: B「ミネラル水ラメ」

**個々のパーティクルが肉眼で識別できるサイズ (2-3px) で漂う。**

| 項目 | 値 | 根拠 |
|------|-----|------|
| パーティクルサイズ | **2-3px** (InstancedMesh のジオメトリサイズ: 0.004-0.006) | 1px 以下だと Retina 以外で見えない。4px 以上だと「粒」感がなくなる |
| パーティクル形状 | **球 (IcosahedronGeometry, detail=1)** | 三角形数 80。15,000 * 80 = 120万三角形。InstancedMesh なので 1 draw call |
| パーティクル色 | **`#00fa9a` (Bloom あり) / `#00d485` (Bloom なし)** | Bloom ありの場合、元色を少し落として Bloom で加算される |
| パーティクル透明度 | **0.6-0.9 (ランダム)** | 均一だと人工的。ランダム透明度で奥行き感 |
| 背景との関係 | パーティクルの向こう側に LP テキストが透ける | `renderer.setClearColor(0x000000, 0)` で透過。Canvas は z-index: 0、テキストは z-index: 10 |

### 案 A「吹雪」を不採用とする理由

- 1px 以下のパーティクルは非 Retina 端末で消失する
- パーティクル密度で形を出す方式は、こすくまシルエットの輪郭がぼやける
- テキストの可読性に悪影響(半透明の粒子が無数に覆う)

### 案 C「オーロラ」を不採用とする理由

- パーティクルが見えないと「何が動いているか」が分からない
- ボリュームレンダリング風の処理は GPU 負荷が高い
- こすくまシルエットとの相互作用が見えない

### テキスト可読性の確保

LP 上のテキスト(タイトル「Throw To Win」、CTA「START」、PB表示)は Snow Globe Canvas の上に配置される。パーティクルがテキストと重なった場合の可読性:

- パーティクルサイズ 2-3px かつ透明度 0.6-0.9 → テキストの 1 文字に重なるパーティクルは多くて 2-3 個
- テキストには `text-shadow: 0 0 10px rgba(0,0,0,0.8)` を追加して背景を確保
- テキストエリア直下のパーティクルを排除する方式は **不採用** (自然さが失われる)

---

## 0-10. 2D フォールバック

### GyroBars との比較

| 項目 | Snow Globe (3D) | GyroBars (2D) |
|------|----------------|---------------|
| レンダラー | Three.js WebGL | Canvas 2D |
| パーティクル | 8,000-15,000 球体 | 1,440 円(12x20x6 グリッド) |
| 物理 | 重力 + 減衰 + 壁衝突 + シルエット衝突 | なし(パララックスのみ) |
| Bloom | あり (full ティア) | なし |
| シルエット | こすくまくん + 吸引 | なし |
| 入力 | 傾き + シェイク | 傾きのみ |
| 深度表現 | 実際の 3D 空間 | 疑似パース(ポールのスケール) |
| バンドルサイズ | ~180KB 追加 | 0 (既存) |

### フォールバック条件

`detectSnowGlobeTier()` が `"2d-fallback"` を返した場合、**既存の `<GyroBars>` をそのまま使用**する。

LP コード上の分岐:

```tsx
// page.tsx
const tier = detectSnowGlobeTier();

return (
  <main>
    {tier === "2d-fallback" ? (
      <GyroBars className="fixed inset-0 z-0 pointer-events-none" />
    ) : (
      <SnowGlobe tier={tier} className="fixed inset-0 z-0 pointer-events-none" />
    )}
    {/* ... テキスト、CTA etc ... */}
  </main>
);
```

`gyro-ball.tsx` は変更しない。Snow Globe の 2D フォールバックとして温存する。

---

## 0-11. START ボタン統合

### 判定: Phase 2 (Snow Globe コアが動作してから)

**Phase 1 では実装しない。**

やらない理由:
1. Phase 1 のゴールは「Snow Globe が LP 背景として動作する」こと。START ボタンの挙動変更は追加のリスク
2. 現行の `handleStart()` (L34-46) は consent 判定 → router.push の 2 ステップ。ここに Snow Globe の dispose を挟むと、ナビゲーションタイミングが複雑化する
3. ボタンアニメーション(パーティクルが START に集まる等)は視覚的に魅力的だが、Phase 1 では Snow Globe の基本物理と描画で十分な作業量がある

### Phase 2 で検討する内容

- START タップ時にパーティクルが画面中央に収束 → 爆発 → ナビゲーション
- `dispose()` + `forceContextLoss()` のタイミング: アニメーション完了後、`router.push` 前
- ナビゲーション遅延の許容範囲: 最大 500ms (アニメーション完了まで)

---

## 0-12. タスク分解

### ファイル構成

```
src/components/snow-globe/
├── index.tsx                 # SnowGlobe コンポーネント(dynamic import エントリ)
├── snow-globe-scene.ts       # Three.js シーン構築・描画ループ・dispose
├── particle-system.ts        # パーティクル生成・物理更新
├── silhouette-wall.ts        # SVG → ShapeGeometry、衝突判定
├── kosukuma-paths.ts         # SVGパスデータ定数
├── bloom-effect.ts           # Bloom セットアップ(full ティア用)
├── input-handler.ts          # 傾き + シェイク入力処理
├── detect-tier.ts            # SnowGlobeTier 判定
└── types.ts                  # Snow Globe 固有型定義
```

### サブタスク一覧

---

#### Task 1: パッケージインストール + 型定義

**ファイル:** `package.json`

**内容:**
- `npm install three postprocessing`
- `npm install -D @types/three`

**受入条件:**
- `npx tsc --noEmit` パス
- `import * as THREE from 'three'` が型エラーなし

---

#### Task 2: デバイス能力判定

**ファイル:** `src/components/snow-globe/detect-tier.ts`

**内容:**
- `SnowGlobeTier` 型定義 (`"full" | "no-bloom" | "2d-fallback"`)
- `detectSnowGlobeTier()` 関数
- `prefers-reduced-motion` / WebGL / コア数 / バッテリーの4段階判定

**受入条件:**
- 関数が `SnowGlobeTier` を返す
- `prefers-reduced-motion: reduce` 設定時に `"2d-fallback"` を返す
- WebGL 非対応環境で `"2d-fallback"` を返す
- iPhone 16 Pro (6コア) で `"full"` を返す

---

#### Task 3: こすくまくん SVG パスデータ抽出

**ファイル:** `src/components/snow-globe/kosukuma-paths.ts`

**内容:**
- `tier-icon.tsx` から `fill={OUTLINE}` のパスの `d` 属性を抽出
- `<circle>` / `<ellipse>` をアーク記法パスに変換
- `KOSUKUMA_SVG_PATHS: readonly string[]` として export
- `KOSUKUMA_VIEWBOX` 定数 (`{ width: 648.37, height: 444.18 }`)

**受入条件:**
- 全 11 パーツのパスデータが含まれる
- SVG 文字列を構築して `SVGLoader.parse()` が正常にパースできる

---

#### Task 4: パーティクルシステム

**ファイル:** `src/components/snow-globe/particle-system.ts`

**内容:**
- `createParticleSystem(count: number): { mesh: InstancedMesh, data: Float32Array }`
- `updateParticles(data, dt, gravity, impulse?)`: 物理更新ループ
- `IcosahedronGeometry(0.005, 1)` + `MeshStandardMaterial({ color: 0x00fa9a, emissive: 0x00fa9a, emissiveIntensity: 0.5 })`
- 壁衝突(ボックス境界)
- 減衰 0.92
- ブラウン運動 +/-0.003

**受入条件:**
- 15,000 パーティクルが 1 draw call で描画される(`renderer.info.render.calls === 1`)
- 壁衝突でパーティクルがボックス外に出ない
- `dt > 0.033` の場合にクランプされる

---

#### Task 5: シルエット壁

**ファイル:** `src/components/snow-globe/silhouette-wall.ts`

**内容:**
- `createSilhouetteWall(): { mesh: Mesh, hitTest: (x, y) => boolean }`
- `SVGLoader` でパス解析 → `ShapeGeometry`
- `MeshBasicMaterial({ transparent: true, opacity: 0.03, color: 0x00fa9a })`
- `isPointInsideSilhouette()`: オフスクリーン Canvas + `Path2D` + `isPointInPath`
- 呼吸アニメーション(Z振動 + スケール変動)

**受入条件:**
- シルエットがボックス中央やや手前 (z=0.3) に配置される
- こすくまの形状が目視で確認できる(パーティクルが集まった状態)
- `isPointInsideSilhouette` が正しい判定を返す(目、鼻の位置で true)

---

#### Task 6: 吸引 + 衝突統合

**ファイル:** `src/components/snow-globe/particle-system.ts` (Task 4 に追加)

**内容:**
- `updateParticles` にシルエット吸引力を追加
- Z平面通過チェック + `isPointInsideSilhouette` による衝突
- バウンディングボックス事前判定による最適化

**受入条件:**
- パーティクルがシルエット輪郭に沿って集まる(重力で底面に沈んだ後)
- パーティクルがシルエット内部を貫通しない
- Z座標がシルエット範囲外のパーティクルは `isPointInPath` を呼ばない

---

#### Task 7: 入力ハンドラ

**ファイル:** `src/components/snow-globe/input-handler.ts`

**内容:**
- `createInputHandler(): { gravity: Vec3, impulse: Vec3 | null, dispose: () => void }`
- `deviceorientation` → 重力ベクトル変換(beta/gamma → gx/gy)
- `devicemotion` → シェイク検出(mag > 12, cooldown 300ms)
- 2秒フォールバック(gyro 未検出時の sin/cos ドリフト — GyroBars パターン踏襲)
- キャリブレーション(初回 beta をオフセット保存)

**受入条件:**
- デスクトップ(gyro なし)で 2 秒後にフォールバックドリフト開始
- シェイク検出後 300ms 以内の再検出が無視される
- `dispose()` で全イベントリスナー除去

---

#### Task 8: Bloom エフェクト

**ファイル:** `src/components/snow-globe/bloom-effect.ts`

**内容:**
- `createBloomComposer(renderer, scene, camera, particleMesh): { composer: EffectComposer, dispose: () => void }`
- `SelectiveBloomEffect` セットアップ
- `resolutionScale: 0.5`
- レイヤー分離(パーティクルのみ Bloom)

**受入条件:**
- `full` ティアでパーティクル周囲にグローが見える
- `no-bloom` ティアではこのモジュールがロードされない
- `dispose()` で EffectComposer のリソース解放

---

#### Task 9: シーン統合

**ファイル:** `src/components/snow-globe/snow-globe-scene.ts`

**内容:**
- `createSnowGlobeScene(canvas, tier): { dispose: () => void }`
- WebGLRenderer 初期化(`antialias: true, alpha: true, powerPreference: 'high-performance'`)
- カメラ設定(FOV 60, position (0, 0, 2.5))
- パーティクル + シルエット + 入力 + Bloom(ティア依存)の統合
- `requestAnimationFrame` ループ
- 初回ディスカバリーインパルス(1.2秒後)
- `dispose()`: cancelAnimationFrame → renderer.dispose() → renderer.forceContextLoss() → 全 geometry/material/texture を dispose

**受入条件:**
- `full` ティアで Bloom つきパーティクルが描画される
- `no-bloom` ティアで Bloom なしパーティクルが描画される
- `dispose()` 後に WebGL コンテキストが解放される(`gl.getExtension('WEBGL_lose_context').loseContext()`)
- メモリリークなし(Chrome DevTools → Performance → Memory で確認)

---

#### Task 10: React コンポーネント

**ファイル:** `src/components/snow-globe/index.tsx`

**内容:**
- `SnowGlobe` コンポーネント(`"use client"`)
- `useEffect` で `createSnowGlobeScene` → return `dispose`
- `useRef<HTMLCanvasElement>` でキャンバス参照
- props: `{ tier: SnowGlobeTier, className?: string }`
- `aria-hidden="true"` (装飾要素)

**受入条件:**
- コンポーネントのマウント/アンマウントでリソースが適切に管理される
- HMR (hot reload) でメモリリークしない
- `className` が canvas 要素に伝播する

---

#### Task 11: LP ページ統合

**ファイル:** `src/app/[locale]/page.tsx`

**内容:**
- `detectSnowGlobeTier()` を呼び出し
- `tier === "2d-fallback"` → `<GyroBars>`、それ以外 → `<SnowGlobe>` (dynamic import)
- `<SnowGlobe>` は `next/dynamic` で `{ ssr: false }` ロード
- テキストに `text-shadow` 追加(可読性確保)
- `/play` ナビゲーション前に Snow Globe の dispose を確実に実行

**受入条件:**
- 3D 対応デバイスで Snow Globe が表示される
- 3D 非対応デバイスで GyroBars が表示される
- LP → /play 遷移後に WebGL コンテキストが解放される(センサーサーマルドリフト防止)
- LP 初期ロードのバンドルサイズが増加しない(`next build` で確認)
- `npx tsc --noEmit` パス

---

#### Task 12: センサーサーマルドリフト対策

**ファイル:** `src/components/snow-globe/snow-globe-scene.ts` (Task 9 の `dispose` 強化)

**内容:**
- `dispose()` 内で以下を保証:
  1. `cancelAnimationFrame`
  2. 全 `deviceorientation` / `devicemotion` リスナー除去
  3. 全 geometry / material / texture の `dispose()`
  4. `renderer.dispose()`
  5. `renderer.forceContextLoss()` (`WEBGL_lose_context` 拡張)
  6. Canvas DOM ノードの width/height を 0 に設定(メモリ即時解放)
- LP → `/play` 遷移時に上記が確実に実行されることを保証

**受入条件:**
- LP → `/play` → LP (戻る) → `/play` を 5 往復してもセンサー精度が劣化しない
- Chrome DevTools Memory タブで WebGL コンテキストが増え続けない

---

#### Task 13: prefers-reduced-motion 対応

**ファイル:** `src/components/snow-globe/index.tsx`, `src/components/snow-globe/snow-globe-scene.ts`

**内容:**
- マウント時の判定に加え、**メディアクエリ変更の監視** (`matchMedia.addEventListener('change', ...)`)
- 途中で `prefers-reduced-motion` が有効になった場合: パーティクルを現在位置で静止(速度を 0 に)、rAF ループを停止
- 再度無効になった場合: rAF ループを再開

**受入条件:**
- macOS「アクセシビリティ → 視差効果を減らす」のトグルでリアルタイムに切り替わる
- 減らすモード ON でパーティクルが完全に静止する(ブラウン運動も停止)
- 減らすモード OFF で動作再開

---

### 実装順序

```
Task 1  パッケージインストール
  ↓
Task 2  デバイス能力判定        ← 独立、先に完成可能
Task 3  SVG パスデータ抽出      ← 独立、先に完成可能
  ↓
Task 4  パーティクルシステム    ← Task 1 依存
Task 7  入力ハンドラ            ← 独立
  ↓
Task 5  シルエット壁            ← Task 3 依存
Task 8  Bloom エフェクト        ← Task 4 依存
  ↓
Task 6  吸引 + 衝突統合         ← Task 4, 5 依存
  ↓
Task 9  シーン統合              ← Task 4, 5, 6, 7, 8 依存
  ↓
Task 10 React コンポーネント    ← Task 9 依存
  ↓
Task 11 LP ページ統合           ← Task 2, 10 依存
  ↓
Task 12 サーマルドリフト対策    ← Task 9 依存
Task 13 reduced-motion 対応     ← Task 10 依存
```

並列化可能: Task 2 + 3 + 7 は独立して先行実装可能。Task 4 + 7 も並列可能。

### 推定作業量

| タスク群 | 推定行数 | 推定時間 |
|---------|---------|---------|
| Task 1 (install) | 0 | 5 min |
| Task 2-3 (判定 + SVG) | ~120行 | 30 min |
| Task 4-6 (パーティクル + シルエット + 衝突) | ~350行 | 2 hr |
| Task 7-8 (入力 + Bloom) | ~180行 | 1 hr |
| Task 9-10 (シーン統合 + React) | ~200行 | 1 hr |
| Task 11 (LP統合) | ~30行変更 | 30 min |
| Task 12-13 (ドリフト + a11y) | ~50行 | 30 min |
| **合計** | **~930行** | **~5.5 hr** |

### コミット計画

```
1. chore: install three and postprocessing
2. feat(snow-globe): add device tier detection
3. feat(snow-globe): extract kosukuma SVG path data
4. feat(snow-globe): implement particle system with box physics
5. feat(snow-globe): implement input handler (tilt + shake)
6. feat(snow-globe): create silhouette wall from SVG paths
7. feat(snow-globe): add selective bloom effect
8. feat(snow-globe): integrate attraction and collision with silhouette
9. feat(snow-globe): assemble scene with all subsystems
10. feat(snow-globe): create React component wrapper
11. feat(landing): integrate snow globe with LP page
12. fix(snow-globe): ensure full GPU cleanup on dispose
13. feat(snow-globe): add prefers-reduced-motion runtime toggle
```

---

## 付録: リスクと緩和策

| リスク | 影響度 | 発生確率 | 緩和策 |
|--------|-------|---------|--------|
| WebGL コンテキスト枯渇 | 高 | 中 | Task 12 で `forceContextLoss()` を確実に実行。LP/play 往復テストで検証 |
| iPhone SE (旧世代) で 30fps 割れ | 中 | 低 | `no-bloom` ティア + パーティクル 8,000 で対応。`cores >= 4` でフィルタ済み |
| `isPointInPath` のパフォーマンス | 中 | 中 | Z 範囲 + バウンディングボックスで 95% のパーティクルをスキップ |
| 初期ロード遅延 | 低 | 低 | dynamic import で LP 初期バンドルに影響なし。three チャンクは並列ロード |
| SVGLoader のパス解析失敗 | 高 | 低 | Task 3 でパスデータを手動検証。フォールバック: パス解析失敗時は GyroBars に切替 |
| Battery API 非対応 (Safari) | 低 | 確実 | `'getBattery' in navigator` で分岐。非対応時は常にコア数判定のみ |

---

以上。Phase 0 提案書の全12項目を記載した。

確認後、Go サインで Phase 1 (Task 1-3) に進む。
