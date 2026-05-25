// ── SOUND ENGINE (Web Audio API — no files needed) ────────
// All sounds are synthesised. Replace any function body with
// a buffered-source load if you want a real audio file.

const SFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone({ freq = 440, type = 'sine', gain = 0.4, attack = 0.01,
                       decay = 0.1, sustain = 0, release = 0.15, duration = 0.25,
                       freqEnd = null, detune = 0 } = {}) {
    const c = getCtx();
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.connect(env);
    env.connect(c.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    osc.detune.setValueAtTime(detune, c.currentTime);
    if (freqEnd !== null)
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), c.currentTime + duration);

    const t = c.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.linearRampToValueAtTime(gain * sustain, t + attack + decay);
    env.gain.linearRampToValueAtTime(0, t + attack + decay + release);

    osc.start(t);
    osc.stop(t + attack + decay + release + 0.05);
  }

  function playNoise({ gain = 0.3, attack = 0.005, release = 0.08, filter = 800 } = {}) {
    const c = getCtx();
    const bufSize = c.sampleRate * 0.2;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filter;
    filt.Q.value = 1.5;

    const env = c.createGain();
    src.connect(filt);
    filt.connect(env);
    env.connect(c.destination);

    const t = c.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t + attack + release);

    src.start(t);
    src.stop(t + attack + release + 0.05);
  }

  let sfxMuted = (localStorage.getItem('bounceFcMuteSfx') === '1');

  return {
    get isSfxMuted() { return sfxMuted; },
    toggleSfxMute() {
      sfxMuted = !sfxMuted;
      localStorage.setItem('bounceFcMuteSfx', sfxMuted ? '1' : '0');
    },

    // Ball kicked — dull thud + short high whoosh
    shoot() {
      if (sfxMuted) return;
      playNoise({ gain: 0.5, attack: 0.005, release: 0.06, filter: 220 });
      playTone({ freq: 900, freqEnd: 400, type: 'sine', gain: 0.15,
                 attack: 0.01, decay: 0.08, sustain: 0, release: 0.05, duration: 0.1 });
    },

    // Ball hits enemy — crisp mid impact
    hit() {
      if (sfxMuted) return;
      playNoise({ gain: 0.35, attack: 0.003, release: 0.05, filter: 600 });
      playTone({ freq: 320, freqEnd: 180, type: 'square', gain: 0.12,
                 attack: 0.005, decay: 0.06, sustain: 0, release: 0.04, duration: 0.08 });
    },

    // Enemy killed — satisfying rising pop
    kill() {
      if (sfxMuted) return;
      playTone({ freq: 200, freqEnd: 600, type: 'sine', gain: 0.35,
                 attack: 0.01, decay: 0.12, sustain: 0, release: 0.1, duration: 0.2 });
      playNoise({ gain: 0.2, attack: 0.005, release: 0.1, filter: 1200 });
    },

    // Enemies advance — low rumble
    advance() {
      if (sfxMuted) return;
      playNoise({ gain: 0.25, attack: 0.02, release: 0.18, filter: 120 });
      playTone({ freq: 80, freqEnd: 60, type: 'sawtooth', gain: 0.2,
                 attack: 0.02, decay: 0.1, sustain: 0.1, release: 0.12, duration: 0.25 });
    },
  };
})();

// ── BACKGROUND MUSIC ──────────────────────────────────────
const BGM = (() => {
  const audio = new Audio('audio/bg_music.m4a');
  audio.loop   = true;
  audio.volume = 0.175;

  let muted = (localStorage.getItem('bounceFcMute') === '1');
  audio.muted = muted;

  function updateBtn() {
    const btn = document.getElementById('bgm-btn');
    if (btn) btn.textContent = muted ? '🔇' : '🎵';
  }

  return {
    play() {
      if (audio.paused) audio.play().catch(() => {});
    },
    pause() {
      audio.pause();
    },
    toggleMute() {
      muted = !muted;
      audio.muted = muted;
      localStorage.setItem('bounceFcMute', muted ? '1' : '0');
      updateBtn();
    },
    get isMuted() { return muted; },
    init() { updateBtn(); },
  };
})();
