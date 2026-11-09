// =====================================================================
//  Ennemis — dessin vectoriel Canvas 2D, vue de côté (style « Legend of
//  Mushroom »). Repère local : pieds en y = 0, y vers le bas (le corps est
//  donc en y négatif), centré en x = 0. LES ENNEMIS REGARDENT VERS LA GAUCHE
//  (x négatif) : ils marchent vers le héros.
//  Chaque ennemi a 2 poses (frame 0/1) pour une animation de marche simple.
// =====================================================================
import {
  OUT, shade, mix, rgba, seeded, ell, rr, smooth, poly, paint, vgrad, ball, gloss, glow,
  makeSprite, spriteURL,
} from './draw.js';

export const ENEMY_KINDS = ['rat', 'dog', 'vacuum', 'cucumber', 'pigeon', 'crab', 'wasp', 'mole', 'yeti', 'robodog', 'slime', 'ufo', 'ghost', 'knightrat'];

// h : hauteur approximative de la silhouette au-dessus de la ligne des pieds (unités)
// fly : ennemi volant (flotte au-dessus du sol, pas de pieds)
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

const LW = 3;

// ------------------------------------------------------------ outils
// Échantillonne une courbe Catmull-Rom passant par pts.
function spline(pts, n = 10) {
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
function taper(ctx, pts, w0, w1 = w0, n = 10) {
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
function limb(ctx, pts, w0, w1, fill, lw = LW) { taper(ctx, pts, w0, w1); paint(ctx, fill, lw); }
// Point et normale le long d'une courbe (pour placer des pics, des rivets…)
function along(pts, t) {
  const s = spline(pts, 12);
  const i = Math.min(s.length - 2, Math.max(0, Math.round(t * (s.length - 1))));
  const a = s[i], b = s[i + 1];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: a[0], y: a[1], tx: (b[0] - a[0]) / d, ty: (b[1] - a[1]) / d };
}
function clipTo(ctx, path, fn) { ctx.save(); path(); ctx.clip(); fn(); ctx.restore(); }
// Forme « toon » : dégradé boule + ombre propre en bas à droite + contour.
function form(ctx, path, base, x, y, r, o = {}) {
  const { lw = LW, sh = 0.2, k = 0.14, light = 0.32, dark = 0.16, fill = null } = o;
  path();
  ctx.fillStyle = shade(base, -sh);
  ctx.fill();
  ctx.save();
  path(); ctx.clip();
  ctx.translate(-r * k * 0.8, -r * k);
  path();
  ctx.fillStyle = fill || ball(ctx, x, y, r, base, light, dark);
  ctx.fill();
  ctx.restore();
  path();
  paint(ctx, null, lw);
}
function fillA(ctx, color, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
function blush(ctx, x, y, rx = 5, ry = 3, color = '#ff5d8f', a = 0.38) { ell(ctx, x, y, rx, ry); fillA(ctx, color, a); }
// Gros œil expressif (fâché mais mignon). inner = +1 si le coin intérieur est à droite.
function eye(ctx, x, y, rx, ry, o = {}) {
  const {
    lid = null, inner = 1, anger = 0.55, look = [-0.45, 0.1], iris = '#3b2a5c',
    pupil = OUT, lw = 2.5, sclera = '#ffffff', pr = 0.74,
  } = o;
  const path = () => ell(ctx, x, y, rx, ry);
  path();
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, mix(sclera, '#a9b0d6', 0.45));
  g.addColorStop(0.45, sclera);
  g.addColorStop(1, mix(sclera, '#dfe2f4', 0.4));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path(); ctx.clip();
  const px = x + look[0] * rx * 0.42, py = y + look[1] * ry * 0.5 + ry * 0.12;
  ell(ctx, px, py, rx * pr, ry * pr * 1.04);
  ctx.fillStyle = ball(ctx, px, py, ry * pr, iris, 0.45, 0.35);
  ctx.fill();
  ell(ctx, px - rx * 0.02, py + ry * 0.05, rx * pr * 0.56, ry * pr * 0.6);
  ctx.fillStyle = pupil; ctx.fill();
  ell(ctx, px - rx * 0.24, py - ry * 0.26, rx * 0.24, ry * 0.2, -0.4); ctx.fillStyle = '#ffffff'; ctx.fill();
  ell(ctx, px + rx * 0.24, py + ry * 0.3, rx * 0.11, ry * 0.09); ctx.fill();
  if (lid) {
    const xo = x - inner * rx * 1.25, xi = x + inner * rx * 1.25;
    const yo = y - ry * 1.05, yi = y - ry * (1.05 - anger * 1.7);
    poly(ctx, [[xo, yo], [xi, yi], [xi, y - ry * 3], [xo, y - ry * 3]]);
    ctx.fillStyle = lid; ctx.fill();
    ctx.beginPath(); ctx.moveTo(xo, yo); ctx.lineTo(xi, yi);
    ctx.lineWidth = lw * 1.25; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.restore();
  path();
  paint(ctx, null, lw);
}
// Sourcil épais (taper du bout extérieur vers l'intérieur).
function brow(ctx, x0, y0, x1, y1, w = 4, color = OUT) {
  taper(ctx, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 1.2], [x1, y1]], w * 0.55, w);
  ctx.fillStyle = color; ctx.fill();
}
function ear(ctx, x, y, r, fur, inner, rot = 0) {
  ell(ctx, x, y, r, r * 0.95, rot);
  paint(ctx, ball(ctx, x, y, r, fur), LW);
  ell(ctx, x + r * 0.06, y + r * 0.1, r * 0.66, r * 0.6, rot);
  ctx.fillStyle = ball(ctx, x, y + r * 0.1, r * 0.7, inner, 0.3, 0.25);
  ctx.fill();
}
function whiskers(ctx, x, y, dir = -1, len = 12, a = 0.6) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y + k * 2);
    ctx.quadraticCurveTo(x + dir * len * 0.6, y + k * 3.5 - 1, x + dir * len, y + k * 5.5);
    ctx.stroke();
  }
  ctx.restore();
}
// Patte de quadrupède : rectangle arrondi jusqu'au sol + pied.
function leg(ctx, x, top, w, color, paw = color, lean = 0) {
  rr(ctx, x - w / 2 + lean * 0.5, top, w, -top - 3, w / 2);
  paint(ctx, vgrad(ctx, top, 0, color, 0.15, 0.25), LW);
  ell(ctx, x - 2 + lean, -3.6, w * 0.62, 4.2);
  paint(ctx, ball(ctx, x - 2 + lean, -4, w * 0.6, paw, 0.3, 0.2), LW);
}
function sparkle(ctx, x, y, r, color = '#ffffff', a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

// =====================================================================
//  1. Souris voyou
// =====================================================================
function drawRat(ctx, f) {
  const fur = '#a9adcb', furD = '#7f82a6', pink = '#ff9dbb', red = '#ec3b4f';
  const s = f ? 1 : -1, b = f ? -1.5 : 0;
  // queue
  limb(ctx, [[10, -14], [25, -9], [38, -16 + s], [42, -31], [36, -42 - s], [28, -40]], 6, 2.2,
    vgrad(ctx, -44, -8, pink, 0.2, 0.25), 2.5);
  // pied arrière
  ell(ctx, 7 - 3 * s, -3.6, 8, 4.4); paint(ctx, shade(pink, -0.18), 2.5);
  ctx.save(); ctx.translate(0, b);
  // bras arrière
  ell(ctx, 16, -27, 5, 6, 0.3); paint(ctx, furD, 2.5);
  const body = () => smooth(ctx, [[-15, -30], [-6, -40], [9, -40], [18, -26], [15, -10], [2, -5], [-12, -8], [-18, -18]]);
  form(ctx, body, fur, -2, -26, 22);
  clipTo(ctx, body, () => { ell(ctx, -6, -17, 9, 11); fillA(ctx, '#ffffff', 0.4); });
  ctx.restore();
  // pied avant
  ell(ctx, -9 + 3 * s, -3.6, 8.5, 4.6); paint(ctx, ball(ctx, -9 + 3 * s, -5, 9, pink, 0.3, 0.2), 2.5);
  ctx.save(); ctx.translate(0, b * 1.4);
  // oreilles
  ear(ctx, 9, -66, 11, fur, pink, 0.3);
  ear(ctx, -7, -71, 12.5, fur, pink, -0.2);
  // tête
  const head = () => smooth(ctx, [[-34, -46], [-27, -55], [-16, -63], [-1, -66], [11, -60], [14, -49], [9, -39], [-2, -34], [-15, -35], [-27, -39]]);
  form(ctx, head, fur, -8, -54, 22);
  clipTo(ctx, head, () => { ell(ctx, -24, -41, 11, 6.5, -0.2); fillA(ctx, '#ffffff', 0.38); });
  // bandana
  const band = () => smooth(ctx, [[-24, -55], [-14, -62], [0, -65.5], [12, -60.5], [14, -54], [1, -58.5], [-13, -56], [-23, -50]]);
  band(); paint(ctx, vgrad(ctx, -66, -50, red, 0.25, 0.2), 2.5);
  for (const [x, y] of [[-17, -56.5], [-7, -60.5], [4, -61], [-12, -59.6]].slice(0, 3)) { ell(ctx, x, y, 1.6, 1.4); ctx.fillStyle = '#fff'; ctx.fill(); }
  limb(ctx, [[15, -58], [23, -63 + s], [31, -61 + s * 1.5]], 6, 3, red, 2.5);
  limb(ctx, [[15, -56], [21, -50], [27, -46 - s]], 5.5, 3, shade(red, -0.12), 2.5);
  ell(ctx, 15, -57, 4.4, 4); paint(ctx, red, 2.5);
  // yeux
  eye(ctx, -18.5, -49, 5, 6.4, { lid: fur, inner: 1, anger: 0.62 });
  eye(ctx, -4.5, -50, 6.6, 8, { lid: fur, inner: -1, anger: 0.62 });
  blush(ctx, -6, -39.5, 4.5, 2.6);
  // museau
  whiskers(ctx, -27, -42, -1, 13);
  ell(ctx, -33.5, -46.5, 4.2, 3.8); paint(ctx, ball(ctx, -33.5, -47, 4.5, '#ff6f96'), 2.2);
  gloss(ctx, -34.6, -47.8, 1.4, 1, 0.8);
  // dents
  rr(ctx, -28.5, -40.5, 3.4, 5.6, 1); paint(ctx, '#fffbea', 1.8);
  rr(ctx, -25.1, -40.2, 3.4, 5.4, 1); paint(ctx, '#fffbea', 1.8);
  ctx.beginPath(); ctx.moveTo(-30, -40.5); ctx.quadraticCurveTo(-22, -38, -16, -40.5);
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.restore();
  // bras avant (poing)
  ctx.save(); ctx.translate(0, b);
  limb(ctx, [[-3, -31], [-11, -28], [-17, -30 - s]], 7, 6, fur, 2.5);
  ell(ctx, -19, -30.5 - s, 5.4, 5); paint(ctx, ball(ctx, -19, -31, 5.5, pink, 0.3, 0.2), 2.5);
  ctx.restore();
}

// =====================================================================
//  2. Bouledogue
// =====================================================================
function drawDog(ctx, f) {
  const fur = '#c88443', furD = '#94582a', tan = '#f6d39e', dark = '#5b3218';
  const s = f ? 1 : -1, b = f ? -1.2 : 0;
  // queue
  limb(ctx, [[37, -40 + b], [43, -47 + b], [44, -53 + b + s]], 6.5, 4.5, fur, 2.5);
  // pattes arrière-plan
  leg(ctx, 32 + 3 * s, -26, 11, furD, shade(tan, -0.2));
  leg(ctx, -4 - 3 * s, -26, 11, furD, shade(tan, -0.2));
  ctx.save(); ctx.translate(0, b);
  const body = () => smooth(ctx, [[-18, -50], [0, -57], [24, -55], [40, -45], [42, -29], [34, -17], [12, -15], [-12, -17], [-22, -31]]);
  form(ctx, body, fur, 12, -38, 32);
  clipTo(ctx, body, () => {
    ell(ctx, 6, -16, 20, 8); fillA(ctx, tan, 0.9);
    ell(ctx, 26, -47, 8, 5, 0.3); fillA(ctx, dark, 0.35);
  });
  ctx.restore();
  // pattes avant-plan
  leg(ctx, 24 - 3 * s, -24, 12, fur, tan);
  leg(ctx, -16 + 3 * s, -24, 13, fur, tan, -1);
  ctx.save(); ctx.translate(0, b * 1.3);
  // oreilles
  smooth(ctx, [[-4, -73], [6, -82], [10, -71], [4, -66]]); paint(ctx, dark, 2.5);
  // tête
  const head = () => smooth(ctx, [[-49, -54], [-45, -68], [-31, -78], [-13, -78], [1, -71], [6, -57], [1, -42], [-13, -34], [-34, -32], [-47, -40]]);
  form(ctx, head, fur, -22, -60, 30);
  clipTo(ctx, head, () => {
    smooth(ctx, [[-52, -52], [-44, -58], [-30, -55], [-21, -46], [-24, -34], [-38, -30], [-52, -36]]);
    ctx.fillStyle = vgrad(ctx, -58, -30, tan, 0.2, 0.15); ctx.fill();
    // rides
    ctx.strokeStyle = rgba(dark, 0.55); ctx.lineWidth = 1.6;
    for (const [x, y, w] of [[-30, -72, 7], [-28, -68, 9]]) {
      ctx.beginPath(); ctx.moveTo(x - w, y + 1); ctx.quadraticCurveTo(x, y - 2.5, x + w, y + 1); ctx.stroke();
    }
  });
  smooth(ctx, [[-36, -76], [-46, -83], [-46, -71], [-40, -68]]); paint(ctx, dark, 2.5);
  // yeux + gros sourcils
  eye(ctx, -38, -61, 5, 6, { lid: fur, inner: 1, anger: 0.6 });
  eye(ctx, -21, -62, 7, 8, { lid: fur, inner: -1, anger: 0.6 });
  brow(ctx, -44, -70, -33, -64, 4.2);
  brow(ctx, -12, -72, -27, -67, 5);
  // truffe
  ell(ctx, -45, -53.5, 6.2, 4.3); paint(ctx, ball(ctx, -45, -54, 6, '#3c2430', 0.3, 0.2), 2.2);
  gloss(ctx, -47, -55, 2, 1.1, 0.7);
  // mâchoire inférieure (prognathe)
  const jaw = () => smooth(ctx, [[-54, -44], [-42, -43.5], [-28, -44.5], [-24, -38], [-34, -31], [-50, -34]]);
  jaw(); paint(ctx, '#7a2638', 2.5);
  clipTo(ctx, jaw, () => {
    ell(ctx, -38, -32, 8, 4); ctx.fillStyle = '#ff7b93'; ctx.fill();
    for (let i = 0; i < 5; i++) { rr(ctx, -50 + i * 4.6, -45, 3.6, 3.6, 1); ctx.fillStyle = '#fffbea'; ctx.fill(); }
  });
  jaw(); paint(ctx, null, 2.5);
  // babines
  smooth(ctx, [[-53, -47], [-46, -50], [-38, -49], [-31, -47], [-38, -44], [-46, -43.5]]);
  paint(ctx, tan, 2.2);
  // crocs
  for (const x of [-50, -32]) {
    poly(ctx, [[x - 2.4, -44], [x + 2.4, -44], [x + 0.3, -52]]);
    paint(ctx, '#fffbea', 1.8);
  }
  blush(ctx, -16, -45, 4.5, 2.6, '#ff5d6c', 0.3);
  ctx.restore();
  // collier à pics
  ctx.save(); ctx.translate(0, b * 1.15);
  const cpts = [[-28, -33], [-12, -33], [0, -41], [5, -53]];
  for (const t of [0.12, 0.38, 0.62, 0.86]) {
    const p = along(cpts, t);
    const nx = p.ty, ny = -p.tx; // normale vers l'extérieur (bas/droite)
    const ox = -nx, oy = -ny;
    poly(ctx, [[p.x + p.tx * 3.2 + ox * 2, p.y + p.ty * 3.2 + oy * 2], [p.x - p.tx * 3.2 + ox * 2, p.y - p.ty * 3.2 + oy * 2], [p.x + ox * 10, p.y + oy * 10]]);
    paint(ctx, vgrad(ctx, p.y - 8, p.y + 8, '#d9deef', 0.4, 0.3), 2);
  }
  limb(ctx, cpts, 7.5, 7.5, vgrad(ctx, -56, -30, '#3b2a55', 0.25, 0.2), 2.5);
  for (const t of [0.25, 0.5, 0.75]) { const p = along(cpts, t); ell(ctx, p.x, p.y, 1.6, 1.6); ctx.fillStyle = '#ffd34d'; ctx.fill(); }
  ctx.restore();
}

// =====================================================================
//  3. Aspi-Bot
// =====================================================================
function drawVacuum(ctx, f) {
  const shell = '#c9d0ee', top = '#4a3f8a', red = '#ff2a3d';
  const s = f ? 1 : -1, b = f ? -1 : 0;
  // poussière derrière
  ctx.save(); ctx.globalAlpha = 0.5;
  for (const [x, y, r] of [[50 + s * 2, -6, 5], [57, -10 + s, 3.5], [46, -12, 3]]) { ell(ctx, x, y, r, r); ctx.fillStyle = '#cbbfae'; ctx.fill(); }
  ctx.restore();
  // roues
  for (const x of [-25, 25]) {
    ell(ctx, x, -6.5, 7, 6.5); paint(ctx, ball(ctx, x, -7, 7, '#3a3550', 0.25, 0.2), 2.5);
    ell(ctx, x, -6.5, 2.6, 2.4); ctx.fillStyle = '#9aa0bf'; ctx.fill();
    ctx.save(); ctx.translate(x, -6.5); ctx.rotate(f ? 0.8 : 0); ctx.strokeStyle = '#9aa0bf'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke(); }
    ctx.restore();
  }
  ctx.save(); ctx.translate(0, b);
  const ty = -40, by = -17, rx = 45, ry = 10;
  const yT = (x) => ty + ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
  const yB = (x) => by + ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
  const puck = () => {
    ctx.beginPath();
    ctx.ellipse(0, ty, rx, ry, 0, Math.PI, 0, false);
    ctx.lineTo(rx, by);
    ctx.ellipse(0, by, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
  };
  puck();
  const g = ctx.createLinearGradient(-rx, 0, rx, 0);
  g.addColorStop(0, shade(shell, 0.5)); g.addColorStop(0.35, shell); g.addColorStop(1, shade(shell, -0.35));
  ctx.fillStyle = g; ctx.fill();
  clipTo(ctx, puck, () => {
    // reflet horizontal sur la tranche
    ctx.beginPath(); for (let x = -rx; x <= rx; x += 3) ctx.lineTo(x, yT(x) + 1.5); for (let x = rx; x >= -rx; x -= 3) ctx.lineTo(x, yT(x) + 4);
    fillA(ctx, '#ffffff', 0.55);
    // pare-chocs caoutchouc
    ctx.beginPath(); for (let x = -rx - 2; x <= rx + 2; x += 3) ctx.lineTo(x, yB(x) - 5.5); ctx.lineTo(rx + 2, 12); ctx.lineTo(-rx - 2, 12); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, -12, 0, '#3b3766', 0.15, 0.25); ctx.fill();
  });
  puck(); paint(ctx, null, LW);
  // dents sur le pare-chocs (sourire mauvais)
  for (let x = -32; x <= 8; x += 6.6) {
    const y = yB(x) - 5.5;
    poly(ctx, [[x - 3, y + 0.8], [x + 3, y + 0.8], [x, y - 4.8]]);
    paint(ctx, '#fffbea', 1.6);
  }
  // écran-visière
  const scr = () => {
    ctx.beginPath();
    for (let x = -37; x <= 13; x += 2.5) ctx.lineTo(x, yT(x) + 2.5);
    for (let x = 13; x >= -37; x -= 2.5) ctx.lineTo(x, yT(x) + 14);
    ctx.closePath();
  };
  scr(); paint(ctx, '#1d1830', 2.4);
  // yeux LED fâchés
  clipTo(ctx, scr, () => {
    for (const [x, inner] of [[-24, 1], [0, -1]]) {
      const c = yT(x) + 8.5;
      glow(ctx, x, c, 15, red, 0.9);
      const pts = inner > 0
        ? [[x - 8, c - 4.5], [x + 8, c], [x + 7, c + 4], [x - 7.5, c + 4]]
        : [[x + 8, c - 4.5], [x - 8, c], [x - 7, c + 4], [x + 7.5, c + 4]];
      poly(ctx, pts); ctx.fillStyle = '#ff3d4f'; ctx.fill();
      poly(ctx, pts.map(([px, py]) => [x + (px - x) * 0.55, c + 1 + (py - c - 1) * 0.45])); ctx.fillStyle = '#ffe3e6'; ctx.fill();
    }
    ctx.fillStyle = rgba('#ffffff', 0.08); for (let y = -36; y < -10; y += 2.4) ctx.fillRect(-40, y, 56, 0.9);
  });
  scr(); paint(ctx, null, 2.4);
  // dessus
  ell(ctx, 0, ty, rx, ry);
  paint(ctx, ball(ctx, -6, ty - 2, rx, shade(shell, 0.1), 0.4, 0.2), LW);
  ell(ctx, 3, ty + 0.5, rx - 9, ry - 3);
  paint(ctx, ball(ctx, -8, ty - 4, rx - 6, top, 0.35, 0.25), 2.5);
  gloss(ctx, -14, ty - 3, 12, 2.2, 0.45, -0.05);
  // bouton
  ell(ctx, 10, ty - 1, 6, 2.6); paint(ctx, '#2a2346', 2);
  glow(ctx, 10, ty - 1.5, 7, red, f ? 0.9 : 0.6);
  ell(ctx, 10, ty - 1.2, 2.8, 1.3); ctx.fillStyle = '#ffd0d4'; ctx.fill();
  // antenne
  const ax = 22, ay = -47;
  limb(ctx, [[ax, ay], [ax + 3 + s, ay - 9], [ax + 7 + s * 2, ay - 15]], 2.6, 2, '#9aa0bf', 2);
  glow(ctx, ax + 7 + s * 2, ay - 16, 11, red, 0.9);
  ell(ctx, ax + 7 + s * 2, ay - 16.5, 4.3, 4.3); paint(ctx, ball(ctx, ax + 7 + s * 2, ay - 16.5, 4.5, red, 0.5, 0.2), 2);
  gloss(ctx, ax + 5.8 + s * 2, ay - 18, 1.4, 1, 0.9);
  ctx.restore();
}

