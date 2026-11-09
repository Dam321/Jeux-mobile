// Logique d'économie : tirages, carton, butin, craft, forgemagie, reliques (pur, testable sous Node)
import {
  boxWeights, SLOTS, SLOT_BY_ID, RARITY_SUBS, SUBSTAT_KEYS, SUBSTATS, xpToNext, recycleGold, boxUpgradeGold,
  boxUpgradeSeconds, BOX_MAX_LEVEL, SKILLS, SKILL_RARITY_ODDS, SKILL_PITY_LEG, SKILL_PITY_DIV,
  dupNeed, trainingCost, TRAININGS, idlePerHour, VIP_PERKS, vipLevel, OFFLINE_CAP_H, DAILY_QUESTS, PASS_XP_PER_TIER, STAT_GROWTH,
} from './config.js';
import {
  KITTENS, KITTEN_ODDS, KITTEN_PITY_LEG, KITTEN_PITY_MYTH, RES_BY_ID, ENEMY_DROPS, DROP_CHANCE, GLOBAL_DROPS, SETS, SET_BY_ID,
  artisanXpNext, craftXp, craftGold, FORGE_MAX, FORGE_RATES, forgeCost, breakRunes, RELICS, RELIC_BY_ID, RELIC_CHEST, RELIC_CONSOLATION, BOX_RELIC_CHANCE, LOOK_UNLOCK,
} from './content.js';
import { weightedPick, randi, rand, pick, uid } from './util.js';
import { itemPower, computeStats } from './stats.js';
import {
  ARTIFACTS, ARTIFACT_BY_ID, ARTIFACT_MAX_STARS, artifactFragsNeed, artifactLevelCost, ARTIFACT_CHEST, POTION_BY_ID, TRANSMUTE_RATIO,
  towerFloorReward, towerMilestone, AURA_BY_ID, TITLE_BY_ID, FRAME_BY_ID, KITTEN_ATTACKS, BANNER_POOL,
} from './content3.js';
import { RESOURCES } from './content.js';

// ------------------------------------------------------------- objets
function rollSubs(r, n, guaranteed) {
  const keys = [...SUBSTAT_KEYS].sort(() => Math.random() - 0.5);
  if (guaranteed) { keys.splice(keys.indexOf(guaranteed), 1); keys.unshift(guaranteed); }
  return keys.slice(0, n).map((k) => ({ k, v: +(SUBSTATS[k].base * (0.6 + Math.random() * 0.4) * (1 + 0.45 * r)).toFixed(1) }));
}
export function makeRelic(st, id) {
  const R = RELIC_BY_ID[id];
  return { id: uid(), slot: R.slot, base: R.base, r: 8, l: st.hero.lvl, q: 1.1, subs: rollSubs(8, 4), relic: id };
}
export function rollItem(st) {
  if (Math.random() < BOX_RELIC_CHANCE) return makeRelic(st, pick(RELICS).id);
  const r = weightedPick(boxWeights(st.box.lvl));
  const slot = pick(SLOTS);
  const base = pick(Object.keys(slot.bases));
  const l = Math.max(1, st.hero.lvl + randi(-2, 1));
  return { id: uid(), slot: slot.id, base, r, l, q: +rand(0.92, 1.08).toFixed(3), subs: rollSubs(r, RARITY_SUBS[r]) };
}
export function keepable(it) { return !!(it && (it.set || it.relic || (it.upg || 0) > 0)); }

export function gainHeroXp(st, xp) {
  st.hero.xp += xp;
  let ups = 0;
  while (st.hero.xp >= xpToNext(st.hero.lvl)) {
    st.hero.xp -= xpToNext(st.hero.lvl);
    st.hero.lvl++;
    ups++;
  }
  return ups;
}

export function bagSize(st) { return VIP_PERKS[vipLevel(st.iap.vip)].bag; }
// Range un objet dans le sac ; s'il est plein, l'objet le plus faible est recyclé
export function addToBag(st, it) {
  st.bag.push(it);
  let gold = 0;
  while (st.bag.length > bagSize(st)) {
    let worst = 0;
    st.bag.forEach((x, i) => { if (!x.relic && itemPower(x, st.hero.lvl) < itemPower(st.bag[worst], st.hero.lvl)) worst = i; });
    const [x] = st.bag.splice(worst, 1);
    gold += recycleGold(x);
  }
  st.res.gold += gold;
  return gold;
}
// Équipe un objet ; l'ancien va au sac s'il est précieux, sinon il est recyclé (or ou runes)
export function equipItem(st, it, breakOld = false) {
  const idx = st.bag.findIndex((x) => x.id === it.id);
  if (idx >= 0) st.bag.splice(idx, 1);
  const cur = st.gear[it.slot];
  st.gear[it.slot] = it;
  if (!cur) return { gold: 0, runes: 0 };
  if (keepable(cur)) { addToBag(st, cur); return { gold: 0, runes: 0 }; }
  return disposeItem(st, cur, breakOld);
}
export function disposeItem(st, it, asRunes) {
  if (asRunes) { const n = breakRunes(it); st.mats.rune += n; return { gold: 0, runes: n }; }
  const g = recycleGold(it); st.res.gold += g; return { gold: g, runes: 0 };
}

