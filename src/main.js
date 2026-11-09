import './styles.css';
import { Stage } from './gfx/stage.js';
import { Battle } from './battle.js';
import { UI } from './ui/ui.js';
import { h, fmt, fmtTime, dayKey, pick } from './util.js';
import { icon } from './ui/icons.js';
import { initAudio, sfx, setSound, setMusic } from './audio.js';
import { loadState, saveState, ensureDaily, defaultState, makeBots, wipeSave } from './state.js';
import { computeStats, statsFromPower, itemPower, kittenStats, skillLevelMult, SKILL_BY_ID, COSTUME_BY_ID } from './stats.js';
import {
  openBoxes, boxUpgradeInfo, summonSkills, summonKittens, wildKitten, levelUp, levelUpWithMilk, canLevel, autoEquipSkills, autoEquipKittens,
  train, idleRate, idlePending, grant, bumpQuest, addPassXp, passTier, equipItem, disposeItem, addToBag, rollDrops, luckMult,
  craft, forge, breakItem, relicPull, lookUnlocked, lookPrice,
  artifactChest, artifactStarUp, artifactLevelUp, autoEquipArtifacts, brewPotion, usePotion, transmute, towerRewards,
} from './economy.js';
import { equippedSkills, equippedKittens } from './combat.js';
import { campaignWaves, dungeonWaves, towerWaves, lairWaves } from './encounters.js';
import {
  RARITIES, VIP_PERKS, vipLevel, PRODUCTS, FIRST_RECHARGE, FUND_TIERS, PASS_TIERS, DAILY_QUESTS, DAILY_CHESTS,
  LOGIN_CALENDAR, ACHIEVEMENTS, DUNGEONS, dungeonReward, towerReward, ARENA_SHOP, arenaDailyGems, AD_LIMIT, AD_REWARDS,
  stageIndex, stageGold, stageYarn, killGold, biomeForChapter, recycleGold, skipGemCost, BOX_MAX_LEVEL, PASS_XP_PER_TIER,
  trainingCost, TRAININGS, SKILLS, BIOMES, AD_LIMIT_NOADS, LAIR_FREE, lairBuyCost,
} from './config.js';
import {
  eraOf, ERA_DROPS, ARTIFACT_BY_ID, ARTIFACT_CHEST, artifactSlots, AURA_BY_ID, TITLE_BY_ID, FRAME_BY_ID, STYLE_SHOP, LOYALTY,
  towerFloorInfo, TOWER_SHOP, TOWER_REVIVE_GEMS, POTION_BY_ID,
} from './content3.js';
import {
  KITTEN_BY_ID, RES_BY_ID, BIOME_BOSS, ELEMENTS, SETS, SET_BY_ID, RELIC_CHEST, HETERO_COST, LOOK_UNLOCK, TERRITORIES, WAR_SHOP, WAR_ENERGY, breakRunes,
} from './content.js';
import { ensureMarket, tickMarket, buyLot, listLot, cancelListing, quickSell, sellGems, buyGems } from './market.js';
import {
  arenaBoard, arenaOpponents, arenaSwap, myRank, arenaSeasonCheck, botLoadout, botPower, warTick, warSeasonReward, defenderPower, defenderLoadout, defenderName,
  ownedTerritories, tributeAvailable, warBuyCost, CLAN_BY_ID,
} from './pvp.js';
import { catPortraitURL, catFullURL, FURS, PATTERNS, EYES, EYE_STYLES, EARS, TAILS } from './gfx/cat.js';
import { RCOL } from './gfx/gear.js';
import { kittenFullURL } from './gfx/kittens.js';

const BATCHES = [1, 5, 10, 25, 50];
const EXCHANGES = [
  { id: 'x_yarn1', gems: 250, rewards: { yarn: 500 } },
  { id: 'x_yarn2', gems: 2200, rewards: { yarn: 5000 } },
  { id: 'x_feath', gems: 900, rewards: { feathers: 10 } },
  { id: 'x_eggs', gems: 700, rewards: { eggs: 10 } },
  { id: 'x_gold', gems: 100, rewards: { gold: 2 } },
  { id: 'x_speed', gems: 50, rewards: { speedM: 60 } },
  { id: 'x_stone', gems: 400, rewards: { stone: 1 } },
  { id: 'x_clover', gems: 150, rewards: { clover: 1 } },
];
const GEM_VALUE = { yarn: 0.5, feathers: 90, eggs: 70, gems: 1, speedH: 60, speedM: 1, gold: 50, stone: 400, scroll: 150, clover: 150, milk: 120, rune: 2, relicKeys: 280, moonShard: 300 };
const monthKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); };

class Game {
  constructor() {
    this.special = null;
    this.autoBox = false;
    this.autoT = 0;
    this.fps = 60;
    this.uiT = 0;
    this.secT = 0;
    this.useStone = false;
    this.useScroll = false;
  }

  boot(hotData) {
    this.st = loadState(hotData && hotData.save);
    ensureMarket(this.st);
    this.ui = new UI(this);
    this.stage = new Stage(this.ui.glEl);
    this.battle = new Battle(this.stage, this);
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
    this.autoQ = { level: lowEnd ? 'medium' : 'high', t: 0 };
    this.afterLoad(true);
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
    autoEquipSkills(st); autoEquipKittens(st); autoEquipArtifacts(st, artifactSlots(vipLevel(st.iap.vip)));
    this.applyQuality();
    this.recalc(true);
    this.ui.renderGear();
    this.ui.renderSide();
    this.startCampaign();
    if (fresh) this.onNewDay();
    this.offlineCatchUp();
    const p = idlePending(st, this.stats);
    if (first && p.hours > 0.08 && st.stats.opens > 0) setTimeout(() => { this.ui.toast(`Bon retour ! ${fmtTime(p.hours * 3600)} de patrouille`, 'gold'); this.ui.showIdle(); }, 600);
    if (st.stats.opens === 0) setTimeout(() => this.welcome(), 400);
  }
  offlineCatchUp() {
    const sold = tickMarket(this.st);
    if (sold.length) setTimeout(() => this.ui.toast(`Hôtel des ventes : ${sold.length} lot(s) vendu(s) pendant votre absence (+${fmt(sold.reduce((a, s) => a + s.price, 0))} or)`, 'gold'), 1500);
    this.handleWarEvents(warTick(this.st));
    const season = arenaSeasonCheck(this.st);
    if (season) setTimeout(() => this.give({ gems: season.gems, arenaCoins: 500 }, `Saison d'arène : ${season.div.name}`, true), 2500);
  }

  welcome() {
    const body = h('div.welcome', null,
      h('img', { src: this.fullURL(), alt: '' }),
      h('p', null, 'Les rats, les chiens et les aspirateurs ont envahi le royaume ! Ouvrez le carton magique pour équiper Minou, adoptez des chatons et bâtissez l\'empire des chats.'),
      h('p.muted.small', null, 'Astuce : touchez votre portrait pour personnaliser votre chat (pelage, yeux, oreilles…).'),
    );
    this.ui.modal({ title: 'Bienvenue dans Miaou Empire', body, buttons: [{ label: 'C\'est parti !', cls: 'green', fn: () => { sfx('meow'); } }] });
  }
  save() { saveState(this.st); }

  // ------------------------------------------------------------------ apparence & rendu du héros
  costume() { const c = COSTUME_BY_ID[this.st.costumes.current]; return this.st.costumes.show && c && c.look ? c : null; }
  appearance() { const c = this.costume(); return c ? { ...this.st.look, ...c.look } : this.st.look; }
  gearVisual() {
    const g = {};
    for (const k in this.st.gear) { const it = this.st.gear[k]; if (it) g[k] = { base: it.base, r: it.r }; }
    const c = this.costume();
    if (c && c.gear) Object.assign(g, c.gear);
    return g;
  }
  portrait() { const g = this.gearVisual(); return catPortraitURL(this.appearance(), { hat: g.hat, face: g.face }, 96); }
  fullURL() { return catFullURL(this.appearance(), this.gearVisual(), 220); }
  costumeURL(id) { const c = COSTUME_BY_ID[id]; return c.look ? catFullURL({ ...this.st.look, ...c.look }, c.gear || {}, 150) : catFullURL(this.st.look, {}, 150); }
  kittenURL(id) { return kittenFullURL(id, 120); }

  playerDef() {
    const st = this.st, S = this.stats;
    const perks = VIP_PERKS[S.vip];
    const gear = this.gearVisual();
    const kits = equippedKittens(st, perks.kittenSlots).map((k) => ({ id: k.id, name: k.name, el: k.el, r: k.r, look: k.look, mult: k.mult }));
    return { name: 'Minou', appearance: this.appearance(), gear, stats: S, skills: equippedSkills(st, perks.skillSlots), kittens: kits, weaponColor: gear.weapon ? RCOL[gear.weapon.r] : '#ffffff', perks: S.perks, aura: st.cos.aura };
  }

