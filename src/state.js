import { SAVE_KEY, DAILY_QUESTS, DUNGEONS, DUNGEON_FREE_KEYS, ARENA_FREE_TICKETS, ARENA_SIZE } from './config.js';
import { RESOURCES, TERRITORIES, CLANS, WAR_ENERGY } from './content.js';
import { dayKey, seeded } from './util.js';

export function weekKey(t = Date.now()) {
  const d = new Date(t);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${w}`;
}

const BOT_PREFIX = ['Moustache', 'Ronron', 'Minou', 'Pattes', 'Griffe', 'Félin', 'Matou', 'Mistigri', 'Chaton', 'Tigrou', 'Caramel', 'Sushi', 'Nuage', 'Biscotte', 'Pacha', 'Zéphyr', 'Kiwi', 'Simba', 'Oreo', 'Pixel', 'Filou', 'Gribouille', 'Ninja', 'Câlin'];
const BOT_SUFFIX = ['Royal', 'XXL', 'Dark', '_FR', 'Turbo', 'Suprême', '77', 'Imperator', 'LeGrand', 'Ninja', 'Doré', '2000', 'Zen', 'Prime', '_Pro', 'Velours', 'Boss', 'Tonnerre', 'Sauvage', 'DuToit'];
const FURS = ['roux', 'creme', 'gris', 'bleu', 'noir', 'blanc', 'choco', 'cannelle', 'fauve', 'lilas', 'argent', 'rose', 'menthe', 'lavande', 'dore', 'ombre'];
const PATS = ['solid', 'tabby', 'tiger', 'tuxedo', 'calico', 'siamese', 'spots', 'tortie'];
const EYES = ['vert', 'bleu', 'ambre', 'or', 'cuivre', 'violet', 'glace', 'rouge'];
const WEAPONS = ['claws', 'sword', 'katana', 'axe', 'hammer', 'staff', 'wand', 'bow', 'scythe', 'trident', 'fish', 'ladle'];
const HATS = ['beanie', 'wizard', 'crown', 'helmet', 'cowboy', 'beret', 'bandana', 'tophat', 'flowers', 'viking', 'chef', 'party', 'cap', null, null];
const FACES = ['round', 'sun', 'monocle', 'patch', 'ninja', 'star', 'visor', 'stache', null, null, null];
const ARMORS = ['tunic', 'plate', 'robe', 'hoodie', 'kimono', 'royal'];
const WINGS = ['angel', 'bat', 'butterfly', 'dragon', 'fairy', 'jetpack', 'fishpack', null, null, null];
const KIT = ['mistigri', 'caramel', 'biscotte', 'charbon', 'flocon', 'moka', 'praline', 'grisou', 'tigrou', 'flammeche', 'givre', 'etincelle', 'mousse', 'ombre', 'aurore', 'pyro', 'sphinxou', 'ninja', 'samourai', 'drakou', 'licorne', 'kitsune', 'seraphin', 'belzechat', 'astro'];

// Génère l'apparence + l'équipement visible d'un adversaire (PvP), selon sa « classe » (0 faible → 1 baleine)
export function makeCatLoadout(rnd, tier) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const r = () => Math.max(0, Math.min(8, Math.round(tier * 8 + (rnd() - 0.5) * 2)));
  const ap = { fur: pick(FURS), pattern: pick(PATS), eye: pick(EYES), eyeStyle: pick(['round', 'round', 'fierce', 'sleepy', 'sparkle']), ears: pick(['normal', 'normal', 'fold', 'lynx', 'big']), tail: pick(['normal', 'normal', 'fluffy', 'short']) };
  if (tier > 0.92 && rnd() < 0.5) Object.assign(ap, { fur: 'galaxie', pattern: 'galaxy', eye: 'galaxie' });
  const gear = { weapon: { base: pick(WEAPONS), r: r() }, armor: { base: pick(ARMORS), r: r() } };
  const hat = pick(HATS); if (hat) gear.hat = { base: hat, r: r() };
  const face = pick(FACES); if (face) gear.face = { base: face, r: r() };
  const w = tier > 0.3 ? pick(WINGS) : null; if (w) gear.wings = { base: w, r: r() };
  if (rnd() < 0.5 + tier * 0.4) gear.cape = { base: pick(['paw', 'star', 'moon', 'skull', 'heart']), r: r() };
  if (rnd() < 0.5) gear.boots = { base: pick(['boots', 'sneakers', 'slippers']), r: r() };
  const nk = 1 + Math.min(4, Math.floor(tier * 5 + rnd()));
  const kIdx = Math.min(KIT.length - 1, Math.floor(tier * (KIT.length - 4)));
  const kittens = Array.from({ length: nk }, () => KIT[Math.max(0, Math.min(KIT.length - 1, kIdx + Math.floor((rnd() - 0.6) * 8)))]);
  return { ap, gear, kittens };
}

export function makeBots(seed) {
  const rnd = seeded(seed);
  const bots = [];
  for (let i = 0; i < ARENA_SIZE - 1; i++) {
    const name = BOT_PREFIX[Math.floor(rnd() * BOT_PREFIX.length)] + BOT_SUFFIX[Math.floor(rnd() * BOT_SUFFIX.length)];
    const whale = i < 8;
    const factor = whale ? 80 / (i + 1) + 14 : Math.max(0.2, 12 * Math.pow(0.95, i - 8));
    const vip = whale ? 15 - Math.floor(i / 2) : Math.max(0, Math.floor(9 * Math.pow(0.93, i)));
    const tier = whale ? 0.9 + (8 - i) * 0.0125 : Math.max(0.05, 0.85 * Math.pow(0.975, i));
    const clan = ['claws', 'port', 'roofs'][Math.floor(rnd() * 3)];
    bots.push({ id: 'b' + i, name: (whale ? '♛ ' : '') + name, factor, vip, tier, clan, grow: 0.85 + rnd() * 0.35, seed: Math.floor(rnd() * 1e9) });
  }
  return bots;
}

function makeWar(seed) {
  const rnd = seeded(seed + 77);
  const terr = {};
  TERRITORIES.forEach((t, i) => {
    const owner = i === 0 ? 'me' : CLANS[1 + Math.floor(rnd() * 3)].id;
    terr[t.id] = { owner, hp: 3, lvl: 1 + Math.floor(rnd() * 3) + (t.pts >= 4 ? 3 : 0), seed: Math.floor(rnd() * 1e9) };
  });
  return { energy: WAR_ENERGY, buys: 0, terr, points: { me: 0, claws: 0, port: 0, roofs: 0 }, lastTick: Date.now(), week: weekKey(), log: [], shop: {}, tributeKey: '', wins: 0 };
}

export function defaultState() {
  const now = Date.now();
  const seed = Math.floor(Math.random() * 1e9);
  return {
    v: 2,
    created: now,
    lastSeen: now,
    seed,
    name: 'Minou',
    res: { gold: 300, gems: 150, yarn: 300, feathers: 5, eggs: 3, arenaCoins: 0, warCoins: 0, towerTokens: 0, speedMin: 30, stone: 0, scroll: 0, clover: 0, milk: 0, relicKeys: 0 },
    artifacts: { owned: {}, equipped: [null, null, null, null, null, null], pulls: 0 },
    cos: { auras: [], aura: null, titles: ['kitten'], title: 'kitten', frames: ['basic'], frame: 'basic' },
    potions: {},
    loyalty: [],
    mats: Object.fromEntries(RESOURCES.map((r) => [r.id, 0])),
    hero: { lvl: 1, xp: 0 },
    gear: { weapon: null, hat: null, face: null, armor: null, cape: null, wings: null, gloves: null, boots: null, collar: null, ring: null },
    bag: [],
    box: { lvl: 1, upUntil: 0, auto: false, batch: 0, stopAt: 4, autoBreak: false },
    train: { atk: 0, hp: 0, def: 0, crit: 0 },
    skills: { owned: {}, equipped: [null, null, null, null], pulls: 0, pityLeg: 0, pityDiv: 0 },
    kittens: { owned: { mistigri: { lvl: 1, copies: 0 } }, equipped: ['mistigri', null, null, null, null], pulls: 0, pityLeg: 0, pityMyth: 0, seen: ['mistigri'] },
    look: { fur: 'roux', pattern: 'tabby', pcolor: null, pcolor2: null, eye: 'vert', eye2: null, eyeStyle: 'round', ears: 'normal', tail: 'normal' },
    unlocks: [],
    costumes: { owned: ['tabby'], current: 'tabby', show: false },
    artisan: { lvl: 1, xp: 0 },
    boost: { cloverUntil: 0, atkUntil: 0, hpUntil: 0, goldUntil: 0, luckUntil: 0, royalUntil: 0 },
    relic: { pulls: 0, pity: 0 },
    camp: { ch: 1, st: 1, best: 0, auto: true, failStreak: 0 },
    tower: { floor: 1, best: 0, shop: {}, reviveBuff: 0 },
    lairs: { tickets: 3, buys: 0 },
    dungeons: Object.fromEntries(DUNGEONS.map((d) => [d.id, { lvl: 1, keys: DUNGEON_FREE_KEYS, buys: 0 }])),
    arena: { tickets: ARENA_FREE_TICKETS, buys: 0, wins: 0, claimedKey: '', shop: {}, bots: null, order: null, season: weekKey(), best: ARENA_SIZE },
    market: null,
    war: null,
    iap: {
      spent: 0, vip: 0, bought: {}, daily: {}, weekly: {}, firstRecharge: 0,
      monthlyUntil: 0, noads: false, fund: false, fundClaimed: [], pass: 0, flash: null, lastFlash: 0, months: {},
    },
    pass: { xp: 0, free: [], prem: [], seasonStart: now },
    daily: null,
    weekKey: weekKey(now),
    login: { claimed: 0, lastKey: '' },
    ach: [],
    stats: { opens: 0, kills: 0, arenaWins: 0, bossKills: 0, crafts: 0, sold: 0, kittensFound: 0 },
    settings: { quality: 'auto', sound: true, music: true, speed: 1, capCents: 0 },
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
  if (fromHot && fromHot.v === 2) saved = fromHot;
  else {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) { /* stockage indisponible */ }
  }
  const st = saved ? deepMerge(defaultState(), saved) : defaultState();
  if (!st.arena.bots) st.arena.bots = makeBots(st.seed);
  if (!st.arena.order) st.arena.order = [...st.arena.bots.map((b) => b.id), 'me'];
  if (!st.war) st.war = makeWar(st.seed);
  if (st.iap.lifetime) { st.iap.noads = true; delete st.iap.lifetime; }
  if (st.tower.best < st.tower.floor - 1) st.tower.best = st.tower.floor - 1;
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
      qDone: [], pts: 0, chests: [], ads: 0, freeGift: false, vipGift: false, cardGems: false, summonFree: false, changeBought: 0, artFree: false, towerDaily: false,
    };
    st.daily.q.login = 1;
    for (const d of DUNGEONS) {
      st.dungeons[d.id].keys = Math.max(st.dungeons[d.id].keys, DUNGEON_FREE_KEYS);
      st.dungeons[d.id].buys = 0;
    }
    st.lairs.tickets = Math.max(st.lairs.tickets, 3);
    st.lairs.buys = 0;
    st.arena.tickets = Math.max(st.arena.tickets, ARENA_FREE_TICKETS);
    st.arena.buys = 0;
    if (st.war) { st.war.energy = Math.max(st.war.energy, WAR_ENERGY); st.war.buys = 0; }
    st.iap.daily = {};
  }
  const wk = weekKey();
  if (st.weekKey !== wk) {
    st.weekKey = wk;
    st.iap.weekly = {};
  }
  return fresh;
}
export { makeWar };