// Ouvre n cartons (auto : équipe le meilleur, recycle/brise le reste)
export function openBoxes(st, n, autoEquip = true) {
  n = Math.min(n, st.res.yarn);
  if (n <= 0) return null;
  st.res.yarn -= n;
  st.stats.opens += n;
  bumpQuest(st, 'open', n);
  addPassXp(st, n * 0.05);
  const items = [];
  let gold = 0, runes = 0;
  const equipped = [], relics = [];
  for (let i = 0; i < n; i++) items.push(rollItem(st));
  const lvUps = gainHeroXp(st, n);
  if (autoEquip) {
    for (const it of items) {
      if (it.relic) { relics.push(it); const cur = st.gear[it.slot]; if (!cur || itemPower(it, st.hero.lvl) > itemPower(cur, st.hero.lvl)) { equipItem(st, it); equipped.push(it); } else addToBag(st, it); continue; }
      const cur = st.gear[it.slot];
      const margin = keepable(cur) ? 1.15 : 1; // une pièce de panoplie / forgée / relique n'est remplacée que si nettement meilleure
      if (!cur || itemPower(it, st.hero.lvl) > itemPower(cur, st.hero.lvl) * margin) {
        const d = equipItem(st, it, st.box.autoBreak);
        gold += d.gold; runes += d.runes;
        equipped.push(it);
      } else { const d = disposeItem(st, it, st.box.autoBreak); gold += d.gold; runes += d.runes; }
    }
  }
  return { items, gold, runes, equipped, relics, lvUps };
}

export function boxUpgradeInfo(st) {
  const lvl = st.box.lvl;
  if (lvl >= BOX_MAX_LEVEL) return { max: true };
  return { gold: boxUpgradeGold(lvl), secs: boxUpgradeSeconds(lvl), busy: st.box.upUntil > 0, left: Math.max(0, (st.box.upUntil - Date.now()) / 1000) };
}

// ------------------------------------------------------------- pouvoirs (gacha à plumes)
function addOwned(map, id) {
  if (!map[id]) { map[id] = { lvl: 1, copies: 0 }; return true; }
  map[id].copies++;
  return false;
}
export function summonSkills(st, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = weightedPick(SKILL_RARITY_ODDS);
    if (st.skills.pityDiv + 1 >= SKILL_PITY_DIV) r = 6;
    else if (st.skills.pityLeg + 1 >= SKILL_PITY_LEG && r < 4) r = 4;
    st.skills.pityLeg = r >= 4 ? 0 : st.skills.pityLeg + 1;
    st.skills.pityDiv = r >= 6 ? 0 : st.skills.pityDiv + 1;
    const c = SKILLS.filter((x) => x.r === r);
    const sk = pick(c.length ? c : SKILLS);
    out.push(sk);
    addOwned(st.skills.owned, sk.id);
  }
  st.skills.pulls += n;
  bumpQuest(st, 'summon', n);
  autoEquipSkills(st);
  return out;
}

