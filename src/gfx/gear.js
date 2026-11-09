// =====================================================================
//  Équipement dessiné : armes, chapeaux, accessoires de visage, ailes,
//  armures, capes, gants, bottes, colliers, anneaux + icônes d'objets.
//  Style « Miaou » : cel shading net (cel), liseré de lumière colorée (rim),
//  matières par rareté : fer → bronze → acier → améthyste → or → rubis →
//  cristal rose → céleste → prisme arc-en-ciel. Gemmes lumineuses dès Légendaire.
// =====================================================================
import { OUT, shade, mix, rgba, ell, rr, smooth, poly, paint, ball, glow, cel, makeSprite, opaqueBounds } from './draw.js';

// Couleurs par rareté (0 Commun → 8 Primordial)
export const RCOL = ['#aeb7c2', '#62d86b', '#4aa9ff', '#b968ff', '#ffb52e', '#ff4d5e', '#ff7ae0', '#48f3ff', '#fff27a'];
export const METAL = ['#b9c1cc', '#d6a062', '#c4dcf5', '#b48aff', '#ffc93c', '#ff4d66', '#ffa6ea', '#7cf0ff', '#fff6b0'];
// Matières par rareté : base (cel shading) + couleur de gravure
export const MATS = [
  { id: 'fer', base: '#a8b2c0', eng: '#4f5a6e' },
  { id: 'bronze', base: '#d68e4f', eng: '#743c14' },
  { id: 'acier', base: '#c8dcf2', eng: '#4d6a92' },
  { id: 'amethyste', base: '#aa7bff', eng: '#43208a', crystal: true },
  { id: 'or', base: '#ffc93c', eng: '#9a5000' },
  { id: 'rubis', base: '#ff4566', eng: '#730a24', crystal: true },
  { id: 'cristal', base: '#ffa3ea', eng: '#97307e', crystal: true },
  { id: 'celeste', base: '#7cf0ff', eng: '#185c98', crystal: true, stars: true },
  { id: 'prisme', base: '#fff3a6', eng: '#86309a', rainbow: true },
];
const RAINBOW = ['#ff6b8b', '#ffb84d', '#fff27a', '#7dff9e', '#6fe3ff', '#b88cff', '#ff7ae0'];
const WOOD = '#a0653a';
const LEATHER = '#6a3a22';
const LX = -0.55, LY = -0.83; // lumière en haut à gauche (comme cel)
const clampR = (r) => Math.max(0, Math.min(8, r | 0));

export const GEAR_BASES = {
  weapon: {
    claws: { name: 'Griffes', style: 'slash' }, sword: { name: 'Épée', style: 'slash' }, katana: { name: 'Katana', style: 'slash' },
    axe: { name: 'Hache', style: 'slash' }, hammer: { name: 'Marteau', style: 'smash' }, staff: { name: 'Bâton', style: 'magic' },
    wand: { name: 'Baguette', style: 'magic' }, bow: { name: 'Arc', style: 'arrow' }, scythe: { name: 'Faux', style: 'slash' },
    trident: { name: 'Trident', style: 'pierce' }, fish: { name: 'Espadon', style: 'slash' }, ladle: { name: 'Louche', style: 'smash' },
  },
  hat: {
    beanie: { name: 'Bonnet' }, wizard: { name: 'Chapeau de mage' }, crown: { name: 'Couronne' }, helmet: { name: 'Heaume' },
    cowboy: { name: 'Stetson' }, beret: { name: 'Béret' }, bandana: { name: 'Bandeau' }, tophat: { name: 'Haut-de-forme' },
    flowers: { name: 'Couronne de fleurs' }, viking: { name: 'Casque viking' }, chef: { name: 'Toque' }, party: { name: 'Chapeau de fête' }, cap: { name: 'Casquette' },
  },
  face: {
    round: { name: 'Lunettes rondes' }, sun: { name: 'Lunettes de soleil' }, monocle: { name: 'Monocle' }, patch: { name: 'Cache-œil' },
    ninja: { name: 'Masque ninja' }, star: { name: 'Lunettes étoiles' }, visor: { name: 'Visière' }, stache: { name: 'Moustache' },
  },
  armor: {
    tunic: { name: 'Tunique' }, plate: { name: 'Plastron' }, robe: { name: 'Robe de mage' }, hoodie: { name: 'Sweat' }, kimono: { name: 'Kimono' }, royal: { name: 'Armure royale' },
  },
  cape: { paw: { name: 'Cape' }, star: { name: 'Cape étoilée' }, moon: { name: 'Cape lunaire' }, skull: { name: 'Cape pirate' }, heart: { name: 'Cape du cœur' } },
  wings: {
    angel: { name: 'Ailes d\'ange' }, bat: { name: 'Ailes de chauve-souris' }, butterfly: { name: 'Ailes de papillon' }, dragon: { name: 'Ailes de dragon' },
    fairy: { name: 'Ailes de fée' }, jetpack: { name: 'Jetpack' }, fishpack: { name: 'Sac poisson' },
  },
  gloves: { mitts: { name: 'Mitaines' }, gauntlet: { name: 'Gantelets' }, boxing: { name: 'Gants de boxe' } },
  boots: { boots: { name: 'Bottes' }, sneakers: { name: 'Baskets' }, slippers: { name: 'Chaussons' } },
  collar: { bell: { name: 'Grelot' }, pearls: { name: 'Collier de perles' }, spikes: { name: 'Collier clouté' } },
  ring: { ring: { name: 'Anneau' }, gem: { name: 'Bague' } },
};

// ------------------------------------------------------------------ outils de rendu « toon »
// Couleur du liseré de lumière (rim light) : fixée par le héros pendant la construction de ses sprites.
let RIM = null;
let ICON = false; // pendant le rendu des icônes : pas de halo décoratif (la tuile de l'interface porte déjà la lueur)
function halo(ctx, x, y, rad, col, a) { if (!ICON) glow(ctx, x, y, rad, col, a); }
export function setRim(c) { RIM = c || null; }
function rimFor(r) { return RIM || mix(r >= 8 ? '#fff27a' : RCOL[clampR(r)], '#ffffff', 0.45); }

// Chemin « tout sauf la forme décalée de (dx,dy) » (à remplir / découper en evenodd)
function outside(ctx, shape, dx, dy) {
  ctx.save(); ctx.translate(dx, dy); shape(ctx); ctx.restore();
  ctx.rect(-5000, -5000, 10000, 10000);
}
// Liseré coloré sur le bord opposé à la lumière (bas / droite)
export function rim(ctx, shape, color, w = 3.4, a = 0.85) {
  if (!color) return;
  ctx.save();
  shape(ctx); ctx.clip();
  outside(ctx, shape, -0.88 * w, -0.48 * w);
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.fill('evenodd');
  ctx.restore();
}
export function outline(ctx, shape, lw = 3, col = OUT) {
  shape(ctx);
  ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();
}
// cel shading + liseré + contour, en une fois
export function toon(ctx, shape, base, o = {}) {
  cel(ctx, shape, base, { ...o, lw: 0 });
  const rc = o.rim === undefined ? RIM : o.rim;
  if (rc) rim(ctx, shape, rc, o.rimW ?? 3.4, o.rimA ?? 0.8);
  if ((o.lw ?? 3) > 0) outline(ctx, shape, o.lw ?? 3, o.stroke || OUT);
}
function rainbowFill(ctx, cx, cy, k) {
  const g = ctx.createLinearGradient(cx - k, cy + k * 0.8, cx + k, cy - k * 0.8);
  RAINBOW.forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  return g;
}
// Petite étoile à 4 branches (reflet / scintillement)
export function sparkle(ctx, x, y, R, col = '#ffffff', a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.beginPath();
  ctx.moveTo(x, y - R); ctx.quadraticCurveTo(x, y, x + R * 0.8, y); ctx.quadraticCurveTo(x, y, x, y + R);
  ctx.quadraticCurveTo(x, y, x - R * 0.8, y); ctx.quadraticCurveTo(x, y, x, y - R);
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}
// Forme peinte dans la matière de la rareté r (cel shading + facettes cristal + étoiles + contour)
export function matCel(ctx, shape, r, o = {}) {
  r = clampR(r);
  const m = MATS[r];
  const k = o.size ?? 20, cx = o.cx ?? 0, cy = o.cy ?? 0;
  const lx = o.lx ?? LX, ly = o.ly ?? LY;
  if (m.rainbow) {
    ctx.save();
    shape(ctx); ctx.fillStyle = rainbowFill(ctx, cx, cy, k); ctx.fill();
    ctx.clip();
    const d = k * (o.depth ?? 0.22);
    outside(ctx, shape, lx * d, ly * d);
    ctx.fillStyle = 'rgba(112,34,150,0.34)'; ctx.fill('evenodd');
    if ((o.hi ?? 0.4) > 0) { ell(ctx, cx + lx * k * 0.42, cy + ly * k * 0.42, k * 0.42, k * 0.22, Math.atan2(ly, lx) + Math.PI / 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); }
    ctx.restore();
  } else {
    cel(ctx, shape, o.base || m.base, { shadow: 0.3, hi: 0.38, ...o, glint: false, lw: 0 });
  }
  if (m.crystal && o.facets !== false) {
    ctx.save(); shape(ctx); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    poly(ctx, [[cx - k * 1.2, cy - k * 0.05], [cx - k * 0.05, cy - k * 1.2], [cx + k * 0.22, cy - k * 1.2], [cx - k * 1.2, cy + k * 0.22]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    poly(ctx, [[cx - k * 0.7, cy + k * 0.5], [cx + k * 0.5, cy - k * 0.7], [cx + k * 0.62, cy - k * 0.6], [cx - k * 0.58, cy + k * 0.62]]); ctx.fill();
    ctx.restore();
  }
  if (m.stars && o.facets !== false) {
    ctx.save(); shape(ctx); ctx.clip();
    for (const [dx, dy, s] of [[0.25, 0.15, 0.2], [-0.2, 0.45, 0.13], [0.45, -0.35, 0.12]]) sparkle(ctx, cx + dx * k, cy + dy * k, s * k, '#ffffff', 0.9);
    ctx.restore();
  }
  if (o.glint !== false) {
    ell(ctx, cx + lx * k * 0.58, cy + ly * k * 0.58, k * 0.11, k * 0.065, -0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  }
  if (o.rim !== false) rim(ctx, shape, o.rimC || rimFor(r), o.rimW ?? 3, 0.7);
  if ((o.lw ?? 2.6) > 0) outline(ctx, shape, o.lw ?? 2.6);
}
// Tissu de la rareté (prisme pour Primordial)
function clothCel(ctx, shape, r, o = {}) {
  r = clampR(r);
  if (r >= 8) matCel(ctx, shape, 8, { facets: false, ...o, lw: o.lw ?? 2.8 });
  else toon(ctx, shape, o.base || RCOL[r], { ...o, rim: o.rim === undefined ? rimFor(r) : o.rim });
}
// Lame : deux tons nets séparés par l'arête (ombre côté droit), fil lumineux à gauche
function bladeCel(ctx, shape, r, o) {
  matCel(ctx, shape, r, { cx: o.cx, cy: o.cy, size: o.w, lx: -1, ly: -0.12, depth: 0.5, hi: 0, glint: false, lw: 0, rimW: 2.4, facets: o.facets });
  if (o.edge) {
    ctx.save(); shape(ctx); ctx.clip();
    o.edge(ctx); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }
  outline(ctx, shape, o.lw ?? 2.6);
}
// Gouttière gravée + runes lumineuses (Légendaire+)
function fuller(ctx, x0, y0, x1, y1, r) {
  r = clampR(r);
  const m = MATS[r];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(m.eng, 0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0 - 1, y0); ctx.lineTo(x1 - 1, y1);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
  if (r >= 4) {
    const c = r >= 8 ? '#ffffff' : shade(RCOL[r], 0.55);
    for (let i = 0; i < 3; i++) {
      const t = 0.18 + i * 0.3, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      halo(ctx, x, y, 6, r >= 8 ? '#ff7ae0' : RCOL[r], 0.8);
      poly(ctx, [[x, y - 3], [x + 1.8, y], [x, y + 3], [x - 1.8, y]]); ctx.fillStyle = c; ctx.fill();
    }
  }
  ctx.restore();
}
// Biseau : filet clair à l'intérieur du bord éclairé
function bevel(ctx, shape, a = 0.55, w = 1.4) {
  ctx.save(); shape(ctx); ctx.clip();
  ctx.translate(1.6, 2);
  shape(ctx); ctx.lineWidth = w; ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.stroke();
  ctx.restore();
}
// Halo coloré qui épouse la forme (objets Mythique+)
function aura(ctx, r, shape, blur = 7) {
  if (r < 5 || ICON) return;
  const t = ctx.getTransform ? ctx.getTransform() : { a: 2.4, b: 0 };
  const s = Math.hypot(t.a, t.b) || 1;
  const c = r >= 8 ? '#ff9af0' : RCOL[r];
  ctx.save();
  ctx.shadowColor = rgba(c, 0.95); ctx.shadowBlur = blur * s;
  shape(ctx); ctx.fillStyle = c; ctx.fill(); ctx.fill();
  ctx.restore();
}
function rareGlow(ctx, r, x, y, rad) {
  if (r >= 4 && !ICON) glow(ctx, x, y, rad, r >= 8 ? '#ffe6a0' : RCOL[r], r >= 6 ? 0.55 : 0.4);
}
function metal(ctx, r, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  r = clampR(r);
  if (r >= 8) { RAINBOW.forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); return g; }
  const m = MATS[r].base;
  g.addColorStop(0, shade(m, 0.5)); g.addColorStop(0.45, m); g.addColorStop(0.5, shade(m, -0.15)); g.addColorStop(1, shade(m, -0.35));
  return g;
}
// Gemme facettée (lumineuse à partir de Légendaire)
function gem(ctx, x, y, rad, r) {
  r = clampR(r);
  const c = r >= 8 ? '#ff7ae0' : RCOL[r];
  if (r >= 4) glow(ctx, x, y, rad * (ICON ? 2.2 : 3), r >= 8 ? '#fff27a' : c, 0.6);
  const oct = (c2, R, ox = 0, oy = 0) => { c2.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; c2.lineTo(x + ox + Math.cos(a) * R, y + oy + Math.sin(a) * R); } c2.closePath(); };
  oct(ctx, rad);
  ctx.fillStyle = r >= 8 ? rainbowFill(ctx, x, y, rad) : shade(c, -0.32); ctx.fill();
  ctx.save(); oct(ctx, rad); ctx.clip();
  poly(ctx, [[x - rad * 1.2, y + rad * 0.3], [x - rad * 1.2, y - rad * 1.2], [x + rad * 0.4, y - rad * 1.2]]);
  ctx.fillStyle = r >= 8 ? 'rgba(255,255,255,0.35)' : c; ctx.fill();
  oct(ctx, rad * 0.48, -rad * 0.12, -rad * 0.12);
  ctx.fillStyle = r >= 8 ? 'rgba(255,255,255,0.6)' : shade(c, 0.5); ctx.fill();
  ctx.restore();
  oct(ctx, rad);
  ctx.lineWidth = Math.max(1.3, Math.min(2.2, rad * 0.45)); ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
  sparkle(ctx, x - rad * 0.35, y - rad * 0.38, rad * 0.55, '#ffffff', 0.95);
}
function star5(ctx, x, y, R, r0, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rad = i % 2 ? r0 : R;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}
function heartPath(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.25, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.25, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}
function pawPrint(ctx, x, y, s) {
  ell(ctx, x, y + s * 0.35, s * 0.62, s * 0.5); ctx.fill();
  for (const [dx, dy] of [[-0.62, -0.25], [-0.22, -0.7], [0.22, -0.7], [0.62, -0.25]]) { ell(ctx, x + dx * s, y + dy * s, s * 0.24, s * 0.3); ctx.fill(); }
}
// Poignée enrubannée (cuir + filets de la rareté)
function grip(ctx, x, y, w, h, r, col = LEATHER) {
  const sh = (c) => rr(c, x, y, w, h, Math.min(w / 2, 3));
  toon(ctx, sh, col, { cx: x + w / 2, cy: y + h / 2, size: h * 0.6, lw: 2.2, rim: false, glint: false, hi: 0.15 });
  ctx.save(); sh(ctx); ctx.clip();
  ctx.strokeStyle = r >= 2 ? rgba(r >= 8 ? '#ffe27a' : RCOL[r], 0.85) : 'rgba(255,220,180,0.45)'; ctx.lineWidth = 1.6;
  for (let yy = y + 2; yy < y + h + 4; yy += 4.2) { ctx.beginPath(); ctx.moveTo(x - 1, yy); ctx.lineTo(x + w + 1, yy - 3.2); ctx.stroke(); }
  ctx.restore();
  outline(ctx, sh, 2.2);
}
function woodShaft(ctx, x, y, w, h, col = WOOD) {
  const sh = (c) => rr(c, x, y, w, h, w / 2);
  toon(ctx, sh, col, { cx: x + w / 2, cy: y + h * 0.3, size: w * 1.2, lx: -1, ly: -0.1, depth: 0.45, hi: 0, glint: false, lw: 2.4, rim: false });
  ctx.save(); sh(ctx); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + w * 0.18, y, w * 0.18, h);
  ctx.restore();
}

