// =====================================================================
//  Décors de combat en parallaxe (Canvas 2D, vue de côté).
//  buildScenery(id, seed = 1, res = 2, variant = 0) pré-rend tout UNE fois :
//   - sky    : toile 480×360 unités (ajustée à la largeur de la scène)
//   - layers : bandes horizontales raccordables (tileW unités de large),
//              du plus lointain au plus proche ; `front` = devant les persos.
//   - ambient: particules d'ambiance (adaptées à l'ère), variant : ère 0 à 3.
//  Ères (SCENERY_VARIANTS) : 0 normal, 1 Crépuscule, 2 Cauchemar, 3 Infernal ;
//  même tracé pour une même graine, seuls l'étalonnage et les éléments d'ère changent.
//  drawScenery / drawSceneryFront ne font que des drawImage.
// =====================================================================
import { OUT, VH, shade, mix, rgba, seeded, ell, rr, smooth, poly, paint, vgrad, ball, gloss, glow } from './draw.js';

export const BIOME_IDS = ['garden', 'autumn', 'beach', 'snow', 'neon', 'volcano', 'cosmos', 'roofs', 'arena', 'desert', 'jungle', 'underwater', 'castle', 'factory', 'sky', 'candy'];

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
function makeS(W, seed, res, V = 0) {
  const rand = seeded(seed);
  const S = {
    W, res, rand, V, lights: [],
    // Source lumineuse « qui s'allume » dans les variantes (dessinée après l'étalonnage).
    // o : { rect:[x,y,w,h] fenêtre, lantern:taille, jack:taille (citrouille), a:intensité }
    light(x, y, r, o) { if (V) S.lights.push([x, y, r, o || null]); },
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
  if (CUR && CUR.V) { if (!CUR.sun) CUR.sun = { x, y, r }; return; } // l'astre de l'ère est posé après l'étalonnage
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
  S.light(x, gy - 12 * s, 30 * s, { a: 0.55, alt: 1 });
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
    S.light(px, py, 9, { a: 0.7 });
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
          S.light(xx, b - 29, 9, { rect: [xx - 2, b - 32, 4, 6] });
          for (const dx of [-21, 21]) S.light(xx + dx, b - 21.5, 7, { rect: [xx + dx - 1.5, b - 24, 3, 5] });
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
          S.rep(x, len, (xx) => {
            fence(ctx, xx - len / 2, xx + len / 2, (q) => fM(q) + 5, '#d79a5c');
            const n = Math.max(2, Math.round(len / 24));
            for (let k = 1; k < n; k += 3) { const px = xx - len / 2 + len * k / n; S.light(px, fM(px) - 18, 22, { lantern: 1 }); }
          });
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
            for (let k = 0; k < n; k++) {
              const px = xx + k * 15 - n * 6, py = fM(xx) + 9 + (k % 2) * 2, ps = 0.8 + rnd() * 0.35;
              pumpkin(ctx, px, py, ps, rnd);
              S.light(px, py - 10.5 * ps, 22 * ps, { jack: ps * 0.9 });
            }
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
              const ps = 1.15 + rnd() * 0.25;
              pumpkin(ctx, xx, by, ps, rnd);
              S.light(xx, by - 10.5 * ps, 26 * ps, { jack: ps * 0.9 });
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
          S.light(xx + 12, hz - 15 - 34 * 0.9 - 3.5, 20);
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
          const us = S.r(0.9, 1.05), lean = i % 2 ? 0.14 : -0.12;
          S.rep(x + 60, 62, (xx) => {
            umbrella(ctx, xx, fM(xx) + 8, us, c[0], c[1], lean);
            const tx = xx + lean * 62 * us, ty = fM(xx) + 8 - 62 * us;
            S.light(tx + Math.cos(lean * 0.9) * 30 * us, ty + Math.sin(lean * 0.9) * 30 * us + 8, 18, { lantern: 0.9 });
          });
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
    ambient: 'rain', kind: 'night',
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
        for (const lx of S.spread(4, 0.5)) S.rep(lx, 62, (xx) => { streetLamp(ctx, xx, 264, 1); S.light(xx + 12, 180, 34, { a: 0.8 }); });
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
    if (lit) S.light(wx + ww / 2, top + 14, 14, { rect: [wx + 1, top + 9, ww - 2, 10], a: 0.6 });
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
    ambient: 'embers', kind: 'night', skyKeep: 0.45,
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
            S.light(xx, fM(xx) + 12, 40, { a: 0.7 });
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
    ambient: 'stars', kind: 'night', skyKeep: 0.3,
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
        for (const x of S.spread(2, 0.5)) S.rep(x, 30, (xx) => { catPillar(ctx, xx, fM(xx) + 6, 1); S.light(xx, fM(xx) + 6 - 80, 26, { alt: 1 }); });
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
    ambient: 'fireflies', kind: 'night', skyKeep: 0.3,
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
          S.rep(x0 + w / 2, w, (xx, rnd) => zincRoof(ctx, xx - w / 2, 272, w, h, rnd, chs.map((c) => [c[0] - x0 + xx - w / 2, c[1], c[2]]), S));
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
          S.light(x + 11, 348, 26, { a: 0.5 });
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
function zincRoof(ctx, x, by, w, h, rnd, chs, S) {
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
    if (lit) { glow(ctx, dx, dy + 8, 20, '#ffc86a', 0.4); S.light(dx, dy + 7, 20, { rect: [dx - 5, dy, 10, 13], a: 0.7 }); }
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
    ambient: 'stars', kind: 'night',
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
            S.light(xx, 70, 40, { a: 0.6 });
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
  S.light(x, by - 18, 34, { a: 0.7 });
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

// ------------------------------------------------------------------ Désert des Pharaons
function desertDef() {
  const SAND = ['#ffe2a4', '#f7cb80', '#eab066', '#d6964e'];
  return {
    ambient: 'embers', kind: 'day', horizon: 214,
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#2a7fdc'], [0.28, '#55a9ee'], [0.5, '#9fd2f0'], [0.64, '#f2ecc8'], [0.76, '#ffe0a8'], [1, '#ffc98c']]);
      sunDisc(ctx, 362, 64, 23, { core: '#ffffff', edge: '#ffe27a', glow: '#fff3c0', glowR: 7.5, rayA: 0.3 });
      // voiles de chaleur au-dessus de l'horizon
      for (let i = 0; i < 9; i++) {
        const y = 192 + i * 7 + S.r(-2, 2);
        ctx.beginPath();
        for (let x = -4; x <= SKY_W + 4; x += 4) { const yy = y + Math.sin(x * 0.07 + i * 1.7) * 1.2; x === -4 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
        strokeLine(ctx, rgba('#fff6dc', 0.22 + 0.04 * (i % 3)), 1.4);
      }
      // vautours qui tournoient
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const x = 120 + S.r(0, 120), y = 70 + S.r(0, 50), s = S.r(3.5, 5.5);
        ctx.moveTo(x - s * 1.2, y - s * 0.2); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.8, x, y); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.8, x + s * 1.2, y - s * 0.2);
      }
      strokeLine(ctx, rgba('#6a4a3a', 0.55), 1.5);
    },
    layers: [
      L(0, 190, 0.03, (ctx, S) => {
        for (const x of S.spread(4, 0.7)) {
          const y = S.r(50, 120), w = S.r(70, 140);
          S.rep(x, w, (xx, rnd) => {
            ctx.beginPath();
            for (let k = 0; k < 3; k++) addEll(ctx, xx + (k - 1) * w * 0.32 + rnd() * 8, y + (rnd() - 0.5) * 5, w * (0.22 + rnd() * 0.16), 2.4 + rnd() * 2.6);
            ctx.fillStyle = rgba('#ffffff', 0.7); ctx.fill();
          });
        }
        cloudBand(ctx, S, 2, 70, 120, '#fffaf0', '#f2d8c0', 60, 90);
      }),
      L(120, 172, 0.05, (ctx, S) => {
        const W = S.W;
        // pyramides de Gizeh (trois) et une paire plus lointaine
        const gx = S.r(0, W);
        S.rep(gx, 170, (xx) => {
          pyramid(ctx, xx - 70, 240, 92, 58, '#f0c79a', '#cf9d7c');
          pyramid(ctx, xx + 52, 240, 118, 74, '#f2cb9e', '#d2a07e');
          pyramid(ctx, xx - 4, 242, 160, 104, '#f6d0a2', '#d6a482', { cap: true });
        });
        const gx2 = mod(gx + W * 0.52, W);
        S.rep(gx2, 80, (xx) => { pyramid(ctx, xx - 20, 240, 70, 44, '#f2cfa8', '#d8ae8e'); pyramid(ctx, xx + 34, 240, 52, 32, '#f2cfa8', '#d8ae8e'); });
        const f = wave(S, 238, [[5, 1, 2], [3, 3, 5], [1.5, 7, 10]]);
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[226, '#f8d8a8'], [292, '#f2c48e']]); ctx.fill();
        haze(ctx, W, 120, 292, '#ffe8c4', 0.42, 0.25);
      }),
      L(150, 142, 0.1, (ctx, S) => {
        const W = S.W;
        const sx = S.r(0, W);
        // dunes moyennes
        const xs = S.spread(7, 0.5);
        xs.forEach((x, i) => {
          const w = S.r(150, 230), h = S.r(26, 42), b = 258 + S.r(-3, 3);
          S.rep(x, w * 0.6, (xx) => dune(ctx, xx, b, w, h, '#f6cc8c', '#d79e6a'));
        });
        S.rep(sx, 60, (xx) => sphinxCat(ctx, xx, 246, 0.85));
        ctx.fillStyle = lgY(ctx, [[252, '#f4c684'], [292, '#eab676']]);
        ctx.fillRect(-5, 254, W + 10, 40);
        haze(ctx, W, 150, 292, '#ffe6c0', 0.3, 0.12);
      }),
      L(150, 142, 0.18, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 262, [[3, 1, 2], [2, 3, 5]]);
        // oasis : eau, roseaux et palmiers
        const ox = S.r(0, W);
        S.rep(ox, 120, (xx, rnd) => {
          const y = f(xx) - 2;
          palm(ctx, xx - 52, y + 4, 0.62, rnd, -16, { lw: 1.6 });
          palm(ctx, xx + 46, y + 4, 0.7, rnd, 18, { lw: 1.6 });
          ell(ctx, xx, y + 6, 70, 9);
          paint(ctx, lgY(ctx, [[y - 3, '#4fd8d0'], [y + 15, '#1e9fb4']]), 1.6);
          for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(xx - 50 + k * 18 + rnd() * 6, y + 3 + (k % 2) * 4); ctx.lineTo(xx - 40 + k * 18 + rnd() * 6, y + 3 + (k % 2) * 4); strokeLine(ctx, rgba('#ffffff', 0.75), 1.1); }
          for (const side of [-1, 1]) for (let k = 0; k < 4; k++) tuft(ctx, xx + side * (54 + k * 6), y + 8 - k, 0.55, '#5aa84a', rnd, { tall: 1.6 + rnd() * 0.5, n: 3 });
        });
        for (const x of S.spread(5, 0.7)) {
          const w = S.r(110, 170), h = S.r(16, 26);
          S.rep(x, w * 0.6, (xx) => dune(ctx, xx, f(xx) + 3, w, h, '#f9d394', '#dea672'));
        }
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[256, '#f8d090'], [292, '#ecb878']]); ctx.fill();
        haze(ctx, W, 150, 292, '#fff0d4', 0.16, 0.06);
      }),
      L(60, 232, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 262, [[2.5, 1, 2], [1.5, 4, 7]]);
        const xs = S.spread(6, 0.45);
        const kinds = ['obelisk', 'bastet', 'columns', 'palm', 'stele', 'obelisk'];
        const k0 = S.ri(0, 5);
        xs.forEach((x, i) => {
          const kind = kinds[(i + k0) % kinds.length];
          if (kind === 'obelisk') { const h = S.r(110, 140); S.rep(x, 20, (xx, rnd) => obelisk(ctx, xx, fM(xx) + 6, h, 19, rnd)); }
          else if (kind === 'bastet') S.rep(x, 30, (xx) => bastet(ctx, xx, fM(xx) + 7, 1));
          else if (kind === 'columns') S.rep(x, 50, (xx, rnd) => { egyptColumn(ctx, xx - 22, fM(xx) + 6, 1, rnd, true); egyptColumn(ctx, xx + 18, fM(xx) + 6, 1, rnd, false); });
          else if (kind === 'palm') { const lean = S.r(-22, 22); S.rep(x, 130, (xx, rnd) => palm(ctx, xx, fM(xx) + 6, 1.02, rnd, lean)); }
          else S.rep(x, 24, (xx, rnd) => stele(ctx, xx, fM(xx) + 7, 1, rnd));
        });
        for (const x of S.spread(4, 0.8)) S.rep(x, 30, (xx, rnd) => { amphora(ctx, xx, fM(xx) + 9, 0.9 + rnd() * 0.2, rnd); if (rnd() < 0.6) amphora(ctx, xx + 13, fM(xx) + 10, 0.7, rnd); });
        for (const x of S.spread(2, 0.4)) S.rep(mod(x + 70, W), 16, (xx, rnd) => torch(ctx, xx, fM(xx) + 8, 1, S, rnd, 'bronze'));
        for (const x of S.spread(5, 0.8)) S.rep(x, 20, (xx, rnd) => rock(ctx, xx, fM(xx) + 10, 18 + rnd() * 10, 7 + rnd() * 4, rnd, '#e2b47e', { hla: 0.35 }));
        profilePath(ctx, W, (x) => fM(x) + 6, 300);
        ctx.fillStyle = lgY(ctx, [[258, '#fad596'], [290, '#efbd7c']]); ctx.fill();
        profileLine(ctx, W, (x) => fM(x) + 6); strokeLine(ctx, rgba('#b8783e', 0.55), 1.4);
        haze(ctx, W, 60, 282, '#fff0d6', 0.14, 0.06);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [12, 0.9, 2.2, 'bump'], edge2: [11, 0.8, 1.8, 'bump'],
          fill: [[262, SAND[0]], [290, SAND[1]], [330, SAND[2]], [360, SAND[3]]],
          fill2: [[300, '#fbd690'], [330, '#efbb72'], [360, SAND[3]]],
          shadow: '#9a5a2a', rim: rgba('#fff4d6', 0.95), rim2: rgba('#fff0c8', 0.8),
          stroke: rgba(OUT, 0.9), stroke2: rgba('#b87a42', 0.85),
          path: { fill: [[280, '#eccb98'], [296, '#e2b986'], [312, '#d4a676']], edge: '#9a6a42' },
          upper(ctx, S, F) {
            scatter(S, 22, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 1.8, x + 6, y); strokeLine(ctx, rgba('#d6a060', 0.6), 1.1); }, 7);
            scatter(S, 8, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 2, (x, y, rnd) => { ell(ctx, x, y, 1.6 + rnd() * 1.4, 1.1); ctx.fillStyle = rgba('#b88a5a', 0.75); ctx.fill(); }, 4);
          },
          pathDeco(ctx, S, F) {
            // dalles de grès à moitié ensablées
            let x = 0;
            while (x < S.W - 8) {
              let w = S.r(20, 32);
              if (S.W - (x + w) < 20) w = S.W - x;
              const x0 = x, row = S.rand() < 0.5;
              S.rep(x0 + w / 2, w, (xx, rnd) => {
                const mid = (F.fP0(xx) + F.fP1(xx)) / 2;
                const y0 = row ? F.fP0(xx) + 3 : mid + 1, y1 = row ? mid - 1 : F.fP1(xx) - 1;
                rr(ctx, xx - w / 2 + 1.5, y0, w - 3, y1 - y0, 2.5);
                ctx.fillStyle = rgba('#f6dcae', 0.5 + rnd() * 0.2); ctx.fill();
                ctx.strokeStyle = rgba('#9a6a42', 0.45); ctx.lineWidth = 1; ctx.stroke();
                if (rnd() < 0.3) { ctx.beginPath(); ctx.moveTo(xx - w * 0.2, y0 + 2); ctx.lineTo(xx, y0 + (y1 - y0) * 0.6); ctx.lineTo(xx + w * 0.15, y1 - 1); strokeLine(ctx, rgba('#9a6a42', 0.4), 0.8); }
              });
              x += w;
            }
            // langues de sable sur les dalles
            scatter(S, 9, (x) => F.fP0(x) + 4, (x) => F.fP1(x) - 2, (x, y, rnd) => {
              const w = 12 + rnd() * 20;
              ell(ctx, x, y, w, 3 + rnd() * 2); ctx.fillStyle = lgY(ctx, [[y - 4, rgba('#ffe6b2', 0.95)], [y + 4, rgba('#f2c88c', 0.9)]]); ctx.fill();
            }, 30);
            pawTrail(S, F, 22, (q, y) => paw(ctx, q, y, 1.2, rgba('#b8865a', 0.45), Math.PI / 2));
          },
          lower(ctx, S, F) {
            scatter(S, 38, (x) => F.fP1(x) + 8, () => 358, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y - 2.4, x + 9, y); strokeLine(ctx, rgba('#cf9450', 0.55), 1.2); }, 10);
            scatter(S, 5, (x) => F.fP1(x) + 12, () => 350, (x, y, rnd) => scarab(ctx, x, y, 0.9, rnd() * 0.6 - 0.3), 6);
            scatter(S, 4, (x) => F.fP1(x) + 14, () => 352, (x, y, rnd) => fishBone(ctx, x, y, 0.75, '#fff4dc'), 14);
            scatter(S, 12, (x) => F.fP1(x) + 8, () => 356, (x, y, rnd) => { poly(ctx, [[x - 3, y], [x - 1, y - 2.5], [x + 3, y - 1.5], [x + 2, y + 1]]); paint(ctx, rnd() < 0.5 ? '#c86a3a' : '#3a8aa0', 0.8); }, 4);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 352 + rnd() * 6;
            if (kind < 0.35) {
              carvedBlock(ctx, xx, by + 6, 1.1, rnd);
              tuft(ctx, xx + 24, by + 10, 1.4, '#c8a050', rnd, { lw: 1.8, n: 4, bw: 2, tall: 1.3, fill: lgY(ctx, [[by - 16, '#f0d080'], [by + 8, '#a07a36']]) });
            } else if (kind < 0.65) {
              amphora(ctx, xx, by + 8, 1.6, rnd, 2);
              rock(ctx, xx + 22, by + 8, 24, 10, rnd, '#e6b47a');
            } else {
              tuft(ctx, xx, by + 10, 1.6, '#b8a050', rnd, { lw: 1.8, n: 5, bw: 2, tall: 1.4, fill: lgY(ctx, [[by - 20, '#f2dc8a'], [by + 8, '#9a7a34']]) });
              rock(ctx, xx + 18, by + 8, 28, 12, rnd, '#e0aa70');
            }
          });
        }
      }, true),
    ],
  };
}

function pyramid(ctx, x, by, w, h, lit, dark, o = {}) {
  const ax = x + w * 0.05, ay = by - h;
  poly(ctx, [[x - w / 2, by + 1], [ax, ay], [x + w / 2, by + 1]]);
  ctx.fillStyle = lgY(ctx, [[ay, shade(lit, 0.12)], [by, lit]]); ctx.fill();
  poly(ctx, [[ax, ay], [x + w / 2, by + 1], [x + w * 0.2, by + 1]]);
  ctx.fillStyle = dark; ctx.fill();
  ctx.save();
  poly(ctx, [[x - w / 2, by + 1], [ax, ay], [x + w / 2, by + 1]]); ctx.clip();
  ctx.beginPath();
  for (let k = 1; k < 9; k++) { const y = ay + h * k / 9; ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); }
  strokeLine(ctx, rgba(shade(dark, -0.2), 0.18), 0.7);
  ctx.restore();
  if (o.cap) {
    poly(ctx, [[ax, ay], [ax - h * 0.09, ay + h * 0.12], [ax + h * 0.1, ay + h * 0.12]]);
    ctx.fillStyle = '#ffd860'; ctx.fill();
    glow(ctx, ax, ay + 3, 10, '#fff4b0', 0.6);
  }
}
function dune(ctx, x, base, w, h, lit, dark) {
  const cx = x + w * 0.1, cy = base - h;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base + 1);
    ctx.bezierCurveTo(x - w * 0.24, base - h * 0.12, cx - w * 0.2, cy + h * 0.04, cx, cy);
    ctx.bezierCurveTo(cx + w * 0.07, cy + h * 0.1, x + w * 0.3, base - h * 0.16, x + w / 2, base + 1);
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = lgY(ctx, [[cy, shade(lit, 0.1)], [base, lit]]); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + w * 0.07, cy + h * 0.1, x + w * 0.3, base - h * 0.16, x + w / 2, base + 1);
  ctx.lineTo(cx + w * 0.06, base + 1);
  ctx.bezierCurveTo(cx + w * 0.07, base - h * 0.45, cx + w * 0.02, cy + h * 0.35, cx, cy);
  ctx.fillStyle = lgY(ctx, [[cy, dark], [base, shade(dark, 0.08)]]); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - w * 0.16, cy + h * 0.16); ctx.quadraticCurveTo(cx - w * 0.06, cy + h * 0.01, cx, cy);
  strokeLine(ctx, rgba('#fff6dc', 0.75), 1.3);
  ctx.save(); outline(); ctx.clip();
  ctx.beginPath();
  for (let k = 0; k < 4; k++) { const yy = cy + h * (0.35 + k * 0.17), xa = cx - w * (0.12 + k * 0.08); ctx.moveTo(xa - w * 0.1, yy + 2); ctx.quadraticCurveTo(xa, yy - 1, xa + w * 0.08, yy + 1); }
  strokeLine(ctx, rgba(shade(lit, -0.15), 0.5), 0.9);
  ctx.restore();
}
function sphinxCat(ctx, x, by, s) {
  const st = '#d9a86e', lt = '#efc488', dk = '#b88456';
  ctx.fillStyle = dk; ctx.fillRect(x - 40 * s, by - 9 * s, 80 * s, 13 * s);
  ctx.fillStyle = lt; ctx.fillRect(x - 40 * s, by - 9 * s, 80 * s, 2 * s);
  // corps couché + pattes avant
  ctx.fillStyle = st;
  rr(ctx, x - 34 * s, by - 26 * s, 48 * s, 18 * s, 8 * s); ctx.fill();
  rr(ctx, x + 6 * s, by - 15 * s, 30 * s, 7 * s, 3 * s); ctx.fill();
  ctx.fillStyle = dk; rr(ctx, x - 34 * s, by - 16 * s, 48 * s, 8 * s, 4 * s); ctx.fill();
  // queue
  ctx.beginPath(); ctx.moveTo(x - 33 * s, by - 12 * s); ctx.quadraticCurveTo(x - 42 * s, by - 14 * s, x - 38 * s, by - 22 * s); strokeLine(ctx, st, 3.2 * s);
  // tête et némès
  ctx.fillStyle = '#2a6aa8';
  poly(ctx, [[x + 2 * s, by - 20 * s], [x + 6 * s, by - 44 * s], [x + 24 * s, by - 44 * s], [x + 27 * s, by - 20 * s]]); ctx.fill();
  ctx.save(); poly(ctx, [[x + 2 * s, by - 20 * s], [x + 6 * s, by - 44 * s], [x + 24 * s, by - 44 * s], [x + 27 * s, by - 20 * s]]); ctx.clip();
  ctx.fillStyle = '#ffd25a'; for (let k = 0; k < 6; k++) ctx.fillRect(x, by - 42 * s + k * 4.2 * s, 30 * s, 2 * s);
  ctx.restore();
  ctx.fillStyle = st;
  poly(ctx, [[x + 8 * s, by - 46 * s], [x + 9 * s, by - 56 * s], [x + 14 * s, by - 48 * s], [x + 18 * s, by - 48 * s], [x + 22 * s, by - 56 * s], [x + 23 * s, by - 46 * s]]); ctx.fill();
  rr(ctx, x + 9 * s, by - 47 * s, 14 * s, 15 * s, 6 * s); ctx.fill();
  ctx.fillStyle = dk; ctx.fillRect(x + 12 * s, by - 41 * s, 3 * s, 1.4 * s); ctx.fillRect(x + 18 * s, by - 41 * s, 3 * s, 1.4 * s);
  ctx.fillStyle = '#ffd25a'; ctx.fillRect(x + 13.5 * s, by - 33 * s, 4.5 * s, 7 * s);
}
function glyphCell(ctx, k, cx, cy, s) {
  ctx.beginPath();
  switch (k % 8) {
    case 0: ctx.moveTo(cx - s, cy); ctx.quadraticCurveTo(cx, cy - s * 0.9, cx + s, cy); ctx.quadraticCurveTo(cx, cy + s * 0.7, cx - s, cy); ctx.moveTo(cx - s * 0.2, cy + s * 0.5); ctx.lineTo(cx - s * 0.4, cy + s * 1.1); ctx.moveTo(cx + s * 0.3, cy); ctx.arc(cx, cy, s * 0.3, 0, TAU); break;
    case 1: ctx.moveTo(cx, cy - s * 0.2); ctx.lineTo(cx, cy + s * 1.1); ctx.moveTo(cx - s * 0.7, cy + s * 0.15); ctx.lineTo(cx + s * 0.7, cy + s * 0.15); ctx.moveTo(cx + s * 0.4, cy - s * 0.6); ctx.ellipse(cx, cy - s * 0.6, s * 0.4, s * 0.55, 0, 0, TAU); break;
    case 2: ctx.moveTo(cx - s, cy + s * 0.4); ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.2, cx + s * 0.4, cy - s * 0.8); ctx.lineTo(cx + s, cy - s * 0.5); ctx.moveTo(cx - s * 0.2, cy + s * 0.2); ctx.lineTo(cx - s * 0.2, cy + s); ctx.moveTo(cx + s * 0.2, cy); ctx.lineTo(cx + s * 0.2, cy + s); break;
    case 3: ctx.moveTo(cx - s, cy - s * 0.3); for (let i = 1; i <= 6; i++) ctx.lineTo(cx - s + i * s / 3, cy - s * 0.3 + (i % 2 ? s * 0.4 : 0)); ctx.moveTo(cx - s, cy + s * 0.5); for (let i = 1; i <= 6; i++) ctx.lineTo(cx - s + i * s / 3, cy + s * 0.5 + (i % 2 ? s * 0.4 : 0)); break;
    case 4: ctx.moveTo(cx - s * 0.5, cy + s); ctx.quadraticCurveTo(cx - s * 0.8, cy, cx - s * 0.2, cy - s * 0.4); ctx.lineTo(cx - s * 0.35, cy - s); ctx.lineTo(cx, cy - s * 0.6); ctx.lineTo(cx + s * 0.3, cy - s); ctx.lineTo(cx + s * 0.2, cy - s * 0.3); ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.2, cx + s * 0.4, cy + s); ctx.closePath(); break;
    case 5: ctx.moveTo(cx + s * 0.7, cy); ctx.arc(cx, cy, s * 0.7, 0, TAU); ctx.moveTo(cx + s * 0.18, cy); ctx.arc(cx, cy, s * 0.18, 0, TAU); break;
    case 6: ctx.moveTo(cx, cy + s); ctx.quadraticCurveTo(cx - s * 0.6, cy, cx, cy - s); ctx.quadraticCurveTo(cx + s * 0.5, cy, cx, cy + s); break;
    default: ctx.moveTo(cx - s, cy + s * 0.8); ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.8, cx + s * 0.6, cy + s * 0.2, cx - s * 0.2, cy - s * 0.2); ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.6, cx + s * 0.4, cy - s); break;
  }
}
// Colonne(s) de hiéroglyphes gravés
function glyphs(ctx, x, y, w, h, rnd, col, cell = 7, lw = 0.9) {
  const cols = Math.max(1, Math.floor(w / cell)), rows = Math.max(1, Math.floor(h / cell));
  const ox = x + (w - cols * cell) / 2, oy = y + (h - rows * cell) / 2;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const k = Math.floor(rnd() * 8);
    glyphCell(ctx, k, ox + (c + 0.5) * cell, oy + (r + 0.5) * cell, cell * 0.34);
    if (k === 4) { ctx.fillStyle = col; ctx.fill(); } else strokeLine(ctx, col, lw);
  }
  if (cols > 1) { ctx.beginPath(); for (let c = 1; c < cols; c++) { ctx.moveTo(ox + c * cell, oy); ctx.lineTo(ox + c * cell, oy + rows * cell); } strokeLine(ctx, rgba(col, 0.45), 0.6); }
}
function obelisk(ctx, x, by, h, w, rnd) {
  const tw = w * 0.64, top = by - h;
  const body = [[x - w / 2, by + 3], [x - tw / 2, top], [x + tw / 2, top], [x + w / 2, by + 3]];
  poly(ctx, body); paint(ctx, lgY(ctx, [[top, '#f4cf9a'], [by, '#e0aa72']]), 2);
  poly(ctx, [[x + w * 0.16, by + 3], [x + tw * 0.16, top], [x + tw / 2, top], [x + w / 2, by + 3]]);
  ctx.fillStyle = rgba('#a8643a', 0.35); ctx.fill();
  poly(ctx, body); paint(ctx, null, 2);
  ctx.save(); poly(ctx, body); ctx.clip();
  glyphs(ctx, x - tw * 0.42, top + 8, tw * 0.6, h - 22, rnd, '#8a4a2a', 5.6, 0.8);
  ctx.restore();
  poly(ctx, [[x - tw / 2 - 1, top], [x, top - tw * 0.95], [x + tw / 2 + 1, top]]);
  paint(ctx, lgY(ctx, [[top - tw, '#fff2a0'], [top, '#e8a830']]), 2);
  poly(ctx, [[x, top - tw * 0.95], [x + tw / 2 + 1, top], [x + tw * 0.08, top]]); ctx.fillStyle = rgba('#b87a20', 0.45); ctx.fill();
  glow(ctx, x - 1, top - tw * 0.5, 12, '#fff6c0', 0.5);
  rr(ctx, x - w / 2 - 4, by - 3, w + 8, 8, 1.5); paint(ctx, '#d8a26e', 1.8);
}
function bastet(ctx, x, by, s) {
  rr(ctx, x - 17 * s, by - 16 * s, 34 * s, 20 * s, 2); paint(ctx, lgY(ctx, [[by - 16 * s, '#f2c88e'], [by, '#d69e68']]), 2);
  ctx.save(); rr(ctx, x - 17 * s, by - 16 * s, 34 * s, 20 * s, 2); ctx.clip();
  glyphs(ctx, x - 15 * s, by - 14 * s, 30 * s, 13 * s, seeded(77), '#8a4a2a', 6.5 * s, 0.8);
  ctx.restore();
  const b = by - 16 * s;
  const cat = () => {
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, b);
    ctx.quadraticCurveTo(x - 15 * s, b - 22 * s, x - 6 * s, b - 34 * s);
    ctx.quadraticCurveTo(x - 4 * s, b - 42 * s, x - 2 * s, b - 46 * s);
    ctx.lineTo(x - 3 * s, b - 58 * s); ctx.lineTo(x + 2.5 * s, b - 51 * s);
    ctx.lineTo(x + 5.5 * s, b - 51 * s); ctx.lineTo(x + 9 * s, b - 58 * s); ctx.lineTo(x + 9.5 * s, b - 47 * s);
    ctx.quadraticCurveTo(x + 13 * s, b - 42 * s, x + 11 * s, b - 38 * s);
    ctx.quadraticCurveTo(x + 7 * s, b - 34 * s, x + 6 * s, b - 30 * s);
    ctx.lineTo(x + 7 * s, b - 4 * s); ctx.lineTo(x + 10 * s, b - 2 * s); ctx.lineTo(x + 10 * s, b);
    ctx.closePath();
  };
  cat(); paint(ctx, lgY(ctx, [[b - 58 * s, '#4a4060'], [b, '#2a2238']]), 2);
  ctx.save(); cat(); ctx.clip();
  ctx.beginPath(); ctx.moveTo(x + 2 * s, b - 30 * s); ctx.lineTo(x + 2 * s, b - 2 * s); strokeLine(ctx, rgba('#8a80b0', 0.5), 1.2);
  ell(ctx, x - 8 * s, b - 34 * s, 4 * s, 9 * s, 0.3); ctx.fillStyle = rgba('#8a80b0', 0.3); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - 4 * s, b - 34 * s); ctx.quadraticCurveTo(x + 2 * s, b - 31 * s, x + 7.5 * s, b - 33 * s); strokeLine(ctx, '#ffd25a', 2.4 * s);
  ctx.beginPath(); ctx.arc(x + 1.5 * s, b - 31 * s, 1.8 * s, 0, TAU); ctx.fillStyle = '#4ae0d0'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 3.5 * s, b - 47 * s); ctx.lineTo(x + 8 * s, b - 46.5 * s); strokeLine(ctx, '#4ae0d0', 1.3);
  ctx.beginPath(); ctx.arc(x - 1 * s, b - 43 * s, 1.5 * s, 0, TAU); ctx.fillStyle = '#ffd25a'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 12 * s, b - 1); ctx.quadraticCurveTo(x - 18 * s, b - 2 * s, x - 15 * s, b - 10 * s); strokeLine(ctx, OUT, 4.5 * s); ctx.beginPath(); ctx.moveTo(x - 12 * s, b - 1); ctx.quadraticCurveTo(x - 18 * s, b - 2 * s, x - 15 * s, b - 10 * s); strokeLine(ctx, '#3a3050', 2.2 * s);
}
function egyptColumn(ctx, x, by, s, rnd, broken) {
  const w = 14 * s, h = (broken ? 62 + rnd() * 18 : 96 + rnd() * 10) * s, top = by - h;
  const shaft = () => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, by + 3);
    ctx.lineTo(x - w / 2, top + 6);
    if (broken) { ctx.lineTo(x - w * 0.2, top - 4); ctx.lineTo(x + w * 0.05, top + 3); ctx.lineTo(x + w * 0.3, top - 2); ctx.lineTo(x + w / 2, top + 8); }
    else ctx.lineTo(x + w / 2, top + 6);
    ctx.lineTo(x + w / 2, by + 3);
    ctx.closePath();
  };
  shaft(); paint(ctx, lgY(ctx, [[top, '#f6d6a2'], [by, '#e2ae78']]), 2);
  ctx.save(); shaft(); ctx.clip();
  ctx.fillStyle = rgba('#a8643a', 0.3); ctx.fillRect(x + w * 0.18, top - 10, w, h + 20);
  ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(x + k * w * 0.26, top); ctx.lineTo(x + k * w * 0.26, by); } strokeLine(ctx, rgba('#a8643a', 0.35), 0.9);
  for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#3a8ab0', '#c84a3a', '#e8b030'][k]; ctx.fillRect(x - w, top + 14 + k * 3.4, w * 2, 2); }
  ctx.restore();
  if (!broken) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, top + 7); ctx.quadraticCurveTo(x - w * 1.1, top + 2, x - w * 0.95, top - 7);
    ctx.lineTo(x + w * 0.95, top - 7); ctx.quadraticCurveTo(x + w * 1.1, top + 2, x + w / 2, top + 7); ctx.closePath();
    paint(ctx, lgY(ctx, [[top - 7, '#7ad0b0'], [top + 7, '#3a9a8a']]), 2);
    ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(x + k * w * 0.18, top + 6); ctx.lineTo(x + k * w * 0.36, top - 6); } strokeLine(ctx, rgba('#1e6a5a', 0.6), 0.9);
    rr(ctx, x - w * 0.8, top - 11, w * 1.6, 5, 1); paint(ctx, '#f0cc96', 1.6);
  }
  rr(ctx, x - w * 0.75, by - 3, w * 1.5, 7, 1.5); paint(ctx, '#e0aa74', 1.6);
}
function stele(ctx, x, by, s, rnd) {
  const w = 24 * s, h = 40 * s;
  const sh = () => { ctx.beginPath(); ctx.moveTo(x - w / 2, by + 2); ctx.lineTo(x - w / 2, by - h + w / 2); ctx.arc(x, by - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, by + 2); ctx.closePath(); };
  sh(); paint(ctx, lgY(ctx, [[by - h, '#f4d2a0'], [by, '#dca472']]), 2);
  ctx.save(); sh(); ctx.clip();
  ctx.fillStyle = rgba('#a8643a', 0.25); ctx.fillRect(x + w * 0.25, by - h, w, h + 4);
  glyphCell(ctx, 0, x, by - h + w * 0.42, w * 0.26); strokeLine(ctx, '#2a6aa8', 1.3);
  glyphs(ctx, x - w * 0.4, by - h + w * 0.72, w * 0.8, h - w * 0.8, rnd, '#8a4a2a', 6.4 * s, 0.8);
  ctx.restore();
  sh(); paint(ctx, null, 2);
}
function amphora(ctx, x, by, s, rnd, lw = 1.6) {
  const col = rnd() < 0.5 ? '#d8743e' : '#c8603a';
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x - 2.4 * s, by - 17 * s);
    ctx.quadraticCurveTo(x - 7.5 * s, by - 13 * s, x - 6.5 * s, by - 6 * s);
    ctx.quadraticCurveTo(x - 5 * s, by, x, by);
    ctx.quadraticCurveTo(x + 5 * s, by, x + 6.5 * s, by - 6 * s);
    ctx.quadraticCurveTo(x + 7.5 * s, by - 13 * s, x + 2.4 * s, by - 17 * s);
    ctx.closePath();
  };
  ctx.beginPath(); ctx.moveTo(x - 2.5 * s, by - 16 * s); ctx.quadraticCurveTo(x - 7 * s, by - 19 * s, x - 5.5 * s, by - 12 * s); ctx.moveTo(x + 2.5 * s, by - 16 * s); ctx.quadraticCurveTo(x + 7 * s, by - 19 * s, x + 5.5 * s, by - 12 * s);
  strokeLine(ctx, OUT, 2.6 * s + lw); ctx.stroke(); strokeLine(ctx, col, 1.4 * s);
  body(); paint(ctx, ball(ctx, x, by - 9 * s, 8 * s, col, 0.3, 0.3), lw);
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x - 8 * s, by - 11 * s, 16 * s, 1.6 * s);
  ctx.fillStyle = '#f4e2b0'; ctx.fillRect(x - 8 * s, by - 9 * s, 16 * s, 1.2 * s);
  ctx.restore();
  rr(ctx, x - 3.2 * s, by - 19.5 * s, 6.4 * s, 3 * s, 1); paint(ctx, shade(col, 0.1), lw * 0.8);
  gloss(ctx, x - 3 * s, by - 11 * s, 1.4 * s, 2.6 * s, 0.4, 0.2);
}
function scarab(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.62);
  ctx.beginPath(); for (const sd of [-1, 1]) for (let k = -1; k <= 1; k++) { ctx.moveTo(sd * 2 * s, k * 2 * s); ctx.lineTo(sd * 5 * s, k * 2.8 * s); }
  strokeLine(ctx, OUT, 1);
  ell(ctx, 0, 0.5 * s, 3.2 * s, 4 * s); paint(ctx, ball(ctx, 0, 0, 4 * s, '#2a8a7a'), 1);
  ell(ctx, 0, -4 * s, 1.8 * s, 1.3 * s); paint(ctx, '#1e5a52', 1);
  ctx.beginPath(); ctx.moveTo(0, -2.6 * s); ctx.lineTo(0, 4.2 * s); strokeLine(ctx, rgba(OUT, 0.6), 0.6);
  ctx.restore();
}
// Torche sur pied : 'bronze' (trépied égyptien) ou 'tiki' (bambou)
function torch(ctx, x, gy, s, S, rnd, kind) {
  const h = (kind === 'tiki' ? 52 : 46) * s, fy = gy - h;
  if (kind === 'tiki') {
    rr(ctx, x - 2.4 * s, fy + 6 * s, 4.8 * s, h - 4 * s, 1.5); paint(ctx, vgrad(ctx, fy, gy, '#c8a060', 0.15, 0.2), 1.6);
    ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(x - 2.4 * s, fy + 6 * s + k * h / 4); ctx.lineTo(x + 2.4 * s, fy + 6 * s + k * h / 4); } strokeLine(ctx, rgba('#6a4a22', 0.8), 1.1);
    poly(ctx, [[x - 5.5 * s, fy - 1 * s], [x + 5.5 * s, fy - 1 * s], [x + 3.5 * s, fy + 8 * s], [x - 3.5 * s, fy + 8 * s]]); paint(ctx, '#8a5a2a', 1.6);
    ctx.beginPath(); ctx.moveTo(x - 5 * s, fy + 3 * s); ctx.lineTo(x + 5 * s, fy + 5 * s); ctx.moveTo(x - 5 * s, fy + 5 * s); ctx.lineTo(x + 5 * s, fy + 3 * s); strokeLine(ctx, rgba('#e8c890', 0.7), 0.9);
  } else {
    ctx.beginPath(); ctx.moveTo(x, fy + 6 * s); ctx.lineTo(x - 7 * s, gy + 1); ctx.moveTo(x, fy + 6 * s); ctx.lineTo(x + 7 * s, gy + 1); ctx.moveTo(x, fy + 6 * s); ctx.lineTo(x, gy + 1);
    strokeLine(ctx, OUT, 4.2 * s); ctx.stroke(); strokeLine(ctx, '#c8903a', 2 * s);
    ctx.beginPath(); ctx.moveTo(x - 7 * s, fy); ctx.quadraticCurveTo(x, fy + 10 * s, x + 7 * s, fy); ctx.closePath(); paint(ctx, lgY(ctx, [[fy, '#ffd060'], [fy + 8 * s, '#c8903a']]), 1.6);
  }
  glow(ctx, x, fy - 5 * s, 22 * s, '#ffb03a', 0.5);
  S.light(x, fy - 5 * s, 26 * s, { a: 0.9 });
  const fl = (k, col) => { ctx.beginPath(); ctx.moveTo(x - 5 * k * s, fy); ctx.quadraticCurveTo(x - 6 * k * s, fy - 8 * k * s, x - 0.5 * s + (rnd() - 0.5) * 2, fy - 15 * k * s); ctx.quadraticCurveTo(x + 2 * k * s, fy - 9 * k * s, x + 5 * k * s, fy); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
  fl(1, '#ff6a2a'); fl(0.66, '#ffb03a'); fl(0.34, '#fff2a0');
}
function carvedBlock(ctx, x, by, s, rnd) {
  const w = 34 * s, h = 22 * s;
  poly(ctx, [[x - w / 2, by], [x - w / 2 + 2, by - h], [x + w / 2 - 3, by - h - 2], [x + w / 2, by]]);
  paint(ctx, lgY(ctx, [[by - h, '#f2cc96'], [by, '#d29a64']]), 2);
  ctx.save(); poly(ctx, [[x - w / 2, by], [x - w / 2 + 2, by - h], [x + w / 2 - 3, by - h - 2], [x + w / 2, by]]); ctx.clip();
  glyphs(ctx, x - w / 2 + 3, by - h + 2, w - 6, h - 6, rnd, '#8a4a2a', 7 * s, 1);
  ctx.fillStyle = rgba('#7a3a1a', 0.2); ctx.fillRect(x + w * 0.2, by - h - 4, w, h + 6);
  ctx.restore();
  gloss(ctx, x - w * 0.25, by - h + 3, w * 0.2, 1.4, 0.45, 0);
}

