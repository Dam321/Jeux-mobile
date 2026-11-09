// =====================================================================
//  Décors de combat en parallaxe (Canvas 2D, vue de côté).
//  Tout est pré-rendu UNE fois dans buildScenery() :
//   - sky    : toile 480×360 unités (ajustée à la largeur de la scène)
//   - layers : bandes horizontales raccordables (tileW unités de large),
//              du plus lointain au plus proche ; `front` = devant les persos.
//  drawScenery / drawSceneryFront ne font que des drawImage.
// =====================================================================
import { OUT, VH, shade, mix, rgba, seeded, ell, rr, smooth, poly, paint, vgrad, ball, gloss, glow } from './draw.js';

export const BIOME_IDS = ['garden', 'autumn', 'beach', 'snow', 'neon', 'volcano', 'cosmos', 'roofs', 'arena'];

const TAU = Math.PI * 2;
const TILE = 900; // largeur d'une bande (unités)
const SKY_W = 480;
const mod = (a, n) => ((a % n) + n) % n;
const lerp = (a, b, t) => a + (b - a) * t;
const FONT = '"Lilita One", "Baloo 2", "Arial Black", sans-serif';

// =====================================================================
//  Outils
// =====================================================================
function mkCanvas(wu, hu, res) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(wu * res));
  c.height = Math.max(1, Math.round(hu * res));
  return c;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Boîte à outils aléatoire + répétition aux bords pour le raccord.
function makeS(W, seed, res) {
  const rand = seeded(seed);
  const S = {
    W, res, rand,
    r: (a, b) => a + (b - a) * rand(),
    ri: (a, b) => Math.min(b, Math.floor(a + (b - a + 1) * rand())),
    pick: (arr) => arr[Math.floor(rand() * arr.length) % arr.length],
    // Dessine fn(x, rnd) en x, et aussi en x±W si l'élément (demi-largeur rad) déborde.
    // rnd est un générateur identique pour chaque copie.
    rep(x, rad, fn) {
      const s = ((rand() * 4294967295) >>> 0) || 7;
      for (let k = -1; k <= 1; k++) {
        const xx = x + k * W;
        if (xx + rad > 0 && xx - rad < W) fn(xx, seeded(s));
      }
    },
    // n positions réparties sur la bande, avec un peu de désordre
    spread(n, jit = 0.6) {
      const out = [], st = W / n, o = rand() * st;
      for (let i = 0; i < n; i++) out.push(mod(o + i * st + (rand() - 0.5) * jit * st, W));
      return out;
    },
  };
  return S;
}

// Profil périodique (somme de sinus de fréquences entières => raccord parfait)
function wave(S, base, terms) {
  const t = terms.map(([a, n0, n1]) => [a, S.ri(n0, n1), S.r(0, TAU)]);
  const W = S.W;
  return (x) => {
    let y = base;
    for (let i = 0; i < t.length; i++) y += t[i][0] * Math.sin(TAU * t[i][1] * x / W + t[i][2]);
    return y;
  };
}
function profilePath(ctx, W, f, yBot, step = 3) {
  ctx.beginPath();
  ctx.moveTo(-step * 2, yBot);
  for (let x = -step * 2; x <= W + step * 2; x += step) ctx.lineTo(x, f(x));
  ctx.lineTo(W + step * 2, yBot);
  ctx.closePath();
}
function profileLine(ctx, W, f, step = 3) {
  ctx.beginPath();
  ctx.moveTo(-step * 2, f(-step * 2));
  for (let x = -step; x <= W + step * 2; x += step) ctx.lineTo(x, f(x));
}
function bandPath(ctx, W, fa, fb, step = 3) {
  ctx.beginPath();
  ctx.moveTo(-step * 2, fa(-step * 2));
  for (let x = -step; x <= W + step * 2; x += step) ctx.lineTo(x, fa(x));
  for (let x = W + step * 2; x >= -step * 2; x -= step) ctx.lineTo(x, fb(x));
  ctx.closePath();
}
// Bord dentelé périodique : 'grass' (brins), 'bump' (festons), 'rock' (rochers), 'flat'
function makeEdge(S, f, step, hMin, hMax, kind = 'grass') {
  const N = Math.max(1, Math.round(S.W / step));
  step = S.W / N;
  const H = [], J = [], B = [];
  for (let i = 0; i < N; i++) { H.push(S.r(hMin, hMax)); J.push(S.r(-0.25, 0.25)); B.push(S.rand() < 0.42); }
  return (ctx, cont = false) => {
    const xs = -2 * step;
    if (cont) ctx.lineTo(xs, f(xs)); else ctx.moveTo(xs, f(xs));
    for (let i = -2; i <= N + 1; i++) {
      const k = mod(i, N), xa = i * step, xb = xa + step, h = H[k];
      const tx = xa + step * (0.5 + J[k]);
      if (kind === 'grass') {
        if (B[k]) { // petite touffe de 2 brins
          const x1 = xa + step * (0.3 + J[k] * 0.3), x2 = xa + step * 0.5, x3 = xa + step * (0.72 + J[k] * 0.2);
          ctx.quadraticCurveTo(xa + step * 0.2, f(x1) - h * 0.35, x1 - step * 0.05, f(x1) - h);
          ctx.quadraticCurveTo(x1 + step * 0.05, f(x2) - h * 0.45, x2, f(x2) - h * 0.3);
          ctx.quadraticCurveTo(x3 - step * 0.04, f(x3) - h * 0.45, x3 + step * 0.07, f(x3) - h * 0.8);
          ctx.quadraticCurveTo(x3 + step * 0.08, f(xb) - h * 0.25, xb, f(xb));
        } else ctx.quadraticCurveTo(tx, f(tx) - h * 0.5, xb, f(xb));
      } else if (kind === 'bump') {
        ctx.quadraticCurveTo(tx, f(tx) - h * 2, xb, f(xb));
      } else if (kind === 'rock') {
        ctx.lineTo(xa + step * 0.18, f(xa) - h * 0.75);
        ctx.lineTo(tx, f(tx) - h);
        ctx.lineTo(xb - step * 0.16, f(xb) - h * 0.55);
        ctx.lineTo(xb, f(xb));
      } else ctx.lineTo(xb, f(xb));
    }
  };
}
function closeDown(ctx, W, yBot = 364) { ctx.lineTo(W + 60, yBot); ctx.lineTo(-60, yBot); ctx.closePath(); }

// Dégradé vertical à arrêts absolus [[y, couleur], ...]
function lgY(ctx, stops) {
  const ya = stops[0][0], yb = stops[stops.length - 1][0];
  const g = ctx.createLinearGradient(0, ya, 0, yb === ya ? ya + 1 : yb);
  for (const [y, c] of stops) g.addColorStop(Math.max(0, Math.min(1, (y - ya) / ((yb - ya) || 1))), c);
  return g;
}
function skyGrad(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SKY_W, VH);
}
// Voile atmosphérique : teinte uniquement les pixels déjà dessinés.
function haze(ctx, W, y0, y1, col, a0, a1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = lgY(ctx, [[y0, rgba(col, a0)], [y1, rgba(col, a1)]]);
  ctx.fillRect(-10, y0, W + 20, y1 - y0);
  ctx.restore();
}
function addCircle(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
function addEll(ctx, x, y, rx, ry, rot = 0) {
  ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function strokeLine(ctx, col, lw) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
// Lueur néon : trait coloré flouté + cœur clair (shadowBlur est en pixels => × res)
function neonStroke(ctx, S, col, lw, core = '#ffffff') {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = col; ctx.shadowBlur = 9 * S.res;
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = lw * 2;
  ctx.stroke();
  ctx.shadowBlur = 4 * S.res;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = mix(col, core, 0.65); ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  ctx.restore();
}
function sparkle(ctx, x, y, s, col, a = 1) {
  ctx.fillStyle = rgba(col, a);
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

// =====================================================================
//  Primitives « cartoon »
// =====================================================================
// Union de cercles avec contour extérieur, ombre propre en bas à droite, reflets.
function blob(ctx, cs, base, o = {}) {
  const lw = o.lw ?? 2;
  let top = Infinity, bot = -Infinity;
  for (const c of cs) { top = Math.min(top, c[1] - c[2]); bot = Math.max(bot, c[1] + c[2]); }
  if (o.flat != null) bot = Math.min(bot, o.flat);
  ctx.save();
  if (o.flat != null) { ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, o.flat + 1e4); ctx.clip(); }
  ctx.beginPath();
  for (const c of cs) addCircle(ctx, c[0], c[1], c[2]);
  if (lw > 0) { ctx.lineWidth = lw * 2; ctx.strokeStyle = o.stroke || OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = o.dark || shade(base, -0.24);
  ctx.fill();
  ctx.clip();
  const sh = o.shift ?? 0.16;
  ctx.beginPath();
  for (const [x, y, r] of cs) addCircle(ctx, x - r * sh * 0.5, y - r * sh, r * (1 - sh * 0.12));
  ctx.fillStyle = o.fill || vgrad(ctx, top, bot, base, o.light ?? 0.2, 0.04);
  ctx.fill();
  if (o.hl !== false) {
    ctx.fillStyle = rgba(o.hlc || '#ffffff', o.hla ?? 0.28);
    ctx.beginPath();
    for (const [x, y, r] of cs) if (y - r < top + (bot - top) * 0.38 && r > 3) addEll(ctx, x - r * 0.28, y - r * 0.52, r * 0.34, r * 0.16, -0.35);
    ctx.fill();
  }
  if (o.extra) o.extra(top, bot);
  ctx.restore();
}

function sunDisc(ctx, x, y, r, o = {}) {
  const core = o.core || '#fffef2', edge = o.edge || '#ffd64a', gl = o.glow || '#fff3b0';
  glow(ctx, x, y, r * (o.glowR || 6), gl, o.glowA ?? 0.6);
  if (o.rays !== false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot ?? 0.12);
    const g = ctx.createRadialGradient(0, 0, r, 0, 0, r * 4.6);
    g.addColorStop(0, rgba('#ffffff', o.rayA ?? 0.34));
    g.addColorStop(1, rgba('#ffffff', 0));
    ctx.fillStyle = g;
    const n = o.nRays || 14;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = i * TAU / n, a1 = a0 + TAU / n * 0.42;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 4.6, a0, a1);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.fillStyle = rgba(gl, 0.5); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, core); g.addColorStop(0.65, mix(core, edge, 0.55)); g.addColorStop(1, edge);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
}

function cloud(ctx, x, y, w, h, rnd, col = '#ffffff', dark = '#cfe3fa', under = null) {
  const cs = [];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = h * (0.36 + 0.36 * Math.sin(Math.PI * t)) * (0.85 + rnd() * 0.3);
    cs.push([x - w / 2 + w * t + (rnd() - 0.5) * w * 0.08, y - r * 0.5, r]);
  }
  cs.push([x - w * 0.5 + h * 0.22, y - h * 0.2, h * 0.26], [x + w * 0.5 - h * 0.22, y - h * 0.18, h * 0.24]);
  blob(ctx, cs, col, {
    lw: 0, dark, flat: y, shift: 0.2, hl: false,
    fill: lgY(ctx, [[y - h * 1.1, col], [y, under || mix(col, dark, 0.35)]]),
  });
}
function cloudBand(ctx, S, n, yMin, yMax, col, dark, wMin = 70, wMax = 135) {
  for (const x of S.spread(n, 0.7)) {
    const y = S.r(yMin, yMax), k = 1 - (y - yMin) / (yMax - yMin + 1) * 0.35;
    const w = S.r(wMin, wMax) * k, h = w * S.r(0.32, 0.42);
    S.rep(x, w, (xx, rnd) => cloud(ctx, xx, y, w, h, rnd, col, dark));
  }
}

function tuft(ctx, x, y, s, col, rnd, o = {}) {
  const n = o.n || 3 + Math.floor(rnd() * 3);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const lean = t * 1.1 + (rnd() - 0.5) * 0.3;
    const h = s * (7 + rnd() * 5) * (1 - Math.abs(t) * 0.45) * (o.tall || 1);
    const bw = o.bw || 1.4;
    const bx = x + t * s * 5, tipx = bx + lean * h * 0.6, tipy = y - h;
    ctx.moveTo(bx - s * bw, y);
    ctx.quadraticCurveTo(bx - s * bw * 0.3 + lean * h * 0.15, y - h * 0.55, tipx, tipy);
    ctx.quadraticCurveTo(bx + s * bw * 0.35 + lean * h * 0.22, y - h * 0.45, bx + s * bw, y);
  }
  if (o.lw) { ctx.lineWidth = o.lw * 2; ctx.strokeStyle = o.stroke || OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = o.fill || col;
  ctx.fill();
}

function flower(ctx, x, y, r, petal, center = '#ffd23f', lw = 0) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * TAU / 5;
    addCircle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.82);
  }
  if (lw) { ctx.lineWidth = lw * 2; ctx.strokeStyle = OUT; ctx.stroke(); }
  ctx.fillStyle = petal; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU);
  ctx.fillStyle = center; ctx.fill();
  if (lw) { ctx.lineWidth = lw * 0.7; ctx.strokeStyle = rgba(OUT, 0.6); ctx.stroke(); }
}
// Fleur sur tige (premier plan)
function stemFlower(ctx, x, y, h, rnd, petal, center, lw = 2) {
  const bend = (rnd() - 0.5) * h * 0.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + bend * 0.2, y - h * 0.5, x + bend, y - h);
  strokeLine(ctx, OUT, 4.2);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + bend * 0.2, y - h * 0.5, x + bend, y - h);
  strokeLine(ctx, '#3f9a3a', 2);
  ell(ctx, x + bend * 0.2 + 4, y - h * 0.42, 4.5, 2, -0.5);
  paint(ctx, '#58b84a', 1.4);
  flower(ctx, x + bend, y - h, 3.6, petal, center, lw * 0.7);
}

function leafShape(ctx, x, y, s, rot, col, lw = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(0, -s * 0.75, s, 0);
  ctx.quadraticCurveTo(0, s * 0.75, -s, 0);
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); }
  ctx.fillStyle = col;
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.7, 0);
  strokeLine(ctx, shade(col, -0.25), Math.max(0.5, s * 0.12));
  ctx.restore();
}

function rock(ctx, x, gy, w, h, rnd, col, o = {}) {
  const pts = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const rx = w / 2 * (0.88 + rnd() * 0.18), ry = h * (0.78 + rnd() * 0.3);
    pts.push([x + Math.cos(a) * rx, gy + Math.sin(a) * ry * (i === 0 || i === n - 1 ? 0.15 : 1)]);
  }
  pts.push([x + w * 0.42, gy + h * 0.18], [x - w * 0.42, gy + h * 0.18]);
  const lw = o.lw ?? 2;
  smooth(ctx, pts, true, 0.55);
  ctx.save();
  paint(ctx, o.fill || vgrad(ctx, gy - h, gy + h * 0.2, col, 0.22, 0.28), lw, o.stroke || OUT);
  smooth(ctx, pts, true, 0.55);
  ctx.clip();
  // facette claire
  ell(ctx, x - w * 0.18, gy - h * 0.62, w * 0.24, h * 0.18, -0.3);
  ctx.fillStyle = rgba('#ffffff', o.hla ?? 0.28); ctx.fill();
  if (o.cap) { // neige / mousse sur le dessus
    ctx.beginPath();
    ctx.moveTo(x - w, gy - h * 2);
    ctx.lineTo(x - w, gy - h * 0.55);
    for (let i = 0; i <= 5; i++) {
      const xx = x - w * 0.6 + i * w * 0.24;
      ctx.quadraticCurveTo(xx - w * 0.12, gy - h * (0.38 + rnd() * 0.18), xx, gy - h * 0.6);
    }
    ctx.lineTo(x + w, gy - h * 2);
    ctx.closePath();
    ctx.fillStyle = o.cap; ctx.fill();
  }
  if (o.cracks) { // fissures de lave
    ctx.beginPath();
    let cx = x - w * 0.15, cy = gy - h * 0.7;
    ctx.moveTo(cx, cy);
    for (let i = 0; i < 4; i++) { cx += (rnd() - 0.3) * w * 0.18; cy += h * 0.22; ctx.lineTo(cx, cy); }
    ctx.moveTo(x - w * 0.08, gy - h * 0.35); ctx.lineTo(x + w * 0.18, gy - h * 0.28); ctx.lineTo(x + w * 0.24, gy - h * 0.05);
    ctx.save(); ctx.shadowColor = o.cracks; ctx.shadowBlur = 6 * (o.res || 2);
    strokeLine(ctx, o.cracks, 2.2); ctx.restore();
    strokeLine(ctx, '#fff2a8', 0.9);
  }
  ctx.restore();
}

function roundTree(ctx, x, gy, s, rnd, leaf, o = {}) {
  const lw = o.lw ?? 2, trunk = o.trunk || '#9a6238';
  const th = (o.th || (30 + rnd() * 18)) * s, tw = 6.5 * s, R = (25 + rnd() * 7) * s * (o.rk || 1);
  const cy = gy - th - R * 0.5;
  ctx.beginPath();
  ctx.moveTo(x - tw * 1.35, gy + 3);
  ctx.quadraticCurveTo(x - tw * 0.5, gy - th * 0.35, x - tw * 0.55, cy + R * 0.2);
  ctx.lineTo(x + tw * 0.55, cy + R * 0.2);
  ctx.quadraticCurveTo(x + tw * 0.5, gy - th * 0.35, x + tw * 1.35, gy + 3);
  ctx.closePath();
  const tg = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
  tg.addColorStop(0, shade(trunk, 0.18)); tg.addColorStop(0.55, trunk); tg.addColorStop(1, shade(trunk, -0.3));
  paint(ctx, tg, lw);
  // petite branche
  ctx.beginPath();
  ctx.moveTo(x + tw * 0.3, cy + R * 0.75);
  ctx.quadraticCurveTo(x + R * 0.3, cy + R * 0.7, x + R * 0.55, cy + R * 0.35);
  strokeLine(ctx, OUT, 4.5 * s + lw);
  ctx.beginPath();
  ctx.moveTo(x + tw * 0.3, cy + R * 0.75);
  ctx.quadraticCurveTo(x + R * 0.3, cy + R * 0.7, x + R * 0.55, cy + R * 0.35);
  strokeLine(ctx, shade(trunk, -0.1), 4.5 * s - lw * 0.2);
  const cs = [[x, cy, R]];
  const n = 5 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.0 + i / (n - 1)) + (rnd() - 0.5) * 0.25;
    cs.push([x + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.6 + R * 0.08, R * (0.48 + rnd() * 0.16)]);
  }
  cs.push([x - R * 0.66, cy + R * 0.42, R * 0.5], [x + R * 0.62, cy + R * 0.4, R * 0.52], [x, cy + R * 0.5, R * 0.5]);
  const marks = shade(leaf, -0.2);
  blob(ctx, cs, leaf, {
    lw, light: 0.22, hla: 0.3,
    extra: () => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rnd() * TAU, d = rnd() * R * 0.75;
        const mx = x + Math.cos(a) * d, my = cy + Math.sin(a) * d * 0.8 + R * 0.1;
        ctx.moveTo(mx - 3.5 * s, my);
        ctx.quadraticCurveTo(mx, my + 3.5 * s, mx + 3.5 * s, my);
      }
      strokeLine(ctx, marks, 1.4);
    },
  });
  if (o.dots) {
    for (let i = 0; i < o.dots.n; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.95;
      const dx = x + Math.cos(a) * d, dy = cy + Math.sin(a) * d * 0.75 + R * 0.05;
      if (o.dots.flower) flower(ctx, dx, dy, 2.2 * s, o.dots.col, '#fff2a0', 0);
      else {
        ctx.beginPath(); ctx.arc(dx, dy, 3.2 * s, 0, TAU);
        paint(ctx, ball(ctx, dx, dy, 3.2 * s, o.dots.col), 1.3);
        gloss(ctx, dx - 1 * s, dy - 1.2 * s, 1 * s, 0.6 * s, 0.8);
      }
    }
  }
  return { cy, R };
}

function bush(ctx, x, gy, s, rnd, col, o = {}) {
  const n = 3 + Math.floor(rnd() * 3), w = (12 + n * 7) * s;
  const cs = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = (8 + rnd() * 5) * s * (1 - Math.abs(t - 0.5) * 0.55);
    cs.push([x - w / 2 + w * t, gy - r * 0.7, r]);
  }
  cs.push([x + (rnd() - 0.5) * w * 0.3, gy - 13 * s, 11 * s]);
  blob(ctx, cs, col, { lw: o.lw ?? 2, flat: gy + 1, light: 0.22 });
  if (o.flowers) {
    for (let i = 0; i < o.flowers; i++) {
      const c = cs[Math.floor(rnd() * cs.length)];
      const a = Math.PI * (1.15 + rnd() * 0.7);
      flower(ctx, c[0] + Math.cos(a) * c[2] * 0.6, c[1] + Math.sin(a) * c[2] * 0.6, 2 * s, o.fcol || '#ffffff', '#ffd23f', 0);
    }
  }
}

function fence(ctx, x0, x1, f, wood, lw = 2) {
  const n = Math.max(2, Math.round((x1 - x0) / 24));
  const H = 30;
  for (const hr of [11, 22]) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; i ? ctx.lineTo(x, f(x) - hr - 2.6) : ctx.moveTo(x, f(x) - hr - 2.6); }
    for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n; ctx.lineTo(x, f(x) - hr + 2.6); }
    ctx.closePath();
    paint(ctx, shade(wood, -0.08), lw);
  }
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, b = f(x) + 6;
    poly(ctx, [[x - 3.6, b], [x - 3.6, b - H], [x, b - H - 4.5], [x + 3.6, b - H], [x + 3.6, b]]);
    paint(ctx, vgrad(ctx, b - H, b, wood, 0.2, 0.2), lw);
    ctx.beginPath(); ctx.moveTo(x - 1.6, b - H + 2); ctx.lineTo(x - 1.6, b - 4);
    strokeLine(ctx, rgba('#ffffff', 0.35), 1.2);
  }
}

function pumpkin(ctx, x, gy, s, rnd, col = '#ff8a1e', lw = 2) {
  const w = 13 * s, h = 10.5 * s, cy = gy - h;
  const ribs = [[-0.62, 0.62], [0.62, 0.62], [-0.3, 0.8], [0.3, 0.8], [0, 0.85]];
  for (const [dx, k] of ribs) {
    ell(ctx, x + dx * w, cy, w * k * 0.62, h, 0);
    paint(ctx, ball(ctx, x + dx * w, cy, w * 0.7, col, 0.3, 0.25), lw);
  }
  ctx.beginPath();
  ctx.moveTo(x - 1.5 * s, cy - h + 1);
  ctx.quadraticCurveTo(x - 1 * s, cy - h - 5 * s, x + 3 * s, cy - h - 6 * s);
  ctx.lineTo(x + 3.5 * s, cy - h - 3.8 * s);
  ctx.quadraticCurveTo(x + 1.5 * s, cy - h - 3 * s, x + 1.8 * s, cy - h + 1);
  ctx.closePath();
  paint(ctx, '#6a8a2a', lw * 0.8);
  leafShape(ctx, x - 5 * s, cy - h - 1.5 * s, 4 * s, -0.4, '#6bb33a', lw * 0.6);
  gloss(ctx, x - w * 0.45, cy - h * 0.45, w * 0.16, h * 0.18, 0.45, -0.3);
}

