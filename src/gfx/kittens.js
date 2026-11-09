// =====================================================================
//  CHATONS COMPAGNONS — 40 designs uniques, entièrement procéduraux.
//  Chaque chaton a sa propre silhouette (posture, corps, tête, oreilles,
//  queue), ses marques, ses accessoires et des détails animés selon sa
//  rareté (Légendaire+ : parties lumineuses et animations ; Divin+ : aura).
//  Rendu : parties pré-rendues (makeSprite, recadrées) animées par
//  transformations — quelques drawImage par chaton et par image.
//  Repère : pieds en y = 0, regard vers la droite (x > 0).
// =====================================================================
import { OUT, shade, mix, rgba, ell, rr, smooth, poly, cel, glow, makeSprite, spriteURL, opaqueBounds, seeded } from './draw.js';
import { KITTENS, KITTEN_BY_ID, ELEMENTS } from '../content.js';

const TAU = Math.PI * 2;
const LW = 3.2; // contour des grandes formes
const LW2 = 2.2; // contour des détails
const TINT = '#cbb8dd'; // teinte d'ombre (multiply) — lavande
const LX = -0.55, LY = -0.83; // lumière en haut à gauche (comme cel())
const PINK = '#ffa3b8', NOSE = '#ff8fab', BLUSH = '#ff7aa8';
const GOLD = '#ffd23f', GOLD_D = '#c98a12';
const RES = 2.4;
const noop = () => {};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (q) => q * q * (3 - 2 * q);
const luma = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

// =====================================================================
//  Géométrie
// =====================================================================
// Path2D réutilisable avec les helpers de draw.js (beginPath neutralisé)
function P2(fn) { const p = new Path2D(); p.beginPath = noop; fn(p); return p; }
// ellipse ajoutée au chemin courant (sans beginPath : pour les unions)
function E(p, x, y, rx, ry, rot = 0) { p.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); p.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); p.closePath(); }
function bbox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: Math.max(x1 - x0, y1 - y0) / 2 };
}
function rot(pts, x, y, a = 0, s = 1) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return pts.map(([u, v]) => [x + (u * ca - v * sa) * s, y + (u * sa + v * ca) * s]);
}
// œuf horizontal (avant x>0 plus haut si egg > 0)
function eggPts(x, y, rx, ry, egg = 0.1, n = 16) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, c = Math.cos(a); pts.push([x + c * rx, y + Math.sin(a) * ry * (1 + egg * c)]); }
  return pts;
}
// contour en festons (bulge > 0 : touffes bombées, < 0 : pointes)
function scallop(p, pts, bulge) {
  const n = pts.length;
  let cx = 0, cy = 0;
  for (const q of pts) { cx += q[0]; cy += q[1]; }
  cx /= n; cy /= n;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = mx - cx, dy = my - cy, L = Math.hypot(dx, dy) || 1;
    p.quadraticCurveTo(mx + (dx / L) * bulge, my + (dy / L) * bulge, b[0], b[1]);
  }
  p.closePath();
}
// Catmull-Rom échantillonnée
function crSample(ctrl, seg = 8) {
  const out = [], n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(ctrl[n - 1].slice());
  return out;
}
// suite de courbes à partir du point courant (sans moveTo)
function crTo(p, pts) {
  const sp = crSample(pts, 6);
  for (let i = 1; i < sp.length; i++) p.lineTo(sp[i][0], sp[i][1]);
}
function normalAt(sp, i) {
  const a = sp[Math.max(0, i - 1)], b = sp[Math.min(sp.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [-dy / L, dx / L, dx / L, dy / L];
}
// contour d'un « tube » (queue, ruban, corne…) le long d'une colonne vertébrale
function tubePts(sp, wf) {
  const n = sp.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const [nx, ny] = normalAt(sp, i), w = wf(i / (n - 1));
    Lp.push([sp[i][0] + nx * w, sp[i][1] + ny * w]);
    Rp.push([sp[i][0] - nx * w, sp[i][1] - ny * w]);
  }
  const cap = (i, w, sgn) => {
    const [nx, ny] = normalAt(sp, i), a0 = Math.atan2(ny, nx), o = [];
    for (let j = 1; j < 6; j++) { const a = a0 - (sgn * Math.PI * j) / 6; o.push([sp[i][0] + Math.cos(a) * w, sp[i][1] + Math.sin(a) * w]); }
    return o;
  };
  const end = cap(n - 1, wf(1), 1);
  const start = cap(0, wf(0), 1).map(([x, y]) => [2 * sp[0][0] - x, 2 * sp[0][1] - y]);
  return [...Lp, ...end, ...Rp.reverse(), ...start];
}
function starPath(p, x, y, R, r, n = 5, a0 = -Math.PI / 2) {
  p.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R);
  for (let i = 1; i < n * 2; i++) { const a = a0 + (i * Math.PI) / n, d = i % 2 ? r : R; p.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  p.closePath();
}
function twinkle(p, x, y, R, w = 0.22) {
  p.moveTo(x, y - R);
  p.quadraticCurveTo(x + R * w, y - R * w, x + R, y);
  p.quadraticCurveTo(x + R * w, y + R * w, x, y + R);
  p.quadraticCurveTo(x - R * w, y + R * w, x - R, y);
  p.quadraticCurveTo(x - R * w, y - R * w, x, y - R);
  p.closePath();
}
function heartPath(p, x, y, s) {
  p.moveTo(x, y + s * 0.9);
  p.bezierCurveTo(x - s * 1.3, y + s * 0.05, x - s * 0.9, y - s * 1.1, x, y - s * 0.38);
  p.bezierCurveTo(x + s * 0.9, y - s * 1.1, x + s * 1.3, y + s * 0.05, x, y + s * 0.9);
  p.closePath();
}
function leafPath(p, x, y, len, wid, a) {
  const T = (u, v) => [x + Math.cos(a) * u - Math.sin(a) * v, y + Math.sin(a) * u + Math.cos(a) * v];
  const b = T(len, 0);
  p.moveTo(x, y);
  p.bezierCurveTo(...T(len * 0.3, -wid), ...T(len * 0.75, -wid * 0.85), ...b);
  p.bezierCurveTo(...T(len * 0.75, wid * 0.85), ...T(len * 0.3, wid), x, y);
  p.closePath();
}
// flamme : base (x,y), pointe en haut (y - h)
function flamePath(p, x, y, w, h, lean = 0) {
  p.moveTo(x, y);
  p.bezierCurveTo(x - w * 0.62, y, x - w * 0.66, y - h * 0.42, x - w * 0.28 + lean * 0.3, y - h * 0.62);
  p.quadraticCurveTo(x - w * 0.12 + lean * 0.6, y - h * 0.8, x + lean, y - h);
  p.quadraticCurveTo(x + w * 0.16 + lean * 0.6, y - h * 0.74, x + w * 0.1 + lean * 0.5, y - h * 0.6);
  p.quadraticCurveTo(x + w * 0.44 + lean * 0.4, y - h * 0.62, x + w * 0.4 + lean * 0.3, y - h * 0.82);
  p.bezierCurveTo(x + w * 0.72, y - h * 0.5, x + w * 0.62, y, x, y);
  p.closePath();
}
function boltPts(x, y, s, a = 0) {
  return rot([[2, -10], [-5, 1], [0, 1], [-3, 10], [6, -2.5], [1, -2.5], [4, -10]], x, y, a, s / 10);
}
function crystalPts(x, y, w, h, a = 0) {
  return rot([[-w / 2, 0], [-w / 2, -h * 0.68], [0, -h], [w / 2, -h * 0.68], [w / 2, 0], [0, w * 0.32]], x, y, a);
}

// =====================================================================
//  Remplissages « cel » (style Miaou)
// =====================================================================
// Ombrage net identique à cel() (croissant d'ombre en bas à droite, tache de
// lumière, reflet) mais l'ombre est posée en « multiply » APRÈS les marques
// (rayures, taches…) pour qu'elles soient ombrées elles aussi.
function toon(c, fn, base, o = {}, marks) {
  const p = fn instanceof Path2D ? fn : P2(fn);
  const k = o.k ?? 20, cx = o.cx ?? 0, cy = o.cy ?? 0;
  c.save();
  c.fillStyle = base; c.fill(p);
  c.clip(p);
  if (marks) { c.save(); marks(c); c.restore(); }
  // volume doux par-dessus l'aplat (lumière en haut à gauche, ombre lavande en bas à droite)
  if (o.grad !== false && k > 4) {
    const g = c.createLinearGradient(cx + LX * k, cy + LY * k, cx - LX * k, cy - LY * k);
    g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(70,40,110,0)'); g.addColorStop(1, 'rgba(70,40,110,0.14)');
    c.fillStyle = g; c.fillRect(cx - k * 3, cy - k * 3, k * 6, k * 6);
  }
  const d = k * (o.depth ?? 0.22);
  if (o.shadow !== false && d > 0) {
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = o.tint || TINT;
    c.translate(LX * d, LY * d);
    const q = new Path2D(); q.rect(-3000, -3000, 6000, 6000); q.addPath(p);
    c.fill(q, 'evenodd');
    c.restore();
  }
  // lumière réfléchie (rebond) le long du bord ombré : donne du volume « gacha »
  const lw0 = o.lw ?? LW;
  if (o.bounce !== false && k >= 8 && lw0 > 0) {
    c.save(); c.translate(LX * 2.6, LY * 2.6); c.lineWidth = 2.2; c.strokeStyle = rgba(o.bounce || '#fff0fa', 0.3); c.stroke(p); c.restore();
  }
  if (o.rim) { c.save(); c.translate(-LX * 3.4, -LY * 3.4); c.lineWidth = 2.6; c.strokeStyle = o.rim; c.stroke(p); c.restore(); }
  if ((o.hi ?? 0.24) > 0) { ell(c, cx + LX * k * 0.42, cy + LY * k * 0.42, k * 0.42, k * 0.22, Math.atan2(LY, LX) + Math.PI / 2); c.fillStyle = rgba('#ffffff', o.hi ?? 0.24); c.fill(); }
  if (o.glint !== false) { ell(c, cx + LX * k * 0.58, cy + LY * k * 0.58, k * 0.1, k * 0.06, -0.6); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill(); }
  c.restore();
  const lw = o.lw ?? LW;
  if (lw > 0) { c.lineWidth = lw; c.strokeStyle = o.stroke || OUT; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); }
  return p;
}
// toon sur une liste de points (lisse ou polygone)
function tp(c, pts, base, o = {}, marks) {
  if (base === GOLD && !o.tint && o.metal !== false) o = { ...o, ...METAL, hi: o.hi === 0 ? 0 : METAL.hi };
  const b = bbox(pts);
  return toon(c, (p) => (o.poly ? poly(p, pts) : smooth(p, pts, true, o.tension ?? 0.5)), base, { cx: b.cx, cy: b.cy, k: b.k, ...o }, marks);
}
function te(c, x, y, rx, ry, base, o = {}, marks) {
  return toon(c, (p) => E(p, x, y, rx, ry, o.rot || 0), base, { cx: x, cy: y, k: Math.max(rx, ry), ...o }, marks);
}
// or « métal » : ombre chaude, reflet fort, rebond doré
const METAL = { tint: '#e3a04c', hi: 0.5, depth: 0.26, bounce: '#fff3b0' };
// cel() de draw.js sur une liste de points
function cp(c, pts, base, o = {}) {
  if (base === GOLD && o.metal !== false) return tp(c, pts, base, { lw: LW2, ...o, ...METAL, hi: o.hi === 0 ? 0 : METAL.hi });
  const b = bbox(pts);
  cel(c, (cc) => (o.poly ? poly(cc, pts) : smooth(cc, pts, true, o.tension ?? 0.5)), base, { cx: b.cx, cy: b.cy, size: b.k, lw: o.lw ?? LW2, ...o });
}
function ce(c, x, y, rx, ry, base, o = {}) {
  if (base === GOLD && o.metal !== false) return te(c, x, y, rx, ry, base, { lw: LW2, ...o, ...METAL });
  cel(c, (cc) => ell(cc, x, y, rx, ry, o.rot || 0), base, { cx: x, cy: y, size: Math.max(rx, ry), lw: o.lw ?? LW2, ...o });
}
// union de disques/ellipses (fourrure, nuages, plumes) : contour unique
function blob(c, list, base, o = {}) {
  const p = new Path2D();
  for (const [x, y, rx, ry, a] of list) E(p, x, y, rx, ry ?? rx, a || 0);
  const lw = o.lw ?? LW;
  if (lw > 0) { c.lineWidth = lw * 2; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(p); }
  const b = bbox(list.map(([x, y]) => [x, y]));
  const k = o.k ?? Math.max(b.k, list[0][2]);
  c.save(); c.clip(p);
  c.fillStyle = shade(base, -(o.shadow ?? 0.2)); c.fill(p);
  c.save(); const d = k * (o.depth ?? 0.12); c.translate(LX * d, LY * d); c.fillStyle = base; c.fill(p); c.restore();
  if (o.marks) { c.save(); o.marks(c); c.restore(); }
  if ((o.hi ?? 0.2) > 0) { ell(c, b.cx + LX * k * 0.4, b.cy + LY * k * 0.4, k * 0.4, k * 0.2, Math.atan2(LY, LX) + Math.PI / 2); c.fillStyle = rgba('#ffffff', o.hi ?? 0.2); c.fill(); }
  c.restore();
  return p;
}
function fillStroke(c, fn, fill, lw = LW2, stroke = OUT) {
  const p = fn instanceof Path2D ? fn : P2(fn);
  if (fill) { c.fillStyle = fill; c.fill(p); }
  if (lw > 0) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); }
  return p;
}
// trait épais avec contour (tige, sangle, bandeau)
function line2(c, pts, w, col, lw = LW2) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3) c.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else if (pts.length === 4) c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
  else for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (lw > 0) { c.lineWidth = w + lw * 2; c.strokeStyle = OUT; c.stroke(); }
  c.lineWidth = w; c.strokeStyle = col; c.stroke();
}
function sparkle(c, x, y, R, col = '#ffffff', lw = 1.6) {
  c.beginPath(); twinkle(c, x, y, R, 0.2);
  c.fillStyle = col; c.fill();
  if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
}
function crystal(c, x, y, w, h, a, col, lw = LW2) {
  const pts = crystalPts(x, y, w, h, a);
  cp(c, pts, col, { poly: true, lw, hi: 0.3 });
  // facette claire
  const f = rot([[-w / 2, 0], [-w / 2, -h * 0.68], [0, -h], [0, w * 0.32]], x, y, a);
  c.beginPath(); poly(c, f); c.fillStyle = 'rgba(255,255,255,0.38)'; c.fill();
}
function paintLeaf(c, x, y, len, wid, a, col = '#5fd068', lw = LW2) {
  toon(c, (p) => leafPath(p, x, y, len, wid, a), col, { cx: x + Math.cos(a) * len * 0.5, cy: y + Math.sin(a) * len * 0.5, k: len * 0.5, lw });
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len * 0.8, y + Math.sin(a) * len * 0.8);
  c.lineWidth = 1.4; c.strokeStyle = shade(col, -0.35); c.stroke();
}
function paintFlame(c, x, y, w, h, lean = 0, cols = ['#ff5a1f', '#ffa21f', '#fff0a0'], lw = LW2) {
  toon(c, (p) => flamePath(p, x, y, w, h, lean), cols[0], { cx: x, cy: y - h * 0.4, k: h * 0.5, lw, hi: 0, glint: false, depth: 0.15 });
  c.beginPath(); flamePath(c, x, y - h * 0.02, w * 0.66, h * 0.7, lean * 0.7); c.fillStyle = cols[1]; c.fill();
  c.beginPath(); flamePath(c, x, y - h * 0.04, w * 0.34, h * 0.42, lean * 0.4); c.fillStyle = cols[2]; c.fill();
}

// =====================================================================
//  Sprites
// =====================================================================
// makeSprite + recadrage automatique sur la zone opaque (mémoire)
function sprite(x0, y0, w, h, draw, res = RES) {
  const s = makeSprite(x0, y0, w, h, draw, res);
  const W = s.c.width, H = s.c.height;
  const b = opaqueBounds(s.c);
  const edge = b.x <= 0 || b.y <= 0 || b.x + b.w >= W || b.y + b.h >= H;
  const bx = Math.max(0, b.x - 2), by = Math.max(0, b.y - 2);
  const bw = Math.min(W - bx, b.w + 4), bh = Math.min(H - by, b.h + 4);
  if (bw * bh > W * H * 0.92) { s.edge = edge; return s; }
  const c = document.createElement('canvas'); c.width = bw; c.height = bh;
  c.getContext('2d').drawImage(s.c, bx, by, bw, bh, 0, 0, bw, bh);
  return { c, x0: x0 + bx / res, y0: y0 + by / res, w: bw / res, h: bh / res, res, edge };
}
function blit(ctx, s, x, y, r = 0, sx = 1, sy = 1, a = 1) {
  if (!s) return;
  if (!r && sx === 1 && sy === 1 && a === 1) { ctx.drawImage(s.c, x + s.x0, y + s.y0, s.w, s.h); return; }
  ctx.save(); ctx.translate(x, y);
  if (r) ctx.rotate(r);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  if (a !== 1) ctx.globalAlpha *= a;
  ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h);
  ctx.restore();
}
// lueurs et étincelles partagées (additif)
const GLOWS = new Map();
function addGlow(ctx, x, y, r, col, a = 1) {
  if (a <= 0.01) return;
  let s = GLOWS.get(col);
  if (!s) { s = makeSprite(-32, -32, 64, 64, (c) => glow(c, 0, 0, 32, col, 1), 1.5); GLOWS.set(col, s); }
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * Math.min(1, a);
  ctx.drawImage(s.c, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
}
const SPARKS = new Map();
function addSpark(ctx, x, y, r, col = '#ffffff', a = 1, ang = 0) {
  if (a <= 0.02 || r <= 0.1) return;
  let s = SPARKS.get(col);
  if (!s) {
    s = makeSprite(-14, -14, 28, 28, (c) => { glow(c, 0, 0, 13, col, 0.7); c.beginPath(); twinkle(c, 0, 0, 11, 0.16); c.fillStyle = mix(col, '#ffffff', 0.7); c.fill(); }, 2);
    SPARKS.set(col, s);
  }
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * Math.min(1, a);
  if (ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(s.c, -r, -r, r * 2, r * 2); ctx.restore(); }
  else ctx.drawImage(s.c, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
}
// petites étincelles scintillantes en boucle (liste [x, y, taille, phase])
function twinkles(ctx, list, t, col, speed = 3) {
  for (const [x, y, s, ph] of list) {
    const v = Math.sin(t * speed + ph);
    if (v > 0) addSpark(ctx, x, y, s * v, col, v);
  }
}
// particules montantes déterministes (braises, bulles…) : n éléments sur une zone
function rising(ctx, t, n, x0, y0, w, h, speed, fn) {
  for (let i = 0; i < n; i++) {
    const u = (t * speed / h + i / n) % 1;
    const x = x0 + ((i * 0.618) % 1) * w + Math.sin(t * 2 + i * 2.1) * 3;
    fn(ctx, x, y0 - u * h, u, i);
  }
}

// =====================================================================
//  Visage
// =====================================================================
function eye(c, x, y, rx, ry, col, st = 'round', o = {}) {
  // fond sombre (iris plein « anime »)
  c.fillStyle = '#1d1530';
  ell(c, x, y, rx, ry); c.fill();
  c.save(); ell(c, x, y, rx, ry); c.clip();
  if (st !== 'button') {
    const g = c.createLinearGradient(0, y - ry, 0, y + ry);
    if (st === 'galaxy') { g.addColorStop(0, '#1a0b3d'); g.addColorStop(0.5, shade(col, -0.2)); g.addColorStop(1, '#ff9be8'); }
    else { g.addColorStop(0, shade(col, -0.55)); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#ffffff', 0.55)); }
    ell(c, x, y + ry * 0.05, rx * 0.86, ry * 0.88); c.fillStyle = g; c.fill();
    // croissant de lumière réfléchie au bas de l'iris
    const rg = c.createRadialGradient(x, y + ry * 0.78, 0, x, y + ry * 0.78, rx * 1.05);
    rg.addColorStop(0, rgba(mix(col, '#ffffff', st === 'galaxy' ? 0.4 : 0.72), 0.9)); rg.addColorStop(0.55, rgba(col, 0.25)); rg.addColorStop(1, rgba(col, 0));
    c.fillStyle = rg; ell(c, x, y + ry * 0.05, rx * 0.86, ry * 0.88); c.fill();
  } else {
    const rg = c.createRadialGradient(x, y + ry * 0.8, 0, x, y + ry * 0.8, rx);
    rg.addColorStop(0, 'rgba(150,110,90,0.75)'); rg.addColorStop(1, 'rgba(150,110,90,0)');
    c.fillStyle = rg; c.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  }
  c.fillStyle = '#140b20';
  if (st === 'moon') { ell(c, x + rx * 0.05, y + ry * 0.08, rx * 0.3, ry * 0.32); c.fill(); }
  else if (st === 'fierce') { ell(c, x + rx * 0.06, y + ry * 0.06, rx * 0.2, ry * 0.68); c.fill(); }
  else if (st === 'glow') { ell(c, x, y + ry * 0.1, rx * 0.46, ry * 0.52); c.fillStyle = mix(col, '#ffffff', 0.65); c.fill(); }
  else if (st === 'galaxy') {
    c.fillStyle = '#ffffff';
    for (const [dx, dy, s] of [[-0.35, 0.3, 0.09], [0.3, -0.05, 0.07], [0.1, 0.5, 0.06], [0.42, 0.42, 0.05], [-0.1, 0.1, 0.04], [0.5, 0.15, 0.04]]) { ell(c, x + dx * rx, y + dy * ry, s * rx + 0.4, s * rx + 0.4); c.fill(); }
  } else if (st !== 'button') {
    ell(c, x + rx * 0.08, y + ry * 0.1, rx * 0.5, ry * 0.6); c.fill();
    // anneau de couleur autour de la pupille
    ell(c, x + rx * 0.08, y + ry * 0.1, rx * 0.5, ry * 0.6); c.lineWidth = 1; c.strokeStyle = rgba(mix(col, '#ffffff', 0.3), 0.55); c.stroke();
  }
  // ombre de la paupière supérieure sur l'iris
  ell(c, x, y - ry * 1.12, rx * 1.4, ry * 0.7); c.fillStyle = 'rgba(16,6,34,0.38)'; c.fill();
  c.restore();
  c.fillStyle = '#ffffff';
  if (st === 'sparkle' || st === 'galaxy') {
    c.beginPath(); twinkle(c, x - rx * 0.28, y - ry * 0.34, rx * 0.66, 0.18); c.fill();
    ell(c, x + rx * 0.36, y + ry * 0.4, rx * 0.17, rx * 0.17); c.fill();
    ell(c, x + rx * 0.3, y - ry * 0.5, rx * 0.09, rx * 0.09); c.fill();
  } else if (st === 'heart') {
    c.beginPath(); heartPath(c, x - rx * 0.22, y - ry * 0.28, rx * 0.44); c.fill();
    ell(c, x + rx * 0.36, y + ry * 0.4, rx * 0.16, rx * 0.16); c.fill();
  } else if (st === 'pixel') {
    c.fillRect(x - rx * 0.62, y - ry * 0.62, rx * 0.56, rx * 0.56);
    c.fillRect(x + rx * 0.2, y + ry * 0.26, rx * 0.28, rx * 0.28);
  } else if (st !== 'glow') {
    ell(c, x - rx * 0.3, y - ry * 0.36, rx * 0.44, rx * 0.4, -0.35); c.fill();
    ell(c, x + rx * 0.36, y + ry * 0.38, rx * 0.17, rx * 0.17); c.fill();
    c.globalAlpha *= 0.9; ell(c, x + rx * 0.28, y - ry * 0.52, rx * 0.09, rx * 0.09); c.fill(); c.globalAlpha /= 0.9;
  }
  ell(c, x, y, rx, ry); c.lineWidth = LW2; c.strokeStyle = OUT; c.stroke();
  // trait de paupière supérieure plus épais (regard net et mignon)
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, Math.PI * 1.06, Math.PI * 1.94); c.lineWidth = 3.4; c.lineCap = 'round'; c.stroke();
  if (o.lash) {
    const s = o.side;
    c.beginPath(); c.moveTo(x + s * rx * 0.72, y - ry * 0.68); c.quadraticCurveTo(x + s * rx * 1.15, y - ry * 0.95, x + s * rx * 1.35, y - ry * 0.8);
    c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
  }
  if (o.kohl) {
    const s = o.side;
    c.beginPath(); c.moveTo(x - s * rx * 0.2, y - ry * 1.02); c.quadraticCurveTo(x + s * rx * 0.9, y - ry * 0.95, x + s * rx * 1.7, y - ry * 0.25);
    c.lineWidth = 3.2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(x + s * rx * 0.8, y + ry * 0.5); c.quadraticCurveTo(x + s * rx * 1.3, y + ry * 0.4, x + s * rx * 1.6, y + ry * 0.9);
    c.lineWidth = 2.4; c.stroke();
  }
}
// paupière mi-close détendue (clignement lent, ronronnement) : bord courbe et cils
function softLid(c, x, y, rx, ry, k, side, fur, ink) {
  const yl = y - ry + k * ry * 2;
  c.save(); ell(c, x, y, rx + 1.6, ry + 1.6); c.clip();
  c.beginPath(); c.moveTo(x - rx * 1.4, yl - ry * 0.28); c.quadraticCurveTo(x, yl + ry * 0.42, x + rx * 1.4, yl - ry * 0.28); c.lineTo(x + rx * 1.4, y - ry - 4); c.lineTo(x - rx * 1.4, y - ry - 4); c.closePath();
  c.fillStyle = fur; c.fill();
  c.restore();
  c.beginPath(); c.moveTo(x - rx * 0.98, yl - ry * 0.12); c.quadraticCurveTo(x, yl + ry * 0.4, x + rx * 0.98, yl - ry * 0.12);
  c.lineWidth = 3.2; c.strokeStyle = ink || OUT; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x + side * rx * 0.9, yl - ry * 0.05); c.lineTo(x + side * rx * 1.3, yl - ry * 0.3); c.lineWidth = 2.2; c.stroke();
}
// paupière (colère / sommeil) : couvre le haut de l'œil d'une ligne inclinée
function lid(c, x, y, rx, ry, dIn, dOut, side, fur) {
  const xi = x - side * rx * 1.3, xo = x + side * rx * 1.3;
  const yi = y - ry + dIn * ry * 2, yo = y - ry + dOut * ry * 2;
  c.save(); ell(c, x, y, rx + 1.6, ry + 1.6); c.clip();
  c.beginPath(); c.moveTo(xi, yi); c.lineTo(xo, yo); c.lineTo(xo, y - ry - 4); c.lineTo(xi, y - ry - 4); c.closePath();
  c.fillStyle = fur; c.fill();
  c.restore();
  c.beginPath(); c.moveTo(lerp(xi, x, 0.18), lerp(yi, (yi + yo) / 2, 0.18)); c.lineTo(lerp(xo, x, 0.12), lerp(yo, (yi + yo) / 2, 0.12));
  c.lineWidth = 2.8; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke();
}
// yeux fermés : 'closed' (‿ clignement), 'happy' (^ ^), 'hurt' (> <), 'squeeze' (bâillement)
function closedEye(c, x, y, rx, ry, mode, side = 1, lash = false, ink = OUT) {
  c.beginPath(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = ink;
  if (mode === 'happy') { c.moveTo(x - rx * 0.92, y + 2.4); c.quadraticCurveTo(x, y - ry * 1.05, x + rx * 0.92, y + 2.4); c.lineWidth = 3.4; }
  else if (mode === 'hurt') {
    const s = -side; // œil gauche « > », œil droit « < »
    c.moveTo(x - s * rx * 0.75, y - ry * 0.62); c.lineTo(x + s * rx * 0.62, y); c.lineTo(x - s * rx * 0.75, y + ry * 0.62); c.lineWidth = 3.2;
  } else if (mode === 'squeeze') {
    c.moveTo(x - rx * 0.95, y - 1.5); c.quadraticCurveTo(x, y + ry * 0.55, x + rx * 0.95, y - 1.5); c.lineWidth = 3.2; c.stroke();
    c.beginPath(); c.moveTo(x + side * rx * 1.05, y - ry * 0.45); c.lineTo(x + side * rx * 1.45, y - ry * 0.75); c.moveTo(x + side * rx * 1.1, y + ry * 0.1); c.lineTo(x + side * rx * 1.55, y + ry * 0.05); c.lineWidth = 1.8;
  } else { c.moveTo(x - rx * 0.95, y); c.quadraticCurveTo(x, y + ry * 0.7, x + rx * 0.95, y); c.lineWidth = 3.2; }
  c.stroke();
  if (lash && mode !== 'hurt') {
    const yy = mode === 'happy' ? y + 2 : y;
    c.beginPath(); c.moveTo(x + side * rx * 0.86, yy); c.lineTo(x + side * rx * 1.3, yy - (mode === 'happy' ? 2.4 : 3.2)); c.lineWidth = 2.2; c.stroke();
  }
}
function mouth(c, x, y, type, tongue = '#ff6f91', ink = OUT) {
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = ink;
  const w = () => { c.beginPath(); c.moveTo(x - 4.6, y - 0.5); c.quadraticCurveTo(x - 2.3, y + 3.4, x, y); c.quadraticCurveTo(x + 2.3, y + 3.4, x + 4.6, y - 0.5); c.lineWidth = 2; c.stroke(); };
  const openM = (hw, h, fang) => {
    c.beginPath(); c.moveTo(x - hw, y); c.quadraticCurveTo(x, y + 1.6, x + hw, y); c.quadraticCurveTo(x + hw * 0.85, y + h, x, y + h); c.quadraticCurveTo(x - hw * 0.85, y + h, x - hw, y); c.closePath();
    c.fillStyle = '#7a1f3d'; c.fill();
    c.save(); c.clip(); ell(c, x, y + h * 0.95, hw * 0.8, h * 0.42); c.fillStyle = tongue; c.fill();
    if (fang) { c.beginPath(); c.moveTo(x + hw * 0.32, y); c.lineTo(x + hw * 0.62, y); c.lineTo(x + hw * 0.47, y + 2.8); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); }
    c.restore();
    c.lineWidth = 2; c.stroke();
  };
  if (type === 'none') return;
  if (type === 'open') openM(5, 7.5);
  else if (type === 'happy') openM(5.8, 8.2);
  else if (type === 'shout') openM(5.4, 8.6, true);
  else if (type === 'yawn') {
    c.beginPath(); c.ellipse(x, y + 5.2, 4.6, 6.4, 0, 0, TAU); c.fillStyle = '#7a1f3d'; c.fill();
    c.save(); c.clip(); ell(c, x, y + 10.5, 4, 3.2); c.fillStyle = tongue; c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 3.6, y + 1.6); c.lineTo(x + s * 1.6, y + 0.4); c.lineTo(x + s * 2.4, y + 3.6); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); }
    c.restore();
    c.beginPath(); c.ellipse(x, y + 5.2, 4.6, 6.4, 0, 0, TAU); c.lineWidth = 2; c.stroke();
  } else if (type === 'wobble') {
    c.beginPath(); c.moveTo(x - 4.4, y + 2.6); c.quadraticCurveTo(x - 3.3, y + 0.6, x - 2.2, y + 2.6); c.quadraticCurveTo(x - 1.1, y + 4.6, x, y + 2.6); c.quadraticCurveTo(x + 1.1, y + 0.6, x + 2.2, y + 2.6); c.quadraticCurveTo(x + 3.3, y + 4.6, x + 4.4, y + 2.6);
    c.lineWidth = 2; c.stroke();
  } else if (type === 'o') {
    ell(c, x, y + 2.2, 2.4, 2.6); c.fillStyle = '#7a1f3d'; c.fill(); c.lineWidth = 1.8; c.stroke();
  } else if (type === 'smile') {
    c.beginPath(); c.moveTo(x - 4.5, y); c.quadraticCurveTo(x, y + 4.5, x + 4.5, y); c.lineWidth = 2; c.stroke();
  } else if (type === 'lick') {
    // petite langue tirée vers la patte
    c.beginPath(); c.moveTo(x - 1.6, y + 1); c.lineTo(x - 1.6, y + 4.5); c.quadraticCurveTo(x + 0.6, y + 8.4, x + 3.6, y + 6.4); c.quadraticCurveTo(x + 4.2, y + 3.4, x + 2.2, y + 1); c.closePath();
    c.fillStyle = tongue; c.fill(); c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.moveTo(x + 0.6, y + 2.6); c.lineTo(x + 1.4, y + 5.2); c.lineWidth = 1; c.strokeStyle = rgba('#b0305a', 0.7); c.stroke(); c.strokeStyle = ink;
    w();
  } else {
    if (type === 'blep') { rr(c, x - 1.9, y + 0.5, 3.8, 5.2, 1.9); c.fillStyle = tongue; c.fill(); c.lineWidth = 1.5; c.stroke(); }
    w();
    if (type === 'fang' || type === 'fangs') {
      const f = (fx) => { c.beginPath(); c.moveTo(fx - 1.5, y + 1.2); c.lineTo(fx + 1.5, y + 1.2); c.lineTo(fx, y + 4.6); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 1.2; c.stroke(); };
      f(x + 2.5); if (type === 'fangs') f(x - 2.5);
    }
  }
}
function nose(c, x, y, col = NOSE) {
  c.beginPath(); c.moveTo(x - 3.2, y - 1.6); c.quadraticCurveTo(x, y - 2.6, x + 3.2, y - 1.6); c.quadraticCurveTo(x + 0.6, y + 1.8, x, y + 1.8); c.quadraticCurveTo(x - 0.6, y + 1.8, x - 3.2, y - 1.6); c.closePath();
  c.fillStyle = col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
  ell(c, x - 1.1, y - 0.9, 1.1, 0.6, -0.2); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
}
// joue rosée : dégradé doux + petit éclat
function blush(c, x, y, rx, ry, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.6, rgba(col, a * 0.7)); g.addColorStop(1, rgba(col, 0));
  c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, rx, 0, TAU); c.fill();
  c.restore();
  ell(c, x - rx * 0.28, y - ry * 0.3, rx * 0.16, rx * 0.12); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
}
// variantes d'expression : chaque variante est un petit sprite superposé au crâne
const FACES = ['open', 'half', 'closed', 'happy', 'hurt', 'shout', 'yawn', 'lick'];
const EYE_OF = { open: 'open', half: 'half', closed: 'closed', happy: 'happy', hurt: 'hurt', shout: 'open', yawn: 'squeeze', lick: 'happy' };
function face(c, S, v = 'open') {
  const F = S.face, fx = F.x, ey = F.y, sep = F.sep, rx = F.rx, ry = F.ry;
  const eyes = [[fx - sep, ey, rx, ry, -1], [fx + sep, ey, rx * 0.9, ry * 0.97, 1]];
  let em = EYE_OF[v] || 'open';
  if (F.style === 'happy' && (em === 'open' || em === 'half')) em = 'happy';
  if (F.blush !== false) {
    const a = (F.blushA ?? 0.45) * (v === 'happy' || v === 'lick' ? 1.3 : 1) + 0.08;
    blush(c, fx - sep - rx * 0.75, ey + ry * 1.05, 6.4, 3.8, F.blushC || BLUSH, a);
    blush(c, fx + sep + rx * 0.7, ey + ry * 1.05, 5.4, 3.4, F.blushC || BLUSH, a);
  }
  for (const [x, y, erx, ery, side] of eyes) {
    const col = side > 0 && F.eye2 ? F.eye2 : F.eye;
    if (em === 'open' || em === 'half') {
      eye(c, x, y, erx, ery, col, F.style, { lash: F.lash, kohl: F.kohl, side });
      if (em === 'half') softLid(c, x, y, erx, ery, Math.max(0.5, F.lid ? (F.lid[0] + F.lid[1]) / 2 + 0.2 : 0), side, F.lidC || S.headFur || S.fur, S.ink);
      else if (F.lid) lid(c, x, y, erx, ery, F.lid[0], F.lid[1], side, F.lidC || S.headFur || S.fur);
    } else closedEye(c, x, y, erx, ery, em, side, F.lash || F.kohl, S.ink);
  }
  if (F.brow && (em === 'open' || em === 'half')) {
    for (const [x, y, erx, ery, side] of eyes) {
      c.beginPath(); c.moveTo(x - side * erx * 0.9, y - ery - 3.5 + F.brow * 2); c.lineTo(x + side * erx * 0.7, y - ery - 5.5 - F.brow);
      c.lineWidth = 3.2; c.strokeStyle = F.browC || OUT; c.lineCap = 'round'; c.stroke();
    }
  } else if (em === 'hurt') {
    // sourcils inquiets
    for (const [x, y, erx, ery, side] of eyes) {
      c.beginPath(); c.moveTo(x - side * erx * 0.8, y - ery - 6); c.lineTo(x + side * erx * 0.6, y - ery - 3.4);
      c.lineWidth = 2.4; c.strokeStyle = F.browC || S.ink; c.lineCap = 'round'; c.stroke();
    }
  }
  if (F.nose !== false) nose(c, fx + F.nx, ey + F.ny, F.noseC);
  let m = F.mouth;
  if (m !== 'none') m = v === 'happy' ? 'happy' : v === 'hurt' ? 'wobble' : v === 'shout' ? 'shout' : v === 'yawn' ? 'yawn' : v === 'lick' ? 'lick' : m;
  mouth(c, fx + F.nx, ey + F.ny + 2.6, m, F.tongue, S.inkM);
}

