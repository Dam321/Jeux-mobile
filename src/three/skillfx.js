// Effets visuels des compétences et attaques des compagnons
import * as THREE from 'three';
import { yarnBallMesh, kibbleMesh, fishMesh } from './models.js';
import { sfx } from '../audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const T = {};
function tpl(name) {
  if (T[name]) return T[name];
  if (name === 'furball') T[name] = yarnBallMesh(0.22, '#d9a066');
  if (name === 'meteor') T[name] = yarnBallMesh(0.85, '#ff5ca8');
  if (name === 'kibble') T[name] = kibbleMesh();
  if (name === 'fish') T[name] = fishMesh();
  if (name === 'yarnling') T[name] = yarnBallMesh(0.12, '#ff5ca8');
  return T[name];
}

function center(es) {
  const c = V(0, 0, 0);
  if (!es.length) return V(1, 0, 0);
  for (const e of es) c.add(e.model.root.position);
  return c.multiplyScalar(1 / es.length);
}

// B : instance de Battle ; sk : compétence équipée { id, mult, lm, hits, heal, shield, buff }
export function castSkill(B, sk) {
  const fx = B.fx;
  const P = B.player.model.root.position;
  const es = B.targets();
  if (!es.length && !['purrheal', 'shield', 'ninelives'].includes(sk.id)) return false;
  const front = es[0];
  const mult = (sk.mult || 0) * sk.lm;
  const head = V(P.x + 0.45, 1.45, P.z + 0.35);
  B.say(B.player, sk.name, 'skill');
  switch (sk.id) {
    case 'slash': {
      sfx('slash');
      for (let i = 0; i < 3; i++) {
        B.later(i * 0.11, () => {
          if (front.dead) return;
          const p = front.model.root.position.clone(); p.y += 0.9;
          fx.slash(p, i === 1 ? '#7fe9ff' : '#ffffff', { rz: (i - 1) * 0.9 + 0.4, scale: 1.4 });
          fx.burst(p, { count: 14, color: ['#7fe9ff', '#ffffff'], speed: 5, size: 0.18, life: 0.35 });
          B.hit(front, mult / 3, { skill: true });
          sfx('hit');
        });
      }
      break;
    }
    case 'furball': {
      sfx('whoosh');
      const m = tpl('furball').clone();
      fx.projectile(m, head, () => front.model.root.position.clone().setY(0.9), { arc: 1.4, dur: 0.5, spin: true, trail: '#ffcf8a', onHit: (p) => {
        fx.blast(p, '#ff9d3c', { r1: 1.6, life: 0.45 });
        fx.burst(p, { count: 30, color: ['#ffcf8a', '#ff9d3c', '#ffffff'], speed: 6, size: 0.25, life: 0.6, gravity: 6 });
        fx.ring(p.clone().setY(0.05), '#ffb52e', { r1: 2.2 });
        B.hit(front, mult, { skill: true });
        B.world.shake = Math.max(B.world.shake, 0.5);
        sfx('boom');
      } });
      break;
    }
    case 'kibble': {
      for (let w = 0; w < 3; w++) {
        B.later(w * 0.3, () => {
          for (const e of B.targets()) {
            for (let k = 0; k < 3; k++) {
              const tp = e.model.root.position.clone().add(V((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8));
              const from = tp.clone().add(V(-1 + Math.random() * 2, 7, 0));
              fx.projectile(tpl('kibble').clone(), from, tp, { arc: 0, dur: 0.35 + Math.random() * 0.15, spin: true, trail: '#ffcf8a', trailSize: 0.15, onHit: (p) => {
                fx.burst(p, { count: 6, color: '#d9a066', speed: 3, size: 0.14, life: 0.3, gravity: 8 });
              } });
            }
            B.later(0.45, () => { if (!e.dead) B.hit(e, mult / 3, { skill: true }); });
          }
          sfx('hit');
        });
      }
      break;
    }
    case 'purrheal': {
      sfx('heal');
      B.heal(sk.heal * (1 + 0.05 * (sk.lvl - 1)));
      const p = P.clone();
      fx.ring(p.clone().setY(0.05), '#5dff9e', { r1: 2.4, life: 0.8 });
      fx.burst(p.clone().setY(0.8), { count: 40, color: ['#5dff9e', '#ff9fd8', '#ffffff'], speed: 1.5, up: 3, size: 0.25, life: 1.1, shape: 1, spread: 1 });
      break;
    }
    case 'fish': {
      sfx('whoosh');
      const c = center(es);
      const grp = new THREE.Group();
      grp.position.copy(c);
      const fishes = [];
      for (let i = 0; i < 12; i++) {
        const f = tpl('fish').clone();
        f.scale.setScalar(1.4);
        grp.add(f);
        fishes.push({ f, a: (i / 12) * Math.PI * 2, h: (i % 4) * 0.5, r: 1.2 + (i % 3) * 0.35 });
      }
      fx.custom(grp, 1.6, (t) => {
        for (const o of fishes) {
          const a = o.a + t * 14;
          const r = o.r * (t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1);
          o.f.position.set(Math.cos(a) * r, 0.3 + o.h + t * 1.2, Math.sin(a) * r);
          o.f.rotation.y = -a;
        }
        if (Math.random() < 0.7) fx.burst(c.clone().add(V((Math.random() - 0.5) * 2.5, Math.random() * 2.5, (Math.random() - 0.5) * 2)), { count: 3, color: ['#7fd8ff', '#ffffff'], speed: 2, size: 0.18, life: 0.4, shape: 2 });
      });
      for (let k = 0; k < (sk.hits || 5); k++) B.later(0.2 + k * 0.25, () => { for (const e of B.targets()) B.hit(e, mult / (sk.hits || 5), { skill: true }); sfx('hit'); });
      break;
    }
    case 'laser': {
      sfx('laser');
      fx.flash('#ff2a55', 0.18);
      const last = es[es.length - 1];
      for (const dz of [-0.13, 0.13]) {
        const from = V(P.x + 0.5, 1.48, P.z + 0.3 + dz);
        let t0 = 0;
        fx.beam(from, front.model.root.position.clone().setY(0.8), '#ff2a55', { width: 0.12, life: 0.75, follow: () => {
          t0 = Math.min(1, t0 + 0.035);
          return front.model.root.position.clone().lerp(last.model.root.position, t0).setY(0.8);
        } });
      }
      for (let k = 0; k < 4; k++) {
        B.later(0.1 + k * 0.15, () => {
          for (const e of B.targets()) {
            const p = e.model.root.position.clone().setY(0.8);
            fx.burst(p, { count: 8, color: ['#ff2a55', '#ffb52e', '#ffffff'], speed: 4, size: 0.2, life: 0.35, up: 2 });
          }
        });
      }
      B.later(0.3, () => { for (const e of B.targets()) B.hit(e, mult, { skill: true }); });
      break;
    }
    case 'shield': {
      sfx('heal');
      B.addShield(sk.shield * sk.lm);
      fx.ring(P.clone().setY(0.05), '#7fd8ff', { r1: 2.6 });
      fx.burst(P.clone().setY(1), { count: 30, color: ['#7fd8ff', '#ffffff'], speed: 3, size: 0.2, life: 0.6, shape: 1 });
      break;
    }
    case 'thunder': {
      fx.flash('#cfefff', 0.45);
      B.world.shake = Math.max(B.world.shake, 0.9);
      es.forEach((e, i) => B.later(i * 0.08, () => {
        if (e.dead) return;
        const p = e.model.root.position.clone();
        fx.lightning(V(p.x + (Math.random() - 0.5) * 2, 10, p.z - 1), p.clone().setY(0.2), '#8fd9ff', { life: 0.4 });
        fx.lightning(V(p.x + (Math.random() - 0.5) * 2, 10, p.z - 1), p.clone().setY(0.2), '#c77dff', { life: 0.3 });
        fx.blast(p.clone().setY(0.5), '#8fd9ff', { r1: 1.5, life: 0.35 });
        fx.burst(p.clone().setY(0.4), { count: 24, color: ['#8fd9ff', '#ffffff'], speed: 7, size: 0.2, life: 0.4, shape: 1 });
        fx.ring(p.clone().setY(0.05), '#8fd9ff', { r1: 2 });
        B.hit(e, mult, { skill: true });
        sfx('thunder');
      }));
      break;
    }
    case 'meteor': {
      const c = center(es);
      const m = tpl('meteor').clone();
      sfx('whoosh');
      const from = V(c.x + 5, 11, c.z - 3);
      fx.projectile(m, from, c.clone().setY(0.6), { arc: 0, dur: 0.75, spin: true, trail: '#ff7a2f', trailSize: 0.9, onHit: (p) => {
        fx.flash('#ffb066', 0.55);
        B.world.shake = 1.4;
        fx.blast(p, '#ff7a2f', { r1: 4.2, life: 0.7 });
        fx.ring(p.clone().setY(0.05), '#ffd23f', { r1: 5.5, life: 0.7 });
        fx.ring(p.clone().setY(0.6), '#ff5ca8', { r1: 4, life: 0.5, vertical: true });
        fx.burst(p, { count: 90, color: ['#ff7a2f', '#ffd23f', '#ff5ca8', '#ffffff'], speed: 11, size: 0.35, life: 0.9, gravity: 7, up: 3 });
        for (const e of B.targets()) B.hit(e, mult, { skill: true });
        sfx('boom');
      } });
      // traînée de feu supplémentaire
      fx.custom(new THREE.Group(), 0.75, (t) => {
        const p = from.clone().lerp(c, t).setY(11 - t * 10.4);
        fx.burst(p, { count: 4, color: ['#ff7a2f', '#ffd23f'], speed: 1.5, size: 0.6, life: 0.4 });
      });
      break;
    }
    case 'ninelives': {
      sfx('heal'); sfx('legendary');
      B.heal(sk.heal);
      B.buff(sk.buff, 6);
      fx.pillar(P, '#ffd23f', { r: 1.1, life: 1.2 });
      fx.flash('#fff2b0', 0.4);
      fx.ring(P.clone().setY(0.05), '#ffd23f', { r1: 3.5, life: 1 });
      fx.burst(P.clone().setY(1), { count: 70, color: ['#ffd23f', '#ffffff', '#ffb52e'], speed: 3, up: 4, size: 0.3, life: 1.3, shape: 1, spread: 1.2 });
      B.say(B.player, 'NEUF VIES !', 'big gold');
      break;
    }
    case 'nova': {
      const c = center(es).setY(1);
      fx.custom(new THREE.Group(), 0.7, (t) => {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, r = 3.5 * (1 - t) + 0.3;
          const p = c.clone().add(V(Math.cos(a) * r, Math.sin(a) * r * 0.6, Math.sin(a) * 0.5));
          fx.p.emit(p.x, p.y, p.z, (c.x - p.x) * 2, (c.y - p.y) * 2, 0, 0.8, 0.4, 1, 0.3, 0.3, { shape: 1, drag: 0 });
        }
      });
      sfx('laser');
      B.later(0.7, () => {
        sfx('boom');
        fx.flash('#d6a8ff', 0.6);
        B.world.shake = 1.5;
        fx.blast(c, '#c77dff', { r1: 5, life: 0.8 });
        fx.blast(c, '#ff7ae0', { r1: 3, life: 0.6 });
        fx.ring(c.clone().setY(0.05), '#c77dff', { r1: 6, life: 0.8 });
        fx.ring(c, '#ffffff', { r1: 4, life: 0.5, vertical: true });
        fx.burst(c, { count: 110, color: ['#c77dff', '#ff7ae0', '#7fd8ff', '#ffffff'], speed: 12, size: 0.3, life: 1, shape: 1 });
        for (const e of B.targets()) B.hit(e, mult, { skill: true });
      });
      break;
    }
    case 'tiger': {
      const c = center(es);
      for (let k = 0; k < (sk.hits || 2); k++) {
        B.later(k * 0.28, () => {
          sfx('slash');
          B.world.shake = Math.max(B.world.shake, 1);
          for (let i = 0; i < 3; i++) fx.slash(c.clone().add(V((i - 1) * 0.7, 1.4, 0.5)), k ? '#48f3ff' : '#ffd23f', { rz: -1.2 + k * 2.4, ry: 0.4, scale: 2.6, life: 0.35 });
          fx.burst(c.clone().setY(1), { count: 40, color: ['#ffd23f', '#48f3ff', '#ffffff'], speed: 9, size: 0.25, life: 0.5 });
          for (const e of B.targets()) B.hit(e, mult / (sk.hits || 2), { skill: true });
        });
      }
      break;
    }
    default: break;
  }
  return true;
}