// =====================================================================
//  4. Concombre maléfique
// =====================================================================
function drawCucumber(ctx, f) {
  const green = '#3fb44a', dark = '#1f6b2d';
  const s = f ? 1 : -1, b = f ? -1.5 : 0;
  // pieds
  for (const [x, dx] of [[-8, 3 * s], [8, -3 * s]]) {
    limb(ctx, [[x, -10], [x + dx * 0.5, -4]], 4.5, 4.5, dark, 2.2);
    ell(ctx, x - 3 + dx, -3, 6.5, 3.4); paint(ctx, ball(ctx, x - 3 + dx, -4, 6, '#2d8a3a', 0.3, 0.2), 2.5);
  }
  ctx.save(); ctx.translate(0, b);
  // bras arrière
  limb(ctx, [[16, -44], [24, -50], [27, -57 - s]], 4.4, 3.8, '#2f9a3c', 2.2);
  ell(ctx, 27.5, -59 - s, 3.8, 3.8); paint(ctx, ball(ctx, 27.5, -60 - s, 4, '#3fb44a'), 2.2);
  // corps
  const body = () => smooth(ctx, [[-6, -96], [7, -92], [16, -76], [19, -52], [18, -27], [12, -11], [0, -7], [-12, -10], [-18, -25], [-20, -52], [-19, -76], [-15, -90]]);
  form(ctx, body, green, -6, -60, 40, { light: 0.35, dark: 0.25 });
  clipTo(ctx, body, () => {
    // rayures
    ctx.strokeStyle = rgba('#b9f07a', 0.35); ctx.lineWidth = 3.5;
    for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x - 1, -96); ctx.quadraticCurveTo(x + 2, -50, x * 0.8, -6); ctx.stroke(); }
    // bosses
    const rnd = seeded(7);
    for (let i = 0; i < 16; i++) {
      const x = -16 + rnd() * 32, y = -92 + rnd() * 82;
      if (y > -78 && y < -38 && x < 12) continue; // visage
      ell(ctx, x, y, 1.9, 1.6); ctx.fillStyle = rgba(dark, 0.75); ctx.fill();
      ell(ctx, x - 0.5, y - 0.6, 0.8, 0.6); ctx.fillStyle = rgba('#e8ffc0', 0.8); ctx.fill();
    }
    ell(ctx, 6, -26, 14, 18); fillA(ctx, '#d6f78f', 0.22);
  });
  // tige
  limb(ctx, [[-6, -94], [-5, -100], [-1, -103]], 5, 3.5, '#8a6a2e', 2.2);
  ctx.save(); ctx.strokeStyle = '#2d8a3a'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-4, -99); ctx.bezierCurveTo(4, -104, 10, -99, 6, -96); ctx.bezierCurveTo(3, -94, 2, -98, 5, -98.5); ctx.stroke(); ctx.restore();
  gloss(ctx, -12, -78, 3, 9, 0.45, 0.1);
  // yeux + sourcils
  eye(ctx, -11, -64, 6.2, 7.5, { lid: green, inner: 1, anger: 0.5, iris: '#c0261f' });
  eye(ctx, 5, -65, 7.4, 9, { lid: shade(green, -0.05), inner: -1, anger: 0.5, iris: '#c0261f' });
  brow(ctx, -19, -76, -7, -70, 4.5, dark);
  brow(ctx, 13, -79, -1, -72, 5, dark);
  // bouche diabolique
  const mouth = () => smooth(ctx, [[-16, -50], [-6, -48], [6, -49], [13, -52], [10, -44], [0, -39], [-10, -41]]);
  mouth(); paint(ctx, '#6e1730', 2.5);
  clipTo(ctx, mouth, () => {
    ell(ctx, 0, -38, 8, 4.5); ctx.fillStyle = '#ff6d8a'; ctx.fill();
    ctx.fillStyle = '#fffbea';
    for (let i = 0; i < 5; i++) { const x = -14 + i * 6; poly(ctx, [[x, -52], [x + 5, -52], [x + 2.5, -46 + (i % 2)]]); ctx.fill(); }
  });
  mouth(); paint(ctx, null, 2.5);
  blush(ctx, -15, -53, 3.5, 2, '#ff5d8f', 0.3);
  ctx.restore();
  // bras avant
  ctx.save(); ctx.translate(0, b);
  limb(ctx, [[-17, -40], [-25, -36 + s], [-30, -38 + s]], 4.6, 4, '#3aa847', 2.2);
  ell(ctx, -31.5, -38.5 + s, 3.8, 3.8); paint(ctx, ball(ctx, -31.5, -39, 4, '#3fb44a'), 2.2);
  ctx.restore();
}

