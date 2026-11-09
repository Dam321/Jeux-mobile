// =====================================================================
//  « Les Nuisibles » — le gang de tout ce que les chats détestent.
//  Dessin vectoriel Canvas 2D, vue de côté, cel shading (cel() de draw.js),
//  contour OUT épais et liseré coloré (rim light) propre à chaque personnage.
//
//  Repère local : pieds en y = 0, y vers le bas, centré en x = 0.
//  LES ENNEMIS REGARDENT VERS LA GAUCHE (x négatif).
//  frame : entier quelconque (4 poses : frame % 4).
//  variant : 0 normal · 1 Élite (or) · 2 Corrompu (toxique) · 3 Infernal (braise).
// =====================================================================
import {
  OUT, shade, mix, rgba, seeded, ell, rr, smooth, poly, paint, glow, cel,
  makeSprite, spriteURL, opaqueBounds,
} from './draw.js';

export const ENEMY_KINDS = ['rat', 'dog', 'vacuum', 'cucumber', 'pigeon', 'crab', 'wasp', 'mole', 'yeti', 'robodog', 'slime', 'ufo', 'ghost', 'knightrat'];

// h : hauteur de la silhouette au-dessus de la ligne des pieds (unités) · fly : flotte au-dessus du sol
export const ENEMY_INFO = {
  rat: { name: 'Souris voyou', h: 72 },
  dog: { name: 'Bouledogue', h: 85 },
  vacuum: { name: 'Aspi-Bot', h: 66 },
  cucumber: { name: 'Concombre maléfique', h: 103 },
  pigeon: { name: 'Pigeon pirate', h: 77 },
  crab: { name: 'Crabe pinceur', h: 64 },
  wasp: { name: 'Frelon', h: 118, fly: true },
  mole: { name: 'Taupe mineuse', h: 76 },
  yeti: { name: 'Bonhomme de neige maléfique', h: 103 },
  robodog: { name: 'Toutou-Tron', h: 90 },
  slime: { name: 'Gloop de lave', h: 70 },
  ufo: { name: 'Souris martienne', h: 94, fly: true },
  ghost: { name: 'Fantôme drap', h: 97, fly: true },
  knightrat: { name: 'Rat chevalier', h: 100 },
};

export const BOSS_KINDS = ['ratKing', 'cerberus', 'crabTitan', 'yetiLord', 'vacuumPrime', 'magmaKing', 'martianEmperor'];
export const BOSS_INFO = {
  ratKing: { name: 'Roi des Rats', h: 170 },
  cerberus: { name: 'Cerbère le Bouledogue', h: 175 },
  crabTitan: { name: 'Crabe Titan', h: 190 },
  yetiLord: { name: 'Yéti Suprême', h: 210 },
  vacuumPrime: { name: 'Aspirateur Suprême', h: 185 },
  magmaKing: { name: 'Roi Magma', h: 190 },
  martianEmperor: { name: 'Empereur Martien', h: 205 },
};

const TAU = Math.PI * 2;
const WHITE = '#fffaf0';

// =====================================================================
//  Palettes & variantes
//  Une palette de base associe chaque couleur à un rôle :
//   b corps · d peau/détails roses · c tissu · m métal · a accent (cheveux, bandeau…)
//   e iris / LED · g lumière (lampe, réacteur) · k inchangé
//  Chaque variante remappe les rôles par luminance sur des rampes de couleurs :
//  la structure clair/foncé du personnage est conservée, la teinte change.
// =====================================================================
function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex) { const [r, g, b] = rgb(hex); return (0.3 * r + 0.55 * g + 0.15 * b) / 255; }
function ramp(stops, L) {
  const n = stops.length - 1;
  const x = Math.max(0, Math.min(1, L)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}
const GOLD_R = ['#3a1f04', '#8a560c', '#dc9c1c', '#ffd23f', '#fff3b0'];
const RAMPS = {
  1: { m: GOLD_R, a: GOLD_R },
  2: {
    b: ['#170b26', '#3d1f66', '#7348b4', '#a984e8', '#e9ddff'],
    d: ['#13200b', '#3d6a18', '#79b52e', '#bdf064', '#efffc6'],
    c: ['#0b120c', '#17281a', '#264028', '#3f6236', '#7c9c5a'],
    m: ['#100a18', '#2a2040', '#4f4470', '#857aa8', '#d0caea'],
    a: ['#183808', '#3c8a10', '#74d81a', '#b0ff44', '#ebffc0'],
  },
  3: {
    b: ['#0e0507', '#2c0c10', '#5a1716', '#952a1c', '#d85a30'],
    d: ['#260704', '#6e1a08', '#c8401a', '#ff8428', '#ffd27a'],
    c: ['#090607', '#181012', '#2a1e22', '#43343a', '#6e5c64'],
    m: ['#100909', '#2a1818', '#4e2e2c', '#84523e', '#d09a70'],
    a: ['#4a0c04', '#a8260a', '#ff5410', '#ffa02a', '#ffe27a'],
  },
};
const EYE_GLOW = { 2: '#9dff3a', 3: '#ffae2a' };
const RIM_V = { 1: '#ffd23f', 2: '#9dff3a', 3: '#ff7a1a' };
function pal(base, v) {
  const out = {};
  for (const k in base) {
    const val = base[k];
    if (!Array.isArray(val)) { out[k] = val; continue; }
    const [c, role] = val;
    let r = c;
    if (v === 1) {
      if (RAMPS[1][role]) r = ramp(RAMPS[1][role], lum(c) * 0.85 + 0.12);
    } else if (v >= 2) {
      if (role === 'e' || role === 'g') r = EYE_GLOW[v];
      else if (RAMPS[v][role]) r = ramp(RAMPS[v][role], lum(c));
    }
    out[k] = r;
  }
  out.rim = v ? RIM_V[v] : base.rim;
  out.gold = ramp(GOLD_R, 0.78);
  out.goo = v === 3 ? '#ff7a1a' : '#9dff3a';
  return out;
}

// ------------------------------------------------------------ état courant
let V = 0;        // variante en cours de dessin
let RIM = '#ffffff';
let EYEG = null;  // couleur d'yeux luisants (variantes 2 et 3)

// =====================================================================
//  Formes géométriques « porteuses » (centre et taille pour cel())
// =====================================================================
function geo(f, pts, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  f.cx = (x0 + x1) / 2; f.cy = (y0 + y1) / 2;
  f.size = Math.max(3, ((x1 - x0) + (y1 - y0)) / 4 + pad);
  return f;
}
const B = (pts, t = 0.5) => geo((ctx) => smooth(ctx, pts, true, t), pts);
const PL = (pts) => geo((ctx) => poly(ctx, pts), pts);
function E(x, y, rx, ry = rx, rot = 0) {
  const f = (ctx) => ell(ctx, x, y, rx, ry, rot);
  f.cx = x; f.cy = y; f.size = (Math.abs(rx) + Math.abs(ry)) / 2;
  return f;
}
function RR(x, y, w, h, r) {
  const f = (ctx) => rr(ctx, x, y, w, h, r);
  f.cx = x + w / 2; f.cy = y + h / 2; f.size = (Math.abs(w) + Math.abs(h)) / 4;
  return f;
}
const TP = (pts, w0, w1 = w0) => geo((ctx) => taper(ctx, pts, w0, w1), pts, (w0 + w1) / 4);

// Échantillonne une courbe Catmull-Rom passant par pts.
function spline(pts, n = 8) {
  const out = [];
  const N = pts.length;
  if (N < 2) return pts.map((p) => p.slice());
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
// Chemin d'un trait effilé (queue, bras, antenne…) de largeur w0 → w1, bouts arrondis.
function taper(ctx, pts, w0, w1 = w0) {
  const s = spline(pts, 8);
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
// Point (et tangente) le long d'une courbe
function along(pts, t) {
  const s = spline(pts, 10);
  const i = Math.min(s.length - 2, Math.max(0, Math.round(t * (s.length - 1))));
  const a = s[i], b = s[i + 1];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: a[0], y: a[1], tx: (b[0] - a[0]) / d, ty: (b[1] - a[1]) / d };
}
function stroke(ctx, w = 3, col = OUT) {
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function fillA(ctx, color, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
function clip(ctx, s, fn) { ctx.save(); s(ctx); ctx.clip(); fn(); ctx.restore(); }

// =====================================================================
//  Remplissage « Nuisible » : cel shading + détails internes + liseré + fissures + contour
// =====================================================================
function rimLight(ctx, s, color, w, lw) {
  const d = w + lw / 2;
  ctx.save();
  s(ctx); ctx.clip();
  ctx.save(); ctx.translate(-0.5 * d, -0.86 * d); s(ctx); ctx.restore();
  ctx.rect(-1e4, -1e4, 2e4, 2e4);
  ctx.clip('evenodd');
  ctx.fillStyle = color;
  ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  ctx.restore();
}
function cracks(ctx, s, seed, n = 3) {
  const col = V === 2 ? '#a6ff3a' : '#ffb02e';
  const r = seeded(seed * 7919 + 101);
  const k = s.size;
  ctx.save(); s(ctx); ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
  const draw = (pts) => {
    poly(ctx, pts, false);
    ctx.strokeStyle = rgba(col, 0.3); ctx.lineWidth = 6.5; ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3.2; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
  };
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU + r() * 1.4 - 0.4;
    let x = s.cx + Math.cos(th) * k * 1.05, y = s.cy + Math.sin(th) * k * 0.95;
    const pts = [[x, y]];
    let a = th + Math.PI + (r() - 0.5) * 0.5;
    for (let j = 0; j < 4; j++) {
      const L = k * 0.17 + 2 + r() * 2;
      const z = a + (j % 2 ? 0.55 : -0.55);
      x += Math.cos(z) * L; y += Math.sin(z) * L; pts.push([x, y]);
    }
    draw(pts);
    const p = pts[2], b = a + (r() > 0.5 ? 1.1 : -1.1);
    draw([p, [p[0] + Math.cos(b) * (3 + k * 0.12), p[1] + Math.sin(b) * (3 + k * 0.12)]]);
  }
  ctx.restore();
}
// o : size/cx/cy (cel), shadow, depth, hi, glint, inside(), rim (couleur ou false), rw, crack (graine), lw
function fig(ctx, s, base, o = {}) {
  const k = o.size ?? s.size;
  const lw = o.lw ?? 3;
  cel(ctx, s, base, {
    cx: o.cx ?? s.cx, cy: o.cy ?? s.cy, size: k,
    shadow: o.shadow ?? 0.3, depth: o.depth ?? 0.24, hi: o.hi ?? 0.18,
    glint: o.glint ?? (k > 10), lw: 0,
  });
  if (o.inside) clip(ctx, s, o.inside);
  const rc = o.rim === undefined ? RIM : o.rim;
  if (rc) rimLight(ctx, s, rc, o.rw ?? Math.min(2.2, 0.9 + k * 0.06), lw);
  if (o.crack != null && V >= 2) cracks(ctx, s, o.crack, o.cn ?? 3);
  if (lw > 0) { s(ctx); stroke(ctx, lw); }
}
// Trait effilé rempli en cel (bras, queue, tentacule…)
function limb(ctx, pts, w0, w1, col, o = {}) { fig(ctx, TP(pts, w0, w1), col, { glint: false, ...o }); }
function blob(ctx, x, y, r, col, o = {}) { fig(ctx, E(x, y, r, o.ry ?? r, o.rot ?? 0), col, { glint: r > 5, ...o }); }

// =====================================================================
//  Visage
// =====================================================================
// Œil expressif. inner : côté du coin intérieur (+1 = vers +x). anger : inclinaison de la paupière,
// lid : fermeture (0 ouvert … 1 fermé). look : direction du regard (-1..1). Variantes 2/3 : yeux luisants.
function eye(ctx, x, y, r, o = {}) {
  const ry = o.ry ?? r * 1.18;
  const skin = o.skin ?? '#888888';
  const inner = o.inner ?? 1;
  const ang = o.anger ?? 0.45;
  const lid = o.lid ?? 0.12;
  const look = o.look ?? [-0.5, 0.15];
  const sh = () => ell(ctx, x, y, r, ry);
  if (o.blink) {
    sh(); ctx.fillStyle = shade(skin, -0.12); ctx.fill(); stroke(ctx, 2.2);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y - ry * 0.05 + inner * ang * ry * 0.3);
    ctx.quadraticCurveTo(x, y + ry * 0.45, x + r * 0.95, y - ry * 0.05 - inner * ang * ry * 0.3);
    stroke(ctx, 2.6);
    return;
  }
  const lit = o.lit === false ? null : EYEG;
  const px = x + look[0] * r * 0.42, py = y + look[1] * ry * 0.4 + ry * 0.06;
  sh(); ctx.fillStyle = lit ? '#1a0b1c' : '#ffffff'; ctx.fill();
  ctx.save(); sh(); ctx.clip();
  if (lit) {
    glow(ctx, px, py, r * 1.5, lit, 0.95);
    ell(ctx, px, py, r * 0.66, ry * 0.68); ctx.fillStyle = lit; ctx.fill();
    ell(ctx, px - r * 0.1, py - ry * 0.1, r * 0.34, ry * 0.36); ctx.fillStyle = mix(lit, '#ffffff', 0.75); ctx.fill();
    ell(ctx, px, py, r * 0.13, ry * 0.5); ctx.fillStyle = OUT; ctx.fill();
  } else {
    ell(ctx, x + r * 0.15, y - ry * 1.02, r * 1.35, ry * 0.62); ctx.fillStyle = 'rgba(86,64,150,0.2)'; ctx.fill();
    ell(ctx, px, py, r * 0.66, ry * 0.7); ctx.fillStyle = o.iris ?? '#3d2a66'; ctx.fill();
    ell(ctx, px, py + ry * 0.05, r * 0.38, ry * 0.42); ctx.fillStyle = '#130a1d'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ell(ctx, px - r * 0.27, py - ry * 0.28, r * 0.27, r * 0.25); ctx.fill();
    ell(ctx, px + r * 0.24, py + ry * 0.26, r * 0.12, r * 0.12); ctx.fill();
  }
  if (lid > 0 || ang !== 0) {
    const xo = x - inner * r * 1.4, xi = x + inner * r * 1.4;
    const yb = y - ry + lid * 2 * ry;
    const yo = yb - ang * ry * 0.75, yi = yb + ang * ry * 0.75;
    poly(ctx, [[xo, yo], [xi, yi], [xi, y - ry * 3], [xo, y - ry * 3]]);
    ctx.fillStyle = skin; ctx.fill();
    ctx.beginPath(); ctx.moveTo(xo, yo); ctx.lineTo(xi, yi); stroke(ctx, 2.8);
  }
  ctx.restore();
  sh(); stroke(ctx, o.lw ?? 2.4);
  if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, px, py, r * 2.3, lit, 0.55); ctx.restore(); }
}
// Sourcil épais (du bout extérieur x0 vers l'intérieur x1)
function brow(ctx, x0, y0, x1, y1, w = 4.5, col = OUT) {
  taper(ctx, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - w * 0.35], [x1, y1]], w * 0.55, w);
  ctx.fillStyle = col; ctx.fill();
}
function fang(ctx, x, y, h = 4.5, w = 3.4, up = false, col = WHITE) {
  const d = up ? -1 : 1;
  poly(ctx, [[x - w / 2, y], [x + w / 2, y], [x + w * 0.12, y + d * h]]);
  paint(ctx, col, 1.7);
}
function blush(ctx, x, y, rx = 4.5, ry = 2.6, a = 0.42) { ell(ctx, x, y, rx, ry); fillA(ctx, '#ff5d8f', a); }

// =====================================================================
//  Accessoires et décors de variantes
// =====================================================================
function spike(ctx, x, y, ang, len = 8, w = 5, col = '#ffd23f', lw = 2) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const a = [x + nx * w / 2, y + ny * w / 2], b = [x + dx * len, y + dy * len], c = [x - nx * w / 2, y - ny * w / 2];
  poly(ctx, [a, b, c]); ctx.fillStyle = shade(col, -0.22); ctx.fill();
  const lit = (nx * -0.55 + ny * -0.83) > 0 ? a : c;
  poly(ctx, [lit, b, [x, y]]); ctx.fillStyle = shade(col, 0.2); ctx.fill();
  poly(ctx, [a, b, c]); stroke(ctx, lw);
}
// Épaulière dorée à pointes (Élite)
function pauldron(ctx, x, y, r, rot = 0, col) {
  const g = col || PAL.gold;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  spike(ctx, -r * 0.45, -r * 0.5, -Math.PI / 2 - 0.55, r * 1.05, r * 0.55, g);
  spike(ctx, r * 0.35, -r * 0.62, -Math.PI / 2 + 0.25, r * 0.95, r * 0.5, g);
  fig(ctx, B([[-r, r * 0.35], [-r * 0.92, -r * 0.45], [0, -r * 0.85], [r * 0.92, -r * 0.45], [r, r * 0.35], [0, r * 0.12]]), g, { rim: false });
  ell(ctx, -r * 0.45, -r * 0.08, r * 0.14, r * 0.14); ctx.fillStyle = OUT; ctx.fill();
  ell(ctx, r * 0.45, -r * 0.08, r * 0.14, r * 0.14); ctx.fill();
  ctx.restore();
}
// Petite flamme stylisée (Infernal)
function flame(ctx, x, y, s, ph = 0, lean = 0) {
  const sw = Math.sin(ph) * s * 0.22 + lean * s;
  const [c0, c1, c2] = V === 2 ? ['#7dff2a', '#4cc81a', '#e6ffb0'] : ['#ff6a1a', '#ff5a14', '#ffd23a'];
  glow(ctx, x, y - s * 0.7, s * 1.7, c0, 0.42);
  const outer = [[x - s * 0.62, y], [x - s * 0.62, y - s * 0.55], [x - s * 0.18 + sw * 0.4, y - s * 1.05], [x + sw, y - s * 1.8], [x + s * 0.3 + sw * 0.4, y - s * 0.95], [x + s * 0.62, y - s * 0.5], [x + s * 0.55, y]];
  smooth(ctx, outer); paint(ctx, c1, 2);
  const inner = outer.map(([px, py]) => [x + (px - x) * 0.55, y + (py - y) * 0.6]);
  smooth(ctx, inner); ctx.fillStyle = c2; ctx.fill();
}
// Goutte de poison qui pend (Corrompu)
function drip(ctx, x, y, len, ph = 0, col) {
  const L = len * (0.75 + 0.25 * Math.sin(ph));
  smooth(ctx, [[x - 3, y - 1], [x + 3, y - 1], [x + 1.8, y + L * 0.55], [x + 2.8, y + L], [x, y + L + 3], [x - 2.8, y + L], [x - 1.8, y + L * 0.55]]);
  paint(ctx, col || PAL.goo, 2);
  ell(ctx, x - 1, y + L - 0.3, 0.9, 1.3); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
}
function sparkle(ctx, x, y, r, color = '#ffffff') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}
// Particules d'ambiance de variante : paillettes d'or, bulles toxiques, braises
function motes(ctx, a, seed, x0, y0, w, h, n = 4) {
  if (!V) return;
  const r = seeded(seed + 17);
  for (let i = 0; i < n; i++) {
    const px = x0 + r() * w, py0 = y0 + r() * h, off = r();
    const ph = (a.f / 4 + off) % 1;
    const y = py0 - ph * 16;
    const sz = Math.sin(ph * Math.PI);
    if (V === 1) { sparkle(ctx, px, y + ph * 10, 2 + sz * 3.2, '#fff2a0'); }
    else if (V === 2) {
      ell(ctx, px + Math.sin(ph * 6) * 1.5, y, 1.6 + sz * 1.8, 1.6 + sz * 1.8);
      ctx.fillStyle = rgba('#9dff3a', 0.85); ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = OUT; ctx.stroke();
    } else {
      glow(ctx, px, y, 5 + sz * 3, '#ff7a1a', 0.6);
      ell(ctx, px, y, 1.2 + sz * 1.2, 1.2 + sz * 1.2); ctx.fillStyle = '#ffd27a'; ctx.fill();
    }
  }
}
// Petit badge du gang (patte de chat barrée)
function gangBadge(ctx, x, y, r, base, mark) {
  blob(ctx, x, y, r, base, { rim: false, lw: 2 });
  ctx.fillStyle = mark;
  ell(ctx, x, y + r * 0.18, r * 0.32, r * 0.26); ctx.fill();
  for (const [dx, dy] of [[-0.36, -0.22], [-0.12, -0.42], [0.14, -0.42], [0.38, -0.22]]) { ell(ctx, x + dx * r, y + dy * r, r * 0.12, r * 0.14); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.58); ctx.lineTo(x + r * 0.62, y - r * 0.62);
  ctx.lineWidth = r * 0.22; ctx.strokeStyle = '#ff2a4a'; ctx.lineCap = 'round'; ctx.stroke();
}

// =====================================================================
//  Animation : 4 poses (contact, passage, contact, passage)
// =====================================================================
function anim(frame) {
  const f = ((Math.floor(frame || 0) % 4) + 4) % 4;
  const ph = f * Math.PI / 2;
  return {
    f, ph, s: Math.sin(ph), c: Math.cos(ph),
    step: [1, 0, -1, 0][f],        // écart des pieds : +1 pied avant devant
    lift: [0, 1, 0, -1][f],        // pied levé : 1 = avant, -1 = arrière
    up: [0, 1, 0, 1][f],           // pose haute (passage)
    sx: [1.045, 0.97, 1.045, 0.97][f],
    sy: [0.955, 1.035, 0.955, 1.035][f],
    hov: [0, -3, -5, -3][f],       // flottement (volants)
    blink: f === 3,
  };
}
// Écrasement / étirement autour des pieds
function squash(ctx, a, k = 1) { ctx.scale(1 + (a.sx - 1) * k, 1 + (a.sy - 1) * k); }

let PAL = null;

// Basket montante (pied gauche = avant)
function sneaker(ctx, x, y, col, toe = WHITE) {
  const s = B([[x - 9, y - 1], [x - 8.6, y - 6], [x - 2, y - 9], [x + 5, y - 8], [x + 6.6, y - 2.5], [x + 3, y + 0.3], [x - 5, y + 0.3]]);
  fig(ctx, s, col, {
    glint: false, rim: false,
    inside: () => {
      ell(ctx, x - 6.6, y - 3.2, 4.2, 3.8); ctx.fillStyle = toe; ctx.fill();
      ctx.fillStyle = toe; ctx.fillRect(x - 11, y - 2.2, 20, 4);
      ctx.beginPath(); ctx.moveTo(x - 11, y - 2.2); ctx.lineTo(x + 9, y - 2.2); stroke(ctx, 1.6);
    },
  });
}

