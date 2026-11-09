// =====================================================================
//  Équipement dessiné : armes, chapeaux, accessoires de visage, ailes,
//  armures, capes, gants, bottes, colliers, anneaux + icônes d'objets.
// =====================================================================
import { OUT, shade, rgba, ell, rr, smooth, poly, paint, vgrad, ball, gloss, glow, makeSprite, spriteURL } from './draw.js';

// Couleurs par rareté (0 Commun → 8 Primordial)
export const RCOL = ['#aeb7c2', '#62d86b', '#4aa9ff', '#b968ff', '#ffb52e', '#ff4d5e', '#ff7ae0', '#48f3ff', '#fff27a'];
export const METAL = ['#b9c1cc', '#d6a062', '#9ccfff', '#cfa6ff', '#ffd54f', '#ff7a88', '#ffb3ee', '#8ff7ff', '#fff6b0'];
const WOOD = '#9a6236';

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

function metal(ctx, r, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  if (r >= 8) {
    ['#ff6b7a', '#ffd54f', '#7dff9e', '#7fe9ff', '#c9a0ff', '#ff7ae0'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    return g;
  }
  const m = METAL[r] || METAL[0];
  g.addColorStop(0, shade(m, 0.55));
  g.addColorStop(0.45, m);
  g.addColorStop(0.5, shade(m, -0.12));
  g.addColorStop(1, shade(m, -0.35));
  return g;
}
function gem(ctx, x, y, rad, r) {
  ell(ctx, x, y, rad, rad);
  paint(ctx, ball(ctx, x, y, rad, RCOL[r] || '#ff4d5e', 0.5, 0.3), 2);
  gloss(ctx, x - rad * 0.3, y - rad * 0.35, rad * 0.35, rad * 0.22, 0.8);
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
function rareGlow(ctx, r, x, y, rad) {
  if (r >= 4) glow(ctx, x, y, rad, RCOL[r], r >= 6 ? 0.65 : 0.45);
}

// ------------------------------------------------------------------ ARMES (poignée en (0,0), pointe vers le haut)
export function drawWeapon(ctx, base, r) {
  const rc = RCOL[r];
  switch (base) {
    case 'sword': {
      rareGlow(ctx, r, 0, -40, 34);
      poly(ctx, [[-5, -14], [-5, -62], [0, -74], [5, -62], [5, -14]]);
      paint(ctx, metal(ctx, r, -5, 0, 5, 0), 2.6);
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -64); ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 1.6; ctx.stroke();
      rr(ctx, -15, -18, 30, 7, 3.5); paint(ctx, metal(ctx, Math.max(r, 4), 0, -18, 0, -11), 2.4);
      rr(ctx, -3.5, -12, 7, 15, 3); paint(ctx, vgrad(ctx, -12, 3, '#6b3a1e'), 2.2);
      gem(ctx, 0, 6, 4.2, r);
      gem(ctx, 0, -14.5, 2.6, r);
      break;
    }
    case 'katana': {
      rareGlow(ctx, r, 2, -44, 34);
      smooth(ctx, [[-3, -14], [-3, -50], [2, -72], [5, -74], [4, -48], [3.5, -14]], true, 0.4);
      paint(ctx, metal(ctx, r, -3, 0, 5, 0), 2.4);
      ell(ctx, 0, -14, 9, 3.5); paint(ctx, shade(rc, -0.2), 2.2);
      rr(ctx, -3.5, -12, 7, 17, 3); paint(ctx, '#2a2340', 2.2);
      ctx.strokeStyle = rc; ctx.lineWidth = 1.6;
      for (let y = -10; y < 4; y += 4) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(3, y + 3); ctx.stroke(); }
      break;
    }
    case 'axe': {
      rareGlow(ctx, r, 10, -54, 30);
      rr(ctx, -3, -62, 6, 66, 3); paint(ctx, vgrad(ctx, -62, 4, WOOD), 2.4);
      smooth(ctx, [[2, -64], [18, -72], [30, -60], [31, -44], [22, -32], [2, -40]], true, 0.35);
      paint(ctx, metal(ctx, r, 2, -70, 30, -36), 2.6);
      smooth(ctx, [[-2, -60], [-12, -64], [-14, -52], [-2, -46]], true, 0.4);
      paint(ctx, metal(ctx, r, -14, -60, -2, -48), 2.2);
      gem(ctx, 0, -52, 3.5, r);
      break;
    }
    case 'hammer': {
      rareGlow(ctx, r, 0, -62, 32);
      rr(ctx, -3, -56, 6, 60, 3); paint(ctx, vgrad(ctx, -56, 4, WOOD), 2.4);
      rr(ctx, -22, -76, 44, 26, 6); paint(ctx, metal(ctx, r, -22, -76, 22, -50), 2.8);
      rr(ctx, -22, -66, 44, 6, 2); paint(ctx, shade(METAL[r] || METAL[0], -0.35), 2);
      gem(ctx, 0, -63, 4.5, r);
      gloss(ctx, -12, -71, 7, 2.5, 0.6, 0);
      break;
    }
    case 'staff': {
      rr(ctx, -3, -66, 6, 70, 3); paint(ctx, vgrad(ctx, -66, 4, WOOD), 2.4);
      ctx.beginPath(); ctx.moveTo(0, -64); ctx.bezierCurveTo(-14, -70, -12, -88, 0, -90); ctx.bezierCurveTo(12, -88, 14, -70, 0, -64);
      ctx.lineWidth = 5.5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = WOOD; ctx.stroke();
      glow(ctx, 0, -78, 24, rc, 0.7);
      ell(ctx, 0, -78, 9, 9); paint(ctx, ball(ctx, 0, -78, 9, rc, 0.6), 2.4);
      gloss(ctx, -3, -82, 3.4, 2, 0.9);
      break;
    }
    case 'wand': {
      rr(ctx, -2.5, -40, 5, 44, 2.5); paint(ctx, vgrad(ctx, -40, 4, '#fff1d6'), 2.2);
      glow(ctx, 0, -48, 22, rc, 0.8);
      star5(ctx, 0, -48, 13, 5.5); paint(ctx, ball(ctx, 0, -48, 13, METAL[r] || '#ffd54f', 0.5), 2.4);
      gloss(ctx, -3, -52, 3, 2, 0.9);
      break;
    }
    case 'bow': {
      rareGlow(ctx, r, 6, 0, 30);
      ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(0, 42); ctx.strokeStyle = '#f4ead8'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -42); ctx.bezierCurveTo(22, -30, 22, 30, 0, 42);
      ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = r >= 4 ? (METAL[r] || WOOD) : WOOD; ctx.stroke();
      rr(ctx, 12, -7, 7, 14, 3); paint(ctx, '#6b3a1e', 2);
      gem(ctx, 16, -12, 2.8, r); gem(ctx, 16, 12, 2.8, r);
      break;
    }
    case 'scythe': {
      rareGlow(ctx, r, -16, -70, 32);
      rr(ctx, -3, -80, 6, 84, 3); paint(ctx, vgrad(ctx, -80, 4, '#3a2a4a'), 2.4);
      smooth(ctx, [[0, -82], [-24, -84], [-46, -70], [-50, -56], [-38, -66], [-16, -72], [2, -70]], true, 0.4);
      paint(ctx, metal(ctx, r, -50, -84, 0, -60), 2.6);
      gem(ctx, 0, -76, 3.6, r);
      break;
    }
    case 'trident': {
      rareGlow(ctx, r, 0, -66, 30);
      rr(ctx, -2.6, -60, 5.2, 64, 2.6); paint(ctx, metal(ctx, Math.max(0, r - 1), -3, 0, 3, 0), 2.2);
      ctx.beginPath(); ctx.moveTo(-13, -76); ctx.lineTo(-13, -62); ctx.quadraticCurveTo(-13, -56, 0, -56); ctx.quadraticCurveTo(13, -56, 13, -62); ctx.lineTo(13, -76);
      ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.6; ctx.strokeStyle = METAL[r] || METAL[2]; ctx.stroke();
      for (const x of [-13, 0, 13]) { poly(ctx, [[x - 4, -74], [x, -86], [x + 4, -74]]); paint(ctx, metal(ctx, r, x - 4, 0, x + 4, 0), 2); }
      ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(0, -76); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = METAL[r] || METAL[2]; ctx.stroke();
      gem(ctx, 0, -55, 3.4, r);
      break;
    }
    case 'fish': {
      rareGlow(ctx, r, 0, -40, 30);
      poly(ctx, [[-2, -60], [0, -84], [2, -60]]); paint(ctx, '#d9e4f0', 2);
      ell(ctx, 0, -38, 11, 24); paint(ctx, vgrad(ctx, -62, -14, r >= 4 ? METAL[r] : '#7fb0e0', 0.3, 0.3), 2.6);
      ell(ctx, 4, -36, 5, 16); ctx.fillStyle = rgba('#ffffff', 0.45); ctx.fill();
      poly(ctx, [[0, -16], [-12, -2], [0, -6], [12, -2]]); paint(ctx, shade(r >= 4 ? METAL[r] : '#7fb0e0', -0.2), 2.4);
      ell(ctx, 3, -52, 2.8, 2.8); paint(ctx, '#1d1530', 1.2);
      poly(ctx, [[-10, -40], [-17, -34], [-10, -30]]); paint(ctx, shade('#7fb0e0', -0.25), 2);
      break;
    }
    case 'ladle': {
      rr(ctx, -2.8, -54, 5.6, 58, 2.8); paint(ctx, metal(ctx, r, -3, 0, 3, 0), 2.2);
      ell(ctx, 0, -64, 14, 11); paint(ctx, metal(ctx, r, -14, -75, 14, -53), 2.6);
      ell(ctx, 0, -66, 9, 6); ctx.fillStyle = rgba('#000000', 0.18); ctx.fill();
      gem(ctx, 0, -2, 3, r);
      break;
    }
    default: { // claws (gantelet à 3 lames)
      rareGlow(ctx, r, 6, -26, 26);
      for (let i = 0; i < 3; i++) {
        const x = -7 + i * 7;
        smooth(ctx, [[x - 2.5, -8], [x + 2 + i, -30 - i * 4], [x + 9 + i * 2, -44 - i * 3], [x + 3, -28], [x + 2.5, -8]], true, 0.4);
        paint(ctx, metal(ctx, r, x - 3, 0, x + 8, 0), 2.2);
      }
      rr(ctx, -12, -10, 24, 14, 5); paint(ctx, vgrad(ctx, -10, 4, shade(RCOL[r], -0.2)), 2.4);
      gem(ctx, 0, -3, 3, r);
    }
  }
}

