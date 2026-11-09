// =====================================================================
//  Chat héros (bipède, personnalisable + équipement visible) et chatons
//  (quadrupèdes). Parties pré-rendues en sprites (tête ×3 expressions, torse,
//  pattes, arme, ailes), animées par transformations ; membres et queue
//  tracés à chaque image avec un ombrage « cel » léger.
//  Style : cel shading net + liseré de lumière coloré (couleur de la meilleure
//  rareté équipée), tête 3/4 expressive (sourcils, sourire en coin, yeux brillants).
// =====================================================================
import { OUT, shade, mix, rgba, ell, smooth, poly, paint, vgrad, ball, glow, cel, makeSprite, drawSprite, spriteURL, seeded } from './draw.js';
import { drawWeapon, drawHat, drawFace, drawWings, drawArmorOnBody, drawCape, drawGloveOn, drawBootOn, RCOL, MATS, TORSO_PTS, star5, gem, toon, rim, outline, sparkle, setRim } from './gear.js';

// ------------------------------------------------------------------ options d'apparence
export const FURS = {
  roux: { name: 'Roux', c: '#f2963c' }, creme: { name: 'Crème', c: '#f5d6a2' }, gris: { name: 'Gris', c: '#9aa3b5' }, bleu: { name: 'Bleu russe', c: '#7e93b8' },
  noir: { name: 'Noir', c: '#3a3646' }, blanc: { name: 'Blanc', c: '#f6f2ee' }, choco: { name: 'Chocolat', c: '#7d4c30' }, cannelle: { name: 'Cannelle', c: '#c27a4a' },
  lilas: { name: 'Lilas', c: '#c7b2d4' }, fauve: { name: 'Fauve', c: '#dcab5e' }, argent: { name: 'Argent', c: '#d3d9e2' }, dore: { name: 'Doré', c: '#ffc94a' },
  rose: { name: 'Rose bonbon', c: '#ffb0cf' }, menthe: { name: 'Menthe', c: '#9fe6c6' }, lavande: { name: 'Lavande', c: '#b6a0ff' }, neon: { name: 'Néon', c: '#46e8ff' },
  ombre: { name: 'Ombre', c: '#25212f' }, rouge: { name: 'Braise', c: '#e8554a' }, galaxie: { name: 'Galaxie', c: '#2d2066' },
};
export const PATTERNS = {
  solid: 'Uni', tabby: 'Tigré', tiger: 'Rayures de tigre', tuxedo: 'Smoking', calico: 'Calico', siamese: 'Siamois', spots: 'Tacheté', tortie: 'Écaille', galaxy: 'Galaxie',
};
export const EYES = {
  vert: { name: 'Vert', c: '#46c46a' }, bleu: { name: 'Bleu', c: '#4aa9ff' }, ambre: { name: 'Ambre', c: '#ffad2e' }, or: { name: 'Or', c: '#ffd84d' },
  cuivre: { name: 'Cuivre', c: '#d9772b' }, violet: { name: 'Violet', c: '#b968ff' }, rouge: { name: 'Rubis', c: '#ff3d55' }, rose: { name: 'Rose', c: '#ff7ae0' },
  glace: { name: 'Glace', c: '#9ff0ff' }, galaxie: { name: 'Galaxie', c: '#c77dff' },
};
export const EYE_STYLES = { round: 'Ronds', sleepy: 'Rêveurs', fierce: 'Féroces', sparkle: 'Étincelants' };
export const EARS = { normal: 'Classiques', fold: 'Pliées', lynx: 'Lynx', big: 'Grandes' };
export const TAILS = { normal: 'Classique', fluffy: 'Touffue', short: 'Courte' };

const TAU = Math.PI * 2;
function lum(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}
function belly(fur) { return mix(fur, '#ffffff', 0.72); }

// Liseré de lumière : couleur de la meilleure rareté équipée (ou bleu glacier)
function rimColor(gear) {
  let m = -1;
  for (const k in gear || {}) { const g = gear[k]; if (g && typeof g.r === 'number') m = Math.max(m, g.r); }
  if (m >= 8) return '#ffd2f6';
  if (m >= 3) return mix(RCOL[m], '#ffffff', 0.35);
  return '#c6f1ff';
}

// ------------------------------------------------------------------ TÊTE (vue 3/4 vers la droite, centre (0,0), ≈ 90 × 68)
const HEAD_PTS = [[-2, -37], [20, -34], [37, -22], [45, -4], [43, 13], [32, 25], [14, 31], [-8, 31], [-27, 25], [-40, 13], [-45, -4], [-38, -23], [-22, -34]];
function headPath(ctx) { smooth(ctx, HEAD_PTS, true, 0.55); }
// Yeux : proche (gauche, grand) et lointain (droite, plus étroit)
const EYE_N = [1, -2, 10.5, 13], EYE_F = [30, -2, 8, 12.5];

// Chemin « tout sauf la forme décalée » (pour découper l'ombre)
function outsideOf(ctx, shape, dx, dy) {
  ctx.save(); ctx.translate(dx, dy); shape(ctx); ctx.restore();
  ctx.rect(-5000, -5000, 10000, 10000);
}
// Grande forme du chat : cel shading + motifs ombrés eux aussi + reflet + liseré + contour
function furShape(ctx, shape, base, o, marks) {
  const k = o.size, d = k * (o.depth ?? 0.2), lx = -0.55, ly = -0.83;
  cel(ctx, shape, base, { cx: o.cx, cy: o.cy, size: k, depth: o.depth ?? 0.2, shadow: o.shadow ?? 0.22, hi: 0, glint: false, lw: 0 });
  if (marks) {
    ctx.save(); shape(ctx); ctx.clip(); marks(ctx, 0); ctx.restore();
    ctx.save(); shape(ctx); ctx.clip(); outsideOf(ctx, shape, lx * d, ly * d); ctx.clip('evenodd'); marks(ctx, -(o.shadow ?? 0.22)); ctx.restore();
  }
  ctx.save(); shape(ctx); ctx.clip();
  ell(ctx, o.cx + lx * k * 0.42, o.cy + ly * k * 0.42, k * 0.4, k * 0.2, Math.atan2(ly, lx) + Math.PI / 2);
  ctx.fillStyle = rgba('#ffffff', o.hiA ?? 0.2); ctx.fill();
  ell(ctx, o.cx + lx * k * 0.6, o.cy + ly * k * 0.6, k * 0.09, k * 0.055, -0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  ctx.restore();
  if (o.rim) rim(ctx, shape, o.rim, o.rimW ?? 3.6, 0.8);
  if ((o.lw ?? 3.2) > 0) outline(ctx, shape, o.lw ?? 3.2);
}
// Trait effilé (rayures)
function taper(ctx, x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(x0 - dx * 0.25 + nx * w / 2, y0 - dy * 0.25 + ny * w / 2);
  ctx.quadraticCurveTo(x0 + dx * 0.55 + nx * w * 0.4, y0 + dy * 0.55 + ny * w * 0.4, x1, y1);
  ctx.quadraticCurveTo(x0 + dx * 0.55 - nx * w * 0.4, y0 + dy * 0.55 - ny * w * 0.4, x0 - dx * 0.25 - nx * w / 2, y0 - dy * 0.25 - ny * w / 2);
  ctx.closePath();
  ctx.fill();
}
// Courbe lisse ouverte qui prolonge le chemin courant (sans moveTo) — Catmull-Rom comme smooth()
function curveOn(ctx, pts, t = 0.5) {
  const n = pts.length, k = t / 3;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
}
function blobs(ctx, seed, list, cols) {
  const r = seeded(seed);
  list.forEach(([x, y, rad], i) => {
    smooth(ctx, Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * TAU; const q = rad * (0.75 + r() * 0.5); return [x + Math.cos(a) * q, y + Math.sin(a) * q]; }));
    ctx.fillStyle = cols[i % cols.length]; ctx.fill();
  });
}