function birch(ctx, x, gy, s, rnd, leaf, lw = 2) {
  const th = (70 + rnd() * 20) * s, tw = 4.2 * s;
  rr(ctx, x - tw, gy - th, tw * 2, th + 4, tw * 0.8);
  paint(ctx, vgrad(ctx, gy - th, gy, '#f6efe4', 0.1, 0.1), lw);
  ctx.save();
  rr(ctx, x - tw, gy - th, tw * 2, th + 4, tw * 0.8);
  ctx.clip();
  ctx.fillStyle = '#3d2c3a';
  for (let y = gy - th + 8; y < gy; y += 7 + rnd() * 9) {
    const side = rnd() < 0.5 ? -1 : 1;
    ctx.fillRect(x + (side < 0 ? -tw : tw * 0.1), y, tw * (0.6 + rnd() * 0.4), 1.6 * s);
  }
  ctx.restore();
  const R = 17 * s, cy = gy - th - 6 * s;
  const cs = [[x, cy, R], [x - R * 0.7, cy + R * 0.45, R * 0.62], [x + R * 0.7, cy + R * 0.4, R * 0.6], [x, cy - R * 0.65, R * 0.6], [x - R * 0.2, cy + R * 0.85, R * 0.5]];
  blob(ctx, cs, leaf, { lw, light: 0.25 });
}

function palm(ctx, x, gy, s, rnd, lean, o = {}) {
  const lw = o.lw ?? 2;
  const H = (100 + rnd() * 20) * s;
  const tx = x + lean * s, ty = gy - H;
  const cx = x - lean * 0.15 * s, cy = gy - H * 0.55;
  const P = (t) => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * tx, (1 - t) * (1 - t) * gy + 2 * (1 - t) * t * cy + t * t * ty];
  const L = [], Rr = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = P(t), q = P(Math.min(1, t + 0.02)), p0 = P(Math.max(0, t - 0.02));
    let dx = q[0] - p0[0], dy = q[1] - p0[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = lerp(7.5, 4.2, t) * s;
    L.push([p[0] - dy * -w, p[1] + dx * -w]);
    Rr.push([p[0] + dy * -w, p[1] - dx * -w]);
  }
  const pts = L.concat(Rr.reverse());
  poly(ctx, pts);
  const tg = ctx.createLinearGradient(x - 10 * s, 0, x + 10 * s + lean * s, 0);
  tg.addColorStop(0, '#d9a066'); tg.addColorStop(1, '#9a6234');
  paint(ctx, tg, lw);
  ctx.beginPath();
  for (let i = 1; i < N; i++) {
    const t = i / N, a = L[i], b = Rr[Rr.length - 1 - i];
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2.2 * s, b[0], b[1]);
  }
  strokeLine(ctx, rgba('#6a3a1a', 0.55), 1.3);
  // palmes
  const fronds = o.fronds || 7;
  const greens = ['#4fbf4a', '#3fae45', '#5fd055'];
  const angs = [];
  for (let i = 0; i < fronds; i++) angs.push(-Math.PI + (i + 0.5) / fronds * Math.PI + (rnd() - 0.5) * 0.25);
  angs.sort((a, b) => Math.abs(b + Math.PI / 2) - Math.abs(a + Math.PI / 2)); // les plus horizontales d'abord
  for (const a of angs) {
    const len = (46 + rnd() * 14) * s;
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.5 + len * 0.42;
    const mx = tx + Math.cos(a) * len * 0.55, my = ty + Math.sin(a) * len * 0.55 - 13 * s;
    const Q = (t) => [(1 - t) * (1 - t) * tx + 2 * (1 - t) * t * mx + t * t * ex, (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * my + t * t * ey];
    const D = (t) => { const dx = 2 * (1 - t) * (mx - tx) + 2 * t * (ex - mx), dy = 2 * (1 - t) * (my - ty) + 2 * t * (ey - my), d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
    // folioles de part et d'autre de la nervure (une seule silhouette contourée)
    ctx.beginPath();
    for (let t = 0.1; t <= 0.97; t += 0.07) {
      const [px, py] = Q(t), [dx, dy] = D(t), nx = -dy, ny = dx;
      const ll = (4 + 11 * Math.sin(Math.PI * Math.min(1, t * 1.05))) * s;
      for (const side of [-1, 1]) {
        const tipx = px + nx * side * ll + dx * ll * 0.6, tipy = py + ny * side * ll + dy * ll * 0.6 + ll * 0.35;
        ctx.moveTo(px - dx * 2.6 * s, py - dy * 2.6 * s);
        ctx.quadraticCurveTo(px + nx * side * ll * 0.5 - dx * 1.5 * s, py + ny * side * ll * 0.5 - dy * 1.5 * s + ll * 0.05, tipx, tipy);
        ctx.quadraticCurveTo(px + nx * side * ll * 0.35 + dx * 3 * s, py + ny * side * ll * 0.35 + dy * 3 * s, px + dx * 2.6 * s, py + dy * 2.6 * s);
        ctx.closePath();
      }
    }
    ctx.moveTo(tx, ty - 1.5 * s);
    ctx.quadraticCurveTo(mx, my - 1.5 * s, ex, ey);
    ctx.quadraticCurveTo(mx, my + 2 * s, tx, ty + 2 * s);
    ctx.closePath();
    ctx.lineWidth = lw * 2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
    const col = greens[Math.floor(rnd() * greens.length)];
    ctx.fillStyle = vgrad(ctx, ty - 24 * s, ey + 10 * s, col, 0.25, 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    strokeLine(ctx, rgba('#d8ff9a', 0.55), 1.2);
  }
  for (const [dx, dy] of [[-3, 4], [3, 5], [0, 7]]) {
    const bx = tx + dx * s, by = ty + dy * s;
    ctx.beginPath(); ctx.arc(bx, by, 3.6 * s, 0, TAU);
    paint(ctx, ball(ctx, bx, by, 3.6 * s, '#8a5a2a'), lw * 0.7);
  }
}

function umbrella(ctx, x, gy, s, c1, c2, lean = 0.12, lw = 2) {
  const H = 62 * s, tx = x + lean * H, ty = gy - H;
  ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.lineTo(tx, ty);
  strokeLine(ctx, OUT, 4.4 * s); ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.lineTo(tx, ty);
  strokeLine(ctx, '#f4f0ea', 2.2 * s);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(lean * 0.9);
  const rx = 38 * s, ry = 20 * s, n = 6;
  const canopy = () => {
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.bezierCurveTo(-rx, -ry * 1.25, rx, -ry * 1.25, rx, 0);
    for (let i = n - 1; i >= 0; i--) {
      const xa = -rx + (i + 1) * 2 * rx / n, xb = xa - 2 * rx / n;
      ctx.quadraticCurveTo((xa + xb) / 2, -ry * 0.28, xb, 0);
    }
    ctx.closePath();
  };
  canopy();
  ctx.fillStyle = c1; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < n; i += 2) {
    const xa = -rx + i * 2 * rx / n, xb = xa + 2 * rx / n;
    ctx.beginPath(); ctx.moveTo(0, -ry * 1.1); ctx.lineTo(xa, 4); ctx.lineTo(xb, 4); ctx.closePath();
    ctx.fillStyle = c2; ctx.fill();
  }
  ctx.fillStyle = lgY(ctx, [[-ry, rgba('#ffffff', 0.3)], [0, rgba('#000000', 0.12)]]);
  ctx.fillRect(-rx - 2, -ry * 1.3, rx * 2 + 4, ry * 1.4);
  ctx.restore();
  canopy(); paint(ctx, null, lw);
  ctx.beginPath(); ctx.arc(0, -ry * 0.95, 2.6 * s, 0, TAU); paint(ctx, c1, lw * 0.7);
  ctx.restore();
}

function shell(ctx, x, y, s, col, rot = 0, lw = 1.6) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-1.6 * s, 0.5 * s);
  ctx.lineTo(-5 * s, -3 * s);
  ctx.quadraticCurveTo(0, -9.5 * s, 5 * s, -3 * s);
  ctx.lineTo(1.6 * s, 0.5 * s);
  ctx.closePath();
  paint(ctx, vgrad(ctx, -8 * s, 0, col, 0.25, 0.15), lw);
  ctx.beginPath();
  for (const k of [-0.6, -0.2, 0.2, 0.6]) { ctx.moveTo(0, 0); ctx.lineTo(k * 6 * s, -6.5 * s + Math.abs(k) * 2.5 * s); }
  strokeLine(ctx, rgba(shade(col, -0.45), 0.7), 0.9);
  rr(ctx, -2.4 * s, -0.4 * s, 4.8 * s, 2.2 * s, 1 * s); paint(ctx, shade(col, -0.1), lw * 0.7);
  ctx.restore();
}
function starfish(ctx, x, y, s, col, rot = 0, lw = 1.6) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + i * TAU / 10, r = (i % 2 ? 2.6 : 7) * s;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62]);
  }
  smooth(ctx, pts, true, 0.35);
  paint(ctx, vgrad(ctx, y - 5 * s, y + 4 * s, col, 0.25, 0.2), lw);
  ctx.fillStyle = rgba('#fff3d0', 0.85);
  for (let i = 0; i < 5; i++) {
    const a = rot - Math.PI / 2 + i * TAU / 5;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3.6 * s, y + Math.sin(a) * 3.6 * s * 0.62, 0.7 * s, 0, TAU); ctx.fill();
  }
}
function paw(ctx, x, y, s, col, rot = 0, squash = 0.55) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  ctx.rotate(rot);
  ctx.fillStyle = col;
  ctx.beginPath();
  addEll(ctx, 0, 1.3 * s, 2.3 * s, 1.8 * s);
  addEll(ctx, -2.5 * s, -1.4 * s, 0.9 * s, 1.15 * s, -0.35);
  addEll(ctx, -0.85 * s, -2.7 * s, 0.9 * s, 1.15 * s, -0.12);
  addEll(ctx, 0.85 * s, -2.7 * s, 0.9 * s, 1.15 * s, 0.12);
  addEll(ctx, 2.5 * s, -1.4 * s, 0.9 * s, 1.15 * s, 0.35);
  ctx.fill();
  ctx.restore();
}
function pawPath(ctx, x, y, s) { // empreinte en chemin (pour bannières/néons)
  addEll(ctx, x, y + 1.3 * s, 2.3 * s, 1.8 * s);
  addEll(ctx, x - 2.5 * s, y - 1.4 * s, 0.9 * s, 1.15 * s, -0.35);
  addEll(ctx, x - 0.85 * s, y - 2.7 * s, 0.9 * s, 1.15 * s, -0.12);
  addEll(ctx, x + 0.85 * s, y - 2.7 * s, 0.9 * s, 1.15 * s, 0.12);
  addEll(ctx, x + 2.5 * s, y - 1.4 * s, 0.9 * s, 1.15 * s, 0.35);
}

function pine(ctx, x, gy, s, col, o = {}) {
  const lw = o.lw ?? 2, tiers = o.tiers || 4, H = (o.h || 100) * s, W0 = (o.w || 30) * s;
  if (lw >= 0) { rr(ctx, x - 3.5 * s, gy - 16 * s, 7 * s, 18 * s, 1.5 * s); paint(ctx, o.trunk || '#7a4a2a', lw); }
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const yb = gy - 11 * s - H * 0.72 * t;
    const ya = yb - H * 0.4;
    const w = W0 * (1 - t * 0.6);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.quadraticCurveTo(x - w * 0.32, ya + (yb - ya) * 0.6, x - w, yb);
      ctx.quadraticCurveTo(x - w * 0.5, yb + 3.5 * s, x, yb + 1.5 * s);
      ctx.quadraticCurveTo(x + w * 0.5, yb + 3.5 * s, x + w, yb);
      ctx.quadraticCurveTo(x + w * 0.32, ya + (yb - ya) * 0.6, x, ya);
      ctx.closePath();
    };
    path();
    const g = ctx.createLinearGradient(x - w, ya, x + w, yb);
    g.addColorStop(0, shade(col, 0.18)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.25));
    ctx.fillStyle = g; ctx.fill();
    if (o.snow) {
      ctx.save(); path(); ctx.clip();
      const ybNext = gy - 11 * s - H * 0.72 * (i + 1) / tiers;
      const ys = i < tiers - 1 ? ybNext + (yb - ybNext) * 0.42 : ya + (yb - ya) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - w - 3, ya - 6);
      ctx.lineTo(x - w - 3, ys + 2 * s);
      const k = 4;
      for (let j = 0; j < k; j++) {
        const xa = x - w + (2 * w) * j / k, xb = xa + 2 * w / k;
        ctx.quadraticCurveTo((xa + xb) / 2, ys + (6 + (j % 2) * 3) * s, xb, ys + (j % 2 ? 1 : -1) * s);
      }
      ctx.lineTo(x + w + 3, ya - 6);
      ctx.closePath();
      ctx.fillStyle = lgY(ctx, [[ya, '#ffffff'], [ys + 6 * s, o.snowShade || '#d6e4f7']]);
      ctx.fill();
      ctx.restore();
    }
    if (lw > 0) { path(); paint(ctx, null, lw); }
  }
}

function crystal(ctx, x, gy, h, w, rot, col, o = {}) {
  const lw = o.lw ?? 2;
  ctx.save();
  ctx.translate(x, gy);
  ctx.rotate(rot);
  const pts = [[-w, 0], [-w, -h * 0.68], [0, -h], [w, -h * 0.7], [w, 0]];
  poly(ctx, pts);
  ctx.fillStyle = shade(col, -0.18); ctx.fill();
  poly(ctx, [[-w, 0], [-w, -h * 0.68], [0, -h], [w * 0.1, -h * 0.55], [w * 0.1, 0]]);
  ctx.fillStyle = lgY(ctx, [[-h, shade(col, 0.45)], [0, col]]); ctx.fill();
  poly(ctx, [[-w * 0.6, -h * 0.66], [0, -h * 0.94], [-w * 0.15, -h * 0.6], [-w * 0.6, -h * 0.25]]);
  ctx.fillStyle = rgba('#ffffff', 0.45); ctx.fill();
  poly(ctx, pts);
  paint(ctx, null, lw, o.stroke || OUT);
  ctx.restore();
}
function crystalCluster(ctx, S, x, gy, s, cols, rnd, o = {}) {
  if (o.glow !== false) glow(ctx, x, gy - 14 * s, 34 * s * (o.glowR || 1), cols[0], o.glowA ?? 0.45);
  const n = o.n || 4;
  const items = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    items.push([x + t * 18 * s + (rnd() - 0.5) * 4 * s, (14 + rnd() * 14) * s * (1 - Math.abs(t) * 0.6), (3.5 + rnd() * 2) * s, t * 0.9 + (rnd() - 0.5) * 0.2, cols[i % cols.length]]);
  }
  items.sort((a, b) => a[1] - b[1]);
  // le plus grand au centre, dessiné en dernier
  for (const [cx, h, w, rot, col] of items) crystal(ctx, cx, gy + 2, h, w, rot, col, o);
}

function snowman(ctx, x, gy, s, lw = 2) {
  const b1 = 15 * s, b2 = 11 * s, b3 = 8.5 * s;
  const y1 = gy - b1 * 0.9, y2 = y1 - b1 * 0.8 - b2 * 0.6, y3 = y2 - b2 * 0.75 - b3 * 0.7;
  // bras
  ctx.beginPath();
  ctx.moveTo(x - b2 * 0.8, y2); ctx.lineTo(x - b2 * 2, y2 - 9 * s); ctx.moveTo(x - b2 * 1.6, y2 - 6 * s); ctx.lineTo(x - b2 * 1.9, y2 - 1 * s);
  ctx.moveTo(x + b2 * 0.8, y2); ctx.lineTo(x + b2 * 2, y2 - 7 * s); ctx.moveTo(x + b2 * 1.6, y2 - 4.5 * s); ctx.lineTo(x + b2 * 1.75, y2 - 10 * s);
  strokeLine(ctx, OUT, 3.8 * s);
  ctx.beginPath();
  ctx.moveTo(x - b2 * 0.8, y2); ctx.lineTo(x - b2 * 2, y2 - 9 * s); ctx.moveTo(x - b2 * 1.6, y2 - 6 * s); ctx.lineTo(x - b2 * 1.9, y2 - 1 * s);
  ctx.moveTo(x + b2 * 0.8, y2); ctx.lineTo(x + b2 * 2, y2 - 7 * s); ctx.moveTo(x + b2 * 1.6, y2 - 4.5 * s); ctx.lineTo(x + b2 * 1.75, y2 - 10 * s);
  strokeLine(ctx, '#8a5a34', 1.8 * s);
  for (const [yy, r] of [[y1, b1], [y2, b2], [y3, b3]]) {
    ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU);
    paint(ctx, ball(ctx, x, yy, r, '#f4f8ff', 0.3, 0.16), lw);
  }
  // boutons
  for (const yy of [y2 - 3 * s, y2 + 3.5 * s, y1 - 6 * s]) { ctx.beginPath(); ctx.arc(x + 1 * s, yy, 1.5 * s, 0, TAU); ctx.fillStyle = '#3a2a3a'; ctx.fill(); }
  // écharpe
  rr(ctx, x - b2 * 0.95, y2 - b2 * 0.82, b2 * 1.9, 5 * s, 2.5 * s); paint(ctx, '#ff4a5a', lw * 0.8);
  rr(ctx, x + b2 * 0.2, y2 - b2 * 0.6, 5 * s, 12 * s, 2 * s); paint(ctx, '#ff4a5a', lw * 0.8);
  // visage
  ctx.fillStyle = '#2b1838';
  ctx.beginPath(); ctx.arc(x - 3 * s, y3 - 1.5 * s, 1.3 * s, 0, TAU); ctx.arc(x + 3.2 * s, y3 - 1.5 * s, 1.3 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y3 + 0.5 * s); ctx.lineTo(x + 9 * s, y3 + 2 * s); ctx.lineTo(x, y3 + 3 * s); ctx.closePath();
  paint(ctx, '#ff8a2a', lw * 0.6);
  // bonnet à oreilles de chat
  ctx.beginPath();
  ctx.moveTo(x - b3 * 1.02, y3 - b3 * 0.25);
  ctx.quadraticCurveTo(x - b3, y3 - b3 * 1.2, x - b3 * 0.85, y3 - b3 * 1.65);
  ctx.lineTo(x - b3 * 0.35, y3 - b3 * 1.1);
  ctx.quadraticCurveTo(x, y3 - b3 * 1.25, x + b3 * 0.35, y3 - b3 * 1.1);
  ctx.lineTo(x + b3 * 0.85, y3 - b3 * 1.65);
  ctx.quadraticCurveTo(x + b3, y3 - b3 * 1.2, x + b3 * 1.02, y3 - b3 * 0.25);
  ctx.closePath();
  paint(ctx, vgrad(ctx, y3 - b3 * 1.6, y3, '#4a7aff', 0.2, 0.2), lw);
  rr(ctx, x - b3 * 1.08, y3 - b3 * 0.45, b3 * 2.16, 4 * s, 2 * s); paint(ctx, '#ffffff', lw * 0.7);
}

function deadTree(ctx, x, gy, s, rnd, col, rim, lw = 2) {
  const segs = [];
  const br = (x0, y0, a, len, w, d) => {
    const bend = (rnd() - 0.5) * len * 0.35;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    segs.push([x0, y0, (x0 + x1) / 2 + Math.cos(a + Math.PI / 2) * bend, (y0 + y1) / 2 + Math.sin(a + Math.PI / 2) * bend, x1, y1, w]);
    if (d > 0) {
      const k = d > 2 ? 2 : 1 + (rnd() < 0.6 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        const side = k === 1 ? (rnd() < 0.5 ? -1 : 1) : (i ? 1 : -1);
        br(x1, y1, a + side * (0.3 + rnd() * 0.45), len * (0.6 + rnd() * 0.18), w * 0.62, d - 1);
      }
    }
  };
  br(x, gy + 3, -Math.PI / 2 + (rnd() - 0.5) * 0.25, 38 * s, 10 * s, 4);
  const draw = (col2, extra) => {
    for (const [x0, y0, cx, cy, x1, y1, w] of segs) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
      strokeLine(ctx, col2, Math.max(0.8, w + extra));
    }
  };
  draw(OUT, lw * 2);
  draw(col, 0);
  ctx.save(); ctx.translate(0.9 * s, -0.4 * s);
  for (const [x0, y0, cx, cy, x1, y1, w] of segs) {
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.25, y0); ctx.quadraticCurveTo(cx + w * 0.25, cy, x1 + w * 0.2, y1);
    strokeLine(ctx, rgba(rim, 0.55), Math.max(0.5, w * 0.28));
  }
  ctx.restore();
}

// Fenêtres d'immeuble (grille)
function windows(ctx, x, y, w, h, rnd, o) {
  const cw = o.cw || 4, ch = o.ch || 5, gx = o.gx || 4, gy = o.gy || 5;
  const cols = Math.max(1, Math.floor((w - gx) / (cw + gx))), rows = Math.max(1, Math.floor((h - gy) / (ch + gy)));
  const ox = x + (w - (cols * (cw + gx) - gx)) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rnd() < (o.p ?? 0.4);
      const col = lit ? o.lit[Math.floor(rnd() * o.lit.length)] : o.off;
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + c * (cw + gx), y + gy + r * (ch + gy), cw, ch);
    }
  }
}

// Silhouette d'île flottante
function island(ctx, x, y, w, rnd, top, under, o = {}) {
  const hTop = w * 0.1, hBot = w * (0.5 + rnd() * 0.2);
  const pts = [[x - w / 2, y]];
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const d = Math.pow(Math.sin(Math.PI * t), 1.4) * hBot * (i % 2 ? 0.85 + rnd() * 0.25 : 0.42 + rnd() * 0.12);
    pts.push([x - w / 2 + w * t, y + Math.max(w * 0.06, d)]);
  }
  pts.push([x + w / 2, y], [x + w * 0.28, y - hTop], [x - w * 0.28, y - hTop]);
  smooth(ctx, pts, true, 0.45);
  if (o.lw) { paint(ctx, lgY(ctx, [[y - hTop, top], [y + 3, top], [y + 4, under], [y + hBot, shade(under, -0.35)]]), o.lw); }
  else { ctx.fillStyle = lgY(ctx, [[y - hTop, top], [y + 2, top], [y + 3, under], [y + hBot, shade(under, -0.3)]]); ctx.fill(); }
}