// =====================================================================
//  5. Pigeon pirate
// =====================================================================
function drawPigeon(ctx, f) {
  const gray = '#9ca6c4', wing = '#7f88a8', neck = '#4fc49b', neck2 = '#a072e0', foot = '#ff7f86';
  const s = f ? 1 : -1, b = f ? -1.5 : 0;
  // pattes
  for (const [x, dx, c] of [[6, -3 * s, shade(foot, -0.15)], [-5, 3 * s, foot]]) {
    limb(ctx, [[x, -14], [x + dx * 0.5, -6], [x + dx, -2]], 3.2, 3, c, 2);
    for (const a of [-0.9, 0, 0.9]) {
      limb(ctx, [[x + dx, -2], [x + dx - 6 * Math.cos(a) + 1, -1.2 + Math.sin(a) * 0.3]], 2.6, 2.2, c, 1.6);
    }
  }
  ctx.save(); ctx.translate(0, b);
  // queue
  for (const [dy, c] of [[-4, shade(wing, -0.15)], [2, wing], [7, shade(wing, -0.1)]]) {
    smooth(ctx, [[16, -26 + dy * 0.3], [34, -24 + dy], [41, -20 + dy * 1.2], [36, -16 + dy], [16, -18 + dy * 0.3]]);
    paint(ctx, c, 2.5);
  }
  limb(ctx, [[36, -22], [40, -16]], 3, 3, OUT, 0);
  const body = () => smooth(ctx, [[-19, -36], [-14, -20], [0, -12], [16, -15], [27, -24], [22, -36], [8, -44], [-8, -46]]);
  form(ctx, body, gray, 2, -30, 26);
  clipTo(ctx, body, () => { ell(ctx, -10, -24, 10, 10); fillA(ctx, '#ffffff', 0.25); });
  // aile
  const w = () => smooth(ctx, [[-2, -36], [12, -40], [26, -32], [30, -22], [14, -21], [0, -27]]);
  form(ctx, w, wing, 12, -32, 18, { lw: 2.5 });
  clipTo(ctx, w, () => {
    ctx.strokeStyle = '#2b2440'; ctx.lineWidth = 3;
    for (const x of [14, 21]) { ctx.beginPath(); ctx.moveTo(x - 3, -40); ctx.quadraticCurveTo(x + 2, -30, x - 1, -20); ctx.stroke(); }
  });
  ctx.restore();
  ctx.save(); ctx.translate(0, b * 1.5);
  // cou irisé
  const neckP = () => smooth(ctx, [[-22, -46], [-14, -56], [0, -54], [4, -42], [-6, -34], [-18, -36]]);
  neckP();
  const ng = ctx.createLinearGradient(-20, -54, 4, -36);
  ng.addColorStop(0, neck); ng.addColorStop(0.5, neck2); ng.addColorStop(1, shade(gray, -0.1));
  paint(ctx, ng, 2.5);
  // tête
  const head = () => smooth(ctx, [[-27, -58], [-22, -69], [-10, -74], [2, -70], [7, -58], [2, -47], [-10, -43], [-22, -47]]);
  form(ctx, head, gray, -10, -58, 18);
  // bec
  const beak = () => smooth(ctx, [[-25, -61], [-34, -59], [-40, -55], [-36, -52.5], [-26, -53]]);
  beak(); paint(ctx, vgrad(ctx, -61, -52, '#8a8ca6', 0.35, 0.25), 2.4);
  ctx.beginPath(); ctx.moveTo(-38, -55.5); ctx.lineTo(-27, -56); ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
  ell(ctx, -27, -60.5, 4, 2.8, -0.2); paint(ctx, '#f6f3ff', 1.8);
  // œil (le bon)
  eye(ctx, -5, -59, 7.4, 8.8, { lid: gray, inner: -1, anger: 0.6, iris: '#ff8a1f' });
  // cache-œil + lanière
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-23, -66); ctx.quadraticCurveTo(-12, -72, 6, -64); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15, -56); ctx.quadraticCurveTo(-6, -48, 6, -52); ctx.stroke();
  smooth(ctx, [[-23, -66], [-14, -66], [-13, -58], [-17, -54], [-22, -56]]);
  paint(ctx, ball(ctx, -18, -61, 6, '#4a2f3c', 0.35, 0.2), 2.2);
  ctx.save(); ctx.setLineDash([1.4, 1.4]); ctx.lineWidth = 0.9; ctx.strokeStyle = rgba('#d9b38a', 0.9);
  smooth(ctx, [[-21.5, -64.2], [-15, -64.2], [-14.6, -58.5], [-17.5, -56], [-20.6, -57.4]]); ctx.stroke(); ctx.restore();
  gloss(ctx, -19.5, -62.5, 1.6, 1.1, 0.45);
  blush(ctx, -2, -48, 3.8, 2.2, '#ff7da2', 0.38);
  // chapeau de pirate (tricorne)
  ctx.save(); ctx.translate(-8, -72); ctx.rotate(-0.14 + s * 0.03);
  const hat = () => smooth(ctx, [[-16, -2], [-11, -5], [-5, -12], [5, -12], [11, -5], [16, -2], [9, 1], [0, -1.5], [-9, 1]]);
  form(ctx, hat, '#3b2d52', 0, -5, 14, { lw: 2.5 });
  hat(); ctx.save(); ctx.clip(); ctx.strokeStyle = '#ffcc40'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-15, -1.5); ctx.quadraticCurveTo(0, -5.5, 15, -1.5); ctx.stroke(); ctx.restore();
  hat(); paint(ctx, null, 2.5);
  // mini tête de mort
  ell(ctx, 0, -7.2, 2.7, 2.4); ctx.fillStyle = '#fff'; ctx.fill();
  rr(ctx, -1.6, -5.6, 3.2, 2, 0.6); ctx.fill();
  ctx.fillStyle = OUT; ell(ctx, -0.95, -7.4, 0.75, 0.75); ctx.fill(); ell(ctx, 0.95, -7.4, 0.75, 0.75); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// =====================================================================