// =====================================================================
//  1. Souris voyou — punk des rues : crête, gilet clouté, collier à pics, peigne-cran d'arrêt
// =====================================================================
const RAT = {
  rim: '#ff4fa8',
  fur: ['#a7a9cc', 'b'], belly: ['#e6e3f5', 'b'], skin: ['#ff9ec0', 'd'], nose: ['#ff5f93', 'd'],
  vest: ['#3a2c4c', 'c'], jeans: ['#4b5598', 'c'], shoe: ['#ff3d7f', 'a'], hair: ['#ff3d9a', 'a'],
  metal: ['#d9def0', 'm'], iris: ['#46307a', 'e'],
};
function drawRat(ctx, a, P) {
  const st = a.step;
  // queue
  const tw = a.s * 3;
  limb(ctx, [[10, -14], [24, -9], [35, -17], [37 + tw * 0.3, -31], [29 + tw, -39]], 6, 2.6, P.skin);
  ctx.save(); ctx.translate(35.5, -21); ctx.rotate(-0.25);
  fig(ctx, RR(-4.5, -2.6, 9, 5.2, 1.6), '#f6d7a8', { rim: false, glint: false, lw: 2 });
  ctx.restore();
  // jambes + baskets
  const bx = 8 - st * 4, by = a.lift === -1 ? -4 : 0;
  const fx = -6 + st * 4, fy = a.lift === 1 ? -4 : 0;
  limb(ctx, [[6, -14], [bx + 1, by - 6]], 7.5, 6.5, shade(P.jeans, -0.18));
  sneaker(ctx, bx, by, shade(P.shoe, -0.15));
  limb(ctx, [[-4, -14], [fx + 1, fy - 6]], 7.5, 6.5, P.jeans);
  sneaker(ctx, fx, fy, P.shoe);

  ctx.save();
  ctx.translate(0, -a.up * 1.2);
  squash(ctx, a);
  // bras arrière (main sur la hanche)
  limb(ctx, [[9, -31], [17, -25], [15, -17]], 7, 6, shade(P.fur, -0.12));
  blob(ctx, 14, -16, 4.4, shade(P.skin, -0.1), { rim: false });
  // corps + gilet de cuir
  const body = B([[-12, -31], [-4, -38], [8, -37], [15, -26], [14, -11], [5, -6], [-8, -7], [-14, -17]]);
  fig(ctx, body, P.fur, {
    crack: 1, cn: 2,
    inside: () => {
      ell(ctx, -6, -18, 8, 11); ctx.fillStyle = P.belly; ctx.fill();
      fig(ctx, PL([[-3, -41], [20, -41], [20, -2], [1, -2], [3, -14], [-1, -27]]), P.vest, { rim: false, lw: 2.6 });
      for (const [x, y] of [[4, -34], [9, -32], [13, -27], [6, -10], [11, -12]]) blob(ctx, x, y, 2, P.metal, { lw: 1.4, rim: false, glint: false });
    },
  });
  // collier à pics
  const col = [[-13, -36], [-3, -38.5], [8, -37]];
  for (const t of [0.15, 0.5, 0.85]) { const p = along(col, t); spike(ctx, p.x, p.y + 1.5, Math.PI / 2 + 0.25 - t * 0.5, 6, 4.4, P.metal); }
  limb(ctx, col, 5, 5, P.vest, { rim: false });
  // bras avant + peigne à cran d'arrêt pointé vers le héros
  const hx = -19, hy = -27 - a.up;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-1.22 + a.s * 0.1);
  fig(ctx, B([[-3.2, -6], [3.2, -6], [3.2, -22], [0, -27], [-3.2, -22]], 0.15), P.metal, {
    rim: false, lw: 2.4, glint: false, hi: 0.3,
    inside: () => { ctx.fillStyle = shade(P.metal, -0.5); for (let y = -22; y < -7; y += 3) ctx.fillRect(0.6, y, 4, 1.4); },
  });
  fig(ctx, RR(-3, -7, 6, 12, 2.4), P.vest, { rim: false, lw: 2.4, glint: false });
  ctx.restore();
  limb(ctx, [[-3, -31], [-10, -22], [hx + 1, hy + 1]], 7.5, 6.5, P.fur);
  blob(ctx, hx, hy, 5, P.skin, { rim: false });
  if (V === 1) pauldron(ctx, -4, -33, 8.5, -0.3);
  ctx.restore();

  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 2.2);
  squash(ctx, a, 0.6);
  const ear = (x, y, r, c) => fig(ctx, E(x, y, r, r * 0.96), c, { inside: () => { ell(ctx, x + r * 0.05, y + r * 0.12, r * 0.64, r * 0.6); ctx.fillStyle = P.skin; ctx.fill(); } });
  ear(16, -64, 10.5, shade(P.fur, -0.08));
  ear(5, -72, 12.5, P.fur);
  // anneau d'oreille
  for (const [w, c] of [[4.8, OUT], [2.2, P.metal]]) { ctx.beginPath(); ctx.arc(-6.5, -68, 3.4, 0.3, TAU - 1.3); stroke(ctx, w, c); }
  const head = B([[-32, -49], [-27, -58], [-16, -66], [-2, -69], [10, -64], [15, -53], [11, -41], [0, -35], [-14, -36], [-26, -41]]);
  fig(ctx, head, P.fur, {
    crack: 2, cn: 1,
    inside: () => { ell(ctx, -23, -43, 12, 7.5, -0.15); ctx.fillStyle = P.belly; ctx.fill(); },
  });
  // crête punk balayée vers l'avant (flammes en Infernal)
  const sw = a.s * 1.4;
  if (V === 3) {
    flame(ctx, -21, -60, 7, a.ph, -0.35); flame(ctx, -11, -65, 9, a.ph + 1.5, -0.25); flame(ctx, 0, -66, 8, a.ph + 3, -0.15);
  } else {
    const hair = PL([[-23, -57], [-35 + sw, -70], [-21, -66], [-27 + sw, -85], [-12, -71], [-13 + sw, -93], [-2, -72], [3 + sw, -86], [7, -67], [3, -62], [-8, -64], [-18, -60]]);
    fig(ctx, hair, P.hair, { lw: 2.8, size: 14, cx: -12, cy: -72 });
  }
  // yeux (malins) + sourcils
  const blink = a.f === 3;
  eye(ctx, -17.5, -51.5, 5.8, { ry: 7, skin: P.fur, inner: 1, anger: 0.4, lid: 0.22, iris: P.iris, blink });
  eye(ctx, -3.5, -52.5, 7, { ry: 8.4, skin: P.fur, inner: -1, anger: 0.18, lid: 0.3, iris: P.iris, blink });
  brow(ctx, -25, -61, -13, -58, 4.4);
  brow(ctx, 6, -64.5, -8, -62.5, 4.6);
  // museau
  blob(ctx, -32, -50.5, 4.5, P.nose, { ry: 4, rim: false, lw: 2.4 });
  for (const [x, w] of [[-28, 3.6], [-24.2, 3.6]]) { rr(ctx, x - w / 2, -44.5, w, 6, 1.2); paint(ctx, V === 1 && x > -26 ? P.gold : WHITE, 1.8); }
  ctx.beginPath(); ctx.moveTo(-30, -44.2); ctx.quadraticCurveTo(-20, -40, -12, -42); ctx.quadraticCurveTo(-10, -43, -9.5, -45.5); stroke(ctx, 2.6);
  fang(ctx, -14, -41.6, 4, 3.2);
  blush(ctx, -8, -43.5, 4, 2.4);
  ctx.beginPath(); ctx.moveTo(-27, -47); ctx.lineTo(-37, -49.5); ctx.moveTo(-27, -45.4); ctx.lineTo(-36.5, -44.2); stroke(ctx, 1.8);
  if (V === 2) drip(ctx, -11, -40, 7, a.ph);
  ctx.restore();
  motes(ctx, a, 1, -30, -80, 60, 70);
}

// =====================================================================
//  2. Bouledogue — videur : débardeur noir, grosse chaîne en or, gros poings, bracelets cloutés
// =====================================================================
const DOG = {
  rim: '#ff9a3a',
  fur: ['#d68f4c', 'b'], light: ['#f7dfb6', 'b'], ear: ['#6a3a22', 'b'], nose: ['#2e1d2a', 'k'],
  top: ['#2f2840', 'c'], pants: ['#4a5290', 'c'], band: ['#2a2238', 'c'],
  chain: ['#ffc83a', 'm'], stud: ['#d9def0', 'm'], iris: ['#5a3020', 'e'], mouth: ['#7a1f3a', 'k'],
};
function drawDog(ctx, a, P) {
  const st = a.step;
  const paw = (x, y, c) => fig(ctx, B([[x - 11, y], [x - 11, y - 6], [x - 4, y - 10], [x + 6, y - 9], [x + 8, y - 2], [x + 4, y + 0.4]]), c, { rim: false, glint: false });
  const bx = 12 - st * 3.5, by = a.lift === -1 ? -4 : 0;
  const fx = -12 + st * 3.5, fy = a.lift === 1 ? -4 : 0;
  limb(ctx, [[9, -18], [bx, by - 5]], 12, 11, shade(P.pants, -0.2));
  paw(bx, by, shade(P.light, -0.15));
  limb(ctx, [[-8, -18], [fx, fy - 5]], 12, 11, P.pants);
  paw(fx, fy, P.light);
  // poing : boule + jointures (+ poing américain doré en Élite)
  const fist = (x, y, r, c, front) => {
    blob(ctx, x, y, r, c, { rim: front ? undefined : false, inside: () => { ctx.beginPath(); for (const dy of [-0.3, 0.15]) { ctx.moveTo(x - r * 0.95, y + dy * r); ctx.lineTo(x - r * 0.35, y + dy * r + 0.5); } stroke(ctx, 1.8); } });
    if (V === 1 && front) { fig(ctx, RR(x - r - 2.5, y - r * 0.85, 5, r * 1.7, 2.4), P.gold, { rim: false, lw: 2.2 }); }
  };
  const band = (x, y, rot) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    fig(ctx, RR(-8, -3.8, 16, 7.6, 2.5), P.band, { rim: false, lw: 2.4, glint: false });
    for (const xx of [-4.5, 0, 4.5]) spike(ctx, xx, -3.6, -Math.PI / 2, 4.6, 3.6, P.stud, 1.6);
    ctx.restore();
  };

  ctx.save();
  ctx.translate(0, -a.up * 1.3);
  ctx.rotate(st * 0.025);
  squash(ctx, a);
  // bras arrière
  const sb = a.step * 2;
  limb(ctx, [[20, -52], [29, -40], [27 - sb, -27]], 13, 11, shade(P.fur, -0.12));
  band(27 - sb, -29, 0.1);
  fist(27 - sb, -21, 7.5, shade(P.light, -0.12), false);
  // torse en V + débardeur
  const body = B([[-27, -50], [-16, -60], [14, -61], [27, -52], [24, -32], [17, -13], [0, -9], [-17, -13], [-24, -32]]);
  fig(ctx, body, P.fur, {
    crack: 3, cn: 2,
    inside: () => {
      fig(ctx, B([[-17, -57], [-10, -59], [-5, -47], [6, -47], [11, -60], [18, -57], [23, -32], [19, -4], [-19, -4], [-23, -32]], 0.35), P.top, { rim: false, lw: 2.6 });
    },
  });
  // chaîne en or + médaillon os
  const ch = [[-13, -56], [-7, -46], [0, -42], [7, -46], [12, -56]];
  for (let i = 0; i <= 9; i++) {
    const p = along(ch, i / 9);
    fig(ctx, E(p.x, p.y, 3.2, 2.4, Math.atan2(p.ty, p.tx) + (i % 2) * 0.9), P.chain, { rim: false, lw: 1.8, glint: false, hi: 0.3 });
  }
  ctx.save(); ctx.translate(0, -36 + a.s * 0.8); ctx.rotate(a.s * 0.12);
  fig(ctx, B([[-8, -3.4], [-4, -2.2], [4, -2.2], [8, -3.4], [10, 0], [8, 3.4], [4, 2.2], [-4, 2.2], [-8, 3.4], [-10, 0]], 0.6), P.chain, { rim: false, lw: 2.2, hi: 0.35 });
  ctx.restore();
  if (V === 1) pauldron(ctx, 20, -55, 9, 0.45);
  // bras avant
  limb(ctx, [[-21, -53], [-31, -40], [-29 + sb, -27]], 14, 12, P.fur, { crack: 4, cn: 1 });
  band(-29 + sb, -29, -0.1);
  fist(-29 + sb, -20, 8.5, P.light, true);
  if (V === 1) pauldron(ctx, -22, -54, 10, -0.45);
  ctx.restore();

  // ----- tête (face de 3/4, bajoues et mâchoire prognathe)
  ctx.save();
  ctx.translate(0, -a.up * 2.4);
  ctx.rotate(st * 0.03);
  squash(ctx, a, 0.5);
  const head = B([[-45, -77], [-42, -91], [-25, -98], [0, -99], [19, -95], [27, -81], [23, -66], [6, -59], [-18, -58], [-39, -63]]);
  fig(ctx, head, P.fur, {
    crack: 5, cn: 2,
    inside: () => {
      ctx.beginPath(); ctx.moveTo(-26, -95); ctx.quadraticCurveTo(-17, -98, -7, -95); ctx.moveTo(-23, -91); ctx.quadraticCurveTo(-16, -93, -9, -91);
      ctx.moveTo(-23, -79); ctx.quadraticCurveTo(-21, -75, -22, -72); ctx.moveTo(-17, -79); ctx.quadraticCurveTo(-18, -75, -16, -72);
      stroke(ctx, 2.2, rgba(OUT, 0.45));
    },
  });
  // oreilles « en rose » repliées vers l'extérieur
  const earF = (pts, c) => fig(ctx, B(pts, 0.4), c, { glint: false, rim: false, lw: 2.6 });
  earF([[-30, -97], [-42, -101], [-51, -93], [-47, -86], [-40, -90]], P.ear);
  earF([[10, -98], [22, -102], [31, -94], [29, -87], [21, -92]], shade(P.ear, -0.1));
  // yeux + gros sourcils froncés
  eye(ctx, -29, -80, 5.6, { ry: 6.4, skin: P.fur, inner: 1, anger: 0.6, lid: 0.18, iris: P.iris });
  eye(ctx, -11, -81, 6.6, { ry: 7.4, skin: P.fur, inner: -1, anger: 0.6, lid: 0.18, iris: P.iris });
  brow(ctx, -37, -89, -22, -84, 6.2);
  brow(ctx, -1, -91, -17, -85.5, 6.6);
  // mâchoire inférieure (devant) + bajoues
  const jaw = B([[-42, -60], [-27, -58.5], [-11, -58.5], [0, -61], [-3, -51], [-20, -45.5], [-37, -49]]);
  fig(ctx, jaw, P.light, { rim: undefined, lw: 2.8, glint: false, inside: () => { ctx.fillStyle = P.mouth; ctx.fillRect(-45, -66, 50, 9); } });
  for (let i = 0; i < 6; i++) { rr(ctx, -35 + i * 5.4, -58.4, 4.4, 3.8, 1); paint(ctx, WHITE, 1.4); }
  const jowl = (x, y, rx, c) => fig(ctx, E(x, y, rx, 9), c, { rim: false, lw: 2.8, glint: false });
  jowl(-32, -66, 13, P.light);
  jowl(-10, -66, 11.5, shade(P.light, -0.06));
  fang(ctx, -40, -58, 8.5, 4.8, true); fang(ctx, -4, -58.5, 8, 4.6, true);
  blob(ctx, -21, -72.5, 8, P.nose, { ry: 5.4, rim: false, lw: 2.4 });
  if (V === 2) drip(ctx, -22, -47, 8, a.ph);
  if (V === 1) for (const x of [-20, -8, 4]) spike(ctx, x, -96 + Math.abs(x + 8) * 0.12, -Math.PI / 2 + (x + 8) * 0.03, 9, 6, P.gold);
  if (V === 3) { flame(ctx, -16, -97, 6.5, a.ph, -0.1); flame(ctx, 0, -98, 8, a.ph + 2); flame(ctx, 13, -94, 6, a.ph + 4, 0.1); }
  ctx.restore();
  motes(ctx, a, 2, -34, -100, 66, 84);
}

// =====================================================================
//  3. Aspi-Bot — robot aspirateur : visage LED furieux, crête-brosse, balai rotatif
// =====================================================================
const VAC = {
  rim: '#46e8ff',
  shell: ['#cfd3ee', 'b'], top: ['#5b4ab8', 'c'], bump: ['#2f2a4e', 'c'], wheel: ['#2a2540', 'k'],
  brush: ['#ff3d5a', 'a'], brush2: ['#ffb02e', 'a'], led: ['#ff2a48', 'e'], bulb: ['#ff2a48', 'g'],
  plate: ['#9aa0c8', 'm'],
};
function drawVacuum(ctx, a, P) {
  // poussière derrière
  ctx.save(); ctx.globalAlpha = 0.65;
  for (const [x, y, r] of [[46 + a.f * 2, -7, 5.5 - a.f * 0.6], [52 + a.f * 1.5, -13 + a.s, 3.5], [43, -14 - a.f, 2.6]]) { ell(ctx, x, y, r, r); paint(ctx, '#d8ccb8', 1.6); }
  ctx.restore();
  // roues
  for (const x of [-22, 24]) {
    blob(ctx, x, -6, 6.5, P.wheel, { rim: false });
    ctx.save(); ctx.translate(x, -6); ctx.rotate(-a.f * Math.PI / 4);
    ctx.fillStyle = '#9aa0bf'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-1, 0, 2, 4.4); }
    ell(ctx, 0, 0, 2.2, 2.2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, -[0, 2, 0, 1][a.f]);
  squash(ctx, a, 0.8);
  // antenne arrière
  limb(ctx, [[26, -38], [30, -48], [33 + a.s * 1.5, -55]], 3, 2.4, P.plate, { rim: false });
  glow(ctx, 33 + a.s * 1.5, -57, 10, P.bulb, a.f % 2 ? 0.9 : 0.5);
  blob(ctx, 33 + a.s * 1.5, -57, 4, P.bulb, { lw: 2.2, rim: false });
  // coque
  const shell = B([[-40, -14], [-39, -32], [-31, -42], [0, -45], [31, -42], [39, -32], [40, -14], [34, -7], [0, -6], [-34, -7]], 0.45);
  fig(ctx, shell, P.shell, {
    crack: 6, cn: 2,
    inside: () => {
      // pare-chocs
      ctx.fillStyle = P.bump; ctx.fillRect(-45, -15, 90, 12);
      ctx.beginPath(); ctx.moveTo(-45, -15); ctx.lineTo(45, -15); stroke(ctx, 2.4);
      if (V === 1) { ctx.fillStyle = P.gold; ctx.fillRect(-45, -15, 90, 4.5); ctx.beginPath(); ctx.moveTo(-45, -10.5); ctx.lineTo(45, -10.5); stroke(ctx, 1.8); }
      // plaque de capot
      ell(ctx, 2, -45, 30, 8); ctx.fillStyle = P.top; ctx.fill(); ell(ctx, 2, -45, 30, 8); stroke(ctx, 2.6);
      ell(ctx, -8, -47, 12, 2.5); fillA(ctx, '#ffffff', 0.35);
    },
  });
  // écran visage
  const scr = RR(-35, -38, 30, 22, 7);
  fig(ctx, scr, '#191230', {
    rim: false, lw: 2.8, glint: false, hi: 0.1,
    inside: () => {
      const L = P.led;
      glow(ctx, -20, -27, 22, L, 0.35);
      ctx.fillStyle = L;
      if (a.f === 3) {
        ctx.fillRect(-31, -31, 9, 2.6); ctx.fillRect(-18, -31, 9, 2.6);
      } else {
        poly(ctx, [[-32, -35.5], [-21.5, -31], [-21.5, -27.5], [-32, -29]]); ctx.fill();
        poly(ctx, [[-8.5, -35.5], [-18.5, -31], [-18.5, -27.5], [-8.5, -29]]); ctx.fill();
        ctx.fillStyle = mix(L, '#ffffff', 0.7);
        poly(ctx, [[-30, -32.5], [-23.5, -30.2], [-23.5, -29.2], [-30, -30.6]]); ctx.fill();
        poly(ctx, [[-10.5, -32.5], [-16.5, -30.2], [-16.5, -29.2], [-10.5, -30.6]]); ctx.fill();
      }
      ctx.beginPath();
      const z = a.f % 2 ? 1 : 0;
      for (let i = 0; i <= 8; i++) ctx.lineTo(-30 + i * 2.6, -21 - ((i + z) % 2) * 3.2);
      stroke(ctx, 2, L);
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let y = -37; y < -16; y += 2.2) ctx.fillRect(-36, y, 32, 0.9);
    },
  });
  // autocollant du gang
  gangBadge(ctx, 20, -27, 6, '#fff3d6', '#3a2c4c');
  if (V === 1) for (const x of [-34, -24, 24, 34]) spike(ctx, x, -9, Math.PI / 2 + (x < 0 ? 0.5 : -0.5), 7, 4.6, P.gold);
  // crête-brosse (flammes en Infernal)
  fig(ctx, RR(-14, -54, 26, 8, 3), P.bump, { rim: false, lw: 2.6, glint: false });
  if (V === 3) {
    flame(ctx, -9, -53, 7, a.ph, -0.2); flame(ctx, 0, -54, 9, a.ph + 2, -0.1); flame(ctx, 9, -53, 7, a.ph + 4);
  } else {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = -12 + t * 22, h = 13 + Math.sin(t * Math.PI) * 8;
      const sway = Math.sin(a.ph + t * 2.5) * 2.2;
      limb(ctx, [[x, -52], [x - 2 + sway * 0.5, -52 - h * 0.6], [x - 4 + sway, -52 - h]], 5, 2.6, i % 2 ? P.brush2 : P.brush, { lw: 2.2, rim: false });
    }
  }
  if (V === 2) { drip(ctx, -20, -5, 6, a.ph); drip(ctx, 14, -5, 8, a.ph + 2); }
  ctx.restore();
  // balai rotatif avant
  ctx.save(); ctx.translate(-40, -6); ctx.rotate(a.f * Math.PI / 6);
  for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); limb(ctx, [[0, 0], [0, -6], [1.5, -11]], 3.4, 2, P.brush2, { lw: 2, rim: false }); }
  blob(ctx, 0, 0, 3.4, P.plate, { lw: 2, rim: false });
  ctx.restore();
  motes(ctx, a, 3, -36, -60, 72, 50);
}

