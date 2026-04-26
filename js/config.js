// ── ASSETS ───────────────────────────────────────────────
const URLS = {
  bgField:  'images/bg.png',
  player:   'images/player.png',
  ghoul:    'images/ghoul.png',
  skull:    'images/skull.png',
  mage:     'images/mage.png',
  king:     'images/king.png',
  fireball: 'images/fireball.png',
  flame:    'images/flame.png',
};

// ── LAYOUT ───────────────────────────────────────────────
// bg.png is 1080×1920 drawn at 360×640 (exactly 1/3 scale).
// Field boundaries from image proportions × (1/3):
//   side dark bars ≈11% → FL=40, FR=320
//   top dark bar   ≈8%  → FT=50
//   grass-dirt     ≈80% → DIVIDER_Y=512
const CW = 360, CH = 640;
const COLS = 7, ROWS = 9;
const CELL_W = 40;
const CELL_H = 40;
const FL = 40;
const FR = FL + COLS * CELL_W;   // 320
const FT = 50;
const FB = 620;                   // ball exit line
const ENEMY_W = 32, ENEMY_H = 32;
const ENEMY_START_Y = FT;
const DIVIDER_Y = 512;            // grass→dirt deadline
const MAX_SPAWN_ROW = 7;          // guarantees ≥3 rounds before breach
const PLAYER_X = CW / 2;         // 180
const PLAYER_Y = 570;
const PLAYER_W = 60, PLAYER_H = 68;
const BALL_R = 9;
const BALL_SPEED = 9;
const ENEMY_HIT_PAD_X = 3;
const ENEMY_HIT_PAD_Y = 3;
const AIM_STEPS = 220;

// ── GAME DATA ────────────────────────────────────────────
const BET_LEVELS = [10, 50, 100, 200, 500, 1000, 2000, 5000];

const ENEMY_TYPES = [
  { name: 'Ghoul', sprite: 'ghoul', hp: 2,  dmgMin: 1, dmgMax: 3, payout: 1.5, weight: 40 },
  { name: 'Skull', sprite: 'skull', hp: 4,  dmgMin: 1, dmgMax: 3, payout: 3,   weight: 30 },
  { name: 'Mage',  sprite: 'mage',  hp: 6,  dmgMin: 1, dmgMax: 2, payout: 6,   weight: 20 },
  { name: 'King',  sprite: 'king',  hp: 10, dmgMin: 1, dmgMax: 1, payout: 20,  weight: 10 },
];
const TOTAL_WEIGHT = ENEMY_TYPES.reduce((s, t) => s + t.weight, 0);
