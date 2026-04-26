# Bounce FC — Claude Reference

Single-file HTML5 canvas betting game. Mobile-first 360×640px.
All game logic, rendering, and UI live in `index.html`.

---

## File Structure

```
bounce_fc/
├── index.html        — entire game (HTML + CSS + JS, ~820 lines)
├── GAME_DESIGN.md    — full game design document
├── CLAUDE.md         — this file
└── images/
    └── bg.png        — background (1080×1920px, scales to 360×640)
```

Sprites for enemies, player, fireball — still loaded from Figma MCP URLs (expire 7 days from fetch). Export to `/images/` to make permanent.

---

## Canvas Coordinate System

Canvas: **360 × 640 px**. Origin top-left. Y increases downward.

```
(0,0)────────────────(360,0)
  │  dark border (FT=50)     │
  │  ┌──────────────────┐    │  y=50   ← FT (field top / enemy grid start)
  │  │  enemy grid      │    │
  │  │  7 cols × 9 rows │    │
  │  │  cells: 40×40px  │    │
  │  │                  │    │
  │  │ - - - DEAD LINE- │    │  y=512  ← DIVIDER_Y (grass→dirt boundary)
  │  │                  │    │
  │  │   🧙 player      │    │  y=570  ← PLAYER_Y
  │  └──────────────────┘    │  y=620  ← FB (ball exit)
(0,640)─────────────(360,640)
       FL=40      FR=320
```

### Key Constants

| Constant | Value | Meaning |
|---|---|---|
| `CW / CH` | 360 / 640 | Canvas size |
| `FL / FR` | 40 / 320 | Field left/right wall |
| `FT` | 50 | Field top (ball reflects here) |
| `FB` | 620 | Ball exits here → triggers advance |
| `COLS / ROWS` | 7 / 9 | Enemy grid dimensions |
| `CELL_W / CELL_H` | 40 / 40 | Cell size (square) |
| `ENEMY_W / ENEMY_H` | 32 / 32 | Sprite draw size |
| `ENEMY_HIT_PAD_X/Y` | 3 / 3 | Hitbox inset from sprite |
| `DIVIDER_Y` | 512 | Breach line (grass→dirt) |
| `MAX_SPAWN_ROW` | 7 | Max row for enemy spawn (≥3 rounds buffer) |
| `PLAYER_X / Y` | 180 / 570 | Player centre / bottom |
| `PLAYER_W / H` | 60 / 68 | Player sprite size |
| `BALL_R` | 9 | Ball radius |
| `BALL_SPEED` | 9 | px per frame |
| `AIM_STEPS` | 220 | Trajectory preview steps |

### Background Image (bg.png)

1080×1920 drawn at (0, 0, 360, 640) — exact 1/3 scale, no distortion.
Field proportions (from image measurement × 1/3):
- Side dark bars: ~11% → FL=40, FR=320
- Top dark bar: ~8% → FT=50
- Grass→dirt boundary: ~80% → DIVIDER_Y=512
- Pitch markings baked into the PNG (goal box, center line, circle)

---

## Layer Order (bottom → top)

1. **Canvas** — background + game objects (enemies, ball, player, popups)
2. **`#fg-frame`** — castle arch overlay (`z-index:10`, `pointer-events:none`)
3. **`#header`**, **`#banner`**, **`#bottom`** — HUD (`z-index:20`)
4. **`#breach`** — game over overlay (`z-index:30`)

---

## Asset URLs

All remote assets are Figma MCP URLs (expire 7 days from fetch). Local assets have no expiry.

| Key | Source | Path / URL |
|---|---|---|
| `bgField` | Local | `images/bg.png` |
| `player` | Figma `103:16400` | MCP URL |
| `ghoul` | Figma `210:26744` | MCP URL |
| `skull` | Figma `210:26773` | MCP URL |
| `mage` | Figma `210:26752` | MCP URL |
| `king` | Figma `210:26781` | MCP URL |
| `fireball` | Figma `103:16727` | MCP URL |
| `flame` | Figma `103:16727` (Union) | MCP URL |
| `fg-frame` | Figma `168:26111` | HTML `<img>` (not in URLS) |
| Wallet UI imgs | Figma UI components | HTML `<img>` (not in URLS) |