// ------------------------------------------------------------- chatons (gacha à paniers + butin sauvage)
function rollKittenRarity(st, usePity) {
  let r = weightedPick(KITTEN_ODDS);
  if (usePity) {
    if (st.kittens.pityMyth + 1 >= KITTEN_PITY_MYTH && r < 5) r = 5;
    else if (st.kittens.pityLeg + 1 >= KITTEN_PITY_LEG && r < 4) r = 4;
    st.kittens.pityLeg = r >= 4 ? 0 : st.kittens.pityLeg + 1;
    st.kittens.pityMyth = r >= 5 ? 0 : st.kittens.pityMyth + 1;
  }
  const feat = KITTENS.find((k) => k.id === bannerKitten(weekKeyOf()));
  if (feat && feat.r === r && Math.random() < 0.5) return feat; // bannière vedette : 50 % de sa rareté
  const c = KITTENS.filter((k) => k.r === r);
  return pick(c.length ? c : KITTENS);
}
function weekKeyOf(t = Date.now()) { const d = new Date(t); const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-W' + Math.ceil(((d - j) / 86400000 + j.getDay() + 1) / 7); }
export function giveKitten(st, id) {
  const isNew = addOwned(st.kittens.owned, id);
  if (!st.kittens.seen.includes(id)) st.kittens.seen.push(id);
  if (isNew) st.stats.kittensFound++;
  autoEquipKittens(st);
  return isNew;
}
export function summonKittens(st, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = rollKittenRarity(st, true);
    out.push({ k, isNew: giveKitten(st, k.id) });
  }
  st.kittens.pulls += n;
  return out;
}
// Chaton sauvage trouvé en combat (mêmes probabilités, sans garantie)
export function wildKitten(st) {
  const k = rollKittenRarity(st, false);
  return { k, isNew: giveKitten(st, k.id) };
}

export function canLevel(entry) { return entry && entry.copies >= dupNeed(entry.lvl); }
export function levelUp(entry) {
  if (!canLevel(entry)) return false;
  entry.copies -= dupNeed(entry.lvl);
  entry.lvl++;
  return true;
}
// Lait doré : remplace les copies manquantes (1 lait = 1 copie)
export function milkNeeded(entry) { return Math.max(0, dupNeed(entry.lvl) - entry.copies); }
export function levelUpWithMilk(st, entry) {
  const need = milkNeeded(entry);
  if (st.res.milk < need) return false;
  st.res.milk -= need;
  entry.copies += need;
  return levelUp(entry);
}

export function autoEquipSkills(st) {
  const slots = VIP_PERKS[vipLevel(st.iap.vip)].skillSlots;
  const eq = st.skills.equipped;
  for (let i = 0; i < slots; i++) {
    if (eq[i]) continue;
    const best = SKILLS.filter((s) => st.skills.owned[s.id] && !eq.includes(s.id)).sort((a, b) => b.r - a.r)[0];
    if (best) eq[i] = best.id;
  }
}
export function autoEquipKittens(st) {
  const slots = VIP_PERKS[vipLevel(st.iap.vip)].kittenSlots;
  const eq = st.kittens.equipped;
  for (let i = 0; i < slots; i++) {
    if (eq[i]) continue;
    const best = KITTENS.filter((k) => st.kittens.owned[k.id] && !eq.includes(k.id)).sort((a, b) => b.r - a.r)[0];
    if (best) eq[i] = best.id;
  }
}

// ------------------------------------------------------------- entraînement
export function train(st, id) {
  const t = TRAININGS.find((x) => x.id === id);
  const lvl = st.train[id];
  if (t.max && lvl >= t.max) return false;
  const c = trainingCost(id, lvl);
  if (st.res.gold < c) return false;
  st.res.gold -= c;
  st.train[id]++;
  bumpQuest(st, 'train', 1);
  return true;
}

// ------------------------------------------------------------- revenus passifs
export function idleRate(st, S) {
  const perks = VIP_PERKS[vipLevel(st.iap.vip)];
  const base = idlePerHour(st.camp.best);
  const gp = (S || computeStats(st)).goldPct || 0;
  let mult = 1 + perks.idle / 100;
  if (st.iap.monthlyUntil > Date.now()) mult += 0.1;
  if (st.iap.lifetime) mult += 0.25;
  return { gold: base.gold * mult * (1 + gp / 100), yarn: base.yarn * mult, mult };
}
export function idleCapH(st) {
  return VIP_PERKS[vipLevel(st.iap.vip)].offlineH || OFFLINE_CAP_H;
}
export function idlePending(st, S) {
  const h = Math.min(idleCapH(st), (Date.now() - st.idleSince) / 3600000);
  const r = idleRate(st, S);
  return { hours: h, gold: Math.floor(r.gold * h), yarn: Math.floor(r.yarn * h) };
}

