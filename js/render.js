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

// ── SPINE KNIGHT ─────────────────────────────────────────
let knight = null;   // { skeleton, animState, renderer, x, targetX, lastTime }

function loadKnight(cb) {
  const base = 'spine/';
  const imgEl = new Image();
  imgEl.onerror = () => cb();  // fail gracefully — static sprite used as fallback

  imgEl.onload = () => {
    Promise.all([
      fetch(base + 'knight.atlas').then(r => r.text()),
      fetch(base + 'knight.json').then(r => r.json()),
    ]).then(([atlasText, jsonData]) => {
      // Build atlas — textureLoader is synchronous: receives page name, returns Texture
      const textureAtlas = new spine.TextureAtlas(atlasText, () =>
        new spine.canvas.CanvasTexture(imgEl)
      );
      const atlasLoader  = new spine.AtlasAttachmentLoader(textureAtlas);
      const skelJson     = new spine.SkeletonJson(atlasLoader);
      const skelData     = skelJson.readSkeletonData(jsonData);

      const skeleton = new spine.Skeleton(skelData);
      // Knight designed at 1080×1920; game canvas is 360×640 = exactly 1/3
      skeleton.scaleX =  1 / 3;
      skeleton.scaleY = -1 / 3;  // Spine Y is up; canvas Y is down
      skeleton.x = PLAYER_X;
      skeleton.y = PLAYER_Y;

      const stateData = new spine.AnimationStateData(skelData);
      stateData.defaultMix = 0.2;
      const animState = new spine.AnimationState(stateData);
      animState.setAnimation(0, 'idle', true);

      const renderer = new spine.canvas.SkeletonRenderer(ctx);
      renderer.debugRendering = false;

      knight = {
        skeleton, animState, renderer,
        x: PLAYER_X, targetX: PLAYER_X,
        lastTime: performance.now() / 1000,
      };
      cb();
    }).catch(() => cb());
  };
  imgEl.src = base + 'knight.png';
}

function knightPlay(anim, loop = false, trackMix = 0.15) {
  if (!knight) return;
  const cur = knight.animState.getCurrent(0);
  if (cur && cur.animation && cur.animation.name === anim) return;
  knight.animState.setAnimation(0, anim, loop);
}

function updateKnight(nowSec) {
  if (!knight) return;
  const delta = nowSec - knight.lastTime;
  knight.lastTime = nowSec;

  // Slide knight toward targetX
  const dx = knight.targetX - knight.x;
  if (Math.abs(dx) > 1) knight.x += dx * Math.min(1, delta * 10);
  else knight.x = knight.targetX;

  knight.skeleton.x = knight.x;
  knight.animState.update(delta);
  knight.animState.apply(knight.skeleton);
  knight.skeleton.updateWorldTransform();
}

// ── SPINE BALL ────────────────────────────────────────────
let ballSkel = null;  // { skeleton, animState, renderer, lastTime }

function loadBall(cb) {
  const base = 'spine/';
  const imgEl = new Image();
  imgEl.onerror = () => cb();

  imgEl.onload = () => {
    Promise.all([
      fetch(base + 'ball.atlas').then(r => r.text()),
      fetch(base + 'ball.json').then(r => r.json()),
    ]).then(([atlasText, jsonData]) => {
      const textureAtlas = new spine.TextureAtlas(atlasText, () =>
        new spine.canvas.CanvasTexture(imgEl)
      );
      const atlasLoader = new spine.AtlasAttachmentLoader(textureAtlas);
      const skelJson    = new spine.SkeletonJson(atlasLoader);
      const skelData    = skelJson.readSkeletonData(jsonData);

      const skeleton = new spine.Skeleton(skelData);
      skeleton.scaleX =  1 / 3;
      skeleton.scaleY = -1 / 3;

      const stateData = new spine.AnimationStateData(skelData);
      stateData.defaultMix = 0.1;
      const animState = new spine.AnimationState(stateData);
      animState.setAnimation(0, 'idle', true);

      const renderer = new spine.canvas.SkeletonRenderer(ctx);
      renderer.debugRendering = false;

      ballSkel = { skeleton, animState, renderer, lastTime: performance.now() / 1000 };
      cb();
    }).catch(() => cb());
  };
  imgEl.src = base + 'ball.png';
}

function updateBallSkel(nowSec) {
  if (!ballSkel) return;
  const delta = nowSec - ballSkel.lastTime;
  ballSkel.lastTime = nowSec;
  ballSkel.animState.update(delta);
  ballSkel.animState.apply(ballSkel.skeleton);
  // updateWorldTransform called after position/rotation set in drawSpineBall
}

