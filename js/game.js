// ── STATE ─────────────────────────────────────────────────
let state = {};

function resetState() {
  state = {
    screen:        'bet',
    balance:       10000,
    bet:           50,
    enemies:       [],
    ball:          null,
    ballActive:    false,
    aimX:          PLAYER_X,
    aimY:          FT + 40,
    isAiming:      false,
    shotsFired:    0,
    kills:         0,
    ngnSpent:      0,
    ngnEarned:     0,
    popups:        [],
    effects:       [],
    trailPuffs:    [],
    hitFlash:      null,
    pendingSpawns: 0,
    ballSquash:        0,
    knightReturnTimer: 0,
    trail:         [],
    shake:         0,
    winStreak:     0,
    killsThisShot: 0,
    hitCombo:      0,
    comboFlash:    0,
    round:         0,
    advancing:     false,
    advanceOffset: 0,
    confirming:    false,
    breaching:     false,
    coins:         [],
    _walletTarget: null,
    cancelMode:       false,
    arenaEnteredAt:   null,
    receivedThisShot: false,
    wallHits:         [],
  };
}

// ── ENEMY MANAGEMENT ─────────────────────────────────────
function spawnEnemy() {
  const empty = [];
  for (let r = 0; r <= MAX_SPAWN_ROW; r++)
    for (let c = 0; c < COLS; c++)
      if (!state.enemies.find(e => e.col === c && e.row === r))
        empty.push({ col: c, row: r });
  if (!empty.length) return;
  const slot = empty[Math.floor(Math.random() * empty.length)];
  let acc = 0, typeIdx = 0;
  const roll = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < ENEMY_TYPES.length; i++) {
    acc += ENEMY_TYPES[i].weight;
    if (roll < acc) { typeIdx = i; break; }
  }
  const t = ENEMY_TYPES[typeIdx];
  const enemy = { typeIdx, hp: t.hp, maxHp: t.hp, col: slot.col, row: slot.row };
  enemy.spine = createEnemySpine(t.sprite);
  state.enemies.push(enemy);
}

// ── COIN ANIMATION ───────────────────────────────────────
function spawnCoins(cx, cy, value) {
  const count = value >= 500 ? 3 : value >= 100 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    state.coins.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy,
      vx: (Math.random() - 0.5) * 4,
      vy: -2 - Math.random() * 3,
      floorY: cy + 14,
      phase: 'scatter',
      delay: 18 + i * 10,
      age: 0,
      startX: 0, startY: 0, flyAge: 0,
    });
  }
}

function flashWallet() {
  const el = document.getElementById('wallet');
  el.classList.remove('wallet-flash');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('wallet-flash');
}

function updateCoins() {
  if (!state.coins.length) return;
  if (!state._walletTarget) {
    const wrap   = document.getElementById('wrap');
    const wallet = document.getElementById('wallet');
    const wr     = wallet.getBoundingClientRect();
    const wrapR  = wrap.getBoundingClientRect();
    state._walletTarget = {
      x: wr.left - wrapR.left + wr.width  / 2,
      y: wr.top  - wrapR.top  + wr.height / 2,
    };
  }
  const { x: tx, y: ty } = state._walletTarget;
  state.coins = state.coins.filter(coin => {
    coin.age++;
    if (coin.phase === 'scatter') {
      coin.vy += 0.4;
      coin.x  += coin.vx;
      coin.y  += coin.vy;
      if (coin.y >= coin.floorY) { coin.y = coin.floorY; coin.vy = 0; coin.vx *= 0.5; }
      if (coin.age >= coin.delay) {
        coin.startX = coin.x; coin.startY = coin.y;
        coin.flyAge = 0;      coin.phase = 'fly';
      }
    } else if (coin.phase === 'fly') {
      const FLY = 30;
      const t    = Math.min(++coin.flyAge / FLY, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      coin.x = coin.startX + (tx - coin.startX) * ease;
      coin.y = coin.startY + (ty - coin.startY) * ease - Math.sin(t * Math.PI) * 50;
      if (t >= 1) { flashWallet(); return false; }
    }
    return true;
  });
}

function initArena() {
  state.enemies = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < COLS; c++)
      spawnEnemy();
  state.ball = null;
  state.ballActive = false;
}