// Ampoules sur un fil (guirlande)
function stringLights(ctx, S, x0, y0, x1, y1, sag, cols) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + sag * 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
  strokeLine(ctx, rgba(OUT, 0.8), 1);
  const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 11));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1 + 2.4;
    const c = cols[i % cols.length];
    glow(ctx, px, py, 9, c, 0.55);
    ctx.beginPath(); ctx.arc(px, py, 1.9, 0, TAU);
    ctx.fillStyle = mix(c, '#ffffff', 0.55); ctx.fill();
  }
}

// =====================================================================
//  Sol générique : bord supérieur net, chemin, bord avant qui chevauche le chemin.
// =====================================================================
function groundBase(ctx, S, g) {
  const W = S.W;
  const fTop = wave(S, g.top ?? 271, g.topWave || [[1.3, 2, 4], [0.7, 7, 11]]);
  const fP0 = wave(S, g.p0 ?? 282, g.p0Wave || [[1.3, 2, 3], [0.6, 6, 9]]);
  const fP1 = wave(S, g.p1 ?? 306, g.p1Wave || [[1.5, 2, 3], [0.7, 5, 8]]);
  const e1 = makeEdge(S, fTop, g.edge[0], g.edge[1], g.edge[2], g.edge[3]);
  const e2 = g.edge2 ? makeEdge(S, fP1, g.edge2[0], g.edge2[1], g.edge2[2], g.edge2[3]) : null;
  const F = { fTop, fP0, fP1 };
  // 1. masse principale
  ctx.beginPath(); e1(ctx); closeDown(ctx, W);
  ctx.fillStyle = lgY(ctx, g.fill); ctx.fill();
  // ombre portée sous la lèvre
  ctx.save();
  ctx.beginPath(); e1(ctx); closeDown(ctx, W); ctx.clip();
  ctx.fillStyle = lgY(ctx, [[g.top ?? 271, rgba(g.shadow, 0)], [(g.top ?? 271) + 4, rgba(g.shadow, 0.22)], [(g.top ?? 271) + 12, rgba(g.shadow, 0)]]);
  ctx.fillRect(-10, (g.top ?? 271) - 2, W + 20, 16);
  ctx.restore();
  if (g.upper) g.upper(ctx, S, F);
  // 2. chemin
  if (g.path) {
    bandPath(ctx, W, fP0, (x) => fP1(x) + 6);
    ctx.fillStyle = lgY(ctx, g.path.fill); ctx.fill();
    ctx.save();
    bandPath(ctx, W, fP0, (x) => fP1(x) + 6); ctx.clip();
    bandPath(ctx, W, fP0, (x) => fP0(x) + 5);
    ctx.fillStyle = rgba(g.path.edge, 0.28); ctx.fill();
    if (g.pathDeco) g.pathDeco(ctx, S, F);
    ctx.restore();
    profileLine(ctx, W, fP0);
    strokeLine(ctx, rgba(g.path.edge, 0.85), 1.6);
  }
  // 3. bord avant (chevauche le bas du chemin)
  if (e2) {
    ctx.beginPath(); e2(ctx); closeDown(ctx, W);
    ctx.fillStyle = lgY(ctx, g.fill2 || g.fill); ctx.fill();
    if (g.lower) { ctx.save(); ctx.beginPath(); e2(ctx); closeDown(ctx, W); ctx.clip(); g.lower(ctx, S, F); ctx.restore(); }
    if (g.rim2) { ctx.save(); ctx.translate(0, 1.8); ctx.beginPath(); e2(ctx); strokeLine(ctx, g.rim2, 1.6); ctx.restore(); }
    ctx.beginPath(); e2(ctx);
    strokeLine(ctx, g.stroke2 || rgba(OUT, 0.55), g.lw2 ?? 1.6);
  }
  // 4. lèvre supérieure nette
  if (g.rim) { ctx.save(); ctx.translate(0, 2.2); ctx.beginPath(); e1(ctx); strokeLine(ctx, g.rim, 2.2); ctx.restore(); }
  ctx.beginPath(); e1(ctx);
  strokeLine(ctx, g.stroke || OUT, g.lw ?? 2.6);
  // 5. assombrissement vers le bas de l'écran
  ctx.fillStyle = lgY(ctx, [[324, rgba(g.shadow, 0)], [360, rgba(g.shadow, 0.22)]]);
  ctx.fillRect(-10, 324, W + 20, 40);
  if (g.after) g.after(ctx, S, F);
  return F;
}

// Empreintes alternées le long du chemin (nombre pair => raccord parfait)
function pawTrail(S, F, step, fn) {
  const n = Math.max(2, 2 * Math.round(S.W / step / 2)), st = S.W / n;
  for (let i = 0; i < n; i++) {
    const x = i * st, side = i % 2;
    S.rep(x, 6, (q) => fn(q, (F.fP0(q) + F.fP1(q)) / 2 + (side ? 4 : -2)));
  }
}

// Dispersion d'éléments dans une bande (y entre ya(x) et yb(x))
function scatter(S, n, ya, yb, fn, rad = 10) {
  for (let i = 0; i < n; i++) {
    const x = S.r(0, S.W), t = S.rand();
    S.rep(x, rad, (xx, rnd) => fn(xx, lerp(ya(xx), yb(xx), t), rnd));
  }
}

// =====================================================================
//  BIOMES
// =====================================================================
const L = (y0, h, speed, draw, front = false) => ({ y0, h, speed, draw, front });

// ------------------------------------------------------------------ Jardin
function gardenDef() {
  return {
    ambient: 'petals',
    sky(ctx) {
      skyGrad(ctx, [[0, '#2a90f0'], [0.38, '#55b6ff'], [0.68, '#9fdfff'], [1, '#e4f9ff']]);
      sunDisc(ctx, 372, 74, 22);
    },
    layers: [
      L(0, 190, 0.03, (ctx, S) => cloudBand(ctx, S, 6, 52, 150, '#ffffff', '#cde2fa')),
      L(120, 172, 0.07, (ctx, S) => {
        const W = S.W;
        const f0 = wave(S, 188, [[10, 1, 2], [8, 3, 4], [3, 6, 9]]);
        profilePath(ctx, W, f0, 300);
        ctx.fillStyle = lgY(ctx, [[160, '#b9e6dc'], [250, '#cdeee4']]); ctx.fill();
        const f = wave(S, 208, [[10, 1, 2], [7, 2, 4], [3, 6, 9]]);
        // château félin lointain (dessiné avant la colline pour y être enfoncé)
        const cx = S.r(0, W);
        S.rep(cx, 50, (xx) => {
          const b = Math.min(f(xx - 22), f(xx + 22), f(xx)) + 8;
          catCastle(ctx, xx, b, 1, '#8fc8b8', '#a8dccb');
        });
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[195, '#9fdab9'], [270, '#b6e6c6']]); ctx.fill();
        for (let i = 0; i < 46; i++) {
          const x = S.r(0, W), r = S.r(2.4, 4.6);
          S.rep(x, 8, (xx) => { ctx.beginPath(); ctx.arc(xx, f(xx) + r * 0.5, r, 0, TAU); ctx.fillStyle = '#8acfaa'; ctx.fill(); });
        }
      }),
      L(160, 132, 0.16, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 230, [[9, 1, 2], [6, 3, 5], [2.5, 7, 11]]);
        // bosquets (derrière la crête)
        for (let i = 0; i < 12; i++) {
          const x = S.r(0, W), n = S.ri(2, 4);
          S.rep(x, 40, (xx, rnd) => {
            const cs = [];
            for (let k = 0; k < n; k++) { const r = 6 + rnd() * 6; const px = xx + (k - n / 2) * 9; cs.push([px, f(px) - r * 0.55, r]); }
            blob(ctx, cs, '#5fb552', { lw: 0, dark: '#4e9f48', light: 0.25, hla: 0.22 });
          });
        }
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[222, '#93db68'], [285, '#74c458']]); ctx.fill();
        // sillons de champs
        ctx.save(); profilePath(ctx, W, f, 300); ctx.clip();
        for (let k = 1; k < 7; k++) {
          bandPath(ctx, W, (x) => f(x) + k * 7, (x) => f(x) + k * 7 + 2.2);
          ctx.fillStyle = rgba(k % 2 ? '#5da94a' : '#b8ec8a', 0.28); ctx.fill();
        }
        ctx.restore();
        ctx.save(); ctx.translate(0, 1.5); profileLine(ctx, W, f); strokeLine(ctx, rgba('#d6ffb0', 0.8), 1.6); ctx.restore();
        haze(ctx, W, 200, 292, '#d8f2ff', 0.12, 0.05);
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 255, [[2.5, 1, 2], [1.5, 4, 7]]);
        profilePath(ctx, W, fM, 300);
        ctx.fillStyle = lgY(ctx, [[248, '#a6e477'], [285, '#7fcb57']]); ctx.fill();
        profileLine(ctx, W, fM); strokeLine(ctx, rgba('#3e8a3a', 0.7), 1.6);
        const trees = S.spread(5, 0.5);
        const leafs = ['#56bd47', '#66c84c', '#4cb446', '#7bcc45'];
        trees.forEach((x, i) => {
          const s = S.r(0.95, 1.2), leaf = leafs[i % leafs.length];
          const dots = i % 3 === 0 ? { n: 6, col: '#ff4a4a' } : i % 3 === 1 ? { n: 7, col: '#ffd0e8', flower: true } : null;
          S.rep(x, 60 * s, (xx, rnd) => roundTree(ctx, xx, fM(xx) + 5, s, rnd, leaf, { dots }));
        });
        for (const x of S.spread(2, 0.4)) {
          const len = S.r(130, 190);
          S.rep(x, len, (xx) => fence(ctx, xx - len / 2, xx + len / 2, (q) => fM(q) + 5, '#d79a5c'));
        }
        for (const x of S.spread(8, 0.8)) {
          const s = S.r(0.8, 1.15);
          S.rep(x, 40, (xx, rnd) => bush(ctx, xx, fM(xx) + 7, s, rnd, S.pick(['#4fb544', '#5cc04c', '#46a840']), { flowers: rnd() < 0.6 ? 5 : 0, fcol: S.pick(['#ffffff', '#ff8fc8', '#fff176']) }));
        }
        scatter(S, 40, (x) => fM(x) + 4, (x) => fM(x) + 14, (x, y, rnd) => flower(ctx, x, y, 1.5, ['#ffffff', '#ffe066', '#ff9ad0'][Math.floor(rnd() * 3)], '#ffb020'), 4);
        haze(ctx, W, 80, 282, '#dff6ff', 0.2, 0.1);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [9, 4, 8, 'grass'], edge2: [9, 3, 6.5, 'grass'],
          fill: [[262, '#a8e866'], [288, '#82d152'], [330, '#62b842'], [360, '#4f9f37']],
          fill2: [[300, '#8bd658'], [330, '#69bd46'], [360, '#4f9f37']],
          shadow: '#2f6a2a', rim: rgba('#d8ff9e', 0.9), rim2: rgba('#c9f78f', 0.8),
          stroke: mix(OUT, '#2f6a2a', 0.3), stroke2: rgba('#2f6a2a', 0.8),
          path: { fill: [[280, '#f6e2b0'], [296, '#f1d49a'], [312, '#e6c084']], edge: '#b98a52' },
          upper(ctx, S, F) {
            scatter(S, 34, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y, rnd) => tuft(ctx, x, y, 0.55, '#5fb544', rnd), 8);
            scatter(S, 9, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 2, (x, y, rnd) => flower(ctx, x, y, 1.4, rnd() < 0.5 ? '#ffffff' : '#ffe066'), 4);
          },
          pathDeco(ctx, S, F) {
            scatter(S, 70, (x) => F.fP0(x) + 3, (x) => F.fP1(x) + 3, (x, y, rnd) => {
              const r = 0.8 + rnd() * 1.8;
              ell(ctx, x, y, r * 1.4, r * 0.8); ctx.fillStyle = rgba('#c49a62', 0.55); ctx.fill();
              ell(ctx, x - r * 0.2, y - r * 0.3, r * 0.8, r * 0.35); ctx.fillStyle = rgba('#fff6dc', 0.6); ctx.fill();
            }, 5);
            scatter(S, 26, (x) => F.fP0(x) + 6, (x) => F.fP1(x) - 2, (x, y, rnd) => {
              ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6 + rnd() * 6, y); strokeLine(ctx, rgba('#d7b47c', 0.5), 1.1);
            }, 14);
          },
          lower(ctx, S, F) {
            for (let k = 0; k < 4; k++) {
              bandPath(ctx, S.W, (x) => F.fP1(x) + 14 + k * 11, (x) => F.fP1(x) + 18 + k * 11);
              ctx.fillStyle = rgba('#a6e870', 0.18); ctx.fill();
            }
            scatter(S, 60, (x) => F.fP1(x) + 8, () => 360, (x, y, rnd) => tuft(ctx, x, y, 0.7, '#4e9f3a', rnd), 8);
            scatter(S, 22, (x) => F.fP1(x) + 10, () => 356, (x, y, rnd) => flower(ctx, x, y, 1.9, ['#ffffff', '#ffe066', '#ff9ad0', '#9ad0ff'][Math.floor(rnd() * 4)], '#ffb020', 0.8), 5);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => frontGreens(ctx, S, {
        grass: '#5cbf45', petals: ['#ffffff', '#ffe066', '#ff8fc8'], rock: '#b8b0c8', n: 6,
      }), true),
    ],
  };
}

function catCastle(ctx, x, by, s, col, light) {
  ctx.fillStyle = col;
  // muraille
  ctx.fillRect(x - 24 * s, by - 18 * s, 48 * s, 30 * s);
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 24 * s + i * 8.6 * s, by - 22 * s, 4.6 * s, 5 * s);
  // donjon
  ctx.fillRect(x - 7 * s, by - 40 * s, 14 * s, 40 * s);
  ctx.beginPath(); ctx.moveTo(x - 9 * s, by - 40 * s); ctx.lineTo(x, by - 56 * s); ctx.lineTo(x + 9 * s, by - 40 * s); ctx.fill();
  // tours à oreilles
  for (const dx of [-21, 21]) {
    ctx.fillRect(x + dx * s - 5 * s, by - 30 * s, 10 * s, 30 * s);
    ctx.beginPath();
    ctx.moveTo(x + dx * s - 6 * s, by - 30 * s);
    ctx.lineTo(x + dx * s - 5 * s, by - 39 * s);
    ctx.lineTo(x + dx * s - 1 * s, by - 33 * s);
    ctx.lineTo(x + dx * s + 1 * s, by - 33 * s);
    ctx.lineTo(x + dx * s + 5 * s, by - 39 * s);
    ctx.lineTo(x + dx * s + 6 * s, by - 30 * s);
    ctx.fill();
  }
  // drapeau
  ctx.fillRect(x - 0.5 * s, by - 64 * s, 1 * s, 9 * s);
  ctx.beginPath(); ctx.moveTo(x + 0.5 * s, by - 64 * s); ctx.lineTo(x + 8 * s, by - 61.5 * s); ctx.lineTo(x + 0.5 * s, by - 59 * s); ctx.fillStyle = '#f2a6b8'; ctx.fill();
  ctx.fillStyle = light;
  ctx.fillRect(x - 2 * s, by - 32 * s, 4 * s, 6 * s);
  for (const dx of [-21, 21]) ctx.fillRect(x + dx * s - 1.5 * s, by - 24 * s, 3 * s, 5 * s);
  ctx.beginPath(); ctx.arc(x, by - 6 * s, 5 * s, Math.PI, 0); ctx.lineTo(x + 5 * s, by); ctx.lineTo(x - 5 * s, by); ctx.fill();
}

// Touffe de larges feuilles (premier plan)
function leafClump(ctx, x, by, s, col, rnd, n = 5) {
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = -Math.PI / 2 + (t - 0.5) * 1.9 + (rnd() - 0.5) * 0.2;
    const len = (17 + rnd() * 7) * s * (1 - Math.abs(t - 0.5) * 0.45);
    leaves.push([x + (t - 0.5) * 9 * s, a, len, Math.abs(t - 0.5)]);
  }
  leaves.sort((p, q) => q[3] - p[3]); // feuilles latérales d'abord
  for (const [bx, a, len] of leaves) {
    const w = len * 0.3, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const tx = bx + dx * len, ty = by + dy * len + len * 0.12;
    const mx = bx + dx * len * 0.5, my = by + dy * len * 0.5;
    ctx.beginPath();
    ctx.moveTo(bx, by + 4);
    ctx.quadraticCurveTo(mx + nx * w, my + ny * w, tx, ty);
    ctx.quadraticCurveTo(mx - nx * w, my - ny * w, bx, by + 4);
    ctx.closePath();
    const g = ctx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, shade(col, -0.22)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, 0.22));
    paint(ctx, g, 2);
    ctx.beginPath(); ctx.moveTo(bx, by + 2); ctx.quadraticCurveTo(mx + nx * w * 0.15, my + ny * w * 0.15, tx - dx * len * 0.12, ty - dy * len * 0.12);
    strokeLine(ctx, rgba(shade(col, -0.35), 0.7), 1.2);
    ctx.beginPath(); ctx.moveTo(mx + nx * w * 0.55, my + ny * w * 0.55); ctx.quadraticCurveTo(mx + nx * w * 0.5 + dx * len * 0.2, my + ny * w * 0.5 + dy * len * 0.2, tx - dx * len * 0.18 + nx * w * 0.2, ty - dy * len * 0.18 + ny * w * 0.2);
    strokeLine(ctx, rgba('#ffffff', 0.35), 1.3);
  }
}

// Premier plan (herbes / fleurs / pierres) — uniquement y ≥ 318
function frontGreens(ctx, S, o) {
  for (const x of S.spread(o.n || 6, 0.9)) {
    const kind = S.rand();
    S.rep(x, 60, (xx, rnd) => {
      const by = 350 + rnd() * 6;
      const g = lgY(ctx, [[by - 22, shade(o.grass, 0.3)], [by + 8, shade(o.grass, -0.18)]]);
      if (kind < 0.3 && o.rock) {
        rock(ctx, xx + 10, by + 6, 30 + rnd() * 10, 13 + rnd() * 4, rnd, o.rock, { cap: o.rockCap });
        leafClump(ctx, xx - 10, by + 8, 0.75, o.grass, rnd, 4);
      } else {
        if (kind > 0.75) blob(ctx, [[xx - 12, by + 6, 10], [xx + 2, by + 1, 13], [xx + 16, by + 6, 9]], shade(o.grass, -0.05), { lw: 2, flat: by + 14, light: 0.25 });
        if (o.petals && kind > 0.45) {
          const n = 2 + Math.floor(rnd() * 2);
          for (let k = 0; k < n; k++) stemFlower(ctx, xx - 9 + k * 9 + rnd() * 4, by + 8, 16 + rnd() * 7, rnd, o.petals[Math.floor(rnd() * o.petals.length)], '#ffc030');
        }
        leafClump(ctx, xx - 2, by + 9, 1, o.grass, rnd, 5);
        tuft(ctx, xx + 20, by + 12, 1.2, o.grass, rnd, { lw: 1.5, n: 3, bw: 2, fill: g });
      }
    });
  }
}

