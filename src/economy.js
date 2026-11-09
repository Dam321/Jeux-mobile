// Logique d'économie : tirages, récompenses, coûts (pur, testable sous Node)
import {
  boxWeights, SLOTS, RARITY_SUBS, SUBSTAT_KEYS, SUBSTATS, xpToNext, recycleGold, boxUpgradeGold,
  boxUpgradeSeconds, BOX_MAX_LEVEL, SKILLS, SKILL_RARITY_ODDS, SKILL_PITY_LEG, SKILL_PITY_DIV,
  PETS, PET_RARITY_ODDS, PET_PITY_LEG, dupNeed, trainingCost, TRAININGS, idlePerHour, VIP_PERKS, vipLevel,
  OFFLINE_CAP_H, DAILY_QUESTS, PASS_XP_PER_TIER,
} from './config.js';
import { weightedPick, randi, rand, pick, uid } from './util.js';
import { itemPower } from './stats.js';

// ------------------------------------------------------------- Carton
export function rollItem(st) {
  const r = weightedPick(boxWeights(st.box.lvl));
  const slot = pick(SLOTS).id;
  const l = Math.max(1, st.hero.lvl + randi(-2, 1));
  const n = RARITY_SUBS[r];
  const keys = [...SUBSTAT_KEYS].sort(() => Math.random() - 0.5).slice(0, n);
  const subs = keys.map((k) => ({ k, v: +(SUBSTATS[k].base * (0.6 + Math.random() * 0.4) * (1 + 0.45 * r)).toFixed(1) }));
  return { id: uid(), slot, r, l, q: +rand(0.92, 1.08).toFixed(3), subs };
}

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

// Ouvre n cartons. mode 'manual' (x1 : renvoie l'objet à comparer) ou 'auto' (équipe le meilleur, recycle le reste)
export function openBoxes(st, n, autoEquip = true) {
  n = Math.min(n, st.res.yarn);
  if (n <= 0) return null;
  st.res.yarn -= n;
  st.stats.opens += n;
  bumpQuest(st, 'open', n);
  addPassXp(st, n * 0.05);
  const items = [];
  let gold = 0;
  const equipped = [];
  for (let i = 0; i < n; i++) items.push(rollItem(st));
  const lvUps = gainHeroXp(st, n);
  if (autoEquip) {
    for (const it of items) {
      const cur = st.gear[it.slot];
      if (!cur || itemPower(it) > itemPower(cur)) {
        if (cur) gold += recycleGold(cur);
        st.gear[it.slot] = it;
        equipped.push(it);
      } else gold += recycleGold(it);
    }
    st.res.gold += gold;
  }
  return { items, gold, equipped, lvUps };
}

export function boxUpgradeInfo(st) {
  const lvl = st.box.lvl;
  if (lvl >= BOX_MAX_LEVEL) return { max: true };
  return { gold: boxUpgradeGold(lvl), secs: boxUpgradeSeconds(lvl), busy: st.box.upUntil > 0, left: Math.max(0, (st.box.upUntil - Date.now()) / 1000) };
}

// ------------------------------------------------------------- Gacha compétences / compagnons
function rollGacha(odds, pool, pity, pityLeg, pityDiv) {
  let r = weightedPick(odds);
  if (pityDiv && pity.div + 1 >= pityDiv) r = 6;
  else if (pity.leg + 1 >= pityLeg && r < 4) r = 4;
  pity.leg = r >= 4 ? 0 : pity.leg + 1;
  if (pityDiv) pity.div = r >= 6 ? 0 : pity.div + 1;
  const cands = pool.filter((x) => x.r === r);
  return pick(cands.length ? cands : pool);
}

export function summonSkills(st, n) {
  const out = [];
  const pity = { leg: st.skills.pityLeg, div: st.skills.pityDiv };
  for (let i = 0; i < n; i++) {
    const sk = rollGacha(SKILL_RARITY_ODDS, SKILLS, pity, SKILL_PITY_LEG, SKILL_PITY_DIV);
    out.push(sk);
    addOwned(st.skills.owned, sk.id);
  }
  st.skills.pityLeg = pity.leg; st.skills.pityDiv = pity.div;
  st.skills.pulls += n;
  bumpQuest(st, 'summon', n);
  autoEquipSkills(st);
  return out;
}

