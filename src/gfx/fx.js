// =====================================================================
//  Effets visuels 2D : particules additives, entailles, ondes de choc,
//  rayons, éclairs, projectiles, colonnes de lumière, chiffres de dégâts.
// =====================================================================
import { rgba, shade, ell } from './draw.js';

const MAXP = 1100;
const spriteCache = new Map();
function glowSprite(color, kind) {
  const key = color + kind;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'star') {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba('#ffffff', 1)); gr.addColorStop(0.15, rgba(color, 0.9)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = i % 2 ? 6 : 32; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else if (kind === 'smoke') {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(color, 0.55)); gr.addColorStop(0.6, rgba(color, 0.25)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  } else if (kind === 'bubble') {
    g.strokeStyle = rgba(color, 0.9); g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = rgba('#ffffff', 0.7); g.beginPath(); g.arc(22, 22, 6, 0, Math.PI * 2); g.fill();
  } else {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba('#ffffff', 1)); gr.addColorStop(0.25, rgba(color, 0.85)); gr.addColorStop(0.6, rgba(color, 0.25)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  spriteCache.set(key, c);
  return c;
}

const TEXT_STYLE = {
  dmg: { size: 17, fill: '#ffffff', stroke: '#2b1838', dur: 0.9 },
  crit: { size: 25, fill: '#ffd23f', stroke: '#6a1a00', dur: 1.05, grad: ['#fff6b0', '#ffb52e'] },
  skill: { size: 20, fill: '#9ff0ff', stroke: '#0a2a5a', dur: 1 },
  pet: { size: 15, fill: '#ffd6f5', stroke: '#4a0a3a', dur: 0.85 },
  hurt: { size: 16, fill: '#ff6b7a', stroke: '#3a0010', dur: 0.9 },
  heal: { size: 17, fill: '#6dff9e', stroke: '#0a3a1a', dur: 1 },
  miss: { size: 14, fill: '#e0d8ff', stroke: '#2b1838', dur: 0.8 },
  tag: { size: 12, fill: '#ffffff', stroke: '#7a1060', dur: 0.9, bg: '#c2268f' },
  big: { size: 30, fill: '#ffd23f', stroke: '#5a2a00', dur: 1.4, grad: ['#fff6b0', '#ff9d1c'] },
  name: { size: 15, fill: '#ffffff', stroke: '#2b1838', dur: 1.1, bg: '#5e45ad' },
};

export class FX {
  constructor() {
    this.n = 0;
    const F = (k) => new Float32Array(MAXP);
    this.px = F(); this.py = F(); this.vx = F(); this.vy = F(); this.life = F(); this.max = F();
    this.size = F(); this.size1 = F(); this.grav = F(); this.drag = F(); this.rot = F(); this.vr = F(); this.alpha = F();
    this.kind = new Uint8Array(MAXP); // 0 glow,1 star,2 spark,3 debris,4 smoke,5 bubble
    this.col = new Array(MAXP);
    this.items = [];
    this.texts = [];
    this.low = false;
  }
  clear() { this.n = 0; this.items = []; this.texts = []; }

  emit(x, y, vx, vy, color, size, life, o = {}) {
    if (this.n >= MAXP) return;
    const i = this.n++;
    this.px[i] = x; this.py[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.col[i] = color; this.size[i] = size; this.size1[i] = o.endSize ?? 0;
    this.life[i] = 0; this.max[i] = life; this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 2;
    this.rot[i] = Math.random() * 6.28; this.vr[i] = (Math.random() - 0.5) * 12; this.alpha[i] = o.alpha ?? 1;
    this.kind[i] = { glow: 0, star: 1, spark: 2, debris: 3, smoke: 4, bubble: 5 }[o.shape || 'glow'] ?? 0;
  }
  burst(x, y, o = {}) {
    const n = Math.round((o.count ?? 16) * (this.low ? 0.5 : 1));
    const cols = Array.isArray(o.color) ? o.color : [o.color || '#ffffff'];
    const sp = o.speed ?? 120;
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spreadA ?? 1) : Math.random() * Math.PI * 2;
      const s = sp * (0.35 + Math.random() * 0.65);
      this.emit(x + (Math.random() - 0.5) * (o.spread ?? 0), y + (Math.random() - 0.5) * (o.spread ?? 0),
        Math.cos(a) * s, Math.sin(a) * s * (o.flatY ?? 1) - (o.up ?? 0), cols[i % cols.length], (o.size ?? 8) * (0.6 + Math.random() * 0.8),
        (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), { gravity: o.gravity, drag: o.drag, shape: o.shape, endSize: o.endSize, alpha: o.alpha });
    }
  }

  add(dur, draw, layer = 'front', upd) { const it = { t: 0, dur, draw, layer, upd }; this.items.push(it); return it; }

  // entaille en arc de cercle (coup d'arme)
  slash(x, y, o = {}) {
    const r = o.r ?? 34, arc = o.arc ?? 2.2, w = o.width ?? 12, ang = o.angle ?? -0.4, color = o.color || '#ffffff', dir = o.dir ?? 1;
    this.add(o.dur ?? 0.22, (ctx, k) => {
      const head = Math.min(1, k * 1.7), tail = Math.max(0, k * 1.7 - 0.65);
      if (head <= tail) return;
      const a0 = ang - arc / 2, a1 = ang + arc / 2;
      const s0 = a0 + (a1 - a0) * tail, s1 = a0 + (a1 - a0) * head;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(dir, o.squash ?? 0.75);
      ctx.globalCompositeOperation = 'lighter';
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const u0 = i / steps, u1 = (i + 1) / steps;
        const ww = w * Math.sin(Math.PI * (u0 + u1) / 2) * (1 - k * 0.5);
        const e0 = s0 + (s1 - s0) * u0, e1 = s0 + (s1 - s0) * u1;
        ctx.beginPath(); ctx.arc(0, 0, r, e0, e1 + 0.02);
        ctx.lineWidth = ww * 1.8; ctx.strokeStyle = rgba(color, 0.35 * (1 - k)); ctx.stroke();
        ctx.lineWidth = ww; ctx.strokeStyle = rgba(color, 0.9 * (1 - k * 0.6)); ctx.stroke();
        ctx.lineWidth = ww * 0.35; ctx.strokeStyle = rgba('#ffffff', 1 - k * 0.5); ctx.stroke();
      }
      ctx.restore();
    });
  }
  ring(x, y, o = {}) {
    const r0 = o.r0 ?? 6, r1 = o.r1 ?? 60, color = o.color || '#ffffff', sq = o.squash ?? 0.35, w = o.width ?? 6;
    this.add(o.dur ?? 0.45, (ctx, k) => {
      const e = 1 - Math.pow(1 - k, 3);
      const r = r0 + (r1 - r0) * e;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ell(ctx, x, y, r, r * sq);
      ctx.lineWidth = w * (1 - k) + 1; ctx.strokeStyle = rgba(color, 0.9 * (1 - k)); ctx.stroke();
      ctx.lineWidth = w * 2.4 * (1 - k); ctx.strokeStyle = rgba(color, 0.25 * (1 - k)); ctx.stroke();
      ctx.restore();
    }, o.layer || 'back');
  }
  blast(x, y, o = {}) {
    const r1 = o.r ?? 60, color = o.color || '#ffb52e';
    this.add(o.dur ?? 0.45, (ctx, k) => {
      const e = 1 - Math.pow(1 - k, 2.4);
      const r = r1 * (0.25 + e * 0.75);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba('#ffffff', 0.9 * (1 - k))); g.addColorStop(0.35, rgba(color, 0.75 * (1 - k))); g.addColorStop(0.8, rgba(color, 0.25 * (1 - k))); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }
  pillar(x, o = {}) {
    const w = o.width ?? 40, color = o.color || '#ffd23f', y1 = o.y ?? 300;
    this.add(o.dur ?? 0.8, (ctx, k) => {
      const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      const ww = w * (0.4 + a * 0.6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - ww, 0, x + ww, 0);
      g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.35, rgba(color, 0.55 * a)); g.addColorStop(0.5, rgba('#ffffff', 0.9 * a)); g.addColorStop(0.65, rgba(color, 0.55 * a)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.fillRect(x - ww, -20, ww * 2, y1 + 20);
      ell(ctx, x, y1, ww * 1.4, ww * 0.35); ctx.fillStyle = rgba(color, 0.5 * a); ctx.fill();
      ctx.restore();
    }, 'front');
  }
  beam(x1, y1, x2, y2, o = {}) {
    const color = o.color || '#ff3d55', w = o.width ?? 10;
    this.add(o.dur ?? 0.5, (ctx, k) => {
      const a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      const tgt = o.follow ? o.follow(k) : [x2, y2];
      const dx = tgt[0] - x1, dy = tgt[1] - y1, len = Math.hypot(dx, dy);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x1, y1); ctx.rotate(Math.atan2(dy, dx));
      const jit = 1 + Math.sin(k * 80) * 0.12;
      for (const [ww, c, al] of [[w * 2.6, color, 0.25], [w * 1.3, color, 0.7], [w * 0.45, '#ffffff', 1]]) {
        ctx.fillStyle = rgba(c, al * a);
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, -ww * jit / 2, len, ww * jit, ww / 2) : ctx.rect(0, -ww / 2, len, ww); ctx.fill();
      }
      ctx.restore();
    });
  }
  lightning(x1, y1, x2, y2, o = {}) {
    const pts = [[x1, y1]];
    const n = 9;
    for (let i = 1; i < n; i++) { const t = i / n; pts.push([x1 + (x2 - x1) * t + (Math.random() - 0.5) * 34, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10]); }
    pts.push([x2, y2]);
    const color = o.color || '#8fd9ff';
    this.add(o.dur ?? 0.35, (ctx, k) => {
      const f = Math.random() > 0.25 ? 1 - k : 0.25;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const [w, c, al] of [[14, color, 0.25], [6, color, 0.8], [2.4, '#ffffff', 1]]) {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.lineWidth = w; ctx.strokeStyle = rgba(c, al * f); ctx.stroke();
      }
      ctx.restore();
    });
  }
  // projectile : draw(ctx, x, y, angle, k) ; to = [x,y] ou fonction → [x,y]
  projectile(from, to, o = {}) {
    let hit = false;
    const st = { x: from[0], y: from[1] };
    const trail = o.trail;
    this.add(o.dur ?? 0.4, (ctx, k) => {
      if (o.draw) o.draw(ctx, st.x, st.y, st.a || 0, k);
    }, 'front', (k, done) => {
      const tg = typeof to === 'function' ? to() : to;
      const nx = from[0] + (tg[0] - from[0]) * k;
      const ny = from[1] + (tg[1] - from[1]) * k - Math.sin(k * Math.PI) * (o.arc ?? 30);
      st.a = Math.atan2(ny - st.y, nx - st.x);
      st.x = nx; st.y = ny;
      if (trail && (!this.low || Math.random() > 0.5)) this.emit(nx, ny, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, Array.isArray(trail.color) ? trail.color[Math.floor(Math.random() * trail.color.length)] : trail.color, trail.size ?? 10, trail.life ?? 0.3, { shape: trail.shape, drag: 4 });
      if (done && !hit) { hit = true; o.onHit && o.onHit(st.x, st.y); }
    });
  }
  custom(dur, draw, layer = 'front', upd) { return this.add(dur, draw, layer, upd); }

  text(x, y, str, style = 'dmg') {
    const S = TEXT_STYLE[style] || TEXT_STYLE.dmg;
    this.texts.push({ x: x + (Math.random() - 0.5) * 16, y, str, S, t: 0 });
    if (this.texts.length > 42) this.texts.shift();
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        const j = --this.n;
        if (i !== j) {
          this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.size1[i] = this.size1[j];
          this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.rot[i] = this.rot[j]; this.vr[i] = this.vr[j];
          this.alpha[i] = this.alpha[j]; this.kind[i] = this.kind[j]; this.col[i] = this.col[j];
        }
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
      i++;
    }
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      it.t += dt;
      const done = it.t >= it.dur;
      if (it.upd) it.upd(Math.min(1, it.t / it.dur), done, dt);
      if (done) this.items.splice(k, 1);
    }
    for (let k = this.texts.length - 1; k >= 0; k--) {
      const x = this.texts[k];
      x.t += dt;
      if (x.t > x.S.dur) this.texts.splice(k, 1);
    }
  }

  drawItems(ctx, layer) {
    for (const it of this.items) if (it.layer === layer && it.draw) it.draw(ctx, Math.min(1, it.t / it.dur));
  }
  drawParticles(ctx) {
    // passe normale (fumée, débris)
    for (let i = 0; i < this.n; i++) {
      const kd = this.kind[i];
      if (kd !== 3 && kd !== 4) continue;
      const k = this.life[i] / this.max[i];
      const a = this.alpha[i] * (1 - k);
      const s = this.size[i] + (this.size1[i] - this.size[i]) * k;
      ctx.globalAlpha = a;
      if (kd === 4) ctx.drawImage(glowSprite(this.col[i], 'smoke'), this.px[i] - s, this.py[i] - s, s * 2, s * 2);
      else {
        ctx.save(); ctx.translate(this.px[i], this.py[i]); ctx.rotate(this.rot[i]);
        ctx.fillStyle = this.col[i]; ctx.fillRect(-s / 2, -s / 2, s, s * 0.7);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const kd = this.kind[i];
      if (kd === 3 || kd === 4) continue;
      const k = this.life[i] / this.max[i];
      const a = this.alpha[i] * (k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9);
      const s = this.size[i] + (this.size1[i] - this.size[i]) * k;
      ctx.globalAlpha = Math.max(0, a);
      if (kd === 2) {
        ctx.beginPath(); ctx.moveTo(this.px[i], this.py[i]); ctx.lineTo(this.px[i] - this.vx[i] * 0.05, this.py[i] - this.vy[i] * 0.05);
        ctx.lineWidth = s * 0.35; ctx.strokeStyle = this.col[i]; ctx.lineCap = 'round'; ctx.stroke();
      } else {
        const spr = glowSprite(this.col[i], kd === 1 ? 'star' : kd === 5 ? 'bubble' : 'glow');
        if (kd === 1) { ctx.save(); ctx.translate(this.px[i], this.py[i]); ctx.rotate(this.rot[i] * 0.3); ctx.drawImage(spr, -s, -s, s * 2, s * 2); ctx.restore(); }
        else ctx.drawImage(spr, this.px[i] - s, this.py[i] - s, s * 2, s * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const x of this.texts) {
      const S = x.S, k = x.t / S.dur;
      const pop = x.t < 0.12 ? 1.7 - (x.t / 0.12) * 0.7 : 1;
      const y = x.y - (x.t < 0.12 ? 0 : (x.t - 0.12) * 46);
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x.x, y);
      ctx.scale(pop, pop);
      ctx.font = `${S.size}px "Lilita One", "Baloo 2", system-ui, sans-serif`;
      if (S.bg) {
        const w = ctx.measureText(x.str).width + 12;
        ctx.fillStyle = S.bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -S.size * 0.62, w, S.size * 1.24, 6) : ctx.rect(-w / 2, -S.size * 0.62, w, S.size * 1.24); ctx.fill();
      }
      ctx.lineWidth = S.size * 0.28; ctx.strokeStyle = S.stroke; ctx.strokeText(x.str, 0, 0);
      if (S.grad) { const g = ctx.createLinearGradient(0, -S.size / 2, 0, S.size / 2); g.addColorStop(0, S.grad[0]); g.addColorStop(1, S.grad[1]); ctx.fillStyle = g; }
      else ctx.fillStyle = S.fill;
      ctx.fillText(x.str, 0, 0);
      ctx.restore();
    }
  }
}
export { shade };
