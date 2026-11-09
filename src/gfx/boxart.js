// Art évolutif du carton magique : 10 paliers (niveaux 1-30), du carton abîmé au palais céleste de Bastet.
// Chaque palier renvoie un SVG 160x140, posé au sol vers y≈130 et centré sur x=80.
// Classes utilisées par les animations CSS (voir styles.css) :
//   .bx-body            groupe principal
//   .bx-flap.l / .r     les deux battants qui s'ouvrent (pivot = coin bas-droit / bas-gauche de leur boîte,
//                       transform-box: fill-box) : rabats, demi-couvercles ou pans de toit. Leur boîte s'arrête
//                       pile sur x=80 et sur le bas de l'avant-toit. Jamais d'attribut transform sur ces groupes.
//   .bx-ears            petite tête de chat qui surgit à l'ouverture (masquée par défaut)
// Vue isométrique commune : mur gauche éclairé, mur droit dans l'ombre (lumière en haut à gauche, cf. STYLE.md).
// Les id (dégradés, motifs, <use>) sont préfixés par palier (bx0-…, bx9-…) : plusieurs paliers peuvent cohabiter.
// Le contour et les jointures arrondies sont hérités de la racine <svg> pour alléger chaque image.

const O = '#2b1838'; // = OUT de draw.js
const K = 0.276; // pente isométrique
const n = (v) => Math.round(v * 10) / 10;
const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const M = (a) => 'M' + a.map((p) => n(p[0]) + ' ' + n(p[1])).join('L') + 'Z';

// ---------------------------------------------------------------- primitives
const st = (s) => s.map(([o, c, a]) => `<stop${o ? ` offset="${o}"` : ''} stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('');
// dégradé linéaire : 'v' vertical (défaut), 'd' diagonal, 'h' horizontal
const LG = (id, s, d = 'v') => `<linearGradient id="${id}"${d === 'v' ? ' x2="0" y2="1"' : d === 'd' ? ' y2="1"' : ''}>${st(s)}</linearGradient>`;
const RG = (id, s, c = '') => `<radialGradient id="${id}"${c}>${st(s)}</radialGradient>`;
const P = (d, f, w = 3, x = '') => `<path d="${d}" fill="${f}"${w === 3 ? '' : ` stroke-width="${w}"`}${x}/>`;
const F = (d, f, x = '') => `<path d="${d}" fill="${f}" stroke="none"${x}/>`;
const L = (d, c, w, x = '') => `<path d="${d}" fill="none"${c === O ? '' : ` stroke="${c}"`} stroke-width="${w}"${x}/>`;
const C = (x, y, r, f, w = 3) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${f}"${w === 3 ? '' : w ? ` stroke-width="${w}"` : ' stroke="none"'}/>`;
const G = (tr, s) => `<g transform="${tr}">${s}</g>`;
const D = (id, s) => `<g id="${id}">${s}</g>`; // à placer dans <defs>
const U = (id, x = '') => `<use href="#${id}"${x}/>`;
const op = (v) => ` opacity="${v}"`;
const circ = (x, y, rx, ry = rx) => `M${n(x - rx)} ${n(y)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0-${n(2 * rx)} 0`;
const pawd = (x, y, s, c, x2 = '') => dots([[x, y + s]], c, n(11 * s), x2) + dots([[x - 7.5 * s, y - 5 * s], [x - 3 * s, y - 9.5 * s], [x + 3 * s, y - 9.5 * s], [x + 7.5 * s, y - 5 * s]], c, n(5.6 * s), x2);
const paw = (x, y, s) => circ(x, y + s, 6.5 * s, 5.5 * s) + circ(x - 7.5 * s, y - 5 * s, 2.8 * s) + circ(x - 3 * s, y - 9.5 * s, 2.8 * s) + circ(x + 3 * s, y - 9.5 * s, 2.8 * s) + circ(x + 7.5 * s, y - 5 * s, 2.8 * s);
const spk = (a) => a.map(([x, y, r]) => `M${x} ${y - r}q0 ${r} ${r} ${r}q-${r} 0-${r} ${r}q0-${r}-${r}-${r}q${r} 0 ${r}-${r}z`).join('');
// points ronds : sous-chemins de longueur nulle + extrémités arrondies (bien plus léger que des cercles)
const dots = (a, c, w, x = '') => `<path d="${a.map(([px, py]) => `M${n(px)} ${n(py)}h0`).join('')}" fill="none"${c === O ? '' : ` stroke="${c}"`} stroke-width="${w}"${x}/>`;
const odots = (a, c, d, ow = 1.5) => dots(a, O, n(d + 2 * ow)) + dots(a, c, d);
const shadow = (y, rx, o = 0.45) => `<ellipse cx="80" cy="${y}" rx="${rx}" ry="${n(rx * 0.16)}" fill="#0a0420" stroke="none"${op(o)}/>`;
const gem = (x, y, r, c) => C(x, y, r, c, 1.5) + (r >= 2.5 ? C(x - r * 0.35, y - r * 0.35, n(r * 0.35), '#fff', 0) : '');
const gems = (a) => `<g stroke-width="1.5">${a.map(([x, y, r, c]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${c}"/>`).join('')}</g>`;
const RAINBOW = ['#ff3a5a', '#ff9a2a', '#ffe83a', '#3ae07a', '#3ac8ff', '#9a5aff'];

// cube isométrique : W demi-largeur, yb = coin avant au sol, H = hauteur des murs
function geo(W, yb, H) {
  const kW = K * W, yt = yb - H - kW, x0 = 80 - W, x1 = 80 + W, ft = yt + kW;
  return {
    W, yt, ft,
    L: M([[x0, yt], [80, ft], [80, yb], [x0, yb - kW]]),
    R: M([[80, ft], [x1, yt], [x1, yb - kW], [80, yb]]),
    T: M([[x0, yt], [80, yt - kW], [x1, yt], [80, ft]]),
    lm: (s) => G(`matrix(1 ${K} 0 1 ${n(x0)} ${n(yt)})`, s), // repère du mur gauche (u → avant, v ↓)
    rm: (s) => G(`matrix(1 -${K} 0 1 80 ${n(ft)})`, s), // repère du mur droit (u → droite, v ↓)
  };
}
// toit en pyramide : m = débord, d = descente de l'avant-toit, ay = sommet
function roof(g, m, d, ay) {
  const W = g.W + m;
  return { l: [80 - W, g.yt + d], f: [80, g.yt + K * W + d], r: [80 + W, g.yt + d], b: [80, g.yt - K * W + d], a: [80, ay] };
}
// rangées de tuiles en écailles sur un pan (p0 → p1 = avant-toit, a = sommet)
function scallops(p0, p1, a, rows, N, h) {
  let d = '';
  for (const r of rows) {
    const s = lp(p0, a, r), e = lp(p1, a, r), c = Math.max(2, Math.round(N * (1 - r)));
    const dx = (e[0] - s[0]) / c, dy = (e[1] - s[1]) / c, hh = h * (1 - r * 0.5);
    d += `M${n(s[0])} ${n(s[1])}`;
    for (let i = 0; i < c; i++) d += `q${n(dx / 2)} ${n(dy / 2 + hh)} ${n(dx)} ${n(dy)}`;
  }
  return d;
}
const courses = (p0, p1, a, rs) => rs.map((r) => { const s = lp(p0, a, r), e = lp(p1, a, r); return `M${n(s[0])} ${n(s[1])}L${n(e[0])} ${n(e[1])}`; }).join('');

// tête de chat qui surgit à l'ouverture (oreilles, front, grands yeux), fondue vers le bas dans l'intérieur
function ears(t, by, s, o) {
  const a = `bx${t}-e`, y = `bx${t}-y`;
  return G(`translate(80 ${by}) scale(${s})`,
    `<linearGradient id="${a}" gradientUnits="userSpaceOnUse" y1="-24" x2="0" y2="4"><stop offset=".55" stop-color="${o.c}"/><stop offset="1" stop-color="${o.c}" stop-opacity="0"/></linearGradient>` +
    P('M-27-3L-23-32L-7-18ZM27-3L23-32L7-18Z', o.e || o.c) +
    F('M-22.5-10L-21.5-26L-12.5-18ZM22.5-10L21.5-26L12.5-18Z', o.i || '#ff9fb2') +
    F('M-30 4Q-31-20 0-21Q31-20 30 4Z', `url(#${a})`) + L('M-30.4-6Q-31-20 0-21Q31-20 30.4-6', O, 3) +
    (o.s ? L('M-5-20l1.5 6M0-21v7M5-20l-1.5 6', o.s, 2.4) : '') +
    `<g id="${y}"><ellipse cx="-11" cy="-9" rx="4.6" ry="5.6" fill="${o.y}" stroke-width="2"/><ellipse cx="-11" cy="-8.5" rx="1.9" ry="4" fill="${O}" stroke="none"/>${C(-12.6, -11.2, 1.5, '#fff', 0)}</g>` + U(y, ' x="22"') +
    (o.g ? L(circ(27, -9, 3), o.g, 1.8) : ''));
}
const wrap = (defs, body, ea, fl, fr) => (`<svg viewBox="0 0 160 140" xmlns="http://www.w3.org/2000/svg" stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><defs>${defs}</defs><g class="bx-body">${body}</g><g class="bx-ears">${ea}</g><g class="bx-flap l">${fl}</g><g class="bx-flap r">${fr}</g></svg>`).replace(/([^\d])0\./g, '$1.').replace(/ -/g, '-');

