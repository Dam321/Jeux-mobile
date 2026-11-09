// =====================================================================
//  Ennemis 2 — « Les Nuisibles » des 7 nouvelles cartes (14 ennemis + 7 boss).
//  Canvas 2D, vue de côté, tout est dessiné par le code (voir STYLE.md).
//  Repère local : pieds en y = 0, y vers le bas, x = 0 au centre.
//  LES ENNEMIS REGARDENT VERS LA GAUCHE (x négatif).
//  4 images d'animation (frame % 4) et 4 variantes d'ère :
//    0 normal · 1 Élite (armure / pointes dorées)
//    2 Corrompu (violet / vert toxique, yeux verts luisants, fissures)
//    3 Infernal (calciné rouge / noir, yeux orange, petites flammes)
// =====================================================================
import {
  OUT, shade, mix, rgba, seeded, ell, rr, smooth, poly, paint, gloss, glow, cel,
  makeSprite, spriteURL,
} from './draw.js';

export const ENEMY_KINDS2 = ['scorpion', 'mummy', 'monkey', 'snake', 'shark', 'puffer', 'bat', 'skeleton', 'gearbot', 'can', 'crow', 'stormcloud', 'gummy', 'cupcake'];
export const BOSS_KINDS2 = ['pharaohRat', 'gorilla', 'kraken', 'vampDog', 'megaMixer', 'thunderBird', 'candyQueen'];

const TAU = Math.PI * 2;
const LW = 3; // contour des grandes formes
const LD = 2; // contour des détails
const TOOTH = '#fffbea';
const MOUTH = '#5a1430';
const TONGUE = '#ff6f8e';

// ------------------------------------------------------------ palettes de variantes
function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex) { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
// Recolore en gardant la valeur (clair/foncé) : la luminance choisit la teinte sur une rampe.
function ramp(hex, stops, lo = 0.08, hi = 0.92) {
  let t = (lo + lum(hex) * (hi - lo)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.max(0, Math.floor(t)));
  return mix(stops[i], stops[i + 1], Math.min(1, Math.max(0, t - i)));
}
const R_CORR = ['#160a22', '#46206e', '#8e4fca', '#dcbcff'];
const R_CORR_ALT = ['#0a1d0b', '#21641b', '#62c734', '#dcffb4'];
const R_CORR_ACC = ['#1d5410', '#4fcc24', '#a6ff48', '#f2ffd8'];
const R_INF = ['#0e0506', '#3e0c10', '#8e1f1a', '#e0553a'];
const R_INF_ALT = ['#0b0809', '#262024', '#4a3d41', '#8f7f7e'];
const R_INF_ACC = ['#3b0c02', '#d0460b', '#ff9b22', '#ffeaa6'];
const R_GOLD = ['#3d2405', '#b5770c', '#ffc832', '#fff4c2'];
const GOLD = '#ffc832';
const TOXIC = '#a4ff3c';
const EMBER = '#ff8a1f';

// main : matière principale (corps) · alt : matières secondaires (ventre, habits, métal…)
// acc : couleur(s) d'accent. Les blancs (dents, yeux) ne passent pas par ici.
function pal(v, main, alt = {}, acc = {}, fixed = {}) {
  const P = { v };
  for (const k in fixed) P[k] = fixed[k][v] ?? fixed[k][0];
  const put = (o, f) => { for (const k in o) P[k] = f(o[k]); };
  if (v === 2) {
    put(main, (c) => mix(ramp(c, R_CORR), c, 0.08));
    put(alt, (c) => ramp(c, R_CORR_ALT));
    put(acc, (c) => ramp(c, R_CORR_ACC, 0.35, 0.95));
  } else if (v === 3) {
    put(main, (c) => ramp(c, R_INF, 0.2, 0.92));
    put(alt, (c) => ramp(c, R_INF_ALT, 0.12, 0.92));
    put(acc, (c) => ramp(c, R_INF_ACC, 0.35, 0.95));
  } else if (v === 1) {
    put(main, (c) => c); put(alt, (c) => c);
    put(acc, (c) => ramp(c, R_GOLD, 0.42, 0.95));
  } else {
    put(main, (c) => c); put(alt, (c) => c); put(acc, (c) => c);
  }
  P.glowEye = v === 2 ? TOXIC : v === 3 ? '#ffa526' : null;
  P.fx = v === 2 ? TOXIC : v === 3 ? EMBER : GOLD;
  return P;
}

// ------------------------------------------------------------ animation (4 images)
// s : 0,1,0,-1 · c : 1,0,-1,0 · up : 0,1,0,1 (mi-pas) · sq : +1 contact (écrasé) / -1 mi-pas (étiré)
function A(frame) {
  const f = ((Math.floor(frame) || 0) % 4 + 4) % 4;
  const ph = f * Math.PI / 2;
  const s = Math.round(Math.sin(ph)), c = Math.round(Math.cos(ph));
  return { f, ph, s, c, up: Math.abs(s), sq: c !== 0 ? 1 : -1 };
}
// Écrasement / étirement autour d'un point (souvent la base, au sol).
function squash(ctx, cx, cy, sx, sy) { ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy); }

// ------------------------------------------------------------ courbes
function spline(pts, n = 8) {
  const out = [];
  const N = pts.length;
  if (N < 3) {
    if (N < 2) return pts.map((p) => p.slice());
    for (let k = 0; k <= n; k++) out.push([pts[0][0] + (pts[1][0] - pts[0][0]) * k / n, pts[0][1] + (pts[1][1] - pts[0][1]) * k / n]);
    return out;
  }
  for (let i = 0; i < N - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, N - 1)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t
        + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[N - 1].slice());
  return out;
}
// Trait effilé (queue, bras, tentacule…) de largeur w0 → w1, bouts arrondis.
function taper(ctx, pts, w0, w1 = w0, n = 8) {
  const s = spline(pts, n);
  const L = [], R = [], T = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(i - 1, 0)], b = s[Math.min(i + 1, s.length - 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
    const w = (w0 + (w1 - w0) * (i / (s.length - 1))) / 2;
    L.push([s[i][0] - ty * w, s[i][1] + tx * w]);
    R.push([s[i][0] + ty * w, s[i][1] - tx * w]);
    T.push([tx, ty]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  const e = s[s.length - 1], te = T[T.length - 1];
  const aL = Math.atan2(te[0], -te[1]);
  ctx.arc(e[0], e[1], Math.max(w1 / 2, 0.01), aL, aL - Math.PI, true);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  const t0 = T[0], aR = Math.atan2(-t0[0], t0[1]);
  ctx.arc(s[0][0], s[0][1], Math.max(w0 / 2, 0.01), aR, aR - Math.PI, true);
  ctx.closePath();
}
// Point et tangente le long d'une courbe (t ∈ [0,1])
function along(pts, t) {
  const s = spline(pts, 10);
  const i = Math.min(s.length - 2, Math.max(0, Math.round(t * (s.length - 1))));
  const a = s[i], b = s[i + 1];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: a[0], y: a[1], tx: (b[0] - a[0]) / d, ty: (b[1] - a[1]) / d };
}
// Bande qui suit un arc d'ellipse (bandeau, col, couronne…), angles canvas (−π/2 = haut)
function arcBand(ctx, cx, cy, rx, ry, a0, a1, out, inn, n = 18) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(t) * (rx + out), cy + Math.sin(t) * (ry + out)); }
  for (let i = n; i >= 0; i--) { const t = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(t) * (rx - inn), cy + Math.sin(t) * (ry - inn)); }
  ctx.closePath();
}
function onEll(cx, cy, rx, ry, t, d = 0) { return [cx + Math.cos(t) * (rx + d), cy + Math.sin(t) * (ry + d)]; }
function clipTo(ctx, path, fn) { ctx.save(); path(); ctx.clip(); fn(); ctx.restore(); }
function fillA(ctx, color, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
function line(ctx, pts, w, col = OUT, closed = false) {
  smooth(ctx, pts, closed);
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

// ------------------------------------------------------------ remplissages « cel »
function C(ctx, shape, base, cx, cy, size, o = {}) { cel(ctx, shape, base, { cx, cy, size, ...o }); }
function blob(ctx, pts, base, cx, cy, size, o = {}) { cel(ctx, () => smooth(ctx, pts), base, { cx, cy, size, ...o }); }
function oval(ctx, x, y, rx, ry, base, o = {}) {
  cel(ctx, () => ell(ctx, x, y, rx, ry, o.rot || 0), base, { cx: x, cy: y, size: Math.max(rx, ry), ...o });
}
// Membre / queue effilé, ombré en cel.
function limb(ctx, pts, w0, w1, base, o = {}) {
  const m = pts[Math.floor(pts.length / 2)];
  cel(ctx, () => taper(ctx, pts, w0, w1), base, {
    cx: m[0], cy: m[1], size: Math.max(w0, w1) * 1.15, hi: o.hi ?? 0, glint: false, lw: o.lw ?? LW, depth: o.depth ?? 0.24, shadow: o.shadow,
  });
}

// ------------------------------------------------------------ visages
// Gros œil expressif. inner : +1 si le coin intérieur (côté nez/centre du visage) est à droite.
// anger > 0 : paupière en pente (fâché), < 0 : triste/narquois. blink ∈ [0,1] ferme l'œil.
function eye(ctx, P, x, y, rx, ry, o = {}) {
  const {
    inner = 1, anger = 0.5, look = [-0.55, 0.05], iris = '#46245e', lid = '#c9b6a0', blink = 0,
    lw = 2.2, pr = 0.62, slit = false, noGlow = false, glowR = 2.3, irisFn = null,
  } = o;
  const gl = noGlow ? null : (o.glow || P.glowEye);
  if (gl) glow(ctx, x, y, Math.max(rx, ry) * glowR, gl, 0.7);
  const path = () => ell(ctx, x, y, rx, ry);
  path(); ctx.fillStyle = gl ? mix(gl, '#ffffff', 0.72) : '#ffffff'; ctx.fill();
  ctx.save();
  path(); ctx.clip();
  // ombre de la paupière (cel)
  ell(ctx, x + rx * 0.25, y - ry * 1.05, rx * 1.45, ry * 0.72);
  ctx.fillStyle = gl ? rgba(gl, 0.45) : 'rgba(120,105,190,0.28)'; ctx.fill();
  const px = x + look[0] * rx * 0.42, py = y + look[1] * ry * 0.45 + ry * 0.1;
  const ic = gl || iris;
  if (irisFn) irisFn(px, py, rx * pr, ry * pr, ic);
  else {
    ell(ctx, px, py, rx * pr, ry * pr * 1.06); ctx.fillStyle = shade(ic, -0.25); ctx.fill();
    ell(ctx, px - rx * pr * 0.1, py - ry * pr * 0.12, rx * pr * 0.86, ry * pr * 0.9); ctx.fillStyle = ic; ctx.fill();
    if (slit || gl) { ell(ctx, px, py, rx * pr * 0.24, ry * pr * 0.82); ctx.fillStyle = OUT; ctx.fill(); }
    else { ell(ctx, px, py + ry * 0.03, rx * pr * 0.55, ry * pr * 0.6); ctx.fillStyle = OUT; ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    ell(ctx, px - rx * pr * 0.42, py - ry * pr * 0.42, rx * 0.22, ry * 0.18, -0.4); ctx.fill();
    ell(ctx, px + rx * pr * 0.38, py + ry * pr * 0.42, rx * 0.1, ry * 0.08); ctx.fill();
  }
  // paupière supérieure (humeur + clignement)
  const xo = x - inner * rx * 1.3, xi = x + inner * rx * 1.3;
  const yo = y - ry * 1.08 + ry * 2.16 * blink;
  const yi = yo + anger * ry * 1.4 * (1 - blink);
  if (blink > 0 || anger !== 0) {
    poly(ctx, [[xo, yo], [xi, yi], [xi, y - ry * 3], [xo, y - ry * 3]]);
    ctx.fillStyle = lid; ctx.fill();
    ctx.beginPath(); ctx.moveTo(xo, yo); ctx.lineTo(xi, yi);
    ctx.lineWidth = lw * 1.3; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.restore();
  path(); paint(ctx, null, lw);
}
// Sourcil épais : du bout extérieur (x0,y0) vers l'intérieur (x1,y1), plus épais à l'intérieur.
function brow(ctx, x0, y0, x1, y1, w = 4, col = OUT, bend = -1.4) {
  taper(ctx, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 + bend], [x1, y1]], w * 0.5, w);
  ctx.fillStyle = col; ctx.fill();
}
// Croc : base (x,y), pointe vers le bas si h > 0.
function fang(ctx, x, y, w, h, lw = 1.6) {
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
  ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.6, x, y + h); ctx.quadraticCurveTo(x - w * 0.25, y + h * 0.5, x - w / 2, y);
  ctx.closePath(); paint(ctx, TOOTH, lw);
}
function blush(ctx, x, y, rx = 4.5, ry = 2.6, a = 0.4, col = '#ff5d8f') { ell(ctx, x, y, rx, ry); fillA(ctx, col, a); }
function sparkle(ctx, x, y, r, color = '#ffffff', a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill(); ctx.restore();
}

// ------------------------------------------------------------ décors de variantes
function goldSpike(ctx, x, y, a, L, w = L * 0.62, col = GOLD) {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const pts = [[x + nx * w / 2, y + ny * w / 2], [x + dx * L, y + dy * L], [x - nx * w / 2, y - ny * w / 2]];
  C(ctx, () => { poly(ctx, pts); }, col, x + dx * L * 0.35, y + dy * L * 0.35, L * 0.55, { lw: LD, glint: false, hi: 0.3 });
}
function shard(ctx, x, y, a, L) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
  const w = L * 0.34;
  glow(ctx, 0, -L * 0.5, L * 0.9, TOXIC, 0.45);
  poly(ctx, [[-w, 1], [-w * 0.9, -L * 0.55], [0, -L], [w * 0.9, -L * 0.55], [w, 1]]); paint(ctx, '#62d334', LD);
  poly(ctx, [[-w * 0.55, 0], [-w * 0.5, -L * 0.52], [0, -L * 0.88], [0, 0]]); ctx.fillStyle = '#d8ff9c'; ctx.fill();
  ctx.restore();
}
function flame(ctx, x, y, a, L, k = 0) {
  L *= 1 + 0.2 * Math.sin(k * 1.9 + 0.7);
  const sw = 0.28 * Math.sin(k * 2.4 + 1.1);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
  const w = L * 0.44;
  glow(ctx, 0, -L * 0.35, L * 1.0, '#ff5a14', 0.5);
  const sh = (s) => {
    ctx.beginPath(); ctx.moveTo(0, w * 0.35 * s);
    ctx.bezierCurveTo(w * 1.1 * s, w * 0.2 * s, w * 0.8 * s, -L * 0.45 * s, sw * L * s, -L * s);
    ctx.bezierCurveTo(-w * 0.6 * s, -L * 0.5 * s, -w * 1.1 * s, w * 0.1 * s, 0, w * 0.35 * s);
    ctx.closePath();
  };
  sh(1); paint(ctx, '#ff5a1a', LD);
  ctx.save(); ctx.translate(0, w * 0.15); sh(0.62); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.restore();
  ctx.restore();
}
// Pointes dorées (Élite), éclats toxiques (Corrompu) ou flammes (Infernal) : [[x, y, angle, longueur]]
function crest(ctx, P, list, f = 0) {
  if (!P.v) return;
  list.forEach(([x, y, a, L], i) => {
    if (P.v === 1) goldSpike(ctx, x, y, a, L);
    else if (P.v === 2) shard(ctx, x, y, a, L * 0.95);
    else flame(ctx, x, y, a, L * 1.3, f + i * 1.7);
  });
}
// Fissures luisantes (Corrompu : vert, Infernal : lave). Départs choisis dans [a0, a1].
function cracks(ctx, P, shape, x, y, r, seed = 1, n = 3, a0 = -Math.PI, a1 = Math.PI) {
  if (P.v < 2) return;
  const col = P.v === 2 ? TOXIC : '#ffa22a';
  const R = seeded(seed * 7919 + 13);
  clipTo(ctx, shape, () => {
    for (let i = 0; i < n; i++) {
      const st = a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)) + (R() - 0.5) * 0.3;
      let px = x + Math.cos(st) * r * 1.1, py = y + Math.sin(st) * r * 1.1;
      let a = st + Math.PI + (R() - 0.5) * 0.6;
      const len = r * (0.55 + R() * 0.3);
      const pts = [[px, py]];
      for (let j = 0; j < 4; j++) { a += (R() - 0.5) * 1.4; px += Math.cos(a) * len / 4; py += Math.sin(a) * len / 4; pts.push([px, py]); }
      const br = [pts[2], [pts[2][0] + Math.cos(a + 1.2) * len * 0.3, pts[2][1] + Math.sin(a + 1.2) * len * 0.3]];
      for (const p of [pts, br]) {
        poly(ctx, p, false); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = 5; ctx.strokeStyle = rgba(col, 0.3); ctx.stroke();
        ctx.lineWidth = 2.4; ctx.strokeStyle = mix(col, '#000000', 0.72); ctx.stroke();
        ctx.lineWidth = 1.1; ctx.strokeStyle = mix(col, '#ffffff', 0.35); ctx.stroke();
      }
    }
  });
}
// Bulles toxiques (Corrompu) ou braises (Infernal) qui montent.
function motes(ctx, P, pts, f = 0) {
  if (P.v < 2) return;
  pts.forEach(([x, y, r], i) => {
    const k = (f + i) % 4;
    const yy = y - k * 3.2, xx = x + Math.sin((f + i) * 1.7) * 1.5;
    if (P.v === 2) {
      ell(ctx, xx, yy, r, r); paint(ctx, rgba('#8ee83a', 0.75), 1.4, '#2e6a14');
      ell(ctx, xx - r * 0.35, yy - r * 0.35, r * 0.3, r * 0.25); ctx.fillStyle = '#efffd2'; ctx.fill();
    } else {
      glow(ctx, xx, yy, r * 3, EMBER, 0.8);
      ell(ctx, xx, yy, r * 0.65, r * 0.65); ctx.fillStyle = '#ffe08a'; ctx.fill();
    }
  });
}
// Goutte de bave toxique (Corrompu)
function drip(ctx, x, y, L, col = '#7be03a') {
  ctx.beginPath(); ctx.moveTo(x - 2.4, y);
  ctx.quadraticCurveTo(x - 2.6, y + L * 0.6, x - 2.4, y + L * 0.75);
  ctx.arc(x, y + L * 0.75, 2.4, Math.PI, 0, true);
  ctx.quadraticCurveTo(x + 2.6, y + L * 0.6, x + 2.4, y);
  ctx.closePath(); paint(ctx, col, 1.6);
  ell(ctx, x - 0.8, y + L * 0.72, 0.7, 1); ctx.fillStyle = '#efffd2'; ctx.fill();
}
// Plaque d'armure dorée (Élite) avec rivets.
function goldPlate(ctx, shape, cx, cy, size, rivets = []) {
  C(ctx, shape, GOLD, cx, cy, size, { lw: LD + 0.5, hi: 0.32 });
  for (const [x, y] of rivets) { ell(ctx, x, y, 1.5, 1.5); paint(ctx, '#fff1b0', 1.2); }
}

// =====================================================================
//  DÉSERT — Scorpion des sables
// =====================================================================
// Pince (pointe vers la gauche) : paume + doigt fixe + doigt mobile qui s'ouvre (open, rad).
function claw(ctx, x, y, rot, k, open, col, dark = shade(col, -0.2)) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.save(); ctx.translate(-6, 3); ctx.rotate(-open);
  const low = [[1, -2], [-8, -3.5], [-15, 0], [-9, 3.5], [1, 4]];
  blob(ctx, low, dark, -6, 0, 7, { lw: LD + 0.5, hi: 0, glint: false });
  ctx.restore();
  oval(ctx, 0, 0, 10, 8, col, { lw: LW });
  blob(ctx, [[-4, -7], [-13, -8.5], [-21, -3], [-15, -1], [-5, 0]], col, -12, -4, 7, { lw: LD + 0.5, hi: 0.15 });
  ctx.restore();
}
function drawScorpion(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { shell: '#f2a53a', claw: '#ea8f2c' }, { belly: '#ffe2a2', sting: '#6a2c8a', leg: '#c8742a' }, { acc: '#e8344a' });
  const by = -a.up * 1.6;
  // ---- pattes (3 paires) : arrière-plan
  const legs = (near) => {
    for (let i = 0; i < 3; i++) {
      const hx = [-2, 8, 18][i] + (near ? 0 : 5), sg = ((i + (near ? 0 : 1)) % 2 ? 1 : -1);
      const dx = sg * a.c * 3.5, lift = Math.max(0, sg * a.s) * 4;
      const kx = hx + [-7, -1, 6][i], fx = hx + [-13, -2, 11][i] + dx;
      const col = near ? P.leg : shade(P.leg, -0.25);
      limb(ctx, [[hx, -14 + by], [kx + dx * 0.4, -25 + by - lift * 0.5], [fx, -2 - lift]], near ? 5.5 : 4.5, 2.2, col, { lw: 2.4 });
    }
  };
  legs(false);
  // ---- queue segmentée
  const sw = a.s * 0.06;
  const rot = (x, y) => { const ox = 26, oy = -18 + by, c = Math.cos(sw), s = Math.sin(sw); return [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]; };
  const tail = [[26, -18], [37, -27], [42, -41], [38, -55], [28, -64], [15, -65]].map(([x, y]) => rot(x, y + by));
  const rs = [9, 8.4, 7.8, 7.2, 6.6, 6];
  tail.forEach(([x, y], i) => oval(ctx, x, y, rs[i], rs[i] * 0.92, i % 2 ? P.shell : shade(P.shell, -0.05), { lw: LW }));
  // dard
  const [tx, ty] = tail[5];
  oval(ctx, tx - 7, ty + 1, 7, 6.2, P.sting, { lw: LW });
  limb(ctx, [[tx - 11, ty + 3], [tx - 16, ty + 7], [tx - 17, ty + 13]], 5, 1.6, P.sting, { lw: LD + 0.5 });
  ell(ctx, tx - 17, ty + 16, 1.8, 2.4); paint(ctx, v === 3 ? EMBER : '#b8ff5a', 1.4);
  // ---- abdomen
  const body = [[-8, -33], [8, -36], [24, -31], [31, -20], [27, -10], [10, -7], [-6, -9]].map(([x, y]) => [x, y + by]);
  const bodyS = () => smooth(ctx, body);
  C(ctx, bodyS, P.shell, 10, -22 + by, 18);
  clipTo(ctx, bodyS, () => {
    ell(ctx, 10, -6 + by, 22, 6); ctx.fillStyle = shade(P.belly, -0.1); ctx.fill();
    for (const x of [6, 14, 22]) line(ctx, [[x - 2, -36 + by], [x + 1, -22 + by], [x - 1, -8 + by]], 2, shade(P.shell, -0.35));
  });
  cracks(ctx, P, bodyS, 12, -22 + by, 16, 3, 2, -2.4, -0.6);
  legs(true);
  // ---- pince arrière (levée, menaçante)
  const o1 = [0.15, 0.45, 0.6, 0.3][a.f], o2 = [0.55, 0.25, 0.08, 0.35][a.f];
  limb(ctx, [[-14, -34 + by], [-24, -44 + by], [-32, -46 + by + a.s]], 7, 6, shade(P.claw, -0.18), { lw: LW });
  claw(ctx, -36, -48 + by + a.s, 0.35, 0.82, o1, shade(P.claw, -0.12));
  // ---- tête
  const hx = -16, hy = -28 + by, hrx = 20, hry = 17;
  const head = () => ell(ctx, hx, hy, hrx, hry);
  C(ctx, head, P.shell, hx, hy, 19);
  clipTo(ctx, head, () => { ell(ctx, hx - 7, hy + 14, 15, 8); ctx.fillStyle = P.belly; ctx.fill(); });
  head(); paint(ctx, null, LW);
  // bandana de bandit (+ nœud qui flotte)
  const knot = onEll(hx, hy, hrx, hry, -0.42, 1);
  limb(ctx, [knot, [knot[0] + 8, knot[1] - 4 + a.s * 1.5], [knot[0] + 15, knot[1] - 3 + a.s * 3]], 5.5, 3.5, shade(P.acc, -0.12), { lw: LD + 0.5 });
  limb(ctx, [knot, [knot[0] + 7, knot[1] + 3 - a.s], [knot[0] + 12, knot[1] + 7 - a.s * 2]], 5, 3.4, shade(P.acc, -0.22), { lw: LD + 0.5 });
  C(ctx, () => arcBand(ctx, hx, hy, hrx, hry, -2.75, -0.42, 2, 5), P.acc, hx - 4, hy - 16, 12, { lw: LD + 0.5 });
  for (const t of [-2.45, -1.95, -1.45, -0.95]) { const [px, py] = onEll(hx, hy, hrx, hry, t, -1.4); ell(ctx, px, py, 1.3, 1.3); ctx.fillStyle = '#fff6e8'; ctx.fill(); }
  oval(ctx, knot[0], knot[1], 3.6, 3.4, P.acc, { lw: LD, hi: 0, glint: false });
  // visage
  const blink = a.f === 3 ? 0.55 : 0;
  eye(ctx, P, -28.5, -30 + by, 4.6, 5.8, { inner: 1, anger: 0.55, lid: P.shell, iris: '#3a1a5a', blink });
  eye(ctx, P, -16, -31 + by, 6, 7.4, { inner: -1, anger: 0.55, lid: P.shell, iris: '#3a1a5a', blink });
  brow(ctx, -34, -38.5 + by, -25.5, -35 + by, 3.4);
  brow(ctx, -8, -41 + by, -19.5, -37.5 + by, 4);
  // sourire en coin + mandibules
  line(ctx, [[-36, -20 + by], [-29, -18 + by], [-22, -18.5 + by], [-18.5, -22 + by]], 2.2);
  fang(ctx, -32.5, -19 + by, 3, 4);
  fang(ctx, -26.5, -18.2 + by, 2.6, 3.4);
  blush(ctx, -12, -21 + by, 4, 2.2, 0.3);
  // ---- pince avant
  limb(ctx, [[-24, -16 + by], [-33, -15 + by], [-38, -17 + by - a.s * 0.5]], 7.5, 6.5, P.claw, { lw: LW });
  claw(ctx, -42, -18 + by - a.s * 0.5, -0.12, 0.95, o2, P.claw);
  // ---- variantes
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[0, -34 + by], [10, -37 + by], [22, -33 + by], [22, -27 + by], [10, -30 + by], [0, -28 + by]]), 11, -32 + by, 10, [[6, -32 + by], [16, -32 + by]]);
  }
  crest(ctx, P, [[4, -35 + by, -1.75, 8], [14, -36 + by, -1.5, 9], [23, -32 + by, -1.15, 8],
    ...tail.slice(1, 4).map(([x, y], i) => [x + 5, y - 2, -0.6 + i * 0.5, 7])], a.f);
  motes(ctx, P, [[44, -70, 2.2], [-4, -52, 1.8], [36, -8, 1.6]], a.f);
}

