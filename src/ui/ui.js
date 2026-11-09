// Interface : coque, HUD, modales, toasts, effets d'interface
import { h, fmt, fmtTime, fmtPct } from '../util.js';
import { icon, iconEl, injectIconDefs } from './icons.js';
import {
  RARITIES, SLOTS, SUBSTATS, SKILLS, PETS, SKINS, xpToNext, VIP_PERKS, biomeForChapter, BOX_MAX_LEVEL, boxOdds,
} from '../config.js';
import { itemMain, itemPower, SKILL_BY_ID, PET_BY_ID, SKIN_BY_ID } from '../stats.js';
import { idlePending, idleCapH, boxUpgradeInfo } from '../economy.js';
import { sfx } from '../audio.js';
import { PANELS } from './panels.js';

export const RES_LABEL = { gold: 'Or', gems: 'Gemmes', yarn: 'Pelotes', feathers: 'Plumes', eggs: 'Œufs', food: 'Croquettes', arenaCoins: 'Médailles', speedMin: 'Accélérateur', xp: 'XP' };

export function rarityName(r) { return RARITIES[r].name; }
export function slotName(id) { return SLOTS.find((s) => s.id === id).name; }

export class UI {
  constructor(game) {
    this.g = game;
    this.snaps = {};
    this.sheet = null;
    this.hudCache = {};
    injectIconDefs();
    this.build();
  }

  // ---------------------------------------------------------------- coque
  build() {
    const g = this.g;
    const app = document.getElementById('app');
    this.app = app;
    app.innerHTML = '';
    // Zone de combat
    this.stageEl = h('div.stage');
    this.glEl = h('div.gl');
    this.barsEl = h('div.layer.bars');
    this.textEl = h('div.layer.ftexts');
    this.flashEl = h('div.flash');
    this.stageEl.append(this.glEl, this.barsEl, this.textEl, this.flashEl);

    // HUD haut
    this.avatarImg = h('img.avatar-img', { alt: '' });
    this.lvlEl = h('b.lvl', null, '1');
    this.xpFill = h('i.xpfill');
    this.vipEl = h('button.vip-badge', { onclick: () => this.open('shop', 'vip'), 'aria-label': 'VIP' }, h('span', { html: icon('crown') }), h('b', null, 'VIP 0'));
    this.powerEl = h('b.pw-val', null, '0');
    this.powerDelta = h('span.pw-delta');
    const hud = h('div.hud',
      null,
      h('div.hud-row',
        null,
        h('button.avatar', { onclick: () => this.open('hero', 'stats'), 'aria-label': 'Héros' }, this.avatarImg, this.lvlEl, h('div.xpbar', null, this.xpFill)),
        h('div.hud-mid', null, h('div.power', null, h('span', { html: icon('power') }), this.powerEl, this.powerDelta), this.vipEl),
        h('button.icon-btn.settings', { onclick: () => this.open('settings'), 'aria-label': 'Paramètres', html: icon('settings') }),
      ),
      h('div.res-row', null, ['gold', 'gems', 'yarn'].map((k) => {
        const v = h('b', null, '0');
        this.hudCache['res_' + k] = { el: v, v: -1 };
        return h('button.res', { onclick: () => this.open('shop', k === 'gems' ? 'gems' : 'offers'), dataset: { res: k } }, h('span', { html: icon(k) }), v, h('i.plus', null, '+'));
      })),
    );
    this.stageInfo = h('div.stage-info', null, h('b.stage-name'), h('span.stage-biome'), h('div.waves'));
    this.bossBar = h('div.boss-bar', { hidden: true }, h('b.bname'), h('div.btrack', null, h('i.bfill'), h('i.bfill2')), h('span.bhp'));
    this.modeBanner = h('div.mode-banner', { hidden: true }, h('b'), h('button.btn.sm.red', { onclick: () => g.leaveSpecial() }, 'Quitter'));
    // boutons latéraux
    this.sideL = h('div.side.left');
    this.sideR = h('div.side.right');
    // contrôles combat
    this.skillRow = h('div.skill-row');
    this.speedBtn = h('button.ctrl.speed', { onclick: () => g.cycleSpeed() }, 'x1');
    this.challengeBtn = h('button.ctrl.challenge', { onclick: () => g.challenge() }, 'DÉFIER');
    this.autoChBtn = h('button.ctrl.autoch', { onclick: () => g.toggleAutoChallenge() }, 'AUTO');
    this.idleBtn = h('button.idle-chest', { onclick: () => this.showIdle() }, h('span', { html: icon('chest') }), h('i.idle-fill'), h('b.idle-t'));
    const ctrls = h('div.ctrls', null, this.idleBtn, this.skillRow, h('div.ctrl-r', null, this.challengeBtn, this.autoChBtn, this.speedBtn));
    this.stageEl.append(hud, this.stageInfo, this.bossBar, this.modeBanner, this.sideL, this.sideR, ctrls);

    // Accueil : stats + équipement + carton
    this.home = h('div.home');
    this.statLine = h('div.stat-line');
    this.gearL = h('div.gear-col');
    this.gearR = h('div.gear-col');
    this.boxArea = this.buildBox();
    this.home.append(this.statLine, h('div.home-main', null, this.gearL, this.boxArea, this.gearR));

    // Navigation
    this.nav = h('nav.nav');
    const tabs = [['hero', 'Héros'], ['skills', 'Pouvoirs'], ['pets', 'Compagnons'], ['adventure', 'Aventure'], ['shop', 'Boutique']];
    this.navBtns = {};
    for (const [id, label] of tabs) {
      const b = h('button.nav-btn', { onclick: () => (this.sheet && this.sheet.name === id ? this.closeSheet() : this.open(id)) }, h('span', { html: icon(id) }), h('b', null, label), h('i.dot', { hidden: true }));
      this.navBtns[id] = b;
      this.nav.append(b);
    }
    this.sheetEl = h('div.sheet', { hidden: true });
    this.modalRoot = h('div.modal-root');
    this.toasts = h('div.toasts');
    this.flyLayer = h('div.fly-layer');
    this.handEl = h('div.tuto-hand', { hidden: true }, h('span', null, '👆'), h('b'));
    app.append(this.stageEl, this.home, this.sheetEl, this.nav, this.modalRoot, this.toasts, this.flyLayer, this.handEl);
  }