// =====================================================================
//  Tête
// =====================================================================
function headPts(H) {
  const pts = [], N = 26;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let x = Math.sin(a) * H.rx, y = -Math.cos(a) * H.ry;
    const side = Math.exp(-Math.pow(Math.abs(a - Math.PI) - 1.05, 2) / 0.14);
    x *= 1 + H.cheek * side; y += H.cheek * side * H.ry * 0.22;
    const bot = Math.exp(-Math.pow(a - Math.PI, 2) / 0.3);
    x *= 1 - H.chin * bot; y += H.chin * bot * H.ry * 0.28;
    if (y < 0) y *= 1 - H.top;
    pts.push([x, y]);
  }
  return pts;
}
function earGeo(S, side) {
  const H = S.head, Ea = S.ears;
  const a = side < 0 ? Ea.aL : Ea.aR;
  const wid = Ea.wid * (side < 0 ? 1 : 0.94), len = Ea.len * (side < 0 ? 1 : 0.96), tilt = Ea.tilt * side;
  const on = (ang, k) => [Math.sin(ang) * H.rx * k, -Math.cos(ang) * H.ry * k];
  const b1 = on(a - wid, 0.84), b2 = on(a + wid, 0.84), c0 = on(a, 0.96);
  const dir = [Math.sin(a + tilt), -Math.cos(a + tilt)];
  const tip = [c0[0] + dir[0] * len, c0[1] + dir[1] * len];
  return { b1, b2, tip, dir, c0, len };
}
function earShape(g, type) {
  const { b1, b2, tip } = g;
  const m = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
  return (p) => {
    p.moveTo(b1[0], b1[1]);
    if (type === 'round') {
      const ex = [tip[0] + (tip[0] - m[0]) * 0.4, tip[1] + (tip[1] - m[1]) * 0.4];
      p.bezierCurveTo(lerp(b1[0], ex[0], 0.7) + (b1[0] - b2[0]) * 0.25, lerp(b1[1], ex[1], 0.7) + (b1[1] - b2[1]) * 0.25, lerp(b2[0], ex[0], 0.7) + (b2[0] - b1[0]) * 0.25, lerp(b2[1], ex[1], 0.7) + (b2[1] - b1[1]) * 0.25, b2[0], b2[1]);
    } else {
      const k = type === 'big' || type === 'fox' ? 0.18 : 0.1;
      p.quadraticCurveTo((b1[0] + tip[0]) / 2 + (b1[0] - b2[0]) * k, (b1[1] + tip[1]) / 2 + (b1[1] - b2[1]) * k, tip[0], tip[1]);
      p.quadraticCurveTo((b2[0] + tip[0]) / 2 + (b2[0] - b1[0]) * k, (b2[1] + tip[1]) / 2 + (b2[1] - b1[1]) * k, b2[0], b2[1]);
    }
    p.closePath();
  };
}
function paintEar(c, S, side) {
  const Ea = S.ears;
  if (Ea.type === 'none') return;
  const g = earGeo(S, side);
  if (Ea.draw) { Ea.draw(c, S, side, g); return; }
  const base = Ea.col || S.earFur || S.headFur || S.fur;
  const col = side < 0 ? shade(base, -0.06) : base;
  const shape = earShape(g, Ea.type);
  const m = [(g.b1[0] + g.b2[0]) / 2, (g.b1[1] + g.b2[1]) / 2];
  toon(c, shape, col, { cx: lerp(m[0], g.tip[0], 0.5), cy: lerp(m[1], g.tip[1], 0.5), k: g.len * 0.55, hi: 0.18, rim: S.rim }, (cc) => {
    // intérieur rose
    const L = (q, k) => [m[0] + (q[0] - m[0]) * k, m[1] + (q[1] - m[1]) * k];
    const ig = { b1: L(g.b1, 0.56), b2: L(g.b2, 0.56), tip: L(g.tip, 0.8) };
    cc.beginPath(); earShape(ig, Ea.type)(cc); cc.fillStyle = Ea.inner || PINK; cc.fill();
    if (Ea.type !== 'round' && Ea.fluff !== false) {
      // touffe de poils clairs qui sort de l'oreille
      cc.fillStyle = rgba(mix(base, '#ffffff', 0.8), 0.95);
      const ex = g.b2[0] - g.b1[0], ey = g.b2[1] - g.b1[1];
      for (const [u, k, d, w] of [[0.62, 0.52, -0.05, 0.11], [0.4, 0.4, -0.16, 0.09]]) {
        const bx = lerp(ig.b1[0], ig.b2[0], u), by = lerp(ig.b1[1], ig.b2[1], u);
        const tx = lerp(bx, g.tip[0], k) + ex * d, ty = lerp(by, g.tip[1], k) + ey * d;
        cc.beginPath(); cc.moveTo(bx - ex * w, by - ey * w);
        cc.quadraticCurveTo(lerp(bx, tx, 0.6) - ex * w * 0.4, lerp(by, ty, 0.6) - ey * w * 0.4, tx, ty);
        cc.quadraticCurveTo(lerp(bx, tx, 0.5) + ex * w * 0.5, lerp(by, ty, 0.5) + ey * w * 0.5, bx + ex * w, by + ey * w);
        cc.closePath(); cc.fill();
      }
    }
    if (Ea.tip) { ell(cc, g.tip[0], g.tip[1], g.len * (Ea.tipK || 0.42), g.len * (Ea.tipK || 0.42)); cc.fillStyle = Ea.tip; cc.fill(); }
  });
  if (Ea.type === 'tuft') {
    const t2 = [g.tip[0] + g.dir[0] * (Ea.tuftLen || 11), g.tip[1] + g.dir[1] * (Ea.tuftLen || 11)];
    const nx = -g.dir[1], ny = g.dir[0];
    fillStroke(c, (p) => { p.moveTo(g.tip[0] + nx * 2.8 - g.dir[0] * 3, g.tip[1] + ny * 2.8 - g.dir[1] * 3); p.quadraticCurveTo(t2[0] + nx * 2.2, t2[1] + ny * 2.2, t2[0], t2[1]); p.quadraticCurveTo(g.tip[0] - nx * 0.6, g.tip[1] - ny * 0.6, g.tip[0] - nx * 2.8 - g.dir[0] * 3, g.tip[1] - ny * 2.8 - g.dir[1] * 3); p.closePath(); }, Ea.tuftC || '#3a3046', 1.6);
  }
  if (Ea.after) Ea.after(c, S, side, g);
}
function paintRuff(c, S) {
  const H = S.head, R = S.ruff;
  const n = R.n || 14, a0 = R.a0 ?? 1.2, a1 = R.a1 ?? TAU - 1.2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const k = i % 2 ? 1.0 : 1 + (R.amp || 0.2);
    pts.push([Math.sin(a) * H.rx * k * (R.sx || 1.04) + (R.dx || 0), -Math.cos(a) * H.ry * k * (R.sy || 1.06) + (R.dy || 0)]);
  }
  if (R.soft) {
    // collerette douce (persan) : festons arrondis
    const ring = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; ring.push([Math.sin(a) * H.rx * (R.sx || 1.1), -Math.cos(a) * H.ry * (R.sy || 1.1)]); }
    ring.push([0, -H.ry * 0.2]);
    toon(c, (p) => scallop(p, ring, R.amp * H.rx * 0.5), R.col || S.fur, { cx: 0, cy: 10, k: H.rx, hi: 0.1, glint: false });
    return;
  }
  pts.push([0, 0]);
  toon(c, (p) => poly(p, pts), R.col || S.fur, { cx: 0, cy: 10, k: H.rx, hi: 0.1, glint: false });
}
// point du contour de la tête à l'angle a (même formule que headPts)
function headPt(H, a, kr = 1) {
  let x = Math.sin(a) * H.rx * kr, y = -Math.cos(a) * H.ry * kr;
  const side = Math.exp(-Math.pow(Math.abs(a - Math.PI) - 1.05, 2) / 0.14);
  x *= 1 + H.cheek * side; y += H.cheek * side * H.ry * 0.22;
  const bot = Math.exp(-Math.pow(a - Math.PI, 2) / 0.3);
  x *= 1 - H.chin * bot; y += H.chin * bot * H.ry * 0.28;
  if (y < 0) y *= 1 - H.top;
  return [x, y];
}
// contour de tête avec touffes de poils pointues aux joues (intégrées au contour : un seul trait)
function headOutline(H, tufts = true) {
  const out = [], N = 30, K = H.tufts ?? 1, on = tufts && K > 0;
  const zone = (a) => on && Math.abs(Math.abs(a - Math.PI) - 1.2) < 0.26;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    if (zone(a)) continue;
    out.push([...headPt(H, a), 0]);
    const a2 = ((i + 1) / N) * TAU;
    if (on && !zone(a) && zone(a2)) {
      // entrée dans une zone de touffes : creux / pointe / creux / pointe / creux
      const s = a2 < Math.PI ? 1 : -1, a0 = Math.PI - s * 1.46;
      for (let j = 0; j <= 4; j++) {
        const aa = a0 + s * j * 0.13, tip = j % 2 === 1;
        const q = headPt(H, aa + (tip ? s * 0.06 : 0), tip ? 1 + 0.085 * K : 0.995);
        if (tip) q[1] += 2.2 * K;
        out.push([q[0], q[1], tip ? 1 : 0]);
      }
    }
  }
  return out;
}
// Catmull-Rom fermée avec pointes franches (points marqués « 1 »)
function sharpSmooth(p, pts) {
  const n = pts.length, T = 0.5 / 3 * 2 / 2;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const k1 = p1[2] ? 0.15 : 1, k2 = p2[2] ? 0.15 : 1;
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * T * k1, p1[1] + (p2[1] - p0[1]) * T * k1, p2[0] - (p3[0] - p1[0]) * T * k2, p2[1] - (p3[1] - p1[1]) * T * k2, p2[0], p2[1]);
  }
  p.closePath();
}
function headShape(S) {
  const H = S.head, pts = headOutline(H, H.tufts !== false && !S.ruff);
  return (p) => sharpSmooth(p, pts);
}
// tête en couches : arrière (crinière…), oreilles (sprites séparés), crâne, visage (variantes), avant (accessoires)
function paintHeadBack(c, S) {
  if (S.headBack) S.headBack(c, S, false);
  if (S.ruff) paintRuff(c, S);
}
function paintSkull(c, S) {
  const H = S.head;
  if (S.headMid) S.headMid(c, S, false);
  toon(c, headShape(S), S.headFur || S.fur, { cx: 0, cy: -3, k: H.rx, tint: S.tint, rim: S.rim }, (cc) => {
    if (S.muzzle) {
      const F = S.face;
      cc.fillStyle = S.muzzle;
      ell(cc, F.x + F.nx, F.y + F.ny + 4, 12, 8); cc.fill();
    }
    if (S.marks && S.marks.head) S.marks.head(cc, S);
  });
}
function paintHeadFront(c, S) { if (S.headFront) S.headFront(c, S, false); }
function paintHead(c, S, v = 'open') {
  paintHeadBack(c, S);
  paintEar(c, S, -1); paintEar(c, S, 1);
  paintSkull(c, S);
  if (!S.noFace) face(c, S, v);
  paintHeadFront(c, S);
}

// =====================================================================
//  Corps
// =====================================================================
// ombre douce portée par la tête sur le corps (occlusion)
function neckAO(cc, S) {
  if (S.pose === 'box' || S.pose === 'merm') return;
  const H = S.head, x = S.hx - 2, y = S.hy + H.ry * 0.82 * H.s + 2, r = H.rx * 0.95 * H.s;
  const g = cc.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(60,30,90,0.3)'); g.addColorStop(0.6, 'rgba(60,30,90,0.12)'); g.addColorStop(1, 'rgba(60,30,90,0)');
  cc.save(); cc.translate(x, y); cc.scale(1, 0.55); cc.translate(-x, -y);
  cc.fillStyle = g; cc.fillRect(x - r, y - r, r * 2, r * 2);
  cc.restore();
}
function bodyMarks(S) {
  return (cc) => {
    const B = S.body;
    if (S.belly) { cc.fillStyle = S.belly; ell(cc, B.x + B.rx * 0.32, B.y + B.ry * 0.88, B.rx * 0.74, B.ry * 0.62); cc.fill(); }
    if (S.marks && S.marks.body) S.marks.body(cc, S);
    neckAO(cc, S);
  };
}
function paintBody(c, S) {
  const B = S.body;
  if (S.bodyBack) S.bodyBack(c, S);
  const fur = S.bodyFur || S.fur;
  if (S.pose === 'sit') {
    // cuisse arrière + pied
    const g0 = -(S.hover || 0), hr = B.hr, hx = B.x - B.rx * 0.75, hy = -hr * 0.98 + g0;
    te(c, hx + hr * 0.55, -3.6 + g0, 7.5, 4.2, S.paw || fur, { hi: 0.15, glint: false });
    toon(c, (p) => smooth(p, eggPts(hx, hy, hr * 1.05, hr * 0.98, 0.05, 12), true, 0.5), shade(fur, -0.02), { cx: hx, cy: hy, k: hr, tint: S.tint }, S.marks && S.marks.haunch ? (cc) => S.marks.haunch(cc, S, hx, hy, hr) : null);
    const pts = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, s = Math.sin(a); pts.push([B.x + Math.cos(a) * B.rx * (1 + 0.14 * s), B.y + s * B.ry]); }
    toon(c, (p) => smooth(p, pts, true, 0.5), fur, { cx: B.x, cy: B.y, k: B.ry, tint: S.tint }, (cc) => {
      if (S.belly) { cc.fillStyle = S.belly; ell(cc, B.x + B.rx * 0.55, B.y + B.ry * 0.15, B.rx * 0.55, B.ry * 0.8); cc.fill(); }
      if (S.marks && S.marks.body) S.marks.body(cc, S);
      neckAO(cc, S);
    });
  } else if (S.pose === 'lie') {
    const hx = B.x - B.rx * 0.45;
    toon(c, (p) => smooth(p, eggPts(B.x, B.y, B.rx, B.ry, -0.08, 16), true, 0.5), fur, { cx: B.x, cy: B.y, k: B.rx * 0.8, tint: S.tint }, bodyMarks(S));
    toon(c, (p) => smooth(p, eggPts(hx, B.y - 1, B.ry * 1.25, B.ry * 1.1, 0, 12), true, 0.5), fur, { cx: hx, cy: B.y, k: B.ry, tint: S.tint, hi: 0.15, glint: false }, S.marks && S.marks.haunch ? (cc) => S.marks.haunch(cc, S, hx, B.y, B.ry) : null);
  } else if (S.pose !== 'none') {
    const pts = B.pts ? B.pts(B) : eggPts(B.x, B.y, B.rx, B.ry, B.egg ?? 0.1, B.n || 16);
    const shape = B.fluffy ? (p) => scallop(p, pts, B.fluffy) : (p) => smooth(p, pts, true, 0.5);
    toon(c, shape, fur, { cx: B.x, cy: B.y, k: Math.max(B.rx, B.ry), tint: S.tint, rim: S.rim }, bodyMarks(S));
    if (S.pose === 'float' && !S.noPaws) {
      const pc = S.paw || fur;
      te(c, B.x + B.rx * 0.38, B.y + B.ry * 0.92, 5.6, 4.6, shade(pc, -0.12), { hi: 0.1, glint: false });
      te(c, B.x + B.rx * 0.72, B.y + B.ry * 0.78, 5.6, 4.6, pc, { hi: 0.15, glint: false });
    }
  }
  if (S.bodyFront) S.bodyFront(c, S);
}
function legSprite(S, far) {
  const L = S.legLen, w = S.legW;
  const darken = (col) => (far ? shade(col, -0.16) : col);
  const col = darken(S.legCol || S.fur), pawC = darken(S.paw || S.legCol || S.fur);
  const prx = w * 0.72 * S.pawK, pry = w * 0.5 * Math.max(1, S.pawK * 0.9);
  return sprite(-w * 2.5, -8, w * 5, L + 14, (c) => {
    toon(c, (p) => rr(p, -w / 2, -6, w, L + 6 - pry * 0.6, w / 2), col, { cx: 0, cy: L / 2, k: w, hi: 0.12, glint: false, depth: 0.3 }, S.legMarks ? (cc) => S.legMarks(cc, S, far) : null);
    toon(c, (p) => E(p, w * 0.2, L - pry, prx, pry), pawC, { cx: w * 0.2, cy: L - pry, k: prx, hi: 0.18, glint: false });
    // doigts de la patte
    c.beginPath(); for (const dx of [-0.12, 0.42]) { c.moveTo(w * 0.2 + prx * dx, L - pry * 1.7); c.lineTo(w * 0.2 + prx * dx + 0.4, L - pry * 1.05); }
    c.lineWidth = 1.5; c.strokeStyle = rgba(OUT, 0.75); c.lineCap = 'round'; c.stroke();
    if (S.pawFluff) { c.beginPath(); for (const dx of [-0.35, 0.2, 0.75]) { c.moveTo(w * 0.2 + prx * dx, L - pry * 1.9); c.lineTo(w * 0.2 + prx * dx + 1.5, L - pry * 1.2); } c.lineWidth = 1.6; c.strokeStyle = rgba(OUT, 0.6); c.stroke(); }
  });
}

// =====================================================================
//  Queues
// =====================================================================
function bandAt(c, sp, u, w, col, half) {
  const i = Math.round(u * (sp.length - 1)), [nx, ny] = normalAt(sp, i), [x, y] = sp[i];
  c.beginPath(); c.moveTo(x + nx * half, y + ny * half); c.lineTo(x - nx * half, y - ny * half);
  c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'butt'; c.stroke();
}
// courbure progressive de la colonne de la queue (b > 0 : la pointe s'enroule vers le corps)
function bendCtrl(ctrl, b) {
  const n = ctrl.length, out = [ctrl[0].slice()];
  for (let i = 1; i < n; i++) {
    const a = b * Math.pow(i / (n - 1), 1.2), ca = Math.cos(a), sa = Math.sin(a);
    const dx = ctrl[i][0] - ctrl[i - 1][0], dy = ctrl[i][1] - ctrl[i - 1][1], o = out[i - 1];
    out.push([o[0] + dx * ca - dy * sa, o[1] + dx * sa + dy * ca]);
  }
  return out;
}
function paintTail(c, S, bend = 0) {
  const T = S.tail;
  if (T.draw) { T.draw(c, S, T); return; }
  const sp = crSample(bend ? bendCtrl(T.ctrl, bend * (T.bendK ?? 0.75)) : T.ctrl, 8);
  const col = T.col || S.fur;
  if (T.type === 'fluff') {
    const n = T.n || 7, list = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), q = sp[Math.round(u * (sp.length - 1))]; list.push([q[0], q[1], lerp(T.w[0], T.w[1], u)]); }
    blob(c, list, col, { k: T.w[1] * 1.6, marks: T.tip ? (cc) => { const e = sp[sp.length - 1]; ell(cc, e[0], e[1], T.tipR || T.w[1] * 1.5, T.tipR || T.w[1] * 1.5); cc.fillStyle = T.tip; cc.fill(); } : null });
  } else {
    const pts = tubePts(sp, (u) => lerp(T.w[0], T.w[1], u) * (T.wf ? T.wf(u) : 1));
    const b = bbox(pts);
    toon(c, (p) => poly(p, pts), col, { cx: b.cx, cy: b.cy, k: Math.min(b.k, 16), hi: 0.2, rim: S.rim }, (cc) => {
      if (T.rings) for (const u of T.rings) bandAt(cc, sp, u, T.ringW || 3.6, T.ringC || S.fur2, 20);
      if (T.tip) { const e = sp[sp.length - 1]; ell(cc, e[0], e[1], T.tipR || T.w[1] * 2.2, T.tipR || T.w[1] * 2.2); cc.fillStyle = T.tip; cc.fill(); }
      if (T.marks) T.marks(cc, S, sp);
    });
  }
  if (T.after) T.after(c, S, sp);
}

// =====================================================================
//  Ailes (repère local : pivot à l'épaule (0,0), l'aile part en haut-arrière)
// =====================================================================
function wingPath(p, top, tips, bulge) {
  p.moveTo(0, 0);
  crTo(p, [[0, 0], ...top]);
  let prev = top[top.length - 1];
  const all = [...tips, [0, 0]];
  for (const q of all) {
    const mx = (prev[0] + q[0]) / 2, my = (prev[1] + q[1]) / 2;
    const dx = q[0] - prev[0], dy = q[1] - prev[1], L = Math.hypot(dx, dy) || 1;
    p.quadraticCurveTo(mx + (dy / L) * bulge, my - (dx / L) * bulge, q[0], q[1]);
    prev = q;
  }
  p.closePath();
}
function scalePts(pts, sx, sy = sx) { return pts.map(([x, y]) => [x * sx, y * sy]); }
function wingFeather(c, L, col, tipC, rows = 2) {
  const top = scalePts([[-0.08, -0.5], [-0.4, -0.92], [-0.85, -1.06], [-1.12, -0.98]], L);
  const tips = scalePts([[-1.16, -0.7], [-1.05, -0.42], [-0.88, -0.17], [-0.62, 0.02], [-0.32, 0.12]], L);
  const fn = (p) => wingPath(p, top, tips, -L * 0.07);
  toon(c, fn, col, { cx: -L * 0.55, cy: -L * 0.5, k: L * 0.6, hi: 0.3 }, (cc) => {
    if (tipC) { cc.fillStyle = tipC; cc.beginPath(); cc.moveTo(-L * 1.3, -L * 0.85); cc.quadraticCurveTo(-L * 0.9, -L * 0.6, -L * 0.6, -L * 0.18); cc.lineTo(-L * 0.2, L * 0.4); cc.lineTo(-L * 1.4, L * 0.4); cc.closePath(); cc.fill(); }
    // rangée de plumes de couverture (festons) + séparation des rémiges
    cc.strokeStyle = rgba(OUT, 0.5); cc.lineWidth = 1.8; cc.lineCap = 'round';
    for (let r = 0; r < rows; r++) {
      const k = 0.66 - r * 0.24;
      const row = tips.map(([x, y]) => [x * k, y * k - L * 0.14 * (1 - k)]);
      cc.beginPath(); cc.moveTo(row[0][0], row[0][1]);
      for (let i = 1; i < row.length; i++) { const a = row[i - 1], b = row[i]; cc.quadraticCurveTo((a[0] + b[0]) / 2 - L * 0.05, (a[1] + b[1]) / 2 + L * 0.07, b[0], b[1]); }
      cc.stroke();
    }
    for (const [x, y] of tips.slice(0, 4)) { cc.beginPath(); cc.moveTo(x * 0.68, y * 0.68 - L * 0.04); cc.lineTo(x * 0.97, y * 0.98); cc.stroke(); }
  });
}
function wingBat(c, L, col, bone, spikes) {
  const top = scalePts([[-0.3, -0.75], [-0.62, -1.0], [-1.05, -0.95]], L);
  const tips = scalePts([[-1.12, -0.48], [-0.86, -0.12], [-0.48, 0.06]], L);
  const fn = (p) => wingPath(p, top, tips, L * 0.12);
  toon(c, fn, col, { cx: -L * 0.55, cy: -L * 0.5, k: L * 0.6, hi: 0.18 }, (cc) => {
    cc.strokeStyle = bone; cc.lineWidth = 2.6; cc.lineCap = 'round';
    for (const q of [top[2], ...tips]) { cc.beginPath(); cc.moveTo(top[1][0], top[1][1]); cc.lineTo(q[0], q[1]); cc.stroke(); }
  });
  line2(c, [[0, 0], top[0], top[1]], 3.6, bone, 1.4);
  if (spikes) { const [x, y] = top[1]; cp(c, [[x - 2, y + 1], [x + 3, y - 9], [x + 4, y + 2]], spikes, { poly: true, lw: 1.8, hi: 0 }); }
}
function wingMoth(c, L, col, edge, spot) {
  const fore = scalePts([[0, 0], [-0.1, -0.6], [-0.5, -1.05], [-1.0, -1.05], [-0.95, -0.55], [-0.55, -0.12]], L);
  const hind = scalePts([[0, 0], [-0.55, 0.05], [-0.88, 0.32], [-1.25, 0.78], [-1.0, 0.36], [-0.62, 0.38], [-0.2, 0.25]], L);
  for (const pts of [hind, fore]) {
    tp(c, pts, col, { lw: LW2, hi: 0.3 }, (cc) => {
      cc.beginPath(); smooth(cc, pts, true, 0.5); cc.lineWidth = L * 0.16; cc.strokeStyle = edge; cc.stroke();
    });
  }
  const [sx, sy] = [-0.55 * L, -0.6 * L];
  ce(c, sx, sy, L * 0.13, L * 0.15, spot, { lw: 1.8, hi: 0.4 });
  ell(c, sx - 1, sy - 1, L * 0.05, L * 0.05); c.fillStyle = '#ffffff'; c.fill();
}

// mèches : un seul contour extérieur, bandes de couleur sans traits intérieurs
function strands(c, list) {
  const shapes = list.map(([ctrl, w0, w1, col]) => [tubePts(crSample(ctrl, 8), (u) => lerp(w0, w1, u)), col]);
  c.lineJoin = 'round'; c.lineWidth = LW2 * 2; c.strokeStyle = OUT;
  for (const [pts] of shapes) { c.beginPath(); poly(c, pts); c.stroke(); }
  for (const [pts, col] of shapes) tp(c, pts, col, { poly: true, lw: 0, hi: 0.3, glint: false, depth: 0.12 });
}