// =====================================================================
//  DÉSERT — Souris momie
// =====================================================================
// Bandelettes : bandes diagonales dans la forme.
function wraps(ctx, shape, x0, y0, x1, y1, step, slope, col) {
  clipTo(ctx, shape, () => {
    ctx.lineCap = 'round';
    for (let y = y0; y < y1; y += step) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + (x1 - x0) * slope);
      ctx.lineWidth = 1.8; ctx.strokeStyle = col; ctx.stroke();
    }
  });
}
function drawMummy(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { wrap: '#efe2c0', fur: '#a495b8' }, { gap: '#3b2a42', pink: '#ff9ab8' }, { acc: '#1fc0cf', gold: '#f2c040' });
  const wl = shade(P.wrap, -0.2);
  const by = -a.up * 1.8;
  const sqx = a.sq > 0 ? 1.04 : 0.97, sqy = a.sq > 0 ? 0.96 : 1.03;
  // queue
  limb(ctx, [[14, -14 + by], [26, -12], [36, -18 + a.s * 2], [38, -28 + a.s * 3]], 5, 2.6, P.pink, { lw: 2.4 });
  oval(ctx, 37.5, -27 + a.s * 3, 3.6, 4.6, P.wrap, { lw: LD, hi: 0, glint: false });
  // jambe arrière
  const lg = (x, sgn, col) => {
    const dx = sgn * a.c * 4, lift = Math.max(0, sgn * a.s) * 3;
    limb(ctx, [[x, -18 + by], [x + dx * 0.6, -8 - lift]], 10, 9, col, { lw: LW });
    oval(ctx, x - 3 + dx, -4.5 - lift, 7.5, 4.6, col, { lw: LW, hi: 0, glint: false });
  };
  lg(9, -1, shade(P.wrap, -0.14));
  // bras arrière (tendu, zombie)
  const ay2 = -a.s * 2;
  limb(ctx, [[8, -33 + by], [-10, -34 + by + ay2], [-30, -36 + by + ay2]], 9, 8, shade(P.wrap, -0.16), { lw: LW });
  oval(ctx, -33.5, -36 + by + ay2, 5, 4.6, shade(P.pink, -0.15), { lw: LD + 0.5, hi: 0, glint: false });
  ctx.save(); squash(ctx, 0, 0, sqx, sqy);
  // corps
  const body = [[-13, -40], [3, -45], [16, -38], [18, -21], [12, -8], [-6, -7], [-15, -15], [-16, -30]].map(([x, y]) => [x, y + by]);
  const bodyS = () => smooth(ctx, body);
  C(ctx, bodyS, P.wrap, 1, -26 + by, 18);
  wraps(ctx, bodyS, -20, -52 + by, 22, 0, 6, 0.28, wl);
  cracks(ctx, P, bodyS, 4, -24 + by, 14, 5, 2, -0.6, 0.9);
  ctx.restore();
  lg(-6, 1, P.wrap);
  // ---- tête
  const hx = -6, hy = -58 + by * 1.2;
  // oreilles
  const ear = (x, y, r, rot, wrapIt) => {
    oval(ctx, x, y, r, r * 0.95, P.fur, { lw: LW, rot });
    oval(ctx, x + r * 0.06, y + r * 0.12, r * 0.62, r * 0.56, P.pink, { lw: 0, hi: 0, glint: false, rot });
    if (wrapIt) { C(ctx, () => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot - 0.5); rr(ctx, -r - 1, -2.5, 2 * r + 2, 5, 2); ctx.restore(); }, P.wrap, x, y, r, { lw: LD, hi: 0, glint: false }); }
  };
  ear(hx + 13, hy - 16, 9.5, 0.3, true);
  // bandelette libre qui flotte
  limb(ctx, [[hx + 16, hy - 6], [hx + 25, hy - 7 + a.s * 2], [hx + 32, hy - 2 + a.s * 3]], 5.5, 4.5, shade(P.wrap, -0.08), { lw: LD + 0.5 });
  const head = () => smooth(ctx, [[hx - 22, hy + 4], [hx - 20, hy - 12], [hx - 8, hy - 20], [hx + 8, hy - 19], [hx + 18, hy - 8], [hx + 18, hy + 8], [hx + 6, hy + 18], [hx - 12, hy + 18]]);
  C(ctx, head, P.wrap, hx, hy, 21);
  wraps(ctx, head, hx - 30, hy - 40, hx + 30, hy + 30, 6.5, -0.22, wl);
  ear(hx - 11, hy - 19, 10.5, -0.25, false);
  // fente des yeux
  const gap = () => smooth(ctx, [[hx - 24, hy - 4], [hx - 15, hy - 9.5], [hx - 2, hy - 13], [hx + 8, hy - 9], [hx + 8, hy + 3], [hx - 4, hy + 3], [hx - 16, hy + 3.5], [hx - 24, hy + 2]]);
  gap(); paint(ctx, P.gap, LD + 0.5);
  const blink = a.f === 2 ? 0.5 : 0;
  eye(ctx, P, hx - 15.5, hy - 2, 4.6, 5.2, { inner: 1, anger: 0.35, lid: P.gap, iris: '#e8a010', look: [-0.6, 0.1], blink });
  eye(ctx, P, hx + 0.5, hy - 3, 6, 6.6, { inner: -1, anger: 0.35, lid: P.gap, iris: '#e8a010', look: [-0.6, 0.1], blink });
  // bandelette « sourcils » fâchés
  C(ctx, () => smooth(ctx, [[hx - 26, hy - 9], [hx - 14, hy - 12], [hx - 4, hy - 9], [hx - 6, hy - 6], [hx - 15, hy - 8], [hx - 25, hy - 5]]), P.wrap, hx - 15, hy - 9, 8, { lw: LD + 0.5, glint: false });
  C(ctx, () => smooth(ctx, [[hx + 12, hy - 15], [hx + 4, hy - 13], [hx - 5, hy - 8], [hx - 3, hy - 5], [hx + 5, hy - 9], [hx + 12, hy - 10]]), P.wrap, hx + 4, hy - 11, 8, { lw: LD + 0.5, glint: false });
  // museau + truffe
  blob(ctx, [[hx - 17, hy + 3], [hx - 25, hy + 5], [hx - 28, hy + 9], [hx - 23, hy + 13], [hx - 14, hy + 13]], P.wrap, hx - 22, hy + 9, 7, { lw: LD + 0.5 });
  oval(ctx, hx - 27.5, hy + 7, 3.8, 3.3, P.pink, { lw: LD });
  // bouche grognon
  line(ctx, [[hx - 22, hy + 15], [hx - 16, hy + 13.5], [hx - 9, hy + 15.5]], 2.2);
  fang(ctx, hx - 14, hy + 14, 3, 4);
  // collier égyptien (ousekh)
  const cy0 = -38 + by;
  const collar = () => smooth(ctx, [[-20, cy0 - 2], [-6, cy0 - 1], [10, cy0 - 3], [17, cy0 - 6], [18, cy0 + 1], [8, cy0 + 6], [-6, cy0 + 7.5], [-18, cy0 + 5]]);
  C(ctx, collar, P.acc, -2, cy0 + 2, 10, { lw: LD + 0.5 });
  clipTo(ctx, collar, () => line(ctx, [[-20, cy0 + 2], [-6, cy0 + 3], [8, cy0 + 1], [18, cy0 - 3]], 2.2, P.gold));
  for (const x of [-14, -6, 2, 10]) { ell(ctx, x, cy0 + 5 - (x > 4 ? 1.5 : 0), 1.5, 1.5); paint(ctx, P.gold, 1.2); }
  // bras avant (tendu) + bandelette qui pend
  const ay = a.s * 2;
  limb(ctx, [[-26, -28 + by + ay], [-28 - a.c, -20 + by + ay], [-26 - a.c * 2, -13 + by + ay]], 4.4, 3.6, shade(P.wrap, -0.06), { lw: LD });
  limb(ctx, [[-2, -28 + by], [-18, -29 + by + ay], [-34, -30 + by + ay]], 9.5, 8.5, P.wrap, { lw: LW });
  oval(ctx, -37.5, -30 + by + ay, 5.2, 4.8, P.pink, { lw: LD + 0.5, hi: 0 });
  // ---- variantes
  if (v === 1) {
    C(ctx, () => arcBand(ctx, hx, hy + 2, 21, 20, -2.4, -0.7, 2, 3), GOLD, hx, hy - 18, 10, { lw: LD + 0.5 });
    ell(ctx, hx - 6, hy - 20, 3, 3); paint(ctx, '#2ad0e0', 1.6);
  }
  crest(ctx, P, [[hx - 3, hy - 20, -1.7, 9], [hx + 7, hy - 18, -1.25, 8]], a.f);
  if (v === 2) { drip(ctx, -36, -27 + by + ay, 8); drip(ctx, 10, -8, 6); }
  motes(ctx, P, [[-40, -60, 2], [24, -54, 1.8], [-24, -14, 1.6]], a.f);
}

// =====================================================================
//  JUNGLE — Singe chapardeur (a volé un poisson)
// =====================================================================
// Poisson volé, tenu par la queue (x,y), le corps pend vers le bas (rot tourne autour de la queue).
function fish(ctx, P, x, y, rot, k = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  C(ctx, () => poly(ctx, [[0, 3], [-7, -6], [0, -3], [7, -6]]), P.fin, 0, -2, 6, { lw: LD + 0.5, glint: false });
  const body = () => smooth(ctx, [[0, 2], [6, 8], [8, 17], [5, 25], [0, 28], [-5, 25], [-8, 17], [-6, 8]]);
  C(ctx, body, P.acc, 0, 15, 11);
  clipTo(ctx, body, () => { ell(ctx, 5, 16, 4, 12); ctx.fillStyle = shade(P.acc, 0.45); ctx.fill(); line(ctx, [[-8, 12], [8, 12]], 1.6, shade(P.acc, -0.3)); });
  body(); paint(ctx, null, LD + 0.5);
  C(ctx, () => poly(ctx, [[-7, 12], [-13, 9], [-8, 17]]), P.fin, -9, 12, 4, { lw: LD, glint: false });
  // œil en croix (poisson K.-O.)
  line(ctx, [[-3.5, 19.5], [-0.5, 22.5]], 1.8); line(ctx, [[-0.5, 19.5], [-3.5, 22.5]], 1.8);
  ell(ctx, 1.5, 27.5, 2.4, 1.8); paint(ctx, MOUTH, 1.4);
  ctx.restore();
}
function drawMonkey(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { fur: '#93603a' }, { face: '#f6c89e', mask: '#2b2236' }, { acc: '#3aa8ff', fin: '#ffd23a' });
  const by = -a.up * 2;
  const furB = shade(P.fur, -0.2);
  // queue en spirale
  const tw = a.s * 2;
  limb(ctx, [[12, -22 + by], [27, -19 + by], [37, -27 + tw], [36, -40 + tw], [28, -44 + tw], [23, -37 + tw], [28, -32 + tw]], 6.5, 3.8, shade(P.fur, -0.1));
  // bras arrière levé : brandit le poisson volé
  const hand = [17 + a.c, -84 + by - a.up];
  limb(ctx, [[7, -42 + by], [18, -58 + by], hand], 7.5, 6.5, furB);
  fish(ctx, P, hand[0] + 1, hand[1] + 3, -0.5 + a.s * 0.18, 1.05);
  oval(ctx, hand[0], hand[1], 5, 4.8, shade(P.face, -0.18), { lw: LD + 0.5, hi: 0, glint: false });
  // jambes
  const leg = (hx, sg, col, foot) => {
    const dx = sg * a.c * 5, lift = Math.max(0, sg * a.s) * 4;
    limb(ctx, [[hx, -20 + by], [hx + 5 + dx * 0.3, -12 - lift * 0.5], [hx - 1 + dx, -6 - lift]], 8.5, 7.5, col);
    oval(ctx, hx - 5 + dx, -4.6 - lift, 8.5, 4.6, foot, { lw: LW, hi: 0, glint: false });
  };
  leg(10, -1, furB, shade(P.face, -0.25));
  const body = () => smooth(ctx, [[-14, -42], [0, -49], [15, -42], [18, -26], [10, -13], [-6, -13], [-15, -24]].map(([x, y]) => [x, y + by]));
  C(ctx, body, P.fur, 2, -30 + by, 18);
  clipTo(ctx, body, () => { ell(ctx, -6, -24 + by, 9, 12); ctx.fillStyle = P.face; ctx.fill(); });
  body(); paint(ctx, null, LW);
  cracks(ctx, P, body, 6, -30 + by, 14, 7, 2, -0.8, 0.8);
  leg(-3, 1, P.fur, shade(P.face, -0.12));
  // tête
  const hx = -10, hy = -63 + by * 1.3;
  oval(ctx, hx + 20, hy + 4, 10, 10.5, P.fur);
  oval(ctx, hx + 21, hy + 4.5, 6, 6.5, shade(P.face, -0.1), { lw: 0, hi: 0, glint: false });
  // mèche en boucle
  blob(ctx, [[hx - 5, hy - 16], [hx - 3, hy - 25], [hx + 5, hy - 28], [hx + 10, hy - 23], [hx + 5, hy - 20], [hx + 6, hy - 15]], P.fur, hx + 2, hy - 20, 7, { lw: LW, glint: false });
  const head = () => ell(ctx, hx, hy, 21, 19);
  C(ctx, head, P.fur, hx, hy, 20);
  const face = () => smooth(ctx, [[-22, -3], [-14, -12], [-6, -9], [1, -12], [8, -6], [7, 5], [-2, 13], [-14, 15], [-23, 9]].map(([x, y]) => [hx + x, hy + y]));
  face(); paint(ctx, P.face, LD + 0.5);
  blob(ctx, [[-26, 8], [-20, 2], [-10, 3], [-5, 9], [-9, 16], [-20, 18], [-27, 14]].map(([x, y]) => [hx + x, hy + y]), P.face, hx - 15, hy + 9, 10, { lw: LD + 0.5 });
  // masque de voleur (+ nœud qui flotte)
  const kx = hx + 17, ky = hy - 7;
  limb(ctx, [[kx, ky], [kx + 9, ky - 3 + a.s * 2], [kx + 15, ky + a.s * 3]], 4.5, 3, P.mask, { lw: LD });
  limb(ctx, [[kx, ky], [kx + 8, ky + 5 - a.s], [kx + 12, ky + 10 - a.s * 2]], 4, 2.6, P.mask, { lw: LD });
  smooth(ctx, [[-26, -5], [-14, -10], [2, -10], [18, -9], [18, -2], [2, 0], [-12, 1], [-25, 1]].map(([x, y]) => [hx + x, hy + y]));
  paint(ctx, P.mask, LD);
  eye(ctx, P, hx - 15, hy - 4, 4.6, 5.2, { inner: 1, anger: 0.55, lid: P.mask, iris: '#5a3014', look: [-0.7, 0] });
  eye(ctx, P, hx - 2.5, hy - 4.5, 5.8, 6.4, { inner: -1, anger: -0.15, lid: P.mask, iris: '#5a3014', look: [-0.7, 0] });
  brow(ctx, hx - 21, hy - 13, hx - 12, hy - 10, 3.2);
  brow(ctx, hx + 6, hy - 14, hx - 6, hy - 16.5, 3.6, OUT, -2.5);
  // narines, sourire moqueur, langue tirée
  ell(ctx, hx - 23, hy + 6, 1.1, 1.4); ctx.fillStyle = OUT; ctx.fill();
  ell(ctx, hx - 19, hy + 6.5, 1.1, 1.4); ctx.fill();
  smooth(ctx, [[hx - 26, hy + 11], [hx - 16, hy + 14], [hx - 7, hy + 10], [hx - 10, hy + 16], [hx - 20, hy + 18]]);
  paint(ctx, MOUTH, LD);
  oval(ctx, hx - 22, hy + 17, 3.6, 4.6, TONGUE, { lw: LD, hi: 0, glint: false, rot: 0.3 });
  fang(ctx, hx - 11, hy + 12.4, 2.8, 3.6);
  // bras avant (ballant, jusqu'aux phalanges)
  const fhx = -24 + a.c * 4, fhy = -13 + by * 0.5;
  limb(ctx, [[-6, -40 + by], [-15, -30 + by], [fhx, fhy]], 7.5, 6.5, P.fur);
  oval(ctx, fhx - 1, fhy + 1, 5.2, 4.6, shade(P.face, -0.12), { lw: LD + 0.5, hi: 0, glint: false });
  // variantes
  if (v === 1) {
    ell(ctx, hx + 19, hy + 10, 2.6, 3.4); ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = GOLD; ctx.stroke();
    C(ctx, () => taper(ctx, [[-13, -32 + by], [-17, -26 + by]], 8.5, 8), GOLD, -15, -29 + by, 6, { lw: LD, glint: false });
  }
  crest(ctx, P, [[hx - 4, hy - 18, -1.9, 8], [hx + 5, hy - 17, -1.4, 9], [hx + 13, hy - 12, -0.9, 7]], a.f);
  if (v === 2) drip(ctx, hand[0] + 6, hand[1] + 28, 6);
  motes(ctx, P, [[-36, -70, 2], [30, -60, 1.8], [-30, -24, 1.6]], a.f);
}