// ---------------------------------------------------------------- 0 : carton abîmé
function t0() {
  const u = (s) => `url(#bx0-${s})`, tape = '#e9dcbc';
  const defs = LG('bx0-l', [[0, '#d6a265'], [1, '#a46f3d']]) + LG('bx0-r', [[0, '#b5814c'], [1, '#7b4f29']]) +
    LG('bx0-f', [[0, '#e3b67a'], [1, '#b28047']]) + LG('bx0-i', [[0, '#7a4e28'], [0.6, '#3a2010'], [1, '#1e1006']]);
  const body = shadow(127, 58) +
    P('M30 66.2L80 52.4L130 66.2L105 75.6L80 80Z', u('i')) +
    P('M30 66.2L80 80L83.5 101L79 128L30 114.2Z', u('l')) +
    P('M80 80L105 75.6L130 66.2V114.2L79 128L83.5 101Z', u('r')) +
    L('M80 80L83.5 101L79 128', '#f0c48a', 1.5, op(0.5)) +
    G('matrix(1 .276 0 1 30 66.2)',
      pawd(20, 30, 1, '#6a3f18', op(0.45)) +
      L('M37 9l5 9-2 10', '#6e4220', 2.2) + L('M39.5 8l5 9-2 10', '#f2cc96', 1.5, op(0.6)) +
      P('M5-2h11v13l-2.5 3.5-3-2.5-5.5 3z', tape, 1.6) + L('M3 40l6-3 4 4', '#5a3416', 1.6, op(0.5))) +
    G('matrix(1 -.276 0 1 80 80)',
      F('M11 26q7-7 15-2q8 5 3 13q-7 6-15 1q-8-5-3-12z', '#6a3a18', op(0.22)) +
      L('M30 16l5-7 5 7m-5-7v13M28 27h14', '#5a3416', 2.2, op(0.5)) +
      P('M37 44l3-7 3 4 3-6 2 4v6z', '#24120a', 2) +
      P('M30 30l16 9-2 3.5-16-9zM44 29.5l2 3.5-16 9-2-3.5z', tape, 1.5));
  const fl = P('M30 66.2L80 52.4L66 32L57 36L52 30.5L44 37L11 46Z', u('f')) +
    L('M27 60L74 47', '#9a6a36', 1.6, op(0.6)) + P('M37 50l9-2.5 3 13-4 4-5-2z', tape, 1.5);
  const fr = P('M130 66.2L80 52.4L95 35L134 45.5L151 58Z', u('f')) +
    P('M134 45.5L151 58L137 57Z', '#8e5f30', 2) + L('M85 50L128 61', '#9a6a36', 1.6, op(0.6));
  return wrap(defs, body, ears(0, 69, 0.82, { c: '#f39a3d', s: '#c0601a', y: '#9be36a' }), fl, fr);
}

// ---------------------------------------------------------------- 1 : carton renforcé
function t1() {
  const u = (s) => `url(#bx1-${s})`, wh = ' stroke="#fff" stroke-width="2.4"';
  const defs = LG('bx1-l', [[0, '#f6bb6e'], [1, '#cb8544']]) + LG('bx1-r', [[0, '#d8964f'], [1, '#9a5a2a']]) +
    LG('bx1-f', [[0, '#ffd592'], [1, '#dc9a55']]) + LG('bx1-i', [[0, '#7a4e28'], [0.6, '#3a2010'], [1, '#1e1006']]) +
    LG('bx1-t', [[0, '#7cc8ff'], [1, '#2f7fe6']]);
  const tw = 'M28 96.6L80 111L132 96.6', bow = 'M80 111l-5 9M80 111l4 10';
  const body = shadow(128, 60) +
    P('M28 63.6L80 49.3L132 63.6L80 78Z', u('i')) +
    P('M28 63.6L80 78V128L28 113.6Z', u('l')) + P('M80 78L132 63.6V113.6L80 128Z', u('r')) +
    G('matrix(1 .276 0 1 28 63.6)',
      L('M13 30Q11 15 17 12L16 4L23 9.5Q27 8 31 9.5L38 4L37 12Q43 15 41 30Q27 36 13 30Z', '#2d2350', 2.2) +
      F(circ(21, 19, 2.2) + circ(33, 19, 2.2) + 'M25 23h4l-2 2.5z', '#2d2350') +
      L('M23.5 27q1.7 2 3.5 0q1.8 2 3.5 0M12 21h-7M12 24.5l-6 2.5M42 21h7M42 24.5l6 2.5', '#2d2350', 1.8)) +
    G('matrix(1 -.276 0 1 80 78)',
      P('M33 9l3 6.5 7 .8-5.2 4.8 1.4 7-6.2-3.5-6.2 3.5 1.4-7-5.2-4.8 7-.8z', '#ffd23f', 3, wh) +
      P('M14 40c-7-4-9-9-6-12s6 0 6 1c0-1 3-4 6-1s1 8-6 12z', '#ff6fa8', 3, wh) +
      P('M30 39q6-6 12 0q-6 6-12 0zM42 39l5-4v8z', '#5ad0ff', 3, wh) + C(33, 38, 1, O, 0)) +
    P('M28 63.6L80 78L132 63.6V68.6L80 83L28 68.6Z', u('t'), 2) +
    P('M74 76.3L80 78L86 76.3V126.3L80 128L74 126.3Z', u('t'), 2) + L('M77 84v38', '#d4eeff', 1.4, op(0.7)) +
    L(tw, O, 6.5) + L(tw, '#e23a48', 4) + L(tw, '#fff', 4, ' stroke-dasharray="2.5 3.5"') +
    P('M80 111c-11-9-15 1-9 4.5zM80 111c11-9 15 1 9 4.5z', '#e23a48', 2) + L(bow, O, 4.5) + L(bow, '#e23a48', 2.4) + C(80, 111, 2.8, '#e23a48', 2);
  const fl = P('M28 63.6L80 49.3L66 27L12 41Z', u('f')) + P('M12 41L66 27L68.1 30.3L14.4 44.4Z', u('t'), 2);
  const fr = P('M132 63.6L80 49.3L94 27L148 41Z', u('f')) + P('M148 41L94 27L91.9 30.3L145.6 44.4Z', u('t'), 2) +
    P('M121 46l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z', '#ffd23f', 3, ' stroke="#fff" stroke-width="1.8"');
  return wrap(defs, body, ears(1, 67, 0.85, { c: '#a9b2cf', s: '#6a7292', y: '#8be36a' }), fl, fr);
}