// ------------------------------------------------------------- butin des ennemis
export function luckMult(st, S) {
  const l = (S || computeStats(st)).luck || 0;
  const clover = st.boost.cloverUntil > Date.now() ? 2 : 1;
  return (1 + l / 100) * clover;
}
export function rollDrops(st, kind, boss, bossDrop, lm) {
  const out = {};
  const d = ENEMY_DROPS[kind];
  if (d) {
    if (Math.random() < Math.min(0.95, DROP_CHANCE.common * lm)) out[d[0]] = (out[d[0]] || 0) + randi(1, boss ? 6 : 2);
    if (Math.random() < Math.min(0.9, DROP_CHANCE.rare * lm * (boss ? 6 : 1))) out[d[1]] = (out[d[1]] || 0) + 1;
  }
  if (boss && bossDrop && Math.random() < Math.min(0.95, DROP_CHANCE.boss * lm)) out[bossDrop] = (out[bossDrop] || 0) + 1;
  for (const [id, p] of GLOBAL_DROPS) if (Math.random() < p * lm * (boss ? 5 : 1)) out[id] = (out[id] || 0) + 1;
  for (const id in out) st.mats[id] = (st.mats[id] || 0) + out[id];
  return out;
}

// ------------------------------------------------------------- atelier (panoplies)
export function craftCheck(st, setId, slot) {
  const S = SET_BY_ID[setId];
  const lvl = Math.max(S.lvl, st.hero.lvl);
  const gold = craftGold(lvl, S.r);
  const missing = [];
  for (const [id, n] of S.cost) if ((st.mats[id] || 0) < n) missing.push({ id, have: st.mats[id] || 0, need: n });
  const artisanOk = st.artisan.lvl >= S.artisan;
  const heroOk = st.hero.lvl >= S.lvl;
  return { S, lvl, gold, missing, artisanOk, heroOk, ok: !missing.length && artisanOk && heroOk && st.res.gold >= gold };
}
export function craft(st, setId, slot) {
  const c = craftCheck(st, setId, slot);
  if (!c.ok) return null;
  const S = c.S;
  for (const [id, n] of S.cost) st.mats[id] -= n;
  st.res.gold -= c.gold;
  const q = +(0.85 + Math.pow(Math.random(), 1.6) * 0.37).toFixed(3); // jet : 0.85 → 1.22 (les jets parfaits sont rares)
  const it = { id: uid(), slot, base: S.pieces[slot], r: S.r, l: c.lvl, q, subs: rollSubs(S.r, RARITY_SUBS[S.r] + 1), set: setId, upg: 0 };
  st.artisan.xp += craftXp(S);
  let ups = 0;
  while (st.artisan.lvl < 100 && st.artisan.xp >= artisanXpNext(st.artisan.lvl)) { st.artisan.xp -= artisanXpNext(st.artisan.lvl); st.artisan.lvl++; ups++; }
  st.stats.crafts++;
  bumpQuest(st, 'craft', 1);
  addToBag(st, it);
  return { it, ups, perfect: q >= 1.18 };
}

// ------------------------------------------------------------- forgemagie
export function forgeChance(item, scroll) {
  const n = item.upg || 0;
  if (n >= FORGE_MAX) return 0;
  return Math.min(100, FORGE_RATES[n] + (scroll ? 15 : 0));
}
export function forge(st, item, useStone, useScroll) {
  const n = item.upg || 0;
  if (n >= FORGE_MAX) return null;
  const c = forgeCost(item);
  if (st.mats.rune < c.rune || st.res.gold < c.gold) return null;
  if (useStone && st.res.stone < 1) useStone = false;
  if (useScroll && st.res.scroll < 1) useScroll = false;
  st.mats.rune -= c.rune;
  st.res.gold -= c.gold;
  if (useStone) st.res.stone--;
  if (useScroll) st.res.scroll--;
  const chance = forgeChance(item, useScroll);
  bumpQuest(st, 'craft', 1);
  st.artisan.xp += 8 + n * 4;
  while (st.artisan.lvl < 100 && st.artisan.xp >= artisanXpNext(st.artisan.lvl)) { st.artisan.xp -= artisanXpNext(st.artisan.lvl); st.artisan.lvl++; }
  if (Math.random() * 100 < chance) { item.upg = n + 1; return { ok: true, upg: item.upg, chance }; }
  let down = false;
  if (n >= 7 && !useStone) { item.upg = n - 1; down = true; }
  return { ok: false, down, upg: item.upg, chance };
}
export function breakItem(st, item) {
  const idx = st.bag.findIndex((x) => x.id === item.id);
  if (idx < 0 || item.relic) return 0;
  st.bag.splice(idx, 1);
  const n = breakRunes(item) * (1 + (item.upg || 0));
  st.mats.rune += n;
  return n;
}

