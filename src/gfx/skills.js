// =====================================================================
//  Effets d'attaques : armes (5 styles), pouvoirs (12), chatons (8 éléments),
//  ennemis. B = instance du combat (voir battle.js) qui fournit :
//  fx, foes(u), hit(att, tgt, mult, o), heal(u,pct), shield(u,pct), buff(u,v,d), later(t,fn),
//  shake(a), flash(c,a), zoom(z,x,y), stop(t), say(u,txt,style), center(u), head(u), hand(u), cutin(u,sk)
//
//  Grammaire visuelle commune : anticipation (charge à la main), forme nette
//  (corps coloré opaque + halo/cœur additifs, lisibles sur fond clair comme sombre),
//  impact (éclat, onde, étincelles, décalque au sol), traînées (braises, fumée).
// =====================================================================
import { ell, OUT } from './draw.js';
import { sprite, ca } from './fx.js';
import { RCOL } from './gear.js';
import { ELEMENTS } from '../content.js';
import { sfx } from '../audio.js';

const TAU = Math.PI * 2;
const W = '#ffffff';

// palettes par élément : [principale, vive, cœur, profonde]
const PAL = {
  fire: ['#ff7a1a', '#ffd23f', '#fff3c4', '#b8320a'],
  ice: ['#7fe9ff', '#d6fbff', '#ffffff', '#2f7fd0'],
  thunder: ['#ffe14d', '#fff7b0', '#ffffff', '#c98a00'],
  nature: ['#5fd068', '#c9ff7a', '#f0ffd0', '#1f7a35'],
  water: ['#3fa9ff', '#9fe0ff', '#ffffff', '#1050b0'],
  shadow: ['#b968ff', '#e0b0ff', '#ffffff', '#3a0a6a'],
  light: ['#ffcf40', '#fff2a0', '#ffffff', '#c89010'],
  cosmic: ['#ff7ae0', '#c77dff', '#ffffff', '#5a1a9a'],
};
const palOf = (el) => PAL[el] || PAL.light;
const groundOf = (list, dflt = 292) => { if (!list.length) return dflt; let s = 0; for (const e of list) s += e.y; return s / list.length; };

// signature d'impact par élément (s = échelle : 1 normal, 2 ultime)
function elemHit(B, el, x, y, s = 1) {
  const fx = B.fx, P = palOf(el);
  fx.flare(x, y, { size: 12 * s, color: P[0], dur: 0.2, len: 1.6 });
  const n = Math.max(2, Math.round(5 * s));
  switch (el) {
    case 'fire':
      fx.burst(x, y, { count: n + 2, color: [P[1], P[0]], speed: 130 * s, size: 3.5, life: 0.45, shape: 'ember', up: 50, drag: 2.5 });
      fx.burst(x, y - 4, { count: Math.ceil(s), color: '#4a2418', speed: 25, size: 6 * s, endSize: 13 * s, life: 0.6, shape: 'smoke', up: 30, alpha: 0.45 });
      break;
    case 'ice':
      fx.burst(x, y, { count: n, color: [P[0], P[1]], speed: 150 * s, size: 4.5, life: 0.45, shape: 'shard', gravity: 300 });
      fx.burst(x, y, { count: 2, color: W, speed: 40, size: 6, life: 0.4, shape: 'flare' });
      break;
    case 'thunder':
      for (let i = 0; i < Math.ceil(s); i++) { const a = Math.random() * TAU; fx.lightning(x, y, x + Math.cos(a) * 26 * s, y + Math.sin(a) * 18 * s, { color: P[0], dur: 0.14, width: 0.4, seg: 4, amp: 10, branches: 0 }); }
      fx.burst(x, y, { count: n + 2, color: [P[0], W], speed: 240 * s, size: 4, life: 0.25, shape: 'spark' });
      break;
    case 'nature':
      fx.burst(x, y, { count: n, color: [P[0], '#3a9a4a', P[1]], speed: 110 * s, size: 4.5, life: 0.7, shape: 'leaf', gravity: 120, up: 40, drag: 2.5 });
      fx.burst(x, y, { count: 3, color: P[1], speed: 50, size: 4, life: 0.5, up: 30 });
      break;
    case 'water':
      fx.burst(x, y, { count: n, color: [P[1], P[0]], speed: 150 * s, size: 2.6, life: 0.45, gravity: 500, up: 90 });
      fx.burst(x, y, { count: Math.ceil(n / 2), color: P[1], speed: 70, size: 4, life: 0.5, shape: 'bubble', up: 30 });
      break;
    case 'shadow':
      fx.burst(x, y, { count: Math.ceil(s * 2), color: '#2a1040', speed: 50, size: 7 * s, endSize: 15 * s, life: 0.55, shape: 'smoke', alpha: 0.7 });
      fx.burst(x, y, { count: n, color: [P[0], P[1]], speed: 120 * s, size: 3.5, life: 0.5, up: 50, drag: 2 });
      break;
    case 'cosmic':
      fx.burst(x, y, { count: n, color: [P[0], P[1], '#48f3ff'], speed: 160 * s, size: 4.5, life: 0.5, shape: 'star' });
      fx.burst(x, y, { count: 2, color: '#48f3ff', speed: 30, size: 7, life: 0.35, shape: 'flare' });
      break;
    default: // light
      fx.burst(x, y, { count: n, color: [P[0], P[1], W], speed: 150 * s, size: 4.5, life: 0.45, shape: 'star' });
      fx.burst(x, y, { count: 3, color: P[1], speed: 200, size: 4, life: 0.25, shape: 'spark' });
  }
}

