import './styles.css';
import { World } from './three/world.js';
import { FX } from './three/fx.js';
import { renderSnapshots } from './three/snap.js';
import { Battle } from './battle.js';
import { UI } from './ui/ui.js';
import { h, fmt, fmtTime, dayKey, randi } from './util.js';
import { icon } from './ui/icons.js';
import { initAudio, sfx, setSound, setMusic } from './audio.js';
import { loadState, saveState, ensureDaily, defaultState, makeBots, wipeSave } from './state.js';
import { computeStats, statsFromPower, SKIN_BY_ID, itemPower } from './stats.js';
import {
  openBoxes, gainHeroXp, boxUpgradeInfo, summonSkills, summonPets, levelUp, canLevel, autoEquipSkills, autoEquipPets,
  train, idleRate, idlePending, grant, bumpQuest, addPassXp, passTier,
} from './economy.js';
import { equippedSkills, equippedPets } from './combat.js';
import { campaignWaves, dungeonWaves, towerWaves } from './encounters.js';
import {
  RARITIES, VIP_PERKS, vipLevel, PRODUCTS, FIRST_RECHARGE, FUND_TIERS, PASS_TIERS, DAILY_QUESTS, DAILY_CHESTS,
  LOGIN_CALENDAR, ACHIEVEMENTS, DUNGEONS, dungeonReward, towerReward, ARENA_SHOP, arenaDailyGems, AD_LIMIT, AD_REWARDS,
  stageIndex, stageGold, stageYarn, killGold, biomeForChapter, recycleGold, boxUpgradeGold, boxUpgradeSeconds,
  skipGemCost, BOX_MAX_LEVEL, SKINS, PASS_XP_PER_TIER, trainingCost, TRAININGS, dupNeed, ARENA_FREE_TICKETS,
} from './config.js';

const BATCHES = [1, 5, 10, 25, 50];
// Courbe de puissance « moyenne du serveur » (joueur gratuit simulé) par jour depuis l'installation
const SERVER_CURVE = [[0, 2e3], [0.05, 6e3], [0.3, 2.5e4], [1, 7e4], [2, 6e5], [3, 1.3e6], [5, 7.6e6], [7, 1.7e7], [10, 4.2e7], [14, 1.1e8], [20, 4e8], [30, 1.75e9], [60, 4e10], [120, 2e12]];
function serverPower(days) {
  for (let i = 1; i < SERVER_CURVE.length; i++) {
    const [d1, p1] = SERVER_CURVE[i];
    const [d0, p0] = SERVER_CURVE[i - 1];
    if (days <= d1) return p0 * Math.pow(p1 / p0, (days - d0) / (d1 - d0));
  }
  return SERVER_CURVE[SERVER_CURVE.length - 1][1] * Math.pow(1.05, days - 120);
}

const EXCHANGES = [
  { id: 'x_yarn1', gems: 250, rewards: { yarn: 500 } },
  { id: 'x_yarn2', gems: 2200, rewards: { yarn: 5000 } },
  { id: 'x_feath', gems: 900, rewards: { feathers: 10 } },
  { id: 'x_eggs', gems: 700, rewards: { eggs: 10 } },
  { id: 'x_gold', gems: 100, rewards: { gold: 2 } },
  { id: 'x_speed', gems: 50, rewards: { speedM: 60 } },
];
const GEM_VALUE = { yarn: 0.5, feathers: 90, eggs: 70, gems: 1, speedH: 60, speedM: 1, gold: 50, food: 2 };

class Game {
  constructor() {
    this.special = null;
    this.autoBox = false;
    this.autoT = 0;
    this.fps = 60;
    this.uiT = 0;
    this.secT = 0;
  }

