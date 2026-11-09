// Sons synthétisés (WebAudio) — aucun fichier audio à charger
let ctx = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
let enabled = true, musicOn = true, musicTimer = null;
const lastPlay = {};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = enabled ? 0.55 : 0; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? 0.16 : 0; musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}
export function setSound(on) { enabled = on; if (sfxGain) sfxGain.gain.value = on ? 0.55 : 0; }
export function setMusic(on) { musicOn = on; if (musicGain) musicGain.gain.value = on ? 0.16 : 0; }

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0, dest = sfxGain) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.3, freq = 2000, q = 1, type = 'lowpass', delay = 0, sweep = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain);
  s.start(t); s.stop(t + dur + 0.05);
}

export function sfx(name) {
  if (!ctx || !enabled) return;
  const now = performance.now();
  const min = { hit: 45, crit: 60, coin: 70, enemyHit: 60 }[name] || 0;
  if (lastPlay[name] && now - lastPlay[name] < min) return;
  lastPlay[name] = now;
  switch (name) {
    case 'hit': noise(0.08, 0.35, 2400, 1, 'lowpass', 0, 0.3); tone(180, 0.08, 'triangle', 0.25, 0.5); break;
    case 'crit': noise(0.12, 0.4, 5000, 2, 'bandpass', 0, 0.4); tone(880, 0.15, 'square', 0.12, 1.6); tone(220, 0.12, 'triangle', 0.3, 0.4); break;
    case 'enemyHit': noise(0.09, 0.25, 900, 1, 'lowpass'); tone(120, 0.1, 'sine', 0.3, 0.6); break;
    case 'slash': noise(0.15, 0.3, 3000, 3, 'bandpass', 0, 3); break;
    case 'coin': tone(1320, 0.08, 'square', 0.08); tone(1760, 0.12, 'square', 0.08, 1, 0.06); break;
    case 'click': tone(660, 0.05, 'triangle', 0.15); break;
    case 'open': noise(0.18, 0.3, 800, 1, 'lowpass', 0, 4); tone(300, 0.12, 'triangle', 0.25, 2); break;
    case 'equip': tone(520, 0.08, 'triangle', 0.2); tone(780, 0.12, 'triangle', 0.2, 1, 0.07); break;
    case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, 1, i * 0.08)); break;
    case 'meow': {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 3;
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(820, t + 0.12); o.frequency.linearRampToValueAtTime(480, t + 0.35);
      f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2200, t + 0.12); f.frequency.linearRampToValueAtTime(800, t + 0.35);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.4);
      break;
    }
    case 'rare': [660, 880, 1100].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, 1, i * 0.07)); break;
    case 'epic': [523, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'square', 0.1, 1, i * 0.07)); noise(0.5, 0.12, 6000, 1, 'highpass'); break;
    case 'legendary':
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'square', 0.1, 1, i * 0.06));
      tone(98, 0.8, 'sawtooth', 0.15, 0.5); noise(0.9, 0.18, 8000, 1, 'highpass');
      break;
    case 'laser': tone(1600, 0.45, 'sawtooth', 0.12, 0.3); tone(800, 0.45, 'square', 0.08, 0.4); break;
    case 'thunder': noise(0.7, 0.6, 1200, 1, 'lowpass', 0, 0.1); tone(60, 0.5, 'sine', 0.4, 0.5); break;
    case 'boom': noise(0.6, 0.6, 1500, 1, 'lowpass', 0, 0.08); tone(90, 0.6, 'sine', 0.5, 0.35); break;
    case 'heal': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'sine', 0.15, 1, i * 0.06)); break;
    case 'whoosh': noise(0.35, 0.3, 600, 2, 'bandpass', 0, 5); break;
    case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, 1, i * 0.1)); break;
    case 'defeat': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, 1, i * 0.15)); break;
    case 'buy': [784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.18, 'square', 0.08, 1, i * 0.05)); noise(0.4, 0.1, 9000, 1, 'highpass', 0.1); break;
    case 'error': tone(200, 0.15, 'square', 0.12, 0.8); break;
    // montée de suspense (carton qui va donner une grande rareté)
    case 'charge': [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => tone(220 * Math.pow(1.12, i), 0.12, 'square', 0.06 + i * 0.01, 1, i * 0.09)); noise(0.8, 0.12, 3000, 1, 'bandpass', 0, 4); break;
    case 'pop': tone(660, 0.08, 'triangle', 0.18, 1.6); noise(0.12, 0.12, 2500, 1, 'bandpass'); break;
    default: break;
  }
}

// Musique douce générative (pentatonique)
function startMusic() {
  if (musicTimer) return;
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const roots = [261.63, 220, 174.61, 196];
  let step = 0;
  const bpm = 104;
  const stepDur = 60 / bpm / 2;
  let next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 4;
      const root = roots[bar];
      if (step % 8 === 0) bass(root / 2, next, stepDur * 7);
      if (step % 2 === 0 || Math.random() < 0.35) {
        const n = scale[(step * 3 + bar * 2 + (Math.random() < 0.3 ? 2 : 0)) % scale.length];
        pluck(root * Math.pow(2, n / 12) * 2, next, stepDur * 1.6);
      }
      if (step % 4 === 2) hat(next);
      next += stepDur;
      step++;
    }
  }, 100);
}
function pluck(f, t, d) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + d + 0.05);
}
function bass(f, t, d) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + d + 0.05);
}
function hat(t) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + 0.06);
}
