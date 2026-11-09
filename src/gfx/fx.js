// =====================================================================
//  Effets visuels 2D : particules additives, entailles, ondes de choc,
//  rayons, éclairs, projectiles à traînée, colonnes de lumière, décalques
//  au sol (brûlures, fissures, givre), cercles runiques, assombrissement
//  du décor, charges d'énergie, chiffres de dégâts.
//  Tous les halos sont des sprites pré-rendus (aucun canvas créé par image).
// =====================================================================
import { shade, ell } from './draw.js';

const MAXP = 1100;
const TAU = Math.PI * 2;
const WHITE = '#ffffff';

// ------------------------------------------------------------ couleurs (cache hex → rgb)
const RGB = new Map();
function rgbOf(hex) {
  let c = RGB.get(hex);
  if (!c) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    RGB.set(hex, c);
  }
  return c;
}
export function ca(hex, a) {
  const c = rgbOf(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a <= 0 ? 0 : a >= 1 ? 1 : a.toFixed(3)) + ')';
}

// ------------------------------------------------------------ sprites pré-rendus (cache par forme puis couleur)
const SPR = new Map();
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rad(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]);
  return gr;
}
function lin(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]);
  return gr;
}
function heartPath(g, s) {
  g.beginPath(); g.moveTo(0, s);
  g.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.6, -s * 1.4, 0, -s * 0.4);
  g.bezierCurveTo(s * 0.6, -s * 1.4, s * 1.6, -s * 0.2, 0, s);
  g.closePath();
}
function build(color, kind) {
  let c, g;
  switch (kind) {
    case 'star': {
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = rad(g, 32, 32, 32, [0, ca(WHITE, 1), 0.15, ca(color, 0.9), 1, ca(color, 0)]);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const r = i % 2 ? 6 : 32; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rad(g, 32, 32, 13, [0, ca(WHITE, 0.85), 1, ca(color, 0)]); g.fillRect(0, 0, 64, 64);
      break;
    }
    case 'smoke':
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = rad(g, 32, 32, 32, [0, ca(color, 0.55), 0.6, ca(color, 0.25), 1, ca(color, 0)]); g.fillRect(0, 0, 64, 64);
      break;
    case 'bubble':
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = ca(color, 0.14); g.beginPath(); g.arc(32, 32, 26, 0, TAU); g.fill();
      g.strokeStyle = ca(color, 0.9); g.lineWidth = 4; g.stroke();
      g.fillStyle = ca(WHITE, 0.75); g.beginPath(); g.arc(22, 22, 6, 0, TAU); g.fill();
      break;
    case 'soft':
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = rad(g, 32, 32, 32, [0, ca(color, 0.7), 0.45, ca(color, 0.28), 1, ca(color, 0)]); g.fillRect(0, 0, 64, 64);
      break;
    case 'flare': { // étoile à 4 branches + reflet anamorphique
      c = cv(128, 128); g = c.getContext('2d'); g.globalCompositeOperation = 'lighter';
      const st = [0, ca(WHITE, 1), 0.22, ca(color, 0.85), 1, ca(color, 0)];
      g.save(); g.translate(64, 64); g.scale(1, 0.05); g.fillStyle = rad(g, 0, 0, 64, st); g.beginPath(); g.arc(0, 0, 64, 0, TAU); g.fill(); g.restore();
      g.save(); g.translate(64, 64); g.scale(0.045, 0.72); g.fillStyle = rad(g, 0, 0, 64, st); g.beginPath(); g.arc(0, 0, 64, 0, TAU); g.fill(); g.restore();
      g.fillStyle = rad(g, 64, 64, 26, [0, ca(WHITE, 1), 0.3, ca(color, 0.7), 1, ca(color, 0)]); g.fillRect(0, 0, 128, 128);
      break;
    }
    case 'streak': // trait lumineux horizontal (étincelles étirées selon la vitesse)
      c = cv(64, 16); g = c.getContext('2d');
      g.translate(32, 8); g.scale(1, 0.25);
      g.fillStyle = rad(g, 0, 0, 32, [0, ca(WHITE, 1), 0.3, ca(color, 0.9), 0.7, ca(color, 0.3), 1, ca(color, 0)]);
      g.beginPath(); g.arc(0, 0, 32, 0, TAU); g.fill();
      break;
    case 'ring':
      c = cv(128, 128); g = c.getContext('2d');
      g.fillStyle = rad(g, 64, 64, 64, [0, ca(color, 0), 0.6, ca(color, 0), 0.8, ca(color, 0.5), 0.88, ca(WHITE, 0.9), 0.95, ca(color, 0.4), 1, ca(color, 0)]);
      g.fillRect(0, 0, 128, 128);
      break;
    case 'shard': // éclat de cristal (losange lumineux)
      c = cv(32, 32); g = c.getContext('2d');
      g.fillStyle = rad(g, 16, 16, 16, [0, ca(color, 0.5), 1, ca(color, 0)]); g.fillRect(0, 0, 32, 32);
      g.fillStyle = ca(color, 0.95); g.beginPath(); g.moveTo(31, 16); g.lineTo(13, 9); g.lineTo(2, 16); g.lineTo(13, 23); g.closePath(); g.fill();
      g.fillStyle = ca(WHITE, 0.95); g.beginPath(); g.moveTo(27, 16); g.lineTo(14, 12.5); g.lineTo(8, 16); g.lineTo(14, 19.5); g.closePath(); g.fill();
      break;
    case 'heart':
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = rad(g, 32, 32, 32, [0, ca(color, 0.6), 1, ca(color, 0)]); g.fillRect(0, 0, 64, 64);
      g.translate(32, 33); heartPath(g, 16); g.fillStyle = color; g.fill();
      g.fillStyle = ca(WHITE, 0.85); g.beginPath(); g.ellipse(-7, -6, 4, 2.6, -0.6, 0, TAU); g.fill();
      break;
    case 'plus':
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = rad(g, 32, 32, 32, [0, ca(color, 0.6), 1, ca(color, 0)]); g.fillRect(0, 0, 64, 64);
      g.fillStyle = color; g.fillRect(26, 12, 12, 40); g.fillRect(12, 26, 40, 12);
      g.fillStyle = ca(WHITE, 0.9); g.fillRect(29.5, 16, 5, 32); g.fillRect(16, 29.5, 32, 5);
      break;
    case 'leaf':
      c = cv(32, 32); g = c.getContext('2d');
      g.translate(16, 16); g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, TAU);
      g.fillStyle = color; g.fill(); g.lineWidth = 1.5; g.strokeStyle = shade(color, -0.5); g.stroke();
      g.beginPath(); g.moveTo(-13, 0); g.lineTo(12, 0); g.stroke();
      break;
    case 'petal':
      c = cv(32, 32); g = c.getContext('2d');
      g.fillStyle = lin(g, 4, 16, 28, 16, [0, shade(color, 0.45), 1, color]);
      g.beginPath(); g.ellipse(16, 16, 13, 7, 0, 0, TAU); g.fill();
      break;
    case 'ray': // rayon de lumière : vif à la base, s'estompe au bout
      c = cv(128, 16); g = c.getContext('2d');
      g.fillStyle = lin(g, 0, 0, 128, 0, [0, ca(WHITE, 0.95), 0.12, ca(color, 0.85), 0.6, ca(color, 0.25), 1, ca(color, 0)]); g.fillRect(0, 0, 128, 16);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = lin(g, 0, 0, 0, 16, [0, 'rgba(0,0,0,0)', 0.5, 'rgba(0,0,0,1)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, 128, 16);
      break;
    case 'bar': // profil horizontal d'une colonne (étiré verticalement, s'estompe vers le haut)
      c = cv(32, 64); g = c.getContext('2d');
      g.fillStyle = lin(g, 0, 0, 32, 0, [0, ca(color, 0), 0.22, ca(color, 0.3), 0.42, ca(color, 0.85), 0.5, ca(WHITE, 1), 0.58, ca(color, 0.85), 0.78, ca(color, 0.3), 1, ca(color, 0)]); g.fillRect(0, 0, 32, 64);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = lin(g, 0, 0, 0, 64, [0, 'rgba(0,0,0,0)', 0.3, 'rgba(0,0,0,1)', 1, 'rgba(0,0,0,1)']); g.fillRect(0, 0, 32, 64);
      break;
    case 'barc': // profil de colonne sans cœur blanc (sous-couche colorée)
      c = cv(32, 64); g = c.getContext('2d');
      g.fillStyle = lin(g, 0, 0, 32, 0, [0, ca(color, 0), 0.3, ca(color, 0.6), 0.5, ca(color, 0.9), 0.7, ca(color, 0.6), 1, ca(color, 0)]); g.fillRect(0, 0, 32, 64);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = lin(g, 0, 0, 0, 64, [0, 'rgba(0,0,0,0)', 0.3, 'rgba(0,0,0,1)', 1, 'rgba(0,0,0,1)']); g.fillRect(0, 0, 32, 64);
      break;
    case 'barHc': // profil de rayon sans cœur blanc (sous-couche colorée)
      c = cv(4, 32); g = c.getContext('2d');
      g.fillStyle = lin(g, 0, 0, 0, 32, [0, ca(color, 0), 0.3, ca(color, 0.6), 0.5, ca(color, 0.9), 0.7, ca(color, 0.6), 1, ca(color, 0)]); g.fillRect(0, 0, 4, 32);
      break;
    case 'barH': // profil vertical d'un rayon (étiré horizontalement)
      c = cv(4, 32); g = c.getContext('2d');
      g.fillStyle = lin(g, 0, 0, 0, 32, [0, ca(color, 0), 0.22, ca(color, 0.3), 0.42, ca(color, 0.85), 0.5, ca(WHITE, 1), 0.58, ca(color, 0.85), 0.78, ca(color, 0.3), 1, ca(color, 0)]); g.fillRect(0, 0, 4, 32);
      break;
    case 'glowL': case 'softL': // grandes versions (256 px), dessinées sans lissage : 3x moins cher en rendu logiciel
      c = cv(256, 256); g = c.getContext('2d');
      g.fillStyle = rad(g, 128, 128, 128, kind === 'glowL' ? [0, ca(WHITE, 1), 0.22, ca(color, 0.88), 0.55, ca(color, 0.28), 1, ca(color, 0)] : [0, ca(color, 0.7), 0.45, ca(color, 0.28), 1, ca(color, 0)]);
      g.fillRect(0, 0, 256, 256);
      break;
    default: // glow
      c = cv(64, 64); g = c.getContext('2d');
      g.fillStyle = rad(g, 32, 32, 32, [0, ca(WHITE, 1), 0.22, ca(color, 0.88), 0.55, ca(color, 0.28), 1, ca(color, 0)]); g.fillRect(0, 0, 64, 64);
  }
  return c;
}
export function sprite(color, kind = 'glow') {
  let m = SPR.get(kind);
  if (!m) { m = new Map(); SPR.set(kind, m); }
  let c = m.get(color);
  if (!c) { c = build(color, kind); m.set(color, c); }
  return c;
}
// fissures pré-rendues (vue de dessus, aplaties au dessin) : géométrie déterministe par variante
function crackGeo(kind, v) {
  let sd = 1234 + v * 7919 + (kind === 'frost' ? 31 : kind === 'claw' ? 57 : 0);
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const L = [];
  if (kind === 'claw') {
    for (let l = 0; l < 4; l++) { const off = (l - 1.5) * 0.24; L.push([[-0.85, off - 0.18], [0.85, off + 0.18]]); }
    return L;
  }
  const nl = kind === 'frost' ? 10 : 8;
  for (let l = 0; l < nl; l++) {
    const a = (l / nl) * TAU + (rnd() - 0.5) * 0.6, len = 0.6 + rnd() * 0.38;
    let cx = Math.cos(a) * 0.1, cy = Math.sin(a) * 0.1;
    const pts = [[cx, cy]];
    for (let sg = 0; sg < 4; sg++) { const aa = a + (rnd() - 0.5) * (kind === 'frost' ? 0.25 : 0.9); cx += Math.cos(aa) * len / 4; cy += Math.sin(aa) * len / 4; pts.push([cx, cy]); }
    L.push(pts);
    if (kind !== 'frost' && rnd() < 0.5) { const p = pts[2], ba = a + (rnd() < 0.5 ? -0.8 : 0.8); L.push([p, [p[0] + Math.cos(ba) * 0.2, p[1] + Math.sin(ba) * 0.2]]); }
  }
  return L;
}
export function crackSprite(kind, v, color, dark) {
  const key = 'crack:' + kind + v + color + (dark ? 'd' : 'g');
  let c = SPR.get(key);
  if (c) return c;
  c = cv(256, 256);
  const g = c.getContext('2d');
  g.translate(128, 128); g.scale(120, 120); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  for (const pts of crackGeo(kind, v)) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); }
  if (dark) { g.lineWidth = 0.075; g.strokeStyle = ca(color, 0.85); g.stroke(); }
  else {
    g.lineWidth = 0.1; g.strokeStyle = ca(color, 0.45); g.stroke();
    g.lineWidth = 0.035; g.strokeStyle = ca(kind === 'frost' ? WHITE : shade(color, 0.65), 1); g.stroke();
  }
  SPR.set(key, c);
  return c;
}
// cercle magique pré-rendu (dessiné ensuite aplati au sol et en rotation)
export function runeSprite(c1, c2 = WHITE, style = 'rune') {
  const key = 'rune:' + style + c1 + c2;
  let c = SPR.get(key);
  if (c) return c;
  c = cv(256, 256);
  const g = c.getContext('2d');
  g.translate(128, 128); g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = c1; g.shadowBlur = 10;
  g.strokeStyle = c1; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 116, 0, TAU); g.stroke();
  g.strokeStyle = c2; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 98, 0, TAU); g.stroke();
  g.lineWidth = 2.5; g.strokeStyle = c1;
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; const r0 = i % 3 ? 102 : 100, r1 = i % 3 ? 108 : 113; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); }
  g.fillStyle = c2;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; g.save(); g.translate(Math.cos(a) * 80, Math.sin(a) * 80); g.rotate(a); g.fillRect(-5, -5, 10, 10); g.restore(); }
  g.strokeStyle = c1; g.lineWidth = 4;
  if (style === 'hex') {
    for (let t = 0; t < 2; t++) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * TAU + t * Math.PI - Math.PI / 2; const x = Math.cos(a) * 92, y = Math.sin(a) * 92; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
  } else if (style === 'paw') {
    g.fillStyle = c1; g.globalAlpha = 0.85;
    g.beginPath(); g.ellipse(0, 16, 30, 24, 0, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * 0.62; g.beginPath(); g.ellipse(Math.cos(a) * 46, Math.sin(a) * 46 + 8, 11, 14, a + Math.PI / 2, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  } else if (style === 'sun') {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(Math.cos(a - 0.12) * 50, Math.sin(a - 0.12) * 50); g.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); g.lineTo(Math.cos(a + 0.12) * 50, Math.sin(a + 0.12) * 50); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke();
  } else {
    g.beginPath(); for (let i = 0; i <= 5; i++) { const a = (i * 2 * TAU) / 5 - Math.PI / 2; const x = Math.cos(a) * 92, y = Math.sin(a) * 92; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    g.strokeStyle = c2; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke();
  }
  SPR.set(key, c);
  return c;
}

const TEXT_STYLE = {
  dmg: { size: 17, fill: '#ffffff', stroke: '#2b1838', dur: 0.9 },
  crit: { size: 25, fill: '#ffd23f', stroke: '#6a1a00', dur: 1.05, grad: ['#fff6b0', '#ffb52e'] },
  skill: { size: 20, fill: '#9ff0ff', stroke: '#0a2a5a', dur: 1 },
  pet: { size: 15, fill: '#ffd6f5', stroke: '#4a0a3a', dur: 0.85 },
  hurt: { size: 16, fill: '#ff6b7a', stroke: '#3a0010', dur: 0.9 },
  heal: { size: 17, fill: '#6dff9e', stroke: '#0a3a1a', dur: 1 },
  miss: { size: 14, fill: '#e0d8ff', stroke: '#2b1838', dur: 0.8 },
  tag: { size: 12, fill: '#ffffff', stroke: '#7a1060', dur: 0.9, bg: '#c2268f' },
  big: { size: 30, fill: '#ffd23f', stroke: '#5a2a00', dur: 1.4, grad: ['#fff6b0', '#ff9d1c'] },
  name: { size: 15, fill: '#ffffff', stroke: '#2b1838', dur: 1.1, bg: '#5e45ad' },
};

// formes de particules : 3, 4, 11, 12 passent en mélange normal, les autres en additif
const KIND = { glow: 0, star: 1, spark: 2, debris: 3, smoke: 4, bubble: 5, flare: 6, ember: 7, streak: 8, shard: 9, ring: 10, leaf: 11, petal: 12, heart: 13, plus: 14, soft: 15 };
const SPRK = ['glow', 'star', 'streak', null, 'smoke', 'bubble', 'flare', 'glow', 'streak', 'shard', 'ring', 'leaf', 'petal', 'heart', 'plus', 'soft'];
const NORMAL = new Uint8Array(16); NORMAL[3] = NORMAL[4] = NORMAL[11] = NORMAL[12] = 1;

// chemin d'un croissant (entaille) le long d'un arc
function crescent(ctx, r, s0, s1, w, N) {
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const u = i / N; const e = s0 + (s1 - s0) * u; const th = w * 0.5 * Math.sin(Math.PI * Math.pow(u, 0.7)); ctx.lineTo(Math.cos(e) * (r + th), Math.sin(e) * (r + th)); }
  for (let i = N; i >= 0; i--) { const u = i / N; const e = s0 + (s1 - s0) * u; const th = w * 0.5 * Math.sin(Math.PI * Math.pow(u, 0.7)); ctx.lineTo(Math.cos(e) * (r - th), Math.sin(e) * (r - th)); }
  ctx.closePath();
}
// ruban effilé à partir d'un tampon circulaire de positions (le plus ancien → le plus récent)
function ribbonPath(ctx, rp, rc, start, RN, hw) {
  ctx.beginPath();
  for (let pass = 0; pass < 2; pass++) {
    for (let jj = 0; jj < rc; jj++) {
      const j = pass ? rc - 1 - jj : jj;
      const i = (start + j) % RN, i0 = (start + Math.max(0, j - 1)) % RN, i1 = (start + Math.min(rc - 1, j + 1)) % RN;
      const dx = rp[i1 * 2] - rp[i0 * 2], dy = rp[i1 * 2 + 1] - rp[i0 * 2 + 1];
      const L = Math.hypot(dx, dy) || 1;
      const w = hw * Math.pow(j / (rc - 1), 0.85) * (pass ? -1 : 1);
      const x = rp[i * 2] - (dy / L) * w, y = rp[i * 2 + 1] + (dx / L) * w;
      if (pass === 0 && jj === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}
function drawRibbon(ctx, rp, rc, rh, RN, width, color, a, low) {
  const start = (rh - rc + RN) % RN;
  ctx.save();
  ribbonPath(ctx, rp, rc, start, RN, width * 0.5); ctx.fillStyle = ca(color, 0.6 * a); ctx.fill();
  if (!low) { ctx.globalCompositeOperation = 'lighter'; ribbonPath(ctx, rp, rc, start, RN, width * 0.17); ctx.fillStyle = ca(WHITE, 0.9 * a); ctx.fill(); }
  ctx.restore();
}
function polyPath(ctx, p, n) { ctx.moveTo(p[0], p[1]); for (let i = 1; i <= n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]); }

export class FX {
  constructor() {
    this.n = 0;
    const F = () => new Float32Array(MAXP);
    this.px = F(); this.py = F(); this.vx = F(); this.vy = F(); this.life = F(); this.max = F();
    this.size = F(); this.size1 = F(); this.grav = F(); this.drag = F(); this.rot = F(); this.vr = F(); this.alpha = F(); this.sq = F();
    this.kind = new Uint8Array(MAXP);
    this.col = new Array(MAXP);
    this.spr = new Array(MAXP);
    this.items = [];
    this.texts = [];
    this.low = false;
    this._dim = null;
  }
  clear() { this.n = 0; this.items = []; for (const x of this.texts) freeText(x); this.texts = []; this._dim = null; }

  emit(x, y, vx, vy, color, size, life, o = {}) {
    if (this.n >= MAXP) return -1;
    const i = this.n++;
    const kd = KIND[o.shape || 'glow'] ?? 0;
    this.px[i] = x; this.py[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.col[i] = color; this.size[i] = size; this.size1[i] = o.endSize ?? 0;
    this.life[i] = 0; this.max[i] = life; this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 2;
    this.rot[i] = o.rot ?? Math.random() * TAU; this.vr[i] = o.spin ?? (Math.random() - 0.5) * 12; this.alpha[i] = o.alpha ?? 1;
    this.sq[i] = o.squash ?? 1;
    this.kind[i] = kd;
    this.spr[i] = kd === 3 ? null : sprite(color, SPRK[kd]);
    return i;
  }
  burst(x, y, o = {}) {
    const n = Math.round((o.count ?? 16) * (this.low ? 0.5 : 1));
    const cols = Array.isArray(o.color) ? o.color : [o.color || '#ffffff'];
    const sp = o.speed ?? 120;
    const eo = { gravity: o.gravity, drag: o.drag, shape: o.shape, endSize: o.endSize, alpha: o.alpha, squash: o.squash, spin: o.spin };
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spreadA ?? 1) : Math.random() * TAU;
      const s = sp * (0.35 + Math.random() * 0.65);
      this.emit(x + (Math.random() - 0.5) * (o.spread ?? 0), y + (Math.random() - 0.5) * (o.spreadY ?? o.spread ?? 0),
        Math.cos(a) * s, Math.sin(a) * s * (o.flatY ?? 1) - (o.up ?? 0), cols[i % cols.length], (o.size ?? 8) * (0.6 + Math.random() * 0.8),
        (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), eo);
    }
  }

  add(dur, draw, layer = 'front', upd) { const it = { t: 0, dur, draw, layer, upd }; this.items.push(it); return it; }
  custom(dur, draw, layer = 'front', upd) { return this.add(dur, draw, layer, upd); }

  // entaille en croissant (coup d'arme) : corps coloré opaque (lisible sur fond clair), halo et cœur additifs
  slash(x, y, o = {}) {
    const r = o.r ?? 34, arc = o.arc ?? 2.2, w = o.width ?? 12, ang = o.angle ?? -0.4, color = o.color || '#ffffff', dir = o.dir ?? 1, sq = o.squash ?? 0.75;
    const under = o.under || color;
    const tip = sprite(o.tip || color, 'flare');
    const N = this.low ? 8 : 12;
    this.add(o.dur ?? 0.22, (ctx, k) => {
      const head = Math.min(1, k * 1.75), tail = Math.max(0, k * 1.75 - 0.72);
      if (head <= tail) return;
      const a0 = ang - arc / 2;
      const s0 = a0 + arc * tail, s1 = a0 + arc * head;
      const fade = 1 - k * 0.5;
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, sq);
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.arc(0, 0, r, s0, s1);
      ctx.lineWidth = w * 2.4; ctx.strokeStyle = ca(color, 0.16 * fade); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      crescent(ctx, r, s0, s1, w * fade, N); ctx.fillStyle = ca(under, 0.88 * fade); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      crescent(ctx, r + w * 0.06, s0 + (s1 - s0) * 0.08, s1, w * 0.5 * fade, N); ctx.fillStyle = ca(color, 0.7 * fade); ctx.fill();
      crescent(ctx, r + w * 0.12, s0 + (s1 - s0) * 0.22, s1, w * 0.22 * fade, N); ctx.fillStyle = ca(WHITE, fade); ctx.fill();
      if (head < 1) { const hx = Math.cos(s1) * r, hy = Math.sin(s1) * r, fs = w * 2; ctx.drawImage(tip, hx - fs, hy - fs, fs * 2, fs * 2); }
      ctx.restore();
    }, o.layer || 'front');
  }
  // coupe droite (iaï, estoc) : trait effilé qui jaillit puis s'amincit
  cut(x, y, o = {}) {
    const L = o.len ?? 60, ang = o.angle ?? -0.5, w = o.width ?? 6, color = o.color || '#ffffff', under = o.under || color;
    const tip = sprite(o.tip || color, 'flare');
    this.add(o.dur ?? 0.2, (ctx, k) => {
      const head = Math.min(1, k * 3.2), tail = Math.max(0, k * 1.6 - 0.45);
      if (head <= tail) return;
      const th = w * (k < 0.3 ? 1 : 1 - (k - 0.3) / 0.75);
      const x0 = -L / 2 + L * tail, x1 = -L / 2 + L * head, xm = x0 + (x1 - x0) * 0.62;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(xm, -th / 2); ctx.lineTo(x1, 0); ctx.lineTo(xm, th / 2); ctx.closePath();
      ctx.fillStyle = ca(under, 0.9); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = th * 2.2; ctx.strokeStyle = ca(color, 0.14); ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.15, 0); ctx.lineTo(xm, -th * 0.18); ctx.lineTo(x1, 0); ctx.lineTo(xm, th * 0.18); ctx.closePath();
      ctx.fillStyle = ca(WHITE, 0.95); ctx.fill();
      if (head < 1) { const fs = w * 2.6; ctx.drawImage(tip, x1 - fs, -fs, fs * 2, fs * 2); }
      ctx.restore();
    }, o.layer || 'front');
  }
  // griffures : n entailles parallèles
  claw(x, y, o = {}) {
    const n = o.n ?? 3, gap = o.gap ?? 7, ang = o.angle ?? -0.4, dir = o.dir ?? 1, sq = o.squash ?? 0.75;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      this.slash(x + Math.cos(ang) * off * dir, y + Math.sin(ang) * off * sq, { ...o, dur: (o.dur ?? 0.24) + i * 0.02 });
    }
  }
  // onde au sol (ellipse)
  ring(x, y, o = {}) {
    const r0 = o.r0 ?? 6, r1 = o.r1 ?? 60, color = o.color || '#ffffff', sq = o.squash ?? 0.35, w = o.width ?? 6;
    this.add(o.dur ?? 0.45, (ctx, k) => {
      const e = 1 - Math.pow(1 - k, 3);
      const r = r0 + (r1 - r0) * e, a = 1 - k;
      ctx.save();
      ell(ctx, x, y, r, r * sq);
      ctx.lineWidth = w * a + 1; ctx.strokeStyle = ca(color, 0.6 * a); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = w * 1.9 * a + 1; ctx.strokeStyle = ca(color, 0.3 * a); ctx.stroke();
      ctx.lineWidth = Math.max(0.8, w * 0.3 * a); ctx.strokeStyle = ca(WHITE, 0.9 * a * a); ctx.stroke();
      ctx.restore();
    }, o.layer || 'back');
  }
  // onde de choc dans le plan de l'écran (double anneau décalé, effet de distorsion)
  shock(x, y, o = {}) {
    const r1 = o.r ?? 80, color = o.color || '#ffffff', c2 = o.color2 || color, w = o.width ?? 8, sq = o.squash ?? 1;
    this.add(o.dur ?? 0.4, (ctx, k) => {
      const e = 1 - Math.pow(1 - k, 2.2), r = r1 * (0.12 + 0.88 * e), a = 1 - k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ell(ctx, x, y, r, r * sq);
      ctx.lineWidth = w * 1.6 * a + 0.5; ctx.strokeStyle = ca(color, 0.32 * a); ctx.stroke();
      ctx.lineWidth = w * 0.45 * a + 0.6; ctx.strokeStyle = ca(WHITE, 0.85 * a); ctx.stroke();
      if (!this.low) { ell(ctx, x, y, r * 0.92, r * 0.92 * sq); ctx.lineWidth = w * 0.5 * a + 0.5; ctx.strokeStyle = ca(c2, 0.6 * a); ctx.stroke(); }
      ctx.restore();
    }, o.layer || 'front');
  }
  // éclair de lumière (sprite)
  blast(x, y, o = {}) {
    const r1 = o.r ?? 60, sq = o.squash ?? 1, al = o.alpha ?? 1;
    if (r1 <= 40 && sq === 1) { this.emit(x, y, 0, 0, o.color || '#ffb52e', r1 * 0.45, o.dur ?? 0.45, { shape: o.soft ? 'soft' : 'glow', drag: 0, endSize: r1, alpha: al }); return; }
    const big = r1 > 55;
    const spr = sprite(o.color || '#ffb52e', (o.soft ? 'soft' : 'glow') + (big ? 'L' : ''));
    this.add(o.dur ?? 0.45, (ctx, k) => {
      const e = 1 - Math.pow(1 - k, 2.4);
      const r = r1 * (0.3 + e * 0.7);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.pow(1 - k, 1.3) * al;
      if (big) ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, x - r, y - r * sq, r * 2, r * 2 * sq);
      ctx.restore();
    }, o.layer || 'front');
  }
  // reflet d'impact : étoile à 4 branches + trait anamorphique
  flare(x, y, o = {}) {
    const s = o.size ?? 30, color = o.color || '#ffffff', len = o.len ?? 2.2, rot = o.rot ?? 0;
    if (s <= 26 && !rot) { this.emit(x, y, 0, 0, color, s * 0.95, (o.dur ?? 0.3) * 1.1, { shape: 'flare', drag: 0, rot: 0, spin: 0 }); return; }
    const spr = sprite(color, 'flare'), st = sprite(color, 'streak');
    this.add(o.dur ?? 0.3, (ctx, k) => {
      const a = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.6);
      const sc = s * (0.55 + 0.55 * Math.min(1, k * 4));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.drawImage(spr, -sc, -sc, sc * 2, sc * 2);
      if (len > 0 && !this.low) ctx.drawImage(st, -sc * len, -sc * 0.1, sc * len * 2, sc * 0.2);
      ctx.restore();
    }, o.layer || 'front');
  }
  // rayons de lumière divergents (tournent lentement)
  rays(x, y, o = {}) {
    const n = Math.max(3, Math.round((o.n ?? 10) * (this.low ? 0.5 : 1))), L = o.len ?? 120, w = o.width ?? 14, spin = o.spin ?? 0.6, sq = o.squash ?? 1;
    const spr = sprite(o.color || '#fff2a0', 'ray');
    const ang = new Float32Array(n), lf = new Float32Array(n);
    const a0 = Math.random() * TAU;
    for (let i = 0; i < n; i++) { ang[i] = a0 + (i / n) * TAU + (Math.random() - 0.5) * 0.5; lf[i] = 0.55 + Math.random() * 0.45; }
    this.add(o.dur ?? 0.7, (ctx, k) => {
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      const grow = 0.45 + 0.55 * Math.min(1, k * 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (o.alpha ?? 0.8);
      ctx.translate(x, y); ctx.scale(1, sq);
      let prev = 0; const base = k * spin;
      for (let i = 0; i < n; i++) { const t = ang[i] + base; ctx.rotate(t - prev); prev = t; const l = L * lf[i] * grow; ctx.drawImage(spr, 0, -w * 0.5 * lf[i], l, w * lf[i]); }
      ctx.restore();
    }, o.layer || 'front');
  }
  // colonne de lumière tombant du ciel
  pillar(x, o = {}) {
    const w = o.width ?? 40, color = o.color || '#ffd23f', y1 = o.y ?? 300, top = o.top ?? -20;
    const bar = sprite(color, 'bar'), barc = sprite(o.under || shade(color, -0.15), 'barc'), gl = sprite(color, 'glow');
    let tick = 0;
    this.add(o.dur ?? 0.8, (ctx, k) => {
      const a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      const ww = w * (0.35 + a * 0.65);
      ctx.save(); ctx.globalAlpha = a * 0.5;
      if (!this.low) ctx.drawImage(barc, x - ww * 0.9, top, ww * 1.8, y1 - top);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (o.alpha ?? 1);
      ctx.drawImage(bar, x - ww, top, ww * 2, y1 - top);
      ctx.drawImage(gl, x - ww * 1.7, y1 - ww * 0.45, ww * 3.4, ww * 0.9);
      ctx.restore();
    }, o.layer || 'front', o.motes === false ? null : (k) => {
      if (k > 0.75 || (++tick % (this.low ? 4 : 2))) return;
      this.emit(x + (Math.random() - 0.5) * w * 0.7, y1 - Math.random() * 40, 0, -140 - Math.random() * 120, color, 3 + Math.random() * 3, 0.45, { shape: 'streak', drag: 0.5 });
    });
  }
  // rayon d'énergie (corps lumineux + spirales + éclat à la source)
  beam(x1, y1, x2, y2, o = {}) {
    const color = o.color || '#ff3d55', w = o.width ?? 10, c2 = o.color2 || WHITE;
    const bar = sprite(color, 'barH'), barc = sprite(o.under || shade(color, -0.15), 'barHc'), fl = sprite(color, 'flare'), gl = sprite(color, 'glow');
    const ph = Math.random() * 10;
    this.add(o.dur ?? 0.5, (ctx, k) => {
      const a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      const tgt = o.follow ? o.follow(k) : null;
      const tx = tgt ? tgt[0] : x2, ty = tgt ? tgt[1] : y2;
      const dx = tx - x1, dy = ty - y1, len = Math.hypot(dx, dy);
      const jit = 1 + Math.sin(k * 80 + ph) * 0.12;
      const ww = w * jit * (0.55 + 0.45 * a);
      ctx.save();
      ctx.translate(x1, y1); ctx.rotate(Math.atan2(dy, dx));
      ctx.globalAlpha = a * 0.7;
      ctx.drawImage(barc, 0, -ww * 1.3, len, ww * 2.6);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (o.alpha ?? 1);
      ctx.drawImage(bar, 0, -ww * 1.4, len, ww * 2.8);
      if (!o.plain && !this.low) {
        ctx.lineWidth = Math.max(0.8, w * 0.16); ctx.strokeStyle = ca(c2, 0.65);
        for (let s = 0; s < 2; s++) {
          ctx.beginPath();
          for (let i = 0; i <= 14; i++) { const u = i / 14; const yy = Math.sin(u * len * 0.11 - k * 46 + s * Math.PI + ph) * ww * 0.85 * Math.min(1, u * 4); if (i) ctx.lineTo(u * len, yy); else ctx.moveTo(0, yy); }
          ctx.stroke();
        }
      }
      const fs = w * 2.6 * jit;
      ctx.drawImage(fl, -fs, -fs, fs * 2, fs * 2);
      ctx.drawImage(gl, len - w * 2.2, -w * 2.2, w * 4.4, w * 4.4);
      ctx.restore();
    }, o.layer || 'front');
  }
  // éclair ramifié qui scintille (3 tracés pré-calculés)
  lightning(x1, y1, x2, y2, o = {}) {
    const color = o.color || '#8fd9ff', W = o.width ?? 1, n = o.seg ?? 9, amp = o.amp ?? 34, dur = o.dur ?? 0.35;
    const V = this.low ? 2 : 3, nb = Math.min(o.branches ?? 2, this.low ? 1 : 6);
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, ba0 = Math.atan2(dy, dx);
    const vars = [];
    for (let v = 0; v < V; v++) {
      const p = new Float32Array((n + 1) * 2);
      p[0] = x1; p[1] = y1; p[n * 2] = x2; p[n * 2 + 1] = y2;
      for (let i = 1; i < n; i++) { const t = i / n; const off = (Math.random() - 0.5) * amp * (0.45 + 0.55 * Math.sin(Math.PI * t)); p[i * 2] = x1 + dx * t + nx * off; p[i * 2 + 1] = y1 + dy * t + ny * off; }
      const br = new Float32Array(nb * 8);
      for (let b = 0; b < nb; b++) {
        const j = 2 + Math.floor(Math.random() * Math.max(1, n - 3));
        let cx = p[j * 2], cy = p[j * 2 + 1];
        br[b * 8] = cx; br[b * 8 + 1] = cy;
        const ba = ba0 + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), bl = L * 0.1;
        for (let s = 1; s < 4; s++) { cx += Math.cos(ba + (Math.random() - 0.5) * 1) * bl; cy += Math.sin(ba + (Math.random() - 0.5) * 1) * bl; br[b * 8 + s * 2] = cx; br[b * 8 + s * 2 + 1] = cy; }
      }
      vars.push(p, br);
    }
    const gl = sprite(color, 'glow'), deep = shade(color, -0.35);
    this.add(dur, (ctx, k) => {
      const vi = Math.floor(k * dur * 30) % V;
      const p = vars[vi * 2], br = vars[vi * 2 + 1];
      const f = (Math.random() > 0.22 ? 1 : 0.3) * (1 - k * k);
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); polyPath(ctx, p, n);
      ctx.lineWidth = 5 * W; ctx.strokeStyle = ca(deep, 0.6 * f); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 8 * W; ctx.strokeStyle = ca(color, 0.28 * f); ctx.stroke();
      ctx.lineWidth = 2 * W; ctx.strokeStyle = ca(WHITE, f); ctx.stroke();
      if (nb) {
        ctx.beginPath();
        for (let b = 0; b < nb; b++) { ctx.moveTo(br[b * 8], br[b * 8 + 1]); for (let s = 1; s < 4; s++) ctx.lineTo(br[b * 8 + s * 2], br[b * 8 + s * 2 + 1]); }
        ctx.lineWidth = 1.4 * W; ctx.strokeStyle = ca(color, 0.9 * f); ctx.stroke();
      }
      ctx.globalAlpha = f; const g = 20 * W; ctx.drawImage(gl, x2 - g, y2 - g, g * 2, g * 2);
      ctx.restore();
    }, o.layer || 'front');
  }
  // projectile : draw(ctx, x, y, angle, k) ; to = [x,y] ou fonction → [x,y]
  // o.ribbon = { color, width, len } : traînée lumineuse effilée ; o.glow = couleur du halo
  projectile(from, to, o = {}) {
    let hit = false;
    const st = { x: from[0], y: from[1], a: 0 };
    const trail = o.trail, rib = o.ribbon;
    const RN = rib ? (rib.len ?? 10) : 0;
    const rp = rib ? new Float32Array(RN * 2) : null;
    let rc = 0, rh = 0, tick = 0;
    if (rib) { rp[0] = from[0]; rp[1] = from[1]; rc = 1; rh = 1 % RN; }
    const gspr = o.glow ? sprite(o.glow, 'glow') : null, gs = o.glowSize ?? 14;
    this.add(o.dur ?? 0.4, (ctx, k) => {
      if (rib && rc > 1) drawRibbon(ctx, rp, rc, rh, RN, rib.width ?? 6, rib.color, 1, this.low);
      if (gspr) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(gspr, st.x - gs, st.y - gs, gs * 2, gs * 2); ctx.restore(); }
      if (o.draw) o.draw(ctx, st.x, st.y, st.a || 0, k);
    }, 'front', (k, done) => {
      const tg = typeof to === 'function' ? to() : to;
      const nx = from[0] + (tg[0] - from[0]) * k;
      const ny = from[1] + (tg[1] - from[1]) * k - Math.sin(k * Math.PI) * (o.arc ?? 30);
      if (nx !== st.x || ny !== st.y) st.a = Math.atan2(ny - st.y, nx - st.x);
      st.x = nx; st.y = ny;
      if (rib) {
        const li = ((rh - 1 + RN) % RN) * 2;
        if (Math.abs(rp[li] - nx) + Math.abs(rp[li + 1] - ny) > 1.5) { rp[rh * 2] = nx; rp[rh * 2 + 1] = ny; rh = (rh + 1) % RN; if (rc < RN) rc++; }
      }
      tick++;
      if (trail && tick % (trail.every ?? 1) === 0 && (!this.low || tick % 2 === 0)) this.emit(nx, ny, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, Array.isArray(trail.color) ? trail.color[Math.floor(Math.random() * trail.color.length)] : trail.color, trail.size ?? 10, trail.life ?? 0.3, { shape: trail.shape, drag: 4 });
      if (done && !hit) {
        hit = true;
        if (rib && rc > 1 && !this.low) { const w = rib.width ?? 6, c = rib.color; this.add(0.16, (ctx, q) => drawRibbon(ctx, rp, rc, rh, RN, w * (1 - q * 0.6), c, 1 - q)); }
        o.onHit && o.onHit(st.x, st.y);
      }
    });
  }
  // décalque au sol qui s'estompe : 'scorch' (brûlure), 'crack' (fissures incandescentes), 'frost', 'splash', 'claw'
  // les fissures sont des sprites pré-rendus (3 variantes par couleur) : 3 à 4 images par décalque et par image
  decal(x, y, o = {}) {
    const kind = o.kind || 'scorch', r = o.r ?? 40, color = o.color || '#ff7a1a', sq = o.squash ?? 0.3, dur = o.dur ?? 1.8, cool = o.cool ?? 2.5;
    const dark = sprite(o.dark || '#1a0a14', 'smoke'), hot = sprite(color, 'soft'), wet = kind === 'splash' ? sprite(color, 'smoke') : null;
    const lined = kind === 'crack' || kind === 'frost' || kind === 'claw';
    const v = Math.floor(Math.random() * 3), flip = Math.random() < 0.5 ? -1 : 1;
    const lineD = lined && kind !== 'frost' ? crackSprite(kind, v, '#1c0a1e', true) : null;
    const lineG = lined ? crackSprite(kind, v, color, false) : null;
    const rb = r * 0.8;
    this.add(dur, (ctx, k) => {
      const a = k < 0.03 ? k / 0.03 : k > 0.45 ? 1 - (k - 0.45) / 0.55 : 1;
      const heat = Math.max(0, 1 - k * cool);
      ctx.save();
      if (kind === 'splash') { ctx.globalAlpha = a * 0.5; ctx.drawImage(wet, x - r, y - r * sq, r * 2, r * 2 * sq); }
      else if (kind === 'scorch' || (kind === 'crack' && r >= 50)) { ctx.globalAlpha = a * (o.alpha ?? 0.75) * (kind === 'crack' ? 0.6 : 1); ctx.drawImage(dark, x - rb * 0.7, y - rb * 0.7 * sq, rb * 1.4, rb * 1.4 * sq); }
      if (lined) {
        ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1);
        if (lineD) { ctx.globalAlpha = a * 0.85; ctx.drawImage(lineD, -r, -r * sq, r * 2, r * 2 * sq); }
        const h = kind === 'frost' ? a * (0.6 + 0.4 * heat) : heat * a;
        ctx.globalCompositeOperation = 'lighter';
        if (h > 0.04) { ctx.globalAlpha = h; ctx.drawImage(lineG, -r, -r * sq, r * 2, r * 2 * sq); }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
      const hh = kind === 'frost' ? a * 0.55 : heat * a * 0.8;
      if (hh > 0.04 && !this.low) { ctx.globalAlpha = hh; ctx.drawImage(hot, x - r * 0.7, y - r * 0.7 * sq, r * 1.4, r * 1.4 * sq); }
      ctx.restore();
    }, 'back');
  }
  // cercle magique au sol (sprite pré-rendu, aplati et en rotation)
  glyph(x, y, o = {}) {
    const spr = runeSprite(o.color || '#ffd23f', o.color2 || WHITE, o.style || 'rune');
    const r0 = o.r ?? 50, sq = o.squash ?? 0.32, spin = o.spin ?? 1.2, dur = o.dur ?? 1, rot0 = Math.random() * TAU;
    this.add(dur, (ctx, k) => {
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const r = r0 * (0.7 + 0.3 * Math.min(1, k * 5));
      const px = typeof x === 'function' ? x() : x;
      ctx.save(); ctx.globalAlpha = a * (o.alpha ?? 0.9);
      if (o.add) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(px, y); ctx.scale(1, sq); ctx.rotate(rot0 + k * dur * spin);
      ctx.drawImage(spr, -r, -r, r * 2, r * 2);
      ctx.restore();
    }, o.layer || 'back');
  }
  // assombrit le décor (sous les combattants) pour faire ressortir les gros sorts ; ne se cumule pas
  dim(o = {}) {
    const a1 = o.a ?? 0.35, col = o.color || '#0b0420', dur = o.dur ?? 0.8, fin = o.in ?? 0.1, fout = o.out ?? 0.35;
    const D = this._dim;
    if (D && D.t < D.dur && this.items.includes(D)) { D.dur = Math.max(D.dur, D.t + dur); D.a1 = Math.max(D.a1, a1); return D; }
    const it = this.add(dur, (ctx) => {
      const t = it.t;
      const a = t < fin ? t / fin : t > it.dur - fout ? Math.max(0, (it.dur - t) / fout) : 1;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a * it.a1; ctx.fillStyle = it.col; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
    }, 'bg');
    it.a1 = a1; it.col = col;
    this._dim = it;
    return it;
  }
  // concentration d'énergie (anticipation) : halo qui grossit, anneau qui se resserre, étincelles aspirées
  charge(pos, o = {}) {
    const color = o.color || '#ffffff', c2 = o.color2 || '#ffffff', R = o.r ?? 26, S = o.size ?? 14, dur = o.dur ?? 0.3, rate = o.rate ?? 1;
    const gl = sprite(color, 'glow'), fl = sprite(c2, 'flare');
    const P = typeof pos === 'function' ? pos : () => pos;
    let tick = 0;
    this.add(dur, (ctx, k) => {
      const p = P(), x = p[0], y = p[1];
      const s = S * (0.3 + 0.7 * k) * (1 + Math.sin(k * 44) * 0.08);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, k * 3); ctx.drawImage(gl, x - s, y - s, s * 2, s * 2);
      ctx.globalAlpha = k * 0.9; ctx.drawImage(fl, x - s * 1.4, y - s * 1.4, s * 2.8, s * 2.8);
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, R * (1 - k) + 2, 0, TAU); ctx.lineWidth = 1 + k * 1.5; ctx.strokeStyle = ca(c2, 0.55 * k); ctx.stroke();
      ctx.restore();
    }, o.layer || 'front', () => {
      tick++;
      if (this.low && tick % 2) return;
      const p = P();
      for (let i = 0; i < rate; i++) {
        const a = Math.random() * TAU, r = R * (0.8 + Math.random() * 0.6);
        this.emit(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, -Math.cos(a) * r * 5, -Math.sin(a) * r * 5, Math.random() < 0.5 ? color : c2, 2.5 + Math.random() * 2, 0.2, { shape: 'spark', drag: 0 });
      }
    });
  }

  text(x, y, str, style = 'dmg') {
    const S = TEXT_STYLE[style] || TEXT_STYLE.dmg;
    this.texts.push({ x: x + (Math.random() - 0.5) * 16, y, str, S, t: 0, bmp: null, bw: 0, bh: 0, res: 1 });
    if (this.texts.length > 42) freeText(this.texts.shift());
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        const j = --this.n;
        if (i !== j) {
          this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.size1[i] = this.size1[j];
          this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.rot[i] = this.rot[j]; this.vr[i] = this.vr[j];
          this.alpha[i] = this.alpha[j]; this.kind[i] = this.kind[j]; this.col[i] = this.col[j]; this.spr[i] = this.spr[j]; this.sq[i] = this.sq[j];
        }
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
      i++;
    }
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      it.t += dt;
      const done = it.t >= it.dur;
      if (it.upd) it.upd(Math.min(1, it.t / it.dur), done, dt);
      if (done) this.items.splice(k, 1);
    }
    for (let k = this.texts.length - 1; k >= 0; k--) {
      const x = this.texts[k];
      x.t += dt;
      if (x.t > x.S.dur) { freeText(x); this.texts.splice(k, 1); }
    }
  }

  drawItems(ctx, layer) {
    const its = this.items;
    if (layer === 'back') for (let i = 0; i < its.length; i++) { const it = its[i]; if (it.layer === 'bg' && it.draw) it.draw(ctx, Math.min(1, it.t / it.dur)); }
    for (let i = 0; i < its.length; i++) { const it = its[i]; if (it.layer === layer && it.draw) it.draw(ctx, Math.min(1, it.t / it.dur)); }
  }
  drawParticles(ctx) {
    const n = this.n;
    if (!n) return;
    const m = ctx.getTransform();
    const A = m.a, Bm = m.b, C = m.c, D = m.d, E = m.e, F = m.f;
    // passe normale (fumée, débris, feuilles, pétales)
    for (let i = 0; i < n; i++) {
      const kd = this.kind[i];
      if (!NORMAL[kd]) continue;
      const k = this.life[i] / this.max[i];
      let a = this.alpha[i] * (1 - k);
      if (kd === 4 && k < 0.12) a *= k / 0.12;
      if (a <= 0.01) continue;
      const s = this.size[i] + (this.size1[i] - this.size[i]) * k;
      const x = this.px[i], y = this.py[i];
      ctx.globalAlpha = a;
      if (kd === 4) {
        ctx.setTransform(A, Bm, C, D, A * x + C * y + E, Bm * x + D * y + F);
        const sy = s * this.sq[i];
        ctx.drawImage(this.spr[i], -s, -sy, s * 2, sy * 2);
      } else {
        const r = this.rot[i], cs = Math.cos(r), sn = Math.sin(r);
        ctx.setTransform(A * cs + C * sn, Bm * cs + D * sn, C * cs - A * sn, D * cs - Bm * sn, A * x + C * y + E, Bm * x + D * y + F);
        if (kd === 3) { ctx.fillStyle = this.col[i]; ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7); }
        else { const fl = Math.max(0.2, Math.abs(Math.cos(this.life[i] * 8 + i))); ctx.drawImage(this.spr[i], -s * fl, -s, s * 2 * fl, s * 2); }
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const kd = this.kind[i];
      if (NORMAL[kd]) continue;
      const k = this.life[i] / this.max[i];
      let a = this.alpha[i] * (k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9);
      if (kd === 7) a *= 0.55 + 0.45 * Math.sin(this.life[i] * 26 + i * 1.7);
      if (a <= 0.01) continue;
      const s = this.size[i] + (this.size1[i] - this.size[i]) * k;
      const x = this.px[i], y = this.py[i];
      ctx.globalAlpha = a > 1 ? 1 : a;
      if (kd === 2 || kd === 8) {
        const vx = this.vx[i], vy = this.vy[i], sp = Math.hypot(vx, vy);
        const cs = sp > 1e-3 ? vx / sp : 1, sn = sp > 1e-3 ? vy / sp : 0;
        const len = s * (kd === 2 ? 0.8 : 1.1) + sp * 0.045, w = s * (kd === 2 ? 0.55 : 0.9);
        ctx.setTransform(A * cs + C * sn, Bm * cs + D * sn, C * cs - A * sn, D * cs - Bm * sn, A * x + C * y + E, Bm * x + D * y + F);
        ctx.drawImage(this.spr[i], -len, -w / 2, len * 1.3, w);
      } else if (kd === 1 || kd === 6 || kd === 9 || kd === 13) {
        const r = kd === 1 ? this.rot[i] * 0.3 : kd === 13 ? Math.sin(this.rot[i]) * 0.3 : kd === 6 ? this.rot[i] * 0.15 : this.rot[i];
        const cs = Math.cos(r), sn = Math.sin(r);
        ctx.setTransform(A * cs + C * sn, Bm * cs + D * sn, C * cs - A * sn, D * cs - Bm * sn, A * x + C * y + E, Bm * x + D * y + F);
        ctx.drawImage(this.spr[i], -s, -s, s * 2, s * 2);
      } else {
        ctx.setTransform(A, Bm, C, D, A * x + C * y + E, Bm * x + D * y + F);
        const sy = s * this.sq[i];
        ctx.drawImage(this.spr[i], -s, -sy, s * 2, sy * 2);
      }
    }
    ctx.setTransform(m);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // chiffres et étiquettes : chaque texte est rendu une seule fois dans une image (réserve recyclée)
  drawTexts(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; // état laissé au contexte, comme avant
    if (!this.texts.length) return;
    const m = ctx.getTransform();
    const res = Math.min(4, Math.max(1, Math.hypot(m.a, m.b)));
    for (const x of this.texts) {
      const S = x.S, k = x.t / S.dur;
      if (!x.bmp || x.res < res * 0.8) renderText(x, res);
      const pop = x.t < 0.12 ? 1.7 - (x.t / 0.12) * 0.7 : 1;
      const y = x.y - (x.t < 0.12 ? 0 : (x.t - 0.12) * 46);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const w = (x.bw / x.res) * pop, h = (x.bh / x.res) * pop;
      ctx.drawImage(x.bmp, 0, 0, x.bw, x.bh, x.x - w / 2, y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }
}
const TPOOL = [];
function freeText(x) { if (x.bmp) { TPOOL.push(x.bmp); x.bmp = null; } }
function renderText(x, res) {
  freeText(x);
  const S = x.S;
  const c = TPOOL.pop() || document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `${S.size}px "Lilita One", "Baloo 2", system-ui, sans-serif`;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = font;
  const tw = g.measureText(x.str).width;
  const wu = tw + (S.bg ? 12 : 0) + S.size * 0.6, hu = S.size * 1.6;
  const bw = Math.ceil(wu * res), bh = Math.ceil(hu * res);
  if (c.width < bw || c.height < bh) { c.width = Math.max(c.width, bw); c.height = Math.max(c.height, bh); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw + 2, bh + 2);
  g.setTransform(res, 0, 0, res, (bw / 2), (bh / 2));
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (S.bg) {
    const w = tw + 12;
    g.fillStyle = S.bg; g.beginPath(); if (g.roundRect) g.roundRect(-w / 2, -S.size * 0.62, w, S.size * 1.24, 6); else g.rect(-w / 2, -S.size * 0.62, w, S.size * 1.24); g.fill();
  }
  g.lineWidth = S.size * 0.28; g.strokeStyle = S.stroke; g.strokeText(x.str, 0, 0);
  if (S.grad) { const gr = g.createLinearGradient(0, -S.size / 2, 0, S.size / 2); gr.addColorStop(0, S.grad[0]); gr.addColorStop(1, S.grad[1]); g.fillStyle = gr; } else g.fillStyle = S.fill;
  g.fillText(x.str, 0, 0);
  x.bmp = c; x.bw = bw; x.bh = bh; x.res = res;
}
export { shade };