  // ------------------------------------------------------------------ stats
  recalc(silent) {
    const old = this.stats;
    this.stats = computeStats(this.st);
    const perks = VIP_PERKS[this.stats.vip];
    this.battle.setPlayer(this.playerDef());
    if (old && !silent) this.ui.powerUp(this.stats.power - old.power);
    if (this.battle.speed > perks.speed) this.battle.speed = perks.speed;
    this.ui.renderSkillRow();
  }
  refreshAll() { this.recalc(); this.ui.renderGear(); this.ui.refresh(); }

  // ------------------------------------------------------------------ campagne
  stageFromIdx(s) { return { ch: Math.floor(s / 10) + 1, st: (s % 10) + 1 }; }
  startCampaign() {
    const c = this.st.camp;
    this.special = null;
    const cw = campaignWaves(c.ch, c.st);
    this.battle.setScenery(cw.biome, c.ch * 13 + 7, cw.variant);
    this.battle.start({ mode: 'campaign', ...cw, stageIdx: stageIndex(c.ch, c.st) });
    this.ui.updateStageInfo();
  }
  era() { return eraOf(this.st.camp.ch, BIOMES.length); }
  setStage(s) {
    const oldCh = this.st.camp.ch;
    const { ch, st } = this.stageFromIdx(s);
    this.st.camp.ch = ch; this.st.camp.st = st;
    if (ch > oldCh) {
      const er = eraOf(ch, BIOMES.length), olde = eraOf(oldCh, BIOMES.length);
      if (er.e > olde.e) this.ui.banner(`ÈRE ${er.name.toUpperCase()}`, 'Les monstres sont plus forts… et le butin aussi !', 'vip');
      else this.ui.banner(`MAP ${ch}`, biomeForChapter(ch).name, 'chapter');
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
    if (this.st.camp.auto) { this.st.camp.auto = false; this.ui.toast('Auto-défi désactivé : vous restez sur cette étape pour farmer.'); }
    else this.challenge();
    this.ui.updateHud();
  }
  cycleSpeed() {
    const max = VIP_PERKS[this.stats.vip].speed;
    if (max <= 1) { this.ui.toast('Vitesse x2 : VIP 2 · x3 : VIP 8', 'vip'); return; }
    this.battle.speed = this.battle.speed >= max ? 1 : this.battle.speed + 1;
    sfx('click');
  }
  onEncounterStart() { this.ui.updateStageInfo(); this.ui.bossBar.hidden = true; this.ui.renderSkillRow(); }
  onBoss(b) {
    const bb = this.ui.bossBar;
    if (!b) { bb.hidden = true; return; }
    bb.hidden = false;
    bb.querySelector('.bname').textContent = b.name;
    bb.querySelector('.bfill2').dataset.r = '1';
  }
  onBanner(t, s, c) { this.ui.banner(t, s, c); }
  onBossIntro(b, variant) { this.ui.bossIntro(b, variant); }
  onCutin(sk) { this.ui.cutin(sk); }
  onSkillCast(i) { this.ui.pulseSkill(i); }
  onKill(e, scr) {
    const st = this.st;
    st.stats.kills++;
    const mode = this.battle.mode;
    if (mode === 'campaign' || mode === 'dungeon' || mode === 'tower' || mode === 'lair') {
      const s = mode === 'campaign' ? this.battle.enc.stageIdx : Math.max(0, st.camp.best - 5);
      const mult = (e.boss ? 10 : e.elite ? 3 : 1) * (1 + (this.stats.goldPct || 0) / 100);
      st.res.gold += killGold(s) * mult;
      this.ui.fly('gold', scr.x, scr.y, e.boss ? 6 : 2);
      const era = mode === 'campaign' ? this.battle.enc.era : { e: 0, lootMult: 1 };
      const drops = rollDrops(st, e.def.kind, e.boss, e.def.drop, luckMult(st, this.stats) * (era ? era.lootMult : 1));
      if (era && era.e >= 1) for (let v = 1; v <= Math.min(3, era.e); v++) { const [id, p] = ERA_DROPS[v]; if (Math.random() < p * (e.boss ? 20 : 1) * luckMult(st, this.stats)) { st.mats[id] = (st.mats[id] || 0) + 1; drops[id] = (drops[id] || 0) + 1; } }
      if (e.boss && Math.random() < 0.25) { const n = 2 + Math.floor(Math.random() * 3); this.give({ frags: n }, 'Fragments d\'artefact', false, true); }
      if (Object.keys(drops).length) this.ui.loot(drops);
    }
    if (e.boss) st.stats.bossKills++;
  }
  onBossHp(r, hp) {
    const bb = this.ui.bossBar;
    bb.querySelector('.bfill').style.transform = `scaleX(${r})`;
    const f2 = bb.querySelector('.bfill2');
    const cur = parseFloat(f2.dataset.r || '1');
    const nr = cur > r ? cur - (cur - r) * 0.05 : r;
    f2.dataset.r = nr;
    f2.style.transform = `scaleX(${nr})`;
    this.ui.setText('bosshp', bb.querySelector('.bhp'), fmt(Math.max(0, hp)));
  }
  maybeWildKitten(chance) {
    if (Math.random() > chance * (1 + (this.stats.luck || 0) / 400)) return;
    const { k, isNew } = wildKitten(this.st);
    this.recalc();
    setTimeout(() => {
      sfx('meow');
      const body = h('div.welcome', null, h('img', { src: this.kittenURL(k.id), alt: '' }), h('p', null, isNew ? `${k.name} (${RARITIES[k.r].name}) vous suit désormais !` : `Un autre ${k.name} rejoint la chatterie : +1 copie.`), h('p.small', { style: { color: ELEMENTS[k.el].color } }, 'Élément ' + ELEMENTS[k.el].name));
      this.ui.modal({ title: 'Un chaton sauvage !', body, buttons: [{ label: 'Adopter', cls: 'green' }], rays: k.r >= 4 ? RARITIES[k.r].color : '#ffffff', cls: 'r' + k.r });
    }, 900);
  }
  onEncounterEnd(win, enc) {
    const st = this.st;
    if (enc.mode === 'campaign') {
      const s = enc.stageIdx;
      if (win) {
        const first = s >= st.camp.best;
        const k = first ? 1 : 0.5;
        const gold = Math.round(stageGold(s) * k * (1 + (this.stats.goldPct || 0) / 100)), yarn = Math.max(1, Math.round(stageYarn(s) * k));
        st.res.gold += gold; st.res.yarn += yarn;
        if (first) {
          st.camp.best = s + 1;
          bumpQuest(st, 'stage', 1);
          addPassXp(st, 2);
          if ((s % 10) === 9) { this.ui.banner('BOSS VAINCU !', `+${fmt(gold)} or · +${yarn} pelotes`, 'boss'); sfx('legendary'); this.maybeWildKitten(0.15); }
          else { this.ui.banner('ÉTAPE FRANCHIE', `+${fmt(gold)} or · +${yarn} pelotes`, 'small'); this.maybeWildKitten(0.03); }
          if (s === 8 && !st.iap.bought.starter) setTimeout(() => this.showProduct('starter'), 2200);
        } else this.maybeWildKitten(0.006);
        st.camp.failStreak = 0;
        if (st.camp.auto) this.setStage(st.camp.best);
      } else {
        st.camp.failStreak++;
        st.camp.auto = false;
        this.setStage(Math.max(0, st.camp.best - 1));
        this.ui.banner('DÉFAITE', 'Équipez-vous, forgez, adoptez des chatons… puis défiez à nouveau', 'lose');
        this.maybeFlashOffer();
      }
      this.startCampaign();
      this.ui.renderSide();
      return;
    }
    const sp = this.special;
    this.special = null;
    if (sp && sp.onEnd) sp.onEnd(win);
    this.startCampaign();
    this.ui.renderSide();
    this.ui.refresh();
  }
  startSpecial(sp, enc, scene, variant = 0) {
    this.ui.closeSheet();
    this.special = sp;
    if (scene) this.battle.setScenery(scene, 3, variant);
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
  autoUnlocked() { return this.stats.vip >= 1 || this.st.hero.lvl >= 25; }
  toggleAutoBox() {
    if (!this.autoUnlocked()) { this.ui.toast('Ouverture auto : héros niveau 25 ou VIP 1', 'vip'); return; }
    this.autoBox = !this.autoBox;
    sfx('click');
    this.ui.updateHud();
  }
  openBoxClick() {
    const st = this.st;
    if (st.res.yarn <= 0) { sfx('error'); this.ui.toast('Plus de pelotes ! Récoltez votre butin ou visitez la boutique.', 'warn'); this.autoBox = false; return; }
    initAudio();
    const n = this.batchSize();
    if (n === 1 && !this.autoBox) this.openSingle(); else this.openBatch(n);
  }
  openSingle() {
    const res = openBoxes(this.st, 1, false);
    if (!res) return;
    const it = res.items[0];
    this.ui.boxShake(it.r);
    sfx('open');
    this.afterOpen(res);
    setTimeout(() => {
      if (it.relic) { this.relicFound(it); }
      if (it.r >= 4) sfx('legendary'); else if (it.r >= 3) sfx('epic'); else if (it.r >= 2) sfx('rare');
      this.ui.showItem(it, () => { this.refreshAll(); }, true);
    }, 260);
  }
  relicFound(it) { this.ui.banner('RELIQUE !', 'Une chance sur 200 000 !', 'vip'); sfx('legendary'); this.battle.flash('#fff27a', 0.6); }
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
    if (res.relics.length) this.relicFound(res.relics[0]);
    const gained = this.stats.power - before;
    if (this.autoBox) {
      if ((best.r >= st.box.stopAt && !res.equipped.includes(best)) || res.relics.length) { this.autoBox = false; this.ui.showItem(best, () => this.refreshAll(), false); }
      if (st.res.yarn <= 0) { this.autoBox = false; this.ui.toast('Pelotes épuisées : ouverture auto arrêtée'); }
      return;
    }
    const body = h('div.batch-res', null,
      h('div.batch-grid', null, res.items.slice(0, 50).map((it) => this.ui.itemIcon(it, res.equipped.includes(it) ? 'new' : 'rec'))),
      h('p.center', null, `${res.equipped.length} équipé(s) · ${n - res.equipped.length} ${st.box.autoBreak ? 'brisé(s)' : 'recyclé(s)'} · +${fmt(res.gold)} or${res.runes ? ` · +${res.runes} runes` : ''}`),
      gained > 0 ? h('p.center.good', null, `Puissance +${fmt(gained)}`) : null,
    );
    this.ui.modal({ title: `Carton x${n}`, body, buttons: [{ label: 'Encore !', cls: 'gold', fn: () => { setTimeout(() => this.openBoxClick(), 50); } }, { label: 'OK', cls: 'blue' }], rays: best.r >= 4 ? RARITIES[best.r].color : null });
  }
  afterOpen(res) {
    if (res.lvUps) {
      sfx('levelup');
      this.ui.banner(`NIVEAU ${this.st.hero.lvl} !`, 'Vos objets seront plus puissants', 'level');
      const H = this.battle.hero;
      if (H) { this.battle.fx.pillar(H.x, { color: '#7fd8ff', width: 34, dur: 0.9, y: H.y }); this.battle.fx.burst(H.x, H.y - 60, { count: 40, color: ['#7fd8ff', '#ffffff'], up: 120, speed: 120, size: 9, life: 1, shape: 'star' }); }
    }
    this.ui.updateHud();
  }
  recycleValue(it) { return recycleGold(it); }
  breakValue(it) { return breakRunes(it) * (1 + (it.upg || 0)); }
  recycle(it) { if (it.relic) { addToBag(this.st, it); this.refreshAll(); return; } disposeItem(this.st, it, false); sfx('coin'); this.refreshAll(); }
  breakNew(it) { if (it.relic) { addToBag(this.st, it); this.refreshAll(); return; } disposeItem(this.st, it, true); sfx('coin'); this.refreshAll(); }
  equip(it) { equipItem(this.st, it, this.st.box.autoBreak); sfx('equip'); this.refreshAll(); }
  breakBagItem(it) { const n = breakItem(this.st, it); if (n) { this.ui.toast(`+${n} runes de forge`, 'gold'); sfx('slash'); } this.refreshAll(); }
  setAutoBreak(v) { this.st.box.autoBreak = v; this.ui.refresh(); }
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
  skipBox() { const c = this.skipCost(); if (!this.spendGems(c)) return true; this.st.box.upUntil = Date.now() - 1; this.checkBox(); this.ui.updateHud(); }
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
    if (!(n >= 0) || !isFinite(n)) return false; // montant invalide : on ne débite jamais
    if (this.st.res.gems < n) { sfx('error'); this.ui.toast('Pas assez de gemmes', 'warn'); this.ui.open('shop', 'gems'); return false; }
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

  // ------------------------------------------------------------------ pouvoirs
  summonSkills(n, free) {
    const st = this.st;
    if (free) { if (st.daily.summonFree) return; st.daily.summonFree = true; }
    else if (st.res.feathers >= n) st.res.feathers -= n;
    else if (!this.spendGems({ 1: 100, 10: 900, 35: 3000 }[n])) return;
    const got = summonSkills(st, n);
    const best = Math.max(...got.map((x) => x.r));
    sfx(best >= 5 ? 'legendary' : best >= 4 ? 'epic' : 'rare');
    const body = h('div.summon-res', null, got.map((x, i) => h('div.sres', { cls: 'r' + x.r, style: { '--rc': RARITIES[x.r].color, '--rd': RARITIES[x.r].dark, animationDelay: Math.min(i, 20) * 0.05 + 's' } }, h('span.sk-ic', { html: icon('sk_' + x.id) }), h('b', null, x.name))));
    this.ui.modal({ title: 'Invocation de pouvoirs', body, buttons: [{ label: 'Encore x' + n, cls: 'gold', fn: () => { setTimeout(() => this.summonSkills(n), 60); } }, { label: 'OK', cls: 'blue' }], rays: best >= 4 ? RARITIES[best].color : null });
    this.refreshAll();
    this.tutoCheck();
  }
  anyLevelUp(kind) { return Object.values(this.st[kind].owned).some((o) => canLevel(o)); }
  levelUpSkill(id) { const o = this.st.skills.owned[id]; if (!levelUp(o)) return; sfx('levelup'); this.ui.toast(`Niveau ${o.lvl} !`, 'gold'); this.ui.closeAllModals(); this.refreshAll(); }
  equipSkill(id) {
    const st = this.st, slots = VIP_PERKS[this.stats.vip].skillSlots, eq = st.skills.equipped;
    if (eq.slice(0, slots).includes(id)) return;
    let idx = eq.slice(0, slots).findIndex((x) => !x);
    if (idx < 0) idx = slots - 1;
    eq[idx] = id; sfx('equip'); this.refreshAll();
  }
  unequipSkill(i) { this.st.skills.equipped[i] = null; this.refreshAll(); }

  // ------------------------------------------------------------------ chatons
  summonKittens(n) {
    const st = this.st;
    const price = { 1: 80, 10: 700, 35: 2400 }[n];
    if (st.res.eggs >= n) st.res.eggs -= n;
    else if (price == null || !this.spendGems(price)) return;
    const got = summonKittens(st, n);
    const best = Math.max(...got.map((x) => x.k.r));
    sfx(best >= 5 ? 'legendary' : best >= 3 ? 'epic' : 'rare');
    if (best >= 4) sfx('meow');
    const body = h('div.summon-res', null, got.map(({ k, isNew }, i) => h('div.sres', { cls: 'r' + k.r, style: { '--rc': RARITIES[k.r].color, '--rd': RARITIES[k.r].dark, animationDelay: Math.min(i, 20) * 0.05 + 's' } }, h('img', { src: this.kittenURL(k.id), alt: '' }), h('b', null, k.name), isNew ? h('i.new-tag', null, 'NOUVEAU') : null)));
    this.ui.modal({ title: 'Le panier s\'ouvre…', body, buttons: [{ label: 'Encore x' + n, cls: 'gold', fn: () => { setTimeout(() => this.summonKittens(n), 60); } }, { label: 'OK', cls: 'blue' }], rays: best >= 4 ? RARITIES[best].color : null, cls: best >= 4 ? 'legendary' : '' });
    this.refreshAll();
    this.tutoCheck();
  }
  levelUpKitten(id, milk) {
    const o = this.st.kittens.owned[id];
    const ok = milk ? levelUpWithMilk(this.st, o) : levelUp(o);
    if (!ok) return;
    sfx('levelup'); sfx('meow');
    this.ui.toast(`${KITTEN_BY_ID[id].name} passe niveau ${o.lvl} !`, 'gold');
    this.ui.closeAllModals();
    this.refreshAll();
  }
  equipKitten(id) {
    const st = this.st, slots = VIP_PERKS[this.stats.vip].kittenSlots, eq = st.kittens.equipped;
    if (eq.slice(0, slots).includes(id)) return;
    let idx = eq.slice(0, slots).findIndex((x) => !x);
    if (idx < 0) idx = slots - 1;
    eq[idx] = id; sfx('meow'); this.refreshAll();
  }
  unequipKitten(i) { this.st.kittens.equipped[i] = null; this.refreshAll(); }

  // ------------------------------------------------------------------ apparence & costumes
  pickLook(cat, id) {
    const st = this.st;
    if (cat === 'pcolor') { st.look.pcolor = id; this.lookChanged(); return; }
    if (!lookUnlocked(st, cat, id)) {
      const p = lookPrice(cat, id);
      if (typeof p === 'number') {
        this.ui.modal({ title: 'Débloquer', body: h('div.col.center', null, h('p', { html: `Débloquer cette option pour ${icon('gems')} ${p} ?` }), h('p.small.muted', null, 'Elle reste à vous pour toujours.')), buttons: [{ label: 'Débloquer', sub: `${icon('gems')} ${p}`, cls: 'purple', fn: () => { if (!this.spendGems(p)) return; st.unlocks.push(cat + ':' + id); st.look[cat] = id; sfx('buy'); this.lookChanged(); } }] });
      } else if (p === 'pack') this.showProduct('whale');
      else this.ui.open('shop', 'vip');
      return;
    }
    st.look[cat] = id;
    if (cat === 'pattern' && !st.look.pcolor) st.look.pcolor = null;
    this.lookChanged();
  }
  toggleHetero() {
    const st = this.st;
    if (st.look.eye2) { st.look.eye2 = null; this.lookChanged(); return; }
    const go = () => { const others = Object.keys(EYES).filter((e) => e !== st.look.eye && lookUnlocked(st, 'eye', e)); st.look.eye2 = pick(others); this.lookChanged(); };
    if (st.unlocks.includes('eye2:on')) go();
    else if (this.spendGems(HETERO_COST)) { st.unlocks.push('eye2:on'); sfx('buy'); go(); }
  }
  randomLook() {
    const st = this.st;
    for (const [cat, map] of [['fur', FURS], ['pattern', PATTERNS], ['eye', EYES], ['eyeStyle', EYE_STYLES], ['ears', EARS], ['tail', TAILS]]) {
      const ok = Object.keys(map).filter((id) => lookUnlocked(st, cat, id));
      st.look[cat] = pick(ok);
    }
    st.look.pcolor = Math.random() < 0.5 ? null : pick(['#c2611c', '#7a4a2e', '#3a3646', '#5b3a2b', '#8a8f9e', '#e8873a']);
    st.look.pcolor2 = '#3a3646';
    this.lookChanged();
  }
  lookChanged() { sfx('meow'); this.refreshAll(); }
  toggleCostumeShow() { this.st.costumes.show = !this.st.costumes.show; this.lookChanged(); }
  setCostume(id) { this.st.costumes.current = id; this.st.costumes.show = !!COSTUME_BY_ID[id].look; this.lookChanged(); const H = this.battle.hero; if (H) this.battle.fx.burst(H.x, H.y - 60, { count: 50, color: ['#ffd23f', '#ff7ae0', '#ffffff'], speed: 160, up: 80, size: 10, life: 0.9, shape: 'star' }); }
  costumeSource(id) {
    const s = COSTUME_BY_ID[id].src;
    if (s.includes('Ninja')) this.showProduct('ninja');
    else if (s.includes('Cyber')) this.showProduct('cyber');
    else if (s.includes('Baleine')) this.showProduct('whale');
    else if (s.includes('VIP')) this.ui.open('shop', 'vip');
    else if (s.includes('arène')) this.ui.open('combat', 'arena');
    else if (s.includes('Gouttières')) this.ui.open('combat', 'war');
    else if (s.includes('Passe')) this.ui.open('shop', 'pass');
    else if (s.includes('Connexion')) this.ui.open('quests', 'login');
    else if (s.includes('Arbre')) this.ui.open('combat', 'tower');
  }

  // ------------------------------------------------------------------ atelier
  atelierDot() { return SETS.some((S) => this.st.hero.lvl >= S.lvl && this.st.artisan.lvl >= S.artisan && S.cost.every(([id, n]) => (this.st.mats[id] || 0) >= n)) || this.st.res.clover > 0 && this.st.boost.cloverUntil < Date.now(); }
  craftPiece(setId, slot) {
    const res = craft(this.st, setId, slot);
    if (!res) {
      const S = SET_BY_ID[setId];
      const miss = S.cost.filter(([id, n]) => (this.st.mats[id] || 0) < n).map(([id, n]) => `${RES_BY_ID[id].name} ${this.st.mats[id] || 0}/${n}`);
      sfx('error');
      this.ui.toast(miss.length ? 'Il manque : ' + miss.join(', ') : 'Or ou niveau insuffisant', 'warn');
      return;
    }
    sfx('legendary');
    if (res.ups) this.ui.toast(`Artisan niveau ${this.st.artisan.lvl} !`, 'gold');
    this.ui.showItem(res.it, () => this.refreshAll(), false);
    if (res.perfect) this.ui.toast('JET PARFAIT !', 'gold');
    this.refreshAll();
  }
  forgeItem(it) {
    const r = forge(this.st, it, this.useStone, this.useScroll);
    if (!r) { sfx('error'); this.ui.toast('Pas assez de runes ou d\'or', 'warn'); return; }
    const box = this.ui.sheetEl.querySelector('.forge-box');
    if (r.ok) { sfx('legendary'); this.ui.toast(`Forgemagie réussie : +${r.upg} !`, 'gold'); box && box.classList.add('forge-ok'); }
    else { sfx('defeat'); this.ui.toast(r.down ? `Échec… l'objet redescend à +${r.upg}` : 'Échec de la forgemagie', 'warn'); box && box.classList.add('forge-ko'); }
    setTimeout(() => this.refreshAll(), 450);
  }
  useClover() {
    if (this.st.res.clover < 1) return;
    this.st.res.clover--;
    this.st.boost.cloverUntil = Math.max(Date.now(), this.st.boost.cloverUntil) + 3600000;
    sfx('buy'); this.ui.toast('Trèfle actif : butin x2 pendant 1 h !', 'gold');
    this.refreshAll();
  }

  // ------------------------------------------------------------------ marché
  marketDot() { return this.st.market.log.some((l) => l.t > (this.st.market.seenLog || 0)); }
  marketBuy(id, lot) { const r = buyLot(this.st, id, lot); if (r.err) { sfx('error'); this.ui.toast(r.err, 'warn'); return; } sfx('coin'); this.ui.toast(`Acheté : ${RES_BY_ID[id].name} x${lot} (${fmt(r.price)} or)`); this.ui.refresh(); }
  marketList(id, lot, price) { const r = listLot(this.st, id, lot, price); if (r.err) { sfx('error'); this.ui.toast(r.err, 'warn'); return; } sfx('coin'); this.ui.toast(`Mis en vente (taxe ${fmt(r.tax)} or)`); this.sellPrice = 0; this.ui.refresh(); }
  marketCancel(uid) { cancelListing(this.st, uid); this.ui.refresh(); }
  marketQuickSell(id, n) { const g = quickSell(this.st, id, n); if (g) { sfx('coin'); this.ui.toast(`+${fmt(g)} or`); } this.sellPrice = 0; this.ui.refresh(); }
  sellGems(n) { const g = sellGems(this.st, n); if (g) { sfx('coin'); this.ui.toast(`${n} gemmes → ${fmt(g)} or`, 'gold'); } this.ui.refresh(); }
  buyGems(n) { const r = buyGems(this.st, n); if (r.err) { sfx('error'); this.ui.toast(r.err, 'warn'); return; } sfx('buy'); this.ui.toast(`+${r.n} gemmes (${fmt(r.cost)} or)`, 'gold'); this.ui.refresh(); }

  // ------------------------------------------------------------------ récompenses
  previewRewards(r) {
    const out = [];
    for (const k in r) {
      const v = r[k];
      if (!v) continue;
      if (k === 'gold') out.push({ k: 'gold', v: Math.round(idleRate(this.st, this.stats).gold * v) });
      else if (k === 'goldRaw') out.push({ k: 'gold', v });
      else if (k === 'speedH') out.push({ k: 'speedMin', v: v * 60 });
      else if (k === 'speedM') out.push({ k: 'speedMin', v });
      else out.push({ k, v });
    }
    return out;
  }
  give(rewards, title, big, silent) {
    const list = grant(this.st, rewards);
    autoEquipArtifacts(this.st, artifactSlots(this.stats.vip));
    this.recalc();
    if (silent) { this.ui.toast(title + ' : ' + list.map((r) => this.ui.rewardText(r)).join(', '), 'gold'); this.ui.renderGear(); this.ui.refresh(); }
    else { this.ui.rewards(list, title, { big }); this.refreshAll(); }
    return list;
  }
  idleRate() { return idleRate(this.st, this.stats); }
  claimIdle(mult) {
    const p = idlePending(this.st, this.stats);
    this.st.idleSince = Date.now();
    this.give({ goldRaw: p.gold * mult, yarn: p.yarn * mult }, mult > 1 ? 'Butin doublé !' : 'Butin récolté');
  }

  // ------------------------------------------------------------------ achats (simulés)
  monthSpent() { return this.st.iap.months[monthKey()] || 0; }
  productValue(id) {
    const p = PRODUCTS[id];
    if (!p.rewards) return 0;
    let v = 0;
    for (const k in p.rewards) {
      if (k === 'costume') v += 2500 * COSTUME_BY_ID[p.rewards[k]].r;
      else if (k === 'kitten') v += 400 * (KITTEN_BY_ID[p.rewards[k]].r + 1);
      else if (k === 'skill' || k === 'look') v += 1500;
      else v += (GEM_VALUE[k] || 0) * p.rewards[k];
    }
    return v / ((p.price / 100) * 66);
  }
  showProduct(id, flash) {
    const p = PRODUCTS[id];
    const ui = this.ui, st = this.st;
    const first = p.kind === 'gems' && !st.iap.bought[id];
    let content;
    if (p.kind === 'gems') content = h('div.rewards', null, ui.rewardChip({ k: 'gems', v: p.gems * (first ? 2 : 1) }));
    else if (p.rewards) content = h('div.rewards', null, this.previewRewards(p.rewards).map((r) => ui.rewardChip(r)));
    else if (p.kind === 'pass') content = h('p', null, id === 'pass_deluxe' ? 'Toutes les récompenses premium, +10 paliers immédiats et 5 000 pelotes. Costume Capitaine Moustache au palier 30.' : 'Toutes les récompenses premium du Passe Royal. Costume Capitaine Moustache au palier 30.');
    else content = h('p', null, p.desc);
    const val = this.productValue(id);
    const body = h('div.product', null,
      p.tag ? h('span.ptag', null, p.tag) : null, content,
      val > 3 ? h('div.pval.big', null, `x${Math.round(val)} de valeur !`) : null,
      first ? h('div.pval.big', null, 'Premier achat : gemmes x2') : null,
      flash && st.iap.flash ? h('p.center.timer', null, 'Expire dans ', h('b', { dataset: { until: st.iap.flash.until } }, '')) : null,
      h('p.vip-pts', { html: `${icon('crown')} +${p.price} points VIP` }),
      st.iap.firstRecharge === 0 ? h('p.center.good.small', null, '+ Bonus de premier achat : Laser Oculaire, chaton Drakou et plus !') : null,
    );
    ui.modal({ title: p.name, body, cls: 'product-modal' + (flash ? ' flash' : ''), rays: flash || p.price >= 4999 ? '#ffb52e' : null, buttons: [{ label: 'Acheter ' + (p.price / 100).toFixed(2).replace('.', ',') + ' €', cls: 'green', fn: () => { this.purchase(id); } }] });
    setTimeout(() => ui.tickTimers(), 0);
  }
  purchase(id) {
    const p = PRODUCTS[id];
    const st = this.st;
    if ((p.kind === 'once' && st.iap.bought[id]) || (p.kind === 'daily' && st.iap.daily[id]) || (p.kind === 'weekly' && st.iap.weekly[id])) { this.ui.toast('Déjà acheté'); return; }
    if (id === 'noads' && st.iap.noads) return;
    if (id === 'fund' && st.iap.fund) return;
    if (p.kind === 'pass' && st.iap.pass >= (id === 'pass_deluxe' ? 2 : 1)) return;
    if (st.settings.capCents && this.monthSpent() + p.price > st.settings.capCents) {
      this.ui.modal({ title: 'Limite de dépenses', body: h('p.center', null, 'Cet achat dépasserait votre limite mensuelle. Vous pouvez la modifier dans les Paramètres.'), buttons: [{ label: 'OK', cls: 'blue' }] });
      return;
    }
    const close = this.ui.modal({ title: 'Paiement sécurisé', body: h('div.paying', null, h('i.spinner'), h('p', null, 'Paiement simulé en cours…'), h('p.muted.small', null, 'Aucun paiement réel. Branchez Google Play Billing / App Store pour la version publiée.')), noClose: true });
    setTimeout(() => { close(); this.applyPurchase(id); }, 900);
  }
  applyPurchase(id) {
    const p = PRODUCTS[id];
    const st = this.st;
    const oldVip = vipLevel(st.iap.vip);
    st.iap.spent += p.price;
    st.iap.vip += p.price;
    st.iap.months[monthKey()] = this.monthSpent() + p.price;
    st.iap.bought[id] = (st.iap.bought[id] || 0) + 1;
    const rewards = {};
    if (p.kind === 'gems') rewards.gems = p.gems * (st.iap.bought[id] === 1 ? 2 : 1);
    else if (p.rewards) Object.assign(rewards, p.rewards);
    if (p.kind === 'daily') st.iap.daily[id] = true;
    if (p.kind === 'weekly') st.iap.weekly[id] = true;
    if (p.kind === 'flash') st.iap.flash = null;
    if (id === 'monthly') { st.iap.monthlyUntil = Math.max(Date.now(), st.iap.monthlyUntil) + 30 * 864e5; rewards.gems = 300; st.daily.cardGems = true; }
    if (id === 'noads') st.iap.noads = true;
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
      if (to >= 8 && !st.costumes.owned.includes('pharaoh')) this.give({ costume: 'pharaoh' }, 'Cadeau VIP 8', true);
      if (to >= 12 && !st.costumes.owned.includes('lion')) this.give({ costume: 'lion' }, 'Cadeau VIP 12', true);
      autoEquipSkills(st); autoEquipKittens(st);
      this.recalc();
    }, 1200);
  }
  claimFirstRecharge() { if (this.st.iap.firstRecharge !== 1) return; this.st.iap.firstRecharge = 2; this.ui.closeSheet(); this.give(FIRST_RECHARGE, 'Bonus de premier achat !', true); }
  claimFreeGift() { if (this.st.daily.freeGift) return; this.st.daily.freeGift = true; this.give({ yarn: 300, gems: 20 }, 'Cadeau du jour'); }
  exchanges() { return EXCHANGES; }
  exchange(id) { const x = EXCHANGES.find((e) => e.id === id); if (!this.spendGems(x.gems)) return; this.give(x.rewards, 'Échange réussi'); }
  relicPull(n) {
    const st = this.st;
    if (st.res.relicKeys >= n) st.res.relicKeys -= n;
    else if (!this.spendGems(n === 1 ? RELIC_CHEST.cost1 : RELIC_CHEST.cost10)) return;
    const out = relicPull(st, n);
    const sum = {};
    const relics = [];
    for (const o of out) { if (o.relic) relics.push(o.relic); else for (const k in o.rewards) sum[k] = (sum[k] || 0) + o.rewards[k]; }
    grant(st, sum);
    const list = [...relics.map((it) => ({ k: 'relic', v: it.relic })), ...this.previewRewards(sum)];
    if (relics.length) { this.ui.banner('RELIQUE !', 'Elle vous attend dans le sac', 'vip'); this.battle.flash('#fff27a', 0.6); }
    this.ui.rewards(list, relics.length ? 'RELIQUE OBTENUE !' : 'Coffre des Reliques', { big: relics.length > 0 });
    this.refreshAll();
  }
  fundClaimable() { return this.st.iap.fund && FUND_TIERS.some((f, i) => this.st.camp.best >= f.stage && !this.st.iap.fundClaimed.includes(i)); }
  claimFund(i) { const st = this.st; if (!st.iap.fund || st.iap.fundClaimed.includes(i) || st.camp.best < FUND_TIERS[i].stage) return; st.iap.fundClaimed.push(i); this.give({ gems: FUND_TIERS[i].gems }, 'Fonds de croissance'); }
  passClaimable() { const st = this.st, t = passTier(st); return PASS_TIERS.some((p) => p.t <= t && (!st.pass.free.includes(p.t) || (st.iap.pass && !st.pass.prem.includes(p.t)))); }
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
    if (n) this.give(sum, 'Passe Royal', !!sum.costume);
  }
  claimPass(t, prem) {
    const st = this.st;
    if (passTier(st) < t) return;
    const tier = PASS_TIERS[t - 1];
    if (prem) { if (!st.iap.pass || st.pass.prem.includes(t)) return; st.pass.prem.push(t); this.give(tier.prem, 'Passe Royal', !!tier.prem.costume); }
    else { if (st.pass.free.includes(t)) return; st.pass.free.push(t); this.give(tier.free, 'Passe Royal'); }
  }
  vipGiftClaimable() { return this.stats.vip > 0 && !this.st.daily.vipGift; }
  claimVipGift() { if (!this.vipGiftClaimable()) return; this.st.daily.vipGift = true; this.give({ gems: VIP_PERKS[this.stats.vip].dailyGems, yarn: this.stats.vip * 150 }, 'Coffre VIP'); }

  // ------------------------------------------------------------------ quêtes
  dailyClaimable() { const d = this.st.daily; return DAILY_QUESTS.some((q) => d.q[q.id] >= q.goal && !d.qDone.includes(q.id)) || DAILY_CHESTS.some((c, i) => d.pts >= c.pts && !d.chests.includes(i)); }
  loginClaimable() { return this.st.login.lastKey !== dayKey(); }
  achValue(a) { const st = this.st; return a.kind === 'stage' ? st.camp.best : a.kind === 'level' ? st.hero.lvl : a.kind === 'opens' ? st.stats.opens : st.tower.floor - 1; }
  achClaimable() { return ACHIEVEMENTS.some((a) => !this.st.ach.includes(a.id) && this.achValue(a) >= a.goal); }
  questsClaimable() { return this.dailyClaimable() || this.loginClaimable() || this.achClaimable(); }
  claimQuest(id) {
    const d = this.st.daily, q = DAILY_QUESTS.find((x) => x.id === id);
    if (d.qDone.includes(id) || d.q[id] < q.goal) return;
    d.qDone.push(id); d.pts = Math.min(100, d.pts + q.pts); addPassXp(this.st, q.pts);
    sfx('coin'); this.ui.refresh();
  }
  claimChest(i) { const d = this.st.daily; if (d.chests.includes(i) || d.pts < DAILY_CHESTS[i].pts) return; d.chests.push(i); this.give(DAILY_CHESTS[i].rewards, `Coffre d'activité ${DAILY_CHESTS[i].pts}`); }
  claimLogin() { const L = this.st.login; if (!this.loginClaimable()) return; const r = LOGIN_CALENDAR[L.claimed % 7]; L.claimed++; L.lastKey = dayKey(); this.give(r, `Connexion — jour ${((L.claimed - 1) % 7) + 1}`, !!r.costume); }
  claimAch(id) { const a = ACHIEVEMENTS.find((x) => x.id === id); if (this.st.ach.includes(id) || this.achValue(a) < a.goal) return; this.st.ach.push(id); this.give({ gems: a.gems }, 'Objectif atteint'); }
  onNewDay() {
    const st = this.st, g = {};
    if (st.iap.monthlyUntil > Date.now()) g.gems = (g.gems || 0) + 100;
    if (g.gems && !st.daily.cardGems) { st.daily.cardGems = true; setTimeout(() => this.give(g, 'Gemmes quotidiennes des cartes'), 1500); }
  }

  // ------------------------------------------------------------------ pubs simulées
  watchAd(cb) {
    const st = this.st;
    if (st.daily.ads >= this.adLimit()) { this.ui.toast('Plus de vidéos aujourd\'hui', 'warn'); return; }
    const done = () => { st.daily.ads++; bumpQuest(st, 'ad', 1); cb(); this.ui.refresh(); };
    if (st.iap.noads) { done(); return; }
    let left = 3;
    const cnt = h('b.ad-count', null, String(left));
    const close = this.ui.modal({ title: 'Vidéo bonus', body: h('div.ad-fake', null, h('div.ad-screen', null, h('img', { src: this.costumeURL('galaxy'), alt: '' }), h('span', null, 'Votre publicité ici')), h('p', null, 'Récompense dans ', cnt, ' s'), h('p.muted.small', null, 'Simulation : intégrez une régie (AdMob, AppLovin…) pour de vraies vidéos.')), noClose: true });
    const iv = setInterval(() => { left--; cnt.textContent = String(left); if (left <= 0) { clearInterval(iv); close(); done(); } }, 1000);
  }
  grantAd(i) { this.give(AD_REWARDS[i], 'Bonus vidéo'); }
  adLimit() { return this.st.iap.noads ? AD_LIMIT_NOADS : AD_LIMIT; }

  // ------------------------------------------------------------------ donjons / tour
  combatDot() { return this.st.tower.floor <= 3 || (this.st.lairs.tickets > 0 && this.st.camp.best >= 10) || (!this.st.daily.towerDaily && this.st.tower.best > 0) || DUNGEONS.some((d) => this.st.dungeons[d.id].keys > 0) || this.st.arena.tickets > 0 || this.arenaDailyClaimable() || this.st.war.energy > 0 || tributeAvailable(this.st); }
  startDungeon(id) {
    const ds = this.st.dungeons[id];
    if (ds.keys <= 0) return;
    const d = DUNGEONS.find((x) => x.id === id);
    ds.keys--;
    let refunded = false;
    const refund = () => { if (!refunded) { refunded = true; ds.keys++; } };
    this.startSpecial({ id, mode: 'dungeon', title: d.name, sub: 'Niveau ' + ds.lvl, banner: `${d.name} — niv. ${ds.lvl}`, onQuit: refund, onEnd: (win) => {
      if (win) { const r = dungeonReward(id, ds.lvl, this.st.camp.best); ds.lvl++; bumpQuest(this.st, 'dungeon', 1); this.give(r, 'Donjon terminé !'); this.maybeWildKitten(0.05); }
      else { refund(); this.defeatModal('Le donjon résiste… Votre clé a été rendue.'); }
    } }, { mode: 'dungeon', waves: dungeonWaves(id, ds.lvl, d.enemy), minions: [d.enemy] }, id === 'gold' ? 'desert' : id === 'yarn' ? 'factory' : 'jungle');
  }
  sweepDungeon(id) { const ds = this.st.dungeons[id]; if (ds.keys <= 0 || ds.lvl <= 1) return; ds.keys--; bumpQuest(this.st, 'dungeon', 1); this.give(dungeonReward(id, ds.lvl - 1, this.st.camp.best), 'Balayage'); }
  buyDungeonKey(id) { const ds = this.st.dungeons[id]; if (ds.buys >= VIP_PERKS[this.stats.vip].dungeonBuys) return; if (!this.spendGems(100 * (ds.buys + 1))) return; ds.buys++; ds.keys++; sfx('coin'); this.ui.refresh(); }
  startTower(revive) {
    const st = this.st, f = st.tower.floor;
    const info = towerFloorInfo(f);
    const tw = towerWaves(f, info.mods);
    const buff = revive ? 0.5 : 0;
    this.startSpecial({ mode: 'tower', title: 'Tour des Défis', sub: 'Étage ' + f + (info.mods.length ? ' · ' + info.mods.map((m) => m.name).join(' + ') : ''), banner: `Tour — étage ${f}${info.mods.length ? ' · ' + info.mods[0].name : ''}`, onEnd: (win) => {
      if (win) {
        st.tower.floor++;
        st.tower.best = Math.max(st.tower.best, f);
        bumpQuest(st, 'tower', 1);
        const R = towerRewards(f);
        const all = { ...R.base };
        if (R.milestone) for (const k in R.milestone) all[k] = typeof R.milestone[k] === 'number' ? (all[k] || 0) + R.milestone[k] : R.milestone[k];
        if (R.milestone) this.give(all, `Palier ${f} atteint !`, true);
        else this.give(all, `Étage ${f} conquis !`, false, f % 5 !== 0);
        this.checkTitles();
      } else {
        const body = h('div.col.center', null, h('p', null, `L'étage ${f} vous résiste…`), h('p.small.muted', null, 'Second souffle : réessayez tout de suite avec +50 % d\'ATQ pour cet essai.'));
        this.ui.modal({ title: 'Défaite', body, buttons: [{ label: 'Second souffle', sub: `${icon('gems')} ${TOWER_REVIVE_GEMS}`, cls: 'purple', fn: () => { if (this.spendGems(TOWER_REVIVE_GEMS)) setTimeout(() => this.startTower(true), 50); } }, { label: 'Abandonner', cls: 'blue' }] });
      }
    } }, { mode: 'tower', ...tw, mods: info.mods, reviveBuff: buff }, tw.biome, tw.variant);
  }
  // Récompense quotidienne de la Tour : selon le record (remplace l'ancien balayage)
  towerDailyInfo() {
    const b = this.st.tower.best;
    return { towerTokens: 20 + Math.floor(b * 0.8), artDust: 10 + Math.floor(b / 2), gold: Math.round(killGold(Math.max(0, this.st.camp.best - 5)) * (20 + b)) };
  }
  towerSweep() {
    const st = this.st;
    if (st.daily.towerDaily) { this.ui.toast('Déjà récupérée aujourd\'hui. Revenez demain !'); return; }
    if (st.tower.best < 1) { this.ui.toast('Conquérez au moins un étage pour débloquer la récompense du jour.'); return; }
    st.daily.towerDaily = true;
    this.give(this.towerDailyInfo(), `Récompense du jour (record ${st.tower.best})`);
  }
  // ------------------------------------------------------------------ repaires de boss
  lairList() {
    const beaten = Math.floor(this.st.camp.best / 10);
    return BIOMES.map((b, i) => ({ biome: b.id, name: b.name, ch: i + 1, B: BIOME_BOSS[b.id], open: beaten >= i + 1 }));
  }
  lairStage() { return Math.max(5, this.st.camp.best - 8); }
  startLair(biome) {
    const L = this.st.lairs;
    if (L.tickets <= 0) { sfx('error'); this.ui.toast('Plus de tickets de repaire aujourd\'hui', 'warn'); return; }
    const B = BIOME_BOSS[biome];
    L.tickets--;
    let refunded = false;
    const refund = () => { if (!refunded) { refunded = true; L.tickets++; } };
    const variant = this.era().variant;
    const lw = lairWaves(biome, this.lairStage(), variant);
    this.startSpecial({ mode: 'lair', title: 'Repaire', sub: B.name, banner: `Repaire — ${B.name}`, onQuit: refund, onEnd: (win) => {
      if (win) {
        const r = { [B.drop]: 1, gold: Math.round(killGold(this.lairStage()) * 30) };
        if (Math.random() < 0.15) r.frags = 2 + Math.floor(Math.random() * 3);
        bumpQuest(this.st, 'dungeon', 1);
        this.give(r, `${B.name} vaincu !`);
      } else { refund(); this.defeatModal('Le boss vous a repoussé… Votre ticket a été rendu.'); }
    } }, { mode: 'lair', ...lw }, biome, variant);
  }
  buyLairTicket() {
    const L = this.st.lairs;
    if (L.buys >= VIP_PERKS[this.stats.vip].dungeonBuys) { this.ui.toast('Limite d\'achats atteinte : montez de niveau VIP pour en acheter plus', 'vip'); return; }
    if (!this.spendGems(lairBuyCost(L.buys))) return;
    L.buys++; L.tickets++; sfx('coin'); this.ui.refresh();
  }
  towerShopBuy(id) {
    const st = this.st, a = TOWER_SHOP.find((x) => x.id === id), n = st.tower.shop[id] || 0;
    if (n >= a.limit) return;
    if (st.res.towerTokens < a.cost) { sfx('error'); this.ui.toast('Pas assez de jetons de défi', 'warn'); return; }
    st.res.towerTokens -= a.cost; st.tower.shop[id] = n + 1;
    this.give(a.rewards, 'Boutique de la Tour');
  }
  defeatModal(msg) {
    const body = h('div.col', null, h('p.center', null, msg), h('p.muted.small.center', null, 'Pour devenir plus fort : ouvrez des cartons, forgez votre équipement, fabriquez une panoplie et adoptez des chatons.'));
    this.ui.modal({ title: 'Défaite', body, buttons: [{ label: 'Atelier', cls: 'blue', fn: () => this.ui.open('atelier') }, { label: 'Offres', cls: 'gold', fn: () => this.ui.open('shop', 'offers') }] });
  }

  // ------------------------------------------------------------------ PvP : rival générique
  rivalDef(name, power, loadout, vip) {
    const S = statsFromPower(power, this.stats);
    const tierSkills = SKILLS.filter((s) => s.mult && s.r <= Math.min(6, 2 + Math.floor(Math.log10(Math.max(10, power)) / 2)));
    const skills = [pick(tierSkills), pick(tierSkills)].filter((v, i, a) => a.indexOf(v) === i).map((s) => ({ ...s, lvl: 1, lm: 1 }));
    const kittens = loadout.kittens.map((id) => { const k = KITTEN_BY_ID[id]; return { id: k.id, name: k.name, el: k.el, r: k.r, look: k.look, mult: [0.25, 0.35, 0.5, 0.7, 1, 1.5, 2.3, 3.5, 5.5][k.r] }; });
    const auras = ['sparkle', 'flames', 'frost', 'thunder', 'shadow', 'rainbow', 'galaxy'];
    const aura = vip >= 3 ? auras[Math.min(auras.length - 1, Math.floor(vip / 2))] : null;
    return { name, appearance: loadout.ap, gear: loadout.gear, stats: { ...S, hp: S.hp * 1.05, crit: 10, critDmg: 60, combo: 4, counter: 3, dodge: 3, lifesteal: 0, stun: 0, kitDmg: 0 }, skills, kittens, weaponColor: RCOL[loadout.gear.weapon.r], perks: {}, vip, aura };
  }
  arenaBoard() { return arenaBoard(this.st, this.stats); }
  arenaOpponents() { return arenaOpponents(this.st, this.stats); }
  arenaFight(botId) {
    const st = this.st;
    if (st.arena.tickets <= 0) { this.ui.toast('Plus de tickets d\'arène', 'warn'); return; }
    const opp = this.arenaBoard().find((x) => x.id === botId);
    st.arena.tickets--;
    bumpQuest(st, 'arena', 1);
    const oldRank = myRank(st);
    const rival = this.rivalDef(opp.name, opp.power, botLoadout(opp.bot), opp.vip);
    this.startSpecial({ mode: 'arena', title: 'Arène', sub: 'vs ' + opp.name, banner: `Arène — ${opp.name}`, onEnd: (win) => {
      const newRank = win ? arenaSwap(st, botId) : oldRank;
      st.res.arenaCoins += win ? 30 : 10;
      if (win) st.stats.arenaWins++;
      const body = h('div.col.center', null, h('div.arena-res', { cls: win ? 'win' : 'lose' }, win ? 'VICTOIRE' : 'DÉFAITE'), h('p', null, `Rang : #${oldRank} → #${newRank}`), h('div.rewards', null, this.ui.rewardChip({ k: 'arenaCoins', v: win ? 30 : 10 })));
      this.ui.modal({ title: 'Arène', body, buttons: [{ label: 'Rejouer', cls: 'gold', fn: () => this.ui.open('combat', 'arena') }, { label: 'OK', cls: 'blue' }], rays: win ? '#ffd23f' : null });
    } }, { mode: 'arena', rival }, 'arena');
  }
  buyArenaTicket() {
    const st = this.st;
    if (st.arena.buys >= VIP_PERKS[this.stats.vip].arenaBuys) { this.ui.toast(`Achats de tickets max atteints (VIP ${this.stats.vip})`, 'vip'); return; }
    if (!this.spendGems(50 + st.arena.buys * 25)) return;
    st.arena.buys++; st.arena.tickets++; sfx('coin'); this.ui.refresh();
  }
  arenaDailyClaimable() { return this.st.arena.claimedKey !== dayKey() && myRank(this.st) < 100; }
  claimArenaDaily() { if (!this.arenaDailyClaimable()) return; const rank = myRank(this.st); this.st.arena.claimedKey = dayKey(); this.give({ gems: arenaDailyGems(rank), arenaCoins: 300 - Math.min(250, rank * 3) }, `Récompense rang #${rank}`); }
  arenaShopBuy(id) {
    const st = this.st, a = ARENA_SHOP.find((x) => x.id === id), n = st.arena.shop[id] || 0;
    if (n >= a.limit) return;
    if (st.res.arenaCoins < a.cost) { sfx('error'); this.ui.toast('Pas assez de médailles', 'warn'); return; }
    st.res.arenaCoins -= a.cost; st.arena.shop[id] = n + 1;
    this.give(a.rewards, 'Boutique d\'arène', !!a.rewards.costume);
  }

  // ------------------------------------------------------------------ Guerre des Gouttières
  handleWarEvents(events) {
    for (const e of events) {
      if (e.season) { const r = warSeasonReward(e.place); setTimeout(() => this.give(r, `Guerre des Gouttières : ${e.place}e place`, e.place === 1), 2000); }
      else if (e.capture && e.from === 'me') this.ui.toast(`${CLAN_BY_ID[e.by].name} vous ont pris « ${TERRITORIES.find((t) => t.id === e.t).name} » !`, 'warn');
    }
  }
  warTerritory(tid) {
    const st = this.st, t = TERRITORIES.find((x) => x.id === tid), T = st.war.terr[tid];
    if (T.owner === 'me') { this.ui.toast(`« ${t.name} » appartient à votre clan (+${t.pts} pts/h)`); return; }
    const power = defenderPower(st, t);
    const lo = defenderLoadout(st, t);
    const body = h('div.col.center', null,
      h('img.def-face', { src: catPortraitURL(lo.ap, lo.gear, 110), alt: '' }),
      h('p', null, `${defenderName(st, t)} garde « ${t.name} » pour les ${CLAN_BY_ID[T.owner].name}.`),
      h('p', { html: `${icon('power')} ${fmt(power)} · gardiens restants : ${T.hp}/3` }),
      h('p.small.muted', null, `Victoire : +12 écussons, +2 insignes. Capture : +${t.pts * 10} points de clan.`));
    this.ui.modal({ title: t.name, body, buttons: [{ label: 'Attaquer', sub: `${icon('combat')} 1 énergie (${st.war.energy})`, cls: power < this.stats.power ? 'green' : 'red', disabled: st.war.energy <= 0, fn: () => this.warAttack(tid) }] });
  }
  warAttack(tid) {
    const st = this.st, w = st.war, t = TERRITORIES.find((x) => x.id === tid), T = w.terr[tid];
    if (w.energy <= 0) { this.ui.toast('Plus d\'énergie de guerre', 'warn'); return; }
    w.energy--;
    bumpQuest(st, 'war', 1);
    const rival = this.rivalDef(defenderName(st, t), defenderPower(st, t), defenderLoadout(st, t), 0);
    this.startSpecial({ mode: 'war', title: 'Guerre des Gouttières', sub: t.name, banner: `Gouttières — ${t.name}`, onEnd: (win) => {
      if (!win) { this.defeatModal('Le gardien vous a repoussé du toit !'); return; }
      T.hp--;
      w.wins++;
      const rw = { warCoins: 12, gutterBadge: 2 };
      let title = 'Gardien vaincu !';
      if (T.hp <= 0) { T.owner = 'me'; T.hp = 3; T.seed = Math.floor(Math.random() * 1e9); w.points.me += t.pts * 10; rw.warCoins += 30; rw.gems = 50; title = `« ${t.name} » capturé !`; }
      this.give(rw, title, T.owner === 'me');
    } }, { mode: 'war', rival }, 'roofs');
  }
  warBuyEnergy() { const st = this.st; if (!this.spendGems(warBuyCost(st))) return; st.war.buys++; st.war.energy++; sfx('coin'); this.ui.refresh(); }
  claimTribute() {
    const st = this.st;
    if (!tributeAvailable(st)) return;
    st.war.tributeKey = dayKey();
    const n = ownedTerritories(st).reduce((a, t) => a + t.pts, 0);
    this.give({ gold: n * 0.5, gutterBadge: n * 2, warCoins: n * 5 }, 'Tribut des toits');
  }
  warShopBuy(id) {
    const st = this.st, a = WAR_SHOP.find((x) => x.id === id), n = st.war.shop[id] || 0;
    if (n >= a.limit) return;
    if (st.res.warCoins < a.cost) { sfx('error'); this.ui.toast('Pas assez d\'écussons', 'warn'); return; }
    st.res.warCoins -= a.cost; st.war.shop[id] = n + 1;
    this.give(a.rewards, 'Boutique de guerre', !!a.rewards.costume);
  }

  // ------------------------------------------------------------------ artefacts
  artifactPull(n) {
    const st = this.st;
    if (n === 1 && !st.daily.artFree) st.daily.artFree = true;
    else if (!this.spendGems(n === 1 ? ARTIFACT_CHEST.cost1 : ARTIFACT_CHEST.cost10)) return;
    const out = artifactChest(st, n);
    autoEquipArtifacts(st, artifactSlots(this.stats.vip));
    const best = Math.max(...out.map((o) => o.a.r));
    sfx(best >= 6 ? 'legendary' : 'epic');
    const body = h('div.summon-res', null, out.map((o, i) => h('div.sres', { cls: 'r' + o.a.r, style: { '--rc': RARITIES[o.a.r].color, '--rd': RARITIES[o.a.r].dark, animationDelay: i * 0.05 + 's' } }, h('span.sk-ic', { html: this.ui.artIcon(o.a) }), h('b', null, `${o.a.name} x${o.k}`), o.unlocked ? h('i.new-tag', null, 'DÉBLOQUÉ') : null)));
    this.ui.modal({ title: 'Coffre d\'artefacts', body, buttons: [{ label: 'Encore x' + n, cls: 'gold', fn: () => { setTimeout(() => this.artifactPull(n), 60); } }, { label: 'OK', cls: 'blue' }], rays: best >= 6 ? RARITIES[best].color : null });
    this.refreshAll();
  }
  artifactLevel(id, times) { const k = artifactLevelUp(this.st, id, times); if (!k) { sfx('error'); this.ui.toast('Pas assez de poussière ou d\'or', 'warn'); return; } sfx('equip'); this.refreshAll(); }
  artifactStar(id) { if (!artifactStarUp(this.st, id)) { sfx('error'); return; } sfx('legendary'); this.ui.toast(`${ARTIFACT_BY_ID[id].name} : ★ ${this.st.artifacts.owned[id].stars}`, 'gold'); this.refreshAll(); }
  equipArtifact(id) {
    const st = this.st, slots = artifactSlots(this.stats.vip), eq = st.artifacts.equipped;
    if (eq.slice(0, slots).includes(id)) return;
    let i = eq.slice(0, slots).findIndex((x) => !x);
    if (i < 0) i = slots - 1;
    eq[i] = id; sfx('equip'); this.refreshAll();
  }
  unequipArtifact(i) { this.st.artifacts.equipped[i] = null; this.refreshAll(); }

  // ------------------------------------------------------------------ style (cosmétiques)
  setAura(id) { this.st.cos.aura = this.st.cos.aura === id ? null : id; sfx('meow'); this.refreshAll(); }
  setTitle(id) { this.st.cos.title = id; sfx('click'); this.refreshAll(); }
  setFrame(id) { this.st.cos.frame = id; sfx('click'); this.ui.renderGear(); this.refreshAll(); }
  buyStyle(i) {
    const it = STYLE_SHOP[i], st = this.st;
    const owned = it.kind === 'aura' ? st.cos.auras.includes(it.id) : it.kind === 'frame' ? st.cos.frames.includes(it.id) : st.costumes.owned.includes(it.id);
    if (owned) return;
    if (!this.spendGems(it.gems)) return;
    this.give({ [it.kind]: it.id }, 'Nouveau style !', true);
  }
  checkTitles() {
    const st = this.st;
    const has = (k) => Object.values(st.kittens.owned).length >= k;
    const conds = {
      claw: st.camp.best >= 20, ratHunter: st.stats.kills >= 1000, climber: st.tower.best >= 25, artisan: st.artisan.lvl >= 20,
      forgemage: [...Object.values(st.gear), ...st.bag].some((x) => x && (x.upg || 0) >= 10), tamer: has(25), baron: st.stats.sold >= 100,
      conqueror: st.tower.best >= 100, nightmare: this.era().e >= 2, infernal: this.era().e >= 3, unstoppable: st.tower.best >= 250,
      emperor: this.stats.vip >= 15, primordial: Object.keys(st.kittens.owned).some((id) => KITTEN_BY_ID[id] && KITTEN_BY_ID[id].r >= 8), arenaLegend: st.arena.best <= 3,
    };
    for (const id in conds) if (conds[id] && !st.cos.titles.includes(id)) { st.cos.titles.push(id); this.ui.toast(`Nouveau titre : « ${TITLE_BY_ID[id].name} » !`, 'gold'); sfx('levelup'); }
  }

  // ------------------------------------------------------------------ alchimie
  brew(id, n) { const k = brewPotion(this.st, id, n); if (!k) { sfx('error'); this.ui.toast('Ingrédients manquants', 'warn'); return; } sfx('heal'); this.ui.toast(`+${k} ${POTION_BY_ID[id].name}`, 'gold'); this.ui.refresh(); }
  drinkPotion(id) { if (!usePotion(this.st, id)) return; sfx('heal'); this.ui.toast(`${POTION_BY_ID[id].name} : ${POTION_BY_ID[id].desc}`, 'gold'); this.refreshAll(); }
  transmuteRes(id) { const out = transmute(this.st, id); if (!out) { sfx('error'); this.ui.toast('Pas assez de ressources', 'warn'); return; } sfx('legendary'); this.ui.toast(`Transmutation : +1 ${out.name} !`, 'gold'); this.ui.refresh(); }

  // ------------------------------------------------------------------ fidélité (recharge cumulée)
  loyaltyClaimable() { return LOYALTY.some((l, i) => this.st.iap.spent >= l.cents && !this.st.loyalty.includes(i)); }
  claimLoyalty(i) { const st = this.st, L = LOYALTY[i]; if (st.iap.spent < L.cents || st.loyalty.includes(i)) return; st.loyalty.push(i); this.give(L.rewards, 'Récompense de fidélité', true); }

  // ------------------------------------------------------------------ paramètres
  applyQuality() {
    const q = this.st.settings.quality === 'auto' ? this.autoQ.level : this.st.settings.quality;
    this.stage.setQuality(q);
    this.battle.fx.low = q === 'low';
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
    this.st = loadState(this.st);
    ensureMarket(this.st);
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
    if (st.tutorial === 1 && st.kittens.pulls > 0) st.tutorial = 2;
    if (st.tutorial === 2 && st.skills.pulls > 0) st.tutorial = 3;
    if (ui.modalRoot.children.length) { ui.tutorial(null); return; }
    if (st.tutorial === 0) ui.tutorial(ui.boxBtn, 'Touchez le carton !');
    else if (st.tutorial === 1 && st.res.eggs >= 1 && !(ui.sheet && ui.sheet.name === 'kittens')) ui.tutorial(ui.navBtns.kittens, 'Adoptez un chaton');
    else if (st.tutorial === 2 && st.res.feathers >= 1 && !(ui.sheet && ui.sheet.name === 'hero')) ui.tutorial(ui.navBtns.hero, 'Invoquez un pouvoir');
    else ui.tutorial(null);
  }

  // ------------------------------------------------------------------ boucle principale
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
    const aq = this.autoQ;
    aq.t += dt;
    if (aq.t > 4 && this.st.settings.quality === 'auto') {
      aq.t = 0;
      if (this.fps < 38 && aq.level !== 'low') { aq.level = aq.level === 'high' ? 'medium' : 'low'; this.applyQuality(); }
    }
    this.battle.update(dt);
    this.battle.render(dt);
    const B = this.battle;
    const boss = B.units.find((u) => u.boss && !u.dead);
    if (boss) this.onBossHp(Math.max(0, boss.hp / boss.maxHp), boss.hp);
    this.ui.updateSkillCds();
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
      if (this.sideT % 5 === 0) {
        const sold = tickMarket(this.st);
        for (const s of sold) this.ui.toast(`Vendu : ${RES_BY_ID[s.id].name} x${s.lot} (+${fmt(s.price)} or)`, 'gold');
        if (sold.length) sfx('coin');
      }
      if (this.sideT % 60 === 0) this.handleWarEvents(warTick(this.st));
      if (this.sideT % 7 === 0) this.checkTitles();
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