function ballSpinePlay(anim, loop) {
  if (!ballSkel) return;
  const cur = ballSkel.animState.getCurrent(0);
  if (cur && cur.animation && cur.animation.name === anim) return;
  ballSkel.animState.setAnimation(0, anim, loop);
}


function drawKnight() {
  if (!knight) {
    // Fallback: static sprite
    safeDrawImage(IMG.player, PLAYER_X - PLAYER_W / 2, PLAYER_Y - PLAYER_H + 10, PLAYER_W, PLAYER_H);
    return;
  }
  ctx.save();
  knight.renderer.draw(knight.skeleton);
  ctx.restore();
}

// ── CANVAS ───────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Scale canvas for retina/HiDPI — keeps CSS size at 360×640 but renders at full pixel density
const DPR = window.devicePixelRatio || 1;
canvas.width  = CW * DPR;
canvas.height = CH * DPR;
canvas.style.width  = CW + 'px';
canvas.style.height = CH + 'px';
ctx.scale(DPR, DPR);

// ── DRAW FUNCTIONS ───────────────────────────────────────
function safeDrawImage(img, ...args) {
  if (img && img.naturalWidth > 0) ctx.drawImage(img, ...args);
}

function drawBackground() {
  ctx.fillStyle = '#2e2e38';
  ctx.fillRect(0, 0, CW, CH);
  safeDrawImage(IMG.bgField, 0, 0, CW, CH);
}

function drawEnemies() {
  state.enemies.forEach(e => {
    const { x, y } = enemyXY(e.col, e.row);
    const t = ENEMY_TYPES[e.typeIdx];
    safeDrawImage(IMG[t.sprite], x, y, ENEMY_W, ENEMY_H);
    // HP pill badge — centered, lower third of sprite
    ctx.save();
    const hpText = `${e.hp}/${e.maxHp}`;
    ctx.font = 'bold 9px Roboto';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(hpText).width;
    const pillW = tw + 8;
    const pillH = 11;
    const pillX = x + ENEMY_W / 2 - pillW / 2;
    const pillY = y + ENEMY_H - pillH - 1;
    const r = pillH / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.arc(pillX + pillW - r, pillY + r, r, -Math.PI / 2, 0);
    ctx.lineTo(pillX + pillW, pillY + pillH - r);
    ctx.arc(pillX + pillW - r, pillY + pillH - r, r, 0, Math.PI / 2);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.arc(pillX + r, pillY + pillH - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(pillX, pillY + r);
    ctx.arc(pillX + r, pillY + r, r, Math.PI, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(hpText, x + ENEMY_W / 2, pillY + pillH - 2);
    ctx.restore();
  });
}

function drawPlayer() {
  drawKnight();
}

let _aimDashOffset = 0;

function drawAimLine() {
  if (!state.isAiming || state.ballActive) return;
  const pts = calcTrajectory(PLAYER_X, PLAYER_Y - PLAYER_H + 10, state.aimX, state.aimY);
  if (pts.length < 2) return;

  _aimDashOffset = (_aimDashOffset + 0.5) % 16;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -_aimDashOffset;
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
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
  const { x, y, vx, vy } = state.ball;

  // Fading dot trail
  if (state.trail) {
    state.trail.forEach((p, i) => {
      const t = (i + 1) / state.trail.length;
      ctx.save();
      ctx.globalAlpha = t * 0.45;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * t * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Ball image: 1:1.2 stretch in travel direction, 1:1 on wall bounce
  const squashing = state.ballSquash > 0;
  const scaleY = squashing ? 1 : 1.2;
  const angle  = Math.atan2(vy, vx);
  const r = BALL_R;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, scaleY);
  if (IMG.soccer && IMG.soccer.naturalWidth > 0) {
    ctx.drawImage(IMG.soccer, -r, -r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
    // Screen shake — random offset that decays each frame
    let sx = 0, sy = 0;
    if (state.shake > 0) {
      const intensity = state.shake * 0.5;
      sx = (Math.random() - 0.5) * intensity;
      sy = (Math.random() - 0.5) * intensity;
      state.shake--;
    }
    updateKnight(performance.now() / 1000);
    ctx.save();
    ctx.translate(sx, sy);
    try {
      drawDivider();
      drawEnemies();
      if (state.screen === 'arena') {
        drawAimLine();
        drawBall();
        drawHitFlash();
      }
      drawPlayer();   // knight on top of ball
      drawPopups();
    } finally {
      ctx.restore();
    }
  }
}
