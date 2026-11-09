import * as THREE from 'three';

const MAX_P = 3500;

// ------------------------------------------------------------------ Système de particules GPU (points additifs)
class Particles {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 3);
    this.size = new Float32Array(MAX_P);
    this.alpha = new Float32Array(MAX_P);
    this.shape = new Float32Array(MAX_P);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aShape;
        uniform float uScale; varying vec3 vC; varying float vA; varying float vS;
        void main(){ vC = aColor; vA = aAlpha; vS = aShape; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; varying float vS;
        void main(){ vec2 p = gl_PointCoord*2.0-1.0; float d = length(p); float a;
          if (vS < 0.5) { a = smoothstep(1.0, 0.0, d); a *= a; }
          else if (vS < 1.5) { float s = max(0.0, 1.0 - abs(p.x*p.y)*16.0 - d*0.7); a = s + smoothstep(0.3,0.0,d); }
          else { a = smoothstep(1.0,0.85,d) * smoothstep(0.55,0.75,d); }
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC * (1.2 + (1.0-d)), a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.g = g;
    this.n = 0;
    // données CPU
    this.vel = new Float32Array(MAX_P * 3);
    this.life = new Float32Array(MAX_P);
    this.max = new Float32Array(MAX_P);
    this.s0 = new Float32Array(MAX_P);
    this.s1 = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.drag = new Float32Array(MAX_P);
    this.a0 = new Float32Array(MAX_P);
  }
  emit(x, y, z, vx, vy, vz, r, gg, b, size, life, o = {}) {
    if (this.n >= MAX_P) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = gg; this.col[i * 3 + 2] = b;
    this.size[i] = size; this.s0[i] = size; this.s1[i] = o.endSize ?? 0;
    this.life[i] = 0; this.max[i] = life;
    this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 1.5;
    this.a0[i] = o.alpha ?? 1; this.alpha[i] = this.a0[i];
    this.shape[i] = o.shape ?? 0;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        const j = --this.n;
        if (i !== j) this.copy(j, i);
        continue;
      }
      const t = this.life[i] / this.max[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t * 10 : 1 - (t - 0.1) / 0.9);
      i++;
    }
    const g = this.g;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aShape.needsUpdate = true;
  }
  copy(a, b) {
    for (let k = 0; k < 3; k++) {
      this.pos[b * 3 + k] = this.pos[a * 3 + k];
      this.vel[b * 3 + k] = this.vel[a * 3 + k];
      this.col[b * 3 + k] = this.col[a * 3 + k];
    }
    this.size[b] = this.size[a]; this.s0[b] = this.s0[a]; this.s1[b] = this.s1[a];
    this.life[b] = this.life[a]; this.max[b] = this.max[a]; this.grav[b] = this.grav[a];
    this.drag[b] = this.drag[a]; this.a0[b] = this.a0[a]; this.alpha[b] = this.alpha[a]; this.shape[b] = this.shape[a];
  }
}

// ------------------------------------------------------------------ Géométries partagées
function crescentGeo(arc = Math.PI * 0.9, r = 1, w = 0.35, seg = 32) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = -arc / 2 + arc * t;
    const ww = w * Math.sin(Math.PI * t) + 0.01;
    const ri = r - ww * 0.5, ro = r + ww * 0.5;
    pos.push(Math.cos(a) * ri, Math.sin(a) * ri, 0, Math.cos(a) * ro, Math.sin(a) * ro, 0);
    uv.push(t, 0, t, 1);
    if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const GEO = {};
function geo(name) {
  if (GEO[name]) return GEO[name];
  switch (name) {
    case 'crescent': GEO[name] = crescentGeo(); break;
    case 'ring': GEO[name] = new THREE.RingGeometry(0.82, 1, 56); break;
    case 'sphere': GEO[name] = new THREE.SphereGeometry(1, 32, 20); break;
    case 'beam': GEO[name] = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2); break;
    case 'pillar': GEO[name] = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0); break;
    case 'disc': GEO[name] = new THREE.CircleGeometry(1, 40); break;
    default: break;
  }
  return GEO[name];
}