// ------------------------------------------------------------------ CHAPEAUX (origine = sommet de la tête, largeur ≈ 70)
export function drawHat(ctx, base, r) {
  const c = RCOL[r], d = shade(c, -0.3);
  switch (base) {
    case 'wizard': {
      smooth(ctx, [[-30, 2], [-14, -30], [-24, -64], [-6, -40], [26, 2]], true, 0.35); paint(ctx, vgrad(ctx, -64, 2, shade(c, -0.15)), 2.8);
      ell(ctx, -2, 2, 42, 8); paint(ctx, vgrad(ctx, -6, 10, d), 2.6);
      ctx.fillStyle = '#ffe14d';
      star5(ctx, -6, -18, 6, 2.5); paint(ctx, '#ffe14d', 1.6); star5(ctx, 8, -6, 4, 1.7); paint(ctx, '#ffffff', 1.4);
      break;
    }
    case 'crown': {
      ctx.beginPath(); ctx.moveTo(-26, 6); ctx.lineTo(-30, -22); ctx.lineTo(-16, -10); ctx.lineTo(-6, -30); ctx.lineTo(4, -10); ctx.lineTo(16, -28); ctx.lineTo(22, -8); ctx.lineTo(32, -20); ctx.lineTo(28, 6); ctx.closePath();
      paint(ctx, metal(ctx, Math.max(4, r), -30, -30, 30, 6), 2.8);
      rr(ctx, -27, -2, 56, 9, 4); paint(ctx, metal(ctx, 4, 0, -2, 0, 7), 2.4);
      gem(ctx, 1, 2.5, 3.6, r); gem(ctx, -16, 2.5, 2.6, Math.max(2, r - 1)); gem(ctx, 18, 2.5, 2.6, Math.max(2, r - 1));
      for (const [x, y] of [[-30, -22], [-6, -30], [16, -28], [32, -20]]) { ell(ctx, x, y, 3, 3); paint(ctx, '#ffffff', 1.5); }
      break;
    }
    case 'helmet': {
      ctx.beginPath(); ctx.moveTo(-34, 10); ctx.bezierCurveTo(-36, -38, 36, -38, 36, 10); ctx.closePath();
      paint(ctx, metal(ctx, r, -34, -30, 36, 10), 2.8);
      rr(ctx, -36, 2, 72, 9, 4); paint(ctx, metal(ctx, Math.max(r, 1), 0, 2, 0, 11), 2.4);
      ctx.beginPath(); ctx.moveTo(0, -27); ctx.bezierCurveTo(-30, -52, -52, -30, -46, -6); ctx.bezierCurveTo(-38, -26, -20, -36, 0, -27);
      paint(ctx, vgrad(ctx, -50, -6, c), 2.4);
      gloss(ctx, -14, -16, 9, 4, 0.5, -0.4);
      break;
    }
    case 'cowboy': {
      ell(ctx, 0, 4, 46, 10); paint(ctx, vgrad(ctx, -6, 14, '#a8743f'), 2.6);
      ctx.beginPath(); ctx.moveTo(-22, 2); ctx.bezierCurveTo(-24, -30, -6, -26, 0, -20); ctx.bezierCurveTo(6, -26, 26, -30, 22, 2); ctx.closePath();
      paint(ctx, vgrad(ctx, -28, 2, '#b8814a'), 2.6);
      rr(ctx, -22, -6, 44, 7, 3); paint(ctx, c, 2.2);
      break;
    }
    case 'beret': {
      ell(ctx, -6, -6, 38, 13, -0.15); paint(ctx, vgrad(ctx, -20, 8, c), 2.6);
      ell(ctx, 4, -18, 3, 4); paint(ctx, d, 2);
      break;
    }
    case 'bandana': {
      ctx.beginPath(); ctx.moveTo(-34, 10); ctx.quadraticCurveTo(0, -8, 38, 8); ctx.lineTo(37, 18); ctx.quadraticCurveTo(0, 2, -34, 20); ctx.closePath();
      paint(ctx, vgrad(ctx, -2, 20, c), 2.4);
      smooth(ctx, [[-32, 14], [-54, 6], [-62, 20], [-46, 22]], true, 0.4); paint(ctx, c, 2.4);
      smooth(ctx, [[-32, 16], [-50, 28], [-52, 40], [-40, 30]], true, 0.4); paint(ctx, d, 2.4);
      for (const x of [-12, 6, 22]) { ell(ctx, x, 9, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
      break;
    }
    case 'tophat': {
      ell(ctx, 0, 4, 36, 8); paint(ctx, '#2a2340', 2.6);
      rr(ctx, -21, -46, 42, 50, 6); paint(ctx, vgrad(ctx, -46, 4, '#3a3050'), 2.6);
      rr(ctx, -21, -10, 42, 9, 2); paint(ctx, c, 2.2);
      gloss(ctx, -12, -34, 3, 10, 0.35, 0);
      break;
    }
    case 'flowers': {
      const cols = [c, '#ffffff', shade(c, 0.4), '#ffe14d', c];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const x = Math.cos(a) * 34, y = Math.sin(a) * 12 + 4;
        for (let p = 0; p < 5; p++) { const pa = (p / 5) * Math.PI * 2; ell(ctx, x + Math.cos(pa) * 4.5, y + Math.sin(pa) * 4.5, 4, 4); paint(ctx, cols[i % 5], 1.4); }
        ell(ctx, x, y, 3, 3); paint(ctx, '#ffb52e', 1.2);
      }
      break;
    }
    case 'viking': {
      for (const s of [-1, 1]) {
        smooth(ctx, [[s * 24, -6], [s * 44, -16], [s * 50, -40], [s * 42, -22], [s * 22, -16]], true, 0.4); paint(ctx, vgrad(ctx, -40, -6, '#fff1d6'), 2.4);
      }
      ctx.beginPath(); ctx.moveTo(-32, 8); ctx.bezierCurveTo(-32, -34, 32, -34, 32, 8); ctx.closePath(); paint(ctx, metal(ctx, r, -30, -30, 30, 8), 2.8);
      rr(ctx, -33, 0, 66, 9, 4); paint(ctx, metal(ctx, 1, 0, 0, 0, 9), 2.4);
      for (const x of [-22, -8, 8, 22]) { ell(ctx, x, 4.5, 2, 2); paint(ctx, '#ffffff', 1); }
      break;
    }
    case 'chef': {
      rr(ctx, -20, -18, 40, 22, 4); paint(ctx, '#ffffff', 2.6);
      for (const [x, y, rad] of [[-16, -26, 13], [0, -34, 15], [16, -26, 13]]) { ell(ctx, x, y, rad, rad); paint(ctx, ball(ctx, x, y, rad, '#ffffff', 0.1, 0.12), 2.6); }
      rr(ctx, -20, -4, 40, 8, 2); paint(ctx, c, 2);
      break;
    }
    case 'party': {
      poly(ctx, [[-20, 4], [0, -50], [20, 4]]); paint(ctx, vgrad(ctx, -50, 4, c), 2.6);
      ctx.save(); poly(ctx, [[-20, 4], [0, -50], [20, 4]]); ctx.clip();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      for (let y = -40; y < 6; y += 12) { ctx.beginPath(); ctx.moveTo(-24, y + 10); ctx.lineTo(24, y - 4); ctx.stroke(); }
      ctx.restore();
      poly(ctx, [[-20, 4], [0, -50], [20, 4]]); paint(ctx, null, 2.6);
      ell(ctx, 0, -52, 6, 6); paint(ctx, '#ffe14d', 2);
      break;
    }
    case 'cap': {
      ctx.beginPath(); ctx.moveTo(-32, 6); ctx.bezierCurveTo(-34, -30, 30, -32, 32, 4); ctx.closePath(); paint(ctx, vgrad(ctx, -26, 6, c), 2.8);
      ctx.beginPath(); ctx.moveTo(18, 2); ctx.quadraticCurveTo(50, -2, 58, 8); ctx.quadraticCurveTo(40, 12, 16, 8); ctx.closePath(); paint(ctx, d, 2.6);
      ell(ctx, -2, -24, 4, 3); paint(ctx, d, 1.6);
      ctx.beginPath(); ctx.arc(-2, -6, 8, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = d; ctx.textAlign = 'center'; ctx.fillText('M', -2, -2);
      break;
    }
    default: { // beanie
      ctx.beginPath(); ctx.moveTo(-33, 8); ctx.bezierCurveTo(-34, -34, 34, -34, 33, 8); ctx.closePath(); paint(ctx, vgrad(ctx, -28, 8, c), 2.8);
      ctx.save(); ctx.clip(); ctx.strokeStyle = rgba('#000000', 0.12); ctx.lineWidth = 3;
      for (let x = -30; x < 34; x += 8) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x, 8); ctx.stroke(); }
      ctx.restore();
      rr(ctx, -35, 0, 70, 11, 5.5); paint(ctx, vgrad(ctx, 0, 11, '#ffffff', 0, 0.1), 2.6);
      ell(ctx, 0, -28, 9, 9); paint(ctx, ball(ctx, 0, -28, 9, '#ffffff', 0, 0.15), 2.4);
    }
  }
}