  buildBox() {
    const g = this.g;
    this.boxLvl = h('b.box-lvl', null, 'Nv 1');
    this.boxUpBtn = h('button.box-up', { onclick: () => this.showBoxUpgrade() }, h('span', { html: icon('hammer') }), h('b.box-up-t', null, 'Améliorer'));
    this.batchBtn = h('button.box-side.batch', { onclick: () => g.cycleBatch() }, h('small', null, 'Quantité'), h('b', null, 'x1'));
    this.autoBtn = h('button.box-side.auto', { onclick: () => g.toggleAutoBox() }, h('small', null, 'Auto'), h('b', null, 'OFF'));
    this.yarnCount = h('b.yarn-count', null, '0');
    this.boxBtn = h('button.box-btn', { 'aria-label': 'Ouvrir le carton', onclick: () => g.openBoxClick() },
      h('div.box-glow'),
      h('div.box-svg', { html: BOX_SVG }),
      h('div.box-yarn', null, h('span', { html: icon('yarn') }), this.yarnCount),
    );
    return h('div.box-area', null, this.boxBtn, h('div.box-meta', null, this.batchBtn, h('div.box-lvlwrap', null, this.boxLvl, this.boxUpBtn), this.autoBtn));
  }

  setSnaps(s) { this.snaps = s; }

  // ---------------------------------------------------------------- mises à jour
  setText(key, el, val) {
    const c = this.hudCache[key] || (this.hudCache[key] = { v: null });
    if (c.v !== val) { el.textContent = val; c.v = val; }
  }

