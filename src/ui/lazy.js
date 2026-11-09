// Images différées : un panneau s'ouvre tout de suite, ses images (dessinées par le code) arrivent
// au fil des images suivantes, avec un budget de temps par frame. Les images déjà prêtes s'affichent
// sans délai. Le préchauffage remplit le cache en arrière-plan pendant que le joueur combat.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const DONE = new Map(); // clé → dataURL
const HIGH = []; // images visibles maintenant
const LOW = []; // préchauffage
let pumping = false;
let lastLow = 0;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const raf = (f) => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(f) : setTimeout(f, 16));

function run(job) {
  let url = DONE.get(job.key);
  if (!url) {
    try { url = job.fn() || BLANK; } catch (e) { url = BLANK; }
    DONE.set(job.key, url);
  }
  for (const el of job.els) { el.src = url; el.classList.remove('lazy'); }
}
function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const t0 = now();
    // images visibles : jusqu'à ~10 ms par frame
    while (HIGH.length && now() - t0 < 10) run(HIGH.shift());
    if (HIGH.length) { raf(step); return; }
    pumping = false;
    if (LOW.length) idle();
  };
  raf(step);
}

// préchauffage : une image à la fois, quand le navigateur est libre, au plus toutes les 400 ms
let idleArmed = false;
function idle() {
  if (idleArmed || !LOW.length) return;
  idleArmed = true;
  const go = () => {
    idleArmed = false;
    if (HIGH.length) { pump(); return; }
    const t = now();
    if (t - lastLow < 400) { setTimeout(idle, 400 - (t - lastLow)); return; }
    lastLow = t;
    if (LOW.length) run(LOW.shift());
    if (LOW.length) idle();
  };
  if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 400);
}

// <img> dont la source est calculée plus tard. `key` doit décrire l'image de façon unique.
export function lazyImg(key, fn, cls = '') {
  const el = document.createElement('img');
  el.alt = '';
  if (cls) el.className = cls;
  const url = DONE.get(key);
  if (url) { el.src = url; return el; }
  el.src = BLANK;
  el.classList.add('lazy');
  let job = HIGH.find((j) => j.key === key);
  if (!job) {
    const i = LOW.findIndex((j) => j.key === key);
    if (i >= 0) job = LOW.splice(i, 1)[0];
    else job = { key, fn, els: [] };
    HIGH.push(job);
  }
  job.els.push(el);
  pump();
  return el;
}
export function prewarm(key, fn) {
  if (DONE.has(key) || HIGH.some((j) => j.key === key) || LOW.some((j) => j.key === key)) return;
  LOW.push({ key, fn, els: [] });
  idle();
}
export function imgReady(key) { return DONE.has(key); }
