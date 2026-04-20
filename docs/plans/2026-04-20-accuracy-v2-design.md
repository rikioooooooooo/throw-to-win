# 高さ計測精度改善 v2 設計書

作成日: 2026-04-20
作成者: Claude Code

---

## エグゼクティブサマリ

現行の Throw to Win v1 は、加速度の**スカラー量**（`magnitude - baseline`）を積分して初速 v0 を推定しているため、斜め投擲で最大 100% の過大評価が発生する。また `g*t²/8` は非対称キャッチで破綻し、`MAX_FREEFALL_MS = 4000` が高高度チャレンジを阻害する。

本設計では、`DeviceMotionEvent.rotationRate` を用いた**四元数ベースの姿勢追跡**により世界座標系の垂直加速度を抽出し、物理的に正しい垂直初速 $v_{0,z}$ を積分して最高高度 $h_{max} = v_{0,z}^2 / (2g)$ を算出する（**Physical Mode**: airtime ≤ 10秒）。airtime > 10秒の投擲は**Beyond Mode**として真空近似式 $h = g \cdot t^2 / 8$ で処理し、ランキング上でユーザー名を赤色表示する。`rotationRate` が利用不可の端末ではデバイス座標系 Y 軸ベースのフォールバックを提供する。

期待効果: Physical Mode の計測誤差を ±15-30%（v1）から ±5-10%（v2）に改善。Beyond Mode は 10分（600秒）までの airtime を許容し、理論上 ~40万 m の記録を扱える。

---

## 1. 採用アルゴリズムの全体像

スマートフォンの IMU（加速度計 + ジャイロスコープ）から得られるセンサーデータを、四元数による姿勢追跡で世界座標系に変換し、鉛直方向の加速度成分のみを抽出・積分することで、投擲方向や端末回転に依存しない正確な垂直初速を算出する。リリース検出時の垂直速度をもとに、真空中の運動方程式から最高到達高度を計算する。

### データフロー図

```
devicemotion イベント（ブラウザ提供、~60-100Hz）
  │
  ├─ rotationRate { alpha, beta, gamma }  [deg/s]
  ├─ acceleration { x, y, z }            [m/s²]（重力除去済み）
  └─ accelerationIncludingGravity { x, y, z }  [m/s²]
  │
  ▼
┌─────────────────────────────────────────────────┐
│ キャリブレーション（静止判定 + 初期姿勢 q₀ 決定）   │
│  accelerationIncludingGravity の平均 → 重力方向特定  │
│  重力方向と世界 -Z 軸の回転四元数 q₀ を計算          │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 姿勢追跡（Complementary Filter）                  │
│  ω = rotationRate → deg/s → rad/s 変換           │
│  q̇ = ½ q ⊗ ω_quat                               │
│  q(t+dt) = normalize(q(t) + q̇ · dt)             │
│  + 加速度計ベース補正（ドリフト除去、α = 0.98）     │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 世界座標変換（Device Frame → World Frame）         │
│  a_device = event.acceleration (or 手動重力除去)   │
│  a_world = q ⊗ a_device ⊗ q⁻¹                    │
│  垂直加速度 a_z = a_world.z                        │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 垂直速度積分（台形則）                              │
│  v_z(t+dt) = v_z(t) + (a_z(t) + a_z(t+dt))/2·dt │
│  リリース検出時の v_z を v₀_vertical として記録      │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ モード判定 + 最高高度計算                           │
│  airtime ≤ 10s → Physical: h = v₀_z² / (2g)     │
│  airtime > 10s → Beyond:   h = g·t² / 8         │
└─────────────────────────────────────────────────┘
```

### rotationRate 不可端末のフォールバックパス

```
devicemotion イベント
  │
  ├─ rotationRate = null（ジャイロ非搭載 or 権限未付与）
  ├─ acceleration = null（重力分離不可）
  └─ accelerationIncludingGravity { x, y, z }
  │
  ▼
┌──────────────────────────────────────────┐
│ フォールバック: デバイス Y 軸をそのまま使用  │
│  a_vertical ≈ accIncGravity.y - g_baseline_y │
│  台形則積分 → v₀_vertical                 │
│  h = v₀_vertical² / (2g)                 │
└──────────────────────────────────────────┘
```


---

## 2. 数学的基盤（四元数による姿勢追跡）

### 2.1 四元数の定義

四元数（クォータニオン）$q$ は4つの実数成分からなり、3D空間の回転をコンパクトに表現する:

$$q = (w, x, y, z) = w + xi + yj + zk$$

ここで $i, j, k$ は四元数の虚数単位で、$i^2 = j^2 = k^2 = ijk = -1$ を満たす。

単位四元数（$\|q\| = \sqrt{w^2 + x^2 + y^2 + z^2} = 1$）は3D回転を表す。回転角 $\theta$、回転軸の単位ベクトル $\hat{n} = (n_x, n_y, n_z)$ に対応する四元数は:

$$q = \left(\cos\frac{\theta}{2},\ n_x \sin\frac{\theta}{2},\ n_y \sin\frac{\theta}{2},\ n_z \sin\frac{\theta}{2}\right)$$

四元数の共役:

$$q^* = (w, -x, -y, -z)$$

単位四元数では $q^{-1} = q^*$ が成り立つ。

### 2.2 四元数によるベクトル回転

3Dベクトル $\vec{v} = (v_x, v_y, v_z)$ を四元数 $q$ で回転するには、$\vec{v}$ を純虚四元数 $v_{quat} = (0, v_x, v_y, v_z)$ として:

$$\vec{v}' = q \otimes v_{quat} \otimes q^{*}$$

ここで $\otimes$ は四元数の乗算（ハミルトン積）:

$$p \otimes r = \begin{pmatrix} p_w r_w - p_x r_x - p_y r_y - p_z r_z \ p_w r_x + p_x r_w + p_y r_z - p_z r_y \ p_w r_y - p_x r_z + p_y r_w + p_z r_x \ p_w r_z + p_x r_y - p_y r_x + p_z r_w \end{pmatrix}$$

### 2.3 角速度からの四元数更新

ジャイロスコープが出力する角速度 $\vec{\omega} = (\omega_x, \omega_y, \omega_z)$ [rad/s] から、姿勢四元数の時間微分は:

$$\dot{q} = \frac{1}{2} q \otimes \omega_{quat}$$

ここで $\omega_{quat} = (0, \omega_x, \omega_y, \omega_z)$ は角速度の純虚四元数表現。

### 2.4 離散時間更新（オイラー法）

サンプリング間隔 $\Delta t$ での離散更新:

$$q_{n+1} = q_n + \dot{q}_n \cdot \Delta t = q_n + \frac{\Delta t}{2} \cdot q_n \otimes \omega_{quat}$$

数値誤差の蓄積を防ぐため、毎ステップ正規化する:

$$q_{n+1} \leftarrow \frac{q_{n+1}}{\|q_{n+1}\|}$$

### 2.5 ジャイロドリフト補正

MEMS ジャイロスコープは低周波ドリフトを持つ（典型値: バイアス安定性 ~0.01 rad/s、スマートフォン品質）。ジャイロ積分のみでは数秒で姿勢が大きくずれる。加速度計の重力方向を基準にドリフトを補正する必要がある。

**2つのフィルタの比較:**