  boot(hotData) {
    this.st = loadState(hotData && hotData.save);
    this.ui = new UI(this);
    this.world = new World(this.ui.glEl);
    this.fx = new FX(this.world, this.ui.textEl, this.ui.flashEl);
    this.battle = new Battle(this.world, this.fx, this, this.ui.barsEl);
    try { this.ui.setSnaps(renderSnapshots()); } catch (e) { console.warn(e); }
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
    this.autoQ = { level: lowEnd ? 'medium' : 'high', low: 0, t: 0, frames: 0 };
    this.afterLoad(true);
    // audio au premier contact
    const unlock = () => { initAudio(); setSound(this.st.settings.sound); setMusic(this.st.settings.music); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('pagehide', () => this.save());
    try { window.claude?.hot?.snapshot?.(() => ({ save: this.st })); } catch (e) { /* ignore */ }
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    setInterval(() => this.save(), 15000);
  }

  afterLoad(first) {
    const st = this.st;
    const fresh = ensureDaily(st);
    if (!st.arena.order) st.arena.order = [...st.arena.bots.map((b) => b.id), 'me'];
    autoEquipSkills(st); autoEquipPets(st);
    this.applyQuality();
    this.recalc(true);
    this.world.setBiome(biomeForChapter(st.camp.ch).id, st.camp.ch * 13 + 7);
    this.ui.renderGear();
    this.ui.renderSide();
    this.ui.avatarImg.src = this.ui.snaps['head_' + st.skins.current] || '';
    this.startCampaign();
    if (fresh) this.onNewDay();
    const p = idlePending(st);
    if (first && p.hours > 0.08 && st.stats.opens > 0) setTimeout(() => { this.ui.toast(`Bon retour ! ${fmtTime(p.hours * 3600)} de patrouille`, 'gold'); this.ui.showIdle(); }, 600);
    if (st.stats.opens === 0) setTimeout(() => this.welcome(), 400);
  }

  welcome() {
    const body = h('div.welcome', null,
      h('img', { src: this.ui.snaps['skin_tabby'] || '', alt: '' }),
      h('p', null, 'Les rats, les chiens et les aspirateurs ont envahi le royaume ! Ouvrez le carton magique pour équiper Minou et bâtir l\'empire des chats.'),
      h('p.muted.small', null, 'Astuce : chaque carton ouvert donne de l\'expérience. Plus le carton est amélioré, plus les objets sont rares.'),
    );
    this.ui.modal({ title: 'Bienvenue dans Miaou Empire', body, buttons: [{ label: 'C\'est parti !', cls: 'green', fn: () => { sfx('meow'); } }] });
  }

  save() { saveState(this.st); }

  // ------------------------------------------------------------------ stats
  recalc(silent) {
    const old = this.stats;
    this.stats = computeStats(this.st);
    const perks = VIP_PERKS[this.stats.vip];
    this.battle.setPlayer(this.stats, equippedSkills(this.st, perks.skillSlots), equippedPets(this.st, perks.petSlots), this.st.skins.current, this.st.gear);
    if (old && !silent) this.ui.powerUp(this.stats.power - old.power);
    if (this.battle.speed > perks.speed) this.battle.speed = perks.speed;
    this.ui.renderSkillRow();
  }
  refreshAll() {
    this.recalc();
    this.ui.renderGear();
    this.ui.refresh();
  }

  // ------------------------------------------------------------------ campagne
  stageFromIdx(s) { return { ch: Math.floor(s / 10) + 1, st: (s % 10) + 1 }; }
  startCampaign() {
    const c = this.st.camp;
    this.special = null;
    this.battle.start({ mode: 'campaign', waves: campaignWaves(c.ch, c.st), stageIdx: stageIndex(c.ch, c.st) });
    this.ui.updateStageInfo();
  }
  setStage(s) {
    const oldCh = this.st.camp.ch;
    const { ch, st } = this.stageFromIdx(s);
    this.st.camp.ch = ch; this.st.camp.st = st;
    if (ch !== oldCh) {
      this.world.setBiome(biomeForChapter(ch).id, ch * 13 + 7);
      if (ch > oldCh) this.ui.banner(`CHAPITRE ${ch}`, biomeForChapter(ch).name, 'chapter');
    }
  }
  nextIsBoss() { return this.st.camp.best % 10 === 9; }
  challenge() {
    if (this.special) return;
    this.st.camp.auto = true;
    this.setStage(this.st.camp.best);
    this.startCampaign();
    this.ui.updateHud();
  }
  toggleAutoChallenge() {
    if (this.st.camp.auto) { this.st.camp.auto = false; this.ui.toast('Auto-défi désactivé : vous restez sur cette étape.'); }
    else this.challenge();
    this.ui.updateHud();
  }
  cycleSpeed() {
    const max = VIP_PERKS[this.stats.vip].speed;
    if (max <= 1) { this.ui.toast('Vitesse x2 : VIP 2 · x3 : VIP 8', 'vip'); return; }
    this.battle.speed = this.battle.speed >= max ? 1 : this.battle.speed + 1;
    this.st.settings.speed = this.battle.speed;
    sfx('click');
  }

  onEncounterStart() { this.ui.updateStageInfo(); this.ui.bossBar.hidden = true; }
  onBoss(b) {
    const bb = this.ui.bossBar;
    if (!b) { bb.hidden = true; return; }
    bb.hidden = false;
    bb.querySelector('.bname').textContent = b.name;
  }
  onBossHp(r, hp) {
    const bb = this.ui.bossBar;
    bb.querySelector('.bfill').style.transform = `scaleX(${r})`;
    const f2 = bb.querySelector('.bfill2');
    const cur = parseFloat(f2.dataset.r || '1');
    const nr = cur > r ? cur - (cur - r) * 0.04 : r;
    f2.dataset.r = nr;
    f2.style.transform = `scaleX(${nr})`;
    this.ui.setText('bosshp', bb.querySelector('.bhp'), fmt(Math.max(0, hp)));
  }
  onSkillCast(i) { this.ui.pulseSkill(i); }
  onKill(e, scr) {
    const st = this.st;
    st.stats.kills++;
    if (this.battle.mode === 'campaign') {
      const s = this.battle.enc.stageIdx;
      const mult = e.boss ? 10 : e.def.elite ? 3 : 1;
      st.res.gold += killGold(s) * mult;
      this.ui.fly('gold', scr.x, scr.y, e.boss ? 6 : 2);
    } else if (this.battle.mode === 'dungeon' && this.special.id === 'gold') this.ui.fly('gold', scr.x, scr.y, 3);
    else if (this.battle.mode === 'dungeon' && this.special.id === 'yarn') this.ui.fly('yarn', scr.x, scr.y, 3);
    if (e.boss) st.stats.bossKills++;
  }

  onEncounterEnd(win, enc) {
    const st = this.st;
    if (enc.mode === 'campaign') {
      const s = enc.stageIdx;
      if (win) {
        const first = s >= st.camp.best;
        const k = first ? 1 : 0.5;
        const gold = Math.round(stageGold(s) * k), yarn = Math.max(1, Math.round(stageYarn(s) * k));
        st.res.gold += gold; st.res.yarn += yarn;
        if (first) {
          st.camp.best = s + 1;
          bumpQuest(st, 'stage', 1);
          addPassXp(st, 2);
          if ((s % 10) === 9) { this.ui.banner('BOSS VAINCU !', `+${fmt(gold)} or · +${yarn} pelotes`, 'boss'); sfx('legendary'); }
          else this.ui.banner('ÉTAPE FRANCHIE', `+${fmt(gold)} or · +${yarn} pelotes`, 'small');
          if (s === 8 && !st.iap.bought.starter) setTimeout(() => this.showProduct('starter'), 2200);
        }
        st.camp.failStreak = 0;
        if (st.camp.auto) this.setStage(st.camp.best);
      } else {
        st.camp.failStreak++;
        st.camp.auto = false;
        this.setStage(Math.max(0, st.camp.best - 1));
        this.ui.banner('DÉFAITE', 'Ouvrez des cartons et entraînez-vous, puis défiez à nouveau', 'lose');
        this.maybeFlashOffer();
      }
      this.startCampaign();
      this.ui.renderSide();
      return;
    }
    // modes spéciaux
    const sp = this.special;
    this.special = null;
    if (sp && sp.onEnd) sp.onEnd(win);
    this.startCampaign();
    this.ui.renderSide();
    this.ui.refresh();
  }

  startSpecial(sp, enc) {
    this.ui.closeSheet();
    this.special = sp;
    this.battle.start(enc);
    this.ui.updateStageInfo();
  }
  leaveSpecial() {
    const sp = this.special;
    if (!sp) return;
    if (sp.onQuit) sp.onQuit();
    this.special = null;
    this.startCampaign();
    this.ui.refresh();
  }

  maybeFlashOffer() {
    const st = this.st, now = Date.now();
    if (st.camp.failStreak < 2) return;
    if (st.iap.flash && st.iap.flash.until > now) return;
    if (now - st.iap.lastFlash < 20 * 60000) return;
    const id = this.stats.vip >= 3 || st.iap.spent >= 2000 ? 'power_big' : 'power';
    st.iap.flash = { id, until: now + 3600000 };
    st.iap.lastFlash = now;
    this.ui.renderSide();
    setTimeout(() => this.showProduct(id, true), 1800);
  }

  // ------------------------------------------------------------------ carton
  batchSize() { return Math.min(BATCHES[this.st.box.batch] || 1, VIP_PERKS[this.stats.vip].batch); }
  cycleBatch() {
    const max = VIP_PERKS[this.stats.vip].batch;
    let i = this.st.box.batch + 1;
    if (i >= BATCHES.length || BATCHES[i] > max) {
      if (i < BATCHES.length && BATCHES[i] > max) this.ui.toast(`Ouverture x${BATCHES[i]} : ${BATCHES[i] === 10 ? 'VIP 1' : BATCHES[i] === 25 ? 'VIP 5' : 'VIP 10'}`, 'vip');
      i = 0;
    }
    this.st.box.batch = i;
    sfx('click');
    this.ui.updateHud();
  }
  autoUnlocked() { return this.stats.vip >= 1 || this.st.hero.lvl >= 25 || this.st.iap.lifetime; }
  toggleAutoBox() {
    if (!this.autoUnlocked()) { this.ui.toast('Ouverture auto : héros niveau 25 ou VIP 1', 'vip'); return; }
    this.autoBox = !this.autoBox;
    sfx('click');
    this.ui.updateHud();
  }
  openBoxClick() {
    const st = this.st;
    if (st.res.yarn <= 0) {
      sfx('error');
      this.ui.toast('Plus de pelotes ! Récoltez votre butin ou visitez la boutique.', 'warn');
      this.autoBox = false;
      return;
    }
    initAudio();
    const n = this.batchSize();
    if (n === 1 && !this.autoBox) this.openSingle();
    else this.openBatch(n);
  }
  openSingle() {
    const st = this.st;
    const res = openBoxes(st, 1, false);
    if (!res) return;
    const it = res.items[0];
    this.ui.boxShake(it.r);
    sfx('open');
    this.afterOpen(res);
    setTimeout(() => {
      if (it.r >= 4) sfx('legendary'); else if (it.r >= 3) sfx('epic'); else if (it.r >= 2) sfx('rare');
      this.ui.showItem(it, () => { this.refreshAll(); }, true);
    }, 260);
  }
  openBatch(n) {
    const st = this.st;
    const before = this.stats.power;
    const res = openBoxes(st, n, true);
    if (!res) return;
    const best = res.items.reduce((a, b) => (b.r > a.r ? b : a), res.items[0]);
    this.ui.boxShake(best.r);
    sfx('open');
    this.afterOpen(res);
    this.recalc();
    this.ui.renderGear();
    if (res.equipped.length) sfx('equip');
    if (best.r >= 4) sfx(best.r >= 5 ? 'legendary' : 'epic');
    const gained = this.stats.power - before;
    if (this.autoBox) {
      if (best.r >= st.box.stopAt && !res.equipped.includes(best)) {
        this.autoBox = false;
        this.ui.showItem(best, () => this.refreshAll(), true);
      }
      if (st.res.yarn <= 0) { this.autoBox = false; this.ui.toast('Pelotes épuisées : ouverture auto arrêtée'); }
      return;
    }
    const body = h('div.batch-res', null,
      h('div.batch-grid', null, res.items.slice(0, 50).map((it) => this.ui.itemIcon(it, res.equipped.includes(it) ? 'new' : 'rec'))),
      h('p.center', null, `${res.equipped.length} équipé(s) · ${n - res.equipped.length} recyclé(s) · +${fmt(res.gold)} or`),
      gained > 0 ? h('p.center.good', null, `Puissance +${fmt(gained)}`) : null,
    );
    this.ui.modal({ title: `Carton x${n}`, body, buttons: [{ label: 'Encore !', cls: 'gold', fn: () => { setTimeout(() => this.openBoxClick(), 50); } }, { label: 'OK', cls: 'blue' }], rays: best.r >= 4 ? RARITIES[best.r].color : null });
  }
  afterOpen(res) {
    if (res.lvUps) {
      sfx('levelup');
      this.ui.banner(`NIVEAU ${this.st.hero.lvl} !`, 'Vos objets seront plus puissants', 'level');
      this.fx.pillar(this.battle.player.model.root.position, '#7fd8ff', { r: 0.8, life: 0.9 });
      this.fx.burst(this.battle.player.model.root.position.clone().setY(1), { count: 40, color: ['#7fd8ff', '#ffffff'], up: 3, speed: 3, size: 0.25, life: 1, shape: 1 });
    }
    this.ui.updateHud();
  }
  recycleValue(it) { return recycleGold(it); }
  recycle(it) {
    this.st.res.gold += recycleGold(it);
    sfx('coin');
    this.refreshAll();
  }
  equip(it) {
    const cur = this.st.gear[it.slot];
    if (cur && cur.id !== it.id) this.st.res.gold += recycleGold(cur);
    this.st.gear[it.slot] = it;
    sfx('equip');
    this.refreshAll();
  }
  upgradeBox() {
    const st = this.st;
    const up = boxUpgradeInfo(st);
    if (up.max || up.busy) return;
    if (st.res.gold < up.gold) { sfx('error'); this.ui.toast('Pas assez d\'or', 'warn'); return true; }
    st.res.gold -= up.gold;
    st.box.upUntil = Date.now() + up.secs * 1000;
    sfx('equip');
    this.ui.updateHud();
    setTimeout(() => this.ui.showBoxUpgrade(), 200);
  }
  checkBox() {
    const st = this.st;
    if (st.box.upUntil && Date.now() >= st.box.upUntil) {
      st.box.upUntil = 0;
      st.box.lvl = Math.min(BOX_MAX_LEVEL, st.box.lvl + 1);
      sfx('levelup');
      this.ui.banner(`CARTON NIVEAU ${st.box.lvl}`, 'Meilleures chances de raretés !', 'level');
    }
  }
  finishBox() { this.checkBox(); this.ui.updateHud(); }
  skipCost() { return skipGemCost(Math.max(0, (this.st.box.upUntil - Date.now()) / 1000)); }
  skipBox() {
    const c = this.skipCost();
    if (!this.spendGems(c)) return true;
    this.st.box.upUntil = Date.now() - 1;
    this.checkBox();
    this.ui.updateHud();
  }
  useSpeedups() {
    const st = this.st;
    const left = Math.max(0, (st.box.upUntil - Date.now()) / 60000);
    const use = Math.min(st.res.speedMin, Math.ceil(left));
    st.res.speedMin -= use;
    st.box.upUntil -= use * 60000;
    this.ui.toast(`-${fmtTime(use * 60)} grâce aux accélérateurs`);
    this.checkBox();
    this.ui.updateHud();
  }
  spendGems(n) {
    if (this.st.res.gems < n) {
      sfx('error');
      this.ui.toast('Pas assez de gemmes', 'warn');
      this.ui.open('shop', 'gems');
      return false;
    }
    this.st.res.gems -= n;
    return true;
  }

  // ------------------------------------------------------------------ entraînement
  trainN(id, n) {
    let k = 0;
    for (let i = 0; i < n; i++) if (train(this.st, id)) k++; else break;
    if (!k) { sfx('error'); this.ui.toast('Pas assez d\'or', 'warn'); return; }
    sfx('equip');
    this.refreshAll();
  }
  trainAffordable() { return TRAININGS.some((t) => (!t.max || this.st.train[t.id] < t.max) && this.st.res.gold >= trainingCost(t.id, this.st.train[t.id]) * 3); }

  // ------------------------------------------------------------------ gacha
  summon(kind, n, free) {
    const st = this.st;
    const res = kind === 'skills' ? 'feathers' : 'eggs';
    if (free) { if (st.daily.summonFree) return; st.daily.summonFree = true; }
    else if (st.res[res] >= n) st.res[res] -= n;
    else {
      const price = kind === 'skills' ? { 1: 100, 10: 900, 35: 3000 }[n] : { 1: 80, 10: 700, 35: 2400 }[n];
      if (!this.spendGems(price)) return;
    }
    const got = kind === 'skills' ? summonSkills(st, n) : summonPets(st, n);
    const best = Math.max(...got.map((x) => x.r));
    sfx(best >= 5 ? 'legendary' : best >= 4 ? 'epic' : 'rare');
    const ui = this.ui;
    const body = h('div.summon-res', null, got.map((x, i) => {
      const c = h('div.sres', { cls: 'r' + x.r, style: { '--rc': RARITIES[x.r].color, '--rd': RARITIES[x.r].dark, animationDelay: Math.min(i, 20) * 0.05 + 's' } },
        kind === 'skills' ? h('span.sk-ic', { html: icon('sk_' + x.id) }) : h('img', { src: ui.snaps['pet_' + x.id] || '', alt: '' }),
        h('b', null, x.name),
      );
      return c;
    }));
    ui.modal({ title: kind === 'skills' ? 'Invocation de pouvoirs' : 'Éclosion !', body, buttons: [{ label: 'Encore x' + n, cls: 'gold', fn: () => { setTimeout(() => this.summon(kind, n), 60); } }, { label: 'OK', cls: 'blue' }], rays: best >= 4 ? RARITIES[best].color : null, cls: best >= 4 ? 'legendary' : '' });
    this.refreshAll();
    this.tutoCheck();
  }
  anyLevelUp(kind) { return Object.values(this.st[kind].owned).some((o) => canLevel(o)); }
  levelUpEntry(kind, id) {
    const o = this.st[kind].owned[id];
    if (!levelUp(o)) return;
    sfx('levelup');
    this.ui.toast(`Niveau ${o.lvl} !`, 'gold');
    this.ui.closeAllModals();
    this.refreshAll();
  }
  equipEntry(kind, id) {
    const st = this.st;
    const slots = kind === 'skills' ? VIP_PERKS[this.stats.vip].skillSlots : VIP_PERKS[this.stats.vip].petSlots;
    const eq = st[kind].equipped;
    if (eq.slice(0, slots).includes(id)) return;
    let idx = eq.slice(0, slots).findIndex((x) => !x);
    if (idx < 0) idx = slots - 1;
    eq[idx] = id;
    sfx('equip');
    this.refreshAll();
  }
  unequipEntry(kind, idx) { this.st[kind].equipped[idx] = null; this.refreshAll(); }

  setSkin(id) {
    this.st.skins.current = id;
    this.ui.avatarImg.src = this.ui.snaps['head_' + id] || '';
    sfx('meow');
    this.refreshAll();
    const p = this.battle.player.model.root.position;
    this.fx.burst(p.clone().setY(1), { count: 50, color: ['#ffd23f', '#ff7ae0', '#ffffff'], speed: 4, up: 2, size: 0.3, life: 0.9, shape: 1 });
  }
  skinSource(id) {
    const s = SKIN_BY_ID[id];
    if (s.src.includes('Ninja')) this.showProduct('ninja');
    else if (s.src.includes('Cyber')) this.showProduct('cyber');
    else if (s.src.includes('Baleine')) this.showProduct('whale');
    else if (s.src.includes('VIP')) this.ui.open('shop', 'vip');
    else if (s.src.includes('arène')) this.ui.open('adventure', 'arena');
    else if (s.src.includes('Passe')) this.ui.open('shop', 'pass');
    else if (s.src.includes('Connexion')) this.ui.open('quests', 'login');
    else if (s.src.includes('Arbre')) this.ui.open('adventure', 'tower');
  }

  // ------------------------------------------------------------------ récompenses
  previewRewards(r) {
    const out = [];
    for (const k in r) {
      const v = r[k];
      if (!v) continue;
      if (k === 'gold') out.push({ k: 'gold', v: Math.round(idleRate(this.st).gold * v) });
      else if (k === 'goldRaw') out.push({ k: 'gold', v });
      else if (k === 'speedH') out.push({ k: 'speedMin', v: v * 60 });
      else if (k === 'speedM') out.push({ k: 'speedMin', v });
      else out.push({ k, v });
    }
    return out;
  }
  give(rewards, title, big) {
    const list = grant(this.st, rewards);
    if (rewards.skin || rewards.pet || rewards.skill) this.recalc();
    this.ui.rewards(list, title, { big });
    this.refreshAll();
    return list;
  }
  idleRate() { return idleRate(this.st); }
  claimIdle(mult) {
    const p = idlePending(this.st);
    this.st.idleSince = Date.now();
    this.give({ goldRaw: p.gold * mult, yarn: p.yarn * mult }, mult > 1 ? 'Butin doublé !' : 'Butin récolté');
  }

  // ------------------------------------------------------------------ achats (simulés)
  productValue(id) {
    const p = PRODUCTS[id];
    if (!p.rewards) return 0;
    let v = 0;
    for (const k in p.rewards) {
      if (k === 'skin') v += 2500 * SKIN_BY_ID[p.rewards[k]].r;
      else if (k === 'pet' || k === 'skill') v += 1500;
      else v += (GEM_VALUE[k] || 0) * p.rewards[k];
    }
    return v / ((p.price / 100) * 66);
  }
  showProduct(id, flash) {
    const p = PRODUCTS[id];
    const ui = this.ui;
    const st = this.st;
    const first = p.kind === 'gems' && !st.iap.bought[id];
    let content;
    if (p.kind === 'gems') content = h('div.rewards', null, ui.rewardChip({ k: 'gems', v: p.gems * (first ? 2 : 1) }));
    else if (p.rewards) content = h('div.rewards', null, this.previewRewards(p.rewards).map((r) => ui.rewardChip(r)));
    else if (p.kind === 'pass') content = h('p', null, id === 'pass_deluxe' ? 'Débloque toutes les récompenses premium, +10 paliers immédiats et 5 000 pelotes. Costume Capitaine Moustache au palier 30.' : 'Débloque toutes les récompenses premium du Passe Royal. Costume Capitaine Moustache au palier 30.');
    else content = h('p', null, p.desc);
    const val = this.productValue(id);
    const body = h('div.product', null,
      p.tag ? h('span.ptag', null, p.tag) : null,
      content,
      val > 3 ? h('div.pval.big', null, `x${Math.round(val)} de valeur !`) : null,
      first ? h('div.pval.big', null, 'Premier achat : gemmes x2') : null,
      flash && st.iap.flash ? h('p.center.timer', null, 'Expire dans ', h('b', { dataset: { until: st.iap.flash.until } }, '')) : null,
      h('p.vip-pts', { html: `${icon('crown')} +${p.price} points VIP` }),
      st.iap.firstRecharge === 0 ? h('p.center.good.small', null, '+ Bonus de premier achat : Laser Oculaire, Dragonnet et plus !') : null,
    );
    ui.modal({ title: p.name, body, cls: 'product-modal' + (flash ? ' flash' : ''), rays: flash || p.price >= 4999 ? '#ffb52e' : null, buttons: [{ label: 'Acheter ' + (p.price / 100).toFixed(2).replace('.', ',') + ' €', cls: 'green', fn: () => { this.purchase(id); } }] });
    setTimeout(() => ui.tickTimers(), 0);
  }
  purchase(id) {
    const p = PRODUCTS[id];
    const st = this.st;
    if ((p.kind === 'once' && st.iap.bought[id]) || (p.kind === 'daily' && st.iap.daily[id]) || (p.kind === 'weekly' && st.iap.weekly[id])) { this.ui.toast('Déjà acheté'); return; }
    if (p.kind === 'card' && id === 'lifetime' && st.iap.lifetime) return;
    if (p.kind === 'card' && id === 'fund' && st.iap.fund) return;
    if (p.kind === 'pass' && st.iap.pass >= (id === 'pass_deluxe' ? 2 : 1)) return;
    const close = this.ui.modal({ title: 'Paiement sécurisé', body: h('div.paying', null, h('i.spinner'), h('p', null, 'Paiement simulé en cours…'), h('p.muted.small', null, 'Aucun paiement réel. Branchez Google Play Billing / App Store pour la version publiée.')), noClose: true });
    setTimeout(() => { close(); this.applyPurchase(id); }, 900);
  }
  applyPurchase(id) {
    const p = PRODUCTS[id];
    const st = this.st;
    const oldVip = vipLevel(st.iap.vip);
    st.iap.spent += p.price;
    st.iap.vip += p.price;
    st.iap.bought[id] = (st.iap.bought[id] || 0) + 1;
    const rewards = {};
    if (p.kind === 'gems') rewards.gems = p.gems * (st.iap.bought[id] === 1 ? 2 : 1);
    else if (p.rewards) Object.assign(rewards, p.rewards);
    if (p.kind === 'daily') st.iap.daily[id] = true;
    if (p.kind === 'weekly') st.iap.weekly[id] = true;
    if (p.kind === 'flash') st.iap.flash = null;
    if (id === 'monthly') { st.iap.monthlyUntil = Math.max(Date.now(), st.iap.monthlyUntil) + 30 * 864e5; rewards.gems = 300; st.daily.cardGems = true; }
    if (id === 'lifetime') { st.iap.lifetime = true; rewards.gems = 1000; }
    if (id === 'fund') st.iap.fund = true;
    if (id === 'pass') st.iap.pass = Math.max(1, st.iap.pass);
    if (id === 'pass_deluxe') { st.iap.pass = 2; addPassXp(st, PASS_XP_PER_TIER * 10); rewards.yarn = 5000; }
    if (!st.iap.firstRecharge) st.iap.firstRecharge = 1;
    sfx('buy');
    this.give(rewards, 'Merci pour votre achat !', p.price >= 999);
    const nv = vipLevel(st.iap.vip);
    if (nv > oldVip) this.onVipUp(oldVip, nv);
    this.save();
    this.refreshAll();
  }
  onVipUp(from, to) {
    const st = this.st;
    setTimeout(() => {
      sfx('legendary');
      this.ui.banner(`VIP ${to} !`, 'Nouveaux privilèges débloqués', 'vip');
      if (to >= 8 && !st.skins.owned.includes('pharaoh')) this.give({ skin: 'pharaoh' }, 'Cadeau VIP 8', true);
      if (to >= 12 && !st.skins.owned.includes('lion')) this.give({ skin: 'lion' }, 'Cadeau VIP 12', true);
      autoEquipSkills(st); autoEquipPets(st);
      this.recalc();
    }, 1200);
  }
  claimFirstRecharge() {
    if (this.st.iap.firstRecharge !== 1) return;
    this.st.iap.firstRecharge = 2;
    this.ui.closeSheet();
    this.give(FIRST_RECHARGE, 'Bonus de premier achat !', true);
  }
  claimFreeGift() {
    if (this.st.daily.freeGift) return;
    this.st.daily.freeGift = true;
    this.give({ yarn: 300, gems: 20 }, 'Cadeau du jour');
  }
  exchanges() { return EXCHANGES; }
  exchange(id) {
    const x = EXCHANGES.find((e) => e.id === id);
    if (!this.spendGems(x.gems)) return;
    this.give(x.rewards, 'Échange réussi');
  }
  fundClaimable() { return this.st.iap.fund && FUND_TIERS.some((f, i) => this.st.camp.best >= f.stage && !this.st.iap.fundClaimed.includes(i)); }
  claimFund(i) {
    const st = this.st;
    if (!st.iap.fund || st.iap.fundClaimed.includes(i) || st.camp.best < FUND_TIERS[i].stage) return;
    st.iap.fundClaimed.push(i);
    this.give({ gems: FUND_TIERS[i].gems }, 'Fonds de croissance');
  }
  passClaimable() {
    const st = this.st, t = passTier(st);
    return PASS_TIERS.some((p) => p.t <= t && (!st.pass.free.includes(p.t) || (st.iap.pass && !st.pass.prem.includes(p.t))));
  }
  claimAllPass() {
    const st = this.st, tier = passTier(st);
    const sum = {};
    let n = 0;
    for (const p of PASS_TIERS) {
      if (p.t > tier) break;
      const parts = [];
      if (!st.pass.free.includes(p.t)) { st.pass.free.push(p.t); parts.push(p.free); }
      if (st.iap.pass && !st.pass.prem.includes(p.t)) { st.pass.prem.push(p.t); parts.push(p.prem); }
      for (const r of parts) for (const k in r) { n++; sum[k] = typeof r[k] === 'number' ? (sum[k] || 0) + r[k] : r[k]; }
    }
    if (n) this.give(sum, 'Passe Royal', !!sum.skin);
  }
  claimPass(t, prem) {
    const st = this.st;
    if (passTier(st) < t) return;
    const tier = PASS_TIERS[t - 1];
    if (prem) { if (!st.iap.pass || st.pass.prem.includes(t)) return; st.pass.prem.push(t); this.give(tier.prem, 'Passe Royal', !!tier.prem.skin); }
    else { if (st.pass.free.includes(t)) return; st.pass.free.push(t); this.give(tier.free, 'Passe Royal'); }
  }
  vipGiftClaimable() { return this.stats.vip > 0 && !this.st.daily.vipGift; }
  claimVipGift() {
    if (!this.vipGiftClaimable()) return;
    this.st.daily.vipGift = true;
    this.give({ gems: VIP_PERKS[this.stats.vip].dailyGems, yarn: this.stats.vip * 150 }, 'Coffre VIP');
  }

  // ------------------------------------------------------------------ quêtes
  dailyClaimable() {
    const d = this.st.daily;
    return DAILY_QUESTS.some((q) => d.q[q.id] >= q.goal && !d.qDone.includes(q.id)) || DAILY_CHESTS.some((c, i) => d.pts >= c.pts && !d.chests.includes(i));
  }
  loginClaimable() { return this.st.login.lastKey !== dayKey(); }
  achValue(a) {
    const st = this.st;
    return a.kind === 'stage' ? st.camp.best : a.kind === 'level' ? st.hero.lvl : a.kind === 'opens' ? st.stats.opens : st.tower.floor - 1;
  }
  achClaimable() { return ACHIEVEMENTS.some((a) => !this.st.ach.includes(a.id) && this.achValue(a) >= a.goal); }
  questsClaimable() { return this.dailyClaimable() || this.loginClaimable() || this.achClaimable(); }
  claimQuest(id) {
    const d = this.st.daily;
    const q = DAILY_QUESTS.find((x) => x.id === id);
    if (d.qDone.includes(id) || d.q[id] < q.goal) return;
    d.qDone.push(id);
    d.pts = Math.min(100, d.pts + q.pts);
    addPassXp(this.st, q.pts);
    sfx('coin');
    this.ui.refresh();
  }
  claimChest(i) {
    const d = this.st.daily;
    if (d.chests.includes(i) || d.pts < DAILY_CHESTS[i].pts) return;
    d.chests.push(i);
    this.give(DAILY_CHESTS[i].rewards, `Coffre d'activité ${DAILY_CHESTS[i].pts}`);
  }
  claimLogin() {
    const L = this.st.login;
    if (!this.loginClaimable()) return;
    const r = LOGIN_CALENDAR[L.claimed % 7];
    L.claimed++;
    L.lastKey = dayKey();
    this.give(r, `Connexion — jour ${((L.claimed - 1) % 7) + 1}`, !!r.skin);
  }
  claimAch(id) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (this.st.ach.includes(id) || this.achValue(a) < a.goal) return;
    this.st.ach.push(id);
    this.give({ gems: a.gems }, 'Objectif atteint');
  }
  onNewDay() {
    const st = this.st;
    const g = {};
    if (st.iap.monthlyUntil > Date.now()) g.gems = (g.gems || 0) + 100;
    if (st.iap.lifetime) g.gems = (g.gems || 0) + 80;
    if (g.gems && !st.daily.cardGems) {
      st.daily.cardGems = true;
      setTimeout(() => this.give(g, 'Gemmes quotidiennes des cartes'), 1500);
    }
  }