// =====================================================================
//  4. Concombre maléfique — ninja : bandeau à plaque, katana dans le dos, shuriken
// =====================================================================
const CUC = {
  rim: '#c6ff4a',
  skin: ['#3dbb4c', 'b'], dark: ['#1f7a33', 'b'], belly: ['#b8f07a', 'b'],
  band: ['#ff2f4a', 'a'], belt: ['#2a2440', 'c'], plate: ['#d9def0', 'm'], hilt: ['#3a2c4c', 'c'], guard: ['#ffc83a', 'm'],
  iris: ['#c0261f', 'e'],
};
function drawCucumber(ctx, a, P) {
  const st = a.step;
  // pieds
  for (const [x, dx, c] of [[8, -st * 3.5, shade(P.dark, -0.15)], [-7, st * 3.5, P.dark]]) {
    const lift = (x > 0 && a.lift === -1) || (x < 0 && a.lift === 1) ? -3.5 : 0;
    limb(ctx, [[x, -12], [x + dx, -5 + lift]], 6, 5.5, c);
    fig(ctx, B([[x + dx - 8, lift], [x + dx - 7, lift - 5], [x + dx, lift - 7], [x + dx + 5, lift - 4], [x + dx + 4, lift + 0.3]]), P.belt, { rim: false, glint: false });
  }
  ctx.save();
  ctx.translate(0, -a.up * 1.5);
  squash(ctx, a, 1.2);
  // katana dans le dos
  ctx.save(); ctx.translate(15, -68); ctx.rotate(0.55);
  fig(ctx, RR(-2.6, -30, 5.2, 24, 2), P.hilt, { rim: false, lw: 2.4, glint: false, inside: () => { ctx.strokeStyle = shade(P.plate, -0.2); ctx.lineWidth = 1.4; for (let y = -28; y < -8; y += 4) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(3, y + 3); ctx.moveTo(3, y); ctx.lineTo(-3, y + 3); ctx.stroke(); } } });
  fig(ctx, RR(-6.5, -7, 13, 4.2, 2), P.guard, { rim: false, lw: 2.2, glint: false });
  ctx.restore();
  // bras arrière
  limb(ctx, [[14, -44], [23, -38], [25, -30 + a.s]], 6, 5, shade(P.skin, -0.12));
  blob(ctx, 25, -29 + a.s, 4.4, shade(P.skin, -0.1), { rim: false });
  // corps
  const body = B([[-6, -101], [8, -97], [17, -80], [20, -55], [19, -28], [13, -10], [0, -6], [-12, -9], [-18, -26], [-20, -55], [-18, -82], [-14, -96]]);
  fig(ctx, body, P.skin, {
    crack: 7, cn: 3,
    inside: () => {
      ctx.strokeStyle = rgba(P.belly, 0.35); ctx.lineWidth = 3.4;
      for (const x of [-9, 1, 11]) { ctx.beginPath(); ctx.moveTo(x - 1, -100); ctx.quadraticCurveTo(x + 2, -50, x * 0.8, -6); ctx.stroke(); }
      const rnd = seeded(7);
      for (let i = 0; i < 18; i++) {
        const x = -17 + rnd() * 34, y = -96 + rnd() * 86;
        if (y > -76 && y < -42 && x < 14) continue;
        ell(ctx, x, y, 2, 1.7); ctx.fillStyle = P.dark; ctx.fill();
        ell(ctx, x - 0.5, y - 0.6, 0.9, 0.7); ctx.fillStyle = rgba('#e8ffc0', 0.8); ctx.fill();
      }
      // ceinture (obi)
      fig(ctx, RR(-24, -30, 50, 8, 1), P.belt, { rim: false, lw: 2.4, glint: false });
      // bandeau
      fig(ctx, RR(-24, -86, 50, 8, 1), P.band, { rim: false, lw: 2.4, glint: false });
    },
  });
  // nœud + pans du bandeau (flammes en Infernal)
  if (V === 3) { flame(ctx, 21, -80, 7, a.ph, 0.6); flame(ctx, 26, -76, 5.5, a.ph + 2, 0.7); }
  else {
    const w = a.ph;
    limb(ctx, [[17, -82], [27, -84 + Math.sin(w) * 3], [37, -80 + Math.sin(w + 1.4) * 4], [45, -84 + Math.sin(w + 2.6) * 4]], 5, 3.4, P.band, { lw: 2.4 });
    limb(ctx, [[17, -81], [25, -76 + Math.sin(w + 0.8) * 2], [33, -70 + Math.sin(w + 2) * 3], [39, -72 + Math.sin(w + 3) * 3]], 4.6, 3, shade(P.band, -0.15), { lw: 2.4 });
  }
  blob(ctx, 17, -82, 4, P.band, { lw: 2.4, rim: false });
  // plaque frontale
  fig(ctx, RR(-19, -88, 15, 11, 2.5), P.plate, { rim: false, lw: 2.4, hi: 0.3, inside: () => { ctx.beginPath(); ctx.moveTo(-16, -80); ctx.lineTo(-8, -86); stroke(ctx, 1.6, rgba(OUT, 0.7)); } });
  // visage
  const blink = a.f === 3;
  eye(ctx, -11, -67, 6.4, { ry: 7.6, skin: P.skin, inner: 1, anger: 0.62, lid: 0.12, iris: P.iris, blink });
  eye(ctx, 5, -68, 7.6, { ry: 9, skin: P.skin, inner: -1, anger: 0.62, lid: 0.12, iris: P.iris, blink });
  brow(ctx, -20, -76.5, -6, -71.5, 5, OUT);
  brow(ctx, 15, -78, -1, -73, 5.4, OUT);
  const mouth = B([[-17, -52], [-6, -49.5], [7, -50.5], [14, -54], [11, -45], [0, -40], [-11, -43]]);
  fig(ctx, mouth, '#6e1730', {
    rim: false, lw: 2.6, glint: false, hi: 0,
    inside: () => {
      ell(ctx, 0, -39, 8, 4.5); ctx.fillStyle = '#ff6d8a'; ctx.fill();
      ctx.fillStyle = WHITE;
      for (let i = 0; i < 5; i++) { const x = -15 + i * 6; poly(ctx, [[x, -54], [x + 5, -54], [x + 2.5, -47.5 + (i % 2)]]); ctx.fill(); }
    },
  });
  fang(ctx, -12, -45, 4, 3.4, true);
  if (V === 2) drip(ctx, 4, -42, 8, a.ph);
  if (V === 1) { pauldron(ctx, 14, -46, 7.5, 0.4); for (const x of [-8, 1, 10]) spike(ctx, x, -96 + Math.abs(x - 1) * 0.25, -Math.PI / 2 + (x - 1) * 0.04, 8, 5, P.gold); }
  // bras avant + shuriken
  const hx = -30, hy = -40 + st * 1.5;
  ctx.save(); ctx.translate(hx - 4, hy - 4); ctx.rotate(a.f * Math.PI / 8);
  const sh = [];
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 10; const t = i * Math.PI / 4; sh.push([Math.cos(t) * r, Math.sin(t) * r]); }
  fig(ctx, PL(sh), P.plate, { rim: false, lw: 2.2, hi: 0.3, size: 9, inside: () => { ell(ctx, 0, 0, 2, 2); ctx.fillStyle = OUT; ctx.fill(); } });
  ctx.restore();
  limb(ctx, [[-16, -44], [-23, -40], [hx + 1, hy + 0.5]], 6, 5, P.skin);
  blob(ctx, hx, hy, 4.6, P.skin, { rim: false });
  ctx.restore();
  motes(ctx, a, 4, -26, -108, 52, 100);
}

// =====================================================================
//  5. Pigeon pirate — tricorne, cache-œil, jambe de bois, sabre d'abordage
// =====================================================================
const PIG = {
  rim: '#3fe0c0',
  gray: ['#a2abcb', 'b'], wing: ['#7c85aa', 'b'], belly: ['#dfe3f4', 'b'], neck: ['#3fd0a6', 'a'], neck2: ['#a46ce6', 'a'],
  beak: ['#f2a65a', 'd'], foot: ['#ff7f86', 'd'], peg: ['#9a6238', 'k'], hat: ['#2e2440', 'c'], trim: ['#ffc83a', 'm'],
  blade: ['#dfe6f7', 'm'], plume: ['#ff3d5a', 'a'], patch: ['#2a1c30', 'k'], iris: ['#ff8a1f', 'e'],
};
function drawPigeon(ctx, a, P) {
  const st = a.step;
  // jambe de bois (arrière) et patte (avant)
  const bx = 8 - st * 3.5, by = a.lift === -1 ? -3.5 : 0;
  limb(ctx, [[7, -16], [bx, by - 1]], 5.5, 4.2, P.peg, { rim: false });
  blob(ctx, bx, by - 1, 2.6, shade(P.peg, -0.2), { rim: false, lw: 2 });
  const fx = -6 + st * 3.5, fy = a.lift === 1 ? -3.5 : 0;
  limb(ctx, [[-5, -16], [fx, fy - 3]], 3.6, 3.4, P.foot, { rim: false });
  for (const d of [-0.5, 0, 0.6]) limb(ctx, [[fx, fy - 2], [fx - 6 * Math.cos(d), fy - 0.6 + Math.sin(d) * 0.5]], 3, 2.4, P.foot, { rim: false, lw: 2 });
  ctx.save();
  ctx.translate(0, -a.up * 1.5);
  squash(ctx, a);
  // queue
  for (const [dy, c] of [[-4, shade(P.wing, -0.15)], [2, P.wing], [7, shade(P.wing, -0.1)]]) {
    fig(ctx, B([[16, -27 + dy * 0.3], [34, -26 + dy], [42, -22 + dy * 1.2], [37, -17 + dy], [16, -19 + dy * 0.3]]), c, { rim: false, glint: false, lw: 2.6 });
  }
  // corps dodu
  const body = B([[-21, -39], [-15, -21], [0, -12], [16, -14], [27, -25], [24, -40], [10, -48], [-8, -50]]);
  fig(ctx, body, P.gray, { crack: 8, cn: 2, inside: () => { ell(ctx, -10, -24, 11, 11); ctx.fillStyle = P.belly; ctx.fill(); } });
  // aile (porte le sabre)
  const sa = -0.85 + a.s * 0.12;
  ctx.save(); ctx.translate(-17, -32); ctx.rotate(sa);
  fig(ctx, B([[-3, 4], [3, 4], [3.5, -8], [6, -20], [4, -30], [0, -33], [-1, -22], [-3, -8]], 0.4), P.blade, { rim: false, lw: 2.4, hi: 0.35, size: 10 });
  fig(ctx, RR(-6.5, 2, 13, 4.2, 2), P.trim, { rim: false, lw: 2.2, glint: false });
  fig(ctx, RR(-2.2, 6, 4.4, 8, 2), P.peg, { rim: false, lw: 2, glint: false });
  ctx.restore();
  const wing = B([[-6, -40], [10, -44], [24, -36], [27, -24], [12, -22], [-4, -26], [-15, -30]]);
  fig(ctx, wing, P.wing, {
    inside: () => { ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; for (const x of [12, 19]) { ctx.beginPath(); ctx.moveTo(x - 3, -40); ctx.quadraticCurveTo(x + 2, -31, x - 1, -22); ctx.stroke(); } },
  });
  ell(ctx, -16, -31, 4.4, 4.4); paint(ctx, P.wing, 2.4);
  if (V === 1) pauldron(ctx, 6, -42, 7.5, 0.1);
  ctx.restore();
  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 2.4 + [0, 0, 1, 0][a.f]);
  squash(ctx, a, 0.5);
  // cou irisé
  fig(ctx, B([[-22, -48], [-14, -58], [2, -56], [6, -44], [-6, -36], [-19, -38]]), P.neck, { rim: false, glint: false, inside: () => { ctx.fillStyle = P.neck2; ell(ctx, 0, -42, 9, 6); ctx.fill(); } });
  const head = E(-8, -61, 19, 17.5);
  fig(ctx, head, P.gray, { crack: 9, cn: 1 });
  // bec
  const beak = B([[-25, -63], [-34, -61], [-41, -56], [-36, -53], [-25, -54]]);
  fig(ctx, beak, P.beak, { rim: false, lw: 2.4, glint: false });
  ctx.beginPath(); ctx.moveTo(-39, -56.5); ctx.lineTo(-27, -57.5); stroke(ctx, 1.8);
  blob(ctx, -27, -62, 3.6, '#f6f3ff', { ry: 2.6, rim: false, lw: 1.8 });
  // œil visible + cache-œil
  const blink = a.f === 3;
  eye(ctx, -5, -61, 7.4, { ry: 8.8, skin: P.gray, inner: -1, anger: 0.55, lid: 0.15, iris: P.iris, blink });
  brow(ctx, 5, -73, -9, -69.5, 5);
  ctx.beginPath(); ctx.moveTo(-24, -67); ctx.quadraticCurveTo(-12, -74, 9, -66); stroke(ctx, 2.6);
  fig(ctx, B([[-25, -67], [-15, -68], [-14, -59], [-18, -55], [-24, -57]]), P.patch, { rim: false, lw: 2.4, hi: 0.25, size: 6 });
  brow(ctx, -27, -72, -15, -70.5, 4.4);
  fang(ctx, -31, -54, 3.6, 3, false);
  // tricorne
  ctx.save(); ctx.translate(-7, -76); ctx.rotate(-0.12 + a.s * 0.03);
  if (V === 3) { flame(ctx, 12, -8, 7, a.ph, 0.3); } else {
    limb(ctx, [[8, -9], [17, -16], [25, -15 + a.s * 2]], 6.5, 3, P.plume, { lw: 2.4 });
  }
  const hat = B([[-20, -1], [-14, -6], [-7, -15], [6, -15], [14, -6], [20, -1], [11, 2.5], [0, -1], [-11, 2.5]]);
  fig(ctx, hat, P.hat, {
    lw: 2.6, size: 14,
    inside: () => { ctx.beginPath(); ctx.moveTo(-20, -1); ctx.quadraticCurveTo(-11, -4, 0, -2); ctx.quadraticCurveTo(11, -4, 20, -1); stroke(ctx, 4.6, P.trim); },
  });
  ell(ctx, 0, -8.5, 3.4, 3); ctx.fillStyle = '#ffffff'; ctx.fill();
  rr(ctx, -2, -6.5, 4, 2.6, 0.8); ctx.fill();
  ctx.fillStyle = OUT; ell(ctx, -1.2, -8.7, 0.95, 0.95); ctx.fill(); ell(ctx, 1.2, -8.7, 0.95, 0.95); ctx.fill();
  ctx.restore();
  if (V === 2) drip(ctx, -34, -53, 6, a.ph);
  ctx.restore();
  motes(ctx, a, 5, -34, -92, 70, 80);
}

// =====================================================================
//  6. Crabe pinceur — docker bagarreur : pince géante tatouée, bonnet de marin
// =====================================================================
const CRAB = {
  rim: '#5ad8ff',
  red: ['#f0503c', 'b'], redD: ['#b8282c', 'b'], belly: ['#ffd2a8', 'b'], cap: ['#f6f4ff', 'c'], capBand: ['#2f4ab0', 'c'],
  tattoo: ['#2f4ab0', 'k'], iris: ['#3d2a66', 'e'],
};
// Pince classique de dessin animé (pointe vers le haut en repère local) : paume + doigt fixe, doigt mobile.
function bigClaw(ctx, x, y, s, rot, open, col, tattoo) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const lw = 3 / s;
  ctx.save(); ctx.translate(6, -6); ctx.rotate(open); ctx.translate(-6, 6);
  fig(ctx, B([[1, -5], [5, -17], [7, -27], [13, -25], [14, -13], [10, -3]], 0.5), shade(col, -0.1), { glint: false, lw });
  ctx.restore();
  const palm = B([[11, 8], [-3, 11], [-12, 3], [-13, -9], [-14, -22], [-9, -32], [-3, -27], [-5, -17], [0, -9], [8, -9], [13, -2]], 0.5);
  fig(ctx, palm, col, {
    lw, crack: 10, cn: 1, size: 13, cx: -2, cy: -6,
    inside: () => {
      if (!tattoo) return;
      ctx.save(); ctx.translate(0, 0); ctx.strokeStyle = tattoo; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.moveTo(-3.2, -2.4); ctx.lineTo(3.2, -2.4); ctx.moveTo(-4.4, 1.6); ctx.quadraticCurveTo(0, 7, 4.4, 1.6); ctx.stroke();
      ell(ctx, 0, -6.8, 1.7, 1.7); ctx.stroke();
      ctx.restore();
    },
  });
  ctx.restore();
}
function drawCrab(ctx, a, P) {
  const s = a.step;
  // pattes
  for (const side of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const up = ((i + (side > 0 ? 1 : 0)) % 2 ? s : -s) * 2;
      const x0 = side * (14 + i * 6), y0 = -16 + i * 2;
      const kx = side * (28 + i * 6), ky = -24 + i * 3 - up;
      const tx = side * (32 + i * 7), ty = -1 - Math.max(0, up);
      limb(ctx, [[x0, y0], [kx, ky], [tx, ty]], 6.4, 2.6, side > 0 ? P.redD : shade(P.red, -0.05), { lw: 2.6, rim: side > 0 ? false : undefined });
    }
  }
  ctx.save();
  ctx.translate(0, -[0, 2, 0, 2][a.f]);
  squash(ctx, a);
  // petite pince (arrière)
  limb(ctx, [[22, -26], [32, -30], [37, -38]], 6, 5, P.redD);
  bigClaw(ctx, 38, -40, 0.5, 0.35, a.f % 2 ? 0.4 : 0.05, P.redD, null);
  // yeux pédonculés
  const blink = a.f === 3;
  for (const [x, r, inner, h] of [[-15, 6.6, 1, 0], [3, 7.4, -1, 2]]) {
    limb(ctx, [[x + 2, -38], [x + 1, -46 - h], [x, -50 - h]], 4.6, 4, P.red, { rim: false });
  }
  // carapace
  const shell = B([[-34, -22], [-30, -35], [-18, -43], [0, -45], [18, -43], [30, -35], [34, -22], [27, -12], [0, -9], [-27, -12]]);
  fig(ctx, shell, P.red, {
    crack: 11,
    inside: () => {
      ell(ctx, 0, -11, 30, 6.5); ctx.fillStyle = P.belly; ctx.fill();
      const rnd = seeded(3);
      for (let i = 0; i < 6; i++) { ell(ctx, 4 + rnd() * 24, -38 + rnd() * 10, 1.8 + rnd(), 1.4 + rnd()); fillA(ctx, '#ffb69a', 0.75); }
    },
  });
  for (const x of [-33, 33]) spike(ctx, x, -28, x < 0 ? Math.PI + 0.3 : -0.3, 6, 4.5, V === 1 ? P.gold : P.red);
  if (V === 1) for (const x of [-12, 0, 12]) spike(ctx, x * 1.4 + 12, -42 + Math.abs(x) * 0.1, -Math.PI / 2 + x * 0.03, 7, 5, P.gold);
  // bonnet de marin
  ctx.save(); ctx.translate(20, -43); ctx.rotate(0.3);
  fig(ctx, B([[-10, 0], [-9, -10], [0, -14], [9, -10], [10, 0]]), P.cap, { rim: false, lw: 2.6, size: 9 });
  fig(ctx, RR(-12.5, -3.5, 25, 6.5, 3), P.capBand, { rim: false, lw: 2.4, glint: false });
  ctx.restore();
  // yeux
  eye(ctx, -15, -55, 6.6, { ry: 7.6, skin: P.red, inner: 1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  eye(ctx, 3, -57, 7.4, { ry: 8.6, skin: P.red, inner: -1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  brow(ctx, -24, -64, -10, -61, 4.6);
  brow(ctx, 13, -68, -2, -64, 5);
  // bouche grognon
  const m = B([[-14, -25], [-5, -28], [5, -28], [11, -25], [5, -20], [-7, -20]]);
  fig(ctx, m, '#6e1730', { rim: false, lw: 2.4, glint: false, hi: 0 });
  fang(ctx, -10, -27.5, 4.5, 3.6); fang(ctx, 7, -27.5, 4.5, 3.6);
  blush(ctx, -22, -26, 4, 2.4); blush(ctx, 18, -26, 4, 2.4);
  if (V === 2) { drip(ctx, -2, -21, 7, a.ph); }
  // pince géante levée (avant)
  limb(ctx, [[-24, -28], [-35, -32], [-41, -42]], 9, 8, P.red);
  bigClaw(ctx, -42, -47, 1.05, -0.3 + a.s * 0.06, a.f % 2 ? 0.5 : 0.04, P.red, P.tattoo);
  ctx.restore();
  motes(ctx, a, 6, -50, -76, 100, 60);
}

// =====================================================================
//  7. Frelon — as de l'aviation : casque de cuir, lunettes, écharpe au vent, dard
// =====================================================================
const WASP = {
  rim: '#ffb02e',
  yel: ['#ffc81f', 'b'], blk: ['#33233f', 'k'], thorax: ['#6a4430', 'b'], leg: ['#4a3040', 'b'],
  cap: ['#8a5434', 'c'], scarf: ['#ff3d4a', 'a'], lens: ['#7fe8ff', 'g'], rimG: ['#d9def0', 'm'],
  wing: ['#d8f4ff', 'k'], iris: ['#d1213a', 'e'], sting: ['#e8e4f4', 'm'],
};
function drawWasp(ctx, a, P) {
  ctx.save();
  ctx.translate(0, a.hov);
  const flap = a.f % 2;
  const wingC = rgba(P.wing, 0.6);
  const wingSet = (front) => {
    const ang = flap ? -0.5 : 0.22;
    for (const [rx, ry, rot] of front ? [[17, 7, -1.3]] : [[23, 9.5, -0.7], [27, 11, -1.1]]) {
      ctx.save(); ctx.translate(12, -92); ctx.rotate(ang + (front ? 0.15 : 0));
      const cx = Math.cos(rot) * rx * 0.95, cy = Math.sin(rot) * rx * 0.95;
      ell(ctx, cx, cy, rx, ry, rot); paint(ctx, wingC, 2.6);
      ell(ctx, cx - 3, cy - 2, rx * 0.5, ry * 0.3, rot); fillA(ctx, '#ffffff', 0.65);
      ctx.restore();
    }
  };
  wingSet(false);
  // dard + abdomen rayé
  fig(ctx, B([[44, -62], [50, -64], [53, -55], [57, -46], [50, -53]], 0.4), P.sting, { rim: false, lw: 2.4, glint: false });
  const abd = B([[16, -84], [30, -89], [44, -81], [51, -66], [45, -57], [30, -60], [18, -70]]);
  fig(ctx, abd, P.yel, {
    crack: 12, cn: 2,
    inside: () => {
      ctx.fillStyle = P.blk;
      for (const t of [0.3, 0.58, 0.85]) {
        const cx = 16 + t * 36, cy = -86 + t * 26;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.65); rr(ctx, -30, -3.8, 60, 7.6, 2); ctx.fill(); ctx.restore();
      }
    },
  });
  if (V === 1) for (const t of [0.2, 0.5, 0.8]) { const p = along([[18, -84], [32, -89], [46, -79]], t); spike(ctx, p.x, p.y - 1, -Math.PI / 2 + 0.35, 8, 5, P.gold); }
  // pattes pendantes
  for (const [x, dx] of [[4, -3], [12, 1]]) {
    limb(ctx, [[x, -76], [x + dx - 2, -66], [x + dx + 1 + a.s * 1.5, -59]], 4.6, 3.6, P.leg, { lw: 2.4, rim: false });
    blob(ctx, x + dx + a.s * 1.5, -58, 3, P.blk, { lw: 2, rim: false, glint: false });
  }
  // thorax
  fig(ctx, E(10, -82, 12, 11), P.thorax, { inside: () => { ell(ctx, 7, -86, 6, 3.6); fillA(ctx, P.yel, 0.5); } });
  // écharpe (au vent)
  const w = a.ph;
  limb(ctx, [[2, -80], [18, -82 + Math.sin(w) * 2], [33, -88 + Math.sin(w + 1.2) * 4], [47, -90 + Math.sin(w + 2.4) * 5]], 8.5, 5, shade(P.scarf, -0.12), { lw: 2.6 });
  // tête
  const head = E(-14, -92, 21, 19.5);
  fig(ctx, head, P.yel, { crack: 13, cn: 1, inside: () => { ell(ctx, -18, -76, 16, 6); ctx.fillStyle = shade(P.yel, 0.25); ctx.fill(); } });
  // casque d'aviateur
  const cap = B([[-35, -97], [-31, -108], [-17, -114], [0, -111], [7, -97], [6, -82], [-1, -80], [-3, -93], [-14, -100], [-28, -100]]);
  fig(ctx, cap, P.cap, { lw: 2.8, size: 15, inside: () => { ctx.beginPath(); ctx.moveTo(-17, -114); ctx.quadraticCurveTo(-8, -104, 2, -96); stroke(ctx, 2, rgba(OUT, 0.5)); } });
  // antennes à travers le casque
  limb(ctx, [[-24, -110], [-30, -119], [-38, -122 + a.s]], 3.6, 2.8, P.blk, { rim: false, lw: 2 });
  limb(ctx, [[-10, -112], [-11, -122], [-16, -128 + a.s]], 3.6, 2.8, P.blk, { rim: false, lw: 2 });
  blob(ctx, -38.5, -122 + a.s, 3.2, P.yel, { lw: 2, rim: false }); blob(ctx, -16.5, -128 + a.s, 3.2, P.yel, { lw: 2, rim: false });
  // lunettes relevées sur le front
  ctx.beginPath(); ctx.moveTo(-33, -103); ctx.lineTo(4, -106); stroke(ctx, 4.4, P.blk);
  for (const [x, y, r] of [[-27, -104, 6.2], [-11, -106, 6.8]]) {
    blob(ctx, x, y, r, P.rimG, { lw: 2.4, rim: false, glint: false });
    blob(ctx, x, y, r * 0.64, P.lens, { lw: 1.8, rim: false, hi: 0.4 });
  }
  // yeux
  const blink = a.f === 3;
  eye(ctx, -26, -89, 6.6, { ry: 7.8, skin: P.yel, inner: 1, anger: 0.62, lid: 0.12, iris: P.iris, blink });
  eye(ctx, -9, -90, 8, { ry: 9.2, skin: P.yel, inner: -1, anger: 0.62, lid: 0.12, iris: P.iris, blink });
  brow(ctx, -35, -97, -21, -94.5, 4.6);
  brow(ctx, 2, -99.5, -14, -96.5, 5);
  // mandibules-crocs + sourire
  ctx.beginPath(); ctx.moveTo(-31, -78); ctx.quadraticCurveTo(-22, -73.5, -12, -77); stroke(ctx, 2.8);
  limb(ctx, [[-31, -76.5], [-36, -72], [-33, -67]], 4.8, 2.6, P.blk, { lw: 1.8, rim: false });
  limb(ctx, [[-15, -75.5], [-17, -70], [-13, -66.5]], 4.8, 2.6, P.blk, { lw: 1.8, rim: false });
  fang(ctx, -24, -75.4, 4, 3.2);
  blush(ctx, -3, -80, 4, 2.4);
  // écharpe (tour de cou)
  limb(ctx, [[-14, -73], [-1, -74], [8, -79]], 9, 9, P.scarf, { lw: 2.6, rim: false });
  // bras avant (poing levé)
  limb(ctx, [[-6, -72], [-18, -68], [-27, -72 + a.s * 2]], 5.6, 5, P.thorax, { rim: false });
  blob(ctx, -29, -73 + a.s * 2, 4.8, P.yel, { lw: 2.4, rim: false });
  if (V === 3) { flame(ctx, -20, -113, 6.5, a.ph, -0.1); flame(ctx, -6, -111, 5.5, a.ph + 2); }
  if (V === 2) drip(ctx, 56, -48, 7, a.ph);
  wingSet(true);
  ctx.restore();
  motes(ctx, a, 7, -40, -130, 95, 80);
}

// =====================================================================
//  8. Taupe mineuse — dynamiteuse : casque de chantier à lampe, lunettes noires, salopette, dynamite
// =====================================================================
const MOLE = {
  rim: '#ffd23a',
  fur: ['#6e5a7a', 'b'], light: ['#a894b2', 'b'], skin: ['#ffa3bf', 'd'], nose: ['#ff6f96', 'd'],
  over: ['#3f6fd8', 'c'], strap: ['#2c4ca8', 'c'], hat: ['#ffcc2a', 'a'], lamp: ['#fff2a0', 'g'], btn: ['#ffc83a', 'm'],
  dyn: ['#e8333f', 'k'], shade: ['#1d1430', 'k'], claw: ['#fff4e2', 'k'],
};
function drawMole(ctx, a, P) {
  const st = a.step;
  const foot = (x, y, c) => {
    fig(ctx, B([[x - 9, y], [x - 9, y - 5], [x - 2, y - 8], [x + 6, y - 6], [x + 7, y - 1], [x + 3, y + 0.4]]), c, { rim: false, glint: false });
    for (const dx of [-9.5, -6.5, -3.5]) { poly(ctx, [[x + dx, y - 1.8], [x + dx + 2.8, y - 1.8], [x + dx - 1.2, y + 1.2]]); paint(ctx, P.claw, 1.4); }
  };
  const bx = 9 - st * 3.5, by = a.lift === -1 ? -3.5 : 0;
  const fx = -8 + st * 3.5, fy = a.lift === 1 ? -3.5 : 0;
  foot(bx, by, shade(P.skin, -0.15));
  foot(fx, fy, P.skin);
  ctx.save();
  ctx.translate(0, -a.up * 1.3);
  squash(ctx, a);
  // bras arrière
  limb(ctx, [[12, -30], [21, -24], [22, -16]], 8, 7, shade(P.fur, -0.12));
  blob(ctx, 22, -15, 5, shade(P.skin, -0.12), { rim: false });
  // corps + salopette
  const body = B([[-16, -34], [-6, -42], [10, -41], [19, -28], [18, -10], [6, -4], [-10, -5], [-18, -16]]);
  fig(ctx, body, P.fur, {
    crack: 14, cn: 2,
    inside: () => {
      fig(ctx, B([[-20, -24], [-8, -27], [6, -27], [22, -24], [22, 0], [-20, 0]], 0.2), P.over, { rim: false, lw: 2.6 });
      fig(ctx, RR(-10, -24, 13, 9, 2), shade(P.over, -0.1), { rim: false, lw: 2, glint: false });
      limb(ctx, [[-7, -40], [-6, -25]], 4.4, 4.4, P.strap, { rim: false, lw: 2 });
      limb(ctx, [[8, -40], [10, -25]], 4.4, 4.4, P.strap, { rim: false, lw: 2 });
      blob(ctx, -6, -26, 2.3, P.btn, { lw: 1.6, rim: false, glint: false }); blob(ctx, 10, -26, 2.3, P.btn, { lw: 1.6, rim: false, glint: false });
    },
  });
  if (V === 1) pauldron(ctx, 12, -36, 8, 0.45);
  ctx.restore();
  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 2.2);
  squash(ctx, a, 0.6);
  const head = B([[-34, -50], [-28, -60], [-16, -68], [0, -70], [13, -64], [17, -52], [12, -40], [0, -35], [-15, -37], [-28, -42]]);
  fig(ctx, head, P.fur, { crack: 15, cn: 1, inside: () => { ell(ctx, -22, -44, 13, 8, -0.1); ctx.fillStyle = P.light; ctx.fill(); } });
  // casque de chantier + lampe
  ctx.save(); ctx.translate(-2, -66); ctx.rotate(-0.12);
  const hat = B([[-20, 2], [-17, -9], [-6, -17], [8, -17], [17, -9], [19, 2]]);
  fig(ctx, hat, P.hat, { lw: 2.8, size: 15, inside: () => { ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(0, 1); stroke(ctx, 3, shade(P.hat, -0.25)); } });
  fig(ctx, RR(-25, -0.5, 47, 5.5, 2.7), shade(P.hat, -0.08), { rim: false, lw: 2.6, glint: false });
  glow(ctx, -21, -8, 18, P.lamp, a.f % 2 ? 0.75 : 0.55);
  fig(ctx, RR(-26, -13, 9, 10, 3), '#4a4060', { rim: false, lw: 2.4, glint: false });
  blob(ctx, -26, -8, 4, P.lamp, { lw: 2.2, rim: false, hi: 0.4 });
  if (V === 3) { flame(ctx, 2, -16, 7, a.ph); flame(ctx, 11, -13, 5.5, a.ph + 2, 0.2); }
  ctx.restore();
  // lunettes noires rondes + sourcils
  brow(ctx, -26, -60, -14, -57.5, 4.4);
  brow(ctx, 6, -61, -6, -58.5, 4.6);
  ctx.beginPath(); ctx.moveTo(-14, -52); ctx.lineTo(-9, -52); ctx.moveTo(3, -52); ctx.lineTo(13, -55); stroke(ctx, 2.6);
  for (const [x, r] of [[-19, 6], [-2, 7]]) {
    fig(ctx, E(x, -51, r, r * 0.9), P.shade, {
      rim: false, lw: 2.6, glint: false, hi: 0,
      inside: () => {
        if (EYEG) { glow(ctx, x - 1, -51, r * 1.2, EYEG, 0.9); ell(ctx, x - 1, -51, r * 0.45, r * 0.3); ctx.fillStyle = EYEG; ctx.fill(); }
        poly(ctx, [[x - r * 0.6, -51 + r], [x - r * 0.15, -51 + r], [x + r * 0.5, -51 - r], [x + r * 0.05, -51 - r]]); fillA(ctx, '#ffffff', 0.35);
      },
    });
  }
  // nez + dents
  blob(ctx, -35, -48, 5.4, P.nose, { ry: 4.6, rim: false, lw: 2.4 });
  ctx.beginPath(); ctx.moveTo(-31, -42); ctx.quadraticCurveTo(-20, -37.5, -10, -41); stroke(ctx, 2.6);
  for (const x of [-27, -23]) { rr(ctx, x - 1.9, -41.6, 3.8, 6, 1.2); paint(ctx, V === 1 && x > -25 ? P.gold : WHITE, 1.8); }
  fang(ctx, -13, -40.4, 3.6, 3);
  blush(ctx, -6, -43, 4, 2.4);
  if (V === 2) drip(ctx, -11, -39, 7, a.ph);
  ctx.restore();
  // bras avant + bâton de dynamite (mèche qui crépite)
  ctx.save(); ctx.translate(0, -a.up * 1.3);
  const hx = -23, hy = -20 + st;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-1.05);
  fig(ctx, RR(-3.6, -16, 7.2, 22, 2.5), P.dyn, { rim: false, lw: 2.4, inside: () => { ctx.fillStyle = shade(P.dyn, -0.25); ctx.fillRect(-4, -11, 8, 2); ctx.fillRect(-4, 1, 8, 2); } });
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(3, -20, 1, -23); stroke(ctx, 2.2, '#5a4a40');
  glow(ctx, 1, -24, 10, '#ffcc33', 0.9);
  for (let i = 0; i < 4; i++) { const t = i * Math.PI / 2 + a.f * 0.8; sparkle(ctx, 1 + Math.cos(t) * 3.2, -24 + Math.sin(t) * 3.2, 2.6 + (i === a.f ? 1.4 : 0), i % 2 ? '#ffd23a' : '#ffffff'); }
  ctx.restore();
  limb(ctx, [[-10, -32], [-18, -26], [hx + 2, hy + 1]], 8, 7, P.fur);
  blob(ctx, hx, hy, 5.5, P.skin, { rim: false });
  ctx.restore();
  motes(ctx, a, 8, -34, -86, 64, 80);
}

