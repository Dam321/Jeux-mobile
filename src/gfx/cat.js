// =====================================================================
//  Chat héros (bipède, personnalisable + équipement visible) et chatons
//  (quadrupèdes). Parties pré-rendues en sprites (tête ×3 expressions, torse,
//  pattes, arme, ailes), animées par transformations ; membres et queue
//  tracés à chaque image avec un ombrage « cel » léger.
//  Style : cel shading net + liseré de lumière coloré (couleur de la meilleure
//  rareté équipée), tête 3/4 expressive (sourcils, sourire en coin, yeux brillants).
// =====================================================================
import { OUT, shade, mix, rgba, ell, rr, smooth, poly, paint, vgrad, ball, glow, cel, makeSprite, drawSprite, spriteURL, seeded } from './draw.js';
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
function drawEye(ctx, x, y, rx, ry, col, style, side, lid, glowC) {
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
  if (glowC) { // œil luisant (classe) : pupille fendue incandescente
    ell(ctx, ix + rx * 0.14, iy + ry * 0.06, rx * 0.3, iry * 0.8); ctx.fillStyle = shade(col, -0.5); ctx.fill();
    ell(ctx, ix + rx * 0.14, iy + ry * 0.06, rx * 0.15, iry * 0.7); ctx.fillStyle = mix(glowC, '#ffffff', 0.82); ctx.fill();
  } else { ell(ctx, ix + rx * 0.14, iy + ry * 0.06, pw, iry * (style === 'fierce' ? 0.78 : 0.62)); ctx.fillStyle = '#120b1e'; ctx.fill(); }
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
    if (look.eyeGlow) { glow(ctx, EYE_N[0], EYE_N[1], 22, look.eyeGlow, 0.5); glow(ctx, EYE_F[0], EYE_F[1], 18, look.eyeGlow, 0.5); }
    drawEye(ctx, EYE_N[0], EYE_N[1], EYE_N[2], EYE_N[3], ec2, look.eyeStyle, -1, lid, look.eyeGlow);
    drawEye(ctx, EYE_F[0], EYE_F[1], EYE_F[2], EYE_F[3], ec, look.eyeStyle, 1, lid, look.eyeGlow);
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

// =====================================================================
//  TENUES DE CLASSE (appearance.cls) — ignorées par les chatons.
//  Pièces « toujours là » : dessinées quel que soit l'équipement.
//  Pièces « de remplacement » (couvre-chef, masque, bottes) : seulement si
//  l'emplacement gear.hat / gear.face / gear.boots est vide.
//  Statique → dans les sprites (tête, torse, pièces de dos / d'épaule) ;
//  animé (écharpe, grimoire, feux follets, anneaux…) → tracé à chaque image.
// =====================================================================
const CLASS_IDS = ['botte', 'noir', 'tigre', 'ninja', 'siamois', 'sphynx'];
const CC = {
  crim: '#d0283e', crimD: '#8a1426', gold: '#ffc93c', strap: '#7a3f22', boot: '#5e2c1c', cuff: '#8f4a2a', lace: '#fff8ef', felt: '#a8182f', plume: '#fdf8f2',
  ind: '#4b36ad', indD: '#33248a', vio: '#8f45ff', vioG: '#b86bff', cyan: '#62f4ff', page: '#fff1d2',
  blood: '#e2262f', bronze: '#c98a3c', bone: '#f3e8cc', pelt: '#8e8996', peltL: '#e6e2ec', band: '#efe3cb',
  cloth: '#2f2b40', steel: '#c9d1dc',
  forest: '#2f8f4c', forestD: '#1d5c33', leaf: '#4fc46a', leather: '#8a5330', feather: '#ffc23a', featherT: '#c4561f',
  void: '#2a2338', voidL: '#3e3554', ghost: '#5effa8', ghostL: '#e2fff1', ghostD: '#137049',
};
// cadre des sprites de tête : standard / avec tenue de classe (chapeaux hauts, plumes, cornes, capuches)
const HEAD_BOX = [-74, -108, 148, 150], HEAD_BOX_CLS = [-100, -142, 200, 206];

function qbez(p0, p1, p2, n = 10) {
  const o = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); }
  return o;
}
function cbez(p0, p1, p2, p3, n = 14) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    o.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return o;
}
// Ruban le long de la ligne brisée P ; w : demi-largeur (nombre ou fonction (s ∈ [0,1], i)) ; notch : encoche en V au bout
function ribbon(c, P, w, notch = 0) {
  const n = P.length, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const p = P[Math.max(0, i - 1)], q = P[Math.min(n - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const h = typeof w === 'function' ? w(i / (n - 1), i) : w;
    A.push([P[i][0] - dy * h, P[i][1] + dx * h]); B.push([P[i][0] + dy * h, P[i][1] - dx * h]);
  }
  c.beginPath(); c.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < n; i++) c.lineTo(A[i][0], A[i][1]);
  if (notch) { const e = P[n - 1], f = P[n - 2], l = Math.hypot(e[0] - f[0], e[1] - f[1]) || 1; c.lineTo(e[0] - (e[0] - f[0]) / l * notch, e[1] - (e[1] - f[1]) / l * notch); }
  for (let i = n - 1; i >= 0; i--) c.lineTo(B[i][0], B[i][1]);
  c.closePath();
}
// Sangle posée sur le torse : découpée à la silhouette du buste, bouts refermés par un trait qui suit la courbure
const HULL_PTS = TORSO_PTS.map(([x, y]) => [x * 1.1, y * 1.08 + 0.6]);
function hullPath(c) { smooth(c, HULL_PTS, true, 0.55); }
function strap(ctx, shape, base, o = {}) {
  ctx.save(); hullPath(ctx); ctx.clip();
  toon(ctx, shape, base, { cx: o.cx ?? 0, cy: o.cy ?? 0, size: o.size ?? 14, lw: 0, glint: false, hi: o.hi ?? 0.16, shadow: 0.28 });
  outline(ctx, shape, o.lw ?? 2.4);
  ctx.save(); shape(ctx); ctx.clip(); hullPath(ctx); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.restore();
  ctx.restore();
}
// Bandeau posé sur la tête (même principe, découpé au crâne légèrement agrandi)
function headWrap(ctx, shape, base, o = {}) {
  const hp = (c) => { c.save(); c.translate(-2, -3); c.scale(1.05, 1.05); headPath(c); c.restore(); };
  ctx.save(); hp(ctx); ctx.clip();
  toon(ctx, shape, base, { cx: o.cx ?? 0, cy: o.cy ?? 0, size: o.size ?? 20, lw: 0, glint: false, hi: o.hi ?? 0.18, shadow: 0.26 });
  outline(ctx, shape, 2.6);
  ctx.save(); shape(ctx); ctx.clip(); hp(ctx); ctx.lineWidth = 5.4; ctx.strokeStyle = OUT; ctx.stroke(); ctx.restore();
  ctx.restore();
}
// Plume (ruban dentelé, tige, pointe colorée)
function plume(ctx, P, wmax, base, tip) {
  const n = P.length;
  const sh = (c) => ribbon(c, P, (s, i) => (1 + wmax * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + s)), 0.75)) * (i % 2 ? 1 : 0.8));
  const m = P[n >> 1];
  toon(ctx, sh, base, { cx: m[0], cy: m[1], size: wmax * 1.6, lw: 0, glint: false, hi: 0.16, shadow: 0.2 });
  ctx.save(); sh(ctx); ctx.clip();
  if (tip) { const e = P[n - 1]; ell(ctx, e[0], e[1], wmax * 1.7, wmax * 1.7); ctx.fillStyle = tip; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < n - 1; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(OUT, 0.32); ctx.stroke();
  ctx.restore();
  outline(ctx, sh, 2.4);
}
function shuriken(ctx, x, y, R) {
  const sh = (c) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = 0.35 + i * Math.PI / 4, r = i % 2 ? R * 0.36 : R; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };
  toon(ctx, sh, CC.steel, { cx: x, cy: y, size: R, lw: 2, glint: false, hi: 0.3, shadow: 0.32 });
  ell(ctx, x, y, R * 0.2, R * 0.2); ctx.fillStyle = OUT; ctx.fill();
}

