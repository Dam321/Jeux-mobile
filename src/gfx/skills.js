// =====================================================================
//  Effets d'attaques : armes (5 styles), pouvoirs (12), chatons (8 éléments),
//  ennemis. B = instance du combat (voir battle.js) qui fournit :
//  fx, foes(u), hit(att, tgt, mult, o), heal(u,pct), shield(u,pct), buff(u,v,d), later(t,fn),
//  shake(a), flash(c,a), zoom(z,x,y), stop(t), say(u,txt,style), center(u), head(u), hand(u), cutin(u,sk)
// =====================================================================
import { rgba, ell, OUT } from './draw.js';
import { RCOL } from './gear.js';
import { ELEMENTS } from '../content.js';
import { sfx } from '../audio.js';

const TAU = Math.PI * 2;

function drawOrb(color, r = 6) {
  return (ctx, x, y) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, rgba('#ffffff', 1)); g.addColorStop(0.3, rgba(color, 0.95)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  };
}
function drawArrow(color) {
  return (ctx, x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#6b3a1e'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = '#e8edf5'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(-20, -3, 6, 2); ctx.fillRect(-20, 1, 6, 2);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(color, 0.5); ctx.fillRect(-26, -2, 30, 4);
    ctx.restore();
  };
}
function drawYarn(color, r) {
  return (ctx, x, y, a, k) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(k * 14);
    ctx.fillStyle = color; ctx.strokeStyle = '#2b1838'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.35, i * 0.8, 0, TAU); ctx.stroke(); }
    ctx.restore();
  };
}
function drawFish(ctx, x, y, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#9fc6e8'; ctx.strokeStyle = '#2b1838'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -5); ctx.lineTo(-14, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1d1530'; ctx.beginPath(); ctx.arc(4.5, -1, 1.2, 0, TAU); ctx.fill();
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
    B.later(0.12, () => fx.projectile([hx, hy], tc, { dur: 0.22, arc: 8, draw: drawArrow(col), trail: { color: col, size: 6, life: 0.2 }, onHit: (x, y) => { onImpact(); fx.burst(x, y, { count: 10, color: [col, '#ffffff'], speed: 160, size: 7, life: 0.3, shape: 'spark' }); } }));
  } else if (style === 'magic') {
    sfx('laser');
    B.later(0.12, () => fx.projectile([hx, hy - 40], tc, { dur: 0.3, arc: 24, draw: drawOrb(col, 7), trail: { color: col, size: 9, life: 0.3, shape: 'star' }, onHit: (x, y) => { onImpact(); fx.blast(x, y, { r: 34, color: col, dur: 0.3 }); fx.burst(x, y, { count: 14, color: [col, '#ffffff'], speed: 140, size: 8, life: 0.4, shape: 'star' }); } }));
  } else if (style === 'pierce') {
    B.later(0.14, () => { const [x, y] = tc(); fx.beam(hx + 20 * u.facing, hy, x, y, { color: '#5fc8ff', width: 7, dur: 0.22 }); onImpact(); fx.burst(x, y, { count: 12, color: ['#bff4ff', '#5fc8ff'], speed: 130, size: 8, life: 0.4, shape: 'bubble' }); sfx('hit'); });
  } else if (style === 'smash') {
    B.later(0.2, () => { const [x] = tc(); const gy = tg.y; onImpact(); fx.ring(x, gy, { r1: 56, color: col, width: 7, dur: 0.4 }); fx.burst(x, gy - 6, { count: 14, color: ['#c9a27a', '#8a6a4a'], speed: 150, size: 5, life: 0.5, gravity: 500, up: 120, shape: 'debris' }); B.shake(0.35); sfx('boom'); });
  } else {
    B.later(0.16, () => onImpact());
  }
}
// effet visuel d'un coup au corps à corps (appelé à l'impact)
export function meleeImpactFx(B, u, tg, crit) {
  const [x, y] = B.center(tg);
  const col = crit ? '#ffd23f' : (u.weaponColor || '#ffffff');
  B.fx.slash(x, y, { r: crit ? 40 : 32, color: col, width: crit ? 16 : 11, angle: -0.6 * u.facing - (u.facing < 0 ? Math.PI : 0) + 0.2, arc: 2.4, dur: 0.22, dir: 1 });
  B.fx.burst(x, y, { count: crit ? 18 : 8, color: crit ? ['#ffd23f', '#ffffff'] : [col, '#ffffff'], speed: crit ? 240 : 150, size: 6, life: 0.3, shape: 'spark' });
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
  const mid = () => { const ok = B.foes(u); if (!ok.length) return [cx + 120 * f, cy]; let x = 0, y = 0; for (const e of ok) { const c = B.center(e); x += c[0]; y += c[1]; } return [x / ok.length, y / ok.length]; };
  if (sk.r >= 4) B.cutin(u, sk);
  B.say(u, sk.name, 'name');
  switch (sk.id) {
    case 'slash': {
      sfx('slash');
      for (let i = 0; i < 3; i++) B.later(i * 0.1, () => {
        if (front.dead) return;
        const [x, y] = B.center(front);
        fx.slash(x, y, { r: 38, color: i === 1 ? '#7fe9ff' : '#ffffff', width: 14, angle: -1 + i * 0.9, arc: 2.6, dur: 0.24 });
        fx.burst(x, y, { count: 12, color: ['#7fe9ff', '#ffffff'], speed: 220, size: 6, life: 0.3, shape: 'spark' });
        B.hit(u, front, mult / 3, { skill: true }); sfx('hit');
      });
      break;
    }
    case 'furball': {
      sfx('whoosh');
      fx.projectile(head, () => B.center(front), { dur: 0.5, arc: 50, draw: drawYarn('#d9a066', 11), trail: { color: '#ffcf8a', size: 10, life: 0.35 }, onHit: (x, y) => {
        fx.blast(x, y, { r: 70, color: '#ff9d3c', dur: 0.45 });
        fx.ring(x, front.y, { r1: 80, color: '#ffb52e' });
        fx.burst(x, y, { count: 30, color: ['#ffcf8a', '#ff9d3c', '#ffffff'], speed: 260, size: 9, life: 0.6, gravity: 300 });
        if (!front.dead) B.hit(u, front, mult, { skill: true });
        B.shake(0.5); B.stop(0.05); sfx('boom');
      } });
      break;
    }
    case 'kibble': {
      for (let w = 0; w < 3; w++) B.later(w * 0.28, () => {
        for (const e of B.foes(u)) {
          for (let k = 0; k < 3; k++) {
            const [x, y] = B.center(e);
            const tx = x + (Math.random() - 0.5) * 30;
            fx.projectile([tx + (Math.random() - 0.5) * 60, -20], [tx, y], { dur: 0.32 + Math.random() * 0.12, arc: 0, draw: (ctx, px, py) => { ctx.fillStyle = '#b0713a'; ctx.strokeStyle = '#2b1838'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill(); ctx.stroke(); }, trail: { color: '#ffcf8a', size: 5, life: 0.2 }, onHit: (px, py) => fx.burst(px, py, { count: 5, color: '#d9a066', speed: 90, size: 5, life: 0.3, gravity: 400, shape: 'debris' }) });
          }
          B.later(0.42, () => { if (!e.dead) B.hit(u, e, mult / 3, { skill: true }); });
        }
        sfx('hit');
      });
      break;
    }
    case 'purrheal': {
      sfx('heal');
      B.heal(u, sk.heal * (1 + 0.05 * ((sk.lvl || 1) - 1)));
      fx.ring(u.x, u.y, { r1: 70, color: '#5dff9e', dur: 0.8 });
      fx.burst(cx, cy, { count: 36, color: ['#5dff9e', '#ff9fd8', '#ffffff'], speed: 60, up: 120, size: 9, life: 1.1, shape: 'star', spread: 40 });
      break;
    }
    case 'fish': {
      sfx('whoosh');
      const [mx0, my0] = mid();
      fx.custom(1.5, (ctx, k) => {
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + k * 16;
          const r = (34 + (i % 3) * 10) * (k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1);
          const x = mx0 + Math.cos(a) * r, y = my0 + 10 - k * 40 - (i % 4) * 9 + Math.sin(a) * r * 0.35;
          drawFish(ctx, x, y, a + Math.PI / 2);
        }
      }, 'front', () => { if (Math.random() < 0.6) fx.burst(mx0 + (Math.random() - 0.5) * 70, my0 - Math.random() * 60, { count: 2, color: ['#7fd8ff', '#ffffff'], speed: 60, size: 7, life: 0.4, shape: 'bubble' }); });
      for (let k = 0; k < (sk.hits || 5); k++) B.later(0.2 + k * 0.25, () => { for (const e of B.foes(u)) B.hit(u, e, mult / (sk.hits || 5), { skill: true }); sfx('hit'); });
      break;
    }
    case 'laser': {
      sfx('laser');
      B.flash('#ff2a55', 0.18);
      const ff = B.foes(u);
      const last = ff[ff.length - 1];
      for (const dy of [-3, 3]) {
        fx.beam(head[0], head[1] + dy, 0, 0, { color: '#ff2a55', width: 6, dur: 0.75, follow: (k) => { const a = B.center(front), b = B.center(last); return [a[0] + (b[0] - a[0]) * Math.min(1, k * 1.4), a[1] + (b[1] - a[1]) * Math.min(1, k * 1.4)]; } });
      }
      for (let k = 0; k < 4; k++) B.later(0.1 + k * 0.15, () => { for (const e of B.foes(u)) { const [x, y] = B.center(e); fx.burst(x, y, { count: 8, color: ['#ff2a55', '#ffb52e', '#ffffff'], speed: 160, size: 7, life: 0.35, up: 60 }); } });
      B.later(0.3, () => { for (const e of B.foes(u)) B.hit(u, e, mult, { skill: true }); B.shake(0.4); });
      break;
    }
    case 'shield': {
      sfx('heal');
      B.shield(u, sk.shield * (sk.lm || 1));
      fx.ring(u.x, u.y, { r1: 80, color: '#7fd8ff' });
      fx.burst(cx, cy, { count: 26, color: ['#7fd8ff', '#ffffff'], speed: 160, size: 8, life: 0.6, shape: 'star' });
      break;
    }
    case 'thunder': {
      B.flash('#cfefff', 0.45);
      B.shake(0.9);
      B.foes(u).forEach((e, i) => B.later(i * 0.08, () => {
        if (e.dead) return;
        const [x, y] = B.center(e);
        fx.lightning(x + (Math.random() - 0.5) * 50, -10, x, e.y - 4, { color: '#8fd9ff', dur: 0.4 });
        fx.lightning(x + (Math.random() - 0.5) * 50, -10, x, e.y - 4, { color: '#c77dff', dur: 0.3 });
        fx.blast(x, y, { r: 50, color: '#8fd9ff', dur: 0.35 });
        fx.ring(x, e.y, { r1: 60, color: '#8fd9ff' });
        fx.burst(x, y, { count: 22, color: ['#8fd9ff', '#ffffff'], speed: 280, size: 7, life: 0.4, shape: 'spark' });
        B.hit(u, e, mult, { skill: true }); B.stop(0.04);
        sfx('thunder');
      }));
      break;
    }
    case 'meteor': {
      const [mx0, my0] = mid();
      sfx('whoosh');
      const from = [mx0 + 160 * f, -60];
      fx.projectile(from, [mx0, my0], { dur: 0.75, arc: 0, draw: drawYarn('#ff5ca8', 26), trail: { color: ['#ff7a1a', '#ffd23f', '#ff5ca8'], size: 26, life: 0.45 }, onHit: (x, y) => {
        B.flash('#ffb066', 0.6); B.shake(1.4); B.zoom(1.12, x, y); B.stop(0.09);
        fx.blast(x, y, { r: 150, color: '#ff7a1a', dur: 0.7 });
        fx.ring(x, y + 30, { r1: 190, color: '#ffd23f', dur: 0.7, width: 10 });
        fx.ring(x, y, { r1: 120, color: '#ff5ca8', dur: 0.5, squash: 1, layer: 'front' });
        fx.burst(x, y, { count: 90, color: ['#ff7a1a', '#ffd23f', '#ff5ca8', '#ffffff'], speed: 420, size: 11, life: 0.9, gravity: 400, up: 100 });
        fx.burst(x, y + 20, { count: 30, color: ['#5a3a2a', '#8a5a3a'], speed: 300, size: 7, life: 0.9, gravity: 700, up: 200, shape: 'debris' });
        for (const e of B.foes(u)) B.hit(u, e, mult, { skill: true });
        sfx('boom');
      } });
      break;
    }
    case 'ninelives': {
      sfx('heal'); sfx('legendary');
      B.heal(u, sk.heal);
      B.buff(u, sk.buff, 6);
      fx.pillar(u.x, { color: '#ffd23f', width: 46, dur: 1.2, y: u.y });
      B.flash('#fff2b0', 0.4);
      fx.ring(u.x, u.y, { r1: 110, color: '#ffd23f', dur: 1 });
      fx.burst(cx, cy, { count: 70, color: ['#ffd23f', '#ffffff', '#ffb52e'], speed: 120, up: 180, size: 10, life: 1.3, shape: 'star', spread: 40 });
      B.say(u, 'NEUF VIES !', 'big');
      break;
    }
    case 'nova': {
      const [mx0, my0] = mid();
      fx.custom(0.7, null, 'front', () => {
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * TAU, r = 140 * Math.random() + 40;
          const x = mx0 + Math.cos(a) * r, y = my0 + Math.sin(a) * r * 0.6;
          fx.emit(x, y, (mx0 - x) * 2.2, (my0 - y) * 2.2, i % 2 ? '#c77dff' : '#ff7ae0', 9, 0.35, { shape: 'star', drag: 0 });
        }
      });
      sfx('laser');
      B.later(0.7, () => {
        sfx('boom'); B.flash('#d6a8ff', 0.65); B.shake(1.5); B.zoom(1.12, mx0, my0); B.stop(0.1);
        fx.blast(mx0, my0, { r: 170, color: '#c77dff', dur: 0.8 });
        fx.blast(mx0, my0, { r: 100, color: '#ff7ae0', dur: 0.6 });
        fx.ring(mx0, my0 + 40, { r1: 220, color: '#c77dff', dur: 0.8, width: 10 });
        fx.ring(mx0, my0, { r1: 150, color: '#ffffff', dur: 0.5, squash: 1, layer: 'front' });
        fx.burst(mx0, my0, { count: 110, color: ['#c77dff', '#ff7ae0', '#7fd8ff', '#ffffff'], speed: 460, size: 10, life: 1, shape: 'star' });
        for (const e of B.foes(u)) B.hit(u, e, mult, { skill: true });
      });
      break;
    }
    case 'tiger': {
      const [mx0, my0] = mid();
      for (let k = 0; k < (sk.hits || 2); k++) B.later(k * 0.28, () => {
        sfx('slash'); B.shake(1); B.stop(0.05);
        for (let i = 0; i < 3; i++) fx.slash(mx0 + (i - 1) * 24, my0 - 10, { r: 90, color: k ? '#48f3ff' : '#ffd23f', width: 22, angle: k ? -2.2 : -0.9, arc: 2.2, dur: 0.32 });
        fx.burst(mx0, my0, { count: 40, color: ['#ffd23f', '#48f3ff', '#ffffff'], speed: 360, size: 8, life: 0.5, shape: 'spark' });
        for (const e of B.foes(u)) B.hit(u, e, mult / (sk.hits || 2), { skill: true });
      });
      break;
    }
    default: break;
  }
  return true;
}