// =====================================================================
//  9. Bonhomme de neige maléfique — hooligan des neiges : bonnet à pompon, écharpe, boule de neige
// =====================================================================
const YETI = {
  rim: '#8fe8ff',
  snow: ['#f2f6ff', 'b'], snowS: ['#cdd9f2', 'b'], coal: ['#2e2638', 'k'], twig: ['#7a4a2e', 'k'], carrot: ['#ff8a2a', 'd'],
  hat: ['#e8334a', 'a'], hat2: ['#fff4f0', 'c'], scarf: ['#2f9a6a', 'c'], scarf2: ['#ffd23a', 'c'], iris: ['#2e2638', 'e'],
};
function drawYeti(ctx, a, P) {
  const sq = [[1.08, 0.93], [0.95, 1.05], [1.08, 0.93], [0.95, 1.05]][a.f];
  ctx.save();
  ctx.translate(0, -a.up * 3);
  ctx.scale(sq[0], sq[1]);
  // bras arrière levé avec boule de neige
  const ra = a.s * 0.12;
  ctx.save(); ctx.translate(16, -46); ctx.rotate(ra);
  limb(ctx, [[0, 0], [10, -10], [14, -24]], 4.4, 3.4, P.twig, { rim: false, lw: 2.4 });
  limb(ctx, [[10, -10], [17, -12]], 3, 2.4, P.twig, { rim: false, lw: 2 });
  blob(ctx, 14, -30, 8, P.snow, { rim: undefined });
  ctx.restore();
  // boule du bas
  const low = E(2, -25, 27, 24);
  fig(ctx, low, P.snow, { crack: 16, cn: 2, inside: () => { ell(ctx, 10, -6, 22, 8); ctx.fillStyle = rgba(P.snowS, 0.8); ctx.fill(); } });
  for (const y of [-34, -22, -10]) blob(ctx, -12 + (y + 34) * 0.1, y, 3, P.coal, { lw: 1.6, rim: false });
  // écharpe
  const w = a.ph;
  limb(ctx, [[12, -50], [22, -46 + Math.sin(w) * 2], [31, -40 + Math.sin(w + 1.3) * 3], [38, -44 + Math.sin(w + 2.5) * 4]], 8, 6, P.scarf, { lw: 2.6 });
  // boule de la tête
  const head = E(-2, -68, 24, 22);
  fig(ctx, head, P.snow, { crack: 17, cn: 1 });
  limb(ctx, [[-22, -50], [-6, -47.5], [12, -50]], 9, 9, P.scarf, { lw: 2.6, inside: () => { ctx.fillStyle = P.scarf2; for (let x = -18; x < 14; x += 8) ctx.fillRect(x, -56, 3.5, 12); } });
  // bonnet rayé à pompon
  ctx.save(); ctx.translate(2, -86); ctx.rotate(0.12);
  const hat = B([[-20, 4], [-19, -6], [-10, -15], [4, -17], [16, -10], [21, 4]]);
  fig(ctx, hat, P.hat, { lw: 2.8, size: 15, inside: () => { ctx.fillStyle = P.hat2; for (const y of [-10, -3]) ctx.fillRect(-24, y, 48, 3.6); } });
  fig(ctx, RR(-22, 1, 45, 7, 3.4), P.hat2, { rim: false, lw: 2.6, glint: false });
  if (V === 3) flame(ctx, 8, -15, 8, a.ph, 0.2);
  else blob(ctx, 10 + a.s, -18, 6, P.hat2, { lw: 2.6 });
  ctx.restore();
  // visage
  brow(ctx, -26, -84, -13, -79, 5, P.twig);
  brow(ctx, 6, -85, -6, -80, 5.2, P.twig);
  const blink = a.f === 3;
  eye(ctx, -18, -73, 5.6, { ry: 6.6, skin: P.snow, inner: 1, anger: 0.55, lid: 0.12, iris: P.iris, blink });
  eye(ctx, -2, -74, 6.6, { ry: 7.8, skin: P.snow, inner: -1, anger: 0.55, lid: 0.12, iris: P.iris, blink });
  // carotte
  fig(ctx, B([[-15, -68], [-30, -66], [-45, -63], [-30, -60.5], [-15, -62]], 0.4), P.carrot, { rim: false, lw: 2.6, size: 8, inside: () => { ctx.beginPath(); ctx.moveTo(-25, -67); ctx.lineTo(-26, -63); ctx.moveTo(-33, -65); ctx.lineTo(-33.5, -62); stroke(ctx, 1.4, rgba(OUT, 0.6)); } });
  // sourire en charbon
  const m = B([[-21, -59], [-11, -57], [2, -58], [8, -61], [4, -53], [-8, -51], [-18, -54]]);
  fig(ctx, m, P.coal, {
    rim: false, lw: 2.6, glint: false, hi: 0,
    inside: () => { ctx.fillStyle = WHITE; for (let i = 0; i < 4; i++) { const x = -17 + i * 6.3; poly(ctx, [[x, -61], [x + 5, -61], [x + 2.5, -55.5]]); ctx.fill(); } },
  });
  blush(ctx, 8, -64, 4, 2.4);
  if (V === 1) { pauldron(ctx, 14, -46, 8, 0.5); for (const x of [-14, -4, 6]) spike(ctx, x, -96 + Math.abs(x + 4) * 0.2, -Math.PI / 2 + x * 0.03, 8, 5, P.gold); }
  if (V === 2) drip(ctx, -6, -52, 8, a.ph);
  // bras avant (branche griffue)
  limb(ctx, [[-20, -40], [-32, -36 + a.s * 2], [-40, -40 + a.s * 2]], 4.6, 3.4, P.twig, { rim: false, lw: 2.4 });
  for (const d of [-0.6, 0.3]) limb(ctx, [[-40, -40 + a.s * 2], [-40 - 6 * Math.cos(d), -40 + a.s * 2 + 6 * Math.sin(d)]], 3, 2.2, P.twig, { rim: false, lw: 2 });
  limb(ctx, [[-32, -36 + a.s * 2], [-34, -30 + a.s * 2]], 3, 2.2, P.twig, { rim: false, lw: 2 });
  ctx.restore();
  motes(ctx, a, 9, -40, -110, 80, 100);
}

// =====================================================================
//  10. Toutou-Tron — chien-robot de patrouille : gyrophare, visière LED, mâchoire d'acier
// =====================================================================
const ROBO = {
  rim: '#4aa9ff',
  steel: ['#b9c4e2', 'b'], steelD: ['#7d88b0', 'b'], dark: ['#2a2742', 'k'], panel: ['#3f5bc8', 'c'],
  led: ['#3fe8ff', 'e'], siren1: ['#ff2a48', 'g'], siren2: ['#2a8bff', 'g'], stud: ['#d9def0', 'm'], tooth: ['#f4f6ff', 'k'],
};
function drawRobodog(ctx, a, P) {
  const st = a.step;
  // pattes à piston
  const leg = (x, top, swing, col, front) => {
    const fx = x + swing * 4;
    limb(ctx, [[x, top], [x + swing * 2, top + 12], [fx, -6]], 7, 6, col, { rim: front ? undefined : false });
    blob(ctx, x + swing, top + 10, 3.4, P.dark, { lw: 2, rim: false, glint: false });
    fig(ctx, B([[fx - 7, 0], [fx - 7, -5], [fx - 2, -8], [fx + 4, -7], [fx + 5, -1], [fx + 2, 0.4]]), P.dark, { rim: false, glint: false });
  };
  leg(28, -30, -st, P.steelD, false);
  leg(-2, -30, st, P.steelD, false);
  ctx.save();
  ctx.translate(0, -a.up * 1.4);
  squash(ctx, a, 0.8);
  // queue-antenne
  limb(ctx, [[36, -42], [44, -50], [47 + a.s * 2, -58]], 3.2, 2.4, P.steelD, { rim: false, lw: 2.2 });
  glow(ctx, 47 + a.s * 2, -60, 8, P.led, 0.7); blob(ctx, 47 + a.s * 2, -60, 3.4, P.led, { lw: 2, rim: false });
  // corps
  const body = B([[-12, -52], [8, -55], [34, -52], [41, -42], [38, -28], [24, -24], [-4, -24], [-14, -32]], 0.4);
  fig(ctx, body, P.steel, {
    crack: 18, cn: 2,
    inside: () => {
      fig(ctx, RR(4, -50, 28, 15, 4), P.panel, { rim: false, lw: 2.4, inside: () => { ctx.fillStyle = P.led; for (let i = 0; i < 3; i++) ctx.fillRect(9 + i * 7, -45, 4, 5); } });
      ctx.fillStyle = shade(P.steel, -0.3); for (const x of [-6, 36]) { ell(ctx, x, -44, 1.6, 1.6); ctx.fill(); ell(ctx, x, -32, 1.6, 1.6); ctx.fill(); }
    },
  });
  if (V === 1) { for (const x of [4, 14, 24, 34]) spike(ctx, x, -53, -Math.PI / 2 + 0.2, 8, 5, P.gold); }
  ctx.restore();
  leg(30, -30, st * 0.8, P.steel, true);
  leg(0, -30, -st * 0.8, P.steel, true);
  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 2.4);
  squash(ctx, a, 0.5);
  // collier à pics
  limb(ctx, [[-12, -56], [-4, -50], [6, -50]], 7, 7, P.dark, { rim: false });
  for (const t of [0.2, 0.55, 0.9]) { const p = along([[-12, -56], [-4, -50], [6, -50]], t); spike(ctx, p.x, p.y + 2, Math.PI / 2, 5.5, 4.2, P.stud, 1.6); }
  // oreilles-ailerons
  fig(ctx, PL([[-6, -86], [4, -102], [8, -84]]), P.steelD, { glint: false });
  fig(ctx, PL([[-20, -88], [-17, -104], [-8, -88]]), P.steel, { glint: false });
  const head = B([[-44, -66], [-42, -80], [-32, -90], [-10, -92], [6, -86], [10, -70], [6, -58], [-12, -54], [-34, -56]], 0.4);
  fig(ctx, head, P.steel, { crack: 19, cn: 1 });
  // gyrophare (alterne rouge / bleu)
  const sc = a.f % 2 ? P.siren2 : P.siren1;
  glow(ctx, -18, -100, 20, sc, 0.7);
  fig(ctx, RR(-23, -96, 11, 6, 1.5), P.dark, { rim: false, lw: 2.2, glint: false });
  fig(ctx, B([[-22, -95], [-22, -103], [-17.5, -107], [-13, -103], [-13, -95]], 0.4), sc, { rim: false, lw: 2.4, hi: 0.4, size: 6 });
  // visière LED
  const vis = RR(-44, -82, 42, 13, 6);
  fig(ctx, vis, '#191230', {
    rim: false, lw: 2.8, glint: false, hi: 0.08,
    inside: () => {
      const L = P.led;
      glow(ctx, -24, -75, 24, L, 0.4);
      ctx.fillStyle = L;
      if (a.f === 3) { ctx.fillRect(-38, -76, 10, 2.6); ctx.fillRect(-20, -76, 11, 2.6); }
      else {
        poly(ctx, [[-39, -80], [-28, -76.5], [-28, -72.5], [-39, -74]]); ctx.fill();
        poly(ctx, [[-8, -80.5], [-20, -76.5], [-20, -72.5], [-8, -74.5]]); ctx.fill();
        ctx.fillStyle = mix(L, '#ffffff', 0.75);
        poly(ctx, [[-37, -77.6], [-30, -75.5], [-30, -74.6], [-37, -75.8]]); ctx.fill();
        poly(ctx, [[-10, -78], [-18, -75.6], [-18, -74.6], [-10, -76]]); ctx.fill();
      }
    },
  });
  // mâchoire d'acier (s'ouvre et se ferme)
  const open = [1, 4, 2, 4][a.f];
  ctx.save(); ctx.translate(-8, -60); ctx.rotate(open * 0.05);
  fig(ctx, B([[-38, 0], [-30, -2], [0, -2], [4, 4], [-6, 10], [-32, 9]], 0.4), P.steelD, {
    rim: undefined, lw: 2.8, glint: false,
    inside: () => { ctx.fillStyle = '#5a1730'; ctx.fillRect(-40, -4, 46, 5); },
  });
  for (let i = 0; i < 5; i++) { poly(ctx, [[-35 + i * 6, -1], [-30 + i * 6, -1], [-32.5 + i * 6, -6]]); paint(ctx, P.tooth, 1.6); }
  ctx.restore();
  for (let i = 0; i < 5; i++) { poly(ctx, [[-44 + i * 6, -59], [-39 + i * 6, -59], [-41.5 + i * 6, -54]]); paint(ctx, P.tooth, 1.6); }
  blob(ctx, -45, -66, 4.2, P.dark, { rim: false, lw: 2.2 });
  if (V === 2) drip(ctx, -30, -50, 8, a.ph);
  if (V === 3) { flame(ctx, 2, -86, 6, a.ph, 0.1); flame(ctx, -30, -90, 5.5, a.ph + 2, -0.1); }
  ctx.restore();
  motes(ctx, a, 10, -44, -108, 90, 90);
}

