// Canvas de la scène de combat : taille, densité de pixels, caméra (tremblement, zoom)
import { VH } from './draw.js';

export class Stage {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.quality = 'high';
    this.shake = 0;
    this.zoom = 1;
    this.focus = [200, 220];
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(container);
    else window.addEventListener('resize', () => this.resize());
  }
  setQuality(q) { this.quality = q; this.resize(); }
  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const cap = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, cap);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cssW = w; this.cssH = h;
    this.k = h / VH;
    this.viewW = w / this.k;
  }
  begin(dt) {
    const ctx = this.ctx;
    const s = this.dpr * this.k;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const m = this.shake * this.shake * 7;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    if (this.zoom > 1.0005) {
      const [fx, fy] = this.focus;
      ctx.translate(fx, fy); ctx.scale(this.zoom, this.zoom); ctx.translate(-fx, -fy);
      this.zoom = 1 + (this.zoom - 1) * Math.max(0, 1 - dt * 6);
    } else this.zoom = 1;
    return ctx;
  }
  // coordonnées CSS (px) d'un point virtuel, pour les éléments d'interface
  toCss(x, y) { return { x: x * this.k, y: y * this.k }; }
}
