import * as THREE from 'three';
import { PartBuilder, toonMat, withOutline, glowMat, blobShadow } from './toon.js';
import { RARITIES } from '../config.js';

const D = 0x1d1530; // couleur sombre (pupilles, contours)

// ------------------------------------------------------------------ Apparences des costumes
export const SKIN_LOOK = {
  tabby: { fur: '#f39a3d', stripe: '#c2611c', belly: '#fff3df', eye: '#41c463', inner: '#ff9fb2', nose: '#ff6f8e', stripes: true },
  siamese: { fur: '#f2e4cc', stripe: '#5b3a2b', belly: '#fffaf0', eye: '#3fa9ff', inner: '#e8a39b', nose: '#5b3a2b', points: true },
  tux: { fur: '#2c2d38', stripe: '#1c1d25', belly: '#ffffff', eye: '#ffd23f', inner: '#ff9fb2', nose: '#ff7a93', bowtie: true },
  snow: { fur: '#ffffff', stripe: '#d5e8ff', belly: '#ffffff', eye: '#4cc2ff', inner: '#ffc2d1', nose: '#ff9fb2', scarf: '#3d8bff' },
  pirate: { fur: '#a3703f', stripe: '#6d4224', belly: '#f6e2c6', eye: '#41c463', inner: '#ff9fb2', nose: '#ff6f8e', stripes: true, pirate: true, headgear: true },
  ninja: { fur: '#3a3f58', stripe: '#262939', belly: '#a3a9c4', eye: '#ff3d55', inner: '#8d6b8f', nose: '#262939', ninja: true },
  pharaoh: { fur: '#e9c27c', stripe: '#a87d36', belly: '#fff4d8', eye: '#2fd3c4', inner: '#e8a39b', nose: '#a87d36', pharaoh: true, headgear: true, glow: '#ffd23f' },
  cyber: { fur: '#e2aea5', stripe: '#c98f86', belly: '#f0c9c2', eye: '#3ff5ff', inner: '#ff8fa8', nose: '#c96f7a', cyber: true, glow: '#3ff5ff' },
  lion: { fur: '#f2b54a', stripe: '#c27a20', belly: '#ffe9bb', eye: '#ff9d00', inner: '#ff9fb2', nose: '#6b3a1a', mane: '#a8521a', crown: true, headgear: true, glow: '#ffb52e' },
  galaxy: { fur: '#2c1f63', stripe: '#ff7ae0', belly: '#6c5ce7', eye: '#ffffff', inner: '#ff7ae0', nose: '#ff7ae0', stripes: true, crown: true, headgear: true, glow: '#c77dff', stars: true },
};