// ---------------------------------------------------------------- 2 : caisse en bois
function t2() {
  const u = (s) => `url(#bx2-${s})`;
  const rv = (a) => dots(a, O, 2.2);
  const defs = LG('bx2-l', [[0, '#e29c58'], [1, '#a8642e']]) + LG('bx2-r', [[0, '#bc773b'], [1, '#76411d']]) +
    LG('bx2-k', [[0, '#a8622c'], [1, '#6a3815']]) + LG('bx2-s', [[0, '#f4f8ff'], [1, '#8592aa']]) +
    LG('bx2-t', [[0, '#f0b070'], [1, '#c47c3c']], 'd') + LG('bx2-b', [[0, '#a05e2a'], [1, '#6a3614']]) +
    LG('bx2-i', [[0, '#5a3418'], [1, '#1e1006']]) +
    D('bx2-p', L('M0 12.5h54M0 25h54M0 37.5h54', O, 1.6, op(0.55)) +
      L('M10 4q8-2 16 0t16 0M13 17q8 2 16 0M9 30q10-2 18 0t14 0M15 42q8 2 16 0', '#ffd09a', 1.2, op(0.45)) +
      P('M0 0H54V50H0ZM7 7V43H47V7Z', u('k'), 2, ' fill-rule="evenodd"') +
      P('M42 0H54V12H48V6H42ZM42 50H54V38H48V44H42ZM0 0H12V6H6V12H0ZM0 50H12V44H6V38H0Z', u('s'), 1.8) +
      rv([[51, 3], [45, 3], [51, 9], [51, 47], [45, 47], [3, 3], [9, 3], [3, 47], [9, 47], [3, 9]]));
  const rope = 'M26 89.1L80 104L134 89.1', ends = 'M80 104q-4 8-9 12M80 104q2 9 7 13';
  const body = shadow(129, 62) +
    P('M26 64.1L80 49.2L134 64.1L80 79Z', u('i')) + L('M44 62l10 4M60 58l8 6M86 60l12-3M100 64l10 3M70 70l8-2', '#e8c060', 1.6) +
    P('M26 64.1L80 79V129L26 114.1Z', u('l')) + P('M80 79L134 64.1V114.1L80 129Z', u('r')) +
    G('matrix(1 .276 0 1 26 64.1)', U('bx2-p') + pawd(27, 27, 1.05, '#a12a1e', op(0.8))) +
    G('matrix(1 -.276 0 1 80 79)', U('bx2-p') + P('M7 43H14L47 14V7H40L7 36Z', u('k'), 2)) +
    L(rope, O, 7.5) + L(rope, '#e9c77e', 4.6) + L(rope, '#a67c36', 4.6, ' stroke-dasharray="1.6 2.6"') +
    L(ends, O, 6) + L(ends, '#e9c77e', 3) + C(80, 104, 4.6, '#e9c77e', 2.4);
  const fl = P('M23 57.3L80 73V81L23 65.3Z', u('b'), 2.5) + P('M23 57.3L80 41.5V73Z', u('t'), 2.5) +
    L('M37.3 53.4L80 65.2M51.5 49.4L80 57.3M65.8 45.5L80 49.4', O, 1.5, op(0.55)) +
    P('M70 70.2L80 73V81L70 78.2ZM23 57.3L31 59.5V67.5L23 65.3Z', u('s'), 1.8);
  const fr = P('M80 73L137 57.3V65.3L80 81Z', u('b'), 2.5) + P('M137 57.3L80 41.5V73Z', u('t'), 2.5) +
    L('M122.7 53.4L80 65.2M108.5 49.4L80 57.3M94.2 45.5L80 49.4', O, 1.5, op(0.55)) +
    P('M90 70.2L80 73V81L90 78.2ZM137 57.3L129 59.5V67.5L137 65.3Z', u('s'), 1.8);
  return wrap(defs, body, ears(2, 66, 0.86, { c: '#f6ecdf', e: '#ee8a3a', s: '#3a3350', y: '#ffb23a' }), fl, fr);
}

