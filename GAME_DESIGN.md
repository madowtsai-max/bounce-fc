# Bounce FC — Game Design Document

> A mobile betting game where players shoot a bouncing fireball at enemies in a castle arena.
> Each shot costs a bet. Kill enemies to earn instant payouts. Survive as long as possible.

---

## 🎮 Core Loop

```
[Screen 1] Player selects bet amount (slider, range 3–10 → NGN presets)
        ↓
[Screen 2] Player aims at enemies (drag on canvas to set angle)
        ↓
Player taps SHOOT → bet is deducted instantly
        ↓
Fireball bounces around the field (simple reflection physics)
        ↓
Each enemy hit = chance % roll (RTP-controlled per enemy type)
  → Success = damage dealt (HP -1)
  → Fail = no damage (ball still bounces physically)
        ↓
Enemy HP = 0 → instant payout → floating +NGN popup → new enemy spawns in random empty slot
        ↓
Fireball exits player zone (bottom) → shot ends
        ↓
All enemies advance 1 row forward (toward player)
        ↓
❌ Any enemy crosses the divider line → BREACH! overlay → GAME RESET
        ↓
Repeat forever (player decides when to stop)
```

---

## 🏹 Shooting Mechanics

| Rule | Detail |
|---|---|
| **Shots per bet** | 1 shot = 1 bet payment |
| **Projectile** | Fireball (soccer ball core + flame trail) |
| **Ball physics** | Simple reflection (angle in = angle out) |
| **Wall bounce** | Left/right walls reflect X velocity, top reflects Y velocity |
| **Enemy bounce** | Reflects based on which side of enemy was hit |
| **Ball return** | Fireball exits bottom of field → triggers enemy advance |
| **Aim** | Player drags on canvas to set angle; dashed trajectory preview shown |

---

## ⚔️ Kill System

- Every ball contact with an enemy **always deals damage** — no miss mechanic
- Damage is a **random roll within each enemy's damage range**
- Harder enemies have a narrower (lower) damage range — more contacts needed to kill
- Hit = banner shows `-X hp! (Y left)`
- Kill = banner shows `win:X`, floating `+X NGN` popup, new enemy spawns
- Each enemy shows a **damage range badge** (e.g. `1-3dmg`) on its sprite

---

## 💰 Economy & RTP Control

**3 independent RTP levers (hit chance removed):**

| Lever | How it controls RTP |
|---|---|
| Damage range per enemy | Controls how many contacts needed to kill |
| Enemy spawn weight | Controls which enemies appear more often |
| Enemy payout multiplier | Controls reward size on kill |
| Enemy HP | Controls durability — combined with dmg range for expected contacts |

### Enemy Types

| Enemy | HP | Dmg Range | Avg Contacts to Kill | Payout | Spawn Weight | Tint |
|---|---|---|---|---|---|---|
| Ghoul | 2 | 1–3 | ~1.3 | ×1.5 | 40 | Green |
| Skull | 4 | 1–3 | ~2.7 | ×3 | 30 | Purple |
| Mage | 6 | 1–2 | ~4 | ×6 | 20 | Blue |
| King | 10 | 1 (fixed) | 10 | ×20 | 10 | Gold |

> **Note:** No miss mechanic. RTP is controlled entirely by HP, damage range, payout, and spawn weights.
> Currently all enemy types share the same sprite; unique sprites per type are pending.

---

## 🗺️ Field Layout

```
┌─────────────────────────────┐  ← castle top wall (ball reflects) y≈105
│   [ enemy grid area ]       │
│   COLS: 5  ROWS: 4          │
│   cell: ~47×46px            │
│                             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← divider line y≈465 (red dashed)
│                             │
│       🪖 player             │  ← fixed at bottom center x=180 y≈527
└─────────────────────────────┘
     left wall x≈62 / right wall x≈298
```

**Pixel constants (360×640 canvas):**
- Field left: x=62, right: x=298, top: y=105, bottom: y=555
- Field width: 236px, height: 450px
- Enemy cell: 47.2×46px, enemy sprite: 38×36px
- Divider: y=465
- Player: center x=180, y≈527
- Ball radius: 9px, speed: 5px/frame

---

## 📱 Screens

### Screen 1 — Bet Selection
- Top HUD: back button, NGN balance (wallet pill), "Bounce FC" title, menu icon
- Empty field visible (enemies hidden)
- Center field text: **"Carry Your Bullets"**
- Bet slider (3–10) mapped to NGN presets: 10 / 50 / 100 / 200 / 500 / 1K / 2K / 5K
- Bet display: `Bet 🪙 [amount]`
- Red **BET** button at bottom → advances to Arena