// ------------------------------------------------------------------ Chat héros
export function buildCatBody(look) {
  const b = new PartBuilder();
  const L = look;
  // corps
  b.sphere(0.5, L.fur, { pos: [0, 0.62, -0.02], scale: [1, 0.95, 0.9] });
  b.sphere(0.36, L.belly, { pos: [0, 0.6, 0.27], scale: [1, 1.1, 0.62] });
  // tête
  b.sphere(0.58, L.fur, { pos: [0, 1.38, 0.05], scale: [1.1, 0.95, 1] }, 24, 18);
  b.sphere(0.17, L.points ? L.stripe : L.belly, { pos: [-0.12, 1.24, 0.5], scale: [1.1, 0.85, 0.8] });
  b.sphere(0.17, L.points ? L.stripe : L.belly, { pos: [0.12, 1.24, 0.5], scale: [1.1, 0.85, 0.8] });
  b.sphere(0.11, L.belly, { pos: [0, 1.14, 0.45] });
  b.sphere(0.06, L.nose, { pos: [0, 1.33, 0.6], scale: [1.3, 0.8, 0.8] });
  // yeux
  for (const sx of [-1, 1]) {
    const x = sx * 0.24;
    b.sphere(0.15, L.eye, { pos: [x, 1.46, 0.47], scale: [0.85, 1.1, 0.55] });
    b.sphere(0.11, D, { pos: [x, 1.455, 0.515], scale: [0.78, 1.05, 0.5] });
    b.sphere(0.045, '#ffffff', { pos: [x - 0.035, 1.51, 0.57] });
    b.sphere(0.022, '#ffffff', { pos: [x + 0.035, 1.415, 0.575] });
    // oreilles
    b.cone(0.21, 0.4, L.points ? L.stripe : L.fur, { pos: [sx * 0.34, 1.86, 0], rot: [0, 0, -sx * 0.38] }, 12);
    b.cone(0.12, 0.26, L.inner, { pos: [sx * 0.33, 1.83, 0.075], rot: [0.12, 0, -sx * 0.38] }, 10);
    // moustaches
    b.box(0.34, 0.014, 0.014, D, { pos: [sx * 0.42, 1.27, 0.46], rot: [0, 0, sx * 0.12] });
    b.box(0.32, 0.014, 0.014, D, { pos: [sx * 0.41, 1.21, 0.45], rot: [0, 0, -sx * 0.1] });
    // pattes
    b.sphere(0.15, L.points ? L.stripe : L.belly, { pos: [sx * 0.22, 0.12, 0.26], scale: [1, 0.75, 1.25] });
    b.sphere(0.16, L.points ? L.stripe : L.fur, { pos: [sx * 0.3, 0.13, -0.18], scale: [1, 0.8, 1.2] });
  }
  // bouche ω
  b.torus(0.04, 0.011, D, { pos: [-0.04, 1.275, 0.6], rot: [0, 0, Math.PI] }, Math.PI, 10);
  b.torus(0.04, 0.011, D, { pos: [0.04, 1.275, 0.6], rot: [0, 0, Math.PI] }, Math.PI, 10);
  if (L.stripes) {
    b.sphere(0.1, L.stripe, { pos: [0, 1.79, 0.36], scale: [0.32, 1.1, 0.4], rot: [-0.7, 0, 0] });
    b.sphere(0.09, L.stripe, { pos: [-0.13, 1.76, 0.35], scale: [0.3, 1, 0.4], rot: [-0.7, 0, 0.3] });
    b.sphere(0.09, L.stripe, { pos: [0.13, 1.76, 0.35], scale: [0.3, 1, 0.4], rot: [-0.7, 0, -0.3] });
    for (const z of [-0.12, 0.05]) b.sphere(0.3, L.stripe, { pos: [0, 0.98, z - 0.15], scale: [1.35, 0.18, 0.9], rot: [0.5, 0, 0] });
  }
  if (L.points) b.sphere(0.24, L.stripe, { pos: [0, 1.3, 0.42], scale: [1.2, 0.9, 0.6] });
  if (L.bowtie) {
    b.cone(0.09, 0.16, '#e0263f', { pos: [-0.08, 1.0, 0.43], rot: [0, 0, Math.PI / 2] }, 8);
    b.cone(0.09, 0.16, '#e0263f', { pos: [0.08, 1.0, 0.43], rot: [0, 0, -Math.PI / 2] }, 8);
    b.sphere(0.05, '#ff4d5e', { pos: [0, 1.0, 0.46] });
  }
  if (L.scarf) {
    b.torus(0.36, 0.08, L.scarf, { pos: [0, 0.98, 0.02], rot: [Math.PI / 2 + 0.15, 0, 0] });
    b.box(0.14, 0.35, 0.06, L.scarf, { pos: [0.2, 0.8, 0.38], rot: [0.2, 0, 0.2] });
  }
  if (L.ninja) {
    b.torus(0.56, 0.05, '#c0182c', { pos: [0, 1.62, 0.05], rot: [Math.PI / 2 + 0.2, 0, 0], scale: [1.08, 1, 1] });
    b.box(0.08, 0.38, 0.03, '#c0182c', { pos: [-0.25, 1.5, -0.55], rot: [0.5, 0, 0.5] });
    b.box(0.08, 0.32, 0.03, '#c0182c', { pos: [-0.1, 1.45, -0.56], rot: [0.5, 0, 0.2] });
  }
  if (L.pirate) {
    b.sphere(0.13, D, { pos: [0.24, 1.46, 0.52], scale: [1, 1, 0.3] });
    b.torus(0.58, 0.018, D, { pos: [0, 1.5, 0.06], rot: [Math.PI / 2, -0.5, 0.35], scale: [1.05, 1, 1] });
  }
  if (L.mane) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      b.sphere(0.24, L.mane, { pos: [Math.cos(a) * 0.62, 1.36 + Math.sin(a) * 0.55, -0.12] });
    }
  }
  if (L.cyber) {
    for (const sx of [-1, 1]) b.cone(0.12, 0.16, '#9aa7b8', { pos: [sx * 0.42, 2.04, 0], rot: [0, 0, -sx * 0.38] }, 8);
  }
  if (L.pharaoh) b.torus(0.4, 0.07, '#ffcc33', { pos: [0, 0.98, 0.02], rot: [Math.PI / 2 + 0.15, 0, 0], scale: [1, 1, 0.5] });
  return b.mesh();
}