// =====================================================================
//  11. Gloop de lave — blob caïd : casquette à l'envers, croûte de lave, poing visqueux
// =====================================================================
const SLIME = {
  rim: '#ffe24a',
  lava: ['#ff7a22', 'b'], hot: ['#ffd23a', 'd'], crust: ['#6a2418', 'k'],
  cap: ['#5b3ab8', 'c'], capF: ['#ffffff', 'c'], btn: ['#ffc83a', 'm'], iris: ['#7a1a10', 'e'],
};
function drawSlime(ctx, a, P) {
  const [sx, sy, dy] = [[1.14, 0.88, 0], [0.92, 1.1, 0], [0.98, 1.03, -5], [1.04, 0.97, -2]][a.f];
  ctx.save();
  ctx.translate(0, dy);
  ctx.scale(sx, sy);
  // gouttes au sol / côtés
  blob(ctx, 30, -4, 4.5, shade(P.lava, -0.1), { rim: false, lw: 2.4 });
  // poing arrière
  limb(ctx, [[26, -22], [36, -26], [40, -34 + a.s * 2]], 9, 7, shade(P.lava, -0.12), { rim: false });
  blob(ctx, 41, -36 + a.s * 2, 6.2, shade(P.lava, -0.08), { rim: false });
  const body = B([[-32, -4], [-34, -22], [-26, -40], [-11, -52], [6, -55], [22, -47], [32, -28], [34, -6], [22, 0], [0, 1], [-22, 0]]);
  fig(ctx, body, P.lava, {
    crack: 20, cn: 3,
    inside: () => {
      ell(ctx, -4, -6, 26, 8); ctx.fillStyle = rgba(P.hot, 0.55); ctx.fill();
      for (const [x, y, r] of [[18, -36, 7], [26, -16, 5.5], [8, -48, 4.5], [-27, -10, 4]]) {
        fig(ctx, B([[x - r, y], [x - r * 0.4, y - r * 0.9], [x + r * 0.7, y - r * 0.7], [x + r, y + r * 0.2], [x + r * 0.2, y + r * 0.8], [x - r * 0.7, y + r * 0.6]], 0.4), P.crust, { rim: false, lw: 2, glint: false, hi: 0.15 });
      }
      for (const [x, y, r] of [[-20, -38, 2.6], [12, -26, 2], [-28, -22, 1.6]]) { ell(ctx, x, y, r, r); ctx.fillStyle = P.hot; ctx.fill(); }
    },
  });
  // casquette à l'envers
  ctx.save(); ctx.translate(2, -52); ctx.rotate(0.15);
  fig(ctx, RR(6, -2, 24, 6, 3), shade(P.cap, -0.12), { rim: false, lw: 2.6, glint: false });
  const cap = B([[-16, 2], [-15, -8], [-6, -15], [6, -15], [14, -8], [16, 2]]);
  fig(ctx, cap, P.cap, { lw: 2.8, size: 13, inside: () => { ell(ctx, -11, -4, 7, 9); ctx.fillStyle = P.capF; ctx.fill(); ell(ctx, -11, -4, 7, 9); stroke(ctx, 2); } });
  blob(ctx, 0, -15, 2.6, P.btn, { lw: 1.8, rim: false, glint: false });
  if (V === 1) for (const x of [-8, 0, 8]) spike(ctx, x, -14 + Math.abs(x) * 0.15, -Math.PI / 2 + x * 0.05, 8, 5, P.gold);
  if (V === 3) { flame(ctx, -6, -14, 6, a.ph, -0.2); flame(ctx, 8, -13, 7, a.ph + 2); }
  ctx.restore();
  // visage
  const blink = a.f === 3;
  eye(ctx, -16, -33, 7, { ry: 8.2, skin: P.lava, inner: 1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  eye(ctx, 3, -35, 8.2, { ry: 9.6, skin: P.lava, inner: -1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  brow(ctx, -26, -44, -11, -40, 5);
  brow(ctx, 14, -48, -2, -43, 5.4);
  const m = B([[-25, -21], [-14, -18.5], [0, -19], [10, -22], [6, -11], [-8, -8], [-20, -12]]);
  fig(ctx, m, '#5a1020', {
    rim: false, lw: 2.6, glint: false, hi: 0,
    inside: () => { ell(ctx, -6, -8, 9, 5); ctx.fillStyle = '#ff6d8a'; ctx.fill(); },
  });
  fang(ctx, -20, -20, 5, 4); fang(ctx, 4, -20.5, 5, 4);
  if (V === 1) { pauldron(ctx, 22, -42, 8, 0.6); fig(ctx, RR(-10, -20, 6, 4.4, 1.4), P.gold, { rim: false, lw: 1.6, glint: false }); }
  // poing avant
  limb(ctx, [[-26, -16], [-36, -20], [-42, -28 - a.s * 2]], 10, 8, P.lava);
  blob(ctx, -43, -30 - a.s * 2, 7, P.lava, { inside: () => { ctx.beginPath(); ctx.moveTo(-49, -31 - a.s * 2); ctx.lineTo(-44, -30 - a.s * 2); ctx.moveTo(-49, -27 - a.s * 2); ctx.lineTo(-44, -26.5 - a.s * 2); stroke(ctx, 1.8); } });
  if (V === 2) { drip(ctx, -14, -2, 6, a.ph); drip(ctx, 14, -1, 8, a.ph + 2); }
  ctx.restore();
  // braises de lave (toujours), en plus des particules de variante
  if (V !== 2) for (let i = 0; i < 2; i++) { const ph = (a.f / 4 + i * 0.5) % 1; const x = -8 + i * 22, y = -62 - ph * 14; glow(ctx, x, y, 6, '#ff7a1a', 0.6 * (1 - ph)); ell(ctx, x, y, 1.6, 1.6); ctx.fillStyle = '#ffd27a'; ctx.fill(); }
  motes(ctx, a, 11, -40, -80, 80, 70);
}

// =====================================================================
//  12. Souris martienne — pilote de soucoupe : casque-bulle, antenne, canon à rayons
// =====================================================================
const UFO = {
  rim: '#ff5ad8',
  skin: ['#8fe36a', 'b'], skinL: ['#d4f7b0', 'b'], ear: ['#ff9ec0', 'd'],
  hull: ['#b8bfe0', 'm'], hullD: ['#6c74a6', 'm'], band: ['#5b3ab8', 'c'], light1: ['#ffe24a', 'g'], light2: ['#46e8ff', 'g'],
  ray: ['#ff4fd8', 'g'], iris: ['#c2187a', 'e'], glass: ['#bff4ff', 'k'],
};
function drawUfo(ctx, a, P) {
  ctx.save();
  ctx.translate(0, a.hov);
  // faisceau sous la soucoupe
  ctx.save();
  const g = ctx.createLinearGradient(0, -34, 0, -6);
  g.addColorStop(0, rgba(P.light2, 0.45)); g.addColorStop(1, rgba(P.light2, 0));
  ctx.fillStyle = g; poly(ctx, [[-14, -34], [14, -34], [22, -6], [-22, -6]]); ctx.fill();
  ctx.restore();
  // oreilles (hors du casque)
  const ear = (x, y, r, c) => {
    fig(ctx, E(x, y, r, r * 0.95), c, { inside: () => { ell(ctx, x + r * 0.05, y + r * 0.1, r * 0.62, r * 0.58); ctx.fillStyle = P.ear; ctx.fill(); } });
  };
  ear(13, -94, 10, shade(P.skin, -0.1));
  // coque inférieure
  const hull = B([[-44, -44], [-31, -35], [0, -31], [31, -35], [44, -44], [30, -49], [-30, -49]], 0.45);
  fig(ctx, hull, P.hullD, { crack: 21, cn: 1, inside: () => { ell(ctx, 0, -32, 10, 3.5); ctx.fillStyle = P.light2; ctx.fill(); } });
  // tête de souris dans la bulle
  ctx.save(); ctx.translate(0, -6);
  fig(ctx, E(-1, -60, 19.5, 17.5), P.skin, {
    rim: false,
    inside: () => { ell(ctx, -12, -52, 11, 7, -0.2); ctx.fillStyle = P.skinL; ctx.fill(); },
  });
  const blink = a.f === 3;
  eye(ctx, -11, -62, 6, { ry: 7.2, skin: P.skin, inner: 1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  eye(ctx, 5, -63, 7, { ry: 8.4, skin: P.skin, inner: -1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  brow(ctx, -19, -72, -6, -69, 4.2);
  brow(ctx, 14, -74, 0, -70.5, 4.4);
  blob(ctx, -21, -55, 3.8, P.ear, { rim: false, lw: 2.2 });
  ctx.beginPath(); ctx.moveTo(-19, -49.5); ctx.quadraticCurveTo(-10, -46.5, -2, -49.5); stroke(ctx, 2.4);
  fang(ctx, -14, -48.4, 3.6, 3); fang(ctx, -6, -48.2, 3.6, 3);
  // bulle de verre
  const dome = E(0, -61, 25, 24);
  dome(ctx); ctx.fillStyle = rgba(P.glass, 0.16); ctx.fill();
  clip(ctx, dome, () => {
    ctx.beginPath(); ctx.arc(0, -61, 21, Math.PI * 1.05, Math.PI * 1.42); stroke(ctx, 3.4, 'rgba(255,255,255,0.8)');
    rimLight(ctx, dome, rgba(RIM, 0.9), 1.8, 3);
  });
  dome(ctx); stroke(ctx, 3);
  ear(-14, -86, 11, P.skin);
  for (const [x, y] of [[-14, -80], [13, -82]]) { ell(ctx, x, y, 7, 2.6); paint(ctx, P.band, 2.2); }
  // antenne
  limb(ctx, [[0, -84], [1 + a.s, -94], [3 + a.s * 2, -100]], 2.8, 2.2, P.hullD, { rim: false, lw: 2 });
  glow(ctx, 3 + a.s * 2, -102, 9, P.ray, 0.8); blob(ctx, 3 + a.s * 2, -102, 3.2, P.ray, { lw: 2, rim: false });
  ctx.restore();
  // anneau à lumières
  const ring = B([[-47, -46], [-40, -52], [0, -55], [40, -52], [47, -46], [40, -40], [0, -38], [-40, -40]], 0.45);
  fig(ctx, ring, P.hull, {
    inside: () => {
      ctx.fillStyle = P.band; ctx.fillRect(-50, -47, 100, 7);
      for (let i = 0; i < 7; i++) {
        const x = -36 + i * 12, on = (i + a.f) % 3 === 0;
        const c = i % 2 ? P.light1 : P.light2;
        if (on) glow(ctx, x, -43.5, 9, c, 0.9);
        ell(ctx, x, -43.5, 3, 2.6); ctx.fillStyle = on ? mix(c, '#ffffff', 0.5) : shade(c, -0.35); ctx.fill(); stroke(ctx, 1.4);
      }
    },
  });
  if (V === 1) for (const x of [-30, -15, 15, 30]) spike(ctx, x, -51 - (1 - Math.abs(x) / 40) * 3, -Math.PI / 2 + x * 0.012, 8, 5, P.gold);
  // canon à rayons
  ctx.save(); ctx.translate(-40, -42);
  fig(ctx, RR(-14, -4.5, 18, 9, 3), P.hullD, { rim: false, lw: 2.6, glint: false });
  fig(ctx, RR(-20, -3, 8, 6, 2), P.band, { rim: false, lw: 2.2, glint: false });
  glow(ctx, -21, 0, 12, P.ray, a.f % 2 ? 0.95 : 0.6);
  blob(ctx, -21, 0, 3, mix(P.ray, '#ffffff', 0.4), { lw: 1.8, rim: false });
  ctx.restore();
  if (V === 3) { flame(ctx, 38, -50, 6, a.ph, 0.4); flame(ctx, -28, -50, 5, a.ph + 2, -0.3); }
  if (V === 2) { drip(ctx, -20, -36, 6, a.ph); drip(ctx, 22, -36, 8, a.ph + 2); }
  ctx.restore();
  motes(ctx, a, 12, -46, -110, 92, 80);
}

// =====================================================================
//  13. Fantôme drap — cambrioleur : masque de bandit, bonnet, pied-de-biche, sac de croquettes volées
// =====================================================================
const GHOST = {
  rim: '#7affd8',
  sheet: ['#eef0ff', 'b'], sheetS: ['#c9c6ec', 'b'], mask: ['#2a2238', 'k'], hat: ['#3a3458', 'c'], hatB: ['#ff4a6a', 'a'],
  sack: ['#d8b27a', 'c'], bar: ['#e8334a', 'a'], iris: ['#2f7a6a', 'e'], fish: ['#4aa9ff', 'k'],
};
function drawGhost(ctx, a, P) {
  ctx.save();
  ctx.translate(0, a.hov * 0.8 - 6);
  const wv = (i) => Math.sin(a.ph + i * 1.3) * 3;
  // sac de croquettes sur l'épaule
  ctx.save(); ctx.translate(26, -64); ctx.rotate(0.2 + a.s * 0.05);
  const sack = B([[-12, -2], [-14, -14], [-6, -22], [8, -22], [16, -12], [14, 4], [2, 8], [-10, 6]]);
  fig(ctx, sack, P.sack, {
    inside: () => {
      ctx.save(); ctx.translate(1, -7); ctx.fillStyle = P.fish;
      ell(ctx, 0, 0, 6, 3.6); ctx.fill(); poly(ctx, [[5, 0], [10, -4], [10, 4]]); ctx.fill();
      ell(ctx, -3, -0.8, 0.9, 0.9); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-4, 4); ctx.moveTo(6, -18); ctx.lineTo(9, -14); stroke(ctx, 1.6, rgba(OUT, 0.5));
    },
  });
  fig(ctx, B([[-6, -21], [-2, -30], [6, -31], [8, -22]]), shade(P.sack, -0.1), { rim: false, lw: 2.4, glint: false });
  limb(ctx, [[-7, -22], [9, -22]], 3.6, 3.6, P.hatB, { rim: false, lw: 2 });
  ctx.restore();
  // drap
  const sheet = B([[-27, -60], [-25, -83], [-12, -99], [6, -101], [21, -89], [27, -66], [29, -38], [31, -20 + wv(0)], [23, -15 + wv(1)], [15, -22 + wv(1)], [7, -13 + wv(2)], [-2, -20 + wv(2)], [-10, -12 + wv(3)], [-18, -19 + wv(3)], [-27, -13 + wv(4)], [-29, -30]], 0.5);
  fig(ctx, sheet, P.sheet, {
    crack: 22, cn: 2,
    inside: () => {
      ctx.strokeStyle = rgba(P.sheetS, 0.9); ctx.lineWidth = 3;
      for (const x of [-8, 10]) { ctx.beginPath(); ctx.moveTo(x, -50); ctx.quadraticCurveTo(x + 3, -32, x - 1, -16); ctx.stroke(); }
      // masque de bandit
      fig(ctx, RR(-34, -79, 70, 15, 6), P.mask, { rim: false, lw: 2.4, glint: false, hi: 0.1 });
    },
  });
  // nœud du masque
  limb(ctx, [[25, -72], [33, -74 + wv(1) * 0.6], [40, -70 + wv(2)]], 5, 3, P.mask, { rim: false, lw: 2.2 });
  limb(ctx, [[25, -70], [32, -64 + wv(2) * 0.6], [37, -60 + wv(3)]], 5, 3, P.mask, { rim: false, lw: 2.2 });
  // bonnet de cambrioleur
  ctx.save(); ctx.translate(-2, -95); ctx.rotate(0.08);
  const hat = B([[-17, 5], [-16, -5], [-8, -12], [4, -13], [14, -7], [18, 5]]);
  fig(ctx, hat, P.hat, { lw: 2.8, size: 13, inside: () => { ctx.strokeStyle = shade(P.hat, 0.2); ctx.lineWidth = 1.6; for (let x = -14; x < 18; x += 4.5) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x, 4); ctx.stroke(); } } });
  fig(ctx, RR(-19, 1, 39, 7, 3.4), P.hatB, { rim: false, lw: 2.6, glint: false });
  if (V === 3) flame(ctx, 2, -12, 7, a.ph);
  ctx.restore();
  // yeux dans le masque
  const blink = a.f === 3;
  eye(ctx, -17, -71.5, 5.8, { ry: 6.4, skin: P.mask, inner: 1, anger: 0.55, lid: 0.12, iris: P.iris, blink });
  eye(ctx, 1, -72.5, 6.8, { ry: 7.4, skin: P.mask, inner: -1, anger: 0.55, lid: 0.12, iris: P.iris, blink });
  // sourire narquois
  const m = B([[-22, -56], [-12, -53], [2, -54], [8, -58], [5, -49], [-8, -46], [-18, -50]]);
  fig(ctx, m, '#4a1a3a', { rim: false, lw: 2.6, glint: false, hi: 0, inside: () => { ell(ctx, -6, -46, 8, 4); ctx.fillStyle = '#ff6d8a'; ctx.fill(); } });
  fang(ctx, -17, -54.5, 4.4, 3.6); fang(ctx, 2, -55.4, 4.4, 3.6);
  blush(ctx, -26, -60, 3.6, 2.2); blush(ctx, 12, -60, 4, 2.4);
  if (V === 1) { pauldron(ctx, 18, -82, 8, 0.5); pauldron(ctx, -22, -82, 7, -0.5); }
  if (V === 2) { drip(ctx, -10, -14 + wv(3), 7, a.ph); drip(ctx, 14, -18 + wv(1), 6, a.ph + 2); }
  // bras-drap avant + pied-de-biche
  ctx.save(); ctx.translate(-30, -40); ctx.rotate(-0.4 + a.s * 0.12);
  fig(ctx, B([[-2.6, 8], [2.6, 8], [2.6, -24], [-2, -30], [-9, -29], [-10, -25], [-5, -25], [-2.6, -22]], 0.2), P.bar, { rim: false, lw: 2.4, glint: false, hi: 0.3, size: 9 });
  ctx.restore();
  limb(ctx, [[-20, -44], [-28, -40], [-33, -42 + a.s]], 11, 9, P.sheet, { lw: 2.8 });
  blob(ctx, -32, -40 + a.s, 6, P.sheet, { rim: false });
  ctx.restore();
  motes(ctx, a, 13, -36, -110, 80, 90);
}

// =====================================================================
//  14. Rat chevalier — chevalier noir du gang : heaume à visière, plumet, bouclier « patte barrée »
// =====================================================================
const KNIGHT = {
  rim: '#ff4a5a',
  fur: ['#9a8fb4', 'b'], light: ['#ddd6ee', 'b'], skin: ['#ff9ec0', 'd'], nose: ['#ff5f93', 'd'],
  steel: ['#c8d0ea', 'm'], steelD: ['#7d88b0', 'm'], trim: ['#ffc83a', 'm'], plume: ['#ff3d5a', 'a'],
  tabard: ['#c8263c', 'a'], shield: ['#3b5fd0', 'c'], badge: ['#fff3d6', 'k'], leather: ['#5a3a3a', 'c'], iris: ['#46307a', 'e'],
};
function drawKnightRat(ctx, a, P) {
  const st = a.step;
  // queue
  const tw = a.s * 3;
  limb(ctx, [[12, -18], [28, -12], [40, -20], [44 + tw * 0.3, -34], [37 + tw, -43]], 6, 2.4, P.skin);
  // jambes en armure
  const bx = 8 - st * 3.5, by = a.lift === -1 ? -3.5 : 0;
  const fx = -7 + st * 3.5, fy = a.lift === 1 ? -3.5 : 0;
  const boot = (x, y, c) => fig(ctx, B([[x - 9, y], [x - 9, y - 6], [x - 2, y - 9], [x + 6, y - 8], [x + 7, y - 1], [x + 3, y + 0.4]]), c, { rim: false, glint: false });
  limb(ctx, [[6, -18], [bx + 1, by - 6]], 9, 8, P.steelD);
  boot(bx, by, shade(P.steelD, -0.15));
  limb(ctx, [[-5, -18], [fx + 1, fy - 6]], 9, 8, P.steel);
  boot(fx, fy, P.steelD);
  ctx.save();
  ctx.translate(0, -a.up * 1.3);
  squash(ctx, a);
  // épée levée (bras arrière)
  ctx.save(); ctx.translate(18, -46); ctx.rotate(0.35 + a.s * 0.08);
  fig(ctx, B([[-3.4, -6], [3.4, -6], [3.4, -40], [0, -47], [-3.4, -40]], 0.1), P.steel, { rim: false, lw: 2.6, hi: 0.35, size: 10, inside: () => { ctx.fillStyle = shade(P.steel, -0.3); ctx.fillRect(0, -40, 3.4, 34); } });
  fig(ctx, RR(-9, -8, 18, 5, 2.4), P.trim, { rim: false, lw: 2.4, glint: false });
  fig(ctx, RR(-2.4, -3, 4.8, 9, 2), P.leather, { rim: false, lw: 2, glint: false });
  blob(ctx, 0, 7.5, 3, P.trim, { lw: 2, rim: false, glint: false });
  ctx.restore();
  blob(ctx, 18, -45, 5.4, P.steelD, { rim: false });
  // corps : cuirasse + tabard
  const body = B([[-16, -38], [-7, -48], [10, -48], [20, -34], [18, -14], [4, -8], [-12, -11], [-19, -24]]);
  fig(ctx, body, P.steel, {
    crack: 23, cn: 2,
    inside: () => {
      fig(ctx, B([[-8, -40], [10, -40], [12, -8], [1, -2], [-9, -8]], 0.3), P.tabard, { rim: false, lw: 2.4 });
      ctx.fillStyle = P.leather; ctx.fillRect(-24, -24, 48, 5);
      fig(ctx, RR(-2, -25.5, 8, 8, 1.6), P.trim, { rim: false, lw: 1.8, glint: false });
    },
  });
  if (V === 1) { pauldron(ctx, 12, -44, 9, 0.5); }
  ctx.restore();
  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 2.3);
  squash(ctx, a, 0.5);
  // oreille (dépasse du heaume)
  fig(ctx, E(17, -76, 9, 8.6), shade(P.fur, -0.06), { inside: () => { ell(ctx, 17.5, -75, 5.6, 5); ctx.fillStyle = P.skin; ctx.fill(); } });
  const head = B([[-36, -58], [-30, -66], [-18, -72], [-2, -74], [11, -68], [14, -57], [9, -46], [-2, -42], [-16, -43], [-29, -49]]);
  fig(ctx, head, P.fur, { inside: () => { ell(ctx, -26, -51, 12, 7, -0.15); ctx.fillStyle = P.light; ctx.fill(); } });
  // plumet
  const pl = a.s * 2;
  limb(ctx, [[0, -86], [8, -97], [20, -101 + pl], [31, -95 + pl * 1.4]], 8, 3.6, P.plume, { lw: 2.6 });
  limb(ctx, [[2, -88], [10, -96], [20, -96 + pl]], 3.4, 1.6, shade(P.plume, 0.35), { lw: 0, rim: false });
  // heaume
  const helm = B([[-24, -64], [-20, -78], [-6, -87], [9, -84], [17, -71], [16, -56], [8, -54], [8, -63], [-6, -67], [-17, -62]]);
  fig(ctx, helm, P.steel, {
    crack: 24, cn: 1, size: 18,
    inside: () => { ctx.beginPath(); ctx.moveTo(-1, -88); ctx.lineTo(-2, -67); stroke(ctx, 3.2, P.trim); },
  });
  // visière relevée
  ctx.save(); ctx.translate(-6, -76); ctx.rotate(-0.22);
  fig(ctx, B([[-20, 2], [-16, -5], [6, -7], [14, -3], [12, 3], [-4, 4]], 0.3), P.steelD, { rim: false, lw: 2.6, glint: false, inside: () => { ctx.fillStyle = OUT; ctx.fillRect(-12, -2.4, 18, 2.2); } });
  ctx.restore();
  for (const [x, y] of [[13, -62], [14, -72]]) { ell(ctx, x, y, 1.5, 1.5); ctx.fillStyle = shade(P.steel, -0.4); ctx.fill(); }
  if (V === 1) for (const x of [-12, -3, 6]) spike(ctx, x, -84 + Math.abs(x + 3) * 0.35, -Math.PI / 2 + (x + 3) * 0.04, 8, 5, P.gold);
  if (V === 3) { flame(ctx, -14, -82, 6, a.ph, -0.2); }
  // yeux + sourcils
  const blink = a.f === 3;
  eye(ctx, -20.5, -58, 5.2, { ry: 6.4, skin: P.fur, inner: 1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  eye(ctx, -6.5, -59, 6.4, { ry: 7.6, skin: P.fur, inner: -1, anger: 0.6, lid: 0.12, iris: P.iris, blink });
  brow(ctx, -27, -66, -16, -62.5, 4.2);
  brow(ctx, 2, -68, -10, -64.5, 4.6);
  // museau
  blob(ctx, -36, -56.5, 4.4, P.nose, { ry: 4, rim: false, lw: 2.4 });
  for (const x of [-31, -27.2]) { rr(ctx, x - 1.8, -50.8, 3.6, 5.6, 1.2); paint(ctx, WHITE, 1.8); }
  ctx.beginPath(); ctx.moveTo(-33, -50.5); ctx.quadraticCurveTo(-24, -47, -16, -50); stroke(ctx, 2.6);
  fang(ctx, -18, -49.6, 3.8, 3);
  blush(ctx, -10, -50, 4, 2.4);
  if (V === 2) drip(ctx, -16, -47, 6, a.ph);
  ctx.restore();
  // bouclier (bras avant)
  ctx.save(); ctx.translate(0, -a.up * 1.3);
  const sx = -22, sy = -23 - a.up;
  const shield = B([[sx - 13, sy - 15], [sx, sy - 18], [sx + 13, sy - 15], [sx + 12, sy + 2], [sx, sy + 17], [sx - 12, sy + 2]], 0.35);
  fig(ctx, shield, P.shield, {
    crack: 25, cn: 1,
    inside: () => { shield(ctx); ctx.lineWidth = 7; ctx.strokeStyle = P.trim; ctx.stroke(); },
  });
  gangBadge(ctx, sx, sy - 1, 7, P.badge, OUT);
  ctx.restore();
  motes(ctx, a, 14, -36, -104, 76, 96);
}

// #####################################################################
//  BOSS — designs uniques, 150 à 220 unités de haut
// #####################################################################
const BLW = 3.6; // contour des grandes formes de boss

// Couronne dorée à pointes et gemmes (repère : base centrée en 0,0)
function crown(ctx, w, h, P, gems = ['#ff2a48', '#3fa9ff', '#3fe08a']) {
  const pts = [[-w / 2, 0], [-w / 2 - 2, -h], [-w / 4, -h * 0.45], [0, -h * 1.15], [w / 4, -h * 0.45], [w / 2 + 2, -h], [w / 2, 0]];
  fig(ctx, PL(pts), P.gold, { lw: 3, size: w * 0.4, cx: 0, cy: -h / 2, rim: false, hi: 0.3 });
  fig(ctx, RR(-w / 2 - 1, -h * 0.28, w + 2, h * 0.32, 2), shade(P.gold, -0.08), { lw: 2.6, rim: false, glint: false });
  for (const [x, y, i] of [[-w / 2 - 2, -h, 0], [0, -h * 1.15, 1], [w / 2 + 2, -h, 2]]) blob(ctx, x, y, 3.4, gems[i % gems.length], { lw: 2, rim: false, hi: 0.4 });
  for (const [x, i] of [[-w * 0.28, 1], [0, 0], [w * 0.28, 2]]) blob(ctx, x, -h * 0.12, 2.8, gems[i], { lw: 1.8, rim: false, hi: 0.4 });
}
// Bordure d'hermine (blanc à mouchetures) le long d'une courbe
function ermine(ctx, pts, w, base) {
  limb(ctx, pts, w, w, base, { rim: false });
  for (let i = 1; i < 7; i++) {
    const p = along(pts, i / 7);
    ctx.fillStyle = OUT;
    poly(ctx, [[p.x - 1.4, p.y - 2.6], [p.x + 1.4, p.y - 2.6], [p.x, p.y + 3]]); ctx.fill();
  }
}

// =====================================================================
//  B1. Roi des Rats — gros roi : couronne, cape royale d'hermine, sceptre-fromage en or, dents en or
// =====================================================================
const RATKING = {
  rim: '#ffcf3a',
  fur: ['#8f84a8', 'b'], light: ['#d8d0ea', 'b'], skin: ['#ff9ec0', 'd'], nose: ['#ff5f93', 'd'],
  cape: ['#c8263c', 'c'], capeIn: ['#7a1430', 'c'], tunic: ['#5b3ab8', 'c'], belt: ['#3a2638', 'c'], fur2: ['#fff6ee', 'k'],
  gold2: ['#ffc83a', 'm'], iris: ['#c2187a', 'e'],
};
function drawRatKing(ctx, a, P) {
  const st = a.step;
  // queue
  const tw = a.s * 5;
  limb(ctx, [[30, -26], [56, -20], [76, -40], [80 + tw * 0.3, -76], [70 + tw, -100], [58 + tw, -104]], 12, 4.5, P.skin, { lw: BLW });
  // cape
  const sw = a.s * 3;
  const cape = B([[-24, -122], [12, -128], [46, -114], [64 + sw * 0.5, -72], [76 + sw, -24], [74 + sw, -3], [36, -5], [2, -8], [-12, -60]], 0.45);
  fig(ctx, cape, P.cape, { lw: BLW, crack: 30, inside: () => { ctx.fillStyle = P.capeIn; poly(ctx, [[20, -120], [60, -110], [80, -20], [80, 0], [50, 0]]); ctx.fill(); } });
  ermine(ctx, [[48, -112], [64 + sw * 0.5, -72], [74 + sw, -30], [76 + sw, -6]], 11, P.fur2);
  // pieds
  const bx = 18 - st * 4, fx = -22 + st * 4;
  const foot = (x, y, c) => {
    fig(ctx, B([[x - 15, y], [x - 15, y - 7], [x - 5, y - 12], [x + 8, y - 11], [x + 11, y - 2], [x + 5, y + 0.5]]), c, { rim: false, lw: 3.2 });
    for (const dx of [-15, -10.5, -6]) { poly(ctx, [[x + dx, y - 2.5], [x + dx + 3.4, y - 2.5], [x + dx - 1.6, y + 1.5]]); paint(ctx, WHITE, 1.6); }
  };
  foot(bx, a.lift === -1 ? -5 : 0, shade(P.skin, -0.15));
  foot(fx, a.lift === 1 ? -5 : 0, P.skin);
  ctx.save();
  ctx.translate(0, -a.up * 2);
  squash(ctx, a, 1.2);
  ctx.scale(1.04, 0.86);
  // ventre royal
  const body = B([[-46, -58], [-42, -92], [-26, -112], [4, -118], [32, -108], [46, -80], [48, -40], [36, -12], [4, -6], [-30, -10], [-46, -30]]);
  fig(ctx, body, P.fur, {
    lw: BLW, crack: 31,
    inside: () => {
      ell(ctx, -14, -50, 28, 34); ctx.fillStyle = P.light; ctx.fill();
      fig(ctx, B([[4, -116], [40, -110], [54, -60], [50, -8], [10, -4], [16, -60]], 0.4), P.tunic, { rim: false, lw: 3 });
      for (const y of [-92, -72, -52, -32]) blob(ctx, 14 + (y + 92) * 0.02, y, 3.4, P.gold2, { lw: 2, rim: false, glint: false });
      fig(ctx, RR(-56, -40, 112, 12, 3), P.belt, { rim: false, lw: 3, glint: false });
      fig(ctx, RR(-20, -43, 18, 18, 4), P.gold2, { rim: false, lw: 3, hi: 0.3, inside: () => { ell(ctx, -11, -34, 4, 4); ctx.fillStyle = shade(P.gold2, -0.4); ctx.fill(); } });
    },
  });
  // col d'hermine
  ermine(ctx, [[-36, -106], [-10, -118], [16, -120], [40, -110]], 15, P.fur2);
  // main posée sur la bedaine
  blob(ctx, 30, -66, 10, shade(P.skin, -0.06), { lw: 3.2, inside: () => { ctx.beginPath(); for (const dy of [-3, 3]) { ctx.moveTo(22, -66 + dy); ctx.lineTo(28, -66 + dy); } stroke(ctx, 2); } });
  fig(ctx, RR(22, -64, 6, 4.6, 1.6), P.gold2, { rim: false, lw: 2, glint: false });
  if (V === 1) { pauldron(ctx, 34, -112, 14, 0.5); pauldron(ctx, -32, -108, 13, -0.5); }
  ctx.restore();
  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 3 + 16);
  squash(ctx, a, 0.6);
  ctx.translate(-20, -104); ctx.scale(1.2, 1.2); ctx.translate(20, 104);
  const ear = (x, y, r, c) => fig(ctx, B([[x - r, y], [x - r * 0.7, y - r * 0.72], [x, y - r], [x + r * 0.7, y - r * 0.72], [x + r, y], [x + r * 0.55, y + r * 0.2], [x + r * 0.35, y - r * 0.2], [x + r * 0.1, y + r * 0.35], [x - r * 0.7, y + r * 0.72]], 0.4), c, {
    lw: BLW, inside: () => { ell(ctx, x + r * 0.05, y + r * 0.1, r * 0.62, r * 0.58); ctx.fillStyle = P.skin; ctx.fill(); },
  });
  ear(20, -154, 18, shade(P.fur, -0.1));
  ear(-4, -160, 20, P.fur);
  const head = B([[-64, -128], [-57, -141], [-40, -152], [-16, -158], [8, -154], [22, -140], [22, -120], [10, -106], [-14, -102], [-40, -105], [-57, -115]]);
  fig(ctx, head, P.fur, { lw: BLW, crack: 32, cn: 2, inside: () => { ell(ctx, -46, -114, 20, 11, -0.15); ctx.fillStyle = P.light; ctx.fill(); } });
  // couronne
  ctx.save(); ctx.translate(-12, -155); ctx.rotate(-0.12 + a.s * 0.03);
  crown(ctx, 38, 22, P);
  if (V === 3) { flame(ctx, -12, -22, 7, a.ph); flame(ctx, 0, -26, 9, a.ph + 2); flame(ctx, 12, -22, 7, a.ph + 4); }
  ctx.restore();
  // yeux cruels + monocle
  const blink = a.f === 3;
  eye(ctx, -39, -132, 7, { ry: 8.4, skin: P.fur, inner: 1, anger: 0.5, lid: 0.28, iris: P.iris, blink });
  eye(ctx, -17, -134, 8.6, { ry: 10, skin: P.fur, inner: -1, anger: 0.35, lid: 0.18, iris: P.iris, blink });
  ell(ctx, -17, -134, 11.5, 12.5); stroke(ctx, 6.5); ell(ctx, -17, -134, 11.5, 12.5); stroke(ctx, 3, P.gold2);
  ctx.beginPath(); ctx.moveTo(-8, -124); ctx.quadraticCurveTo(0, -112, -4, -100); stroke(ctx, 2, P.gold2);
  brow(ctx, -49, -145, -32, -140, 6);
  brow(ctx, 0, -151, -24, -148, 6.6);
  // museau, sourire aux dents d'or
  blob(ctx, -65, -127, 7, P.nose, { ry: 6, rim: false, lw: 3 });
  const m = B([[-60, -116], [-46, -112], [-30, -112], [-20, -116], [-24, -106], [-40, -101], [-54, -106]]);
  fig(ctx, m, '#5a1030', { rim: false, lw: 3, glint: false, hi: 0, inside: () => { ell(ctx, -40, -101, 11, 5); ctx.fillStyle = '#ff6d8a'; ctx.fill(); } });
  for (const x of [-52, -46]) { rr(ctx, x - 2.8, -117, 5.6, 8.5, 1.6); paint(ctx, P.gold, 2); }
  fang(ctx, -27, -114.5, 6.5, 5, false, P.gold);
  fang(ctx, -36, -104, 5, 4, true, P.gold);
  ctx.beginPath(); for (const [y0, y1] of [[-124, -130], [-120, -120], [-116, -110]]) { ctx.moveTo(-56, y0); ctx.lineTo(-76, y1); } stroke(ctx, 2.4);
  blush(ctx, -28, -118, 6, 3);
  if (V === 2) drip(ctx, -24, -108, 10, a.ph);
  ctx.restore();
  // bras avant levé : sceptre-fromage en or pointé vers le héros
  ctx.save(); ctx.translate(0, -a.up * 2);
  const hx = -62, hy = -100 + a.s * 2;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.4 + a.s * 0.05);
  fig(ctx, RR(-3.8, -66, 7.6, 92, 3), P.gold2, { rim: false, lw: 3, inside: () => { ctx.fillStyle = shade(P.gold2, -0.3); for (let y = -50; y < 24; y += 13) ctx.fillRect(-4, y, 8, 3); } });
  blob(ctx, 0, 27, 5.5, P.gold2, { lw: 2.8, rim: false });
  ctx.translate(0, -66);
  glow(ctx, 0, -14, 30, V >= 2 ? EYEG : '#ffd23f', 0.5);
  const ch = PL([[-18, -2], [18, -2], [18, -18], [-18, -8]]);
  fig(ctx, ch, P.gold2, { lw: 3, rim: false, hi: 0.3, size: 15, inside: () => { ctx.fillStyle = shade(P.gold2, -0.3); for (const [x, y, r] of [[-9, -4.5, 2.6], [4, -6.5, 3.2], [12, -11, 2.2]]) { ell(ctx, x, y, r, r * 0.8); ctx.fill(); } } });
  fig(ctx, PL([[-18, -8], [18, -18], [13, -25]]), shade(P.gold2, 0.25), { lw: 3, rim: false, glint: false });
  blob(ctx, 2, -8, 5, '#ff2a48', { lw: 2.4, rim: false, hi: 0.5 });
  ctx.restore();
  limb(ctx, [[-30, -86], [-50, -80], [hx + 2, hy + 2]], 17, 15, P.fur, { lw: BLW });
  blob(ctx, hx, hy, 11, P.skin, { lw: 3.2, inside: () => { ctx.beginPath(); for (const dy of [-4, 2]) { ctx.moveTo(hx - 11, hy + dy); ctx.lineTo(hx - 4, hy + dy + 0.5); } stroke(ctx, 2.2); } });
  for (const dy of [-4, 2]) fig(ctx, RR(hx - 9, hy + dy - 2.4, 5, 4.8, 1.6), P.gold2, { rim: false, lw: 2, glint: false });
  blob(ctx, hx - 6.5, hy - 1.5, 2.2, '#3fa9ff', { lw: 1.4, rim: false, glint: false });
  ctx.restore();
  motes(ctx, a, 30, -70, -190, 150, 170, 7);
}

// =====================================================================
//  B2. Cerbère le Bouledogue — molosse à trois têtes, colliers à pics, chaînes brisées
// =====================================================================
const CERB = {
  rim: '#ff5a3a',
  fur: ['#7d80a6', 'b'], furD: ['#55587c', 'b'], light: ['#f2e4d2', 'b'], ear: ['#3e3656', 'b'], nose: ['#2a1a24', 'k'],
  collar: ['#2a2238', 'c'], stud: ['#d9def0', 'm'], chain: ['#aab2cc', 'm'], iris: ['#e8a01a', 'e'], mouth: ['#6e1730', 'k'],
};
// Tête de bouledogue (repère local, centre 0,0 ; ~60 × 48) ; open : ouverture de gueule 0..1
function bullHead(ctx, P, a, o = {}) {
  const open = o.open ?? 0;
  const lw = 3.2;
  const head = B([[-34, -2], [-32, -15], [-17, -22], [4, -23], [22, -17], [30, -4], [27, 8], [11, 15], [-11, 16], [-29, 10]]);
  fig(ctx, head, P.fur, {
    lw, crack: o.seed ?? 40, cn: 1,
    inside: () => { ctx.beginPath(); ctx.moveTo(-14, -20); ctx.quadraticCurveTo(-6, -23, 2, -20); stroke(ctx, 2.4, rgba(OUT, 0.45)); },
  });
  fig(ctx, B([[-22, -20], [-36, -21], [-43, -11], [-37, -7], [-30, -12]], 0.4), P.ear, { glint: false, rim: false, lw: 2.8 });
  fig(ctx, B([[14, -20], [28, -21], [35, -11], [30, -7], [22, -12]], 0.4), shade(P.ear, -0.1), { glint: false, rim: false, lw: 2.8 });
  const blink = o.blink;
  eye(ctx, -16, -7, 5.4, { ry: 6.2, skin: P.fur, inner: 1, anger: 0.65, lid: 0.2, iris: P.iris, blink });
  eye(ctx, 2, -8, 6.4, { ry: 7.2, skin: P.fur, inner: -1, anger: 0.65, lid: 0.2, iris: P.iris, blink });
  brow(ctx, -24, -16, -9, -11.5, 6);
  brow(ctx, 12, -18, -4, -12.5, 6.4);
  // mâchoire
  ctx.save(); ctx.translate(-10, 10); ctx.rotate(open * 0.35);
  const jaw = B([[-22, 0], [-8, 1], [10, 0], [14, -2], [12, 8], [-6, 13], [-20, 9]]);
  fig(ctx, jaw, P.light, { rim: false, lw, glint: false, inside: () => { ctx.fillStyle = P.mouth; ctx.fillRect(-26, -6, 44, 7 + open * 2); } });
  for (let i = 0; i < 5; i++) { rr(ctx, -18 + i * 6, -0.5, 4.6, 4, 1); paint(ctx, WHITE, 1.4); }
  fang(ctx, -21, 1, 9, 5.2, true); fang(ctx, 12, 0.5, 8.5, 5, true);
  ctx.restore();
  if (open > 0.3) { ell(ctx, -12, 9, 13, 3 + open * 4); ctx.fillStyle = '#ff6d8a'; ctx.fill(); }
  // bajoues + truffe
  fig(ctx, E(-20, 3, 13, 9), P.light, { rim: false, lw, glint: false });
  fig(ctx, E(1, 3, 12, 8.6), shade(P.light, -0.06), { rim: false, lw, glint: false });
  blob(ctx, -10, -2.5, 8, P.nose, { ry: 5.4, rim: false, lw: 2.6 });
  if (V === 2) drip(ctx, -10, 18, 9, a.ph + (o.seed || 0));
  if (V === 3) { flame(ctx, -8, -22, 6.5, a.ph + (o.seed || 0)); flame(ctx, 6, -23, 5.5, a.ph + 2 + (o.seed || 0), 0.2); }
  if (V === 1) for (const x of [-12, -2, 8]) spike(ctx, x, -22.5 + Math.abs(x + 2) * 0.1, -Math.PI / 2 + (x + 2) * 0.04, 9, 5.6, P.gold);
}
// Collier à pics + chaîne pendante (repère : centre du collier)
function spikedCollar(ctx, P, a, x, y, w, rot, chainLen) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // chaîne
  if (chainLen) {
    const sw = a.s * 3;
    for (let i = 0; i < chainLen; i++) {
      const t = i / chainLen;
      blob(ctx, -4 + sw * t * t, 6 + i * 7, 3.4, P.chain, { ry: 4.6, rot: (i % 2) * 1.2, rim: false, lw: 2.2, glint: false, hi: 0.3 });
    }
  }
  fig(ctx, RR(-w / 2, -5, w, 10, 4), P.collar, { rim: false, lw: 3, glint: false });
  for (let i = 0; i < 4; i++) spike(ctx, -w / 2 + w * (i + 0.5) / 4, 4, Math.PI / 2 + (i - 1.5) * 0.15, 8, 5.4, P.stud, 2);
  ctx.restore();
}
function drawCerberus(ctx, a, P) {
  const st = a.step;
  const leg = (x, top, sw, col, front) => {
    const fx = x + sw * 6, lift = (front ? a.lift === 1 : a.lift === -1) ? -5 : 0;
    limb(ctx, [[x, top], [x - 3 + sw * 3, top + 22], [fx, -9 + lift]], 28, 20, col, { lw: BLW, rim: front ? undefined : false });
    fig(ctx, B([[fx - 15, lift], [fx - 15, lift - 9], [fx - 5, lift - 14], [fx + 9, lift - 12], [fx + 11, lift - 2], [fx + 5, lift + 0.5]]), front ? P.light : shade(P.light, -0.2), { rim: false, lw: 3.2 });
    for (const dx of [-15, -10.5, -6]) { poly(ctx, [[fx + dx, lift - 2.5], [fx + dx + 3.4, lift - 2.5], [fx + dx - 1.6, lift + 1.6]]); paint(ctx, WHITE, 1.4); }
  };
  leg(56, -52, -st, P.furD, false);
  leg(-4, -52, st, P.furD, false);
  ctx.save();
  ctx.translate(0, -a.up * 2);
  squash(ctx, a, 0.8);
  // queue
  limb(ctx, [[70, -76], [80, -90], [78 + a.s * 3, -102]], 11, 7, P.fur, { lw: BLW });
  // corps massif + harnais à pics
  const body = B([[-32, -58], [-24, -92], [4, -106], [44, -100], [72, -86], [80, -60], [70, -38], [40, -30], [4, -32], [-24, -40]]);
  fig(ctx, body, P.fur, {
    lw: BLW, crack: 41,
    inside: () => {
      ell(ctx, -8, -44, 26, 14); ctx.fillStyle = P.light; ctx.fill();
      ctx.fillStyle = rgba(P.furD, 0.6); for (const [x, y] of [[30, -90], [48, -84], [60, -70], [40, -66]]) { ell(ctx, x, y, 7, 3, 0.9); ctx.fill(); }
      fig(ctx, B([[18, -110], [31, -110], [27, -24], [14, -24]], 0.2), P.collar, { rim: false, lw: 3, glint: false });
    },
  });
  for (const t of [0.15, 0.4, 0.65, 0.9]) { const p = along([[8, -106], [42, -102], [72, -88]], t); spike(ctx, p.x, p.y + 2, -Math.PI / 2 + (t - 0.5) * 0.5, 13, 8, V === 1 ? P.gold : P.stud); }
  if (V === 1) pauldron(ctx, 44, -92, 15, 0.3);
  ctx.restore();
  leg(48, -48, st * 0.8, P.fur, true);
  leg(-12, -48, -st * 0.8, P.fur, true);
  // trois têtes (de l'arrière vers l'avant)
  const hb = (k) => -a.up * 2.5 + Math.sin(a.ph + k) * 1.5;
  const blink = a.f === 3;
  ctx.save(); ctx.translate(0, -a.up * 2);
  limb(ctx, [[-2, -88], [8, -112], [16, -128 + hb(2)]], 32, 28, shade(P.fur, -0.1), { lw: BLW, rim: false });
  limb(ctx, [[-14, -80], [-26, -98], [-32, -108 + hb(1)]], 34, 30, shade(P.fur, -0.04), { lw: BLW, rim: false });
  limb(ctx, [[-20, -66], [-44, -66], [-58, -64 + hb(0)]], 34, 30, P.fur, { lw: BLW });
  ctx.restore();
  // tête arrière (aboie vers le ciel)
  ctx.save(); ctx.translate(18, -142 + hb(2) - a.up * 2); ctx.rotate(0.3); ctx.scale(1.02, 1.02);
  bullHead(ctx, P, a, { open: a.f % 2 ? 1 : 0.6, seed: 2 });
  ctx.restore();
  spikedCollar(ctx, P, a, 14, -114 + hb(2) - a.up * 2, 36, 0.5, 0);
  // tête centrale (la plus grosse)
  ctx.save(); ctx.translate(-30, -122 + hb(1) - a.up * 2); ctx.scale(1.22, 1.22);
  bullHead(ctx, P, a, { open: 0, seed: 1, blink });
  ctx.restore();
  spikedCollar(ctx, P, a, -26, -92 + hb(1) - a.up * 2, 40, 0.3, 5);
  // tête avant (grogne gueule ouverte)
  ctx.save(); ctx.translate(-74, -74 + hb(0) - a.up * 2); ctx.rotate(-0.12); ctx.scale(1.1, 1.1);
  bullHead(ctx, P, a, { open: a.f % 2 ? 0.5 : 0.9, seed: 3 });
  ctx.restore();
  spikedCollar(ctx, P, a, -50, -50 + hb(0) - a.up * 2, 34, -0.9, 5);
  motes(ctx, a, 31, -100, -180, 180, 170, 7);
}

// =====================================================================
//  B3. Crabe Titan — crabe géant portant une forteresse de sable, pinces colossales
// =====================================================================
const CTITAN = {
  rim: '#5ad8ff',
  red: ['#e8503c', 'b'], redD: ['#a82a2c', 'b'], belly: ['#ffd2a8', 'b'],
  sand: ['#f2d08a', 'c'], sandD: ['#c89a5a', 'c'], door: ['#5a3a2e', 'k'], flag: ['#ff2f4a', 'a'], pole: ['#7a4a2e', 'k'],
  shell: ['#ff9ec0', 'd'], weed: ['#3fb46a', 'k'], cannon: ['#3a3450', 'm'], iris: ['#3d2a66', 'e'],
};
function drawCrabTitan(ctx, a, P) {
  const s = a.step;
  // pattes
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const up = ((i + (side > 0 ? 1 : 0)) % 2 ? s : -s) * 4;
      const x0 = side * (24 + i * 10), y0 = -30 + i * 3;
      const kx = side * (54 + i * 9), ky = -48 + i * 5 - up;
      const tx = side * (60 + i * 10), ty = -2 - Math.max(0, up);
      limb(ctx, [[x0, y0], [kx, ky], [tx, ty]], 13, 5, side > 0 ? P.redD : shade(P.red, -0.05), { lw: 3.2, rim: side > 0 ? false : undefined });
    }
  }
  ctx.save();
  ctx.translate(0, -[0, 3, 0, 3][a.f]);
  squash(ctx, a, 0.7);
  // pince arrière
  limb(ctx, [[46, -50], [64, -58], [72, -76]], 13, 11, P.redD, { lw: BLW, rim: false });
  bigClaw(ctx, 74, -84, 1.2, 0.4, a.f % 2 ? 0.4 : 0.05, P.redD, null);
  // ----- forteresse de sable sur le dos
  ctx.save(); ctx.translate(6, -84);
  const sand = (sh, o = {}) => fig(ctx, sh, P.sand, { rim: false, lw: 3.2, glint: false, hi: 0.2, ...o });
  const crenel = (x, y, w, n) => { for (let i = 0; i < n; i++) fig(ctx, RR(x + (i * w) / n + 1, y - 7, w / n - 3, 9, 1.5), P.sand, { rim: false, lw: 2.6, glint: false }); };
  // drapeau
  const fw = a.ph;
  limb(ctx, [[2, -112], [2, -78]], 3.6, 3.6, P.pole, { rim: false, lw: 2.4 });
  const flag = B([[3, -111], [16, -114 + Math.sin(fw) * 2], [30, -110 + Math.sin(fw + 1.3) * 3], [28, -98 + Math.sin(fw + 1.6) * 3], [15, -100 + Math.sin(fw + 0.6) * 2], [3, -98]], 0.4);
  fig(ctx, flag, P.flag, { rim: false, lw: 2.6, size: 12 });
  gangBadge(ctx, 15, -105 + Math.sin(fw + 0.8) * 2, 4.6, '#fff3d6', OUT);
  if (V === 3) flame(ctx, 2, -112, 7, a.ph);
  // tours
  crenel(-50, -66, 26, 3);
  sand(RR(-50, -66, 26, 60, 3), { inside: () => { ctx.fillStyle = P.sandD; for (const y of [-50, -30]) ctx.fillRect(-52, y, 30, 2.4); } });
  fig(ctx, B([[-41, -46], [-41, -54], [-37, -58], [-33, -54], [-33, -46]], 0.3), P.door, { rim: false, lw: 2.2, glint: false, hi: 0 });
  crenel(-14, -84, 30, 3);
  sand(RR(-14, -84, 30, 80, 3), { inside: () => { ctx.fillStyle = P.sandD; for (const y of [-66, -46, -26]) ctx.fillRect(-16, y, 34, 2.4); } });
  fig(ctx, B([[-5, -62], [-5, -71], [1, -76], [7, -71], [7, -62]], 0.3), P.door, { rim: false, lw: 2.2, glint: false, hi: 0 });
  crenel(26, -56, 24, 3);
  sand(RR(26, -56, 24, 50, 3), { inside: () => { ctx.fillStyle = P.sandD; for (const y of [-40, -22]) ctx.fillRect(24, y, 28, 2.4); } });
  // rempart + porte
  crenel(-58, -26, 116, 8);
  sand(RR(-58, -26, 116, 26, 3), {
    inside: () => {
      fig(ctx, B([[-10, 2], [-10, -12], [0, -20], [10, -12], [10, 2]], 0.3), P.door, { rim: false, lw: 2.6, glint: false, hi: 0 });
      ctx.fillStyle = P.sandD; ctx.fillRect(-60, -12, 120, 2.4);
      for (const [x, y, c] of [[-40, -10, P.shell], [34, -16, P.shell], [44, -6, P.weed]]) { ell(ctx, x, y, 4, 3.4); ctx.fillStyle = c; ctx.fill(); stroke(ctx, 1.6); }
    },
  });
  // petit canon sur le rempart
  ctx.save(); ctx.translate(-50, -30); ctx.rotate(-0.25);
  fig(ctx, RR(-18, -5, 22, 10, 4), P.cannon, { rim: false, lw: 2.6, glint: false, hi: 0.3 });
  blob(ctx, -18, 0, 3, OUT, { lw: 0, rim: false, glint: false });
  ctx.restore();
  if (V === 1) for (const x of [-37, 1, 38]) spike(ctx, x, x === 1 ? -92 : x < 0 ? -74 : -64, -Math.PI / 2, 10, 6, P.gold);
  ctx.restore();
  // carapace
  const shell = B([[-64, -38], [-56, -66], [-32, -84], [0, -90], [32, -84], [56, -66], [64, -38], [52, -20], [0, -14], [-52, -20]]);
  fig(ctx, shell, P.red, {
    lw: BLW, crack: 42,
    inside: () => {
      ell(ctx, 0, -16, 56, 12); ctx.fillStyle = P.belly; ctx.fill();
      const rnd = seeded(5);
      for (let i = 0; i < 6; i++) { ell(ctx, 10 + rnd() * 44, -70 + rnd() * 30, 3 + rnd() * 2, 2.4 + rnd() * 2); fillA(ctx, '#ffb69a', 0.7); }
    },
  });
  for (const [x, y, an] of [[-62, -48, Math.PI + 0.35], [-58, -62, Math.PI + 0.7], [62, -48, -0.35]]) spike(ctx, x, y, an, 10, 7, V === 1 ? P.gold : P.red);
  // yeux pédonculés
  const blink = a.f === 3;
  for (const [x, h] of [[-44, 0], [-20, 6]]) limb(ctx, [[x + 4, -70], [x + 2, -96 - h], [x, -110 - h]], 8, 7, P.red, { rim: false, lw: 3.2 });
  eye(ctx, -44, -116, 10, { ry: 11.5, skin: P.red, inner: 1, anger: 0.65, lid: 0.15, iris: P.iris, blink });
  eye(ctx, -20, -122, 11, { ry: 12.8, skin: P.red, inner: -1, anger: 0.65, lid: 0.15, iris: P.iris, blink });
  brow(ctx, -58, -130, -38, -125, 7.5);
  brow(ctx, -4, -139, -26, -133, 8);
  // bouche
  const m = B([[-46, -44], [-30, -50], [-10, -50], [2, -44], [-10, -34], [-34, -34]]);
  fig(ctx, m, '#6e1730', { rim: false, lw: 3.2, glint: false, hi: 0, inside: () => { ell(ctx, -22, -33, 14, 6); ctx.fillStyle = '#ff6d8a'; ctx.fill(); } });
  fang(ctx, -40, -48, 7, 5.4); fang(ctx, -6, -48.5, 7, 5.4); fang(ctx, -24, -36, 5, 4, true);
  blush(ctx, -56, -44, 6, 3); blush(ctx, 10, -44, 6, 3);
  if (V === 2) { drip(ctx, -24, -32, 10, a.ph); drip(ctx, 30, -18, 8, a.ph + 2); }
  // pince géante avant levée
  limb(ctx, [[-50, -46], [-74, -56], [-86, -80]], 18, 16, P.red, { lw: BLW });
  bigClaw(ctx, -88, -94, 2, -0.35 + a.s * 0.06, a.f % 2 ? 0.5 : 0.04, P.red, null);
  ctx.restore();
  motes(ctx, a, 32, -100, -200, 190, 180, 7);
}

// Contour hirsute : échantillonne une forme lisse et ajoute des mèches pointues
function shag(pts, amp, n = 28, seed = 1) {
  const r = seeded(seed);
  const s = spline([...pts, pts[0], pts[1]], 6).slice(0, -6);
  const out = [];
  const N = s.length;
  const step = Math.max(1, Math.floor(N / n));
  let cx = 0, cy = 0; for (const p of s) { cx += p[0]; cy += p[1]; } cx /= N; cy /= N;
  for (let i = 0; i < N; i += step) {
    const p = s[i], q = s[(i + Math.floor(step / 2)) % N];
    out.push(p);
    const dx = q[0] - cx, dy = q[1] - cy, d = Math.hypot(dx, dy) || 1;
    const k = amp * (0.6 + r() * 0.6);
    out.push([q[0] + dx / d * k, q[1] + dy / d * k]);
  }
  return out;
}

// =====================================================================
//  B4. Yéti Suprême — colosse de neige : couronne de glace, poings-glaçons, écharpe déchirée
// =====================================================================
const YLORD = {
  rim: '#8fe8ff',
  fur: ['#eef4ff', 'b'], furS: ['#b8c8ec', 'b'], face: ['#5b8ee8', 'd'], faceL: ['#9cc2ff', 'd'],
  ice: ['#9ff0ff', 'g'], iceD: ['#4ab8e8', 'g'], scarf: ['#e8334a', 'a'], scarf2: ['#fff4f0', 'c'], iris: ['#2a4ab0', 'e'], mouth: ['#3a1a4a', 'k'],
};
function iceFist(ctx, P, x, y, r, rot, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  for (const [ang, len] of [[-2.2, 1.0], [-1.6, 1.3], [-1.0, 1.05], [-0.4, 0.8]]) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    fig(ctx, PL([[dx * r * 0.7 - dy * 4, dy * r * 0.7 + dx * 4], [dx * r * (1.2 + len * 0.9), dy * r * (1.2 + len * 0.9)], [dx * r * 0.7 + dy * 4, dy * r * 0.7 - dx * 4]]), P.ice, { rim: false, lw: 2.6, glint: false, hi: 0.4, size: 6 });
  }
  glow(ctx, 0, 0, r * 2, P.ice, 0.35);
  fig(ctx, PL([[-r, -r * 0.6], [-r * 0.4, -r * 1.05], [r * 0.7, -r * 0.9], [r * 1.05, -r * 0.1], [r * 0.7, r * 0.9], [-r * 0.5, r], [-r * 1.05, r * 0.2]]), P.iceD, {
    rim: false, lw: 3.2, hi: 0.35, size: r,
    inside: () => { ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.2, r * 0.4); ctx.moveTo(r * 0.3, -r * 0.7); ctx.lineTo(r * 0.6, r * 0.2); stroke(ctx, 2.2, rgba('#ffffff', 0.7)); },
  });
  ctx.restore();
}
function drawYetiLord(ctx, a, P) {
  const st = a.step;
  // flocons
  for (let i = 0; i < 4; i++) { const ph = (a.f / 4 + i * 0.25) % 1; sparkle(ctx, -70 + i * 45 + Math.sin(ph * 6) * 4, -200 + ph * 60 + (i % 2) * 30, 3.5, rgba('#ffffff', 0.9)); }
  // pieds
  const foot = (x, y, c) => fig(ctx, B([[x - 18, y], [x - 18, y - 9], [x - 6, y - 15], [x + 10, y - 14], [x + 13, y - 3], [x + 6, y + 0.5]]), c, { rim: false, lw: 3.2 });
  foot(26 - st * 5, a.lift === -1 ? -6 : 0, shade(P.face, -0.2));
  foot(-24 + st * 5, a.lift === 1 ? -6 : 0, P.face);
  ctx.save();
  ctx.translate(0, -a.up * 3);
  squash(ctx, a, 0.8);
  // bras arrière (poing de glace au sol)
  limb(ctx, [[40, -140], [64, -104], [66, -52]], 34, 28, P.furS, { lw: BLW, rim: false });
  iceFist(ctx, P, 66 - st * 2, -40, 18, 0.4, a);
  // corps hirsute
  const bodyPts = shag([[-50, -120], [-34, -170], [0, -186], [40, -170], [62, -120], [58, -60], [40, -26], [0, -18], [-40, -26], [-58, -64]], 9, 30, 4);
  const body = PL(bodyPts);
  fig(ctx, body, P.fur, {
    lw: BLW, crack: 50, size: 70,
    inside: () => {
      ctx.fillStyle = rgba(P.furS, 0.9);
      smooth(ctx, [[20, -170], [64, -120], [60, -40], [20, -20], [40, -80]]); ctx.fill();
    },
  });
  // boutons de charbon (clin d'œil aux bonshommes de neige du gang)
  for (const [x, y] of [[-14, -112], [-10, -86], [-8, -60]]) blob(ctx, x, y, 6, '#2e2638', { lw: 2.4, rim: false });
  // écharpe déchirée
  const w = a.ph;
  limb(ctx, [[22, -150], [46, -150 + Math.sin(w) * 3], [68, -142 + Math.sin(w + 1.3) * 5], [86, -150 + Math.sin(w + 2.5) * 6]], 16, 10, shade(P.scarf, -0.12), { lw: 3.2 });
  limb(ctx, [[-40, -146], [-10, -140], [26, -150]], 18, 18, P.scarf, { lw: 3.2, inside: () => { ctx.fillStyle = P.scarf2; for (let x = -36; x < 30; x += 14) ctx.fillRect(x, -160, 5, 30); } });
  if (V === 1) { pauldron(ctx, 36, -158, 18, 0.4); pauldron(ctx, -40, -154, 16, -0.5); }
  ctx.restore();
  // ----- tête
  ctx.save();
  ctx.translate(0, -a.up * 4);
  squash(ctx, a, 0.5);
  const headPts = shag([[-62, -170], [-52, -200], [-24, -214], [8, -210], [24, -190], [22, -160], [0, -146], [-36, -146]], 6, 20, 9);
  fig(ctx, PL(headPts), P.fur, { lw: BLW, size: 40, cx: -18, cy: -180 });
  // couronne de glace
  ctx.save(); ctx.translate(-18, -206);
  glow(ctx, 0, -14, 42, P.ice, 0.5);
  for (const [x, h, sw] of [[-26, 18, 7], [-13, 28, 8], [0, 38, 9], [13, 28, 8], [26, 18, 7]]) {
    fig(ctx, PL([[x - sw, 2], [x - sw * 0.3, -h * 0.75], [x, -h], [x + sw * 0.4, -h * 0.7], [x + sw, 2]]), P.ice, { rim: false, lw: 2.8, hi: 0.45, size: 10, cx: x, cy: -h / 2, inside: () => { ctx.beginPath(); ctx.moveTo(x - sw * 0.3, -2); ctx.lineTo(x - sw * 0.1, -h * 0.7); stroke(ctx, 2, rgba('#ffffff', 0.8)); } });
  }
  fig(ctx, RR(-34, -4, 68, 10, 4), P.iceD, { rim: false, lw: 3, glint: false, hi: 0.35 });
  blob(ctx, 0, 1, 4.6, V === 1 ? '#ff2a48' : '#ffffff', { lw: 2.2, rim: false, hi: 0.5 });
  ctx.restore();
  // visage bleu (agrandi)
  ctx.translate(-34, -150); ctx.scale(1.22, 1.22); ctx.translate(34, 150);
  const face = B([[-66, -170], [-60, -188], [-40, -196], [-14, -192], [4, -180], [2, -160], [-16, -150], [-50, -152]], 0.5);
  fig(ctx, face, P.face, { lw: 3.2, inside: () => { ell(ctx, -42, -160, 20, 9); ctx.fillStyle = P.faceL; ctx.fill(); } });
  const blink = a.f === 3;
  eye(ctx, -46, -177, 7.4, { ry: 8.6, skin: P.face, inner: 1, anger: 0.7, lid: 0.15, iris: P.iris, blink });
  eye(ctx, -22, -178, 8.6, { ry: 10, skin: P.face, inner: -1, anger: 0.7, lid: 0.15, iris: P.iris, blink });
  brow(ctx, -60, -190, -38, -183, 8, P.furS);
  brow(ctx, -6, -193, -30, -185, 8.6, P.furS);
  blob(ctx, -36, -166, 6, '#2a3a7a', { ry: 4, rim: false, lw: 2.4 });
  const m = B([[-58, -160], [-44, -156], [-26, -156], [-12, -161], [-18, -148], [-36, -143], [-52, -148]]);
  fig(ctx, m, P.mouth, { rim: false, lw: 3, glint: false, hi: 0, inside: () => { ell(ctx, -35, -144, 13, 5); ctx.fillStyle = '#ff6d8a'; ctx.fill(); } });
  fang(ctx, -52, -147, 11, 6, true); fang(ctx, -18, -148, 11, 6, true);
  fang(ctx, -42, -157, 6, 4.4); fang(ctx, -28, -157, 6, 4.4);
  if (V === 2) drip(ctx, -35, -142, 10, a.ph);
  if (V === 3) { flame(ctx, 2, -196, 8, a.ph, 0.2); flame(ctx, 14, -184, 6.5, a.ph + 2, 0.3); }
  ctx.restore();
  // bras avant levé (poing de glace)
  ctx.save(); ctx.translate(0, -a.up * 3);
  const fx = -86 + st * 2, fy = -96 - a.up * 3 + a.s * 2;
  limb(ctx, [[-30, -128], [-60, -120], [fx + 6, fy]], 36, 30, P.fur, { lw: BLW });
  iceFist(ctx, P, fx, fy, 21, -0.9, a);
  ctx.restore();
  motes(ctx, a, 33, -100, -230, 190, 200, 7);
}