// ------------------------------------------------------------- coffre des reliques
export function relicPull(st, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    st.relic.pulls++;
    st.relic.pity++;
    if (st.relic.pity >= RELIC_CHEST.pity || Math.random() * 100 < RELIC_CHEST.relicPct) {
      st.relic.pity = 0;
      const R = pick(RELICS);
      const it = makeRelic(st, R.id);
      addToBag(st, it);
      out.push({ relic: it });
    } else {
      const rw = RELIC_CONSOLATION[weightedPick(RELIC_CONSOLATION.map((c) => c.p))].rewards;
      out.push({ rewards: rw });
    }
  }
  return out;
}

// ------------------------------------------------------------- apparence
export function lookPrice(cat, id) { return LOOK_UNLOCK[cat] ? LOOK_UNLOCK[cat][id] : 0; }
export function lookUnlocked(st, cat, id) {
  const p = lookPrice(cat, id);
  if (p === 0 || p === undefined) return true;
  if (st.unlocks.includes(cat + ':' + id)) return true;
  if (typeof p === 'string' && p.startsWith('vip')) return vipLevel(st.iap.vip) >= +p.slice(3);
  return false;
}

// ------------------------------------------------------------- récompenses génériques
// rewards : { gold: heures d'or passif, goldRaw, gems, yarn, feathers, eggs, arenaCoins, warCoins, stone, scroll, clover, milk, relicKeys,
//             speedH, speedM, costume, look, kitten, skill, xp, relic, <id de ressource> }
const RES_KEYS = ['gems', 'yarn', 'feathers', 'eggs', 'arenaCoins', 'warCoins', 'towerTokens', 'stone', 'scroll', 'clover', 'milk', 'relicKeys'];
export function grant(st, rewards) {
  const given = [];
  const add = (k, v) => { if (v) given.push({ k, v }); };
  for (const k in rewards) {
    const v = rewards[k];
    if (!v) continue;
    if (RES_BY_ID[k]) { st.mats[k] = (st.mats[k] || 0) + v; add(k, v); continue; }
    if (RES_KEYS.includes(k)) { st.res[k] += v; add(k, v); continue; }
    switch (k) {
      case 'gold': { const g = Math.round(idleRate(st).gold * v); st.res.gold += g; add('gold', g); break; }
      case 'goldRaw': st.res.gold += v; add('gold', v); break;
      case 'speedH': st.res.speedMin += v * 60; add('speedMin', v * 60); break;
      case 'speedM': st.res.speedMin += v; add('speedMin', v); break;
      case 'costume':
        if (!st.costumes.owned.includes(v)) st.costumes.owned.push(v); else st.res.gems += 500;
        add('costume', v); break;
      case 'look':
        if (v === 'galaxie') for (const x of ['fur:galaxie', 'pattern:galaxy', 'eye:galaxie']) if (!st.unlocks.includes(x)) st.unlocks.push(x);
        add('look', v); break;
      case 'kitten': giveKitten(st, v); add('kitten', v); break;
      case 'skill': if (!st.skills.owned[v]) st.skills.owned[v] = { lvl: 1, copies: 0 }; else st.skills.owned[v].copies++; autoEquipSkills(st); add('skill', v); break;
      case 'xp': gainHeroXp(st, v); add('xp', v); break;
      case 'relic': { const it = makeRelic(st, v); addToBag(st, it); add('relic', v); break; }
      case 'frags': { const got = randomFrags(st, v); for (const id in got) add('frag:' + id, got[id]); break; }
      case 'aura': if (!st.cos.auras.includes(v)) st.cos.auras.push(v); else st.res.gems += 300; if (!st.cos.aura) st.cos.aura = v; add('aura', v); break;
      case 'title': if (!st.cos.titles.includes(v)) st.cos.titles.push(v); add('title', v); break;
      case 'frame': if (!st.cos.frames.includes(v)) st.cos.frames.push(v); add('frame', v); break;
      default: break;
    }
  }
  return given;
}

// ------------------------------------------------------------- quêtes & passe
export function bumpQuest(st, id, n = 1) {
  if (!st.daily || st.daily.q[id] == null) return;
  const q = DAILY_QUESTS.find((x) => x.id === id);
  st.daily.q[id] = Math.min(q.goal, st.daily.q[id] + n);
}
export function addPassXp(st, xp) {
  st.pass.xp = Math.min(st.pass.xp + xp, PASS_XP_PER_TIER * 30);
}
export function passTier(st) { return Math.floor(st.pass.xp / PASS_XP_PER_TIER); }
export { STAT_GROWTH, SETS };