// ------------------------------------------------------------------ ARMES (poignée en (0,0), pointe vers le haut)
// opt.noString : arc sans corde (la corde est animée par le héros)
export function drawWeapon(ctx, base, r, opt = {}) {
  r = clampR(r);
  const rc = RCOL[r];
  switch (base) {
    case 'sword': {
      const bl = (c) => { c.beginPath(); c.moveTo(-6.6, -20); c.lineTo(-7.2, -72); c.lineTo(0, -96); c.lineTo(7.2, -72); c.lineTo(6.6, -20); c.closePath(); };
      rareGlow(ctx, r, 0, -62, 42);
      aura(ctx, r, bl);
      bladeCel(ctx, bl, r, { cx: 0, cy: -58, w: 14, edge: (c) => { c.beginPath(); c.moveTo(-5.2, -22); c.lineTo(-5.7, -72); c.lineTo(-1, -90); } });
      fuller(ctx, 0, -27, 0, -68, r);
      sparkle(ctx, -2.5, -80, 5);
      const gd = (c) => { c.beginPath(); c.moveTo(-21, -26); c.quadraticCurveTo(-10, -18, 0, -19); c.quadraticCurveTo(10, -18, 21, -26); c.quadraticCurveTo(20, -14, 10, -12); c.lineTo(-10, -12); c.quadraticCurveTo(-20, -14, -21, -26); c.closePath(); };
      matCel(ctx, gd, r, { cx: 0, cy: -17, size: 16, lw: 2.4 });
      grip(ctx, -3.9, -13, 7.8, 16, r);
      matCel(ctx, (c) => ell(c, 0, 7, 5.6, 5.4), r, { cx: 0, cy: 7, size: 6, lw: 2.2 });
      gem(ctx, 0, -17, 3.8, r);
      break;
    }
    case 'katana': {
      const bl = (c) => { c.beginPath(); c.moveTo(-4.4, -20); c.bezierCurveTo(-4.6, -52, -2, -80, 5, -101); c.lineTo(6.6, -86); c.bezierCurveTo(5.6, -60, 4.6, -40, 4.6, -20); c.closePath(); };
      rareGlow(ctx, r, 2, -62, 40);
      aura(ctx, r, bl);
      bladeCel(ctx, bl, r, { cx: 1, cy: -60, w: 10, edge: (c) => { c.beginPath(); c.moveTo(-2.6, -22); c.bezierCurveTo(-2.8, -52, -0.6, -78, 4.6, -96); } });
      if (r >= 2) { ctx.beginPath(); for (let y = -24; y > -84; y -= 6) ctx.lineTo(1.4 + Math.sin(y * 0.6) * 0.9 + (y + 24) * -0.03, y); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke(); }
      sparkle(ctx, 3, -88, 4.5);
      matCel(ctx, (c) => rr(c, -5.4, -23, 10.8, 5.5, 1.5), Math.max(r, 4) === 8 ? 8 : (r >= 3 ? 4 : 1), { cx: 0, cy: -20, size: 6, lw: 2 });
      matCel(ctx, (c) => ell(c, 0, -16, 12, 4.6), r, { cx: 0, cy: -16, size: 10, lw: 2.4, base: r < 3 ? '#4c4a5e' : undefined });
      const hd = (c) => rr(c, -4.2, -13, 8.4, 25, 3.5);
      toon(ctx, hd, '#2a2340', { cx: 0, cy: 0, size: 12, lw: 0, rim: false, glint: false, hi: 0.1 });
      ctx.save(); hd(ctx); ctx.clip();
      ctx.strokeStyle = r >= 8 ? '#ffe27a' : rc; ctx.lineWidth = 2.2;
      for (let y = -11; y < 12; y += 5.5) { ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(5, y + 4); ctx.moveTo(5, y); ctx.lineTo(-5, y + 4); ctx.stroke(); }
      ctx.restore();
      outline(ctx, hd, 2.2);
      matCel(ctx, (c) => rr(c, -4.8, 11, 9.6, 4.6, 2), r, { cx: 0, cy: 13, size: 5, lw: 2 });
      if (r >= 4) { ctx.beginPath(); ctx.moveTo(0, 15); ctx.quadraticCurveTo(-6, 22, -3, 28); ctx.lineWidth = 4.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = rc; ctx.stroke(); ell(ctx, -3, 30, 3, 4); paint(ctx, rc, 1.6); }
      break;
    }
    case 'axe': {
      woodShaft(ctx, -3.8, -86, 7.6, 94);
      grip(ctx, -4.2, -10, 8.4, 14, r);
      matCel(ctx, (c) => rr(c, -4.6, 5, 9.2, 5, 2), r, { cx: 0, cy: 7, size: 5, lw: 2 });
      const hd = (c) => smooth(c, [[3, -92], [20, -104], [38, -96], [45, -74], [37, -52], [20, -58], [3, -64]], true, 0.36);
      rareGlow(ctx, r, 22, -78, 40);
      aura(ctx, r, hd);
      matCel(ctx, hd, r, { cx: 24, cy: -78, size: 26 });
      bevel(ctx, hd, 0.5);
      ctx.save(); hd(ctx); ctx.clip();
      ctx.beginPath(); ctx.moveTo(24, -98); ctx.quadraticCurveTo(46, -76, 34, -55); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -88); ctx.quadraticCurveTo(26, -78, 12, -66); ctx.lineWidth = 1.8; ctx.strokeStyle = rgba(MATS[r].eng, 0.6); ctx.stroke();
      ctx.restore();
      const sp = (c) => smooth(c, [[-2, -88], [-14, -86], [-24, -80], [-14, -72], [-2, -68]], true, 0.3);
      matCel(ctx, sp, r, { cx: -12, cy: -78, size: 11, lw: 2.4 });
      matCel(ctx, (c) => rr(c, -6.5, -94, 13, 32, 4), r >= 4 ? r : Math.max(1, r), { cx: 0, cy: -80, size: 14, lw: 2.4, base: r < 3 ? '#7d6a5a' : undefined });
      gem(ctx, 0, -78, 4, r);
      sparkle(ctx, 28, -94, 5);
      break;
    }
    case 'hammer': {
      woodShaft(ctx, -3.8, -66, 7.6, 76);
      grip(ctx, -4.2, -10, 8.4, 15, r);
      matCel(ctx, (c) => rr(c, -4.6, 6, 9.2, 5, 2), r, { cx: 0, cy: 8, size: 5, lw: 2 });
      const hd = (c) => rr(c, -27, -98, 54, 36, 10);
      rareGlow(ctx, r, 0, -80, 44);
      aura(ctx, r, hd);
      matCel(ctx, hd, r, { cx: -2, cy: -82, size: 30 });
      bevel(ctx, hd, 0.5, 1.6);
      ctx.save(); hd(ctx); ctx.clip();
      rr(ctx, -16, -92, 32, 24, 6); ctx.lineWidth = 2; ctx.strokeStyle = rgba(MATS[r].eng, 0.55); ctx.stroke();
      ctx.restore();
      for (const x of [-31, 21]) matCel(ctx, (c) => rr(c, x, -101, 10, 42, 4.5), r, { cx: x + 5, cy: -82, size: 14, lw: 2.4, base: r < 8 ? shade(MATS[r].base, -0.12) : undefined, facets: false });
      gem(ctx, 0, -80, 6, r);
      sparkle(ctx, -14, -92, 5.5);
      break;
    }
    case 'staff': {
      woodShaft(ctx, -3.6, -88, 7.2, 100, r >= 6 ? '#e8dcff' : WOOD);
      if (r >= 2) {
        const sh = (c) => rr(c, -3.6, -88, 7.2, 100, 3.6);
        ctx.save(); sh(ctx); ctx.clip(); ctx.strokeStyle = r >= 8 ? '#ff9af0' : rc; ctx.lineWidth = 2.6;
        for (let y = -80; y < -20; y += 12) { ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(5, y + 6); ctx.stroke(); }
        ctx.restore(); outline(ctx, sh, 2.4);
      }
      grip(ctx, -4.4, -10, 8.8, 16, r);
      rareGlow(ctx, Math.max(4, r), 0, -104, r >= 4 ? 34 : 26);
      const pr = (c) => { c.beginPath(); c.moveTo(-4, -86); c.bezierCurveTo(-22, -92, -20, -116, -6, -120); c.lineTo(-4, -114); c.bezierCurveTo(-13, -110, -13, -96, 0, -92); c.bezierCurveTo(13, -96, 13, -110, 4, -114); c.lineTo(6, -120); c.bezierCurveTo(20, -116, 22, -92, 4, -86); c.closePath(); };
      matCel(ctx, pr, r, { cx: 0, cy: -102, size: 16, lw: 2.4, facets: false });
      const orb = (c) => ell(c, 0, -105, 11.5, 11.5);
      if (r >= 8) matCel(ctx, orb, 8, { cx: 0, cy: -105, size: 12, lw: 2.4 });
      else toon(ctx, orb, rc, { cx: 0, cy: -105, size: 12, hi: 0.45, lw: 2.4, rim: shade(rc, 0.6) });
      ctx.save(); orb(ctx); ctx.clip();
      ctx.beginPath(); ctx.arc(1, -104, 6, 0.4, 3.6); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
      ctx.restore();
      sparkle(ctx, -4, -110, 6);
      if (r >= 5) for (const [x, y, s] of [[-17, -122, 4.5], [16, -88, 3.5], [14, -124, 3]]) sparkle(ctx, x, y, s, shade(rc, 0.6));
      matCel(ctx, (c) => rr(c, -5.4, -90, 10.8, 6, 2.5), r, { cx: 0, cy: -87, size: 6, lw: 2 });
      break;
    }
    case 'wand': {
      const st = (c) => rr(c, -3.2, -48, 6.4, 58, 3.2);
      toon(ctx, st, '#fff1d6', { cx: 0, cy: -30, size: 7, lx: -1, ly: -0.1, depth: 0.45, hi: 0, glint: false, lw: 2.4, rim: false });
      for (const y of [-46, -6, 6]) matCel(ctx, (c) => rr(c, -4.2, y, 8.4, 4.4, 2), Math.max(r, 4) === 8 ? 8 : 4, { cx: 0, cy: y + 2, size: 5, lw: 1.8, facets: false });
      halo(ctx, 0, -62, r >= 4 ? 34 : 24, r >= 8 ? '#fff27a' : rc, 0.7);
      const sh = (c) => star5(c, 0, -62, 18, 8.5);
      matCel(ctx, sh, r, { cx: -1, cy: -63, size: 15, lw: 2.6 });
      gem(ctx, 0, -61.5, 4.2, r);
      if (r >= 3) for (const [x, y, s] of [[-16, -76, 4], [15, -44, 3.4], [18, -80, 3]]) sparkle(ctx, x, y, s, '#ffffff');
      break;
    }
    case 'bow': {
      // poignée en (0,0) ; branches bombées vers l'avant (+x), corde à x = -10
      const limb = (c) => { c.beginPath(); c.moveTo(-10, -46); c.bezierCurveTo(10, -42, 18, -18, 15, 0); c.bezierCurveTo(18, 18, 10, 42, -10, 46); c.lineTo(-7, 40); c.bezierCurveTo(6, 34, 10, 14, 7.5, 0); c.bezierCurveTo(10, -14, 6, -34, -7, -40); c.closePath(); };
      rareGlow(ctx, r, 6, 0, 40);
      aura(ctx, r, limb, 6);
      if (!opt.noString) { ctx.beginPath(); ctx.moveTo(-9, -44); ctx.lineTo(-9, 44); ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff6e0'; ctx.stroke(); }
      if (r >= 3) matCel(ctx, limb, r, { cx: 6, cy: 0, size: 30, lw: 2.6 });
      else { toon(ctx, limb, WOOD, { cx: 6, cy: 0, size: 30, lw: 2.6, rim: false }); }
      for (const s of [-1, 1]) matCel(ctx, (c) => ell(c, -9, 45 * s, 4, 4), r, { cx: -9, cy: 45 * s, size: 4, lw: 2, facets: false });
      grip(ctx, 5, -9, 10, 18, r);
      if (r >= 2) { gem(ctx, 13, -19, 3, r); gem(ctx, 13, 19, 3, r); }
      break;
    }
    case 'scythe': {
      woodShaft(ctx, -3.4, -104, 6.8, 116, '#4b3458');
      grip(ctx, -4, -10, 8, 16, r);
      grip(ctx, -4, -62, 8, 10, r);
      const bl = (c) => { c.beginPath(); c.moveTo(4, -110); c.bezierCurveTo(-18, -122, -54, -116, -70, -86); c.bezierCurveTo(-52, -100, -28, -100, -2, -92); c.closePath(); };
      rareGlow(ctx, r, -30, -102, 42);
      aura(ctx, r, bl);
      matCel(ctx, bl, r, { cx: -26, cy: -106, size: 26, lw: 0, glint: false });
      ctx.save(); bl(ctx); ctx.clip();
      ctx.beginPath(); ctx.moveTo(-66, -88); ctx.bezierCurveTo(-50, -102, -28, -103, -2, -95); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -106); ctx.bezierCurveTo(-24, -110, -40, -108, -52, -100); ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(MATS[r].eng, 0.6); ctx.stroke();
      ctx.restore();
      outline(ctx, bl, 2.6);
      matCel(ctx, (c) => rr(c, -6, -114, 12, 18, 4), r, { cx: 0, cy: -105, size: 10, lw: 2.4 });
      gem(ctx, 0, -105, 3.8, r);
      sparkle(ctx, -40, -108, 5);
      break;
    }
    case 'trident': {
      const sh = (c) => rr(c, -3.2, -76, 6.4, 88, 3.2);
      matCel(ctx, sh, r, { cx: 0, cy: -40, size: 8, lx: -1, ly: -0.1, depth: 0.45, hi: 0, glint: false, lw: 2.4, facets: false, base: r < 8 ? shade(MATS[r].base, -0.08) : undefined });
      grip(ctx, -4, -10, 8, 16, r);
      grip(ctx, -4, -56, 8, 9, r);
      rareGlow(ctx, r, 0, -96, 38);
      const hd = (c) => { c.beginPath(); c.moveTo(-19, -96); c.lineTo(-19, -84); c.quadraticCurveTo(-19, -73, 0, -73); c.quadraticCurveTo(19, -73, 19, -84); c.lineTo(19, -96); c.lineTo(12, -96); c.lineTo(12, -86); c.quadraticCurveTo(12, -80, 0, -80); c.quadraticCurveTo(-12, -80, -12, -86); c.lineTo(-12, -96); c.closePath(); };
      const prong = (x, y0, len) => (c) => { c.beginPath(); c.moveTo(x - 4.2, y0); c.lineTo(x - 5.5, y0 - len * 0.55); c.lineTo(x, y0 - len); c.lineTo(x + 5.5, y0 - len * 0.55); c.lineTo(x + 4.2, y0); c.closePath(); };
      const mid = (c) => { c.beginPath(); c.moveTo(-3.6, -76); c.lineTo(-3.6, -100); c.lineTo(-7, -102); c.lineTo(0, -124); c.lineTo(7, -102); c.lineTo(3.6, -100); c.lineTo(3.6, -76); c.closePath(); };
      aura(ctx, r, (c) => { hd(c); }, 6);
      for (const x of [-15.5, 15.5]) matCel(ctx, prong(x, -94, 20), r, { cx: x, cy: -104, size: 9, lw: 2.4 });
      matCel(ctx, hd, r, { cx: 0, cy: -84, size: 18, lw: 2.6 });
      matCel(ctx, mid, r, { cx: 0, cy: -100, size: 12, lw: 2.6 });
      gem(ctx, 0, -78, 4, r);
      sparkle(ctx, -2, -112, 5);
      break;
    }
    case 'fish': {
      const fc = r >= 4 ? MATS[r].base : '#78aee6';
      const tail = (c) => { c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(-12, 8, -15, 20); c.quadraticCurveTo(-4, 14, 0, 12); c.quadraticCurveTo(4, 14, 15, 20); c.quadraticCurveTo(12, 8, 0, 2); c.closePath(); };
      if (r >= 8) matCel(ctx, tail, 8, { cx: 0, cy: 12, size: 12, lw: 2.4 }); else toon(ctx, tail, shade(fc, -0.08), { cx: 0, cy: 12, size: 12, lw: 2.4 });
      grip(ctx, -4, -14, 8, 18, r, r >= 4 ? shade(fc, -0.35) : '#3f6a9a');
      const body = (c) => smooth(c, [[0, -16], [12, -28], [14, -50], [8, -70], [0, -76], [-8, -70], [-14, -50], [-12, -28]], true, 0.5);
      rareGlow(ctx, r, 0, -50, 40);
      aura(ctx, r, body);
      const bill = (c) => { c.beginPath(); c.moveTo(-3.4, -70); c.lineTo(0, -116); c.lineTo(3.4, -70); c.closePath(); };
      bladeCel(ctx, bill, Math.max(r, 2), { cx: 0, cy: -92, w: 7 });
      if (r >= 8) matCel(ctx, body, 8, { cx: 0, cy: -48, size: 22 }); else toon(ctx, body, fc, { cx: 0, cy: -48, size: 22, rim: rimFor(r) });
      ctx.save(); body(ctx); ctx.clip();
      ell(ctx, -9, -44, 6, 24); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      ctx.strokeStyle = rgba(shade(fc, -0.5), 0.45); ctx.lineWidth = 1.6;
      for (const [x, y] of [[2, -36], [6, -46], [0, -52], [5, -28]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0.2, Math.PI - 0.2); ctx.stroke(); }
      ctx.restore();
      outline(ctx, body, 2.6);
      const fin = (c) => { c.beginPath(); c.moveTo(12, -56); c.quadraticCurveTo(26, -48, 22, -32); c.lineTo(12, -38); c.closePath(); };
      clothCel(ctx, fin, r, { cx: 18, cy: -44, size: 8, lw: 2.2, glint: false });
      ell(ctx, 4, -64, 3.6, 3.6); paint(ctx, '#ffffff', 1.6); ell(ctx, 5, -64, 1.8, 2); ctx.fillStyle = '#1d1530'; ctx.fill();
      break;
    }
    case 'ladle': {
      const sh = (c) => rr(c, -3.2, -62, 6.4, 72, 3.2);
      matCel(ctx, sh, r, { cx: 0, cy: -30, size: 8, lx: -1, ly: -0.1, depth: 0.45, hi: 0, glint: false, lw: 2.4, facets: false });
      grip(ctx, -4, -6, 8, 14, r);
      ctx.beginPath(); ctx.arc(0, 12, 4, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = MATS[r].base; ctx.stroke();
      const bowl = (c) => { c.beginPath(); c.moveTo(-19, -76); c.quadraticCurveTo(-20, -56, 0, -54); c.quadraticCurveTo(20, -56, 19, -76); c.closePath(); };
      rareGlow(ctx, r, 0, -70, 38);
      aura(ctx, r, bowl);
      matCel(ctx, bowl, r, { cx: 0, cy: -66, size: 18 });
      ell(ctx, 0, -76, 19, 6.5); paint(ctx, shade(MATS[r].base, -0.35), 2.4);
      ell(ctx, 0, -75.5, 15, 4.2); ctx.fillStyle = r >= 2 ? (r >= 8 ? '#ff9af0' : RCOL[r]) : '#e8a050'; ctx.fill();
      ell(ctx, -6, -76.5, 4, 1.3); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
      if (r >= 4) { heartPath(ctx, 6, -86, 4.2); paint(ctx, '#ff5c8a', 1.6); }
      sparkle(ctx, -10, -64, 4.5);
      break;
    }
    default: { // claws : brassard + 3 lames
      rareGlow(ctx, r, 8, -36, 36);
      const blades = [0, 1, 2].map((i) => {
        const x = -8 + i * 8;
        return (c) => smooth(c, [[x - 3, -12], [x - 1 + i, -34 - i * 4], [x + 9 + i * 2, -58 - i * 3], [x + 4, -34], [x + 3.2, -12]], true, 0.4);
      });
      for (const bl of blades) aura(ctx, r, bl, 5);
      blades.forEach((bl, i) => bladeCel(ctx, bl, r, { cx: -4 + i * 8, cy: -34, w: 7, lw: 2.4 }));
      const br = (c) => rr(c, -14, -14, 28, 20, 7);
      clothCel(ctx, br, r >= 4 ? r : 0, { cx: 0, cy: -4, size: 14, lw: 2.6, base: r < 4 ? '#5a4a6e' : undefined });
      matCel(ctx, (c) => rr(c, -15, -17, 30, 8, 4), r, { cx: 0, cy: -13, size: 12, lw: 2.2 });
      gem(ctx, 0, -3, 3.8, r);
    }
  }
}

