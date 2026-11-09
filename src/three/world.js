import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PartBuilder, toonMat, outlineMat, glowMat } from './toon.js';
import { seeded } from '../util.js';

export const BIOME_LOOK = {
  garden: { sky: ['#3fb4ff', '#c9f1ff'], fog: '#bfe9ff', grass: '#79cc4c', grass2: '#5db23a', path: '#ecd09a', path2: '#d2b27a', far: ['#55b048', '#3f9338', '#7fd36a'], props: ['tree', 'tree', 'bush', 'flower', 'flower', 'rock', 'pine'], ambient: 'petals', sun: '#fff1d6', hemi: ['#d6f2ff', '#5d8f3a'], cloud: '#ffffff' },
  autumn: { sky: ['#ff8a5c', '#ffe1b3'], fog: '#ffd2a6', grass: '#d38a3a', grass2: '#b86d25', path: '#9e6f45', path2: '#86593a', far: ['#a8492b', '#c4602f', '#7a3420'], props: ['autumn', 'autumn', 'pumpkin', 'bush2', 'rock', 'pine2'], ambient: 'leaves', sun: '#ffd6a0', hemi: ['#ffe0c0', '#7a4a20'], cloud: '#fff0e0' },
  beach: { sky: ['#1fb4ff', '#d3fbff'], fog: '#c4f5ff', grass: '#f2d696', grass2: '#e6c47a', path: '#fff1cc', path2: '#f5e0aa', far: ['#2fc3d6', '#1aa0b8', '#62e0e8'], props: ['palm', 'palm', 'shell', 'rock', 'umbrella', 'flower'], ambient: 'bubbles', sun: '#fff6e0', hemi: ['#d6f9ff', '#d8b46a'], cloud: '#ffffff' },
  snow: { sky: ['#7aa8ff', '#eaf3ff'], fog: '#e2edff', grass: '#f1f6ff', grass2: '#d9e6f7', path: '#bfd0e8', path2: '#a9bedb', far: ['#ffffff', '#cfe0f7', '#e6f0ff'], props: ['pine3', 'pine3', 'snowman', 'rock2', 'crystalB'], ambient: 'snow', sun: '#ffffff', hemi: ['#eaf2ff', '#9fb5d6'], cloud: '#ffffff' },
  neon: { sky: ['#140838', '#b03a9a'], fog: '#4a1a6a', grass: '#3d2d80', grass2: '#4f3c9e', path: '#8a6ae0', path2: '#6f52c8', far: ['#2a1a68', '#3a2484', '#1f1452'], props: ['lamp', 'lamp', 'crate', 'neon', 'crystalP'], ambient: 'fireflies', sun: '#ffd6ff', hemi: ['#c9a8ff', '#3a2a70'], cloud: '#6a3a9a', night: true, city: true, edge: '#ff4fd8' },
  volcano: { sky: ['#2a0808', '#ff6a2a'], fog: '#8a2a14', grass: '#6a3a2a', grass2: '#56301f', path: '#a0684a', path2: '#83533a', far: ['#5a2a1c', '#3e1a12', '#6e3420'], props: ['dead', 'rock3', 'crystalR', 'rock3', 'lava'], ambient: 'embers', sun: '#ffc9a0', hemi: ['#ffb08a', '#4a1a0e'], cloud: '#8a4a30', night: true, lava: true, edge: '#ff7a1a' },
  cosmos: { sky: ['#07041f', '#5a2aa8'], fog: '#2e1870', grass: '#4a3aa8', grass2: '#5a48c0', path: '#9a8aff', path2: '#7f6ef0', far: ['#6a44c8', '#4a2fa0', '#8a5ae0'], props: ['crystalP', 'crystalB', 'pillar', 'rock4', 'crystalP'], ambient: 'stars', sun: '#efe6ff', hemi: ['#b0a4ff', '#2e2070'], cloud: '#5a3aa8', night: true, space: true, edge: '#48e1ff' },
};

