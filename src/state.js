import { SAVE_KEY, DAILY_QUESTS, DUNGEONS, DUNGEON_FREE_KEYS, ARENA_FREE_TICKETS } from './config.js';
import { dayKey, seeded } from './util.js';

export function weekKey(t = Date.now()) {
  const d = new Date(t);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${w}`;
}

const BOT_PREFIX = ['Moustache', 'Ronron', 'Minou', 'Pattes', 'Griffe', 'Félin', 'Matou', 'Mistigri', 'Chaton', 'Tigrou', 'Caramel', 'Sushi', 'Nuage', 'Biscotte', 'Pacha', 'Zéphyr', 'Kiwi', 'Simba', 'Oreo', 'Pixel'];
const BOT_SUFFIX = ['Royal', 'XXL', 'Dark', '_FR', 'Turbo', 'Suprême', '77', 'Imperator', 'LeGrand', 'Ninja', 'Doré', '2000', 'Zen', 'Prime', '_Pro', 'Velours', 'Boss', 'Tonnerre'];
const SKIN_IDS = ['tabby', 'siamese', 'tux', 'snow', 'pirate', 'ninja', 'pharaoh', 'cyber', 'lion', 'galaxy'];

export function makeBots(seed) {
  const rnd = seeded(seed);
  const bots = [];
  for (let i = 0; i < 60; i++) {
    const name = BOT_PREFIX[Math.floor(rnd() * BOT_PREFIX.length)] + BOT_SUFFIX[Math.floor(rnd() * BOT_SUFFIX.length)];
    // Les premiers rangs sont des « baleines » au potentiel énorme
    const whale = i < 6;
    const factor = whale ? 60 / (i + 1) + 12 : Math.max(0.25, 10 * Math.pow(0.93, i - 6));
    const vip = whale ? 15 - i : Math.max(0, Math.floor(8 * Math.pow(0.9, i)));
    const skin = whale ? SKIN_IDS[9 - Math.min(i, 3)] : SKIN_IDS[Math.floor(rnd() * 6)];
    bots.push({ id: 'b' + i, name: (whale ? '👑 ' : '') + name, factor, vip, skin, grow: 0.85 + rnd() * 0.35 });
  }
  return bots;
}

export function defaultState() {
  const now = Date.now();
  const seed = Math.floor(Math.random() * 1e9);
  return {
    v: 1,
    created: now,
    lastSeen: now,
    seed,
    name: 'Minou',
    res: { gold: 300, gems: 150, yarn: 300, feathers: 5, eggs: 2, food: 0, arenaCoins: 0, speedMin: 30 },
    hero: { lvl: 1, xp: 0 },
    gear: { claws: null, hat: null, armor: null, gloves: null, boots: null, collar: null, cape: null, ring: null },
    box: { lvl: 1, upUntil: 0, auto: false, batch: 0, stopAt: 4, autoEquip: true },
    train: { atk: 0, hp: 0, def: 0, crit: 0 },
    skills: { owned: {}, equipped: [null, null, null, null], pulls: 0, pityLeg: 0, pityDiv: 0 },
    pets: { owned: {}, equipped: [null, null, null], pulls: 0, pityLeg: 0 },
    skins: { owned: ['tabby'], current: 'tabby' },
    camp: { ch: 1, st: 1, best: 0, auto: true, failStreak: 0 },
    tower: { floor: 1 },
    dungeons: Object.fromEntries(DUNGEONS.map((d) => [d.id, { lvl: 1, keys: DUNGEON_FREE_KEYS, buys: 0 }])),
    arena: { rank: 61, tickets: ARENA_FREE_TICKETS, buys: 0, wins: 0, claimedKey: '', shop: {}, bots: null },
    iap: {
      spent: 0, vip: 0, bought: {}, daily: {}, weekly: {}, firstRecharge: 0, // 0 = pas d'achat, 1 = à réclamer, 2 = réclamé
      monthlyUntil: 0, lifetime: false, fund: false, fundClaimed: [], pass: 0, flash: null, lastFlash: 0,
    },
    pass: { xp: 0, free: [], prem: [], seasonStart: now },
    daily: null,
    weekKey: weekKey(now),
    login: { claimed: 0, lastKey: '' },
    ach: [],
    stats: { opens: 0, kills: 0, arenaWins: 0, bossKills: 0 },
    settings: { quality: 'auto', sound: true, music: true, speed: 1 },
    idleSince: now,
    tutorial: 0,
  };
}

function deepMerge(base, saved) {
  if (saved == null || typeof saved !== 'object' || Array.isArray(saved)) return saved === undefined ? base : saved;
  const out = Array.isArray(base) ? [] : { ...base };
  for (const k in saved) {
    if (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]) && typeof saved[k] === 'object' && saved[k] !== null) out[k] = deepMerge(base[k], saved[k]);
    else out[k] = saved[k];
  }
  return out;
}

export function loadState(fromHot) {
  let saved = null;
  if (fromHot) saved = fromHot;
  else {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) { /* stockage indisponible */ }
  }
  const st = saved ? deepMerge(defaultState(), saved) : defaultState();
  if (!st.arena.bots) st.arena.bots = makeBots(st.seed);
  return st;
}

export function saveState(st) {
  st.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

// Remise à zéro quotidienne / hebdomadaire. Retourne true si un nouveau jour commence.
export function ensureDaily(st) {
  const k = dayKey();
  let fresh = false;
  if (!st.daily || st.daily.key !== k) {
    fresh = true;
    st.daily = {
      key: k,
      q: Object.fromEntries(DAILY_QUESTS.map((q) => [q.id, 0])),
      qDone: [],
      pts: 0,
      chests: [],
      ads: 0,
      freeGift: false,
      vipGift: false,
      cardGems: false,
      summonFree: false,
    };
    st.daily.q.login = 1;
    for (const d of DUNGEONS) {
      st.dungeons[d.id].keys = Math.max(st.dungeons[d.id].keys, DUNGEON_FREE_KEYS);
      st.dungeons[d.id].buys = 0;
    }
    st.arena.tickets = Math.max(st.arena.tickets, ARENA_FREE_TICKETS);
    st.arena.buys = 0;
    st.iap.daily = {};
  }
  const wk = weekKey();
  if (st.weekKey !== wk) {
    st.weekKey = wk;
    st.iap.weekly = {};
  }
  return fresh;
}