// ------------------------------------------------------------------ CHAPEAUX (origine = sommet de la tête, largeur ≈ 70)
export function drawHat(ctx, base, r) {
  r = clampR(r);
  const c = RCOL[r], d = shade(c, -0.3);
  switch (base) {
    case 'wizard': {
      const brim = (cx) => ell(cx, -1, 4, 44, 9, -0.04);
      clothCel(ctx, brim, r, { cx: -1, cy: 4, size: 26, base: shade(c, -0.28), hi: 0.12 });
      const cone = (cx) => smooth(cx, [[-26, 4], [-16, -26], [-20, -52], [-34, -70], [-6, -50], [6, -26], [24, 4]], true, 0.34);
      clothCel(ctx, cone, r, { cx: -6, cy: -26, size: 30, base: shade(c, -0.12) });
      const band = (cx) => { cx.beginPath(); cx.moveTo(-24, -5); cx.quadraticCurveTo(0, -12, 22, -5); cx.lineTo(23.5, 3); cx.quadraticCurveTo(0, -4, -25.5, 3); cx.closePath(); };
      matCel(ctx, band, r >= 8 ? 8 : 4, { cx: 0, cy: -2, size: 14, lw: 2.2, facets: false });
      rr(ctx, -4.5, -9, 9, 10, 2); paint(ctx, '#2a2340', 1.8); rr(ctx, -2, -6.5, 4, 5, 1); ctx.fillStyle = '#ffe27a'; ctx.fill();
      star5(ctx, -10, -27, 6.5, 2.8); paint(ctx, '#ffe14d', 1.6);
      star5(ctx, 5, -16, 4, 1.8); paint(ctx, '#ffffff', 1.3);
      ctx.beginPath(); ctx.arc(-15, -43, 4.5, 0.7, 5.6); ctx.arc(-13, -44, 3.8, 5.2, 1.1, true); ctx.closePath(); paint(ctx, '#ffe14d', 1.4);
      if (r >= 4) { halo(ctx, -34, -70, 14, r >= 8 ? '#fff27a' : c, 0.7); sparkle(ctx, -34, -70, 6); }
      break;
    }
    case 'crown': {
      const rm = r >= 8 ? 8 : Math.max(4, r);
      const cr = (cx) => { cx.beginPath(); cx.moveTo(-28, 6); cx.lineTo(-32, -22); cx.lineTo(-17, -9); cx.lineTo(-7, -32); cx.lineTo(3, -10); cx.lineTo(16, -30); cx.lineTo(22, -8); cx.lineTo(34, -20); cx.lineTo(30, 6); cx.closePath(); };
      if (r >= 4) halo(ctx, 0, -12, 46, r >= 8 ? '#fff27a' : c, 0.35);
      matCel(ctx, cr, rm, { cx: 0, cy: -10, size: 30, lw: 2.8 });
      ctx.save(); cr(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(-29, -4); ctx.lineTo(31, -4); ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(MATS[rm].eng, 0.6); ctx.stroke(); ctx.restore();
      const band = (cx) => rr(cx, -30, -3, 62, 11, 5);
      matCel(ctx, band, rm, { cx: 0, cy: 2, size: 18, lw: 2.4, facets: false });
      gem(ctx, 1, 2.5, 4.4, r); gem(ctx, -17, 2.5, 3, Math.max(2, r - 1)); gem(ctx, 19, 2.5, 3, Math.max(2, r - 1));
      for (const [x, y] of [[-32, -22], [-7, -32], [16, -30], [34, -20]]) { ell(ctx, x, y, 3.6, 3.6); paint(ctx, ball(ctx, x, y, 3.6, '#ffffff', 0, 0.15), 1.6); }
      break;
    }
    case 'helmet': {
      const dome = (cx) => { cx.beginPath(); cx.moveTo(-35, 10); cx.bezierCurveTo(-37, -40, 37, -40, 37, 10); cx.closePath(); };
      const plume = (cx) => { cx.beginPath(); cx.moveTo(0, -28); cx.bezierCurveTo(-28, -60, -58, -36, -50, -4); cx.bezierCurveTo(-46, -18, -38, -26, -30, -26); cx.bezierCurveTo(-24, -32, -12, -34, 0, -28); cx.closePath(); };
      clothCel(ctx, plume, r, { cx: -26, cy: -32, size: 22, lw: 2.6 });
      ctx.save(); plume(ctx); ctx.clip(); ctx.strokeStyle = rgba(shade(c, -0.45), 0.6); ctx.lineWidth = 1.6;
      for (const [a, b] of [[-14, -38], [-26, -40], [-38, -34]]) { ctx.beginPath(); ctx.moveTo(-4, -29); ctx.quadraticCurveTo(a, b, b < -36 ? -46 : a - 10, -18); ctx.stroke(); }
      ctx.restore();
      matCel(ctx, dome, r, { cx: -2, cy: -14, size: 32 });
      bevel(ctx, dome, 0.45, 1.6);
      ctx.save(); dome(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(2, -30); ctx.lineTo(2, 4); ctx.lineWidth = 3; ctx.strokeStyle = rgba(MATS[r].eng, 0.45); ctx.stroke(); ctx.restore();
      const band = (cx) => rr(cx, -37, 1, 76, 11, 5);
      matCel(ctx, band, r >= 4 ? 4 : r, { cx: 0, cy: 6, size: 20, lw: 2.4, facets: false });
      for (const x of [-26, -12, 16, 30]) { ell(ctx, x, 6.5, 2.1, 2.1); ctx.fillStyle = OUT; ctx.fill(); ell(ctx, x - 0.6, 5.9, 0.8, 0.8); ctx.fillStyle = '#ffffff'; ctx.fill(); }
      gem(ctx, 2, 6, 4, r);
      break;
    }
    case 'cowboy': {
      const lc = r >= 4 ? mix('#b8743a', c, 0.25) : '#b8793f';
      const brim = (cx) => { cx.beginPath(); cx.moveTo(-48, -6); cx.quadraticCurveTo(-40, 10, 0, 10); cx.quadraticCurveTo(40, 10, 50, -6); cx.quadraticCurveTo(44, 2, 26, 0); cx.quadraticCurveTo(0, 6, -24, 0); cx.quadraticCurveTo(-42, 2, -48, -6); cx.closePath(); };
      const crown = (cx) => { cx.beginPath(); cx.moveTo(-23, 2); cx.bezierCurveTo(-26, -32, -8, -30, 0, -22); cx.bezierCurveTo(8, -30, 28, -32, 24, 2); cx.closePath(); };
      toon(ctx, crown, lc, { cx: 0, cy: -12, size: 24 });
      ctx.save(); crown(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -8); ctx.lineWidth = 2; ctx.strokeStyle = rgba(OUT, 0.35); ctx.stroke(); ctx.restore();
      const band = (cx) => rr(cx, -23, -7, 47, 8, 3);
      clothCel(ctx, band, r, { cx: 0, cy: -3, size: 12, lw: 2.2, glint: false });
      toon(ctx, brim, shade(lc, -0.06), { cx: 0, cy: 2, size: 34, hi: 0.15 });
      star5(ctx, 9, -3, 5.5, 2.4); matCel(ctx, (cx) => star5(cx, 9, -3, 5.5, 2.4), r >= 4 ? r : 4, { cx: 9, cy: -3, size: 5, lw: 1.6, facets: false });
      break;
    }
    case 'beret': {
      const sh = (cx) => smooth(cx, [[-36, 4], [-42, -8], [-30, -20], [-6, -26], [22, -22], [38, -10], [36, 2], [14, 6], [-14, 7]], true, 0.55);
      clothCel(ctx, sh, r, { cx: -4, cy: -10, size: 30 });
      ctx.save(); sh(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(0, 8, 40, -2); ctx.lineWidth = 5; ctx.strokeStyle = rgba(OUT, 0.22); ctx.stroke(); ctx.restore();
      const stalk = (cx) => { cx.beginPath(); cx.moveTo(0, -24); cx.quadraticCurveTo(2, -32, 6, -33); cx.quadraticCurveTo(6, -28, 5, -24); cx.closePath(); };
      clothCel(ctx, stalk, r, { cx: 3, cy: -28, size: 4, lw: 2, base: r < 8 ? d : undefined, glint: false, hi: 0 });
      if (r >= 3) { ctx.beginPath(); ctx.moveTo(26, -12); ctx.quadraticCurveTo(38, -26, 32, -38); ctx.lineWidth = 4.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffffff'; ctx.stroke(); gem(ctx, 24, -10, 4, r); }
      break;
    }
    case 'bandana': {
      const t1 = (cx) => smooth(cx, [[-30, 6], [-50, -6], [-62, 2], [-48, 14]], true, 0.4);
      const t2 = (cx) => smooth(cx, [[-30, 9], [-44, 22], [-48, 38], [-36, 26]], true, 0.4);
      clothCel(ctx, t2, r, { cx: -40, cy: 22, size: 12, base: shade(c, -0.2), lw: 2.4 });
      clothCel(ctx, t1, r, { cx: -46, cy: 4, size: 12, lw: 2.4 });
      const wrap = (cx) => { cx.beginPath(); cx.moveTo(-36, 12); cx.bezierCurveTo(-40, -32, 36, -36, 39, 9); cx.quadraticCurveTo(2, -4, -36, 12); cx.closePath(); };
      clothCel(ctx, wrap, r, { cx: -2, cy: -12, size: 30, lw: 2.8 });
      ctx.save(); wrap(ctx); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [x, y] of [[-24, -4], [-10, -14], [6, -16], [22, -10], [-16, 4], [0, -2], [16, 0], [30, 2], [-30, 8], [-4, -24], [14, -24]]) { ell(ctx, x, y, 2.1, 2.1); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-34, 6); ctx.quadraticCurveTo(2, -10, 38, 4); ctx.lineWidth = 2; ctx.strokeStyle = rgba(OUT, 0.3); ctx.stroke();
      ctx.restore();
      const knot = (cx) => ell(cx, -31, 7, 6.5, 6);
      clothCel(ctx, knot, r, { cx: -31, cy: 7, size: 6, base: shade(c, -0.1), lw: 2.4, glint: false });
      if (r >= 4) gem(ctx, 26, -4, 3.4, r);
      break;
    }
    case 'tophat': {
      const brim = (cx) => ell(cx, 0, 4, 38, 8.5, -0.04);
      const tube = (cx) => { cx.beginPath(); cx.moveTo(-21, 2); cx.lineTo(-23, -48); cx.quadraticCurveTo(0, -54, 23, -48); cx.lineTo(21, 2); cx.closePath(); };
      toon(ctx, brim, '#2c2442', { cx: 0, cy: 4, size: 30, hi: 0.2 });
      toon(ctx, tube, '#3a3052', { cx: -2, cy: -24, size: 28, hi: 0.18 });
      ell(ctx, 0, -48.5, 23, 5); paint(ctx, '#4a4064', 2.4);
      const band = (cx) => { cx.beginPath(); cx.moveTo(-22, -14); cx.quadraticCurveTo(0, -18, 22, -14); cx.lineTo(21.5, -4); cx.quadraticCurveTo(0, -8, -21.5, -4); cx.closePath(); };
      clothCel(ctx, band, r, { cx: 0, cy: -10, size: 14, lw: 2.2, glint: false });
      ctx.save(); tube(ctx); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-15, -46, 4, 30); ctx.restore();
      if (r >= 4) { gem(ctx, 12, -10, 4, r); ctx.beginPath(); ctx.moveTo(14, -14); ctx.quadraticCurveTo(22, -36, 34, -40); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = c; ctx.stroke(); }
      break;
    }
    case 'flowers': {
      const cols = [c, '#ffffff', shade(c, 0.45), '#ffe14d', shade(c, 0.25)];
      ctx.beginPath(); ctx.ellipse(0, 6, 34, 11, 0, Math.PI, Math.PI * 2); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.6; ctx.strokeStyle = '#4fae5a'; ctx.stroke();
      const pos = [0, 1, 2, 3, 4].map((i) => { const a = Math.PI + (i / 4) * Math.PI; return [Math.cos(a) * 32, Math.sin(a) * 11 + 5]; });
      for (let i = 0; i < 4; i++) {
        const x = (pos[i][0] + pos[i + 1][0]) / 2, y = (pos[i][1] + pos[i + 1][1]) / 2 - 3;
        const lf = (cx) => { cx.beginPath(); cx.ellipse(x, y, 7, 3.6, i < 2 ? -0.5 : 0.5, 0, Math.PI * 2); };
        toon(ctx, lf, '#5fc86a', { cx: x, cy: y, size: 6, lw: 2, glint: false, rim: false });
      }
      pos.forEach(([x, y], i) => {
        const R = i === 2 ? 9 : 7.4, col = cols[i % cols.length];
        const fl = (cx) => { cx.beginPath(); for (let p = 0; p < 5; p++) { const pa = (p / 5) * Math.PI * 2 + i - Math.PI / 2; cx.moveTo(x, y); cx.arc(x + Math.cos(pa) * R * 0.55, y + Math.sin(pa) * R * 0.55, R * 0.52, pa - 1.6, pa + 1.6); } };
        ctx.save(); fl(ctx); ctx.lineWidth = 4.4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
        ctx.save(); fl(ctx); ctx.clip(); ell(ctx, x + R * 0.4, y + R * 0.45, R * 0.8, R * 0.5); ctx.fillStyle = rgba(OUT, 0.14); ctx.fill(); ctx.restore();
        if (i === 2 && r >= 4) gem(ctx, x, y, 3.6, r);
        else { ell(ctx, x, y, R * 0.3, R * 0.3); paint(ctx, '#ffb52e', 1.4); }
      });
      break;
    }
    case 'viking': {
      for (const s of [-1, 1]) {
        const horn = (cx) => smooth(cx, [[s * 24, -4], [s * 44, -14], [s * 52, -42], [s * 46, -26], [s * 24, -16]], true, 0.42);
        toon(ctx, horn, '#fff1d6', { cx: s * 38, cy: -20, size: 16, lw: 2.6, rim: rimFor(r) });
        ctx.save(); horn(ctx); ctx.clip(); ctx.strokeStyle = 'rgba(160,110,60,0.55)'; ctx.lineWidth = 1.6;
        for (const t of [0.35, 0.6]) { ctx.beginPath(); ctx.moveTo(s * (26 + t * 20), -18 - t * 6); ctx.lineTo(s * (30 + t * 20), -6 - t * 12); ctx.stroke(); }
        ctx.restore();
      }
      const dome = (cx) => { cx.beginPath(); cx.moveTo(-33, 8); cx.bezierCurveTo(-33, -36, 33, -36, 33, 8); cx.closePath(); };
      matCel(ctx, dome, r, { cx: -2, cy: -12, size: 30 });
      bevel(ctx, dome, 0.4);
      ctx.save(); dome(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, 6); ctx.lineWidth = 6; ctx.strokeStyle = rgba(MATS[r].eng, 0.4); ctx.stroke(); ctx.restore();
      const band = (cx) => rr(cx, -35, 0, 70, 10, 4);
      matCel(ctx, band, r >= 4 ? 4 : 1, { cx: 0, cy: 5, size: 18, lw: 2.4, facets: false });
      for (const x of [-25, -12, 12, 25]) { ell(ctx, x, 5, 2.1, 2.1); paint(ctx, '#fff6e0', 1.2); }
      gem(ctx, 0, 5, 3.6, r);
      break;
    }
    case 'chef': {
      const puff = (cx) => { cx.beginPath(); cx.arc(-15, -26, 13, Math.PI * 0.6, Math.PI * 1.75); cx.arc(0, -36, 15, Math.PI * 1.15, Math.PI * 1.85); cx.arc(15, -26, 13, Math.PI * 1.25, Math.PI * 0.4); cx.lineTo(20, -6); cx.lineTo(-20, -6); cx.closePath(); };
      toon(ctx, puff, '#ffffff', { cx: -4, cy: -26, size: 26, shadow: 0.13, hi: 0, rim: rimFor(r) });
      ctx.save(); puff(ctx); ctx.clip(); ctx.strokeStyle = 'rgba(120,110,150,0.35)'; ctx.lineWidth = 1.6;
      for (const x of [-8, 8]) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.quadraticCurveTo(x * 1.1, -18, x * 0.9, -8); ctx.stroke(); }
      ctx.restore();
      const band = (cx) => rr(cx, -21, -8, 42, 13, 3);
      toon(ctx, band, '#f4f1fa', { cx: 0, cy: -2, size: 16, shadow: 0.12, hi: 0, glint: false });
      const st = (cx) => rr(cx, -21, -1, 42, 5, 2);
      clothCel(ctx, st, r, { cx: 0, cy: 1, size: 8, lw: 2, glint: false });
      break;
    }
    case 'party': {
      const cone = (cx) => { cx.beginPath(); cx.moveTo(-21, 4); cx.lineTo(-2, -50); cx.lineTo(21, 4); cx.quadraticCurveTo(0, 9, -21, 4); cx.closePath(); };
      clothCel(ctx, cone, r, { cx: -4, cy: -16, size: 22 });
      ctx.save(); cone(ctx); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 4.4;
      for (let y = -42; y < 8; y += 12) { ctx.beginPath(); ctx.moveTo(-26, y + 10); ctx.lineTo(26, y - 5); ctx.stroke(); }
      ctx.restore();
      outline(ctx, cone, 2.6);
      for (let i = 0; i < 5; i++) { const x = -18 + i * 9; ell(ctx, x, 5.5, 4.2, 3.4); paint(ctx, i % 2 ? '#ffffff' : '#ffe14d', 1.4); }
      const pom = (cx) => ell(cx, -2, -52, 7, 7);
      toon(ctx, pom, '#ffe14d', { cx: -2, cy: -52, size: 7, lw: 2.2 });
      break;
    }
    case 'cap': {
      const dome = (cx) => { cx.beginPath(); cx.moveTo(-33, 6); cx.bezierCurveTo(-35, -32, 31, -34, 33, 4); cx.closePath(); };
      const bill = (cx) => { cx.beginPath(); cx.moveTo(18, 1); cx.quadraticCurveTo(52, -4, 62, 8); cx.quadraticCurveTo(44, 14, 16, 9); cx.closePath(); };
      clothCel(ctx, bill, r, { cx: 38, cy: 6, size: 18, base: shade(c, -0.28), hi: 0.15 });
      clothCel(ctx, dome, r, { cx: -2, cy: -12, size: 30 });
      ctx.save(); dome(ctx); ctx.clip(); ctx.strokeStyle = rgba(OUT, 0.3); ctx.lineWidth = 1.6;
      for (const x of [-14, 12]) { ctx.beginPath(); ctx.moveTo(-1, -28); ctx.quadraticCurveTo(x, -16, x * 1.4, 6); ctx.stroke(); }
      ctx.restore();
      ell(ctx, -1, -27, 4, 2.6); paint(ctx, d, 1.6);
      ell(ctx, 4, -8, 9.5, 9); paint(ctx, '#ffffff', 2);
      ctx.fillStyle = r >= 8 ? '#ff5fb0' : shade(c, -0.15); pawPrint(ctx, 4, -8.5, 6.4);
      break;
    }
    default: { // beanie
      const dome = (cx) => { cx.beginPath(); cx.moveTo(-33, 8); cx.bezierCurveTo(-35, -36, 35, -36, 33, 8); cx.closePath(); };
      clothCel(ctx, dome, r, { cx: -2, cy: -12, size: 30, lw: 0 });
      ctx.save(); dome(ctx); ctx.clip(); ctx.strokeStyle = rgba(OUT, 0.16); ctx.lineWidth = 3;
      for (let x = -28; x < 34; x += 8) { ctx.beginPath(); ctx.moveTo(x, -32); ctx.quadraticCurveTo(x * 1.08, -10, x * 1.12, 8); ctx.stroke(); }
      ctx.restore();
      outline(ctx, dome, 2.8);
      const cuff = (cx) => rr(cx, -36, -1, 72, 13, 6.5);
      toon(ctx, cuff, '#fbf6ff', { cx: 0, cy: 5, size: 22, shadow: 0.14, hi: 0, glint: false });
      ctx.save(); cuff(ctx); ctx.clip(); ctx.strokeStyle = 'rgba(110,100,150,0.3)'; ctx.lineWidth = 2;
      for (let x = -32; x < 36; x += 6) { ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x, 12); ctx.stroke(); }
      ctx.restore();
      const pom = (cx) => smooth(cx, [[0, -40], [7, -38], [10, -31], [7, -24], [0, -22], [-7, -24], [-10, -31], [-7, -38]], true, 0.6);
      toon(ctx, pom, '#ffffff', { cx: 0, cy: -31, size: 10, shadow: 0.14, lw: 2.4, rim: rimFor(r) });
      if (r >= 4) gem(ctx, 18, 5.5, 3.6, r);
    }
  }
}