// ------------------------------------------------------------------ Jungle Sauvage
function jungleDef() {
  const LEAF = ['#3fae4a', '#4dbd52', '#2f9a48', '#5cc85a'];
  const FLOW = ['#ff4a6a', '#ff7a2a', '#ffd23f', '#ff5ad0'];
  return {
    ambient: 'fireflies', kind: 'day', horizon: 186,
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#2f9e94'], [0.3, '#6cc8aa'], [0.58, '#c4ecbc'], [1, '#effbd8']]);
      sunDisc(ctx, 104, 58, 20, { core: '#ffffff', edge: '#fff4a8', glow: '#f6ffd0', glowR: 7, rayA: 0.24 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const x0 = 40 + i * 52 + S.r(-12, 12), w = S.r(8, 22);
        const g = ctx.createLinearGradient(x0, 0, x0 + 150, 300);
        g.addColorStop(0, rgba('#ffffe0', 0.2)); g.addColorStop(1, rgba('#ffffe0', 0));
        ctx.fillStyle = g;
        poly(ctx, [[x0, 0], [x0 + w, 0], [x0 + w + 160, 330], [x0 + 160 - w * 0.3, 330]]); ctx.fill();
      }
      ctx.restore();
    },
    layers: [
      L(40, 252, 0.03, (ctx, S) => {
        const W = S.W;
        const xs = S.spread(7, 0.55);
        const fall = S.ri(0, 6);
        xs.forEach((x, i) => {
          const w = S.r(46, 86), h = S.r(100, 175);
          S.rep(x, w, (xx, rnd) => {
            karst(ctx, xx, 262, w, h, i % 2 ? '#94ccb6' : '#a4d6c0', rnd);
            if (i === fall) {
              const ty = 262 - h + h * 0.18;
              rr(ctx, xx + w * 0.05 - 3, ty, 6, h * 0.82, 2); ctx.fillStyle = lgY(ctx, [[ty, rgba('#ffffff', 0.95)], [262, rgba('#e6fbff', 0.6)]]); ctx.fill();
            }
          });
        });
        ctx.fillStyle = lgY(ctx, [[190, rgba('#eefbea', 0)], [250, rgba('#eefbea', 0.85)], [292, rgba('#eefbea', 0.95)]]);
        ctx.fillRect(-5, 190, W + 10, 102);
        haze(ctx, W, 40, 292, '#e0f6e4', 0.25, 0.4);
      }),
      L(110, 182, 0.07, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 236, [[7, 1, 2], [4, 3, 5], [2, 7, 11]]);
        const tx = S.r(0, W);
        S.rep(tx, 60, (xx) => mayaTemple(ctx, xx, f(xx) + 4, 0.9, '#78a89a', '#8ebcac', '#3e6a64'));
        for (const row of [0, 1]) {
          const n = row ? 46 : 38;
          for (let i = 0; i < n; i++) {
            const x = (i + S.rand() * 0.7) * W / n, r = S.r(10, 18) * (row ? 0.9 : 1.15);
            const c = row ? S.pick(['#5aa888', '#62b090', '#549e82']) : S.pick(['#7cbea4', '#86c6aa', '#74b89e']);
            S.rep(x, 30, (xx) => blob(ctx, [[xx, f(xx) - r * 0.4 + (row ? 10 : -6), r], [xx + r * 0.7, f(xx) + (row ? 12 : -2), r * 0.7]], c, { lw: 0, light: 0.22, hla: 0.16, dark: shade(c, -0.12) }));
          }
        }
        profilePath(ctx, W, (x) => f(x) + 12, 300);
        ctx.fillStyle = lgY(ctx, [[240, '#5aa486'], [292, '#4e9678']]); ctx.fill();
        haze(ctx, W, 110, 292, '#dff4e0', 0.32, 0.22);
      }),
      L(20, 272, 0.16, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 258, [[4, 1, 2], [2.5, 3, 5]]);
        // falaise et cascade
        const cx = S.r(0, W);
        S.rep(cx, 110, (xx, rnd) => cliffFall(ctx, xx, f(xx) + 4, rnd));
        // troncs fins lointains + lianes
        const xs = S.spread(6, 0.6);
        xs.forEach((x) => { const w = S.r(9, 13); S.rep(x, 40, (xx, rnd) => jungleTrunk(ctx, xx, 10, f(xx) + 4, w, '#5e8a64', rnd, 0, '#4e7a58')); });
        for (let i = 0; i < xs.length; i++) {
          const a = xs[i], b = xs[(i + 1) % xs.length] + (i === xs.length - 1 ? W : 0);
          if (S.rand() < 0.35) continue;
          const y0 = S.r(40, 90), sag = S.r(30, 70);
          S.rep((a + b) / 2, (b - a) / 2 + 10, (xx) => { const o = xx - (a + b) / 2; ctx.beginPath(); ctx.moveTo(a + o, y0); ctx.quadraticCurveTo((a + b) / 2 + o, y0 + sag * 2, b + o, y0 + S.r(-10, 10)); strokeLine(ctx, '#4e7a58', 2.2); });
        }
        for (let i = 0; i < 26; i++) {
          const x = S.r(0, W), r = S.r(10, 17);
          const c = S.pick(['#4a9a62', '#54a46a', '#46925c']);
          S.rep(x, 28, (xx) => blob(ctx, [[xx, f(xx) - r * 0.3, r], [xx + r * 0.8, f(xx) + 2, r * 0.7], [xx - r * 0.8, f(xx) + 3, r * 0.6]], c, { lw: 0, light: 0.24, hla: 0.18, dark: shade(c, -0.14) }));
        }
        profilePath(ctx, W, (x) => f(x) + 6, 300);
        ctx.fillStyle = lgY(ctx, [[256, '#4a9460'], [292, '#3e8456']]); ctx.fill();
        haze(ctx, W, 20, 292, '#d6f0d8', 0.3, 0.14);
      }),
      L(0, 292, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 262, [[2.5, 1, 2], [1.5, 4, 7]]);
        const trunks = S.spread(3, 0.35);
        // lianes en festons entre les grands troncs (derrière)
        for (let i = 0; i < trunks.length; i++) {
          const a = trunks[i], b = trunks[(i + 1) % trunks.length] + (i === trunks.length - 1 ? W : 0);
          const y0 = S.r(26, 60), y1 = S.r(30, 70), sag = S.r(40, 80);
          S.rep((a + b) / 2, (b - a) / 2 + 20, (xx, rnd) => { const o = xx - (a + b) / 2; liana(ctx, [[a + o, y0], [(a + b) / 2 + o, y0 + sag], [b + o, y1]], rnd, LEAF[i % 4], 'u'); });
        }
        // ruines : tête de chat sculptée envahie de mousse
        const ix = mod(trunks[0] + S.r(110, 190), W);
        S.rep(ix, 70, (xx, rnd) => { idolHead(ctx, xx, fM(xx) + 7, 1, rnd); torch(ctx, xx - 38, fM(xx) + 8, 0.9, S, rnd, 'tiki'); torch(ctx, xx + 38, fM(xx) + 8, 0.9, S, rnd, 'tiki'); });
        trunks.forEach((x, i) => {
          const w = S.r(24, 32);
          S.rep(x, w * 2, (xx, rnd) => jungleTrunk(ctx, xx, -10, fM(xx) + 6, w, i % 2 ? '#7a5a42' : '#86644a', rnd, 2));
        });
        // lianes pendantes
        for (const x of S.spread(7, 0.8)) {
          const len = S.r(70, 170), sway = S.r(-14, 14);
          S.rep(x, 20, (xx, rnd) => liana(ctx, [[xx, -6], [xx + sway * 0.5, len * 0.5], [xx + sway, len]], rnd, LEAF[Math.floor(rnd() * 4)], 'hang'));
        }
        // feuillage du haut (canopée)
        for (let i = 0; i < 30; i++) {
          const x = (i + S.rand() * 0.6) * W / 30, r = S.r(14, 24), y = S.r(-8, 6);
          const c = S.pick(['#2f8a44', '#36964a', '#2a7e40']);
          S.rep(x, 40, (xx) => blob(ctx, [[xx, y, r], [xx + r * 0.8, y + r * 0.35, r * 0.7], [xx - r * 0.7, y + r * 0.4, r * 0.65]], c, { lw: 2, light: 0.2, hla: 0.18 }));
        }
        for (let i = 0; i < 22; i++) {
          const x = S.r(0, W), y = S.r(14, 34);
          S.rep(x, 16, (xx, rnd) => leafShape(ctx, xx, y, 7 + rnd() * 4, Math.PI / 2 + (rnd() - 0.5) * 1.2, S.pick(LEAF), 1.4));
        }
        // grandes feuilles et fleurs au pied
        for (const x of S.spread(7, 0.7)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const gy = fM(xx) + 8;
            if (kind < 0.45) { for (let k = 0; k < 3; k++) monstera(ctx, xx + (k - 1) * 8, gy, 30 + rnd() * 12, -Math.PI / 2 + (k - 1) * 0.75 + (rnd() - 0.5) * 0.3, LEAF[(k + 1) % 4], rnd); }
            else if (kind < 0.8) bananaPlant(ctx, xx, gy, 0.9 + rnd() * 0.3, rnd, LEAF[Math.floor(rnd() * 4)]);
            else fern(ctx, xx, gy, 1, rnd, '#3fa84a');
          });
        }
        for (const x of S.spread(9, 0.9)) S.rep(x, 10, (xx, rnd) => hibiscus(ctx, xx, fM(xx) + 2 - rnd() * 18, 3.6 + rnd() * 1.4, FLOW[Math.floor(rnd() * 4)], rnd() * TAU));
        profilePath(ctx, W, (x) => fM(x) + 6, 300);
        ctx.fillStyle = lgY(ctx, [[258, '#3e9a44'], [290, '#2f7e3a']]); ctx.fill();
        haze(ctx, W, 90, 282, '#d8f4d8', 0, 0.08);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [9, 4, 8, 'grass'], edge2: [9, 3, 6.5, 'grass'],
          fill: [[262, '#7fd04a'], [288, '#5cb63e'], [330, '#449a38'], [360, '#357e30']],
          fill2: [[300, '#68c046'], [330, '#4aa23c'], [360, '#357e30']],
          shadow: '#1e4a22', rim: rgba('#c8ff8e', 0.85), rim2: rgba('#b4f080', 0.7),
          stroke: mix(OUT, '#1e4a22', 0.3), stroke2: rgba('#1e4a22', 0.8),
          path: { fill: [[280, '#b08452'], [296, '#9c7246'], [312, '#86603c']], edge: '#5a3a22' },
          upper(ctx, S, F) {
            scatter(S, 30, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y, rnd) => tuft(ctx, x, y, 0.6, '#3e9a3a', rnd), 8);
            scatter(S, 10, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 2, (x, y, rnd) => flower(ctx, x, y, 1.6, FLOW[Math.floor(rnd() * 4)], '#fff2a0'), 4);
          },
          pathDeco(ctx, S, F) {
            // racines qui traversent le chemin
            for (const x of S.spread(4, 0.7)) {
              S.rep(x, 40, (xx, rnd) => {
                ctx.beginPath(); ctx.moveTo(xx - 30, F.fP0(xx) + 1);
                ctx.bezierCurveTo(xx - 10, F.fP0(xx) + 10, xx + 6, F.fP1(xx) - 6, xx + 26 + rnd() * 10, F.fP1(xx) + 4);
                strokeLine(ctx, rgba('#4a2e1a', 0.75), 4.4); ctx.stroke(); strokeLine(ctx, '#8a6040', 2.6);
              });
            }
            scatter(S, 50, (x) => F.fP0(x) + 3, (x) => F.fP1(x) + 3, (x, y, rnd) => { ell(ctx, x, y, 1.2 + rnd() * 1.4, 0.8); ctx.fillStyle = rgba('#5a3a22', 0.5); ctx.fill(); }, 4);
            scatter(S, 22, (x) => F.fP0(x) + 3, (x) => F.fP1(x) + 4, (x, y, rnd) => leafShape(ctx, x, y, 2.4 + rnd(), rnd() * 3, S.pick(['#5cb84a', '#7ac850', '#4aa040']), 0.6), 5);
          },
          lower(ctx, S, F) {
            scatter(S, 50, (x) => F.fP1(x) + 8, () => 360, (x, y, rnd) => tuft(ctx, x, y, 0.75, '#2f8a34', rnd), 8);
            scatter(S, 7, (x) => F.fP1(x) + 12, () => 350, (x, y, rnd) => mushroom(ctx, x, y, 0.8 + rnd() * 0.3, rnd() < 0.5 ? '#ff5a4a' : '#ffa03a'), 6);
            scatter(S, 18, (x) => F.fP1(x) + 10, () => 356, (x, y, rnd) => flower(ctx, x, y, 1.9, FLOW[Math.floor(rnd() * 4)], '#fff2a0', 0.8), 5);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 60, (xx, rnd) => {
            const by = 358 + rnd() * 4;
            if (kind < 0.4) { monstera(ctx, xx - 6, by + 8, 40, -Math.PI / 2 - 0.6, '#3aa648', rnd); monstera(ctx, xx + 6, by + 8, 36, -Math.PI / 2 + 0.7, '#46b44e', rnd); }
            else if (kind < 0.7) { fern(ctx, xx, by + 6, 1.4, rnd, '#36a044'); hibiscus(ctx, xx + 18, by - 8, 5, FLOW[Math.floor(rnd() * 4)], rnd()); }
            else { leafClump(ctx, xx, by + 8, 1.1, '#3eaa48', rnd, 5); mushroom(ctx, xx + 20, by + 4, 1.3, '#ff5a4a'); }
          });
        }
      }, true),
    ],
  };
}