// =====================================================================
//  JUNGLE — Serpent hypnotique
// =====================================================================
function spiralIris(ctx, rot, col, ring = '#ffffff') {
  return (px, py, rx, ry) => {
    ell(ctx, px, py, rx * 1.12, ry * 1.12); ctx.fillStyle = col; ctx.fill();
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(rx / 10, ry / 10);
    ctx.beginPath();
    for (let t = 0; t < TAU * 2.2; t += 0.2) { const r = 1 + t * 0.62; ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
    ctx.lineWidth = 2.6; ctx.strokeStyle = ring; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    ell(ctx, px, py, rx * 0.22, ry * 0.22); ctx.fillStyle = OUT; ctx.fill();
  };
}
function drawSnake(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { scale: '#5ac24a' }, { belly: '#f6e38a', hoodIn: '#f0d466' }, { acc: '#e83ab8' }, { gold: [GOLD, GOLD, '#c9ff7a', '#ffb347'] });
  const sw = a.s * 2.4;
  const dark = shade(P.scale, -0.3);
  // queue dressée + pendule hypnotique
  const tp = [[24, -12], [37, -18], [42, -32], [39, -44], [33, -50]];
  limb(ctx, tp, 11, 4, shade(P.scale, -0.12));
  const th = [0.42, 0, -0.42, 0][a.f];
  const p0 = [31.5, -50];
  const m = [p0[0] - Math.sin(th) * 17, p0[1] + Math.cos(th) * 17];
  ctx.setLineDash([2, 2.4]); line(ctx, [p0, m], 2.2, shade(P.gold, -0.35)); ctx.setLineDash([]);
  oval(ctx, m[0], m[1] + 3, 7, 7, P.gold, { lw: LD + 0.5 });
  ctx.save(); ctx.translate(m[0], m[1] + 3); ctx.rotate(-a.f * Math.PI / 2);
  ctx.beginPath(); for (let t = 0; t < TAU * 1.6; t += 0.25) { const r = 0.6 + t * 0.42; ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
  ctx.lineWidth = 1.6; ctx.strokeStyle = P.acc; ctx.stroke(); ctx.restore();
  // anneaux enroulés
  const coil = (x, y, rx, ry, col) => {
    const sh = () => ell(ctx, x, y, rx, ry);
    C(ctx, sh, col, x, y, rx * 0.6);
    clipTo(ctx, sh, () => { ell(ctx, x - rx * 0.1, y + ry * 0.95, rx * 0.95, ry * 0.42); ctx.fillStyle = P.belly; ctx.fill(); });
    sh(); paint(ctx, null, LW);
    for (const t of [-2.4, -1.8, -1.2, -0.6]) { const [dx, dy] = onEll(x, y, rx, ry, t, -3); ell(ctx, dx, dy, 3, 1.8); fillA(ctx, dark, 0.7); }
  };
  coil(9, -11, 28, 10, shade(P.scale, -0.06));
  coil(7, -23, 21, 8.5, P.scale);
  // cou
  const hx = -15 + sw, hy = -61;
  const neck = [[-2, -26], [-11, -36], [-8, -47], [hx + 8, hy + 4]];
  // capuchon de cobra
  const hood = () => smooth(ctx, [[hx - 2, hy - 22], [hx + 14, hy - 23], [hx + 26, hy - 10], [hx + 27, hy + 8], [hx + 18, hy + 24], [hx + 5, hy + 28], [hx - 3, hy + 16], [hx - 8, hy - 4]]);
  C(ctx, hood, P.scale, hx + 12, hy + 2, 22);
  clipTo(ctx, hood, () => {
    smooth(ctx, [[hx + 4, hy - 16], [hx + 15, hy - 15], [hx + 21, hy - 3], [hx + 20, hy + 12], [hx + 12, hy + 22], [hx + 4, hy + 16]]); ctx.fillStyle = P.hoodIn; ctx.fill();
    for (const [x, y] of [[hx + 15, hy - 6], [hx + 15, hy + 8]]) { poly(ctx, [[x, y - 5], [x + 4, y], [x, y + 5], [x - 4, y]]); paint(ctx, P.acc, 1.6); ell(ctx, x, y, 1.4, 1.8); ctx.fillStyle = OUT; ctx.fill(); }
  });
  hood(); paint(ctx, null, LW);
  limb(ctx, neck, 15, 13, P.scale);
  clipTo(ctx, () => taper(ctx, neck, 15, 13), () => {
    taper(ctx, neck.map(([x, y]) => [x - 6, y + 1]), 8, 7); ctx.fillStyle = P.belly; ctx.fill();
    for (let i = 0; i < 4; i++) { const p = along(neck, 0.15 + i * 0.22); line(ctx, [[p.x - 10, p.y], [p.x - 2, p.y + 1]], 1.4, shade(P.belly, -0.3)); }
  });
  taper(ctx, neck, 15, 13); paint(ctx, null, LW);
  ctx.save(); squash(ctx, hx - 3, hy + 4, 1.18, 1.18);
  // tête
  const head = () => smooth(ctx, [[hx - 21, hy + 2], [hx - 17, hy - 8], [hx - 5, hy - 12], [hx + 8, hy - 10], [hx + 13, hy], [hx + 8, hy + 9], [hx - 6, hy + 11], [hx - 19, hy + 8]]);
  C(ctx, head, P.scale, hx - 3, hy - 1, 16);
  clipTo(ctx, head, () => { ell(ctx, hx - 8, hy + 12, 15, 5); ctx.fillStyle = P.belly; ctx.fill(); });
  head(); paint(ctx, null, LW);
  const rot = a.f * Math.PI / 2;
  const sp = (col) => spiralIris(ctx, rot, col, P.v ? '#ffffff' : '#fff2fb');
  eye(ctx, P, hx - 10.5, hy - 2, 4.8, 5.6, { inner: 1, anger: 0.2, blink: 0.22, lid: P.scale, pr: 0.8, look: [-0.3, 0], irisFn: sp(P.glowEye || P.acc), glowR: 2 });
  eye(ctx, P, hx + 1.5, hy - 3, 6.6, 7.4, { inner: -1, anger: 0.2, blink: 0.22, lid: P.scale, pr: 0.8, look: [-0.3, 0], irisFn: sp(P.glowEye || P.acc), glowR: 2 });
  brow(ctx, hx - 16, hy - 10, hx - 8, hy - 9.5, 3);
  brow(ctx, hx + 9, hy - 14, hx - 2, hy - 12, 3.6, OUT, -2.2);
  // langue fourchue
  const tl = [10, 15, 0, 7][a.f];
  if (tl) {
    const tx = hx - 19 - tl, ty = hy + 6 + (a.f === 1 ? 1 : 0);
    line(ctx, [[hx - 17, hy + 6], [tx, ty]], 3.4, OUT); line(ctx, [[hx - 17, hy + 6], [tx, ty]], 1.8, '#ff3d6e');
    line(ctx, [[tx, ty], [tx - 3.5, ty - 2.5]], 3.2, OUT); line(ctx, [[tx, ty], [tx - 3.5, ty + 2.5]], 3.2, OUT);
    line(ctx, [[tx, ty], [tx - 3.5, ty - 2.5]], 1.6, '#ff3d6e'); line(ctx, [[tx, ty], [tx - 3.5, ty + 2.5]], 1.6, '#ff3d6e');
  }
  line(ctx, [[hx - 18, hy + 5], [hx - 9, hy + 7], [hx - 1, hy + 6], [hx + 3, hy + 2]], 2.2);
  fang(ctx, hx - 14, hy + 5.8, 2.6, 4);
  fang(ctx, hx - 7.5, hy + 6.8, 2.4, 3.6);
  ctx.restore();
  // variantes
  if (v === 1) goldPlate(ctx, () => arcBand(ctx, hx - 3, hy - 1, 16, 12, -2.3, -0.9, 2, 3), hx - 3, hy - 14, 8, []);
  crest(ctx, P, [[hx + 20, hy - 18, -1.0, 7], [hx + 26, hy - 2, -0.2, 7], [hx + 24, hy + 14, 0.4, 6], [40, -38, -0.3, 6]], a.f);
  cracks(ctx, P, () => ell(ctx, 9, -11, 28, 10), 12, -11, 20, 4, 2, -2.5, -0.6);
  motes(ctx, P, [[-36, -40, 2], [20, -70, 1.8], [-28, -10, 1.5]], a.f);
}

// =====================================================================
//  FONDS MARINS — Requin à lunettes
// =====================================================================
function drawShark(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { skin: '#5d8fd2' }, { belly: '#eef3ff', shades: '#24203a' }, { acc: '#ffc832', lens: '#ff4fa8' });
  const by = [0, -2, -3, -1][a.f];
  const skD = shade(P.skin, -0.18);
  ctx.save(); ctx.translate(0, by);
  // nageoire caudale (battement)
  ctx.save(); ctx.translate(34, -48); ctx.rotate(a.s * 0.22);
  C(ctx, () => smooth(ctx, [[-4, -4], [10, -16], [22, -26], [18, -10], [12, 0], [20, 14], [8, 10], [-4, 5]]), skD, 8, -4, 14);
  ctx.restore();
  // nageoire pectorale arrière
  ctx.save(); ctx.translate(10, -30); ctx.rotate(0.3 - a.c * 0.15);
  C(ctx, () => smooth(ctx, [[-4, 0], [6, 2], [14, 12], [4, 9]]), shade(skD, -0.15), 5, 5, 7, { glint: false });
  ctx.restore();
  // aileron dorsal
  C(ctx, () => smooth(ctx, [[-6, -69], [4, -82], [14, -88], [13, -78], [18, -66]]), skD, 8, -76, 9);
  // corps
  const body = () => smooth(ctx, [[-45, -46], [-40, -61], [-22, -72], [4, -71], [25, -62], [39, -51], [38, -42], [24, -32], [0, -24], [-24, -24], [-41, -32]]);
  C(ctx, body, P.skin, -4, -48, 30);
  clipTo(ctx, body, () => {
    smooth(ctx, [[-50, -42], [-30, -40], [-10, -40], [14, -38], [40, -46], [46, -20], [0, -10], [-50, -14]]); ctx.fillStyle = P.belly; ctx.fill();
    ell(ctx, 4, -21, 30, 6); fillA(ctx, '#9aa9d8', 0.5);
  });
  body(); paint(ctx, null, LW);
  // ouïes
  for (const x of [4, 9, 14]) line(ctx, [[x, -58], [x - 2, -51], [x, -44]], 2, shade(P.skin, -0.4));
  cracks(ctx, P, body, 18, -52, 16, 9, 2, -1.4, 0.4);
  // grand sourire plein de dents
  const up = [[-46, -42], [-34, -39], [-22, -38], [-10, -41]];
  const lo = [[-10, -41], [-18, -33], [-30, -30], [-42, -34]];
  smooth(ctx, [...up, ...lo.slice(1)]); paint(ctx, MOUTH, LD + 0.5);
  clipTo(ctx, () => smooth(ctx, [...up, ...lo.slice(1)]), () => {
    ell(ctx, -26, -29, 9, 4); ctx.fillStyle = TONGUE; ctx.fill();
    for (let i = 0; i < 6; i++) {
      const p = along(up, 0.06 + i * 0.17); const gold = i === 3;
      poly(ctx, [[p.x - 2.6, p.y - 1], [p.x + 2.6, p.y - 1], [p.x, p.y + 4.6]]); paint(ctx, gold ? P.acc : TOOTH, 1.3);
    }
    for (let i = 0; i < 4; i++) { const p = along(lo, 0.2 + i * 0.2); poly(ctx, [[p.x - 2.4, p.y + 1], [p.x + 2.4, p.y + 1], [p.x, p.y - 4]]); paint(ctx, TOOTH, 1.3); }
  });
  smooth(ctx, [...up, ...lo.slice(1)]); paint(ctx, null, LD + 0.5);
  // chaîne en or + pendentif arête
  const ch = [[6, -66], [2, -52], [-6, -38], [-12, -30]];
  for (let i = 0; i <= 9; i++) {
    const p = along(ch, i / 9), ang = Math.atan2(p.ty, p.tx);
    ell(ctx, p.x, p.y, i % 2 ? 2.8 : 3.2, i % 2 ? 1.5 : 2.2, ang); paint(ctx, i % 2 ? shade(P.acc, -0.15) : P.acc, 1.5);
  }
  const pdx = -14 + a.s, pdy = -22;
  oval(ctx, pdx, pdy, 5.4, 5.4, P.acc, { lw: LD });
  line(ctx, [[pdx - 3, pdy], [pdx + 2.5, pdy]], 1.4, shade(P.acc, -0.5));
  for (const x of [-1.5, 0.5]) line(ctx, [[pdx + x, pdy - 2], [pdx + x, pdy + 2]], 1.2, shade(P.acc, -0.5));
  poly(ctx, [[pdx + 2.5, pdy], [pdx + 4, pdy - 1.6], [pdx + 4, pdy + 1.6]]); ctx.fillStyle = shade(P.acc, -0.5); ctx.fill();
  // lunettes de soleil
  const lens = (x, y, rx, ry) => {
    const sh = () => rr(ctx, x - rx, y - ry, rx * 2, ry * 2, ry * 0.8);
    sh(); paint(ctx, P.shades, LD + 0.5);
    clipTo(ctx, sh, () => {
      poly(ctx, [[x - rx * 0.3, y - ry - 2], [x + rx * 0.1, y - ry - 2], [x - rx * 0.5, y + ry + 2], [x - rx * 0.9, y + ry + 2]]); fillA(ctx, P.lens, 0.85);
      poly(ctx, [[x + rx * 0.3, y - ry - 2], [x + rx * 0.5, y - ry - 2], [x - rx * 0.05, y + ry + 2], [x - rx * 0.25, y + ry + 2]]); fillA(ctx, '#ffffff', 0.7);
      if (P.glowEye) { ell(ctx, x - 1, y + 1, rx * 0.5, ry * 0.42); ctx.fillStyle = P.glowEye; ctx.fill(); }
    });
  };
  if (P.glowEye) { glow(ctx, -31, -55, 12, P.glowEye, 0.6); glow(ctx, -15, -56, 14, P.glowEye, 0.6); }
  limb(ctx, [[-10, -57], [4, -60]], 2.6, 2.4, P.shades, { lw: 1.4 });
  lens(-31, -54.5, 6, 5);
  lens(-15, -55.5, 8, 6);
  limb(ctx, [[-26, -56], [-22, -57]], 2.4, 2.4, P.shades, { lw: 1.2 });
  brow(ctx, -38, -63, -28, -61, 3.4);
  brow(ctx, -6, -67, -19, -63, 4.2);
  // nageoire pectorale avant
  ctx.save(); ctx.translate(-4, -30); ctx.rotate(0.35 + a.c * 0.2);
  C(ctx, () => smooth(ctx, [[-5, -1], [6, 0], [16, 13], [3, 9]]), skD, 5, 5, 8, { glint: false });
  ctx.restore();
  // variantes
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[-26, -71], [-6, -76], [16, -70], [14, -64], [-6, -69], [-24, -65]]), -6, -70, 12, [[-14, -69], [2, -69]]);
  }
  crest(ctx, P, [[-14, -72, -1.8, 8], [-2, -73, -1.5, 9], [20, -63, -1.1, 8], [30, -55, -0.7, 7]], a.f);
  ctx.restore();
  // bulles
  if (v < 2) for (const [x, y, r] of [[-52, -52 - a.f * 3, 2.4], [-48, -66 - a.f * 2, 1.6]]) { ell(ctx, x, y + by, r, r); paint(ctx, 'rgba(210,240,255,0.5)', 1.2, '#4a8ac8'); }
  motes(ctx, P, [[-52, -56, 2.2], [24, -80, 1.8], [-36, -16, 1.6]], a.f);
}

// =====================================================================
//  FONDS MARINS — Poisson-globe
// =====================================================================
function drawPuffer(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { skin: '#ffcc4a', spot: '#d48a2a', spike: '#f2a238' }, { belly: '#fff3d2', hat: '#f6f8ff', band: '#3a6fe0' }, { acc: '#ff4a6a' });
  const r = [23, 24.5, 26, 24.5][a.f];
  const rx = r * [1.0, 1.0, 1.03, 1.0][a.f], ry = r * [0.96, 1.0, 1.0, 1.0][a.f];
  const cx = 0, cy = -44 + [0, -1.5, -2, -1][a.f];
  // queue
  ctx.save(); ctx.translate(cx + rx - 2, cy + 2); ctx.rotate(a.s * 0.25);
  C(ctx, () => smooth(ctx, [[-2, -2], [10, -12], [14, -6], [12, 2], [14, 10], [10, 14], [-2, 3]]), shade(P.skin, -0.12), 6, 0, 9);
  ctx.restore();
  // piquants
  const nsp = 15;
  for (let i = 0; i < nsp; i++) {
    const t = -Math.PI * 0.95 + i * (TAU / nsp);
    if (t > 2.35 && t < 3.3) continue;
    const [bx, byy] = onEll(cx, cy, rx, ry, t, -3);
    const L = 9 + (i % 2) * 2;
    goldSpike(ctx, bx, byy, t, L, 6, v === 1 ? GOLD : P.spike);
  }
  // corps
  const body = () => ell(ctx, cx, cy, rx, ry);
  C(ctx, body, P.skin, cx, cy, r);
  clipTo(ctx, body, () => {
    ell(ctx, cx - 3, cy + ry * 0.75, rx * 0.95, ry * 0.5); ctx.fillStyle = P.belly; ctx.fill();
    for (const [x, y, s] of [[8, -16, 2.4], [16, -8, 2], [2, -20, 1.8], [14, -18, 1.6], [20, 0, 1.8]]) { ell(ctx, cx + x, cy + y, s, s); ctx.fillStyle = P.spot; ctx.fill(); }
  });
  body(); paint(ctx, null, LW);
  cracks(ctx, P, body, cx + 8, cy - 4, r * 0.7, 11, 2, -1.2, 0.6);
  // nageoire latérale
  ctx.save(); ctx.translate(cx + 11, cy + 9); ctx.rotate(0.7 + a.s * 0.35);
  C(ctx, () => poly(ctx, [[0, -2], [11, -6], [12, 0], [11, 6], [0, 2]]), shade(P.skin, -0.12), 6, 0, 5, { glint: false, lw: LD + 0.5 });
  for (const dy of [-3, 0, 3]) line(ctx, [[2, dy * 0.3], [10, dy * 1.4]], 1.3, shade(P.skin, -0.45));
  ctx.restore();
  // visage
  eye(ctx, P, cx - 13, cy - 6, 5, 6, { inner: 1, anger: 0.6, lid: P.skin, iris: '#1e5a8a' });
  eye(ctx, P, cx + 1, cy - 7, 6.6, 7.6, { inner: -1, anger: 0.6, lid: P.skin, iris: '#1e5a8a' });
  brow(ctx, cx - 19, cy - 15, cx - 10, cy - 12, 3.6);
  brow(ctx, cx + 9, cy - 18, cx - 3, cy - 14, 4.4);
  blush(ctx, cx + 4, cy + 4, 6, 3.4, 0.45);
  blush(ctx, cx - 18, cy + 3, 3.4, 2.4, 0.4);
  // lèvres boudeuses
  const lx = cx - rx + 1, ly = cy + 6;
  oval(ctx, lx - 1, ly, 6.5, 6, P.acc, { lw: LD + 0.5 });
  ell(ctx, lx - 2, ly + 0.5, 2.6, 2.4); ctx.fillStyle = MOUTH; ctx.fill();
  fang(ctx, lx + 0.5, ly - 2.2, 2.2, 2.6, 1.2);
  // bonnet de marin
  ctx.save(); ctx.translate(cx + 4, cy - ry + 3); ctx.rotate(0.22);
  C(ctx, () => smooth(ctx, [[-11, 0], [-9, -9], [0, -13], [9, -9], [11, 0]]), P.hat, 0, -6, 11);
  C(ctx, () => rr(ctx, -12.5, -3, 25, 6.5, 3), P.band, 0, 0, 10, { lw: LD + 0.5, glint: false });
  oval(ctx, 0, -14.5 + a.up, 4.4, 4.2, v === 1 ? GOLD : P.acc, { lw: LD + 0.5 });
  ctx.restore();
  // variantes
  if (v === 1) { goldPlate(ctx, () => rr(ctx, cx - 4, cy + ry - 10, 14, 6, 3), cx + 3, cy + ry - 7, 6, [[cx + 3, cy + ry - 7]]); }
  if (v >= 2) crest(ctx, P, [[cx - 8, cy - ry + 2, -1.9, 7], [cx + 16, cy - ry + 8, -1.0, 7]], a.f);
  motes(ctx, P, [[-34, -70, 2], [30, -72, 1.8], [-34, -22, 1.6]], a.f);
  if (v < 2) for (const [x, y, rr2] of [[-36, -56 - a.f * 3, 2.2], [-40, -70 - a.f * 2, 1.4]]) { ell(ctx, x, y, rr2, rr2); paint(ctx, 'rgba(210,240,255,0.5)', 1.2, '#4a8ac8'); }
}

// =====================================================================
//  CHÂTEAU HANTÉ — Chauve-souris vampire
// =====================================================================
// Aile membraneuse : épaule (x,y), dir = -1 (vers la gauche) / +1, ang = levée (rad), len = envergure.
function batWing(ctx, x, y, dir, ang, len, col, bone) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(-ang);
  const L = len;
  const wrist = [L * 0.42, -L * 0.2];
  const tips = [[L * 1.0, -L * 0.3], [L * 0.95, L * 0.1], [L * 0.62, L * 0.36]];
  const sh = () => {
    ctx.beginPath(); ctx.moveTo(0, -L * 0.06);
    ctx.quadraticCurveTo(L * 0.2, -L * 0.3, wrist[0], wrist[1]);
    ctx.quadraticCurveTo(L * 0.75, -L * 0.36, tips[0][0], tips[0][1]);
    ctx.quadraticCurveTo(L * 0.84, -L * 0.05, tips[1][0], tips[1][1]);
    ctx.quadraticCurveTo(L * 0.7, L * 0.12, tips[2][0], tips[2][1]);
    ctx.quadraticCurveTo(L * 0.38, L * 0.2, 0, L * 0.26);
    ctx.closePath();
  };
  C(ctx, sh, col, L * 0.45, -L * 0.05, L * 0.4, { glint: false, depth: 0.12 });
  for (const t of tips) line(ctx, [wrist, t], 2, bone);
  line(ctx, [[0, -L * 0.04], wrist], 3, bone);
  oval(ctx, wrist[0], wrist[1], 2.6, 2.6, bone, { lw: 1.6, hi: 0, glint: false });
  ctx.restore();
}
function drawBat(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { fur: '#7a5cc4', wing: '#55409a' }, { skin: '#d4b4f4', cape: '#2b2042' }, { acc: '#e02848' });
  const by = [1, -1, -3, -1][a.f];
  const wa = [0.95, 0.3, -0.35, 0.3][a.f];
  const cx = 0, cy = -52 + by;
  const bone = shade(P.wing, -0.35);
  // ailes
  batWing(ctx, cx + 8, cy + 2, 1, wa, 40, P.wing, bone);
  batWing(ctx, cx - 8, cy + 2, -1, wa * 0.9, 34, shade(P.wing, -0.12), bone);
  // pieds
  for (const x of [-5, 6]) { limb(ctx, [[cx + x, cy + 14], [cx + x + 1, cy + 22]], 3.5, 3, P.skin, { lw: LD }); oval(ctx, cx + x + 1, cy + 23, 3.4, 2.4, P.skin, { lw: LD, hi: 0, glint: false }); }
  // col de Dracula (derrière la tête)
  const col = () => smooth(ctx, [[cx - 22, cy - 2], [cx - 26, cy - 22], [cx - 12, cy - 6], [cx, cy - 4], [cx + 13, cy - 6], [cx + 26, cy - 22], [cx + 22, cy - 2], [cx + 10, cy + 12], [cx - 10, cy + 12]]);
  C(ctx, col, P.cape, cx, cy, 20, { glint: false });
  clipTo(ctx, col, () => { smooth(ctx, [[cx - 19, cy - 4], [cx - 21, cy - 16], [cx - 10, cy - 4], [cx + 10, cy - 4], [cx + 21, cy - 16], [cx + 19, cy - 4], [cx, cy + 6]]); ctx.fillStyle = P.acc; ctx.fill(); });
  col(); paint(ctx, null, LW);
  // oreilles
  const ear = (x, y, dir) => {
    const pts = [[x - 7 * dir, y + 4], [x - 4 * dir, y - 14], [x + 2 * dir, y - 24], [x + 7 * dir, y - 8], [x + 7 * dir, y + 4]];
    blob(ctx, pts, P.fur, x, y - 6, 9, { glint: false });
    smooth(ctx, [[x - 3 * dir, y + 1], [x - 1 * dir, y - 12], [x + 2 * dir, y - 18], [x + 4 * dir, y - 6], [x + 3 * dir, y + 1]]); ctx.fillStyle = P.skin; ctx.fill();
  };
  ear(cx + 9, cy - 16, 1);
  // corps-tête (boule de poils)
  const body = () => smooth(ctx, [[cx - 18, cy - 4], [cx - 14, cy - 15], [cx - 2, cy - 19], [cx + 12, cy - 16], [cx + 18, cy - 4], [cx + 15, cy + 10], [cx + 3, cy + 16], [cx - 10, cy + 14], [cx - 17, cy + 6]]);
  C(ctx, body, P.fur, cx, cy, 18);
  clipTo(ctx, body, () => { ell(ctx, cx - 2, cy + 12, 11, 7); ctx.fillStyle = shade(P.fur, 0.18); ctx.fill(); });
  body(); paint(ctx, null, LW);
  ear(cx - 9, cy - 17, -1);
  // mèche (pointe de veuve)
  blob(ctx, [[cx - 8, cy - 17], [cx - 2, cy - 22], [cx + 6, cy - 18], [cx - 1, cy - 9]], shade(P.fur, -0.25), cx - 1, cy - 16, 6, { lw: LD, glint: false });
  cracks(ctx, P, body, cx + 6, cy + 4, 12, 13, 2, -0.4, 1.2);
  // visage
  eye(ctx, P, cx - 9, cy - 4, 4.8, 5.8, { inner: 1, anger: 0.6, lid: P.fur, iris: '#c81838' });
  eye(ctx, P, cx + 4, cy - 5, 6, 7, { inner: -1, anger: 0.6, lid: P.fur, iris: '#c81838' });
  brow(ctx, cx - 15, cy - 12, cx - 6, cy - 9.5, 3.2);
  brow(ctx, cx + 12, cy - 15, cx + 1, cy - 11.5, 3.8);
  // nez retroussé
  oval(ctx, cx - 14, cy + 4, 3.4, 2.8, shade(P.skin, -0.1), { lw: LD, hi: 0 });
  // sourire + crocs
  line(ctx, [[cx - 14, cy + 8], [cx - 6, cy + 10], [cx + 4, cy + 8], [cx + 7, cy + 5]], 2.2);
  fang(ctx, cx - 9, cy + 9.5, 3, 5);
  fang(ctx, cx - 1.5, cy + 9.8, 3, 5);
  // broche
  oval(ctx, cx + 1, cy + 15, 3.4, 3.4, P.acc, { lw: LD });
  if (v === 1) goldPlate(ctx, () => arcBand(ctx, cx, cy + 2, 16, 14, 0.5, 2.6, 2, 2), cx, cy + 14, 6, []);
  crest(ctx, P, [[cx - 4, cy - 20, -1.7, 7], [cx + 4, cy - 20, -1.4, 7]], a.f);
  if (v === 2) drip(ctx, cx - 5, cy + 12, 7);
  motes(ctx, P, [[-36, -40, 2], [34, -30, 1.8], [-24, -86, 1.6]], a.f);
}

// =====================================================================
//  CHÂTEAU HANTÉ — Squelette de chien (avec son os-gourdin)
// =====================================================================
function boneLimb(ctx, pts, w, col) {
  limb(ctx, pts, w, w, col, { lw: LD + 0.5 });
  for (const p of [pts[0], pts[pts.length - 1]]) oval(ctx, p[0], p[1], w * 0.62, w * 0.62, col, { lw: LD, hi: 0, glint: false });
}
function bigBone(ctx, x0, y0, x1, y1, w, col) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
  for (const [x, y] of [[x0, y0], [x1, y1]]) for (const s of [-1, 1]) oval(ctx, x + nx * s * w * 0.5, y + ny * s * w * 0.5, w * 0.62, w * 0.62, col, { lw: LD + 0.5, hi: 0, glint: false });
  limb(ctx, [[x0, y0], [x1, y1]], w, w * 0.9, col, { lw: LD + 0.5 });
}
function drawSkeleton(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, {}, { sock: '#2b1838' }, { acc: '#e8344a' }, { bone: ['#f3ebd6', '#f3ebd6', '#d8bef0', '#8c7a7c'], eyeC: ['#5ae8ff', '#5ae8ff', TOXIC, '#ffa526'] });
  const boneD = shade(P.bone, -0.2);
  const by = -a.up * 1.8;
  // queue (vertèbres qui remuent)
  const tw = a.s * 4;
  const tail = [[10, -24 + by], [20, -28 + by], [27, -36 + tw * 0.5], [30, -46 + tw]];
  for (let i = 0; i <= 5; i++) { const p = along(tail, i / 5); oval(ctx, p.x, p.y, 3.8 - i * 0.3, 3.4 - i * 0.25, boneD, { lw: LD, hi: 0, glint: false }); }
  // jambes
  const leg = (hx, sg, col) => {
    const dx = sg * a.c * 5, lift = Math.max(0, sg * a.s) * 4;
    boneLimb(ctx, [[hx, -22 + by], [hx - 1 + dx * 0.5, -12 - lift * 0.5]], 6.5, col);
    boneLimb(ctx, [[hx - 1 + dx * 0.5, -12 - lift * 0.5], [hx + dx, -5 - lift]], 6, col);
    oval(ctx, hx - 4 + dx, -3.8 - lift, 7.5, 4, col, { lw: LD + 0.5, hi: 0 });
  };
  leg(9, -1, boneD);
  // bras arrière
  boneLimb(ctx, [[10, -40 + by], [16, -31 + by - a.s * 2], [13, -23 + by - a.s * 2]], 5.5, boneD);
  // bassin
  oval(ctx, 5, -23 + by, 10, 5, P.bone, { lw: LD + 0.5 });
  // cage thoracique pleine (lisible en petit) + côtes
  const cage = () => smooth(ctx, [[-10, -44 + by], [2, -50 + by], [14, -45 + by], [15, -34 + by], [8, -27 + by], [-4, -28 + by], [-12, -35 + by]]);
  C(ctx, cage, P.bone, 2, -38 + by, 13);
  clipTo(ctx, cage, () => {
    for (const y of [-42, -36, -30]) line(ctx, [[-14, y + by + 3], [-4, y + by - 1], [8, y + by], [18, y + by + 4]], 3, '#2b1838');
    line(ctx, [[9, -52 + by], [9, -24 + by]], 4, boneD);
  });
  cage(); paint(ctx, null, LW);
  leg(-1, 1, P.bone);
  // os-gourdin posé sur l'épaule
  ctx.save(); ctx.translate(-14, -38 + by); ctx.rotate(a.s * 0.05);
  bigBone(ctx, 0, 0, 40, -16, 9, shade(P.bone, -0.04));
  ctx.restore();
  // collier à pics
  const cpts = [[-8, -49 + by], [3, -47 + by], [14, -51 + by]];
  for (const t of [0.15, 0.5, 0.85]) { const p = along(cpts, t); goldSpike(ctx, p.x, p.y + 2, Math.PI / 2 + 0.2, 6, 4.6, '#dfe4f2'); }
  limb(ctx, cpts, 7, 7, P.acc, { lw: LD + 0.5 });
  oval(ctx, -2, -42 + by, 3.2, 3.2, v === 1 ? GOLD : '#ffd34d', { lw: LD, hi: 0 });
  // crâne
  const hx = -6, hy = -66 + by * 1.3;
  const jo = [0.05, 0.3, 0.08, 0.24][a.f];
  ctx.save(); ctx.translate(hx + 8, hy + 8); ctx.rotate(-jo);
  const jaw = () => smooth(ctx, [[2, -2], [-12, 0], [-30, 1], [-31, 7], [-14, 9], [2, 6]]);
  C(ctx, jaw, boneD, -14, 3, 10, { glint: false });
  for (let i = 0; i < 4; i++) fang(ctx, -27 + i * 5.5, 1.5, 3.2, -3.4, 1.2);
  ctx.restore();
  const skull = () => smooth(ctx, [[hx - 35, hy + 1], [hx - 34, hy - 7], [hx - 19, hy - 11], [hx - 13, hy - 19], [hx + 2, hy - 23], [hx + 16, hy - 17], [hx + 20, hy - 3], [hx + 13, hy + 9], [hx - 4, hy + 10], [hx - 20, hy + 7], [hx - 33, hy + 7]]);
  C(ctx, skull, P.bone, hx - 4, hy - 5, 24);
  clipTo(ctx, skull, () => line(ctx, [[hx + 8, hy - 23], [hx + 5, hy - 16], [hx + 10, hy - 12], [hx + 7, hy - 7]], 2, shade(P.bone, -0.45)));
  for (let i = 0; i < 4; i++) fang(ctx, hx - 31 + i * 5.6, hy + 6.5, 3.2, 3.4, 1.2);
  smooth(ctx, [[hx - 34, hy - 5], [hx - 30, hy - 7], [hx - 27.5, hy - 3], [hx - 32, hy - 0.5]]); ctx.fillStyle = OUT; ctx.fill();
  const socket = (x, y, rx, ry, inner) => {
    smooth(ctx, [[x - rx, y + ry * 0.2], [x - rx * 0.6, y - ry * (inner > 0 ? 0.9 : 0.5)], [x + rx * 0.6, y - ry * (inner > 0 ? 0.5 : 0.9)], [x + rx, y + ry * 0.2], [x, y + ry]]);
    paint(ctx, '#1c1028', LD);
    glow(ctx, x - 0.5, y + 0.5, rx * 2.2, P.eyeC, 0.8);
    ell(ctx, x - 0.8, y + 1, rx * 0.42, ry * 0.46); ctx.fillStyle = mix(P.eyeC, '#ffffff', 0.45); ctx.fill();
    ell(ctx, x - 1.6, y, rx * 0.14, ry * 0.14); ctx.fillStyle = '#ffffff'; ctx.fill();
  };
  socket(hx - 17, hy - 4, 5.4, 6.4, 1);
  socket(hx - 2, hy - 5, 7, 8, -1);
  brow(ctx, hx - 24, hy - 13, hx - 14, hy - 10.5, 3.6);
  brow(ctx, hx + 8, hy - 17, hx - 4, hy - 13.5, 4.2);
  // bras avant (tient l'os)
  boneLimb(ctx, [[-2, -42 + by], [-11, -33 + by], [-13, -37 + by]], 5.5, P.bone);
  oval(ctx, -14, -38 + by, 4.6, 4.4, P.bone, { lw: LD + 0.5, hi: 0 });
  // variantes
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[hx - 12, hy - 17], [hx + 2, hy - 26], [hx + 18, hy - 19], [hx + 21, hy - 10], [hx + 5, hy - 16], [hx - 10, hy - 13]]), hx + 3, hy - 18, 10, [[hx + 3, hy - 19.5]]);
    goldPlate(ctx, () => smooth(ctx, [[2, -50 + by], [14, -52 + by], [19, -43 + by], [9, -41 + by]]), 10, -47 + by, 7, []);
  }
  crest(ctx, P, [[hx - 2, hy - 23, -1.7, 8], [hx + 10, hy - 19, -1.2, 8], [hx + 18, hy - 8, -0.6, 6]], a.f);
  motes(ctx, P, [[-38, -84, 2], [36, -62, 1.8], [-36, -16, 1.6]], a.f);
}