// ------------------------------------------------------------- artefacts
function pickArtifactByOdds() {
  const r = weightedPick(ARTIFACT_CHEST.odds);
  const c = ARTIFACTS.filter((a) => a.r === r);
  return pick(c.length ? c : ARTIFACTS);
}
export function addFrags(st, id, n) {
  const o = st.artifacts.owned[id] || (st.artifacts.owned[id] = { lvl: 1, stars: -1, frags: 0 });
  o.frags += n;
  if (o.stars < 0 && o.frags >= artifactFragsNeed(-1)) { o.frags -= artifactFragsNeed(-1); o.stars = 0; autoEquipArtifacts(st); return true; }
  return false;
}
export function randomFrags(st, n) {
  const got = {};
  let left = n;
  while (left > 0) {
    const a = pickArtifactByOdds();
    const k = Math.min(left, 1 + Math.floor(Math.random() * 3));
    got[a.id] = (got[a.id] || 0) + k;
    addFrags(st, a.id, k);
    left -= k;
  }
  return got;
}
export function artifactChest(st, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pickArtifactByOdds();
    const k = 2 + Math.floor(Math.random() * 3);
    const unlocked = addFrags(st, a.id, k);
    const dust = 15 + Math.floor(Math.random() * 30);
    st.mats.artDust += dust;
    out.push({ a, k, dust, unlocked });
  }
  st.artifacts.pulls += n;
  return out;
}
export function artifactStarUp(st, id) {
  const o = st.artifacts.owned[id];
  if (!o || o.stars < 0 || o.stars >= ARTIFACT_MAX_STARS) return false;
  const need = artifactFragsNeed(o.stars);
  if (o.frags < need) return false;
  o.frags -= need; o.stars++;
  return true;
}
export function artifactLevelUp(st, id, times = 1) {
  const o = st.artifacts.owned[id];
  if (!o || o.stars < 0) return 0;
  const A = ARTIFACT_BY_ID[id];
  let k = 0;
  for (let i = 0; i < times; i++) {
    const c = artifactLevelCost(A, o.lvl);
    if (st.mats.artDust < c.dust || st.res.gold < c.gold) break;
    st.mats.artDust -= c.dust; st.res.gold -= c.gold; o.lvl++; k++;
  }
  return k;
}
export function autoEquipArtifacts(st, slots = 4) {
  const eq = st.artifacts.equipped;
  for (let i = 0; i < slots; i++) {
    if (eq[i]) continue;
    const best = ARTIFACTS.filter((a) => st.artifacts.owned[a.id] && st.artifacts.owned[a.id].stars >= 0 && !eq.includes(a.id)).sort((a, b) => b.r - a.r)[0];
    if (best) eq[i] = best.id;
  }
}

// ------------------------------------------------------------- alchimie & transmutation
export function brewPotion(st, id, n = 1) {
  const P = POTION_BY_ID[id];
  if (!P) return 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (!P.cost.every(([r, q]) => (st.mats[r] || 0) >= q)) break;
    for (const [r, q] of P.cost) st.mats[r] -= q;
    st.potions[id] = (st.potions[id] || 0) + 1;
    k++;
  }
  if (k) bumpQuest(st, 'craft', 1);
  return k;
}
export function usePotion(st, id) {
  const P = POTION_BY_ID[id];
  if (!st.potions[id]) return false;
  st.potions[id]--;
  const key = P.boost + 'Until';
  st.boost[key] = Math.max(Date.now(), st.boost[key] || 0) + P.min * 60000;
  return true;
}
export function transmute(st, resId) {
  const R = RESOURCES.find((x) => x.id === resId);
  if (!R || R.r >= 6) return null;
  const need = TRANSMUTE_RATIO[R.r];
  if ((st.mats[resId] || 0) < need) return null;
  const pool = RESOURCES.filter((x) => x.r === R.r + 1 && !['rune', 'gutterBadge', 'artDust', 'bastetTear'].includes(x.id) && !x.id.endsWith('Essence'));
  if (!pool.length) return null;
  st.mats[resId] -= need;
  const out = pick(pool);
  st.mats[out.id] = (st.mats[out.id] || 0) + 1;
  return out;
}

// ------------------------------------------------------------- Tour des Défis
export function towerRewards(f) {
  const r = { ...towerFloorReward(f) };
  const m = towerMilestone(f);
  return { base: r, milestone: m };
}
export function bannerKitten(week) { return BANNER_POOL[Math.abs(week.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % BANNER_POOL.length]; }
export { KITTEN_ATTACKS, AURA_BY_ID, TITLE_BY_ID, FRAME_BY_ID };
