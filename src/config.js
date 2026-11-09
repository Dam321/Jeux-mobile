// =====================================================================
//  MIAOU EMPIRE — Tables d'équilibrage (toutes les valeurs du jeu ici)
// =====================================================================
export const GAME_NAME = 'Miaou Empire';
export const SAVE_KEY = 'miaou-empire-save-v1';

// ---------------------------------------------------------------- Raretés
export const RARITIES = [
  { name: 'Commun', color: '#aeb7c2', dark: '#4f5864' },
  { name: 'Peu commun', color: '#62d86b', dark: '#1d7a35' },
  { name: 'Rare', color: '#4aa9ff', dark: '#1a4fb0' },
  { name: 'Épique', color: '#b968ff', dark: '#5a1aa8' },
  { name: 'Légendaire', color: '#ffb52e', dark: '#b4520a' },
  { name: 'Mythique', color: '#ff4d5e', dark: '#9c0f28' },
  { name: 'Divin', color: '#ff7ae0', dark: '#a0217f' },
  { name: 'Céleste', color: '#48f3ff', dark: '#0a6f94' },
  { name: 'Primordial', color: '#fff27a', dark: '#c2268f', rainbow: true },
];
export const RARITY_MULT = [1, 1.6, 2.5, 3.9, 6, 9.5, 15, 24, 40];
export const RARITY_SUBS = [0, 0, 1, 1, 2, 2, 3, 3, 4];

// ---------------------------------------------------------------- Carton (box) : probabilités
// poids = base * croissance^(niveau-1), rareté débloquée à partir de UNLOCK
const BOX_BASE = [1000, 400, 120, 30, 6, 1, 0.2, 0.04, 0.008];
const BOX_GROWTH = [0.9, 0.97, 1.03, 1.08, 1.12, 1.15, 1.17, 1.19, 1.2];
const BOX_UNLOCK = [1, 1, 1, 1, 1, 5, 10, 16, 22];
export const BOX_MAX_LEVEL = 30;
export function boxWeights(level) {
  return BOX_BASE.map((b, r) => (level >= BOX_UNLOCK[r] ? b * Math.pow(BOX_GROWTH[r], level - 1) : 0));
}
export function boxOdds(level) {
  const w = boxWeights(level);
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x / t) * 100);
}
export function boxUpgradeGold(level) {
  return Math.round(400 * Math.pow(1.85, level - 1));
}
export function boxUpgradeSeconds(level) {
  return Math.round(120 * Math.pow(1.38, level - 1));
}
// Coût en gemmes pour terminer instantanément (1 gemme / minute restante, min 1)
export function skipGemCost(secondsLeft) {
  return Math.max(1, Math.ceil(secondsLeft / 60));
}

// ---------------------------------------------------------------- Héros
export function xpToNext(level) {
  return Math.floor(5 + 0.34 * Math.pow(level, 1.85));
}
export const STAT_GROWTH = 1.06;
export function heroBase(level) {
  const g = Math.pow(STAT_GROWTH, level - 1);
  return { atk: 14 * g, hp: 140 * g, def: 5 * g };
}

// ---------------------------------------------------------------- Équipement
export const SLOTS = [
  { id: 'claws', name: 'Griffes', main: { atk: 3 } },
  { id: 'hat', name: 'Bonnet', main: { hp: 14, def: 0.6 } },
  { id: 'armor', name: 'Pull', main: { hp: 20, def: 1.2 } },
  { id: 'gloves', name: 'Mitaines', main: { atk: 1.4, hp: 5 } },
  { id: 'boots', name: 'Chaussons', main: { hp: 9, def: 0.8 } },
  { id: 'collar', name: 'Grelot', main: { atk: 1.2, hp: 6 } },
  { id: 'cape', name: 'Cape', main: { hp: 8, def: 1 } },
  { id: 'ring', name: 'Bague', main: { atk: 2 } },
];
export const GEAR_BASE = 4.2;