// =====================================================================
//  USINE — Robot à engrenages (à remontoir)
// =====================================================================
function gear(ctx, x, y, r, n, rot, col, lw = LD + 0.5) {
  const sh = () => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t0 = rot + i * TAU / n;
      for (const [dt, rr2] of [[-0.3, r * 0.8], [-0.17, r], [0.17, r], [0.3, r * 0.8]]) {
        const t = t0 + dt * TAU / n * 1.6; ctx.lineTo(x + Math.cos(t) * rr2, y + Math.sin(t) * rr2);
      }
    }
    ctx.closePath();
  };
  C(ctx, sh, col, x, y, r, { lw, glint: false, hi: 0.2 });
  ell(ctx, x, y, r * 0.32, r * 0.32); paint(ctx, shade(col, -0.35), LD);
}
function drawGearbot(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { metal: '#9eacc6' }, { brass: '#d8963e', screen: '#1e2238', boot: '#4a4e6a' }, { acc: '#ff8a1a', led: '#3ae4ff' });
  const by = -a.up * 2;
  const metalD = shade(P.metal, -0.22);
  const gr = a.f * (TAU / 8) / 4;
  // engrenage dorsal (tourne)
  gear(ctx, 12, -70 + by * 1.2, 15, 8, gr, P.brass);
  // remontoir dans le dos (tourne)
  const kw = Math.cos(a.f * Math.PI / 4) * 9;
  limb(ctx, [[16, -30 + by], [26, -30 + by]], 4, 4, metalD, { lw: LD });
  C(ctx, () => { ell(ctx, 29, -36 + by, Math.max(1.5, Math.abs(kw) * 0.55), 6); }, P.brass, 29, -36 + by, 6, { lw: LD + 0.5, glint: false });
  C(ctx, () => { ell(ctx, 29, -24 + by, Math.max(1.5, Math.abs(kw) * 0.55), 6); }, P.brass, 29, -24 + by, 6, { lw: LD + 0.5, glint: false });
  // jambes à ressort
  const leg = (hx, sg, col) => {
    const dx = sg * a.c * 4, lift = Math.max(0, sg * a.s) * 4;
    limb(ctx, [[hx, -18 + by], [hx + dx * 0.5, -9 - lift]], 6, 5, col, { lw: LD + 0.5 });
    for (let i = 0; i < 3; i++) line(ctx, [[hx - 4 + dx * 0.3, -15 + i * 3 + by * 0.5 - lift * 0.4], [hx + 4 + dx * 0.3, -14 + i * 3 + by * 0.5 - lift * 0.4]], 1.6, OUT);
    C(ctx, () => rr(ctx, hx - 9 + dx, -8 - lift, 15, 8, 3.5), P.boot, hx - 2 + dx, -4 - lift, 8, { lw: LD + 0.5, glint: false });
  };
  leg(8, -1, metalD);
  // bras arrière (pince)
  limb(ctx, [[10, -34 + by], [16, -24 + by], [12, -16 + by - a.s]], 4.5, 4, metalD, { lw: LD + 0.5 });
  oval(ctx, 12, -15 + by - a.s, 4, 4, shade(P.brass, -0.2), { lw: LD });
  // torse-tonneau
  const tor = () => rr(ctx, -16, -42 + by, 34, 28, 9);
  C(ctx, tor, P.metal, 0, -28 + by, 16);
  clipTo(ctx, tor, () => {
    ctx.fillStyle = P.acc; ctx.fillRect(-20, -22 + by, 42, 8);
    ctx.fillStyle = '#2b1838';
    for (let i = -3; i < 6; i++) { poly(ctx, [[-16 + i * 7, -14 + by], [-12 + i * 7, -22 + by], [-9 + i * 7, -22 + by], [-13 + i * 7, -14 + by]]); ctx.fill(); }
    line(ctx, [[-20, -22 + by], [22, -22 + by]], 2, OUT); line(ctx, [[-20, -14 + by], [22, -14 + by]], 2, OUT);
  });
  tor(); paint(ctx, null, LW);
  // hublot avec engrenage qui tourne
  ell(ctx, 1, -32 + by, 7.5, 7); paint(ctx, P.screen, LD + 0.5);
  clipTo(ctx, () => ell(ctx, 1, -32 + by, 7.5, 7), () => gear(ctx, 1, -32 + by, 6.5, 6, -gr * 1.3, P.brass, 1.4));
  gloss(ctx, -2, -35 + by, 2.4, 1.4, 0.7);
  cracks(ctx, P, tor, 4, -30 + by, 14, 17, 2, -0.6, 0.9);
  leg(-6, 1, P.metal);
  // tête-écran
  const hx = -9, hy = -60 + by * 1.3;
  // antenne
  limb(ctx, [[hx + 2, hy - 18], [hx + 1 + a.s, hy - 27]], 3, 2.6, metalD, { lw: LD });
  glow(ctx, hx + 1 + a.s, hy - 29, 8, P.led, a.f % 2 ? 0.9 : 0.5);
  oval(ctx, hx + 1 + a.s, hy - 29, 3.6, 3.6, P.led, { lw: LD });
  const head = () => rr(ctx, hx - 22, hy - 19, 44, 36, 11);
  C(ctx, head, P.metal, hx, hy, 22);
  // boulon d'oreille
  oval(ctx, hx + 21, hy + 1, 5, 6, P.brass, { lw: LD + 0.5 });
  line(ctx, [[hx + 19, hy - 1], [hx + 23, hy + 3]], 1.6);
  const scr = () => rr(ctx, hx - 19, hy - 13, 33, 25, 7);
  scr(); paint(ctx, P.screen, LD + 0.5);
  // yeux LED fâchés + sourcils de métal
  const led = (x, y, w, h, inner) => {
    glow(ctx, x, y, w * 1.8, P.led, 0.75);
    const pts = inner > 0 ? [[x - w, y - h * 0.5], [x + w, y - h * 0.05], [x + w * 0.85, y + h * 0.65], [x - w * 0.9, y + h * 0.65]] : [[x + w, y - h * 0.5], [x - w, y - h * 0.05], [x - w * 0.85, y + h * 0.65], [x + w * 0.9, y + h * 0.65]];
    smooth(ctx, pts, true, 0.25); ctx.fillStyle = P.led; ctx.fill();
    ell(ctx, x - w * 0.25, y + h * 0.2, w * 0.38, h * 0.38); ctx.fillStyle = OUT; ctx.fill();
    ell(ctx, x - w * 0.4, y - h * 0.02, w * 0.2, h * 0.15); ctx.fillStyle = '#ffffff'; ctx.fill();
  };
  const blink = a.f === 3;
  if (!blink) { led(hx - 11, hy - 3, 5.2, 8, 1); led(hx + 3, hy - 3.5, 6, 9, -1); }
  else { for (const x of [hx - 11, hx + 3]) { glow(ctx, x, hy, 9, P.led, 0.6); line(ctx, [[x - 5, hy], [x + 5, hy]], 2.6, P.led); } }
  C(ctx, () => poly(ctx, [[hx - 19, hy - 13], [hx - 5, hy - 8], [hx - 5, hy - 12], [hx - 17, hy - 17]]), metalD, hx - 11, hy - 12, 6, { lw: LD, glint: false });
  C(ctx, () => poly(ctx, [[hx + 13, hy - 15], [hx - 3, hy - 8], [hx - 3, hy - 12], [hx + 12, hy - 19]]), metalD, hx + 4, hy - 13, 6, { lw: LD, glint: false });
  // bouche LED en dents de scie
  ctx.beginPath(); ctx.moveTo(hx - 15, hy + 6);
  for (let i = 0; i < 6; i++) ctx.lineTo(hx - 13 + i * 4, hy + (i % 2 ? 6 : 9.5));
  ctx.lineWidth = 2; ctx.strokeStyle = P.led; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.lineJoin = 'round';
  head(); paint(ctx, null, LW);
  for (const [x, y] of [[hx - 18, hy - 16], [hx + 16, hy - 16], [hx + 16, hy + 14]]) { ell(ctx, x, y, 1.4, 1.4); ctx.fillStyle = metalD; ctx.fill(); }
  // bras avant + clé à molette brandie
  const wy = -a.s * 2;
  limb(ctx, [[-10, -36 + by], [-20, -30 + by], [-25, -40 + by + wy]], 4.8, 4.4, P.metal, { lw: LD + 0.5 });
  ctx.save(); ctx.translate(-25, -42 + by + wy); ctx.rotate(-0.5 + a.s * 0.12);
  C(ctx, () => rr(ctx, -3, -26, 6, 30, 3), metalD, 0, -10, 8, { lw: LD + 0.5, glint: false });
  C(ctx, () => { ctx.beginPath(); ctx.arc(0, -30, 8, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6 + TAU, false); ctx.lineTo(-2.6, -31); ctx.lineTo(2.6, -31); ctx.closePath(); }, P.metal, 0, -30, 8, { lw: LD + 0.5 });
  ctx.restore();
  oval(ctx, -25, -41 + by + wy, 4.4, 4.4, shade(P.brass, -0.1), { lw: LD });
  // variantes
  if (v === 1) {
    goldPlate(ctx, () => rr(ctx, hx - 23, hy - 22, 46, 7, 3.5), hx, hy - 19, 10, [[hx - 14, hy - 18.5], [hx, hy - 18.5], [hx + 14, hy - 18.5]]);
  }
  crest(ctx, P, [[hx - 12, hy - 21, -1.75, 7], [hx + 12, hy - 21, -1.35, 7]], a.f);
  motes(ctx, P, [[-40, -76, 2], [34, -60, 1.8], [-36, -16, 1.6]], a.f);
}

// =====================================================================
//  USINE — Conserve maléfique (le couvercle mord)
// =====================================================================
function drawCan(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { tin: '#c6cee0' }, { food: '#a2603c', shoe: '#3a3e5a' }, { acc: '#e8344a' });
  const hop = [0, -6, -1, -5][a.f];
  const sx = [1.06, 0.95, 1.03, 0.96][a.f], sy = [0.93, 1.06, 0.97, 1.05][a.f];
  const tinD = shade(P.tin, -0.25);
  // petites jambes
  for (const [x, sg] of [[-7, 1], [8, -1]]) {
    const dx = sg * a.c * 2;
    limb(ctx, [[x, -10 + hop], [x + dx, -5 + hop * 0.4]], 4, 4, tinD, { lw: LD });
    C(ctx, () => rr(ctx, x - 6 + dx, -7 + hop * 0.4, 11, 6.5, 3), P.shoe, x + dx, -4, 6, { lw: LD + 0.5, glint: false });
  }
  ctx.save(); ctx.translate(0, hop); squash(ctx, 0, -8, sx, sy);
  const rx = 20, ery = 6, top = -50, bot = -10;
  // couvercle (charnière à l'arrière), s'ouvre
  const op = [0.25, 0.95, 0.4, 0.8][a.f];
  // intérieur sombre
  const inside = () => ell(ctx, 0, top, rx - 1, ery);
  inside(); paint(ctx, MOUTH, LD);
  clipTo(ctx, inside, () => {
    ell(ctx, -3, top + 4, 14, 5); ctx.fillStyle = P.food; ctx.fill();
    ell(ctx, -8, top + 1, 6, 3.4); ctx.fillStyle = TONGUE; ctx.fill();
  });
  // corps du cylindre
  const body = () => {
    ctx.beginPath(); ctx.moveTo(-rx, top); ctx.lineTo(-rx, bot);
    ctx.ellipse(0, bot, rx, ery, 0, Math.PI, 0, true); ctx.lineTo(rx, top);
    ctx.ellipse(0, top, rx, ery, 0, 0, Math.PI, false); ctx.closePath();
  };
  C(ctx, body, P.tin, -4, -32, 18);
  clipTo(ctx, body, () => {
    // rainures
    for (const y of [top + 9, bot - 4]) { ctx.beginPath(); ctx.ellipse(0, y, rx, ery, 0, 0, Math.PI); ctx.lineWidth = 1.6; ctx.strokeStyle = tinD; ctx.stroke(); }
    // étiquette
    ctx.beginPath(); ctx.ellipse(0, -30, rx + 1, ery, 0, Math.PI, 0, true); ctx.lineTo(rx + 1, -14); ctx.ellipse(0, -14, rx + 1, ery, 0, 0, Math.PI, false); ctx.closePath();
    ctx.fillStyle = P.acc; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -14, rx + 1, ery, 0, 0, Math.PI, false); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -30, rx + 1, ery, 0, 0, Math.PI, false); ctx.stroke();
    // poisson-logo
    smooth(ctx, [[-14, -22], [-8, -27], [0, -25], [3, -22], [0, -19], [-8, -18]]); paint(ctx, '#ffffff', 1.6);
    poly(ctx, [[2, -22], [8, -26], [7, -18]]); paint(ctx, '#ffffff', 1.6);
    ell(ctx, -9, -23.2, 1.1, 1.1); ctx.fillStyle = OUT; ctx.fill();
    ell(ctx, 10, -10, 8, 26); fillA(ctx, '#2b1838', 0.12);
  });
  body(); paint(ctx, null, LW);
  cracks(ctx, P, body, 8, -30, 14, 19, 2, -0.5, 0.9);
  // dents du bord
  for (let i = 0; i < 7; i++) {
    const t = Math.PI * (0.12 + i * 0.13), x = Math.cos(t) * (rx - 2) * -1, y = top + Math.sin(t) * ery * 0.9;
    poly(ctx, [[x - 2.6, y + 1], [x + 2.6, y + 1], [x, y - 5]]); paint(ctx, TOOTH, 1.3);
  }
  // couvercle ouvert
  ctx.save(); ctx.translate(rx - 1, top); ctx.rotate(op);
  const lid = () => ell(ctx, -rx + 1, 0, rx, ery);
  C(ctx, lid, shade(P.tin, 0.08), -rx, -2, 14, { lw: LW });
  ell(ctx, -rx + 1, 0, rx - 5, ery - 2); ctx.lineWidth = 1.6; ctx.strokeStyle = tinD; ctx.stroke();
  for (let i = 0; i < 6; i++) { const x = -rx * 2 + 6 + i * 6, y = ery * 0.75; poly(ctx, [[x - 2.4, y - 1], [x + 2.4, y - 1], [x, y + 4.2]]); paint(ctx, TOOTH, 1.3); }
  // languette
  ell(ctx, -rx + 4, -1.5, 4.5, 2.2); ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.8; ctx.strokeStyle = shade(P.tin, 0.2); ctx.stroke();
  ctx.restore();
  // visage
  eye(ctx, P, -12, -37, 4.8, 5.6, { inner: 1, anger: 0.65, lid: P.tin, iris: '#c81838' });
  eye(ctx, P, 2, -38, 6, 7, { inner: -1, anger: 0.65, lid: P.tin, iris: '#c81838' });
  brow(ctx, -18, -45, -9, -42, 3.4);
  brow(ctx, 10, -48, -1, -44, 4);
  ctx.restore();
  // bras + fourchette
  const fy = -32 + hop - a.s * 2;
  limb(ctx, [[-16, -26 + hop], [-24, -28 + hop], [-27, fy]], 3.6, 3.4, tinD, { lw: LD });
  limb(ctx, [[-27, fy + 6], [-27, fy - 16]], 3, 3, '#c8cee0', { lw: LD });
  for (const dx of [-3, 0, 3]) limb(ctx, [[-27 + dx, fy - 14], [-27 + dx, fy - 22]], 2, 2, '#c8cee0', { lw: 1.4 });
  oval(ctx, -27, fy, 3.4, 3.4, tinD, { lw: LD, hi: 0, glint: false });
  // variantes
  if (v === 1) {
    goldPlate(ctx, () => { ctx.beginPath(); ctx.ellipse(0, bot - 2 + hop, rx + 1, ery, 0, Math.PI, 0, true); ctx.lineTo(rx + 1, bot + 2 + hop); ctx.ellipse(0, bot + 2 + hop, rx + 1, ery, 0, 0, Math.PI, false); ctx.closePath(); }, 0, bot + hop, 10, [[-12, bot + 4 + hop], [0, bot + 6 + hop], [12, bot + 4 + hop]]);
  }
  crest(ctx, P, [[-14, top + 6 + hop, Math.PI + 0.3, 6], [16, top + 10 + hop, -0.3, 6]], a.f);
  if (v === 2) drip(ctx, -10, top + 4 + hop, 7);
  motes(ctx, P, [[-36, -64, 2], [30, -70, 1.8], [30, -16, 1.6]], a.f);
}

// =====================================================================
//  NUAGES — Corbeau voleur (casquette de gavroche, sac de butin)
// =====================================================================
function featherWing(ctx, x, y, ang, len, col, tip, dir = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(ang);
  const sh = () => smooth(ctx, [[-4, 2], [len * 0.3, -6], [len * 0.75, -5], [len, 2], [len * 0.84, 6], [len * 0.92, 10], [len * 0.66, 9], [len * 0.7, 14], [len * 0.42, 11], [len * 0.36, 15], [len * 0.12, 9]]);
  C(ctx, sh, col, len * 0.4, 2, len * 0.35, { glint: false });
  clipTo(ctx, sh, () => { smooth(ctx, [[len * 0.6, 4], [len * 1.1, -2], [len * 1.1, 20], [len * 0.4, 20]]); ctx.fillStyle = tip; ctx.fill(); });
  sh(); paint(ctx, null, LW);
  line(ctx, [[len * 0.2, 4], [len * 0.62, 6]], 1.6, shade(col, -0.35));
  ctx.restore();
}
function drawCrow(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { feather: '#4a4880' }, { beak: '#ffb02a', cap: '#8f6a48', sack: '#b8875a' }, { acc: '#ff6a2a' }, { coin: [GOLD, GOLD, '#c9ff7a', '#ffb347'] });
  const by = [1, -1, -3, -1][a.f];
  const wa = [-1.1, -0.45, 0.25, -0.45][a.f];
  const fD = shade(P.feather, -0.2);
  ctx.save(); ctx.translate(0, by);
  // aile arrière
  featherWing(ctx, 10, -54, wa - 0.25, 34, fD, shade(fD, -0.2));
  // queue en éventail
  blob(ctx, [[16, -48], [34, -52], [44, -48], [40, -42], [44, -36], [32, -38], [16, -40]], fD, 28, -44, 12, { glint: false });
  // pattes + sac de butin
  const sx = 2 + a.s, sy = -15;
  limb(ctx, [[0, -38], [1, -30], [sx - 1, sy - 8]], 3.4, 3, P.beak, { lw: LD });
  limb(ctx, [[8, -38], [8, -30], [sx + 5, sy - 8]], 3.4, 3, shade(P.beak, -0.15), { lw: LD });
  const sack = () => smooth(ctx, [[sx - 5, sy - 6], [sx + 6, sy - 6], [sx + 12, sy + 4], [sx + 9, sy + 13], [sx - 7, sy + 13], [sx - 10, sy + 4]]);
  C(ctx, sack, P.sack, sx, sy + 4, 11);
  oval(ctx, sx + 1, sy - 8, 7, 3.4, P.sack, { lw: LD + 0.5, hi: 0, glint: false });
  for (const [x, y] of [[sx - 2, sy - 11], [sx + 4, sy - 12]]) oval(ctx, x, y, 3.6, 3.2, P.coin, { lw: LD, hi: 0.3 });
  sparkle(ctx, sx + 9, sy - 14 + a.up * 2, 3.4, '#fff8c0');
  line(ctx, [[sx - 5, sy + 3], [sx - 1, sy + 7], [sx + 4, sy + 2]], 1.8, shade(P.sack, -0.4));
  // corps
  const body = () => smooth(ctx, [[-16, -50], [-4, -62], [14, -60], [22, -50], [18, -38], [4, -32], [-10, -36]]);
  C(ctx, body, P.feather, 4, -48, 16);
  // écharpe qui flotte
  limb(ctx, [[8, -58], [20, -62 + a.s * 2], [30, -58 + a.s * 4], [38, -62 + a.s * 3]], 6.5, 5, shade(P.acc, -0.1), { lw: LD + 0.5 });
  // tête
  const hx = -12, hy = -64;
  const head = () => ell(ctx, hx, hy, 17, 16);
  C(ctx, head, P.feather, hx, hy, 17);
  cracks(ctx, P, body, 8, -48, 12, 23, 2, -0.6, 1.2);
  // écharpe autour du cou
  C(ctx, () => smooth(ctx, [[-22, -52], [-10, -50], [4, -52], [10, -58], [12, -50], [2, -44], [-12, -43], [-22, -46]]), P.acc, -6, -49, 12, { lw: LD + 0.5 });
  // bec
  const bk = [0.06, 0.14, 0.04, 0.1][a.f];
  ctx.save(); ctx.translate(hx - 12, hy + 5); ctx.rotate(-bk);
  C(ctx, () => smooth(ctx, [[2, -1], [-10, 0], [-21, 4], [-10, 6], [2, 5]]), shade(P.beak, -0.15), -8, 3, 7, { glint: false });
  ctx.restore();
  C(ctx, () => smooth(ctx, [[hx - 9, hy - 2], [hx - 22, hy - 1], [hx - 34, hy + 5], [hx - 22, hy + 6], [hx - 9, hy + 6]]), P.beak, hx - 20, hy + 2, 9);
  ell(ctx, hx - 20, hy + 0.5, 1.2, 0.9); ctx.fillStyle = OUT; ctx.fill();
  // yeux
  eye(ctx, P, hx - 8, hy - 4, 4.6, 5.6, { inner: 1, anger: 0.55, lid: P.feather, iris: '#e8a010' });
  eye(ctx, P, hx + 4, hy - 5, 5.8, 6.8, { inner: -1, anger: 0.55, lid: P.feather, iris: '#e8a010' });
  brow(ctx, hx - 14, hy - 11, hx - 5, hy - 9, 3.2, '#16102a');
  brow(ctx, hx + 11, hy - 14, hx, hy - 11, 3.8, '#16102a');
  // casquette de gavroche
  const capS = () => smooth(ctx, [[hx - 14, hy - 10], [hx - 10, hy - 19], [hx + 2, hy - 23], [hx + 15, hy - 18], [hx + 18, hy - 9], [hx + 4, hy - 13], [hx - 8, hy - 12]]);
  C(ctx, capS, P.cap, hx + 2, hy - 16, 14);
  clipTo(ctx, capS, () => { for (const x of [-6, 0, 6, 12]) line(ctx, [[hx + x, hy - 26], [hx + x + 3, hy - 8]], 1.4, shade(P.cap, -0.3)); });
  capS(); paint(ctx, null, LW);
  C(ctx, () => smooth(ctx, [[hx - 12, hy - 12], [hx - 22, hy - 12], [hx - 25, hy - 9], [hx - 12, hy - 8]]), shade(P.cap, -0.15), hx - 18, hy - 10, 6, { lw: LD + 0.5, glint: false });
  oval(ctx, hx + 3, hy - 22.5, 2.6, 2, shade(P.cap, -0.2), { lw: LD, hi: 0, glint: false });
  // aile avant
  featherWing(ctx, 6, -52, wa, 32, P.feather, fD);
  if (v === 1) goldPlate(ctx, () => smooth(ctx, [[hx - 14, hy - 11], [hx + 2, hy - 15], [hx + 18, hy - 10], [hx + 17, hy - 7], [hx + 2, hy - 11], [hx - 13, hy - 8]]), hx + 2, hy - 11, 8, []);
  crest(ctx, P, [[hx - 2, hy - 23, -1.8, 7], [hx + 8, hy - 21, -1.3, 7]], a.f);
  ctx.restore();
  motes(ctx, P, [[-38, -76, 2], [40, -76, 1.8], [-30, -30, 1.6]], a.f);
}