//  6. Crabe pinceur
// =====================================================================
function claw(ctx, x, y, rot, open, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const lower = () => smooth(ctx, [[3, -4], [9, -12], [11, -22], [14, -21], [15, -11], [10, -1]]);
  ctx.save(); ctx.translate(6, -4); ctx.rotate(open); ctx.translate(-6, 4);
  form(ctx, lower, shade(color, -0.05), 9, -12, 10, { lw: 2.5 });
  ctx.restore();
  const palm = () => smooth(ctx, [[-10, 6], [-11, -6], [-9, -18], [-5, -27], [0, -25], [-1, -15], [3, -8], [8, -6], [10, 4], [2, 10]]);
  form(ctx, palm, color, -2, -6, 15, { lw: 2.5 });
  gloss(ctx, -6, -6, 2, 6, 0.45, 0.1);
  for (const [px, py] of [[-4, -20], [5, 2]]) { ell(ctx, px, py, 1.4, 1.2); ctx.fillStyle = rgba('#ffffff', 0.6); ctx.fill(); }
  ctx.restore();
}
function drawCrab(ctx, f) {
  const red = '#f04a3a', redD = '#b8262a';
  const s = f ? 1 : -1, b = f ? -1 : 0;
  // pattes
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const up = ((i + (side > 0 ? 1 : 0)) % 2 ? s : -s) * 1.6;
      const x0 = side * (16 + i * 6), y0 = -18 + i * 2;
      const kx = side * (30 + i * 7), ky = -24 + i * 3 - up;
      const tx = side * (34 + i * 8), ty = -1 - Math.max(0, up);
      limb(ctx, [[x0, y0], [kx, ky], [tx, ty]], 6, 2.4, i === 1 ? red : redD, 2.5);
    }
  }
  ctx.save(); ctx.translate(0, b);
  // bras
  limb(ctx, [[-22, -28], [-34, -30], [-40, -40]], 7, 6, redD, 2.5);
  limb(ctx, [[22, -28], [34, -30], [40, -40]], 7, 6, redD, 2.5);
  // carapace
  const shell = () => smooth(ctx, [[-35, -24], [-30, -36], [-18, -43], [0, -45], [18, -43], [30, -36], [35, -24], [28, -13], [0, -9], [-28, -13]]);
  form(ctx, shell, red, -4, -30, 36);
  clipTo(ctx, shell, () => {
    ell(ctx, 0, -12, 30, 6); fillA(ctx, '#ffd0a8', 0.45);
    const rnd = seeded(3);
    for (let i = 0; i < 7; i++) { ell(ctx, -26 + rnd() * 52, -40 + rnd() * 8, 1.6 + rnd(), 1.3 + rnd()); fillA(ctx, '#ffb69a', 0.7); }
  });
  // petits pics sur le bord
  for (const x of [-33, 33]) { poly(ctx, [[x, -30], [x + Math.sign(x) * 5, -33], [x - Math.sign(x) * 1, -36]]); paint(ctx, red, 2); }
  // yeux pédonculés
  for (const [x, r, inner, h] of [[-11, 6.4, 1, 0], [7, 7.2, -1, 1]]) {
    limb(ctx, [[x + 1, -40], [x, -48 - h]], 4, 3.5, red, 2.2);
    eye(ctx, x, -55 - h, r, r * 1.1, { lid: red, inner, anger: 0.62 });
  }
  brow(ctx, -19, -64.5, -7, -61, 3.6);
  brow(ctx, 16, -67, 3, -63, 4);
  // bouche
  const m = () => smooth(ctx, [[-12, -24], [-4, -27], [4, -27], [10, -24], [4, -20], [-6, -20]]);
  m(); paint(ctx, '#6e1730', 2.2);
  clipTo(ctx, m, () => { ctx.fillStyle = '#fffbea'; for (let i = 0; i < 4; i++) { poly(ctx, [[-10 + i * 5, -27.5], [-6 + i * 5, -27.5], [-8 + i * 5, -23.5]]); ctx.fill(); } });
  m(); paint(ctx, null, 2.2);
  blush(ctx, -20, -26, 4, 2.4, '#ff8fb0', 0.45); blush(ctx, 18, -26, 4, 2.4, '#ff8fb0', 0.45);
  // pinces levées
  claw(ctx, -42, -44, -0.35, f ? 0.25 : 0.05, red);
  ctx.save(); ctx.scale(-1, 1); claw(ctx, -42, -44, -0.35, f ? 0.05 : 0.25, red); ctx.restore();
  ctx.restore();
}

// =====================================================================
//  7. Frelon (en vol)
// =====================================================================
function drawWasp(ctx, f) {
  const yel = '#ffc21a', blk = '#3a2840', legC = '#8a5a3c';
  const s = f ? 1 : -1, b = f ? -3 : 0;
  ctx.save(); ctx.translate(0, b);
  // ailes arrière
  const wingC = rgba('#d6f2ff', 0.55);
  const wingA = f ? -0.25 : 0.15;
  for (const [x, y, rx, ry, rot] of [[18, -104, 21, 8, -0.7 + wingA], [8, -108, 24, 9.5, -1.15 + wingA]]) {
    ctx.save(); ctx.translate(2, -92); ctx.rotate(wingA * 0.6); ctx.translate(-2, 92);
    ell(ctx, x, y, rx, ry, rot); paint(ctx, wingC, 2.2, rgba(OUT, 0.85));
    ctx.save(); ell(ctx, x, y, rx, ry, rot); ctx.clip();
    ctx.strokeStyle = rgba('#7fa8d8', 0.6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, -92); ctx.lineTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -92); ctx.lineTo(x + Math.cos(rot + 0.25) * rx * 0.8, y + Math.sin(rot + 0.25) * rx * 0.8); ctx.stroke();
    gloss(ctx, x - 3, y - 2, rx * 0.5, ry * 0.25, 0.5, rot);
    ctx.restore();
    ctx.restore();
  }
  // pattes pendantes
  for (const [x, dx] of [[-4, -4], [2, -2], [8, 1]]) {
    limb(ctx, [[x, -74], [x + dx - 2, -65], [x + dx + 1 + s, -57]], 3.6, 2.6, legC, 1.8);
  }
  // dard
  smooth(ctx, [[37.5, -59], [44.5, -63], [47, -54], [49.5, -46.5], [44, -52]]); paint(ctx, vgrad(ctx, -63, -46, '#e8e4f4', 0.3, 0.3), 2.2);
  // abdomen
  const abd = () => smooth(ctx, [[6, -88], [22, -90], [38, -80], [44, -64], [38, -56], [24, -62], [10, -72]]);
  form(ctx, abd, yel, 22, -78, 24);
  clipTo(ctx, abd, () => {
    ctx.fillStyle = blk;
    for (const t of [0.32, 0.58, 0.82]) {
      const cx = 6 + t * 38, cy = -88 + t * 30;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.65); rr(ctx, -40, -3, 80, 6.5, 2); ctx.fill(); ctx.restore();
    }
    ell(ctx, 18, -82, 12, 4, 0.5); fillA(ctx, '#ffffff', 0.25);
  });
  abd(); paint(ctx, null, LW);
  // thorax
  const th = () => ell(ctx, 3, -83, 12.5, 11.5);
  form(ctx, th, '#5b3a2e', 3, -83, 13);
  clipTo(ctx, th, () => { ell(ctx, 0, -86, 7, 4); fillA(ctx, yel, 0.6); });
  // tête
  const head = () => smooth(ctx, [[-36, -80], [-32, -95], [-20, -101], [-7, -97], [-3, -84], [-8, -71], [-22, -67], [-33, -71]]);
  form(ctx, head, yel, -20, -86, 20);
  clipTo(ctx, head, () => {
    smooth(ctx, [[-30, -94], [-20, -101], [-6, -98], [-4, -90], [-14, -93], [-24, -92]]);
    fillA(ctx, blk, 0.9);
  });
  head(); paint(ctx, null, LW);
  // antennes
  limb(ctx, [[-24, -99], [-30, -108], [-38, -112 + s]], 3, 2.4, legC, 1.8);
  limb(ctx, [[-14, -100], [-16, -110], [-22, -116 + s]], 3, 2.4, legC, 1.8);
  ell(ctx, -38.5, -112 + s, 2.6, 2.6); paint(ctx, yel, 1.8); ell(ctx, -22.5, -116 + s, 2.6, 2.6); paint(ctx, yel, 1.8);
  // yeux
  eye(ctx, -28, -84, 6, 7.6, { lid: yel, inner: 1, anger: 0.6, iris: '#d1213a' });
  eye(ctx, -13, -85, 7.6, 9, { lid: yel, inner: -1, anger: 0.6, iris: '#d1213a' });
  // mandibules
  limb(ctx, [[-30, -72], [-35, -69], [-34, -64.5]], 4, 2.2, legC, 1.8);
  limb(ctx, [[-24, -70], [-27, -65], [-25, -61.5]], 4, 2.2, legC, 1.8);
  blush(ctx, -10, -74, 3.5, 2, '#ff6a5a', 0.35);
  // ailes avant
  ctx.save(); ctx.translate(2, -92); ctx.rotate(wingA); ctx.translate(-2, 92);
  ell(ctx, 4, -112, 13, 6, -1.45); paint(ctx, rgba('#e8f8ff', 0.45), 2, rgba(OUT, 0.8));
  ctx.restore();
  ctx.restore();
}