// ---------------------------------------------------------------- tête : peintures (sur le pelage, sous les traits)
function classFacePaint(ctx, look) {
  if (look.cls !== 'tigre') return;
  ctx.save(); headPath(ctx); ctx.clip();
  ctx.fillStyle = CC.blood; // griffures de guerre (joue proche + joue lointaine)
  for (let i = 0; i < 3; i++) taper(ctx, -47 + i * 5.2, -1 - i * 4.8, -29 + i * 5.2, 19 - i * 4.8, 4.8);
  for (let i = 0; i < 2; i++) taper(ctx, 48 - i * 1.5, 1 + i * 6, 37 - i * 1.5, 5 + i * 6, 3.8);
  ctx.restore();
}
// ---------------------------------------------------------------- tête : marques par-dessus les traits
function classFaceMarks(ctx, look) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (look.cls) {
    case 'botte': { // moustache en croc
      ctx.fillStyle = '#3b2230';
      taper(ctx, 18.5, 12, 5.5, 11, 4.4); taper(ctx, 20.5, 12, 31.5, 9.6, 3.8);
      ctx.beginPath(); ctx.moveTo(6, 11.2); ctx.quadraticCurveTo(1.2, 11.6, 2.4, 6.4); ctx.moveTo(31, 9.8); ctx.quadraticCurveTo(35, 9, 34, 4.6);
      ctx.lineWidth = 2.4; ctx.strokeStyle = '#3b2230'; ctx.stroke();
      break;
    }
    case 'noir': { // rune arcanique (front, entre les sourcils)
      const x = 16.5, y = -14.5;
      glow(ctx, x, y, 12, CC.vioG, 0.8);
      const g = () => { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 3.8, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 3.8, y); ctx.closePath(); ctx.moveTo(x, y - 9.5); ctx.lineTo(x, y - 7.2); ctx.moveTo(x - 6.4, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 6.4, y); };
      g(); ctx.lineWidth = 3.6; ctx.strokeStyle = rgba('#2a0f5a', 0.9); ctx.stroke();
      g(); ctx.lineWidth = 1.8; ctx.strokeStyle = '#c9fbff'; ctx.stroke();
      ell(ctx, x, y, 1.4, 1.4); ctx.fillStyle = '#ffffff'; ctx.fill();
      break;
    }
    case 'tigre': { // cicatrice recousue sur l'œil proche
      const sc = () => { ctx.beginPath(); ctx.moveTo(-14, -35); ctx.lineTo(-3.5, -16); ctx.moveTo(3, 12.5); ctx.lineTo(6.5, 19.5); };
      sc(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
      sc(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb8c0'; ctx.stroke();
      ctx.beginPath(); for (const s of [0.3, 0.64]) { const px = -14 + 10.5 * s, py = -35 + 19 * s; ctx.moveTo(px - 3.6, py + 1.8); ctx.lineTo(px + 3.6, py - 1.8); }
      ctx.lineWidth = 1.7; ctx.strokeStyle = OUT; ctx.stroke();
      break;
    }
    case 'siamois': { // points de chasseur sous les yeux
      for (const [x, y, r] of [[-9.5, 16, 2.6], [-2, 18, 2.6], [37.5, 14.5, 2], [42, 11, 1.8]]) {
        ell(ctx, x, y, r, r); paint(ctx, CC.forest, 1.4);
        ell(ctx, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
      }
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- couvre-chefs de classe (repère de la tête)
function hatMusketeer(ctx) {
  const brim = (c) => smooth(c, [[-60, -38], [-30, -30], [2, -28], [32, -32], [58, -41], [48, -47], [16, -50], [-16, -51], [-36, -57], [-50, -72], [-64, -60]], true, 0.45);
  toon(ctx, brim, shade(CC.felt, -0.16), { cx: -6, cy: -44, size: 30, lw: 2.8, hi: 0.12 });
  plume(ctx, cbez([-14, -52], [-14, -92], [-54, -100], [-70, -70], 16), 7, CC.crim, CC.crimD);
  plume(ctx, cbez([-10, -54], [-2, -108], [-62, -116], [-82, -78], 18), 10.5, CC.plume, CC.crim);
  const crown = (c) => smooth(c, [[-25, -44], [-25, -62], [-12, -75], [8, -76], [22, -65], [26, -46]], true, 0.5);
  toon(ctx, crown, CC.felt, { cx: -2, cy: -60, size: 24, lw: 2.8 });
  ctx.save(); crown(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(-1, -45); ctx.quadraticCurveTo(-4, -62, 2, -77); ctx.lineWidth = 2; ctx.strokeStyle = rgba(CC.crimD, 0.85); ctx.stroke(); ctx.restore();
  const band = (c) => { c.beginPath(); c.moveTo(-25.5, -44); c.quadraticCurveTo(0, -38, 26, -46); c.lineTo(25.5, -53); c.quadraticCurveTo(0, -46, -25.5, -52); c.closePath(); };
  toon(ctx, band, CC.gold, { cx: 0, cy: -48, size: 14, lw: 2.2, glint: false, hi: 0.3 });
  gem(ctx, -16, -48, 3.8, 5);
}
function hatWitch(ctx) {
  const brim = (c) => smooth(c, [[-60, -33], [-30, -25], [4, -23], [36, -27], [60, -36], [42, -43], [2, -46], [-38, -43]], true, 0.5);
  toon(ctx, brim, CC.indD, { cx: -4, cy: -36, size: 30, lw: 2.8, hi: 0.14, rim: '#c49aff', rimW: 4 });
  const cone = (c) => smooth(c, [[-26, -38], [-19, -62], [-11, -82], [-15, -94], [-28, -103], [-50, -114], [-32, -111], [-9, -102], [3, -86], [11, -63], [24, -38]], true, 0.32);
  toon(ctx, cone, CC.ind, { cx: -6, cy: -66, size: 30, lw: 2.8, rim: '#c49aff', rimW: 4.4 });
  ctx.save(); cone(ctx); ctx.clip();
  ctx.beginPath(); ctx.moveTo(-14, -89); ctx.quadraticCurveTo(-6, -93, 3, -88); ctx.lineWidth = 2; ctx.strokeStyle = rgba(OUT, 0.55); ctx.stroke();
  ctx.restore();
  const band = (c) => { c.beginPath(); c.moveTo(-26, -38); c.quadraticCurveTo(0, -32, 24, -38); c.lineTo(21.5, -48); c.quadraticCurveTo(0, -43, -23.5, -48); c.closePath(); };
  toon(ctx, band, CC.vio, { cx: 0, cy: -42, size: 14, lw: 2.2, glint: false, hi: 0.25 });
  const moon = (c) => { c.beginPath(); c.arc(-1, -41.5, 6.2, 0.6, 5.7); c.arc(2, -42.7, 5, 5.3, 1, true); c.closePath(); };
  toon(ctx, moon, '#ffe066', { cx: -2, cy: -42, size: 6, lw: 2, hi: 0.3 });
  star5(ctx, -7, -66, 5.2, 2.2); paint(ctx, '#ffe066', 1.6);
  star5(ctx, 7, -56, 3.4, 1.5); paint(ctx, '#ffffff', 1.3);
  star5(ctx, -27, -104, 2.8, 1.2); paint(ctx, '#ffe066', 1.2);
  glow(ctx, -51, -114, 15, CC.cyan, 0.85);
  star5(ctx, -51, -114, 6, 2.6, -0.3); paint(ctx, '#d6fdff', 1.7);
}
function hatHornHelm(ctx) {
  const horn = (P, w) => {
    const sh = (c) => ribbon(c, P, (s) => w * (1 - s * 0.86));
    toon(ctx, sh, CC.bone, { cx: P[4][0], cy: P[4][1], size: w * 2.2, lw: 0, glint: false, hi: 0.22, shadow: 0.24 });
    ctx.save(); sh(ctx); ctx.clip();
    const e = P[P.length - 1]; ell(ctx, e[0], e[1], w * 1.6, w * 1.6); ctx.fillStyle = '#6e5238'; ctx.fill();
    ctx.strokeStyle = rgba('#9a7a4c', 0.85); ctx.lineWidth = 1.6;
    for (const i of [3, 5, 7]) { const p = P[i], q = P[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, h = w * 1.2; ctx.beginPath(); ctx.moveTo(p[0] - dy / l * h, p[1] + dx / l * h); ctx.lineTo(p[0] + dy / l * h, p[1] - dx / l * h); ctx.stroke(); }
    ctx.restore();
    outline(ctx, sh, 2.6);
  };
  horn(cbez([30, -36], [48, -42], [60, -58], [52, -84], 12), 6.2);
  horn(cbez([-34, -30], [-60, -32], [-74, -50], [-66, -82], 12), 7.6);
  const dome = (c) => { c.beginPath(); c.moveTo(-47, -9); c.bezierCurveTo(-52, -62, 50, -68, 47, -13); c.quadraticCurveTo(30, -31, 12, -31); c.quadraticCurveTo(-22, -31, -47, -9); c.closePath(); };
  toon(ctx, dome, CC.bronze, { cx: -4, cy: -36, size: 34, lw: 0, hi: 0.26, shadow: 0.28 });
  ctx.save(); dome(ctx); ctx.clip();
  const crest = (c) => { c.beginPath(); c.moveTo(-6, -62); c.quadraticCurveTo(10, -52, 16, -31); c.lineTo(7, -31); c.quadraticCurveTo(2, -48, -14, -60); c.closePath(); };
  toon(ctx, crest, shade(CC.bronze, -0.2), { cx: 4, cy: -46, size: 10, lw: 2, glint: false, hi: 0.2 });
  ctx.restore();
  outline(ctx, dome, 3);
  const rimB = (c) => { c.beginPath(); c.moveTo(-47, -9); c.quadraticCurveTo(-22, -31, 12, -31); c.quadraticCurveTo(30, -31, 47, -13); c.lineTo(46.5, -20.5); c.quadraticCurveTo(30, -38.5, 12, -38.5); c.quadraticCurveTo(-24, -38.5, -46.5, -16.5); c.closePath(); };
  toon(ctx, rimB, shade(CC.bronze, -0.14), { cx: 0, cy: -32, size: 14, lw: 2.4, glint: false, hi: 0.2 });
  for (const [x, y] of [[-37, -21], [-22, -31], [-5, -34.5], [28, -33.5], [41, -22]]) { ell(ctx, x, y, 2.1, 2.1); paint(ctx, '#ffe2a6', 1.3); }
  const nasal = (c) => { c.beginPath(); c.moveTo(10.5, -37); c.lineTo(18.5, -37); c.lineTo(17.5, -15); c.quadraticCurveTo(14.5, -11, 11.5, -15); c.closePath(); };
  toon(ctx, nasal, shade(CC.bronze, -0.05), { cx: 14, cy: -26, size: 9, lw: 2.2, glint: false, hi: 0.25 });
}
function hatHeadband(ctx) {
  for (const [P, w] of [[cbez([-40, -17], [-54, -20], [-64, -10], [-76, -2], 8), 3.8], [cbez([-40, -14], [-52, -6], [-58, 6], [-64, 16], 8), 3.4]]) {
    const sh = (c) => ribbon(c, P, (s) => w * (1 - s * 0.2), 3.5);
    toon(ctx, sh, CC.crim, { cx: P[4][0], cy: P[4][1], size: 8, lw: 2.4, glint: false, hi: 0.15 });
  }
  const P = cbez([-48, -11], [-30, -33], [20, -40], [45, -18], 14);
  headWrap(ctx, (c) => ribbon(c, P, 4.8), CC.crim, { cx: 0, cy: -30, size: 24 });
  toon(ctx, (c) => smooth(c, [[-46, -20], [-38, -24], [-35, -14], [-42, -9]], true, 0.6), shade(CC.crim, -0.12), { cx: -40, cy: -16, size: 6, lw: 2.4, glint: false, hi: 0.1 });
  ctx.save(); ctx.translate(11, -32); ctx.rotate(0.07);
  toon(ctx, (c) => rr(c, -11.5, -6.5, 23, 13, 3.5), CC.steel, { cx: 0, cy: 0, size: 11, lw: 2.4, hi: 0.35, shadow: 0.3 });
  ctx.strokeStyle = rgba(OUT, 0.8); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const dx of [-4.2, 0, 4.2]) { ctx.beginPath(); ctx.moveTo(dx - 1.8, -3.8); ctx.quadraticCurveTo(dx + 0.6, -0.2, dx + 1.4, 3.8); ctx.stroke(); }
  ctx.fillStyle = rgba(OUT, 0.6);
  for (const [x, y] of [[-8.6, -3.8], [8.6, -3.8], [-8.6, 3.8], [8.6, 3.8]]) { ell(ctx, x, y, 1.1, 1.1); ctx.fill(); }
  ctx.restore();
}
function maskNinja(ctx, look) {
  const top = (c) => { c.moveTo(-48, 3); c.bezierCurveTo(-30, 14, -12, 15.5, 0, 14); c.quadraticCurveTo(10, 13, 13, 8); c.quadraticCurveTo(17, 1.5, 22, 5); c.quadraticCurveTo(25, 12.5, 33, 13); c.quadraticCurveTo(42, 12.8, 49, 5); };
  const m = (c) => { c.beginPath(); top(c); c.bezierCurveTo(54, 18, 48, 30, 38, 36); c.quadraticCurveTo(14, 46, -12, 41); c.quadraticCurveTo(-40, 36, -49, 18); c.closePath(); };
  const base = lum(look.fur) < 0.3 ? '#4b4766' : CC.cloth;
  toon(ctx, m, base, { cx: 0, cy: 24, size: 30, lw: 0, glint: false, hi: 0.12, shadow: 0.3 });
  ctx.save(); m(ctx); ctx.clip();
  ctx.strokeStyle = rgba(OUT, 0.5); ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-30, 26); ctx.quadraticCurveTo(-6, 33, 22, 27); ctx.moveTo(-18, 34); ctx.quadraticCurveTo(4, 40, 30, 33); ctx.stroke();
  ctx.beginPath(); top(ctx); ctx.lineWidth = 5.6; ctx.strokeStyle = CC.crim; ctx.stroke();
  ctx.restore();
  outline(ctx, m, 2.8);
}
// Capuches (chasseur : verte à oreilles + plume ; faucheur : noire en pointe, bord déchiqueté)
const HOODS = {
  siamois: {
    out: [[-48, -30], [-44, -50], [-46, -76], [-24, -50], [-6, -49], [12, -50], [30, -74], [36, -46], [47, -30], [53, -8], [52, 14], [45, 30], [28, 40], [6, 44], [-18, 43], [-38, 37], [-50, 24], [-54, 4]],
    hole: [[-15, -30], [10, -34], [33, -28], [45, -12], [47, 7], [40, 25], [21, 32], [-4, 32], [-22, 24], [-28, 6], [-26, -15]],
    col: CC.forest, t: 0.34, shadow: 0.42,
  },
  sphynx: {
    out: [[-34, -52], [-32, -72], [-26, -96], [-8, -72], [18, -58], [44, -40], [58, -14], [59, 14], [53, 34], [42, 47], [30, 40], [18, 53], [6, 44], [-8, 55], [-20, 45], [-34, 54], [-46, 42], [-60, 47], [-64, 24], [-66, -8], [-56, -34]],
    hole: [[-13, -26], [12, -29], [34, -24], [46, -8], [47, 8], [40, 25], [20, 31], [-4, 31], [-20, 23], [-26, 6], [-24, -10]],
    col: CC.void, t: 0.28, shadow: 0.9,
  },
};
function drawHood(ctx, look, cls, mode) {
  const H = HOODS[cls], holeR = H.hole.slice().reverse();
  const sh = (c) => { smooth(c, H.out, true, H.t); smooth(c, holeR, true, 0.5, false); };
  const hole = (c) => smooth(c, H.hole, true, 0.5);
  const reaper = cls === 'sphynx';
  if (!reaper) plume(ctx, cbez([-30, -42], [-50, -54], [-62, -72], [-72, -92], 12), 7, CC.feather, CC.featherT);
  toon(ctx, sh, H.col, { cx: -10, cy: -24, size: 46, lw: 0, hi: reaper ? 0.16 : 0.14, shadow: 0.26, glint: false, ...(reaper ? { rim: CC.ghost, rimW: 5, rimA: 0.72 } : {}) });
  ctx.save(); sh(ctx); ctx.clip();
  if (!reaper) { // plis + bordure de cuir
    ctx.beginPath(); ctx.moveTo(-36, -50); ctx.quadraticCurveTo(-42, -20, -42, 32); ctx.moveTo(-10, -48); ctx.quadraticCurveTo(-30, -34, -34, -12); ctx.lineWidth = 2; ctx.strokeStyle = rgba(CC.forestD, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-52, 22); ctx.quadraticCurveTo(-36, 40, 6, 45); ctx.quadraticCurveTo(30, 42, 46, 30); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.6; ctx.strokeStyle = CC.leather; ctx.stroke();
  }
  else { ctx.beginPath(); ctx.moveTo(-24, -86); ctx.quadraticCurveTo(-34, -40, -50, 40); ctx.moveTo(-14, -70); ctx.quadraticCurveTo(30, -50, 50, 30); ctx.lineWidth = 2; ctx.strokeStyle = rgba('#5a4f78', 0.7); ctx.stroke(); }
  hole(ctx); ctx.lineWidth = 10; ctx.strokeStyle = shade(H.col, -0.5); ctx.stroke();
  ctx.restore();
  // ombre portée de la capuche sur le front
  ctx.save(); hole(ctx); ctx.clip();
  const g = ctx.createLinearGradient(0, -34, 0, reaper ? 4 : -12);
  g.addColorStop(0, rgba('#0c0716', H.shadow)); g.addColorStop(1, rgba('#0c0716', 0));
  ctx.fillStyle = g; ctx.fillRect(-60, -40, 120, 50);
  ctx.restore();
  outline(ctx, sh, 3);
  if (reaper && (mode === 'normal' || mode === false)) { // les yeux percent l'ombre
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, EYE_N[0], EYE_N[1], 15, CC.ghost, 0.7); glow(ctx, EYE_F[0], EYE_F[1], 12, CC.ghost, 0.7);
    ctx.restore();
    for (const [x, y, rx, ry] of [[EYE_N[0], EYE_N[1], EYE_N[2], EYE_N[3]], [EYE_F[0], EYE_F[1], EYE_F[2], EYE_F[3]]]) { ell(ctx, x + rx * 0.22, y + ry * 0.11, rx * 0.15, ry * 0.6); ctx.fillStyle = '#f2fff8'; ctx.fill(); }
  }
}
function featherEarring(ctx) {
  const x = -46, y = -6;
  ctx.beginPath(); ctx.arc(x, y + 2.4, 2.9, 0, TAU); ctx.lineWidth = 3.8; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.9; ctx.strokeStyle = CC.gold; ctx.stroke();
  ell(ctx, x - 0.5, y + 7.6, 2.3, 2.3); paint(ctx, CC.leaf, 1.4);
  plume(ctx, qbez([x - 0.5, y + 9], [x - 3, y + 18], [x - 8, y + 26], 6), 3.6, CC.feather, CC.featherT);
}

// ---------------------------------------------------------------- torse (repère du torse) ; layer 0 : sur le pelage, 1 : par-dessus l'armure
function drawClassBody(ctx, look, layer) {
  const cls = look.cls;
  if (layer === 0) {
    if (cls === 'tigre') { ctx.save(); torsoPath(ctx); ctx.clip(); ctx.fillStyle = CC.blood; for (let i = 0; i < 3; i++) taper(ctx, 4 + i * 6, -8 + i * 1.5, -4 + i * 6, 16 + i * 1.5, 4.4); ctx.restore(); }
    return;
  }
  switch (cls) {
    case 'botte': {
      const P = qbez([25, -22], [3, -1], [-27, 21], 10);
      strap(ctx, (c) => ribbon(c, P, 4.3), CC.strap, { size: 18 });
      const m = P[5], a = Math.atan2(P[6][1] - P[4][1], P[6][0] - P[4][0]);
      ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(a);
      toon(ctx, (c) => rr(c, -5.5, -6.5, 11, 13, 3), CC.gold, { cx: 0, cy: 0, size: 8, lw: 2.2, hi: 0.3, shadow: 0.3 });
      rr(ctx, -2.6, -3.6, 5.2, 7.2, 1.6); ctx.fillStyle = shade(CC.strap, -0.3); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2.6, 0); ctx.lineTo(3.4, 0); ctx.lineWidth = 1.8; ctx.strokeStyle = CC.gold; ctx.stroke();
      ctx.restore();
      // jabot de dentelle
      const tier = (y, w, h, n) => (c) => {
        c.beginPath(); c.moveTo(7 - w * 0.32, y); c.lineTo(7 + w * 0.32, y); c.lineTo(7 + w / 2, y + h);
        const st = w / n; for (let i = 0; i < n; i++) { const x0 = 7 + w / 2 - i * st, x1 = x0 - st; c.quadraticCurveTo((x0 + x1) / 2, y + h + 3.8, x1, y + h); }
        c.closePath();
      };
      for (const [y, w, h, n] of [[-17, 17, 9, 3], [-11, 15, 8, 3], [-5.5, 11, 7, 2]]) toon(ctx, tier(y, w, h, n), CC.lace, { cx: 7, cy: y + h / 2, size: w * 0.5, lw: 2, glint: false, hi: 0, shadow: 0.14 });
      gem(ctx, 7, -9, 2.6, 5);
      break;
    }
    case 'noir': {
      ctx.beginPath(); ctx.moveTo(-5, -16); ctx.quadraticCurveTo(-2, -4, 3, -1); ctx.quadraticCurveTo(12, -5, 17, -15);
      ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffe08a'; ctx.stroke();
      glow(ctx, 3, 5, 14, CC.vioG, 0.55);
      const moon = (c) => { c.beginPath(); c.arc(3, 5, 7, 0.6, 5.7); c.arc(6.2, 3.8, 5.6, 5.3, 1, true); c.closePath(); };
      toon(ctx, moon, '#ffe27a', { cx: 1, cy: 5, size: 7, lw: 2.2, hi: 0.3 });
      gem(ctx, 9, 8, 1.9, 3);
      break;
    }
    case 'ninja': {
      strap(ctx, (c) => ribbon(c, qbez([-24, 11], [0, 17], [24, 9], 8), 3.4), CC.cloth, { cy: 13, size: 14 });
      ctx.save(); ctx.translate(-18, 12); ctx.rotate(0.3);
      for (const [x, a] of [[-2.6, -0.24], [2.4, 0.12]]) {
        ctx.save(); ctx.translate(x, -5); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9); ctx.lineWidth = 5.8; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = CC.crim; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -12, 2.7, 0, TAU); ctx.lineWidth = 3.8; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.8; ctx.strokeStyle = CC.steel; ctx.stroke();
        ctx.restore();
      }
      toon(ctx, (c) => rr(c, -6.5, -6, 13, 14, 3.5), '#3a2f3a', { cx: 0, cy: 1, size: 9, lw: 2.4, glint: false, hi: 0.18 });
      ctx.beginPath(); ctx.moveTo(-5.5, -1.5); ctx.lineTo(5.5, -1.5); ctx.lineWidth = 1.8; ctx.strokeStyle = CC.crim; ctx.stroke();
      ctx.restore();
      shuriken(ctx, 8, 14, 6.6);
      // écharpe : tour de cou + nœud (les pans sont animés)
      const w = (c) => { c.beginPath(); c.moveTo(-20, -20); c.quadraticCurveTo(3, -7, 26, -21); c.lineTo(25, -10); c.quadraticCurveTo(4, 5, -19, -8); c.closePath(); };
      toon(ctx, w, CC.crim, { cx: 3, cy: -10, size: 16, lw: 2.6, hi: 0.18 });
      ctx.save(); w(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(-16, -13); ctx.quadraticCurveTo(4, -2, 24, -15); ctx.lineWidth = 1.8; ctx.strokeStyle = rgba(CC.crimD, 0.75); ctx.stroke(); ctx.restore();
      toon(ctx, (c) => smooth(c, [[-25, -17], [-16, -21], [-10, -13], [-14, -5], [-23, -6]], true, 0.5), shade(CC.crim, -0.1), { cx: -17, cy: -12, size: 7, lw: 2.4, glint: false });
      break;
    }
    case 'siamois':
      strap(ctx, (c) => ribbon(c, qbez([-26, -18], [-2, 0], [24, 21], 10), 2.7), CC.leather, { size: 12 });
      break;
    case 'sphynx': {
      strap(ctx, (c) => ribbon(c, qbez([-24, 10], [0, 17], [24, 8], 8), 4.4), CC.void, { cy: 12, size: 14 });
      const tat = (c) => { c.beginPath(); c.moveTo(-20, 10); c.lineTo(-9, 13); c.lineTo(-8, 21); c.lineTo(-11, 30); c.lineTo(-13.5, 24); c.lineTo(-16, 32); c.lineTo(-18.5, 25); c.lineTo(-22, 29); c.lineTo(-23, 18); c.closePath(); };
      toon(ctx, tat, CC.voidL, { cx: -15, cy: 19, size: 10, lw: 2.2, glint: false, hi: 0.12 });
      const C = qbez([-22, 4], [0, 14], [22, 2], 9);
      for (let i = 0; i < C.length; i++) {
        const p = C[Math.max(0, i - 1)], q = C[Math.min(C.length - 1, i + 1)];
        ctx.save(); ctx.translate(C[i][0], C[i][1]); ctx.rotate(Math.atan2(q[1] - p[1], q[0] - p[0]) + (i % 2 ? Math.PI / 2 : 0));
        ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.9, 0, 0, TAU); ctx.lineWidth = 3.8; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.8; ctx.strokeStyle = '#d3dae6'; ctx.stroke();
        ctx.restore();
      }
      glow(ctx, 1, 9, 10, CC.ghost, 0.75); ell(ctx, 1, 9, 3.6, 3.6); paint(ctx, CC.ghost, 1.8);
      ell(ctx, 0, 8, 1.2, 1.2); ctx.fillStyle = '#ffffff'; ctx.fill();
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- pièces pré-rendues (repère du buste du héros)
function drawHalfCape(ctx) {
  const sh = (c) => { c.beginPath(); c.moveTo(12, -62); c.bezierCurveTo(-4, -72, -32, -68, -41, -53); c.quadraticCurveTo(-52, -36, -50, -14); c.quadraticCurveTo(-32, -7, -16, -17); c.quadraticCurveTo(-4, -26, 6, -44); c.closePath(); };
  toon(ctx, sh, CC.crim, { cx: -20, cy: -48, size: 24, lw: 0, hi: 0.18, shadow: 0.3 });
  ctx.save(); sh(ctx); ctx.clip();
  ctx.strokeStyle = rgba(CC.crimD, 0.75); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-14, -61); ctx.quadraticCurveTo(-30, -44, -33, -16); ctx.moveTo(-2, -58); ctx.quadraticCurveTo(-14, -42, -15, -22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-52, -17); ctx.quadraticCurveTo(-32, -10, -16, -20); ctx.quadraticCurveTo(-4, -29, 7, -47);
  ctx.lineWidth = 10; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 5.4; ctx.strokeStyle = CC.gold; ctx.stroke();
  ctx.restore();
  outline(ctx, sh, 2.8);
  ctx.save(); ctx.translate(-31, -38); ctx.rotate(0.2); // croix d'or
  ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.42) * 7, Math.sin(a - 0.42) * 7); ctx.lineTo(Math.cos(a + 0.42) * 7, Math.sin(a + 0.42) * 7); ctx.closePath(); }
  paint(ctx, CC.gold, 1.6);
  ctx.restore();
}
function drawQuiver(ctx) {
  ctx.save(); ctx.translate(-22, -40); ctx.rotate(-1.08);
  for (const [x, len, fc, a] of [[5, 44, '#f6f1e8', 0.16], [-5, 48, CC.leaf, -0.16], [0, 56, CC.feather, 0]]) {
    ctx.save(); ctx.translate(x * 0.6, -10); ctx.rotate(a);
    const y0 = -len * 0.62;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, y0);
    ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#dcb47c'; ctx.stroke();
    for (const s of [-1, 1]) {
      const f = (c) => { c.beginPath(); c.moveTo(0, y0 + 12); c.quadraticCurveTo(s * 7, y0 + 8, s * 6.4, y0 - 2.5); c.quadraticCurveTo(s * 2.6, y0 - 1.2, 0, y0 - 4.5); c.closePath(); };
      toon(ctx, f, s < 0 ? fc : shade(fc, -0.14), { cx: s * 3, cy: y0 + 2, size: 6, lw: 2, glint: false, hi: 0.22 });
    }
    ctx.restore();
  }
  const q = (c) => { c.beginPath(); c.moveTo(-9.5, -14); c.lineTo(9.5, -14); c.lineTo(7.5, 25); c.quadraticCurveTo(0, 29, -7.5, 25); c.closePath(); };
  toon(ctx, q, CC.leather, { cx: 0, cy: 5, size: 18, lw: 2.8, hi: 0.18 });
  ctx.save(); q(ctx); ctx.clip();
  toon(ctx, (c) => rr(c, -11, 8, 22, 5, 1), shade(CC.leather, -0.3), { cx: 0, cy: 10, size: 8, lw: 1.8, glint: false, hi: 0, rim: false });
  ctx.restore();
  toon(ctx, (c) => rr(c, -10.5, -17, 21, 6.5, 3), CC.gold, { cx: 0, cy: -14, size: 9, lw: 2.2, glint: false, hi: 0.3 });
  ctx.restore();
}
function drawGrimoireSprite(ctx) {
  const cover = (c) => { c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(-9, -13.5, -19.5, -11); c.lineTo(-20, 10); c.quadraticCurveTo(-9, 8, 0, 12); c.quadraticCurveTo(9, 8, 20, 10); c.lineTo(19.5, -11); c.quadraticCurveTo(9, -13.5, 0, -9); c.closePath(); };
  toon(ctx, cover, CC.ind, { cx: 0, cy: 0, size: 18, lw: 2.8 });
  for (const s of [-1, 1]) {
    const pg = (c) => { c.beginPath(); c.moveTo(0, -9.5); c.quadraticCurveTo(s * 8, -14, s * 17, -12); c.lineTo(s * 17, 6.5); c.quadraticCurveTo(s * 8, 4.6, 0, 8.5); c.closePath(); };
    toon(ctx, pg, CC.page, { cx: s * 8, cy: -2, size: 10, lw: 2, glint: false, hi: 0, shadow: s > 0 ? 0.2 : 0.08, rim: false });
    glow(ctx, s * 9, -2, 9, s < 0 ? CC.vioG : CC.cyan, 0.55);
    ctx.strokeStyle = s < 0 ? '#7d33e6' : '#1aa6c7'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const y of [-7, -3, 1]) { ctx.beginPath(); ctx.moveTo(s * 3.5, y - 0.2); ctx.lineTo(s * (y === -3 ? 11 : 14), y - 0.9 - (y + 7) * 0.05); ctx.stroke(); }
  }
  ctx.beginPath(); ctx.arc(10, 2.5, 3, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1aa6c7'; ctx.stroke();
  for (const s of [-1, 1]) { poly(ctx, [[s * 20, 10], [s * 14, 9.6], [s * 19.8, 4]]); paint(ctx, '#ffd84d', 1.4); }
  ctx.beginPath(); ctx.moveTo(1, 10); ctx.quadraticCurveTo(3, 15, 1, 19); ctx.lineWidth = 4.4; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = CC.cyan; ctx.stroke();
}
function drawPeltMantle(ctx) {
  const pts = [[-6, -74], [14, -70], [26, -58], [20, -46], [4, -44], [-8, -42], [-12, -31], [-19, -40], [-28, -30], [-32, -41], [-45, -36], [-42, -48], [-56, -50], [-45, -58], [-54, -70], [-37, -67], [-34, -80], [-20, -72]];
  const sh = (c) => smooth(c, pts, true, 0.18);
  toon(ctx, sh, CC.pelt, { cx: -12, cy: -56, size: 26, lw: 2.8, glint: false, hi: 0.2 });
  ctx.save(); sh(ctx); ctx.clip(); ctx.strokeStyle = rgba(CC.peltL, 0.9); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const [x, y] of [[-40, -50], [-30, -43], [-21, -40], [-38, -60], [-27, -66], [-14, -64]]) { ctx.beginPath(); ctx.moveTo(x + 3, y - 4); ctx.quadraticCurveTo(x, y, x - 1, y + 5); ctx.stroke(); }
  ctx.restore();
}
function drawPeltPauldron(ctx) {
  const pts = [[-1, -48], [8, -53], [20, -54], [30, -49], [34, -41], [30, -32], [26, -37], [22, -29], [18, -36], [13, -29], [9, -36], [4, -31], [1, -38], [-3, -42]];
  const sh = (c) => smooth(c, pts, true, 0.2);
  toon(ctx, sh, CC.pelt, { cx: 15, cy: -44, size: 15, lw: 2.8, glint: false, hi: 0.24 });
  ctx.save(); sh(ctx); ctx.clip(); ctx.strokeStyle = rgba(CC.peltL, 0.95); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const [x, y] of [[7, -45], [14, -47], [21, -46], [27, -41]]) { ctx.beginPath(); ctx.moveTo(x - 2, y - 3); ctx.quadraticCurveTo(x, y, x + 1, y + 6); ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(9, -36); ctx.quadraticCurveTo(15, -29, 22, -33); ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.7; ctx.strokeStyle = '#7a4a2a'; ctx.stroke();
  const tooth = (c) => { c.beginPath(); c.moveTo(12.5, -32); c.quadraticCurveTo(13.5, -23, 18.5, -18); c.quadraticCurveTo(18.6, -25.5, 18.2, -32.5); c.closePath(); };
  toon(ctx, tooth, CC.bone, { cx: 16, cy: -27, size: 5, lw: 2.1, glint: false, hi: 0.3 });
  ell(ctx, 3.5, -44, 2.8, 2.8); paint(ctx, CC.bronze, 1.7);
}
function drawSkullPauldron(ctx) {
  const plate = (c) => smooth(c, [[-1, -45], [6, -52], [18, -54], [29, -49], [32, -40], [25, -35], [13, -35], [3, -38]], true, 0.5);
  toon(ctx, plate, '#3d3650', { cx: 15, cy: -45, size: 15, lw: 2.8, hi: 0.22 });
  for (const [x, y, a] of [[5, -50, -0.9], [28, -48, 0.7]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    poly(ctx, [[-2.6, 0], [0, -8], [2.6, 0]]); paint(ctx, CC.bone, 1.8);
    ctx.restore();
  }
  const cx = 16.5, cy = -45;
  const skull = (c) => { c.beginPath(); c.arc(cx, cy - 1.5, 7.2, Math.PI * 0.82, Math.PI * 2.18); c.lineTo(cx + 4.6, cy + 6.6); c.lineTo(cx - 4.6, cy + 6.6); c.closePath(); };
  toon(ctx, skull, CC.bone, { cx, cy: cy - 1, size: 7.5, lw: 2.2, hi: 0.25 });
  ctx.fillStyle = '#1a1424';
  ell(ctx, cx - 2.9, cy - 0.6, 2.3, 2.7); ctx.fill(); ell(ctx, cx + 2.9, cy - 0.6, 2.3, 2.7); ctx.fill();
  glow(ctx, cx - 2.9, cy - 0.6, 3.6, CC.ghost, 0.95); glow(ctx, cx + 2.9, cy - 0.6, 3.6, CC.ghost, 0.95);
  poly(ctx, [[cx, cy + 2], [cx - 1.3, cy + 4.2], [cx + 1.3, cy + 4.2]]); ctx.fillStyle = '#1a1424'; ctx.fill();
  ctx.strokeStyle = rgba(OUT, 0.75); ctx.lineWidth = 1.2;
  for (const dx of [-2.1, 0, 2.1]) { ctx.beginPath(); ctx.moveTo(cx + dx, cy + 4.8); ctx.lineTo(cx + dx, cy + 6.6); ctx.stroke(); }
}
// Sprites de classe du héros adulte : back (dos, derrière le corps), front (épaulière), book (grimoire)
function buildClassSprites(look, gear) {
  const S = {};
  switch (look.cls) {
    case 'botte': if (!gear.cape) S.back = makeSprite(-58, -78, 76, 72, drawHalfCape); break;
    case 'noir': S.book = makeSprite(-24, -18, 48, 40, drawGrimoireSprite, 2.6); break;
    case 'tigre': S.back = makeSprite(-62, -86, 92, 60, drawPeltMantle); S.front = makeSprite(-8, -60, 46, 46, drawPeltPauldron); break;
    case 'siamois': S.back = makeSprite(-90, -96, 106, 88, drawQuiver); break;
    case 'sphynx': S.front = makeSprite(-8, -64, 46, 34, drawSkullPauldron); break;
    default: break;
  }
  return S;
}

// mode : false | 'normal' | true | 'blink' | 'hurt'
function drawHeadFull(ctx, look, mode, gear) {
  mode = mode === true ? 'blink' : mode || 'normal';
  const hasHat = !!(gear && gear.hat);
  const cls = look.cls || null;
  const ch = cls && !hasHat ? cls : null; // couvre-chef de classe (emplacement chapeau vide)
  const hood = ch === 'siamois' || ch === 'sphynx';
  if (!hood && ch !== 'tigre') { // capuches et casque à cornes couvrent les oreilles
    drawEar(ctx, look, true);
    drawEar(ctx, look, false);
  }
  drawCheekTufts(ctx, look);
  if (!hasHat && !look.acc && (!ch || ch === 'ninja')) drawForelock(ctx, look);
  furShape(ctx, headPath, look.fur, { cx: -4, cy: -8, size: 42, rim: look.rim, rimW: look.rimW, lw: 0 }, look.pattern !== 'solid' ? (c, dk) => patternOnHead(c, look, dk) : null);
  if (cls) classFacePaint(ctx, look);
  const fl = cls === 'noir' ? { ...look, eye: '#a54dff', eye2: null, eyeGlow: CC.vioG } : cls === 'sphynx' ? { ...look, eye: '#2ee88a', eye2: null, eyeGlow: CC.ghost } : look;
  drawFaceFeatures(ctx, fl, mode);
  if (cls) classFaceMarks(ctx, look);
  outline(ctx, headPath, 3.4);
  if (hood) drawHood(ctx, look, ch, mode);
  drawWhiskers(ctx, look);
  if (gear && gear.face) drawFace(ctx, gear.face.base, gear.face.r);
  else if (cls === 'ninja') maskNinja(ctx, look);
  if (look.acc) drawKittenAcc(ctx, look.acc, look.accColor);
  if (hasHat) { ctx.save(); ctx.translate(3, -31); ctx.rotate(-0.05); drawHat(ctx, gear.hat.base, gear.hat.r); ctx.restore(); }
  else if (ch === 'botte') hatMusketeer(ctx);
  else if (ch === 'noir') hatWitch(ctx);
  else if (ch === 'tigre') hatHornHelm(ctx);
  else if (ch === 'ninja') hatHeadband(ctx);
  if (cls === 'siamois') featherEarring(ctx);
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
  if (look.cls) drawClassBody(ctx, look, 0);
  if (gear && gear.armor) drawArmorOnBody(ctx, gear.armor.base, gear.armor.r);
  if (look.cls) drawClassBody(ctx, look, 1);
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
    if (look.cls === 'tigre') { // poignet bandé
      const w = (cx) => rr(cx, -6.5, 3.6, 13, 5.4, 2);
      toon(ctx, w, back ? shade(CC.band, -0.18) : CC.band, { cx: 0, cy: 6, size: 6, lw: 2, rim: false, glint: false, hi: 0 });
    }
    return;
  }
  const sh = (cx) => ell(cx, 1, 0, 7.6, 7);
  toon(ctx, sh, c, { cx: 1, cy: 0, size: 8, lw: 2.8, rim: look.rim, rimW: look.rimW, glint: false, hi: 0.2 });
  ctx.beginPath(); ctx.moveTo(4.4, -5); ctx.quadraticCurveTo(6.4, -3.4, 6.4, -2.2); ctx.moveTo(4.8, 0); ctx.quadraticCurveTo(7.2, 1, 7.4, 2.4);
  ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(OUT, 0.6); ctx.lineCap = 'round'; ctx.stroke();
  if (look.cls === 'tigre') { // bandage croisé sur les jointures
    const bc = back ? shade(CC.band, -0.18) : CC.band;
    const w = (cx) => { cx.beginPath(); cx.moveTo(-6.6, -5.2); cx.lineTo(-1.4, -7.4); cx.lineTo(0.6, 7.2); cx.lineTo(-5.2, 5.8); cx.closePath(); };
    ctx.save(); sh(ctx); ctx.clip(); toon(ctx, w, bc, { cx: -3, cy: 0, size: 6, lw: 2, rim: false, glint: false, hi: 0 });
    ctx.beginPath(); ctx.moveTo(-5.6, 2); ctx.lineTo(-0.6, -2.4); ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(OUT, 0.55); ctx.stroke(); ctx.restore();
    sh(ctx); ctx.lineWidth = 2.8; ctx.strokeStyle = OUT; ctx.stroke();
  }
}
// Botte de cavalier (Chat Botté, emplacement bottes vide) : pied ; la tige et le revers sont tracés en direct
function drawCavalierFoot(ctx, back) {
  const c = back ? shade(CC.boot, -0.2) : CC.boot;
  const sh = (cx) => { cx.beginPath(); cx.moveTo(-7.5, -10); cx.lineTo(5.5, -10); cx.lineTo(5.5, -3.6); cx.quadraticCurveTo(13.8, -3.4, 15.8, 2.6); cx.quadraticCurveTo(16.2, 6.6, 12.4, 6.6); cx.lineTo(-8.5, 6.6); cx.closePath(); };
  toon(ctx, sh, c, { cx: 3, cy: -2, size: 11, lw: 2.6, hi: 0.22 });
  toon(ctx, (cx) => rr(cx, -9, 3.2, 7.5, 5, 1.6), shade(c, -0.35), { cx: -5, cy: 5, size: 4, lw: 2, glint: false, hi: 0, rim: false });
  ctx.beginPath(); ctx.moveTo(-1, 6.6); ctx.lineTo(14.5, 6.6); ctx.lineWidth = 2; ctx.strokeStyle = rgba(OUT, 0.7); ctx.stroke();
  star5(ctx, -9.6, 0.4, 3.4, 1.4, 0.2); paint(ctx, CC.gold, 1.4); // éperon
}
function drawFoot(ctx, look, back) {
  if (look.cls === 'botte') { drawCavalierFoot(ctx, back); return; }
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
    cls: !a.baby && CLASS_IDS.includes(a.cls) ? a.cls : null, // tenue de classe (adultes seulement)
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
        const hb = L.cls ? HEAD_BOX_CLS : HEAD_BOX;
        this.head = makeSprite(hb[0], hb[1], hb[2], hb[3], (ctx) => drawHeadFull(ctx, L, 'normal', G), 2.2);
        this.headBlink = makeSprite(hb[0], hb[1], hb[2], hb[3], (ctx) => drawHeadFull(ctx, L, 'blink', G), 2.2);
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
        // tenue de classe : pièces pré-rendues (dos, épaulière, grimoire)
        this.cls = L.cls;
        this.clsS = L.cls ? buildClassSprites(L, G) : null;
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
      const hb = this.look.cls ? HEAD_BOX_CLS : HEAD_BOX;
      try { this._headHurt = makeSprite(hb[0], hb[1], hb[2], hb[3], (ctx) => drawHeadFull(ctx, this.look, 'hurt', this.gear), 2.2); } finally { setRim(null); }
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
    if (this.cls) this.classBehind(ctx, st, k, 0);
    this.drawTailHero(ctx, st);
    if (this.cls) this.classBehind(ctx, st, k, 1);
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
    if (this.cls) this.classFront(ctx, P, st, k, face);
    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------- tenue de classe : parties animées (repère du buste)
  classBehind(ctx, st, k, phase) {
    const S = this.clsS, t = this.t;
    switch (this.cls) {
      case 'botte': // demi-cape (sauf si une cape est équipée) : balancement, gonflée par la course
        if (phase === 0 && S.back) {
          const run = st === 'run';
          const rot = run ? 0.2 + Math.sin(t * 9) * 0.06 : Math.sin(t * 2.4) * 0.04 + (st === 'attack' ? 0.12 * Math.sin(Math.min(1, k) * Math.PI) : 0);
          ctx.save(); ctx.translate(2, -58); ctx.rotate(rot); if (run) ctx.scale(1.08, 0.96);
          drawSprite(ctx, S.back, -2, 58);
          ctx.restore();
        }
        break;
      case 'tigre': if (phase === 1) drawSprite(ctx, S.back, 0, 0); break; // par-dessus la queue
      case 'sphynx': if (phase === 0) this.drawWisps(ctx, st, k, false); break;
      case 'siamois': if (phase === 1) drawSprite(ctx, S.back, 0, 0); break;
      case 'ninja': if (phase === 1) this.drawScarfTails(ctx, st); break;
      case 'noir': if (phase === 1) this.drawGrimoire(ctx, st, k); break;
      default: break;
    }
  }
  classFront(ctx, P, st, k, face) {
    const t = this.t, cls = this.cls;
    if (cls === 'sphynx') this.drawWisps(ctx, st, k, true);
    if (cls === 'noir' && st === 'cast') { // anneaux arcaniques autour de la patte
      const q = Math.sin(Math.min(1, k) * Math.PI);
      ctx.save(); ctx.translate(P.hx, P.hy);
      for (let j = 0; j < 2; j++) {
        const rx = 15 + j * 6, ry = 5 + j * 2;
        ctx.save(); ctx.rotate(j ? -0.7 + t * 0.7 : 0.5 - t * 0.5);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.lineWidth = 4; ctx.strokeStyle = rgba('#2a0f5a', 0.35 * q); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = rgba(j ? CC.cyan : CC.vioG, 0.9 * q); ctx.stroke();
        for (let m = 0; m < 3; m++) { const b = t * (j ? -3 : 3.6) + m * TAU / 3; ell(ctx, Math.cos(b) * rx, Math.sin(b) * ry, 1.9, 1.9); ctx.fillStyle = rgba('#ffffff', q); ctx.fill(); }
        ctx.restore();
      }
      ctx.restore();
    }
    const head = () => { ctx.translate(HEAD_X, HEAD_Y); ctx.rotate(P.tilt); ctx.scale(HEAD_S, HEAD_S); };
    if ((cls === 'noir' || cls === 'sphynx') && face === 'normal') { // lueur des yeux (pulsation)
      const c = cls === 'noir' ? CC.vioG : CC.ghost;
      const a = 0.2 + 0.12 * Math.sin(t * 4.2) + (st === 'cast' ? 0.3 * Math.sin(Math.min(1, k) * Math.PI) : 0);
      ctx.save(); head(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, EYE_N[0] + 2, EYE_N[1], 18, c, a); glow(ctx, EYE_F[0] + 1, EYE_F[1], 15, c, a);
      ctx.restore();
    }
    if (cls === 'tigre' && st === 'attack') { // rage : veine de colère + vapeur aux naseaux
      const a = Math.sin(Math.min(1, k) * Math.PI);
      if (a > 0.05) {
        ctx.save(); head();
        ctx.save(); ctx.translate(-26, -50); const s = 0.7 + a * 0.6; ctx.scale(s, s);
        ctx.beginPath();
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.moveTo(sx * 2.4, sy * 8.5); ctx.quadraticCurveTo(sx * 2.4, sy * 2.4, sx * 8.5, sy * 2.4); }
        ctx.lineCap = 'round'; ctx.lineWidth = 6.4; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = '#ff3045'; ctx.stroke();
        ctx.restore();
        for (let j = 0; j < 2; j++) {
          const ph = (k * 2.4 + j * 0.5) % 1, r = 3 + ph * 4.5;
          ctx.globalAlpha = a * (1 - ph) * 0.95;
          ell(ctx, 32 + ph * 18, 11 + j * 5 - ph * 7, r, r * 0.8); paint(ctx, '#ffffff', 2);
        }
        ctx.restore();
      }
    }
  }
  // Pans de l'écharpe du ninja : ondulent, flottent à l'horizontale en course / attaque
  drawScarfTails(ctx, st) {
    const t = this.t, fast = st === 'run' || st === 'attack';
    const x0 = -16, y0 = -53;
    for (let j = 1; j >= 0; j--) {
      const len = (j ? 44 : 60) * (fast ? 1.2 : 1);
      const P = [];
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        const w = Math.sin(t * (fast ? 14 : 3.8) - s * (fast ? 7.5 : 4.8) + j * 1.9) * s * (fast ? 7.5 : 5.5);
        P.push([x0 + j * 2 - s * len * (fast ? 1 : 0.86), y0 + j * 3 + (fast ? -s * 6 + s * s * (j ? 12 : 5) : s * s * (j ? 24 : 18)) + w]);
      }
      const sh = (c) => ribbon(c, P, (s) => 5.4 - s * 1.4 - j * 0.5, 5);
      sh(ctx); ctx.fillStyle = j ? CC.crimD : CC.crim; ctx.fill();
      ctx.beginPath(); ctx.moveTo(P[0][0] - 0.6, P[0][1] - 1.7); for (let i = 1; i < 8; i++) ctx.lineTo(P[i][0] - 0.6, P[i][1] - 1.7);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = rgba('#ff8fa0', j ? 0.35 : 0.65); ctx.stroke();
      sh(ctx); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
    }
  }
  // Grimoire flottant près de l'épaule arrière (pages luisantes, runes qui s'envolent)
  drawGrimoire(ctx, st, k) {
    const t = this.t, fade = st === 'dead' ? Math.max(0, 1 - Math.min(1, k) * 1.5) : 1;
    if (fade <= 0) return;
    const q = st === 'cast' ? Math.sin(Math.min(1, k) * Math.PI) : 0;
    const x = -57 - q * 3, y = -88 + Math.sin(t * 2.2) * 3.5 - q * 6;
    ctx.save(); ctx.globalAlpha *= fade;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - 2, 24 + q * 14, CC.vio, 0.3 + 0.08 * Math.sin(t * 4.4) + q * 0.4);
    ctx.globalCompositeOperation = 'source-over';
    drawSprite(ctx, this.clsS.book, x, y, 1 + q * 0.12, 1 + q * 0.12, -0.14 + Math.sin(t * 1.7) * 0.07);
    for (let j = 0; j < 3; j++) {
      const ph = (t * 0.9 + j / 3) % 1;
      sparkle(ctx, x - 8 + j * 8 + Math.sin(t * 3 + j * 2) * 2, y - 10 - ph * 20, 2.8 + q * 2.4, j === 1 ? CC.cyan : '#ead6ff', 1 - ph);
    }
    ctx.restore();
  }
  // Feux follets (âmes) en orbite : moitié arrière derrière le corps, moitié avant devant
  drawWisps(ctx, st, k, front) {
    const t = this.t, fade = st === 'dead' ? Math.max(0, 1 - Math.min(1, k) * 1.5) : 1;
    if (fade <= 0) return;
    const q = st === 'cast' ? Math.sin(Math.min(1, k) * Math.PI) : 0;
    for (let i = 0; i < 3; i++) {
      const a = t * 1.7 + i * (TAU / 3), s = Math.sin(a), c = Math.cos(a);
      if ((s > 0) !== front) continue;
      const R = 44 + q * 10;
      this.wisp(ctx, c * R - 2, -60 + c * 14 + s * 7 - q * 10 + Math.sin(t * 2.6 + i * 2) * 3, 6.6 * (1 + s * 0.16), i, fade * (front ? 1 : 0.8), s);
    }
  }
  wisp(ctx, x, y, r, i, al, lean) {
    const t = this.t, f1 = Math.sin(t * 11 + i * 2.1), f2 = Math.sin(t * 15.3 + i * 1.3);
    const tx = x + lean * r * 0.9 + f1 * r * 0.25, ty = y - r * (2.5 + 0.3 * f2);
    const path = (c, kk, oy) => {
      const R = r * kk, cy = y + oy, ttx = x + (tx - x) * kk, tty = cy - (y - ty) * kk;
      c.beginPath(); c.moveTo(ttx, tty);
      c.bezierCurveTo(x + R * 0.35, cy - R * 1.5, x + R * 1.12, cy - R * 0.85, x + R, cy);
      c.arc(x, cy, R, 0, Math.PI);
      c.bezierCurveTo(x - R * 1.12, cy - R * 0.85, x - R * 0.3, cy - R * 1.3, ttx, tty);
      c.closePath();
    };
    ctx.save(); ctx.globalAlpha *= al;
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - r * 0.5, r * 3.2, CC.ghost, 0.42 + f2 * 0.08); ctx.globalCompositeOperation = 'source-over';
    path(ctx, 1, 0); ctx.fillStyle = CC.ghost; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = CC.ghostD; ctx.lineJoin = 'round'; ctx.stroke();
    path(ctx, 0.6, r * 0.28); ctx.fillStyle = CC.ghostL; ctx.fill();
    ctx.fillStyle = '#0e3b2b';
    ell(ctx, x - r * 0.34, y + r * 0.02, r * 0.15, r * 0.24); ctx.fill();
    ell(ctx, x + r * 0.34, y + r * 0.02, r * 0.15, r * 0.24); ctx.fill();
    ell(ctx, x, y + r * 0.45, r * 0.13, r * 0.17); ctx.fill();
    ctx.restore();
  }
  // Avant-bras : bandages + peinture (tigre), brassard de cuir (siamois, bras de l'arc)
  classForearm(ctx, sx, sy, hx, hy, back) {
    const cls = this.cls, dx = hx - sx, dy = hy - sy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const at = (s) => [sx + dx * s, sy + dy * s];
    ctx.lineCap = 'round';
    if (cls === 'tigre') {
      if (!this.sleeve && !back) for (const s of [0.24, 0.4]) {
        const [px, py] = at(s);
        ctx.beginPath(); ctx.moveTo(px + nx * 4.4 - ux * 1.6, py + ny * 4.4 - uy * 1.6); ctx.lineTo(px - nx * 4.4 + ux * 1.6, py - ny * 4.4 + uy * 1.6);
        ctx.lineWidth = 2.8; ctx.strokeStyle = CC.blood; ctx.stroke();
      }
      const a0 = at(0.56), a1 = at(0.94), c = back ? shade(CC.band, -0.18) : CC.band;
      limb(ctx, a0[0], a0[1], a1[0], a1[1], back ? 9.6 : 10.6, c, shade(c, -0.18), null);
      ctx.strokeStyle = rgba(OUT, 0.55); ctx.lineWidth = 1.4;
      for (const s of [0.66, 0.78, 0.9]) { const [px, py] = at(s); ctx.beginPath(); ctx.moveTo(px + nx * 5, py + ny * 5); ctx.lineTo(px - nx * 5 + ux * 3, py - ny * 5 + uy * 3); ctx.stroke(); }
    } else if (cls === 'siamois' && !back) {
      const a0 = at(0.5), a1 = at(0.86);
      limb(ctx, a0[0], a0[1], a1[0], a1[1], 12, CC.leather, shade(CC.leather, -0.25), null);
      for (const s of [0.52, 0.84]) {
        const [px, py] = at(s);
        ctx.beginPath(); ctx.moveTo(px + nx * 6.6, py + ny * 6.6); ctx.lineTo(px - nx * 6.6, py - ny * 6.6);
        ctx.lineWidth = 4.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = CC.gold; ctx.stroke();
      }
      const [mx, my] = at(0.68); ell(ctx, mx, my, 2.3, 2.3); paint(ctx, CC.gold, 1.4);
    }
  }
  // Jambes : bandes molletières (ninja) ; tige + revers évasé des bottes de cavalier (botte, emplacement bottes vide)
  classLeg(ctx, hip, ax, ay, back, phase) {
    const cls = this.cls;
    const dx = hip[0] - ax, dy = hip[1] - ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    if (cls === 'ninja' && phase === 0) {
      const kx = ax + dx * 0.8, ky = ay + dy * 0.8, c = back ? '#262233' : CC.cloth;
      limb(ctx, ax, ay - 1, kx, ky, back ? 11 : 12, c, shade(c, -0.3), null);
      ctx.strokeStyle = rgba('#a29dc2', 0.9); ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      for (const s of [0.28, 0.62]) { const px = ax + dx * s, py = ay + dy * s; ctx.beginPath(); ctx.moveTo(px + nx * 5.6 - ux * 1.6, py + ny * 5.6 - uy * 1.6); ctx.lineTo(px - nx * 5.6 + ux * 1.6, py - ny * 5.6 + uy * 1.6); ctx.stroke(); }
    } else if (cls === 'botte' && !this.gear.boots) {
      if (phase === 0) {
        const c = back ? shade(CC.boot, -0.2) : CC.boot;
        limb(ctx, ax, ay - 2, ax + dx * 0.36, ay + dy * 0.36, 12.5, c, shade(c, -0.25), null);
      } else {
        const bx = ax + dx * 0.42, by = ay + dy * 0.42, tx = ax + dx * 1.1, ty = ay + dy * 1.1;
        const c = back ? shade(CC.cuff, -0.22) : CC.cuff;
        const sh = (cx) => {
          cx.beginPath(); cx.moveTo(bx + nx * 8, by + ny * 8); cx.lineTo(tx + nx * 13, ty + ny * 13);
          cx.quadraticCurveTo(tx + ux * 3.4, ty + uy * 3.4, tx - nx * 13, ty - ny * 13); cx.lineTo(bx - nx * 8, by - ny * 8);
          cx.quadraticCurveTo(bx - ux * 2.4, by - uy * 2.4, bx + nx * 8, by + ny * 8); cx.closePath();
        };
        cel(ctx, sh, c, { cx: (bx + tx) / 2, cy: (by + ty) / 2, size: 10, lw: 0, glint: false, hi: 0.22, shadow: 0.24 });
        // ouverture du revers (dessus de l'entonnoir) + couture
        ctx.save(); sh(ctx); ctx.clip();
        ctx.beginPath(); ctx.moveTo(tx + nx * 13, ty + ny * 13); ctx.quadraticCurveTo(tx + ux * 3.4, ty + uy * 3.4, tx - nx * 13, ty - ny * 13);
        ctx.quadraticCurveTo(tx - ux * 1.2, ty - uy * 1.2, tx + nx * 13, ty + ny * 13); ctx.fillStyle = shade(CC.boot, back ? -0.5 : -0.4); ctx.fill();
        ctx.restore();
        sh(ctx); ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
      }
    }
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
    if (this.cls) { this.classForearm(ctx, sx, sy, P.hx, P.hy, false); if (this.clsS.front) drawSprite(ctx, this.clsS.front, 0, 0); }
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
    if (this.cls === 'tigre') this.classForearm(ctx, sx, sy, P.bx, P.by, true);
    drawSprite(ctx, this.pawB, P.bx, P.by, 0.94, 0.94, Math.atan2(P.by - sy, P.bx - sx));
  }
  drawLegHero(ctx, hip, foot, lift, back) {
    const L = this.look;
    const ax = foot[0] - 1, ay = foot[1] - 6 - lift;
    const c = back ? shade(L.paw, -0.16) : L.paw;
    limb(ctx, hip[0], hip[1], ax, ay, back ? 10 : 11, c, shade(c, -0.18), back ? null : L.rim, L.rimW > 4 ? 0.28 : 0.2);
    if (this.cls) this.classLeg(ctx, hip, ax, ay, back, 0);
    drawSprite(ctx, back ? this.footB : this.footF, ax, ay, 1, 1, lift ? -0.25 * (lift / 7) * (back ? -1 : 1) : 0);
    if (this.cls) this.classLeg(ctx, hip, ax, ay, back, 1);
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
  const hb = look.cls ? HEAD_BOX_CLS : HEAD_BOX;
  try { s = makeSprite(hb[0], hb[1], hb[2], hb[3], (ctx) => drawHeadFull(ctx, look, 'normal', gear), 2); } finally { setRim(null); }
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
  // tenue de classe : chapeaux hauts, plumes, grimoire, feux follets → cadre élargi
  const s = rig.cls ? makeSprite(-130, -220, 260, 240, (ctx) => rig.draw(ctx, 0, 0, 1, 1, { state: 'idle' }), 2)
    : makeSprite(-100, -h - 20, 200, h + 34, (ctx) => rig.draw(ctx, 0, 0, 1, 1, { state: 'idle' }), 2);
  const url = spriteURL(s, size, 0.03);
  bodyCache.set(key, url);
  return url;
}
