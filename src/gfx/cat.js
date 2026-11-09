// =====================================================================
//  Chat héros (bipède, personnalisable + équipement visible) et chatons
//  (quadrupèdes). Parties pré-rendues en sprites, animées par transformations.
// =====================================================================
import { OUT, shade, mix, rgba, ell, rr, smooth, poly, paint, vgrad, ball, gloss, glow, makeSprite, drawSprite, spriteURL, seeded } from './draw.js';
import { drawWeapon, drawHat, drawFace, drawWings, drawArmorOnBody, RCOL, METAL, star5, gem } from './gear.js';

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

function belly(fur) {
  const f = fur;
  return mix(f, '#ffffff', 0.72);
}

// ------------------------------------------------------------------ TÊTE (repère local, centre (0,0), rx≈40, ry≈34)
const HEAD_PTS = [[-2, -35], [26, -30], [41, -10], [44, 8], [32, 24], [10, 30], [-16, 28], [-36, 14], [-41, -6], [-30, -26]];
function headPath(ctx) { smooth(ctx, HEAD_PTS, true, 0.55); }

function earGeom(type, front) {
  const s = front ? 1 : -1;
  let b1, b2, tip;
  if (front) { b1 = [6, -33]; b2 = [34, -19]; tip = [31, -57]; } else { b1 = [-34, -12]; b2 = [-8, -31]; tip = [-31, -55]; }
  if (type === 'big') tip = [tip[0] + s * 2, tip[1] - 12];
  if (type === 'lynx') tip = [tip[0], tip[1] - 8];
  if (type === 'fold') tip = [tip[0] + (front ? 6 : -2), tip[1] + 18];
  return { b1, b2, tip };
}
function drawEar(ctx, look, front) {
  const { b1, b2, tip } = earGeom(look.ears, front);
  const fur = look.pattern === 'siamese' ? look.pcolor : look.fur;
  const base = front ? fur : shade(fur, -0.1);
  const mx1 = [(b1[0] + tip[0]) / 2 - 3, (b1[1] + tip[1]) / 2], mx2 = [(b2[0] + tip[0]) / 2 + 3, (b2[1] + tip[1]) / 2];
  ctx.beginPath(); ctx.moveTo(...b1); ctx.quadraticCurveTo(...mx1, ...tip); ctx.quadraticCurveTo(...mx2, ...b2); ctx.closePath();
  paint(ctx, vgrad(ctx, tip[1], b1[1], base, 0.18, 0.12), 3);
  // intérieur
  const cx = (b1[0] + b2[0]) / 2, cy = (b1[1] + b2[1]) / 2;
  const L = (p, k) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k];
  const i1 = L(b1, 0.62), i2 = L(b2, 0.62), it = L(tip, 0.75);
  ctx.beginPath(); ctx.moveTo(...i1); ctx.quadraticCurveTo((i1[0] + it[0]) / 2, (i1[1] + it[1]) / 2, ...it); ctx.quadraticCurveTo((i2[0] + it[0]) / 2, (i2[1] + it[1]) / 2, ...i2); ctx.closePath();
  ctx.fillStyle = look.fur === FURS.galaxie.c ? '#ff7ae0' : '#ffa3b8';
  ctx.fill();
  if (look.ears === 'lynx') {
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0] + (front ? 3 : -3), tip[1] - 10); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
  }
  if (look.ears === 'fold') {
    ctx.beginPath(); ctx.moveTo(L(b1, 0.3)[0], tip[1] + 6); ctx.lineTo(L(b2, 0.3)[0], tip[1] + 4); ctx.strokeStyle = rgba(OUT, 0.5); ctx.lineWidth = 2; ctx.stroke();
  }
}