// ── GEOMETRY ─────────────────────────────────────────────
function enemyXY(col, row, diagDir = 0) {
  const frac = state.advancing ? state.advanceOffset / CELL_H : 0;
  return {
    x: GRID_LEFT + col * CELL_W + diagDir * CELL_W * frac,
    y: ENEMY_START_Y + row * CELL_H + (state.advanceOffset || 0),
  };
}

function enemyRect(e) {
  const { x, y } = enemyXY(e.col, e.row);
  return {
    x: x + (CELL_W - ENEMY_W) / 2 + ENEMY_HIT_PAD_X,
    y: y + (CELL_H - ENEMY_H) / 2 + ENEMY_HIT_PAD_Y,
    w: ENEMY_W - ENEMY_HIT_PAD_X * 2,
    h: ENEMY_H - ENEMY_HIT_PAD_Y * 2,
  };
}

// Ball speed increases 0.5px/s per round, capped at 15
function ballSpeed() {
  return Math.min(BALL_SPEED + state.round * 0.5, 15);
}

function calcTrajectory(sx, sy, tx, ty) {
  const dx = tx - sx, dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const spd = ballSpeed();
  let vx = (dx / len) * spd;
  let vy = (dy / len) * spd;
  let x = sx, y = sy;
  const pts = [{ x, y }];
  for (let i = 0; i < AIM_STEPS; i++) {
    x += vx; y += vy;
    if (x - BALL_R < FL) { x = FL + BALL_R; vx = Math.abs(vx); }
    if (x + BALL_R > FR) { x = FR - BALL_R; vx = -Math.abs(vx); }
    if (y - BALL_R < FT) { y = FT + BALL_R; vy = Math.abs(vy); }
    // Enemy collision in trajectory
    for (const e of state.enemies) {
      if (e.dying) continue;
      const r = enemyRect(e);
      if (x + BALL_R <= r.x || x - BALL_R >= r.x + r.w ||
          y + BALL_R <= r.y || y - BALL_R >= r.y + r.h) continue;
      const oL = (x + BALL_R) - r.x, oR = (r.x + r.w) - (x - BALL_R);
      const oT = (y + BALL_R) - r.y, oB = (r.y + r.h) - (y - BALL_R);
      const min = Math.min(oL, oR, oT, oB);
      if      (min === oL) { vx = -Math.abs(vx); x = r.x - BALL_R; }
      else if (min === oR) { vx =  Math.abs(vx); x = r.x + r.w + BALL_R; }
      else if (min === oT) { vy = -Math.abs(vy); y = r.y - BALL_R; }
      else                 { vy =  Math.abs(vy); y = r.y + r.h + BALL_R; }
      break;
    }
    pts.push({ x, y });
    if (y > PLAYER_Y) break;
  }
  return pts;
}

// ── PHYSICS ──────────────────────────────────────────────
function shoot() {
  if (state.ballActive || state.advancing || state.breaching) return;
  const bet = state.bet;
  if (state.balance < bet) { setBanner('Not enough NGN!'); return; }
  state.balance -= bet;
  state.ngnSpent += bet;
  state.shotsFired++;
  state.killsThisShot = 0;
  state.hitCombo = 0;
  state.comboFlash = 0;
  state.receivedThisShot = false;
  state.trail = [];  // trail positions for fading dot effect
  updateWallet();
  const sx = knight ? knight.x : PLAYER_X;
  const sy = PLAYER_Y;
  const dx = state.aimX - sx, dy = state.aimY - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const spd = ballSpeed();
  state.ball = { x: sx, y: sy, vx: (dx / len) * spd, vy: (dy / len) * spd };
  state.ballActive = true;
  state.isAiming = false;
  SFX.shoot();
  if (knight) {
    knight.animState.setAnimation(0, 'attack', false);
    knight.animState.addAnimation(0, 'attacking_idle', true, 0);
  }
  setBanner('…');
}