**To re-fetch a Figma asset:** `get_design_context(nodeId, fileKey='FmIcjmHoYQBEqp71zMFVa3')`

---

## Enemy Types

| idx | Name | Sprite key | HP | Dmg | Payout | Weight |
|---|---|---|---|---|---|---|
| 0 | Ghoul | `ghoul` | 2 | 1–3 | ×1.5 | 40 |
| 1 | Skull | `skull` | 4 | 1–3 | ×3 | 30 |
| 2 | Mage | `mage` | 6 | 1–2 | ×6 | 20 |
| 3 | King | `king` | 10 | 1 | ×20 | 10 |

- No miss mechanic — every ball contact always deals damage
- RTP controlled by HP, dmg range, payout multiplier, spawn weights
- Killed enemies deferred to next round (`pendingSpawns++`), spawn in `advanceEnemies()`

---

## Game State (`state` object)

```js
{
  screen:        'bet' | 'arena' | 'breach',
  balance:       number,          // NGN
  betIdx:        0–7,             // index into BET_LEVELS
  enemies:       [{ typeIdx, hp, maxHp, col, row }],
  ball:          { x, y, vx, vy } | null,
  ballActive:    boolean,
  aimX, aimY:    number,          // current aim target (canvas coords)
  isAiming:      boolean,
  shotsFired:    number,
  kills:         number,
  ngnSpent:      number,
  ngnEarned:     number,
  popups:        [{ x, y, text, age, maxAge }],
  hitFlash:      { x, y, age } | null,
  pendingSpawns: number,
}
```

---

## Screens & Flow

```
Bet Screen  →  (BET button)  →  Arena
Arena       →  (back button) →  Bet Screen
Arena       →  (breach)      →  Breach Overlay
Breach      →  (SIEGE AGAIN) →  Arena (keeps balance)
```

**Bet screen:** slider maps to `BET_LEVELS = [10,50,100,200,500,1000,2000,5000]` NGN

**Arena input:**
- `pointerdown` → start aim, show trajectory
- `pointermove` → update aim direction
- `pointerup` → shoot (deducts bet, fires ball)
- `aimY` clamped to `PLAYER_Y - PLAYER_H - 10` so ball always fires upward

---

## Physics

**Ball:**
- Starts at `(PLAYER_X, PLAYER_Y - PLAYER_H + 10)`
- Bounces off FL, FR (x reflect), FT (y reflect)
- Exits when `y > FB + BALL_R` → triggers `advanceEnemies()`

**Enemy collision (per step, first hit only):**
- AABB test against `enemyRect` (sprite inset by HIT_PAD)
- Minimum-overlap axis → correct face reflection + nudge
- Damage roll: `dmgMin + floor(random * (dmgMax - dmgMin + 1))`

**Enemy advance:**
- All enemies `row++` after each shot
- Breach if any `enemyXY(col, row).y + ENEMY_H > DIVIDER_Y`
- `pendingSpawns` enemies spawn into top rows after advance

---

## Key Functions

| Function | What it does |
|---|---|
| `resetState()` | Full state reset to bet screen defaults |
| `initArena()` | Clears enemies, fills rows 0–2 (21 enemies) |
| `spawnEnemy()` | Weighted random type, random empty slot ≤ MAX_SPAWN_ROW |
| `enemyXY(col,row)` | Canvas coords for enemy sprite top-left |
| `enemyRect(e)` | Hitbox rect (inset from sprite) |
| `calcTrajectory(sx,sy,tx,ty)` | Wall-bounce preview points array |
| `stepBall()` | One physics tick — move, bounce, collide, check exit |
| `advanceEnemies()` | row++, spawn pending, check breach |
| `shoot()` | Deduct bet, create ball, fire |
| `render()` | Full canvas repaint every frame |
| `goToBet/Arena()` | Screen transition helpers |

---

## TODO (from GAME_DESIGN.md)

- [ ] Export Figma assets to `/images/` (URLs expire in 7 days)
- [ ] Spine animation integration (ask user for .json + .atlas + .png)
- [ ] Unique sound effects (shoot, hit, kill, advance)
- [ ] Screen shake on kill
- [ ] Particle effects on enemy death
- [ ] Enemy advance animation (smooth slide)
- [ ] Balance testing & RTP verification