function karst(ctx, x, by, w, h, col, rnd) {
  const top = by - h;
  const pts = [[x - w / 2, by + 2], [x - w * 0.52 + rnd() * 6, by - h * 0.4], [x - w * 0.42, top + h * 0.14], [x - w * 0.18, top + 2], [x + w * 0.12, top], [x + w * 0.38, top + h * 0.12], [x + w * 0.48 - rnd() * 6, by - h * 0.5], [x + w / 2, by + 2]];
  smooth(ctx, pts, false, 0.5); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.save(); smooth(ctx, pts, false, 0.5); ctx.closePath(); ctx.clip();
  ctx.fillStyle = rgba(shade(col, -0.35), 0.28); ctx.fillRect(x + w * 0.12, top - 5, w, h + 10);
  ctx.beginPath(); for (let k = 0; k < 4; k++) { const yy = top + h * (0.25 + k * 0.18); ctx.moveTo(x - w * 0.3, yy); ctx.quadraticCurveTo(x, yy + 4, x + w * 0.25, yy - 2); } strokeLine(ctx, rgba(shade(col, -0.3), 0.25), 1.2);
  ctx.restore();
  ctx.beginPath();
  for (let k = 0; k < 5; k++) addCircle(ctx, x - w * 0.32 + k * w * 0.16, top + 4 + Math.abs(k - 2) * 3, w * (0.12 + rnd() * 0.05));
  ctx.fillStyle = shade(col, -0.12); ctx.fill();
}
function mayaTemple(ctx, x, by, s, col, lt, dk) {
  for (let i = 0; i < 5; i++) {
    const w = (92 - i * 15) * s, h = 11 * s;
    ctx.fillStyle = i % 2 ? col : shade(col, 0.05);
    ctx.fillRect(x - w / 2, by - (i + 1) * h, w, h + 0.6);
    ctx.fillStyle = rgba(dk, 0.35); ctx.fillRect(x + w * 0.22, by - (i + 1) * h, w * 0.28, h + 0.6);
  }
  ctx.fillStyle = lt; ctx.fillRect(x - 8 * s, by - 55 * s, 16 * s, 55 * s);
  ctx.beginPath(); for (let k = 1; k < 14; k++) { ctx.moveTo(x - 8 * s, by - k * 4 * s); ctx.lineTo(x + 8 * s, by - k * 4 * s); } strokeLine(ctx, rgba(dk, 0.35), 0.7);
  ctx.fillStyle = col;
  ctx.fillRect(x - 13 * s, by - 74 * s, 26 * s, 20 * s);
  poly(ctx, [[x - 13 * s, by - 74 * s], [x - 12 * s, by - 84 * s], [x - 5 * s, by - 74 * s]]); ctx.fill();
  poly(ctx, [[x + 13 * s, by - 74 * s], [x + 12 * s, by - 84 * s], [x + 5 * s, by - 74 * s]]); ctx.fill();
  ctx.fillStyle = dk; rr(ctx, x - 4 * s, by - 68 * s, 8 * s, 14 * s, 3 * s); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 6.5 * s, by - 70 * s, 1.4 * s, 0, TAU); ctx.arc(x + 6.5 * s, by - 70 * s, 1.4 * s, 0, TAU); ctx.fill();
}
function cliffFall(ctx, x, by, rnd) {
  const top = 70, w = 120;
  const pts = [[x - w * 0.55, by + 4], [x - w * 0.5, by - 60], [x - w * 0.42, top + 30], [x - w * 0.3, top + 4], [x - w * 0.05, top], [x + w * 0.2, top + 6], [x + w * 0.38, top + 26], [x + w * 0.5, by - 70], [x + w * 0.58, by + 4]];
  smooth(ctx, pts, false, 0.4); ctx.closePath();
  ctx.fillStyle = lgY(ctx, [[top, '#7aa48a'], [by, '#5e8a72']]); ctx.fill();
  ctx.save(); smooth(ctx, pts, false, 0.4); ctx.closePath(); ctx.clip();
  ctx.fillStyle = rgba('#3e6a56', 0.35); ctx.fillRect(x + w * 0.15, top - 4, w, by - top + 10);
  ctx.beginPath(); for (let k = 0; k < 6; k++) { const yy = top + 20 + k * 26 + rnd() * 6; ctx.moveTo(x - w * 0.5, yy); ctx.lineTo(x - w * 0.15, yy + 3); ctx.moveTo(x + w * 0.2, yy + 8); ctx.lineTo(x + w * 0.5, yy + 5); } strokeLine(ctx, rgba('#3e6a56', 0.45), 1.2);
  ctx.restore();
  // mousse et buissons au sommet
  const cs = [];
  for (let k = 0; k < 7; k++) cs.push([x - w * 0.4 + k * w * 0.13, top + 4 + Math.abs(k - 3) * 3, 9 + rnd() * 5]);
  blob(ctx, cs, '#58a66a', { lw: 0, light: 0.25, hla: 0.2 });
  // cascade
  const fx = x - 6, fw = 26;
  ctx.fillStyle = lgY(ctx, [[top, '#eafcff'], [by, '#a8e8f4']]);
  ctx.beginPath(); ctx.moveTo(fx - fw / 2, top + 8); ctx.quadraticCurveTo(fx - fw / 2 - 4, top + 2, fx - fw / 2 + 2, top - 2); ctx.lineTo(fx + fw / 2 - 2, top - 2); ctx.quadraticCurveTo(fx + fw / 2 + 4, top + 2, fx + fw / 2, top + 8); ctx.lineTo(fx + fw / 2 + 4, by - 6); ctx.lineTo(fx - fw / 2 - 4, by - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); for (let k = 0; k < 6; k++) { const xx = fx - fw / 2 + 3 + k * (fw - 6) / 5; ctx.moveTo(xx, top + 6 + rnd() * 20); ctx.lineTo(xx + (k - 2.5) * 0.6, by - 14 - rnd() * 30); } strokeLine(ctx, rgba('#7acde0', 0.55), 1.4);
  ctx.beginPath(); for (let k = 0; k < 4; k++) { const xx = fx - fw / 2 + 5 + k * 6; ctx.moveTo(xx, top + 30 + rnd() * 40); ctx.lineTo(xx, top + 60 + rnd() * 70); } strokeLine(ctx, rgba('#ffffff', 0.8), 1.2);
  // bassin + écume + brume
  ell(ctx, fx, by - 2, 46, 6); ctx.fillStyle = lgY(ctx, [[by - 8, '#7ad8e8'], [by + 4, '#3ab0c8']]); ctx.fill();
  blob(ctx, [[fx - 14, by - 6, 7], [fx, by - 9, 9], [fx + 14, by - 6, 7], [fx - 24, by - 3, 5], [fx + 24, by - 3, 5]], '#ffffff', { lw: 0, dark: '#d8f6ff', flat: by - 1 });
  glow(ctx, fx, by - 14, 40, '#ffffff', 0.45);
}
function jungleTrunk(ctx, x, top, by, w, col, rnd, lw = 2, flat = null) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - w * 1.5, by + 4);
    ctx.quadraticCurveTo(x - w * 0.75, by - 4, x - w * 0.6, by - 30);
    ctx.lineTo(x - w * 0.5, top);
    ctx.lineTo(x + w * 0.5, top);
    ctx.lineTo(x + w * 0.58, by - 26);
    ctx.quadraticCurveTo(x + w * 0.7, by - 4, x + w * 1.6, by + 4);
    ctx.closePath();
  };
  path();
  if (flat) { ctx.fillStyle = flat; ctx.fill(); return; }
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, shade(col, 0.18)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.32));
  paint(ctx, g, lw);
  ctx.save(); path(); ctx.clip();
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) { const bx = x + k * w * 0.2; ctx.moveTo(bx, top); for (let y = top; y < by; y += 12) ctx.lineTo(bx + Math.sin(y * 0.08 + k) * 1.4, y + 12); }
  strokeLine(ctx, rgba(shade(col, -0.4), 0.45), 1.1);
  ctx.beginPath(); ctx.moveTo(x - w * 0.25, by - 22); ctx.quadraticCurveTo(x - w * 0.5, by - 4, x - w * 1.0, by + 4); ctx.moveTo(x + w * 0.28, by - 18); ctx.quadraticCurveTo(x + w * 0.55, by - 2, x + w * 1.1, by + 4);
  strokeLine(ctx, rgba(OUT, 0.5), 1.4);
  for (let k = 0; k < 5; k++) { const yy = top + 30 + rnd() * (by - top - 60); ell(ctx, x - w * 0.42, yy, w * 0.22, 8 + rnd() * 10); ctx.fillStyle = rgba('#5cc04a', 0.75); ctx.fill(); }
  ctx.restore();
  if (lw > 0 && rnd() < 0.7) { const ky = top + 40 + rnd() * (by - top - 100); ell(ctx, x + w * 0.1, ky, w * 0.18, w * 0.26); paint(ctx, '#3a2418', 1.4); }
}
function liana(ctx, pts, rnd, leafCol, mode) {
  const draw = (col, lw) => { smooth(ctx, pts, false, 0.6); strokeLine(ctx, col, lw); };
  draw(OUT, 5.2); draw('#6a8a3a', 3); draw(rgba('#b8e070', 0.5), 1);
  const n = mode === 'hang' ? 7 : 8;
  // feuilles le long (approx. linéaire par segments)
  const P = (t) => { const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; };
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 0.5), [px, py] = P(t), side = k % 2 ? -1 : 1;
    leafShape(ctx, px + side * 5, py + 2, 5 + rnd() * 2.5, side * 0.7 + Math.PI / 2 * (mode === 'hang' ? 1 : 0.4), leafCol, 1.4);
  }
  if (mode === 'hang') { const [ex, ey] = pts[pts.length - 1]; ctx.beginPath(); ctx.arc(ex + 3, ey, 3.5, Math.PI, Math.PI * 2.6); strokeLine(ctx, OUT, 4.4); ctx.stroke(); strokeLine(ctx, '#6a8a3a', 2.2); }
}
function monstera(ctx, x, y, len, ang, col, rnd, lw = 2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.22, -len * 0.05, len * 0.36, 0);
  strokeLine(ctx, OUT, 4.4); ctx.stroke(); strokeLine(ctx, shade(col, -0.12), 2.4);
  const b = len * 0.3, tip = len * 1.08, r = len * 0.36;
  // cœur : encoche à la base, pointe au bout
  const leaf = () => {
    ctx.beginPath();
    ctx.moveTo(b + r * 0.18, 0);
    ctx.bezierCurveTo(b - r * 0.25, -r * 0.55, b + r * 0.25, -r * 1.25, b + r * 1.05, -r * 1.05);
    ctx.bezierCurveTo(tip - r * 0.6, -r * 0.85, tip - r * 0.1, -r * 0.3, tip, 0);
    ctx.bezierCurveTo(tip - r * 0.1, r * 0.3, tip - r * 0.6, r * 0.85, b + r * 1.05, r * 1.05);
    ctx.bezierCurveTo(b + r * 0.25, r * 1.25, b - r * 0.25, r * 0.55, b + r * 0.18, 0);
    ctx.closePath();
  };
  leaf();
  const g = ctx.createLinearGradient(b, -r, tip, r);
  g.addColorStop(0, shade(col, 0.22)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.25));
  paint(ctx, g, lw);
  ctx.save(); leaf(); ctx.clip();
  const hole = shade(col, -0.55);
  ctx.fillStyle = hole;
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const t = 0.22 + k * 0.24, bx = lerp(b + r * 0.3, tip - r * 0.15, t);
    // fente en coin depuis le bord vers la nervure
    ctx.beginPath();
    ctx.moveTo(bx - r * 0.12, side * r * 1.4); ctx.lineTo(bx + r * 0.14, side * r * 1.4);
    ctx.quadraticCurveTo(bx + r * 0.08, side * r * 0.6, bx + r * 0.02, side * r * 0.3);
    ctx.quadraticCurveTo(bx - r * 0.02, side * r * 0.65, bx - r * 0.12, side * r * 1.4);
    ctx.fill();
    if (k < 2) { ell(ctx, bx + r * 0.16, side * r * 0.2, r * 0.07, r * 0.05); ctx.fill(); }
  }
  ctx.beginPath(); ctx.moveTo(b + r * 0.2, 0); ctx.lineTo(tip - r * 0.08, 0); strokeLine(ctx, rgba(shade(col, -0.38), 0.8), 1.3);
  ell(ctx, b + r * 0.75, -r * 0.62, r * 0.32, r * 0.1, 0.25); ctx.fillStyle = rgba('#ffffff', 0.28); ctx.fill();
  ctx.restore();
  leaf(); paint(ctx, null, lw);
  ctx.restore();
}
function bananaPlant(ctx, x, gy, s, rnd, col) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5, a = -Math.PI / 2 + t * 2.2 + (rnd() - 0.5) * 0.2, len = (40 + rnd() * 14) * s * (1 - Math.abs(t) * 0.3);
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const bx = x + t * 6 * s, by = gy;
    const tx = bx + dx * len, ty = by + dy * len + len * 0.25 * Math.abs(t) * 2;
    const mx = bx + dx * len * 0.5, my = by + dy * len * 0.5;
    const w = len * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(mx + nx * w * 1.4, my + ny * w * 1.4, tx, ty);
    ctx.quadraticCurveTo(mx - nx * w * 1.4, my - ny * w * 1.4, bx, by);
    ctx.closePath();
    const g = ctx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, shade(col, -0.2)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, 0.15));
    paint(ctx, g, 2);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, tx, ty); strokeLine(ctx, rgba('#e8ffb0', 0.6), 1.3);
    ctx.beginPath();
    for (let k = 1; k < 5; k++) { const u = k / 5, px = lerp(bx, tx, u), py = lerp(by, ty, u), sd = k % 2 ? 1 : -1; ctx.moveTo(px + nx * sd * w * 0.3, py + ny * sd * w * 0.3); ctx.lineTo(px + nx * sd * w * 1.1 + dx * 2, py + ny * sd * w * 1.1 + dy * 2); }
    strokeLine(ctx, rgba(shade(col, -0.4), 0.7), 1.1);
  }
}
function fern(ctx, x, gy, s, rnd, col) {
  for (let i = 0; i < 6; i++) {
    const t = i / 5 - 0.5, a = -Math.PI / 2 + t * 2.4, len = (24 + rnd() * 8) * s * (1 - Math.abs(t) * 0.35);
    const ex = x + Math.cos(a) * len, ey = gy + Math.sin(a) * len * 0.8 + Math.abs(t) * len * 0.5;
    const mx = x + Math.cos(a) * len * 0.5, my = gy + Math.sin(a) * len * 0.7 - 4 * s;
    ctx.beginPath(); ctx.moveTo(x, gy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    strokeLine(ctx, OUT, 3.6 * s); ctx.strokeStyle = shade(col, -0.15); ctx.lineWidth = 1.6 * s; ctx.stroke();
    for (let k = 1; k <= 7; k++) {
      const u = k / 8, px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * mx + u * u * ex, py = (1 - u) * (1 - u) * gy + 2 * (1 - u) * u * my + u * u * ey;
      const ls = (1 - u * 0.6) * 4.5 * s;
      for (const sd of [-1, 1]) leafShape(ctx, px + sd * ls * 0.5, py - ls * 0.2, ls, a + sd * 1.1, k % 2 ? col : shade(col, 0.1), 1);
    }
  }
}
function hibiscus(ctx, x, y, r, col, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; addCircle(ctx, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.72); }
  ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.fillStyle = ball(ctx, x, y, r * 1.4, col, 0.3, 0.25); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fillStyle = shade(col, -0.4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(rot - 0.6) * r * 1.5, y + Math.sin(rot - 0.6) * r * 1.5); strokeLine(ctx, '#fff2a0', 1.2);
  ctx.beginPath(); ctx.arc(x + Math.cos(rot - 0.6) * r * 1.5, y + Math.sin(rot - 0.6) * r * 1.5, 1.1, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill();
}
function mushroom(ctx, x, gy, s, col) {
  rr(ctx, x - 2 * s, gy - 8 * s, 4 * s, 9 * s, 1.5 * s); paint(ctx, '#fff2dc', 1.4);
  ctx.beginPath(); ctx.moveTo(x - 7 * s, gy - 7 * s); ctx.quadraticCurveTo(x - 7 * s, gy - 15 * s, x, gy - 15 * s); ctx.quadraticCurveTo(x + 7 * s, gy - 15 * s, x + 7 * s, gy - 7 * s); ctx.closePath();
  paint(ctx, ball(ctx, x, gy - 11 * s, 7 * s, col), 1.6);
  ctx.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-3, -11, 1.3], [2, -13, 1], [3.5, -9, 0.9]]) { ctx.beginPath(); ctx.arc(x + dx * s, gy + dy * s, r * s, 0, TAU); ctx.fill(); }
}
function idolHead(ctx, x, by, s, rnd) {
  const w = 46 * s, h = 44 * s, top = by - h;
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, by + 2);
    ctx.lineTo(x - w / 2, top + 10 * s);
    ctx.lineTo(x - w * 0.46, top - 12 * s); ctx.lineTo(x - w * 0.2, top + 2 * s);
    ctx.lineTo(x + w * 0.2, top + 2 * s); ctx.lineTo(x + w * 0.44, top - 10 * s);
    ctx.lineTo(x + w / 2, top + 10 * s);
    ctx.lineTo(x + w / 2, by + 2);
    ctx.closePath();
  };
  head(); paint(ctx, lgY(ctx, [[top, '#b8b4a0'], [by, '#8a8676']]), 2);
  ctx.save(); head(); ctx.clip();
  ctx.fillStyle = rgba('#4a4a3a', 0.25); ctx.fillRect(x + w * 0.15, top - 20, w, h + 30);
  ctx.beginPath(); ctx.moveTo(x - w * 0.5, top + h * 0.42); ctx.lineTo(x + w * 0.5, top + h * 0.42); ctx.moveTo(x - w * 0.5, top + h * 0.75); ctx.lineTo(x + w * 0.5, top + h * 0.75); strokeLine(ctx, rgba('#4a4a3a', 0.35), 1);
  // yeux mi-clos, nez, moustaches gravées
  ctx.beginPath();
  ctx.moveTo(x - w * 0.32, top + h * 0.34); ctx.quadraticCurveTo(x - w * 0.2, top + h * 0.42, x - w * 0.08, top + h * 0.34);
  ctx.moveTo(x + w * 0.08, top + h * 0.34); ctx.quadraticCurveTo(x + w * 0.2, top + h * 0.42, x + w * 0.32, top + h * 0.34);
  ctx.moveTo(x - 3 * s, top + h * 0.52); ctx.lineTo(x + 3 * s, top + h * 0.52); ctx.lineTo(x, top + h * 0.58); ctx.closePath();
  ctx.moveTo(x, top + h * 0.58); ctx.lineTo(x, top + h * 0.64); ctx.quadraticCurveTo(x - 4 * s, top + h * 0.7, x - 7 * s, top + h * 0.64); ctx.moveTo(x, top + h * 0.64); ctx.quadraticCurveTo(x + 4 * s, top + h * 0.7, x + 7 * s, top + h * 0.64);
  for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { ctx.moveTo(x + sd * w * 0.18, top + h * (0.6 + k * 0.06)); ctx.lineTo(x + sd * w * 0.45, top + h * (0.56 + k * 0.1)); }
  strokeLine(ctx, '#4a4a3a', 1.6);
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, top + 4); ctx.lineTo(x + w * 0.04, top + h * 0.2); ctx.lineTo(x + w * 0.14, top + h * 0.28); strokeLine(ctx, rgba('#3a3a2a', 0.6), 1);
  ctx.restore();
  head(); paint(ctx, null, 2);
  // mousse et lierre
  blob(ctx, [[x - w * 0.3, top + 4, 7 * s], [x - w * 0.1, top + 2, 6 * s], [x - w * 0.42, top - 4, 5 * s], [x + w * 0.38, top + 2, 5 * s]], '#5cb84a', { lw: 1.6 });
  ctx.beginPath(); ctx.moveTo(x - w * 0.42, top - 2); ctx.bezierCurveTo(x - w * 0.6, top + h * 0.3, x - w * 0.3, top + h * 0.6, x - w * 0.48, by); strokeLine(ctx, OUT, 3.6); ctx.stroke(); strokeLine(ctx, '#4a9a3a', 1.8);
  for (let k = 0; k < 5; k++) leafShape(ctx, x - w * 0.48 + (rnd() - 0.5) * 6, top + h * (0.1 + k * 0.2), 4, rnd() * 3, '#5cc04a', 1.2);
}

// ------------------------------------------------------------------ Fonds Marins
function underwaterDef() {
  const COR = ['#ff6a8a', '#ff8a4a', '#ffb03a', '#c86aff', '#ff4fb0'];
  return {
    ambient: 'bubbles', kind: 'water',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#8ef0f6'], [0.07, '#46cbe8'], [0.32, '#1e92cc'], [0.62, '#1264aa'], [1, '#0c4a8a']]);
      // surface vue d'en dessous
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = 0; x <= SKY_W; x += 6) ctx.lineTo(x, 16 + Math.sin(x * 0.045) * 4 + Math.sin(x * 0.11 + 1) * 2);
      ctx.lineTo(SKY_W, 0); ctx.closePath();
      ctx.fillStyle = lgY(ctx, [[0, '#e8ffff'], [22, '#9af0f8']]); ctx.fill();
      glow(ctx, 330, 0, 120, '#ffffff', 0.55);
      // réseau de caustiques près de la surface
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let x = 0; x <= SKY_W; x += 5) { const y = 30 + k * 13 + Math.sin(x * 0.06 + k * 2) * 5 + Math.sin(x * 0.17 + k) * 2.5; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        strokeLine(ctx, rgba('#d8fcff', 0.25 - k * 0.04), 1.6);
      }
      // rayons de lumière
      for (let i = 0; i < 8; i++) {
        const x0 = 150 + i * 42 + S.r(-14, 14), w = S.r(8, 26), len = S.r(220, 330);
        const g = ctx.createLinearGradient(x0, 0, x0 - 90, len);
        g.addColorStop(0, rgba('#e0ffff', 0.28)); g.addColorStop(1, rgba('#e0ffff', 0));
        ctx.fillStyle = g;
        poly(ctx, [[x0, 10], [x0 + w, 10], [x0 + w - 110, len], [x0 - 110 - w * 0.6, len]]); ctx.fill();
      }
      ctx.restore();
      // plancton
      for (let i = 0; i < 90; i++) { ctx.beginPath(); ctx.arc(S.r(0, SKY_W), S.r(20, 300), S.r(0.4, 1.1), 0, TAU); ctx.fillStyle = rgba('#d8fbff', S.r(0.2, 0.6)); ctx.fill(); }
      // banc de poissons lointain
      for (let i = 0; i < 26; i++) { const x = 60 + S.r(0, 110) + (i % 5) * 6, y = 96 + S.r(0, 36); fishShape(ctx, x, y, 2.2, rgba('#0e5a96', 0.75)); }
    },
    layers: [
      L(60, 232, 0.04, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 250, [[8, 1, 2], [5, 3, 5], [2, 7, 11]]);
        // arche rocheuse + colonnes englouties
        const ax = S.r(0, W);
        S.rep(ax, 90, (xx) => {
          ctx.fillStyle = '#2f80b4';
          ctx.beginPath(); ctx.moveTo(xx - 80, f(xx) + 10); ctx.quadraticCurveTo(xx - 76, 150, xx - 30, 132); ctx.quadraticCurveTo(xx + 20, 118, xx + 62, 150); ctx.quadraticCurveTo(xx + 84, 190, xx + 80, f(xx) + 10); ctx.lineTo(xx + 46, f(xx) + 10); ctx.quadraticCurveTo(xx + 46, 178, xx + 6, 172); ctx.quadraticCurveTo(xx - 40, 172, xx - 44, f(xx) + 10); ctx.closePath(); ctx.fill();
        });
        const tx = mod(ax + W * 0.48, W);
        S.rep(tx, 80, (xx, rnd) => {
          ctx.fillStyle = '#3488bc';
          ctx.fillRect(xx - 70, 196, 140, 8); poly(ctx, [[xx - 74, 196], [xx, 172], [xx + 74, 196]]); ctx.fill();
          for (let k = 0; k < 5; k++) { const cx = xx - 56 + k * 28, h = k === 3 ? 26 : 58; ctx.fillRect(cx - 5, f(xx) - h + 6, 10, h); ctx.fillRect(cx - 7, f(xx) - h + 2, 14, 4); }
        });
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[230, '#3a94c4'], [292, '#3a9ac6']]); ctx.fill();
        haze(ctx, W, 60, 292, '#2a8ec8', 0.45, 0.3);
      }),
      L(110, 182, 0.09, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 254, [[6, 1, 2], [3, 3, 5]]);
        for (const x of S.spread(16, 0.8)) { const h = S.r(80, 140); S.rep(x, 20, (xx, rnd) => kelp(ctx, xx, f(xx) + 6, h, '#2e8a8a', rnd, 0)); }
        for (let i = 0; i < 18; i++) {
          const x = S.r(0, W), r = S.r(10, 20);
          S.rep(x, 30, (xx) => blob(ctx, [[xx, f(xx), r], [xx + r * 0.8, f(xx) + 3, r * 0.6]], '#3a8eae', { lw: 0, light: 0.2, hla: 0.12 }));
        }
        profilePath(ctx, W, (x) => f(x) + 4, 300);
        ctx.fillStyle = lgY(ctx, [[248, '#4aa6c4'], [292, '#4aaac6']]); ctx.fill();
        haze(ctx, W, 110, 292, '#2a96cc', 0.42, 0.28);
      }),
      L(110, 182, 0.18, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 260, [[4, 1, 2], [2.5, 3, 5]]);
        const sx = S.r(0, W);
        S.rep(sx, 120, (xx, rnd) => shipwreck(ctx, xx, f(xx) + 4, 1, rnd));
        for (const x of S.spread(6, 0.7)) S.rep(x, 30, (xx, rnd) => rock(ctx, xx, f(xx) + 6, 30 + rnd() * 24, 12 + rnd() * 10, rnd, '#4a7a9a', { lw: 0, hla: 0.15 }));
        for (const x of S.spread(8, 0.8)) { const h = S.r(50, 90); S.rep(x, 16, (xx, rnd) => kelp(ctx, xx, f(xx) + 6, h, '#3a9a7a', rnd, 0)); }
        profilePath(ctx, W, (x) => f(x) + 5, 300);
        ctx.fillStyle = lgY(ctx, [[254, '#9cc8c0'], [292, '#8cbcb6']]); ctx.fill();
        haze(ctx, W, 110, 292, '#3aa4d0', 0.32, 0.18);
      }),
      L(40, 252, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 262, [[2.5, 1, 2], [1.5, 4, 7]]);
        // grandes algues derrière le récif
        for (const x of S.spread(5, 0.7)) { const h = S.r(100, 170); S.rep(x, 30, (xx, rnd) => kelp(ctx, xx, fM(xx) + 8, h, S.pick(['#3fae5a', '#4cbc62', '#36a058']), rnd, 2)); }
        // massifs rocheux du récif
        for (const x of S.spread(6, 0.6)) {
          const w = S.r(50, 90);
          S.rep(x, w, (xx, rnd) => {
            const gy = fM(xx) + 9, cs = [];
            for (let k = 0; k < 4; k++) cs.push([xx - w * 0.4 + k * w * 0.27, gy - 6 - rnd() * 12, 12 + rnd() * 10]);
            blob(ctx, cs, S.pick(['#6a78b8', '#7484c0', '#5e6eaa']), { lw: 2, flat: gy + 2, light: 0.22, hla: 0.2 });
          });
        }
        const xs = S.spread(9, 0.6);
        const special = S.ri(0, 8), special2 = (special + 4) % 9;
        xs.forEach((x, i) => {
          const kind = i === special ? 'clam' : i === special2 ? 'chest' : ['branch', 'brain', 'fan', 'anemone', 'branch'][i % 5];
          const col = COR[i % COR.length];
          S.rep(x, 50, (xx, rnd) => {
            const gy = fM(xx) + 8;
            if (kind === 'branch') branchCoral(ctx, xx, gy, 1.3 + rnd() * 0.35, col, rnd);
            else if (kind === 'brain') { brainCoral(ctx, xx, gy, 20 + rnd() * 6, '#ffb070', rnd); anemone(ctx, xx + 26, gy, 1, '#ff7ad0', rnd); }
            else if (kind === 'fan') seaFan(ctx, xx, gy, 1.45, '#b86aff', rnd);
            else if (kind === 'anemone') { anemone(ctx, xx, gy, 1.35, '#ff6a9a', rnd); rock(ctx, xx + 24, gy + 2, 30, 14, rnd, '#7a8ab8'); }
            else if (kind === 'clam') clam(ctx, xx, gy, 1.1, S);
            else treasure(ctx, xx, gy, 1, S);
          });
        });
        // colonnes de bulles
        for (const x of S.spread(4, 0.8)) S.rep(x, 10, (xx, rnd) => { for (let k = 0; k < 9; k++) { const y = fM(xx) - 10 - k * 18 - rnd() * 8, r = 1.6 + k * 0.35 + rnd(); ctx.beginPath(); ctx.arc(xx + Math.sin(k * 1.3) * 4, y, r, 0, TAU); ctx.fillStyle = rgba('#d8fcff', 0.25); ctx.fill(); ctx.strokeStyle = rgba('#ffffff', 0.75); ctx.lineWidth = 0.9; ctx.stroke(); gloss(ctx, xx + Math.sin(k * 1.3) * 4 - r * 0.35, y - r * 0.35, r * 0.3, r * 0.2, 0.9); } });
        // poissons
        for (let i = 0; i < 6; i++) { const x = S.r(0, W), y = S.r(110, 210), c = S.pick(['#ffb03a', '#ff6a5a', '#4ae0ff', '#ffe04a']), dir = S.rand() < 0.5 ? -1 : 1; S.rep(x, 14, (xx) => cuteFish(ctx, xx, y, 1, c, dir)); }
        profilePath(ctx, W, (x) => fM(x) + 7, 300);
        ctx.fillStyle = lgY(ctx, [[258, '#e2d6a6'], [290, '#cfc092']]); ctx.fill();
        profileLine(ctx, W, (x) => fM(x) + 7); strokeLine(ctx, rgba('#7a8a7a', 0.55), 1.4);
        haze(ctx, W, 40, 282, '#5ab8e0', 0.16, 0.08);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [12, 1, 2.4, 'bump'], edge2: [11, 0.8, 2, 'bump'],
          fill: [[262, '#ecdeac'], [290, '#d8cc9a'], [330, '#b8b48e'], [360, '#8e9c88']],
          fill2: [[300, '#e2d6a4'], [330, '#c2bc92'], [360, '#8e9c88']],
          shadow: '#1e4a6a', rim: rgba('#ffffff', 0.85), rim2: rgba('#f4fff0', 0.7),
          stroke: rgba(OUT, 0.85), stroke2: rgba('#6a7a6a', 0.8),
          path: { fill: [[280, '#f8eec8'], [296, '#efe2b8'], [312, '#e2d4a8']], edge: '#a89a70' },
          upper(ctx, S, F) {
            scatter(S, 18, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 1.6, x + 6, y); strokeLine(ctx, rgba('#c8b080', 0.6), 1); }, 6);
            scatter(S, 9, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 1, (x, y, rnd) => shell(ctx, x, y, 0.55, rnd() < 0.5 ? '#ffc0c8' : '#fff0e0', rnd() - 0.5, 1), 6);
            scatter(S, 8, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y, rnd) => tuft(ctx, x, y, 0.6, '#4cbc6a', rnd, { tall: 1.6, n: 3 }), 6);
          },
          pathDeco(ctx, S, F) {
            pawTrail(S, F, 22, (q, y) => paw(ctx, q, y, 1.2, rgba('#c8b080', 0.55), Math.PI / 2));
            scatter(S, 30, (x) => F.fP0(x) + 4, (x) => F.fP1(x) + 2, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 1.6, x + 7, y); strokeLine(ctx, rgba('#d8c492', 0.6), 1); }, 8);
          },
          lower(ctx, S, F) {
            scatter(S, 34, (x) => F.fP1(x) + 8, () => 358, (x, y) => { ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y - 2.2, x + 9, y); strokeLine(ctx, rgba('#bca474', 0.55), 1.2); }, 10);
            scatter(S, 8, (x) => F.fP1(x) + 12, () => 352, (x, y, rnd) => shell(ctx, x, y, 0.9, ['#ffb8c4', '#fff0e0', '#ffd2a0'][Math.floor(rnd() * 3)], rnd() - 0.5), 8);
            scatter(S, 5, (x) => F.fP1(x) + 14, () => 350, (x, y, rnd) => starfish(ctx, x, y, 1, rnd() < 0.5 ? '#ff6a4a' : '#ff4a8a', rnd()), 8);
            scatter(S, 10, (x) => F.fP1(x) + 10, () => 356, (x, y, rnd) => tuft(ctx, x, y, 0.8, '#3eae5e', rnd, { tall: 1.7, n: 4 }), 8);
          },
          after(ctx, S, F) {
            // caustiques sur le sable
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 10; k++) {
              const ph = S.r(0, TAU), ph2 = S.r(0, TAU), y0 = 276 + k * 9;
              ctx.beginPath();
              for (let x = -6; x <= S.W + 6; x += 3) { const y = y0 + Math.sin(TAU * 22 * x / S.W + ph) * 3.2 + Math.sin(TAU * 47 * x / S.W + ph2) * 1.6; x === -6 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
              strokeLine(ctx, rgba('#e8ffff', 0.2 - k * 0.008), 1.8);
            }
            ctx.fillStyle = lgY(ctx, [[300, rgba('#3aa8d8', 0)], [360, rgba('#3aa8d8', 0.22)]]); ctx.fillRect(-5, 300, S.W + 10, 62);
            ctx.restore();
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 55, (xx, rnd) => {
            const by = 356 + rnd() * 4;
            if (kind < 0.35) { branchCoral(ctx, xx, by + 8, 0.85, S.pick(COR), rnd); shell(ctx, xx + 24, by + 4, 1.5, '#ffd0d8', 0.3, 1.8); }
            else if (kind < 0.65) { kelp(ctx, xx, by + 12, 26, '#3aaa5a', rnd, 2); kelp(ctx, xx + 10, by + 12, 20, '#4cbc62', rnd, 2); urchin(ctx, xx + 24, by + 6, 1.2); }
            else { rock(ctx, xx, by + 6, 34, 13, rnd, '#7a88b0'); starfish(ctx, xx - 6, by - 2, 1.5, '#ff5a6a', rnd(), 2); }
          });
        }
      }, true),
    ],
  };
}

function fishShape(ctx, x, y, s, col, dir = 1) {
  ctx.beginPath();
  ctx.moveTo(x + 3 * s * dir, y);
  ctx.quadraticCurveTo(x, y - 1.8 * s, x - 2.4 * s * dir, y);
  ctx.lineTo(x - 4 * s * dir, y - 1.4 * s); ctx.lineTo(x - 4 * s * dir, y + 1.4 * s); ctx.lineTo(x - 2.4 * s * dir, y);
  ctx.quadraticCurveTo(x, y + 1.8 * s, x + 3 * s * dir, y);
  ctx.fillStyle = col; ctx.fill();
}
function cuteFish(ctx, x, y, s, col, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  poly(ctx, [[-7, 0], [-12, -5], [-12, 5]]); paint(ctx, shade(col, -0.1), 1.6);
  ell(ctx, 0, 0, 8, 5.5); paint(ctx, ball(ctx, 0, 0, 7, col), 1.6);
  ctx.beginPath(); ctx.moveTo(-2, -5); ctx.quadraticCurveTo(0, -8, 3, -5); ctx.fillStyle = shade(col, -0.15); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-1, -4.6); ctx.lineTo(-1, 4.6); strokeLine(ctx, rgba('#ffffff', 0.6), 1.4);
  ctx.beginPath(); ctx.arc(3.6, -1, 1.6, 0, TAU); ctx.fillStyle = OUT; ctx.fill();
  ctx.beginPath(); ctx.arc(4, -1.5, 0.5, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}