// =====================================================================
//  Accessoires réutilisables (repère tête : centre (0,0), rx≈30, ry≈26)
// =====================================================================
function bow(c, x, y, s, col, a = 0, knot) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  cp(c, [[-2, 2], [-8, 15], [-3, 13], [0, 16], [2, 3]], shade(col, -0.1), { poly: true, lw: 2 });
  cp(c, [[1, 2], [7, 14], [10, 10], [13, 13], [4, 1]], shade(col, -0.1), { poly: true, lw: 2 });
  cp(c, [[0, 0], [-6, -8], [-15, -10], [-18, -2], [-14, 7], [-5, 5]], col, { lw: 2.4 });
  cp(c, [[0, 0], [6, -8], [15, -10], [18, -2], [14, 7], [5, 5]], col, { lw: 2.4 });
  ce(c, 0, 0, 5, 5.5, knot || shade(col, -0.05), { lw: 2.2 });
  c.restore();
}
function flower5(c, x, y, r, col, center = '#ffd23f') {
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; ce(c, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.52, r * 0.42, col, { rot: a, lw: 1.8, hi: 0.3, glint: false }); }
  ce(c, x, y, r * 0.36, r * 0.36, center, { lw: 1.6 });
}
function halo(c, x, y, rx, ry, col = GOLD) {
  ell(c, x, y, rx, ry); c.lineWidth = ry * 1.25 + 4; c.strokeStyle = OUT; c.stroke();
  c.lineWidth = ry * 1.25; c.strokeStyle = col; c.stroke();
  ell(c, x - rx * 0.1, y - ry * 0.25, rx * 0.8, ry * 0.5); c.lineWidth = 1.6; c.strokeStyle = mix(col, '#ffffff', 0.7); c.stroke();
}

// =====================================================================
//  Marques génériques
// =====================================================================
function stripes(c, list, col, w) {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  for (const s of list) { c.beginPath(); c.moveTo(s[0], s[1]); if (s.length === 6) c.quadraticCurveTo(s[2], s[3], s[4], s[5]); else c.lineTo(s[2], s[3]); c.stroke(); }
}
function dots(c, list, col) { c.fillStyle = col; for (const [x, y, r, r2] of list) { ell(c, x, y, r, r2 ?? r * 0.85); c.fill(); } }
function tabbyHead(c, S, col, w = 3.4, cheeks = true) {
  const F = S.face, H = S.head, x = F.x - 2;
  stripes(c, [[x - 7, -H.ry - 2, x - 9, -H.ry * 0.72, x - 6, -H.ry * 0.5], [x, -H.ry - 2, x + 1, -H.ry * 0.72, x, -H.ry * 0.46], [x + 7, -H.ry - 2, x + 10, -H.ry * 0.72, x + 7, -H.ry * 0.5]], col, w);
  if (cheeks) stripes(c, [[-H.rx - 3, 2, -H.rx + 6, 0, -H.rx + 11, 3], [-H.rx - 3, 9, -H.rx + 5, 7, -H.rx + 9, 10], [H.rx + 3, 2, H.rx - 4, 0, H.rx - 8, 3]], col, w * 0.9);
}
function tabbyBody(c, S, col, n = 4, w = 4) {
  const B = S.body, list = [];
  for (let i = 0; i < n; i++) { const x = B.x - B.rx * 0.75 + (i * B.rx * 1.25) / (n - 1); list.push([x + 2, B.y - B.ry - 3, x - 3, B.y - B.ry * 0.4, x, B.y + B.ry * 0.05]); }
  stripes(c, list, col, w);
}
function patch(c, x, y, r, col, seed = 3) {
  const R = seeded(seed), pts = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, d = r * (0.78 + R() * 0.4); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
  c.beginPath(); smooth(c, pts, true, 0.5); c.fillStyle = col; c.fill();
}

// =====================================================================
//  LES 40 DESIGNS
//  Chaque fonction renvoie la description d'un chaton : posture, corps,
//  tête, couleurs, marques, queue, accessoires (statiques) et fx (animés).
// =====================================================================
const D = {};

// ------------------------------------------------------------------ COMMUN
// Mistigri : petit tigré gris des gouttières, oreille entaillée, pousse sur la tête.
D.mistigri = () => ({
  idle: 'bounce',
  fur: '#a5adbf', fur2: '#5f6880', belly: '#eef1f6', muzzle: '#eef1f6',
  face: { eye: '#46c46a', mouth: 'w' },
  ears: {
    after: (c, S, side, g) => {
      if (side > 0) return;
      // entaille de chat de gouttière
      const q = [lerp(g.b1[0], g.tip[0], 0.6), lerp(g.b1[1], g.tip[1], 0.6)];
      c.save(); c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.moveTo(q[0] - 4, q[1] - 3); c.lineTo(q[0] + 3.5, q[1] + 1); c.lineTo(q[0] - 3, q[1] + 5); c.closePath(); c.fill(); c.restore();
      c.beginPath(); c.moveTo(q[0] - 3.2, q[1] - 2.2); c.lineTo(q[0] + 2.4, q[1] + 1); c.lineTo(q[0] - 2.6, q[1] + 4.2); c.lineWidth = LW2; c.strokeStyle = OUT; c.stroke();
    },
  },
  marks: {
    head: (c, S) => tabbyHead(c, S, S.fur2, 3.6),
    body: (c, S) => tabbyBody(c, S, S.fur2, 4, 4.2),
  },
  tail: { ctrl: [[0, 0], [-9, -3], [-15, -14], [-12, -27], [-4, -31]], w: [5, 4.4], rings: [0.35, 0.55, 0.75], tip: '#5f6880' },
  headFront: (c) => {
    // pousse (nature)
    line2(c, [[1, -24], [3, -32], [1, -38]], 2.6, '#3f9a4a', 1.6);
    paintLeaf(c, 1, -38, 13, 5.5, -2.55, '#6fdc78');
    paintLeaf(c, 1, -38, 12, 5, -0.55, '#5fd068');
  },
});

// Caramel : boule dodue orange, nappage caramel sur la tête, yeux boutons, langue.
D.caramel = () => ({
  pose: 'ball', idle: 'wobble', legLen: 5, legW: 9,
  fur: '#f59a3e', belly: '#ffe6c2', muzzle: '#ffe6c2',
  body: { rx: 21, ry: 18 },
  head: { rx: 31, ry: 25, cheek: 0.2 },
  ears: { type: 'round', len: 14, wid: 0.36 },
  face: { eye: '#3a2a20', style: 'button', mouth: 'blep', rx: 7, ry: 8, sep: 12.5, blushA: 0.6 },
  marks: {
    head: (c, S) => {
      // nappage caramel brillant avec coulures
      const H = S.head;
      c.beginPath(); c.moveTo(-H.rx - 4, -H.ry * 0.35);
      const drips = [[-26, -12], [-20, -2], [-15, -13], [-9, -15], [-5, 0], [0, -14], [8, -16], [13, -5], [18, -15], [26, -12], [31, -14]];
      drips.forEach(([x, y], i) => { if (i % 3 === 1) { c.lineTo(x - 2.4, y - 8); c.quadraticCurveTo(x - 2.6, y + 2.6, x, y + 2.6); c.quadraticCurveTo(x + 2.6, y + 2.6, x + 2.4, y - 8); } else c.quadraticCurveTo(x - 3, y + 3, x, y); });
      c.lineTo(H.rx + 4, -H.ry * 0.6); c.lineTo(H.rx + 4, -H.ry - 6); c.lineTo(-H.rx - 4, -H.ry - 6); c.closePath();
      c.fillStyle = '#9c4a12'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = rgba(OUT, 0.7); c.stroke();
      ell(c, -10, -19, 7, 2.6, -0.3); c.fillStyle = 'rgba(255,230,190,0.8)'; c.fill();
      ell(c, 6, -21, 2.6, 1.6, -0.2); c.fill();
      ell(c, -20, -2, 0.9, 1.6); c.fill();
    },
  },
  tail: {
    ctrl: [[0, 0], [-8, -1], [-13, -8], [-10, -15], [-4, -14], [-5, -9]], w: [5.5, 4.5], tip: '#b8601a',
    after: (c, S, sp) => { const e = sp[sp.length - 1]; paintFlame(c, e[0] - 1, e[1] - 3, 6, 9, -1); },
  },
});

// Biscotte : persan crème tout en poils, visage plat, gros nœud rose.
D.biscotte = () => ({
  idle: 'breathe', legLen: 8, legW: 9.5, pawK: 1.1,
  fur: '#f7dcb0', belly: '#fff3de', muzzle: '#fff3de',
  body: { rx: 23, ry: 15, fluffy: 3.6, n: 18 },
  head: { rx: 30, ry: 26, cheek: 0.14 },
  ruff: { col: '#fff3de', n: 11, amp: 0.22, a0: 1.35, a1: TAU - 1.35, soft: true, sx: 1.12, sy: 1.12 },
  ears: { type: 'round', len: 11, wid: 0.32, aL: -0.62, aR: 0.74 },
  face: { eye: '#4aa9ff', mouth: 'o', y: 4, sep: 12, rx: 8, ry: 9.2, ny: 7.5, lash: true },
  tail: { type: 'fluff', ctrl: [[0, 0], [-10, -4], [-16, -16], [-12, -30]], w: [6, 9], n: 6, tip: '#fff3de' },
  headFront: (c) => {
    bow(c, 20, -24, 1.05, '#ff7aa8', 0.35);
    sparkle(c, 33, -36, 5, '#fff2a0', 1.4);
  },
});

// Charbon : chat noir élancé, grands yeux lune, queue en point d'interrogation, boule de suie.
D.charbon = () => ({
  idle: 'sway', legLen: 17, legW: 7,
  fur: '#4b4568', belly: '#645c80', muzzle: null, rim: '#8a7cc0',
  body: { rx: 18, ry: 10 },
  head: { rx: 27, ry: 25, chin: 0.28, cheek: 0.02 },
  ears: { len: 27, wid: 0.32, inner: '#8c6aa8' },
  face: { eye: '#ffd84d', style: 'moon', rx: 8.4, ry: 9.6, sep: 11.5, mouth: 'w', blushA: 0.25 },
  tail: { ctrl: [[0, 0], [-5, -9], [-7, -24], [-4, -38], [5, -45], [12, -40], [10, -32]], w: [3.8, 3.4] },
  sprites: {
    soot: [-15, -15, 30, 30, (c) => {
      const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; pts.push([Math.cos(a) * 9, Math.sin(a) * 9]); }
      toon(c, (p) => scallop(p, pts, -3), '#2a2438', { k: 9, hi: 0.18, lw: 2 });
      for (const x of [-3, 3]) { ell(c, x, -0.5, 2.6, 3); c.fillStyle = '#ffffff'; c.fill(); ell(c, x + 0.5, 0.2, 1.2, 1.5); c.fillStyle = '#1d1530'; c.fill(); }
    }],
  },
  fxBack: (ctx, R, P) => {
    const t = P.t, x = -38 + Math.sin(t * 1.3) * 3, y = -44 + Math.sin(t * 2.6) * 4;
    blit(ctx, R.soot, x, y, Math.sin(t * 2) * 0.2);
  },
});

// Flocon : boule de neige blanche, bonnet à pompon bleu, queue pompon.
D.flocon = () => ({
  idle: 'bounce', legLen: 9, legW: 9,
  fur: '#f7f9ff', belly: '#ffffff', muzzle: '#ffffff', tint: '#c3cdef',
  body: { rx: 21, ry: 15, fluffy: 3, n: 16 },
  head: { rx: 30, ry: 26, cheek: 0.14 },
  ears: { len: 21, wid: 0.32, aL: -0.66, aR: 0.8, tilt: 0.12 },
  face: { eye: '#4aa9ff', mouth: 'w', blushA: 0.6 },
  tail: { type: 'fluff', ctrl: [[0, 0], [-5, -3], [-8, -6]], w: [7, 8], n: 3 },
  headFront: (c) => {
    const dome = [[-28, -10], [-27, -26], [-14, -38], [4, -41], [21, -37], [31, -24], [30, -10], [2, -17]];
    tp(c, dome, '#5fb8ff', { tension: 0.45 }, (cc) => {
      cc.strokeStyle = '#ffffff'; cc.lineWidth = 3.5;
      for (const y of [-26, -33]) { cc.beginPath(); cc.moveTo(-32, y + 8); cc.quadraticCurveTo(2, y - 4, 34, y + 8); cc.stroke(); }
    });
    // revers côtelé
    line2(c, [[-29, -9], [1, -21], [31, -8]], 7, '#e6f4ff', LW2);
    c.strokeStyle = rgba('#7fb0dd', 0.9); c.lineWidth = 1.4;
    for (let i = -24; i <= 26; i += 6) { const y = -10 - (1 - Math.pow(i / 30, 2)) * 8; c.beginPath(); c.moveTo(i, y - 3); c.lineTo(i, y + 3); c.stroke(); }
    const pom = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; pom.push([3 + Math.cos(a) * 8.5, -45 + Math.sin(a) * 8]); }
    toon(c, (p) => scallop(p, pom, 2.2), '#ffffff', { cx: 3, cy: -45, k: 9, tint: '#c3cdef' });
  },
});

// Poivre : savannah tacheté, très grandes oreilles, poils électrisés.
D.poivre = () => ({
  idle: 'jitter', legLen: 15, legW: 7.5,
  fur: '#d8dde6', fur2: '#3a3646', belly: '#f4f6fa', muzzle: '#f4f6fa',
  body: { rx: 20, ry: 11 },
  head: { rx: 28, ry: 25, chin: 0.12 },
  ears: { type: 'big', len: 30, wid: 0.44, aL: -0.6, aR: 0.72, tilt: 0.1 },
  face: { eye: '#46c46a', mouth: 'smile' },
  marks: {
    head: (c, S) => dots(c, [[-14, -18, 3.2], [-4, -21, 2.8], [14, -20, 2.6], [-22, -6, 3], [-24, 6, 2.6], [26, -8, 2.4]], S.fur2),
    body: (c, S) => { const B = S.body; dots(c, [[B.x - 12, B.y - 6, 3.4], [B.x - 2, B.y - 8, 3], [B.x + 8, B.y - 6, 2.8], [B.x - 16, B.y + 2, 2.8], [B.x - 6, B.y, 3], [B.x + 4, B.y + 1, 2.6], [B.x + 13, B.y - 1, 2.4]], S.fur2); },
  },
  legMarks: (c, S) => dots(c, [[0, 4, 2.2], [1, 10, 2]], S.fur2),
  tail: {
    draw: (c, S) => {
      // queue hérissée (électricité statique)
      const sp = crSample([[0, 0], [-10, -6], [-16, -18], [-14, -30]], 8);
      const pts = tubePts(sp, (u) => lerp(4.5, 5.5, u)).map((q, i) => { if (i % 2) return q; const m = sp[Math.min(sp.length - 1, Math.floor(i / 2) % sp.length)]; return [q[0] + (q[0] - m[0]) * 0.5, q[1] + (q[1] - m[1]) * 0.5]; });
      tp(c, pts, S.fur, { poly: true, hi: 0.2 }, (cc) => { const e = sp[sp.length - 1]; ell(cc, e[0], e[1], 9, 9); cc.fillStyle = S.fur2; cc.fill(); });
    },
  },
  headFront: (c, S) => {
    const pts = [[-12, -22], [-14, -34], [-6, -27], [-2, -39], [4, -27], [11, -35], [11, -22]];
    tp(c, pts, S.fur, { poly: true, lw: LW2, hi: 0.2, glint: false });
    sparkle(c, 18, -38, 5.5, '#ffe14d', 1.5);
    sparkle(c, -18, -36, 3.5, '#ffe14d', 1.3);
  },
});

// ------------------------------------------------------------------ PEU COMMUN
// Moka : munchkin chocolat aux pattes courtes, cœur « latte » sur le front, feuille-parapluie.
D.moka = () => ({
  idle: 'breathe', legLen: 5, legW: 8.5,
  fur: '#7d4c30', fur2: '#4e2c1a', belly: '#d9ae86', muzzle: '#d9ae86',
  body: { rx: 25, ry: 13, hipK: 0.5 },
  head: { rx: 29, ry: 26, cheek: 0.1 },
  face: { eye: '#ffad2e', mouth: 'w' },
  marks: {
    head: (c, S) => {
      c.beginPath(); heartPath(c, S.face.x - 2, -16, 5.5); c.fillStyle = '#f3dcc0'; c.fill();
      stripes(c, [[-31, 3, -24, 1, -20, 4], [-31, 9, -25, 8, -22, 11]], S.fur2, 3);
    },
    body: (c, S) => tabbyBody(c, S, S.fur2, 5, 3.6),
  },
  tail: { ctrl: [[0, 0], [-10, -2], [-18, -10], [-20, -22]], w: [4.8, 4.2], rings: [0.4, 0.62, 0.84] },
  headFront: (c) => {
    // feuille-parapluie posée sur la tête
    const top = [[-26, -27], [-18, -42], [0, -50], [18, -46], [32, -32]];
    const bot = [[32, -32], [22, -30], [14, -34], [4, -29], [-6, -34], [-16, -28], [-26, -27]];
    const fn = (p) => { p.moveTo(-26, -27); crTo(p, top); for (let i = 1; i < bot.length; i++) { const a = bot[i - 1], b = bot[i]; p.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 4, b[0], b[1]); } p.closePath(); };
    toon(c, fn, '#5fd068', { cx: 3, cy: -38, k: 26 }, (cc) => {
      cc.strokeStyle = '#2f8a3e'; cc.lineWidth = 1.8;
      cc.beginPath(); cc.moveTo(-22, -30); cc.quadraticCurveTo(2, -48, 30, -33); cc.stroke();
      for (const x of [-12, -2, 8, 18]) { cc.beginPath(); cc.moveTo(x, -42 + Math.abs(x - 3) * 0.25); cc.lineTo(x + 3, -31); cc.stroke(); }
    });
    line2(c, [[0, -49], [-2, -56], [3, -60]], 2.6, '#3f9a4a', 1.6);
  },
});

// Praline : maneki-neko calico assis, patte qui salue, collier rouge et grelot d'or, pièce.
D.praline = () => ({
  pose: 'sit', idle: 'breathe', legW: 8.5, raisedPaw: true,
  fur: '#fbf6ee', belly: '#ffffff', muzzle: null,
  body: { rx: 13, ry: 16, hr: 12 },
  head: { rx: 30, ry: 26 },
  ears: { inner: '#ff7a8a' },
  face: { eye: '#46c46a', mouth: 'w', style: 'happy' },
  marks: {
    head: (c) => { patch(c, -22, -16, 12, '#e8873a', 5); patch(c, 26, -20, 7, '#3a3646', 9); },
    haunch: (c, S, x, y, r) => { patch(c, x - 4, y - 4, r * 0.8, '#e8873a', 11); patch(c, x + 6, y + 6, r * 0.4, '#3a3646', 2); },
  },
  tail: { type: 'fluff', ctrl: [[0, 0], [-4, -3]], w: [6, 6.5], n: 2, col: '#e8873a' },
  headBack: (c) => flower5(c, 26, -30, 8, '#ff9ac0', '#ffe066'),
  bodyFront: (c, S) => {
    const B = S.body;
    line2(c, [[B.x - 10, B.y - 12], [B.x + 2, B.y - 7], [B.x + 13, B.y - 11]], 4.5, '#e8323f');
    ce(c, B.x + 6, B.y - 5, 5, 5, GOLD, { lw: 2.2 });
    c.beginPath(); c.moveTo(B.x + 2, B.y - 4); c.lineTo(B.x + 10, B.y - 4); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  },
  over: (c, S) => {
    // koban d'or posé contre le torse
    const x = S.body.x + 15, y = -9;
    ce(c, x, y, 6, 9, GOLD, { lw: 2.2, hi: 0.35 });
    c.strokeStyle = GOLD_D; c.lineWidth = 1.2;
    for (const dy of [-4, 0, 4]) { c.beginPath(); c.moveTo(x - 3, y + dy); c.lineTo(x + 3, y + dy); c.stroke(); }
  },
  fxFront: (ctx, R, P) => { if (P.st === 'idle') twinkles(ctx, [[R.S.body.x + 17, -15, 3.5, 0]], P.t, '#fff2a0', 2.4); },
});

// Grisou : bleu russe en ciré de marin breton (chapeau jaune), petite goutte.
D.grisou = () => ({
  idle: 'breathe',
  fur: '#7e93b8', belly: '#c9d4e8', muzzle: '#c9d4e8',
  head: { rx: 30, ry: 26 },
  ears: { len: 18, wid: 0.3, aL: -0.38, aR: 0.5, tilt: -0.05 },
  face: { eye: '#e8873a', mouth: 'w' },
  headFront: (c) => {
    const brim = [[-40, 8], [-42, -6], [-34, -18], [-12, -24], [14, -24], [32, -18], [38, -12], [30, -10], [12, -14], [-14, -13], [-26, -8], [-30, 6]];
    tp(c, brim, '#ffcc2e', { tension: 0.4 });
    const crown = [[-22, -15], [-22, -30], [-10, -39], [8, -40], [20, -32], [22, -16], [0, -20]];
    tp(c, crown, '#ffd84a', { tension: 0.45 }, (cc) => { cc.strokeStyle = '#e0a81a'; cc.lineWidth = 2; cc.beginPath(); cc.moveTo(-1, -40); cc.quadraticCurveTo(2, -30, 0, -20); cc.stroke(); });
    // goutte d'eau sur le bord
    fillStroke(c, (p) => { p.moveTo(37, -13); p.bezierCurveTo(39, -9, 40.5, -7, 40.5, -4.5); p.arc(37.5, -4.5, 3, 0, Math.PI); p.bezierCurveTo(34.5, -7, 35.5, -9, 37, -13); p.closePath(); }, '#7fd8ff', 1.6);
  },
  bodyFront: (c, S) => {
    const B = S.body, x = B.x + B.rx * 0.9, y = B.y - B.ry * 0.5;
    line2(c, [[x - 10, y - 4], [x, y + 3], [x + 6, y - 2]], 4, '#3fa9ff');
    ce(c, x + 1, y + 5, 4.5, 4.5, GOLD, { lw: 2 });
  },
  tail: { ctrl: [[0, 0], [-9, -2], [-15, -12], [-12, -24]], w: [5, 4.4] },
});

// Tigrou : petit bagarreur tigré, costaud, grosses pattes, bandeau rouge flottant.
D.tigrou = () => ({
  idle: 'bounce', legLen: 10, legW: 10, pawK: 1.25,
  fur: '#f4983c', fur2: '#a8420f', belly: '#fff0dc', muzzle: '#fff0dc',
  body: { rx: 22, ry: 15 },
  head: { rx: 32, ry: 26, cheek: 0.16 },
  ears: { len: 19, wid: 0.36 },
  face: { eye: '#46c46a', mouth: 'fang', brow: 1, sep: 12.5 },
  marks: {
    head: (c, S) => { tabbyHead(c, S, S.fur2, 4.4); },
    body: (c, S) => tabbyBody(c, S, S.fur2, 4, 5),
  },
  tail: { ctrl: [[0, 0], [-10, -3], [-16, -14], [-13, -25]], w: [6.5, 5.5], rings: [0.3, 0.5, 0.7], tip: '#a8420f', ringW: 4.4 },
  headBack: (c) => {
    // pans du bandeau qui flottent derrière
    tp(c, [[-28, -10], [-46, -2], [-52, 8], [-44, 4], [-30, -4]], '#d92a36', { lw: LW2 });
    tp(c, [[-28, -8], [-40, 10], [-38, 20], [-34, 10], [-26, -2]], '#c0182c', { lw: LW2 });
  },
  headFront: (c) => {
    line2(c, [[-31, -8], [-4, -22], [32, -9]], 6.5, '#e8323f', LW2);
    ce(c, -29, -7, 5, 4.5, '#c0182c', { lw: 2 });
  },
});

// Noisette : chat-écureuil assis, joues pleines, noisette serrée, queue en panache géante.
D.noisette = () => ({
  pose: 'sit', idle: 'breathe', legs: 'none',
  fur: '#c97f4c', belly: '#f6dcc0', muzzle: '#f6dcc0',
  body: { rx: 13, ry: 15, hr: 12 },
  head: { rx: 31, ry: 25, cheek: 0.26, s: 0.92 },
  ears: { type: 'tuft', len: 18, tuftLen: 8, tuftC: '#8a4a22', wid: 0.32 },
  face: { eye: '#46c46a', mouth: 'w', blushA: 0.6 },
  tail: {
    type: 'fluff', ctrl: [[0, 0], [-12, -8], [-20, -26], [-18, -46], [-6, -60], [6, -60]], w: [7, 12], n: 9, col: '#d98f5a', tip: '#f6dcc0', tipR: 12,
  },
  tailK: 0.06,
  headFront: (c) => flower5(c, 24, -24, 7, '#ffe14d', '#e8873a'),
  over: (c, S) => {
    // noisette tenue à deux pattes
    const B = S.body, x = B.x + 13, y = B.y + 8;
    ce(c, x + 1, y + 2, 8.5, 8, '#b06a32', { lw: 2.4 });
    cp(c, [[x - 8, y - 2], [x - 6, y - 10], [x + 1, y - 11], [x + 9, y - 9], [x + 10, y - 2], [x + 1, y - 4]], '#6e3f1e', { lw: 2.2 });
    line2(c, [[x + 1, y - 10], [x + 3, y - 15]], 2, '#6e3f1e', 1.4);
    te(c, x - 7, y + 3, 5, 4.4, S.fur, { hi: 0.15, glint: false });
    te(c, x + 9, y + 4, 5, 4.4, S.fur, { hi: 0.15, glint: false });
  },
});

// Pixel : tuxedo gamer, casque audio à LED, yeux « pixel », hoche la tête en rythme.
D.pixel = () => ({
  idle: 'bop',
  fur: '#6b7286', belly: '#fbf8f4', paw: '#fbf8f4',
  face: { eye: '#9ff0ff', style: 'pixel', mouth: 'w' },
  marks: {
    head: (c, S) => {
      const F = S.face;
      c.beginPath(); c.moveTo(F.x + 1, -6); c.quadraticCurveTo(F.x - 12, 6, F.x - 16, 30); c.lineTo(F.x + 20, 30); c.quadraticCurveTo(F.x + 14, 6, F.x + 1, -6); c.closePath();
      c.fillStyle = '#fbf8f4'; c.fill();
    },
  },
  tail: {
    // queue en escalier de pixels (8 bits)
    draw: (c, S) => {
      const cells = [[-1, 0], [-2, 0], [-2, -1], [-3, -1], [-3, -2], [-3, -3], [-3, -4], [-2, -4], [-2, -5]];
      const q = 6.2, rect = (x, y) => [x * q, y * q - q / 2, q, q];
      c.lineJoin = 'miter'; c.lineWidth = LW * 2; c.strokeStyle = OUT;
      for (const [x, y] of cells) c.strokeRect(...rect(x, y));
      cells.forEach(([x, y], i) => {
        const [rx, ry, w, h] = rect(x, y), col = i >= cells.length - 2 ? '#fbf8f4' : S.fur;
        c.fillStyle = col; c.fillRect(rx, ry, w, h);
        c.fillStyle = shade(col, 0.25); c.fillRect(rx, ry, w, 1.6);
        c.fillStyle = shade(col, -0.22); c.fillRect(rx + w - 1.6, ry, 1.6, h);
      });
    },
  },
  headFront: (c) => {
    line2(c, [[-31, -2], [-24, -46], [26, -46], [30, -2]], 5.5, '#2f3550', LW2);
    rr(c, -40, -12, 13, 24, 6); paint2(c, '#3a4262');
    rr(c, -37, -8, 7, 16, 3.5); c.fillStyle = '#ffe14d'; c.fill();
    rr(c, 26, -10, 10, 20, 5); paint2(c, '#3a4262');
    c.beginPath(); poly(c, boltPts(-33.5, 0, 6)); c.fillStyle = '#2f3550'; c.fill();
  },
  fxHead: (ctx, R, P) => addGlow(ctx, -33.5, 0, 10, '#ffe14d', 0.35 + Math.sin(P.t * 6) * 0.15),
});
function paint2(c, col, lw = LW2) { c.fillStyle = col; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }

// ------------------------------------------------------------------ RARE
// Flammèche : rouquin agile, queue-flamme vacillante, pointes d'oreilles en braise.
D.flammeche = () => ({
  idle: 'bounce', legLen: 13, legW: 7.5,
  fur: '#ff8a3d', fur2: '#c2410c', belly: '#ffe0b0', muzzle: '#ffe0b0',
  body: { rx: 20, ry: 11 },
  head: { rx: 29, ry: 25 },
  ears: { tip: '#ffd23f', tipK: 0.36, inner: '#ff5a3d' },
  face: { eye: '#ffd84d', mouth: 'fang', style: 'sparkle' },
  marks: {
    head: (c, S) => stripes(c, [[-31, 0, -24, -2, -20, 2], [31, -2, 25, -2, 22, 2]], S.fur2, 3.4),
    body: (c, S) => tabbyBody(c, S, S.fur2, 3, 4),
  },
  tail: { ctrl: [[0, 0], [-8, -4], [-13, -14], [-12, -22]], w: [4.4, 4.6], tip: '#ffd23f', tipR: 5 },
  headFront: (c) => paintFlame(c, 2, -23, 12, 18, 3),
  sprites: { flame: [-16, -40, 32, 46, (c) => paintFlame(c, 0, 0, 20, 34, -3)] },
  tailFx: (ctx, R, P) => {
    const t = P.t, f = Math.sin(t * 17) * 0.06 + Math.sin(t * 29) * 0.05;
    addGlow(ctx, -12, -32, 18, '#ff7a1a', 0.45);
    blit(ctx, R.flame, -12, -20, Math.sin(t * 7) * 0.12 - 0.15, 1 + f, 1 - f * 1.6 + (P.run ? 0.15 : 0));
  },
  fxFront: (ctx, R, P) => rising(ctx, P.t, 3, -40, -40, 22, 28, 18, (cx, x, y, u) => addSpark(cx, x, y, 2.6 * (1 - u), '#ffb03a', 1 - u)),
});

// Givre : siamois oriental (tête en triangle), points bleus, queue de cristaux, tiare de givre.
D.givre = () => ({
  idle: 'sway', legLen: 15, legW: 7,
  fur: '#f2f6ff', fur2: '#4a7ab8', belly: '#ffffff', tint: '#c2cdee',
  legCol: '#f2f6ff', paw: '#4a7ab8',
  body: { rx: 19, ry: 10.5 },
  head: { rx: 27, ry: 25, chin: 0.42, cheek: -0.05 },
  ears: { type: 'big', len: 29, wid: 0.36, col: '#5a86c0', inner: '#9fb8e6', aL: -0.6, aR: 0.74, tilt: 0.12 },
  face: { eye: '#7fe9ff', mouth: 'w', lash: true },
  marks: {
    head: (c, S) => {
      const F = S.face, g = c.createRadialGradient(F.x + 1, 12, 2, F.x + 1, 12, 22);
      g.addColorStop(0, rgba('#4a7ab8', 0.95)); g.addColorStop(0.5, rgba('#4a7ab8', 0.6)); g.addColorStop(1, rgba('#4a7ab8', 0));
      c.fillStyle = g; c.fillRect(-40, -30, 80, 70);
    },
  },
  legMarks: (c) => { const g = c.createLinearGradient(0, 2, 0, 12); g.addColorStop(0, rgba('#4a7ab8', 0)); g.addColorStop(1, rgba('#4a7ab8', 1)); c.fillStyle = g; c.fillRect(-10, 0, 20, 20); },
  tail: {
    ctrl: [[0, 0], [-10, -4], [-17, -16], [-16, -30]], w: [3.6, 3.2], col: '#5a86c0',
    after: (c, S, sp) => {
      const [x, y] = sp[sp.length - 1];
      crystal(c, x - 5, y + 3, 5, 12, -0.6, '#bff4ff');
      crystal(c, x + 4, y + 3, 5, 11, 0.55, '#a8ecff');
      crystal(c, x, y + 2, 6.5, 17, 0, '#dffbff');
    },
  },
  headFront: (c, S) => {
    const x = S.face.x - 2;
    crystal(c, x - 6, -21, 4, 8, -0.4, '#bff4ff', 1.8);
    crystal(c, x + 6, -21, 4, 8, 0.4, '#bff4ff', 1.8);
    crystal(c, x, -20, 5.5, 13, 0, '#e6fcff', 1.8);
  },
  fxBack: (ctx, R, P) => twinkles(ctx, [[-44, -60, 4, 0], [-30, -24, 3, 2], [40, -72, 3.5, 4]], P.t, '#bff4ff', 2.2),
  tailFx: (ctx, R, P) => addGlow(ctx, -16, -38, 14, '#7fe9ff', 0.35 + Math.sin(P.t * 3) * 0.1),
});