// ------------------------------------------------------------------ Automne
function autumnDef() {
  const leafCols = ['#ff7a1e', '#e8432e', '#ffc23a', '#ff9a2e', '#c8362a'];
  return {
    ambient: 'leaves',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#e86a9a'], [0.35, '#ff8f86'], [0.62, '#ffb27a'], [0.85, '#ffd9a0'], [1, '#ffecc4']]);
      sunDisc(ctx, 340, 150, 30, { core: '#fffbe6', edge: '#ffc65a', glow: '#ffe2a0', glowR: 7, rayA: 0.22 });
      // oiseaux lointains
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const x = 90 + S.r(0, 160), y = 60 + S.r(0, 50), s = S.r(2.5, 4.5);
        ctx.moveTo(x - s, y - s * 0.4); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.7, x, y); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.7, x + s, y - s * 0.4);
      }
      strokeLine(ctx, rgba('#7a3050', 0.55), 1.3);
    },
    layers: [
      L(0, 190, 0.03, (ctx, S) => cloudBand(ctx, S, 6, 46, 130, '#ffe6ea', '#f3a9c0')),
      L(120, 172, 0.07, (ctx, S) => {
        const W = S.W;
        const f0 = wave(S, 190, [[14, 1, 2], [8, 3, 4], [3, 6, 9]]);
        profilePath(ctx, W, f0, 300);
        ctx.fillStyle = lgY(ctx, [[160, '#e7a0b0'], [260, '#f6c2b0']]); ctx.fill();
        const f = wave(S, 214, [[10, 1, 2], [6, 3, 5], [3, 7, 10]]);
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[200, '#e09088'], [280, '#f2b496']]); ctx.fill();
        for (let i = 0; i < 70; i++) {
          const x = S.r(0, W), r = S.r(3, 6.5);
          const c = S.pick(['#d97a6a', '#e48a6a', '#cf6d66']);
          S.rep(x, 8, (xx) => { ctx.beginPath(); ctx.arc(xx, f(xx) + r * 0.5, r, 0, TAU); ctx.fillStyle = c; ctx.fill(); });
        }
      }),
      L(160, 132, 0.16, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 236, [[7, 1, 2], [4, 3, 5], [2, 7, 11]]);
        // lisière de forêt : cimes rondes
        for (let i = 0; i < 44; i++) {
          const x = (i + S.rand() * 0.6) * W / 44, r = S.r(9, 16);
          const c = S.pick(['#e8743e', '#d95a3a', '#f0a03e', '#c94a36']);
          S.rep(x, 28, (xx) => blob(ctx, [[xx, f(xx) - r * 0.6, r], [xx + r * 0.6, f(xx) - r * 0.2, r * 0.7]], c, { lw: 0, light: 0.22, hla: 0.18, dark: shade(c, -0.15) }));
        }
        profilePath(ctx, W, (x) => f(x) + 4, 300);
        ctx.fillStyle = lgY(ctx, [[240, '#d9934a'], [290, '#c47a3a']]); ctx.fill();
        haze(ctx, W, 200, 292, '#ffd2b0', 0.3, 0.12);
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 258, [[2.5, 1, 2], [1.5, 4, 7]]);
        profilePath(ctx, W, fM, 300);
        ctx.fillStyle = lgY(ctx, [[250, '#efbb5e'], [285, '#d99a45']]); ctx.fill();
        profileLine(ctx, W, fM); strokeLine(ctx, rgba('#8a4a20', 0.6), 1.6);
        const xs = S.spread(7, 0.5);
        xs.forEach((x, i) => {
          const s = S.r(0.92, 1.18);
          if (i % 3 === 2) S.rep(x, 40, (xx, rnd) => birch(ctx, xx, fM(xx) + 5, s, rnd, '#ffc43a'));
          else {
            const leaf = leafCols[(i * 2) % 4];
            S.rep(x, 60, (xx, rnd) => roundTree(ctx, xx, fM(xx) + 5, s, rnd, leaf, { trunk: '#7e4a2a' }));
          }
        });
        for (const x of S.spread(6, 0.8)) {
          const s = S.r(0.75, 1.05);
          S.rep(x, 40, (xx, rnd) => bush(ctx, xx, fM(xx) + 7, s, rnd, S.pick(['#d9572e', '#e8833a', '#c9452e'])));
        }
        for (const x of S.spread(5, 0.9)) {
          S.rep(x, 42, (xx, rnd) => {
            const n = 1 + Math.floor(rnd() * 3);
            for (let k = 0; k < n; k++) pumpkin(ctx, xx + k * 15 - n * 6, fM(xx) + 9 + (k % 2) * 2, 0.8 + rnd() * 0.35, rnd);
          });
        }
        scatter(S, 50, (x) => fM(x) + 3, (x) => fM(x) + 16, (x, y, rnd) => leafShape(ctx, x, y, 1.8, rnd() * 3, leafCols[Math.floor(rnd() * 5)]), 4);
        haze(ctx, W, 80, 282, '#ffe0c0', 0.2, 0.1);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [9, 4, 7.5, 'grass'], edge2: [9, 3, 6, 'grass'],
          fill: [[262, '#f0c060'], [288, '#dea347'], [330, '#c4853a'], [360, '#a46a2e']],
          fill2: [[300, '#e2a84c'], [330, '#c98a3c'], [360, '#a46a2e']],
          shadow: '#6a3418', rim: rgba('#ffe39a', 0.9), rim2: rgba('#ffd884', 0.7),
          stroke: mix(OUT, '#6a3418', 0.3), stroke2: rgba('#6a3418', 0.75),
          path: { fill: [[280, '#c4895a'], [296, '#b57a4c'], [312, '#a46c42']], edge: '#6e4426' },
          upper(ctx, S, F) {
            scatter(S, 28, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y, rnd) => tuft(ctx, x, y, 0.55, '#c98a35', rnd), 8);
            scatter(S, 30, (x) => F.fTop(x) + 4, (x) => F.fP0(x), (x, y, rnd) => leafShape(ctx, x, y, 2.2, rnd() * 3, leafCols[Math.floor(rnd() * 5)]), 4);
          },
          pathDeco(ctx, S, F) {
            scatter(S, 50, (x) => F.fP0(x) + 3, (x) => F.fP1(x) + 3, (x, y, rnd) => {
              const r = 0.8 + rnd() * 1.6;
              ell(ctx, x, y, r * 1.4, r * 0.8); ctx.fillStyle = rgba('#7e4e2e', 0.45); ctx.fill();
              ell(ctx, x - r * 0.2, y - r * 0.3, r * 0.8, r * 0.35); ctx.fillStyle = rgba('#ffe2c0', 0.4); ctx.fill();
            }, 5);
            scatter(S, 70, (x) => F.fP0(x) + 3, (x) => F.fP1(x) + 4, (x, y, rnd) => leafShape(ctx, x, y, 2.4 + rnd(), rnd() * 3, leafCols[Math.floor(rnd() * 5)], 0.6), 5);
          },
          lower(ctx, S, F) {
            scatter(S, 45, (x) => F.fP1(x) + 8, () => 360, (x, y, rnd) => tuft(ctx, x, y, 0.7, '#b8742e', rnd), 8);
            scatter(S, 60, (x) => F.fP1(x) + 6, () => 358, (x, y, rnd) => leafShape(ctx, x, y, 2.6 + rnd() * 1.4, rnd() * 3, leafCols[Math.floor(rnd() * 5)], 0.7), 6);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 348 + rnd() * 8;
            if (kind < 0.35) {
              pumpkin(ctx, xx, by, 1.15 + rnd() * 0.25, rnd);
              tuft(ctx, xx - 18, by + 8, 1.6, '#d89a40', rnd, { lw: 1.8, n: 4, bw: 2.2, fill: lgY(ctx, [[by - 16, '#ffd070'], [by + 8, '#b8742e']]) });
            } else if (kind < 0.7) {
              // tas de feuilles
              const cs = [[xx - 10, by, 9], [xx + 2, by - 3, 11], [xx + 14, by + 1, 8]];
              blob(ctx, cs, '#e8742e', { lw: 1.8, flat: by + 8 });
              for (let k = 0; k < 9; k++) leafShape(ctx, xx - 16 + rnd() * 34, by - 6 + rnd() * 10, 3.2, rnd() * 3, leafCols[Math.floor(rnd() * 5)], 0.9);
            } else {
              rock(ctx, xx, by + 6, 28, 12, rnd, '#b59a8a');
              leafShape(ctx, xx - 4, by - 4, 3.4, 0.4, '#e8432e', 0.9);
              tuft(ctx, xx + 18, by + 10, 1.6, '#d89a40', rnd, { lw: 1.8, n: 4, bw: 2.2, fill: lgY(ctx, [[by - 16, '#ffd070'], [by + 8, '#b8742e']]) });
            }
          });
        }
      }, true),
    ],
  };
}

// ------------------------------------------------------------------ Plage
function beachDef() {
  return {
    ambient: 'bubbles',
    sky(ctx) {
      skyGrad(ctx, [[0, '#1596f0'], [0.4, '#45bdff'], [0.7, '#9ae6ff'], [1, '#e2fbff']]);
      sunDisc(ctx, 368, 70, 22);
    },
    layers: [
      L(0, 190, 0.03, (ctx, S) => {
        cloudBand(ctx, S, 5, 50, 140, '#ffffff', '#c9e6fa');
        // mouettes
        for (let i = 0; i < 5; i++) {
          const x = S.r(0, S.W), y = S.r(60, 150), s = S.r(3, 5);
          S.rep(x, 10, (xx) => {
            ctx.beginPath();
            ctx.moveTo(xx - s, y - s * 0.3); ctx.quadraticCurveTo(xx - s * 0.45, y - s * 0.75, xx, y); ctx.quadraticCurveTo(xx + s * 0.45, y - s * 0.75, xx + s, y - s * 0.3);
            strokeLine(ctx, rgba('#2b4870', 0.75), 1.3);
          });
        }
      }),
      L(180, 112, 0.06, (ctx, S) => {
        const W = S.W, hz = 206;
        // mer
        ctx.fillStyle = lgY(ctx, [[hz, '#2fa8d8'], [hz + 14, '#22b4d4'], [250, '#33cfd6'], [292, '#6fe6dc']]);
        ctx.fillRect(-5, hz, W + 10, 100);
        // îles lointaines + phare
        const ix = S.r(0, W);
        S.rep(ix, 70, (xx) => {
          ctx.beginPath(); ctx.moveTo(xx - 60, hz + 1); ctx.quadraticCurveTo(xx - 30, hz - 16, xx, hz - 18); ctx.quadraticCurveTo(xx + 34, hz - 14, xx + 62, hz + 1); ctx.closePath();
          ctx.fillStyle = '#7cc4b4'; ctx.fill();
          lighthouse(ctx, xx + 12, hz - 15, 0.9);
        });
        const ix2 = mod(ix + W * 0.5, W);
        S.rep(ix2, 40, (xx) => {
          ctx.beginPath(); ctx.moveTo(xx - 34, hz + 1); ctx.quadraticCurveTo(xx - 6, hz - 11, xx + 30, hz + 1); ctx.closePath();
          ctx.fillStyle = '#8fd0c2'; ctx.fill();
        });
        // voiliers
        for (const x of [mod(ix + W * 0.28, W), mod(ix + W * 0.74, W)]) {
          S.rep(x, 14, (xx) => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(xx, hz + 4); ctx.lineTo(xx, hz - 14); ctx.lineTo(xx + 8, hz + 3); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(xx - 1, hz - 11); ctx.lineTo(xx - 1, hz + 3); ctx.lineTo(xx - 6, hz + 3); ctx.closePath(); ctx.fillStyle = '#ffe2e6'; ctx.fill();
            ctx.beginPath(); ctx.moveTo(xx - 8, hz + 4); ctx.lineTo(xx + 10, hz + 4); ctx.lineTo(xx + 7, hz + 7); ctx.lineTo(xx - 6, hz + 7); ctx.closePath(); ctx.fillStyle = '#e8566a'; ctx.fill();
          });
        }
        // ligne d'horizon lumineuse
        ctx.fillStyle = rgba('#e6fdff', 0.75); ctx.fillRect(-5, hz, W + 10, 1.6);
        // vaguelettes et reflets
        for (let i = 0; i < 150; i++) {
          const y = hz + 4 + Math.pow(S.rand(), 1.3) * 80, x = S.r(0, W), w = 3 + (y - hz) * 0.18 * S.r(0.6, 1.4);
          const a = 0.25 + S.rand() * 0.45;
          S.rep(x, w, (xx) => { ctx.beginPath(); ctx.moveTo(xx - w, y); ctx.quadraticCurveTo(xx, y - 1.2, xx + w, y); strokeLine(ctx, rgba('#ffffff', a), 1 + (y - hz) * 0.012); });
        }
        for (let i = 0; i < 26; i++) {
          const y = hz + 6 + S.rand() * 60, x = S.r(0, W), s = S.r(2, 4.5);
          S.rep(x, 6, (xx) => sparkle(ctx, xx, y, s, '#ffffff', 0.9));
        }
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 257, [[2.5, 1, 2], [1.5, 4, 7]]);
        // eau peu profonde + écume
        bandPath(ctx, W, (x) => fM(x) - 9, (x) => fM(x) + 2);
        ctx.fillStyle = rgba('#a8f4ea', 0.85); ctx.fill();
        profilePath(ctx, W, fM, 300);
        ctx.fillStyle = lgY(ctx, [[250, '#f9e3a8'], [285, '#ecc883']]); ctx.fill();
        const foam = makeEdge(S, (x) => fM(x) - 1, 9, 1.2, 2.6, 'bump');
        ctx.beginPath(); foam(ctx); ctx.lineTo(W + 40, 0); ctx.lineTo(-40, 0);
        ctx.save(); ctx.beginPath(); foam(ctx); for (let x = W + 18; x >= -18; x -= 3) ctx.lineTo(x, fM(x) + 2.5); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
        profileLine(ctx, W, (x) => fM(x) + 2.5); strokeLine(ctx, rgba('#d3a866', 0.7), 1.3);
        const xs = S.spread(3, 0.4);
        xs.forEach((x, i) => {
          const s = S.r(0.95, 1.12), lean = (i % 2 ? 1 : -1) * S.r(14, 26);
          S.rep(x, 130, (xx, rnd) => palm(ctx, xx, fM(xx) + 6, s, rnd, lean));
        });
        const um = [['#ff5a6a', '#ffffff'], ['#3fa8ff', '#ffffff'], ['#ffc83a', '#ff6a3a']];
        S.spread(3, 0.5).forEach((x, i) => {
          const c = um[i % um.length];
          S.rep(x + 60, 62, (xx) => umbrella(ctx, xx, fM(xx) + 8, S.r(0.9, 1.05), c[0], c[1], (i % 2 ? 0.14 : -0.12)));
        });
        const sc = S.r(0, W);
        S.rep(sc, 30, (xx) => sandcastle(ctx, xx, fM(xx) + 9, 1));
        for (const x of S.spread(7, 0.9)) S.rep(x, 14, (xx, rnd) => tuft(ctx, xx, fM(xx) + 7, 0.8, '#6cbf55', rnd, { lw: 1.5, tall: 1.4, bw: 1.8 }));
        haze(ctx, W, 80, 282, '#eafcff', 0.18, 0.08);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [11, 0.8, 1.8, 'bump'], edge2: [10, 0.8, 1.6, 'bump'],
          fill: [[262, '#ffe9b0'], [290, '#f7d996'], [330, '#ecc47e'], [360, '#dfae68']],
          fill2: [[300, '#f9de9e'], [330, '#efc883'], [360, '#dfae68']],
          shadow: '#a87a3a', rim: rgba('#fff8e0', 0.95), rim2: rgba('#fff4d4', 0.8),
          stroke: rgba(OUT, 0.9), stroke2: rgba('#b8884a', 0.8),
          path: { fill: [[280, '#fff6dc'], [296, '#fdecc2'], [312, '#f6dca6']], edge: '#d2a866' },
          upper(ctx, S, F) {
            scatter(S, 18, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y, rnd) => { ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - 1.6, x + 5, y); strokeLine(ctx, rgba('#d9b06a', 0.6), 1); }, 6);
            scatter(S, 8, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 1, (x, y, rnd) => shell(ctx, x, y, 0.55, rnd() < 0.5 ? '#ffc0c8' : '#fff0e0', rnd() - 0.5, 1), 6);
          },
          pathDeco(ctx, S, F) {
            // empreintes de pattes
            pawTrail(S, F, 22, (q, y) => paw(ctx, q, y, 1.25, rgba('#d9b277', 0.6), Math.PI / 2));
            scatter(S, 40, (x) => F.fP0(x) + 3, (x) => F.fP1(x) + 3, (x, y, rnd) => { ell(ctx, x, y, 1 + rnd(), 0.6); ctx.fillStyle = rgba('#d7aa66', 0.6); ctx.fill(); }, 4);
          },
          lower(ctx, S, F) {
            scatter(S, 40, (x) => F.fP1(x) + 8, () => 358, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x, y - 2.2, x + 8, y); strokeLine(ctx, rgba('#cf9f5a', 0.55), 1.2); }, 10);
            scatter(S, 9, (x) => F.fP1(x) + 12, () => 352, (x, y, rnd) => shell(ctx, x, y, 0.9, ['#ffb8c4', '#fff0e0', '#ffd2a0'][Math.floor(rnd() * 3)], rnd() - 0.5), 8);
            scatter(S, 4, (x) => F.fP1(x) + 14, () => 350, (x, y, rnd) => starfish(ctx, x, y, 1, rnd() < 0.5 ? '#ff7a4a' : '#ff9a3a', rnd()), 8);
            scatter(S, 20, (x) => F.fP1(x) + 8, () => 356, (x, y, rnd) => { ell(ctx, x, y, 1.6 + rnd(), 1); ctx.fillStyle = rgba('#b9a3a0', 0.7); ctx.fill(); }, 4);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 348 + rnd() * 8;
            if (kind < 0.35) {
              starfish(ctx, xx, by, 1.8, '#ff6a4a', rnd(), 2);
              shell(ctx, xx + 22, by + 4, 1.6, '#ffc6d0', 0.3, 1.8);
            } else if (kind < 0.7) {
              tuft(ctx, xx, by + 10, 1.5, '#64b850', rnd, { lw: 1.8, tall: 1.4, n: 5, bw: 2, fill: lgY(ctx, [[by - 20, '#9ae070'], [by + 8, '#4a9a3a']]) });
              tuft(ctx, xx + 15, by + 12, 1.2, '#78c85a', rnd, { lw: 1.8, tall: 1.4, bw: 2, fill: lgY(ctx, [[by - 16, '#a8e87a'], [by + 8, '#58a844']]) });
            } else {
              rock(ctx, xx, by + 6, 30, 12, rnd, '#a9b8c8');
              shell(ctx, xx - 20, by + 6, 1.4, '#fff0dc', -0.3, 1.8);
            }
          });
        }
      }, true),
    ],
  };
}

function lighthouse(ctx, x, by, s) {
  const h = 34 * s, wb = 6 * s, wt = 4 * s;
  glow(ctx, x, by - h - 4 * s, 22 * s, '#fff6c0', 0.8);
  ctx.save();
  poly(ctx, [[x - wb, by], [x - wt, by - h], [x + wt, by - h], [x + wb, by]]);
  ctx.fillStyle = '#f4f6fa'; ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#e8606a';
  for (let k = 0; k < 4; k += 2) ctx.fillRect(x - wb, by - h + k * h / 4 + 2, wb * 2, h / 4);
  ctx.restore();
  ctx.fillStyle = '#5a6a7a'; ctx.fillRect(x - wt - 1.5 * s, by - h - 1 * s, (wt + 1.5 * s) * 2, 1.6 * s);
  ctx.fillStyle = '#fff4b0'; ctx.fillRect(x - wt * 0.7, by - h - 6 * s, wt * 1.4, 5 * s);
  ctx.beginPath(); ctx.moveTo(x - wt - 0.5 * s, by - h - 6 * s); ctx.lineTo(x, by - h - 11 * s); ctx.lineTo(x + wt + 0.5 * s, by - h - 6 * s); ctx.closePath();
  ctx.fillStyle = '#d9505a'; ctx.fill();
}
function sandcastle(ctx, x, gy, s, lw = 2) {
  const col = '#f2cf86';
  const tower = (tx, w, h) => {
    rr(ctx, tx - w / 2, gy - h, w, h + 2, 1.5);
    paint(ctx, vgrad(ctx, gy - h, gy, col, 0.2, 0.2), lw);
    for (let k = 0; k < 3; k++) { rr(ctx, tx - w / 2 + k * w / 3 + 0.5, gy - h - 4 * s, w / 3 - 1, 5 * s, 1); paint(ctx, col, lw * 0.6); }
  };
  rr(ctx, x - 20 * s, gy - 14 * s, 40 * s, 16 * s, 2); paint(ctx, vgrad(ctx, gy - 14 * s, gy, col, 0.2, 0.2), lw);
  tower(x - 14 * s, 10 * s, 22 * s);
  tower(x + 14 * s, 10 * s, 20 * s);
  tower(x, 13 * s, 30 * s);
  ctx.beginPath(); ctx.moveTo(x, gy - 34 * s); ctx.lineTo(x, gy - 46 * s); strokeLine(ctx, OUT, 1.4);
  ctx.beginPath(); ctx.moveTo(x, gy - 46 * s); ctx.lineTo(x + 9 * s, gy - 43 * s); ctx.lineTo(x, gy - 40 * s); ctx.closePath(); paint(ctx, '#ff5a7a', 1.2);
  ctx.beginPath(); ctx.arc(x, gy - 6 * s, 3.4 * s, Math.PI, 0); ctx.lineTo(x + 3.4 * s, gy); ctx.lineTo(x - 3.4 * s, gy); ctx.closePath(); ctx.fillStyle = '#b98a4a'; ctx.fill();
}

// ------------------------------------------------------------------ Neige
function snowDef() {
  return {
    ambient: 'snow',
    sky(ctx) {
      skyGrad(ctx, [[0, '#6c98ef'], [0.4, '#93baff'], [0.72, '#cfe2ff'], [1, '#f2f7ff']]);
      sunDisc(ctx, 360, 78, 20, { core: '#ffffff', edge: '#fff6d8', glow: '#ffffff', rayA: 0.28, glowA: 0.55 });
    },
    layers: [
      L(0, 190, 0.03, (ctx, S) => cloudBand(ctx, S, 5, 50, 140, '#ffffff', '#c8d4f2')),
      L(90, 202, 0.06, (ctx, S) => {
        const W = S.W;
        const peaks = [];
        let x = 0;
        while (x < W) { const w = S.r(150, 230); peaks.push([x + w * 0.5, w, S.r(85, 140)]); x += w * S.r(0.55, 0.75); }
        const cols = ['#9db8e8', '#a9c2ee', '#93b0e2'];
        peaks.forEach(([px, w, h], i) => S.rep(px, w * 0.65, (xx, rnd) => mountain(ctx, xx, 246, w, h, cols[i % 3], rnd)));
        ctx.fillStyle = '#c9daf4'; ctx.fillRect(-5, 244, W + 10, 50);
        haze(ctx, W, 90, 292, '#e6efff', 0.18, 0.5);
      }),
      L(160, 132, 0.15, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 246, [[8, 1, 2], [5, 3, 5], [2, 7, 11]]);
        for (let i = 0; i < 40; i++) {
          const x = S.r(0, W), s = S.r(0.22, 0.38);
          S.rep(x, 14, (xx) => pine(ctx, xx, f(xx) + 3, s, '#6f94b4', { lw: -1, tiers: 3, snow: true, snowShade: '#e6eefa' }));
        }
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[230, '#f6faff'], [290, '#dbe7f8']]); ctx.fill();
        ctx.save(); ctx.translate(0, 3); profileLine(ctx, W, f); strokeLine(ctx, rgba('#b8cdea', 0.8), 2.5); ctx.restore();
        haze(ctx, W, 200, 292, '#eef4ff', 0.2, 0.05);
      }),
      L(70, 212, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 258, [[2.5, 1, 2], [1.5, 4, 7]]);
        const pines = S.spread(7, 0.6);
        const snowmanAt = S.ri(0, 6);
        pines.forEach((x, i) => {
          if (i === snowmanAt) return;
          const s = S.r(0.85, 1.2);
          S.rep(x, 45, (xx) => pine(ctx, xx, fM(xx) + 6, s, i % 2 ? '#2f8a6a' : '#3a9a72', { snow: true, h: 110 }));
        });
        for (const x of S.spread(6, 0.8)) {
          S.rep(x, 40, (xx, rnd) => blob(ctx, [[xx - 10, fM(xx) + 2, 9], [xx + 3, fM(xx) - 1, 12], [xx + 15, fM(xx) + 3, 8]], '#f6faff', { lw: 1.8, flat: fM(xx) + 8, dark: '#bcd0ee' }));
        }
        S.rep(pines[snowmanAt], 40, (xx) => snowman(ctx, xx, fM(xx) + 8, 1.05));
        for (const x of S.spread(2, 0.5)) {
          const cx = mod(x + W * 0.13, W);
          S.rep(cx, 40, (xx, rnd) => crystalCluster(ctx, S, xx, fM(xx) + 8, 1, ['#7fe6ff', '#a8f0ff', '#5fcfff'], rnd));
        }
        profilePath(ctx, W, (x) => fM(x) + 6, 300);
        ctx.fillStyle = lgY(ctx, [[256, '#f4f8ff'], [285, '#d9e5f6']]); ctx.fill();
        haze(ctx, W, 70, 282, '#eef4ff', 0.2, 0.1);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [12, 1.6, 3, 'bump'], edge2: [11, 1.3, 2.6, 'bump'],
          fill: [[262, '#ffffff'], [290, '#eef4fd'], [330, '#d6e3f5'], [360, '#bccfe9']],
          fill2: [[300, '#fbfdff'], [330, '#e0eaf8'], [360, '#c2d4ec']],
          shadow: '#5a74a8', rim: rgba('#ffffff', 1), rim2: rgba('#ffffff', 0.9),
          stroke: rgba(OUT, 0.85), stroke2: rgba('#8aa2cc', 0.85),
          path: { fill: [[280, '#dde8f8'], [296, '#d2e0f4'], [312, '#c6d6ee']], edge: '#8ea6cf' },
          upper(ctx, S, F) {
            scatter(S, 14, (x) => F.fTop(x) + 6, (x) => F.fP0(x) - 1, (x, y) => sparkle(ctx, x, y, 2.2, '#ffffff', 0.95), 4);
          },
          pathDeco(ctx, S, F) {
            pawTrail(S, F, 20, (q, y) => paw(ctx, q, y, 1.25, rgba('#9fb4d8', 0.55), Math.PI / 2));
            scatter(S, 7, (x) => F.fP0(x) + 7, (x) => F.fP1(x) - 2, (x, y, rnd) => {
              const w = 14 + rnd() * 16;
              ell(ctx, x, y, w, 3.2); ctx.fillStyle = rgba('#bfe6ff', 0.75); ctx.fill();
              ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - 0.8); ctx.lineTo(x - w * 0.1, y - 0.8); strokeLine(ctx, rgba('#ffffff', 0.95), 1.2);
            }, 30);
          },
          lower(ctx, S, F) {
            scatter(S, 22, (x) => F.fP1(x) + 10, () => 356, (x, y) => sparkle(ctx, x, y, 2.4, '#ffffff', 0.95), 4);
            scatter(S, 26, (x) => F.fP1(x) + 10, () => 358, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y - 2.4, x + 9, y); strokeLine(ctx, rgba('#a9bfe2', 0.55), 1.2); }, 10);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(5, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 350 + rnd() * 6;
            if (kind < 0.4) {
              blob(ctx, [[xx - 12, by, 11], [xx + 4, by - 4, 14], [xx + 20, by + 1, 10]], '#ffffff', { lw: 1.8, flat: by + 12, dark: '#c2d4f0' });
            } else if (kind < 0.7) {
              crystalCluster(ctx, S, xx, by + 4, 0.9, ['#8fe9ff', '#c4f6ff', '#62d0ff'], rnd, { n: 3, glowR: 0.75 });
            } else {
              rock(ctx, xx, by + 6, 30, 13, rnd, '#9aa8c4', { cap: '#ffffff' });
            }
          });
        }
      }, true),
    ],
  };
}