// =====================================================================
//  NUAGES — Nuage orageux
// =====================================================================
function bolt(ctx, pts, w, col = '#ffe23a') {
  glow(ctx, pts[Math.floor(pts.length / 2)][0], pts[Math.floor(pts.length / 2)][1], 18, col, 0.6);
  poly(ctx, pts, false); ctx.lineJoin = 'miter';
  ctx.lineWidth = w + 3; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
  ctx.lineWidth = Math.max(1, w * 0.35); ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.lineJoin = 'round';
}
function drawStormcloud(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { cloud: '#8f9ac4' }, { rain: '#7ac8ff' }, { acc: '#ffe23a' });
  const by = [0, -2, -3, -1][a.f];
  const cD = shade(P.cloud, -0.22);
  ctx.save(); ctx.translate(0, by);
  // éclair ou pluie dessous (alterné)
  if (a.f === 1 || a.f === 3) {
    const ox = a.f === 1 ? -4 : 8;
    bolt(ctx, [[ox, -30], [ox - 6, -18], [ox + 2, -18], [ox - 5, -4]], 3.4, P.acc);
  }
  for (let i = 0; i < 4; i++) {
    const x = -16 + i * 9, y = -24 + ((a.f * 5 + i * 7) % 14);
    if ((a.f === 1 || a.f === 3) && Math.abs(x - (a.f === 1 ? -6 : 6)) < 6) continue;
    limb(ctx, [[x + 1, y], [x - 1, y + 5]], 2.6, 2.6, P.rain, { lw: 1.4 });
  }
  // bras-nuage qui brandit un éclair
  const ay = -a.s * 2;
  bolt(ctx, [[24, -82 + ay], [19, -72 + ay], [26, -71 + ay], [20, -58 + ay]], 3.4, P.acc);
  oval(ctx, 22, -60 + ay, 6, 5.5, cD, { lw: LD + 0.5 });
  // corps de nuage
  const puffs = [[-24, -44, 12], [-12, -58, 15], [8, -62, 15], [24, -48, 12], [14, -38, 13], [-6, -38, 14], [2, -48, 18]];
  const body = () => { ctx.beginPath(); for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } };
  // contour commun : on trace les cercles épais d'abord, puis le remplissage
  ctx.save(); ctx.lineWidth = LW * 2; ctx.strokeStyle = OUT; body(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = cD; body(); ctx.fill();
  clipTo(ctx, body, () => {
    ctx.save(); ctx.translate(-2.5, -3.5); ctx.fillStyle = P.cloud; body(); ctx.fill(); ctx.restore();
    for (const [x, y, r] of [[-12, -60, 7], [6, -66, 6], [-24, -48, 4]]) { ell(ctx, x - 2, y, r, r * 0.6, -0.4); ctx.fillStyle = shade(P.cloud, 0.25); ctx.fill(); }
    ell(ctx, 2, -28, 30, 7); fillA(ctx, shade(cD, -0.2), 0.6);
  });
  cracks(ctx, P, body, 10, -50, 16, 29, 2, -1.0, 0.6);
  // joues gonflées + visage fâché
  blush(ctx, -20, -40, 4.5, 2.8, 0.35, '#c87ab8');
  blush(ctx, 8, -41, 5.5, 3.2, 0.35, '#c87ab8');
  eye(ctx, P, -15, -49, 4.8, 5.6, { inner: 1, anger: 0.7, lid: P.cloud, iris: '#2a4a9a' });
  eye(ctx, P, -1, -50, 6, 7, { inner: -1, anger: 0.7, lid: P.cloud, iris: '#2a4a9a' });
  brow(ctx, -22, -58, -12, -55, 3.8);
  brow(ctx, 8, -61, -4, -56.5, 4.4);
  // dents serrées
  const mth = () => rr(ctx, -16, -40, 18, 7, 3);
  mth(); paint(ctx, TOOTH, LD);
  clipTo(ctx, mth, () => { for (const x of [-11, -6, -1, 4]) line(ctx, [[x, -41], [x, -32]], 1.4); line(ctx, [[-17, -36.5], [3, -36.5]], 1.4); });
  mth(); paint(ctx, null, LD);
  // petites étincelles
  if (a.f % 2 === 0) { sparkle(ctx, -30, -64, 3.4, P.acc); sparkle(ctx, 32, -36, 2.6, P.acc); } else sparkle(ctx, -28, -32, 3, P.acc);
  if (v === 1) {
    goldPlate(ctx, () => arcBand(ctx, -3, -56, 16, 14, -2.6, -0.6, 2, 2.5), -3, -70, 9, []);
  }
  crest(ctx, P, [[-14, -72, -1.8, 7], [6, -76, -1.5, 8], [22, -60, -0.9, 7]], a.f);
  ctx.restore();
  motes(ctx, P, [[-40, -64, 2], [40, -76, 1.8], [-38, -26, 1.6]], a.f);
}

// =====================================================================
//  BONBONS — Ourson gélifié (translucide, une oreille croquée)
// =====================================================================
// Forme gélifiée translucide : fond semi-transparent, cœur plus dense, reflets brillants.
function jelly(ctx, shape, base, cx, cy, size, o = {}) {
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 0.78;
  cel(ctx, shape, base, { cx, cy, size, lw: 0, hi: 0, glint: false, shadow: 0.3, depth: 0.28 });
  ctx.restore();
  clipTo(ctx, shape, () => {
    ell(ctx, cx + size * 0.12, cy + size * 0.12, size * 0.55, size * 0.5); fillA(ctx, shade(base, -0.18), 0.45);
    ell(ctx, cx + size * 0.55, cy + size * 0.35, size * 0.3, size * 0.5, -0.5); fillA(ctx, shade(base, 0.5), 0.35);
  });
  shape(); paint(ctx, null, o.lw ?? LW);
  gloss(ctx, cx - size * 0.42, cy - size * 0.45, size * 0.26, size * 0.13, 0.9, -0.6);
  gloss(ctx, cx - size * 0.15, cy - size * 0.62, size * 0.07, size * 0.05, 0.9, -0.6);
}
function drawGummy(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { jelly: '#4fd44a' }, { stick: '#fff4f8' }, { acc: '#ff5aa8' });
  const jsx = [1.06, 0.95, 1.04, 0.97][a.f], jsy = [0.94, 1.05, 0.96, 1.03][a.f];
  const jD = shade(P.jelly, -0.15);
  // sucette-gourdin (posée sur l'épaule, vers l'arrière)
  const lx = 30 + a.c, ly = -50 - a.up * 1.5;
  limb(ctx, [[8, -26], [lx, ly]], 3.8, 3.8, P.stick, { lw: LD });
  const lol = () => ell(ctx, lx, ly, 11.5, 11.5);
  C(ctx, lol, P.stick, lx, ly, 11, { glint: false, hi: 0 });
  clipTo(ctx, lol, () => {
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(a.f * 0.6);
    ctx.beginPath(); for (let t = 0; t < TAU * 2.4; t += 0.15) { const r = t * 0.78; ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
    ctx.lineWidth = 3.8; ctx.strokeStyle = P.acc; ctx.stroke(); ctx.restore();
  });
  lol(); paint(ctx, null, LW);
  gloss(ctx, lx - 4, ly - 5, 3, 1.6, 0.8);
  // jambes
  for (const [x, sg] of [[8, -1], [-6, 1]]) {
    const dx = sg * a.c * 3, lift = Math.max(0, sg * a.s) * 3;
    jelly(ctx, () => ell(ctx, x + dx, -6 - lift, 7.5, 6.5), x === 8 ? jD : P.jelly, x + dx, -6 - lift, 7);
  }
  ctx.save(); squash(ctx, 0, -4, jsx, jsy);
  // bras arrière (tient la sucette)
  jelly(ctx, () => ell(ctx, 10, -27, 6, 7, -0.8), jD, 10, -27, 6);
  // corps
  jelly(ctx, () => smooth(ctx, [[-13, -30], [0, -35], [13, -30], [16, -15], [10, -6], [-8, -6], [-15, -15]]), P.jelly, 0, -19, 16);
  ell(ctx, -1, -17, 6.5, 7.5); fillA(ctx, '#ffffff', 0.22);
  // oreilles (une croquée)
  const earBite = (x, y, r) => {
    const pts = [];
    for (let i = 0; i < 32; i++) {
      const t = -Math.PI + i * TAU / 32;
      let rr2 = r;
      if (t > -1.3 && t < 0.2) rr2 = r - 3 - Math.abs(Math.sin((t + 1.3) / 1.5 * Math.PI * 2)) * 1.8;
      pts.push([x + Math.cos(t) * rr2, y + Math.sin(t) * rr2]);
    }
    return () => poly(ctx, pts);
  };
  jelly(ctx, () => ell(ctx, -18, -66, 7.5, 7.5), jD, -18, -66, 7.5);
  jelly(ctx, earBite(10, -67, 9), P.jelly, 10, -67, 9);
  // tête (grosse)
  const head = () => smooth(ctx, [[-28, -48], [-23, -63], [-7, -70], [11, -67], [20, -54], [18, -40], [5, -33], [-13, -33], [-25, -39]]);
  jelly(ctx, head, P.jelly, -4, -51, 23);
  cracks(ctx, P, head, 8, -54, 14, 31, 2, -0.9, 0.5);
  // museau
  jelly(ctx, () => ell(ctx, -21, -42, 8, 6), shade(P.jelly, 0.15), -21, -42, 8, { lw: LD + 0.5 });
  oval(ctx, -26.5, -45, 3.8, 2.8, shade(P.jelly, -0.6), { lw: LD });
  // visage grognon
  eye(ctx, P, -18, -55, 4.8, 5.6, { inner: 1, anger: 0.7, lid: P.jelly, iris: '#2a1a3a' });
  eye(ctx, P, -4, -56, 6.2, 7.2, { inner: -1, anger: 0.7, lid: P.jelly, iris: '#2a1a3a' });
  brow(ctx, -25, -63, -15, -60, 3.6);
  brow(ctx, 5, -66, -7, -62, 4.2);
  line(ctx, [[-27, -37.5], [-21, -39.5], [-14, -37]], 2.2);
  fang(ctx, -21.5, -39, 2.8, 3.4, 1.3);
  blush(ctx, -9, -44, 4, 2.4, 0.35);
  // bras avant (poing)
  jelly(ctx, () => ell(ctx, -15, -24 - a.s, 6.2, 6.8), P.jelly, -15, -24 - a.s, 6);
  ctx.restore();
  // grains de sucre
  for (const [x, y] of [[-10, -72], [16, -46], [-30, -30], [4, -12]]) sparkle(ctx, x, y + (a.f % 2), 2.2, '#ffffff', 0.9);
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[-13, -32], [0, -36], [13, -32], [11, -27], [0, -30], [-11, -27]]), 0, -31, 8, [[-6, -30], [6, -30]]);
  }
  crest(ctx, P, [[-6, -70, -1.7, 7], [3, -69, -1.35, 7]], a.f);
  motes(ctx, P, [[-38, -66, 2], [40, -30, 1.8], [-34, -18, 1.6]], a.f);
}

// =====================================================================
//  BONBONS — Cupcake mordant
// =====================================================================
function drawCupcake(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { frost: '#ff9ccc', cake: '#b4733e' }, { liner: '#36c4bc', liner2: '#f4fffd' }, { acc: '#ff2a4a' });
  const hop = [0, -5, -1, -4][a.f];
  const sx = [1.05, 0.96, 1.03, 0.97][a.f], sy = [0.95, 1.05, 0.97, 1.04][a.f];
  const open = [2, 9, 4, 7][a.f];
  // petites jambes
  for (const [x, sg] of [[-7, 1], [7, -1]]) {
    const dx = sg * a.c * 2;
    limb(ctx, [[x, -8 + hop], [x + dx, -4 + hop * 0.3]], 4, 4, shade(P.cake, -0.2), { lw: LD });
    oval(ctx, x - 1 + dx, -3.4 + hop * 0.3, 5.4, 3.4, shade(P.cake, -0.3), { lw: LD + 0.5, hi: 0, glint: false });
  }
  ctx.save(); ctx.translate(0, hop); squash(ctx, 0, -6, sx, sy);
  // gueule (intérieur)
  const my = -30;
  rr(ctx, -21, my - open - 3, 42, open + 7, 4); paint(ctx, MOUTH, LD);
  ell(ctx, -6, my + 1, 8, 2.4); ctx.fillStyle = TONGUE; ctx.fill();
  // caissette plissée
  const liner = () => poly(ctx, [[-23, my], [23, my], [17, -6], [-17, -6]]);
  C(ctx, liner, P.liner, 0, -18, 16);
  clipTo(ctx, liner, () => {
    for (let i = -5; i <= 5; i++) { poly(ctx, [[i * 4.6 - 1.2, my], [i * 4.6 + 1.2, my], [i * 3.4 + 0.9, -6], [i * 3.4 - 0.9, -6]]); fillA(ctx, P.liner2, 0.75); }
    ell(ctx, 12, -18, 7, 16); fillA(ctx, '#2b1838', 0.12);
  });
  liner(); paint(ctx, null, LW);
  // bord du gâteau + dents du bas
  rr(ctx, -22, my - 3.5, 44, 5, 2.5); paint(ctx, P.cake, LD + 0.5);
  for (let i = 0; i < 6; i++) { const x = -17 + i * 6.4; poly(ctx, [[x - 2.6, my - 2.5], [x + 2.6, my - 2.5], [x, my - 7.5]]); paint(ctx, TOOTH, 1.3); }
  // glaçage (la « tête »), soulevé par la gueule
  ctx.save(); ctx.translate(0, -open);
  const fr1 = () => smooth(ctx, [[-25, my - 2], [-24, my - 10], [-14, my - 16], [0, my - 18], [14, my - 16], [24, my - 10], [25, my - 2], [17, my + 2], [12, my - 1], [6, my + 3], [-2, my - 1], [-10, my + 3], [-16, my - 1]]);
  const fr2 = () => smooth(ctx, [[-17, my - 14], [-12, my - 24], [0, my - 28], [12, my - 24], [17, my - 14], [0, my - 12]]);
  const fr3 = () => smooth(ctx, [[-9, my - 25], [-6, my - 33], [2, my - 38], [8, my - 32], [9, my - 25], [0, my - 22]]);
  C(ctx, fr3, P.frost, 0, my - 30, 9, { glint: false });
  C(ctx, fr2, P.frost, 0, my - 20, 14, { glint: false });
  C(ctx, fr1, P.frost, 0, my - 8, 20);
  // dents du haut (sous le glaçage)
  for (let i = 0; i < 6; i++) { const x = -15 + i * 6.2; fang(ctx, x, my - 1, 4, 5.5 + (i === 1 || i === 4 ? 2 : 0), 1.3); }
  // vermicelles
  const R = seeded(77);
  const cols = ['#ffe23a', '#5ae0ff', '#ffffff', '#7a5cff', '#7dff6a'];
  for (let i = 0; i < 9; i++) {
    const x = -16 + R() * 32, y = my - 12 - R() * 22;
    if (Math.abs(x + 4) < 11 && y > my - 22) continue;
    const t = R() * Math.PI;
    limb(ctx, [[x - Math.cos(t) * 1.8, y - Math.sin(t) * 1.8], [x + Math.cos(t) * 1.8, y + Math.sin(t) * 1.8]], 2, 2, cols[i % cols.length], { lw: 1 });
  }
  // cerise
  const cy2 = my - 40 + (a.f === 1 ? -2 : a.f === 3 ? -1 : 0);
  line(ctx, [[2, cy2 - 2], [5, cy2 - 9], [10, cy2 - 11]], 2, OUT);
  oval(ctx, 1, cy2 + 1, 5.4, 5, P.acc, { lw: LD + 0.5 });
  // visage
  eye(ctx, P, -12, my - 9, 4.4, 5.2, { inner: 1, anger: 0.65, lid: P.frost, iris: '#7a1838' });
  eye(ctx, P, 1, my - 10, 5.6, 6.6, { inner: -1, anger: 0.65, lid: P.frost, iris: '#7a1838' });
  brow(ctx, -18, my - 16, -9, my - 14, 3.2);
  brow(ctx, 9, my - 19, -2, my - 15.5, 3.8);
  ctx.restore();
  cracks(ctx, P, liner, 6, -18, 12, 37, 2, -0.6, 0.6);
  ctx.restore();
  if (v === 1) {
    for (const x of [-12, 12]) goldSpike(ctx, x, my - 36 - open + hop, x < 0 ? -2.0 : -1.1, 7);
    goldPlate(ctx, () => rr(ctx, -18, -12 + hop, 36, 5, 2.5), 0, -10 + hop, 8, [[-10, -9.5 + hop], [0, -9.5 + hop], [10, -9.5 + hop]]);
  }
  if (v >= 2) crest(ctx, P, [[-14, my - 22 - open + hop, -2.0, 7], [14, my - 22 - open + hop, -1.1, 7]], a.f);
  if (v === 2) drip(ctx, 14, my - 2 - open + hop, 7);
  motes(ctx, P, [[-36, -64, 2], [32, -70, 1.8], [-34, -18, 1.6]], a.f);
}

// =====================================================================
//  BOSS — Rat-Pharaon (sur son sarcophage volant)
// =====================================================================
function ratEar(ctx, x, y, r, fur, pink, rot = 0) {
  oval(ctx, x, y, r, r * 0.95, fur, { rot });
  oval(ctx, x + r * 0.08, y + r * 0.1, r * 0.62, r * 0.56, pink, { lw: 0, hi: 0.15, glint: false, rot });
}
function ankh(ctx, x, y, k, col, gem) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  const sh = () => {
    ctx.beginPath();
    ctx.ellipse(0, -14, 7, 9, 0, 0, TAU);
    ctx.moveTo(-14, -2); ctx.lineTo(14, -2); ctx.lineTo(14, 4); ctx.lineTo(4, 4); ctx.lineTo(4, 22); ctx.lineTo(-4, 22); ctx.lineTo(-4, 4); ctx.lineTo(-14, 4); ctx.closePath();
  };
  ctx.save(); sh(); ctx.lineWidth = LW * 2 / k; ctx.strokeStyle = OUT; ctx.stroke(); ctx.restore();
  sh(); ctx.fillStyle = col; ctx.fill();
  ell(ctx, 0, -14, 3.4, 5); ctx.fillStyle = gem; ctx.fill(); ctx.lineWidth = 2 / k; ctx.strokeStyle = OUT; ctx.stroke();
  gloss(ctx, -3, -18, 1.8, 1, 0.8);
  ctx.restore();
}
function drawPharaohRat(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { fur: '#c9a27a' }, { linen: '#f6efdc', lapis: '#2f5fd6', pink: '#ff9ab8', wood: '#7a4a2a' }, { acc: '#1fd0c8' },
    { gold: [GOLD, GOLD, '#c6cc3a', '#ffa02a'], gem: ['#ff3a4a', '#ff3a4a', TOXIC, '#ffd23a'] });
  const bob = [0, -3, -5, -2][a.f];
  const goldD = shade(P.gold, -0.25);
  // aura magique sous le sarcophage + sable
  ctx.save(); ctx.scale(1.8, 1); glow(ctx, 3, -22, 26, P.acc, 0.45); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.55;
  for (let i = 0; i < 5; i++) { const x = -50 + i * 26 + (a.f * 4) % 12, y = -8 - ((i * 5 + a.f * 3) % 10); ell(ctx, x, y, 2.4, 1.6); ctx.fillStyle = '#e8c890'; ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.translate(0, bob - 8);
  // ---- queue (passe derrière le sarcophage)
  const tw = a.s * 3;
  limb(ctx, [[30, -76], [58, -72], [86, -62], [94, -44 + tw], [90, -28 + tw], [98, -20 + tw * 1.5]], 7, 3, P.pink, { lw: LD + 0.5 });
  for (const t of [0.35, 0.55]) { const p = along([[30, -76], [58, -72], [86, -62], [94, -44 + tw]], t); oval(ctx, p.x, p.y, 3, 4.6, P.gold, { lw: LD, hi: 0, glint: false, rot: 0.3 }); }
  // ---- sarcophage
  const sar = () => smooth(ctx, [[-70, -40], [-66, -56], [-40, -62], [20, -62], [70, -58], [86, -50], [84, -30], [66, -18], [10, -16], [-50, -18], [-68, -26]]);
  C(ctx, sar, P.gold, 8, -40, 50, { hi: 0.25 });
  clipTo(ctx, sar, () => {
    // bandeau lapis + hiéroglyphes
    smooth(ctx, [[-80, -46], [0, -50], [100, -46], [100, -26], [0, -28], [-80, -26]]); ctx.fillStyle = P.lapis; ctx.fill();
    for (let i = 0; i < 9; i++) { const x = -54 + i * 16; ctx.fillStyle = goldD; ctx.fillRect(x, -48, 3, 22); }
    // œil d'Horus
    const ex = 4, ey = -38;
    ell(ctx, ex, ey, 11, 6); paint(ctx, '#ffffff', 2);
    ell(ctx, ex, ey, 4.4, 4.6); ctx.fillStyle = OUT; ctx.fill();
    line(ctx, [[ex - 13, ey - 9], [ex, ey - 11], [ex + 14, ey - 8]], 3);
    line(ctx, [[ex + 10, ey + 2], [ex + 18, ey + 1]], 2.6);
    line(ctx, [[ex - 2, ey + 6], [ex - 3, ey + 13], [ex + 3, ey + 14]], 2.6);
    // scarabées
    for (const sx of [-36, 44]) { oval(ctx, sx, -37, 6, 7, P.acc, { lw: 1.8, hi: 0.2 }); line(ctx, [[sx, -44], [sx, -30]], 1.4); }
    ell(ctx, 6, -16, 80, 6); fillA(ctx, '#2b1838', 0.25);
  });
  sar(); paint(ctx, null, LW);
  // couvercle
  C(ctx, () => rr(ctx, -64, -66, 146, 9, 4.5), shade(P.gold, 0.08), 8, -62, 30, { lw: LW });
  cracks(ctx, P, sar, 40, -40, 30, 41, 3, -0.8, 1.4);
  // ---- jambes + sandales
  for (const [x, col] of [[18, shade(P.fur, -0.2)], [-8, P.fur]]) {
    limb(ctx, [[x, -84], [x - 1, -70]], 10, 9, col);
    C(ctx, () => rr(ctx, x - 10, -71, 17, 6, 3), P.gold, x - 2, -68, 8, { lw: LD + 0.5, glint: false });
  }
  // ---- bras arrière + fléau
  const fl = [44, -146 - a.up];
  limb(ctx, [[20, -112], [36, -118], [fl[0] - 2, fl[1] + 10]], 9, 8, shade(P.fur, -0.2));
  limb(ctx, [[fl[0] - 4, fl[1] + 16], [fl[0] + 2, fl[1] - 12]], 5, 5, P.gold, { lw: LD + 0.5 });
  for (let i = 0; i < 3; i++) {
    const sw = a.s * 4;
    const pts = [[fl[0] + 2, fl[1] - 12], [fl[0] + 10 + i * 4 + sw * 0.5, fl[1] - 4 + i * 2], [fl[0] + 14 + i * 4 + sw, fl[1] + 10 + i * 3]];
    for (let k = 0; k <= 4; k++) { const p = along(pts, k / 4); oval(ctx, p.x, p.y, 2.6, 2.6, k % 2 ? P.acc : P.gold, { lw: 1.6, hi: 0, glint: false }); }
  }
  oval(ctx, fl[0] - 2, fl[1] + 10, 6, 5.5, shade(P.fur, -0.2), { lw: LD + 0.5, hi: 0 });
  // ---- corps (ventre rond) + pagne
  const body = () => smooth(ctx, [[-18, -128], [2, -136], [24, -128], [34, -104], [30, -84], [10, -76], [-12, -78], [-24, -96]]);
  C(ctx, body, P.fur, 6, -104, 28);
  clipTo(ctx, body, () => { ell(ctx, -4, -96, 14, 16); ctx.fillStyle = shade(P.fur, 0.25); ctx.fill(); });
  body(); paint(ctx, null, LW);
  const kilt = () => poly(ctx, [[-16, -90], [30, -90], [34, -70], [-22, -70]]);
  C(ctx, kilt, P.linen, 6, -80, 18, { glint: false });
  clipTo(ctx, kilt, () => { for (let i = 0; i < 8; i++) line(ctx, [[-14 + i * 6, -88], [-18 + i * 7, -68]], 1.4, shade(P.linen, -0.25)); });
  kilt(); paint(ctx, null, LW);
  C(ctx, () => rr(ctx, -19, -94, 52, 7, 3.5), P.gold, 6, -90, 14, { lw: LD + 0.5 });
  oval(ctx, -2, -90.5, 4, 4, P.acc, { lw: LD });
  // ---- grand collier (ousekh)
  const nx = 0, ny = -128;
  const collar = () => arcBand(ctx, nx, ny, 26, 14, -0.2, Math.PI + 0.2, 0, -12);
  C(ctx, collar, P.gold, nx, ny + 12, 20);
  clipTo(ctx, collar, () => {
    arcBand(ctx, nx, ny, 26, 14, -0.2, Math.PI + 0.2, -4, -7.5); ctx.fillStyle = P.acc; ctx.fill();
    arcBand(ctx, nx, ny, 26, 14, -0.2, Math.PI + 0.2, -9, -11); ctx.fillStyle = P.lapis; ctx.fill();
  });
  collar(); paint(ctx, null, LD + 0.5);
  // ---- tête
  const hx = -16, hy = -150;
  ctx.save(); squash(ctx, hx + 6, hy + 28, 1.16, 1.16);
  // némès (coiffe rayée) : arrière + pans
  const nemB = () => smooth(ctx, [[hx + 2, hy - 30], [hx + 26, hy - 24], [hx + 36, hy - 4], [hx + 40, hy + 26], [hx + 30, hy + 30], [hx + 22, hy + 12], [hx + 12, hy + 6]]);
  C(ctx, nemB, P.gold, hx + 24, hy, 22);
  clipTo(ctx, nemB, () => { for (let i = 0; i < 9; i++) { const y = hy - 30 + i * 7; smooth(ctx, [[hx, y], [hx + 50, y + 6], [hx + 50, y + 9.5], [hx, y + 3.5]]); ctx.fillStyle = P.lapis; ctx.fill(); } });
  nemB(); paint(ctx, null, LW);
  ratEar(ctx, hx + 20, hy - 34, 13, P.fur, P.pink, 0.4);
  const head = () => smooth(ctx, [[hx - 44, hy + 14], [hx - 34, hy - 6], [hx - 18, hy - 22], [hx + 4, hy - 26], [hx + 22, hy - 16], [hx + 24, hy + 4], [hx + 14, hy + 20], [hx - 10, hy + 26], [hx - 32, hy + 24]]);
  C(ctx, head, P.fur, hx - 8, hy, 30);
  clipTo(ctx, head, () => { ell(ctx, hx - 26, hy + 22, 22, 10); ctx.fillStyle = shade(P.fur, 0.25); ctx.fill(); });
  head(); paint(ctx, null, LW);
  // némès : bandeau frontal + pan avant
  const nemF = () => smooth(ctx, [[hx - 30, hy - 10], [hx - 18, hy - 24], [hx + 2, hy - 30], [hx + 22, hy - 22], [hx + 26, hy - 8], [hx + 20, hy + 26], [hx + 12, hy + 30], [hx + 8, hy + 2], [hx - 4, hy - 14], [hx - 20, hy - 8]]);
  C(ctx, nemF, P.gold, hx + 4, hy - 10, 24);
  clipTo(ctx, nemF, () => { for (let i = 0; i < 10; i++) { const y = hy - 34 + i * 7; smooth(ctx, [[hx - 40, y + 10], [hx + 40, y - 4], [hx + 40, y - 0.5], [hx - 40, y + 13.5]]); ctx.fillStyle = P.lapis; ctx.fill(); } });
  nemF(); paint(ctx, null, LW);
  ratEar(ctx, hx - 6, hy - 36, 14, P.fur, P.pink, -0.3);
  // uraeus (cobra) + gemme
  limb(ctx, [[hx - 22, hy - 14], [hx - 27, hy - 24], [hx - 22, hy - 32]], 5, 6.5, P.gold, { lw: LD + 0.5 });
  oval(ctx, hx - 22, hy - 33, 5, 4.2, P.gold, { lw: LD + 0.5 });
  glow(ctx, hx - 25, hy - 21, 10, P.gem, 0.6);
  oval(ctx, hx - 25.5, hy - 21, 2.8, 3.2, P.gem, { lw: 1.6, hi: 0.3 });
  // yeux maquillés (khôl)
  const blink = a.f === 3 ? 0.6 : 0.18;
  eye(ctx, P, hx - 25, hy + 1, 5.6, 6.6, { inner: 1, anger: 0.3, blink, lid: P.fur, iris: '#c88a10', look: [-0.6, 0.1] });
  eye(ctx, P, hx - 8, hy, 7.6, 8.6, { inner: -1, anger: 0.3, blink, lid: P.fur, iris: '#c88a10', look: [-0.6, 0.1] });
  line(ctx, [[hx + 1, hy - 4], [hx + 9, hy - 5], [hx + 13, hy - 9]], 3.2);
  line(ctx, [[hx - 31, hy - 2], [hx - 36, hy - 4]], 2.8);
  brow(ctx, hx - 32, hy - 9, hx - 22, hy - 7, 3.8);
  brow(ctx, hx + 2, hy - 13, hx - 12, hy - 10, 4.6);
  // museau, truffe, moustaches
  const snout = () => smooth(ctx, [[hx - 34, hy + 6], [hx - 50, hy + 10], [hx - 58, hy + 17], [hx - 50, hy + 22], [hx - 32, hy + 22]]);
  C(ctx, snout, P.fur, hx - 44, hy + 15, 12, { lw: LW });
  oval(ctx, hx - 57, hy + 14, 5, 4.4, P.pink, { lw: LD + 0.5 });
  for (const k of [-1, 1]) line(ctx, [[hx - 46, hy + 16 + k * 2], [hx - 60, hy + 12 + k * 6], [hx - 68, hy + 12 + k * 9]], 1.6, rgba(OUT, 0.75));
  // sourire narquois + dents (une en or)
  line(ctx, [[hx - 52, hy + 21], [hx - 40, hy + 24], [hx - 28, hy + 22], [hx - 24, hy + 18]], 2.6);
  rr(ctx, hx - 50, hy + 21.5, 4.6, 7, 1.4); paint(ctx, TOOTH, 1.8);
  rr(ctx, hx - 45.4, hy + 22, 4.6, 6.6, 1.4); paint(ctx, P.gold, 1.8);
  // fausse barbe tressée
  const bx = hx - 34, byy = hy + 26;
  C(ctx, () => rr(ctx, bx - 4, byy, 8, 22, 3), P.gold, bx, byy + 10, 8, { lw: LD + 0.5, glint: false });
  for (let i = 1; i < 4; i++) line(ctx, [[bx - 4, byy + i * 5.5], [bx + 4, byy + i * 5.5 - 1.5]], 1.6, P.lapis);
  ctx.restore();
  // ---- bras avant + sceptre-ânkh
  const sx = -56, sy = -102 - a.up * 2;
  limb(ctx, [[-10, -120], [-30, -108], [sx + 4, sy]], 10, 9, P.fur);
  limb(ctx, [[sx, -70 + a.up], [sx - 2, -168]], 6, 6, P.gold, { lw: LD + 0.5 });
  glow(ctx, sx - 2, -186, 26, P.acc, a.f % 2 ? 0.75 : 0.5);
  ankh(ctx, sx - 2, -180, 0.82, P.gold, P.acc);
  oval(ctx, sx + 3, sy, 7.5, 7, P.fur, { lw: LD + 0.5, hi: 0 });
  C(ctx, () => rr(ctx, sx - 8, sy - 9, 12, 4, 2), P.gold, sx - 2, sy - 7, 5, { lw: LD, glint: false });
  // ---- variantes
  crest(ctx, P, [[hx - 14, hy - 33, -1.9, 12], [hx + 2, hy - 36, -1.6, 13], [hx + 18, hy - 31, -1.25, 12], [-60, -62, -2.4, 11], [84, -56, -0.6, 11]], a.f);
  ctx.restore();
  motes(ctx, P, [[-80, -120, 3], [70, -150, 2.6], [-70, -40, 2.4], [96, -90, 2.2]], a.f);
}