function stepBall() {
  if (!state.ballActive || !state.ball) return;
  const b = state.ball;
  b.x += b.vx; b.y += b.vy;

  // Store trail (last 6 positions)
  state.trail.push({ x: b.x, y: b.y });
  if (state.trail.length > 6) state.trail.shift();

  // Wall bounces
  if (b.x - BALL_R < FL) { b.x = FL + BALL_R; b.vx = Math.abs(b.vx);  state.ballSquash = 5; state.wallHits.push({ x: FL, y: b.y, t0: performance.now(), side: 'L' }); }
  if (b.x + BALL_R > FR) { b.x = FR - BALL_R; b.vx = -Math.abs(b.vx); state.ballSquash = 5; state.wallHits.push({ x: FR, y: b.y, t0: performance.now(), side: 'R' }); }
  if (b.y - BALL_R < FT) { b.y = FT + BALL_R; b.vy = Math.abs(b.vy);  state.ballSquash = 5; }
  if (state.ballSquash > 0) state.ballSquash--;

  // Enemy collision
  let hitEnemy = null;
  for (const e of state.enemies) {
    if (e.dying) continue;
    const r = enemyRect(e);
    if (b.x + BALL_R <= r.x || b.x - BALL_R >= r.x + r.w ||
        b.y + BALL_R <= r.y || b.y - BALL_R >= r.y + r.h) continue;
    const oL = (b.x + BALL_R) - r.x;
    const oR = (r.x + r.w) - (b.x - BALL_R);
    const oT = (b.y + BALL_R) - r.y;
    const oB = (r.y + r.h) - (b.y - BALL_R);
    const min = Math.min(oL, oR, oT, oB);
    if      (min === oL) { b.vx = -Math.abs(b.vx); b.x = r.x - BALL_R; }
    else if (min === oR) { b.vx =  Math.abs(b.vx); b.x = r.x + r.w + BALL_R; }
    else if (min === oT) { b.vy = -Math.abs(b.vy); b.y = r.y - BALL_R; }
    else                 { b.vy =  Math.abs(b.vy); b.y = r.y + r.h + BALL_R; }
    state.hitFlash = { x: b.x, y: b.y, age: 0 };
    hitEnemy = e;
    break;
  }

  if (hitEnemy) {
    state.hitCombo++;
    state.comboFlash = 15;
    const e = hitEnemy;
    const r = enemyRect(e);
    const cx = state.hitFlash.x, cy = state.hitFlash.y;
    const t = ENEMY_TYPES[e.typeIdx];
    const dmg = t.dmgMin + Math.floor(Math.random() * (t.dmgMax - t.dmgMin + 1));
    e.hp = Math.max(0, e.hp - dmg);
    if (e.hp <= 0) {
      const payout = Math.round(state.bet * t.payout);
      state.balance += payout;
      state.ngnEarned += payout;
      state.kills++;
      state.killsThisShot++;
      state.shake = 12;
      updateWallet();
      const streak = state.winStreak + 1;
      setBanner(streak > 1 ? `win:${payout} 🔥×${streak}` : `win:${payout}`);
      addPopup(r.x + r.w / 2, r.y, `+${payout}`);
      spawnCoins(r.x + r.w / 2, r.y + r.h / 2, payout);
      e.dying = true;
      e.hitFlash = 5;
      SFX.kill();
      spawnEffect('hit',   cx, cy);
      spawnEffect('smoke', r.x + r.w / 2, r.y + r.h / 2);
      enemyPlay(e, 'dead');
      const deadRef = e;
      setTimeout(() => { state.enemies = state.enemies.filter(x => x !== deadRef); }, 450);
      state.pendingSpawns++;
    } else {
      e.hitFlash = 5;
      SFX.hit();
      spawnEffect('hit', cx, cy);
      enemyPlay(e, 'damage');
      setBanner(`-${dmg} hp! (${e.hp} left)`);
    }
  }

  // Move knight ~1/15s (4 frames) before ball returns to PLAYER_Y
  if (knight && !state.receivedThisShot && b.y > PLAYER_Y - 40 && b.vy > 0) {
    state.receivedThisShot = true;
    knight.targetX = Math.max(FL + 20, Math.min(FR - 20, b.x));
    knightPlay('receive', false);
  }

  // Ball returns to knight level → advance
  if (b.y > PLAYER_Y && b.vy > 0) {
    if (knight) { knightPlay('start', false); }
    state.knightReturnTimer = 10; // stay ~1/6s then slide back
    if (state.killsThisShot > 0) state.winStreak++;
    else state.winStreak = 0;
    state.ballActive = false;
    state.ball = null;
    state.trail = [];
    planAdvanceMoves();
    SFX.advance();
    state.advancing = true;
    state.advanceOffset = 0;
    state.enemies.forEach(e => { if (!e.dying) enemyPlay(e, 'move'); });
  }
}