export const SUBSTATS = {
  crit: { name: 'Critique', base: 1.2, cap: 80 },
  critDmg: { name: 'Dégâts crit.', base: 6, cap: 1000 },
  combo: { name: 'Combo', base: 1.2, cap: 60 },
  counter: { name: 'Contre-attaque', base: 1.2, cap: 60 },
  stun: { name: 'Étourdissement', base: 0.8, cap: 40 },
  lifesteal: { name: 'Vol de vie', base: 1.0, cap: 40 },
  dodge: { name: 'Esquive', base: 0.8, cap: 40 },
  atkSpd: { name: 'Vitesse d\'attaque', base: 2, cap: 200 },
  skillDmg: { name: 'Dégâts compétences', base: 4, cap: 2000 },
  bossDmg: { name: 'Dégâts aux boss', base: 4, cap: 2000 },
};
export const SUBSTAT_KEYS = Object.keys(SUBSTATS);

// Recyclage d'un objet en or
export function recycleGold(item) {
  return Math.round(6 * Math.pow(STAT_GROWTH, item.l - 1) * (1 + item.r * item.r * 0.6));
}

// ---------------------------------------------------------------- Entraînement (or)
export const TRAININGS = [
  { id: 'atk', name: 'Griffes affûtées', stat: 'ATK', per: 2, icon: 'atk' },
  { id: 'hp', name: 'Gros câlins', stat: 'PV', per: 2, icon: 'hp' },
  { id: 'def', name: 'Fourrure épaisse', stat: 'DÉF', per: 2, icon: 'def' },
  { id: 'crit', name: 'Œil de lynx', stat: 'Critique', per: 0.1, icon: 'crit', max: 300 },
];
export function trainingCost(id, lvl) {
  const base = id === 'crit' ? 250 : 60;
  const g = id === 'crit' ? 1.14 : 1.1;
  return Math.round(base * Math.pow(g, lvl));
}

// ---------------------------------------------------------------- Ennemis / Campagne
export const ENEMY_GROWTH = 1.064;
export function stageIndex(chapter, stage) {
  return (chapter - 1) * 10 + (stage - 1);
}
export function enemyStats(s, kind = 'normal') {
  const g = Math.pow(ENEMY_GROWTH, s);
  const early = 0.55 + 0.45 * Math.min(1, s / 12); // début plus doux
  let st = { hp: 70 * g * early, atk: 7.5 * g * early, def: 2.5 * g, interval: 1.5 };
  if (kind === 'boss') st = { hp: st.hp * 9, atk: st.atk * 2.2, def: st.def * 1.5, interval: 1.6 };
  if (kind === 'elite') st = { hp: st.hp * 2.5, atk: st.atk * 1.4, def: st.def * 1.2, interval: 1.4 };
  return st;
}
export function stageGold(s) { return Math.round(40 * Math.pow(STAT_GROWTH, s)); }
export function killGold(s) { return Math.max(1, Math.round(5 * Math.pow(STAT_GROWTH, s))); }
export function stageYarn(s) { return 8 + Math.floor(s / 5); }

// Revenus passifs par heure, selon la meilleure étape franchie
export function idlePerHour(s) {
  return {
    gold: Math.round(2200 * Math.pow(STAT_GROWTH, s)),
    yarn: Math.round(40 + s * 0.6),
    xp: 0,
  };
}
export const OFFLINE_CAP_H = 12;

export const BIOMES = [
  { id: 'garden', name: 'Jardin Ensoleillé' },
  { id: 'autumn', name: 'Forêt d\'Automne' },
  { id: 'beach', name: 'Plage aux Sardines' },
  { id: 'snow', name: 'Pics Enneigés' },
  { id: 'neon', name: 'Ville Néon' },
  { id: 'volcano', name: 'Volcan Furieux' },
  { id: 'cosmos', name: 'Nébuleuse Féline' },
];
export function biomeForChapter(ch) { return BIOMES[(ch - 1) % BIOMES.length]; }

export const ENEMY_KINDS = ['rat', 'dog', 'vacuum', 'cucumber'];
export const BOSS_NAMES = {
  rat: 'Roi des Rats',
  dog: 'Cerbère le Bouledogue',
  vacuum: 'Aspirateur Suprême',
  cucumber: 'Concombre Titanesque',
};

