// Effets des classes : coups finaux signature, aura d'ambiance, sceau au sol, marques
// (malédiction, poison, âmes, parade, exécution). Tout passe par les primitives de fx.js.
import { ell, glow } from './draw.js';
import { sprite, runeSprite, ca } from './fx.js';
import { sfx } from '../audio.js';

const TAU = Math.PI * 2;
const W = '#ffffff';

// --------------------------------------------------------------- coups finaux signature
// hitFn(target, mult) applique les dégâts ; renvoie l'objet {dmg, crit} ou null
export function classFinisher(B, u, tg, M, hitFn) {
  const fx = B.fx, f = u.facing;
  const foes = () => B.foes(u);
  const C = M.color, A = M.accent;
  if (u.side === 0 && B.game.onClassUlt) B.game.onClassUlt(M);
  B.say(u, M.ult.name.toUpperCase(), 'name');
  const [hx, hy] = B.center(u);
  const all = (mult) => { for (const e of foes()) hitFn(e, mult); };
  switch (M.cls) {
    case 'botte': { // Estocade Royale : 4 estocs éclair, pluie de pétales, puis un grand Z doré
      sfx('slash');
      fx.dim({ a: 0.22, dur: 0.85 });
      fx.charge(() => B.hand(u), { color: A, color2: W, dur: 0.1, size: 12, r: 18 });
      fx.burst(hx, hy - 10, { count: 8, color: [C, '#ff8a9a'], speed: 120, size: 4, life: 0.8, shape: 'petal', up: 40, drag: 2, gravity: 60 });
      for (let i = 0; i < 4; i++) B.later(0.06 + i * 0.08, () => {
        const t = tg.dead ? foes()[0] : tg; if (!t) return;
        const [x, y] = B.center(t);
        const [px, py] = B.hand(u);
        const ty = y + (i - 1.5) * 7;
        fx.beam(px + 6 * f, py - 4 + (i - 1.5) * 4, x + 26 * f, ty, { color: i % 2 ? A : C, width: 3.2, dur: 0.16, plain: true });
        fx.cut(x + 4 * f, ty, { len: 46, angle: (i - 1.5) * 0.12, width: 6, color: i % 2 ? A : W, under: i % 2 ? '#e09a10' : C, dur: 0.18 });
        fx.flare(x, ty, { size: 22, color: A, dur: 0.2 });
        fx.burst(x, y, { count: 7, color: [A, W], speed: 220, size: 4.5, life: 0.25, shape: 'spark' });
        hitFn(t, M.ult.mult / 5);
      });
      B.later(0.42, () => {
        const t = tg.dead ? foes()[0] : tg; if (!t) return;
        const [x, y] = B.center(t);
        drawZ(fx, x, y, C, A);
        B.shake(0.5); B.stop(0.06);
        fx.flare(x, y, { size: 56, color: A, dur: 0.45, len: 3 });
        fx.shock(x, y, { r: 60, color: A, color2: C, width: 6, dur: 0.35 });
        fx.burst(x, y, { count: 18, color: [A, C, W], speed: 260, size: 6, life: 0.5, shape: 'star' });
        fx.burst(x, y, { count: 12, color: [C, '#ff8a9a', '#ffd6dc'], speed: 160, size: 4.5, life: 1.1, shape: 'petal', gravity: 90, drag: 2, up: 60 });
        hitFn(t, M.ult.mult / 5);
        sfx('crit');
      });
      break;
    }
    case 'noir': { // Nova des Ombres : cercle runique sous les ennemis, colonnes d'ombre et éclairs
      sfx('laser');
      const list = foes();
      if (!list.length) return;
      let cx = 0; for (const e of list) cx += e.x; cx /= list.length;
      const gy = list[0].y;
      fx.dim({ a: 0.42, dur: 1.15, color: '#08031a' });
      fx.glyph(cx, gy, { style: 'rune', color: C, color2: A, r: 86, dur: 1.1, spin: 2.2 });
      fx.glyph(cx, gy, { style: 'hex', color: A, color2: C, r: 50, dur: 1.0, spin: -3 });
      fx.charge(() => { const h = B.hand(u); return [h[0], h[1] - 30]; }, { color: C, color2: A, dur: 0.33, size: 16, r: 30, rate: 2 });
      let t = 0;
      fx.custom(0.35, null, 'front', () => {
        if (++t % (fx.low ? 4 : 2)) return;
        const a = Math.random() * TAU;
        fx.emit(cx + Math.cos(a) * 70, gy + Math.sin(a) * 20, 0, -60 - Math.random() * 60, Math.random() < 0.6 ? C : A, 3, 0.5, { shape: 'streak', drag: 0.5 });
      });
      B.later(0.35, () => {
        B.flash(C, 0.3); B.shake(0.7);
        for (const e of foes()) {
          const [x, y] = B.center(e);
          fx.pillar(e.x, { color: C, under: '#3a0a6a', width: 15, dur: 0.5, y: e.y, alpha: 0.6 });
          fx.lightning(e.x + (Math.random() - 0.5) * 20, -10, e.x, e.y - e.height * 0.5, { color: A, dur: 0.3, width: 0.9 });
          fx.flare(x, y, { size: 30, color: A, dur: 0.3 });
          fx.decal(e.x, e.y, { kind: 'crack', r: 26, color: C, dur: 1.4, n: 6, cool: 1.8 });
          fx.burst(x, y, { count: 3, color: '#1a0830', speed: 60, size: 10, endSize: 22, life: 0.7, shape: 'smoke', alpha: 0.7 });
          fx.burst(x, y, { count: 10, color: [C, A, W], speed: 200, size: 5, life: 0.5, shape: 'star' });
        }
        fx.ring(cx, gy, { r1: 110, color: A, width: 7, dur: 0.5 });
        all(M.ult.mult);
        sfx('thunder');
      });
      break;
    }
    case 'tigre': { // Rugissement Sanglant : rugissement, bond, impact au sol, onde de choc rouge, soin
      sfx('whoosh');
      const t0 = foes()[0]; if (!t0) return;
      const [rx, ry] = B.head(u);
      for (let i = 0; i < 3; i++) B.later(i * 0.07, () => fx.shock(rx + 10 * f, ry, { r: 50 + i * 12, color: i % 2 ? A : C, width: 5, dur: 0.3, squash: 1.1 }));
      B.later(0.12, () => { const [x, y] = B.center(u); fx.burst(x, y - 20, { count: 10, color: ['#ffffff', '#ffd6a0'], speed: 90, size: 14, endSize: 26, life: 0.5, shape: 'smoke' }); });
      B.later(0.3, () => {
        const gx = t0.dead ? (foes()[0] || t0).x : t0.x, gy = t0.y;
        B.shake(1.3); B.stop(0.09); B.flash(A, 0.3);
        fx.ring(gx, gy, { r1: 150, color: C, width: 10, dur: 0.5 });
        fx.ring(gx, gy, { r1: 90, color: A, width: 7, dur: 0.4 });
        fx.blast(gx, gy - 20, { r: 90, color: C, dur: 0.5, soft: true });
        fx.flare(gx, gy - 14, { size: 60, color: '#ffb066', dur: 0.4, len: 3 });
        fx.decal(gx, gy, { kind: 'crack', r: 70, color: C, dur: 2.2, n: 9, cool: 1.6 });
        fx.claw(gx, gy - 34, { n: 3, gap: 14, r: 60, color: '#ff9a5a', under: A, width: 12, angle: -0.9, arc: 2, dur: 0.3, dir: f });
        fx.burst(gx, gy - 6, { count: 26, color: ['#8a5a3a', '#c9a27a', C], speed: 260, up: 160, size: 7, life: 0.8, shape: 'debris', gravity: 600 });
        fx.burst(gx, gy - 8, { count: 16, color: [C, '#ffd23f'], speed: 120, size: 3, life: 1.2, shape: 'ember', up: 90, drag: 1.2, spread: 80 });
        for (let i = 0; i < (fx.low ? 2 : 4); i++) fx.emit(gx + (Math.random() - 0.5) * 120, gy, 0, -60 - Math.random() * 60, '#8a6a5a', 9, 0.8, { shape: 'smoke', endSize: 20, drag: 1, alpha: 0.6 });
        all(M.ult.mult);
        if (M.ult.heal) { B.heal(u, M.ult.heal); for (const e of foes().slice(0, 3)) soulTo(B, e.x, e.y - e.height * 0.5, u, '#ff4d3a'); }
        sfx('thunder');
      });
      break;
    }
    case 'ninja': { // Danse des Mille Lames : bombe fumigène, coupes iaï sur chaque ennemi, réapparition
      sfx('whoosh');
      const [x0, y0] = B.center(u);
      fx.burst(x0, y0, { count: 18, color: ['#2a2636', '#4a4660'], speed: 120, size: 16, endSize: 30, life: 0.6, shape: 'smoke', alpha: 0.85 });
      fx.flare(x0, y0, { size: 24, color: C, dur: 0.2 });
      fx.dim({ a: 0.3, dur: 0.75, color: '#12020a' });
      u.vanish = 0.55;
      const list = foes();
      list.slice(0, 6).forEach((e, i) => {
        for (let j = 0; j < 3; j++) B.later(0.1 + i * 0.07 + j * 0.05, () => {
          if (e.dead) return;
          const [x, y] = B.center(e);
          const ang = -1.1 + j * 1.05 + (Math.random() - 0.5) * 0.4;
          fx.cut(x, y, { len: 84 + j * 10, angle: ang, width: 9, color: j === 2 ? '#ff8a8a' : W, under: j === 2 ? C : '#5a1020', dur: 0.22 });
          fx.burst(x, y, { count: 5, color: [C, W], speed: 200, size: 4, life: 0.25, shape: 'spark' });
          if (j === 2) fx.burst(x, y, { count: 4, color: '#1a1020', speed: 140, size: 3, life: 0.5, shape: 'debris', gravity: 400 });
          hitFn(e, M.ult.mult / 3);
        });
      });
      B.later(0.5, () => {
        const [x, y] = B.center(u);
        fx.burst(x, y, { count: 12, color: ['#2a2636', '#4a4660'], speed: 90, size: 14, endSize: 24, life: 0.4, shape: 'smoke', alpha: 0.8 });
        fx.burst(x, y - 10, { count: 10, color: ['#ff8aa8', '#ffd6e0', C], speed: 130, size: 4, life: 1, shape: 'petal', gravity: 70, drag: 2, up: 50 });
        fx.flare(x, y, { size: 30, color: C, dur: 0.25 });
        sfx('crit');
      });
      break;
    }
    case 'siamois': { // Pluie de Flèches : volée en cloche qui retombe sur tout le groupe
      sfx('whoosh');
      const list = foes();
      if (!list.length) return;
      const [hx2, hy2] = B.hand(u);
      let cx = 0; for (const e of list) cx += e.x; cx /= list.length;
      fx.glyph(cx, list[0].y, { style: 'rune', color: C, color2: A, r: 70, dur: 1.0, spin: 1.5 });
      fx.flare(hx2, hy2, { size: 26, color: A, dur: 0.3 });
      for (let i = 0; i < 5; i++) B.later(i * 0.05, () => fx.projectile([hx2, hy2], [hx2 + 40 * f + i * 6, -30], { dur: 0.22, arc: 0, draw: arrowDraw(A), ribbon: { color: A, width: 4, len: 8 } }));
      for (let i = 0; i < 14; i++) B.later(0.35 + i * 0.035, () => {
        const ls = foes(); if (!ls.length) return;
        const e = ls[i % ls.length];
        const tx = e.x + (Math.random() - 0.5) * 34;
        fx.projectile([tx - 50 * f, -20], [tx, e.y - 6 - Math.random() * 20], { dur: 0.2, arc: 0, draw: arrowDraw(i % 3 ? W : A), ribbon: { color: i % 3 ? C : A, width: 7, len: 9 }, onHit: (x, y) => {
          fx.flare(x, y, { size: 12, color: A, dur: 0.16 });
          fx.burst(x, y, { count: 4, color: [C, W], speed: 120, size: 4, life: 0.25, shape: 'spark' });
        } });
      });
      B.later(0.6, () => {
        all(M.ult.mult); B.shake(0.5); sfx('crit');
        fx.ring(cx, list[0].y, { r1: 100, color: C, width: 7, dur: 0.45 });
        fx.burst(cx, list[0].y - 20, { count: 14, color: [A, C, W], speed: 200, size: 5, life: 0.5, shape: 'star', spread: 60 });
      });
      break;
    }
    case 'sphynx': { // Moisson des Âmes : faux spectrale géante qui balaie la ligne et arrache les âmes
      sfx('slash');
      const list = foes(); if (!list.length) return;
      let cx = 0; for (const e of list) cx += e.x; cx /= list.length;
      const cy = list[0].y - 50;
      fx.dim({ a: 0.35, dur: 0.95, color: '#021410' });
      fx.custom(0.6, (ctx, k) => drawGhostScythe(ctx, cx, cy, k, C, A, f), 'front');
      B.later(0.12, () => fx.slash(cx + 10 * f, cy + 10, { r: 100, color: C, under: '#0e6a4a', width: 22, angle: f > 0 ? 0.9 : Math.PI - 0.9, arc: 2.6, dur: 0.34, squash: 0.55 }));
      fx.burst(cx, list[0].y - 4, { count: 10, color: ['#2a8a6a', '#48f3a0'], speed: 60, size: 12, endSize: 26, life: 1, shape: 'smoke', alpha: 0.35, flatY: 0.3 });
      B.later(0.28, () => {
        B.flash(C, 0.25); B.shake(0.8); B.stop(0.07);
        for (const e of foes()) {
          const [x, y] = B.center(e);
          fx.flare(x, y, { size: 26, color: C, dur: 0.3 });
          fx.burst(x, y, { count: 10, color: [C, W, A], speed: 160, size: 5, life: 0.5, shape: 'glow' });
          soulTo(B, x, y, u, C);
        }
        all(M.ult.mult);
        if (M.ult.heal) B.heal(u, M.ult.heal);
        sfx('thunder');
      });
      break;
    }
    default: break;
  }
}