// =====================================================================
//  B5. Aspirateur Suprême — méca-aspirateur sur chenilles : pinces, tuyau-dard, visière rouge
// =====================================================================
const VPRIME = {
  rim: '#46e8ff',
  shell: ['#c9cfee', 'b'], shellD: ['#8d94c0', 'b'], top: ['#5b4ab8', 'c'], tread: ['#2a2540', 'k'], wheel: ['#6c74a6', 'm'],
  hose: ['#5b4ab8', 'c'], hoseD: ['#3a2c7a', 'c'], warn: ['#ffcc2a', 'a'], brush: ['#ff3d5a', 'a'], brush2: ['#ffb02e', 'a'],
  led: ['#ff2a48', 'e'], joint: ['#3a3450', 'm'], claw: ['#d9def0', 'm'], tank: ['#bff4ff', 'k'], dust: ['#cbbfae', 'k'],
};
function mechClaw(ctx, P, x, y, s, rot, open) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.rotate(sg * (0.35 + open * 0.45));
    fig(ctx, PL([[-3, 0], [3, 0], [4, -16], [-2, -26], [-6, -22], [-2, -14]].map(([px, py]) => [px * sg, py])), P.claw, { rim: false, lw: 2.8, hi: 0.3, size: 9 });
    ctx.restore();
  }
  fig(ctx, PL([[-3, 0], [3, 0], [3, -22], [0, -27], [-3, -22]]), shade(P.claw, -0.1), { rim: false, lw: 2.6, glint: false, size: 7 });
  blob(ctx, 0, 0, 7, P.joint, { lw: 2.8, rim: false });
  ctx.restore();
}
function drawVacuumPrime(ctx, a, P) {
  // fumée d'échappement
  for (let i = 0; i < 3; i++) { const ph = (a.f / 4 + i / 3) % 1; ell(ctx, 52 + ph * 16, -150 - ph * 26, 5 + ph * 6, 5 + ph * 6); ctx.save(); ctx.globalAlpha = 0.75 * (1 - ph); paint(ctx, '#d8d4e8', 2); ctx.restore(); }
  // chenilles
  const tr = RR(-62, -32, 120, 32, 16);
  fig(ctx, tr, P.tread, {
    rim: false, lw: BLW,
    inside: () => {
      ctx.fillStyle = shade(P.tread, 0.25);
      for (let i = 0; i < 16; i++) { const x = -60 + ((i * 8 + a.f * 2) % 124); ctx.fillRect(x, -32, 3.5, 5); ctx.fillRect(x, -5, 3.5, 5); }
    },
  });
  for (const x of [-44, -16, 12, 40]) {
    blob(ctx, x, -16, 10, P.wheel, { lw: 2.8, rim: false });
    ctx.save(); ctx.translate(x, -16); ctx.rotate(-a.f * Math.PI / 4); ctx.fillStyle = OUT; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-1.4, 2, 2.8, 6); } ctx.restore();
    blob(ctx, x, -16, 3.4, P.joint, { lw: 2, rim: false, glint: false });
  }
  ctx.save();
  ctx.translate(0, -[0, 2, 0, 2][a.f]);
  // réservoir à poussière + pots d'échappement
  for (const x of [36, 48]) fig(ctx, RR(x, -160, 9, 40, 3), P.joint, { rim: false, lw: 3, glint: false });
  const tank = RR(30, -128, 34, 70, 14);
  tank(ctx); ctx.fillStyle = rgba(P.tank, 0.4); ctx.fill();
  clip(ctx, tank, () => {
    ctx.fillStyle = P.dust; ell(ctx, 47, -64, 20, 14); ctx.fill();
    for (let i = 0; i < 4; i++) { const t = a.ph + i * 1.6; ell(ctx, 47 + Math.cos(t) * 9, -92 + Math.sin(t) * 14 + i * 4, 3, 3); ctx.fill(); }
    ell(ctx, 38, -110, 3, 12); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  });
  tank(ctx); stroke(ctx, 3.2);
  // bras arrière levé
  limb(ctx, [[30, -112], [52, -134], [60, -158]], 13, 11, P.shellD, { lw: 3.2, rim: false });
  blob(ctx, 52, -134, 7, P.joint, { lw: 2.6, rim: false });
  mechClaw(ctx, P, 62, -164, 1.1, 0.4, a.f % 2 ? 0.8 : 0.3);
  // corps-bidon
  const body = B([[-48, -36], [-50, -90], [-44, -118], [0, -128], [44, -118], [50, -90], [48, -36], [0, -28]], 0.4);
  fig(ctx, body, P.shell, {
    lw: BLW, crack: 51, size: 50,
    inside: () => {
      ctx.save(); ctx.beginPath(); ctx.rect(-60, -54, 120, 14); ctx.clip();
      ctx.fillStyle = P.warn; ctx.fillRect(-60, -54, 120, 14);
      ctx.fillStyle = OUT; for (let x = -70; x < 70; x += 14) { poly(ctx, [[x, -40], [x + 7, -40], [x + 21, -54], [x + 14, -54]]); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-60, -54); ctx.lineTo(60, -54); ctx.moveTo(-60, -40); ctx.lineTo(60, -40); stroke(ctx, 2.6);
      ctx.fillStyle = shade(P.shell, -0.3); for (const [x, y] of [[-40, -100], [40, -100], [-40, -66], [40, -66]]) { ell(ctx, x, y, 2.4, 2.4); ctx.fill(); }
    },
  });
  gangBadge(ctx, 18, -82, 12, '#fff3d6', '#3a2c4c');
  if (V === 1) { pauldron(ctx, -40, -116, 15, -0.4); pauldron(ctx, 40, -118, 15, 0.4); for (const x of [-40, -24, 24, 40]) spike(ctx, x, -32, Math.PI / 2 + (x < 0 ? 0.4 : -0.4), 10, 6, P.gold); }
  // tête-dôme + visière
  const head = B([[-44, -120], [-40, -146], [-20, -160], [8, -162], [30, -150], [38, -126], [0, -116]], 0.45);
  fig(ctx, head, P.top, { lw: BLW, size: 30, crack: 52, cn: 1 });
  const vis = RR(-46, -150, 52, 20, 8);
  fig(ctx, vis, '#191230', {
    rim: false, lw: 3.2, glint: false, hi: 0.08,
    inside: () => {
      const L = P.led;
      glow(ctx, -20, -140, 30, L, 0.45);
      ctx.fillStyle = L;
      if (a.f === 3) { ctx.fillRect(-38, -142, 14, 3.4); ctx.fillRect(-16, -142, 14, 3.4); }
      else {
        poly(ctx, [[-40, -147], [-24, -141], [-24, -135], [-40, -138]]); ctx.fill();
        poly(ctx, [[-2, -147], [-18, -141], [-18, -135], [-2, -138]]); ctx.fill();
        ctx.fillStyle = mix(L, '#ffffff', 0.75);
        poly(ctx, [[-37, -143.5], [-27, -140], [-27, -138.6], [-37, -141]]); ctx.fill();
        poly(ctx, [[-5, -143.5], [-15, -140], [-15, -138.6], [-5, -141]]); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let y = -150; y < -130; y += 2.6) ctx.fillRect(-48, y, 56, 1);
    },
  });
  // grille-bouche à dents
  fig(ctx, RR(-40, -128, 36, 9, 3), P.joint, { rim: false, lw: 2.8, glint: false, inside: () => { ctx.fillStyle = WHITE; for (let i = 0; i < 6; i++) { poly(ctx, [[-38 + i * 6, -128], [-33 + i * 6, -128], [-35.5 + i * 6, -122]]); ctx.fill(); } } });
  // crête-brosse
  fig(ctx, RR(-20, -170, 36, 11, 4), P.tread, { rim: false, lw: 3, glint: false });
  if (V === 3) { for (let i = 0; i < 4; i++) flame(ctx, -14 + i * 10, -168, 9, a.ph + i * 1.5, -0.1); }
  else {
    for (let i = 0; i < 9; i++) {
      const t = i / 8, x = -17 + t * 30, h = 18 + Math.sin(t * Math.PI) * 12, sw = Math.sin(a.ph + t * 2.5) * 3;
      limb(ctx, [[x, -166], [x - 3 + sw * 0.5, -166 - h * 0.6], [x - 6 + sw, -166 - h]], 7, 3.4, i % 2 ? P.brush2 : P.brush, { lw: 2.6, rim: false });
    }
  }
  // tuyau-dard au-dessus de la tête, buse pointée vers le héros
  const hp = [[40, -60], [80, -96], [70, -168], [20, -196], [-40, -184], [-74, -150]];
  const hs = hp.map(([x, y], i) => [x, y + (i > 2 ? a.s * 3 : 0)]);
  limb(ctx, hs, 18, 16, P.hose, {
    lw: BLW,
    inside: () => { ctx.strokeStyle = P.hoseD; ctx.lineWidth = 3; for (let i = 1; i < 16; i++) { const p = along(hs, i / 16); ctx.beginPath(); ctx.moveTo(p.x - p.ty * 10, p.y + p.tx * 10); ctx.lineTo(p.x + p.ty * 10, p.y - p.tx * 10); ctx.stroke(); } },
  });
  const tip = hs[hs.length - 1];
  ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(-2.4);
  fig(ctx, PL([[-12, -4], [12, -4], [16, 14], [-16, 14]]), P.shellD, { rim: false, lw: 3.2, hi: 0.3, size: 14 });
  glow(ctx, 0, 18, 22, P.led, a.f % 2 ? 0.7 : 0.45);
  fig(ctx, RR(-17, 12, 34, 6, 2), P.joint, { rim: false, lw: 2.6, glint: false });
  ctx.restore();
  // bras avant tendu (pince ouverte)
  limb(ctx, [[-36, -100], [-62, -96], [-80, -78]], 15, 13, P.shellD, { lw: 3.2 });
  blob(ctx, -62, -96, 8, P.joint, { lw: 2.6, rim: false });
  mechClaw(ctx, P, -84, -72, 1.25, -2.3, a.f % 2 ? 0.25 : 0.85);
  if (V === 2) { drip(ctx, -30, -30, 9, a.ph); drip(ctx, 26, -30, 7, a.ph + 2); }
  ctx.restore();
  motes(ctx, a, 34, -90, -220, 180, 200, 7);
}