// ------------------------------------------------------------------ VISAGE
// Repère de la tête (vue 3/4 vers la droite) : œil proche (1,-2), œil lointain (30,-2), nez (19,8)
export const FACE_EYES = { near: [1, -2], far: [30, -2] };
export function drawFace(ctx, base, r) {
  r = clampR(r);
  const c = RCOL[r];
  const frame = r >= 8 ? '#ffe27a' : r >= 4 ? MATS[r].base : shade(c, -0.05);
  const ringStroke = (path, w = 2.6) => { path(); ctx.lineWidth = w + 3; ctx.strokeStyle = OUT; ctx.stroke(); path(); ctx.lineWidth = w; ctx.strokeStyle = frame; ctx.stroke(); };
  switch (base) {
    case 'round': {
      for (const [x, rx, ry] of [[1, 13, 13.5], [30, 9.5, 12.5]]) { ell(ctx, x, -2, rx, ry); ctx.fillStyle = rgba('#cdeeff', 0.28); ctx.fill(); }
      ringStroke(() => { ctx.beginPath(); ctx.moveTo(14, -6); ctx.quadraticCurveTo(17, -10, 20.5, -6); }, 2.2);
      ringStroke(() => { ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-40, -8); }, 2.2);
      for (const [x, rx, ry] of [[1, 13, 13.5], [30, 9.5, 12.5]]) ringStroke(() => ell(ctx, x, -2, rx, ry), 2.6);
      for (const [x, s] of [[-4, 1], [26.5, 0.75]]) { ctx.save(); ctx.translate(x, -8); ctx.rotate(-0.6); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-1.2 * s, -4 * s, 2.4 * s, 8 * s); ctx.restore(); }
      break;
    }
    case 'sun': {
      const lens = (x, w, h) => (cx) => { cx.beginPath(); cx.moveTo(x - w / 2, -12); cx.lineTo(x + w / 2, -12); cx.quadraticCurveTo(x + w / 2 + 1, 4, x + 2, 5); cx.quadraticCurveTo(x - w / 2 - 1, 6, x - w / 2, -12); cx.closePath(); };
      ringStroke(() => { ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-40, -10); }, 2.4);
      for (const [x, w] of [[0, 27], [30, 19]]) {
        const sh = lens(x, w);
        ctx.save(); sh(ctx); const g = ctx.createLinearGradient(0, -12, 0, 6); g.addColorStop(0, '#1d1530'); g.addColorStop(1, shade(c, -0.25)); ctx.fillStyle = g; ctx.fill();
        ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; poly(ctx, [[x - w / 2 + 3, -12], [x - w / 2 + 9, -12], [x - w / 2 - 1, 6], [x - w / 2 - 7, 6]]); ctx.fill();
        ctx.restore();
        outline(ctx, sh, 2.6);
      }
      ringStroke(() => { ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(42, -12); }, 2.6);
      break;
    }
    case 'monocle': {
      ell(ctx, 1, -2, 14.5, 14.5); ctx.fillStyle = rgba('#cdeeff', 0.25); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(-18, 22, -8, 30); ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.8; ctx.strokeStyle = MATS[Math.max(4, r)].base; ctx.stroke();
      const ring = (cx) => { cx.beginPath(); cx.arc(1, -2, 16.5, 0, Math.PI * 2); cx.arc(1, -2, 12.5, 0, Math.PI * 2, true); };
      matCel(ctx, ring, Math.max(4, r), { cx: 1, cy: -2, size: 16, lw: 2, facets: false, glint: false, rim: false });
      ctx.save(); ctx.translate(-5, -9); ctx.rotate(-0.6); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-1.3, -4.5, 2.6, 9); ctx.restore();
      if (r >= 4) gem(ctx, 15, -13, 3, r);
      break;
    }
    case 'patch': {
      ctx.beginPath(); ctx.moveTo(-40, -24); ctx.quadraticCurveTo(0, -26, 20, -12); ctx.moveTo(41, -4); ctx.lineTo(47, 4);
      ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#3a2e44'; ctx.stroke();
      const sh = (cx) => { cx.beginPath(); cx.moveTo(17, -13); cx.quadraticCurveTo(31, -20, 43, -10); cx.quadraticCurveTo(46, 9, 31, 15); cx.quadraticCurveTo(15, 10, 17, -13); cx.closePath(); };
      toon(ctx, sh, '#2e2640', { cx: 30, cy: -1, size: 15, hi: 0.2, rim: rimFor(r) });
      if (r >= 2) { const s2 = (cx) => star5(cx, 30.5, 0, 6.5, 2.8); matCel(ctx, s2, r >= 4 ? r : 4, { cx: 30.5, cy: 0, size: 6, lw: 1.6, facets: false }); }
      break;
    }
    case 'ninja': {
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-44, 8); cx.quadraticCurveTo(8, 3, 48, 6); cx.quadraticCurveTo(46, 24, 30, 31); cx.quadraticCurveTo(4, 37, -28, 27); cx.quadraticCurveTo(-42, 20, -44, 8); cx.closePath(); };
      const knot = (cx) => smooth(cx, [[-40, 12], [-58, 4], [-66, 14], [-52, 20], [-62, 32], [-46, 24]], true, 0.4);
      toon(ctx, knot, '#2e3046', { cx: -54, cy: 12, size: 12, lw: 2.4, rim: rimFor(r) });
      toon(ctx, sh, '#2e3046', { cx: 6, cy: 14, size: 30, hi: 0.14, rim: rimFor(r) });
      ctx.save(); sh(ctx); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
      for (const y of [16, 24]) { ctx.beginPath(); ctx.moveTo(-40, y - 6); ctx.quadraticCurveTo(10, y, 46, y - 10); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-44, 8); ctx.quadraticCurveTo(8, 3, 48, 6); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = r >= 8 ? '#ff9af0' : c; ctx.stroke();
      break;
    }
    case 'star': {
      for (const [x, R] of [[0, 15.5], [30, 12]]) {
        const sh = (cx) => star5(cx, x, -2, R, R * 0.55, -Math.PI / 2 + (x ? 0.12 : -0.08));
        ctx.save(); sh(ctx); ctx.fillStyle = rgba(r >= 8 ? '#ff9af0' : c, 0.45); ctx.fill(); ctx.restore();
        ctx.save(); sh(ctx); ctx.lineWidth = 6.2; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = r >= 8 ? '#ffe27a' : shade(c, 0.15); ctx.stroke(); ctx.restore();
        sparkle(ctx, x - R * 0.35, -2 - R * 0.35, R * 0.35, '#ffffff', 0.9);
      }
      ringStroke(() => { ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(19, -6); }, 2.2);
      break;
    }
    case 'visor': {
      const col = r >= 8 ? '#ff9af0' : c;
      halo(ctx, 14, -3, 40, col, 0.45);
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-20, -13); cx.lineTo(50, -11); cx.quadraticCurveTo(54, -3, 48, 5); cx.lineTo(-18, 6); cx.quadraticCurveTo(-24, -3, -20, -13); cx.closePath(); };
      ctx.save(); sh(ctx); const g = ctx.createLinearGradient(0, -13, 0, 6); g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.25)); ctx.fillStyle = g; ctx.fill();
      ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-16, -9, 62, 2.6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = -14; x < 48; x += 7) ctx.fillRect(x, -3, 4, 1.6);
      ctx.restore();
      outline(ctx, sh, 2.6);
      matCel(ctx, (cx) => rr(cx, -26, -9, 8, 11, 3), r, { cx: -22, cy: -4, size: 6, lw: 2, facets: false });
      break;
    }
    case 'stache': {
      const col = r >= 4 ? MATS[r].base : '#3a2a20';
      for (const s of [-1, 1]) {
        const sh = (cx) => smooth(cx, [[19, 12], [19 + s * 9, 10], [19 + s * 18, 6], [19 + s * 23, 1], [19 + s * 22, 9], [19 + s * 14, 16], [19 + s * 5, 16]], true, 0.5);
        if (r >= 8) matCel(ctx, sh, 8, { cx: 19 + s * 12, cy: 10, size: 10, lw: 2.2 });
        else toon(ctx, sh, col, { cx: 19 + s * 12, cy: 10, size: 10, lw: 2.2, rim: rimFor(r) });
      }
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------------ AILES / DOS (ancre = haut du dos, s'étendent vers l'arrière/haut)
export function drawWings(ctx, base, r) {
  r = clampR(r);
  const c = RCOL[r];
  switch (base) {
    case 'bat': {
      const col = r >= 4 ? shade(c, -0.45) : '#4a2a5e';
      const sh = (cx) => { cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-18, -46); cx.lineTo(-60, -56); cx.quadraticCurveTo(-56, -36, -68, -24); cx.quadraticCurveTo(-52, -22, -50, -6); cx.quadraticCurveTo(-34, -14, -26, 2); cx.quadraticCurveTo(-12, -6, 0, 0); cx.closePath(); };
      toon(ctx, sh, col, { cx: -30, cy: -26, size: 34, rim: shade(c, 0.3), rimW: 4 });
      ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      for (const [x, y] of [[-60, -56], [-68, -24], [-50, -6], [-26, 2]]) { ctx.beginPath(); ctx.moveTo(-18, -46); ctx.lineTo(x, y); ctx.stroke(); }
      outline(ctx, sh, 2.6);
      matCel(ctx, (cx) => poly(cx, [[-18, -46], [-14, -58], [-12, -44]]), r >= 4 ? r : 0, { cx: -15, cy: -50, size: 6, lw: 2, facets: false, glint: false });
      break;
    }
    case 'butterfly': {
      const up = (cx) => smooth(cx, [[0, -4], [-8, -42], [-32, -66], [-58, -60], [-60, -38], [-38, -18]], true, 0.5);
      const lo = (cx) => smooth(cx, [[0, -2], [-28, -14], [-44, 2], [-34, 18], [-12, 12]], true, 0.5);
      for (const [sh, cc, cx0, cy0, k] of [[lo, shade(c, 0.12), -22, 2, 18], [up, c, -30, -40, 28]]) {
        if (r >= 8) matCel(ctx, sh, 8, { cx: cx0, cy: cy0, size: k, lw: 0 }); else toon(ctx, sh, cc, { cx: cx0, cy: cy0, size: k, lw: 0, rim: shade(c, 0.6) });
        ctx.save(); sh(ctx); ctx.clip();
        sh(ctx); ctx.lineWidth = 8; ctx.strokeStyle = shade(c, -0.5); ctx.stroke();
        ctx.restore();
        outline(ctx, sh, 2.6);
      }
      ctx.strokeStyle = rgba(shade(c, -0.55), 0.7); ctx.lineWidth = 1.8;
      for (const [x, y] of [[-32, -58], [-52, -46], [-40, -24]]) { ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo((x - 2) / 2, (y - 6) / 2 - 4, x, y); ctx.stroke(); }
      for (const [x, y, rad] of [[-38, -48, 6.5], [-22, -30, 4], [-26, 2, 4.5]]) { ell(ctx, x, y, rad, rad); paint(ctx, '#ffffff', 1.8); ell(ctx, x + 1, y + 1, rad * 0.45, rad * 0.45); ctx.fillStyle = shade(c, -0.3); ctx.fill(); }
      break;
    }
    case 'dragon': {
      const col = r >= 4 ? c : '#d6454f';
      const sh = (cx) => { cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-12, -50); cx.lineTo(-30, -64); cx.lineTo(-70, -50); cx.quadraticCurveTo(-58, -44, -58, -38); cx.quadraticCurveTo(-68, -30, -66, -22); cx.quadraticCurveTo(-52, -22, -48, -14); cx.quadraticCurveTo(-50, -4, -46, 0); cx.quadraticCurveTo(-34, -8, -22, -2); cx.closePath(); };
      if (r >= 8) matCel(ctx, sh, 8, { cx: -32, cy: -30, size: 34, lw: 0 }); else toon(ctx, sh, col, { cx: -32, cy: -30, size: 34, lw: 0, rim: shade(col, 0.5) });
      ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const [x, y] of [[-70, -50], [-66, -22], [-46, 0]]) { ctx.beginPath(); ctx.moveTo(-12, -50); ctx.quadraticCurveTo((x - 12) / 2, (y - 50) / 2 - 6, x, y); ctx.stroke(); }
      outline(ctx, sh, 2.6);
      const bone = (cx) => { cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-12, -50); cx.lineTo(-30, -64); cx.lineTo(-27, -57); cx.lineTo(-9, -46); cx.lineTo(4, 0); cx.closePath(); };
      toon(ctx, bone, shade(col, -0.25), { cx: -10, cy: -36, size: 14, lw: 2.2, glint: false, rim: false });
      matCel(ctx, (cx) => poly(cx, [[-30, -64], [-32, -76], [-24, -62]]), r >= 4 ? r : 0, { cx: -29, cy: -68, size: 6, lw: 2, facets: false, glint: false, base: r < 4 ? '#fff1d6' : undefined });
      break;
    }
    case 'fairy': {
      const col = r >= 8 ? '#ffd0f5' : shade(c, 0.45);
      halo(ctx, -26, -30, 46, r >= 8 ? '#ff9af0' : c, 0.32);
      for (const [x, y, rx, ry, a] of [[-24, -14, 22, 9, -0.25], [-28, -40, 32, 13, -0.7]]) {
        const sh = (cx) => { cx.beginPath(); cx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); };
        ctx.save(); sh(ctx); ctx.fillStyle = rgba(col, 0.6); ctx.fill();
        ctx.clip(); ctx.translate(2, 3); sh(ctx); ctx.fillStyle = rgba('#ffffff', 0.35); ctx.fill(); ctx.restore();
        ctx.save(); ctx.strokeStyle = rgba(shade(c, -0.2), 0.7); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(x - Math.cos(a) * rx * 0.8, y - Math.sin(a) * rx * 0.8); ctx.stroke(); ctx.restore();
        outline(ctx, sh, 2.2, rgba(shade(c, -0.45), 0.95));
      }
      sparkle(ctx, -36, -48, 6); sparkle(ctx, -14, -12, 3.6);
      if (r >= 4) sparkle(ctx, -52, -30, 4.5, shade(c, 0.6));
      break;
    }
    case 'jetpack': {
      for (const x of [-24, -9]) {
        const tank = (cx) => rr(cx, x - 7.5, -40, 15, 44, 7.5);
        matCel(ctx, tank, r, { cx: x, cy: -22, size: 14, lw: 2.6 });
        const noz = (cx) => { cx.beginPath(); cx.moveTo(x - 5, 3); cx.lineTo(x + 5, 3); cx.lineTo(x + 7, 11); cx.lineTo(x - 7, 11); cx.closePath(); };
        toon(ctx, noz, '#4a4064', { cx: x, cy: 7, size: 6, lw: 2.2, glint: false, rim: false });
        ctx.save(); tank(ctx); ctx.clip(); rr(ctx, x - 8, -30, 16, 5, 1); ctx.fillStyle = r >= 8 ? '#ff7ae0' : c; ctx.fill(); ctx.restore();
        if (r >= 4) { glow(ctx, x, 14, 12, '#ffb52e', 0.8); poly(ctx, [[x - 4, 11], [x, 22], [x + 4, 11]]); paint(ctx, '#ffe14d', 1.4); }
      }
      matCel(ctx, (cx) => rr(cx, -30, -22, 28, 8, 4), r >= 4 ? 4 : 1, { cx: -16, cy: -18, size: 12, lw: 2.2, facets: false });
      gem(ctx, -16, -18, 3.2, r);
      break;
    }
    case 'fishpack': {
      const body = (cx) => { cx.beginPath(); cx.ellipse(-22, -18, 25, 17, -0.2, 0, Math.PI * 2); };
      const tail = (cx) => { cx.beginPath(); cx.moveTo(-44, -12); cx.lineTo(-62, -30); cx.quadraticCurveTo(-56, -16, -62, -2); cx.closePath(); };
      toon(ctx, tail, '#5f8fc4', { cx: -54, cy: -15, size: 10, lw: 2.4 });
      toon(ctx, body, '#7fb0e0', { cx: -22, cy: -20, size: 22 });
      ctx.save(); body(ctx); ctx.clip(); ell(ctx, -18, -6, 20, 7, -0.2); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(); ctx.restore();
      ell(ctx, -7, -24, 3.6, 3.6); paint(ctx, '#ffffff', 1.4); ell(ctx, -6.4, -24, 1.8, 2); ctx.fillStyle = '#1d1530'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-12, -32); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = r >= 8 ? '#ff9af0' : c; ctx.stroke();
      if (r >= 2) gem(ctx, -6, -17, 3, r);
      break;
    }
    default: { // ange
      const col = r >= 4 ? shade(c, 0.6) : '#ffffff';
      if (r >= 4) halo(ctx, -22, -28, 44, r >= 8 ? '#fff27a' : c, 0.35);
      for (let i = 4; i >= 0; i--) {
        const a = -2.15 + i * 0.27;
        const len = 56 - i * 6;
        const x = Math.cos(a) * len * 0.5, y = Math.sin(a) * len * 0.5;
        const sh = (cx) => { cx.beginPath(); cx.ellipse(x, y, len * 0.56, 9.5, a, 0, Math.PI * 2); };
        if (r >= 8 && i === 0) matCel(ctx, sh, 8, { cx: x, cy: y, size: 14, lw: 2.4 });
        else toon(ctx, sh, i % 2 ? shade(col, -0.04) : col, { cx: x, cy: y, size: 13, shadow: 0.16, lw: 2.4, glint: i === 0, rim: rimFor(r) });
      }
    }
  }
}