// grand « Z » du Chat Botté : tracé qui se dessine, étincelle en tête
function drawZ(fx, x, y, C, A) {
  const P = [-24, -20, 24, -20, -24, 20, 24, 20];
  const fl = sprite(A, 'flare');
  fx.custom(0.6, (ctx, k) => {
    const a = k < 0.2 ? 1 : 1 - (k - 0.2) / 0.8;
    const segs = Math.min(1, k * 3.2) * 3;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(x, y);
    let hx = P[0], hy = P[1];
    const path = () => {
      ctx.beginPath(); ctx.moveTo(P[0], P[1]);
      for (let s = 0; s < 3; s++) {
        const q = Math.max(0, Math.min(1, segs - s));
        if (q <= 0) break;
        hx = P[s * 2] + (P[s * 2 + 2] - P[s * 2]) * q; hy = P[s * 2 + 1] + (P[s * 2 + 3] - P[s * 2 + 1]) * q;
        ctx.lineTo(hx, hy);
      }
    };
    path(); ctx.lineWidth = 9; ctx.strokeStyle = ca(C, 0.85 * a); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 18; ctx.strokeStyle = ca(A, 0.25 * a); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = ca(A, 0.9 * a); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = ca(W, a); ctx.stroke();
    if (segs < 3) ctx.drawImage(fl, hx - 22, hy - 22, 44, 44);
    ctx.restore();
  });
}