export function summonPets(st, n) {
  const out = [];
  const pity = { leg: st.pets.pityLeg, div: 0 };
  for (let i = 0; i < n; i++) {
    const p = rollGacha(PET_RARITY_ODDS, PETS, pity, PET_PITY_LEG, 0);
    out.push(p);
    addOwned(st.pets.owned, p.id);
  }
  st.pets.pityLeg = pity.leg;
  st.pets.pulls += n;
  autoEquipPets(st);
  return out;
}

function addOwned(map, id) {
  if (!map[id]) map[id] = { lvl: 1, copies: 0 };
  else map[id].copies++;
}

export function canLevel(entry) { return entry && entry.copies >= dupNeed(entry.lvl); }
export function levelUp(entry) {
  if (!canLevel(entry)) return false;
  entry.copies -= dupNeed(entry.lvl);
  entry.lvl++;
  return true;
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
export function autoEquipPets(st) {
  const slots = VIP_PERKS[vipLevel(st.iap.vip)].petSlots;
  const eq = st.pets.equipped;
  for (let i = 0; i < slots; i++) {
    if (eq[i]) continue;
    const best = PETS.filter((p) => st.pets.owned[p.id] && !eq.includes(p.id)).sort((a, b) => b.r - a.r)[0];
    if (best) eq[i] = best.id;
  }
}

// ------------------------------------------------------------- Entraînement
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

// ------------------------------------------------------------- Revenus passifs
export function idleRate(st) {
  const perks = VIP_PERKS[vipLevel(st.iap.vip)];
  const base = idlePerHour(st.camp.best);
  let mult = 1 + perks.idle / 100;
  if (st.iap.monthlyUntil > Date.now()) mult += 0.1;
  if (st.iap.lifetime) mult += 0.25;
  return { gold: base.gold * mult, yarn: base.yarn * mult, mult };
}
export function idleCapH(st) {
  return VIP_PERKS[vipLevel(st.iap.vip)].offlineH || OFFLINE_CAP_H;
}
export function idlePending(st) {
  const h = Math.min(idleCapH(st), (Date.now() - st.idleSince) / 3600000);
  const r = idleRate(st);
  return { hours: h, gold: Math.floor(r.gold * h), yarn: Math.floor(r.yarn * h) };
}

// ------------------------------------------------------------- Récompenses génériques
// rewards : { gold: heures d'or passif, goldRaw, gems, yarn, feathers, eggs, food, skin, pet, skill, speedH, speedM, arenaCoins }
export function grant(st, rewards) {
  const given = [];
  const add = (k, v) => { if (v) given.push({ k, v }); };
  for (const k in rewards) {
    const v = rewards[k];
    if (!v) continue;
    switch (k) {
      case 'gold': { const g = Math.round(idleRate(st).gold * v); st.res.gold += g; add('gold', g); break; }
      case 'goldRaw': st.res.gold += v; add('gold', v); break;
      case 'gems': case 'yarn': case 'feathers': case 'eggs': case 'food': case 'arenaCoins':
        st.res[k] += v; add(k, v); break;
      case 'speedH': st.res.speedMin += v * 60; add('speedMin', v * 60); break;
      case 'speedM': st.res.speedMin += v; add('speedMin', v); break;
      case 'skin':
        if (!st.skins.owned.includes(v)) st.skins.owned.push(v);
        else st.res.gems += 500;
        add('skin', v); break;
      case 'pet': addOwned(st.pets.owned, v); autoEquipPets(st); add('pet', v); break;
      case 'skill': addOwned(st.skills.owned, v); autoEquipSkills(st); add('skill', v); break;
      case 'xp': gainHeroXp(st, v); add('xp', v); break;
      default: break;
    }
  }
  return given;
}

// ------------------------------------------------------------- Quêtes & Passe
export function bumpQuest(st, id, n = 1) {
  if (!st.daily) return;
  if (st.daily.q[id] == null) return;
  const q = DAILY_QUESTS.find((x) => x.id === id);
  st.daily.q[id] = Math.min(q.goal, st.daily.q[id] + n);
}
export function addPassXp(st, xp) {
  st.pass.xp = Math.min(st.pass.xp + xp, PASS_XP_PER_TIER * 30);
}
export function passTier(st) { return Math.floor(st.pass.xp / PASS_XP_PER_TIER); }

// ------------------------------------------------------------- Accélération du carton
export function applySpeedup(st, minutes) {
  if (!st.box.upUntil) return false;
  st.box.upUntil -= minutes * 60000;
  return true;
}