function buildHeadgear(look) {
  const b = new PartBuilder();
  if (look.pirate) {
    b.cyl(0.62, 0.62, 0.08, '#1d1d26', { pos: [0, 1.88, 0.02], scale: [1, 1, 0.75] }, 20);
    b.cone(0.5, 0.42, '#1d1d26', { pos: [0, 2.1, 0] }, 3);
    b.sphere(0.08, '#ffffff', { pos: [0, 2.04, 0.36] });
    b.torus(0.62, 0.03, '#ffcc33', { pos: [0, 1.9, 0.02], rot: [Math.PI / 2, 0, 0], scale: [1, 0.75, 1] });
  } else if (look.pharaoh) {
    b.cyl(0.45, 0.62, 0.55, '#ffcc33', { pos: [0, 1.9, -0.05] }, 20);
    for (let i = 0; i < 4; i++) b.cyl(0.47 + i * 0.04, 0.5 + i * 0.04, 0.06, '#2457c5', { pos: [0, 1.72 + i * 0.12, -0.05] }, 20);
    b.sphere(0.09, '#2fd3c4', { pos: [0, 1.98, 0.48] });
    b.box(0.5, 0.6, 0.12, '#ffcc33', { pos: [0, 1.25, -0.55] });
  } else if (look.crown) {
    b.cyl(0.32, 0.3, 0.2, '#ffcc33', { pos: [0, 1.95, 0] }, 16);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.cone(0.07, 0.2, '#ffcc33', { pos: [Math.cos(a) * 0.3, 2.13, Math.sin(a) * 0.3] }, 6);
      b.sphere(0.04, i % 2 ? '#ff4d5e' : '#48f3ff', { pos: [Math.cos(a) * 0.32, 1.97, Math.sin(a) * 0.32] });
    }
  }
  return b.geos.length ? b.mesh() : null;
}

function buildGearAcc(gear, look) {
  const g = new THREE.Group();
  const col = (it) => (it ? RARITIES[it.r].color : null);
  if (gear.hat && !look.headgear) {
    // petit chapeau pointu entre les oreilles (ne cache pas le visage)
    const b = new PartBuilder();
    const c = col(gear.hat);
    const r = gear.hat.r;
    b.cone(0.26, 0.62, c, { pos: [0.02, 2.12, -0.04], rot: [-0.12, 0, -0.18] }, 16);
    b.torus(0.25, 0.06, '#ffffff', { pos: [0, 1.83, -0.02], rot: [Math.PI / 2 - 0.12, 0.18, 0] });
    b.sphere(0.1, r >= 4 ? '#ffd23f' : '#ffffff', { pos: [0.08, 2.44, -0.1] });
    if (r >= 3) for (let i = 0; i < 3; i++) b.sphere(0.035, '#ffffff', { pos: [-0.12 + i * 0.1, 1.98 + i * 0.13, 0.17 - i * 0.04] });
    g.add(withOutline(b.mesh(), 0.025));
  }
  if (gear.cape) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 0.95, 16, 1, true, Math.PI * 0.62, Math.PI * 0.76), toonMat({ color: new THREE.Color(col(gear.cape)), extra: { side: THREE.DoubleSide } }));
    m.position.set(0, 0.62, -0.08);
    g.add(m);
  }
  if (gear.collar) {
    const b = new PartBuilder();
    b.torus(0.33, 0.045, col(gear.collar), { pos: [0, 0.98, 0.03], rot: [Math.PI / 2 + 0.15, 0, 0] });
    b.sphere(0.075, '#ffd23f', { pos: [0, 0.92, 0.36] });
    g.add(withOutline(b.mesh(), 0.02));
  }
  if (gear.claws && gear.claws.r >= 2) {
    const c = col(gear.claws);
    const s = 0.8 + gear.claws.r * 0.08;
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035 * s, 0.32 * s, 6), glowMat(c, 0.95));
      blade.position.set(0.16 + (i - 1) * 0.06, 0.2, 0.42);
      blade.rotation.x = Math.PI / 2 - 0.4;
      g.add(blade);
    }
  }
  return g;
}