// ------------------------------------------------------------------ formes de projectiles
function drawOrb(color, r = 6) {
  const g = sprite(color, 'glow');
  return (ctx, x, y) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(g, x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    ctx.fillStyle = ca(W, 0.95); ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
    ctx.restore();
  };
}
function drawArrow(color) {
  const st = sprite(color, 'streak');
  return (ctx, x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(st, -30, -4, 44, 8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#6b3a1e'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = '#e8edf5'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(-20, -3, 6, 2); ctx.fillRect(-20, 1, 6, 2);
    ctx.restore();
  };
}
function drawYarn(color, r) {
  return (ctx, x, y, a, k) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(k * 14);
    ctx.fillStyle = color; ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = ca(W, 0.6); ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.35, i * 0.8, 0, TAU); ctx.stroke(); }
    ctx.restore();
  };
}
// pelote-météore : flamme en goutte orientée vers l'arrière + pelote qui tourne
function drawMeteor(color, r) {
  const yarn = drawYarn(color, r);
  return (ctx, x, y, a, k) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
    const fl = 1 + Math.sin(k * 60) * 0.08;
    ctx.fillStyle = ca('#ff5a1a', 0.75); flamePath(ctx, r * 1.25 * fl, r * 0.2); ctx.fill();
    ctx.fillStyle = ca('#ffd23f', 0.85); flamePath(ctx, r * 0.95 * fl, r * 0.25); ctx.fill();
    ctx.restore();
    yarn(ctx, x, y, a, k);
  };
}
function flamePath(ctx, s, off = 0) {
  ctx.beginPath(); ctx.moveTo(-s * 2.4 + off, 0);
  ctx.quadraticCurveTo(-s * 0.6 + off, -s, s * 0.4 + off, -s * 0.85);
  ctx.arc(s * 0.4 + off, 0, s * 0.85, -Math.PI / 2, Math.PI / 2);
  ctx.quadraticCurveTo(-s * 0.6 + off, s, -s * 2.4 + off, 0);
  ctx.closePath();
}
function drawFish(ctx, x, y, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#9fc6e8'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -5); ctx.lineTo(-14, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ca(W, 0.8); ctx.fillRect(-4, -2.6, 8, 1.4);
  ctx.fillStyle = '#1d1530'; ctx.beginPath(); ctx.arc(4.5, -1, 1.2, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawShape(ctx, shape, x, y, a, sz, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const glow = (c, r, al = 0.8) => { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.drawImage(sprite(c, 'glow'), -r, -r, r * 2, r * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; };
  switch (shape) {
    case 'flame': case 'darkflame': {
      const dark = shape === 'darkflame';
      const c1 = dark ? '#9a3cff' : '#ff6a1a', c2 = dark ? '#e070ff' : '#ffd23f';
      ctx.fillStyle = dark ? 'rgba(36,8,60,0.9)' : 'rgba(200,50,10,0.75)'; flamePath(ctx, sz * 0.82); ctx.fill();
      glow(c1, sz * 2, dark ? 0.55 : 0.7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = ca(c1, dark ? 0.6 : 0.8); flamePath(ctx, sz * 0.66, sz * 0.1); ctx.fill();
      ctx.fillStyle = ca(c2, 0.9); flamePath(ctx, sz * 0.42, sz * 0.25); ctx.fill();
      ctx.fillStyle = ca(W, 0.9); ctx.beginPath(); ctx.arc(sz * 0.45, 0, sz * 0.24, 0, TAU); ctx.fill();
      break;
    }
    case 'leaf':
      glow('#5fd068', sz * 2.2, 0.55);
      ctx.drawImage(sprite('#5fd068', 'leaf'), -sz * 1.6, -sz * 1.6, sz * 3.2, sz * 3.2);
      break;
    case 'shard':
      glow('#7fe9ff', sz * 2.2, 0.6);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sprite('#9ff0ff', 'shard'), -sz * 2, -sz * 1.4, sz * 4, sz * 2.8);
      break;
    case 'bolt':
      glow('#ffe14d', sz * 2.4, 0.7);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-sz * 1.5, -sz * 0.5); ctx.lineTo(0, sz * 0.4); ctx.lineTo(-sz * 0.2, -sz * 0.4); ctx.lineTo(sz * 1.5, sz * 0.5);
      ctx.strokeStyle = ca('#ffe14d', 1); ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = W; ctx.lineWidth = 1.2; ctx.stroke();
      break;
    case 'seed':
      glow('#c9ff7a', sz * 2, 0.45);
      ctx.fillStyle = '#a0602a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.75, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#62d86b'; ctx.beginPath(); ctx.ellipse(-sz * 0.6, -sz * 0.6, sz * 0.5, sz * 0.25, -0.6, 0, TAU); ctx.fill();
      break;
    case 'fish': glow('#3fa9ff', sz * 2.6, 0.5); drawFish(ctx, 0, 0, 0); break;
    case 'bubble':
      glow('#3fa9ff', sz * 2.4, 0.6);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sprite('#9fe0ff', 'bubble'), -sz * 1.5, -sz * 1.5, sz * 3, sz * 3);
      break;
    case 'shuriken':
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(sprite('#c9cbd8', 'streak'), -sz * 4, -sz, sz * 4.4, sz * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(Date.now() / 60); ctx.fillStyle = '#c9cbd8'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * 0.4 : sz * 1.4; const an = (i / 8) * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff2a3d'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.25, 0, TAU); ctx.fill();
      break;
    case 'heart': ctx.rotate(-a); ctx.drawImage(sprite('#ff5ca8', 'heart'), -sz * 2, -sz * 2, sz * 4, sz * 4); break;
    case 'cannon':
      ctx.fillStyle = '#2a2340'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, sz * 1.2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = W; ctx.beginPath(); ctx.arc(-sz * 0.4, -sz * 0.4, sz * 0.3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sprite('#ffb52e', 'flare'), -sz * 3, -sz * 1.6, sz * 2.4, sz * 2.4);
      break;
    case 'claw':
      glow(col, sz * 2.2, 0.6);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(-sz, i * sz * 0.5, sz * 1.6, -0.6, 0.6); ctx.strokeStyle = ca(col, 0.95); ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = W; ctx.lineWidth = 0.9; ctx.stroke(); }
      break;
    case 'ankh':
      glow('#ffd54f', sz * 2.6, 0.7);
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = ca('#ffd54f', 1); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, -sz * 0.7, sz * 0.5, sz * 0.6, 0, 0, TAU); ctx.moveTo(0, -sz * 0.1); ctx.lineTo(0, sz * 1.4); ctx.moveTo(-sz * 0.8, sz * 0.3); ctx.lineTo(sz * 0.8, sz * 0.3); ctx.stroke();
      ctx.strokeStyle = W; ctx.lineWidth = 1; ctx.stroke();
      break;
    case 'rainbow':
      glow('#48f3ff', sz * 2.6, 0.6);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sprite('#ff7ae0', 'star'), -sz * 2.2, -sz * 2.2, sz * 4.4, sz * 4.4);
      break;
    default:
      glow(col, sz * 2.4, 0.55);
      ctx.globalCompositeOperation = 'lighter'; ctx.rotate(-a + Date.now() / 300); ctx.drawImage(sprite(col, 'star'), -sz * 2.2, -sz * 2.2, sz * 4.4, sz * 4.4);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ attaque de base du héros (selon l'arme)
export function heroBasicAttack(B, u, tg, onImpact) {
  const fx = B.fx;
  const style = u.style;
  const col = u.weaponColor || '#ffffff';
  const [hx, hy] = B.hand(u);
  const tc = () => B.center(tg);
  if (style === 'arrow') {
    sfx('whoosh');
    fx.charge(() => B.hand(u), { color: col, color2: W, dur: 0.12, size: 7, r: 14 });
    B.later(0.12, () => fx.projectile([hx, hy], tc, { dur: 0.22, arc: 8, draw: drawArrow(col), ribbon: { color: col, width: 4, len: 7 }, onHit: (x, y) => {
      onImpact();
      fx.flare(x, y, { size: 16, color: col, dur: 0.2 });
      fx.burst(x, y, { count: 8, color: [col, W], speed: 180, size: 4.5, life: 0.28, shape: 'spark' });
    } }));
  } else if (style === 'magic') {
    sfx('laser');
    fx.charge(() => { const h = B.hand(u); return [h[0], h[1] - 40]; }, { color: col, color2: W, dur: 0.12, size: 10, r: 18 });
    B.later(0.12, () => fx.projectile([hx, hy - 40], tc, { dur: 0.3, arc: 24, draw: drawOrb(col, 6), ribbon: { color: col, width: 7, len: 9 }, trail: { color: [col, W], size: 4, life: 0.35, shape: 'star', every: 2 }, onHit: (x, y) => {
      onImpact();
      fx.blast(x, y, { r: 30, color: col, dur: 0.3 });
      fx.flare(x, y, { size: 22, color: col, dur: 0.25 });
      fx.shock(x, y, { r: 30, color: col, width: 4, dur: 0.25 });
      fx.burst(x, y, { count: 10, color: [col, W], speed: 150, size: 5, life: 0.4, shape: 'star' });
    } }));
  } else if (style === 'pierce') {
    B.later(0.14, () => {
      const [x, y] = tc();
      fx.beam(hx + 20 * u.facing, hy, x, y, { color: '#5fc8ff', width: 6, dur: 0.22, plain: true });
      onImpact();
      fx.flare(x, y, { size: 18, color: '#bff4ff', dur: 0.22 });
      fx.burst(x, y, { count: 8, color: ['#bff4ff', '#5fc8ff'], speed: 130, size: 5, life: 0.4, shape: 'bubble' });
      fx.burst(x, y, { count: 6, color: '#bff4ff', speed: 200, size: 2.5, life: 0.35, gravity: 500 });
      sfx('hit');
    });
  } else if (style === 'smash') {
    B.later(0.2, () => {
      const [x, y] = tc(); const gy = tg.y;
      onImpact();
      fx.ring(x, gy, { r1: 56, color: col, width: 7, dur: 0.4 });
      fx.flare(x, y + 6, { size: 26, color: col, dur: 0.22 });
      fx.decal(x, gy, { kind: 'crack', r: 24, color: '#ffb066', dur: 1, n: 5, cool: 4 });
      fx.burst(x, gy - 6, { count: 12, color: ['#c9a27a', '#8a6a4a'], speed: 150, size: 5, life: 0.5, gravity: 500, up: 120, shape: 'debris' });
      fx.burst(x, gy - 4, { count: 3, color: '#c9a27a', speed: 60, size: 8, endSize: 16, life: 0.5, shape: 'smoke', alpha: 0.5, flatY: 0.3 });
      B.shake(0.35); sfx('boom');
    });
  } else {
    B.later(0.16, () => onImpact());
  }
}
// effet visuel d'un coup au corps à corps (appelé à l'impact)
export function meleeImpactFx(B, u, tg, crit) {
  const [x, y] = B.center(tg);
  const col = crit ? '#ffd23f' : (u.weaponColor || '#ffffff');
  const fx = B.fx;
  fx.slash(x, y, { r: crit ? 40 : 32, color: col, under: crit ? '#ff9d1c' : null, width: crit ? 15 : 10, angle: -0.6 * u.facing - (u.facing < 0 ? Math.PI : 0) + 0.2, arc: 2.4, dur: 0.22, dir: 1 });
  fx.flare(x + 6 * u.facing, y, { size: crit ? 32 : 16, color: col, dur: crit ? 0.3 : 0.18 });
  fx.burst(x, y, { count: crit ? 14 : 6, color: crit ? ['#ffd23f', W] : [col, W], speed: crit ? 260 : 170, size: 5, life: 0.3, shape: 'spark' });
  if (crit) {
    fx.shock(x, y, { r: 40, color: '#ffd23f', width: 5, dur: 0.28 });
    fx.burst(x, y, { count: 5, color: ['#ffd23f', W], speed: 120, size: 6, life: 0.45, shape: 'star' });
  }
}

// ------------------------------------------------------------------ petits dessins spécifiques
// fils de laine qui s'envolent (impact de la boule de poils)
function yarnStrands(fx, x, y, col) {
  const n = fx.low ? 4 : 7;
  const ang = new Float32Array(n), cur = new Float32Array(n);
  for (let i = 0; i < n; i++) { ang[i] = (i / n) * TAU + Math.random() * 0.6; cur[i] = (Math.random() - 0.5) * 2; }
  fx.custom(0.5, (ctx, k) => {
    const e = 1 - Math.pow(1 - k, 2.5), a = 1 - k;
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = ca(col, a); ctx.lineWidth = 2.2 * a + 0.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = 10 + e * 46, c = Math.cos(ang[i]), s = Math.sin(ang[i]);
      const x1 = x + c * r, y1 = y + s * r * 0.8 + e * e * 20;
      ctx.moveTo(x + c * r * 0.3, y + s * r * 0.24);
      ctx.quadraticCurveTo(x + c * r * 0.65 - s * cur[i] * 14, y + s * r * 0.55 + c * cur[i] * 14, x1, y1);
    }
    ctx.stroke(); ctx.restore();
  });
}
// tornade d'eau : bandes elliptiques en rotation (pointillés animés)
const VDASH = [18, 10, 6, 14];
function drawVortex(ctx, x, y, gy, k) {
  const a = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
  ctx.save(); ctx.lineCap = 'round';
  const top = y - 50;
  for (let i = 0; i < 5; i++) {
    const t = i / 4, yy = gy - 4 + (top - gy) * t, r = 26 + t * 34 + Math.sin(k * 20 + i) * 3;
    ell(ctx, x + Math.sin(k * 9 + i * 1.3) * 5, yy, r, r * 0.28);
    ctx.setLineDash(VDASH); ctx.lineDashOffset = -k * 900 * (i % 2 ? 1 : -1.2);
    ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 7; ctx.strokeStyle = ca('#2a8ae8', 0.4 * a); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; ctx.strokeStyle = ca('#d6fbff', 0.65 * a); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = a * 0.45; ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(sprite('#3fa9ff', 'soft'), x - 60, top - 10, 120, gy - top + 20);
  ctx.restore();
}
// dôme hexagonal (bouclier)
function hexDome(fx, cx, cy, C) {
  const pts = [];
  const R = 8.5, rx = 52, ry = 70;
  for (let row = -9; row <= 9; row++) for (let col = -7; col <= 7; col++) {
    const hx = col * R * 1.73 + (row % 2 ? R * 0.866 : 0), hy = row * R * 1.5;
    const d = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
    if (d < 1 && d > 0.25) pts.push(hx, hy, d);
  }
  const P = new Float32Array(pts);
  const N = P.length / 3;
  fx.custom(0.95, (ctx, k) => {
    const out = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const hx = P[i * 3], hy = P[i * 3 + 1];
      const appear = (hy + ry) / (2 * ry); // du bas vers le haut
      if (k * 2.2 < 1 - appear) continue;
      const s = R * 0.92;
      for (let j = 0; j <= 6; j++) { const a = (j / 6) * TAU + Math.PI / 6; const px = hx + Math.cos(a) * s, py = hy + Math.sin(a) * s; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    }
    ctx.fillStyle = ca(C, 0.1 * out); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = ca(C, 0.75 * out); ctx.stroke();
    // reflet balayant
    const sy = ry - k * 2.6 * ry;
    ctx.globalAlpha = out * 0.8; ctx.drawImage(sprite(C, 'streak'), -rx, sy - 6, rx * 2, 12);
    ell(ctx, 0, 0, rx, ry); ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = ca(W, 0.6 * out); ctx.stroke();
    ctx.restore();
  });
}
// galaxie en formation (Nova)
function drawGalaxy(ctx, x, y, k) {
  const g1 = sprite('#c77dff', 'glow'), g2 = sprite('#ff7ae0', 'glow'), g3 = sprite('#48f3ff', 'glow');
  const a = Math.min(1, k * 2.5);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y); ctx.scale(1, 0.55);
  const rot = k * k * 14;
  const col = k < 0.8 ? 1.2 - k * 0.4 : (1.2 - 0.32) * (1 - (k - 0.8) / 0.2 * 0.85);
  for (let arm = 0; arm < 3; arm++) {
    const spr = arm === 0 ? g1 : arm === 1 ? g2 : g3;
    for (let i = 0; i < 12; i++) {
      const t = i / 12, r = (10 + t * 80) * col, an = rot + arm * (TAU / 3) + t * 2.8;
      const s = (8 - t * 5) * a;
      ctx.globalAlpha = a * (1 - t * 0.6);
      ctx.drawImage(spr, Math.cos(an) * r - s, Math.sin(an) * r - s, s * 2, s * 2);
    }
  }
  const cs = 8 + k * 22;
  ctx.globalAlpha = a; ctx.drawImage(sprite('#ff9df0', 'glow'), -cs, -cs, cs * 2, cs * 2);
  ctx.restore();
}
// neuf âmes-flammes qui tournent puis fusionnent dans le héros
function drawNineSouls(ctx, cx, cy, k) {
  const g = sprite('#ffd23f', 'glow'), st = sprite('#ffb52e', 'streak');
  const conv = k < 0.25 ? 0 : Math.min(1, (k - 0.25) / 0.5);
  const R = 62 * (1 - conv * conv);
  const a = (k < 0.1 ? k / 0.1 : 1) * (k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.2) : 1);
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const an = (i / 9) * TAU + k * 9;
    const x = cx + Math.cos(an) * R, y = cy - 6 + Math.sin(an) * R * 0.38 - Math.sin(k * 6 + i) * 6;
    ctx.globalAlpha = a;
    ctx.save(); ctx.translate(x, y); ctx.rotate(an + Math.PI / 2 + Math.PI); ctx.drawImage(st, -18, -4, 22, 8); ctx.restore();
    ctx.drawImage(g, x - 9, y - 9, 18, 18);
  }
  ctx.restore();
}
// patte spectrale géante qui balaie (Griffe du Tigre Céleste)
function drawGhostPaw(ctx, x, y, q, C, f, second) {
  const a = q < 0.2 ? q / 0.2 : 1 - (q - 0.2) / 0.8;
  if (a <= 0) return;
  const dx = (second ? -1 : 1) * f, t = q * 2 - 0.6;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x + dx * 60 * (0.5 - q), y - 70 * (0.6 - q)); ctx.rotate((second ? 0.7 : -0.5) * f); ctx.scale(1.25 + q * 0.3, 1.25 + q * 0.3);
  ctx.globalAlpha = 0.3 * a; ctx.drawImage(sprite(C, 'soft'), -60, -60, 120, 120);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ca(C, 0.32 * a); ctx.strokeStyle = ca(W, 0.6 * a); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 10, 24, 19, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i++) { const an = -Math.PI / 2 + (i - 1.5) * 0.55; const px = Math.cos(an) * 36, py = Math.sin(an) * 30 + 6; ctx.beginPath(); ctx.ellipse(px, py, 8.5, 11, an + Math.PI / 2, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = ca(W, 0.9 * a);
  for (let i = 0; i < 4; i++) { const an = -Math.PI / 2 + (i - 1.5) * 0.55; const px = Math.cos(an) * 44, py = Math.sin(an) * 38 + 6; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + Math.cos(an) * 8 + 4, py + Math.sin(an) * 8, px + Math.cos(an) * 12 + 8 * Math.max(0, t), py + Math.sin(an) * 14); ctx.stroke(); }
  ctx.restore();
}
// cible au sol (météore) : cercles qui se resserrent
function drawTarget(ctx, x, y, r, k, C) {
  const a = Math.min(1, k * 4) * (k > 0.85 ? (1 - k) / 0.15 : 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.6 + 0.4 * Math.sin(k * 40);
  ell(ctx, x, y, r * (1.2 - k * 0.4), r * (1.2 - k * 0.4) * 0.3); ctx.lineWidth = 2.5; ctx.strokeStyle = ca(C, 0.8 * a * pulse); ctx.stroke();
  ell(ctx, x, y, r * (1 - k) + 6, (r * (1 - k) + 6) * 0.3); ctx.lineWidth = 1.5; ctx.strokeStyle = ca('#ffd23f', 0.9 * a); ctx.stroke();
  ctx.globalAlpha = a * 0.35 * (0.5 + k); ctx.drawImage(sprite(C, 'soft'), x - r, y - r * 0.3, r * 2, r * 0.6);
  ctx.restore();
}
// arcs électriques résiduels sur une cible
function staticArcs(B, e, C, dur) {
  const fx = B.fx;
  let tick = 0;
  fx.custom(dur, null, 'front', () => {
    if (++tick % (fx.low ? 8 : 4) || e.dead) return;
    const [x, y] = B.center(e); const h = e.height * 0.4;
    const a = Math.random() * TAU;
    fx.lightning(x + Math.cos(a) * h * 0.3, y + Math.sin(a) * h * 0.5, x + Math.cos(a + 1.2) * h * 0.7, y + Math.sin(a + 1.2) * h, { color: C, dur: 0.1, width: 0.35, seg: 4, amp: 8, branches: 0 });
  });
}

// ------------------------------------------------------------------ pouvoirs du héros
export function castSkill(B, u, sk) {
  const fx = B.fx;
  const foes = B.foes(u);
  if (!foes.length && !['purrheal', 'shield', 'ninelives'].includes(sk.id)) return false;
  const front = foes[0];
  const mult = (sk.mult || 0) * (sk.lm || 1);
  const [cx, cy] = B.center(u);
  const head = B.head(u);
  const f = u.facing;
  const hand = () => B.hand(u);
  const mid = () => { const ok = B.foes(u); if (!ok.length) return [cx + 120 * f, cy]; let x = 0, y = 0; for (const e of ok) { const c = B.center(e); x += c[0]; y += c[1]; } return [x / ok.length, y / ok.length]; };
  const gy = groundOf(foes, u.y);
  if (sk.r >= 4) B.cutin(u, sk);
  B.say(u, sk.name, 'name');
  switch (sk.id) {
    case 'slash': { // Griffes Éclair : trois griffures électriques
      sfx('slash');
      const C = '#7fe9ff';
      fx.charge(hand, { color: C, color2: W, dur: 0.12, size: 10, r: 18 });
      for (let i = 0; i < 3; i++) B.later(i * 0.1, () => {
        if (front.dead) return;
        const [x, y] = B.center(front);
        const last = i === 2;
        fx.claw(x, y, { n: 3, gap: 10, r: 40 + i * 4, color: i === 1 ? C : W, under: '#2a7ad8', width: last ? 12 : 10, angle: -1 + i * 0.9, arc: 2.4, dur: 0.26, dir: f });
        fx.flare(x, y, { size: last ? 34 : 20, color: C, dur: 0.25 });
        for (let j = 0; j < (last ? 3 : 1); j++) { const a = Math.random() * TAU; fx.lightning(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a) * 34, y + Math.sin(a) * 26, { color: C, dur: 0.16, width: 0.45, seg: 5, amp: 12, branches: 0 }); }
        fx.burst(x, y, { count: last ? 14 : 8, color: [C, W], speed: 260, size: 5, life: 0.3, shape: 'spark' });
        if (last) { fx.shock(x, y, { r: 46, color: C, width: 5, dur: 0.3 }); B.shake(0.3); }
        B.hit(u, front, mult / 3, { skill: true }); sfx('hit');
      });
      break;
    }
    case 'furball': { // Boule de Poils
      sfx('whoosh');
      const O = '#ff9d3c';
      fx.charge(head, { color: '#ffcf8a', color2: W, dur: 0.16, size: 14, r: 22 });
      fx.projectile(head, () => B.center(front), { dur: 0.5, arc: 50, draw: drawYarn('#d9a066', 11), glow: '#ffb066', glowSize: 24, ribbon: { color: '#ffb066', width: 14, len: 12 }, trail: { color: ['#ffcf8a', '#fff0d0'], size: 5, life: 0.4, shape: 'star', every: 2 }, onHit: (x, y) => {
        fx.blast(x, y, { r: 70, color: O, dur: 0.45 });
        fx.flare(x, y, { size: 48, color: '#ffcf8a', dur: 0.35 });
        fx.shock(x, y, { r: 70, color: '#ffb52e', width: 7, dur: 0.35 });
        fx.ring(x, front.y, { r1: 80, color: '#ffb52e' });
        fx.burst(x, y, { count: 20, color: ['#ffcf8a', O, W], speed: 300, size: 5, life: 0.45, shape: 'spark' });
        fx.burst(x, y, { count: 8, color: ['#f0d0a0', '#d9a066'], speed: 130, size: 10, endSize: 22, life: 0.7, shape: 'smoke', up: 30, alpha: 0.75 });
        fx.burst(x, y, { count: 8, color: ['#d9a066', '#b07040'], speed: 220, size: 4, life: 0.8, shape: 'debris', gravity: 500, up: 120 });
        yarnStrands(fx, x, y, '#e0a868');
        fx.decal(x, front.y, { kind: 'scorch', r: 34, color: O, dur: 1.4 });
        if (!front.dead) B.hit(u, front, mult, { skill: true });
        B.shake(0.5); B.stop(0.05); sfx('boom');
      } });
      break;
    }
    case 'kibble': { // Pluie de Croquettes : un portail-patte doré déverse les croquettes
      const [mx0] = mid();
      const py = 140;
      fx.glyph(mx0, py, { style: 'paw', color: '#ffcf40', color2: '#ff9d3c', r: 70, squash: 0.3, dur: 1.25, spin: 2, layer: 'front' });
      fx.blast(mx0, py, { r: 60, color: '#ffb52e', dur: 1.2, squash: 0.35, alpha: 0.6 });
      const kib = (ctx, px, py2) => { ctx.fillStyle = '#b0713a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py2, 4.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8b070'; ctx.fillRect(px - 2, py2 - 2.5, 2.4, 1.6); };
      for (let w = 0; w < 3; w++) B.later(w * 0.28, () => {
        for (const e of B.foes(u)) {
          for (let k = 0; k < 3; k++) {
            const [x, y] = B.center(e);
            const tx = x + (Math.random() - 0.5) * 30;
            fx.projectile([mx0 + (Math.random() - 0.5) * 100, py + (Math.random() - 0.5) * 8], [tx, y], { dur: 0.32 + Math.random() * 0.12, arc: 0, draw: kib, ribbon: { color: '#ffcf8a', width: 4, len: 5 }, onHit: (px, py2) => {
              fx.burst(px, py2, { count: 4, color: ['#d9a066', '#8a5a2a'], speed: 100, size: 4, life: 0.4, gravity: 450, up: 60, shape: 'debris' });
              fx.burst(px, py2, { count: 2, color: '#ffd23f', speed: 60, size: 5, life: 0.3, shape: 'star' });
            } });
          }
          B.later(0.42, () => { if (!e.dead) B.hit(u, e, mult / 3, { skill: true }); });
        }
        sfx('hit');
      });
      break;
    }
    case 'purrheal': { // Ronron Soignant : sceau-patte, colonne douce, cœurs et croix qui montent en spirale
      sfx('heal');
      B.heal(u, sk.heal * (1 + 0.05 * ((sk.lvl || 1) - 1)));
      const G = '#5dff9e', P = '#ff9fd8';
      fx.glyph(u.x, u.y, { style: 'paw', color: G, color2: P, r: 46, dur: 1.2, spin: 1 });
      fx.ring(u.x, u.y, { r1: 70, color: G, dur: 0.8 });
      fx.pillar(u.x, { color: G, width: 20, dur: 0.9, y: u.y, top: cy - 110 });
      fx.blast(cx, cy, { r: 46, color: G, dur: 0.6, alpha: 0.6 });
      let t = 0;
      fx.custom(0.9, null, 'front', () => {
        if (++t % (fx.low ? 4 : 2)) return;
        const a = t * 0.5;
        fx.emit(cx + Math.cos(a) * 26, u.y - 6 + Math.sin(a) * 6, -Math.sin(a) * 20, -70 - Math.random() * 30, t % 4 ? G : P, 5 + Math.random() * 2, 0.9, { shape: t % 4 ? 'plus' : 'heart', drag: 0.6 });
      });
      fx.burst(cx, cy, { count: 16, color: [G, P, W], speed: 60, up: 120, size: 5, life: 1.1, shape: 'star', spread: 40 });
      break;
    }
    case 'fish': { // Tornade de Sardines
      sfx('whoosh');
      const [mx0, my0] = mid();
      fx.decal(mx0, gy, { kind: 'splash', r: 70, color: '#3fa9ff', dur: 2 });
      fx.custom(1.5, (ctx, k) => {
        drawVortex(ctx, mx0, my0, gy, k);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + k * 16;
          const r = (34 + (i % 3) * 10) * (k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1);
          const x = mx0 + Math.cos(a) * r, y = my0 + 10 - k * 40 - (i % 4) * 9 + Math.sin(a) * r * 0.35;
          drawFish(ctx, x, y, a + Math.PI / 2);
        }
      }, 'front', () => {
        if (Math.random() < (fx.low ? 0.3 : 0.6)) fx.burst(mx0 + (Math.random() - 0.5) * 70, my0 - Math.random() * 60, { count: 2, color: ['#7fd8ff', W], speed: 60, size: 6, life: 0.4, shape: 'bubble' });
        if (Math.random() < (fx.low ? 0.25 : 0.5)) { const a = Math.random() * TAU; fx.emit(mx0 + Math.cos(a) * 50, my0 - Math.random() * 50, Math.cos(a) * 140, -60, '#9fe0ff', 2.5, 0.5, { gravity: 500, drag: 0.5 }); }
      });
      for (let k = 0; k < (sk.hits || 5); k++) B.later(0.2 + k * 0.25, () => {
        for (const e of B.foes(u)) { B.hit(u, e, mult / (sk.hits || 5), { skill: true }); const [x, y] = B.center(e); fx.flare(x, y, { size: 14, color: '#9fe0ff', dur: 0.18 }); }
        sfx('hit');
      });
      B.later(1.35, () => { fx.ring(mx0, gy, { r1: 90, color: '#3fa9ff', width: 6, dur: 0.5 }); fx.burst(mx0, gy - 10, { count: 18, color: ['#9fe0ff', '#3fa9ff', W], speed: 200, size: 3, life: 0.6, gravity: 500, up: 160 }); });
      break;
    }
    case 'laser': { // Laser Oculaire : regard éblouissant, double rayon qui brûle le sol
      sfx('laser');
      B.flash('#ff2a55', 0.12);
      const ff = B.foes(u);
      const last = ff[ff.length - 1];
      const sweep = (k) => { const a = B.center(front), b = B.center(last); const t = Math.min(1, k * 1.4); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
      fx.flare(head[0], head[1], { size: 26, color: '#ff2a55', dur: 0.8, len: 3 });
      for (const dy of [-3, 3]) fx.beam(head[0], head[1] + dy, 0, 0, { color: '#ff2a55', color2: '#ffb52e', width: 6, dur: 0.75, follow: sweep });
      let t = 0;
      fx.custom(0.75, null, 'front', (k) => {
        if (++t % (fx.low ? 4 : 2) || k > 0.85) return;
        const p = sweep(k);
        fx.emit(p[0], p[1], (Math.random() - 0.5) * 160, -60 - Math.random() * 120, Math.random() < 0.5 ? '#ffb52e' : '#ff2a55', 3.5, 0.4, { shape: 'spark', gravity: 400, drag: 1 });
        if (t % 8 === 0) fx.decal(p[0], gy + (Math.random() - 0.5) * 6, { kind: 'scorch', r: 14, color: '#ff4a2a', dur: 1.2, cool: 2 });
      });
      for (let k = 0; k < 4; k++) B.later(0.1 + k * 0.15, () => { for (const e of B.foes(u)) { const [x, y] = B.center(e); fx.burst(x, y, { count: 6, color: ['#ff2a55', '#ffb52e', W], speed: 170, size: 4.5, life: 0.35, up: 60, shape: 'spark' }); fx.flare(x, y, { size: 16, color: '#ff6a55', dur: 0.15 }); } });
      B.later(0.3, () => { for (const e of B.foes(u)) B.hit(u, e, mult, { skill: true }); B.shake(0.4); });
      break;
    }
    case 'shield': { // Bouclier Ronronnant : dôme hexagonal qui se tisse du bas vers le haut
      sfx('heal');
      B.shield(u, sk.shield * (sk.lm || 1));
      const C = '#7fd8ff';
      hexDome(fx, cx, cy, C);
      fx.ring(u.x, u.y, { r1: 80, color: C });
      fx.glyph(u.x, u.y, { style: 'hex', color: C, color2: W, r: 48, dur: 1, spin: -1.5 });
      fx.flare(cx, cy - 10, { size: 40, color: C, dur: 0.4 });
      fx.burst(cx, cy, { count: 16, color: [C, W], speed: 160, size: 5, life: 0.6, shape: 'star' });
      break;
    }
    case 'thunder': { // Foudre Féline : ciel qui s'assombrit, éclairs ramifiés, sol fissuré
      B.flash('#cfefff', 0.32);
      B.shake(0.9);
      fx.dim({ a: 0.45, dur: 0.85, color: '#05081a' });
      B.foes(u).forEach((e, i) => B.later(i * 0.08, () => {
        if (e.dead) return;
        const [x, y] = B.center(e);
        fx.lightning(x + (Math.random() - 0.5) * 50, -10, x, e.y - 4, { color: '#8fd9ff', dur: 0.4, width: 1.3, branches: 3 });
        fx.lightning(x + (Math.random() - 0.5) * 60, -10, x, e.y - 4, { color: '#c77dff', dur: 0.3, width: 0.8, branches: 1 });
        fx.pillar(x, { color: '#8fd9ff', width: 10, dur: 0.22, y: e.y, motes: false });
        fx.blast(x, y, { r: 46, color: '#8fd9ff', dur: 0.35 });
        fx.flare(x, e.y - 6, { size: 40, color: '#bfefff', dur: 0.3, len: 2.6 });
        fx.ring(x, e.y, { r1: 60, color: '#8fd9ff' });
        fx.decal(x, e.y, { kind: 'crack', r: 28, color: '#8fd9ff', dur: 1.5, n: 6, cool: 2 });
        fx.burst(x, y, { count: 14, color: ['#8fd9ff', W], speed: 320, size: 5, life: 0.4, shape: 'spark' });
        staticArcs(B, e, '#8fd9ff', 0.55);
        B.hit(u, e, mult, { skill: true }); B.stop(0.04);
        sfx('thunder');
      }));
      break;
    }
    case 'meteor': { // Météore de Pelote : cible au sol, pelote enflammée, cratère incandescent
      const [mx0, my0] = mid();
      sfx('whoosh');
      fx.custom(0.75, (ctx, k) => drawTarget(ctx, mx0, gy, 64, k, '#ff7a1a'), 'back');
      fx.dim({ a: 0.32, dur: 1.5, in: 0.4, out: 0.5, color: '#140408' });
      const from = [mx0 + 160 * f, -60];
      fx.projectile(from, [mx0, my0], { dur: 0.75, arc: 0, draw: drawMeteor('#ff5ca8', 24), glow: '#ff7a1a', glowSize: 46, ribbon: { color: '#ff7a1a', width: 40, len: 14 }, trail: { color: ['#ff7a1a', '#ffd23f', '#5a2a1a'], size: 9, life: 0.4 }, onHit: (x, y) => {
        B.flash('#ffb066', 0.45); B.shake(1.4); B.zoom(1.12, x, y); B.stop(0.09);
        fx.blast(x, y, { r: 140, color: '#ff6a1a', dur: 0.7, soft: true });
        fx.blast(x, y, { r: 48, color: '#ffd23f', dur: 0.22 });
        fx.flare(x, y, { size: 64, color: '#ffd23f', dur: 0.45, len: 3 });
        fx.shock(x, y, { r: 150, color: '#ffd23f', color2: '#ff5ca8', width: 12, dur: 0.55 });
        fx.ring(x, gy, { r1: 190, color: '#ffd23f', dur: 0.7, width: 10 });
        fx.ring(x, gy, { r1: 110, color: '#ff5ca8', dur: 0.5, width: 7 });
        fx.decal(x, gy, { kind: 'crack', r: 80, color: '#ff7a1a', dur: 2.4, n: 9, cool: 1.4 });
        fx.rays(x, y, { n: 10, len: 150, width: 18, color: '#ffb066', dur: 0.6 });
        fx.burst(x, y, { count: 36, color: ['#ff7a1a', '#ffd23f', '#ff5ca8', W], speed: 440, size: 5, life: 0.6, shape: 'spark' });
        fx.burst(x, y, { count: 20, color: ['#ff7a1a', '#ffd23f'], speed: 260, size: 8, life: 0.7, gravity: 200, up: 80 });
        fx.burst(x, gy - 6, { count: 22, color: ['#5a3a2a', '#8a5a3a'], speed: 300, size: 6, life: 0.9, gravity: 700, up: 220, shape: 'debris' });
        fx.burst(x, gy - 12, { count: 10, color: ['#3a2420', '#5a3a30'], speed: 120, size: 16, endSize: 34, life: 1.4, shape: 'smoke', up: 50, alpha: 0.65, flatY: 0.5 });
        fx.burst(x, gy - 10, { count: 18, color: ['#ff7a1a', '#ffd23f'], speed: 90, size: 3, life: 1.6, shape: 'ember', up: 80, drag: 1.2, spread: 60 });
        for (const e of B.foes(u)) B.hit(u, e, mult, { skill: true });
        sfx('boom');
      } });
      break;
    }
    case 'ninelives': { // Neuf Vies : neuf âmes dorées tournent puis fusionnent, colonne divine
      sfx('heal'); sfx('legendary');
      B.heal(u, sk.heal);
      B.buff(u, sk.buff, 6);
      const G = '#ffd23f';
      fx.dim({ a: 0.25, dur: 1.2 });
      fx.pillar(u.x, { color: G, width: 30, dur: 1.1, y: u.y });
      fx.rays(cx, cy - 10, { n: 12, len: 130, width: 16, color: '#ffe680', dur: 1.1, spin: 0.5 });
      fx.glyph(u.x, u.y, { style: 'sun', color: G, color2: W, r: 62, dur: 1.4, spin: 0.8 });
      B.flash('#fff2b0', 0.3);
      fx.ring(u.x, u.y, { r1: 110, color: G, dur: 1 });
      fx.custom(1.1, (ctx, k) => drawNineSouls(ctx, cx, cy, k), 'front');
      B.later(0.82, () => { const [x, y] = B.center(u); fx.flare(x, y - 6, { size: 70, color: G, dur: 0.45, len: 2.8 }); fx.shock(x, y, { r: 80, color: G, width: 7, dur: 0.4 }); fx.burst(x, y, { count: 18, color: [G, W], speed: 240, size: 5, life: 0.4, shape: 'spark' }); });
      fx.burst(cx, cy, { count: 30, color: [G, W, '#ffb52e'], speed: 120, up: 180, size: 6, life: 1.3, shape: 'star', spread: 40 });
      B.say(u, 'NEUF VIES !', 'big');
      break;
    }
    case 'nova': { // Nova Cosmique : une galaxie se forme puis explose
      const [mx0, my0] = mid();
      fx.dim({ a: 0.5, dur: 1.55, in: 0.25, out: 0.5, color: '#0a0420' });
      fx.glyph(mx0, gy, { style: 'hex', color: '#c77dff', color2: '#ff7ae0', r: 80, dur: 1.4, spin: 2 });
      let t = 0;
      fx.custom(0.7, (ctx, k) => drawGalaxy(ctx, mx0, my0, k), 'front', () => {
        if (fx.low && ++t % 2) return;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * TAU, r = 140 * Math.random() + 40;
          const x = mx0 + Math.cos(a) * r, y = my0 + Math.sin(a) * r * 0.6;
          fx.emit(x, y, (mx0 - x) * 2.2, (my0 - y) * 2.2, i % 2 ? '#c77dff' : '#ff7ae0', 6, 0.35, { shape: i ? 'star' : 'spark', drag: 0 });
        }
      });
      sfx('laser');
      B.later(0.7, () => {
        sfx('boom'); B.flash('#d6a8ff', 0.5); B.shake(1.5); B.zoom(1.12, mx0, my0); B.stop(0.1);
        fx.blast(mx0, my0, { r: 150, color: '#a050ff', dur: 0.8, soft: true });
        fx.blast(mx0, my0, { r: 90, color: '#ff7ae0', dur: 0.5, soft: true });
        fx.blast(mx0, my0, { r: 44, color: '#ffd6ff', dur: 0.22 });
        fx.flare(mx0, my0, { size: 66, color: '#ffd6ff', dur: 0.5, len: 3 });
        fx.shock(mx0, my0, { r: 170, color: '#c77dff', color2: '#48f3ff', width: 12, dur: 0.6 });
        fx.shock(mx0, my0, { r: 110, color: '#ff7ae0', width: 8, dur: 0.45 });
        fx.ring(mx0, gy, { r1: 220, color: '#c77dff', dur: 0.8, width: 10 });
        fx.rays(mx0, my0, { n: 14, len: 200, width: 20, color: '#e0b0ff', dur: 0.7, spin: 1 });
        fx.decal(mx0, gy, { kind: 'crack', r: 90, color: '#c77dff', dur: 2.2, n: 9, cool: 1.5 });
        fx.burst(mx0, my0, { count: 44, color: ['#c77dff', '#ff7ae0', '#7fd8ff', W], speed: 460, size: 6, life: 0.9, shape: 'star' });
        fx.burst(mx0, my0, { count: 28, color: [W, '#48f3ff', '#ff7ae0'], speed: 520, size: 5, life: 0.5, shape: 'spark' });
        fx.burst(mx0, my0, { count: 22, color: ['#c77dff', '#48f3ff', W], speed: 70, size: 3, life: 1.8, shape: 'ember', spread: 120, drag: 1 });
        for (const e of B.foes(u)) B.hit(u, e, mult, { skill: true });
      });
      break;
    }
    case 'tiger': { // Griffe du Tigre Céleste : patte spectrale géante, griffures sur toute la ligne
      const [mx0, my0] = mid();
      fx.dim({ a: 0.3, dur: 0.95 });
      for (let k = 0; k < (sk.hits || 2); k++) B.later(k * 0.28, () => {
        sfx('slash'); B.shake(1); B.stop(0.05);
        const C = k ? '#48f3ff' : '#ffd23f';
        fx.custom(0.34, (ctx, q) => drawGhostPaw(ctx, mx0, my0 - 10, q, C, f, k), 'front');
        fx.claw(mx0, my0 - 10, { n: 4, gap: 15, r: 90, color: C, under: k ? '#1a8ab8' : '#d08a10', width: 16, angle: k ? -2.2 : -0.9, arc: 2.2, dur: 0.32, dir: f });
        fx.flare(mx0, my0, { size: 70, color: C, dur: 0.4, len: 3 });
        fx.shock(mx0, my0, { r: 120, color: C, width: 8, dur: 0.4 });
        fx.decal(mx0, gy, { kind: 'claw', r: 46, color: C, dur: 1.6, n: 4, gap: 9, angle: k ? -0.35 : 0.35, cool: 1.5 });
        fx.burst(mx0, my0, { count: 28, color: ['#ffd23f', '#48f3ff', W], speed: 380, size: 6, life: 0.5, shape: 'spark' });
        for (const e of B.foes(u)) { B.hit(u, e, mult / (sk.hits || 2), { skill: true }); const [x, y] = B.center(e); fx.flare(x, y, { size: 22, color: C, dur: 0.22 }); }
      });
      break;
    }
    default: break;
  }
  return true;
}

