# Throw To Win v2 — UI/UX Design Document

**Approved:** 2026-04-16
**Reviewers:** Gemini 3.1 Pro, GPT-5.3 Codex, Claude Opus 4.6

---

## Concept: Premium Extreme

Apple-clean base with explosive moments at high-value events.
Quiet by default. Loud when it matters.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#000000` | Full-screen background |
| `--surface` | `#161616` | Cards, sections |
| `--surface-elevated` | `#1e1e1e` | Hover, active states |
| `--foreground` | `#ffffff` | Primary text, numbers |
| `--muted` | `#666666` | Labels, units, secondary |
| `--accent` | `#ff2d2d` | CTA, peak, personal best |
| `--accent-gold` | `#ffb800` | World/country rank update |
| `--accent-blue` | `#3b82f6` | Mission prompts, info |
| `--error` | `#ff4444` | Measurement failure, connection error |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Card boundaries only |

### State-Based Accent Colors (3-tier)

| State | Accent | Usage |
|-------|--------|-------|
| Normal throw | `--foreground` (#fff) | Default height display |
| Personal best | `--accent` (#ff2d2d) | Height number + "PERSONAL BEST" label |
| World/country rank update | `--accent-gold` (#ffb800) | Height number + rank badge + celebration |

### Typography

| Usage | Font | Weight | Notes |
|-------|------|--------|-------|
| All text | Helvetica Neue / -apple-system / system | — | Zero load time |
| Height number | Same | 400 (Regular) | Large size + letter-spacing -0.02em + tabular-nums. Elegance from spacing, not thinness |
| Labels | Same | 500 (Medium) | 10-12px, letter-spacing 0.05em, uppercase |
| CTA buttons | Same | 600 (Semibold) | 16px, uppercase |
| Body text | Same | 400 (Regular) | 14-15px |
| Mission text | Same | 500 (Medium) | 13px, --accent-blue |

### Spacing

- Component gap: 16px minimum
- Section gap: 32px
- Card internal padding: 20px
- Screen horizontal padding: 20px
- Card boundaries: `--border-subtle` (1px rgba(255,255,255,0.08))

---

## Animation System

### Base (all non-peak UI)

| Animation | Easing | Duration |
|-----------|--------|----------|
| Screen transition | cubic-bezier(0.16, 1, 0.3, 1) | 0.5s |
| Element stagger | Same, 80ms delay between items | 0.4s |
| Button press | spring (scale 0.97 -> 1.0) | 0.15s |
| Number counting | ease-out | 0.8s |
| Fade in | ease-out | 0.3s |

### 3-Tier Impact System

#### Tier 1: Normal throw (no special event)
- Height number appears with fade + slight translateY(4px)
- No shake, no flash, no freeze

#### Tier 2: Personal best
- 40ms micro-freeze (all animation pauses)
- Scale: 0.98 (tame) -> 1.08 (release) -> 1.0 (settle) over 0.4s
- Color transition: white -> `--accent` (#ff2d2d) over 0.2s
- Haptic: `navigator.vibrate([50, 30, 100])` (short-pause-strong)
- "PERSONAL BEST" label fades in below height

#### Tier 3: World/country rank update
- 80ms freeze
- Scale: 0.96 -> 1.12 -> 1.0 over 0.5s with overshoot
- Color transition: white -> `--accent-gold` (#ffb800)
- Haptic: `navigator.vibrate([100, 50, 100, 50, 200])` (celebration pattern)
- Rank badge animates in with spring
- Brief background pulse (surface -> slightly brighter -> surface)

### Removed (from HIT STOP era)
- screen-shake
- white flash overlay
- hit-stop freeze (>100ms)
- film grain
- dust particles
- character-by-character text reveal
- snap-in steps(1) timing

---

## Screen Designs

### Landing
- Pure black background
- Center: "THROW TO WIN" — Regular weight, large, letter-spacing 0.1em
- Below title: personal best (if exists) in large accent-colored number
- Below stats: mission text in --accent-blue (e.g., "あと8cmで国内TOP100")
- Bottom: red CTA button "START" (full width, 56px height, rounded 14px)
- Staggered fade-in-up on load (80ms intervals)

### Countdown
- Semi-transparent black overlay (rgba(0,0,0,0.7))
- Center: large number, smooth fade transition between 3 -> 2 -> 1
- "THROW" text in --accent, same fade timing
- No shake, no snap. Clean transitions.

### Active (camera + height overlay)
- Camera video fullscreen
- Center: height number (Regular 400, large) + "m" (Muted, smaller)
- **Gradient scrim** behind number: radial-gradient from rgba(0,0,0,0.6) center to transparent
- At peak: tier-appropriate animation (see 3-tier system)
- Phase badge (top-right): "FREEFALL" in accent color, small caps

### Result
- Top: height number (dominant, 40-50% of screen width)
- Tier-appropriate color (white / red / gold)
- Below: airtime in muted color
- Personal best label (if applicable) in accent
- **Rank cards** (2x): World rank + Country rank, side by side
  - Surface background (#161616)
  - Subtle border (rgba(255,255,255,0.08))
  - Rank number large, country flag small
  - Own position highlighted
- **Mission text** below ranks: "あと3.2mで世界TOP50" in --accent-blue
- Video player: rounded 12px, surface background
- Action row: Download | Share | Try Again
- Try Again: red CTA, full width

### Failure States

#### Measurement failure (sensor error, no freefall detected)
- Icon: exclamation circle (Lucide) in --error color
- Title: "MEASUREMENT FAILED" in --error
- Body: explanation text in muted
- Surface card with --error tinted subtle border
- CTA: "TRY AGAIN" in red

#### Connection failure (ranking submission failed)
- Local result still shown normally
- Toast/banner at top: "RANKING SUBMISSION FAILED" in --error
- "RETRY" button inline
- Record saved locally, retry on next connection

#### Permission denied (camera/sensor)
- Full screen explanation
- Clear permission grant CTA
- Fallback messaging for unsupported devices

### Ranking
- Tab bar: World | Country (underline indicator in accent)
- List: each row is surface card
  - Rank number (left, bold)
  - Anonymous ID (4 chars + "****")
  - Height + airtime
  - Country flag
- Own row: accent-tinted background, slightly brighter
- Auto-refresh indicator (subtle)

### My Page
- Stats grid: personal best (full-width, accent border), total throws, total airtime
- Mission text: next goal prompt
- Throw history list with sort toggle (date/height)
- Personal best entries highlighted with accent

---

## Haptic Feedback Map

| Event | Pattern | Notes |
|-------|---------|-------|
| Countdown tick | `vibrate(10)` | Subtle tick |
| Throw detected | `vibrate(30)` | Confirmation |
| Peak (normal) | `vibrate(50)` | Single pulse |
| Peak (PB) | `vibrate([50, 30, 100])` | Short-pause-strong |
| Peak (rank update) | `vibrate([100, 50, 100, 50, 200])` | Celebration |
| Error | `vibrate([200, 100, 200])` | Double buzz |

---

## Constraints (unchanged)

- Target: iPhone 16 Pro 402x874
- No emojis
- Icons: Lucide Icons (SVG)
- 12 languages (next-intl)
- Safe areas: notch + home indicator
- Camera recording is core (not removable)
- Existing sensor/physics logic frozen (no changes)
