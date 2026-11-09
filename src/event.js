// =====================================================================
//  Festival de la semaine (événement limité qui tourne chaque semaine) et
//  Bestiaire (paliers de chasse par monstre → bonus permanents).
//  Logique pure, testable sous Node.
// =====================================================================
import { weekKey } from './state.js';

// ---------------------------------------------------------------- festival
export const FESTIVALS = [
  { id: 'catnip', name: 'Festival de l\'Herbe à Chat', color: '#62d86b', accent: '#ffd23f', desc: 'Les chats sont euphoriques : tout ce que vous faites rapporte des lanternes !' },
  { id: 'lantern', name: 'Nuit des Lanternes', color: '#ff4d5e', accent: '#ffd23f', desc: 'Les toits s\'illuminent : chaque victoire allume une lanterne.' },
  { id: 'fishing', name: 'Grande Pêche', color: '#4aa9ff', accent: '#bff4ff', desc: 'Le port déborde de sardines : chassez, ouvrez, grimpez !' },
  { id: 'carnival', name: 'Carnaval des Moustaches', color: '#ff7ae0', accent: '#fff27a', desc: 'Masques, confettis et récompenses exclusives toute la semaine.' },
];
export function festivalOf(week) {
  let hs = 0;
  for (const c of week) hs = (hs * 31 + c.charCodeAt(0)) >>> 0;
  return FESTIVALS[hs % FESTIVALS.length];
}
// [quantité, points] : tous les X, on gagne Y points (et autant de lanternes à dépenser)
export const EVENT_RULES = {
  kill: { per: 25, pts: 1, label: 'Ennemis vaincus', unit: '25 ennemis' },
  open: { per: 10, pts: 1, label: 'Cartons ouverts', unit: '10 cartons' },
  stage: { per: 1, pts: 3, label: 'Nouvelle étape', unit: 'étape' },
  boss: { per: 1, pts: 15, label: 'Boss de map vaincu', unit: 'boss' },
  tower: { per: 1, pts: 5, label: 'Étage de la Tour', unit: 'étage' },
  raid: { per: 1, pts: 8, label: 'Assaut de Titan ou de Gardien', unit: 'assaut' },
  arena: { per: 1, pts: 5, label: 'Victoire en arène ou en guerre', unit: 'victoire' },
  gems: { per: 10, pts: 1, label: 'Gemmes dépensées', unit: '10 gemmes' },
};
export const EVENT_MILESTONES = [
  { pts: 40, rewards: { gold: 2, yarn: 300 } },
  { pts: 120, rewards: { gems: 30, feathers: 3 } },
  { pts: 250, rewards: { eggs: 3, artDust: 150 } },
  { pts: 450, rewards: { gems: 60, frags: 8 } },
  { pts: 700, rewards: { clover: 1, stone: 1, feathers: 5 } },
  { pts: 1000, rewards: { gems: 100, eggs: 5 } },
  { pts: 1400, rewards: { relicKeys: 1, frags: 15 } },
  { pts: 1900, rewards: { frame: 'festival', gems: 150 } },
  { pts: 2600, rewards: { aura: 'lantern', eggs: 8 } },
  { pts: 3500, rewards: { title: 'partyKing', gems: 300, relicKeys: 1 } },
];
export const EVENT_SHOP = [
  { id: 'es_eggs', name: '2 Paniers', cost: 60, rewards: { eggs: 2 }, limit: 10 },
  { id: 'es_feathers', name: '3 Plumes', cost: 50, rewards: { feathers: 3 }, limit: 10 },
  { id: 'es_dust', name: '100 poussières', cost: 40, rewards: { artDust: 100 }, limit: 10 },
  { id: 'es_frags', name: '5 fragments', cost: 70, rewards: { frags: 5 }, limit: 8 },
  { id: 'es_clover', name: 'Trèfle', cost: 80, rewards: { clover: 1 }, limit: 3 },
  { id: 'es_stone', name: 'Pierre de protection', cost: 150, rewards: { stone: 1 }, limit: 3 },
  { id: 'es_milk', name: '5 Laits dorés', cost: 90, rewards: { milk: 5 }, limit: 5 },
];
export function ensureEvent(st) {
  const E = st.event;
  if (E.week !== weekKey()) { E.week = weekKey(); E.pts = 0; E.acc = {}; E.claimed = []; E.shop = {}; st.res.fest = 0; } // les lanternes ne passent pas d'une semaine à l'autre
}
export function eventAdd(st, kind, n = 1) {
  const R = EVENT_RULES[kind];
  if (!R || !(n > 0)) return 0;
  ensureEvent(st);
  const E = st.event;
  E.acc[kind] = (E.acc[kind] || 0) + n;
  const k = Math.floor(E.acc[kind] / R.per);
  if (k <= 0) return 0;
  E.acc[kind] -= k * R.per;
  const gain = k * R.pts;
  E.pts += gain;
  st.res.fest += gain;
  return gain;
}
export function eventClaimable(st) {
  ensureEvent(st);
  return EVENT_MILESTONES.some((m, i) => st.event.pts >= m.pts && !st.event.claimed.includes(i));
}
export function weekEnd() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  return d.getTime() + (7 - day) * 864e5;
}

// ---------------------------------------------------------------- bestiaire
// Paliers de chasse par espèce (boss compris) : chaque palier atteint donne +0,2 % ATQ et +0,2 % PV pour toujours.
export const BESTIARY_TIERS = [10, 100, 1000, 10000];
export const BESTIARY_BOSS_TIERS = [1, 10, 50, 250];
export const BESTIARY_REWARDS = [{ gold: 1 }, { gems: 5 }, { gems: 15, eggs: 1 }, { gems: 40, frags: 10 }];
export const BESTIARY_PCT = 0.2;
export function tiersOf(n, boss) { const T = boss ? BESTIARY_BOSS_TIERS : BESTIARY_TIERS; let k = 0; while (k < T.length && n >= T[k]) k++; return k; }
export function bestiaryTotal(st, isBoss) {
  let t = 0;
  for (const kind in st.bestiary || {}) t += tiersOf(st.bestiary[kind], isBoss(kind));
  return t;
}