// ---------------------------------------------------------------- Compétences (Plumes)
export const SKILL_RARITY_ODDS = [0, 0, 70, 22.5, 6, 1.3, 0.2]; // index = rareté (Rare..Divin)
export const SKILL_PITY_LEG = 50;
export const SKILL_PITY_DIV = 300;
export const SKILLS = [
  { id: 'slash', name: 'Griffes Éclair', r: 2, cd: 6, mult: 2.2, type: 'single', hits: 3, desc: 'Trois coups de griffes foudroyants sur une cible.' },
  { id: 'furball', name: 'Boule de Poils', r: 2, cd: 7, mult: 3.2, type: 'single', desc: 'Crache une boule de poils explosive.' },
  { id: 'kibble', name: 'Pluie de Croquettes', r: 3, cd: 9, mult: 1.4, type: 'aoe', hits: 3, desc: 'Une averse de croquettes sur tous les ennemis.' },
  { id: 'purrheal', name: 'Ronron Soignant', r: 3, cd: 12, heal: 0.22, type: 'heal', desc: 'Rend 22% des PV max.' },
  { id: 'fish', name: 'Tornade de Sardines', r: 4, cd: 10, mult: 1.1, type: 'aoe', hits: 5, desc: 'Un tourbillon de sardines broie tous les ennemis.' },
  { id: 'laser', name: 'Laser Oculaire', r: 4, cd: 9, mult: 4.5, type: 'aoe', desc: 'Deux rayons laser balaient le champ de bataille.' },
  { id: 'shield', name: 'Bouclier Ronronnant', r: 4, cd: 15, shield: 0.35, type: 'shield', desc: 'Absorbe des dégâts équivalents à 35% des PV max.' },
  { id: 'thunder', name: 'Foudre Féline', r: 5, cd: 11, mult: 6.5, type: 'aoe', desc: 'La foudre frappe chaque ennemi.' },
  { id: 'meteor', name: 'Météore de Pelote', r: 5, cd: 14, mult: 10, type: 'aoe', desc: 'Une pelote géante enflammée s\'écrase.' },
  { id: 'ninelives', name: 'Neuf Vies', r: 6, cd: 22, heal: 0.6, buff: 0.5, type: 'heal', desc: 'Soigne 60% des PV et +50% ATQ pendant 6s.' },
  { id: 'nova', name: 'Nova Cosmique', r: 6, cd: 16, mult: 18, type: 'aoe', desc: 'Une galaxie miniature explose sur l\'ennemi.' },
  { id: 'tiger', name: 'Griffe du Tigre Céleste', r: 6, cd: 13, mult: 9, type: 'aoe', hits: 2, desc: 'Une patte spectrale géante lacère tout.' },
];
export const SKILL_PASSIVE_ATK = { 2: 1, 3: 2.5, 4: 5, 5: 9, 6: 16 }; // % ATQ possédé

// ---------------------------------------------------------------- Compagnons (Œufs)
export const PET_RARITY_ODDS = [0, 0, 68, 24, 6.4, 1.4, 0.2];
export const PET_PITY_LEG = 40;
export const PETS = [
  { id: 'sparrow', name: 'Moineau Malin', r: 2, mult: 0.35, color: '#c98d4f' },
  { id: 'goldfish', name: 'Poisson Rouge', r: 2, mult: 0.4, color: '#ff7a2f' },
  { id: 'yarnling', name: 'Pelote Vivante', r: 3, mult: 0.6, color: '#ff5ca8' },
  { id: 'butterfly', name: 'Papillon Lunaire', r: 3, mult: 0.65, color: '#7fd8ff' },
  { id: 'owl', name: 'Hibou Sage', r: 4, mult: 1.0, color: '#b48cff' },
  { id: 'dragon', name: 'Dragonnet', r: 5, mult: 1.6, color: '#ff4d4d' },
  { id: 'phoenix', name: 'Phénix Doré', r: 6, mult: 2.6, color: '#ffc93c' },
];
export const PET_EQUIP_ATK = { 2: 6, 3: 12, 4: 24, 5: 45, 6: 80 }; // % ATQ si équipé
export const PET_OWN_HP = { 2: 1, 3: 2.5, 4: 5, 5: 9, 6: 16 }; // % PV possédé
export function dupNeed(lvl) { return lvl + 1; }