// ------------------------------------------------------------------ attaques des chatons (une attaque unique par chaton)
const ULT_GLYPH = { light: 'sun', cosmic: 'hex', shadow: 'rune', ice: 'hex', water: 'rune', fire: 'sun', thunder: 'hex', nature: 'paw' };
export function kittenAttack(B, k, tg, mult, ult) {
  const fx = B.fx;
  const A = k.atk || { pattern: 'orb', shape: 'star', n: 1 };
  const col = ELEMENTS[k.el] ? ELEMENTS[k.el].color : '#ffffff';
  const P = palOf(k.el), C = P[0], H = P[1];
  const owner = k.owner;
  const kd = 1 + ((owner.stats && owner.stats.kitDmg) || 0) / 100;
  const dmg = mult * kd * (ult ? 3 : 1);
  const big = ult ? 2 : 1;
  const [x0, y0] = B.head(k);
  const tc = () => B.center(tg);
  const n = Math.max(1, A.n || 1) * (ult ? 2 : 1);
  const sz = (k.r >= 5 ? 5 : 4) * big;
  const hs = big * (n > 3 ? 0.7 : 1);
  const hitOnce = (x, y, part = 1) => {
    if (!tg.dead) B.hit(owner, tg, dmg * part, { pet: true });
    elemHit(B, k.el, x, y, hs);
  };
  if (ult) {
    B.say(k, A.name + ' !', 'tag'); sfx('legendary'); B.shake(0.5);
    fx.glyph(k.x, k.y, { style: ULT_GLYPH[k.el] || 'rune', color: C, color2: H, r: 30, dur: 0.9, spin: 3 });
    fx.charge(() => B.head(k), { color: C, color2: H, dur: 0.22, size: 14, r: 24, rate: 2 });
    fx.pillar(k.x, { color: C, width: 12, dur: 0.5, y: k.y, top: k.y - 90, motes: false });
  } else fx.flare(x0, y0, { size: 9, color: C, dur: 0.16, len: 1.4 });
  const draw = (ctx, x, y, a) => drawShape(ctx, A.shape, x, y, a, sz, col);
  const rib = { color: A.shape === 'rainbow' ? '#ff7ae0' : C, width: (A.shape === 'flame' || A.shape === 'darkflame' ? 6 : 4) * big, len: 8 };
  const trail = { color: [C, H], size: 2.5 * big, life: 0.25, shape: A.shape === 'star' ? 'star' : 'glow', every: 3 };
  switch (A.pattern) {
    case 'multi':
      for (let i = 0; i < n; i++) B.later(i * 0.06, () => fx.projectile([x0, y0], tc, { dur: 0.32 + i * 0.02, arc: 10 + i * 9, draw, ribbon: rib, trail, onHit: (x, y) => hitOnce(x, y, 1 / n) }));
      break;
    case 'rain':
      for (let i = 0; i < n; i++) B.later(i * 0.08, () => { const [x, y] = tc(); const tx = x + (Math.random() - 0.5) * 34; fx.projectile([tx + 40, -10], [tx, y + (Math.random() - 0.5) * 16], { dur: 0.32, arc: 0, draw, ribbon: { ...rib, len: 10 }, onHit: (px, py) => hitOnce(px, py, 1 / n) }); });
      break;
    case 'beam':
      B.later(0.05, () => {
        const [x, y] = tc();
        if (A.shape === 'rainbow') {
          fx.beam(x0, y0, x, y, { color: '#ff7ae0', width: 4 * big, dur: 0.38, plain: true });
          fx.beam(x0, y0 + 2.5 * big, x, y + 2.5 * big, { color: '#48f3ff', width: 3 * big, dur: 0.38, plain: true });
          fx.beam(x0, y0 - 2.5 * big, x, y - 2.5 * big, { color: '#ffe14d', width: 2.5 * big, dur: 0.38, plain: true });
        } else fx.beam(x0, y0, x, y, { color: A.shape === 'heart' ? '#ff7aa8' : C, color2: H, width: 4 * big, dur: 0.36 });
        if (A.shape === 'heart') fx.burst(x, y, { count: 3 * big, color: '#ff5ca8', speed: 90, size: 5, life: 0.6, shape: 'heart', up: 40 });
        hitOnce(x, y); sfx('laser');
      });
      break;
    case 'chain': {
      const foes = B.foes(owner).slice(0, n);
      let px = x0, py = y0;
      foes.forEach((e, i) => B.later(i * 0.07, () => {
        const [x, y] = B.center(e);
        fx.lightning(px, py, x, y, { color: C, dur: 0.25, width: 0.7 * big, branches: 1, amp: 24 });
        px = x; py = y;
        if (!e.dead) B.hit(owner, e, dmg / Math.sqrt(foes.length), { pet: true });
        fx.flare(x, y, { size: 14 * big, color: C, dur: 0.2 });
        fx.burst(x, y, { count: 6, color: [C, W], speed: 180, size: 4, life: 0.3, shape: 'spark' });
      }));
      sfx('thunder');
      break;
    }
    case 'nova':
      B.later(0.1, () => {
        const [x, y] = tc();
        fx.blast(x, y, { r: 40 * big, color: C, dur: 0.4 });
        fx.flare(x, y, { size: 26 * big, color: H, dur: 0.35, len: 2 });
        fx.shock(x, y, { r: 50 * big, color: C, width: 5, dur: 0.35 });
        fx.ring(x, tg.y, { r1: 60 * big, color: C });
        if (ult) { fx.rays(x, y, { n: 8, len: 90, width: 12, color: C, dur: 0.55 }); fx.glyph(x, tg.y, { style: ULT_GLYPH[k.el] || 'sun', color: C, color2: H, r: 60, dur: 0.9, spin: 2 }); }
        for (const e of B.foes(owner)) if (Math.abs(B.center(e)[0] - x) < 70 * big && !e.dead) B.hit(owner, e, dmg * 0.7, { pet: true });
        fx.burst(x, y, { count: 12 * big, color: [C, W], speed: 200, size: 5, life: 0.5, shape: A.shape === 'shard' ? 'shard' : 'star' });
      });
      break;
    case 'dash': {
      const [tx, ty] = tc();
      const sx = k.x;
      const bar = sprite(C, 'barH');
      fx.custom(0.26, (ctx, q) => {
        const e = Math.min(1, q * 2.2), x1 = sx + (tx - sx) * e, x0b = sx + (tx - sx) * Math.max(0, q * 2.2 - 0.6);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q;
        ctx.drawImage(bar, Math.min(x0b, x1), ty - 5 * big, Math.abs(x1 - x0b) + 1, 10 * big);
        ctx.lineWidth = 1; ctx.strokeStyle = ca(W, 0.7 * (1 - q));
        ctx.beginPath(); for (let i = -1; i <= 1; i += 2) { ctx.moveTo(x0b, ty + i * 8 * big); ctx.lineTo(x1 - 10, ty + i * 8 * big); } ctx.stroke();
        ctx.restore();
      });
      for (let i = 0; i < n; i++) B.later(0.12 + i * 0.07, () => {
        if (A.shape === 'claw') fx.claw(tx, ty, { n: 3, gap: 5 * big, r: 18 * big, color: C, under: P[3], width: 5 * big, angle: -1 + i, arc: 2.2, dur: 0.2 });
        else fx.slash(tx, ty, { r: 20 * big, color: H, under: P[3], width: 7 * big, angle: -1 + i, arc: 2.4, dur: 0.18 });
        hitOnce(tx, ty, 1 / n); sfx('slash');
      });
      break;
    }
    case 'spiral':
      for (let i = 0; i < n; i++) B.later(i * 0.05, () => { const off = (i - (n - 1) / 2) * 0.5; fx.projectile([x0, y0], tc, { dur: 0.4, arc: 30 * Math.sin(off * 2) + 5, draw, ribbon: rib, onHit: (x, y) => hitOnce(x, y, 1 / n) }); });
      break;
    case 'meteor':
      for (let i = 0; i < n; i++) B.later(i * 0.14, () => {
        const [x, y] = tc();
        fx.projectile([x + 70, -30], [x + (i - 1) * 10, y], { dur: 0.42, arc: 0, draw: (ctx, px, py, a) => drawShape(ctx, A.shape, px, py, a, sz * 1.6, col), glow: C, glowSize: 14 * big, ribbon: { color: C, width: 12 * big, len: 12 }, trail: { color: [C, '#ffd23f', '#ffffff'], size: 4 * big, life: 0.35, every: 2 }, onHit: (px, py) => {
          fx.blast(px, py, { r: 34 * big, color: C });
          fx.flare(px, py, { size: 24 * big, color: H, dur: 0.3 });
          fx.ring(px, tg.y, { r1: 40 * big, color: C, width: 5 });
          fx.decal(px, tg.y, { kind: ult ? 'crack' : 'scorch', r: 18 * big, color: C, dur: 1.2, n: 5 });
          B.shake(0.3); hitOnce(px, py, 1 / n);
        } });
      });
      break;
    case 'pillar':
      for (let i = 0; i < n; i++) B.later(0.08 + i * 0.12, () => {
        const foes = B.foes(owner); const e = foes[i % Math.max(1, foes.length)] || tg; const [x, y] = B.center(e);
        fx.pillar(x, { color: C, width: (ult ? 9 : 12) * big, dur: 0.45, y: e.y, alpha: ult ? 0.6 : 0.85 });
        if (A.shape === 'bolt') fx.lightning(x, -10, x, e.y - 4, { color: C, width: 0.9 * big });
        else fx.glyph(x, e.y, { style: A.shape === 'star' ? 'sun' : 'rune', color: C, color2: H, r: 22 * big, dur: 0.6, spin: 3 });
        fx.flare(x, e.y - 6, { size: 22 * big, color: H, dur: 0.3 });
        if (!e.dead) B.hit(owner, e, dmg / n, { pet: true });
        fx.burst(x, y, { count: 8, color: [C, W], speed: 120, up: 80, size: 5, life: 0.4, shape: 'star' });
      });
      break;
    case 'wave':
      B.later(0.05, () => {
        const [, y] = tc(); const sx = k.x, ex = Math.min(B.viewW, B.center(tg)[0] + 60);
        const gy = tg.y;
        fx.decal((sx + ex) / 2 + 30, gy, { kind: 'splash', r: (ex - sx) / 2, color: C, dur: 1.2, squash: 0.18 });
        fx.custom(0.55, (ctx, q) => {
          const x = sx + (ex - sx) * q, hgt = 34 * big * (1 - q * 0.4), a = 1 - q * 0.6;
          ctx.save();
          ctx.beginPath(); ctx.moveTo(x - 70, gy + 4); ctx.quadraticCurveTo(x - 30, gy - hgt * 0.4, x - 6, gy - hgt); ctx.quadraticCurveTo(x + 10, gy - hgt * 1.05, x + 14, gy - hgt * 0.75); ctx.quadraticCurveTo(x + 4, gy - hgt * 0.4, x + 18, gy + 4); ctx.closePath();
          ctx.fillStyle = ca(P[3], 0.45 * a); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = ca(C, 0.45 * a); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = ca(W, 0.75 * a); ctx.beginPath(); ctx.moveTo(x - 30, gy - hgt * 0.45); ctx.quadraticCurveTo(x - 10, gy - hgt * 1.02, x + 14, gy - hgt * 0.75); ctx.stroke();
          ctx.restore();
          drawShape(ctx, A.shape, x - 8, gy - hgt * 0.6, -0.3, sz * 0.75, col);
        }, 'front', (q) => { if (Math.random() < (fx.low ? 0.3 : 0.6)) { const x = sx + (ex - sx) * q; fx.emit(x, gy - 30 * big * (1 - q * 0.4), 40 + Math.random() * 60, -60 - Math.random() * 60, Math.random() < 0.5 ? H : W, 2.5, 0.45, { gravity: 400, drag: 0.5, shape: k.el === 'nature' ? 'leaf' : 'glow' }); } });
        for (const e of B.foes(owner)) B.later(0.25, () => { if (!e.dead) { B.hit(owner, e, dmg * 0.6, { pet: true }); const [ex2, ey2] = B.center(e); elemHit(B, k.el, ex2, ey2, 0.7 * big); } });
      });
      break;
    case 'boomerang': {
      const from = [x0, y0];
      const spin = (ctx, x, y, a, q) => drawShape(ctx, A.shape, x, y, q * 20, sz * 1.3, col);
      fx.projectile(from, tc, { dur: 0.3, arc: -20, draw: spin, ribbon: { ...rib, width: rib.width * 1.6 }, onHit: (x, y) => {
        hitOnce(x, y, 0.6);
        fx.slash(x, y, { r: 18 * big, color: C, under: P[3], width: 6 * big, angle: -1.2, arc: 2.6, dur: 0.18 });
        fx.projectile([x, y], () => B.head(k), { dur: 0.3, arc: 20, draw: spin, ribbon: { ...rib, width: rib.width * 1.6 }, onHit: () => {} });
        B.later(0.15, () => { if (!tg.dead) { B.hit(owner, tg, dmg * 0.4, { pet: true }); const [x2, y2] = tc(); fx.flare(x2, y2, { size: 14 * big, color: C, dur: 0.18 }); } });
      } });
      break;
    }
    case 'orbit': {
      const g = sprite(C, 'glow');
      fx.custom(0.6, (ctx, q) => {
        const rr = 18 * (0.6 + 0.4 * Math.min(1, q * 3));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + q * 12, ox = k.x + Math.cos(a) * rr, oy = k.y - 24 + Math.sin(a) * 8;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(g, ox - 8 * big, oy - 8 * big, 16 * big, 16 * big); ctx.restore();
          drawShape(ctx, A.shape, ox, oy, a, sz * 0.8, col);
        }
      });
      for (let i = 0; i < n; i++) B.later(0.6 + i * 0.05, () => fx.projectile([k.x + Math.cos(i) * 18, k.y - 24], tc, { dur: 0.3, arc: 12, draw, ribbon: rib, onHit: (x, y) => hitOnce(x, y, 1 / n) }));
      break;
    }
    case 'spikes': {
      const ice = '#bff4ff';
      for (let i = 0; i < n; i++) B.later(0.1 + i * 0.08, () => {
        const [x] = tc(); const px = x + (i - (n - 1) / 2) * 12; const gy = tg.y;
        if (i === 0) fx.decal(x, gy, { kind: 'frost', r: 26 + n * 4, color: '#7fe9ff', dur: 1.3, n: 8 });
        const lean = (Math.random() - 0.5) * 0.4;
        fx.custom(0.5, (ctx, q) => {
          const hgt = Math.sin(Math.min(1, q * 2.5) * Math.PI / 2) * 26 * big * (1 - Math.max(0, q - 0.7) / 0.3);
          if (hgt <= 0.5) return;
          const tx = px + lean * hgt, w = 5 * big * 0.7 + 2;
          ctx.save();
          ctx.beginPath(); ctx.moveTo(px - w, gy); ctx.lineTo(tx, gy - hgt); ctx.lineTo(px + w, gy); ctx.closePath();
          ctx.fillStyle = ca('#5fb8e8', 0.75); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath(); ctx.moveTo(px - w * 0.2, gy); ctx.lineTo(tx, gy - hgt); ctx.lineTo(px + w, gy); ctx.closePath(); ctx.fillStyle = ca(ice, 0.85); ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = ca(W, 0.9); ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(tx, gy - hgt); ctx.stroke();
          ctx.restore();
        }, 'front', (q, done) => { if (done) fx.burst(px, gy - 10, { count: 4, color: [ice, W], speed: 120, size: 4, life: 0.4, shape: 'shard', gravity: 400, up: 60 }); });
        if (i === 0) B.later(0.1, () => hitOnce(x, B.center(tg)[1]));
      });
      break;
    }
    case 'breath': {
      const smoke = k.el === 'shadow' ? '#2a1040' : '#4a2418';
      const cone = sprite(C, 'soft');
      fx.custom(0.6, (ctx, q) => {
        const [x, y] = tc();
        const a = Math.atan2(y - y0, x - x0), L = Math.hypot(x - x0, y - y0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 * Math.sin(Math.PI * q);
        ctx.translate(x0, y0); ctx.rotate(a); ctx.drawImage(cone, -6, -12 * big, L + 20, 24 * big);
        ctx.restore();
      }, 'front', () => {
        const [x, y] = tc();
        const nn = fx.low ? 1 : 3;
        for (let i = 0; i < nn; i++) fx.emit(x0, y0, (x - x0) * (1.6 + Math.random()), (y - y0) * 1.6 + (Math.random() - 0.5) * 80, i === 0 ? H : Math.random() < 0.5 ? C : P[3], (3 + Math.random() * 3) * big, 0.45, { drag: 1.5, endSize: 7 * big, shape: i === 0 ? 'glow' : 'soft' });
        if (Math.random() < 0.4) fx.emit(x0, y0, (x - x0) * 1.4, (y - y0) * 1.4 - 20, smoke, 5 * big, 0.6, { shape: 'smoke', endSize: 14 * big, drag: 1.5, alpha: 0.5 });
      });
      for (let i = 0; i < 4; i++) B.later(0.15 + i * 0.12, () => { const [x, y] = tc(); hitOnce(x, y, 0.25); });
      sfx('whoosh');
      break;
    }
    default:
      fx.projectile([x0, y0], tc, { dur: 0.36, arc: 22, draw: (ctx, x, y, a) => drawShape(ctx, A.shape, x, y, a, sz * 1.2, col), ribbon: { ...rib, width: rib.width * 1.4 }, trail, onHit: (x, y) => {
        hitOnce(x, y);
        if (A.shape === 'bubble' || A.shape === 'seed' || A.shape === 'cannon') {
          fx.blast(x, y, { r: 28 * big, color: C, dur: 0.3 });
          fx.shock(x, y, { r: 30 * big, color: C, width: 4, dur: 0.3 });
          if (A.shape === 'cannon') fx.burst(x, y, { count: 4, color: '#3a3040', speed: 50, size: 8, endSize: 18, life: 0.6, shape: 'smoke', alpha: 0.6 });
          B.shake(0.2);
        }
      } });
  }
}