// ── ADVANCE ANIMATION ────────────────────────────────────
const TRAIL_SPAWN_AT = [1, Math.round(CELL_H / 2), CELL_H - 2];

function spawnTrailPuffs() {
  state.enemies.forEach(e => {
    if (e.dying) return;
    const { x, y } = enemyXY(e.col, e.row);
    state.trailPuffs.push({
      x: x + CELL_W / 2 + (Math.random() - 0.5) * 8,
      y: y + CELL_H,
      age: 0,
    });
  });
}

function tickAdvance() {
  if (!state.advancing) return;
  state.advanceOffset += 1;
  if (TRAIL_SPAWN_AT.includes(state.advanceOffset)) spawnTrailPuffs();
  if (state.advanceOffset >= CELL_H) {
    state.advanceOffset = 0;
    state.advancing = false;
    finishAdvance();
  }
}

function planAdvanceMoves() {
  const alive = state.enemies.filter(e => !e.dying);
  for (let i = alive.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alive[i], alive[j]] = [alive[j], alive[i]];
  }
  const claimed = new Set();
  alive.forEach(e => {
    const newRow = e.row + 1;
    const wantDir = Math.random() < ENEMY_DIAG_CHANCE
      ? (Math.random() < 0.5 ? -1 : 1) : 0;
    // Try: preferred direction → straight → other diagonal
    const candidates = wantDir !== 0 ? [wantDir, 0, -wantDir] : [0, -1, 1];
    for (const dir of candidates) {
      const dc = e.col + dir;
      if (dc < 0 || dc >= COLS) continue;
      const key = `${dc},${newRow}`;
      if (!claimed.has(key)) {
        claimed.add(key);
        e._diagDir = dir;
        return;
      }
    }
    e._diagDir = 0; // all three blocked — accept overlap (needs 3 enemies converging on 1 cell)
  });
}

function finishAdvance() {
  // Apply pre-planned moves (direction was decided in planAdvanceMoves before animation)
  state.enemies.forEach(e => {
    if (!e.dying && e._diagDir) e.col = Math.max(0, Math.min(COLS - 1, e.col + e._diagDir));
    e._diagDir = 0;
    e.row++;
  });

  state.round++;
  for (let i = 0; i < state.pendingSpawns; i++) spawnEnemy();
  state.pendingSpawns = 0;

  const breached = state.enemies.filter(e => !e.dying && enemyXY(e.col, e.row).y + ENEMY_H > DIVIDER_Y);
  if (breached.length > 0) {
    state.breaching = true;
    state.isAiming = false;
    breached.forEach(e => {
      const { x, y } = enemyXY(e.col, e.row);
      spawnEffect('hit',   x + CELL_W / 2, y + CELL_H / 2);
      spawnEffect('smoke', x + CELL_W / 2, y + CELL_H / 2);
      e.dying = true;
      enemyPlay(e, 'dead');
      const ref = e;
      setTimeout(() => { state.enemies = state.enemies.filter(x => x !== ref); }, 450);
    });
    setTimeout(triggerBreach, 700);
  } else {
    knightPlay('idle', true);
    setBanner(`Round ${state.round} — speed ×${(ballSpeed()/BALL_SPEED).toFixed(1)}`);
    setTimeout(() => { if (state.screen === 'arena') setBanner('Aim & Shoot!'); }, 1200);
  }
}

function addPopup(x, y, text) {
  state.popups.push({ x, y, text, age: 0, maxAge: 40 });
}

// ── UI HELPERS ───────────────────────────────────────────
function enemyPlay(e, anim) {
  if (!e.spine) return;
  e.spine.animState.setAnimation(0, anim, false);
  if (anim !== 'dead') e.spine.animState.addAnimation(0, 'idle', true, 0);
}