function patternOnHead(ctx, look) {
  const p = look.pattern, pc = look.pcolor;
  ctx.save();
  headPath(ctx);
  ctx.clip();
  ctx.lineCap = 'round';
  if (p === 'tabby' || p === 'tiger') {
    const w = p === 'tiger' ? 5 : 3.6;
    ctx.strokeStyle = pc; ctx.lineWidth = w;
    for (const [x0, y0, x1, y1] of [[-8, -36, -6, -22], [2, -37, 3, -21], [12, -35, 10, -21]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + 3, (y0 + y1) / 2, x1, y1); ctx.stroke(); }
    for (const y of [-2, 8]) { ctx.beginPath(); ctx.moveTo(-44, y); ctx.quadraticCurveTo(-34, y - 2, -26, y + 2); ctx.stroke(); }
    if (p === 'tiger') for (const y of [-14, 0]) { ctx.beginPath(); ctx.moveTo(46, y); ctx.quadraticCurveTo(38, y + 2, 36, y + 8); ctx.stroke(); }
  } else if (p === 'tuxedo') {
    ctx.fillStyle = '#fbf8f4';
    ctx.beginPath(); ctx.moveTo(14, -30); ctx.quadraticCurveTo(26, -10, 18, 2); ctx.quadraticCurveTo(-2, 14, -10, 32); ctx.lineTo(48, 32); ctx.lineTo(48, -8); ctx.quadraticCurveTo(30, -12, 20, -30); ctx.closePath(); ctx.fill();
  } else if (p === 'calico' || p === 'tortie') {
    const r = seeded(p === 'calico' ? 7 : 13);
    const cols = p === 'calico' ? [pc, look.pcolor2] : [pc, look.pcolor2, pc];
    const blobs = p === 'calico' ? [[-24, -22, 17], [30, -26, 12], [-36, 8, 10]] : [[-20, -20, 12], [10, -30, 9], [30, -10, 8], [-34, 6, 10], [4, -16, 6]];
    blobs.forEach(([x, y, rad], i) => { smooth(ctx, Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * Math.PI * 2; const rr2 = rad * (0.75 + r() * 0.5); return [x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]; })); ctx.fillStyle = cols[i % cols.length]; ctx.fill(); });
  } else if (p === 'siamese') {
    const g = ctx.createRadialGradient(26, 8, 2, 26, 8, 30);
    g.addColorStop(0, rgba(pc, 0.95)); g.addColorStop(0.55, rgba(pc, 0.6)); g.addColorStop(1, rgba(pc, 0));
    ctx.fillStyle = g; ctx.fillRect(-50, -40, 100, 80);
  } else if (p === 'spots') {
    ctx.fillStyle = pc;
    for (const [x, y, rad] of [[-24, -18, 5], [-8, -28, 4], [-32, 2, 4.5], [30, -24, 3.5], [-18, 14, 3]]) { ell(ctx, x, y, rad, rad * 0.85); ctx.fill(); }
  } else if (p === 'galaxy') {
    const g = ctx.createRadialGradient(-16, -18, 2, -16, -18, 36);
    g.addColorStop(0, rgba('#ff7ae0', 0.55)); g.addColorStop(1, rgba('#ff7ae0', 0));
    ctx.fillStyle = g; ctx.fillRect(-50, -40, 100, 80);
    const r = seeded(31);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 3 ? '#ffffff' : '#ffd6f5'; const x = -40 + r() * 80, y = -34 + r() * 60, s = 0.8 + r() * 1.6; ell(ctx, x, y, s, s); ctx.fill(); }
  }
  ctx.restore();
}