function mountain(ctx, x, by, w, h, col, rnd) {
  const top = by - h;
  const pts = [[x - w / 2, by + 2], [x - w * 0.3, top + h * 0.5 + rnd() * 8], [x - w * 0.12, top + h * 0.18], [x - w * 0.03, top + 2], [x + w * 0.03, top], [x + w * 0.14, top + h * 0.2], [x + w * 0.3, top + h * 0.52], [x + w / 2, by + 2]];
  smooth(ctx, pts, false, 0.25);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.save();
  smooth(ctx, pts, false, 0.25); ctx.closePath(); ctx.clip();
  // face à l'ombre
  ctx.beginPath(); ctx.moveTo(x + w * 0.03, top); ctx.lineTo(x + w * 0.02, top + h * 0.4); ctx.lineTo(x + w * 0.12, top + h * 0.7); ctx.lineTo(x + w * 0.1, by + 4); ctx.lineTo(x + w, by + 4); ctx.lineTo(x + w, top); ctx.closePath();
  ctx.fillStyle = rgba(shade(col, -0.35), 0.35); ctx.fill();
  // calotte de neige
  const sy = top + h * 0.36;
  ctx.beginPath();
  ctx.moveTo(x - w, top - 10);
  ctx.lineTo(x - w * 0.5, sy);
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const xx = x - w * 0.28 + i * w * 0.56 / n;
    ctx.lineTo(xx, sy + (i % 2 ? h * 0.1 : -h * 0.02) + rnd() * 4);
  }
  ctx.lineTo(x + w * 0.5, sy);
  ctx.lineTo(x + w, top - 10);
  ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.03, top); ctx.lineTo(x + w * 0.02, top + h * 0.4); ctx.lineTo(x + w * 0.4, top + h * 0.4); ctx.lineTo(x + w * 0.4, top); ctx.closePath();
  ctx.fillStyle = rgba('#c8d6f2', 0.6); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ Ville néon
function neonDef() {
  const NEONS = ['#ff4fd8', '#48e1ff', '#ffe14a', '#7dff8a', '#ff7a4a'];
  return {
    ambient: 'rain',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#170a3e'], [0.38, '#3a1672'], [0.66, '#8a2c98'], [0.86, '#e0509e'], [1, '#ff86b8']]);
      for (let i = 0; i < 90; i++) {
        const x = S.r(0, SKY_W), y = Math.pow(S.rand(), 1.6) * 190, r = S.r(0.4, 1.3);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba('#ffffff', S.r(0.35, 0.95) * (1 - y / 220)); ctx.fill();
        if (r > 1.15) sparkle(ctx, x, y, r * 3.5, '#ffffff', 0.6);
      }
      // lune croissante
      glow(ctx, 372, 70, 70, '#ff9ae0', 0.35);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, SKY_W, VH); ctx.arc(383, 63, 17, 0, TAU); ctx.clip('evenodd');
      glow(ctx, 372, 70, 30, '#fff2c8', 0.5);
      ctx.beginPath(); ctx.arc(372, 70, 20, 0, TAU);
      ctx.fillStyle = lgY(ctx, [[50, '#fffbe8'], [90, '#ffe0a8']]); ctx.fill();
      ctx.restore();
    },
    layers: [
      L(80, 212, 0.06, (ctx, S) => {
        const W = S.W;
        skyline(ctx, S, 252, [70, 150], [26, 56], ['#5a2f96', '#52288a', '#62349e'], { p: 0.18, lit: ['#ffd27a', '#8ff0ff', '#ff9ae6'], off: null, cw: 2.6, ch: 3.4, gx: 3.4, gy: 4.2, alpha: 0.75, antenna: true });
        ctx.fillStyle = lgY(ctx, [[200, rgba('#ff86c8', 0)], [292, rgba('#ff86c8', 0.55)]]);
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillRect(-5, 200, W + 10, 92); ctx.restore();
      }),
      L(120, 172, 0.15, (ctx, S) => {
        const W = S.W;
        skyline(ctx, S, 262, [50, 112], [36, 70], ['#3c1f78', '#35196e', '#432486'], { p: 0.32, lit: ['#ffd27a', '#8ff0ff', '#ffb0f0', '#fff3c0'], off: rgba('#1f0f48', 0.5), cw: 3.6, ch: 4.6, gx: 4, gy: 5, rim: '#ff6ad8', tanks: true });
        // enseignes de toit
        for (const x of S.spread(3, 0.6)) {
          const col = S.pick(NEONS);
          S.rep(x, 30, (xx) => {
            rr(ctx, xx - 16, 170, 32, 12, 2); ctx.fillStyle = '#1e0e44'; ctx.fill();
            rr(ctx, xx - 16, 170, 32, 12, 2); neonStroke(ctx, S, col, 0.9);
            ctx.beginPath(); ctx.moveTo(xx - 10, 176); ctx.lineTo(xx + 10, 176); neonStroke(ctx, S, col, 0.9);
          });
        }
        ctx.fillStyle = lgY(ctx, [[220, rgba('#c04aa8', 0)], [292, rgba('#c04aa8', 0.45)]]);
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillRect(-5, 220, W + 10, 72); ctx.restore();
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = (x) => 262;
        // trottoir lointain
        ctx.fillStyle = lgY(ctx, [[256, '#5a3c9a'], [282, '#3e2878']]);
        ctx.fillRect(-5, 258, W + 10, 30);
        ctx.fillStyle = rgba('#ff86e0', 0.55); ctx.fillRect(-5, 257, W + 10, 1.5);
        // petits immeubles / boutiques
        let x = 0;
        while (x < W - 40) {
          const w = S.r(70, 120), gap = S.r(40, 110);
          if (x + w > W - 30) break;
          const h = S.r(44, 72), col = S.pick(['#4a2a8a', '#56309a', '#40267e']);
          const x0 = x;
          S.rep(x0 + w / 2, w, (xx, rnd) => shopFront(ctx, S, xx - w / 2, 260, w, h, col, rnd, NEONS));
          x += w + gap;
        }
        // lampadaires
        for (const lx of S.spread(4, 0.5)) S.rep(lx, 62, (xx) => streetLamp(ctx, xx, 264, 1));
        // enseignes sur poteau
        const kinds = ['cat', 'fish', 'text'];
        S.spread(3, 0.5).forEach((sx, i) => S.rep(mod(sx + 50, W), 72, (xx) => neonSign(ctx, S, xx, 264, kinds[i % 3], NEONS[i % NEONS.length])));
        haze(ctx, W, 80, 282, '#6a2a90', 0.14, 0.08);
      }),
      L(258, 102, 1, (ctx, S) => {
        const W = S.W;
        // bordure de trottoir
        ctx.fillStyle = lgY(ctx, [[266, '#8a78c8'], [276, '#6a58a8']]);
        ctx.fillRect(-5, 266, W + 10, 12);
        // chaussée mouillée
        ctx.fillStyle = lgY(ctx, [[277, '#5e4b9e'], [300, '#4c3c8a'], [330, '#3a2c70'], [360, '#2c2058']]);
        ctx.fillRect(-5, 277, W + 10, 90);
        // reflets verticaux des néons
        for (let i = 0; i < 22; i++) {
          const x = S.r(0, W), w = S.r(5, 16), col = S.pick(NEONS), a = S.r(0.16, 0.32);
          S.rep(x, w, (xx) => {
            const g = ctx.createLinearGradient(0, 279, 0, 360);
            g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g;
            for (let y = 279; y < 360; y += 3) { const ww = w * (0.6 + 0.4 * Math.sin(y * 0.7 + x)); ctx.fillRect(xx - ww / 2, y, ww, 1.8); }
          });
        }
        // dalles du trottoir où marchent les chats (bande de marche)
        ctx.fillStyle = rgba('#ffffff', 0.05);
        ctx.fillRect(-5, 282, W + 10, 24);
        ctx.beginPath();
        for (let x = 0; x <= W + 30; x += 30) { ctx.moveTo(x, 283); ctx.lineTo(x - 6, 306); }
        ctx.moveTo(-5, 306); ctx.lineTo(W + 5, 306);
        strokeLine(ctx, rgba('#2a1a5a', 0.35), 1.2);
        ctx.beginPath(); ctx.moveTo(-5, 307.5); ctx.lineTo(W + 5, 307.5); strokeLine(ctx, rgba('#b8a8ff', 0.35), 1);
        // marquage au sol
        for (let x = 10; x < W; x += 60) {
          poly(ctx, [[x, 324], [x + 32, 324], [x + 30, 328], [x - 2, 328]]);
          ctx.fillStyle = rgba('#ffe14a', 0.75); ctx.fill();
        }
        // flaques
        for (let i = 0; i < 9; i++) {
          const x = S.r(0, W), y = S.r(286, 352), w = S.r(14, 34), col = S.pick(NEONS);
          S.rep(x, w, (xx) => {
            ell(ctx, xx, y, w, w * 0.18);
            ctx.fillStyle = lgY(ctx, [[y - w * 0.18, rgba(col, 0.45)], [y + w * 0.18, rgba('#1a1040', 0.5)]]); ctx.fill();
            ctx.beginPath(); ctx.moveTo(xx - w * 0.5, y - w * 0.06); ctx.lineTo(xx + w * 0.1, y - w * 0.06); strokeLine(ctx, rgba('#ffffff', 0.7), 1);
          });
        }
        // plaque d'égout à patte
        for (const x of S.spread(2, 0.5)) {
          S.rep(x, 20, (xx) => {
            ell(ctx, xx, 340, 15, 4.5); paint(ctx, '#3a2c68', 1.6);
            ctx.save(); ctx.translate(xx, 340); ctx.scale(1, 0.3); ctx.beginPath(); pawPath(ctx, 0, 0, 2); ctx.fillStyle = rgba('#8f7fd0', 0.8); ctx.fill(); ctx.restore();
          });
        }
        // bord du trottoir : contour + liseré lumineux
        ctx.beginPath(); ctx.moveTo(-5, 266); ctx.lineTo(W + 5, 266); strokeLine(ctx, OUT, 2.6);
        ctx.beginPath(); ctx.moveTo(-5, 268.4); ctx.lineTo(W + 5, 268.4); strokeLine(ctx, rgba('#9ff4ff', 0.9), 1.6);
        ctx.beginPath(); ctx.moveTo(-5, 277.5); ctx.lineTo(W + 5, 277.5); strokeLine(ctx, rgba(OUT, 0.7), 1.6);
        ctx.beginPath(); for (let x = 0; x <= W; x += 45) { ctx.moveTo(x, 268); ctx.lineTo(x, 277); } strokeLine(ctx, rgba(OUT, 0.35), 1);
        ctx.fillStyle = lgY(ctx, [[324, rgba('#100830', 0)], [360, rgba('#100830', 0.3)]]);
        ctx.fillRect(-5, 324, W + 10, 40);
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(5, 0.9)) {
          const kind = S.rand();
          S.rep(x, 40, (xx, rnd) => {
            const by = 352 + rnd() * 5;
            if (kind < 0.4) cone(ctx, xx, by, 1.1);
            else if (kind < 0.7) fishBone(ctx, xx, by - 2, 1.3, '#e8e0ff');
            else cardboard(ctx, xx, by + 4, 1.1);
          });
        }
      }, true),
    ],
  };
}

function skyline(ctx, S, by, hR, wR, cols, o) {
  const W = S.W;
  let x = 0;
  const list = [];
  while (x < W) {
    let w = S.r(wR[0], wR[1]);
    if (W - (x + w) < wR[0]) w = W - x;
    list.push([x, w, S.r(hR[0], hR[1]), S.pick(cols)]);
    x += w;
  }
  for (const [x0, w, h, col] of list) {
    const step = S.rand() < 0.35;
    S.rep(x0 + w / 2, w, (xx, rnd) => {
      const l = xx - w / 2, top = by - h;
      ctx.fillStyle = lgY(ctx, [[top, shade(col, 0.08)], [by, shade(col, -0.05)]]);
      ctx.fillRect(l, top, w + 0.6, h + 40);
      if (step) ctx.fillRect(l + w * 0.2, top - 10, w * 0.6, 12);
      if (o.antenna && rnd() < 0.4) {
        ctx.fillRect(l + w * 0.5 - 0.6, top - 26, 1.2, 26);
        glow(ctx, l + w * 0.5, top - 26, 5, '#ff4a6a', 0.9);
      }
      if (o.tanks && rnd() < 0.35) {
        const tx = l + w * (0.25 + rnd() * 0.4);
        rr(ctx, tx - 6, top - 14, 12, 10, 2); ctx.fillStyle = shade(col, -0.1); ctx.fill();
        ctx.fillRect(tx - 5, top - 4, 1.2, 4); ctx.fillRect(tx + 3.8, top - 4, 1.2, 4);
        ctx.beginPath(); ctx.moveTo(tx - 7, top - 14); ctx.lineTo(tx, top - 19); ctx.lineTo(tx + 7, top - 14); ctx.fill();
      }
      if (o.rim) { ctx.fillStyle = rgba(o.rim, 0.55); ctx.fillRect(l, top, w, 1.2); ctx.fillRect(l, top, 1, h); }
      windows(ctx, l + 2, top + (step ? 2 : 4), w - 4, h - 8, rnd, o);
    });
  }
}

function shopFront(ctx, S, x, by, w, h, col, rnd, NEONS) {
  const top = by - h;
  rr(ctx, x, top, w, h + 6, 2);
  paint(ctx, lgY(ctx, [[top, shade(col, 0.1)], [by, shade(col, -0.08)]]), 2);
  // corniche
  rr(ctx, x - 3, top - 4, w + 6, 6, 1.5); paint(ctx, shade(col, 0.15), 1.6);
  // fenêtres d'étage
  const n = Math.max(2, Math.floor(w / 22));
  for (let i = 0; i < n; i++) {
    const wx = x + 8 + i * (w - 16) / n, ww = (w - 16) / n - 6;
    const lit = rnd() < 0.7;
    rr(ctx, wx, top + 8, ww, 12, 1.5);
    paint(ctx, lit ? lgY(ctx, [[top + 8, '#fff0b0'], [top + 20, '#ffb86a']]) : '#2a1858', 1.4);
    if (lit && rnd() < 0.3) { // silhouette de chat à la fenêtre
      ctx.fillStyle = rgba('#3a1a4a', 0.85);
      ctx.beginPath(); ctx.arc(wx + ww / 2, top + 17, 3, Math.PI, 0); ctx.lineTo(wx + ww / 2 + 3, top + 20); ctx.lineTo(wx + ww / 2 - 3, top + 20); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + ww / 2 - 3, top + 16); ctx.lineTo(wx + ww / 2 - 2.6, top + 12.5); ctx.lineTo(wx + ww / 2 - 0.8, top + 15); ctx.moveTo(wx + ww / 2 + 3, top + 16); ctx.lineTo(wx + ww / 2 + 2.6, top + 12.5); ctx.lineTo(wx + ww / 2 + 0.8, top + 15); ctx.fill();
    }
  }
  // vitrine + store rayé
  const sy = top + 26;
  if (h > 40) {
    const sw = w - 14, sh = by - sy - 4;
    rr(ctx, x + 7, sy + 8, sw, sh - 6, 1.5);
    paint(ctx, lgY(ctx, [[sy + 8, '#ffe6a0'], [by, '#ff9a6a']]), 1.4);
    ctx.save(); rr(ctx, x + 7, sy + 8, sw, sh - 6, 1.5); ctx.clip();
    ctx.fillStyle = rgba('#ffffff', 0.25);
    ctx.beginPath(); ctx.moveTo(x + 14, sy + 8); ctx.lineTo(x + 22, sy + 8); ctx.lineTo(x + 10, by); ctx.lineTo(x + 2, by); ctx.fill();
    ctx.restore();
    const ac = S.pick(NEONS);
    ctx.beginPath();
    ctx.moveTo(x + 3, sy); ctx.lineTo(x + w - 3, sy); ctx.lineTo(x + w, sy + 9);
    const k = Math.max(3, Math.round(w / 12));
    for (let i = k; i > 0; i--) { const xa = x + (w * i) / k, xb = x + (w * (i - 1)) / k; ctx.quadraticCurveTo((xa + xb) / 2, sy + 13, xb, sy + 9); }
    ctx.closePath();
    ctx.save(); ctx.fillStyle = ac; ctx.fill(); ctx.clip();
    ctx.fillStyle = rgba('#ffffff', 0.7);
    for (let i = 0; i < k; i += 2) ctx.fillRect(x + (w * i) / k, sy - 2, w / k, 16);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(x + 3, sy); ctx.lineTo(x + w - 3, sy); ctx.lineTo(x + w, sy + 9);
    for (let i = k; i > 0; i--) { const xa = x + (w * i) / k, xb = x + (w * (i - 1)) / k; ctx.quadraticCurveTo((xa + xb) / 2, sy + 13, xb, sy + 9); }
    ctx.closePath(); paint(ctx, null, 1.6);
  }
}

function streetLamp(ctx, x, by, s) {
  const h = 86 * s;
  glow(ctx, x + 10 * s, by - h + 6 * s, 46 * s, '#ffe9a0', 0.55);
  rr(ctx, x - 2.2 * s, by - h, 4.4 * s, h, 1.5); paint(ctx, '#3a2a6a', 1.8);
  ctx.beginPath(); ctx.moveTo(x, by - h + 2); ctx.quadraticCurveTo(x, by - h - 8 * s, x + 12 * s, by - h - 6 * s);
  strokeLine(ctx, OUT, 5 * s); ctx.beginPath(); ctx.moveTo(x, by - h + 2); ctx.quadraticCurveTo(x, by - h - 8 * s, x + 12 * s, by - h - 6 * s); strokeLine(ctx, '#4a3a7a', 2.2 * s);
  poly(ctx, [[x + 6 * s, by - h - 6 * s], [x + 18 * s, by - h - 6 * s], [x + 15 * s, by - h], [x + 9 * s, by - h]]);
  paint(ctx, '#4a3a7a', 1.6);
  ell(ctx, x + 12 * s, by - h + 0.5, 4 * s, 2 * s); ctx.fillStyle = '#fff6c8'; ctx.fill();
  rr(ctx, x - 4 * s, by - 8 * s, 8 * s, 8 * s, 1.5); paint(ctx, '#3a2a6a', 1.6);
}

function neonSign(ctx, S, x, by, kind, col) {
  const h = 100;
  rr(ctx, x - 2, by - h + 30, 4, h - 30, 1.5); paint(ctx, '#2e2058', 1.8);
  const bw = kind === 'text' ? 66 : 46, bh = 40, bx = x - bw / 2, byy = by - h - 6;
  glow(ctx, x, byy + bh / 2, 60, col, 0.35);
  rr(ctx, bx, byy, bw, bh, 6); paint(ctx, '#1a0c3e', 2);
  rr(ctx, bx + 3, byy + 3, bw - 6, bh - 6, 4); neonStroke(ctx, S, col, 0.7);
  const cx = x, cy = byy + bh / 2;
  ctx.beginPath();
  if (kind === 'cat') {
    ctx.moveTo(cx - 11, cy + 9);
    ctx.quadraticCurveTo(cx - 14, cy - 2, cx - 10, cy - 7);
    ctx.lineTo(cx - 11, cy - 15); ctx.lineTo(cx - 4, cy - 10);
    ctx.quadraticCurveTo(cx, cy - 11, cx + 4, cy - 10);
    ctx.lineTo(cx + 11, cy - 15); ctx.lineTo(cx + 10, cy - 7);
    ctx.quadraticCurveTo(cx + 14, cy - 2, cx + 11, cy + 9);
    ctx.quadraticCurveTo(cx, cy + 13, cx - 11, cy + 9);
    ctx.moveTo(cx - 6, cy - 1); ctx.quadraticCurveTo(cx - 4, cy - 3.5, cx - 2, cy - 1);
    ctx.moveTo(cx + 2, cy - 1); ctx.quadraticCurveTo(cx + 4, cy - 3.5, cx + 6, cy - 1);
    ctx.moveTo(cx - 2, cy + 4); ctx.quadraticCurveTo(cx, cy + 6, cx + 2, cy + 4);
    ctx.moveTo(cx - 9, cy + 3); ctx.lineTo(cx - 17, cy + 1); ctx.moveTo(cx + 9, cy + 3); ctx.lineTo(cx + 17, cy + 1);
  } else if (kind === 'fish') {
    ctx.moveTo(cx - 12, cy);
    ctx.quadraticCurveTo(cx - 2, cy - 11, cx + 10, cy);
    ctx.quadraticCurveTo(cx - 2, cy + 11, cx - 12, cy);
    ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 17, cy - 7); ctx.lineTo(cx + 17, cy + 7); ctx.closePath();
    ctx.moveTo(cx - 6, cy - 2); ctx.arc(cx - 6.5, cy - 2, 0.6, 0, TAU);
    ctx.moveTo(cx - 1, cy - 5); ctx.quadraticCurveTo(cx + 2, cy, cx - 1, cy + 5);
  }
  if (kind !== 'text') neonStroke(ctx, S, col, 1.1);
  else {
    ctx.save();
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = col; ctx.shadowBlur = 10 * S.res;
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.strokeText('MIAOU', cx, cy + 1);
    ctx.shadowBlur = 4 * S.res;
    ctx.fillStyle = mix(col, '#ffffff', 0.6); ctx.fillText('MIAOU', cx, cy + 1);
    ctx.restore();
  }
  // supports
  ctx.beginPath(); ctx.moveTo(bx + 8, byy + bh); ctx.lineTo(x - 2, byy + bh + 10); ctx.moveTo(bx + bw - 8, byy + bh); ctx.lineTo(x + 2, byy + bh + 10);
  strokeLine(ctx, '#2e2058', 2);
}