// =====================================================================
//  BOSS — Gorille Géant
// =====================================================================
function drawGorilla(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { fur: '#4b4560' }, { skin: '#7a7096', silver: '#b8b4c8', wrap: '#f4efe4' }, { acc: '#e8344a' });
  const by = -a.up * 3;
  const furD = shade(P.fur, -0.25);
  const roar = a.f === 2;
  ctx.save(); ctx.translate(10, 0);
  // ---- bandeau : pans qui flottent (derrière)
  // ---- bras arrière (appui sur les phalanges)
  const bk = [44 - a.c * 8, -6 - Math.max(0, -a.s) * 6];
  limb(ctx, [[30, -136 + by], [46, -96 + by], [bk[0], bk[1] - 10]], 30, 24, furD);
  oval(ctx, bk[0] - 2, bk[1] - 4, 15, 11, shade(P.skin, -0.3), { hi: 0 });
  // ---- jambe arrière
  limb(ctx, [[56, -66 + by], [66, -38], [64 + a.c * 4, -14]], 34, 26, furD);
  oval(ctx, 56 + a.c * 4, -8, 19, 8.5, shade(P.skin, -0.3), { hi: 0, glint: false });
  // ---- torse
  const tor = () => smooth(ctx, [[-44, -150], [-14, -176], [30, -174], [62, -146], [76, -100], [70, -62], [44, -46], [4, -52], [-28, -78], [-46, -112]].map(([x, y]) => [x, y + by]));
  C(ctx, tor, P.fur, 14, -112 + by, 60);
  clipTo(ctx, tor, () => {
    // dos argenté
    smooth(ctx, [[0, -176], [40, -168], [70, -132], [80, -96], [60, -104], [36, -138], [6, -158]].map(([x, y]) => [x, y + by])); ctx.fillStyle = P.silver; ctx.fill();
    // poitrine
    smooth(ctx, [[-36, -122], [-20, -134], [0, -128], [6, -104], [-4, -80], [-22, -82], [-36, -100]].map(([x, y]) => [x, y + by])); ctx.fillStyle = P.skin; ctx.fill();
    line(ctx, [[-30, -106 + by], [-16, -102 + by], [-2, -108 + by]], 2.4, shade(P.skin, -0.35));
    line(ctx, [[-16, -126 + by], [-16, -104 + by]], 2.2, shade(P.skin, -0.35));
  });
  tor(); paint(ctx, null, LW);
  cracks(ctx, P, tor, 40, -110 + by, 36, 43, 3, -1.4, 0.8);
  // ---- jambe avant
  limb(ctx, [[38, -64 + by], [32, -36], [28 - a.c * 4, -14]], 36, 28, P.fur);
  oval(ctx, 20 - a.c * 4, -8, 20, 9, shade(P.skin, -0.15), { hi: 0, glint: false });
  // ---- tête
  const hx = -42, hy = -146 + by * 1.2;
  ctx.save(); squash(ctx, hx + 26, hy + 26, 1.28, 1.28);
  // pans du bandeau
  const kx = hx + 30, ky = hy - 20;
  limb(ctx, [[kx, ky], [kx + 18, ky - 8 + a.s * 3], [kx + 34, ky - 4 + a.s * 6]], 9, 6, shade(P.acc, -0.15), { lw: LD + 0.5 });
  limb(ctx, [[kx, ky], [kx + 16, ky + 6 - a.s * 2], [kx + 28, ky + 16 - a.s * 4]], 8, 5.5, shade(P.acc, -0.28), { lw: LD + 0.5 });
  const head = () => smooth(ctx, [[hx - 34, hy + 4], [hx - 30, hy - 20], [hx - 14, hy - 38], [hx + 6, hy - 46], [hx + 26, hy - 34], [hx + 36, hy - 10], [hx + 34, hy + 18], [hx + 16, hy + 34], [hx - 14, hy + 34], [hx - 30, hy + 22]]);
  C(ctx, head, P.fur, hx, hy - 4, 36);
  // visage
  const face = () => smooth(ctx, [[hx - 34, hy - 6], [hx - 24, hy - 18], [hx - 4, hy - 22], [hx + 14, hy - 14], [hx + 14, hy + 6], [hx - 2, hy + 10], [hx - 20, hy + 8]]);
  face(); paint(ctx, P.skin, LD + 0.5);
  const muz = () => smooth(ctx, [[hx - 52, hy + 8], [hx - 44, hy - 4], [hx - 24, hy - 2], [hx - 6, hy + 8], [hx - 6, hy + 28], [hx - 24, hy + 38], [hx - 44, hy + 34], [hx - 54, hy + 22]]);
  C(ctx, muz, P.skin, hx - 30, hy + 16, 24);
  // narines
  for (const [x, y] of [[hx - 46, hy + 6], [hx - 36, hy + 5]]) { ell(ctx, x, y, 3.6, 2.6, -0.3); ctx.fillStyle = OUT; ctx.fill(); }
  // gueule
  if (roar) {
    const m = () => smooth(ctx, [[hx - 48, hy + 16], [hx - 30, hy + 14], [hx - 12, hy + 16], [hx - 12, hy + 30], [hx - 30, hy + 40], [hx - 46, hy + 32]]);
    m(); paint(ctx, MOUTH, LD + 0.5);
    clipTo(ctx, m, () => { ell(ctx, hx - 30, hy + 38, 12, 6); ctx.fillStyle = TONGUE; ctx.fill(); });
    fang(ctx, hx - 42, hy + 15.5, 5, 9); fang(ctx, hx - 20, hy + 15.5, 5, 9);
    fang(ctx, hx - 38, hy + 34, 4.4, -7); fang(ctx, hx - 22, hy + 33, 4.4, -7);
  } else {
    line(ctx, [[hx - 50, hy + 22], [hx - 36, hy + 25 + a.s], [hx - 22, hy + 22], [hx - 10, hy + 24]], 3);
    fang(ctx, hx - 40, hy + 24, 4.4, 7); fang(ctx, hx - 21, hy + 23, 4.4, 7);
  }
  // arcade sourcilière massive + yeux furieux
  eye(ctx, P, hx - 30, hy - 8, 5.6, 6.2, { inner: 1, anger: 0.8, lid: P.skin, iris: '#e86a10', pr: 0.66 });
  eye(ctx, P, hx - 10, hy - 9, 7.4, 8, { inner: -1, anger: 0.8, lid: P.skin, iris: '#e86a10', pr: 0.66 });
  C(ctx, () => smooth(ctx, [[hx - 42, hy - 14], [hx - 30, hy - 22], [hx - 18, hy - 16], [hx - 4, hy - 24], [hx + 12, hy - 20], [hx + 10, hy - 13], [hx - 4, hy - 14], [hx - 18, hy - 10], [hx - 30, hy - 13]]), P.fur, hx - 14, hy - 17, 16, { lw: LW });
  // bandeau rouge
  C(ctx, () => smooth(ctx, [[hx - 32, hy - 24], [hx - 14, hy - 36], [hx + 10, hy - 40], [hx + 32, hy - 28], [hx + 34, hy - 18], [hx + 10, hy - 30], [hx - 14, hy - 27], [hx - 30, hy - 17]]), P.acc, hx, hy - 30, 20, { lw: LD + 0.5 });
  oval(ctx, kx, ky, 6, 5.5, P.acc, { lw: LD + 0.5, hi: 0 });
  ctx.restore();
  // ---- bras avant (énorme, poing bandé)
  const fk = [-62 + a.c * 8, -8 - Math.max(0, a.s) * 8];
  const elb = [-30 + a.c * 3, -88 + by];
  limb(ctx, [[-10, -128 + by], [-22, -108 + by], elb], 30, 20, P.fur);
  limb(ctx, [elb, [(elb[0] + fk[0]) / 2 - 6, (elb[1] + fk[1]) / 2 - 2], [fk[0] + 2, fk[1] - 18]], 22, 44, P.fur);
  line(ctx, [[elb[0] - 8, elb[1] + 22], [elb[0] - 14, elb[1] + 40]], 2.4, shade(P.fur, -0.4));
  const fist = () => smooth(ctx, [[fk[0] - 18, fk[1] - 14], [fk[0] - 6, fk[1] - 24], [fk[0] + 14, fk[1] - 22], [fk[0] + 18, fk[1] - 6], [fk[0] + 10, fk[1] + 4], [fk[0] - 14, fk[1] + 4]]);
  C(ctx, fist, P.wrap, fk[0], fk[1] - 10, 18);
  clipTo(ctx, fist, () => { for (let i = 0; i < 4; i++) line(ctx, [[fk[0] - 24, fk[1] - 20 + i * 7], [fk[0] + 24, fk[1] - 26 + i * 7]], 1.8, shade(P.wrap, -0.25)); });
  fist(); paint(ctx, null, LW);
  for (let i = 0; i < 3; i++) line(ctx, [[fk[0] - 16 + i * 7, fk[1] + 3], [fk[0] - 14 + i * 7, fk[1] - 4]], 2, OUT);
  // pansement croisé (cicatrice de bagarre)
  ctx.save(); ctx.translate(30, -150 + by);
  for (const r of [0.6, -0.6]) { ctx.save(); ctx.rotate(r); rr(ctx, -9, -3, 18, 6, 2); paint(ctx, '#ffd9b0', 1.8); ctx.restore(); }
  ctx.restore();
  // ---- variantes
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[-28, -146 + by], [-8, -164 + by], [16, -160 + by], [12, -140 + by], [-12, -132 + by]]), -6, -150 + by, 16, [[-6, -150 + by], [6, -154 + by]]);
    C(ctx, () => rr(ctx, fk[0] - 18, fk[1] - 30, 30, 8, 3), GOLD, fk[0] - 3, fk[1] - 26, 10, { lw: LD + 0.5 });
  }
  crest(ctx, P, [[hx - 6, hy - 50, -1.9, 14], [hx + 16, hy - 54, -1.6, 15], [8, -172 + by, -1.4, 15], [28, -172 + by, -1.2, 15], [50, -160 + by, -0.9, 14], [66, -136 + by, -0.6, 13]], a.f);
  motes(ctx, P, [[-90, -150, 3], [90, -150, 2.6], [-96, -50, 2.4], [96, -40, 2.2]], a.f);
  ctx.restore();
}

// =====================================================================
//  BOSS — Kraken (capitaine pirate)
// =====================================================================
// Tentacule : base → pointe enroulée, ventouses côté intérieur.
function tentacle(ctx, pts, w0, w1, col, sucker, suckSide = 1) {
  limb(ctx, pts, w0, w1, col, { lw: LW });
  const n = Math.max(3, Math.round(pts.length * 1.6));
  for (let i = 1; i < n; i++) {
    const t = i / n, p = along(pts, t);
    const w = (w0 + (w1 - w0) * t) / 2;
    const nx = -p.ty * suckSide, ny = p.tx * suckSide;
    const r = Math.max(1.4, w * 0.42);
    ell(ctx, p.x + nx * w * 0.55, p.y + ny * w * 0.55, r, r * 0.8, Math.atan2(p.ty, p.tx));
    paint(ctx, sucker, 1.4);
  }
}
function cutlass(ctx, x, y, rot, P) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const blade = () => smooth(ctx, [[-3, -4], [2, -30], [10, -56], [18, -70], [12, -50], [6, -28], [4, -4]], true, 0.4);
  C(ctx, blade, P.steel, 4, -36, 18, { lw: LD + 0.5, hi: 0.35 });
  C(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -2, 10, 4, 0, 0, TAU); }, P.gold, 0, -2, 8, { lw: LD + 0.5, glint: false });
  C(ctx, () => { ctx.beginPath(); ctx.arc(-1, 6, 9, Math.PI * 0.55, Math.PI * 1.45); ctx.arc(-1, 6, 6, Math.PI * 1.45, Math.PI * 0.55, true); ctx.closePath(); }, P.gold, -8, 6, 6, { lw: LD, glint: false });
  C(ctx, () => rr(ctx, -3, -1, 6, 14, 3), shade(P.hat, 0.2), 0, 6, 6, { lw: LD, glint: false });
  ctx.restore();
}
function drawKraken(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { skin: '#e45a52' }, { sucker: '#ffc8ae', hat: '#2c2442', steel: '#d6deee' }, { acc: '#ffc832', feather: '#ff3a5a' }, { patch: ['#1c1428'], gold: [GOLD, GOLD, '#c6cc3a', '#ffa02a'] });
  const ph = a.ph;
  const skD = shade(P.skin, -0.2);
  const wv = (k, amp = 4) => Math.sin(ph + k) * amp;
  // ---- tentacules arrière (au sol, à droite)
  tentacle(ctx, [[30, -70], [60, -50 + wv(0)], [88, -38 + wv(1)], [104, -50 + wv(2)], [98, -62 + wv(2.5)], [90, -56]], 22, 6, skD, shade(P.sucker, -0.15), -1);
  tentacle(ctx, [[10, -60], [26, -30], [52, -14 + wv(1.5, 2)], [78, -10], [92, -18 + wv(2.5, 3)], [88, -28]], 22, 6, skD, shade(P.sucker, -0.15), -1);
  // tentacule arrière levé (brandit une bourse d'or)
  const bt = [[40, -110], [72, -122 + wv(0.5)], [90, -150 + wv(1)], [84, -170 + wv(1.5)]];
  tentacle(ctx, bt, 20, 7, skD, shade(P.sucker, -0.15), 1);
  const cx0 = bt[3][0] - 2, cy0 = bt[3][1] - 10;
  for (const [dx, dy] of [[-6, 2], [4, 3], [-1, -4]]) oval(ctx, cx0 + dx, cy0 + dy, 6, 5.4, P.acc, { lw: LD, hi: 0.3 });
  sparkle(ctx, cx0 + 9, cy0 - 8 + a.up * 3, 4, '#fff6c0');
  // ---- manteau (tête-poche)
  const mx = 14, my = -126;
  const sqy = 1 + a.c * 0.03, sqx = 1 - a.c * 0.02;
  ctx.save(); squash(ctx, mx, my + 56, sqx, sqy);
  const mantle = () => smooth(ctx, [[mx - 50, my + 34], [mx - 54, my - 2], [mx - 42, my - 40], [mx - 12, my - 62], [mx + 22, my - 60], [mx + 50, my - 36], [mx + 62, my + 4], [mx + 54, my + 40], [mx + 30, my + 60], [mx - 20, my + 62]]);
  C(ctx, mantle, P.skin, mx + 4, my, 58);
  clipTo(ctx, mantle, () => {
    for (const [x, y, r] of [[30, -40, 6], [44, -16, 5], [20, -52, 4], [52, 12, 5], [38, 6, 3.4]]) { ell(ctx, mx + x, my + y, r, r * 0.85); fillA(ctx, shade(P.skin, 0.3), 0.7); }
  });
  mantle(); paint(ctx, null, LW);
  cracks(ctx, P, mantle, mx + 30, my - 10, 40, 47, 3, -1.4, 0.6);
  // ---- visage
  const fx = mx - 30, fy = my + 8;
  // cache-œil (œil lointain) + sangle
  line(ctx, [[fx - 22, fy - 18], [fx + 2, fy - 34], [fx + 34, fy - 46], [mx + 40, my - 46]], 3.2, P.patch);
  smooth(ctx, [[fx - 22, fy - 10], [fx - 16, fy - 18], [fx - 6, fy - 16], [fx - 6, fy - 4], [fx - 16, fy]]); paint(ctx, P.patch, LD + 0.5);
  sparkle(ctx, fx - 15, fy - 9, 2.6, '#ffffff', 0.5);
  // œil proche, furieux
  eye(ctx, P, fx + 12, fy - 10, 10, 12, { inner: -1, anger: 0.6, lid: P.skin, iris: '#ffc21a', look: [-0.65, 0.1], pr: 0.58, blink: a.f === 3 ? 0.55 : 0 });
  brow(ctx, fx - 26, fy - 23, fx - 9, fy - 19, 5);
  brow(ctx, fx + 28, fy - 28, fx + 6, fy - 22, 6);
  // moustache en guidon (deux petits tentacules)
  for (const d of [-1, 1]) {
    const bx = fx - 2 + d * 2, byy = fy + 8;
    limb(ctx, [[bx, byy], [bx + d * 12, byy - 1], [bx + d * 20, byy - 8 + wv(d, 1.5)], [bx + d * 16, byy - 13]], 8, 3, skD, { lw: LD + 0.5 });
  }
  // bouche + crocs
  smooth(ctx, [[fx - 12, fy + 18], [fx - 2, fy + 14], [fx + 10, fy + 18], [fx + 2, fy + 24], [fx - 8, fy + 23]]); paint(ctx, MOUTH, LD + 0.5);
  fang(ctx, fx - 7, fy + 16, 3.6, 5); fang(ctx, fx + 5, fy + 16.4, 3.6, 5);
  blush(ctx, fx + 22, fy + 6, 6, 3.4, 0.35);
  ctx.restore();
  // ---- tricorne
  const hx = mx - 4, hy = my - 52 + (a.c * -2);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.1);
  // plume
  limb(ctx, [[22, -14], [40, -30 + wv(0, 3)], [50, -26 + wv(1, 4)]], 9, 3, P.feather, { lw: LD + 0.5 });
  const crown = () => smooth(ctx, [[-30, 0], [-26, -18], [-8, -28], [12, -28], [28, -18], [32, 0]]);
  C(ctx, crown, P.hat, 0, -14, 26);
  const brim = () => smooth(ctx, [[-52, -4], [-38, -10], [-18, -2], [0, -8], [20, -2], [40, -10], [56, -4], [40, 8], [0, 10], [-40, 8]]);
  C(ctx, brim, shade(P.hat, 0.1), 0, 0, 40);
  clipTo(ctx, brim, () => line(ctx, [[-52, -4], [-38, -10], [-18, -2], [0, -8], [20, -2], [40, -10], [56, -4]], 5, P.acc));
  brim(); paint(ctx, null, LW);
  // emblème : crâne de poisson + arêtes croisées
  for (const r of [0.6, -0.6]) { ctx.save(); ctx.translate(0, -15); ctx.rotate(r); rr(ctx, -10, -1.6, 20, 3.2, 1.6); paint(ctx, '#f6f2e8', 1.4); ctx.restore(); }
  oval(ctx, 0, -17, 6, 5, '#f6f2e8', { lw: 1.6, hi: 0, glint: false });
  ell(ctx, -2, -17.5, 1.3, 1.3); ctx.fillStyle = OUT; ctx.fill(); ell(ctx, 2, -17.5, 1.3, 1.3); ctx.fill();
  ctx.restore();
  // ---- tentacules avant (au sol)
  tentacle(ctx, [[-20, -70], [-36, -40], [-58, -18 + wv(0.5, 2)], [-82, -14], [-94, -24 + wv(1.5, 3)], [-86, -32]], 24, 6, P.skin, P.sucker, 1);
  tentacle(ctx, [[18, -66], [16, -40], [6, -16], [-14, -8 + wv(2, 2)], [-30, -14], [-28, -24 + wv(3, 2)]], 24, 6, P.skin, P.sucker, -1);
  // ---- tentacule au sabre (levé, à l'avant)
  const st = [[-34, -78], [-62, -92 + wv(0, 3)], [-78, -114 + wv(0.8, 3)], [-74, -132 + wv(1.6, 2)]];
  tentacle(ctx, st, 20, 9, P.skin, P.sucker, 1);
  cutlass(ctx, st[3][0] + 2, st[3][1] - 2, -0.25 + a.s * 0.15, P);
  oval(ctx, st[3][0] + 2, st[3][1] + 2, 6, 5.5, P.skin, { lw: LD + 0.5, hi: 0 });
  // ---- variantes
  if (v === 1) {
    for (const [x, y] of [[-40, -18], [-74, -18], [-6, -12]]) C(ctx, () => rr(ctx, x - 5, y - 8, 10, 14, 3), GOLD, x, y, 6, { lw: LD, glint: false });
  }
  crest(ctx, P, [[mx + 30, my - 52, -1.3, 13], [mx + 50, my - 30, -0.8, 13], [mx + 60, my, -0.3, 12], [mx + 54, my + 30, 0.2, 11]], a.f);
  if (v === 2) { drip(ctx, -40, -30, 9); drip(ctx, 60, -20, 8); }
  motes(ctx, P, [[-100, -150, 3], [100, -110, 2.6], [-104, -60, 2.4], [70, -190, 2.2]], a.f);
  if (v < 2) for (const [x, y, r] of [[-96, -80 - a.f * 5, 3.4], [-88, -104 - a.f * 3, 2.2], [100, -100 - a.f * 4, 2.6]]) { ell(ctx, x, y, r, r); paint(ctx, 'rgba(210,240,255,0.5)', 1.4, '#4a8ac8'); }
}