function drawEye(ctx, x, y, rx, ry, color, style, front) {
  if (style === 'closed') {
    ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.quadraticCurveTo(x, y + ry * 0.6, x + rx, y);
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    return;
  }
  ell(ctx, x, y, rx, ry); ctx.fillStyle = '#1d1530'; ctx.fill();
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  const gal = color === EYES.galaxie.c;
  g.addColorStop(0, shade(color, -0.45)); g.addColorStop(0.6, color); g.addColorStop(1, shade(color, gal ? 0.5 : 0.35));
  ell(ctx, x, y + ry * 0.06, rx * 0.8, ry * 0.82); ctx.fillStyle = g; ctx.fill();
  if (gal) { ctx.fillStyle = '#ffffff'; for (const [dx, dy] of [[-0.3, 0.2], [0.25, -0.1], [0.1, 0.45]]) { ell(ctx, x + dx * rx, y + dy * ry, 0.9, 0.9); ctx.fill(); } }
  ell(ctx, x + rx * 0.05, y + ry * 0.08, rx * (style === 'fierce' ? 0.22 : 0.34), ry * 0.62); ctx.fillStyle = '#120b1e'; ctx.fill();
  // reflets
  if (style === 'sparkle') {
    ctx.fillStyle = '#ffffff'; star5(ctx, x - rx * 0.3, y - ry * 0.4, rx * 0.5, rx * 0.2); ctx.fill();
    ell(ctx, x + rx * 0.35, y + ry * 0.38, rx * 0.16, rx * 0.16); ctx.fill();
  } else {
    ctx.fillStyle = '#ffffff';
    ell(ctx, x - rx * 0.3, y - ry * 0.4, rx * 0.38, rx * 0.38); ctx.fill();
    ell(ctx, x + rx * 0.35, y + ry * 0.36, rx * 0.17, rx * 0.17); ctx.fill();
  }
  ell(ctx, x, y, rx, ry); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
}