function kelp(ctx, x, by, h, col, rnd, lw = 2) {
  const ph = rnd() * TAU, amp = 4 + rnd() * 5;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x + Math.sin(ph + t * 5) * amp * t, by - t * h]); }
  // lames larges et ondulées, alternées
  const blades = [];
  for (let i = 1; i <= 8; i++) {
    const [px, py] = pts[i], side = i % 2 ? 1 : -1, len = (10 + rnd() * 6) * (1 - i / 14) * (lw > 0 ? 1 : 0.8), w = len * 0.42;
    blades.push([px, py, side, len, w]);
  }
  const blade = ([px, py, side, len, w]) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(-Math.PI / 2 + side * 1.05);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.3, -w * 1.2, len * 0.8, -w * 0.3, len * 1.5, -w * 0.5);
    ctx.bezierCurveTo(len * 1.0, w * 0.5, len * 0.4, w * 0.9, 0, 0);
    ctx.restore();
  };
  if (lw > 0) { smooth(ctx, pts, false, 0.6); strokeLine(ctx, OUT, 4 + lw * 2); }
  for (const b of blades) { blade(b); if (lw > 0) paint(ctx, lgY(ctx, [[b[1] - b[3], shade(col, 0.18)], [b[1] + b[3], shade(col, -0.08)]]), 1.4); else { ctx.fillStyle = shade(col, 0.05); ctx.fill(); } }
  smooth(ctx, pts, false, 0.6); strokeLine(ctx, shade(col, -0.12), 3);
  if (lw > 0) for (let i = 2; i < 8; i += 2) { const [px, py] = pts[i]; ctx.beginPath(); ctx.arc(px + (i % 4 ? 2.5 : -2.5), py + 3, 2, 0, TAU); paint(ctx, ball(ctx, px, py + 3, 2, '#d8c04a'), 1); }
}
function branchCoral(ctx, x, by, s, col, rnd) {
  const segs = [];
  const br = (x0, y0, a, len, w, d) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    segs.push([x0, y0, x1, y1, w, d === 0]);
    if (d > 0) { br(x1, y1, a - 0.35 - rnd() * 0.3, len * 0.78, w * 0.78, d - 1); br(x1, y1, a + 0.35 + rnd() * 0.3, len * 0.78, w * 0.78, d - 1); }
  };
  br(x, by + 2, -Math.PI / 2 + (rnd() - 0.5) * 0.3, 14 * s, 6 * s, 3);
  for (const pass of [0, 1]) for (const [x0, y0, x1, y1, w, tip] of segs) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    strokeLine(ctx, pass ? col : OUT, pass ? w : w + 4);
    if (tip) { ctx.beginPath(); ctx.arc(x1, y1, w * 0.75 + (pass ? 0 : 2), 0, TAU); ctx.fillStyle = pass ? shade(col, 0.25) : OUT; ctx.fill(); }
  }
  for (const [x0, y0, x1, y1, w] of segs) { ctx.beginPath(); ctx.moveTo(x0 - w * 0.2, y0); ctx.lineTo(x1 - w * 0.2, y1); strokeLine(ctx, rgba('#ffffff', 0.3), w * 0.3); }
}
function brainCoral(ctx, x, by, r, col, rnd) {
  ctx.beginPath(); ctx.moveTo(x - r, by + 2); ctx.bezierCurveTo(x - r, by - r * 1.25, x + r, by - r * 1.25, x + r, by + 2); ctx.closePath();
  paint(ctx, ball(ctx, x, by - r * 0.5, r, col, 0.3, 0.3), 2);
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - r, by + 2); ctx.bezierCurveTo(x - r, by - r * 1.25, x + r, by - r * 1.25, x + r, by + 2); ctx.clip();
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const yy = by - r * 0.85 + k * r * 0.17; ctx.moveTo(x - r, yy); for (let xx = x - r; xx <= x + r; xx += 3) ctx.lineTo(xx, yy + Math.sin(xx * 0.5 + k * 1.7 + rnd()) * 1.8); }
  strokeLine(ctx, rgba(shade(col, -0.4), 0.55), 1.1);
  ctx.restore();
}
function seaFan(ctx, x, by, s, col, rnd) {
  const R = 30 * s;
  ctx.beginPath(); ctx.moveTo(x, by);
  for (let i = 0; i <= 10; i++) { const a = -Math.PI * (0.12 + 0.76 * i / 10); ctx.lineTo(x + Math.cos(a) * R * (0.85 + rnd() * 0.2), by - 6 * s + Math.sin(a) * R * (0.9 + rnd() * 0.15)); }
  ctx.closePath();
  ctx.fillStyle = rgba(col, 0.55); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.12 + 0.76 * i / 8); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + Math.cos(a) * R * 0.4, by - 6 * s + Math.sin(a) * R * 0.5 - 4, x + Math.cos(a) * R, by - 6 * s + Math.sin(a) * R); }
  for (let k = 1; k < 5; k++) { ctx.moveTo(x + R, by - k * 7 * s); ctx.arc(x, by - 4 * s, k * R / 4.6, 0, -Math.PI, true); }
  strokeLine(ctx, shade(col, -0.25), 1.2);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.lineTo(x, by - 8 * s); strokeLine(ctx, OUT, 4.6); ctx.stroke(); strokeLine(ctx, shade(col, -0.2), 2.4);
}
function anemone(ctx, x, by, s, col, rnd) {
  rr(ctx, x - 7 * s, by - 10 * s, 14 * s, 12 * s, 4 * s); paint(ctx, vgrad(ctx, by - 10 * s, by, shade(col, -0.1), 0.2, 0.2), 1.8);
  const n = 9;
  for (const pass of [0, 1]) for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5, a = -Math.PI / 2 + t * 2.2, len = (11 + rnd() * 3) * s;
    const bx = x + t * 11 * s, b0 = by - 10 * s, ex = bx + Math.cos(a) * len, ey = b0 + Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(bx, b0); ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 + 3 * s * Math.sin(i), b0 + Math.sin(a) * len * 0.5, ex, ey);
    strokeLine(ctx, pass ? col : OUT, pass ? 2.6 * s : 2.6 * s + 3);
    ctx.beginPath(); ctx.arc(ex, ey, pass ? 1.8 * s : 1.8 * s + 1.5, 0, TAU); ctx.fillStyle = pass ? shade(col, 0.35) : OUT; ctx.fill();
  }
}
function clam(ctx, x, by, s, S) {
  const w = 22 * s;
  ctx.beginPath(); ctx.moveTo(x - w, by - 8 * s); ctx.quadraticCurveTo(x - w * 0.6, by - 34 * s, x + 2, by - 30 * s); ctx.quadraticCurveTo(x + w * 0.8, by - 26 * s, x + w, by - 10 * s); ctx.closePath();
  paint(ctx, lgY(ctx, [[by - 34 * s, '#c8a8ff'], [by - 8 * s, '#8a6ae0']]), 2);
  ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(x + k * 2, by - 9 * s); ctx.lineTo(x + k * w * 0.35, by - 28 * s); } strokeLine(ctx, rgba('#5a3ab0', 0.45), 1.2);
  ell(ctx, x, by - 7 * s, w * 0.8, 5 * s); paint(ctx, '#ffd0e8', 1.6);
  glow(ctx, x, by - 10 * s, 18 * s, '#fff6ff', 0.7);
  S.light(x, by - 10 * s, 22 * s, { alt: 1 });
  ctx.beginPath(); ctx.arc(x, by - 10 * s, 4.2 * s, 0, TAU); paint(ctx, ball(ctx, x, by - 10 * s, 4.2 * s, '#fff4ff', 0.4, 0.2), 1.4);
  gloss(ctx, x - 1.4 * s, by - 11.6 * s, 1.4 * s, 0.9 * s, 0.9);
  ctx.beginPath(); ctx.moveTo(x - w * 1.05, by - 4 * s); ctx.quadraticCurveTo(x - w * 0.5, by + 4 * s, x, by + 2); ctx.quadraticCurveTo(x + w * 0.6, by + 4 * s, x + w * 1.05, by - 6 * s); ctx.lineTo(x + w * 0.9, by - 9 * s); ctx.quadraticCurveTo(x, by - 2 * s, x - w * 0.9, by - 8 * s); ctx.closePath();
  paint(ctx, lgY(ctx, [[by - 9 * s, '#b898ff'], [by + 3, '#7a5ad8']]), 2);
}
function treasure(ctx, x, by, s, S) {
  glow(ctx, x, by - 14 * s, 30 * s, '#ffe07a', 0.55);
  S.light(x, by - 14 * s, 28 * s);
  rr(ctx, x - 18 * s, by - 16 * s, 36 * s, 18 * s, 2); paint(ctx, lgY(ctx, [[by - 16 * s, '#b8783a'], [by, '#7a4a22']]), 2);
  // couvercle ouvert
  ctx.beginPath(); ctx.moveTo(x - 18 * s, by - 16 * s); ctx.lineTo(x - 20 * s, by - 32 * s); ctx.quadraticCurveTo(x, by - 40 * s, x + 16 * s, by - 34 * s); ctx.lineTo(x + 18 * s, by - 16 * s); ctx.closePath();
  paint(ctx, lgY(ctx, [[by - 38 * s, '#c8884a'], [by - 16 * s, '#8a5428']]), 2);
  // pièces
  ctx.beginPath(); for (let k = 0; k < 7; k++) addCircle(ctx, x - 13 * s + k * 4.4 * s, by - 17 * s - Math.sin(k * 0.9) * 3 * s, 3.4 * s);
  paint(ctx, '#ffd23f', 1.4);
  for (let k = 0; k < 3; k++) sparkle(ctx, x - 8 * s + k * 9 * s, by - 24 * s + (k % 2) * 4, 2.6, '#ffffff', 0.95);
  ctx.fillStyle = '#ffd23f'; for (const dx of [-12, 12]) ctx.fillRect(x + dx * s - 2 * s, by - 16 * s, 4 * s, 18 * s);
  rr(ctx, x - 3 * s, by - 13 * s, 6 * s, 6 * s, 1); paint(ctx, '#ffe27a', 1.2);
}
function shipwreck(ctx, x, by, s, rnd) {
  const c = '#5a7a8a', d = '#4a6a7c', l = '#6a8c9c';
  ctx.save(); ctx.translate(x, by); ctx.rotate(-0.12);
  // mât brisé + voile déchirée
  ctx.fillStyle = d; ctx.fillRect(-6 * s, -110 * s, 5 * s, 90 * s);
  ctx.fillRect(-30 * s, -96 * s, 50 * s, 3.5 * s);
  ctx.beginPath(); ctx.moveTo(-28 * s, -93 * s); ctx.lineTo(18 * s, -93 * s); ctx.lineTo(14 * s, -70 * s); ctx.lineTo(4 * s, -76 * s); ctx.lineTo(-6 * s, -62 * s); ctx.lineTo(-14 * s, -72 * s); ctx.lineTo(-26 * s, -66 * s); ctx.closePath();
  ctx.fillStyle = rgba('#9ab8c4', 0.85); ctx.fill();
  // pavillon à arête
  ctx.fillStyle = '#2a3a4a'; ctx.fillRect(-3.5 * s, -122 * s, 18 * s, 11 * s);
  ctx.save(); ctx.translate(5.5 * s, -116.5 * s); ctx.scale(0.45 * s, 0.45 * s); ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); for (let i = 0; i < 3; i++) { ctx.moveTo(-5 + i * 5, -4); ctx.lineTo(-5 + i * 5, 4); } strokeLine(ctx, '#d8e8f0', 2); ctx.beginPath(); ctx.arc(-11, 0, 3.2, 0, TAU); ctx.fillStyle = '#d8e8f0'; ctx.fill(); ctx.restore();
  // coque
  ctx.beginPath();
  ctx.moveTo(-70 * s, -36 * s); ctx.lineTo(54 * s, -40 * s); ctx.lineTo(70 * s, -54 * s); ctx.lineTo(74 * s, -50 * s);
  ctx.quadraticCurveTo(64 * s, -10 * s, 40 * s, 6 * s); ctx.lineTo(-56 * s, 6 * s); ctx.quadraticCurveTo(-68 * s, -12 * s, -70 * s, -36 * s); ctx.closePath();
  ctx.fillStyle = lgY(ctx, [[-54 * s, l], [6 * s, c]]); ctx.fill();
  ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(-66 * s, -36 * s + k * 10 * s); ctx.lineTo(60 * s, -40 * s + k * 10 * s); } strokeLine(ctx, rgba('#2a4a5a', 0.45), 1.2);
  // trou dans la coque + hublots
  ctx.beginPath(); ctx.moveTo(-20 * s, -22 * s); ctx.lineTo(-8 * s, -30 * s); ctx.lineTo(2 * s, -20 * s); ctx.lineTo(-4 * s, -8 * s); ctx.lineTo(-18 * s, -10 * s); ctx.closePath(); ctx.fillStyle = '#1e3a4e'; ctx.fill();
  for (const px of [18, 34]) { ctx.beginPath(); ctx.arc(px * s, -26 * s, 4 * s, 0, TAU); ctx.fillStyle = '#2a4a5e'; ctx.fill(); ctx.strokeStyle = rgba('#a8c4d0', 0.7); ctx.lineWidth = 1.2; ctx.stroke(); }
  ctx.fillStyle = l; ctx.fillRect(-72 * s, -40 * s, 128 * s, 5 * s);
  ctx.restore();
  // algues accrochées + sable qui enfouit
  for (let k = 0; k < 3; k++) kelp(ctx, x - 40 * s + k * 34 * s, by + 4, 26 + rnd() * 20, '#4a9a7a', rnd, 0);
  ctx.beginPath(); ctx.moveTo(x - 90 * s, by + 10); ctx.quadraticCurveTo(x - 40 * s, by - 10 * s, x, by - 2 * s); ctx.quadraticCurveTo(x + 50 * s, by - 8 * s, x + 90 * s, by + 10); ctx.closePath();
  ctx.fillStyle = '#a8ccc4'; ctx.fill();
}
function urchin(ctx, x, by, s) {
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = Math.PI + i * Math.PI / 15; ctx.moveTo(x, by - 5 * s); ctx.lineTo(x + Math.cos(a) * 11 * s, by - 5 * s + Math.sin(a) * 10 * s); }
  strokeLine(ctx, OUT, 2.6); ctx.stroke(); strokeLine(ctx, '#6a3a9a', 1.2);
  ell(ctx, x, by - 4 * s, 7 * s, 5.5 * s); paint(ctx, ball(ctx, x, by - 5 * s, 7 * s, '#7a4ab0'), 1.6);
}

// ------------------------------------------------------------------ Château Hanté
function castleDef() {
  return {
    ambient: 'fireflies', kind: 'night',
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#0c0624'], [0.32, '#24124a'], [0.58, '#42246e'], [0.8, '#64348a'], [1, '#86469a']]);
      for (let i = 0; i < 110; i++) {
        const x = S.r(0, SKY_W), y = Math.pow(S.rand(), 1.5) * 200, r = S.r(0.4, 1.3);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba('#ffffff', S.r(0.35, 0.95) * (1 - y / 240)); ctx.fill();
        if (r > 1.2) sparkle(ctx, x, y, r * 3.2, '#ffffff', 0.55);
      }
      // pleine lune (remplacée par l'astre de l'ère dans les variantes)
      const mx = 146, my = 96, mr = 40;
      if (CUR && CUR.V) CUR.sun = { x: mx, y: my, r: mr * 0.75 };
      else {
      glow(ctx, mx, my, mr * 4.5, '#c8a8ff', 0.4);
      glow(ctx, mx, my, mr * 1.8, '#fff4d8', 0.5);
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fillStyle = ball(ctx, mx, my, mr, '#fff6dc', 0.15, 0.18); ctx.fill();
      ctx.fillStyle = rgba('#e0d0b0', 0.55);
      for (const [dx, dy, r] of [[-12, -10, 8], [14, 8, 6], [-4, 16, 5], [16, -16, 4], [-22, 8, 3.5], [4, -2, 3]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }
      }
      // nuages effilés devant la lune
      for (const [dx, dy, w] of [[-30, 22, 80], [40, 34, 70], [-60, -30, 50]]) {
        ctx.beginPath(); addEll(ctx, mx + dx, my + dy, w, 4.5); addEll(ctx, mx + dx + w * 0.3, my + dy - 3, w * 0.5, 3.5);
        ctx.fillStyle = rgba('#2a1650', 0.75); ctx.fill();
        ell(ctx, mx + dx - w * 0.2, my + dy - 3.5, w * 0.5, 1); ctx.fillStyle = rgba('#d8c8ff', 0.4); ctx.fill();
      }
      for (let i = 0; i < 6; i++) bat(ctx, mx - 60 + S.r(0, 170), my - 50 + S.r(0, 110), S.r(0.7, 1.3), '#120a22');
    },
    layers: [
      L(0, 200, 0.03, (ctx, S) => {
        for (const x of S.spread(6, 0.7)) {
          const y = S.r(40, 175), w = S.r(70, 150);
          S.rep(x, w, (xx, rnd) => {
            ctx.beginPath();
            for (let k = 0; k < 3; k++) addEll(ctx, xx + (k - 1) * w * 0.3 + rnd() * 10, y + (rnd() - 0.5) * 5, w * (0.25 + rnd() * 0.18), 3 + rnd() * 3.5);
            ctx.fillStyle = rgba('#3a2266', 0.7); ctx.fill();
            ell(ctx, xx - w * 0.1, y - 3, w * 0.4, 1.2); ctx.fillStyle = rgba('#b8a0f0', 0.45); ctx.fill();
          });
        }
      }),
      L(60, 232, 0.05, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 236, [[10, 1, 2], [7, 3, 5], [4, 7, 11]]);
        const e = makeEdge(S, f, 22, 4, 16, 'rock');
        ctx.beginPath(); e(ctx); closeDown(ctx, W, 300);
        ctx.fillStyle = lgY(ctx, [[200, '#3a2462'], [292, '#2e1c52']]); ctx.fill();
        const cx = S.r(0, W);
        S.rep(cx, 130, (xx) => hauntedCastle(ctx, xx, Math.min(f(xx - 60), f(xx), f(xx + 60)) + 6, 1, S));
        haze(ctx, W, 60, 292, '#6a4a9a', 0.12, 0.3);
        mistBand(ctx, S, 262, 292, '#9a7ac8', 0.5);
      }),
      L(150, 142, 0.1, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 250, [[6, 1, 2], [4, 3, 5], [2, 7, 11]]);
        for (const x of S.spread(9, 0.7)) { const s = S.r(0.45, 0.7); S.rep(x, 60, (xx, rnd) => deadTree(ctx, xx, f(xx) + 4, s, rnd, '#3e2c62', '#6a58a0', 0)); }
        profilePath(ctx, W, f, 300);
        ctx.fillStyle = lgY(ctx, [[240, '#3e2c62'], [292, '#34245a']]); ctx.fill();
        haze(ctx, W, 150, 292, '#7a5aaa', 0.1, 0.25);
        mistBand(ctx, S, 266, 292, '#a888d8', 0.45);
      }),
      L(110, 182, 0.2, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 260, [[3, 1, 2], [2, 3, 5]]);
        let x = S.r(0, 80);
        while (x < W - 60) {
          const w = S.r(90, 160), gap = S.r(50, 120);
          if (x + w > W - 20) break;
          const x0 = x, h = S.r(70, 110), tower = S.rand() < 0.4;
          S.rep(x0 + w / 2, w, (xx, rnd) => ruinWall(ctx, xx - w / 2, f(xx) + 4, w, h, rnd, tower, S));
          x += w + gap;
        }
        profilePath(ctx, W, (q) => f(q) + 4, 300);
        ctx.fillStyle = lgY(ctx, [[250, '#4a3c6e'], [292, '#3e3262']]); ctx.fill();
        haze(ctx, W, 110, 292, '#8a6ab8', 0.1, 0.2);
        mistBand(ctx, S, 268, 292, '#b898e0', 0.35);
      }),
      L(60, 232, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 262, [[2.5, 1, 2], [1.5, 4, 7]]);
        // arbres morts tordus
        for (const x of S.spread(2, 0.4)) { const s = S.r(1.0, 1.2); S.rep(x, 100, (xx, rnd) => { deadTree(ctx, xx, fM(xx) + 6, s, rnd, '#3a2c50', '#b8a8f0'); S.light(xx + 30 * s, fM(xx) - 70 * s, 22, { lantern: 1 }); }); }
        // crypte
        const cx = S.r(0, W);
        S.rep(cx, 50, (xx) => crypt(ctx, xx, fM(xx) + 8, 1, S));
        // grilles en fer forgé
        for (const x of S.spread(2, 0.5)) { const len = S.r(110, 160); S.rep(x, len / 2 + 10, (xx) => ironFence(ctx, xx - len / 2, xx + len / 2, (q) => fM(q) + 8)); }
        // tombes
        for (const x of S.spread(10, 0.8)) S.rep(x, 20, (xx, rnd) => tomb(ctx, xx, fM(xx) + 9, 0.85 + rnd() * 0.3, Math.floor(rnd() * 4), rnd));
        // bougies et champignons lumineux
        for (const x of S.spread(6, 0.9)) S.rep(x, 8, (xx, rnd) => candle(ctx, xx, fM(xx) + 10, 0.9 + rnd() * 0.3, S));
        profilePath(ctx, W, (x) => fM(x) + 7, 300);
        ctx.fillStyle = lgY(ctx, [[258, '#4a5a6a'], [290, '#3a4658']]); ctx.fill();
        profileLine(ctx, W, (x) => fM(x) + 7); strokeLine(ctx, rgba('#1a1430', 0.6), 1.4);
        haze(ctx, W, 60, 282, '#7a5aaa', 0.08, 0.05);
        mistBand(ctx, S, 270, 292, '#c0a8e8', 0.3);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [9, 3.5, 7.5, 'grass'], edge2: [9, 3, 6, 'grass'],
          fill: [[262, '#5e7a6c'], [288, '#4c6660'], [330, '#3c5050'], [360, '#2e3c42']],
          fill2: [[300, '#56706a'], [330, '#425858'], [360, '#2e3c42']],
          shadow: '#120a24', rim: rgba('#b8d8c8', 0.7), rim2: rgba('#a8c8b8', 0.55),
          stroke: OUT, stroke2: rgba('#1a1430', 0.85),
          path: { fill: [[280, '#8a84a4'], [296, '#7a7496'], [312, '#6a6486']], edge: '#3a3456' },
          upper(ctx, S, F) {
            scatter(S, 26, (x) => F.fTop(x) + 4, (x) => F.fP0(x) - 1, (x, y, rnd) => tuft(ctx, x, y, 0.6, '#3e5650', rnd), 8);
            scatter(S, 6, (x) => F.fTop(x) + 6, (x) => F.fP0(x) - 2, (x, y, rnd) => { ell(ctx, x, y, 2.4, 1.4); paint(ctx, '#8a86a0', 1); }, 4);
          },
          pathDeco(ctx, S, F) {
            // pavés ronds
            for (let row = 0; row < 3; row++) {
              const n = Math.round(S.W / 13), st = S.W / n;
              for (let i = 0; i < n; i++) {
                const x = (i + (row % 2) * 0.5) * st, w = st * (0.7 + S.rand() * 0.2), a = 0.25 + S.rand() * 0.25;
                S.rep(x, w, (xx) => {
                  const y0 = F.fP0(xx) + 3, y1 = F.fP1(xx) - 1, y = y0 + (row + 0.5) * (y1 - y0) / 3;
                  ell(ctx, xx, y, w * 0.5, (y1 - y0) / 7.5);
                  ctx.fillStyle = rgba('#b0aac8', a); ctx.fill(); ctx.strokeStyle = rgba('#3a3456', 0.5); ctx.lineWidth = 0.9; ctx.stroke();
                });
              }
            }
          },
          lower(ctx, S, F) {
            scatter(S, 40, (x) => F.fP1(x) + 8, () => 360, (x, y, rnd) => tuft(ctx, x, y, 0.7, '#34484a', rnd), 8);
            scatter(S, 5, (x) => F.fP1(x) + 14, () => 352, (x, y) => fishBone(ctx, x, y, 0.75, '#e8e0f4'), 14);
            scatter(S, 9, (x) => F.fP1(x) + 12, () => 354, (x, y, rnd) => glowShroom(ctx, x, y, 0.8 + rnd() * 0.4, S), 6);
          },
        });
        mistBand(ctx, S, 262, 286, '#c8b0f0', 0.28);
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(5, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 354 + rnd() * 5;
            if (kind < 0.4) { tomb(ctx, xx, by + 10, 1.3, 2, rnd, -0.15); glowShroom(ctx, xx + 22, by + 6, 1.4, S); }
            else if (kind < 0.7) { rock(ctx, xx, by + 6, 30, 12, rnd, '#5a5478'); glowShroom(ctx, xx - 16, by + 4, 1.2, S); glowShroom(ctx, xx - 8, by + 6, 0.9, S); }
            else { ironFence(ctx, xx - 26, xx + 22, () => by + 10, 1.4); tuft(ctx, xx + 26, by + 10, 1.4, '#3e5650', rnd, { lw: 1.8, n: 4, bw: 2, fill: lgY(ctx, [[by - 16, '#6a8a7a'], [by + 8, '#2e4040']]) }); }
          });
        }
      }, true),
    ],
  };
}

// Bande de brume raccordable (bord ondulé, se fond vers le haut)
function mistBand(ctx, S, top, bottom, col, a) {
  const f = wave(S, top, [[3.5, 2, 3], [2, 5, 8]]);
  profilePath(ctx, S.W, f, bottom + 2);
  ctx.fillStyle = lgY(ctx, [[top - 5, rgba(col, 0)], [top + (bottom - top) * 0.45, rgba(col, a * 0.75)], [bottom, rgba(col, a)]]);
  ctx.fill();
  for (const x of S.spread(6, 0.8)) {
    const w = S.r(40, 80), y = top + S.r(0, (bottom - top) * 0.5);
    S.rep(x, w, (xx) => { ctx.save(); ctx.translate(xx, y); ctx.scale(1, 0.2); glow(ctx, 0, 0, w, col, a * 0.6); ctx.restore(); });
  }
}
function gothicWin(ctx, x, y, w, h, lit, o = {}) {
  const path = () => { ctx.beginPath(); ctx.moveTo(x - w / 2, y + h); ctx.lineTo(x - w / 2, y + w * 0.6); ctx.quadraticCurveTo(x - w / 2, y, x, y - w * 0.15); ctx.quadraticCurveTo(x + w / 2, y, x + w / 2, y + w * 0.6); ctx.lineTo(x + w / 2, y + h); ctx.closePath(); };
  if (lit) glow(ctx, x, y + h * 0.5, Math.max(w, h) * 1.4, '#ffb84a', 0.4);
  path();
  ctx.fillStyle = lit ? lgY(ctx, [[y, '#fff0a0'], [y + h, '#ff9a3a']]) : (o.dark || '#1a1030'); ctx.fill();
  if (o.lw !== 0) { ctx.lineWidth = o.lw || 1.6; ctx.strokeStyle = o.stroke || OUT; ctx.stroke(); }
  if (w > 5) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.moveTo(x - w / 2, y + h * 0.55); ctx.lineTo(x + w / 2, y + h * 0.55); strokeLine(ctx, rgba(o.stroke || OUT, 0.8), Math.max(0.7, w * 0.08)); }
}
function hauntedCastle(ctx, x, by, s, S) {
  const C = '#22143e', R = '#3a2862', L = '#ffcf6a';
  const tower = (tx, w, h, roof) => {
    ctx.fillStyle = C; ctx.fillRect(tx - w / 2, by - h, w, h + 4);
    ctx.fillStyle = rgba(R, 0.8); ctx.fillRect(tx - w / 2, by - h, 1.6, h);
    if (roof) { poly(ctx, [[tx - w / 2 - 3, by - h], [tx, by - h - w * 1.6], [tx + w / 2 + 3, by - h]]); ctx.fillStyle = C; ctx.fill(); ctx.fillRect(tx - 0.6, by - h - w * 1.6 - 8, 1.2, 8); }
    else for (let k = 0; k < 3; k++) ctx.fillRect(tx - w / 2 + k * w / 2.5, by - h - 4, w / 5, 4);
  };
  ctx.fillStyle = C;
  ctx.fillRect(x - 70 * s, by - 52 * s, 140 * s, 56 * s);
  for (let k = 0; k < 12; k++) ctx.fillRect(x - 70 * s + k * 12 * s, by - 57 * s, 6 * s, 5 * s);
  tower(x - 62 * s, 18 * s, 92 * s, true);
  tower(x - 30 * s, 22 * s, 120 * s, true);
  tower(x + 4 * s, 30 * s, 150 * s, true);
  tower(x + 40 * s, 20 * s, 104 * s, false);
  tower(x + 66 * s, 16 * s, 80 * s, true);
  // pont et porte
  ctx.beginPath(); ctx.arc(x + 4 * s, by - 2, 10 * s, Math.PI, 0); ctx.lineTo(x + 14 * s, by + 4); ctx.lineTo(x - 6 * s, by + 4); ctx.closePath(); ctx.fillStyle = '#120a22'; ctx.fill();
  // fenêtres éclairées
  const wins = [[-62, 70], [-62, 46], [-30, 100], [-30, 72], [-30, 40], [4, 128], [4, 96], [4, 64], [40, 84], [40, 52], [66, 60], [-48, 30], [22, 30]];
  for (const [dx, dy] of wins) {
    const wx = x + dx * s, wy = by - dy * s;
    gothicWin(ctx, wx, wy, 4.2 * s, 7 * s, true, { lw: 0 });
    S.light(wx, wy + 3.5 * s, 9, { rect: [wx - 2.1 * s, wy, 4.2 * s, 7 * s] });
  }
  // drapeau déchiré
  ctx.beginPath(); ctx.moveTo(x + 4.6 * s, by - 150 * s - 48 * s - 6); ctx.lineTo(x + 18 * s, by - 150 * s - 45 * s - 6); ctx.lineTo(x + 12 * s, by - 150 * s - 42 * s - 6); ctx.lineTo(x + 16 * s, by - 150 * s - 39 * s - 6); ctx.lineTo(x + 4.6 * s, by - 150 * s - 38 * s - 6); ctx.closePath();
  ctx.fillStyle = '#7a2a5a'; ctx.fill();
}
function ruinWall(ctx, x, by, w, h, rnd, tower, S) {
  const st = '#5a4c80', top = by - h;
  const pts = [[x, by + 4], [x, top + 10]];
  const n = Math.max(3, Math.round(w / 14));
  for (let i = 1; i < n; i++) { const xx = x + w * i / n; pts.push([xx, top + (i % 2 ? 0 : 8) + rnd() * 14 * (i > n * 0.6 ? 2.2 : 1)]); }
  pts.push([x + w, top + 30 + rnd() * 20], [x + w, by + 4]);
  poly(ctx, pts);
  ctx.fillStyle = lgY(ctx, [[top, shade(st, 0.08)], [by, shade(st, -0.12)]]); ctx.fill();
  ctx.save(); poly(ctx, pts); ctx.clip();
  // briques
  ctx.beginPath();
  for (let r = 0; r * 9 < h + 10; r++) { const yy = by - r * 9; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); for (let c = 0; c < w / 18 + 1; c++) { const xx = x + c * 18 + (r % 2) * 9; ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 9); } }
  strokeLine(ctx, rgba('#2a1e48', 0.4), 0.9);
  ctx.fillStyle = rgba('#c8b8ff', 0.15); ctx.fillRect(x, top - 10, 3, h + 20);
  ctx.restore();
  // fenêtres gothiques
  const nw = Math.max(1, Math.floor(w / 46));
  for (let k = 0; k < nw; k++) {
    const wx = x + w * (k + 0.5) / nw, wy = by - h * 0.62, lit = rnd() < 0.45;
    gothicWin(ctx, wx, wy, 13, 26, lit, { dark: '#1a1030', stroke: '#2a1e48', lw: 2 });
    if (lit) S.light(wx, wy + 13, 26, { rect: [wx - 6, wy + 2, 12, 22] });
  }
  if (tower) {
    const tx = x + w * (0.2 + rnd() * 0.2), tw = 26, th = h + 40;
    rr(ctx, tx - tw / 2, by - th, tw, th + 4, 2); ctx.fillStyle = lgY(ctx, [[by - th, shade(st, 0.05)], [by, shade(st, -0.12)]]); ctx.fill();
    poly(ctx, [[tx - tw / 2 - 4, by - th], [tx, by - th - 34], [tx + tw / 2 + 4, by - th]]); ctx.fillStyle = '#3a2c5e'; ctx.fill();
    const lit = rnd() < 0.7;
    gothicWin(ctx, tx, by - th + 14, 8, 14, lit, { stroke: '#2a1e48', lw: 1.6 });
    if (lit) S.light(tx, by - th + 21, 20, { rect: [tx - 3.5, by - th + 15, 7, 12] });
  }
  // lierre
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, by); ctx.bezierCurveTo(x + w * 0.05, by - h * 0.4, x + w * 0.2, by - h * 0.6, x + w * 0.12, top + 20); strokeLine(ctx, '#2e4a3a', 2);
  for (let k = 0; k < 8; k++) leafShape(ctx, x + w * (0.06 + rnd() * 0.14), by - h * (0.1 + k * 0.09), 3.5, rnd() * 3, '#3a6a4a', 0);
}
function tomb(ctx, x, gy, s, kind, rnd, rot) {
  ctx.save(); ctx.translate(x, gy); ctx.rotate(rot ?? (rnd() - 0.5) * 0.18);
  const st = mix('#8a84aa', '#9a96b0', rnd());
  const w = 16 * s, h = 24 * s;
  const shape = () => {
    ctx.beginPath();
    if (kind === 1) { // croix
      ctx.rect(-2.8 * s, -h * 1.15, 5.6 * s, h * 1.15 + 3); ctx.rect(-9 * s, -h * 0.88, 18 * s, 5.4 * s);
    } else if (kind === 2) { // dalle à oreilles de chat
      ctx.moveTo(-w / 2, 3); ctx.lineTo(-w / 2, -h + 6 * s); ctx.lineTo(-w * 0.42, -h - 5 * s); ctx.lineTo(-w * 0.12, -h + 1 * s);
      ctx.lineTo(w * 0.12, -h + 1 * s); ctx.lineTo(w * 0.42, -h - 5 * s); ctx.lineTo(w / 2, -h + 6 * s); ctx.lineTo(w / 2, 3); ctx.closePath();
    } else if (kind === 3) { // petit obélisque
      ctx.moveTo(-6 * s, 3); ctx.lineTo(-4.5 * s, -h * 1.2); ctx.lineTo(0, -h * 1.38); ctx.lineTo(4.5 * s, -h * 1.2); ctx.lineTo(6 * s, 3); ctx.closePath();
    } else { ctx.moveTo(-w / 2, 3); ctx.lineTo(-w / 2, -h + w / 2); ctx.arc(0, -h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(w / 2, 3); ctx.closePath(); }
  };
  shape(); paint(ctx, lgY(ctx, [[-h * 1.3, shade(st, 0.12)], [0, shade(st, -0.15)]]), 2);
  ctx.save(); shape(); ctx.clip();
  ctx.fillStyle = rgba('#2a2448', 0.25); ctx.fillRect(w * 0.15, -h * 1.5, w, h * 2);
  if (kind === 0 || kind === 2) { ctx.save(); ctx.translate(0, -h * 0.5); ctx.beginPath(); pawPath(ctx, 0, 0, 1.6 * s); ctx.fillStyle = rgba('#3a3458', 0.6); ctx.fill(); ctx.restore(); ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.18); ctx.lineTo(w * 0.3, -h * 0.18); ctx.moveTo(-w * 0.22, -h * 0.06); ctx.lineTo(w * 0.22, -h * 0.06); strokeLine(ctx, rgba('#3a3458', 0.5), 1); }
  if (rnd() < 0.5) { ctx.beginPath(); ctx.moveTo(w * 0.2, -h * 0.9); ctx.lineTo(w * 0.05, -h * 0.6); ctx.lineTo(w * 0.18, -h * 0.4); strokeLine(ctx, rgba('#2a2448', 0.6), 0.9); }
  ell(ctx, -w * 0.25, -h * 0.05, w * 0.35, 3 * s); ctx.fillStyle = rgba('#6a9a6a', 0.7); ctx.fill();
  ctx.restore();
  ctx.restore();
}
function ironFence(ctx, x0, x1, f, lw = 1) {
  const n = Math.max(2, Math.round((x1 - x0) / 9));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, b = f(x), h = i % 4 === 0 ? 34 : 28; ctx.moveTo(x, b + 2); ctx.lineTo(x, b - h); }
  for (const hy of [6, 22]) { ctx.moveTo(x0, f(x0) - hy); for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; ctx.lineTo(x, f(x) - hy); } }
  strokeLine(ctx, OUT, 3 * lw);
  ctx.fillStyle = OUT;
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, b = f(x), h = i % 4 === 0 ? 34 : 28; poly(ctx, [[x - 2.4 * lw, b - h + 1], [x, b - h - 5 * lw], [x + 2.4 * lw, b - h + 1]]); ctx.fill(); }
  ctx.beginPath(); for (let i = 0; i < n; i += 2) { const x = x0 + (x1 - x0) * (i + 0.5) / n, b = f(x); ctx.moveTo(x + 2.6, b - 14); ctx.arc(x, b - 14, 2.6, 0, TAU); } strokeLine(ctx, OUT, 1.2 * lw);
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; ctx.moveTo(x - 0.6, f(x) - 26); ctx.lineTo(x - 0.6, f(x) - 8); } strokeLine(ctx, rgba('#9a8ac8', 0.45), 0.8);
}
function crypt(ctx, x, by, s, S) {
  const w = 54 * s, h = 46 * s, st = '#8a82a8';
  rr(ctx, x - w / 2 - 4, by - 6 * s, w + 8, 8 * s, 1.5); paint(ctx, shade(st, -0.1), 2);
  rr(ctx, x - w / 2, by - h, w, h - 4 * s, 1); paint(ctx, lgY(ctx, [[by - h, shade(st, 0.1)], [by, shade(st, -0.15)]]), 2);
  poly(ctx, [[x - w / 2 - 6, by - h], [x, by - h - 18 * s], [x + w / 2 + 6, by - h]]); paint(ctx, shade(st, 0.05), 2);
  for (const dx of [-0.38, 0.38]) { rr(ctx, x + dx * w - 3.5 * s, by - h + 2, 7 * s, h - 8 * s, 1); paint(ctx, shade(st, 0.14), 1.6); }
  glow(ctx, x, by - 18 * s, 36 * s, '#7affb0', 0.45);
  S.light(x, by - 18 * s, 34 * s, { alt: 1 });
  ctx.beginPath(); ctx.moveTo(x - 10 * s, by - 5 * s); ctx.lineTo(x - 10 * s, by - 26 * s); ctx.arc(x, by - 26 * s, 10 * s, Math.PI, 0); ctx.lineTo(x + 10 * s, by - 5 * s); ctx.closePath();
  paint(ctx, lgY(ctx, [[by - 36 * s, '#d8ffe8'], [by, '#4ad89a']]), 2);
  // chat de pierre sur le fronton
  ctx.fillStyle = shade(st, -0.05);
  ctx.beginPath(); ctx.arc(x, by - h - 22 * s, 5 * s, 0, TAU); ctx.fill();
  poly(ctx, [[x - 5 * s, by - h - 24 * s], [x - 4 * s, by - h - 31 * s], [x - 1 * s, by - h - 26 * s]]); ctx.fill();
  poly(ctx, [[x + 5 * s, by - h - 24 * s], [x + 4 * s, by - h - 31 * s], [x + 1 * s, by - h - 26 * s]]); ctx.fill();
  ell(ctx, x, by - h - 16 * s, 6 * s, 5 * s); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 2 * s, by - h - 22.5 * s, 0.9 * s, 0, TAU); ctx.arc(x + 2 * s, by - h - 22.5 * s, 0.9 * s, 0, TAU); ctx.fillStyle = '#7affb0'; ctx.fill();
}
function candle(ctx, x, gy, s, S) {
  glow(ctx, x, gy - 12 * s, 14 * s, '#ffc04a', 0.55);
  S.light(x, gy - 12 * s, 14 * s, { a: 0.7 });
  rr(ctx, x - 2.2 * s, gy - 9 * s, 4.4 * s, 10 * s, 1); paint(ctx, '#f4ecd8', 1.2);
  ctx.beginPath(); ctx.moveTo(x, gy - 15 * s); ctx.quadraticCurveTo(x + 2.4 * s, gy - 11 * s, x, gy - 9.5 * s); ctx.quadraticCurveTo(x - 2.4 * s, gy - 11 * s, x, gy - 15 * s); ctx.fillStyle = '#ffd25a'; ctx.fill();
}
function glowShroom(ctx, x, gy, s, S) {
  glow(ctx, x, gy - 8 * s, 14 * s, '#6af0ff', 0.45);
  S.light(x, gy - 8 * s, 14 * s, { alt: 1, a: 0.6 });
  rr(ctx, x - 1.6 * s, gy - 7 * s, 3.2 * s, 8 * s, 1.2); paint(ctx, '#d8f4ff', 1.2);
  ctx.beginPath(); ctx.moveTo(x - 6 * s, gy - 6 * s); ctx.quadraticCurveTo(x - 5 * s, gy - 13 * s, x, gy - 13 * s); ctx.quadraticCurveTo(x + 5 * s, gy - 13 * s, x + 6 * s, gy - 6 * s); ctx.closePath();
  paint(ctx, lgY(ctx, [[gy - 13 * s, '#bafcff'], [gy - 6 * s, '#3ac8e8']]), 1.4);
  ctx.fillStyle = rgba('#ffffff', 0.85); ctx.beginPath(); ctx.arc(x - 2 * s, gy - 10 * s, 0.9 * s, 0, TAU); ctx.arc(x + 2.4 * s, gy - 8.5 * s, 0.7 * s, 0, TAU); ctx.fill();
}

