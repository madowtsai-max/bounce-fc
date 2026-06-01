// ── ASSETS ───────────────────────────────────────────────
const IMG = {};
let assetsLoaded = 0;
const ASSET_COUNT = Object.keys(URLS).length;

function loadAssets(cb, onProgress) {
  Object.entries(URLS).forEach(([k, url]) => {
    const img = new Image();
    if (url.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = img.onerror = () => {
      assetsLoaded++;
      if (onProgress) onProgress(assetsLoaded, ASSET_COUNT);
      if (assetsLoaded >= ASSET_COUNT) cb();
    };
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

function knightPlay(anim, loop = false) {
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

// ── SPINE KNIGHT START (bet screen) ──────────────────────
let knightStart = null;

function loadKnightStart(cb) {
  const base = 'spine/';
  const imgEl = new Image();
  imgEl.onerror = () => cb();
  imgEl.onload = () => {
    Promise.all([
      fetch(base + 'knight_start.atlas').then(r => r.text()),
      fetch(base + 'knight_start.json').then(r => r.json()),
    ]).then(([atlasText, jsonData]) => {
      const textureAtlas = new spine.TextureAtlas(atlasText, () => new spine.canvas.CanvasTexture(imgEl));
      const skelData = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(textureAtlas)).readSkeletonData(jsonData);
      const skeleton = new spine.Skeleton(skelData);
      skeleton.scaleX =  1 / 3;
      skeleton.scaleY = -1 / 3;
      skeleton.x = CW / 2;
      skeleton.y = Math.round((FT + DIVIDER_Y) / 2); // center of castle frame opening ≈ 320
      const stateData = new spine.AnimationStateData(skelData);
      stateData.defaultMix = 0.1;
      const animState = new spine.AnimationState(stateData);
      animState.setAnimation(0, 'idle', true);
      const renderer = new spine.canvas.SkeletonRenderer(ctx);
      renderer.debugRendering = false;
      knightStart = { skeleton, animState, renderer, lastTime: performance.now() / 1000 };
      cb();
    }).catch(() => cb());
  };
  imgEl.src = base + 'knight_start.png';
}

function knightStartPlay(anim, loop = false) {
  if (!knightStart) return;
  knightStart.animState.setAnimation(0, anim, loop);
}

function updateKnightStart(nowSec) {
  if (!knightStart) return;
  const delta = Math.min(nowSec - knightStart.lastTime, 0.05);
  knightStart.lastTime = nowSec;
  knightStart.animState.update(delta);
  knightStart.animState.apply(knightStart.skeleton);
  knightStart.skeleton.updateWorldTransform();
}

function drawKnightStart() {
  if (state.screen !== 'bet' || !knightStart) return;
  ctx.save();
  knightStart.renderer.draw(knightStart.skeleton);
  ctx.restore();
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

// ── SPINE FLAG ────────────────────────────────────────────
// Note: new export was Spine 4.2.43 — keeping old 3.8.99 files
let flagL = null;
let flagR = null;

function _makeFlagInstance(skelData, x) {
  const skeleton = new spine.Skeleton(skelData);
  skeleton.scaleX =  1 / 3;
  skeleton.scaleY = -1 / 3;
  skeleton.x = x;
  skeleton.y = 165;

  const stateData = new spine.AnimationStateData(skelData);
  const animState = new spine.AnimationState(stateData);
  animState.setAnimation(0, 'idle', true);  // loop idle only

  const renderer = new spine.canvas.SkeletonRenderer(aimCtx);
  renderer.debugRendering = false;

  return { skeleton, animState, renderer, lastTime: performance.now() / 1000 };
}

function loadFlag(cb) {
  const base = 'spine/';
  const imgEl = new Image();
  imgEl.onerror = () => cb();
  imgEl.onload = () => {
    Promise.all([
      fetch(base + 'flag.atlas').then(r => r.text()),
      fetch(base + 'flag.json').then(r => r.json()),
    ]).then(([atlasText, jsonData]) => {
      const textureAtlas = new spine.TextureAtlas(atlasText, () =>
        new spine.canvas.CanvasTexture(imgEl)
      );
      const atlasLoader = new spine.AtlasAttachmentLoader(textureAtlas);
      const skelData = new spine.SkeletonJson(atlasLoader).readSkeletonData(jsonData);
      flagL = _makeFlagInstance(skelData, 19);
      flagR = _makeFlagInstance(skelData, 341);
      cb();
    }).catch(() => cb());
  };
  imgEl.src = base + 'flag.png';
}

function updateFlag(nowSec) {
  [flagL, flagR].forEach(f => {
    if (!f) return;
    const delta = nowSec - f.lastTime;
    f.lastTime = nowSec;
    f.animState.update(delta);
    f.animState.apply(f.skeleton);
    f.skeleton.updateWorldTransform();
  });
}

function drawFlag() {
  [flagL, flagR].forEach(f => {
    if (!f) return;
    aimCtx.save();
    f.renderer.draw(f.skeleton);
    aimCtx.restore();
  });
}

// ── SPINE FIRE (torches) ──────────────────────────────────
// Single-torch skeleton — two instances for left and right corners
let fireL = null;
let fireR = null;

function _makeFireInstance(skelData, x, y) {
  const skeleton = new spine.Skeleton(skelData);
  skeleton.scaleX =  1 / 3;
  skeleton.scaleY = -1 / 3;
  skeleton.x = x;
  skeleton.y = y;

  const stateData = new spine.AnimationStateData(skelData);
  const animState = new spine.AnimationState(stateData);
  animState.setAnimation(0, 'animation', true);

  // Use ctx so additive blending works against the background (below castle-frame overlay)
  const renderer = new spine.canvas.SkeletonRenderer(ctx);
  renderer.debugRendering = false;

  return { skeleton, animState, renderer, lastTime: performance.now() / 1000 };
}

function loadFire(cb) {
  const base = 'spine/';
  const imgEl = new Image();
  imgEl.onerror = () => cb();
  imgEl.onload = () => {
    Promise.all([
      fetch(base + 'fire.atlas').then(r => r.text()),
      fetch(base + 'fire.json').then(r => r.json()),
    ]).then(([atlasText, jsonData]) => {
      const textureAtlas = new spine.TextureAtlas(atlasText, () =>
        new spine.canvas.CanvasTexture(imgEl)
      );
      const atlasLoader = new spine.AtlasAttachmentLoader(textureAtlas);
      const skelData = new spine.SkeletonJson(atlasLoader).readSkeletonData(jsonData);

      fireL = _makeFireInstance(skelData,  15, 30);   // left torch
      fireR = _makeFireInstance(skelData, 345, 30);   // right torch
      cb();
    }).catch(() => cb());
  };
  imgEl.src = base + 'fire.png';
}

function updateFire(nowSec) {
  [fireL, fireR].forEach(f => {
    if (!f) return;
    const delta = nowSec - f.lastTime;
    f.lastTime = nowSec;
    f.animState.update(delta);
    f.animState.apply(f.skeleton);
    f.skeleton.updateWorldTransform();
  });
}

function drawFire() {
  [fireL, fireR].forEach(f => {
    if (!f) return;
    ctx.save();
    f.renderer.draw(f.skeleton);
    ctx.restore();
  });
}

function drawKnightCircle() {
  if (state.screen === 'bet') return;
  const img = IMG.circle;
  if (!img || !img.naturalWidth) return;
  const canShoot = state.screen === 'arena' && !state.ballActive && !state.advancing && !state.breaching;
  const alpha = canShoot ? 1 : 0.35;
  const W = 68, H = 26;
  const cx = knight ? knight.x : PLAYER_X;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - W / 2, PLAYER_Y - H / 2 + 35, W, H);
  ctx.restore();
}

function drawKnight() {
  if (state.screen === 'bet') return;
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

// ── FRAME-SEQUENCE EFFECTS ────────────────────────────────
const FX_FRAMES = { hit: [], smoke: [] };
let fxLoaded = false;

function loadFX(cb) {
  let total = 7 + 17, done = 0;
  const finish = () => { if (++done >= total) { fxLoaded = true; cb(); } };
  for (let i = 0; i < 7; i++) {
    const img = new Image();
    img.onload = img.onerror = finish;
    img.src = `images/fx/hit/hit${i}.png`;
    FX_FRAMES.hit.push(img);
  }
  for (let i = 0; i < 17; i++) {
    const img = new Image();
    img.onload = img.onerror = finish;
    img.src = `images/fx/smoke/smoke${String(i).padStart(2,'0')}.png`;
    FX_FRAMES.smoke.push(img);
  }
}

function spawnEffect(type, x, y, size, delay, alpha) {
  if (!fxLoaded) return;
  state.effects = state.effects || [];
  const cfg = type === 'hit'
    ? { frames: FX_FRAMES.hit,   size: 36, delay: 2 }
    : { frames: FX_FRAMES.smoke, size: 80, delay: 3 };
  state.effects.push({
    frames: cfg.frames, frameIdx: 0, x, y, timer: 0,
    size:  size  ?? cfg.size,
    delay: delay ?? cfg.delay,
    alpha: alpha ?? 1,
    below: type === 'smoke',
  });
}

function drawTrailPuffs() {
  if (!state.trailPuffs.length) return;
  const img = IMG.smoke;
  const hasImg = img && img.naturalWidth > 0;
  const MAX_AGE = 40;
  ctx.save();
  state.trailPuffs.forEach(p => {
    const t = p.age / MAX_AGE;
    const size = 36 - t * 16; // 36→20px, shrinks as it fades
    ctx.globalAlpha = (1 - t) * 0.65;
    p.y -= 0.5; // drift upward (opposite to enemy movement)
    if (hasImg) {
      ctx.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
    } else {
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    p.age++;
  });
  ctx.restore();
  state.trailPuffs = state.trailPuffs.filter(p => p.age < MAX_AGE);
}

function drawEffects(below) {
  if (!state.effects.length) return;
  ctx.save();
  state.effects.forEach(fx => {
    if (!!fx.below !== !!below || fx.frameIdx >= fx.frames.length) return;
    const img = fx.frames[fx.frameIdx];
    if (img && img.naturalWidth > 0) {
      ctx.globalAlpha = fx.alpha;
      ctx.drawImage(img, fx.x - fx.size / 2, fx.y - fx.size / 2, fx.size, fx.size);
    }
    if (++fx.timer >= fx.delay) { fx.timer = 0; fx.frameIdx++; }
  });
  ctx.restore();
  if (!below) state.effects = state.effects.filter(fx => fx.frameIdx < fx.frames.length);
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

function drawBetMask() {
  // 50% black overlay covers everything including deathline; fades out over 0.6s on arena start
  let alpha = 0;
  if (state.screen === 'bet') {
    alpha = 0.5;
  } else if (state.arenaEnteredAt) {
    const elapsed = performance.now() - state.arenaEnteredAt;
    alpha = Math.max(0, 0.5 * (1 - elapsed / 600));
  }
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
}

function drawHPBadge(e, x, y) {
  const pct    = e.hp / e.maxHp;
  const hpText = `${e.hp}/${e.maxHp}`;
  const pillW  = ENEMY_W;
  const pillH  = 9;
  const r      = pillH / 2;
  const px     = x;
  const py     = y + ENEMY_H - pillH + 5;

  function pillPath() {
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + pillW - r, py);
    ctx.arc(px + pillW - r, py + r, r, -Math.PI / 2, 0);
    ctx.lineTo(px + pillW, py + pillH - r);
    ctx.arc(px + pillW - r, py + pillH - r, r, 0, Math.PI / 2);
    ctx.lineTo(px + r, py + pillH);
    ctx.arc(px + r, py + pillH - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(px, py + r);
    ctx.arc(px + r, py + r, r, Math.PI, -Math.PI / 2);
    ctx.closePath();
  }

  ctx.save();

  // Dark empty-HP background
  ctx.fillStyle = '#4a0000';
  pillPath();
  ctx.fill();

  // Red current-HP fill, clipped to pill shape
  if (pct > 0) {
    ctx.save();
    pillPath();
    ctx.clip();
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(px, py, pillW * pct, pillH);
    ctx.restore();
  }

  // 2px black pill outline
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  pillPath();
  ctx.stroke();

  // Bold italic text — large enough to overflow pill, black stroke
  ctx.font = 'italic bold 13px Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(hpText, px + pillW / 2, py + pillH / 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(hpText, px + pillW / 2, py + pillH / 2);

  ctx.restore();
}


function drawCoins() {
  if (!state.coins.length) return;
  const img  = IMG.coin;
  const SIZE = 18;
  const hasImg = img && img.naturalWidth > 0;
  // Draw on aimCtx so coins fly above the castle-frame overlay
  if (!hasImg) {
    aimCtx.fillStyle   = '#ffd700';
    aimCtx.strokeStyle = '#b8860b';
    aimCtx.lineWidth   = 1.5;
  }
  state.coins.forEach(coin => {
    if (hasImg) {
      aimCtx.drawImage(img, coin.x - SIZE / 2, coin.y - SIZE / 2, SIZE, SIZE);
    } else {
      aimCtx.beginPath();
      aimCtx.arc(coin.x, coin.y, SIZE / 2, 0, Math.PI * 2);
      aimCtx.fill();
      aimCtx.stroke();
    }
  });
}


function drawDangerZone() {
  if (!state.cancelMode) return;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(FL, DIVIDER_Y, FR - FL, CH - DIVIDER_Y);
  ctx.restore();
}

function drawDeathline() {
  const img = IMG.deathline;
  if (!img || !img.naturalWidth) return;
  const lineW = FR - FL;
  const lineH = Math.round(img.naturalHeight * lineW / img.naturalWidth);
  const lineY = DIVIDER_Y - Math.round(lineH / 2);
  ctx.save();
  if (state.breaching) {
    // Rotate yellow hue to red
    ctx.filter = 'hue-rotate(300deg) saturate(1.5)';
  }
  ctx.drawImage(img, FL, lineY, lineW, lineH);
  ctx.restore();
}

function drawEnemies() {
  const now = performance.now() / 1000;
  state.enemies.forEach(e => {
    const { x, y } = enemyXY(e.col, e.row, e._diagDir || 0);
    const sx = x + (CELL_W - ENEMY_W) / 2;
    const sy = y + (CELL_H - ENEMY_H) / 2;
    const t = ENEMY_TYPES[e.typeIdx];
    let skeleton = null;

    if (e.spine && enemyRenderer) {
      const { skeleton: skel, animState } = e.spine;
      skeleton = skel;
      const delta = Math.min(now - e.spine.lastTime, 0.05);
      e.spine.lastTime = now;
      animState.update(delta);
      animState.apply(skel);
      skel.x = x + CELL_W / 2;
      skel.y = y + ENEMY_SPINE_Y_OFF;
      skel.updateWorldTransform();
      ctx.save();
      enemyRenderer.draw(skel);
      ctx.restore();
    } else {
      safeDrawImage(IMG[t.sprite], sx, sy, ENEMY_W, ENEMY_H);
    }

    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = e.hitFlash / 5;
      ctx.filter = 'saturate(0) brightness(8)';
      if (skeleton) {
        enemyRenderer.draw(skeleton);
      } else {
        safeDrawImage(IMG[t.sprite], sx, sy, ENEMY_W, ENEMY_H);
      }
      ctx.restore();
      e.hitFlash--;
    }

    if (!e.dying) drawHPBadge(e, sx, sy);
  });
}


let _aimDashOffset = 0;

function drawAimLine() {
  if (!state.isAiming || state.ballActive) return;

  // Cancel mode — draw indicator pill at deathline, hide aim line
  if (state.cancelMode) {
    const cx = CW / 2, cy = DIVIDER_Y - 18;
    ctx.font = 'bold 13px Roboto, sans-serif';
    const tw = ctx.measureText('RELEASE TO CANCEL').width;
    const pw = tw + 32, ph = 28, r = 14;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const x0 = cx - pw / 2, y0 = cy - ph / 2;
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x0 + pw - r, y0);
    ctx.arcTo(x0 + pw, y0, x0 + pw, y0 + r, r);
    ctx.lineTo(x0 + pw, y0 + ph - r);
    ctx.arcTo(x0 + pw, y0 + ph, x0 + pw - r, y0 + ph, r);
    ctx.lineTo(x0 + r, y0 + ph);
    ctx.arcTo(x0, y0 + ph, x0, y0 + ph - r, r);
    ctx.lineTo(x0, y0 + r);
    ctx.arcTo(x0, y0, x0 + r, y0, r);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RELEASE TO CANCEL', cx, cy);
    ctx.restore();
    return;
  }
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

  ctx.save();

  // Dashed line: knight → first bounce
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -_aimDashOffset;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(bp.x, bp.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Rotating target circle (radius 14)
  ctx.translate(bp.x, bp.y);
  const R   = 14;
  const rot = (_aimDashOffset / 16) * Math.PI * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.5;
  for (let a = 0; a < 3; a++) {
    const start = rot + (a * Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.arc(0, 0, R, start, start + Math.PI * 0.45);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff3333';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBall() {
  if (!state.ballActive || !state.ball) return;
  const { x, y, vx, vy } = state.ball;

  // Fading dot trail
  if (state.trail.length) {
    ctx.save();
    ctx.fillStyle = '#ffe066';
    state.trail.forEach((p, i) => {
      const t = (i + 1) / state.trail.length;
      ctx.globalAlpha = t * 0.45;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * t * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
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

function drawWallHits() {
  if (!state.wallHits.length) return;
  const img = IMG.hitVfx2;
  if (!img || !img.naturalWidth) return;
  const FI = 30;   // fade-in  0.03s
  const HOLD = 100; // hold    0.10s
  const FO = 50;   // fade-out 0.05s
  const TOTAL = FI + HOLD + FO;
  const W = 14, H = 72; // 2× taller
  const now = performance.now();
  state.wallHits.forEach(h => {
    if (h.y > DIVIDER_Y) return;
    const el = now - h.t0;
    let alpha;
    if (el < FI)               alpha = el / FI;
    else if (el < FI + HOLD)   alpha = 1;
    else                       alpha = 1 - (el - FI - HOLD) / FO;
    const cx = h.side === 'R' ? h.x + 10 : h.side === 'L' ? h.x - 10 : h.x;
    aimCtx.save();
    aimCtx.globalAlpha = Math.max(0, alpha);
    aimCtx.translate(cx, h.y);
    if (h.side === 'R') aimCtx.scale(-1, 1);
    aimCtx.drawImage(img, -W / 2, -H / 2, W, H);
    aimCtx.restore();
  });
  state.wallHits = state.wallHits.filter(h => now - h.t0 < TOTAL);
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



function drawPopups() {
  if (!state.popups.length) return;
  ctx.save();
  ctx.font = 'bold 22px Roboto';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.strokeStyle = 'rgba(0,0,0,.8)';
  ctx.lineWidth = 3;
  state.popups.forEach(p => {
    const py = p.y - p.age * 1.2;
    ctx.globalAlpha = 1 - p.age / p.maxAge;
    ctx.strokeText(p.text, p.x, py);
    ctx.fillText(p.text, p.x, py);
    p.age++;
  });
  ctx.restore();
  state.popups = state.popups.filter(p => p.age < p.maxAge);
}

function drawCombo() {
  if (!state.ballActive || state.hitCombo < 1) return;
  const flashT = state.comboFlash / 15;
  const scale = 1 + flashT * 0.35;
  if (state.comboFlash > 0) state.comboFlash--;

  ctx.save();
  ctx.translate(CW / 2, 538);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';

  // Outline
  ctx.font = 'bold 28px Roboto';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(`×${state.hitCombo} HIT`, 0, 0);

  // Fill — gradient gold→orange (swap font/style here later for art font)
  const g = ctx.createLinearGradient(0, -24, 0, 4);
  g.addColorStop(0, '#fff176');
  g.addColorStop(1, '#ff6f00');
  ctx.fillStyle = g;
  ctx.fillText(`×${state.hitCombo} HIT`, 0, 0);

  ctx.restore();
}

function drawAimGlow() {
  if (state.screen !== 'arena' || !state.isAiming) return;
  const grad = ctx.createLinearGradient(0, CH, 0, DIVIDER_Y);
  grad.addColorStop(0,    '#ffffff');
  grad.addColorStop(0.05, '#FF9900');
  grad.addColorStop(1.0,  'rgba(255,153,0,0)');
  // breathing: alpha 100%→50%→100% over 2s, cosine gives natural ease-in/out
  const breathe = 0.75 + 0.25 * Math.cos(performance.now() * Math.PI * 2 / 2000);
  ctx.save();
  ctx.globalAlpha = breathe;
  ctx.fillStyle = grad;
  ctx.fillRect(FL, DIVIDER_Y, FR - FL, CH - DIVIDER_Y);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, CW, CH);
  aimCtx.clearRect(0, 0, CW, CH);
  if (state.screen === 'arena' || state.screen === 'bet') {
    // Screen shake — random offset that decays each frame
    let sx = 0, sy = 0;
    if (state.shake > 0) {
      const intensity = state.shake * 0.65;
      sx = (Math.random() - 0.5) * intensity;
      sy = (Math.random() - 0.5) * intensity;
      state.shake--;
    }
    const nowSec = performance.now() / 1000;
    if (state.screen === 'arena') updateKnight(nowSec);
    if (state.screen === 'bet') updateKnightStart(nowSec);
    updateFlag(nowSec);
    updateFire(nowSec);
    // Static dark fill covers canvas edges exposed by shake offset
    ctx.fillStyle = '#2e2e38';
    ctx.fillRect(0, 0, CW, CH);
    ctx.save();
    ctx.translate(sx, sy);
    try {
      drawBackground();
      drawFire();
      drawTrailPuffs();
      drawDangerZone();
      drawDeathline();
      if (state.screen !== 'bet') drawEnemies();
      drawEffects(true);
      if (state.screen === 'arena') {
        drawBall();
        drawWallHits();
        drawHitFlash();
      }
      drawEffects(false);
      drawAimLine();
      drawCoins();
      drawAimGlow();
      drawKnightCircle();
      drawKnight();
      drawCombo();
      drawPopups();
    } finally {
      ctx.restore();
    }
    drawFlag();
    drawBetMask();
    drawKnightStart();
  }
}