function setBanner(txt)  { document.getElementById('banner').textContent = txt; }
function updateWallet()  {
  document.getElementById('wallet-amount').textContent =
    state.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function sliderToBet(pos) {
  const logMin = Math.log10(BET_MIN), logMax = Math.log10(BET_MAX);
  const raw = Math.pow(10, logMin + (pos / 100) * (logMax - logMin));
  return BET_SNAPS.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a);
}
function betToSlider(val) {
  const logMin = Math.log10(BET_MIN), logMax = Math.log10(BET_MAX);
  return (Math.log10(val) - logMin) / (logMax - logMin) * 100;
}
function formatBet(v) {
  if (v >= 1000000) return (v / 1000000 % 1 === 0 ? v / 1000000 : +(v / 1000000).toFixed(1)) + 'M';
  if (v >= 1000)    return (v / 1000 % 1 === 0 ? v / 1000 : +(v / 1000).toFixed(1)) + 'K';
  return v.toString();
}
function syncSliderFill(slider) {
  const pct = ((+slider.value - +slider.min) / (+slider.max - +slider.min) * 100).toFixed(1);
  slider.style.background = `linear-gradient(to right,#ffa063 0%,#ffa063 ${pct}%,#877061 ${pct}%,#877061 100%)`;
}
function updateBetDisplay() {
  const slider = document.getElementById('bet-slider');
  slider.value = betToSlider(state.bet);
  syncSliderFill(slider);
  document.getElementById('bet-value').textContent = formatBet(state.bet);
}
function showBetUI() {
  const bot = document.getElementById('bottom');
  bot.style.display     = 'flex';
  bot.style.paddingTop  = '80px';
  bot.style.background  = 'linear-gradient(to top,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 100%)';
  document.getElementById('bet-slider-wrap').style.display = 'block';
  document.getElementById('bet-display').style.display = 'flex';
  document.getElementById('bet-display').style.marginBottom = '28px';
  document.getElementById('one-tap-row').style.display = 'none';
  const btn = document.getElementById('action-btn');
  btn.style.display = 'block';
  btn.textContent = 'START';
  btn.classList.remove('kick');
}
function isOneTapOn() {
  return localStorage.getItem('bounceFcOneTap') === '1';
}
function hideArenaUI() {
  document.getElementById('bet-slider-wrap').style.display = 'none';
  document.getElementById('one-tap-row').style.display = 'none';
  document.getElementById('one-tap-corner').style.display = 'none';
}
function showArenaUI() {
  hideArenaUI();
  const bot = document.getElementById('bottom');
  bot.style.paddingTop = '';
  bot.style.background = '';
  document.getElementById('bet-display').style.display = 'none';
  document.getElementById('action-btn').style.display = 'none';
}
function showBetConfirm() {
  const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('bet-confirm-amount').textContent = fmt(state.bet);
  document.getElementById('bottom').style.display = 'none';
  const el = document.getElementById('bet-confirm');
  el.style.display = 'flex';
  el.offsetHeight; // force reflow for transition
  el.classList.add('visible');
  state.confirming = true;
}
function hideBetConfirm() {
  if (state.screen !== 'arena') {
    document.getElementById('bottom').style.display = 'flex';
  }
  const el = document.getElementById('bet-confirm');
  el.classList.remove('visible');
  state.confirming = false;
  setTimeout(() => { el.style.display = 'none'; }, 230);
}

// ── SCREEN TRANSITIONS ────────────────────────────────────
let _sessionBest = 0;

