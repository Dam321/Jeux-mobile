// Interface : coque, HUD, modales, toasts, effets d'interface (v2)
import { h, fmt, fmtTime, fmtPct } from '../util.js';
import { icon, injectIconDefs } from './icons.js';
import { RARITIES, SLOTS, SUBSTATS, xpToNext, biomeForChapter, BOX_MAX_LEVEL, boxOdds } from '../config.js';
import { RES_BY_ID, SET_BY_ID, RELIC_BY_ID, KITTEN_BY_ID, ELEMENTS } from '../content.js';
import { ARTIFACT_BY_ID, AURA_BY_ID, TITLE_BY_ID, FRAME_BY_ID, towerFloorInfo } from '../content3.js';
import { monsterPortrait } from '../gfx/bestiary.js';
import { itemMain, itemPower, itemName, SKILL_BY_ID, COSTUME_BY_ID } from '../stats.js';
import { idlePending, idleCapH, boxUpgradeInfo, keepable, quickAfkCost, AFK_KILLS_H, QUICK_AFK_H } from '../economy.js';
import { itemIconURL } from '../gfx/gear.js';
import { catPortraitURL, catFullURL } from '../gfx/cat.js';
import { sfx } from '../audio.js';
import { PANELS } from './panels.js';
import { lazyImg, prewarm } from './lazy.js';
import { CLASS_BY_ID, canEquip, classesFor } from '../classes.js';
import { classReveal } from './classui.js';
import { weekEnd } from '../event.js';

export const RES_LABEL = {
  gold: 'Or', gems: 'Gemmes', yarn: 'Pelotes', feathers: 'Plumes', eggs: 'Paniers', arenaCoins: 'Médailles', warCoins: 'Écussons', speedMin: 'Accélérateur', xp: 'XP',
  stone: 'Pierre de protection', scroll: 'Parchemin de chance', clover: 'Trèfle (butin x2)', milk: 'Lait doré', relicKeys: 'Clés de relique',
  towerTokens: 'Jetons de défi', frags: 'Fragments d\'artefact', guildCoins: 'Écussons de guilde', fest: 'Lanternes de fête',
};
export function rarityName(r) { return RARITIES[r].name; }
export function slotName(id) { return SLOTS.find((s) => s.id === id).name; }

// icône d'une ressource (forme SVG teintée par la rareté)
export function resIcon(id) {
  const R = RES_BY_ID[id];
  if (!R) return icon(id);
  return `<i class="ic res-ic r${R.r}" style="color:${RARITIES[R.r].color}">${icon('r_' + R.icon).replace(/^<i class="ic ">|<\/i>$/g, '')}</i>`;
}

export class UI {
  constructor(game) {
    this.g = game;
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
    this.stageEl = h('div.stage');
    this.glEl = h('div.gl');
    this.stageEl.append(this.glEl);

    this.avatarImg = h('img.avatar-img', { alt: '' });
    this.lvlEl = h('b.lvl', null, '1');
    this.xpFill = h('i.xpfill');
    this.vipEl = h('button.vip-badge', { onclick: () => this.open('shop', 'vip'), 'aria-label': 'VIP' }, h('span', { html: icon('crown') }), h('b', null, 'VIP 0'));
    this.powerEl = h('b.pw-val', null, '0');
    this.powerDelta = h('span.pw-delta');
    this.boostEl = h('button.boost', { hidden: true, onclick: () => this.open('shop', 'offers') }, h('span', { html: icon('clover') }), h('small'));
    const hud = h('div.hud', null,
      h('div.hud-row', null,
        h('button.avatar', { onclick: () => this.open('hero', 'look'), 'aria-label': 'Personnaliser' }, this.avatarImg, this.lvlEl, h('div.xpbar', null, this.xpFill)),
        h('div.hud-mid', null, h('div.power', null, h('span', { html: icon('power') }), this.powerEl, this.powerDelta), this.vipEl, this.boostEl),
        h('button.icon-btn.settings', { onclick: () => this.open('settings'), 'aria-label': 'Paramètres', html: icon('settings') }),
      ),
      h('div.res-row', null, ['gold', 'gems', 'yarn'].map((k) => {
        const v = h('b', null, '0');
        this.hudCache['res_' + k] = { el: v, v: -1 };
        return h('button.res', { onclick: () => (k === 'gold' ? this.open('market', 'change') : this.open('shop', k === 'gems' ? 'gems' : 'offers')), dataset: { res: k } }, h('span', { html: icon(k) }), v, h('i.plus', null, '+'));
      })),
    );
    this.stageInfo = h('div.stage-info', null, h('b.stage-name'), h('span.stage-biome'), h('div.waves'));
    this.strip = h('div.strip');
    this.bossBar = h('div.boss-bar', { hidden: true }, h('b.bname'), h('div.btrack', null, h('i.bfill2'), h('i.bfill')), h('span.bhp'));
    this.modeBanner = h('div.mode-banner', { hidden: true }, h('b'), h('button.btn.sm.red', { onclick: () => g.leaveSpecial() }, 'Quitter'));
    this.lootFeed = h('div.loot-feed');
    this.skillRow = h('div.skill-row');
    this.speedBtn = h('button.ctrl.speed', { onclick: () => g.cycleSpeed() }, 'x1');
    this.challengeBtn = h('button.ctrl.challenge', { onclick: () => g.challenge() }, 'DÉFIER');
    this.autoChBtn = h('button.ctrl.autoch', { onclick: () => g.toggleAutoChallenge() }, 'AUTO');
    this.idleBtn = h('button.idle-chest', { onclick: () => this.showIdle(), 'aria-label': 'Récompenses AFK' }, h('span', { html: icon('chest') }), h('i.idle-fill'), h('em.idle-lbl', null, 'AFK'), h('b.idle-t'));
    const ctrls = h('div.ctrls', null, this.idleBtn, this.skillRow, h('div.ctrl-r', null, this.challengeBtn, this.autoChBtn, this.speedBtn));
    this.cutinEl = h('div.cutin', { hidden: true });
    this.bossCard = h('div.boss-card', { hidden: true });
    this.tutoEl = h('div.tuto', { hidden: true }, h('i.tuto-ring'), h('b.tuto-txt'));
    // v3 : tout ce qui s'affiche en combat s'empile dans le HUD (plus rien ne masque les combattants)
    hud.append(this.strip, this.modeBanner, this.stageInfo, this.bossBar, this.lootFeed);
    this.stageEl.append(hud, ctrls, this.cutinEl, this.bossCard);

    this.home = h('div.home');
    this.gearL = h('div.gear-col');
    this.gearR = h('div.gear-col');
    this.boxArea = this.buildBox();
    this.home.append(h('div.home-main', null, this.gearL, this.boxArea, this.gearR));

    this.nav = h('nav.nav');
    const tabs = [['hero', 'Héros'], ['kittens', 'Chatons'], ['atelier', 'Atelier'], ['combat', 'Combat'], ['market', 'Marché'], ['shop', 'Boutique']];
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
    app.append(this.stageEl, this.home, this.sheetEl, this.nav, this.modalRoot, this.toasts, this.flyLayer, this.tutoEl);
  }