function grassTexture(c1, c2, seed) {
  const rnd = seeded(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = c1;
  g.fillRect(0, 0, 256, 256);
  const col = new THREE.Color(c2);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    const l = rnd() * 0.12 - 0.06;
    const cc = col.clone().offsetHSL(0, 0, l);
    g.fillStyle = cc.getStyle();
    g.globalAlpha = 0.5 + rnd() * 0.5;
    const w = 2 + rnd() * 3, hh = 5 + rnd() * 8;
    for (const ox of [0, -256, 256]) for (const oy of [0, -256, 256]) {
      g.beginPath();
      g.ellipse(x + ox, y + oy, w, hh, rnd() * 0.6 - 0.3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function pathTexture(c1, c2, seed) {
  const rnd = seeded(seed);
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.16, c1);
  gr.addColorStop(0.84, c1);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 256, y = 22 + rnd() * 84;
    g.fillStyle = rnd() > 0.5 ? c2 : new THREE.Color(c1).offsetHSL(0, 0, 0.06).getStyle();
    for (const ox of [0, -256, 256]) {
      g.beginPath();
      g.ellipse(x + ox, y, 3 + rnd() * 7, 2 + rnd() * 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ Décors
function addProp(b, type, x, z, s, rnd, L) {
  const P = (dx, dy, dz) => [x + dx * s, dy * s, z + dz * s];
  switch (type) {
    case 'tree': {
      b.cyl(0.14 * s, 0.2 * s, 1.1 * s, '#8a5a32', { pos: P(0, 0.55, 0) }, 8);
      const c = new THREE.Color(L.grass2).offsetHSL(0.02, 0.1, -0.02 + rnd() * 0.05).getStyle();
      b.sphere(0.75 * s, c, { pos: P(0, 1.5, 0) }, 12, 10);
      b.sphere(0.55 * s, c, { pos: P(0.5, 1.2, 0.1) }, 12, 10);
      b.sphere(0.5 * s, c, { pos: P(-0.45, 1.25, 0.05) }, 12, 10);
      if (rnd() > 0.5) for (let i = 0; i < 3; i++) b.sphere(0.08 * s, '#ff4d5e', { pos: P(rnd() - 0.5, 1.2 + rnd() * 0.7, 0.55) }, 6, 5);
      break;
    }
    case 'autumn': {
      b.cyl(0.13 * s, 0.2 * s, 1.1 * s, '#6b3f22', { pos: P(0, 0.55, 0) }, 8);
      const c = ['#ff8c2b', '#e85a1f', '#ffc23d'][Math.floor(rnd() * 3)];
      b.sphere(0.72 * s, c, { pos: P(0, 1.55, 0) }, 12, 10);
      b.sphere(0.5 * s, c, { pos: P(0.45, 1.25, 0.1) }, 12, 10);
      break;
    }
    case 'pine': case 'pine2': case 'pine3': {
      const c = type === 'pine3' ? '#2f7a5a' : type === 'pine2' ? '#6b7a2a' : '#2f8a3f';
      b.cyl(0.1 * s, 0.14 * s, 0.6 * s, '#6b4226', { pos: P(0, 0.3, 0) }, 6);
      for (let i = 0; i < 3; i++) {
        b.cone((0.75 - i * 0.18) * s, 0.8 * s, c, { pos: P(0, 0.85 + i * 0.5, 0) }, 9);
        if (type === 'pine3') b.cone((0.6 - i * 0.16) * s, 0.3 * s, '#ffffff', { pos: P(0, 1.1 + i * 0.5, 0) }, 9);
      }
      break;
    }
    case 'palm': {
      for (let i = 0; i < 5; i++) b.cyl(0.11 * s, 0.13 * s, 0.45 * s, '#b8864f', { pos: P(i * 0.05, 0.22 + i * 0.42, 0), rot: [0, 0, -0.08] }, 7);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.sphere(0.6 * s, '#3fb34f', { pos: P(0.25 + Math.cos(a) * 0.5, 2.2, Math.sin(a) * 0.5), scale: [1.2, 0.12, 0.35], rot: [0, -a, -0.35] }, 8, 6);
      }
      b.sphere(0.12 * s, '#7a4a20', { pos: P(0.25, 2.1, 0.1) }, 8, 6);
      break;
    }
    case 'bush': case 'bush2': {
      const c = type === 'bush2' ? '#c4602f' : new THREE.Color(L.grass2).offsetHSL(0, 0.05, -0.05).getStyle();
      b.sphere(0.45 * s, c, { pos: P(0, 0.3, 0) }, 10, 8);
      b.sphere(0.35 * s, c, { pos: P(0.4, 0.22, 0.05) }, 10, 8);
      b.sphere(0.32 * s, c, { pos: P(-0.38, 0.2, 0) }, 10, 8);
      break;
    }
    case 'flower': {
      const c = ['#ff6fb5', '#ffd23f', '#ffffff', '#b968ff', '#ff4d5e'][Math.floor(rnd() * 5)];
      for (let i = 0; i < 3; i++) {
        const dx = (rnd() - 0.5) * 0.6, dz = (rnd() - 0.5) * 0.6;
        b.cyl(0.02 * s, 0.02 * s, 0.35 * s, '#3f9a3a', { pos: P(dx, 0.17, dz) }, 4);
        b.sphere(0.1 * s, c, { pos: P(dx, 0.38, dz), scale: [1, 0.5, 1] }, 8, 6);
        b.sphere(0.04 * s, '#ffd23f', { pos: P(dx, 0.42, dz) }, 6, 4);
      }
      break;
    }
    case 'rock': case 'rock2': case 'rock3': case 'rock4': {
      const c = { rock: '#9aa3ad', rock2: '#c4d2e4', rock3: '#4a3530', rock4: '#5a4aa0' }[type];
      b.dodeca(0.45 * s, c, { pos: P(0, 0.2, 0), scale: [1.2, 0.7, 1], rot: [rnd(), rnd(), rnd()] });
      b.dodeca(0.25 * s, c, { pos: P(0.45, 0.1, 0.1), rot: [rnd(), rnd(), 0] });
      if (type === 'rock2') b.sphere(0.4 * s, '#ffffff', { pos: P(0, 0.4, 0), scale: [1.1, 0.35, 0.9] }, 10, 6);
      break;
    }
    case 'pumpkin': {
      for (let i = 0; i < 5; i++) b.sphere(0.32 * s, '#ff8c2b', { pos: P(Math.cos(i * 1.25) * 0.12, 0.28, Math.sin(i * 1.25) * 0.12), scale: [0.8, 0.85, 0.8] }, 10, 8);
      b.cyl(0.04 * s, 0.05 * s, 0.18 * s, '#5a7a2a', { pos: P(0, 0.62, 0) }, 6);
      break;
    }
    case 'shell': {
      b.cone(0.3 * s, 0.25 * s, '#ffc2d1', { pos: P(0, 0.12, 0), rot: [0.2, 0, 0], scale: [1, 1, 0.6] }, 9);
      b.sphere(0.3 * s, '#ffe0c0', { pos: P(0.6, 0.08, 0.2), scale: [1, 0.3, 0.8] }, 8, 6);
      break;
    }
    case 'umbrella': {
      b.cyl(0.03 * s, 0.03 * s, 2 * s, '#ffffff', { pos: P(0, 1, 0) }, 6);
      for (let i = 0; i < 8; i++) b.cone(1 * s, 0.4 * s, i % 2 ? '#ff4d5e' : '#ffffff', { pos: P(0, 2, 0), rot: [0, (i / 8) * Math.PI * 2, 0] }, 2);
      break;
    }
    case 'snowman': {
      b.sphere(0.45 * s, '#ffffff', { pos: P(0, 0.4, 0) }, 12, 10);
      b.sphere(0.32 * s, '#ffffff', { pos: P(0, 1.0, 0) }, 12, 10);
      b.cone(0.06 * s, 0.3 * s, '#ff8c2b', { pos: P(0, 1.0, 0.38), rot: [Math.PI / 2, 0, 0] }, 6);
      b.cyl(0.22 * s, 0.22 * s, 0.3 * s, '#1d1530', { pos: P(0, 1.42, 0) }, 10);
      b.torus(0.3 * s, 0.06 * s, '#ff4d5e', { pos: P(0, 0.75, 0), rot: [Math.PI / 2, 0, 0] });
      break;
    }
    case 'lamp': {
      b.cyl(0.06 * s, 0.09 * s, 2.4 * s, '#2a2340', { pos: P(0, 1.2, 0) }, 8);
      b.box(0.5 * s, 0.08 * s, 0.08 * s, '#2a2340', { pos: P(0.2, 2.4, 0) });
      break;
    }
    case 'crate': {
      b.box(0.8 * s, 0.8 * s, 0.8 * s, '#3a2a6a', { pos: P(0, 0.4, 0), rot: [0, rnd(), 0] });
      break;
    }
    case 'neon': {
      b.box(0.1 * s, 2 * s, 0.1 * s, '#2a2340', { pos: P(0, 1, 0) });
      break;
    }
    case 'dead': {
      b.cyl(0.08 * s, 0.16 * s, 1.4 * s, '#2a1814', { pos: P(0, 0.7, 0), rot: [0, 0, 0.1] }, 6);
      b.cyl(0.04 * s, 0.07 * s, 0.7 * s, '#2a1814', { pos: P(0.25, 1.2, 0), rot: [0, 0, -0.9] }, 5);
      b.cyl(0.04 * s, 0.07 * s, 0.6 * s, '#2a1814', { pos: P(-0.2, 1.0, 0), rot: [0, 0, 0.9] }, 5);
      break;
    }
    case 'pillar': {
      b.cyl(0.3 * s, 0.35 * s, 2.2 * s, '#3b2f80', { pos: P(0, 1.1, 0) }, 8);
      b.cyl(0.42 * s, 0.42 * s, 0.2 * s, '#5546c8', { pos: P(0, 2.25, 0) }, 8);
      break;
    }
    default: break;
  }
}
function addGlowProp(g, type, x, z, s, rnd) {
  const add = (geo, color, pos, rot, op = 1) => {
    const m = new THREE.Mesh(geo, glowMat(color, op));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    g.add(m);
  };
  if (type === 'lamp') add(new THREE.SphereGeometry(0.16 * s, 10, 8), '#ffd27a', [x + 0.4 * s, 2.32 * s, z]);
  if (type.startsWith('crystal')) {
    const c = { crystalB: '#7fd8ff', crystalP: '#c77dff', crystalR: '#ff4d4d' }[type];
    for (let i = 0; i < 3; i++) add(new THREE.OctahedronGeometry(0.3 * s * (1 - i * 0.2)), c, [x + (i - 1) * 0.3 * s, 0.4 * s + i * 0.1, z + rnd() * 0.3], [0, rnd() * 3, (i - 1) * 0.4], 0.85);
  }
  if (type === 'neon') add(new THREE.BoxGeometry(1.2 * s, 0.4 * s, 0.05), ['#ff4fd8', '#3ff5ff', '#ffe14d'][Math.floor(rnd() * 3)], [x, 1.8 * s, z + 0.08], null, 0.9);
  if (type === 'lava') add(new THREE.CircleGeometry(0.7 * s, 16), '#ff5a1f', [x, 0.02, z], [-Math.PI / 2, 0, 0], 0.9);
  if (type === 'pillar') add(new THREE.OctahedronGeometry(0.25 * s), '#fff27a', [x, 2.7 * s, z]);
}

const CHUNK = 26;

export class World {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.camBase = new THREE.Vector3(-0.95, 5.3, 10.6);
    this.camTarget = new THREE.Vector3(-0.95, 1.0, 0);
    this.shake = 0;
    this.scrollSpeed = 0;
    this.time = 0;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445522, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    this.sun.position.set(-4, 10, 8);
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // Ciel dégradé
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, uT: { value: 0 }, stars: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform float uT; uniform float stars; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float t = smoothstep(-0.05, 0.6, vP.y); vec3 c = mix(bot, top, t);
          if (stars > 0.5) { vec3 q = floor(vP*220.0); float s = step(0.996, h(q)); c += vec3(s) * (0.6 + 0.4*sin(uT*3.0 + h(q)*40.0)) * smoothstep(0.0,0.3,vP.y); }
          gl_FragColor = vec4(c,1.0); }`,
      side: THREE.BackSide, depthWrite: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), this.skyMat);
    this.scene.add(this.sky);

    // Sol + chemin
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), new THREE.MeshToonMaterial({ color: 0xffffff }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(0, 0, -6);
    this.scene.add(this.ground);
    this.path = new THREE.Mesh(new THREE.PlaneGeometry(90, 3.6), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    this.path.rotation.x = -Math.PI / 2;
    this.path.position.set(0, 0.005, 0.15);
    this.scene.add(this.path);

    this.chunks = [];
    this.farGroup = new THREE.Group();
    this.scene.add(this.farGroup);
    this.clouds = [];

    this.quality = 'high';
    this.composer = null;
    this.setupComposer();
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(container);
    else window.addEventListener('resize', () => this.resize());
  }

  setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q) {
    this.quality = q;
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const dprMax = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
    const dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
      this.bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5);
    }
    const aspect = w / h;
    this.camera.aspect = aspect;
    const halfW = 4.7, dist = this.camBase.distanceTo(this.camTarget);
    const hf = Math.atan(halfW / dist);
    let vf = 2 * Math.atan(Math.tan(hf) / aspect) * 180 / Math.PI;
    this.camera.fov = Math.max(34, Math.min(62, vf));
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  setBiome(id, seed = 1) {
    const L = BIOME_LOOK[id] || BIOME_LOOK.garden;
    this.look = L;
    this.biome = id;
    this.skyMat.uniforms.top.value.set(L.sky[0]);
    this.skyMat.uniforms.bot.value.set(L.sky[1]);
    this.skyMat.uniforms.stars.value = L.night ? 1 : 0;
    this.scene.fog = new THREE.Fog(L.fog, 18, 60);
    this.hemi.color.set(L.hemi[0]);
    this.hemi.groundColor.set(L.hemi[1]);
    this.sun.color.set(L.sun);
    this.sun.intensity = L.night ? 1.7 : 2.1;
    this.hemi.intensity = L.night ? 1.35 : 1.25;
    // liseré lumineux le long du chemin (biomes nocturnes)
    if (this.edges) { this.scene.remove(this.edges); this.edges = null; }
    if (L.edge) {
      this.edges = new THREE.Group();
      for (const z of [-1.62, 1.92]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.08), glowMat(L.edge, 0.9));
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, 0.02, z);
        this.edges.add(m);
      }
      this.scene.add(this.edges);
    }
    const old = [this.ground.material.map, this.path.material.map];
    this.ground.material.map = grassTexture(L.grass, L.grass2, seed);
    this.ground.material.map.repeat.set(18, 8);
    this.ground.material.needsUpdate = true;
    this.path.material.map = pathTexture(L.path, L.path2, seed + 3);
    this.path.material.map.repeat.set(9, 1);
    this.path.material.needsUpdate = true;
    old.forEach((t) => t && t.dispose());

    // chunks de décor
    for (const c of this.chunks) { this.scene.remove(c); c.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.chunks = [];
    for (let i = 0; i < 2; i++) {
      const c = this.buildChunk(L, seed * 31 + i * 7);
      c.position.x = -CHUNK / 2 + i * CHUNK;
      this.scene.add(c);
      this.chunks.push(c);
    }
    this.buildFar(L, seed);
  }

  buildChunk(L, seed) {
    const rnd = seeded(seed + 11);
    const g = new THREE.Group();
    const b = new PartBuilder();
    const glow = new THREE.Group();
    const place = (zmin, zmax, n, smin, smax, filter) => {
      for (let i = 0; i < n; i++) {
        const types = filter ? L.props.filter(filter) : L.props;
        if (!types.length) return;
        const type = types[Math.floor(rnd() * types.length)];
        const x = (i + rnd() * 0.8) * (CHUNK / n) - CHUNK / 2;
        const z = zmin + rnd() * (zmax - zmin);
        const s = smin + rnd() * (smax - smin);
        addProp(b, type, x, z, s, rnd, L);
        addGlowProp(glow, type, x, z, s, rnd);
      }
    };
    place(-11, -3.2, 9, 0.9, 1.5);
    place(-16, -10, 7, 1.2, 1.8);
    place(3.2, 5.2, 4, 0.45, 0.7, (t) => ['flower', 'rock', 'rock2', 'rock3', 'rock4', 'shell', 'bush', 'bush2', 'pumpkin', 'crystalB', 'crystalP', 'crystalR', 'crate'].includes(t));
    // touffes d'herbe
    for (let i = 0; i < 26; i++) {
      const x = rnd() * CHUNK - CHUNK / 2, z = (rnd() > 0.5 ? -1 : 1) * (2.1 + rnd() * 2.5);
      const c = new THREE.Color(L.grass2).offsetHSL(0, 0, -0.04 + rnd() * 0.08).getStyle();
      for (let k = 0; k < 3; k++) b.cone(0.05, 0.28 + rnd() * 0.15, c, { pos: [x + (k - 1) * 0.07, 0.12, z], rot: [0, 0, (k - 1) * 0.35] }, 4);
    }
    const mesh = b.mesh();
    const o = new THREE.Mesh(mesh.geometry, outlineMat(0.03));
    g.add(mesh, o, glow);
    return g;
  }

  buildFar(L, seed) {
    while (this.farGroup.children.length) {
      const c = this.farGroup.children.pop();
      c.traverse((o) => o.geometry && o.geometry.dispose());
    }
    const rnd = seeded(seed * 7 + 5);
    const b = new PartBuilder();
    if (L.city) {
      for (let i = 0; i < 26; i++) {
        const x = -45 + i * 3.6 + rnd(), hgt = 4 + rnd() * 10;
        b.box(3, hgt, 3, L.far[i % 3], { pos: [x, hgt / 2 - 0.5, -26 - rnd() * 6] });
      }
      const win = new THREE.Group();
      for (let i = 0; i < 70; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), glowMat(['#ff4fd8', '#3ff5ff', '#ffe14d'][i % 3], 0.8));
        m.position.set(-45 + rnd() * 90, 1 + rnd() * 9, -24.3);
        win.add(m);
      }
      this.farGroup.add(win);
    } else {
      for (let i = 0; i < 18; i++) {
        const x = -48 + i * 5.6 + rnd() * 2, r = 4 + rnd() * 5;
        const c = L.far[i % 3];
        if (L.space) b.sphere(r * 0.6, c, { pos: [x, 3 + rnd() * 8, -40 - rnd() * 10] }, 16, 12);
        else b.sphere(r, c, { pos: [x, -r * 0.35, -24 - rnd() * 8], scale: [1.4, 1, 1] }, 14, 10);
        if (id_is(L, 'snow')) b.sphere(r * 0.5, '#ffffff', { pos: [x, r * 0.45, -24 - 2], scale: [1.4, 0.5, 1] }, 10, 8);
      }
      if (L.lava) {
        b.cone(8, 9, '#3a1c16', { pos: [8, 3.5, -34] }, 14);
        const lava = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), glowMat('#ff5a1f', 0.95));
        lava.position.set(8, 8.1, -34);
        this.farGroup.add(lava);
      }
      if (L.space) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.3, 6, 48), glowMat('#ff7ae0', 0.6));
        ring.position.set(-12, 12, -45);
        ring.rotation.x = 1.2;
        this.farGroup.add(ring);
      }
    }
    const far = b.mesh();
    this.farGroup.add(far);
    // nuages
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const cb = new PartBuilder();
      for (let k = 0; k < 4; k++) cb.sphere(1 + rnd() * 0.8, L.cloud, { pos: [k * 1.2, rnd() * 0.5, rnd() * 0.5], scale: [1, 0.7, 0.8] }, 12, 8);
      const m = cb.mesh(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: null, transparent: true, opacity: L.night ? 0.35 : 0.92 }));
      m.position.set(-40 + i * 15 + rnd() * 5, 9 + rnd() * 5, -30 - rnd() * 8);
      this.farGroup.add(m);
      this.clouds.push(m);
    }
  }

  // position écran (px) d'un point 3D
  project(v, out) {
    const p = v.clone().project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.w;
    out.y = (-p.y * 0.5 + 0.5) * this.h;
    return out;
  }

  update(dt) {
    this.time += dt;
    this.skyMat.uniforms.uT.value = this.time;
    const dx = this.scrollSpeed * dt;
    if (dx) {
      for (const c of this.chunks) {
        c.position.x -= dx;
        if (c.position.x < -CHUNK * 1.5) c.position.x += CHUNK * 2;
      }
      if (this.ground.material.map) this.ground.material.map.offset.x += (dx / 90) * 18;
      if (this.path.material.map) this.path.material.map.offset.x += (dx / 90) * 9;
    }
    for (const c of this.clouds) {
      c.position.x += dt * 0.4 + dx * 0.05;
      if (c.position.x > 50) c.position.x = -50;
    }
    // caméra + tremblement
    this.camera.position.copy(this.camBase);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camTarget);
  }

  render() {
    if (this.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
}

function id_is(L, id) { return L === BIOME_LOOK[id]; }