// =====================================================================
//  B6. Roi Magma — slime de lave géant : couronne de feu, rochers en orbite, croûte d'obsidienne
// =====================================================================
const MAGMA = {
  rim: '#ffe24a',
  lava: ['#ff6a1a', 'b'], hot: ['#ffd23a', 'd'], crust: ['#3a1e2a', 'k'], vein: ['#ffb02e', 'g'],
  gold2: ['#ffc83a', 'm'], rock: ['#5a3a44', 'k'], iris: ['#7a1a10', 'e'],
};
function drawMagmaKing(ctx, a, P) {
  const [sx, sy] = [[1.06, 0.95], [0.97, 1.04], [1.04, 0.97], [0.98, 1.03]][a.f];
  // rochers en orbite (arrière)
  const rocks = [[-96, -150, 0], [98, -150, 1], [108, -70, 2]].map(([x, y, i]) => ({ x, y: y + Math.sin(a.ph + i * 2) * 6, z: i === 2 ? 1 : -1, i }));
  const rock = (r) => {
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.i + a.ph * 0.5);
    glow(ctx, 0, 0, 22, P.vein, 0.4);
    fig(ctx, PL([[-11, -4], [-5, -11], [6, -10], [12, -2], [8, 9], [-4, 10], [-11, 4]]), P.rock, { rim: P.vein, lw: 3, size: 11, inside: () => { ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(1, 1); ctx.lineTo(4, -5); stroke(ctx, 2, P.vein); } });
    ctx.restore();
  };
  rocks.filter((r) => r.z < 0).forEach(rock);
  ctx.save();
  ctx.scale(sx, sy);
  // poing arrière
  limb(ctx, [[54, -70], [76, -84], [84, -108 + a.s * 3]], 24, 20, shade(P.lava, -0.12), { lw: BLW, rim: false });
  blob(ctx, 86, -114 + a.s * 3, 14, shade(P.lava, -0.08), { lw: 3.2, rim: false });
  // corps
  const body = B([[-70, -6], [-74, -50], [-62, -100], [-36, -136], [0, -150], [36, -138], [62, -104], [74, -54], [72, -8], [40, 0], [0, 2], [-40, 0]]);
  fig(ctx, body, P.lava, {
    lw: BLW, crack: 53, cn: 4, size: 70,
    inside: () => {
      ell(ctx, -10, -10, 60, 14); ctx.fillStyle = rgba(P.hot, 0.55); ctx.fill();
      // plaques d'obsidienne + veines de lave
      for (const [x, y, r] of [[44, -116, 15], [56, -66, 14], [44, -24, 12], [-60, -34, 12], [-30, -134, 9]]) {
        fig(ctx, B([[x - r, y], [x - r * 0.4, y - r * 0.9], [x + r * 0.7, y - r * 0.7], [x + r, y + r * 0.2], [x + r * 0.2, y + r * 0.8], [x - r * 0.7, y + r * 0.6]], 0.4), P.crust, { rim: rgba(P.vein, 0.9), rw: 1.6, lw: 3, glint: false, hi: 0.15 });
      }
      for (const [x, y, r] of [[-56, -100, 4], [24, -70, 3], [-60, -66, 2.6], [10, -30, 3]]) { ell(ctx, x, y, r, r); ctx.fillStyle = P.hot; ctx.fill(); }
    },
  });
  // couronne de feu
  ctx.save(); ctx.translate(-6, -144); ctx.rotate(-0.06);
  for (const [x, sz, k] of [[-18, 14, 0], [0, 20, 1], [18, 14, 2]]) flame(ctx, x, -14, sz, a.ph + k * 2);
  crown(ctx, 54, 26, PAL, ['#ff2a48', '#ffb02e', '#ff2a48']);
  ctx.restore();
  // visage
  const blink = a.f === 3;
  eye(ctx, -36, -96, 12, { ry: 13.5, skin: P.lava, inner: 1, anger: 0.7, lid: 0.15, iris: P.iris, blink });
  eye(ctx, -2, -98, 13.5, { ry: 15.5, skin: P.lava, inner: -1, anger: 0.7, lid: 0.15, iris: P.iris, blink });
  brow(ctx, -56, -116, -28, -108, 9);
  brow(ctx, 20, -122, -10, -112, 9.6);
  const m = B([[-60, -68], [-40, -62], [-12, -62], [8, -68], [0, -44], [-26, -36], [-50, -44]]);
  fig(ctx, m, '#4a0a14', { rim: false, lw: 3.4, glint: false, hi: 0, inside: () => { ell(ctx, -26, -38, 18, 8); ctx.fillStyle = '#ff6d4a'; ctx.fill(); } });
  for (let i = 0; i < 5; i++) { const x = -54 + i * 13; fang(ctx, x, -66 + Math.abs(i - 2) * 0.6, 8, 6.4); }
  fang(ctx, -42, -42, 6, 5, true); fang(ctx, -12, -42, 6, 5, true);
  if (V === 1) { pauldron(ctx, 50, -110, 18, 0.6); pauldron(ctx, -56, -104, 16, -0.6); }
  drip(ctx, -26, -38, 10, a.ph, V === 2 ? PAL.goo : P.hot);
  // poing avant levé
  const fx = -88, fy = -104 + a.s * 3;
  limb(ctx, [[-56, -60], [-80, -74], [fx + 2, fy + 8]], 26, 22, P.lava, { lw: BLW });
  blob(ctx, fx, fy, 15, P.lava, { lw: 3.2, inside: () => { ctx.beginPath(); for (const dy of [-5, 2]) { ctx.moveTo(fx - 15, fy + dy); ctx.lineTo(fx - 6, fy + dy + 0.5); } stroke(ctx, 2.6); } });
  ctx.restore();
  rocks.filter((r) => r.z >= 0).forEach(rock);
  // braises
  for (let i = 0; i < 4; i++) { const ph = (a.f / 4 + i * 0.25) % 1; const x = -50 + i * 34, y = -150 - ph * 30; glow(ctx, x, y, 8, '#ff7a1a', 0.7 * (1 - ph)); ell(ctx, x, y, 2.2, 2.2); ctx.fillStyle = '#ffd27a'; ctx.fill(); }
  motes(ctx, a, 35, -100, -200, 200, 190, 6);
}