  updateHud() {
    const g = this.g, st = g.st, S = g.stats;
    for (const k of ['gold', 'gems', 'yarn']) {
      const c = this.hudCache['res_' + k];
      const v = Math.floor(st.res[k]);
      if (c.v !== v) { c.el.textContent = fmt(v); c.v = v; }
    }
    this.setText('lvl', this.lvlEl, String(st.hero.lvl));
    this.xpFill.style.transform = `scaleX(${Math.min(1, st.hero.xp / xpToNext(st.hero.lvl))})`;
    this.setText('vip', this.vipEl.lastChild, 'VIP ' + S.vip);
    this.vipEl.classList.toggle('hi', S.vip >= 8);
    // puissance animée
    const target = S.power;
    if (this.shownPower == null) this.shownPower = target;
    if (Math.abs(this.shownPower - target) > target * 0.001) this.shownPower += (target - this.shownPower) * 0.2;
    else this.shownPower = target;
    this.setText('pw', this.powerEl, fmt(this.shownPower));
    // carton
    this.setText('yarn', this.yarnCount, fmt(st.res.yarn));
    this.setText('boxlvl', this.boxLvl, 'Nv ' + st.box.lvl);
    const up = boxUpgradeInfo(st);
    let upTxt = up.max ? 'MAX' : up.busy ? (up.left > 0 ? fmtTime(up.left) : 'Terminé !') : 'Améliorer';
    this.setText('boxup', this.boxUpBtn.lastChild, upTxt);
    this.boxUpBtn.classList.toggle('ready', !up.max && !up.busy && st.res.gold >= up.gold);
    this.boxUpBtn.classList.toggle('busy', !!up.busy);
    this.boxUpBtn.classList.toggle('done', !!up.busy && up.left <= 0);
    this.boxBtn.classList.toggle('empty', st.res.yarn <= 0);
    this.boxArea.dataset.tier = Math.min(8, Math.floor((st.box.lvl - 1) / 4));
    this.setText('batch', this.batchBtn.lastChild, 'x' + g.batchSize());
    this.setText('auto', this.autoBtn.lastChild, g.autoBox ? 'ON' : 'OFF');
    this.autoBtn.classList.toggle('on', g.autoBox);
    this.autoBtn.classList.toggle('locked', !g.autoUnlocked());
    // passif
    const idle = idlePending(st);
    const cap = idleCapH(st);
    this.idleBtn.querySelector('.idle-fill').style.transform = `scaleY(${Math.min(1, idle.hours / cap)})`;
    this.setText('idle', this.idleBtn.querySelector('.idle-t'), idle.hours >= cap ? 'PLEIN' : fmtTime(idle.hours * 3600));
    this.idleBtn.classList.toggle('full', idle.hours >= 1);
    // combat
    this.setText('speed', this.speedBtn, 'x' + g.battle.speed);
    const camp = st.camp;
    const special = g.special;
    this.challengeBtn.hidden = !!special || camp.auto;
    this.autoChBtn.hidden = !!special;
    this.autoChBtn.classList.toggle('on', camp.auto);
    this.setText('chal', this.challengeBtn, (g.nextIsBoss() ? 'DÉFIER LE BOSS' : 'DÉFIER'));
  }

  updateStageInfo() {
    const g = this.g, st = g.st;
    const sp = g.special;
    const name = this.stageInfo.querySelector('.stage-name');
    const bio = this.stageInfo.querySelector('.stage-biome');
    if (sp) { name.textContent = sp.title; bio.textContent = sp.sub || ''; }
    else {
      name.textContent = `${st.camp.ch}-${st.camp.st}`;
      bio.textContent = biomeForChapter(st.camp.ch).name + (st.camp.auto ? '' : ' · Entraînement');
    }
    const w = this.stageInfo.querySelector('.waves');
    const n = g.battle.enc ? g.battle.enc.waves.length : 3;
    w.innerHTML = '';
    for (let i = 0; i < n; i++) w.append(h('i', { cls: i < g.battle.wave ? 'done' : i === g.battle.wave ? 'cur' : '' }));
    this.modeBanner.hidden = !sp;
    if (sp) this.modeBanner.firstChild.textContent = sp.banner || sp.title;
  }