const PET_SHOT = {
  sparrow: { color: '#ffcf8a', size: 0.22 },
  goldfish: { color: '#7fd8ff', size: 0.3, shape: 2 },
  yarnling: { color: '#ff5ca8', size: 0.25, mesh: 'yarnling' },
  butterfly: { color: '#c77dff', size: 0.3, shape: 1 },
  owl: { color: '#b48cff', size: 0.35 },
  dragon: { color: '#ff7a2f', size: 0.45 },
  phoenix: { color: '#ffd23f', size: 0.5 },
};

export function petShot(B, pet, petModel, target, dmgMult) {
  const s = PET_SHOT[pet.id] || PET_SHOT.sparrow;
  const fx = B.fx;
  const from = petModel.root.position.clone();
  from.y += 1.1 * petModel.root.scale.y + 0.1;
  const obj = s.mesh ? tpl(s.mesh).clone() : new THREE.Mesh(new THREE.SphereGeometry(s.size * 0.5, 10, 8), fx.additive(s.color, 1));
  fx.projectile(obj, from, () => target.model.root.position.clone().setY(0.9), { arc: 0.6, dur: 0.38, trail: s.color, trailSize: s.size, spin: !!s.mesh, onHit: (p) => {
    fx.burst(p, { count: 10, color: [s.color, '#ffffff'], speed: 3.5, size: s.size * 0.6, life: 0.35, shape: s.shape || 0 });
    if (!target.dead) B.hit(target, dmgMult, { skill: true, pet: true });
  } });
}