// =====================================================================
//  BOSS — Comte Toutoula (chien vampire)
// =====================================================================
function miniBat(ctx, x, y, k, flap, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  for (const d of [-1, 1]) {
    const up = flap ? -6 : 3;
    smooth(ctx, [[0, 0], [d * 6, -4 + up * 0.5], [d * 14, -2 + up], [d * 12, 3 + up * 0.4], [d * 9, 2], [d * 6, 5], [d * 3, 2]]); paint(ctx, col, 1.8);
  }
  ell(ctx, 0, 1, 3.4, 4); paint(ctx, col, 1.8);
  ell(ctx, -1.2, 0, 0.9, 0.9); ctx.fillStyle = '#ff3a4a'; ctx.fill(); ell(ctx, 1.2, 0, 0.9, 0.9); ctx.fill();
  ctx.restore();
}
function drawVampDog(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { fur: '#ddd2ec' }, { cape: '#2a1d44', suit: '#1f1830', hair: '#2b2040', shirt: '#f6f4fb' }, { acc: '#e0263e' },
    { gold: [GOLD, GOLD, '#c6cc3a', '#ffa02a'], lining: ['#e0263e', '#b8102e', '#8a2ad0', '#ff5a1a'] });
  const by = [0, -2, -3, -1][a.f];
  const fl = (k, amp = 4) => Math.sin(a.ph + k) * amp;
  // ---- cape déployée (ailes de chauve-souris) : bras levés
  const hl = [-66, -118 + by + fl(0, 2)], hr = [72, -142 + by + fl(1, 2)];
  const capeO = () => smooth(ctx, [[-6, -150 + by], hl, [-78, -84 + fl(0.5)], [-62, -60 + fl(1)], [-70, -34 + fl(1.5)], [-50, -14], [-30, -8], [0, -6], [30, -8], [56, -12], [78, -36 + fl(2)], [70, -64 + fl(2.5)], [90, -96 + fl(3)], hr, [24, -152 + by]], true, 0.35);
  C(ctx, capeO, P.cape, 0, -90, 70, { glint: false });
  const capeI = () => smooth(ctx, [[-4, -140 + by], [hl[0] + 8, hl[1] + 6], [-68, -86 + fl(0.5)], [-54, -62 + fl(1)], [-60, -38 + fl(1.5)], [-44, -20], [0, -16], [48, -18], [66, -38 + fl(2)], [60, -64 + fl(2.5)], [78, -98 + fl(3)], [hr[0] - 8, hr[1] + 8], [22, -142 + by]], true, 0.35);
  C(ctx, capeI, P.lining, 0, -84, 60, { glint: false, shadow: 0.3 });
  clipTo(ctx, capeI, () => { for (const x of [-40, -14, 14, 42]) line(ctx, [[x * 0.4, -130 + by], [x, -20]], 2, shade(P.lining, -0.3)); });
  capeI(); paint(ctx, null, LD + 0.5);
  if (v === 1) { capeI(); ctx.lineWidth = 2.2; ctx.strokeStyle = GOLD; ctx.stroke(); }
  // chauves-souris de compagnie
  miniBat(ctx, -92 + fl(0, 3), -170 + fl(1, 4), 1.3, a.f % 2 === 0, shade(P.cape, 0.1));
  miniBat(ctx, 96 + fl(2, 3), -196 + fl(3, 4), 1.1, a.f % 2 === 1, shade(P.cape, 0.1));
  // ---- jambes (pantalon + souliers vernis)
  for (const [x, sg, col] of [[12, -1, shade(P.suit, -0.15)], [-8, 1, P.suit]]) {
    const dx = sg * a.c * 4;
    limb(ctx, [[x, -62 + by], [x + dx * 0.5, -30], [x + dx, -12]], 15, 13, col);
    C(ctx, () => smooth(ctx, [[x + dx + 7, -16], [x + dx - 6, -16], [x + dx - 20, -8], [x + dx - 18, -2], [x + dx + 8, -2]]), shade(P.suit, -0.3), x + dx - 4, -8, 12, { lw: LW });
  }
  // ---- corps (smoking)
  const body = () => smooth(ctx, [[-24, -128 + by], [0, -136 + by], [24, -128 + by], [28, -92 + by], [22, -60 + by], [-18, -58 + by], [-26, -92 + by]]);
  C(ctx, body, P.suit, 0, -96 + by, 30);
  clipTo(ctx, body, () => {
    poly(ctx, [[-14, -134 + by], [10, -134 + by], [6, -66 + by], [-6, -66 + by]]); ctx.fillStyle = P.shirt; ctx.fill();
    for (const y of [-112, -98, -84]) { ell(ctx, 0, y + by, 1.8, 1.8); ctx.fillStyle = OUT; ctx.fill(); }
    line(ctx, [[-14, -134 + by], [-4, -90 + by], [-20, -60 + by]], 3, OUT); line(ctx, [[10, -134 + by], [4, -90 + by], [20, -60 + by]], 3, OUT);
  });
  body(); paint(ctx, null, LW);
  cracks(ctx, P, body, 10, -96 + by, 24, 53, 2, -0.6, 0.8);
  // médaillon
  line(ctx, [[-12, -128 + by], [0, -106 + by], [12, -128 + by]], 2.4, P.gold);
  glow(ctx, 0, -100 + by, 14, P.acc, 0.6);
  oval(ctx, 0, -100 + by, 7, 8, P.gold, { lw: LD + 0.5 });
  oval(ctx, 0, -100 + by, 4, 5, P.acc, { lw: 1.6, hi: 0.35 });
  // ---- bras (tiennent la cape) + gants blancs
  limb(ctx, [[20, -126 + by], [48, -136 + by], [hr[0] - 4, hr[1] + 2]], 12, 11, shade(P.suit, -0.1));
  oval(ctx, hr[0] - 2, hr[1], 7.5, 7, P.shirt, { lw: LD + 0.5 });
  // ---- col dressé (derrière la tête)
  const colr = () => smooth(ctx, [[-40, -122 + by], [-48, -186 + by], [-20, -150 + by], [12, -146 + by], [44, -182 + by], [42, -122 + by], [0, -116 + by]], true, 0.35);
  C(ctx, colr, P.cape, 0, -150 + by, 40, { glint: false });
  clipTo(ctx, colr, () => { smooth(ctx, [[-34, -126 + by], [-40, -172 + by], [-18, -146 + by], [12, -142 + by], [36, -168 + by], [36, -126 + by]], true, 0.35); ctx.fillStyle = P.lining; ctx.fill(); });
  colr(); paint(ctx, null, LW);
  // ---- tête
  const hx = -14, hy = -160 + by;
  ctx.save(); squash(ctx, hx + 8, hy + 28, 1.12, 1.12);
  // oreille arrière (longue, tombante)
  limb(ctx, [[hx + 22, hy - 14], [hx + 34, hy + 4 + fl(0, 1.5)], [hx + 32, hy + 28 + fl(0.5, 2)]], 16, 12, shade(P.hair, -0.1));
  const head = () => smooth(ctx, [[hx - 34, hy + 6], [hx - 30, hy - 18], [hx - 12, hy - 34], [hx + 10, hy - 36], [hx + 28, hy - 22], [hx + 30, hy + 2], [hx + 22, hy + 22], [hx - 2, hy + 30], [hx - 26, hy + 24]]);
  C(ctx, head, P.fur, hx - 2, hy - 4, 32);
  // cheveux plaqués + pointe de veuve
  const hair = () => smooth(ctx, [[hx - 32, hy - 12], [hx - 22, hy - 30], [hx - 2, hy - 38], [hx + 20, hy - 32], [hx + 31, hy - 14], [hx + 28, hy + 2], [hx + 16, hy - 14], [hx + 2, hy - 18], [hx - 10, hy - 10], [hx - 18, hy - 18]], true, 0.4);
  C(ctx, hair, P.hair, hx, hy - 24, 26, { hi: 0.35 });
  // museau
  const muz = () => smooth(ctx, [[hx - 28, hy + 2], [hx - 50, hy + 4], [hx - 60, hy + 12], [hx - 54, hy + 22], [hx - 34, hy + 24], [hx - 22, hy + 16]]);
  C(ctx, muz, P.fur, hx - 42, hy + 12, 16);
  oval(ctx, hx - 58, hy + 8, 7, 5.6, '#2a1d34', { lw: LD + 0.5, hi: 0.35 });
  // yeux rouges, cernes, monocle
  for (const [x, y, w] of [[hx - 30, hy + 6, 6], [hx - 10, hy + 6, 8]]) { line(ctx, [[x - w, y], [x, y + 3], [x + w, y]], 2, rgba('#7a5aa8', 0.6)); }
  eye(ctx, P, hx - 29, hy - 3, 5.6, 6.6, { inner: 1, anger: 0.55, lid: P.fur, iris: '#e0102c', look: [-0.6, 0.15] });
  eye(ctx, P, hx - 10, hy - 4, 7.6, 8.6, { inner: -1, anger: 0.2, lid: P.fur, iris: '#e0102c', look: [-0.6, 0.15] });
  brow(ctx, hx - 37, hy - 12, hx - 26, hy - 9, 4);
  brow(ctx, hx + 2, hy - 20, hx - 14, hy - 17, 4.6, OUT, -3);
  ell(ctx, hx - 10, hy - 4, 11, 11.5); ctx.lineWidth = 4.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = P.gold; ctx.stroke();
  line(ctx, [[hx + 0, hy + 5], [hx + 6, hy + 22], [hx + 2, hy + 34]], 1.6, P.gold);
  // sourire + longs crocs
  line(ctx, [[hx - 54, hy + 21], [hx - 40, hy + 24], [hx - 26, hy + 21], [hx - 20, hy + 15]], 2.8);
  fang(ctx, hx - 47, hy + 22.5, 4.4, 9); fang(ctx, hx - 32, hy + 22.6, 4.4, 9);
  // oreille avant (longue, tombante, « cape » de cheveux)
  limb(ctx, [[hx + 10, hy - 22], [hx + 18, hy - 2 + fl(1, 1.5)], [hx + 14, hy + 24 + fl(1.5, 2)]], 17, 13, P.hair);
  ctx.restore();
  // ---- bras avant (main griffue)
  limb(ctx, [[-16, -124 + by], [-42, -116 + by], [hl[0] + 6, hl[1] + 2]], 12, 11, P.suit);
  oval(ctx, hl[0] + 4, hl[1], 7.5, 7, P.shirt, { lw: LD + 0.5 });
  for (let i = 0; i < 3; i++) fang(ctx, hl[0] - 2 + i * 4, hl[1] + 5, 2.4, 5, 1.2);
  // ---- variantes
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[-30, -130 + by], [-12, -138 + by], [-4, -126 + by], [-20, -118 + by]]), -16, -128 + by, 10, [[-16, -128 + by]]);
    goldPlate(ctx, () => smooth(ctx, [[30, -130 + by], [12, -138 + by], [4, -126 + by], [20, -118 + by]]), 16, -128 + by, 10, [[16, -128 + by]]);
  }
  crest(ctx, P, [[-48, -186 + by, -1.9, 12], [44, -182 + by, -1.3, 12], [hx - 4, hy - 38, -1.7, 12], [hx + 14, hy - 34, -1.3, 11]], a.f);
  motes(ctx, P, [[-100, -120, 3], [104, -80, 2.6], [-90, -40, 2.4], [60, -200, 2.2]], a.f);
}

// =====================================================================
//  BOSS — Robot Mixeur (robot pâtissier géant)
// =====================================================================
function drawMegaMixer(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { enamel: '#e23a4a' }, { chrome: '#ccd5e6', dough: '#c88a4a', dark: '#3a3450' }, { acc: '#ffd23a' });
  const by = -a.up * 3;
  const chD = shade(P.chrome, -0.25), enD = shade(P.enamel, -0.25);
  // ---- câbles arrière
  limb(ctx, [[58, -96 + by], [80, -84], [84, -50], [70, -30]], 6, 6, P.dark, { lw: LD + 0.5 });
  // ---- jambe arrière
  const leg = (x, sg, col) => {
    const dx = sg * a.c * 6, lift = Math.max(0, sg * a.s) * 6;
    C(ctx, () => rr(ctx, x - 10, -64 + by, 20, 26, 6), col, x, -52, 12, { lw: LW, glint: false });
    limb(ctx, [[x, -40 + by], [x + dx * 0.5, -22 - lift]], 12, 12, chD, { lw: LD + 0.5 });
    for (let i = 0; i < 3; i++) line(ctx, [[x - 7 + dx * 0.25, -36 + i * 5 + by * 0.5 - lift * 0.3], [x + 7 + dx * 0.25, -35 + i * 5 + by * 0.5 - lift * 0.3]], 1.8, OUT);
    C(ctx, () => rr(ctx, x - 20 + dx, -20 - lift, 34, 16, 6), P.dark, x - 3 + dx, -12, 16, { lw: LW, glint: false });
    C(ctx, () => rr(ctx, x - 20 + dx, -10 - lift, 34, 6, 3), P.acc, x - 3 + dx, -7, 10, { lw: LD + 0.5, glint: false, hi: 0 });
  };
  leg(30, -1, enD);
  // ---- colonne + tête-moteur (pivot)
  const col = () => smooth(ctx, [[22, -84 + by], [24, -140 + by], [36, -158 + by], [60, -158 + by], [66, -130 + by], [62, -84 + by]], true, 0.3);
  C(ctx, col, P.enamel, 44, -120 + by, 24);
  // ---- socle
  const base = () => rr(ctx, -64, -92 + by, 132, 34, 14);
  C(ctx, base, P.enamel, 0, -76 + by, 40);
  clipTo(ctx, base, () => {
    ctx.fillStyle = P.acc; ctx.fillRect(-70, -70 + by, 144, 10);
    ctx.fillStyle = '#2b1838';
    for (let i = -6; i < 10; i++) { poly(ctx, [[-60 + i * 10, -60 + by], [-54 + i * 10, -70 + by], [-49 + i * 10, -70 + by], [-55 + i * 10, -60 + by]]); ctx.fill(); }
    line(ctx, [[-70, -70 + by], [74, -70 + by]], 2.2); line(ctx, [[-70, -60 + by], [74, -60 + by]], 2.2);
  });
  base(); paint(ctx, null, LW);
  for (const x of [-54, -30, 30, 56]) { ell(ctx, x, -84 + by, 2.2, 2.2); paint(ctx, P.chrome, 1.4); }
  cracks(ctx, P, base, 30, -78 + by, 30, 59, 2, -0.6, 0.8);
  // ---- bol chromé + pâte à croquettes
  const bx = -20, bY = -122 + by;
  const bowl = () => { ctx.beginPath(); ctx.ellipse(bx, bY, 44, 11, 0, Math.PI, 0, true); ctx.bezierCurveTo(bx + 42, bY + 30, bx + 22, bY + 38, bx, bY + 38); ctx.bezierCurveTo(bx - 22, bY + 38, bx - 42, bY + 30, bx - 44, bY); ctx.closePath(); };
  // pâte qui déborde (derrière le bord avant)
  const dough = () => smooth(ctx, [[bx - 40, bY], [bx - 32, bY - 14], [bx - 14, bY - 22], [bx + 8, bY - 18], [bx + 30, bY - 20], [bx + 42, bY - 6], [bx + 40, bY + 4], [bx - 38, bY + 6]]);
  C(ctx, dough, P.dough, bx, bY - 10, 30);
  for (const [x, y] of [[-26, -12], [-6, -16], [14, -12], [28, -8], [-14, -4]]) oval(ctx, bx + x, bY + y, 4.4, 3.4, shade(P.dough, -0.35), { lw: 1.6, hi: 0.25, glint: false });
  C(ctx, bowl, P.chrome, bx - 6, bY + 16, 30, { hi: 0.35 });
  clipTo(ctx, bowl, () => { line(ctx, [[bx - 30, bY + 6], [bx - 26, bY + 22]], 4, '#ffffff'); ell(ctx, bx + 18, bY + 24, 18, 12); fillA(ctx, '#2b1838', 0.12); });
  bowl(); paint(ctx, null, LW);
  ctx.beginPath(); ctx.ellipse(bx, bY, 44, 11, 0, 0, Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = chD; ctx.stroke();
  // coulures de pâte
  for (const [x, L] of [[-30, 12], [6, 16], [26, 9]]) { smooth(ctx, [[bx + x - 4, bY + 4], [bx + x + 4, bY + 4], [bx + x + 3, bY + 4 + L], [bx + x - 3, bY + 4 + L]]); paint(ctx, P.dough, LD); }
  // croquettes qui volent
  for (let i = 0; i < 3; i++) { const k = (a.f + i) % 4; oval(ctx, bx - 30 + i * 26, bY - 30 - k * 6, 3.6, 2.8, shade(P.dough, -0.3), { lw: 1.6, hi: 0, glint: false, rot: k }); }
  // ---- fouet (tourne) sous la tête
  const wx = bx + 4, wy0 = -150 + by;
  limb(ctx, [[wx, wy0 - 6], [wx, wy0 + 10]], 6, 6, chD, { lw: LD + 0.5 });
  const sp = [1, 0.4, -0.4, -1][a.f];
  for (let i = 0; i < 3; i++) {
    const w = (6 + i * 4) * (i % 2 ? sp : 1) * (a.f % 2 ? 0.7 : 1);
    smooth(ctx, [[wx, wy0 + 8], [wx - w, wy0 + 20], [wx - w * 0.8, wy0 + 34], [wx, wy0 + 40], [wx + w * 0.8, wy0 + 34], [wx + w, wy0 + 20]]);
    ctx.lineWidth = 4.4; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = P.chrome; ctx.stroke();
  }
  // ---- tête-moteur avec visage
  const hx = -6, hy = -176 + by;
  const head = () => smooth(ctx, [[hx - 64, hy + 4], [hx - 58, hy - 22], [hx - 30, hy - 36], [hx + 30, hy - 36], [hx + 62, hy - 24], [hx + 70, hy + 6], [hx + 60, hy + 26], [hx - 30, hy + 28], [hx - 58, hy + 22]], true, 0.4);
  C(ctx, head, P.enamel, hx, hy - 4, 56);
  clipTo(ctx, head, () => { smooth(ctx, [[hx - 70, hy + 14], [hx + 80, hy + 6], [hx + 80, hy + 14], [hx - 70, hy + 22]]); ctx.fillStyle = P.chrome; ctx.fill(); });
  head(); paint(ctx, null, LW);
  // toque de chef
  ctx.save(); ctx.translate(hx + 20, hy - 34); ctx.rotate(0.15);
  C(ctx, () => rr(ctx, -14, -8, 28, 12, 3), '#f6f6fa', 0, -2, 12, { lw: LD + 0.5, glint: false });
  C(ctx, () => { ctx.beginPath(); ctx.arc(-9, -14, 9, 0, TAU); ctx.moveTo(13, -16); ctx.arc(4, -18, 10, 0, TAU); ctx.moveTo(19, -12); ctx.arc(11, -12, 8, 0, TAU); }, '#f6f6fa', 0, -16, 14, { lw: LD + 0.5 });
  ctx.restore();
  // molette de vitesse (tourne)
  oval(ctx, hx + 40, hy - 4, 10, 10, P.chrome, { lw: LD + 0.5 });
  ctx.save(); ctx.translate(hx + 40, hy - 4); ctx.rotate(a.f * Math.PI / 2); line(ctx, [[0, 0], [0, -7]], 3, OUT); ctx.restore();
  // visière + yeux furieux
  const vis = () => rr(ctx, hx - 58, hy - 22, 52, 26, 10);
  vis(); paint(ctx, '#1d1830', LD + 0.5);
  const ledEye = (x, y, w, h, inner) => {
    glow(ctx, x, y, w * 2, P.acc, 0.8);
    const pts = inner > 0 ? [[x - w, y - h * 0.5], [x + w, y], [x + w * 0.8, y + h * 0.6], [x - w * 0.9, y + h * 0.6]] : [[x + w, y - h * 0.5], [x - w, y], [x - w * 0.8, y + h * 0.6], [x + w * 0.9, y + h * 0.6]];
    smooth(ctx, pts, true, 0.25); ctx.fillStyle = P.acc; ctx.fill();
    ell(ctx, x - w * 0.3, y + h * 0.18, w * 0.36, h * 0.34); ctx.fillStyle = OUT; ctx.fill();
    ell(ctx, x - w * 0.45, y - h * 0.02, w * 0.18, h * 0.14); ctx.fillStyle = '#ffffff'; ctx.fill();
  };
  if (a.f === 3) { for (const x of [hx - 44, hx - 22]) { glow(ctx, x, hy - 8, 14, P.acc, 0.6); line(ctx, [[x - 8, hy - 8], [x + 8, hy - 8]], 3, P.acc); } }
  else { ledEye(hx - 44, hy - 9, 8, 13, 1); ledEye(hx - 21, hy - 10, 9, 14, -1); }
  C(ctx, () => poly(ctx, [[hx - 60, hy - 26], [hx - 32, hy - 16], [hx - 32, hy - 22], [hx - 56, hy - 32]]), chD, hx - 45, hy - 24, 10, { lw: LD + 0.5, glint: false });
  C(ctx, () => poly(ctx, [[hx - 2, hy - 30], [hx - 30, hy - 16], [hx - 30, hy - 22], [hx - 4, hy - 36]]), chD, hx - 16, hy - 26, 10, { lw: LD + 0.5, glint: false });
  // grille-bouche à dents
  const m = () => rr(ctx, hx - 56, hy + 8, 40, 14, 5);
  m(); paint(ctx, MOUTH, LD + 0.5);
  for (let i = 0; i < 5; i++) { fang(ctx, hx - 51 + i * 8, hy + 8, 5, 5 + (i % 2) * 2, 1.4); fang(ctx, hx - 47 + i * 8, hy + 22, 4.4, -4.4, 1.4); }
  // ---- jambe avant
  leg(-34, 1, P.enamel);
  // ---- bras avant + spatule géante
  const sy = -a.s * 4;
  limb(ctx, [[-50, -84 + by], [-76, -98 + by], [-84, -126 + by + sy]], 11, 10, chD, { lw: LD + 0.5 });
  oval(ctx, -76, -98 + by, 7, 7, P.dark, { lw: LD + 0.5, hi: 0 });
  ctx.save(); ctx.translate(-84, -128 + by + sy); ctx.rotate(-0.2 + a.s * 0.12);
  C(ctx, () => rr(ctx, -3.5, -40, 7, 44, 3.5), P.dark, 0, -18, 10, { lw: LD + 0.5, glint: false });
  C(ctx, () => rr(ctx, -12, -78, 24, 40, 8), P.chrome, 0, -58, 18, { lw: LW, hi: 0.35 });
  for (const x of [-5, 0, 5]) line(ctx, [[x, -72], [x, -46]], 2, chD);
  ctx.restore();
  oval(ctx, -84, -126 + by + sy, 8, 8, P.dark, { lw: LD + 0.5, hi: 0 });
  // ---- variantes
  if (v === 1) {
    for (const x of [-40, 0, 40]) goldSpike(ctx, hx + x, hy - 34, -Math.PI / 2, 12);
    goldPlate(ctx, () => rr(ctx, -66, -96 + by, 136, 8, 4), 0, -92 + by, 30, [[-50, -92 + by], [0, -92 + by], [50, -92 + by]]);
  }
  if (v >= 2) crest(ctx, P, [[hx - 40, hy - 34, -1.9, 13], [hx + 10, hy - 37, -1.6, 14], [hx + 50, hy - 26, -1.1, 13], [62, -96 + by, -0.6, 12]], a.f);
  motes(ctx, P, [[-110, -170, 3], [96, -200, 2.6], [-110, -60, 2.4], [100, -60, 2.2]], a.f);
}