// ------------------------------------------------------------------ formes de projectiles
function drawShape(ctx, shape, x, y, a, sz, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const lc = col;
  switch (shape) {
    case 'flame': case 'darkflame': {
      const c1 = shape === 'darkflame' ? '#8a3cff' : '#ff7a1a', c2 = shape === 'darkflame' ? '#1d1030' : '#ffd23f';
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 2);
      g.addColorStop(0, rgba('#ffffff', 0.95)); g.addColorStop(0.35, rgba(c2, 0.9)); g.addColorStop(0.7, rgba(c1, 0.6)); g.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sz * 2, 0); ctx.quadraticCurveTo(0, -sz * 1.4, -sz * 2.4, 0); ctx.quadraticCurveTo(0, sz * 1.4, sz * 2, 0); ctx.fill();
      break;
    }
    case 'leaf': ctx.fillStyle = '#5fd068'; ctx.strokeStyle = '#1d5a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.4, sz * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-sz * 1.3, 0); ctx.lineTo(sz * 1.3, 0); ctx.stroke(); break;
    case 'shard': ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#bff4ff', 0.95); ctx.beginPath(); ctx.moveTo(sz * 1.8, 0); ctx.lineTo(-sz * 0.8, -sz * 0.6); ctx.lineTo(-sz * 0.4, 0); ctx.lineTo(-sz * 0.8, sz * 0.6); ctx.closePath(); ctx.fill(); break;
    case 'bolt': ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#ffe14d', 1); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-sz * 1.4, -sz * 0.4); ctx.lineTo(0, sz * 0.4); ctx.lineTo(-sz * 0.2, -sz * 0.4); ctx.lineTo(sz * 1.4, sz * 0.4); ctx.stroke(); break;
    case 'seed': ctx.fillStyle = '#a0602a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.75, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#62d86b'; ctx.beginPath(); ctx.ellipse(-sz * 0.6, -sz * 0.6, sz * 0.5, sz * 0.25, -0.6, 0, TAU); ctx.fill(); break;
    case 'fish': drawFish(ctx, 0, 0, 0); break;
    case 'shuriken': ctx.rotate(Date.now() / 60); ctx.fillStyle = '#c9cbd8'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * 0.4 : sz * 1.4; const an = (i / 8) * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'heart': ctx.fillStyle = '#ff5ca8'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, sz); ctx.bezierCurveTo(-sz * 1.6, -sz * 0.2, -sz * 0.6, -sz * 1.4, 0, -sz * 0.4); ctx.bezierCurveTo(sz * 0.6, -sz * 1.4, sz * 1.6, -sz * 0.2, 0, sz); ctx.fill(); ctx.stroke(); break;
    case 'cannon': ctx.fillStyle = '#2a2340'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, sz * 1.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-sz * 0.4, -sz * 0.4, sz * 0.3, 0, TAU); ctx.fill(); break;
    case 'claw': ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(lc, 0.95); ctx.lineWidth = 2.2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(-sz, i * sz * 0.5, sz * 1.6, -0.6, 0.6); ctx.stroke(); } break;
    case 'ankh': ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#ffd54f', 1); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, -sz * 0.7, sz * 0.5, sz * 0.6, 0, 0, TAU); ctx.moveTo(0, -sz * 0.1); ctx.lineTo(0, sz * 1.4); ctx.moveTo(-sz * 0.8, sz * 0.3); ctx.lineTo(sz * 0.8, sz * 0.3); ctx.stroke(); break;
    case 'rainbow': case 'star': default: {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 2.2);
      g.addColorStop(0, rgba('#ffffff', 1)); g.addColorStop(0.3, rgba(lc, 0.95)); g.addColorStop(1, rgba(lc, 0));
      ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? sz * 0.6 : sz * 2; const an = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ attaques des chatons (une attaque unique par chaton)