function arrowDraw(col) {
  return (ctx, x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-18, -4); ctx.lineTo(-10, 0); ctx.lineTo(-18, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
}

// faux spectrale : manche, lame à trois couches, halo vert, traînée au sol
function drawGhostScythe(ctx, x, y, k, col, acc, f) {
  const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
  const ang = -2.2 + k * 3.4;
  ctx.save();
  ctx.translate(x - 30 * f, y); ctx.scale(f, 1); ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.4 * a; ctx.drawImage(sprite(col, 'soft'), 0, -130, 140, 120); ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = ca(acc, 0.6 * a); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(0, -70); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath(); ctx.moveTo(0, -70); ctx.quadraticCurveTo(70, -95, 120, -40); ctx.quadraticCurveTo(70, -70, 0, -58); ctx.closePath();
  ctx.fillStyle = ca('#0e6a4a', 0.7 * a); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const w = i === 0 ? 16 : i === 1 ? 7 : 2.5, al = i === 0 ? 0.25 : i === 1 ? 0.75 : 1;
    ctx.beginPath(); ctx.moveTo(0, -70); ctx.quadraticCurveTo(70, -95, 120, -40); ctx.quadraticCurveTo(70, -70, 0, -58);
    ctx.lineWidth = w; ctx.strokeStyle = ca(i === 2 ? W : col, al * a); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ell(ctx, x, y + 30, 120 * a, 26 * a); ctx.fillStyle = ca(col, 0.12 * a); ctx.fill();
  ctx.restore();
}

// âme qui vole d'un point vers le héros
export function soulTo(B, x, y, u, col = '#48f3a0') {
  const g = sprite(col, 'glow');
  B.fx.projectile([x, y], () => B.center(u), { dur: 0.6, arc: 50, ribbon: { color: col, width: 7, len: 10 }, draw: (ctx, px, py, a2, k) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const s = 11 + Math.sin(k * 30) * 1.5;
    ctx.drawImage(g, px - s, py - s, s * 2, s * 2);
    ctx.fillStyle = ca(W, 0.95); ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }, trail: { color: [col, W], size: 3.5, life: 0.35, every: 2 } });
}