export class CatModel {
  constructor(skinId = 'tabby', gear = {}) {
    this.root = new THREE.Group();
    this.pivot = new THREE.Group(); // pour sauts / squash
    this.root.add(this.pivot);
    this.shadow = blobShadow(1.5);
    this.root.add(this.shadow);
    this.t = Math.random() * 10;
    this.setLook(skinId, gear);
  }
  setLook(skinId, gear) {
    this.skinId = skinId;
    const look = SKIN_LOOK[skinId] || SKIN_LOOK.tabby;
    this.look = look;
    while (this.pivot.children.length) this.pivot.remove(this.pivot.children[0]);
    this.body = withOutline(buildCatBody(look), 0.035);
    this.mat = this.body.material;
    this.pivot.add(this.body);
    const hg = buildHeadgear(look);
    if (hg) this.pivot.add(withOutline(hg, 0.03));
    // queue articulée
    this.tail = [];
    let parent = this.pivot;
    const tailMatA = toonMat({ color: new THREE.Color(look.points ? look.stripe : look.fur) });
    const tailMatB = toonMat({ color: new THREE.Color(look.stripes || look.points ? look.stripe : look.fur) });
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      const r = 0.1 - i * 0.008;
      const m = withOutline(new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.18, 4, 10), i % 2 ? tailMatB : tailMatA), 0.03);
      m.position.y = 0.13;
      seg.add(m);
      if (i === 0) seg.position.set(0, 0.45, -0.42);
      else seg.position.y = 0.25;
      seg.rotation.x = i === 0 ? -0.9 : 0.35;
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    if (look.mane || look.scarf) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toonMat({ color: new THREE.Color(look.mane || '#ffffff') }));
      tuft.position.y = 0.3;
      parent.add(tuft);
    }
    this.acc = buildGearAcc(gear, look);
    this.pivot.add(this.acc);
    if (look.cyber) {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.08), glowMat('#3ff5ff', 0.9));
      visor.position.set(0, 1.47, 0.55);
      this.pivot.add(visor);
    }
    if (look.glow) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 40), glowMat(look.glow, 0.45));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.root.add(ring);
      if (this.glowRing) this.root.remove(this.glowRing);
      this.glowRing = ring;
    } else if (this.glowRing) { this.root.remove(this.glowRing); this.glowRing = null; }
    this.stars = [];
    if (look.stars) {
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glowMat(i % 2 ? '#ff7ae0' : '#ffffff'));
        this.pivot.add(s);
        this.stars.push(s);
      }
    }
  }
  setGear(gear) {
    this.pivot.remove(this.acc);
    this.acc = buildGearAcc(gear, this.look);
    this.pivot.add(this.acc);
  }
  flash(c = 0xffffff, dur = 0.12) {
    this.mat.emissive.set(c);
    this.flashT = dur;
  }
  // mode : 'idle' | 'run' | 'attack' | 'hit' | 'dead' | 'cast'
  update(dt, mode, k = 0) {
    this.t += dt;
    const t = this.t;
    let y = 0, sy = 1, sx = 1, rz = 0, rx = 0, px = 0;
    if (mode === 'run') {
      const ph = Math.abs(Math.sin(t * 11));
      y = ph * 0.22;
      sy = 0.92 + ph * 0.14; sx = 1.06 - ph * 0.08;
      rx = 0.08;
    } else if (mode === 'attack') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      px = a * 0.55;
      rz = 0; rx = a * 0.25;
      sy = 1 - a * 0.08; sx = 1 + a * 0.08;
      y = a * 0.12;
    } else if (mode === 'cast') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      y = a * 0.45; sy = 1 + a * 0.1; sx = 1 - a * 0.05;
    } else if (mode === 'dead') {
      rz = Math.min(1, k) * 1.4; y = 0;
      sy = 1 - Math.min(1, k) * 0.15;
    } else {
      sy = 1 + Math.sin(t * 2.6) * 0.025; sx = 1 - Math.sin(t * 2.6) * 0.012;
    }
    if (mode === 'hit') { px = -Math.sin(Math.min(1, k) * Math.PI) * 0.25; }
    this.pivot.position.set(0, y, px);
    this.pivot.scale.set(sx, sy, sx);
    this.pivot.rotation.set(rx, 0, rz);
    // queue
    const wag = mode === 'run' ? 9 : 3;
    for (let i = 0; i < this.tail.length; i++) {
      this.tail[i].rotation.z = Math.sin(t * wag - i * 0.7) * (0.18 + i * 0.06);
      if (i > 0) this.tail[i].rotation.x = 0.35 + Math.sin(t * wag * 0.5 - i) * 0.08;
    }
    for (let i = 0; i < this.stars.length; i++) {
      const a = t * 1.6 + (i / this.stars.length) * Math.PI * 2;
      this.stars[i].position.set(Math.cos(a) * 0.95, 1.2 + Math.sin(a * 2) * 0.35, Math.sin(a) * 0.95);
      this.stars[i].rotation.y = t * 3;
    }
    if (this.glowRing) { this.glowRing.rotation.z = t * 0.6; this.glowRing.material.opacity = 0.3 + Math.sin(t * 3) * 0.12; }
    this.shadow.scale.setScalar(1 - y * 0.6);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.mat.emissive.set(0); }
  }
}