// =====================================================================
//  B7. Empereur Martien — souris impériale aux commandes d'une soucoupe-méca à tentacules
// =====================================================================
const MARTIAN = {
  rim: '#ff5ad8',
  skin: ['#8fe36a', 'b'], skinL: ['#d4f7b0', 'b'], ear: ['#ff9ec0', 'd'], tent: ['#7a5ad8', 'b'], tentL: ['#c6b2ff', 'b'],
  hull: ['#b8bfe0', 'm'], hullD: ['#6c74a6', 'm'], band: ['#5b3ab8', 'c'], cape: ['#7a1a8a', 'c'], capeIn: ['#ff5ad8', 'a'],
  gold2: ['#ffc83a', 'm'], light1: ['#ffe24a', 'g'], light2: ['#46e8ff', 'g'], ray: ['#ff4fd8', 'g'], iris: ['#c2187a', 'e'],
};
function drawMartianEmperor(ctx, a, P) {
  const hov = [0, -3, -5, -3][a.f];
  // tentacules
  const tent = (x0, dir, ph, col, front) => {
    const sw = Math.sin(a.ph + ph);
    const pts = [[x0, -80 + hov], [x0 + dir * 10, -56], [x0 + dir * 18 + sw * 8, -30], [x0 + dir * 30 + sw * 10, -6 - Math.max(0, sw) * 6], [x0 + dir * 42 + sw * 8, -12 - Math.max(0, sw) * 6]];
    limb(ctx, pts, 22, 7, col, { lw: BLW, rim: front ? undefined : false, inside: () => { ctx.fillStyle = P.tentL; for (let i = 1; i < 5; i++) { const p = along(pts, i / 6 + 0.05); ell(ctx, p.x + p.ty * 4 * dir, p.y - p.tx * 4 * dir, 3 - i * 0.3, 3 - i * 0.3); ctx.fill(); } } });
  };
  tent(26, 1, 2, shade(P.tent, -0.15), false);
  tent(-20, -1, 0, shade(P.tent, -0.15), false);
  tent(42, 1, 3.5, P.tent, true);
  tent(-40, -1, 1.5, P.tent, true);
  ctx.save();
  ctx.translate(0, hov + 16);
  const big = () => { ctx.translate(0, -118); ctx.scale(1.28, 1.28); ctx.translate(0, 118); };
  ctx.save(); big();
  // cape impériale (derrière)
  const cs = a.s * 3;
  fig(ctx, B([[-30, -152], [0, -176], [34, -170], [48 + cs, -132], [40, -118], [-36, -118]], 0.45), P.cape, { lw: BLW, inside: () => { ctx.fillStyle = P.capeIn; smooth(ctx, [[-20, -150], [10, -168], [30, -160], [36 + cs, -132], [20, -124], [-20, -124]]); ctx.fill(); } });
  // coque
  const hull = B([[-72, -104], [-54, -90], [0, -84], [54, -90], [72, -104], [52, -116], [-52, -116]], 0.45);
  fig(ctx, hull, P.hullD, { lw: BLW, crack: 54, size: 50, inside: () => { ell(ctx, 0, -86, 16, 5); ctx.fillStyle = P.light2; ctx.fill(); } });
  // empereur : corps + tête
  fig(ctx, B([[-22, -120], [-20, -146], [0, -154], [20, -146], [22, -120]], 0.4), P.cape, { lw: 3.2, inside: () => { ctx.fillStyle = P.gold2; ctx.fillRect(-3, -156, 6, 40); for (const y of [-144, -134]) { ell(ctx, 0, y, 3.4, 3.4); ctx.fill(); } } });
  const ear = (x, y, r, c) => fig(ctx, E(x, y, r, r * 0.95), c, { lw: 3.2, inside: () => { ell(ctx, x + r * 0.05, y + r * 0.1, r * 0.62, r * 0.58); ctx.fillStyle = P.ear; ctx.fill(); } });
  ear(20, -188, 14, shade(P.skin, -0.1));
  // col haut impérial
  fig(ctx, PL([[-30, -150], [-40, -186], [-24, -168], [-14, -154]]), P.capeIn, { rim: false, lw: 3, glint: false });
  fig(ctx, PL([[30, -150], [42, -190], [26, -170], [14, -154]]), shade(P.capeIn, -0.15), { rim: false, lw: 3, glint: false });
  fig(ctx, E(-2, -170, 24, 21), P.skin, { lw: BLW, crack: 55, cn: 1, inside: () => { ell(ctx, -14, -160, 13, 8, -0.2); ctx.fillStyle = P.skinL; ctx.fill(); } });
  ear(-16, -192, 15, P.skin);
  // couronne haute à antennes
  ctx.save(); ctx.translate(-2, -188);
  for (const [x, h] of [[-12, 26], [0, 34], [12, 26]]) { limb(ctx, [[x, 0], [x * 1.1, -h]], 3, 2.4, P.gold2, { rim: false, lw: 2.2 }); glow(ctx, x * 1.1, -h - 2, 10, P.ray, 0.8); blob(ctx, x * 1.1, -h - 2, 4, P.ray, { lw: 2.2, rim: false }); }
  crown(ctx, 30, 16, PAL, ['#ff4fd8', '#46e8ff', '#ff4fd8']);
  ctx.restore();
  const blink = a.f === 3;
  eye(ctx, -14, -172, 7, { ry: 8.4, skin: P.skin, inner: 1, anger: 0.55, lid: 0.25, iris: P.iris, blink });
  eye(ctx, 4, -173, 8.2, { ry: 9.8, skin: P.skin, inner: -1, anger: 0.55, lid: 0.25, iris: P.iris, blink });
  brow(ctx, -24, -184, -8, -180, 5.4);
  brow(ctx, 16, -186, -1, -181.5, 5.6);
  blob(ctx, -26, -163, 4.6, P.ear, { rim: false, lw: 2.4 });
  ctx.beginPath(); ctx.moveTo(-24, -156); ctx.quadraticCurveTo(-14, -151, -2, -156); ctx.quadraticCurveTo(0, -158, 1, -160); stroke(ctx, 2.8);
  fang(ctx, -17, -154.4, 4.6, 3.6); fang(ctx, -8, -154, 4.6, 3.6);
  ctx.restore();
  // anneau de cockpit + lumières
  const ring = B([[-76, -106], [-66, -118], [0, -124], [66, -118], [76, -106], [66, -96], [0, -92], [-66, -96]], 0.45);
  fig(ctx, ring, P.hull, {
    lw: BLW, size: 50,
    inside: () => {
      ctx.fillStyle = P.band; ctx.fillRect(-80, -109, 160, 9);
      for (let i = 0; i < 9; i++) {
        const x = -60 + i * 15, on = (i + a.f) % 3 === 0, c = i % 2 ? P.light1 : P.light2;
        if (on) glow(ctx, x, -104.5, 12, c, 0.9);
        ell(ctx, x, -104.5, 4, 3.4); ctx.fillStyle = on ? mix(c, '#ffffff', 0.5) : shade(c, -0.35); ctx.fill(); stroke(ctx, 1.6);
      }
    },
  });
  fig(ctx, B([[-34, -122], [-26, -130], [26, -130], [34, -122], [0, -118]], 0.4), P.hullD, { rim: false, lw: 3 });
  if (V === 1) for (const x of [-56, -34, 34, 56]) spike(ctx, x, -118 + Math.abs(x) * 0.05, -Math.PI / 2 + x * 0.008, 12, 7, P.gold);
  // canons à rayons
  for (const [y, s] of [[-100, 1], [-90, 0.8]]) {
    ctx.save(); ctx.translate(-66, y); ctx.scale(s, s);
    fig(ctx, RR(-22, -6, 26, 12, 4), P.hullD, { rim: false, lw: 3, glint: false });
    fig(ctx, RR(-30, -4, 10, 8, 3), P.band, { rim: false, lw: 2.6, glint: false });
    glow(ctx, -31, 0, 16, P.ray, a.f % 2 ? 0.95 : 0.6);
    blob(ctx, -31, 0, 4, mix(P.ray, '#ffffff', 0.4), { lw: 2, rim: false });
    ctx.restore();
  }
  // sceptre à orbe (main avant)
  ctx.save(); big();
  const hx = -34, hy = -136 + a.s * 2;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.3);
  fig(ctx, RR(-3, -44, 6, 56, 2.5), P.gold2, { rim: false, lw: 2.6, glint: false });
  glow(ctx, 0, -52, 24, P.ray, 0.75);
  blob(ctx, 0, -52, 9, P.ray, { lw: 2.8, rim: false, hi: 0.45 });
  ctx.restore();
  limb(ctx, [[-18, -142], [-28, -134], [hx + 2, hy + 1]], 9, 8, P.cape, { lw: 3, rim: false });
  blob(ctx, hx, hy, 6.5, P.skin, { lw: 2.8, rim: false });
  ctx.restore();
  if (V === 3) { flame(ctx, 60, -114, 8, a.ph, 0.4); flame(ctx, -50, -116, 7, a.ph + 2, -0.3); }
  if (V === 2) { drip(ctx, -30, -88, 9, a.ph); drip(ctx, 34, -88, 7, a.ph + 2); }
  ctx.restore();
  motes(ctx, a, 36, -100, -230, 190, 220, 7);
}

// =====================================================================
//  Registre, mesure automatique des bornes et cache
// =====================================================================
// box : zone de mesure large [x0, y0, w, h] (unités de dessin, avant échelle k)
// k   : échelle appliquée au dessin pour respecter la hauteur de jeu
const DEFS = {
  rat: { box: [-90, -140, 180, 160], k: 0.76, pal: RAT, draw: drawRat },
  dog: { box: [-100, -150, 190, 170], k: 0.815, pal: DOG, draw: drawDog },
  vacuum: { box: [-100, -130, 200, 150], k: 0.885, pal: VAC, draw: drawVacuum },
  cucumber: { box: [-90, -160, 190, 180], k: 1.02, pal: CUC, draw: drawCucumber },
  pigeon: { box: [-90, -150, 180, 170], k: 0.785, pal: PIG, draw: drawPigeon },
  crab: { box: [-120, -140, 240, 160], k: 0.825, pal: CRAB, draw: drawCrab },
  wasp: { box: [-100, -190, 210, 180], k: 0.865, pal: WASP, draw: drawWasp },
  mole: { box: [-100, -150, 190, 170], k: 0.87, pal: MOLE, draw: drawMole },
  yeti: { box: [-100, -170, 200, 190], k: 0.99, pal: YETI, draw: drawYeti },
  robodog: { box: [-100, -170, 200, 190], k: 0.815, pal: ROBO, draw: drawRobodog },
  slime: { box: [-110, -140, 220, 160], k: 0.91, pal: SLIME, draw: drawSlime },
  ufo: { box: [-110, -160, 220, 180], k: 0.835, pal: UFO, draw: drawUfo },
  ghost: { box: [-100, -170, 200, 190], k: 0.82, pal: GHOST, draw: drawGhost },
  knightrat: { box: [-100, -160, 200, 180], k: 0.95, pal: KNIGHT, draw: drawKnightRat },
};
const BOSS_DEFS = {
  ratKing: { box: [-130, -230, 260, 250], k: 0.86, pal: RATKING, draw: drawRatKing },
  cerberus: { box: [-140, -230, 260, 250], k: 1.0, pal: CERB, draw: drawCerberus },
  crabTitan: { box: [-170, -250, 300, 270], k: 0.97, pal: CTITAN, draw: drawCrabTitan },
  yetiLord: { box: [-160, -290, 300, 310], k: 0.86, pal: YLORD, draw: drawYetiLord },
  vacuumPrime: { box: [-160, -270, 300, 290], k: 0.9, pal: VPRIME, draw: drawVacuumPrime },
  magmaKing: { box: [-170, -260, 340, 280], k: 0.98, pal: MAGMA, draw: drawMagmaKing },
  martianEmperor: { box: [-170, -290, 320, 310], k: 0.84, pal: MARTIAN, draw: drawMartianEmperor },
};

function render(def, frame, variant) {
  const P = pal(def.pal, variant);
  const a = anim(frame);
  return (ctx) => {
    V = variant; PAL = P; RIM = P.rim; EYEG = variant >= 2 ? EYE_GLOW[variant] : null;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (def.k !== 1) ctx.scale(def.k, def.k);
    def.draw(ctx, a, P);
    V = 0; RIM = '#ffffff'; EYEG = null;
  };
}
// Rend une fois à basse résolution pour mesurer la zone non transparente, puis rend le sprite serré.
function buildSprite(def, frame, variant) {
  const k = def.k;
  const [x0, y0, w, h] = def.box;
  const draw = render(def, frame, variant);
  const probe = makeSprite(x0 * k, y0 * k, w * k, h * k, draw, 1);
  const b = opaqueBounds(probe.c);
  const m = 2;
  const s = makeSprite(x0 * k + b.x - m, y0 * k + b.y - m, b.w + m * 2, b.h + m * 2, draw);
  // drapeau de contrôle : la zone de mesure était trop petite (dessin rogné)
  s.clipped = b.x <= 0 || b.y <= 0 || b.x + b.w >= probe.c.width || b.y + b.h >= probe.c.height;
  return s;
}
const spriteCache = new Map();
const portraitCache = new Map();
function cached(defs, fallback, kind, frame, variant) {
  const id = defs[kind] ? kind : fallback;
  const f = ((Math.floor(frame || 0) % 4) + 4) % 4;
  const v = Math.max(0, Math.min(3, Math.floor(variant || 0)));
  const key = id + ':' + f + ':' + v;
  let s = spriteCache.get(key);
  if (!s) { s = buildSprite(defs[id], f, v); spriteCache.set(key, s); }
  return s;
}

// Sprite pré-rendu (mis en cache). Pieds en y = 0, centré en x = 0, regarde vers la gauche.
export function enemySprite(kind, frame = 0, variant = 0) {
  return cached(DEFS, 'rat', kind, frame, variant);
}
// Portrait PNG (dataURL 96×96) pour l'interface, mis en cache.
export function enemyPortrait(kind, variant = 0) {
  const key = 'e:' + (DEFS[kind] ? kind : 'rat') + ':' + variant;
  let u = portraitCache.get(key);
  if (!u) { u = spriteURL(enemySprite(kind, 0, variant), 96); portraitCache.set(key, u); }
  return u;
}
export function bossSprite(id, frame = 0, variant = 0) {
  return cached(BOSS_DEFS, 'ratKing', id, frame, variant);
}
export function bossPortrait(id, variant = 0) {
  const key = 'b:' + id + ':' + variant;
  let u = portraitCache.get(key);
  if (!u) { u = spriteURL(bossSprite(id, 0, variant), 128); portraitCache.set(key, u); }
  return u;
}
