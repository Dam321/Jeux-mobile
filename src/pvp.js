// =====================================================================
//  PvP : Arène classée (adversaires « fantômes » asynchrones, comme dans
//  la plupart des idle RPG) et Guerre des Gouttières (guerre de clans pour
//  12 toits de la ville, saison hebdomadaire).
// =====================================================================
import { ARENA_SIZE, divisionOf } from './config.js';
import { CLANS, TERRITORIES, WAR_ENERGY } from './content.js';
import { makeCatLoadout, makeBots, weekKey } from './state.js';
import { seeded, dayKey } from './util.js';

// Courbe de puissance « moyenne du serveur » (joueur gratuit simulé) par jour depuis l'installation
const SERVER_CURVE = [[0, 2e3], [0.05, 6e3], [0.3, 2.5e4], [1, 7e4], [2, 6e5], [3, 1.3e6], [5, 7.6e6], [7, 1.7e7], [10, 4.2e7], [14, 1.1e8], [20, 4e8], [30, 1.75e9], [60, 4e10], [120, 2e12]];
export function serverPower(days) {
  for (let i = 1; i < SERVER_CURVE.length; i++) {
    const [d1, p1] = SERVER_CURVE[i];
    const [d0, p0] = SERVER_CURVE[i - 1];
    if (days <= d1) return p0 * Math.pow(p1 / p0, (days - d0) / (d1 - d0));
  }
  return SERVER_CURVE[SERVER_CURVE.length - 1][1] * Math.pow(1.05, days - 120);
}
export function daysPlayed(st) { return (Date.now() - st.created) / 864e5; }

// Puissance ↔ étape de campagne (ajusté sur le simulateur : ~+6,4 % de puissance par étape)
export function stageOfPower(p) { return 16.5 * Math.log(Math.max(1, p)) - 95; }
export function powerForStage(s) { return Math.exp((s + 95) / 16.5); }

const loadoutCache = new Map();
export function botLoadout(bot) {
  if (!loadoutCache.has(bot.id + bot.seed)) loadoutCache.set(bot.id + bot.seed, makeCatLoadout(seeded(bot.seed), bot.tier));
  return loadoutCache.get(bot.id + bot.seed);
}
export function botPower(st, bot) { return serverPower(daysPlayed(st)) * bot.factor * bot.grow; }

export function arenaBoard(st, me) {
  const byId = Object.fromEntries(st.arena.bots.map((b) => [b.id, b]));
  return st.arena.order.map((id, i) => {
    if (id === 'me') return { me: true, id, rank: i + 1, name: 'Minou (vous)', power: me.power, vip: me.vip, clan: 'me' };
    const b = byId[id];
    return { id, rank: i + 1, name: b.name, power: botPower(st, b), vip: b.vip, bot: b, clan: b.clan };
  });
}
export function arenaOpponents(st, me) {
  const lb = arenaBoard(st, me);
  const mine = lb.find((x) => x.me);
  let pool = lb.filter((x) => !x.me && x.rank < mine.rank && x.rank >= mine.rank - 10);
  if (!pool.length) pool = lb.filter((x) => !x.me).slice(0, 4);
  pool.sort((a, b) => a.power - b.power);
  if (pool.length <= 3) return pool;
  return [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]];
}
export function arenaSwap(st, botId) {
  const o = st.arena.order;
  const mi = o.indexOf('me'), oi = o.indexOf(botId);
  if (oi >= 0 && oi < mi) { o[mi] = botId; o[oi] = 'me'; }
  const r = o.indexOf('me') + 1;
  st.arena.best = Math.min(st.arena.best || ARENA_SIZE, r);
  return r;
}
export function myRank(st) { return st.arena.order.indexOf('me') + 1; }
export { divisionOf };

// Saison d'arène hebdomadaire : récompense selon la division, puis les bots remontent un peu
export function arenaSeasonCheck(st) {
  const wk = weekKey();
  if (st.arena.season === wk) return null;
  const rank = myRank(st);
  st.arena.season = wk;
  const div = divisionOf(rank);
  const gems = { 'Légende': 3000, 'Maître': 1800, 'Diamant': 1200, 'Platine': 800, 'Or': 500, 'Argent': 300, 'Bronze': 150 }[div.name];
  // rétrogradation légère : le joueur recule de quelques places
  const o = st.arena.order;
  const mi = o.indexOf('me');
  const ni = Math.min(o.length - 1, mi + 5);
  o.splice(mi, 1); o.splice(ni, 0, 'me');
  return { div, gems, rank };
}