// ------------------------------------------------------------------ coup final du héros (toutes les 5 attaques)
export function heroFinisher(B, u, tg, onHit) {
  const fx = B.fx;
  const col = u.weaponColor || '#ffffff';
  const style = u.style;
  B.say(u, 'COUP FINAL', 'tag');
  sfx('whoosh');
  const tc = () => B.center(tg);
  fx.charge(() => B.hand(u), { color: col, color2: W, dur: 0.12, size: 12, r: 20 });
  if (style === 'arrow') {
    for (let i = 0; i < 6; i++) B.later(0.1 + i * 0.05, () => {
      const [x, y] = tc(); const tx = x + (Math.random() - 0.5) * 40;
      fx.projectile([tx - 60, -20], [tx, y + 6], { dur: 0.25, arc: 0, draw: (ctx, px, py, a) => drawShape(ctx, 'shard', px, py, a, 5, col), ribbon: { color: col, width: 5, len: 9 }, onHit: (px, py) => {
        fx.flare(px, py, { size: 14, color: col, dur: 0.2 });
        fx.burst(px, py, { count: 5, color: [col, W], speed: 140, size: 4, life: 0.25, shape: 'spark' });
        if (i === 5) { onHit(tg); B.shake(0.4); fx.shock(px, py, { r: 40, color: col, width: 5, dur: 0.3 }); }
      } });
    });
  } else if (style === 'magic') {
    B.later(0.15, () => {
      const [x, y] = tc();
      fx.projectile(B.hand(u), [x, y], { dur: 0.35, arc: 40, draw: (ctx, px, py, a) => drawShape(ctx, 'star', px, py, a, 9, col), ribbon: { color: col, width: 12, len: 12 }, trail: { color: [col, W], size: 5, life: 0.4, shape: 'star', every: 2 }, onHit: (px, py) => {
        fx.blast(px, py, { r: 70, color: col, dur: 0.45 });
        fx.flare(px, py, { size: 50, color: col, dur: 0.4, len: 2.4 });
        fx.shock(px, py, { r: 70, color: col, color2: W, width: 7, dur: 0.4 });
        fx.ring(px, tg.y, { r1: 80, color: col });
        fx.glyph(px, tg.y, { style: 'rune', color: col, color2: W, r: 50, dur: 0.9, spin: 2.5 });
        fx.burst(px, py, { count: 16, color: [col, W], speed: 220, size: 5, life: 0.5, shape: 'star' });
        B.shake(0.6); B.stop(0.05); onHit(tg);
        for (const e of B.foes(u)) if (e !== tg && Math.abs(B.center(e)[0] - px) < 60) B.hit(u, e, 1, {});
        sfx('boom');
      } });
    });
  } else if (style === 'smash') {
    B.later(0.2, () => {
      const [x, y] = tc();
      fx.ring(x, tg.y, { r1: 110, color: col, width: 9 });
      fx.ring(x, tg.y, { r1: 60, color: W, width: 5, dur: 0.3 });
      fx.flare(x, y + 10, { size: 50, color: col, dur: 0.35, len: 2.6 });
      fx.decal(x, tg.y, { kind: 'crack', r: 60, color: '#ffb066', dur: 2, n: 8, cool: 2.2 });
      fx.burst(x, tg.y - 6, { count: 24, color: ['#c9a27a', '#8a6a4a', W], speed: 260, size: 6, life: 0.6, gravity: 600, up: 200, shape: 'debris' });
      fx.burst(x, tg.y - 6, { count: 6, color: '#c9a27a', speed: 110, size: 10, endSize: 24, life: 0.8, shape: 'smoke', alpha: 0.55, flatY: 0.3 });
      B.shake(1); B.stop(0.07); onHit(tg);
      for (const e of B.foes(u)) if (e !== tg) B.hit(u, e, 1.2, {});
      sfx('boom');
    });
  } else if (style === 'pierce') {
    for (let i = 0; i < 3; i++) B.later(0.1 + i * 0.1, () => {
      const [x, y] = tc(); const [hx, hy] = B.hand(u);
      fx.beam(hx, hy, x + 30, y + (i - 1) * 6, { color: '#5fc8ff', width: 6 + i * 1.5, dur: 0.22 });
      fx.flare(x, y + (i - 1) * 6, { size: 18 + i * 6, color: '#bff4ff', dur: 0.22 });
      fx.burst(x, y, { count: 8, color: ['#bff4ff', '#5fc8ff'], speed: 150, size: 6, life: 0.35, shape: 'bubble' });
      if (i === 2) { onHit(tg); B.shake(0.4); fx.shock(x, y, { r: 46, color: '#5fc8ff', width: 5, dur: 0.3 }); fx.burst(x, y, { count: 10, color: '#bff4ff', speed: 220, size: 2.5, life: 0.45, gravity: 500, up: 60 }); }
    });
  } else {
    for (let i = 0; i < 3; i++) B.later(0.08 + i * 0.09, () => {
      const [x, y] = tc();
      const lastHit = i === 2;
      fx.slash(x, y, { r: 30 + i * 6, color: lastHit ? '#ffd23f' : col, under: lastHit ? '#e07a10' : null, width: 12 + i * 3, angle: -1.4 + i * 1.3, arc: 2.6, dur: 0.22, dir: u.facing });
      fx.burst(x, y, { count: 8, color: [col, W], speed: 220, size: 5, life: 0.3, shape: 'spark' });
      sfx('slash');
      if (lastHit) { fx.flare(x, y, { size: 46, color: '#ffd23f', dur: 0.35, len: 2.6 }); fx.shock(x, y, { r: 52, color: '#ffd23f', width: 6, dur: 0.32 }); onHit(tg); B.shake(0.5); B.stop(0.05); }
    });
  }
}