function cone(ctx, x, by, s) {
  poly(ctx, [[x - 11 * s, by], [x - 3 * s, by - 22 * s], [x + 3 * s, by - 22 * s], [x + 11 * s, by]]);
  paint(ctx, vgrad(ctx, by - 22 * s, by, '#ff7a2a', 0.2, 0.2), 2);
  ctx.save(); poly(ctx, [[x - 11 * s, by], [x - 3 * s, by - 22 * s], [x + 3 * s, by - 22 * s], [x + 11 * s, by]]); ctx.clip();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 12 * s, by - 15 * s, 24 * s, 4 * s); ctx.fillRect(x - 12 * s, by - 8 * s, 24 * s, 3.5 * s);
  ctx.restore();
  rr(ctx, x - 14 * s, by - 2 * s, 28 * s, 4 * s, 1.5); paint(ctx, '#e8602a', 1.8);
  glow(ctx, x, by + 2, 16 * s, '#ff7a2a', 0.3);
}
function fishBone(ctx, x, y, s, col) {
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y); ctx.lineTo(x + 10 * s, y);
  for (let i = 0; i < 4; i++) { const xx = x - 6 * s + i * 4 * s; ctx.moveTo(xx, y - 4 * s); ctx.quadraticCurveTo(xx + 1.5 * s, y, xx, y + 4 * s); }
  ctx.moveTo(x + 10 * s, y); ctx.lineTo(x + 15 * s, y - 4 * s); ctx.moveTo(x + 10 * s, y); ctx.lineTo(x + 15 * s, y + 4 * s);
  strokeLine(ctx, OUT, 3.6);
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y); ctx.lineTo(x + 10 * s, y);
  for (let i = 0; i < 4; i++) { const xx = x - 6 * s + i * 4 * s; ctx.moveTo(xx, y - 4 * s); ctx.quadraticCurveTo(xx + 1.5 * s, y, xx, y + 4 * s); }
  ctx.moveTo(x + 10 * s, y); ctx.lineTo(x + 15 * s, y - 4 * s); ctx.moveTo(x + 10 * s, y); ctx.lineTo(x + 15 * s, y + 4 * s);
  strokeLine(ctx, col, 1.5);
  ell(ctx, x - 14 * s, y, 4.5 * s, 4 * s); paint(ctx, col, 1.8);
  ctx.beginPath(); ctx.arc(x - 15 * s, y - 1 * s, 1 * s, 0, TAU); ctx.fillStyle = OUT; ctx.fill();
}
function cardboard(ctx, x, by, s) {
  poly(ctx, [[x - 14 * s, by], [x - 14 * s, by - 16 * s], [x + 14 * s, by - 16 * s], [x + 14 * s, by]]);
  paint(ctx, vgrad(ctx, by - 16 * s, by, '#c8925a', 0.15, 0.2), 2);
  poly(ctx, [[x - 14 * s, by - 16 * s], [x - 20 * s, by - 22 * s], [x - 6 * s, by - 20 * s], [x - 2 * s, by - 16 * s]]);
  paint(ctx, '#d8a26a', 1.8);
  poly(ctx, [[x + 14 * s, by - 16 * s], [x + 19 * s, by - 23 * s], [x + 6 * s, by - 21 * s], [x + 2 * s, by - 16 * s]]);
  paint(ctx, '#b8824a', 1.8);
  ctx.beginPath(); ctx.moveTo(x - 6 * s, by - 9 * s); ctx.lineTo(x + 6 * s, by - 9 * s); strokeLine(ctx, rgba(OUT, 0.5), 1.2);
}

// ------------------------------------------------------------------ Volcan
function volcanoDef() {
  return {
    ambient: 'embers',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#2a0614'], [0.32, '#5c0f1e'], [0.6, '#a8261e'], [0.82, '#ee5a22'], [1, '#ff9a3a']]);
      // nuages de cendre
      for (let i = 0; i < 5; i++) {
        const x = (i + 0.5) * SKY_W / 5 + S.r(-20, 20), y = 40 + (i % 2) * 34 + S.r(-8, 8), w = S.r(80, 120);
        cloud(ctx, x, y, w, w * 0.36, S.rand, '#4a1622', '#e8603a', '#a8322a');
      }
      // petit volcan lointain
      volcanoShape(ctx, 70, 262, 190, 172, 22, '#7a2a2a', S, 0.4);
      // grand volcan
      volcanoShape(ctx, 330, 262, 330, 118, 40, '#5a1a22', S, 1);
    },
    layers: [
      L(120, 172, 0.07, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 238, [[8, 1, 2], [6, 3, 5], [3, 7, 11]]);
        const e = makeEdge(S, f, 16, 3, 12, 'rock');
        ctx.beginPath(); e(ctx); closeDown(ctx, W, 300);
        ctx.fillStyle = lgY(ctx, [[215, '#7a2a2c'], [290, '#a83a28']]); ctx.fill();
        // coulées lointaines
        for (const x of S.spread(4, 0.6)) {
          S.rep(x, 20, (xx, rnd) => {
            ctx.beginPath(); let px = xx, py = f(xx) + 4; ctx.moveTo(px, py);
            for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 8; py += 8; ctx.lineTo(px, py); }
            ctx.save(); ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 6 * S.res; strokeLine(ctx, rgba('#ff8a2a', 0.9), 2); ctx.restore();
          });
        }
        haze(ctx, W, 200, 292, '#ff6a2a', 0.15, 0.35);
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 260, [[2.5, 1, 2], [1.5, 4, 7]]);
        const e = makeEdge(S, fM, 14, 2, 7, 'rock');
        // mares de lave (derrière)
        for (const x of S.spread(2, 0.5)) {
          S.rep(x, 56, (xx) => {
            glow(ctx, xx, fM(xx) - 4, 50, '#ff6a1a', 0.5);
          });
        }
        for (const x of S.spread(4, 0.6)) {
          const s = S.r(0.9, 1.2);
          S.rep(x, 95, (xx, rnd) => deadTree(ctx, xx, fM(xx) + 4, s, rnd, '#3a2026', '#ff8a3a'));
        }
        ctx.beginPath(); e(ctx); closeDown(ctx, W, 300);
        ctx.fillStyle = lgY(ctx, [[248, '#6a3434'], [285, '#4a2428']]); ctx.fill();
        ctx.beginPath(); e(ctx); strokeLine(ctx, rgba(OUT, 0.8), 1.8);
        ctx.save(); ctx.translate(0, 1.8); ctx.beginPath(); e(ctx); strokeLine(ctx, rgba('#ff9a4a', 0.55), 1.4); ctx.restore();
        for (const x of S.spread(5, 0.8)) {
          S.rep(x, 30, (xx, rnd) => rock(ctx, xx, fM(xx) + 10, 26 + rnd() * 16, 14 + rnd() * 8, rnd, '#5a3a3e', { cracks: '#ff7a1a', res: S.res }));
        }
        for (const x of S.spread(2, 0.5)) {
          S.rep(x, 52, (xx) => {
            ell(ctx, xx, fM(xx) + 14, 34, 5.5);
            ctx.save(); ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 10 * S.res;
            paint(ctx, lgY(ctx, [[fM(xx) + 9, '#ffd84a'], [fM(xx) + 19, '#ff6a1a']]), 2);
            ctx.restore();
          });
        }
        haze(ctx, W, 80, 282, '#ff6a3a', 0.08, 0.12);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [13, 1.5, 5, 'rock'], edge2: [12, 1.2, 4, 'rock'],
          fill: [[262, '#7a4440'], [290, '#643636'], [330, '#4e2a2c'], [360, '#3a1e22']],
          fill2: [[300, '#6a3a38'], [330, '#522c2e'], [360, '#3a1e22']],
          shadow: '#1a0a10', rim: rgba('#ff9a4a', 0.85), rim2: rgba('#ff8a3a', 0.6),
          stroke2: rgba(OUT, 0.85),
          path: { fill: [[280, '#a07466'], [296, '#916656'], [312, '#7e5648']], edge: '#4a2a2a' },
          upper(ctx, S, F) {
            scatter(S, 4, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 2, (x, y, rnd) => lavaCrack(ctx, S, x, y, 22, rnd, 0.35), 30);
          },
          pathDeco(ctx, S, F) {
            // dalles
            let x = 0;
            while (x < S.W - 8) {
              let w = S.r(18, 30);
              if (S.W - (x + w) < 18) w = S.W - x;
              const x0 = x, top = S.rand() < 0.5;
              S.rep(x0 + w / 2, w, (xx, rnd) => {
                const y0 = (top ? F.fP0(xx) + 3 : (F.fP0(xx) + F.fP1(xx)) / 2 + 1), y1 = top ? (F.fP0(xx) + F.fP1(xx)) / 2 - 1 : F.fP1(xx) - 1;
                rr(ctx, xx - w / 2 + 1.5, y0, w - 3, y1 - y0, 3);
                ctx.fillStyle = rgba('#c49686', 0.35 + rnd() * 0.2); ctx.fill();
                ctx.strokeStyle = rgba('#5a3430', 0.5); ctx.lineWidth = 1; ctx.stroke();
              });
              x += w;
            }
          },
          lower(ctx, S, F) {
            scatter(S, 7, (x) => F.fP1(x) + 14, () => 352, (x, y, rnd) => lavaCrack(ctx, S, x, y, 34, rnd, 1), 50);
            scatter(S, 30, (x) => F.fP1(x) + 8, () => 358, (x, y, rnd) => { ell(ctx, x, y, 2 + rnd() * 2, 1.2); ctx.fillStyle = rgba('#2a1216', 0.6); ctx.fill(); }, 5);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(5, 0.9)) {
          const kind = S.rand();
          S.rep(x, 40, (xx, rnd) => {
            const by = 352 + rnd() * 5;
            if (kind < 0.6) rock(ctx, xx, by + 6, 30 + rnd() * 10, 14, rnd, '#4e3034', { cracks: '#ff7a1a', res: S.res });
            else {
              glow(ctx, xx, by, 26, '#ff6a1a', 0.55);
              rock(ctx, xx - 9, by + 6, 16, 10, rnd, '#4a2a2e');
              rock(ctx, xx + 9, by + 7, 18, 9, rnd, '#4a2a2e');
              ell(ctx, xx, by + 1, 5, 2); ctx.fillStyle = '#ffd84a'; ctx.fill();
            }
          });
        }
      }, true),
    ],
  };
}

function volcanoShape(ctx, cx, by, bw, top, cw, col, S, k) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, by);
    ctx.quadraticCurveTo(cx - cw * 0.9, by - 8, cx - cw / 2, top);
    ctx.quadraticCurveTo(cx, top + 7, cx + cw / 2, top);
    ctx.quadraticCurveTo(cx + cw * 0.9, by - 8, cx + bw / 2, by);
    ctx.closePath();
  };
  // éruption : lueur et panache
  glow(ctx, cx, top, 90 * k + 20, '#ff8a2a', 0.7);
  const rnd = S.rand;
  // panache de fumée bouillonnant, éclairé par dessous
  const cs = [];
  const n = Math.round(9 * k + 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = (8 + t * 20) * k + 3;
    const px = cx + t * t * 46 * k, py = top - 6 - t * 100 * k;
    cs.push([px, py, r]);
    if (i > 1) cs.push([px - r * 0.8, py + r * 0.35, r * 0.62], [px + r * 0.85, py + r * 0.3, r * 0.6]);
  }
  let pTop = Infinity; for (const c of cs) pTop = Math.min(pTop, c[1] - c[2]);
  blob(ctx, cs, '#3a1420', {
    lw: 0, shift: 0.14, hl: false, dark: mix('#3a1420', '#ff7a2a', 0.55),
    fill: lgY(ctx, [[pTop, '#2a0e18'], [top - 30 * k, '#4a1820'], [top, '#9a3424']]),
  });
  // bombes de lave
  if (k > 0.6) {
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.45 + rnd() * 0.6), d = 34 + rnd() * 40;
      const px = cx + Math.cos(a) * d, py = top - 4 + Math.sin(a) * d * 0.75;
      ctx.beginPath(); ctx.moveTo(cx + side * 4, top - 2); ctx.quadraticCurveTo(cx + Math.cos(a) * d * 0.45, py - 14, px, py);
      strokeLine(ctx, rgba('#ff8a2a', 0.45), 1.6);
      glow(ctx, px, py, 8, '#ffb03a', 0.9);
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fillStyle = '#fff2a0'; ctx.fill();
    }
  }
  path();
  ctx.fillStyle = lgY(ctx, [[top, shade(col, 0.12)], [by, shade(col, -0.15)]]); ctx.fill();
  ctx.save(); path(); ctx.clip();
  // côté ombré
  ctx.beginPath(); ctx.moveTo(cx + cw * 0.1, top); ctx.lineTo(cx + bw, by + 4); ctx.lineTo(cx + bw * 0.1, by + 4); ctx.closePath();
  ctx.fillStyle = rgba('#1a0610', 0.25); ctx.fill();
  // coulées de lave
  ctx.save(); ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 8 * S.res;
  for (let i = 0; i < 3; i++) {
    let px = cx + (i - 1) * cw * 0.3, py = top + 2;
    ctx.beginPath(); ctx.moveTo(px, py);
    const dir = (i - 1) * 0.9 + (rnd() - 0.5) * 0.4;
    for (let j = 0; j < 10; j++) { px += dir * 6 * k + (rnd() - 0.5) * 5 * k; py += 9 * k; ctx.lineTo(px, py); }
    strokeLine(ctx, '#ff7a1a', 3.6 * k + 0.8);
    strokeLine(ctx, '#ffd84a', 1.4 * k + 0.4);
  }
  ctx.restore();
  ctx.restore();
  // lèvre du cratère
  ell(ctx, cx, top + 1, cw * 0.5, 3.2 * k + 1);
  ctx.fillStyle = '#ffcf4a'; ctx.fill();
  if (k < 0.6) { path(); ctx.fillStyle = rgba('#c04a3a', 0.35); ctx.fill(); }
}

function lavaCrack(ctx, S, x, y, len, rnd, k) {
  const pts = [[x - len / 2, y]];
  let px = x - len / 2, py = y;
  const n = 5;
  for (let i = 0; i < n; i++) { px += len / n; py = y + (rnd() - 0.5) * 6 * k; pts.push([px, py]); }
  ctx.save();
  ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 8 * S.res * k;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  const b = pts[2];
  ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] + 5, b[1] + 6 * k); ctx.lineTo(b[0] + 10, b[1] + 7 * k);
  const c = pts[4];
  ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + 3, c[1] - 5 * k);
  strokeLine(ctx, '#2a1014', 4.2 * k + 1);
  strokeLine(ctx, '#ff6a1a', 2.6 * k + 0.4);
  ctx.shadowBlur = 0;
  strokeLine(ctx, '#ffe07a', 1 * k + 0.3);
  ctx.restore();
}

// ------------------------------------------------------------------ Cosmos
function cosmosDef() {
  return {
    ambient: 'stars',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#08051e'], [0.38, '#1a0e48'], [0.7, '#3a1c7e'], [1, '#6a3ab2']]);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const neb = [['#ff4fc8', 0.22], ['#3ad0ff', 0.2], ['#9a5aff', 0.25], ['#ff7a9a', 0.15]];
      for (let i = 0; i < 26; i++) {
        const [c, a] = neb[i % neb.length];
        const t = i / 26;
        const x = 40 + t * 420 + S.r(-30, 30), y = 120 + Math.sin(t * 5.5) * 50 + S.r(-25, 25), r = S.r(40, 90);
        glow(ctx, x, y, r, c, a);
      }
      ctx.restore();
      for (let i = 0; i < 220; i++) {
        const x = S.r(0, SKY_W), y = S.r(0, 300), r = 0.3 + Math.pow(S.rand(), 3) * 1.3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba(S.pick(['#ffffff', '#cfe8ff', '#ffe0f6']), S.r(0.45, 1)); ctx.fill();
        if (r > 1.25) { glow(ctx, x, y, r * 6, '#ffffff', 0.35); sparkle(ctx, x, y, r * 4, '#ffffff', 0.8); }
      }
      // galaxie spirale
      ctx.save(); ctx.translate(150, 62); ctx.rotate(-0.4); ctx.scale(1, 0.42);
      glow(ctx, 0, 0, 34, '#ffd0ff', 0.5);
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 40; i++) {
        const a = arm * Math.PI + i * 0.15, d = 3 + i * 0.75;
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.6 - i * 0.03, 0, TAU); ctx.fillStyle = rgba('#ffe6ff', 0.55 - i * 0.012); ctx.fill();
      }
      ctx.restore();
      // planète à anneaux
      ringedPlanet(ctx, 372, 92, 28);
      // planète-chat
      catPlanet(ctx, 112, 142, 16);
      // étoile filante
      ctx.beginPath(); ctx.moveTo(250, 30); ctx.lineTo(300, 48);
      const g = ctx.createLinearGradient(250, 30, 300, 48); g.addColorStop(0, rgba('#ffffff', 0)); g.addColorStop(1, rgba('#ffffff', 0.9));
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
      sparkle(ctx, 300, 48, 4, '#ffffff', 1);
    },
    layers: [
      L(90, 202, 0.05, (ctx, S) => {
        const W = S.W;
        for (const x of S.spread(7, 0.8)) {
          const y = S.r(150, 230), w = S.r(22, 46);
          S.rep(x, w * 1.3, (xx, rnd) => {
            glow(ctx, xx, y + w * 0.2, w, '#8a5aff', 0.35);
            island(ctx, xx, y, w, rnd, '#7a64d0', '#4a3a9a');
            for (let k = 0; k < 2; k++) crystal(ctx, xx + (k - 0.5) * w * 0.3, y - w * 0.08, w * 0.3, w * 0.07, (k - 0.5) * 0.5, k ? '#7af0ff' : '#ff9ae6', { lw: 0 });
          });
        }
        const f = wave(S, 262, [[8, 1, 2], [5, 3, 5]]);
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[245, '#5a44b0'], [290, '#4a3698']]); ctx.fill();
        haze(ctx, W, 90, 292, '#6a4ac8', 0.35, 0.2);
      }),
      L(110, 182, 0.15, (ctx, S) => {
        const W = S.W;
        for (const x of S.spread(3, 0.5)) {
          const y = S.r(170, 200), w = S.r(70, 100);
          S.rep(x, w * 1.1, (xx, rnd) => {
            glow(ctx, xx, y + w * 0.3, w * 0.9, '#48e1ff', 0.25);
            island(ctx, xx, y, w, rnd, '#9a84ff', '#5a48b8', { lw: 1.6 });
            const cols = ['#48e1ff', '#ff6ad8', '#b48aff'];
            crystalCluster(ctx, S, xx + w * 0.12, y - w * 0.06, 0.8, cols, rnd, { n: 3, lw: 1.5 });
            crystalCluster(ctx, S, xx - w * 0.22, y - w * 0.05, 0.55, [cols[1], cols[2]], rnd, { n: 2, lw: 1.3, glow: false });
            // filets lumineux sous l'île
            ctx.beginPath(); ctx.moveTo(xx - 4, y + w * 0.4); ctx.lineTo(xx - 4, y + w * 0.6); ctx.moveTo(xx + 8, y + w * 0.3); ctx.lineTo(xx + 8, y + w * 0.45);
            strokeLine(ctx, rgba('#7af0ff', 0.5), 1.2);
          });
        }
        const f = wave(S, 266, [[6, 1, 2], [4, 3, 5], [2, 7, 11]]);
        const e = makeEdge(S, f, 18, 3, 9, 'rock');
        ctx.beginPath(); e(ctx); closeDown(ctx, W, 300);
        ctx.fillStyle = lgY(ctx, [[250, '#4c3aa0'], [292, '#3a2a86']]); ctx.fill();
        ctx.save(); ctx.translate(0, 1.4); ctx.beginPath(); e(ctx); strokeLine(ctx, rgba('#9ae8ff', 0.6), 1.4); ctx.restore();
        haze(ctx, W, 110, 292, '#5a3aa8', 0.15, 0.1);
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 262, [[2.5, 1, 2], [1.5, 4, 7]]);
        const cols = [['#48e1ff', '#8ff0ff', '#2fb8e8'], ['#ff6ad8', '#ffa8ec', '#d84ab8'], ['#b48aff', '#d8c0ff', '#8a5ae0']];
        // piliers anciens à oreilles
        for (const x of S.spread(2, 0.5)) S.rep(x, 30, (xx) => catPillar(ctx, xx, fM(xx) + 6, 1));
        const e = makeEdge(S, fM, 15, 2, 6, 'rock');
        ctx.beginPath(); e(ctx); closeDown(ctx, W, 300);
        ctx.fillStyle = lgY(ctx, [[250, '#5040a8'], [285, '#3a2c88']]); ctx.fill();
        ctx.beginPath(); e(ctx); strokeLine(ctx, rgba(OUT, 0.8), 1.8);
        ctx.save(); ctx.translate(0, 1.6); ctx.beginPath(); e(ctx); strokeLine(ctx, rgba('#7af0ff', 0.6), 1.3); ctx.restore();
        S.spread(5, 0.6).forEach((x, i) => {
          const s = S.r(1.1, 1.6);
          S.rep(x, 75, (xx, rnd) => crystalCluster(ctx, S, xx, fM(xx) + 8, s, cols[i % 3], rnd, { n: 3 + Math.floor(rnd() * 2) }));
        });
        // rochers flottants
        for (const x of S.spread(6, 0.9)) {
          const y = S.r(170, 225), w = S.r(10, 18);
          S.rep(x, w * 2, (xx, rnd) => {
            glow(ctx, xx, y + w * 0.4, w * 1.6, '#48e1ff', 0.3);
            island(ctx, xx, y, w, rnd, '#8a74e8', '#5040a8', { lw: 1.4 });
          });
        }
        haze(ctx, W, 80, 282, '#4a2a98', 0.1, 0.06);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [13, 1.5, 4.5, 'rock'], edge2: [12, 1, 3.5, 'rock'],
          fill: [[262, '#6a58c8'], [290, '#5240a8'], [330, '#3e2e8a'], [360, '#2c1f68']],
          fill2: [[300, '#5a48b8'], [330, '#433294'], [360, '#2c1f68']],
          shadow: '#120838', rim: rgba('#7af0ff', 0.95), rim2: rgba('#b8a8ff', 0.7),
          stroke2: rgba(OUT, 0.8),
          path: { fill: [[280, '#c6b8ff'], [296, '#ab98ff'], [312, '#9280f0']], edge: '#5a48c0' },
          upper(ctx, S, F) {
            scatter(S, 26, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 1, (x, y, rnd) => { glow(ctx, x, y, 4, '#9ae8ff', 0.7); }, 4);
          },
          pathDeco(ctx, S, F) {
            // dalles de cristal
            let x = 0;
            while (x < S.W - 6) {
              const w = 30;
              S.rep(x + w / 2, w, (xx, rnd) => {
                const y0 = F.fP0(xx) + 2.5, y1 = F.fP1(xx) + 1;
                const l = xx - w / 2 + 1.2, r = xx + w / 2 - 1.2;
                poly(ctx, [[l + 3, y0], [r, y0], [r - 3, y1], [l, y1]]);
                ctx.fillStyle = lgY(ctx, [[y0, rgba('#ffffff', 0.32)], [y1, rgba('#ffffff', 0.04)]]); ctx.fill();
                ctx.strokeStyle = rgba('#7a68e0', 0.75); ctx.lineWidth = 1.1; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(l + 6, y0 + 3); ctx.lineTo(l + 14, y0 + 3); strokeLine(ctx, rgba('#ffffff', 0.7), 1.1);
                if (rnd() < 0.3) sparkle(ctx, l + 8 + rnd() * 14, y0 + 6 + rnd() * 12, 2.4, '#ffffff', 0.9);
              });
              x += w;
            }
          },
          lower(ctx, S, F) {
            scatter(S, 10, (x) => F.fP1(x) + 12, () => 352, (x, y, rnd) => crystalCluster(ctx, S, x, y, 0.45, S.pick([['#48e1ff', '#8ff0ff'], ['#ff6ad8', '#ffa8ec']]), rnd, { n: 2, lw: 1.2 }), 20);
            scatter(S, 40, (x) => F.fP1(x) + 8, () => 358, (x, y, rnd) => { ctx.beginPath(); ctx.arc(x, y, 0.6 + rnd() * 0.8, 0, TAU); ctx.fillStyle = rgba('#d8ccff', 0.8); ctx.fill(); }, 3);
          },
          after(ctx, S, F) {
            // lueur du chemin
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = lgY(ctx, [[278, rgba('#7af0ff', 0)], [284, rgba('#7af0ff', 0.12)], [300, rgba('#7af0ff', 0)]]);
            ctx.fillRect(-5, 278, S.W + 10, 24);
            ctx.restore();
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        const cols = [['#48e1ff', '#8ff0ff', '#2fb8e8'], ['#ff6ad8', '#ffa8ec', '#d84ab8'], ['#b48aff', '#d8c0ff', '#8a5ae0']];
        S.spread(5, 0.9).forEach((x, i) => {
          S.rep(x, 40, (xx, rnd) => {
            const by = 356 + rnd() * 4;
            if (i % 2) {
              rock(ctx, xx, by + 4, 32, 13, rnd, '#4a3aa0');
              crystalCluster(ctx, S, xx + 6, by - 4, 0.6, cols[i % 3], rnd, { n: 2, glowR: 0.8 });
            } else crystalCluster(ctx, S, xx, by + 2, 1.0, cols[i % 3], rnd, { n: 3, glowR: 0.75 });
          });
        });
      }, true),
    ],
  };
}