// ---------------------------------------------------------------- Guerre des Gouttières
export const CLAN_BY_ID = Object.fromEntries(CLANS.map((c) => [c.id, c]));
export function defenderPower(st, t) {
  const T = st.war.terr[t.id];
  return serverPower(daysPlayed(st)) * (0.35 + T.lvl * 0.28) * (1 + (3 - T.hp) * 0.08);
}
export function defenderLoadout(st, t) {
  const T = st.war.terr[t.id];
  return makeCatLoadout(seeded(T.seed + T.hp * 17), Math.min(0.95, 0.2 + T.lvl * 0.1));
}
export function defenderName(st, t) {
  const T = st.war.terr[t.id];
  const r = seeded(T.seed + T.hp);
  const names = ['Balafre', 'Gros Minet', 'Ronchon', 'La Fouine', 'Moustache Grise', 'Cicatrice', 'Patte Folle', 'Oreille Coupée', 'Le Borgne', 'Sardine', 'Tonnerre'];
  return names[Math.floor(r() * names.length)];
}
// Les clans rivaux attaquent et marquent des points au fil des heures (simulation hors-ligne comprise)
export function warTick(st, now = Date.now()) {
  const w = st.war;
  const events = [];
  // nouvelle saison
  const wk = weekKey(now);
  if (w.week !== wk) {
    const ranking = Object.entries(w.points).sort((a, b) => b[1] - a[1]);
    const place = ranking.findIndex(([id]) => id === 'me') + 1;
    events.push({ season: true, place, ranking });
    w.week = wk;
    w.points = { me: 0, claws: 0, port: 0, roofs: 0 };
  }
  let h = Math.min(48, (now - w.lastTick) / 3600000);
  if (h < 0.25) return events;
  const steps = Math.floor(h * 4);
  w.lastTick += steps * 900000;
  for (let s = 0; s < steps; s++) {
    for (const t of TERRITORIES) w.points[w.terr[t.id].owner] += t.pts * 0.25;
    if (Math.random() < 0.09) {
      const att = CLANS[1 + Math.floor(Math.random() * 3)].id;
      const targets = TERRITORIES.filter((t) => w.terr[t.id].owner !== att);
      const t = targets[Math.floor(Math.random() * targets.length)];
      const T = w.terr[t.id];
      const chance = T.owner === 'me' ? 0.3 : 0.5;
      if (Math.random() < chance) {
        const prev = T.owner;
        T.owner = att; T.hp = 3; T.seed = Math.floor(Math.random() * 1e9);
        events.push({ capture: true, by: att, from: prev, t: t.id });
      }
    }
  }
  w.log = [...events.filter((e) => e.capture), ...w.log].slice(0, 12);
  return events;
}
export function warSeasonReward(place) {
  return [{ gems: 1500, warCoins: 300 }, { gems: 900, warCoins: 200 }, { gems: 500, warCoins: 120 }, { gems: 250, warCoins: 60 }][Math.max(0, Math.min(3, place - 1))];
}
export function ownedTerritories(st) { return TERRITORIES.filter((t) => st.war.terr[t.id].owner === 'me'); }
export function tributeAvailable(st) { return st.war.tributeKey !== dayKey() && ownedTerritories(st).length > 0; }
export function warBuyCost(st) { return 80 + st.war.buys * 40; }
export { WAR_ENERGY, makeBots };

// =====================================================================
//  Classement de la Tour des Défis : chacun grimpe selon sa puissance
//  (les rivaux progressent chaque jour) ; récompense hebdomadaire au rang.
// =====================================================================
export function botTowerFloor(st, bot) {
  const j = 0.8 + seeded(bot.seed + 7)() * 0.35; // certains rivaux grimpent plus que d'autres
  return Math.max(1, Math.round(((stageOfPower(botPower(st, bot)) - 6) / 3.5) * j));
}
export function towerBoard(st) {
  const rows = st.arena.bots.map((b) => ({ id: b.id, name: b.name, floor: botTowerFloor(st, b), vip: b.vip, clan: b.clan, cls: botLoadout(b).ap.cls }));
  rows.push({ me: true, id: 'me', name: 'Minou (vous)', floor: st.tower.best, cls: st.hero.cls, vip: 0 });
  rows.sort((a, b) => b.floor - a.floor || (a.me ? -1 : b.me ? 1 : 0));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
export function towerRankReward(rank) {
  if (rank === 1) return { gems: 500, towerTokens: 300, title: 'towerMaster' };
  if (rank <= 3) return { gems: 320, towerTokens: 220 };
  if (rank <= 10) return { gems: 200, towerTokens: 150 };
  if (rank <= 30) return { gems: 110, towerTokens: 100 };
  if (rank <= 60) return { gems: 60, towerTokens: 70 };
  return { gems: 30, towerTokens: 40 };
}

// =====================================================================
//  Boss mondial : classement du jour aux dégâts cumulés (tickets achetables).
//  Les rivaux frappent selon leur puissance ; les baleines ont plus de tickets.
// =====================================================================
export function wbBoard(st) {
  const k = 2.2; // dégâts d'un assaut ≈ 2,2 × la puissance (échelle fixe, comme les guildes)
  const day = dayKey();
  const rows = st.arena.bots.map((b) => {
    const rnd = seeded(b.seed + day.length * 31 + parseInt(day.replace(/\D/g, '').slice(-4), 10));
    const tries = 3 + Math.floor(b.vip / 3) + (rnd() < 0.3 ? 1 : 0);
    return { id: b.id, name: b.name, dmg: botPower(st, b) * k * tries * (0.65 + rnd() * 0.6), cls: botLoadout(b).ap.cls };
  });
  rows.push({ me: true, id: 'me', name: 'Minou (vous)', dmg: st.wb.today, cls: st.hero.cls });
  rows.sort((a, b) => b.dmg - a.dmg);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
export function wbRankReward(rank) {
  if (rank === 1) return { gems: 120, artDust: 300, eggs: 5, frags: 10, title: 'bossSlayer' };
  if (rank <= 3) return { gems: 80, artDust: 200, eggs: 3, frags: 8, title: 'bossSlayer' };
  if (rank <= 10) return { gems: 50, artDust: 150, eggs: 2, frags: 6 };
  if (rank <= 30) return { artDust: 100, eggs: 1, frags: 4 };
  return { artDust: 50, frags: 2 };
}