### Screen 2 — Game Arena
- Top HUD: back button, live NGN balance, "Bounce FC" title, menu icon
- Event banner: last result (`Ready` / `Aim & Shoot!` / `win:X` / `hit! Xhp left` / `miss!`)
- Canvas: castle background, checkerboard field, enemy grid, player, fireball, aim line
- Each enemy shows: sprite, HP bar (color-coded), hit chance % badge (top-left)
- Dashed white aim trajectory with wall-bounce preview + arrow tip
- White hit flash on contact
- Bottom: `Bet 🪙 [amount]` display + red **SHOOT** button

### Breach Screen (overlay)
- Dark overlay, **"BREACH!"** title in red
- Session stats: shots fired, kills, NGN spent, NGN earned
- **⚔ SIEGE AGAIN** button → resets field, keeps current balance

---

## 🎨 Visual Style (from Figma)
- Medieval castle arena aesthetic (stone arch, torches, red banners)
- Checkerboard grass field (yellow-green)
- Castle frame image covers full 360×640 canvas
- Fireball projectile: soccer ball core + flame/glow overlay
- Viking player character sprite (horned helmet, blue armor)
- Dashed white aim trajectory line + arrowhead
- Gold (#ffd700) for payout popups
- Red (#ff3333) for BET/SHOOT button and BREACH text
- Balance pill with NGN label, white amounts, green/red delta flashes

---

## 🛠️ Tech Stack

- **Engine:** Browser-based HTML5 Canvas (vanilla JS, single HTML file)
- **Target:** Mobile-first (360px wide × 640px tall)
- **Physics:** Simple 2D reflection, no gravity on ball
- **RNG:** `Math.random()` per hit roll
- **Assets:** Pulled directly via Figma MCP asset URLs (valid 7 days — re-export before production)
- **Design tool:** Figma (MCP connected via Claude Code)

---

## 🖼️ Figma Assets

File key: `FmIcjmHoYQBEqp71zMFVa3`  
Node: `158:25615` (Bounce_FC section)

| Asset | Figma Node | Status |
|---|---|---|
| Castle background | `103:16399` (bg) | ✅ In use |
| Checkerboard field | `103:16399` (bg inner) | ✅ In use |
| Player (viking) | `103:16400` (character) | ✅ In use |
| Enemy sprite | `103:16404` (enemy) | ✅ In use (shared across types) |
| Fireball core | `103:16727` (fireball) | ✅ In use |
| Fireball flame | `103:16727` (Union) | ✅ In use |
| Chip (bet slider) | UI component | ✅ In use |
| Ghoul sprite | — | ⏳ Pending |
| Skull sprite | — | ⏳ Pending |
| Mage sprite | — | ⏳ Pending |
| King sprite | — | ⏳ Pending |

---

## 📋 TODO / Next Steps

- [x] Build core game (canvas, physics, enemy grid, RTP rolls)
- [x] Ball/fireball physics + wall reflection
- [x] Player character sprite (from Figma)
- [x] Enemy sprite (from Figma, shared)
- [x] Aim trajectory preview with bounce simulation
- [x] Damage range badge on each enemy (replaced hit% badge)
- [x] Always-hit damage system (removed miss mechanic)
- [x] Floating payout popups on kill
- [x] BREACH! overlay with session stats
- [x] Figma MCP connected in Claude Code
- [ ] Unique sprites per enemy type (Ghoul / Skull / Mage / King)
- [ ] Sound effects (shoot, hit, kill, advance)
- [ ] Screen shake on kill
- [ ] Particle effects on enemy death
- [ ] Enemy advance animation (smooth slide down)
- [ ] Pixel-match remaining Figma screens (advance state)
- [ ] Re-export Figma assets to /assets folder (URLs expire in 7 days)
- [ ] Balance testing & RTP verification

---

## 💬 Design Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Kill system | Always-hit, random dmg range per enemy type | Better feel — no frustrating invisible misses; RTP still controlled via HP + dmg range |
| Ball bounce | Simple reflection | Predictable, skill-based, billiards feel |
| Projectile | Fireball (not plain ball) | Matches Figma art direction |
| Bullet count | 1 shot per bet | Clean economy, each shot feels meaningful |
| Payout timing | Instant on kill | Gambling dopamine hit |
| Enemy advance | 1 step per shot | Constant pressure, infinite loop |
| New enemy spawn | Random empty slot | Keeps field dynamic |
| Spawn pool | Weighted by type | Controls long-term RTP |
| Game over | Enemy crosses divider → BREACH! overlay | Clear stakes, dramatic tension |
| Bet UI | Slider (3–10) mapped to presets | Matches Figma design; clean tap experience |
| Canvas size | 360×640px | Matches Figma frame exactly |
| Single file | index.html (HTML+CSS+JS) | Zero build step, easy to share/test |