// ---------------------------------------------------------------- 3 : panier en osier
function t3() {
  const u = (s) => `url(#bx3-${s})`;
  const lid = 'M21 61.3H80V19.9Q40 29 21 61.3Z', rid = 'M80 105.5H139Q120 73.1 80 64.1Z';
  const defs = `<pattern id="bx3-w" width="12" height="8" patternUnits="userSpaceOnUse" stroke="none"><rect width="12" height="8" fill="#8a5418"/><rect x="1" y=".7" width="10" height="2.8" rx="1.4" fill="#f5cb72"/><path d="M-3.6 4.7h7.2a1.4 1.4 0 0 1 0 2.8h-7.2a1.4 1.4 0 0 1 0-2.8zM8.4 4.7h7.2a1.4 1.4 0 0 1 0 2.8h-7.2a1.4 1.4 0 0 1 0-2.8z" fill="#e3ad55"/></pattern>` +
    `<pattern id="bx3-g" width="6" height="6" patternUnits="userSpaceOnUse" stroke="none"><rect width="6" height="6" fill="#fff"/><path d="M0 0h3v6H0zM0 0h6v3H0z" fill="#e8384e" opacity=".55"/></pattern>` +
    LG('bx3-sl', [[0, '#fff3c0', 0.3], [1, '#3a1600', 0.35]]) + LG('bx3-sr', [[0, '#2a0e00', 0.28], [1, '#2a0e00', 0.55]]) +
    LG('bx3-ll', [[0, '#fff6c8', 0.45], [1, '#5a2a00', 0.15]], 'd') + LG('bx3-lr', [[0, '#2a0e00', 0.2], [1, '#2a0e00', 0.5]], 'd') +
    RG('bx3-c', [[0, '#ffe0f0'], [1, '#ff6fae']]);
  const braid = (d, w = 6.5) => L(d, O, w + 3.5) + L(d, '#f6d48a', w) + L(d, '#b8802e', w, ' stroke-dasharray="2.4 3.2"');
  const body = shadow(129, 58) +
    P('M26 66.1L80 51.2L134 66.1L80 81Z', u('c')) + L('M50 66q30-10 60 0M80 56v20', '#d8487e', 1.5, op(0.6)) + C(80, 66, 2.5, '#ffd23f', 1.5) +
    G('matrix(1 .276 0 1 26 66.1)', P('M0 0H54V48H8Z', u('w')) + F('M0 0H54V48H8Z', u('sl'))) +
    G('matrix(1 -.276 0 1 80 81)', P('M0 0H54L46 48H0Z', u('w')) + F('M0 0H54L46 48H0Z', u('sr'))) +
    braid('M34 116.3L80 129L126 116.3', 5) + braid('M26 66.1L80 81L134 66.1') +
    P('M60 80H100L95 95Q87 89 80 100Q73 89 65 95Z', u('g'), 2) +
    P('M28 66L37 69L35 80L31.5 75L28 79ZM132 66L123 69L125 80L128.5 75L132 79Z', u('g'), 1.8) +
    L('M80 89l-6 11M80 89l5 11', O, 5) + L('M80 89l-6 11M80 89l5 11', '#e8384e', 2.6) +
    P('M80 89c-6-8-15-7-14 1c1 5 9 3 14-1zM80 89c6-8 15-7 14 1c-1 5-9 3-14-1z', '#ff4a5e', 2) + L('M71 86q-3 1-2 4M89 86q3 1 2 4', '#ffb0b8', 1.4) + C(80, 89, 2.8, '#d82a40', 2);
  const fl = G('matrix(1 .276 0 1 0 0)', P(lid, u('w')) + F(lid, u('ll'))) + braid('M21 67.1L80 83.4', 6) + P('M80 35.5A6 6 0 0 0 80 47.5Z', '#c27a32', 2.5) +
    P('M52 60q4-7 10-6q-3 6-10 6z', '#5ac85a', 1.5) + odots([[56, 51], [60, 49], [62, 53], [58, 55], [54, 54], [64, 57], [68, 55], [70, 59], [66, 61], [62, 60]], '#fff', 3.4, 1.2) + dots([[58.5, 52.5], [66.5, 58]], '#ffc83a', 3);
  const fr = G('matrix(1 -.276 0 1 0 0)', P(rid, u('w')) + F(rid, u('lr'))) + braid('M80 83.4L139 67.1', 6) + P('M80 35.5A6 6 0 0 1 80 47.5Z', '#9a5a22', 2.5);
  return wrap(defs, body, ears(3, 69, 0.88, { c: '#ffb45e', s: '#d8782a', y: '#7be36a' }), fl, fr);
}

// ---------------------------------------------------------------- 4 : coffre peint
function t4() {
  const u = (s) => `url(#bx4-${s})`;
  const flower = (x, y, r, c) => U('bx4-o', ` transform="translate(${x} ${y})${r === 3 ? '' : ` scale(${n(r / 3)})`}" color="${c}"`);
  const wd = (a) => dots(a, '#fff', 2.4, op(0.85));
  const defs = LG('bx4-l', [[0, '#5aa8ff'], [1, '#2a5cc8']]) + LG('bx4-r', [[0, '#3a78d8'], [1, '#1c3a8a']]) +
    LG('bx4-b', [[0, '#fff2a6'], [0.45, '#f2bc3e'], [1, '#a8681a']]) +
    LG('bx4-ll', [[0, '#ff7482'], [1, '#c4284a']], 'd') + LG('bx4-lr', [[0, '#c82a4a'], [1, '#76102e']], 'd') +
    RG('bx4-i', [[0, '#fff6b0'], [0.6, '#ffc83a'], [1, '#b8741a']]) +
    D('bx4-k', P('M0 0H6V42H0ZM48 0H54V42H48ZM6 36H48V42H6Z', u('b'), 2) + dots([[3, 4], [3, 32], [51, 4], [51, 32]], O, 2)) +
    D('bx4-o', odots([0, 72, 144, 216, 288].map((a) => [3 * Math.sin(a * Math.PI / 180), -3 * Math.cos(a * Math.PI / 180)]), 'currentColor', 4.5) + odots([[0, 0]], '#ffd23f', 3.6));
  const strap = (d, c) => L(d, O, 6.5) + L(d, c, 3.5);
  const body = shadow(130, 62) +
    P(circ(30, 111, 5.5, 4.5) + circ(130, 111, 5.5, 4.5) + circ(80, 126, 5.5, 4.5), u('b'), 2.5) +
    P('M26 67.1L80 52.2L134 67.1L80 82Z', u('i')) + P(circ(66, 66, 5, 3) + circ(92, 63, 5, 3) + circ(80, 72, 5, 3), '#ffd84a', 1.5) +
    P('M26 67.1L80 82V124L26 109.1Z', u('l')) + P('M80 82L134 67.1V109.1L80 124Z', u('r')) +
    G('matrix(1 .276 0 1 26 67.1)', U('bx4-k') +
      C(27, 18, 11.5, u('b'), 2.5) + C(27, 18, 8, '#fff3dc', 2) + pawd(27, 19.5, 0.62, '#e8384e') +
      flower(13, 30, 3, '#ff6a8a') + flower(41, 30, 3, '#ff6a8a') + wd([[11, 6], [43, 6], [18, 32], [36, 32]])) +
    G('matrix(1 -.276 0 1 80 82)', U('bx4-k') +
      P('M27 30q-10-1-12 7q9 1 12-7ZM27 30q10-1 12 7q-9 1-12-7Z', '#4ad07a', 1.5) + L('M27 22v12', '#2a8a4a', 2) +
      flower(27, 18, 5.5, '#ff5a7a') + wd([[12, 8], [42, 8], [12, 28], [42, 28], [27, 4]])) +
    P('M72.5 86.5h15v10l-7.5 6-7.5-6z', u('b'), 2) + F(circ(80, 91, 2) + 'M79 92h2l1 5h-4z', O);
  const fl = P('M21 69.1L80 85.4V90.4L21 74.1Z', u('b'), 2.5) + P('M21 69.1L80 85.4V40C58 40 27 47 21 69.1Z', u('ll')) +
    strap('M50.5 77.3Q57 52 80 41', '#f5c544') +
    flower(36, 64, 2.4, '#fff4a0') + flower(65, 70, 2.4, '#fff4a0') + wd([[44, 54], [70, 56], [30, 70]]) +
    L('M31 63Q38 52 58 47', '#fff', 2, op(0.4)) + P('M80 33A6 6 0 0 0 80 45Z', u('b'), 2.5);
  const fr = P('M80 85.4L139 69.1V74.1L80 90.4Z', u('b'), 2.5) + P('M80 85.4L139 69.1C133 47 102 40 80 40Z', u('lr')) +
    strap('M109.5 77.3Q103 52 80 41', '#d9a336') +
    flower(124, 64, 2.4, '#ffd0d8') + flower(95, 70, 2.4, '#ffd0d8') + wd([[116, 54], [90, 56], [130, 70]]) +
    P('M80 33A6 6 0 0 1 80 45Z', u('b'), 2.5);
  return wrap(defs, body, ears(4, 71, 0.88, { c: '#f3e3c8', e: '#6b4a3a', i: '#c48a8a', y: '#5ab8ff' }), fl, fr);
}