  // ------------------------------------------------------------------ pubs simulées
  watchAd(cb) {
    const st = this.st;
    if (st.daily.ads >= AD_LIMIT) { this.ui.toast('Plus de vidéos aujourd\'hui', 'warn'); return; }
    const done = () => { st.daily.ads++; bumpQuest(st, 'ad', 1); cb(); this.ui.refresh(); };
    if (st.iap.lifetime) { done(); return; }
    let left = 3;
    const cnt = h('b.ad-count', null, String(left));
    const close = this.ui.modal({ title: 'Vidéo bonus', body: h('div.ad-fake', null, h('div.ad-screen', null, h('img', { src: this.ui.snaps['skin_galaxy'] || '', alt: '' }), h('span', null, 'Votre publicité ici')), h('p', null, 'Récompense dans ', cnt, ' s'), h('p.muted.small', null, 'Simulation : intégrez une régie (AdMob, AppLovin…) pour de vraies vidéos.')), noClose: true });
    const iv = setInterval(() => {
      left--;
      cnt.textContent = String(left);
      if (left <= 0) { clearInterval(iv); close(); done(); }
    }, 1000);
  }
  grantAd(i) { this.give(AD_REWARDS[i], 'Bonus vidéo'); }

  // ------------------------------------------------------------------ donjons / tour
  adventureDot() { return DUNGEONS.some((d) => this.st.dungeons[d.id].keys > 0) || this.st.arena.tickets > 0 || this.arenaDailyClaimable(); }
  startDungeon(id) {
    const ds = this.st.dungeons[id];
    if (ds.keys <= 0) return;
    const d = DUNGEONS.find((x) => x.id === id);
    ds.keys--;
    let refunded = false;
    const refund = () => { if (!refunded) { refunded = true; ds.keys++; } };
    this.startSpecial({ id, mode: 'dungeon', title: d.name, sub: 'Niveau ' + ds.lvl, banner: `${d.name} — niv. ${ds.lvl}`, onQuit: refund, onEnd: (win) => {
      if (win) {
        const r = dungeonReward(id, ds.lvl, this.st.camp.best);
        ds.lvl++;
        bumpQuest(this.st, 'dungeon', 1);
        this.give(r, 'Donjon terminé !');
      } else {
        refund();
        this.defeatModal('Le donjon résiste… Votre clé a été rendue.');
      }
    } }, { mode: 'dungeon', waves: dungeonWaves(id, ds.lvl, d.enemy) });
  }
  sweepDungeon(id) {
    const ds = this.st.dungeons[id];
    if (ds.keys <= 0 || ds.lvl <= 1) return;
    ds.keys--;
    bumpQuest(this.st, 'dungeon', 1);
    this.give(dungeonReward(id, ds.lvl - 1, this.st.camp.best), 'Balayage');
  }
  buyDungeonKey(id) {
    const ds = this.st.dungeons[id];
    if (ds.buys >= VIP_PERKS[this.stats.vip].dungeonBuys) return;
    if (!this.spendGems(100 * (ds.buys + 1))) return;
    ds.buys++; ds.keys++;
    sfx('coin');
    this.ui.refresh();
  }
  startTower() {
    const f = this.st.tower.floor;
    this.startSpecial({ mode: 'tower', title: 'Arbre à Chat', sub: 'Étage ' + f, banner: `Arbre à Chat — étage ${f}`, onEnd: (win) => {
      if (win) {
        this.st.tower.floor++;
        this.give(towerReward(f), `Étage ${f} conquis !`, f % 10 === 0);
      } else this.defeatModal('Ce gardien est trop fort pour le moment.');
    } }, { mode: 'tower', waves: towerWaves(f) });
  }
  defeatModal(msg) {
    const body = h('div.col', null, h('p.center', null, msg), h('p.muted.small.center', null, 'Pour devenir plus fort : ouvrez des cartons, améliorez le carton, entraînez-vous et invoquez des pouvoirs.'));
    this.ui.modal({ title: 'Défaite', body, buttons: [{ label: 'Entraînement', cls: 'blue', fn: () => this.ui.open('hero', 'train') }, { label: 'Offres', cls: 'gold', fn: () => this.ui.open('shop', 'offers') }] });
  }

