// =====================================================================
//  Outils de dessin vectoriel (Canvas 2D) partagés par tout le rendu.
//  Conventions :
//   - « unités virtuelles » : la scène de combat fait 360 unités de haut,
//     la ligne du sol est à y = GROUND_Y. Les personnages ont les pieds en y = 0
//     dans leur repère local, et « regardent » vers la droite (x positif).
//   - Style : contour sombre OUT, épaisseur ~3 unités, ombrage par dégradé
//     (clair en haut à gauche, foncé en bas à droite), reflets blancs.
// =====================================================================
export const OUT = '#2b1838';
export const VH = 360; // hauteur virtuelle de la scène
export const GROUND_Y = 292; // ligne du sol (unités virtuelles)
export const SPRITE_RES = 2.4; // pixels par unité dans les sprites pré-rendus

// ------------------------------------------------------------ couleurs
function parse(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
// amt > 0 éclaircit (vers le blanc), amt < 0 assombrit (vers le noir). |amt| ∈ [0,1]
export function shade(hex, amt) {
  const c = parse(hex);
  const t = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  return toHex(c.map((v) => v + (t - v) * k));
}
export function mix(a, b, t) {
  const A = parse(a), B = parse(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}
export function rgba(hex, a) {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ------------------------------------------------------------ hasard déterministe
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------ chemins
export function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
}
export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Courbe lisse (Catmull-Rom) passant par les points [[x,y],...]
export function smooth(ctx, pts, closed = true, tension = 0.5, begin = true) {
  const n = pts.length;
  if (begin) ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const q0 = closed || i > 0 ? p0 : p1;
    const q3 = closed || i < n - 2 ? p3 : p2;
    const t = tension / 3 * 2;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - q0[0]) * t / 2, p1[1] + (p2[1] - q0[1]) * t / 2,
      p2[0] - (q3[0] - p1[0]) * t / 2, p2[1] - (q3[1] - p1[1]) * t / 2,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}
export function poly(ctx, pts, closed = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

// ------------------------------------------------------------ remplissage
// Remplit le chemin courant puis trace le contour.
export function paint(ctx, fill, lw = 3, stroke = OUT) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
// Dégradé vertical « volume » : clair en haut, foncé en bas.
export function vgrad(ctx, y0, y1, base, light = 0.25, dark = 0.22) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(base, light));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -dark));
  return g;
}
// Dégradé radial « boule » éclairée en haut à gauche.
export function ball(ctx, x, y, r, base, light = 0.35, dark = 0.3) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, shade(base, light));
  g.addColorStop(0.6, base);
  g.addColorStop(1, shade(base, -dark));
  return g;
}
// Petit reflet brillant
export function gloss(ctx, x, y, rx, ry, a = 0.55, rot = -0.5) {
  ctx.save();
  ctx.globalAlpha *= a;
  ell(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}
export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.4, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------ sprites pré-rendus
// Crée un sprite : zone locale [x0, x0+w] × [y0, y0+h] en unités, l'ancre (0,0) locale.
export function makeSprite(x0, y0, w, h, draw, res = SPRITE_RES) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * res));
  c.height = Math.max(1, Math.ceil(h * res));
  const ctx = c.getContext('2d');
  ctx.scale(res, res);
  ctx.translate(-x0, -y0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return { c, x0, y0, w, h, res };
}
// Dessine un sprite à (x,y) en unités, avec échelle, rotation et opacité.
export function drawSprite(ctx, s, x, y, sx = 1, sy = 1, rot = 0, alpha = 1) {
  if (!s) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h);
  ctx.restore();
}
// Convertit un sprite (ou une fonction de dessin) en image PNG (dataURL) pour l'interface.
// Zone non transparente d'un canvas (en pixels)
export function opaqueBounds(cv) {
  const ctx = cv.getContext('2d');
  const { width: W, height: H } = cv;
  let d;
  try { d = ctx.getImageData(0, 0, W, H).data; } catch (e) { return { x: 0, y: 0, w: W, h: H }; }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { x: 0, y: 0, w: W, h: H };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
export function spriteURL(s, size = 96, pad = 0.08) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const b = opaqueBounds(s.c);
  const k = Math.min(size * (1 - pad * 2) / b.w, size * (1 - pad * 2) / b.h);
  const w = b.w * k, hh = b.h * k;
  ctx.drawImage(s.c, b.x, b.y, b.w, b.h, (size - w) / 2, (size - hh) / 2, w, hh);
  return c.toDataURL('image/png');
}
