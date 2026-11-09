// Simulateur d'équilibrage : F2P vs petit payeur vs baleine sur 30 jours
import { defaultState, ensureDaily } from '../src/state.js';
import { computeStats } from '../src/stats.js';
import { openBoxes, summonSkills, summonPets, train, grant, idleRate, levelUp, canLevel } from '../src/economy.js';
import { quickFight, equippedSkills, equippedPets } from '../src/combat.js';
import { campaignWaves, dungeonWaves } from '../src/encounters.js';
import { boxUpgradeGold, boxUpgradeSeconds, BOX_MAX_LEVEL, VIP_PERKS, vipLevel, PRODUCTS, trainingCost, dungeonReward, ACHIEVEMENTS, FIRST_RECHARGE, stageIndex } from '../src/config.js';

function fightStage(st, s) {
  const S = computeStats(st);
  const v = VIP_PERKS[vipLevel(st.iap.vip)];
  const ch = Math.floor(s / 10) + 1, stg = (s % 10) + 1;
  let wins = 0;
  for (let i = 0; i < 3; i++) if (quickFight(S, equippedSkills(st, v.skillSlots), equippedPets(st, v.petSlots), campaignWaves(ch, stg)).win) wins++;
  return wins >= 2;
}

function buy(st, id) {
  const p = PRODUCTS[id];
  st.iap.spent += p.price; st.iap.vip += p.price;
  if (p.gems) st.res.gems += p.gems;
  if (p.rewards) grant(st, p.rewards);
  if (id === 'lifetime') { st.iap.lifetime = true; st.res.gems += 1000; }
  if (id === 'monthly') { st.iap.monthlyUntil = Date.now() + 30 * 864e5; st.res.gems += 300; }
  if (!st.iap.firstRecharge) { st.iap.firstRecharge = 2; grant(st, FIRST_RECHARGE); }
}

function run(profile, days = 30) {
  const st = defaultState();
  st.iap.monthlyUntil = 0;
  let boxTimer = 0; // secondes restantes
  const log = [];
  let ach = new Set();
  for (let d = 1; d <= days; d++) {
    // --- achats
    if (profile === 'whale') {
      if (d === 1) { ['starter', 'ninja', 'cyber', 'whale', 'monthly', 'lifetime', 'fund', 'pass_deluxe'].forEach((x) => buy(st, x)); for (let i = 0; i < 4; i++) buy(st, 'gems_6'); }
      ['daily_1', 'daily_2', 'daily_3'].forEach((x) => buy(st, x));
      if (d % 7 === 1) { buy(st, 'weekly_1'); buy(st, 'weekly_2'); }
      buy(st, 'gems_6');
      if (d % 2 === 0) buy(st, 'power_big');
    }
    if (profile === 'dolphin') {
      if (d === 1) { buy(st, 'starter'); buy(st, 'monthly'); buy(st, 'pass'); }
      if (d === 5) buy(st, 'ninja');
      buy(st, 'daily_1');
      if (d % 7 === 1) buy(st, 'weekly_1');
    }
    // --- revenus gratuits
    const r = idleRate(st);
    st.res.gold += r.gold * 20; st.res.yarn += r.yarn * 20;
    grant(st, { yarn: 1200, gems: 100, feathers: 8, eggs: 2, gold: 1 }); // quêtes du jour
    grant(st, { yarn: 300, gems: 30, feathers: 2 }); // pubs
    st.res.speedMin += 30;
    st.res.gems += 120; // arène
    if (st.iap.monthlyUntil) st.res.gems += 100;
    if (st.iap.lifetime) st.res.gems += 80;
    st.res.gems += VIP_PERKS[vipLevel(st.iap.vip)].dailyGems;
    // donjons: 2 clés chacun
    for (const id of ['gold', 'yarn', 'feather']) for (let k = 0; k < 2; k++) grant(st, dungeonReward(id, Math.max(1, Math.floor(st.camp.best / 7)), st.camp.best));
    // --- dépenses gemmes
    const keepGems = profile === 'f2p' ? 0 : 0;
    // accélérer le carton
    let secsToday = 86400;
    while (st.box.lvl < BOX_MAX_LEVEL) {
      const g = boxUpgradeGold(st.box.lvl);
      if (!boxTimer) { if (st.res.gold < g) break; st.res.gold -= g; boxTimer = boxUpgradeSeconds(st.box.lvl); }
      const speed = st.res.speedMin * 60;
      const use = Math.min(speed, boxTimer); st.res.speedMin -= use / 60; boxTimer -= use;
      if (boxTimer > secsToday) {
        const skip = Math.ceil((boxTimer - secsToday) / 60);
        if (profile !== 'f2p' && st.res.gems > skip) { st.res.gems -= skip; boxTimer = secsToday; }
        else { boxTimer -= secsToday; secsToday = 0; break; }
      }
      secsToday -= boxTimer; boxTimer = 0; st.box.lvl++;
    }
    // gemmes restantes -> moitié plumes, moitié pelotes
    while (st.res.gems >= 900 + keepGems) { st.res.gems -= 900; st.res.feathers += 10; if (st.res.gems >= 1100) { st.res.gems -= 1100; st.res.yarn += 2500; } }
    // --- ouvrir les cartons
    while (st.res.yarn > 0) openBoxes(st, Math.min(st.res.yarn, 1000), true);
    // --- invocations
    if (st.res.feathers >= 1) summonSkills(st, Math.floor(st.res.feathers)), st.res.feathers = 0;
    if (st.res.eggs >= 1) summonPets(st, Math.floor(st.res.eggs)), st.res.eggs = 0;
    for (const id in st.skills.owned) while (levelUp(st.skills.owned[id]));
    for (const id in st.pets.owned) while (levelUp(st.pets.owned[id]));
    // --- entraînement : dépenser l'or restant
    let guard = 0;
    while (guard++ < 5000) {
      const opts = ['atk', 'hp', 'def'].map((id) => [id, trainingCost(id, st.train[id])]).sort((a, b) => a[1] - b[1]);
      if (st.res.gold < opts[0][1]) break;
      train(st, opts[0][0]);
    }
    // --- campagne : pousser au max
    let s = st.camp.best;
    let pushes = 0;
    while (pushes++ < 400 && fightStage(st, s)) { st.res.gold += 400 * Math.pow(1.06, s); st.res.yarn += 6 + Math.floor(s / 6); s++; }
    st.camp.best = s;
    for (const a of ACHIEVEMENTS) if (!ach.has(a.id) && ((a.kind === 'stage' && s >= a.goal) || (a.kind === 'level' && st.hero.lvl >= a.goal) || (a.kind === 'opens' && st.stats.opens >= a.goal))) { ach.add(a.id); st.res.gems += a.gems; }
    const S = computeStats(st);
    if ([1, 2, 3, 5, 7, 10, 14, 20, 30].includes(d)) log.push({ d, stage: `${Math.floor(s / 10) + 1}-${(s % 10) + 1}`, lvl: st.hero.lvl, box: st.box.lvl, opens: st.stats.opens, power: S.power.toExponential(2), vip: vipLevel(st.iap.vip), spent: (st.iap.spent / 100).toFixed(0) + '€', train: st.train.atk, skills: Object.keys(st.skills.owned).length });
  }
  return log;
}
for (const p of ['f2p', 'dolphin', 'whale']) { console.log('=== ' + p); console.table(run(p)); }