// ------------------------------------------------------------------ Ennemis
function buildRat() {
  const b = new PartBuilder();
  const fur = '#8d8fa3', dark = '#5f6177', pink = '#ff9fb2';
  b.sphere(0.45, fur, { pos: [0, 0.5, -0.05], scale: [1, 0.9, 1.15] });
  b.sphere(0.3, '#c9cbd8', { pos: [0, 0.48, 0.28], scale: [1, 1, 0.6] });
  b.sphere(0.38, fur, { pos: [0, 1.05, 0.15], scale: [1, 0.9, 1] });
  b.cone(0.22, 0.42, fur, { pos: [0, 0.98, 0.58], rot: [Math.PI / 2, 0, 0] });
  b.sphere(0.07, pink, { pos: [0, 0.98, 0.8] });
  for (const sx of [-1, 1]) {
    b.sphere(0.24, fur, { pos: [sx * 0.33, 1.4, 0.0], scale: [1, 1, 0.35] });
    b.sphere(0.17, pink, { pos: [sx * 0.33, 1.4, 0.05], scale: [1, 1, 0.3] });
    b.sphere(0.075, '#ff2a3d', { pos: [sx * 0.16, 1.13, 0.43] });
    b.sphere(0.025, '#ffffff', { pos: [sx * 0.15, 1.16, 0.5] });
    b.box(0.2, 0.06, 0.04, D, { pos: [sx * 0.16, 1.24, 0.42], rot: [0, 0, sx * 0.4] });
    b.sphere(0.13, dark, { pos: [sx * 0.24, 0.1, 0.18], scale: [1, 0.7, 1.3] });
    b.sphere(0.13, dark, { pos: [sx * 0.26, 0.1, -0.28], scale: [1, 0.7, 1.3] });
  }
  b.box(0.06, 0.09, 0.03, '#ffffff', { pos: [-0.035, 0.86, 0.69] });
  b.box(0.06, 0.09, 0.03, '#ffffff', { pos: [0.035, 0.86, 0.69] });
  b.torus(0.32, 0.07, '#d62839', { pos: [0, 0.82, 0.08], rot: [Math.PI / 2 + 0.3, 0, 0] });
  b.torus(0.5, 0.035, pink, { pos: [0, 0.35, -0.75], rot: [0, Math.PI / 2, 0] }, Math.PI * 1.1);
  return b.mesh();
}
function buildDog() {
  const b = new PartBuilder();
  const fur = '#c98a4b', light = '#f2d1a8', dark = '#7a4a24';
  b.sphere(0.55, fur, { pos: [0, 0.6, -0.05], scale: [1.1, 0.9, 1.05] });
  b.sphere(0.36, light, { pos: [0, 0.55, 0.32], scale: [1.1, 1, 0.6] });
  b.sphere(0.5, fur, { pos: [0, 1.25, 0.2], scale: [1.2, 0.95, 0.95] });
  b.sphere(0.3, light, { pos: [0, 1.1, 0.55], scale: [1.4, 0.8, 0.8] });
  b.sphere(0.11, D, { pos: [0, 1.22, 0.78], scale: [1.4, 0.9, 0.8] });
  for (const sx of [-1, 1]) {
    b.sphere(0.22, dark, { pos: [sx * 0.55, 1.25, 0.1], scale: [0.5, 1.2, 0.8], rot: [0, 0, sx * 0.4] });
    b.sphere(0.08, '#ffffff', { pos: [sx * 0.2, 1.38, 0.55] });
    b.sphere(0.05, D, { pos: [sx * 0.2, 1.38, 0.61] });
    b.box(0.24, 0.07, 0.05, D, { pos: [sx * 0.2, 1.5, 0.55], rot: [0, 0, sx * 0.35] });
    b.cone(0.045, 0.12, '#ffffff', { pos: [sx * 0.15, 1.02, 0.78] }, 6);
    b.sphere(0.16, light, { pos: [sx * 0.3, 0.12, 0.25], scale: [1, 0.7, 1.3] });
    b.sphere(0.16, fur, { pos: [sx * 0.32, 0.12, -0.3], scale: [1, 0.7, 1.3] });
  }
  b.torus(0.4, 0.07, '#2a2a33', { pos: [0, 0.92, 0.1], rot: [Math.PI / 2 + 0.25, 0, 0] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.cone(0.05, 0.14, '#d9dde6', { pos: [Math.cos(a) * 0.45, 0.92 + Math.sin(a) * 0.1, Math.sin(a) * 0.45 + 0.1], rot: [0, -a, Math.PI / 2] }, 6);
  }
  b.sphere(0.12, fur, { pos: [0, 0.75, -0.6] });
  return b.mesh();
}
function buildVacuum() {
  const b = new PartBuilder();
  b.cyl(0.72, 0.75, 0.32, '#e9edf5', { pos: [0, 0.26, 0] }, 28);
  b.cyl(0.55, 0.68, 0.16, '#b7c0d4', { pos: [0, 0.48, 0] }, 28);
  b.torus(0.74, 0.07, '#3a3f58', { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] }, Math.PI * 2, 32);
  b.cyl(0.25, 0.3, 0.1, '#3a3f58', { pos: [0, 0.6, 0] }, 20);
  b.cyl(0.03, 0.03, 0.6, '#3a3f58', { pos: [0.3, 0.9, -0.2] }, 6);
  b.cyl(0.12, 0.12, 0.05, '#3a3f58', { pos: [-0.5, 0.05, 0.5] }, 10);
  b.cyl(0.12, 0.12, 0.05, '#3a3f58', { pos: [0.5, 0.05, 0.5] }, 10);
  return b.mesh();
}
function buildVacuumGlow(g) {
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.05), glowMat('#ff2a3d'));
    e.position.set(sx * 0.18, 0.36, 0.72);
    e.rotation.z = sx * 0.3;
    g.add(e);
  }
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat('#ff2a3d'));
  bulb.position.set(0.3, 1.22, -0.2);
  g.add(bulb);
}
function buildCucumber() {
  const b = new PartBuilder();
  const g1 = '#3fa34d', g2 = '#2a7a36';
  b.add(new THREE.CapsuleGeometry(0.38, 0.9, 8, 18), g1, { pos: [0, 0.85, 0] });
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = 0.4 + (i / 14) * 1.0;
    b.sphere(0.05, g2, { pos: [Math.cos(a) * 0.37, y, Math.sin(a) * 0.37] }, 8, 6);
  }
  b.cyl(0.1, 0.14, 0.12, '#8b5a2b', { pos: [0, 1.7, 0] }, 8);
  for (const sx of [-1, 1]) {
    b.sphere(0.11, '#ffffff', { pos: [sx * 0.14, 1.15, 0.33] });
    b.sphere(0.055, D, { pos: [sx * 0.13, 1.14, 0.43] });
    b.box(0.2, 0.06, 0.05, D, { pos: [sx * 0.15, 1.3, 0.35], rot: [0, 0, sx * 0.45] });
    b.add(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), g2, { pos: [sx * 0.45, 0.8, 0.05], rot: [0, 0, sx * 0.6] });
    b.sphere(0.1, g2, { pos: [sx * 0.18, 0.1, 0.05] });
  }
  b.torus(0.09, 0.02, D, { pos: [0, 0.95, 0.37] }, Math.PI, 10);
  return b.mesh();
}