| 特性 | Complementary Filter | Madgwick Filter |
|------|---------------------|-----------------|
| 実装行数 | ~30行 | ~80行 |
| チューニングパラメータ | $\alpha$（0-1） | $\beta$（>=0） |
| 補正方法 | SLERP/線形補間 | 勾配降下法 |
| 精度 | 十分（静的 ±1°、動的 ±3°） | 高い（静的 ±0.5°、動的 ±2°） |
| 計算コスト | 低 | 中 |
| 磁力計不要での動作 | 可 | 可（IMUモード） |
| JavaScript 実装例 | 自前で容易 | [psiphi75/ahrs](https://github.com/psiphi75/ahrs) |

**推奨: Complementary Filter**

理由:
1. **実装のシンプルさ**: 投擲検出の持続時間は最大でも数秒（Physical Mode）であり、この短時間ではジャイロドリフトの影響は限定的。高精度な Madgwick の勾配降下補正は不要。
2. **チューニングの容易さ**: $\alpha$ は物理的意味が直感的（$\alpha = 0.98$ = ジャイロ 98% 信頼）。Madgwick の $\beta$ は最適値がセンサーノイズ特性に依存し、端末ごとの調整が難しい（Madgwick 原著では IMU 構成で $\beta = 0.033$ を推奨するが、スマートフォン品質のセンサーでは大きくずれうる）。
3. **外部依存なし**: npm パッケージ追加不要で Cloudflare Workers でもサーバー再計算が容易。
4. **投擲検出の時間スケール**: キャリブレーションから投擲完了まで典型 3-5秒。この時間では complementary filter と Madgwick の精度差は実用上無視できる（出典: Valenti et al., "Keeping a Good Attitude", Sensors 2015）。

Complementary Filter のドリフト補正式:

加速度計から推定した「重力のみに基づく姿勢」を $q_{acc}$ とする。ジャイロ積分の $q_{gyro}$ との補間:

$$q_{corrected} = \text{SLERP}(q_{acc},\ q_{gyro},\ \alpha)$$

ここで $\alpha \in [0, 1]$ はフィルタ係数。$\alpha = 0.98$ でジャイロを 98% 信頼、加速度補正を 2% だけ適用する。

実装上は SLERP の計算コストを避け、以下の線形近似を用いる（$q_{acc}$ と $q_{gyro}$ が十分近い場合に有効）:

$$q_{corrected} = \text{normalize}(\alpha \cdot q_{gyro} + (1 - \alpha) \cdot q_{acc})$$


---

## 3. 世界座標系への変換

### 3.1 座標系の定義

- **デバイス座標系**: スマートフォンの画面に対して定義。X = 右、Y = 上（画面上方向）、Z = 画面手前。`DeviceMotionEvent` はこの座標系で値を返す。
- **世界座標系**: 重力方向を -Z、Z 軸が上（天頂方向）。X, Y は水平面内で自由（初期端末向きに依存、ヨー角は不問）。

### 3.2 初期姿勢の決定（キャリブレーション期）

キャリブレーション期間中、端末は静止状態にある。この間の `accelerationIncludingGravity` の平均ベクトルを $\bar{a}_{device}$ とする。静止時、この値は重力ベクトルのデバイス座標系表現に等しい。

**注意**: iOS と Android で `accelerationIncludingGravity` の符号が異なる。iOS は重力方向が正（画面を上に置くと z = +9.81）、W3C 仕様および Android は重力と逆方向が正（z = -9.81）。本設計では W3C 仕様（Android 準拠）を基準とし、iOS 検出時に符号反転する。

**ステップ 1**: 重力の単位ベクトルを求める:

$$\hat{g}_{device} = \frac{\bar{a}_{device}}{\|\bar{a}_{device}\|}$$

iOS の場合（重力方向が正）: $\hat{g}_{device} = -\frac{\bar{a}_{device}}{\|\bar{a}_{device}\|}$

**ステップ 2**: 世界座標系での重力方向は $\hat{g}_{world} = (0, 0, -1)$（下向き）。

**ステップ 3**: $\hat{g}_{device}$ を $\hat{g}_{world}$ に回転させる四元数 $q_0$ を計算する。2つの単位ベクトル $\hat{u}_1$, $\hat{u}_2$ 間の回転四元数の標準公式:

$$\vec{c} = \hat{u}_1 \times \hat{u}_2 \quad (\text{外積})$$

$$d = \hat{u}_1 \cdot \hat{u}_2 \quad (\text{内積})$$

$$q_0 = \text{normalize}\left(1 + d,\ c_x,\ c_y,\ c_z\right)$$

ここで $\hat{u}_1 = \hat{g}_{device}$, $\hat{u}_2 = \hat{g}_{world} = (0, 0, -1)$。

**特殊ケース**: $\hat{u}_1$ と $\hat{u}_2$ がほぼ反平行（$d \approx -1$）の場合、上記の公式は数値不安定になる。この場合は任意の垂直軸周りの 180 度回転四元数を使う:

$$q_0 = (0, 1, 0, 0) \quad \text{（X 軸周り 180 度回転）}$$

### 3.3 リアルタイム姿勢更新

各 `devicemotion` イベントで以下を実行:

**ステップ 1**: 角速度を rad/s に変換（`rotationRate` は deg/s で提供される）:

$$\omega = \left(\frac{\alpha_{deg}}{180}\pi,\ \frac{\beta_{deg}}{180}\pi,\ \frac{\gamma_{deg}}{180}\pi\right)$$

**注意**: `rotationRate` の軸（alpha, beta, gamma）はデバイス座標系の (Z, X, Y) 軸に対応する。したがって:

$$\omega_{device} = (\beta_{rad},\ \gamma_{rad},\ \alpha_{rad})$$

すなわち $\omega_x = \beta$, $\omega_y = \gamma$, $\omega_z = \alpha$。

**ステップ 2**: ジャイロベースの四元数更新（セクション 2.4）:

$$q_{gyro} = \text{normalize}\left(q_n + \frac{\Delta t}{2} \cdot q_n \otimes (0, \omega_x, \omega_y, \omega_z)\right)$$

**ステップ 3**: 加速度計ベースの補正四元数 $q_{acc}$ を計算。現在の加速度計読み値 $\vec{a}_{inc}$（`accelerationIncludingGravity`）から重力方向を推定し、初期姿勢決定と同じ手法で $q_{acc}$ を求める。ただし動的加速度が大きい場合（投擲中）は補正を抑制する:

$$\text{if } \left| \|\vec{a}_{inc}\| - g \right| > \epsilon_{dynamic} \text{ then skip correction}$$

$\epsilon_{dynamic} = 1.5\ \text{m/s}^2$ を推奨（静止時ノイズの 3 sigma 程度）。

**ステップ 4**: Complementary filter の適用:

$$q_{n+1} = \text{normalize}(\alpha \cdot q_{gyro} + (1 - \alpha) \cdot q_{acc})$$

推奨値: $\alpha = 0.98$。動的加速度が大きくて補正をスキップした場合は $q_{n+1} = q_{gyro}$。

### 3.4 世界座標系の線形加速度

**`acceleration` が利用可能な場合**（重力除去済み）:

$$\vec{a}_{world} = q \otimes (0, a_x, a_y, a_z) \otimes q^*$$

垂直加速度: $a_z = \vec{a}_{world,z}$

**`acceleration` が null の場合のフォールバック**:

`accelerationIncludingGravity` から手動で重力を除去する。世界座標系で重力は $(0, 0, -g)$ であり、これをデバイス座標系に変換すると:

$$\vec{g}_{device} = q^* \otimes (0, 0, 0, -g) \otimes q$$

線形加速度:

$$\vec{a}_{linear} = \vec{a}_{inc} - \vec{g}_{device}$$

これを世界座標系に変換:

$$\vec{a}_{world} = q \otimes (0, a_{linear,x}, a_{linear,y}, a_{linear,z}) \otimes q^*$$


---

## 4. 垂直速度の積分と最高高度（Physical Mode）

本セクションは **Physical Mode（airtime <= 10秒）** の計算ロジックを扱う。

### 4.1 積分開始タイミング（リリース検出）

現行の launch 検出は `magnitude > 15 m/s^2` が2サンプル連続で発火する。新設計ではこの検出ロジック自体は大きく変更しない（検出タイミングには問題がないため）が、**積分対象を世界座標系の垂直加速度に変更する**。

Launch 検出条件（既存ロジック維持）:
- `magnitude > LAUNCH_THRESHOLD`（15 m/s^2）が `LAUNCH_CONFIRM_COUNT`（2）サンプル連続

積分開始条件:
- Launch 検出と同時に垂直速度の積分を開始（$v_z(0) = 0$）
- Launch 前のサンプルは姿勢追跡のみ実行、積分は行わない

### 4.2 台形則積分

世界座標系の垂直加速度 $a_z(t)$ を台形則で積分し、垂直速度 $v_z(t)$ を求める:

$$v_z(t_{n+1}) = v_z(t_n) + \frac{a_z(t_n) + a_z(t_{n+1})}{2} \cdot \Delta t$$

ここで $\Delta t = (t_{n+1} - t_n) / 1000$（ms から s への変換）。

異常な $\Delta t$（$\Delta t \leq 0$ または $\Delta t > 0.1$ s）のサンプルはスキップする（既存実装と同じガード）。

### 4.3 リリース時垂直速度 $v_{0,z}$ の確定

フリーフォール検出時（手から離れた瞬間）の $v_z$ を $v_{0,z}$ として記録する。

- フリーフォール検出条件は既存ロジックと同等だが、世界座標系で再定義（セクション6参照）
- フリーフォール検出後は積分を停止（自由落下中の軌道は解析解で計算可能）

### 4.4 最高高度の計算

真空中の鉛直投擲の最高到達高度:

$$h_{max} = \frac{v_{0,z}^2}{2g}$$

ここで $g = 9.81\ \text{m/s}^2$。

**クランプ条件**:
- $v_{0,z} < 0$（下向き投擲）の場合: $h_{max} = 0$
- $v_{0,z} > 100\ \text{m/s}$（物理的にありえない）の場合: アンチチートで拒否

### 4.5 airtime ベースとの関係

v1 では `min(g*t^2/8, v0^2/(2g) * 1.15)` の2重推定だったが、新設計では:

- **スコア計算**: $v_{0,z}$ ベースのみを採用（$h_{max} = v_{0,z}^2 / (2g)$）
- **airtime の用途**: アンチチート検証用のみ
  - $v_{0,z} / g$（上昇時間）と実測 airtime の半分が概ね一致するか検証
  - 大きく乖離する場合はデータ偽造の可能性（セクション8で詳述）

airtime ベースを**スコア計算から除外する理由**:
- 非対称キャッチ（立って投げてしゃがんで受ける）で airtime が実際の上昇時間より長くなり、高度が過大評価される
- $v_{0,z}$ ベースはリリース時点の速度のみに依存するため、キャッチ位置に影響されない

---

## 4-B. Beyond Mode の計算

airtime > 10秒の投擲は **Beyond Mode** として処理する。

### 4-B.1 Beyond Mode の判定条件

着地検出時点で:

$$\text{airtime} = \frac{\text{landingTime} - \text{freefallStartTime}}{1000}\ [\text{s}]$$

- $\text{airtime} > 10.0$ のとき Beyond Mode
- $\text{airtime} \leq 10.0$ のとき Physical Mode

境界値の扱い: **10.0秒ちょうどは Physical Mode**（`<=` で判定）。

### 4-B.2 Beyond Mode の計算式

$$h = \frac{g \cdot t^2}{8}$$

ここで $t$ は airtime（秒）、$g = 9.81\ \text{m/s}^2$。

この式は対称投擲（リリース高 = キャッチ高）かつ真空を仮定した近似。Beyond Mode の領域（ドローン・気球・ロケット等）ではこれらの仮定は成り立たないが、記号的な値として記録する。

**空気抵抗は無視する**（両モード共通）。Beyond Mode の高度は物理的正確性より記録の面白さを優先する設計判断。

### 4-B.3 モードフィールドの記録

投擲結果に `mode` フィールドを追加:

```typescript
type ThrowMode = "physical" | "beyond";
```

データフロー:
1. クライアント: airtime から `mode` を判定し、送信データに含める
2. サーバー: サーバー側でも airtime から独立に `mode` を再計算し、クライアント値と一致するか検証
3. DB: `throws` テーブルに `mode TEXT NOT NULL DEFAULT 'physical'` カラムを追加

### 4-B.4 MAX_FREEFALL_MS の拡張

$$\text{MAX\_FREEFALL\_MS} = 600000\ \text{（10分）}$$

根拠: 厨二病 MAX ティアの 40万 m は真空自由落下で $t = \sqrt{8h/g} = \sqrt{8 \times 400000 / 9.81} \approx 571$ 秒。600秒 = 10分はこれを許容する最小限の余裕。

600秒を超える airtime は物理的にありえない（成層圏 ~40km からの自由落下でも ~90秒）ため、アンチチートで即拒否する。


---

## 5. キャリブレーション戦略

### 5.1 静止判定

現行は `magnitude` の50サンプル平均でベースラインを取るだけで、静止状態の確認はしていない。新設計では加速度とジャイロの両方を使って静止を確認する。

**静止条件**（全てを同時に満たすこと）:

1. 加速度の安定性: $\left| \|\vec{a}_{inc}\| - g \right| < \epsilon_a$ が $N_{cal}$ サンプル連続
2. 角速度の静止性: $\|\vec{\omega}\| < \epsilon_\omega$ が $N_{cal}$ サンプル連続（`rotationRate` が利用可能な場合のみ）

推奨閾値:

| パラメータ | 値 | 根拠 |
|-----------|-----|------|
| $\epsilon_a$ | 0.5 m/s^2 | スマートフォン加速度計の典型的ノイズ sigma = 0.01 m/s^2（出典: Smartphone MEMS Accelerometer Measurement Errors, Sensors 2023）の 50倍。手持ち時の微振動を許容 |
| $\epsilon_\omega$ | 0.1 rad/s (= 5.7 deg/s) | スマートフォンジャイロの典型的ノイズ sigma = 0.003 rad/s（同出典）の 33倍。手のわずかな震えを許容 |
| $N_{cal}$ | 50サンプル | 60Hz で約 0.83秒。v1 と同等の時間 |

### 5.2 初期姿勢四元数 $q_0$ の計算

静止期間中の `accelerationIncludingGravity` の平均ベクトルを計算:

$$\bar{a} = \frac{1}{N_{cal}} \sum_{i=1}^{N_{cal}} \vec{a}_{inc,i}$$

$\bar{a}$ から $q_0$ を求める手順はセクション 3.2 に記載済み。

### 5.3 キャリブレーション失敗時のフォールバック

静止状態が取れない場合（持ち歩き中、手の震えが激しい等）:

1. **リトライ**: 3秒間静止条件が満たされなければ「端末を安定させてください」と UI 表示し、リトライを促す
2. **緩和モード**: さらに3秒経過しても達成されない場合、$\epsilon_a$ を 1.0 m/s^2、$\epsilon_\omega$ を 0.2 rad/s に緩和して再試行
3. **最終フォールバック**: 緩和モードでも失敗した場合、最後の $N_{cal}$ サンプルの平均をそのまま使用し、精度低下の可能性を内部的に記録（`calibrationQuality: "degraded"`）

### 5.4 ジャイロ不可端末でのキャリブレーション

`rotationRate` が null の端末では角速度の静止チェックをスキップし、加速度のみで静止判定する。$q_0$ の計算は同じ手順で行うが、以降の姿勢追跡は行わない（フォールバックモード）。


---

## 6. フリーフォール検出・着地検出

### 6.1 フリーフォール条件の再定義

**現行** (`sensor.ts`):
- デバイス座標系の `magnitude < 8.0 m/s^2` が 40ms 持続

**新設計**:
- 世界座標系の加速度の大きさ $\|\vec{a}_{world}\|$ を使用
- $\|\vec{a}_{world}\| < \epsilon_{ff}$ が `FREEFALL_CONFIRM_MS` 持続

世界座標系を使う利点:
- 端末が回転していても遠心力による見かけの加速度が除去される
- フリーフォール中、理想的には $\vec{a}_{world} = \vec{0}$（重力は `acceleration` で既に除去済み）
- したがって閾値を v1 より厳しくでき、誤検出が減る

### 6.2 着地条件の再定義

**現行**:
- `magnitude > 12.0 m/s^2` が 2サンプル連続

**新設計**:
- $\|\vec{a}_{world}\| > \epsilon_{land}$ が `LANDING_CONFIRM_COUNT` サンプル連続
- backdate 処理は維持（最初の高G サンプルの時刻を landing time とする）

### 6.3 新旧閾値対応表

| パラメータ | v1（デバイス座標系） | v2（世界座標系） | 変更理由 |
|-----------|-------------------|-----------------|---------|
| `LAUNCH_THRESHOLD` | 15.0 m/s^2 | 15.0 m/s^2（変更なし） | Launch はデバイス magnitude で十分。世界座標変換前の値で検出 |
| `LAUNCH_CONFIRM_COUNT` | 2 | 2（変更なし） | 既に十分機能している |
| `FREEFALL_THRESHOLD` | 8.0 m/s^2 | **3.0 m/s^2**（$\epsilon_{ff}$） | 世界座標系では回転の影響が除去されるため、より厳しい閾値が可能。センサーノイズ + 残留誤差の 3 sigma 程度 |
| `FREEFALL_CONFIRM_MS` | 40 ms | 40 ms（変更なし） | 確認時間は十分 |
| `LANDING_THRESHOLD` | 12.0 m/s^2 | **5.0 m/s^2**（$\epsilon_{land}$） | 世界座標系では静止時 $\|\vec{a}_{world}\| \approx 0$。キャッチ時の衝撃 5 m/s^2 は十分検出可能 |
| `LANDING_CONFIRM_COUNT` | 2 | 2（変更なし） | -- |
| `MIN_FREEFALL_MS` | 60 ms | 60 ms（変更なし） | -- |
| `MAX_FREEFALL_MS` | 4000 ms | **600000 ms** | Beyond Mode 対応（セクション 4-B.4） |
| `LAUNCH_TIMEOUT_MS` | 1000 ms | 1000 ms（変更なし） | -- |

**注意**: `FREEFALL_THRESHOLD` と `LANDING_THRESHOLD` の大幅な引き下げは、世界座標系変換が正しく機能していることが前提。Phase 1 実装時に実機テストで調整が必要になる可能性がある。実機テストの結果、フォールバック端末（世界座標変換なし）では v1 の閾値をそのまま使用する。

### 6.4 フォールバック端末での検出

`rotationRate` が null の端末では世界座標系変換ができないため、v1 と同じデバイス座標系の `magnitude` ベースで検出を行う。閾値も v1 を維持:

- `FREEFALL_THRESHOLD = 8.0 m/s^2`
- `LANDING_THRESHOLD = 12.0 m/s^2`


---

## 7. 端末能力の判定とフォールバック

### 7.1 判定ロジック

最初の `devicemotion` イベント受信時に能力を判定:

```
if event.rotationRate !== null
   && (event.rotationRate.alpha !== null || event.rotationRate.beta !== null)
   -> sensorMode = "high-precision"

else if event.accelerationIncludingGravity !== null
   -> sensorMode = "fallback"

else
   -> sensorMode = "unsupported" (計測不能)
```

**追加の考慮事項**:
- iOS 13+ では `DeviceMotionEvent.requestPermission()` で権限取得が必要。権限が付与されないと `rotationRate` は null になる（出典: Apple Developer Forums）
- 一部の Android 端末ではジャイロスコープ非搭載で `rotationRate` が常に null（廉価機種に多い）
- HTTPS が必須（`DeviceMotionEvent` はセキュアコンテキストでのみ動作）

### 7.2 フォールバックアルゴリズム

`rotationRate` が null の端末では、姿勢追跡ができない。代わりに以下の簡易手法を使用:

1. キャリブレーション期間中に `accelerationIncludingGravity` の平均ベクトル $\bar{a}$ を取得
2. $\bar{a}$ から重力軸の方向を特定（最も大きな成分が重力軸）
3. 投擲時は `accelerationIncludingGravity` の重力軸成分からベースラインを引いた値を「近似的な垂直加速度」として積分

典型的には端末を縦に持つため、$\bar{a}$ の Y 成分が最大になる:

$$a_{vertical} \approx a_{inc,y} - \bar{a}_y$$

この値を台形則で積分して $v_{0,z}$ を求め、$h_{max} = v_{0,z}^2 / (2g)$ を計算する。

**v1 の magnitude 積分と比較した利点**:
- 方向の符号が保持される（加速と減速を区別できる）
- スカラー magnitude は全方向の加速度を足し合わせるため常に過大評価するが、単一軸成分は過大評価しにくい
- ただし端末の傾きによる誤差は残る

### 7.3 誤差の期待値

| sensorMode | 誤差の主因 | 期待誤差範囲 |
|-----------|----------|------------|
| `high-precision` | センサーノイズ（sigma_accel = 0.01 m/s^2）、積分ドリフト、フィルタ遅延 | +-5-10% |
| `fallback` | 端末の傾き（投擲時に姿勢が変化）、重力除去の不正確さ | +-15-30% |

**high-precision の誤差内訳**:
- ジャイロノイズによる姿勢誤差: 1秒間で ~0.3 度（sigma_gyro = 0.003 rad/s x 1s / sqrt(60Hz)）
- 加速度ノイズの積分: 1秒間で ~0.01 m/s 程度（sigma_accel x sqrt(dt x N)）
- 離散化誤差: 60Hz で十分小さい（台形則の 2次誤差）
- 合計: 5 m/s の投擲で v0 誤差 ~0.3 m/s -> 高度誤差 ~6%

### 7.4 端末能力の記録

投擲記録に `sensorMode` フィールドを追加:

```typescript
type SensorMode = "high-precision" | "fallback";
```

- クライアントからサーバーに送信
- DB に保存（`throws` テーブルに `sensor_mode TEXT NOT NULL DEFAULT 'high-precision'` カラム）
- ランキング表示では使用しない（内部検証用のみ）
- 将来的に精度分析や端末統計に利用可能


---

## 8. アンチチート更新（Physical / Beyond 両対応）

### 8.1 AccelSample 型の拡張

現行:

```typescript
type AccelSample = {
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly magnitude: number;
};
```

新設計:

```typescript
type AccelSample = {
  readonly t: number;        // ms timestamp (performance.now)
  readonly x: number;        // acceleration.x or accelerationIncludingGravity.x [m/s^2]
  readonly y: number;        // acceleration.y or accelerationIncludingGravity.y [m/s^2]
  readonly z: number;        // acceleration.z or accelerationIncludingGravity.z [m/s^2]
  readonly magnitude: number; // sqrt(x^2+y^2+z^2) -- backward compat
  // --- v2 additional fields ---
  readonly gx: number;       // accelerationIncludingGravity.x [m/s^2]
  readonly gy: number;       // accelerationIncludingGravity.y [m/s^2]
  readonly gz: number;       // accelerationIncludingGravity.z [m/s^2]
  readonly rx: number | null; // rotationRate.beta  [deg/s] (X-axis) -- null if unavailable
  readonly ry: number | null; // rotationRate.gamma [deg/s] (Y-axis)
  readonly rz: number | null; // rotationRate.alpha [deg/s] (Z-axis)
};
```

**設計判断**:
- `x, y, z` は `acceleration`（重力除去済み）を優先して格納。`acceleration` が null の場合は `accelerationIncludingGravity` を格納し、`gx, gy, gz` と同値になる
- `gx, gy, gz` は常に `accelerationIncludingGravity` を格納（キャリブレーション・フォールバック・アンチチートで必要）
- `rx, ry, rz` は `rotationRate` を格納。null の場合はそのまま null
- `magnitude` は後方互換のため残す（v1 のアンチチートロジックも段階的に移行するため）

**ペイロードサイズの考慮**:
- v1: 5フィールド x 8バイト = 40バイト/サンプル
- v2: 12フィールド x 8バイト = 96バイト/サンプル（約2.4倍）
- 500サンプル（5秒 x 100Hz）で ~48KB。`sensorData` の上限 2000サンプルで ~192KB
- Cloudflare Workers のリクエストサイズ上限（100MB）に対して十分小さい
- ただし、Beyond Mode で 600秒 x 60Hz = 36000 サンプルとなるため、Beyond Mode では **サンプリングを間引く**（10Hz に間引いて最大 6000 サンプル = ~576KB）

### 8.2 サーバー側再計算

**Physical Mode**: クライアントと同じ四元数処理をサーバーで再現する。

- キャリブレーション区間の特定（launch 前のサンプル）
- $q_0$ の計算
- Complementary filter による姿勢追跡
- 垂直加速度の抽出と積分
- $v_{0,z}$ の再計算
- $h_{max}$ の再計算

全て純粋な算術演算であり、外部ライブラリ不要。Cloudflare Workers の CPU 時間制限（50ms / リクエスト）内で十分処理可能（500サンプルの四元数演算は ~1ms）。

**Beyond Mode**: サーバー側でも $h = g \cdot t^2 / 8$ を再計算し、クライアント値との一致を確認する。

### 8.3 Physical Mode のチェック項目（airtime <= 10秒）

| チェック名 | 検出対象 | ロジック | 失敗時スコア |
|-----------|---------|---------|------------|
| `sample_count` | サンプル不足 | v1 と同じ（サンプル数 >= airtime x 40Hz x 0.5） | 0.3 |
| `interval_regularity` | 偽造データ | v1 と同じ（CV < 0.6） | 0.3 |
| `calibration_baseline` | 偽造データ | v1 と同じ（8.5-11.0 m/s^2） | 0.2 |
| `launch_spike` | 偽造データ | v1 と同じ（magnitude > 15 m/s^2 あり） | 0.3 |
| `freefall_presence` | 偽造データ | v1 と同じ（連続 low-G >= 3サンプル） | 0.3 |
| `landing_spike` | 偽造データ | v1 と同じ | 0.15 |
| `height_deviation` | 計算値偽造 | サーバー再計算 $h_{server}$ とクライアント $h_{client}$ の乖離が 15% 以内 | 0.5 |
| `noise_pattern` | 偽造データ | v1 と同じ | 0.4 |
| `v0_airtime_consistency` | データ偽造 | $t_{up} = v_{0,z} / g$ と airtime/2 が概ね一致（比率 0.5-2.0） | 0.3 |
| `attitude_accel_consistency` | 姿勢偽造 | ジャイロ積分による重力方向と加速度計の重力方向が +-15 度以内 | 0.3 |

**v1 から削除するチェック**:
- `asymmetric_throw`: 新設計では $v_{0,z}$ ベースで非対称キャッチに影響されないため不要

**新規チェックの詳細**:

**`v0_airtime_consistency`**: 物理的に、$v_{0,z}$ で上昇した物体が自由落下で戻るまでの時間は $2 \times v_{0,z} / g$。これが実測 airtime と大きく乖離する場合、$v_{0,z}$ か airtime のどちらかが偽造されている。ただし非対称キャッチ（高所から投げ下ろす等）で正当に乖離するケースがあるため、閾値は緩め（比率 0.5-2.0）に設定。

**`attitude_accel_consistency`**: 姿勢追跡中、四元数から推定される重力方向 $\hat{g}_{estimated} = q^* \otimes (0,0,-1) \otimes q$ と、実際の `accelerationIncludingGravity` の方向を比較する。静止付近のサンプルでこれらが大きく乖離（15 度以上）していると、`rotationRate` データが偽造されている可能性がある。

### 8.4 Beyond Mode のチェック項目（airtime > 10秒）

| チェック名 | 検出対象 | ロジック | 失敗時スコア |
|-----------|---------|---------|------------|
| `beyond_sample_density` | 時間偽造 | サンプル数 >= airtime x 10Hz x 0.5（間引き後でも最低密度を確保） | 0.3 |
| `beyond_freefall_continuity` | 偽造データ | フリーフォール区間の 90% 以上で magnitude < 5.0 m/s^2 | 0.4 |
| `beyond_attitude_randomness` | 地面置き偽造 | rotationRate がある場合: フリーフォール期間の角速度 RMS > 0.5 rad/s（自由回転を示す）。ない場合: スキップ | 0.3 |
| `beyond_gyro_physics` | 偽造データ | 角速度の変化率が物理的に妥当（トルクゼロの自由回転では角速度は概ね一定。急激な変化は手持ち操作の証拠） | 0.2 |
| `beyond_max_duration` | 物理限界超過 | airtime > 600秒 -> 即拒否 | 1.0（即拒否） |

**チェックの詳細**:

**`beyond_sample_density`**: 30秒の airtime を主張するなら、10Hz 間引きでも 150 サンプル前後あるべき。サンプルが極端に少ない（例: 5個）場合、実際にはほとんど計測していないのに airtime だけ偽造した可能性がある。

**`beyond_freefall_continuity`**: 長時間のフリーフォールでは、端末は継続的に無重力（加速度 = 0）状態にあるはず。途中で大きな加速度が散発するのは、地面に置いた端末を時々動かしている証拠。90% の閾値は、実際の空中回転やセンサーノイズによる短時間の逸脱を許容する。

**`beyond_attitude_randomness`**: 高所から落とされたスマートフォンは空気抵抗で自由回転する（角速度 > 数 rad/s が一般的）。フリーフォール中に姿勢が完全に安定している（角速度 = 0）場合、スマートフォンは地面に静置されていて airtime が偽造された可能性が高い。

**`beyond_gyro_physics`**: 空気中の自由回転では外部トルクはほぼゼロのため、角運動量保存により角速度は概ね一定。1秒間に角速度が 5 rad/s 以上変化するような急激なジャンプは、人間が手で操作している証拠。

### 8.5 MAX_HEIGHT_METERS と MAX_AIRTIME_SECONDS の更新

`src/app/api/verify/route.ts` の物理限界定数を更新する:

| 定数 | v1 | v2 | 根拠 |
|------|-----|-----|------|
| `MAX_HEIGHT_METERS` | 30 | 500000 | Beyond Mode の最大値（$g \times 600^2 / 8 \approx 441000$ m） |
| `MAX_AIRTIME_SECONDS` | 5 | 600 | `MAX_FREEFALL_MS / 1000` |


---

## 8-B. ランキング表示の色分け

### 8-B.1 データ伝播

```
Client                    Server                    DB
------                    ------                    --
mode = airtime > 10       mode 検証                  throws.mode TEXT
  ? "beyond"                (airtime から再計算)        NOT NULL
  : "physical"              不一致 -> 400 拒否          DEFAULT 'physical'
       |                       |
       +---- POST /verify -----+---- INSERT ------------+
                                                        |
                               GET /rankings <----------+
                                 |
                                 +- mode フィールド含めて返却
```

### 8-B.2 ランキング取得 API の変更

`GET /api/rankings` のレスポンスに `mode` フィールドを追加:

```typescript
type RankingEntry = {
  rank: number;
  displayName: string;
  heightMeters: number;
  country: string;
  mode: "physical" | "beyond";  // 追加
};
```

### 8-B.3 UI での色分け

| mode | ユーザー名の色 | 適用箇所 |
|------|-------------|---------|
| `physical` | デフォルト色（白/黒、テーマ依存） | ランキング一覧、マイページ PB、結果画面 |
| `beyond` | **赤色** `#FF4444` | 同上 |

実装方法: CSS クラス `ranking-name--beyond` を条件付きで付与:

```css
.ranking-name--beyond {
  color: #FF4444;
}
```

### 8-B.4 表示哲学

- ランキングは**1プール**。フィルタ・カテゴリなし
- 「Physical」「Beyond」等のモード名ラベルは**表示しない**（内部分類に留める）
- 赤色の名前だけで「この記録は通常の物理投擲ではない」ことが視覚的に伝わる
- ツールチップやモード説明も**付けない**（ミニマリスト哲学）


---

## 9. 擬似コード

### 9.1 `initializeOrientation`

```typescript
type Vec3 = { x: number; y: number; z: number };
type Quaternion = { w: number; x: number; y: number; z: number };

/**
 * キャリブレーション期間の加速度サンプルから初期姿勢四元数を計算する。
 * accelerationIncludingGravity の平均ベクトルを重力方向として、
 * 世界座標系の -Z 軸（下向き）との回転四元数を求める。
 *
 * @param calibrationSamples - 静止期間中の accelerationIncludingGravity サンプル
 * @param isIOS - iOS 端末の場合 true（符号反転が必要）
 * @returns 初期姿勢四元数 q0
 */
function initializeOrientation(
  calibrationSamples: { gx: number; gy: number; gz: number }[],
  isIOS: boolean,
): Quaternion {
  // Step 1: accelerationIncludingGravity の平均ベクトルを計算
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const s of calibrationSamples) {
    sumX += s.gx;
    sumY += s.gy;
    sumZ += s.gz;
  }
  const n = calibrationSamples.length;
  let avgX = sumX / n;
  let avgY = sumY / n;
  let avgZ = sumZ / n;

  // iOS は重力方向が正なので反転
  if (isIOS) {
    avgX = -avgX;
    avgY = -avgY;
    avgZ = -avgZ;
  }

  // Step 2: 重力方向の単位ベクトル（デバイス座標系）
  const mag = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);
  if (mag < 0.1) {
    // 加速度がほぼゼロ（あり得ないが安全策）-> 単位四元数
    return { w: 1, x: 0, y: 0, z: 0 };
  }
  const gDevX = avgX / mag;
  const gDevY = avgY / mag;
  const gDevZ = avgZ / mag;

  // Step 3: 世界座標系の重力方向 = (0, 0, -1)
  const gWorldX = 0;
  const gWorldY = 0;
  const gWorldZ = -1;

  // Step 4: 2つの単位ベクトル間の回転四元数
  // 外積 c = gDev x gWorld
  const cx = gDevY * gWorldZ - gDevZ * gWorldY;
  const cy = gDevZ * gWorldX - gDevX * gWorldZ;
  const cz = gDevX * gWorldY - gDevY * gWorldX;

  // 内積 d = gDev . gWorld
  const d = gDevX * gWorldX + gDevY * gWorldY + gDevZ * gWorldZ;

  // 反平行チェック (d ~ -1)
  if (d < -0.9999) {
    // X 軸周りの 180 度回転
    return { w: 0, x: 1, y: 0, z: 0 };
  }

  // q = normalize(1 + d, cx, cy, cz)
  const qw = 1 + d;
  const qMag = Math.sqrt(qw * qw + cx * cx + cy * cy + cz * cz);
  return {
    w: qw / qMag,
    x: cx / qMag,
    y: cy / qMag,
    z: cz / qMag,
  };
}
```

### 9.2 `updateOrientation`

```typescript
/**
 * ジャイロスコープの角速度から姿勢四元数を1ステップ更新する。
 * 1次オイラー法 + 正規化。
 *
 * @param prevQ - 前ステップの姿勢四元数
 * @param rotationRate - { alpha, beta, gamma } in deg/s (DeviceMotionEvent.rotationRate)
 * @param dt - 時間ステップ [秒]
 * @returns 更新後の姿勢四元数
 */
function updateOrientation(
  prevQ: Quaternion,
  rotationRate: { alpha: number; beta: number; gamma: number },
  dt: number,
): Quaternion {
  // rotationRate の軸マッピング:
  //   alpha = Z軸回転, beta = X軸回転, gamma = Y軸回転
  // deg/s -> rad/s
  const DEG2RAD = Math.PI / 180;
  const wx = rotationRate.beta * DEG2RAD;   // X軸回転
  const wy = rotationRate.gamma * DEG2RAD;  // Y軸回転
  const wz = rotationRate.alpha * DEG2RAD;  // Z軸回転

  // qdot = 0.5 * prevQ (x) (0, wx, wy, wz)
  // ハミルトン積: prevQ (x) omega_quat
  const ow = 0, ox = wx, oy = wy, oz = wz;
  const dw = 0.5 * (prevQ.w * ow - prevQ.x * ox - prevQ.y * oy - prevQ.z * oz);
  const dx = 0.5 * (prevQ.w * ox + prevQ.x * ow + prevQ.y * oz - prevQ.z * oy);
  const dy = 0.5 * (prevQ.w * oy - prevQ.x * oz + prevQ.y * ow + prevQ.z * ox);
  const dz = 0.5 * (prevQ.w * oz + prevQ.x * oy - prevQ.y * ox + prevQ.z * ow);

  // オイラー法: q_new = prevQ + qdot * dt
  let nw = prevQ.w + dw * dt;
  let nx = prevQ.x + dx * dt;
  let ny = prevQ.y + dy * dt;
  let nz = prevQ.z + dz * dt;

  // 正規化
  const norm = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
  return {
    w: nw / norm,
    x: nx / norm,
    y: ny / norm,
    z: nz / norm,
  };
}
```

### 9.3 `applyComplementaryCorrection`

```typescript
/**
 * Complementary filter: 加速度計ベースの姿勢推定でジャイロドリフトを補正する。
 * 動的加速度が大きい場合（投擲中）は補正をスキップする。
 *
 * @param qGyro - ジャイロ積分で得た姿勢四元数
 * @param accIncGravity - accelerationIncludingGravity { x, y, z } [m/s^2]
 * @param alpha - フィルタ係数 (推奨: 0.98)
 * @param isIOS - iOS 端末フラグ
 * @returns 補正済み姿勢四元数
 */
function applyComplementaryCorrection(
  qGyro: Quaternion,
  accIncGravity: Vec3,
  alpha: number,
  isIOS: boolean,
): Quaternion {
  const GRAVITY = 9.81;
  const DYNAMIC_THRESHOLD = 1.5; // m/s^2

  // 加速度の大きさをチェック -- 動的加速度が大きければ補正スキップ
  const accMag = Math.sqrt(
    accIncGravity.x ** 2 + accIncGravity.y ** 2 + accIncGravity.z ** 2,
  );
  if (Math.abs(accMag - GRAVITY) > DYNAMIC_THRESHOLD) {
    // 動的加速度が大きい -> 加速度は重力方向を正しく示さない -> スキップ
    return qGyro;
  }

  // 加速度から重力方向を推定して q_acc を計算
  // (initializeOrientation と同じロジック)
  let gx = accIncGravity.x;
  let gy = accIncGravity.y;
  let gz = accIncGravity.z;
  if (isIOS) { gx = -gx; gy = -gy; gz = -gz; }

  const mag = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (mag < 0.1) return qGyro;

  gx /= mag; gy /= mag; gz /= mag;

  // gDev -> gWorld = (0,0,-1) の回転四元数
  const cx = gy * (-1) - gz * 0;
  const cy = gz * 0 - gx * (-1);
  const cz = gx * 0 - gy * 0;
  const d = gx * 0 + gy * 0 + gz * (-1);

  if (d < -0.9999) {
    return qGyro; // 反平行 -- 補正不可
  }

  const qw = 1 + d;
  const qMag = Math.sqrt(qw * qw + cx * cx + cy * cy + cz * cz);
  const qAcc: Quaternion = {
    w: qw / qMag, x: cx / qMag, y: cy / qMag, z: cz / qMag,
  };

  // 線形補間 (LERP) + 正規化 -- SLERP の近似
  const nw = alpha * qGyro.w + (1 - alpha) * qAcc.w;
  const nx = alpha * qGyro.x + (1 - alpha) * qAcc.x;
  const ny = alpha * qGyro.y + (1 - alpha) * qAcc.y;
  const nz = alpha * qGyro.z + (1 - alpha) * qAcc.z;

  const norm = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
  return {
    w: nw / norm, x: nx / norm, y: ny / norm, z: nz / norm,
  };
}
```

### 9.4 `deviceToWorld`

```typescript
/**
 * デバイス座標系のベクトルを世界座標系に変換する。
 * v_world = q (x) v_device (x) q*
 *
 * @param vec - デバイス座標系のベクトル
 * @param q - 現在の姿勢四元数
 * @returns 世界座標系のベクトル
 */
function deviceToWorld(vec: Vec3, q: Quaternion): Vec3 {
  // ハミルトン積: q (x) (0, vx, vy, vz) (x) q*
  // まず temp = q (x) (0, vx, vy, vz)
  const tw = -q.x * vec.x - q.y * vec.y - q.z * vec.z;
  const tx =  q.w * vec.x + q.y * vec.z - q.z * vec.y;
  const ty =  q.w * vec.y - q.x * vec.z + q.z * vec.x;
  const tz =  q.w * vec.z + q.x * vec.y - q.y * vec.x;

  // 次に temp (x) q* (q* = conjugate)
  return {
    x: tw * (-q.x) + tx * q.w + ty * (-q.z) - tz * (-q.y),
    y: tw * (-q.y) - tx * (-q.z) + ty * q.w + tz * (-q.x),
    z: tw * (-q.z) + tx * (-q.y) - ty * (-q.x) + tz * q.w,
  };
}
```

### 9.5 `extractVerticalAcceleration`

```typescript
/**
 * DeviceMotionEvent から世界座標系の垂直加速度を抽出する。
 *
 * acceleration が利用可能ならそれを使い、null なら
 * accelerationIncludingGravity から手動で重力を除去する。
 *
 * @param q - 現在の姿勢四元数
 * @param acceleration - acceleration { x, y, z } or null
 * @param accIncGravity - accelerationIncludingGravity { x, y, z }
 * @param isIOS - iOS フラグ
 * @returns 垂直加速度 a_z [m/s^2]（上向き正）
 */
function extractVerticalAcceleration(
  q: Quaternion,
  acceleration: Vec3 | null,
  accIncGravity: Vec3,
  isIOS: boolean,
): number {
  const GRAVITY = 9.81;

  if (acceleration !== null) {
    // acceleration は重力除去済み -> そのまま世界座標系に変換
    const aWorld = deviceToWorld(acceleration, q);
    return aWorld.z;
  }

  // acceleration が null -> accelerationIncludingGravity から手動で重力除去
  let gInc = { ...accIncGravity };
  if (isIOS) {
    gInc = { x: -gInc.x, y: -gInc.y, z: -gInc.z };
  }

  // 世界座標系での重力ベクトル (0, 0, -g) をデバイス座標系に変換
  // g_device = q* (x) (0, 0, -g) (x) q
  const qConj: Quaternion = { w: q.w, x: -q.x, y: -q.y, z: -q.z };
  const gWorld: Vec3 = { x: 0, y: 0, z: -GRAVITY };
  const gDevice = deviceToWorld(gWorld, qConj);

  // 線形加速度 = accelerationIncludingGravity - g_device
  const aLinear: Vec3 = {
    x: gInc.x - gDevice.x,
    y: gInc.y - gDevice.y,
    z: gInc.z - gDevice.z,
  };

  // 世界座標系に変換
  const aWorld = deviceToWorld(aLinear, q);
  return aWorld.z;
}
```

### 9.6 `integrateVerticalVelocity`

```typescript
type IntegrationResult = {
  v0_vertical: number;         // リリース時の垂直速度 [m/s]
  freefallStartIdx: number;    // フリーフォール開始サンプルのインデックス
};

/**
 * 垂直加速度の時系列を台形則で積分し、リリース時の垂直速度を求める。
 *
 * Launch 検出 -> フリーフォール検出の区間で積分を実行。
 * フリーフォール検出時点の v_z を v0_vertical として返す。
 *
 * @param samples - AccelSample 配列（v2 拡張型）
 * @param q0 - 初期姿勢四元数
 * @param isIOS - iOS フラグ
 * @param alpha - complementary filter 係数 (0.98)
 * @returns { v0_vertical, freefallStartIdx }
 */
function integrateVerticalVelocity(
  samples: AccelSample[],
  q0: Quaternion,
  isIOS: boolean,
  alpha: number = 0.98,
): IntegrationResult {
  const LAUNCH_THRESHOLD = 15.0;          // m/s^2
  const LAUNCH_CONFIRM_COUNT = 2;
  const FREEFALL_THRESHOLD_WORLD = 3.0;   // m/s^2 (世界座標系)
  const FREEFALL_CONFIRM_MS = 40;

  let q = { ...q0 };
  let vz = 0;
  let prevAz = 0;
  let integrating = false;
  let launchConfirmCount = 0;
  let freefallCandidateStart = 0;
  let freefallStartIdx = -1;

  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[i - 1];
    const dt = (s.t - prev.t) / 1000; // ms -> s

    if (dt <= 0 || dt > 0.1) continue; // 異常 dt スキップ

    // --- 姿勢更新 ---
    if (s.rx !== null && s.ry !== null && s.rz !== null) {
      // ジャイロベース更新
      q = updateOrientation(q, {
        alpha: s.rz,    // Z軸 = alpha
        beta: s.rx,     // X軸 = beta
        gamma: s.ry,    // Y軸 = gamma
      }, dt);

      // Complementary filter 補正
      q = applyComplementaryCorrection(
        q, { x: s.gx, y: s.gy, z: s.gz }, alpha, isIOS,
      );
    }

    // --- 垂直加速度の抽出 ---
    const hasLinearAccel = (s.x !== s.gx || s.y !== s.gy || s.z !== s.gz);
    const acceleration = hasLinearAccel
      ? { x: s.x, y: s.y, z: s.z }     // acceleration あり
      : null;                             // accelerationIncludingGravity のみ
    const az = extractVerticalAcceleration(
      q, acceleration, { x: s.gx, y: s.gy, z: s.gz }, isIOS,
    );

    // --- Launch 検出 ---
    if (!integrating) {
      if (s.magnitude > LAUNCH_THRESHOLD) {
        launchConfirmCount++;
        if (launchConfirmCount >= LAUNCH_CONFIRM_COUNT) {
          integrating = true;
          vz = 0;
          prevAz = az;
        }
      } else {
        launchConfirmCount = 0;
      }
      continue;
    }

    // --- 台形則積分 ---
    vz += (prevAz + az) / 2 * dt;
    prevAz = az;

    // --- フリーフォール検出（世界座標系） ---
    // 全3成分の大きさを使用
    if (hasLinearAccel) {
      const aWorld = deviceToWorld({ x: s.x, y: s.y, z: s.z }, q);
      const aWorldMag = Math.sqrt(
        aWorld.x * aWorld.x + aWorld.y * aWorld.y + aWorld.z * aWorld.z
      );

      if (aWorldMag < FREEFALL_THRESHOLD_WORLD) {
        if (freefallCandidateStart === 0) {
          freefallCandidateStart = s.t;
        }
        if (s.t - freefallCandidateStart >= FREEFALL_CONFIRM_MS) {
          freefallStartIdx = i;
          break; // v0_vertical 確定
        }
      } else {
        freefallCandidateStart = 0;
      }
    } else {
      // acceleration null -> magnitude ベースフォールバック
      if (s.magnitude < 8.0) {
        if (freefallCandidateStart === 0) {
          freefallCandidateStart = s.t;
        }
        if (s.t - freefallCandidateStart >= FREEFALL_CONFIRM_MS) {
          freefallStartIdx = i;
          break;
        }
      } else {
        freefallCandidateStart = 0;
      }
    }
  }

  return {
    v0_vertical: Math.max(0, vz),
    freefallStartIdx,
  };
}
```

### 9.7 `calculateHeightV2`

```typescript
type ThrowMode = "physical" | "beyond";

/**
 * 垂直初速から最高到達高度を計算する。
 * Physical Mode: h = v0^2 / (2g)
 * Beyond Mode:   h = g * t^2 / 8
 *
 * @param v0_vertical - 垂直初速 [m/s] (Physical Mode)
 * @param airtimeSeconds - airtime [秒] (Beyond Mode)
 * @param mode - "physical" | "beyond"
 * @returns 最高到達高度 [m]
 */
function calculateHeightV2(
  v0_vertical: number,
  airtimeSeconds: number,
  mode: ThrowMode,
): number {
  const GRAVITY = 9.81;

  if (mode === "beyond") {
    return (GRAVITY * airtimeSeconds * airtimeSeconds) / 8;
  }

  // Physical Mode
  if (v0_vertical <= 0) return 0;
  return (v0_vertical * v0_vertical) / (2 * GRAVITY);
}
```

### 9.8 `detectPhase`（位相遷移ロジック全体）

```typescript
type SensorMode = "high-precision" | "fallback";

type DetectorState = {
  sensorMode: SensorMode;
  q: Quaternion | null;
  isIOS: boolean;
  prevT: number;
  prevSampleT: number;
  vz: number;
  prevAz: number;
  integrating: boolean;
  launchTime: number;
  launchConfirmCount: number;
  freefallStartTime: number;
  freefallCandidateStart: number;
  landingConfirmCount: number;
  firstLandingSampleTime: number;
  v0_vertical: number;
};

type ThrowResultV2 = {
  airtimeSeconds: number;
  heightMeters: number;
  freefallStartTime: number;
  landingTime: number;
  peakTime: number;
  estimatedV0: number;      // v0_vertical
  mode: ThrowMode;
  sensorMode: SensorMode;
};

/**
 * 投擲検出の状態遷移ロジック。
 * v1 の processPhase() を拡張し、四元数ベースの世界座標系処理を組み込む。
 *
 * 主な変更点:
 * 1. 各イベントで姿勢四元数を更新
 * 2. フリーフォール/着地検出を世界座標系で実行（high-precision モード）
 * 3. リリース時に v0_vertical を記録
 * 4. 着地時にモード判定と高度計算を実行
 */
function detectPhase(
  currentPhase: ThrowPhase,
  sample: AccelSample,
  state: DetectorState,
): { newPhase: ThrowPhase; result?: ThrowResultV2 } {
  const now = sample.t;

  // --- 毎イベント: 姿勢更新（high-precision モードのみ）---
  if (state.sensorMode === "high-precision" && state.q !== null) {
    if (sample.rx !== null && sample.ry !== null && sample.rz !== null) {
      const dt = state.prevT > 0 ? (now - state.prevT) / 1000 : 0;
      if (dt > 0 && dt < 0.1) {
        state.q = updateOrientation(state.q, {
          alpha: sample.rz,
          beta: sample.rx,
          gamma: sample.ry,
        }, dt);
        state.q = applyComplementaryCorrection(
          state.q,
          { x: sample.gx, y: sample.gy, z: sample.gz },
          0.98,
          state.isIOS,
        );
      }
    }
  }
  state.prevT = now;

  // --- 垂直加速度の抽出 ---
  let az = 0;
  let aWorldMag = 0;
  if (state.sensorMode === "high-precision" && state.q !== null) {
    const hasLinearAccel = (sample.x !== sample.gx ||
                            sample.y !== sample.gy ||
                            sample.z !== sample.gz);
    const acceleration = hasLinearAccel
      ? { x: sample.x, y: sample.y, z: sample.z }
      : null;
    az = extractVerticalAcceleration(
      state.q, acceleration,
      { x: sample.gx, y: sample.gy, z: sample.gz },
      state.isIOS,
    );
    if (acceleration) {
      const aw = deviceToWorld(acceleration, state.q);
      aWorldMag = Math.sqrt(aw.x ** 2 + aw.y ** 2 + aw.z ** 2);
    } else {
      aWorldMag = Math.abs(az);
    }
  }

  // --- 位相遷移 ---
  switch (currentPhase) {
    case "calibrating": {
      // v1 と同様だが追加で:
      // - rotationRate の null チェックで sensorMode を判定
      // - q0 の計算 (initializeOrientation)
      // - 静止判定の強化（セクション5参照）
      // (省略 -- v1 ロジック + q0 初期化)
      break;
    }

    case "waiting-throw": {
      // v1 と同じ launch 検出（magnitude ベース）
      if (sample.magnitude > 15.0) {
        state.launchConfirmCount++;
        if (state.launchConfirmCount >= 2) {
          state.launchTime = now;
          state.vz = 0;
          state.prevAz = az;
          state.integrating = true;
          state.freefallCandidateStart = 0;
          return { newPhase: "launched" };
        }
      } else {
        state.launchConfirmCount = 0;
      }
      break;
    }

    case "launched": {
      // --- 垂直速度の積分 ---
      if (state.integrating) {
        const dt = state.prevSampleT > 0
          ? (now - state.prevSampleT) / 1000
          : 0;
        if (dt > 0 && dt < 0.1) {
          state.vz += (state.prevAz + az) / 2 * dt;
          state.prevAz = az;
        }
      }
      state.prevSampleT = now;

      // --- フリーフォール検出 ---
      const ffThreshold = state.sensorMode === "high-precision"
        ? 3.0   // 世界座標系
        : 8.0;  // デバイス座標系 (fallback)
      const ffMag = state.sensorMode === "high-precision"
        ? aWorldMag
        : sample.magnitude;

      if (ffMag < ffThreshold) {
        if (state.freefallCandidateStart === 0) {
          state.freefallCandidateStart = now;
        }
        if (now - state.freefallCandidateStart >= 40) {
          state.freefallStartTime = state.freefallCandidateStart;
          state.v0_vertical = Math.max(0, state.vz);
          state.integrating = false;
          return { newPhase: "freefall" };
        }
      } else {
        state.freefallCandidateStart = 0;
      }

      // Launch timeout
      if (state.freefallCandidateStart === 0 &&
          now - state.launchTime > 1000) {
        state.integrating = false;
        return { newPhase: "waiting-throw" };
      }
      break;
    }

    case "freefall": {
      const freefallElapsed = now - state.freefallStartTime;
      const MAX_FREEFALL_MS = 600000;

      // --- 着地検出 ---
      const landThreshold = state.sensorMode === "high-precision"
        ? 5.0
        : 12.0;
      const landMag = state.sensorMode === "high-precision"
        ? aWorldMag
        : sample.magnitude;

      if (landMag > landThreshold) {
        if (state.landingConfirmCount === 0) {
          state.firstLandingSampleTime = now;
        }
        state.landingConfirmCount++;
      } else {
        state.landingConfirmCount = 0;
        state.firstLandingSampleTime = 0;
      }

      const isLanding =
        state.landingConfirmCount >= 2 ||
        freefallElapsed > MAX_FREEFALL_MS;

      if (isLanding) {
        const landingTime = state.firstLandingSampleTime > 0
          ? state.firstLandingSampleTime
          : now;
        const freefallDuration = landingTime - state.freefallStartTime;

        if (freefallDuration < 60) { // MIN_FREEFALL_MS
          state.landingConfirmCount = 0;
          state.firstLandingSampleTime = 0;
          return { newPhase: "waiting-throw" };
        }

        const clampedDuration = Math.min(freefallDuration, MAX_FREEFALL_MS);
        const airtimeSeconds = clampedDuration / 1000;

        // --- モード判定 ---
        const mode: ThrowMode = airtimeSeconds > 10.0
          ? "beyond"
          : "physical";

        // --- 高度計算 ---
        const heightMeters = calculateHeightV2(
          state.v0_vertical, airtimeSeconds, mode,
        );

        return {
          newPhase: "landed",
          result: {
            airtimeSeconds,
            heightMeters,
            freefallStartTime: state.freefallStartTime,
            landingTime,
            peakTime: state.freefallStartTime + clampedDuration / 2,
            estimatedV0: state.v0_vertical,
            mode,
            sensorMode: state.sensorMode,
          },
        };
      }
      break;
    }
  }

  return { newPhase: currentPhase };
}
```


---

## 10. テストケース

### Physical Mode テスト（airtime <= 10秒）

| ID | ケース | 入力条件 | 期待 mode | 期待 v0_z | 期待高度 | 許容誤差 |
|----|-------|---------|----------|-----------|---------|---------|
| T1 | 垂直投擲 低め | 真上に v0=5 m/s で投擲。端末回転なし。airtime ~1.02s | physical | 5.0 m/s | 1.27 m | +-5% |
| T2 | 45度斜め投擲 | 水平5 m/s + 垂直5 m/s。端末回転なし | physical | 5.0 m/s | 1.27 m | +-5% |
| T3 | 垂直投擲 強め | 真上に v0=10 m/s。airtime ~2.04s | physical | 10.0 m/s | 5.10 m | +-5% |
| T4 | 非対称キャッチ | 立って投げ(v0=5 m/s)しゃがんで受ける。キャッチ位置が1m下 | physical | 5.0 m/s | 1.27 m | +-5% |
| T5 | 回転投擲 | 垂直 v0=5 m/s、端末が2 rev/s(~12.6 rad/s)で回転 | physical | 5.0 m/s | 1.27 m | +-10% |
| T6 | 下向き投擲 | 端末を下に振った。v0_z < 0 | physical | 0 m/s | 0 m | -- |
| T7 | 極端な高投擲 | アスリート級 v0=30 m/s。airtime ~6.12s | physical | 30.0 m/s | 45.9 m | +-5% |

**各テストケースのセンサー入力説明:**

**T1（垂直投擲 低め）**: キャリブレーション中、accelerationIncludingGravity は (0, 0, -9.81) 付近で安定。rotationRate は (0, 0, 0)。Launch フェーズで Z方向に 20 m/s^2 が ~50ms 続く。その後、freefall で acceleration の magnitude が ~0 に近づく。約1秒後に 15 m/s^2 超の着地スパイク。全期間で角速度 ~0。

**T2（45度斜め投擲）**: T1 と同じキャリブレーション。Launch 時の加速度ベクトルが斜め45度方向で magnitude ~21 m/s^2 だが、世界座標系の垂直成分は ~15 m/s^2。v1 ではスカラー積分で v0 = ~7 m/s（過大評価 40%）になるが、v2 では垂直成分のみ抽出で v0_z = 5.0 m/s。ジャイロは角速度 ~0（端末回転なし）。

**T3（垂直投擲 強め）**: T1 の 2倍の加速度パターン。Launch spike ~40 m/s^2。freefall ~2秒間。

**T4（非対称キャッチ）**: T1 と同じ Launch パターン。airtime は T1 より長い（~1.2s）が、v0_z は Launch からフリーフォール検出時点で確定するため 5.0 m/s で同一。v1 の airtime ベース計算では h = g*(1.2)^2/8 = 1.77m（過大評価 40%）になるが、v2 では v0_z ベースで 1.27m。

**T5（回転投擲）**: フリーフォール中に rotationRate が (0, 0, 12.6 rad/s * 180/pi ~= 720 deg/s) 程度。v1 では遠心力（omega^2 * r = 12.6^2 * 0.05 ~= 7.9 m/s^2）が magnitude に加算され freefall 検出が不安定（magnitude ~8 m/s^2 で閾値ギリギリ）。v2 では世界座標系変換後 a_world ~= 0 なのでフリーフォール検出が安定。ただし高速回転で姿勢追跡の精度が若干低下するため許容誤差を +-10% に設定。

**T6（下向き投擲）**: Launch spike は検出される（magnitude > 15）。しかし積分結果の v_z が負のまま。max(0, v_z) = 0 でクランプ。

**T7（極端な高投擲）**: Launch spike > 50 m/s^2。freefall ~6秒間。airtime <= 10s なので Physical Mode。

### Beyond Mode テスト（airtime > 10秒）

| ID | ケース | 入力条件 | 期待 mode | 期待高度 | 計算式 |
|----|-------|---------|----------|---------|--------|
| T8 | ドローン降下 | airtime=15秒 | beyond | ~275.9 m | 9.81 x 15^2 / 8 |
| T9 | 気球降下 | airtime=60秒 | beyond | ~4414.5 m | 9.81 x 60^2 / 8 |
| T10 | 成層圏気球 | airtime=120秒 | beyond | ~17658 m | 9.81 x 120^2 / 8 |
| T11 | 厨二病 MAX | airtime=571秒 | beyond | ~399,589 m | 9.81 x 571^2 / 8 |

**T8（ドローン降下）**: Launch spike 後、15秒間の freefall。端末は自由回転（rotationRate の RMS > 2 rad/s）。サンプルは 10Hz 間引きで ~150個。

**T9（気球降下）**: 60秒間の freefall。サンプルは 10Hz 間引きで ~600個。加速度 magnitude は全期間で ~0（真の freefall）。角速度は空気抵抗による回転で変動。

**T10（成層圏気球）**: T9 と同じパターンだが 120秒。サンプル ~1200個。

**T11（厨二病 MAX）**: 理論上の最大記録。571秒の freefall。600秒の MAX_FREEFALL_MS 未満なのでアンチチートを通過。サンプル ~5710個。

### 境界ケーステスト

| ID | ケース | 入力条件 | 期待 mode | 注意点 |
|----|-------|---------|----------|--------|
| T12 | 境界値ちょうど | airtime=10.000秒 | physical | `<=` 判定のため Physical Mode。v0_z ベースの高度計算を使用 |
| T13 | 境界値直後 | airtime=10.001秒 | beyond | `> 10.0` で Beyond Mode。h = 9.81 x 10.001^2 / 8 ~= 122.6 m |
| T14 | 高所投擲 | airtime=9.999秒 | physical | 高所から投げ下ろして airtime が長いが Physical Mode。v0_z ベースで正確な高度計算 |

**T12（境界値ちょうど）**: airtime がちょうど 10.000秒。`airtime > 10.0` は false なので Physical Mode。v0_z からの計算値を使用する。高所投擲で airtime がこの値になる場合、v0_z は 5 m/s 程度で h = 1.27 m。airtime ベース（g*10^2/8 = 122.6 m）とは大きく乖離するが、Physical Mode では v0_z ベースのみが正式値。

**T13（境界値直後）**: airtime 10.001秒。`> 10.0` が true で Beyond Mode。真空近似式で h = 122.6 m。T12 とほぼ同じ物理的状況だが、0.001秒の差でモードが変わる。これは設計上の意図的な不連続点。

**T14（高所投擲）**: 人間が高所から v0 = 5 m/s で投げ下ろした場合、airtime は長くなるが 10秒未満。Physical Mode として v0_z ベースで計算。

### アンチチート拒否テスト

| ID | ケース | 入力条件 | 期待結果 | 検出チェック |
|----|-------|---------|---------|------------|
| T15 | 物理限界超過 | airtime=700秒（11分40秒） | 拒否 | `beyond_max_duration` / サーバー `MAX_AIRTIME_SECONDS` |
| T16 | サンプル密度不足 | airtime=30秒、サンプル5個 | 拒否 | `beyond_sample_density` |
| T17 | 姿勢静止偽造 | airtime=30秒、rotationRate が全サンプルで (0,0,0) | 拒否 | `beyond_attitude_randomness` |
| T18 | フリーフォール不連続 | airtime=30秒、freefall 中に magnitude>5 が 30% | 拒否 | `beyond_freefall_continuity` |

**T15（物理限界超過）**: サーバーの `MAX_AIRTIME_SECONDS = 600` を超過するため、リクエストバリデーション段階で 400 エラー。アンチチートに到達する前に拒否される。

**T16（サンプル密度不足）**: 30秒の airtime を主張しているが、サンプルが 5個しかない。期待値は 30 x 10 x 0.5 = 150 個以上。5/150 = 3.3% しかなく、時間だけ偽造した疑い。

**T17（姿勢静止偽造）**: フリーフォール中の 30秒間、rotationRate が全て (0, 0, 0)。自由落下するスマートフォンは空気抵抗で必ず回転する。角速度 RMS = 0 < 0.5 rad/s で検出。地面にスマホを置いたまま airtime を偽造した疑い。

**T18（フリーフォール不連続）**: フリーフォール区間の 30% で magnitude > 5.0 m/s^2。閾値は 90% 以上が低G を維持すること。70% では不合格。地面で端末を時々動かしながら長時間放置した疑い。


---

## 付録 A: 参考文献

### W3C 仕様・MDN
1. [DeviceMotionEvent - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent) -- `acceleration`, `accelerationIncludingGravity`, `rotationRate` の仕様
2. [DeviceMotionEvent: rotationRate property | MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/rotationRate) -- `rotationRate` の `alpha`, `beta`, `gamma` 軸定義、null 挙動。W3C 仕様では精度制限 0.1 deg/s
3. [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/) -- W3C 仕様本体
4. [Window: devicemotion event | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicemotion_event) -- イベント仕様

### iOS / Safari 固有
5. [Apple Developer Forums: deviceMotion rotationRate is null](https://developer.apple.com/forums/thread/131856) -- iOS 13+ での `requestPermission` 必須化、権限未付与時の null 挙動
6. [Apple Developer: DeviceMotionEvent](https://developer.apple.com/documentation/webkitjs/devicemotionevent) -- Apple 公式ドキュメント

### 姿勢推定アルゴリズム
7. Madgwick, S.O.H. (2010). "An efficient orientation filter for inertial and inertial/magnetic sensor arrays." [Internal Report](https://courses.cs.washington.edu/courses/cse466/14au/labs/l4/madgwick_internal_report.pdf) -- Madgwick filter 原著。IMU 構成での beta = 0.033 推奨値
8. [Madgwick Orientation Filter -- AHRS documentation](https://ahrs.readthedocs.io/en/latest/filters/madgwick.html) -- Madgwick filter の数学的解説
9. [Complementary Filter -- AHRS documentation](https://ahrs.readthedocs.io/en/latest/filters/complementary.html) -- Complementary filter の理論と実装
10. Valenti, R.G. et al. (2015). "Keeping a Good Attitude: A Quaternion-Based Orientation Filter for IMUs and MARGs." [Sensors, 15(8)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4570372/) -- 四元数ベースの complementary filter。短時間での Madgwick との精度比較
11. [Quaternion-Based Complementary Filter for Attitude Determination of a Smartphone](https://www.researchgate.net/publication/303598655_Quaternion-Based_Complementary_Filter_for_Attitude_Determination_of_a_Smartphone) -- スマートフォンでの四元数 complementary filter 実装

### JavaScript 実装
12. [psiphi75/ahrs - GitHub](https://github.com/psiphi75/ahrs) -- JavaScript の AHRS ライブラリ（Madgwick / Mahony）。参考実装として活用可能
13. [IMU Madgwick filter explanation (Medium)](https://medium.com/@k66115704/imu-madgwick-filter-explanation-556fbe7f02e3) -- Madgwick filter の分かりやすい解説
14. [Mathematical Model of an IMU Madgwick Filter](https://nitinjsanket.github.io/tutorials/attitudeest/madgwick) -- 数学的導出の詳細

### センサーノイズ特性
15. Smartphone MEMS Accelerometer and Gyroscope Measurement Errors. [Sensors, 23(17), 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10490716/) -- スマートフォン MEMS の誤差特性。加速度 sigma = 0.01 m/s^2、ジャイロ sigma = 0.003 rad/s

### Web Sensor API（参考）
16. [OrientationSensor | MDN](https://developer.mozilla.org/en-US/docs/Web/API/OrientationSensor) -- Generic Sensor API。Chrome/Android のみ対応のため本設計では不採用（iOS Safari 非対応）
17. [Sensors for the web | Chrome Developers](https://developer.chrome.com/articles/generic-sensor/) -- Generic Sensor API の概要

### 四元数の数学
18. [Quaternions and spatial rotation - Wikipedia](https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation) -- 四元数による回転の数学的基盤

---

## 付録 B: Phase 1 で変更すべきファイル一覧

| ファイル | 変更内容 | 優先度 |
|---------|---------|-------|
| `src/lib/types.ts` | `AccelSample` 型の拡張（`gx,gy,gz,rx,ry,rz` 追加）、`ThrowMode` 型追加、`ThrowResult` に `mode`, `sensorMode` 追加、`SensorMode` 型追加 | P0 |
| `src/lib/physics.ts` | `calculateHeightV2()` 追加、四元数演算関数群（`Quaternion` 型、`quaternionMultiply`, `deviceToWorld`, `normalize` 等）追加 | P0 |
| `src/lib/sensor.ts` | `ThrowDetector` クラスの大幅改修: 姿勢追跡ループ、complementary filter、`extractVerticalAcceleration`、`integrateVerticalVelocity`、モード判定、閾値変更、`MAX_FREEFALL_MS = 600000` | P0 |
| `src/lib/anti-cheat.ts` | 新チェック追加（`v0_airtime_consistency`, `attitude_accel_consistency`, Beyond Mode 用4チェック）、`recalculateScoreHeight` を四元数ベース再計算に置換、サンプル間引きロジック | P0 |
| `src/app/api/verify/route.ts` | `MAX_HEIGHT_METERS = 500000`、`MAX_AIRTIME_SECONDS = 600`、`mode` フィールドの検証・DB 保存、`sensorMode` の保存 | P0 |
| `src/app/api/rankings/route.ts`（想定） | `mode` フィールドをレスポンスに含める | P1 |
| ランキング UI コンポーネント | `mode === "beyond"` で CSS クラス `ranking-name--beyond` を付与 | P1 |
| 結果画面 UI | `mode === "beyond"` で赤系演出 | P2 |
| DB マイグレーション | `throws` テーブルに `mode`, `sensor_mode` カラム追加。既存データの破棄（`DELETE FROM throws; DELETE FROM devices;`） | P0 |

### ファイル変更の依存関係

```
types.ts (型定義)
  +---> physics.ts (四元数演算)
  |       +---> sensor.ts (検出ロジック)
  |               +---> anti-cheat.ts (検証ロジック)
  |                       +---> verify/route.ts (API)
  +---> DB migration (スキーマ)
          +---> rankings API + UI
```

Phase 1 実装順序の推奨:
1. `types.ts` -- 型定義を先に確定
2. `physics.ts` -- 四元数ライブラリを独立して実装・単体テスト
3. DB migration -- スキーマ変更を先行
4. `sensor.ts` -- 検出ロジックの改修（最大の作業量）
5. `anti-cheat.ts` -- 検証ロジックの改修
6. `verify/route.ts` -- API の更新
7. UI -- ランキング色分け

---

*設計書ここまで。本文書はコードを一切変更せず、Phase 1 実装のための数理・アーキテクチャ設計のみを記述した。*