function triggerBreach() {
  _sessionBest = Math.max(_sessionBest, state.ngnEarned);
  state.screen = 'breach';
  document.getElementById('breach').style.display = 'flex';
  const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('breach-amount').textContent = fmt(state.ngnEarned);
  const bestEl = document.getElementById('breach-best');
  bestEl.textContent = 'BEST: ' + fmt(_sessionBest);
  bestEl.style.color = state.ngnEarned >= _sessionBest ? '#ffd700' : '#fff';
  document.getElementById('breach-stats').innerHTML =
    `Shots: ${state.shotsFired} &nbsp;·&nbsp; Kills: ${state.kills}`;
  hideArenaUI();
}
function goToBet() {
  resetState();
  showBetUI();
  updateWallet();
  updateBetDisplay();
  setBanner('Ready');
  document.getElementById('breach').style.display = 'none';
  document.getElementById('bet-confirm').classList.remove('visible');
  document.getElementById('bet-confirm').style.display = 'none';
}
function goToArena() {
  state.screen = 'arena';
  state.arenaEnteredAt = performance.now();
  initArena();
  showArenaUI();
  setBanner('Aim & Shoot!');
  if (knight) {
    knight.x = PLAYER_X;
    knight.targetX = PLAYER_X;
    knight.skeleton.x = PLAYER_X;
    knightPlay('enter', false);
    knight.animState.addAnimation(0, 'idle', true, 0);
  }
}
function siegeAgain() {
  const bal = state.balance;
  resetState();
  state.balance = bal;
  document.getElementById('breach').style.display = 'none';
  goToArena();
  updateWallet();
}

// ── INPUT ─────────────────────────────────────────────────
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CW / rect.width),
    y: (e.clientY - rect.top)  * (CH / rect.height),
  };
}

canvas.addEventListener('pointerdown', e => {
  if (state.screen !== 'arena' || state.ballActive || state.advancing || state.breaching) return;
  e.preventDefault();
  const p = getCanvasPos(e);
  state.isAiming = true;
  state.aimX = p.x;
  state.aimY = Math.min(p.y, PLAYER_Y - PLAYER_H - 10);
  knightPlay('aim', true);
}, { passive: false });

canvas.addEventListener('pointermove', e => {
  if (!state.isAiming || state.screen !== 'arena' || state.ballActive || state.breaching) return;
  const p = getCanvasPos(e);
  state.cancelMode = p.y > DIVIDER_Y;
  state.aimX = p.x;
  state.aimY = Math.min(p.y, PLAYER_Y - PLAYER_H - 10);
});

canvas.addEventListener('pointerup', () => {
  if (state.screen !== 'arena' || state.ballActive || state.advancing || state.breaching || !state.isAiming) return;
  if (state.cancelMode) {
    state.isAiming  = false;
    state.cancelMode = false;
    knightPlay('idle', true);
    setBanner('Aim & Shoot!');
    return;
  }
  state.isAiming = false;
  if (isOneTapOn()) {
    shoot();
  } else {
    showBetConfirm();
  }
});

canvas.addEventListener('pointercancel', () => {
  state.isAiming   = false;
  state.cancelMode = false;
});

document.getElementById('action-btn').addEventListener('click', function() {
  if (state.screen !== 'bet') return;
  if (state.bet > state.balance) { setBanner('Bet exceeds balance!'); return; }
  goToArena();
});

document.getElementById('btn-confirm-cancel').addEventListener('click', hideBetConfirm);
document.getElementById('btn-confirm-ok').addEventListener('click', () => {
  const el = document.getElementById('bet-confirm');
  el.classList.remove('visible');
  el.style.display = 'none';
  state.confirming = false;
  if (state.screen === 'arena') {
    document.getElementById('bottom').style.display = 'none';
    shoot();
  } else {
    goToArena();
  }
});

document.getElementById('one-tap-cb').addEventListener('change', function () {
  localStorage.setItem('bounceFcOneTap', this.checked ? '1' : '0');
  if (state.screen === 'arena') showArenaUI();
});
document.getElementById('one-tap-corner-cb').addEventListener('change', function () {
  localStorage.setItem('bounceFcOneTap', this.checked ? '1' : '0');
  if (state.screen === 'arena') showArenaUI();
});
document.getElementById('btn-back').addEventListener('click', () => {
  if (state.screen === 'arena') goToBet();
});

// ── MENU PANEL ────────────────────────────────────────────
function openMenu() {
  const bgmCb  = document.getElementById('menu-bgm-cb');
  const sfxCb  = document.getElementById('menu-sfx-cb');
  bgmCb.checked = !BGM.isMuted;
  sfxCb.checked = !SFX.isSfxMuted;
  const panel = document.getElementById('menu-panel');
  panel.style.display = 'block';
  panel.offsetHeight; // reflow
  panel.classList.add('open');
}
function closeMenu() {
  const panel = document.getElementById('menu-panel');
  panel.classList.remove('open');
  setTimeout(() => { panel.style.display = 'none'; }, 260);
}