function ringedPlanet(ctx, x, y, r) {
  glow(ctx, x, y, r * 2.6, '#ff9ad0', 0.35);
  const ring = (front) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.32);
    ctx.beginPath();
    if (front) ctx.ellipse(0, 0, r * 1.85, r * 0.48, 0, 0, Math.PI);
    else ctx.ellipse(0, 0, r * 1.85, r * 0.48, 0, Math.PI, TAU);
    ctx.strokeStyle = rgba('#ffe0b0', 0.95); ctx.lineWidth = r * 0.22; ctx.stroke();
    ctx.strokeStyle = rgba('#ffb0d8', 0.7); ctx.lineWidth = r * 0.07; ctx.stroke();
    ctx.restore();
  };
  ring(false);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = ball(ctx, x, y, r, '#ff8aa8', 0.35, 0.4); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.ellipse(x, y + i * r * 0.36, r * 1.2, r * 0.08, -0.32, 0, TAU);
    ctx.fillStyle = rgba(i % 2 ? '#ffd0a0' : '#c84a88', 0.45); ctx.fill();
  }
  ctx.fillStyle = rgba('#1a0a40', 0.3);
  ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.45, r * 1.05, 0, TAU); ctx.fill();
  ctx.restore();
  gloss(ctx, x - r * 0.4, y - r * 0.45, r * 0.3, r * 0.14, 0.5);
  ring(true);
}
function catPlanet(ctx, x, y, r) {
  glow(ctx, x, y, r * 2.8, '#7af0ff', 0.3);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y - r * 0.5);
  ctx.lineTo(x - r * 0.75, y - r * 1.45);
  ctx.lineTo(x - r * 0.15, y - r * 0.98);
  ctx.lineTo(x + r * 0.15, y - r * 0.98);
  ctx.lineTo(x + r * 0.75, y - r * 1.45);
  ctx.lineTo(x + r * 0.85, y - r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#8acff0'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = ball(ctx, x, y, r, '#8ad8ff', 0.4, 0.4); ctx.fill();
  ctx.fillStyle = rgba('#3a6aa8', 0.35);
  for (const [dx, dy, rr2] of [[-0.35, 0.2, 0.22], [0.3, -0.25, 0.16], [0.2, 0.45, 0.12]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr2 * r, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = rgba('#1a0a40', 0.3); ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.4, r * 1.05, 0, TAU); ctx.fill();
  ctx.restore();
  gloss(ctx, x - r * 0.4, y - r * 0.4, r * 0.3, r * 0.14, 0.55);
}
function catPillar(ctx, x, by, s) {
  const w = 12 * s, h = 70 * s;
  glow(ctx, x, by - h - 6, 26, '#7af0ff', 0.4);
  rr(ctx, x - w / 2, by - h, w, h + 4, 2);
  paint(ctx, lgY(ctx, [[by - h, '#a898f0'], [by, '#6a58c0']]), 1.8);
  ctx.beginPath(); for (let k = 1; k < 5; k++) { ctx.moveTo(x - w / 2 + 2, by - h + k * h / 5); ctx.lineTo(x + w / 2 - 2, by - h + k * h / 5 + 2); } strokeLine(ctx, rgba('#4a3a98', 0.6), 1);
  rr(ctx, x - w / 2 - 3, by - h - 5, w + 6, 6, 1.5); paint(ctx, '#b8a8ff', 1.6);
  poly(ctx, [[x - w / 2 - 2, by - h - 5], [x - w / 2, by - h - 15], [x - 1, by - h - 5]]); paint(ctx, '#b8a8ff', 1.6);
  poly(ctx, [[x + w / 2 + 2, by - h - 5], [x + w / 2, by - h - 15], [x + 1, by - h - 5]]); paint(ctx, '#b8a8ff', 1.6);
  ctx.beginPath(); ctx.arc(x, by - h - 10, 3, 0, TAU); ctx.fillStyle = '#c8f8ff'; ctx.fill();
}

// ------------------------------------------------------------------ Toits de Paris
function roofsDef() {
  const BULBS = ['#ffd27a', '#ff7aa8', '#7af0ff', '#b6ff7a', '#ffb05a'];
  return {
    ambient: 'fireflies',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#33206a'], [0.14, '#5a3490'], [0.28, '#a24e9e'], [0.4, '#ec7488'], [0.5, '#ff9a6c'], [0.62, '#ffbc72'], [1, '#ffd890']]);
      for (let i = 0; i < 60; i++) {
        const x = S.r(0, SKY_W), y = Math.pow(S.rand(), 1.8) * 140, r = S.r(0.4, 1.2);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba('#ffffff', S.r(0.3, 0.9) * (1 - y / 160)); ctx.fill();
      }
      // grande lune
      glow(ctx, 362, 84, 120, '#ffe8c8', 0.45);
      ctx.beginPath(); ctx.arc(362, 84, 34, 0, TAU);
      ctx.fillStyle = ball(ctx, 362, 84, 34, '#fff1d0', 0.2, 0.12); ctx.fill();
      ctx.fillStyle = rgba('#e8c8a8', 0.5);
      for (const [dx, dy, r] of [[-10, -8, 7], [12, 6, 5], [-4, 14, 4], [14, -14, 3.5], [-18, 8, 3]]) { ctx.beginPath(); ctx.arc(362 + dx, 84 + dy, r, 0, TAU); ctx.fill(); }
      // nuages étirés
      for (let i = 0; i < 5; i++) {
        const x = S.r(0, SKY_W), y = S.r(110, 190), w = S.r(60, 140);
        ell(ctx, x, y, w, 3.5 + S.rand() * 3); ctx.fillStyle = rgba(S.pick(['#ffb8c8', '#ffd0a8', '#e890b8']), 0.55); ctx.fill();
      }
      // tour Eiffel (toile de fond fixe)
      eiffel(ctx, 118, 252, 178, '#8a4a90');
    },
    layers: [
      L(80, 212, 0.06, (ctx, S) => {
        const W = S.W;
        const col = '#8a4e94';
        const ex = S.r(0, W);
        S.rep(ex, 50, (xx) => domeChurch(ctx, xx, 214, 1.2, '#8c5096'));
        parisRow(ctx, S, 248, [50, 90], [30, 52], col, { lit: 0.12, ch: true });
        ctx.fillStyle = '#8a4e94'; ctx.fillRect(-5, 250, W + 10, 50);
        haze(ctx, W, 80, 292, '#ffa8a0', 0.12, 0.45);
      }),
      L(120, 172, 0.15, (ctx, S) => {
        const W = S.W;
        parisRow(ctx, S, 268, [56, 92], [40, 74], '#5e3478', { lit: 0.3, ch: true, mansard: '#6a4a90' });
        ctx.fillStyle = '#5e3478'; ctx.fillRect(-5, 266, W + 10, 30);
        haze(ctx, W, 140, 292, '#c86a9a', 0.08, 0.25);
      }),
      L(80, 202, 0.33, (ctx, S) => {
        const W = S.W;
        let x = 0;
        const chimneys = [];
        while (x < W - 20) {
          let w = S.r(110, 170);
          if (W - (x + w) < 100) w = W - x;
          const h = S.r(40, 70);
          const x0 = x;
          const chs = [];
          const nch = S.ri(1, 3);
          for (let k = 0; k < nch; k++) chs.push([x0 + w * (0.15 + 0.7 * (k + 0.5) / nch) + S.r(-8, 8), S.r(18, 30), S.ri(2, 4)]);
          chimneys.push(...chs.map((c) => [c[0], 272 - h - 22, c[1]]));
          S.rep(x0 + w / 2, w, (xx, rnd) => zincRoof(ctx, xx - w / 2, 272, w, h, rnd, chs.map((c) => [c[0] - x0 + xx - w / 2, c[1], c[2]])));
          x += w;
        }
        // guirlandes entre cheminées
        for (let i = 0; i < chimneys.length; i++) {
          const a = chimneys[i], b = chimneys[(i + 1) % chimneys.length];
          let bx = b[0];
          if (bx < a[0]) bx += W;
          if (bx - a[0] > 230 || S.rand() < 0.3) continue;
          const ay = a[1] - a[2] + 4, byy = b[1] - b[2] + 4;
          S.rep((a[0] + bx) / 2, (bx - a[0]) / 2 + 10, (xx) => {
            const off = xx - (a[0] + bx) / 2;
            stringLights(ctx, S, a[0] + off, ay, bx + off, byy, 14, BULBS);
          });
        }
        haze(ctx, W, 80, 282, '#e07aa0', 0.1, 0.06);
      }),
      L(258, 102, 1, (ctx, S) => {
        const W = S.W;
        // pente de zinc derrière la passerelle
        ctx.fillStyle = lgY(ctx, [[264, '#9aa4c8'], [282, '#7a84ac']]);
        ctx.fillRect(-5, 266, W + 10, 18);
        ctx.beginPath();
        for (let x = 0; x <= W + 1; x += W / 64) { ctx.moveTo(x, 270); ctx.lineTo(x, 282); }
        strokeLine(ctx, rgba('#5a6490', 0.6), 1.3);
        ctx.beginPath();
        for (let x = 1.6 - W / 64; x <= W + 2; x += W / 64) { ctx.moveTo(x, 270); ctx.lineTo(x, 282); }
        strokeLine(ctx, rgba('#d8e0ff', 0.45), 0.9);
        // faîtage arrondi
        rr(ctx, -6, 263, W + 12, 7, 3.5);
        paint(ctx, lgY(ctx, [[263, '#d8def5'], [270, '#8a94bc']]), 2.4);
        ctx.beginPath(); ctx.moveTo(-5, 265); ctx.lineTo(W + 5, 265); strokeLine(ctx, rgba('#ffe0c8', 0.85), 1.1);
        // passerelle en planches
        ctx.fillStyle = lgY(ctx, [[282, '#d49a6a'], [306, '#b07a52']]);
        ctx.fillRect(-5, 282, W + 10, 24);
        ctx.beginPath();
        for (const y of [288, 294, 300]) { ctx.moveTo(-5, y); ctx.lineTo(W + 5, y); }
        strokeLine(ctx, rgba('#7a4a2e', 0.45), 1);
        let px = 0;
        ctx.beginPath();
        for (let row = 0; row < 4; row++) {
          px = (row * 23) % 40;
          for (let x = px; x <= W; x += row % 2 ? 45 : 36) { ctx.moveTo(x, 282 + row * 6); ctx.lineTo(x, 288 + row * 6); }
        }
        strokeLine(ctx, rgba('#7a4a2e', 0.5), 1);
        ctx.fillStyle = rgba('#ffd8a8', 0.35); ctx.fillRect(-5, 282, W + 10, 1.6);
        ctx.fillStyle = rgba('#4a2a2a', 0.35); ctx.fillRect(-5, 282, W + 10, 3.5);
        // gouttière
        rr(ctx, -6, 305, W + 12, 11, 5.5);
        paint(ctx, lgY(ctx, [[305, '#e6ecff'], [309, '#aab4d6'], [316, '#6a74a0']]), 2.4);
        ctx.beginPath(); ctx.moveTo(-5, 307.6); ctx.lineTo(W + 5, 307.6); strokeLine(ctx, rgba('#ffffff', 0.8), 1.2);
        for (let x = 20; x < W; x += 75) { rr(ctx, x - 2, 304, 4, 13, 1); paint(ctx, '#5a6490', 1.2); }
        // corniche de pierre
        ctx.fillStyle = lgY(ctx, [[316, '#f3dfc0'], [326, '#e0c49e']]);
        ctx.fillRect(-5, 316, W + 10, 12);
        ctx.fillStyle = '#c9a982';
        for (let x = 2; x < W; x += 9) ctx.fillRect(x, 322, 5, 5);
        ctx.beginPath(); ctx.moveTo(-5, 316.5); ctx.lineTo(W + 5, 316.5); ctx.moveTo(-5, 328); ctx.lineTo(W + 5, 328); strokeLine(ctx, rgba(OUT, 0.7), 1.6);
        // façade + fenêtres éclairées
        ctx.fillStyle = lgY(ctx, [[328, '#ecd2ae'], [360, '#c9a682']]);
        ctx.fillRect(-5, 328, W + 10, 36);
        for (let x = 30; x < W; x += 75) {
          glow(ctx, x + 11, 350, 26, '#ffc86a', 0.45);
          rr(ctx, x, 336, 22, 30, 3); paint(ctx, lgY(ctx, [[336, '#ffe6a0'], [360, '#ffa860']]), 2);
          ctx.beginPath(); ctx.moveTo(x + 11, 336); ctx.lineTo(x + 11, 362); ctx.moveTo(x, 346); ctx.lineTo(x + 22, 346); strokeLine(ctx, rgba(OUT, 0.7), 1.4);
          rr(ctx, x - 4, 333, 30, 4, 1.5); paint(ctx, '#f6e6cc', 1.4);
          // balconnet en fer forgé
          ctx.beginPath(); ctx.moveTo(x - 3, 352); ctx.lineTo(x + 25, 352);
          for (let k = 0; k <= 7; k++) { ctx.moveTo(x - 3 + k * 4, 352); ctx.lineTo(x - 3 + k * 4, 362); }
          strokeLine(ctx, OUT, 1.4);
          ctx.beginPath(); for (let k = 0; k < 7; k++) { ctx.moveTo(x - 1 + k * 4 + 2, 357); ctx.arc(x - 1 + k * 4, 357, 2, 0, TAU); } strokeLine(ctx, rgba(OUT, 0.8), 0.9);
        }
        ctx.fillStyle = lgY(ctx, [[330, rgba('#3a1a3a', 0)], [360, rgba('#3a1a3a', 0.25)]]);
        ctx.fillRect(-5, 330, W + 10, 34);
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(4, 0.8)) {
          const kind = S.rand();
          S.rep(x, 40, (xx, rnd) => {
            const by = 356;
            if (kind < 0.55) flowerBox(ctx, xx, by, rnd);
            else ventPipe(ctx, xx, by + 4, rnd);
          });
        }
      }, true),
    ],
  };
}