// ------------------------------------------------------------------ Usine à Croquettes
function factoryDef() {
  const STEEL = '#6a7a9a', TEAL = '#3a9aa8', ORANGE = '#ff8a3a';
  return {
    ambient: 'embers', kind: 'indoor',
    sky(ctx, S) {
      // mur du fond : panneaux rivetés + grandes verrières
      ctx.fillStyle = lgY(ctx, [[0, '#3a4262'], [200, '#4e5a7e'], [360, '#5a6688']]); ctx.fillRect(0, 0, SKY_W, VH);
      ctx.beginPath();
      for (let x = 0; x <= SKY_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, VH); }
      for (let y = 30; y <= VH; y += 60) { ctx.moveTo(0, y); ctx.lineTo(SKY_W, y); }
      strokeLine(ctx, rgba('#2a3050', 0.5), 1.2);
      ctx.fillStyle = rgba('#8a96c0', 0.5);
      for (let x = 4; x < SKY_W; x += 40) for (let y = 36; y < VH; y += 60) { ctx.fillRect(x, y, 1.6, 1.6); ctx.fillRect(x + 32, y, 1.6, 1.6); }
      for (const wx of [40, 190, 340]) {
        const ww = 104, wy = 46, wh = 150;
        ctx.save(); rr(ctx, wx, wy, ww, wh, 4); ctx.clip();
        ctx.fillStyle = lgY(ctx, [[wy, '#7ad0ff'], [wy + wh, '#d8f4ff']]); ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = rgba('#ffffff', 0.85);
        for (let k = 0; k < 2; k++) { const cx = wx + 20 + S.r(0, 60), cy = wy + 30 + k * 50; ell(ctx, cx, cy, 18, 5); ctx.fill(); ell(ctx, cx + 8, cy - 4, 10, 5); ctx.fill(); }
        ctx.fillStyle = '#9ab0d0'; ctx.fillRect(wx, wy + wh - 30, ww, 30);
        ctx.fillStyle = '#8aa0c4'; for (let k = 0; k < 5; k++) ctx.fillRect(wx + 6 + k * 21, wy + wh - 30 - (10 + (k * 37) % 22), 14, 40);
        ctx.restore();
        ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(wx + ww * k / 4, wy); ctx.lineTo(wx + ww * k / 4, wy + wh); } for (let k = 1; k < 6; k++) { ctx.moveTo(wx, wy + wh * k / 6); ctx.lineTo(wx + ww, wy + wh * k / 6); }
        strokeLine(ctx, '#2a3050', 2.4);
        rr(ctx, wx, wy, ww, wh, 4); paint(ctx, null, 3, '#2a3050');
      }
      // rayons de lumière depuis les verrières
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const wx of [40, 190, 340]) {
        const g = ctx.createLinearGradient(wx, 60, wx - 80, 330);
        g.addColorStop(0, rgba('#e8f6ff', 0.2)); g.addColorStop(1, rgba('#e8f6ff', 0));
        ctx.fillStyle = g; poly(ctx, [[wx + 6, 60], [wx + 100, 60], [wx + 30, 340], [wx - 90, 340]]); ctx.fill();
      }
      ctx.restore();
      // charpente
      ctx.fillStyle = '#262c48'; ctx.fillRect(0, 0, SKY_W, 14);
      ctx.beginPath(); for (let x = 0; x < SKY_W; x += 48) { ctx.moveTo(x, 14); ctx.lineTo(x + 24, 34); ctx.lineTo(x + 48, 14); } ctx.moveTo(0, 34); ctx.lineTo(SKY_W, 34);
      strokeLine(ctx, '#262c48', 3.2);
    },
    layers: [
      L(40, 252, 0.05, (ctx, S) => {
        const W = S.W;
        const xs = S.spread(5, 0.4);
        xs.forEach((x, i) => {
          const h = S.r(150, 190), w = S.r(46, 60);
          S.rep(x, w, (xx) => silo(ctx, xx, 278, w, h, i % 2 ? '#6e7ea8' : '#7484ae'));
        });
        for (const x of S.spread(4, 0.6)) S.rep(x, 10, (xx) => { ctx.fillStyle = '#5a6890'; ctx.fillRect(xx - 5, 40, 10, 240); ctx.fillRect(xx - 7, 120, 14, 4); });
        ctx.fillStyle = '#5a6890'; ctx.fillRect(-5, 270, W + 10, 30);
        haze(ctx, W, 40, 292, '#8a9ac8', 0.3, 0.4);
      }),
      L(20, 272, 0.12, (ctx, S) => {
        const W = S.W;
        // tuyaux horizontaux
        for (const y of [64, 214]) pipeRun(ctx, -10, W + 10, y, 9, '#6a88a8', W);
        for (const x of S.spread(5, 0.6)) { const y0 = S.pick([64, 214]); S.rep(x, 12, (xx) => { pipeV(ctx, xx, 20, y0, 7, '#6a88a8'); valve(ctx, xx, y0 - 30, 1, '#e85a4a'); }); }
        // engrenages géants
        S.spread(5, 0.5).forEach((x, i) => {
          const r = S.r(26, 52), y = S.r(100, 210);
          S.rep(x, r + 10, (xx, rnd) => gear(ctx, xx, y, r, Math.round(r / 4.2), i % 2 ? '#8a98b8' : '#a0a8c0', rnd, 2));
        });
        for (const x of S.spread(3, 0.7)) S.rep(x, 16, (xx) => gauge(ctx, xx, 236, 1));
        ctx.fillStyle = lgY(ctx, [[260, '#4a5a80'], [292, '#44527a']]); ctx.fillRect(-5, 262, W + 10, 32);
        haze(ctx, W, 20, 292, '#7a8ab8', 0.18, 0.25);
      }),
      L(110, 182, 0.22, (ctx, S) => {
        const W = S.W;
        const y = 168;
        // piliers
        for (let x = 0; x < W; x += W / 6) S.rep(x, 8, (xx) => { rr(ctx, xx - 4, y, 8, 130, 1); paint(ctx, lgY(ctx, [[y, '#5a6a90'], [292, '#4a5880']]), 1.6); });
        // passerelle
        ctx.fillStyle = lgY(ctx, [[y, '#7a8ab0'], [y + 9, '#5a6a92']]); ctx.fillRect(-5, y, W + 10, 9);
        hazard(ctx, -5, y + 9, W + 10, 4);
        ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(W + 5, y); ctx.moveTo(-5, y + 13); ctx.lineTo(W + 5, y + 13); strokeLine(ctx, OUT, 1.8);
        // rambarde
        ctx.beginPath();
        ctx.moveTo(-5, y - 22); ctx.lineTo(W + 5, y - 22); ctx.moveTo(-5, y - 11); ctx.lineTo(W + 5, y - 11);
        for (let x = 0; x <= W; x += W / 36) { ctx.moveTo(x, y); ctx.lineTo(x, y - 22); }
        strokeLine(ctx, OUT, 3); ctx.stroke(); strokeLine(ctx, '#ffc23a', 1.6);
        // caisses sur la passerelle
        for (const x of S.spread(3, 0.7)) S.rep(x, 20, (xx, rnd) => { crate(ctx, xx, y, 0.8); if (rnd() < 0.5) crate(ctx, xx + 15, y, 0.6); });
        // lampes suspendues
        for (const x of S.spread(4, 0.5)) S.rep(x, 30, (xx) => hangLamp(ctx, xx, 110, 136, S));
        haze(ctx, W, 110, 292, '#8a9ac8', 0.1, 0.12);
      }),
      L(60, 232, 0.33, (ctx, S) => {
        const W = S.W;
        const by = 268;
        // machines (derrière le tapis)
        const xs = S.spread(3, 0.4);
        xs.forEach((x, i) => S.rep(x, 50, (xx, rnd) => extruder(ctx, xx, by, 1, rnd, S, i)));
        // sacs de croquettes et tonneaux
        for (const x of S.spread(4, 0.7)) S.rep(x, 30, (xx, rnd) => { kibbleBag(ctx, xx, by, 1, rnd); if (rnd() < 0.6) kibbleBag(ctx, xx + 18, by, 0.85, rnd); });
        for (const x of S.spread(3, 0.8)) S.rep(x, 16, (xx, rnd) => barrel(ctx, xx, by + 2, 1, rnd() < 0.5 ? '#3a9aa8' : '#e85a4a'));
        // tapis roulant
        conveyor(ctx, S, 238, W);
        for (const x of S.spread(9, 0.6)) S.rep(x, 16, (xx, rnd) => { if (rnd() < 0.35) crate(ctx, xx, 236, 0.7); else kibblePile(ctx, xx, 237, 1, rnd); });
        ctx.fillStyle = lgY(ctx, [[268, '#4a5678'], [292, '#3e4a6c']]); ctx.fillRect(-5, 266, W + 10, 28);
        ctx.fillStyle = rgba('#8a96c0', 0.6); ctx.fillRect(-5, 266, W + 10, 1.5);
      }),
      L(258, 102, 1, (ctx, S) => {
        const W = S.W;
        // bordure de sécurité
        ctx.fillStyle = lgY(ctx, [[266, '#8a96b8'], [278, '#6a7698']]); ctx.fillRect(-5, 266, W + 10, 12);
        for (let x = 40; x < W; x += W / 4) hazard(ctx, x, 269, 110, 6);
        ctx.fillStyle = rgba('#ffffff', 0.35); ctx.fillRect(-5, 267, W + 10, 1.2);
        // sol en tôle
        ctx.fillStyle = lgY(ctx, [[277, '#9aa6c4'], [300, '#8a96b6'], [330, '#76829e'], [360, '#5e6884']]); ctx.fillRect(-5, 277, W + 10, 90);
        // motif losangé (tôle larmée) sur la partie avant
        ctx.beginPath();
        for (let y = 312; y < 362; y += 7) for (let x = ((y / 7) % 2) * 6; x < W + 6; x += 12) { ctx.moveTo(x - 2.4, y + 1.2); ctx.lineTo(x + 2.4, y - 1.2); }
        strokeLine(ctx, rgba('#c8d0ea', 0.35), 1.2);
        // allée de circulation peinte
        ctx.fillStyle = rgba('#b8c4e0', 0.45); ctx.fillRect(-5, 283, W + 10, 22);
        ctx.fillStyle = '#ffc23a'; ctx.fillRect(-5, 282, W + 10, 2); ctx.fillRect(-5, 305, W + 10, 2);
        for (let x = 20; x < W; x += 90) { poly(ctx, [[x, 290], [x + 14, 290], [x + 14, 287], [x + 22, 294], [x + 14, 301], [x + 14, 298], [x, 298]]); ctx.fillStyle = rgba('#ffffff', 0.55); ctx.fill(); }
        pawTrail(S, { fP0: () => 283, fP1: () => 305 }, 22, (q, y) => paw(ctx, q, y, 1.15, rgba('#6a7698', 0.4), Math.PI / 2));
        // joints de plaques + rivets
        ctx.beginPath(); for (let x = 0; x <= W; x += 75) { ctx.moveTo(x, 307); ctx.lineTo(x, 362); } ctx.moveTo(-5, 334); ctx.lineTo(W + 5, 334); strokeLine(ctx, rgba('#3a4462', 0.5), 1.3);
        ctx.fillStyle = rgba('#dfe6ff', 0.6); for (let x = 0; x <= W; x += 75) for (const y of [312, 330, 340, 356]) { ctx.fillRect(x + 3, y, 1.6, 1.6); ctx.fillRect(x - 4.6, y, 1.6, 1.6); }
        // grilles d'évacuation, croquettes renversées, flaques d'huile
        for (const x of S.spread(2, 0.5)) S.rep(x, 22, (xx) => { rr(ctx, xx - 18, 340, 36, 10, 2); paint(ctx, '#4a5472', 1.6); ctx.beginPath(); for (let k = 1; k < 8; k++) { ctx.moveTo(xx - 18 + k * 4.5, 341); ctx.lineTo(xx - 18 + k * 4.5, 349); } strokeLine(ctx, '#2a3050', 1.4); });
        for (let i = 0; i < 26; i++) { const x = S.r(0, W), y = S.r(312, 356); S.rep(x, 5, (xx, rnd) => kibble(ctx, xx, y, 0.9, Math.floor(rnd() * 3), rnd() * TAU)); }
        for (let i = 0; i < 4; i++) { const x = S.r(0, W), y = S.r(316, 352), w = S.r(10, 20); S.rep(x, w, (xx) => { ell(ctx, xx, y, w, w * 0.22); ctx.fillStyle = rgba('#2a2a40', 0.35); ctx.fill(); ell(ctx, xx - w * 0.3, y - w * 0.06, w * 0.3, w * 0.05); ctx.fillStyle = rgba('#b8a8ff', 0.4); ctx.fill(); }); }
        ctx.beginPath(); ctx.moveTo(-5, 266); ctx.lineTo(W + 5, 266); strokeLine(ctx, OUT, 2.6);
        ctx.beginPath(); ctx.moveTo(-5, 277.5); ctx.lineTo(W + 5, 277.5); strokeLine(ctx, rgba(OUT, 0.7), 1.6);
        ctx.fillStyle = lgY(ctx, [[324, rgba('#1a1e38', 0)], [360, rgba('#1a1e38', 0.28)]]); ctx.fillRect(-5, 324, W + 10, 40);
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(5, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 358 + rnd() * 3;
            if (kind < 0.35) { crate(ctx, xx, by + 4, 1.4); kibblePile(ctx, xx + 26, by + 4, 1.4, rnd); }
            else if (kind < 0.65) { barrel(ctx, xx, by + 6, 1.4, '#e85a4a'); cone(ctx, xx + 26, by + 2, 1); }
            else { kibblePile(ctx, xx, by + 4, 1.8, rnd); pipeV(ctx, xx + 26, by - 20, by + 8, 7, '#6a88a8'); valve(ctx, xx + 26, by - 12, 1.2, '#ffc23a'); }
          });
        }
      }, true),
    ],
  };
}

