import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Rampe de lumière « cel shading » à 4 paliers
let _grad = null;
export function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([90, 90, 90, 255, 160, 160, 160, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
  _grad = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  _grad.minFilter = THREE.NearestFilter;
  _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}

export function toonMat(opts = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: gradientMap(), vertexColors: opts.color == null, color: opts.color ?? 0xffffff, ...opts.extra });
}

// Contour « inverted hull » par extrusion le long des normales : fonctionne sur des géométries fusionnées
const outlineCache = new Map();
export function outlineMat(thickness = 0.035, color = 0x1a1020) {
  const key = thickness + '_' + color;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: thickness }, uC: { value: new THREE.Color(color) }, uO: { value: 1 } },
    vertexShader: `uniform float uT; void main(){ vec3 p = position + normal * uT; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; void main(){ gl_FragColor = vec4(uC, uO); }`,
    side: THREE.BackSide,
  });
  outlineCache.set(key, m);
  return m;
}

export function withOutline(mesh, thickness = 0.035, color) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(thickness, color));
  o.raycast = () => {};
  mesh.add(o);
  mesh.userData.outline = o;
  return mesh;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// Assemble des primitives colorées en une seule géométrie (1 draw call)
export class PartBuilder {
  constructor() { this.geos = []; }
  add(geo, color, o = {}) {
    let g = geo.index ? geo : geo;
    g = g.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    _e.set(...(o.rot || [0, 0, 0]));
    _q.setFromEuler(_e);
    _v.set(...(o.pos || [0, 0, 0]));
    const sc = o.scale == null ? [1, 1, 1] : typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale;
    _s.set(...sc);
    _m.compose(_v, _q, _s);
    g.applyMatrix4(_m);
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.index) {
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    this.geos.push(g);
    return this;
  }
  sphere(r, color, o, w = 18, hgt = 14) { return this.add(new THREE.SphereGeometry(r, w, hgt), color, o); }
  cone(r, hgt, color, o, seg = 14) { return this.add(new THREE.ConeGeometry(r, hgt, seg), color, o); }
  cyl(rt, rb, hgt, color, o, seg = 14) { return this.add(new THREE.CylinderGeometry(rt, rb, hgt, seg), color, o); }
  box(w, hgt, d, color, o) { return this.add(new THREE.BoxGeometry(w, hgt, d), color, o); }
  torus(r, t, color, o, arc = Math.PI * 2, seg = 24) { return this.add(new THREE.TorusGeometry(r, t, 8, seg, arc), color, o); }
  ico(r, color, o, d = 0) { return this.add(new THREE.IcosahedronGeometry(r, d), color, o); }
  octa(r, color, o) { return this.add(new THREE.OctahedronGeometry(r, 0), color, o); }
  dodeca(r, color, o) { return this.add(new THREE.DodecahedronGeometry(r, 0), color, o); }
  geometry() {
    if (!this.geos.length) return new THREE.BufferGeometry();
    const norm = this.geos.map((g) => {
      // homogénéiser les attributs (position, normal, uv, color)
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      if (g.index && !(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(new Uint32Array(g.index.array), 1));
      return g;
    });
    const merged = mergeGeometries(norm, false);
    merged.computeBoundingSphere();
    return merged;
  }
  mesh(mat) { return new THREE.Mesh(this.geometry(), mat || toonMat()); }
}

// Matériau additif lumineux (pour bloom)
export function glowMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

let _blob = null;
export function blobShadowTex() {
  if (_blob) return _blob;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _blob = new THREE.CanvasTexture(c);
  return _blob;
}
export function blobShadow(size = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  m.renderOrder = 1;
  return m;
}