function eiffel(ctx, x, by, h, col) {
  const w = h * 0.4;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, by);
  ctx.quadraticCurveTo(x - w * 0.22, by - h * 0.3, x - w * 0.07, by - h * 0.62);
  ctx.lineTo(x - 1.4, by - h * 0.94);
  ctx.lineTo(x, by - h);
  ctx.lineTo(x + 1.4, by - h * 0.94);
  ctx.lineTo(x + w * 0.07, by - h * 0.62);
  ctx.quadraticCurveTo(x + w * 0.22, by - h * 0.3, x + w / 2, by);
  ctx.lineTo(x + w * 0.27, by);
  ctx.quadraticCurveTo(x, by - h * 0.36, x - w * 0.27, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - w * 0.31, by - h * 0.3, w * 0.62, 3);
  ctx.fillRect(x - w * 0.15, by - h * 0.62, w * 0.3, 2.4);
  // treillis lumineux
  ctx.save();
  ctx.beginPath();
  for (let k = 1; k < 9; k++) {
    const yy = by - h * 0.08 * k;
    const ww = (w / 2) * (1 - k / 11);
    ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww * 0.5, yy - h * 0.06);
    ctx.moveTo(x + ww, yy); ctx.lineTo(x - ww * 0.5, yy - h * 0.06);
  }
  strokeLine(ctx, rgba('#ffd8a0', 0.25), 0.8);
  ctx.restore();
  glow(ctx, x, by - h, 8, '#ffe0a0', 0.9);
}
function domeChurch(ctx, x, by, s, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x - 30 * s, by - 20 * s, 60 * s, 40 * s);
  ctx.beginPath(); ctx.arc(x, by - 20 * s, 16 * s, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - 1.5 * s, by - 44 * s, 3 * s, 10 * s);
  for (const dx of [-22, 22]) { ctx.beginPath(); ctx.arc(x + dx * s, by - 20 * s, 7 * s, Math.PI, 0); ctx.fill(); ctx.fillRect(x + dx * s - 1 * s, by - 32 * s, 2 * s, 6 * s); }
}
function parisRow(ctx, S, by, hR, wR, col, o) {
  const W = S.W;
  let x = 0;
  while (x < W) {
    let w = S.r(wR[0], wR[1]);
    if (W - (x + w) < wR[0]) w = W - x;
    const h = S.r(hR[0], hR[1]);
    const x0 = x;
    S.rep(x0 + w / 2, w, (xx, rnd) => {
      const l = xx - w / 2, top = by - h;
      ctx.fillStyle = col;
      ctx.fillRect(l, top, w + 0.6, h + 40);
      // toit mansardé
      const mh = 10 + rnd() * 6;
      ctx.fillStyle = o.mansard || shade(col, 0.06);
      poly(ctx, [[l - 1, top], [l + 5, top - mh], [l + w - 5, top - mh], [l + w + 1, top]]);
      ctx.fill();
      // lucarnes
      if (o.mansard) {
        for (let k = 0; k < Math.floor(w / 18); k++) {
          const dx = l + 10 + k * 18;
          if (dx > l + w - 10) break;
          ctx.fillStyle = o.mansard;
          ctx.fillRect(dx - 3, top - mh - 3, 7, 8);
          ctx.beginPath(); ctx.moveTo(dx - 4, top - mh - 3); ctx.lineTo(dx + 0.5, top - mh - 7); ctx.lineTo(dx + 5, top - mh - 3); ctx.fill();
          if (rnd() < 0.5) { ctx.fillStyle = '#ffc86a'; ctx.fillRect(dx - 1.5, top - mh - 1, 4, 5); }
        }
      }
      // cheminées
      if (o.ch) {
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const cx = l + 6 + rnd() * (w - 16);
          ctx.fillStyle = o.mansard ? shade(col, 0.02) : col;
          ctx.fillRect(cx, top - mh - 8 - rnd() * 6, 7, 14);
          ctx.fillRect(cx - 1, top - mh - 10, 9, 2.5);
        }
      }
      // fenêtres
      const cols = Math.max(1, Math.floor((w - 6) / 10)), rows = Math.max(1, Math.floor((h - 6) / 12));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (rnd() < o.lit) {
          ctx.fillStyle = rnd() < 0.7 ? '#ffc86a' : '#ffe6a8';
          ctx.fillRect(l + 5 + c * 10, top + 5 + r * 12, 4, 6);
        }
      }
    });
    x += w;
  }
}
function zincRoof(ctx, x, by, w, h, rnd, chs) {
  const top = by - h;
  // cheminées derrière
  for (const [cx, ch, pots] of chs) {
    const cw = 14 + pots * 4;
    rr(ctx, cx - cw / 2, top - ch, cw, ch + 10, 1.5);
    paint(ctx, lgY(ctx, [[top - ch, '#e09a78'], [top, '#b86a52']]), 2);
    ctx.beginPath();
    for (let y = top - ch + 6; y < top; y += 6) { ctx.moveTo(cx - cw / 2 + 1, y); ctx.lineTo(cx + cw / 2 - 1, y); }
    strokeLine(ctx, rgba('#8a4a3a', 0.35), 0.9);
    rr(ctx, cx - cw / 2 - 2, top - ch - 3, cw + 4, 4, 1.5); paint(ctx, '#f0c0a0', 1.6);
    for (let k = 0; k < pots; k++) {
      const px = cx - cw / 2 + 4 + k * ((cw - 8) / Math.max(1, pots - 1 || 1));
      rr(ctx, px - 2.4, top - ch - 10, 4.8, 8, 1.2); paint(ctx, '#e8783a', 1.4);
    }
    if (rnd() < 0.5) { // antenne
      const ax = cx + cw / 2 - 3;
      ctx.beginPath(); ctx.moveTo(ax, top - ch - 3); ctx.lineTo(ax, top - ch - 30);
      for (let k = 0; k < 3; k++) { ctx.moveTo(ax - 8 + k * 2, top - ch - 28 + k * 6); ctx.lineTo(ax + 8 - k * 2, top - ch - 28 + k * 6); }
      strokeLine(ctx, OUT, 1.4);
    }
  }
  // toit mansardé en zinc
  poly(ctx, [[x, by + 4], [x + 3, top + 8], [x + 12, top], [x + w - 12, top], [x + w - 3, top + 8], [x + w, by + 4]]);
  paint(ctx, lgY(ctx, [[top, '#a8b2d6'], [by, '#6e7aa6']]), 2);
  ctx.save();
  poly(ctx, [[x, by + 4], [x + 3, top + 8], [x + 12, top], [x + w - 12, top], [x + w - 3, top + 8], [x + w, by + 4]]);
  ctx.clip();
  ctx.beginPath();
  for (let xx = x + 8; xx < x + w; xx += 9) { ctx.moveTo(xx, top); ctx.lineTo(xx, by + 4); }
  strokeLine(ctx, rgba('#4a5480', 0.45), 1);
  ctx.beginPath(); ctx.moveTo(x, top + 1.5); ctx.lineTo(x + w, top + 1.5); strokeLine(ctx, rgba('#ffe0d0', 0.6), 1.5);
  ctx.restore();
  // lucarnes éclairées
  const n = Math.max(1, Math.floor(w / 42));
  for (let k = 0; k < n; k++) {
    const dx = x + w * (k + 0.5) / n, dy = top + h * 0.35;
    const lit = rnd() < 0.75;
    if (lit) glow(ctx, dx, dy + 8, 20, '#ffc86a', 0.4);
    ctx.beginPath(); ctx.moveTo(dx - 10, dy + 16); ctx.lineTo(dx - 10, dy); ctx.quadraticCurveTo(dx, dy - 12, dx + 10, dy); ctx.lineTo(dx + 10, dy + 16); ctx.closePath();
    paint(ctx, '#e8e2f2', 1.8);
    rr(ctx, dx - 6, dy - 1, 12, 15, 5); paint(ctx, lit ? lgY(ctx, [[dy, '#ffe8a8'], [dy + 14, '#ffa860']]) : '#4a4878', 1.4);
    ctx.beginPath(); ctx.moveTo(dx, dy - 1); ctx.lineTo(dx, dy + 14); ctx.moveTo(dx - 6, dy + 6); ctx.lineTo(dx + 6, dy + 6); strokeLine(ctx, rgba(OUT, 0.6), 1);
    if (lit && rnd() < 0.35) { // chat à la lucarne
      ctx.fillStyle = rgba('#2b1838', 0.85);
      ctx.beginPath(); ctx.arc(dx + 2.5, dy + 11, 2.6, Math.PI, 0); ctx.lineTo(dx + 5.1, dy + 14); ctx.lineTo(dx - 0.1, dy + 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(dx + 0.1, dy + 10.5); ctx.lineTo(dx + 0.4, dy + 7.5); ctx.lineTo(dx + 1.8, dy + 9); ctx.moveTo(dx + 4.9, dy + 10.5); ctx.lineTo(dx + 4.6, dy + 7.5); ctx.lineTo(dx + 3.2, dy + 9); ctx.fill();
    }
  }
}
function flowerBox(ctx, x, by, rnd) {
  const cols = ['#ff4a5a', '#ff7aa8', '#ffffff', '#ffd23f'];
  const c = cols[Math.floor(rnd() * cols.length)];
  for (let k = 0; k < 7; k++) {
    const fx = x - 16 + k * 5.4 + rnd() * 2, fy = by - 10 - rnd() * 8;
    blob(ctx, [[fx, fy + 4, 4.5]], '#4fa84a', { lw: 1.4, hl: false });
  }
  for (let k = 0; k < 6; k++) flower(ctx, x - 14 + k * 5.6 + rnd() * 2, by - 13 - rnd() * 7, 2.2, c, '#ffe07a', 1);
  rr(ctx, x - 20, by - 8, 40, 14, 2);
  paint(ctx, vgrad(ctx, by - 8, by + 6, '#d86a3e', 0.2, 0.2), 2);
  ctx.beginPath(); ctx.moveTo(x - 18, by - 4.5); ctx.lineTo(x + 18, by - 4.5); strokeLine(ctx, rgba('#ffd0b0', 0.6), 1.2);
}
function ventPipe(ctx, x, by, rnd) {
  rr(ctx, x - 5, by - 22, 10, 26, 2); paint(ctx, lgY(ctx, [[by - 22, '#c8d0ee'], [by, '#7a84ac']]), 2);
  ctx.beginPath(); ctx.moveTo(x - 9, by - 22); ctx.lineTo(x, by - 30); ctx.lineTo(x + 9, by - 22); ctx.closePath(); paint(ctx, '#9aa4c8', 2);
  rr(ctx, x - 9, by - 23, 18, 3, 1); paint(ctx, '#aab4d6', 1.4);
}

// ------------------------------------------------------------------ Arène
function arenaDef() {
  const TEAM = ['#ff5a7a', '#4ac0ff', '#ffd23f', '#8a6aff'];
  return {
    ambient: 'stars',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#0e0a30'], [0.4, '#22175a'], [0.75, '#3c2678'], [1, '#5a3a90']]);
      for (let i = 0; i < 70; i++) {
        const x = S.r(0, SKY_W), y = Math.pow(S.rand(), 1.5) * 150, r = S.r(0.4, 1.2);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba('#ffffff', S.r(0.3, 0.9)); ctx.fill();
      }
      glow(ctx, 240, 200, 260, '#8a6ad8', 0.35);
    },
    layers: [
      L(30, 262, 0.06, (ctx, S) => {
        const W = S.W;
        const towers = S.spread(3, 0.2);
        // tribunes hautes
        const f = (x) => 126 + 5 * Math.sin(TAU * x / W * 3);
        ctx.fillStyle = lgY(ctx, [[120, '#40307e'], [260, '#2e2264']]);
        ctx.beginPath();
        ctx.moveTo(-6, 300); for (let x = -6; x <= W + 6; x += 3) ctx.lineTo(x, f(x)); ctx.lineTo(W + 6, 300); ctx.closePath(); ctx.fill();
        // toit de la tribune
        ctx.beginPath(); for (let x = -6; x <= W + 6; x += 3) x === -6 ? ctx.moveTo(x, f(x)) : ctx.lineTo(x, f(x));
        strokeLine(ctx, rgba('#9a88e8', 0.6), 2);
        crowd(ctx, S, 138, 7, 14, 3.5, 0.13, ['#5c4ca4', '#52449a', '#6656aa', '#4a3e92'], TEAM, '#3a2c7a');
        // escaliers (cassent la mosaïque)
        for (let x = 40; x < W; x += 150) {
          ctx.fillStyle = '#4a3a8c'; ctx.fillRect(x - 5, 132, 10, 130);
          ctx.beginPath(); for (let y = 136; y < 262; y += 7) { ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); } strokeLine(ctx, rgba('#2a1e60', 0.6), 1);
        }
        // flashs d'appareils
        for (let i = 0; i < 16; i++) {
          const x = S.r(0, W), y = S.r(140, 235);
          S.rep(x, 8, (xx) => { glow(ctx, xx, y, 6, '#ffffff', 0.8); sparkle(ctx, xx, y, 3.2, '#ffffff', 0.95); });
        }
        haze(ctx, W, 120, 292, '#6a50c0', 0.14, 0.32);
        // pylônes et faisceaux (descendant vers l'arène)
        for (const x of towers) {
          S.rep(x, 235, (xx) => {
            ctx.fillStyle = '#2a1e5c'; ctx.fillRect(xx - 2.5, 76, 5, 60);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const a of [-0.55, -0.22, 0.3, 0.62]) {
              const Lb = 280, dx = Math.sin(a), dy = Math.cos(a);
              const ex = xx + dx * Lb, ey = 72 + dy * Lb;
              const g = ctx.createLinearGradient(xx, 72, ex, ey);
              g.addColorStop(0, rgba('#fff4d0', 0.22)); g.addColorStop(0.6, rgba('#fff4d0', 0.07)); g.addColorStop(1, rgba('#fff4d0', 0));
              ctx.fillStyle = g;
              ctx.beginPath(); ctx.moveTo(xx - dy * 6, 72 + dx * 6); ctx.lineTo(ex - dy * 42, ey + dx * 42); ctx.lineTo(ex + dy * 42, ey - dx * 42); ctx.lineTo(xx + dy * 6, 72 - dx * 6); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            glow(ctx, xx, 70, 40, '#fff2c8', 0.5);
            rr(ctx, xx - 16, 62, 32, 15, 2.5); paint(ctx, '#2a1e5c', 1.6);
            for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) { const lx = xx - 10.5 + k * 7, ly = 66 + j * 6.5; glow(ctx, lx, ly, 7, '#fff2c8', 0.8); ctx.beginPath(); ctx.arc(lx, ly, 2, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); }
          });
        }
      }),
      L(150, 142, 0.18, (ctx, S) => {
        const W = S.W;
        // tribune basse
        ctx.fillStyle = lgY(ctx, [[196, '#4e3c94'], [270, '#3a2c74']]);
        ctx.fillRect(-5, 198, W + 10, 94);
        ctx.fillStyle = '#6a58b8'; ctx.fillRect(-5, 196, W + 10, 3);
        crowd(ctx, S, 210, 3, 13, 4.6, 0.14, ['#6a5ab0', '#6050a8', '#7262b6'], TEAM, '#4a3a8c');
        for (let x = 115; x < W; x += 150) {
          ctx.fillStyle = '#57469a'; ctx.fillRect(x - 6, 199, 12, 50);
          ctx.beginPath(); for (let y = 203; y < 249; y += 7) { ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); } strokeLine(ctx, rgba('#2a1e60', 0.55), 1);
        }
        haze(ctx, W, 196, 292, '#3a2a78', 0.16, 0.1);
        // bannières à pattes suspendues
        S.spread(6, 0.2).forEach((x, i) => {
          const col = TEAM[i % TEAM.length];
          S.rep(x, 20, (xx) => {
            ctx.beginPath(); ctx.moveTo(xx - 12, 186); ctx.lineTo(xx + 12, 186); ctx.lineTo(xx + 12, 220); ctx.lineTo(xx, 228); ctx.lineTo(xx - 12, 220); ctx.closePath();
            paint(ctx, vgrad(ctx, 186, 228, col, 0.2, 0.2), 1.8);
            ctx.beginPath(); pawPath(ctx, xx, 206, 2.2); ctx.fillStyle = rgba('#ffffff', 0.9); ctx.fill();
            rr(ctx, xx - 15, 183, 30, 4, 2); paint(ctx, '#d8c070', 1.4);
          });
        });
        ctx.fillStyle = rgba('#1a1040', 0.3); ctx.fillRect(-5, 196, W + 10, 3);
      }),
      L(200, 92, 0.33, (ctx, S) => {
        const W = S.W;
        // mur de l'arène (panneaux capitonnés)
        const top = 236;
        ctx.fillStyle = lgY(ctx, [[top, '#c8486a'], [282, '#8a2a52']]);
        ctx.fillRect(-5, top, W + 10, 60);
        const pw = 75;
        for (let x = 0; x < W; x += pw) {
          rr(ctx, x + 3, top + 7, pw - 6, 30, 5);
          paint(ctx, lgY(ctx, [[top + 7, '#e8607e'], [top + 37, '#b03a5e']]), 1.6);
          ctx.beginPath(); pawPath(ctx, x + pw / 2, top + 22, 2.4); ctx.fillStyle = rgba('#ffd23f', 0.9); ctx.fill();
          gloss(ctx, x + 18, top + 12, 10, 2, 0.4, 0);
        }
        rr(ctx, -6, top - 6, W + 12, 9, 3);
        paint(ctx, lgY(ctx, [[top - 6, '#ffe07a'], [top + 3, '#d8a03a']]), 2);
        ctx.fillStyle = rgba('#ffffff', 0.6); ctx.fillRect(-5, top - 4, W + 10, 1.3);
        // ampoules en bordure
        for (let x = 6; x < W; x += 12.5) { glow(ctx, x, top - 1.5, 6, '#fff2a0', 0.7); ctx.beginPath(); ctx.arc(x, top - 1.5, 1.3, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(-5, top); ctx.lineTo(W + 5, top); strokeLine(ctx, rgba(OUT, 0.6), 1.2);
        // braseros
        for (const x of S.spread(3, 0.4)) {
          S.rep(x, 80, (xx, rnd) => brazier(ctx, S, xx + pw / 2 - mod(xx, pw), top - 6, rnd));
        }
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          top: 272, edge: [14, 0.6, 1.4, 'bump'], edge2: [12, 0.8, 1.6, 'bump'],
          topWave: [[0.6, 2, 4]],
          fill: [[262, '#f4dca4'], [290, '#ebc98a'], [330, '#ddb576'], [360, '#c99c5e']],
          fill2: [[300, '#f2d696'], [330, '#e2bb7a'], [360, '#c99c5e']],
          shadow: '#6a3a2a', rim: rgba('#fff4d8', 0.9), rim2: rgba('#fff2d0', 0.8),
          stroke2: rgba('#a87a46', 0.75),
          path: { fill: [[280, '#fff0c8'], [296, '#fbe4b2'], [312, '#f2d49a']], edge: '#c09456' },
          upper(ctx, S, F) {
            ctx.fillStyle = lgY(ctx, [[272, rgba('#2a1438', 0.35)], [280, rgba('#2a1438', 0)]]);
            ctx.fillRect(-5, 270, S.W + 10, 10);
          },
          pathDeco(ctx, S, F) {
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              for (let x = -6; x <= S.W + 6; x += 3) { const y = F.fP0(x) + 6 + k * 6 + Math.sin(TAU * 8 * x / S.W + k) * 0.8; x === -6 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
              strokeLine(ctx, rgba('#d8b47a', 0.45), 1);
            }
          },
          lower(ctx, S, F) {
            for (const x of S.spread(3, 0.3)) S.rep(x, 40, (xx) => { ctx.save(); ctx.translate(xx, 338); ctx.scale(1, 0.32); ctx.beginPath(); pawPath(ctx, 0, 0, 9); ctx.fillStyle = rgba('#c8965a', 0.35); ctx.fill(); ctx.restore(); });
            scatter(S, 26, (x) => F.fP1(x) + 8, () => 358, (x, y, rnd) => { ell(ctx, x, y, 1.5 + rnd() * 1.5, 0.9); ctx.fillStyle = rgba('#a98060', 0.6); ctx.fill(); }, 4);
          },
          after(ctx, S, F) {
            // flaques de lumière des projecteurs
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const x of S.spread(3, 0.3)) S.rep(x, 90, (xx) => { ctx.save(); ctx.translate(xx, 296); ctx.scale(1, 0.22); glow(ctx, 0, 0, 90, '#fff0c0', 0.28); ctx.restore(); });
            ctx.restore();
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        S.spread(5, 0.9).forEach((x, i) => {
          S.rep(x, 40, (xx, rnd) => {
            const by = 354 + rnd() * 4;
            if (i % 2) {
              rock(ctx, xx, by + 6, 26, 11, rnd, '#b8a8c0');
              rock(ctx, xx + 20, by + 8, 14, 7, rnd, '#a898b4');
              ell(ctx, xx - 20, by + 6, 3, 1.6); ctx.fillStyle = rgba('#8a6a50', 0.6); ctx.fill();
            } else {
              // fanion tombé
              poly(ctx, [[xx - 12, by + 2], [xx + 12, by - 4], [xx + 4, by + 8]]);
              paint(ctx, TEAM[i % 4], 1.8);
              rock(ctx, xx + 16, by + 6, 18, 9, rnd, '#b0a0b8');
            }
          });
        });
      }, true),
    ],
  };
}

function catHead(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  addEll(ctx, x, y + r * 1.5, r * 1.25, r * 0.95);
  addCircle(ctx, x, y, r);
  ctx.moveTo(x - r * 0.95, y - r * 0.2); ctx.lineTo(x - r * 0.78, y - r * 1.5); ctx.lineTo(x - r * 0.1, y - r * 0.8);
  ctx.moveTo(x + r * 0.95, y - r * 0.2); ctx.lineTo(x + r * 0.78, y - r * 1.5); ctx.lineTo(x + r * 0.1, y - r * 0.8);
  ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.85, Math.PI * 1.15, Math.PI * 1.75);
  strokeLine(ctx, rgba('#ffffff', 0.28), r * 0.3);
}
// Rangées de spectateurs à oreilles de chat
function crowd(ctx, S, y0, rows, dy, r0, pTeam, cols, team, band) {
  const W = S.W;
  for (let row = 0; row < rows; row++) {
    const y = y0 + row * dy, r = r0 + row * 0.1;
    ctx.fillStyle = band; ctx.fillRect(-5, y + r * 0.6, W + 10, dy);
    const n = Math.round(W / (r * 2.6));
    for (let i = 0; i < n; i++) {
      const x = (i + (row % 2) * 0.5) * W / n;
      const c = S.rand() < pTeam ? mix(S.pick(team), cols[0], 0.35) : S.pick(cols);
      const jy = S.r(-1.4, 1.4);
      S.rep(x, r * 2, (xx) => catHead(ctx, xx, y + jy, r, c));
    }
    ctx.fillStyle = rgba('#a898f0', 0.35); ctx.fillRect(-5, y + dy - 1.5, W + 10, 1.2);
  }
}
function brazier(ctx, S, x, by, rnd) {
  glow(ctx, x, by - 18, 34, '#ff8a2a', 0.6);
  const flame = (k, col) => {
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, by - 10);
    ctx.quadraticCurveTo(x - 10 * k, by - 22 * k, x - 3 * k, by - 30 * k);
    ctx.quadraticCurveTo(x - 2 * k, by - 22 * k, x + 1 * k, by - 24 * k);
    ctx.quadraticCurveTo(x + 4 * k, by - 34 * k, x + 6 * k, by - 26 * k);
    ctx.quadraticCurveTo(x + 11 * k, by - 18 * k, x + 9 * k, by - 10);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  };
  flame(1, '#ff6a2a'); flame(0.7, '#ffb03a'); flame(0.4, '#fff2a0');
  poly(ctx, [[x - 12, by - 12], [x + 12, by - 12], [x + 8, by - 2], [x - 8, by - 2]]);
  paint(ctx, vgrad(ctx, by - 12, by, '#d8a03a', 0.25, 0.25), 1.8);
  rr(ctx, x - 2.5, by - 2, 5, 8, 1); paint(ctx, '#8a6a3a', 1.4);
}

// =====================================================================
//  API
// =====================================================================
const DEFS = { garden: gardenDef, autumn: autumnDef, beach: beachDef, snow: snowDef, neon: neonDef, volcano: volcanoDef, cosmos: cosmosDef, roofs: roofsDef, arena: arenaDef };

export function buildScenery(id, seed = 1, res = 2) {
  const key = DEFS[id] ? id : 'garden';
  const spec = DEFS[key]();
  const base = (((seed | 0) * 2654435761) ^ hashStr(key)) >>> 0;
  // ciel
  const sky = mkCanvas(SKY_W, VH, res);
  {
    const ctx = sky.getContext('2d');
    ctx.scale(sky.width / SKY_W, sky.height / VH);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    spec.sky(ctx, makeS(SKY_W, (base ^ 0x9e3779b9) >>> 0 || 1, res));
  }
  const layers = spec.layers.map((Ld, i) => {
    const c = mkCanvas(TILE, Ld.h, res);
    const ctx = c.getContext('2d');
    ctx.scale(c.width / TILE, c.height / Ld.h);
    ctx.translate(0, -Ld.y0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    Ld.draw(ctx, makeS(TILE, ((base + (i + 1) * 0x85ebca6b) >>> 0) || 1, res));
    return { canvas: c, tileW: TILE, y0: Ld.y0, h: Ld.h, speed: Ld.speed, front: !!Ld.front };
  });
  return { id: key, ambient: spec.ambient, sky, layers };
}

// Dessine une bande en la répétant ; bords alignés sur les pixels de l'écran (pas de couture).
function blit(ctx, Ly, scroll, viewW, a, e) {
  const tw = Ly.tileW;
  for (let x = -mod(scroll * Ly.speed, tw); x < viewW; x += tw) {
    const xl = (Math.round(e + x * a) - e) / a;
    const xr = (Math.round(e + (x + tw) * a) - e) / a;
    ctx.drawImage(Ly.canvas, xl, Ly.y0, xr - xl, Ly.h);
  }
}

export function drawScenery(ctx, sc, scroll, viewW) {
  if (!sc) return;
  scroll = +scroll || 0;
  const m = ctx.getTransform();
  const a = m.a || 1, e = m.e;
  // ciel : proportions conservées (soleil/lune bien ronds), centré, recadré si besoin
  const s = Math.max(viewW / SKY_W, 1);
  const dw = SKY_W * s, dh = VH * s;
  ctx.drawImage(sc.sky, (viewW - dw) / 2, VH - dh, dw, dh);
  for (const Ly of sc.layers) if (!Ly.front) blit(ctx, Ly, scroll, viewW, a, e);
}

export function drawSceneryFront(ctx, sc, scroll, viewW) {
  if (!sc) return;
  scroll = +scroll || 0;
  const m = ctx.getTransform();
  const a = m.a || 1, e = m.e;
  for (const Ly of sc.layers) if (Ly.front) blit(ctx, Ly, scroll, viewW, a, e);
}
