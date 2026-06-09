#!/usr/bin/env python3
"""
Bounce FC RTP Simulation — combo payout model
Usage: python3 simulate_rtp.py [rounds]
"""
import sys, math, random, time
from collections import defaultdict

# ── Constants (must match config.js) ─────────────────────
COLS = 7;  CELL_W = 36;  CELL_H = 36
FL = 54;   FR = FL + COLS * CELL_W   # 306
FT = 135;  PLAYER_X = 180;  PLAYER_Y = 561
BALL_R = 9;  BALL_SPEED = 12
ENEMY_W = 32;  ENEMY_H = 32
HIT_PAD = 3
GRID_LEFT = FL;  ENEMY_START_Y = FT
MAX_SPAWN_ROW = 5

ENEMY_TYPES = [
    dict(name='Ghoul', hp=1, dmg_min=1, dmg_max=2, weight=40),
    dict(name='Skull', hp=2, dmg_min=1, dmg_max=2, weight=30),
    dict(name='Mage',  hp=3, dmg_min=1, dmg_max=2, weight=20),
    dict(name='King',  hp=4, dmg_min=1, dmg_max=2, weight=10),
]
TOTAL_WEIGHT = sum(t['weight'] for t in ENEMY_TYPES)

# ── Combo payout ranges (mirrors comboPayout() in game.js) ─
# Format: (min_mult, max_mult) per kill-count tier
COMBO_TIERS = {
    1:    (0.85, 1.65),  # 1 kill
    2:    (1.05, 2.20),  # 2-3 kills
    3:    (1.05, 2.20),
    4:    (1.85, 4.50),  # 4-6 kills
    5:    (1.85, 4.50),
    6:    (1.85, 4.50),
}
COMBO_7PLUS = (3.5, 9.0)            # 7+ kills

def combo_payout(kills):
    if kills == 0:   return 0.0
    if kills >= 7:   lo, hi = COMBO_7PLUS
    else:            lo, hi = COMBO_TIERS[kills]
    return lo + random.random() * (hi - lo)

def avg_combo(kills):
    if kills == 0: return 0.0
    lo, hi = COMBO_7PLUS if kills >= 7 else COMBO_TIERS.get(kills, COMBO_7PLUS)
    return (lo + hi) / 2

# ── Geometry ──────────────────────────────────────────────
def enemy_rect(col, row):
    x = GRID_LEFT + col * CELL_W + HIT_PAD
    y = ENEMY_START_Y + row * CELL_H + HIT_PAD
    w = ENEMY_W - 2 * HIT_PAD
    h = ENEMY_H - 2 * HIT_PAD
    return x, y, w, h

# ── Spawn ─────────────────────────────────────────────────
def spawn_enemy(enemies):
    occ = {(e['col'], e['row']) for e in enemies}
    empty = [(c, r) for r in range(MAX_SPAWN_ROW + 1)
             for c in range(COLS) if (c, r) not in occ]
    if not empty: return
    col, row = random.choice(empty)
    roll = random.random() * TOTAL_WEIGHT
    acc = 0; ti = 0
    for i, t in enumerate(ENEMY_TYPES):
        acc += t['weight']
        if roll < acc: ti = i; break
    t = ENEMY_TYPES[ti]
    enemies.append({'ti': ti, 'hp': t['hp'], 'col': col, 'row': row})

def init_enemies():
    enemies = []
    for _ in range(21): spawn_enemy(enemies)
    return enemies