// =====================================================================
//  8. Taupe mineuse
// =====================================================================
function drawMole(ctx, f) {
  const fur = '#7b6896', pink = '#ff9bb5', paw = '#ffb8c9';
  const s = f ? 1 : -1, b = f ? -1.5 : 0;
  // pieds
  ell(ctx, 8 - 3 * s, -3.5, 8, 4.2); paint(ctx, shade(paw, -0.15), 2.5);
  ctx.save(); ctx.translate(0, b);
  // queue
  limb(ctx, [[20, -14], [27, -15], [30, -19 + s]], 4, 3, pink, 2.2);
  // pioche sur l'épaule (derrière)
  ctx.save(); ctx.translate(16, -34); ctx.rotate(0.55 + s * 0.05);
  rr(ctx, -2.2, -36, 4.4, 44, 2); paint(ctx, vgrad(ctx, -36, 8, '#c27a3c', 0.25, 0.25), 2.2);
  smooth(ctx, [[-16, -29], [-8, -37], [0, -39], [8, -37], [16, -29], [7, -33], [0, -34], [-7, -33]]);
  paint(ctx, vgrad(ctx, -40, -29, '#cfd6e8', 0.4, 0.3), 2.4);
  rr(ctx, -3.4, -40, 6.8, 7, 2); paint(ctx, '#8a5a3c', 2);
  ctx.restore();
  // corps
  const body = () => smooth(ctx, [[-22, -40], [-12, -56], [6, -58], [20, -46], [24, -26], [16, -8], [0, -4], [-16, -7], [-24, -22]]);
  form(ctx, body, fur, -2, -34, 30);
  clipTo(ctx, body, () => { ell(ctx, -6, -18, 12, 13); fillA(ctx, '#d9cde8', 0.45); });
  ctx.restore();
  ell(ctx, -10 + 3 * s, -3.6, 8.5, 4.5); paint(ctx, ball(ctx, -10 + 3 * s, -5, 8.5, paw, 0.3, 0.2), 2.5);
  ctx.save(); ctx.translate(0, b * 1.3);
  // tête
  const head = () => smooth(ctx, [[-34, -50], [-26, -58], [-12, -66], [4, -66], [14, -56], [12, -44], [0, -38], [-16, -39], [-28, -43]]);
  form(ctx, head, fur, -10, -54, 24);
  clipTo(ctx, head, () => { ell(ctx, -24, -45, 10, 6, -0.2); fillA(ctx, '#e6d8f3', 0.4); });
  // casque
  const helm = () => smooth(ctx, [[-27, -60], [-22, -73], [-8, -81], [8, -78], [17, -67], [18, -60], [0, -62.5], [-16, -62]]);
  form(ctx, helm, '#ffc93a', -6, -72, 22, { lw: LW });
  clipTo(ctx, helm, () => { ctx.strokeStyle = rgba('#b27a10', 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -81); ctx.quadraticCurveTo(2, -72, 2, -62); ctx.stroke(); });
  smooth(ctx, [[-30, -60.5], [-10, -64], [12, -62], [21, -59], [18, -56.5], [0, -58.5], [-24, -57]]);
  paint(ctx, vgrad(ctx, -64, -56, '#f2a91f', 0.2, 0.2), 2.5);
  // lampe
  rr(ctx, -27, -74, 10, 9, 2.5); paint(ctx, vgrad(ctx, -74, -65, '#c9cfe4', 0.35, 0.3), 2.2);
  glow(ctx, -31, -69.5, f ? 26 : 22, '#fff27a', 0.75);
  ell(ctx, -27.5, -69.5, 3, 4.6); paint(ctx, '#fffbd0', 2, OUT);
  ell(ctx, -27.8, -70, 1.4, 2.2); ctx.fillStyle = '#ffffff'; ctx.fill();
  // yeux
  eye(ctx, -19, -52.5, 4.6, 5.6, { lid: fur, inner: 1, anger: 0.55 });
  eye(ctx, -7, -53.5, 5.6, 6.8, { lid: fur, inner: -1, anger: 0.55 });
  brow(ctx, -25, -59.5, -16, -56.5, 3.2);
  brow(ctx, 0, -61, -10, -57.5, 3.6);
  blush(ctx, -5, -44, 4, 2.4);
  // museau
  whiskers(ctx, -30, -46, -1, 11, 0.5);
  ell(ctx, -34, -48, 6, 5.2); paint(ctx, ball(ctx, -34, -49, 6, pink, 0.35, 0.25), 2.5);
  gloss(ctx, -36, -50, 2, 1.3, 0.8);
  ctx.beginPath(); ctx.moveTo(-28, -42); ctx.quadraticCurveTo(-24, -40, -20, -42.5); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  rr(ctx, -27, -42, 3, 3.6, 0.8); paint(ctx, '#fffbea', 1.5);
  ctx.restore();
  // main sur le manche de la pioche
  ctx.save(); ctx.translate(0, b);
  ell(ctx, 19, -40, 6, 5.6); paint(ctx, ball(ctx, 19, -41, 6, paw, 0.3, 0.2), 2.5);
  // grosses pattes à griffes (avant)
  const bigPaw = (px, py, r, rot) => {
    for (let i = 0; i < 3; i++) {
      const a = rot + (i - 1) * 0.42;
      const c = Math.cos(a), sn = Math.sin(a);
      const x0 = px + c * r * 0.6, y0 = py + sn * r * 0.6;
      limb(ctx, [[x0, y0], [x0 + c * 7 + sn * 1.5, y0 + sn * 7 - c * 1.5], [x0 + c * 11 + sn * 4.5, y0 + sn * 11 - c * 4.5]], 4.6, 1.2,
        vgrad(ctx, y0 - 6, y0 + 8, '#fff3dc', 0.3, 0.2), 1.8);
    }
    ell(ctx, px, py, r, r * 0.92); paint(ctx, ball(ctx, px, py, r, paw, 0.3, 0.2), 2.5);
    ell(ctx, px - r * 0.15, py + r * 0.1, r * 0.35, r * 0.3); fillA(ctx, '#ff7fa3', 0.6);
  };
  limb(ctx, [[-8, -22], [-16, -19]], 8, 8, shade(fur, -0.1), 2.5);
  bigPaw(-20, -19 + s * 0.5, 6.5, Math.PI + 0.45);
  limb(ctx, [[-8, -34], [-18, -33]], 8.5, 8.5, fur, 2.5);
  bigPaw(-24, -33 - s, 7.5, Math.PI + 0.15);
  ctx.restore();
}

// =====================================================================
//  9. Bonhomme de neige maléfique
// =====================================================================
function drawYeti(ctx, f) {
  const snow = '#f2f6ff', coal = '#2f2a3c', scarf = '#e8344e';
  const s = f ? 1 : -1, b = f ? -1.5 : 0;
  // tas de neige
  smooth(ctx, [[-34, -1], [-26, -8], [-10, -10], [14, -10], [30, -7], [36, -1]]);
  paint(ctx, vgrad(ctx, -10, 0, '#e6eefc', 0.4, 0.15), LW);
  // bras arrière
  ctx.save(); ctx.translate(0, b);
  limb(ctx, [[24, -52], [34, -62], [44 + s, -74 + s * 2]], 4.4, 2.6, '#9a6234', 2.4);
  limb(ctx, [[36, -64], [43, -64 + s]], 2.6, 2, '#9a6234', 2);
  limb(ctx, [[42, -71], [48, -76 + s]], 2.2, 1.6, '#9a6234', 1.8);
  ctx.restore();
  // corps
  const bodyB = () => ell(ctx, 1, -32, 30, 28);
  form(ctx, bodyB, snow, 1, -32, 32, { light: 0.5, sh: 0.18, fill: null });
  clipTo(ctx, bodyB, () => { ell(ctx, 18, -18, 18, 22); fillA(ctx, '#b9cbf2', 0.35); });
  for (const y of [-44, -30, -16]) { ell(ctx, -16 + (y + 30) * 0.12, y, 3.2, 3); paint(ctx, ball(ctx, -16, y, 3, coal, 0.3, 0.2), 1.8); }
  ctx.save(); ctx.translate(0, b);
  // tête
  const head = () => ell(ctx, -3, -79, 23, 22);
  form(ctx, head, snow, -3, -79, 24, { light: 0.5, sh: 0.18 });
  clipTo(ctx, head, () => { ell(ctx, 12, -70, 14, 16); fillA(ctx, '#b9cbf2', 0.35); });
  // écharpe
  limb(ctx, [[12, -62], [16, -52], [22 + s * 2, -40], [20 + s * 3, -33]], 9, 8, vgrad(ctx, -62, -30, scarf, 0.2, 0.2), 2.5);
  const sc = () => smooth(ctx, [[-22, -63], [-8, -57], [8, -57], [18, -63], [17, -55], [4, -51], [-10, -51], [-22, -56]]);
  sc(); paint(ctx, vgrad(ctx, -63, -51, scarf, 0.25, 0.2), 2.5);
  clipTo(ctx, sc, () => { ctx.fillStyle = '#ffffff'; for (const x of [-14, -2, 10]) { ctx.save(); ctx.translate(x, -57); ctx.rotate(0.2); ctx.fillRect(-1.6, -8, 3.2, 16); ctx.restore(); } });
  sc(); paint(ctx, null, 2.5);
  // dents de charbon (sourire mauvais)
  for (let i = 0; i < 7; i++) {
    const t = i / 6, x = -20 + t * 26, y = -69.5 + Math.sin(t * Math.PI) * 4 - t * 2;
    rr(ctx, x - 1.9, y - 1.9, 3.8, 3.8, 1.2); paint(ctx, ball(ctx, x, y, 3, coal, 0.35, 0.2), 1.4);
  }
  // yeux de charbon
  eye(ctx, -16, -86, 5.8, 7, { lid: snow, inner: 1, anger: 0.55, iris: '#2b2240', pr: 0.8 });
  eye(ctx, 1, -87, 7, 8.4, { lid: snow, inner: -1, anger: 0.55, iris: '#2b2240', pr: 0.8 });
  brow(ctx, -24, -96, -12, -91, 4.2, '#4a3a5a');
  brow(ctx, 10, -99, -4, -93, 4.8, '#4a3a5a');
  blush(ctx, 9, -74, 4.5, 2.6, '#ff8fb0', 0.35); blush(ctx, -22, -75, 3, 2, '#ff8fb0', 0.3);
  // carotte
  limb(ctx, [[-12, -78], [-24, -76], [-38, -73]], 8, 1.5, ball(ctx, -18, -79, 14, '#ff8a24', 0.3, 0.25), 2.4);
  ctx.strokeStyle = rgba('#b4520e', 0.8); ctx.lineWidth = 1.2;
  for (const x of [-20, -26]) { ctx.beginPath(); ctx.moveTo(x, -79); ctx.lineTo(x - 1, -75.5); ctx.stroke(); }
  // bras avant (brindille)
  limb(ctx, [[-24, -48], [-34, -55], [-46, -60 - s * 2]], 4.4, 2.6, '#b0743f', 2.4);
  limb(ctx, [[-34, -55], [-38, -64 - s]], 2.6, 1.8, '#b0743f', 2);
  limb(ctx, [[-44, -59 - s * 2], [-50, -56 - s * 2]], 2.2, 1.6, '#b0743f', 1.8);
  ctx.restore();
  // flocons
  sparkle(ctx, -30, -96, 3, '#bfe3ff', 0.9); sparkle(ctx, 24, -96, 2.4, '#bfe3ff', 0.8);
}

