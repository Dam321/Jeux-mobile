// Icônes SVG maison (pas d'emoji : rendu identique sur tous les téléphones)
const S = (body, vb = '0 0 32 32') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  gold: S(`<defs><radialGradient id="gG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffcc33"/><stop offset="1" stop-color="#d98a00"/></radialGradient></defs><circle cx="16" cy="16" r="13" fill="url(#gG)" stroke="#8a4b00" stroke-width="2"/><circle cx="16" cy="16" r="9" fill="none" stroke="#c97800" stroke-width="1.5"/><g fill="#a35a00"><ellipse cx="16" cy="18.5" rx="3.6" ry="3"/><circle cx="11.6" cy="14" r="1.6"/><circle cx="14.6" cy="11.8" r="1.6"/><circle cx="17.4" cy="11.8" r="1.6"/><circle cx="20.4" cy="14" r="1.6"/></g>`),
  gems: S(`<defs><linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6f5"/><stop offset=".45" stop-color="#ff5ccd"/><stop offset="1" stop-color="#9b1cbf"/></linearGradient></defs><path d="M8 5h16l6 8-14 16L2 13z" fill="url(#gm)" stroke="#5a0a78" stroke-width="2" stroke-linejoin="round"/><path d="M2 13h28M8 5l4 8 4-8 4 8 4-8M12 13l4 16 4-16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>`),
  yarn: S(`<defs><radialGradient id="yr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffc2e0"/><stop offset=".6" stop-color="#ff5ca8"/><stop offset="1" stop-color="#c2186b"/></radialGradient></defs><circle cx="16" cy="16" r="12.5" fill="url(#yr)" stroke="#7a0a42" stroke-width="2"/><g fill="none" stroke="#ffe1f0" stroke-width="1.5" stroke-linecap="round"><path d="M6 12c6 2 14 1 20-4"/><path d="M5 18c8 1 15-2 22-8"/><path d="M8 24c6-1 12-6 18-12"/><path d="M12 5c-2 6-1 15 3 23"/></g><path d="M26 22c3 1 4 3 3 6" stroke="#ff5ca8" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  feathers: S(`<defs><linearGradient id="ft" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3fa9ff"/><stop offset=".6" stop-color="#7fd8ff"/><stop offset="1" stop-color="#e6fbff"/></linearGradient></defs><path d="M27 3C14 4 6 13 6 24l3-1C12 14 18 9 27 3z" fill="url(#ft)" stroke="#0a4f8a" stroke-width="1.8" stroke-linejoin="round"/><path d="M27 3C25 14 17 22 9 23" fill="url(#ft)" stroke="#0a4f8a" stroke-width="1.8"/><path d="M4 29L22 9" stroke="#0a4f8a" stroke-width="1.8" stroke-linecap="round"/>`),
  eggs: S(`<defs><radialGradient id="eg" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#ffe9a8"/><stop offset="1" stop-color="#e3a63a"/></radialGradient></defs><path d="M16 3c6 0 11 9 11 16a11 11 0 0 1-22 0C5 12 10 3 16 3z" fill="url(#eg)" stroke="#8a5a10" stroke-width="2"/><path d="M7 17l4-2 3 3 4-3 3 3 4-2" fill="none" stroke="#ff7ae0" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="23" r="1.6" fill="#7fd8ff"/><circle cx="20" cy="24" r="1.3" fill="#62d86b"/>`),
  food: S(`<path d="M5 14h22l-2 12H7z" fill="#ff9d3c" stroke="#7a3a00" stroke-width="2" stroke-linejoin="round"/><ellipse cx="16" cy="14" rx="11" ry="3" fill="#ffcf8a" stroke="#7a3a00" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="#a0602a"/><circle cx="17" cy="11" r="2.2" fill="#b8703a"/><circle cx="21" cy="12.5" r="2" fill="#a0602a"/>`),
  arenaCoins: S(`<circle cx="16" cy="17" r="12" fill="#c77dff" stroke="#4a1080" stroke-width="2"/><path d="M10 12l6 10 6-10-6 3z" fill="#fff" opacity=".9"/><path d="M11 3l5 6 5-6" fill="none" stroke="#ff4d5e" stroke-width="3"/>`),
  speedMin: S(`<path d="M8 3h16M8 29h16M10 3c0 8 12 9 12 13s-12 5-12 13M22 3c0 8-12 9-12 13s12 5 12 13" fill="none" stroke="#2a6fe0" stroke-width="2.2" stroke-linecap="round"/><path d="M12 8h8l-4 5zM11 26c1-4 9-4 10 0z" fill="#ffcc33"/>`),
  power: S(`<path d="M18 2L6 18h8l-3 12 13-17h-8z" fill="#ffd23f" stroke="#a35a00" stroke-width="2" stroke-linejoin="round"/>`),
  crown: S(`<path d="M4 24l-1-14 7 6 6-11 6 11 7-6-1 14z" fill="#ffcc33" stroke="#8a4b00" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="18" r="2.5" fill="#ff4d5e"/><rect x="4" y="24" width="24" height="4" rx="1" fill="#ffb52e" stroke="#8a4b00" stroke-width="2"/>`),
  xp: S(`<path d="M16 2l4 9 10 1-7.5 7 2 10L16 24l-8.5 5 2-10L2 12l10-1z" fill="#7fd8ff" stroke="#0a4f8a" stroke-width="2" stroke-linejoin="round"/>`),
  ticket: S(`<path d="M3 9h26v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6z" fill="#ff7ae0" stroke="#7a1060" stroke-width="2"/><path d="M12 9v14" stroke="#7a1060" stroke-dasharray="2 2" stroke-width="1.5"/>`),
  key: S(`<circle cx="10" cy="16" r="6" fill="none" stroke="#ffcc33" stroke-width="3.5"/><path d="M15 16h14M24 16v5M28 16v4" stroke="#ffcc33" stroke-width="3.5" stroke-linecap="round"/>`),
  // navigation
  hero: S(`<path d="M6 4l5 6h10l5-6 1 12c0 7-5 12-11 12S5 23 5 16z" fill="#ffb05e" stroke="#5a2a00" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="17" r="2" fill="#1d1530"/><circle cx="20" cy="17" r="2" fill="#1d1530"/><path d="M14 22c1 1 3 1 4 0" stroke="#1d1530" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
  skills: S(`<path d="M18 2L7 17h7l-3 13 14-18h-8z" fill="#7fd8ff" stroke="#0a3f7a" stroke-width="2" stroke-linejoin="round"/>`),
  pets: S(`<ellipse cx="16" cy="21" rx="7" ry="6" fill="#ff9fd8" stroke="#7a1060" stroke-width="2"/><circle cx="7" cy="12" r="3.5" fill="#ff9fd8" stroke="#7a1060" stroke-width="2"/><circle cx="13" cy="7" r="3.5" fill="#ff9fd8" stroke="#7a1060" stroke-width="2"/><circle cx="20" cy="7" r="3.5" fill="#ff9fd8" stroke="#7a1060" stroke-width="2"/><circle cx="26" cy="12" r="3.5" fill="#ff9fd8" stroke="#7a1060" stroke-width="2"/>`),
  adventure: S(`<path d="M5 27L22 10M22 10l3-6 3 3-6 3M8 20l4 4" stroke="#e8edf5" stroke-width="3" stroke-linecap="round"/><path d="M27 27L10 10M10 10L7 4 4 7l6 3M24 20l-4 4" stroke="#ffcc33" stroke-width="3" stroke-linecap="round"/>`),
  shop: S(`<path d="M5 10h22l-2 18H7z" fill="#ff5ca8" stroke="#7a0a42" stroke-width="2" stroke-linejoin="round"/><path d="M11 13V8a5 5 0 0 1 10 0v5" fill="none" stroke="#7a0a42" stroke-width="2.4" stroke-linecap="round"/><path d="M12 20l3 3 6-6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  quest: S(`<path d="M8 4h16v24l-8-5-8 5z" fill="#ffcc33" stroke="#8a4b00" stroke-width="2" stroke-linejoin="round"/><path d="M12 10h8M12 15h8" stroke="#8a4b00" stroke-width="2" stroke-linecap="round"/>`),
  pass: S(`<rect x="3" y="7" width="26" height="18" rx="3" fill="#c77dff" stroke="#3a0a78" stroke-width="2"/><path d="M10 20l-1-8 4 3 3-5 3 5 4-3-1 8z" fill="#ffcc33" stroke="#8a4b00" stroke-width="1.4"/>`),
  gift: S(`<rect x="4" y="12" width="24" height="16" rx="2" fill="#ff4d5e" stroke="#7a0a1a" stroke-width="2"/><rect x="3" y="9" width="26" height="5" rx="1.5" fill="#ff7a8a" stroke="#7a0a1a" stroke-width="2"/><path d="M16 9v19" stroke="#ffcc33" stroke-width="4"/><path d="M16 9c-3-6-9-5-8-1s8 1 8 1 5-7 8-1-8 1-8 1" fill="#ffcc33" stroke="#8a4b00" stroke-width="1.5"/>`),
  flash: S(`<circle cx="16" cy="16" r="13" fill="#ff7a1a" stroke="#7a2a00" stroke-width="2"/><path d="M17 5l-8 12h6l-2 10 9-13h-6z" fill="#fff6b0"/>`),
  tv: S(`<rect x="3" y="7" width="26" height="18" rx="3" fill="#3ddc84" stroke="#0a5a2a" stroke-width="2"/><path d="M13 11v10l9-5z" fill="#fff"/><path d="M11 3l5 4 5-4" stroke="#0a5a2a" stroke-width="2" fill="none"/>`),
  settings: S(`<path d="M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm11 8v-4l-3-1-1-2 1.5-3-3-3-3 1.5-2-1-1-3h-4l-1 3-2 1-3-1.5-3 3L7 11l-1 2-3 1v4l3 1 1 2-1.5 3 3 3 3-1.5 2 1 1 3h4l1-3 2-1 3 1.5 3-3-1.5-3 1-2z" fill="#c9c4e8" stroke="#2a1d52" stroke-width="1.6"/>`),
  close: S(`<path d="M8 8l16 16M24 8L8 24" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`),
  chest: S(`<path d="M4 14h24v13H4z" fill="#b8703a" stroke="#4a2200" stroke-width="2"/><path d="M4 14c0-7 4-9 12-9s12 2 12 9z" fill="#d98a4a" stroke="#4a2200" stroke-width="2"/><path d="M4 14h24M10 6v21M22 6v21" stroke="#ffcc33" stroke-width="2.5"/><rect x="13" y="12" width="6" height="7" rx="1" fill="#ffcc33" stroke="#4a2200" stroke-width="1.5"/>`),
  tower: S(`<path d="M10 29V12h12v17z" fill="#b8703a" stroke="#4a2200" stroke-width="2"/><path d="M6 12h20l-3-5H9z" fill="#ff9d3c" stroke="#4a2200" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="4" r="2.5" fill="#ff5ca8"/><path d="M13 29v-6a3 3 0 0 1 6 0v6" fill="#4a2200"/>`),
  arena: S(`<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#4aa9ff" stroke="#0a2f7a" stroke-width="2" stroke-linejoin="round"/><path d="M11 15l4 4 7-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  dungeon: S(`<path d="M4 28V14a12 12 0 0 1 24 0v14z" fill="#5a4a8a" stroke="#1d1530" stroke-width="2"/><path d="M10 28V16a6 6 0 0 1 12 0v12" fill="#1d1530"/><circle cx="13" cy="19" r="1.5" fill="#ff4d5e"/><circle cx="19" cy="19" r="1.5" fill="#ff4d5e"/>`),
  lock: S(`<rect x="7" y="14" width="18" height="14" rx="3" fill="#c9c4e8" stroke="#2a1d52" stroke-width="2"/><path d="M11 14V10a5 5 0 0 1 10 0v4" fill="none" stroke="#2a1d52" stroke-width="2.6"/>`),
  hammer: S(`<path d="M4 27l13-13" stroke="#8a5a2c" stroke-width="4" stroke-linecap="round"/><path d="M14 8l6-5 9 9-5 6z" fill="#c9cbd8" stroke="#2a2a40" stroke-width="2" stroke-linejoin="round"/>`),
  trophy: S(`<path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#ffcc33" stroke="#8a4b00" stroke-width="2"/><path d="M9 7H4c0 5 3 7 6 7M23 7h5c0 5-3 7-6 7" fill="none" stroke="#8a4b00" stroke-width="2"/><path d="M13 18h6v5h-6zM9 28h14v-4H9z" fill="#ffb52e" stroke="#8a4b00" stroke-width="2"/>`),
  // emplacements d'équipement
  claws: S(`<g fill="#e8edf5" stroke="#2a2a40" stroke-width="1.6" stroke-linejoin="round"><path d="M6 28C8 18 11 9 16 3c-2 9-3 17-5 25z"/><path d="M13 29c2-10 6-18 12-24-3 9-5 17-8 24z"/><path d="M20 29c2-7 5-12 9-16-2 6-3 11-5 16z"/></g>`),
  hat: S(`<path d="M4 23c0-10 5-17 12-17s12 7 12 17z" fill="currentColor" stroke="#2a1d52" stroke-width="2"/><rect x="3" y="21" width="26" height="6" rx="3" fill="#fff" stroke="#2a1d52" stroke-width="2"/><circle cx="16" cy="5" r="3.5" fill="#fff" stroke="#2a1d52" stroke-width="2"/>`),
  armor: S(`<path d="M11 4l5 3 5-3 8 5-3 6-3-1v14H9V14l-3 1-3-6z" fill="currentColor" stroke="#2a1d52" stroke-width="2" stroke-linejoin="round"/><path d="M9 18h14M9 22h14" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>`),
  gloves: S(`<path d="M9 28V14l-3-3 2-3 4 3V8a2 2 0 0 1 4 0v-2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v14c0 4-2 7-5 7z" fill="currentColor" stroke="#2a1d52" stroke-width="2" stroke-linejoin="round"/><rect x="8" y="24" width="15" height="5" rx="2" fill="#fff" stroke="#2a1d52" stroke-width="2"/>`),
  boots: S(`<path d="M8 3h10v14l9 4c2 1 2 7-1 7H6c-1 0-2-1-2-2z" fill="currentColor" stroke="#2a1d52" stroke-width="2" stroke-linejoin="round"/><rect x="7" y="3" width="12" height="5" rx="2" fill="#fff" stroke="#2a1d52" stroke-width="2"/>`),
  collar: S(`<path d="M4 10c4 5 20 5 24 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="16" cy="20" r="7" fill="#ffcc33" stroke="#8a4b00" stroke-width="2"/><path d="M11 20h10M16 24v3" stroke="#8a4b00" stroke-width="2"/>`),
  cape: S(`<path d="M10 3h12l2 5c5 6 5 14 3 20l-5-3-6 4-6-4-5 3c-2-6-2-14 3-20z" fill="currentColor" stroke="#2a1d52" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="6" r="2.5" fill="#ffcc33" stroke="#8a4b00" stroke-width="1.5"/>`),
  ring: S(`<circle cx="16" cy="20" r="9" fill="none" stroke="#ffcc33" stroke-width="4"/><circle cx="16" cy="20" r="9" fill="none" stroke="#8a4b00" stroke-width="1" /><path d="M16 3l6 6-6 6-6-6z" fill="currentColor" stroke="#2a1d52" stroke-width="2" stroke-linejoin="round"/>`),
  // compétences
  sk_slash: S(`<g stroke="#7fe9ff" stroke-width="3" stroke-linecap="round" fill="none"><path d="M6 26C10 16 16 9 26 5"/><path d="M4 18c5-7 10-11 18-14"/><path d="M12 29c4-8 9-14 17-18"/></g>`),
  sk_furball: S(`<circle cx="16" cy="16" r="11" fill="#d9a066" stroke="#5a2a00" stroke-width="2"/><g stroke="#ffe0b0" stroke-width="1.5" fill="none"><path d="M7 12c6 2 13 1 18-4"/><path d="M6 19c8 1 14-2 20-8"/></g>`),
  sk_kibble: S(`<g fill="#b0713a" stroke="#4a2200" stroke-width="1.5"><path d="M8 4l5 2-1 5-5-1z"/><path d="M20 8l5 1-1 5-5-1z"/><path d="M12 16l5 2-1 5-5-1z"/><path d="M22 20l5 2-1 5-5-1z"/><path d="M5 23l5 1-1 5-5-1z"/></g>`),
  sk_purrheal: S(`<path d="M16 28C5 20 3 14 6 9s9-4 10 1c1-5 7-6 10-1s1 11-10 19z" fill="#5dff9e" stroke="#0a6a3a" stroke-width="2"/><path d="M16 12v10M11 17h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  sk_fish: S(`<path d="M4 16c5-7 13-8 19-3l5-4v14l-5-4c-6 5-14 4-19-3z" fill="#9fc6e8" stroke="#1a4f8a" stroke-width="2" stroke-linejoin="round"/><circle cx="10" cy="15" r="1.6" fill="#1d1530"/><path d="M3 27c8 2 18 0 26-6M5 5c8-2 16 0 22 5" stroke="#7fd8ff" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  sk_laser: S(`<circle cx="9" cy="16" r="6" fill="#fff" stroke="#1d1530" stroke-width="2"/><circle cx="10" cy="16" r="3" fill="#ff2a55"/><path d="M14 13l15-5M14 19l15 5" stroke="#ff2a55" stroke-width="3" stroke-linecap="round"/>`),
  sk_shield: S(`<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#7fd8ff" stroke="#0a3f7a" stroke-width="2" stroke-linejoin="round"/><path d="M16 9c-3 0-5 2-5 4 0 4 5 7 5 7s5-3 5-7c0-2-2-4-5-4z" fill="#fff" opacity=".85"/>`),
  sk_thunder: S(`<path d="M8 12a8 6 0 0 1 16 0h1a4 4 0 0 1 0 8H7a4 4 0 0 1 1-8z" fill="#c9cbd8" stroke="#2a2a40" stroke-width="2"/><path d="M17 17l-5 7h4l-2 6 7-9h-4l2-4z" fill="#ffd23f" stroke="#8a4b00" stroke-width="1.4"/>`),
  sk_meteor: S(`<circle cx="20" cy="20" r="8" fill="#ff5ca8" stroke="#7a0a42" stroke-width="2"/><path d="M3 3l11 11M7 2l9 9M2 8l9 9" stroke="#ff9d3c" stroke-width="3" stroke-linecap="round"/>`),
  sk_ninelives: S(`<path d="M16 3l3 8h8l-6 5 2 9-7-5-7 5 2-9-6-5h8z" fill="#ffd23f" stroke="#8a4b00" stroke-width="2" stroke-linejoin="round"/><text x="16" y="21" text-anchor="middle" font-size="9" font-weight="900" fill="#8a4b00">9</text>`),
  sk_nova: S(`<circle cx="16" cy="16" r="5" fill="#fff"/><g fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M16 16c8-8 13 2 6 7" stroke="#c77dff"/><path d="M16 16c-8 8-13-2-6-7" stroke="#ff7ae0"/><path d="M16 16c-2-10 9-11 10-4" stroke="#7fd8ff"/><path d="M16 16c2 10-9 11-10 4" stroke="#c77dff"/></g>`),
  sk_tiger: S(`<g fill="#ffd23f" stroke="#8a4b00" stroke-width="1.6"><path d="M4 29C7 18 10 10 15 3c-1 9-3 18-6 26z"/><path d="M12 30c3-11 7-19 13-25-2 9-5 18-9 25z"/><path d="M20 30c3-8 6-13 10-17-2 7-4 12-7 17z"/></g>`),
};

// Les dégradés sont regroupés dans un <svg> global (évite les id dupliqués / masqués)
const DEFS = [];
for (const k in ICONS) {
  ICONS[k] = ICONS[k].replace(/<defs>([\s\S]*?)<\/defs>/, (m, d) => { DEFS.push(d); return ''; });
}
export function injectIconDefs() {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = `<svg width="0" height="0"><defs>${DEFS.join('')}</defs></svg>`;
  document.body.appendChild(d);
}

export function icon(name, cls = '') {
  return `<i class="ic ${cls}">${ICONS[name] || ''}</i>`;
}
export function iconEl(name, cls = '') {
  const i = document.createElement('i');
  i.className = 'ic ' + cls;
  i.innerHTML = ICONS[name] || '';
  return i;
}