# ── Ball simulation ───────────────────────────────────────
def simulate_shot(enemies):
    alive = [e for e in enemies if e['hp'] > 0]
    if not alive: return 0

    # 45-degree shot — randomly left or right each shot
    angle_deg = 45 if random.random() < 0.5 else -45
    angle_rad = math.radians(angle_deg)
    vx = math.sin(angle_rad) * BALL_SPEED
    vy = -math.cos(angle_rad) * BALL_SPEED

    bx = float(PLAYER_X); by = float(PLAYER_Y)
    kills = 0

    for _ in range(5000):
        bx += vx; by += vy

        if bx - BALL_R < FL:  bx = FL + BALL_R;  vx =  abs(vx)
        if bx + BALL_R > FR:  bx = FR - BALL_R;  vx = -abs(vx)
        if by - BALL_R < FT:  by = FT + BALL_R;  vy =  abs(vy)
        if by > PLAYER_Y and vy > 0: break

        for e in enemies:
            if e['hp'] <= 0: continue
            rx, ry, rw, rh = enemy_rect(e['col'], e['row'])
            if bx+BALL_R <= rx or bx-BALL_R >= rx+rw: continue
            if by+BALL_R <= ry or by-BALL_R >= ry+rh: continue
            oL=(bx+BALL_R)-rx; oR=(rx+rw)-(bx-BALL_R)
            oT=(by+BALL_R)-ry; oB=(ry+rh)-(by-BALL_R)
            mn = min(oL, oR, oT, oB)
            if   mn == oL: vx = -abs(vx); bx = rx - BALL_R
            elif mn == oR: vx =  abs(vx); bx = rx + rw + BALL_R
            elif mn == oT: vy = -abs(vy); by = ry - BALL_R
            else:          vy =  abs(vy); by = ry + rh + BALL_R
            t = ENEMY_TYPES[e['ti']]
            dmg = random.randint(t['dmg_min'], t['dmg_max'])
            e['hp'] = max(0, e['hp'] - dmg)
            if e['hp'] <= 0: kills += 1
            break

    return kills

# ── Advance + respawn ─────────────────────────────────────
def advance_and_respawn(enemies):
    pending = 0
    alive = []
    for e in enemies:
        if e['hp'] <= 0: continue
        e['row'] += 1
        if ENEMY_START_Y + e['row'] * CELL_H + ENEMY_H > 505:
            pending += 1  # breached → respawn
        else:
            alive.append(e)
    for _ in range(pending): spawn_enemy(alive)
    return alive

# ── Main simulation ───────────────────────────────────────
N = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000
print(f"\nBounce FC RTP Simulation (combo model) — {N:,} rounds")
print("=" * 50)

t0 = time.time()
kill_dist = defaultdict(int)
total_payout = 0.0
enemies = init_enemies()

for i in range(N):
    if i % 50_000 == 0 and i > 0:
        print(f"  {i:,} / {N:,}  ({time.time()-t0:.0f}s)")

    kills = simulate_shot(enemies)
    payout = combo_payout(kills)
    total_payout += payout
    kill_dist[kills] += 1

    # Remove dead, advance, respawn
    enemies = [e for e in enemies if e['hp'] > 0]
    enemies = advance_and_respawn(enemies)
    while len(enemies) < 21: spawn_enemy(enemies)

rtp = total_payout / N
elapsed = time.time() - t0

print(f"\n{'─'*50}")
print(f"  RTP: {rtp*100:.2f}%   (target: 97.00%)")
print(f"  Scale factor to reach 97%: ×{0.97/rtp:.4f}")
print(f"  Elapsed: {elapsed:.1f}s")

print(f"\n  Kill distribution:")
for k in sorted(kill_dist.keys()):
    pct = kill_dist[k] / N * 100
    ev = kill_dist[k] / N * avg_combo(k)
    bar = '█' * int(pct / 2)
    print(f"  {k:2d} kills: {pct:5.2f}%  avg_mult=×{avg_combo(k):.2f}  EV={ev:.4f}  {bar}")

print(f"\n  Analytical EV breakdown:")
total_ev = 0
for k in sorted(kill_dist.keys()):
    p = kill_dist[k] / N
    ev = p * avg_combo(k)
    total_ev += ev
    print(f"  {k:2d} kills: P={p:.4f}  avg_mult=×{avg_combo(k):.2f}  contribution={ev:.4f}")
print(f"  Total EV = {total_ev:.4f}  ({total_ev*100:.2f}%)")

# ── Suggest tuned multipliers for 97% ────────────────────
print(f"\n{'─'*50}")
print(f"  Suggested combo ranges to hit 97% RTP:")
scale = 0.97 / rtp
for k in [1, 2, 4, 7]:
    lo, hi = COMBO_7PLUS if k >= 7 else COMBO_TIERS.get(k, COMBO_7PLUS)
    label = f"{k}+" if k == 7 else (f"{k}-{k+2}" if k in [2, 4] else str(k))
    print(f"  {label:6s} kills: ×{lo*scale:.2f} ~ ×{hi*scale:.2f}  (was ×{lo:.2f}~×{hi:.2f})")
print()