// =====================================================================
//  10. Toutou-Tron (chien cybernétique)
// =====================================================================
function drawRobodog(ctx, f) {
  const metal = '#9eb0d2', dark = '#4a5478', cyan = '#33eeff', pinkN = '#ff4fd8';
  const s = f ? 1 : -1, b = f ? -1.2 : 0;
  // queue antenne
  limb(ctx, [[36, -44 + b], [42, -54 + b], [46, -62 + b + s]], 3, 2.4, dark, 2);
  glow(ctx, 46, -63 + b + s, 9, cyan, 0.9);
  ell(ctx, 46, -63 + b + s, 3, 3); paint(ctx, '#bffaff', 1.8);
  // pattes
  const pleg = (x, top, c, lean) => {
    rr(ctx, x - 5, top, 10, 12, 4); paint(ctx, vgrad(ctx, top, top + 12, c, 0.3, 0.2), 2.5);
    rr(ctx, x - 3 + lean * 0.4, top + 10, 6, -top - 14, 2); paint(ctx, '#5c6688', 2.2);
    rr(ctx, x - 7 + lean, -7, 13, 7, 3); paint(ctx, vgrad(ctx, -7, 0, c, 0.3, 0.25), 2.5);
    ctx.fillStyle = cyan; ctx.fillRect(x - 5 + lean, -4, 9, 1.4);
  };
  pleg(31 + 3 * s, -28, shade(metal, -0.2), 0);
  pleg(-5 - 3 * s, -28, shade(metal, -0.2), 0);
  ctx.save(); ctx.translate(0, b);
  const body = () => rr(ctx, -18, -56, 56, 34, 13);
  form(ctx, body, metal, 10, -42, 32);
  clipTo(ctx, body, () => {
    ctx.strokeStyle = rgba('#4a5478', 0.6); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, -56); ctx.lineTo(8, -22); ctx.moveTo(-18, -38); ctx.lineTo(38, -38); ctx.stroke();
    // bande néon
    glow(ctx, 10, -30, 30, pinkN, 0.25);
    ctx.fillStyle = pinkN; rr(ctx, -16, -31, 54, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#ffd0f4'; rr(ctx, -16, -30.5, 54, 1, 0.5); ctx.fill();
  });
  for (const [x, y] of [[-12, -51], [2, -51], [14, -51], [30, -51], [30, -26], [-12, -26]]) { ell(ctx, x, y, 1.6, 1.6); paint(ctx, '#e4ebfa', 1); }
  // panneau batterie
  rr(ctx, 16, -50, 14, 9, 2); paint(ctx, '#2a2d4a', 2);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < (f ? 3 : 2) ? '#5dff8a' : '#2f5a40'; ctx.fillRect(18.5 + i * 3.8, -47.5, 2.8, 4); }
  ctx.restore();
  pleg(24 - 3 * s, -26, metal, 0);
  pleg(-14 + 3 * s, -26, metal, -1);
  ctx.save(); ctx.translate(0, b * 1.3);
  // cou
  rr(ctx, -12, -58, 12, 14, 4); paint(ctx, '#3d4466', 2.2);
  // oreilles
  poly(ctx, [[-4, -72], [4, -90], [8, -70]]); paint(ctx, vgrad(ctx, -90, -70, shade(metal, -0.15), 0.3, 0.2), 2.5);
  glow(ctx, 4, -89, 8, f ? '#ff3355' : cyan, 0.9);
  ell(ctx, 4, -88, 2, 2); ctx.fillStyle = f ? '#ffb3c0' : '#c9fbff'; ctx.fill();
  // tête
  const head = () => smooth(ctx, [[-50, -56], [-48, -68], [-36, -76], [-14, -78], [2, -72], [6, -58], [0, -46], [-16, -42], [-40, -42], [-50, -48]]);
  form(ctx, head, metal, -22, -62, 30);
  clipTo(ctx, head, () => {
    ctx.strokeStyle = rgba('#4a5478', 0.55); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-14, -78); ctx.quadraticCurveTo(-8, -60, -18, -42); ctx.stroke();
  });
  poly(ctx, [[-36, -74], [-44, -91], [-26, -77]]); paint(ctx, vgrad(ctx, -90, -74, metal, 0.3, 0.2), 2.5);
  poly(ctx, [[-36, -77], [-41, -86], [-31, -78]]); ctx.fillStyle = pinkN; ctx.fill();
  // mâchoire
  const jaw = () => smooth(ctx, [[-52, -50], [-40, -50], [-22, -50], [-20, -44], [-30, -37], [-48, -39]]);
  jaw(); paint(ctx, '#2a2d4a', 2.5);
  clipTo(ctx, jaw, () => { ctx.fillStyle = '#e6ecff'; for (let i = 0; i < 5; i++) { poly(ctx, [[-50 + i * 6, -50.5], [-45 + i * 6, -50.5], [-47.5 + i * 6, -45.5]]); ctx.fill(); } glow(ctx, -36, -40, 10, '#ff3355', 0.6); });
  jaw(); paint(ctx, null, 2.5);
  ell(ctx, -50, -60, 4.6, 3.6); paint(ctx, ball(ctx, -50, -61, 5, '#2a2d4a', 0.3, 0.2), 2);
  gloss(ctx, -51.5, -61.5, 1.5, 0.9, 0.7);
  // visière lumineuse
  glow(ctx, -26, -64, 28, cyan, 0.45);
  const vis = () => smooth(ctx, [[-48, -66], [-38, -72], [-14, -73], [0, -68], [-2, -60], [-16, -58], [-38, -58], [-48, -61]]);
  vis(); paint(ctx, '#162039', 2.5);
  clipTo(ctx, vis, () => {
    const g = ctx.createLinearGradient(0, -73, 0, -58);
    g.addColorStop(0, rgba(cyan, 0.15)); g.addColorStop(1, rgba(cyan, 0.45));
    ctx.fillStyle = g; ctx.fillRect(-50, -75, 52, 18);
    for (const [x, inner, w] of [[-36, 1, 7], [-17, -1, 9]]) {
      const pts = inner > 0 ? [[x - w, -68], [x + w, -64], [x + w * 0.8, -60.5], [x - w * 0.9, -61.5]] : [[x + w, -69], [x - w, -64.5], [x - w * 0.8, -60.5], [x + w * 0.9, -61.5]];
      glow(ctx, x, -63, 12, cyan, 0.9);
      poly(ctx, pts); ctx.fillStyle = cyan; ctx.fill();
      poly(ctx, pts.map(([px, py]) => [x + (px - x) * 0.55, -63 + (py + 63) * 0.45])); ctx.fillStyle = '#eaffff'; ctx.fill();
    }
    ctx.fillStyle = rgba('#ffffff', 0.12); for (let y = -72; y < -58; y += 2.5) ctx.fillRect(-50, y, 52, 0.8);
  });
  vis(); paint(ctx, null, 2.5);
  gloss(ctx, -36, -70, 7, 1.5, 0.5, -0.1);
  ctx.restore();
}

// =====================================================================
//  11. Gloop de lave
// =====================================================================
function drawSlime(ctx, f) {
  const sy = f ? 0.94 : 1, sx = f ? 1.05 : 1;
  ctx.save(); ctx.translate(0, -28); ctx.scale(1.2, 0.62); glow(ctx, 0, 0, 46, '#ff6a1a', 0.32); ctx.restore();
  ctx.save(); ctx.translate(0, -30); glow(ctx, 0, 0, 40, '#ff6a1a', 0.18); ctx.restore();
  // flaque de lave
  smooth(ctx, [[-44, -2], [-36, -6], [-10, -7], [20, -7], [42, -5], [47, -1], [30, 2.5], [0, 3], [-30, 2.5]]);
  paint(ctx, vgrad(ctx, -7, 3, '#ff7a1f', 0.35, 0.3), 2.5);
  ell(ctx, -6, -3, 26, 1.8); fillA(ctx, '#ffe066', 0.75);
  ctx.save(); ctx.scale(sx, sy);
  const body = () => smooth(ctx, [
    [-36, -3], [-39, -15], [-34, -31], [-22, -45], [-11, -55], [-8, -63], [-12, -70], [-3, -69], [5, -61],
    [18, -52], [30, -40], [37, -24], [39, -9], [36, -3], [22, -1], [8, -3], [-6, -1], [-22, -2],
  ]);
  body();
  const g = ctx.createRadialGradient(-2, -22, 2, 0, -26, 48);
  g.addColorStop(0, '#fff7c0'); g.addColorStop(0.22, '#ffd447'); g.addColorStop(0.5, '#ff8a22'); g.addColorStop(0.8, '#ee4520'); g.addColorStop(1, '#b3221e');
  ctx.fillStyle = g; ctx.fill();
  clipTo(ctx, body, () => {
    glow(ctx, -1, -22, 26, '#fff7c0', 0.75);
    // bord plus sombre (lave qui refroidit)
    body(); ctx.lineWidth = 9; ctx.strokeStyle = rgba('#8a1a1c', 0.35); ctx.stroke();
    // fissures sombres (veines de croûte) avec liseré lumineux
    const cracks = [
      [3.2, [[-37, -10], [-30, -14], [-31, -22], [-24, -27]]], [2, [[-30, -14], [-23, -12]]],
      [3.2, [[37, -12], [30, -17], [33, -25], [27, -32]]], [2, [[30, -17], [22, -16]]],
      [2.8, [[-27, -38], [-20, -40], [-18, -47]]], [2.4, [[22, -45], [15, -44], [12, -50]]],
      [2.2, [[-6, -60], [0, -56], [-1, -51]]],
    ];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, pts] of cracks) { ctx.lineWidth = w + 2.4; ctx.strokeStyle = rgba('#ffe27a', 0.55); poly(ctx, pts, false); ctx.stroke(); }
    for (const [w, pts] of cracks) { ctx.lineWidth = w; ctx.strokeStyle = '#4a1424'; poly(ctx, pts, false); ctx.stroke(); }
    // bulles de lave en fusion
    for (const [x, y, r] of [[-26, -18, 2.6], [24, -24, 2], [18, -36, 1.4], [-22, -31, 1.3], [8, -8, 1.8]]) {
      ell(ctx, x, y, r, r); ctx.lineWidth = 1.1; ctx.strokeStyle = rgba('#fff3b0', 0.9); ctx.stroke();
      gloss(ctx, x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.25, 0.9, 0);
    }
    // ombre propre en bas à droite
    ell(ctx, 32, -8, 22, 22); fillA(ctx, '#8a1418', 0.28);
    ell(ctx, -6, -1, 34, 5); fillA(ctx, '#8a1418', 0.25);
  });
  body(); paint(ctx, null, LW);
  // reflets brillants (liquide)
  gloss(ctx, -24, -38, 5, 2.4, 0.55, -0.8);
  gloss(ctx, -30, -28, 1.6, 1.3, 0.6);
  gloss(ctx, -6, -66, 2, 1.3, 0.5, -0.3);
  // yeux
  eye(ctx, -14, -32, 7.6, 8.8, { lid: '#e8521f', inner: 1, anger: 0.58, iris: '#ff5a1f' });
  eye(ctx, 6, -33, 8.6, 9.8, { lid: '#e8521f', inner: -1, anger: 0.58, iris: '#ff5a1f' });
  // bouche
  const m = () => smooth(ctx, [[-14, -19], [-4, -16], [8, -17], [14, -20], [8, -11], [-6, -10]]);
  m(); paint(ctx, '#5a1520', 2.5);
  clipTo(ctx, m, () => {
    glow(ctx, 0, -10, 10, '#ffd040', 0.9);
    ctx.fillStyle = '#fffbea'; poly(ctx, [[-10, -19], [-6, -19], [-8, -14]]); ctx.fill(); poly(ctx, [[6, -18], [10, -18.5], [8, -13.5]]); ctx.fill();
  });
  m(); paint(ctx, null, 2.5);
  ctx.restore();
  // bulles / braises
  const by = f ? -4 : 0;
  for (const [x, y, r] of [[-20, -66 + by, 3], [14, -74 + by * 2, 2.2], [24, -62 + by, 1.6]]) {
    glow(ctx, x, y, r * 3.2, '#ffb040', 0.6);
    ell(ctx, x, y, r, r); paint(ctx, '#ffd060', 1.4, '#c43a1a');
  }
}