  renderGear() {
    const st = this.g.st;
    this.gearL.innerHTML = '';
    this.gearR.innerHTML = '';
    SLOTS.forEach((s, i) => {
      const it = st.gear[s.id];
      const el = it ? this.itemIcon(it) : h('div.item-ic.empty', { html: icon(s.id) });
      const b = h('button.gear-slot', { onclick: () => it && this.showItem(it, null), 'aria-label': s.name }, el);
      (i < 4 ? this.gearL : this.gearR).append(b);
    });
    const S = this.g.stats;
    this.statLine.innerHTML = '';
    this.statLine.append(
      h('span', null, h('i.stat-k.atk', null, 'ATQ'), fmt(S.atk)),
      h('span', null, h('i.stat-k.hp', null, 'PV'), fmt(S.hp)),
      h('span', null, h('i.stat-k.def', null, 'DÉF'), fmt(S.def)),
      h('button.stat-more', { onclick: () => this.open('hero', 'stats') }, 'Détails'),
    );
  }

  renderSkillRow() {
    const g = this.g;
    this.skillRow.innerHTML = '';
    this.skillCds = [];
    for (const sk of g.battle.skills || []) {
      const cd = h('i.cd');
      this.skillCds.push(cd);
      this.skillRow.append(h('div.sk-mini', { cls: 'r' + sk.r, html: icon('sk_' + sk.id) }, cd));
    }
  }
  updateSkillCds() {
    const b = this.g.battle;
    if (!this.skillCds) return;
    for (let i = 0; i < this.skillCds.length; i++) {
      const sk = b.skills[i];
      if (!sk) continue;
      const k = Math.max(0, Math.min(1, b.skillCd[i] / sk.cd));
      this.skillCds[i].style.transform = `scaleY(${k})`;
    }
  }
  pulseSkill(i) {
    const el = this.skillRow.children[i];
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  renderSide() {
    const g = this.g, st = g.st;
    const L = [], R = [];
    const btn = (ic, label, fn, o = {}) => h('button.side-btn', { onclick: fn, cls: o.cls || '' }, h('span', { html: icon(ic) }), h('b', null, label), o.dot ? h('i.dot') : null, o.timer ? h('small', { dataset: { until: o.timer } }) : null);
    L.push(btn('quest', 'Quêtes', () => this.open('quests'), { dot: g.questsClaimable() }));
    L.push(btn('pass', 'Passe', () => this.open('shop', 'pass'), { dot: g.passClaimable() }));
    L.push(btn('tv', 'Bonus', () => this.open('ads'), { dot: st.daily.ads < 8 }));
    if (st.iap.firstRecharge !== 2) R.push(btn('gift', st.iap.firstRecharge ? 'Réclamer !' : '1er achat', () => this.open('firstRecharge'), { cls: 'glow', dot: st.iap.firstRecharge === 1 }));
    if (st.iap.flash && st.iap.flash.until > Date.now()) R.push(btn('flash', 'Flash', () => this.showFlash(), { cls: 'glow-o', timer: st.iap.flash.until }));
    R.push(btn('shop', 'Offres', () => this.open('shop', 'offers'), { dot: !st.daily.freeGift }));
    R.push(btn('crown', 'VIP', () => this.open('shop', 'vip'), { dot: g.vipGiftClaimable() }));
    this.sideL.replaceChildren(...L);
    this.sideR.replaceChildren(...R);
    // points rouges navigation
    this.navBtns.skills.querySelector('.dot').hidden = !(st.res.feathers >= 1 || g.anyLevelUp('skills'));
    this.navBtns.pets.querySelector('.dot').hidden = !(st.res.eggs >= 1 || g.anyLevelUp('pets'));
    this.navBtns.adventure.querySelector('.dot').hidden = !g.adventureDot();
    this.navBtns.shop.querySelector('.dot').hidden = !(!st.daily.freeGift || g.vipGiftClaimable() || g.fundClaimable());
    this.navBtns.hero.querySelector('.dot').hidden = !g.trainAffordable();
  }

  tickTimers() {
    const now = Date.now();
    for (const el of this.app.querySelectorAll('[data-until]')) {
      const left = (+el.dataset.until - now) / 1000;
      el.textContent = left > 0 ? fmtTime(left) : '—';
    }
  }

  // ---------------------------------------------------------------- objets
  itemIcon(it, extra = '') {
    const r = RARITIES[it.r];
    return h('div.item-ic', { cls: 'r' + it.r + ' ' + extra, style: { '--rc': r.color, '--rd': r.dark } },
      h('span.ic-wrap', { html: icon(it.slot) }),
      h('b.ilvl', null, 'Nv ' + it.l),
    );
  }
  itemStats(it) {
    const m = itemMain(it);
    const rows = [];
    if (m.atk) rows.push(['ATQ', fmt(m.atk), 'atk']);
    if (m.hp) rows.push(['PV', fmt(m.hp), 'hp']);
    if (m.def) rows.push(['DÉF', fmt(m.def), 'def']);
    return h('div.istats', null,
      rows.map(([k, v, c]) => h('div.irow', null, h('i.stat-k', { cls: c }, k), h('b', null, '+' + v))),
      it.subs.map((s) => h('div.irow.sub', null, h('span', null, SUBSTATS[s.k].name), h('b', null, '+' + fmtPct(s.v)))),
    );
  }
  itemCard(it, label) {
    const r = RARITIES[it.r];
    return h('div.icard', { cls: 'r' + it.r, style: { '--rc': r.color, '--rd': r.dark } },
      label ? h('small.ilabel', null, label) : null,
      h('div.icard-top', null, this.itemIcon(it), h('div', null, h('b.iname', null, slotName(it.slot)), h('span.irar', null, r.name), h('span.ipow', { html: icon('power') + fmt(itemPower(it)) }))),
      this.itemStats(it),
    );
  }
  // fenêtre de comparaison : nouvel objet vs équipé
  showItem(it, onDone, isNew) {
    const g = this.g;
    const cur = g.st.gear[it.slot];
    const same = cur && cur.id === it.id;
    const body = h('div.compare');
    if (!same && cur) body.append(this.itemCard(cur, 'Équipé'));
    body.append(this.itemCard(it, isNew ? 'Nouveau' : same ? 'Équipé' : ''));
    if (!same && cur) {
      const d = itemPower(it) - itemPower(cur);
      body.append(h('div.pdiff', { cls: d >= 0 ? 'up' : 'down' }, (d >= 0 ? '▲ +' : '▼ ') + fmt(Math.abs(d)) + ' puissance'));
    }
    const btns = [];
    if (!same) {
      btns.push({ label: 'Recycler', sub: '+' + fmt(g.recycleValue(it)) + ' or', cls: 'red', fn: () => { g.recycle(it); onDone && onDone(); } });
      btns.push({ label: 'Équiper', cls: 'green', fn: () => { g.equip(it); onDone && onDone(); } });
    } else btns.push({ label: 'Fermer', cls: 'blue', fn: () => {} });
    this.modal({ title: isNew ? 'Le carton contenait…' : slotName(it.slot), body, buttons: btns, cls: 'r' + it.r + (it.r >= 4 ? ' legendary' : ''), rays: it.r >= 4 ? RARITIES[it.r].color : null, noClose: isNew && !same });
  }

  // ---------------------------------------------------------------- feuilles (panneaux)
  open(name, tab) {
    sfx('click');
    const P = PANELS[name];
    if (!P) return;
    this.sheet = { name, tab: tab || (P.tabs ? P.tabs[0][0] : null), scroll: 0 };
    for (const k in this.navBtns) this.navBtns[k].classList.toggle('active', k === name);
    this.renderSheet(true);
    this.g.onSheet && this.g.onSheet(name);
  }
  closeSheet() {
    this.sheet = null;
    this.sheetEl.classList.remove('in');
    this.sheetEl.hidden = true;
    for (const k in this.navBtns) this.navBtns[k].classList.remove('active');
  }
  refresh() {
    if (this.sheet) this.renderSheet(false);
    this.renderSide();
  }
  renderSheet(fresh) {
    const s = this.sheet;
    if (!s) return;
    const P = PANELS[s.name];
    const oldBody = this.sheetEl.querySelector('.sheet-body');
    const scroll = !fresh && oldBody ? oldBody.scrollTop : 0;
    const content = P.render(this, this.g, s.tab);
    const head = h('div.sheet-head', null,
      h('b.sheet-title', null, P.title),
      h('button.icon-btn.close', { onclick: () => this.closeSheet(), 'aria-label': 'Fermer', html: icon('close') }),
    );
    const tabs = P.tabs ? h('div.tabs', null, P.tabs.map(([id, label]) => h('button.tab', { cls: id === s.tab ? 'on' : '', onclick: () => { sfx('click'); s.tab = id; this.renderSheet(true); } }, label, P.tabDot && P.tabDot(this.g, id) ? h('i.dot') : null))) : null;
    const body = h('div.sheet-body', null, content);
    this.sheetEl.replaceChildren(head, tabs || '', body);
    this.sheetEl.hidden = false;
    if (fresh) { this.sheetEl.classList.remove('in'); void this.sheetEl.offsetWidth; }
    this.sheetEl.classList.add('in');
    body.scrollTop = scroll;
    this.tickTimers();
  }

  // ---------------------------------------------------------------- modales
  modal({ title, body, buttons = [], cls = '', rays = null, noClose = false, onClose }) {
    const close = () => {
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 180);
      onClose && onClose();
    };
    const box = h('div.modal', { cls }, h('div.modal-head', null, h('b', null, title), noClose ? null : h('button.icon-btn.close', { onclick: close, 'aria-label': 'Fermer', html: icon('close') })), h('div.modal-body', null, body));
    if (buttons.length) {
      box.append(h('div.modal-btns', null, buttons.map((b) => h('button.btn', { cls: b.cls || 'blue', disabled: b.disabled, onclick: () => { sfx('click'); const keep = b.fn && b.fn(); if (!keep) close(); } }, h('span', null, b.label), b.sub ? h('small', null, b.sub) : null))));
    }
    const wrap = h('div.modal-wrap', { onclick: (e) => { if (e.target === wrap && !noClose) close(); } }, rays ? h('div.rays', { style: { '--ray': rays } }) : null, box);
    this.modalRoot.append(wrap);
    return close;
  }
  closeAllModals() { this.modalRoot.innerHTML = ''; }