// ------------------------------------------------------------------ VISAGE (repère de la tête : œil avant (22,-4), œil arrière (-6,-4))
export function drawFace(ctx, base, r) {
  const c = RCOL[r];
  switch (base) {
    case 'round': {
      ctx.lineWidth = 2.6; ctx.strokeStyle = OUT;
      for (const [x, rad] of [[22, 12], [-6, 10]]) { ell(ctx, x, -4, rad, rad); ctx.fillStyle = rgba('#bfe8ff', 0.25); ctx.fill(); ctx.lineWidth = 4.5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = c; ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(4, -6); ctx.quadraticCurveTo(7, -10, 10, -6); ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
      gloss(ctx, 18, -9, 3, 2, 0.7); gloss(ctx, -9, -8, 2.5, 1.6, 0.7);
      break;
    }
    case 'sun': {
      for (const [x, w] of [[22, 26], [-6, 21]]) { rr(ctx, x - w / 2, -12, w, 15, 6); paint(ctx, vgrad(ctx, -12, 3, '#1d1530', 0.15, 0), 2.4); gloss(ctx, x - w / 4, -8, w / 6, 2, 0.6, -0.3); }
      ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(40, -10); ctx.lineWidth = 2.4; ctx.strokeStyle = c; ctx.stroke();
      break;
    }
    case 'monocle': {
      ell(ctx, 22, -4, 12.5, 12.5); ctx.fillStyle = rgba('#bfe8ff', 0.25); ctx.fill(); ctx.lineWidth = 4.5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = METAL[Math.max(4, r)]; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, 6); ctx.quadraticCurveTo(34, 24, 20, 30); ctx.strokeStyle = METAL[4]; ctx.lineWidth = 1.6; ctx.stroke();
      gloss(ctx, 18, -9, 3.5, 2, 0.7);
      break;
    }
    case 'patch': {
      ctx.beginPath(); ctx.moveTo(-36, -14); ctx.lineTo(42, -2); ctx.lineWidth = 2.6; ctx.strokeStyle = '#1d1530'; ctx.stroke();
      ell(ctx, 22, -3, 11, 12.5); paint(ctx, vgrad(ctx, -15, 9, '#2a2340'), 2.4);
      if (r >= 4) { star5(ctx, 22, -3, 5, 2.2); paint(ctx, c, 1.2); }
      break;
    }
    case 'ninja': {
      ctx.beginPath(); ctx.moveTo(-38, 4); ctx.quadraticCurveTo(10, 0, 48, 2); ctx.lineTo(44, 18); ctx.quadraticCurveTo(14, 34, -28, 22); ctx.closePath();
      paint(ctx, vgrad(ctx, 0, 30, '#2e3046'), 2.4);
      ctx.beginPath(); ctx.moveTo(-38, 4); ctx.quadraticCurveTo(10, 0, 48, 2); ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.stroke();
      break;
    }
    case 'star': {
      for (const [x, R] of [[22, 13], [-6, 11]]) { star5(ctx, x, -4, R, R * 0.55); paint(ctx, rgba(c, 0.55), 2.4); }
      ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(10, -6); ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
      break;
    }
    case 'visor': {
      glow(ctx, 12, -4, 34, c, 0.55);
      rr(ctx, -18, -11, 66, 13, 6); paint(ctx, vgrad(ctx, -11, 2, c, 0.5, 0.1), 2.4);
      ctx.fillStyle = rgba('#ffffff', 0.7); rr(ctx, -12, -8, 50, 3, 1.5); ctx.fill();
      break;
    }
    case 'stache': {
      for (const s of [-1, 1]) {
        smooth(ctx, [[36, 9], [36 + s * 10, 8], [36 + s * 20, 4], [36 + s * 24, 9], [36 + s * 18, 14], [36 + s * 6, 13]], true, 0.5);
        paint(ctx, r >= 4 ? METAL[r] : '#3a2a20', 2.2);
      }
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------------ AILES / DOS (ancre = haut du dos, s'étendent vers l'arrière/haut)
export function drawWings(ctx, base, r) {
  const c = RCOL[r];
  switch (base) {
    case 'bat': {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -44); ctx.lineTo(-56, -50); ctx.quadraticCurveTo(-52, -30, -62, -22); ctx.quadraticCurveTo(-48, -20, -46, -6); ctx.quadraticCurveTo(-32, -12, -24, 2); ctx.quadraticCurveTo(-12, -4, 0, 0);
      paint(ctx, vgrad(ctx, -50, 2, r >= 4 ? shade(c, -0.45) : '#4a2a5e', 0.2, 0.2), 2.6);
      ctx.strokeStyle = rgba('#000000', 0.35); ctx.lineWidth = 2;
      for (const [x, y] of [[-56, -50], [-62, -22], [-46, -6], [-24, 2]]) { ctx.beginPath(); ctx.moveTo(-20, -44); ctx.lineTo(x, y); ctx.stroke(); }
      break;
    }
    case 'butterfly': {
      // aile haute (en goutte vers l'arrière/haut) + aile basse, bordure sombre et nervures
      const up = [[0, -4], [-8, -40], [-30, -62], [-52, -56], [-54, -36], [-36, -18]];
      smooth(ctx, up, true, 0.5); paint(ctx, vgrad(ctx, -62, -4, c, 0.35, 0.15), 2.6);
      ctx.save(); smooth(ctx, up, true, 0.5); ctx.clip();
      ctx.lineWidth = 6; ctx.strokeStyle = shade(c, -0.45); smooth(ctx, up, true, 0.5); ctx.stroke(); ctx.restore();
      const lo = [[0, -2], [-26, -14], [-40, 0], [-30, 14], [-12, 10]];
      smooth(ctx, lo, true, 0.5); paint(ctx, vgrad(ctx, -16, 14, shade(c, 0.15), 0.3, 0.2), 2.4);
      ctx.strokeStyle = rgba(shade(c, -0.5), 0.6); ctx.lineWidth = 1.4;
      for (const [x, y] of [[-30, -56], [-50, -44], [-40, -22]]) { ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo((x - 2) / 2, (y - 6) / 2 - 4, x, y); ctx.stroke(); }
      for (const [x, y, rad] of [[-36, -48, 6], [-22, -30, 4], [-24, 0, 4]]) { ell(ctx, x, y, rad, rad); paint(ctx, '#ffffff', 1.5); }
      break;
    }
    case 'dragon': {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -48); ctx.lineTo(-30, -60); ctx.lineTo(-64, -46); ctx.lineTo(-52, -36); ctx.lineTo(-60, -22); ctx.lineTo(-44, -16); ctx.lineTo(-44, -2); ctx.lineTo(-22, -4); ctx.closePath();
      paint(ctx, vgrad(ctx, -60, 0, r >= 4 ? c : '#d6454f', 0.2, 0.25), 2.6);
      ctx.strokeStyle = shade(r >= 4 ? c : '#d6454f', -0.45); ctx.lineWidth = 2.2;
      for (const [x, y] of [[-64, -46], [-60, -22], [-44, -2]]) { ctx.beginPath(); ctx.moveTo(-14, -48); ctx.lineTo(x, y); ctx.stroke(); }
      poly(ctx, [[-30, -60], [-28, -70], [-24, -60]]); paint(ctx, '#fff1d6', 1.8);
      break;
    }
    case 'fairy': {
      glow(ctx, -24, -30, 40, c, 0.35);
      ell(ctx, -26, -38, 30, 12, -0.7); paint(ctx, rgba(shade(c, 0.5), 0.55), 2, rgba(shade(c, -0.2), 0.9));
      ell(ctx, -24, -14, 22, 9, -0.25); paint(ctx, rgba(shade(c, 0.5), 0.55), 2, rgba(shade(c, -0.2), 0.9));
      gloss(ctx, -30, -42, 8, 2.5, 0.7, -0.7);
      break;
    }
    case 'jetpack': {
      for (const x of [-22, -8]) { rr(ctx, x - 7, -36, 14, 40, 7); paint(ctx, metal(ctx, r, x - 7, 0, x + 7, 0), 2.6); rr(ctx, x - 5, 2, 10, 7, 2); paint(ctx, '#3a3050', 2); }
      rr(ctx, -26, -20, 26, 6, 3); paint(ctx, c, 2);
      gloss(ctx, -26, -26, 2, 8, 0.6, 0);
      break;
    }
    case 'fishpack': {
      ell(ctx, -22, -18, 24, 16, -0.2); paint(ctx, vgrad(ctx, -34, -2, '#7fb0e0', 0.3, 0.3), 2.6);
      poly(ctx, [[-44, -18], [-60, -32], [-56, -16], [-60, -4]]); paint(ctx, '#5f8fc4', 2.4);
      ell(ctx, -6, -22, 3, 3); paint(ctx, '#1d1530', 1.2);
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-12, -30); ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
      break;
    }
    default: { // ange
      for (let i = 4; i >= 0; i--) {
        const a = -2.1 + i * 0.28;
        const len = 52 - i * 6;
        ell(ctx, Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, len * 0.55, 9, a);
        paint(ctx, vgrad(ctx, -60, 0, r >= 4 ? shade(c, 0.55) : '#ffffff', 0.1, 0.18), 2.4);
      }
      if (r >= 4) glow(ctx, -20, -26, 36, c, 0.35);
    }
  }
}

