// =====================================================================
//  Effets d'attaques : armes (5 styles), pouvoirs (12), chatons (8 éléments),
//  ennemis. B = instance du combat (voir battle.js) qui fournit :
//  fx, foes(u), hit(att, tgt, mult, o), heal(u,pct), shield(u,pct), buff(u,v,d), later(t,fn),
//  shake(a), flash(c,a), zoom(z,x,y), stop(t), say(u,txt,style), center(u), head(u), hand(u), cutin(u,sk)
// =====================================================================
import { rgba, ell } from './draw.js';
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

// ------------------------------------------------------------------ attaques des chatons (selon l'élément)
export function kittenAttack(B, k, tg, mult, ult) {
  const fx = B.fx;
  const el = k.el || 'nature';
  const col = ELEMENTS[el].color;
  const [x0, y0] = B.head(k);
  const tc = () => B.center(tg);
  const big = ult ? 2.2 : 1;
  const impact = (x, y) => { if (!tg.dead) B.hit(k.owner, tg, mult * (ult ? 3 : 1), { pet: true }); fx.burst(x, y, { count: ult ? 30 : 10, color: [col, '#ffffff'], speed: 160 * big, size: 7 * big, life: 0.4, shape: el === 'cosmic' || el === 'light' ? 'star' : el === 'water' ? 'bubble' : 'glow' }); if (ult) { fx.blast(x, y, { r: 70, color: col }); B.shake(0.5); } };
  if (ult) { B.say(k, 'ULTIME !', 'tag'); sfx('legendary'); }
  switch (el) {
    case 'fire':
      sfx('whoosh');
      fx.projectile([x0, y0], tc, { dur: 0.36, arc: 26, draw: drawOrb('#ff7a1a', 5 * big), trail: { color: ['#ff7a1a', '#ffd23f'], size: 8 * big, life: 0.35 }, onHit: impact });
      break;
    case 'ice':
      for (let i = 0; i < 3; i++) B.later(i * 0.06, () => fx.projectile([x0, y0 - 6 + i * 6], tc, { dur: 0.28, arc: 6, draw: (ctx, x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#bff4ff', 0.95); ctx.beginPath(); ctx.moveTo(10 * big, 0); ctx.lineTo(-6, -3 * big); ctx.lineTo(-6, 3 * big); ctx.fill(); ctx.restore(); }, trail: { color: '#7fe9ff', size: 5, life: 0.25, shape: 'star' }, onHit: i === 2 ? impact : null }));
      break;
    case 'thunder':
      B.later(0.08, () => { const [x, y] = tc(); fx.lightning(x0, y0, x, y, { color: '#ffe14d', dur: 0.25 }); impact(x, y); sfx('thunder'); });
      break;
    case 'nature':
      for (let i = 0; i < 5; i++) B.later(i * 0.04, () => fx.projectile([x0, y0], tc, { dur: 0.35, arc: 20 + i * 8, draw: (ctx, x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a + i); ctx.fillStyle = '#5fd068'; ctx.strokeStyle = '#1d5a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, 6 * big, 2.6 * big, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }, onHit: i === 4 ? impact : null }));
      break;
    case 'water':
      fx.projectile([x0, y0], tc, { dur: 0.4, arc: 34, draw: (ctx, x, y) => { ctx.save(); ctx.strokeStyle = rgba('#bff4ff', 0.95); ctx.lineWidth = 2; ctx.fillStyle = rgba('#3fa9ff', 0.45); ctx.beginPath(); ctx.arc(x, y, 7 * big, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, TAU); ctx.fill(); ctx.restore(); }, trail: { color: '#7fe9ff', size: 5, life: 0.3, shape: 'bubble' }, onHit: impact });
      break;
    case 'shadow':
      fx.projectile([x0, y0], tc, { dur: 0.42, arc: 14, draw: (ctx, x, y) => { ctx.save(); ctx.fillStyle = '#1d1030'; ctx.beginPath(); ctx.arc(x, y, 6 * big, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#b968ff', 0.9); ctx.lineWidth = 2.4; ctx.stroke(); ctx.restore(); }, trail: { color: '#b968ff', size: 9, life: 0.35 }, onHit: impact });
      break;
    case 'light':
      B.later(0.1, () => { const [x] = tc(); fx.pillar(x, { color: '#fff2a0', width: 18 * big, dur: 0.45, y: tg.y }); impact(...tc()); sfx('heal'); });
      break;
    default: // cosmos
      B.later(0.05, () => { const [x, y] = tc(); fx.projectile([x + 90, -20], [x, y], { dur: 0.35, arc: 0, draw: drawOrb('#ff7ae0', 5 * big), trail: { color: ['#ff7ae0', '#c77dff', '#ffffff'], size: 9 * big, life: 0.35, shape: 'star' }, onHit: impact }); });
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