// =====================================================================
//  BOSS — Oiseau-Tonnerre
// =====================================================================
function stormWing(ctx, x, y, ang, len, col, tip, back) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const L = len;
  // grandes plumes (rémiges) à bout jaune en éclair
  for (let i = 4; i >= 0; i--) {
    const t = i / 4;
    const bx = L * (0.35 + t * 0.55), byy = L * 0.06 + t * L * 0.02;
    const fl = L * (0.55 - t * 0.12);
    ctx.save(); ctx.translate(bx, byy); ctx.rotate(0.9 - t * 0.75);
    const f = () => smooth(ctx, [[-L * 0.07, 0], [-L * 0.06, fl * 0.6], [0, fl], [L * 0.07, fl * 0.62], [L * 0.07, 0]], true, 0.4);
    C(ctx, f, back ? shade(col, -0.1) : col, 0, fl * 0.5, L * 0.12, { glint: false, lw: LW });
    clipTo(ctx, f, () => { poly(ctx, [[-L * 0.1, fl * 0.62], [L * 0.02, fl * 0.55], [-L * 0.03, fl * 0.72], [L * 0.1, fl * 0.66], [L * 0.1, fl * 1.1], [-L * 0.1, fl * 1.1]]); ctx.fillStyle = tip; ctx.fill(); });
    f(); paint(ctx, null, LW);
    ctx.restore();
  }
  // bras de l'aile
  const arm = () => smooth(ctx, [[-6, -8], [L * 0.4, -L * 0.1], [L * 0.95, -L * 0.04], [L * 0.9, L * 0.1], [L * 0.4, L * 0.12], [-6, 14]], true, 0.4);
  C(ctx, arm, col, L * 0.4, 0, L * 0.3, { lw: LW });
  clipTo(ctx, arm, () => { for (let i = 0; i < 4; i++) { const xx = L * (0.2 + i * 0.2); line(ctx, [[xx, L * 0.13], [xx + L * 0.06, 0], [xx + L * 0.12, L * 0.13]], 2, shade(col, -0.3)); } });
  arm(); paint(ctx, null, LW);
  ctx.restore();
}
function drawThunderBird(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { body: '#3e44b0', chest: '#8ea0f2' }, { beak: '#ffc23a' }, { acc: '#ffe23a' });
  const by = [2, -2, -6, -2][a.f];
  const wa = [-0.95, -0.45, 0.05, -0.45][a.f];
  const bD = shade(P.body, -0.2);
  const spark = (x, y, s) => { glow(ctx, x, y, s * 2.4, P.acc, 0.7); bolt(ctx, [[x - s, y - s], [x + s * 0.2, y - s * 0.1], [x - s * 0.3, y + s * 0.2], [x + s, y + s]], 2.4, P.acc); };
  ctx.save(); ctx.scale(0.86, 0.86); ctx.translate(0, by);
  // ---- aile arrière
  stormWing(ctx, 18, -132, wa - 0.75, 100, bD, P.acc, true);
  // ---- queue
  for (const [r, l] of [[0.25, 70], [0.55, 64], [0.85, 56]]) {
    ctx.save(); ctx.translate(40, -78); ctx.rotate(r + a.s * 0.05);
    const t = () => smooth(ctx, [[0, -6], [l * 0.6, -8], [l, 0], [l * 0.6, 8], [0, 6]], true, 0.4);
    C(ctx, t, bD, l * 0.5, 0, 10, { glint: false });
    clipTo(ctx, t, () => { poly(ctx, [[l * 0.62, -12], [l * 0.7, -2], [l * 0.6, 2], [l * 0.74, 12], [l * 1.2, 12], [l * 1.2, -12]]); ctx.fillStyle = P.acc; ctx.fill(); });
    t(); paint(ctx, null, LW);
    ctx.restore();
  }
  // ---- pattes + serres (étincelles)
  for (const [x, col] of [[18, shade(P.beak, -0.2)], [-4, P.beak]]) {
    limb(ctx, [[x, -62], [x - 2, -40], [x - 4, -28]], 9, 7, col, { lw: LD + 0.5 });
    for (const d of [-9, -2, 5]) limb(ctx, [[x - 4, -28], [x - 4 + d, -20], [x - 4 + d * 1.3 - 2, -15]], 4.6, 2.6, col, { lw: LD });
  }
  if (a.f % 2 === 0) spark(8, -14, 6);
  // ---- corps
  const body = () => smooth(ctx, [[-28, -132], [-6, -152], [26, -148], [50, -118], [56, -82], [40, -56], [10, -50], [-18, -62], [-30, -96]]);
  C(ctx, body, P.body, 12, -100, 44);
  clipTo(ctx, body, () => {
    smooth(ctx, [[-30, -124], [-12, -128], [8, -110], [14, -80], [4, -54], [-20, -60], [-32, -92]]); ctx.fillStyle = P.chest; ctx.fill();
    // plumes en écailles
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = -22 + c * 9 + (r % 2) * 4, y = -116 + r * 14; ctx.beginPath(); ctx.arc(x, y, 5, 0.2, Math.PI - 0.2); ctx.lineWidth = 1.6; ctx.strokeStyle = shade(P.chest, -0.3); ctx.stroke(); }
  });
  body(); paint(ctx, null, LW);
  // emblème éclair sur le poitrail
  glow(ctx, -6, -90, 22, P.acc, 0.45);
  poly(ctx, [[-2, -112], [-14, -90], [-6, -90], [-12, -70], [6, -96], [-2, -96], [6, -112]]); paint(ctx, P.acc, LD + 0.5);
  cracks(ctx, P, body, 30, -100, 26, 61, 2, -0.8, 0.9);
  // ---- tête
  const hx = -30, hy = -156;
  ctx.save(); squash(ctx, hx + 14, hy + 30, 1.18, 1.18);
  // crête en éclairs
  for (const [dx, h, r] of [[-4, 46, -0.35], [12, 50, 0.05], [26, 40, 0.45]]) {
    ctx.save(); ctx.translate(hx + dx, hy - 24); ctx.rotate(r + a.s * 0.05);
    glow(ctx, 0, -h * 0.6, 16, P.acc, 0.5);
    poly(ctx, [[-6, 4], [-8, -h * 0.45], [0, -h * 0.4], [-3, -h], [8, -h * 0.5], [0, -h * 0.55], [6, 4]]); paint(ctx, P.acc, LD + 0.5);
    ctx.restore();
  }
  const head = () => smooth(ctx, [[hx - 32, hy + 8], [hx - 30, hy - 14], [hx - 12, hy - 30], [hx + 12, hy - 32], [hx + 32, hy - 16], [hx + 36, hy + 8], [hx + 26, hy + 26], [hx, hy + 32], [hx - 22, hy + 26]]);
  C(ctx, head, P.body, hx + 2, hy - 2, 34);
  // joues claires
  clipTo(ctx, head, () => { ell(ctx, hx - 4, hy + 22, 22, 12); ctx.fillStyle = P.chest; ctx.fill(); });
  head(); paint(ctx, null, LW);
  // bec crochu (s'ouvre un peu)
  const bo = [0.06, 0.16, 0.24, 0.1][a.f];
  ctx.save(); ctx.translate(hx - 24, hy + 12); ctx.rotate(-bo);
  C(ctx, () => smooth(ctx, [[4, -2], [-14, 0], [-30, 4], [-16, 10], [4, 8]]), shade(P.beak, -0.18), -12, 4, 12, { glint: false });
  for (const x of [-22, -14, -6]) fang(ctx, x, 0.5, 3.4, -3.6, 1.2);
  ctx.restore();
  const beak = () => smooth(ctx, [[hx - 22, hy - 4], [hx - 44, hy - 2], [hx - 58, hy + 8], [hx - 54, hy + 20], [hx - 48, hy + 12], [hx - 36, hy + 12], [hx - 20, hy + 14]], true, 0.45);
  C(ctx, beak, P.beak, hx - 38, hy + 6, 18);
  ell(ctx, hx - 40, hy + 2, 2, 1.4); ctx.fillStyle = OUT; ctx.fill();
  // yeux électriques
  const eyeCol = P.glowEye ? null : '#7ae8ff';
  eye(ctx, P, hx - 16, hy - 6, 6.4, 7.4, { inner: 1, anger: 0.75, lid: P.body, iris: '#2a9ad8', glow: eyeCol, look: [-0.6, 0.1] });
  eye(ctx, P, hx + 4, hy - 7, 8.4, 9.4, { inner: -1, anger: 0.75, lid: P.body, iris: '#2a9ad8', glow: eyeCol, look: [-0.6, 0.1] });
  C(ctx, () => smooth(ctx, [[hx - 28, hy - 14], [hx - 12, hy - 18], [hx - 6, hy - 14], [hx - 20, hy - 10]]), shade(P.body, -0.35), hx - 16, hy - 14, 8, { lw: LD + 0.5, glint: false });
  C(ctx, () => smooth(ctx, [[hx + 18, hy - 24], [hx - 2, hy - 18], [hx - 4, hy - 12], [hx + 16, hy - 16]]), shade(P.body, -0.35), hx + 6, hy - 18, 8, { lw: LD + 0.5, glint: false });
  ctx.restore();
  // ---- aile avant
  stormWing(ctx, 30, -118, wa, 92, P.body, P.acc, false);
  // arcs électriques
  if (a.f % 2 === 1) { spark(-64, -176, 7); spark(92, -120, 6); } else spark(70, -190, 7);
  // ---- variantes
  if (v === 1) {
    goldPlate(ctx, () => smooth(ctx, [[-26, -132], [-8, -146], [14, -142], [10, -128], [-12, -122]]), -6, -134, 12, [[-6, -134]]);
  }
  if (v >= 2) crest(ctx, P, [[hx + 30, hy - 6, -0.6, 12], [40, -140, -1.0, 13], [52, -110, -0.4, 12]], a.f);
  ctx.restore();
  motes(ctx, P, [[-100, -150, 3], [104, -170, 2.6], [-96, -60, 2.4], [96, -40, 2.2]], a.f);
}

// =====================================================================
//  BOSS — Reine Guimauve
// =====================================================================
function drawCandyQueen(ctx, fr, v) {
  const a = A(fr);
  const P = pal(v, { mallow: '#ffe2ee', pink: '#ff8cc0', hair: '#ffa6d4' }, { cape: '#7a3ab0', choco: '#6a3a24' }, { acc: '#3fe0b0' }, { gold: [GOLD, GOLD, '#c6cc3a', '#ffa02a'] });
  const by = [0, -2, -3, -1][a.f];
  const fl = (k, amp = 4) => Math.sin(a.ph + k) * amp;
  const pD = shade(P.pink, -0.2);
  // ---- cape (derrière)
  const cape = () => smooth(ctx, [[-10, -150 + by], [30, -150 + by], [62, -110 + fl(0)], [80, -60 + fl(1)], [92, -14 + fl(2)], [60, -4], [30, -8]], true, 0.4);
  C(ctx, cape, P.cape, 50, -70, 50, { glint: false });
  // hermine guimauve (bord)
  for (let i = 0; i < 6; i++) { const t = i / 5, p = along([[62, -110 + fl(0)], [80, -60 + fl(1)], [92, -14 + fl(2)]], t); oval(ctx, p.x, p.y, 7, 7, P.mallow, { lw: LD + 0.5, hi: 0, glint: false }); ell(ctx, p.x + 1, p.y + 1, 1.6, 2.2); ctx.fillStyle = P.choco; ctx.fill(); }
  // ---- robe en gâteau à étages
  const tier = (y0, y1, w0, w1, col, k) => {
    const sh = () => smooth(ctx, [[-w0, y0], [w0, y0], [w1 + 2, y1 - 4], [w1, y1], [-w1, y1], [-w1 - 2, y1 - 4]], true, 0.2);
    C(ctx, sh, col, 0, (y0 + y1) / 2, (w0 + w1) / 2, { glint: false });
    // glaçage qui coule
    const dr = () => { ctx.beginPath(); ctx.moveTo(-w0 - 3, y0 - 3); ctx.lineTo(w0 + 3, y0 - 3); for (let i = 7; i >= 0; i--) { const x = -w0 + (2 * w0) * i / 7; const d = 6 + ((i + k) % 3) * 4 + (i % 2 ? fl(i, 1) : 0); ctx.quadraticCurveTo(x + w0 / 7, y0 + d + 4, x, y0 + 3); } ctx.closePath(); };
    C(ctx, dr, P.mallow, 0, y0 + 3, w0 * 0.6, { lw: LD + 0.5, glint: false });
  };
  tier(-38 + by * 0.3, -2, 50, 62, P.pink, 0);
  tier(-74 + by * 0.6, -36 + by * 0.3, 38, 50, shade(P.pink, 0.12), 1);
  // bonbons-boutons
  for (const [x, y, c] of [[-40, -18, P.acc], [-12, -16, '#ffd23a'], [16, -18, '#7a5cff'], [42, -16, P.acc], [-24, -50, '#ff4a6a'], [4, -52, P.acc], [28, -50, '#ffd23a']]) {
    C(ctx, () => { ctx.beginPath(); ctx.moveTo(x - 5, y + 3); ctx.quadraticCurveTo(x - 5, y - 5, x, y - 5); ctx.quadraticCurveTo(x + 5, y - 5, x + 5, y + 3); ctx.closePath(); }, c, x, y, 5, { lw: LD, glint: true });
  }
  // ---- buste guimauve
  const bust = () => smooth(ctx, [[-24, -114 + by], [0, -122 + by], [24, -114 + by], [28, -90 + by], [20, -70 + by], [-20, -70 + by], [-28, -90 + by]]);
  C(ctx, bust, P.mallow, 0, -96 + by, 26);
  clipTo(ctx, bust, () => { smooth(ctx, [[-30, -96 + by], [0, -88 + by], [30, -96 + by], [30, -60 + by], [-30, -60 + by]]); ctx.fillStyle = P.pink; ctx.fill(); });
  bust(); paint(ctx, null, LW);
  // ceinture + broche
  C(ctx, () => rr(ctx, -26, -78 + by, 52, 8, 4), P.gold, 0, -74 + by, 14, { lw: LD + 0.5 });
  oval(ctx, 0, -74 + by, 5, 5, P.acc, { lw: LD, hi: 0.35 });
  cracks(ctx, P, bust, 10, -96 + by, 20, 67, 2, -0.6, 0.8);
  // ---- bras arrière (poing sur la hanche)
  limb(ctx, [[20, -110 + by], [38, -94 + by], [22, -80 + by]], 10, 9, shade(P.mallow, -0.1));
  oval(ctx, 22, -80 + by, 6.5, 6, shade(P.mallow, -0.1), { lw: LD + 0.5, hi: 0 });
  // ---- tête
  const hx = -8, hy = -150 + by;
  // cheveux barbe-à-papa (arrière)
  const fluff = [[hx + 26, hy - 28, 14], [hx + 36, hy - 8, 13], [hx + 34, hy + 14, 12], [hx + 24, hy + 30, 11], [hx + 10, hy - 36, 14], [hx - 10, hy - 36, 13], [hx - 26, hy - 26, 12]];
  const hair = () => { ctx.beginPath(); for (const [x, y, r] of fluff) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } };
  ctx.save(); ctx.lineWidth = LW * 2; ctx.strokeStyle = OUT; hair(); ctx.stroke(); ctx.restore();
  hair(); ctx.fillStyle = shade(P.hair, -0.18); ctx.fill();
  clipTo(ctx, hair, () => { ctx.save(); ctx.translate(-2.5, -3.5); hair(); ctx.fillStyle = P.hair; ctx.fill(); ctx.restore(); for (const [x, y, r] of fluff) { ell(ctx, x - r * 0.35, y - r * 0.35, r * 0.35, r * 0.2, -0.5); ctx.fillStyle = shade(P.hair, 0.35); ctx.fill(); } });
  // visage guimauve (cylindre arrondi)
  const head = () => rr(ctx, hx - 36, hy - 28, 66, 58, 22);
  C(ctx, head, P.mallow, hx - 4, hy, 34);
  clipTo(ctx, head, () => { ell(ctx, hx - 4, hy - 26, 34, 8); fillA(ctx, '#ffffff', 0.5); });
  head(); paint(ctx, null, LW);
  // frange en barbe-à-papa
  const bangs = [[hx - 30, hy - 24, 10], [hx - 16, hy - 30, 11], [hx, hy - 30, 11], [hx + 16, hy - 26, 11]];
  const bang = () => { ctx.beginPath(); for (const [x, y, r] of bangs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } };
  ctx.save(); ctx.lineWidth = LW * 2; ctx.strokeStyle = OUT; bang(); ctx.stroke(); ctx.restore();
  bang(); ctx.fillStyle = P.hair; ctx.fill();
  clipTo(ctx, bang, () => { for (const [x, y, r] of bangs) { ell(ctx, x - r * 0.35, y - r * 0.35, r * 0.35, r * 0.2, -0.5); ctx.fillStyle = shade(P.hair, 0.35); ctx.fill(); } });
  // couronne
  const cr = () => poly(ctx, [[hx - 22, hy - 36], [hx - 26, hy - 60], [hx - 13, hy - 48], [hx - 4, hy - 68], [hx + 5, hy - 48], [hx + 18, hy - 60], [hx + 14, hy - 36]]);
  C(ctx, cr, P.gold, hx - 4, hy - 48, 18);
  for (const [x, y, c] of [[hx - 26, hy - 62, '#ff4a6a'], [hx - 4, hy - 70, P.acc], [hx + 18, hy - 62, '#7a5cff']]) oval(ctx, x, y, 4.4, 4.4, c, { lw: LD, hi: 0.35 });
  oval(ctx, hx - 4, hy - 42, 4.6, 3.6, '#ff4a6a', { lw: LD, hi: 0.35 });
  // yeux hautains (mi-clos, cils), joues roses
  const blink = a.f === 3 ? 0.75 : 0.4;
  eye(ctx, P, hx - 24, hy - 2, 5.8, 7, { inner: 1, anger: -0.15, blink, lid: P.mallow, iris: '#d0306a', look: [-0.6, 0.15] });
  eye(ctx, P, hx - 4, hy - 3, 7.6, 9, { inner: -1, anger: -0.15, blink, lid: P.mallow, iris: '#d0306a', look: [-0.6, 0.15] });
  for (const [x, y, d] of [[hx - 30, hy - 5, -1], [hx + 4, hy - 7, 1]]) for (let i = 0; i < 3; i++) line(ctx, [[x + d * i * 2.4, y + 1], [x + d * (i * 2.4 + 3), y - 4]], 2.2);
  brow(ctx, hx - 30, hy - 14, hx - 20, hy - 16, 3);
  brow(ctx, hx + 8, hy - 19, hx - 6, hy - 18, 3.6, OUT, -2.4);
  blush(ctx, hx - 30, hy + 10, 6, 3.4, 0.5);
  blush(ctx, hx + 6, hy + 9, 7, 3.8, 0.5);
  // grain de beauté (pépite de chocolat)
  oval(ctx, hx - 20, hy + 16, 2, 2, P.choco, { lw: 0, hi: 0.3, glint: false });
  // sourire narquois + crocs
  line(ctx, [[hx - 30, hy + 14], [hx - 22, hy + 18], [hx - 12, hy + 16], [hx - 6, hy + 11]], 2.6);
  fang(ctx, hx - 25, hy + 16, 3.4, 4.4); fang(ctx, hx - 15, hy + 16.8, 3.4, 4.4);
  // ---- bras avant + sceptre-sucette
  const sx = -54, sy = -102 + by - a.up * 2;
  limb(ctx, [[-20, -110 + by], [-38, -104 + by], [sx + 4, sy]], 10, 9, P.mallow);
  const st = [sx - 2, -40 + by], tp = [sx - 6 + a.s * 2, -170 + by];
  limb(ctx, [st, tp], 6, 6, P.gold, { lw: LD + 0.5 });
  const lol = () => ell(ctx, tp[0], tp[1] - 14, 20, 20);
  glow(ctx, tp[0], tp[1] - 14, 34, P.acc, 0.4);
  C(ctx, lol, '#ffffff', tp[0], tp[1] - 14, 20, { glint: false, hi: 0 });
  clipTo(ctx, lol, () => {
    ctx.save(); ctx.translate(tp[0], tp[1] - 14); ctx.rotate(a.f * 0.5);
    for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let t = 0; t < TAU * 2.6; t += 0.12) { const r = t * 1.2; ctx.lineTo(Math.cos(t + k * Math.PI) * r, Math.sin(t + k * Math.PI) * r); } ctx.lineWidth = 5; ctx.strokeStyle = k ? P.pink : P.acc; ctx.stroke(); }
    ctx.restore();
  });
  lol(); paint(ctx, null, LW);
  gloss(ctx, tp[0] - 8, tp[1] - 24, 5, 2.6, 0.8);
  C(ctx, () => { ctx.beginPath(); ctx.moveTo(tp[0] - 10, tp[1] + 8); ctx.lineTo(tp[0] + 10, tp[1] + 8); ctx.lineTo(tp[0], tp[1] + 2); ctx.closePath(); }, P.gold, tp[0], tp[1] + 6, 6, { lw: LD + 0.5, glint: false });
  oval(ctx, sx + 4, sy, 7, 6.6, P.mallow, { lw: LD + 0.5, hi: 0 });
  // ---- variantes
  if (v === 1) { goldPlate(ctx, () => rr(ctx, -52, -42 + by * 0.3, 104, 7, 3.5), 0, -38, 30, [[-36, -38.5], [0, -38.5], [36, -38.5]]); }
  crest(ctx, P, [[hx - 30, hy - 34, -2.0, 12], [hx + 18, hy - 36, -1.2, 12], [hx + 34, hy - 18, -0.6, 11], [64, -100 + fl(0), -0.5, 11]], a.f);
  motes(ctx, P, [[-100, -150, 3], [100, -150, 2.6], [-100, -60, 2.4], [104, -40, 2.2]], a.f);
  for (const [x, y] of [[-80, -120], [70, -170], [-70, -20]]) sparkle(ctx, x, y + (a.f % 2) * 3, 4, '#ffffff', 0.9);
}

// ------------------------------------------------------------ registre
// box : [x0, y0, w, h] en unités finales (contours, lueurs et animations inclus)
// k : échelle appliquée au dessin (tailles relatives)
const DEFS = {
  scorpion: { box: [-67, -90, 132, 94], draw: drawScorpion },
  mummy: { box: [-51, -101, 97, 107], draw: drawMummy },
  monkey: { box: [-47, -102, 93, 108], draw: drawMonkey },
  snake: { box: [-62, -96, 118, 101], draw: drawSnake },
  shark: { box: [-64, -99, 131, 103], draw: drawShark },
  puffer: { box: [-46, -93, 90, 97], draw: drawPuffer },
  bat: { box: [-49, -104, 104, 108], draw: drawBat },
  skeleton: { box: [-49, -110, 96, 116], draw: drawSkeleton },
  gearbot: { box: [-56, -104, 101, 109], draw: drawGearbot },
  can: { box: [-47, -98, 88, 103], draw: drawCan },
  crow: { box: [-51, -106, 102, 112], draw: drawCrow },
  stormcloud: { box: [-51, -99, 102, 103], draw: drawStormcloud },
  gummy: { box: [-49, -87, 100, 93], draw: drawGummy },
  cupcake: { box: [-47, -106, 90, 111], draw: drawCupcake },
};
const BDEFS = {
  pharaohRat: { k: 0.92, box: [-95, -215, 198, 224], draw: drawPharaohRat },
  gorilla: { k: 0.96, box: [-113, -227, 228, 236], draw: drawGorilla },
  kraken: { k: 0.96, box: [-114, -217, 228, 225], draw: drawKraken },
  vampDog: { k: 1, box: [-121, -228, 242, 235], draw: drawVampDog },
  megaMixer: { k: 0.88, box: [-112, -218, 213, 224], draw: drawMegaMixer },
  thunderBird: { k: 0.96, box: [-112, -218, 227, 229], draw: drawThunderBird },
  candyQueen: { k: 0.92, box: [-107, -216, 216, 226], draw: drawCandyQueen },
};

export const ENEMY_INFO2 = {
  scorpion: { name: 'Scorpion des sables', h: 74 },
  mummy: { name: 'Souris momie', h: 90 },
  monkey: { name: 'Singe chapardeur', h: 95 },
  snake: { name: 'Serpent hypnotique', h: 87 },
  shark: { name: 'Requin à lunettes', h: 93, fly: true },
  puffer: { name: 'Poisson-globe', h: 88, fly: true },
  bat: { name: 'Chauve-souris vampire', h: 98, fly: true },
  skeleton: { name: 'Squelette de chien', h: 93 },
  gearbot: { name: 'Robot à engrenages', h: 96 },
  can: { name: 'Conserve maléfique', h: 94 },
  crow: { name: 'Corbeau voleur', h: 93, fly: true },
  stormcloud: { name: 'Nuage orageux', h: 89, fly: true },
  gummy: { name: 'Ourson gélifié', h: 81 },
  cupcake: { name: 'Cupcake mordant', h: 102 },
};
export const BOSS_INFO2 = {
  pharaohRat: { name: 'Rat-Pharaon', h: 208, fly: true },
  gorilla: { name: 'Gorille Géant', h: 209 },
  kraken: { name: 'Kraken', h: 210 },
  vampDog: { name: 'Comte Toutoula', h: 210 },
  megaMixer: { name: 'Robot Mixeur', h: 213 },
  thunderBird: { name: 'Oiseau-Tonnerre', h: 211, fly: true },
  candyQueen: { name: 'Reine Guimauve', h: 210 },
};

const spriteCache = new Map();
const portraitCache = new Map();
function frameOf(frame) { return ((Math.floor(frame) || 0) % 4 + 4) % 4; }
function variantOf(variant) { const v = Math.floor(variant) || 0; return v < 0 ? 0 : v > 3 ? 3 : v; }
function build(table, tag, fallback, id, frame, variant) {
  const key0 = table[id] ? id : fallback;
  const def = table[key0];
  const f = frameOf(frame), v = variantOf(variant);
  const key = tag + key0 + ':' + f + ':' + v;
  let s = spriteCache.get(key);
  if (!s) {
    const [x0, y0, w, h] = def.box;
    const k = def.k || 1;
    s = makeSprite(x0, y0, w, h, (ctx) => { if (k !== 1) ctx.scale(k, k); def.draw(ctx, f, v); });
    spriteCache.set(key, s);
  }
  return s;
}

// Sprite pré-rendu (mis en cache). frame : compteur quelconque (4 poses), variant : 0..3.
export function enemySprite2(kind, frame = 0, variant = 0) { return build(DEFS, 'e:', 'scorpion', kind, frame, variant); }
// Portrait PNG (dataURL 96×96) pour l'interface, mis en cache.
export function enemyPortrait2(kind, variant = 0) {
  const key = (DEFS[kind] ? kind : 'scorpion') + ':' + variantOf(variant);
  let u = portraitCache.get(key);
  if (!u) { u = spriteURL(enemySprite2(kind, 0, variant), 96); portraitCache.set(key, u); }
  return u;
}
export function bossSprite2(id, frame = 0, variant = 0) { return build(BDEFS, 'b:', 'pharaohRat', id, frame, variant); }
export function bossPortrait2(id, variant = 0) {
  const key = 'boss:' + (BDEFS[id] ? id : 'pharaohRat') + ':' + variantOf(variant);
  let u = portraitCache.get(key);
  if (!u) { u = spriteURL(bossSprite2(id, 0, variant), 128); portraitCache.set(key, u); }
  return u;
}