// ------------------------------------------------------------------ ARMURE portée (repère du torse : centre (0,0), ≈ x -21..21, y -24..24)
export const TORSO_PTS = [[-12, -23], [4, -25], [16, -18], [21, -4], [21, 11], [13, 21], [-1, 24], [-15, 21], [-21, 9], [-21, -6]];
function torsoPath(ctx) { smooth(ctx, TORSO_PTS, true, 0.55); }
export function drawArmorOnBody(ctx, base, r) {
  r = clampR(r);
  const c = RCOL[r];
  const trimR = r >= 4 ? r : 1;
  const pauldron = (rr0) => {
    const sh = (cx) => smooth(cx, [[4, -18], [16, -24], [27, -16], [27, -6], [16, -6], [6, -9]], true, 0.5);
    matCel(ctx, sh, rr0, { cx: 16, cy: -14, size: 13, lw: 2.6 });
    bevel(ctx, sh, 0.45);
    ctx.save(); sh(ctx); ctx.clip(); ctx.beginPath(); ctx.moveTo(6, -11); ctx.quadraticCurveTo(16, -13, 27, -9); ctx.lineWidth = 2; ctx.strokeStyle = rgba(MATS[rr0].eng, 0.55); ctx.stroke(); ctx.restore();
  };
  switch (base) {
    case 'plate': {
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-20, -12); cx.bezierCurveTo(-14, -26, 14, -27, 21, -10); cx.lineTo(21, 12); cx.bezierCurveTo(10, 20, -10, 20, -20, 13); cx.closePath(); };
      matCel(ctx, sh, r, { cx: 0, cy: -4, size: 24 });
      bevel(ctx, sh, 0.45, 1.6);
      ctx.save(); sh(ctx); ctx.clip();
      ctx.strokeStyle = rgba(MATS[r].eng, 0.5); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(3, -22); ctx.lineTo(3, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, 6); ctx.quadraticCurveTo(0, 12, 21, 4); ctx.stroke();
      ctx.restore();
      const belt = (cx) => rr(cx, -21, 10, 43, 8, 3);
      toon(ctx, belt, LEATHER, { cx: 0, cy: 14, size: 12, lw: 2.2, glint: false, hi: 0.12, rim: false });
      matCel(ctx, (cx) => rr(cx, 4, 9, 9, 10, 2), r >= 4 ? r : 4, { cx: 8.5, cy: 14, size: 6, lw: 1.8, facets: false });
      ctx.fillStyle = r >= 4 ? (r >= 8 ? '#ff9af0' : c) : rgba(MATS[r].eng, 0.6); pawPrint(ctx, 3, -4, 5.5);
      if (r >= 4) gem(ctx, 3, -4.5, 2.8, r);
      pauldron(r);
      break;
    }
    case 'robe': {
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-21, -10); cx.bezierCurveTo(-14, -26, 14, -27, 22, -8); cx.lineTo(26, 32); cx.quadraticCurveTo(2, 36, -24, 32); cx.closePath(); };
      clothCel(ctx, sh, r, { cx: 0, cy: 0, size: 28 });
      const hem = (cx) => { cx.beginPath(); cx.moveTo(-24, 26); cx.quadraticCurveTo(2, 30, 25, 26); cx.lineTo(26, 32); cx.quadraticCurveTo(2, 36, -24, 32); cx.closePath(); };
      matCel(ctx, hem, trimR, { cx: 0, cy: 30, size: 14, lw: 2, facets: false, glint: false });
      const lap = (cx) => { cx.beginPath(); cx.moveTo(4, -22); cx.lineTo(10, -22); cx.lineTo(9, 28); cx.lineTo(4, 28); cx.closePath(); };
      matCel(ctx, lap, trimR, { cx: 7, cy: 2, size: 10, lw: 1.8, facets: false, glint: false });
      const s1 = (cx) => star5(cx, -9, 8, 6.5, 2.8);
      matCel(ctx, s1, trimR, { cx: -9, cy: 8, size: 6, lw: 1.6, facets: false });
      star5(ctx, 15, 18, 3.8, 1.7); paint(ctx, '#ffffff', 1.2);
      ell(ctx, -13, -6, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      gem(ctx, 7, -10, 3.4, r);
      break;
    }
    case 'hoodie': {
      const hood = (cx) => smooth(cx, [[-22, -16], [-12, -26], [2, -22], [-4, -12], [-18, -6]], true, 0.5);
      clothCel(ctx, hood, r, { cx: -12, cy: -16, size: 12, base: shade(c, -0.22), lw: 2.4 });
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-21, -8); cx.bezierCurveTo(-14, -24, 14, -26, 22, -8); cx.lineTo(22, 14); cx.bezierCurveTo(10, 22, -10, 22, -21, 15); cx.closePath(); };
      clothCel(ctx, sh, r, { cx: 0, cy: -2, size: 24 });
      const pocket = (cx) => { cx.beginPath(); cx.moveTo(0, 4); cx.lineTo(18, 4); cx.lineTo(21, 15); cx.lineTo(-2, 15); cx.closePath(); };
      clothCel(ctx, pocket, r, { cx: 9, cy: 9, size: 10, base: shade(c, -0.12), lw: 2, glint: false });
      const rib = (cx) => rr(cx, -21, 12, 43, 6, 3);
      clothCel(ctx, rib, r, { cx: 0, cy: 15, size: 10, base: shade(c, -0.25), lw: 2, glint: false, hi: 0 });
      for (const x of [12, 17]) { ctx.beginPath(); ctx.moveTo(x, -16); ctx.lineTo(x + 1, -2); ctx.lineWidth = 3.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 1.8; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ell(ctx, x + 1, -1, 1.8, 1.8); paint(ctx, '#ffffff', 1.2); }
      if (r >= 3) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; pawPrint(ctx, -9, 2, 5); }
      break;
    }
    case 'kimono': {
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-21, -8); cx.bezierCurveTo(-14, -24, 14, -26, 22, -8); cx.lineTo(23, 18); cx.bezierCurveTo(10, 24, -10, 24, -22, 18); cx.closePath(); };
      clothCel(ctx, sh, r, { cx: 0, cy: -2, size: 24 });
      ctx.save(); sh(ctx); ctx.clip();
      ctx.fillStyle = rgba('#ffffff', 0.22);
      for (const [x, y] of [[-12, -10], [-6, 14], [16, -2], [-16, 4]]) { ctx.beginPath(); ctx.arc(x, y, 4, Math.PI, 0); ctx.arc(x, y + 1, 2.4, 0, Math.PI, true); ctx.fill(); }
      ctx.restore();
      const col1 = (cx) => { cx.beginPath(); cx.moveTo(-2, -24); cx.lineTo(4, -24); cx.lineTo(20, 6); cx.lineTo(14, 6); cx.closePath(); };
      const col2 = (cx) => { cx.beginPath(); cx.moveTo(18, -20); cx.lineTo(23, -16); cx.lineTo(12, 6); cx.lineTo(7, 6); cx.closePath(); };
      toon(ctx, col2, '#f4f1fa', { cx: 15, cy: -6, size: 10, shadow: 0.15, lw: 2, glint: false, hi: 0 });
      toon(ctx, col1, '#ffffff', { cx: 8, cy: -8, size: 12, shadow: 0.15, lw: 2, glint: false, hi: 0 });
      const obi = (cx) => rr(cx, -22, 3, 45, 11, 3);
      matCel(ctx, obi, r >= 4 ? r : 0, { cx: 0, cy: 8, size: 16, lw: 2.2, facets: false, base: r < 4 ? '#3a3052' : undefined });
      const cord = (cx) => rr(cx, -22, 7, 45, 3, 1.5);
      clothCel(ctx, cord, r, { cx: 0, cy: 8, size: 6, lw: 1.4, glint: false, hi: 0 });
      gem(ctx, 4, 8.5, 2.8, r);
      break;
    }
    case 'royal': {
      const rm = r >= 8 ? 8 : Math.max(4, r);
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-21, -10); cx.bezierCurveTo(-14, -26, 14, -27, 22, -8); cx.lineTo(21, 14); cx.bezierCurveTo(10, 22, -10, 22, -21, 15); cx.closePath(); };
      matCel(ctx, sh, rm, { cx: 0, cy: -4, size: 24 });
      bevel(ctx, sh, 0.45, 1.6);
      ctx.save(); sh(ctx); ctx.clip();
      ctx.strokeStyle = rgba(MATS[rm].eng, 0.55); ctx.lineWidth = 1.6;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(3, -4); ctx.bezierCurveTo(3 + s * 8, -12, 3 + s * 14, 0, 3 + s * 9, 6); ctx.stroke(); }
      const sash = (cx) => { cx.beginPath(); cx.moveTo(-22, -16); cx.lineTo(-14, -20); cx.lineTo(24, 12); cx.lineTo(18, 18); cx.closePath(); };
      ctx.restore();
      ctx.save(); sh(ctx); ctx.clip(); clothCel(ctx, sash, r >= 8 ? 8 : 5, { cx: 0, cy: 0, size: 18, lw: 2, glint: false, base: r >= 5 && r < 8 ? '#2f6bff' : undefined }); ctx.restore();
      outline(ctx, sh, 2.6);
      const fur = (cx) => smooth(cx, [[-22, -14], [-12, -24], [6, -26], [20, -16], [14, -10], [4, -16], [-10, -14], [-20, -6]], true, 0.5);
      toon(ctx, fur, '#ffffff', { cx: -2, cy: -18, size: 14, shadow: 0.14, lw: 2.4, glint: false });
      ctx.fillStyle = '#2b1838';
      for (const [x, y] of [[-14, -16], [-2, -21], [10, -19]]) { poly(ctx, [[x, y - 2.4], [x + 1.4, y + 1.6], [x - 1.4, y + 1.6]]); ctx.fill(); }
      gem(ctx, 3, 4, 5, r);
      pauldron(rm);
      break;
    }
    default: { // tunique
      const sh = (cx) => { cx.beginPath(); cx.moveTo(-21, -8); cx.bezierCurveTo(-14, -24, 14, -26, 22, -8); cx.lineTo(23, 20); cx.lineTo(16, 24); cx.lineTo(10, 20); cx.lineTo(2, 25); cx.lineTo(-6, 20); cx.lineTo(-14, 24); cx.lineTo(-22, 19); cx.closePath(); };
      clothCel(ctx, sh, r, { cx: 0, cy: 0, size: 26 });
      ctx.save(); sh(ctx); ctx.clip(); ctx.strokeStyle = rgba(shade(c, -0.45), 0.45); ctx.lineWidth = 1.6;
      for (const x of [-12, 16]) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x + 2, 22); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(10, -8); ctx.lineTo(16, -20); ctx.lineWidth = 2.4; ctx.strokeStyle = rgba(OUT, 0.5); ctx.stroke();
      ctx.restore();
      const belt = (cx) => rr(cx, -22, 4, 45, 8, 3);
      toon(ctx, belt, LEATHER, { cx: 0, cy: 8, size: 12, lw: 2.2, glint: false, hi: 0.12, rim: false });
      matCel(ctx, (cx) => rr(cx, 4, 2.5, 10, 11, 2.5), trimR, { cx: 9, cy: 8, size: 7, lw: 1.8, facets: false });
      if (r >= 4) gem(ctx, 9, 8, 2.4, r);
    }
  }
}

