// ── ASSETS ───────────────────────────────────────────────
const URLS = {
  bgField:   'images/bg.png',
  deathline: 'images/deathline.png',
  coin:      'images/coin.png',
  player:    'images/player.png',
  ghoul:     'images/ghoul.png',
  skull:     'images/skull.png',
  mage:      'images/mage.png',
  king:      'images/king.png',
  soccer:    'images/soccer.png',
  smoke:     'images/smoke.png',
  hitVfx1:   'images/hit_vfx1.png',
  hitVfx2:   'images/hit_vfx2.png',
  circle:    'images/circle.png',
};

// ── LAYOUT ───────────────────────────────────────────────
const CW = 360, CH = 640;
const COLS = 7, ROWS = 10;
const CELL_W = 36;               // 7×36=252, FL=54, FR=306 → fits castle arch opening (x=55–304)
const CELL_H = 36;
const FL = 54;
const FR = FL + COLS * CELL_W;   // 306
const FT = 135;
const FB = 620;                  // ball exit line
const ENEMY_W = 32, ENEMY_H = 32;
const GRID_LEFT = FL;            // 54
const ENEMY_START_Y = FT;
const DIVIDER_Y = 505;           // grass→dirt deadline per design
const MAX_SPAWN_ROW = 5;         // 4-row buffer before dead line
const ENEMY_DIAG_CHANCE = 0.4;  // probability an enemy tries to advance diagonally
const PLAYER_X = CW / 2;        // 180
const PLAYER_Y = 561;
const PLAYER_W = 60, PLAYER_H = 68;
const BALL_R = 9;
const BALL_SPEED = 12;
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

// Payouts calibrated for ~97% RTP via Monte Carlo simulation (100k sessions)
// All 4 types have realistic kill chances within typical 5-shot sessions:
//   Ghoul: ~1.95 kills/session | Skull: ~0.70 | Mage: ~0.29 | King: ~0.02 (jackpot)
const ENEMY_TYPES = [
  { name: 'Ghoul', sprite: 'ghoul', hp: 2, dmgMin: 1, dmgMax: 3, payout: 1.3, weight: 40 },
  { name: 'Skull', sprite: 'skull', hp: 3, dmgMin: 1, dmgMax: 2, payout: 2.0, weight: 30 },
  { name: 'Mage',  sprite: 'mage',  hp: 4, dmgMin: 1, dmgMax: 2, payout: 2.9, weight: 20 },
  { name: 'King',  sprite: 'king',  hp: 6, dmgMin: 1, dmgMax: 1, payout: 6.0, weight: 10 },
];
const TOTAL_WEIGHT = ENEMY_TYPES.reduce((s, t) => s + t.weight, 0);