// Étincelle : aviateur doré, lunettes de pilote sur le front, écharpe au vent, queue-étincelle.
D.etincelle = () => ({
  idle: 'bounce',
  fur: '#ffc94a', fur2: '#e09a1a', belly: '#fff1c2', muzzle: '#fff1c2',
  face: { eye: '#4aa9ff', mouth: 'open', style: 'sparkle' },
  marks: {
    body: (c, S) => { const B = S.body; c.beginPath(); poly(c, boltPts(B.x - 2, B.y - 2, 13, -0.5)); c.fillStyle = S.fur2; c.fill(); },
  },
  tail: { ctrl: [[0, 0], [-10, -3], [-16, -14], [-13, -26]], w: [4.8, 4.2], tip: '#fff1c2' },
  headFront: (c) => {
    line2(c, [[-30, -6], [0, -19], [30, -7]], 4.5, '#7a4a2a', LW2);
    for (const [x, y, r] of [[-5, -20, 8], [13, -21, 7.2]]) {
      ell(c, x, y, r, r); paint2(c, '#c9a227', LW2);
      ell(c, x, y, r * 0.68, r * 0.68); c.fillStyle = '#8fe6ff'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
      ell(c, x - r * 0.25, y - r * 0.25, r * 0.22, r * 0.16, -0.6); c.fillStyle = '#ffffff'; c.fill();
    }
  },
  bodyFront: (c, S) => {
    const B = S.body, x = B.x + B.rx * 0.75, y = B.y - B.ry * 0.7;
    line2(c, [[x - 10, y - 2], [x, y + 3], [x + 10, y - 2]], 6, '#ffffff', LW2);
  },
  sprites: {
    scarf: [-62, -20, 70, 36, (c) => {
      const sp = crSample([[0, 0], [-12, -4], [-24, 1], [-36, -3], [-48, 1]], 8);
      tp(c, tubePts(sp, (u) => lerp(4.6, 3.8, u)), '#ffffff', { poly: true, lw: LW2, tint: '#c8d0ec', hi: 0.2 }, (cc) => { for (const u of [0.78, 0.9]) bandAt(cc, sp, u, 2.6, '#3fa9ff', 8); });
      const [x, y] = sp[sp.length - 1];
      c.strokeStyle = OUT; c.lineWidth = 1.6; for (const d of [-3, 0, 3]) { c.beginPath(); c.moveTo(x - 1, y + d); c.lineTo(x - 6, y + d * 1.4); c.stroke(); }
    }],
  },
  fxMid: (ctx, R, P) => {
    const S = R.S, sp = P.run ? 16 : 6, a = P.run ? 0.16 : 0.1;
    blit(ctx, R.scarf, S.body.x + S.body.rx * 0.6, S.body.y - S.body.ry * 0.85, 0.12 + Math.sin(P.t * sp) * a, 1 + (P.run ? 0.08 : 0), 1 + Math.sin(P.t * sp * 1.7) * 0.25);
  },
  tailFx: (ctx, R, P) => {
    const s = 7 + Math.sin(P.t * 9) * 1.5;
    addSpark(ctx, -13, -29, s, '#ffe14d', 1, P.t * 2);
    addSpark(ctx, -13, -29, s * 0.6, '#ffffff', 0.8, -P.t * 3);
  },
});

// Mousse : chaton couvert de mousse, gros champignon rouge sur la tête, yeux endormis.
D.mousse = () => ({
  idle: 'breathe', legLen: 8, legW: 9,
  fur: '#9fe6c6', fur2: '#3a9a5a', belly: '#e6fff2', muzzle: '#e6fff2',
  body: { rx: 22, ry: 14 },
  head: { rx: 30, ry: 26, cheek: 0.1 },
  ears: { type: 'round', len: 15, wid: 0.34 },
  face: { eye: '#ffad2e', mouth: 'w', lid: [0.42, 0.42] },
  marks: {
    head: (c, S) => { stripes(c, [[-31, 4, -25, 2, -21, 5]], S.fur2, 3); },
    body: (c, S) => {
      const B = S.body;
      for (const [x, y, r, s] of [[B.x - 10, B.y - 10, 9, 3], [B.x + 4, B.y - 12, 7, 7], [B.x - 18, B.y - 2, 6, 5]]) {
        const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75]); }
        c.beginPath(); scallop(c, pts, 2); c.fillStyle = '#4fb86a'; c.fill();
        dots(c, [[x - 2, y - 1, 1.2], [x + 3, y + 1, 1]], '#7ee08f');
      }
    },
  },
  tail: {
    ctrl: [[0, 0], [-9, -3], [-14, -13], [-12, -24]], w: [5, 4.4],
    after: (c, S, sp) => { const e = sp[sp.length - 1]; paintLeaf(c, e[0], e[1], 11, 4.5, -2.2, '#5fd068'); paintLeaf(c, e[0], e[1], 10, 4, -0.9, '#6fdc78'); },
  },
  bodyFront: (c, S) => {
    const B = S.body;
    for (const [x, y, s] of [[B.x - 6, B.y - 13, 1], [B.x - 15, B.y - 9, 0.75]]) {
      rr(c, x - 1.6 * s, y - 2, 3.2 * s, 6 * s, 1.4); paint2(c, '#fff4e0', 1.6);
      cp(c, [[x - 5 * s, y - 1], [x - 3 * s, y - 5 * s], [x + 3 * s, y - 5 * s], [x + 5 * s, y - 1]], '#c26a3a', { lw: 1.8 });
    }
  },
  headFront: (c) => {
    rr(c, -3, -36, 9, 12, 4); paint2(c, '#fff4e0');
    const cap = [[-26, -30], [-20, -46], [0, -55], [20, -50], [30, -36], [2, -32]];
    tp(c, cap, '#e8323f', { tension: 0.5 }, (cc) => dots(cc, [[-12, -42, 3.6], [2, -48, 3], [14, -42, 3.4], [-2, -38, 2.4], [22, -38, 2.2]], '#ffffff'));
  },
});

// Bulle : chaton bleu tacheté dans une bouée canard, bulles qui montent.
D.bulle = () => ({
  idle: 'water',
  fur: '#8ec5ff', fur2: '#3f7fd0', belly: '#e4f2ff', muzzle: '#e4f2ff',
  face: { eye: '#2f7fe0', mouth: 'o', blushA: 0.55 },
  marks: {
    head: (c, S) => dots(c, [[-16, -18, 3.4], [-6, -22, 2.6], [-24, -2, 2.8], [24, -16, 2.6]], S.fur2),
    body: (c, S) => { const B = S.body; dots(c, [[B.x - 12, B.y - 7, 3.2], [B.x - 2, B.y - 9, 2.6], [B.x - 18, B.y, 2.6]], S.fur2); },
  },
  tail: { ctrl: [[0, 0], [-10, -3], [-16, -13], [-12, -24]], w: [4.8, 4.2], rings: [0.5, 0.75], ringC: '#3f7fd0' },
  under: (c, S) => {
    const B = S.body;
    ell(c, B.x + 2, B.y + 1, B.rx + 9, 8); c.lineWidth = 14; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 9; c.strokeStyle = '#e8b81a'; c.stroke();
  },
  over: (c, S) => {
    const B = S.body, cx = B.x + 2, cy = B.y + 1, rx = B.rx + 9;
    c.save(); c.beginPath(); c.rect(cx - rx - 12, cy, rx * 2 + 24, 20); c.clip();
    ell(c, cx, cy, rx, 8); c.lineWidth = 14; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 9; c.strokeStyle = '#ffd23f'; c.stroke();
    c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,255,255,0.7)'; ell(c, cx, cy + 2, rx - 2, 6.5); c.stroke();
    c.restore();
  },
  sprites: {
    duck: [-12, -12, 30, 24, (c) => {
      te(c, 0, 0, 7.5, 7, '#ffd23f', { lw: 2.4 });
      cp(c, [[5, 0], [13, -1.5], [14, 2], [6, 3.5]], '#ff8a1f', { lw: 2 });
      ell(c, 2, -2.5, 1.6, 2); c.fillStyle = OUT; c.fill();
      ell(c, 1.5, -3.2, 0.6, 0.6); c.fillStyle = '#ffffff'; c.fill();
    }],
  },
  fxMid: (ctx, R, P) => { const B = R.S.body; blit(ctx, R.duck, B.x + B.rx + 12, B.y + 3 + Math.sin(P.t * 3) * 0.8, Math.sin(P.t * 2) * 0.08); },
  fxFront: (ctx, R, P) => rising(ctx, P.t, 4, 20, -60, 20, 40, 14, (cx, x, y, u) => {
    cx.globalAlpha = 1 - u * u; ell(cx, x, y, 2.4 + u * 1.6, 2.4 + u * 1.6); cx.lineWidth = 1.6; cx.strokeStyle = '#ffffff'; cx.stroke();
    cx.fillStyle = 'rgba(191,244,255,0.35)'; cx.fill(); cx.globalAlpha = 1;
  }),
});

// Sushi : calico dodu coiffé d'un nigiri saumon, bavoir bleu à vagues, queue de poisson.
D.sushi = () => ({
  idle: 'wobble', legLen: 9, legW: 9,
  fur: '#fbf6ee', belly: '#ffffff',
  body: { rx: 22, ry: 14 },
  head: { rx: 31, ry: 26, cheek: 0.12 },
  face: { eye: '#e8873a', mouth: 'blep' },
  marks: {
    head: (c) => { patch(c, -24, -10, 11, '#e8873a', 4); patch(c, 22, -18, 8, '#3a3646', 8); },
    body: (c, S) => { const B = S.body; patch(c, B.x - 10, B.y - 6, 9, '#e8873a', 7); patch(c, B.x + 4, B.y - 9, 6, '#3a3646', 3); },
  },
  tail: {
    ctrl: [[0, 0], [-10, -3], [-16, -12], [-15, -21]], w: [4.8, 3.4], col: '#e8873a',
    after: (c, S, sp) => {
      const [x, y] = sp[sp.length - 1];
      const fin = (p) => { p.moveTo(x, y + 2); p.quadraticCurveTo(x - 6, y - 4, x - 12, y - 13); p.quadraticCurveTo(x - 5, y - 9, x, y - 4); p.quadraticCurveTo(x + 5, y - 9, x + 12, y - 13); p.quadraticCurveTo(x + 6, y - 4, x, y + 2); p.closePath(); };
      toon(c, fin, '#ff9a5c', { cx: x, cy: y - 5, k: 10, lw: LW2 }, (cc) => { cc.strokeStyle = '#d0602a'; cc.lineWidth = 1.4; for (const dx of [-7, -3.5, 3.5, 7]) { cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x + dx, y - 8); cc.stroke(); } });
    },
  },
  headFront: (c) => {
    const rice = [[-17, -24], [-18, -36], [-8, -40], [8, -40], [18, -36], [17, -24], [0, -22]];
    toon(c, (p) => scallop(p, rice, 1.6), '#ffffff', { cx: 0, cy: -31, k: 18, tint: '#d7d0e6' });
    const fish = [[-21, -28], [-20, -40], [-6, -47], [10, -47], [22, -40], [22, -29], [14, -36], [0, -38], [-14, -35]];
    tp(c, fish, '#ff8a5c', { tension: 0.45 }, (cc) => { cc.strokeStyle = 'rgba(255,240,225,0.9)'; cc.lineWidth = 2.6; for (const x of [-12, -2, 8, 18]) { cc.beginPath(); cc.moveTo(x - 4, -48); cc.lineTo(x + 3, -32); cc.stroke(); } });
    rr(c, -4, -46, 9, 22, 2); paint2(c, '#1f3a2a');
  },
  bodyFront: (c, S) => {
    const B = S.body, x = B.x + B.rx * 0.82, y = B.y - B.ry * 0.55;
    cp(c, [[x - 11, y - 5], [x + 9, y - 6], [x + 1, y + 12]], '#3fa9ff', { poly: true, lw: LW2 });
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.6;
    for (const [dx, dy] of [[-3, -1], [3, -1], [0, 4]]) { c.beginPath(); c.arc(x + dx, y + dy, 2.4, Math.PI, 0); c.stroke(); }
  },
});

// ------------------------------------------------------------------ ÉPIQUE
// Ombre : fantôme de fumée flottant, yeux violets luisants, bas du corps en volutes.
D.ombre = () => ({
  pose: 'float', idle: 'float', hover: 10, noPaws: true,
  fur: '#352c52', belly: '#4f4372', rim: '#9a6ae0',
  body: { rx: 17, ry: 15, pts: (B) => [[B.x + 17, B.y - 2], [B.x + 13, B.y + 9], [B.x + 3, B.y + 13], [B.x - 8, B.y + 14], [B.x - 18, B.y + 19], [B.x - 30, B.y + 18], [B.x - 40, B.y + 9], [B.x - 31, B.y + 12], [B.x - 22, B.y + 8], [B.x - 17, B.y - 1], [B.x - 12, B.y - 11], [B.x + 2, B.y - 15], [B.x + 13, B.y - 11]] },
  head: { rx: 28, ry: 25, chin: 0.18 },
  ears: { len: 25, wid: 0.32, inner: '#7a4ab8' },
  face: { eye: '#c78bff', style: 'glow', mouth: 'smile', blush: false, rx: 8, ry: 8.4 },
  tail: {
    draw: (c) => {
      const sp = crSample([[0, 0], [-8, -4], [-12, -14], [-8, -24], [0, -26], [-1, -19]], 8);
      const pts = tubePts(sp, (u) => lerp(4.5, 2, u));
      tp(c, pts, '#3d3260', { poly: true, hi: 0.12 });
    },
  },
  sprites: { puff: [-12, -12, 24, 24, (c) => { blob(c, [[0, 0, 5.5], [-4, 2, 4], [4, 2, 4]], '#5b4590', { lw: 1.8 }); }] },
  fxBack: (ctx, R, P) => {
    const B = R.S.body;
    addGlow(ctx, B.x - 8, B.y + 8, 34, '#b968ff', 0.3 + Math.sin(P.t * 2) * 0.08);
    for (let i = 0; i < 4; i++) {
      const u = (P.t * 0.45 + i / 4) % 1, x = B.x - 36 + i * 8 - u * 10 + Math.sin(P.t + i) * 2, y = B.y + 12 + u * 6 - i * 2;
      blit(ctx, R.puff, x, y, 0, 1 - u * 0.5, 1 - u * 0.5, (1 - u) * 0.85);
    }
  },
  fxHead: (ctx, R, P) => {
    if (P.closed) return;
    const F = R.S.face, a = 0.55 + Math.sin(P.t * 3) * 0.2;
    addGlow(ctx, F.x - F.sep, F.y, 12, '#b968ff', a);
    addGlow(ctx, F.x + F.sep, F.y, 11, '#b968ff', a);
  },
});

// Aurore : petit lion solaire, crinière-soleil à rayons, queue de lion.
D.aurore = () => ({
  idle: 'breathe',
  fur: '#ffcf5a', fur2: '#ff9d2e', belly: '#fff4cf', muzzle: '#fff4cf',
  head: { rx: 29, ry: 25 },
  ears: { type: 'round', len: 14, wid: 0.34 },
  face: { eye: '#ff9d2e', style: 'sparkle', mouth: 'open' },
  marks: { head: (c, S) => { c.beginPath(); starPath(c, S.face.x - 2, -17, 5, 2.2, 4); c.fillStyle = '#ff9d2e'; c.fill(); } },
  tail: {
    ctrl: [[0, 0], [-9, -2], [-16, -12], [-15, -24]], w: [3.6, 3.2],
    after: (c, S, sp) => { const [x, y] = sp[sp.length - 1]; blob(c, [[x, y - 3, 6], [x - 4, y - 7, 4.5], [x + 3, y - 8, 4.5]], '#ff9d2e', { lw: LW2 }); },
  },
  headBack: (c) => {
    c.beginPath(); starPath(c, 0, 0, 47, 33, 12, -Math.PI / 2 + 0.13); paint2(c, '#ffb52e', LW2);
    c.beginPath(); starPath(c, 0, 0, 41, 30, 12, -Math.PI / 2 - 0.13); c.fillStyle = '#ffe680'; c.fill();
    ell(c, 0, 0, 33, 30); c.fillStyle = '#ffd84a'; c.fill();
  },
  fxBack: (ctx, R, P) => addGlow(ctx, R.S.hx, R.S.hy, 52, '#fff2a0', 0.35 + Math.sin(P.t * 2) * 0.12),
});

// Pyro : chaton de lave (roche sombre aux fissures incandescentes), crête de flammes.
D.pyro = () => ({
  idle: 'bounce',
  fur: '#4c3a3c', belly: '#6a4a46', muzzle: '#6a4a46', rim: '#a0603a',
  ears: { inner: '#ff7a1a' },
  face: { eye: '#ff3d55', mouth: 'fang', brow: 1, browC: '#ff9a3d' },
  marks: {
    head: (c) => { lava(c, [[-28, -6], [-20, -2], [-22, 6], [-14, 10]]); lava(c, [[24, -16], [18, -10], [22, -4]]); lava(c, [[-6, -26], [-2, -18], [-8, -12]]); },
    body: (c, S) => { const B = S.body; lava(c, [[B.x - 16, B.y - 10], [B.x - 8, B.y - 4], [B.x - 12, B.y + 4], [B.x - 4, B.y + 8]]); lava(c, [[B.x + 2, B.y - 12], [B.x + 6, B.y - 4], [B.x + 2, B.y + 2]]); },
  },
  legMarks: (c) => lava(c, [[-2, 0], [2, 5], [-1, 10]]),
  tail: {
    ctrl: [[0, 0], [-10, -2], [-17, -12], [-16, -24]], w: [5.5, 5], tip: '#ff7a1a',
    marks: (c, S, sp) => lava(c, [sp[6], [sp[10][0] + 3, sp[10][1]], sp[16]]),
  },
  sprites: {
    fl1: [-12, -30, 24, 34, (c) => paintFlame(c, 0, 0, 13, 24, -4)],
    fl2: [-12, -30, 24, 34, (c) => paintFlame(c, 0, 0, 11, 19, -3)],
  },
  fxHead: (ctx, R, P) => {
    const t = P.t;
    addGlow(ctx, 0, -30, 26, '#ff7a1a', 0.5);
    [[-14, -21, 'fl2', -0.5], [-3, -25, 'fl1', -0.2], [9, -24, 'fl2', 0.15]].forEach(([x, y, n, a], i) => {
      const f = Math.sin(t * 15 + i * 2) * 0.08;
      blit(ctx, R[n], x, y, a + Math.sin(t * 6 + i) * 0.08, 1 + f, 1 - f * 1.8);
    });
  },
  tailFx: (ctx, R, P) => addGlow(ctx, -16, -24, 12, '#ff7a1a', 0.5 + Math.sin(P.t * 5) * 0.15),
});
function lava(c, pts) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = 4.2; c.strokeStyle = '#ff6a1a'; c.stroke();
  c.lineWidth = 1.6; c.strokeStyle = '#ffe680'; c.stroke();
}

// Blizzard : lynx des neiges, pinceaux d'oreilles, collerette, queue courte, grosses pattes.
D.blizzard = () => ({
  idle: 'breathe', legLen: 10, legW: 9.5, pawK: 1.35, pawFluff: true,
  fur: '#e2e9f3', fur2: '#7aa0d0', belly: '#ffffff', muzzle: '#ffffff', tint: '#c2cdee',
  body: { rx: 22, ry: 14, fluffy: 2.6, n: 16 },
  head: { rx: 28, ry: 25, chin: 0.05 },
  ruff: { col: '#f4f8ff', n: 9, amp: 0.4, a0: 1.6, a1: TAU - 1.6, sx: 1.06, sy: 1.0 },
  ears: { type: 'tuft', len: 22, tuftLen: 13, wid: 0.32, tip: '#3a4a6a', tipK: 0.3 },
  face: { eye: '#7fe9ff', mouth: 'w' },
  marks: {
    head: (c, S) => tabbyHead(c, S, S.fur2, 2.8, false),
    body: (c, S) => { const B = S.body; dots(c, [[B.x - 12, B.y - 5, 2.6], [B.x - 3, B.y - 8, 2.2], [B.x + 6, B.y - 5, 2.4], [B.x - 15, B.y + 3, 2.2]], S.fur2); },
  },
  tail: { type: 'fluff', ctrl: [[0, 0], [-6, -6], [-10, -10]], w: [6, 7], n: 3, tip: '#3a4a6a', tipR: 3.5 },
  sprites: {
    flake: [-10, -10, 20, 20, (c) => {
      c.strokeStyle = OUT; c.lineCap = 'round';
      for (const w of [3.6, 1.8]) { c.lineWidth = w; c.strokeStyle = w > 2 ? OUT : '#ffffff'; for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; c.beginPath(); c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(-Math.cos(a) * 5, -Math.sin(a) * 5); c.stroke(); } }
    }],
  },
  fxBack: (ctx, R, P) => {
    for (let i = 0; i < 3; i++) {
      const u = (P.t * 0.18 + i / 3) % 1, x = -44 + i * 44 + Math.sin(P.t * 1.5 + i * 2) * 6, y = -88 + u * 80;
      blit(ctx, R.flake, x, y, P.t * (1 + i * 0.3), 1, 1, Math.sin(u * Math.PI));
    }
  },
});

// Volt : chat noir punk, rayures-éclairs jaunes, queue en éclair qui crépite.
D.volt = () => ({
  idle: 'jitter', legLen: 13, legW: 7.5,
  fur: '#2f2b3a', fur2: '#ffe14d', belly: '#4a4560', rim: '#9a8a50',
  body: { rx: 20, ry: 11 },
  head: { rx: 29, ry: 25, chin: 0.1 },
  ears: { len: 24, inner: '#ffe14d' },
  face: { eye: '#ffd84d', style: 'fierce', mouth: 'fang', lid: [0.36, 0.06], blush: false },
  marks: {
    head: (c) => { for (const [x, y, s, a] of [[-24, 4, 9, 1.2], [30, 2, 8, -1.2], [2, -22, 8, 0]]) { c.beginPath(); poly(c, boltPts(x, y, s, a)); c.fillStyle = '#ffe14d'; c.fill(); } },
    body: (c, S) => { const B = S.body; for (const [x, s] of [[-12, 12], [0, 11], [11, 10]]) { c.beginPath(); poly(c, boltPts(B.x + x, B.y - 3, s, 0.15)); c.fillStyle = '#ffe14d'; c.fill(); } },
  },
  tail: {
    draw: (c) => {
      const pts = [[2, 3], [-6, -1], [-10, -12], [-4, -12], [-12, -26], [-14, -40], [-4, -24], [-10, -24], [-2, -10], [4, -4]];
      tp(c, pts, '#ffe14d', { poly: true, hi: 0.3 }, (cc) => { cc.beginPath(); cc.moveTo(4, 6); cc.lineTo(-8, 0); cc.lineTo(-6, -12); cc.lineTo(4, -8); cc.closePath(); cc.fillStyle = '#2f2b3a'; cc.fill(); });
    },
  },
  headFront: (c) => tp(c, [[-14, -22], [-22, -34], [-8, -28], [-6, -38], [4, -27], [12, -32], [10, -22]], '#2f2b3a', { poly: true, lw: LW2, hi: 0.15, glint: false }),
  tailFx: (ctx, R, P) => {
    addGlow(ctx, -8, -20, 18, '#ffe14d', 0.4 + Math.sin(P.t * 9) * 0.15);
    const k = Math.floor(P.t * 12);
    if (k % 3 === 0) return;
    const r = seeded(k * 7 + 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let j = 0; j < 2; j++) {
      ctx.beginPath(); let x = -12 + r() * 6, y = -38 + j * 14; ctx.moveTo(x, y);
      for (let s = 0; s < 3; s++) { x += -6 + r() * 4; y += -2 + r() * 8; ctx.lineTo(x, y); }
      ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ffe14d', 0.6); ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
    ctx.restore();
  },
  fxHead: (ctx, R, P) => { if (!P.closed) { const F = R.S.face; addGlow(ctx, F.x - F.sep, F.y, 9, '#ffe14d', 0.35); addGlow(ctx, F.x + F.sep, F.y, 8, '#ffe14d', 0.35); } },
});

// Nymphéa : chatonne lavande assise sur un nénuphar, lotus sur la tête, ronds dans l'eau.
D.nymphea = () => ({
  pose: 'sit', idle: 'water', legW: 8,
  fur: '#b6a0ff', belly: '#ece6ff', muzzle: '#ece6ff', tint: '#cbbde6',
  body: { rx: 13, ry: 15, hr: 11.5 },
  head: { rx: 29, ry: 26 },
  face: { eye: '#3f8fff', mouth: 'w', lash: true },
  tailFront: true,
  tail: { ctrl: [[0, 0], [8, 4], [22, 4], [32, 0], [34, -6]], w: [4.2, 3.8], tip: '#ece6ff' },
  tailPos: [-14, -6], tailK: 0.05,
  under: (c) => {
    // nénuphar
    const fn = (p) => { p.moveTo(2, -1); p.ellipse(0, -1, 34, 8, 0, 0.18, TAU - 0.38); p.closePath(); };
    toon(c, fn, '#4fbf6a', { cx: 0, cy: -2, k: 30, hi: 0.18 }, (cc) => {
      cc.strokeStyle = '#2f8a4a'; cc.lineWidth = 1.6;
      for (const a of [0.9, 1.6, 2.3, 3.0, 3.8, 4.6, 5.3]) { cc.beginPath(); cc.moveTo(0, -1); cc.lineTo(Math.cos(a) * 32, -1 + Math.sin(a) * 7.5); cc.stroke(); }
    });
  },
  headFront: (c) => {
    const x = 6, y = -28;
    for (const [a, l, col] of [[-1.0, 15, '#ffb7e2'], [1.0, 15, '#ffb7e2'], [-0.5, 17, '#ff9ad5'], [0.5, 17, '#ff9ad5'], [0, 18, '#ffc9ea']]) {
      const pts = rot([[0, 0], [-5, -l * 0.45], [0, -l], [5, -l * 0.45]], x, y, a);
      cp(c, pts, col, { tension: 0.4, lw: 1.8, hi: 0.3, glint: false });
    }
    ce(c, x, y - 2, 4, 3, '#ffe066', { lw: 1.6 });
  },
  fxBack: (ctx, R, P) => {
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const u = (P.t * 0.35 + i * 0.5) % 1;
      ell(ctx, 0, -1, 34 + u * 22, 8 + u * 5); ctx.lineWidth = 2.2; ctx.strokeStyle = rgba('#bff4ff', (1 - u) * 0.8); ctx.stroke();
    }
    ctx.restore();
  },
});