// ------------------------------------------------------------------ CAPE (dessinée à chaque image ; vent = phase, k = amplitude)
// Repère : attache au cou en (8,-22), la cape flotte vers l'arrière (x < 0).
export function drawCape(ctx, base, r, phase, k = 1) {
  r = clampR(r);
  const c = r >= 8 ? '#b88cff' : RCOL[r];
  const w1 = Math.sin(phase) * 5 * k, w2 = Math.sin(phase + 1.3) * 7 * k, w3 = Math.sin(phase + 2.2) * 4 * k;
  const back = (cx) => {
    cx.beginPath();
    cx.moveTo(10, -24);
    cx.bezierCurveTo(-8, -32, -28, -26, -40 + w1, -8);
    cx.quadraticCurveTo(-50 + w2, 8, -46 + w2, 26);
    cx.quadraticCurveTo(-34 + w3, 20, -26 + w1 * 0.5, 28);
    cx.quadraticCurveTo(-14, 22, -2, 18);
    cx.closePath();
  };
  // doublure visible (repli intérieur, plus sombre)
  const lining = (cx) => {
    cx.beginPath();
    cx.moveTo(-2, 18);
    cx.quadraticCurveTo(-14, 22, -26 + w1 * 0.5, 28);
    cx.quadraticCurveTo(-20 + w1 * 0.3, 14, -6, 8);
    cx.closePath();
  };
  ctx.save();
  back(ctx);
  ctx.fillStyle = shade(c, -0.32); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.translate(3, -4); back(ctx); ctx.fillStyle = r >= 8 ? rainbowFill(ctx, -20, 0, 30) : c; ctx.fill();
  ctx.translate(-3, 4);
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.quadraticCurveTo(-22 + w1, -6, -26 + w2 * 0.6, 20); ctx.lineWidth = 2.4; ctx.strokeStyle = rgba(shade(c, -0.45), 0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -20); ctx.quadraticCurveTo(-10 + w1, -4, -38 + w2 * 0.8, 6); ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ffffff', 0.28); ctx.stroke();
  ctx.restore();
  lining(ctx); ctx.fillStyle = r >= 4 ? MATS[4].base : shade(c, -0.5); ctx.fill();
  back(ctx); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
  // emblème
  const ex = -26 + w1 * 0.6, ey = 2;
  ctx.fillStyle = r >= 4 ? '#ffe27a' : rgba('#ffffff', 0.9);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
  if (base === 'star') { star5(ctx, ex, ey, 7.5, 3.2); ctx.fill(); ctx.stroke(); }
  else if (base === 'moon') { ctx.beginPath(); ctx.arc(ex, ey, 7, 0.6, 5.7); ctx.arc(ex + 3.2, ey - 1.2, 5.6, 5.3, 1, true); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (base === 'skull') { ell(ctx, ex, ey - 1, 6.4, 5.8); ctx.fill(); ctx.stroke(); rr(ctx, ex - 3.4, ey + 3, 6.8, 4, 1.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = OUT; ell(ctx, ex - 2.3, ey - 1, 1.7, 2); ctx.fill(); ell(ctx, ex + 2.3, ey - 1, 1.7, 2); ctx.fill(); }
  else if (base === 'heart') { heartPath(ctx, ex, ey, 6.4); ctx.fill(); ctx.stroke(); }
  else { pawPrint(ctx, ex, ey, 7); }
  ctx.restore();
}

// ------------------------------------------------------------------ GANTS / BOTTES portés (dessinés par le héros dans ses sprites)
// Patte fermée en (0,0), rayon ≈ 7. back : patte arrière (plus sombre)
export function drawGloveOn(ctx, base, r, back = false) {
  r = clampR(r);
  const dk = back ? -0.18 : 0;
  if (base === 'boxing') {
    const sh = (cx) => smooth(cx, [[-7, -6], [2, -10], [10, -5], [10, 5], [2, 9], [-7, 6]], true, 0.6);
    toon(ctx, sh, shade('#e8323f', dk), { cx: 2, cy: 0, size: 10, lw: 2.6 });
    const cuff = (cx) => rr(cx, -10, -6, 6, 12, 2.5);
    toon(ctx, cuff, shade('#ffffff', dk - 0.04), { cx: -7, cy: 0, size: 6, lw: 2.2, glint: false, hi: 0 });
    if (r >= 4) gem(ctx, -7, 0, 1.8, r);
  } else if (base === 'gauntlet') {
    const sh = (cx) => smooth(cx, [[-7, -7], [3, -9], [9, -4], [9, 4], [3, 8], [-7, 7]], true, 0.5);
    matCel(ctx, sh, r, { cx: 1, cy: 0, size: 9, lw: 2.6, base: back && r < 8 ? shade(MATS[r].base, -0.18) : undefined, facets: false });
    ctx.strokeStyle = rgba(OUT, 0.55); ctx.lineWidth = 1.4;
    for (const y of [-3, 1.5]) { ctx.beginPath(); ctx.moveTo(3, y - 2); ctx.lineTo(8, y); ctx.stroke(); }
    const cuff = (cx) => rr(cx, -11, -7, 6, 14, 2.5);
    matCel(ctx, cuff, r, { cx: -8, cy: 0, size: 6, lw: 2.2, facets: false, glint: false });
    if (r >= 4) gem(ctx, -1, -1, 2, r);
  } else { // mitaines
    const sh = (cx) => smooth(cx, [[-7, -6], [3, -8], [8.5, -3], [8.5, 4], [3, 7.5], [-7, 6]], true, 0.6);
    clothCel(ctx, sh, r, { cx: 1, cy: 0, size: 9, lw: 2.6, base: back && r < 8 ? shade(RCOL[r], -0.18) : undefined });
    const cuff = (cx) => rr(cx, -10, -6.5, 6, 13, 2.5);
    toon(ctx, cuff, shade('#fbf6ff', dk), { cx: -7, cy: 0, size: 6, lw: 2.2, glint: false, hi: 0 });
  }
}
// Pied en (0,0) = cheville ; semelle à y ≈ +6 ; orteils vers +x
export function drawBootOn(ctx, base, r, back = false) {
  r = clampR(r);
  const c = RCOL[r];
  const dk = back ? -0.16 : 0;
  if (base === 'slippers') {
    const sh = (cx) => smooth(cx, [[-7, -1], [2, -5], [12, -2], [14, 4], [8, 7], [-7, 7], [-9, 3]], true, 0.6);
    clothCel(ctx, sh, r, { cx: 3, cy: 1, size: 10, lw: 2.6, base: back && r < 8 ? shade(c, -0.18) : undefined });
    for (const [x, s] of [[6, -1], [11, 1]]) { poly(ctx, [[x - 2.4, -3], [x + s * 1.5, -9.5], [x + 2.4, -3]]); paint(ctx, shade(back ? shade(c, -0.18) : c, 0.1), 1.6); }
    ell(ctx, 13, 2, 2.6, 2.6); paint(ctx, '#ffffff', 1.4);
  } else if (base === 'sneakers') {
    const sh = (cx) => { cx.beginPath(); cx.moveTo(-6, -6); cx.lineTo(4, -6); cx.quadraticCurveTo(14, -2, 15, 4); cx.lineTo(15, 6); cx.lineTo(-8, 6); cx.lineTo(-8, -2); cx.closePath(); };
    toon(ctx, sh, shade('#ffffff', dk - 0.02), { cx: 3, cy: 0, size: 11, lw: 2.6, shadow: 0.16 });
    const sole = (cx) => rr(cx, -9, 3.5, 25, 4.5, 2);
    clothCel(ctx, sole, r, { cx: 3, cy: 6, size: 8, lw: 2, glint: false, hi: 0 });
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(6, -1, 4, 3); ctx.lineWidth = 2.4; ctx.strokeStyle = r >= 8 ? '#ff7ae0' : c; ctx.stroke();
  } else { // bottes
    const sh = (cx) => { cx.beginPath(); cx.moveTo(-7, -12); cx.lineTo(5, -12); cx.lineTo(5, -3); cx.quadraticCurveTo(15, -2, 15, 5); cx.lineTo(15, 6.5); cx.lineTo(-8, 6.5); cx.closePath(); };
    clothCel(ctx, sh, r, { cx: 2, cy: -2, size: 11, lw: 2.6, base: back && r < 8 ? shade(c, -0.18) : undefined });
    const cuff = (cx) => rr(cx, -9, -15, 16, 6, 3);
    matCel(ctx, cuff, r >= 4 ? r : 1, { cx: -1, cy: -12, size: 7, lw: 2.2, facets: false, glint: false });
    if (r >= 4) gem(ctx, -1, -12, 2, r);
  }
}

// ------------------------------------------------------------------ ICÔNES d'objets
function drawGlove(ctx, base, r) {
  r = clampR(r);
  if (base === 'boxing') {
    const sh = (cx) => smooth(cx, [[-14, 14], [-17, -6], [-10, -22], [6, -26], [18, -16], [20, 0], [14, 14]], true, 0.55);
    toon(ctx, sh, '#e8323f', { cx: 0, cy: -4, size: 22, rim: rimFor(r) });
    const th = (cx) => smooth(cx, [[-17, -4], [-24, -8], [-24, 4], [-16, 8]], true, 0.6);
    toon(ctx, th, '#d42a37', { cx: -20, cy: 0, size: 6, lw: 2.4, glint: false, rim: false });
    const cuff = (cx) => rr(cx, -16, 10, 32, 13, 5);
    toon(ctx, cuff, '#ffffff', { cx: 0, cy: 16, size: 14, shadow: 0.15, hi: 0 });
    ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-4, 21); ctx.moveTo(0, 12); ctx.lineTo(4, 21); ctx.lineWidth = 1.8; ctx.strokeStyle = rgba(OUT, 0.45); ctx.stroke();
    if (r >= 2) gem(ctx, 9, 16.5, 3.4, r);
    return;
  }
  const hand = (cx) => { cx.beginPath(); cx.moveTo(-13, 14); cx.lineTo(-15, -4); cx.bezierCurveTo(-18, -26, 16, -30, 15, -6); cx.lineTo(13, 14); cx.closePath(); };
  const thumb = (cx) => ell(cx, 16, -1, 7, 9.5, 0.5);
  if (base === 'gauntlet') {
    matCel(ctx, thumb, r, { cx: 16, cy: -1, size: 8, facets: false });
    matCel(ctx, hand, r, { cx: 0, cy: -4, size: 20 });
    ctx.save(); hand(ctx); ctx.clip(); ctx.strokeStyle = rgba(MATS[r].eng, 0.6); ctx.lineWidth = 1.8;
    for (const y of [-16, -8]) { ctx.beginPath(); ctx.moveTo(-15, y); ctx.quadraticCurveTo(0, y + 4, 15, y); ctx.stroke(); }
    for (const x of [-6, 2]) { ctx.beginPath(); ctx.moveTo(x, -24); ctx.lineTo(x, -17); ctx.stroke(); }
    ctx.restore();
    const cuff = (cx) => rr(cx, -16, 10, 32, 12, 4);
    matCel(ctx, cuff, r >= 4 ? r : 1, { cx: 0, cy: 16, size: 14, facets: false });
    gem(ctx, 0, 16, 3.6, r);
  } else {
    clothCel(ctx, thumb, r, { cx: 16, cy: -1, size: 8, glint: false });
    clothCel(ctx, hand, r, { cx: 0, cy: -4, size: 20 });
    ctx.save(); hand(ctx); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y] of [[-6, -14], [4, -10], [-2, -2], [8, 2], [-9, 4]]) { ctx.beginPath(); ctx.ellipse(x, y, 2.2, 1.4, 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    const cuff = (cx) => rr(cx, -16, 10, 32, 12, 5);
    toon(ctx, cuff, '#fbf6ff', { cx: 0, cy: 16, size: 14, shadow: 0.15, hi: 0 });
    ctx.save(); cuff(ctx); ctx.clip(); ctx.strokeStyle = 'rgba(110,100,150,0.3)'; ctx.lineWidth = 2; for (let x = -14; x < 16; x += 5) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 22); ctx.stroke(); } ctx.restore();
    if (r >= 4) gem(ctx, 0, 16, 3.2, r);
  }
}
function drawBoot(ctx, base, r) {
  ctx.save(); ctx.scale(2.6, 2.6); ctx.translate(-3, 2);
  drawBootOn(ctx, base, r);
  ctx.restore();
}
function drawCollar(ctx, base, r) {
  r = clampR(r);
  const c = RCOL[r];
  const band = (cx) => { cx.beginPath(); cx.ellipse(0, -4, 25, 14, 0, 0, Math.PI * 2); cx.ellipse(0, -4, 17, 8, 0, 0, Math.PI * 2, true); };
  if (base === 'pearls') {
    ctx.beginPath(); ctx.ellipse(0, -4, 21, 11, 0, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.1; const x = Math.cos(a) * 21, y = -4 + Math.sin(a) * 11; toon(ctx, (cx) => ell(cx, x, y, 4.2, 4.2), '#fbf6ff', { cx: x, cy: y, size: 4.2, shadow: 0.2, lw: 1.6, rim: shade(c, 0.4), rimW: 2 }); }
    gem(ctx, 0, 12, 6, r);
    return;
  }
  clothCel(ctx, band, r, { cx: 0, cy: -4, size: 24, base: base === 'spikes' ? '#3a3052' : undefined, rim: rimFor(r) });
  if (base === 'spikes') {
    for (let i = 0; i < 7; i++) {
      const a = 0.25 + (i / 6) * (Math.PI - 0.5);
      const bx = Math.cos(a) * 23, by = -4 + Math.sin(a) * 12.5, tx = Math.cos(a) * 31, ty = -4 + Math.sin(a) * 20, px = -Math.sin(a), py = Math.cos(a);
      const sp = (cx) => poly(cx, [[bx + px * 3.6, by + py * 3.6], [tx, ty], [bx - px * 3.6, by - py * 3.6]]);
      matCel(ctx, sp, r >= 4 ? r : 2, { cx: (bx + tx) / 2, cy: (by + ty) / 2, size: 5, lw: 1.6, facets: false, glint: false });
    }
    return;
  }
  // grelot
  rr(ctx, -4, 4, 8, 5, 2); paint(ctx, MATS[Math.max(4, r)].base, 1.6);
  const bell = (cx) => ell(cx, 0, 14, 9.5, 9.5);
  matCel(ctx, bell, r >= 4 ? r : 4, { cx: 0, cy: 14, size: 10, lw: 2.4, facets: false });
  ctx.beginPath(); ctx.moveTo(-7, 15); ctx.lineTo(7, 15); ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  ell(ctx, 0, 19, 2.2, 2.2); ctx.fillStyle = OUT; ctx.fill();
  if (r >= 4) gem(ctx, 0, 10, 2.4, r);
}
function drawRing(ctx, base, r) {
  r = clampR(r);
  const rm = r >= 8 ? 8 : Math.max(4, r);
  const band = (cx) => { cx.beginPath(); cx.ellipse(0, 8, 19, 16, 0, 0, Math.PI * 2); cx.ellipse(0, 8, 12.5, 10, 0, 0, Math.PI * 2, true); };
  matCel(ctx, band, rm, { cx: 0, cy: 8, size: 18, facets: false });
  ctx.save(); band(ctx); ctx.clip(); ctx.beginPath(); ctx.ellipse(0, 8, 15.8, 13, 0, 0, Math.PI * 2); ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(MATS[rm].eng, 0.6); ctx.stroke(); ctx.restore();
  if (base === 'gem') {
    matCel(ctx, (cx) => rr(cx, -9, -12, 18, 9, 3), rm, { cx: 0, cy: -8, size: 9, lw: 2.2, facets: false });
    const g = (cx) => poly(cx, [[-11, -14], [-5, -24], [5, -24], [11, -14], [0, -4]]);
    if (r >= 4) halo(ctx, 0, -16, 26, r >= 8 ? '#fff27a' : RCOL[r], 0.5);
    ctx.save(); g(ctx); ctx.fillStyle = r >= 8 ? rainbowFill(ctx, 0, -14, 12) : shade(RCOL[r], -0.25); ctx.fill(); ctx.clip();
    poly(ctx, [[-11, -14], [-5, -24], [0, -24], [-3, -14]]); ctx.fillStyle = r >= 8 ? 'rgba(255,255,255,0.4)' : RCOL[r]; ctx.fill();
    poly(ctx, [[-5, -24], [5, -24], [3, -18], [-3, -18]]); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.restore();
    outline(ctx, g, 2.4);
    sparkle(ctx, -4, -19, 4.4);
  } else gem(ctx, 0, -9, 7, r);
}
function drawArmorIcon(ctx, base, r) {
  r = clampR(r);
  ctx.save();
  ctx.scale(1.2, 1.2);
  if (base === 'plate' || base === 'royal') {
    const rm = base === 'royal' ? (r >= 8 ? 8 : Math.max(4, r)) : r;
    const sh = (cx) => smooth(cx, [[-4, -18], [-16, -24], [-27, -16], [-27, -6], [-16, -6], [-6, -9]], true, 0.5);
    matCel(ctx, sh, rm, { cx: -16, cy: -14, size: 13, lw: 2.6, base: rm < 8 ? shade(MATS[rm].base, -0.12) : undefined });
  } else {
    const c = base === 'kimono' || base === 'robe' ? RCOL[r] : shade(RCOL[r], -0.08);
    for (const s2 of [-1, 1]) {
      const sl = (cx) => smooth(cx, [[s2 * 10, -22], [s2 * 22, -18], [s2 * 30, -4], [s2 * 30, 6], [s2 * 20, 7], [s2 * 13, -4]], true, 0.45);
      clothCel(ctx, sl, r, { cx: s2 * 22, cy: -6, size: 12, base: r < 8 ? (s2 < 0 ? shade(c, -0.15) : c) : undefined, glint: false });
      if (base === 'robe' || base === 'kimono') { const cuff = (cx) => smooth(cx, [[s2 * 30, -2], [s2 * 31, 7], [s2 * 20, 8], [s2 * 21, 1]], true, 0.4); matCel(ctx, cuff, base === 'robe' ? (r >= 4 ? r : 1) : 0, { cx: s2 * 26, cy: 4, size: 6, lw: 2, facets: false, glint: false, base: base === 'kimono' ? '#f4f1fa' : undefined }); }
    }
  }
  drawArmorOnBody(ctx, base, r);
  ctx.restore();
}
function drawCapeIcon(ctx, base, r) {
  ctx.save(); ctx.translate(18, -2); ctx.scale(1.15, 1.15);
  drawCape(ctx, base, r, 0.6, 0.6);
  const col = (cx) => { cx.beginPath(); cx.moveTo(14, -27); cx.quadraticCurveTo(-4, -34, -20, -24); cx.quadraticCurveTo(-4, -26, 12, -20); cx.closePath(); };
  clothCel(ctx, col, r, { cx: 0, cy: -26, size: 10, lw: 2.2, base: r < 8 ? shade(RCOL[r], -0.3) : undefined, glint: false });
  matCel(ctx, (cx) => ell(cx, 10, -22, 5, 5), r >= 4 ? (r >= 8 ? 8 : 4) : 1, { cx: 10, cy: -22, size: 5, lw: 2, facets: false });
  gem(ctx, 10, -22, 2.4, r);
  ctx.restore();
}