// ---------------------------------------------------------------- Costumes
export const SKINS = [
  { id: 'tabby', name: 'Tigré Roux', r: 2, atk: 0, hp: 0, src: 'Par défaut' },
  { id: 'siamese', name: 'Siamois Élégant', r: 3, atk: 0, hp: 6, src: 'Connexion jour 7' },
  { id: 'tux', name: 'Smoking', r: 3, atk: 6, hp: 0, src: 'Boutique d\'arène' },
  { id: 'snow', name: 'Flocon des Neiges', r: 3, atk: 4, hp: 8, src: 'Arbre à Chat étage 30' },
  { id: 'pirate', name: 'Capitaine Moustache', r: 4, atk: 12, hp: 12, src: 'Passe Royal premium' },
  { id: 'ninja', name: 'Ninja de l\'Ombre', r: 4, atk: 15, hp: 8, dodge: 3, src: 'Pack Ninja' },
  { id: 'pharaoh', name: 'Pharaon Doré', r: 5, atk: 22, hp: 22, src: 'VIP 8' },
  { id: 'cyber', name: 'Cyber Sphynx', r: 5, atk: 30, hp: 25, crit: 5, src: 'Pack Cyber' },
  { id: 'lion', name: 'Crinière Royale', r: 6, atk: 40, hp: 40, src: 'VIP 12' },
  { id: 'galaxy', name: 'Empereur Cosmique', r: 8, atk: 75, hp: 60, critDmg: 50, src: 'Pack Méga Baleine' },
];

// ---------------------------------------------------------------- VIP
// points VIP = centimes dépensés
export const VIP_THRESHOLDS = [0, 99, 500, 1500, 3000, 5000, 10000, 20000, 35000, 50000, 80000, 120000, 200000, 350000, 500000, 1000000];
export const VIP_PERKS = VIP_THRESHOLDS.map((_, v) => ({
  stat: [0, 3, 5, 8, 11, 15, 19, 24, 30, 36, 43, 52, 62, 75, 90, 120][v], // % ATQ & PV
  idle: v * 6, // % revenus passifs
  offlineH: OFFLINE_CAP_H + Math.min(12, v), // heures max hors-ligne
  dungeonBuys: 1 + Math.floor(v / 2),
  arenaBuys: 2 + v,
  speed: v >= 8 ? 3 : v >= 2 ? 2 : 1,
  batch: v >= 10 ? 50 : v >= 5 ? 25 : v >= 1 ? 10 : 5,
  skillSlots: v >= 6 ? 4 : 3,
  petSlots: v >= 4 ? 3 : 2,
  dailyGems: v * 20,
}));
export const VIP_TEXT = [
  'Bienvenue, chaton !',
  'Ouverture x10, vitesse auto du carton, +3% ATQ/PV',
  'Vitesse de combat x2',
  '+8% ATQ/PV, +18% revenus passifs',
  '3e emplacement de compagnon',
  'Ouverture x25',
  '4e emplacement de compétence',
  '+24% ATQ/PV',
  'Vitesse x3 + costume Pharaon Doré',
  '+36% ATQ/PV',
  'Ouverture x50',
  '+52% ATQ/PV',
  'Costume Crinière Royale',
  '+75% ATQ/PV',
  '+90% ATQ/PV',
  '+120% ATQ/PV — Titre « Empereur des Chats »',
];
export function vipLevel(points) {
  let v = 0;
  for (let i = 0; i < VIP_THRESHOLDS.length; i++) if (points >= VIP_THRESHOLDS[i]) v = i;
  return v;
}