// ------------------------------------------------------------------ LÉGENDAIRE
// Sphinxou : sphynx sans poils allongé en pose de sphinx, coiffe némès, collier ousekh, ankh flottant.
D.sphinxou = () => ({
  pose: 'lie', idle: 'breathe',
  fur: '#ecc49c', belly: '#f6dcc0',
  body: { rx: 26, ry: 11 },
  head: { rx: 29, ry: 25, chin: 0.22 },
  ears: { type: 'big', len: 33, wid: 0.42, aL: -0.62, aR: 0.76, tilt: 0.16, inner: '#f2a08a' },
  face: { eye: '#7fe9ff', mouth: 'w', kohl: true, rx: 7.8, ry: 8.6 },
  marks: {
    head: (c, S) => { stripes(c, [[S.face.x - 8, -12, S.face.x - 1, -14, S.face.x + 6, -12], [S.face.x - 6, -8, S.face.x - 1, -9.5, S.face.x + 4, -8]], rgba('#b8865a', 0.8), 1.6); dots(c, [[-20, -4, 2.4], [-16, 2, 1.8], [26, -6, 2]], '#d9a46e'); },
    body: (c, S) => { const B = S.body; dots(c, [[B.x - 10, B.y - 5, 3], [B.x + 2, B.y - 7, 2.6], [B.x + 12, B.y - 4, 2.2]], '#d9a46e'); },
  },
  tail: { ctrl: [[0, 0], [-10, 1], [-18, -6], [-22, -16]], w: [3.4, 2.8], rings: [0.45, 0.7], ringC: GOLD, ringW: 3 },
  headFront: (c) => {
    // némès : bandes bleu lapis / or
    const nem = [[-27, -10], [-26, -24], [-12, -33], [8, -34], [24, -26], [30, -12], [36, 18], [28, 22], [24, 2], [16, -12], [0, -16], [-14, -12], [-24, 2], [-30, 22], [-38, 18]];
    tp(c, nem, '#2a5bd7', { poly: false, tension: 0.35 }, (cc) => {
      cc.strokeStyle = GOLD; cc.lineWidth = 3.2;
      for (let y = -30; y < 26; y += 7) { cc.beginPath(); cc.moveTo(-44, y + 4); cc.quadraticCurveTo(0, y - 6, 44, y + 4); cc.stroke(); }
    });
    line2(c, [[-26, -12], [2, -19], [29, -12]], 4.5, GOLD, LW2);
    // uraeus
    cp(c, [[3, -19], [1, -27], [4, -32], [8, -29], [6, -24], [7, -19]], GOLD, { lw: 1.8 });
    ell(c, 5.5, -29.5, 1, 1); c.fillStyle = '#e8323f'; c.fill();
  },
  bodyFront: (c, S) => {
    // pattes avant allongées
    const B = S.body;
    te(c, B.x + 30, -4.5, 13, 4.6, shade(S.fur, -0.12), { hi: 0.1, glint: false });
    te(c, B.x + 34, -4, 13, 4.8, S.fur, { hi: 0.15, glint: false });
  },
  headMid: noop,
  over: (c, S) => {
    // collier ousekh
    const x = S.hx - 4, y = S.hy + 22;
    const arc = (r, w, col) => { c.beginPath(); c.arc(x, y - 10, r, 0.25, Math.PI - 0.25); c.lineWidth = w + 3; c.strokeStyle = OUT; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    arc(18, 4, GOLD); arc(14, 3.6, '#2ad1c9'); arc(10.5, 3.2, '#2a5bd7');
  },
  sprites: {
    ankh: [-15, -24, 30, 46, (c) => {
      ell(c, 0, -9, 5, 6.5); c.lineWidth = 7.2; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.8; c.strokeStyle = GOLD; c.stroke();
      line2(c, [[0, -2], [0, 14]], 4.2, GOLD, 1.6); line2(c, [[-8, 1], [8, 1]], 4, GOLD, 1.6);
    }],
  },
  fxBack: (ctx, R, P) => {
    const y = -62 + Math.sin(P.t * 2) * 4, x = -26;
    addGlow(ctx, x, y - 2, 22, '#fff2a0', 0.55 + Math.sin(P.t * 3) * 0.15);
    blit(ctx, R.ankh, x, y, Math.sin(P.t * 1.4) * 0.12);
  },
});

// Mini-Ninja : cagoule et masque, bandeau à plaque, longue écharpe rouge qui flotte, yeux rouges.
D.ninja = () => ({
  idle: 'crouch', legLen: 9, legW: 8.5,
  fur: '#2c2738', belly: '#3d3650', rim: '#6a5a8a',
  body: { rx: 23, ry: 12 },
  head: { rx: 29, ry: 25 },
  ears: { len: 22, inner: '#4a3a5e' },
  face: { eye: '#ff3d55', style: 'fierce', mouth: 'none', nose: false, lid: [0.34, 0.04], lidC: '#1f1b2b', blush: false, y: -1 },
  headFront: (c, S) => {
    // masque bas
    const H = S.head;
    c.save(); c.beginPath(); smooth(c, headPts(H), true, 0.5); c.clip();
    c.beginPath(); c.moveTo(-40, 8); c.quadraticCurveTo(6, 2, 40, 7); c.lineTo(40, 40); c.lineTo(-40, 40); c.closePath(); c.fillStyle = '#1f1b2b'; c.fill();
    c.lineWidth = 2; c.strokeStyle = '#4a4262'; c.beginPath(); c.moveTo(-36, 12); c.quadraticCurveTo(6, 6, 36, 11); c.stroke();
    c.restore();
    // bandeau + plaque
    line2(c, [[-30, -10], [0, -20], [30, -9]], 6, '#e0233a', LW2);
    rr(c, -2, -24, 16, 9, 2.5); paint2(c, '#cfd6e6');
    c.beginPath(); c.arc(6, -19.5, 2.4, 0, 5.2); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  },
  sprites: {
    scarf1: [-58, -14, 66, 32, (c) => tp(c, [[0, 0], [-16, -3], [-34, 0], [-46, 6], [-36, 7], [-18, 6], [0, 6]], '#e0233a', { lw: LW2 })],
    scarf2: [-56, -16, 64, 44, (c) => tp(c, [[0, 0], [-14, 4], [-28, 10], [-40, 18], [-30, 17], [-14, 11], [0, 6]], '#c0182c', { lw: LW2 })],
    star: [-12, -12, 24, 24, (c) => { c.beginPath(); starPath(c, 0, 0, 8, 2.6, 4); paint2(c, '#cfd6e6', 1.8); ell(c, 0, 0, 1.8, 1.8); c.fillStyle = OUT; c.fill(); }],
  },
  fxBack: (ctx, R, P) => {
    const S = R.S, x = S.hx - 26, y = S.hy - 6, sp = P.run ? 14 : 5, amp = P.run ? 0.18 : 0.1;
    blit(ctx, R.scarf2, x, y + 2, Math.sin(P.t * sp + 1) * amp + 0.05, 1 + Math.sin(P.t * sp * 1.3) * 0.06, 1);
    blit(ctx, R.scarf1, x, y, Math.sin(P.t * sp) * amp - 0.05, 1 + Math.sin(P.t * sp * 1.1 + 2) * 0.06, 1);
  },
  tail: { ctrl: [[0, 0], [-10, -2], [-16, -12], [-14, -22]], w: [4.2, 3.6], rings: [0.6], ringC: '#e0233a', ringW: 4 },
  tailFx: (ctx, R, P) => { blit(ctx, R.star, -14, -26, P.t * 8); addGlow(ctx, -14, -26, 9, '#ffffff', 0.25); },
  fxHead: (ctx, R, P) => { if (!P.closed) { const F = R.S.face; addGlow(ctx, F.x - F.sep, F.y, 11, '#ff2a3d', 0.55); addGlow(ctx, F.x + F.sep, F.y, 10, '#ff2a3d', 0.55); } },
});

// Petit Corsaire : marinière, tricorne à tête de mort, bandeau sur l'œil, anneau d'or, doublon qui tourne.
D.corsaire = () => ({
  idle: 'sway',
  fur: '#dcab5e', fur2: '#a8742a', muzzle: '#fff1d6',
  head: { rx: 30, ry: 26, cheek: 0.1 },
  ears: { len: 19 },
  face: { eye: '#46c46a', mouth: 'fang' },
  marks: {
    head: (c, S) => tabbyHead(c, S, S.fur2, 3.2),
    body: (c, S) => {
      const B = S.body;
      c.fillStyle = '#ffffff'; c.fillRect(B.x - B.rx * 0.2, B.y - 40, 60, 80);
      c.fillStyle = '#25306e';
      for (let y = B.y - B.ry; y < B.y + B.ry; y += 6) c.fillRect(B.x - B.rx * 0.2, y, 60, 3);
      c.fillStyle = S.fur; c.beginPath(); c.moveTo(B.x - B.rx * 0.2, B.y - 40); c.quadraticCurveTo(B.x - B.rx * 0.45, B.y, B.x - B.rx * 0.2, B.y + 40); c.lineTo(B.x - 60, B.y + 40); c.lineTo(B.x - 60, B.y - 40); c.closePath(); c.fill();
      tabbyBody(c, { body: { ...B, rx: B.rx * 0.45, x: B.x - B.rx * 0.6 } }, S.fur2, 2, 4);
    },
  },
  tail: { ctrl: [[0, 0], [-10, -3], [-16, -14], [-12, -25]], w: [5, 4.4], rings: [0.35, 0.6, 0.85], ringC: '#a8742a' },
  headFront: (c) => {
    // bandeau sur l'œil droit
    line2(c, [[-29, -12], [6, -10], [30, 4]], 2.2, '#1d1530', 1);
    ce(c, 19, 1, 8.4, 9, '#1d1530', { lw: LW2, hi: 0.15 });
    // tricorne
    const brim = [[-38, -36], [-28, -27], [-6, -24], [16, -24], [34, -28], [42, -40], [34, -30], [14, -18], [-8, -18], [-28, -22]];
    tp(c, brim, '#2a2340', { tension: 0.4 }, (cc) => { cc.beginPath(); smooth(cc, brim, true, 0.4); cc.lineWidth = 4; cc.strokeStyle = GOLD; cc.stroke(); });
    const crown = [[-22, -27], [-20, -42], [0, -50], [22, -44], [28, -28], [4, -25]];
    tp(c, crown, '#33294d', { tension: 0.45 });
    // tête de mort
    ce(c, 3, -37, 5.6, 5, '#ffffff', { lw: 1.6, hi: 0, glint: false });
    dots(c, [[1, -37, 1.4], [5.2, -37, 1.4]], OUT);
    line2(c, [[-4, -29], [10, -33]], 1.8, '#ffffff', 1); line2(c, [[-4, -33], [10, -29]], 1.8, '#ffffff', 1);
  },
  sprites: {
    coin: [-8, -8, 16, 16, (c) => { ce(c, 0, 0, 6.5, 6.5, GOLD, { lw: 2, hi: 0.35 }); ell(c, 0, 0, 3.8, 3.8); c.lineWidth = 1.4; c.strokeStyle = GOLD_D; c.stroke(); }],
    ring: [-9, -9, 18, 18, (c) => { ell(c, 0, 0, 3.6, 3.6); c.lineWidth = 4.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = GOLD; c.stroke(); }],
  },
  fxHead: (ctx, R, P) => { blit(ctx, R.ring, -25, -18, 0, 1, 1); addGlow(ctx, -25, -18, 7, '#ffd23f', 0.35 + Math.sin(P.t * 4) * 0.15); },
  fxFront: (ctx, R, P) => {
    const x = R.S.hx + 30, y = R.S.hy - 34 + Math.sin(P.t * 2.4) * 3;
    addGlow(ctx, x, y, 14, '#ffd23f', 0.45);
    blit(ctx, R.coin, x, y, 0, Math.max(0.12, Math.abs(Math.cos(P.t * 3.2))), 1);
    twinkles(ctx, [[x + 7, y - 6, 3, 0]], P.t, '#fff2a0', 4);
  },
});

// Samouraï : calico au chignon, armure rouge laquée, katana dans le dos qui crépite d'éclairs.
D.samourai = () => ({
  idle: 'breathe', legLen: 11, legW: 9,
  fur: '#fbf6ee', belly: '#ffffff',
  body: { rx: 21, ry: 13 },
  head: { rx: 30, ry: 26 },
  face: { eye: '#ffd84d', style: 'fierce', mouth: 'w', lid: [0.3, 0.05], brow: 0.5 },
  marks: {
    head: (c) => { patch(c, -20, -18, 12, '#e8873a', 6); patch(c, 24, -16, 7, '#3a3646', 2); patch(c, -28, 6, 6, '#3a3646', 9); },
    body: (c, S) => { const B = S.body; patch(c, B.x - 12, B.y - 4, 8, '#e8873a', 4); },
  },
  tail: { ctrl: [[0, 0], [-10, -3], [-15, -13], [-12, -23]], w: [4.8, 4.2], col: '#e8873a', tip: '#3a3646' },
  bodyBack: (c, S) => {
    // katana dans le dos (fourreau + garde + poignée tressée)
    const B = S.body, x0 = B.x + 14, y0 = B.y + 6;
    const a = KATANA_A, L = 62, ca = Math.cos(a), sa = Math.sin(a);
    const P_ = (u, v) => [x0 + ca * u - sa * v, y0 + sa * u + ca * v];
    tp(c, [P_(0, -3), P_(38, -3), P_(38, 3), P_(0, 3)], '#7a1220', { poly: true, lw: LW2, hi: 0.2 });
    tp(c, [P_(41, -2.8), P_(L, -2.8), P_(L, 2.8), P_(41, 2.8)], '#f4f4f8', { poly: true, lw: 1.8, hi: 0 }, (cc) => {
      cc.strokeStyle = '#2a2340'; cc.lineWidth = 1.8;
      for (let u = 43; u < L; u += 4) { cc.beginPath(); cc.moveTo(...P_(u, -3)); cc.lineTo(...P_(u + 3, 3)); cc.stroke(); }
    });
    tp(c, [P_(38, -6.5), P_(41.5, -6.5), P_(41.5, 6.5), P_(38, 6.5)], GOLD, { poly: true, lw: 1.8, hi: 0.3 });
    ce(c, ...P_(L + 1, 0), 3.4, 3.4, GOLD, { lw: 1.6 });
  },
  bodyFront: (c, S) => {
    // plastron rouge (dō) et épaulière
    const B = S.body;
    tp(c, [[B.x + 4, B.y - 12], [B.x + 20, B.y - 9], [B.x + 22, B.y + 4], [B.x + 8, B.y + 9], [B.x + 2, B.y]], '#d0202f', { lw: LW2 }, (cc) => { cc.strokeStyle = GOLD; cc.lineWidth = 1.6; for (let y = -7; y < 8; y += 4) { cc.beginPath(); cc.moveTo(B.x, B.y + y); cc.lineTo(B.x + 26, B.y + y + 2); cc.stroke(); } });
  },
  headFront: (c) => {
    // chignon (chonmage)
    te(c, -2, -29, 10, 7.5, '#2a2536', { lw: LW2 });
    tp(c, [[-2, -35], [16, -42], [20, -36], [3, -30]], '#2a2536', { lw: LW2, hi: 0.2 });
    line2(c, [[-3, -37], [0, -28]], 2.6, '#e8323f', 1.4);
  },
  fxBack: (ctx, R, P) => {
    const B = R.S.body, a = KATANA_A, x = B.x + 14 + Math.cos(a) * 56, y = B.y + 6 + Math.sin(a) * 56;
    addGlow(ctx, x, y, 16, '#ffe14d', 0.45 + Math.sin(P.t * 7) * 0.15);
    const k = Math.floor(P.t * 10);
    if (k % 2) {
      const r = seeded(k * 13 + 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      ctx.beginPath(); let px = x - 8 + r() * 6, py = y - 6 + r() * 4; ctx.moveTo(px, py);
      for (let s = 0; s < 4; s++) { px += 3 + r() * 4; py += -4 + r() * 8; ctx.lineTo(px, py); }
      ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ffe14d', 0.7); ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.restore();
    }
  },
});

const KATANA_A = -2.42;

// Petite Sorcière : chatte noire, immense chapeau pointu violet, cape, étoile qui orbite autour du chapeau.
D.sorciere = () => ({
  idle: 'sway',
  fur: '#3d3650', belly: '#5d5675', muzzle: '#5d5675', rim: '#8a6ad0',
  ears: { inner: '#b06ad8' },
  face: { eye: '#46e07a', style: 'sparkle', mouth: 'fang', lash: true },
  tail: {
    ctrl: [[0, 0], [-10, -3], [-16, -14], [-12, -26], [-5, -28]], w: [4.4, 3.8],
    after: (c, S, sp) => { const [x, y] = sp[sp.length - 6]; bow(c, x, y, 0.42, '#ff7ae0', 0.4); },
  },
  bodyBack: (c, S) => {
    const B = S.body;
    tp(c, [[B.x + 12, B.y - 12], [B.x - 6, B.y - 14], [B.x - 22, B.y - 6], [B.x - 30, B.y + 8], [B.x - 18, B.y + 6], [B.x - 8, B.y + 9], [B.x + 4, B.y + 2]], '#6b3fd0', { lw: LW2 });
  },
  headFront: (c) => {
    const cone = [[-17, -26], [-11, -50], [-14, -64], [-30, -76], [-6, -66], [6, -46], [20, -28]];
    tp(c, cone, '#6b3fd0', { tension: 0.4 }, (cc) => { cc.fillStyle = '#ff7ae0'; cc.beginPath(); cc.moveTo(-30, -36); cc.lineTo(30, -40); cc.lineTo(30, -32); cc.lineTo(-30, -27); cc.closePath(); cc.fill(); });
    const brim = [[-36, -22], [-20, -30], [8, -32], [36, -28], [44, -20], [30, -17], [2, -18], [-26, -14]];
    tp(c, brim, '#5a33b8', { tension: 0.5 });
    c.beginPath(); starPath(c, 3, -33, 5.5, 2.4, 5); paint2(c, GOLD, 1.8);
  },
  sprites: { star: [-11, -11, 22, 22, (c) => { c.beginPath(); starPath(c, 0, 0, 7, 3, 5); paint2(c, GOLD, 1.8); }] },
  fxHead: (ctx, R, P) => {
    const a = P.t * 2.2, x = -22 + Math.cos(a) * 18, y = -64 + Math.sin(a) * 7;
    addGlow(ctx, 3, -33, 10, '#ffd23f', 0.3 + Math.sin(P.t * 4) * 0.15);
    addGlow(ctx, x, y, 12, '#ff7ae0', 0.5);
    blit(ctx, R.star, x, y, a);
    for (let i = 1; i < 4; i++) addSpark(ctx, -22 + Math.cos(a - i * 0.35) * 18, -64 + Math.sin(a - i * 0.35) * 7, 3.5 - i * 0.7, '#ff7ae0', 1 - i * 0.25);
  },
});

// ------------------------------------------------------------------ MYTHIQUE
// Drakou : bébé dragon-chat, ailes membraneuses, cornes, plaques dorsales, queue à flamme.
D.drakou = () => ({
  idle: 'bounce', legLen: 10, legW: 9.5,
  fur: '#e8554a', fur2: '#8a1a1a', belly: '#ffd38a', muzzle: '#ffd38a',
  body: { rx: 22, ry: 14 },
  head: { rx: 30, ry: 26, cheek: 0.1 },
  ears: { len: 18, inner: '#ff9a3d' },
  face: { eye: '#ffd84d', style: 'fierce', mouth: 'fang', lid: [0.16, 0] },
  marks: {
    head: (c, S) => dots(c, [[-16, -16, 3], [-24, -4, 2.4], [24, -14, 2.4]], S.fur2),
    body: (c, S) => { const B = S.body; c.strokeStyle = '#e8a050'; c.lineWidth = 1.8; for (let i = 0; i < 4; i++) { const x = B.x + B.rx * 0.05 + i * 6; c.beginPath(); c.moveTo(x, B.y + 3); c.quadraticCurveTo(x + 2, B.y + 9, x, B.y + 15); c.stroke(); } dots(c, [[B.x - 12, B.y - 6, 3], [B.x - 2, B.y - 9, 2.6]], S.fur2); },
  },
  wings: { type: 'dragon', len: 36 },
  bodyBack: (c, S) => {
    const B = S.body;
    for (const [u, h] of [[-0.75, 7], [-0.42, 9], [-0.08, 9], [0.26, 7]]) {
      const x = B.x + u * B.rx, y = B.y - B.ry * Math.sqrt(1 - u * u) * 0.98;
      cp(c, [[x - 5, y + 3], [x - 1, y - h], [x + 5, y + 3]], '#ff9a3d', { poly: true, lw: LW2, hi: 0.2 });
    }
  },
  tail: {
    draw: (c, S) => {
      const sp = crSample([[0, 0], [-10, 0], [-18, -6], [-22, -16], [-20, -24]], 8);
      const pts = tubePts(sp, (u) => lerp(6.5, 2.6, u));
      tp(c, pts, S.fur, { poly: true, hi: 0.2 });
      for (const u of [0.3, 0.55, 0.8]) { const i = Math.round(u * (sp.length - 1)), [nx, ny] = normalAt(sp, i), [x, y] = sp[i], w = lerp(6.5, 2.6, u); cp(c, [[x + nx * w * 0.6 - ny * 3, y + ny * w * 0.6 + nx * 3], [x + nx * (w + 6), y + ny * (w + 6)], [x + nx * w * 0.6 + ny * 3, y + ny * w * 0.6 - nx * 3]], '#ff9a3d', { poly: true, lw: 1.8, hi: 0 }); }
      const [x, y] = sp[sp.length - 1];
      cp(c, [[x, y + 2], [x - 6, y - 4], [x, y - 10], [x + 6, y - 4]], '#ff9a3d', { poly: true, lw: LW2, hi: 0.2 });
    },
  },
  headBack: (c) => {
    for (const [x, y, a] of [[-12, -22, -0.35], [10, -24, 0.25]]) {
      const pts = rot([[-4, 2], [-3, -8], [1, -15], [3, -8], [4, 2]], x, y, a);
      cp(c, pts, '#fff1d6', { tension: 0.3, lw: LW2, hi: 0.3 });
    }
  },
  sprites: {
    flame: [-14, -30, 28, 34, (c) => paintFlame(c, 0, 0, 15, 26, 2)],
    puff: [-8, -8, 16, 16, (c) => blob(c, [[0, 0, 4], [-3, 2, 3], [3, 2, 3]], '#d8d0e6', { lw: 1.6 })],
  },
  tailFx: (ctx, R, P) => {
    const f = Math.sin(P.t * 19) * 0.07 + Math.sin(P.t * 31) * 0.05;
    addGlow(ctx, -20, -36, 18, '#ff7a1a', 0.55);
    blit(ctx, R.flame, -20, -31, Math.sin(P.t * 7) * 0.12, 1 + f, 1 - f * 1.6);
  },
  fxHead: (ctx, R, P) => {
    const u = (P.t * 0.6) % 1;
    if (u < 0.5) { const q = u / 0.5; blit(ctx, R.puff, 36 + q * 10, 8 - q * 8, 0, 0.5 + q * 0.7, 0.5 + q * 0.7, 1 - q); }
  },
});

const RAINBOW = ['#c9a0ff', '#8fd0ff', '#8fe8b0', '#ffd36e', '#ff9ad5'];
// Licornette : licorne blanche, corne spirale dorée, crinière et queue pastel arc-en-ciel.
D.licorne = () => ({
  idle: 'bounce', legLen: 13, legW: 8,
  fur: '#fdf8ff', belly: '#ffffff', paw: '#e3d4ff', tint: '#d4c4ea',
  body: { rx: 20, ry: 12 },
  head: { rx: 29, ry: 26 },
  ears: { len: 21, inner: '#ffb7e2' },
  face: { eye: '#ff7ae0', style: 'heart', mouth: 'w', lash: true, blushA: 0.6 },
  tail: {
    draw: (c) => strands(c, RAINBOW.map((col, i) => { const o = i * 3; return [[[0, 0], [-10, -5 + o * 0.3], [-20, -9 + o], [-28, -3 + o * 1.1], [-31, 8 + o * 0.7]], 4.6, 3.4, col]; })),
  },
  headBack: (c) => strands(c, RAINBOW.map((col, i) => [[[-4 + i * 3, -25 - i * 0.5], [-18 + i * 2.5, -24 + i * 3.4], [-31 + i * 1.5, -10 + i * 4.4], [-35 + i * 2.4, 6 + i * 4.4], [-29 + i * 2.6, 17 + i * 3.6]], 5.4, 3.2, col])),
  headFront: (c, S) => {
    const x = S.face.x - 1;
    const horn = [[x - 6, -20], [x + 3, -58], [x + 7, -20]];
    tp(c, horn, '#ffe38a', { poly: true, lw: LW2, hi: 0.35 }, (cc) => { cc.strokeStyle = '#ff9ad5'; cc.lineWidth = 2.2; for (let y = -26; y > -56; y -= 7) { cc.beginPath(); cc.moveTo(x - 8, y + 3); cc.lineTo(x + 10, y - 3); cc.stroke(); } });
    // mèche frontale
    tp(c, [[x - 4, -24], [x - 16, -26], [x - 22, -16], [x - 14, -18], [x - 8, -12], [x - 2, -18]], '#ff9ad5', { tension: 0.4, lw: LW2 });
  },
  fxHead: (ctx, R, P) => {
    const x = R.S.face.x + 2;
    addGlow(ctx, x, -48, 18, '#ffb7e2', 0.45 + Math.sin(P.t * 3) * 0.15);
    twinkles(ctx, [[x + 10, -56, 5, 0], [x - 10, -46, 4, 2], [x + 14, -38, 3.5, 4], [x - 4, -66, 4, 1]], P.t, '#fff2a0', 3);
  },
  fxBack: (ctx, R, P) => twinkles(ctx, [[-44, -30, 4, 1], [-36, -8, 3, 3]], P.t, '#ff9ad5', 2.5),
});

// Kitsuné : renard-chat roux assis, grandes oreilles à pointes noires, 5 queues en éventail, feux follets.
D.kitsune = () => ({
  pose: 'sit', idle: 'sway', legW: 8, paw: '#5a2a1a',
  fur: '#ff8a3d', belly: '#fff1d6', muzzle: '#fff1d6',
  body: { rx: 13, ry: 16, hr: 12 },
  head: { rx: 29, ry: 25, chin: 0.3, cheek: 0.05 },
  ears: { type: 'fox', len: 30, wid: 0.42, tip: '#5a2a1a', tipK: 0.42, aL: -0.58, aR: 0.74 },
  face: { eye: '#ffd84d', style: 'fierce', mouth: 'smile' },
  marks: {
    head: (c, S) => {
      const F = S.face;
      c.fillStyle = '#fff1d6'; c.beginPath(); c.moveTo(-34, 4); c.quadraticCurveTo(F.x - 10, -4, F.x + 1, 2); c.quadraticCurveTo(F.x + 12, -4, 34, 4); c.lineTo(34, 30); c.lineTo(-34, 30); c.closePath(); c.fill();
      // marques rouges de kitsune
      c.fillStyle = '#e8233a';
      for (const [x, s] of [[F.x - F.sep, -1], [F.x + F.sep, 1]]) { c.beginPath(); c.moveTo(x - 5 * s, -11); c.quadraticCurveTo(x + 4 * s, -15, x + 9 * s, -20); c.quadraticCurveTo(x + 1 * s, -12, x - 5 * s, -11); c.fill(); }
      c.beginPath(); flamePath(c, F.x - 1, -12, 6, 10, 0); c.fill();
    },
  },
  tails: 5, tailFan: 0.44, tailFan0: -0.6,
  tailPos: [-18, -7],
  tail: { type: 'fluff', ctrl: [[0, 0], [-4, -12], [-5, -28], [-1, -41], [5, -47]], w: [2.8, 7.4], n: 10, tip: '#fff1d6', tipR: 8 },
  bodyFront: (c, S) => {
    const B = S.body;
    line2(c, [[B.x - 10, B.y - 12], [B.x + 2, B.y - 8], [B.x + 13, B.y - 12]], 4.4, '#e8233a');
    cp(c, [[B.x + 1, B.y - 8], [B.x + 5, B.y - 8], [B.x + 2, B.y - 3], [B.x + 6, B.y - 3], [B.x + 3, B.y + 3], [B.x - 1, B.y + 3], [B.x + 1, B.y - 2], [B.x - 2, B.y - 2]], '#ffffff', { poly: true, lw: 1.6, hi: 0 });
  },
  sprites: {
    fox: [-12, -24, 24, 30, (c) => paintFlame(c, 0, 0, 13, 22, 0, ['#3f8fff', '#7fd8ff', '#e8fbff'])],
  },
  fxBack: (ctx, R, P) => kitsuneFire(ctx, R, P, false),
  fxFront: (ctx, R, P) => kitsuneFire(ctx, R, P, true),
});
function kitsuneFire(ctx, R, P, front) {
  for (let i = 0; i < 2; i++) {
    const a = P.t * 1.6 + i * Math.PI, s = Math.sin(a);
    if ((s > 0) !== front) continue;
    const x = -4 + Math.cos(a) * 42, y = -16 + s * 8 + Math.sin(P.t * 3 + i) * 3, k = 0.8 + s * 0.15;
    addGlow(ctx, x, y - 8, 16 * k, '#7fd8ff', 0.6);
    const f = Math.sin(P.t * 17 + i) * 0.08;
    blit(ctx, R.fox, x, y, Math.sin(P.t * 5 + i) * 0.1, k * (1 + f), k * (1 - f * 1.5));
  }
}

// Polaris : maine coon polaire géant, crinière de neige, couronne de glace, étoile du Nord, cristaux en orbite.
D.polaris = () => ({
  idle: 'breathe', legLen: 11, legW: 10, pawK: 1.3, pawFluff: true,
  fur: '#f4fbff', belly: '#ffffff', muzzle: '#ffffff', tint: '#bfd0f0',
  body: { rx: 26, ry: 15, fluffy: 3.4, n: 18 },
  head: { rx: 30, ry: 26 },
  ruff: { col: '#e4f4ff', n: 11, amp: 0.26, a0: 1.3, a1: TAU - 1.3, sx: 1.12, sy: 1.12, soft: true },
  ears: { type: 'tuft', len: 22, tuftLen: 10, tuftC: '#7fe9ff', inner: '#bfe0ff' },
  face: { eye: '#7fe9ff', style: 'sparkle', mouth: 'w' },
  marks: { head: (c, S) => { c.beginPath(); twinkle(c, S.face.x - 2, -16, 6.5, 0.2); c.fillStyle = '#7fd8ff'; c.fill(); } },
  tail: { type: 'fluff', ctrl: [[0, 0], [-12, -6], [-20, -20], [-18, -36], [-8, -42]], w: [7, 12], n: 8, tip: '#bfe8ff', tipR: 11 },
  headFront: (c) => {
    for (const [x, h, a] of [[-18, 11, -0.45], [-8, 15, -0.22], [22, 11, 0.45], [12, 15, 0.22], [2, 22, 0]]) crystal(c, x, -21 - Math.abs(x) * 0.12, 6.5, h, a, '#bff4ff', 1.8);
  },
  sprites: { cr: [-11, -18, 22, 30, (c) => crystal(c, 0, 6, 7, 18, 0, '#bff4ff')] },
  fxHead: (ctx, R, P) => { addGlow(ctx, R.S.face.x - 2, -16, 10, '#7fe9ff', 0.4 + Math.sin(P.t * 3) * 0.15); addGlow(ctx, 2, -36, 16, '#bff4ff', 0.35); },
  fxBack: (ctx, R, P) => polarOrbit(ctx, R, P, false),
  fxFront: (ctx, R, P) => polarOrbit(ctx, R, P, true),
});
function polarOrbit(ctx, R, P, front) {
  for (let i = 0; i < 3; i++) {
    const a = P.t * 1.1 + (i * TAU) / 3, s = Math.sin(a);
    if ((s > 0) !== front) continue;
    const x = -6 + Math.cos(a) * 48, y = -20 + s * 9 + Math.sin(P.t * 2 + i) * 3, k = 0.85 + s * 0.15;
    addGlow(ctx, x, y, 14 * k, '#7fe9ff', 0.45);
    blit(ctx, R.cr, x, y, Math.sin(P.t * 2 + i) * 0.3, k, k);
  }
}

// ------------------------------------------------------------------ DIVIN
// Séraphin : chérubin flottant sur un nuage, 6 ailes, auréole, rayons de lumière.
D.seraphin = () => ({
  pose: 'float', idle: 'float', hover: 16,
  fur: '#ffffff', belly: '#fff8e6', muzzle: '#fff8e6', tint: '#e2d4c0',
  body: { rx: 16, ry: 13 },
  head: { rx: 30, ry: 26, cheek: 0.12 },
  ears: { len: 20, inner: '#ffc9d6' },
  face: { eye: '#ffb52e', style: 'sparkle', mouth: 'w', blushA: 0.6 },
  wings: { type: 'angel', len: 39, col: '#ffffff', tip: '#ffe08a', six: true }, wingPos: [-12, -40],
  tail: { type: 'fluff', ctrl: [[0, 0], [-8, -2], [-14, -10], [-12, -18]], w: [4, 6], n: 5, col: '#ffffff', tip: '#ffe9a0', tipR: 5 },
  under: (c, S) => {
    const B = S.body, y = B.y + B.ry + 2;
    blob(c, [[B.x - 16, y + 2, 8], [B.x - 6, y - 2, 10], [B.x + 7, y - 1, 10], [B.x + 17, y + 2, 7.5], [B.x, y + 5, 9]], '#ffffff', { k: 18, depth: 0.15 });
  },
  headFront: (c, S) => {
    // boucle de chérubin
    const x = S.face.x - 6;
    c.beginPath(); c.moveTo(x - 2, -25); c.bezierCurveTo(x + 10, -34, x + 14, -22, x + 6, -20); c.bezierCurveTo(x + 2, -19, x + 2, -24, x + 6, -24);
    c.lineWidth = 6; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ffe9a0'; c.stroke();
  },
  sprites: {
    halo: [-28, -14, 56, 28, (c) => halo(c, 0, 0, 16, 4.4)],
    rays: [-80, -80, 160, 160, (c) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 78, a - 0.09, a + 0.09); c.closePath(); const g = c.createRadialGradient(0, 0, 10, 0, 0, 78); g.addColorStop(0, 'rgba(255,242,160,0.7)'); g.addColorStop(1, 'rgba(255,242,160,0)'); c.fillStyle = g; c.fill(); } }],
  },
  fxBack: (ctx, R, P) => {
    const S = R.S;
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    blit(ctx, R.rays, S.hx - 4, S.hy + 4, P.t * 0.25, 1, 1, 0.38 + Math.sin(P.t * 2) * 0.1);
    ctx.globalCompositeOperation = op;
    addGlow(ctx, S.hx, S.hy, 50, '#fff2a0', 0.35);
  },
  fxHead: (ctx, R, P) => {
    const y = -38 + Math.sin(P.t * 2.6) * 2.5;
    addGlow(ctx, 2, y, 22, '#ffd23f', 0.55);
    blit(ctx, R.halo, 2, y);
  },
  fxFront: (ctx, R, P) => twinkles(ctx, [[-36, -70, 5, 0], [40, -58, 4, 2], [-44, -24, 4, 4], [34, -12, 3.5, 1]], P.t, '#fff2a0', 2.6),
});

