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
    hitFlash:      null,
    pendingSpawns: 0,
    ballSquash:        0,
    knightReturnTimer: 0,
    // New fields
    trail:         [],      // ball trail positions
    shake:         0,       // screen shake frames remaining
    winStreak:     0,       // consecutive shots with a kill
    killsThisShot: 0,       // kills in current shot
    round:         0,       // rounds completed (advances)
    advancing:     false,   // true while advance animation plays
    advanceOffset: 0,       // current y offset during advance animation (0→CELL_H)
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

function initArena() {
  state.enemies = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < COLS; c++)
      spawnEnemy();
  state.ball = null;
  state.ballActive = false;
}

// ── GEOMETRY ─────────────────────────────────────────────
function enemyXY(col, row) {
  return {
    x: GRID_LEFT + col * CELL_W,
    y: ENEMY_START_Y + row * CELL_H + (state.advanceOffset || 0),
  };
}

function enemyRect(e) {
  const { x, y } = enemyXY(e.col, e.row);
  return {
    x: x + ENEMY_HIT_PAD_X,
    y: y + ENEMY_HIT_PAD_Y,
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
  if (state.ballActive || state.advancing) return;
  const bet = state.bet;
  if (state.balance < bet) { setBanner('Not enough NGN!'); return; }
  state.balance -= bet;
  state.ngnSpent += bet;
  state.shotsFired++;
  state.killsThisShot = 0;
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
  knightPlay('attack', false);
  setBanner('…');
}

function stepBall() {
  if (!state.ballActive || !state.ball) return;
  const b = state.ball;
  b.x += b.vx; b.y += b.vy;

  // Store trail (last 6 positions)
  state.trail.push({ x: b.x, y: b.y });
  if (state.trail.length > 6) state.trail.shift();

  // Wall bounces — trigger squash on impact
  if (b.x - BALL_R < FL) { b.x = FL + BALL_R; b.vx = Math.abs(b.vx);  state.ballSquash = 5; }
  if (b.x + BALL_R > FR) { b.x = FR - BALL_R; b.vx = -Math.abs(b.vx); state.ballSquash = 5; }
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
    const e = hitEnemy;
    const r = enemyRect(e);
    const t = ENEMY_TYPES[e.typeIdx];
    const dmg = t.dmgMin + Math.floor(Math.random() * (t.dmgMax - t.dmgMin + 1));
    e.hp = Math.max(0, e.hp - dmg);
    if (e.hp <= 0) {
      const payout = Math.round(state.bet * t.payout);
      state.balance += payout;
      state.ngnEarned += payout;
      state.kills++;
      state.killsThisShot++;
      state.shake = 10;
      updateWallet();
      const streak = state.winStreak + 1;
      setBanner(streak > 1 ? `win:${payout} 🔥×${streak}` : `win:${payout}`);
      addPopup(r.x + r.w / 2, r.y, `+${payout}`);
      e.dying = true;
      enemyPlay(e, 'dead');
      const deadRef = e;
      setTimeout(() => { state.enemies = state.enemies.filter(x => x !== deadRef); }, 450);
      state.pendingSpawns++;
    } else {
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
    state.advancing = true;
    state.advanceOffset = 0;
    state.enemies.forEach(e => { if (!e.dying) enemyPlay(e, 'move'); });
  }
}

// ── ADVANCE ANIMATION ────────────────────────────────────
function tickAdvance() {
  if (!state.advancing) return;
  state.advanceOffset += 3; // ~12 frames to complete at 35px
  if (state.advanceOffset >= CELL_H) {
    state.advanceOffset = 0;
    state.advancing = false;
    finishAdvance();
  }
}

function finishAdvance() {
  state.enemies.forEach(e => e.row++);
  state.round++;
  for (let i = 0; i < state.pendingSpawns; i++) spawnEnemy();
  state.pendingSpawns = 0;
  if (state.enemies.some(e => !e.dying && enemyXY(e.col, e.row).y + ENEMY_H > DIVIDER_Y)) {
    triggerBreach();
  } else {
    knightPlay('idle', true);
    const spd = ballSpeed().toFixed(1);
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
  slider.style.background = `linear-gradient(to right,#f33 0%,#f33 ${pct}%,rgba(255,255,255,.2) ${pct}%,rgba(255,255,255,.2) 100%)`;
}
function updateBetDisplay() {
  const slider = document.getElementById('bet-slider');
  slider.value = betToSlider(state.bet);
  syncSliderFill(slider);
  document.getElementById('bet-value').textContent = formatBet(state.bet);
}
function showBetUI() {
  document.getElementById('bet-slider-wrap').style.display = 'block';
  document.getElementById('action-btn').style.display = 'block';
  document.getElementById('action-btn').textContent = 'BET';
  document.getElementById('bet-display').style.marginBottom = '8px';
}
function hideArenaUI() {
  document.getElementById('bet-slider-wrap').style.display = 'none';
}
function showArenaUI() {
  hideArenaUI();
  document.getElementById('action-btn').style.display = 'none';
  document.getElementById('bet-display').style.marginBottom = '14px';
}

// ── SCREEN TRANSITIONS ────────────────────────────────────
let _sessionBest = 0;

function triggerBreach() {
  _sessionBest = Math.max(_sessionBest, state.ngnEarned);
  state.screen = 'breach';
  document.getElementById('breach').style.display = 'flex';
  document.getElementById('stat-shots').textContent = state.shotsFired;
  document.getElementById('stat-kills').textContent = state.kills;
  document.getElementById('stat-spent').textContent = state.ngnSpent.toLocaleString();
  document.getElementById('stat-earned').textContent = state.ngnEarned.toLocaleString();
  const bestEl = document.getElementById('stat-best');
  bestEl.textContent = _sessionBest.toLocaleString();
  bestEl.style.color = state.ngnEarned >= _sessionBest ? '#ffd700' : '#fff';
  hideArenaUI();
}
function goToBet() {
  resetState();
  showBetUI();
  updateWallet();
  updateBetDisplay();
  setBanner('Ready');
  document.getElementById('breach').style.display = 'none';
}
function goToArena() {
  state.screen = 'arena';
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
  if (state.screen !== 'arena' || state.ballActive || state.advancing) return;
  e.preventDefault();
  const p = getCanvasPos(e);
  state.isAiming = true;
  state.aimX = p.x;
  state.aimY = Math.min(p.y, PLAYER_Y - PLAYER_H - 10);
  knightPlay('aim', true);
}, { passive: false });

canvas.addEventListener('pointermove', e => {
  if (!state.isAiming || state.screen !== 'arena' || state.ballActive) return;
  const p = getCanvasPos(e);
  state.aimX = p.x;
  state.aimY = Math.min(p.y, PLAYER_Y - PLAYER_H - 10);
});

canvas.addEventListener('pointerup', e => {
  if (state.screen !== 'arena' || state.ballActive || state.advancing || !state.isAiming) return;
  state.isAiming = false;
  shoot();
});

canvas.addEventListener('pointercancel', () => { state.isAiming = false; });

document.getElementById('action-btn').addEventListener('click', () => {
  if (state.screen === 'bet') {
    if (state.bet > state.balance) { setBanner('Bet exceeds balance!'); return; }
    goToArena();
  }
});
document.getElementById('btn-back').addEventListener('click', () => {
  if (state.screen === 'arena') goToBet();
});
document.getElementById('btn-siege').addEventListener('click', siegeAgain);

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
    render();
  } catch (err) {
    console.error('Game loop error:', err);
  }
}

// ── BOOT ──────────────────────────────────────────────────
loadAssets(() => {
  loadKnight(() => {});
  loadEnemySpines(() => {}); // non-blocking; enemies fall back to static sprites until ready
  resetState();
  showBetUI();
  updateWallet();
  updateBetDisplay();
  loop(0);
});