// ---------------------------------------------------------------- Boutique (achats simulés)
// price en centimes. rewards : gold(heures d'or passif), gems, yarn, feathers, eggs, food, skin, speedH, pet, skill
export const PRODUCTS = {
  gems_1: { kind: 'gems', name: 'Bourse de gemmes', price: 99, gems: 60 },
  gems_2: { kind: 'gems', name: 'Sac de gemmes', price: 499, gems: 330 },
  gems_3: { kind: 'gems', name: 'Coffre de gemmes', price: 999, gems: 680 },
  gems_4: { kind: 'gems', name: 'Malle de gemmes', price: 1999, gems: 1380 },
  gems_5: { kind: 'gems', name: 'Trésor de gemmes', price: 4999, gems: 3480 },
  gems_6: { kind: 'gems', name: 'Montagne de gemmes', price: 9999, gems: 7280 },

  starter: { kind: 'once', name: 'Pack Débutant', price: 99, tag: '+900% de valeur', rewards: { yarn: 1500, gems: 300, feathers: 10, pet: 'owl' } },
  ninja: { kind: 'once', name: 'Pack Ninja', price: 999, tag: 'Costume exclusif', rewards: { skin: 'ninja', yarn: 4000, feathers: 25, eggs: 10 } },
  cyber: { kind: 'once', name: 'Pack Cyber Sphynx', price: 4999, tag: 'Costume + 25 000 pelotes', rewards: { skin: 'cyber', yarn: 25000, feathers: 120, eggs: 40, speedH: 24 } },
  whale: { kind: 'once', name: 'Pack Méga Baleine', price: 9999, tag: 'LE PLUS PUISSANT', rewards: { skin: 'galaxy', yarn: 60000, feathers: 350, eggs: 120, speedH: 72, gems: 3000, skill: 'nova' } },

  daily_1: { kind: 'daily', name: 'Offre du jour I', price: 99, rewards: { yarn: 800, gems: 40 } },
  daily_2: { kind: 'daily', name: 'Offre du jour II', price: 299, rewards: { yarn: 2200, feathers: 10 } },
  daily_3: { kind: 'daily', name: 'Offre du jour III', price: 499, rewards: { yarn: 4000, eggs: 6, gems: 120 } },

  weekly_1: { kind: 'weekly', name: 'Coffret hebdo', price: 999, rewards: { yarn: 9000, feathers: 30, eggs: 15, gems: 300 } },
  weekly_2: { kind: 'weekly', name: 'Coffret hebdo royal', price: 2999, rewards: { yarn: 30000, feathers: 90, eggs: 45, speedH: 24, gems: 900 } },

  power: { kind: 'flash', name: 'Pack Puissance', price: 299, tag: 'Offre flash', rewards: { yarn: 3000, gems: 200, feathers: 10, gold: 4 } },
  power_big: { kind: 'flash', name: 'Pack Puissance Ultime', price: 1999, tag: 'Offre flash', rewards: { yarn: 25000, gems: 800, feathers: 60, eggs: 25, gold: 24 } },

  monthly: { kind: 'card', name: 'Carte Mensuelle', price: 499, desc: '300 gemmes tout de suite + 100 gemmes / jour pendant 30 jours, +10% revenus passifs' },
  lifetime: { kind: 'card', name: 'Carte Royale à vie', price: 2499, desc: '1000 gemmes + 80 gemmes / jour à vie, +25% revenus passifs, ouverture auto débloquée, pubs ignorées' },
  fund: { kind: 'card', name: 'Fonds de croissance', price: 999, desc: 'Jusqu\'à 12 000 gemmes en progressant dans la campagne' },
  pass: { kind: 'pass', name: 'Passe Royal', price: 999 },
  pass_deluxe: { kind: 'pass', name: 'Passe Royal Deluxe', price: 1999 },
};

export const FIRST_RECHARGE = { yarn: 3000, gems: 500, skill: 'laser', pet: 'dragon', feathers: 20 };

export const FUND_TIERS = [5, 10, 20, 30, 40, 50, 70, 90, 110, 130, 160, 200].map((st, i) => ({ stage: st, gems: [300, 400, 500, 600, 700, 800, 1000, 1100, 1300, 1500, 1700, 2100][i] }));

// ---------------------------------------------------------------- Passe Royal (30 paliers)
export const PASS_XP_PER_TIER = 100;
export const PASS_TIERS = Array.from({ length: 30 }, (_, i) => {
  const t = i + 1;
  const free = t % 5 === 0 ? { gems: 60 } : t % 2 ? { yarn: 300 + t * 20 } : { gold: 1 };
  const prem = t === 30 ? { skin: 'pirate' } : t % 10 === 0 ? { eggs: 10, gems: 300 } : t % 5 === 0 ? { feathers: 15 } : t % 2 ? { yarn: 1200 + t * 60 } : { gems: 80 };
  return { t, free, prem };
});

// ---------------------------------------------------------------- Quêtes quotidiennes
export const DAILY_QUESTS = [
  { id: 'login', name: 'Se connecter', goal: 1, pts: 10 },
  { id: 'open', name: 'Ouvrir 100 cartons', goal: 100, pts: 20 },
  { id: 'stage', name: 'Franchir 5 étapes', goal: 5, pts: 15 },
  { id: 'dungeon', name: 'Terminer 2 donjons', goal: 2, pts: 15 },
  { id: 'arena', name: 'Combattre 3 fois en arène', goal: 3, pts: 15 },
  { id: 'summon', name: 'Invoquer 10 compétences', goal: 10, pts: 10 },
  { id: 'train', name: 'Entraîner 5 fois', goal: 5, pts: 10 },
  { id: 'ad', name: 'Regarder 2 vidéos bonus', goal: 2, pts: 5 },
];
export const DAILY_CHESTS = [
  { pts: 20, rewards: { yarn: 200 } },
  { pts: 40, rewards: { gold: 1, gems: 20 } },
  { pts: 60, rewards: { yarn: 400, feathers: 3 } },
  { pts: 80, rewards: { eggs: 2, gems: 30 } },
  { pts: 100, rewards: { yarn: 600, gems: 50, feathers: 5 } },
];
export const LOGIN_CALENDAR = [
  { yarn: 500 }, { gems: 100 }, { feathers: 10 }, { yarn: 1000 }, { eggs: 5 }, { gems: 200 }, { skin: 'siamese', feathers: 20 },
];