// Belzéchat : petit démon, grandes cornes de bélier aux flammes violettes, ailes de chauve-souris, queue fourchue.
D.belzechat = () => ({
  idle: 'breathe', legLen: 12, legW: 8.5,
  fur: '#2e2440', belly: '#4a3a5e', rim: '#8a4ab0',
  body: { rx: 21, ry: 13 },
  head: { rx: 30, ry: 26, chin: 0.12 },
  ears: { len: 24, inner: '#b968ff' },
  face: { eye: '#ff3d55', style: 'fierce', mouth: 'fangs', lid: [0.36, 0.04], blush: false },
  wings: { type: 'bat', len: 36, col: '#5a2a7a', bone: '#2b1838' },
  tail: {
    draw: (c) => {
      const sp = crSample([[0, 0], [-10, 2], [-20, -4], [-24, -16], [-18, -26]], 8);
      tp(c, tubePts(sp, (u) => lerp(3.6, 2.4, u)), '#2e2440', { poly: true, hi: 0.15 });
      const [x, y] = sp[sp.length - 1];
      cp(c, rot([[0, 2], [-7, -4], [-5, -8], [0, -14], [5, -8], [7, -4]], x, y, 0.3), '#ff3d55', { tension: 0.2, lw: LW2, hi: 0.3 });
    },
  },
  headBack: (c) => ramHorn(c, -16, -20, -1),
  headFront: (c) => ramHorn(c, 18, -20, 1),
  sprites: {
    fire: [-10, -22, 20, 26, (c) => paintFlame(c, 0, 0, 11, 18, 0, ['#7a2ad8', '#b968ff', '#f0d8ff'])],
    halo: [-28, -20, 56, 36, (c) => { ell(c, 0, 0, 16, 4.4); c.lineWidth = 9; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#3a1f5a'; c.stroke(); for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; const x = Math.cos(a) * 16, y = Math.sin(a) * 4.4; cp(c, [[x - 2.5, y], [x, y - 7], [x + 2.5, y]], '#3a1f5a', { poly: true, lw: 1.6, hi: 0 }); } }],
  },
  fxHead: (ctx, R, P) => {
    for (const [x, y, i] of [[-40, -30, 0], [44, -32, 1]]) {
      const f = Math.sin(P.t * 16 + i * 3) * 0.1;
      addGlow(ctx, x, y - 6, 14, '#b968ff', 0.6);
      blit(ctx, R.fire, x, y, Math.sin(P.t * 6 + i) * 0.1, 1 + f, 1 - f * 1.5);
    }
    const hy = -46 + Math.sin(P.t * 2.2) * 2;
    addGlow(ctx, 2, hy, 20, '#b968ff', 0.45);
    blit(ctx, R.halo, 2, hy, Math.sin(P.t * 1.3) * 0.08);
    if (!P.closed) { const F = R.S.face; addGlow(ctx, F.x - F.sep, F.y, 10, '#ff2a3d', 0.5); addGlow(ctx, F.x + F.sep, F.y, 9, '#ff2a3d', 0.5); }
  },
  fxBack: (ctx, R, P) => { const S = R.S; addGlow(ctx, S.hx - 6, S.hy + 6, 62, '#8a2ad8', 0.4 + Math.sin(P.t * 2.4) * 0.12); },
  fxFront: (ctx, R, P) => rising(ctx, P.t, 4, -40, -10, 80, 50, 16, (cx, x, y, u) => addSpark(cx, x, y, 3 * (1 - u), '#b968ff', 1 - u)),
});
function ramHorn(c, x, y, s) {
  const sp = crSample([[x, y], [x + s * 8, y - 12], [x + s * 20, y - 14], [x + s * 26, y - 4], [x + s * 22, y + 4], [x + s * 15, y]], 8);
  tp(c, tubePts(sp, (u) => lerp(6.5, 2.2, u)), '#5b4a7a', { poly: true, lw: LW2, hi: 0.3 }, (cc) => {
    for (let i = 3; i < sp.length - 2; i += 4) { const [nx, ny] = normalAt(sp, i); cc.beginPath(); cc.moveTo(sp[i][0] + nx * 8, sp[i][1] + ny * 8); cc.lineTo(sp[i][0] - nx * 8, sp[i][1] - ny * 8); cc.lineWidth = 1.6; cc.strokeStyle = '#3a2a55'; cc.stroke(); }
  });
}

// Poséichaton : roi des mers, queue de sirène, oreilles-nageoires, couronne de corail, trident.
D.poseidon = () => ({
  pose: 'merm', idle: 'float',
  fur: '#6f8fc8', fur2: '#2a5a9a', belly: '#d6e6ff', muzzle: '#d6e6ff',
  body: { rx: 14, ry: 13 },
  head: { rx: 30, ry: 26, s: 0.96 },
  ears: {
    draw: (c, S, side, g) => {
      const { b1, b2, tip } = g, m = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
      const t2 = [tip[0] - side * 10, tip[1] + 4];
      const pts = [b1, [lerp(m[0], tip[0], 1.05) - side * 3, lerp(m[1], tip[1], 1.05)], [lerp(m[0], tip[0], 0.75), lerp(m[1], tip[1], 0.75)], tip, [lerp(m[0], t2[0], 0.75) + side * 2, lerp(m[1], t2[1], 0.8)], [t2[0] + side * 8, t2[1] + 6], b2];
      tp(c, side < 0 ? pts : pts, side < 0 ? '#3fc9c0' : '#4fe0d4', { poly: true, lw: LW2, hi: 0.3 }, (cc) => { cc.strokeStyle = '#1f8a8a'; cc.lineWidth = 1.6; for (const q of [pts[1], tip, pts[5]]) { cc.beginPath(); cc.moveTo(m[0], m[1]); cc.lineTo(q[0], q[1]); cc.stroke(); } });
    },
    len: 22, wid: 0.36,
  },
  face: { eye: '#9ff0ff', mouth: 'w', style: 'sparkle' },
  marks: { head: (c, S) => tabbyHead(c, S, S.fur2, 3, true), body: (c, S) => tabbyBody(c, S, S.fur2, 3, 3) },
  tail: null,
  bodyBack: (c, S) => {
    // queue de sirène
    const B = S.body;
    const sp = crSample([[B.x - 2, B.y + 4], [B.x - 4, B.y + 14], [B.x - 14, B.y + 21], [B.x - 28, B.y + 18], [B.x - 36, B.y + 8]], 8);
    tp(c, tubePts(sp, (u) => lerp(12, 4, u)), '#1fb5a8', { poly: true, hi: 0.25 }, (cc) => {
      cc.strokeStyle = rgba('#0e7a74', 0.8); cc.lineWidth = 1.5;
      for (let i = 2; i < sp.length - 3; i += 3) { const [x, y] = sp[i]; for (const o of [-5, 0, 5]) { cc.beginPath(); cc.arc(x + o * 0.4, y + o, 3, 0.3, Math.PI - 0.3); cc.stroke(); } }
    });
  },
  sprites: {
    fin: [-22, -20, 30, 34, (c) => {
      const pts = [[0, 0], [-8, -12], [-18, -16], [-12, -4], [-18, 8], [-8, 6]];
      cp(c, pts, '#7fe9ff', { tension: 0.35, lw: LW2, hi: 0.35 });
      c.strokeStyle = '#2fa9c0'; c.lineWidth = 1.4; for (const q of [[-14, -12], [-12, -2], [-14, 5]]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(q[0], q[1]); c.stroke(); }
    }],
    trident: [-16, -56, 32, 76, (c, S) => {
      line2(c, [[0, 14], [0, -32]], 3.2, GOLD, 1.6);
      cp(c, [[-9, -30], [-9, -42], [-6, -36], [-3, -48], [0, -40], [3, -48], [6, -36], [9, -42], [9, -30], [0, -26]], GOLD, { poly: true, lw: 2, hi: 0.35 });
      te(c, -1, -6, 4.8, 4.4, S.fur, { hi: 0.15, glint: false });
    }],
  },
  headFront: (c) => {
    // couronne d'or avec perles + branche de corail
    tp(c, [[-14, -22], [-16, -36], [-8, -30], [-2, -44], [5, -31], [12, -40], [16, -22]], GOLD, { poly: true, lw: LW2, hi: 0.35 });
    for (const [x, y] of [[-16, -37], [-2, -45], [12, -41]]) ce(c, x, y, 2.6, 2.6, '#fff4fb', { lw: 1.4 });
    line2(c, [[-20, -22], [-26, -32], [-24, -40]], 2.6, '#ff7a6a', 1.4); line2(c, [[-25, -30], [-31, -34]], 2.2, '#ff7a6a', 1.4);
  },
  fxBack: (ctx, R, P) => {
    const S = R.S, B = S.body;
    addGlow(ctx, S.hx - 4, S.hy + 10, 60, '#3fa9ff', 0.38 + Math.sin(P.t * 2) * 0.1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ell(ctx, B.x - 6, B.y + 4, 44, 12, Math.sin(P.t) * 0.08); ctx.lineWidth = 3; ctx.strokeStyle = rgba('#7fe9ff', 0.35 + Math.sin(P.t * 2) * 0.15); ctx.stroke();
    ctx.restore();
    blit(ctx, R.fin, B.x - 36, B.y + 8, -0.4 + Math.sin(P.t * 3) * 0.22);
  },
  fxFront: (ctx, R, P) => {
    const S = R.S, B = S.body, x = B.x + 16, y = B.y + 6 + Math.sin(P.t * 2) * 1.5;
    addGlow(ctx, x, y - 42, 20, '#7fe9ff', 0.55 + Math.sin(P.t * 3) * 0.15);
    blit(ctx, R.trident, x, y, 0.12);
    rising(ctx, P.t, 3, B.x - 30, B.y - 10, 50, 50, 12, (cx, bx, by, u) => { cx.globalAlpha = 1 - u; ell(cx, bx, by, 2.4, 2.4); cx.lineWidth = 1.5; cx.strokeStyle = '#bff4ff'; cx.stroke(); cx.globalAlpha = 1; });
  },
});

// ------------------------------------------------------------------ CÉLESTE
// Astro : chaton-galaxie en casque de cosmonaute, jetpack à flammes, planète à anneau en orbite.
D.astro = () => ({
  pose: 'float', idle: 'float', hover: 14,
  fur: '#2d2066', fur2: '#ff7ae0', belly: '#4b3a9a', tint: '#b8a8e8', paw: '#e8ecf6', rim: '#7a6ae0',
  body: { rx: 16, ry: 13 },
  head: { rx: 28, ry: 25 },
  ears: { len: 18, inner: '#ff7ae0' },
  face: { eye: '#c77dff', style: 'galaxy', mouth: 'open', blushA: 0.5 },
  marks: { head: (c, S) => galaxyFur(c, 0, -6, 34, 7), body: (c, S) => galaxyFur(c, S.body.x, S.body.y, 22, 9) },
  tail: { ctrl: [[0, 0], [-9, -3], [-14, -13], [-11, -22]], w: [4, 3.4], marks: (c) => galaxyFur(c, -8, -10, 14, 4), after: (c, S, sp) => { const [x, y] = sp[sp.length - 1]; c.beginPath(); starPath(c, x, y - 3, 7, 3, 5); paint2(c, GOLD, 1.8); } },
  bodyBack: (c, S) => {
    const B = S.body;
    rr(c, B.x - B.rx - 9, B.y - 12, 14, 22, 4); paint2(c, '#e8ecf6', LW2);
    rr(c, B.x - B.rx - 6, B.y - 8, 8, 6, 2); c.fillStyle = '#ff7ae0'; c.fill();
  },
  bodyFront: (c, S) => {
    const B = S.body;
    ell(c, B.x + 6, B.y - B.ry * 0.62, 13, 5); c.lineWidth = 8; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#e8ecf6'; c.stroke();
  },
  headFront: (c) => {
    // casque de verre
    c.save(); ell(c, 2, -4, 38, 36); c.fillStyle = 'rgba(160,220,255,0.16)'; c.fill(); c.restore();
    c.beginPath(); c.arc(2, -4, 31, Math.PI * 1.1, Math.PI * 1.45); c.lineWidth = 4.5; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineCap = 'round'; c.stroke();
    c.beginPath(); c.arc(2, -4, 31, Math.PI * 1.55, Math.PI * 1.62); c.stroke();
    ell(c, 2, -4, 38, 36); c.lineWidth = LW; c.strokeStyle = OUT; c.stroke();
    ell(c, 2, -4, 36.5, 34.5); c.lineWidth = 1.4; c.strokeStyle = 'rgba(200,240,255,0.8)'; c.stroke();
    line2(c, [[20, -33], [26, -46]], 2.4, '#e8ecf6', 1.6);
  },
  sprites: {
    planet: [-22, -16, 44, 32, (c) => {
      ell(c, 0, 0, 14, 4.5, -0.3); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ffd36e'; c.stroke();
      te(c, 0, 0, 7.5, 7.5, '#ff7ae0', { lw: LW2 }, (cc) => { cc.fillStyle = '#c94fb0'; cc.fillRect(-10, -1, 20, 2.5); });
      c.save(); c.beginPath(); c.rect(-20, 0, 40, 12); c.clip(); c.translate(0, 0); ell(c, 0, 0, 14, 4.5, -0.3); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ffd36e'; c.stroke(); c.restore();
    }],
    jet: [-10, -22, 20, 26, (c) => paintFlame(c, 0, 0, 9, 16, 0, ['#ff5aa8', '#ffb0e0', '#ffffff'])],
  },
  fxHead: (ctx, R, P) => { addSpark(ctx, 26, -48, 4 + Math.sin(P.t * 6) * 1.2, '#ffd36e', 1); addGlow(ctx, 26, -48, 9, '#ffd36e', 0.5); },
  fxBack: (ctx, R, P) => {
    const B = R.S.body, f = Math.sin(P.t * 21) * 0.15;
    addGlow(ctx, R.S.hx - 2, R.S.hy + 8, 60, '#ff7ae0', 0.32 + Math.sin(P.t * 1.8) * 0.1);
    addGlow(ctx, B.x - B.rx - 2, B.y + 16, 12, '#ff7ae0', 0.6);
    blit(ctx, R.jet, B.x - B.rx - 2, B.y + 10, Math.PI, 1 - f * 0.3, 1 + f + (P.run ? 0.4 : 0));
    astroOrbit(ctx, R, P, false);
  },
  fxFront: (ctx, R, P) => { astroOrbit(ctx, R, P, true); twinkles(ctx, [[-40, -70, 4, 0], [44, -20, 3.5, 2], [-30, 0, 3, 4]], P.t, '#ffffff', 3); },
});
function galaxyFur(c, x, y, r, seed) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.2, 1, x - r * 0.3, y - r * 0.2, r);
  g.addColorStop(0, rgba('#ff7ae0', 0.55)); g.addColorStop(0.5, rgba('#6b8cff', 0.3)); g.addColorStop(1, rgba('#6b8cff', 0));
  c.fillStyle = g; c.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
  const R = seeded(seed);
  for (let i = 0; i < 12; i++) { c.fillStyle = i % 3 ? '#ffffff' : '#ffd6f5'; const s = 0.7 + R() * 1.3; ell(c, x - r + R() * r * 2, y - r + R() * r * 2, s, s); c.fill(); }
}
function astroOrbit(ctx, R, P, front) {
  const a = P.t * 1.3, s = Math.sin(a);
  if ((s > 0) !== front) return;
  const x = -4 + Math.cos(a) * 46, y = -26 + s * 10, k = 0.85 + s * 0.18;
  addGlow(ctx, x, y, 16 * k, '#ff7ae0', 0.4);
  blit(ctx, R.planet, x, y, 0, k, k);
}

// Séléné : déesse de la lune assise dans un croissant de lune, ailes de papillon lunaire, tiare croissant.
D.selene = () => ({
  pose: 'sit', idle: 'float', hover: 14, legW: 7.5,
  fur: '#e2e8f4', belly: '#ffffff', muzzle: '#ffffff', tint: '#b8c4e6',
  body: { rx: 12, ry: 14, hr: 11 },
  head: { rx: 29, ry: 26 },
  ears: { len: 22, inner: '#c9b8ff' },
  face: { eye: '#7fe9ff', style: 'sparkle', mouth: 'w', lash: true },
  wings: { type: 'moth', len: 34, col: '#b4f2da', edge: '#8a72e0', spot: '#ffe9a0' },
  tailOver: true,
  tail: { type: 'fluff', ctrl: [[0, 0], [-7, 6], [-10, 16], [-5, 25]], w: [3.6, 5.6], n: 6, col: '#e2e8f4', tip: '#c9b8ff', tipR: 5.5 },
  tailPos: [-24, -20], tailK: 0.08,
  over: (c) => {
    // croissant de lune : la chatonne est assise dedans
    const fn = (p) => { p.moveTo(-37, -38); p.bezierCurveTo(-40, 6, 40, 6, 39, -40); p.bezierCurveTo(26, -13, -24, -11, -37, -38); p.closePath(); };
    toon(c, fn, '#ffe98a', { cx: 0, cy: -12, k: 28, hi: 0.32 }, (cc) => dots(cc, [[-17, -9, 2.8], [5, -5, 2.1], [20, -13, 1.9], [-28, -22, 1.7]], '#f0cf5a'));
  },
  headFront: (c, S) => {
    const x = S.face.x - 2;
    fillStroke(c, (p) => { p.moveTo(x - 7, -24); p.arc(x, -22, 7.5, Math.PI * 0.92, Math.PI * 2.08, true); p.arc(x, -25, 5.5, Math.PI * 2.1, Math.PI * 0.9, false); p.closePath(); }, '#fff2a0', 1.8);
    ce(c, x, -17, 2.2, 2.2, '#bff4ff', { lw: 1.4 });
  },
  fxBack: (ctx, R, P) => { addGlow(ctx, 0, -16, 48, '#fff2a0', 0.32 + Math.sin(P.t * 2) * 0.08); twinkles(ctx, [[-48, -62, 5, 0], [48, -72, 4.5, 2.5], [-44, -14, 3.5, 4], [46, -28, 4, 1.2]], P.t, '#e8f4ff', 2.2); },
  fxHead: (ctx, R, P) => addGlow(ctx, R.S.face.x - 2, -22, 10, '#fff2a0', 0.45 + Math.sin(P.t * 3) * 0.15),
});

// ------------------------------------------------------------------ PRIMORDIAL
// Bastet : déesse-chatte assise en statue, disque solaire et uraeus, grandes ailes d'Isis, bijoux d'or et lapis.
D.bastet = () => ({
  pose: 'sit', idle: 'breathe', legW: 7.5, legLenSit: 22,
  fur: '#ffcb4f', fur2: '#c98a12', belly: '#fff1c2',
  body: { rx: 12, ry: 19, hr: 12 },
  head: { rx: 27, ry: 25, chin: 0.34, s: 0.96 },
  ears: { type: 'big', len: 31, wid: 0.4, aL: -0.58, aR: 0.74, inner: '#ffb07a', after: (c, S, side, g) => { const x = lerp(g.b1[0], g.tip[0], 0.32), y = lerp(g.b1[1], g.tip[1], 0.32); ell(c, x - side * 1, y + 5, 3.4, 4.4); c.lineWidth = 4.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = GOLD; c.stroke(); } },
  face: { eye: '#c77dff', style: 'galaxy', mouth: 'w', kohl: true, rx: 7.6, ry: 8.4 },
  marks: { head: (c, S) => { const F = S.face; stripes(c, [[F.x - 2, -25, F.x - 2, -14]], '#2a5bd7', 3); } },
  wings: { type: 'falcon', len: 34 },
  tailFront: true,
  tail: { ctrl: [[0, 0], [8, 4], [20, 5], [28, 2]], w: [3.6, 3.2], rings: [0.5, 0.75], ringC: GOLD, ringW: 2.6 },
  tailPos: [-12, -4],
  bodyFront: (c, S) => {
    const B = S.body, x = B.x + 2, y = B.y - B.ry * 0.62;
    const arc = (r, w, col) => { c.beginPath(); c.arc(x, y - 6, r, 0.2, Math.PI - 0.2); c.lineWidth = w + 3; c.strokeStyle = OUT; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    arc(17, 3.8, GOLD); arc(13.5, 3.4, '#2a5bd7'); arc(10, 3.2, '#2ad1c9'); arc(6.8, 3, GOLD);
    ce(c, x, y + 12.5, 3.2, 3.6, '#e8433a', { lw: 1.8 });
  },
  sprites: {
    disc: [-30, -40, 60, 62, (c) => {
      // disque solaire de Râ cerclé d'or
      ce(c, 0, -3, 15.5, 15.5, GOLD, { lw: LW, hi: 0.3 });
      ce(c, 0, -3, 11.5, 11.5, '#ff5a2a', { lw: 1.8, hi: 0.35 });
      // uraeus (cobra)
      cp(c, [[-2.5, 16], [-4.5, 7], [-1.5, 1], [4, 3], [3, 8], [2.5, 16]], GOLD, { lw: 1.8 });
      ell(c, 1.4, 3.6, 1.1, 1.1); c.fillStyle = '#e8323f'; c.fill();
    }],
    rays: [-70, -70, 140, 140, (c) => { for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 68, a - 0.07, a + 0.07); c.closePath(); const g = c.createRadialGradient(0, 0, 8, 0, 0, 68); g.addColorStop(0, 'rgba(255,200,90,0.85)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fill(); } }],
  },
  fxBack: (ctx, R, P) => {
    const S = R.S;
    addGlow(ctx, S.hx, S.hy - 10, 70, '#ffd36e', 0.35 + Math.sin(P.t * 1.6) * 0.1);
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    blit(ctx, R.rays, S.hx, S.hy - 30, -P.t * 0.3, 1, 1, 0.5);
    ctx.globalCompositeOperation = op;
  },
  fxHead: (ctx, R, P) => {
    const y = -40 + Math.sin(P.t * 2) * 1.5;
    addGlow(ctx, 2, y - 2, 28, '#ff9a3d', 0.6 + Math.sin(P.t * 3) * 0.15);
    blit(ctx, R.disc, 2, y);
  },
  fxFront: (ctx, R, P) => twinkles(ctx, [[-50, -76, 5, 0], [50, -64, 5, 2], [-56, -30, 4, 4], [48, -14, 4, 1], [0, -104, 4, 3]], P.t, '#fff2a0', 2.4),
});

// Schrödinger : chat quantique dans sa boîte, yeux vairons, double fantôme en superposition, orbitales atomiques.
D.schrodinger = () => ({
  pose: 'box', idle: 'peek', legs: 'none',
  fur: '#2d2066', fur2: '#ff7ae0', belly: '#4b3a9a', tint: '#b8a8e8', rim: '#7a6ae0',
  body: { x: -2, y: -28, rx: 15, ry: 11 },
  head: { rx: 29, ry: 26 },
  ears: { len: 21, inner: '#ff7ae0' },
  face: { eye: '#c77dff', eye2: '#ffd84d', style: 'galaxy', mouth: 'w' },
  marks: { head: (c) => galaxyFur(c, 0, -4, 34, 21), body: (c, S) => galaxyFur(c, S.body.x, S.body.y, 18, 4) },
  tail: { type: 'fluff', ctrl: [[0, 0], [-8, -8], [-10, -22], [-4, -32]], w: [6, 9], n: 6, tip: '#ff7ae0', tipR: 7, col: '#3a2a80' },
  tailPos: [-16, -26],
  under: (c) => {
    // fond et rabats arrière de la boîte
    cp(c, [[-26, -26], [-34, -44], [-6, -38], [-4, -26]], '#b07a40', { poly: true, lw: LW2, hi: 0.15 });
    cp(c, [[4, -26], [8, -40], [30, -36], [22, -24]], '#b07a40', { poly: true, lw: LW2, hi: 0.15 });
    rr(c, -26, -30, 48, 8, 2); paint2(c, '#7a4e22');
  },
  over: (c) => {
    tp(c, [[-27, -26], [23, -26], [24, 0], [-28, 0]], '#d09a5a', { poly: true, hi: 0.2 }, (cc) => {
      cc.fillStyle = '#e8c48c'; cc.fillRect(-28, -14, 52, 5);
      cc.font = 'bold 18px sans-serif'; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.fillStyle = '#ff7ae0'; cc.fillText('?', -1, -11);
      cc.lineWidth = 1.2; cc.strokeStyle = OUT; cc.strokeText('?', -1, -11);
    });
    // rabats avant
    cp(c, [[-27, -26], [-38, -30], [-32, -20], [-27, -18]], '#e0ac6a', { poly: true, lw: LW2, hi: 0.1 });
    cp(c, [[23, -26], [36, -18], [32, -12], [24, -14]], '#e0ac6a', { poly: true, lw: LW2, hi: 0.1 });
    te(c, -4, -27, 5.6, 4.4, '#3a2a80', { hi: 0.15, glint: false });
    te(c, 9, -27.5, 5.6, 4.4, '#3a2a80', { hi: 0.15, glint: false });
  },
  sprites: {
    rays: [-74, -74, 148, 148, (c) => { for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 72, a - 0.08, a + 0.08); c.closePath(); const g = c.createRadialGradient(0, 0, 8, 0, 0, 72); const col = i % 2 ? '255,122,224' : '127,233,255'; g.addColorStop(0, `rgba(${col},0.75)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fill(); } }],
  },
  fxBack: (ctx, R, P) => {
    addGlow(ctx, 0, -50, 64, '#c77dff', 0.3 + Math.sin(P.t * 2) * 0.08);
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    blit(ctx, R.rays, 0, -48, P.t * 0.35, 1, 1, 0.45 + Math.sin(P.t * 1.7) * 0.1);
    ctx.globalCompositeOperation = op;
    atom(ctx, P, false);
  },
  fxFront: (ctx, R, P) => { atom(ctx, P, true); twinkles(ctx, [[-46, -72, 4.5, 0], [44, -80, 4, 2], [-44, -6, 3.5, 4]], P.t, '#ffd6f5', 2.8); },
  ghost: true,
});
function atom(ctx, P, front) {
  const cx = 0, cy = -48;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [tilt, sp, col] of [[0.5, 1.7, '#7fe9ff'], [-0.5, 2.3, '#ff7ae0']]) {
    if (!front) { ell(ctx, cx, cy, 52, 14, tilt); ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, 0.4); ctx.stroke(); }
    const a = P.t * sp, s = Math.sin(a);
    if ((s > 0) === front) {
      const ex = Math.cos(a) * 52, ey = s * 14;
      const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      ctx.globalCompositeOperation = 'source-over';
      addGlow(ctx, x, y, 10, col, 0.9);
      ctx.globalCompositeOperation = 'lighter';
      ell(ctx, x, y, 2.6, 2.6); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  }
  ctx.restore();
}

// =====================================================================
//  Normalisation et mise en place (layout par posture)
// =====================================================================
function norm(def) {
  const raw = (D[def.id] || D.mistigri)(def);
  const S = { ...raw };
  S.id = def.id; S.r = def.r; S.el = def.el; S.elc = (ELEMENTS[def.el] || ELEMENTS.light).color;
  S.fxc = def.el === 'light' ? '#ffc93a' : S.elc; // couleur des effets de rareté (or pour la lumière)
  S.pose = S.pose || 'stand';
  S.head = { rx: 30, ry: 26, cheek: 0.1, chin: 0, top: 0, s: 1, ...(raw.head || {}) };
  S.ears = { type: 'pt', len: 22, wid: 0.34, aL: -0.52, aR: 0.66, tilt: 0.06, ...(raw.ears || {}) };
  S.face = { x: 7, y: 1, sep: 12, rx: 7.6, ry: 9.2, nx: 1, ny: 9.5, mouth: 'w', style: 'round', eye: '#46c46a', ...(raw.face || {}) };
  S.legW = S.legW || 8.5; S.pawK = S.pawK || 1;
  if (S.tail === undefined) S.tail = { ctrl: [[0, 0], [-10, -3], [-16, -14], [-13, -26]], w: [4.8, 4.2] };
  if (S.tail && S.tail.ctrl && S.tail.bendK == null) {
    // courbure plus douce pour les longues queues (panache de l'écureuil…)
    let len = 0; const q = S.tail.ctrl; for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    S.tail = { ...S.tail, bendK: 0.75 * Math.min(1, 38 / len) };
  }
  layout(S);
  // pivots des oreilles (milieu de la base) et pointes (éclats de rareté)
  S.earPiv = [-1, 1].map((side) => { const g = earGeo(S, side); return [(g.b1[0] + g.b2[0]) / 2 * 0.8, (g.b1[1] + g.b2[1]) / 2 * 0.8]; });
  const hs = S.head.s, tips = S.ears.type === 'none' ? [] : [-1, 1].map((side) => earGeo(S, side).tip);
  const F = S.face, eyeK = def.r >= 3 && !S.noFace ? [[S.hx + (F.x + F.sep - F.rx * 0.32) * hs, S.hy + (F.y - F.ry * 0.38) * hs, 2], [S.hx + (F.x - F.sep - F.rx * 0.32) * hs, S.hy + (F.y - F.ry * 0.38) * hs, 2]] : [];
  S.glintPts = [...eyeK, ...tips.map(([x, y]) => [S.hx + x * hs, S.hy + y * hs, 1]), [S.hx - S.head.rx * 0.62 * hs, S.hy - S.head.ry * 0.62 * hs, 1], [S.body.x - (S.body.rx || 12) * 0.3, S.body.y - (S.body.ry || 12) * 0.8, 0], ...(S.glints || []).map(([x, y]) => [x, y, 0])];
  S.mouthPos = [S.face.x + S.face.nx, S.face.y + S.face.ny + 2.6];
  // encre des traits du visage : claire sur les pelages sombres (yeux fermés, bouche lisibles)
  const hf = S.headFur || S.fur;
  S.ink = luma(hf) < 0.3 ? mix(hf, '#f4ecff', 0.62) : OUT;
  S.inkM = luma(S.muzzle || hf) < 0.3 ? mix(S.muzzle || hf, '#f4ecff', 0.62) : OUT;
  return S;
}
function layout(S) {
  const H = S.head, hs = H.s, B = { ...(S.body || {}) };
  S.body = B;
  const pose = S.pose;
  if (pose === 'stand' || pose === 'ball') {
    const L = S.legLen ?? (pose === 'ball' ? 5 : 12);
    B.rx = B.rx ?? 22; B.ry = B.ry ?? 13;
    const hipK = B.hipK ?? (pose === 'ball' ? 0.8 : 0.55);
    if (B.x == null) B.x = -9;
    if (B.y == null) B.y = -(L + B.ry * hipK);
    S.legLen = L; S.hipY = -L;
    S.legs = [
      { x: B.x + B.rx * 0.78, far: true, front: true }, { x: B.x - B.rx * 0.36, far: true, front: false },
      { x: B.x + B.rx * 0.52, far: false, front: true }, { x: B.x - B.rx * 0.62, far: false, front: false },
    ];
    S.hx = B.x + B.rx * 0.95; S.hy = B.y - B.ry * 0.55 - H.ry * 0.72 * hs;
    S.tx = B.x - B.rx * 0.85; S.ty = B.y - B.ry * 0.2;
    S.wx = B.x + 2; S.wy = B.y - B.ry * 0.8;
    S.shadowW = B.rx + 10;
  } else if (pose === 'sit') {
    B.rx = B.rx ?? 13; B.ry = B.ry ?? 16; B.hr = B.hr ?? 12;
    if (B.x == null) B.x = 0;
    const L = S.legLenSit ?? 19;
    if (B.y == null) B.y = -(L + 2) - (S.hover || 0);
    S.legLen = L; S.hipY = B.y + 2;
    S.legs = S.legs === 'none' ? [] : [{ x: B.x + 2, far: true, front: true, sit: true }, { x: B.x + 7.5, far: false, front: true, sit: true }];
    if (S.raisedPaw) S.legs = S.legs.filter((l) => l.far);
    S.hx = B.x + 5; S.hy = B.y - B.ry * 0.62 - H.ry * 0.7 * hs;
    S.tx = B.x - 18; S.ty = -6 - (S.hover || 0);
    S.wx = B.x - 4; S.wy = B.y - B.ry * 0.5;
    S.shadowW = 24;
    if (S.hover) S.legs = [];
  } else if (pose === 'float') {
    const hov = S.hover ?? 12;
    B.rx = B.rx ?? 17; B.ry = B.ry ?? 14;
    if (B.x == null) B.x = -4;
    if (B.y == null) B.y = -(hov + B.ry);
    S.legs = []; S.legLen = 6;
    S.hx = B.x + B.rx * 0.6; S.hy = B.y - B.ry * 0.5 - H.ry * 0.68 * hs;
    S.tx = B.x - B.rx * 0.85; S.ty = B.y + 2;
    S.wx = B.x + 2; S.wy = B.y - B.ry * 0.7;
    S.shadowW = B.rx + 4;
  } else if (pose === 'lie') {
    B.rx = B.rx ?? 26; B.ry = B.ry ?? 11;
    if (B.x == null) B.x = -10;
    if (B.y == null) B.y = -B.ry - 0.5;
    S.legs = []; S.legLen = 6;
    S.hx = B.x + B.rx * 0.95; S.hy = B.y - B.ry * 0.3 - H.ry * 0.74 * hs;
    S.tx = B.x - B.rx * 0.88; S.ty = B.y + 2;
    S.wx = B.x; S.wy = B.y - B.ry;
    S.shadowW = B.rx + 14;
  } else if (pose === 'merm') {
    B.rx = B.rx ?? 14; B.ry = B.ry ?? 13;
    if (B.x == null) B.x = 0;
    if (B.y == null) B.y = -34;
    S.legs = []; S.legLen = 6; S.hover = 8;
    S.hx = B.x + 5; S.hy = B.y - B.ry * 0.5 - H.ry * 0.7 * hs;
    S.tx = B.x - 10; S.ty = B.y;
    S.wx = B.x; S.wy = B.y - 6;
    S.shadowW = 30;
  } else if (pose === 'box') {
    S.legs = []; S.legLen = 6;
    S.hx = 2; S.hy = -50;
    S.tx = -16; S.ty = -26;
    S.wx = 0; S.wy = -30;
    S.shadowW = 34;
  }
  if (S.tailPos) { S.tx = S.tailPos[0]; S.ty = S.tailPos[1]; }
  if (S.wingPos) { S.wx = S.wingPos[0]; S.wy = S.wingPos[1]; }
  S.hx += S.headDX || 0; S.hy += S.headDY || 0;
  S.eyeX = S.face.x + S.face.sep; S.eyeY = S.face.y;
  S.height = Math.round(clamp(-(S.hy - (H.ry + S.ears.len * 0.6) * hs), 70, 95));
  S.pivotY = pose === 'float' || pose === 'merm' ? B.y : 0;
}

// =====================================================================
//  Construction (sprites partagés par identifiant)
// =====================================================================
const BUILT = new Map();
const TAIL_BENDS = [-1, -0.5, 0, 0.5, 1];
const HEAD_BOX = [-100, -150, 200, 210];
// keep = false : construction temporaire (images d'interface), non conservée en mémoire
function built(id, keep = true) {
  let b = BUILT.get(id);
  if (b) return b;
  const S = norm(KITTEN_BY_ID[id] || KITTENS[0]);
  const R = { S };
  // tête complète (visage ouvert, oreilles au repos) : un seul sprite pour le cas courant et l'interface
  R.headFull = sprite(...HEAD_BOX, (c) => paintHead(c, S, 'open'));
  R.head = R.headFull;
  R.faces = {};
  b = { S, R, full: false };
  if (S.r >= 4) R.clip = clipPaths(S);
  if (S.pose === 'box') R.body = sprite(-60, -60, 120, 60, (c) => te(c, S.body.x, S.body.y, S.body.rx, S.body.ry, S.fur, { tint: S.tint }, bodyMarks(S)));
  else R.body = sprite(-110, -130, 220, 140, (c) => paintBody(c, S));
  if (S.under) R.under = sprite(-110, -130, 220, 150, (c) => S.under(c, S));
  if (S.over) R.over = sprite(-110, -130, 220, 150, (c) => S.over(c, S));
  if (S.legs && S.legs.length) {
    R.legN = legSprite(S, false); R.legF = legSprite(S, true);
  }
  if (S.raisedPaw) {
    R.paw = legSprite({ ...S, legLen: 30 }, false);
    R.mitt = sprite(-12, -12, 24, 24, (c) => {
      te(c, 0, 0, 7.5, 8.5, S.paw || S.fur, { hi: 0.25 });
      te(c, 0, 1.8, 3.4, 3, '#ffa3b8', { lw: 0, hi: 0, glint: false, shadow: false });
      for (const dx of [-3.6, 0, 3.6]) { ell(c, dx, -4.2, 1.5, 1.6); c.fillStyle = '#ffa3b8'; c.fill(); }
    });
  }
  // petite patte de toilette (repère tête : centre de la patte en (0,0), avant-bras vers le bas)
  if (!S.noPaws && S.pose !== 'merm') {
    const pc = S.paw || S.legCol || S.fur, lc = S.legCol || S.fur;
    R.lickPaw = sprite(-12, -12, 26, 40, (c) => {
      toon(c, (p) => rr(p, -4.6, -1, 9.2, 26, 4.6), shade(lc, -0.04), { cx: 0, cy: 10, k: 8, hi: 0.1, glint: false });
      te(c, 0, 0, 7.2, 6.4, pc, { hi: 0.24 });
      c.beginPath(); for (const dx of [-2.3, 2.3]) { c.moveTo(dx, -5.6); c.lineTo(dx * 0.9, -2.6); } c.lineWidth = 1.5; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke();
    });
  }
  if (S.tail) { R.tails = [null, null, sprite(-110, -120, 200, 180, (c) => paintTail(c, S, 0)), null, null]; R.tail = R.tails[2]; }
  if (S.wings) {
    const W = S.wings;
    const paintW = (c, far) => {
      if (W.type === 'angel') wingFeather(c, W.len, W.col || '#ffffff', W.tip);
      else if (W.type === 'bat') wingBat(c, W.len, W.col, W.bone);
      else if (W.type === 'dragon') wingBat(c, W.len, '#ff9a3d', '#a8201a', '#fff1d6');
      else if (W.type === 'moth') wingMoth(c, W.len, W.col, W.edge, W.spot);
      else if (W.type === 'falcon') wingFalcon(c, W.len);
      if (far) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(40,20,70,0.28)'; c.fillRect(-200, -200, 400, 400); c.globalCompositeOperation = 'source-over'; }
    };
    R.wingN = sprite(-110, -110, 130, 160, (c) => paintW(c, false));
    R.wingF = sprite(-110, -110, 130, 160, (c) => paintW(c, true));
  }
  for (const [name, d] of Object.entries(S.sprites || {})) R[name] = sprite(d[0], d[1], d[2], d[3], (c) => d[4](c, S), d[5] || RES);
  if (keep) BUILT.set(id, b);
  return b;
}
// couches animées (rigs de combat) : arrière de tête, oreilles mobiles, crâne, expressions, accessoires,
// poses de queue. Résolution un peu plus basse (affichées à ~1 px/unité en combat) pour la mémoire.
const RES_V = 1.8;
function ensureFull(b) {
  if (b.full) return;
  b.full = true;
  const { S, R } = b, h = R.headFull, HB = [h.x0 - 6, h.y0 - 6, h.w + 12, h.h + 12];
  const FB = [Math.max(HB[0], -52), Math.max(HB[1], -50), 0, 0]; FB[2] = Math.min(HB[0] + HB[2], 64) - FB[0]; FB[3] = Math.min(HB[1] + HB[3], 54) - FB[1];
  R.hBack = S.headBack || S.ruff ? sprite(...HB, (c) => paintHeadBack(c, S), RES_V) : null;
  R.ears = S.ears.type === 'none' ? [null, null] : [sprite(...HB, (c) => paintEar(c, S, -1), RES_V), sprite(...HB, (c) => paintEar(c, S, 1), RES_V)];
  R.skull = sprite(...HB, (c) => paintSkull(c, S), RES_V);
  R.hFront = S.headFront ? sprite(...HB, (c) => paintHeadFront(c, S), RES_V) : null;
  if (!S.noFace) {
    // boîte du visage ouvert (+ marge pour bâillement, sourcils, langue) : pas de nouveau balayage de pixels
    const o = R.faces.open = sprite(...FB, (c) => face(c, S, 'open'), RES_V);
    const x0 = o.x0 - 2, y0 = o.y0 - 6, w = o.w + 4, hh = o.h + 15;
    for (const v of FACES) if (v !== 'open') R.faces[v] = makeSprite(x0, y0, w, hh, (c) => face(c, S, v), RES_V);
  } else for (const v of FACES) R.faces[v] = null;
  if (S.tail && !S.tail.draw) {
    const t = R.tails[2], m = Math.max(24, Math.max(t.w, t.h) * 0.75), TB = [t.x0 - m, t.y0 - m, t.w + m * 2, t.h + m * 2];
    for (const i of [0, 1, 3, 4]) R.tails[i] = sprite(...TB, (c) => paintTail(c, S, TAIL_BENDS[i]), RES_V);
  }
}
function wingFalcon(c, L) {
  // aile d'Isis : couvertures or / turquoise et longues rémiges lapis à pointe d'or
  const top = scalePts([[-0.35, -0.4], [-0.8, -0.58], [-1.3, -0.64], [-1.78, -0.52]], L);
  const tips = scalePts([[-1.9, -0.28], [-1.68, 0.0], [-1.43, 0.18], [-1.17, 0.28], [-0.91, 0.32], [-0.64, 0.3], [-0.36, 0.22]], L);
  const fn = (p) => wingPath(p, top, tips, -L * 0.08);
  toon(c, fn, '#2a5bd7', { cx: -L * 0.9, cy: -L * 0.2, k: L * 0.9, hi: 0.18 }, (cc) => {
    const band = (dy, w, col) => { cc.beginPath(); cc.moveTo(L * 0.2, dy * L - L * 0.1); crTo(cc, [[L * 0.2, dy * L - L * 0.1], ...top.map(([x, y]) => [x, y + dy * L])]); cc.lineWidth = L * w; cc.strokeStyle = col; cc.lineCap = 'butt'; cc.stroke(); };
    band(0.08, 0.26, GOLD); band(0.3, 0.14, '#2ad1c9');
    // pointes d'or des rémiges
    const all = [top[top.length - 1], ...tips];
    for (let i = 1; i < all.length; i++) { const a = all[i - 1], b = all[i]; ell(cc, (a[0] + b[0]) / 2 - L * 0.03, (a[1] + b[1]) / 2 + L * 0.03, L * 0.11, L * 0.11); cc.fillStyle = '#ffe38a'; cc.fill(); }
    cc.strokeStyle = rgba(OUT, 0.7); cc.lineWidth = 1.6; cc.lineCap = 'round';
    for (const [x, y] of tips.slice(0, 6)) { cc.beginPath(); cc.moveTo(x * 0.96 + L * 0.04, y - L * 0.42); cc.lineTo(x, y); cc.stroke(); }
    cc.beginPath(); cc.moveTo(L * 0.1, L * 0.12); crTo(cc, [[L * 0.1, L * 0.12], ...top.map(([x, y]) => [x * 0.98, y + L * 0.38])]); cc.stroke();
  });
}

// =====================================================================
//  Sprites partagés (ombre, cercles magiques, émoticônes, particules)
// =====================================================================
const SHARED = new Map();
function shared(key, make) { let s = SHARED.get(key); if (!s) { s = make(); SHARED.set(key, s); } return s; }
function shadowSprite() {
  return shared('shadow', () => makeSprite(-40, -10, 80, 20, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, 'rgba(20,8,40,0.5)'); g.addColorStop(0.55, 'rgba(20,8,40,0.36)'); g.addColorStop(0.8, 'rgba(20,8,40,0.12)'); g.addColorStop(1, 'rgba(20,8,40,0)');
    c.scale(1, 0.25); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.fill();
  }, 1.6));
}
// cercle magique sous les pattes (raretés Mythique+), pré-aplati (dessin sans rotation = rapide).
// Composition normale : traits saturés + cœur clair + halo, lisible sur fond clair comme sombre.
function circleSprite(col, lvl) {
  return shared('circle' + col + lvl, () => makeSprite(-54, -18, 108, 36, (c) => {
    c.scale(1, 0.3);
    const dk = shade(col, -0.3), lt = mix(col, '#ffffff', 0.55);
    const halo = c.createRadialGradient(0, 0, 20, 0, 0, 52);
    halo.addColorStop(0, rgba(col, 0)); halo.addColorStop(0.7, rgba(col, 0.16)); halo.addColorStop(0.86, rgba(col, 0.3)); halo.addColorStop(1, rgba(col, 0));
    c.fillStyle = halo; c.beginPath(); c.arc(0, 0, 52, 0, TAU); c.fill();
    const ring = (r, w) => { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.lineWidth = w + 2.4; c.strokeStyle = rgba(dk, 0.55); c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); c.lineWidth = w * 0.4; c.strokeStyle = lt; c.stroke(); };
    ring(44, 3); ring(37, 1.8);
    c.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, r0 = 38.5, r1 = i % 2 ? 41 : 43.5;
      c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.lineWidth = i % 2 ? 1.8 : 2.8; c.strokeStyle = i % 2 ? col : lt; c.stroke();
    }
    if (lvl >= 2) {
      for (const a0 of [-Math.PI / 2, Math.PI / 2]) {
        c.beginPath(); for (let i = 0; i < 3; i++) { const a = a0 + (i / 3) * TAU; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 34, Math.sin(a) * 34); } c.closePath();
        c.lineWidth = 4.2; c.strokeStyle = rgba(dk, 0.4); c.stroke(); c.lineWidth = 2; c.strokeStyle = col; c.stroke();
      }
      ring(17, 1.6);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; c.beginPath(); c.arc(Math.cos(a) * 44, Math.sin(a) * 44, 3.4, 0, TAU); c.fillStyle = lt; c.fill(); c.lineWidth = 1.6; c.strokeStyle = dk; c.stroke(); }
    }
    if (lvl >= 3) for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; c.beginPath(); c.arc(0, 0, 49.5, a, a + TAU / 30 + 0.01); c.lineWidth = 3.6; c.strokeStyle = RAINBOW[i % RAINBOW.length]; c.stroke(); }
  }, 1.5));
}
// étoile « gemme » (composition normale) : lisible sur fond clair comme sombre
function gemStar(col) {
  return shared('gem' + col, () => makeSprite(-14, -14, 28, 28, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 13);
    g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.45, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
    c.beginPath(); twinkle(c, 0, 0, 11, 0.2); c.fillStyle = mix(col, '#ffffff', 0.35); c.fill(); c.lineWidth = 2; c.strokeStyle = rgba(shade(col, -0.35), 0.75); c.stroke();
    c.beginPath(); twinkle(c, 0, 0, 6, 0.24); c.fillStyle = '#ffffff'; c.fill();
  }, 2));
}
function bandSprite() {
  return shared('band', () => {
    const c = document.createElement('canvas'); c.width = 48; c.height = 4;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 48, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.95)'); g.addColorStop(0.46, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.75)'); g.addColorStop(0.72, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 48, 4);
    return c;
  });
}
const EMOTES = {
  heart: (c) => { c.beginPath(); heartPath(c, 0, 0, 6.5); paint2(c, '#ff5a8a', 2.2); ell(c, -2.6, -2.6, 1.6, 1.1, -0.6); c.fillStyle = '#ffffff'; c.fill(); },
  note: (c) => {
    line2(c, [[2.5, 4], [2.5, -8], [7.5, -6]], 2, '#5a3ad8', 1.4);
    te(c, -0.5, 4.5, 3.6, 2.8, '#7a5aff', { lw: 1.8, rot: -0.4, hi: 0.3 });
  },
  sweat: (c) => { c.beginPath(); c.moveTo(0, -7); c.bezierCurveTo(2.5, -3, 5, 0, 5, 2.5); c.arc(0, 2.5, 5, 0, Math.PI); c.bezierCurveTo(-5, 0, -2.5, -3, 0, -7); c.closePath(); paint2(c, '#9fe4ff', 2); ell(c, -1.6, 2, 1.2, 1.8, 0.3); c.fillStyle = '#ffffff'; c.fill(); },
  excl: (c) => { rr(c, -2.2, -9, 4.4, 11, 2.2); paint2(c, '#ffd23f', 1.8); ell(c, 0, 6, 2.4, 2.4); paint2(c, '#ffd23f', 1.8); },
};
function emoteSprite(n) { return shared('emo' + n, () => makeSprite(-12, -12, 24, 24, (c) => EMOTES[n](c), 2.4)); }
const MOTES = {
  leaf: (c) => { c.beginPath(); leafPath(c, -5, 0, 10, 3.6, 0); paint2(c, '#7ee08f', 1.4); },
  petal: (c) => { c.beginPath(); leafPath(c, -4, 0, 8, 3.4, 0); paint2(c, '#ffb7e2', 1.4); },
  bubble: (c) => { ell(c, 0, 0, 3.4, 3.4); c.fillStyle = 'rgba(191,244,255,0.35)'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = '#e8fbff'; c.stroke(); ell(c, -1.2, -1.2, 1, 0.7, -0.6); c.fillStyle = '#ffffff'; c.fill(); },
  bolt: (c) => { c.beginPath(); poly(c, boltPts(0, 0, 5, 0.3)); c.fillStyle = '#fff6b0'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#ffb000'; c.stroke(); },
  puff: (c) => blob(c, [[0, 0, 4.4], [-3.6, 1.4, 3.2], [3.6, 1.6, 3]], '#f4eefa', { lw: 1.4, k: 6, hi: 0.3 }),
};
function moteSprite(n) { return shared('mote' + n, () => makeSprite(-8, -8, 16, 16, (c) => MOTES[n](c), 2.4)); }
// étincelle additive « brute » : l'appelant a déjà mis globalCompositeOperation = 'lighter'
function sparkRaw(ctx, x, y, r, col, a, ga) {
  if (a <= 0.02 || r <= 0.15) return;
  let s = SPARKS.get(col);
  if (!s) { addSpark(ctx, -9999, -9999, 1, col, 1); s = SPARKS.get(col); }
  ctx.globalAlpha = ga * Math.min(1, a);
  ctx.drawImage(s.c, x - r, y - r, r * 2, r * 2);
}
// silhouettes simplifiées (tête + oreilles, corps) pour le reflet balayant
function clipPaths(S) {
  const H = S.head, head = new Path2D(), body = new Path2D();
  const hp = P2((p) => smooth(p, headPts(H), true, 0.5)); head.addPath(hp);
  if (S.ears.type !== 'none' && !S.ears.draw) for (const side of [-1, 1]) head.addPath(P2(earShape(earGeo(S, side), S.ears.type)));
  const B = S.body;
  if (S.pose === 'box' || S.pose === 'merm') return { head, body: null };
  if (S.pose === 'none') return { head, body: null };
  E(body, B.x, B.y, B.rx * (S.pose === 'sit' ? 1.1 : 1), B.ry);
  if (S.pose === 'sit') E(body, B.x - B.rx * 0.75, -B.hr * 0.98 - (S.hover || 0), B.hr * 1.05, B.hr);
  if (S.pose === 'lie') E(body, B.x - B.rx * 0.45, B.y - 1, B.ry * 1.25, B.ry * 1.1);
  return { head, body };
}

// =====================================================================
//  RIG animé
// =====================================================================
function hashId(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const isFloaty = (S) => S.pose === 'float' || S.pose === 'merm' || (S.pose === 'sit' && !!S.hover);
// petites scènes de repos (durées en secondes)
const ACTS = { lick: 1.9, yawn: 2.0, look: 2.5, hop: 1.15, spin: 1.1, wiggle: 1.6, purr: 2.4, sparkle: 1.5, peek: 2.0 };
function actList(S) {
  if (S.acts) return S.acts;
  const L = [], add = (n, w) => { for (let i = 0; i < w; i++) L.push(n); };
  const fl = isFloaty(S), playful = ['bounce', 'jitter', 'bop', 'wobble'].includes(S.idle), lick = !S.noPaws && S.pose !== 'merm';
  if (S.pose === 'box') { add('peek', 3); add('look', 2); add('yawn', 1); add('purr', 1); }
  else if (S.pose === 'lie') { add('yawn', 2); add('look', 2); add('lick', 2); add('purr', 2); }
  else if (fl) { add('spin', 2); add('hop', 2); add('look', 2); add('yawn', 1); add('purr', 1); if (lick) add('lick', 1); }
  else if (playful) { add('hop', 3); add('spin', 2); add('look', 1); add('lick', 1); add('yawn', 1); if (S.pose !== 'sit') add('wiggle', 2); }
  else { add('lick', 3); add('yawn', 2); add('look', 2); add('purr', 2); add('hop', 1); if (S.pose !== 'sit') add('wiggle', 1); }
  if (S.r >= 4) add('sparkle', S.r >= 6 ? 3 : 2);
  return L;
}
// niveau d'effets par rareté : éclats, étincelles en orbite, particules d'élément, reflet, cercle magique
const RFX = [
  { glint: 0, orbit: 0, motes: 0 },
  { glint: 0.7, orbit: 0, motes: 0 },
  { glint: 1, orbit: 1, motes: 0 },
  { glint: 1.3, orbit: 2, motes: 2 },
  { glint: 1.6, orbit: 3, motes: 2, sweep: 1 },
  { glint: 1.8, orbit: 3, motes: 3, sweep: 1, circle: 1 },
  { glint: 2, orbit: 3, motes: 3, sweep: 1, circle: 2, run: 2 },
  { glint: 2.2, orbit: 4, motes: 3, sweep: 1, circle: 2, run: 2 },
  { glint: 2.5, orbit: 5, motes: 4, sweep: 1, circle: 3, run: 3 },
];
const BLINK_D = [0.17, 0.4, 0.85];
const earFlick = (s) => (s < 0 ? 0 : Math.sin((s / 0.5) * Math.PI * 3) * (1 - s / 0.5) * 0.42);
const env = (q, a, b) => ease(clamp(q / a)) * ease(clamp((1 - q) / b));
function dI(c, s) { c.drawImage(s.c, s.x0, s.y0, s.w, s.h); }
function blitPivot(c, s, px, py, r) {
  c.save(); c.translate(px, py); c.rotate(r);
  c.drawImage(s.c, s.x0 - px, s.y0 - py, s.w, s.h);
  c.restore();
}

export class KittenRig {
  constructor(id, opts = {}) {
    const b = built(KITTEN_BY_ID[id] ? id : KITTENS[0].id, !opts.transient);
    if (!opts.transient) ensureFull(b);
    this.b = b; this.id = b.S.id; this.S = b.S; this.R = b.R;
    this.height = this.S.height;
    this.t = Math.random() * 10;
    this.phase = (hashId(this.id) % 1000) / 1000 * TAU;
    this.floaty = isFloaty(this.S);
    this.fx = RFX[clamp(this.S.r | 0, 0, 8)];
    this.cRun = mix(this.S.fxc, '#ffffff', 0.5); this.cGlint = mix(this.S.fxc, '#ffffff', 0.55);
    this.shineD = -1e9;
    this.blinkT = 1 + Math.random() * 3; this.blinkS = -1; this.blinkM = 0;
    this.earT = 1 + Math.random() * 3; this.earS = [-1, -1];
    this.acts = actList(this.S); this.act = null; this.actS = 0; this.actD = 1; this.actT = 1.5 + Math.random() * 3.5;
    this.glintT = 0.5 + Math.random() * 3; this.glintS = -1; this.glintI = 0;
    this.sweepT = 1.5 + Math.random() * 3; this.sweepS = -1;
    this.lastSt = 'idle'; this.still = false; this.flash = 0;
    this.Q = {};
    this.P = { t: 0, st: 'idle', k: 0, run: false, closed: false, peek: 0 };
  }
  // origine des projectiles : l'œil avant (repère local, regard à droite, échelle 1)
  get eyePos() { const S = this.S; return [S.hx + S.eyeX * S.head.s, S.hy + S.eyeY * S.head.s]; }
  get handPos() { const S = this.S; return [S.hx + S.face.x * S.head.s, S.hy + 14 * S.head.s]; }
  // lance une petite scène de repos (lick, yawn, look, hop, spin, wiggle, purr, sparkle, peek)
  playIdle(name) { if (ACTS[name]) { this.act = name; this.actS = 0; this.actD = ACTS[name]; } }
  update(dt) {
    this.t += dt;
    if (this.still) return;
    // clignements variés : simple, double, lent (« je t'aime » félin)
    if (this.blinkS >= 0) { this.blinkS += dt; if (this.blinkS > BLINK_D[this.blinkM]) { this.blinkS = -1; this.blinkT = 1.6 + Math.random() * 3.8; } }
    else if ((this.blinkT -= dt) <= 0) { const r = Math.random(); this.blinkM = r < 0.66 ? 0 : r < 0.88 ? 1 : 2; this.blinkS = 0; }
    // frémissements d'oreilles
    for (let i = 0; i < 2; i++) if (this.earS[i] >= 0 && (this.earS[i] += dt) > 0.5) this.earS[i] = -1;
    if ((this.earT -= dt) <= 0) { const r = Math.random(); if (r < 0.42) this.earS[0] = 0; else if (r < 0.84) this.earS[1] = 0; else this.earS[0] = this.earS[1] = 0; this.earT = 1.3 + Math.random() * 3.8; }
    // scènes de repos (seulement à l'arrêt ; interrompues par l'attaque ou la course)
    if (this.lastSt === 'idle') {
      if (this.act) { if ((this.actS += dt) >= this.actD) { this.act = null; this.actT = 2 + Math.random() * 4.5; } }
      else if ((this.actT -= dt) <= 0 && this.acts.length) this.playIdle(this.acts[(Math.random() * this.acts.length) | 0]);
    } else if (this.act) { this.act = null; this.actT = 0.6 + Math.random() * 2.4; }
    // éclats et reflets de rareté
    const F = this.fx;
    if (F.glint) {
      if (this.glintS >= 0) { if ((this.glintS += dt) > 0.55) this.glintS = -1; }
      else if ((this.glintT -= dt) <= 0) { this.glintS = 0; this.glintI = (Math.random() * 97) | 0; this.glintT = (4.2 / F.glint) * (0.5 + Math.random()); }
    }
    if (F.sweep) {
      if (this.sweepS >= 0) { if ((this.sweepS += dt) > 0.8) this.sweepS = -1; }
      else if ((this.sweepT -= dt) <= 0) { this.sweepS = 0; this.sweepT = 3.2 + Math.random() * 3.2; }
    }
  }
  _blinkFace() {
    const s = this.blinkS;
    if (s < 0) return null;
    if (this.blinkM === 0) return s < 0.04 ? 'half' : s < 0.12 ? 'closed' : 'half';
    if (this.blinkM === 1) { const u = s < 0.2 ? s : s - 0.2; return u < 0.04 ? 'half' : u < 0.12 ? 'closed' : u < 0.17 ? 'half' : null; }
    return s < 0.16 ? 'half' : s < 0.62 ? 'closed' : 'half';
  }
  // ---------------------------------------------------------------- pose de l'image
  _pose(st, k) {
    const S = this.S, Q = this.Q, t = this.t + this.phase, P = this.P;
    Q.px = 0; Q.py = 0; Q.rt = 0; Q.pvx = 0; Q.pvy = S.pivotY; Q.sx = 1; Q.sy = 1; Q.spin = 1;
    Q.tilt = 0; Q.hdx = 0; Q.hdy = 0; Q.hsx = 1; Q.hsy = 1; Q.ear0 = 0; Q.ear1 = 0;
    Q.tailS = 1; Q.legA = 0; Q.legB = 0; Q.lick = 0; Q.lickY = 0; Q.duck = 0;
    Q.flap = 0; Q.flapS = 1; Q.sh = 1; Q.face = 'open'; Q.emote = null; Q.emoteK = 0; Q.burst = -1; Q.puff = -1; Q.hit = -1;
    const ts = S.tailSpeed || 2.2, tk = S.tailK ?? 0.13;
    Q.tailA = Math.sin(t * ts) * tk;
    Q.bend = -Math.cos(t * ts) * Math.min(0.9, 0.15 + tk * 4); // la pointe suit avec retard
    if (!this.still) { Q.ear0 = earFlick(this.earS[0]); Q.ear1 = earFlick(this.earS[1]); }
    const bf = this.still ? null : this._blinkFace();
    if (bf) Q.face = bf;
    P.peek = 1;
    if (st === 'run') {
      const ph = t * 12, s1 = Math.sin(ph), h = Math.abs(s1), c1 = Math.cos(ph);
      if (this.floaty) {
        Q.py = Math.sin(ph * 0.5) * 2.5; Q.rt = 0.12; Q.tailA = -0.3 + s1 * 0.1; Q.bend = -0.5 + c1 * 0.3; Q.tilt = -0.04;
        Q.flap = Math.sin(t * 12) * 0.35; Q.flapS = 1 - Math.abs(Math.sin(t * 12)) * 0.25; Q.ear0 = Q.ear1 = 0.22 + Math.sin(ph) * 0.06;
      } else {
        // bonds élastiques : écrasé au contact, étiré en l'air
        const land = 1 - Math.min(1, h * 3.2);
        Q.py = -h * 9; Q.sy = 1 + (h - 0.35) * 0.1 - land * 0.07; Q.sx = 1 / Q.sy;
        Q.rt = 0.05 + c1 * 0.06; Q.tilt = -c1 * 0.06; Q.hdy = Math.cos(ph * 2 - 0.8) * 1.3;
        Q.legA = c1 * 0.75; Q.legB = -c1 * 0.75;
        Q.tailA = -0.38 + Math.sin(ph * 2 - 0.6) * 0.12; Q.bend = -0.45 - Math.cos(ph * 2 - 0.6) * 0.45;
        Q.sh = 1 - h * 0.3; Q.flap = Math.sin(t * 12) * 0.3; Q.flapS = 1 - Math.abs(Math.sin(t * 12)) * 0.2;
        Q.ear0 = Q.ear1 = 0.22 + Math.sin(ph * 2 - 1.3) * 0.12;
        Q.puff = (ph / Math.PI) % 1;
      }
    } else if (st === 'attack' || st === 'cast') {
      // anticipation (tassé, oreilles en arrière) → bond (étiré, « nya ! ») → réception écrasée → retour
      if (k < 0.22) {
        const e = ease(k / 0.22);
        Q.px = -5 * e; Q.sy = 1 - 0.13 * e; Q.sx = 1 + 0.09 * e; Q.rt = -0.07 * e; Q.tilt = -0.06 * e;
        Q.tailA = 0.3 * e; Q.bend = 0.7 * e; Q.flap = -0.25 * e; Q.ear0 = Q.ear1 = 0.32 * e; Q.face = 'open';
      } else if (k < 0.6) {
        const q = (k - 0.22) / 0.38, a = Math.sin(q * Math.PI);
        Q.px = -5 + 25 * ease(q); Q.py = -14 * a; Q.rt = 0.18 * a; Q.sx = 1 + 0.12 * a; Q.sy = 1 - 0.06 * a; Q.tilt = 0.1;
        Q.legA = 0.85 * a; Q.legB = -0.7 * a; Q.tailA = -0.5 * a; Q.bend = -0.8 * a; Q.flap = 0.5 * a; Q.sh = 1 - a * 0.35;
        Q.ear0 = Q.ear1 = 0.32 - 0.5 * a; Q.face = 'shout';
      } else if (k < 0.78) {
        const q = (k - 0.6) / 0.18, a = Math.sin(q * Math.PI);
        Q.px = 20; Q.sy = 1 - 0.1 * a; Q.sx = 1 + 0.08 * a; Q.tilt = 0.1 - 0.16 * a; Q.ear0 = Q.ear1 = -0.18 * a; Q.bend = 0.5 * a; Q.face = 'shout';
      } else {
        const e = ease((k - 0.78) / 0.22);
        Q.px = 20 * (1 - e); Q.tilt = -0.06 * (1 - e);
      }
      if (k > 0.38 && k < 0.8) Q.hit = (k - 0.38) / 0.42;
    } else if (st === 'hurt' || st === 'dead') {
      const dead = st === 'dead', a = dead ? 1 : Math.sin(k * Math.PI);
      Q.px = -9 * a; Q.py = dead ? 0 : -3 * Math.sin(clamp(k * 2) * Math.PI); Q.rt = -0.18 * a; Q.sy = 1 - 0.1 * a; Q.sx = 1 + 0.06 * a;
      Q.tilt = -0.16 * a; Q.tailA = 0.3 * a; Q.tailS = 1 + 0.22 * a; Q.bend = 0.6 * a; Q.flap = -0.25 * a;
      Q.ear0 = Q.ear1 = 0.55 * a;
      Q.face = dead ? 'closed' : k < 0.85 ? 'hurt' : 'open';
      if (!dead) { Q.emote = 'sweat'; Q.emoteK = k; }
    } else if (st === 'victory') {
      // petits bonds de joie, yeux ^^, cœurs
      const u = (t * 1.5) % 1;
      if (u < 0.18) { const e = Math.sin((u / 0.18) * Math.PI); Q.sy = 1 - 0.1 * e; Q.sx = 1 + 0.07 * e; }
      else { const q = (u - 0.18) / 0.82, a = Math.sin(q * Math.PI); Q.py = -(this.floaty ? 9 : 15) * a; Q.sy = 1 + 0.06 * Math.cos(q * Math.PI); Q.sx = 1 / Q.sy; Q.legA = -0.45 * a; Q.legB = 0.45 * a; Q.sh = 1 - a * 0.3; }
      Q.face = 'happy'; Q.ear0 = Q.ear1 = -0.15; Q.tailA = -0.2 + Math.sin(t * 8) * 0.25; Q.bend = -Math.cos(t * 8) * 0.8; Q.tilt = Math.sin(t * 3) * 0.08;
      Q.flap = Math.sin(t * 9) * 0.3; Q.emote = 'heart'; Q.emoteK = (t * 0.5) % 1; Q.burst = (t * 0.75) % 1;
    } else {
      const id = S.idle || 'breathe';
      Q.flap = Math.sin(t * 3) * 0.13; Q.flapS = 1 - Math.abs(Math.sin(t * 3)) * 0.12;
      if (id === 'bounce') { const h = Math.abs(Math.sin(t * 3)); Q.py = -h * 3; Q.sy = 1 + (h - 0.3) * 0.03; Q.tilt = Math.sin(t * 1.5) * 0.04; }
      else if (id === 'wobble') { Q.rt = Math.sin(t * 2.6) * 0.07; Q.tilt = -Q.rt * 0.6; Q.sy = 1 + Math.sin(t * 5.2) * 0.015; }
      else if (id === 'sway') { Q.rt = Math.sin(t * 1.6) * 0.035; Q.tilt = Math.sin(t * 1.6 + 1) * 0.05; }
      else if (id === 'float') { Q.py = Math.sin(t * 2.2) * 3; Q.rt = Math.sin(t * 1.1) * 0.03; Q.sh = 1 - Math.sin(t * 2.2) * 0.08; Q.tilt = Math.sin(t * 1.3) * 0.04; }
      else if (id === 'water') { Q.py = Math.sin(t * 2) * 1.6; Q.rt = Math.sin(t * 1.4) * 0.04; Q.tilt = Math.sin(t * 1.4 + 0.8) * 0.04; }
      else if (id === 'bop') { Q.tilt = Math.sin(t * 6.5) * 0.09; Q.py = -Math.abs(Math.sin(t * 6.5)) * 1.5; Q.ear0 = Q.ear1 = Math.sin(t * 6.5 - 0.6) * 0.08; }
      else if (id === 'jitter') { const h = Math.abs(Math.sin(t * 4.5)); Q.py = -h * 2.2; Q.px = Math.sin(t * 41) * 0.35; Q.tilt = Math.sin(t * 2.2) * 0.04; }
      else if (id === 'crouch') { Q.sy = 1 + Math.sin(t * 2.2) * 0.02; Q.tilt = Math.sin(t * 1.1) * 0.03; Q.px = Math.sin(t * 1.1) * 0.8; }
      else if (id === 'peek') { const q = Math.max(0, Math.sin(t * 0.9)); Q.tilt = Math.sin(t * 1.7) * 0.06; P.peek = q; }
      else { Q.sy = 1 + Math.sin(t * 2.6) * 0.022; Q.tilt = Math.sin(t * 1.7) * 0.035; }
      // respiration : la tête suit le corps avec un léger retard
      Q.hdy += Math.sin(t * 2.6 - 0.9) * 0.55;
      if (this.act && !this.still) this._act(bf);
    }
    return Q;
  }
  _act(bf) {
    const S = this.S, Q = this.Q, s = this.actS, q = s / this.actD, B = S.body;
    switch (this.act) {
      case 'lick': {
        // se lèche la patte : patte à la bouche, petits coups de langue
        const e = env(q, 0.13, 0.13), cyc = Math.sin(Math.max(0, s - 0.25) * 13);
        Q.lick = e; Q.lickY = cyc * 1.8 * e;
        Q.tilt += (0.14 + cyc * 0.035) * e; Q.hdy += 1.4 * e; Q.hdx += 0.8 * e;
        if (e > 0.55) Q.face = bf === 'closed' ? 'closed' : 'lick';
        Q.ear0 += 0.1 * e; Q.ear1 += 0.06 * e;
        break;
      }
      case 'yawn': {
        const up = env(q, 0.16, 0.3);
        Q.tilt -= 0.2 * up; Q.sy *= 1 + 0.045 * up; Q.hdy -= 1.4 * up;
        if (q > 0.12 && q < 0.62) Q.face = 'yawn'; else if (q >= 0.62 && q < 0.74) Q.face = 'closed';
        Q.ear0 += 0.3 * up; Q.ear1 += 0.3 * up;
        if (q > 0.74) { const u = (q - 0.74) / 0.26, w = Math.sin(u * Math.PI * 4) * (1 - u); Q.tilt += w * 0.07; Q.ear0 += w * 0.22; Q.ear1 -= w * 0.22; }
        break;
      }
      case 'look': {
        // regarde derrière lui, puis penche la tête (« ? »)
        const on = q > 0.08 && q < 0.7;
        const pop = Math.max(0, 1 - Math.min(Math.abs(q - 0.08), Math.abs(q - 0.7)) / 0.03);
        Q.hsx = (on ? -1 : 1) * (1 - 0.14 * pop); Q.hsy = 1 + 0.07 * pop;
        if (on) { Q.tilt += -0.08 + Math.sin(s * 2.4) * 0.05; Q.hdx -= 2.5; Q.ear0 -= 0.12; Q.ear1 -= 0.12; }
        if (q > 0.74) { const u = (q - 0.74) / 0.26, a = Math.sin(u * Math.PI); Q.tilt += a * 0.22; Q.ear0 += a * 0.18; Q.ear1 -= a * 0.1; }
        break;
      }
      case 'hop': {
        const u = (s - 0.05) / 0.52;
        if (u > 0 && u < 2) {
          const hu = u % 1;
          if (hu < 0.22) { const c = Math.sin((hu / 0.22) * Math.PI); Q.sy *= 1 - 0.1 * c; Q.sx *= 1 + 0.07 * c; }
          else if (hu < 0.85) { const w = (hu - 0.22) / 0.63, a = Math.sin(w * Math.PI); Q.py -= (this.floaty ? 8 : 12) * a; Q.sy *= 1 + 0.07 * Math.cos(w * Math.PI); Q.sx /= 1 + 0.04 * Math.cos(w * Math.PI); Q.legA = -0.45 * a; Q.legB = 0.45 * a; Q.ear0 += 0.2 * Math.cos(w * Math.PI) - 0.05; Q.ear1 = Q.ear0; Q.sh = 1 - 0.3 * a; Q.flap = Math.sin(s * 14) * 0.4; }
          else { const c = Math.sin(((hu - 0.85) / 0.15) * Math.PI); Q.sy *= 1 - 0.08 * c; Q.sx *= 1 + 0.06 * c; }
        }
        Q.face = 'happy'; Q.emote = 'heart'; Q.emoteK = q;
        Q.tailA += Math.sin(s * 12) * 0.15;
        break;
      }
      case 'spin': {
        // tourne après sa queue (ou fait un looping s'il flotte)
        const th = TAU * ease(clamp((q - 0.08) / 0.84));
        if (this.floaty) { Q.rt += th; Q.pvx = S.body.x + 4; Q.pvy = (B.y + S.hy) * 0.5; Q.py -= 5 * Math.sin(q * Math.PI); }
        else {
          // demi-tours francs (jamais « en lame de couteau ») avec petits bonds
          const cs = Math.cos(th);
          Q.spin = (cs < 0 ? -1 : 1) * (0.5 + 0.5 * Math.abs(cs)); Q.sy *= 1 + 0.08 * (1 - Math.abs(cs));
          Q.py -= 7 * Math.abs(Math.sin(q * Math.PI * 2));
          Q.tailA += Math.sin(s * 15) * 0.3;
        }
        Q.face = 'happy';
        break;
      }
      case 'wiggle': {
        // jeu de chasse : se tasse, remue le derrière… et bondit
        const front = B.x + (B.rx || 12) * 0.75;
        if (q < 0.68) {
          const e = ease(clamp(q / 0.14));
          Q.sy *= 1 - 0.1 * e; Q.sx *= 1 + 0.06 * e; Q.px -= 2 * e; Q.tilt -= 0.05 * e; Q.ear0 -= 0.15 * e; Q.ear1 -= 0.15 * e;
          if (q > 0.14) { Q.pvx = front; Q.pvy = 0; Q.rt += Math.sin(s * 30) * 0.035; Q.tailA += Math.sin(s * 16) * 0.28; Q.bend = -Math.cos(s * 16) * 0.8; }
          if (bf !== 'closed') Q.face = 'open';
        } else if (q < 0.86) {
          const u = (q - 0.68) / 0.18, a = Math.sin(u * Math.PI);
          Q.px += -2 + 10 * ease(u); Q.py -= 9 * a; Q.sx *= 1 + 0.08 * a; Q.legA = 0.6 * a; Q.legB = -0.5 * a; Q.face = 'shout'; Q.tailA -= 0.3 * a; Q.sh = 1 - 0.3 * a;
        } else {
          const u = (q - 0.86) / 0.14, c = Math.sin(u * Math.PI);
          Q.px += 8 * (1 - ease(u)); Q.sy *= 1 - 0.08 * c; Q.sx *= 1 + 0.05 * c; Q.face = 'happy';
        }
        break;
      }
      case 'purr': {
        const e = env(q, 0.12, 0.12);
        Q.face = e > 0.4 ? 'closed' : 'half';
        Q.tilt += (Math.sin(s * 2.4) * 0.07 + 0.04) * e; Q.ear0 += 0.1 * e; Q.ear1 += 0.1 * e;
        Q.sy *= 1 + Math.sin(s * 9) * 0.008 * e;
        Q.emote = 'note'; Q.emoteK = q;
        break;
      }
      case 'sparkle': {
        const e = env(q, 0.15, 0.22);
        Q.sy *= 1 + 0.05 * e; Q.tilt -= 0.1 * e; Q.hdy -= 1.5 * e; Q.ear0 -= 0.12 * e; Q.ear1 -= 0.12 * e; Q.tailA -= 0.2 * e;
        Q.face = 'happy'; Q.burst = q;
        break;
      }
      case 'peek': {
        // se cache dans sa boîte… et ressort d'un coup
        let d = 0;
        if (q < 0.22) d = ease(q / 0.22); else if (q < 0.55) d = 1; else if (q < 0.68) { const u = (q - 0.55) / 0.13; d = 1 - ease(u) - Math.sin(u * Math.PI) * 0.15; }
        Q.duck = d; Q.ear0 += 0.3 * Math.min(1, d * 2); Q.ear1 += 0.3 * Math.min(1, d * 2);
        if (q < 0.55) Q.face = d > 0.3 ? 'closed' : Q.face;
        else { Q.face = 'happy'; Q.emote = 'excl'; Q.emoteK = (q - 0.55) / 0.45; }
        break;
      }
      default: break;
    }
  }
  // ---------------------------------------------------------------- rendu
  // reflet balayant : bande lumineuse diagonale découpée par la silhouette (x + 0,6·y = d dans le repère du chaton)
  _shine(c, path, d, bw) {
    c.save(); c.clip(path);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.62;
    c.transform(1, 0, -0.6, 1, d, 0);
    c.drawImage(bandSprite(), -bw, -120, bw * 2, 240);
    c.restore();
  }
  _head(c, Q, bare) {
    const S = this.S, R = this.R, hs = S.head.s, nk = S.head.ry * 0.7 * hs;
    let hy = S.hy + Q.hdy + Q.duck * 20;
    if (S.idle === 'peek') hy += (1 - this.P.peek) * 3;
    c.save();
    c.translate(S.hx + Q.hdx, hy + nk); c.rotate(Q.tilt); c.translate(0, -nk);
    const kx = hs * Q.hsx, ky = hs * Q.hsy;
    if (kx !== 1 || ky !== 1) c.scale(kx, ky);
    // cas courant : un seul sprite ; sinon couches (expression, oreilles qui bougent)
    const fast = !this.b.full || (Q.face === 'open' && Math.abs(Q.ear0) < 0.004 && Math.abs(Q.ear1) < 0.004);
    const f = fast ? null : R.faces[Q.face] || R.faces.open;
    if (S.ghost && !bare) {
      // superposition quantique : double fantôme décalé
      const g = Math.sin(this.P.t * 3.1) * 6 + Math.sin(this.P.t * 11.3) * 1.5;
      c.save(); c.globalAlpha *= 0.28; c.globalCompositeOperation = 'lighter';
      for (const [dx, dy] of [[g, -1], [-g * 0.7, 1]]) { if (fast) blit(c, R.headFull, dx, dy); else { blit(c, R.skull, dx, dy); if (f) blit(c, f, dx, dy); } }
      c.restore();
    }
    if (fast) dI(c, R.headFull);
    else {
      if (R.hBack) dI(c, R.hBack);
      for (let i = 0; i < 2; i++) {
        const e = R.ears[i];
        if (!e) continue;
        const a = (i ? 1 : -1) * (i ? Q.ear1 : Q.ear0);
        if (Math.abs(a) < 0.004) dI(c, e); else blitPivot(c, e, S.earPiv[i][0], S.earPiv[i][1], a);
      }
      dI(c, R.skull);
      if (f) dI(c, f);
      if (R.hFront) dI(c, R.hFront);
    }
    if (this.shineD > -1e8 && R.clip) { const hk = hs * Q.hsx; this._shine(c, R.clip.head, (this.shineD - S.hx - Q.hdx - 0.6 * hy) / hs * Math.sign(hk), 26 / hs); }
    if (!bare) {
      if (S.fxHead) S.fxHead(c, R, this.P);
      if (this.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= clamp(this.flash) * 0.55; if (fast) dI(c, R.headFull); else { dI(c, R.skull); if (f) dI(c, f); } }
    }
    c.restore();
    if (Q.lick > 0.02 && R.lickPaw) {
      // la patte monte jusqu'à la bouche (repère tête, sans l'inversion du regard)
      const [mx, my] = S.mouthPos, ca = Math.cos(Q.tilt), sa = Math.sin(Q.tilt);
      const lx = (mx + 3.5) * hs, ly = (my + 6.5 + Q.lickY) * hs - nk + (1 - Q.lick) * 26;
      const x = S.hx + Q.hdx + lx * ca - ly * sa, y = hy + nk + lx * sa + ly * ca;
      blit(c, R.lickPaw, x, y, -0.25 + Q.tilt, hs, hs);
    }
  }
  _paint(c, Q, bare) {
    const S = this.S, R = this.R, P = this.P;
    c.save();
    c.translate(Q.px, Q.py);
    if (Q.rt) { c.translate(Q.pvx, Q.pvy); c.rotate(Q.rt); c.translate(-Q.pvx, -Q.pvy); }
    const sx = Q.sx * Q.spin;
    if (sx !== 1 || Q.sy !== 1) c.scale(sx, Q.sy);
    if (!bare && S.fxBack) S.fxBack(c, R, P);
    // ailes
    if (R.wingN) {
      const wx = S.wx, wy = S.wy, flap = Q.flap, flapS = Q.flapS;
      if (S.wings.six) {
        // séraphin : trois paires d'ailes (haut, milieu, bas)
        for (const [dy, a0, sc] of [[-8, 0.62, 0.72], [0, 0.05, 1], [8, -0.62, 0.7]]) blit(c, R.wingF, wx + 8, wy + dy - 3, a0 + 0.14 + flap * 0.9, sc, sc * flapS);
        for (const [dy, a0, sc] of [[-8, 0.62, 0.72], [0, 0.05, 1], [8, -0.62, 0.7]]) blit(c, R.wingN, wx, wy + dy, a0 + flap, sc, sc * flapS);
      } else if (S.wings.type === 'falcon') {
        // ailes d'Isis déployées des deux côtés
        blit(c, R.wingF, wx + 8, wy - 4, -0.3 - flap * 0.5, -0.95, 0.95 * flapS);
        blit(c, R.wingN, wx, wy, 0.3 + flap * 0.5, 1, flapS);
      } else {
        blit(c, R.wingF, wx + 7, wy - 3, 0.18 + flap, 0.92, 0.92 * flapS);
        blit(c, R.wingN, wx, wy, flap, 1, flapS);
      }
    }
    if (R.under) dI(c, R.under);
    const drawTail = () => {
      if (!R.tail) return;
      const n = S.tails || 1, t = P.t;
      for (let i = 0; i < n; i++) {
        const fan = n > 1 ? (S.tailFan0 || 0) + (i - (n - 1) / 2) * (S.tailFan || 0.42) : 0;
        const wob = n > 1 ? Math.sin(t * 2.4 + i * 1.3) : 0;
        const ang = fan + Q.tailA * (n > 1 ? 1 + wob * 0.6 : 1) + (n > 1 ? Math.sin(t * 2.4 + i) * 0.06 : 0);
        const bend = n > 1 ? Q.bend * 0.6 - Math.cos(t * 2.4 + i * 1.3) * 0.5 : Q.bend;
        const ti = clamp(Math.round((bend + 1) * 2), 0, 4), spr = R.tails[ti] || R.tail;
        c.save(); c.translate(S.tx, S.ty); c.rotate(ang);
        if (Q.tailS !== 1) c.scale(Q.tailS, Q.tailS);
        dI(c, spr);
        if (S.tailFx && !bare) S.tailFx(c, R, P);
        c.restore();
      }
    };
    if (!S.tailFront && !S.tailOver) drawTail();
    // pattes (posture debout) derrière le corps ; la patte avant proche se lève pour la toilette
    const sit = S.legs.length && S.legs[0].sit, lifted = Q.lick > 0.3;
    if (S.legs.length && !sit) {
      for (const L of S.legs) { if (lifted && L.front && !L.far) continue; blit(c, L.far ? R.legF : R.legN, L.x, S.hipY, (L.front ? Q.legA : Q.legB) * (L.far ? 0.8 : 1)); }
    }
    dI(c, R.body);
    if (this.shineD > -1e8 && R.clip && R.clip.body) this._shine(c, R.clip.body, this.shineD, 26);
    if (sit) for (const L of S.legs) { if (lifted && !L.far) continue; blit(c, L.far ? R.legF : R.legN, L.x, S.hipY, Q.legA * 0.25); }
    if (S.tailFront) drawTail();
    const boxed = S.pose === 'box';
    if (R.over && !boxed) dI(c, R.over);
    if (S.tailOver) drawTail();
    let pa = 0;
    if (R.paw) {
      pa = -2.25 + (P.st === 'idle' ? Math.sin(P.t * 4) * 0.22 : P.st === 'attack' ? -0.4 * Math.sin(P.k * Math.PI) : 0);
      blit(c, R.paw, S.body.x + 10, S.body.y - 6, pa);
    }
    if (!bare && S.fxMid) S.fxMid(c, R, P);
    this._head(c, Q, bare);
    if (R.over && boxed) dI(c, R.over);
    if (R.paw) {
      // patte levée du maneki-neko (elle salue) : la main passe devant la joue
      const px0 = S.body.x + 10, py0 = S.body.y - 6, L = 34;
      blit(c, R.mitt, px0 - Math.sin(pa) * L, py0 + Math.cos(pa) * L, pa + Math.PI);
    }
    if (!bare && S.fxFront) S.fxFront(c, R, P);
    c.restore();
  }
  // effets de rareté et d'élément (derrière / devant)
  _fxUnder(ctx, Q, t) {
    const S = this.S, F = this.fx;
    if (F.circle && !this.still) {
      const col = S.fxc, s = circleSprite(col, F.circle), R0 = S.shadowW + 8 + F.circle * 3, k = R0 / 44;
      const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha, x0 = Q.px * 0.3;
      ctx.globalAlpha = ga * (0.62 + Math.sin(t * 2.2) * 0.14);
      ctx.drawImage(s.c, x0 - 54 * k, -1 - 18 * k, 108 * k, 36 * k);
      // lueurs qui courent sur l'anneau
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0, n = F.run || 0; i < n; i++) { const a = t * 0.9 + (i * TAU) / n; sparkRaw(ctx, x0 + Math.cos(a) * 43 * k, -1 + Math.sin(a) * 13 * k, 4.2, this.cRun, 0.9, ga); }
      ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
    }
    if (Q.puff >= 0 && Q.puff < 0.7) {
      // petits nuages de poussière aux réceptions
      const u = Q.puff / 0.7, s = moteSprite('puff');
      blit(ctx, s, S.body.x - (S.body.rx || 14) - 4 - u * 12, -3 - u * 4, 0, 0.7 + u * 0.7, 0.7 + u * 0.7, (1 - u) * 0.85);
    }
    if (F.orbit) this._orbit(ctx, Q, t, false);
    if (F.motes && !S.noMotes) this._motes(ctx, Q, t, false);
  }
  _fxOver(ctx, Q, t) {
    const S = this.S, F = this.fx;
    if (F.orbit) this._orbit(ctx, Q, t, true);
    if (F.motes && !S.noMotes) this._motes(ctx, Q, t, true);
    const cx = Q.px, cy = Q.py + Q.hdy;
    // éclat ponctuel sur un bord (oreille, tête, dos)
    if (this.glintS >= 0 && !this.still) {
      const pts = S.glintPts, g = pts[this.glintI % pts.length], u = this.glintS / 0.55, a = Math.sin(u * Math.PI);
      if (g[2] === 2) { if (!this.P.closed && Q.hsx > 0 && Q.spin > 0) addSpark(ctx, g[0] + cx, g[1] + cy, (3 + S.r * 0.45) * a, '#ffffff', a, u * 1.5); } // « kira » dans l'œil
      else addSpark(ctx, g[0] + cx * (g[2] ? 1 : 0.8), g[1] + (g[2] ? cy : Q.py), (4 + S.r * 0.7) * a, this.cGlint, a, u * 1.2);
    }
    // gerbe d'étincelles (scène « sparkle », victoire)
    if (Q.burst >= 0) {
      const q = Q.burst, n = 8, r = 12 + q * 44, x0 = S.body.x + 4, y0 = (S.hy + S.body.y) * 0.5 + Q.py;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + q * 1.5;
        addSpark(ctx, x0 + Math.cos(a) * r, y0 + Math.sin(a) * r * 0.7, (5 + S.r * 0.4) * (1 - q), i % 2 ? '#ffffff' : (S.r >= 8 ? RAINBOW[i % 5] : S.fxc), 1 - q * q, q * 3);
      }
    }
    // impact de la griffe
    if (Q.hit >= 0) {
      const a = Math.sin(Q.hit * Math.PI), x = S.hx + S.face.x + 24 + Q.px, y = S.hy + 16 + Q.py;
      addGlow(ctx, x, y, 16 * a, S.fxc, 0.6 * a);
      addSpark(ctx, x, y, 11 * a, '#ffffff', a, Q.hit * 2);
    }
    // émoticône (cœur, note, goutte…)
    if (Q.emote) {
      const e = Q.emoteK, a = clamp(e / 0.15) * clamp((1 - e) / 0.3);
      if (a > 0.01) {
        const hs = S.head.s, x = S.hx + 20 * hs + Q.px + Math.sin(e * 9) * 2, y = S.hy - S.head.ry * hs - 6 + Q.py + Q.hdy - e * 14;
        blit(ctx, emoteSprite(Q.emote), x, y, Math.sin(e * 7) * 0.15, 0.8 + a * 0.25, 0.8 + a * 0.25, a);
      }
    }
  }
  _orbit(ctx, Q, t, front) {
    const S = this.S, n = this.fx.orbit, r = S.r;
    const cx = S.body.x + 2, cy = (S.hy + S.body.y) * 0.5 + Q.py * 0.6, rx = 34 + r * 2.6, ry = 8 + r * 0.7;
    const ga = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const a = t * (0.9 + r * 0.05) + (i * TAU) / n, s = Math.sin(a);
      if ((s > 0) !== front) continue;
      const x = cx + Math.cos(a) * rx, y = cy + s * ry + Math.sin(t * 1.7 + i * 2) * 5 - 6;
      const tw = 0.75 + 0.25 * Math.sin(t * 6 + i * 1.9), k = front ? 1 : 0.72;
      const col = r >= 8 ? RAINBOW[(i + ((t * 0.8) | 0)) % RAINBOW.length] : r === 4 && i % 2 ? GOLD : S.fxc;
      const g = gemStar(col), R = (3.2 + r * 0.36) * tw * k;
      ctx.globalAlpha = ga * (front ? 1 : 0.75);
      ctx.drawImage(g.c, x - R, y - R, R * 2, R * 2);
    }
    ctx.globalAlpha = ga;
  }
  _motes(ctx, Q, t, front) {
    const S = this.S, n = this.fx.motes, el = S.el, x0 = S.body.x - 34, w = 76;
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    const add = el !== 'water' && el !== 'nature';
    if (add) ctx.globalCompositeOperation = 'lighter';
    for (let i = front ? 0 : 1; i < n; i += 2) {
      const h = (i * 0.618 + 0.13) % 1;
      if (el === 'fire' || el === 'light' || el === 'shadow' || el === 'water') {
        // particules qui montent (braises, poussière d'or, volutes, bulles)
        const u = (t * 0.32 + i / n) % 1, x = x0 + h * w + Math.sin(t * 2 + i * 2.1) * 4, y = -6 - u * 78, a = Math.sin(u * Math.PI);
        if (el === 'fire') sparkRaw(ctx, x, y, 2.8 * (1 - u) + 0.8, '#ffb03a', a, ga);
        else if (el === 'light') sparkRaw(ctx, x, y, 3.4 * a, '#fff2a0', a, ga);
        else if (el === 'shadow') sparkRaw(ctx, x, y, 4.2 * a + 1, '#c98bff', a, ga);
        else { const m = moteSprite('bubble'), k = 0.6 + u * 0.6; ctx.globalAlpha = ga * a; ctx.drawImage(m.c, x + m.x0 * k, y + m.y0 * k, m.w * k, m.h * k); }
      } else if (el === 'ice' || el === 'nature') {
        // flocons et feuilles qui tombent en virevoltant
        const u = (t * 0.22 + i / n) % 1, x = x0 + h * w + Math.sin(t * 1.4 + i * 2.1) * 7, y = -96 + u * 90, a = Math.sin(u * Math.PI);
        if (el === 'ice') { ctx.globalCompositeOperation = 'lighter'; sparkRaw(ctx, x, y, 3.2 * a, '#bff4ff', a, ga); ctx.globalCompositeOperation = op; }
        else { const m = moteSprite(i % 3 === 1 ? 'petal' : 'leaf'), kx = 0.9 * Math.cos(t * 3 + i); ctx.globalAlpha = ga * a; ctx.drawImage(m.c, x + m.x0 * kx, y + m.y0 * 0.9, m.w * kx, m.h * 0.9); }
      } else if (el === 'thunder') {
        // petits éclairs qui crépitent
        const k = Math.floor(t * 7 + i * 3.7), r = seeded(k * 31 + i * 7 + 1);
        if (r() < 0.55) { const m = moteSprite('bolt'); ctx.globalAlpha = ga * 0.9; ctx.drawImage(m.c, x0 + r() * w + m.x0, -12 - r() * 70 + m.y0, m.w, m.h); }
      } else {
        // étoiles qui scintillent (cosmos)
        const r = seeded(i * 17 + 5), x = x0 + r() * w, y = -10 - r() * 84, v = Math.sin(t * 2.6 + i * 2.3);
        if (v > 0) sparkRaw(ctx, x, y, 3.8 * v, i % 2 ? '#ff9be8' : '#9fe8ff', v, ga);
      }
    }
    ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
  }
  draw(ctx, x, y, scale = 1, facing = 1, anim = {}) {
    const S = this.S, P = this.P;
    const st = anim.state || 'idle', k = clamp(anim.k || 0), t = this.t + this.phase;
    this.lastSt = st === 'cast' ? 'attack' : st;
    P.t = t; P.st = st === 'victory' ? 'idle' : st; P.k = k; P.run = st === 'run';
    const Q = this._pose(st, k);
    P.closed = !(Q.face === 'open' || Q.face === 'shout' || Q.face === 'half');
    this.flash = anim.flash || 0;
    ctx.save();
    ctx.translate(x, y);
    // ombre au sol (douce)
    if (!anim.noShadow) {
      const lift = this.floaty ? 0.75 : 1, w = S.shadowW * scale * Q.sh * lift;
      const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (this.floaty ? 0.62 : 0.85);
      ctx.drawImage(shadowSprite().c, -w * 1.18, -w * 0.3, w * 2.36, w * 0.6);
      ctx.globalAlpha = ga;
    }
    ctx.scale(scale * facing, scale);
    const bare = !!anim._bare; // interne : silhouette seule (cadrage des images d'interface)
    if (!bare) this._fxUnder(ctx, Q, t);
    this.shineD = this.sweepS >= 0 && !this.still ? lerp(-150, 95, ease(this.sweepS / 0.8)) : -1e9;
    this._paint(ctx, Q, bare);
    if (!bare) this._fxOver(ctx, Q, t);
    // flash d'impact (additif)
    if (this.flash > 0) addGlow(ctx, S.body.x + 6, (S.hy + S.body.y) / 2, this.height * 0.62, anim.flashColor || '#ffffff', clamp(this.flash) * 0.85);
    ctx.restore();
  }
}

// =====================================================================
//  Images pour l'interface (cache)
// =====================================================================
const URLS = new Map();
function stillRig(id) {
  const rig = new KittenRig(id, { transient: true });
  rig.t = 0.35 - rig.phase; rig.still = true;
  return rig;
}
// Buste (tête + haut du corps), centré sur la tête
export function kittenPortraitURL(id, size = 96) {
  const key = 'p' + id + ':' + size;
  if (URLS.has(key)) return URLS.get(key);
  const rig = stillRig(id), S = rig.S, hd = rig.R.head, hs = S.head.s;
  const x0 = S.hx + hd.x0 * hs - 3, x1 = S.hx + (hd.x0 + hd.w) * hs + 3;
  const y0 = S.hy + hd.y0 * hs - 6, y1 = S.hy + (S.head.ry + 14) * hs;
  const m = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const res = Math.max(1.6, size / m * 1.2);
  const s = makeSprite(cx - m / 2, cy - m / 2, m, m, (c) => rig.draw(c, 0, 0, 1, 1, { state: 'idle', noShadow: true }), res);
  const url = spriteURL(s, size, 0.04);
  URLS.set(key, url);
  return url;
}
// Corps entier (pose de repos). Cadré sur la silhouette (sans les effets) pour que les raretés hautes
// ne paraissent pas plus petites à cause de leurs auras ; les effets débordants s'estompent aux bords.
export function kittenFullURL(id, size = 120) {
  const key = 'f' + id + ':' + size;
  if (URLS.has(key)) return URLS.get(key);
  const rig = stillRig(id);
  const core = makeSprite(-100, -150, 200, 160, (c) => rig.draw(c, 0, 0, 1, 1, { state: 'idle', noShadow: true, _bare: true }), 0.75);
  const b = opaqueBounds(core.c), k = 1 / 0.75;
  const w = b.w * k, h = b.h * k + 5, x0 = -100 + b.x * k, y0 = -150 + b.y * k;
  const side = Math.max(w, h) * 1.1 + 6, cx = x0 + w / 2, cy = y0 + h / 2;
  const res = size / side;
  const s = makeSprite(cx - side / 2, cy - side / 2, side, side, (c) => rig.draw(c, 0, 0, 1, 1, { state: 'idle' }), res);
  const c = s.c.getContext('2d'), W = s.c.width, H = s.c.height;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in';
  for (const [x1, y1] of [[W, 0], [0, H]]) {
    const g = c.createLinearGradient(0, 0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.05, 'rgba(0,0,0,1)'); g.addColorStop(0.95, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const url = s.c.toDataURL('image/png');
  URLS.set(key, url);
  return url;
}