function drawFaceFeatures(ctx, look, blink) {
  const ec = look.eye, ec2 = look.eye2 || ec;
  const st = blink ? 'closed' : look.eyeStyle;
  // museau
  ctx.fillStyle = look.pattern === 'siamese' ? mix(look.belly, look.pcolor, 0.35) : look.belly;
  ell(ctx, 25, 11, 15, 11); ctx.fill();
  ell(ctx, 12, 13, 10, 9); ctx.fill();
  // joues roses
  ctx.fillStyle = rgba('#ff7aa8', 0.35);
  ell(ctx, 34, 14, 7, 4); ctx.fill();
  ell(ctx, -10, 14, 5, 3.4); ctx.fill();
  drawEye(ctx, -6, -4, 7.2, 10.6, ec2, st, false);
  drawEye(ctx, 22, -4, 8.8, 12, ec, st, true);
  if (!blink && look.eyeStyle === 'sleepy') {
    for (const [x, rx, ry] of [[-6, 7.2, 10.6], [22, 8.8, 12]]) {
      ctx.save(); ell(ctx, x, -4, rx + 1, ry + 1); ctx.clip();
      ctx.fillStyle = look.pattern === 'siamese' ? look.pcolor : look.fur; ctx.fillRect(x - rx - 2, -4 - ry - 2, rx * 2 + 4, ry * 0.95);
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(x - rx, -4 - ry * 0.05); ctx.quadraticCurveTo(x, -4 + ry * 0.12, x + rx, -4 - ry * 0.05); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
    }
  }
  if (!blink && look.eyeStyle === 'fierce') {
    ctx.lineWidth = 3.4; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.moveTo(12, -20); ctx.lineTo(30, -15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(0, -19); ctx.stroke();
  }
  // nez + bouche
  ctx.beginPath(); ctx.moveTo(33, 3); ctx.quadraticCurveTo(37.5, 1, 42, 3); ctx.quadraticCurveTo(40, 8, 37.5, 9); ctx.quadraticCurveTo(35, 8, 33, 3);
  paint(ctx, look.fur === FURS.galaxie.c ? '#ff7ae0' : '#ff7f98', 1.8);
  ctx.beginPath(); ctx.moveTo(37.5, 9); ctx.lineTo(37.5, 12); ctx.moveTo(32, 12); ctx.quadraticCurveTo(35, 15.5, 37.5, 12); ctx.quadraticCurveTo(40, 15.5, 43, 12);
  ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  // moustaches
  ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(OUT, 0.75);
  for (const [y1, y2] of [[10, 5], [13, 13], [16, 21]]) { ctx.beginPath(); ctx.moveTo(44, y1); ctx.lineTo(62, y2); ctx.stroke(); }
  for (const [y1, y2] of [[11, 7], [15, 16]]) { ctx.beginPath(); ctx.moveTo(-26, y1); ctx.lineTo(-40, y2); ctx.stroke(); }
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

function drawHeadFull(ctx, look, blink, gear) {
  drawEar(ctx, look, false);
  drawEar(ctx, look, true);
  headPath(ctx);
  paint(ctx, ball(ctx, 0, -6, 44, look.fur, 0.2, 0.22), 3.2);
  patternOnHead(ctx, look);
  // reflet du crâne
  gloss(ctx, -12, -24, 12, 5, 0.18, -0.25);
  drawFaceFeatures(ctx, look, blink);
  headPath(ctx);
  ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.stroke();
  if (gear && gear.face) drawFace(ctx, gear.face.base, gear.face.r);
  if (look.acc) drawKittenAcc(ctx, look.acc, look.accColor);
  if (gear && gear.hat) { ctx.save(); ctx.translate(2, -27); drawHat(ctx, gear.hat.base, gear.hat.r); ctx.restore(); }
}

// ------------------------------------------------------------------ CORPS du héros (bipède) — repère centre (0,0)
const BODY_PTS = [[-18, -12], [-10, -22], [4, -23], [16, -14], [21, 2], [16, 18], [2, 23], [-12, 20], [-20, 6]];
function drawBodyBiped(ctx, look, gear) {
  smooth(ctx, BODY_PTS, true, 0.55);
  paint(ctx, ball(ctx, 0, 0, 26, look.fur, 0.18, 0.25), 3);
  ctx.save(); smooth(ctx, BODY_PTS, true, 0.55); ctx.clip();
  ctx.fillStyle = look.belly; ell(ctx, 8, 4, look.pattern === 'tuxedo' ? 14 : 11, look.pattern === 'tuxedo' ? 21 : 15); ctx.fill();
  const pc = look.pcolor;
  if (look.pattern === 'tabby' || look.pattern === 'tiger') {
    ctx.strokeStyle = pc; ctx.lineWidth = look.pattern === 'tiger' ? 5 : 3.6; ctx.lineCap = 'round';
    for (const y of [-14, -4, 6]) { ctx.beginPath(); ctx.moveTo(-22, y); ctx.quadraticCurveTo(-12, y - 3, -4, y + 3); ctx.stroke(); }
  } else if (look.pattern === 'calico' || look.pattern === 'tortie') {
    ctx.fillStyle = pc; ell(ctx, -12, -8, 10, 9); ctx.fill();
    ctx.fillStyle = look.pcolor2; ell(ctx, -8, 12, 8, 7); ctx.fill();
  } else if (look.pattern === 'spots') {
    ctx.fillStyle = pc; for (const [x, y] of [[-12, -10], [-4, 4], [-14, 12]]) { ell(ctx, x, y, 4, 3.4); ctx.fill(); }
  } else if (look.pattern === 'galaxy') {
    const r = seeded(9); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) { ell(ctx, -20 + r() * 40, -20 + r() * 40, 1 + r(), 1 + r()); ctx.fill(); }
  }
  ctx.restore();
  smooth(ctx, BODY_PTS, true, 0.55); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  if (gear && gear.armor) { ctx.save(); ctx.scale(0.7, 0.98); ctx.translate(1, -1); drawArmorOnBody(ctx, gear.armor.base, gear.armor.r); ctx.restore(); }
  if (gear && gear.collar) {
    const c = gear.collar.base === 'pearls' ? '#ffffff' : RCOL[gear.collar.r];
    ctx.beginPath(); ctx.ellipse(3, -19, 14, 4.5, -0.12, 0, Math.PI * 2); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.stroke();
    ell(ctx, 13, -13, 4.5, 4.5); paint(ctx, ball(ctx, 13, -13, 4.5, '#ffd54f'), 1.8);
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
  return look;
}

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
    this.head = makeSprite(-70, -100, 140, 140, (ctx) => drawHeadFull(ctx, L, false, G));
    this.headBlink = makeSprite(-70, -100, 140, 140, (ctx) => drawHeadFull(ctx, L, true, G));
    if (this.baby) this.body = makeSprite(-30, -24, 60, 46, (ctx) => drawBodyKitten(ctx, L));
    else this.body = makeSprite(-36, -30, 72, 64, (ctx) => drawBodyBiped(ctx, L, G));
    this.wings = G.wings ? makeSprite(-80, -86, 92, 98, (ctx) => drawWings(ctx, G.wings.base, G.wings.r)) : null;
    this.weapon = G.weapon ? makeSprite(-60, -100, 120, 150, (ctx) => drawWeapon(ctx, G.weapon.base, G.weapon.r)) : null;
    this.style = G.weapon ? weaponStyle(G.weapon.base) : 'slash';
    this.height = this.baby ? 88 : 128;
  }
  // Position de la pointe de l'arme / des yeux (pour les effets), en coordonnées locales (avant échelle/miroir)
  get handPos() { return this.baby ? [20, -40] : [20, -36]; }
  get eyePos() { return this.baby ? [30, -48] : [24, -80]; }

  update(dt) {
    this.t += dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2.5 + Math.random() * 3.5;
  }

  // anim : { state: 'idle'|'run'|'attack'|'cast'|'hurt'|'dead', k: 0..1, flash: 0..1 }
  draw(ctx, x, y, scale = 1, facing = 1, anim = {}) {
    const st = anim.state || 'idle', k = anim.k || 0, t = this.t;
    ctx.save();
    ctx.translate(x, y);
    // ombre au sol
    ctx.fillStyle = 'rgba(20,8,40,0.28)';
    ell(ctx, 0, 0, (this.baby ? 26 : 30) * scale, 6 * scale); ctx.fill();
    ctx.scale(scale * facing, scale);
    let by = 0, lean = 0, sx = 1, sy = 1, px = 0;
    let walk = 0;
    if (st === 'run') { const ph = t * 13; by = -Math.abs(Math.sin(ph)) * 7; walk = Math.sin(ph); sy = 1 + Math.abs(Math.sin(ph)) * 0.04; lean = 0.06; }
    else if (st === 'attack') { const a = Math.sin(Math.min(1, k) * Math.PI); px = (this.style === 'arrow' || this.style === 'magic' ? -4 : 16) * a; lean = (k < 0.4 ? -0.12 : 0.16) * a; sy = 1 - a * 0.04; }
    else if (st === 'cast') { const a = Math.sin(Math.min(1, k) * Math.PI); by = -16 * a; sy = 1 + a * 0.05; }
    else if (st === 'hurt') { const a = Math.sin(Math.min(1, k) * Math.PI); px = -10 * a; lean = -0.15 * a; }
    else if (st === 'dead') { lean = -Math.min(1, k) * 1.35; by = 0; }
    else { const b = Math.sin(t * 2.6); sy = 1 + b * 0.018; by = b * 0.6; }
    if (this.baby && st === 'idle') by += -Math.abs(Math.sin(t * 3.2)) * 3;
    ctx.translate(px, by);
    if (lean) ctx.rotate(lean);
    ctx.scale(sx, sy);
    if (this.baby) this.drawKitten(ctx, walk, st, k);
    else this.drawHero(ctx, walk, st, k);
    // flash d'impact
    if (anim.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 4, -this.height * 0.5, this.height * 0.55, anim.flashColor || '#ffffff', anim.flash * 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
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
    if (boot) { ctx.beginPath(); ctx.moveTo(fx - w * 0.6, fy - 9); ctx.lineTo(fx + w * 0.6, fy - 9); ctx.lineWidth = 3.4; ctx.strokeStyle = shade(boot, 0.45); ctx.stroke(); }
  }

  drawHero(ctx, walk, st, k) {
    const L = this.look, G = this.gear, t = this.t;
    const fur = L.fur, furD = shade(fur, -0.18);
    const bootC = G.boots ? (G.boots.base === 'sneakers' ? '#ffffff' : RCOL[G.boots.r]) : null;
    const gloveC = G.gloves ? (G.gloves.base === 'boxing' ? '#e8323f' : G.gloves.base === 'gauntlet' ? METAL[G.gloves.r] : RCOL[G.gloves.r]) : null;
    const pawC = L.pattern === 'siamese' ? L.pcolor : L.pattern === 'tuxedo' ? '#fbf8f4' : fur;
    // ailes
    if (this.wings) {
      const flap = st === 'cast' ? 0.3 : 0.12;
      drawSprite(ctx, this.wings, -8, -56, 1, 1 - Math.abs(Math.sin(t * 6)) * flap, Math.sin(t * 3) * 0.05);
    }
    // cape
    if (G.cape) this.drawCapeBiped(ctx, G.cape.base, G.cape.r, st);
    // queue
    this.drawTail(ctx, -14, -26, 50, 9, 10, st === 'run' ? 9 : 2.8);
    // jambe arrière
    this.drawLeg(ctx, -6, -16, -7 - walk * 7, 0, 11, furD, bootC && shade(bootC, -0.15));
    // bras arrière
    const sw = st === 'run' ? Math.sin(t * 13) * 0.5 : Math.sin(t * 2.6) * 0.08;
    this.drawArm(ctx, -6, -46, -16 + Math.sin(sw) * 8, -30, furD, gloveC && shade(gloveC, -0.15));
    // corps
    drawSprite(ctx, this.body, 0, -34);
    // jambe avant
    this.drawLeg(ctx, 6, -16, 7 + walk * 7, 0, 12, pawC, bootC);
    // tête
    const blink = this.blinkT < 0 && st !== 'dead';
    const tilt = st === 'attack' ? 0.05 : st === 'hurt' ? -0.12 : Math.sin(t * 2.1) * 0.03;
    ctx.save(); ctx.translate(3, -74); ctx.rotate(tilt); ctx.scale(0.9, 0.9);
    ctx.drawImage((blink ? this.headBlink : this.head).c, -70, -100, 140, 140);
    ctx.restore();
    // bras avant + arme
    const [hx, hy, wa] = this.weaponPose(st, k);
    if (this.weapon) drawSprite(ctx, this.weapon, hx, hy, 0.82, 0.82, wa);
    this.drawArm(ctx, 8, -44, hx, hy, pawC, gloveC);
  }
  weaponPose(st, k) {
    const t = this.t;
    const style = this.style;
    let hx = 21, hy = -34, a = 0.45 + Math.sin(t * 2.2) * 0.05;
    if (style === 'arrow') { a = 0; hx = 22; }
    if (style === 'magic') a = 0.25;
    if (st === 'run') { a += Math.sin(t * 13) * 0.08; hy += Math.sin(t * 13) * 1.5; }
    if (st === 'attack') {
      if (style === 'slash' || style === 'smash') {
        if (k < 0.4) { const q = k / 0.4; a = 0.45 - q * 2.6; hx = 21 - q * 10; hy = -34 - q * 14; }
        else if (k < 0.62) { const q = (k - 0.4) / 0.22; a = -2.15 + q * 4.2; hx = 11 + q * 22; hy = -48 + q * 26; }
        else { const q = (k - 0.62) / 0.38; a = 2.05 - q * 1.6; hx = 33 - q * 12; hy = -22 - q * 12; }
      } else if (style === 'pierce') { const q = Math.sin(k * Math.PI); a = 1.35; hx = 18 + q * 22; hy = -34; }
      else if (style === 'arrow') { const q = Math.sin(k * Math.PI); hx = 22 - q * 4; }
      else { const q = Math.sin(k * Math.PI); a = 0.25 + q * 0.9; hx = 21 + q * 6; hy = -34 - q * 8; }
    }
    if (st === 'cast') { const q = Math.sin(Math.min(1, k) * Math.PI); a = -0.2 * q + 0.3 * (1 - q); hy = -34 - q * 26; hx = 20 - q * 4; }
    if (st === 'dead') { a = 1.6; hy = -24; }
    return [hx, hy, a];
  }
  drawArm(ctx, sx, sy, hx, hy, color, glove) {
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy);
    ctx.lineCap = 'round'; ctx.lineWidth = 15; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = color; ctx.stroke();
    ell(ctx, hx, hy, glove ? 7.5 : 6.2, glove ? 7 : 5.8);
    paint(ctx, glove ? ball(ctx, hx, hy, 8, glove) : color, 2.8);
  }
  drawCapeBiped(ctx, base, r, st) {
    const c = RCOL[r], t = this.t;
    const k = st === 'run' ? 1.6 : 1;
    const w1 = Math.sin(t * 4 * k) * 4 * k, w2 = Math.sin(t * 4 * k + 1.4) * 6 * k;
    ctx.beginPath();
    ctx.moveTo(10, -56);
    ctx.bezierCurveTo(-4, -60, -16, -52, -24 + w1, -30);
    ctx.quadraticCurveTo(-34 + w2, -10, -30 + w2, 0);
    ctx.quadraticCurveTo(-18 + w1, -4, -8, 0);
    ctx.quadraticCurveTo(0, -20, 4, -40);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -60, -30, 0);
    g.addColorStop(0, shade(c, 0.2)); g.addColorStop(1, shade(c, -0.4));
    paint(ctx, g, 2.8);
    ctx.fillStyle = rgba('#ffffff', 0.85);
    const ex = -16 + w1 * 0.5, ey = -22;
    if (base === 'star') { star5(ctx, ex, ey, 6, 2.6); ctx.fill(); }
    else if (base === 'moon') { ctx.beginPath(); ctx.arc(ex, ey, 5, 0.6, 5.7); ctx.arc(ex + 2.5, ey - 1, 4.2, 5.3, 1, true); ctx.fill(); }
    else if (base === 'heart') { ctx.beginPath(); ctx.moveTo(ex, ey + 5); ctx.bezierCurveTo(ex - 8, ey - 2, ex - 3, ey - 7, ex, ey - 3); ctx.bezierCurveTo(ex + 3, ey - 7, ex + 8, ey - 2, ex, ey + 5); ctx.fill(); }
    else if (base === 'skull') { ell(ctx, ex, ey, 5, 4.6); ctx.fill(); }
    else { ell(ctx, ex, ey + 2, 3.4, 2.8); ctx.fill(); for (const [dx, dy] of [[-4, -2], [-1.5, -5], [1.5, -5], [4, -2]]) { ell(ctx, ex + dx, ey + dy, 1.5, 1.7); ctx.fill(); } }
  }

  drawKitten(ctx, walk, st, k) {
    const L = this.look, t = this.t;
    const fur = L.fur, furD = shade(fur, -0.2);
    const pawC = L.pattern === 'siamese' ? L.pcolor : L.pattern === 'tuxedo' ? '#fbf8f4' : fur;
    if (this.wings) drawSprite(ctx, this.wings, -6, -34, 0.62, 0.62 - Math.abs(Math.sin(t * 9)) * 0.2, Math.sin(t * 4) * 0.05);
    this.drawTail(ctx, -18, -24, 40, 8, 12, st === 'run' ? 10 : 3.4);
    const sw = st === 'run' || st === 'idle' ? walk : 0;
    // pattes arrière-plan
    this.drawLeg(ctx, -12, -16, -12 + sw * 5, 0, 9, furD);
    this.drawLeg(ctx, 10, -16, 10 - sw * 5, 0, 9, furD);
    drawSprite(ctx, this.body, -2, -22);
    this.drawLeg(ctx, -5, -14, -5 - sw * 5, 0, 10, pawC);
    this.drawLeg(ctx, 16, -14, 16 + sw * 5, 0, 10, pawC);
    const blink = this.blinkT < 0;
    const tilt = Math.sin(t * 2.4) * 0.05 + (st === 'attack' ? 0.12 * Math.sin(k * Math.PI) : 0);
    ctx.save(); ctx.translate(14, -46); ctx.rotate(tilt); ctx.scale(0.75, 0.75);
    ctx.drawImage((blink ? this.headBlink : this.head).c, -70, -100, 140, 140);
    ctx.restore();
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
  const s = makeSprite(-66, -96, 132, 132, (ctx) => drawHeadFull(ctx, look, false, gear), 2);
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
  const h = baby ? 100 : 140;
  const s = makeSprite(-70, -h, 140, h + 10, (ctx) => rig.draw(ctx, 0, 0, 1, 1, { state: 'idle' }), 2);
  const url = spriteURL(s, size, 0.03);
  bodyCache.set(key, url);
  return url;
}