  // ------------------------------------------------------------------ arène
  days() { return (Date.now() - this.st.created) / 864e5; }
  botPower(b) {
    const base = serverPower(this.days());
    return base * b.factor * b.grow;
  }
  arenaBoard() {
    const st = this.st;
    const byId = Object.fromEntries(st.arena.bots.map((b) => [b.id, b]));
    return st.arena.order.map((id, i) => {
      if (id === 'me') return { me: true, id, rank: i + 1, name: 'Minou (vous)', power: this.stats.power, vip: this.stats.vip, skin: st.skins.current };
      const b = byId[id];
      return { id, rank: i + 1, name: b.name, power: this.botPower(b), vip: b.vip, skin: b.skin };
    });
  }
  arenaOpponents() {
    const lb = this.arenaBoard();
    const me = lb.find((x) => x.me);
    const above = lb.filter((x) => !x.me && x.rank < me.rank && x.rank >= me.rank - 8);
    let pool = above.length ? above : lb.filter((x) => !x.me).slice(0, 4);
    // 1 facile, 1 moyen, 1 difficile
    pool = pool.sort((a, b) => a.power - b.power);
    if (pool.length <= 3) return pool;
    return [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]];
  }
  arenaFight(botId) {
    const st = this.st;
    if (st.arena.tickets <= 0) { this.ui.toast('Plus de tickets d\'arène', 'warn'); return; }
    const opp = this.arenaBoard().find((x) => x.id === botId);
    st.arena.tickets--;
    bumpQuest(st, 'arena', 1);
    const S = statsFromPower(opp.power, this.stats);
    const def = { rival: true, kind: 'cat', name: opp.name, skin: opp.skin, hp: S.hp * 1.1, atk: S.atk * 0.9, def: S.def, interval: 1.1, crit: 12, critDmg: 60 };
    const oldRank = this.arenaBoard().find((x) => x.me).rank;
    this.startSpecial({ mode: 'arena', title: 'Arène', sub: 'vs ' + opp.name, banner: `Arène — ${opp.name}`, onEnd: (win) => {
      const order = st.arena.order;
      const mi = order.indexOf('me'), oi = order.indexOf(botId);
      if (win && oi < mi) { order[mi] = botId; order[oi] = 'me'; }
      const newRank = order.indexOf('me') + 1;
      st.res.arenaCoins += win ? 30 : 10;
      if (win) st.stats.arenaWins++;
      const body = h('div.col.center', null,
        h('div.arena-res', { cls: win ? 'win' : 'lose' }, win ? 'VICTOIRE' : 'DÉFAITE'),
        h('p', null, `Rang : #${oldRank} → #${newRank}`),
        h('div.rewards', null, this.ui.rewardChip({ k: 'arenaCoins', v: win ? 30 : 10 })),
      );
      this.ui.modal({ title: 'Arène', body, buttons: [{ label: 'Rejouer', cls: 'gold', fn: () => this.ui.open('adventure', 'arena') }, { label: 'OK', cls: 'blue' }], rays: win ? '#ffd23f' : null });
    } }, { mode: 'arena', waves: [[def]] });
  }
  buyArenaTicket() {
    const st = this.st;
    if (st.arena.buys >= VIP_PERKS[this.stats.vip].arenaBuys) { this.ui.toast(`Achats de tickets max atteints (VIP ${this.stats.vip})`, 'vip'); return; }
    if (!this.spendGems(50 + st.arena.buys * 25)) return;
    st.arena.buys++; st.arena.tickets++;
    sfx('coin');
    this.ui.refresh();
  }
  arenaDailyClaimable() { return this.st.arena.claimedKey !== dayKey() && this.st.arena.order.indexOf('me') < 60; }
  claimArenaDaily() {
    if (!this.arenaDailyClaimable()) return;
    const rank = this.st.arena.order.indexOf('me') + 1;
    this.st.arena.claimedKey = dayKey();
    this.give({ gems: arenaDailyGems(rank), arenaCoins: 300 - Math.min(250, rank * 4) }, `Récompense rang #${rank}`);
  }
  arenaShopBuy(id) {
    const st = this.st;
    const a = ARENA_SHOP.find((x) => x.id === id);
    const n = st.arena.shop[id] || 0;
    if (n >= a.limit) return;
    if (st.res.arenaCoins < a.cost) { sfx('error'); this.ui.toast('Pas assez de médailles', 'warn'); return; }
    st.res.arenaCoins -= a.cost;
    st.arena.shop[id] = n + 1;
    this.give(a.rewards, 'Boutique d\'arène', !!a.rewards.skin);
  }

  // ------------------------------------------------------------------ paramètres
  applyQuality() {
    const q = this.st.settings.quality === 'auto' ? this.autoQ.level : this.st.settings.quality;
    this.world.setQuality(q);
    this.fx.lowFx = q === 'low';
    this.fx.setScale();
  }
  setSetting(k, v) {
    this.st.settings[k] = v;
    if (k === 'quality') this.applyQuality();
    if (k === 'sound') setSound(v);
    if (k === 'music') setMusic(v);
    this.ui.refresh();
  }
  resetGame() {
    wipeSave();
    this.st = defaultState();
    this.st.arena.bots = makeBots(this.st.seed);
    this.autoBox = false;
    this.ui.closeSheet();
    this.ui.closeAllModals();
    this.stats = null;
    this.afterLoad(false);
    this.save();
  }

  onSheet() { this.tutoCheck(); }
  tutoCheck() {
    const st = this.st, ui = this.ui;
    if (st.tutorial === 0 && st.stats.opens >= 12) st.tutorial = 1;
    if (st.tutorial === 1 && st.skills.pulls > 0) st.tutorial = 2;
    if (st.tutorial === 2 && st.pets.pulls > 0) st.tutorial = 3;
    if (ui.modalRoot.children.length) { ui.tutorial(null); return; }
    if (st.tutorial === 0) ui.tutorial(ui.boxBtn, 'Touchez le carton !');
    else if (st.tutorial === 1 && st.res.feathers >= 1 && !(ui.sheet && ui.sheet.name === 'skills')) ui.tutorial(ui.navBtns.skills, 'Invoquez un pouvoir');
    else if (st.tutorial === 2 && st.res.eggs >= 1 && st.skills.pulls > 0 && !(ui.sheet && ui.sheet.name === 'pets')) ui.tutorial(ui.navBtns.pets, 'Faites éclore un œuf');
    else ui.tutorial(null);
  }

  // ------------------------------------------------------------------ boucle principale
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    // mesure FPS / qualité auto
    this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
    const aq = this.autoQ;
    aq.t += dt;
    if (aq.t > 4 && this.st.settings.quality === 'auto') {
      aq.t = 0;
      if (this.fps < 38 && aq.level !== 'low') { aq.level = aq.level === 'high' ? 'medium' : 'low'; this.applyQuality(); }
    }
    this.battle.update(dt);
    this.fx.update(dt * this.battle.speed);
    if (this.world.look) this.fx.ambient(this.world.look.ambient, dt);
    this.world.update(dt);
    this.world.render();
    this.ui.updateSkillCds();
    // ouverture automatique
    if (this.autoBox) {
      this.autoT += dt;
      const iv = this.stats.vip >= 5 ? 0.35 : this.stats.vip >= 1 ? 0.5 : 0.7;
      if (this.autoT >= iv && !this.ui.modalRoot.children.length) { this.autoT = 0; this.openBatch(this.batchSize()); }
    }
    this.uiT += dt;
    if (this.uiT > 0.12) { this.uiT = 0; this.ui.updateHud(); }
    this.secT += dt;
    if (this.secT > 1) {
      this.secT = 0;
      this.ui.tickTimers();
      this.ui.updateStageInfo();
      this.checkBox();
      if (ensureDaily(this.st)) { this.onNewDay(); this.ui.refresh(); }
      if (this.st.iap.flash && this.st.iap.flash.until < Date.now()) { this.st.iap.flash = null; this.ui.renderSide(); }
      this.sideT = (this.sideT || 0) + 1;
      if (this.sideT % 3 === 0) this.ui.renderSide();
      this.tutoCheck();
    }
  }
}

function start(data) {
  const g = new Game();
  window.__game = g;
  g.boot(data || {});
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