function earGeom(type, far) {
  let b1, b2, tip;
  if (!far) { b1 = [-43, -10]; b2 = [-12, -33]; tip = [-37, -63]; } else { b1 = [8, -35]; b2 = [39, -15]; tip = [33, -61]; }
  if (type === 'big') { tip = [tip[0] + (far ? 4 : -4), tip[1] - 13]; b1 = [b1[0] - 3, b1[1] + (far ? 0 : 3)]; b2 = [b2[0] + 3, b2[1] + (far ? 3 : 0)]; }
  if (type === 'lynx') tip = [tip[0] + (far ? 1 : -1), tip[1] - 9];
  if (type === 'fold') tip = far ? [tip[0] + 12, tip[1] + 24] : [tip[0] + 14, tip[1] + 22];
  return { b1, b2, tip };
}
function drawEar(ctx, look, far) {
  const { b1, b2, tip } = earGeom(look.ears, far);
  const fur = look.pattern === 'siamese' ? look.pcolor : look.fur;
  const out = (p, q, k) => { const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; const dx = q[1] - p[1], dy = p[0] - q[0], L = Math.hypot(dx, dy) || 1; return [mx + (dx / L) * k, my + (dy / L) * k]; };
  const s = far ? -1 : 1;
  const m1 = out(b1, tip, -4 * s), m2 = out(tip, b2, -4 * s);
  const shape = (c) => { c.beginPath(); c.moveTo(...b1); c.quadraticCurveTo(...m1, ...tip); c.quadraticCurveTo(...m2, ...b2); c.closePath(); };
  const cx = (b1[0] + b2[0] + tip[0]) / 3, cy = (b1[1] + b2[1] + tip[1]) / 3;
  toon(ctx, shape, fur, { cx, cy, size: 16, rim: look.rim, rimW: look.rimW, lw: 3, glint: false, hi: 0.16 });
  // intérieur (plus étroit pour l'oreille lointaine, tournée)
  const bc = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
  const L = (p, k, sh = 0) => [bc[0] + (p[0] - bc[0]) * k + sh, bc[1] + (p[1] - bc[1]) * k];
  const kk = look.ears === 'fold' ? 0.45 : 0.62;
  const i1 = L(b1, far ? 0.45 : kk, far ? -2 : 1), i2 = L(b2, kk), it = L(tip, look.ears === 'fold' ? 0.55 : 0.74);
  const inner = (c) => { c.beginPath(); c.moveTo(...i1); c.quadraticCurveTo((i1[0] + it[0]) / 2 + s * 1.5, (i1[1] + it[1]) / 2, ...it); c.quadraticCurveTo((i2[0] + it[0]) / 2, (i2[1] + it[1]) / 2, ...i2); c.closePath(); };
  const pink = look.fur === FURS.galaxie.c ? '#ff7ae0' : '#ff9fb6';
  cel(ctx, inner, pink, { cx: (i1[0] + i2[0] + it[0]) / 3, cy: (i1[1] + i2[1] + it[1]) / 3, size: 8, hi: 0, glint: false, lw: 0, shadow: 0.2, lx: s * 0.55, ly: -0.83 });
  // touffes de poils
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const t of [0.35, 0.6]) { const p = [i1[0] + (i2[0] - i1[0]) * t, i1[1] + (i2[1] - i1[1]) * t]; ctx.beginPath(); ctx.moveTo(p[0], p[1] + 2); ctx.quadraticCurveTo(p[0] + s * 1, p[1] - 4, p[0] + s * 3.5, p[1] - 8); ctx.stroke(); }
  if (look.ears === 'lynx') {
    const tuft = (c) => { c.beginPath(); c.moveTo(tip[0] - 3.5, tip[1] + 5); c.quadraticCurveTo(tip[0] - 1, tip[1] - 6, tip[0] + s * 2, tip[1] - 13); c.quadraticCurveTo(tip[0] + 2, tip[1] - 3, tip[0] + 3.5, tip[1] + 5); c.closePath(); };
    toon(ctx, tuft, shade(fur, -0.45), { cx: tip[0], cy: tip[1] - 3, size: 5, lw: 2.2, rim: false, glint: false, hi: 0 });
  }
  if (look.ears === 'fold') {
    ctx.beginPath(); ctx.moveTo(L(b1, 0.35)[0], L(b1, 0.35)[1] - 4); ctx.quadraticCurveTo(cx, cy - 6, L(b2, 0.35)[0], L(b2, 0.35)[1] - 4);
    ctx.strokeStyle = rgba(OUT, 0.55); ctx.lineWidth = 2.2; ctx.stroke();
  }
}
function drawCheekTufts(ctx, look) {
  const fur = look.fur;
  const near = (c) => smooth(c, [[-36, 2], [-52, 4], [-43, 11], [-55, 19], [-40, 22], [-30, 18]], true, 0.18);
  const far = (c) => smooth(c, [[38, 10], [51, 16], [40, 21], [46, 27], [32, 26]], true, 0.18);
  toon(ctx, near, fur, { cx: -42, cy: 12, size: 10, rim: look.rim, rimW: look.rimW, glint: false, hi: 0.1 });
  toon(ctx, far, fur, { cx: 42, cy: 18, size: 8, rim: look.rim, rimW: look.rimW, glint: false, hi: 0 });
}
function drawForelock(ctx, look) {
  const sh = (c) => smooth(c, [[-2, -32], [2, -45], [8, -38], [15, -49], [18, -36], [24, -42], [24, -30]], true, 0.12);
  toon(ctx, sh, look.fur, { cx: 10, cy: -38, size: 10, rim: look.rim, rimW: look.rimW, glint: false, hi: 0.18 });
}

function patternOnHead(ctx, look, dk) {
  const p = look.pattern;
  const pc = shade(look.pcolor, dk), pc2 = shade(look.pcolor2, dk);
  if (p === 'tabby' || p === 'tiger') {
    const T = p === 'tiger' ? 1.3 : 1;
    ctx.fillStyle = pc;
    for (const [x, len, w] of [[3, 13, 4.4], [12.5, 15, 5], [22, 13, 4.4]]) taper(ctx, x, -39, x + (x - 12.5) * 0.18, -39 + len, w * T);
    for (const [y, l] of [[-5, 16], [6, 14]]) taper(ctx, -48, y, -48 + l, y + 2.5, 4.4 * T);
    taper(ctx, 48, 1, 38, 3.5, 4 * T);
    if (T > 1) { taper(ctx, -42, -26, -28, -16, 5.4); taper(ctx, 42, -22, 32, -15, 4.8); taper(ctx, -48, 17, -37, 15, 4.6); taper(ctx, 48, 13, 39, 13, 4); }
  } else if (p === 'tuxedo') {
    ctx.fillStyle = shade('#fbf8f4', dk);
    ctx.beginPath(); ctx.moveTo(13, -12); ctx.quadraticCurveTo(17.5, -24, 22, -12); ctx.lineTo(27, 3); ctx.quadraticCurveTo(38, 6, 47, 12); ctx.lineTo(47, 40); ctx.lineTo(-26, 40); ctx.quadraticCurveTo(-14, 22, 0, 12); ctx.quadraticCurveTo(9, 6, 11, 0); ctx.closePath(); ctx.fill();
  } else if (p === 'calico') {
    blobs(ctx, 7, [[-28, -24, 17], [34, -26, 12], [-42, 10, 10]], [pc, pc2]);
  } else if (p === 'tortie') {
    blobs(ctx, 13, [[-22, -22, 12], [8, -32, 9], [32, -12, 8], [-36, 6, 10], [2, -16, 6], [40, 14, 6]], [pc, pc2, pc]);
  } else if (p === 'siamese') {
    const g = ctx.createRadialGradient(19, 9, 2, 19, 9, 32);
    g.addColorStop(0, rgba(pc, 0.96)); g.addColorStop(0.55, rgba(pc, 0.62)); g.addColorStop(1, rgba(pc, 0));
    ctx.fillStyle = g; ctx.fillRect(-50, -40, 100, 80);
  } else if (p === 'spots') {
    ctx.fillStyle = pc;
    for (const [x, y, rad] of [[-26, -20, 5.4], [-10, -30, 4.2], [-37, 0, 4.6], [33, -25, 3.8], [-22, 15, 3.4], [6, -24, 3]]) { ell(ctx, x, y, rad, rad * 0.85); ctx.fill(); }
  } else if (p === 'galaxy') {
    const g = ctx.createRadialGradient(-16, -18, 2, -16, -18, 38);
    g.addColorStop(0, rgba('#ff7ae0', 0.6 + dk)); g.addColorStop(1, rgba('#ff7ae0', 0));
    ctx.fillStyle = g; ctx.fillRect(-50, -40, 100, 80);
    const g2 = ctx.createRadialGradient(30, 16, 2, 30, 16, 26);
    g2.addColorStop(0, rgba('#48c8ff', 0.4)); g2.addColorStop(1, rgba('#48c8ff', 0));
    ctx.fillStyle = g2; ctx.fillRect(-50, -40, 100, 80);
    const r = seeded(31);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 3 ? '#ffffff' : '#ffd6f5'; const x = -42 + r() * 84, y = -34 + r() * 62, s = 0.8 + r() * 1.6; ell(ctx, x, y, s, s); ctx.fill(); }
    sparkle(ctx, -22, -20, 4); sparkle(ctx, 6, -28, 3);
  }
}

