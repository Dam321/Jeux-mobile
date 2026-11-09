// Effets des classes : coups finaux signature, aura d'ambiance, sceau au sol, marques
// (malédiction, poison, âmes, parade, exécution). Tout passe par les primitives de fx.js.
import { rgba, ell, glow } from './draw.js';
import { sfx } from '../audio.js';

const TAU = Math.PI * 2;

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
    case 'botte': { // Estocade Royale : 4 bottes éclair, puis un grand Z doré
      sfx('slash');
      for (let i = 0; i < 4; i++) B.later(0.06 + i * 0.08, () => {
        const t = tg.dead ? foes()[0] : tg; if (!t) return;
        const [x, y] = B.center(t);
        fx.beam(hx + 14 * f, hy - 4 + (i - 1.5) * 5, x + 26 * f, y + (i - 1.5) * 7, { color: i % 2 ? A : C, width: 5, dur: 0.16 });
        fx.burst(x, y, { count: 8, color: [A, '#ffffff'], speed: 200, size: 5, life: 0.25, shape: 'spark' });
        hitFn(t, M.ult.mult / 5);
      });
      B.later(0.42, () => {
        const t = tg.dead ? foes()[0] : tg; if (!t) return;
        const [x, y] = B.center(t);
        // le « Z » du Chat Botté
        fx.custom(0.55, (ctx, k) => {
          const a = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
          const p = Math.min(1, k * 3);
          const pts = [[-22, -20], [22, -20], [-22, 20], [22, 20]];
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.translate(x, y);
          for (const [w, c, al] of [[16, A, 0.3], [7, A, 0.9], [2.5, '#ffffff', 1]]) {
            ctx.beginPath();
            const segs = 3 * p;
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let s = 0; s < 3; s++) {
              const q = Math.max(0, Math.min(1, segs - s));
              if (q <= 0) break;
              ctx.lineTo(pts[s][0] + (pts[s + 1][0] - pts[s][0]) * q, pts[s][1] + (pts[s + 1][1] - pts[s][1]) * q);
            }
            ctx.lineWidth = w; ctx.strokeStyle = rgba(c, al * a); ctx.stroke();
          }
          ctx.restore();
        });
        B.shake(0.5); B.stop(0.06);
        fx.burst(x, y, { count: 26, color: [A, C, '#ffffff'], speed: 260, size: 7, life: 0.5, shape: 'star' });
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
      fx.custom(1.0, (ctx, k) => drawRuneCircle(ctx, cx, gy, 70 + k * 20, k * 2.2, C, A, k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.7) / 0.3)), 'back');
      B.later(0.35, () => {
        B.flash(C, 0.3); B.shake(0.7);
        for (const e of foes()) {
          fx.pillar(e.x, { color: C, width: 26, dur: 0.6, y: e.y });
          fx.lightning(e.x + (Math.random() - 0.5) * 20, -10, e.x, e.y - e.height * 0.5, { color: A, dur: 0.3 });
          fx.burst(e.x, e.y - e.height * 0.5, { count: 14, color: [C, A, '#ffffff'], speed: 180, size: 7, life: 0.5, shape: 'star' });
        }
        all(M.ult.mult);
        sfx('thunder');
      });
      break;
    }
    case 'tigre': { // Rugissement Sanglant : bond, impact au sol, onde de choc rouge, soin
      sfx('whoosh');
      const t0 = foes()[0]; if (!t0) return;
      B.later(0.12, () => { const [x, y] = B.center(u); fx.burst(x, y - 20, { count: 10, color: ['#ffffff', '#ffd6a0'], speed: 90, size: 14, endSize: 26, life: 0.5, shape: 'smoke' }); });
      B.later(0.3, () => {
        const gx = t0.dead ? (foes()[0] || t0).x : t0.x, gy = t0.y;
        B.shake(1.3); B.stop(0.09); B.flash(A, 0.35);
        fx.ring(gx, gy, { r1: 150, color: C, width: 10, dur: 0.5 });
        fx.ring(gx, gy, { r1: 90, color: A, width: 7, dur: 0.4 });
        fx.blast(gx, gy - 20, { r: 80, color: C });
        fx.burst(gx, gy - 6, { count: 30, color: ['#8a5a3a', '#c9a27a', C], speed: 260, up: 160, size: 7, life: 0.8, shape: 'debris', gravity: 600 });
        for (let i = 0; i < 6; i++) fx.emit(gx + (Math.random() - 0.5) * 120, gy, 0, -60 - Math.random() * 60, A, 10, 0.6, { shape: 'smoke', endSize: 24, drag: 1 });
        all(M.ult.mult);
        if (M.ult.heal) B.heal(u, M.ult.heal);
        sfx('thunder');
      });
      break;
    }
    case 'ninja': { // Danse des Mille Lames : écran de fumée, entailles sur chaque ennemi, réapparition
      sfx('whoosh');
      const [x0, y0] = B.center(u);
      fx.burst(x0, y0, { count: 18, color: ['#3a3646', '#6a6680'], speed: 120, size: 16, endSize: 30, life: 0.6, shape: 'smoke' });
      u.vanish = 0.55;
      const list = foes();
      list.slice(0, 6).forEach((e, i) => {
        for (let j = 0; j < 3; j++) B.later(0.1 + i * 0.07 + j * 0.05, () => {
          if (e.dead) return;
          const [x, y] = B.center(e);
          fx.slash(x, y, { r: 26 + j * 4, color: j === 2 ? C : '#ffffff', width: 9, angle: -1.6 + j * 1.2 + Math.random() * 0.4, arc: 2.6, dur: 0.18, squash: 0.6 });
          fx.burst(x, y, { count: 6, color: [C, '#ffffff'], speed: 180, size: 4, life: 0.25, shape: 'spark' });
          hitFn(e, M.ult.mult / 3);
        });
      });
      B.later(0.5, () => { const [x, y] = B.center(u); fx.burst(x, y, { count: 12, color: ['#3a3646', '#6a6680'], speed: 90, size: 14, endSize: 24, life: 0.4, shape: 'smoke' }); sfx('crit'); });
      break;
    }
    case 'siamois': { // Pluie de Flèches : volée en cloche qui retombe sur tout le groupe
      sfx('whoosh');
      const list = foes();
      if (!list.length) return;
      const [hx2, hy2] = B.hand(u);
      for (let i = 0; i < 5; i++) B.later(i * 0.05, () => fx.projectile([hx2, hy2], [hx2 + 40 * f + i * 6, -30], { dur: 0.22, arc: 0, draw: arrowDraw(A) }));
      for (let i = 0; i < 14; i++) B.later(0.35 + i * 0.035, () => {
        const ls = foes(); if (!ls.length) return;
        const e = ls[i % ls.length];
        const tx = e.x + (Math.random() - 0.5) * 34;
        fx.projectile([tx - 50 * f, -20], [tx, e.y - 6 - Math.random() * 20], { dur: 0.2, arc: 0, draw: arrowDraw(i % 3 ? '#ffffff' : A), onHit: (x, y) => fx.burst(x, y, { count: 5, color: [C, '#ffffff'], speed: 120, size: 4, life: 0.25, shape: 'spark' }) });
      });
      B.later(0.6, () => { all(M.ult.mult); B.shake(0.5); sfx('crit'); });
      break;
    }
    case 'sphynx': { // Moisson des Âmes : faux spectrale géante qui balaie la ligne
      sfx('slash');
      const list = foes(); if (!list.length) return;
      let cx = 0; for (const e of list) cx += e.x; cx /= list.length;
      const cy = list[0].y - 50;
      fx.custom(0.6, (ctx, k) => drawGhostScythe(ctx, cx, cy, k, C, f), 'front');
      B.later(0.28, () => {
        B.flash(C, 0.3); B.shake(0.8); B.stop(0.07);
        for (const e of foes()) {
          const [x, y] = B.center(e);
          fx.burst(x, y, { count: 12, color: [C, '#ffffff', A], speed: 160, size: 6, life: 0.5, shape: 'glow' });
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

function arrowDraw(col) {
  return (ctx, x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-18, -4); ctx.lineTo(-10, 0); ctx.lineTo(-18, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
}

function drawRuneCircle(ctx, x, y, r, rot, c1, c2, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y); ctx.scale(1, 0.32);
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(c1, 0.85 * a);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(c2, 0.7 * a);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) { const t = (i * 2 * TAU) / 5; const px = Math.cos(t) * r * 0.78, py = Math.sin(t) * r * 0.78; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.strokeStyle = rgba(c1, 0.75 * a); ctx.lineWidth = 2.5; ctx.stroke();
  for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU; ctx.fillStyle = rgba(c2, 0.9 * a); ctx.fillRect(Math.cos(t) * r * 0.89 - 3, Math.sin(t) * r * 0.89 - 3, 6, 6); }
  ctx.restore();
}

function drawGhostScythe(ctx, x, y, k, col, f) {
  const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
  const ang = -2.2 + k * 3.4;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x - 30 * f, y); ctx.scale(f, 1); ctx.rotate(ang);
  // manche
  ctx.strokeStyle = rgba(col, 0.55 * a); ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(0, -70); ctx.stroke();
  // lame
  for (const [w, al] of [[18, 0.25], [9, 0.7], [3, 1]]) {
    ctx.beginPath(); ctx.moveTo(0, -70); ctx.quadraticCurveTo(70, -95, 120, -40); ctx.quadraticCurveTo(70, -70, 0, -58);
    ctx.lineWidth = w; ctx.strokeStyle = rgba(w === 3 ? '#ffffff' : col, al * a); ctx.stroke();
  }
  ctx.restore();
  // traînée
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ell(ctx, x, y + 30, 120 * a, 26 * a); ctx.fillStyle = rgba(col, 0.12 * a); ctx.fill();
  ctx.restore();
}

// âme qui vole d'un point vers le héros
export function soulTo(B, x, y, u, col = '#48f3a0') {
  B.fx.projectile([x, y], () => B.center(u), { dur: 0.6, arc: 50, draw: (ctx, px, py, a2, k) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, px, py, 12, col, 0.9);
    ctx.fillStyle = rgba('#ffffff', 0.9); ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }, trail: { color: [col, '#ffffff'], size: 6, life: 0.35 } });
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
  else if (M.cls === 'tigre') B.fx.emit(x + (Math.random() - 0.5) * 40, u.y - Math.random() * 20, 0, -40 - Math.random() * 30, col, 4, 0.7, { drag: 0.5 });
  else if (M.cls === 'sphynx') { const t = B.time * 2 + Math.random() * TAU; B.fx.emit(x + Math.cos(t) * 30, y + Math.sin(t) * 22, 0, -25, col, 5, 0.7, { drag: 0.5 }); }
  else B.fx.emit(x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 60, 0, -18, col, a.shape === 'star' ? 5 : 4, 0.9, { shape: a.shape, drag: 0.5, alpha: 0.85 });
}
// sceau sous les pieds du héros (couche arrière)
export function drawClassSigil(ctx, B, u) {
  const M = u.mech; if (!M || u.dead) return;
  const t = B.time;
  const x = u.x + (u.dash || 0) * u.facing, y = u.y + 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (M.cls === 'noir') drawRuneCircle(ctx, x, y, 36, t * 0.8, M.color, M.accent, 0.55);
  else if (M.cls === 'sphynx') { drawRuneCircle(ctx, x, y, 34, -t * 0.6, M.color, '#ffffff', 0.4); }
  else {
    const pulse = 0.35 + Math.sin(t * 3) * 0.1;
    ctx.translate(x, y); ctx.scale(1, 0.3);
    ctx.strokeStyle = rgba(M.color, pulse); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(M.accent, pulse * 0.8); ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

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
}
export function parryFx(B, u) {
  const [x, y] = B.center(u);
  B.fx.burst(x + 18 * u.facing, y - 10, { count: 14, color: ['#ffffff', '#ffd23f'], speed: 220, size: 5, life: 0.3, shape: 'spark' });
  B.fx.slash(x + 16 * u.facing, y - 10, { r: 22, color: '#ffd23f', width: 8, angle: u.facing > 0 ? -0.3 : Math.PI + 0.3, arc: 2, dur: 0.16 });
  sfx('crit');
}
export function shieldFx(B, u, col) {
  const [x, y] = B.center(u);
  B.fx.ring(x, u.y, { r1: 60, color: col, width: 6, dur: 0.5 });
  B.fx.burst(x, y, { count: 16, color: [col, '#ffffff'], speed: 120, size: 6, life: 0.5, shape: 'star' });
}
export function executeFx(B, e) {
  const [x, y] = B.center(e);
  B.fx.slash(x, y, { r: 34, color: '#48f3a0', width: 14, angle: -0.9, arc: 2.8, dur: 0.25 });
  B.fx.burst(x, y, { count: 20, color: ['#48f3a0', '#ffffff'], speed: 220, size: 6, life: 0.4, shape: 'spark' });
}