// ------------------------------------------------------------------ attaques spéciales des boss
export function bossSkill(B, e, hero) {
  const fx = B.fx;
  const sk = e.bossSkill;
  if (sk === 'slam') {
    B.say(e, 'ATTENTION !', 'tag');
    const hx = hero.x;
    fx.custom(1.1, (ctx, q) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const R = 34 + q * 6, pulse = 0.7 + 0.3 * Math.sin(q * 30);
      ell(ctx, hx, hero.y, R, R * 0.27); ctx.fillStyle = ca('#ff2a3d', 0.12 + q * 0.22); ctx.fill();
      ctx.lineWidth = 2 + q * 1.5; ctx.strokeStyle = ca('#ff2a3d', 0.85 * pulse); ctx.stroke();
      ell(ctx, hx, hero.y, R * q, R * 0.27 * q); ctx.fillStyle = ca('#ff5a3d', 0.35); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = ca('#ffd23f', 0.6 * q); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + q * 2; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * (R + 3), hero.y + Math.sin(a) * (R + 3) * 0.27); ctx.lineTo(hx + Math.cos(a) * (R + 9), hero.y + Math.sin(a) * (R + 9) * 0.27); ctx.lineWidth = 2; ctx.strokeStyle = ca('#ff2a3d', 0.8 * pulse); ctx.stroke(); }
      ctx.restore();
    }, 'back');
    fx.charge(() => B.center(e), { color: '#ff5a3d', color2: '#ffd23f', dur: 1.05, size: 26, r: 40, rate: 1 });
    B.later(1.1, () => {
      if (e.dead) return;
      B.shake(1.2); B.flash('#ff6a3d', 0.3); B.stop(0.08);
      fx.ring(hx, hero.y, { r1: 90, color: '#ff7a1a', width: 9 });
      fx.shock(hx, hero.y - 30, { r: 80, color: '#ff7a1a', width: 8, dur: 0.4 });
      fx.flare(hx, hero.y - 10, { size: 56, color: '#ffb066', dur: 0.35, len: 2.6 });
      fx.decal(hx, hero.y, { kind: 'crack', r: 60, color: '#ff5a1a', dur: 2.2, n: 8, cool: 1.8 });
      fx.burst(hx, hero.y - 10, { count: 26, color: ['#8a6a4a', '#c9a27a', '#ff7a1a'], speed: 260, size: 7, life: 0.6, gravity: 600, up: 220, shape: 'debris' });
      fx.burst(hx, hero.y - 8, { count: 8, color: ['#8a6a4a', '#c9a27a'], speed: 120, size: 12, endSize: 28, life: 0.9, shape: 'smoke', alpha: 0.55, flatY: 0.35 });
      if (!hero.dead) B.hit(e, hero, 3, {});
      sfx('boom');
    });
  } else if (sk === 'summon') {
    B.say(e, 'À MOI, MES SBIRES !', 'tag');
    sfx('thunder');
    fx.glyph(e.x - 30, e.y, { style: 'rune', color: '#b968ff', color2: '#ff4d5e', r: 60, dur: 1.2, spin: -2 });
    fx.pillar(e.x - 30, { color: '#b968ff', width: 22, dur: 0.6, y: e.y });
    fx.burst(e.x - 30, e.y - 10, { count: 10, color: '#2a1040', speed: 80, size: 12, endSize: 26, life: 0.8, shape: 'smoke', alpha: 0.6 });
    B.summonMinions(e, 2);
  } else if (sk === 'drain') {
    B.say(e, 'DRAIN DE VIE', 'tag');
    fx.beam(B.center(e)[0], B.center(e)[1], 0, 0, { color: '#b3202f', color2: '#ff6a7a', width: 7, dur: 1.1, follow: () => B.center(hero) });
    let t = 0;
    fx.custom(1.1, null, 'front', () => {
      if (++t % (fx.low ? 6 : 3)) return;
      const a = B.center(hero), b = B.center(e);
      fx.emit(a[0] + (Math.random() - 0.5) * 20, a[1] + (Math.random() - 0.5) * 20, (b[0] - a[0]) * 1.6, (b[1] - a[1]) * 1.6 - 20, Math.random() < 0.5 ? '#ff4d5e' : '#ff9faa', 4, 0.6, { drag: 0.3 });
    });
    for (let i = 0; i < 4; i++) B.later(0.2 + i * 0.25, () => {
      if (e.dead || hero.dead) return;
      B.hit(e, hero, 0.6, {});
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02);
      fx.text(B.center(e)[0], e.y - e.height - 4, '+' + Math.round(e.maxHp * 0.02).toLocaleString('fr-FR'), 'heal');
      const [bx, by] = B.center(e); fx.flare(bx, by, { size: 22, color: '#ff4d5e', dur: 0.25 });
    });
    sfx('laser');
  } else {
    B.say(e, 'BARRAGE !', 'tag');
    const col = ENEMY_COLOR[e.ekind] || '#ff4d5e';
    fx.charge(() => { const c = B.center(e); return [c[0] - 10, c[1] - 10]; }, { color: col, color2: W, dur: 0.3, size: 16, r: 30 });
    for (let i = 0; i < 6; i++) B.later(i * 0.14, () => {
      if (e.dead) return;
      const [x, y] = B.center(e);
      fx.projectile([x - 10, y - 10], () => B.center(hero), { dur: 0.4, arc: 30 + i * 6, draw: (ctx, px, py, a) => drawShape(ctx, 'star', px, py, a, 5, col), ribbon: { color: col, width: 6, len: 9 }, onHit: (px, py) => {
        fx.flare(px, py, { size: 16, color: col, dur: 0.2 });
        fx.burst(px, py, { count: 6, color: [col, W], speed: 150, size: 4, life: 0.3, shape: 'spark' });
        if (!hero.dead) B.hit(e, hero, 0.55, {});
      } });
    });
    sfx('laser');
  }
}
const ENEMY_COLOR = { yetiLord: '#9ff0ff', kraken: '#7a3cff', vacuumPrime: '#ff2a3d', magmaKing: '#ff7a1a', thunderBird: '#ffe14d' };