// =====================================================================
//  12. Souris martienne (soucoupe)
// =====================================================================
function drawUfo(ctx, f) {
  const green = '#7fe05c', pink = '#ff9dc4', metal = '#bfc6e4';
  const b = f ? -2.5 : 0;
  // rayon tracteur
  ctx.save();
  const beam = ctx.createLinearGradient(0, -26, 0, 0);
  beam.addColorStop(0, rgba('#b6ff7a', 0.5)); beam.addColorStop(1, rgba('#b6ff7a', 0));
  ctx.fillStyle = beam;
  poly(ctx, [[-14, -26 + b], [14, -26 + b], [24, 0], [-24, 0]]); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(0, b);
  // dessous
  ell(ctx, 0, -30, 26, 8); paint(ctx, ball(ctx, 0, -30, 26, '#5b5f88', 0.3, 0.2), 2.5);
  glow(ctx, 0, -26, 16, '#b6ff7a', 0.8);
  ell(ctx, 0, -25.5, 8, 2.6); ctx.fillStyle = '#eaffd0'; ctx.fill();
  // soucoupe
  const disc = () => ell(ctx, 0, -38, 48, 12.5);
  disc();
  const g = ctx.createLinearGradient(0, -50, 0, -26);
  g.addColorStop(0, shade(metal, 0.5)); g.addColorStop(0.5, metal); g.addColorStop(0.52, shade(metal, -0.2)); g.addColorStop(1, shade(metal, -0.38));
  paint(ctx, g, LW);
  gloss(ctx, -22, -44, 12, 2.4, 0.5, -0.08);
  // souris dans le dôme
  const DY = -44, DRX = 27, DRY = 37;
  const dome = () => { ctx.beginPath(); ctx.ellipse(0, DY, DRX, DRY, 0, Math.PI, 0, false); ctx.closePath(); };
  dome();
  const inner = ctx.createLinearGradient(0, DY - DRY, 0, DY);
  inner.addColorStop(0, rgba('#d9f6ff', 0.55)); inner.addColorStop(1, rgba('#7fc8ff', 0.5));
  ctx.fillStyle = inner; ctx.fill();
  clipTo(ctx, dome, () => {
    // corps
    ell(ctx, 3, -44, 15, 10); paint(ctx, ball(ctx, 3, -48, 15, green, 0.3, 0.25), 2.5);
    ear(ctx, -15, -70, 9, green, pink, -0.35);
    ear(ctx, 14, -71, 9.5, green, pink, 0.35);
    const head = () => smooth(ctx, [[-23, -54], [-17, -65], [-3, -70], [11, -66], [16, -55], [10, -46], [-6, -44], [-18, -47]]);
    form(ctx, head, green, -3, -57, 18, { lw: 2.6 });
    eye(ctx, -11, -57, 5.4, 6.6, { lid: green, inner: 1, anger: 0.55, iris: '#c82dd6' });
    eye(ctx, 3, -58, 6.4, 7.6, { lid: green, inner: -1, anger: 0.55, iris: '#c82dd6' });
    ell(ctx, -23.5, -52, 3, 2.6); paint(ctx, ball(ctx, -23.5, -53, 3, '#ff6f96'), 1.8);
    ctx.beginPath(); ctx.moveTo(-19, -48.5); ctx.quadraticCurveTo(-15, -47, -11, -49.5); ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
    blush(ctx, 6, -49, 3.4, 2, '#ff5d8f', 0.45);
    // antennes
    limb(ctx, [[-6, -69], [-9, -75], [-11, -77]], 2, 1.6, shade(green, -0.2), 1.4);
    ell(ctx, -11.5, -78, 2.4, 2.4); paint(ctx, '#ffe95a', 1.4);
    limb(ctx, [[2, -69], [3, -76]], 2, 1.6, shade(green, -0.2), 1.4);
    ell(ctx, 3, -77.5, 2.4, 2.4); paint(ctx, '#ffe95a', 1.4);
    // pattes sur le tableau de bord
    ell(ctx, -12, -45, 3.8, 3); paint(ctx, pink, 2);
    ell(ctx, 15, -45, 3.8, 3); paint(ctx, pink, 2);
  });
  // verre
  dome();
  const dg = ctx.createLinearGradient(-DRX, DY - DRY, DRX, DY);
  dg.addColorStop(0, rgba('#ffffff', 0.3)); dg.addColorStop(0.45, rgba('#bff0ff', 0.04)); dg.addColorStop(1, rgba('#6fb8ff', 0.25));
  paint(ctx, dg, LW);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, DY, DRX - 6, DRY - 6, 0, Math.PI * 1.1, Math.PI * 1.42); ctx.lineWidth = 3.2; ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.stroke(); ctx.restore();
  gloss(ctx, -4, DY - DRY + 4, 2.2, 1.4, 0.85);
  // bague métallique
  ctx.beginPath(); ctx.ellipse(0, -44, 27, 5, 0, 0, Math.PI, false); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#8e95bc'; ctx.stroke();
  // antenne du dôme
  limb(ctx, [[0, -81], [0, -88]], 2.4, 2.2, '#8e95bc', 1.8);
  glow(ctx, 0, -91, 9, '#ff4fd8', f ? 1 : 0.7);
  ell(ctx, 0, -91, 3.2, 3.2); paint(ctx, '#ff8be6', 1.8);
  // lumières
  const cols = ['#ffe95a', '#5ff3ff', '#ff6fd8'];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + i * 0.127);
    const x = Math.cos(a) * 40, y = -35 + Math.sin(a) * 6.5;
    const on = (i + f) % 2 === 0;
    const c = cols[i % 3];
    if (on) glow(ctx, x, y, 10, c, 0.95);
    ell(ctx, x, y, 3, 2.4); paint(ctx, on ? shade(c, 0.4) : shade(c, -0.35), 1.6);
  }
  ctx.restore();
}

// =====================================================================
//  13. Fantôme drap
// =====================================================================
function drawGhost(ctx, f) {
  const sheet = '#f4f1ff';
  const b = f ? -3 : 0, w = f ? 1 : -1;
  ctx.save(); ctx.translate(0, b - 12);
  const body = () => smooth(ctx, [
    [-6, -84], [10, -79], [20, -64], [22, -46], [30, -30], [42, -22], [50, -26 + w * 2], [46, -14], [34, -6],
    [24, -4 + w], [16, -8], [8, -2 - w], [-2, -8], [-12, -2 + w], [-20, -8], [-28, -4 - w], [-30, -18], [-28, -38],
    [-36, -46], [-31, -52], [-26, -48], [-24, -62], [-18, -77],
  ]);
  body();
  const g = ctx.createLinearGradient(-20, -84, 30, -4);
  g.addColorStop(0, rgba('#ffffff', 0.97)); g.addColorStop(0.5, rgba(sheet, 0.9)); g.addColorStop(1, rgba('#b7acec', 0.78));
  ctx.fillStyle = g; ctx.fill();
  clipTo(ctx, body, () => {
    ctx.strokeStyle = rgba('#9a8fd6', 0.4); ctx.lineWidth = 2.2;
    for (const [x0, y0, x1, y1] of [[4, -50, 10, -8], [16, -44, 26, -10], [-14, -36, -16, -6]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 4, (y0 + y1) / 2, x1, y1); ctx.stroke(); }
    ell(ctx, 18, -30, 18, 30, 0.3); fillA(ctx, '#a99be6', 0.18);
  });
  body(); paint(ctx, null, LW);
  gloss(ctx, -12, -72, 4, 7, 0.6, 0.5);
  // yeux (trous sombres)
  for (const [x, y, rx, ry, inner] of [[-17, -58, 5.6, 7.6, 1], [-2, -59, 7, 9, -1]]) {
    const path = () => ell(ctx, x, y, rx, ry);
    path(); ctx.fillStyle = ball(ctx, x, y, ry, '#3a2458', 0.25, 0.2); ctx.fill();
    clipTo(ctx, path, () => {
      glow(ctx, x - 1, y + 3, ry, '#b66bff', 0.6);
      const xo = x - inner * rx * 1.3, xi = x + inner * rx * 1.3;
      poly(ctx, [[xo, y - ry * 1.05], [xi, y - ry * 0.15], [xi, y - ry * 3], [xo, y - ry * 3]]); ctx.fillStyle = sheet; ctx.fill();
      ctx.beginPath(); ctx.moveTo(xo, y - ry * 1.05); ctx.lineTo(xi, y - ry * 0.15); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ell(ctx, x - rx * 0.35, y + ry * 0.05, rx * 0.28, ry * 0.2, -0.4); ctx.fillStyle = '#ffffff'; ctx.fill();
      ell(ctx, x + rx * 0.25, y + ry * 0.45, rx * 0.12, ry * 0.09); ctx.fill();
    });
    path(); paint(ctx, null, 2.5);
  }
  // bouche (grimace ondulée avec un croc)
  const m = () => smooth(ctx, [[-19, -44], [-13, -47], [-7, -45], [-1, -47.5], [4, -44.5], [0, -39.5], [-8, -38.5], [-16, -40]]);
  m(); paint(ctx, '#3a2458', 2.5);
  clipTo(ctx, m, () => {
    ell(ctx, -7, -37.5, 6, 3.2); ctx.fillStyle = '#c77bff'; ctx.fill();
    poly(ctx, [[-14, -47], [-10.5, -46.5], [-12.5, -42]]); ctx.fillStyle = '#ffffff'; ctx.fill();
  });
  m(); paint(ctx, null, 2.5);
  blush(ctx, 7, -49, 4, 2.4, '#ff8fc8', 0.45); blush(ctx, -25, -49, 3, 2, '#ff8fc8', 0.35);
  // menotte + chaîne qui pend du bras tendu
  ell(ctx, -32, -48, 4.4, 3.6, 0.5);
  paint(ctx, vgrad(ctx, -52, -44, '#9aa1c6', 0.45, 0.3), 2.2);
  const links = [[-33.5, -41.5], [-34.5, -35.5], [-35, -29.5 + w * 0.5], [-34.5, -23.5 + w]];
  links.forEach(([x, y], i) => {
    if (i % 2 === 0) {
      ell(ctx, x, y, 2.6, 3.8);
      ctx.lineWidth = 4.4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 1.9; ctx.strokeStyle = '#c3c9e6'; ctx.stroke();
    } else {
      rr(ctx, x - 1.3, y - 4, 2.6, 8, 1.3); paint(ctx, '#8e95bc', 1.8);
    }
  });
  ell(ctx, -34, -14 + w * 1.5, 5.8, 5.8); paint(ctx, ball(ctx, -34, -14 + w * 1.5, 5.8, '#5b5f88', 0.45, 0.25), 2.5);
  gloss(ctx, -36, -16 + w * 1.5, 1.7, 1.2, 0.75);
  ctx.restore();
}