// Objectifs (succès) — grosse source de gemmes gratuites
export const ACHIEVEMENTS = [
  ...[10, 25, 50, 100, 150, 200, 300].map((v) => ({ id: 'stage' + v, kind: 'stage', goal: v, name: `Atteindre l'étape ${Math.floor((v - 1) / 10) + 1}-${((v - 1) % 10) + 1}`, gems: Math.round(80 + v * 2) })),
  ...[20, 40, 60, 80, 100, 150].map((v) => ({ id: 'lvl' + v, kind: 'level', goal: v, name: `Héros niveau ${v}`, gems: 100 + v * 2 })),
  ...[500, 2000, 10000, 50000, 200000].map((v) => ({ id: 'open' + v, kind: 'opens', goal: v, name: `Ouvrir ${v.toLocaleString('fr-FR')} cartons`, gems: 100 + Math.round(Math.sqrt(v) * 2) })),
  ...[5, 10, 20, 30, 50].map((v) => ({ id: 'tower' + v, kind: 'tower', goal: v, name: `Arbre à Chat étage ${v}`, gems: 150 + v * 4 })),
];

// ---------------------------------------------------------------- Donjons
export const DUNGEONS = [
  { id: 'gold', name: 'Grotte aux Pièces', desc: 'Des montagnes d\'or', color: '#ffc43d', enemy: 'rat' },
  { id: 'yarn', name: 'Grenier à Pelotes', desc: 'Des pelotes par milliers', color: '#ff6fb5', enemy: 'vacuum' },
  { id: 'feather', name: 'Volière Interdite', desc: 'Plumes d\'invocation', color: '#7fd8ff', enemy: 'dog' },
];
export const DUNGEON_FREE_KEYS = 2;
export function dungeonReward(id, lvl, bestStage) {
  if (id === 'gold') return { goldRaw: Math.round(idlePerHour(Math.max(lvl * 6, bestStage * 0.9)).gold * (1.2 + lvl * 0.05)) };
  if (id === 'yarn') return { yarn: 150 + lvl * 25 };
  return { feathers: 3 + Math.floor(lvl / 2) };
}
export function dungeonStage(lvl) { return 4 + lvl * 6; }

// ---------------------------------------------------------------- Arbre à Chat (tour)
export function towerStage(floor) { return 6 + floor * 4; }
export function towerReward(floor) {
  const r = { gems: 25 + Math.floor(floor / 5) * 5 };
  if (floor % 5 === 0) r.feathers = 5;
  if (floor % 10 === 0) { r.eggs = 3; r.gems += 150; }
  if (floor === 30) r.skin = 'snow';
  return r;
}

// ---------------------------------------------------------------- Arène
export const ARENA_FREE_TICKETS = 5;
export const ARENA_SHOP = [
  { id: 'a_skin', name: 'Costume Smoking', cost: 3000, rewards: { skin: 'tux' }, limit: 1 },
  { id: 'a_feathers', name: '10 Plumes', cost: 600, rewards: { feathers: 10 }, limit: 5 },
  { id: 'a_eggs', name: '5 Œufs', cost: 500, rewards: { eggs: 5 }, limit: 5 },
  { id: 'a_yarn', name: '1 000 Pelotes', cost: 300, rewards: { yarn: 1000 }, limit: 10 },
];
export function arenaDailyGems(rank) {
  if (rank === 1) return 600;
  if (rank <= 3) return 450;
  if (rank <= 10) return 300;
  if (rank <= 25) return 180;
  return 100;
}

// ---------------------------------------------------------------- Vidéos bonus (pubs simulées)
export const AD_LIMIT = 8;
export const AD_REWARDS = [{ yarn: 150 }, { gems: 15 }, { speedM: 15 }, { feathers: 1 }];