// ------------------------------------------------------------------ visage
function drawEye(ctx, x, y, rx, ry, col, style, side, lid) {
  const gal = col === EYES.galaxie.c;
  if (style === 'sparkle') { rx *= 1.06; ry *= 1.06; }
  ell(ctx, x, y, rx, ry); ctx.fillStyle = '#1d1530'; ctx.fill();
  const ix = x + rx * 0.08, iy = y + ry * 0.05, irx = rx * 0.82, iry = ry * 0.85;
  ctx.save(); ell(ctx, ix, iy, irx, iry); ctx.clip();
  ctx.fillStyle = gal ? '#8a4dff' : col; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  ell(ctx, ix, iy + iry * 0.62, irx * 0.9, iry * 0.52); ctx.fillStyle = gal ? '#ff8ae8' : shade(col, 0.42); ctx.fill();
  ell(ctx, ix, iy - iry * 0.98, irx * 1.5, iry * 0.74); ctx.fillStyle = gal ? '#3a1a8a' : shade(col, -0.45); ctx.fill();
  if (gal) { ctx.fillStyle = '#ffffff'; for (const [dx, dy] of [[-0.35, 0.25], [0.3, 0.05], [0.05, 0.5], [-0.1, -0.1]]) { ell(ctx, ix + dx * irx, iy + dy * iry, 0.9, 0.9); ctx.fill(); } }
  const pw = style === 'fierce' ? rx * 0.16 : rx * 0.36;
  ell(ctx, ix + rx * 0.14, iy + ry * 0.06, pw, iry * (style === 'fierce' ? 0.78 : 0.62)); ctx.fillStyle = '#120b1e'; ctx.fill();
  ctx.restore();
  // reflets
  ctx.fillStyle = '#ffffff';
  if (style === 'sparkle') {
    sparkle(ctx, x - rx * 0.26, y - ry * 0.3, rx * 0.66);
    sparkle(ctx, x + rx * 0.38, y + ry * 0.4, rx * 0.32);
    ell(ctx, x + rx * 0.05, y + ry * 0.55, rx * 0.1, rx * 0.1); ctx.fill();
  } else {
    ell(ctx, x - rx * 0.28, y - ry * 0.36, rx * 0.36, ry * 0.27, -0.35); ctx.fill();
    ell(ctx, x + rx * 0.34, y + ry * 0.38, rx * 0.15, rx * 0.15); ctx.fill();
  }
  // paupières
  const ox = x + side * rx; // coin extérieur
  if (style === 'sleepy' || style === 'fierce') {
    ctx.save(); ell(ctx, x, y, rx + 1.2, ry + 1.2); ctx.clip();
    ctx.beginPath();
    let a0, a1;
    if (style === 'sleepy') { a0 = [x - rx * 1.2, y - ry * 0.12]; a1 = [x + rx * 1.2, y - ry * 0.12]; }
    else { a0 = [ox + side * rx * 0.2, y - ry * 0.72]; a1 = [x - side * rx * 1.2, y - ry * 0.02]; }
    ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a1[0], y - ry * 2); ctx.lineTo(a0[0], y - ry * 2); ctx.closePath();
    ctx.fillStyle = lid; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(a0[0] + (style === 'sleepy' ? rx * 0.2 : 0), a0[1] + 0.5); ctx.lineTo(a1[0] - (style === 'sleepy' ? rx * 0.2 : 0), a1[1] + 0.5);
    ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x - rx * 1.02, y - ry * 0.08); ctx.bezierCurveTo(x - rx * 0.92, y - ry * 1.22, x + rx * 0.92, y - ry * 1.22, x + rx * 1.02, y - ry * 0.08);
    ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
  }
  // trait de cil extérieur (petite virgule)
  ctx.beginPath(); ctx.moveTo(ox - side * 0.5, y - ry * 0.42); ctx.quadraticCurveTo(ox + side * rx * 0.3, y - ry * 0.5, ox + side * rx * 0.48, y - ry * 0.86);
  ctx.lineWidth = 2.8; ctx.strokeStyle = OUT; ctx.stroke();
}
function drawClosedEye(ctx, x, y, rx, side, hurt) {
  ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (hurt) { const s = -side; ctx.moveTo(x - s * rx * 0.85, y - 7); ctx.lineTo(x + s * rx * 0.75, y); ctx.lineTo(x - s * rx * 0.85, y + 7); }
  else { ctx.moveTo(x - rx, y); ctx.quadraticCurveTo(x, y + 7.5, x + rx, y); }
  ctx.stroke();
  if (!hurt) { const ox = x + side * rx; ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + side * 3, y - 3); ctx.lineWidth = 2.6; ctx.stroke(); }
}
// Sourcils par humeur : [extérieur, contrôle, intérieur] (œil proche) / [intérieur, contrôle, extérieur] (œil lointain)
const BROWS = {
  round: [[[-9, -21], [0, -26], [10, -19.5]], [[23, -20], [30, -27], [38, -23.5]]],
  fierce: [[[-9, -25], [1, -24], [11, -16.5]], [[22, -16.5], [29, -23], [38, -25]]],
  sleepy: [[[-9, -21.5], [1, -24.5], [10, -22]], [[23, -22.5], [30, -24.5], [38, -21.5]]],
  sparkle: [[[-9, -20.5], [0, -29], [10, -23]], [[23, -23.5], [30, -30], [38, -21.5]]],
};
function drawBrows(ctx, look, kind) {
  const B = BROWS[kind] || BROWS.round;
  for (const [a, c, b] of B) {
    const sh = (cx) => {
      // trait effilé : épais à l'intérieur (vers le nez)
      const inner = b[0] > a[0] === (a[0] < 15) ? b : a;
      const outer = inner === b ? a : b;
      cx.beginPath();
      cx.moveTo(outer[0], outer[1]);
      cx.quadraticCurveTo(c[0], c[1] - 1.6, inner[0], inner[1] - 2.2);
      cx.quadraticCurveTo(inner[0] + 1.2 * Math.sign(inner[0] - outer[0]), inner[1], inner[0], inner[1] + 1.2);
      cx.quadraticCurveTo(c[0], c[1] + 1.8, outer[0], outer[1]);
      cx.closePath();
    };
    sh(ctx); ctx.fillStyle = look.brow; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = look.brow; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
function drawFaceFeatures(ctx, look, mode) {
  const ec = look.eye, ec2 = look.eye2 || ec;
  const lid = look.pattern === 'siamese' ? mix(look.fur, look.pcolor, 0.6) : look.fur;
  // museau + menton
  const mz = look.pattern === 'siamese' ? mix(look.belly, look.pcolor, 0.45) : look.belly;
  ctx.fillStyle = mz;
  ell(ctx, 13.5, 13.5, 8.6, 6.6); ctx.fill();
  ell(ctx, 25, 13.5, 7.6, 6.2); ctx.fill();
  ell(ctx, 19.5, 20.5, 5.4, 3.6); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.35); ell(ctx, 11, 11, 4, 2.2, -0.3); ctx.fill();
  // joues
  ctx.fillStyle = rgba('#ff5f97', 0.42);
  ell(ctx, -17, 12, 7.6, 4.2); ctx.fill();
  ell(ctx, 39.5, 12, 4.6, 3.4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(ctx, -20, 10.5, 1.4, 1); ctx.fill();
  // yeux
  if (mode === 'blink' || mode === 'hurt') {
    drawClosedEye(ctx, EYE_N[0], EYE_N[1], EYE_N[2], -1, mode === 'hurt');
    drawClosedEye(ctx, EYE_F[0], EYE_F[1], EYE_F[2], 1, mode === 'hurt');
  } else {
    drawEye(ctx, EYE_N[0], EYE_N[1], EYE_N[2], EYE_N[3], ec2, look.eyeStyle, -1, lid);
    drawEye(ctx, EYE_F[0], EYE_F[1], EYE_F[2], EYE_F[3], ec, look.eyeStyle, 1, lid);
  }
  drawBrows(ctx, look, mode === 'hurt' ? 'fierce' : look.eyeStyle);
  // nez
  const nose = (c) => { c.beginPath(); c.moveTo(15, 6); c.quadraticCurveTo(19.5, 3.6, 24, 6); c.quadraticCurveTo(22.6, 10.6, 19.5, 11.2); c.quadraticCurveTo(16.4, 10.6, 15, 6); c.closePath(); };
  nose(ctx); paint(ctx, look.fur === FURS.galaxie.c ? '#ff7ae0' : '#ff7f98', 2);
  ell(ctx, 17.6, 6.4, 1.8, 1.1, -0.2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  // bouche
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (mode === 'hurt') {
    const m = (c) => { c.beginPath(); c.moveTo(14, 15); c.quadraticCurveTo(19.5, 11.5, 26, 14); c.quadraticCurveTo(25, 22, 19.5, 22); c.quadraticCurveTo(14, 21.5, 14, 15); c.closePath(); };
    m(ctx); ctx.fillStyle = '#5a1a3a'; ctx.fill();
    ctx.save(); m(ctx); ctx.clip(); ell(ctx, 20, 22, 4.5, 3); ctx.fillStyle = '#ff7f98'; ctx.fill(); ctx.restore();
    m(ctx); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(19.5, 11); ctx.lineTo(19.5, 13.6);
    ctx.moveTo(12.6, 13.6); ctx.quadraticCurveTo(16, 17.4, 19.5, 13.6); ctx.quadraticCurveTo(23.6, 16.8, 27.8, 10.6);
    ctx.stroke();
    // petit croc
    poly(ctx, [[21.4, 15.3], [24.4, 14.6], [23, 18.8]]); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.3; ctx.stroke();
  }
}
function drawWhiskers(ctx, look) {
  const dark = lum(look.fur) < 0.35;
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.8)' : rgba(OUT, 0.8); ctx.lineWidth = 1.9;
  for (const [x0, y0, x1, y1] of [[32, 10.5, 56, 4], [33, 13.5, 58, 13], [32, 16.5, 54, 22]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 2, x1, y1); ctx.stroke(); }
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : rgba(OUT, 0.5); ctx.lineWidth = 1.5;
  for (const [x0, y0, x1, y1] of [[6, 12, -15, 8], [6, 15, -14, 17]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
}

function drawKittenAcc(ctx, acc, color) {
  const c = color || '#ff5ca8';
  switch (acc) {
    case 'bow':
      for (const s of [-1, 1]) { smooth(ctx, [[-18, -28], [-18 + s * 12, -36], [-18 + s * 13, -24]], true, 0.6); paint(ctx, vgrad(ctx, -38, -22, c), 2.2); }
      ell(ctx, -18, -29, 4, 4); paint(ctx, shade(c, -0.15), 2);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ell(ctx, 24 + Math.cos(a) * 5, -34 + Math.sin(a) * 5, 4.4, 4.4); paint(ctx, i % 2 ? c : shade(c, 0.3), 1.6); }
      ell(ctx, 24, -34, 3.4, 3.4); paint(ctx, '#ffd84d', 1.4);
      break;
    case 'crown':
      ctx.beginPath(); ctx.moveTo(-12, -28); ctx.lineTo(-14, -44); ctx.lineTo(-5, -36); ctx.lineTo(2, -48); ctx.lineTo(9, -36); ctx.lineTo(17, -44); ctx.lineTo(15, -28); ctx.closePath();
      paint(ctx, vgrad(ctx, -48, -28, '#ffd54f', 0.4, 0.2), 2.4); gem(ctx, 2, -32, 2.6, 5);
      break;
    case 'bandana':
      ctx.beginPath(); ctx.moveTo(-38, -12); ctx.quadraticCurveTo(4, -32, 42, -14); ctx.lineTo(41, -6); ctx.quadraticCurveTo(4, -24, -38, -4); ctx.closePath(); paint(ctx, c, 2.2);
      smooth(ctx, [[-36, -8], [-52, -14], [-54, -2]], true, 0.5); paint(ctx, c, 2);
      break;
    case 'halo':
      glow(ctx, 2, -52, 22, '#fff2a0', 0.55);
      ctx.beginPath(); ctx.ellipse(2, -52, 18, 5, 0, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = '#ffe680'; ctx.stroke();
      break;
    case 'horn':
      glow(ctx, 16, -42, 16, c, 0.4);
      poly(ctx, [[10, -30], [22, -64], [20, -30]]); paint(ctx, vgrad(ctx, -64, -30, '#fff1c8', 0.3, 0.15), 2.2);
      ctx.strokeStyle = rgba('#c9a060', 0.8); ctx.lineWidth = 1.4;
      for (const y of [-38, -46, -54]) { ctx.beginPath(); ctx.moveTo(13, y + 3); ctx.lineTo(20, y); ctx.stroke(); }
      break;
    case 'devil':
      for (const [x, s] of [[-16, -1], [14, 1]]) { smooth(ctx, [[x - 5, -28], [x + s * 4, -46], [x + 5, -28]], true, 0.3); paint(ctx, vgrad(ctx, -46, -28, '#e8323f'), 2.2); }
      break;
    case 'leaf':
      ctx.beginPath(); ctx.moveTo(0, -32); ctx.quadraticCurveTo(-14, -46, 2, -58); ctx.quadraticCurveTo(14, -44, 0, -32); paint(ctx, vgrad(ctx, -58, -32, '#5fd068'), 2.2);
      ctx.beginPath(); ctx.moveTo(0, -33); ctx.lineTo(2, -54); ctx.strokeStyle = '#2e8a3a'; ctx.lineWidth = 1.4; ctx.stroke();
      break;
    case 'star':
      star5(ctx, -18, -26, 9, 4); paint(ctx, vgrad(ctx, -34, -18, '#ffd84d'), 2);
      break;
    case 'flame':
      glow(ctx, 0, -44, 20, '#ff7a1a', 0.6);
      smooth(ctx, [[-10, -30], [-12, -44], [-2, -42], [0, -60], [8, -44], [12, -48], [10, -30]], true, 0.4); paint(ctx, vgrad(ctx, -60, -30, '#ffb52e', 0.4, 0.1), 2);
      break;
    case 'ice':
      for (const [x, h2] of [[-12, 16], [0, 22], [12, 14]]) { poly(ctx, [[x - 4, -30], [x, -30 - h2], [x + 4, -30]]); paint(ctx, vgrad(ctx, -52, -30, '#bff4ff', 0.4, 0.1), 2); }
      break;
    default: break;
  }
}

// mode : false | 'normal' | true | 'blink' | 'hurt'
function drawHeadFull(ctx, look, mode, gear) {
  mode = mode === true ? 'blink' : mode || 'normal';
  const hasHat = !!(gear && gear.hat);
  drawEar(ctx, look, true);
  drawEar(ctx, look, false);
  drawCheekTufts(ctx, look);
  if (!hasHat && !look.acc) drawForelock(ctx, look);
  furShape(ctx, headPath, look.fur, { cx: -4, cy: -8, size: 42, rim: look.rim, rimW: look.rimW, lw: 0 }, look.pattern !== 'solid' ? (c, dk) => patternOnHead(c, look, dk) : null);
  drawFaceFeatures(ctx, look, mode);
  outline(ctx, headPath, 3.4);
  drawWhiskers(ctx, look);
  if (gear && gear.face) drawFace(ctx, gear.face.base, gear.face.r);
  if (look.acc) drawKittenAcc(ctx, look.acc, look.accColor);
  if (hasHat) { ctx.save(); ctx.translate(3, -31); ctx.rotate(-0.05); drawHat(ctx, gear.hat.base, gear.hat.r); ctx.restore(); }
}

// ------------------------------------------------------------------ CORPS du héros (bipède) — torse centré en (0,0)
function torsoPath(ctx) { smooth(ctx, TORSO_PTS, true, 0.55); }
function patternOnBody(ctx, look, dk) {
  const pc = shade(look.pcolor, dk), p = look.pattern;
  if (p === 'tabby' || p === 'tiger') {
    ctx.fillStyle = pc; const w = p === 'tiger' ? 5.4 : 4.4;
    for (const y of [-14, -4, 6, 15]) taper(ctx, -24, y, -7, y + 3, w);
  } else if (p === 'calico' || p === 'tortie') {
    blobs(ctx, p === 'calico' ? 3 : 11, [[-12, -8, 10], [-10, 13, 8], [16, 16, 5]], [pc, shade(look.pcolor2, dk), pc]);
  } else if (p === 'spots') {
    ctx.fillStyle = pc; for (const [x, y, r] of [[-12, -10, 4.2], [-5, 5, 3.6], [-15, 13, 3.8], [14, -12, 3]]) { ell(ctx, x, y, r, r * 0.85); ctx.fill(); }
  } else if (p === 'siamese') {
    const g = ctx.createLinearGradient(0, -24, 0, 26); g.addColorStop(0, rgba(pc, 0)); g.addColorStop(1, rgba(pc, 0.55));
    ctx.fillStyle = g; ctx.fillRect(-30, -30, 60, 60);
  } else if (p === 'galaxy') {
    const g = ctx.createRadialGradient(-8, 4, 2, -8, 4, 26); g.addColorStop(0, rgba('#ff7ae0', 0.45)); g.addColorStop(1, rgba('#ff7ae0', 0));
    ctx.fillStyle = g; ctx.fillRect(-30, -30, 60, 60);
    const r = seeded(9); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) { ell(ctx, -20 + r() * 40, -20 + r() * 40, 0.8 + r(), 0.8 + r()); ctx.fill(); }
  }
  // ventre + jabot de poils (dents de scie)
  const tux = p === 'tuxedo';
  ctx.fillStyle = shade(look.belly, dk);
  ctx.beginPath();
  ctx.moveTo(-3, -12); ctx.lineTo(1, -17); ctx.lineTo(4, -11); ctx.lineTo(8, -18); ctx.lineTo(11, -11); ctx.lineTo(15, -17); ctx.lineTo(17, -9); ctx.lineTo(21, -12);
  ctx.quadraticCurveTo(26, 8, 18, 22); ctx.quadraticCurveTo(6, 28, tux ? -12 : -4, 22); ctx.quadraticCurveTo(tux ? -14 : -7, 4, -3, -12);
  ctx.closePath(); ctx.fill();
}
function drawBodyBiped(ctx, look, gear) {
  furShape(ctx, torsoPath, look.fur, { cx: -2, cy: -2, size: 24, rim: look.rim, rimW: look.rimW, lw: 3.2 }, (c, dk) => patternOnBody(c, look, dk));
  if (gear && gear.armor) drawArmorOnBody(ctx, gear.armor.base, gear.armor.r);
  if (gear && gear.collar) {
    const b = gear.collar.base, r = gear.collar.r;
    const band = (c) => { c.beginPath(); c.ellipse(5, -16, 15, 4.6, -0.15, 0, TAU); c.ellipse(5, -16, 11, 1.8, -0.15, 0, TAU, true); };
    if (b === 'pearls') {
      for (let i = 0; i < 9; i++) { const a = 0.15 + (i / 8) * (Math.PI - 0.3); const x = 5 + Math.cos(a) * 14, y = -16 + Math.sin(a) * 6; toon(ctx, (c) => ell(c, x, y, 2.8, 2.8), '#fbf6ff', { cx: x, cy: y, size: 3, lw: 1.4, glint: false, shadow: 0.2 }); }
      gem(ctx, 8, -8, 3.6, r);
    } else {
      toon(ctx, band, b === 'spikes' ? '#3a3052' : RCOL[r] || RCOL[0], { cx: 5, cy: -16, size: 12, lw: 2.2, glint: false });
      if (b === 'spikes') for (const x of [-2, 6, 14]) { poly(ctx, [[x - 2.4, -12.5], [x, -6], [x + 2.4, -12.5]]); paint(ctx, '#e4e8f0', 1.6); }
      else {
        const bell = (c) => ell(c, 8, -8, 4.6, 4.6);
        toon(ctx, bell, MATS[Math.max(4, Math.min(7, r))].base, { cx: 8, cy: -8, size: 5, lw: 2 });
        ctx.beginPath(); ctx.moveTo(4.6, -7.4); ctx.lineTo(11.4, -7.4); ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
      }
    }
  }
}

// ------------------------------------------------------------------ pattes (sprites) et pieds
function drawPaw(ctx, look, back, open) {
  const c = back ? look.pawD : look.paw;
  if (open) {
    const sh = (cx) => smooth(cx, [[-7, 2], [-8, -5], [-4, -10], [2, -11], [7, -7], [8, 1], [3, 7], [-4, 7]], true, 0.6);
    toon(ctx, sh, c, { cx: 0, cy: -2, size: 9, lw: 2.8, rim: look.rim, rimW: look.rimW, glint: false, hi: 0.15 });
    ctx.fillStyle = '#ff9fb6';
    ell(ctx, 0.5, 1.5, 3.6, 2.8); ctx.fill();
    for (const [x, y] of [[-4.2, -4], [-0.8, -6.8], [3, -6.4], [5.8, -3]]) { ell(ctx, x, y, 1.6, 1.9); ctx.fill(); }
    return;
  }
  const sh = (cx) => ell(cx, 1, 0, 7.6, 7);
  toon(ctx, sh, c, { cx: 1, cy: 0, size: 8, lw: 2.8, rim: look.rim, rimW: look.rimW, glint: false, hi: 0.2 });
  ctx.beginPath(); ctx.moveTo(4.4, -5); ctx.quadraticCurveTo(6.4, -3.4, 6.4, -2.2); ctx.moveTo(4.8, 0); ctx.quadraticCurveTo(7.2, 1, 7.4, 2.4);
  ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(OUT, 0.6); ctx.lineCap = 'round'; ctx.stroke();
}
function drawFoot(ctx, look, back) {
  const c = back ? look.pawD : look.paw;
  const sh = (cx) => smooth(cx, [[-7, -3], [1, -6], [10, -4], [13.5, 2], [9, 6.5], [-6, 6.5], [-9, 2]], true, 0.55);
  toon(ctx, sh, c, { cx: 2, cy: 0, size: 10, lw: 2.8, rim: look.rim, rimW: look.rimW, glint: false, hi: 0.18 });
  ctx.beginPath(); ctx.moveTo(8, -2.5); ctx.quadraticCurveTo(10, 0, 9.6, 3); ctx.moveTo(4.4, -3.6); ctx.quadraticCurveTo(6, -0.6, 5.6, 2.6);
  ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(OUT, 0.55); ctx.lineCap = 'round'; ctx.stroke();
}
// Membre « tube » tracé à chaque image : contour, ombre, face éclairée, liseré
function limb(ctx, x0, y0, x1, y1, w, c, cd, rimC, rw = 0.2) {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.lineWidth = w + 5.6; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.lineWidth = w; ctx.strokeStyle = cd; ctx.stroke();
  const o = w * 0.12;
  ctx.beginPath(); ctx.moveTo(x0 - o, y0 - o); ctx.lineTo(x1 - o, y1 - o);
  ctx.lineWidth = w * 0.6; ctx.strokeStyle = c; ctx.stroke();
  if (rimC) {
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.3, y0 + w * 0.2); ctx.lineTo(x1 + w * 0.3, y1 + w * 0.2);
    ctx.lineWidth = w * rw; ctx.strokeStyle = rgba(rimC, 0.75); ctx.stroke();
  }
}

// ------------------------------------------------------------------ CORPS du chaton (quadrupède) — repère centre (0,0)
const KBODY_PTS = [[-22, -1], [-17, -13], [-4, -17], [10, -16], [20, -7], [22, 5], [14, 14], [0, 17], [-14, 14], [-22, 7]];
function drawBodyKitten(ctx, look) {
  smooth(ctx, KBODY_PTS, true, 0.55);
  paint(ctx, ball(ctx, 0, -2, 26, look.fur, 0.2, 0.22), 3);
  ctx.save(); smooth(ctx, KBODY_PTS, true, 0.55); ctx.clip();
  ctx.fillStyle = look.belly; ell(ctx, 12, 9, 12, 9); ctx.fill();
  const pc = look.pcolor;
  if (look.pattern === 'tabby' || look.pattern === 'tiger') {
    ctx.strokeStyle = pc; ctx.lineWidth = look.pattern === 'tiger' ? 4.6 : 3.4;
    for (const x of [-14, -4, 6]) { ctx.beginPath(); ctx.moveTo(x, -20); ctx.quadraticCurveTo(x - 4, -10, x - 2, -2); ctx.stroke(); }
  } else if (look.pattern === 'calico' || look.pattern === 'tortie') {
    ctx.fillStyle = pc; ell(ctx, -10, -8, 9, 7); ctx.fill(); ctx.fillStyle = look.pcolor2; ell(ctx, 6, -10, 6, 5); ctx.fill();
  } else if (look.pattern === 'spots') {
    ctx.fillStyle = pc; for (const [x, y] of [[-12, -6], [2, -10], [-4, 4]]) { ell(ctx, x, y, 3.6, 3); ctx.fill(); }
  } else if (look.pattern === 'galaxy') {
    const r = seeded(5); ctx.fillStyle = '#ffffff'; for (let i = 0; i < 7; i++) { ell(ctx, -20 + r() * 40, -16 + r() * 28, 1 + r(), 1 + r()); ctx.fill(); }
  }
  ctx.restore();
  smooth(ctx, KBODY_PTS, true, 0.55); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  if (look.acc === 'bell') {
    ctx.beginPath(); ctx.ellipse(16, -10, 6, 9, 0.3, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = look.accColor || '#ff4d5e'; ctx.stroke();
    ell(ctx, 22, -4, 4, 4); paint(ctx, ball(ctx, 22, -4, 4, '#ffd54f'), 1.6);
  }
}

// ------------------------------------------------------------------ look complet
export function resolveLook(a) {
  const fur = (FURS[a.fur] || FURS.roux).c;
  const look = {
    fur,
    belly: a.fur === 'galaxie' ? '#6c5ce7' : a.fur === 'ombre' || a.fur === 'noir' ? mix(fur, '#ffffff', 0.35) : belly(fur),
    pattern: a.pattern || 'solid',
    pcolor: a.pcolor || shade(fur, -0.35),
    pcolor2: a.pcolor2 || '#3a3646',
    eye: (EYES[a.eye] || EYES.vert).c,
    eye2: a.eye2 ? (EYES[a.eye2] || EYES.bleu).c : null,
    eyeStyle: a.eyeStyle || 'round',
    ears: a.ears || 'normal',
    tail: a.tail || 'normal',
    acc: a.acc || null,
    accColor: a.accColor || null,
    baby: !!a.baby,
  };
  if (a.pattern === 'tuxedo') look.belly = '#fbf8f4';
  if (a.pattern === 'siamese' && !a.pcolor) look.pcolor = '#5b3a2b';
  // dérivés de rendu
  const L = lum(fur);
  look.brow = L < 0.35 ? mix(fur, '#ffffff', 0.62) : mix(fur, OUT, 0.72);
  look.paw = look.pattern === 'siamese' ? look.pcolor : look.pattern === 'tuxedo' ? '#fbf8f4' : fur;
  look.pawD = shade(look.paw, -0.2);
  look.rim = '#c6f1ff';
  look.rimW = L < 0.3 ? 5.2 : 3.6; // liseré plus large sur les pelages sombres (silhouette sur fond sombre)
  return look;
}

// ------------------------------------------------------------------ poses
const EASE = { lin: (x) => x, in: (x) => x * x, out: (x) => 1 - (1 - x) * (1 - x), io: (x) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)) };
function track(k, keys) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [k1, p1, e] = keys[i];
    if (k <= k1) {
      const [k0, p0] = keys[i - 1];
      const q = EASE[e || 'io']((k - k0) / (k1 - k0));
      const o = {};
      for (const key in p1) o[key] = p0[key] + (p1[key] - p0[key]) * q;
      return o;
    }
  }
  return keys[keys.length - 1][1];
}
function lerpPose(a, b, q) { const o = {}; for (const key in a) o[key] = a[key] + (b[key] - a[key]) * q; return o; }
// Genre de port d'arme
function weaponKind(base) {
  if (!base) return 'none';
  if (base === 'claws' || base === 'staff' || base === 'wand' || base === 'bow') return base;
  return 'shoulder';
}
// Longueur utile (poignée → extrémité) pour la traînée
const WLEN = { sword: 94, katana: 98, axe: 100, hammer: 96, staff: 112, wand: 74, bow: 44, scythe: 112, trident: 120, fish: 112, ladle: 74, claws: 56 };
const WS = 0.88; // échelle de l'arme en main
const LIFT = 3; // buste légèrement relevé : jambes plus visibles
const HEAD_X = 4, HEAD_Y = -76 - LIFT, HEAD_S = 0.92;
const SH_F = [10, -49 - LIFT], SH_B = [-7, -50 - LIFT];
const HIP_Y = -16 - LIFT;
const BODY_Y = -34 - LIFT;

