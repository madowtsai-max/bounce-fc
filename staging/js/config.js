// ── ASSETS ───────────────────────────────────────────────
const URLS = {
  bgField: 'images/bg.png',
  player:  'images/player.png',
  ghoul:   'images/ghoul.png',
  skull:   'images/skull.png',
  mage:    'images/mage.png',
  king:    'images/king.png',
  soccer:  'images/soccer.png',
  smoke:   'images/smoke.png',
};

// ── LAYOUT ───────────────────────────────────────────────
const CW = 360, CH = 640;
const COLS = 7, ROWS = 10;
const CELL_W = 36;               // ENEMY_W(32) + 4px gap — 7×36=252, centers in 360 at FL=FR=54
const CELL_H = 36;               // ENEMY_H(32) + 4px gap — square cell, 7×36=252
const FL = 54;
const FR = CW - FL;              // 306
const FT = 135;
const FB = 620;                  // ball exit line
const ENEMY_W = 32, ENEMY_H = 32;
const GRID_LEFT = (CW - COLS * CELL_W) / 2; // 54 — grid fills field wall-to-wall
const ENEMY_START_Y = FT;
const DIVIDER_Y = 491;           // grass→dirt deadline (= grid bottom: 135 + 9×36 + 32)
const MAX_SPAWN_ROW = 5;         // 4-row buffer before dead line
const ENEMY_DIAG_CHANCE = 0.4;  // probability an enemy tries to advance diagonally
const PLAYER_X = CW / 2;        // 180
const PLAYER_Y = 561;
const PLAYER_W = 60, PLAYER_H = 68;
const BALL_R = 9;
const BALL_SPEED = 9;
const ENEMY_HIT_PAD_X = 0;  // hitbox = full sprite — eliminates diagonal gap
const ENEMY_HIT_PAD_Y = 0;
const AIM_STEPS = 220;

// ── GAME DATA ────────────────────────────────────────────
const BET_MIN   = 10;
const BET_MAX   = 10000000;
const BET_SNAPS = [10,20,50,100,200,500,1000,2000,5000,10000,20000,50000,
                   100000,200000,500000,1000000,2000000,5000000,10000000];

const ENEMY_SCALE     = 0.09;  // ~380 Spine units → ~34px on canvas
const ENEMY_SPINE_Y_OFF = 19;  // skeleton.y = cell_top + this → head at cell top

// Payouts calibrated for ~97% RTP (theoretical, 1-hit-per-shot model)
// Formula: payout = 0.97 × E[hits_to_kill]
// E[hits]: Ghoul=1.33, Skull=2.37, Mage=4.22, King=10.0
// NOTE: actual RTP may be slightly higher due to multi-hit shots per round
const ENEMY_TYPES = [
  { name: 'Ghoul', sprite: 'ghoul', hp: 2,  dmgMin: 1, dmgMax: 3, payout: 1.3, weight: 40 },
  { name: 'Skull', sprite: 'skull', hp: 4,  dmgMin: 1, dmgMax: 3, payout: 2.3, weight: 30 },
  { name: 'Mage',  sprite: 'mage',  hp: 6,  dmgMin: 1, dmgMax: 2, payout: 4.1, weight: 20 },
  { name: 'King',  sprite: 'king',  hp: 10, dmgMin: 1, dmgMax: 1, payout: 9.7, weight: 10 },
];
const TOTAL_WEIGHT = ENEMY_TYPES.reduce((s, t) => s + t.weight, 0);