  buildBox() {
    const g = this.g;
    this.boxLvl = h('b.box-lvl', null, 'Nv 1');
    this.boxUpBtn = h('button.box-up', { onclick: () => this.showBoxUpgrade() }, h('span', { html: icon('hammer') }), h('b.box-up-t', null, 'Améliorer'));
    this.batchBtn = h('button.box-side.batch', { onclick: () => g.cycleBatch() }, h('small', null, 'Quantité'), h('b', null, 'x1'));
    this.autoBtn = h('button.box-side.auto', { onclick: () => g.toggleAutoBox() }, h('small', null, 'Auto'), h('b', null, 'OFF'));
    this.yarnCount = h('b.yarn-count', null, '0');
    this.boxBtn = h('button.box-btn', { 'aria-label': 'Ouvrir le carton', onclick: () => g.openBoxClick() },
      h('div.box-glow'), h('div.box-svg', { html: BOX_SVG }), h('div.box-yarn', null, h('span', { html: icon('yarn') }), this.yarnCount));
    return h('div.box-area', null, this.boxBtn, h('div.box-meta', null, this.batchBtn, h('div.box-lvlwrap', null, this.boxLvl, this.boxUpBtn), this.autoBtn));
  }

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
    const target = S.power;
    if (this.shownPower == null) this.shownPower = target;
    if (Math.abs(this.shownPower - target) > target * 0.001) this.shownPower += (target - this.shownPower) * 0.2; else this.shownPower = target;
    this.setText('pw', this.powerEl, fmt(this.shownPower));
    const boostLeft = (st.boost.cloverUntil - Date.now()) / 1000;
    this.boostEl.hidden = boostLeft <= 0;
    if (boostLeft > 0) this.setText('boost', this.boostEl.lastChild, fmtTime(boostLeft));
    this.setText('yarn', this.yarnCount, fmt(st.res.yarn));
    this.setText('boxlvl', this.boxLvl, 'Nv ' + st.box.lvl);
    const up = boxUpgradeInfo(st);
    this.setText('boxup', this.boxUpBtn.lastChild, up.max ? 'MAX' : up.busy ? (up.left > 0 ? fmtTime(up.left) : 'Terminé !') : 'Améliorer');
    this.boxUpBtn.classList.toggle('ready', !up.max && !up.busy && st.res.gold >= up.gold);
    this.boxUpBtn.classList.toggle('busy', !!up.busy);
    this.boxUpBtn.classList.toggle('done', !!up.busy && up.left <= 0);
    this.boxBtn.classList.toggle('empty', st.res.yarn <= 0);
    this.boxArea.dataset.tier = Math.min(8, Math.floor((st.box.lvl - 1) / 4));
    this.setText('batch', this.batchBtn.lastChild, 'x' + g.batchSize());
    this.setText('auto', this.autoBtn.lastChild, g.autoBox ? 'ON' : 'OFF');
    this.autoBtn.classList.toggle('on', g.autoBox);
    this.autoBtn.classList.toggle('locked', !g.autoUnlocked());
    const idle = idlePending(st, S);
    const cap = idleCapH(st);
    this.idleBtn.querySelector('.idle-fill').style.transform = `scaleY(${Math.min(1, idle.hours / cap)})`;
    this.setText('idle', this.idleBtn.querySelector('.idle-t'), idle.hours >= cap ? 'PLEIN' : fmtTime(idle.hours * 3600));
    this.idleBtn.classList.toggle('full', idle.hours >= 1);
    this.setText('speed', this.speedBtn, 'x' + g.battle.speed);
    const sp = g.special;
    this.challengeBtn.hidden = !!sp || st.camp.auto;
    this.autoChBtn.hidden = !!sp;
    this.autoChBtn.classList.toggle('on', st.camp.auto);
    this.setText('chal', this.challengeBtn, g.nextIsBoss() ? 'DÉFIER LE BOSS' : 'DÉFIER');
    this.placeTuto();
  }
  updateStageInfo() {
    const g = this.g, st = g.st;
    const sp = g.special;
    const name = this.stageInfo.querySelector('.stage-name');
    const bio = this.stageInfo.querySelector('.stage-biome');
    if (sp) { name.textContent = sp.title; bio.textContent = sp.sub || ''; }
    else { const er = g.era(); name.textContent = `${st.camp.ch}-${st.camp.st}`; bio.textContent = biomeForChapter(st.camp.ch).name + (er.e ? ' · ' + er.name : '') + (st.camp.auto ? '' : ' · Farm'); }
    const w = this.stageInfo.querySelector('.waves');
    const n = g.battle.enc && g.battle.enc.waves ? g.battle.enc.waves.length : 0;
    const key = n + ':' + g.battle.wave;
    if (w.dataset.k !== key) {
      w.dataset.k = key; w.innerHTML = '';
      for (let i = 0; i < n; i++) w.append(h('i', { cls: i < g.battle.wave ? 'done' : i === g.battle.wave ? 'cur' : '' }));
    }
    this.modeBanner.hidden = !sp;
    if (sp) { const E = g.battle.enc; const left = E && E.timeLimit ? ` · ⏱ ${Math.max(0, Math.ceil(E.timeLimit - (E.elapsed || 0)))} s` : ''; this.modeBanner.firstChild.textContent = (sp.banner || sp.title) + left; }
  }
  renderGear() {
    const st = this.g.st;
    this.gearL.innerHTML = ''; this.gearR.innerHTML = '';
    SLOTS.forEach((s, i) => {
      const it = st.gear[s.id];
      const el = it ? this.itemIcon(it) : h('div.item-ic.empty', null, h('small', null, s.name));
      const b = h('button.gear-slot', { onclick: () => (it ? this.showItem(it) : this.open('hero', 'gear')), 'aria-label': s.name }, el);
      (i < 5 ? this.gearL : this.gearR).append(b);
    });
    this.avatarImg.src = this.g.portrait();
    this.avatarImg.parentNode.dataset.frame = this.g.st.cos.frame || 'basic';
  }
  renderSkillRow() {
    const b = this.g.battle;
    this.skillRow.innerHTML = '';
    this.skillCds = [];
    const skills = (b.hero && b.hero.skills) || (b.playerDef && b.playerDef.skills) || [];
    for (const sk of skills) {
      const cd = h('i.cd');
      this.skillCds.push(cd);
      this.skillRow.append(h('div.sk-mini', { cls: 'r' + sk.r, html: icon('sk_' + sk.id) }, cd));
    }
  }
  updateSkillCds() {
    const H = this.g.battle.hero;
    if (!this.skillCds || !H) return;
    for (let i = 0; i < this.skillCds.length; i++) {
      const sk = H.skills[i];
      if (!sk) continue;
      this.skillCds[i].style.transform = `scaleY(${Math.max(0, Math.min(1, H.cds[i] / sk.cd))})`;
    }
  }
  pulseSkill(i) {
    const el = this.skillRow.children[i];
    if (!el) return;
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  }
  renderSide() {
    const g = this.g, st = g.st;
    const items = [];
    const btn = (ic, label, fn, o = {}) => h('button.strip-btn', { onclick: fn, cls: o.cls || '' }, h('span', { html: ic.startsWith('<') ? ic : icon(ic) }), h('b', null, label), o.dot ? h('i.dot') : null, o.timer ? h('small', { dataset: { until: o.timer } }) : null);
    items.push(btn('quest', 'Quêtes', () => this.open('quests'), { dot: g.questsClaimable() }));
    items.push(btn('tower', 'Tour', () => this.open('combat', 'tower'), { dot: st.tower.floor <= 3 }));
    items.push(btn('guild', 'Guilde', () => this.open('guild'), { dot: g.guildDot(), cls: st.guild.id ? '' : 'glow' }));
    items.push(btn('fest', 'Festival', () => this.open('event'), { dot: g.eventDot(), cls: 'glow-o', timer: weekEnd() }));
    items.push(btn('bestiary', 'Bestiaire', () => this.open('bestiary'), { dot: g.bestiaryPending().length > 0 }));
    if (st.iap.firstRecharge !== 2) items.push(btn('gift', st.iap.firstRecharge ? 'Réclamer' : '1er achat', () => this.open('firstRecharge'), { cls: 'glow', dot: st.iap.firstRecharge === 1 }));
    if (st.iap.flash && st.iap.flash.until > Date.now()) items.push(btn('flash', 'Flash', () => g.showProduct(st.iap.flash.id, true), { cls: 'glow-o', timer: st.iap.flash.until }));
    items.push(btn('pass', 'Passe', () => this.open('shop', 'pass'), { dot: g.passClaimable() }));
    items.push(btn('rel', 'Reliques', () => this.open('shop', 'relics'), { cls: 'glow-r' }));
    items.push(btn('crown', 'Fidélité', () => this.open('shop', 'loyalty'), { dot: g.loyaltyClaimable() }));
    items.push(btn('tv', 'Bonus', () => this.open('ads'), { dot: st.daily.ads < g.adLimit() }));
    this.strip.replaceChildren(...items);
    const dot = (id, on) => { this.navBtns[id].querySelector('.dot').hidden = !on; };
    dot('hero', st.res.feathers >= 1 || g.anyLevelUp('skills') || g.trainAffordable());
    dot('kittens', st.res.eggs >= 1 || g.anyLevelUp('kittens'));
    dot('atelier', g.atelierDot());
    dot('combat', g.combatDot());
    dot('market', g.marketDot());
    dot('shop', !st.daily.freeGift || g.vipGiftClaimable() || g.fundClaimable());
  }
  tickTimers() {
    const now = Date.now();
    for (const el of this.app.querySelectorAll('[data-until]')) {
      const left = (+el.dataset.until - now) / 1000;
      el.textContent = left > 0 ? fmtTime(left) : '—';
    }
  }

  // ---------------------------------------------------------------- images différées
  kittenImg(id, cls = '') { return lazyImg('k:' + id, () => this.g.kittenURL(id), cls); }
  costumeImg(id, cls = '') { return lazyImg('c:' + id + ':' + this.g.lookKey(), () => this.g.costumeURL(id), cls); }
  itemImg(slot, base, r, cls = '') { return lazyImg(`i:${slot}|${base}|${r}`, () => itemIconURL(slot, base, r), cls); }
  monsterImg(kind, variant = 0, cls = '') { return lazyImg(`m:${kind}:${variant}`, () => monsterPortrait(kind, variant), cls); }
  lookImg(look, size, cls = '') { return lazyImg('p:' + size + JSON.stringify(look), () => catPortraitURL(look, {}, size), cls); }
  // remplit le cache en arrière-plan : chatons, costumes, pièces de panoplie, boss
  prewarmImages() {
    const g = this.g, st = g.st;
    // seulement ce que le joueur possède : le reste se dessine à la demande
    for (const id of st.kittens.equipped) if (id) prewarm('k:' + id, () => g.kittenURL(id));
    for (const id of Object.keys(st.kittens.owned)) prewarm('k:' + id, () => g.kittenURL(id));
    for (const id of st.costumes.owned) prewarm('c:' + id + ':' + g.lookKey(), () => g.costumeURL(id));
  }

  // ---------------------------------------------------------------- objets
  itemIcon(it, extra = '') {
    const r = RARITIES[it.r];
    return h('div.item-ic', { cls: 'r' + it.r + ' ' + extra + (it.relic ? ' relic' : '') + (it.set ? ' set' : '') + (canEquip(this.g.st.hero.cls, it) ? '' : ' nocls'), style: { '--rc': r.color, '--rd': r.dark } },
      this.itemImg(it.slot, it.base, it.r, 'ic-img'),
      h('b.ilvl', null, 'Nv ' + (it.relic ? Math.max(it.l, this.g.st.hero.lvl) : it.l)),
      it.upg ? h('i.iupg', null, '+' + it.upg) : null,
      it.set ? h('i.iset', { style: { background: SET_BY_ID[it.set].color } }) : null,
    );
  }
  itemStats(it) {
    const m = itemMain(it, this.g.st.hero.lvl);
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
    const extra = [];
    if (it.relic) extra.push(h('p.relic-desc', null, '★ ' + RELIC_BY_ID[it.relic].desc));
    if (it.set) extra.push(h('p.set-desc', { style: { color: SET_BY_ID[it.set].color } }, SET_BY_ID[it.set].name + ` · jet ${Math.round(it.q * 100)}%`));
    return h('div.icard', { cls: 'r' + it.r, style: { '--rc': r.color, '--rd': r.dark } },
      label ? h('small.ilabel', null, label) : null,
      h('div.icard-top', null, this.itemIcon(it), h('div.grow', null, h('b.iname', null, itemName(it)), h('span.irar', null, r.name + ' · ' + slotName(it.slot) + (it.upg ? ` · +${it.upg}` : '')), h('span.ipow', { html: icon('power') + fmt(itemPower(it, this.g.st.hero.lvl)) }))),
      this.itemStats(it), extra,
    );
  }
  // Fenêtre d'objet. Nouveau → comparaison + Équiper/Recycler/Briser. Équipé/sac → Forger/Équiper/Briser.
  showItem(it, onDone, isNew) {
    const g = this.g, st = g.st;
    const cur = st.gear[it.slot];
    const equipped = cur && cur.id === it.id;
    const inBag = st.bag.some((x) => x.id === it.id);
    const body = h('div.compare');
    if (!equipped && cur) body.append(this.itemCard(cur, 'Équipé'));
    body.append(this.itemCard(it, isNew ? 'Nouveau' : equipped ? 'Équipé' : inBag ? 'Sac' : ''));
    if (!equipped && cur) {
      const d = itemPower(it, st.hero.lvl) - itemPower(cur, st.hero.lvl);
      body.append(h('div.pdiff', { cls: d >= 0 ? 'up' : 'down' }, (d >= 0 ? '▲ +' : '▼ ') + fmt(Math.abs(d)) + ' puissance'));
    }
    // armes et armures : classes autorisées
    const okCls = canEquip(st.hero.cls, it);
    const who = classesFor(it);
    if (who) body.append(h('div.cls-req', { cls: okCls ? 'ok' : 'ko' }, okCls ? '✔ ' : '✖ ', 'Réservé : ' + who.map((c) => `${c.name} (${c.role})`).join(', ')));
    const btns = [];
    const done = () => { onDone && onDone(); };
    const equipBtn = okCls ? { label: 'Équiper', cls: 'green', fn: () => { g.equip(it); done(); } } : { label: 'Autre classe', cls: 'gray', disabled: true };
    if (isNew) {
      btns.push({ label: 'Recycler', sub: '+' + fmt(g.recycleValue(it)) + ' or', cls: 'red', fn: () => { g.recycle(it); done(); } });
      btns.push({ label: 'Briser', sub: '+' + g.breakValue(it) + ' runes', cls: 'purple', fn: () => { g.breakNew(it); done(); } });
      btns.push(equipBtn);
    } else if (equipped) {
      btns.push({ label: 'Forgemagie', cls: 'purple', fn: () => { this.open('atelier', 'forge'); g.forgeTarget = it.id; this.refresh(); } });
      btns.push({ label: 'Fermer', cls: 'blue' });
    } else {
      if (!it.relic) btns.push({ label: 'Briser', sub: '+' + g.breakValue(it) + ' runes', cls: 'red', fn: () => { g.breakBagItem(it); done(); } });
      btns.push({ label: 'Forger', cls: 'purple', fn: () => { this.open('atelier', 'forge'); g.forgeTarget = it.id; this.refresh(); } });
      btns.push(equipBtn);
    }
    this.modal({ title: isNew ? 'Le carton contenait…' : slotName(it.slot), body, buttons: btns, cls: 'r' + it.r + (it.r >= 4 ? ' legendary' : ''), rays: it.r >= 4 ? RARITIES[it.r].color : null, noClose: isNew });
  }

  // ---------------------------------------------------------------- feuilles
  open(name, tab) {
    sfx('click');
    const P = PANELS[name];
    if (!P) return;
    const T = P.tabsFor ? P.tabsFor(this.g) : P.tabs;
    this.sheet = { name, tab: tab || (T ? T[0][0] : null) };
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
  refresh() { if (this.sheet) this.renderSheet(false); this.renderSide(); }
  renderSheet(fresh) {
    const s = this.sheet;
    if (!s) return;
    const P = PANELS[s.name];
    const oldBody = this.sheetEl.querySelector('.sheet-body');
    const scroll = !fresh && oldBody ? oldBody.scrollTop : 0;
    const T = P.tabsFor ? P.tabsFor(this.g) : P.tabs;
    if (T && !T.some(([id]) => id === s.tab)) s.tab = T[0][0];
    const content = P.render(this, this.g, s.tab);
    const head = h('div.sheet-head', null, h('b.sheet-title', null, P.title), h('button.icon-btn.close', { onclick: () => this.closeSheet(), 'aria-label': 'Fermer', html: icon('close') }));
    const tabs = T ? h('div.tabs', null, T.map(([id, label]) => h('button.tab', { cls: id === s.tab ? 'on' : '', onclick: () => { sfx('click'); s.tab = id; this.renderSheet(true); } }, label, P.tabDot && P.tabDot(this.g, id) ? h('i.dot') : null))) : null;
    const body = h('div.sheet-body', null, content);
    this.sheetEl.replaceChildren(head, tabs || '', body);
    this.sheetEl.hidden = false;
    if (fresh) { this.sheetEl.classList.remove('in'); void this.sheetEl.offsetWidth; }
    this.sheetEl.classList.add('in');
    body.scrollTop = scroll;
    this.tickTimers();
    if (P.after) P.after(this, this.g, s.tab, body);
  }

  // ---------------------------------------------------------------- modales
  modal({ title, body, buttons = [], cls = '', rays = null, noClose = false, onClose }) {
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); onClose && onClose(); };
    const box = h('div.modal', { cls }, h('div.modal-head', null, h('b', null, title), noClose ? null : h('button.icon-btn.close', { onclick: close, 'aria-label': 'Fermer', html: icon('close') })), h('div.modal-body', null, body));
    if (buttons.length) box.append(h('div.modal-btns', null, buttons.map((b) => h('button.btn', { cls: b.cls || 'blue', disabled: b.disabled, onclick: () => { sfx('click'); const keep = b.fn && b.fn(); if (!keep) close(); } }, h('span', null, b.label), b.sub ? h('small', { html: b.sub }) : null))));
    const wrap = h('div.modal-wrap', { onclick: (e) => { if (e.target === wrap && !noClose) close(); } }, rays ? h('div.rays', { style: { '--ray': rays } }) : null, box);
    this.modalRoot.append(wrap);
    return close;
  }
  closeAllModals() { this.modalRoot.innerHTML = ''; }

  rewardChip(r) {
    const k = r.k;
    if (k === 'costume') { const c = COSTUME_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + c.r }, this.costumeImg(c.id), h('b', null, c.name), h('small', null, 'Costume')); }
    if (k === 'kitten') { const kk = KITTEN_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + kk.r }, this.kittenImg(kk.id), h('b', null, kk.name), h('small', null, RARITIES[kk.r].name)); }
    if (k === 'skill') { const s = SKILL_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + s.r }, h('span.sk-ic', { html: icon('sk_' + s.id) }), h('b', null, s.name), h('small', null, RARITIES[s.r].name)); }
    if (k === 'relic') { const R = RELIC_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r8' }, this.itemImg(R.slot, R.base, 8), h('b', null, R.name), h('small', null, 'Relique')); }
    if (k === 'look') return h('div.rchip.big', { cls: 'r8' }, h('img', { src: catPortraitURL({ fur: 'galaxie', pattern: 'galaxy', eye: 'galaxie' }, {}, 96), alt: '' }), h('b', null, 'Pelage Galaxie'), h('small', null, 'Apparence'));
    if (k.startsWith('frag:')) { const A = ARTIFACT_BY_ID[k.slice(5)]; return h('div.rchip', { cls: 'r' + A.r }, h('span', { html: this.artIcon(A) }), h('b', null, 'x' + r.v), h('small', null, A.name)); }
    if (k === 'aura') { const A = AURA_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + A.r }, h('span.aura-prev', { style: { '--a1': A.colors[0], '--a2': A.colors[1] || A.colors[0] } }), h('b', null, A.name), h('small', null, 'Aura')); }
    if (k === 'title') { const T = TITLE_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + T.r }, h('b.title-tag', { cls: 'r' + T.r }, T.name), h('small', null, 'Titre')); }
    if (k === 'frame') { const F = FRAME_BY_ID[r.v]; return h('div.rchip.big', { cls: 'r' + F.r }, h('span.frame-prev', { dataset: { frame: F.id } }, h('img', { src: this.g.portrait(), alt: '' })), h('b', null, F.name), h('small', null, 'Cadre')); }
    if (k === 'frags') return h('div.rchip', { cls: 'r5' }, h('span', { html: icon('rel') }), h('b', null, fmt(r.v)), h('small', null, 'Fragments'));
    const R = RES_BY_ID[k];
    if (R) return h('div.rchip', { cls: 'r' + R.r }, h('span', { html: resIcon(k) }), h('b', null, fmt(r.v)), h('small', null, R.name));
    const label = k === 'speedMin' ? fmtTime(r.v * 60) : fmt(r.v);
    return h('div.rchip', null, h('span', { html: icon(k) }), h('b', null, label), h('small', null, RES_LABEL[k] || k));
  }
  rewardText(r) {
    const k = r.k;
    if (k.startsWith('frag:')) return `${r.v} × ${ARTIFACT_BY_ID[k.slice(5)].name}`;
    if (RES_BY_ID[k]) return `${fmt(r.v)} ${RES_BY_ID[k].name}`;
    if (k === 'aura') return 'Aura ' + AURA_BY_ID[r.v].name;
    if (k === 'title') return 'Titre ' + TITLE_BY_ID[r.v].name;
    return `${fmt(r.v)} ${(RES_LABEL[k] || k).toLowerCase()}`;
  }
  artIcon(A) {
    return `<i class="ic res-ic art-ic r${A.r}" style="color:${A.color}">${icon('r_' + A.shape).replace(/^<i class="ic ">|<\/i>$/g, '')}</i>`;
  }
  bossIntro(b, variant) {
    const el = this.bossCard;
    el.innerHTML = '';
    el.append(this.monsterImg(b.bossKind || b.kind, variant), h('div', null, h('small', null, { tower: 'GARDIEN DE LA TOUR', lair: 'REPAIRE DE BOSS', dungeon: 'GARDIEN DU DONJON', worldboss: 'TITAN DU JOUR' }[this.g.battle.mode] || 'BOSS DE LA MAP'), h('b', null, b.name), h('em', null, '★★★ Danger')));
    el.hidden = false;
    el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
    clearTimeout(this.bossT);
    this.bossT = setTimeout(() => { el.hidden = true; }, 2200);
  }
  rewards(list, title = 'Récompenses !', opts = {}) {
    if (!list || !list.length) return;
    sfx(opts.big ? 'legendary' : 'buy');
    const body = h('div.rewards', null, list.map((r, i) => { const c = this.rewardChip(r); c.style.animationDelay = i * 0.06 + 's'; return c; }));
    this.modal({ title, body, buttons: [{ label: 'Super !', cls: 'green' }], rays: opts.big ? '#ffd23f' : '#ffffff', cls: 'reward-modal' });
  }
  toast(msg, kind = '') {
    // pas de doublons empilés (ex. plusieurs butins identiques d'affilée)
    for (const o of this.toasts.children) if (o.textContent === msg && !o.classList.contains('out')) return;
    const t = h('div.toast', { cls: kind }, msg);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2600);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }
  loot(drops) {
    for (const id in drops) {
      const R = RES_BY_ID[id];
      const row = h('div.loot', { cls: 'r' + R.r, title: R.name }, h('span', { html: resIcon(id) }), h('b', null, '+' + drops[id]), R.r >= 3 ? h('small', null, R.name) : null);
      this.lootFeed.prepend(row);
      if (R.r >= 4) { row.classList.add('rare'); sfx(R.r >= 5 ? 'legendary' : 'epic'); if (R.r >= 5) this.toast(`Butin ${RARITIES[R.r].name} : ${R.name} !`, 'gold'); }
      setTimeout(() => row.classList.add('out'), 2600);
      setTimeout(() => row.remove(), 3000);
    }
    while (this.lootFeed.children.length > 4) this.lootFeed.lastChild.remove();
  }
  fly(type, x, y, n = 3) {
    const tgt = this.app.querySelector(`.res[data-res="${type}"]`) || this.app.querySelector('.res');
    if (!tgt) return;
    const rect = tgt.getBoundingClientRect();
    const base = this.app.getBoundingClientRect();
    const sr = this.stageEl.getBoundingClientRect();
    const tx = rect.left - base.left + 14, ty = rect.top - base.top + 12;
    for (let i = 0; i < n; i++) {
      const el = h('i.flyc', { html: icon(type) });
      const sx = x + sr.left - base.left + (Math.random() - 0.5) * 40, sy = y + sr.top - base.top + (Math.random() - 0.5) * 30;
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
    this.powerDelta.classList.remove('show'); void this.powerDelta.offsetWidth; this.powerDelta.classList.add('show');
  }
  banner(text, sub = '', cls = '') {
    const b = h('div.big-banner', { cls }, h('b', null, text), sub ? h('small', null, sub) : null);
    this.stageEl.append(b);
    setTimeout(() => b.remove(), 2000);
  }
  classReveal(C) { classReveal(this, this.g, C); }
  // bandeau du coup final de classe (couleur de la classe)
  classCutin(M) {
    const C = CLASS_BY_ID[M.cls];
    if (!C) return;
    const el = this.cutinEl;
    el.hidden = false;
    el.className = 'cutin cls';
    el.style.setProperty('--rc', C.color);
    el.innerHTML = '';
    el.append(h('img', { src: this.g.portrait(), alt: '' }), h('div', null, h('small', null, `${C.name} · ${C.role}`), h('b', null, M.ult.name)));
    void el.offsetWidth;
    el.classList.add('play');
    clearTimeout(this.cutT);
    this.cutT = setTimeout(() => { el.hidden = true; el.style.removeProperty('--rc'); }, 1100);
  }
  // cinématique de pouvoir (portrait + nom qui balaie l'écran)
  cutin(sk) {
    const el = this.cutinEl;
    el.hidden = false;
    el.className = 'cutin r' + sk.r;
    el.innerHTML = '';
    el.append(h('img', { src: this.g.portrait(), alt: '' }), h('div', null, h('small', null, RARITIES[sk.r].name), h('b', null, sk.name)));
    void el.offsetWidth;
    el.classList.add('play');
    clearTimeout(this.cutT);
    this.cutT = setTimeout(() => { el.hidden = true; }, 1100);
  }
  // suspense : le carton tremble et brille à la couleur de la rareté qui arrive
  boxCharge(r) {
    const b = this.boxBtn;
    b.style.setProperty('--burst', RARITIES[r].color);
    b.classList.remove('charge'); void b.offsetWidth; b.classList.add('charge');
    setTimeout(() => b.classList.remove('charge'), 820);
  }
  // gerbe d'ouverture : particules à la couleur de la rareté ; Légendaire+ : rayons, faisceau, flash, secousse, tampon
  boxFx(r, relic = false) {
    const R = RARITIES[r], col = R.color;
    const layer = h('div.box-fx', { style: { '--c': col } });
    this.boxBtn.append(layer);
    const big = r >= 4 || relic;
    const n = r >= 6 ? 44 : big ? 34 : r >= 2 ? 20 : 12;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.05 + Math.random() * 0.9) + (Math.random() < 0.2 ? Math.PI : 0);
      const d = 45 + Math.random() * (big ? 150 : 80);
      layer.append(h('i.bp', { cls: Math.random() < 0.45 ? 'star' : '', style: { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d - 15 + 'px', '--rot': Math.random() * 720 - 360 + 'deg', '--d': 0.45 + Math.random() * 0.5 + 's', '--c': i % 3 === 0 ? '#ffffff' : col } }));
    }
    for (let i = 0; i < 5; i++) { const a = Math.PI * (Math.random() < 0.5 ? 0.05 : 0.95) + (Math.random() - 0.5) * 0.4; layer.append(h('i.bp.dust', { style: { '--dx': Math.cos(a) * 60 + 'px', '--dy': -10 + 'px', '--d': '.6s' } })); }
    layer.append(h('i.box-ring'));
    if (r >= 3) layer.append(h('i.box-ring', { style: { animationDelay: '.12s' } }));
    if (big) {
      layer.append(h('i.box-rays'), h('i.box-beam'));
      const fl = h('div.screen-flash', { style: { '--c': col } });
      const stamp = h('div.rar-stamp', { style: { '--c': col } }, relic ? 'RELIQUE !' : R.name.toUpperCase() + ' !', h('small', null, relic ? '1 chance sur 200 000' : r >= 6 ? 'INCROYABLE' : 'SUPERBE'));
      this.app.append(fl, stamp);
      this.app.classList.remove('quake'); void this.app.offsetWidth; this.app.classList.add('quake');
      setTimeout(() => { fl.remove(); stamp.remove(); this.app.classList.remove('quake'); }, 1350);
    }
    setTimeout(() => layer.remove(), 1500);
  }
  boxShake(r = 0) {
    const b = this.boxBtn;
    b.classList.remove('opening'); void b.offsetWidth; b.classList.add('opening');
    b.style.setProperty('--burst', RARITIES[r].color);
  }

  // ---------------------------------------------------------------- fenêtres spéciales
  showIdle() {
    const g = this.g, st = g.st;
    const p = idlePending(st, g.stats);
    const cap = idleCapH(st);
    const rate = g.idleRate();
    const left = g.quickAfkLeft(), qn = st.daily.quickAfk || 0, qcost = quickAfkCost(qn);
    const kills = Math.min(800, Math.floor(p.hours * AFK_KILLS_H));
    const body = h('div.idle-pop', null,
      h('div.afk-bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, p.hours / cap)})` } }), h('b', null, `${fmtTime(p.hours * 3600)} / ${cap} h`)),
      h('p', null, p.hours >= cap ? 'Coffre AFK plein : récoltez-le pour que vos chats repartent en patrouille !' : 'Vos chats combattent même quand vous n\'êtes pas là.'),
      h('div.rewards', null, this.rewardChip({ k: 'gold', v: p.gold }), this.rewardChip({ k: 'yarn', v: p.yarn }), this.rewardChip({ k: 'xp', v: Math.floor(p.hours * (15 + st.hero.lvl * 0.6)) })),
      h('p.small.muted', null, `+ le butin d'environ ${kills} ennemis de votre map · ${fmt(rate.gold)} or/h · plafond ${cap} h (plus avec le VIP)`),
      h('div.afk-quick', null,
        h('div.grow', null, h('b', null, `Patrouille éclair : ${QUICK_AFK_H} h de butin tout de suite`), h('small.muted', null, `${left} restante(s) aujourd'hui`)),
        h('button.btn.sm', { cls: left > 0 ? (qcost ? 'purple' : 'gold') : 'gray', disabled: left <= 0, onclick: () => { g.quickAfk(); } }, h('span', null, qcost ? 'Lancer' : 'Gratuit'), qcost ? h('small', { html: icon('gems') + ' ' + qcost }) : null)),
      h('button.btn.blue.wide', { onclick: () => g.startAfkMode() }, h('span', null, 'Mode AFK (écran économie d\'énergie)'), h('small', null, `Vos chats progressent seuls · ${Math.round(g.afkSessionMax() / 3600)} h max par session`)),
    );
    this.modal({ title: 'Récompenses AFK', body, buttons: [
      { label: 'Récolter', cls: 'green', disabled: p.gold <= 0, fn: () => g.claimIdle(1) },
      { label: 'x2 Vidéo', sub: 'Or et pelotes', cls: 'purple', disabled: p.gold <= 0, fn: () => { g.watchAd(() => g.claimIdle(2)); } },
    ] });
  }
  // écran du mode AFK
  afkOverlay(on) {
    if (!on) { if (this.afkEl) { this.afkEl.remove(); this.afkEl = null; } return; }
    this.afkEl = h('div.afk-mode', { onclick: () => this.g.stopAfkMode(false) },
      h('div.afk-card', null, h('small', null, 'MODE AFK'), h('b.afk-time', null, '0:00'), h('div.afk-stats'), h('p.small', null, 'Vos chats combattent et progressent seuls. Touchez l\'écran pour revenir.'), h('div.afk-limit')));
    this.app.append(this.afkEl);
  }
  afkTick(a, g) {
    if (!this.afkEl || (a.frame % 15)) return;
    const el = this.afkEl;
    el.querySelector('.afk-time').textContent = fmtTime(a.t);
    const st = g.st;
    el.querySelector('.afk-stats').textContent = `Map ${st.camp.ch}-${st.camp.st} · ${st.stats.kills - a.kills} ennemis · +${fmt(Math.max(0, st.res.gold - a.gold))} or`;
    el.querySelector('.afk-limit').textContent = `Fin de session dans ${fmtTime(Math.max(0, g.afkSessionMax() - a.t))}`;
  }
  showBoxUpgrade() {
    const g = this.g, st = g.st;
    const up = boxUpgradeInfo(st);
    const odds = boxOdds(st.box.lvl), next = boxOdds(Math.min(BOX_MAX_LEVEL, st.box.lvl + 1));
    const pf = (v) => (v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(1)) + '%';
    const table = h('div.odds', null, RARITIES.map((r, i) => (odds[i] > 0 || next[i] > 0) ? h('div.orow', { style: { '--rc': r.color } }, h('i'), h('span', null, r.name), h('b', null, pf(odds[i])), up.max ? null : h('em', { cls: next[i] > odds[i] ? 'up' : next[i] < odds[i] ? 'down' : '' }, '→ ' + pf(next[i]))) : null),
      h('div.orow', { style: { '--rc': '#fff27a' } }, h('i'), h('span', null, 'Relique'), h('b', null, '0.0005%'), null));
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
  tutorial(target, text) {
    this.tutoTarget = target;
    this.tutoText = text;
    this.placeTuto();
  }
  placeTuto() {
    const el = this.tutoEl, t = this.tutoTarget;
    if (!t || !t.isConnected || t.offsetParent === null || this.modalRoot.children.length) { el.hidden = true; return; }
    // cible cachée derrière un panneau ouvert (ex. le carton) : pas d'anneau
    if (this.sheet && !this.nav.contains(t) && !this.sheetEl.contains(t)) { el.hidden = true; return; }
    if (this.app.querySelector('.cls-reveal')) { el.hidden = true; return; }
    const r = t.getBoundingClientRect(), b = this.app.getBoundingClientRect();
    if (r.width === 0) { el.hidden = true; return; }
    el.hidden = false;
    const x = r.left - b.left, y = r.top - b.top;
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = r.width + 'px'; el.style.height = r.height + 'px';
    const txt = el.lastChild;
    if (txt.textContent !== this.tutoText) txt.textContent = this.tutoText;
    el.classList.toggle('below', y < 120);
    // la bulle reste toujours dans l'écran (cibles collées aux bords : onglets, barre d'icônes)
    const cur = parseFloat(txt.style.marginLeft) || 0;
    const tr = txt.getBoundingClientRect();
    const natL = tr.left - cur, natR = tr.right - cur;
    let shift = 0;
    if (natL < b.left + 6) shift = b.left + 6 - natL;
    else if (natR > b.right - 6) shift = b.right - 6 - natR;
    if (Math.abs(shift - cur) > 0.5) { txt.style.marginLeft = shift + 'px'; txt.style.setProperty('--tx', shift + 'px'); }
  }
}

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
export { catFullURL, catPortraitURL, itemIconURL, keepable, ELEMENTS };