// ---------------------------------------------------------------- 5 : maisonnette de chat
function t5() {
  const u = (s) => `url(#bx5-${s})`;
  const g = geo(52, 124, 44), r = roof(g, 8, 3, 22);
  const door = 'M15 38V25A9 9 0 0 1 33 25V38Z';
  const defs = LG('bx5-l', [[0, '#ffe8aa'], [1, '#f2b95e']]) + LG('bx5-r', [[0, '#eab868'], [1, '#bd843e']]) +
    LG('bx5-rl', [[0, '#ff8c64'], [1, '#e0503e']], 'd') + LG('bx5-rr', [[0, '#d64e3e'], [1, '#9c2a2e']], 'd') +
    LG('bx5-g', [[0, '#8ee068'], [1, '#4aa83e']]) + LG('bx5-d', [[0, '#2a1430'], [1, '#5a2a3a']]) +
    LG('bx5-w', [[0, '#d8f4ff'], [1, '#6ab8f0']]) + RG('bx5-gl', [[0, '#fff2b0'], [1, '#e8903a']]) +
    D('bx5-s', L('M0 7H52M0 14H52M0 21H52M0 28H52', '#b07c30', 1.2, op(0.55)) + P('M0 0H5V38H0ZM47 0H52V38H47Z', '#fff6e6', 2) +
      P('M0 38H52V44H0Z', '#b6acc8', 2) + L('M9 38v6M21 38v6M33 38v6M44 38v6', O, 1.2, op(0.5)));
  const body = shadow(133, 66, 0.35) +
    P('M12 112L80 130.8L148 112V117L80 135.8L12 117Z', '#a0603a') + P('M12 112L80 93.2L148 112L80 130.8Z', u('g')) +
    L('M20 113l2-5 2 4 2-6 2 6M136 114l2-5 2 4 2-6 2 6M98 127l2-5 2 4 2-5 2 5', '#2e7a2e', 1.6) +
    dots([[22, 120], [140, 118], [108, 124]], '#fff', 4) + dots([[22, 120], [140, 118], [108, 124]], '#ffd23f', 1.8) +
    L('M80 22V7', O, 2.5) + P('M71 8q6-5 12 0q-6 5-12 0zM83 8l5-4v8z', '#e8a83a', 2) +
    P(M([r.l, r.a, r.r, r.b]), '#4a2618') + P(g.T, u('gl'), 2) +
    P(g.L, u('l')) + P(g.R, u('r')) +
    g.lm(U('bx5-s') + P(door, u('d'), 7.5) + L(door, '#c27a3a', 4) + P('M17 4H31V11H17Z', '#e09a52', 2) + pawd(24, 8.3, 0.36, '#7a3a1a')) +
    g.rm(U('bx5-s') + P('M15 8H37V28H15Z', '#fff6e6', 2.5) + P('M18 11H34V25H18Z', u('w'), 1.5) + L('M26 11V25M18 18H34', '#fff6e6', 2) + L('M20 22l4-7M23 24l3-5', '#fff', 1.4, op(0.8)) +
      P('M13 28H39V33H13Z', '#a0582a', 2) + odots([[16, 27], [26, 26.5], [36, 27]], '#ff5a7a', 4.8, 1.4) + odots([[21, 26], [31, 26]], '#fff', 4.4, 1.4)) +
    C(129, 122, 6, '#ff5a9a', 2.5) + L('M124 119q5 3 10 0M124 123q5 3 10 0M126 117q3 6 1 11', '#b8205e', 1.2) + L('M123 125q-6 5-12 2', '#ff5a9a', 1.6);
  const face = (a, b, f, sh) => P(M([a, b, r.a]), f) + L(scallops(a, b, r.a, [0.2, 0.4, 0.6, 0.8], 6, 4), sh, 1.8);
  const fl = P(M([r.l, r.f, [80, r.f[1] + 4], [r.l[0], r.l[1] + 4]]), '#7a2a24', 2.5) + face(r.l, r.f, u('rl'), '#b23a32') +
    L('M77.5 83V27', '#ffc0a0', 1.6, op(0.7));
  const fr = P(M([r.f, r.r, [r.r[0], r.r[1] + 4], [80, r.f[1] + 4]]), '#5a1a1e', 2.5) + face(r.f, r.r, u('rr'), '#7a1e22') +
    P('M103 42L110 44V58L103 56Z', '#cc644c', 2.5) + P('M110 44L117 42V56L110 58Z', '#94403a', 2.5) + P('M103 42L110 40L117 42L110 44Z', '#3a1a1a', 2.5) +
    L('M103 49l7 2 7-2', O, 1.2, op(0.5));
  return wrap(defs, body, ears(5, 68, 0.95, { c: '#f7963a', s: '#c4561a', y: '#9be36a' }), fl, fr);
}