// --------------------------------------------------------------- aura et sceau au sol
const AURA = {
  botte: { cols: ['#ffd23f', '#ffffff'], shape: 'star', rate: 3 },
  noir: { cols: ['#b968ff', '#48f3ff'], shape: 'star', rate: 5 },
  tigre: { cols: ['#ff7a1a', '#c4122c'], shape: 'glow', rate: 5 },
  ninja: { cols: ['#3a3646', '#6a6680'], shape: 'smoke', rate: 3 },
  siamois: { cols: ['#62d86b', '#c9ff7a'], shape: 'debris', rate: 2.5 },
  sphynx: { cols: ['#48f3a0', '#b9ffe0'], shape: 'glow', rate: 5 },
};
export function classAura(B, u, dt) {
  const M = u.mech; if (!M || u.dead || u.vanish > 0) return;
  const a = AURA[M.cls]; if (!a) return;
  if (Math.random() > dt * a.rate * (B.fx.low ? 0.5 : 1)) return;
  const [x, y] = B.center(u);
  const col = a.cols[Math.random() < 0.6 ? 0 : 1];
  if (a.shape === 'smoke') B.fx.emit(x - 10 * u.facing + (Math.random() - 0.5) * 30, u.y - 6, -20 * u.facing, -10, col, 8, 0.8, { shape: 'smoke', endSize: 18, drag: 1, alpha: 0.5 });
  else if (M.cls === 'tigre') B.fx.emit(x + (Math.random() - 0.5) * 40, u.y - Math.random() * 20, 0, -40 - Math.random() * 30, col, 3.5, 0.7, { drag: 0.5, shape: 'ember' });
  else if (M.cls === 'sphynx') { const t = B.time * 2 + Math.random() * TAU; B.fx.emit(x + Math.cos(t) * 30, y + Math.sin(t) * 22, 0, -25, col, 5, 0.7, { drag: 0.5 }); }
  else if (M.cls === 'siamois') B.fx.emit(x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 60, 0, -18, col, 4, 0.9, { shape: 'leaf', drag: 0.5, alpha: 0.85 });
  else B.fx.emit(x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 60, 0, -18, col, a.shape === 'star' ? 5 : 4, 0.9, { shape: a.shape, drag: 0.5, alpha: 0.85 });
}
// sceau sous les pieds du héros (couche arrière) ; cercles runiques pré-rendus
export function drawClassSigil(ctx, B, u) {
  const M = u.mech; if (!M || u.dead) return;
  const t = B.time;
  const x = u.x + (u.dash || 0) * u.facing, y = u.y + 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (M.cls === 'noir' || M.cls === 'sphynx') {
    const spr = runeSprite(M.color, M.cls === 'noir' ? M.accent : '#ffffff', 'rune');
    const r = M.cls === 'noir' ? 36 : 34;
    ctx.translate(x, y); ctx.scale(1, 0.32); ctx.rotate(M.cls === 'noir' ? t * 0.8 : -t * 0.6);
    ctx.globalAlpha = M.cls === 'noir' ? 0.55 : 0.4;
    ctx.drawImage(spr, -r, -r, r * 2, r * 2);
  } else {
    const pulse = 0.35 + Math.sin(t * 3) * 0.1;
    ctx.translate(x, y); ctx.scale(1, 0.3);
    ctx.strokeStyle = ca(M.color, pulse); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ca(M.accent, pulse * 0.8); ctx.lineWidth = 2;
    ctx.setLineDash(SIGIL_DASH); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
  ctx.restore();
}
const SIGIL_DASH = [8, 7], NO_DASH = [];

// --------------------------------------------------------------- marques sur les ennemis
export function drawMarks(ctx, B, e) {
  if (e.dead) return;
  const top = e.y - e.height - 14;
  let x = e.x - ((e.curse ? 1 : 0) + (e.poison ? 1 : 0) - 1) * 7;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
  if (e.curse) {
    glow(ctx, x, top, 9, '#b968ff', 0.7);
    ctx.fillStyle = '#e6d0ff'; ctx.fillText('☾' + e.curse, x, top + 4);
    x += 14;
  }
  if (e.poison) {
    glow(ctx, x, top, 9, '#62d86b', 0.7);
    ctx.fillStyle = '#d8ffd0'; ctx.fillText('☠' + e.poison, x, top + 4);
  }
  ctx.restore();
}
export function poisonFx(B, e) {
  const [x, y] = B.center(e);
  B.fx.emit(x + (Math.random() - 0.5) * 20, y, 0, 30, '#62d86b', 5, 0.5, { shape: 'bubble', drag: 0.5 });
  B.fx.emit(x + (Math.random() - 0.5) * 16, y - 6, 0, -30, '#3a8a3a', 6, 0.6, { shape: 'smoke', endSize: 12, drag: 1, alpha: 0.45 });
}
export function parryFx(B, u) {
  const [x, y] = B.center(u);
  const px = x + 18 * u.facing, py = y - 10;
  B.fx.burst(px, py, { count: 12, color: ['#ffffff', '#ffd23f'], speed: 240, size: 4.5, life: 0.3, shape: 'spark' });
  B.fx.slash(px - 2 * u.facing, py, { r: 22, color: '#ffd23f', under: '#e08a10', width: 8, angle: u.facing > 0 ? -0.3 : Math.PI + 0.3, arc: 2, dur: 0.16 });
  B.fx.flare(px, py, { size: 26, color: '#ffd23f', dur: 0.25, len: 2.4 });
  B.fx.shock(px, py, { r: 26, color: '#ffd23f', width: 4, dur: 0.22 });
  sfx('crit');
}
export function shieldFx(B, u, col) {
  const [x, y] = B.center(u);
  B.fx.ring(x, u.y, { r1: 60, color: col, width: 6, dur: 0.5 });
  B.fx.glyph(x, u.y, { style: 'hex', color: col, color2: '#ffffff', r: 40, dur: 0.7, spin: -2 });
  B.fx.flare(x, y - 10, { size: 30, color: col, dur: 0.35 });
  B.fx.burst(x, y, { count: 12, color: [col, '#ffffff'], speed: 120, size: 5, life: 0.5, shape: 'star' });
}
export function executeFx(B, e) {
  const [x, y] = B.center(e);
  B.fx.slash(x, y, { r: 36, color: '#48f3a0', under: '#0e6a4a', width: 14, angle: -0.9, arc: 2.8, dur: 0.26 });
  B.fx.flare(x, y, { size: 36, color: '#48f3a0', dur: 0.32, len: 2.6 });
  B.fx.burst(x, y, { count: 16, color: ['#48f3a0', '#ffffff'], speed: 220, size: 5, life: 0.4, shape: 'spark' });
}