export function kittenAttack(B, k, tg, mult, ult) {
  const fx = B.fx;
  const A = k.atk || { pattern: 'orb', shape: 'star', n: 1 };
  const col = ELEMENTS[k.el] ? ELEMENTS[k.el].color : '#ffffff';
  const owner = k.owner;
  const kd = 1 + ((owner.stats && owner.stats.kitDmg) || 0) / 100;
  const dmg = mult * kd * (ult ? 3 : 1);
  const big = ult ? 2 : 1;
  const [x0, y0] = B.head(k);
  const tc = () => B.center(tg);
  const n = Math.max(1, A.n || 1) * (ult ? 2 : 1);
  const sz = (k.r >= 5 ? 5 : 4) * big;
  const hitOnce = (x, y, part = 1) => {
    if (!tg.dead) B.hit(owner, tg, dmg * part, { pet: true });
    fx.burst(x, y, { count: ult ? 24 : 8, color: [col, '#ffffff'], speed: 140 * big, size: 6 * big, life: 0.35, shape: k.el === 'water' ? 'bubble' : (k.el === 'light' || k.el === 'cosmic') ? 'star' : 'glow' });
  };
  if (ult) { B.say(k, A.name + ' !', 'tag'); sfx('legendary'); B.shake(0.5); }
  const draw = (ctx, x, y, a) => drawShape(ctx, A.shape, x, y, a, sz, col);
  const trail = { color: [col, '#ffffff'], size: 6 * big, life: 0.28, shape: A.shape === 'star' ? 'star' : 'glow' };
  switch (A.pattern) {
    case 'multi':
      for (let i = 0; i < n; i++) B.later(i * 0.06, () => fx.projectile([x0, y0], tc, { dur: 0.32 + i * 0.02, arc: 10 + i * 9, draw, trail, onHit: (x, y) => hitOnce(x, y, 1 / n) }));
      break;
    case 'rain':
      for (let i = 0; i < n; i++) B.later(i * 0.08, () => { const [x, y] = tc(); const tx = x + (Math.random() - 0.5) * 34; fx.projectile([tx + 40, -10], [tx, y + (Math.random() - 0.5) * 16], { dur: 0.32, arc: 0, draw, trail, onHit: (px, py) => hitOnce(px, py, 1 / n) }); });
      break;
    case 'beam':
      B.later(0.05, () => { const [x, y] = tc(); fx.beam(x0, y0, x, y, { color: A.shape === 'rainbow' ? '#ff7ae0' : col, width: 4 * big, dur: 0.35 }); if (A.shape === 'rainbow') fx.beam(x0, y0 + 2, x, y + 2, { color: '#48f3ff', width: 2.5 * big, dur: 0.35 }); hitOnce(x, y); sfx('laser'); });
      break;
    case 'chain': {
      const foes = B.foes(owner).slice(0, n);
      let px = x0, py = y0;
      foes.forEach((e, i) => B.later(i * 0.07, () => { const [x, y] = B.center(e); fx.lightning(px, py, x, y, { color: col, dur: 0.25 }); px = x; py = y; if (!e.dead) B.hit(owner, e, dmg / Math.sqrt(foes.length), { pet: true }); fx.burst(x, y, { count: 8, color: [col, '#ffffff'], speed: 160, size: 5, life: 0.3, shape: 'spark' }); }));
      sfx('thunder');
      break;
    }
    case 'nova':
      B.later(0.1, () => { const [x, y] = tc(); fx.blast(x, y, { r: 40 * big, color: col, dur: 0.4 }); fx.ring(x, tg.y, { r1: 60 * big, color: col }); for (const e of B.foes(owner)) if (Math.abs(B.center(e)[0] - x) < 70 * big && !e.dead) B.hit(owner, e, dmg * 0.7, { pet: true }); fx.burst(x, y, { count: 18 * big, color: [col, '#ffffff'], speed: 200, size: 7, life: 0.5, shape: 'star' }); });
      break;
    case 'dash': {
      const [tx, ty] = tc();
      const sx = k.x;
      fx.custom(0.22, (ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(col, 0.7 * (1 - q)); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx, ty); ctx.lineTo(sx + (tx - sx) * Math.min(1, q * 2), ty); ctx.stroke(); ctx.restore(); });
      for (let i = 0; i < n; i++) B.later(0.12 + i * 0.07, () => { fx.slash(tx, ty, { r: 18 * big, color: col, width: 8, angle: -1 + i, arc: 2.2, dur: 0.18 }); hitOnce(tx, ty, 1 / n); sfx('slash'); });
      break;
    }
    case 'spiral':
      for (let i = 0; i < n; i++) B.later(i * 0.05, () => { const off = (i - (n - 1) / 2) * 0.5; fx.projectile([x0, y0], tc, { dur: 0.4, arc: 30 * Math.sin(off * 2) + 5, draw, trail, onHit: (x, y) => hitOnce(x, y, 1 / n) }); });
      break;
    case 'meteor':
      for (let i = 0; i < n; i++) B.later(i * 0.14, () => { const [x, y] = tc(); fx.projectile([x + 70, -30], [x + (i - 1) * 10, y], { dur: 0.42, arc: 0, draw: (ctx, px, py, a) => drawShape(ctx, A.shape, px, py, a, sz * 1.6, col), trail: { color: [col, '#ffd23f', '#ffffff'], size: 10 * big, life: 0.4 }, onHit: (px, py) => { fx.blast(px, py, { r: 34 * big, color: col }); B.shake(0.3); hitOnce(px, py, 1 / n); } }); });
      break;
    case 'pillar':
      for (let i = 0; i < n; i++) B.later(0.08 + i * 0.12, () => { const foes = B.foes(owner); const e = foes[i % Math.max(1, foes.length)] || tg; const [x, y] = B.center(e); fx.pillar(x, { color: col, width: 14 * big, dur: 0.45, y: e.y }); if (A.shape === 'bolt') fx.lightning(x, -10, x, e.y - 4, { color: col }); if (!e.dead) B.hit(owner, e, dmg / n, { pet: true }); fx.burst(x, y, { count: 10, color: [col, '#ffffff'], speed: 120, up: 80, size: 6, life: 0.4, shape: 'star' }); });
      break;
    case 'wave':
      B.later(0.05, () => { const [, y] = tc(); const sx = k.x, ex = Math.min(B.viewW, B.center(tg)[0] + 60); fx.custom(0.55, (ctx, q) => { const x = sx + (ex - sx) * q; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x - 30, 0, x + 6, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, 0.75 * (1 - q * 0.6))); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 40, y + 26); ctx.quadraticCurveTo(x - 10, y - 30 * big, x + 8, y + 26); ctx.fill(); ctx.restore(); if (Math.random() < 0.5) drawShape(ctx, A.shape, x, y - 10, 0, sz * 0.7, col); }); for (const e of B.foes(owner)) B.later(0.25, () => { if (!e.dead) B.hit(owner, e, dmg * 0.6, { pet: true }); }); });
      break;
    case 'boomerang': {
      const from = [x0, y0];
      fx.projectile(from, tc, { dur: 0.3, arc: -20, draw: (ctx, x, y, a, q) => drawShape(ctx, A.shape, x, y, q * 20, sz * 1.3, col), trail, onHit: (x, y) => { hitOnce(x, y, 0.6); fx.projectile([x, y], () => B.head(k), { dur: 0.3, arc: 20, draw: (ctx, px, py, a, q) => drawShape(ctx, A.shape, px, py, q * 20, sz * 1.3, col), trail, onHit: () => {} }); B.later(0.15, () => { if (!tg.dead) B.hit(owner, tg, dmg * 0.4, { pet: true }); }); } });
      break;
    }
    case 'orbit': {
      const t0 = B.time;
      fx.custom(0.6, (ctx, q) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + q * 12; drawShape(ctx, A.shape, k.x + Math.cos(a) * 18, k.y - 24 + Math.sin(a) * 8, a, sz * 0.8, col); } });
      for (let i = 0; i < n; i++) B.later(0.6 + i * 0.05, () => fx.projectile([k.x + Math.cos(i) * 18, k.y - 24], tc, { dur: 0.3, arc: 12, draw, trail, onHit: (x, y) => hitOnce(x, y, 1 / n) }));
      break;
    }
    case 'spikes':
      for (let i = 0; i < n; i++) B.later(0.1 + i * 0.08, () => { const [x] = tc(); const px = x + (i - (n - 1) / 2) * 12; fx.custom(0.45, (ctx, q) => { const hgt = Math.sin(Math.min(1, q * 2.5) * Math.PI / 2) * 26 * big * (1 - Math.max(0, q - 0.7) / 0.3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#bff4ff', 0.9); ctx.beginPath(); ctx.moveTo(px - 5, tg.y); ctx.lineTo(px, tg.y - hgt); ctx.lineTo(px + 5, tg.y); ctx.fill(); ctx.restore(); }); if (i === 0) B.later(0.1, () => hitOnce(x, B.center(tg)[1])); });
      break;
    case 'breath':
      fx.custom(0.6, null, 'front', () => { const [x, y] = tc(); for (let i = 0; i < 3; i++) { const t = Math.random(); fx.emit(x0, y0, (x - x0) * (1.6 + Math.random()), (y - y0) * 1.6 + (Math.random() - 0.5) * 80, Math.random() < 0.5 ? col : '#ffd23f', 9 * big, 0.45, { drag: 1.5 }); } });
      for (let i = 0; i < 4; i++) B.later(0.15 + i * 0.12, () => { const [x, y] = tc(); hitOnce(x, y, 0.25); });
      sfx('whoosh');
      break;
    default:
      fx.projectile([x0, y0], tc, { dur: 0.36, arc: 22, draw: (ctx, x, y, a) => drawShape(ctx, A.shape, x, y, a, sz * 1.2, col), trail, onHit: (x, y) => { hitOnce(x, y); if (A.shape === 'bubble' || A.shape === 'seed' || A.shape === 'cannon') { fx.blast(x, y, { r: 28 * big, color: col, dur: 0.3 }); B.shake(0.2); } } });
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
  if (style === 'arrow') {
    for (let i = 0; i < 6; i++) B.later(0.1 + i * 0.05, () => { const [x, y] = tc(); const tx = x + (Math.random() - 0.5) * 40; fx.projectile([tx - 60, -20], [tx, y + 6], { dur: 0.25, arc: 0, draw: (ctx, px, py, a) => drawShape(ctx, 'shard', px, py, a, 5, col), trail: { color: col, size: 6, life: 0.2 }, onHit: (px, py) => { fx.burst(px, py, { count: 6, color: [col, '#ffffff'], speed: 120, size: 5, life: 0.25, shape: 'spark' }); if (i === 5) { onHit(tg); B.shake(0.4); } } }); });
  } else if (style === 'magic') {
    B.later(0.15, () => { const [x, y] = tc(); fx.projectile(B.hand(u), [x, y], { dur: 0.35, arc: 40, draw: (ctx, px, py, a) => drawShape(ctx, 'star', px, py, a, 9, col), trail: { color: [col, '#ffffff'], size: 12, life: 0.4, shape: 'star' }, onHit: (px, py) => { fx.blast(px, py, { r: 70, color: col, dur: 0.45 }); fx.ring(px, tg.y, { r1: 80, color: col }); B.shake(0.6); B.stop(0.05); onHit(tg); for (const e of B.foes(u)) if (e !== tg && Math.abs(B.center(e)[0] - px) < 60) B.hit(u, e, 1, {}); sfx('boom'); } }); });
  } else if (style === 'smash') {
    B.later(0.2, () => { const [x] = tc(); fx.ring(x, tg.y, { r1: 110, color: col, width: 9 }); fx.ring(x, tg.y, { r1: 60, color: '#ffffff', width: 5, dur: 0.3 }); fx.burst(x, tg.y - 6, { count: 30, color: ['#c9a27a', '#8a6a4a', '#ffffff'], speed: 260, size: 6, life: 0.6, gravity: 600, up: 200, shape: 'debris' }); B.shake(1); B.stop(0.07); onHit(tg); for (const e of B.foes(u)) if (e !== tg) B.hit(u, e, 1.2, {}); sfx('boom'); });
  } else if (style === 'pierce') {
    for (let i = 0; i < 3; i++) B.later(0.1 + i * 0.1, () => { const [x, y] = tc(); const [hx, hy] = B.hand(u); fx.beam(hx, hy, x + 30, y + (i - 1) * 6, { color: '#5fc8ff', width: 6, dur: 0.2 }); fx.burst(x, y, { count: 10, color: ['#bff4ff', '#5fc8ff'], speed: 150, size: 7, life: 0.35, shape: 'bubble' }); if (i === 2) { onHit(tg); B.shake(0.4); } });
  } else {
    for (let i = 0; i < 3; i++) B.later(0.08 + i * 0.09, () => { const [x, y] = tc(); fx.slash(x, y, { r: 30 + i * 6, color: i === 2 ? '#ffd23f' : col, width: 12 + i * 3, angle: -1.4 + i * 1.3, arc: 2.6, dur: 0.22 }); fx.burst(x, y, { count: 10, color: [col, '#ffffff'], speed: 200, size: 6, life: 0.3, shape: 'spark' }); sfx('slash'); if (i === 2) { onHit(tg); B.shake(0.5); B.stop(0.05); } });
  }
}

// ------------------------------------------------------------------ attaques spéciales des boss
export function bossSkill(B, e, hero) {
  const fx = B.fx;
  const sk = e.bossSkill;
  if (sk === 'slam') {
    B.say(e, 'ATTENTION !', 'tag');
    const hx = hero.x;
    fx.custom(1.1, (ctx, q) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ell(ctx, hx, hero.y, 34 + q * 6, 9 + q * 1.5); ctx.fillStyle = rgba('#ff2a3d', 0.15 + q * 0.3); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba('#ff2a3d', 0.8); ctx.stroke(); ell(ctx, hx, hero.y, (34 + q * 6) * q, (9 + q * 1.5) * q); ctx.fillStyle = rgba('#ff2a3d', 0.35); ctx.fill(); ctx.restore(); }, 'back');
    B.later(1.1, () => {
      if (e.dead) return;
      B.shake(1.2); B.flash('#ff6a3d', 0.35); B.stop(0.08);
      fx.ring(hx, hero.y, { r1: 90, color: '#ff7a1a', width: 9 });
      fx.burst(hx, hero.y - 10, { count: 30, color: ['#8a6a4a', '#c9a27a', '#ff7a1a'], speed: 260, size: 7, life: 0.6, gravity: 600, up: 220, shape: 'debris' });
      if (!hero.dead) B.hit(e, hero, 3, {});
      sfx('boom');
    });
  } else if (sk === 'summon') {
    B.say(e, 'À MOI, MES SBIRES !', 'tag');
    sfx('thunder');
    B.summonMinions(e, 2);
  } else if (sk === 'drain') {
    B.say(e, 'DRAIN DE VIE', 'tag');
    fx.beam(B.center(e)[0], B.center(e)[1], 0, 0, { color: '#b3202f', width: 7, dur: 1.1, follow: () => B.center(hero) });
    for (let i = 0; i < 4; i++) B.later(0.2 + i * 0.25, () => { if (e.dead || hero.dead) return; B.hit(e, hero, 0.6, {}); e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02); fx.text(B.center(e)[0], e.y - e.height - 4, '+' + Math.round(e.maxHp * 0.02).toLocaleString('fr-FR'), 'heal'); });
    sfx('laser');
  } else {
    B.say(e, 'BARRAGE !', 'tag');
    const col = ENEMY_COLOR[e.ekind] || '#ff4d5e';
    for (let i = 0; i < 6; i++) B.later(i * 0.14, () => { if (e.dead) return; const [x, y] = B.center(e); fx.projectile([x - 10, y - 10], () => B.center(hero), { dur: 0.4, arc: 30 + i * 6, draw: (ctx, px, py, a) => drawShape(ctx, 'star', px, py, a, 5, col), trail: { color: col, size: 7, life: 0.3 }, onHit: (px, py) => { fx.burst(px, py, { count: 8, color: [col, '#ffffff'], speed: 140, size: 6, life: 0.3 }); if (!hero.dead) B.hit(e, hero, 0.55, {}); } }); });
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
    const shape = A.shape === 'heart' || A.shape === 'note' || A.shape === 'coin' ? 'star' : A.shape;
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
    fx.projectile([x0 - 10, y0], () => B.center(tg), { dur: 0.32, arc: 18, draw: drawOrb(rangedColor, 4), trail: { color: rangedColor, size: 6, life: 0.25 }, onHit: () => onImpact() });
  } else B.later(0.15, () => onImpact());
}
export function hurtFx(B, tg) {
  const [x, y] = B.center(tg);
  B.fx.burst(x, y, { count: 7, color: ['#ff4d5e', '#ffffff'], speed: 120, size: 6, life: 0.3, shape: 'spark' });
}
export { RCOL };