// ---------------------------------------------------------------- 6 : chatière dorée
function t6() {
  const u = (s) => `url(#bx6-${s})`;
  const g = geo(54, 120, 44), r = roof(g, 9, 3, 12);
  const door = 'M15 39V23A10 10 0 0 1 35 23V39Z';
  const defs = LG('bx6-l', [[0, '#ec5aa8'], [1, '#98186a']]) + LG('bx6-r', [[0, '#b42a80'], [1, '#600f46']]) +
    LG('bx6-a', [[0, '#fff6b8'], [0.45, '#ffc93a'], [1, '#b8720e']]) +
    LG('bx6-rl', [[0, '#a87aff'], [1, '#5a2ad0']], 'd') + LG('bx6-rr', [[0, '#6a38d0'], [1, '#341288']], 'd') +
    RG('bx6-d', [[0, '#fff0f6'], [0.5, '#ff9ad0'], [1, '#8a1a5a']], ' cy=".75" r=".7"') +     RG('bx6-w', [[0, '#fff8e0'], [1, '#ff8ac8']], ' cx=".4" cy=".4"') +
    `<pattern id="bx6-t" width="10" height="10" patternUnits="userSpaceOnUse" stroke="none"><path d="M0 0L10 10M10 0L0 10" stroke="#3a0428" stroke-opacity=".4" stroke-width="1"/><circle cx="5" cy="5" r="1.4" fill="#ffd76a"/></pattern>` +
    D('bx6-v', F('M0 0H54V44H0Z', u('t')) + P('M0 0H54V5H0ZM0 39H54V44H0ZM0 5H5V39H0ZM49 5H54V39H49Z', u('a'), 2) +
      dots([[12, 2.5], [42, 2.5]], '#ff3a6a', 3.2) + dots([[27, 2.5]], '#3ae08a', 3.2));
  const bow = 'M80 80l-8-4.5v9zM80 80l8-4.5v9z';
  const body = shadow(131, 66) +
    P('M20 105.4L80 122L140 105.4V113.4L80 130L20 113.4Z', u('a')) + P('M20 105.4L80 88.9L140 105.4L80 122Z', u('a')) + L('M80 122V130', O, 2) +
    C(80, 8.5, 4.5, u('a'), 2.5) + P('M80-6L86 .5L80 6L74 .5Z', '#ff7ad0', 2.5) + F('M80-4L83 .5H80Z', '#fff', op(0.8)) +
    P(M([r.l, r.a, r.r, r.b]), '#4a0a3a') + P(g.T, u('w'), 2) +
    P(g.L, u('l')) + P(g.R, u('r')) +
    g.lm(U('bx6-v') + P(door, u('d'), 9) + L(door, u('a'), 5) +
      P('M16 39V23Q16 14 25 13Q19 20 21 30Q19 34 21 39ZM34 39V23Q34 14 25 13Q31 20 29 30Q31 34 29 39Z', '#a8125e', 1.5) +
      P('M25 6.5L29 11L25 15.5L21 11Z', '#ff3a6a', 2) + F('M25 8L27 11H25Z', '#fff', op(0.8))) +
    g.rm(U('bx6-v') + C(27, 21, 10.5, u('a'), 2.5) + C(27, 21, 7, u('w'), 2) + L('M23 24l5-7', '#fff', 1.6, op(0.8)) + gem(27, 9.5, 2.2, '#3a8aff')) +
    P(bow, '#e8284a', 2) + P('M71.5 97.5c0-10 3.5-14.5 8.5-14.5s8.5 4.5 8.5 14.5l2 2.5h-21z', u('a'), 2.5) + C(80, 101.5, 2.3, O, 0) +
    L('M75.5 89q-1.5 3-1.5 8', '#fff', 1.6, op(0.85)) + L('M73 96.5h14', O, 1.2, op(0.5)) +
    F(spk([[14, 40, 5], [148, 30, 4.5], [148, 92, 3.5], [18, 92, 3.5]]), '#fff6c0');
  const eave = (a, b) => { const c = [b[0], b[1] + 5], d = [a[0], a[1] + 5]; return P(M([a, b, c, d]), u('a'), 2.5) + gems([0.15, 0.38, 0.62, 0.85].map((t, i) => [...lp([a[0], a[1] + 2.5], [b[0], b[1] + 2.5], t), 1.9, ['#ff3a6a', '#3ae08a', '#3a8aff', '#ff3a6a'][i]])); };
  const face = (a, b, f) => P(M([a, b, r.a]), f) + L(scallops(a, b, r.a, [0.2, 0.43, 0.66], 5, 4.5), '#ffd24a', 1.8);
  const fl = face(r.l, r.f, u('rl')) + eave(r.l, r.f) + P(M([r.f, r.a, [76, 16], [76, r.f[1] - 1]]), u('a'), 2);
  const fr = face(r.f, r.r, u('rr')) + eave(r.f, r.r) + P(M([r.f, r.a, [84, 16], [84, r.f[1] - 1]]), u('a'), 2);
  return wrap(defs, body, ears(6, 64, 1, { c: '#fffaf6', i: '#ffb0c8', y: '#4ab0ff', g: '#ffc93a' }), fl, fr);
}

// ---------------------------------------------------------------- 7 : pavillon royal
function t7() {
  const u = (s) => `url(#bx7-${s})`;
  const g = geo(50, 118, 40), A = [80, 14], H = [17, 58], F0 = [80, 84];
  const defs = LG('bx7-l', [[0, '#ff4a52'], [1, '#b0182c']]) + LG('bx7-r', [[0, '#c41e32'], [1, '#6a0a1a']]) +
    LG('bx7-a', [[0, '#fff6b8'], [0.45, '#ffc93a'], [1, '#b8720e']]) + LG('bx7-c', [[0, '#fff2a0'], [1, '#c8861a']], 'h') +
    LG('bx7-rl', [[0, '#6af0b0'], [1, '#1c9a62']], 'd') + LG('bx7-rr', [[0, '#26a870'], [1, '#0c5636']], 'd') +
    LG('bx7-m', [[0, '#f6f0ff'], [1, '#c8b8e8']]) + LG('bx7-ml', [[0, '#e4d8f8'], [1, '#a090c8']]) +
    RG('bx7-d', [[0, '#fff6d0'], [0.6, '#ffb84a'], [1, '#c0501a']]) + RG('bx7-gl', [[0, '#fffad8'], [1, '#ffb83a']]) +
    D('bx7-c', P('M0 0H6V40H0ZM44 0H50V40H44Z', u('c'), 2) + P('M6 34H44V40H6ZM6 0H44V4H6Z', u('a'), 2)) +
    D('bx7-b', L('M10 122V18', O, 5) + L('M10 122V18', '#ffd24a', 2.4) + C(10, 15, 3.4, u('a'), 2) + L('M2 21H18', O, 3) +
      P('M3 21H17V52L10 46L3 52Z', '#e8343e', 2.5) + L('M5.5 24V46M14.5 24V46', '#ffd24a', 1.5) + C(10, 31, 3.4, u('a'), 1.6));
  const body = shadow(131, 70) + U('bx7-b') + U('bx7-b', ' x="140"') +
    P('M18 104.9L80 122L142 104.9V113.9L80 131L18 113.9Z', u('ml')) + P('M80 122L142 104.9V113.9L80 131Z', '#8a7ab0') +
    P('M18 104.9L80 87.8L142 104.9L80 122Z', u('m')) + L('M21 108.5L80 124.8L139 108.5', '#ffd24a', 2) +
    P('M67 15L64 1L72 7L80-4L88 7L96 1L93 15Z', u('a'), 2.5) + odots([[80, 10]], '#ff3a6a', 5.2) + odots([[71.5, 11], [88.5, 11]], '#3ab0ff', 3.6, 1.2) + odots([[64, 1], [80, -4], [96, 1]], '#fff', 4.2) +
    P('M5 52L80 14L155 52L80 45Z', '#0c3a26') + P(g.T, u('gl'), 2) +
    P(g.L, u('l')) + P(g.R, u('r')) +
    g.lm(U('bx7-c') + C(25, 19, 12, u('d'), 7) + L(circ(25, 19, 12), '#ffd24a', 3.4)) +
    g.rm(U('bx7-c') + P('M11 8H39V30H11Z', u('d'), 2.5) + L('M11 15.3H39M11 22.6H39M18 8V30M25 8V30M32 8V30', '#ffd24a', 1.6) + L('M11 8H39V30H11Z', '#ffd24a', 2.6)) +
    F(spk([[30, 30, 3.5], [132, 24, 4], [142, 84, 3]]), '#fff6c0');
  const fl = P('M5 52C22 68 52 82 80 84V89C52 87 20 73 3 56Z', u('a'), 2.5) +
    P('M80 14L17 58Q10 58 5 52C22 68 52 82 80 84Z', u('rl')) + L(scallops(H, F0, A, [0.15, 0.4, 0.65], 5, 4), '#127a4a', 1.8) +
    P('M80 84V14L76.5 19V83.6Z', u('a'), 2) + P('M5 52q-6 0-5-9q5 2 5 9z', u('a'), 2) + P('M2 61q0-5 4-5t4 5z', u('a'), 1.6) + C(6, 62.5, 1.3, O, 0);
  const fr = P('M155 52C138 68 108 82 80 84V89C108 87 140 73 157 56Z', u('a'), 2.5) +
    P('M80 14L143 58Q150 58 155 52C138 68 108 82 80 84Z', u('rr')) + L(scallops(F0, [143, 58], A, [0.15, 0.4, 0.65], 5, 4), '#063a22', 1.8) +
    P('M80 84V14L83.5 19V83.6Z', u('a'), 2) + P('M155 52q6 0 5-9q-5 2-5 9z', u('a'), 2) + P('M150 61q0-5 4-5t4 5z', u('a'), 1.6) + C(154, 62.5, 1.3, O, 0);
  return wrap(defs, body, ears(7, 64, 1, { c: '#ffc84a', s: '#d0861a', y: '#7be36a' }), fl, fr);
}