function hazard(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#ffc23a'; ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  for (let xx = Math.floor(x / 10) * 10 - 20; xx < x + w + 20; xx += 10) { ctx.moveTo(xx, y + h); ctx.lineTo(xx + h, y); ctx.lineTo(xx + h + 5, y); ctx.lineTo(xx + 5, y + h); ctx.closePath(); }
  ctx.fillStyle = '#2a2438'; ctx.fill();
  ctx.restore();
}
function gear(ctx, x, y, r, n, col, rnd, lw = 2) {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = i * TAU / n, a1 = a0 + TAU / n * 0.25, a2 = a0 + TAU / n * 0.5, a3 = a0 + TAU / n * 0.75;
      const ro = r, ri = r * 0.84;
      if (i === 0) ctx.moveTo(x + Math.cos(a0) * ri, y + Math.sin(a0) * ri);
      ctx.lineTo(x + Math.cos(a1) * ro, y + Math.sin(a1) * ro);
      ctx.lineTo(x + Math.cos(a2) * ro, y + Math.sin(a2) * ro);
      ctx.lineTo(x + Math.cos(a3) * ri, y + Math.sin(a3) * ri);
      ctx.lineTo(x + Math.cos(a0 + TAU / n) * ri, y + Math.sin(a0 + TAU / n) * ri);
    }
    ctx.closePath();
  };
  path(); paint(ctx, ball(ctx, x, y, r, col, 0.25, 0.3), lw);
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.strokeStyle = rgba(shade(col, -0.35), 0.5); ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = shade(col, -0.4);
  const holes = n > 9 ? 6 : 4;
  for (let i = 0; i < holes; i++) { const a = i * TAU / holes + 0.3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.12, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); paint(ctx, ball(ctx, x, y, r * 0.22, '#ffc23a', 0.35, 0.3), lw * 0.8);
  ctx.beginPath(); ctx.arc(x, y, r * 0.07, 0, TAU); ctx.fillStyle = OUT; ctx.fill();
  gloss(ctx, x - r * 0.4, y - r * 0.5, r * 0.22, r * 0.08, 0.4);
}
function pipeRun(ctx, x0, x1, y, w, col, W) {
  rr(ctx, x0, y - w / 2, x1 - x0, w, w / 2);
  paint(ctx, lgY(ctx, [[y - w / 2, shade(col, 0.3)], [y, col], [y + w / 2, shade(col, -0.3)]]), 2);
  ctx.beginPath(); ctx.moveTo(x0, y - w * 0.22); ctx.lineTo(x1, y - w * 0.22); strokeLine(ctx, rgba('#ffffff', 0.4), 1.2);
  for (let x = W / 10; x < W; x += W / 5) { rr(ctx, x - 3, y - w / 2 - 2, 6, w + 4, 1.5); paint(ctx, shade(col, -0.1), 1.6); }
}
function pipeV(ctx, x, y0, y1, w, col) {
  rr(ctx, x - w / 2, y0, w, y1 - y0, w / 2);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(col, 0.3)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.3));
  paint(ctx, g, 2);
}
function valve(ctx, x, y, s, col) {
  ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, TAU); ctx.lineWidth = 2.6 * s + 2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.6 * s; ctx.strokeStyle = col; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.lineTo(x + 7 * s, y); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x, y + 7 * s); strokeLine(ctx, OUT, 2.2 * s);
  ctx.beginPath(); ctx.arc(x, y, 2 * s, 0, TAU); ctx.fillStyle = shade(col, 0.2); ctx.fill();
}
function gauge(ctx, x, y, s) {
  ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, TAU); paint(ctx, '#f4f0e6', 2);
  ctx.beginPath(); ctx.arc(x, y, 6.5 * s, Math.PI * 0.8, Math.PI * 2.2); strokeLine(ctx, rgba(OUT, 0.5), 1);
  ctx.beginPath(); ctx.arc(x, y, 6.5 * s, Math.PI * 1.9, Math.PI * 2.2); strokeLine(ctx, '#e85a4a', 1.6);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5 * s, y - 3 * s); strokeLine(ctx, '#e85a4a', 1.4);
  ctx.beginPath(); ctx.arc(x, y, 1.4 * s, 0, TAU); ctx.fillStyle = OUT; ctx.fill();
}
function silo(ctx, x, by, w, h, col) {
  const top = by - h;
  ctx.fillStyle = shade(col, -0.15);
  for (const dx of [-0.36, 0.36]) ctx.fillRect(x + dx * w - 2, by - 40, 4, 40);
  ctx.beginPath(); ctx.moveTo(x - w / 2, by - 50); ctx.lineTo(x - 6, by - 26); ctx.lineTo(x + 6, by - 26); ctx.lineTo(x + w / 2, by - 50); ctx.closePath(); ctx.fillStyle = shade(col, -0.05); ctx.fill();
  ctx.fillRect(x - w / 2, top + 10, w, h - 60);
  ctx.beginPath(); ctx.ellipse(x, top + 10, w / 2, 10, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.12); ctx.fillRect(x - w / 2 + 4, top + 8, 5, h - 58);
  ctx.fillStyle = rgba('#000000', 0.12); ctx.fillRect(x + w * 0.2, top + 8, w * 0.3, h - 58);
  ctx.beginPath(); for (let k = 1; k < 5; k++) { const yy = top + 10 + k * (h - 60) / 5; ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); } strokeLine(ctx, rgba('#2a3050', 0.25), 1);
  // étiquette poisson
  const ly = top + h * 0.35;
  rr(ctx, x - w * 0.36, ly, w * 0.72, 16, 3); ctx.fillStyle = rgba('#ffe7b0', 0.7); ctx.fill();
  ctx.save(); ctx.translate(x, ly + 8); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(0, -6, 6, 0); ctx.quadraticCurveTo(0, 6, -8, 0); ctx.moveTo(5, 0); ctx.lineTo(10, -4); ctx.lineTo(10, 4); ctx.closePath(); ctx.fillStyle = rgba('#e8603a', 0.8); ctx.fill(); ctx.restore();
}
function conveyor(ctx, S, y, W) {
  // pieds
  for (let x = W / 12; x < W; x += W / 6) { ctx.fillStyle = '#4a5878'; ctx.fillRect(x - 3, y + 8, 6, 30); ctx.fillRect(x - 8, y + 34, 16, 3); }
  rr(ctx, -10, y, W + 20, 12, 6);
  paint(ctx, lgY(ctx, [[y, '#4a4a5e'], [y + 12, '#2a2a3a']]), 2);
  ctx.fillStyle = '#5a5a70'; ctx.fillRect(-10, y + 1.5, W + 20, 2);
  const n = Math.round(W / 15);
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * W / n; ctx.beginPath(); ctx.arc(x, y + 7.5, 3.2, 0, TAU); ctx.fillStyle = '#8a8aa4'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y + 7.5, 1, 0, TAU); ctx.fillStyle = '#2a2a3a'; ctx.fill(); }
  ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const x = i * W / (n * 2); ctx.moveTo(x, y + 0.5); ctx.lineTo(x - 2, y + 3); } strokeLine(ctx, rgba('#1a1a28', 0.6), 1);
  hazard(ctx, -10, y + 12, W + 20, 4);
  ctx.beginPath(); ctx.moveTo(-10, y + 16); ctx.lineTo(W + 10, y + 16); strokeLine(ctx, OUT, 1.6);
}
function kibble(ctx, x, y, s, kind, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const col = kind === 1 ? '#c8783a' : kind === 2 ? '#a85a2a' : '#d89048';
  ctx.beginPath();
  if (kind === 0) { ctx.moveTo(-3 * s, 0); ctx.quadraticCurveTo(0, -2.6 * s, 2.2 * s, 0); ctx.quadraticCurveTo(0, 2.6 * s, -3 * s, 0); ctx.moveTo(2 * s, 0); ctx.lineTo(3.6 * s, -1.6 * s); ctx.lineTo(3.6 * s, 1.6 * s); ctx.closePath(); }
  else if (kind === 1) { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, b = a + TAU / 10; ctx.lineTo(Math.cos(a) * 2.8 * s, Math.sin(a) * 2.8 * s); ctx.lineTo(Math.cos(b) * 1.3 * s, Math.sin(b) * 1.3 * s); } ctx.closePath(); }
  else ctx.arc(0, 0, 2.2 * s, 0, TAU);
  ctx.lineWidth = 1.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.arc(-0.6 * s, -0.7 * s, 0.6 * s, 0, TAU); ctx.fillStyle = rgba('#ffe0b0', 0.7); ctx.fill();
  ctx.restore();
}
function kibblePile(ctx, x, by, s, rnd) {
  const w = 14 * s;
  ctx.beginPath(); ctx.moveTo(x - w, by); ctx.quadraticCurveTo(x, by - w * 1.1, x + w, by); ctx.closePath();
  paint(ctx, lgY(ctx, [[by - w, '#d89048'], [by, '#a85a2a']]), 1.6);
  for (let i = 0; i < 9 * s; i++) { const t = rnd() * 2 - 1, h = (1 - t * t) * w * 0.5; kibble(ctx, x + t * w * 0.85, by - rnd() * h - 1.5, s * 0.75, Math.floor(rnd() * 3), rnd() * TAU); }
}
function kibbleBag(ctx, x, by, s, rnd) {
  const w = 16 * s, h = 24 * s;
  const col = rnd() < 0.5 ? '#ff8a3a' : '#3a9aa8';
  ctx.beginPath(); ctx.moveTo(x - w / 2, by); ctx.lineTo(x - w / 2 + 1, by - h + 3); ctx.lineTo(x - w * 0.3, by - h); ctx.lineTo(x + w * 0.3, by - h - 1); ctx.lineTo(x + w / 2 - 1, by - h + 3); ctx.lineTo(x + w / 2, by); ctx.closePath();
  paint(ctx, vgrad(ctx, by - h, by, col, 0.2, 0.2), 1.8);
  ctx.beginPath(); ctx.moveTo(x - w * 0.4, by - h + 3); ctx.lineTo(x + w * 0.4, by - h + 3); strokeLine(ctx, rgba(OUT, 0.5), 1);
  ctx.beginPath(); ctx.arc(x, by - h * 0.45, w * 0.28, 0, TAU); ctx.fillStyle = '#fff4e0'; ctx.fill();
  ctx.save(); ctx.translate(x, by - h * 0.45); ctx.scale(0.55 * s, 0.55 * s);
  ctx.beginPath(); ctx.arc(0, 1, 4, 0, TAU); ctx.moveTo(-4, -1); ctx.lineTo(-3.4, -6); ctx.lineTo(-1, -3); ctx.moveTo(4, -1); ctx.lineTo(3.4, -6); ctx.lineTo(1, -3); ctx.fillStyle = OUT; ctx.fill();
  ctx.restore();
}
function barrel(ctx, x, by, s, col) {
  const w = 16 * s, h = 22 * s;
  rr(ctx, x - w / 2, by - h, w, h, 3 * s);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(col, 0.25)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.3));
  paint(ctx, g, 1.8);
  ctx.beginPath(); for (const k of [0.22, 0.78]) { ctx.moveTo(x - w / 2, by - h * k); ctx.lineTo(x + w / 2, by - h * k); } strokeLine(ctx, rgba(OUT, 0.6), 1.4);
  ell(ctx, x, by - h, w / 2 - 0.5, 2.4 * s); paint(ctx, shade(col, 0.15), 1.4);
  ctx.fillStyle = '#ffc23a'; ctx.beginPath(); ctx.moveTo(x, by - h * 0.62); ctx.lineTo(x + 3.4 * s, by - h * 0.38); ctx.lineTo(x - 3.4 * s, by - h * 0.38); ctx.closePath(); ctx.fill();
}
function crate(ctx, x, by, s) {
  const w = 20 * s;
  rr(ctx, x - w / 2, by - w, w, w, 1.5); paint(ctx, vgrad(ctx, by - w, by, '#c8925a', 0.15, 0.2), 1.8);
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 2, by - w + 2); ctx.lineTo(x + w / 2 - 2, by - 2); ctx.moveTo(x - w / 2, by - w * 0.5); ctx.lineTo(x + w / 2, by - w * 0.5); strokeLine(ctx, rgba('#7a4a2a', 0.7), 1.4 * s + 0.4);
  ctx.beginPath(); rr(ctx, x - w / 2 + 1.5, by - w + 1.5, w - 3, w - 3, 1); strokeLine(ctx, rgba('#7a4a2a', 0.55), 1);
}
function hangLamp(ctx, x, y0, y1, S) {
  ctx.beginPath(); ctx.moveTo(x, y0 - 120); ctx.lineTo(x, y1 - 8); strokeLine(ctx, OUT, 1.4);
  glow(ctx, x, y1 + 6, 40, '#fff0b0', 0.5);
  S.light(x, y1 + 4, 36, { a: 0.8 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y1, 0, y1 + 120); g.addColorStop(0, rgba('#fff0b0', 0.18)); g.addColorStop(1, rgba('#fff0b0', 0));
  ctx.fillStyle = g; poly(ctx, [[x - 8, y1], [x + 8, y1], [x + 40, y1 + 120], [x - 40, y1 + 120]]); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - 3, y1 - 9); ctx.lineTo(x + 3, y1 - 9); ctx.lineTo(x + 11, y1 + 1); ctx.lineTo(x - 11, y1 + 1); ctx.closePath();
  paint(ctx, lgY(ctx, [[y1 - 9, '#5ac0c8'], [y1, '#2a8a98']]), 1.6);
  ell(ctx, x, y1 + 1.5, 6, 2.2); ctx.fillStyle = '#fff8d0'; ctx.fill();
}
function extruder(ctx, x, by, s, rnd, S, i) {
  const w = 62 * s, h = 70 * s, top = by - h;
  // trémie
  ctx.beginPath(); ctx.moveTo(x - 24 * s, top - 30 * s); ctx.lineTo(x + 24 * s, top - 30 * s); ctx.lineTo(x + 8 * s, top + 2); ctx.lineTo(x - 8 * s, top + 2); ctx.closePath();
  paint(ctx, lgY(ctx, [[top - 30 * s, '#c8d0e4'], [top, '#8a94b0']]), 2);
  kibblePile(ctx, x, top - 28 * s, 1.1, rnd);
  // corps
  rr(ctx, x - w / 2, top, w, h, 4); paint(ctx, lgY(ctx, [[top, shade(i % 2 ? '#3a9aa8' : '#e8784a', 0.12)], [by, shade(i % 2 ? '#3a9aa8' : '#e8784a', -0.18)]]), 2);
  hazard(ctx, x - w / 2 + 2, by - 10 * s, w - 4, 7 * s);
  rr(ctx, x - w * 0.36, top + 10 * s, w * 0.42, 26 * s, 3); paint(ctx, '#2a3050', 1.6);
  ctx.fillStyle = '#7aff9a'; ctx.font = `bold ${7 * s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('MIAOU', x - w * 0.15, top + 18 * s);
  ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(x - w * 0.32, top + 26 * s + k * 2.4 * s); ctx.lineTo(x - w * 0.32 + (6 + k * 3) * s, top + 26 * s + k * 2.4 * s); } strokeLine(ctx, rgba('#7aff9a', 0.7), 1);
  S.light(x - w * 0.15, top + 22 * s, 18 * s, { alt: 1, a: 0.5 });
  for (let k = 0; k < 3; k++) { const lx = x + w * 0.2, ly = top + 14 * s + k * 9 * s; ctx.beginPath(); ctx.arc(lx, ly, 2.6 * s, 0, TAU); paint(ctx, ['#ff5a4a', '#ffc23a', '#5aff7a'][k], 1.2); glow(ctx, lx, ly, 6 * s, ['#ff5a4a', '#ffc23a', '#5aff7a'][k], 0.5); }
  gauge(ctx, x + w * 0.36, top + 16 * s, 0.7 * s);
  // goulotte vers le tapis
  ctx.beginPath(); ctx.moveTo(x + w / 2, top + 36 * s); ctx.lineTo(x + w / 2 + 14 * s, top + 36 * s); ctx.lineTo(x + w / 2 + 18 * s, top + 46 * s); ctx.lineTo(x + w / 2, top + 46 * s); ctx.closePath(); paint(ctx, '#8a94b0', 1.6);
  for (let k = 0; k < 4; k++) kibble(ctx, x + w / 2 + 16 * s + rnd() * 4, top + 48 * s + k * 5 * s, 0.8, Math.floor(rnd() * 3), rnd() * TAU);
  // cheminée à vapeur
  pipeV(ctx, x - w * 0.3, top - 40 * s, top + 2, 8 * s, '#8a94b0');
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - w * 0.3 + k * 4, top - 46 * s - k * 9, 5 + k * 2.5, 0, TAU); ctx.fillStyle = rgba('#e8f0ff', 0.5 - k * 0.12); ctx.fill(); }
  gloss(ctx, x - w * 0.36, top + 5, w * 0.16, 2, 0.45, 0);
}

// ------------------------------------------------------------------ Royaume des Nuages
function skyDef() {
  const GOLD = '#ffcf4a';
  return {
    ambient: 'petals', kind: 'day', horizon: 222,
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#3f9cf0'], [0.32, '#86ccfa'], [0.6, '#cfe8ff'], [0.82, '#ffe4f2'], [1, '#fff2e6']]);
      sunDisc(ctx, 384, 70, 22, { glowR: 6.5, rayA: 0.26 });
      rainbow(ctx, 170, 330, 250, 34, 0.42);
    },
    layers: [
      L(0, 200, 0.02, (ctx, S) => {
        for (const x of S.spread(5, 0.7)) {
          const y = S.r(40, 120), w = S.r(80, 150);
          S.rep(x, w, (xx, rnd) => {
            ctx.beginPath();
            for (let k = 0; k < 3; k++) addEll(ctx, xx + (k - 1) * w * 0.3 + rnd() * 10, y + (rnd() - 0.5) * 5, w * (0.22 + rnd() * 0.16), 2.4 + rnd() * 2.6);
            ctx.fillStyle = rgba('#ffffff', 0.75); ctx.fill();
          });
        }
        for (let i = 0; i < 5; i++) {
          const x = S.r(0, S.W), y = S.r(60, 150), s = S.r(3, 4.5);
          S.rep(x, 10, (xx) => { ctx.beginPath(); ctx.moveTo(xx - s, y - s * 0.3); ctx.quadraticCurveTo(xx - s * 0.45, y - s * 0.75, xx, y); ctx.quadraticCurveTo(xx + s * 0.45, y - s * 0.75, xx + s, y - s * 0.3); strokeLine(ctx, rgba('#5a6aa8', 0.6), 1.3); });
        }
      }),
      L(120, 172, 0.04, (ctx, S) => {
        const W = S.W;
        // petites îles lointaines
        for (const x of S.spread(4, 0.7)) {
          const y = S.r(150, 200), w = S.r(26, 44);
          S.rep(x, w, (xx, rnd) => {
            island(ctx, xx, y, w, rnd, '#a8d8b0', '#b8b0d8');
            ctx.fillStyle = rgba('#ffffff', 0.7); ctx.fillRect(xx + w * 0.3, y + 2, 2, 60);
            if (rnd() < 0.6) { ctx.fillStyle = '#e8e4f6'; for (let k = 0; k < 4; k++) ctx.fillRect(xx - 7 + k * 4.5, y - w * 0.1 - 9, 2, 9); poly(ctx, [[xx - 9, y - w * 0.1 - 9], [xx + 0.5, y - w * 0.1 - 14], [xx + 10, y - w * 0.1 - 9]]); ctx.fill(); }
          });
        }
        // mer de nuages
        for (let row = 0; row < 3; row++) {
          const n = 16 - row * 2;
          for (let i = 0; i < n; i++) {
            const x = (i + S.rand() * 0.6) * W / n, r = S.r(18, 30) + row * 4, y = 240 + row * 16;
            const c = ['#f2eeff', '#fbf8ff', '#ffffff'][row];
            S.rep(x, r * 2, (xx) => blob(ctx, [[xx, y, r], [xx + r * 0.9, y + r * 0.3, r * 0.7], [xx - r * 0.9, y + r * 0.35, r * 0.65]], c, { lw: 0, dark: mix(c, '#c8c0f0', 0.5), light: 0.1, hl: false }));
          }
        }
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-5, 286, W + 10, 8);
        haze(ctx, W, 120, 292, '#f0eaff', 0.35, 0.2);
      }),
      L(70, 222, 0.09, (ctx, S) => {
        const W = S.W;
        const bx = S.r(0, W);
        S.rep(bx, 30, (xx) => balloon(ctx, xx, S.r(110, 140), 1, '#ff7aa8', '#ffe07a'));
        S.spread(3, 0.5).forEach((x, i) => {
          const y = S.r(160, 205), w = S.r(70, 110);
          S.rep(x, w, (xx, rnd) => skyIsle(ctx, xx, y, w, rnd, S, i));
        });
        haze(ctx, W, 70, 292, '#e8eaff', 0.3, 0.2);
      }),
      L(100, 192, 0.18, (ctx, S) => {
        const W = S.W;
        const tx = S.r(0, W);
        // tours de cumulus
        for (const x of S.spread(5, 0.6)) { const h = S.r(60, 110); S.rep(x, 50, (xx, rnd) => cumulus(ctx, xx, 272, S.r(50, 80), h, rnd, '#fbfaff', '#c4c6ee')); }
        S.rep(tx, 70, (xx) => tholos(ctx, xx, 246, 1, GOLD, S));
        for (let i = 0; i < 18; i++) {
          const x = (i + S.rand() * 0.5) * W / 18, r = S.r(20, 30);
          S.rep(x, r * 2, (xx) => blob(ctx, [[xx, 262, r], [xx + r * 0.9, 268, r * 0.75], [xx - r * 0.9, 270, r * 0.7]], '#eeecfc', { lw: 0, dark: '#ccc8f0', light: 0.08, hla: 0.2 }));
        }
        ctx.fillStyle = '#e6e4fa'; ctx.fillRect(-5, 270, W + 10, 24);
        haze(ctx, W, 100, 292, '#eceaff', 0.18, 0.08);
      }),
      L(60, 232, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 260, [[3, 1, 2], [2, 3, 5]]);
        const xs = S.spread(6, 0.5);
        const kinds = ['columns', 'statue', 'lamp', 'rainbow', 'columns', 'lamp'];
        const k0 = S.ri(0, 5);
        xs.forEach((x, i) => {
          const kind = kinds[(i + k0) % kinds.length];
          if (kind === 'columns') S.rep(x, 50, (xx, rnd) => { marbleColumn(ctx, xx - 16, fM(xx) + 4, 1, rnd, false, GOLD); marbleColumn(ctx, xx + 16, fM(xx) + 4, 1, rnd, true, GOLD); });
          else if (kind === 'statue') S.rep(x, 40, (xx) => wingedCat(ctx, xx, fM(xx) + 4, 1, GOLD));
          else if (kind === 'lamp') S.rep(x, 20, (xx) => starLamp(ctx, xx, fM(xx) + 6, 1, S));
          else S.rep(x, 50, () => {});
        });
        // arcs-en-ciel miniatures posés sur les nuages
        for (const x of S.spread(2, 0.6)) S.rep(x, 40, (xx) => rainbow(ctx, xx, fM(xx) + 6, 34, 9, 0.85, true));
        // collines de nuages (devant les objets : ils y sont « plantés »)
        for (let i = 0; i < 16; i++) {
          const x = (i + S.rand() * 0.5) * W / 16, r = S.r(14, 22);
          S.rep(x, r * 2.2, (xx) => blob(ctx, [[xx, fM(xx) + 2, r], [xx + r * 0.95, fM(xx) + 6, r * 0.72], [xx - r * 0.9, fM(xx) + 7, r * 0.66]], '#e4e0fa', { lw: 1.8, stroke: '#7a78c0', dark: '#bab6ea', light: 0.1, hla: 0.45 }));
        }
        profilePath(ctx, W, (x) => fM(x) + 10, 300);
        ctx.fillStyle = lgY(ctx, [[262, '#d8d4f6'], [292, '#c8c4f0']]); ctx.fill();
        for (let i = 0; i < 16; i++) { const x = S.r(0, W), y = S.r(110, 240); S.rep(x, 6, (xx) => sparkle(ctx, xx, y, S.r(2, 3.6), '#ffffff', 0.9)); }
        haze(ctx, W, 60, 282, '#f4f0ff', 0.1, 0.04);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [20, 3, 5.5, 'bump'], edge2: [18, 2.6, 4.6, 'bump'],
          fill: [[262, '#ffffff'], [290, '#f2f0ff'], [330, '#e0e0fa'], [360, '#c8ccf0']],
          fill2: [[300, '#ffffff'], [330, '#ebeafc'], [360, '#cdd0f2']],
          shadow: '#6a6ab8', rim: rgba('#ffffff', 1), rim2: rgba('#ffffff', 0.95),
          stroke: rgba('#5a5aa8', 0.9), stroke2: rgba('#9a9ad8', 0.9), lw: 2.2,
          path: { fill: [[280, '#f2eaff'], [296, '#ebe2fc'], [312, '#e2d8f8']], edge: '#b8a8e8' },
          upper(ctx, S, F) {
            scatter(S, 14, (x) => F.fTop(x) + 5, (x) => F.fP0(x) - 2, (x, y, rnd) => { ctx.beginPath(); ctx.arc(x, y + 3, 6 + rnd() * 4, Math.PI * 1.1, Math.PI * 1.9); strokeLine(ctx, rgba('#c8c8f0', 0.7), 1.2); }, 10);
          },
          pathDeco(ctx, S, F) {
            pawTrail(S, F, 22, (q, y) => paw(ctx, q, y, 1.2, rgba('#c8b0f0', 0.55), Math.PI / 2));
            scatter(S, 22, (x) => F.fP0(x) + 4, (x) => F.fP1(x) + 2, (x, y, rnd) => sparkle(ctx, x, y, 1.6 + rnd() * 1.4, rnd() < 0.5 ? '#ffd860' : '#ffffff', 0.95), 4);
          },
          lower(ctx, S, F) {
            // lobes de nuage (ombre douce + liseré clair)
            for (let i = 0; i < 26; i++) {
              const x = S.r(0, S.W), y = S.r(318, 352), r = S.r(10, 18);
              S.rep(x, r + 2, (xx) => {
                ctx.beginPath(); ctx.arc(xx, y + r * 0.6, r, Math.PI * 1.08, Math.PI * 1.92); strokeLine(ctx, rgba('#b8b8ea', 0.55), 1.6);
                ctx.beginPath(); ctx.arc(xx - 1, y + r * 0.6 - 1.6, r - 2, Math.PI * 1.2, Math.PI * 1.6); strokeLine(ctx, rgba('#ffffff', 0.9), 1.2);
              });
            }
            scatter(S, 10, (x) => F.fP1(x) + 10, () => 354, (x, y, rnd) => sparkle(ctx, x, y, 2.4, rnd() < 0.5 ? '#ffd860' : '#ffb0e0', 0.95), 4);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 354 + rnd() * 5;
            blob(ctx, [[xx - 14, by + 4, 11], [xx + 2, by - 2, 14], [xx + 18, by + 4, 10]], '#ffffff', { lw: 1.8, stroke: '#8a8ad0', flat: by + 14, dark: '#d8d8f8', light: 0.05, hla: 0.4 });
            if (kind < 0.4) { goldStar(ctx, xx + 4, by - 16, 5, rnd() - 0.5); }
            else if (kind < 0.7) feather(ctx, xx - 10, by - 6, 1.3, rnd() * 0.6 - 0.9);
          });
        }
      }, true),
    ],
  };
}

function rainbow(ctx, cx, cy, r, w, a, outline = false) {
  const cols = ['#ff5a6a', '#ff9a3a', '#ffe04a', '#6ad86a', '#4ab8ff', '#8a6aff'];
  const bw = w / cols.length;
  if (outline) { ctx.beginPath(); ctx.arc(cx, cy, r + 1.4, Math.PI, 0); ctx.arc(cx, cy, r - w - 1.4, 0, Math.PI, true); ctx.closePath(); ctx.fillStyle = OUT; ctx.fill(); }
  cols.forEach((c, i) => {
    ctx.beginPath(); ctx.arc(cx, cy, r - i * bw - bw / 2, Math.PI, 0);
    ctx.strokeStyle = rgba(c, a); ctx.lineWidth = bw + 0.4; ctx.lineCap = 'butt'; ctx.stroke();
  });
  ctx.lineCap = 'round';
  if (outline) { ctx.beginPath(); ctx.arc(cx, cy, r - bw * 0.8, Math.PI * 1.15, Math.PI * 1.4); strokeLine(ctx, rgba('#ffffff', 0.6), 1.4); }
}
function skyIsle(ctx, x, y, w, rnd, S, i) {
  // cascade sous l'île
  const fx = x + w * (rnd() < 0.5 ? -0.28 : 0.3);
  ctx.fillStyle = lgY(ctx, [[y, rgba('#ffffff', 0.95)], [y + 110, rgba('#e8f6ff', 0)]]);
  ctx.fillRect(fx - 3, y - 2, 6, 110);
  island(ctx, x, y, w, rnd, '#7ad06a', '#a898c8', { lw: 1.8 });
  // herbe bombée
  const cs = [];
  for (let k = 0; k < 5; k++) cs.push([x - w * 0.36 + k * w * 0.18, y - w * 0.05 - 2, w * 0.1 + rnd() * 3]);
  blob(ctx, cs, '#7ad06a', { lw: 1.6, flat: y + 1, light: 0.25 });
  if (i % 3 === 0) { for (const dx of [-0.2, 0.18]) roundTree(ctx, x + dx * w, y - 4, 0.42, rnd, '#5cc05a', { lw: 1.4, th: 16 }); }
  else if (i % 3 === 1) greekTemple(ctx, x, y - 6, 0.6, '#ffcf4a');
  else { roundTree(ctx, x - w * 0.15, y - 4, 0.4, rnd, '#ff9ad0', { lw: 1.4, th: 16 }); greekTemple(ctx, x + w * 0.16, y - 5, 0.4, '#ffcf4a'); }
  ell(ctx, fx, y + 2, 5, 2); ctx.fillStyle = rgba('#ffffff', 0.9); ctx.fill();
}
function greekTemple(ctx, x, by, s, gold) {
  const w = 60 * s, h = 34 * s;
  rr(ctx, x - w / 2 - 4 * s, by - 5 * s, w + 8 * s, 6 * s, 1); paint(ctx, '#e8e4f6', 1.6);
  rr(ctx, x - w / 2, by - 9 * s, w, 5 * s, 1); paint(ctx, '#f4f2fc', 1.6);
  const n = 5;
  for (let k = 0; k < n; k++) { const cx = x - w / 2 + 6 * s + k * (w - 12 * s) / (n - 1); rr(ctx, cx - 2.6 * s, by - 9 * s - h, 5.2 * s, h, 1); paint(ctx, vgrad(ctx, by - h, by, '#fbfaff', 0.1, 0.15), 1.4); }
  rr(ctx, x - w / 2 - 2 * s, by - 9 * s - h - 6 * s, w + 4 * s, 6 * s, 1); paint(ctx, '#f0eefc', 1.6);
  poly(ctx, [[x - w / 2 - 3 * s, by - 9 * s - h - 6 * s], [x, by - 9 * s - h - 20 * s], [x + w / 2 + 3 * s, by - 9 * s - h - 6 * s]]); paint(ctx, '#f6f4ff', 1.6);
  ctx.beginPath(); ctx.arc(x, by - 9 * s - h - 11 * s, 2.6 * s, 0, TAU); ctx.fillStyle = gold; ctx.fill();
  ctx.fillStyle = gold; ctx.fillRect(x - w / 2 - 2 * s, by - 9 * s - h - 2 * s, w + 4 * s, 1.4 * s);
}
function tholos(ctx, x, by, s, gold, S) {
  const w = 70 * s, h = 46 * s;
  // escalier
  for (let k = 0; k < 3; k++) { rr(ctx, x - w / 2 - 10 * s + k * 4 * s, by - k * 5 * s, w + 20 * s - k * 8 * s, 6 * s, 1); paint(ctx, k % 2 ? '#f4f2fc' : '#e6e2f6', 1.6); }
  const top = by - 10 * s - h;
  ctx.fillStyle = rgba('#b8b0e0', 0.6); ctx.fillRect(x - w / 2 + 4, top + 4, w - 8, h);
  glow(ctx, x, top + h * 0.6, 30 * s, '#fff4c0', 0.6);
  S.light(x, top + h * 0.6, 30 * s);
  for (let k = 0; k < 6; k++) { const cx = x - w / 2 + 6 * s + k * (w - 12 * s) / 5; rr(ctx, cx - 3 * s, top, 6 * s, h, 1.5); paint(ctx, vgrad(ctx, top, by, '#fbfaff', 0.1, 0.18), 1.6); ctx.fillStyle = rgba('#b8b0e0', 0.5); ctx.fillRect(cx + 0.5 * s, top + 2, 1.4 * s, h - 4); }
  rr(ctx, x - w / 2 - 4 * s, top - 7 * s, w + 8 * s, 8 * s, 2); paint(ctx, '#f4f2fc', 1.8);
  ctx.fillStyle = gold; ctx.fillRect(x - w / 2 - 4 * s, top - 3 * s, w + 8 * s, 1.6 * s);
  ctx.beginPath(); ctx.moveTo(x - w / 2, top - 7 * s); ctx.bezierCurveTo(x - w / 2, top - 46 * s, x + w / 2, top - 46 * s, x + w / 2, top - 7 * s); ctx.closePath();
  paint(ctx, ball(ctx, x - 6 * s, top - 26 * s, 36 * s, gold, 0.4, 0.3), 2);
  ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(x + k * w * 0.18, top - 7 * s); ctx.quadraticCurveTo(x + k * w * 0.1, top - 30 * s, x, top - 36 * s); } strokeLine(ctx, rgba('#c8902a', 0.55), 1.1);
  gloss(ctx, x - w * 0.22, top - 26 * s, 6 * s, 3 * s, 0.6);
  // flèche à oreilles de chat
  poly(ctx, [[x - 5 * s, top - 34 * s], [x - 4 * s, top - 44 * s], [x - 0.5 * s, top - 37 * s], [x + 0.5 * s, top - 37 * s], [x + 4 * s, top - 44 * s], [x + 5 * s, top - 34 * s]]); paint(ctx, gold, 1.6);
}
function cumulus(ctx, x, by, w, h, rnd, col, dark) {
  const cs = [];
  const n = 6;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); cs.push([x + (rnd() - 0.5) * w * 0.4 * (1 - t), by - t * h, w * (0.42 - t * 0.2) + rnd() * 6]); }
  cs.push([x - w * 0.45, by - 6, w * 0.3], [x + w * 0.45, by - 4, w * 0.32]);
  blob(ctx, cs, col, { lw: 0, dark, light: 0.05, hla: 0.3, shift: 0.18 });
}
function balloon(ctx, x, y, s, c1, c2) {
  const r = 18 * s;
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.7); ctx.lineTo(x - 5 * s, y + r * 1.55); ctx.moveTo(x + r * 0.62, y + r * 0.7); ctx.lineTo(x + 5 * s, y + r * 1.55); strokeLine(ctx, OUT, 1.2);
  const env = () => { ctx.beginPath(); ctx.moveTo(x, y + r * 1.0); ctx.bezierCurveTo(x - r * 1.3, y + r * 0.2, x - r * 1.1, y - r * 1.1, x, y - r * 1.05); ctx.bezierCurveTo(x + r * 1.1, y - r * 1.1, x + r * 1.3, y + r * 0.2, x, y + r * 1.0); ctx.closePath(); };
  // oreilles
  poly(ctx, [[x - r * 0.75, y - r * 0.55], [x - r * 0.72, y - r * 1.3], [x - r * 0.25, y - r * 0.95]]); paint(ctx, c1, 1.6);
  poly(ctx, [[x + r * 0.75, y - r * 0.55], [x + r * 0.72, y - r * 1.3], [x + r * 0.25, y - r * 0.95]]); paint(ctx, c1, 1.6);
  env(); paint(ctx, ball(ctx, x, y, r * 1.1, c1, 0.3, 0.25), 2);
  ctx.save(); env(); ctx.clip();
  ctx.fillStyle = c2;
  for (const k of [-0.5, 0.5]) { ctx.beginPath(); ctx.ellipse(x + k * r * 0.9, y, r * 0.18, r * 1.2, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  env(); paint(ctx, null, 2);
  gloss(ctx, x - r * 0.45, y - r * 0.5, r * 0.2, r * 0.12, 0.6);
  rr(ctx, x - 6 * s, y + r * 1.5, 12 * s, 8 * s, 2); paint(ctx, '#c8885a', 1.6);
}
function marbleColumn(ctx, x, by, s, rnd, broken, gold) {
  const w = 12 * s, h = (broken ? 50 + rnd() * 16 : 84 + rnd() * 8) * s, top = by - h;
  const shaft = () => {
    ctx.beginPath(); ctx.moveTo(x - w / 2, by); ctx.lineTo(x - w / 2, top + 4);
    if (broken) { ctx.lineTo(x - w * 0.15, top - 4); ctx.lineTo(x + w * 0.1, top + 3); ctx.lineTo(x + w / 2, top - 2); }
    else ctx.lineTo(x + w / 2, top + 4);
    ctx.lineTo(x + w / 2, by); ctx.closePath();
  };
  shaft(); paint(ctx, vgrad(ctx, top, by, '#fbfaff', 0.05, 0.12), 2);
  ctx.save(); shaft(); ctx.clip();
  ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(x + k * w * 0.25, top); ctx.lineTo(x + k * w * 0.25, by); } strokeLine(ctx, rgba('#a8a0d8', 0.6), 1);
  ctx.fillStyle = rgba('#a8a0d8', 0.3); ctx.fillRect(x + w * 0.2, top - 6, w, h + 8);
  ctx.restore();
  if (!broken) { rr(ctx, x - w * 0.8, top - 5 * s, w * 1.6, 6 * s, 2); paint(ctx, '#f4f2fc', 1.6); ctx.fillStyle = gold; ctx.fillRect(x - w * 0.8, top - 2.4 * s, w * 1.6, 1.4 * s); ctx.beginPath(); ctx.arc(x - w * 0.62, top - 2 * s, 2.6 * s, 0, TAU); ctx.arc(x + w * 0.62, top - 2 * s, 2.6 * s, 0, TAU); paint(ctx, '#f4f2fc', 1.2); }
  rr(ctx, x - w * 0.75, by - 4 * s, w * 1.5, 6 * s, 1.5); paint(ctx, '#ebe8f8', 1.6);
  if (broken) { ctx.beginPath(); ctx.moveTo(x - w * 0.5, top + 4); ctx.bezierCurveTo(x - w, top + 16, x + w, top + 30, x - w * 0.5, top + 46); strokeLine(ctx, OUT, 3.4); ctx.stroke(); strokeLine(ctx, '#5cc05a', 1.8); }
}
function wingedCat(ctx, x, by, s, gold) {
  rr(ctx, x - 14 * s, by - 20 * s, 28 * s, 22 * s, 2); paint(ctx, vgrad(ctx, by - 20 * s, by, '#f4f2fc', 0.05, 0.15), 2);
  ctx.fillStyle = gold; ctx.fillRect(x - 14 * s, by - 17 * s, 28 * s, 1.6 * s);
  const b = by - 20 * s;
  // ailes
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + sd * 3 * s, b - 22 * s);
    ctx.quadraticCurveTo(x + sd * 26 * s, b - 46 * s, x + sd * 30 * s, b - 30 * s);
    ctx.quadraticCurveTo(x + sd * 24 * s, b - 28 * s, x + sd * 25 * s, b - 22 * s);
    ctx.quadraticCurveTo(x + sd * 18 * s, b - 20 * s, x + sd * 18 * s, b - 14 * s);
    ctx.quadraticCurveTo(x + sd * 10 * s, b - 14 * s, x + sd * 4 * s, b - 12 * s);
    ctx.closePath(); paint(ctx, vgrad(ctx, b - 46 * s, b - 12 * s, '#fbfaff', 0.05, 0.15), 1.8);
    ctx.beginPath(); ctx.moveTo(x + sd * 10 * s, b - 28 * s); ctx.lineTo(x + sd * 22 * s, b - 36 * s); ctx.moveTo(x + sd * 10 * s, b - 22 * s); ctx.lineTo(x + sd * 20 * s, b - 26 * s); strokeLine(ctx, rgba('#a8a0d8', 0.7), 1);
  }
  // chat assis
  ell(ctx, x, b - 9 * s, 9 * s, 10 * s); paint(ctx, vgrad(ctx, b - 19 * s, b, '#fbfaff', 0.05, 0.15), 2);
  ctx.beginPath(); ctx.arc(x, b - 24 * s, 7.5 * s, 0, TAU); ctx.moveTo(x - 7 * s, b - 27 * s); ctx.lineTo(x - 6 * s, b - 36 * s); ctx.lineTo(x - 1 * s, b - 30 * s); ctx.moveTo(x + 7 * s, b - 27 * s); ctx.lineTo(x + 6 * s, b - 36 * s); ctx.lineTo(x + 1 * s, b - 30 * s);
  paint(ctx, '#fbfaff', 2);
  ctx.beginPath(); ctx.moveTo(x - 4 * s, b - 25 * s); ctx.quadraticCurveTo(x - 2.5 * s, b - 23 * s, x - 1 * s, b - 25 * s); ctx.moveTo(x + 1 * s, b - 25 * s); ctx.quadraticCurveTo(x + 2.5 * s, b - 23 * s, x + 4 * s, b - 25 * s); strokeLine(ctx, rgba(OUT, 0.7), 1);
  ctx.beginPath(); ctx.ellipse(x, b - 36 * s, 7 * s, 2 * s, 0, 0, TAU); ctx.strokeStyle = gold; ctx.lineWidth = 1.8; ctx.stroke();
}
function starLamp(ctx, x, by, s, S) {
  const h = 70 * s;
  glow(ctx, x, by - h - 6 * s, 30 * s, '#fff2a0', 0.6);
  S.light(x, by - h - 6 * s, 30 * s);
  rr(ctx, x - 2 * s, by - h, 4 * s, h, 1.5); paint(ctx, vgrad(ctx, by - h, by, '#fbfaff', 0.05, 0.15), 1.6);
  ctx.beginPath(); ctx.moveTo(x - 2 * s, by - h * 0.6); ctx.bezierCurveTo(x - 8 * s, by - h * 0.65, x - 8 * s, by - h * 0.8, x - 2 * s, by - h * 0.82); strokeLine(ctx, '#ffcf4a', 1.4);
  rr(ctx, x - 6 * s, by - 4 * s, 12 * s, 5 * s, 1.5); paint(ctx, '#ebe8f8', 1.6);
  goldStar(ctx, x, by - h - 6 * s, 8 * s, 0);
}
function goldStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.5 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  ctx.closePath();
  ctx.lineJoin = 'round';
  paint(ctx, ball(ctx, x, y, r, '#ffd84a', 0.4, 0.25), 1.6);
  gloss(ctx, x - r * 0.25, y - r * 0.3, r * 0.2, r * 0.12, 0.8);
}
function feather(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(0, 12 * s); ctx.quadraticCurveTo(-6 * s, 0, 0, -12 * s); ctx.quadraticCurveTo(6 * s, 0, 0, 12 * s);
  paint(ctx, lgY(ctx, [[-12 * s, '#ffffff'], [12 * s, '#e8e0ff']]), 1.4);
  ctx.beginPath(); ctx.moveTo(0, 14 * s); ctx.lineTo(0, -10 * s); for (let k = -2; k <= 2; k++) { ctx.moveTo(0, k * 4 * s); ctx.lineTo(-3 * s, k * 4 * s - 2 * s); ctx.moveTo(0, k * 4 * s); ctx.lineTo(3 * s, k * 4 * s - 2 * s); } strokeLine(ctx, rgba('#a8a0d8', 0.8), 0.9);
  ctx.restore();
}

// ------------------------------------------------------------------ Pays des Bonbons
const SPRINK = ['#ff5a8a', '#ffd23f', '#4ad0ff', '#7ae07a', '#b07aff', '#ffffff'];
function candyDef() {
  return {
    ambient: 'petals', kind: 'day', horizon: 214,
    sky(ctx, S) {
      skyGrad(ctx, [[0, '#6ac4ff'], [0.32, '#a8c4ff'], [0.58, '#f8c0ec'], [0.82, '#ffe0f0'], [1, '#fff4f0']]);
      sunDisc(ctx, 372, 68, 22, { core: '#ffffff', edge: '#ffe08a', glow: '#fff0c8', rayA: 0.24 });
    },
    layers: [
      L(0, 200, 0.03, (ctx, S) => {
        for (const x of S.spread(6, 0.7)) {
          const y = S.r(50, 150), w = S.r(70, 120), pink = S.rand() < 0.55;
          S.rep(x, w, (xx, rnd) => cloud(ctx, xx, y, w, w * 0.4, rnd, pink ? '#ffd8f0' : '#dcecff', pink ? '#f4a4d4' : '#a8c8f4'));
        }
      }),
      L(110, 182, 0.05, (ctx, S) => {
        const W = S.W;
        const xs = S.spread(7, 0.5);
        const cols = ['#d8b4f4', '#f6b4d8', '#b4e4d8', '#f8c8b0'];
        xs.forEach((x, i) => { const w = S.r(120, 190), h = S.r(70, 120); S.rep(x, w * 0.6, (xx, rnd) => frostPeak(ctx, xx, 262, w, h, cols[i % 4], rnd)); });
        const cx = S.r(0, W);
        S.rep(cx, 70, (xx) => candyCastle(ctx, xx, 246, 1, S));
        ctx.fillStyle = lgY(ctx, [[244, '#f4c4e4'], [292, '#eab4dc']]); ctx.fillRect(-5, 246, W + 10, 48);
        haze(ctx, W, 110, 292, '#fff0fa', 0.35, 0.22);
      }),
      L(150, 142, 0.13, (ctx, S) => {
        const W = S.W;
        const f = wave(S, 246, [[6, 1, 2], [4, 3, 5]]);
        // collines de menthe et de fraise
        for (const x of S.spread(9, 0.6)) {
          const r = S.r(28, 46), c = S.pick(['#9ae8c8', '#ffc0d8', '#b8e4ff']);
          S.rep(x, r * 1.6, (xx, rnd) => {
            blob(ctx, [[xx, f(xx) + r * 0.3, r], [xx + r * 0.7, f(xx) + r * 0.5, r * 0.7]], c, { lw: 0, light: 0.2, hla: 0.3, dark: shade(c, -0.12) });
            for (let k = 0; k < 7; k++) { const a = Math.PI * (1.1 + rnd() * 0.8), d = r * (0.3 + rnd() * 0.6); sprinkle(ctx, xx + Math.cos(a) * d, f(xx) + r * 0.3 + Math.sin(a) * d, 0.8, SPRINK[Math.floor(rnd() * 6)], rnd() * 3); }
          });
        }
        // arbres-sucettes lointains
        for (const x of S.spread(6, 0.8)) S.rep(x, 16, (xx, rnd) => lollipop(ctx, xx, f(xx) + 6, 0.5, SPRINK[Math.floor(rnd() * 5)], '#ffffff', rnd, 0));
        // rivière de chocolat
        const r0 = (x) => f(x) + 10 + Math.sin(TAU * 2 * x / W) * 2, r1 = () => 278;
        bandPath(ctx, W, r0, r1);
        ctx.fillStyle = lgY(ctx, [[250, '#9a5a3a'], [264, '#7a4026'], [278, '#5e2e1a']]); ctx.fill();
        ctx.save(); bandPath(ctx, W, r0, r1); ctx.clip();
        for (let i = 0; i < 40; i++) { const x = S.r(0, W), y = S.r(256, 276), w = S.r(6, 16); S.rep(x, w, (xx) => { ctx.beginPath(); ctx.moveTo(xx - w, y); ctx.quadraticCurveTo(xx, y - 1.6, xx + w, y); strokeLine(ctx, rgba('#d8a080', 0.55), 1.1); }); }
        for (const x of S.spread(5, 0.8)) S.rep(x, 8, (xx, rnd) => { const y = r0(xx) + 6 + rnd() * 6; rr(ctx, xx - 5, y - 4, 10, 6, 2.5); paint(ctx, '#fff4f8', 1.2); });
        ctx.restore();
        profileLine(ctx, W, r0); strokeLine(ctx, rgba('#ffe0c8', 0.8), 1.6);
        ctx.fillStyle = '#5e2e1a'; ctx.fillRect(-5, 277, W + 10, 16);
        haze(ctx, W, 150, 292, '#fff0fa', 0.18, 0.08);
      }),
      L(60, 232, 0.33, (ctx, S) => {
        const W = S.W;
        const fM = wave(S, 262, [[2.5, 1, 2], [1.5, 4, 7]]);
        const xs = S.spread(7, 0.45);
        const kinds = ['lolly', 'house', 'cone', 'lolly', 'gum', 'house', 'cane'];
        const k0 = S.ri(0, 6);
        xs.forEach((x, i) => {
          const kind = kinds[(i + k0) % kinds.length];
          if (kind === 'lolly') S.rep(x, 40, (xx, rnd) => lollipop(ctx, xx, fM(xx) + 6, 1 + rnd() * 0.2, S.pick(['#ff5a8a', '#4ad0ff', '#b07aff', '#ffb03a']), '#ffffff', rnd, 2));
          else if (kind === 'house') S.rep(x, 50, (xx, rnd) => cupcakeHouse(ctx, xx, fM(xx) + 7, 1, rnd, S));
          else if (kind === 'cone') S.rep(x, 30, (xx, rnd) => iceCreamTree(ctx, xx, fM(xx) + 7, 1, rnd));
          else if (kind === 'gum') S.rep(x, 40, (xx, rnd) => { gumdrop(ctx, xx - 12, fM(xx) + 8, 1.4, '#ff5a8a'); gumdrop(ctx, xx + 12, fM(xx) + 9, 1.1, '#7ae07a'); gumdrop(ctx, xx, fM(xx) + 10, 0.9, '#ffd23f'); });
          else S.rep(x, 30, (xx) => { candyCane(ctx, xx - 8, fM(xx) + 8, 70, 1, 1); candyCane(ctx, xx + 12, fM(xx) + 8, 52, 1, -1); });
        });
        for (const x of S.spread(8, 0.9)) S.rep(x, 12, (xx, rnd) => gumdrop(ctx, xx, fM(xx) + 10, 0.6 + rnd() * 0.3, SPRINK[Math.floor(rnd() * 5)]));
        profilePath(ctx, W, (x) => fM(x) + 7, 300);
        ctx.fillStyle = lgY(ctx, [[258, '#a8ecd0'], [290, '#84d8b8']]); ctx.fill();
        profileLine(ctx, W, (x) => fM(x) + 7); strokeLine(ctx, rgba('#3a9a7a', 0.7), 1.4);
        haze(ctx, W, 60, 282, '#fff0fa', 0.1, 0.04);
      }),
      L(258, 102, 1, (ctx, S) => {
        groundBase(ctx, S, {
          edge: [13, 1.4, 2.8, 'bump'], edge2: [12, 1.2, 2.4, 'bump'],
          fill: [[262, '#ffd4e8'], [290, '#ffb8d8'], [330, '#f498c4'], [360, '#dc78aa']],
          fill2: [[300, '#ffc8e0'], [330, '#f8a4cc'], [360, '#dc78aa']],
          shadow: '#8a2a5a', rim: rgba('#ffffff', 1), rim2: rgba('#ffffff', 0.9),
          stroke: rgba(OUT, 0.9), stroke2: rgba('#b84a84', 0.85),
          path: { fill: [[280, '#b8724a'], [296, '#a4603c'], [312, '#8e4e30']], edge: '#5e2e1a' },
          upper(ctx, S, F) {
            // coulures de glaçage blanc
            for (let i = 0; i < 30; i++) { const x = S.r(0, S.W), l = S.r(3, 9); S.rep(x, 6, (xx) => { const y = F.fTop(xx) + 1; rr(ctx, xx - 2, y - 2, 4, l + 2, 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }); }
            scatter(S, 34, (x) => F.fTop(x) + 6, (x) => F.fP0(x) - 2, (x, y, rnd) => sprinkle(ctx, x, y, 1, SPRINK[Math.floor(rnd() * 6)], rnd() * 3), 4);
          },
          pathDeco(ctx, S, F) {
            // tablette de chocolat
            const n = Math.round(S.W / 24), st = S.W / n;
            for (let i = 0; i < n; i++) {
              S.rep(i * st + st / 2, st, (xx) => {
                const y0 = F.fP0(xx) + 2.5, y1 = F.fP1(xx), ym = (y0 + y1) / 2;
                for (const [a, b] of [[y0, ym - 0.8], [ym + 0.8, y1]]) {
                  rr(ctx, xx - st / 2 + 1.4, a, st - 2.8, b - a, 2);
                  ctx.fillStyle = lgY(ctx, [[a, '#c88458'], [b, '#9a5a36']]); ctx.fill();
                  ctx.strokeStyle = rgba('#5e2e1a', 0.55); ctx.lineWidth = 1; ctx.stroke();
                  ctx.fillStyle = rgba('#ffe0c8', 0.45); ctx.fillRect(xx - st / 2 + 3, a + 1.2, st - 7, 1.2);
                }
              });
            }
            pawTrail(S, F, 22, (q, y) => paw(ctx, q, y, 1.15, rgba('#5e2e1a', 0.35), Math.PI / 2));
          },
          lower(ctx, S, F) {
            scatter(S, 70, (x) => F.fP1(x) + 8, () => 358, (x, y, rnd) => sprinkle(ctx, x, y, 1.3, SPRINK[Math.floor(rnd() * 6)], rnd() * 3), 4);
            scatter(S, 8, (x) => F.fP1(x) + 12, () => 352, (x, y, rnd) => wrappedCandy(ctx, x, y, 0.9, SPRINK[Math.floor(rnd() * 5)], rnd() - 0.5), 10);
            scatter(S, 6, (x) => F.fP1(x) + 14, () => 352, (x, y, rnd) => gumdrop(ctx, x, y + 3, 0.7, SPRINK[Math.floor(rnd() * 5)]), 8);
          },
        });
      }),
      L(314, 46, 1.35, (ctx, S) => {
        for (const x of S.spread(6, 0.9)) {
          const kind = S.rand();
          S.rep(x, 50, (xx, rnd) => {
            const by = 356 + rnd() * 4;
            if (kind < 0.35) { gumdrop(ctx, xx, by + 8, 1.8, '#ff5a8a'); gumdrop(ctx, xx + 22, by + 10, 1.3, '#4ad0ff'); }
            else if (kind < 0.65) { lollipop(ctx, xx, by + 12, 0.45, '#7ae07a', '#ffffff', rnd, 2); wrappedCandy(ctx, xx + 22, by + 2, 1.6, '#ffd23f', 0.3); }
            else { cookie(ctx, xx, by + 4, 1.3); wrappedCandy(ctx, xx + 24, by + 4, 1.4, '#b07aff', -0.4); }
          });
        }
      }, true),
    ],
  };
}

function sprinkle(ctx, x, y, s, col, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  rr(ctx, -2 * s, -0.7 * s, 4 * s, 1.4 * s, 0.7 * s); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}
function frostPeak(ctx, x, by, w, h, col, rnd) {
  const top = by - h;
  const pts = [[x - w / 2, by + 2], [x - w * 0.3, top + h * 0.45], [x - w * 0.1, top + 4], [x + w * 0.04, top], [x + w * 0.16, top + 6], [x + w * 0.32, top + h * 0.5], [x + w / 2, by + 2]];
  smooth(ctx, pts, false, 0.5); ctx.closePath();
  ctx.fillStyle = lgY(ctx, [[top, shade(col, 0.1)], [by, col]]); ctx.fill();
  ctx.save(); smooth(ctx, pts, false, 0.5); ctx.closePath(); ctx.clip();
  ctx.fillStyle = rgba(shade(col, -0.3), 0.22); ctx.fillRect(x + w * 0.06, top - 4, w, h + 8);
  // glaçage qui coule
  const sy = top + h * 0.2;
  ctx.beginPath(); ctx.moveTo(x - w, top - 10); ctx.lineTo(x - w * 0.3, sy);
  const n = 6;
  for (let i = 0; i <= n; i++) { const xx = x - w * 0.2 + i * w * 0.4 / n; const d = (i % 2 ? h * (0.08 + rnd() * 0.1) : 0); ctx.lineTo(xx - 2.6, sy + d); ctx.arc(xx, sy + d, 2.6, Math.PI, 0, true); }
  ctx.lineTo(x + w * 0.3, sy); ctx.lineTo(x + w, top - 10); ctx.closePath();
  ctx.fillStyle = '#fffafc'; ctx.fill();
  ctx.restore();
  for (let k = 0; k < 5; k++) sprinkle(ctx, x - w * 0.1 + rnd() * w * 0.2, top + 8 + rnd() * h * 0.2, 0.9, SPRINK[Math.floor(rnd() * 5)], rnd() * 3);
}
function candyCastle(ctx, x, by, s, S) {
  const C = '#f4b4dc', D = '#e898c8';
  ctx.fillStyle = C; ctx.fillRect(x - 46 * s, by - 34 * s, 92 * s, 38 * s);
  const tower = (tx, w, h, cap) => {
    ctx.fillStyle = C; ctx.fillRect(tx - w / 2, by - h, w, h + 4);
    ctx.fillStyle = rgba(D, 0.8); ctx.fillRect(tx + w * 0.15, by - h, w * 0.35, h);
    // toit en cornet de glace + boule
    ctx.fillStyle = '#f8d090'; poly(ctx, [[tx - w / 2 - 2, by - h], [tx, by - h + w * 1.4], [tx + w / 2 + 2, by - h]]);
    ctx.beginPath(); ctx.arc(tx, by - h - w * 0.2, w * 0.62, 0, TAU); ctx.fillStyle = cap; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, by - h - w * 0.75, w * 0.18, 0, TAU); ctx.fillStyle = '#ff4a6a'; ctx.fill();
    ctx.fillStyle = '#fff6fb'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(tx - w * 0.5 + k * w * 0.5, by - h + 1, w * 0.18, 0, TAU); ctx.fill(); }
  };
  tower(x - 40 * s, 16 * s, 58 * s, '#b8f0d8');
  tower(x + 40 * s, 16 * s, 52 * s, '#c8d8ff');
  tower(x - 14 * s, 20 * s, 84 * s, '#fff0a8');
  tower(x + 14 * s, 18 * s, 70 * s, '#ffc8e8');
  ctx.fillStyle = '#fff6fb'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(x - 46 * s + k * 11.5 * s, by - 34 * s, 4.5 * s, 0, Math.PI); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, by - 4 * s, 9 * s, Math.PI, 0); ctx.lineTo(x + 9 * s, by + 4); ctx.lineTo(x - 9 * s, by + 4); ctx.closePath(); ctx.fillStyle = '#c87aa8'; ctx.fill();
  for (const [dx, dy] of [[-14, 60], [14, 48], [-40, 38], [40, 34]]) { ctx.beginPath(); ctx.arc(x + dx * s, by - dy * s, 2.6 * s, 0, TAU); ctx.fillStyle = '#ffe8a8'; ctx.fill(); S.light(x + dx * s, by - dy * s, 9); }
}
function lollipop(ctx, x, by, s, c1, c2, rnd, lw = 2) {
  const h = (64 + rnd() * 14) * s, r = (17 + rnd() * 4) * s, cy = by - h;
  rr(ctx, x - 2.2 * s, cy, 4.4 * s, h + 2, 2 * s);
  if (lw) paint(ctx, '#fffaf4', lw * 0.8); else { ctx.fillStyle = '#fff4f0'; ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU);
  if (lw) paint(ctx, c1, lw); else { ctx.fillStyle = c1; ctx.fill(); }
  // spirale
  ctx.save(); ctx.beginPath(); ctx.arc(x, cy, r - (lw ? 1 : 0), 0, TAU); ctx.clip();
  ctx.beginPath();
  for (let a = 0; a < TAU * 3.2; a += 0.15) { const rr2 = (a / (TAU * 3.2)) * r * 1.05; const px = x + Math.cos(a) * rr2, py = cy + Math.sin(a) * rr2; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.strokeStyle = c2; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.stroke();
  ctx.fillStyle = rgba('#000000', 0.12); ctx.beginPath(); ctx.arc(x + r * 0.4, cy + r * 0.4, r, 0, TAU); ctx.fill();
  ctx.restore();
  if (lw) { ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); paint(ctx, null, lw); }
  gloss(ctx, x - r * 0.4, cy - r * 0.45, r * 0.25, r * 0.14, 0.75);
  if (lw) { // nœud
    const ny = cy + r + 3 * s;
    poly(ctx, [[x, ny], [x - 8 * s, ny - 5 * s], [x - 8 * s, ny + 5 * s]]); paint(ctx, '#ff5a8a', 1.4);
    poly(ctx, [[x, ny], [x + 8 * s, ny - 5 * s], [x + 8 * s, ny + 5 * s]]); paint(ctx, '#ff5a8a', 1.4);
    ctx.beginPath(); ctx.arc(x, ny, 2.2 * s, 0, TAU); paint(ctx, '#ff7aa0', 1.2);
  }
}
function cupcakeHouse(ctx, x, by, s, rnd, S) {
  const w = 50 * s, h = 34 * s, top = by - h;
  const wrapCol = rnd() < 0.5 ? '#ff8ab8' : '#8ad0ff';
  // caissette
  poly(ctx, [[x - w / 2, top], [x + w / 2, top], [x + w * 0.4, by], [x - w * 0.4, by]]);
  paint(ctx, lgY(ctx, [[top, shade(wrapCol, 0.15)], [by, shade(wrapCol, -0.15)]]), 2);
  ctx.save(); poly(ctx, [[x - w / 2, top], [x + w / 2, top], [x + w * 0.4, by], [x - w * 0.4, by]]); ctx.clip();
  ctx.beginPath(); for (let k = -5; k <= 5; k++) { ctx.moveTo(x + k * w * 0.1, top); ctx.lineTo(x + k * w * 0.08, by); } strokeLine(ctx, rgba(shade(wrapCol, -0.3), 0.55), 1.4);
  ctx.restore();
  // porte et fenêtres
  ctx.beginPath(); ctx.moveTo(x - 6 * s, by); ctx.lineTo(x - 6 * s, by - 13 * s); ctx.arc(x, by - 13 * s, 6 * s, Math.PI, 0); ctx.lineTo(x + 6 * s, by); ctx.closePath();
  paint(ctx, '#9a5a3a', 1.6);
  ctx.beginPath(); ctx.arc(x + 3 * s, by - 9 * s, 1 * s, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill();
  for (const dx of [-15, 15]) {
    ctx.beginPath(); ctx.arc(x + dx * s, top + 12 * s, 4.5 * s, 0, TAU); paint(ctx, lgY(ctx, [[top + 8 * s, '#fff2b0'], [top + 17 * s, '#ffb860']]), 1.4);
    ctx.beginPath(); ctx.moveTo(x + dx * s - 4.5 * s, top + 12 * s); ctx.lineTo(x + dx * s + 4.5 * s, top + 12 * s); ctx.moveTo(x + dx * s, top + 7.5 * s); ctx.lineTo(x + dx * s, top + 16.5 * s); strokeLine(ctx, rgba(OUT, 0.6), 1);
    S.light(x + dx * s, top + 12 * s, 14 * s, { a: 0.8 });
  }
  // glaçage en tourbillon
  const fc = rnd() < 0.5 ? '#fff4fa' : '#ffd0e8';
  const cs = [[x - w * 0.36, top - 3 * s, 10 * s], [x - w * 0.12, top - 5 * s, 12 * s], [x + w * 0.14, top - 5 * s, 12 * s], [x + w * 0.38, top - 3 * s, 10 * s], [x - w * 0.18, top - 16 * s, 11 * s], [x + w * 0.16, top - 15 * s, 10 * s], [x, top - 26 * s, 9 * s]];
  blob(ctx, cs, fc, { lw: 2, light: 0.15, hla: 0.5 });
  for (let k = 0; k < 9; k++) { const c = cs[Math.floor(rnd() * cs.length)]; sprinkle(ctx, c[0] + (rnd() - 0.5) * c[2], c[1] + (rnd() - 0.6) * c[2] * 0.8, 1.2 * s, SPRINK[Math.floor(rnd() * 5)], rnd() * 3); }
  // cerise
  ctx.beginPath(); ctx.moveTo(x + 1 * s, top - 38 * s); ctx.quadraticCurveTo(x + 4 * s, top - 46 * s, x + 9 * s, top - 47 * s); strokeLine(ctx, OUT, 3); ctx.stroke(); strokeLine(ctx, '#6a9a3a', 1.4);
  ctx.beginPath(); ctx.arc(x, top - 34 * s, 6 * s, 0, TAU); paint(ctx, ball(ctx, x, top - 34 * s, 6 * s, '#ff2a4a'), 2);
  gloss(ctx, x - 2 * s, top - 36 * s, 1.8 * s, 1.1 * s, 0.85);
  // cheminée-bâton de cannelle
  rr(ctx, x + w * 0.3, top - 24 * s, 6 * s, 14 * s, 2); paint(ctx, '#c8783a', 1.4);
}
function iceCreamTree(ctx, x, by, s, rnd) {
  rr(ctx, x - 3 * s, by - 34 * s, 6 * s, 36 * s, 2); paint(ctx, '#d8a070', 1.6);
  poly(ctx, [[x - 13 * s, by - 46 * s], [x + 13 * s, by - 46 * s], [x, by - 22 * s]]); paint(ctx, lgY(ctx, [[by - 46 * s, '#f8d08a'], [by - 22 * s, '#d89a54']]), 2);
  ctx.save(); poly(ctx, [[x - 13 * s, by - 46 * s], [x + 13 * s, by - 46 * s], [x, by - 22 * s]]); ctx.clip();
  ctx.beginPath(); for (let k = -4; k <= 4; k++) { ctx.moveTo(x + k * 5 * s - 10 * s, by - 46 * s); ctx.lineTo(x + k * 5 * s + 10 * s, by - 22 * s); ctx.moveTo(x + k * 5 * s + 10 * s, by - 46 * s); ctx.lineTo(x + k * 5 * s - 10 * s, by - 22 * s); } strokeLine(ctx, rgba('#a8642a', 0.6), 1);
  ctx.restore();
  const cols = ['#ffc0dc', '#b8f0d8', '#fff0b0', '#c8b0ff', '#8a5a3a'];
  const c1 = cols[Math.floor(rnd() * 5)], c2 = cols[Math.floor(rnd() * 4)];
  ctx.beginPath(); ctx.arc(x, by - 52 * s, 13 * s, 0, TAU); paint(ctx, ball(ctx, x, by - 52 * s, 13 * s, c1, 0.25, 0.2), 2);
  ctx.beginPath(); ctx.arc(x + 1 * s, by - 70 * s, 11 * s, 0, TAU); paint(ctx, ball(ctx, x, by - 70 * s, 11 * s, c2, 0.25, 0.2), 2);
  for (let k = 0; k < 6; k++) sprinkle(ctx, x + (rnd() - 0.5) * 16 * s, by - 74 * s + rnd() * 26 * s, 1.1 * s, SPRINK[Math.floor(rnd() * 6)], rnd() * 3);
  ctx.beginPath(); ctx.arc(x + 2 * s, by - 83 * s, 3.4 * s, 0, TAU); paint(ctx, '#ff2a4a', 1.4);
}
function gumdrop(ctx, x, by, s, col) {
  const w = 10 * s, h = 13 * s;
  ctx.beginPath(); ctx.moveTo(x - w, by); ctx.bezierCurveTo(x - w, by - h * 0.9, x - w * 0.5, by - h * 1.05, x, by - h); ctx.bezierCurveTo(x + w * 0.5, by - h * 1.05, x + w, by - h * 0.9, x + w, by); ctx.closePath();
  paint(ctx, ball(ctx, x, by - h * 0.55, w * 1.1, col, 0.35, 0.25), 2);
  ctx.fillStyle = rgba('#ffffff', 0.8);
  for (const [dx, dy] of [[-0.4, -0.6], [0.3, -0.75], [0.5, -0.35], [-0.1, -0.3], [-0.6, -0.25]]) ctx.fillRect(x + dx * w - 0.6, by + dy * h - 0.6, 1.3, 1.3);
  gloss(ctx, x - w * 0.4, by - h * 0.7, w * 0.2, h * 0.12, 0.6);
}
function candyCane(ctx, x, by, h, s, dir) {
  const path = () => { ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.lineTo(x, by - h); ctx.arc(x + dir * 9 * s, by - h, 9 * s, Math.PI, dir > 0 ? 0 : Math.PI * 2, dir < 0); ctx.lineTo(x + dir * 18 * s, by - h + 8 * s); };
  path(); strokeLine(ctx, OUT, 10 * s); path(); strokeLine(ctx, '#ffffff', 6.4 * s);
  ctx.save(); ctx.setLineDash([5 * s, 5 * s]); path(); ctx.strokeStyle = '#ff3a5a'; ctx.lineWidth = 6.4 * s; ctx.lineCap = 'butt'; ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - 1.4 * s, by - 4); ctx.lineTo(x - 1.4 * s, by - h + 4); strokeLine(ctx, rgba('#ffffff', 0.55), 1.4 * s);
}
function wrappedCandy(ctx, x, y, s, col, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  for (const sd of [-1, 1]) { poly(ctx, [[sd * 5 * s, 0], [sd * 11 * s, -4.5 * s], [sd * 10 * s, 0], [sd * 11 * s, 4.5 * s]]); paint(ctx, shade(col, 0.2), 1.4); }
  ell(ctx, 0, 0, 6.5 * s, 4.8 * s); paint(ctx, ball(ctx, 0, 0, 6 * s, col, 0.35, 0.25), 1.6);
  ctx.beginPath(); ctx.moveTo(-3 * s, -4 * s); ctx.lineTo(1 * s, 4 * s); ctx.moveTo(1 * s, -4.5 * s); ctx.lineTo(4.5 * s, 3 * s); strokeLine(ctx, rgba('#ffffff', 0.7), 1.3);
  ctx.restore();
}
function cookie(ctx, x, y, s) {
  ell(ctx, x, y, 13 * s, 7 * s); paint(ctx, lgY(ctx, [[y - 7 * s, '#f0c070'], [y + 7 * s, '#c88a40']]), 2);
  ctx.fillStyle = '#5e2e1a';
  for (const [dx, dy] of [[-6, -2], [3, -3], [7, 2], [-2, 3], [-9, 2]]) { ell(ctx, x + dx * s, y + dy * s, 1.8 * s, 1.2 * s); ctx.fill(); }
}

// =====================================================================
//  ÈRES : variantes qui restylent une carte (même tracé, autre ambiance)
//   0 normal · 1 Crépuscule · 2 Cauchemar · 3 Infernal
//  Chaque toile pré-rendue reçoit un étalonnage (désaturation, teinte,
//  « gradient map », brume selon la profondeur, liseré de lumière orienté),
//  puis des éléments propres à l'ère (astre, brume, yeux, fissures, braises,
//  lumières qui s'allument). Tout est fait une seule fois dans buildScenery.
// =====================================================================
export const SCENERY_VARIANTS = ['Normal', 'Crépuscule', 'Cauchemar', 'Infernal'];
let CUR = null; // contexte de construction en cours (ère, astre repéré…)

const rgb3 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Rampe de couleurs → Float32Array(n*3). stops : ['#..', ...] (réguliers) ou [[t, '#..'], ...]
function ramp(stops, n) {
  const st = typeof stops[0] === 'string' ? stops.map((c, i) => [i / (stops.length - 1), c]) : stops;
  const P = st.map(([t, c]) => [t, rgb3(c)]);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let j = 0;
    while (j < P.length - 2 && t > P[j + 1][0]) j++;
    const [ta, ca] = P[j], [tb, cb] = P[j + 1];
    const u = Math.max(0, Math.min(1, (t - ta) / ((tb - ta) || 1)));
    for (let k = 0; k < 3; k++) out[i * 3 + k] = ca[k] + (cb[k] - ca[k]) * u;
  }
  return out;
}

const ERA = {
  1: { // Crépuscule : soleil bas à droite, ombres violettes, liseré doré, lumières chaudes
    sat: 1.04, exp: 0.97, mul: [1.0, 0.84, 0.8], k: 0.4,
    map: ['#1a0e3e', '#56286a', '#c4506a', '#ff9a58', '#ffe2a2'],
    sky: [[0, '#1c1450'], [0.3, '#4a2a7c'], [0.55, '#b4467e'], [0.72, '#f0705a'], [0.86, '#ffa456'], [1, '#ffd08a']], skyK: 0.62,
    fog: '#f08a78', fogK: 0.42, fogY: [140, 292],
    front: ['#2a1438', 0.28],
    rim: { dx: 1.5, dy: -1.1, col: '#ffbc6a', k: 0.72 },
    light: { core: '#fff2b8', glow: '#ffb24a', a: 0.62 },
  },
  2: { // Cauchemar : désaturé, ombres violettes, hautes lumières vert toxique, brume
    sat: 0.24, exp: 0.86, mul: [0.84, 0.95, 0.9], k: 0.7,
    map: ['#07040c', '#1e1632', '#3c3c52', '#687e6c', '#b4d094'],
    sky: [[0, '#07050e'], [0.35, '#1a1230'], [0.65, '#342c4a'], [0.85, '#4e5a56'], [1, '#6e8a62']], skyK: 0.74,
    fog: '#6c5c90', fogK: 0.55, fogY: [180, 292],
    front: ['#0a0614', 0.5],
    rim: { dx: -0.6, dy: -1.6, col: '#b2ff6e', k: 0.5 },
    light: { core: '#eaffb0', glow: '#8aff3a', a: 0.6, alt: '#c06aff' },
  },
  3: { // Infernal : rouge et noir, lueur de lave par en dessous, braises
    sat: 0.4, exp: 0.82, mul: [1.06, 0.52, 0.44], k: 0.72,
    map: ['#040102', '#200307', '#5e0c0c', '#b42a16', '#ff8a36'],
    sky: [[0, '#070103'], [0.3, '#260508'], [0.58, '#6e120e'], [0.8, '#cc3a16'], [1, '#ff8a34']], skyK: 0.72,
    fog: '#3a0609', fogK: 0.5, fogY: [40, 220],
    front: ['#120204', 0.48],
    rim: { dx: 0, dy: 1.6, col: '#ff7a26', k: 0.8 },
    light: { core: '#fff0a0', glow: '#ff5a14', a: 0.75 },
  },
};

function eraAmbient(base, V) {
  if (V === 1) return base === 'petals' ? 'fireflies' : base;
  if (V === 2) return ['bubbles', 'snow', 'rain'].includes(base) ? base : 'fireflies';
  if (V === 3) return base === 'bubbles' ? 'bubbles' : 'embers';
  return base;
}

// Étalonnage d'une toile en place. Renvoie l'ImageData (alpha intact) pour les placements.
// o : { res, y0, fog:(yu)=>[r,g,b,a], rimK }
// Par pixel : c' = a·c + T[l] (désaturation, teinte, « gradient map » et brume sont repliées
// dans une table T de 256 entrées par canal, recalculée seulement quand la brume change).
function eraGrade(cv, E, o) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const lut = E.lut || (E.lut = ramp(E.map, 256));
  const sat = E.sat, k = E.k, ex = E.exp ?? 1, M = E.mul;
  const exK = Math.round(ex * 65536);
  const Tr = new Float32Array(256), Tg = new Float32Array(256), Tb = new Float32Array(256);
  let pfr = -1, pfg = -1, pfb = -1, pfa = -1, ar = 0, ag = 0, ab = 0;
  const rk = o.rimK || 0;
  const rc = E.rimRGB || (E.rimRGB = rgb3(E.rim.col));
  const ox = Math.round(E.rim.dx * o.res), oy = Math.round(E.rim.dy * o.res);
  const X1 = new Int32Array(w), X2 = new Int32Array(w);
  for (let x = 0; x < w; x++) { X1[x] = mod(x + ox, w) * 4 + 3; X2[x] = mod(x + 2 * ox, w) * 4 + 3; }
  const W4 = w * 4;
  for (let y = 0; y < h; y++) {
    const f = o.fog(o.y0 + y / o.res);
    if (f[0] !== pfr || f[1] !== pfg || f[2] !== pfb || f[3] !== pfa) {
      pfr = f[0]; pfg = f[1]; pfb = f[2]; pfa = f[3];
      const q = 1 - pfa;
      ar = q * (1 - k) * M[0] * sat * ex; ag = q * (1 - k) * M[1] * sat * ex; ab = q * (1 - k) * M[2] * sat * ex;
      for (let l = 0; l < 256; l++) {
        const base = (1 - sat) * l;
        Tr[l] = q * ((1 - k) * M[0] * base + k * lut[l * 3]) + pfa * pfr;
        Tg[l] = q * ((1 - k) * M[1] * base + k * lut[l * 3 + 1]) + pfa * pfg;
        Tb[l] = q * ((1 - k) * M[2] * base + k * lut[l * 3 + 2]) + pfa * pfb;
      }
    }
    const y1 = y + oy, y2 = y + 2 * oy;
    const r1 = y1 < 0 ? -1 : y1 >= h ? -2 : y1 * W4, r2 = y2 < 0 ? -1 : y2 >= h ? -2 : y2 * W4;
    for (let x = 0, i = y * W4; x < w; x++, i += 4) {
      if (d[i + 3] === 0) continue;
      const R = d[i], G = d[i + 1], B = d[i + 2];
      let l = ((R * 77 + G * 150 + B * 29) * exK) >>> 24;
      if (l > 255) l = 255;
      let r = ar * R + Tr[l], g = ag * G + Tg[l], b = ab * B + Tb[l];
      if (rk) {
        const a1 = r1 === -1 ? 0 : r1 === -2 ? 255 : d[r1 + X1[x]];
        const a2 = r2 === -1 ? 0 : r2 === -2 ? 255 : d[r2 + X2[x]];
        const t = rk * Math.max(1 - a1 / 255, 0.5 * (1 - a2 / 255));
        if (t > 0) { r += (rc[0] - r) * t; g += (rc[1] - g) * t; b += (rc[2] - b) * t; }
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
  return img;
}

// Lecture de l'alpha / de la luminance d'une ImageData en unités (x raccordé)
function pixAt(img, res, y0, xu, yu) {
  const x = mod(Math.round(xu * res), img.width), y = Math.round((yu - y0) * res);
  if (y < 0 || y >= img.height) return null;
  const i = (y * img.width + x) * 4, d = img.data;
  return [d[i + 3], (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8];
}
// Premier y (unités) opaque sous yMin dans la colonne xu
function surfaceY(img, res, y0, xu, yMin, yMax) {
  const w = img.width, d = img.data, x = mod(Math.round(xu * res), w);
  const ya = Math.max(0, Math.round((yMin - y0) * res)), yb = Math.min(img.height - 1, Math.round((yMax - y0) * res));
  for (let y = ya; y <= yb; y++) if (d[(y * w + x) * 4 + 3] > 200) return y0 + y / res;
  return null;
}

// ------------------------------------------------------------------ éléments d'ère
function bat(ctx, x, y, s, col) {
  ctx.beginPath();
  ctx.moveTo(x, y - 1.2 * s);
  ctx.quadraticCurveTo(x - 3 * s, y - 4 * s, x - 9 * s, y - 2.5 * s);
  ctx.quadraticCurveTo(x - 7.5 * s, y - 0.5 * s, x - 7.8 * s, y + 1.2 * s);
  ctx.quadraticCurveTo(x - 5.6 * s, y - 0.2 * s, x - 4.6 * s, y + 1.4 * s);
  ctx.quadraticCurveTo(x - 3 * s, y + 0.2 * s, x - 1.6 * s, y + 1.6 * s);
  ctx.lineTo(x - 1.2 * s, y + 2.6 * s); ctx.lineTo(x, y + 1.8 * s); ctx.lineTo(x + 1.2 * s, y + 2.6 * s);
  ctx.lineTo(x + 1.6 * s, y + 1.6 * s);
  ctx.quadraticCurveTo(x + 3 * s, y + 0.2 * s, x + 4.6 * s, y + 1.4 * s);
  ctx.quadraticCurveTo(x + 5.6 * s, y - 0.2 * s, x + 7.8 * s, y + 1.2 * s);
  ctx.quadraticCurveTo(x + 7.5 * s, y - 0.5 * s, x + 9 * s, y - 2.5 * s);
  ctx.quadraticCurveTo(x + 3 * s, y - 4 * s, x, y - 1.2 * s);
  ctx.moveTo(x - 1.4 * s, y - 1); ctx.lineTo(x - 1.6 * s, y - 3.4 * s); ctx.lineTo(x - 0.4 * s, y - 2 * s);
  ctx.lineTo(x + 0.4 * s, y - 2 * s); ctx.lineTo(x + 1.6 * s, y - 3.4 * s); ctx.lineTo(x + 1.4 * s, y - 1);
  ctx.fillStyle = col; ctx.fill();
}
function catEyes(ctx, x, y, s, col, tilt = 0.18) {
  for (const side of [-1, 1]) {
    const ex = x + side * 2.7 * s;
    glow(ctx, ex, y, 6 * s, col, 0.5);
    ctx.save(); ctx.translate(ex, y); ctx.rotate(side * tilt);
    ctx.beginPath(); ctx.moveTo(-1.9 * s, 0); ctx.quadraticCurveTo(0, -1.9 * s, 1.9 * s, 0); ctx.quadraticCurveTo(0, 1.5 * s, -1.9 * s, 0);
    ctx.fillStyle = mix(col, '#ffffff', 0.35); ctx.fill();
    ell(ctx, 0, 0, 0.36 * s, 1.15 * s); ctx.fillStyle = '#0a0410'; ctx.fill();
    ctx.restore();
  }
}
function glowCrack(ctx, S, x, y, len, rnd, k, dark, hot, core) {
  const pts = [[x - len / 2, y]];
  let px = x - len / 2;
  for (let i = 0; i < 5; i++) { px += len / 5; pts.push([px, y + (rnd() - 0.5) * 6 * k]); }
  ctx.save();
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  const b = pts[2], c = pts[4];
  ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] + 5, b[1] + 6 * k); ctx.lineTo(b[0] + 10, b[1] + 7 * k);
  ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + 3, c[1] - 5 * k);
  strokeLine(ctx, dark, 4.2 * k + 1);
  ctx.shadowColor = hot; ctx.shadowBlur = 8 * S.res * k;
  strokeLine(ctx, hot, 2.4 * k + 0.4);
  ctx.shadowBlur = 0;
  strokeLine(ctx, core, 0.9 * k + 0.3);
  ctx.restore();
}
function thornVine(ctx, x0, len, fy, rnd, col, bud) {
  const pts = [];
  const ph = rnd() * TAU, amp = 1.6 + rnd() * 1.6;
  for (let t = 0; t <= 1.0001; t += 0.05) { const x = x0 + t * len; pts.push([x, fy(x) - 1.5 + Math.sin(ph + t * 9) * amp]); }
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  strokeLine(ctx, col, 2.2);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], side = i % 2 ? -1 : 1;
    ctx.moveTo(x - 1.3, y); ctx.lineTo(x + 0.6, y + side * 4.2); ctx.lineTo(x + 1.3, y);
  }
  ctx.fill();
  for (let i = 3; i < pts.length; i += 6) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1] - 1.5, 1.4, 0, TAU); ctx.fillStyle = bud; ctx.fill(); }
}
function flameLick(ctx, x, by, s, rnd) {
  glow(ctx, x, by - 6 * s, 26 * s, '#ff5a14', 0.5);
  const f = (k, col) => {
    const lean = (rnd() - 0.5) * 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 6 * k * s, by);
    ctx.quadraticCurveTo(x - 7 * k * s, by - 9 * k * s, x - 2 * k * s + lean, by - 15 * k * s);
    ctx.quadraticCurveTo(x - 1 * k * s, by - 9 * k * s, x + 1 * k * s, by - 11 * k * s);
    ctx.quadraticCurveTo(x + 3 * k * s + lean, by - 19 * k * s, x + 4 * k * s + lean, by - 13 * k * s);
    ctx.quadraticCurveTo(x + 8 * k * s, by - 7 * k * s, x + 6 * k * s, by);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  f(1, '#e8301a'); f(0.7, '#ff8a26'); f(0.38, '#ffe58a');
}
function smokePlume(ctx, x, by, s, rnd, col) {
  const cs = [];
  for (let i = 0; i < 6; i++) { const t = i / 5; cs.push([x + t * t * 26 * s + (rnd() - 0.5) * 4 * s, by - 8 * s - t * 70 * s, (5 + t * 12) * s]); }
  ctx.save(); ctx.globalAlpha *= 0.55;
  ctx.beginPath(); for (const c of cs) addCircle(ctx, c[0], c[1], c[2]);
  ctx.fillStyle = lgY(ctx, [[by - 90 * s, rgba(col, 0)], [by - 40 * s, rgba(col, 0.7)], [by, rgba(col, 0.9)]]); ctx.fill();
  ctx.restore();
}
// Lanterne de papier (Crépuscule / ères) — x,y = centre
function paperLantern(ctx, x, y, s, P) {
  ctx.beginPath(); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x, y - 11 * s); strokeLine(ctx, OUT, 1);
  rr(ctx, x - 4 * s, y - 6 * s, 8 * s, 11 * s, 3.5 * s);
  paint(ctx, lgY(ctx, [[y - 6 * s, P.core], [y + 5 * s, P.glow]]), 1.2);
  ctx.fillStyle = OUT; ctx.fillRect(x - 2.4 * s, y - 7.2 * s, 4.8 * s, 1.6 * s); ctx.fillRect(x - 2.4 * s, y + 4.4 * s, 4.8 * s, 1.4 * s);
}
function jackFace(ctx, x, y, s, P) {
  ctx.fillStyle = P.core;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 2 * s); ctx.lineTo(x - 3.2 * s, y - 5.5 * s); ctx.lineTo(x - 1.6 * s, y - 1.6 * s); ctx.closePath();
  ctx.moveTo(x + 6 * s, y - 2 * s); ctx.lineTo(x + 3.2 * s, y - 5.5 * s); ctx.lineTo(x + 1.6 * s, y - 1.6 * s); ctx.closePath();
  ctx.moveTo(x - 7 * s, y + 1 * s);
  for (let i = 0; i <= 6; i++) ctx.lineTo(x - 7 * s + i * (14 / 6) * s, y + (i % 2 ? 3.2 : 1) * s);
  ctx.quadraticCurveTo(x, y + 8 * s, x - 7 * s, y + 1 * s);
  ctx.fill();
}
function drawLights(ctx, S, E) {
  const P = E.light;
  for (const [x, y, r, o] of S.lights) {
    const col = o && o.alt && P.alt ? P.alt : P.glow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r, col, P.a * (o && o.a != null ? o.a : 1));
    ctx.restore();
    if (!o) { ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * 0.08), 0, TAU); ctx.fillStyle = P.core; ctx.fill(); continue; }
    if (o.rect) { ctx.fillStyle = lgY(ctx, [[o.rect[1], P.core], [o.rect[1] + o.rect[3], col]]); ctx.fillRect(o.rect[0], o.rect[1], o.rect[2], o.rect[3]); }
    if (o.lantern) paperLantern(ctx, x, y, o.lantern, P);
    if (o.jack) jackFace(ctx, x, y, o.jack, P);
  }
}

// ------------------------------------------------------------------ ciel d'ère
function eraSky(ctx, cv, S, spec, V, res) {
  const E = ERA[V];
  const sk = E.skyRamp || (E.skyRamp = ramp(E.sky, 361));
  // skyKeep : part du ciel d'origine conservée (repères dessinés dans le ciel : volcan, tour Eiffel…)
  const K = E.skyK * (spec.kind === 'indoor' ? 0.55 : spec.kind === 'water' ? 0.6 : 1) * (1 - (spec.skyKeep || 0));
  const f = [0, 0, 0, K];
  eraGrade(cv, E, { res, y0: 0, rimK: 0, fog: (yu) => { const i = Math.max(0, Math.min(360, Math.round(yu))) * 3; f[0] = sk[i]; f[1] = sk[i + 1]; f[2] = sk[i + 2]; return f; } });
  const sun = CUR.sun, kind = spec.kind || 'day';
  const R = seeded(((((S.rand() * 4294967295) >>> 0) ^ (V * 104729)) >>> 0) || 1); // après le dessin : le tracé ne change pas
  const open = kind === 'day' || kind === 'night';
  if (V === 1) {
    if (sun) {
      const x = sun.x, y = spec.horizon ?? 196, r = sun.r * 1.55;
      glow(ctx, x, y, r * 9, '#ff7a3a', 0.5);
      glow(ctx, x, y, r * 3.2, '#ffd27a', 0.55);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, '#ffd070'); g.addColorStop(1, '#ff8a3a');
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = rgba('#7a2a6a', 0.55);
      for (const [dy, w, hh] of [[-r * 0.25, r * 2.6, 2.2], [r * 0.32, r * 3.4, 2.8], [r * 0.75, r * 2.2, 1.8]]) { ell(ctx, x + (R() - 0.5) * r, y + dy, w, hh); ctx.fill(); }
    }
    if (open) {
      for (let i = 0; i < 40; i++) {
        const x = R() * SKY_W, y = Math.pow(R(), 1.7) * 110;
        ctx.beginPath(); ctx.arc(x, y, 0.4 + R() * 0.8, 0, TAU); ctx.fillStyle = rgba('#fff4e0', (0.3 + R() * 0.6) * (1 - y / 120)); ctx.fill();
      }
      for (let i = 0; i < 6; i++) { ell(ctx, R() * SKY_W, 120 + R() * 80, 40 + R() * 90, 1.6 + R() * 2.2); ctx.fillStyle = rgba(R() < 0.5 ? '#ff9a8a' : '#ffc07a', 0.45); ctx.fill(); }
    }
  } else if (V === 2) {
    if (sun) {
      const x = sun.x, y = sun.y + 6, r = sun.r * 1.3;
      glow(ctx, x, y, r * 6, '#8aff5a', 0.32);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = ball(ctx, x, y, r, '#d8f0b0', 0.25, 0.3); ctx.fill();
      ctx.fillStyle = rgba('#8aa070', 0.55);
      for (const [dx, dy, rr2] of [[-0.3, -0.2, 0.22], [0.32, 0.12, 0.16], [-0.05, 0.42, 0.13], [0.3, -0.42, 0.1]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr2 * r, 0, TAU); ctx.fill(); }
    }
    if (open) {
      // nuées sombres étirées
      for (let i = 0; i < 9; i++) {
        const x = R() * SKY_W, y = 30 + R() * 150, w = 40 + R() * 90;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) addEll(ctx, x + (k - 1) * w * 0.4 + R() * 10, y + (R() - 0.5) * 4, w * (0.35 + R() * 0.3), 2.5 + R() * 3.5);
        ctx.fillStyle = rgba('#0c0818', 0.55); ctx.fill();
        ell(ctx, x - w * 0.15, y - 2.5, w * 0.45, 0.9); ctx.fillStyle = rgba('#a8c890', 0.28); ctx.fill();
      }
      for (let i = 0; i < 7; i++) bat(ctx, 40 + R() * 400, 40 + R() * 120, 0.7 + R() * 0.7, '#0a0612');
    }
    ctx.fillStyle = lgY(ctx, [[0, rgba('#05030a', 0.55)], [140, rgba('#05030a', 0)]]); ctx.fillRect(0, 0, SKY_W, 140);
  } else if (V === 3) {
    if (sun) { // éclipse
      const x = sun.x, y = sun.y + 4, r = sun.r * 1.35;
      glow(ctx, x, y, r * 7, '#ff3a14', 0.55);
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = rgba('#ffb04a', 0.6);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + R() * 0.2, l2 = r * (1.35 + R() * 0.5); ctx.moveTo(Math.cos(a - 0.08) * r, Math.sin(a - 0.08) * r); ctx.lineTo(Math.cos(a) * l2, Math.sin(a) * l2); ctx.lineTo(Math.cos(a + 0.08) * r, Math.sin(a + 0.08) * r); }
      ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, r * 1.06, 0, TAU); ctx.fillStyle = '#ffd27a'; ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.03, r, 0, TAU); ctx.fillStyle = '#120306'; ctx.fill();
    }
    if (kind !== 'water') {
      // cendres en haut, éclairées par dessous
      for (let i = 0; i < 6; i++) {
        const x = (i + 0.5) * SKY_W / 6 + (R() - 0.5) * 40, y = 8 + R() * 40, w = 70 + R() * 60;
        cloud(ctx, x, y, w, w * 0.34, R, '#1a0508', '#7a1a10', '#5a120c');
      }
      for (let i = 0; i < 60; i++) {
        const x = R() * SKY_W, y = 40 + R() * 240, r = 0.5 + R() * 1.1;
        glow(ctx, x, y, r * 4, '#ff6a1a', 0.35);
        ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fillStyle = '#ffd27a'; ctx.fill();
      }
    }
  }
}

// Ombres longues (soleil bas à droite) : projetées vers la gauche au pied de chaque silhouette.
function longShadows(ctx, img, res, Ld, W) {
  const st = 2, N = Math.round(W / st), yMin = Math.max(Ld.y0, 110), yMax = Ld.y0 + Ld.h - 1;
  const top = new Float32Array(N);
  for (let i = 0; i < N; i++) top[i] = surfaceY(img, res, Ld.y0, i * st, yMin, yMax) ?? yMax;
  const gl = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let k = -22; k <= 22; k++) m = Math.max(m, top[mod(i + k, N)]); gl[i] = m; }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const h = gl[i] - top[i];
    if (h < 10 || gl[i] > yMax - 3) continue;
    const L = Math.min(170, h * 1.35), g = gl[i] + 0.5, th = 2 + L * 0.03;
    for (const o of [-W, 0, W]) {
      const x = i * st + o;
      if (x + st < -2 || x - L > W + 2) continue;
      ctx.moveTo(x - st * 0.6, g); ctx.lineTo(x + st * 0.6, g); ctx.lineTo(x + st * 0.6 - L, g + th); ctx.lineTo(x - st * 0.6 - L, g + th); ctx.closePath();
    }
  }
  ctx.fillStyle = rgba('#3a1650', 0.34);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ couches d'ère
function eraLayer(ctx, cv, S, Ld, spec, V, res) {
  const E = ERA[V];
  const front = !!Ld.front, ground = !front && Ld.speed >= 1;
  const d = front || ground ? 0 : Math.max(0, Math.min(1, 1 - Ld.speed / 0.4));
  const high = !front && !ground && Ld.y0 + Ld.h <= 215; // bande de nuages : étalonnée comme le ciel
  const role = front ? 'front' : ground ? 'ground' : high ? 'sky' : d > 0.55 ? 'far' : 'mid';
  const fr = rgb3(E.fog), frc = rgb3(E.front[0]);
  const sk = E.skyRamp || (E.skyRamp = ramp(E.sky, 361));
  const f = [0, 0, 0, 0];
  const fog = (yu) => {
    if (front) { f[0] = frc[0]; f[1] = frc[1]; f[2] = frc[2]; f[3] = E.front[1]; return f; }
    if (high) { const i = Math.max(0, Math.min(360, Math.round(yu + 30))) * 3; f[0] = sk[i]; f[1] = sk[i + 1]; f[2] = sk[i + 2]; f[3] = E.skyK * 0.7; return f; }
    f[0] = fr[0]; f[1] = fr[1]; f[2] = fr[2];
    if (ground) {
      if (V === 2 && yu < 302) f[3] = 0.2 * sstep(262, 276, yu) * (1 - sstep(286, 300, yu));
      else { f[0] = frc[0]; f[1] = frc[1]; f[2] = frc[2]; f[3] = (V === 1 ? 0.18 : 0.42) * sstep(306, 360, yu); }
    }
    else f[3] = E.fogK * (V === 2 ? 0.25 + 0.75 * d : d) * sstep(E.fogY[0], E.fogY[1], yu);
    return f;
  };
  const rimK = E.rim.k * (role === 'far' ? 0.55 : role === 'front' ? 0.6 : role === 'sky' ? 0.8 : 1);
  const img = eraGrade(cv, E, { res, y0: Ld.y0, fog, rimK });
  const k0 = (S.rand() * 4294967295) >>> 0; // tiré après le dessin de la couche : le tracé reste identique d'une ère à l'autre
  const W = S.W, R = seeded(((k0 ^ (V * 7919)) >>> 0) || 1);
  const Sx = makeS(W, ((k0 * 31 + V * 17) >>> 0) || 1, res, 0);
  const bottom = Ld.y0 + Ld.h;
  const kind = spec.kind || 'day';
  if (V === 1 && role === 'mid' && bottom >= 270) longShadows(ctx, img, res, Ld, W);
  if (V === 2) {
    if (role === 'far' || role === 'mid') {
      if (bottom >= 270) {
        const top = bottom - (role === 'far' ? 46 : 30);
        const fw = wave(Sx, top, [[5, 2, 3], [2.5, 5, 8]]);
        profilePath(ctx, W, fw, bottom + 2);
        ctx.fillStyle = lgY(ctx, [[top - 6, rgba('#7a6aa0', 0)], [top + 14, rgba('#7a6aa0', role === 'far' ? 0.45 : 0.32)], [bottom, rgba('#8a7ab0', role === 'far' ? 0.6 : 0.42)]]);
        ctx.fill();
        for (const x of Sx.spread(7, 0.8)) {
          const w = Sx.r(40, 90), y = top + Sx.r(4, 16);
          Sx.rep(x, w, (xx) => { ctx.save(); ctx.translate(xx, y); ctx.scale(1, 0.22); glow(ctx, 0, 0, w, '#9a8ac0', 0.35); ctx.restore(); });
        }
      }
      if (role === 'mid' || d < 0.8) { // yeux dans l'ombre
        let n = 0;
        for (let t = 0; t < 400 && n < (role === 'mid' ? 5 : 3); t++) {
          const x = R() * W, y = Math.max(Ld.y0 + 10, 190) + R() * (bottom - 12 - Math.max(Ld.y0 + 10, 190));
          const s = role === 'mid' ? 1.1 : 0.75;
          let ok = true;
          for (const [dx, dy] of [[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 0], [-10, 0], [10, 0]]) { const p = pixAt(img, res, Ld.y0, x + dx * s, y + dy * s); if (!p || p[0] < 250 || p[1] > 125) { ok = false; break; } }
          if (!ok) continue;
          n++;
          const col = R() < 0.7 ? '#c8ff4a' : '#ff5ad8';
          Sx.rep(x, 12, (xx) => catEyes(ctx, xx, y, s, col));
        }
      }
    }
    if (ground) {
      const fy = (x) => (surfaceY(img, res, Ld.y0, x, 262, 285) ?? 272);
      for (const x of Sx.spread(4, 0.8)) { const len = Sx.r(50, 90); Sx.rep(x, len, (xx, rnd) => thornVine(ctx, xx - len / 2, len, fy, rnd, '#140a1e', '#d04aff')); }
      for (const x of Sx.spread(5, 0.9)) Sx.rep(x, 30, (xx, rnd) => glowCrack(ctx, Sx, xx, 318 + rnd() * 34, 28 + rnd() * 18, rnd, 0.9, '#0c0614', '#8aff3a', '#eaffc0'));
      for (const x of Sx.spread(3, 0.7)) Sx.rep(x, 30, (xx, rnd) => {
        const y = 322 + rnd() * 26, w = 12 + rnd() * 12;
        ell(ctx, xx, y, w, w * 0.22); ctx.fillStyle = rgba('#3a1a5a', 0.85); ctx.fill();
        ell(ctx, xx - w * 0.3, y - w * 0.05, w * 0.35, w * 0.06); ctx.fillStyle = rgba('#c88aff', 0.5); ctx.fill();
        glow(ctx, xx, y, w, '#9a4aff', 0.25);
      });
    }
    if (front) for (const x of Sx.spread(3, 0.8)) Sx.rep(x, 60, (xx, rnd) => thornVine(ctx, xx - 40, 80, (q) => 352 + Math.sin(q * 0.05) * 3, rnd, '#0a0410', '#a03ae0'));
  } else if (V === 3) {
    if ((role === 'far' || role === 'mid') && bottom >= 270 && Ld.speed > 0.05) {
      // incendies lointains posés sur la surface du décor
      let n = 0;
      for (let t = 0; t < 120 && n < (role === 'far' ? 4 : 3); t++) {
        const x = R() * W;
        const y = surfaceY(img, res, Ld.y0, x, Math.max(Ld.y0, 150), bottom - 6);
        if (y == null) continue;
        n++;
        const s = role === 'far' ? 0.55 + R() * 0.3 : 0.8 + R() * 0.3;
        Sx.rep(x, 40, (xx, rnd) => {
          smokePlume(ctx, xx, y, s, rnd, '#1a0406');
          if (kind === 'water') { glow(ctx, xx, y, 18 * s, '#ff5a14', 0.7); ell(ctx, xx, y + 1, 5 * s, 2 * s); ctx.fillStyle = '#ffd27a'; ctx.fill(); }
          else flameLick(ctx, xx, y + 2, s, rnd);
        });
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = lgY(ctx, [[bottom - 40, rgba('#ff4a14', 0)], [bottom, rgba('#ff4a14', role === 'far' ? 0.3 : 0.18)]]);
      ctx.fillRect(-5, bottom - 40, W + 10, 40);
      ctx.restore();
    }
    if (role === 'mid') for (let i = 0; i < 26; i++) { const x = R() * W, y = Math.max(Ld.y0, 120) + R() * (bottom - Math.max(Ld.y0, 120)); Sx.rep(x, 6, (xx) => { glow(ctx, xx, y, 3.5, '#ff7a1a', 0.6); ctx.fillStyle = '#ffe08a'; ctx.fillRect(xx - 0.5, y - 0.5, 1, 1); }); }
    if (ground) {
      for (const x of Sx.spread(4, 0.8)) Sx.rep(x, 30, (xx, rnd) => { const y = (surfaceY(img, res, Ld.y0, xx, 262, 285) ?? 272) + 5 + rnd() * 3; glowCrack(ctx, Sx, xx, y, 20 + rnd() * 10, rnd, 0.4, '#1a0406', '#ff5a14', '#ffe07a'); });
      for (const x of Sx.spread(6, 0.9)) Sx.rep(x, 30, (xx, rnd) => glowCrack(ctx, Sx, xx, 318 + rnd() * 34, 28 + rnd() * 20, rnd, 1, '#1a0406', '#ff5a14', '#ffe07a'));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) { const x = R() * W, y = 312 + R() * 46; Sx.rep(x, 6, (xx) => glow(ctx, xx, y, 3, '#ff6a1a', 0.7)); }
      ctx.restore();
    }
    if (front) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = lgY(ctx, [[330, rgba('#ff4a14', 0)], [360, rgba('#ff4a14', 0.35)]]); ctx.fillRect(-5, 320, W + 10, 44); ctx.restore(); }
  }
  if (S.lights.length) {
    ctx.save();
    if (front) { ctx.beginPath(); ctx.rect(-10, 320, W + 20, 50); ctx.clip(); } // premier plan : rien au-dessus de y = 320
    drawLights(ctx, S, E);
    ctx.restore();
  }
}

// =====================================================================
//  API
// =====================================================================
const DEFS = { desert: desertDef, jungle: jungleDef, underwater: underwaterDef, castle: castleDef, factory: factoryDef, sky: skyDef, candy: candyDef, garden: gardenDef, autumn: autumnDef, beach: beachDef, snow: snowDef, neon: neonDef, volcano: volcanoDef, cosmos: cosmosDef, roofs: roofsDef, arena: arenaDef };

// id : biome · seed : tirage du tracé · res : pixels par unité · variant : ère (0 à 3)
// La même graine donne le même tracé quelle que soit l'ère.
export function buildScenery(id, seed = 1, res = 2, variant = 0) {
  const key = DEFS[id] ? id : 'garden';
  const V = Math.max(0, Math.min(3, variant | 0));
  const spec = DEFS[key]();
  const base = (((seed | 0) * 2654435761) ^ hashStr(key)) >>> 0;
  CUR = { V, sun: null };
  try {
    // ciel
    const sky = mkCanvas(SKY_W, VH, res);
    {
      const ctx = sky.getContext('2d');
      ctx.scale(sky.width / SKY_W, sky.height / VH);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const S = makeS(SKY_W, (base ^ 0x9e3779b9) >>> 0 || 1, res, V);
      spec.sky(ctx, S);
      if (V) eraSky(ctx, sky, S, spec, V, res);
    }
    const layers = spec.layers.map((Ld, i) => {
      const c = mkCanvas(TILE, Ld.h, res);
      const ctx = c.getContext('2d');
      ctx.scale(c.width / TILE, c.height / Ld.h);
      ctx.translate(0, -Ld.y0);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const S = makeS(TILE, ((base + (i + 1) * 0x85ebca6b) >>> 0) || 1, res, V);
      Ld.draw(ctx, S);
      if (V) eraLayer(ctx, c, S, Ld, spec, V, res);
      return { canvas: c, tileW: TILE, y0: Ld.y0, h: Ld.h, speed: Ld.speed, front: !!Ld.front };
    });
    return { id: key, variant: V, ambient: eraAmbient(spec.ambient, V), sky, layers };
  } finally {
    CUR = null;
  }
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