document.getElementById('btn-menu').addEventListener('click', openMenu);
document.getElementById('menu-backdrop').addEventListener('click', closeMenu);
document.getElementById('menu-close').addEventListener('click', closeMenu);

document.getElementById('menu-bgm-cb').addEventListener('change', function() {
  BGM.toggleMute();
});
document.getElementById('menu-sfx-cb').addEventListener('change', function() {
  SFX.toggleSfxMute();
});
document.getElementById('btn-siege').addEventListener('click', siegeAgain);
document.getElementById('btn-change-bet').addEventListener('click', goToBet);

document.getElementById('bet-slider').addEventListener('input', function() {
  state.bet = sliderToBet(+this.value);
  syncSliderFill(this);
  document.getElementById('bet-value').textContent = formatBet(state.bet);
});

// ── MAIN LOOP ─────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (ts - lastTime < 16) return;
  lastTime = ts;
  try {
    if (state.screen === 'arena') {
      if (state.advancing) tickAdvance();
      else stepBall();
      if (state.knightReturnTimer > 0) {
        state.knightReturnTimer--;
        if (state.knightReturnTimer === 0 && knight) {
          knight.targetX = PLAYER_X;
        }
      }
    }
    updateCoins();
    render();
  } catch (err) {
    console.error('Game loop error:', err);
  }
}

// ── BOOT ──────────────────────────────────────────────────
const loadingFill = document.getElementById('loading-bar-fill');
const loadingEl   = document.getElementById('loading');

let fakeProgress = 0;
let realLoadDone = false;

// Fast 0→90%, then 3× faster for last 10% (waits for real load to allow 100)
const barTimer = setInterval(() => {
  const step = fakeProgress < 90 ? 1.5 : 0.21;
  const cap  = realLoadDone ? 100 : 99.5;
  fakeProgress = Math.min(fakeProgress + step, cap);
  loadingFill.style.width = fakeProgress + '%';
  if (fakeProgress >= 100) {
    clearInterval(barTimer);
    setTimeout(() => {
      loadingEl.classList.add('done');
      setTimeout(() => {
        loadingEl.style.display = 'none';
        document.getElementById('one-tap-prompt').classList.add('visible');
      }, 520);
    }, 200);
  }
}, 16);

// Start BGM on first user gesture anywhere in the game
const onLoadingTap = () => { BGM.play(); document.removeEventListener('pointerdown', onLoadingTap); };
document.addEventListener('pointerdown', onLoadingTap);

loadAssets(() => {
  try {
    loadKnight(() => {});
    loadEnemySpines(() => {});
    loadFlag(() => {});
    loadFire(() => {});
    loadFX(() => {});
    resetState();
    showBetUI();
    updateWallet();
    updateBetDisplay();
    const oneTapOn = isOneTapOn();
    document.getElementById('one-tap-cb').checked = oneTapOn;
    document.getElementById('one-tap-corner-cb').checked = oneTapOn;
    document.getElementById('menu-onetap-cb').checked = oneTapOn;

    document.getElementById('menu-onetap-cb').addEventListener('change', function () {
      localStorage.setItem('bounceFcOneTap', this.checked ? '1' : '0');
    });
    document.getElementById('otp-yes').addEventListener('click', () => {
      localStorage.setItem('bounceFcOneTap', '1');
      localStorage.setItem('bounceFcOneTapPromptShown', '1');
      document.getElementById('menu-onetap-cb').checked = true;
      document.getElementById('one-tap-prompt').classList.remove('visible');
    });
    document.getElementById('otp-no').addEventListener('click', () => {
      localStorage.setItem('bounceFcOneTap', '0');
      localStorage.setItem('bounceFcOneTapPromptShown', '1');
      document.getElementById('menu-onetap-cb').checked = false;
      document.getElementById('one-tap-prompt').classList.remove('visible');
    });
    BGM.init();
    document.getElementById('bgm-btn').addEventListener('click', () => BGM.toggleMute());
    loop(0);
  } catch (e) {
    console.error('Boot error:', e);
  }
  realLoadDone = true;
});

// Safety: dismiss loading screen after 8s even if something fails
setTimeout(() => { realLoadDone = true; }, 8000);