// ---------------------------------------------------------------- 8 : château de cristal
function t8() {
  const u = (s) => `url(#bx8-${s})`;
  const g = geo(48, 120, 42), r = roof(g, 10, 3, 10);
  const door = 'M14 38V24Q14 13 24 8Q34 13 34 24V38Z';
  const heart = 'M24 32C13 25 12 15 18.5 13C22 12 24 15 24 16.5C24 15 26 12 29.5 13C36 15 35 25 24 32Z';
  const defs = RG('bx8-h', [[0, '#7af6ff', 0.55], [1, '#7af6ff', 0]]) +
    LG('bx8-l', [[0, '#f0fbff'], [0.5, '#9ad8ff'], [1, '#8a86ff']]) + LG('bx8-r', [[0, '#86bcff'], [0.5, '#6a6ae8'], [1, '#4a30b8']]) +
    LG('bx8-s', [[0, '#ffffff'], [1, '#a8b8e0']]) + LG('bx8-p', [[0, '#e8fcff'], [1, '#8a9cff']], 'h') + LG('bx8-m', [[0, '#f4f8ff'], [1, '#b8c4ec']]) +
    RG('bx8-d', [[0, '#ffffff'], [0.55, '#9af4ff'], [1, '#3a7ae8']], ' cy=".7" r=".7"') + RG('bx8-gl', [[0, '#ffffff'], [1, '#5ad8ff']]) +
    RG('bx8-k', [[0, '#ffe0fa'], [0.6, '#ff5ad0'], [1, '#a01a9a']], ' cx=".4" cy=".35"') + LG('bx8-g', [[0, '#ffffff'], [0.5, '#9af6ff'], [1, '#5a8aff']], 'd') +
    D('bx8-sp', P('M7 118V52L14 30L21 52V118Z', u('p'), 2.5) + F('M14 30L21 52V118H14Z', '#3a2a9a', op(0.35)) +
      L('M14 32V116M7 52H21', O, 1.4, op(0.6)) + L('M10 55V112', '#fff', 1.6, op(0.8))) +
    D('bx8-f', F('M0 0H18L6 42H0Z', '#fff', op(0.3)) + F('M30 0H48V20Z', '#fff', op(0.2)) + F('M6 42L26 18L48 42Z', '#2a1a8a', op(0.15)) +
      L('M18 0L6 42M26 18L48 42M30 0L48 20', '#fff', 1, op(0.6)) + P('M0 0H48V4H0ZM0 38H48V42H0Z', u('s'), 2));
  const body = C(80, 66, 78, u('h'), 0) + shadow(131, 66) + U('bx8-sp') + U('bx8-sp', ' x="132"') +
    P('M20 106.4L80 123L140 106.4V114.4L80 131L20 114.4Z', u('m')) + P('M80 123L140 106.4V114.4L80 131Z', '#8a96c8') + P('M20 106.4L80 89.9L140 106.4L80 123Z', u('m')) +
    P('M24 127L28 112L33 127ZM127 127L132 110L137 127Z', u('p'), 2) +
    C(80, 3, 15, u('h'), 0) + P('M80-9L89 2L80 15L71 2Z', u('g'), 2.5) + F('M80-9L84 2L80 15Z', '#fff', op(0.5)) + L('M71 2H89', O, 1.4) +
    P(M([r.l, r.a, r.r, r.b]), '#2a1a7a') + P(g.T, u('gl'), 2) +
    P(g.L, u('l')) + P(g.R, u('r')) +
    g.lm(U('bx8-f') + P(door, u('d'), 7) + L(door, '#f0faff', 3.4)) +
    g.rm(U('bx8-f') + C(24, 22, 14, u('h'), 0) + P(heart, u('k'), 2.5) + L('M24 16.5V31M18.5 13L24 22L29.5 13', '#fff', 1, op(0.6)) + C(19.5, 17.5, 2, '#fff', 0)) +
    F(spk([[10, 8, 4], [150, 12, 4.5], [30, 96, 3.5], [132, 50, 3], [96, 0, 3], [62, 0, 2.5]]), '#fff') + F(spk([[152, 88, 3.5], [6, 74, 3]]), '#9af6ff');
  const fac = (a, b, cs, x) => {
    const p1 = lp(a, b, 0.4), p2 = lp(a, b, 0.72), q = lp(p1, r.a, 0.6);
    return P(M([a, p1, r.a]), cs[0], 2) + P(M([p1, p2, r.a]), cs[1], 2) + P(M([p2, b, r.a]), cs[2], 2) + L(M([a, b, r.a]), O, 3) +
      L(`M${n(p1[0])} ${n(p1[1])}L${n(q[0])} ${n(q[1])}`, '#fff', 1.5, op(0.7)) +
      P(M([a, b, [b[0], b[1] + 4], [a[0], a[1] + 4]]), u('s'), 2.5) + gem(...lp([a[0], a[1] + 2], [b[0], b[1] + 2], 0.5), 1.7, x);
  };
  const fl = fac(r.l, r.f, ['#ecdcff', '#a4ecff', '#dcf8ff'], '#ff5ad0');
  const fr = fac(r.f, r.r, ['#5ab0f0', '#8a7ae8', '#5a4ac8'], '#5af0ff');
  return wrap(defs, body, ears(8, 66, 1, { c: '#dccaff', i: '#ff9fd8', y: '#5af0ff', s: '#a890e8' }), fl, fr);
}

