// Simulateur d'équilibrage v4 : gratuit vs petit payeur vs baleine sur 30 jours
import { defaultState } from '../src/state.js';
import { computeStats } from '../src/stats.js';
import { openBoxes, summonSkills, summonKittens, train, grant, idleRate, levelUp, rollDrops, craft, forge, craftCheck } from '../src/economy.js';
import { quickFight, equippedSkills, equippedKittens } from '../src/combat.js';
import { campaignWaves, mapClearReward } from '../src/encounters.js';
import { boxUpgradeGold, boxUpgradeSeconds, BOX_MAX_LEVEL, VIP_PERKS, vipLevel, PRODUCTS, trainingCost, dungeonReward, ACHIEVEMENTS, FIRST_RECHARGE } from '../src/config.js';
import { SETS } from '../src/content.js';
import { classMech, SPEC_LEVEL } from '../src/classes.js';
import { pathToFileURL } from 'url';

function fightStage(st, s) {
  const S = computeStats(st);
  const v = VIP_PERKS[vipLevel(st.iap.vip)];
  const ch = Math.floor(s / 10) + 1, stg = (s % 10) + 1;
  let wins = 0;
  for (let i = 0; i < 3; i++) if (quickFight(S, equippedSkills(st, v.skillSlots), equippedKittens(st, v.kittenSlots), campaignWaves(ch, stg).waves, 90, classMech(st.hero.cls, st.hero.spec)).win) wins++;
  return wins >= 2;
}
function buy(st, id) {
  const p = PRODUCTS[id];
  st.iap.spent += p.price; st.iap.vip += p.price;
  if (p.gems) st.res.gems += p.gems;
  if (p.rewards) grant(st, p.rewards);
  if (id === 'noads') st.iap.noads = true;
  if (id === 'monthly') { st.iap.monthlyUntil = Date.now() + 30 * 864e5; st.res.gems += 300; }
  if (!st.iap.firstRecharge) { st.iap.firstRecharge = 2; grant(st, FIRST_RECHARGE); }
}
export function run(profile, days = 30, cls = 'botte', spec = 'duel', out = {}) {
  const st = defaultState();
  st.hero.cls = cls;
  out.st = st;
  let boxTimer = 0;
  const log = [];
  const ach = new Set();
  for (let d = 1; d <= days; d++) {
    if (profile === 'whale') {
      if (d === 1) { ['starter', 'ninja', 'cyber', 'whale', 'kittens', 'monthly', 'noads', 'fund', 'pass_deluxe'].forEach((x) => buy(st, x)); for (let i = 0; i < 4; i++) buy(st, 'gems_6'); }
      ['daily_1', 'daily_2', 'daily_3'].forEach((x) => buy(st, x));
      if (d % 7 === 1) ['weekly_1', 'weekly_2', 'forge', 'luck', 'relic_pack'].forEach((x) => buy(st, x));
      buy(st, 'gems_6');
      if (d % 2 === 0) buy(st, 'power_big');
    }
    if (profile === 'dolphin') {
      if (d === 1) { buy(st, 'starter'); buy(st, 'monthly'); buy(st, 'pass'); }
      if (d === 5) buy(st, 'ninja');
      buy(st, 'daily_1');
      if (d % 7 === 1) buy(st, 'weekly_1');
    }
    const r = idleRate(st);
    st.res.gold += r.gold * 20; st.res.yarn += r.yarn * 20;
    grant(st, { yarn: 1200, gems: 100, feathers: 8, eggs: 2, gold: 1 });
    grant(st, { yarn: 300, gems: 30, feathers: 2, eggs: 1 });
    st.res.speedMin += 30;
    st.res.gems += 120;
    if (st.iap.monthlyUntil) st.res.gems += 100;
    if (st.iap.lifetime) st.res.gems += 80;
    st.res.gems += VIP_PERKS[vipLevel(st.iap.vip)].dailyGems;
    for (const id of ['gold', 'yarn', 'feather']) for (let k = 0; k < 2; k++) grant(st, dungeonReward(id, Math.max(1, Math.floor(st.camp.best / 7)), st.camp.best));
    let secsToday = 86400;
    while (st.box.lvl < BOX_MAX_LEVEL) {
      const g = boxUpgradeGold(st.box.lvl);
      if (!boxTimer) { if (st.res.gold < g) break; st.res.gold -= g; boxTimer = boxUpgradeSeconds(st.box.lvl); }
      const use = Math.min(st.res.speedMin * 60, boxTimer); st.res.speedMin -= use / 60; boxTimer -= use;
      if (boxTimer > secsToday) {
        const skip = Math.ceil((boxTimer - secsToday) / 60);
        if (profile !== 'f2p' && st.res.gems > skip) { st.res.gems -= skip; boxTimer = secsToday; } else { boxTimer -= secsToday; secsToday = 0; break; }
      }
      secsToday -= boxTimer; boxTimer = 0; st.box.lvl++;
    }
    while (st.res.gems >= 900) { st.res.gems -= 900; st.res.feathers += 10; if (st.res.gems >= 700) { st.res.gems -= 700; st.res.eggs += 10; } if (st.res.gems >= 1100) { st.res.gems -= 1100; st.res.yarn += 2500; } }
    while (st.res.yarn > 0) openBoxes(st, Math.min(st.res.yarn, 1000), true);
    if (st.res.feathers >= 1) { summonSkills(st, Math.floor(st.res.feathers)); st.res.feathers = 0; }
    if (st.res.eggs >= 1) { summonKittens(st, Math.floor(st.res.eggs)); st.res.eggs = 0; }
    for (const id in st.skills.owned) while (levelUp(st.skills.owned[id]));
    for (const id in st.kittens.owned) while (levelUp(st.kittens.owned[id]));
    // craft avant l'entraînement : la meilleure panoplie possible, pièce par pièce
    for (const S of SETS.slice().reverse()) for (const slot of Object.keys(S.pieces)) { const c = craftCheck(st, S.id, slot); if (c.ok) { const res = craft(st, S.id, slot); if (res && (!st.gear[slot] || true)) { const cur = st.gear[slot]; st.gear[slot] = res.it; st.bag = st.bag.filter((x) => x.id !== res.it.id); } } }
    let guard = 0;
    while (guard++ < 5000) {
      const opts = ['atk', 'hp', 'def'].map((id) => [id, trainingCost(id, st.train[id])]).sort((a, b) => a[1] - b[1]);
      if (st.res.gold < opts[0][1] * 1.6) break;
      train(st, opts[0][0]);
    }
    let s = st.camp.best, pushes = 0;
    while (pushes++ < 400 && fightStage(st, s)) {
      st.res.gold += 400 * Math.pow(1.06, s); st.res.yarn += 8 + Math.floor(s / 5);
      // butin : ~10 ennemis par étape (1 boss toutes les 10)
      const kinds = campaignWaves(Math.floor(s / 10) + 1, (s % 10) + 1).waves.flat();
      for (const e of kinds) rollDrops(st, e.kind, e.boss, e.drop, 1);
      if (s % 10 === 9) { const r = mapClearReward(Math.floor(s / 10) + 1); st.res.gems += r.gems; st.res.eggs += r.eggs; st.res.feathers += r.feathers; }
      s++;
    }
    // farm quotidien (~2 h de combats répétés sur la dernière étape)
    for (let k = 0; k < 250; k++) { const e = campaignWaves(Math.floor(Math.max(0, s - 1) / 10) + 1, (Math.max(0, s - 1) % 10) + 1).waves.flat(); for (const x of e) rollDrops(st, x.kind, x.boss, x.drop, 1); }
    st.camp.best = s;
    for (const k in ACHIEVEMENTS) { const a = ACHIEVEMENTS[k]; if (!ach.has(a.id) && ((a.kind === 'stage' && s >= a.goal) || (a.kind === 'level' && st.hero.lvl >= a.goal) || (a.kind === 'opens' && st.stats.opens >= a.goal))) { ach.add(a.id); st.res.gems += a.gems; } }
    if (!st.hero.spec && st.hero.lvl >= SPEC_LEVEL) st.hero.spec = spec;
    const S = computeStats(st);
    const sets = Object.values(st.gear).filter((x) => x && x.set).length;
    if ([1, 2, 3, 5, 7, 10, 14, 20, 30].includes(d)) log.push({ d, stage: `${Math.floor(s / 10) + 1}-${(s % 10) + 1}`, lvl: st.hero.lvl, box: st.box.lvl, power: S.power.toExponential(2), vip: vipLevel(st.iap.vip), spent: (st.iap.spent / 100).toFixed(0) + '€', kittens: Object.keys(st.kittens.owned).length, setPieces: sets, crafts: st.stats.crafts, relics: Object.values(st.gear).filter((x) => x && x.relic).length + st.bag.filter((x) => x.relic).length });
  }
  return log;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ONLY = process.argv[2];
  for (const p of ['f2p', 'dolphin', 'whale']) { if (ONLY && p !== ONLY) continue; console.log('=== ' + p); console.table(run(p)); }
}