// ------------------------------------------------------------------ RIG animé
export class CatRig {
  // appearance : objet d'apparence brut (fur, pattern…), gear : { weapon:{base,r}, hat, face, armor, cape, wings, gloves, boots, collar }
  constructor(appearance, gear = {}, opts = {}) {
    this.baby = !!(opts.baby || appearance.baby);
    this.look = resolveLook({ ...appearance, baby: this.baby });
    this.gear = gear || {};
    this.t = Math.random() * 10;
    this.blinkT = 2 + Math.random() * 3;
    this.build();
  }
  build() {
    const L = this.look, G = this.gear;
    L.rim = rimColor(G);
    setRim(L.rim);
    try {
      if (this.baby) {
        this.head = makeSprite(-74, -108, 148, 150, (ctx) => drawHeadFull(ctx, L, 'normal', G), 2.2);
        this.headBlink = makeSprite(-74, -108, 148, 150, (ctx) => drawHeadFull(ctx, L, 'blink', G), 2.2);
        this.body = makeSprite(-30, -24, 60, 46, (ctx) => drawBodyKitten(ctx, L));
      } else {
        this.head = makeSprite(-74, -108, 148, 150, (ctx) => drawHeadFull(ctx, L, 'normal', G), 2.2);
        this.headBlink = makeSprite(-74, -108, 148, 150, (ctx) => drawHeadFull(ctx, L, 'blink', G), 2.2);
        this._headHurt = null; // construites à la première utilisation (coup reçu / sort à mains nues)
        this._pawOpen = null;
        this.body = makeSprite(-34, -34, 68, 74, (ctx) => drawBodyBiped(ctx, L, G));
        const gl = G.gloves, bt = G.boots;
        this.pawF = makeSprite(-15, -15, 30, 30, (ctx) => (gl ? drawGloveOn(ctx, gl.base, gl.r, false) : drawPaw(ctx, L, false)));
        this.pawB = makeSprite(-15, -15, 30, 30, (ctx) => (gl ? drawGloveOn(ctx, gl.base, gl.r, true) : drawPaw(ctx, L, true)));
        this.footF = makeSprite(-14, -20, 32, 30, (ctx) => (bt ? drawBootOn(ctx, bt.base, bt.r, false) : drawFoot(ctx, L, false)));
        this.footB = makeSprite(-14, -20, 32, 30, (ctx) => (bt ? drawBootOn(ctx, bt.base, bt.r, true) : drawFoot(ctx, L, true)));
        // manches de l'armure
        const A = G.armor;
        const ar = A ? Math.max(0, Math.min(8, A.r | 0)) : 0;
        this.sleeve = A ? (A.base === 'plate' ? MATS[ar].base : A.base === 'royal' ? MATS[ar >= 8 ? 8 : Math.max(4, ar)].base : ar >= 8 ? '#ffc6f2' : RCOL[ar]) : null;
      }
      this.wings = G.wings ? makeSprite(-86, -94, 108, 124, (ctx) => drawWings(ctx, G.wings.base, G.wings.r), 2) : null;
      this.weapon = G.weapon ? makeSprite(-82, -134, 164, 184, (ctx) => drawWeapon(ctx, G.weapon.base, G.weapon.r, { noString: true }), 2) : null;
    } finally { setRim(null); }
    this.style = G.weapon ? weaponStyle(G.weapon.base) : 'slash';
    this.wkind = weaponKind(G.weapon && G.weapon.base);
    this.wlen = G.weapon ? (WLEN[G.weapon.base] || 90) * WS : 0;
    this.wcol = G.weapon ? (G.weapon.r >= 8 ? '#ffb8f0' : RCOL[G.weapon.r]) : '#ffffff';
    this.height = this.baby ? 88 : 131;
  }
  get headHurt() {
    if (this.baby) return this.headBlink;
    if (!this._headHurt) {
      setRim(this.look.rim);
      try { this._headHurt = makeSprite(-74, -108, 148, 150, (ctx) => drawHeadFull(ctx, this.look, 'hurt', this.gear), 2.2); } finally { setRim(null); }
    }
    return this._headHurt;
  }
  get pawOpen() {
    if (!this._pawOpen) this._pawOpen = makeSprite(-15, -15, 30, 30, (ctx) => drawPaw(ctx, this.look, false, true));
    return this._pawOpen;
  }
  // Position de la main d'arme / des yeux (pour les effets), en coordonnées locales (avant échelle/miroir)
  get handPos() { return this.baby ? [20, -40] : [26, -44]; }
  get eyePos() { return this.baby ? [30, -48] : [28, -81]; }