// ---------------------------------------------------------------- 9 : palais céleste de Bastet
function t9() {
  const u = (s) => `url(#bx9-${s})`;
  const g = geo(46, 101, 34), r = roof(g, 8, 2, 4);
  const door = 'M14 29L16 12H30L32 29Z';
  const cat = 'M16 29L17 20Q16 15 18 12.5L16 11L17.5 9.5L17.5 4.5L20.5 7.5L22.5 5L22.8 10Q24 13 22.5 16.5Q30 18.5 31 26Q34 26 34 29Z';
  let rays = '';
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 + 18) * Math.PI / 180, b = 0.1;
    rays += `M80 58L${n(80 + 76 * Math.cos(a - b))} ${n(58 + 76 * Math.sin(a - b))}L${n(80 + 76 * Math.cos(a + b))} ${n(58 + 76 * Math.sin(a + b))}Z`;
  }
  const defs = RG('bx9-h', [[0, '#fff3b0', 0.95], [0.35, '#ff9ad8', 0.45], [0.7, '#8a5aff', 0.18], [1, '#8a5aff', 0]]) +
    RG('bx9-y', [[0, '#fff8d0', 0.75], [0.5, '#ffc0ec', 0.3], [1, '#ffc0ec', 0]]) +
    LG('bx9-l', [[0, '#6474ff'], [1, '#3228c0']]) + LG('bx9-r', [[0, '#4434d4'], [1, '#1c0e78']]) +
    LG('bx9-a', [[0, '#fff8c0'], [0.45, '#ffcc3a'], [1, '#b8720e']]) +
    LG('bx9-pl', [[0, '#fffbd0'], [0.5, '#ffd040'], [1, '#d88a10']], 'd') + LG('bx9-pr', [[0, '#f0b030'], [0.6, '#b06a10'], [1, '#7a4008']], 'd') +
    RG('bx9-d', [[0, '#ffffff'], [0.5, '#fff0a0'], [1, '#ff9a3a']], ' cy=".7" r=".7"')  +
    RG('bx9-s', [[0, '#fff6c0'], [0.6, '#ff7a3a'], [1, '#d8281a']], ' cx=".4" cy=".35"') +
    D('bx9-cl', P('M-13 0a5 5 0 0 1 4-8a7 7 0 0 1 12-2a6 6 0 0 1 10 4a5 5 0 0 1 0 10z', '#ffeefa', 2.5)) +
    D('bx9-t', dots([[8, 10], [36, 8], [10, 22], [38, 24], [26, 6]], '#fff', 1.8) +
      P('M0 0H46V4H0ZM0 29H46V34H0ZM0 4H4V29H0ZM42 4H46V29H42Z', u('a'), 1.8));
  const body = C(80, 58, 80, u('h'), 0) + F(rays, u('y')) +
    `<circle cx="80" cy="56" r="62" fill="none" stroke="#ffd24a" stroke-width="2" stroke-dasharray="1.5 5" opacity=".7"/>` +
    shadow(137, 30, 0.3) +
    P('M24 94.5L80 110V130Z', u('l')) + P('M80 110L136 94.5L80 130Z', u('r')) +
    L('M38 99.5L80 123.5L122 99.5', '#ffd24a', 1.6, op(0.75)) + P('M80 125L84 131L80 137L76 131Z', '#fff', 2) +
    P('M24 88.5L80 104V110L24 94.5Z', u('a'), 2.5) + P('M80 104L136 88.5V94.5L80 110Z', '#c07a14', 2.5) +
    P('M24 88.5L80 73L136 88.5L80 104Z', u('a'), 2.5) +
    U('bx9-cl', ' transform="translate(22 100) scale(1.1)"') + U('bx9-cl', ' transform="translate(141 98)"') + U('bx9-cl', ' transform="translate(100 116) scale(.8)"') +
    C(80, -2, 14, u('h'), 0) + C(80, -2, 6.5, u('s'), 2.5) +
    P(M([r.l, r.a, r.r, r.b]), '#1a0e50') + P(g.T, u('d'), 2) +
    P(g.L, u('l')) + P(g.R, u('r')) +
    g.lm(U('bx9-t') + P(door, u('d'), 6) + L(door, '#ffd24a', 3)) +
    g.rm(U('bx9-t') + C(23, 18, 11, u('h'), 0) + P(cat, u('a'), 1.6)) +
    F(spk([[10, 30, 5], [150, 22, 5.5], [6, 70, 3.5], [154, 64, 4], [30, 6, 3.5], [146, 118, 3.5]]), '#fff6c0') +
    F(spk([[22, 50, 2.6], [118, 20, 2.4], [138, 40, 2.6], [44, 22, 2.4]]), '#ffb0f0');
  const face = (a, b, f, c) => {
    const e = [b[0], b[1] + 4.5], d = [a[0], a[1] + 4.5];
    return P(M([a, b, r.a]), f) + L(courses(a, b, r.a, [0.22, 0.44, 0.66]), c, 1.3, op(0.75)) +
      P(M([a, b, e, d]), '#2a1e9a', 2.5) +
      gems(RAINBOW.map((cc, i) => [...lp(a[0] < 80 ? a : b, r.a, 0.1 + i * 0.13), 2.2, cc]));
  };
  const fl = face(r.l, r.f, u('pl'), '#b87a10') + L('M77.5 70V10', '#fff', 1.6, op(0.7)) +
    P('M50 50q8-6 16 0q-8 6-16 0z', '#fff', 1.6) + C(58, 50, 2.6, '#2a6aff', 1.2) + L('M58 54.5l-2 6M50 50l-4 1', O, 1.4);
  const fr = face(r.f, r.r, u('pr'), '#6a3a06');
  return wrap(defs, body, ears(9, 56, 0.95, { c: '#2e2846', i: '#ff8ac0', y: '#ffd23f', g: '#ffc93a' }), fl, fr);
}

// ---------------------------------------------------------------- API
export const BOX_TIERS = [
  { name: 'Carton abîmé', desc: 'Un vieux carton cabossé, rafistolé au scotch. Il a vécu.' },
  { name: 'Carton renforcé', desc: 'Scotch bleu, autocollants et ficelle : solide comme un roc (ou presque).' },
  { name: 'Caisse en bois', desc: 'Planches clouées, coins en acier et corde de marin.' },
  { name: 'Panier en osier', desc: 'Osier tressé, nappe à carreaux et coussin moelleux à l’intérieur.' },
  { name: 'Coffre peint', desc: 'Peint à la main, ferrures en laiton et médaillon à la patte.' },
  { name: 'Maisonnette de chat', desc: 'Un vrai toit, une porte ronde, une fenêtre fleurie : la première chatière !' },
  { name: 'Chatière dorée', desc: 'Velours capitonné, dorures, clochette et pierres précieuses.' },
  { name: 'Pavillon royal', desc: 'Toit de jade, colonnes d’or, couronne et bannières royales.' },
  { name: 'Château de cristal', desc: 'Flèches de cristal et gemmes qui brillent de l’intérieur.' },
  { name: 'Palais céleste de Bastet', desc: 'Une pyramide d’or qui flotte parmi les étoiles, bénie par la déesse chat.' },
];

export function boxTier(level) { return Math.max(0, Math.min(9, Math.floor((level - 1) / 3))); }

const ART = [t0, t1, t2, t3, t4, t5, t6, t7, t8, t9];
const cache = [];
export function boxSVG(tier) {
  const t = Math.max(0, Math.min(9, tier | 0));
  return cache[t] || (cache[t] = ART[t]());
}