  rewardChip(r) {
    const k = r.k;
    if (k === 'skin') { const s = SKIN_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + s.r }, h('img', { src: this.snaps['skin_' + s.id] || '', alt: '' }), h('b', null, s.name), h('small', null, 'Costume')); }
    if (k === 'pet') { const p = PET_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + p.r }, h('img', { src: this.snaps['pet_' + p.id] || '', alt: '' }), h('b', null, p.name), h('small', null, RARITIES[p.r].name)); }
    if (k === 'skill') { const s = SKILL_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + s.r }, h('span.sk-ic', { html: icon('sk_' + s.id) }), h('b', null, s.name), h('small', null, RARITIES[s.r].name)); }
    const label = k === 'speedMin' ? fmtTime(r.v * 60) : fmt(r.v);
    return h('div.rchip', null, h('span', { html: icon(k) }), h('b', null, label), h('small', null, RES_LABEL[k] || k));
  }
  rewards(list, title = 'Récompenses !', opts = {}) {
    if (!list || !list.length) return;
    sfx(opts.big ? 'legendary' : 'buy');
    const body = h('div.rewards', null, list.map((r, i) => { const c = this.rewardChip(r); c.style.animationDelay = i * 0.06 + 's'; return c; }));
    this.modal({ title, body, buttons: [{ label: 'Super !', cls: 'green' }], rays: opts.big ? '#ffd23f' : '#ffffff', cls: 'reward-modal' });
  }

  toast(msg, kind = '') {
    const t = h('div.toast', { cls: kind }, msg);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2600);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  // pièces qui volent vers le compteur
  fly(type, x, y, n = 3) {
    const tgt = this.app.querySelector(`.res[data-res="${type}"]`) || this.app.querySelector('.res');
    if (!tgt) return;
    const rect = tgt.getBoundingClientRect();
    const base = this.app.getBoundingClientRect();
    const tx = rect.left - base.left + 14, ty = rect.top - base.top + 12;
    const sr = this.stageEl.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const el = h('i.flyc', { html: icon(type) });
      const sx = x + sr.left - base.left + (Math.random() - 0.5) * 40, sy = y + sr.top - base.top + (Math.random() - 0.5) * 30;
      el.style.transform = `translate(${sx}px, ${sy}px) scale(.6)`;
      this.flyLayer.append(el);
      const d = 450 + Math.random() * 250 + i * 60;
      el.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(.5)`, opacity: 0 },
        { transform: `translate(${sx + (Math.random() - 0.5) * 60}px, ${sy - 40 - Math.random() * 30}px) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${tx}px, ${ty}px) scale(.7)`, opacity: 1 },
      ], { duration: d, easing: 'cubic-bezier(.5,0,.75,0)' }).onfinish = () => { el.remove(); tgt.classList.remove('bump'); void tgt.offsetWidth; tgt.classList.add('bump'); };
    }
  }

  powerUp(delta) {
    if (delta <= 0) return;
    this.powerDelta.textContent = '+' + fmt(delta);
    this.powerDelta.classList.remove('show');
    void this.powerDelta.offsetWidth;
    this.powerDelta.classList.add('show');
  }

  banner(text, sub = '', cls = '') {
    const b = h('div.big-banner', { cls }, h('b', null, text), sub ? h('small', null, sub) : null);
    this.stageEl.append(b);
    setTimeout(() => b.remove(), 2000);
  }

  boxShake(r = 0) {
    const b = this.boxBtn;
    b.classList.remove('opening');
    void b.offsetWidth;
    b.classList.add('opening');
    b.style.setProperty('--burst', RARITIES[r].color);
  }

  // ---------------------------------------------------------------- fenêtres spéciales
  showIdle() {
    const g = this.g, st = g.st;
    const p = idlePending(st);
    const cap = idleCapH(st);
    const body = h('div.idle-pop', null,
      h('div.idle-hero', { html: icon('chest') }),
      h('p', null, `Vos chats ont patrouillé ${fmtTime(p.hours * 3600)} (max ${cap} h).`),
      h('div.rewards', null, this.rewardChip({ k: 'gold', v: p.gold }), this.rewardChip({ k: 'yarn', v: p.yarn })),
      h('p.muted', null, `Revenus : ${fmt(g.idleRate().gold)} or/h · ${fmt(g.idleRate().yarn)} pelotes/h`),
    );
    const buttons = [
      { label: 'Récolter', cls: 'green', disabled: p.gold <= 0, fn: () => g.claimIdle(1) },
      { label: 'x2 Vidéo', sub: 'Bonus', cls: 'purple', disabled: p.gold <= 0, fn: () => { g.watchAd(() => g.claimIdle(2)); } },
    ];
    this.modal({ title: 'Butin de patrouille', body, buttons });
  }

  showBoxUpgrade() {
    const g = this.g, st = g.st;
    const up = boxUpgradeInfo(st);
    const odds = boxOdds(st.box.lvl), next = boxOdds(Math.min(BOX_MAX_LEVEL, st.box.lvl + 1));
    const table = h('div.odds', null, RARITIES.map((r, i) => (odds[i] > 0 || next[i] > 0) ? h('div.orow', { style: { '--rc': r.color } }, h('i'), h('span', null, r.name), h('b', null, odds[i].toFixed(odds[i] < 1 ? 3 : 1) + '%'), up.max ? null : h('em', { cls: next[i] > odds[i] ? 'up' : next[i] < odds[i] ? 'down' : '' }, '→ ' + next[i].toFixed(next[i] < 1 ? 3 : 1) + '%')) : null));
    const body = h('div', null, h('p.center', null, `Carton magique niveau ${st.box.lvl}${up.max ? ' (MAX)' : ` → ${st.box.lvl + 1}`}`), table);
    const btns = [];
    if (!up.max) {
      if (!up.busy) btns.push({ label: 'Améliorer', sub: `${fmt(up.gold)} or · ${fmtTime(up.secs)}`, cls: st.res.gold >= up.gold ? 'gold' : 'gray', fn: () => { g.upgradeBox(); } });
      else if (up.left <= 0) btns.push({ label: 'Terminer', cls: 'green', fn: () => g.finishBox() });
      else {
        body.append(h('p.center.timer', null, 'Amélioration en cours : ', h('b', { dataset: { until: st.box.upUntil } }, fmtTime(up.left))));
        btns.push({ label: 'Accélérer', sub: `${fmtTime(st.res.speedMin * 60)} dispo`, cls: 'blue', disabled: st.res.speedMin < 1, fn: () => { g.useSpeedups(); } });
        btns.push({ label: 'Terminer', sub: `${g.skipCost()} gemmes`, cls: 'purple', fn: () => { g.skipBox(); } });
      }
    }
    this.modal({ title: 'Carton magique', body, buttons: btns });
  }

  showFlash() {
    const st = this.g.st;
    if (!st.iap.flash) return;
    this.g.showProduct(st.iap.flash.id, true);
  }

  tutorial(target, text) {
    if (!target) { this.handEl.hidden = true; return; }
    const r = target.getBoundingClientRect(), b = this.app.getBoundingClientRect();
    this.handEl.hidden = false;
    this.handEl.style.transform = `translate(${r.left - b.left + r.width / 2 - 20}px, ${r.top - b.top + r.height * 0.55}px)`;
    this.handEl.lastChild.textContent = text;
  }
}

// Carton en carton (SVG) : rabats animés via CSS
const BOX_SVG = `<svg viewBox="0 0 160 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bxF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8b06a"/><stop offset="1" stop-color="#b9783a"/></linearGradient>
    <linearGradient id="bxS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98d4f"/><stop offset="1" stop-color="#93582a"/></linearGradient>
    <linearGradient id="bxT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cf8e"/><stop offset="1" stop-color="#d9a061"/></linearGradient>
  </defs>
  <g class="bx-body">
    <path d="M22 58 L80 74 L80 132 L22 114 Z" fill="url(#bxS)" stroke="#5a3010" stroke-width="3" stroke-linejoin="round"/>
    <path d="M80 74 L138 58 L138 114 L80 132 Z" fill="url(#bxF)" stroke="#5a3010" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 58 L80 42 L138 58 L80 74 Z" fill="#3a1e08"/>
    <path d="M104 92 l4 -6 l4 6 m-8 6 h8" stroke="#7a4a1a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <g fill="#7a4a1a" opacity=".55"><ellipse cx="44" cy="96" rx="6" ry="5"/><circle cx="37" cy="88" r="2.6"/><circle cx="42" cy="85" r="2.6"/><circle cx="48" cy="86" r="2.6"/><circle cx="52" cy="90" r="2.6"/></g>
    <path d="M60 104 l40 -10" stroke="#e8c690" stroke-width="7" opacity=".7"/>
  </g>
  <g class="bx-ears"><path d="M58 52 l8 -20 l10 16 z" fill="#f39a3d" stroke="#5a2a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M86 47 l12 -18 l6 20 z" fill="#f39a3d" stroke="#5a2a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M62 48 l4 -10 l5 8z M90 45 l7 -9 l3 10z" fill="#ff9fb2"/></g>
  <path class="bx-flap l" d="M22 58 L80 42 L60 22 L4 38 Z" fill="url(#bxT)" stroke="#5a3010" stroke-width="3" stroke-linejoin="round"/>
  <path class="bx-flap r" d="M138 58 L80 42 L100 22 L156 38 Z" fill="url(#bxT)" stroke="#5a3010" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