function fxm(m) { m.userData.fx = true; return m; }
function slashMat(color) {
  return fxm(new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uP: { value: 0 }, uF: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uC; uniform float uP; uniform float uF; varying vec2 vUv;
      void main(){ float t = vUv.x; float head = smoothstep(uP - 0.7, uP, t) * step(t, uP + 0.001);
        float e = 1.0 - abs(vUv.y - 0.5) * 2.0; vec3 c = mix(uC * 1.6, vec3(2.2), pow(e, 4.0));
        float a = head * smoothstep(0.0, 0.5, e) * uF; gl_FragColor = vec4(c, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
}
function fresnelMat(color, op = 1) {
  return fxm(new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uO: { value: op } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uO; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(vN, vV)); float a = pow(f, 2.2) + 0.08; gl_FragColor = vec4(uC * (1.0 + f * 1.5), a * uO); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}
function addMat(color, op = 1) {
  return fxm(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();

export class FX {
  constructor(world, textLayer, flashEl) {
    this.world = world;
    this.scene = world.scene;
    this.p = new Particles(this.scene);
    this.items = [];
    this.textLayer = textLayer;
    this.flashEl = flashEl;
    this.texts = [];
    this.textPool = [];
    this.lowFx = false;
  }
  setScale() {
    const r = this.world.renderer;
    const h = this.world.h * r.getPixelRatio();
    this.p.mat.uniforms.uScale.value = h * 0.5 / Math.tan((this.world.camera.fov * Math.PI) / 360);
  }

  // ---------------------------------------------------- particules
  burst(pos, o = {}) {
    const n = Math.round((o.count ?? 20) * (this.lowFx ? 0.5 : 1));
    const sp = o.speed ?? 3;
    const cols = (Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff']).map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      let vx = (Math.random() - 0.5) * 2, vy = (Math.random() - 0.5) * 2, vz = (Math.random() - 0.5) * 2;
      const l = Math.hypot(vx, vy, vz) || 1;
      const s = sp * (0.4 + Math.random() * 0.6);
      vx = (vx / l) * s; vy = (vy / l) * s + (o.up ?? 0); vz = (vz / l) * s * (o.flatZ ?? 1);
      const sz = (o.size ?? 0.25) * (0.6 + Math.random() * 0.8);
      this.p.emit(pos.x + (Math.random() - 0.5) * (o.spread ?? 0), pos.y + (Math.random() - 0.5) * (o.spread ?? 0), pos.z + (Math.random() - 0.5) * (o.spread ?? 0),
        vx, vy, vz, c.r, c.g, c.b, sz, (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), { gravity: o.gravity ?? 0, drag: o.drag ?? 2, shape: o.shape ?? 0, endSize: o.endSize ?? 0, alpha: o.alpha ?? 1 });
    }
  }
  sparkle(pos, color = '#fff6b0', n = 1, size = 0.3, spread = 1) {
    _c.set(color);
    for (let i = 0; i < n; i++) this.p.emit(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread, pos.z + (Math.random() - 0.5) * spread, 0, 0.4, 0, _c.r, _c.g, _c.b, size * (0.5 + Math.random()), 0.8, { shape: 1, drag: 1 });
  }
  ambient(kind, dt) {
    if (this.lowFx && Math.random() < 0.5) return;
    const rate = { petals: 6, leaves: 8, bubbles: 6, snow: 30, fireflies: 7, embers: 14, stars: 10 }[kind] || 0;
    const n = rate * dt;
    for (let i = 0; i < n || Math.random() < n - i; i++) {
      if (i > 5) break;
      const x = (Math.random() - 0.5) * 22, z = -8 + Math.random() * 12;
      switch (kind) {
        case 'snow': _c.set('#ffffff'); this.p.emit(x, 7, z, -0.4, -1.1, 0, _c.r * 0.7, _c.g * 0.7, _c.b * 0.7, 0.12, 6, { drag: 0, alpha: 0.9 }); break;
        case 'petals': _c.set(Math.random() > 0.5 ? '#ff9fc8' : '#ffffff'); this.p.emit(x, 6, z, -0.6, -0.6, 0, _c.r * 0.6, _c.g * 0.6, _c.b * 0.6, 0.13, 7, { drag: 0, alpha: 0.8 }); break;
        case 'leaves': _c.set(Math.random() > 0.5 ? '#ff8c2b' : '#ffc23d'); this.p.emit(x, 6, z, -0.8, -0.7, 0, _c.r * 0.6, _c.g * 0.5, _c.b * 0.4, 0.16, 7, { drag: 0, alpha: 0.85 }); break;
        case 'bubbles': _c.set('#bff4ff'); this.p.emit(x, 0, z, 0, 0.8, 0, _c.r * 0.5, _c.g * 0.5, _c.b * 0.5, 0.2, 5, { drag: 0, shape: 2, alpha: 0.8 }); break;
        case 'fireflies': _c.set(Math.random() > 0.5 ? '#ff4fd8' : '#3ff5ff'); this.p.emit(x, 0.5 + Math.random() * 3, z, (Math.random() - 0.5) * 0.5, 0.2, 0, _c.r, _c.g, _c.b, 0.14, 4, { drag: 0 }); break;
        case 'embers': _c.set(Math.random() > 0.3 ? '#ff7a2f' : '#ffd23f'); this.p.emit(x, 0, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), 0, _c.r, _c.g, _c.b, 0.1, 3.5, { drag: 0 }); break;
        case 'stars': _c.set(Math.random() > 0.5 ? '#c77dff' : '#ffffff'); this.p.emit(x, Math.random() * 5, z, 0, 0.1, 0, _c.r, _c.g, _c.b, 0.15, 3, { drag: 0, shape: 1 }); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------- objets
  add(obj, life, upd) {
    this.scene.add(obj);
    this.items.push({ obj, life, t: 0, upd });
    return obj;
  }
  slash(pos, color = '#ffffff', o = {}) {
    const m = new THREE.Mesh(geo('crescent'), slashMat(color));
    m.position.copy(pos);
    m.rotation.set(o.rx ?? 0.3, o.ry ?? 0.6, o.rz ?? (Math.random() - 0.5) * 1.2);
    const s = o.scale ?? 1.1;
    m.scale.setScalar(s);
    const life = o.life ?? 0.28;
    this.add(m, life, (t) => {
      m.material.uniforms.uP.value = Math.min(1.25, t * 1.6);
      m.material.uniforms.uF.value = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      m.scale.setScalar(s * (1 + t * 0.25));
    });
  }
  ring(pos, color = '#ffffff', o = {}) {
    const m = new THREE.Mesh(geo('ring'), addMat(color, o.opacity ?? 0.9));
    m.position.copy(pos);
    if (o.vertical) m.rotation.y = Math.PI / 2 - 0.5;
    else m.rotation.x = -Math.PI / 2;
    const r0 = o.r0 ?? 0.2, r1 = o.r1 ?? 2.5;
    const op = o.opacity ?? 0.9;
    this.add(m, o.life ?? 0.5, (t) => {
      const e = 1 - Math.pow(1 - t, 3);
      m.scale.setScalar(r0 + (r1 - r0) * e);
      m.material.opacity = op * (1 - t);
    });
  }
  blast(pos, color = '#ffb52e', o = {}) {
    const m = new THREE.Mesh(geo('sphere'), fresnelMat(color, 1));
    m.position.copy(pos);
    const r0 = o.r0 ?? 0.2, r1 = o.r1 ?? 2;
    this.add(m, o.life ?? 0.5, (t) => {
      const e = 1 - Math.pow(1 - t, 2.5);
      m.scale.setScalar(r0 + (r1 - r0) * e);
      m.material.uniforms.uO.value = 1 - t;
    });
    const core = new THREE.Mesh(geo('sphere'), addMat('#ffffff', 1));
    core.position.copy(pos);
    this.add(core, (o.life ?? 0.5) * 0.5, (t) => { core.scale.setScalar((r0 + (r1 - r0) * 0.5 * t) * 0.6); core.material.opacity = 1 - t; });
  }
  pillar(pos, color = '#ffd23f', o = {}) {
    const m = new THREE.Mesh(geo('pillar'), fresnelMat(color, 1));
    m.position.copy(pos);
    m.position.y = 0;
    const r = o.r ?? 0.9, hgt = o.h ?? 9;
    this.add(m, o.life ?? 0.9, (t) => {
      const w = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      m.scale.set(r * (0.3 + w * 0.7), hgt, r * (0.3 + w * 0.7));
      m.material.uniforms.uO.value = w;
    });
  }
  beam(from, to, color = '#ff3d55', o = {}) {
    const len = from.distanceTo(to);
    const grp = new THREE.Group();
    const outer = new THREE.Mesh(geo('beam'), addMat(color, 0.75));
    const inner = new THREE.Mesh(geo('beam'), addMat('#ffffff', 1));
    grp.add(outer, inner);
    grp.position.copy(from);
    grp.lookAt(to);
    const w = o.width ?? 0.14;
    this.add(grp, o.life ?? 0.5, (t) => {
      const k = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      outer.scale.set(w * k * 1.8, w * k * 1.8, len);
      inner.scale.set(w * k * 0.6, w * k * 0.6, len);
      if (o.follow) { grp.lookAt(o.follow()); }
    });
  }
  lightning(from, to, color = '#9fe8ff', o = {}) {
    const pts = [from.clone()];
    const segs = 9;
    for (let i = 1; i < segs; i++) {
      const p = from.clone().lerp(to, i / segs);
      p.x += (Math.random() - 0.5) * 0.9; p.z += (Math.random() - 0.5) * 0.4;
      pts.push(p);
    }
    pts.push(to.clone());
    const mk = (width, colr, op) => {
      const pos = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = (-dy / l) * width, ny = (dx / l) * width;
        pos.push(pts[i].x + nx, pts[i].y + ny, pts[i].z, pts[i].x - nx, pts[i].y - ny, pts[i].z);
        if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      return new THREE.Mesh(g, addMat(colr, op));
    };
    const grp = new THREE.Group();
    const glow = mk(0.22, color, 0.5), core = mk(0.06, '#ffffff', 1);
    grp.add(glow, core);
    this.add(grp, o.life ?? 0.35, (t, done) => {
      const f = Math.random() > 0.3 ? 1 - t : 0.2;
      glow.material.opacity = 0.5 * f; core.material.opacity = f;
      if (done) { glow.geometry.dispose(); core.geometry.dispose(); }
    });
  }
  // projectile en arc avec traînée
  projectile(obj, from, to, o = {}) {
    obj.position.copy(from);
    const dur = o.dur ?? 0.45;
    const arc = o.arc ?? 1.2;
    const col = new THREE.Color(o.trail ?? '#ffffff');
    let hit = false;
    this.add(obj, dur, (t, done) => {
      const target = typeof to === 'function' ? to() : to;
      _v.copy(from).lerp(target, t);
      _v.y += Math.sin(t * Math.PI) * arc;
      obj.position.copy(_v);
      if (o.spin) { obj.rotation.x += 0.3; obj.rotation.y += 0.2; }
      if (!this.lowFx || Math.random() > 0.5) this.p.emit(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0, col.r, col.g, col.b, o.trailSize ?? 0.3, 0.35, { drag: 3 });
      if (done && !hit) { hit = true; o.onHit && o.onHit(obj.position.clone()); }
    });
  }
  // objet temporaire animé librement
  custom(obj, life, upd) { return this.add(obj, life, upd); }

  shield(target) {
    const m = new THREE.Mesh(geo('sphere'), fresnelMat('#7fd8ff', 0.9));
    m.scale.setScalar(1.3);
    m.position.y = 1;
    target.add(m);
    return m;
  }
  fresnel(color, op) { return fresnelMat(color, op); }
  additive(color, op) { return addMat(color, op); }

  // ---------------------------------------------------- texte flottant DOM
  text(pos3, str, cls = '') {
    const s = this.world.project(pos3, { x: 0, y: 0 });
    let el = this.textPool.pop();
    if (!el) { el = document.createElement('div'); el.className = 'ftext'; el.appendChild(document.createElement('span')); }
    const span = el.firstChild;
    span.className = cls;
    span.textContent = str;
    el.style.transform = `translate(${(s.x + (Math.random() - 0.5) * 24).toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    this.textLayer.appendChild(el);
    this.texts.push({ el, t: 0, max: cls.includes('big') ? 1.3 : 0.95 });
    if (this.texts.length > 45) this.killText(0);
  }
  killText(i) {
    const x = this.texts[i];
    x.el.remove();
    this.textPool.push(x.el);
    this.texts.splice(i, 1);
  }
  flash(color = '#ffffff', strength = 0.6) {
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = strength;
    void el.offsetWidth;
    el.style.transition = 'opacity .45s ease-out';
    el.style.opacity = 0;
  }

  update(dt) {
    this.p.update(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      const done = it.t >= it.life;
      it.upd && it.upd(k, done, dt);
      if (done) {
        this.scene.remove(it.obj);
        it.obj.traverse((o) => { if (o.material && o.material.userData.fx) o.material.dispose(); });
        this.items.splice(i, 1);
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const x = this.texts[i];
      x.t += dt;
      if (x.t > x.max) this.killText(i);
    }
  }
  clear() {
    for (const it of this.items) this.scene.remove(it.obj);
    this.items = [];
    this.p.n = 0;
  }
}