const ENEMY_BUILDERS = { rat: buildRat, dog: buildDog, vacuum: buildVacuum, cucumber: buildCucumber };
const enemyGeoCache = {};

export class EnemyModel {
  constructor(kind, { boss = false, elite = false } = {}) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    if (!enemyGeoCache[kind]) enemyGeoCache[kind] = ENEMY_BUILDERS[kind]().geometry;
    this.mat = toonMat();
    this.body = withOutline(new THREE.Mesh(enemyGeoCache[kind], this.mat), 0.035);
    this.pivot.add(this.body);
    if (kind === 'vacuum') buildVacuumGlow(this.pivot);
    const sc = boss ? 1.9 : elite ? 1.3 : 1;
    this.scale = sc;
    this.root.scale.setScalar(sc);
    this.shadow = blobShadow(1.6);
    this.root.add(this.shadow);
    if (boss) {
      const b = new PartBuilder();
      b.cyl(0.26, 0.24, 0.16, '#ffcc33', { pos: [0, 0, 0] }, 14);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.cone(0.06, 0.18, '#ffcc33', { pos: [Math.cos(a) * 0.24, 0.16, Math.sin(a) * 0.24] }, 6);
      }
      b.sphere(0.06, '#ff2a3d', { pos: [0, 0.02, 0.26] });
      const crown = withOutline(b.mesh(), 0.02);
      crown.position.y = kind === 'cucumber' ? 1.85 : kind === 'vacuum' ? 0.72 : kind === 'dog' ? 1.7 : 1.55;
      crown.rotation.z = 0.2;
      this.pivot.add(crown);
    }
    if (boss || elite) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 36), glowMat(boss ? '#ff2a3d' : '#ff9d00', 0.5));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.root.add(ring);
      this.ring = ring;
    }
    this.t = Math.random() * 10;
    this.height = (kind === 'vacuum' ? 0.8 : kind === 'cucumber' ? 1.8 : 1.6) * sc;
  }
  flash(c = 0xffffff, dur = 0.1) { this.mat.emissive.set(c); this.flashT = dur; }
  update(dt, mode, k = 0) {
    this.t += dt;
    const t = this.t;
    let y = 0, sy = 1, sx = 1, rx = 0, pz = 0, ry = 0;
    if (mode === 'run') {
      const ph = Math.abs(Math.sin(t * 10));
      if (this.kind === 'vacuum') { ry = Math.sin(t * 6) * 0.15; y = 0.02; }
      else { y = ph * 0.16; sy = 0.94 + ph * 0.1; sx = 1.04 - ph * 0.06; }
    } else if (mode === 'attack') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      pz = a * 0.6; rx = a * 0.3; sy = 1 - a * 0.1; sx = 1 + a * 0.1;
    } else if (mode === 'hit') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      pz = -a * 0.3; rx = -a * 0.2;
    } else if (mode === 'dead') {
      const a = Math.min(1, k);
      sy = Math.max(0.01, 1 - a); sx = 1 + a * 0.4; y = 0;
    } else if (mode === 'stun') {
      ry = Math.sin(t * 14) * 0.15;
    } else {
      sy = 1 + Math.sin(t * 3) * 0.03;
    }
    this.pivot.position.set(0, y, pz);
    this.pivot.scale.set(sx, sy, sx);
    this.pivot.rotation.set(rx, ry, 0);
    if (this.ring) this.ring.rotation.z = t;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.mat.emissive.set(0); }
  }
}