// ------------------------------------------------------------------ aura cosmétique du héros
export function auraTick(B, u, dt) {
  const A = u.aura;
  const fx = B.fx;
  const [cx, cy] = B.center(u);
  const rate = { rise: 18, fall: 14, fire: 26, orbit: 16, burst: 10, ring: 22, spiral: 26, pillar: 18 }[A.motion] || 16;
  const n = rate * dt;
  for (let i = 0; i < 3 && Math.random() < n - i; i++) {
    const c = A.colors[Math.floor(Math.random() * A.colors.length)];
    const shape = A.shape === 'heart' ? 'heart' : A.shape === 'note' || A.shape === 'coin' ? 'star' : A.shape;
    const t = B.time;
    switch (A.motion) {
      case 'fall': fx.emit(cx + (Math.random() - 0.5) * 50, cy - 50, (Math.random() - 0.5) * 10, 30, c, 4, 1.4, { shape: shape === 'debris' ? 'debris' : shape, drag: 0, alpha: 0.85 }); break;
      case 'fire': fx.emit(cx + (Math.random() - 0.5) * 30, u.y - 4, (Math.random() - 0.5) * 12, -60 - Math.random() * 30, c, 6, 0.7, { drag: 0.5, endSize: 1 }); break;
      case 'orbit': { const a = t * 3 + Math.random() * TAU; fx.emit(cx + Math.cos(a) * 28, cy + Math.sin(a) * 10, -Math.sin(a) * 30, Math.cos(a) * 10, c, 4.5, 0.6, { shape, drag: 0 }); break; }
      case 'burst': fx.emit(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, c, 5, 0.25, { shape: 'spark', drag: 3 }); break;
      case 'ring': { const a = Math.random() * TAU; fx.emit(cx + Math.cos(a) * 30, u.y - 2 + Math.sin(a) * 6, 0, -14, c, 4.5, 0.8, { shape: 'glow', drag: 0 }); break; }
      case 'spiral': { const a = t * 5 + Math.random() * 0.4; const r = 14 + (t * 30) % 22; fx.emit(cx + Math.cos(a) * r, cy + 10 - ((t * 40) % 60), 0, -20, c, 4.5, 0.7, { shape, drag: 0 }); break; }
      case 'pillar': fx.emit(cx + (Math.random() - 0.5) * 22, u.y, 0, -90 - Math.random() * 40, c, 4, 0.8, { shape, drag: 0 }); break;
      default: fx.emit(cx + (Math.random() - 0.5) * 36, u.y - Math.random() * 20, (Math.random() - 0.5) * 8, -30 - Math.random() * 20, c, 4.5, 1, { shape: shape === 'smoke' ? 'smoke' : shape, drag: 0, endSize: shape === 'smoke' ? 14 : 0 });
    }
  }
}

// ------------------------------------------------------------------ attaques des ennemis
export function enemyAttack(B, e, tg, rangedColor, onImpact) {
  const fx = B.fx;
  if (rangedColor) {
    const [x0, y0] = B.center(e);
    fx.projectile([x0 - 10, y0], () => B.center(tg), { dur: 0.32, arc: 18, draw: drawOrb(rangedColor, 4), ribbon: { color: rangedColor, width: 5, len: 7 }, onHit: (x, y) => { onImpact(); fx.flare(x, y, { size: 12, color: rangedColor, dur: 0.18 }); } });
  } else B.later(0.15, () => onImpact());
}
export function hurtFx(B, tg) {
  const [x, y] = B.center(tg);
  B.fx.burst(x, y, { count: 6, color: ['#ff4d5e', '#ffffff'], speed: 150, size: 4.5, life: 0.28, shape: 'spark' });
  B.fx.flare(x + 4, y, { size: 12, color: '#ff4d5e', dur: 0.16, len: 1.4 });
}
export { RCOL };