// Zone « pleine » d'un canvas (alpha > th) : les halos lumineux ne réduisent pas l'objet
function solidBounds(cv, th = 110) {
  const ctx = cv.getContext('2d');
  const { width: W, height: H } = cv;
  let d;
  try { d = ctx.getImageData(0, 0, W, H).data; } catch (e) { return opaqueBounds(cv); }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return opaqueBounds(cv);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// Épaissit le contour extérieur (silhouette pleine dilatée, sans les halos) : lisibilité à 46–64 px
function thickOutline(src, px, th = 110) {
  const W = src.width, H = src.height;
  const m = document.createElement('canvas'); m.width = W; m.height = H;
  const mc = m.getContext('2d');
  try {
    const d = src.getContext('2d').getImageData(0, 0, W, H).data;
    const md = mc.createImageData(W, H);
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > th) { md.data[i] = 43; md.data[i + 1] = 24; md.data[i + 2] = 56; md.data[i + 3] = 255; }
    mc.putImageData(md, 0, 0);
  } catch (e) { return src; }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d');
  const n = 16;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.drawImage(m, Math.cos(a) * px, Math.sin(a) * px); }
  o.drawImage(src, 0, 0);
  return out;
}

const iconCache = new Map();
// Sprite d'icône d'objet (pour l'interface)
export function itemSprite(slot, base, r) {
  const key = slot + '|' + base + '|' + r;
  if (iconCache.has(key)) return iconCache.get(key);
  const prev = RIM; RIM = null; ICON = true;
  let s;
  switch (slot) {
    case 'weapon': {
      const tall = base === 'staff' || base === 'scythe' || base === 'trident' || base === 'fish';
      s = makeSprite(-84, -110, 168, 168, (ctx) => { ctx.rotate(base === 'bow' ? 0.5 : 0.75); ctx.translate(base === 'scythe' ? 16 : 0, tall ? 52 : base === 'bow' ? 0 : 40); const thin = base === 'staff' || base === 'wand' || base === 'trident' || base === 'ladle' || base === 'scythe' || base === 'katana';
        ctx.scale(base === 'bow' ? 1.35 : thin ? 1.55 : 1.3, base === 'bow' ? 1.2 : 1); drawWeapon(ctx, base, r); });
      break;
    }
    case 'hat': s = makeSprite(-70, -96, 140, 130, (ctx) => drawHat(ctx, base, r)); break;
    case 'face': s = makeSprite(-46, -40, 100, 84, (ctx) => { ctx.translate(-14, 0); rr(ctx, -26, -34, 80, 72, 10); ctx.clip(); drawFace(ctx, base, r); }); break;
    case 'wings': s = makeSprite(-84, -90, 104, 116, (ctx) => drawWings(ctx, base, r)); break;
    case 'armor': s = makeSprite(-46, -42, 92, 92, (ctx) => drawArmorIcon(ctx, base, r)); break;
    case 'cape': s = makeSprite(-50, -40, 88, 80, (ctx) => drawCapeIcon(ctx, base, r)); break;
    case 'gloves': s = makeSprite(-34, -40, 66, 70, (ctx) => drawGlove(ctx, base, r)); break;
    case 'boots': s = makeSprite(-36, -44, 72, 70, (ctx) => drawBoot(ctx, base, r)); break;
    case 'collar': s = makeSprite(-40, -36, 80, 66, (ctx) => drawCollar(ctx, base, r)); break;
    default: s = makeSprite(-34, -40, 68, 72, (ctx) => drawRing(ctx, base, r)); break;
  }
  RIM = prev; ICON = false;
  iconCache.set(key, s);
  return s;
}
const urlCache = new Map();
export function itemIconURL(slot, base, r) {
  const key = slot + '|' + base + '|' + r;
  if (!urlCache.has(key)) {
    const sp = itemSprite(slot, base, r);
    const size = 96, pad = 0.07;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const b = solidBounds(sp.c);
    const k = Math.min(size * (1 - pad * 2) / b.w, size * (1 - pad * 2) / b.h);
    const w = b.w * k, h = b.h * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sp.c, (size - w) / 2 - b.x * k, (size - h) / 2 - b.y * k, sp.c.width * k, sp.c.height * k);
    urlCache.set(key, thickOutline(c, 2.6).toDataURL('image/png'));
  }
  return urlCache.get(key);
}
export { star5, gem, metal };