// ------------------------------------------------------------------ Compagnons
function buildPet(id) {
  const b = new PartBuilder();
  const eyes = (y, z, x = 0.12, r = 0.07) => {
    for (const sx of [-1, 1]) {
      b.sphere(r, D, { pos: [sx * x, y, z] });
      b.sphere(r * 0.38, '#ffffff', { pos: [sx * x - 0.02, y + 0.03, z + r * 0.8] });
    }
  };
  let glow = null;
  switch (id) {
    case 'sparrow':
      b.sphere(0.34, '#c98d4f', { scale: [1, 0.95, 1.1] });
      b.sphere(0.22, '#f4e1c1', { pos: [0, -0.06, 0.18], scale: [1, 1, 0.6] });
      b.cone(0.08, 0.18, '#ffb52e', { pos: [0, 0.02, 0.38], rot: [Math.PI / 2, 0, 0] }, 8);
      for (const sx of [-1, 1]) b.sphere(0.2, '#8a5a2c', { pos: [sx * 0.33, 0, -0.05], scale: [0.35, 0.8, 1.1], rot: [0, 0, sx * 0.5] });
      b.cone(0.14, 0.3, '#8a5a2c', { pos: [0, 0.05, -0.4], rot: [-Math.PI / 2 - 0.4, 0, 0] }, 6);
      eyes(0.1, 0.27, 0.13, 0.055);
      break;
    case 'goldfish':
      b.sphere(0.3, '#ff7a2f', { scale: [0.75, 0.95, 1.2] });
      b.cone(0.22, 0.32, '#ffb52e', { pos: [0, 0, -0.45], rot: [-Math.PI / 2, 0, 0], scale: [0.4, 1, 1] }, 8);
      b.cone(0.1, 0.22, '#ffb52e', { pos: [0, 0.3, -0.05], rot: [-0.4, 0, 0], scale: [0.35, 1, 1] }, 8);
      eyes(0.08, 0.26, 0.13, 0.06);
      glow = { color: '#9fe8ff', r: 0.55, op: 0.22 };
      break;
    case 'yarnling':
      b.sphere(0.36, '#ff5ca8', {}, 20, 16);
      for (let i = 0; i < 5; i++) b.torus(0.36, 0.022, '#ff8fc4', { rot: [i * 0.7, i * 1.1, i * 0.4] }, Math.PI * 2, 28);
      eyes(0.08, 0.32, 0.12, 0.07);
      break;
    case 'butterfly':
      b.add(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), '#2c1f63', { rot: [Math.PI / 2, 0, 0] });
      b.sphere(0.1, '#2c1f63', { pos: [0, 0, 0.27] });
      for (const sx of [-1, 1]) {
        b.sphere(0.32, '#7fd8ff', { pos: [sx * 0.28, 0.2, 0.05], scale: [1, 0.12, 0.85], rot: [0.3, 0, sx * 1.0] });
        b.sphere(0.22, '#c77dff', { pos: [sx * 0.22, 0.08, -0.18], scale: [1, 0.12, 0.8], rot: [-0.3, 0, sx * 0.8] });
      }
      glow = { color: '#7fd8ff', r: 0.45, op: 0.18 };
      break;
    case 'owl':
      b.sphere(0.38, '#9c78e8', { scale: [1, 1.05, 0.95] });
      b.sphere(0.26, '#e6dbff', { pos: [0, -0.08, 0.2], scale: [1, 1, 0.55] });
      for (const sx of [-1, 1]) {
        b.sphere(0.12, '#ffffff', { pos: [sx * 0.14, 0.12, 0.3] });
        b.sphere(0.07, '#ffb52e', { pos: [sx * 0.14, 0.12, 0.38] });
        b.sphere(0.04, D, { pos: [sx * 0.14, 0.12, 0.43] });
        b.cone(0.07, 0.2, '#6c4fc0', { pos: [sx * 0.22, 0.42, 0], rot: [0, 0, -sx * 0.4] }, 6);
        b.sphere(0.2, '#6c4fc0', { pos: [sx * 0.36, -0.02, 0], scale: [0.35, 0.9, 0.9] });
      }
      b.cone(0.05, 0.12, '#ffb52e', { pos: [0, 0.0, 0.4], rot: [Math.PI / 2 + 0.4, 0, 0] }, 6);
      break;
    case 'dragon':
      b.sphere(0.3, '#ff4d4d', { scale: [0.9, 0.9, 1.2] });
      b.sphere(0.26, '#ff4d4d', { pos: [0, 0.25, 0.3] });
      b.sphere(0.16, '#ffd0a0', { pos: [0, 0.18, 0.5], scale: [1, 0.7, 0.9] });
      b.sphere(0.2, '#ffd0a0', { pos: [0, -0.05, 0.18], scale: [1, 1, 0.5] });
      for (const sx of [-1, 1]) {
        b.cone(0.05, 0.2, '#fff2c0', { pos: [sx * 0.12, 0.5, 0.25], rot: [-0.4, 0, -sx * 0.3] }, 6);
        b.cone(0.28, 0.4, '#b3202f', { pos: [sx * 0.35, 0.15, -0.05], rot: [0, 0, -sx * 1.2], scale: [1, 1, 0.2] }, 3);
      }
      b.cone(0.12, 0.45, '#ff4d4d', { pos: [0, -0.05, -0.45], rot: [-Math.PI / 2 - 0.3, 0, 0] }, 8);
      eyes(0.33, 0.47, 0.11, 0.055);
      glow = { color: '#ff7a2f', r: 0.0, op: 0 };
      break;
    case 'phoenix':
      b.sphere(0.3, '#ffc93c', { scale: [0.9, 1, 1.15] });
      b.sphere(0.22, '#ffc93c', { pos: [0, 0.28, 0.25] });
      b.cone(0.06, 0.16, '#ff7a2f', { pos: [0, 0.26, 0.48], rot: [Math.PI / 2, 0, 0] }, 6);
      for (let i = 0; i < 3; i++) b.cone(0.05, 0.22, '#ff4d4d', { pos: [(i - 1) * 0.08, 0.52, 0.18], rot: [-0.4, 0, (i - 1) * 0.4] }, 6);
      for (const sx of [-1, 1]) b.cone(0.3, 0.55, '#ff9d00', { pos: [sx * 0.4, 0.15, 0], rot: [0, 0, -sx * 1.1], scale: [1, 1, 0.25] }, 4);
      eyes(0.33, 0.4, 0.1, 0.05);
      glow = { color: '#ffb52e', r: 0.6, op: 0.25, tail: true };
      break;
    default:
      b.sphere(0.3, '#ffffff');
  }
  return { mesh: b.mesh(), glow };
}