// ------------------------------------------------------------------ ARMURE portée (repère du corps : centre (0,0), rx 30, ry 24)
export function drawArmorOnBody(ctx, base, r) {
  const c = RCOL[r], d = shade(c, -0.35);
  const trim = r >= 4 ? '#ffd54f' : shade(c, -0.5);
  switch (base) {
    case 'plate': {
      ctx.beginPath(); ctx.moveTo(-26, -10); ctx.bezierCurveTo(-18, -26, 20, -28, 30, -8); ctx.lineTo(28, 14); ctx.bezierCurveTo(10, 22, -14, 22, -26, 12); ctx.closePath();
      paint(ctx, metal(ctx, r, -26, -26, 30, 20), 2.6);
      ell(ctx, 16, -16, 12, 9, -0.3); paint(ctx, metal(ctx, r, 4, -26, 28, -6), 2.4);
      for (const [x, y] of [[-16, 6], [0, 10], [16, 8]]) { ell(ctx, x, y, 1.8, 1.8); ctx.fillStyle = OUT; ctx.fill(); }
      gloss(ctx, 0, -12, 12, 3, 0.5, -0.15);
      break;
    }
    case 'robe': {
      ctx.beginPath(); ctx.moveTo(-28, -8); ctx.bezierCurveTo(-18, -28, 22, -28, 31, -6); ctx.lineTo(34, 30); ctx.lineTo(-30, 30); ctx.closePath();
      paint(ctx, vgrad(ctx, -26, 30, c), 2.6);
      ctx.beginPath(); ctx.moveTo(-30, 28); ctx.lineTo(34, 28); ctx.lineWidth = 5; ctx.strokeStyle = trim; ctx.stroke();
      star5(ctx, 4, 6, 6, 2.6); paint(ctx, trim, 1.4);
      star5(ctx, -14, 16, 4, 1.8); paint(ctx, '#ffffff', 1.2);
      break;
    }
    case 'hoodie': {
      ctx.beginPath(); ctx.moveTo(-28, -6); ctx.bezierCurveTo(-18, -26, 22, -28, 30, -6); ctx.lineTo(28, 16); ctx.bezierCurveTo(10, 24, -14, 24, -28, 14); ctx.closePath();
      paint(ctx, vgrad(ctx, -26, 22, c, 0.2, 0.2), 2.6);
      rr(ctx, 2, 4, 22, 10, 4); paint(ctx, d, 2);
      ell(ctx, -16, -22, 14, 8, -0.4); paint(ctx, d, 2.4);
      ctx.beginPath(); ctx.moveTo(14, -18); ctx.lineTo(16, 0); ctx.moveTo(20, -18); ctx.lineTo(22, -2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
      break;
    }
    case 'kimono': {
      ctx.beginPath(); ctx.moveTo(-28, -6); ctx.bezierCurveTo(-18, -26, 22, -28, 30, -6); ctx.lineTo(28, 16); ctx.bezierCurveTo(10, 24, -14, 24, -28, 14); ctx.closePath();
      paint(ctx, vgrad(ctx, -26, 22, c), 2.6);
      ctx.beginPath(); ctx.moveTo(10, -24); ctx.lineTo(22, 8); ctx.moveTo(26, -18); ctx.lineTo(14, 6); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      rr(ctx, -27, 4, 57, 9, 3); paint(ctx, trim, 2.2);
      break;
    }
    case 'royal': {
      ctx.beginPath(); ctx.moveTo(-28, -8); ctx.bezierCurveTo(-18, -28, 22, -28, 31, -6); ctx.lineTo(29, 16); ctx.bezierCurveTo(10, 24, -14, 24, -28, 14); ctx.closePath();
      paint(ctx, metal(ctx, Math.max(4, r), -28, -28, 30, 20), 2.6);
      ell(ctx, 16, -16, 13, 9, -0.3); paint(ctx, vgrad(ctx, -25, -7, c), 2.4);
      ctx.beginPath(); ctx.moveTo(-28, -8); ctx.bezierCurveTo(-18, -28, 22, -28, 31, -6); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      gem(ctx, 6, 2, 5, r);
      break;
    }
    default: { // tunique
      ctx.beginPath(); ctx.moveTo(-28, -6); ctx.bezierCurveTo(-18, -26, 22, -28, 30, -6); ctx.lineTo(28, 18); ctx.bezierCurveTo(10, 24, -14, 24, -28, 16); ctx.closePath();
      paint(ctx, vgrad(ctx, -26, 24, c), 2.6);
      rr(ctx, -28, 4, 58, 7, 3); paint(ctx, '#5a3a1e', 2);
      rr(ctx, 6, 2.5, 9, 10, 2); paint(ctx, '#ffd54f', 1.8);
    }
  }
}

// ------------------------------------------------------------------ CAPE (dessinée dynamiquement, vent = phase)
export function drawCape(ctx, base, r, phase, k = 1) {
  const c = RCOL[r];
  const w1 = Math.sin(phase) * 5 * k, w2 = Math.sin(phase + 1.3) * 7 * k;
  ctx.beginPath();
  ctx.moveTo(10, -22);
  ctx.bezierCurveTo(-10, -30, -30, -24, -42 + w1, -8);
  ctx.quadraticCurveTo(-52 + w2, 6, -46 + w2, 22);
  ctx.quadraticCurveTo(-36 + w1, 16, -26, 24);
  ctx.quadraticCurveTo(-12, 18, -2, 14);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -24, -40, 24);
  g.addColorStop(0, shade(c, 0.15));
  g.addColorStop(1, shade(c, -0.4));
  paint(ctx, g, 2.6);
  // emblème
  const ex = -28 + w1 * 0.6, ey = 4;
  ctx.fillStyle = rgba('#ffffff', 0.8);
  if (base === 'star') { star5(ctx, ex, ey, 7, 3); ctx.fill(); }
  else if (base === 'moon') { ctx.beginPath(); ctx.arc(ex, ey, 6, 0.6, 5.7); ctx.arc(ex + 3, ey - 1, 5, 5.3, 1, true); ctx.fill(); }
  else if (base === 'skull') { ell(ctx, ex, ey - 1, 6, 5.5); ctx.fill(); ctx.fillStyle = shade(c, -0.4); ell(ctx, ex - 2, ey - 1, 1.6, 1.8); ctx.fill(); ell(ctx, ex + 2, ey - 1, 1.6, 1.8); ctx.fill(); }
  else if (base === 'heart') { ctx.beginPath(); ctx.moveTo(ex, ey + 6); ctx.bezierCurveTo(ex - 10, ey - 2, ex - 4, ey - 8, ex, ey - 3); ctx.bezierCurveTo(ex + 4, ey - 8, ex + 10, ey - 2, ex, ey + 6); ctx.fill(); }
  else { ell(ctx, ex, ey + 2, 4, 3.4); ctx.fill(); for (const [dx, dy] of [[-5, -3], [-2, -6], [2, -6], [5, -3]]) { ell(ctx, ex + dx, ey + dy, 1.8, 2); ctx.fill(); } }
}

