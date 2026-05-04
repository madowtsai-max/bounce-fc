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
    safeDrawImage(IMG.player, PLAYER_X - PLAYER_W / 2, PLAYER_Y - PLAYER_H + 10, PLAYER_W, PLAYER_H);
    return;
  }
  ctx.save();
  knight.renderer.draw(knight.skeleton);
  ctx.restore();
}

// ── SPINE ENEMIES ─────────────────────────────────────────
const ENEMY_SKEL_DATA = {};
let enemyRenderer = null;

function loadEnemySpines(cb) {
  const names = ['ghoul', 'skull', 'mage', 'king'];
  let done = 0;
  const finish = () => { if (++done === names.length) cb(); };
  names.forEach(name => {
    const imgEl = new Image();
    imgEl.onerror = finish;
    imgEl.onload = () => {
      Promise.all([
        fetch(`spine/enemy/${name}.atlas`).then(r => r.text()),
        fetch(`spine/enemy/${name}.json`).then(r => r.json()),
      ]).then(([atlasText, jsonData]) => {
        const atlas = new spine.TextureAtlas(atlasText, () => new spine.canvas.CanvasTexture(imgEl));
        const skelData = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(jsonData);
        ENEMY_SKEL_DATA[name] = skelData;
        finish();
      }).catch(finish);
    };
    imgEl.src = `spine/enemy/${name}.png`;
  });
}

function createEnemySpine(spriteName) {
  const skelData = ENEMY_SKEL_DATA[spriteName];
  if (!skelData) return null;
  const skeleton = new spine.Skeleton(skelData);
  skeleton.scaleX =  ENEMY_SCALE;
  skeleton.scaleY = -ENEMY_SCALE;
  const stateData = new spine.AnimationStateData(skelData);
  stateData.defaultMix = 0.12;
  const animState = new spine.AnimationState(stateData);
  animState.setAnimation(0, 'enter', false);
  animState.addAnimation(0, 'idle', true, 0);
  return { skeleton, animState, lastTime: performance.now() / 1000 };
}

// ── CANVAS ───────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const DPR = window.devicePixelRatio || 1;
canvas.width  = CW * DPR;
canvas.height = CH * DPR;
canvas.style.width  = CW + 'px';
canvas.style.height = CH + 'px';
ctx.scale(DPR, DPR);

enemyRenderer = new spine.canvas.SkeletonRenderer(ctx);
enemyRenderer.debugRendering = false;

// Aim-line canvas — z-index 11, above castle frame
const aimCanvas = document.getElementById('aim-canvas');
const aimCtx = aimCanvas.getContext('2d');
aimCanvas.width  = CW * DPR;
aimCanvas.height = CH * DPR;
aimCtx.scale(DPR, DPR);

// ── DRAW FUNCTIONS ───────────────────────────────────────
function safeDrawImage(img, ...args) {
  if (img && img.naturalWidth > 0) ctx.drawImage(img, ...args);
}

function drawBackground() {
  ctx.fillStyle = '#2e2e38';
  ctx.fillRect(0, 0, CW, CH);
  safeDrawImage(IMG.bgField, 0, 0, CW, CH);
}

function drawHPBadge(e, x, y) {
  const hpText = `${e.hp}/${e.maxHp}`;
  ctx.save();
  ctx.font = 'bold 9px Roboto';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(hpText).width;
  const pillW = tw + 8, pillH = 11;
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
}

function drawEnemies() {
  const now = performance.now() / 1000;
  state.enemies.forEach(e => {
    const { x, y } = enemyXY(e.col, e.row);
    const t = ENEMY_TYPES[e.typeIdx];
    if (e.spine && enemyRenderer) {
      const { skeleton, animState } = e.spine;
      const delta = Math.min(now - e.spine.lastTime, 0.05);
      e.spine.lastTime = now;
      animState.update(delta);
      animState.apply(skeleton);
      skeleton.x = x + ENEMY_W / 2;
      skeleton.y = y + ENEMY_SPINE_Y_OFF;
      skeleton.updateWorldTransform();
      ctx.save();
      enemyRenderer.draw(skeleton);
      ctx.restore();
    } else {
      safeDrawImage(IMG[t.sprite], x, y, ENEMY_W, ENEMY_H);
    }
    if (!e.dying) drawHPBadge(e, x, y);
  });
}

function drawPlayer() {
  drawKnight();
}

let _aimDashOffset = 0;

function drawAimLine() {
  aimCtx.clearRect(0, 0, CW, CH);
  if (!state.isAiming || state.ballActive) return;
  const kx = knight ? knight.x : PLAYER_X;
  const pts = calcTrajectory(kx, PLAYER_Y, state.aimX, state.aimY);
  if (pts.length < 2) return;

  _aimDashOffset = (_aimDashOffset + 0.5) % 16;

  // Find first bounce (wall or enemy — direction change)
  let bounceIdx = pts.length - 1;
  for (let i = 2; i < pts.length; i++) {
    const sx1 = Math.sign(pts[i-1].x - pts[i-2].x);
    const sx2 = Math.sign(pts[i].x   - pts[i-1].x);
    const sy1 = Math.sign(pts[i-1].y - pts[i-2].y);
    const sy2 = Math.sign(pts[i].y   - pts[i-1].y);
    if ((sx1 !== 0 && sx1 !== sx2) || (sy1 !== 0 && sy1 !== sy2)) {
      bounceIdx = i - 1;
      break;
    }
  }
  const bp = pts[bounceIdx];

  const ac = aimCtx;
  ac.save();

  // Dashed line: knight → first bounce
  ac.strokeStyle = 'rgba(255,255,255,0.85)';
  ac.lineWidth = 2;
  ac.setLineDash([8, 8]);
  ac.lineDashOffset = -_aimDashOffset;
  ac.beginPath();
  ac.moveTo(pts[0].x, pts[0].y);
  ac.lineTo(bp.x, bp.y);
  ac.stroke();
  ac.setLineDash([]);
  ac.lineDashOffset = 0;

  // Rotating target circle (50% bigger: radius 14)
  ac.translate(bp.x, bp.y);
  const R   = 14;
  const rot = (_aimDashOffset / 16) * Math.PI * 2;
  // Faint full ring
  ac.strokeStyle = 'rgba(255,255,255,0.35)';
  ac.lineWidth = 1.5;
  ac.beginPath();
  ac.arc(0, 0, R, 0, Math.PI * 2);
  ac.stroke();
  // 3 bright spinning arcs
  ac.strokeStyle = 'rgba(255,255,255,0.95)';
  ac.lineWidth = 2.5;
  for (let a = 0; a < 3; a++) {
    const start = rot + (a * Math.PI * 2 / 3);
    ac.beginPath();
    ac.arc(0, 0, R, start, start + Math.PI * 0.45);
    ac.stroke();
  }
  // Red center dot
  ac.fillStyle = '#ff3333';
  ac.beginPath();
  ac.arc(0, 0, 3.5, 0, Math.PI * 2);
  ac.fill();

  ac.restore();
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