export class PetModel {
  constructor(id) {
    this.id = id;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    const { mesh, glow } = buildPet(id);
    this.pivot.add(withOutline(mesh, 0.03));
    if (glow && glow.r) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(glow.r, 20, 14), glowMat(glow.color, glow.op));
      this.pivot.add(g);
    }
    if (glow && glow.tail) {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.1 - i * 0.02, 0.6, 8), glowMat(i ? '#ff4d4d' : '#ffd23f', 0.8));
        c.position.set((i - 1) * 0.12, 0, -0.55);
        c.rotation.x = -Math.PI / 2;
        this.pivot.add(c);
      }
    }
    this.root.scale.setScalar(0.62);
    this.shadow = blobShadow(0.9);
    this.root.add(this.shadow);
    this.t = Math.random() * 10;
  }
  update(dt, k = 0) {
    this.t += dt;
    const y = 1.1 + Math.sin(this.t * 3) * 0.15;
    this.pivot.position.y = y;
    this.pivot.rotation.z = Math.sin(this.t * 2.2) * 0.12;
    this.pivot.position.z = Math.sin(Math.min(1, k) * Math.PI) * 0.5;
    this.shadow.scale.setScalar(0.8 - Math.sin(this.t * 3) * 0.1);
  }
}

// ------------------------------------------------------------------ Objets d'effets
export function fishMesh() {
  const b = new PartBuilder();
  b.sphere(0.18, '#9fc6e8', { scale: [0.5, 0.9, 1.3] });
  b.sphere(0.12, '#e8f4ff', { pos: [0, -0.06, 0.04], scale: [0.45, 0.6, 1.1] });
  b.cone(0.13, 0.18, '#7aa7d0', { pos: [0, 0, -0.3], rot: [-Math.PI / 2, 0, 0], scale: [0.3, 1, 1] }, 6);
  b.sphere(0.03, D, { pos: [0.08, 0.04, 0.16] });
  b.sphere(0.03, D, { pos: [-0.08, 0.04, 0.16] });
  return withOutline(b.mesh(), 0.02);
}
export function yarnBallMesh(r = 0.5, color = '#ff5ca8') {
  const b = new PartBuilder();
  b.sphere(r, color, {}, 22, 16);
  const c2 = new THREE.Color(color).offsetHSL(0, 0, 0.12).getStyle();
  for (let i = 0; i < 6; i++) b.torus(r, r * 0.06, c2, { rot: [i * 0.6, i * 1.3, i * 0.2] }, Math.PI * 2, 30);
  return withOutline(b.mesh(), 0.03);
}
export function kibbleMesh() {
  const b = new PartBuilder();
  b.dodeca(0.12, '#b0713a');
  return b.mesh();
}
