// ── ASSETS ───────────────────────────────────────────────
const IMG = {};
let assetsLoaded = 0;
const ASSET_COUNT = Object.keys(URLS).length;

function loadAssets(cb) {
  Object.entries(URLS).forEach(([k, url]) => {
    const img = new Image();
    if (url.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = img.onerror = () => { if (++assetsLoaded >= ASSET_COUNT) cb(); };
    img.src = url;
    IMG[k] = img;
  });
}

// ── CANVAS ───────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ── DRAW FUNCTIONS ───────────────────────────────────────
function drawBackground() {
  ctx.fillStyle = '#2e2e38';
  ctx.fillRect(0, 0, CW, CH);
  ctx.drawImage(IMG.bgField, 0, 0, CW, CH);
}

function drawEnemies() {
  state.enemies.forEach(e => {
    const { x, y } = enemyXY(e.col, e.row);
    const t = ENEMY_TYPES[e.typeIdx];
    ctx.drawImage(IMG[t.sprite], x, y, ENEMY_W, ENEMY_H);
    // HP bar
    const bw = ENEMY_W, bh = 5, by = y + ENEMY_H + 1;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, by, bw, bh);
    const ratio = e.hp / e.maxHp;
    ctx.fillStyle = ratio > .5 ? '#4caf50' : ratio > .25 ? '#ff9800' : '#f44336';
    ctx.fillRect(x, by, bw * ratio, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px Roboto';
    ctx.textAlign = 'center';
    ctx.fillText(`${e.hp}/${e.maxHp}`, x + bw / 2, by + bh - 1);
    // Dmg badge
    const dmgLabel = t.dmgMin === t.dmgMax ? `${t.dmgMin}` : `${t.dmgMin}-${t.dmgMax}`;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(x, y, 18, 9);
    ctx.fillStyle = '#ff9944';
    ctx.font = 'bold 6px Roboto';
    ctx.textAlign = 'left';
    ctx.fillText(dmgLabel, x + 1, y + 7);
  });
}

function drawPlayer() {
  ctx.drawImage(IMG.player, PLAYER_X - PLAYER_W / 2, PLAYER_Y - PLAYER_H + 10, PLAYER_W, PLAYER_H);
}

function drawAimLine() {
  if (!state.isAiming || state.ballActive) return;
  const pts = calcTrajectory(PLAYER_X, PLAYER_Y - PLAYER_H + 10, state.aimX, state.aimY);
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.setLineDash([]);
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(last.x + Math.cos(ang) * 8, last.y + Math.sin(ang) * 8);
  ctx.lineTo(last.x + Math.cos(ang + 2.4) * 5, last.y + Math.sin(ang + 2.4) * 5);
  ctx.lineTo(last.x + Math.cos(ang - 2.4) * 5, last.y + Math.sin(ang - 2.4) * 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  if (!state.ballActive || !state.ball) return;
  const { x, y } = state.ball;
  // Guard against broken images — drawImage throws on naturalWidth=0
  if (IMG.flame && IMG.flame.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(IMG.flame, x - 10, y - 10, 20, 40);
    ctx.restore();
  }
  if (IMG.fireball && IMG.fireball.naturalWidth > 0) {
    ctx.drawImage(IMG.fireball, x - BALL_R, y - BALL_R, BALL_R * 2, BALL_R * 2);
  } else {
    // Fallback: solid orange circle
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHitFlash() {
  if (!state.hitFlash) return;
  const f = state.hitFlash;
  ctx.save();
  ctx.globalAlpha = 1 - f.age / 8;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(f.x, f.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (++f.age > 8) state.hitFlash = null;
}

function drawDivider() {
  ctx.strokeStyle = 'rgba(255,60,60,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.moveTo(FL, DIVIDER_Y);
  ctx.lineTo(FR, DIVIDER_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,60,60,0.9)';
  ctx.font = 'bold 8px Roboto';
  ctx.textAlign = 'left';
  ctx.fillText('DEAD LINE', FL + 2, DIVIDER_Y - 3);
}

function drawPopups() {
  state.popups.forEach(p => {
    const alpha = 1 - p.age / p.maxAge;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 22px Roboto';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.x, p.y - p.age * 1.2);
    ctx.fillText(p.text, p.x, p.y - p.age * 1.2);
    ctx.restore();
    p.age++;
  });
  state.popups = state.popups.filter(p => p.age < p.maxAge);
}

function render() {
  ctx.clearRect(0, 0, CW, CH);
  drawBackground();
  if (state.screen === 'arena' || state.screen === 'bet') {
    drawDivider();
    drawEnemies();
    drawPlayer();   // always draw player first — ball/effects render on top
    if (state.screen === 'arena') {
      drawAimLine();
      drawBall();
      drawHitFlash();
    }
    drawPopups();
  }
}