  update(dt) {
    this.t += dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2.5 + Math.random() * 3.5;
  }

  // anim : { state: 'idle'|'run'|'attack'|'cast'|'hurt'|'dead', k: 0..1, flash: 0..1 }
  draw(ctx, x, y, scale = 1, facing = 1, anim = {}) {
    const st = anim.state || 'idle', k = anim.k || 0;
    ctx.save();
    ctx.translate(x, y);
    // ombre au sol
    ctx.fillStyle = 'rgba(20,8,40,0.28)';
    ell(ctx, 0, 0, (this.baby ? 26 : 30) * scale, 6 * scale); ctx.fill();
    ctx.scale(scale * facing, scale);
    if (this.baby) this.drawBaby(ctx, st, k);
    else this.drawHero(ctx, st, k);
    // flash d'impact
    if (anim.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 4, -this.height * 0.5, this.height * 0.55, anim.flashColor || '#ffffff', anim.flash * 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- poses du héros
  restPose() {
    const t = this.t, b = Math.sin(t * 2.6);
    let hx = 24, hy = -41, wa = this.style === 'smash' ? -1.32 : -1.25;
    switch (this.wkind) {
      case 'claws': hx = 27; hy = -43; wa = 0.55; break;
      case 'staff': hx = 30; hy = -38; wa = 0.08; break;
      case 'wand': hx = 28; hy = -40; wa = 0.75; break;
      case 'bow': hx = 32; hy = -34; wa = 0.6; break;
      case 'none': hx = 22; hy = -36; wa = 0; break;
      default: break;
    }
    return { hx, hy: hy + b * 0.8, wa: wa + b * 0.02, bx: -15 + b * 0.6, by: -33, px: 0, jump: 0, py: b * 0.6, lean: 0, sy: 1 + b * 0.016, tilt: Math.sin(t * 2.1) * 0.03 };
  }
  pose(st, k) {
    const R = this.restPose();
    const kind = this.wkind, style = this.style;
    if (st === 'attack') {
      k = Math.min(1, k);
      let keys;
      if (kind === 'shoulder' && style === 'smash') keys = [[0, R],
        [0.25, { ...R, hx: 8, hy: -52, wa: -1.95, bx: -18, by: -46, px: -6, jump: -6, lean: -0.14, sy: 1.04, tilt: -0.08 }, 'out'],
        [0.42, { ...R, hx: 32, hy: -30, wa: 2.05, bx: -20, by: -30, px: 18, jump: 0, lean: 0.2, sy: 0.92, tilt: 0.08 }, 'in'],
        [0.62, { ...R, hx: 33, hy: -29, wa: 2.1, bx: -20, by: -30, px: 17, jump: 0, lean: 0.17, sy: 0.95, tilt: 0.06 }, 'out'], [1, R]];
      else if (kind === 'shoulder' && style === 'pierce') keys = [[0, R],
        [0.25, { ...R, hx: 12, hy: -42, wa: 1.45, bx: -6, by: -40, px: -6, lean: -0.08 }, 'out'],
        [0.42, { ...R, hx: 38, hy: -44, wa: 1.52, bx: -18, by: -36, px: 22, lean: 0.15, sy: 0.97 }, 'in'],
        [0.62, { ...R, hx: 37, hy: -44, wa: 1.5, bx: -18, by: -36, px: 19, lean: 0.12 }, 'out'], [1, R]];
      else if (kind === 'shoulder') keys = [[0, R],
        [0.22, { ...R, hx: 14, hy: -50, wa: -1.8, bx: -18, by: -40, px: -5, lean: -0.12, sy: 1.02, tilt: -0.06 }, 'out'],
        [0.4, { ...R, hx: 31, hy: -34, wa: 2.35, bx: -20, by: -30, px: 18, lean: 0.16, sy: 0.96, tilt: 0.06 }, 'in'],
        [0.58, { ...R, hx: 29, hy: -31, wa: 2.55, bx: -20, by: -30, px: 16, lean: 0.13, sy: 0.98, tilt: 0.05 }, 'out'], [1, R]];
      else if (kind === 'staff' || kind === 'wand') keys = [[0, R],
        [0.25, { ...R, hx: 22, hy: -56, wa: -0.15, jump: -3, lean: -0.08, tilt: -0.06 }, 'out'],
        [0.45, { ...R, hx: 36, hy: -48, wa: 1.05, px: 6, jump: 0, lean: 0.1 }, 'in'],
        [0.65, { ...R, hx: 35, hy: -47, wa: 1.0, px: 5, jump: 0, lean: 0.08 }, 'out'], [1, R]];
      else if (kind === 'bow') keys = [[0, R],
        [0.15, { ...R, hx: 36, hy: -46, wa: 0.18, bx: 28, by: -48, lean: -0.04 }, 'out'],
        [0.45, { ...R, hx: 37, hy: -46, wa: 0.18, bx: 13, by: -50, lean: -0.07 }, 'io'],
        [0.52, { ...R, hx: 37, hy: -46, wa: 0.18, bx: 5, by: -56, lean: -0.05 }, 'out'],
        [0.75, { ...R, hx: 36, hy: -46, wa: 0.18, bx: 3, by: -54, lean: -0.04 }, 'io'], [1, R]];
      else keys = [[0, R], // griffes / poings
        [0.2, { ...R, hx: 12, hy: -48, wa: kind === 'claws' ? -0.4 : 0, px: -3, lean: -0.08 }, 'out'],
        [0.38, { ...R, hx: 38, hy: -40, wa: kind === 'claws' ? 1.7 : 0, px: 18, lean: 0.16, sy: 0.97 }, 'in'],
        [0.58, { ...R, hx: 36, hy: -37, wa: kind === 'claws' ? 2.1 : 0, px: 16, lean: 0.12 }, 'out'], [1, R]];
      return track(k, keys);
    }
    if (st === 'cast') {
      const q = Math.sin(Math.min(1, k) * Math.PI);
      const cw = { shoulder: 0.65, staff: 0.12, wand: 0.4, bow: 0.3, claws: 0.45, none: 0 }[kind];
      return lerpPose(R, { ...R, hx: 34, hy: -58, wa: cw, bx: -14, by: -56, jump: -14, lean: -0.07, sy: 1.04, tilt: -0.08 }, q);
    }
    if (st === 'hurt') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      return lerpPose(R, { ...R, hx: 20, hy: -35, wa: kind === 'shoulder' ? -1.35 : R.wa - 0.3, bx: -18, by: -42, px: -10, lean: -0.15, tilt: -0.12 }, a);
    }
    if (st === 'dead') return { ...R, hx: 22, hy: -32, wa: kind === 'shoulder' ? 1.7 : R.wa + 0.8, bx: -16, by: -30, py: 0, sy: 1, tilt: -0.15 };
    if (st === 'run') {
      const ph = this.t * 13;
      return { ...R, hy: R.hy + Math.sin(ph * 2) * 1.2, wa: R.wa + Math.sin(ph * 2) * 0.05, bx: -12 + Math.sin(ph) * 10, by: -35, py: -Math.abs(Math.sin(ph)) * 5, lean: 0.1, sy: 1 + Math.abs(Math.sin(ph)) * 0.03, tilt: 0.03 };
    }
    return R;
  }
  weaponTip(P, f = 1) {
    const L = this.wlen * f;
    return [P.hx + Math.sin(P.wa) * L, P.hy - Math.cos(P.wa) * L];
  }

  drawHero(ctx, st, k) {
    const L = this.look, G = this.gear, t = this.t;
    const P = this.pose(st, k);
    const kind = this.wkind;
    ctx.save();
    if (st === 'dead') { const q = Math.min(1, k); ctx.translate(-q * 10, 0); ctx.rotate(-q * 1.35); }
    ctx.translate(P.px, P.jump);
    // --- jambes (repère du sol), hanches suivant le buste
    const cl = Math.cos(P.lean), sl = Math.sin(P.lean);
    const hip = (hx) => [hx * cl, hx * sl + HIP_Y + 2 + P.py];
    let fF, fB, liftF = 0, liftB = 0;
    if (st === 'run') {
      const ph = t * 13;
      fF = [9 + Math.sin(ph) * 10, 0]; fB = [-8 - Math.sin(ph) * 10, 0];
      liftF = Math.max(0, Math.cos(ph)) * 7; liftB = Math.max(0, -Math.cos(ph)) * 7;
    } else {
      const spread = Math.max(0, Math.min(1, P.px / 18));
      fF = [11 + spread * 4, 0]; fB = [-9 - spread * 9, 0];
    }
    // --- repère du buste
    const body = () => { ctx.translate(0, HIP_Y + P.py); ctx.rotate(P.lean); ctx.scale(1, P.sy); ctx.translate(0, -HIP_Y); };
    const capeK = st === 'run' ? 1.7 : 1;
    // ailes, cape, queue, bras arrière
    ctx.save(); body();
    if (this.wings) {
      const flap = st === 'cast' ? 0.3 : st === 'run' ? 0.2 : 0.1;
      drawSprite(ctx, this.wings, -8, -54 - LIFT, 1, 1 - Math.abs(Math.sin(t * 6)) * flap, Math.sin(t * 3) * 0.05);
    }
    if (G.cape) { ctx.save(); ctx.translate(0, BODY_Y); drawCape(ctx, G.cape.base, G.cape.r, t * 4 * capeK, capeK); ctx.restore(); }
    this.drawTailHero(ctx, st);
    const backFront = kind === 'bow' && st === 'attack' && k > 0.08 && k < 0.85;
    this.drawArmB(ctx, P, backFront);
    ctx.restore();
    // jambe arrière
    this.drawLegHero(ctx, hip(-6), fB, liftB, true);
    // torse
    ctx.save(); body();
    drawSprite(ctx, this.body, 0, BODY_Y);
    ctx.restore();
    // jambe avant
    this.drawLegHero(ctx, hip(6), fF, liftF, false);
    // haut du corps : arme, tête, bras avant
    ctx.save(); body();
    // arme posée sur l'épaule proche (devant la mâchoire), levée derrière la tête, portée devant pendant la frappe
    const wFront = (P.wa > 0.35 || P.wa < -1.0) && !(kind === 'staff' && st !== 'attack');
    const armFront = P.hy > -50 || P.hx > 32;
    if (this.weapon && st === 'attack') this.drawTrail(ctx, k); // traînée toujours derrière la tête
    if (this.weapon && !wFront) this.drawWeaponAt(ctx, P, st, k);
    if (!armFront) this.drawArmF(ctx, P, st);
    const face = st === 'hurt' && Math.sin(Math.min(1, k) * Math.PI) > 0.25 ? 'hurt' : st === 'dead' ? 'hurt' : this.blinkT < 0 ? 'blink' : 'normal';
    const hs = face === 'hurt' ? this.headHurt : face === 'blink' ? this.headBlink : this.head;
    drawSprite(ctx, hs, HEAD_X, HEAD_Y, HEAD_S, HEAD_S, P.tilt);
    if (this.weapon && wFront) this.drawWeaponAt(ctx, P, st, k);
    if (armFront) this.drawArmF(ctx, P, st);
    if (backFront) { this.drawArrow(ctx, P, st, k); drawSprite(ctx, this.pawB, P.bx, P.by, 0.94, 0.94, 0.3); }
    if (st === 'cast') {
      const q = Math.sin(Math.min(1, k) * Math.PI);
      const [gx, gy] = this.weapon && kind !== 'none' ? this.weaponTip(P, kind === 'bow' ? 0 : 0.92) : [P.hx, P.hy - 4];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, gx, gy, 16 + 16 * q, this.wcol, 0.75 * q);
      ctx.restore();
      if (q > 0.3) sparkle(ctx, gx, gy, 5 + 6 * q, '#ffffff', q);
    }
    ctx.restore();
    ctx.restore();
  }
  drawWeaponAt(ctx, P, st, k) {
    if (this.wkind === 'bow') this.drawBowString(ctx, P, st, k);
    drawSprite(ctx, this.weapon, P.hx, P.hy, WS, WS, P.wa);
  }
  // Traînée de mouvement sur l'arc de l'arme (coup en cours)
  drawTrail(ctx, k) {
    const kind = this.wkind, style = this.style;
    if (kind === 'bow' || kind === 'none') return;
    if (style === 'pierce') {
      if (k < 0.3 || k > 0.6) return;
      const P = this.pose('attack', k), [tx, ty] = this.weaponTip(P);
      const a = 1 - Math.abs(k - 0.44) / 0.16;
      ctx.save(); ctx.lineCap = 'round';
      for (const [dy, len, w] of [[0, 46, 4], [-7, 30, 2.4], [7, 30, 2.4]]) {
        ctx.beginPath(); ctx.moveTo(tx - 22, ty + dy); ctx.lineTo(tx - 22 - len, ty + dy);
        ctx.strokeStyle = rgba('#ffffff', 0.75 * a); ctx.lineWidth = w; ctx.stroke();
      }
      ctx.restore();
      return;
    }
    const win = kind === 'claws' ? [0.2, 0.56] : style === 'smash' ? [0.26, 0.6] : style === 'magic' ? [0.26, 0.6] : [0.23, 0.56];
    if (k < win[0] || k > win[1]) return;
    const k0 = Math.max(win[0], k - 0.15);
    const N = 14, outer = [], inner = [], core = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N, P = this.pose('attack', k0 + (k - k0) * f);
      outer.push(this.weaponTip(P, 1.02));
      inner.push(this.weaponTip(P, 1 - 0.55 * f * f));
      core.push(this.weaponTip(P, 1 - 0.18 * f));
    }
    const fade = Math.min(1, (win[1] - k) / 0.08);
    const band = (a1, a2) => { ctx.beginPath(); ctx.moveTo(a1[0][0], a1[0][1]); curveOn(ctx, a1); const r2 = a2.slice().reverse(); ctx.lineTo(r2[0][0], r2[0][1]); curveOn(ctx, r2); ctx.closePath(); };
    ctx.save();
    band(outer, inner); ctx.fillStyle = rgba(this.wcol, 0.4 * fade); ctx.fill();
    band(outer, core); ctx.fillStyle = rgba('#ffffff', 0.85 * fade); ctx.fill();
    ctx.restore();
  }
  drawBowString(ctx, P, st, k) {
    const c = Math.cos(P.wa), s = Math.sin(P.wa);
    const tr = (x, y) => [P.hx + (x * c - y * s) * WS, P.hy + (x * s + y * c) * WS];
    const a = tr(-9, -44), b = tr(-9, 44);
    const pulled = st === 'attack' && k > 0.12 && k < 0.5;
    const m = pulled ? [P.bx, P.by] : tr(-9, 0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(m[0], m[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff6e0'; ctx.stroke();
  }
  drawArrow(ctx, P, st, k) {
    if (!(st === 'attack' && k > 0.12 && k < 0.5)) return;
    const m = [P.bx, P.by];
    { // flèche encochée
      const ang = Math.atan2(P.hy - m[1], P.hx + 20 - m[0]);
      ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40, 0); ctx.lineWidth = 4.4; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#e8c79a'; ctx.stroke();
      poly(ctx, [[38, -3.6], [46, 0], [38, 3.6]]); paint(ctx, MATS[(this.gear.weapon || {}).r | 0].base, 1.6);
      poly(ctx, [[0, 0], [-6, -4], [-3, 0], [-6, 4]]); paint(ctx, this.wcol, 1.4);
      ctx.restore();
    }
  }
  drawArmF(ctx, P, st) {
    const L = this.look;
    const [sx, sy] = SH_F;
    limb(ctx, sx, sy, P.hx, P.hy, 9, L.paw, L.pawD, L.rim, L.rimW > 4 ? 0.28 : 0.2);
    if (this.sleeve) { const mx = sx + (P.hx - sx) * 0.45, my = sy + (P.hy - sy) * 0.45; limb(ctx, sx, sy, mx, my, 10.5, this.sleeve, shade(this.sleeve, -0.25), L.rim); }
    const open = st === 'cast' && this.wkind === 'none';
    const ang = Math.atan2(P.hy - sy, P.hx - sx);
    drawSprite(ctx, open ? this.pawOpen : this.pawF, P.hx, P.hy, 1, 1, open ? -0.2 : ang);
  }
  drawArmB(ctx, P, armOnly = false) {
    const L = this.look;
    const [sx, sy] = SH_B;
    if (armOnly) { // main qui tire la corde (dessinée devant) : le bras reste derrière le corps
      const c = shade(L.paw, -0.16);
      limb(ctx, sx, sy, sx + 6, sy + 6, 8.5, c, shade(c, -0.18), null);
      return;
    }
    const c = shade(L.paw, -0.16);
    limb(ctx, sx, sy, P.bx, P.by, 8.5, c, shade(c, -0.18), null);
    if (this.sleeve) { const s2 = shade(this.sleeve, -0.16); limb(ctx, sx, sy, sx + (P.bx - sx) * 0.45, sy + (P.by - sy) * 0.45, 10, s2, shade(s2, -0.25), null); }
    drawSprite(ctx, this.pawB, P.bx, P.by, 0.94, 0.94, Math.atan2(P.by - sy, P.bx - sx));
  }
  drawLegHero(ctx, hip, foot, lift, back) {
    const L = this.look;
    const ax = foot[0] - 1, ay = foot[1] - 6 - lift;
    const c = back ? shade(L.paw, -0.16) : L.paw;
    limb(ctx, hip[0], hip[1], ax, ay, back ? 10 : 11, c, shade(c, -0.18), back ? null : L.rim, L.rimW > 4 ? 0.28 : 0.2);
    drawSprite(ctx, back ? this.footB : this.footF, ax, ay, 1, 1, lift ? -0.25 * (lift / 7) * (back ? -1 : 1) : 0);
  }
  drawTailHero(ctx, st) {
    const L = this.look, t = this.t;
    const run = st === 'run';
    const w = Math.sin(t * (run ? 9 : 2.8)) * (run ? 6 : 8);
    const short = L.tail === 'short', fluffy = L.tail === 'fluffy';
    const th = fluffy ? 14 : 9.5;
    const ln = short ? 22 : 52;
    const bx = -14, by = -26 - LIFT;
    const ex = run ? bx - ln * 0.95 + w * 0.5 : bx - ln * 0.42 + w, ey = run ? by - ln * 0.45 : by - ln * 0.98;
    const path = (ox = 0, oy = 0) => {
      ctx.beginPath(); ctx.moveTo(bx + ox, by + oy);
      if (short) ctx.quadraticCurveTo(bx - ln * 0.7 + ox, by + 2 + oy, ex + ox, ey + oy);
      else ctx.bezierCurveTo(bx - ln * 0.55 + ox, by + 4 + oy, bx - ln * (run ? 0.8 : 0.85) + w * 0.4 + ox, by - ln * (run ? 0.2 : 0.5) + oy, ex + ox, ey + oy);
    };
    const tc = L.pattern === 'siamese' ? L.pcolor : L.fur;
    ctx.lineCap = 'round';
    path(); ctx.lineWidth = th + 5.6; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = th; ctx.strokeStyle = shade(tc, -0.2); ctx.stroke();
    path(-th * 0.12, -th * 0.12); ctx.lineWidth = th * 0.6; ctx.strokeStyle = tc; ctx.stroke();
    if (L.pattern === 'tabby' || L.pattern === 'tiger' || L.pattern === 'galaxy') {
      path(); ctx.setLineDash([th * 0.55, th * 0.95]); ctx.lineWidth = th * 0.98; ctx.strokeStyle = L.pattern === 'galaxy' ? rgba('#ff7ae0', 0.7) : L.pcolor; ctx.stroke(); ctx.setLineDash([]);
    }
    path(th * 0.3, th * 0.2); ctx.lineWidth = th * (L.rimW > 4 ? 0.26 : 0.18); ctx.strokeStyle = rgba(L.rim, 0.65); ctx.stroke();
    const tip = L.pattern === 'tuxedo' ? '#fbf8f4' : L.pattern === 'calico' || L.pattern === 'tortie' ? L.pcolor2 : null;
    if (tip || fluffy) {
      const tcol = tip || shade(tc, 0.12);
      ell(ctx, ex, ey, th * 0.62, th * 0.62); paint(ctx, tcol, 2.6);
      if (fluffy) for (const a of [-2.2, -1.4, -0.6]) { poly(ctx, [[ex + Math.cos(a - 0.3) * th * 0.5, ey + Math.sin(a - 0.3) * th * 0.5], [ex + Math.cos(a) * th * 0.95, ey + Math.sin(a) * th * 0.95], [ex + Math.cos(a + 0.3) * th * 0.5, ey + Math.sin(a + 0.3) * th * 0.5]]); paint(ctx, tcol, 2); ell(ctx, ex, ey, th * 0.5, th * 0.5); ctx.fillStyle = tcol; ctx.fill(); }
    }
  }

  // ---------------------------------------------------------------- chaton (quadrupède) — conservé tel quel
  drawBaby(ctx, st, k) {
    const t = this.t;
    let by = 0, lean = 0, px = 0, walk = 0;
    if (st === 'run') { const ph = t * 13; by = -Math.abs(Math.sin(ph)) * 7; walk = Math.sin(ph); lean = 0.06; }
    else if (st === 'attack') { const a = Math.sin(Math.min(1, k) * Math.PI); px = 16 * a; lean = (k < 0.4 ? -0.12 : 0.16) * a; }
    else if (st === 'cast') { const a = Math.sin(Math.min(1, k) * Math.PI); by = -16 * a; }
    else if (st === 'hurt') { const a = Math.sin(Math.min(1, k) * Math.PI); px = -10 * a; lean = -0.15 * a; }
    else if (st === 'dead') { lean = -Math.min(1, k) * 1.35; }
    else by = Math.sin(t * 2.6) * 0.6 - Math.abs(Math.sin(t * 3.2)) * 3;
    ctx.save();
    ctx.translate(px, by);
    if (lean) ctx.rotate(lean);
    this.drawKitten(ctx, walk, st, k);
    ctx.restore();
  }
  drawTail(ctx, bx, by, len, thick, wagAmp, wagSpeed) {
    const L = this.look, t = this.t;
    const w = Math.sin(t * wagSpeed) * wagAmp;
    const short = L.tail === 'short';
    const th = L.tail === 'fluffy' ? thick * 1.5 : thick;
    const ln = short ? len * 0.4 : len;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx - ln * 0.45, by + 2, bx - ln * 0.62 + w * 0.4, by - ln * 0.55, bx - ln * 0.35 + w, by - ln * 0.95);
    ctx.lineCap = 'round';
    ctx.lineWidth = th + 6; ctx.strokeStyle = OUT; ctx.stroke();
    const tc = L.pattern === 'siamese' ? L.pcolor : L.fur;
    ctx.lineWidth = th; ctx.strokeStyle = tc; ctx.stroke();
    if (L.pattern === 'tabby' || L.pattern === 'tiger' || L.pattern === 'galaxy') {
      ctx.setLineDash([th * 0.55, th * 0.9]); ctx.lineWidth = th * 0.98; ctx.strokeStyle = L.pattern === 'galaxy' ? rgba('#ff7ae0', 0.7) : L.pcolor; ctx.stroke(); ctx.setLineDash([]);
    }
    if (L.pattern === 'tuxedo') { const ex = bx - ln * 0.35 + w, ey = by - ln * 0.95; ell(ctx, ex, ey, th * 0.5, th * 0.5); ctx.fillStyle = '#fbf8f4'; ctx.fill(); }
  }
  drawLeg(ctx, hx, hy, fx, fy, w, color, boot) {
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy - 3);
    ctx.lineCap = 'round'; ctx.lineWidth = w + 6; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
    ell(ctx, fx + 3, fy - 3.5, w * 0.75, w * 0.48);
    paint(ctx, boot || color, 2.8);
  }
  drawKitten(ctx, walk, st, k) {
    const L = this.look, t = this.t;
    const fur = L.fur, furD = shade(fur, -0.2);
    const pawC = L.pattern === 'siamese' ? L.pcolor : L.pattern === 'tuxedo' ? '#fbf8f4' : fur;
    if (this.wings) drawSprite(ctx, this.wings, -6, -34, 0.62, 0.62 - Math.abs(Math.sin(t * 9)) * 0.2, Math.sin(t * 4) * 0.05);
    this.drawTail(ctx, -18, -24, 40, 8, 12, st === 'run' ? 10 : 3.4);
    const sw = st === 'run' || st === 'idle' ? walk : 0;
    this.drawLeg(ctx, -12, -16, -12 + sw * 5, 0, 9, furD);
    this.drawLeg(ctx, 10, -16, 10 - sw * 5, 0, 9, furD);
    drawSprite(ctx, this.body, -2, -22);
    this.drawLeg(ctx, -5, -14, -5 - sw * 5, 0, 10, pawC);
    this.drawLeg(ctx, 16, -14, 16 + sw * 5, 0, 10, pawC);
    const blink = this.blinkT < 0;
    const tilt = Math.sin(t * 2.4) * 0.05 + (st === 'attack' ? 0.12 * Math.sin(k * Math.PI) : 0);
    drawSprite(ctx, blink ? this.headBlink : this.head, 14, -46, 0.75, 0.75, tilt);
  }
}