// ------------------------------------------------------------------ ICÔNES d'objets
function drawGlove(ctx, base, r) {
  const c = base === 'gauntlet' ? null : RCOL[r];
  const fill = c ? vgrad(ctx, -24, 20, base === 'boxing' ? '#e8323f' : c) : metal(ctx, r, -16, -20, 16, 20);
  ctx.beginPath(); ctx.moveTo(-12, 20); ctx.lineTo(-14, -2); ctx.bezierCurveTo(-20, -24, 18, -30, 16, -4); ctx.lineTo(14, 20); ctx.closePath();
  paint(ctx, fill, 2.8);
  ell(ctx, 16, -2, 7, 9, 0.5); paint(ctx, fill, 2.6);
  rr(ctx, -15, 12, 31, 10, 4); paint(ctx, base === 'boxing' ? '#ffffff' : shade(RCOL[r], -0.3), 2.4);
  if (r >= 4) gem(ctx, 0, 17, 3, r);
}
function drawBoot(ctx, base, r) {
  const c = RCOL[r];
  if (base === 'slippers') {
    ell(ctx, 0, 6, 26, 12); paint(ctx, vgrad(ctx, -6, 18, c), 2.8);
    ell(ctx, 18, -2, 8, 8); paint(ctx, '#ffffff', 2);
    for (const s of [-1, 1]) { poly(ctx, [[14 + s * 5, -6], [18 + s * 7, -16], [22 + s * 3, -6]]); paint(ctx, c, 2); }
    return;
  }
  ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(8, -26); ctx.lineTo(8, 2); ctx.bezierCurveTo(26, 2, 30, 18, 24, 20); ctx.lineTo(-16, 20); ctx.closePath();
  paint(ctx, vgrad(ctx, -26, 20, base === 'sneakers' ? '#ffffff' : c), 2.8);
  if (base === 'sneakers') { rr(ctx, -16, 14, 42, 7, 3); paint(ctx, c, 2.2); ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(4, -4); ctx.moveTo(-6, -2); ctx.lineTo(4, 2); ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.stroke(); }
  else { rr(ctx, -16, -30, 26, 9, 4); paint(ctx, shade(c, 0.4), 2.4); }
}
function drawCollar(ctx, base, r) {
  const c = RCOL[r];
  ctx.beginPath(); ctx.ellipse(0, -4, 24, 14, 0, 0, Math.PI * 2); ctx.lineWidth = 11; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = base === 'pearls' ? '#ffffff' : c; ctx.stroke();
  if (base === 'pearls') for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ell(ctx, Math.cos(a) * 24, -4 + Math.sin(a) * 14, 3.4, 3.4); paint(ctx, ball(ctx, Math.cos(a) * 24, -4 + Math.sin(a) * 14, 3.4, '#ffffff', 0, 0.2), 1.4); }
  if (base === 'spikes') for (let i = 0; i < 7; i++) { const a = 0.2 + (i / 6) * (Math.PI - 0.4); poly(ctx, [[Math.cos(a) * 22 - 3, -4 + Math.sin(a) * 12], [Math.cos(a) * 30, -4 + Math.sin(a) * 20], [Math.cos(a) * 22 + 3, -4 + Math.sin(a) * 12]]); paint(ctx, '#d9dde6', 1.6); }
  ell(ctx, 0, 14, 8, 8); paint(ctx, ball(ctx, 0, 14, 8, base === 'pearls' ? RCOL[r] : '#ffd54f'), 2.4);
  ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(5, 15); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
}
function drawRing(ctx, base, r) {
  ctx.beginPath(); ctx.ellipse(0, 6, 18, 16, 0, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = METAL[Math.max(4, r)] || '#ffd54f'; ctx.stroke();
  if (base === 'gem') { poly(ctx, [[-10, -12], [0, -24], [10, -12], [0, -4]]); paint(ctx, ball(ctx, 0, -14, 10, RCOL[r], 0.5), 2.4); gloss(ctx, -3, -16, 3, 2, 0.8); }
  else gem(ctx, 0, -10, 6, r);
}
function drawArmorIcon(ctx, base, r) {
  ctx.save();
  ctx.scale(1.15, 1.15);
  ctx.translate(-2, 4);
  // silhouette de buste
  ctx.beginPath(); ctx.moveTo(-34, -8); ctx.lineTo(-22, -26); ctx.lineTo(24, -26); ctx.lineTo(36, -8); ctx.lineTo(28, 0); ctx.lineTo(28, 22); ctx.lineTo(-26, 22); ctx.lineTo(-26, 0); ctx.closePath();
  ctx.fillStyle = rgba('#000000', 0); ctx.fill();
  drawArmorOnBody(ctx, base, r);
  ctx.restore();
}
function drawCapeIcon(ctx, base, r) {
  ctx.save(); ctx.translate(18, -2); ctx.scale(1.1, 1.1);
  drawCape(ctx, base, r, 0.6, 0.6);
  ctx.restore();
}

const iconCache = new Map();
// Sprite d'icône d'objet (pour l'interface)
export function itemSprite(slot, base, r) {
  const key = slot + '|' + base + '|' + r;
  if (iconCache.has(key)) return iconCache.get(key);
  let s;
  switch (slot) {
    case 'weapon': s = makeSprite(-56, -96, 112, 112, (ctx) => { ctx.translate(0, 0); ctx.rotate(0.6); ctx.translate(0, 34); drawWeapon(ctx, base, r); }); break;
    case 'hat': s = makeSprite(-64, -70, 128, 96, (ctx) => drawHat(ctx, base, r)); break;
    case 'face': s = makeSprite(-46, -34, 104, 72, (ctx) => { ctx.translate(-8, 0); drawFace(ctx, base, r); }); break;
    case 'wings': s = makeSprite(-74, -76, 84, 88, (ctx) => drawWings(ctx, base, r)); break;
    case 'armor': s = makeSprite(-44, -40, 92, 80, (ctx) => drawArmorIcon(ctx, base, r)); break;
    case 'cape': s = makeSprite(-46, -36, 80, 72, (ctx) => drawCapeIcon(ctx, base, r)); break;
    case 'gloves': s = makeSprite(-30, -36, 62, 64, (ctx) => drawGlove(ctx, base, r)); break;
    case 'boots': s = makeSprite(-32, -36, 66, 62, (ctx) => drawBoot(ctx, base, r)); break;
    case 'collar': s = makeSprite(-38, -32, 76, 60, (ctx) => drawCollar(ctx, base, r)); break;
    default: s = makeSprite(-30, -32, 60, 62, (ctx) => drawRing(ctx, base, r)); break;
  }
  iconCache.set(key, s);
  return s;
}
const urlCache = new Map();
export function itemIconURL(slot, base, r) {
  const key = slot + '|' + base + '|' + r;
  if (!urlCache.has(key)) urlCache.set(key, spriteURL(itemSprite(slot, base, r), 96, 0.06));
  return urlCache.get(key);
}
export { star5, gem, metal };