// =====================================================================
//  14. Rat chevalier
// =====================================================================
function drawKnightRat(ctx, f) {
  const fur = '#a3a7c6', pink = '#ff9dbb', steel = '#cdd5ea', gold = '#ffc43d', plume = '#e8344e';
  const s = f ? 1 : -1, b = f ? -1.5 : 0;
  // queue
  limb(ctx, [[12, -18], [28, -12], [42, -18 + s], [48, -32], [42, -42 - s]], 6, 2.2, vgrad(ctx, -44, -10, pink, 0.2, 0.25), 2.5);
  // jambe arrière
  rr(ctx, 4 - 3 * s, -18, 9, 14, 3); paint(ctx, shade(steel, -0.25), 2.5);
  rr(ctx, 1 - 3 * s, -7, 13, 7, 3); paint(ctx, '#5b4a6e', 2.5);
  ctx.save(); ctx.translate(0, b);
  // épée (bras arrière, levée)
  ctx.save(); ctx.translate(16, -46); ctx.rotate(0.45 + s * 0.06);
  poly(ctx, [[-2.8, -6], [2.8, -6], [2.8, -36], [0, -42], [-2.8, -36]]);
  const bg = ctx.createLinearGradient(-3, 0, 3, 0); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#dfe6f7'); bg.addColorStop(1, '#9aa6c8');
  paint(ctx, bg, 2.4);
  ctx.strokeStyle = rgba('#8fa0c8', 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -35); ctx.stroke();
  rr(ctx, -8, -8, 16, 4, 2); paint(ctx, gold, 2.2);
  rr(ctx, -2, -4, 4, 8, 1.5); paint(ctx, '#7a4a28', 2);
  ell(ctx, 0, 5.5, 2.6, 2.6); paint(ctx, gold, 1.8);
  ctx.restore();
  ell(ctx, 16, -44, 5.2, 5.2); paint(ctx, ball(ctx, 16, -45, 5, steel, 0.4, 0.3), 2.5);
  // corps + plastron
  const body = () => smooth(ctx, [[-15, -36], [-6, -46], [10, -46], [19, -32], [16, -12], [2, -6], [-12, -10], [-18, -22]]);
  form(ctx, body, steel, -3, -30, 22, { light: 0.45, sh: 0.25 });
  clipTo(ctx, body, () => {
    ctx.strokeStyle = gold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -14); ctx.quadraticCurveTo(0, -8, 20, -14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -46); ctx.lineTo(1, -12); ctx.lineWidth = 1.4; ctx.strokeStyle = rgba('#7c88aa', 0.7); ctx.stroke();
    gloss(ctx, -8, -34, 3, 8, 0.6, 0.2);
    rr(ctx, -20, -22, 42, 5, 1); ctx.fillStyle = '#6a4a3a'; ctx.fill();
    rr(ctx, -2, -23, 7, 7, 1.5); ctx.fillStyle = gold; ctx.fill();
  });
  body(); paint(ctx, null, LW);
  ctx.restore();
  // jambe avant
  rr(ctx, -10 + 3 * s, -18, 9, 14, 3); paint(ctx, vgrad(ctx, -18, -4, steel, 0.3, 0.25), 2.5);
  rr(ctx, -15 + 3 * s, -7, 14, 7, 3); paint(ctx, vgrad(ctx, -7, 0, '#6e5a84', 0.3, 0.2), 2.5);
  ctx.save(); ctx.translate(0, b * 1.4);
  // oreilles
  ear(ctx, 15, -76, 10.5, fur, pink, 0.4);
  ear(ctx, -15, -79, 11, fur, pink, -0.4);
  // tête
  const head = () => smooth(ctx, [[-36, -55], [-29, -63], [-17, -70], [-2, -72], [11, -66], [14, -55], [9, -45], [-2, -41], [-16, -42], [-29, -47]]);
  form(ctx, head, fur, -8, -58, 22);
  clipTo(ctx, head, () => { ell(ctx, -26, -50, 11, 6.5, -0.2); fillA(ctx, '#ffffff', 0.35); });
  // casque
  const helm = () => smooth(ctx, [[-22, -64], [-16, -76], [-2, -82], [12, -78], [18, -66], [16, -54], [8, -52], [8, -62], [-4, -66], [-16, -62]]);
  form(ctx, helm, steel, -2, -70, 20, { light: 0.45, sh: 0.25 });
  clipTo(ctx, helm, () => {
    ctx.strokeStyle = gold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-24, -63); ctx.quadraticCurveTo(-6, -69, 10, -63); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -84); ctx.lineTo(-3, -66); ctx.lineWidth = 2; ctx.stroke();
  });
  helm(); paint(ctx, null, LW);
  for (const [x, y] of [[12, -60], [14, -70]]) { ell(ctx, x, y, 1.3, 1.3); ctx.fillStyle = '#7c88aa'; ctx.fill(); }
  // plumet
  limb(ctx, [[-2, -82], [4, -92], [16, -97 + s], [26, -92 + s * 1.5]], 6, 3, vgrad(ctx, -100, -82, plume, 0.3, 0.2), 2.5);
  limb(ctx, [[0, -84], [8, -92], [18, -92 + s]], 3, 1.6, shade(plume, 0.3), 0);
  // yeux
  eye(ctx, -20.5, -56, 5, 6.4, { lid: fur, inner: 1, anger: 0.5 });
  eye(ctx, -6.5, -57, 6.6, 8, { lid: fur, inner: -1, anger: 0.5 });
  brow(ctx, -26, -64, -17, -61, 3.2);
  brow(ctx, 0, -66, -10, -63, 3.8);
  // museau
  whiskers(ctx, -29, -50, -1, 12, 0.55);
  ell(ctx, -35.5, -55, 4.2, 3.8); paint(ctx, ball(ctx, -35.5, -56, 4.5, '#ff6f96'), 2.2);
  gloss(ctx, -36.6, -56.4, 1.4, 1, 0.8);
  rr(ctx, -30.5, -48.8, 3.4, 5.2, 1); paint(ctx, '#fffbea', 1.8);
  rr(ctx, -27.1, -48.5, 3.4, 5, 1); paint(ctx, '#fffbea', 1.8);
  ctx.beginPath(); ctx.moveTo(-32, -49); ctx.quadraticCurveTo(-24, -47, -18, -49); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  blush(ctx, -8, -46, 4.4, 2.4);
  ctx.restore();
  // bouclier (bras avant)
  ctx.save(); ctx.translate(0, b);
  const sx = -17, sy = -30 - s * 0.5;
  const shield = () => smooth(ctx, [[sx - 12, sy - 14], [sx, sy - 16], [sx + 12, sy - 14], [sx + 11, sy + 2], [sx, sy + 15], [sx - 11, sy + 2]]);
  form(ctx, shield, '#3b6fe0', sx, sy, 16, { light: 0.4 });
  clipTo(ctx, shield, () => {
    shield(); ctx.lineWidth = 6; ctx.strokeStyle = gold; ctx.stroke();
    // fromage
    poly(ctx, [[sx - 7, sy + 4], [sx + 7, sy + 4], [sx + 7, sy - 3], [sx - 7, sy + 1]]);
    paint(ctx, '#ffd84a', 1.6);
    poly(ctx, [[sx - 7, sy + 1], [sx + 7, sy - 3], [sx + 2, sy - 7]]); paint(ctx, '#ffe98a', 1.6);
    ctx.fillStyle = '#e8a91c';
    ell(ctx, sx - 1, sy + 1.5, 1.3, 1.1); ctx.fill(); ell(ctx, sx + 4, sy + 0.5, 1, 0.9); ctx.fill();
  });
  shield(); paint(ctx, null, LW);
  gloss(ctx, sx - 6, sy - 9, 3, 2, 0.55);
  ctx.restore();
}

// ------------------------------------------------------------ registre
// box : [x0, y0, w, h] en unités locales AVANT mise à l'échelle (contour, glows et marges inclus)
// k   : échelle appliquée au dessin pour respecter les tailles relatives
const DEFS = {
  rat: { box: [-45, -91, 95, 98], k: 0.85, draw: drawRat },
  dog: { box: [-60, -91, 112, 97], k: 1, draw: drawDog },
  vacuum: { box: [-51, -79, 116, 85], k: 1, draw: drawVacuum },
  cucumber: { box: [-41, -112, 78, 118], k: 1, draw: drawCucumber },
  pigeon: { box: [-46, -93, 93, 99], k: 0.9, draw: drawPigeon },
  crab: { box: [-63, -77, 126, 83], k: 0.9, draw: drawCrab },
  wasp: { box: [-47, -142, 103, 101], k: 1, draw: drawWasp },
  mole: { box: [-60, -100, 112, 107], k: 0.92, draw: drawMole },
  yeti: { box: [-57, -109, 112, 115], k: 1, draw: drawYeti },
  robodog: { box: [-60, -103, 119, 109], k: 1, draw: drawRobodog },
  slime: { box: [-52, -93, 106, 102], k: 1, draw: drawSlime },
  ufo: { box: [-54, -107, 108, 109], k: 1, draw: drawUfo },
  ghost: { box: [-46, -105, 102, 98], k: 1, draw: drawGhost },
  knightrat: { box: [-46, -106, 101, 112], k: 1, draw: drawKnightRat },
};

const spriteCache = new Map();
const portraitCache = new Map();

// Sprite pré-rendu (mis en cache). frame : 0/1 = deux poses de marche/vol.
export function enemySprite(kind, frame = 0) {
  const def = DEFS[kind] || DEFS.rat;
  const fr = Math.abs(Math.floor(frame || 0)) % 2; // accepte un compteur quelconque (parité)
  const key = (DEFS[kind] ? kind : 'rat') + ':' + fr;
  let s = spriteCache.get(key);
  if (!s) {
    const [x0, y0, w, h] = def.box;
    const k = def.k;
    s = makeSprite(x0 * k, y0 * k, w * k, h * k, (ctx) => {
      if (k !== 1) ctx.scale(k, k);
      def.draw(ctx, fr);
    });
    spriteCache.set(key, s);
  }
  return s;
}

// Portrait PNG (dataURL 96×96) pour l'interface, mis en cache.
export function enemyPortrait(kind) {
  const key = DEFS[kind] ? kind : 'rat';
  let u = portraitCache.get(key);
  if (!u) {
    u = spriteURL(enemySprite(key, 0), 96);
    portraitCache.set(key, u);
  }
  return u;
}