export function weaponStyle(base) {
  return { hammer: 'smash', ladle: 'smash', staff: 'magic', wand: 'magic', bow: 'arrow', trident: 'pierce' }[base] || 'slash';
}

// ------------------------------------------------------------------ portraits (interface)
const portraitCache = new Map();
export function catPortraitURL(appearance, gear = {}, size = 112, baby = false) {
  const key = JSON.stringify([appearance, gear && { h: gear.hat, f: gear.face }, size, baby]);
  if (portraitCache.has(key)) return portraitCache.get(key);
  const look = resolveLook({ ...appearance, baby });
  look.rim = rimColor(gear);
  setRim(look.rim);
  let s;
  try { s = makeSprite(-74, -108, 148, 150, (ctx) => drawHeadFull(ctx, look, 'normal', gear), 2); } finally { setRim(null); }
  const url = spriteURL(s, size, 0.02);
  portraitCache.set(key, url);
  return url;
}
const bodyCache = new Map();
export function catFullURL(appearance, gear = {}, size = 160, baby = false) {
  const key = JSON.stringify([appearance, gear, size, baby]);
  if (bodyCache.has(key)) return bodyCache.get(key);
  const rig = new CatRig(appearance, gear, { baby });
  rig.t = 0.3; rig.blinkT = 3;
  const h = baby ? 100 : 150;
  const s = makeSprite(-100, -h - 20, 200, h + 34, (ctx) => rig.draw(ctx, 0, 0, 1, 1, { state: 'idle' }), 2);
  const url = spriteURL(s, size, 0.03);
  bodyCache.set(key, url);
  return url;
}
